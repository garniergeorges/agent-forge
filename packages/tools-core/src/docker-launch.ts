// DockerLaunch — run an agent inside an isolated Docker container.
//
// Mounts the agent's AGENT.md (read-only) and the runtime bundle into the
// container, pipes the prompt to its stdin, streams stdout back as an
// async generator. The container is named so we can force-remove it on
// crash, signal, or timeout.
//
// P5 hardening : sandbox flags (--read-only, --cap-drop=ALL,
// --security-opt=no-new-privileges, --network=none, --memory, --cpus,
// --pids-limit, --user) are derived from the agent's AGENT.md sandbox
// section through applySandboxDefaults. Defaults are strict — agents
// must opt in to relax (network: bridge, readOnlyRoot: false, …) and
// the permission dialog flags any non-default choice.
//
// Multi-instance ready : each call uses a unique container name so several
// agents can run in parallel without collision.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { getLogger } from '@agent-forge/core/log'
import {
  type AppliedSandboxConfig,
  applySandboxDefaults,
  parseAgentMd,
} from '@agent-forge/core/types'
import { FORGE_HOME } from './file-write.ts'

const log = getLogger('dockerLaunch')

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

// Build the docker run flags that enforce the hardening profile
// declared in AGENT.md. These come BEFORE the image name in the
// args array, after the standard --name / -i / -v block.
//
// Exported (alongside resolveSandboxFromAgentMd) so tests can verify
// the translation without spawning an actual container.
export function hardeningFlags(cfg: AppliedSandboxConfig): string[] {
  const out: string[] = [
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    `--network=${cfg.network}`,
    `--user=${cfg.user}`,
    `--memory=${cfg.memory}`,
    `--cpus=${cfg.cpus.toString()}`,
    `--pids-limit=${cfg.pidsLimit.toString()}`,
  ]
  if (cfg.readOnlyRoot) {
    // Read-only root FS, with a tmpfs over /tmp so package
    // installers, test runners and shell utilities that scribble
    // there keep working without granting write to the image.
    // /workspace is bind-mounted RW just below, so it's not
    // affected by --read-only.
    out.push('--read-only', '--tmpfs=/tmp:rw,size=64m,mode=1777')
  }
  return out
}

export type LaunchHandle = {
  containerName: string
  events: AsyncGenerator<DockerLaunchEvent, void, void>
  abort: () => void
}

/**
 * Resolve the AGENT.md frontmatter to its applied sandbox config —
 * same routine used internally before launching, exposed here so the
 * permission dialog can show the user what hardening profile this
 * agent will run with (and warn on relaxations like network=bridge).
 *
 * Returns null if the AGENT.md cannot be parsed ; the caller should
 * surface a parse error in the UI instead.
 */
export function resolveSandboxFromAgentMd(
  agentMdContent: string,
): AppliedSandboxConfig | null {
  try {
    const parsed = parseAgentMd(agentMdContent)
    return applySandboxDefaults(parsed.meta.sandbox)
  } catch {
    return null
  }
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

    // Read the AGENT.md to know which image and which hardening
    // profile to apply. Parsing here means malformed AGENT.md
    // surfaces as a clean error before docker is even invoked.
    let sandboxCfg: AppliedSandboxConfig
    try {
      const raw = readFileSync(agentMdPath, 'utf8')
      const parsed = parseAgentMd(raw)
      sandboxCfg = applySandboxDefaults(parsed.meta.sandbox)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('agent.md parse failed', { agent: input.agent, error: msg })
      yield { type: 'error', error: `cannot read AGENT.md : ${msg}` }
      return
    }

    mkdirSync(workspaceHostDir, { recursive: true })
    log.info('launching', {
      agent: input.agent,
      containerName,
      workspaceHostDir,
      sandboxCfg,
    })

    const args = [
      'run',
      '--rm',
      '-i',
      '--name',
      containerName,
      // Volumes BEFORE hardening flags so --read-only doesn't reject
      // them.
      '-v',
      `${agentMdPath}:/agent/AGENT.md:ro`,
      '-v',
      `${RUNTIME_DIST_FROM_TOOLS}:/runtime:ro`,
      '-v',
      `${workspaceHostDir}:/workspace`,
      '-w',
      '/workspace',
      ...hardeningFlags(sandboxCfg),
      ...inheritEnv(),
      sandboxCfg.image,
      'node',
      '/runtime/runtime.mjs',
    ]

    log.debug('docker spawn args', { containerName, args })
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
      if (stderr.length > 0) {
        log.warn('docker stderr', { containerName, stderr })
        yield { type: 'stderr', text: stderr }
      }
      log.info('done', { containerName, exitCode })
      yield { type: 'done', exitCode }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('runtime error', { containerName, error: msg })
      yield { type: 'error', error: msg }
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
