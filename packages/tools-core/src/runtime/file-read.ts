// FileRead (runtime) — read a file under /workspace.
//
// Offset/limit are line-based (matches what an LLM expects when reading
// source files). Output is clipped at 16 KB to protect the LLM context ;
// any further reading should use offset.

import { readFileSync, statSync } from 'node:fs'
import { z } from 'zod'
import { resolveSandboxedPath } from './file-write.ts'

export const RuntimeFileReadInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe(
      'Path inside the agent sandbox (/workspace). Relative or absolute under /workspace.',
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Line offset (1-based first line of the slice). Default 0.'),
  limit: z
    .number()
    .int()
    .positive()
    .max(2000)
    .optional()
    .describe('Max number of lines to return. Default 200, max 2000.'),
})

export type RuntimeFileReadInput = z.infer<typeof RuntimeFileReadInputSchema>

export type RuntimeFileReadResult =
  | {
      ok: true
      absolutePath: string
      content: string
      totalLines: number
      returnedLines: number
      truncatedBytes: boolean
    }
  | { ok: false; error: string }

const DEFAULT_LIMIT = 200
const MAX_BYTES = 16_384

export function executeRuntimeFileRead(
  input: RuntimeFileReadInput,
): RuntimeFileReadResult {
  const safe = resolveSandboxedPath(input.path)
  if (!safe.ok) return safe

  let raw: string
  try {
    const st = statSync(safe.absolutePath)
    if (!st.isFile()) {
      return { ok: false, error: `not a regular file : ${safe.absolutePath}` }
    }
    raw = readFileSync(safe.absolutePath, 'utf8')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const allLines = raw.split('\n')
  // Drop the trailing empty element when the file ends with \n so totalLines
  // reflects the human count, not split() artifact.
  if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
    allLines.pop()
  }
  const totalLines = allLines.length

  const offset = input.offset ?? 0
  const limit = input.limit ?? DEFAULT_LIMIT
  const slice = allLines.slice(offset, offset + limit)
  let content = slice.join('\n')

  let truncatedBytes = false
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) {
    truncatedBytes = true
    content = `${content.slice(0, MAX_BYTES)}\n…[output truncated at ${MAX_BYTES.toString()} bytes — use offset/limit for the rest]`
  }

  return {
    ok: true,
    absolutePath: safe.absolutePath,
    content,
    totalLines,
    returnedLines: slice.length,
    truncatedBytes,
  }
}
