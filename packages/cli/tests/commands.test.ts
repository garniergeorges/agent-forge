// Smoke tests for the slash command parser.
// Pure logic — no Ink, no LLM, fast.

import { describe, expect, mock, test } from 'bun:test'
import { isCommand, runCommand } from '../src/commands.ts'

function makeCtx(overrides: Partial<Parameters<typeof runCommand>[1]> = {}) {
  return {
    lang: 'en' as const,
    setLang: mock(() => {}),
    clearChat: mock(() => {}),
    exit: mock(() => {}),
    ...overrides,
  }
}

describe('isCommand', () => {
  test('detects leading slash', () => {
    expect(isCommand('/help')).toBe(true)
    expect(isCommand('   /help')).toBe(true)
  })
  test('rejects non-commands', () => {
    expect(isCommand('hello')).toBe(false)
    expect(isCommand('')).toBe(false)
  })
})

describe('runCommand', () => {
  test('/help returns the help block', () => {
    const out = runCommand('/help', makeCtx())
    expect(out.lines.length).toBeGreaterThan(3)
    expect(out.lines[0]).toContain('Available commands')
  })

  test('/clear triggers clearChat', () => {
    const ctx = makeCtx()
    runCommand('/clear', ctx)
    expect(ctx.clearChat).toHaveBeenCalledTimes(1)
  })

  test('/exit triggers exit', () => {
    const ctx = makeCtx()
    runCommand('/exit', ctx)
    expect(ctx.exit).toHaveBeenCalledTimes(1)
  })

  test('/lang fr changes language', () => {
    const ctx = makeCtx()
    const out = runCommand('/lang fr', ctx)
    expect(ctx.setLang).toHaveBeenCalledWith('fr')
    expect(out.lines[0]).toBeDefined()
  })

  test('/lang invalid is rejected', () => {
    const ctx = makeCtx()
    const out = runCommand('/lang klingon', ctx)
    expect(ctx.setLang).not.toHaveBeenCalled()
    expect(out.lines[0]).toContain('Unknown language')
  })

  test('unknown command produces an error line', () => {
    const out = runCommand('/totallymadeup', makeCtx())
    expect(out.lines[0]).toContain('Unknown command')
  })
})
