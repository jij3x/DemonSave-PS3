/**
 * Model sanitization and merge logic.
 *
 * The full model from reader.js contains binary-internal fields that are
 * needed for write-back fidelity but must never reach the UI layer.
 *
 * sanitizeModel() returns a structurally separated pair:
 *
 *   { model, display }
 *
 * - `model` — editable fields that round-trip through the UI:
 *   - Inventory items: `_slot`, `idx1`, `idx2` are stripped and replaced by
 *     an opaque `_ref` token; mergeModel restores them via _ref lookup.
 *   - Deposit items: binary fields (unknown1/sortOrder/flags) are carried
 *     through as hidden data on the model (no _ref needed).
 *
 * - `display` — read-only data for UI rendering only. Never flows back
 *   through collectForm() → mergeModel() → writeSave():
 *   - `equipmentPointers`: the 17 hotbar pointer values (idx1 bindings)
 *     from the original save, keyed by equipment slot name.
 *   - `invIdxByRef`: map from inventory `_ref` → `idx1`, used by the UI
 *     for deterministic equipment-inventory binding (matching equipment
 *     spans to inventory rows when duplicate items exist).
 *
 * This structural separation ensures the writer can never accidentally
 * read display-only data — it only receives the `model` half.
 */

// ---------------------------------------------------------------------------
// Type definitions (UI-facing model shape is defined here)
// ---------------------------------------------------------------------------

/**
 * UI-visible fields shared by full and sanitized inventory items.
 * @typedef {Object} InventoryItem
 * @property {number} itemId          - Game item ID (unsigned 32-bit)
 * @property {number} count           - Stack count
 * @property {number} [misc1]         - "sortId" — inventory menu grouping/ordering
 * @property {number} [misc2]         - Unknown (preserved verbatim, usually 0x01000000)
 * @property {number} [durability]    - Current condition (weapons/armor only)
 */

/**
 * Full inventory item as produced by reader.readSave().
 * `_slot` is INTERNAL — used for write positioning but not stored on disk.
 * `idx1`/`idx2` are ON-DISK binary-internal fields (durability table key
 * / hotbar pointer reference / display order) — stripped from the
 * sanitized model and restored by mergeModel, just like `_slot`.
 * @typedef {InventoryItem & {_slot: number, idx1: number, idx2: number}} FullInventoryItem
 */

/**
 * Sanitized inventory item for the UI.  `_slot`, `idx1`, and `idx2` are all
 * stripped — the UI never sees them.  mergeModel restores them from the
 * original full model via `_ref` lookup.  New items added via the UI have
 * no `_ref` → `_slot` is undefined → the writer assigns idx1/idx2
 * (= slot number, matching the game's invariant).
 * @typedef {InventoryItem & {_ref: string}} SanitizedInventoryItem
 */

/**
 * @typedef {Object} DepositItem
 * @property {string} category        - 'weapons' | 'armor' | 'rings' | 'goods'
 * @property {number} itemId          - Game item ID
 * @property {number} count           - Stack count
 * @property {number} [durability]    - Current condition (weapons/armor only)
 */

/**
 * Full deposit item as produced by reader.readSave().
 * @typedef {DepositItem & {
 *   unknown1: number,
 *   sortOrder: number,
 *   flags: number[]
 * }} FullDepositItem
 */

/**
 * Sanitized deposit item for the UI.  Carries `unknown1/sortOrder/flags` as hidden
 * binary data (stored in DOM dataset attributes, passed through verbatim).
 * @typedef {DepositItem & {
 *   unknown1: number,
 *   sortOrder: number,
 *   flags: number[]
 * }} SanitizedDepositItem
 */

/**
 * @typedef {Object} SpellRecord
 * @property {number} itemId   - Spell/miracle item ID
 * @property {number} status   - 0=unavailable, 1=unknown, 2=known, 3=memorized
 * @property {number} misc1    - Sort/category ID
 * @property {number} misc2    - Always 0 in observed saves
 */

/**
 * Full model as produced by reader.readSave().  This is the internal
 * representation with all binary-internal fields present.
 * @typedef {Object} FullModel
 * @property {number} world
 * @property {number} block
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} rot
 * @property {number} currHP
 * @property {number} currMaxHP
 * @property {number} maxHP
 * @property {number} currMP
 * @property {number} currMaxMP
 * @property {number} maxMP
 * @property {number} currStam
 * @property {number} currMaxStam
 * @property {number} maxStam
 * @property {number} vit
 * @property {number} int
 * @property {number} end
 * @property {number} str
 * @property {number} dex
 * @property {number} magic
 * @property {number} faith
 * @property {number} luck
 * @property {number} souls
 * @property {number} soulMem
 * @property {number} levelsPurchased
 * @property {number} phantomType
 * @property {string} name
 * @property {number} gender
 * @property {number} startClass
 * @property {number} leftHand1
 * @property {number} rightHand1
 * @property {number} leftHand2
 * @property {number} rightHand2
 * @property {number} arrows
 * @property {number} bolts
 * @property {number} helmet
 * @property {number} chest
 * @property {number} gauntlets
 * @property {number} leggings
 * @property {number} hairstyle
 * @property {number} ring1
 * @property {number} ring2
 * @property {number} quickSlot1
 * @property {number} quickSlot2
 * @property {number} quickSlot3
 * @property {number} quickSlot4
 * @property {number} quickSlot5
 * @property {number} leftHand1Ptr
 * @property {number} rightHand1Ptr
 * @property {number} leftHand2Ptr
 * @property {number} rightHand2Ptr
 * @property {number} arrowsPtr
 * @property {number} boltsPtr
 * @property {number} helmetPtr
 * @property {number} chestPtr
 * @property {number} gauntletsPtr
 * @property {number} leggingsPtr
 * @property {number} ring1Ptr
 * @property {number} ring2Ptr
 * @property {number} quickSlot1Ptr
 * @property {number} quickSlot2Ptr
 * @property {number} quickSlot3Ptr
 * @property {number} quickSlot4Ptr
 * @property {number} quickSlot5Ptr
 * @property {FullInventoryItem[]} weapons
 * @property {FullInventoryItem[]} armor
 * @property {FullInventoryItem[]} rings
 * @property {FullInventoryItem[]} goods
 * @property {FullDepositItem[]} deposit
 * @property {number} spellSlots
 * @property {number} miracleSlots
 * @property {number} hairR
 * @property {number} hairG
 * @property {number} hairB
 * @property {SpellRecord[]} spells
 * @property {number} charTendency
 * @property {number} nexusTendency
 * @property {number} w1Tendency
 * @property {number} w2Tendency
 * @property {number} w3Tendency
 * @property {number} w4Tendency
 * @property {number} w5Tendency
 * @property {number} clearCount
 * @property {boolean} archSealed
 * @property {Object} sageFreke
 * @property {boolean} sageFreke.friendly
 * @property {boolean} sageFreke.hostile
 * @property {boolean} sageFreke.dead
 * @property {Object} thomas
 * @property {boolean} thomas.friendly
 * @property {boolean} thomas.hostile
 * @property {boolean} thomas.dead
 * @property {Object} boldwin
 * @property {boolean} boldwin.friendly
 * @property {boolean} boldwin.hostile
 * @property {boolean} boldwin.dead
 */

/**
 * Sanitized model for UI consumption.  Same as FullModel but inventory
 * items use `SanitizedInventoryItem` (`_ref` instead of `_slot`/`idx1`/
 * `idx2`) and deposit items carry their binary fields directly.
 * @typedef {Omit<FullModel, 'weapons'|'armor'|'rings'|'goods'|'leftHand1Ptr'|'rightHand1Ptr'|'leftHand2Ptr'|'rightHand2Ptr'|'arrowsPtr'|'boltsPtr'|'helmetPtr'|'chestPtr'|'gauntletsPtr'|'leggingsPtr'|'ring1Ptr'|'ring2Ptr'|'quickSlot1Ptr'|'quickSlot2Ptr'|'quickSlot3Ptr'|'quickSlot4Ptr'|'quickSlot5Ptr'> & {
 *   weapons: SanitizedInventoryItem[],
 *   armor: SanitizedInventoryItem[],
 *   rings: SanitizedInventoryItem[],
 *   goods: SanitizedInventoryItem[],
 *   deposit: SanitizedDepositItem[],
 * }} SanitizedModel
 *
 * NOTE: `accountId` and `profileNumber` are folder-level PARAM.SFO fields.
 * They are NOT part of the slot model — they are passed through the save-api
 * layer as separate parameters alongside the slots.
 */

/**
 * Read-only display data extracted from FullModel for UI rendering.
 * This data never flows back through collectForm() → mergeModel() → writeSave().
 * @typedef {Object} DisplayData
 * @property {Object<string, number>} equipmentPointers
 *   Maps equipment slot names (leftHand1, rightHand1, … quickSlot5) to
 *   their hotbar pointer values (idx1 bindings) from the original save.
 * @property {Map<string, number>} invIdxByRef
 *   Maps inventory `_ref` tokens (e.g. "inv:42") to their `idx1` values.
 *   Used by the UI for deterministic equipment-inventory binding.
 */

// ---------------------------------------------------------------------------
// Sanitize: full model → UI model
// ---------------------------------------------------------------------------

/**
 * Strip binary internals from a parsed model, producing the UI-facing
 * sanitized model + display-only data.  See the file header for details.
 *
 * @param {FullModel} fullModel  model from reader.readSave()
 * @returns {{ model: SanitizedModel, display: DisplayData }}
 */
export function sanitizeModel(fullModel) {
  const m = /** @type {Partial<import('./model.js').SanitizedModel>} */ (
    /** @type {unknown} */ ({ ...fullModel })
  );

  // Deep-copy NPC flag objects so UI mutations don't corrupt the original
  // fullModel (which must remain pristine for mergeModel _ref lookups).
  m.sageFreke = { ...fullModel.sageFreke };
  m.thomas = { ...fullModel.thomas };
  m.boldwin = { ...fullModel.boldwin };

  // --- Inventory: strip _slot, idx1, idx2; add _ref ---
  // These three fields are binary-internal: `_slot` is the physical position
  // in the save array (not on disk), while `idx1`/`idx2` are on-disk indices
  // (durability table key / display order) that must never be user-editable.
  // All are stripped and restored by mergeModel via _ref lookup.
  //
  // idx1 values are collected into display.invIdxByRef for the UI's
  // equipment-inventory binding.
  const invIdxByRef = new Map();
  for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
    m[cat] = (fullModel[cat] || []).map((rec) => {
      const ref = `inv:${rec._slot}`;
      invIdxByRef.set(ref, rec.idx1);
      const out = { _ref: ref };
      // UI-visible on-disk fields only
      out.itemId = rec.itemId;
      out.count = rec.count;
      out.misc1 = rec.misc1;
      out.misc2 = rec.misc2;
      out.durability = rec.durability;
      return out;
    });
  }

  // --- Deposit: carry binary fields as hidden data (no _ref) ---
  //
  // Unlike inventory (which uses _ref → _slot lookup), deposit items carry
  // their binary fields (unknown1/sortOrder/flags) directly on the model.
  // The UI stores these as hidden dataset attributes in the DOM and
  // passes them through unmodified on collectForm. The data travels with
  // the item regardless of reordering or reindexing.
  //
  // New items added via the UI simply omit these fields; mergeModel assigns
  // structural defaults for them.
  m.deposit = (fullModel.deposit || []).map((rec) => ({
    category: rec.category,
    itemId: rec.itemId,
    count: rec.count,
    durability: rec.durability ?? 0,
    unknown1: rec.unknown1,
    sortOrder: rec.sortOrder,
    flags: Array.isArray(rec.flags) ? [...rec.flags] : [0, 0, 0, 0, 0, 0, 0],
  }));

  // Spells: no binary internals to strip (itemId, status, misc1, misc2
  // are all editable fields already).  Shallow-copy for safety.
  m.spells = (fullModel.spells || []).map((sp) => ({ ...sp }));

  // --- Display-only data: equipment pointers + inventory idx1 map ---
  //
  // These values are read from FullModel for UI rendering (storing in DOM
  // dataset attributes) but structurally separated so they can never reach
  // the writer. The writer resolves pointers from the binary buffer.
  const display = {
    equipmentPointers: {
      leftHand1: fullModel.leftHand1Ptr,
      rightHand1: fullModel.rightHand1Ptr,
      leftHand2: fullModel.leftHand2Ptr,
      rightHand2: fullModel.rightHand2Ptr,
      arrows: fullModel.arrowsPtr,
      bolts: fullModel.boltsPtr,
      helmet: fullModel.helmetPtr,
      chest: fullModel.chestPtr,
      gauntlets: fullModel.gauntletsPtr,
      leggings: fullModel.leggingsPtr,
      ring1: fullModel.ring1Ptr,
      ring2: fullModel.ring2Ptr,
      quickSlot1: fullModel.quickSlot1Ptr,
      quickSlot2: fullModel.quickSlot2Ptr,
      quickSlot3: fullModel.quickSlot3Ptr,
      quickSlot4: fullModel.quickSlot4Ptr,
      quickSlot5: fullModel.quickSlot5Ptr,
    },
    invIdxByRef,
  };

  return {
    model: /** @type {import('./model.js').SanitizedModel} */ (/** @type {unknown} */ (m)),
    display,
  };
}

// ---------------------------------------------------------------------------
// Merge: UI model + original full model → full model for writer
// ---------------------------------------------------------------------------

/**
 * Restore binary internals for the writer — the inverse of sanitizeModel.
 *
 * Inventory items: `_slot`/`idx1`/`idx2` are restored from the original
 * full model via `_ref` lookup (authoritative — the UI never edits them).
 * New items (no `_ref`) leave them undefined for the writer to assign.
 *
 * Deposit items: binary fields come straight from the sanitized model;
 * new items get structural defaults.
 *
 * Deleted items (in original but not in sanitized) are dropped, and their
 * slot numbers are reported via `out.deletedSlots`.
 *
 * @param {FullModel} originalFullModel  model originally from reader.readSave()
 * @param {SanitizedModel} sanitizedModel  model from the UI (after collectForm)
 * @param {{deletedSlots?: number[]}} [out]  optional output bag — if provided, `out.deletedSlots`
 *   will be set to an array of original inventory slot numbers that were
 *   removed in the sanitized model.  Pass this to writeSave() as its 3rd arg.
 * @returns {import('./model.js').FullModel} full model suitable for writer.writeSave()
 */
export function mergeModel(originalFullModel, sanitizedModel, out) {
  // The sanitized model contains only slot-level fields — folder-level SFO
  // fields (accountId, profileNumber) are no longer attached to the model.
  // Display-only fields (equipmentPointers, invIdxByRef) are in the separate
  // `display` object returned by sanitizeModel — they never appear on the
  // sanitized model itself.
  const m = /** @type {Partial<import('./model.js').FullModel>} */ (
    /** @type {unknown} */ ({ ...sanitizedModel })
  );

  // --- Build lookup map from original (inventory only) ---
  // Use Map to keep numeric slot keys type-safe.
  const invBySlot = new Map(); // slot number → original record
  for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
    for (const rec of originalFullModel[cat] || []) {
      invBySlot.set(rec._slot, rec);
    }
  }

  // --- Merge inventory ---
  // Track which original slots are still kept (for deletion detection).
  const keptSlots = new Set();
  for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
    m[cat] = (sanitizedModel[cat] || []).map((rec) => {
      const merged = { ...rec };
      const ref = rec._ref;

      if (ref && ref.startsWith('inv:')) {
        const slot = parseInt(ref.slice(4), 10);
        const orig = invBySlot.get(slot);
        if (orig) {
          // Restore all binary-internal fields from the original record.
          // These are authoritative — the UI never sees or edits them.
          merged._slot = orig._slot;
          merged.idx1 = orig.idx1;
          merged.idx2 = orig.idx2;
          keptSlots.add(orig._slot);
        }
        // else: new item — _slot/idx1/idx2 stay undefined.  The writer
        // places it in the first empty slot and computes idx1/idx2
        // (= slot number, matching the game's invariant).
      }
      // else: new item (no _ref) — same as above.

      // _ref is dead in the full model — strip it so it doesn't flow
      // through to the writer as unused data.
      delete merged._ref;

      return merged;
    });
  }

  // Compute deleted slots and pass them via the `out` bag instead of
  // attaching to the model. This keeps the model clean (no private fields)
  // while still giving the writer the info it needs for surgical clearing.
  const deletedSlots = [];
  for (const slot of invBySlot.keys()) {
    if (!keptSlots.has(slot)) deletedSlots.push(slot);
  }
  if (out) out.deletedSlots = deletedSlots;

  // --- Merge deposit ---
  // Deposit items carry their binary fields (unknown1/sortOrder/flags) directly from
  // the sanitized model (stored as hidden DOM dataset attributes).  For
  // new items added via the UI that lack these fields, assign defaults.
  m.deposit = (sanitizedModel.deposit || []).map((rec) => {
    const merged = { ...rec };

    if (merged.unknown1 === undefined) {
      assignDepositDefaults(merged);
    }

    return merged;
  });

  // Spells: pass through (no binary internals)
  m.spells = (sanitizedModel.spells || []).map((sp) => ({ ...sp }));

  return /** @type {import('./model.js').FullModel} */ (/** @type {unknown} */ (m));
}

/**
 * Assign default unknown fields for a new deposit item.
 * @param {import('./model.js').FullDepositItem} merged
 */
function assignDepositDefaults(merged) {
  merged.unknown1 = 0;
  // sortOrder=0 → sortId=0 in the hi16. This is non-corrupting: the item
  // just appears at the top of the in-game deposit list instead of its
  // natural category position.
  merged.sortOrder = 0;
  // Structural binary fields for a new deposit entry. The flag byte (0x21)
  // is the game-native "occupied item" marker. Durability bytes are left
  // zero — the writer gets durability from the named model field.
  merged.flags = [
    0x21, // flag byte
    0x00,
    0x00,
    0x00,
    0x00, // pad
    0x00,
    0x00, // durability (0 = no data; writer uses named field)
  ];
}
