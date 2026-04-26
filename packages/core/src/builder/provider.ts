// LLM provider factory — wraps Vercel AI SDK + an OpenAI-compatible
// endpoint. Defaults match the runtime (P1.2) so the builder talks to
// the same MLX server by default. Config is read live each time so the
// CLI can hot-swap provider/model without a restart.

import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV1 } from 'ai'

export type ProviderConfig = {
  baseURL: string
  apiKey: string
  model: string
}

let override: Partial<ProviderConfig> = {}

export function setProviderOverride(patch: Partial<ProviderConfig>): void {
  override = { ...override, ...patch }
}

export function clearProviderOverride(): void {
  override = {}
}

function readConfig(): ProviderConfig {
  return {
    baseURL:
      override.baseURL ??
      process.env.FORGE_BASE_URL ??
      'http://127.0.0.1:8080/v1',
    apiKey: override.apiKey ?? process.env.FORGE_API_KEY ?? 'not-needed',
    model:
      override.model ??
      process.env.FORGE_MODEL ??
      'mlx-community/Llama-3.2-3B-Instruct-4bit',
  }
}

export function getCurrentModelName(): string {
  return readConfig().model
}

export function getCurrentBaseURL(): string {
  return readConfig().baseURL
}

export function getBuilderModel(): LanguageModelV1 {
  const cfg = readConfig()
  return createOpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey })(cfg.model)
}

// Backwards-compatibility export (used by the CLI Welcome header).
export const FORGE_MODEL = getCurrentModelName()
