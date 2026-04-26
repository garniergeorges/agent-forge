// Parser + executor for the text-structured action protocol the builder
// emits (see packages/core/src/builder/system-prompt.ts).
//
// Format expected in builder output :
//
//   ```forge:write
//   path: <relative path under ~/.agent-forge/>
//   ---
//   <full file content, possibly multi-line>
//   ```
//
// The closing fence is optional : if absent, the parser takes everything
// from the path line until the end of the message. This makes the parser
// tolerant to small models that occasionally forget the trailing ```.
//
// If the path ends with `AGENT.md`, the content is validated with the
// AgentMd Zod schema before being executed, and the validation error (if
// any) is surfaced as a system message instead of writing junk to disk.

import { parseAgentMd } from '@agent-forge/core/types'
import { executeFileWrite } from '@agent-forge/tools-core'

const FENCE_OPEN = /```forge:write\s*\n/g

export type ParsedAction = {
  path: string
  content: string
  raw: string // the full block text, for echoing
}

export type ActionParseResult =
  | { ok: true; action: ParsedAction }
  | { ok: false; error: string; raw: string }

function parseInner(inner: string): { path: string; content: string } | null {
  // Expected : `path: <something>\n---\n<content>`
  const lines = inner.split('\n')
  if (lines.length < 3) return null
  const pathLine = lines[0] ?? ''
  const sep = lines[1] ?? ''
  if (!pathLine.startsWith('path:')) return null
  if (sep.trim() !== '---') return null
  const path = pathLine.slice('path:'.length).trim()
  const content = lines.slice(2).join('\n')
  return { path, content }
}

export function findActionBlocks(text: string): ActionParseResult[] {
  const out: ActionParseResult[] = []
  const matches = [...text.matchAll(FENCE_OPEN)]
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (!m) continue
    const start = (m.index ?? 0) + m[0].length
    // Closing fence : either next ``` or end of text.
    const closingIdx = text.indexOf('\n```', start)
    const end = closingIdx >= 0 ? closingIdx : text.length
    const inner = text.slice(start, end).replace(/\s+$/, '')
    const raw = text.slice(m.index ?? 0, end + (closingIdx >= 0 ? 4 : 0))
    const parsed = parseInner(inner)
    if (!parsed) {
      out.push({
        ok: false,
        error:
          'malformed forge:write block (expected `path: ...` then `---` then content)',
        raw,
      })
      continue
    }
    out.push({ ok: true, action: { path: parsed.path, content: parsed.content, raw } })
  }
  return out
}

export type ActionExecution = {
  path: string
  result:
    | { ok: true; absolutePath: string }
    | { ok: false; error: string }
}

function normalizeAgentMd(content: string): string {
  // Small models often confuse the protocol separator (`---` between path
  // and content) with the YAML frontmatter opener and forget to write a
  // leading `---`. If the content looks like raw frontmatter (starts with a
  // recognized key), prepend `---` so it parses cleanly.
  const trimmed = content.replace(/^\s+/, '')
  if (trimmed.startsWith('---')) return content
  if (/^(name|description|model|sandbox|maxTurns)\s*:/m.test(trimmed)) {
    return `---\n${content.replace(/^\s+/, '')}`
  }
  return content
}

const AGENT_PATH_RE = /^(agents\/[a-z][a-z0-9-]*)\/[^/]+$/

function normalizePath(path: string): string {
  // Coerce any `agents/<name>/<whatever>.md` into the canonical
  // `agents/<name>/AGENT.md`. Small models routinely emit
  // `<name>.md`, `HAIKU-WRITER.md`, etc.
  const match = path.match(AGENT_PATH_RE)
  if (match && match[1]) {
    return `${match[1]}/AGENT.md`
  }
  return path
}

function looksLikeAgent(path: string): boolean {
  return path.startsWith('agents/')
}

export function executeAction(
  action: ParsedAction,
  options: { overwrite?: boolean } = {},
): ActionExecution {
  const path = normalizePath(action.path)
  let content = action.content

  // Anything under `agents/...` MUST be a valid AGENT.md. Normalize the
  // frontmatter and validate before touching the disk.
  if (looksLikeAgent(path)) {
    content = normalizeAgentMd(content)
    try {
      parseAgentMd(content)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { path, result: { ok: false, error: msg } }
    }
  }

  const result = executeFileWrite({
    path,
    content,
    overwrite: options.overwrite,
  })
  return { path, result }
}
