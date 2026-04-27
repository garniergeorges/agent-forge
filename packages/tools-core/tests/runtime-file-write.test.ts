// Security and round-trip tests for the runtime-side FileWrite tool.
// Uses FORGE_WORKSPACE to point the sandbox at a temp dir so the tests
// don't try to write to /workspace on the host.

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let TMP_WORKSPACE: string
const ORIGINAL_ENV = process.env.FORGE_WORKSPACE

beforeAll(() => {
  TMP_WORKSPACE = mkdtempSync(join(tmpdir(), 'forge-rt-fw-'))
  process.env.FORGE_WORKSPACE = TMP_WORKSPACE
})

afterAll(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.FORGE_WORKSPACE
  else process.env.FORGE_WORKSPACE = ORIGINAL_ENV
  rmSync(TMP_WORKSPACE, { recursive: true, force: true })
})

// Late import so module-level reads of process.env happen after we set it.
const {
  executeRuntimeFileWrite,
  resolveSandboxedPath,
} = await import('../src/runtime/file-write.ts')

afterEach(() => {
  // Wipe contents but keep the dir itself so the env var stays valid.
  for (const entry of [
    'a.txt',
    'sub/b.txt',
    'sub',
    'overwrite-me.txt',
  ]) {
    const p = join(TMP_WORKSPACE, entry)
    if (existsSync(p)) rmSync(p, { recursive: true, force: true })
  }
})

describe('resolveSandboxedPath (runtime)', () => {
  test('accepts a relative path under the sandbox', () => {
    const r = resolveSandboxedPath('a.txt')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.absolutePath).toBe(join(TMP_WORKSPACE, 'a.txt'))
  })

  test('rejects path traversal', () => {
    const r = resolveSandboxedPath('../escape.txt')
    expect(r.ok).toBe(false)
  })

  test('rejects absolute path outside the sandbox', () => {
    const r = resolveSandboxedPath('/etc/passwd')
    expect(r.ok).toBe(false)
  })

  test('rejects null byte', () => {
    const r = resolveSandboxedPath('foo\0bar')
    expect(r.ok).toBe(false)
  })
})

describe('executeRuntimeFileWrite', () => {
  test('writes a file in the sandbox', () => {
    const r = executeRuntimeFileWrite({ path: 'a.txt', content: 'hi' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(readFileSync(r.absolutePath, 'utf8')).toBe('hi')
      expect(r.bytes).toBe(2)
    }
  })

  test('creates parent directories', () => {
    const r = executeRuntimeFileWrite({
      path: 'sub/b.txt',
      content: 'nested',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(readFileSync(r.absolutePath, 'utf8')).toBe('nested')
  })

  test('overwrites an existing file', () => {
    executeRuntimeFileWrite({ path: 'overwrite-me.txt', content: 'v1' })
    const r = executeRuntimeFileWrite({ path: 'overwrite-me.txt', content: 'v2' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(readFileSync(r.absolutePath, 'utf8')).toBe('v2')
  })

  test('refuses path escaping the sandbox', () => {
    const r = executeRuntimeFileWrite({
      path: '../evil.txt',
      content: 'x',
    })
    expect(r.ok).toBe(false)
  })
})
