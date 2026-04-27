<div align="center">

  <img src="./assets/agent-forge.png" alt="Agent Forge" width="100%">

  <br/>

  **Forgez, lancez et orchestrez des agents LLM en sandbox.**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
  ![Status: P6 done](https://img.shields.io/badge/status-P6%20done-green)
  ![Stack: TypeScript + Bun](https://img.shields.io/badge/stack-TypeScript_+_Bun-3178c6)

  🇫🇷 Version française · [🇬🇧 English version](./README.md)

</div>

---

> 🚧 **Statut — POC, jalons P1 → P6 atteints.** Vous pouvez désormais lancer `bun run forge`, décrire un agent en français ou en anglais, regarder le builder rédiger l'`AGENT.md`, l'approuver, puis demander au builder d'exécuter cet agent — il monte son propre container Docker avec **six tools natifs** (Bash, FileRead, FileEdit, FileWrite, Grep, Glob) sandboxés sous `/workspace`, streame la sortie, puis détruit la sandbox. Les patterns d'orchestration récurrents sont gérés par des **skills** : déposez un `SKILL.md` dans `~/.agent-forge/skills/` (ou utilisez la skill built-in `scaffold-and-run`) et la CLI active automatiquement quand un trigger apparaît dans votre message. Prochain jalon : P5 — sandbox durci + extraction d'artefacts.

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
| **P4** | Six tools natifs sandboxés sous `/workspace` : Bash, FileWrite, FileRead, FileEdit, Grep, Glob ; tool-loop runtime avec `maxTurns` | ✅ fait |
| **P6** | Couche skills : format `SKILL.md`, catalogue (built-in + `~/.agent-forge/skills/`), matching des triggers côté serveur, runner à 2 appels (un pour AGENT.md, un pour le run prompt) | ✅ fait |
| **P5.1** | Sandbox Docker durci : user non-root, racine read-only + tmpfs `/tmp`, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--network=none` par défaut, caps ressources (mémoire / cpus / pids). Le dialog de permission signale toute relaxation déclarée dans l'AGENT.md. | ✅ fait |
| P5.2 | Extraction d'artefacts vers le host (`~/.agent-forge/artifacts/<session>/<agent>/`) | suivant |
| P5.3 | Agents persistants via `docker exec`, slash commands de cycle de vie | |
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

## Tools natifs (dans la sandbox de l'agent)

Les agents lancés par le builder tournent dans un container jetable avec `/workspace` monté en écriture. Six tools natifs sont exposés et appelés via des blocs encadrés `forge:*` que l'agent émet dans sa réponse :

| Tag | Tool | Ce que ça fait |
|---|---|---|
| `forge:bash` | Bash | `bash -lc <command>` dans `/workspace`, timeout 30 s par défaut (max 120 s), sortie clippée à 16 Ko |
| `forge:write` | FileWrite | Crée ou écrase un fichier sous `/workspace`, dossiers parents auto-créés |
| `forge:read` | FileRead | Offset/limit en lignes, clip à 16 Ko, refuse les non-fichiers |
| `forge:edit` | FileEdit | Patch par sous-chaîne exacte ; refuse les matchs ambigus sauf `replaceAll: true` |
| `forge:grep` | Grep | Regex JS pure sur un filtre glob optionnel, ignore les binaires, 200 hits max |
| `forge:glob` | Glob | Matcher fait main pour `*` / `**` / `?`, 200 résultats max |

Le runtime parse un bloc par tour, exécute, réinjecte le résultat structuré comme message système, et boucle jusqu'à `maxTurns` (cap dur à 10). Tous les tools sont sandboxés : path traversal, octets nuls et chemins absolus hors `/workspace` sont refusés.

Pourquoi un protocole texte plutôt que les `tool_calls` natifs OpenAI ? Les LLM locaux (MLX, llama.cpp) ne respectent pas tous le tool-use natif, et un protocole unique entre builder et agents simplifie le débogage — le flux brut reste lisible.

## Skills (patterns d'orchestration récurrents)

Un seul message utilisateur peut mélanger deux intentions que le LLM tend à confondre — « ce que l'agent EST » et « ce que l'agent doit FAIRE MAINTENANT ». Les **skills** les séparent.

Une skill est un fichier `SKILL.md` avec un frontmatter YAML (name, description, **triggers**, actions) et un corps markdown d'instructions. La CLI charge les skills depuis deux sources :

- built-in : livrées sous `packages/core/src/builder/skills/`
- utilisateur : posez un fichier dans `~/.agent-forge/skills/<nom>.md` (ou `<nom>/SKILL.md` pour grouper des assets) et il prend le pas sur le built-in en cas de collision de nom

Quand vous envoyez un message, la CLI le scanne côté serveur contre les phrases triggers de chaque skill (insensible à la casse, sous-chaîne). Si un trigger matche, le **runner** prend la main : deux appels LLM ciblés, un pour l'AGENT.md (rôle générique uniquement), un pour le run prompt (la tâche concrète), puis les deux blocs apparaissent en cards PROPOSED dans Mission Control. Vous approuvez dans l'ordre. Le LLM n'a jamais à prendre la méta-décision.

La skill `scaffold-and-run` est livrée par défaut : elle se déclenche sur des mots comme `audite`, `teste`, `lance puis`, `audit`, `test it`, `then run`, `create and run`. Tapez `/skills` dans le REPL pour lister celles qui sont disponibles.

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
/skills              liste les skills disponibles (built-in + user)
/exit                quitte
```

## Raccourcis Mission Control

- `Tab` / `Shift+Tab` — cycle le focus entre les cards d'action
- `Enter` — ouvre la card focus en plein écran
- `Esc` — retire le focus (ou ferme la vue détail)
- `↑↓ / PgUp / PgDn / g / G` — scroll dans la vue détail
- `Ctrl+E` — retour live dans le transcript

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HOST                                                       │
│                                                             │
│  forge CLI (= le builder LLM)                               │
│    ├─ TUI Ink (Mission Control + conversation)              │
│    ├─ Catalogue skills : built-in + ~/.agent-forge/skills/  │
│    ├─ Matcher de triggers + skill runner côté serveur       │
│    ├─ Parsers AGENT.md / SKILL.md (validés par Zod)         │
│    ├─ Tool FileWrite (host, sandboxé sous ~/.agent-forge)   │
│    └─ Tool DockerLaunch (lance des containers one-shot)     │
└────────────────────┬────────────────────────────────────────┘
                     │ docker run --rm -i
                     │   -v <agent>/AGENT.md:/agent/AGENT.md:ro
                     │   -v <runtime-bundle>:/runtime:ro
                     │   -v <dossier-host-par-run>:/workspace
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  CONTAINER (un par run d'agent, jetable)                    │
│  agent-forge/base:latest                                    │
│                                                             │
│  Runtime Node ── lit /agent/AGENT.md comme system prompt    │
│               ├─ reçoit le prompt utilisateur via stdin     │
│               ├─ streame la réponse du LLM sur stdout       │
│               └─ tool loop : forge:bash / write / read /    │
│                  edit / grep / glob, capé à maxTurns        │
│                                                             │
│  /workspace ── espace en écriture, conservé après l'exit    │
└─────────────────────────────────────────────────────────────┘
```

Les agents persistants (`docker exec` au lieu de `docker run --rm`) et les teams multi-agents (un container, plusieurs process coordonnés via [`claude-presence`](https://github.com/garniergeorges/claude-presence)) arrivent en P5 et P7.

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
│   ├── core/                       # builder LLM, schémas, couche skills
│   │   └── src/builder/skills/     # fichiers SKILL.md built-in
│   ├── cli/                        # le binaire `forge` (REPL Ink + Mission Control)
│   ├── runtime/                    # bundle exécuté dans chaque container d'agent
│   │   └── src/tool-protocol.ts    # parser forge:* + render des résultats
│   └── tools-core/
│       ├── file-write.ts           # FileWrite host (~/.agent-forge)
│       ├── docker-launch.ts        # lanceur de containers one-shot
│       └── runtime/                # tools in-container : bash, file-write,
│                                   #   file-read, file-edit, grep, glob
├── docker/                         # Dockerfiles
├── scripts/                        # helpers de build (docker, hooks)
├── demo-sprites/                   # mockup interactif (référence UX)
└── assets/                         # images du README
```

## Genèse

L'architecture de ce projet a été informée par une analyse technique publique d'un coding-agent de référence existant. L'analyse (~6 400 lignes, 13 documents) a extrait les patterns à conserver et les pièges à éviter. **Aucun code n'a été copié** — seuls les patterns architecturaux ont inspiré la conception.

## Contribuer

Le projet est en phase POC active. Les retours et idées sont les bienvenus via les [issues](https://github.com/garniergeorges/agent-forge/issues). Les contributions de code seront ouvertes après le jalon P9 (POC validé).

## Licence

[Apache 2.0](./LICENSE) — Copyright 2026 Georges Garnier

## Auteur

[@garniergeorges](https://github.com/garniergeorges)
