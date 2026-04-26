// Parser tests for the text-structured action protocol.

import { describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'bun:test'
import { executeAction, findActionBlocks } from '../src/builder-actions.ts'

const TEST_AGENT = `agent-test-${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`
const TEST_DIR = join(homedir(), '.agent-forge', 'agents', TEST_AGENT)

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('findActionBlocks', () => {
  test('parses a single valid block', () => {
    const md = `Sure, here is the agent :

\`\`\`forge:write
path: agents/haiku-writer/AGENT.md
---
---
name: haiku-writer
description: writes haiku
sandbox:
  image: agent-forge/base:latest
  timeout: 60s
maxTurns: 1
---

You are a poet.
\`\`\`

Confirm to proceed.`
    const blocks = findActionBlocks(md)
    expect(blocks.length).toBe(1)
    const first = blocks[0]
    expect(first?.ok).toBe(true)
    if (first?.ok) {
      expect(first.action.path).toBe('agents/haiku-writer/AGENT.md')
      expect(first.action.content).toContain('name: haiku-writer')
      expect(first.action.content).toContain('You are a poet.')
    }
  })

  test('reports a malformed block (missing path/---)', () => {
    const md = "\`\`\`forge:write\nno path here\n\`\`\`"
    const blocks = findActionBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0]?.ok).toBe(false)
  })

  test('returns empty when no block', () => {
    expect(findActionBlocks('hello world').length).toBe(0)
  })

  test('parses multiple blocks', () => {
    const md = `\`\`\`forge:write
path: a.md
---
A
\`\`\`

and

\`\`\`forge:write
path: b.md
---
B
\`\`\``
    const blocks = findActionBlocks(md)
    expect(blocks.length).toBe(2)
    expect(blocks.every((b) => b.ok)).toBe(true)
  })
})

describe('executeAction (path coercion + agent validation)', () => {
  const validFrontmatter = `---
name: ${TEST_AGENT}
description: A test agent.
sandbox:
  image: agent-forge/base:latest
  timeout: 60s
maxTurns: 1
---

# test

You are a test agent.`

  test('coerces agents/<name>/<wrong>.md to AGENT.md', () => {
    const exec = executeAction({
      path: `agents/${TEST_AGENT}/${TEST_AGENT}.md`,
      content: validFrontmatter,
      raw: '',
    })
    expect(exec.path).toBe(`agents/${TEST_AGENT}/AGENT.md`)
    expect(exec.result.ok).toBe(true)
    if (exec.result.ok) {
      expect(exec.result.absolutePath).toMatch(/AGENT\.md$/)
    }
  })

  test('rejects an invalid AGENT.md (missing required fields)', () => {
    const exec = executeAction({
      path: `agents/${TEST_AGENT}/AGENT.md`,
      content: '# just a title',
      raw: '',
    })
    expect(exec.result.ok).toBe(false)
  })

  test('normalizes a missing leading --- in frontmatter', () => {
    const noOpener = `name: ${TEST_AGENT}
description: A test.
sandbox:
  image: agent-forge/base:latest
  timeout: 60s
maxTurns: 1
---

body`
    const exec = executeAction({
      path: `agents/${TEST_AGENT}/AGENT.md`,
      content: noOpener,
      raw: '',
    })
    expect(exec.result.ok).toBe(true)
  })
})
