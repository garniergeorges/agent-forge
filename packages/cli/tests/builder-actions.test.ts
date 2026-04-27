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

describe('findActionBlocks (write)', () => {
  test('parses a single valid write block', () => {
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
    if (first?.ok && first.action.kind === 'write') {
      expect(first.action.path).toBe('agents/haiku-writer/AGENT.md')
      expect(first.action.content).toContain('name: haiku-writer')
      expect(first.action.content).toContain('You are a poet.')
    }
  })

  test('reports a malformed write block (missing path/---)', () => {
    const md = "\`\`\`forge:write\nno path here\n\`\`\`"
    const blocks = findActionBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0]?.ok).toBe(false)
  })

  test('returns empty when no block', () => {
    expect(findActionBlocks('hello world').length).toBe(0)
  })

  test('parses multiple write blocks', () => {
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

describe('findActionBlocks (run)', () => {
  test('parses a single valid run block', () => {
    const md = `Lancement :

\`\`\`forge:run
agent: haiku-writer
---
écris un haiku sur Docker
\`\`\``
    const blocks = findActionBlocks(md)
    expect(blocks.length).toBe(1)
    const first = blocks[0]
    expect(first?.ok).toBe(true)
    if (first?.ok && first.action.kind === 'run') {
      expect(first.action.agent).toBe('haiku-writer')
      expect(first.action.prompt).toBe('écris un haiku sur Docker')
    }
  })

  test('rejects run with non-kebab-case agent name', () => {
    const md = `\`\`\`forge:run
agent: HaikuWriter
---
hello
\`\`\``
    const blocks = findActionBlocks(md)
    expect(blocks[0]?.ok).toBe(false)
  })

  test('rejects run with empty prompt', () => {
    const md = `\`\`\`forge:run
agent: haiku-writer
---

\`\`\``
    const blocks = findActionBlocks(md)
    expect(blocks[0]?.ok).toBe(false)
  })

  test('parses mixed write + run in the same message', () => {
    const md = `\`\`\`forge:write
path: agents/foo/AGENT.md
---
content
\`\`\`

\`\`\`forge:run
agent: foo
---
prompt
\`\`\``
    const blocks = findActionBlocks(md)
    expect(blocks.length).toBe(2)
    expect(blocks[0]?.ok).toBe(true)
    expect(blocks[1]?.ok).toBe(true)
    if (blocks[0]?.ok) expect(blocks[0].action.kind).toBe('write')
    if (blocks[1]?.ok) expect(blocks[1].action.kind).toBe('run')
  })
})

describe('findActionBlocks (skill)', () => {
  test('parses a forge:skill block with name: prefix', () => {
    const md = `OK je charge une skill :

\`\`\`forge:skill
name: scaffold-and-run
\`\`\``
    const blocks = findActionBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0]?.ok).toBe(true)
    if (blocks[0]?.ok && blocks[0].action.kind === 'skill') {
      expect(blocks[0].action.skill).toBe('scaffold-and-run')
    }
  })

  test('parses a forge:skill block with bare name', () => {
    const md = `\`\`\`forge:skill
scaffold-and-run
\`\`\``
    const blocks = findActionBlocks(md)
    expect(blocks[0]?.ok).toBe(true)
    if (blocks[0]?.ok && blocks[0].action.kind === 'skill') {
      expect(blocks[0].action.skill).toBe('scaffold-and-run')
    }
  })

  test('rejects skill with non-kebab-case name', () => {
    const md = `\`\`\`forge:skill
name: ScaffoldAndRun
\`\`\``
    const blocks = findActionBlocks(md)
    expect(blocks[0]?.ok).toBe(false)
  })

  test('executeAction(skill) resolves the body via the resolver', () => {
    const exec = executeAction(
      { kind: 'skill', skill: 'scaffold-and-run', raw: '' },
      { resolveSkill: (name) => (name === 'scaffold-and-run' ? 'BODY' : null) },
    )
    expect(exec.kind).toBe('skill')
    if (exec.kind === 'skill') {
      expect(exec.result.ok).toBe(true)
      if (exec.result.ok) expect(exec.result.body).toBe('BODY')
    }
  })

  test('executeAction(skill) errors when resolver returns null', () => {
    const exec = executeAction(
      { kind: 'skill', skill: 'unknown', raw: '' },
      { resolveSkill: () => null },
    )
    expect(exec.kind).toBe('skill')
    if (exec.kind === 'skill') {
      expect(exec.result.ok).toBe(false)
    }
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
      kind: 'write',
      path: `agents/${TEST_AGENT}/${TEST_AGENT}.md`,
      content: validFrontmatter,
      raw: '',
    })
    expect(exec.kind).toBe('write')
    if (exec.kind === 'write') {
      expect(exec.path).toBe(`agents/${TEST_AGENT}/AGENT.md`)
      expect(exec.result.ok).toBe(true)
      if (exec.result.ok) {
        expect(exec.result.absolutePath).toMatch(/AGENT\.md$/)
      }
    }
  })

  test('rejects an invalid AGENT.md (missing required fields)', () => {
    const exec = executeAction({
      kind: 'write',
      path: `agents/${TEST_AGENT}/AGENT.md`,
      content: '# just a title',
      raw: '',
    })
    expect(exec.kind).toBe('write')
    if (exec.kind === 'write') expect(exec.result.ok).toBe(false)
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
      kind: 'write',
      path: `agents/${TEST_AGENT}/AGENT.md`,
      content: noOpener,
      raw: '',
    })
    expect(exec.kind).toBe('write')
    if (exec.kind === 'write') expect(exec.result.ok).toBe(true)
  })

  test('quotes a description that contains an unquoted colon', () => {
    const unsafe = `---
name: ${TEST_AGENT}
description: Audits the project. Step 1: list files. Step 2: fix TODOs.
sandbox:
  image: agent-forge/base:latest
  timeout: 60s
maxTurns: 1
---

body`
    const exec = executeAction({
      kind: 'write',
      path: `agents/${TEST_AGENT}/AGENT.md`,
      content: unsafe,
      raw: '',
    })
    expect(exec.kind).toBe('write')
    if (exec.kind === 'write') expect(exec.result.ok).toBe(true)
  })

  test('leaves an already-quoted description untouched', () => {
    const safe = `---
name: ${TEST_AGENT}
description: "Step 1: do this. Step 2: do that."
sandbox:
  image: agent-forge/base:latest
  timeout: 60s
maxTurns: 1
---

body`
    const exec = executeAction({
      kind: 'write',
      path: `agents/${TEST_AGENT}/AGENT.md`,
      content: safe,
      raw: '',
    })
    expect(exec.kind).toBe('write')
    if (exec.kind === 'write') expect(exec.result.ok).toBe(true)
  })

  test('run action passes through pre-flight (actual launch is async)', () => {
    const exec = executeAction({
      kind: 'run',
      agent: 'haiku-writer',
      prompt: 'hello',
      raw: '',
    })
    expect(exec.kind).toBe('run')
    if (exec.kind === 'run') {
      expect(exec.agent).toBe('haiku-writer')
      expect(exec.result.ok).toBe(true)
    }
  })
})
