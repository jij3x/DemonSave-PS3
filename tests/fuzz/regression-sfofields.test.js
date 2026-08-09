/**
 * Fuzzing regression guard for the PARAM.SFO field accessors + mutators.
 *
 * Jest half of the sfofields fuzzing story (Jazzer half:
 * fuzz/sfofields.fuzz.js). Both share fuzz/oracle.js. Inputs are built
 * in-memory so `npm test` stays deterministic.
 *
 * The oracle parses the SFO (when possible), runs every getter, and runs the
 * raw-byte mutators (getSfoAttribute/removeCopyProtection/getSfoAccountId/
 * writeSfoAccountId). This file additionally locks in createRichSfo correctness
 * and the expected getter return values.
 */
import { assertSfoFieldsClean } from '../../fuzz/oracle.js';
import {
  createMinimalSfo,
  createRealisticSfo,
  createRichSfo,
} from '../../test-fixtures/save-factory.js';
import {
  getAccountId,
  getDetail,
  getDirectoryName,
  getSfoAccountId,
  getSfoAttribute,
  getTitle,
  parseParamSfo,
  removeCopyProtection,
} from '../../js/lib/ps3-save-lib/index.js';

const ACCT = 'aabbccdd11223344aabbccdd11223344';

describe('sfofields fuzz regression — accessors + mutators', () => {
  test('the oracle passes for rich, realistic, minimal, and too-short SFOs', () => {
    expect(() => assertSfoFieldsClean(createRichSfo(42, ACCT))).not.toThrow();
    expect(() => assertSfoFieldsClean(createRealisticSfo(42, ACCT))).not.toThrow();
    expect(() => assertSfoFieldsClean(createMinimalSfo(42))).not.toThrow();
    expect(() => assertSfoFieldsClean(new Uint8Array(8))).not.toThrow();
  });

  test('createRichSfo produces the expected getter values', () => {
    const sfo = parseParamSfo(createRichSfo(42, ACCT));
    expect(getTitle(sfo)).toBe("Demon's Souls");
    expect(getDetail(sfo)).toBe('Save data');
    expect(getDirectoryName(sfo)).toBe('BLUS30443DEMONSS005');
    // ACCOUNT_ID decodes from raw bytes; getAccountId lowercases the parsed value.
    expect(typeof getAccountId(sfo)).toBe('string');
  });

  test('raw-byte mutators read/clear the ATTRIBUTE and ACCOUNT_ID fields', () => {
    const raw = createRichSfo(42, ACCT);
    expect(getSfoAttribute(raw)).toBe(1); // copy-protected
    expect(getSfoAccountId(raw)).toBe(ACCT);
    expect(removeCopyProtection(raw)).toBe(true);
    expect(getSfoAttribute(raw)).toBe(0); // cleared
  });

  // Regression: the sfofields fuzzer found a crafted SFO whose ATTRIBUTE field
  // data sits within 3 bytes of the buffer end. getSfoAttribute/removeCopyProtection
  // did a 4-byte getUint32/setUint32 there → RangeError (non-clean). The guard
  // added in param-sfo.js must turn that into a clean domain Error.
  const CRASH_INPUT = Buffer.from(
    'AFBTRgEBAAB0AAAAswAAAAYAAAAAAAQADQAAACAAAAAAAAAABgAEAAoAAAAgAAAAIAAAABAABAAJAAAAIAAAAEAAAAAXAAQAEwAAACAAAABgAAAAKgAEABAAAAAQAAAAgAAAADUABAQEAAAABAAAAJAAAABUSVRVAExfAQAAAAAAAAAAREVUQUlMAFNBVkVEQVRBX0RJUkVDVE9SWQBBQ0NPVU5UX0lEAEFUVFJJQlVURQBEZW2cb24ncyBTb3VscwAAAAAAAAAAAEkAAAAAAAAAACoqKioqKioqKioqKipuc3RydWN0b3IucHJvdG90eXBlAACTAAAAAAAAAAAAAABTYXZlIGRhdGEABQBjb25zdHJ1Y3RvcgAAAAAAAAAAAAAAAAAAAAAAAAAAQkwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
    'base64',
  );

  test('a truncated ATTRIBUTE field throws a clean domain Error, not RangeError', () => {
    // The oracle must treat it as clean (no throw escapes).
    expect(() => assertSfoFieldsClean(new Uint8Array(CRASH_INPUT))).not.toThrow();
    // And the raw mutator must throw a plain Error, not a RangeError.
    expect(() => getSfoAttribute(new Uint8Array(CRASH_INPUT))).toThrow(/ATTRIBUTE at offset/);
    expect(() => getSfoAttribute(new Uint8Array(CRASH_INPUT))).not.toThrow(RangeError);
  });
});
