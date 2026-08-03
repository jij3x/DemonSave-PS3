# Encrypted Save Export — Technical Documentation

## Overview

This document covers encrypted/unencrypted save handling in the editor:

- **Open** both encrypted (PS3) and unencrypted (RPCS3) saves
- **Save** (in-place overwrite) — overwrites the existing save folder on disk
- **Export** — downloads the save folder as a ZIP file

Both Save and Export support a toggle between decrypted (RPCS3) and encrypted (real PS3) output formats.

## PS3 Save File Structure

A real PS3 Demon's Souls save folder contains:

| File | Description |
|------|-------------|
| `PARAM.SFO` | Save metadata (title, attributes, profile number, ACCOUNT_ID) |
| `PARAM.PFD` | Protection file (hash table, encryption keys, signatures) |
| `1USER.DAT` | Character slot 1 save data (encrypted) |
| `2USER.DAT` | Character slot 2 save data (encrypted) |
| `04USER.DAT` | World/portal state data (encrypted) |
| `ICON0.PNG` | Save icon |
| `PIC1.PNG` | Save background image |

RPCS3 saves omit `PARAM.PFD` and store files unencrypted.

## Save Mode Transitions

The editor supports seamless transitions between encrypted and unencrypted states:

| Action | Input State | Output State | Notes |
|--------|------------|-------------|-------|
| Save (decrypted mode) | Unencrypted | Unencrypted | Direct write-back |
| Save (decrypted mode) | Encrypted | **Unencrypted** | Decrypts, deletes PARAM.PFD |
| Save (encrypted mode) | Unencrypted | Encrypted | Creates new PARAM.PFD from scratch |
| Save (encrypted mode) | Encrypted | Encrypted | Re-encrypts with new keys |
| Export (decrypted mode) | Any | Unencrypted | Downloads ZIP with decrypted files |
| Export (encrypted mode) | Any | Encrypted | Downloads ZIP with encrypted files + new PFD |

### Decrypted Mode Always Produces Plaintext

`writeSaveData()` always produces unencrypted output regardless of input state.
If the original was encrypted, the return includes `filesToDelete: Set(['PARAM.PFD'])`
so the caller can remove the stale PFD from disk (in-place writes only).

### In-Place Write: PARAM.SFO Omission Constraint

When `writeSaveData()` is called with `inPlace = true` (the Save button on an
existing save folder), **PARAM.SFO is intentionally excluded** from the
returned `filesToWrite` map.

**Why**: The save folder may still contain `PARAM.PFD` at the time of the
in-place write — the PFD is queued for deletion via `filesToDelete` but the
actual file removal happens after the write completes. If a patched SFO is
written to disk while PARAM.PFD is still present, the editor's `openSave()`
will detect PARAM.PFD and treat the folder as "encrypted" on the next open.
This triggers a decryption pass on already-decrypted (plaintext) files,
causing irrecoverable data corruption.

**What happens instead**:
- The SFO bytes **are** patched in-memory (`session.sfoBytes` is mutated with
  the new profile number and account ID).
- `updateSessionAfterWrite()` syncs the in-memory SFO so subsequent saves in
  the same session use the patched bytes.
- The on-disk PARAM.SFO retains its original content until the user does an
  Export (ZIP download), which writes the patched SFO alongside the rest of
  the folder.

**Impact**: SFO-level changes (profile number, account ID) applied via an
in-place Save will **not** persist to disk until the next Export. This avoids
writing SFO while PFD exists, which would corrupt the entire save.

## Copy-Protection Mechanism

### The ATTRIBUTE Field
The `ATTRIBUTE` field in `PARAM.SFO` is a 4-byte UINT32 (little-endian) that controls copy-protection:

- **Non-zero** (typically `1`): Copy-protection enabled. PS3 shows "Copying this save data is prohibited."
- **Zero** (`0`): Copy-protection disabled. Save can be freely copied via USB.

### Removal Procedure
`removeCopyProtection(rawSfo)` locates the ATTRIBUTE parameter in the SFO index table and zeros its 4-byte value. This is equivalent to Apollo Save Tool's `sfo_patch_lock()` with `SFO_PATCH_FLAG_REMOVE_COPY_PROTECTION`.

## ACCOUNT_ID (PSN Account Binding)

### Overview
`ACCOUNT_ID` is a 16-byte field in PARAM.SFO that identifies the PSN account. This is the **only** account-binding field — there is no console ID in PARAM.SFO.

- On RPCS3 saves: typically all-zeros (`0000000000000000` as ASCII `0x30` bytes)
- On real PS3 saves: unique 16-byte value tied to the PSN account

### Read/Write Functions
- `getSfoAccountId(rawSfo)` — returns 32-char hex string
- `writeSfoAccountId(rawSfo, hexStr)` — writes hex string to SFO bytes (auto-pads/truncates to 16 bytes)

### UI Integration
- `openSave()` reads ACCOUNT_ID into `model.accountId`
- `populateForm()` fills the `accountId` text input
- `collectForm()` reads it back
- Both `writeSaveData()` and `exportEncryptedSave()` write it to PARAM.SFO

### Usage for Real PS3
When exporting for a different PS3/PSN account, set the Account ID field to match the target PS3's PSN account (32 hex chars). This eliminates the need for Apollo Save Tool in most cases.

## PARAM.PFD Structure

### On-Disk Layout (v3/v4, total 0x8000 bytes)
```
Offset 0    : Magic 0x50464442 ("PFDB") as BE u64
Offset 8    : Version (3 or 4) as BE u64
Offset 16   : header_table_iv (16 bytes, random)
Offset 32   : Encrypted signature (64 bytes, AES-CBC with header_table_iv)
             → Decrypts to: bottomHash(20) + topHash(20) + hashKey(20) + padding(4)
Offset 96   : Hash table header:
               num_reserved (u64 BE), num_total (u64 BE), num_used (u64 BE)
              + num_reserved × 8-byte entry pointers (u64 BE each)
Variable    : PFDEntries (numUsed × 0x110 bytes each)
Variable    : Reserved padding (0x110 × (num_total - num_used) bytes, zeros)
Variable    : Signature table (num_reserved × 20-byte HMAC slots)
End         : Zero-padded to 0x8000 total
```

### Encryption Key Derivation Chain
1. **header_table_iv** (16 bytes) → AES-CBC decrypt the signature block → yields `hashKey`
2. **hashKey** + **keygen_key** → `HMAC-SHA1(keygen_key, hashKey)` → **realkey** (v4 only)
3. **Per-entry key**: `decryptWithPortability(fileHashKey, entry.key)` → 16-byte AES key
   - `fileHashKey` = `savegame_param_sfo_key` for PARAM.SFO
   - `fileHashKey` = `generateHashKeyForSecureFileID(secureFileID)` for USER.DAT files
4. **File data**: CTR-like cipher using the per-entry AES key

### File Encryption (CTR-like)
Each 16-byte block is processed as:
```
Encrypt: XOR(block, AES_ECB(counter)) → AES_ECB_encrypt(result)
Decrypt: AES_ECB_decrypt(block) → XOR(result, AES_ECB(counter))
```
Where `counter` = block index (little-endian u64) padded to 16 bytes.

Uses `@noble/ciphers` for AES-128 ECB/CBC — full encrypt or decrypt of a 0x40000-byte USER.DAT completes in under 100ms.

### PFD Hash Validation Chain
1. **Entry hashes** (per file, 4 slots): `HMAC-SHA1(fileHashKey, fileData)` stored in `entry.fileHashes[i]`
   - Non-trophy saves only use slot 0
   - PARAM.SFO also only uses slot 0
2. **Bucket signature hashes**: `HMAC-SHA1(realkey, chain(entryHashData))` stored in `sigTable[bucketIndex]`
3. **Default hash** for unused buckets: `HMAC-SHA1(realkey, empty)`
4. **Top hash**: `HMAC-SHA1(realkey, hashTableBuffer)`
5. **Bottom hash**: `HMAC-SHA1(realkey, sigTableBuffer)`

### Creating a PFD from Scratch
The `createPfdForFiles()` function:
1. Generates random header_table_iv and hash key
2. Derives realkey via HMAC-SHA1(keygen_key, hashKey)
3. Sets numReserved=114 (matching real DeS saves), numTotal=numUsed
4. Creates entries for each file with random encrypted AES keys
5. Assigns hash table buckets via `calculateHashTableEntryIndex(filename, numReserved)`
6. Handles collisions via `additionEntry` chain pointers
7. After creation, `validAllParamHashes(fileData, true, pfd)` computes all hashes
8. `getParamPfdCombinedData(pfd)` serializes to the 0x8000-byte PFD file

### PARAM.SFO Treatment
PARAM.SFO is **never encrypted** — it's stored as plaintext in the save folder. However, it IS hashed (slot 0) using `savegame_param_sfo_key`. The PFD entry for PARAM.SFO tracks its hash but not encrypted content.

## Static Keys Used
All keys are in `js/lib/ps3-save-lib/crypto/static-keys.js`:

| Key Name | Size | Purpose |
|----------|------|---------|
| `syscon_manager_key` | 16 bytes | AES-CBC encrypt/decrypt entry keys |
| `keygen_key` | 20 bytes | HMAC-SHA1 to derive realkey from hashKey |
| `savegame_param_sfo_key` | 20 bytes | HMAC key for PARAM.SFO entry hash |
| `fallback_disc_hash_key` | 16 bytes | Disc hash key (default) |

## SecureFileID
Demon's Souls uses a hardcoded SecureFileID:
```
0123456789ABCDEFFEDCBA9876543210
```
This is used to derive the HMAC key for all non-SFO files via `generateHashKeyForSecureFileID()`.

## Implementation Details

### Files

| File | Functions |
|------|-----------|
| `js/lib/ps3-save-lib/param-sfo.js` | `removeCopyProtection()`, `getSfoAttribute()`, `getSfoAccountId()`, `writeSfoAccountId()`, `findParamDataOffset()` |
| `js/lib/ps3-save-lib/param-pfd.js` | `createPfdForFiles()`, `createEncryptedEntryKey()`, `generateRandomKey()`, `generateRandomHashKey()` |
| `js/des-savefile/save-api.js` | `exportEncryptedSave()`, `writeSaveData()`, `updateSessionAfterWrite()`, ACCOUNT_ID read/write |
| `js/ui/app.js` | `handleOverwriteDecrypted()`, `handleOverwriteEncrypted()`, `handleExportDecrypted()`, `handleExportEncrypted()` |
| `js/ui/io.js` | `deleteFilesFromDirectory()`, `downloadFilesAsZip()`, `writeZipToHandle()` |

### Save Workflow (In-Place Overwrite)
1. User clicks Save with the encryption toggle set to desired mode
2. Calls `writeSaveData()` (decrypted) or `exportEncryptedSave()` (encrypted) with `inPlace=true`
3. Writes files to the existing save folder via File System Access API (Chromium only)
4. Calls `updateSessionAfterWrite()` to sync in-memory session state

### Export Workflow (ZIP Download)
1. User clicks Export with the encryption toggle set to desired mode
2. Calls `writeSaveData()` (decrypted) or `exportEncryptedSave()` (encrypted) with `inPlace=false`
3. On Chromium: user picks a destination via `showSaveFilePicker()` and the ZIP is written there
4. On other browsers: downloads the ZIP via a plain `<a download>` to the browser's default folder

### Test Coverage (440 total tests)

All tests run together in ~4s. Key test files:
- `param-sfo.test.js` — ACCOUNT_ID read/write, copy-protection removal, profile number round-trip
- `save-api.test.js` — resolve, open, write round-trips (unencrypted)
- `save-api-encrypted.test.js` — encrypted→decrypted transition, filesToDelete, session sync, full cycle
- `editor.test.js` — reader/writer idempotency, inventory/deposit/equipment round-trips, range validation
- `model.test.js` — sanitize/merge round-trip, binary-internal field handling
- `export-encrypted.test.js` — PFD creation, full encrypt→decrypt round-trip

## PFD Hash Slots (Apollo Comparison)

Apollo (`pfd.c`) computes **4 hash slots per file entry** during validation/update:

| Slot | Apollo Constant | Key Used | Our Editor |
|------|----------------|----------|------------|
| 0 (`PFD_ENTRY_HASH_FILE`) | File content HMAC | `savegame_param_sfo_key` (SFO) or `secure_file_id` (USER.DAT) | ✅ Computed |
| 1 (`PFD_ENTRY_HASH_FILE_CID`) | File content HMAC | `console_id` / IDPS (16 bytes) | ❌ Left as zeros |
| 2 (`PFD_ENTRY_HASH_FILE_DHK_CID2`) | File content HMAC | `disc_hash_key` (16 bytes) | ❌ Left as zeros |
| 3 (`PFD_ENTRY_HASH_FILE_AID_UID`) | File content HMAC | `authentication_id` (8 bytes) | ❌ Left as zeros |

The editor only fills **slot 0** (and the full hash chain: top/bottom/bucket signatures). Apollo fills all 4 because it runs on the PS3 itself and has access to the console's IDPS and authentication_id.

**Risk assessment**: The PS3 likely only validates **slot 0** for save data loading — the additional slots are optional security layers. If the PS3 does enforce slots 1-3, the user would need to provide their console's IDPS and authentication_id (extractable via homebrew), which is exactly what Apollo does when running on-console.

### PFD Version
The editor uses PFD version 4 for DeS saves. Apollo does not perform any firmware-specific validation or patching beyond reading the version field.

## Known Limitations
1. **PFD hash slots 1-3**: Only slot 0 is computed; slots 1-3 (console_id, disc_hash_key, authentication_id based) are left as zeros. Risk is low — PS3 likely only validates slot 0 for save loading.
2. **Real PS3 testing**: Tested via round-trip verification in Node.js but not on actual PS3 hardware.
3. **In-place write browser support**: The Save (in-place overwrite) button requires Chromium's File System Access API. On other browsers, use Export (ZIP download) instead.
4. **In-place PARAM.SFO omission**: In in-place mode, `writeSaveData()` intentionally omits PARAM.SFO from `filesToWrite` to avoid double-decryption corruption (see §"In-Place Write: PARAM.SFO Omission Constraint" above). SFO changes (profile number, account ID) are applied in-memory and persist on the next Export.