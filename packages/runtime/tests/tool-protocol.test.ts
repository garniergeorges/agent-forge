// Tests for the agent-side tool block parser. Pure : no FS, no spawn.

import { describe, expect, test } from 'bun:test'
import { parseFirstToolBlock } from '../src/tool-protocol.ts'

describe('parseFirstToolBlock', () => {
  test('returns kind=none on plain text', () => {
    const r = parseFirstToolBlock('just a sentence with no block')
    expect(r.kind).toBe('none')
  })

  test('parses a forge:bash block with prose before it', () => {
    const stream = [
      'I will list the workspace contents.',
      '',
      '```forge:bash',
      '{ "command": "ls -la" }',
      '```',
      '',
      'After the block — should be ignored.',
    ].join('\n')
    const r = parseFirstToolBlock(stream)
    expect(r.kind).toBe('tool')
    if (r.kind === 'tool') {
      expect(r.text.startsWith('I will list')).toBe(true)
      expect(r.tool.kind).toBe('bash')
      if (r.tool.kind === 'bash') expect(r.tool.input.command).toBe('ls -la')
    }
  })

  test('parses a forge:write block', () => {
    const stream = [
      '```forge:write',
      '{ "path": "notes.md", "content": "# hi\\n" }',
      '```',
    ].join('\n')
    const r = parseFirstToolBlock(stream)
    expect(r.kind).toBe('tool')
    if (r.kind === 'tool' && r.tool.kind === 'write') {
      expect(r.tool.input.path).toBe('notes.md')
      expect(r.tool.input.content).toBe('# hi\n')
    }
  })

  test('returns kind=invalid when JSON is malformed', () => {
    const stream = '```forge:bash\n{ not json }\n```'
    const r = parseFirstToolBlock(stream)
    expect(r.kind).toBe('invalid')
    if (r.kind === 'invalid') expect(r.error).toContain('not valid JSON')
  })

  test('returns kind=invalid when schema is wrong', () => {
    const stream = '```forge:bash\n{ "command": "" }\n```'
    const r = parseFirstToolBlock(stream)
    expect(r.kind).toBe('invalid')
    if (r.kind === 'invalid') expect(r.error).toContain('failed validation')
  })

  test('only the first block matters', () => {
    const stream = [
      '```forge:bash',
      '{ "command": "echo a" }',
      '```',
      '```forge:bash',
      '{ "command": "echo b" }',
      '```',
    ].join('\n')
    const r = parseFirstToolBlock(stream)
    expect(r.kind).toBe('tool')
    if (r.kind === 'tool' && r.tool.kind === 'bash') {
      expect(r.tool.input.command).toBe('echo a')
    }
  })

  test('parses forge:read', () => {
    const r = parseFirstToolBlock(
      '```forge:read\n{ "path": "src/x.ts", "offset": 10, "limit": 50 }\n```',
    )
    expect(r.kind).toBe('tool')
    if (r.kind === 'tool' && r.tool.kind === 'read') {
      expect(r.tool.input.path).toBe('src/x.ts')
      expect(r.tool.input.offset).toBe(10)
      expect(r.tool.input.limit).toBe(50)
    }
  })

  test('parses forge:edit', () => {
    const r = parseFirstToolBlock(
      '```forge:edit\n{ "path": "a.ts", "oldString": "x", "newString": "y" }\n```',
    )
    expect(r.kind).toBe('tool')
    if (r.kind === 'tool' && r.tool.kind === 'edit') {
      expect(r.tool.input.oldString).toBe('x')
      expect(r.tool.input.newString).toBe('y')
    }
  })

  test('parses forge:grep', () => {
    const r = parseFirstToolBlock(
      '```forge:grep\n{ "pattern": "TODO", "glob": "**/*.ts", "ignoreCase": true }\n```',
    )
    expect(r.kind).toBe('tool')
    if (r.kind === 'tool' && r.tool.kind === 'grep') {
      expect(r.tool.input.pattern).toBe('TODO')
      expect(r.tool.input.ignoreCase).toBe(true)
    }
  })

  test('parses forge:glob', () => {
    const r = parseFirstToolBlock(
      '```forge:glob\n{ "pattern": "src/**/*.ts" }\n```',
    )
    expect(r.kind).toBe('tool')
    if (r.kind === 'tool' && r.tool.kind === 'glob') {
      expect(r.tool.input.pattern).toBe('src/**/*.ts')
    }
  })

  test('rejects invalid forge:edit (oldString equals newString)', () => {
    const r = parseFirstToolBlock(
      '```forge:edit\n{ "path": "a.ts", "oldString": "x", "newString": "x" }\n```',
    )
    expect(r.kind).toBe('invalid')
  })
})
