// SKILL.md — describes a high-level builder behaviour the LLM can load
// on demand to handle a recurring intent pattern.
//
// Format : Markdown with YAML frontmatter at the top, body below.
// Example :
//
//   ---
//   name: scaffold-and-run
//   description: When the user describes both an agent AND a concrete task in the same message, propose creation AND execution in one turn.
//   triggers:
//     - "audite"
//     - "teste"
//     - "fais que cet agent"
//     - "create and run"
//   actions:
//     - write
//     - run
//   ---
//
//   # scaffold-and-run
//
//   When activated, you must :
//   1. Emit a forge:write block creating the AGENT.md
//   2. In the SAME turn, emit a forge:run block targeting the agent
//      with a prompt that captures the user's intent
//
//   The user will see two PROPOSED cards and approve them in order.
//
// Skills are loaded into the conversation lazily : the system prompt
// only carries the catalog metadata (name + description + triggers).
// The body lands in the context only after the LLM emits a
// forge:skill block, which the CLI executes by injecting the body as
// a system message.

import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/

export const SkillActionTagSchema = z.enum(['write', 'run', 'skill'])
export type SkillActionTag = z.infer<typeof SkillActionTagSchema>

export const SkillMdSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'name must be kebab-case (lowercase, digits, hyphens)'),
  description: z.string().min(1),
  triggers: z.array(z.string().min(1)).default([]),
  actions: z.array(SkillActionTagSchema).default([]),
})

export type SkillMd = z.infer<typeof SkillMdSchema>

export type ParsedSkillMd = {
  meta: SkillMd
  body: string
}

export class SkillMdError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'SkillMdError'
  }
}

export function parseSkillMd(text: string): ParsedSkillMd {
  const match = text.match(FRONTMATTER_RE)
  if (!match) {
    throw new SkillMdError(
      'SKILL.md must start with a YAML frontmatter block delimited by ---',
    )
  }
  const [, yamlText, body] = match
  let parsedYaml: unknown
  try {
    parsedYaml = parseYaml(yamlText ?? '')
  } catch (err) {
    throw new SkillMdError('Invalid YAML in SKILL.md frontmatter', err)
  }
  const result = SkillMdSchema.safeParse(parsedYaml)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first?.path.join('.') ?? '<root>'
    throw new SkillMdError(`Invalid SKILL.md : ${path} — ${first?.message ?? 'unknown error'}`)
  }
  return { meta: result.data, body: (body ?? '').trim() }
}
