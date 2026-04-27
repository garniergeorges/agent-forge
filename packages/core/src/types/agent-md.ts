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

// Resource caps applied via `docker run --memory`, `--cpus`, `--pids-limit`.
// Strict defaults : an agent should never need more than this for the
// kind of small task we run in P5. Authors can relax via AGENT.md when
// a specific job needs it ; the permission dialog surfaces the change.
export const AgentSandboxResourcesSchema = z.object({
  memory: z
    .string()
    .regex(/^\d+[mg]$/i, 'memory must look like 512m, 2g')
    .optional(),
  cpus: z.number().positive().max(8).optional(),
  pidsLimit: z.number().int().positive().max(4096).optional(),
})

export const AgentSandboxSchema = z.object({
  image: z.string().min(1),
  timeout: z
    .string()
    .regex(/^\d+[smh]$/, 'timeout must look like 30s, 5m, 1h')
    .optional(),
  // P5 hardening : isolation knobs the builder can declare per agent.
  // All optional with strict defaults applied at launch time.
  network: z
    .enum(['none', 'bridge'])
    .optional()
    .describe(
      "Network policy. 'none' (default) : no internet. 'bridge' : Docker bridge network, agent can reach the internet — surfaced in the permission dialog as risky.",
    ),
  readOnlyRoot: z
    .boolean()
    .optional()
    .describe(
      'Read-only root filesystem. Default true. /workspace and /tmp stay writable. Disable only for agents that need to install packages on top of the base image (rare).',
    ),
  user: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/i, 'user must be a valid Unix username')
    .optional()
    .describe('Linux user the runtime runs as inside the container. Default "agent" (uid 1000, non-root).'),
  resources: AgentSandboxResourcesSchema.optional(),
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

// Strict defaults applied at launch time when AGENT.md leaves the
// hardening fields off. Centralised here so DockerLaunch and the
// permission dialog read the same source of truth.
export const SANDBOX_DEFAULTS = {
  network: 'none' as const,
  readOnlyRoot: true,
  user: 'agent',
  memory: '512m',
  cpus: 1,
  pidsLimit: 128,
} as const

export type AppliedSandboxConfig = {
  image: string
  network: 'none' | 'bridge'
  readOnlyRoot: boolean
  user: string
  memory: string
  cpus: number
  pidsLimit: number
}

/**
 * Resolve an AGENT.md sandbox block against the strict defaults.
 * Anything not specified by the agent author falls back to the
 * defaults — DockerLaunch can then translate the result directly
 * into `docker run` flags without re-reading the schema.
 */
export function applySandboxDefaults(
  sandbox: AgentMd['sandbox'],
): AppliedSandboxConfig {
  return {
    image: sandbox.image,
    network: sandbox.network ?? SANDBOX_DEFAULTS.network,
    readOnlyRoot: sandbox.readOnlyRoot ?? SANDBOX_DEFAULTS.readOnlyRoot,
    user: sandbox.user ?? SANDBOX_DEFAULTS.user,
    memory: sandbox.resources?.memory ?? SANDBOX_DEFAULTS.memory,
    cpus: sandbox.resources?.cpus ?? SANDBOX_DEFAULTS.cpus,
    pidsLimit: sandbox.resources?.pidsLimit ?? SANDBOX_DEFAULTS.pidsLimit,
  }
}

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
