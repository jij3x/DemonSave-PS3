#!/usr/bin/env bash
# post-create.sh — runs once after the dev container is created (VS Code /
# GitHub Codespaces via devcontainer.json `postCreateCommand`).
#
# Installs npm deps for both package roots and materializes generated files so
# the editor (and the version:check lint step) are ready immediately.
#
# CLI docker-compose users don't get this hook automatically — run it manually
# the first time:
#   docker compose exec app bash .devcontainer/post-create.sh
set -euo pipefail

echo "==> Installing root dependencies"
npm ci || npm install

echo "==> Installing rpcs3-mcp-server dependencies"
(cd rpcs3-mcp-server && (npm ci || npm install))

echo "==> Generating version + des-db index"
node tools/gen-version.mjs
node tools/gen-des-db-index.mjs

echo "✓ Dev container ready."
echo "  Start the dev server:  npm run serve:dev   (http://localhost:1420)"
