// System prompt — verify that the skill catalog is injected when
// provided, and that the prompt stays untouched when the catalog is
// empty.

import { describe, expect, test } from 'bun:test'
import { getBuilderSystemPrompt } from '../src/builder/system-prompt.ts'

describe('getBuilderSystemPrompt', () => {
  test('returns the base prompt when no skills are provided', () => {
    const en = getBuilderSystemPrompt('en')
    expect(en).toContain('Agent Forge builder')
    expect(en).not.toContain('STEP 0 — SKILL CHECK')
  })

  test('prepends a SKILL CHECK preamble when entries are passed', () => {
    const en = getBuilderSystemPrompt('en', {
      skills: [
        {
          name: 'scaffold-and-run',
          description: 'Create then run.',
          triggers: ['audite', 'test'],
        },
      ],
    })
    expect(en).toContain('STEP 0 — SKILL CHECK')
    expect(en).toContain('scaffold-and-run')
    expect(en).toContain('Create then run.')
    expect(en).toContain('"audite", "test"')
    // Preamble must come BEFORE the base prompt so the model reads the
    // skill rule before the "be decisive, write immediately" rule.
    expect(en.indexOf('STEP 0 — SKILL CHECK')).toBeLessThan(
      en.indexOf('Agent Forge builder'),
    )
  })

  test('FR variant uses French headers', () => {
    const fr = getBuilderSystemPrompt('fr', {
      skills: [{ name: 'x', description: 'y', triggers: [] }],
    })
    expect(fr).toContain('ÉTAPE 0 — VÉRIFICATION DE SKILL')
    expect(fr).not.toContain('STEP 0 — SKILL CHECK')
  })
})
