// Agent-side tool protocol — fenced blocks the agent emits to invoke a
// native tool, and the rendering of tool results back to the LLM.
//
// We deliberately mirror the builder's text-structured protocol (forge:write
// and forge:run) instead of using OpenAI tool_calls for two reasons :
//   1. Local LLMs (MLX, llama.cpp) often don't honor tool_calls.
//   2. A consistent protocol across builder and agents simplifies debugging
//      and lets users read the raw stream.
//
// Block grammar :
//
//   ```forge:bash
//   { "command": "ls -la" }
//   ```
//
//   ```forge:write
//   { "path": "src/index.ts", "content": "..." }
//   ```
//
// Only ONE block is parsed per turn (the first encountered). Everything
// before the block is treated as the agent's "thinking out loud" text and
// streamed to the host. Everything after the block is dropped — the agent
// will see the tool result on the next turn and continue from there.

import { z } from 'zod'
import {
  BashInputSchema,
  RuntimeFileWriteInputSchema,
  type BashInput,
  type BashResult,
  type RuntimeFileWriteInput,
  type RuntimeFileWriteResult,
} from '@agent-forge/tools-core'

export type ParsedTool =
  | { kind: 'bash'; input: BashInput; raw: string }
  | { kind: 'write'; input: RuntimeFileWriteInput; raw: string }

export type ParseOutcome =
  | { kind: 'none'; text: string }
  | { kind: 'invalid'; text: string; error: string; raw: string }
  | { kind: 'tool'; text: string; tool: ParsedTool }

const FENCE_RE = /```forge:(bash|write)\s*\n([\s\S]*?)```/

export function parseFirstToolBlock(stream: string): ParseOutcome {
  const m = FENCE_RE.exec(stream)
  if (!m) return { kind: 'none', text: stream }

  const tag = m[1] as 'bash' | 'write'
  const body = m[2] ?? ''
  const before = stream.slice(0, m.index)

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

  if (tag === 'bash') {
    const result = BashInputSchema.safeParse(parsed)
    if (!result.success) {
      return {
        kind: 'invalid',
        text: before,
        error: `forge:bash input failed validation : ${formatZodError(result.error)}`,
        raw: m[0],
      }
    }
    return {
      kind: 'tool',
      text: before,
      tool: { kind: 'bash', input: result.data, raw: m[0] },
    }
  }

  // tag === 'write'
  const result = RuntimeFileWriteInputSchema.safeParse(parsed)
  if (!result.success) {
    return {
      kind: 'invalid',
      text: before,
      error: `forge:write input failed validation : ${formatZodError(result.error)}`,
      raw: m[0],
    }
  }
  return {
    kind: 'tool',
    text: before,
    tool: { kind: 'write', input: result.data, raw: m[0] },
  }
}

function formatZodError(err: z.ZodError): string {
  return err.errors
    .map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`)
    .join(' ; ')
}

// Render a tool result as the message we feed back to the LLM on the next
// turn. We use the same fenced format so the agent can recognize it as
// "the result of MY previous call".
export function renderBashResult(
  input: BashInput,
  result: BashResult,
): string {
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

export function renderInvalid(error: string): string {
  return `[forge:tool error] ${error}\n\nFix the JSON or schema and try again.`
}
