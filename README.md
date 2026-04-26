<div align="center">

  <img src="./assets/agent-forge.png" alt="Agent Forge" width="100%">

  <br/>

  **Forge, run, and orchestrate sandboxed LLM agents.**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
  ![Status: P1 done](https://img.shields.io/badge/status-P1%20done-green)
  ![Stack: TypeScript + Bun](https://img.shields.io/badge/stack-TypeScript_+_Bun-3178c6)

  🇬🇧 English version · [🇫🇷 Version française](./README.fr.md)

</div>

---

> 🚧 **Status — Early POC.** Architecture complete, interactive mockup runnable, **first milestone (P1 — *Hello agent in Docker*) lands : a host script orchestrates a Docker container running an LLM round-trip end-to-end.** Next milestone : P2 — Conversational CLI. Star the repo to follow along.

## What is Agent Forge ?

A conversational CLI that lets you **describe** a software project in natural language and watch a team of specialized LLM agents **build it** — each agent isolated in a Docker container, coordinating via [`claude-presence`](https://github.com/garniergeorges/claude-presence), with a pixel-art visualization in your terminal.

<div align="center">
  <img src="./assets/agent-forge.gif" alt="Agent Forge demo" width="80%">
</div>

## Status

🚧 **Phase POC, P1 done.**

A complete interactive mockup exists (`demo-sprites/`), the architecture is fully scaffolded, and the first milestone (P1 — *Hello agent in Docker*) is runnable end-to-end : a host script spins up a Docker container, feeds it a prompt, and prints the LLM response. Next : P2 — Conversational CLI.

## Try the mockup

```bash
node demo-sprites/forge-mockup-v3.mjs
```

Walks through the 7 screens of the product : splash, welcome, chat, mission control, focus, hangar, completion. **No real LLM calls** — scripted demo for UX validation.

Press `SPACE` to advance, `B` to go back, `R` to restart.

## Try P1 — *Hello agent in Docker*

The first runnable milestone : a host script launches a Docker container, mounts a minimal Node runtime inside it, pipes a prompt through stdin, and prints the LLM response back.

### Prerequisites

- **Docker** running (Docker Desktop, OrbStack, or `colima`)
- **Bun** ≥ 1.1 — `curl -fsSL https://bun.sh/install | bash`
- **An OpenAI-compatible LLM endpoint reachable from the container.** The default points at a local [MLX](https://github.com/ml-explore/mlx) server, which is free to run on Apple Silicon Macs. Any other OpenAI-compatible endpoint (Ollama, OpenAI cloud, vLLM, …) works by overriding two env vars — see below.

### Default path : local MLX server (Apple Silicon, free)

```bash
# 1. Install MLX-LM in an isolated venv (one-time)
python3 -m venv ~/.agent-forge/mlx-venv
~/.agent-forge/mlx-venv/bin/pip install mlx-lm

# 2. Pull a small instruction-tuned model (~2 GB, one-time)
~/.agent-forge/mlx-venv/bin/hf download mlx-community/Llama-3.2-3B-Instruct-4bit

# 3. Start the MLX HTTP server (keep this running in a terminal)
~/.agent-forge/mlx-venv/bin/mlx_lm.server \
  --model mlx-community/Llama-3.2-3B-Instruct-4bit \
  --port 8080
```

In another terminal :

```bash
# 4. Build the base Docker image (one-time, ~600 MB, ~1 min)
bash scripts/docker/build-base.sh

# 5. Install JS deps and build the runtime bundle
bun install
cd packages/runtime && bun run build && cd -

# 6. Run the round-trip
bun run poc:p1
```

Expected output :

```
Containers at sea
Docker's gentle guiding hand
Freedom in the code
```

The container is removed automatically (`--rm`), even on Ctrl+C or timeout.

### Alternative : OpenAI cloud (or any OpenAI-compatible endpoint)

```bash
FORGE_BASE_URL=https://api.openai.com/v1 \
FORGE_API_KEY=sk-... \
FORGE_MODEL=gpt-4o-mini \
bun run poc:p1
```

Same script, different endpoint. The runtime is provider-agnostic via the [Vercel AI SDK](https://sdk.vercel.ai).

### Troubleshooting

The script runs three preflight checks and tells you exactly what to fix :

```
✗ Docker daemon is not reachable.
  Start Docker Desktop (or `colima start`) and try again.

✗ Image agent-forge/base:latest is not built locally.
  Run: bash scripts/docker/build-base.sh

✗ Runtime bundle missing: …/packages/runtime/dist/runtime.mjs
  Run: cd packages/runtime && bun run build
```

## Concept

Agent Forge unifies five primitives :

1. **Conversational CLI** — a builder LLM you dialogue with
2. **Skills** — modular instructions invocable on demand
3. **Tools** — native or MCP capabilities your agent can call
4. **MCP** — extensibility via Model Context Protocol
5. **Multi-agent teams** — coordinated agents in a shared Docker sandbox

Every agent runs in an isolated Docker container with strict resource limits, network policy, and read-only root filesystem. Inter-agent coordination uses [`claude-presence`](https://github.com/garniergeorges/claude-presence) MCP (broadcast + advisory locks).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HOST                                                       │
│                                                             │
│  forge CLI (= the builder LLM)                              │
│    ├─ skills internes                                       │
│    ├─ tools (Docker, Files)                                 │
│    └─ orchestrates                                          │
└────────────────────┬────────────────────────────────────────┘
                     │ docker run
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  CONTAINER (per team)                                       │
│  agent-forge/fullstack:latest                               │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ backend  │  │ frontend │  │ qa       │                   │
│  │ Process  │  │ Process  │  │ Process  │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       └─── claude-presence MCP ───┘                         │
│                                                             │
│  /workspace/  shared filesystem                             │
└─────────────────────────────────────────────────────────────┘
```

## Tech stack

- **TypeScript** + **Bun** runtime
- **Ink** (React for terminals) for the TUI
- `@anthropic-ai/sdk` — LLM provider
- `@modelcontextprotocol/sdk` — MCP integration
- `dockerode` — Docker control
- `zod` — schema validation
- Apache 2.0 license

## Repository structure

```
agent-forge/
├── packages/
│   ├── core/             # builder LLM, Docker, tool interface, types
│   ├── cli/              # the `forge` binary
│   ├── runtime/          # runs inside the container
│   └── tools-core/       # native tools (Bash, Read, Edit, ...)
├── docker/               # Dockerfiles (base, fullstack)
├── examples/             # sample teams and agents
├── docs/                 # architecture docs
├── scripts/              # build/CI helpers
├── demo-sprites/         # interactive mockup (already runnable)
└── assets/               # README images
```

## Roadmap (POC)

```
P1  Hello agent in Docker
P2  Conversational CLI (minimal)
P3  Builder launches the agent it just designed
P4  Native tools (Bash, FileRead, FileEdit, FileWrite, Grep, Glob)
P5  Hardened sandbox + artifact extraction
P6  Builder skills enriched
P7  TEAM.md (multi-agent coordination)
P8  Pixel-art TUI dashboard
P9  ★ POC validated : Next.js + Laravel + QA demo works end-to-end
```

After POC :

```
V1  WebSocket API server
V2  Auth + state persistence
V3  Python SDK on PyPI
V4  Multi-tenant (if needed)
V5  MCP server adapter
V6  Release 1.0
```

## Genesis

This project's architecture was informed by a public technical analysis of an existing reference coding-agent. The analysis (~6 400 lines, 13 documents) extracted patterns worth keeping and pitfalls to avoid. **No code was copied** — only architectural patterns inspired the design.

## Contributing

Project is in active design phase. Feedback and ideas welcome via [issues](https://github.com/garniergeorges/agent-forge/issues). Code contributions will open after the P1 milestone lands.

## License

[Apache 2.0](./LICENSE) — Copyright 2026 Georges Garnier

## Author

[@garniergeorges](https://github.com/garniergeorges)
