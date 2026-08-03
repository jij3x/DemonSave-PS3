/**
 * Orchestrates a PS3 save folder: holds the ParamPFD + file map, exposes
 * decrypt/encrypt/rebuild operations.
 *
 * Represents one PS3 save folder. In the browser the "folder" is a
 * Map<string, Uint8Array> of filename to bytes, supplied by the UI layer's
 * file picker.
 *
 * Supports both encrypted saves (with PARAM.PFD) and unencrypted saves
 * (just raw USER.DAT files + PARAM.SFO).
 *
 * This module is generic to all PS3 game saves — it contains no game-specific
 * logic.
 */

import {
  parseParamPfd,
  decryptFile,
  encryptFile,
  isValidEntryHash,
  rebuildParamPfd,
} from './param-pfd.js';
import { parseParamSfo } from './param-sfo.js';

/**
 * Create a save folder context from a set of save files.
 *
 * If PARAM.PFD is present, encrypted mode (decrypt/encrypt via PFD).
 * If PARAM.PFD is absent, unencrypted mode (raw file I/O).
 *
 * Note: This function is intentionally `async` even though it currently
 * contains no `await`. The async signature ensures errors are delivered as
 * rejected Promises (compatible with `await expect(...).rejects.toThrow()`
 * in tests) and leaves room for future async operations without breaking
 * the calling convention.
 *
 * @param {Map<string, Uint8Array>} files  lowercase filename to bytes
 * @param {Uint8Array} secureFileId  16-byte SecureFileID
 * @param {(msg:string)=>void} [onProgress]
 * @returns {Promise<{pfd: import('./param-pfd.js').ParamPFD|null, sfo: object|null, files: Map<string, Uint8Array>, encrypted: boolean}>}
 */
export async function createSaveFolder(files, secureFileId, onProgress) {
  const log = onProgress || (() => {});
  const pfdBytes = files.get('param.pfd');
  const sfoBytes = files.get('param.sfo');

  if (!pfdBytes) {
    // Unencrypted mode — no PFD needed.
    log('No PARAM.PFD found — assuming unencrypted save.');
    return { pfd: null, sfo: sfoBytes ? parseParamSfo(sfoBytes) : null, files, encrypted: false };
  }

  const pfd = parseParamPfd(pfdBytes, log);
  const sfo = sfoBytes ? parseParamSfo(sfoBytes) : null;

  if (secureFileId) {
    if (secureFileId.length !== 16) {
      throw new Error('SecureFileID must be 16 bytes');
    }
    pfd.secureFileID = secureFileId;
  }

  return { pfd, sfo, files, encrypted: true };
}

/**
 * Decrypt a file by entry name, returning its plaintext bytes.
 *
 * In unencrypted mode, returns a copy of the raw bytes.
 *
 * @param {{pfd: import('./param-pfd.js').ParamPFD|null, files: Map<string, Uint8Array>, encrypted: boolean}} folder
 * @param {string} entryName  e.g. "USER.DAT"
 * @returns {Uint8Array}
 */
export function decryptToBytes(folder, entryName) {
  const lower = entryName.toLowerCase();
  const data = folder.files.get(lower);
  if (!data) throw new Error(`${entryName} not found in save`);

  // Unencrypted mode: return a copy so callers can mutate without
  // corrupting the shared reference in the save folder's file map.
  if (!folder.encrypted || !folder.pfd) {
    return data.slice();
  }

  return decryptFile(data, entryName, folder.pfd);
}

/**
 * Encrypt a file's bytes and store them in the file map.
 *
 * In unencrypted mode, stores a copy of the raw bytes directly.
 *
 * The `plainBytes` parameter must be PLAINTEXT, not ciphertext. The
 * `encryptFile` function always encrypts its input. `skipValidation=true`
 * is passed internally to signal that the input is known plaintext.
 *
 * @param {{pfd: import('./param-pfd.js').ParamPFD|null, files: Map<string, Uint8Array>, encrypted: boolean}} folder
 * @param {string} entryName
 * @param {Uint8Array} plainBytes  PLAINTEXT data to encrypt
 * @returns {Uint8Array} the encrypted (or raw) bytes now stored in the file map
 */
export function encryptBytes(folder, entryName, plainBytes) {
  // Unencrypted mode stores a copy so the caller's reference can't be
  // accidentally mutated through the folder's file map.
  if (!folder.encrypted || !folder.pfd) {
    const copy = plainBytes.slice();
    folder.files.set(entryName.toLowerCase(), copy);
    return copy;
  }

  // Always pass skipValidation=true since input is plaintext.
  const enc = encryptFile(plainBytes, entryName, folder.pfd, true);
  folder.files.set(entryName.toLowerCase(), enc);
  return enc;
}

/**
 * Check if a file's stored bytes currently pass hash validation
 * (i.e., the on-disk data is still the original encrypted content).
 *
 * @param {{pfd: import('./param-pfd.js').ParamPFD|null, files: Map<string, Uint8Array>, encrypted: boolean}} folder
 * @param {string} entryName
 * @returns {boolean}
 */
export function isEncrypted(folder, entryName) {
  if (!folder.encrypted || !folder.pfd) return false;
  const lower = entryName.toLowerCase();
  const data = folder.files.get(lower);
  if (!data) return false;
  return isValidEntryHash(data, entryName, folder.pfd);
}

/**
 * Re-seal the save: re-hash everything and produce a new PARAM.PFD.
 *
 * In unencrypted mode, returns the raw files with no PFD.
 *
 * @param {{pfd: import('./param-pfd.js').ParamPFD|null, files: Map<string, Uint8Array>, encrypted: boolean}} folder
 * @param {boolean} encryptFiles
 * @param {(msg:string)=>void} [onProgress]
 * @returns {{pfdBytes: Uint8Array|null, fileUpdates: Map<string, Uint8Array>}}
 */
export function rebuildChanges(folder, encryptFiles = false, onProgress) {
  // Unencrypted mode: no PFD to rebuild, just return updated files.
  if (!folder.encrypted || !folder.pfd) {
    const fileUpdates = new Map();
    for (const [name, bytes] of folder.files) {
      // Skip PARAM files — they're handled separately.
      if (name === 'param.pfd' || name === 'param.sfo') continue;
      fileUpdates.set(name, bytes);
    }
    return { pfdBytes: null, fileUpdates };
  }

  return rebuildParamPfd(folder.files, encryptFiles, folder.pfd, onProgress);
}

/**
 * Find an entry by name. Returns the PFDEntry or null.
 *
 * @param {{pfd: import("./param-pfd.js").ParamPFD|null}} folder
 * @param {string} name
 */
export function findEntry(folder, name) {
  if (!folder.pfd) return null;
  const lower = name.toLowerCase();
  return folder.pfd.entries.find((e) => e.fileName.toLowerCase() === lower) || null;
}
