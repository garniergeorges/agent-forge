// Sandbox networking profile picker.
//
// The strict profile (network=none + per-run LLM proxy on a Unix
// socket bind-mounted into the container) is what we want for
// security : the container cannot make outbound calls beyond the
// allowlisted /v1/chat/completions, the API key never enters the
// container, etc.
//
// But Docker Desktop on macOS bind-mounts host directories through
// a virtual filesystem (gRPC-FUSE / VirtioFS) that does NOT support
// Unix domain socket files as a recognised type. A connect() from
// inside the container fails with ENOTSUP.
//
// The pragmatic compromise : detect that limitation once at startup
// and fall back to network=bridge for that host. The runtime then
// talks to the upstream directly. Less ideal — we leak the API key
// into the container env — but it's the only thing that works under
// Docker Desktop until they fix the FUSE layer.
//
// On a real Linux host (or Linux running inside a real VM), the
// detector returns 'proxy' and we keep the strict profile.
//
// Env override : FORGE_SANDBOX_NETWORK=proxy|bridge to force one or
// the other regardless of the probe (useful for tests, CI, or to
// reproduce the prod profile on a Mac dev machine).

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getLogger } from '@agent-forge/core/log'
import { startLlmProxy } from './llm-proxy.ts'

const log = getLogger('sandboxNetwork')

export type SandboxNetworkProfile = 'proxy' | 'bridge'

let cachedProfile: SandboxNetworkProfile | null = null

function envOverride(): SandboxNetworkProfile | null {
  const v = (process.env.FORGE_SANDBOX_NETWORK ?? '').toLowerCase()
  if (v === 'proxy' || v === 'bridge') return v
  return null
}

/**
 * Probe whether this host can expose a Unix domain socket to a
 * container through a bind-mount. Spawns a tiny container, points
 * it at a socket served by a one-shot Node http server on the host,
 * and checks whether `node http.request({ socketPath })` connects.
 *
 * The result is memoised : the probe runs at most once per process.
 *
 * On any error (docker missing, image missing, probe timeout) we
 * conservatively assume the strict profile is unsafe and pick
 * 'bridge'. The user gets the working flow ; the log explains why.
 */
export async function detectSandboxNetworkProfile(): Promise<SandboxNetworkProfile> {
  if (cachedProfile !== null) return cachedProfile
  const forced = envOverride()
  if (forced !== null) {
    cachedProfile = forced
    log.info('profile forced by env', { profile: forced })
    return forced
  }

  const tmp = mkdtempSync(join(tmpdir(), 'forge-uds-probe-'))
  const socketPath = join(tmp, 'probe.sock')
  let proxy: Awaited<ReturnType<typeof startLlmProxy>> | null = null

  try {
    // Spin up an LLM proxy on the socket — it doesn't matter that
    // there's no real upstream behind, we only check whether the
    // container can reach the socket file.
    proxy = await startLlmProxy({
      socketPath,
      upstreamBaseUrl: 'http://127.0.0.1:1/v1', // unreachable, fine for probe
      apiKey: 'probe',
    })

    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--user=agent',
        '--network=none',
        '-v',
        `${tmp}:/run/forge`,
        'agent-forge/base:latest',
        'node',
        '-e',
        // Connect to the socket, send a POST to a route the proxy
        // refuses anyway (we only care about connect/EBADF/ENOTSUP).
        // Print 'OK' on connect or the error code otherwise.
        `const http=require("node:http");const req=http.request({socketPath:"/run/forge/probe.sock",path:"/v1/chat/completions",method:"POST",headers:{"content-type":"application/json"}},r=>{console.log("OK",r.statusCode)});req.on("error",e=>console.log("ERR",e.code||e.message));req.end("{}")`,
      ],
      { encoding: 'utf8', timeout: 8000 },
    )
    const stdout = (result.stdout ?? '').trim()
    const stderr = (result.stderr ?? '').trim()
    log.debug('probe result', {
      exit: result.status,
      stdout,
      stderr: stderr.slice(0, 500),
    })

    // Anything starting with OK = the connect succeeded ; the
    // socket is reachable from inside the container.
    if (stdout.startsWith('OK')) {
      cachedProfile = 'proxy'
      log.info('profile picked', {
        profile: 'proxy',
        reason: 'socket bind-mount supported',
      })
    } else {
      cachedProfile = 'bridge'
      log.warn('profile picked', {
        profile: 'bridge',
        reason: 'socket bind-mount unsupported (likely Docker Desktop on macOS)',
        probeStdout: stdout,
        probeStderr: stderr.slice(0, 200),
      })
    }
  } catch (err) {
    cachedProfile = 'bridge'
    log.warn('profile picked', {
      profile: 'bridge',
      reason: 'probe crashed',
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    if (proxy) {
      try {
        proxy.stop()
      } catch {
        // ignore
      }
    }
    try {
      rmSync(tmp, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }

  return cachedProfile
}

/** Test-only : reset the memoised result. */
export function _resetProfileCacheForTests(): void {
  cachedProfile = null
}
