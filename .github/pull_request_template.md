<!-- Thanks for the PR! See CONTRIBUTING.md for the full guide. -->

## Summary

<!-- What does this change do, and why? One or two sentences. -->

Closes # <!-- issue number, if any -->

## Change type

- [ ] feat (new feature)
- [ ] fix (bug fix)
- [ ] docs
- [ ] refactor
- [ ] perf
- [ ] test
- [ ] ci / build / chore
- [ ] **Breaking change** (existing behavior changes)
- [ ] Needs a `CHANGELOG.md` entry under `[Unreleased]` (Added / Changed / Fixed / Removed / Security)

## How this was tested

<!-- Check the commands you actually ran. -->

- [ ] `npm run lint` (css + js + tsc --checkJs)
- [ ] `npm run format:check` (or ran `npm run format`)
- [ ] `npm test` (unit)
- [ ] `npm run test:integration` (round-trips — required for any save-path change)
- [ ] `npm run test:coverage`
- [ ] `npm run fuzz:smoke` (if you touched a parser / serializer / crypto path)
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` (if you touched Rust)

## Architecture rules

<!-- Confirm the load-bearing rules still hold. -->

- [ ] UI imports only `js/des-savefile/save-api.js` from the save pipeline (no direct reader/writer/PFD/SFO/crypto imports).
- [ ] The editor core (`js/des-savefile/`) does **not** import `js/des-db/`.
- [ ] Binary internals (`_slot`, `idx1`, `idx2`, deposit flags) stay opaque to the UI (via `_ref` tokens / hidden data).
- [ ] Writes are surgical and in-place; active-hand / quick-slot selectors are left alone.

## Generated & version hygiene

- [ ] No hand-edits to `js/version.js` or `js/des-db/idx-upgrade-ref.js`.
- [ ] Ran the right `npm run gen:*` if a file they're generated from changed.
- [ ] `npm run version:check` is clean (or I ran `npm run gen:version` after a version bump).

## CI

The `CI` workflow runs three jobs on this PR: `js` (lint/format/tests/coverage),
`rust` (`cargo test`), and `fuzz` (12 parallel smokes). Please make sure they're
green before requesting review.

- [ ] CI is green on this branch.

## Notes for review

<!-- Screenshots for UI changes, round-trip diffs, migration notes — anything
     that helps the reviewer. -->

- [ ] No real save data with PSN / account info is attached to this PR.
