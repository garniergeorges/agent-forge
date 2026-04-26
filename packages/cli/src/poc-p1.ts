// @agent-forge/cli — P1 proof of concept
//
// Smallest end-to-end demo of the architecture :
//   host orchestrator → docker run base image → mount runtime via volume →
//   pipe prompt to stdin → capture stdout → container removed (--rm).
//
// Requires :
//   - Docker daemon running
//   - Image agent-forge/base:latest built (see scripts/docker/build-base.sh)
//   - packages/runtime/dist/runtime.mjs built (cd packages/runtime && bun run build)
//   - An OpenAI-compatible LLM endpoint reachable from the container
//     (defaults to MLX at host.docker.internal:8080, see P1.2)
//
// Implementation note : we shell out to the docker CLI rather than using the
// Docker Engine API (e.g. dockerode) because dockerode's `attach` upgrade
// hangs under Bun. The CLI is plenty for P1 — we will switch to the API later
// when we need finer-grained control (resource limits, healthchecks, …).

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const PROMPT = 'Write a haiku about Docker'
const IMAGE = 'agent-forge/base:latest'
const RUNTIME_DIST = new URL('../../runtime/dist', import.meta.url).pathname
const RUNTIME_BUNDLE = join(RUNTIME_DIST, 'runtime.mjs')
const CONTAINER_NAME = `agent-forge-poc-${process.pid}`
const TIMEOUT_MS = Number(process.env.FORGE_POC_TIMEOUT_MS ?? '60000')
const RUNTIME_BASE_URL = process.env.FORGE_BASE_URL ?? 'http://host.docker.internal:8080/v1'

function fail(message: string): never {
  process.stderr.write(`✗ ${message}\n`)
  process.exit(1)
}

function preflight(): void {
  // 1. Docker daemon reachable
  const docker = spawnSync('docker', ['info'], { stdio: 'ignore' })
  if (docker.error || docker.status !== 0) {
    fail(
      'Docker daemon is not reachable.\n' +
        '  Start Docker Desktop (or `colima start`) and try again.',
    )
  }

  // 2. Base image present locally (we cannot `docker pull` because the image
  //    is not published to a registry yet — it is built locally).
  const image = spawnSync('docker', ['image', 'inspect', IMAGE], { stdio: 'ignore' })
  if (image.status !== 0) {
    fail(
      `Image ${IMAGE} is not built locally.\n` +
        '  Run: bash scripts/docker/build-base.sh',
    )
  }

  // 3. Runtime bundle built
  if (!existsSync(RUNTIME_BUNDLE)) {
    fail(
      `Runtime bundle missing: ${RUNTIME_BUNDLE}\n` +
        '  Run: cd packages/runtime && bun run build',
    )
  }
}

function forceRemoveContainer(): void {
  // Best-effort sync cleanup. Used in signal handlers and on timeout.
  spawnSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'ignore' })
}

async function main(): Promise<void> {
  preflight()

  const args = [
    'run',
    '--rm',
    '-i',
    '--name',
    CONTAINER_NAME,
    '-v',
    `${RUNTIME_DIST}:/runtime:ro`,
    '-e',
    `FORGE_BASE_URL=${RUNTIME_BASE_URL}`,
    IMAGE,
    'node',
    '/runtime/runtime.mjs',
  ]

  const child = spawn('docker', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  // Cleanup on Ctrl+C / SIGTERM. Also kill the child docker client.
  const onSignal = (signal: NodeJS.Signals) => {
    forceRemoveContainer()
    child.kill('SIGTERM')
    process.stderr.write(`\n✗ interrupted by ${signal}\n`)
    process.exit(130) // 128 + SIGINT (2)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  // Hard timeout : kill the container if the runtime takes too long.
  const timeout = setTimeout(() => {
    forceRemoveContainer()
    child.kill('SIGTERM')
    process.stderr.write(`✗ runtime timeout after ${TIMEOUT_MS / 1000}s\n`)
    process.exit(1)
  }, TIMEOUT_MS)

  try {
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => stdoutChunks.push(c))
    child.stderr.on('data', (c: Buffer) => stderrChunks.push(c))

    child.stdin.write(PROMPT)
    child.stdin.end()

    const exitCode: number = await new Promise((res, rej) => {
      child.on('error', rej)
      child.on('close', (code) => res(code ?? 1))
    })

    const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim()
    const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()

    if (stderr) {
      process.stderr.write(`${stderr}\n`)
    }
    if (stdout) {
      process.stdout.write(`${stdout}\n`)
    }
    if (exitCode !== 0) {
      process.exit(exitCode)
    }
  } finally {
    clearTimeout(timeout)
    forceRemoveContainer()
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`✗ poc-p1 error: ${msg}`)
  process.exit(1)
})
