<div align="center">

  <img src="./assets/agent-forge.png" alt="Agent Forge" width="100%">

  <br/>

  **Forge, run, and orchestrate sandboxed LLM agents.**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
  ![Status: P3 done](https://img.shields.io/badge/status-P3%20done-green)
  ![Stack: TypeScript + Bun](https://img.shields.io/badge/stack-TypeScript_+_Bun-3178c6)

  🇬🇧 English version · [🇫🇷 Version française](./README.fr.md)

</div>

---

> 🚧 **Status — POC, milestone P3 reached.** You can now `bun run forge`, describe an agent in plain English or French, watch the builder draft the `AGENT.md`, approve it, then ask the builder to run that agent — it spins up its own Docker container, streams the output, and tears the sandbox down. Next milestone : P4 — native tools (Bash, FileRead, FileEdit, FileWrite, Grep, Glob).

## What is Agent Forge ?

A conversational CLI where you **describe** the software you want and a **builder LLM** designs, writes and launches the agents that produce it — each agent isolated in its own Docker container, with a pixel-art TUI built on [Ink](https://github.com/vadimdemedes/ink).

The builder is the only conversational surface. Sub-agents are spawned on demand in disposable sandboxes ; long-running agents and multi-agent teams come later (P5 and P7).

<div align="center">
  <img src="./assets/agent-forge.gif" alt="Agent Forge demo" width="80%">
</div>

## Status — what works today

| Milestone | Scope | State |
|---|---|---|
| **P1** | Hello agent in Docker (host script ↔ container ↔ LLM round-trip) | ✅ done |
| **P2** | Conversational CLI (REPL Ink, EN/FR, slash commands, provider switch) | ✅ done |
| **P3** | Builder writes `AGENT.md`, asks for permission, launches the agent in a fresh container, streams its output | ✅ done |
| P4 | Six native tools (Bash, FileRead, FileEdit, FileWrite, Grep, Glob) usable from inside the sandbox | next |
| P5 | Hardened sandbox + artifact extraction back to host | |
| P6 | Skills enriched (project scaffolding, audits, fixes) | |
| P7 | `TEAM.md` — coordinated multi-agent runs | |
| P8 | Pixel-art dashboard (live agent activity) | |
| P9 | ★ POC validated : Next.js + Laravel + QA demo end-to-end | |

## Quick start

```bash
# 1. Build the base Docker image (one-time, ~600 MB, ~1 min)
bash scripts/docker/build-base.sh

# 2. Install JS deps and build the runtime bundle
bun install
bun run --cwd packages/runtime build

# 3. Configure your LLM provider (cloud — recommended)
cp .env.example .env
# edit .env and set FORGE_API_KEY=…

# 4. Launch the builder REPL
bun run forge
```

On the first run the CLI asks you to pick a language (EN / FR), then drops you into the conversational prompt.

### What the screen looks like

```
 ▌▌ MISSION CONTROL ▐▐    1 action

 ╭──────────────────────────────────────────────────────────────╮
 │  [DONE]  write  agents/haiku-writer/AGENT.md                 │
 │                                                              │
 │      1   ---                                                 │
 │      2   name: haiku-writer                                  │
 │      3   description: Écrit un haïku en 5-7-5.               │
 │      4   sandbox:                                            │
 │      5     image: agent-forge/base:latest                    │
 │      6     timeout: 60s                                      │
 │      7   maxTurns: 1                                         │
 │      8   ---                                                 │
 │      …                                                       │
 │     ✓ written /Users/you/.agent-forge/agents/haiku-writer/…  │
 ╰──────────────────────────────────────────────────────────────╯

                                                            ▀▀▀
                                                            ▀▀▀▀
                                                            ▄ ▄ ▄

 ▌▌ AGENT FORGE ▐▐  v0.0.0  home · new session       session : new · model: mistral-small-latest
 ─────────────────────────────────────────────────────────────────
   ❯ create an agent that writes haikus
   ▸ Done. The agent is forged. Want me to run it ?

 ❯ describe what you want to build…
 [⏎] send  [PgUp/PgDn] scroll  [Ctrl+E] live  [/help] commands
```

The TUI is split in two strict zones :

- **Top zone (Mission Control)** — every concrete action the builder takes. File writes, container launches, agent output. Syntax-highlighted, status-coloured (orange = pending, green = done, red = failed).
- **Bottom zone (Conversation)** — only the natural-language exchange between you and the builder. No code, no logs, no internals.

## Provider configuration

Agent Forge talks to any **OpenAI-compatible** chat endpoint via the [Vercel AI SDK](https://sdk.vercel.ai). Pick what fits.

### Mistral cloud (default — recommended)

Get a key at <https://console.mistral.ai>. The free tier is enough for the POC.

```dotenv
FORGE_BASE_URL=https://api.mistral.ai/v1
FORGE_API_KEY=…
FORGE_MODEL=mistral-small-latest
```

### OpenAI cloud

```dotenv
FORGE_BASE_URL=https://api.openai.com/v1
FORGE_API_KEY=sk-…
FORGE_MODEL=gpt-4o-mini
```

### Local MLX server (Apple Silicon, free, no key)

```bash
python3 -m venv ~/.agent-forge/mlx-venv
~/.agent-forge/mlx-venv/bin/pip install mlx-lm
~/.agent-forge/mlx-venv/bin/hf download mlx-community/Qwen2.5-7B-Instruct-4bit
~/.agent-forge/mlx-venv/bin/mlx_lm.server \
  --model mlx-community/Qwen2.5-7B-Instruct-4bit --port 8080
```

```dotenv
FORGE_BASE_URL=http://host.docker.internal:8080/v1
FORGE_MODEL=mlx-community/Qwen2.5-7B-Instruct-4bit
```

You can also switch on the fly inside the REPL : `/provider mistral`, `/model mistral-large-latest`, `/provider mlx`.

## A typical session

1. **Describe** — `> create an agent that writes haikus on a given topic`
2. **Approve** — the builder drafts an `AGENT.md`, Mission Control shows it, a permission dialog asks `[Y] approve  [N] decline  [D] preview`. Press `Y`.
3. **Run** — `> run haiku-writer on Docker`. Same dialog, same `Y`.
4. **Watch** — Mission Control streams the container output live, the badge flips to `[DONE]`, the container is removed (`docker run --rm`).

Every session is persisted to `~/.agent-forge/sessions/<id>/transcript.jsonl`. Use `/sessions` to list, `/session` to show the current id.

## Useful slash commands

```
/help                show all commands
/clear               clear the view (LLM context kept)
/reset               clear view AND LLM context
/lang en|fr          switch UI language
/provider <name>     mlx | openai | anthropic | mistral
/model <name>        switch model on the active provider
/session             show the current session id
/sessions            list persisted sessions
/exit                quit
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HOST                                                       │
│                                                             │
│  forge CLI (= the builder LLM)                              │
│    ├─ Ink TUI (Mission Control + conversation)              │
│    ├─ AGENT.md parser (Zod-validated frontmatter)           │
│    ├─ FileWrite tool (sandboxed under ~/.agent-forge)       │
│    └─ DockerLaunch tool (spawns one-shot containers)        │
└────────────────────┬────────────────────────────────────────┘
                     │ docker run --rm -i
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  CONTAINER (one per agent run, disposable)                  │
│  agent-forge/base:latest                                    │
│                                                             │
│  Node runtime ── reads /agent/AGENT.md as system prompt     │
│              └─ pipes the user prompt through stdin         │
│              └─ streams the LLM answer to stdout            │
└─────────────────────────────────────────────────────────────┘
```

Long-running agents (`docker exec`) and multi-agent teams (one container, many processes coordinating via [`claude-presence`](https://github.com/garniergeorges/claude-presence)) land in P5 and P7.

## Tech stack

- **TypeScript** + **Bun** runtime + **Bun workspaces**
- **Ink** (React for terminals) for the TUI
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai`) — provider-agnostic LLM calls
- `zod` — `AGENT.md` frontmatter validation
- `docker` CLI via `child_process.spawn` (Bun + dockerode hangs on attach)
- `biome` for lint/format
- Apache 2.0 license

## Repository structure

```
agent-forge/
├── packages/
│   ├── core/             # builder LLM, AGENT.md schema, provider config
│   ├── cli/              # the `forge` binary (Ink REPL + Mission Control)
│   ├── runtime/          # bundle that runs inside each agent container
│   └── tools-core/       # FileWrite, DockerLaunch, …
├── docker/               # Dockerfiles
├── scripts/              # build helpers (docker, hooks)
├── demo-sprites/         # interactive mockup (UX reference)
└── assets/               # README images
```

## Genesis

This project's architecture was informed by a public technical analysis of an existing reference coding-agent. The analysis (~6 400 lines, 13 documents) extracted patterns worth keeping and pitfalls to avoid. **No code was copied** — only architectural patterns inspired the design.

## Contributing

Project is in active POC phase. Feedback and ideas welcome via [issues](https://github.com/garniergeorges/agent-forge/issues). Code contributions will open after the P9 milestone (POC validated).

## License

[Apache 2.0](./LICENSE) — Copyright 2026 Georges Garnier

## Author

[@garniergeorges](https://github.com/garniergeorges)
