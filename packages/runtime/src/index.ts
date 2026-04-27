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

import { readFileSync } from 'node:fs'
import { createOpenAI } from '@ai-sdk/openai'
import { parseAgentMd } from '@agent-forge/core/types'
import {
  executeBash,
  executeRuntimeFileWrite,
} from '@agent-forge/tools-core'
import { type CoreMessage, streamText } from 'ai'
import {
  parseFirstToolBlock,
  renderBashResult,
  renderInvalid,
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

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Uint8Array)
  }
  return Buffer.concat(chunks).toString('utf8').trim()
}

const TOOL_PROMPT = `

You have access to two native tools, callable by emitting a fenced block in your reply.

## forge:bash — execute a shell command

\`\`\`forge:bash
{ "command": "ls -la", "timeoutMs": 10000 }
\`\`\`

The command runs via \`bash -lc\` inside /workspace. \`timeoutMs\` is optional (default 30000, max 120000). The result (stdout, stderr, exit code) will be injected back into the conversation on the next turn.

## forge:write — write a file in /workspace

\`\`\`forge:write
{ "path": "src/index.ts", "content": "export const x = 1\\n" }
\`\`\`

\`path\` is relative to /workspace (or an absolute path under /workspace). Existing files are overwritten. The result (absolute path, bytes written, or an error) will be injected back into the conversation on the next turn.

## Iteration

- Emit at most ONE block per reply. Anything you write before the block is shown to the user. Anything after the block is discarded.
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
  if (tool.kind === 'bash') {
    const result = await executeBash(tool.input)
    return renderBashResult(tool.input, result)
  }
  // tool.kind === 'write'
  const result = executeRuntimeFileWrite(tool.input)
  return renderWriteResult(tool.input, result)
}

async function main(): Promise<void> {
  const config = loadAgentConfig()
  const userPrompt = await readStdin()
  if (!userPrompt) {
    console.error('✗ no prompt received on stdin')
    process.exit(1)
  }

  const provider = createOpenAI({ baseURL: BASE_URL, apiKey: API_KEY })
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
