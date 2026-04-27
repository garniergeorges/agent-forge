// Schema and parser tests for AGENT.md.

import { describe, expect, test } from 'bun:test'
import {
  AgentMdError,
  SANDBOX_DEFAULTS,
  applySandboxDefaults,
  parseAgentMd,
} from '../src/types/agent-md.ts'

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

  test('parses the new hardening fields when present', () => {
    const hardened = valid.replace(
      'sandbox:\n  image: agent-forge/base:latest\n  timeout: 60s',
      [
        'sandbox:',
        '  image: agent-forge/base:latest',
        '  timeout: 60s',
        '  network: bridge',
        '  readOnlyRoot: false',
        '  user: agent',
        '  resources:',
        '    memory: 1g',
        '    cpus: 2',
        '    pidsLimit: 256',
      ].join('\n'),
    )
    const result = parseAgentMd(hardened)
    expect(result.meta.sandbox.network).toBe('bridge')
    expect(result.meta.sandbox.readOnlyRoot).toBe(false)
    expect(result.meta.sandbox.user).toBe('agent')
    expect(result.meta.sandbox.resources?.memory).toBe('1g')
    expect(result.meta.sandbox.resources?.cpus).toBe(2)
    expect(result.meta.sandbox.resources?.pidsLimit).toBe(256)
  })

  test('rejects an invalid network value', () => {
    const bad = valid.replace(
      'timeout: 60s',
      'timeout: 60s\n  network: open',
    )
    expect(() => parseAgentMd(bad)).toThrow(/network/)
  })

  test('rejects malformed memory string', () => {
    const bad = valid.replace(
      'timeout: 60s',
      'timeout: 60s\n  resources:\n    memory: lots',
    )
    expect(() => parseAgentMd(bad)).toThrow(/memory/)
  })
})

describe('applySandboxDefaults', () => {
  test('fills every missing field with the strict default', () => {
    const result = applySandboxDefaults({ image: 'agent-forge/base:latest' })
    expect(result.image).toBe('agent-forge/base:latest')
    expect(result.network).toBe(SANDBOX_DEFAULTS.network)
    expect(result.readOnlyRoot).toBe(SANDBOX_DEFAULTS.readOnlyRoot)
    expect(result.user).toBe(SANDBOX_DEFAULTS.user)
    expect(result.memory).toBe(SANDBOX_DEFAULTS.memory)
    expect(result.cpus).toBe(SANDBOX_DEFAULTS.cpus)
    expect(result.pidsLimit).toBe(SANDBOX_DEFAULTS.pidsLimit)
  })

  test('keeps caller overrides intact', () => {
    const result = applySandboxDefaults({
      image: 'custom:latest',
      network: 'bridge',
      readOnlyRoot: false,
      resources: { memory: '2g', cpus: 4 },
    })
    expect(result.network).toBe('bridge')
    expect(result.readOnlyRoot).toBe(false)
    expect(result.memory).toBe('2g')
    expect(result.cpus).toBe(4)
    expect(result.pidsLimit).toBe(SANDBOX_DEFAULTS.pidsLimit)
  })
})
