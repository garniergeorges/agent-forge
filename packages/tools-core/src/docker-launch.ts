// DockerLaunch — run an agent inside an isolated Docker container.
//
// Mounts the agent's AGENT.md (read-only) and the runtime bundle into the
// container, pipes the prompt to its stdin, streams stdout back as an
// async generator. The container is named so we can force-remove it on
// crash, signal, or timeout.
//
// Multi-instance ready : each call uses a unique container name so several
// agents can run in parallel without collision.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { FORGE_HOME } from './file-write.ts'

export const DockerLaunchInputSchema = z.object({
  agent: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'agent name must be kebab-case'),
  prompt: z.string().min(1),
})

export type DockerLaunchInput = z.infer<typeof DockerLaunchInputSchema>

export type DockerLaunchEvent =
  | { type: 'chunk'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'done'; exitCode: number }
  | { type: 'error'; error: string }

const IMAGE = process.env.FORGE_AGENT_IMAGE ?? 'agent-forge/base:latest'
const TIMEOUT_MS = Number(process.env.FORGE_RUN_TIMEOUT_MS ?? '120000')

// Resolved at runtime (host filesystem) — same path the CLI uses to mount
// the runtime bundle into the container.
const RUNTIME_DIST_FROM_TOOLS = new URL(
  '../../runtime/dist',
  import.meta.url,
).pathname

function uniqueContainerName(agent: string): string {
  const id = Math.random().toString(36).slice(2, 8)
  return `agent-forge-run-${agent}-${id}`
}

function inheritEnv(): string[] {
  // Forward LLM credentials and overrides into the container so the runtime
  // can call the same provider as the builder.
  const passthrough = ['FORGE_BASE_URL', 'FORGE_API_KEY', 'FORGE_MODEL']
  const out: string[] = []
  for (const k of passthrough) {
    const v = process.env[k]
    if (v) out.push('-e', `${k}=${v}`)
  }
  return out
}

export type LaunchHandle = {
  containerName: string
  events: AsyncGenerator<DockerLaunchEvent, void, void>
  abort: () => void
}

/**
 * Launch a sub-agent and stream its output. The returned events generator
 * yields chunk events as they arrive, then a final `done` (or `error`).
 */
export function launchAgent(input: DockerLaunchInput): LaunchHandle {
  const agentMdPath = join(FORGE_HOME, 'agents', input.agent, 'AGENT.md')
  const containerName = uniqueContainerName(input.agent)

  const forceRemove = (): void => {
    spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' })
  }

  // Per-run workspace on the host, bind-mounted RW into the container so
  // tools (forge:bash, forge:write) have a sandbox they can scribble in.
  // Kept after the container exits — useful for debugging and for P5
  // artifact extraction.
  const workspaceHostDir = join(
    FORGE_HOME,
    'workspaces',
    containerName,
  )

  async function* run(): AsyncGenerator<DockerLaunchEvent, void, void> {
    if (!existsSync(agentMdPath)) {
      yield { type: 'error', error: `AGENT.md not found : ${agentMdPath}` }
      return
    }
    if (!existsSync(join(RUNTIME_DIST_FROM_TOOLS, 'runtime.mjs'))) {
      yield {
        type: 'error',
        error:
          `runtime bundle missing at ${RUNTIME_DIST_FROM_TOOLS}/runtime.mjs. ` +
          'Run : cd packages/runtime && bun run build',
      }
      return
    }

    mkdirSync(workspaceHostDir, { recursive: true })

    const args = [
      'run',
      '--rm',
      '-i',
      '--name',
      containerName,
      '-v',
      `${agentMdPath}:/agent/AGENT.md:ro`,
      '-v',
      `${RUNTIME_DIST_FROM_TOOLS}:/runtime:ro`,
      '-v',
      `${workspaceHostDir}:/workspace`,
      '-w',
      '/workspace',
      ...inheritEnv(),
      IMAGE,
      'node',
      '/runtime/runtime.mjs',
    ]

    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] })

    const timeout = setTimeout(() => {
      forceRemove()
      child.kill('SIGTERM')
    }, TIMEOUT_MS)

    // Async iterator over stdout chunks. We bridge the Node 'data'/'end'
    // callbacks into a queue so the generator can yield them.
    type StdoutEvent = { kind: 'data'; text: string } | { kind: 'end' }
    const queue: StdoutEvent[] = []
    let resolver: ((e: StdoutEvent) => void) | null = null

    const push = (e: StdoutEvent): void => {
      if (resolver) {
        const r = resolver
        resolver = null
        r(e)
      } else {
        queue.push(e)
      }
    }
    const next = (): Promise<StdoutEvent> =>
      queue.length > 0
        ? Promise.resolve(queue.shift() as StdoutEvent)
        : new Promise((r) => {
            resolver = r
          })

    child.stdout.on('data', (b: Buffer) =>
      push({ kind: 'data', text: b.toString('utf8') }),
    )
    child.stdout.on('end', () => push({ kind: 'end' }))

    const stderrChunks: string[] = []
    child.stderr.on('data', (b: Buffer) => stderrChunks.push(b.toString('utf8')))

    const exitPromise: Promise<number> = new Promise((res) => {
      child.on('close', (code) => {
        clearTimeout(timeout)
        res(code ?? 1)
      })
    })

    // Pipe the user prompt and close stdin so the runtime can finish reading.
    child.stdin.write(input.prompt)
    child.stdin.end()

    try {
      while (true) {
        const evt = await next()
        if (evt.kind === 'end') break
        yield { type: 'chunk', text: evt.text }
      }
      const exitCode = await exitPromise
      const stderr = stderrChunks.join('').trim()
      if (stderr.length > 0) yield { type: 'stderr', text: stderr }
      yield { type: 'done', exitCode }
    } catch (err) {
      yield {
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      clearTimeout(timeout)
      forceRemove()
    }
  }

  const events = run()
  return {
    containerName,
    events,
    abort: () => {
      forceRemove()
    },
  }
}
