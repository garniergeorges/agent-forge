import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let TMP_WORKSPACE: string
const ORIGINAL_ENV = process.env.FORGE_WORKSPACE

beforeAll(() => {
  TMP_WORKSPACE = mkdtempSync(join(tmpdir(), 'forge-rt-gr-'))
  process.env.FORGE_WORKSPACE = TMP_WORKSPACE
  mkdirSync(join(TMP_WORKSPACE, 'src'), { recursive: true })
  writeFileSync(
    join(TMP_WORKSPACE, 'src/index.ts'),
    '// TODO: implement\nexport const x = 1\n// fixme later\n',
  )
  writeFileSync(join(TMP_WORKSPACE, 'src/util.ts'), 'export const todo = "x"\n')
  writeFileSync(join(TMP_WORKSPACE, 'README.md'), '# project\nTODO: write docs\n')
})

afterAll(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.FORGE_WORKSPACE
  else process.env.FORGE_WORKSPACE = ORIGINAL_ENV
  rmSync(TMP_WORKSPACE, { recursive: true, force: true })
})

const { executeRuntimeGrep } = await import('../src/runtime/grep.ts')

describe('executeRuntimeGrep', () => {
  test('finds case-sensitive matches across files', () => {
    const r = executeRuntimeGrep({ pattern: 'TODO' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const paths = r.hits.map((h) => h.path).sort()
      expect(paths).toEqual(['README.md', 'src/index.ts'])
    }
  })

  test('honors ignoreCase', () => {
    const r = executeRuntimeGrep({ pattern: 'todo', ignoreCase: true })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const paths = r.hits.map((h) => h.path).sort()
      // util.ts matches via "const todo", index.ts via TODO, README.md via TODO.
      expect(paths).toEqual(['README.md', 'src/index.ts', 'src/util.ts'])
    }
  })

  test('respects the glob filter', () => {
    const r = executeRuntimeGrep({ pattern: 'TODO', glob: '**/*.md' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const paths = r.hits.map((h) => h.path)
      expect(paths).toEqual(['README.md'])
    }
  })

  test('returns an error for an invalid regex', () => {
    const r = executeRuntimeGrep({ pattern: '(' })
    expect(r.ok).toBe(false)
  })
})
