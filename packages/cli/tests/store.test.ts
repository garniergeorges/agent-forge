// Smoke test for the config store : round-trip a config through disk.
// We back up and restore the user's real config to avoid clobbering it.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, renameSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, saveConfig } from '../src/config/store.ts'

const REAL_PATH = join(homedir(), '.agent-forge', 'config.json')
const BACKUP_PATH = `${REAL_PATH}.bak-test-${Date.now().toString()}`
let hadConfig = false

beforeAll(() => {
  hadConfig = existsSync(REAL_PATH)
  if (hadConfig) renameSync(REAL_PATH, BACKUP_PATH)
})

afterAll(() => {
  if (existsSync(REAL_PATH)) unlinkSync(REAL_PATH)
  if (hadConfig) renameSync(BACKUP_PATH, REAL_PATH)
})

describe('config store', () => {
  test('returns empty object when no file exists', () => {
    if (existsSync(REAL_PATH)) unlinkSync(REAL_PATH)
    expect(loadConfig()).toEqual({})
  })

  test('saves and reloads a config', () => {
    saveConfig({ lang: 'fr', model: 'foo/bar' })
    expect(loadConfig()).toEqual({ lang: 'fr', model: 'foo/bar' })
    // Sanity check : the file actually exists.
    expect(existsSync(REAL_PATH)).toBe(true)
    expect(JSON.parse(readFileSync(REAL_PATH, 'utf8'))).toEqual({
      lang: 'fr',
      model: 'foo/bar',
    })
  })

  test('returns empty object on corrupt JSON', () => {
    require('node:fs').writeFileSync(REAL_PATH, '{not valid', 'utf8')
    expect(loadConfig()).toEqual({})
  })
})
