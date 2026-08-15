#!/usr/bin/env bash
# DemonSave-PS3 builder entrypoint — runs inside the demonsave-ps3-builder
# image. Invoked by docker/build.sh with the repo bind-mounted at /work.
#
# Usage: entrypoint.sh [linux|windows|all]
#
#   linux   → .deb + .rpm installers + portable .tar.gz (ELF)
#   windows → portable .exe (zip), cross-compiled via lld-link + xwin SDK
#   all     → both
#
# Artifacts are staged to /work/build-output/ (→ host ./build-output/) with
# CI-identical versioned names (via tools/get-version.mjs, the same single
# version source release.yml uses), so container output is drop-in familiar:
#
#   linux-installer-<name>.deb / <name>.rpm
#   linux-portable-demonsave-ps3_<VER>.tar.gz   (member: demonsave-ps3_<VER>)
#   windows-portable-demonsave-ps3_<VER>.zip    (member: windows-portable-…exe)
#
# macOS is intentionally absent: .app/.dmg need Apple frameworks → CI only.
set -euo pipefail

TARGET="${1:-all}"
case "$TARGET" in
  linux|windows|all) ;;
  *)
    echo "::error::unknown target '${TARGET}' (expected linux|windows|all)" >&2
    exit 2
    ;;
esac

cd /work
OUT_DIR=/work/build-output
mkdir -p "$OUT_DIR"

# ── Helpers ────────────────────────────────────────────────────────────────

install_js_deps() {
  # Mirror CI: npm ci for lockfile-exact installs, npm install as fallback.
  npm ci || npm install
}

app_version() {
  node tools/get-version.mjs
}

build_linux() {
  # Installer bundles; the raw ELF binary at target/release/demonsave-ps3 is
  # always emitted too and staged below as the portable .tar.gz.
  npx tauri build --bundles deb,rpm
}

build_windows() {
  # Cross-compile via the baked /usr/local/cargo/config.toml (lld-link +
  # /opt/xwin). --no-bundle: the NSIS installer stays CI-owned.
  # CC/CXX envs are future-proofing for any transitive C deps (none today).
  export CC_x86_64_pc_windows_msvc=clang-cl
  export CXX_x86_64_pc_windows_msvc=clang-cl
  npx tauri build --target x86_64-pc-windows-msvc --no-bundle
}

stage_linux() {
  local ver
  ver="$(app_version)"

  # Installers: copy .deb/.rpm from bundle/ with the group prefix
  # (mirrors release.yml staging; the RPM bundler is pure Rust — no rpmbuild).
  find src-tauri/target/release/bundle -type f \
    \( -name '*.deb' -o -name '*.rpm' \) -print0 |
    while IFS= read -r -d '' f; do
      base="$(basename "$f")"
      cp "$f" "${OUT_DIR}/linux-installer-${base}"
    done

  # Portable: tar.gz the raw ELF, member renamed to self-identify its version
  # and to preserve the executable bit on extraction.
  if [ -f src-tauri/target/release/demonsave-ps3 ]; then
    local stage
    stage="$(mktemp -d)"
    cp -p src-tauri/target/release/demonsave-ps3 \
      "${stage}/demonsave-ps3_${ver}"
    tar -czf "${OUT_DIR}/linux-portable-demonsave-ps3_${ver}.tar.gz" \
      -C "$stage" "demonsave-ps3_${ver}"
    rm -rf "$stage"
  else
    echo "::error::linux build did not emit target/release/demonsave-ps3" >&2
    exit 1
  fi
}

stage_windows() {
  local ver
  ver="$(app_version)"
  local exe="src-tauri/target/x86_64-pc-windows-msvc/release/demonsave-ps3.exe"
  if [ ! -f "$exe" ]; then
    echo "::error::windows build did not emit ${exe}" >&2
    exit 1
  fi
  # Zip the versioned .exe (flat member), mirroring release.yml's portable
  # staging (zip instead of 7z — same flat layout, both are preinstalled).
  local stage
  stage="$(mktemp -d)"
  cp -p "$exe" "${stage}/windows-portable-demonsave-ps3_${ver}.exe"
  (cd "$stage" && zip -q -9 \
    "${OUT_DIR}/windows-portable-demonsave-ps3_${ver}.zip" \
    "windows-portable-demonsave-ps3_${ver}.exe")
  rm -rf "$stage"
}

# Runs as root; the bind-mounted repo shows container writes on the host.
# chown the known output paths to the invoking host user (passed by build.sh
# as HOST_UID/HOST_GID) so artifacts aren't root-owned and undeletable.
# Cache volumes (node_modules, src-tauri/target) stay root-owned on purpose —
# only this same container reuses them.
chown_outputs() {
  if [ -n "${HOST_UID:-}" ]; then
    local gid="${HOST_GID:-$HOST_UID}"
    local p
    for p in "$OUT_DIR" /work/dist /work/src-tauri/gen /work/js/version.js; do
      if [ -e "$p" ]; then
        chown -R "$gid:$gid" "$p" 2>/dev/null || true
      fi
    done
  fi
}
trap chown_outputs EXIT

# ── Run ────────────────────────────────────────────────────────────────────

echo "=== DemonSave-PS3 builder: target=${TARGET} ==="
install_js_deps

case "$TARGET" in
  linux)
    build_linux
    stage_linux
    ;;
  windows)
    build_windows
    stage_windows
    ;;
  all)
    build_linux
    stage_linux
    build_windows
    stage_windows
    ;;
esac

echo "=== Staged files ==="
ls -la "$OUT_DIR"
echo "=== Done (host path: ./build-output/) ==="
