# Contributing to Agent Forge

Thanks for your interest in this project. It is currently in **POC phase** — code contributions will open after the P1 milestone.

## Project setup

```bash
bun install        # installs deps + sets up git hooks
bun run mockup     # runs the interactive mockup
```

## Git hooks

This repository ships its own git hooks under `scripts/git-hooks/`. They are installed automatically by `bun install` via the `prepare` script. Manual install :

```bash
bun run hooks:install
```

### `pre-commit`

Validates that staged files and the commit message conform to the project's commit policy. Specifically, it blocks commits containing auto-generated attribution markers from various tooling.

If the hook blocks a commit, edit the offending content (file or message) and try again. Bypassing the hook with `--no-verify` is **not recommended**.

### Server-side check

The same policy is enforced server-side via the `check-attribution` GitHub Action workflow. PRs and pushes to `main` are scanned for the same patterns. A workflow failure means rewriting the offending commits (use `git commit --amend` or `git rebase -i`) and force-pushing.

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat(scope): short summary

Longer description if needed.
```

Common scopes : `cli`, `core`, `runtime`, `tools`, `docker`, `docs`, `mockup`.

Examples :
- `feat(cli): add welcome screen`
- `fix(docker): cleanup zombie containers on host crash`
- `docs(readme): update roadmap status`
- `refactor(core): extract docker management to its own module`

## Branch naming

Use descriptive, kebab-case names :

```
feat/p1-hello-agent
fix/sandbox-network-policy
docs/architecture-overview
chore/upgrade-bun
```

Avoid prefixes that hint at tooling or session origin.

## Pull requests

1. Fork the repo
2. Create a feature branch
3. Make commits following the conventions above
4. Run `bun run lint && bun run typecheck && bun test` locally
5. Open a PR with a clear description

## License

By contributing, you agree that your contributions will be licensed under the [Apache 2.0 License](./LICENSE).
