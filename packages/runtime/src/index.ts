// @agent-forge/runtime — entry point
//
// Runs INSIDE a Docker container. Two modes :
//
//   1. Standalone (P1) : reads a prompt from stdin, calls an OpenAI-
//      compatible LLM endpoint, streams the answer to stdout. No agent
//      configuration required, no tool loop.
//
//   2. Agent mode (P3+) : reads /agent/AGENT.md (frontmatter overrides
//      the model, body becomes the system prompt). The user prompt comes
//      from stdin. Native tools are available via fenced forge:* blocks
//      (P4) — the runtime parses them, executes the tool, feeds the
//      result back into the conversation, and loops up to maxTurns.
//
// Output is STREAMED token by token to stdout so the host can render
// progress live in the TUI. Tool results are also written to stdout
// inside [forge:tool] markers so the host can show them in Mission
// Control without re-running the parser.

import { Agent as HttpAgent, request as httpRequest } from 'node:http'
import { readFileSync } from 'node:fs'
import { createOpenAI } from '@ai-sdk/openai'
import { parseAgentMd } from '@agent-forge/core/types'
import {
  executeBash,
  executeRuntimeFileEdit,
  executeRuntimeFileRead,
  executeRuntimeFileWrite,
  executeRuntimeGlob,
  executeRuntimeGrep,
} from '@agent-forge/tools-core'
import { type CoreMessage, streamText } from 'ai'
import {
  parseFirstToolBlock,
  renderBashResult,
  renderEditResult,
  renderGlobResult,
  renderGrepResult,
  renderInvalid,
  renderReadResult,
  renderWriteResult,
} from './tool-protocol.ts'

const AGENT_MD_PATH = '/agent/AGENT.md'

const BASE_URL = process.env.FORGE_BASE_URL ?? 'http://127.0.0.1:8080/v1'
const API_KEY = process.env.FORGE_API_KEY ?? 'not-needed'
const ENV_MODEL =
  process.env.FORGE_MODEL ?? 'mlx-community/Qwen2.5-7B-Instruct-4bit'
const MAX_TOKENS = Number(process.env.FORGE_MAX_TOKENS ?? '1024')
// Hard cap to prevent runaway loops even if AGENT.md says otherwise.
const MAX_TURNS_HARD_CAP = 10

type AgentConfig = {
  model: string
  systemPrompt?: string
  agentName?: string
  maxTurns: number
}

function loadAgentConfig(): AgentConfig {
  let config: AgentConfig = { model: ENV_MODEL, maxTurns: 1 }
  try {
    const raw = readFileSync(AGENT_MD_PATH, 'utf8')
    const parsed = parseAgentMd(raw)
    config = {
      model: parsed.meta.model ?? ENV_MODEL,
      systemPrompt: parsed.body.length > 0 ? parsed.body : undefined,
      agentName: parsed.meta.name,
      maxTurns: Math.min(parsed.meta.maxTurns ?? 1, MAX_TURNS_HARD_CAP),
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      console.error(
        `✗ runtime error: failed to load ${AGENT_MD_PATH} : ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      process.exit(1)
    }
  }
  return config
}

// When FORGE_BASE_URL points at a Unix socket (unix:///path/to/sock/v1),
// we can't hand it directly to the OpenAI SDK : its fetch implementation
// only knows about TCP. Two helpers solve it :
//   - normaliseBaseUrl returns a synthetic http://localhost URL with
//     the same path, used purely as a key by the SDK
//   - makeFetchFor returns a custom fetch that routes every request
//     through an http.Agent bound to the socket
//
// The host's LLM proxy listens on that socket, injects the real
// API key, and forwards to the upstream. The container therefore
// runs with --network=none and never sees a credential.

function isUnixBaseUrl(baseUrl: string): boolean {
  return baseUrl.startsWith('unix://')
}

function unixSocketPath(baseUrl: string): string {
  // unix:///run/forge/llm.sock/v1 → /run/forge/llm.sock
  // We split on the next path segment after the socket file. The
  // proxy's allowlist works at /v1/chat/completions, so by
  // convention we use a path suffix of /v1.
  const stripped = baseUrl.slice('unix://'.length)
  const v1Idx = stripped.lastIndexOf('/v1')
  return v1Idx > 0 ? stripped.slice(0, v1Idx) : stripped
}

function urlPathSuffix(baseUrl: string): string {
  const stripped = baseUrl.slice('unix://'.length)
  const v1Idx = stripped.lastIndexOf('/v1')
  return v1Idx > 0 ? stripped.slice(v1Idx) : '/v1'
}

function normaliseBaseUrl(baseUrl: string): string {
  if (!isUnixBaseUrl(baseUrl)) return baseUrl
  // The SDK requires a real-looking URL to compute the request path.
  // The host part is bogus — our custom fetch ignores it and uses
  // the Unix socket instead.
  return `http://localhost${urlPathSuffix(baseUrl)}`
}

function makeFetchFor(baseUrl: string): typeof fetch | undefined {
  if (!isUnixBaseUrl(baseUrl)) return undefined
  const socketPath = unixSocketPath(baseUrl)
  const agent = new HttpAgent({ socketPath } as unknown as ConstructorParameters<typeof HttpAgent>[0])
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const headers: Record<string, string> = {}
    if (init?.headers) {
      const h = new Headers(init.headers)
      h.forEach((v, k) => {
        headers[k] = v
      })
    }
    return await new Promise<Response>((resolve, reject) => {
      const req = httpRequest(
        {
          method,
          path: parsed.pathname + parsed.search,
          headers,
          agent,
        },
        (res) => {
          const respHeaders = new Headers()
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') respHeaders.set(k, v)
            else if (Array.isArray(v)) respHeaders.set(k, v.join(', '))
          }
          // Wrap the IncomingMessage in a ReadableStream so the
          // Vercel AI SDK gets the SSE chunks as they arrive,
          // instead of after the upstream closes the connection.
          const body = new ReadableStream<Uint8Array>({
            start(controller) {
              res.on('data', (b: Buffer) => controller.enqueue(new Uint8Array(b)))
              res.on('end', () => controller.close())
              res.on('error', (err) => controller.error(err))
            },
            cancel() {
              res.destroy()
            },
          })
          resolve(
            new Response(body, {
              status: res.statusCode ?? 502,
              headers: respHeaders,
            }),
          )
        },
      )
      req.on('error', reject)
      if (init?.body) {
        if (typeof init.body === 'string') req.end(init.body)
        else if (init.body instanceof Uint8Array) req.end(Buffer.from(init.body))
        else req.end(String(init.body))
      } else {
        req.end()
      }
    })
  }
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Uint8Array)
  }
  return Buffer.concat(chunks).toString('utf8').trim()
}

const TOOL_PROMPT = `

You have access to six native tools, each callable by emitting a fenced block in your reply.

## forge:bash — execute a shell command

\`\`\`forge:bash
{ "command": "ls -la", "timeoutMs": 10000 }
\`\`\`

Runs via \`bash -lc\` inside /workspace. \`timeoutMs\` defaults to 30000, capped at 120000.

## forge:write — create or overwrite a file

\`\`\`forge:write
{ "path": "src/index.ts", "content": "export const x = 1\\n" }
\`\`\`

\`path\` is relative to /workspace (or absolute under /workspace). Existing files are overwritten.

## forge:read — read a file

\`\`\`forge:read
{ "path": "src/index.ts", "offset": 0, "limit": 200 }
\`\`\`

\`offset\` and \`limit\` are line-based, both optional. Default limit 200, max 2000. Output is clipped at 16 KB ; use offset/limit to walk a long file.

## forge:edit — patch a file by exact substring replacement

\`\`\`forge:edit
{ "path": "src/index.ts", "oldString": "const x = 1", "newString": "const x = 2" }
\`\`\`

\`oldString\` must match exactly once unless you set \`replaceAll\` true. If it matches multiple times, widen the surrounding context until it's unique.

## forge:grep — regex search across files

\`\`\`forge:grep
{ "pattern": "TODO|FIXME", "glob": "src/**/*.ts", "ignoreCase": false }
\`\`\`

\`pattern\` is a JavaScript RegExp source. \`glob\` is optional (defaults to \`**/*\`). Returns up to 200 hits with path:line:text.

## forge:glob — list files by pattern

\`\`\`forge:glob
{ "pattern": "src/**/*.ts" }
\`\`\`

Supports \`*\`, \`**\`, and \`?\`. Returns up to 200 paths relative to /workspace.

## Iteration

- Emit at most ONE block per reply. Text before the block is shown to the user. Text after the block is discarded.
- After you receive a tool result, decide whether you need another tool call or whether you can produce the final answer.
- When you are done, reply with plain text (no fenced block).
`

function buildSystem(config: AgentConfig, hasTools: boolean): string | undefined {
  const base = config.systemPrompt ?? ''
  if (!hasTools) return base.length > 0 ? base : undefined
  return base.length > 0 ? `${base}${TOOL_PROMPT}` : TOOL_PROMPT.trim()
}

async function streamOneTurn(
  provider: ReturnType<typeof createOpenAI>,
  model: string,
  system: string | undefined,
  messages: CoreMessage[],
): Promise<string> {
  const result = streamText({
    model: provider(model),
    system,
    messages,
    maxTokens: MAX_TOKENS,
  })
  let acc = ''
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk)
    acc += chunk
  }
  return acc
}

async function executeToolBlock(
  parsed: Extract<ReturnType<typeof parseFirstToolBlock>, { kind: 'tool' }>,
): Promise<string> {
  const tool = parsed.tool
  switch (tool.kind) {
    case 'bash': {
      const result = await executeBash(tool.input)
      return renderBashResult(tool.input, result)
    }
    case 'write': {
      const result = executeRuntimeFileWrite(tool.input)
      return renderWriteResult(tool.input, result)
    }
    case 'read': {
      const result = executeRuntimeFileRead(tool.input)
      return renderReadResult(tool.input, result)
    }
    case 'edit': {
      const result = executeRuntimeFileEdit(tool.input)
      return renderEditResult(tool.input, result)
    }
    case 'grep': {
      const result = executeRuntimeGrep(tool.input)
      return renderGrepResult(tool.input, result)
    }
    case 'glob': {
      const result = executeRuntimeGlob(tool.input)
      return renderGlobResult(tool.input, result)
    }
  }
}

async function main(): Promise<void> {
  const config = loadAgentConfig()
  const userPrompt = await readStdin()
  if (!userPrompt) {
    console.error('✗ no prompt received on stdin')
    process.exit(1)
  }

  const provider = createOpenAI({
    baseURL: normaliseBaseUrl(BASE_URL),
    apiKey: API_KEY,
    fetch: makeFetchFor(BASE_URL),
  })
  const hasTools = config.maxTurns > 1
  const system = buildSystem(config, hasTools)

  const messages: CoreMessage[] = [{ role: 'user', content: userPrompt }]

  for (let turn = 0; turn < config.maxTurns; turn += 1) {
    const reply = await streamOneTurn(provider, config.model, system, messages)
    process.stdout.write('\n')

    if (!hasTools) break

    const parsed = parseFirstToolBlock(reply)
    if (parsed.kind === 'none') break

    // Record what the LLM just said (text + raw block) so the next turn
    // sees it as a real assistant message.
    messages.push({ role: 'assistant', content: reply })

    let toolReply: string
    if (parsed.kind === 'invalid') {
      toolReply = renderInvalid(parsed.error)
    } else {
      toolReply = await executeToolBlock(parsed)
    }

    // Mark tool output for the host TUI so it can render it inside the
    // Mission Control card instead of mixing it with prose.
    process.stdout.write(`\n[forge:tool]\n${toolReply}\n[/forge:tool]\n`)

    messages.push({ role: 'user', content: toolReply })
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`✗ runtime error: ${msg}`)
  process.exit(1)
})
