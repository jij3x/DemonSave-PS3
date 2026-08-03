/**
 * Deep comparison helpers for save models.
 *
 * Compares every field of two save models (or subsets) to verify that
 * values written during a save round-trip match the values that were
 * intended to be saved.  Failures produce a descriptive diff message.
 */

/**
 * Assert two models match field-by-field.
 *
 * Compares all scalar fields, inventory arrays, deposit arrays, spell
 * arrays, NPC flags, and tendency values.
 *
 * @param {object} actual   model read back after round-trip
 * @param {object} expected model with the intended saved values
 * @param {{floatPrecision?: number}} [opts]
 */
export function assertModelsMatch(actual, expected, opts = {}) {
  const precision = opts.floatPrecision ?? 5;
  const errors = collectModelDiff(actual, expected, precision);
  if (errors.length > 0) {
    throw new Error(
      `Model mismatch (${errors.length} field(s)):\n` + errors.map((e) => `  • ${e}`).join('\n'),
    );
  }
}

/**
 * Collect all field mismatches between two models.
 *
 * @param {object} actual
 * @param {object} expected
 * @param {number} floatPrecision
 * @returns {string[]}  array of human-readable error strings
 */
function collectModelDiff(actual, expected, floatPrecision) {
  const errors = [];

  // --- Scalar numeric/string/boolean fields ---
  const scalarFields = [
    'world',
    'block',
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
    'name',
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
    'spellSlots',
    'miracleSlots',
    'clearCount',
    'archSealed',
  ];

  for (const field of scalarFields) {
    if (!(field in expected)) continue;
    const a = actual[field];
    const e = expected[field];
    if (a !== e) {
      errors.push(`${field}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
    }
  }

  // --- Float fields (position, hair color, tendency) ---
  const floatFields = [
    'x',
    'y',
    'z',
    'rot',
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
  ];

  for (const field of floatFields) {
    if (!(field in expected)) continue;
    const a = actual[field];
    const e = expected[field];
    if (typeof e === 'number' && typeof a === 'number') {
      if (Math.abs(a - e) > Math.pow(10, -floatPrecision)) {
        errors.push(`${field}: expected ${e}, got ${a} (diff ${a - e})`);
      }
    } else if (a !== e) {
      errors.push(`${field}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
    }
  }

  // --- NPC flags (nested objects) ---
  const npcFields = ['sageFreke', 'thomas', 'boldwin'];
  for (const npc of npcFields) {
    if (!(npc in expected)) continue;
    const aObj = actual[npc];
    const eObj = expected[npc];
    if (!aObj || !eObj) {
      errors.push(`${npc}: expected ${JSON.stringify(eObj)}, got ${JSON.stringify(aObj)}`);
      continue;
    }
    for (const key of Object.keys(eObj)) {
      if (aObj[key] !== eObj[key]) {
        errors.push(`${npc}.${key}: expected ${eObj[key]}, got ${aObj[key]}`);
      }
    }
  }

  // --- Inventory arrays (weapons, armor, rings, goods) ---
  for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
    if (!(cat in expected)) continue;
    const aArr = actual[cat] || [];
    const eArr = expected[cat] || [];
    if (aArr.length !== eArr.length) {
      errors.push(`${cat}.length: expected ${eArr.length}, got ${aArr.length}`);
      continue;
    }
    for (let i = 0; i < eArr.length; i++) {
      const itemErrors = collectInventoryItemDiff(aArr[i], eArr[i], `${cat}[${i}]`);
      errors.push(...itemErrors);
    }
  }

  // --- Deposit array ---
  if ('deposit' in expected) {
    const aArr = actual.deposit || [];
    const eArr = expected.deposit || [];
    if (aArr.length !== eArr.length) {
      errors.push(`deposit.length: expected ${eArr.length}, got ${aArr.length}`);
    } else {
      for (let i = 0; i < eArr.length; i++) {
        const itemErrors = collectDepositItemDiff(aArr[i], eArr[i], `deposit[${i}]`);
        errors.push(...itemErrors);
      }
    }
  }

  // --- Spells array ---
  if ('spells' in expected) {
    const aArr = actual.spells || [];
    const eArr = expected.spells || [];
    if (aArr.length !== eArr.length) {
      errors.push(`spells.length: expected ${eArr.length}, got ${aArr.length}`);
    } else {
      for (let i = 0; i < eArr.length; i++) {
        const spellFields = ['itemId', 'status', 'misc1', 'misc2'];
        for (const sf of spellFields) {
          if (aArr[i][sf] !== eArr[i][sf]) {
            errors.push(`spells[${i}].${sf}: expected ${eArr[i][sf]}, got ${aArr[i][sf]}`);
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Compare a single inventory item.
 *
 * Only compares UI-visible fields.  idx1/idx2 are binary-internal fields
 * stripped by sanitizeModel — they are not present in the sanitized/collected
 * model and are verified separately at the binary level (editor.test.js).
 * @returns {string[]}
 */
function collectInventoryItemDiff(actual, expected, label) {
  const errors = [];
  const fields = ['itemId', 'count', 'misc1', 'misc2', 'durability'];
  for (const f of fields) {
    if (!(f in expected)) continue;
    if (actual[f] !== expected[f]) {
      errors.push(`${label}.${f}: expected ${expected[f]}, got ${actual[f]}`);
    }
  }
  return errors;
}

/**
 * Compare a single deposit item.
 * @returns {string[]}
 */
function collectDepositItemDiff(actual, expected, label) {
  const errors = [];
  const scalarFields = ['category', 'itemId', 'count', 'durability', 'unknown1', 'sortOrder'];
  for (const f of scalarFields) {
    if (!(f in expected)) continue;
    if (actual[f] !== expected[f]) {
      errors.push(`${label}.${f}: expected ${expected[f]}, got ${actual[f]}`);
    }
  }
  // flags array (7 elements)
  if (Array.isArray(expected.flags)) {
    const aFlags = actual.flags || [];
    for (let i = 0; i < expected.flags.length; i++) {
      if (aFlags[i] !== expected.flags[i]) {
        errors.push(`${label}.flags[${i}]: expected ${expected.flags[i]}, got ${aFlags[i]}`);
      }
    }
  }
  return errors;
}

/**
 * Extract a comparable model from a full model (strips binary internals).
 *
 * Returns a shallow copy with only the UI-visible fields for comparison.
 * Strips `_slot`, `_ref`, `idx1`, and `idx2` — all are binary-internal
 * fields not present in the sanitized/collected model.
 * @param {object} fullModel
 * @returns {object}
 */
export function extractComparableModel(fullModel) {
  const m = { ...fullModel };
  for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
    m[cat] = (m[cat] || []).map((rec) => {
      const { _slot, _ref, idx1: _idx1, idx2: _idx2, ...rest } = rec;
      return rest;
    });
  }
  return m;
}
