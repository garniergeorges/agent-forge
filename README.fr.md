<div align="center">

  <img src="./assets/agent-forge.png" alt="Agent Forge" width="100%">

  <br/>

  **Forgez, lancez et orchestrez des agents LLM en sandbox.**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
  ![Status: P1 done](https://img.shields.io/badge/status-P1%20done-green)
  ![Stack: TypeScript + Bun](https://img.shields.io/badge/stack-TypeScript_+_Bun-3178c6)

  🇫🇷 Version française · [🇬🇧 English version](./README.md)

</div>

---

> 🚧 **Statut — POC précoce.** Architecture posée, mockup interactif fonctionnel, **premier jalon livré (P1 — *Hello agent in Docker*) : un script orchestre un container Docker exécutant un round-trip LLM de bout en bout.** Prochain jalon : P2 — CLI conversationnelle. Mettez une ⭐ pour suivre l'évolution.

## Qu'est-ce qu'Agent Forge ?

Une CLI conversationnelle qui vous permet de **décrire** un projet logiciel en langage naturel et regarder une équipe d'agents LLM spécialisés le **construire** — chaque agent isolé dans un container Docker, coordonnés via [`claude-presence`](https://github.com/garniergeorges/claude-presence), avec une visualisation pixel art directement dans votre terminal.

<div align="center">
  <img src="./assets/agent-forge.gif" alt="Démo Agent Forge" width="80%">
</div>

## Statut

🚧 **Phase POC, P1 terminé.**

Un mockup interactif complet existe (`demo-sprites/`), l'architecture est entièrement préparée, et le premier jalon (P1 — *Hello agent in Docker*) tourne de bout en bout : un script orchestre un container Docker, lui envoie un prompt, et affiche la réponse du LLM. Prochain jalon : P2 — CLI conversationnelle.

## Tester le mockup

```bash
node demo-sprites/forge-mockup-v3.mjs
```

Parcourt les 7 écrans du produit : splash, welcome, chat, mission control, focus, hangar, completion. **Aucun appel LLM réel** — démo scriptée pour la validation UX.

Appuyez sur `SPACE` pour avancer, `B` pour reculer, `R` pour redémarrer.

## Tester P1 — *Hello agent in Docker*

Le premier jalon exécutable : un script lance un container Docker, y monte un runtime Node minimal, lui envoie un prompt via stdin, et affiche la réponse du LLM.

### Prérequis

- **Docker** lancé (Docker Desktop, OrbStack ou `colima`)
- **Bun** ≥ 1.1 — `curl -fsSL https://bun.sh/install | bash`
- **Un endpoint LLM compatible OpenAI joignable depuis le container.** Le défaut pointe sur un serveur [MLX](https://github.com/ml-explore/mlx) local, gratuit sur Mac Apple Silicon. Tout autre endpoint compatible OpenAI (Ollama, OpenAI cloud, vLLM, …) fonctionne en surchargeant deux variables d'env — voir plus bas.

### Voie par défaut : serveur MLX local (Apple Silicon, gratuit)

```bash
# 1. Installer MLX-LM dans un venv isolé (une seule fois)
python3 -m venv ~/.agent-forge/mlx-venv
~/.agent-forge/mlx-venv/bin/pip install mlx-lm

# 2. Télécharger un petit modèle instruct (~2 Go, une seule fois)
~/.agent-forge/mlx-venv/bin/hf download mlx-community/Llama-3.2-3B-Instruct-4bit

# 3. Démarrer le serveur HTTP MLX (laissez-le tourner dans un terminal)
~/.agent-forge/mlx-venv/bin/mlx_lm.server \
  --model mlx-community/Llama-3.2-3B-Instruct-4bit \
  --port 8080
```

Dans un autre terminal :

```bash
# 4. Builder l'image Docker base (une seule fois, ~600 Mo, ~1 min)
bash scripts/docker/build-base.sh

# 5. Installer les deps JS et builder le bundle runtime
bun install
cd packages/runtime && bun run build && cd -

# 6. Lancer le round-trip
bun run poc:p1
```

Sortie attendue :

```
Containers at sea
Docker's gentle guiding hand
Freedom in the code
```

Le container est supprimé automatiquement (`--rm`), même sur Ctrl+C ou timeout.

### Alternative : OpenAI cloud (ou tout endpoint compatible OpenAI)

```bash
FORGE_BASE_URL=https://api.openai.com/v1 \
FORGE_API_KEY=sk-... \
FORGE_MODEL=gpt-4o-mini \
bun run poc:p1
```

Même script, endpoint différent. Le runtime est provider-agnostic via le [Vercel AI SDK](https://sdk.vercel.ai).

### Dépannage

Le script effectue trois preflight checks et indique exactement quoi corriger :

```
✗ Docker daemon is not reachable.
  Start Docker Desktop (or `colima start`) and try again.

✗ Image agent-forge/base:latest is not built locally.
  Run: bash scripts/docker/build-base.sh

✗ Runtime bundle missing: …/packages/runtime/dist/runtime.mjs
  Run: cd packages/runtime && bun run build
```

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
