/**
 * Tests for PARAM.SFO parsing and profile number read/write.
 */
import {
  parseParamSfo,
  getTitle,
  getSubTitle,
  getDetail,
  getDirectoryName,
  getTitleId,
  getAccountId,
  getSfoAccountId,
  writeSfoAccountId,
  getSfoAttribute,
  removeCopyProtection,
  FMT,
} from '../../../js/lib/ps3-save-lib/index.js';
import { bad } from '../../helpers.js';

/**
 * Build a minimal synthetic PARAM.SFO buffer for testing.
 * @param {{name: string, value: string, dataFmt: number}[]} entries - [{name, value, dataFmt}]
 * @returns {Uint8Array}
 */
function buildSfo(entries) {
  // Header: 20 bytes
  // Index table: 16 bytes per entry
  // Key table: null-terminated strings
  // Data table: values
  const numEntries = entries.length;
  const headerSize = 20;
  const indexTableSize = numEntries * 16;
  const keyTableStart = headerSize + indexTableSize;

  // Build key table
  let keyData = [];
  let keyOffsets = [];
  let keyCursor = 0;
  for (const e of entries) {
    keyOffsets.push(keyCursor);
    for (let i = 0; i < e.name.length; i++) {
      keyData.push(e.name.charCodeAt(i));
      keyCursor++;
    }
    keyData.push(0); // null terminator
    keyCursor++;
  }

  const dataTableStart = keyTableStart + keyData.length;

  // Build data table
  let dataData = [];
  let dataOffsets = [];
  let dataCursor = 0;
  for (const e of entries) {
    dataOffsets.push(dataCursor);
    if (e.dataFmt === FMT.INT32) {
      const val = parseInt(e.value, 10);
      dataData.push(val & 0xff, (val >> 8) & 0xff, (val >> 16) & 0xff, (val >> 24) & 0xff);
      dataCursor += 4;
    } else {
      for (let i = 0; i < e.value.length; i++) {
        dataData.push(e.value.charCodeAt(i));
        dataCursor++;
      }
      dataData.push(0); // null terminator
      dataCursor++;
    }
  }

  const totalSize = dataTableStart + dataData.length;
  const buf = new Uint8Array(totalSize);
  const dv = new DataView(buf.buffer);

  // Header magic: \0PSF
  buf[0] = 0x00;
  buf[1] = 0x50;
  buf[2] = 0x53;
  buf[3] = 0x46;
  // Version
  buf[4] = 0x01;
  buf[5] = 0x01;
  buf[6] = 0x00;
  buf[7] = 0x00;
  // Key table start (LE)
  dv.setUint32(8, keyTableStart, true);
  // Data table start (LE)
  dv.setUint32(12, dataTableStart, true);
  // Index entries (LE)
  dv.setUint32(16, numEntries, true);

  // Index table
  for (let i = 0; i < numEntries; i++) {
    const off = 20 + i * 16;
    dv.setUint16(off, keyOffsets[i], true); // key offset (LE)
    // fmt is stored big-endian on disk → swap16
    const fmtNative = entries[i].dataFmt;
    const fmtDisk = ((fmtNative & 0xff) << 8) | ((fmtNative >> 8) & 0xff);
    dv.setUint16(off + 2, fmtDisk, true);
    // data len (LE)
    const dataLen = entries[i].dataFmt === FMT.INT32 ? 4 : entries[i].value.length + 1;
    dv.setUint32(off + 4, dataLen, true);
    // data max len (LE)
    dv.setUint32(off + 8, dataLen, true);
    // data offset (LE)
    dv.setUint32(off + 12, dataOffsets[i], true);
  }

  // Key table
  for (let i = 0; i < keyData.length; i++) {
    buf[keyTableStart + i] = keyData[i];
  }

  // Data table
  for (let i = 0; i < dataData.length; i++) {
    buf[dataTableStart + i] = dataData[i];
  }

  return buf;
}

describe('parseParamSfo', () => {
  test('throws on invalid header magic', () => {
    const bad = new Uint8Array(32);
    expect(() => parseParamSfo(bad)).toThrow('Invalid PARAM.SFO Header Magic');
  });

  test('parses ASCII entries', () => {
    const sfo = buildSfo([{ name: 'TITLE', value: 'Demon', dataFmt: FMT.UTF8 }]);
    const parsed = parseParamSfo(sfo);
    expect(parsed.header.magic).toEqual(new Uint8Array([0x00, 0x50, 0x53, 0x46]));
    expect(parsed.tables).toHaveLength(1);
    expect(parsed.tables[0].name).toBe('TITLE');
    expect(parsed.tables[0].value).toBe('Demon');
    expect(parsed.tables[0].dataFmt).toBe(FMT.UTF8);
  });

  test('parses UTF-8 entries', () => {
    const sfo = buildSfo([{ name: 'SUB_TITLE', value: 'Hello', dataFmt: FMT.UTF8_S }]);
    const parsed = parseParamSfo(sfo);
    expect(parsed.tables[0].name).toBe('SUB_TITLE');
    expect(parsed.tables[0].value).toBe('Hello');
    expect(parsed.tables[0].dataFmt).toBe(FMT.UTF8_S);
  });

  test('parses UINT32 entries', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: '12345', dataFmt: FMT.INT32 }]);
    const parsed = parseParamSfo(sfo);
    expect(parsed.tables[0].name).toBe('ACCOUNT_ID');
    expect(parsed.tables[0].value).toBe('12345');
    expect(parsed.tables[0].dataFmt).toBe(FMT.INT32);
  });

  test('handles unknown format (returns empty string)', () => {
    const sfo = buildSfo([{ name: 'WEIRD', value: 'test', dataFmt: 0x999 }]);
    const parsed = parseParamSfo(sfo);
    expect(parsed.tables[0].value).toBe('');
  });

  test('parses multiple entries', () => {
    const sfo = buildSfo([
      { name: 'TITLE', value: 'MyGame', dataFmt: FMT.UTF8 },
      { name: 'SUB_TITLE', value: 'Save1', dataFmt: FMT.UTF8 },
      { name: 'SAVEDATA_DIRECTORY', value: 'BLES00932-SAVE', dataFmt: FMT.UTF8 },
    ]);
    const parsed = parseParamSfo(sfo);
    expect(parsed.tables).toHaveLength(3);
    expect(parsed.tables[2].name).toBe('SAVEDATA_DIRECTORY');
  });
});

describe('convenience accessors', () => {
  test('getTitle', () => {
    const sfo = buildSfo([{ name: 'TITLE', value: 'TestTitle', dataFmt: FMT.UTF8 }]);
    const parsed = parseParamSfo(sfo);
    expect(getTitle(parsed)).toBe('TestTitle');
  });

  test('getSubTitle', () => {
    const sfo = buildSfo([{ name: 'SUB_TITLE', value: 'Sub', dataFmt: FMT.UTF8 }]);
    const parsed = parseParamSfo(sfo);
    expect(getSubTitle(parsed)).toBe('Sub');
  });

  test('getDetail', () => {
    const sfo = buildSfo([{ name: 'DETAIL', value: 'Details', dataFmt: FMT.UTF8 }]);
    const parsed = parseParamSfo(sfo);
    expect(getDetail(parsed)).toBe('Details');
  });

  test('getDirectoryName', () => {
    const sfo = buildSfo([
      { name: 'SAVEDATA_DIRECTORY', value: 'BLES00932-SAVE', dataFmt: FMT.UTF8 },
    ]);
    const parsed = parseParamSfo(sfo);
    expect(getDirectoryName(parsed)).toBe('BLES00932-SAVE');
  });

  test('getTitleId extracts prefix before dash', () => {
    const sfo = buildSfo([
      { name: 'SAVEDATA_DIRECTORY', value: 'BLES00932-SAVE', dataFmt: FMT.UTF8 },
    ]);
    const parsed = parseParamSfo(sfo);
    expect(getTitleId(parsed)).toBe('BLES00932');
  });

  test('getTitleId returns empty when no directory', () => {
    const sfo = buildSfo([{ name: 'TITLE', value: 'test', dataFmt: FMT.UTF8 }]);
    const parsed = parseParamSfo(sfo);
    expect(getTitleId(parsed)).toBe('');
  });

  test('getAccountId lowercases the value', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: 'ABCDEF', dataFmt: FMT.UTF8 }]);
    const parsed = parseParamSfo(sfo);
    expect(getAccountId(parsed)).toBe('abcdef');
  });

  test('get returns empty for null/undefined sfo', () => {
    expect(getTitle(bad(null))).toBe('');
    expect(getTitle(bad(undefined))).toBe('');
  });

  test('get returns empty for missing key', () => {
    const sfo = buildSfo([{ name: 'TITLE', value: 'test', dataFmt: FMT.UTF8 }]);
    const parsed = parseParamSfo(sfo);
    expect(getDetail(parsed)).toBe('');
  });
});

describe('getSfoAccountId / writeSfoAccountId', () => {
  test('reads ACCOUNT_ID as hex string', () => {
    // Use 16-byte value so buildSfo allocates enough data
    const val16 = '\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10';
    const sfo = buildSfo([
      { name: 'TITLE', value: 'Test', dataFmt: FMT.UTF8 },
      { name: 'ACCOUNT_ID', value: val16, dataFmt: FMT.UTF8 },
    ]);
    const hex = getSfoAccountId(sfo);
    expect(hex).toBe('0102030405060708090a0b0c0d0e0f10');
  });

  test('returns empty string when ACCOUNT_ID is absent', () => {
    const sfo = buildSfo([{ name: 'TITLE', value: 'Test', dataFmt: FMT.UTF8 }]);
    expect(getSfoAccountId(sfo)).toBe('');
  });

  test('writes ACCOUNT_ID from hex string', () => {
    const sfo = buildSfo([
      { name: 'TITLE', value: 'Test', dataFmt: FMT.UTF8 },
      { name: 'ACCOUNT_ID', value: 'xxxxxxxxxxxxxxxx', dataFmt: FMT.UTF8 },
    ]);
    const result = writeSfoAccountId(sfo, '0123456789abcdef0123456789abcdef');
    expect(result).toBe(true);
    expect(getSfoAccountId(sfo)).toBe('0123456789abcdef0123456789abcdef');
  });

  test('returns false when ACCOUNT_ID is absent', () => {
    const sfo = buildSfo([{ name: 'TITLE', value: 'Test', dataFmt: FMT.UTF8 }]);
    const result = writeSfoAccountId(sfo, '0123456789abcdef');
    expect(result).toBe(false);
  });

  test('throws on too-short hex string', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: 'xxxxxxxxxxxxxxxx', dataFmt: FMT.UTF8 }]);
    // Short hex strings (< 16 chars = 8 bytes) throw instead of silently
    // zero-padding, which could bind the save to the wrong account.
    expect(() => writeSfoAccountId(sfo, 'abc')).toThrow(/too short/i);
    expect(() => writeSfoAccountId(sfo, '0123456789abc')).toThrow(/too short/i);
  });

  test('pads hex string ≥ 16 chars to 32', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: 'xxxxxxxxxxxxxxxx', dataFmt: FMT.UTF8 }]);
    // 16 chars (8 bytes) is the minimum — should be padded to 32 chars
    writeSfoAccountId(sfo, '0123456789abcdef');
    expect(getSfoAccountId(sfo).length).toBe(32);
    expect(getSfoAccountId(sfo)).toMatch(/^0123456789abcdef0{16}$/);
  });

  test('round-trip: write → read preserves value', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: 'xxxxxxxxxxxxxxxx', dataFmt: FMT.UTF8 }]);
    const testHex = 'deadbeefcafebabe0123456789abcdef';
    writeSfoAccountId(sfo, testHex);
    expect(getSfoAccountId(sfo)).toBe(testHex);
  });
});

describe('SFO copy-protection removal', () => {
  test('getSfoAttribute reads ATTRIBUTE value', () => {
    const sfo = buildSfo([
      { name: 'TITLE', value: 'Test', dataFmt: FMT.UTF8 },
      { name: 'ATTRIBUTE', value: '1', dataFmt: FMT.INT32 },
    ]);
    expect(getSfoAttribute(sfo)).toBe(1);
  });

  test('getSfoAttribute returns 0 when ATTRIBUTE is absent', () => {
    const sfo = buildSfo([{ name: 'TITLE', value: 'Test', dataFmt: FMT.UTF8 }]);
    expect(getSfoAttribute(sfo)).toBe(0);
  });

  test('removeCopyProtection sets ATTRIBUTE to 0', () => {
    const sfo = buildSfo([
      { name: 'TITLE', value: 'Test', dataFmt: FMT.UTF8 },
      { name: 'ATTRIBUTE', value: '1', dataFmt: FMT.INT32 },
    ]);
    expect(getSfoAttribute(sfo)).toBe(1);

    const result = removeCopyProtection(sfo);
    expect(result).toBe(true);
    expect(getSfoAttribute(sfo)).toBe(0);
  });

  test('removeCopyProtection returns false when ATTRIBUTE is absent', () => {
    const sfo = buildSfo([{ name: 'TITLE', value: 'Test', dataFmt: FMT.UTF8 }]);
    const result = removeCopyProtection(sfo);
    expect(result).toBe(false);
  });

  test('removeCopyProtection is idempotent', () => {
    const sfo = buildSfo([{ name: 'ATTRIBUTE', value: '0', dataFmt: FMT.INT32 }]);
    removeCopyProtection(sfo);
    removeCopyProtection(sfo);
    expect(getSfoAttribute(sfo)).toBe(0);
  });
});

/* ========================================================================
 * Coverage: parseParamSfo edge cases, findParamDataOffset guards
 * ==================================================================== */

describe('parseParamSfo: edge cases', () => {
  test('throws on too-short buffer', () => {
    expect(() => parseParamSfo(new Uint8Array(10))).toThrow(/too short/);
  });

  test('throws on non-Uint8Array input', () => {
    expect(() => parseParamSfo(bad('not-a-buffer'))).toThrow(TypeError);
  });

  test('handles unknown data format (returns empty string)', () => {
    const sfo = new Uint8Array(0x100);
    sfo[0] = 0x00;
    sfo[1] = 0x50;
    sfo[2] = 0x53;
    sfo[3] = 0x46;
    const dv = new DataView(sfo.buffer);
    dv.setUint32(8, 0x40, true);
    dv.setUint32(12, 0x60, true);
    dv.setUint32(16, 1, true);
    dv.setUint16(20, 0x00, true);
    dv.setUint16(22, 0x9999, false); // unknown format
    dv.setUint32(24, 4, true);
    dv.setUint32(28, 4, true);
    dv.setUint32(32, 0, true);
    sfo[0x40] = 0x54;
    sfo[0x41] = 0x00;
    sfo[0x60] = 0x41;
    sfo[0x61] = 0x42;
    sfo[0x62] = 0x43;
    sfo[0x63] = 0x00;
    const parsed = parseParamSfo(sfo);
    expect(parsed.tables[0].value).toBe('');
  });
});

describe('findParamDataOffset guards', () => {
  test('getSfoAttribute throws on too-short buffer', () => {
    expect(() => getSfoAttribute(new Uint8Array(10))).toThrow(/too short/);
  });

  test('getSfoAccountId throws on non-Uint8Array', () => {
    expect(() => getSfoAccountId(bad(null))).toThrow(TypeError);
  });

  test('writeSfoAccountId throws on non-Uint8Array', () => {
    expect(() => writeSfoAccountId(bad(null), 'aabb')).toThrow(TypeError);
  });

  test('getSfoAttribute throws on non-Uint8Array', () => {
    expect(() => getSfoAttribute(bad('bad'))).toThrow(TypeError);
  });

  test('removeCopyProtection throws on non-Uint8Array', () => {
    expect(() => removeCopyProtection(bad(123))).toThrow(TypeError);
  });

  test('writeSfoAccountId throws on too-long hex', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: '00', dataFmt: FMT.UTF8_S }]);
    const longHex = 'ab'.repeat(17); // 34 chars > 32 max
    expect(() => writeSfoAccountId(sfo, longHex)).toThrow(/too long/);
  });

  test('writeSfoAccountId returns false when ACCOUNT_ID absent', () => {
    const sfo = buildSfo([{ name: 'TITLE', value: 'Test', dataFmt: FMT.UTF8 }]);
    expect(writeSfoAccountId(sfo, 'aabbccddeeff0011')).toBe(false);
  });

  test('getSfoAttribute with corrupt key offset (skips)', () => {
    // Build SFO with a corrupt keyOffset pointing past buffer
    const sfo = new Uint8Array(0x100);
    sfo[0] = 0x00;
    sfo[1] = 0x50;
    sfo[2] = 0x53;
    sfo[3] = 0x46;
    const dv = new DataView(sfo.buffer);
    dv.setUint32(8, 0x40, true);
    dv.setUint32(12, 0x60, true);
    dv.setUint32(16, 1, true);
    dv.setUint16(20, 0xffff, true); // corrupt keyOffset past buffer
    dv.setUint16(22, FMT.INT32, false);
    dv.setUint32(24, 4, true);
    dv.setUint32(28, 4, true);
    dv.setUint32(32, 0, true);
    // Should return 0 (not found) rather than throwing
    expect(getSfoAttribute(sfo)).toBe(0);
  });
});

/* ========================================================================
 * Coverage: corrupt table offsets, corrupt header, data offset past buffer
 * ==================================================================== */

describe('parseParamSfo: corrupt table offsets', () => {
  test('throws when keyTableStart points past buffer', () => {
    const sfo = new Uint8Array(0x100);
    sfo[0] = 0x00;
    sfo[1] = 0x50;
    sfo[2] = 0x53;
    sfo[3] = 0x46;
    const dv = new DataView(sfo.buffer);
    dv.setUint32(8, 0xffff, true); // keyTableStart past buffer
    dv.setUint32(12, 0x100, true); // dataTableStart ok
    dv.setUint32(16, 0, true); // 0 entries
    expect(() => parseParamSfo(sfo)).toThrow(/table offsets/);
  });

  test('throws when dataTableStart points past buffer', () => {
    const sfo = new Uint8Array(0x100);
    sfo[0] = 0x00;
    sfo[1] = 0x50;
    sfo[2] = 0x53;
    sfo[3] = 0x46;
    const dv = new DataView(sfo.buffer);
    dv.setUint32(8, 0x40, true); // keyTableStart ok
    dv.setUint32(12, 0xffff, true); // dataTableStart past buffer
    dv.setUint32(16, 0, true);
    expect(() => parseParamSfo(sfo)).toThrow(/table offsets/);
  });

  test('throws when tablesEntries is corrupt (too many)', () => {
    const sfo = new Uint8Array(0x100);
    sfo[0] = 0x00;
    sfo[1] = 0x50;
    sfo[2] = 0x53;
    sfo[3] = 0x46;
    const dv = new DataView(sfo.buffer);
    dv.setUint32(8, 0x40, true);
    dv.setUint32(12, 0x80, true);
    dv.setUint32(16, 0xffff, true); // impossibly many entries
    expect(() => parseParamSfo(sfo)).toThrow(/corrupt header/);
  });

  test('throws when dataLen > dataMaxLen', () => {
    const sfo = new Uint8Array(0x100);
    sfo[0] = 0x00;
    sfo[1] = 0x50;
    sfo[2] = 0x53;
    sfo[3] = 0x46;
    const dv = new DataView(sfo.buffer);
    dv.setUint32(8, 0x40, true);
    dv.setUint32(12, 0x60, true);
    dv.setUint32(16, 1, true);
    dv.setUint16(20, 0x00, true);
    dv.setUint16(22, FMT.UTF8, false);
    dv.setUint32(24, 100, true); // dataLen too big
    dv.setUint32(28, 10, true); // dataMaxLen too small
    dv.setUint32(32, 0, true);
    sfo[0x40] = 0x54;
    sfo[0x41] = 0x00; // key "T"
    expect(() => parseParamSfo(sfo)).toThrow(/dataLen.*dataMaxLen/);
  });

  test('throws when data offset points past buffer', () => {
    const sfo = new Uint8Array(0x100);
    sfo[0] = 0x00;
    sfo[1] = 0x50;
    sfo[2] = 0x53;
    sfo[3] = 0x46;
    const dv = new DataView(sfo.buffer);
    dv.setUint32(8, 0x40, true);
    dv.setUint32(12, 0x60, true);
    dv.setUint32(16, 1, true);
    dv.setUint16(20, 0x00, true);
    dv.setUint16(22, FMT.UTF8, false);
    dv.setUint32(24, 4, true);
    dv.setUint32(28, 4, true);
    dv.setUint32(32, 0x200, true); // dataOffset past buffer
    sfo[0x40] = 0x54;
    sfo[0x41] = 0x00;
    expect(() => parseParamSfo(sfo)).toThrow(/points past buffer/);
  });
});

describe('findParamDataOffset: corrupt offset guards', () => {
  test('throws when table offsets point past buffer', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: 'aabbccdd', dataFmt: FMT.UTF8_S }]);
    const dv = new DataView(sfo.buffer);
    // Corrupt keyTableStart to point past buffer end
    dv.setUint32(8, sfo.length + 100, true);
    expect(() => getSfoAttribute(sfo)).toThrow('table offsets point past buffer');
  });

  test('returns null when data offset for matched param points past buffer', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: 'aabbccdd', dataFmt: FMT.UTF8_S }]);
    const dv = new DataView(sfo.buffer);
    // Corrupt the dataOffset field (at index entry offset 20 + 12) to point
    // past the buffer, so dataStart = dataTableStart + dataOffset > length
    dv.setUint32(20 + 12, sfo.length, true);
    // findParamDataOffset returns null → getSfoAccountId returns ''
    expect(getSfoAccountId(sfo)).toBe('');
  });

  test('writeSfoAccountId throws when ACCOUNT_ID offset exceeds buffer', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: 'aabbccdd', dataFmt: FMT.UTF8_S }]);
    const dv = new DataView(sfo.buffer);
    const dataTableStart = dv.getUint32(12, true);
    const dataOffset = dv.getUint32(20 + 12, true);
    const accountIdOff = dataTableStart + dataOffset;
    // Truncate to just 8 bytes past the ACCOUNT_ID offset (need 16)
    const truncated = sfo.slice(0, accountIdOff + 8);
    expect(() => writeSfoAccountId(truncated, 'aabbccddeeff00112233445566778899')).toThrow(
      /exceeds buffer length/,
    );
  });
});

/* ========================================================================
 * Relocated from fixes.test.js — unique tests not covered elsewhere
 * ==================================================================== */

describe('writeSfoAccountId accepts exactly 32 chars', () => {
  test('accepts hex string of exactly 32 characters (16 bytes)', () => {
    const sfo = buildSfo([{ name: 'ACCOUNT_ID', value: 'xxxxxxxxxxxxxxxx', dataFmt: FMT.UTF8 }]);
    const hex32 = '31'.repeat(16); // 32 chars = 16 bytes
    expect(writeSfoAccountId(sfo, hex32)).toBe(true);
    expect(getSfoAccountId(sfo)).toBe(hex32);
  });
});
