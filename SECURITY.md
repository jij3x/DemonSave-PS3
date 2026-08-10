# Reporting a vulnerability in DemonSave-PS3

DemonSave-PS3 is a no-server, no-install save editor that decrypts, edits,
re-encrypts, and rehashes real Demon's Souls (PS3) save data entirely in your
browser or as a Tauri desktop app. There is no backend, no network service, and
no account system. This policy explains how to report a security issue and what
counts as one.

---

## How to report

Use GitHub's **private vulnerability reporting** on this repository:

1. Go to `github.com/jij3x/DemonSave-PS3/security/advisories/new`.
2. Choose **Report a vulnerability**.

You can also reach it from the **Security** tab → **Report a vulnerability**.

Reports submitted this way are private and visible only to repository
maintainers.

**Please do not open a public issue or pull request for a security bug.** Public
issues can expose details before a fix is available.

---

## What to include

A good report helps us reproduce and confirm quickly:

- **Editor version** — shown in the UI header.
- **Platform** — your OS, and whether you were using the browser version or the
  Tauri desktop build.
- **Save type** — encrypted real-PS3 save, or unencrypted RPCS3 save.
- **Steps to reproduce** — the smallest repro you can manage, and the observed
  impact (crash, hang, corrupt save, wrong data written, private data exposed).
- **A minimal repro save**, if possible.

> **Do not attach a real save that contains private PSN/account data.** If you
> must share a save, redact the account ID / PSN handle first. See
> [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## In scope

Because this is an offline, client-side tool, the security surface is narrow.
The following are security issues:

- **Malformed save data** — crafted `USER.DAT`, `PARAM.PFD`, or `PARAM.SFO`
  input that crashes the editor, hangs it (denial of service), or causes
  out-of-range or otherwise incorrect reads in the parsers.
- **Crypto / save-integrity correctness** — bugs in the decrypt/encrypt/rehash
  or PFD/SFO handling that produce a save the console rejects, or one that
  loads but silently corrupts progress.
- **Private-data leakage or unintended writes** — logic bugs that expose
  private data (such as a PSN account ID) or write bytes the user did not
  request.
- **Tauri desktop build** — anything that escapes the app's intended local-file
  scope or otherwise breaks the desktop sandbox.
- **Dependencies** — a vulnerability in a runtime dependency
  (`@noble/ciphers`, `@noble/hashes`, `fflate`) that is exploitable through any
  of the above.

---

## Out of scope

These are not security issues; please report them as regular issues via
[`CONTRIBUTING.md`](CONTRIBUTING.md):

- **Anything that requires risking a real PSN account or console.** We can't
  validate those reports safely, and we won't ask you to.
- **The hardcoded Demon's Souls Secure File ID and format keys.** These are
  public, reverse-engineered format constants, not secrets.
- **Online play, anti-cheat, and "I got banned" reports.** This is an offline,
  single-player save tool.
- **Ordinary bugs, feature requests, or data loss from misuse** (for example,
  editing a save without keeping a backup). See
  [Stay safe with save data](CONTRIBUTING.md#stay-safe-with-save-data).

---

## Response targets

This is a small, maintainer-run project, so these are **targets, not
guarantees**:

- **Acknowledge** within ~3 business days of the report.
- **Initial assessment** within ~14 days, including whether it is in scope and
  its severity.
- **Fix** targeted for the next release, with a GitHub Security Advisory
  published at disclosure time.

We ask reporters for a ~90-day disclosure window but are happy to coordinate
timing on a case-by-case basis.

---

## Good faith

We appreciate responsible disclosure and will not take action against reporters
acting in good faith. Please give us reasonable time to investigate and ship a
fix before any public disclosure.

---

## Supported versions

We only fix security issues on the latest release. If you're running an older
version, upgrade first and re-check before reporting.

| Version | Supported |
|---|---|
| Latest tagged release (currently 1.1.0) | Yes |
| Older releases | No — upgrade first |
| `main` / dev / unreleased builds | No |
