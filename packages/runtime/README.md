# @agent-forge/runtime

The process that runs **inside** Docker containers when an Agent Forge agent boots.

## What it does

1. Reads its `AGENT.md` from `/agent-config/`
2. Connects to its MCP servers (always including `claude-presence`)
3. Boots the query loop with the agent's tools, skills, model
4. Streams events to the host via stdio
5. Exits cleanly on completion

## Status

**Phase POC. Not implemented yet.**
