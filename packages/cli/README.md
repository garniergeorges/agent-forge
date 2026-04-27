# @agent-forge/cli

Binaire `forge` — CLI conversationnelle.

## Ce que ça fait

Héberge le **builder LLM** dans un REPL Ink. L'utilisateur décrit ce qu'il veut, le builder génère des fichiers `AGENT.md` puis lance les containers Docker correspondants. Quand le message déclenche une **skill**, la CLI prend la main et orchestre directement (deux appels LLM ciblés au lieu d'un wide).

## État

**Phase POC, P1 → P6 livrés.** Couvre :

- REPL Ink bilingue EN/FR (sélecteur de langue au premier lancement)
- Splash + preflight checks (Docker dispo, image base, runtime bundle)
- Mission Control (zone haute) — affiche les actions du builder (write, run, skill) avec :
  - mode compact 1-ligne par défaut, expand sur la card focus
  - viewport scrollable avec indicateurs `↑ N above / ↓ N below`
  - auto-focus de la nouvelle card arrivée, running cards toujours expandées
  - vue détail plein écran (Enter), highlight Markdown/YAML/JSON/agent-run
- Conversation (zone basse) — uniquement le langage naturel, transcripts persistés en JSONL
- Permission dialog (Y / N / D) avant toute écriture ou lancement
- Slash commands : `/help`, `/clear`, `/reset`, `/lang`, `/provider`, `/model`, `/session`, `/sessions`, `/skills`, `/exit`
- Provider-agnostic via Vercel AI SDK (Mistral, OpenAI, MLX local…)
- Sessions persistées dans `~/.agent-forge/sessions/<id>/transcript.jsonl`
- **Couche skills** : matching des triggers côté serveur, dispatch automatique vers le runner `scaffold-and-run` quand un trigger matche

## Lancement

```bash
bun run forge          # depuis la racine du monorepo
```

## Slash commands

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

## Raccourcis clavier

```
[⏎]                  envoyer un message
[PgUp/PgDn]          scroll Mission Control (si focus actif ou input vide)
                     sinon scroll dans le transcript
[Ctrl+E]             retour live dans le transcript
[Tab/Shift+Tab]      cycle focus entre les cards Mission Control
[Enter] sur focus    ouvre la card en détail plein écran
[Esc]                retire le focus, ou ferme la vue détail
[Y/N/D]              approuve / refuse / aperçu (dialog de permission)
```

## Structure

```
src/
├── index.tsx                 entrée Ink
├── App.tsx                   layout + routage clavier global
├── components/
│   ├── MissionControl.tsx    zone haute, cards compactes / expandées + viewport
│   ├── CardDetail.tsx        vue plein écran d'une card focus
│   ├── ProviderLogo.tsx      logo pixel art du provider actif
│   ├── Welcome.tsx           zone basse (header + transcript + prompt + footer)
│   ├── ChatViewport.tsx      transcript scrollable
│   ├── ConfirmAction.tsx     dialog de permission Y/N/D
│   ├── Splash.tsx            écran de boot
│   └── syntax.ts             highlighters YAML / Markdown / JSON / agent-run
├── hooks/
│   ├── useChat.ts            state machine (messages, actions, streaming, dispatch skills)
│   ├── useCardFocus.ts       focus + scrollTop + auto-focus + auto-scroll
│   └── useChatContext.tsx    React context wrapper
├── actions/                  types Action (write, run, skill)
├── builder-actions.ts        parser des blocs forge:write / forge:run / forge:skill
├── commands.ts               slash commands
├── config/                   .env, presets providers, langue
├── i18n/                     EN/FR strings
├── session/                  persistence JSONL
└── poc-p1.ts                 ancien script P1 (round-trip Docker minimal)
```

## Suite

P5 — sandbox durci, agents persistants via `docker exec`, extraction d'artefacts du `/workspace` vers le host.
