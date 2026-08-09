# How to Build

Everything you need to build, run, test, and package DemonSave-PS3.
The project is plain ES-module JavaScript — no compile step is required
to run it. There are multiple build paths depending on what you want:

- **Run it in a browser** (dev server or airgapped ZIP)
- **Package it as a native desktop app** (Tauri v2, per-platform)
- **Release it via CI** (GitHub Actions, all platforms at once)

---

## Table of contents

1. [Prerequisites by platform](#1-prerequisites-by-platform)
2. [Install dependencies](#2-install-dependencies)
3. [Run from source (dev server)](#3-run-from-source-dev-server)
4. [Build a browser ZIP (file:// — no server)](#4-build-a-browser-zip-file--no-server)
5. [Build the Tauri frontend (dist/)](#5-build-the-tauri-frontend-dist)
6. [Run the Tauri dev window](#6-run-the-tauri-dev-window)
7. [Build the Tauri desktop app (production)](#7-build-the-tauri-desktop-app-production)
8. [Custom app icons](#8-custom-app-icons)
9. [Tests](#9-tests)
10. [Lint & Format](#10-lint--format)
11. [Code generation (des-db index)](#11-code-generation-des-db-index)
12. [CI / Releases (GitHub Actions)](#12-ci--releases-github-actions)
13. [Build artifact reference](#13-build-artifact-reference)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites by platform

### Common (all platforms)

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 18+ | 20 or 24 recommended |
| **npm** | bundled with Node | |

The browser-only build paths (sections 3–4) need **only** Node + npm.
The Tauri paths (sections 5–7) additionally require Rust and system
webview libraries.

### Linux (Debian / Ubuntu)

**Rust** — install via [rustup](https://rustup.rs):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

**System packages** (Tauri / WebKitGTK dependencies):

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Windows

**Rust** — install via [rustup](https://rustup.rs). Use the MSVC
toolchain (the default).

**Microsoft C++ Build Tools** — install "Visual Studio Build Tools
2022" with the "Desktop development with C++" workload. Rust's MSVC
target needs the MSVC linker.

**WebView2** — preinstalled on Windows 10/11. If missing, install the
Evergreen Runtime from Microsoft.

### macOS

**Rust** — install via [rustup](https://rustup.rs).

**Xcode Command Line Tools:**

```bash
xcode-select --install
```

No additional system packages are needed — macOS ships with the
system webview (WebKit/WKWebView).

---

## 2. Install dependencies

```bash
npm install
```

This installs both runtime deps (`@noble/ciphers`, `@noble/hashes`,
`fflate`) and dev deps (`@tauri-apps/cli`, `jest`, `esbuild`,
`eslint`, `stylelint`).

For reproducible / CI installs, use:

```bash
npm ci
```

> If `npm ci` fails (e.g. lockfile drift), fall back to `npm install`.

---

## 3. Run from source (dev server)

The fastest way to run the editor. Serves the project root on
`http://localhost:1420` so the import map in `index.html` can resolve
bare module specifiers (`@noble/...`, `fflate`) from `node_modules/`.

```bash
npm run serve:dev
```

Then open **http://localhost:1420** in a browser.

- **Chromium-based browser recommended** — the File System Access API
  (`showDirectoryPicker`) enables in-place save-back to disk.
- **Firefox / Safari** — work via drag-and-drop folder loading; export
  is a ZIP download.

**Stop:** `Ctrl+C`

> This is a zero-dependency static file server
> (`tools/serve-dev.mjs`). Any other static server (e.g.
> `npx serve`, `python3 -m http.server`) works too — just make sure
> the project root (with `node_modules/`) is the served directory.

---

## 4. Build a browser ZIP (file:// — no server)

Produces a browser-ready distribution that works when opened
**directly from the file system** — fully airgapped, no web server.

### Why bundling is needed

The source files use ES module `import` / `export`. Browsers block
cross-origin module requests on `file://` URLs (CORS). The build
script uses **esbuild** to bundle all JS into a single IIFE file and
generates a modified `index.html` that references it via a classic
`<script>` tag (which works on `file://`).

### Build the ZIP (default)

```bash
node tools/pack-html-dist.mjs
```

Output in `dist/`:

| File | Description |
|---|---|
| `demonsave_ps3_html.zip` | ZIP containing 3 files (see below) |
| `demonsave_ps3_html.zip.sha256` | SHA-256 checksum |

ZIP contents (preserves directory layout):

```
demonsave_ps3_html/
  index.html         (modified: classic <script>, no import map)
  css/styles.css     (unchanged)
  js/app.bundle.js   (all JS bundled into IIFE via esbuild)
```

Extract and double-click `index.html` — it opens in any browser,
no server required.

### Build raw files only (no ZIP)

```bash
node tools/pack-html-dist.mjs --raw-only
# alias: --no-zip
```

Output in `dist/demonsave_ps3_html/`:

```
index.html
css/styles.css
js/app.bundle.js
```

No ZIP or `.sha256` is generated.

---

## 5. Build the Tauri frontend (dist/)

Builds the production frontend into `dist/` for Tauri to embed. This
is normally run **automatically** by `tauri build` (configured as
`beforeBuildCommand` in `tauri.conf.json`), but you can run it
manually to inspect the output.

```bash
npm run build:frontend
```

What it does:

1. Ensures runtime deps exist (`@noble/*`, `fflate`) — installs
   missing ones automatically.
2. Cleans and recreates `dist/`.
3. Copies `index.html` (with import map rewritten:
   `./node_modules/` → `./vendor/`), `css/styles.css`, and all
   `.js` files under `js/`.
4. Copies runtime dependency files to `dist/vendor/` (Tauri rejects
   `dist/` folders containing a `node_modules/` subdirectory).

> You usually don't run this directly — `npm run tauri:build` (and
> `npm run tauri:dev`) invoke it for you.

---

## 6. Run the Tauri dev window

Starts the dev server (`tools/serve-dev.mjs`) and opens a native
desktop window with live reload. This is the Tauri development loop.

```bash
npm run tauri:dev
```

### WSL2 (Windows Subsystem for Linux)

On WSL2 you may see `libEGL` / `MESA: ZINK` GPU warnings. These are
cosmetic — WSL2 doesn't support GPU-accelerated OpenGL, so the
webview falls back to software rendering (llvmpipe). The app works
fine.

To suppress the warnings, use the WSL-specific script:

```bash
npm run tauri:dev:wsl
```

This sets `LIBGL_ALWAYS_SOFTWARE=1` and
`WEBKIT_DISABLE_COMPOSITING_MODE=1`.

---

## 7. Build the Tauri desktop app (production)

Builds a native desktop installer for the **current platform**.
Tauri **cannot cross-compile** — you must build on the target OS
(or use [CI](#12-ci--releases-github-actions)).

### Quick build (all bundle types for the current OS)

```bash
npm run tauri:build
```

This runs `npm run build:frontend` first, then compiles the Rust
binary and bundles the platform installer(s).

### Build specific bundle types

Use `--bundles` to select specific formats:

```bash
npx tauri build --bundles <type>[,<type>...]
```

---

### Linux

Output directory: `src-tauri/target/release/bundle/`

| Command | Output | Size | Notes |
|---|---|---|---|
| `npx tauri build --bundles deb` | `.deb` | a few MB | Relies on system WebKitGTK |
| `npx tauri build --bundles rpm` | `.rpm` | a few MB | Pure-Rust RPM bundler — no Fedora host needed |
| `npx tauri build --bundles deb,rpm` | both | a few MB each | Native installers |
| `npx tauri build --no-bundle` | Raw binary | a few MB | Portable; needs system WebKitGTK |
| `npm run tauri:build` | all of the above | varies | Default: builds every format |

The **portable** raw binary is also produced at:

```
src-tauri/target/release/demonsave-ps3
```

> The `.deb` / `.rpm` / raw binary are small because they depend on
> the system-installed WebKitGTK webview. RPM bundling works on
> Ubuntu — Tauri v2's RPM bundler is pure Rust (the `rpm` crate) and
> does not require `rpmbuild` or a Fedora host.

#### Runtime dependencies for the portable binary

The `.deb` / `.rpm` installers declare their dependencies, so
`dpkg`/`rpm` pulls the required libraries automatically. The **raw
portable binary** does not — if it fails to launch, install the
runtime libraries manually:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-0 libssl3 \
  libayatana-appindicator3-1 librsvg2-2
```

---

### Windows

**Prerequisites:** Rust (MSVC toolchain), Visual Studio Build Tools
(C++ workload), WebView2 Runtime.

Output directory: `src-tauri/target/release/bundle/`

| Command | Output | Location |
|---|---|---|
| `npx tauri build --no-bundle` | Portable binary only (no installer) | `target/release/` |
| `npm run tauri:build` | NSIS installer `.exe` + portable binary | `bundle/nsis/` + `target/release/` |

The **portable** raw executable is also produced at:

```
src-tauri/target/release/demonsave-ps3.exe
```

This is the standalone `.exe` with no installer wrapper.

> **CI releases ship the NSIS installer and portable `.exe`.**
> Build in a native Windows environment (PowerShell, CMD, or Git
> Bash). Building from WSL2 produces a Linux binary, not a Windows
> one.

---

### macOS

**Prerequisites:** Rust, Xcode Command Line Tools.

Output directory: `src-tauri/target/release/bundle/`

| Command | Output | Location |
|---|---|---|
| `npx tauri build --bundles app` | `.app` bundle | `bundle/macos/` |
| `npx tauri build --bundles dmg` | `.dmg` disk image | `bundle/dmg/` |
| `npm run tauri:build` | `.dmg` + `.app` | `bundle/dmg/` + `bundle/macos/` |

> **CI releases ship a zipped `.app` and `.dmg` (Apple Silicon /
> M1-M3 only).** The `.app` is a directory — the release workflow
> zips it with `ditto -c -k --keepParent` so it can be attached to
> the GitHub Release. `macos-latest` = ARM64, so Intel Macs are not
> supported by the published build.

#### macOS Gatekeeper ("unidentified developer") warning

The CI builds are **not code-signed or notarized**. On first launch,
macOS Gatekeeper will block the app with one of:

- *"`DemonSave-PS3` cannot be opened because the developer cannot be
  verified."*
- *"`DemonSave-PS3` is damaged and can't be opened."* (quarantine
  attribute on some macOS versions)

**Workaround (pick one):**

1. **Right-click → Open** — Right-click (or ⌘-click) the `.app` and
   select "Open", then click "Open" in the confirmation dialog. This
   only needs to be done once.
2. **System Settings** — Attempt to open the app once (let it be
   blocked), then go to *System Settings → Privacy & Security* and
   click "Open Anyway".
3. **Terminal (`xattr`)** — Strip the quarantine attribute entirely:

   ```bash
   xattr -cr /Applications/DemonSave-PS3.app
   ```

> For distribution outside of the App Store, you'll need to
> code-sign and notarize the `.app` / `.dmg` with your Apple
> Developer credentials. This is outside the scope of the build
> itself.

---

## 8. Custom app icons

Generate all icon formats from a single 1024×1024 PNG:

```bash
npm run tauri:icon path/to/your-icon.png
```

This overwrites the placeholder icons in `src-tauri/icons/`
(`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`,
`icon.ico`, `icon.png`).

---

## 9. Tests

Tests use **Jest** with native ES module support
(`--experimental-vm-modules`).

### Run all unit tests

```bash
npm test
```

### Run a specific test suite

| Command | Scope |
|---|---|
| `npm run test:savefile` | `tests/des-savefile/` — editor, save API (incl. encrypted), model |
| `npm run test:ui` | `tests/ui/` — DOM, form rendering, tables, widgets, event dispatch, IO |
| `npm run test:ps3-lib` | `tests/lib/ps3-save-lib/` — crypto, endian, hex, PFD, SFO, save-folder, encrypted export |
| `npm run test:db` | `tests/des-db/` — game data integrity (regenerates the DB index first) |

### Run integration tests

Integration tests write to disk and are kept separate from unit
tests so `npm test` stays fast.

```bash
npm run test:integration
```

These run round-trip tests (save → edit → re-save → re-read) using
the configs in `jest.integration.config.js`.

### Fuzzing (coverage-guided)

Every untrusted-binary parser, the serializer, the save pipeline, and the
write/encrypt path are verified by coverage-guided fuzzing with [Jazzer.js](https://github.com/CodeIntelligenceTesting/jazzer.js)
(libFuzzer-based). Fuzzing runs as **standalone** `npx jazzer` targets —
separate from the Jest suite — and a Jest regression test per target locks in
findings. The clean-failure contract under test lives in the shared
`fuzz/oracle.js`, used by both halves so they cannot disagree.

| Target (`npm run fuzz:<t>`) | Fuzzes | Notable findings |
|---|---|---|
| `readsave` | `readSave()` USER.DAT parser | non-finite floats (NaN/Infinity) silently returned |
| `pfd` | `parseParamPfd()` integrity envelope | min-size guard 96→120 (count fields OOB) |
| `sfo` | `parseParamSfo()` metadata | unchecked key offset + INT32 width (DataView OOB) |
| `roundtrip` | read→write→read idempotency | (calibration: writer's deposit normalizations are intentional) |
| `pipeline` | full `openSave()` (decrypt-skip + read + sanitize) | — |
| `encexport` | `open→exportEncryptedSave→open→writeSaveData→open` (write/encrypt path) | — |
| `crypto` | `encryptFile↔decryptFile` cipher round-trip | — |
| `pfdcreate` | `createPfdForFiles` → hash chain → serialize → parse | — |
| `pfdserialize` | PFD serializer (parse→clone→serialize→parse) | — |
| `savefolder` | save-folder.js API (decrypt/encrypt/rebuild/findEntry) + `rebuildParamPfd` | — |
| `sfofields` | PARAM.SFO field getters + raw-byte mutators (ATTRIBUTE/ACCOUNT_ID) | — |

Commands (each has a `:smoke` variant bounded to 60s for CI):

```bash
npm run fuzz:corpus          # (re)generate all seed corpora in fuzz/corpus/
npm run fuzz:readsave        # open-ended run of one target (local)
npm run fuzz:readsave:smoke  # bounded 60s run (CI mode — a finding fails CI)
npm run fuzz:cov             # replay all corpora under c8 → per-file coverage (js/ logic only; scope configured in .c8rc.json, excl. js/ui, des-db, tauri-bridge, version)
```

Per-target Jazzer tuning (`--sync`, `-max_len`, `-timeout`) and the shared
`-artifact_prefix`/smoke budget live in [`tools/fuzz.mjs`](tools/fuzz.mjs),
which the `fuzz:<t>` / `fuzz:<t>:smoke` scripts invoke. Use
`node tools/fuzz.mjs <t> --dry-run` to print the resolved jazzer command.

Findings (crash / timeout / OOM) are written to `fuzz/crashes/`. To triage one:

1. Replay the artifact deterministically, e.g.
   `npx jazzer fuzz/pfd.fuzz.js fuzz/crashes/<file> --sync -- -runs=1`
2. Minimize it: add `-minimize_crash=1 -runs=...`.
3. Fix the underlying missing guard, then add a minimal reconstruction to the
   matching `tests/fuzz/regression-*.test.js` so it can never regress.

> CI runs `fuzz:corpus` then all eleven `fuzz:<t>:smoke` steps on every push.
> The round-trip target checks **writer idempotency** (a fixed point) rather
> than read-vs-first-write equality, which makes it immune to the writer's
> intentional first-write normalizations (deposit `flags[0]`/`sortOrder`/
> per-category durability, and the spell/deposit region overlap for impossible
> spell counts) while still catching genuine serialization bugs. Real-save
> read↔write fidelity is covered by the integration tests. The `encexport`
> target uses the same idempotency framing (comparing two post-write reads
> across the export/write-back pipeline) for the same reason.

---

## 10. Lint & Format

### Lint everything

```bash
npm run lint
```

Runs both CSS and JS linters.

### Lint individually

| Command | Linter | Scope |
|---|---|---|
| `npm run lint:css` | Stylelint (`stylelint-config-standard`) | `css/**/*.css` |
| `npm run lint:js` | ESLint (`@eslint/js` recommended) | `js/`, `tests/`, `tools/`, `integration-tests/`, `fuzz/` |
| `npm run lint:types` | TypeScript (`tsc --checkJs`) | `js/` (excl. `js/ui/`), `tools/` — JSDoc type checking, 0 errors |

### Format code

Prettier enforces consistent code style (indentation, quotes, trailing
commas, etc.). Configuration lives in `.prettierrc.json`; paths to skip
are listed in `.prettierignore`.

```bash
npm run format         # auto-format all JS/MJS files in place
npm run format:check   # check only (CI mode — exits non-zero if changes needed)
```

Both commands target `js/**/*.js`, `tests/**/*.js`, `tools/**/*.mjs`,
`integration-tests/**/*.js`, `fuzz/**/*.js`, and top-level `*.js` files.

---

## 11. Code generation (des-db index)

Generates a reverse lookup index from
`js/des-db/weapons.js` mapping each `upgrade_ref`
(`[base_weapon_id, path_id, level]`) to `{ category, id }`.

```bash
npm run gen:db-index
```

Output: `js/des-db/idx-upgrade-ref.js` (generated — do not edit
manually).

This also runs automatically as a `pretest:db` hook before
`npm run test:db`.

> The generator supports reproducible builds: set
> `SOURCE_DATE_EPOCH` to embed a deterministic timestamp instead of
> the current time.

---

## 12. CI / Releases (GitHub Actions)

The workflow at `.github/workflows/release.yml` automates
cross-platform builds. Tauri cannot cross-compile, so each platform
builds on its own runner in parallel.

### Triggers

| Event | What happens |
|---|---|
| Push to `main` / `master` | Runs lint + unit tests (Linux runner). Build artifacts are uploaded as CI artifacts. |
| Tag push (`v*`, e.g. `v1.0.0`) | Builds all platforms in parallel and creates a **draft GitHub Release** with downloadable installers. |

### Cut a release

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Build matrix (tag push)

| Job | Runner | Output | Release asset prefix |
|---|---|---|---|
| Tauri (Linux installers) | `ubuntu-22.04` | `.deb`, `.rpm` | `linux-installer-*` |
| Tauri (Linux portable) | `ubuntu-22.04` | `.tar.gz` (compressed binary) | `linux-portable-*` |
| Tauri (Windows) | `windows-latest` | NSIS `.exe` + portable `.exe` | `windows-*` |
| Tauri (macOS) | `macos-latest` | Zipped `.app` + `.dmg` (Apple Silicon only) | `macos-*` |
| Browser ZIP | `ubuntu-22.04` | `demonsave_ps3_html.zip` | `browser-*` |
| Release | `ubuntu-22.04` | Draft GitHub Release | (collects all prefixed assets) |

A dedicated `release` job downloads all staged assets and attaches
them to a single draft release via `softprops/action-gh-release`.
Alphabetical sorting on the release page groups the two Linux
formats into visually distinct blocks.

---

## 13. Build artifact reference

Where every build output lands:

| Build method | Output path |
|---|---|
| Dev server | (served in-memory at `http://localhost:1420`) |
| Browser ZIP | `dist/demonsave_ps3_html.zip`, `dist/demonsave_ps3_html.zip.sha256` |
| Browser raw files | `dist/demonsave_ps3_html/{index.html,css/styles.css,js/app.bundle.js}` |
| Tauri frontend | `dist/` (index.html, css/, js/, vendor/) |
| Tauri — Linux `.deb` / `.rpm` | `src-tauri/target/release/bundle/deb/`, `src-tauri/target/release/bundle/rpm/` |
| Tauri — Linux raw binary | `src-tauri/target/release/demonsave-ps3` |
| Tauri — Windows NSIS | `src-tauri/target/release/bundle/nsis/*.exe` |
| Tauri — Windows portable | `src-tauri/target/release/demonsave-ps3.exe` |
| Tauri — macOS `.app` | `src-tauri/target/release/bundle/macos/*.app` |
| Tauri — macOS `.dmg` | `src-tauri/target/release/bundle/dmg/*.dmg` |
| Generated DB index | `js/des-db/idx-upgrade-ref.js` |
| Test coverage | `coverage/` (if generated) |

Ignored by git (see `.gitignore`): `node_modules/`, `dist/`,
`src-tauri/target/`, `src-tauri/gen/`, `coverage/`, `tmp/`.

---

## 14. Troubleshooting

### `npm ci` fails

`npm ci` requires `package-lock.json` to be in sync with
`package.json`. If it fails (lockfile drift after a dependency
change), fall back to:

```bash
npm install
```

### WSL2 GPU warnings (`libEGL`, `MESA: ZINK`)

These are cosmetic. WSL2 doesn't support GPU-accelerated OpenGL, so
the Tauri webview falls back to software rendering (llvmpipe). The
app works fine. To silence the warnings:

```bash
npm run tauri:dev:wsl
```

### Tauri rejects `dist/` containing `node_modules/`

Tauri's bundler refuses to embed a `node_modules/` directory. The
`build-frontend` script handles this by copying runtime dependency
files to `dist/vendor/` and rewriting the import map in the copied
`index.html` (`./node_modules/` → `./vendor/`). If you see this
error, make sure you're running the official `npm run build:frontend`
script and not a manual copy.

### esbuild not found

`esbuild` is a dev dependency. If `pack-html-dist.mjs` fails with an
esbuild error, ensure dev dependencies are installed:

```bash
npm install
```

The script calls esbuild via `npx esbuild`, which resolves from
`node_modules/`.

### Tauri build fails on Linux (missing system packages)

Re-run the system package install from
[Prerequisites — Linux](#linux-debian--ubuntu). The most commonly
missing package is `libwebkit2gtk-4.1-dev`. All required packages
are listed there.

### Tauri build fails on Windows (linker error)

Install the **Microsoft C++ Build Tools** (Visual Studio Build Tools
2022 with the "Desktop development with C++" workload). Rust's MSVC
target needs the MSVC linker (`link.exe`).

### Tauri build fails on macOS (xcode tools)

```bash
xcode-select --install
```

Then re-run the build.

### Can't cross-compile

Tauri **cannot** cross-compile. Each platform must be built on its
own OS. Options:

1. Build natively on each OS you own.
2. Use the included GitHub Actions workflow (push a tag — see
   [CI / Releases](#12-ci--releases-github-actions)).
3. Use a VM or remote machine for the target OS.