# @agent-forge/cli

Binaire `forge` — CLI conversationnelle.

## Ce que ça fait

Héberge le **builder LLM** dans un REPL Ink. L'utilisateur décrit ce qu'il veut, le builder génère des fichiers `AGENT.md` (P3) puis `TEAM.md` (P7) et lance les containers Docker correspondants.

## État

**Phase POC, P3 livré.** Couvre :

- REPL Ink bilingue EN/FR (sélecteur de langue au premier lancement)
- Splash + preflight checks (Docker dispo, image base, runtime bundle)
- Mission Control (zone haute) — affiche les actions du builder (write, run) avec coloration syntaxique YAML
- Conversation (zone basse) — uniquement le langage naturel, transcripts persistés en JSONL
- Permission dialog (Y / N / D) avant toute écriture ou lancement
- Slash commands : `/help`, `/clear`, `/reset`, `/lang`, `/provider`, `/model`, `/session`, `/sessions`, `/exit`
- Provider-agnostic via Vercel AI SDK (Mistral, OpenAI, MLX local…)
- Sessions persistées dans `~/.agent-forge/sessions/<id>/transcript.jsonl`

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
/exit                quitte
```

## Raccourcis clavier

```
[⏎]            envoyer
[PgUp/PgDn]    scroll dans le transcript
[Ctrl+E]       retour au live
[Y/N/D]        approuver / refuser / aperçu (dialog de permission)
```

## Structure

```
src/
├── index.tsx            entrée Ink
├── App.tsx              layout deux zones (Mission Control xor Splash, puis Welcome)
├── components/
│   ├── MissionControl.tsx    zone haute, cards d'actions
│   ├── ProviderLogo.tsx      logo pixel art du provider actif
│   ├── Welcome.tsx           zone basse (header + transcript + prompt + footer)
│   ├── ChatViewport.tsx      transcript scrollable
│   ├── ConfirmAction.tsx     dialog de permission Y/N/D
│   ├── Splash.tsx            écran de boot
│   └── syntax.ts             highlighter YAML / plain
├── hooks/
│   ├── useChat.ts            state machine (messages, actions, streaming)
│   └── useChatContext.tsx    React context wrapper
├── actions/                  types Action (write, run)
├── builder-actions.ts        parser des blocs forge:write / forge:run
├── commands.ts               slash commands
├── config/                   .env, presets providers, langue
├── i18n/                     EN/FR strings
├── session/                  persistence JSONL
└── poc-p1.ts                 ancien script P1 (round-trip Docker minimal)
```

## Suite

P4 — exposer six tools natifs (Bash, FileRead, FileEdit, FileWrite, Grep, Glob) au runtime, pour que les agents puissent agir sur leur propre `/workspace`.
