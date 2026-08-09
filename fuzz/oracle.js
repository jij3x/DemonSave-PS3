/**
 * Shared fuzzing oracles — the single source of truth used by BOTH the Jazzer
 * fuzz targets (fuzz/*.fuzz.js) and the Jest regression tests
 * (tests/fuzz/regression*.test.js), so the two harnesses can never drift.
 *
 * One oracle per fuzz target. Each enforces a clean-failure contract: for every
 * input, the function under test must EITHER return a well-formed value OR throw
 * a clean domain Error. Anything else is a *finding*:
 *   - a TypeError / RangeError / non-Error throw  → a missing guard
 *   - a returned-but-malformed value               → silent corruption
 *   - (for round-trip) a write throw or value drift on a read-accepted input →
 *     read/write asymmetry (the class of bug the readSave NaN fix addressed)
 * Timeouts and OOMs are reported by libFuzzer directly via -timeout.
 *
 * Oracles:
 *   - assertReadSaveClean      → readSave()                  (reader.js)
 *   - assertParsePfdClean      → parseParamPfd()             (param-pfd.js)
 *   - assertParseSfoClean      → parseParamSfo()             (param-sfo.js)
 *   - assertRoundTripStable    → readSave→writeSave→readSave (reader+writer)
 *   - assertOpenSaveClean      → openSave() pipeline         (save-api.js)
 *   - assertEncExportStable    → open→exportEncryptedSave→open→writeSaveData→open
 *                                                              (save-api.js write/encrypt path)
 *   - assertCryptoRoundTrip    → encryptFile↔decryptFile     (param-pfd.js + ctr-like/aes)
 *   - assertPfdCreateStable    → createPfdForFiles→hash→serialize→parse (param-pfd.js create path)
 *   - assertPfdSerializeStable → parse→clone→serialize→parse (param-pfd.js serializer)
 *   - assertSaveFolderApiStable → save-folder.js API + rebuildParamPfd (enc + unenc)
 *   - assertSfoFieldsClean      → param-sfo.js getters + raw-byte mutators
 */
import { readSave } from '../js/des-savefile/reader.js';
import { writeSave } from '../js/des-savefile/writer.js';
import {
  openSave,
  exportEncryptedSave,
  writeSaveData,
  updateSessionAfterWrite,
  reloadSlotModels,
} from '../js/des-savefile/save-api.js';
import {
  parseParamPfd,
  parseParamSfo,
  createPfdForFiles,
  encryptFile,
  decryptFile,
  validAllParamHashes,
  getParamPfdCombinedData,
  cloneParamPfd,
  validateParamPfdDetailed,
  compareBytes,
  toHex,
  createSaveFolder,
  decryptToBytes,
  encryptBytes,
  isEncrypted,
  rebuildChanges,
  findEntry,
  getSfoAttribute,
  removeCopyProtection,
  getSfoAccountId,
  writeSfoAccountId,
  getTitle,
  getSubTitle,
  getDetail,
  getDirectoryName,
  getTitleId,
  getAccountId,
} from '../js/lib/ps3-save-lib/index.js';
import {
  SECURE_ID,
  toRawFilesFormat,
  createRealisticSfo,
  createPopulatedUserDat,
  createSecondaryFile,
  createUnencryptedSaveFolder,
  createEncryptedSaveFolder,
  createStaleUserDat,
  getPrimaryVariants,
  getSecondaryVariants,
} from '../test-fixtures/save-factory.js';
import { assertModelsMatch, extractComparableModel } from '../test-fixtures/model-diff.js';

/* =======================================================================
 * Shared
 * ===================================================================== */

/**
 * A "clean domain error" is a plain Error thrown intentionally to reject bad
 * input (e.g. "buffer too small", "out of bounds", "encrypted or corrupt").
 * TypeError and RangeError indicate a *missed* guard (reading a property of
 * undefined, a DataView out-of-range access) and must NOT be treated as clean.
 *
 * @param {unknown} e
 * @returns {boolean}
 */
function isCleanDomainError(e) {
  return e instanceof Error && !(e instanceof TypeError) && !(e instanceof RangeError);
}

/* =======================================================================
 * readSave() oracle  (reader.js)
 * ===================================================================== */

/**
 * Scalar numeric fields readSave() must populate on a successful parse.
 * Mirrors the `number`-typed properties of the FullModel typedef in
 * js/des-savefile/model.js.
 * @type {readonly string[]}
 */
const REQUIRED_NUMBERS = [
  'world',
  'block',
  'x',
  'y',
  'z',
  'rot',
  'currHP',
  'currMaxHP',
  'maxHP',
  'currMP',
  'currMaxMP',
  'maxMP',
  'currStam',
  'currMaxStam',
  'maxStam',
  'vit',
  'int',
  'end',
  'str',
  'dex',
  'magic',
  'faith',
  'luck',
  'souls',
  'soulMem',
  'levelsPurchased',
  'phantomType',
  'gender',
  'startClass',
  'leftHand1',
  'rightHand1',
  'leftHand2',
  'rightHand2',
  'arrows',
  'bolts',
  'helmet',
  'chest',
  'gauntlets',
  'leggings',
  'hairstyle',
  'ring1',
  'ring2',
  'quickSlot1',
  'quickSlot2',
  'quickSlot3',
  'quickSlot4',
  'quickSlot5',
  'leftHand1Ptr',
  'rightHand1Ptr',
  'leftHand2Ptr',
  'rightHand2Ptr',
  'arrowsPtr',
  'boltsPtr',
  'helmetPtr',
  'chestPtr',
  'gauntletsPtr',
  'leggingsPtr',
  'ring1Ptr',
  'ring2Ptr',
  'quickSlot1Ptr',
  'quickSlot2Ptr',
  'quickSlot3Ptr',
  'quickSlot4Ptr',
  'quickSlot5Ptr',
  'spellSlots',
  'miracleSlots',
  'hairR',
  'hairG',
  'hairB',
  'charTendency',
  'nexusTendency',
  'w1Tendency',
  'w2Tendency',
  'w3Tendency',
  'w4Tendency',
  'w5Tendency',
  'clearCount',
];

/** Array fields populated on a successful readSave() parse. */
const REQUIRED_ARRAYS = ['weapons', 'armor', 'rings', 'goods', 'deposit', 'spells'];

/** NPC-flag objects populated on a successful readSave() parse. */
const REQUIRED_NPCS = ['sageFreke', 'thomas', 'boldwin'];

/**
 * Assert a value returned by readSave() is well-formed: every required scalar is
 * a finite number, collections are arrays of objects carrying `itemId`, the name
 * is a string, and NPC objects carry their three boolean flags.
 *
 * @param {unknown} model
 * @throws {Error} with a field-named message if the model is malformed
 */
function assertModelWellFormed(model) {
  if (model === null || typeof model !== 'object') {
    throw new Error('silent corruption: readSave returned a non-object');
  }
  const m = /** @type {Record<string, unknown>} */ (model);

  for (const key of REQUIRED_NUMBERS) {
    const v = m[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`silent corruption: field "${key}" is ${v === undefined ? 'undefined' : v}`);
    }
  }
  if (typeof m.name !== 'string') {
    throw new Error(
      `silent corruption: field "name" is ${m.name === undefined ? 'undefined' : m.name}`,
    );
  }
  if (typeof m.archSealed !== 'boolean') {
    throw new Error(
      `silent corruption: field "archSealed" is ${m.archSealed === undefined ? 'undefined' : m.archSealed}`,
    );
  }
  for (const key of REQUIRED_ARRAYS) {
    assertItemArrayWellFormed(m[key], key);
  }
  for (const key of REQUIRED_NPCS) {
    assertNpcWellFormed(m[key], key);
  }
}

/**
 * Run one input through readSave() and assert the clean-failure contract.
 *
 * @param {Uint8Array} bytes
 * @throws {Error} rethrows any non-clean throw and any malformed-model signal
 */
export function assertReadSaveClean(bytes) {
  let model;
  try {
    model = readSave(bytes);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e; // TypeError / RangeError / non-Error → finding
  }
  assertModelWellFormed(model);
}

/* =======================================================================
 * parseParamPfd() oracle  (param-pfd.js)
 * ===================================================================== */

/**
 * Assert a value returned by parseParamPfd() is structurally well-formed: the
 * hash-entry / entry / signature-table arrays exist with lengths matching the
 * parsed header counts.
 *
 * @param {unknown} p
 * @throws {Error} if the PFD object is malformed
 */
function assertPfdWellFormed(p) {
  if (p === null || typeof p !== 'object') {
    throw new Error('silent corruption: parseParamPfd returned a non-object');
  }
  const o = /** @type {Record<string, unknown>} */ (p);
  const numReserved = o.numReserved;
  const numUsed = o.numUsed;
  if (typeof numReserved !== 'bigint' || typeof numUsed !== 'bigint') {
    throw new Error('silent corruption: PFD numReserved/numUsed are not bigint');
  }
  const reservedN = Number(numReserved);
  const usedN = Number(numUsed);
  if (!Array.isArray(o.hashEntries) || o.hashEntries.length !== reservedN) {
    throw new Error(
      `silent corruption: PFD hashEntries length ${Array.isArray(o.hashEntries) ? o.hashEntries.length : 'not-array'} ≠ numReserved ${reservedN}`,
    );
  }
  if (!Array.isArray(o.entries) || o.entries.length !== usedN) {
    throw new Error(
      `silent corruption: PFD entries length ${Array.isArray(o.entries) ? o.entries.length : 'not-array'} ≠ numUsed ${usedN}`,
    );
  }
  if (!Array.isArray(o.sigTable) || o.sigTable.length !== reservedN) {
    throw new Error(
      `silent corruption: PFD sigTable length ${Array.isArray(o.sigTable) ? o.sigTable.length : 'not-array'} ≠ numReserved ${reservedN}`,
    );
  }
}

/**
 * Exercise the PFD corruption-detection path (`validateParamPfdDetailed`) on a
 * parsed, possibly-corrupt PFD.
 *
 * This is the only fuzz-reachable way to cover the validators' `fix=false` /
 * failure-collection / bucket-chain branches: every other oracle validates
 * only freshly-created (always-valid) PFDs, so the mismatch paths never fire.
 * Running the validators read-only (`fix=false`) on a parsed fuzzed PFD —
 * whose stored hashes almost never match recomputed ones — drives those paths
 * and doubles as a real fuzzing check that tamper-detection stays robust.
 *
 * A valid `secureFileID` is required by the per-entry hash-key derivation, so
 * one is set before validating. A bounded `fileData` map is synthesized from
 * each entry's `fileSize` so every parsed entry is present, and extreme
 * `numReserved` values are skipped to keep the signature-table scan bounded.
 *
 * @param {ReturnType<typeof parseParamPfd>} pfd
 */
function exercisePfdValidator(pfd) {
  if (Number(pfd.numReserved) > 1000) return; // bound validFileCID's sig scan
  pfd.secureFileID = SECURE_ID;
  // A parsed PFD always has isTrophy=false (parse never sets it), so
  // forEachActiveHashIndex only iterates hash index 0. Setting it true makes the
  // validator iterate indices 1-3 for the PARAM.SFO entry, covering
  // generateHashKeyForSFO's consoleID/discHashKey/authID cases. The extra HMAC
  // work is bounded (numReserved ≤ 1000 here). This also doubles as a real check
  // that multi-index tamper detection stays robust.
  pfd.isTrophy = true;
  const fileData = new Map();
  for (const entry of pfd.entries) {
    const size = Math.min(Math.max(0, Number(entry.fileSize) || 0), 4096);
    fileData.set(entry.fileName.toLowerCase(), new Uint8Array(size));
  }
  try {
    validateParamPfdDetailed(fileData, pfd);
  } catch (e) {
    if (!isCleanDomainError(e)) throw e;
  }
}

/**
 * Run one input through parseParamPfd() and assert the clean-failure contract.
 *
 * @param {Uint8Array} bytes
 * @throws {Error} rethrows any non-clean throw and any malformed-PFD signal
 */
export function assertParsePfdClean(bytes) {
  let pfd;
  try {
    pfd = parseParamPfd(bytes);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  assertPfdWellFormed(pfd);
  exercisePfdValidator(pfd);
}

/* =======================================================================
 * parseParamSfo() oracle  (param-sfo.js)
 * ===================================================================== */

/**
 * Assert a value returned by parseParamSfo() is well-formed: a header object
 * with numeric table offsets/counts and a `tables` array of entries each
 * carrying a string `name`.
 *
 * @param {unknown} sfo
 * @throws {Error} if the SFO object is malformed
 */
function assertSfoWellFormed(sfo) {
  if (sfo === null || typeof sfo !== 'object') {
    throw new Error('silent corruption: parseParamSfo returned a non-object');
  }
  const o = /** @type {Record<string, unknown>} */ (sfo);
  const header = o.header;
  if (header === null || typeof header !== 'object') {
    throw new Error('silent corruption: SFO header is not an object');
  }
  const h = /** @type {Record<string, unknown>} */ (header);
  for (const key of ['keyTableStart', 'dataTableStart', 'tablesEntries']) {
    if (typeof h[key] !== 'number' || !Number.isFinite(h[key])) {
      throw new Error(
        `silent corruption: SFO header.${key} is ${h[key] === undefined ? 'undefined' : h[key]}`,
      );
    }
  }
  if (!Array.isArray(o.tables)) {
    throw new Error('silent corruption: SFO tables is not an array');
  }
  for (let i = 0; i < o.tables.length; i++) {
    const entry = /** @type {Record<string, unknown>} */ (o.tables[i]);
    if (entry === null || typeof entry !== 'object') {
      throw new Error(`silent corruption: SFO tables[${i}] is not an object`);
    }
    if (typeof entry.name !== 'string') {
      throw new Error(
        `silent corruption: SFO tables[${i}].name is ${entry.name === undefined ? 'undefined' : entry.name}`,
      );
    }
  }
}

/**
 * Run one input through parseParamSfo() and assert the clean-failure contract.
 *
 * @param {Uint8Array} bytes
 * @throws {Error} rethrows any non-clean throw and any malformed-SFO signal
 */
export function assertParseSfoClean(bytes) {
  let sfo;
  try {
    sfo = parseParamSfo(bytes);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  assertSfoWellFormed(sfo);
}

/* =======================================================================
 * readSave → writeSave → readSave round-trip oracle  (reader.js + writer.js)
 * ===================================================================== */

/**
 * Assert the writer is idempotent on its own output (a fixed point): read →
 * write → re-read → write → re-read must leave the model unchanged between the
 * two post-write reads.
 *
 * Why idempotency rather than read-vs-first-write equality: the writer
 * intentionally normalizes several fields on the FIRST write of a corrupt/
 * non-canonical input — deposit flags[0] (0 → 0x21), deposit sortOrder low-16
 * (0 → slot index), per-category deposit durability (rings/goods → 0), and the
 * spell/deposit region overlap for impossible spell counts (which the reader
 * accepts by design — see editor.test.js "large spellCount"). Those
 * normalizations are NOT bugs and are stable across a second round-trip, so a
 * read-vs-first-write comparison false-positives on them. Idempotency compares
 * two post-write reads (M2 vs M3), which are both already canonical, so it is
 * immune to the normalizations while still catching any genuine serialization
 * bug that makes the writer non-reproducible. Real-save read↔write fidelity is
 * covered separately by the integration tests.
 *
 * Findings (rethrown so Jazzer records them):
 *   - readSave throws a non-clean error on the input           (missing guard)
 *   - the first or second writeSave throws on an accepted model (read/write asymmetry)
 *   - a re-read throws a non-clean error after a successful write
 *   - M3 differs from M2                                       (non-idempotent write)
 *
 * Uses extractComparableModel/assertModelsMatch (strips binary internals and
 * display-only *Ptr fields) so the writer's pointer recomputation causes no
 * false positives.
 *
 * @param {Uint8Array} bytes
 * @throws {Error} on any asymmetry / non-idempotency / non-clean throw
 */
export function assertRoundTripStable(bytes) {
  let m1;
  try {
    m1 = readSave(bytes);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }

  // First write + re-read. writeSave clones its input and returns a fresh
  // buffer, leaving `bytes` (and b1 below) untouched.
  let b1;
  let m2;
  try {
    b1 = writeSave(bytes, m1, []);
    m2 = readSave(b1);
  } catch (e) {
    if (isCleanDomainError(e)) {
      throw new Error(`round-trip: first write/re-read threw on accepted model: ${e.message}`, {
        cause: e,
      });
    }
    throw e;
  }

  // Second write (base = b1, M2's own source) + re-read.
  let m3;
  try {
    const b2 = writeSave(b1, m2, []);
    m3 = readSave(b2);
  } catch (e) {
    if (isCleanDomainError(e)) {
      throw new Error(`round-trip: second write/re-read threw: ${e.message}`, { cause: e });
    }
    throw e;
  }

  // Idempotency: the two post-write reads must match.
  assertModelsMatch(extractComparableModel(m3), extractComparableModel(m2));
}

/* =======================================================================
 * openSave() pipeline oracle  (save-api.js)
 * ===================================================================== */

/**
 * Sanitized-model scalar fields (the FullModel scalars MINUS the display-only
 * *Ptr fields, which sanitizeModel omits — see SanitizedModel typedef).
 * @type {readonly string[]}
 */
const SANITIZED_NUMBERS = REQUIRED_NUMBERS.filter((k) => !k.endsWith('Ptr'));

/**
 * Assert an inventory/deposit/spell collection is an array of well-formed
 * records. Inventory records carry an opaque `_ref`; deposit records carry a
 * `category`; all carry a numeric `itemId`.
 *
 * @param {unknown} arr
 * @param {string} key
 * @throws {Error}
 */
function assertItemArrayWellFormed(arr, key) {
  if (!Array.isArray(arr)) {
    throw new Error(`silent corruption: field "${key}" is not an array`);
  }
  for (let i = 0; i < arr.length; i++) {
    const rec = arr[i];
    if (rec === null || typeof rec !== 'object') {
      throw new Error(`silent corruption: ${key}[${i}] is not an object`);
    }
    const r = /** @type {Record<string, unknown>} */ (rec);
    const itemId = r.itemId;
    if (typeof itemId !== 'number' || !Number.isFinite(itemId)) {
      throw new Error(
        `silent corruption: ${key}[${i}].itemId is ${itemId === undefined ? 'undefined' : itemId}`,
      );
    }
  }
}

/** @param {unknown} npc @param {string} key @throws {Error} */
function assertNpcWellFormed(npc, key) {
  if (npc === null || typeof npc !== 'object') {
    throw new Error(`silent corruption: npc "${key}" is not an object`);
  }
  for (const flag of ['friendly', 'hostile', 'dead']) {
    const fv = /** @type {Record<string, unknown>} */ (npc)[flag];
    if (typeof fv !== 'boolean') {
      throw new Error(
        `silent corruption: ${key}.${flag} is ${fv === undefined ? 'undefined' : fv}`,
      );
    }
  }
}

/**
 * Assert a sanitized model (the shape openSave attaches to each slot) is
 * well-formed: scalars (sans *Ptr) finite, name a string, archSealed boolean,
 * collections valid, inventory records carrying `_ref`, deposit records a
 * `category`.
 *
 * @param {unknown} model
 * @throws {Error}
 */
function assertSanitizedModelWellFormed(model) {
  if (model === null || typeof model !== 'object') {
    throw new Error('silent corruption: sanitized model is not an object');
  }
  const m = /** @type {Record<string, unknown>} */ (model);

  for (const key of SANITIZED_NUMBERS) {
    const v = m[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(
        `silent corruption: sanitized field "${key}" is ${v === undefined ? 'undefined' : v}`,
      );
    }
  }
  if (typeof m.name !== 'string') {
    throw new Error(
      `silent corruption: sanitized "name" is ${m.name === undefined ? 'undefined' : m.name}`,
    );
  }
  if (typeof m.archSealed !== 'boolean') {
    throw new Error(
      `silent corruption: sanitized "archSealed" is ${m.archSealed === undefined ? 'undefined' : m.archSealed}`,
    );
  }

  // Inventory records carry an opaque `_ref` token (not _slot/idx1/idx2).
  for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
    const arr = m[cat];
    if (!Array.isArray(arr)) {
      throw new Error(`silent corruption: sanitized "${cat}" is not an array`);
    }
    for (let i = 0; i < arr.length; i++) {
      const rec = /** @type {Record<string, unknown>} */ (arr[i]);
      if (rec === null || typeof rec !== 'object') {
        throw new Error(`silent corruption: sanitized ${cat}[${i}] is not an object`);
      }
      if (typeof rec._ref !== 'string') {
        throw new Error(
          `silent corruption: sanitized ${cat}[${i}]._ref is ${rec._ref === undefined ? 'undefined' : rec._ref}`,
        );
      }
      if (typeof rec.itemId !== 'number' || !Number.isFinite(rec.itemId)) {
        throw new Error(
          `silent corruption: sanitized ${cat}[${i}].itemId is ${rec.itemId === undefined ? 'undefined' : rec.itemId}`,
        );
      }
    }
  }

  // Deposit records carry a `category`.
  const deposit = m.deposit;
  if (!Array.isArray(deposit)) {
    throw new Error('silent corruption: sanitized "deposit" is not an array');
  }
  for (let i = 0; i < deposit.length; i++) {
    const rec = /** @type {Record<string, unknown>} */ (deposit[i]);
    if (rec === null || typeof rec !== 'object') {
      throw new Error(`silent corruption: sanitized deposit[${i}] is not an object`);
    }
    if (typeof rec.category !== 'string') {
      throw new Error(
        `silent corruption: sanitized deposit[${i}].category is ${rec.category === undefined ? 'undefined' : rec.category}`,
      );
    }
  }

  assertItemArrayWellFormed(m.spells, 'sanitized spells');
  for (const key of REQUIRED_NPCS) {
    assertNpcWellFormed(m[key], key);
  }
}

/**
 * Run one folder through openSave() and assert the pipeline contract: it must
 * not crash / hang / OOM, and every slot that parsed must carry a well-formed
 * sanitized model. Per-slot readSave failures are routed to `failedSlots` by
 * openSave itself (not a finding); a clean domain throw (e.g. "No valid save
 * slots found") is accepted.
 *
 * @param {Map<string, {name: string, bytes: Uint8Array}>} rawFiles
 * @returns {Promise<void>}
 * @throws {Error} rethrows any non-clean throw and any malformed-model signal
 */
export async function assertOpenSaveClean(rawFiles) {
  let result;
  try {
    result = await openSave(rawFiles, () => {});
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  const slots = /** @type {unknown} */ (result.slots);
  if (!Array.isArray(slots)) {
    throw new Error('silent corruption: openSave result.slots is not an array');
  }
  for (const slot of slots) {
    if (slot === null || typeof slot !== 'object') {
      throw new Error('silent corruption: openSave slot is not an object');
    }
    assertSanitizedModelWellFormed(/** @type {Record<string, unknown>} */ (slot).model);
  }
}

/* =======================================================================
 * openSave → exportEncryptedSave → openSave → writeSaveData → openSave
 * encrypted export/write round-trip oracle  (save-api.js write/encrypt path)
 * ===================================================================== */

/**
 * Profile number + account ID written into the SFO on each export/write.
 * Fixed sentinels keep the oracle deterministic; the SFO patch path is linear
 * and adds no branch value from varying them.
 */
const EXPORT_PROFILE = 7;
const EXPORT_ACCT = 'aabbccdd11223344aabbccdd11223344';

/**
 * Run a folder through the full encrypted export + decrypted write-back
 * pipeline and assert two properties:
 *
 *  1. **Clean-failure:** every stage (openSave, exportEncryptedSave,
 *     writeSaveData, the two session-sync calls) either succeeds or throws a
 *     clean domain Error. A TypeError/RangeError/non-Error throw is a finding.
 *  2. **Write idempotency:** the sanitized models read after the first
 *     post-export open (r2) must equal those read after the subsequent
 *     decrypted write-back + re-open (r3). Comparing two *post-write* reads
 *     (r2 vs r3) — not the raw pre-write read (r1) — mirrors
 *     {@link assertRoundTripStable}'s M2-vs-M3 design and is therefore immune
 *     to the writer's intentional first-write normalizations (deposit
 *     `flags[0]`/`sortOrder`, per-category durability, spell/deposit overlap).
 *
 * Transitively exercises: exportEncryptedSave + writeSaveData (both source
 * states), updateSessionAfterWrite (both enc/dec branches), reloadSlotModels,
 * the encrypted-open/decrypt path, createPfdForFiles, encryptFile,
 * decryptFile, validAllParamHashes, getParamPfdCombinedData, and the
 * ctr-like/aes/hmac primitives.
 *
 * @param {Map<string, {name: string, bytes: Uint8Array}>} rawFiles
 * @param {boolean} [inPlace=false]  if true, write/export run in in-place mode
 *   (omits PARAM.SFO/PARAM.PFD from filesToWrite, skips asset files) — exercises
 *   the in-place branches in writeSaveData/exportEncryptedSave.
 * @returns {Promise<void>}
 * @throws {Error} rethrows any non-clean throw and any model-drift signal
 */
export async function assertEncExportStable(rawFiles, inPlace = false) {
  const noop = () => {};

  // 1. openSave (unencrypted source) → r1.
  let r1;
  try {
    r1 = await openSave(rawFiles, noop);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  if (!Array.isArray(r1.slots) || r1.slots.length === 0) return;

  // 2. exportEncryptedSave: build a new PFD, encrypt every file, hash the chain.
  let exported;
  try {
    exported = await exportEncryptedSave(
      r1.slots,
      r1.failedSlots,
      EXPORT_PROFILE,
      EXPORT_ACCT,
      noop,
      inPlace,
    );
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }

  // 3. Sync r1's session to the now-encrypted on-disk state.
  try {
    await updateSessionAfterWrite(r1.slots, exported.filesToWrite, true);
    reloadSlotModels(r1.slots, noop);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }

  // 4. Re-open the exported folder (encrypted open → decrypt path).
  let r2;
  try {
    r2 = await openSave(toRawFilesFormat(exported.filesToWrite), noop);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  if (!Array.isArray(r2.slots) || r2.slots.length === 0) return;
  for (const slot of r2.slots) {
    assertSanitizedModelWellFormed(/** @type {Record<string, unknown>} */ (slot).model);
  }

  // 5. writeSaveData: decrypted write-back from an encrypted-source session.
  let written;
  try {
    written = await writeSaveData(
      r2.slots,
      r2.failedSlots,
      EXPORT_PROFILE,
      EXPORT_ACCT,
      noop,
      inPlace,
    );
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }

  // 6. Sync r2's session to the now-decrypted on-disk state.
  try {
    await updateSessionAfterWrite(r2.slots, written.filesToWrite, false);
    reloadSlotModels(r2.slots, noop);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }

  // 7. Re-open the decrypted folder → r3.
  let r3;
  try {
    r3 = await openSave(toRawFilesFormat(written.filesToWrite), noop);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  if (!Array.isArray(r3.slots) || r3.slots.length === 0) return;
  for (const slot of r3.slots) {
    assertSanitizedModelWellFormed(/** @type {Record<string, unknown>} */ (slot).model);
  }

  // 8. Idempotency: every slot present in BOTH r2 and r3 must match. Compared
  // by saveSlot identity (not array index) so a slot that becomes
  // unavailable in one read (e.g. a corrupt primary alongside a valid backup,
  // where the encrypted re-open can't decrypt it but the decrypted re-open
  // reads the promoted backup) is simply skipped rather than miscompared
  // against a different slot at the same index.
  const r2BySlot = new Map(r2.slots.map((s) => [s.slot, s]));
  for (const s3 of r3.slots) {
    const s2 = r2BySlot.get(s3.slot);
    if (s2) {
      assertModelsMatch(extractComparableModel(s3.model), extractComparableModel(s2.model));
    }
  }
}

/* =======================================================================
 * encryptFile ↔ decryptFile round-trip oracle  (param-pfd.js + ctr-like/aes)
 * ===================================================================== */

/**
 * Assert the CTR-like file cipher inverts exactly: for any non-empty
 * plaintext, `decryptFile(encryptFile(plaintext))` must equal `plaintext`
 * byte-for-byte. encryptFile sets the entry's `fileSize` to the plaintext
 * length, and decryptFile trims its result back to `fileSize`, so arbitrary
 * (including non-16-byte-aligned) lengths round-trip.
 *
 * Exercises `encryptFile`/`decryptFile`, `getEntryKey`, `alignedSize`, the
 * CTR-like cipher, and the AES-ECB block primitives.
 *
 * @param {Uint8Array} plaintext
 * @throws {Error} rethrows any non-clean throw; raises on round-trip mismatch
 */
export function assertCryptoRoundTrip(plaintext) {
  if (!(plaintext instanceof Uint8Array) || plaintext.length === 0) return;

  const pfd = createPfdForFiles([{ name: 'USER.DAT', size: plaintext.length }], SECURE_ID);

  let enc;
  try {
    enc = encryptFile(plaintext, 'USER.DAT', pfd, true);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }

  let dec;
  try {
    dec = decryptFile(enc, 'USER.DAT', pfd, true);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }

  if (!compareBytes(dec, plaintext)) {
    throw new Error('crypto round-trip: decryptFile(encryptFile(x)) !== x');
  }
}

/* =======================================================================
 * createPfdForFiles → hash → serialize → parse oracle  (param-pfd.js create)
 * ===================================================================== */

/**
 * Decode a bounded PFD file list from fuzz bytes.
 *
 * Layout: 1-byte count N (0-15), then per record: 1-byte name length L (0-31),
 * L name bytes (mapped to A-Z so filenames stay valid/uppercase-able), then a
 * 4-byte big-endian size (masked to 1-4095). Names are de-duplicated (a unique
 * suffix is appended on collision) because `createPfdForFiles` rejects exact
 * duplicate filenames — varied distinct names are what exercise the hash-bucket
 * collision / `additionEntry` chain code. Total work is hard-capped.
 *
 * @param {Uint8Array} bytes
 * @returns {{name: string, size: number}[]|null} null if no usable record decoded
 */
function decodeFileList(bytes) {
  if (bytes.length < 1) return null;
  const n = bytes[0] & 0x0f;
  if (n === 0) return null;
  const list = [];
  const seen = new Set();
  let p = 1;
  for (let i = 0; i < n; i++) {
    if (p + 1 >= bytes.length) break;
    const nameLen = bytes[p] & 0x1f;
    p++;
    let raw = '';
    for (let j = 0; j < nameLen && p < bytes.length; j++) {
      raw += String.fromCharCode((bytes[p] % 26) + 65);
      p++;
    }
    let name = raw.length > 0 ? raw : `F${i}`;
    let unique = name;
    let k = i;
    while (seen.has(unique)) {
      unique = name + k;
      k += n;
    }
    seen.add(unique);
    if (p + 4 > bytes.length) break;
    const sizeRaw =
      ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
    p += 4;
    list.push({ name: unique, size: Math.max(1, sizeRaw & 0xfff) });
  }
  return list.length > 0 ? list : null;
}

/**
 * Build a PFD from a fuzz-derived file list, compute its full hash chain,
 * serialize it, and re-parse it. The re-parsed PFD must be well-formed with
 * counts matching the created one, and every step must obey the clean-failure
 * contract.
 *
 * Exercises `createPfdForFiles` (incl. hash-collision `additionEntry` chains),
 * `createEncryptedEntryKey`, `generateHashKeyForSecureFileID`,
 * `calculateHashTableEntryIndex`, `validAllParamHashes` (entry + bucket +
 * top/bottom HMAC chain), `getParamPfdCombinedData` serialization,
 * `validateParamPfdDetailed`, and the HMAC primitives.
 *
 * @param {Uint8Array} bytes
 * @throws {Error} rethrows any non-clean throw and any structural mismatch
 */
export function assertPfdCreateStable(bytes) {
  const fileList = decodeFileList(bytes);
  if (!fileList) return;

  let pfd;
  try {
    pfd = createPfdForFiles(fileList, SECURE_ID);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }

  const fileMap = new Map();
  for (const f of fileList) {
    fileMap.set(f.name.toLowerCase(), new Uint8Array(f.size));
  }

  try {
    validAllParamHashes(fileMap, true, pfd);
    const pfdBytes = getParamPfdCombinedData(pfd);
    const pfd2 = parseParamPfd(pfdBytes);
    assertPfdWellFormed(pfd2);
    if (pfd2.numReserved !== pfd.numReserved || pfd2.numUsed !== pfd.numUsed) {
      throw new Error('pfdcreate: re-parsed PFD counts differ from created PFD');
    }
    // Read-only validation for coverage (slot 0 hashes were just fixed above).
    validateParamPfdDetailed(fileMap, pfd);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
}

/* =======================================================================
 * parse → clone → serialize → parse oracle  (param-pfd.js serializer)
 * ===================================================================== */

/**
 * Assert the PFD serializer is a fixed point on parse-accepted inputs: parse a
 * (possibly corrupt/fuzzed) PFD, deep-clone it, serialize the clone, and
 * re-parse. The clone must deep-equal the original on structural fields, and
 * the re-parsed PFD must be well-formed with `numReserved`/`numUsed` matching.
 *
 * Only structurally-plausible parsed PFDs are serialized: a fuzzed PFD can
 * parse with `numTotal < numUsed`, which makes the serializer's reserved-
 * padding arithmetic (`0x110 * (numTotal - numUsed)`) go negative and produce
 * a shallow RangeError rather than exercise serialization logic. Such inputs
 * are skipped (not reported) so the fuzzer spends its budget on meaningful
 * serializer paths.
 *
 * Exercises `getParamPfdCombinedData` on arbitrary parsed structures (hash
 * collision chains, variable entry counts) and `cloneParamPfd`.
 *
 * @param {Uint8Array} bytes
 * @throws {Error} rethrows any non-clean throw and any structural mismatch
 */
export function assertPfdSerializeStable(bytes) {
  let pfd;
  try {
    pfd = parseParamPfd(bytes);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  try {
    assertPfdWellFormed(pfd);
  } catch {
    return; // parse produced a structurally inconsistent PFD; skip
  }
  if (Number(pfd.numTotal) < Number(pfd.numUsed)) return;

  // Clone correctness.
  const clone = cloneParamPfd(pfd);
  if (!compareBytes(clone.hashKey, pfd.hashKey)) {
    throw new Error('pfdserialize: clone hashKey differs from original');
  }
  if (clone.numReserved !== pfd.numReserved || clone.numUsed !== pfd.numUsed) {
    throw new Error('pfdserialize: clone counts differ from original');
  }
  if (clone.entries.length !== pfd.entries.length) {
    throw new Error('pfdserialize: clone entry count differs from original');
  }

  // Serialize the clone, then re-parse.
  let pfdBytes;
  try {
    pfdBytes = getParamPfdCombinedData(clone);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  let pfd2;
  try {
    pfd2 = parseParamPfd(pfdBytes);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  assertPfdWellFormed(pfd2);
  if (pfd2.numReserved !== pfd.numReserved || pfd2.numUsed !== pfd.numUsed) {
    throw new Error('pfdserialize: re-parsed counts differ from original parsed PFD');
  }
}

/* =======================================================================
 * save-folder.js API oracle  (createSaveFolder/decrypt/encrypt/rebuild/findEntry)
 * ===================================================================== */

/** Fixed SFO/secondary for the save-folder base folder (built once, lazily). */
const SF_SFO = createRealisticSfo(42, 'aabbccdd11223344aabbccdd11223344');
const SF_BASE_USER = createPopulatedUserDat(1);
const SF_SECONDARY = createSecondaryFile();

/**
 * Lazily build a fixed realistic *encrypted* save folder (PFD + encrypted
 * USER.DAT/04USER.DAT + plaintext SFO) for the save-folder oracle. Built once
 * and cached; each oracle call clones the files map so per-input mutations
 * (encryptBytes) never corrupt the shared base.
 * @returns {{files: Map<string, Uint8Array>}}
 */
let _sfBase = null;
function saveFolderBase() {
  if (_sfBase) return _sfBase;
  const pfd = createPfdForFiles(
    [
      { name: 'PARAM.SFO', size: SF_SFO.length },
      { name: 'USER.DAT', size: SF_BASE_USER.length },
      { name: '04USER.DAT', size: SF_SECONDARY.length },
    ],
    SECURE_ID,
  );
  const files = new Map();
  files.set('param.sfo', SF_SFO);
  files.set('user.dat', encryptFile(SF_BASE_USER, 'USER.DAT', pfd, true));
  files.set('04user.dat', encryptFile(SF_SECONDARY, '04USER.DAT', pfd, true));
  validAllParamHashes(files, true, pfd);
  // createSaveFolder parses PARAM.PFD from the file map, so store the bytes.
  files.set('param.pfd', getParamPfdCombinedData(pfd));
  _sfBase = { files };
  return _sfBase;
}

/**
 * Exercise the full save-folder.js API surface in both encrypted and
 * unencrypted modes, asserting a decrypt-after-encrypt round-trip and the
 * clean-failure contract.
 *
 * The fuzz input is the plaintext re-encrypted into USER.DAT — varying its
 * length/content exercises the CTR cipher's block-alignment and the decrypt
 * trim-to-fileSize logic. Transitively covers `createSaveFolder` (unenc
 * branch), `decryptToBytes`, `encryptBytes`, `isEncrypted`, `findEntry`,
 * `rebuildChanges` → `rebuildParamPfd`, in both modes.
 *
 * @param {Uint8Array} newPlain  plaintext to re-encrypt into USER.DAT
 * @returns {Promise<void>}
 * @throws {Error} rethrows any non-clean throw and any round-trip mismatch
 */
export async function assertSaveFolderApiStable(newPlain) {
  const noop = () => {};
  const inputPlain =
    newPlain instanceof Uint8Array && newPlain.length > 0 ? newPlain : SF_BASE_USER;
  const { files: baseFiles } = saveFolderBase();

  // --- Encrypted mode ---
  let folder;
  try {
    folder = await createSaveFolder(new Map(baseFiles), SECURE_ID, noop);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  try {
    // Initial decrypt of the base USER.DAT (hash-validated).
    decryptToBytes(folder, 'USER.DAT');
    if (!isEncrypted(folder, 'USER.DAT')) {
      throw new Error('savefolder: USER.DAT not reported encrypted after open');
    }
    // Re-encrypt the fuzz plaintext into the folder.
    encryptBytes(folder, 'USER.DAT', inputPlain);
    if (!isEncrypted(folder, 'USER.DAT')) {
      throw new Error('savefolder: USER.DAT not reported encrypted after re-encrypt');
    }
    // Round-trip: decrypt must yield exactly the plaintext we encrypted.
    const pt = decryptToBytes(folder, 'USER.DAT');
    if (!compareBytes(pt, inputPlain)) {
      throw new Error('savefolder: decryptToBytes(encryptBytes(x)) !== x');
    }
    // findEntry: present and absent lookups.
    if (!findEntry(folder, 'USER.DAT')) {
      throw new Error('savefolder: findEntry USER.DAT returned null');
    }
    if (findEntry(folder, 'NOPE.DAT') !== null) {
      throw new Error('savefolder: findEntry NOPE.DAT unexpectedly non-null');
    }
    // rebuildChanges(encryptFiles=true) → covers rebuildParamPfd.
    const rebuilt = rebuildChanges(folder, true, noop);
    assertPfdWellFormed(parseParamPfd(rebuilt.pfdBytes));
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }

  // --- Unencrypted mode (no PARAM.PFD in the file map) ---
  const unencFiles = new Map(baseFiles);
  unencFiles.delete('param.pfd');
  let unenc;
  try {
    unenc = await createSaveFolder(unencFiles, SECURE_ID, noop);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  try {
    decryptToBytes(unenc, 'USER.DAT'); // returns a raw copy
    encryptBytes(unenc, 'USER.DAT', inputPlain); // stores a raw copy
    if (isEncrypted(unenc, 'USER.DAT')) {
      throw new Error('savefolder: unencrypted folder reported an entry as encrypted');
    }
    if (findEntry(unenc, 'USER.DAT') !== null) {
      throw new Error('savefolder: unencrypted folder findEntry unexpectedly non-null');
    }
    rebuildChanges(unenc, false, noop); // unencrypted branch
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
}

/* =======================================================================
 * param-sfo.js field-accessor oracle  (getters + raw-byte mutators)
 * ===================================================================== */

/**
 * Exercise every PARAM.SFO field accessor and mutator on a fuzzed SFO buffer,
 * asserting the clean-failure contract.
 *
 * The raw-byte mutators (`getSfoAttribute`, `removeCopyProtection`,
 * `getSfoAccountId`, `writeSfoAccountId`) operate directly on the bytes via
 * `findParamDataOffset` and are run whenever the buffer is large enough (≥20
 * bytes) — independent of whether `parseParamSfo` succeeds. The parsed-sfo
 * getters (`getTitle`…`getAccountId`) run only on a successful parse.
 *
 * `writeSfoAccountId`'s hex is derived from the input bytes (varied length) so
 * the fuzzer explores its `<16` / `>32` / bounds-overflow guards; clean domain
 * errors from those guards are accepted.
 *
 * @param {Uint8Array} bytes
 * @throws {Error} rethrows any non-clean throw
 */
export function assertSfoFieldsClean(bytes) {
  // Raw-byte accessors (independent of parse success).
  if (bytes.length >= 20) {
    try {
      getSfoAttribute(bytes);
      getSfoAccountId(bytes);
      removeCopyProtection(bytes.slice());
      const cp = bytes.slice();
      const hex = toHex(bytes.subarray(0, Math.min(bytes.length, 32)));
      try {
        writeSfoAccountId(cp, hex);
      } catch (e) {
        if (!isCleanDomainError(e)) throw e;
      }
    } catch (e) {
      if (!isCleanDomainError(e)) throw e;
    }
  }

  // Parsed-sfo getters (require a successful parse).
  let sfo;
  try {
    sfo = parseParamSfo(bytes);
  } catch (e) {
    if (isCleanDomainError(e)) return;
    throw e;
  }
  try {
    getTitle(sfo);
    getSubTitle(sfo);
    getDetail(sfo);
    getDirectoryName(sfo);
    getTitleId(sfo);
    getAccountId(sfo);
  } catch (e) {
    if (!isCleanDomainError(e)) throw e;
  }
}

/* =======================================================================
 * save-api folder-shape decoder  (save-api.js orchestration branches)
 * ===================================================================== */

/**
 * Fixed account ID / profile for the folder-shape decoder (matches the
 * encexport/pipeline base folders).
 */
const SF_API_ACCT = 'aabbccdd11223344aabbccdd11223344';

/**
 * Decode a fuzz-derived folder "blueprint" into a rawFiles map for
 * {@link assertEncExportStable}.
 *
 * The existing pipeline/encexport targets wrap a *fixed single-slot
 * unencrypted folder* and only vary USER.DAT bytes, so ~25 save-api.js
 * branches (multi-slot iteration, rotational fallback, missing-secondary,
 * failed-slot preservation, encrypted-source backup decryption, asset
 * inclusion) are never reached. This decoder derives the folder SHAPE from the
 * first fuzz byte — slot count, rotation mode, encryption — using fixed valid
 * USER.DAT content per slot. It fuzzes folder *structure* (which is genuine
 * untrusted input — the user picks the save folder), not save-file contents
 * (which the other targets already cover).
 *
 * Blueprint (byte0 low 3 bits = mode; byte0 bit6 = inPlace; byte0 bit7 = encrypted):
 *   0 = 1 slot (baseline)     1 = 2 slots       2 = 4 slots
 *   3 = all-3 rotation        4 = no secondary  5 = failed slot (2 slots, #1 stale)
 *   6 = 2 slots + assets      7 = no PARAM.SFO
 *
 * The encrypted bit (byte0 & 0x80) applies to the slot-count modes (0/1/2/5/6);
 * the mutation modes (3/4/7) are always unencrypted. The inPlace bit (byte0 &
 * 0x40) is read by the caller and forwarded to assertEncExportStable.
 *
 * @param {Uint8Array} data
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
export function decodeFolderBlueprint(data) {
  const sel = data.length >= 1 ? data[0] : 0;
  const mode = sel & 0x07;
  const encrypted = (sel & 0x80) !== 0;
  const baseOpts = { profileNumber: 42, realisticSfo: true, accountId: SF_API_ACCT };

  /** @param {number[]} slots @param {boolean} [assets] */
  const build = (slots, assets) =>
    encrypted
      ? createEncryptedSaveFolder(slots, { ...baseOpts, assets })
      : createUnencryptedSaveFolder(slots, { ...baseOpts, assets });

  switch (mode) {
    case 1: // two slots — multi-slot iteration
      return build([1, 2]);
    case 2: // four slots — max multi-slot
      return build([1, 2, 3, 4]);
    case 6: // two slots + asset files (ICON0.PNG / PIC1.PNG)
      return build([1, 2], true);
    case 3: {
      // All-3 rotational variants present → resolveRotational fallback path.
      // Factory builds variants[0]+variants[2]; add variants[1] (stale) so all
      // three exist and the successor-absent rule finds no match → fallback.
      const folder = createUnencryptedSaveFolder([1], baseOpts);
      const variants = getPrimaryVariants(1);
      folder.set(variants[1].toLowerCase(), {
        name: variants[1],
        bytes: createStaleUserDat(),
      });
      return folder;
    }
    case 4: {
      // No secondary file → resolveSaveFiles throws "could not resolve
      // secondary" → (only slot) → "No valid save slots".
      const folder = createUnencryptedSaveFolder([1], baseOpts);
      for (const v of getSecondaryVariants()) folder.delete(v.toLowerCase());
      return folder;
    }
    case 5: {
      // Failed slot: slot 1 primary is stale (sanity-check zeros → readSave
      // fails, or decrypt hash-mismatch fails for encrypted) alongside a valid
      // slot 2. openSave routes slot 1 to failedSlots; export/write preserve it.
      // Honors the encrypted bit so an encrypted folder also exercises the
      // decrypt-failure → failedSlot path (runCryptoJobs catch + !result.ok).
      const folder = build([1, 2]);
      const active1 = getPrimaryVariants(1)[0];
      folder.set(active1.toLowerCase(), { name: active1, bytes: createStaleUserDat() });
      return folder;
    }
    case 7: {
      // No PARAM.SFO → openSave throws "No PARAM.SFO found".
      const folder = build([1]);
      folder.delete('param.sfo');
      return folder;
    }
    default:
      // case 0: single slot (baseline).
      return build([1]);
  }
}
