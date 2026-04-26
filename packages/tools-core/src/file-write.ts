// FileWrite — write a file under ~/.agent-forge/ (the host's Forge home).
//
// Security boundary :
//   - Only paths inside FORGE_HOME are allowed (after symlink resolution).
//   - Path traversal (..), null bytes, and absolute paths outside the home
//     are refused.
//   - Existing files are NEVER overwritten silently. The caller (the LLM
//     via the tool) must explicitly delete and re-write to update.
//
// This is the first native tool exposed to the builder LLM. It implements
// the Vercel AI SDK tool shape so it can be plugged in directly.

import {
  existsSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { z } from 'zod'

export const FORGE_HOME = join(homedir(), '.agent-forge')

export const FileWriteInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe(
      'File path RELATIVE to the Agent Forge home directory (~/.agent-forge/). Example : "agents/haiku-writer/AGENT.md".',
    ),
  content: z.string().describe('Full file content to write.'),
  overwrite: z
    .boolean()
    .optional()
    .describe(
      'Allow overwriting an existing file. Defaults to false. Should only be set true after explicit user confirmation.',
    ),
})

export type FileWriteInput = z.infer<typeof FileWriteInputSchema>

export type FileWriteResult =
  | { ok: true; absolutePath: string }
  | { ok: false; error: string }

type SafePathResult =
  | { ok: true; absolutePath: string }
  | { ok: false; error: string }

export function resolveSafePath(rawPath: string): SafePathResult {
  if (rawPath.includes('\0')) {
    return { ok: false, error: 'path contains a null byte' }
  }
  if (rawPath.includes(' ')) {
    // Disallow spaces in paths : not a security issue per se but agents that
    // hallucinate paths with spaces usually mean nonsense, and quoting bugs
    // in shell pipelines downstream are easier to spot if we forbid them.
    return { ok: false, error: 'path must not contain spaces' }
  }
  const target = isAbsolute(rawPath) ? rawPath : join(FORGE_HOME, rawPath)
  const resolved = resolve(target)
  // Resolve FORGE_HOME via realpath in case of symlinks (e.g. on macOS where
  // /Users may be a symlink). If FORGE_HOME does not exist yet, fall back to
  // its canonical form.
  let canonicalHome: string
  try {
    canonicalHome = realpathSync(FORGE_HOME)
  } catch {
    canonicalHome = resolve(FORGE_HOME)
  }
  if (resolved !== canonicalHome && !resolved.startsWith(`${canonicalHome}/`)) {
    return {
      ok: false,
      error: `path escapes the Agent Forge home (${canonicalHome})`,
    }
  }
  return { ok: true, absolutePath: resolved }
}

export function executeFileWrite(input: FileWriteInput): FileWriteResult {
  const safe = resolveSafePath(input.path)
  if (!safe.ok) return safe

  if (existsSync(safe.absolutePath) && !input.overwrite) {
    return {
      ok: false,
      error: `file already exists : ${safe.absolutePath}. Refusing to overwrite.`,
    }
  }

  try {
    mkdirSync(dirname(safe.absolutePath), { recursive: true })
    writeFileSync(safe.absolutePath, input.content, 'utf8')
    return { ok: true, absolutePath: safe.absolutePath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// Vercel AI SDK tool spec. Builder wires this in P3.3.
export const FileWriteToolSpec = {
  description:
    'Writes a new file under the Agent Forge home directory (~/.agent-forge/). Refuses to overwrite existing files. Use this to create AGENT.md and similar artifacts. Always confirm with the user before calling this tool.',
  parameters: FileWriteInputSchema,
  execute: async (input: FileWriteInput): Promise<FileWriteResult> => {
    return executeFileWrite(input)
  },
}
