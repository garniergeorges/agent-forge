# @agent-forge/core

Primitives de base d'Agent Forge.

## Contenu (état P6)

- **`builder/`** — l'agent LLM conversationnel qui conçoit les autres agents
  - `provider.ts` — résout `FORGE_BASE_URL` / `FORGE_API_KEY` / `FORGE_MODEL`, supporte les overrides à chaud (`/provider`, `/model`)
  - `system-prompt.ts` — prompt système bilingue EN/FR avec ACTION PROTOCOL et RUN PROTOCOL (fenced blocks `forge:write` et `forge:run`), plus la liste informationnelle des skills disponibles
  - `stream.ts` — `streamBuilder({ messages, lang, skills })` via Vercel AI SDK
  - **`skill-catalog.ts`** — discovery des `SKILL.md` (built-in dans `skills/`, utilisateur dans `~/.agent-forge/skills/`)
  - **`skill-matcher.ts`** — match côté serveur des triggers (sous-chaîne insensible à la casse)
  - **`skill-runner.ts`** — orchestration de `scaffold-and-run` (deux appels `generateText` ciblés, un pour AGENT.md, un pour le run prompt)
  - **`skills/scaffold-and-run.md`** — première skill built-in
- **`types/agent-md.ts`** — `parseAgentMd(text)` : sépare frontmatter / body, valide via Zod (name kebab-case, description non vide, sandbox.image, sandbox.timeout, maxTurns). P5 : champs `sandbox.network` (`none` / `bridge`), `sandbox.readOnlyRoot`, `sandbox.user`, `sandbox.resources.{memory, cpus, pidsLimit}`. Helper `applySandboxDefaults()` qui applique les valeurs strictes (`network: none`, `readOnlyRoot: true`, `user: agent`, `512m / 1 cpu / 128 pids`) à tout champ omis.
- **`types/skill-md.ts`** — `parseSkillMd(text)` : même pattern pour les skills (name, description, triggers, actions)

## À venir

- **`docker/`** — abstraction sandbox (P5 : agents persistants via `docker exec`, pas seulement `run --rm`)
- **`tools/`** — interface `Tool<Input, Output, Progress>` partagée

## Dependencies

- `ai`, `@ai-sdk/openai` — Vercel AI SDK pour les appels LLM provider-agnostic
- `zod` — validation du frontmatter `AGENT.md` et `SKILL.md`
- `@modelcontextprotocol/sdk` — intégration MCP (P7+)
- `yaml` — parsing du frontmatter
