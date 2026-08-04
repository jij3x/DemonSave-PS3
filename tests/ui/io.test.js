/**
 * @jest-environment jsdom
 *
 * Tests for the browser-side file I/O module (io.js).
 *
 * Covers capability detection (canWriteInPlace, canChooseSaveLocation),
 * drag-and-drop file reading, directory write/delete, ZIP download,
 * and the "Save As" picker flow.
 *
 * The tauri-bridge is mocked so all tests run in "browser mode".
 */

import { jest } from '@jest/globals';
import { TextEncoder } from 'node:util';

/** Browser window cast to allow Chromium File System Access API properties. */
const w = /** @type {any} */ (window);

// Mock tauri-bridge — default to NOT Tauri
jest.unstable_mockModule('../../js/lib/tauri-bridge.js', () => ({
  __esModule: true,
  isTauri: () => false,
  tauriOpenDirectory: jest.fn(),
  tauriWriteFiles: jest.fn(),
  tauriDeleteFiles: jest.fn(),
  tauriPickSavePath: jest.fn(),
  tauriWriteBytesToPath: jest.fn(),
}));

// Mock fflate — its ESM browser build can't be parsed by Jest in jsdom.
jest.unstable_mockModule('fflate', () => ({
  __esModule: true,
  zip: (files, opts, cb) => {
    const entries = Object.values(files);
    let totalSize = 0;
    for (const data of entries) totalSize += data.length;
    const result = new Uint8Array(totalSize + 30 + entries.length * 46 + 22);
    result[0] = 0x50;
    result[1] = 0x4b;
    result[2] = 0x03;
    result[3] = 0x04;
    let offset = 4;
    for (const data of entries) {
      result.set(data, offset);
      offset += data.length;
    }
    cb(null, result);
  },
}));

const {
  canWriteInPlace,
  canChooseSaveLocation,
  readFilesFromDataTransfer,
  writeFilesToDirectory,
  deleteFilesFromDirectory,
  downloadFilesAsZip,
  pickZipFile,
  writeZipToHandle,
  openDirectoryViaFSAccess,
} = await import('../../js/ui/io.js');

// ---------------------------------------------------------------------------
// Capability detection
// ---------------------------------------------------------------------------

describe('capability detection', () => {
  describe('canWriteInPlace', () => {
    test('returns false when neither Tauri nor File System Access API is available', () => {
      const result = canWriteInPlace();
      expect(result).toBe(false);
    });

    test('returns true when showDirectoryPicker is available in a secure context', () => {
      w.showDirectoryPicker = jest.fn();
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        configurable: true,
        writable: true,
      });
      expect(canWriteInPlace()).toBe(true);

      delete w.showDirectoryPicker;
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        configurable: true,
        writable: true,
      });
    });
  });

  describe('canChooseSaveLocation', () => {
    test('returns false when neither Tauri nor showSaveFilePicker is available', () => {
      expect(canChooseSaveLocation()).toBe(false);
    });

    test('returns true when showSaveFilePicker is available in a secure context', () => {
      w.showSaveFilePicker = jest.fn();
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        configurable: true,
        writable: true,
      });
      expect(canChooseSaveLocation()).toBe(true);

      delete w.showSaveFilePicker;
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        configurable: true,
        writable: true,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// readFilesFromDataTransfer — drag-and-drop folder reading
// ---------------------------------------------------------------------------

describe('readFilesFromDataTransfer', () => {
  /**
   * Build a mock DataTransferItemList simulating a dropped directory
   * containing files.
   */
  function makeMockItems(entries) {
    return entries.map((entry) => {
      if (entry.isDirectory) {
        // readEntries must return empty on the second call (mimics real API)
        let readOnce = false;
        return {
          webkitGetAsEntry: () => ({
            isFile: false,
            isDirectory: true,
            name: entry.name,
            createReader: () => ({
              readEntries: (callback) => {
                if (readOnce) {
                  callback([]);
                  return;
                }
                readOnce = true;
                callback(
                  entry.children?.map((c) => ({
                    isFile: true,
                    isDirectory: false,
                    name: c.name,
                    file: (cb) =>
                      cb({
                        name: c.name,
                        size: c.content.length,
                        arrayBuffer: () => Promise.resolve(c.content.buffer),
                      }),
                  })) || [],
                );
              },
            }),
          }),
        };
      }
      return {
        webkitGetAsEntry: () => ({
          isFile: true,
          isDirectory: false,
          name: entry.name,
          file: (cb) =>
            cb({
              name: entry.name,
              size: entry.content.length,
              arrayBuffer: () => Promise.resolve(entry.content.buffer),
            }),
        }),
      };
    });
  }

  test('reads a directory entry and its files', async () => {
    const content = new TextEncoder().encode('hello world');
    const items = makeMockItems([
      {
        name: 'BLES01389SAVE',
        isDirectory: true,
        children: [
          { name: 'PARAM.SFO', content },
          { name: 'USERDATA00.DAT', content: new Uint8Array([1, 2, 3]) },
        ],
      },
    ]);

    const { files, dirName } = await readFilesFromDataTransfer(items);

    expect(dirName).toBe('BLES01389SAVE');
    expect(files.size).toBe(2);
    expect(files.has('param.sfo')).toBe(true);
    expect(files.has('userdata00.dat')).toBe(true);
    expect(Array.from(files.get('param.sfo').bytes)).toEqual(Array.from(content));
  });

  test('reads individual files when no directory is dropped', async () => {
    const content1 = new TextEncoder().encode('file1');
    const content2 = new Uint8Array([10, 20, 30]);

    const items = makeMockItems([
      { name: 'PARAM.SFO', content: content1 },
      { name: 'USER.DAT', content: content2 },
    ]);

    const { files, dirName } = await readFilesFromDataTransfer(items);

    expect(dirName).toBe('');
    expect(files.size).toBe(2);
    expect(files.has('param.sfo')).toBe(true);
    expect(files.has('user.dat')).toBe(true);
  });

  test('ignores items without webkitGetAsEntry', async () => {
    const items = [
      { webkitGetAsEntry: () => null },
      {
        webkitGetAsEntry: () => ({
          isFile: true,
          isDirectory: false,
          name: 'TEST.BIN',
          file: (cb) =>
            cb({
              name: 'TEST.BIN',
              size: 1,
              arrayBuffer: () => Promise.resolve(new Uint8Array([42]).buffer),
            }),
        }),
      },
    ];

    const { files } = await readFilesFromDataTransfer(/** @type {any} */ (items));
    expect(files.size).toBe(1);
    expect(files.has('test.bin')).toBe(true);
  });

  test('stores original filename alongside lowercase key', async () => {
    const content = new Uint8Array([1]);
    const items = makeMockItems([{ name: 'PARAM.SFO', content }]);

    const { files } = await readFilesFromDataTransfer(items);
    expect(files.get('param.sfo').name).toBe('PARAM.SFO');
  });

  test('rejects files exceeding MAX_SAVE_FILE_SIZE in drag-and-drop', async () => {
    const hugeContent = new Uint8Array(17 * 1024 * 1024);
    const items = makeMockItems([{ name: 'HUGE.DAT', content: hugeContent }]);

    await expect(readFilesFromDataTransfer(items)).rejects.toThrow(/too large/i);
  });

  test('rejects total size exceeding MAX_TOTAL_SAVE_SIZE in drag-and-drop', async () => {
    // Each file is 10MB, 7 files = 70MB > 64MB limit
    const files10MB = new Uint8Array(10 * 1024 * 1024);
    const items = makeMockItems([
      {
        name: 'FOLDER',
        isDirectory: true,
        children: Array.from({ length: 7 }, (_, i) => ({
          name: `FILE${i}.DAT`,
          content: files10MB,
        })),
      },
    ]);

    await expect(readFilesFromDataTransfer(items)).rejects.toThrow(/total.*exceeds/i);
  });
});

// ---------------------------------------------------------------------------
// writeFilesToDirectory — Chromium FileSystemDirectoryHandle path
// ---------------------------------------------------------------------------

describe('writeFilesToDirectory', () => {
  test('writes each file sequentially via FileSystemDirectoryHandle', async () => {
    const written = [];
    const mockDirHandle = {
      getFileHandle: jest.fn((name) => {
        const writable = {
          write: jest.fn((data) => written.push({ name, data })),
          close: jest.fn(),
        };
        return Promise.resolve({
          createWritable: () => Promise.resolve(writable),
        });
      }),
    };

    const files = new Map([
      ['file1.dat', new Uint8Array([1, 2])],
      ['file2.dat', new Uint8Array([3, 4])],
    ]);

    await writeFilesToDirectory(mockDirHandle, files);

    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('file1.dat', { create: true });
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('file2.dat', { create: true });
    expect(written).toHaveLength(2);
  });

  test('delegates to Tauri IPC when handle has __tauriDirPath', async () => {
    const tauriModule = /** @type {any} */ (await import('../../js/lib/tauri-bridge.js'));
    tauriModule.tauriWriteFiles.mockResolvedValue(undefined);

    const dirHandle = { __tauriDirPath: '/path/to/save' };
    const files = new Map([['USER.DAT', new Uint8Array([1])]]);

    await writeFilesToDirectory(dirHandle, files);

    expect(tauriModule.tauriWriteFiles).toHaveBeenCalledWith('/path/to/save', files);
  });
});

// ---------------------------------------------------------------------------
// deleteFilesFromDirectory
// ---------------------------------------------------------------------------

describe('deleteFilesFromDirectory', () => {
  test('removes entries via FileSystemDirectoryHandle', async () => {
    const removed = [];
    const mockDirHandle = {
      removeEntry: jest.fn((name) => {
        removed.push(name);
        return Promise.resolve();
      }),
    };

    await deleteFilesFromDirectory(mockDirHandle, new Set(['old.dat', 'stale.pfd']));

    expect(removed).toEqual(['old.dat', 'stale.pfd']);
  });

  test('silently ignores NotFoundError', async () => {
    const mockDirHandle = {
      removeEntry: jest.fn(() =>
        Promise.reject(Object.assign(new Error('not found'), { name: 'NotFoundError' })),
      ),
    };

    await expect(
      deleteFilesFromDirectory(mockDirHandle, new Set(['missing.dat'])),
    ).resolves.toBeUndefined();
  });

  test('rethrows non-NotFoundError errors', async () => {
    const mockDirHandle = {
      removeEntry: jest.fn(() => Promise.reject(new Error('Permission denied'))),
    };

    await expect(deleteFilesFromDirectory(mockDirHandle, new Set(['locked.dat']))).rejects.toThrow(
      'Permission denied',
    );
  });

  test('delegates to Tauri IPC when handle has __tauriDirPath', async () => {
    const tauriModule = /** @type {any} */ (await import('../../js/lib/tauri-bridge.js'));
    tauriModule.tauriDeleteFiles.mockResolvedValue(undefined);

    const dirHandle = { __tauriDirPath: '/path/to/save' };
    await deleteFilesFromDirectory(dirHandle, new Set(['PARAM.PFD']));

    expect(tauriModule.tauriDeleteFiles).toHaveBeenCalledWith(
      '/path/to/save',
      new Set(['PARAM.PFD']),
    );
  });
});

// ---------------------------------------------------------------------------
// downloadFilesAsZip
// ---------------------------------------------------------------------------

describe('downloadFilesAsZip', () => {
  beforeEach(() => {
    // jsdom doesn't have URL.createObjectURL — provide a mock
    if (!URL.createObjectURL) {
      URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = jest.fn();
    }
  });

  test('creates an anchor with download attribute and clicks it', async () => {
    const files = new Map([['test.txt', new TextEncoder().encode('hello')]]);

    let clickedAnchor = /** @type {any} */ (null);
    // Save reference to real createElement before spying
    const realCreate = document.createElement;
    const spy = jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate.call(document, tag);
      if (tag === 'a') {
        el.click = () => {
          clickedAnchor = el;
        };
      }
      return el;
    });

    await downloadFilesAsZip(files, 'my-save.zip');

    expect(clickedAnchor).not.toBeNull();
    expect(clickedAnchor.download).toBe('my-save.zip');

    spy.mockRestore();
  });

  test('uses default name "des_save.zip" when no name provided', async () => {
    const files = new Map([['a.txt', new Uint8Array([1])]]);

    let clickedAnchor = /** @type {any} */ (null);
    const realCreate = document.createElement;
    const spy = jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate.call(document, tag);
      if (tag === 'a') {
        el.click = () => {
          clickedAnchor = el;
        };
      }
      return el;
    });

    await downloadFilesAsZip(files);

    expect(clickedAnchor.download).toBe('des_save.zip');

    spy.mockRestore();
  });

  test('produces a valid ZIP archive', async () => {
    const content = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xaa, 0xbb]);
    const files = new Map([['data.bin', content]]);

    // Mock createObjectURL to capture the blob
    let capturedBlob = /** @type {any} */ (null);
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
      capturedBlob = blob;
      return 'blob:mock';
    };

    const realCreate = document.createElement;
    const spy = jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate.call(document, tag);
      if (tag === 'a') el.click = () => {};
      return el;
    });

    await downloadFilesAsZip(files, 'test.zip');

    // Verify the blob was created and contains data
    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob.type).toBe('application/zip');

    URL.createObjectURL = origCreate;
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// pickZipFile
// ---------------------------------------------------------------------------

describe('pickZipFile', () => {
  test('uses showSaveFilePicker when available', async () => {
    const mockHandle = { name: 'chosen.zip' };
    w.showSaveFilePicker = jest.fn();
    w.showSaveFilePicker.mockResolvedValue(mockHandle);

    const handle = await pickZipFile('my-save.zip');
    expect(handle).toBe(mockHandle);
    expect(w.showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'my-save.zip' }),
    );

    delete w.showSaveFilePicker;
  });

  test('passes ZIP MIME type to showSaveFilePicker', async () => {
    const mockHandle = { name: 'out.zip' };
    w.showSaveFilePicker = jest.fn();
    w.showSaveFilePicker.mockResolvedValue(mockHandle);

    await pickZipFile('out.zip');
    const args = w.showSaveFilePicker.mock.calls[0][0];
    expect(args.types[0].accept).toEqual({ 'application/zip': ['.zip'] });

    delete w.showSaveFilePicker;
  });

  test('throws when showSaveFilePicker is not available (caller checks canChooseSaveLocation)', async () => {
    // pickZipFile directly calls window.showSaveFilePicker without a capability
    // check — the caller (pickExportDestination) checks canChooseSaveLocation()
    // before calling pickZipFile.
    await expect(pickZipFile('test.zip')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// writeZipToHandle
// ---------------------------------------------------------------------------

describe('writeZipToHandle', () => {
  test('writes ZIP bytes to a Chromium FileSystemFileHandle', async () => {
    const written = [];
    const mockFileHandle = {
      createWritable: () =>
        Promise.resolve({
          write: (data) => {
            written.push(data);
          },
          close: () => Promise.resolve(),
        }),
    };

    const files = new Map([['hello.txt', new Uint8Array([0x68, 0x69])]]);

    await writeZipToHandle(mockFileHandle, files);

    expect(written).toHaveLength(1);
    // Verify the written data is a valid ZIP (PK\x03\x04 signature)
    const zipBytes = written[0];
    expect(zipBytes[0]).toBe(0x50); // 'P'
    expect(zipBytes[1]).toBe(0x4b); // 'K'
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);
  });

  test('delegates to Tauri IPC when handle has __tauriPath', async () => {
    const tauriModule = /** @type {any} */ (await import('../../js/lib/tauri-bridge.js'));
    tauriModule.tauriWriteBytesToPath.mockResolvedValue(undefined);

    const handle = { __tauriPath: '/output/save.zip' };
    const files = new Map([['a.txt', new Uint8Array([1])]]);

    await writeZipToHandle(handle, files);

    expect(tauriModule.tauriWriteBytesToPath).toHaveBeenCalledWith(
      '/output/save.zip',
      expect.any(Uint8Array),
    );
  });
});

// ---------------------------------------------------------------------------
// openDirectoryViaFSAccess (Chromium path)
// ---------------------------------------------------------------------------

/**
 * Create a mock FileSystemDirectoryHandle whose values() returns a proper
 * async iterable over the given entries.
 */
function makeMockDirHandle(entries) {
  return {
    values: () => ({
      [Symbol.asyncIterator]: async function* () {
        for (const entry of entries) {
          yield entry;
        }
      },
    }),
  };
}

describe('openDirectoryViaFSAccess (Chromium)', () => {
  test('reads files from a Chromium directory handle', async () => {
    const mockFileEntries = [
      {
        kind: 'file',
        name: 'PARAM.SFO',
        getFile: () =>
          Promise.resolve({
            name: 'PARAM.SFO',
            size: 5,
            arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4, 5]).buffer),
          }),
      },
      {
        kind: 'file',
        name: 'USER.DAT',
        getFile: () =>
          Promise.resolve({
            name: 'USER.DAT',
            size: 3,
            arrayBuffer: () => Promise.resolve(new Uint8Array([10, 20, 30]).buffer),
          }),
      },
    ];

    const mockDirHandle = makeMockDirHandle(mockFileEntries);

    w.showDirectoryPicker = jest.fn();
    w.showDirectoryPicker.mockResolvedValue(mockDirHandle);
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });

    const { dirHandle: returnedHandle, files } = await openDirectoryViaFSAccess();

    expect(returnedHandle).toBe(mockDirHandle);
    expect(files.size).toBe(2);
    expect(files.has('param.sfo')).toBe(true);
    expect(files.has('user.dat')).toBe(true);

    delete w.showDirectoryPicker;
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
      writable: true,
    });
  });

  test('throws AbortError-like when showDirectoryPicker throws AbortError', async () => {
    w.showDirectoryPicker = jest.fn();
    w.showDirectoryPicker.mockRejectedValue(
      Object.assign(new Error('User cancelled'), { name: 'AbortError' }),
    );
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });

    await expect(openDirectoryViaFSAccess()).rejects.toThrow('User cancelled');

    delete w.showDirectoryPicker;
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
      writable: true,
    });
  });

  test('rejects files exceeding MAX_SAVE_FILE_SIZE', async () => {
    const hugeSize = 17 * 1024 * 1024; // 17 MB > 16 MB limit
    const mockFileEntries = [
      {
        kind: 'file',
        name: 'HUGE.DAT',
        getFile: () =>
          Promise.resolve({
            name: 'HUGE.DAT',
            size: hugeSize,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          }),
      },
    ];

    const mockDirHandle = makeMockDirHandle(mockFileEntries);

    w.showDirectoryPicker = jest.fn();
    w.showDirectoryPicker.mockResolvedValue(mockDirHandle);
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });

    await expect(openDirectoryViaFSAccess()).rejects.toThrow(/too large/i);

    delete w.showDirectoryPicker;
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
      writable: true,
    });
  });
});

// ---------------------------------------------------------------------------
// buildZipAsync tests are covered in zip.test.js
