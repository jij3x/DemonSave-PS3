/**
 * Shared test helpers for des-savefile tests.
 *
 * Provides synthetic save buffer builders (makeBlankSave, makeSfo,
 * makeSecondary), inventory/deposit record writers, and rawFiles map
 * builders used across editor.test.js, save-api.test.js, and
 * save-api-encrypted.test.js.
 */
import { wInt32BE, wUInt32BE, wUInt16BE } from '../../js/lib/ps3-save-lib/index.js';
import * as O from '../../js/des-savefile/offsets.js';

/** Minimum buffer size to cover all offsets (position table ~0x21B00) */
export const BUF_SIZE = 0x22000;

/**
 * Create a zeroed buffer with only SANITY_CHECK set (valid empty save).
 * @returns {Uint8Array}
 */
export function makeBlankSave() {
  const buf = new Uint8Array(new ArrayBuffer(BUF_SIZE));
  wInt32BE(buf, O.SANITY_CHECK, 1);
  return buf;
}

/**
 * Build a minimal PARAM.SFO for testing.
 * @param {number} [profileNumber]
 * @returns {Uint8Array}
 */
export function makeSfo(profileNumber = 42) {
  const sfo = new Uint8Array(0x600);
  sfo[0] = 0x00;
  sfo[1] = 0x50;
  sfo[2] = 0x53;
  sfo[3] = 0x46; // "\0PSF"
  sfo[0x570] = profileNumber;
  return sfo;
}

/** Build a secondary file (04USER.DAT) for testing. @returns {Uint8Array} */
export function makeSecondary() {
  return new Uint8Array(0x800);
}

/**
 * Write a single inventory record at a given slot index.
 * Layout relative to INV_TYPE_BASE + slot * INV_STRIDE:
 *   +0x00 type(4) +0x04 itemID(4) +0x08 count(4) +0x0c idx1(4)
 *   +0x10 misc1(2) +0x12 idx2(2) +0x14 misc2(4)
 * @param {Uint8Array} buf
 * @param {number} slot
 * @param {number} type
 * @param {number} itemID
 * @param {number} count
 * @param {number} idx1
 * @param {number} misc1
 * @param {number} idx2
 * @param {number} misc2
 */
export function writeInvRecord(buf, slot, type, itemID, count, idx1, misc1, idx2, misc2) {
  const b = O.INV_TYPE_BASE + slot * O.INV_STRIDE;
  wUInt32BE(buf, b + 0x00, type);
  wUInt32BE(buf, b + 0x04, itemID);
  wUInt32BE(buf, b + 0x08, count);
  wUInt32BE(buf, b + 0x0c, idx1);
  wUInt16BE(buf, b + 0x10, misc1);
  wUInt16BE(buf, b + 0x12, idx2);
  wUInt32BE(buf, b + 0x14, misc2);
}

/** Fill the deposit area with empty-slot pattern (type = 0xFF).
 * @param {Uint8Array} buf
 */
export function fillDepositEmpty(buf) {
  for (let i = 0; i < O.DEPOSIT_MAX_ENTRIES; i++) {
    const b = O.DEPOSIT_BASE + i * O.DEPOSIT_STRIDE;
    buf[b + 4] = 0xff;
  }
}

/**
 * Build a rawFiles map for a single slot (slot 1) — unencrypted.
 * Provides user.dat + 2user.dat but NOT 1user.dat so resolveSaveFiles
 * picks USER.DAT as the primary.
 * @param {Uint8Array} userBytes
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
export function makeUnencryptedSaveFiles(userBytes) {
  const files = new Map();
  files.set('param.sfo', { name: 'PARAM.SFO', bytes: makeSfo() });
  files.set('user.dat', { name: 'USER.DAT', bytes: userBytes });
  files.set('2user.dat', { name: '2USER.DAT', bytes: userBytes });
  files.set('04user.dat', { name: '04USER.DAT', bytes: makeSecondary() });
  return files;
}

/**
 * Build a rawFiles map for multiple slots — unencrypted.
 *
 * DeS uses a triple-naming convention where exactly ONE of three variants
 * is missing. The resolver picks the first existing variant as the primary
 * file. So we must create TWO variants and leave ONE missing:
 *   Slot 1: create user.dat + 2user.dat (missing 1user.dat → primary = USER.DAT)
 *   Slot N: create 0(N-1)user.dat + 20(N-1)user.dat (missing 10(N-1)user.dat → primary = 0(N-1)USER.DAT)
 * @param {number[]} slotNumbers
 * @param {(slot: number) => Uint8Array} [makeBuf]
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
export function makeMultiSlotFiles(slotNumbers, makeBuf) {
  const files = new Map();
  files.set('param.sfo', { name: 'PARAM.SFO', bytes: makeSfo() });
  files.set('04user.dat', { name: '04USER.DAT', bytes: makeSecondary() });

  for (const slot of slotNumbers) {
    const buf = makeBuf ? makeBuf(slot) : makeBlankSave();
    if (slot === 1) {
      files.set('user.dat', { name: 'USER.DAT', bytes: buf });
      files.set('2user.dat', { name: '2USER.DAT', bytes: new Uint8Array(buf) });
    } else {
      const s = slot - 1;
      files.set(`0${s}user.dat`, { name: `0${s}USER.DAT`, bytes: buf });
      files.set(`20${s}user.dat`, { name: `20${s}USER.DAT`, bytes: new Uint8Array(buf) });
    }
  }
  return files;
}
