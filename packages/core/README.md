# @agent-forge/core

Primitives de base d'Agent Forge.

## Contenu (état P3)

- **`builder/`** — l'agent LLM conversationnel qui conçoit les autres agents
  - `provider.ts` — résout `FORGE_BASE_URL` / `FORGE_API_KEY` / `FORGE_MODEL`, supporte les overrides à chaud (`/provider`, `/model`)
  - `system-prompt.ts` — prompt système bilingue EN/FR avec ACTION PROTOCOL et RUN PROTOCOL (fenced blocks `forge:write` et `forge:run`)
  - `stream.ts` — `streamBuilder({ messages, lang })` via Vercel AI SDK
- **`types/agent-md.ts`** — `parseAgentMd(text)` : sépare frontmatter / body, valide via Zod (name kebab-case, description non vide, sandbox.image, sandbox.timeout, maxTurns)

## À venir

- **`docker/`** — abstraction sandbox (P5 : agents persistants via `docker exec`, pas seulement `run --rm`)
- **`tools/`** — interface `Tool<Input, Output, Progress>` partagée (P4)

## Dependencies

- `ai`, `@ai-sdk/openai` — Vercel AI SDK pour les appels LLM provider-agnostic
- `zod` — validation du frontmatter `AGENT.md`
- `@modelcontextprotocol/sdk` — intégration MCP (P6+)
- `yaml` — parsing du frontmatter
