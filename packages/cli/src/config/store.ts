// Persistent user config stored at ~/.agent-forge/config.json.
// Created lazily on first write, parsed defensively on read.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export type Lang = 'en' | 'fr'

export type ForgeConfig = {
  lang?: Lang
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
