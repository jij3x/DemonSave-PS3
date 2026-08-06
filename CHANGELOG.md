# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Deposit entry count is now encoded as a 10-bit value split across the count
  and flag bytes, preventing truncation for large deposit lists.

### CI
- Removed the release notes `body` from the draft GitHub Release step.

## [1.0.0] - 2026-08-05

First public release.

### Added
- A no-server, no-install save editor for Demon's Souls (PS3) that decrypts,
  parses, edits, re-encrypts, and rehashes saves so they still load on real
  hardware.
- Runs in any modern browser (drag-and-drop plus ZIP export) or as a native
  desktop app via Tauri (Windows, macOS, and Linux) with no backend or native
  dependencies.
- Rebuilds the full `PARAM.PFD` integrity chain (HMAC-SHA1 hashes, AES-CBC
  entry keys, signed header) after edits.
- Bidirectional converter between real-PS3 (encrypted) and RPCS3 (plaintext)
  save formats with one-click conversion.
- Support for all four character slots plus the shared world state, preserving
  any slot that fails to decrypt verbatim.
- Editable character fields: name, gender, phantom type, starting class,
  hairstyle, and hair color.
- Editable stats and vitals: HP, MP, Stamina, all eight attributes (base and
  effective), souls, and soul memory.
- Equipment editing across 18 slots (left/right hands, armor, rings, quick
  slots) with synchronized hotbar pointers.
- Inventory editing for weapons, shields, bows, ammo, armor, rings, and goods,
  including add, edit, duplicate, delete, stack counts, and durability.
- Full spell and miracle list with learn-state editing.
- Item deposit (Thomas's storage) editing with up to 2,048 entries across all
  categories.
- World and character tendency, NPC hostility/dead flags, and warp/spawn
  location editing.
- In-place save-back with an identity check (on Chromium browsers and the
  desktop app) or ZIP export from any browser.
- PSN account binding via `ACCOUNT_ID` patching and copy-protection flag
  zeroing without external tools.
- Cross-platform CI producing Windows NSIS installer and portable executable,
  macOS `.app` zip and `.dmg`, Linux `.deb`, `.rpm`, and portable `.tar.gz`,
  and a platform-independent browser ZIP.
- 1,221 unit tests (~99% line coverage) across 26 suites and 94 integration
  tests running full save, edit, re-save, and re-read round-trips.
- JSDoc type-checking via `tsc --checkJs` with zero errors and zero
  `@ts-nocheck` directives.
- Unit tests for the `tauri-bridge` module.
- Integration tests covering `PARAM.SFO` field round-trips and deposit
  add/delete operations.
- Type-checking enabled for test files.

### Changed
- Separated folder-level `PARAM.SFO` fields from the per-slot save model so
  account and slot data are handled independently.
- Replaced `istanbul ignore` comments with testable bounds helpers, making the
  previously uncovered branches explicit and verifiable.
- Added JSDoc type casts throughout the UI layer for stricter type-checking.
- Consolidated test cases and fixed formatting.
- Bumped development dependencies and applied Prettier formatting.
- Trimmed the auto-generated release body in `release.yml` to an install
  summary and macOS note.

### CI
- Guarded the bundle copy step for `--no-bundle` builds so it no longer fails
  when the `bundle/` directory is absent.
- Staged the Linux portable `.tar.gz` only for the `linux-portable` matrix
  entry to avoid duplicate assets.

[Unreleased]: https://github.com/jij3x/DemonSave-PS3/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jij3x/DemonSave-PS3/releases/tag/v1.0.0