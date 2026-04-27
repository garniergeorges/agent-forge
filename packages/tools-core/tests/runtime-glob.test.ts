import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let TMP_WORKSPACE: string
const ORIGINAL_ENV = process.env.FORGE_WORKSPACE

beforeAll(() => {
  TMP_WORKSPACE = mkdtempSync(join(tmpdir(), 'forge-rt-gl-'))
  process.env.FORGE_WORKSPACE = TMP_WORKSPACE
  mkdirSync(join(TMP_WORKSPACE, 'src/sub'), { recursive: true })
  writeFileSync(join(TMP_WORKSPACE, 'src/index.ts'), '')
  writeFileSync(join(TMP_WORKSPACE, 'src/sub/util.ts'), '')
  writeFileSync(join(TMP_WORKSPACE, 'src/sub/util.test.ts'), '')
  writeFileSync(join(TMP_WORKSPACE, 'README.md'), '')
})

afterAll(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.FORGE_WORKSPACE
  else process.env.FORGE_WORKSPACE = ORIGINAL_ENV
  rmSync(TMP_WORKSPACE, { recursive: true, force: true })
})

const { executeRuntimeGlob } = await import('../src/runtime/glob.ts')

describe('executeRuntimeGlob', () => {
  test('matches all .ts files recursively with **/*.ts', () => {
    const r = executeRuntimeGlob({ pattern: '**/*.ts' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.matches).toEqual(['src/index.ts', 'src/sub/util.test.ts', 'src/sub/util.ts'])
    }
  })

  test('matches a single segment with src/*.ts', () => {
    const r = executeRuntimeGlob({ pattern: 'src/*.ts' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.matches).toEqual(['src/index.ts'])
  })

  test('matches with ? for single char', () => {
    const r = executeRuntimeGlob({ pattern: 'README.m?' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.matches).toEqual(['README.md'])
  })

  test('returns empty when nothing matches', () => {
    const r = executeRuntimeGlob({ pattern: '**/*.rs' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.matches).toEqual([])
  })
})
