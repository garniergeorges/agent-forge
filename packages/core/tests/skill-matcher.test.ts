import { describe, expect, test } from 'bun:test'
import { matchSkillForMessage } from '../src/builder/skill-matcher.ts'
import type { SkillEntry } from '../src/builder/skill-catalog.ts'

const fakeSkill = (
  name: string,
  triggers: string[],
): SkillEntry => ({
  name,
  description: 'desc',
  triggers,
  actions: [],
  body: 'body',
  source: 'builtin',
  filePath: '<test>',
})

describe('matchSkillForMessage', () => {
  test('matches a trigger as case-insensitive substring', () => {
    const skill = fakeSkill('scaffold-and-run', ['audite', 'teste'])
    const r = matchSkillForMessage('Audite ce projet TypeScript stp', [skill])
    expect(r?.name).toBe('scaffold-and-run')
  })

  test('returns null when no trigger matches', () => {
    const skill = fakeSkill('scaffold-and-run', ['audite'])
    const r = matchSkillForMessage('crée un agent qui écrit des haïkus', [skill])
    expect(r).toBeNull()
  })

  test('first skill in the list wins on multi-match', () => {
    const a = fakeSkill('a-skill', ['shared'])
    const b = fakeSkill('b-skill', ['shared'])
    const r = matchSkillForMessage('shared keyword present', [a, b])
    expect(r?.name).toBe('a-skill')
  })

  test('empty trigger is ignored', () => {
    const skill = fakeSkill('x', ['', '   '])
    const r = matchSkillForMessage('anything goes here', [skill])
    expect(r).toBeNull()
  })
})
