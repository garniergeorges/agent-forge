<div align="center">

  <img src="./assets/agent-forge.png" alt="Agent Forge" width="100%">

  <br/>

  **Forgez, lancez et orchestrez des agents LLM en sandbox.**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
  ![Status: P3 done](https://img.shields.io/badge/status-P3%20done-green)
  ![Stack: TypeScript + Bun](https://img.shields.io/badge/stack-TypeScript_+_Bun-3178c6)

  🇫🇷 Version française · [🇬🇧 English version](./README.md)

</div>

---

> 🚧 **Statut — POC, jalon P3 atteint.** Vous pouvez désormais lancer `bun run forge`, décrire un agent en français ou en anglais, regarder le builder rédiger l'`AGENT.md`, l'approuver, puis demander au builder d'exécuter cet agent — il monte son propre container Docker, streame la sortie, puis détruit la sandbox. Prochain jalon : P4 — tools natifs (Bash, FileRead, FileEdit, FileWrite, Grep, Glob).

## Qu'est-ce qu'Agent Forge ?

Une CLI conversationnelle où vous **décrivez** le logiciel à construire et un **builder LLM** conçoit, écrit et lance les agents qui le produisent — chaque agent isolé dans son propre container Docker, dans une TUI pixel art bâtie sur [Ink](https://github.com/vadimdemedes/ink).

Le builder est la seule surface conversationnelle. Les sous-agents sont créés à la demande dans des sandboxes jetables ; les agents persistants et les teams multi-agents arrivent plus tard (P5 et P7).

<div align="center">
  <img src="./assets/agent-forge.gif" alt="Démo Agent Forge" width="80%">
</div>

## Statut — ce qui marche aujourd'hui

| Jalon | Périmètre | État |
|---|---|---|
| **P1** | Hello agent dans Docker (script host ↔ container ↔ round-trip LLM) | ✅ fait |
| **P2** | CLI conversationnelle (REPL Ink, EN/FR, slash commands, switch provider) | ✅ fait |
| **P3** | Le builder écrit l'`AGENT.md`, demande la permission, lance l'agent dans un container neuf, streame la sortie | ✅ fait |
| P4 | Six tools natifs (Bash, FileRead, FileEdit, FileWrite, Grep, Glob) utilisables depuis la sandbox | suivant |
| P5 | Sandbox durci + extraction d'artefacts vers le host | |
| P6 | Skills enrichis (scaffolding projet, audits, fixes) | |
| P7 | `TEAM.md` — exécutions multi-agents coordonnées | |
| P8 | Dashboard pixel art (activité agents en direct) | |
| P9 | ★ POC validé : démo Next.js + Laravel + QA de bout en bout | |

## Démarrage rapide

```bash
# 1. Builder l'image Docker base (une seule fois, ~600 Mo, ~1 min)
bash scripts/docker/build-base.sh

# 2. Installer les deps JS et builder le bundle runtime
bun install
bun run --cwd packages/runtime build

# 3. Configurer le provider LLM (cloud — recommandé)
cp .env.example .env
# éditer .env et renseigner FORGE_API_KEY=…

# 4. Lancer le REPL builder
bun run forge
```

Au premier lancement la CLI vous demande la langue (EN / FR), puis vous laisse au prompt conversationnel.

### À quoi ressemble l'écran

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
 │     ✓ written /Users/vous/.agent-forge/agents/haiku-writer/… │
 ╰──────────────────────────────────────────────────────────────╯

                                                            ▀▀▀
                                                            ▀▀▀▀
                                                            ▄ ▄ ▄

 ▌▌ AGENT FORGE ▐▐  v0.0.0  accueil · nouvelle session    session : nouvelle · model: mistral-small-latest
 ─────────────────────────────────────────────────────────────────
   ❯ crée un agent qui écrit des haïkus
   ▸ Fait. L'agent est forgé. Je le lance ?

 ❯ décrivez ce que vous voulez construire…
 [⏎] envoyer  [PgUp/PgDn] scroll  [Ctrl+E] live  [/help] commandes
```

La TUI est divisée en deux zones strictes :

- **Zone haute (Mission Control)** — chaque action concrète du builder. Écritures de fichier, lancements de container, sortie d'agent. Coloration syntaxique, code couleur par statut (orange = en attente, vert = fait, rouge = échoué).
- **Zone basse (Conversation)** — uniquement l'échange en langage naturel entre vous et le builder. Pas de code, pas de logs, pas d'internes.

## Configuration du provider

Agent Forge parle à n'importe quel endpoint chat **compatible OpenAI** via le [Vercel AI SDK](https://sdk.vercel.ai). Choisissez ce qui vous convient.

### Mistral cloud (défaut — recommandé)

Récupérez une clé sur <https://console.mistral.ai>. Le tier gratuit suffit pour le POC.

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

### Serveur MLX local (Apple Silicon, gratuit, sans clé)

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

Vous pouvez aussi switcher à la volée depuis le REPL : `/provider mistral`, `/model mistral-large-latest`, `/provider mlx`.

## Une session typique

1. **Décrire** — `> crée un agent qui écrit des haïkus sur un sujet donné`
2. **Approuver** — le builder rédige un `AGENT.md`, Mission Control l'affiche, une fenêtre de permission demande `[Y] approuver  [N] refuser  [D] aperçu`. Tapez `Y`.
3. **Lancer** — `> lance haiku-writer sur Docker`. Même fenêtre, même `Y`.
4. **Regarder** — Mission Control streame la sortie du container en direct, le badge passe à `[DONE]`, le container est supprimé (`docker run --rm`).

Chaque session est persistée dans `~/.agent-forge/sessions/<id>/transcript.jsonl`. `/sessions` liste les sessions, `/session` affiche l'id courante.

## Slash commands utiles

```
/help                affiche toutes les commandes
/clear               vide la vue (le contexte LLM est conservé)
/reset               vide la vue ET le contexte LLM
/lang en|fr          change la langue de l'interface
/provider <name>     mlx | openai | anthropic | mistral
/model <name>        change de modèle sur le provider actif
/session             affiche l'id de la session courante
/sessions            liste les sessions persistées
/exit                quitte
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HOST                                                       │
│                                                             │
│  forge CLI (= le builder LLM)                               │
│    ├─ TUI Ink (Mission Control + conversation)              │
│    ├─ Parser AGENT.md (frontmatter validé par Zod)          │
│    ├─ Tool FileWrite (sandboxé sous ~/.agent-forge)         │
│    └─ Tool DockerLaunch (lance des containers one-shot)     │
└────────────────────┬────────────────────────────────────────┘
                     │ docker run --rm -i
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  CONTAINER (un par run d'agent, jetable)                    │
│  agent-forge/base:latest                                    │
│                                                             │
│  Runtime Node ── lit /agent/AGENT.md comme system prompt    │
│               └─ reçoit le prompt utilisateur via stdin     │
│               └─ streame la réponse du LLM sur stdout       │
└─────────────────────────────────────────────────────────────┘
```

Les agents persistants (`docker exec`) et les teams multi-agents (un container, plusieurs process coordonnés via [`claude-presence`](https://github.com/garniergeorges/claude-presence)) arrivent en P5 et P7.

## Stack technique

- **TypeScript** + runtime **Bun** + **Bun workspaces**
- **Ink** (React pour terminaux) pour la TUI
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai`) — appels LLM provider-agnostic
- `zod` — validation du frontmatter `AGENT.md`
- CLI `docker` via `child_process.spawn` (Bun + dockerode bloque sur l'attach)
- `biome` pour lint/format
- Licence Apache 2.0

## Structure du repo

```
agent-forge/
├── packages/
│   ├── core/             # builder LLM, schéma AGENT.md, config provider
│   ├── cli/              # le binaire `forge` (REPL Ink + Mission Control)
│   ├── runtime/          # bundle exécuté dans chaque container d'agent
│   └── tools-core/       # FileWrite, DockerLaunch, …
├── docker/               # Dockerfiles
├── scripts/              # helpers de build (docker, hooks)
├── demo-sprites/         # mockup interactif (référence UX)
└── assets/               # images du README
```

## Genèse

L'architecture de ce projet a été informée par une analyse technique publique d'un coding-agent de référence existant. L'analyse (~6 400 lignes, 13 documents) a extrait les patterns à conserver et les pièges à éviter. **Aucun code n'a été copié** — seuls les patterns architecturaux ont inspiré la conception.

## Contribuer

Le projet est en phase POC active. Les retours et idées sont les bienvenus via les [issues](https://github.com/garniergeorges/agent-forge/issues). Les contributions de code seront ouvertes après le jalon P9 (POC validé).

## Licence

[Apache 2.0](./LICENSE) — Copyright 2026 Georges Garnier

## Auteur

[@garniergeorges](https://github.com/garniergeorges)
