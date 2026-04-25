<div align="center">

  <img src="./assets/agent-forge.png" alt="Agent Forge" width="100%">

  <br/>

  **Forge, run, and orchestrate sandboxed LLM agents.**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
  ![Status: POC](https://img.shields.io/badge/status-POC-orange)
  ![Stack: TypeScript + Bun](https://img.shields.io/badge/stack-TypeScript_+_Bun-3178c6)

  🇬🇧 English version · [🇫🇷 Version française](./README.fr.md)

</div>

---

> 🚧 **Status — Design phase.** Architecture is complete, the interactive mockup is runnable. **No production code yet.** First runnable milestone (P1 — *Hello agent in Docker*) is the next deliverable. Star the repo to follow along.

## What is Agent Forge ?

A conversational CLI that lets you **describe** a software project in natural language and watch a team of specialized LLM agents **build it** — each agent isolated in a Docker container, coordinating via [`claude-presence`](https://github.com/garniergeorges/claude-presence), with a pixel-art visualization in your terminal.

<div align="center">
  <img src="./assets/agent-forge.gif" alt="Agent Forge demo" width="80%">
</div>

## Status

🚧 **Phase POC.** Active design phase. **No production code yet.**

A complete interactive mockup exists (`demo-sprites/`), and the architecture is fully scaffolded. The first runnable milestone (P1 — *Hello agent in Docker*) comes next.

## Try the mockup

```bash
node demo-sprites/forge-mockup-v3.mjs
```

Walks through the 7 screens of the product : splash, welcome, chat, mission control, focus, hangar, completion. **No real LLM calls** — scripted demo for UX validation.

Press `SPACE` to advance, `B` to go back, `R` to restart.

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
