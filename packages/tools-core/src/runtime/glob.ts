// Glob (runtime) — find files matching a glob pattern under /workspace.
//
// Hand-rolled to avoid adding a dependency to the in-container bundle.
// Supports the patterns LLMs actually use : `*`, `**`, `?`. No braces,
// no character classes — those rarely appear in agent-emitted patterns
// and would just bloat the parser.
//
// Returns relative paths (from the sandbox root) sorted alphabetically.
// Capped at 200 results.

import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { z } from 'zod'
import { resolveSandboxedPath } from './file-write.ts'

export const RuntimeGlobInputSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .describe(
      'Glob pattern relative to /workspace. Supports *, **, and ?. Example : "src/**/*.ts".',
    ),
})

export type RuntimeGlobInput = z.infer<typeof RuntimeGlobInputSchema>

export type RuntimeGlobResult =
  | { ok: true; matches: string[]; truncated: boolean }
  | { ok: false; error: string }

const MAX_MATCHES = 200
const MAX_WALK_NODES = 5000

// Convert a glob to a RegExp anchored at the start, allowing partial
// path-segment matches. Each segment is converted independently and
// joined with `/`.
function globToRegex(pattern: string): RegExp {
  // Normalize : split on / and process per segment.
  const parts = pattern.split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '**') {
      out.push('(?:.*?)')
      continue
    }
    let segment = ''
    for (const ch of part) {
      if (ch === '*') segment += '[^/]*'
      else if (ch === '?') segment += '[^/]'
      else if (/[.+^${}()|[\]\\]/.test(ch)) segment += `\\${ch}`
      else segment += ch
    }
    out.push(segment)
  }
  // Glue : `/` between regular segments, but `**` already swallows separators.
  let glued = ''
  for (let i = 0; i < out.length; i += 1) {
    const part = out[i] as string
    if (i === 0) {
      glued = part
      continue
    }
    const prev = out[i - 1]
    if (prev === '(?:.*?)' || part === '(?:.*?)') glued += part
    else glued += `/${part}`
  }
  return new RegExp(`^${glued}$`)
}

// Walk a directory tree and return relative POSIX paths of all FILES.
// Bounded by MAX_WALK_NODES to protect against pathological trees.
function walk(root: string): string[] {
  const out: string[] = []
  const stack: string[] = [root]
  let visited = 0
  while (stack.length > 0 && visited < MAX_WALK_NODES) {
    const dir = stack.pop() as string
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      visited += 1
      if (visited >= MAX_WALK_NODES) break
      const full = join(dir, name)
      let st: ReturnType<typeof statSync>
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        stack.push(full)
      } else if (st.isFile()) {
        const rel = relative(root, full).split(sep).join('/')
        out.push(rel)
      }
    }
  }
  return out
}

export function executeRuntimeGlob(
  input: RuntimeGlobInput,
): RuntimeGlobResult {
  // Resolve sandbox root via a dummy path : ensures we use the same
  // FORGE_WORKSPACE override as the other runtime tools.
  const safeRoot = resolveSandboxedPath('.')
  if (!safeRoot.ok) return safeRoot
  const root = resolve(safeRoot.absolutePath)

  const re = globToRegex(input.pattern)
  const all = walk(root)
  const matched = all.filter((p) => re.test(p)).sort()
  const truncated = matched.length > MAX_MATCHES
  return {
    ok: true,
    matches: truncated ? matched.slice(0, MAX_MATCHES) : matched,
    truncated,
  }
}
