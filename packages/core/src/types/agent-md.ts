// AGENT.md — the central artifact describing one agent.
//
// Format : Markdown with YAML frontmatter at the top, optional body below.
// Example :
//
//   ---
//   name: haiku-writer
//   description: Writes a single haiku about the user's topic.
//   model: mlx-community/Llama-3.2-3B-Instruct-4bit
//   sandbox:
//     image: agent-forge/base:latest
//     timeout: 60s
//   maxTurns: 1
//   ---
//
//   # haiku-writer
//
//   You are a poet. You answer with exactly three lines following the
//   5-7-5 syllable pattern of a haiku.
//
// In P3 the schema is intentionally minimal (single-agent, no tools,
// no MCP, no skills). Those will be re-introduced in later milestones.

import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/

export const AgentSandboxSchema = z.object({
  image: z.string().min(1),
  timeout: z
    .string()
    .regex(/^\d+[smh]$/, 'timeout must look like 30s, 5m, 1h')
    .optional(),
})

export const AgentMdSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'name must be kebab-case (lowercase, digits, hyphens)'),
  description: z.string().min(1),
  model: z.string().min(1).optional(),
  sandbox: AgentSandboxSchema,
  maxTurns: z.number().int().positive().default(1),
})

export type AgentMd = z.infer<typeof AgentMdSchema>

export type ParsedAgentMd = {
  meta: AgentMd
  body: string
}

export class AgentMdError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AgentMdError'
  }
}

export function parseAgentMd(text: string): ParsedAgentMd {
  const match = text.match(FRONTMATTER_RE)
  if (!match) {
    throw new AgentMdError(
      'AGENT.md must start with a YAML frontmatter block delimited by ---',
    )
  }
  const [, yamlText, body] = match
  let parsedYaml: unknown
  try {
    parsedYaml = parseYaml(yamlText ?? '')
  } catch (err) {
    throw new AgentMdError('Invalid YAML in frontmatter', err)
  }
  const result = AgentMdSchema.safeParse(parsedYaml)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first?.path.join('.') ?? '<root>'
    throw new AgentMdError(`Invalid AGENT.md : ${path} — ${first?.message ?? 'unknown error'}`)
  }
  return { meta: result.data, body: (body ?? '').trim() }
}
