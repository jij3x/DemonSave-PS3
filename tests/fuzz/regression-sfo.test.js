/**
 * Fuzzing regression guard for parseParamSfo().
 *
 * Jest half of the SFO fuzzing story (Jazzer half: fuzz/sfo.fuzz.js). Both
 * share fuzz/oracle.js. Inputs are built in-memory so `npm test` stays
 * deterministic.
 *
 * Locks in two findings Jazzer surfaced:
 *   (1) a corrupt keyOffset (u16) could push nameOff past the buffer, reaching
 *       decodeAscii and throwing a RangeError instead of a clean domain error;
 *   (2) an INT32 entry with dataMaxLen < 4 could let the 4-byte DataView read
 *       run past the buffer (RangeError), since the value-offset check only
 *       guaranteed valueOff + dataMaxLen ≤ length.
 */
import { assertParseSfoClean } from '../../fuzz/oracle.js';
import { parseParamSfo } from '../../js/lib/ps3-save-lib/index.js';
import { createRealisticSfo } from '../../test-fixtures/save-factory.js';

describe('parseParamSfo() fuzz regression — clean-failure contract', () => {
  test('a realistic SFO parses into a well-formed object (oracle passes)', () => {
    const sfo = createRealisticSfo(42, 'aabbccdd11223344aabbccdd11223344');
    expect(() => assertParseSfoClean(sfo)).not.toThrow();
  });

  test('a keyOffset pointing past the buffer is rejected cleanly (no RangeError)', () => {
    const sfo = createRealisticSfo(42, 'aabbccdd11223344aabbccdd11223344');
    // Index entry 0's keyOffset is a u16 LE at 0x14. Set it to 0xFFFF so
    // nameOff = keyTableStart(0x34) + 0xFFFF lands far past the buffer.
    sfo[0x14] = 0xff;
    sfo[0x15] = 0xff;
    expect(() => parseParamSfo(sfo)).toThrow(/key offset.*past buffer/i);
    expect(() => parseParamSfo(sfo)).not.toThrow(/out of bounds/i);
    expect(() => assertParseSfoClean(sfo)).not.toThrow();
  });

  test('an INT32 value straddling the buffer end is rejected cleanly (no RangeError)', () => {
    // Hand-built minimal SFO: one INT32 entry whose 4-byte value would read
    // past the 0x29-byte buffer, while valueOff + dataMaxLen(2) stays in bounds.
    const len = 0x29;
    const buf = new Uint8Array(len);
    const dv = new DataView(buf.buffer);
    buf[0] = 0x00;
    buf[1] = 0x50;
    buf[2] = 0x53;
    buf[3] = 0x46; // "\0PSF"
    dv.setUint32(4, 0x00000101, true); // version
    dv.setUint32(8, 0x24, true); // keyTableStart
    dv.setUint32(12, 0x26, true); // dataTableStart
    dv.setUint32(16, 1, true); // tablesEntries
    // Index entry 0 at 0x14 (16 bytes): INT32, dataLen=2, dataMaxLen=2, dataOffset=0
    dv.setUint16(0x14, 0, true); // keyOffset
    dv.setUint16(0x16, 0x0404, false); // dataFmt INT32 (stored BE)
    dv.setUint32(0x18, 2, true); // dataLen
    dv.setUint32(0x1c, 2, true); // dataMaxLen
    dv.setUint32(0x20, 0, true); // dataOffset
    buf[0x24] = 0x58; // key "X"
    buf[0x25] = 0x00; // null terminator

    expect(() => parseParamSfo(buf)).toThrow(/needs 4 bytes/i);
    expect(() => parseParamSfo(buf)).not.toThrow(/DataView/i);
    expect(() => assertParseSfoClean(buf)).not.toThrow();
  });

  test('garbage / too-small input is rejected cleanly', () => {
    expect(() => assertParseSfoClean(new Uint8Array(8))).not.toThrow();
    expect(() => assertParseSfoClean(new Uint8Array(200))).not.toThrow();
  });
});
