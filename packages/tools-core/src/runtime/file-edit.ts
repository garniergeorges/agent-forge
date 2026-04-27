// FileEdit (runtime) — patch a file under /workspace by replacing one
// exact substring with another. Same shape as Claude Code's Edit tool.
//
// The match must be unique unless `replaceAll: true`. This forces the
// LLM to widen its `oldString` window when it's ambiguous, instead of
// guessing which occurrence it meant.

import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { resolveSandboxedPath } from './file-write.ts'

export const RuntimeFileEditInputSchema = z
  .object({
    path: z.string().min(1).describe('File path under /workspace.'),
    oldString: z
      .string()
      .min(1)
      .describe(
        'Exact substring to find. Must match exactly once unless replaceAll is true.',
      ),
    newString: z.string().describe('Replacement substring.'),
    replaceAll: z
      .boolean()
      .optional()
      .describe('Replace every occurrence. Default false.'),
  })
  .refine((v) => v.oldString !== v.newString, {
    message: 'oldString and newString must differ',
    path: ['newString'],
  })

export type RuntimeFileEditInput = z.infer<typeof RuntimeFileEditInputSchema>

export type RuntimeFileEditResult =
  | { ok: true; absolutePath: string; replacements: number }
  | { ok: false; error: string }

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0
  let count = 0
  let i = 0
  while (true) {
    const at = haystack.indexOf(needle, i)
    if (at === -1) return count
    count += 1
    i = at + needle.length
  }
}

export function executeRuntimeFileEdit(
  input: RuntimeFileEditInput,
): RuntimeFileEditResult {
  const safe = resolveSandboxedPath(input.path)
  if (!safe.ok) return safe

  let original: string
  try {
    original = readFileSync(safe.absolutePath, 'utf8')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const occurrences = countOccurrences(original, input.oldString)
  if (occurrences === 0) {
    return { ok: false, error: 'oldString not found in file' }
  }
  if (occurrences > 1 && !input.replaceAll) {
    return {
      ok: false,
      error: `oldString matches ${occurrences.toString()} times — widen the context or set replaceAll=true`,
    }
  }

  const updated = input.replaceAll
    ? original.split(input.oldString).join(input.newString)
    : original.replace(input.oldString, input.newString)

  try {
    writeFileSync(safe.absolutePath, updated, 'utf8')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  return {
    ok: true,
    absolutePath: safe.absolutePath,
    replacements: input.replaceAll ? occurrences : 1,
  }
}
