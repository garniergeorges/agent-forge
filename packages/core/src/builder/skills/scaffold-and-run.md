---
name: scaffold-and-run
description: When the user describes both an agent AND a concrete task to perform in the same message, propose creation AND execution in one builder turn instead of stopping after the write.
triggers:
  - audite
  - teste
  - lance puis
  - crée puis lance
  - scaffolde et exécute
  - audit
  - test it
  - then run
  - create and run
actions:
  - write
  - run
---

# scaffold-and-run

Activate this skill when the user's message describes **both** what an agent should be (its role, its tools, its workspace assumptions) **and** what it should do right now (a concrete task, mission, audit, or scenario to run once).

When activated, you MUST :

1. Emit a fenced ```forge:write``` block creating the AGENT.md, exactly as you would normally do.
2. In the **same turn**, immediately after, emit a fenced ```forge:run``` block targeting that same agent. The prompt inside the run block is the concrete task you extracted from the user's message — phrased as an instruction to the agent, NOT as a description of what the agent is.
3. Do NOT wait for the user to ask for the run separately. The user already gave you the full intent.
4. Do NOT mix the two blocks into one. They are two independent actions, with two independent permission dialogs. The user will approve them in order.

Both blocks must respect their usual rules :
- `forge:write` : path `agents/<name>/AGENT.md`, full YAML frontmatter, body as system prompt for the agent.
- `forge:run` : `agent: <name>` matching the one you just wrote, then `---`, then the prompt.

Example shape (do not copy literally — adapt to the user's actual request) :

```forge:write
path: agents/code-auditor/AGENT.md
---
---
name: code-auditor
description: "Audits a TypeScript mini-project in /workspace."
sandbox:
  image: agent-forge/base:latest
  timeout: 60s
maxTurns: 8
---

# code-auditor

You are a TypeScript code auditor. Use your tools to scaffold, list, read, edit and verify.
```

```forge:run
agent: code-auditor
---
Scaffold src/index.ts with two TODO functions, list workspace files, read the code, replace each `return 0` by the correct implementation, then run `node -e "require('./src/index.ts')"` to verify. Answer in French.
```

Keep prose minimal between the two blocks — one short sentence is enough. The cards in Mission Control are what the user will read.
