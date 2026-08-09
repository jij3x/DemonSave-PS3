/**
 * Fuzzing regression guard for createPfdForFiles + the PFD hash chain.
 *
 * Jest half of the pfdcreate fuzzing story (Jazzer half:
 * fuzz/pfdcreate.fuzz.js). Both share fuzz/oracle.js. Inputs are built
 * in-memory so `npm test` stays deterministic.
 *
 * The oracle decodes a file list from the bytes, builds a PFD from scratch,
 * computes every hash, serializes, and re-parses — asserting the re-parsed
 * counts match and nothing throws a non-clean error.
 */
import { assertPfdCreateStable } from '../../fuzz/oracle.js';

/**
 * Encode a file list into the byte format decoded by `decodeFileList` in
 * fuzz/oracle.js (mirrors the encoder in tools/gen-fuzz-corpus.mjs).
 * @param {{name: string, size: number}[]} list
 * @returns {Uint8Array}
 */
function encodeFileList(list) {
  const parts = [Uint8Array.of(list.length & 0xff)];
  for (const f of list) {
    const nameBytes = Uint8Array.from(f.name, (c) => c.charCodeAt(0) & 0xff);
    parts.push(Uint8Array.of(nameBytes.length));
    parts.push(nameBytes);
    const sz = new Uint8Array(4);
    sz[0] = (f.size >>> 24) & 0xff;
    sz[1] = (f.size >>> 16) & 0xff;
    sz[2] = (f.size >>> 8) & 0xff;
    sz[3] = f.size & 0xff;
    parts.push(sz);
  }
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

describe('pfdcreate fuzz regression — create/hash/serialize/re-parse stable', () => {
  test('single file builds and round-trips', () => {
    expect(() =>
      assertPfdCreateStable(encodeFileList([{ name: 'USER.DAT', size: 0x40000 }])),
    ).not.toThrow();
  });

  test('real-save-shaped file list is stable', () => {
    expect(() =>
      assertPfdCreateStable(
        encodeFileList([
          { name: 'PARAM.SFO', size: 0x600 },
          { name: 'USER.DAT', size: 0x40000 },
          { name: '04USER.DAT', size: 0x800 },
        ]),
      ),
    ).not.toThrow();
  });

  test('garbage / truncated bytes are handled cleanly', () => {
    expect(() => assertPfdCreateStable(new Uint8Array(0))).not.toThrow();
    expect(() => assertPfdCreateStable(Uint8Array.of(0))).not.toThrow();
    expect(() => assertPfdCreateStable(Uint8Array.of(1))).not.toThrow();
  });
});
