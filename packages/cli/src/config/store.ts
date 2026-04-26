// Persistent user config stored at ~/.agent-forge/config.json.
// Created lazily on first write, parsed defensively on read.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export type Lang = 'en' | 'fr'

export type ProviderPreset = 'mlx' | 'openai' | 'anthropic' | 'mistral'

export type ForgeConfig = {
  lang?: Lang
  model?: string
  provider?: ProviderPreset
}

const CONFIG_DIR = join(homedir(), '.agent-forge')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

export function loadConfig(): ForgeConfig {
  if (!existsSync(CONFIG_PATH)) return {}
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as ForgeConfig
  } catch {
    // Corrupt config — start fresh rather than crashing.
    return {}
  }
}

export function saveConfig(config: ForgeConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

// Provider presets : default base URL + sensible default model. Used by
// /provider switching. The user can still override anything via env vars.
export const PROVIDER_PRESETS: Record<
  ProviderPreset,
  { baseURL: string; defaultModel: string; needsKey: boolean }
> = {
  mlx: {
    baseURL: 'http://127.0.0.1:8080/v1',
    defaultModel: 'mlx-community/Qwen2.5-7B-Instruct-4bit',
    needsKey: false,
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-6',
    needsKey: true,
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    needsKey: true,
  },
}
