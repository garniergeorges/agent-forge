// Schema and parser tests for SKILL.md.

import { describe, expect, test } from 'bun:test'
import { SkillMdError, parseSkillMd } from '../src/types/skill-md.ts'

describe('parseSkillMd', () => {
  test('parses a minimal valid skill', () => {
    const md = `---
name: scaffold-and-run
description: Create then run in one turn.
---

Body goes here.`
    const r = parseSkillMd(md)
    expect(r.meta.name).toBe('scaffold-and-run')
    expect(r.meta.description).toBe('Create then run in one turn.')
    expect(r.meta.triggers).toEqual([])
    expect(r.meta.actions).toEqual([])
    expect(r.body).toBe('Body goes here.')
  })

  test('parses triggers and actions arrays', () => {
    const md = `---
name: x
description: y
triggers:
  - audite
  - test
actions:
  - write
  - run
---

body`
    const r = parseSkillMd(md)
    expect(r.meta.triggers).toEqual(['audite', 'test'])
    expect(r.meta.actions).toEqual(['write', 'run'])
  })

  test('rejects a non kebab-case name', () => {
    const md = `---
name: ScaffoldAndRun
description: invalid
---

body`
    expect(() => parseSkillMd(md)).toThrow(SkillMdError)
  })

  test('rejects missing frontmatter', () => {
    expect(() => parseSkillMd('# no frontmatter')).toThrow(SkillMdError)
  })

  test('rejects an unknown action tag', () => {
    const md = `---
name: x
description: y
actions:
  - bogus
---

body`
    expect(() => parseSkillMd(md)).toThrow(SkillMdError)
  })
})
