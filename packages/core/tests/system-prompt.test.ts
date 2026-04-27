// System prompt — verify that the skill catalog is injected when
// provided, and that the prompt stays untouched when the catalog is
// empty.

import { describe, expect, test } from 'bun:test'
import { getBuilderSystemPrompt } from '../src/builder/system-prompt.ts'

describe('getBuilderSystemPrompt', () => {
  test('returns the base prompt when no skills are provided', () => {
    const en = getBuilderSystemPrompt('en')
    expect(en).toContain('Agent Forge builder')
    expect(en).not.toContain('AVAILABLE SKILLS')
  })

  test('appends a SKILLS section when entries are passed', () => {
    const en = getBuilderSystemPrompt('en', {
      skills: [
        {
          name: 'scaffold-and-run',
          description: 'Create then run.',
          triggers: ['audite', 'test'],
        },
      ],
    })
    expect(en).toContain('AVAILABLE SKILLS')
    expect(en).toContain('scaffold-and-run')
    expect(en).toContain('Create then run.')
    expect(en).toContain('audite, test')
  })

  test('FR variant uses French headers', () => {
    const fr = getBuilderSystemPrompt('fr', {
      skills: [{ name: 'x', description: 'y', triggers: [] }],
    })
    expect(fr).toContain('SKILLS DISPONIBLES')
    expect(fr).not.toContain('AVAILABLE SKILLS')
  })
})
