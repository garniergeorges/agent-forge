// Grep (runtime) — regex search across files under /workspace.
//
// Pure JS, no ripgrep dependency : the alpine container doesn't ship rg
// by default and we don't want to bloat the image just for this. For a
// POC the trade-off is fine ; if it becomes a bottleneck we'll bind-mount
// rg later.
//
// The pattern is a JavaScript RegExp source. Files are filtered by an
// optional glob to keep the scan bounded. Binary-looking content
// (NUL bytes in the first 4 KB) is skipped.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { resolveSandboxedPath } from './file-write.ts'
import { executeRuntimeGlob } from './glob.ts'

export const RuntimeGrepInputSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .describe('JavaScript RegExp source. Example : "TODO|FIXME".'),
  glob: z
    .string()
    .optional()
    .describe(
      'Optional file pattern relative to /workspace (e.g. "src/**/*.ts"). Defaults to "**/*".',
    ),
  ignoreCase: z.boolean().optional().describe('Case-insensitive match. Default false.'),
})

export type RuntimeGrepInput = z.infer<typeof RuntimeGrepInputSchema>

export type GrepHit = { path: string; line: number; text: string }

export type RuntimeGrepResult =
  | { ok: true; hits: GrepHit[]; truncated: boolean; scanned: number }
  | { ok: false; error: string }

const MAX_HITS = 200
const MAX_LINE_LEN = 400 // clip long lines so a minified file doesn't blow context
const MAX_FILE_BYTES = 1_048_576 // skip files > 1 MB

function looksBinary(buf: Buffer): boolean {
  const limit = Math.min(buf.length, 4096)
  for (let i = 0; i < limit; i += 1) {
    if (buf[i] === 0) return true
  }
  return false
}

export function executeRuntimeGrep(
  input: RuntimeGrepInput,
): RuntimeGrepResult {
  let re: RegExp
  try {
    re = new RegExp(input.pattern, input.ignoreCase ? 'i' : undefined)
  } catch (err) {
    return { ok: false, error: `invalid regex : ${err instanceof Error ? err.message : String(err)}` }
  }

  const safeRoot = resolveSandboxedPath('.')
  if (!safeRoot.ok) return safeRoot

  const filesResult = executeRuntimeGlob({ pattern: input.glob ?? '**/*' })
  if (!filesResult.ok) return filesResult

  const hits: GrepHit[] = []
  let truncated = false
  let scanned = 0

  for (const rel of filesResult.matches) {
    if (hits.length >= MAX_HITS) {
      truncated = true
      break
    }
    const abs = join(safeRoot.absolutePath, rel)
    let buf: Buffer
    try {
      buf = readFileSync(abs)
    } catch {
      continue
    }
    if (buf.length > MAX_FILE_BYTES) continue
    if (looksBinary(buf)) continue
    scanned += 1
    const text = buf.toString('utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] as string
      if (re.test(line)) {
        hits.push({
          path: rel,
          line: i + 1,
          text: line.length > MAX_LINE_LEN ? `${line.slice(0, MAX_LINE_LEN)}…` : line,
        })
        if (hits.length >= MAX_HITS) {
          truncated = true
          break
        }
      }
    }
  }

  return { ok: true, hits, truncated, scanned }
}
