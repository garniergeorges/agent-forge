# @agent-forge/runtime

Le process qui tourne **à l'intérieur** des containers Docker lancés par Agent Forge.

## Ce que ça fait (état P4)

1. Lit le fichier `/agent/AGENT.md` monté en lecture seule dans le container
2. Sépare le frontmatter (validé Zod côté host) du corps Markdown
3. Utilise le corps comme **system prompt** de l'agent, plus une section TOOLS qui décrit les six tools disponibles
4. Récupère le prompt utilisateur via stdin
5. **Tool loop multi-turns** :
   - streame la réponse du LLM (`streamText` du Vercel AI SDK) sur stdout, chunk par chunk
   - parse le premier bloc `forge:*` que l'agent émet
   - exécute le tool correspondant (Bash / FileWrite / FileRead / FileEdit / Grep / Glob)
   - réinjecte le résultat structuré comme message utilisateur dans la conversation
   - boucle jusqu'à ce que l'agent réponde sans bloc OU que `maxTurns` soit atteint (cap dur à 10)
6. Sort avec le code 0 quand le LLM a fini

Le container est lancé avec `docker run --rm -i`, donc il est détruit dès la sortie. Le `/workspace` (bind-mount RW) est conservé sur le host pour inspection / extraction d'artefacts (P5).

## Protocole tool agent-side

Voir `src/tool-protocol.ts` pour le parser et les renderers de résultats. Les six tags reconnus sont `forge:bash`, `forge:write`, `forge:read`, `forge:edit`, `forge:grep`, `forge:glob`. Les résultats sont écrits sur stdout entre marqueurs `[forge:tool]` / `[/forge:tool]` pour que le host TUI puisse les router dans la card Mission Control.

## Variables d'environnement

Héritées du host par le `DockerLaunch` tool :

```
FORGE_BASE_URL    endpoint OpenAI-compatible
FORGE_API_KEY     clé (peut être vide pour MLX local)
FORGE_MODEL       nom du modèle
FORGE_MAX_TOKENS  optionnel, default 1024 par tour
```

## Build

```bash
bun run --cwd packages/runtime build
```

Produit `dist/runtime.mjs`. **Cible Node, pas Bun** — les containers tournent une image Node Alpine, ils ne savent pas exécuter `__require` injecté par `bun build --target bun`.

## À venir

- **P5** — sandbox durci (read-only root FS, network policy, resource caps), agents persistants via `docker exec` au lieu de `docker run --rm` jetable
- **P5** — extraction d'artefacts du `/workspace` du container vers le host
- **P7** — `claude-presence` MCP pour la coordination entre agents d'une même team
