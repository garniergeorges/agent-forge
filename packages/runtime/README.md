# @agent-forge/runtime

Le process qui tourne **à l'intérieur** des containers Docker lancés par Agent Forge.

## Ce que ça fait (état P3)

1. Lit le fichier `/agent/AGENT.md` monté en lecture seule dans le container
2. Sépare le frontmatter (validé Zod côté host) du corps Markdown
3. Utilise le corps comme **system prompt** de l'agent
4. Récupère le prompt utilisateur via stdin
5. Streame la réponse du LLM (`streamText` du Vercel AI SDK) sur stdout, chunk par chunk
6. Sort avec le code 0 quand le LLM a fini

Le container est lancé avec `docker run --rm -i`, donc il est détruit dès la sortie.

## Variables d'environnement

Héritées du host par le `DockerLaunch` tool :

```
FORGE_BASE_URL    endpoint OpenAI-compatible
FORGE_API_KEY     clé (peut être vide pour MLX local)
FORGE_MODEL       nom du modèle
```

## Build

```bash
bun run --cwd packages/runtime build
```

Produit `dist/runtime.mjs`. **Cible Node, pas Bun** — les containers tournent une image Node Alpine, ils ne savent pas exécuter `__require` injecté par `bun build --target bun`.

## À venir

- **P4** — exposer six tools natifs (Bash, FileRead, FileEdit, FileWrite, Grep, Glob) à l'agent depuis l'intérieur du container
- **P5** — agents persistants via `docker exec` (au lieu de `docker run --rm` jetable)
- **P5** — extraction d'artefacts du `/workspace` du container vers le host
- **P6** — `claude-presence` MCP pour la coordination entre agents d'une même team
