// Tests for the LLM proxy. We spin up a fake upstream on an
// ephemeral TCP port, point the proxy at it, then issue HTTP
// requests through the Unix socket. Verifies :
//   - allowed route is forwarded
//   - other routes return 403
//   - non-POST returns 405
//   - the host's API key is injected as Authorization, regardless of
//     what the client sent
//   - the upstream Authorization is replaced (i.e. the agent can't
//     impersonate someone else by setting it itself)

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { type AddressInfo, createServer } from 'node:net'
import { type IncomingMessage, type Server, createServer as createHttpServer } from 'node:http'
import { request as httpRequest } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startLlmProxy, type LlmProxyHandle } from '../src/llm-proxy.ts'

type FakeUpstream = {
  port: number
  receivedAuth: string | null
  receivedPath: string | null
  receivedBody: string
  stop: () => Promise<void>
}

async function startFakeUpstream(): Promise<FakeUpstream> {
  const state: FakeUpstream = {
    port: 0,
    receivedAuth: null,
    receivedPath: null,
    receivedBody: '',
    stop: async () => {},
  }
  const server: Server = createHttpServer((req: IncomingMessage, res) => {
    state.receivedAuth = (req.headers.authorization as string | undefined) ?? null
    state.receivedPath = req.url ?? null
    const chunks: Buffer[] = []
    req.on('data', (b: Buffer) => chunks.push(b))
    req.on('end', () => {
      state.receivedBody = Buffer.concat(chunks).toString('utf8')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  state.port = (server.address() as AddressInfo).port
  state.stop = () =>
    new Promise<void>((resolve) => server.close(() => resolve()))
  return state
}

let TMP_DIR: string
let upstream: FakeUpstream
let proxy: LlmProxyHandle
const ORIGINAL_DEBUG = process.env.FORGE_DEBUG

beforeEach(async () => {
  delete process.env.FORGE_DEBUG // keep test output clean
  TMP_DIR = mkdtempSync(join(tmpdir(), 'forge-llmproxy-'))
  upstream = await startFakeUpstream()
  proxy = await startLlmProxy({
    socketPath: join(TMP_DIR, 'llm.sock'),
    upstreamBaseUrl: `http://127.0.0.1:${upstream.port.toString()}/v1`,
    apiKey: 'host-secret-key',
  })
})

afterEach(async () => {
  proxy.stop()
  await upstream.stop()
  rmSync(TMP_DIR, { recursive: true, force: true })
  if (ORIGINAL_DEBUG === undefined) delete process.env.FORGE_DEBUG
  else process.env.FORGE_DEBUG = ORIGINAL_DEBUG
})

type ProxyResponse = {
  status: number
  body: string
}

function callProxy(
  method: string,
  path: string,
  options: { body?: string; headers?: Record<string, string> } = {},
): Promise<ProxyResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        method,
        path,
        socketPath: proxy.socketPath,
        headers: options.headers ?? {},
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (b: Buffer) => chunks.push(b))
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        )
      },
    )
    req.on('error', reject)
    if (options.body) req.end(options.body)
    else req.end()
  })
}

describe('llm-proxy — allowed route', () => {
  test('forwards POST /v1/chat/completions to upstream', async () => {
    const r = await callProxy('POST', '/v1/chat/completions', {
      body: JSON.stringify({ model: 'x', messages: [] }),
      headers: { 'content-type': 'application/json' },
    })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body)).toEqual({ ok: true })
    expect(upstream.receivedPath).toBe('/v1/chat/completions')
    expect(upstream.receivedBody).toContain('"model":"x"')
  })

  test('injects host API key as Authorization', async () => {
    await callProxy('POST', '/v1/chat/completions', {
      body: '{}',
      headers: { 'content-type': 'application/json' },
    })
    expect(upstream.receivedAuth).toBe('Bearer host-secret-key')
  })

  test('client-supplied Authorization is overridden', async () => {
    await callProxy('POST', '/v1/chat/completions', {
      body: '{}',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer agent-attempt-to-impersonate',
      },
    })
    expect(upstream.receivedAuth).toBe('Bearer host-secret-key')
  })
})

describe('llm-proxy — denied routes', () => {
  test('GET /v1/chat/completions → 405', async () => {
    const r = await callProxy('GET', '/v1/chat/completions')
    expect(r.status).toBe(405)
  })

  test('POST /v1/models → 403 (not in allowlist)', async () => {
    const r = await callProxy('POST', '/v1/models', { body: '{}' })
    expect(r.status).toBe(403)
    expect(upstream.receivedPath).toBeNull()
  })

  test('POST /admin → 403', async () => {
    const r = await callProxy('POST', '/admin', { body: '{}' })
    expect(r.status).toBe(403)
  })

  test('GET / → 403', async () => {
    const r = await callProxy('GET', '/')
    expect(r.status).toBe(403)
  })
})
