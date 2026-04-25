# @agent-forge/cli

The `forge` binary — conversational CLI builder.

## What it does

Hosts the **builder LLM** in a React/Ink REPL. The user describes what they want to build, the builder generates AGENT.md / TEAM.md files and launches Docker containers.

## Status

**Phase POC.** Skeleton only. First milestone (P1) is "Hello agent in Docker".

## Usage (future)

```bash
forge                  # start the conversational REPL
forge run <agent>      # launch a saved agent
forge teams            # list teams
forge logs <id>        # view logs
forge kill <id>        # abort
```
