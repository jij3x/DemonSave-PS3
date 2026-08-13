/**
 * @jest-environment jsdom
 *
 * Integration tests for the UI event layer (events.js facade).
 *
 * SCOPE: This suite verifies cross-module orchestration that no single
 * module owns — populateForm/collectForm binding the WHOLE form at once,
 * equipment-slot sync between the inventory table and the equipment spans,
 * durability reload on item change, collectFolderFields validation, and
 * getNumClamped clamping. Per-function behavior and branch coverage live in
 * the focused per-module unit tests (inventory-table, deposit-table,
 * spell-table, dom-helpers, select-helpers, form-render, ui-setup, controls).
 *
 * Uses a small mock des-db (12 items/category) instead of the full game
 * database to keep DOM option creation fast.
 */

import { jest } from '@jest/globals';

/**
 * Typed getElementById — returns any to avoid HTMLElement|null narrowing
 * errors on .value/.checked/.textContent access throughout this test suite.
 * @param {string} id
 * @returns {any}
 */
function byId(id) {
  return document.getElementById(id);
}

/**
 * Typed querySelector — returns any to avoid Element|null narrowing errors
 * on .value/.dataset/.click access throughout this test suite.
 * @param {string} sel
 * @returns {any}
 */
function qs(sel) {
  return document.querySelector(sel);
}

/**
 * Typed querySelectorAll — returns any[] to avoid Element type narrowing
 * errors when accessing .dataset/.value/.disabled on indexed elements.
 * @param {string} sel
 * @returns {any[]}
 */
function qsa(sel) {
  return /** @type {any[]} */ (/** @type {unknown} */ (document.querySelectorAll(sel)));
}

// --- Mock des-db: small dataset that mimics the real API shape ---
const MOCK_SIZE = 12;

/**
 * @param {number} base
 * @returns {number[]}
 */
function makeIds(base) {
  return Array.from({ length: MOCK_SIZE }, (_, i) => base + i);
}

/**
 * @param {string} prefix
 * @returns {string[]}
 */
function makeNames(prefix) {
  return Array.from({ length: MOCK_SIZE }, (_, i) => `${prefix} ${i}`);
}

/** @type {Record<string, { ids: number[], names: string[] }>} */
const MOCK = {
  weapons: { ids: makeIds(0x10000000), names: makeNames('Weapon') },
  armor: { ids: makeIds(0x20000000), names: makeNames('Armor') },
  rings: { ids: makeIds(0x30000000), names: makeNames('Ring') },
  goods: { ids: makeIds(0x40000000), names: makeNames('Good') },
  spells: { ids: makeIds(0x50000000), names: makeNames('Spell') },
  hairstyles: { ids: makeIds(0x60000000), names: makeNames('Hair') },
};

const MOCK_START_CLASSES = [
  'Soldier',
  'Knight',
  'Hunter',
  'Temple Knight',
  'Priest',
  'Magician',
  'Wanderer',
  'Barbarian',
  'Royalty',
];

const MOCK_WARPS = [
  { name: 'Nexus', world: 0, block: 0, x: 0, y: 0, z: 0, rot: 0 },
  { name: 'Boletaria', world: 1, block: 1, x: 100, y: 0, z: 200, rot: 0 },
];

/** @type {Record<string, { name: string, levels: number[], note: string }>} */
const MOCK_PATHS = {
  1: { name: 'Basic', levels: [0, 1, 2, 3, 4, 5], note: 'Basic' },
  2: { name: 'Quality', levels: [1, 2, 3, 4, 5], note: 'Quality' },
  14: { name: 'Colorless', levels: [0, 1, 2, 3, 4, 5], note: 'Colorless' },
};

// Mock base weapons: each mock weapon type-1 item gets a base weapon entry.
// Base weapon ID = idx+1 (1-based). Only type 1/2/3 items get upgrade_refs.
// path_ids for each mock base weapon.
/** @type {Record<string, { name: string, path_ids: number[], durability: number, note: string }>} */
const MOCK_BASE_WEAPONS = {};
for (let i = 0; i < MOCK_SIZE; i++) {
  MOCK_BASE_WEAPONS[String(i + 1)] = {
    name: `BaseWeapon ${i}`,
    path_ids: [1, 2, 14],
    durability: 300,
    note: 'mock',
  };
}
// Base weapon 13: crossbow base with NO upgrade paths (simulates real
// crossbows whose base weapons have empty path_ids).
MOCK_BASE_WEAPONS['13'] = {
  name: 'BaseCrossbow',
  path_ids: [],
  durability: 300,
  note: 'mock crossbow — no upgrade paths',
};

// Extra crossbow item ID (not part of the standard 12-item mock arrays).
// Type [3, 2] = Bow sub-type 2 (crossbow), upgrade_ref [13, null, null].
const CROSSBOW_ID = 0x1000000c; // comes right after the 12 standard mock weapons
MOCK.weapons.ids.push(CROSSBOW_ID);
MOCK.weapons.names.push('Mock Crossbow');

// Build mock upgrade_ref index: key = "baseId:pathId:level" → hex ID
// Each base weapon (1-12) maps to the first 4 items of its type group.
// Type 1: items 0-3 (base 1-4), Type 2: items 4-7 (base 5-8), Type 3: items 8-11 (base 9-12)
/** @type {Record<string, { category: string, id: string }>} */
const MOCK_REF_INDEX = {};
{
  for (let i = 0; i < MOCK_SIZE; i++) {
    const itemIdx = i;
    let typeGroup;
    if (itemIdx < 4) typeGroup = 1;
    else if (itemIdx < 8) typeGroup = 2;
    else typeGroup = 3;

    // Assign upgrade_ref: [baseId, pathId, level]
    // First item of each type gets base=new, rest share base of first.
    const baseId = (itemIdx % 4) + 1 + (typeGroup - 1) * 4; // base 1-4 for type 1, 5-8 for type 2, 9-12 for type 3
    const pathId = 1; // Basic
    const level = itemIdx % 4; // levels 0-3
    MOCK_REF_INDEX[`${baseId}:${pathId}:${level}`] = {
      category: 'weapons',
      id: '0x' + (MOCK.weapons.ids[itemIdx] >>> 0).toString(16).toUpperCase(),
    };
  }
}
// Crossbow: non-upgradable base weapon (base 13) with null path/level.
MOCK_REF_INDEX['13:null:null'] = {
  category: 'weapons',
  id: '0x' + (CROSSBOW_ID >>> 0).toString(16).toUpperCase(),
};

jest.unstable_mockModule('../../js/des-db/index.js', () => ({
  __esModule: true,
  getCategories: () =>
    Object.freeze(['weapons', 'armor', 'rings', 'goods', 'spells', 'hairstyles']),
  getItemIdsByCategory: (/** @type {string} */ cat) => MOCK[cat]?.ids ?? [],
  getItemNamesByCategory: (/** @type {string} */ cat) => MOCK[cat]?.names ?? [],
  getItem: (/** @type {string} */ cat, /** @type {number|string} */ id) => {
    const m = MOCK[cat];
    if (!m) throw new Error(`Unknown category: ${cat}`);
    const idx = m.ids.indexOf(typeof id === 'string' ? parseInt(id, 16) >>> 0 : id >>> 0);
    if (idx < 0) throw new Error(`Item not found: ${cat}/${id}`);
    // Weapons: assign type based on item index so items distribute across
    // weapon-type sub-tabs. Mock items 0-3 → type 1 (Weapon), 4-7 → type 2
    // (Shield), 8-11 → type 3 (Bow).
    // Goods: assign type based on item index so items distribute across
    // goods-type sub-tabs. Mock items 0-2 → type 9 (Ore), 3-5 → type 10
    // (Consumables), 6-8 → type 11 (Souls), 9-11 → type 12 (Key Items).
    let type = [0, null];
    let upgrade_ref = undefined;
    if (cat === 'weapons') {
      if (idx === MOCK_SIZE) {
        // Crossbow item: type [3, 2] with null path/level (no upgrade paths)
        type = [3, 2];
        upgrade_ref = [13, null, null];
      } else if (idx < 4) {
        type = [1, 1];
        const typeGroup = 1;
        const baseId = (idx % 4) + 1 + (typeGroup - 1) * 4;
        upgrade_ref = [baseId, 1, idx % 4];
      } else if (idx < 8) {
        type = [2, 1];
        const typeGroup = 2;
        const baseId = (idx % 4) + 1 + (typeGroup - 1) * 4;
        upgrade_ref = [baseId, 1, idx % 4];
      } else {
        type = [3, 1];
        const typeGroup = 3;
        const baseId = (idx % 4) + 1 + (typeGroup - 1) * 4;
        upgrade_ref = [baseId, 1, idx % 4];
      }
    } else if (cat === 'goods') {
      if (idx < 3) type = [9, null];
      else if (idx < 6) type = [10, 1];
      else if (idx < 9) type = [11, 1];
      else type = [12, 3];
    }
    /** @type {{ name: string, type: Array<number|null>, upgrade_ref?: Array<number|null> }} */
    const result = { name: m.names[idx], type };
    if (upgrade_ref) result.upgrade_ref = upgrade_ref;
    return result;
  },
  hasItem: (/** @type {string} */ cat, /** @type {number|string} */ id) => {
    const m = MOCK[cat];
    if (!m) return false;
    const idx = m.ids.indexOf(typeof id === 'string' ? parseInt(id, 16) >>> 0 : id >>> 0);
    return idx >= 0;
  },
  getStartClasses: () => MOCK_START_CLASSES,
  getWarps: () => MOCK_WARPS,
  getWorldName: (/** @type {number} */ world) => {
    if (world === 0) return 'Nexus';
    if (world === 1) return 'Boletaria';
    throw new Error(`Unknown world: ${world}`);
  },
  getAllTypes: /** @type {() => Array<{ typeId: number, name: string }>} */ (() => []),
  getItemDurability: (/** @type {string} */ cat, /** @type {number|string} */ _id) => {
    // Mock durability: weapons=300, armor=200, others=0
    if (cat === 'weapons') return 300;
    if (cat === 'armor') return 200;
    return 0;
  },
  // Upgrade path functions
  getUpgradePathDef: (/** @type {number|string} */ pathId) => {
    const def = MOCK_PATHS[String(pathId)];
    if (!def) throw new Error(`Unknown path id: ${pathId}`);
    return def;
  },
  getBaseWeapon: (/** @type {number|string} */ baseId) => {
    const bw = MOCK_BASE_WEAPONS[String(baseId)];
    if (!bw) throw new Error(`Invalid base weapon id: ${baseId}`);
    return {
      name: bw.name,
      path_ids: (bw.path_ids || [])
        .slice()
        .sort((/** @type {number} */ a, /** @type {number} */ b) => a - b),
      durability: bw.durability,
      note: bw.note,
    };
  },
  hasBaseWeapon: (/** @type {number|string} */ baseId) =>
    MOCK_BASE_WEAPONS[String(baseId)] !== undefined,
  getWeaponItemByUpgradeRef: (/** @type {Array<number|null>} */ ref) => {
    if (!Array.isArray(ref) || ref.length !== 3) {
      throw new Error(`Invalid upgrade_ref: ${JSON.stringify(ref)}`);
    }
    const key = `${ref[0]}:${ref[1] ?? 'null'}:${ref[2] ?? 'null'}`;
    const entry = MOCK_REF_INDEX[key];
    if (!entry) throw new Error(`No item for ref [${ref[0]}, ${ref[1]}, ${ref[2]}]`);
    return entry.id;
  },
}));

// --- Dynamic imports (must come AFTER mock setup) ---
const {
  populateForm,
  collectForm,
  collectFolderFields,
  setupAddRowButtons,
  setupEquipmentSync,
  setupLazySelects,
  setupDurabilitySync,
  setupCountAndDuplicateSync,
  setupDepositWeaponSync,
  setupSelectTooltipSync,
} = await import('../../js/ui/events.js');
const { populateCombos } = await import('../../js/ui/core/controls.js');
const { refreshEquipmentDisplay } = await import('../../js/ui/core/dom-helpers.js');
const db = await import('../../js/des-db/index.js');

const WEAPON_IDS = db.getItemIdsByCategory('weapons');
const ARMOR_IDS = db.getItemIdsByCategory('armor');
const RING_IDS = db.getItemIdsByCategory('rings');
const ITEM_IDS = db.getItemIdsByCategory('goods');
const SPELL_IDS = db.getItemIdsByCategory('spells');
const HAIRSTYLE_IDS = db.getItemIdsByCategory('hairstyles');

// --- DOM setup ---
function buildDOM() {
  document.body.innerHTML = '';

  function inp(/** @type {string} */ id, type = 'number') {
    const el = document.createElement('input');
    el.type = type;
    el.id = id;
    document.body.appendChild(el);
    return el;
  }

  function sel(/** @type {string} */ id) {
    const el = document.createElement('select');
    el.id = id;
    document.body.appendChild(el);
    return el;
  }

  function chk(/** @type {string} */ id) {
    const el = document.createElement('input');
    el.type = 'checkbox';
    el.id = id;
    document.body.appendChild(el);
    return el;
  }

  // Character fields
  inp('name', 'text');
  inp('accountId', 'text');
  sel('gender');
  sel('startClass');
  inp('phantomType');
  inp('clearCount');
  chk('archSealed');
  inp('profileNum');

  // Vitals
  inp('currHP');
  inp('currMaxHP');
  inp('maxHP');
  inp('currMP');
  inp('currMaxMP');
  inp('maxMP');
  inp('currStam');
  inp('currMaxStam');
  inp('maxStam');

  // Stats
  for (const s of [
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
  ]) {
    inp(s);
  }

  // Position
  inp('world');
  inp('block');
  inp('xpos');
  inp('ypos');
  inp('zpos');
  inp('rot');
  const worldName = document.createElement('span');
  worldName.id = 'worldName';
  document.body.appendChild(worldName);

  // Equipment — hairstyle is still a <select>, the rest are read-only spans
  sel('hairstyle');
  for (const id of [
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
    'ring1',
    'ring2',
    'quickSlot1',
    'quickSlot2',
    'quickSlot3',
    'quickSlot4',
    'quickSlot5',
  ]) {
    const span = document.createElement('span');
    span.id = id;
    document.body.appendChild(span);
  }

  // Spells
  inp('spellSlots');
  inp('miracleSlots');
  inp('hairR');
  inp('hairG');
  inp('hairB');
  const spellsTable = document.createElement('table');
  spellsTable.id = 'spellsTableBody';
  const spellsTbody = document.createElement('tbody');
  spellsTable.appendChild(spellsTbody);
  document.body.appendChild(spellsTable);

  // Tendency
  for (const id of [
    'charTendency',
    'nexusTendency',
    'w1Tendency',
    'w2Tendency',
    'w3Tendency',
    'w4Tendency',
    'w5Tendency',
  ]) {
    inp(id);
  }

  // NPC state selects (single-select dropdowns)
  for (const npcId of ['sageFreke', 'thomas', 'boldwin']) {
    const npcSel = sel(npcId);
    const states =
      npcId === 'sageFreke'
        ? [
            ['friendly', 'Friendly'],
            ['hostile', 'Hostile'],
            ['dead', 'Dead'],
          ]
        : [
            ['friendly', 'Friendly'],
            ['hostile', 'Hostile'],
            ['dead', 'Dead'],
          ];
    for (const [val, text] of states) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      npcSel.appendChild(opt);
    }
  }

  // Inventory tables — weapons have multiple per-type tables
  // (matching the flat weapon-type tab structure in dom.js)
  for (const typeId of ['1', '2', '3', '4', '6']) {
    const table = document.createElement('table');
    table.className = 'grid-table inv-table';
    table.dataset.category = 'weapons';
    table.dataset.weaponType = typeId;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    document.body.appendChild(table);
  }
  for (const cat of ['armor', 'rings']) {
    const table = document.createElement('table');
    table.className = 'grid-table inv-table';
    table.dataset.category = cat;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    document.body.appendChild(table);
  }
  // Goods have multiple per-type tables (matching goods-type sub-tabs)
  for (const typeId of ['9', '10', '11', '12']) {
    const table = document.createElement('table');
    table.className = 'grid-table inv-table';
    table.dataset.category = 'goods';
    table.dataset.goodsType = typeId;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    document.body.appendChild(table);
  }

  // Deposit tables — weapons and goods have multiple per-type tables
  // (matching the flat weapon/goods-type tab structure in dom.js)
  for (const typeId of ['1', '2', '3', '4', '6']) {
    const table = document.createElement('table');
    table.className = 'grid-table dep-table';
    table.dataset.category = 'weapons';
    table.dataset.weaponType = typeId;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    document.body.appendChild(table);
  }
  for (const cat of ['armor', 'rings']) {
    const table = document.createElement('table');
    table.className = 'grid-table dep-table';
    table.dataset.category = cat;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    document.body.appendChild(table);
  }
  for (const typeId of ['9', '10', '11', '12']) {
    const table = document.createElement('table');
    table.className = 'grid-table dep-table';
    table.dataset.category = 'goods';
    table.dataset.goodsType = typeId;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    document.body.appendChild(table);
  }

  // Warp select
  sel('warpLocation');

  // Populate all combo boxes (cheap with mock — only 12 items/category)
  populateCombos();

  // Set up lazy-load listeners (same as initApp in app.js)
  setupLazySelects();
  setupDurabilitySync();
  setupCountAndDuplicateSync();
  setupDepositWeaponSync();
  setupSelectTooltipSync();
}

/**
 * Simulate a user focusing a lazy-load select so its options get populated.
 * Call this before setting `.value` on an .inv-name, .dep-name, or
 * .spell-name select in tests.
 * @param {Element} sel
 */
function focusLazySelect(sel) {
  sel.dispatchEvent(new Event('focusin', { bubbles: true }));
}

function resetForm() {
  qsa('input').forEach((el) => {
    if (el.type === 'checkbox') el.checked = false;
    else el.value = '';
  });
  qsa('select').forEach((el) => {
    el.selectedIndex = 0;
  });
  qsa('tbody').forEach((el) => {
    el.innerHTML = '';
  });
}

// --- Test model ---
/** @returns {any} */
function makeSanitizedModel() {
  return {
    world: 1,
    block: 2,
    x: 100.5,
    y: 200.0,
    z: 300.0,
    rot: 45.0,
    currHP: 580,
    currMaxHP: 600,
    maxHP: 600,
    currMP: 35,
    currMaxMP: 40,
    maxMP: 40,
    currStam: 110,
    currMaxStam: 120,
    maxStam: 120,
    vit: 50,
    int: 30,
    end: 40,
    str: 30,
    dex: 20,
    magic: 15,
    faith: 10,
    luck: 5,
    souls: 99999,
    soulMem: 123456,
    levelsPurchased: 50,
    phantomType: 0,
    name: 'TestChar',
    gender: 1,
    startClass: 3,
    leftHand1: WEAPON_IDS[5],
    rightHand1: WEAPON_IDS[10],
    leftHand2: WEAPON_IDS[0],
    rightHand2: WEAPON_IDS[0],
    arrows: WEAPON_IDS[0],
    bolts: WEAPON_IDS[0],
    helmet: ARMOR_IDS[0],
    chest: ARMOR_IDS[0],
    gauntlets: ARMOR_IDS[0],
    leggings: ARMOR_IDS[0],
    hairstyle: HAIRSTYLE_IDS[0],
    ring1: RING_IDS[0],
    ring2: RING_IDS[0],
    quickSlot1: ITEM_IDS[0],
    quickSlot2: ITEM_IDS[0],
    quickSlot3: ITEM_IDS[0],
    quickSlot4: ITEM_IDS[0],
    quickSlot5: ITEM_IDS[0],
    weapons: [
      {
        _ref: 'inv:0',
        itemId: WEAPON_IDS[5],
        count: 1,
        misc1: 0x0ffc,
        durability: 300,
        misc2: 0x01000000,
        ro_idx1: 0,
      },
    ],
    armor: [
      {
        _ref: 'inv:5',
        itemId: ARMOR_IDS[3],
        count: 1,
        misc1: 0x03f4,
        durability: 200,
        misc2: 0x01000000,
        ro_idx1: 5,
      },
    ],
    rings: [
      {
        _ref: 'inv:10',
        itemId: RING_IDS[1],
        count: 1,
        misc1: 0x0013,
        durability: 0,
        misc2: 0x01000000,
        ro_idx1: 10,
      },
    ],
    goods: [
      {
        _ref: 'inv:15',
        itemId: ITEM_IDS[2],
        count: 99,
        misc1: 0x0001,
        durability: 0,
        misc2: 0x01000000,
        ro_idx1: 15,
      },
    ],
    deposit: [
      {
        category: 'weapons',
        itemId: WEAPON_IDS[2],
        count: 1,
        durability: 300,
        unknown1: 0,
        sortOrder: 0x00010000,
        flags: [0x21, 0, 0, 0, 0, 0x01, 0x2c],
      },
      {
        category: 'goods',
        itemId: ITEM_IDS[2],
        count: 50,
        durability: 0,
        unknown1: 0,
        sortOrder: 0x00010000,
        flags: [0x21, 0, 0, 0, 0, 0, 0],
      },
    ],
    spells: [{ itemId: SPELL_IDS[6], status: 2, misc1: 0, misc2: 0 }],
    spellSlots: 3,
    miracleSlots: 1,
    hairR: 0.5,
    hairG: 0.3,
    hairB: 0.2,
    charTendency: 50.0,
    nexusTendency: -20.0,
    w1Tendency: 0.0,
    w2Tendency: 0.0,
    w3Tendency: 0.0,
    w4Tendency: 0.0,
    w5Tendency: 0.0,
    clearCount: 3,
    archSealed: true,
    sageFreke: { friendly: true, hostile: false, dead: false },
    thomas: { friendly: true, hostile: false, dead: false },
    boldwin: { friendly: false, hostile: true, dead: false },
  };
}

/**
 * Create a display object matching makeSanitizedModel().
 * Equipment pointers and inventory idx1 map for deterministic binding.
 * @returns {{ equipmentPointers: Record<string, number|undefined>, invIdxByRef: Map<string, number> }}
 */
function makeDisplay() {
  return {
    equipmentPointers: {
      leftHand1: 0,
      rightHand1: 100,
      leftHand2: 101,
      rightHand2: 102,
      arrows: 103,
      bolts: 104,
      helmet: 105,
      chest: 106,
      gauntlets: 107,
      leggings: 108,
      ring1: 109,
      ring2: 110,
      quickSlot1: 111,
      quickSlot2: 112,
      quickSlot3: 113,
      quickSlot4: 114,
      quickSlot5: 115,
    },
    invIdxByRef: new Map([
      ['inv:0', 0],
      ['inv:5', 5],
      ['inv:10', 10],
      ['inv:15', 15],
    ]),
  };
}

// --- Tests ---
describe('UI events', () => {
  beforeAll(buildDOM);
  beforeEach(resetForm);

  // populateForm/collectForm bind the WHOLE form at once — the per-category
  // render/collect functions are unit-tested in their own files; here we only
  // verify the top-level orchestration maps every field group correctly.
  describe('populateForm / collectForm orchestration', () => {
    test('stats round-trip through the DOM', () => {
      const model = makeSanitizedModel();
      populateForm(model, undefined, undefined);

      expect(byId('vit').value).toBe('50');
      expect(byId('souls').value).toBe('99999');
      expect(byId('name').value).toBe('TestChar');

      const collected = /** @type {any} */ (collectForm());
      expect(collected.vit).toBe(50);
      expect(collected.souls).toBe(99999);
      expect(collected.name).toBe('TestChar');
    });

    test('vitals populate and round-trip through the DOM', () => {
      const model = makeSanitizedModel();
      populateForm(model, undefined, undefined);

      const collected = /** @type {any} */ (collectForm());
      expect(collected.currHP).toBe(580);
      expect(collected.maxHP).toBe(600);
      expect(collected.currMP).toBe(35);
      expect(collected.maxMP).toBe(40);
      expect(collected.currStam).toBe(110);
      expect(collected.maxStam).toBe(120);
    });

    test('profile number and account id populate from folderFields', () => {
      const model = makeSanitizedModel();
      populateForm(model, undefined, { profileNumber: 42, accountId: '' });
      expect(byId('profileNum').value).toBe('42');
    });

    test('undefined folderFields default profileNum to 0 and accountId to empty', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      expect(byId('profileNum').value).toBe('0');
      expect(byId('accountId').value).toBe('');
    });

    test('tendency round-trip', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      expect(byId('charTendency').value).toBe('50');
      expect(byId('nexusTendency').value).toBe('-20');
      const collected = /** @type {any} */ (collectForm());
      expect(collected.charTendency).toBe(50);
      expect(collected.nexusTendency).toBe(-20);
    });

    test('archSealed checkbox round-trip', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      expect(byId('archSealed').checked).toBe(true);
      expect(/** @type {any} */ (collectForm()).archSealed).toBe(true);
    });

    test('equipment text spans round-trip (known, none, unknown)', () => {
      const model = makeSanitizedModel();
      model.bolts = 0xffffffff; // (none)
      model.ring2 = 0x00abcdef; // unknown id
      populateForm(model, undefined, undefined);

      expect(byId('leftHand1').textContent).toBe('Weapon 5');
      expect(byId('leftHand1').dataset.id).toBe(String(WEAPON_IDS[5]));

      const boltsSpan = byId('bolts');
      expect(boltsSpan.textContent).toBe('(none)');
      expect(boltsSpan.dataset.id).toBe(String(0xffffffff));

      expect(byId('ring2').textContent).toBe('Unknown (0x00ABCDEF)');
      expect(byId('ring2').dataset.id).toBe(String(0x00abcdef));

      const collected = /** @type {any} */ (collectForm());
      expect(collected.leftHand1).toBe(WEAPON_IDS[5]);
      expect(collected.bolts).toBe(0xffffffff >>> 0);
      expect(collected.ring2).toBe(0x00abcdef);
    });
  });

  // populateForm routes every category to its renderer; collectForm reassembles
  // them. The renderers/collectors themselves are unit-tested per module.
  describe('populateForm renders and collects all categories', () => {
    test('renders weapons/armor/rings/goods/spells/deposit rows with _ref', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);

      expect(qsa('table.inv-table[data-category="weapons"] tbody tr').length).toBe(1);
      expect(qsa('table.inv-table[data-category="armor"] tbody tr').length).toBe(1);
      expect(qsa('table.inv-table[data-category="rings"] tbody tr').length).toBe(1);
      expect(qsa('table.inv-table[data-category="goods"] tbody tr').length).toBe(1);
      expect(qsa('#spellsTableBody tbody tr').length).toBe(1);
      expect(qsa('table.dep-table[data-category="weapons"] tbody tr').length).toBe(1);
      expect(qsa('table.dep-table[data-category="goods"] tbody tr').length).toBe(1);

      // _ref token passes through for inventory rows.
      expect(qs('table.inv-table[data-category="weapons"] tbody tr').dataset.ref).toBe('inv:0');
    });

    test('collected inventory/deposit carry the right fields, no binary internals', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      const collected = /** @type {any} */ (collectForm());

      expect(collected.weapons[0]._ref).toBe('inv:0');
      expect(collected.weapons[0].misc2).toBe(0x01000000);
      expect(collected.deposit[0].unknown1).toBe(0);
      expect(collected.deposit[0].sortOrder).toBe(0x00010000);
      expect(collected.deposit[0].flags).toEqual([0x21, 0, 0, 0, 0, 0x01, 0x2c]);

      for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
        const recs = /** @type {Record<string, Array<Record<string, unknown>>>} */ (
          /** @type {unknown} */ (collected)
        )[cat];
        for (const rec of recs) {
          expect(rec).not.toHaveProperty('_slot');
          expect(rec).not.toHaveProperty('idx1');
          expect(rec).not.toHaveProperty('idx2');
        }
      }
      for (const d of collected.deposit) {
        expect(d).not.toHaveProperty('_ref');
      }
    });
  });

  describe('soft-delete reflects in collectForm across categories', () => {
    test('deleting then undeleting a row updates collection', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      row.querySelector('.row-del').click();
      expect(/** @type {any} */ (collectForm()).weapons).toHaveLength(0);

      row.querySelector('.row-del').click(); // undelete
      const collected = /** @type {any} */ (collectForm());
      expect(collected.weapons).toHaveLength(1);
      expect(collected.weapons[0]._ref).toBe('inv:0');
    });

    test('soft-delete excludes spells and deposit from collection', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);

      qs('#spellsTableBody tbody tr').querySelector('.row-del').click();
      expect(/** @type {any} */ (collectForm()).spells).toHaveLength(0);

      qs('table.dep-table[data-category="weapons"] tbody tr').querySelector('.row-del').click();
      expect(/** @type {any} */ (collectForm()).deposit).toHaveLength(1); // only the goods one remains
    });
  });

  // Cross-module: undeleting a counted-item row whose value reverted onto
  // another row's selection runs resolveDuplicateOnUndelete (select-helpers),
  // which hard-deletes new duplicate rows or auto soft-deletes existing ones.
  // The per-row soft-delete/revert machinery is unit-tested in select-helpers;
  // only the end-to-end duplicate-resolution flow lives here.
  describe('undelete resolves counted-item duplicates', () => {
    function goodsAddButton() {
      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'goods';
      btn.dataset.goodsType = '9';
      document.body.appendChild(btn);
      setupAddRowButtons();
      return btn;
    }

    test('edit → add new → soft-delete → undelete hard-deletes the duplicate new row', () => {
      const model = makeSanitizedModel();
      model.goods = [
        {
          _ref: 'inv:15',
          itemId: ITEM_IDS[0],
          count: 10,
          misc1: 0x0001,
          durability: 0,
          misc2: 0x01000000,
          ro_idx1: 15,
        },
      ];
      populateForm(model, undefined, undefined);

      const r1 = qs('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      const r1Sel = r1.querySelector('.inv-name');
      focusLazySelect(r1Sel);
      r1Sel.value = String(ITEM_IDS[1]);
      r1Sel.dispatchEvent(new Event('change', { bubbles: true }));

      goodsAddButton().click();
      const rows = qsa('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      const r2Sel = rows[1].querySelector('.inv-name');
      focusLazySelect(r2Sel);
      r2Sel.value = String(ITEM_IDS[0]);
      r2Sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Soft-delete R1 reverts it to ITEM_IDS[0], colliding with R2.
      r1.querySelector('.row-del').click();
      expect(r1.dataset.deleted).toBe('true');

      // Undelete R1 → R2 (the new row) is hard-deleted.
      r1.querySelector('.row-del').click();
      expect(r1.dataset.deleted).toBeUndefined();

      const remaining = qsa('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      expect(remaining.length).toBe(1);
      expect(remaining[0]).toBe(r1);
      expect(remaining[0].querySelector('.inv-name').value).toBe(String(ITEM_IDS[0]));

      const collected = /** @type {any} */ (collectForm());
      expect(collected.goods).toHaveLength(1);
      expect(collected.goods[0].itemId).toBe(ITEM_IDS[0]);
    });

    test('edit R1 → edit R2 → soft-delete R1 → undelete auto soft-deletes the existing R2', () => {
      const model = makeSanitizedModel();
      model.goods = [
        {
          _ref: 'inv:15',
          itemId: ITEM_IDS[0],
          count: 10,
          misc1: 0x0001,
          durability: 0,
          misc2: 0x01000000,
          ro_idx1: 15,
        },
        {
          _ref: 'inv:16',
          itemId: ITEM_IDS[2],
          count: 5,
          misc1: 0x0001,
          durability: 0,
          misc2: 0x01000000,
          ro_idx1: 16,
        },
      ];
      populateForm(model, undefined, undefined);

      const rows = qsa('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      const r1 = rows[0];
      const r2 = rows[1];

      const r1Sel = r1.querySelector('.inv-name');
      focusLazySelect(r1Sel);
      r1Sel.value = String(ITEM_IDS[1]);
      r1Sel.dispatchEvent(new Event('change', { bubbles: true }));

      const r2Sel = r2.querySelector('.inv-name');
      focusLazySelect(r2Sel);
      r2Sel.value = String(ITEM_IDS[0]);
      r2Sel.dispatchEvent(new Event('change', { bubbles: true }));

      r1.querySelector('.row-del').click();
      expect(r1.dataset.deleted).toBe('true');

      // Undelete R1 → R2 (existing row) is auto soft-deleted.
      r1.querySelector('.row-del').click();
      expect(r1.dataset.deleted).toBeUndefined();
      expect(r2.dataset.deleted).toBe('true');

      const collected = /** @type {any} */ (collectForm());
      expect(collected.goods).toHaveLength(1);
      expect(collected.goods[0].itemId).toBe(ITEM_IDS[0]);
    });
  });

  describe('NPC flag state matrix', () => {
    test.each([
      ['sageFreke', { friendly: true, hostile: false, dead: false }, 'friendly'],
      ['sageFreke', { friendly: false, hostile: true, dead: false }, 'hostile'],
      ['sageFreke', { friendly: false, hostile: false, dead: true }, 'dead'],
      ['sageFreke', { friendly: false, hostile: false, dead: false }, ''],
      ['thomas', { friendly: true, hostile: false, dead: false }, 'friendly'],
      ['thomas', { friendly: false, hostile: true, dead: false }, 'hostile'],
      ['thomas', { friendly: false, hostile: false, dead: true }, 'dead'],
      ['boldwin', { friendly: true, hostile: false, dead: false }, 'friendly'],
      ['boldwin', { friendly: false, hostile: true, dead: false }, 'hostile'],
      ['boldwin', { friendly: false, hostile: false, dead: true }, 'dead'],
    ])('%s renders %s', (npc, flags, expected) => {
      const model = makeSanitizedModel();
      model[npc] = flags;
      populateForm(model, undefined, undefined);
      expect(byId(npc).value).toBe(expected);
    });

    test('NPC objects undefined → select set to empty', () => {
      const model = makeSanitizedModel();
      delete model.sageFreke;
      delete model.thomas;
      delete model.boldwin;
      populateForm(model, undefined, undefined);
      expect(byId('sageFreke').value).toBe('');
      expect(byId('thomas').value).toBe('');
      expect(byId('boldwin').value).toBe('');
    });
  });

  // Cross-module: an inventory row change flows through setupEquipmentSync
  // (document-level change listener) into the read-only equipment spans.
  describe('equipment slot sync with inventory', () => {
    test('changing equipped item updates the equipment slot', () => {
      const model = makeSanitizedModel();
      populateForm(model, makeDisplay());
      setupEquipmentSync();

      const lh1 = byId('leftHand1');
      expect(lh1.dataset.id).toBe(String(WEAPON_IDS[5]));

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      sel.value = String(WEAPON_IDS[6]); // same type 2 (Shield)
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      expect(lh1.dataset.id).toBe(String(WEAPON_IDS[6]));
      expect(lh1.textContent).toBe('Weapon 6');
    });

    test('deleting equipped item clears the equipment slot', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      const lh1 = byId('leftHand1');
      expect(lh1.textContent).toBe('Weapon 5');

      qs('table.inv-table[data-category="weapons"] tbody tr').querySelector('.row-del').click();
      refreshEquipmentDisplay.flush();

      expect(lh1.textContent).toBe('(none)');
      expect(lh1.dataset.id).toBe(String(0xffffffff));
    });

    test('undeleting restores the equipment slot', () => {
      populateForm(makeSanitizedModel(), makeDisplay());
      const lh1 = byId('leftHand1');
      const delBtn = qs('table.inv-table[data-category="weapons"] tbody tr .row-del');

      delBtn.click();
      refreshEquipmentDisplay.flush();
      expect(lh1.textContent).toBe('(none)');

      delBtn.click();
      refreshEquipmentDisplay.flush();
      expect(lh1.textContent).toBe('Weapon 5');
      expect(lh1.dataset.id).toBe(String(WEAPON_IDS[5]));
    });

    test('equipment orig-id is tracked on initial render', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      expect(byId('leftHand1').dataset.origId).toBe(String(WEAPON_IDS[5]));
      expect(byId('ring1').dataset.origId).toBe(String(RING_IDS[0]));
    });

    test('changing non-equipped item does not affect equipment', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      setupEquipmentSync();
      const lh1 = byId('leftHand1');
      const originalId = lh1.dataset.id;

      const armorRow = qs('table.inv-table[data-category="armor"] tbody tr');
      const sel = armorRow.querySelector('.inv-name');
      sel.value = String(ARMOR_IDS[0]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      expect(lh1.dataset.id).toBe(originalId);
    });

    test('change equipped item then delete reverts equipment to original', () => {
      const model = makeSanitizedModel();
      model.rings = [
        {
          _ref: 'inv:10',
          itemId: RING_IDS[0],
          count: 1,
          misc1: 0x0013,
          durability: 0,
          misc2: 0x01000000,
        },
      ];
      const display = makeDisplay();
      display.equipmentPointers.ring1 = 10;
      populateForm(model, display);
      setupEquipmentSync();

      const ring1 = byId('ring1');
      expect(ring1.textContent).toBe('Ring 0');

      const row = qs('table.inv-table[data-category="rings"] tbody tr');
      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      sel.value = String(RING_IDS[1]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      expect(ring1.dataset.id).toBe(String(RING_IDS[1]));

      row.querySelector('.row-del').click();
      refreshEquipmentDisplay.flush();
      expect(ring1.textContent).toBe('(none)');

      row.querySelector('.row-del').click(); // undelete → restores original
      refreshEquipmentDisplay.flush();
      expect(ring1.textContent).toBe('Ring 0');
      expect(ring1.dataset.id).toBe(String(RING_IDS[0]));
    });
  });

  // Cross-module: changing an item select triggers setupDurabilitySync, which
  // reloads durability via the db lookup.
  describe('durability sync on item change', () => {
    test('changing weapon in inventory reloads durability from DB', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const durInput = row.querySelector('.inv-durability');
      expect(durInput.value).toBe('300');

      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      sel.value = String(WEAPON_IDS[0]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      expect(durInput.value).toBe('300');
    });

    test('changing ring resets durability to 0 in dataset (no durability input)', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      const row = qs('table.inv-table[data-category="rings"] tbody tr');
      expect(row.querySelector('.inv-durability')).toBeNull();

      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      sel.value = String(RING_IDS[2]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      expect(row.dataset.durability).toBe('0');
    });
  });

  describe('populateForm display + collectForm edge cases', () => {
    test('populateForm with display data sets equipment pointers', () => {
      populateForm(makeSanitizedModel(), makeDisplay());
      expect(byId('leftHand1').dataset.roIdx1).toBe('0');
      expect(byId('rightHand1').dataset.roIdx1).toBe('100');
    });

    test('populateForm with undefined display does not crash', () => {
      byId('leftHand1').removeAttribute('data-ro-idx1');
      populateForm(makeSanitizedModel(), undefined);
      expect(byId('vit').value).toBe('50');
      expect(byId('leftHand1').dataset.roIdx1).toBeUndefined();
    });

    test('populateForm tolerates a missing deposit array', () => {
      const model = makeSanitizedModel();
      delete model.deposit;
      expect(() => populateForm(model, undefined)).not.toThrow();
    });

    test('populateForm skips undefined equipment pointers and missing spans', () => {
      const display = makeDisplay();
      display.equipmentPointers.leftHand1 = undefined;
      display.equipmentPointers.nonExistentSlot = 5;
      expect(() => populateForm(makeSanitizedModel(), display)).not.toThrow();
    });

    test('collectForm treats a missing numeric field as 0', () => {
      populateForm(makeSanitizedModel(), makeDisplay());
      const vit = byId('vit');
      const parent = vit.parentNode;
      vit.remove();
      const m = /** @type {any} */ (collectForm());
      parent.appendChild(vit);
      expect(m).not.toBeNull();
      expect(m.vit).toBe(0);
    });

    test('collectForm defaults an empty hairstyle to 0', () => {
      populateForm(makeSanitizedModel(), makeDisplay());
      byId('hairstyle').value = '';
      expect(/** @type {any} */ (collectForm()).hairstyle).toBe(0);
    });
  });

  // Folder-level SFO fields and name validation, owned by collectFolderFields
  // / collectForm — not exercised by any per-module unit test.
  describe('collectFolderFields validation', () => {
    test('returns null for invalid accountId (not 32 hex chars)', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      byId('accountId').value = 'invalid';
      expect(collectFolderFields()).toBeNull();
    });

    test('returns null for accountId with wrong length', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      byId('accountId').value = 'ABCDEF';
      expect(collectFolderFields()).toBeNull();
    });

    test('accepts empty accountId', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      byId('accountId').value = '';
      const result = /** @type {any} */ (collectFolderFields());
      expect(result).not.toBeNull();
      expect(result.accountId).toBe('');
    });

    test('accepts valid 32-char hex accountId', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      const validHex = '0123456789abcdef0123456789abcdef';
      byId('accountId').value = validHex;
      const result = /** @type {any} */ (collectFolderFields());
      expect(result).not.toBeNull();
      expect(result.accountId).toBe(validHex);
    });

    test('trims whitespace from accountId before validation', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      const validHex = '0123456789abcdef0123456789abcdef';
      byId('accountId').value = '  ' + validHex + '  ';
      const result = /** @type {any} */ (collectFolderFields());
      expect(result).not.toBeNull();
      expect(result.accountId).toBe(validHex);
    });

    test('returns null for name exceeding 16 characters', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      byId('name').value = 'A'.repeat(17);
      expect(collectForm()).toBeNull();
    });

    test('returns null for name with control characters', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      byId('name').value = 'Test\u0001Char';
      expect(collectForm()).toBeNull();
    });
  });

  describe('getNumClamped via collectForm', () => {
    test('clamps vit to max=99', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      const inp = byId('vit');
      inp.min = '0';
      inp.max = '99';
      inp.value = '150';
      expect(/** @type {any} */ (collectForm()).vit).toBe(99);
    });

    test('clamps vit to min=0', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      const inp = byId('vit');
      inp.min = '0';
      inp.max = '99';
      inp.value = '-5';
      expect(/** @type {any} */ (collectForm()).vit).toBe(0);
    });

    test('profileNum is NOT clamped (SKIP_CLAMP_IDS)', () => {
      populateForm(makeSanitizedModel(), undefined, undefined);
      byId('profileNum').value = '300';
      expect(() => collectForm()).not.toThrow();
    });
  });
});
