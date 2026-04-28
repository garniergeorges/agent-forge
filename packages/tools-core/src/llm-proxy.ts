// LLM proxy — minimal HTTP server on a Unix domain socket that
// forwards a SINGLE OpenAI-compatible route to the real provider,
// with the host's API key injected at the boundary.
//
// Why : agent containers run with --network=none. They can't reach
// api.mistral.ai (or any other LLM endpoint) directly. The proxy
// gives them a controlled hole : a Unix socket bind-mounted into
// the container, exposing only the chat-completions route. The
// API key never enters the container — it's added to the outgoing
// request server-side.
//
// Lifecycle :
//   - one proxy per run, started by DockerLaunch BEFORE `docker run`,
//     stopped in the same try/finally that removes the container
//   - the socket file lives under ~/.agent-forge/run/<container>/
//     and is bind-mounted at /run/forge/llm.sock inside the container

import {
  type IncomingMessage,
  type ServerResponse,
  createServer,
  request as httpRequest,
} from 'node:http'
import { request as httpsRequest } from 'node:https'
import { dirname } from 'node:path'
import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { URL } from 'node:url'
import { getLogger } from '@agent-forge/core/log'

const log = getLogger('llmProxy')

// Routes the proxy is willing to forward. Anything else gets a 403
// — an agent must not be able to list models, hit billing, or
// interact with anything beyond what it's supposed to talk to.
const ALLOWED_PATHS = new Set(['/v1/chat/completions'])

export type LlmProxyHandle = {
  socketPath: string
  stop: () => void
}

export type LlmProxyOptions = {
  socketPath: string
  // Real upstream — typically https://api.mistral.ai/v1, taken from
  // the host's FORGE_BASE_URL.
  upstreamBaseUrl: string
  // The host's API key — injected into the forwarded request.
  // Never leaves this process.
  apiKey: string
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s
}

/**
 * Start an LLM proxy on a Unix socket. Caller is responsible for
 * calling stop() when the run ends ; we also unlink the socket file
 * on stop, so a leftover from a previous crash doesn't block the
 * next start (we unlink on start too).
 *
 * Returns once the server is actually listening, so DockerLaunch can
 * safely bind-mount the socket immediately after.
 */
export async function startLlmProxy(
  options: LlmProxyOptions,
): Promise<LlmProxyHandle> {
  // Ensure the parent dir exists and there's no stale socket file.
  mkdirSync(dirname(options.socketPath), { recursive: true })
  if (existsSync(options.socketPath)) {
    try {
      unlinkSync(options.socketPath)
    } catch {
      // best effort
    }
  }

  const upstreamBase = stripTrailingSlash(options.upstreamBaseUrl)
  const upstream = new URL(upstreamBase)

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    handleRequest(req, res, upstream, options.apiKey).catch((err) => {
      log.error('proxy handler crash', { error: errString(err) })
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'text/plain' })
      }
      try {
        res.end('proxy error')
      } catch {
        // ignore
      }
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.socketPath, () => resolve())
  })

  log.info('proxy listening', {
    socketPath: options.socketPath,
    upstreamBase,
  })

  return {
    socketPath: options.socketPath,
    stop: () => {
      server.close(() => {
        if (existsSync(options.socketPath)) {
          try {
            unlinkSync(options.socketPath)
          } catch {
            // ignore
          }
        }
        log.info('proxy stopped', { socketPath: options.socketPath })
      })
    },
  }
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  upstream: URL,
  apiKey: string,
): Promise<void> {
  const path = (req.url ?? '/').split('?')[0] ?? '/'
  // Allow a base path under which the upstream lives (e.g. /v1) by
  // checking the suffix of the incoming path against the allowlist.
  // The container client uses the SAME paths as a regular OpenAI
  // endpoint — `/v1/chat/completions` — and we forward it to the
  // upstream's host preserving the same path.
  if (!ALLOWED_PATHS.has(path)) {
    log.warn('proxy reject', { method: req.method, path })
    res.writeHead(403, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { type: 'forbidden', path } }))
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { type: 'method_not_allowed' } }))
    return
  }

  // Build the upstream URL : keep the upstream's host/port, replace
  // the path with the incoming path. The upstream base is something
  // like https://api.mistral.ai/v1 — we want POST https://api.mistral.ai/v1/chat/completions.
  const upstreamPath = `${stripTrailingSlash(upstream.pathname)}${stripPrefix(
    path,
    stripTrailingSlash(upstream.pathname),
  )}`
  const targetUrl = new URL(upstreamPath, `${upstream.protocol}//${upstream.host}`)

  log.debug('proxy forward', {
    incomingPath: path,
    upstreamUrl: targetUrl.toString(),
  })

  // Sanitise headers : drop anything that could leak the agent's
  // identity to the upstream beyond what we control. We keep
  // content-type, accept, accept-encoding ; we set authorization
  // ourselves. We forward `accept: text/event-stream` so streaming
  // works.
  const outHeaders: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
  }
  for (const [k, v] of Object.entries(req.headers)) {
    const key = k.toLowerCase()
    if (key === 'content-type' || key === 'accept' || key === 'accept-encoding') {
      if (typeof v === 'string') outHeaders[key] = v
    }
  }

  // Pick http vs https client based on the upstream protocol so we
  // support both Mistral cloud (https) and a local MLX server (http).
  const requestFn = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest
  const upstreamReq = requestFn(
    {
      method: 'POST',
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      headers: outHeaders,
    },
    (upstreamRes) => {
      // Pipe the upstream response back. Forward status + a
      // sanitised set of headers (content-type, transfer-encoding
      // for streaming, cache-control). We do NOT pass through
      // server / set-cookie / x-* — they have no use inside the
      // sandboxed runtime.
      const passthrough: Record<string, string> = {}
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        const key = k.toLowerCase()
        if (
          key === 'content-type' ||
          key === 'transfer-encoding' ||
          key === 'cache-control'
        ) {
          if (typeof v === 'string') passthrough[key] = v
        }
      }
      res.writeHead(upstreamRes.statusCode ?? 502, passthrough)
      upstreamRes.pipe(res)
    },
  )

  upstreamReq.on('error', (err) => {
    log.error('upstream error', { error: errString(err) })
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' })
    }
    res.end(
      JSON.stringify({ error: { type: 'upstream_error', message: errString(err) } }),
    )
  })

  // Pipe the request body straight through.
  req.pipe(upstreamReq)
}

function stripPrefix(s: string, prefix: string): string {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s
}

function errString(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
