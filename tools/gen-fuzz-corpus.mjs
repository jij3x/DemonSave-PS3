#!/usr/bin/env node
/**
 * tools/gen-fuzz-corpus.mjs
 *
 * Generates libFuzzer seed corpora for every fuzz target. libFuzzer seeds from
 * files in each corpus dir; mutating pure-random bytes would die at the first
 * magic/size check and find nothing, so each target seeds from a realistic,
 * cleanly-parsing input and lets coverage-guided mutation reach the deep logic.
 *
 * Output: fuzz/corpus/{readsave,pfd,sfo,roundtrip,pipeline,encexport,crypto,pfdcreate,pfdserialize,savefolder,sfofields}/
 *
 * Usage:
 *   node tools/gen-fuzz-corpus.mjs
 *
 * @ts-check
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  createPopulatedUserDat,
  createMinimalSfo,
  createRealisticSfo,
  createRichSfo,
} from '../test-fixtures/save-factory.js';
import {
  CHAR_TENDENCY,
  DEPOSIT_BASE,
  DEPOSIT_COUNT,
  DEPOSIT_STRIDE,
  INV_COUNT,
  INV_SLOTS,
  INV_TYPE_BASE,
  INV_STRIDE,
  MIN_SAVE_SIZE,
  POS_OFFSET_SELECTOR,
  POS_TABLE_BASE,
  SAGE_FREKE,
  THOMAS,
  THOMAS_DEAD,
  BOLDWIN,
  SPELL_COUNT,
} from '../js/des-savefile/offsets.js';
import {
  createPfdForFiles,
  cloneParamPfd,
  fromHex,
  getParamPfdCombinedData,
  wUInt32BE,
} from '../js/lib/ps3-save-lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORPUS_ROOT = path.resolve(__dirname, '..', 'fuzz', 'corpus');

/** DeS SecureFileID (hardcoded in save-api.js). */
const SECURE_ID = fromHex('0123456789ABCDEFFEDCBA9876543210');

/** IEEE-754 quiet NaN (big-endian) — guards the readSave() non-finite-float fix. */
const NAN_BE = [0x7f, 0xc0, 0x00, 0x00];

/**
 * Encode a PFD file list into the byte format decoded by
 * `decodeFileList` in fuzz/oracle.js: 1-byte count, then per record a 1-byte
 * name length, the ASCII name, and a 4-byte big-endian size.
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

/**
 * Write a big-endian unsigned 64-bit integer into a buffer at the given offset
 * (two 32-bit halves via DataView). Used to corrupt PFD header count fields
 * (magic/version/numReserved/numTotal/numUsed) for parse-rejection seeds.
 * @param {Uint8Array} buf
 * @param {number} off
 * @param {bigint} val
 */
function setU64BE(buf, off, val) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  dv.setUint32(off, Number((val >> 32n) & 0xffffffffn));
  dv.setUint32(off + 4, Number(val & 0xffffffffn));
}

/**
 * Write a little-endian unsigned 16/32-bit value (SFO header/index fields are
 * LE; only the data_fmt field is BE). Used to corrupt SFO index-entry fields
 * for parse/accessor edge seeds.
 * @param {Uint8Array} buf
 * @param {number} off
 * @param {number} val
 */
function setU16LE(buf, off, val) {
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setUint16(off, val, true);
}
/**
 * @param {Uint8Array} buf
 * @param {number} off
 * @param {number} val
 */
function setU32LE(buf, off, val) {
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setUint32(off, val, true);
}

/**
 * Wipe and recreate a named corpus subdir.
 * @param {string} name
 * @returns {string} absolute path to the rebuilt dir
 */
function resetDir(name) {
  const dir = path.join(CORPUS_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Write a seed buffer into a corpus dir.
 * @param {string} dir
 * @param {string} name
 * @param {Uint8Array} bytes
 */
function writeSeed(dir, name, bytes) {
  if (bytes.length === 0) throw new Error(`seed "${name}" is empty`);
  writeFileSync(path.join(dir, name), Buffer.from(bytes));
  console.log(`  ✓ ${name} (${bytes.length} bytes)`);
}

console.log('Generating fuzz corpora in fuzz/corpus/ ...');

// ---------------------------------------------------------------------------
// readSave() corpus — realistic USER.DAT + NaN regression seeds
// ---------------------------------------------------------------------------
{
  const dir = resetDir('readsave');
  console.log('  readsave/:');
  writeSeed(dir, 'slot1.dat', createPopulatedUserDat(1));
  writeSeed(dir, 'slot2.dat', createPopulatedUserDat(2));

  const emptyInv = createPopulatedUserDat(1);
  for (let i = 0; i < INV_STRIDE; i++) emptyInv[INV_TYPE_BASE + i] = 0xff;
  writeSeed(dir, 'empty-inv.dat', emptyInv);

  // Non-finite float regression seeds (guard the readSave NaN/Infinity fix).
  const nanRot = createPopulatedUserDat(1);
  nanRot.set(NAN_BE, POS_TABLE_BASE + 0x14); // rot
  writeSeed(dir, 'nan-rot.dat', nanRot);

  const nanTendency = createPopulatedUserDat(1);
  nanTendency.set(NAN_BE, CHAR_TENDENCY); // charTendency
  writeSeed(dir, 'nan-tendency.dat', nanTendency);

  // Branch-enrichment seeds (reader.js / bounds.js edges).
  // Truncated to exactly MIN_SAVE_SIZE — the position-table size boundary.
  writeSeed(dir, 'min-size.dat', createPopulatedUserDat(1).subarray(0, MIN_SAVE_SIZE));
  // All zeros — the sanity check at 0x170 fails, exercising the rejection branch.
  writeSeed(dir, 'zeroed.dat', new Uint8Array(MIN_SAVE_SIZE));

  // Phase-2 reader.js parse-edge seeds.
  // Tiny buffer (< MIN_SAVE_SIZE) → "Save buffer too small" guard.
  writeSeed(dir, 'tiny.dat', createPopulatedUserDat(1).subarray(0, 0x40));
  // invCount huge (> INV_SLOTS) → early corrupt-data detection.
  const hugeInv = createPopulatedUserDat(1);
  wUInt32BE(hugeInv, INV_COUNT, 0xffffffff);
  writeSeed(dir, 'huge-inv-count.dat', hugeInv);
  // spellCount huge (> 0x200) → early corrupt-data detection (other arm).
  const hugeSpell = createPopulatedUserDat(1);
  wUInt32BE(hugeSpell, SPELL_COUNT, 0x0000ffff);
  writeSeed(dir, 'huge-spell-count.dat', hugeSpell);
  // Bad position-offset selector → POS_TABLE_BASE + posOffset + 0x18 > length.
  const badPos = createPopulatedUserDat(1);
  wUInt32BE(badPos, POS_OFFSET_SELECTOR, 0xffff0000);
  writeSeed(dir, 'bad-pos-offset.dat', badPos);
  // Corrupt idx1 (≥ INV_SLOTS) on the first inventory item → idx1 guard throw.
  const badIdx1 = createPopulatedUserDat(1);
  wUInt32BE(badIdx1, INV_TYPE_BASE + 0x0c, INV_SLOTS + 1);
  writeSeed(dir, 'bad-idx1.dat', badIdx1);
  // Unknown inventory type nibble (0x30) on the first item → switch default throw.
  const unknownType = createPopulatedUserDat(1);
  wUInt32BE(unknownType, INV_TYPE_BASE, 0x30000000);
  writeSeed(dir, 'unknown-inv-type.dat', unknownType);
  // Deposit type-edge: DEPOSIT_COUNT=5 but only 4 real items — slot 4 gets an
  // invalid type (0x30) so the reader's deposit loop exercises the invalid-type
  // continue, then hits the 0xff empty-slot continue on slot 5+.
  const depositEdge = createPopulatedUserDat(1);
  wUInt32BE(depositEdge, DEPOSIT_COUNT, 5);
  depositEdge[DEPOSIT_BASE + 4 * DEPOSIT_STRIDE + 4] = 0x30;
  writeSeed(dir, 'deposit-type-edge.dat', depositEdge);
}

// ---------------------------------------------------------------------------
// parseParamPfd() corpus — realistic PFDs (1-entry and multi-entry)
// ---------------------------------------------------------------------------
{
  const dir = resetDir('pfd');
  console.log('  pfd/:');
  const pfd1 = createPfdForFiles([{ name: 'USER.DAT', size: 32 }], SECURE_ID);
  writeSeed(dir, 'one-entry.pfd', getParamPfdCombinedData(pfd1));

  const pfd3 = createPfdForFiles(
    [
      { name: 'PARAM.SFO', size: 0x600 },
      { name: 'USER.DAT', size: 0x40000 },
      { name: '04USER.DAT', size: 0x800 },
    ],
    SECURE_ID,
  );
  writeSeed(dir, 'three-entry.pfd', getParamPfdCombinedData(pfd3));

  // Branch-enrichment seeds (param-pfd.js parse edges).
  // Zero entries — exercises the empty-entry-table parse path.
  const pfd0 = createPfdForFiles([], SECURE_ID);
  writeSeed(dir, 'zero-entry.pfd', getParamPfdCombinedData(pfd0));
  // Eight entries — exercises hash-bucket collision chains during parse.
  const pfd8 = createPfdForFiles(
    ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08'].map((n) => ({
      name: n,
      size: 64,
    })),
    SECURE_ID,
  );
  writeSeed(dir, 'eight-entry.pfd', getParamPfdCombinedData(pfd8));

  // Corrupt-but-parseable seed: empty hash table (all bucket heads = end-of-
  // chain). parseParamPfd accepts it; validateParamPfdDetailed's validDHKCID2
  // then sees every bucket head ≥ numUsed → getBucketChainHash returns null
  // (bucket-chain-null path) and the no-valid-bucket-chain failure fires.
  const emptyHash = cloneParamPfd(pfd3);
  emptyHash.hashEntries = emptyHash.hashEntries.map(() => 0xffffffffffffffffn);
  writeSeed(dir, 'empty-hashtable.pfd', getParamPfdCombinedData(emptyHash));

  // Cyclic hash chain: every bucket points to entry 0, whose additionEntry
  // points back to itself → getBucketChainHash's cycle-detection guard fires
  // during validateParamPfdDetailed.
  const cyclic = cloneParamPfd(pfd3);
  cyclic.hashEntries = cyclic.hashEntries.map(() => 0n);
  cyclic.entries[0].additionEntry = 0n;
  writeSeed(dir, 'cyclic-chain.pfd', getParamPfdCombinedData(cyclic));

  // Parse-rejection seeds (param-pfd.js header/table bounds guards). All
  // derived from the realistic three-entry PFD buffer with one header field
  // corrupted, so each trips exactly one clean domain throw.
  const base = getParamPfdCombinedData(pfd3);
  // < 120 bytes → "PFD data too short".
  writeSeed(dir, 'tiny.pfd', base.subarray(0, 100));
  // Bad magic (offset 0) → "Invalid PFD File!".
  const badMagic = base.slice();
  setU64BE(badMagic, 0, 0n);
  writeSeed(dir, 'bad-magic.pfd', badMagic);
  // Unsupported version (offset 8) = 5 → "Unsupported PFD version!".
  const badVersion = base.slice();
  setU64BE(badVersion, 8, 5n);
  writeSeed(dir, 'bad-version.pfd', badVersion);
  // numReserved (offset 96) = 200000 → "unreasonably large or corrupt".
  const hugeReserved = base.slice();
  setU64BE(hugeReserved, 96, 200000n);
  writeSeed(dir, 'huge-reserved.pfd', hugeReserved);
  // numUsed (offset 112) = 200 > numReserved → "numUsed is corrupt".
  const usedGtReserved = base.slice();
  setU64BE(usedGtReserved, 112, 200n);
  writeSeed(dir, 'used-gt-reserved.pfd', usedGtReserved);
  // numTotal (offset 104) = 1 < numUsed → "numTotal < numUsed".
  const totalLtUsed = base.slice();
  setU64BE(totalLtUsed, 104, 1n);
  writeSeed(dir, 'total-lt-used.pfd', totalLtUsed);
  // numReserved = 5000 (≤ 100000 cap but 120 + 5000*8 > buffer) →
  // "hash table extends past buffer".
  const hashOverflow = base.slice();
  setU64BE(hashOverflow, 96, 5000n);
  writeSeed(dir, 'hashtable-overflow.pfd', hashOverflow);
  // Truncated mid-entry-table (past the 114 hash pointers at 0x408, before the
  // 3 entries) → "entry table extends past buffer".
  writeSeed(dir, 'truncated-pre-entries.pfd', base.subarray(0, 0x460));
  // Truncated mid-signature-table (past the entry table, before the 114×20
  // sig slots) → "signature table extends past buffer".
  writeSeed(dir, 'truncated-pre-sigtable.pfd', base.subarray(0, 0x800));

  // Phase-2 branch-enrichment seeds.
  // Trophy-file PFD: entries named TROPSYS/TROPUSR/TROPTRNS/TROPCONF so
  // getEntryHashKey's per-trophy-file static-key switch arms fire during
  // exercisePfdValidator. PARAM.SFO is included so the oracle's isTrophy=true
  // also drives generateHashKeyForSFO indices 1-3 (consoleID/discHashKey/authID).
  const trophyPfd = createPfdForFiles(
    [
      { name: 'PARAM.SFO', size: 0x600 },
      { name: 'TROPSYS.DAT', size: 64 },
      { name: 'TROPUSR.DAT', size: 64 },
      { name: 'TROPTRNS.DAT', size: 64 },
      { name: 'TROPCONF.SFM', size: 64 },
    ],
    SECURE_ID,
  );
  writeSeed(dir, 'trophy-files.pfd', getParamPfdCombinedData(trophyPfd));

  // Version-3 PFD: parseParamPfd accepts version 3 and takes the
  // realkey = hashKey.slice() branch (instead of the v4 HMAC derivation).
  const v3 = cloneParamPfd(pfd3);
  v3.version = 3n;
  writeSeed(dir, 'version-3.pfd', getParamPfdCombinedData(v3));
}

// ---------------------------------------------------------------------------
// parseParamSfo() corpus — realistic + minimal PARAM.SFO
// ---------------------------------------------------------------------------
{
  const dir = resetDir('sfo');
  console.log('  sfo/:');
  writeSeed(dir, 'realistic.sfo', createRealisticSfo(42, 'aabbccdd11223344aabbccdd11223344'));
  writeSeed(dir, 'minimal.sfo', createMinimalSfo(42));

  // Branch-enrichment seeds (param-sfo.js parse/validation edges).
  // Zero entries (entryCount at offset 16 cleared) — empty-table parse path.
  const zeroEntries = createRealisticSfo(42);
  zeroEntries[16] = 0;
  zeroEntries[17] = 0;
  zeroEntries[18] = 0;
  zeroEntries[19] = 0;
  writeSeed(dir, 'zero-entries.sfo', zeroEntries);
  // Corrupt keyTableStart (offset 8) past the buffer — offset-validation branch.
  const corruptOffsets = createRealisticSfo(42);
  corruptOffsets[8] = 0xff;
  corruptOffsets[9] = 0xff;
  corruptOffsets[10] = 0xff;
  corruptOffsets[11] = 0xff;
  writeSeed(dir, 'corrupt-offsets.sfo', corruptOffsets);

  // Branch-enrichment seeds (param-sfo.js parse + raw-accessor edges).
  // createRealisticSfo layout: header 20B; entry0 (ACCOUNT_ID) at 0x14, entry1
  // (ATTRIBUTE) at 0x24; keyTable 0x34; dataTable 0x49 (ACCT 0x49..0x58,
  // ATTRIBUTE 0x59..0x5c). entry0 fields: keyOff@20(LE16), fmt@22(BE16),
  // dataLen@24(LE32), dataMaxLen@28(LE32), dataOff@32(LE32).

  // < 20 bytes → parse + findParamDataOffset "too short" guards.
  writeSeed(dir, 'short.sfo', createRealisticSfo(42).subarray(0, 10));
  // Bad magic (bytes 0-3) → "Invalid Header Magic".
  const badMagicSfo = createRealisticSfo(42);
  badMagicSfo[0] = 0xff;
  writeSeed(dir, 'bad-magic.sfo', badMagicSfo);
  // tablesEntries (offset 16) huge → "corrupt header" (count > capacity).
  const hugeCount = createRealisticSfo(42);
  setU32LE(hugeCount, 16, 0x0000ffff);
  writeSeed(dir, 'huge-entry-count.sfo', hugeCount);
  // entry0 dataLen > dataMaxLen → consistency-check throw.
  const badDataLen = createRealisticSfo(42);
  setU32LE(badDataLen, 24, 999);
  writeSeed(dir, 'corrupt-datalen.sfo', badDataLen);
  // entry0 keyOffset huge → parse "key offset points past buffer" + accessor
  // findParamDataOffset skip-entry (ACCOUNT_ID not found, ATTRIBUTE still found).
  const badKeyOff = createRealisticSfo(42);
  setU16LE(badKeyOff, 20, 0xffff);
  writeSeed(dir, 'corrupt-keyoffset.sfo', badKeyOff);
  // entry0 dataFmt = UTF8 (0x0402) — parse UTF8 branch (default seeds only use
  // UTF8_S/INT32).
  const utf8Fmt = createRealisticSfo(42);
  new DataView(utf8Fmt.buffer).setUint16(22, 0x0402, false);
  writeSeed(dir, 'utf8-entry.sfo', utf8Fmt);
  // entry0 dataFmt = unknown (0x0999) — parse else-branch (value = '').
  const unknownFmt = createRealisticSfo(42);
  new DataView(unknownFmt.buffer).setUint16(22, 0x0999, false);
  writeSeed(dir, 'unknown-fmt-entry.sfo', unknownFmt);
  // Truncated so ACCOUNT_ID (0x49) + 16 > length → getSfoAccountId/writeSfoAccountId
  // bounds throws + findParamDataOffset ATTRIBUTE-data-out-of-range → null.
  writeSeed(dir, 'truncated-account-id.sfo', createRealisticSfo(42).subarray(0, 0x52));
  // Truncated so ATTRIBUTE (0x59) + 4 > length → getSfoAttribute/removeCopyProtection
  // bounds throws (ACCOUNT_ID still fits).
  writeSeed(dir, 'truncated-attribute.sfo', createRealisticSfo(42).subarray(0, 0x5a));
}

// ---------------------------------------------------------------------------
// round-trip corpus — realistic USER.DAT (readSave must accept these)
// ---------------------------------------------------------------------------
{
  const dir = resetDir('roundtrip');
  console.log('  roundtrip/:');
  // Only seeds readSave parses cleanly make useful round-trip starting points.
  writeSeed(dir, 'slot1.dat', createPopulatedUserDat(1));
  writeSeed(dir, 'slot2.dat', createPopulatedUserDat(2));

  // Branch-enrichment seeds (writer.js edges).
  // Large spell count — exercises the spell/deposit region-overlap handling.
  const largeSpell = createPopulatedUserDat(1);
  wUInt32BE(largeSpell, SPELL_COUNT, 0x1ff);
  writeSeed(dir, 'large-spell.dat', largeSpell);
  // Empty inventory (INV_COUNT=0) — exercises the empty-inventory write path.
  const emptyInventory = createPopulatedUserDat(1);
  wUInt32BE(emptyInventory, INV_COUNT, 0);
  writeSeed(dir, 'empty-inventory.dat', emptyInventory);
  // NPC flags flipped to the opposite of the slot1/2 defaults so the writer's
  // per-flag ternary arcs (sageFreke/thomas/boldwin friendly/hostile/dead) all
  // take their non-default side. Safe: NPC writes are idempotent bit masks, so
  // the round-trip stays stable (not a finding).
  const npcFlags = createPopulatedUserDat(1);
  // sageFreke: bit2=friendly, bit3=hostile, bit4=dead → hostile+dead, !friendly
  npcFlags[SAGE_FREKE] = 0x18;
  // thomas: bit6=friendly, bit7=hostile → hostile, !friendly
  npcFlags[THOMAS] = 0x80;
  // thomas dead: bit0
  npcFlags[THOMAS_DEAD] = 0x01;
  // boldwin: bit0=friendly, bit1=hostile, bit2=dead → friendly+dead, !hostile
  npcFlags[BOLDWIN] = 0x05;
  writeSeed(dir, 'npc-flags.dat', npcFlags);

  // Phase-2 writer.js collection-edge seeds.
  // Empty deposit (DEPOSIT_COUNT=0) → writer deposit loop is skipped entirely.
  const emptyDeposit = createPopulatedUserDat(1);
  wUInt32BE(emptyDeposit, DEPOSIT_COUNT, 0);
  writeSeed(dir, 'empty-deposit.dat', emptyDeposit);
  // Empty spells (SPELL_COUNT=0) → writer spell loop is skipped entirely.
  const emptySpells = createPopulatedUserDat(1);
  wUInt32BE(emptySpells, SPELL_COUNT, 0);
  writeSeed(dir, 'empty-spells.dat', emptySpells);
  // Both empty (plus empty inventory) → fully minimal model through round-trip.
  const emptyAll = createPopulatedUserDat(1);
  wUInt32BE(emptyAll, DEPOSIT_COUNT, 0);
  wUInt32BE(emptyAll, SPELL_COUNT, 0);
  wUInt32BE(emptyAll, INV_COUNT, 0);
  writeSeed(dir, 'empty-all.dat', emptyAll);
}

// ---------------------------------------------------------------------------
// openSave pipeline corpus — the primary USER.DAT (the target wraps it in a
// fixed valid folder at module init).
// ---------------------------------------------------------------------------
{
  const dir = resetDir('pipeline');
  console.log('  pipeline/:');
  if (createPopulatedUserDat(1).length < MIN_SAVE_SIZE) {
    throw new Error('pipeline seed smaller than MIN_SAVE_SIZE');
  }
  writeSeed(dir, 'slot1.dat', createPopulatedUserDat(1));
  writeSeed(dir, 'slot2.dat', createPopulatedUserDat(2));
}

// ---------------------------------------------------------------------------
// encexport corpus — the primary USER.DAT (the target wraps it in a fixed
// valid folder and runs the open → exportEncryptedSave → open → writeSaveData
// → open pipeline).
// ---------------------------------------------------------------------------
{
  const dir = resetDir('encexport');
  console.log('  encexport/:');
  writeSeed(dir, 'slot1.dat', createPopulatedUserDat(1));
  writeSeed(dir, 'slot2.dat', createPopulatedUserDat(2));
}

// ---------------------------------------------------------------------------
// crypto corpus — plaintext buffers of varied length (the target creates a
// fresh PFD per input and asserts encryptFile↔decryptFile round-trips).
// ---------------------------------------------------------------------------
{
  const dir = resetDir('crypto');
  console.log('  crypto/:');
  writeSeed(dir, 'aligned-256.dat', createPopulatedUserDat(1).subarray(0, 256));
  writeSeed(dir, 'full-0x40000.dat', createPopulatedUserDat(1));
  writeSeed(dir, 'small-32.dat', createPopulatedUserDat(1).subarray(0, 32));
  writeSeed(dir, 'unaligned-100.dat', createPopulatedUserDat(1).subarray(0, 100));
  writeSeed(dir, 'unaligned-1.dat', createPopulatedUserDat(1).subarray(0, 1));

  // Branch-enrichment seeds (ctr-like.js block-alignment edges).
  writeSeed(dir, 'block-16.dat', createPopulatedUserDat(1).subarray(0, 16)); // exactly 1 block
  writeSeed(dir, 'block-17.dat', createPopulatedUserDat(1).subarray(0, 17)); // 1 block + 1 byte
}

// ---------------------------------------------------------------------------
// pfdcreate corpus — encoded file-list specs (decoded by decodeFileList).
// Varied counts/names exercise createPfdForFiles' hash-collision chaining.
// ---------------------------------------------------------------------------
{
  const dir = resetDir('pfdcreate');
  console.log('  pfdcreate/:');
  writeSeed(dir, 'one-file.bin', encodeFileList([{ name: 'USER.DAT', size: 0x40000 }]));
  writeSeed(
    dir,
    'real-save.bin',
    encodeFileList([
      { name: 'PARAM.SFO', size: 0x600 },
      { name: 'USER.DAT', size: 0x40000 },
      { name: '04USER.DAT', size: 0x800 },
    ]),
  );
  writeSeed(
    dir,
    'many-files.bin',
    encodeFileList(
      ['AAA', 'AAB', 'ABA', 'BAA', 'AAC', 'ABC', 'FOO', 'BAR'].map((name) => ({
        name,
        size: 256,
      })),
    ),
  );
  // Fifteen files (the decode cap) — exercises creation at the max count.
  writeSeed(
    dir,
    'fifteen-files.bin',
    encodeFileList(
      Array.from({ length: 15 }, (_, i) => ({
        name: `F${i.toString().padStart(2, '0')}`,
        size: 32,
      })),
    ),
  );
}

// ---------------------------------------------------------------------------
// pfdserialize corpus — realistic PFDs (parse→clone→serialize→re-parse).
// ---------------------------------------------------------------------------
{
  const dir = resetDir('pfdserialize');
  console.log('  pfdserialize/:');
  const pfd1 = createPfdForFiles([{ name: 'USER.DAT', size: 32 }], SECURE_ID);
  writeSeed(dir, 'one-entry.pfd', getParamPfdCombinedData(pfd1));
  const pfd3 = createPfdForFiles(
    [
      { name: 'PARAM.SFO', size: 0x600 },
      { name: 'USER.DAT', size: 0x40000 },
      { name: '04USER.DAT', size: 0x800 },
    ],
    SECURE_ID,
  );
  writeSeed(dir, 'three-entry.pfd', getParamPfdCombinedData(pfd3));

  // Branch-enrichment seeds (serializer on empty / multi-entry structures).
  const pfd0 = createPfdForFiles([], SECURE_ID);
  writeSeed(dir, 'zero-entry.pfd', getParamPfdCombinedData(pfd0));
  const pfd8 = createPfdForFiles(
    ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08'].map((n) => ({
      name: n,
      size: 64,
    })),
    SECURE_ID,
  );
  writeSeed(dir, 'eight-entry.pfd', getParamPfdCombinedData(pfd8));
}

// ---------------------------------------------------------------------------
// savefolder corpus — plaintext re-encrypted into USER.DAT (the target builds a
// fixed encrypted folder and exercises the save-folder.js API + rebuildParamPfd).
// ---------------------------------------------------------------------------
{
  const dir = resetDir('savefolder');
  console.log('  savefolder/:');
  writeSeed(dir, 'slot1.dat', createPopulatedUserDat(1));
  writeSeed(dir, 'slot2.dat', createPopulatedUserDat(2));
  writeSeed(dir, 'zeros.dat', new Uint8Array(0x40000));
  writeSeed(dir, 'unaligned-100.dat', createPopulatedUserDat(1).subarray(0, 100));
}

// ---------------------------------------------------------------------------
// sfofields corpus — PARAM.SFO buffers exercising every field accessor/mutator.
// ---------------------------------------------------------------------------
{
  const dir = resetDir('sfofields');
  console.log('  sfofields/:');
  writeSeed(dir, 'rich.sfo', createRichSfo(42, 'aabbccdd11223344aabbccdd11223344'));
  writeSeed(dir, 'realistic.sfo', createRealisticSfo(42, 'aabbccdd11223344aabbccdd11223344'));
  writeSeed(dir, 'minimal.sfo', createMinimalSfo(42));

  // Truncated SFOs (≥ 20 bytes so the raw accessors run) that place
  // ACCOUNT_ID / ATTRIBUTE near the cut → the accessor 4/16-byte bounds guards
  // (getSfoAttribute / removeCopyProtection / getSfoAccountId / writeSfoAccountId)
  // and the findParamDataOffset data-out-of-range → null path.
  writeSeed(dir, 'truncated-account-id.sfo', createRealisticSfo(42).subarray(0, 0x52));
  writeSeed(dir, 'truncated-attribute.sfo', createRealisticSfo(42).subarray(0, 0x5a));
  // Corrupt keyTableStart (> buffer) → findParamDataOffset offset-validation throw.
  const corruptOffsets = createRealisticSfo(42);
  corruptOffsets[8] = 0xff;
  corruptOffsets[9] = 0xff;
  corruptOffsets[10] = 0xff;
  corruptOffsets[11] = 0xff;
  writeSeed(dir, 'corrupt-offsets.sfo', corruptOffsets);
  // Corrupt entry0 keyOffset (out of range) → findParamDataOffset skip-entry
  // (ACCOUNT_ID not found; ATTRIBUTE still found via entry1).
  const corruptKeyOff = createRealisticSfo(42);
  setU16LE(corruptKeyOff, 20, 0xffff);
  writeSeed(dir, 'corrupt-keyoffset.sfo', corruptKeyOff);
}

// ---------------------------------------------------------------------------
// saveapi corpus — folder-shape blueprint selectors (decoded by
// decodeFolderBlueprint in fuzz/oracle.js). Each 1-byte seed selects a distinct
// folder shape that exercises save-api.js orchestration branches unreachable by
// the fixed single-slot pipeline/encexport targets.
// ---------------------------------------------------------------------------
{
  const dir = resetDir('saveapi');
  console.log('  saveapi/:');
  // byte0: bits[0..2]=mode, bit6=inPlace, bit7=encrypted.
  writeSeed(dir, '1slot-unenc.bin', Uint8Array.of(0x00)); // mode 0
  writeSeed(dir, '2slot-unenc.bin', Uint8Array.of(0x01)); // mode 1
  writeSeed(dir, '4slot-unenc.bin', Uint8Array.of(0x02)); // mode 2
  writeSeed(dir, '2slot-enc.bin', Uint8Array.of(0x81)); // mode 1 + encrypted
  writeSeed(dir, '4slot-enc.bin', Uint8Array.of(0x82)); // mode 2 + encrypted
  writeSeed(dir, 'all3-rotation.bin', Uint8Array.of(0x03)); // mode 3
  writeSeed(dir, 'no-secondary.bin', Uint8Array.of(0x04)); // mode 4
  writeSeed(dir, 'failed-slot.bin', Uint8Array.of(0x05)); // mode 5 (unencrypted)
  writeSeed(dir, 'enc-failed-slot.bin', Uint8Array.of(0x85)); // mode 5 + encrypted
  writeSeed(dir, '2slot-assets.bin', Uint8Array.of(0x06)); // mode 6
  writeSeed(dir, '1slot-enc.bin', Uint8Array.of(0x80)); // mode 0 + encrypted
  writeSeed(dir, 'no-param-sfo.bin', Uint8Array.of(0x07)); // mode 7
  // inPlace shapes (bit6 set) — exercise in-place write/export branches.
  writeSeed(dir, '1slot-inplace.bin', Uint8Array.of(0x40)); // mode 0 + inPlace
  writeSeed(dir, '2slot-enc-inplace.bin', Uint8Array.of(0xc1)); // mode 1 + enc + inPlace
}

console.log('Done.');
