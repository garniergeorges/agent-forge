// FileWrite (runtime) — write a file under /workspace from inside the
// agent's container.
//
// Distinct from packages/tools-core/src/file-write.ts which writes under
// the host's ~/.agent-forge/. The runtime version is sandboxed to
// /workspace : the agent has no way to escape its container's mount.
//
// Path traversal (..), null bytes, and absolute paths outside /workspace
// are refused. Existing files are overwritten by default — unlike the
// host tool which is strict — because in-sandbox iteration is expected
// (agents often rewrite their own files mid-loop).
//
// The sandbox root defaults to /workspace (the in-container mount) but
// can be overridden via FORGE_WORKSPACE — useful for tests that want to
// run on the host without touching /workspace.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { z } from 'zod'
import { WORKSPACE_DIR } from './bash.ts'

function sandboxRoot(): string {
  return process.env.FORGE_WORKSPACE ?? WORKSPACE_DIR
}

export const RuntimeFileWriteInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe(
      'Path inside the agent sandbox (/workspace). Either relative ("notes.md") or absolute under /workspace ("/workspace/src/index.ts"). Paths outside /workspace are rejected.',
    ),
  content: z.string().describe('Full file content to write.'),
})

export type RuntimeFileWriteInput = z.infer<typeof RuntimeFileWriteInputSchema>

export type RuntimeFileWriteResult =
  | { ok: true; absolutePath: string; bytes: number }
  | { ok: false; error: string }

export function resolveSandboxedPath(rawPath: string):
  | { ok: true; absolutePath: string }
  | { ok: false; error: string } {
  if (rawPath.includes('\0')) {
    return { ok: false, error: 'path contains a null byte' }
  }
  const root = sandboxRoot()
  const target = isAbsolute(rawPath) ? rawPath : join(root, rawPath)
  const resolved = resolve(target)
  if (resolved !== root && !resolved.startsWith(`${root}/`)) {
    return {
      ok: false,
      error: `path escapes the agent sandbox (${root})`,
    }
  }
  return { ok: true, absolutePath: resolved }
}

export function executeRuntimeFileWrite(
  input: RuntimeFileWriteInput,
): RuntimeFileWriteResult {
  const safe = resolveSandboxedPath(input.path)
  if (!safe.ok) return safe
  try {
    mkdirSync(dirname(safe.absolutePath), { recursive: true })
    writeFileSync(safe.absolutePath, input.content, 'utf8')
    return {
      ok: true,
      absolutePath: safe.absolutePath,
      bytes: Buffer.byteLength(input.content, 'utf8'),
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
