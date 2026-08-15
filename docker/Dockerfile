# DemonSave-PS3 — cross-compile builder image (Windows .exe + Linux ELF/deb/rpm).
#
# Batch artifact producer, deliberately SEPARATE from the interactive dev
# container (.devcontainer/ + root docker-compose.yml): that one stays lean for
# daily development; this one carries the heavy one-shot MSVC cross toolchain
# (xwin SDK splat + clang/lld + a Microsoft EULA --accept-license step).
# Invoked via docker/build.sh (linux | windows | all); never compose'd.
#
# Base: Ubuntu 22.04, digest-pinned (immutable, content-addressed) so builds
# are reproducible and the base can't silently change under us. 22.04 — not
# 24.04 like the dev container — matches the CI release Linux legs
# (.github/workflows/release.yml), so produced ELF/.deb/.rpm artifacts have
# the same glibc (2.35) compatibility floor as CI output. Refresh the digest
# deliberately for OS security patches:
#   docker buildx imagetools inspect ubuntu:22.04
# then swap it below (pin the top-level Digest = the multi-arch index).
FROM ubuntu:22.04@sha256:3b06811b2afd352be909dd088a004166d665dc76d38b13eada33522a9d915c6f

# rustup as root: toolchains in the image layer, CARGO_HOME shared with the
# builder_* cache volumes (registry/git) mounted by docker/build.sh at runtime.
ENV DEBIAN_FRONTEND=noninteractive \
    CARGO_HOME=/usr/local/cargo \
    RUSTUP_HOME=/usr/local/rustup \
    PATH=/usr/local/cargo/bin:$PATH

# ── System packages ───────────────────────────────────────────────────────
# Linux Tauri build deps: the exact apt list from the CI release workflow
# (libwebkit2gtk-4.1-dev & co). Windows cross deps: clang/lld/llvm provide
# clang-cl, the lld-link linker, and llvm-rc (required by embed-resource —
# tauri-build's icon embedding — when targeting MSVC from Linux).
# python3/xz-utils: xwin runtime helpers; zip: asset staging.
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
      clang \
      lld \
      llvm \
      python3 \
      xz-utils \
      ca-certificates \
      zip \
 && rm -rf /var/lib/apt/lists/*

# ── Unversioned LLVM tool names ───────────────────────────────────────────
# The distro lld/llvm packages already expose unversioned lld-link and
# llvm-rc; clang-cl, however, is not packaged separately on jammy — it is a
# driver mode of clang, so a symlink to the versioned clang binary works
# (LLVM tools are argv[0]-dispatching multicall bins). cargo config,
# embed-resource, and the cc crate look for the unversioned names.
RUN set -eu; \
    for t in lld-link llvm-rc clang-cl; do \
      src="$(ls -1 /usr/bin/${t} /usr/bin/${t}-[0-9]* /usr/lib/llvm-*/bin/${t} 2>/dev/null | sort -V | tail -n 1 || true)"; \
      if [ -z "$src" ] && [ "$t" = "clang-cl" ]; then \
        src="$(ls -1 /usr/bin/clang-[0-9]* 2>/dev/null | sort -V | tail -n 1 || true)"; \
      fi; \
      if [ -n "$src" ]; then ln -sf "$src" "/usr/local/bin/$t"; \
      else echo "::error::no ${t} binary found" >&2; exit 1; fi; \
    done; \
    command -v lld-link && command -v llvm-rc && command -v clang-cl

# ── Node.js 24 (NodeSource) ───────────────────────────────────────────────
# Mirrors CI's `setup-node node-version: 24` and the dev container image.
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/* \
 && node --version && npm --version

# ── Rust (stable) + the Windows MSVC target ───────────────────────────────
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
      | sh -s -- -y --profile minimal --default-toolchain stable \
 && rustup target add x86_64-pc-windows-msvc \
 && rustup component add llvm-tools \
 && rustc --version && cargo --version

# ── cargo-xwin + xwin CLI (pinned) ────────────────────────────────────────
# xwin performs the SDK splat below; cargo-xwin is installed as a fallback
# runner (`npx tauri build --runner cargo-xwin ...`) if the baked cargo
# config approach ever needs to be bypassed interactively.
ARG CARGO_XWIN_VERSION=0.23.1
ARG XWIN_VERSION=0.10.0
RUN cargo install --locked cargo-xwin --version "${CARGO_XWIN_VERSION}" \
 && cargo install --locked xwin --version "${XWIN_VERSION}"

# ── MSVC CRT + Windows SDK splat ──────────────────────────────────────────
# One-time download baked into the image (license accepted at image build).
# The SDK/CRT versions float to latest by default; the xwin tool version is
# pinned above, and the layout sanity checks fail the image build loudly if
# the splat output layout ever drifts (the cargo config below depends on it).
# xwin splat auto-runs download+unpack; symlinks (default on) fix SDK header
# casing for case-sensitive filesystems.
RUN xwin --accept-license --arch x86_64 splat --output /opt/xwin \
 && test -d /opt/xwin/crt/lib/x86_64 \
 && test -d /opt/xwin/sdk/lib/um/x86_64 \
 && test -d /opt/xwin/sdk/lib/ucrt/x86_64

# ── Cargo cross-link wiring ───────────────────────────────────────────────
# Target-scoped: only the MSVC target is affected; native Linux builds are
# untouched. Kept out of the repo's source tree on purpose.
COPY cargo-config.toml /usr/local/cargo/config.toml

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /work

ENTRYPOINT ["/entrypoint.sh"]
CMD ["all"]
