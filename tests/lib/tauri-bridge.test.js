/**
 * @jest-environment jsdom
 *
 * Tests for the Tauri bridge module (tauri-bridge.js).
 *
 * The pure base64 helpers are tested directly.  The IPC wrappers are tested
 * by injecting a mock `window.__TAURI__.core.invoke` and verifying the
 * command names, argument shapes, and result transforms — without requiring
 * a real Tauri runtime.
 */

import {
  isTauri,
  bytesToBase64,
  base64ToBytes,
  tauriOpenDirectory,
  tauriWriteFiles,
  tauriDeleteFiles,
  tauriPickSavePath,
  tauriWriteBytesToPath,
} from '../../js/lib/tauri-bridge.js';

// ── Helpers for mocking the Tauri global ──

/**
 * The browser `window` augmented with the optional Tauri global the tests
 * install/remove. `__TAURI__` is intentionally permissive — several tests
 * inject malformed shapes (missing `core`, non-function `invoke`) to verify
 * the guard logic, so no `any` cast should be needed.
 * @typedef {Window & { __TAURI__?: Record<string, unknown> }} MockTauriWindow
 */

/**
 * Recorded `invoke` call captured by the mock for later assertion.
 * @typedef {{ command: string, args?: Record<string, unknown> }} InvokeCall
 */

/** @returns {MockTauriWindow} */
function getWindow() {
  return /** @type {MockTauriWindow} */ (window);
}

/**
 * Install a mock `window.__TAURI__` with the given invoke implementation.
 * @param {(command: string, args?: Record<string, unknown>) => Promise<unknown>} fn
 */
function mockTauriInvoke(fn) {
  const w = getWindow();
  w.__TAURI__ = { core: { invoke: fn } };
}

/** Remove `window.__TAURI__` to simulate a non-Tauri environment. */
function clearTauri() {
  delete getWindow().__TAURI__;
}

// ── Base64 helpers ──

describe('bytesToBase64', () => {
  test('empty array produces empty base64', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
  });

  test('encodes a small byte array', () => {
    // "Hello" → base64
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(bytesToBase64(bytes)).toBe(btoa('Hello'));
  });

  test('handles all byte values (0-255)', () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    // Round-trip: encode then decode
    const b64 = bytesToBase64(bytes);
    const decoded = base64ToBytes(b64);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  test('correctly processes arrays larger than the 32 KB chunk size', () => {
    // The chunk size is 0x8000 (32 KB).  Verify the multi-chunk path.
    const bytes = new Uint8Array(0x10000); // 64 KB → 2 chunks
    for (let i = 0; i < bytes.length; i++) bytes[i] = i & 0xff;
    const b64 = bytesToBase64(bytes);
    const decoded = base64ToBytes(b64);
    expect(decoded.length).toBe(bytes.length);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});

describe('base64ToBytes', () => {
  test('decodes a known base64 string', () => {
    const bytes = base64ToBytes(btoa('Hello'));
    expect(Array.from(bytes)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
  });

  test('empty string produces empty array', () => {
    expect(base64ToBytes('').length).toBe(0);
  });

  test('round-trips arbitrary binary data', () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 255]);
    const b64 = bytesToBase64(original);
    const decoded = base64ToBytes(b64);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });
});

// ── isTauri ──

describe('isTauri', () => {
  afterEach(clearTauri);

  test('returns false when window.__TAURI__ is absent', () => {
    clearTauri();
    expect(isTauri()).toBe(false);
  });

  test('returns false when __TAURI__.core is missing', () => {
    getWindow().__TAURI__ = {};
    expect(isTauri()).toBe(false);
  });

  test('returns false when __TAURI__.core.invoke is not a function', () => {
    getWindow().__TAURI__ = { core: { invoke: 'not-a-function' } };
    expect(isTauri()).toBe(false);
  });

  test('returns true when __TAURI__.core.invoke is a function', () => {
    mockTauriInvoke(() => Promise.resolve());
    expect(isTauri()).toBe(true);
  });
});

// ── tauriOpenDirectory ──

describe('tauriOpenDirectory', () => {
  afterEach(clearTauri);

  test('picks directory then reads files, returning lowercase-keyed Map', async () => {
    /** @type {InvokeCall[]} */
    const calls = [];
    mockTauriInvoke(async (command, args) => {
      calls.push({ command, args });
      if (command === 'pick_directory') return ['/path/to/save', 'BLES01389SAVE'];
      if (command === 'read_dir_files') {
        return [
          { name: 'PARAM.SFO', data: bytesToBase64(new Uint8Array([1, 2, 3])) },
          { name: 'USERDATA00.DAT', data: bytesToBase64(new Uint8Array([4, 5])) },
        ];
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const result = await tauriOpenDirectory();
    if (!result) throw new Error('tauriOpenDirectory returned null');

    // pick_directory called first with no args
    expect(calls[0].command).toBe('pick_directory');
    expect(calls[0].args).toBeUndefined();

    // read_dir_files called with the returned dirPath
    expect(calls[1].command).toBe('read_dir_files');
    expect(calls[1].args).toEqual({ dirPath: '/path/to/save' });

    // Result shape
    expect(result.dirPath).toBe('/path/to/save');
    expect(result.dirName).toBe('BLES01389SAVE');
    expect(result.files.size).toBe(2);

    // Keys are lowercased; original name + decoded bytes are preserved
    expect(result.files.has('param.sfo')).toBe(true);
    expect(result.files.has('userdata00.dat')).toBe(true);
    const paramEntry = result.files.get('param.sfo');
    expect(paramEntry?.name).toBe('PARAM.SFO');
    expect(Array.from(paramEntry?.bytes ?? [])).toEqual([1, 2, 3]);
  });

  test('returns null when user cancels the dialog', async () => {
    mockTauriInvoke(async (command) => {
      if (command === 'pick_directory') return null;
      throw new Error('read_dir_files should not be called after cancel');
    });

    const result = await tauriOpenDirectory();
    expect(result).toBeNull();
  });
});

// ── tauriWriteFiles ──

describe('tauriWriteFiles', () => {
  afterEach(clearTauri);

  test('writes each file with base64-encoded data via write_file command', async () => {
    /** @type {InvokeCall[]} */
    const calls = [];
    mockTauriInvoke(async (command, args) => {
      calls.push({ command, args });
    });

    const files = new Map([
      ['file1.dat', new Uint8Array([1, 2, 3])],
      ['file2.dat', new Uint8Array([4, 5])],
    ]);

    await tauriWriteFiles('/output/dir', files);

    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.command === 'write_file')).toBe(true);
    expect(calls[0].args?.dirPath).toBe('/output/dir');
    expect(calls[0].args?.fileName).toBe('file1.dat');
    expect(calls[0].args?.dataB64).toBe(bytesToBase64(new Uint8Array([1, 2, 3])));
    expect(calls[1].args?.fileName).toBe('file2.dat');
  });

  test('writes files in parallel', async () => {
    let activeCount = 0;
    let maxConcurrent = 0;

    mockTauriInvoke(async () => {
      activeCount++;
      maxConcurrent = Math.max(maxConcurrent, activeCount);
      await new Promise((r) => setTimeout(r, 10));
      activeCount--;
    });

    const files = new Map([
      ['a.dat', new Uint8Array([1])],
      ['b.dat', new Uint8Array([2])],
      ['c.dat', new Uint8Array([3])],
    ]);

    await tauriWriteFiles('/dir', files);

    expect(maxConcurrent).toBe(3);
  });

  test('empty file map calls invoke zero times', async () => {
    let callCount = 0;
    mockTauriInvoke(async () => {
      callCount++;
    });

    await tauriWriteFiles('/dir', new Map());

    expect(callCount).toBe(0);
  });
});

// ── tauriDeleteFiles ──

describe('tauriDeleteFiles', () => {
  afterEach(clearTauri);

  test('deletes each file via delete_file command', async () => {
    /** @type {InvokeCall[]} */
    const calls = [];
    mockTauriInvoke(async (command, args) => {
      calls.push({ command, args });
    });

    await tauriDeleteFiles('/dir', new Set(['old.dat', 'stale.pfd']));

    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.command === 'delete_file')).toBe(true);
    const fileNames = calls.map((c) => c.args?.fileName).sort();
    expect(fileNames).toEqual(['old.dat', 'stale.pfd']);
    expect(calls[0].args?.dirPath).toBe('/dir');
  });

  test('accepts any iterable (e.g. array)', async () => {
    /** @type {InvokeCall[]} */
    const calls = [];
    mockTauriInvoke(async (command, args) => {
      calls.push({ command, args });
    });

    await tauriDeleteFiles('/dir', ['file1.dat', 'file2.dat']);

    expect(calls).toHaveLength(2);
  });
});

// ── tauriPickSavePath ──

describe('tauriPickSavePath', () => {
  afterEach(clearTauri);

  test('returns handle with __tauriPath and extracted name (POSIX path)', async () => {
    mockTauriInvoke(async (command, args) => {
      expect(command).toBe('pick_save_path');
      expect(args).toEqual({ suggestedName: 'save.zip' });
      return '/home/user/save.zip';
    });

    const handle = await tauriPickSavePath('save.zip');

    expect(handle).not.toBeNull();
    expect(handle?.__tauriPath).toBe('/home/user/save.zip');
    expect(handle?.name).toBe('save.zip');
  });

  test('extracts name from Windows-style path', async () => {
    mockTauriInvoke(async () => 'C:\\Users\\test\\my-save.zip');

    const handle = await tauriPickSavePath('my-save.zip');

    expect(handle?.name).toBe('my-save.zip');
    expect(handle?.__tauriPath).toBe('C:\\Users\\test\\my-save.zip');
  });

  test('returns null when user cancels', async () => {
    mockTauriInvoke(async () => null);
    expect(await tauriPickSavePath('save.zip')).toBeNull();
  });

  test('falls back to suggestedName when path ends with a separator', async () => {
    // Path ends with '/' → split produces empty last element → fallback
    mockTauriInvoke(async () => '/path/to/');
    const handle = await tauriPickSavePath('fallback.zip');
    expect(handle?.name).toBe('fallback.zip');
  });
});

// ── tauriWriteBytesToPath ──

describe('tauriWriteBytesToPath', () => {
  afterEach(clearTauri);

  test('writes base64-encoded data via write_bytes_to_path', async () => {
    /** @type {InvokeCall[]} */
    const calls = [];
    mockTauriInvoke(async (command, args) => {
      calls.push({ command, args });
    });

    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    await tauriWriteBytesToPath('/output/save.zip', data);

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('write_bytes_to_path');
    expect(calls[0].args?.path).toBe('/output/save.zip');
    expect(calls[0].args?.dataB64).toBe(bytesToBase64(data));
  });
});

// ── Error handling: invoke outside Tauri ──

describe('invoke guard (outside Tauri)', () => {
  afterEach(clearTauri);

  test('IPC wrappers throw when not in Tauri environment', async () => {
    clearTauri();

    await expect(tauriPickSavePath('test.zip')).rejects.toThrow(/outside Tauri environment/);
  });
});
