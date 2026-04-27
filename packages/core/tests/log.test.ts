// Logger tests : enabled / disabled by env, JSON-lines format, level
// filtering, never throws on bad input.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _resetLoggerStateForTests,
  currentLogPath,
  getLogger,
  isLoggingEnabled,
} from '../src/log/index.ts'

let TMP_DIR: string
const ORIGINAL_DEBUG = process.env.FORGE_DEBUG
const ORIGINAL_FILE = process.env.FORGE_LOG_FILE

beforeEach(() => {
  TMP_DIR = mkdtempSync(join(tmpdir(), 'forge-log-'))
  delete process.env.FORGE_DEBUG
  delete process.env.FORGE_LOG_FILE
  _resetLoggerStateForTests()
})

afterEach(() => {
  if (ORIGINAL_DEBUG === undefined) delete process.env.FORGE_DEBUG
  else process.env.FORGE_DEBUG = ORIGINAL_DEBUG
  if (ORIGINAL_FILE === undefined) delete process.env.FORGE_LOG_FILE
  else process.env.FORGE_LOG_FILE = ORIGINAL_FILE
  _resetLoggerStateForTests()
  rmSync(TMP_DIR, { recursive: true, force: true })
})

describe('logger — disabled by default', () => {
  test('isLoggingEnabled is false when no env var set', () => {
    expect(isLoggingEnabled()).toBe(false)
  })

  test('currentLogPath returns null', () => {
    expect(currentLogPath()).toBeNull()
  })

  test('writing while disabled is a no-op', () => {
    const log = getLogger('test')
    log.info('this goes nowhere')
    log.error('still nowhere', { code: 1 })
    // No file should have been created anywhere — we don't have a
    // path to check, but the call must not have thrown.
    expect(true).toBe(true)
  })
})

describe('logger — enabled via FORGE_LOG_FILE', () => {
  test('writes JSON-lines to the configured path', () => {
    const file = join(TMP_DIR, 'out.log')
    process.env.FORGE_LOG_FILE = file
    _resetLoggerStateForTests()

    const log = getLogger('myMod')
    log.info('hello', { n: 1 })
    log.warn('careful', { reason: 'xx' })

    expect(existsSync(file)).toBe(true)
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines.length).toBe(2)
    const first = JSON.parse(lines[0] as string)
    expect(first.level).toBe('info')
    expect(first.source).toBe('myMod')
    expect(first.msg).toBe('hello')
    expect(first.data).toEqual({ n: 1 })
    expect(typeof first.t).toBe('string')
  })
})

describe('logger — level threshold via FORGE_DEBUG', () => {
  test('FORGE_DEBUG=info skips trace and debug', () => {
    const file = join(TMP_DIR, 'level.log')
    process.env.FORGE_DEBUG = 'info'
    process.env.FORGE_LOG_FILE = file
    _resetLoggerStateForTests()

    const log = getLogger('lv')
    log.trace('trace skipped')
    log.debug('debug skipped')
    log.info('info kept')
    log.error('error kept')

    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines.length).toBe(2)
    expect(JSON.parse(lines[0] as string).level).toBe('info')
    expect(JSON.parse(lines[1] as string).level).toBe('error')
  })

  test('FORGE_DEBUG=1 defaults to debug threshold', () => {
    const file = join(TMP_DIR, 'one.log')
    process.env.FORGE_DEBUG = '1'
    process.env.FORGE_LOG_FILE = file
    _resetLoggerStateForTests()

    const log = getLogger('one')
    log.trace('skipped')
    log.debug('kept')
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines.length).toBe(1)
    expect(JSON.parse(lines[0] as string).level).toBe('debug')
  })
})

describe('logger — robustness', () => {
  test('does not throw on circular data', () => {
    const file = join(TMP_DIR, 'circ.log')
    process.env.FORGE_LOG_FILE = file
    _resetLoggerStateForTests()

    const log = getLogger('safe')
    const a: { self?: unknown } = {}
    a.self = a
    expect(() => log.info('circular', a)).not.toThrow()
  })
})
