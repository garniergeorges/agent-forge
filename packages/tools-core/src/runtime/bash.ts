// Bash — execute a shell command inside an agent's container.
//
// Runs INSIDE the container (called from @agent-forge/runtime). Wraps the
// command with `bash -lc` so simple shell features (pipes, &&, $VAR) just
// work. The cwd is locked to /workspace : the agent never sees anything
// outside its sandbox. A timeout (default 30s) prevents runaway commands
// from blocking the tool loop.
//
// Returns a structured result (stdout, stderr, exitCode, timedOut). The
// caller is responsible for formatting it back into a message the LLM will
// read on the next turn.

import { spawn } from 'node:child_process'
import { z } from 'zod'

export const WORKSPACE_DIR = '/workspace'

// Tests on the host don't have /workspace. The runtime always uses
// WORKSPACE_DIR when running inside the container ; tests can point this
// at a temp dir via FORGE_WORKSPACE.
function bashCwd(): string {
  return process.env.FORGE_WORKSPACE ?? WORKSPACE_DIR
}

export const BashInputSchema = z.object({
  command: z
    .string()
    .min(1)
    .describe(
      'Shell command to execute inside the agent sandbox. Run via `bash -lc`. The current directory is /workspace.',
    ),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(120_000)
    .optional()
    .describe('Hard timeout in milliseconds. Defaults to 30000. Capped at 120000.'),
})

export type BashInput = z.infer<typeof BashInputSchema>

export type BashResult = {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

const DEFAULT_TIMEOUT_MS = 30_000
// Cap captured streams so a runaway command can't blow the LLM context.
const MAX_OUTPUT_BYTES = 16_384

function clip(text: string): string {
  if (Buffer.byteLength(text, 'utf8') <= MAX_OUTPUT_BYTES) return text
  const head = text.slice(0, MAX_OUTPUT_BYTES)
  return `${head}\n…[output truncated at ${MAX_OUTPUT_BYTES.toString()} bytes]`
}

export async function executeBash(input: BashInput): Promise<BashResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  return await new Promise<BashResult>((resolve) => {
    const child = spawn('bash', ['-lc', input.command], {
      cwd: bashCwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', (b: Buffer) => {
      stdout += b.toString('utf8')
    })
    child.stderr.on('data', (b: Buffer) => {
      stderr += b.toString('utf8')
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        stdout: clip(stdout),
        stderr: clip(`${stderr}${err.message}`),
        exitCode: -1,
        timedOut,
      })
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        stdout: clip(stdout),
        stderr: clip(stderr),
        exitCode: code ?? -1,
        timedOut,
      })
    })
  })
}
