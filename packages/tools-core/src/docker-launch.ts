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
// LLM proxy : because --network=none cuts the container off from the
// internet, an LLM proxy server is started on the HOST before docker
// run, listening on a Unix socket bind-mounted into the container at
// /run/forge/llm.sock. The runtime points its OpenAI client at that
// socket. The proxy forwards only /v1/chat/completions to the real
// FORGE_BASE_URL with FORGE_API_KEY injected. Container env carries
// neither the real URL nor the key.
//
// Multi-instance ready : each call uses a unique container name + a
// unique socket path, so several agents can run in parallel without
// collision.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { getLogger } from '@agent-forge/core/log'
import {
  type AppliedSandboxConfig,
  applySandboxDefaults,
  parseAgentMd,
} from '@agent-forge/core/types'
import { FORGE_HOME } from './file-write.ts'
import { type LlmProxyHandle, startLlmProxy } from './llm-proxy.ts'

const log = getLogger('dockerLaunch')

// Where the proxy socket appears INSIDE the container. The runtime's
// OpenAI client reads FORGE_BASE_URL and connects to this socket via
// a custom http agent.
const CONTAINER_SOCKET_PATH = '/run/forge/llm.sock'
const CONTAINER_BASE_URL = `unix://${CONTAINER_SOCKET_PATH}/v1`

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

function containerEnv(): string[] {
  // The container does NOT receive the real LLM endpoint nor the API
  // key. Instead it gets the in-container Unix socket URL ; the host
  // proxy injects credentials and forwards to the real upstream.
  const out: string[] = ['-e', `FORGE_BASE_URL=${CONTAINER_BASE_URL}`]
  // Model name is fine to share — it's not a secret and the runtime
  // needs it to ask for the right model.
  const model = process.env.FORGE_MODEL
  if (model) out.push('-e', `FORGE_MODEL=${model}`)
  // The OpenAI SDK requires a non-empty API key field even when the
  // upstream doesn't authenticate. Use a sentinel that's obviously
  // not a credential.
  out.push('-e', 'FORGE_API_KEY=via-proxy')
  return out
}

// Names of env vars whose values must be redacted before any log line.
// API keys leak in `docker spawn args` (we pass them via -e KEY=value)
// otherwise. The redaction only affects logs — the container still
// receives the real value.
const SECRET_ENV_KEYS = new Set([
  'FORGE_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'MISTRAL_API_KEY',
])

function redactSecretsInArgs(args: string[]): string[] {
  return args.map((a) => {
    // Only `-e KEY=value` pairs land as a single arg here. Match
    // against our explicit allowlist so we never accidentally redact
    // something benign.
    const eq = a.indexOf('=')
    if (eq < 0) return a
    const key = a.slice(0, eq)
    if (SECRET_ENV_KEYS.has(key)) return `${key}=***redacted***`
    return a
  })
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

    // Start the per-run LLM proxy on a Unix socket. The socket lives
    // on the host under ~/.agent-forge/run/<container>/llm.sock and
    // is bind-mounted at /run/forge/llm.sock inside the container.
    const socketHostDir = join(FORGE_HOME, 'run', containerName)
    const socketHostPath = join(socketHostDir, 'llm.sock')
    const upstreamBase = process.env.FORGE_BASE_URL ?? 'https://api.mistral.ai/v1'
    const upstreamKey = process.env.FORGE_API_KEY ?? ''
    let proxy: LlmProxyHandle | null = null
    try {
      proxy = await startLlmProxy({
        socketPath: socketHostPath,
        upstreamBaseUrl: upstreamBase,
        apiKey: upstreamKey,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('proxy start failed', { error: msg })
      yield { type: 'error', error: `cannot start LLM proxy : ${msg}` }
      return
    }

    log.info('launching', {
      agent: input.agent,
      containerName,
      workspaceHostDir,
      socketHostPath,
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
      // The LLM proxy socket : the host file is bind-mounted at the
      // container path the runtime expects. The directory is mounted
      // (not the file) so the socket inode resolves correctly.
      '-v',
      `${socketHostDir}:${dirname(CONTAINER_SOCKET_PATH)}`,
      '-w',
      '/workspace',
      ...hardeningFlags(sandboxCfg),
      ...containerEnv(),
      sandboxCfg.image,
      'node',
      '/runtime/runtime.mjs',
    ]

    log.debug('docker spawn args', {
      containerName,
      args: redactSecretsInArgs(args),
    })
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

    let streamedTotal = 0
    let streamedAcc = ''
    try {
      while (true) {
        const evt = await next()
        if (evt.kind === 'end') break
        streamedTotal += evt.text.length
        streamedAcc += evt.text
        yield { type: 'chunk', text: evt.text }
      }
      const exitCode = await exitPromise
      const stderr = stderrChunks.join('').trim()
      if (stderr.length > 0) {
        log.warn('docker stderr', { containerName, stderr })
        yield { type: 'stderr', text: stderr }
      }
      log.info('done', { containerName, exitCode, streamedBytes: streamedTotal })
      log.trace('full agent output', { containerName, output: streamedAcc })
      yield { type: 'done', exitCode }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('runtime error', { containerName, error: msg })
      yield { type: 'error', error: msg }
    } finally {
      clearTimeout(timeout)
      forceRemove()
      if (proxy) {
        try {
          proxy.stop()
        } catch (err) {
          log.warn('proxy stop failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
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
