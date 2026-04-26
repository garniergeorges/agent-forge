# @agent-forge/tools-core

Tools natifs partagés entre le builder (côté host) et le runtime (dans le container).

## État P3

Deux tools livrés et utilisés dans le parcours `forge` :

- **`FileWrite`** — écrit sous `~/.agent-forge/agents/<name>/` avec sandbox de chemin (refuse tout `..`, refuse les écrasements sauf `overwrite: true` quand l'utilisateur a confirmé dans le dialog de permission). Schéma Zod sur l'input.
- **`DockerLaunch`** — `launchAgent({ agent, prompt })` : retourne un handle `{ containerName, events: AsyncGenerator, abort }`. Spawn `docker run --rm -i`, monte `AGENT.md` + le bundle runtime, hérite des env vars provider, force le cleanup en `try/finally`.

## Tools prévus pour P4

Depuis l'intérieur du container, accessibles à l'agent :

- **`Bash`** — exécution shell, restreinte au `/workspace`
- **`FileRead`** — lecture avec offset/limit
- **`FileEdit`** — patch par `old_string` / `new_string`
- **`FileWrite`** — version "in-container" (différente de la version builder host)
- **`Grep`** — recherche ripgrep
- **`Glob`** — pattern matching

## Interface tool

```ts
type Tool<Input, Output, Progress> = {
  name: string
  schema: ZodSchema<Input>
  run(input: Input, ctx: ToolContext): AsyncGenerator<Progress, Output>
}
```

Pattern emprunté à l'analyse OpenClaude (`../../analyse/06-tools-system.md`).
