/**
 * File I/O for the browser and Tauri desktop app.
 *
 * The browser security model prevents reading sibling files from a single
 * selected file. To replicate a folder-based workflow, we use:
 *
 *   Tauri: native OS folder picker (rfd) → read all files via IPC.
 *     The directory path is stored as a fake "handle" for in-place saves.
 *
 *   Chromium: showDirectoryPicker() → read all files from the folder.
 *     The handle is stored for later in-place saves (no second prompt).
 *
 *   Drag-and-drop: DataTransferItem.webkitGetAsEntry() → recursive read
 *     (works on all browsers). This is the universal
 *     way to open saves on all browsers.
 *
 * Save (Tauri): write back to the stored directory path via IPC.
 * Save (Chromium + showDirectoryPicker): write back to the stored handle.
 * Save (drag-and-drop or non-Chromium): download as ZIP via Export.
 */

/** Maximum allowed file size for a single save file (16 MB).  PS3 saves are
 * well under this limit; the cap is a defense-in-depth measure against
 * crafted folders with oversized files that could cause OOM. */
const MAX_SAVE_FILE_SIZE = 16 * 1024 * 1024; // 16 MB

/** Maximum total size of all files in a save folder (64 MB).  PS3 saves are
 * typically under 10 MB; this cap prevents crafted folders with many files
 * from exhausting memory when all files are read simultaneously. */
const MAX_TOTAL_SAVE_SIZE = 64 * 1024 * 1024; // 64 MB

import { zip } from 'fflate';
import {
  isTauri,
  tauriOpenDirectory,
  tauriWriteFiles,
  tauriDeleteFiles,
  tauriPickSavePath,
  tauriWriteBytesToPath,
} from '../lib/tauri-bridge.js';

/**
 * Check if in-place write (folder open + save-back) is available.
 *
 * Returns true in two cases:
 *   1. Tauri desktop app (native OS dialogs via IPC)
 *   2. Chromium browser with File System Access API in a secure context
 *
 * @returns {boolean}
 */
export function canWriteInPlace() {
  // Tauri desktop app — always supports in-place writes
  if (isTauri()) return true;

  // Chromium browser with File System Access API
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window && window.isSecureContext;
}

/**
 * Open a directory using either the Tauri IPC bridge or the File System
 * Access API (Chromium). Shows a native "Open" dialog and returns a
 * reusable handle.
 *
 * Tauri: dirHandle is `{ __tauriDirPath: string, name: string }`.
 * Chromium: dirHandle is a standard FileSystemDirectoryHandle.
 *
 * @returns {Promise<{dirHandle: object, files: Map<string, {name: string, bytes: Uint8Array}>}>}
 */
export async function openDirectoryViaFSAccess() {
  // Tauri path — native dialog + IPC file read
  if (isTauri()) {
    const result = await tauriOpenDirectory();
    if (!result) {
      // User cancelled — mimic the AbortError thrown by showDirectoryPicker
      const err = new Error('User cancelled');
      err.name = 'AbortError';
      throw err;
    }
    const { dirPath, dirName, files } = result;
    return {
      dirHandle: { __tauriDirPath: dirPath, name: dirName },
      files,
    };
  }

  // Chromium path — File System Access API
  const dirHandle =
    await /** @type {{ showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }} */ (
      /** @type {unknown} */ (window)
    ).showDirectoryPicker();

  // Collect all file handles first, then read them in parallel
  const fileHandles = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      fileHandles.push(entry);
    }
  }

  let totalBytes = 0;
  const results = await Promise.all(
    fileHandles.map(async (entry) => {
      const file = await entry.getFile();
      if (file.size > MAX_SAVE_FILE_SIZE) {
        throw new Error(
          `File ${entry.name} is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed is ${MAX_SAVE_FILE_SIZE / 1024 / 1024} MB.`,
        );
      }
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_SAVE_SIZE) {
        throw new Error(
          `Total save folder size exceeds ${MAX_TOTAL_SAVE_SIZE / 1024 / 1024} MB limit. The folder may be corrupt or malicious.`,
        );
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      return { name: entry.name, bytes: buf };
    }),
  );

  const files = new Map();
  for (const { name, bytes } of results) {
    files.set(name.toLowerCase(), { name, bytes });
  }
  return { dirHandle, files };
}

/* ------------------------------------------------------------------ */
/* Drag-and-drop folder reading (DataTransferItem.webkitGetAsEntry)    */
/* ------------------------------------------------------------------ */

/**
 * Promisified version of FileSystemDirectoryReader.readEntries().
 * readEntries() may return partial results — call repeatedly until empty.
 *
 * @param {FileSystemDirectoryReader} reader
 * @returns {Promise<FileSystemEntry[]>}
 */
function readAllEntries(reader) {
  return new Promise((resolve, reject) => {
    const all = [];
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(all);
        } else {
          all.push(...entries);
          readBatch();
        }
      }, reject);
    };
    readBatch();
  });
}

/**
 * Read a single FileSystemFileEntry into a Uint8Array.
 *
 * @param {FileSystemFileEntry} entry
 * @returns {Promise<Uint8Array>}
 */
function readFileEntry(entry) {
  return new Promise((resolve, reject) => {
    entry.file((file) => {
      if (file.size > MAX_SAVE_FILE_SIZE) {
        reject(
          new Error(
            `File ${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed is ${MAX_SAVE_FILE_SIZE / 1024 / 1024} MB.`,
          ),
        );
        return;
      }
      file.arrayBuffer().then((buf) => {
        resolve(new Uint8Array(buf));
      }, reject);
    }, reject);
  });
}

/**
 * Recursively traverse a FileSystemEntry tree, reading all file entries
 * into a Map of lowercase filename → {name, bytes}.
 *
 * Files in subdirectories use their relative path (e.g. "SUBDIR/FILE.DAT")
 * as the key, matching the webkitdirectory convention.
 *
 * @param {FileSystemEntry} entry
 * @param {string} path  accumulated relative path (with trailing '/')
 * @param {Map<string, {name: string, bytes: Uint8Array}>} map
 */
async function traverseEntry(entry, path, map) {
  if (entry.isFile) {
    const bytes = await readFileEntry(/** @type {FileSystemFileEntry} */ (entry));
    // Defense-in-depth: cap total bytes across all files in the folder
    let total = 0;
    for (const { bytes: b } of map.values()) total += b.length;
    if (total + bytes.length > MAX_TOTAL_SAVE_SIZE) {
      throw new Error(
        `Total save folder size exceeds ${MAX_TOTAL_SAVE_SIZE / 1024 / 1024} MB limit. The folder may be corrupt or malicious.`,
      );
    }
    const fullName = path + entry.name;
    map.set(fullName.toLowerCase(), { name: entry.name, bytes });
  } else if (entry.isDirectory) {
    const reader = /** @type {FileSystemDirectoryEntry} */ (entry).createReader();
    const entries = await readAllEntries(reader);
    const newPath = path + entry.name + '/';
    await Promise.all(entries.map((e) => traverseEntry(e, newPath, map)));
  }
}

/**
 * Read all files from a dropped folder via DataTransferItemList.
 *
 * Uses webkitGetAsEntry() to access the FileSystemEntry API, which works
 * on all browsers. Returns a plain object `{ files, dirName }` where
 * `files` is a Map with lowercase filename keys and `dirName` is the
 * dropped folder's name (empty string if individual files were dropped).
 *
 * If multiple items are dropped, the first directory entry is used.
 * If only individual files are dropped (no folder), they are all read
 * but dirName will be empty.
 *
 * @param {DataTransferItemList} items
 * @returns {Promise<{files: Map<string, {name: string, bytes: Uint8Array}>, dirName: string}>}
 */
export async function readFilesFromDataTransfer(items) {
  const map = new Map();
  let dirName = '';

  // Collect all entries first (items is not a stable array across awaits).
  // DataTransferItemList is not iterable in some browsers (e.g. Firefox),
  // so use an indexed loop instead of for…of.
  const entries = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  // Prefer the first directory entry; fall back to reading all file entries
  const dirEntry = entries.find((e) => e.isDirectory);
  if (dirEntry) {
    const directoryEntry = /** @type {FileSystemDirectoryEntry} */ (dirEntry);
    dirName = directoryEntry.name;
    const reader = directoryEntry.createReader();
    const childEntries = await readAllEntries(reader);
    await Promise.all(childEntries.map((e) => traverseEntry(e, '', map)));
  } else {
    // No folder dropped — read individual files
    for (const entry of entries) {
      if (entry.isFile) {
        await traverseEntry(entry, '', map);
      }
    }
  }

  return { files: map, dirName };
}

/**
 * Write modified files back via Tauri IPC or File System Access API.
 *
 * Files are written **in parallel** (`Promise.all`) to minimize total I/O
 * time — each file write is an independent disk operation with no
 * dependencies on the others.
 *
 * @param {Record<string, any>} dirHandle  Tauri dir-path handle or FileSystemDirectoryHandle
 * @param {Map<string, Uint8Array>} filesToWrite  filename → bytes
 */
export async function writeFilesToDirectory(dirHandle, filesToWrite) {
  // Tauri path — write each file via IPC
  if (dirHandle?.__tauriDirPath) {
    await tauriWriteFiles(dirHandle.__tauriDirPath, filesToWrite);
    return;
  }

  // Chromium path — File System Access API (parallel writes)
  const promises = [];
  for (const [name, bytes] of filesToWrite) {
    promises.push(writeSingleFile(dirHandle, name, bytes));
  }
  await Promise.all(promises);
}

async function writeSingleFile(dirHandle, name, bytes) {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(bytes);
  } finally {
    await writable.close();
  }
}

/**
 * Delete files from a directory via Tauri IPC or File System Access API.
 * Used to remove stale PARAM.PFD when switching from encrypted → decrypted.
 *
 * @param {Record<string, any>} dirHandle  Tauri dir-path handle or FileSystemDirectoryHandle
 * @param {Set<string>} fileNames  names of files to delete
 */
export async function deleteFilesFromDirectory(dirHandle, fileNames) {
  // Tauri path — delete via IPC (silently ignores missing files)
  if (dirHandle?.__tauriDirPath) {
    await tauriDeleteFiles(dirHandle.__tauriDirPath, fileNames);
    return;
  }

  // Chromium path — File System Access API
  for (const name of fileNames) {
    try {
      await dirHandle.removeEntry(name);
    } catch (err) {
      // File may not exist — ignore NotFoundError
      if (err.name !== 'NotFoundError') {
        throw err;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* ZIP Download (DEFLATE compression via fflate)                       */
/* ------------------------------------------------------------------ */

/**
 * Convert a Map of filename → bytes into the plain object expected by fflate.
 *
 * @param {Map<string, Uint8Array>} files  filename → file content
 * @returns {Record<string, Uint8Array>}
 */
function filesToObject(files) {
  /** @type {Record<string, Uint8Array>} */
  const obj = {};
  for (const [name, data] of files) {
    obj[name] = data;
  }
  return obj;
}

/**
 * Build a ZIP archive asynchronously using `fflate.zip` (runs in a Web
 * Worker, so the main thread is not blocked during compression).
 *
 * @param {Map<string, Uint8Array>} files  filename → file content
 * @returns {Promise<Uint8Array>}  raw ZIP archive bytes
 */
export async function buildZipAsync(files) {
  return new Promise((resolve, reject) => {
    // level 6 = standard DEFLATE compression (0 = store, 1–9 = compressed)
    zip(filesToObject(files), { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

/**
 * Download a Map of files as a single ZIP archive.
 *
 * Uses async compression ({@link buildZipAsync}) so the UI is not blocked.
 *
 * @param {Map<string, Uint8Array>} files  filename → bytes
 * @param {string} zipName  download filename (default: des_save.zip)
 * @returns {Promise<void>}
 */
/** Active blob URLs awaiting revocation.  Tracked so they can be cleaned up
 * on page unload to avoid leaks (setTimeout-based revocation may not fire
 * if the page closes first). */
const activeBlobUrls = new Set();

// Clean up all active blob URLs when the page unloads.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const url of activeBlobUrls) {
      URL.revokeObjectURL(url);
    }
    activeBlobUrls.clear();
  });
}

export async function downloadFilesAsZip(files, zipName = 'des_save.zip') {
  const zipBytes = await buildZipAsync(files);
  const blob = new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (zipBytes))], {
    type: 'application/zip',
  });
  const url = URL.createObjectURL(blob);
  activeBlobUrls.add(url);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revocation — the browser reads the blob asynchronously after
  // click(). Revoking immediately can cause the download backend to stall
  // for several seconds while it buffers the blob internally.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  }, 10000);
}

/* ------------------------------------------------------------------ */
/* Save As… via File System Access API (Chromium only)                  */
/* ------------------------------------------------------------------ */

/**
 * Check if a native "Save As" dialog (choose folder + filename) is
 * available.
 *
 * Returns true in two cases:
 *   1. Tauri desktop app (native OS dialog via IPC)
 *   2. Chromium browser with showSaveFilePicker() in a secure context
 *
 * @returns {boolean}
 */
export function canChooseSaveLocation() {
  // Tauri desktop app
  if (isTauri()) return true;

  // Chromium browser
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window && window.isSecureContext;
}

/**
 * Show a native "Save As" dialog and return a reusable file handle.
 *
 * MUST be called from a user-gesture call stack (e.g. a click handler).
 * Calling it after an `await` (e.g. after building a ZIP) can raise
 * SecurityError because the user activation has expired.
 *
 * Tauri: returns `{ __tauriPath: string, name: string }` or null.
 * Chromium: returns a FileSystemFileHandle.
 *
 * @param {string} suggestedName  default filename shown in the dialog
 * @returns {Promise<object|null>}
 */
export async function pickZipFile(suggestedName = 'des_save.zip') {
  // Tauri path — defer actual writing until writeZipToHandle()
  if (isTauri()) {
    return await tauriPickSavePath(suggestedName);
  }

  // Chromium path
  return await /** @type {{ showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> }} */ (
    /** @type {unknown} */ (window)
  ).showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: 'ZIP archive',
        accept: { 'application/zip': ['.zip'] },
      },
    ],
  });
}

/**
 * Write a Map of files as a single ZIP archive to a previously picked
 * file handle (obtained via pickZipFile()).
 *
 * Tauri: handle is `{ __tauriPath: string }` — writes via IPC.
 * Chromium: handle is a FileSystemFileHandle — writes via the writable stream.
 *
 * @param {Record<string, any>} handle  Tauri path handle or FileSystemFileHandle
 * @param {Map<string, Uint8Array>} files  filename → bytes
 */
export async function writeZipToHandle(handle, files) {
  const zipBytes = await buildZipAsync(files);

  // Tauri path — write via IPC
  if (handle?.__tauriPath) {
    await tauriWriteBytesToPath(handle.__tauriPath, zipBytes);
    return;
  }

  // Chromium path
  const writable = await handle.createWritable();
  try {
    await writable.write(zipBytes);
  } finally {
    await writable.close();
  }
}
