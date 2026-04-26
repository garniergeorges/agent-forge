// Schema and parser tests for AGENT.md.

import { describe, expect, test } from 'bun:test'
import { AgentMdError, parseAgentMd } from '../src/types/agent-md.ts'

const valid = `---
name: haiku-writer
description: Writes a single haiku about the user's topic.
model: mlx-community/Llama-3.2-3B-Instruct-4bit
sandbox:
  image: agent-forge/base:latest
  timeout: 60s
maxTurns: 1
---

# haiku-writer

You are a poet.
`

describe('parseAgentMd', () => {
  test('parses a valid AGENT.md', () => {
    const result = parseAgentMd(valid)
    expect(result.meta.name).toBe('haiku-writer')
    expect(result.meta.sandbox.image).toBe('agent-forge/base:latest')
    expect(result.meta.maxTurns).toBe(1)
    expect(result.body).toContain('You are a poet.')
  })

  test('rejects content without frontmatter', () => {
    expect(() => parseAgentMd('# just a title\n')).toThrow(AgentMdError)
  })

  test('rejects invalid YAML', () => {
    expect(() => parseAgentMd('---\nname: : :\n---\n')).toThrow(AgentMdError)
  })

  test('rejects an invalid name (not kebab-case)', () => {
    const bad = valid.replace('name: haiku-writer', 'name: HaikuWriter')
    expect(() => parseAgentMd(bad)).toThrow(/name.*kebab-case/)
  })

  test('rejects a missing required field', () => {
    const bad = valid.replace(/sandbox:[\s\S]+?maxTurns: 1/, 'maxTurns: 1')
    expect(() => parseAgentMd(bad)).toThrow(/sandbox/)
  })

  test('rejects a malformed timeout', () => {
    const bad = valid.replace('timeout: 60s', 'timeout: forever')
    expect(() => parseAgentMd(bad)).toThrow(/timeout/)
  })

  test('defaults maxTurns when omitted', () => {
    const noTurns = valid.replace(/\nmaxTurns: 1/, '')
    const result = parseAgentMd(noTurns)
    expect(result.meta.maxTurns).toBe(1)
  })
})
