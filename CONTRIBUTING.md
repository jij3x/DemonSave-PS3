# Contributing to DemonSave-PS3

Thanks for your interest in contributing! DemonSave-PS3 is a no-server,
no-install save editor for Demon's Souls (PS3) written in **plain ES-module
JavaScript** that also ships as a [Tauri](https://tauri.app) desktop app.

This project does byte-exact crypto on real save data, so the bar for
correctness — and the testing discipline behind it — is higher than a typical
web app. Please read the whole guide before opening a pull request.

---

## TL;DR

```bash
npm install            # or: npm ci
npm run lint           # version:check + stylelint + eslint + tsc --checkJs
npm test               # unit tests
npm run test:integration
git checkout -b feat/your-change
# commit with Conventional Commits: feat(scope): ...
git push -u origin feat/your-change   # then open a PR against main
```

Before anything that touches a save path: **back up the save folder you're
testing with.** See [Stay safe with save data](#stay-safe-with-save-data).

---

## Code of Conduct

By participating you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md)
(Contributor Covenant v2.1). Please be respectful and constructive in issues,
PRs, and review.

---

## Stay safe with save data

This tool decrypts, edits, re-encrypts, and rehashes real PS3 saves. A bug in
the reader/writer/PFD/crypto path can silently produce a save that the PS3
rejects — or worse, that loads but corrupts progress.

- **Always keep a backup copy** of any save folder before opening it with a
  development build. Never test against your only copy.
- Prefer the **integration tests** (`npm run test:integration`) and the
  **fuzzers** (`npm run fuzz:smoke`) for save-path changes — they exercise real
  round-trips and the untrusted-binary parsers.
- Don't be the first human to run a save-path change on real hardware. Let the
  test suite and a round-trip diff speak first.

---

## Ways to contribute

- **Bug reports** — open an issue with the exact save scenario, the editor
  build/version (shown in the UI header), and the smallest repro you can manage.
  **Do not attach real saves that contain private PSN/account data.**
- **Feature ideas** — open an issue first to discuss scope before building.
- **Code** — see the development workflow below. The project was built with
  heavy AI assistance; human-written contributions are very welcome, but they're
  held to the same bar (lint, types, tests, architecture rules).

---

## Development setup

**Prerequisites:** Node.js 18+ (20 or 24 recommended) and npm. That's all you
need for browser/dev work. Building the Tauri desktop app additionally requires
Rust and platform webview libraries — see [`howto.md`](howto.md) §1.

```bash
git clone https://github.com/jij3x/DemonSave-PS3.git
cd DemonSave-PS3
npm install        # or: npm ci for reproducible installs
```

### Develop in a container (no host installs)

Prefer not to install Node, Rust, or system webview libraries locally? The repo
ships a full-stack dev container (VS Code / GitHub Codespaces) plus a matching
`docker-compose.yml` for CLI use. It carries Node 24, Rust (stable), and the
WebKitGTK build libs — the same toolchain CI uses (Ubuntu 24.04, glibc ≥ 2.38,
which the Jazzer fuzz targets require).

**VS Code / Codespaces** — open the repo and run the *Dev Containers: Reopen in
Container* command. Deps install automatically; the dev server auto-forwards on
port 1420.

**CLI** —

```bash
docker compose build
docker compose up -d
docker compose exec app bash .devcontainer/post-create.sh   # first-time setup
docker compose exec app npm run serve:dev                    # http://localhost:1420
docker compose exec app npm test
docker compose exec app npm run lint
```

See [`howto.md`](howto.md) §15 for the full command reference, including the
Linux Tauri desktop build and the optional `tauri:dev` GUI recipe. (Windows
and macOS builds remain CI-only or native-host — Tauri can't cross-compile
from Linux.)

### Run the editor locally

```bash
npm run serve:dev   # serves http://localhost:1420
```

A Chromium-based browser is recommended (it supports the File System Access API
for in-place save-back). Firefox/Safari work via drag-and-drop + ZIP export.

### Understand the architecture (please)

Before changing anything in the save pipeline or UI, skim
[`overview.md`](overview.md). The architecture is intentionally layered, and a
few rules are load-bearing:

- **Gateway API pattern.** The UI layer imports **only**
  `js/des-savefile/save-api.js` from the save pipeline. It must never import the
  reader, writer, PFD/SFO, or crypto modules directly.
- **`des-db` is side data, not save logic.** `js/des-savefile/` (the editor core)
  must never import `js/des-db/`. Only the UI reads `des-db` (dropdowns, names).
- **Never expose binary internals to the UI.** Fields like `_slot`, `idx1`,
  `idx2`, and raw deposit flag bytes are represented by opaque `_ref` tokens /
  hidden data and resolved back on save. The DOM must not corrupt what it can't
  see.
- **Surgical, in-place writes.** The writer patches only changed fields at their
  original slot positions; it does not blank or rewrite regions, and it leaves
  active-hand / active-quick-slot selectors alone.
- **`des-db` is immutable and fail-fast** — frozen at load; unknown lookups
  throw rather than return `undefined`.

---

## Code style

Formatting and linting are enforced.

- **Prettier** — single quotes, 100-column width, 2-space indent, trailing
  commas everywhere, always parenthesized arrow params (`.prettierrc.json`).
  Run `npm run format` to auto-fix; `npm run format:check` verifies in CI mode.
- **ESLint** (`@eslint/js` recommended). Notable project rules:
  - `radix: always` → always pass a radix to `parseInt` (`parseInt(x, 10)`).
  - `no-console: off` → `console.error` is fine for error logging.
  - In tests, an `_`-prefix marks intentionally unused params/vars.
- **Stylelint** (`stylelint-config-standard`) for `css/**/*.css`.
- **JSDoc + `tsc --checkJs`.** This is plain JavaScript, **not** TypeScript —
  the source file is the file the browser runs, and that no-build property is
  intentional (see [`README.md`](README.md) §"Why plain JavaScript"). Annotate
  public functions with JSDoc; `npm run lint:types` must report zero errors and
  there must be no `@ts-nocheck` in checked modules. Do not introduce a
  TypeScript compile step or a bundler into the runtime path.

```bash
npm run format      # auto-format
npm run lint        # version:check + stylelint + eslint + lint:types
```

---

## Testing

Testing is the core discipline of this project. Save-path changes without tests
will not be merged.

| Command | What it runs |
|---|---|
| `npm test` | All unit tests (`tests/**`) — fast, no disk I/O |
| `npm run test:savefile` | Editor, save API (incl. encrypted), model |
| `npm run test:ui` | DOM, form rendering, tables, widgets, events, IO |
| `npm run test:ps3-lib` | Crypto, endian, hex, PFD, SFO, save-folder |
| `npm run test:db` | Game-data integrity (regenerates the DB index first) |
| `npm run test:integration` | Full save → edit → re-save → re-read round-trips on disk |
| `npm run test:coverage` | Unit tests with coverage |
| `npm run fuzz:smoke` | All 12 coverage-guided Jazzer fuzz smokes (CI mode) |

**Guidance:**

- Add or update **unit tests** for every behavior change.
- Add an **integration round-trip** for any change to the reader, writer, PFD,
  SFO, crypto, or save API. If your change can produce a save that fails to
  round-trip, an integration test must prove it can't.
- If you fix a missing-guard bug found by fuzzing, add a minimal reconstruction
  to the matching `tests/fuzz/regression-*.test.js` so it can't regress. See
  [`howto.md`](howto.md) §9 (Fuzzing) for triaging/minimizing crash artifacts.
- Regenerate the DB index if you change `js/des-db/weapons.js`:
  `npm run gen:db-index` (it also runs automatically as a `pretest:db` hook).

---

## Generated files — do not edit by hand

These are produced from sources; editing them by hand will be overwritten:

- `js/version.js` — generated from `package.json` by `tools/gen-version.mjs`.
- `js/des-db/idx-upgrade-ref.js` — generated from `js/des-db/weapons.js` by
  `tools/gen-des-db-index.mjs`.

## Versioning & releases

- We follow [Semantic Versioning](https://semver.org/) and
  [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). See
  [`CHANGELOG.md`](CHANGELOG.md).
- `package.json` is the **single source of truth** for the version. After
  bumping it, run `npm run gen:version` to sync `Cargo.toml`, `Cargo.lock`,
  `tauri.conf.json`, and `package-lock.json`. `npm run version:check` (part of
  `lint`) enforces that none drift.
- When updating the changelog, add an entry under `[Unreleased]` using the
  `Added` / `Changed` / `Fixed` / `Removed` / `Deprecated` / `Security`
  headings. One bullet per user-facing change.
- Releases are cut by maintainers by pushing a `v*` tag, which triggers CI to
  build every platform and open a **draft** GitHub Release. (Tauri can't
  cross-compile, so each OS builds on its own runner.) You normally don't tag
  releases yourself.

---

## Git workflow

1. Fork the repo and create a descriptively named branch off `main`
   (e.g. `feat/deposit-count-encoding`, `fix/pfd-oob-read`).
2. Make focused commits. **Commit small and often** — it makes review easier and
   limits blast radius if something needs to be reverted.
3. Keep the branch rebased on `main` if it falls behind.
4. Open a Pull Request against `main`. Reference any related issue.
5. Make sure CI (lint, type checks, unit + integration tests, fuzz smokes) is
   green before requesting review.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with an
optional scope (this matches the existing history):

```
<type>(<scope>): <imperative summary in lowercase>

<optional body, wrapped at ~72 cols>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `ci`, `build`,
`chore`. Example scopes used in this repo: `savefile`, `fuzz`, `version`,
`build`, `ui`, `ps3-lib`, `db`.

```
fix(savefile): guard PFD entry count against out-of-range reads
feat(version): show app version in the header from package.json
docs(savefile): document misc1 sortId semantics
```

A `feat` or `fix` commit that should appear in the changelog is appreciated, but
maintainers finalize `CHANGELOG.md` entries.

---

## Pull request checklist

- [ ] Branch is off `main` and rebased.
- [ ] `npm run format` run; `npm run lint` passes (css + js + types).
- [ ] `npm test` passes; relevant new tests added.
- [ ] `npm run test:integration` passes for any save-path change.
- [ ] No hand-edits to generated files (`js/version.js`,
      `js/des-db/idx-upgrade-ref.js`); regenerated via the right `gen:*` script.
- [ ] `npm run version:check` is clean (or you ran `npm run gen:version`).
- [ ] Architecture rules respected (Gateway API; no `des-db` import in the
      editor core; binary internals stay opaque to the UI).
- [ ] No real save data with private PSN/account info attached to the PR.

---

## Reporting security-relevant bugs

If you find a vulnerability, please **don't open a public issue**. See
[`SECURITY.md`](SECURITY.md) for how to report privately and what's in scope.
(Save-corruption and crypto-integrity issues belong here.)

---

## License

By contributing, you agree your contributions are licensed under the
[MIT License](LICENSE) that covers the project. Demon's Souls is a trademark of
FromSoftware, Inc. / Sony Interactive Entertainment; this project is not
affiliated with or endorsed by them.
