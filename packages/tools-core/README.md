# @agent-forge/tools-core

Tools natifs partagés entre le builder (côté host) et le runtime (dans le container).

## État P4

### Tools host

Utilisés par le builder pour préparer / lancer les agents :

- **`FileWrite`** (`src/file-write.ts`) — écrit sous `~/.agent-forge/agents/<name>/` avec sandbox de chemin (refuse tout `..`, refuse les écrasements sauf `overwrite: true` quand l'utilisateur a confirmé dans le dialog de permission). Schéma Zod sur l'input.
- **`DockerLaunch`** (`src/docker-launch.ts`) — `launchAgent({ agent, prompt })` retourne un handle `{ containerName, events: AsyncGenerator, abort }`. Spawn `docker run --rm -i`, monte `AGENT.md` + le bundle runtime + un `/workspace` RW propre par run, hérite des env vars provider, force le cleanup en `try/finally`.

### Tools runtime (in-container)

Utilisés par les agents eux-mêmes via le tool-loop du runtime, tous sandboxés sous `/workspace` :

- **`Bash`** (`src/runtime/bash.ts`) — exécution shell (`bash -lc`), timeout 30 s par défaut (max 120 s), output clippé à 16 Ko
- **`FileWrite`** (`src/runtime/file-write.ts`) — version in-container, écrase par défaut (différente de la version host qui est stricte)
- **`FileRead`** (`src/runtime/file-read.ts`) — offset/limit en lignes, clip 16 Ko, refuse les non-fichiers
- **`FileEdit`** (`src/runtime/file-edit.ts`) — patch par sous-chaîne exacte, refuse les matchs ambigus sauf `replaceAll: true`
- **`Grep`** (`src/runtime/grep.ts`) — regex JS pure sur un filtre glob optionnel, ignore les binaires (octets nuls dans les 4 Ko de tête), 200 hits max, lignes clippées à 400 chars
- **`Glob`** (`src/runtime/glob.ts`) — matcher fait main pour `*` / `**` / `?`, 200 résultats max, walk borné à 5000 nodes

Tous les tools runtime utilisent `resolveSandboxedPath` pour valider les chemins. La racine sandbox est `/workspace` en production ; pour les tests, `FORGE_WORKSPACE` peut la rediriger vers un dossier temp.

## Interface tool

Pattern Vercel AI SDK : Zod schema + fonction pure `execute*` qui retourne un résultat structuré (`{ ok: true, … }` ou `{ ok: false, error: string }`). Pas d'instances ni d'effets cachés — chaque appel est self-contained, ce qui simplifie les tests.

## Tests

`tests/` couvre :
- `file-write.test.ts` — host FileWrite (path safety, sandbox escape, refus d'écrasement)
- `runtime-bash.test.ts` — stdout / stderr / exit / timeout / cwd
- `runtime-file-write.test.ts` — sandbox escape, traversal, écrasement, parent-dir
- `runtime-file-read.test.ts` — offset/limit, fichier manquant, sandbox escape
- `runtime-file-edit.test.ts` — match unique, ambiguïté, replaceAll, missing oldString
- `runtime-grep.test.ts` — case sensitivity, glob filter, regex invalide
- `runtime-glob.test.ts` — `**/*`, `*` mono-segment, `?`, no-match
