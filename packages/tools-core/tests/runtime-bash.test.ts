// Round-trip tests for the runtime-side Bash tool.
// Uses FORGE_WORKSPACE so the cwd is a temp dir, not /workspace.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let TMP_WORKSPACE: string
const ORIGINAL_ENV = process.env.FORGE_WORKSPACE

beforeAll(() => {
  TMP_WORKSPACE = mkdtempSync(join(tmpdir(), 'forge-rt-bash-'))
  process.env.FORGE_WORKSPACE = TMP_WORKSPACE
})

afterAll(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.FORGE_WORKSPACE
  else process.env.FORGE_WORKSPACE = ORIGINAL_ENV
  rmSync(TMP_WORKSPACE, { recursive: true, force: true })
})

const { executeBash } = await import('../src/runtime/bash.ts')

describe('executeBash', () => {
  test('captures stdout from a simple command', async () => {
    const r = await executeBash({ command: 'echo hello' })
    expect(r.exitCode).toBe(0)
    expect(r.stdout.trim()).toBe('hello')
    expect(r.stderr).toBe('')
    expect(r.timedOut).toBe(false)
  })

  test('captures stderr and a non-zero exit code', async () => {
    const r = await executeBash({ command: 'echo oops 1>&2 ; exit 7' })
    expect(r.exitCode).toBe(7)
    expect(r.stderr.trim()).toBe('oops')
  })

  test('runs in the sandbox cwd', async () => {
    writeFileSync(join(TMP_WORKSPACE, 'marker.txt'), 'present')
    const r = await executeBash({ command: 'cat marker.txt' })
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toBe('present')
  })

  test('honors a tight timeout', async () => {
    const r = await executeBash({ command: 'sleep 5', timeoutMs: 200 })
    expect(r.timedOut).toBe(true)
    expect(r.exitCode).not.toBe(0)
  })
})
