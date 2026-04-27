// Parser + executor for the text-structured action protocol the builder
// emits (see packages/core/src/builder/system-prompt.ts).
//
// Three block types are recognized :
//
//   ```forge:write
//   path: <relative path under ~/.agent-forge/>
//   ---
//   <full file content>
//   ```
//
//   ```forge:run
//   agent: <kebab-case agent name>
//   ---
//   <prompt sent to the agent>
//   ```
//
//   ```forge:skill
//   name: <kebab-case skill name>
//   ```
//
// The closing fence is optional (small models sometimes forget the trailing
// ```). When present, content stops there ; otherwise it extends to the
// end of the message.

import { parseAgentMd } from '@agent-forge/core/types'
import { executeFileWrite } from '@agent-forge/tools-core'

const FENCE_OPEN = /```forge:(write|run|skill)\s*\n/g
// Pattern used to strip whole forge:* blocks (open + body + optional close)
// from the assistant text so the chat transcript stays prose-only.
const FENCE_BLOCK = /```forge:(?:write|run|skill)\s*\n[\s\S]*?(?:\n```|$)/g

/** Remove every forge:write / forge:run block from a builder reply.
 * Used to keep the chat transcript free of action code — actions live in
 * the mission-control panel above. */
export function stripActionBlocks(text: string): string {
  return text.replace(FENCE_BLOCK, '').replace(/\n{3,}/g, '\n\n').trim()
}

export type ParsedWriteAction = {
  kind: 'write'
  path: string
  content: string
  raw: string
}

export type ParsedRunAction = {
  kind: 'run'
  agent: string
  prompt: string
  raw: string
}

export type ParsedSkillAction = {
  kind: 'skill'
  skill: string
  raw: string
}

export type ParsedAction = ParsedWriteAction | ParsedRunAction | ParsedSkillAction

export type ActionParseResult =
  | { ok: true; action: ParsedAction }
  | { ok: false; error: string; raw: string }

function splitHeaderBody(inner: string): { header: string; body: string } | null {
  // Expected : `<key>: <value>\n---\n<body>`
  const lines = inner.split('\n')
  if (lines.length < 3) return null
  const headerLine = lines[0] ?? ''
  const sep = lines[1] ?? ''
  if (sep.trim() !== '---') return null
  return { header: headerLine, body: lines.slice(2).join('\n') }
}

function parseWrite(inner: string, raw: string): ActionParseResult {
  const split = splitHeaderBody(inner)
  if (!split || !split.header.startsWith('path:')) {
    return {
      ok: false,
      error: 'malformed forge:write block (expected `path: ...` then `---` then content)',
      raw,
    }
  }
  return {
    ok: true,
    action: {
      kind: 'write',
      path: split.header.slice('path:'.length).trim(),
      content: split.body,
      raw,
    },
  }
}

function parseRun(inner: string, raw: string): ActionParseResult {
  const split = splitHeaderBody(inner)
  if (!split || !split.header.startsWith('agent:')) {
    return {
      ok: false,
      error: 'malformed forge:run block (expected `agent: <name>` then `---` then prompt)',
      raw,
    }
  }
  const agent = split.header.slice('agent:'.length).trim()
  if (!/^[a-z][a-z0-9-]*$/.test(agent)) {
    return {
      ok: false,
      error: `forge:run agent name must be kebab-case (got "${agent}")`,
      raw,
    }
  }
  const prompt = split.body.trim()
  if (prompt.length === 0) {
    return { ok: false, error: 'forge:run prompt is empty', raw }
  }
  return { ok: true, action: { kind: 'run', agent, prompt, raw } }
}

function parseSkill(inner: string, raw: string): ActionParseResult {
  // forge:skill expects a single key=value pair, optionally followed by a
  // closing fence. Accept both `name: scaffold-and-run` (the documented
  // form) and a bare line containing the name only — small models slip.
  const firstLine = (inner.split('\n')[0] ?? '').trim()
  const candidate = firstLine.startsWith('name:')
    ? firstLine.slice('name:'.length).trim()
    : firstLine
  if (candidate.length === 0) {
    return { ok: false, error: 'forge:skill block missing skill name', raw }
  }
  if (!/^[a-z][a-z0-9-]*$/.test(candidate)) {
    return {
      ok: false,
      error: `forge:skill name must be kebab-case (got "${candidate}")`,
      raw,
    }
  }
  return { ok: true, action: { kind: 'skill', skill: candidate, raw } }
}

export function findActionBlocks(text: string): ActionParseResult[] {
  const out: ActionParseResult[] = []
  const matches = [...text.matchAll(FENCE_OPEN)]
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (!m) continue
    const kind = m[1] as 'write' | 'run' | 'skill'
    const start = (m.index ?? 0) + m[0].length
    const closingIdx = text.indexOf('\n```', start)
    const end = closingIdx >= 0 ? closingIdx : text.length
    const inner = text.slice(start, end).replace(/\s+$/, '')
    const raw = text.slice(m.index ?? 0, end + (closingIdx >= 0 ? 4 : 0))
    if (kind === 'write') out.push(parseWrite(inner, raw))
    else if (kind === 'run') out.push(parseRun(inner, raw))
    else out.push(parseSkill(inner, raw))
  }
  return out
}

export type WriteActionExecution = {
  kind: 'write'
  path: string
  result:
    | { ok: true; absolutePath: string }
    | { ok: false; error: string }
}

export type RunActionExecution = {
  kind: 'run'
  agent: string
  // The agent execution itself is asynchronous and streamed — handled by
  // useChat directly via launchAgent(). This struct is only used for sync
  // pre-flight (e.g. AGENT.md missing).
  result: { ok: false; error: string } | { ok: true }
}

export type SkillActionExecution = {
  kind: 'skill'
  skill: string
  // Skills are read-only : loading one cannot fail at exec time besides
  // "skill not found in the catalog". The catalog is enforced upstream.
  result: { ok: true; body: string } | { ok: false; error: string }
}

export type ActionExecution =
  | WriteActionExecution
  | RunActionExecution
  | SkillActionExecution

function quoteUnsafeDescription(content: string): string {
  // Small models commonly write a `description` value containing a colon
  // (e.g. "Étape 1 : ..." or "...timeout: 60s..."), which YAML mis-parses
  // as a nested mapping and chokes the whole frontmatter. Detect that case
  // and wrap the value in double quotes ; the parser then reads it as a
  // plain string.
  const lines = content.split('\n')
  let inFrontmatter = false
  let fmFenceCount = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string
    if (line.trim() === '---') {
      fmFenceCount += 1
      inFrontmatter = fmFenceCount === 1
      if (fmFenceCount === 2) break
      continue
    }
    if (!inFrontmatter) continue
    const m = /^(\s*description\s*:\s*)(.*)$/.exec(line)
    if (!m) continue
    const prefix = m[1] as string
    const value = (m[2] as string).trim()
    if (value.length === 0) continue
    // Already quoted ? leave it alone.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      continue
    }
    if (!value.includes(':')) continue
    // Escape any embedded double quotes so the wrap stays valid.
    const safe = value.replace(/"/g, '\\"')
    lines[i] = `${prefix}"${safe}"`
  }
  return lines.join('\n')
}

function normalizeAgentMd(content: string): string {
  // Small models often confuse the protocol separator (`---` between path
  // and content) with the YAML frontmatter opener and forget to write a
  // leading `---`. If the content looks like raw frontmatter (starts with a
  // recognized key), prepend `---` so it parses cleanly.
  const trimmed = content.replace(/^\s+/, '')
  let normalized = content
  if (!trimmed.startsWith('---')) {
    if (/^(name|description|model|sandbox|maxTurns)\s*:/m.test(trimmed)) {
      normalized = `---\n${content.replace(/^\s+/, '')}`
    }
  }
  return quoteUnsafeDescription(normalized)
}

const AGENT_PATH_RE = /^(agents\/[a-z][a-z0-9-]*)\/[^/]+$/

function normalizeWritePath(path: string): string {
  const match = path.match(AGENT_PATH_RE)
  if (match && match[1]) {
    return `${match[1]}/AGENT.md`
  }
  return path
}

function looksLikeAgent(path: string): boolean {
  return path.startsWith('agents/')
}

export type ExecuteActionOptions = {
  overwrite?: boolean
  // Resolver injected by useChat. Returns the skill body when the LLM
  // asked to load a skill. We don't import the catalog here directly to
  // keep this module testable without filesystem dependencies.
  resolveSkill?: (name: string) => string | null
}

/**
 * Synchronously prepare and (for write) execute a parsed action.
 * For run actions, only validates pre-conditions ; the actual launch is
 * driven by useChat via launchAgent() so output can be streamed.
 * For skill actions, looks up the skill body via the resolver.
 */
export function executeAction(
  action: ParsedAction,
  options: ExecuteActionOptions = {},
): ActionExecution {
  if (action.kind === 'run') {
    return { kind: 'run', agent: action.agent, result: { ok: true } }
  }

  if (action.kind === 'skill') {
    if (!options.resolveSkill) {
      return {
        kind: 'skill',
        skill: action.skill,
        result: { ok: false, error: 'no skill resolver configured' },
      }
    }
    const body = options.resolveSkill(action.skill)
    if (body === null) {
      return {
        kind: 'skill',
        skill: action.skill,
        result: { ok: false, error: `skill not found : ${action.skill}` },
      }
    }
    return { kind: 'skill', skill: action.skill, result: { ok: true, body } }
  }

  const path = normalizeWritePath(action.path)
  let content = action.content

  if (looksLikeAgent(path)) {
    content = normalizeAgentMd(content)
    try {
      parseAgentMd(content)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { kind: 'write', path, result: { ok: false, error: msg } }
    }
  }

  const result = executeFileWrite({
    path,
    content,
    overwrite: options.overwrite,
  })
  return { kind: 'write', path, result }
}
