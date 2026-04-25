# @agent-forge/core

Core primitives for Agent Forge.

## What's inside

- **`builder/`** — the conversational LLM agent that designs other agents
- **`docker/`** — Docker sandbox management (create, start, stop, mount, network)
- **`tools/`** — Tool interface (`Tool<Input, Output, Progress>`)
- **`types/`** — shared TypeScript types

## Status

**Phase POC. Not implemented yet.** See `../../CLAUDE.md` and `../../SESSION-RECAP.md`.

## Dependencies

- `@anthropic-ai/sdk` — LLM provider
- `@modelcontextprotocol/sdk` — MCP integration
- `dockerode` — Docker control from Node
- `zod` — schema validation
- `yaml` — parsing AGENT.md / TEAM.md frontmatter
