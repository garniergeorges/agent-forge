// LLM provider factory — wraps Vercel AI SDK + an OpenAI-compatible
// endpoint. Defaults match the runtime (P1.2) so the builder talks to
// the same MLX server by default.

import { createOpenAI } from '@ai-sdk/openai'

const BASE_URL = process.env.FORGE_BASE_URL ?? 'http://127.0.0.1:8080/v1'
const API_KEY = process.env.FORGE_API_KEY ?? 'not-needed'

export const FORGE_MODEL =
  process.env.FORGE_MODEL ?? 'mlx-community/Llama-3.2-3B-Instruct-4bit'

const provider = createOpenAI({ baseURL: BASE_URL, apiKey: API_KEY })

export const builderModel = provider(FORGE_MODEL)
