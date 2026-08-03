# ps3-save-lib

A generic, self-contained JavaScript library for loading, decrypting, and encrypting PS3 game save files.

## Overview

This library implements the PS3 save file protection scheme:

- **PARAM.SFO** — Metadata file parsing (title, subtitle, account ID, copy-protection ATTRIBUTE)
- **PARAM.PFD** — Protection envelope (header, signature, hash/entry tables, realkey derivation)
- **File encryption** — Custom CTR-like AES-128 transform for protected files
- **SaveFolder** — High-level orchestrator for save folders (encrypted + unencrypted modes)

## Dependencies

- `@noble/ciphers` `^2.2.0` (npm) — AES-128 ECB/CBC primitives
- `@noble/hashes` `^2.2.0` (npm) — HMAC-SHA1

Both libraries are zero-dependency, audited (Cure53), and work in Node.js and the browser.

All other utilities (hex, endian, ascii) are bundled internally — no dependency on the host project.

### Browser loading

In the browser, noble packages are loaded via an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) in `index.html`. They resolve to local copies in `node_modules/`, so the app works fully offline / air-gapped:

```html
<script type="importmap">
{
  "imports": {
    "@noble/ciphers/aes.js": "./node_modules/@noble/ciphers/aes.js",
    "@noble/hashes/hmac.js": "./node_modules/@noble/hashes/hmac.js",
    "@noble/hashes/legacy.js": "./node_modules/@noble/hashes/legacy.js"
  }
}
</script>
```

No bundler is required — the library uses native ES module imports throughout. Only 7 local files (172 KB) are needed at runtime: `aes.js`, `_polyval.js`, `utils.js` under `@noble/ciphers/`, and `hmac.js`, `legacy.js`, `_md.md`, `utils.js` under `@noble/hashes/`.

## Directory Structure

```
ps3-save-lib/
├── index.js              # Public API barrel export
├── param-sfo.js           # PARAM.SFO parsing
├── param-pfd.js           # PARAM.PFD parsing/serialization/encryption
├── save-folder.js         # High-level save folder orchestrator
├── crypto/
│   ├── aes.js            # AES-128-CBC and AES-128-ECB primitives (disablePadding)
│   ├── ctr-like.js        # Custom CTR-like transform (batched, optimized)
│   ├── hmac-sha1.js       # HMAC-SHA1 hashing
│   └── static-keys.js     # PS3 static key table
├── util/
│   ├── hex.js            # Hex string / byte-array helpers
│   ├── ascii.js          # ASCII encoding/decoding helpers
│   └── endian.js         # Big-endian binary readers/writers + byte-swap helpers
└── README.md
```

## Performance

The crypto layer is optimized for the small-file, per-block access patterns of PS3 saves:

- **Batched CTR transform** (`ctr-like.js`): Cipher context is created once per file (not per 16-byte block). All counter blocks are batch-built and encrypted in a single ECB call; all data blocks are batch-encrypted/decrypted in a single call. This eliminates per-block key-expansion overhead and reduces JS↔native call count from O(n) to O(1).
- **Zero-padding control** (`aes.js`): CBC and ECB are initialized with `{ disablePadding: true }` to match zero-padding semantics. PKCS7 validation/insertion is never triggered.
- **Skip redundant hash validation** (`param-pfd.js`): `rebuildParamPfd` tracks entries whose hashes were already computed during the encryption loop and passes a `skipSet` to `validAllParamHashes`, avoiding redundant HMAC-SHA1 calls during rebuild.
- **Single-buffer serialization** (`getParamPfdCombinedData`): Pre-allocates `Uint8Array(0x8000)` and writes directly, avoiding intermediate array-of-parts + concat allocations.
- **Cached DataView** (`util/endian.js`): Readers/writers use a WeakMap-cached DataView per Uint8Array, avoiding per-call DataView allocation.
- **Cached hash keys** (`forEachActiveHashIndex`): For non-SFO files where the hash key is the same across all indices, the key is computed once per entry and reused.
- **Safe-copy static keys** (`getStaticKey`): Returns a fresh copy on every call. Eliminates cache-poisoning risk at negligible cost.

## Usage

```js
import {
  // Save Folder — high-level API
  createSaveFolder,
  decryptToBytes,
  encryptBytes,
  rebuildChanges,

  // PARAM.SFO — metadata
  parseParamSfo,
  removeCopyProtection,
  getSfoAccountId,
  writeSfoAccountId,

  // PARAM.PFD — encryption envelope
  createPfdForFiles,
  cloneParamPfd,
  encryptFile,
  decryptFile,
  validAllParamHashes,
  validateParamPfdDetailed,
  getParamPfdCombinedData,
} from '../lib/ps3-save-lib/index.js';
```

## Key API Contracts

### `encryptFile(fileData, entryName, pfd, skipValidation)` — Plaintext Only

The `fileData` parameter **must be plaintext**, not ciphertext. The function
always encrypts its input.

**Double-encryption guard:** When `skipValidation` is `false` (default), the
function checks whether the input data's hashes already match the entry's
stored hashes. If they do, it **throws** to prevent accidental
double-encryption. Pass `skipValidation=true` to bypass this guard — e.g.,
when you are certain the input is plaintext, or when intentionally
re-encrypting.

Callers that need to skip redundant encryption should check
`isValidEntryHash(data, entryName, pfd)` before calling `encryptFile`.

### `decryptFile(fileData, entryName, pfd, force)` — Optional Force Mode

By default, `decryptFile` validates the entry hash before decrypting and
throws if the data is corrupt. Pass `force=true` as the 4th argument to
skip validation and decrypt regardless — useful for inspecting partially
corrupted saves.

### `getStaticKey(name)` — Safe Copy

Returns a fresh copy of the cached key on every call. Safe to mutate —
the copy is only 16–20 bytes, so the allocation cost is negligible
compared to the downstream crypto operation.

### `cloneParamPfd(pfd)` — Deep Copy

Creates a fully independent deep copy of a ParamPFD object, copying all
Uint8Array fields. Useful for preserving original state before modifications.

### `validateParamPfdDetailed(fileData, pfd)` — Diagnostic Validation

Returns `{ valid: boolean, failures: Array }` with detailed information about
each validation failure, instead of the opaque boolean from
`validAllParamHashes`.

### `writeSfoAccountId(rawSfo, hexStr)` — Minimum Length Validation

Throws if the cleaned hex string is shorter than 16 characters (8 bytes).
This prevents accidentally binding a save to the wrong PSN account via a
truncated or mistyped account ID.

## Known Limitations

- **Identity fields** (`consoleID`, `userID`, `authID`, `discHashKey`): These
  are initialized to hardcoded defaults and **not parsed from the PFD binary**.
  For non-trophy saves, only hash index 0 is validated, so this is correct for
  game saves. Trophy saves on real hardware would need actual identity fields.

## Supported Save Types

- **Encrypted saves** (real PS3): PARAM.PFD + encrypted USER.DAT files
- **Unencrypted saves** (RPCS3): raw USER.DAT files + PARAM.SFO
- **Trophy saves**: TROPSYS.DAT, TROPUSR.DAT, TROPTRNS.DAT, TROPCONF.SFM