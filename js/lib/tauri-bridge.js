/**
 * Tauri bridge — thin wrappers around Tauri IPC commands.
 *
 * In a Tauri v2 webview the runtime injects, before any user script runs:
 *   - `window.isTauri === true`           ← canonical "are we in Tauri?" flag
 *   - `window.__TAURI_INTERNALS__.invoke` ← low-level IPC bridge used by the
 *                                          official `@tauri-apps/api`
 * When `app.withGlobalTauri` is `true`, the higher-level `window.__TAURI__`
 * API is *also* exposed, but it may be populated later than the init flag, so
 * detection and invocation prefer the always-available internals.
 *
 * This module calls the Rust-side commands defined in `src-tauri/src/lib.rs`
 * and handles base64 encoding/decoding of binary data.
 *
 * In a regular browser (no Tauri), `isTauri()` returns false and the app
 * falls back to the standard File System Access API / drag-and-drop paths.
 */

/**
 * @typedef {Object} TauriCore
 * @property {(command: string, args?: Record<string, unknown>) => Promise<unknown>} invoke
 */

/**
 * @typedef {Object} TauriGlobal
 * @property {TauriCore} [core]
 */

/**
 * @typedef {Object} TauriInternals
 * @property {(cmd: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown>} [invoke]
 */

/**
 * @typedef {typeof window & {
 *   isTauri?: boolean,
 *   __TAURI__?: TauriGlobal,
 *   __TAURI_INTERNALS__?: TauriInternals,
 * }} TauriWindow
 */

/**
 * Type-safe accessor for `window.__TAURI__` (undefined when not in Tauri, or
 * before the `withGlobalTauri` API finishes loading).
 * @returns {TauriGlobal | undefined}
 */
function getTauri() {
  return typeof window !== 'undefined' ? /** @type {TauriWindow} */ (window).__TAURI__ : undefined;
}

/**
 * Accessor for the low-level Tauri internals bridge
 * (`window.__TAURI_INTERNALS__`). Present synchronously in every Tauri v2
 * webview — this is the bridge the official `@tauri-apps/api` invokes through.
 * @returns {TauriInternals | undefined}
 */
function getTauriInternals() {
  return typeof window !== 'undefined'
    ? /** @type {TauriWindow} */ (window).__TAURI_INTERNALS__
    : undefined;
}

/**
 * Detect whether the app is running inside a Tauri webview.
 *
 * Uses Tauri v2's canonical `window.isTauri` flag (set synchronously by the
 * init script, before user scripts run), with fallbacks to the internals
 * bridge and the `withGlobalTauri` global for robustness across versions.
 * @returns {boolean}
 */
export function isTauri() {
  if (typeof window === 'undefined') return false;
  const w = /** @type {TauriWindow} */ (window);
  if (w.isTauri === true) return true;
  return (
    typeof getTauriInternals()?.invoke === 'function' ||
    typeof getTauri()?.core?.invoke === 'function'
  );
}

// ── Base64 helpers (zero-dependency, handles chunking for large arrays) ──

/**
 * Encode a Uint8Array to a standard base64 string.
 * Processes in 32 KB chunks to avoid call-stack limits on very large files.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  const CHUNK = 0x8000; // 32 KB
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary);
}

/**
 * Decode a standard base64 string into a Uint8Array.
 * @param {string} b64
 * @returns {Uint8Array}
 */
export function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── IPC wrappers (only meaningful when isTauri() === true) ──

/**
 * Invoke a Tauri command.  Throws if not in a Tauri environment.
 * @param {string} command
 * @param {Record<string, unknown>} [args]
 * @returns {Promise<unknown>}
 */
function invoke(command, args) {
  // Preferred path: low-level internals bridge (available as soon as the
  // webview boots, independent of `withGlobalTauri` timing).
  const internals = getTauriInternals();
  if (typeof internals?.invoke === 'function') {
    return internals.invoke(command, args);
  }
  // Fallback: `withGlobalTauri` high-level API
  const tauri = getTauri();
  if (typeof tauri?.core?.invoke === 'function') {
    return tauri.core.invoke(command, args);
  }
  throw new Error(`invoke("${command}") called outside Tauri environment`);
}

/**
 * Show a native directory picker and read all files in the chosen folder.
 *
 * @returns {Promise<{dirPath: string, dirName: string, files: Map<string, {name: string, bytes: Uint8Array}>} | null>}
 *   `null` if the user cancelled the dialog.
 */
export async function tauriOpenDirectory() {
  const result = /** @type {[string, string]} */ (await invoke('pick_directory'));
  if (!result) return null;

  const [dirPath, dirName] = result;
  const entries = /** @type {Array<{name: string, data: string}>} */ (
    await invoke('read_dir_files', { dirPath })
  );

  const files = new Map();
  for (const { name, data } of entries) {
    files.set(name.toLowerCase(), { name, bytes: base64ToBytes(data) });
  }
  return { dirPath, dirName, files };
}

/**
 * Write a set of files into a Tauri-managed directory path.
 *
 * Files are written **in parallel** (`Promise.all`) to minimize total I/O
 * time across multiple IPC round-trips.
 *
 * @param {string} dirPath  absolute path returned by tauriOpenDirectory()
 * @param {Map<string, Uint8Array>} filesToWrite  filename → bytes
 */
export async function tauriWriteFiles(dirPath, filesToWrite) {
  const promises = [];
  for (const [fileName, bytes] of filesToWrite) {
    promises.push(
      invoke('write_file', {
        dirPath,
        fileName,
        dataB64: bytesToBase64(bytes),
      }),
    );
  }
  await Promise.all(promises);
}

/**
 * Delete files from a Tauri-managed directory path.
 * @param {string} dirPath
 * @param {Set<string>|Iterable<string>} fileNames
 */
export async function tauriDeleteFiles(dirPath, fileNames) {
  for (const fileName of fileNames) {
    await invoke('delete_file', { dirPath, fileName });
  }
}

/**
 * Show a native "Save As" dialog and return the chosen file path.
 *
 * Does NOT write any data — the caller must subsequently call
 * `tauriWriteBytesToPath()` with the returned path.  This separation is
 * required because `pick_save_path` must run within a fresh user-gesture
 * activation, before any long-running async work (e.g. encryption).
 *
 * @param {string} suggestedName  e.g. "BLES01389SAVE.zip"
 * @returns {Promise<{__tauriPath: string, name: string} | null>}
 *   Handle object, or `null` if the user cancelled.
 */
export async function tauriPickSavePath(suggestedName) {
  const path = /** @type {string} */ (await invoke('pick_save_path', { suggestedName }));
  if (!path) return null;
  const parts = path.split(/[/\\]/);
  const name = parts[parts.length - 1] || suggestedName;
  return { __tauriPath: path, name };
}

/**
 * Write raw bytes to a path previously chosen via `tauriPickSavePath()`.
 *
 * @param {string} path  absolute file path from the pick result
 * @param {Uint8Array} data  raw file bytes
 */
export async function tauriWriteBytesToPath(path, data) {
  await invoke('write_bytes_to_path', {
    path,
    dataB64: bytesToBase64(data),
  });
}
