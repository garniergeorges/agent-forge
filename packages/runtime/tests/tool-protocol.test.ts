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
})
