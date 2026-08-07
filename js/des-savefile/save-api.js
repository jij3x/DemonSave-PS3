/**
 * save-api.js — Gateway API for the front-end.
 *
 * This is the ONLY module the UI layer should import for save operations.
 * It hides all complexities: decrypt/encrypt, PFD rebuild, file resolution,
 * model sanitization/merge, and the secondary file write.
 *
 * Crypto operations (decrypt/encrypt) run sequentially on the main thread.
 *
 * Multi-slot API (all slots loaded/saved together):
 *   openSave(rawFiles, onProgress) → { slots, failedSlots, profileNumber, accountId, encrypted }
 *   writeSaveData(slots, failedSlots, profileNumber, accountId, onProgress [, inPlace]) → { filesToWrite, sfoBytes, encrypted, filesToDelete }
 *   exportEncryptedSave(slots, failedSlots, profileNumber, accountId, onProgress [, inPlace]) → { filesToWrite, sfoBytes, encrypted }
 *   updateSessionAfterWrite(slots, filesToWrite, encrypted) → syncs in-memory state after in-place overwrite
 */

import { readSave } from './reader.js';
import { writeSaveInPlace, writeSecondaryFileInPlace } from './writer.js';
import { sanitizeModel, mergeModel } from './model.js';
import {
  fromHex,
  createSaveFolder,
  removeCopyProtection,
  getSfoAccountId,
  writeSfoAccountId,
  createPfdForFiles,
  parseParamPfd,
  validAllParamHashes,
  getParamPfdCombinedData,
  decryptFile,
  encryptFile,
} from '../lib/ps3-save-lib/index.js';

/**
 * @typedef {Object} SaveManager
 * @property {import('../lib/ps3-save-lib/param-pfd.js').ParamPFD|null} pfd
 * @property {Map<string, Uint8Array>} files
 * @property {boolean} encrypted
 */

/**
 * @typedef {Object} SaveSession
 * @property {SaveManager} manager
 * @property {import('./model.js').FullModel} fullModel
 * @property {string} primaryFile
 * @property {string} secondaryFile
 * @property {number} saveSlot
 * @property {Uint8Array} sfoBytes
 * @property {Map<string, {name: string, bytes: Uint8Array}>} rawFiles
 * @property {boolean} encrypted
 * @property {Uint8Array} [decryptedBytes]
 */

/**
 * @typedef {Object} SaveSlot
 * @property {number} slot
 * @property {SaveSession} session
 * @property {import('./model.js').SanitizedModel} model
 * @property {import('./model.js').DisplayData} [display]
 *   Display-only data (equipment pointers, inventory idx1 map). Populated by
 *   `openSave`/`reloadSlotModels`; passed through but never written back.
 */

/**
 * DeS-specific profile number byte offset in PARAM.SFO.
 * (Game-specific — not part of the generic SFO format.)
 */
const DES_PROFILE_OFFSET = 0x570;

/** Read the DeS profile number from raw SFO bytes. */
function readProfileNumber(rawSfo) {
  return rawSfo[DES_PROFILE_OFFSET];
}

/** Write the DeS profile number into raw SFO bytes (in place). */
function writeProfileNumber(rawSfo, val) {
  rawSfo[DES_PROFILE_OFFSET] = val & 0xff;
}

// Imported for getLimits() only — not re-exported as a raw constant.
import { DEPOSIT_MAX_ENTRIES } from './offsets.js';

// Hardcoded DeS SecureFileID
const SECURE_ID = fromHex('0123456789ABCDEFFEDCBA9876543210');

/** Maximum number of character slots in Demon's Souls */
const MAX_SLOTS = 4;

/**
 * Return structural limits that the UI layer may need (e.g. for enforcing
 * deposit capacity before adding rows). Keeps the facade as the single
 * import surface.
 * @returns {{ depositMaxEntries: number }}
 */
export function getLimits() {
  return { depositMaxEntries: DEPOSIT_MAX_ENTRIES };
}

/** No-op function used as fallback for optional onProgress callbacks. */
function noop() {}

/**
 * Yield to the event loop, allowing the browser to repaint and process UI
 * events between CPU-intensive crypto operations.
 * @returns {Promise<void>}
 */
function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function runCryptoJobs(jobs) {
  const results = [];
  for (const job of jobs) {
    // Yield between jobs so the browser can repaint / process events.
    // This prevents UI freeze during multi-file encrypt/decrypt batches.
    await yieldToEventLoop();
    try {
      const result =
        job.op === 'decrypt'
          ? decryptFile(job.data, job.fileName, job.pfd)
          : encryptFile(job.data, job.fileName, job.pfd, job.skipValidation ?? false);
      results.push({ ok: true, result });
    } catch (err) {
      results.push({ ok: false, error: err });
    }
  }
  return results;
}

/**
 * Decrypt a batch of files from the save folder.
 *
 * For unencrypted saves, just copies the raw bytes (no crypto needed).
 * For encrypted saves, runs decryptFile on each file sequentially.
 *
 * @param {SaveManager} manager  save folder context (has .pfd, .files, .encrypted)
 * @param {string[]} fileNames  entry names to decrypt
 * @returns {Promise<Array<{ok: boolean, result?: Uint8Array, error?: Error}>>}
 */
async function decryptFilesFromManager(manager, fileNames) {
  // Unencrypted saves: just copy bytes (no crypto, instant)
  if (!manager.encrypted || !manager.pfd) {
    return fileNames.map((name) => {
      const data = manager.files.get(name.toLowerCase());
      if (!data) return { ok: false, error: new Error(`${name} not found in save`) };
      return { ok: true, result: data.slice() };
    });
  }

  // Encrypted saves: decrypt each file sequentially
  const jobs = fileNames.map((name) => ({
    op: 'decrypt',
    fileName: name,
    data: manager.files.get(name.toLowerCase()),
    pfd: manager.pfd,
  }));
  return runCryptoJobs(jobs);
}

// ---------------------------------------------------------------------------
// Save-slot filename resolution
// ---------------------------------------------------------------------------

/**
 * Return the three possible primary-file variants for a given slot.
 *
 * DeS uses a quirky triple-naming convention:
 *   Slot 1: USER.DAT, 1USER.DAT, 2USER.DAT
 *   Slot N: 0(N-1)USER.DAT, 10(N-1)USER.DAT, 20(N-1)USER.DAT
 *
 * @param {number} saveSlot  1-based slot number
 * @returns {string[]}  three uppercase filename variants
 */
function getPrimaryVariants(saveSlot) {
  if (saveSlot === 1) {
    return ['USER.DAT', '1USER.DAT', '2USER.DAT'];
  }
  const s = saveSlot - 1;
  return [`0${s}USER.DAT`, `10${s}USER.DAT`, `20${s}USER.DAT`];
}

/**
 * Check whether any primary save-file variant for the given slot exists
 * in the loaded folder.
 *
 * @param {Map<string, {name:string}>} rawFiles  lowercase filename → {name}
 * @param {number} saveSlot  1-based slot number
 * @returns {boolean}
 */
export function slotExists(rawFiles, saveSlot) {
  const variants = getPrimaryVariants(saveSlot);
  return variants.some((name) => rawFiles.has(name.toLowerCase()));
}

/**
 * Resolve the active variant from a circular rotation of three filenames.
 *
 * DeS designates the active file by the *absence of its successor* in the
 * rotation [A → B → C → A].  If B is missing, A is active; if C is missing,
 * B is active; if A is missing, C is active.
 *
 * This correctly handles the common case where a deleted character leaves a
 * zeroed-out stale file on disk (e.g. `03USER.DAT`) alongside the real active
 * file (e.g. `103USER.DAT`).  Simply picking the first existing variant would
 * select the stale file and fail to load.
 *
 * @param {Map<string, {name:string}>} files  lowercase filename → {name}
 * @param {string[]} variants  exactly 3 uppercase filename variants in
 *        rotation order
 * @returns {string|undefined}  the active variant, or undefined if none exist
 */
function resolveRotational(files, variants) {
  for (let i = 0; i < variants.length; i++) {
    const next = variants[(i + 1) % variants.length];
    if (!files.has(next.toLowerCase())) {
      // This variant's successor is absent → it should be the active file.
      // Only return it if it actually exists on disk.
      if (files.has(variants[i].toLowerCase())) {
        return variants[i];
      }
    }
  }
  // All successors exist (or rotation didn't find an existing match) —
  // fall back to the first existing variant.
  //
  // Limitation: if all three rotation variants exist (no missing successor),
  // this picks the first one found.  A stale zeroed-out file would be selected
  // here — but downstream validation (readSave's SANITY_CHECK at offset 0x170)
  // catches zeroed files and routes the slot to `failedSlots`, so no data
  // corruption results.
  return variants.find((v) => files.has(v.toLowerCase()));
}

/**
 * Resolve the primary and secondary USER.DAT filenames for a given slot,
 * based on which files exist in the loaded save.
 *
 * DeS uses a circular triple-naming convention: each slot has three variant
 * names arranged as a rotation. The game designates the active file by the
 * *absence of its successor* — see {@link resolveRotational} for details.
 *
 * @param {Map<string, {name:string}>} files  lowercase filename → {name}
 * @param {number} saveSlot  1-based slot number
 * @returns {{primary: string, secondary: string}}
 */
export function resolveSaveFiles(files, saveSlot) {
  const primary = resolveRotational(files, getPrimaryVariants(saveSlot));
  const secondary = resolveRotational(files, ['04USER.DAT', '104USER.DAT', '204USER.DAT']);

  if (!primary) {
    throw new Error(
      'Could not resolve primary save file. Expected one of the USER.DAT variants for the selected slot.',
    );
  }
  if (!secondary) {
    throw new Error(
      'Could not resolve secondary save file. Expected one of the 04/104/204USER.DAT variants.',
    );
  }

  return { primary, secondary };
}

// ---------------------------------------------------------------------------
// openSave: decrypt + parse ALL slots
// ---------------------------------------------------------------------------

/**
 * Open a save folder, decrypt every character slot (1–4), parse each, and
 * return sanitized models for the UI.
 *
 * The secondary file (04USER.DAT) is shared across all slots and contains
 * the character name + world for each slot at different offsets.
 *
 * All slot primary files are decrypted sequentially.
 *
 * @param {Map<string, {name: string, bytes: Uint8Array}>} rawFiles
 *        Map of lowercase filename → {name, bytes}
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<{slots: SaveSlot[], failedSlots: Array<{slot: number, error: string, primaryFile: string|null}>, profileNumber: number, accountId: string, encrypted: boolean}>}
 */
export async function openSave(rawFiles, onProgress) {
  const log = typeof onProgress === 'function' ? onProgress : noop;

  // PARAM.SFO is always required.
  if (!rawFiles.has('param.sfo')) {
    throw new Error('No PARAM.SFO found. Is this a PS3 save folder?');
  }

  log('Reading files…');

  // Build the file map for the save manager (bytes only).
  const fileMap = new Map();
  for (const [lower, entry] of rawFiles) {
    fileMap.set(lower, entry.bytes);
  }

  // Create save folder context once (handles both encrypted and unencrypted saves).
  const manager = await createSaveFolder(fileMap, SECURE_ID, log);

  // Read SFO-level data once (shared across all slots).
  const sfoBytes = rawFiles.get('param.sfo').bytes.slice();
  const profileNumber = readProfileNumber(sfoBytes);
  const accountId = getSfoAccountId(sfoBytes);

  // Collect slot info for all slots that exist in the folder.
  const slotInfos = [];
  const failedSlots = [];
  for (let saveSlot = 1; saveSlot <= MAX_SLOTS; saveSlot++) {
    if (!slotExists(rawFiles, saveSlot)) continue;

    // Resolve the primary file name (needed even on failure for preservation).
    try {
      const resolved = resolveSaveFiles(rawFiles, saveSlot);
      slotInfos.push({
        saveSlot,
        primaryFile: resolved.primary,
        secondaryFile: resolved.secondary,
      });
    } catch (resolveErr) {
      log(`Warning: slot ${saveSlot} files could not be resolved: ${resolveErr.message}`);
      failedSlots.push({ slot: saveSlot, error: resolveErr.message, primaryFile: null });
    }
  }

  // Decrypt all slot primary files sequentially.
  log(`Decrypting ${slotInfos.length} slot(s)…`);
  const primaryFileNames = slotInfos.map((info) => info.primaryFile);
  const decryptResults = await decryptFilesFromManager(manager, primaryFileNames);

  // Process each result: parse model, sanitize, build session.
  const slots = [];
  for (let i = 0; i < slotInfos.length; i++) {
    const info = slotInfos[i];
    const result = decryptResults[i];

    if (!result.ok) {
      log(`Warning: slot ${info.saveSlot} could not be decrypted: ${result.error.message}`);
      failedSlots.push({
        slot: info.saveSlot,
        error: result.error.message,
        primaryFile: info.primaryFile,
      });
      continue;
    }

    try {
      log(`Parsing slot ${info.saveSlot}…`);
      const fullModel = readSave(result.result);

      // Sanitize for UI (strip binary internals).  Folder-level SFO fields
      // (accountId, profileNumber) are returned separately — not attached
      // to slot models.
      const { model, display } = sanitizeModel(fullModel);

      // Build the opaque session object.
      const session = {
        manager,
        fullModel,
        primaryFile: info.primaryFile,
        secondaryFile: info.secondaryFile,
        saveSlot: info.saveSlot,
        sfoBytes,
        rawFiles,
        encrypted: manager.encrypted,
        // Cache the decrypted plaintext so subsequent saves can reuse it
        // instead of re-decrypting (avoids double AES-CBC on save).
        decryptedBytes: result.result,
      };

      slots.push({ slot: info.saveSlot, session, model, display });
    } catch (err) {
      log(`Warning: slot ${info.saveSlot} could not be loaded: ${err.message}`);
      failedSlots.push({
        slot: info.saveSlot,
        error: err.message,
        primaryFile: info.primaryFile,
        decryptedBytes: result.result,
      });
    }
  }

  if (slots.length === 0) {
    throw new Error('No valid save slots found. The save folder may be corrupt or empty.');
  }

  const mode = manager.encrypted ? 'encrypted' : 'unencrypted';
  log(`Loaded ${slots.length} slot(s) (${mode}).`);

  return { slots, failedSlots, profileNumber, accountId, encrypted: manager.encrypted };
}

// ---------------------------------------------------------------------------
// Shared: decrypt + merge slots (used by writeSaveData and exportEncryptedSave)
// ---------------------------------------------------------------------------

/**
 * Decrypt slot primaries, merge models, preserve failed slots, and update
 * the shared secondary file.
 *
 * Shared by writeSaveData and exportEncryptedSave to avoid duplication of
 * the decrypt-list-building, decryption, and model-merge logic.
 *
 * @param {SaveSlot[]} slots
 * @param {Array<{slot: number, error: string, primaryFile: string|null, decryptedBytes?: Uint8Array}>} failed
 * @param {SaveManager} manager  save folder context
 * @param {Map<string, {name: string, bytes: Uint8Array}>} rawFiles
 * @param {(msg: string) => void} log
 * @returns {Promise<{processedFiles: Map<string, {name: string, bytes: Uint8Array}>, secondaryFile: string|null}>}
 *   processedFiles maps lowercase filename → {name, bytes} of plaintext data.
 */
async function decryptAndMergeSlots(slots, failed, manager, rawFiles, log) {
  const firstSlot = slots[0];

  // Build item list: slot primaries + failed slots + secondary file.
  const items = [];

  for (const { session, model } of slots) {
    items.push({ fileName: session.primaryFile, type: 'primary', session, model });
  }

  for (const fs of failed) {
    if (!fs.primaryFile) continue;
    items.push({ fileName: fs.primaryFile, type: 'failed', failedSlot: fs });
  }

  const secondaryFile = firstSlot.session.secondaryFile;
  const hasSecondary = secondaryFile && rawFiles.has(secondaryFile.toLowerCase());
  if (hasSecondary) {
    items.push({ fileName: secondaryFile, type: 'secondary' });
  }

  // Split items into cached (reuse openSave plaintext) and to-decrypt.
  // Caching avoids re-running AES-CBC decryption on files that were already
  // decrypted during openSave — the single biggest perf win for encrypted saves.
  const toDecrypt = [];
  const cachedByFileName = new Map();
  for (const item of items) {
    const cached =
      item.type === 'primary'
        ? item.session.decryptedBytes
        : item.type === 'failed'
          ? item.failedSlot.decryptedBytes
          : null; // secondary is never cached
    if (cached) {
      cachedByFileName.set(item.fileName, cached);
    } else {
      toDecrypt.push(item);
    }
  }

  // Decrypt only the non-cached files.
  if (toDecrypt.length > 0) {
    log(`Decrypting ${toDecrypt.length} file(s)…`);
  }
  const decryptFileNames = toDecrypt.map((d) => d.fileName);
  const decryptResults =
    toDecrypt.length > 0 ? await decryptFilesFromManager(manager, decryptFileNames) : [];

  // Build a map of decrypted results by fileName for easy lookup.
  const decryptByFileName = new Map();
  for (let i = 0; i < toDecrypt.length; i++) {
    decryptByFileName.set(toDecrypt[i].fileName, decryptResults[i]);
  }

  // Process all items: merge models, build processedFiles map.
  const processedFiles = new Map();

  // Deferred session updates — collected during the items loop and committed
  // only after ALL slots succeed, so a mid-loop failure doesn't leave sessions
  // in a half-updated state.
  const pendingUpdates = [];

  for (const item of items) {
    // Resolve the plaintext bytes: use cache or decrypt result.
    // writeSave() clones internally, so no pre-clone needed here.
    let userBytes;
    const cached = cachedByFileName.get(item.fileName);
    if (cached) {
      userBytes = cached;
    } else {
      const result = decryptByFileName.get(item.fileName);
      if (!result || !result.ok) {
        if (result) {
          log(`Warning: failed to decrypt ${item.fileName}: ${result.error.message}`);
        }
        continue;
      }
      userBytes = result.result;
    }

    if (item.type === 'primary') {
      const { model, session } = item;
      log(`Preparing slot ${session.saveSlot}…`);
      // Pass `out` bag to mergeModel to collect deletedSlots without
      // polluting the model with private fields.
      const mergeOut = {};
      const mergedModel = mergeModel(session.fullModel, model, mergeOut);
      // writeSaveInPlace mutates userBytes directly.  This is safe here
      // because the caller owns this buffer reference — for cached primary
      // slots, `userBytes` is `session.decryptedBytes` which we're about to
      // replace with `writtenBytes` in the pendingUpdates commit below.
      // For decrypted-on-demand buffers, this is the first mutation.
      const writtenBytes = writeSaveInPlace(userBytes, mergedModel, mergeOut.deletedSlots);

      // Re-read the authoritative model from the just-written bytes so
      // session.fullModel exactly matches the on-disk binary state.  This
      // ensures newly-added items get their writer-assigned _slot/idx1/idx2
      // values reflected in the session.
      const writtenModel = readSave(writtenBytes);

      // Defer session state sync until ALL slots succeed.  If the operation
      // fails partway (e.g. slot 3 throws during merge), no session state is
      // mutated for already-processed slots — the caller can safely retry or
      // abort without inconsistent in-memory state.
      pendingUpdates.push({ session, fullModel: writtenModel, decryptedBytes: writtenBytes });

      const origName = rawFiles.get(session.primaryFile.toLowerCase())?.name || session.primaryFile;
      processedFiles.set(origName.toLowerCase(), { name: origName, bytes: writtenBytes });
    } else if (item.type === 'failed') {
      log(`Preserving failed slot ${item.failedSlot.slot} (${item.fileName}) unchanged…`);
      const origName = rawFiles.get(item.fileName.toLowerCase())?.name || item.fileName;
      processedFiles.set(origName.toLowerCase(), { name: origName, bytes: userBytes });
    } else if (item.type === 'secondary') {
      log(`Updating ${secondaryFile}…`);
      for (const { session, model } of slots) {
        const slotIdx = session.saveSlot - 1;
        // Mutates the buffer in place (unlike writeSave which clones).
        writeSecondaryFileInPlace(userBytes, model.name, slotIdx, model.world);
      }
      const origName = rawFiles.get(secondaryFile.toLowerCase())?.name || secondaryFile;
      processedFiles.set(origName.toLowerCase(), { name: origName, bytes: userBytes });
    }
  }

  // Commit all pending session updates now that every slot succeeded.
  for (const { session, fullModel, decryptedBytes } of pendingUpdates) {
    session.fullModel = fullModel;
    session.decryptedBytes = decryptedBytes;
  }

  return { processedFiles, secondaryFile: hasSecondary ? secondaryFile : null };
}

// ---------------------------------------------------------------------------
// writeSaveData: merge + write ALL slots as decrypted files
// ---------------------------------------------------------------------------

/**
 * Write the edited models for ALL slots back as **decrypted** save files.
 *
 * Always produces unencrypted output regardless of whether the original
 * save was encrypted or not. If the original was encrypted, the caller
 * should delete the stale PARAM.PFD from disk (signalled via filesToDelete).
 *
 * The shared secondary file (04USER.DAT) is decrypted once and updated with
 * every slot's character name + world before being written.
 *
 * Failed slots (corrupt/unparseable) are preserved unchanged — their primary
 * files are decrypted and written as-is so the user doesn't lose data.
 *
 * @param {SaveSlot[]} slots
 * @param {Array<{slot: number, error: string, primaryFile: string|null}>|undefined} failedSlots
 * @param {number} profileNumber  new profile number to write to SFO
 * @param {string} accountId  new account ID to write to SFO (empty string = clear)
 * @param {(msg: string) => void} [onProgress]
 * @param {boolean} [inPlace=false]  if true, files are written directly to
 *   the save folder's original location.  When true, PARAM.SFO is written
 *   to disk only after PARAM.PFD has been deleted (see app.js), to avoid
 *   encryption-state ambiguity (see `knowledge/encrypted_export.md`).
 * @returns {Promise<{filesToWrite: Map<string, Uint8Array>, sfoBytes: Uint8Array, encrypted: boolean, filesToDelete: Set<string>}>}
 */
export async function writeSaveData(
  slots,
  failedSlots,
  profileNumber,
  accountId,
  onProgress,
  inPlace = false,
) {
  const log = typeof onProgress === 'function' ? onProgress : noop;
  if (!slots || slots.length === 0) {
    throw new Error('No save slots provided.');
  }
  const failed = Array.isArray(failedSlots) ? failedSlots : [];
  const firstSlot = slots[0];
  const { manager, rawFiles } = firstSlot.session;

  // 1. Patch SFO profile number + account ID (folder-level, done once).
  // Copy-on-write: clone the shared session.sfoBytes so the original stays
  // pristine.  The clone is mutated with profile number + account ID changes
  // and used for the output files + in-memory sync after write.
  log('Preparing save data…');
  const workSfo = firstSlot.session.sfoBytes.slice();
  writeProfileNumber(workSfo, profileNumber);
  writeSfoAccountId(workSfo, accountId);

  // 2. Decrypt + merge all slot primaries, failed slots, and secondary file.
  const { processedFiles } = await decryptAndMergeSlots(slots, failed, manager, rawFiles, log);

  // 3. Build filesToWrite map.
  // The patched SFO is returned as sfoBytes regardless of mode.  In non-in-place
  // mode it's included in filesToWrite; in in-place mode the caller writes it
  // to disk AFTER PARAM.PFD is deleted (to avoid SFO+PFD transitional state —
  // see knowledge/encrypted_export.md).
  const filesToWrite = new Map();
  if (!inPlace) {
    filesToWrite.set('PARAM.SFO', workSfo);
  }
  for (const { name, bytes } of processedFiles.values()) {
    filesToWrite.set(name, bytes);
  }

  // 4. Decrypt remaining USER.DAT backups (encrypted source only).
  const skipNames = new Set(['param.sfo', 'param.pfd', ...processedFiles.keys()]);

  if (firstSlot.session.encrypted) {
    const backupNames = [];
    for (const [lowerName, entry] of rawFiles) {
      if (skipNames.has(lowerName)) continue;
      if (inPlace && !lowerName.endsWith('user.dat')) continue;
      if (lowerName.endsWith('user.dat')) {
        backupNames.push(entry.name);
      }
    }
    if (backupNames.length > 0) {
      const backupResults = await decryptFilesFromManager(manager, backupNames);
      for (let i = 0; i < backupNames.length; i++) {
        if (backupResults[i].ok) {
          filesToWrite.set(backupNames[i], backupResults[i].result);
        }
      }
    }
  }

  // 5. Include remaining non-USER.DAT files from the original save (assets).
  //    These are plain (unencrypted) either way.
  if (!inPlace || !firstSlot.session.encrypted) {
    for (const [lowerName, entry] of rawFiles) {
      if (skipNames.has(lowerName)) continue;
      if (inPlace && !lowerName.endsWith('user.dat')) continue;
      if (firstSlot.session.encrypted && lowerName.endsWith('user.dat')) continue; // already decrypted above
      if (filesToWrite.has(entry.name)) continue;
      filesToWrite.set(entry.name, entry.bytes);
    }
  }

  // 6. If original was encrypted, signal that PARAM.PFD should be deleted.
  const filesToDelete = new Set();
  if (firstSlot.session.encrypted) {
    filesToDelete.add('PARAM.PFD');
  }

  log('Save data ready (decrypted).');
  return { filesToWrite, sfoBytes: workSfo, encrypted: false, filesToDelete };
}

// ---------------------------------------------------------------------------
// exportEncryptedSave: produce an encrypted save for real PS3 hardware
// ---------------------------------------------------------------------------

/**
 * Export an encrypted PS3 save from ALL slots in the current session.
 *
 * Produces a fully encrypted save folder with a new PARAM.PFD, encrypted
 * USER.DAT files for every slot, and a patched SFO with copy-protection
 * removed. The result is compatible with real PS3 hardware via USB transfer.
 *
 * Failed slots (corrupt/unparseable) are also included — their primary files
 * are decrypted and then re-encrypted with the new PFD, so the user doesn't
 * lose data.
 *
 * Works regardless of whether the original save was encrypted or
 * unencrypted (RPCS3).
 *
 * @param {SaveSlot[]} slots
 * @param {Array<{slot: number, error: string, primaryFile: string|null}>|undefined} failedSlots
 * @param {number} profileNumber  new profile number to write to SFO
 * @param {string} accountId  new account ID to write to SFO (empty string = clear)
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<{filesToWrite: Map<string, Uint8Array>, sfoBytes: Uint8Array, encrypted: boolean}>}
 */
export async function exportEncryptedSave(
  slots,
  failedSlots,
  profileNumber,
  accountId,
  onProgress,
  inPlace = false,
) {
  const log = typeof onProgress === 'function' ? onProgress : noop;
  if (!slots || slots.length === 0) {
    throw new Error('No save slots provided.');
  }
  const failed = Array.isArray(failedSlots) ? failedSlots : [];
  const firstSlot = slots[0];
  const { manager, rawFiles } = firstSlot.session;

  // 1. Patch SFO profile number + remove copy-protection + account ID.
  // Copy-on-write: clone the shared session.sfoBytes so the original stays
  // pristine.  The clone is mutated with profile number + copy-protection +
  // account ID changes and used for the output files + in-memory sync.
  log('Preparing save data…');
  const sfoBytes = firstSlot.session.sfoBytes.slice();
  writeProfileNumber(sfoBytes, profileNumber);
  removeCopyProtection(sfoBytes);
  writeSfoAccountId(sfoBytes, accountId);

  // 2. Decrypt + merge all slot primaries, failed slots, and secondary file.
  const { processedFiles } = await decryptAndMergeSlots(slots, failed, manager, rawFiles, log);

  // 3. Build plaintext file list + map for PFD creation.
  log('Building file list…');
  const fileList = [];
  const plaintextFiles = new Map(); // lowercase name → Uint8Array (plaintext)

  // PARAM.SFO
  fileList.push({ name: 'PARAM.SFO', size: sfoBytes.length });
  plaintextFiles.set('param.sfo', sfoBytes);

  for (const { name, bytes } of processedFiles.values()) {
    fileList.push({ name, size: bytes.length });
    plaintextFiles.set(name.toLowerCase(), bytes);
  }

  // 4. Include remaining USER.DAT files from the original save that aren't
  //    already in the list.  Only *.USER.DAT variants go into the PFD —
  //    asset files (ICON0.PNG, PIC1.PNG, SND0.AT3, ICON1.PAM) are NOT
  //    protected by the PFD on real PS3 hardware.
  //
  //    When the source is encrypted, backup rotational USER.DAT files
  //    (e.g. 2USER.DAT when USER.DAT is active) are still ciphertext in
  //    rawFiles. They must be decrypted before being added to
  //    plaintextFiles — otherwise step 6 double-encrypts them, producing
  //    data that the PS3 cannot parse if file rotation promotes a backup
  //    to the active primary.
  const backupEncryptedNames = [];
  for (const [lowerName, entry] of rawFiles) {
    if (lowerName === 'param.sfo' || lowerName === 'param.pfd') continue;
    if (plaintextFiles.has(lowerName)) continue; // already added
    if (!lowerName.endsWith('user.dat')) continue; // assets not in PFD
    if (manager.encrypted && manager.pfd) {
      // Encrypted source — collect for batch decrypt below.
      backupEncryptedNames.push(entry.name);
    } else {
      // Unencrypted source — raw bytes are already plaintext.
      fileList.push({ name: entry.name, size: entry.bytes.length });
      plaintextFiles.set(lowerName, entry.bytes);
    }
  }

  if (backupEncryptedNames.length > 0) {
    log(`Decrypting ${backupEncryptedNames.length} backup file(s)…`);
    const backupResults = await decryptFilesFromManager(manager, backupEncryptedNames);
    for (let i = 0; i < backupEncryptedNames.length; i++) {
      const result = backupResults[i];
      const name = backupEncryptedNames[i];
      if (result.ok) {
        fileList.push({ name, size: result.result.length });
        plaintextFiles.set(name.toLowerCase(), result.result);
      } else {
        log(`Warning: failed to decrypt backup ${name}: ${result.error.message}`);
      }
    }
  }

  // 5. Create a new PFD from scratch.
  log('Creating PARAM.PFD…');
  const pfd = createPfdForFiles(fileList, SECURE_ID);

  // 6. Encrypt all files sequentially.
  log('Encrypting save files…');
  const encryptEntries = pfd.entries.filter(
    (entry) => entry.fileName.toLowerCase() !== 'param.sfo',
  );
  const encryptFileNames = encryptEntries.map((e) => e.fileName);
  const encryptData = encryptEntries.map((e) => plaintextFiles.get(e.fileName.toLowerCase()));

  // Build encrypt jobs (skip entries without data)
  const validJobs = [];
  for (let i = 0; i < encryptEntries.length; i++) {
    const data = encryptData[i];
    if (!data) {
      log(`Warning: no data for ${encryptFileNames[i]}, skipping encryption`);
      continue;
    }
    validJobs.push({
      op: 'encrypt',
      fileName: encryptFileNames[i],
      data,
      pfd,
      skipValidation: true,
    });
  }

  const encryptResults = await runCryptoJobs(validJobs);

  const encryptedFiles = new Map();
  encryptedFiles.set('param.sfo', sfoBytes); // SFO is not encrypted, just hashed

  for (let i = 0; i < validJobs.length; i++) {
    const result = encryptResults[i];
    if (!result.ok) {
      throw new Error(`Failed to encrypt ${validJobs[i].fileName}: ${result.error.message}`);
    }
    const lowerName = validJobs[i].fileName.toLowerCase();
    encryptedFiles.set(lowerName, result.result);
  }

  // 7. Compute all PFD hashes (entry hashes, signature table, top/bottom).
  log('Computing PARAM.PFD hashes…');
  validAllParamHashes(encryptedFiles, true, pfd);

  // 8. Serialize the PFD.
  log('Serializing PARAM.PFD…');
  const pfdBytes = getParamPfdCombinedData(pfd);

  // 9. Collect files to write.
  const filesToWrite = new Map();
  filesToWrite.set('PARAM.SFO', sfoBytes);
  filesToWrite.set('PARAM.PFD', pfdBytes);

  for (const [lowerName, bytes] of encryptedFiles) {
    if (lowerName === 'param.sfo') continue; // already added
    const origName = rawFiles.get(lowerName)?.name || lowerName;
    filesToWrite.set(origName, bytes);
  }

  // 10. Include asset files (icons, sounds, etc.) as plain unencrypted files.
  //     These are NOT in the PFD on real PS3 — they're stored as-is.
  //     Skip for in-place overwrite — assets are already on disk, untouched.
  if (!inPlace) {
    for (const [lowerName, entry] of rawFiles) {
      if (lowerName === 'param.sfo' || lowerName === 'param.pfd') continue;
      if (filesToWrite.has(entry.name)) continue; // already added above
      filesToWrite.set(entry.name, entry.bytes);
    }
  }

  log('Encrypted export ready.');
  return { filesToWrite, sfoBytes, encrypted: true };
}

// ---------------------------------------------------------------------------
// reloadSlotModels: re-sanitize models after save (fresh _ref values)
// ---------------------------------------------------------------------------

/**
 * Re-sanitize all slot models from their updated fullModel after a save.
 *
 * After writeSaveData/exportEncryptedSave, each slot's session.fullModel
 * is already merged with the latest UI edits. This function re-sanitizes
 * each fullModel to produce fresh UI models with proper _ref values —
 * formerly-new items will now have _ref tokens, so they'll render as
 * "existing" rows (trash icon, no green border).
 *
 * @param {SaveSlot[]} slots
 * @param {(msg: string) => void} [onProgress]
 */
export function reloadSlotModels(slots, onProgress) {
  const log = typeof onProgress === 'function' ? onProgress : noop;
  log('Refreshing saved data…');

  for (const slot of slots) {
    const { session } = slot;
    const { model, display } = sanitizeModel(session.fullModel);
    slot.model = model;
    slot.display = display;
  }

  log('Save data refreshed.');
}

// ---------------------------------------------------------------------------
// updateSessionAfterWrite: sync in-memory state after an in-place overwrite
// ---------------------------------------------------------------------------

/**
 * Update the in-memory session state after an in-place write to disk.
 *
 * After overwriting the save folder with a different encryption state (e.g.
 * encrypted → decrypted or vice versa), the session's manager, file maps, and
 * encryption flags become stale. This function syncs them so subsequent saves
 * work correctly without needing to reload the save.
 *
 * - For **encrypted** writes: parses the new PARAM.PFD and updates manager.pfd,
 *   sets all file bytes to the encrypted output.
 * - For **decrypted** writes: clears manager.pfd (PARAM.PFD was deleted from
 *   disk), sets all file bytes to the plaintext output.
 *
 * @param {SaveSlot[]} slots
 * @param {Map<string, Uint8Array>} filesToWrite  the actual bytes written to disk
 * @param {boolean} encrypted  whether the on-disk save is now encrypted
 */
export async function updateSessionAfterWrite(slots, filesToWrite, encrypted) {
  if (slots.length === 0) return;
  const { manager, rawFiles } = slots[0].session;

  // 1. Update encryption flags.
  manager.encrypted = encrypted;
  for (const slot of slots) {
    slot.session.encrypted = encrypted;
  }

  // 2. Update PFD state.
  if (encrypted) {
    const pfdBytes = filesToWrite.get('PARAM.PFD');
    if (pfdBytes) {
      manager.pfd = parseParamPfd(pfdBytes);
      manager.pfd.secureFileID = SECURE_ID;
    }
  } else {
    // PARAM.PFD was deleted from disk — clear the in-memory reference.
    manager.pfd = null;
  }

  // 3. Update file maps (manager.files + rawFiles) with what's now on disk.
  //    This ensures subsequent decrypt/encrypt operations use the current
  //    on-disk data, not the original loaded bytes.
  for (const [name, bytes] of filesToWrite) {
    const lower = name.toLowerCase();
    // Update manager.files (Map<string, Uint8Array>)
    manager.files.set(lower, bytes);
    // Update rawFiles (Map<string, {name, bytes}>)
    const entry = rawFiles.get(lower);
    if (entry) {
      entry.bytes = bytes;
    } else {
      rawFiles.set(lower, { name, bytes });
    }
  }

  // 4. For decrypted saves, remove PARAM.PFD from file maps (it was deleted
  //    from disk).
  if (!encrypted) {
    manager.files.delete('param.pfd');
    rawFiles.delete('param.pfd');
  }

  // 5. Sync the in-memory SFO bytes with the just-written PARAM.SFO.
  //    writeSaveData/exportEncryptedSave use copy-on-write: they clone
  //    session.sfoBytes before mutating, so the original session reference
  //    still holds the pre-write SFO.  After a successful in-place write,
  //    update it so subsequent operations use the current on-disk SFO.
  const writtenSfo = filesToWrite.get('PARAM.SFO');
  if (writtenSfo) {
    for (const slot of slots) {
      slot.session.sfoBytes = writtenSfo;
    }
  }
}
