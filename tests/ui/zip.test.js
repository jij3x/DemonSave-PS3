/**
 * Tests for the ZIP export functionality.
 *
 * Verifies that buildZipAsync() produces a valid ZIP archive with real
 * DEFLATE compression by round-tripping through fflate's unzipSync() and
 * checking that every entry's content matches the original input.
 */

import { buildZipAsync } from '../../js/ui/io.js';
import { unzipSync } from 'fflate';

describe('ZIP export (buildZipAsync)', () => {
  test('round-trips a single file with correct content', async () => {
    const files = new Map([['USER.DAT', new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05])]]);

    const zipBytes = await buildZipAsync(files);
    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(zipBytes.length).toBeGreaterThan(0);

    const extracted = unzipSync(zipBytes);
    expect(Object.keys(extracted)).toEqual(['USER.DAT']);
    expect(Array.from(extracted['USER.DAT'])).toEqual([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
  });

  test('round-trips multiple files', async () => {
    const fileA = new Uint8Array(256);
    for (let i = 0; i < 256; i++) fileA[i] = i & 0xff;

    const fileB = new TextEncoder().encode('Hello, Demon\u2019s Souls!');

    const files = new Map([
      ['PARAM.SFO', fileA],
      ['USER.DAT', fileB],
    ]);

    const zipBytes = await buildZipAsync(files);
    const extracted = unzipSync(zipBytes);

    expect(Object.keys(extracted).sort()).toEqual(['PARAM.SFO', 'USER.DAT']);
    expect(Array.from(extracted['PARAM.SFO'])).toEqual(Array.from(fileA));
    expect(Array.from(extracted['USER.DAT'])).toEqual(Array.from(fileB));
  });

  test('produces a valid ZIP signature', async () => {
    const files = new Map([['test.bin', new Uint8Array([0xaa, 0xbb])]]);

    const zipBytes = await buildZipAsync(files);

    // First 4 bytes of any ZIP file: PK\x03\x04 (local file header signature)
    expect(zipBytes[0]).toBe(0x50); // 'P'
    expect(zipBytes[1]).toBe(0x4b); // 'K'
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);
  });

  test('compresses repetitive data (DEFLATE, not store-only)', async () => {
    // 4 KB of identical bytes — should compress dramatically with DEFLATE
    const repetitive = new Uint8Array(4096).fill(0x41); // 'AAAA...'
    const files = new Map([['big.bin', repetitive]]);

    const zipBytes = await buildZipAsync(files);

    // Verify content integrity
    const extracted = unzipSync(zipBytes);
    expect(extracted['big.bin'].length).toBe(4096);
    expect(extracted['big.bin'].every((b) => b === 0x41)).toBe(true);

    // With DEFLATE level 6, 4 KB of identical bytes should compress to
    // well under 200 bytes (store-only would be ~4096 + 30 header).
    // If it were store-only, the archive would be >4000 bytes.
    expect(zipBytes.length).toBeLessThan(200);
  });
});
