# @agent-forge/tools-core

Native tools shared between builder (on host) and runtime (in container).

## Tool interface

All tools implement `Tool<Input, Output, Progress>` (inspired by OpenClaude analysis, see `../../../analyse/06-tools-system.md`).

## Tools planned for P4

- **`Bash`** — shell execution
- **`FileRead`** — read with offset/limit
- **`FileEdit`** — patch via `old_string`/`new_string`
- **`FileWrite`** — overwrite
- **`Grep`** — ripgrep search
- **`Glob`** — pattern matching

## Status

**Phase POC. Not implemented yet.**
