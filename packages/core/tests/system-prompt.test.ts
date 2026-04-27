// System prompt — verify that the skill catalog metadata is appended
// when entries are provided (skills are auto-dispatched by the CLI ;
// the LLM only sees them as an informational note).

import { describe, expect, test } from 'bun:test'
import { getBuilderSystemPrompt } from '../src/builder/system-prompt.ts'

describe('getBuilderSystemPrompt', () => {
  test('returns the base prompt when no skills are provided', () => {
    const en = getBuilderSystemPrompt('en')
    expect(en).toContain('Agent Forge builder')
    expect(en).not.toContain('Skills available')
  })

  test('appends an informational skill list when entries are passed', () => {
    const en = getBuilderSystemPrompt('en', {
      skills: [
        {
          name: 'scaffold-and-run',
          description: 'Create then run.',
          triggers: ['audite', 'test'],
        },
      ],
    })
    expect(en).toContain('Skills available')
    expect(en).toContain('auto-dispatched')
    expect(en).toContain('scaffold-and-run')
    expect(en).toContain('Create then run.')
    expect(en).toContain('"audite", "test"')
    // The base prompt comes first ; the skill note is a tail.
    expect(en.indexOf('Agent Forge builder')).toBeLessThan(
      en.indexOf('Skills available'),
    )
  })

  test('FR variant uses French wording', () => {
    const fr = getBuilderSystemPrompt('fr', {
      skills: [{ name: 'x', description: 'y', triggers: [] }],
    })
    expect(fr).toContain('Skills disponibles')
    expect(fr).toContain('automatiquement par la CLI')
  })
})
