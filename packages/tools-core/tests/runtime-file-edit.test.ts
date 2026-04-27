import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let TMP_WORKSPACE: string
const ORIGINAL_ENV = process.env.FORGE_WORKSPACE

beforeAll(() => {
  TMP_WORKSPACE = mkdtempSync(join(tmpdir(), 'forge-rt-fe-'))
  process.env.FORGE_WORKSPACE = TMP_WORKSPACE
})

afterAll(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.FORGE_WORKSPACE
  else process.env.FORGE_WORKSPACE = ORIGINAL_ENV
  rmSync(TMP_WORKSPACE, { recursive: true, force: true })
})

const { executeRuntimeFileEdit } = await import('../src/runtime/file-edit.ts')

describe('executeRuntimeFileEdit', () => {
  test('replaces a unique substring', () => {
    const path = join(TMP_WORKSPACE, 'a.ts')
    writeFileSync(path, 'const x = 1\nconst y = 2\n')
    const r = executeRuntimeFileEdit({
      path: 'a.ts',
      oldString: 'const x = 1',
      newString: 'const x = 42',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.replacements).toBe(1)
      expect(readFileSync(path, 'utf8')).toBe('const x = 42\nconst y = 2\n')
    }
  })

  test('refuses ambiguous match without replaceAll', () => {
    const path = join(TMP_WORKSPACE, 'b.ts')
    writeFileSync(path, 'foo\nfoo\n')
    const r = executeRuntimeFileEdit({
      path: 'b.ts',
      oldString: 'foo',
      newString: 'bar',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('matches 2 times')
  })

  test('replaceAll handles every occurrence', () => {
    const path = join(TMP_WORKSPACE, 'c.ts')
    writeFileSync(path, 'foo\nfoo\nfoo\n')
    const r = executeRuntimeFileEdit({
      path: 'c.ts',
      oldString: 'foo',
      newString: 'bar',
      replaceAll: true,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.replacements).toBe(3)
      expect(readFileSync(path, 'utf8')).toBe('bar\nbar\nbar\n')
    }
  })

  test('returns an error when oldString is missing', () => {
    const path = join(TMP_WORKSPACE, 'd.ts')
    writeFileSync(path, 'hello')
    const r = executeRuntimeFileEdit({
      path: 'd.ts',
      oldString: 'goodbye',
      newString: 'bye',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('not found')
  })

  test('refuses path outside the sandbox', () => {
    const r = executeRuntimeFileEdit({
      path: '../escape',
      oldString: 'a',
      newString: 'b',
    })
    expect(r.ok).toBe(false)
  })
})
