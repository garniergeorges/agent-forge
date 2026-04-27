// Catalog loader tests : the built-in scaffold-and-run skill must be
// discoverable, parseable, and the resulting entry must carry name +
// description + triggers + body.

import { describe, expect, test } from 'bun:test'
import { loadSkillCatalog } from '../src/builder/skill-catalog.ts'

describe('loadSkillCatalog', () => {
  test('discovers the built-in scaffold-and-run skill', () => {
    const cat = loadSkillCatalog()
    const s = cat.byName.get('scaffold-and-run')
    expect(s).toBeDefined()
    if (!s) return
    expect(s.source).toBe('builtin')
    expect(s.description.length).toBeGreaterThan(0)
    expect(s.body.length).toBeGreaterThan(0)
    expect(s.triggers.length).toBeGreaterThan(0)
    expect(s.actions).toEqual(expect.arrayContaining(['write', 'run']))
  })

  test('catalog skills are sorted by name', () => {
    const cat = loadSkillCatalog()
    const names = cat.skills.map((s) => s.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })
})
