#!/usr/bin/env bash
# Agent Forge — install git hooks
#
# Configures git to use ./scripts/git-hooks/ as the hooks directory.
# This way, hooks are versioned with the repo and apply to all clones
# (after this script runs once).

set -e

HOOKS_DIR="scripts/git-hooks"

if [ ! -d ".git" ]; then
  echo "✗ not a git repository (no .git/ directory found)"
  echo "  run 'git init' first."
  exit 1
fi

if [ ! -d "$HOOKS_DIR" ]; then
  echo "✗ hooks directory $HOOKS_DIR not found"
  exit 1
fi

# Tell git to use our hooks directory
git config core.hooksPath "$HOOKS_DIR"

# Make sure all hooks are executable
chmod +x "$HOOKS_DIR"/*

echo "✓ git hooks installed (core.hooksPath = $HOOKS_DIR)"
echo ""
echo "  Active hooks :"
for hook in "$HOOKS_DIR"/*; do
  [ -f "$hook" ] && echo "    · $(basename "$hook")"
done
