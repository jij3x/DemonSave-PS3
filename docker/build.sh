#!/usr/bin/env bash
# DemonSave-PS3 — host wrapper for the cross-compile builder container.
#
# Usage:
#   ./docker/build.sh linux      # .deb + .rpm + portable .tar.gz (x86_64)
#   ./docker/build.sh windows    # portable .exe zip (x86_64 MSVC cross)
#   ./docker/build.sh all        # both (default)
#
# Builds (or reuses the cached layers of) the demonsave-ps3-builder image,
# then runs it with the repo bind-mounted at /work. Artifacts land in the
# host repo's ./build-output/ (gitignored). Named volumes keep the heavy
# caches (node_modules, Rust target dir, cargo registry/git, npm download
# cache) warm across runs — a re-run is markedly faster than a cold one.
#
# Prerequisites: Docker (Docker Desktop on macOS/Windows, or a Linux Docker
# Engine). Nothing else — no Node, Rust, MSVC, or webview libs on the host.
set -euo pipefail

TARGET="${1:-all}"
case "$TARGET" in
  linux|windows|all) ;;
  *)
    echo "usage: $0 [linux|windows|all]" >&2
    exit 2
    ;;
esac

IMAGE=demonsave-ps3-builder:latest
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Layer-cached no-op after the first build (seconds); full build on first run.
docker build -t "$IMAGE" "${REPO_ROOT}/docker"

docker run --rm \
  -e HOST_UID="$(id -u)" \
  -e HOST_GID="$(id -g)" \
  -v "${REPO_ROOT}:/work" \
  -v builder_node_modules:/work/node_modules \
  -v builder_target:/work/src-tauri/target \
  -v builder_cargo_cache:/usr/local/cargo/registry \
  -v builder_cargo_git:/usr/local/cargo/git \
  -v builder_npm_cache:/root/.npm \
  "$IMAGE" \
  "$TARGET"

echo
echo "Artifacts in ${REPO_ROOT}/build-output/:"
ls -la "${REPO_ROOT}/build-output/"
