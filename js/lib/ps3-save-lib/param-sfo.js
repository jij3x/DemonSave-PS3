/**
 * PARAM.SFO metadata parser.
 *
 * Reads the SFO header (magic \0PSF, version, key/data table offsets,
 * index count), walks the index table, and exposes typed convenience
 * properties (TITLE, SUB_TITLE, SAVEDATA_DIRECTORY, etc.).
 *
 * This module is generic to all PS3 saves — it contains only SFO format-level
 * parsing and field access (ATTRIBUTE, ACCOUNT_ID).
 */

import { toHex, fromHex } from './util/hex.js';
import { decodeAscii } from './util/ascii.js';

/**
 * Cached TextDecoder for UTF-8.
 *
 * Avoids allocating a new TextDecoder instance on every readUtf8() call.
 * Initialized lazily on first use to support environments where TextDecoder
 * is not available at module load time.
 */
let _utf8Decoder = null;

/**
 * SFO data formats (data_fmt values in sfo_index_table_entry).
 * Stored big-endian on disk as u16.
 *
 *   0x0400  utf8-S   — utf8 Special Mode, NOT NULL terminated
 *                      (Game Saves, Trophies; e.g. PARAMS, ACCOUNT_ID)
 *   0x0402  utf8     — utf8 character string, NULL terminated (0x00)
 *   0x0404  int32    — integer 32 bits unsigned
 *
 * Reference: PS3 Developer wiki — PARAM.SFO §index_table → Data Types
 */
export const FMT = {
  UTF8_S: 0x400,
  UTF8: 0x402,
  INT32: 0x404,
};

/**
 * Parse a PARAM.SFO byte buffer into a structured object.
 *
 * @param {Uint8Array} data
 * @returns {{
 *   header: {magic: Uint8Array, version: Uint8Array, keyTableStart: number, dataTableStart: number, tablesEntries: number},
 *   tables: Array<{index:number, name:string, value:string, dataFmt:number, dataLen:number, dataMaxLen:number, keyOffset:number, dataOffset:number}>
 * }}
 */
export function parseParamSfo(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('parseParamSfo: data must be a Uint8Array');
  }
  // Validate minimum buffer size for the SFO header.
  if (data.length < 20) {
    throw new Error('SFO data too short (minimum 20 bytes for header)');
  }

  // Header magic must be 00 50 53 46 ("\0PSF")
  if (data[0] !== 0x00 || data[1] !== 0x50 || data[2] !== 0x53 || data[3] !== 0x46) {
    throw new Error('Invalid PARAM.SFO Header Magic');
  }

  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Header fields (all little-endian UInt32 on disk).
  const keyTableStart = dv.getUint32(8, true);
  const dataTableStart = dv.getUint32(12, true);
  const tablesEntries = dv.getUint32(16, true);

  // Validate table offsets don't point past the buffer.
  if (keyTableStart > data.length || dataTableStart > data.length) {
    throw new Error('Invalid PARAM.SFO: table offsets point past buffer');
  }

  // Validate tablesEntries against buffer size (each entry is 16 bytes at
  // offset 20).
  if (tablesEntries > (data.length - 20) / 16) {
    throw new Error('Invalid PARAM.SFO: corrupt header');
  }

  // Index table starts at offset 20 (0x14); each entry is 16 bytes:
  //   u16 param_key_offset      (LE)
  //   u16 param_data_fmt        (BE on disk → swap to native)
  //   u32 param_data_len        (LE)
  //   u32 param_data_max_len    (LE)
  //   u32 param_data_offset     (LE)
  const tables = [];
  let idxBase = 20;
  for (let i = 0; i < tablesEntries; i++) {
    const off = idxBase + i * 16;
    const keyOffset = dv.getUint16(off, true);
    // Data format field is stored big-endian on disk (network byte order),
    // even though the rest of the SFO header is little-endian. This is a
    // verified quirk of the PS3 PARAM.SFO format.
    const dataFmt = dv.getUint16(off + 2, false);
    const dataLen = dv.getUint32(off + 4, true);
    const dataMaxLen = dv.getUint32(off + 8, true);
    const dataOffset = dv.getUint32(off + 12, true);

    const nameOff = keyTableStart + keyOffset;
    // Validate the key offset before decoding: a corrupt keyOffset (u16) added
    // to keyTableStart can point past the buffer, which would otherwise reach
    // decodeAscii and throw a RangeError instead of a clean domain error.
    if (nameOff < 0 || nameOff >= data.length) {
      throw new Error(`Invalid PARAM.SFO: entry key offset ${nameOff} points past buffer`);
    }
    const name = decodeAscii(data, nameOff);

    // Validate dataLen ≤ dataMaxLen (consistency check on corrupt SFOs).
    if (dataLen > dataMaxLen) {
      throw new Error(
        `Invalid PARAM.SFO: entry "${name}" has dataLen ${dataLen} > dataMaxLen ${dataMaxLen}`,
      );
    }

    // Read value
    const valueOff = dataTableStart + dataOffset;
    // Validate valueOff before reading to prevent RangeError from
    // DataView.getUint32 and silent truncation by readUtf8.
    if (valueOff < 0 || valueOff + dataMaxLen > data.length) {
      throw new Error(
        `Invalid PARAM.SFO: entry "${name}" data offset ${valueOff} points past buffer`,
      );
    }
    let value;
    if (dataFmt === FMT.UTF8) {
      value = readUtf8(data, valueOff, dataMaxLen);
    } else if (dataFmt === FMT.UTF8_S) {
      value = readUtf8(data, valueOff, dataMaxLen);
    } else if (dataFmt === FMT.INT32) {
      // INT32 reads exactly 4 bytes. The valueOff check above only guarantees
      // `valueOff + dataMaxLen ≤ length`; a corrupt dataMaxLen < 4 would let
      // the 4-byte getUint32 read past the buffer (DataView RangeError), so
      // validate the 4-byte width explicitly.
      if (valueOff + 4 > data.length) {
        throw new Error(
          `Invalid PARAM.SFO: entry "${name}" INT32 value at ${valueOff} needs 4 bytes (buffer ${data.length})`,
        );
      }
      value = String(dv.getUint32(valueOff, true));
    } else {
      value = '';
    }

    tables.push({
      index: i,
      name,
      value,
      dataFmt,
      dataLen,
      dataMaxLen,
      keyOffset,
      dataOffset,
    });
  }

  return {
    header: {
      magic: data.slice(0, 4),
      version: data.slice(4, 8),
      keyTableStart,
      dataTableStart,
      tablesEntries,
    },
    tables,
  };
}

/**
 * Read a UTF-8 string from a byte buffer, stopping at the null terminator
 * or maxLen, whichever comes first.
 */
function readUtf8(data, off, maxLen) {
  const end = Math.min(off + maxLen, data.length);
  let len = 0;
  for (let i = off; i < end; i++) {
    if (data[i] === 0) break;
    len++;
  }
  // Use the cached decoder, initializing lazily on first use.
  if (!_utf8Decoder) {
    _utf8Decoder = new TextDecoder('utf-8');
  }
  return _utf8Decoder.decode(data.subarray(off, off + len));
}

/* ---- convenience accessors ---- */

/** @param {ReturnType<typeof parseParamSfo>} sfo @returns {string} */
export function getTitle(sfo) {
  return get(sfo, 'TITLE');
}
/** @param {ReturnType<typeof parseParamSfo>} sfo @returns {string} */
export function getSubTitle(sfo) {
  return get(sfo, 'SUB_TITLE');
}
/** @param {ReturnType<typeof parseParamSfo>} sfo @returns {string} */
export function getDetail(sfo) {
  return get(sfo, 'DETAIL');
}
/** @param {ReturnType<typeof parseParamSfo>} sfo @returns {string} */
export function getDirectoryName(sfo) {
  return get(sfo, 'SAVEDATA_DIRECTORY');
}
/** @param {ReturnType<typeof parseParamSfo>} sfo @returns {string} */
export function getTitleId(sfo) {
  const dir = getDirectoryName(sfo);
  if (!dir) return '';
  return dir.split('-')[0];
}
/** @param {ReturnType<typeof parseParamSfo>} sfo @returns {string} */
export function getAccountId(sfo) {
  return (get(sfo, 'ACCOUNT_ID') || '').toLowerCase();
}

function get(sfo, name) {
  if (!sfo || !sfo.tables) return '';
  for (const t of sfo.tables) {
    if (t.name === name) return t.value;
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* Copy-protection (ATTRIBUTE field)                                   */
/* ------------------------------------------------------------------ */

/**
 * Find the data offset of a named SFO parameter in raw bytes.
 *
 * @param {Uint8Array} rawSfo
 * @param {string} paramName  case-sensitive key name (e.g. "ATTRIBUTE")
 * @returns {number|null} absolute byte offset in rawSfo, or null if not found
 */
function findParamDataOffset(rawSfo, paramName) {
  // Guard against too-short buffers before reading header fields.
  if (rawSfo.length < 20) {
    throw new Error('SFO data too short (minimum 20 bytes for header)');
  }
  const dv = new DataView(rawSfo.buffer, rawSfo.byteOffset, rawSfo.byteLength);
  const keyTableStart = dv.getUint32(8, true);
  const dataTableStart = dv.getUint32(12, true);
  const tablesEntries = dv.getUint32(16, true);

  // Validate table offsets upfront.
  if (keyTableStart > rawSfo.length || dataTableStart > rawSfo.length) {
    throw new Error('Invalid PARAM.SFO: table offsets point past buffer');
  }

  // Guard against corrupt header causing out-of-bounds reads.
  const maxEntries = Math.max(0, Math.floor(Math.min(tablesEntries, (rawSfo.length - 20) / 16)));
  for (let i = 0; i < maxEntries; i++) {
    const off = 20 + i * 16;
    const keyOffset = dv.getUint16(off, true);
    const dataOffset = dv.getUint32(off + 12, true);

    // Validate nameOff before reading. A corrupt keyOffset could point
    // past the buffer, causing garbage reads.
    const nameOff = keyTableStart + keyOffset;
    if (nameOff < 0 || nameOff >= rawSfo.length) continue;

    const name = decodeAscii(rawSfo, nameOff);

    if (name === paramName) {
      const dataStart = dataTableStart + dataOffset;
      // Guard against corrupt offset pointing outside the buffer
      if (dataStart < 0 || dataStart >= rawSfo.length) {
        return null;
      }
      return dataStart;
    }
  }
  return null;
}

/**
 * Read the ATTRIBUTE value from raw PARAM.SFO bytes.
 *
 * This field controls copy-protection on real PS3 hardware.
 * Returns 0 if the field is absent (which means no copy-protection).
 *
 * @param {Uint8Array} rawSfo
 * @returns {number} the ATTRIBUTE UINT32 value (LE)
 */
export function getSfoAttribute(rawSfo) {
  if (!(rawSfo instanceof Uint8Array)) {
    throw new TypeError('getSfoAttribute: rawSfo must be a Uint8Array');
  }
  const off = findParamDataOffset(rawSfo, 'ATTRIBUTE');
  if (off === null) return 0;
  // Bounds-check the 4-byte read: findParamDataOffset only guarantees the
  // start byte is in range, so a field near the buffer end would otherwise
  // throw an opaque DataView RangeError on crafted/truncated SFOs.
  if (off + 4 > rawSfo.length) {
    throw new Error(
      `getSfoAttribute: ATTRIBUTE at offset ${off} exceeds buffer length ${rawSfo.length} (need ${off + 4} bytes)`,
    );
  }
  const dv = new DataView(rawSfo.buffer, rawSfo.byteOffset, rawSfo.byteLength);
  return dv.getUint32(off, true);
}

/**
 * Remove copy-protection by setting the ATTRIBUTE field to 0.
 *
 * PS3 saves with copy-protection have a non-zero ATTRIBUTE that prevents
 * copying via USB. Setting it to 0 clears the software lock.
 *
 * @param {Uint8Array} rawSfo  mutated in place
 * @returns {boolean} true if the ATTRIBUTE field was found and modified
 */
export function removeCopyProtection(rawSfo) {
  if (!(rawSfo instanceof Uint8Array)) {
    throw new TypeError('removeCopyProtection: rawSfo must be a Uint8Array');
  }
  const off = findParamDataOffset(rawSfo, 'ATTRIBUTE');
  if (off === null) return false;
  // Bounds-check the 4-byte write (see getSfoAttribute for rationale).
  if (off + 4 > rawSfo.length) {
    throw new Error(
      `removeCopyProtection: ATTRIBUTE at offset ${off} exceeds buffer length ${rawSfo.length} (need ${off + 4} bytes)`,
    );
  }
  const dv = new DataView(rawSfo.buffer, rawSfo.byteOffset, rawSfo.byteLength);
  dv.setUint32(off, 0, true);
  return true;
}

/* ------------------------------------------------------------------ */
/* ACCOUNT_ID (PSN account binding)                                    */
/* ------------------------------------------------------------------ */

/**
 * Read the ACCOUNT_ID from raw PARAM.SFO bytes as a hex string.
 *
 * ACCOUNT_ID is 16 raw bytes that identify the PSN account.
 * On RPCS3 saves this is typically all-zeros (ASCII "0000000000000000").
 * On real PS3 saves it's a unique 16-byte value.
 *
 * @param {Uint8Array} rawSfo
 * @returns {string} 32-character hex string, or empty string if ACCOUNT_ID
 *                   is absent
 */
export function getSfoAccountId(rawSfo) {
  if (!(rawSfo instanceof Uint8Array)) {
    throw new TypeError('getSfoAccountId: rawSfo must be a Uint8Array');
  }
  const off = findParamDataOffset(rawSfo, 'ACCOUNT_ID');
  if (off === null) return '';
  // Bounds-check the 16-byte read: subarray would silently clamp a truncated
  // field, returning a short (wrong) hex string instead of signaling corruption.
  if (off + 16 > rawSfo.length) {
    throw new Error(
      `getSfoAccountId: ACCOUNT_ID at offset ${off} exceeds buffer length ${rawSfo.length} (need ${off + 16} bytes)`,
    );
  }
  return toHex(rawSfo.subarray(off, off + 16));
}

/**
 * Write the ACCOUNT_ID into raw PARAM.SFO bytes from a hex string.
 *
 * The hex string is cleaned of non-hex characters, then validated to be
 * 16–32 chars (8–16 bytes). Short strings are right-padded with zeros to
 * 32 chars (16 bytes).
 *
 * @param {Uint8Array} rawSfo  mutated in place
 * @param {string} hexStr  hex string (16–32 chars after cleaning)
 * @returns {boolean} true if the ACCOUNT_ID field was found and written
 */
export function writeSfoAccountId(rawSfo, hexStr) {
  if (!(rawSfo instanceof Uint8Array)) {
    throw new TypeError('writeSfoAccountId: rawSfo must be a Uint8Array');
  }
  const off = findParamDataOffset(rawSfo, 'ACCOUNT_ID');
  if (off === null) return false;
  // Normalize: strip any non-hex characters.
  const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
  // Validate that the cleaned hex is at least 16 chars (8 bytes).
  // A severely short input would silently bind the save to the wrong PSN
  // account when zero-padded.
  if (clean.length < 16) {
    throw new Error(
      `writeSfoAccountId: hex string too short (${clean.length} chars after ` +
        `cleaning, need at least 16 = 8 bytes). Input: "${hexStr}"`,
    );
  }
  // Validate that the cleaned hex is at most 32 chars (16 bytes).
  // A longer input would silently lose trailing bytes when truncated,
  // binding the save to the wrong account.
  if (clean.length > 32) {
    throw new Error(
      `writeSfoAccountId: hex string too long (${clean.length} chars after ` +
        `cleaning, max 32 = 16 bytes). Input: "${hexStr}"`,
    );
  }
  // Pad to exactly 32 hex chars = 16 bytes.
  const padded = clean.padEnd(32, '0');
  const bytes = fromHex(padded);
  // Bounds-check: ensure 16 bytes are available at the offset to prevent
  // an opaque RangeError from Uint8Array.set() on crafted/truncated SFOs.
  if (off + 16 > rawSfo.length) {
    throw new Error(
      `writeSfoAccountId: ACCOUNT_ID at offset ${off} exceeds buffer length ${rawSfo.length} (need ${off + 16} bytes)`,
    );
  }
  rawSfo.set(bytes, off);
  return true;
}
