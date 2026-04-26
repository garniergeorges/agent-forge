// @agent-forge/runtime — entry point
//
// Runs INSIDE a Docker container. Two modes :
//
//   1. Standalone (P1) : reads a prompt from stdin, calls an OpenAI-
//      compatible LLM endpoint, streams the answer to stdout. No agent
//      configuration required.
//
//   2. Agent mode (P3.4) : if an AGENT.md is mounted at /agent/AGENT.md,
//      its frontmatter overrides the model and its body becomes the
//      system prompt. The prompt from stdin is the user message.
//
// The output is STREAMED token by token to stdout so the host can render
// progress live in the TUI.

import { readFileSync } from 'node:fs'
import { createOpenAI } from '@ai-sdk/openai'
import { parseAgentMd } from '@agent-forge/core/types'
import { streamText } from 'ai'

const AGENT_MD_PATH = '/agent/AGENT.md'

const BASE_URL = process.env.FORGE_BASE_URL ?? 'http://127.0.0.1:8080/v1'
const API_KEY = process.env.FORGE_API_KEY ?? 'not-needed'
const ENV_MODEL =
  process.env.FORGE_MODEL ?? 'mlx-community/Qwen2.5-7B-Instruct-4bit'
const MAX_TOKENS = Number(process.env.FORGE_MAX_TOKENS ?? '1024')

type AgentConfig = {
  model: string
  systemPrompt?: string
  agentName?: string
}

function loadAgentConfig(): AgentConfig {
  // Default config when no AGENT.md is mounted (standalone P1 mode).
  let config: AgentConfig = { model: ENV_MODEL }
  try {
    const raw = readFileSync(AGENT_MD_PATH, 'utf8')
    const parsed = parseAgentMd(raw)
    config = {
      model: parsed.meta.model ?? ENV_MODEL,
      systemPrompt: parsed.body.length > 0 ? parsed.body : undefined,
      agentName: parsed.meta.name,
    }
  } catch (err) {
    // ENOENT means standalone mode, that is fine. Anything else is fatal :
    // a malformed AGENT.md would otherwise silently fall back to the
    // default model + no system prompt, which is misleading.
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

async function main(): Promise<void> {
  const config = loadAgentConfig()
  const prompt = await readStdin()
  if (!prompt) {
    console.error('✗ no prompt received on stdin')
    process.exit(1)
  }

  const provider = createOpenAI({ baseURL: BASE_URL, apiKey: API_KEY })

  const result = streamText({
    model: provider(config.model),
    system: config.systemPrompt,
    prompt,
    maxTokens: MAX_TOKENS,
  })

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk)
  }
  // Trailing newline so the host can detect the end of the stream cleanly.
  process.stdout.write('\n')
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`✗ runtime error: ${msg}`)
  process.exit(1)
})
