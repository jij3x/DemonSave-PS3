# syntax=docker/dockerfile:1
#
# DemonSave-PS3 — full-stack development container.
#
# Single source of truth for BOTH the VS Code / GitHub Codespaces dev container
# (referenced by .devcontainer/devcontainer.json) and the CLI docker-compose.yml
# at the repo root. It carries every toolchain a contributor needs so nothing has
# to be installed on the host:
#
#   - Node 24 + npm       dev server, tests, lint, fuzz, code-gen, builds
#   - Rust (stable)       cargo test + the Linux Tauri desktop build
#   - WebKitGTK / system  Tauri's Linux webview + build deps
#
# Base: Ubuntu 24.04 (glibc 2.39). The GLIBC >= 2.38 floor is load-bearing — the
# Jazzer fuzz native addon (fuzzer-linux-x64.node) needs it, which is the same
# reason .github/workflows/ci.yml pins ubuntu-24.04 ("Do not downgrade"). Do not
# downgrade the base.
#
# The image installs toolchains only — it deliberately does NOT copy the repo or
# run `npm install`. The source is bind-mounted at runtime (preserving the
# project's sacred no-build property: the source file IS the running file), and
# deps are installed by .devcontainer/post-create.sh (devcontainer) or the
# documented `docker compose exec app npm ci` bootstrap (CLI).

# Pinned by digest (immutable, content-addressed) so builds are reproducible
# and the base can't silently change under us. Tag kept for readability.
# Refresh deliberately for OS security patches:
#   docker buildx imagetools inspect mcr.microsoft.com/devcontainers/base:ubuntu-24.04
# then swap the digest below (pin the top-level Digest = the multi-arch index,
# not a per-platform manifest digest).
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04@sha256:d94c97dd9cacf183d0a6fd12a8e87b526e9e928307674ae9c94139139c0c6eae

ARG DEV_USER=vscode
ARG DEV_UID=1000
ARG DEV_GID=1000

# ── System packages ───────────────────────────────────────────────────────
# Exact WebKitGTK / Tauri build list, copied from howto.md §1 and the CI/release
# workflows (ci.yml rust job / release.yml build job). Adds zip/unzip for
# convenience; `file` is needed by Tauri's bundler.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev \
      build-essential \
      curl \
      wget \
      file \
      libxdo-dev \
      libssl-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev \
      zip \
      unzip \
 && rm -rf /var/lib/apt/lists/*

# ── AI-coding CLI tools ──────────────────────────────────────────────────
# ripgrep (rg), jq, fd, tree — fast search / JSON parsing / file find / layout.
# Missing from the devcontainers base; essential for an AI agent working in
# the shell. Debian ships fd as `fdfind`, so symlink the standard name.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ripgrep \
      jq \
      fd-find \
      tree \
 && ln -s "$(which fdfind)" /usr/local/bin/fd \
 && rm -rf /var/lib/apt/lists/*

# ── Node.js 24 (NodeSource) ───────────────────────────────────────────────
# Mirrors CI's `setup-node node-version: 24`. Installed system-wide so
# `docker compose exec app node ...` finds it without sourcing a profile.
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# ── Workspace + anonymous-volume mount points ─────────────────────────────
# Pre-create and chown the directories the compose file overlays with named
# volumes (node_modules, the Rust target cache). Named volumes inherit the image
# directory's ownership on first use, so the non-root DEV_USER can write into
# them without "permission denied" — and, crucially, a stale host-owned
# src-tauri/target (e.g. root-owned from a prior native build) can't break the
# container build. (Standard devcontainer fix for build caches.)
RUN mkdir -p \
      /workspaces/DemonSave-PS3/node_modules \
      /workspaces/DemonSave-PS3/rpcs3-mcp-server/node_modules \
      /workspaces/DemonSave-PS3/src-tauri/target \
 && chown -R ${DEV_UID}:${DEV_GID} /workspaces

# ── Rust (stable), installed as the non-root devcontainer user ────────────
# rustup lives in $DEV_USER's home so unprivileged builds and `cargo test` work.
USER ${DEV_USER}
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
      | sh -s -- -y --profile minimal --default-toolchain stable \
 && . "$HOME/.cargo/env" \
 && rustup component add rust-analyzer \
 && printf '\n. "$HOME/.cargo/env"\n' >> "$HOME/.bashrc"

# Make cargo/rustup visible to non-login shells too (e.g. `docker compose exec`).
ENV PATH=/home/${DEV_USER}/.cargo/bin:${PATH}

WORKDIR /workspaces/DemonSave-PS3

# Keep the container alive so any `docker compose exec app <cmd>` works. The dev
# server is started on demand from inside the container (npm run serve:dev).
CMD ["sleep", "infinity"]
