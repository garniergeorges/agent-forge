// @agent-forge/runtime — entry point
//
// Reads a prompt from stdin, calls an OpenAI-compatible LLM endpoint
// via the Vercel AI SDK, writes the assistant text to stdout.
//
// Defaults to a local MLX server (mlx_lm.server) so dev runs cost nothing.
// To use OpenAI cloud or another OpenAI-compatible provider :
//   FORGE_BASE_URL=https://api.openai.com/v1 FORGE_API_KEY=sk-...

import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

const BASE_URL = process.env.FORGE_BASE_URL ?? 'http://127.0.0.1:8080/v1'
const API_KEY = process.env.FORGE_API_KEY ?? 'not-needed'
const MODEL = process.env.FORGE_MODEL ?? 'mlx-community/Mistral-Nemo-Instruct-2407-4bit'
const MAX_TOKENS = Number(process.env.FORGE_MAX_TOKENS ?? '1024')

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Uint8Array)
  }
  return Buffer.concat(chunks).toString('utf8').trim()
}

async function main(): Promise<void> {
  const prompt = await readStdin()
  if (!prompt) {
    console.error('✗ no prompt received on stdin')
    process.exit(1)
  }

  const provider = createOpenAI({ baseURL: BASE_URL, apiKey: API_KEY })

  const { text } = await generateText({
    model: provider(MODEL),
    prompt,
    maxTokens: MAX_TOKENS,
  })

  process.stdout.write(`${text}\n`)
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`✗ runtime error: ${msg}`)
  process.exit(1)
})
