// Agent-side tool protocol — fenced blocks the agent emits to invoke a
// native tool, and the rendering of tool results back to the LLM.
//
// We deliberately mirror the builder's text-structured protocol (forge:write
// and forge:run) instead of using OpenAI tool_calls for two reasons :
//   1. Local LLMs (MLX, llama.cpp) often don't honor tool_calls.
//   2. A consistent protocol across builder and agents simplifies debugging
//      and lets users read the raw stream.
//
// Six tools wired today : bash, write, read, edit, grep, glob.
//
//   ```forge:bash
//   { "command": "ls -la" }
//   ```
//
//   ```forge:write
//   { "path": "src/index.ts", "content": "..." }
//   ```
//
//   ```forge:read
//   { "path": "src/index.ts", "offset": 0, "limit": 200 }
//   ```
//
//   ```forge:edit
//   { "path": "src/index.ts", "oldString": "...", "newString": "..." }
//   ```
//
//   ```forge:grep
//   { "pattern": "TODO", "glob": "**/*.ts", "ignoreCase": true }
//   ```
//
//   ```forge:glob
//   { "pattern": "src/**/*.ts" }
//   ```
//
// All blocks emitted in a single LLM reply are parsed and executed in
// order via parseAllToolBlocks. Small models (Mistral Small) routinely
// emit several blocks in one turn ; processing only the first one
// (the historical behaviour, kept as parseFirstToolBlock for tests
// and edge cases) led to lost work and the agent visibly panicking
// in the next turn ("I wrote utils.ts but forgot the edits, let me
// run npm test instead").

import { z } from 'zod'
import {
  BashInputSchema,
  RuntimeFileEditInputSchema,
  RuntimeFileReadInputSchema,
  RuntimeFileWriteInputSchema,
  RuntimeGlobInputSchema,
  RuntimeGrepInputSchema,
  type BashInput,
  type BashResult,
  type GrepHit,
  type RuntimeFileEditInput,
  type RuntimeFileEditResult,
  type RuntimeFileReadInput,
  type RuntimeFileReadResult,
  type RuntimeFileWriteInput,
  type RuntimeFileWriteResult,
  type RuntimeGlobInput,
  type RuntimeGlobResult,
  type RuntimeGrepInput,
  type RuntimeGrepResult,
} from '@agent-forge/tools-core'

export type ToolKind = 'bash' | 'write' | 'read' | 'edit' | 'grep' | 'glob'

export type ParsedTool =
  | { kind: 'bash'; input: BashInput; raw: string }
  | { kind: 'write'; input: RuntimeFileWriteInput; raw: string }
  | { kind: 'read'; input: RuntimeFileReadInput; raw: string }
  | { kind: 'edit'; input: RuntimeFileEditInput; raw: string }
  | { kind: 'grep'; input: RuntimeGrepInput; raw: string }
  | { kind: 'glob'; input: RuntimeGlobInput; raw: string }

export type ParseOutcome =
  | { kind: 'none'; text: string }
  | { kind: 'invalid'; text: string; error: string; raw: string }
  | { kind: 'tool'; text: string; tool: ParsedTool }

const SCHEMAS: Record<ToolKind, z.ZodTypeAny> = {
  bash: BashInputSchema,
  write: RuntimeFileWriteInputSchema,
  read: RuntimeFileReadInputSchema,
  edit: RuntimeFileEditInputSchema,
  grep: RuntimeGrepInputSchema,
  glob: RuntimeGlobInputSchema,
}

const FENCE_RE = /```forge:(bash|write|read|edit|grep|glob)\s*\n([\s\S]*?)```/
// Same shape as FENCE_RE but with the global flag so matchAll can walk
// every block in the reply, in order.
const FENCE_RE_GLOBAL = /```forge:(bash|write|read|edit|grep|glob)\s*\n([\s\S]*?)```/g

function buildOutcomeFromMatch(
  m: RegExpMatchArray,
  before: string,
): ParseOutcome {
  const tag = m[1] as ToolKind
  const body = m[2] ?? ''
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (err) {
    return {
      kind: 'invalid',
      text: before,
      error: `forge:${tag} block is not valid JSON : ${
        err instanceof Error ? err.message : String(err)
      }`,
      raw: m[0],
    }
  }
  const schema = SCHEMAS[tag]
  const result = schema.safeParse(parsed)
  if (!result.success) {
    return {
      kind: 'invalid',
      text: before,
      error: `forge:${tag} input failed validation : ${formatZodError(result.error)}`,
      raw: m[0],
    }
  }
  return {
    kind: 'tool',
    text: before,
    tool: { kind: tag, input: result.data, raw: m[0] } as ParsedTool,
  }
}

/**
 * Parse every forge:* block in the reply, in source order. Each entry
 * carries the prose chunk that PRECEDES it (so the runtime can surface
 * the agent's narration before each tool call). Returns an empty array
 * if the reply has no blocks at all.
 */
export function parseAllToolBlocks(stream: string): ParseOutcome[] {
  const matches = [...stream.matchAll(FENCE_RE_GLOBAL)]
  if (matches.length === 0) return []
  const outcomes: ParseOutcome[] = []
  let cursor = 0
  for (const m of matches) {
    const idx = m.index ?? 0
    const before = stream.slice(cursor, idx)
    outcomes.push(buildOutcomeFromMatch(m, before))
    cursor = idx + m[0].length
  }
  return outcomes
}

export function parseFirstToolBlock(stream: string): ParseOutcome {
  const m = FENCE_RE.exec(stream)
  if (!m) return { kind: 'none', text: stream }
  const before = stream.slice(0, m.index)
  return buildOutcomeFromMatch(m, before)
}

function formatZodError(err: z.ZodError): string {
  return err.errors
    .map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`)
    .join(' ; ')
}

// ── Result renderers : turn each tool's structured result into the
// message we feed back to the LLM on the next turn. Same `[forge:X result]`
// header so the agent recognizes it as the answer to its previous call.

export function renderBashResult(input: BashInput, result: BashResult): string {
  const head = `[forge:bash result] command="${input.command}" exit=${result.exitCode.toString()}${
    result.timedOut ? ' (timed out)' : ''
  }`
  const stdout = result.stdout.length > 0 ? `\n--- stdout ---\n${result.stdout}` : ''
  const stderr = result.stderr.length > 0 ? `\n--- stderr ---\n${result.stderr}` : ''
  return `${head}${stdout}${stderr}`
}

export function renderWriteResult(
  input: RuntimeFileWriteInput,
  result: RuntimeFileWriteResult,
): string {
  if (result.ok) {
    return `[forge:write result] wrote ${result.absolutePath} (${result.bytes.toString()} bytes)`
  }
  return `[forge:write result] FAILED on path="${input.path}" : ${result.error}`
}

export function renderReadResult(
  input: RuntimeFileReadInput,
  result: RuntimeFileReadResult,
): string {
  if (!result.ok) {
    return `[forge:read result] FAILED on path="${input.path}" : ${result.error}`
  }
  const head = `[forge:read result] ${result.absolutePath} · lines ${(input.offset ?? 0).toString()}..${(
    (input.offset ?? 0) + result.returnedLines
  ).toString()} of ${result.totalLines.toString()}${result.truncatedBytes ? ' (clipped)' : ''}`
  return `${head}\n--- content ---\n${result.content}`
}

export function renderEditResult(
  input: RuntimeFileEditInput,
  result: RuntimeFileEditResult,
): string {
  if (result.ok) {
    return `[forge:edit result] ${result.absolutePath} · ${result.replacements.toString()} replacement${
      result.replacements === 1 ? '' : 's'
    }`
  }
  return `[forge:edit result] FAILED on path="${input.path}" : ${result.error}`
}

export function renderGlobResult(
  input: RuntimeGlobInput,
  result: RuntimeGlobResult,
): string {
  if (!result.ok) {
    return `[forge:glob result] FAILED on pattern="${input.pattern}" : ${result.error}`
  }
  const head = `[forge:glob result] ${result.matches.length.toString()} match${
    result.matches.length === 1 ? '' : 'es'
  }${result.truncated ? ' (truncated)' : ''}`
  if (result.matches.length === 0) return head
  return `${head}\n${result.matches.join('\n')}`
}

export function renderGrepResult(
  input: RuntimeGrepInput,
  result: RuntimeGrepResult,
): string {
  if (!result.ok) {
    return `[forge:grep result] FAILED on pattern="${input.pattern}" : ${result.error}`
  }
  const head = `[forge:grep result] ${result.hits.length.toString()} hit${
    result.hits.length === 1 ? '' : 's'
  } across ${result.scanned.toString()} file${result.scanned === 1 ? '' : 's'}${
    result.truncated ? ' (truncated)' : ''
  }`
  if (result.hits.length === 0) return head
  const body = result.hits
    .map((h: GrepHit) => `${h.path}:${h.line.toString()}: ${h.text}`)
    .join('\n')
  return `${head}\n${body}`
}

export function renderInvalid(error: string): string {
  return `[forge:tool error] ${error}\n\nFix the JSON or schema and try again.`
}
