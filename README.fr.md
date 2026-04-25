<div align="center">

  <img src="./assets/agent-forge.png" alt="Agent Forge" width="100%">

  <br/>

  **Forgez, lancez et orchestrez des agents LLM en sandbox.**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
  ![Status: POC](https://img.shields.io/badge/status-POC-orange)
  ![Stack: TypeScript + Bun](https://img.shields.io/badge/stack-TypeScript_+_Bun-3178c6)

  🇫🇷 Version française · [🇬🇧 English version](./README.md)

</div>

---

> 🚧 **Statut — Phase de conception.** L'architecture est posée, le mockup interactif est fonctionnel. **Pas encore de code de production.** Le premier jalon exécutable (P1 — *Hello agent in Docker*) est le prochain livrable. Mettez une ⭐ pour suivre l'évolution.

## Qu'est-ce qu'Agent Forge ?

Une CLI conversationnelle qui vous permet de **décrire** un projet logiciel en langage naturel et regarder une équipe d'agents LLM spécialisés le **construire** — chaque agent isolé dans un container Docker, coordonnés via [`claude-presence`](https://github.com/garniergeorges/claude-presence), avec une visualisation pixel art directement dans votre terminal.

<div align="center">
  <img src="./assets/agent-forge.gif" alt="Démo Agent Forge" width="80%">
</div>

## Statut

🚧 **Phase POC.** Phase de conception active. **Pas encore de code de production.**

Un mockup interactif complet existe (`demo-sprites/`), et l'architecture est entièrement préparée. Le premier jalon exécutable (P1 — *Hello agent in Docker*) arrive ensuite.

## Tester le mockup

```bash
node demo-sprites/forge-mockup-v3.mjs
```

Parcourt les 7 écrans du produit : splash, welcome, chat, mission control, focus, hangar, completion. **Aucun appel LLM réel** — démo scriptée pour la validation UX.

Appuyez sur `SPACE` pour avancer, `B` pour reculer, `R` pour redémarrer.

## Concept

Agent Forge unifie cinq primitives :

1. **CLI conversationnelle** — un builder LLM avec qui dialoguer
2. **Skills** — instructions modulaires invocables à la demande
3. **Tools** — capacités natives ou MCP appelables par l'agent
4. **MCP** — extensibilité via Model Context Protocol
5. **Teams multi-agents** — agents coordonnés dans une sandbox Docker partagée

Chaque agent tourne dans un container Docker isolé avec des limites de ressources strictes, une politique réseau, et un filesystem racine en lecture seule. La coordination inter-agents utilise [`claude-presence`](https://github.com/garniergeorges/claude-presence) MCP (broadcast + verrous coopératifs).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HOST                                                       │
│                                                             │
│  forge CLI (= le builder LLM)                               │
│    ├─ skills internes                                       │
│    ├─ tools (Docker, Files)                                 │
│    └─ orchestre                                             │
└────────────────────┬────────────────────────────────────────┘
                     │ docker run
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  CONTAINER (un par team)                                    │
│  agent-forge/fullstack:latest                               │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ backend  │  │ frontend │  │ qa       │                   │
│  │ Process  │  │ Process  │  │ Process  │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       └─── claude-presence MCP ───┘                         │
│                                                             │
│  /workspace/  filesystem partagé                            │
└─────────────────────────────────────────────────────────────┘
```

## Stack technique

- **TypeScript** + runtime **Bun**
- **Ink** (React pour terminaux) pour la TUI
- `@anthropic-ai/sdk` — fournisseur LLM
- `@modelcontextprotocol/sdk` — intégration MCP
- `dockerode` — contrôle Docker
- `zod` — validation de schémas
- Licence Apache 2.0

## Structure du repo

```
agent-forge/
├── packages/
│   ├── core/             # builder LLM, Docker, interface tools, types
│   ├── cli/              # le binaire `forge`
│   ├── runtime/          # tourne dans le container
│   └── tools-core/       # tools natifs (Bash, Read, Edit, ...)
├── docker/               # Dockerfiles (base, fullstack)
├── examples/             # exemples de teams et d'agents
├── docs/                 # documentation d'architecture
├── scripts/              # helpers build/CI
├── demo-sprites/         # mockup interactif (déjà exécutable)
└── assets/               # images du README
```

## Roadmap (POC)

```
P1  Hello agent dans Docker
P2  CLI conversationnelle (minimale)
P3  Le builder lance l'agent qu'il vient de concevoir
P4  Tools natifs (Bash, FileRead, FileEdit, FileWrite, Grep, Glob)
P5  Sandbox durci + extraction des artefacts
P6  Skills builder enrichis
P7  TEAM.md (coordination multi-agents)
P8  Dashboard TUI pixel art
P9  ★ POC validé : démo Next.js + Laravel + QA fonctionnelle de bout en bout
```

Après le POC :

```
V1  Serveur API WebSocket
V2  Auth + persistence d'état
V3  SDK Python sur PyPI
V4  Multi-tenant (si nécessaire)
V5  Adaptateur serveur MCP
V6  Release 1.0
```

## Genèse

L'architecture de ce projet a été informée par une analyse technique publique d'un coding-agent de référence existant. L'analyse (~6 400 lignes, 13 documents) a extrait les patterns à conserver et les pièges à éviter. **Aucun code n'a été copié** — seuls les patterns architecturaux ont inspiré la conception.

## Contribuer

Le projet est en phase de conception active. Les retours et idées sont les bienvenus via les [issues](https://github.com/garniergeorges/agent-forge/issues). Les contributions de code seront ouvertes après la livraison du jalon P1.

## Licence

[Apache 2.0](./LICENSE) — Copyright 2026 Georges Garnier

## Auteur

[@garniergeorges](https://github.com/garniergeorges)
