import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let TMP_WORKSPACE: string
const ORIGINAL_ENV = process.env.FORGE_WORKSPACE

beforeAll(() => {
  TMP_WORKSPACE = mkdtempSync(join(tmpdir(), 'forge-rt-fr-'))
  process.env.FORGE_WORKSPACE = TMP_WORKSPACE
})

afterAll(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.FORGE_WORKSPACE
  else process.env.FORGE_WORKSPACE = ORIGINAL_ENV
  rmSync(TMP_WORKSPACE, { recursive: true, force: true })
})

const { executeRuntimeFileRead } = await import('../src/runtime/file-read.ts')

describe('executeRuntimeFileRead', () => {
  test('reads the full file when no offset/limit', () => {
    writeFileSync(join(TMP_WORKSPACE, 'a.txt'), 'one\ntwo\nthree\n')
    const r = executeRuntimeFileRead({ path: 'a.txt' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.content).toBe('one\ntwo\nthree')
      expect(r.totalLines).toBe(3)
      expect(r.returnedLines).toBe(3)
    }
  })

  test('honors offset and limit', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${(i + 1).toString()}`).join('\n')
    writeFileSync(join(TMP_WORKSPACE, 'b.txt'), lines)
    const r = executeRuntimeFileRead({ path: 'b.txt', offset: 3, limit: 4 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.content).toBe('line4\nline5\nline6\nline7')
      expect(r.totalLines).toBe(10)
      expect(r.returnedLines).toBe(4)
    }
  })

  test('rejects path outside the sandbox', () => {
    const r = executeRuntimeFileRead({ path: '../escape.txt' })
    expect(r.ok).toBe(false)
  })

  test('returns an error for missing files', () => {
    const r = executeRuntimeFileRead({ path: 'nope.txt' })
    expect(r.ok).toBe(false)
  })
})
