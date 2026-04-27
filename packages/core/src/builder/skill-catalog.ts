// Skill catalog — discovers SKILL.md files from two sources :
//
//   1. Built-in : packages/core/src/builder/skills/*.md, shipped with
//      the package. Resolved relative to import.meta.url so it works
//      both in dev (TS through Bun) and in a built bundle (the .md
//      files are copied next to the runtime source).
//
//   2. User : ~/.agent-forge/skills/<name>.md or <name>/SKILL.md.
//      Read at startup ; future revisions can add a /skills reload
//      slash command.
//
// Loading is lazy in the body sense : the catalog only carries the
// metadata (name + description + triggers). The body is kept on the
// SkillEntry too, but the LLM does NOT see it until it explicitly
// emits a forge:skill block — the CLI then injects the body into
// the conversation. This avoids paying tokens for skills the user
// never triggers.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type ParsedSkillMd,
  SkillMdError,
  parseSkillMd,
} from '../types/skill-md.ts'

export type SkillEntry = {
  name: string
  description: string
  triggers: string[]
  actions: ParsedSkillMd['meta']['actions']
  body: string
  source: 'builtin' | 'user'
  filePath: string
}

const BUILTIN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'skills')
const USER_DIR = join(homedir(), '.agent-forge', 'skills')

function readSkillFile(filePath: string, source: SkillEntry['source']): SkillEntry | null {
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
  let parsed: ParsedSkillMd
  try {
    parsed = parseSkillMd(raw)
  } catch (err) {
    if (err instanceof SkillMdError) {
      console.error(`✗ skill ${filePath} : ${err.message}`)
      return null
    }
    throw err
  }
  return {
    name: parsed.meta.name,
    description: parsed.meta.description,
    triggers: parsed.meta.triggers,
    actions: parsed.meta.actions,
    body: parsed.body,
    source,
    filePath,
  }
}

function collectFromDir(dir: string, source: SkillEntry['source']): SkillEntry[] {
  if (!existsSync(dir)) return []
  const out: SkillEntry[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    let st: ReturnType<typeof statSync>
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isFile() && entry.endsWith('.md')) {
      const skill = readSkillFile(full, source)
      if (skill) out.push(skill)
    } else if (st.isDirectory()) {
      // Convention : <name>/SKILL.md so users can group assets next to
      // their skill (templates, examples, etc.).
      const inner = join(full, 'SKILL.md')
      if (existsSync(inner)) {
        const skill = readSkillFile(inner, source)
        if (skill) out.push(skill)
      }
    }
  }
  return out
}

export type SkillCatalog = {
  skills: SkillEntry[]
  byName: Map<string, SkillEntry>
}

export function loadSkillCatalog(): SkillCatalog {
  const builtins = collectFromDir(BUILTIN_DIR, 'builtin')
  const users = collectFromDir(USER_DIR, 'user')

  // User skills take precedence on name collision so users can
  // override a built-in by writing their own.
  const merged = new Map<string, SkillEntry>()
  for (const s of builtins) merged.set(s.name, s)
  for (const s of users) merged.set(s.name, s)

  const skills = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
  return { skills, byName: merged }
}
