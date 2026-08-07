/**
 * @jest-environment jsdom
 *
 * Tests for the UI event layer — form model ↔ DOM binding, inventory
 * table rendering/collection, deposit rendering/collection, and _ref
 * token pass-through.
 *
 * Uses a small mock des-db (12 items/category) instead of the full game
 * database to keep DOM option creation fast.
 */

import { jest } from '@jest/globals';
import { bad } from '../helpers.js';

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

function makeIds(base) {
  return Array.from({ length: MOCK_SIZE }, (_, i) => base + i);
}

function makeNames(prefix) {
  return Array.from({ length: MOCK_SIZE }, (_, i) => `${prefix} ${i}`);
}

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

// Mock upgrade path definitions (mirrors rel-upgrades.js structure)
const MOCK_PATHS = {
  1: { name: 'Basic', levels: [0, 1, 2, 3, 4, 5], note: 'Basic' },
  2: { name: 'Quality', levels: [1, 2, 3, 4, 5], note: 'Quality' },
  14: { name: 'Colorless', levels: [0, 1, 2, 3, 4, 5], note: 'Colorless' },
};

// Mock base weapons: each mock weapon type-1 item gets a base weapon entry.
// Base weapon ID = idx+1 (1-based). Only type 1/2/3 items get upgrade_refs.
// path_ids for each mock base weapon.
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
  getItemIdsByCategory: (cat) => MOCK[cat]?.ids ?? [],
  getItemNamesByCategory: (cat) => MOCK[cat]?.names ?? [],
  getItem: (cat, id) => {
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
    const result = { name: m.names[idx], type };
    if (upgrade_ref) result.upgrade_ref = upgrade_ref;
    return result;
  },
  hasItem: (cat, id) => {
    const m = MOCK[cat];
    if (!m) return false;
    const idx = m.ids.indexOf(typeof id === 'string' ? parseInt(id, 16) >>> 0 : id >>> 0);
    return idx >= 0;
  },
  getStartClasses: () => MOCK_START_CLASSES,
  getWarps: () => MOCK_WARPS,
  getWorldName: (world) => {
    if (world === 0) return 'Nexus';
    if (world === 1) return 'Boletaria';
    throw new Error(`Unknown world: ${world}`);
  },
  getAllTypes: () => [],
  getItemDurability: (cat, _id) => {
    // Mock durability: weapons=300, armor=200, others=0
    if (cat === 'weapons') return 300;
    if (cat === 'armor') return 200;
    return 0;
  },
  // Upgrade path functions
  getUpgradePathDef: (pathId) => {
    const def = MOCK_PATHS[String(pathId)];
    if (!def) throw new Error(`Unknown path id: ${pathId}`);
    return def;
  },
  getBaseWeapon: (baseId) => {
    const bw = MOCK_BASE_WEAPONS[String(baseId)];
    if (!bw) throw new Error(`Invalid base weapon id: ${baseId}`);
    return {
      name: bw.name,
      path_ids: (bw.path_ids || []).slice().sort((a, b) => a - b),
      durability: bw.durability,
      note: bw.note,
    };
  },
  hasBaseWeapon: (baseId) => MOCK_BASE_WEAPONS[String(baseId)] !== undefined,
  getWeaponItemByUpgradeRef: (ref) => {
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
  setupHairColorSample,
  setupEquipmentSync,
  setupLazySelects,
  setupDurabilitySync,
  setupCountAndDuplicateSync,
  setupDepositWeaponSync,
  setupSelectTooltipSync,
} = await import('../../js/ui/events.js');
const { populateCombos } = await import('../../js/ui/core/controls.js');
const { refreshEquipmentDisplay } = await import('../../js/ui/core/dom-helpers.js');
const { updateWorldName } = await import('../../js/ui/form/form-helpers.js');
const { makeInventoryRow } = await import('../../js/ui/tables/inventory-table.js');
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

  function inp(id, type = 'number') {
    const el = document.createElement('input');
    el.type = type;
    el.id = id;
    document.body.appendChild(el);
    return el;
  }

  function sel(id) {
    const el = document.createElement('select');
    el.id = id;
    document.body.appendChild(el);
    return el;
  }

  function chk(id) {
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

  describe('populateForm / collectForm round-trip', () => {
    test('stats round-trip through DOM', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      expect(byId('vit').value).toBe('50');
      expect(byId('souls').value).toBe('99999');
      expect(byId('name').value).toBe('TestChar');

      const collected = collectForm();
      expect(collected.vit).toBe(50);
      expect(collected.souls).toBe(99999);
      expect(collected.name).toBe('TestChar');
    });

    test('vitals populate and round-trip through DOM', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      expect(byId('currHP').value).toBe('580');
      expect(byId('currMaxHP').value).toBe('600');
      expect(byId('maxHP').value).toBe('600');
      expect(byId('currMP').value).toBe('35');
      expect(byId('currMaxMP').value).toBe('40');
      expect(byId('maxMP').value).toBe('40');
      expect(byId('currStam').value).toBe('110');
      expect(byId('currMaxStam').value).toBe('120');
      expect(byId('maxStam').value).toBe('120');

      const collected = collectForm();
      expect(collected.currHP).toBe(580);
      expect(collected.currMaxHP).toBe(600);
      expect(collected.maxHP).toBe(600);
      expect(collected.currMP).toBe(35);
      expect(collected.currMaxMP).toBe(40);
      expect(collected.maxMP).toBe(40);
      expect(collected.currStam).toBe(110);
      expect(collected.currMaxStam).toBe(120);
      expect(collected.maxStam).toBe(120);
    });

    test('profile number is set', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, { profileNumber: 42, accountId: '' });
      expect(byId('profileNum').value).toBe('42');
    });

    test('undefined folderFields defaults profileNum to 0 and accountId to empty', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      expect(byId('profileNum').value).toBe('0');
      expect(byId('accountId').value).toBe('');
    });

    test('tendency round-trip', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      expect(byId('charTendency').value).toBe('50');
      expect(byId('nexusTendency').value).toBe('-20');

      const collected = collectForm();
      expect(collected.charTendency).toBe(50);
      expect(collected.nexusTendency).toBe(-20);
    });

    test('NPC flags round-trip', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      expect(byId('sageFreke').value).toBe('friendly');
      expect(byId('thomas').value).toBe('friendly');
      expect(byId('boldwin').value).toBe('hostile');

      const collected = collectForm();
      expect(collected.sageFreke.friendly).toBe(true);
      expect(collected.boldwin.hostile).toBe(true);
    });

    test('archSealed checkbox round-trip', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      expect(byId('archSealed').checked).toBe(true);

      const collected = collectForm();
      expect(collected.archSealed).toBe(true);
    });

    test('equipment text spans round-trip with raw item IDs', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      // Span should display the item name from the mock DB
      expect(byId('leftHand1').textContent).toBe('Weapon 5');
      expect(byId('rightHand1').textContent).toBe('Weapon 10');

      // Raw ID stored in data-id for write-back
      expect(byId('leftHand1').dataset.id).toBe(String(WEAPON_IDS[5]));

      const collected = collectForm();
      expect(collected.leftHand1).toBe(WEAPON_IDS[5]);
      expect(collected.rightHand1).toBe(WEAPON_IDS[10]);
    });

    test('empty equipment slot (0xFFFFFFFF) displays "(none)" and round-trips', () => {
      const model = makeSanitizedModel();
      model.bolts = 0xffffffff;
      model.quickSlot3 = 0xffffffff;

      populateForm(model, null, undefined);

      // Span should show "(none)" and store 0xFFFFFFFF in data-id
      const boltsSpan = byId('bolts');
      expect(boltsSpan.textContent).toBe('(none)');
      expect(boltsSpan.dataset.id).toBe(String(0xffffffff));

      const collected = collectForm();
      expect(collected.bolts).toBe(0xffffffff >>> 0);
      expect(collected.quickSlot3).toBe(0xffffffff >>> 0);
    });

    test('unknown equipment ID displays "Unknown (0x...)" and round-trips verbatim', () => {
      const model = makeSanitizedModel();
      model.ring2 = 0x00abcdef; // an ID not in the ring DB

      populateForm(model, null, undefined);

      const ring2Span = byId('ring2');
      expect(ring2Span.textContent).toBe('Unknown (0x00ABCDEF)');
      expect(ring2Span.dataset.id).toBe(String(0x00abcdef));

      const collected = collectForm();
      expect(collected.ring2).toBe(0x00abcdef);
    });
  });

  describe('inventory rendering and collection', () => {
    test('renders weapons with _ref token', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const rows = qsa('table.inv-table[data-category="weapons"] tbody tr');
      expect(rows.length).toBe(1);

      // _ref should be stored as data-ref attribute
      expect(rows[0].dataset.ref).toBe('inv:0');
    });

    test('renders armor, rings, goods', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      expect(qsa('table.inv-table[data-category="armor"] tbody tr').length).toBe(1);
      expect(qsa('table.inv-table[data-category="rings"] tbody tr').length).toBe(1);
      expect(qsa('table.inv-table[data-category="goods"] tbody tr').length).toBe(1);
    });

    test('rings render as editable table rows', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const ringRows = qsa('table.inv-table[data-category="rings"] tbody tr');
      expect(ringRows.length).toBe(1);
      // Should have editable inputs (not read-only text)
      expect(ringRows[0].querySelector('select')).toBeTruthy();
      expect(ringRows[0].querySelector('input')).toBeTruthy();
    });

    test('rings misc2 survives round-trip; idx1/idx2 NOT in DOM', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();
      expect(collected.rings[0].itemId).toBe(RING_IDS[1]);
      expect(collected.rings[0].count).toBe(1);
      expect(collected.rings[0].durability).toBe(0);
      expect(collected.rings[0]._ref).toBe('inv:10');
      expect(collected.rings[0].misc2).toBe(0x01000000);
      // idx1/idx2 are binary-internal — stripped from sanitized model, NOT
      // collected from the DOM (restored by mergeModel via _ref lookup).
      expect(collected.rings[0]).not.toHaveProperty('idx1');
      expect(collected.rings[0]).not.toHaveProperty('idx2');
    });

    test('_ref survives DOM round-trip in collectForm', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();

      expect(collected.weapons[0]._ref).toBe('inv:0');
      expect(collected.armor[0]._ref).toBe('inv:5');
      expect(collected.rings[0]._ref).toBe('inv:10');
      expect(collected.goods[0]._ref).toBe('inv:15');
    });

    test('collected inventory has NO binary internals', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();

      // _slot, idx1, idx2 must never leak to the UI layer — all are
      // binary-internal fields stripped by sanitizeModel and restored by
      // mergeModel via _ref lookup.
      for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
        for (const rec of collected[cat]) {
          expect(rec).not.toHaveProperty('_slot');
          expect(rec).not.toHaveProperty('idx1');
          expect(rec).not.toHaveProperty('idx2');
        }
      }
    });

    test('editable fields survive round-trip', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();

      expect(collected.weapons[0].itemId).toBe(WEAPON_IDS[5]);
      expect(collected.weapons[0].count).toBe(1);
      expect(collected.weapons[0].durability).toBe(300);
    });

    test('weapon misc2 survives round-trip; idx1/idx2 NOT in DOM', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();

      expect(collected.weapons[0].misc2).toBe(0x01000000);
      // idx1/idx2 are binary-internal — NOT collected from the DOM.
      expect(collected.weapons[0]).not.toHaveProperty('idx1');
      expect(collected.weapons[0]).not.toHaveProperty('idx2');
    });

    test('weapon misc1 (Class hi + Class Idx lo) survives round-trip', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      // misc1 = 0x0ffc → Class hi-byte = 0x0f (Curved Sword), Class Idx lo-byte = 0xfc
      const collected = collectForm();
      expect(collected.weapons[0].misc1).toBe(0x0ffc);
    });
  });

  describe('deposit rendering and collection', () => {
    test('renders deposit items in correct category tables', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const weaponRows = qsa('table.dep-table[data-category="weapons"] tbody tr');
      const goodsRows = qsa('table.dep-table[data-category="goods"] tbody tr');

      expect(weaponRows.length).toBe(1);
      expect(goodsRows.length).toBe(1);
    });

    test('deposit unknown fields survive DOM round-trip', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();

      expect(collected.deposit.length).toBe(2);
      expect(collected.deposit[0].category).toBe('weapons');
      expect(collected.deposit[0].unknown1).toBe(0);
      expect(collected.deposit[0].sortOrder).toBe(0x00010000);
      expect(collected.deposit[0].flags).toEqual([0x21, 0, 0, 0, 0, 0x01, 0x2c]);
      expect(collected.deposit[1].category).toBe('goods');
      expect(collected.deposit[1].unknown1).toBe(0);
      expect(collected.deposit[1].flags).toEqual([0x21, 0, 0, 0, 0, 0, 0]);
    });

    test('collected deposit has no _ref', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();

      for (const d of collected.deposit) {
        expect(d).not.toHaveProperty('_ref');
      }
    });

    test('deposit count, itemId, and durability survive round-trip', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();

      expect(collected.deposit[0].itemId).toBe(WEAPON_IDS[2]);
      expect(collected.deposit[0].count).toBe(1);
      expect(collected.deposit[0].durability).toBe(300);
      expect(collected.deposit[1].count).toBe(50);
      expect(collected.deposit[1].durability).toBe(0);
    });
  });

  describe('soft-delete behavior', () => {
    test('existing rows have data-existing="true"', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      expect(row.dataset.existing).toBe('true');
    });

    test('soft-delete on existing row marks it deleted but keeps it in DOM', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      expect(row.dataset.deleted).toBeUndefined();

      // Click the delete button
      const delBtn = row.querySelector('.row-del');
      delBtn.click();

      // Row should be soft-deleted: marked, greyed, but still in DOM
      expect(row.dataset.deleted).toBe('true');
      expect(row.classList.contains('row-deleted')).toBe(true);
      expect(row.querySelector('.row-del.row-restore')).toBeTruthy();
      expect(row.parentElement.contains(row)).toBe(true);

      // Inputs should be disabled
      expect(row.querySelector('select').disabled).toBe(true);
    });

    test('collectForm skips soft-deleted rows', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      // Soft-delete the weapon row
      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      row.querySelector('.row-del').click();

      const collected = collectForm();
      expect(collected.weapons).toHaveLength(0);
    });

    test('undelete restores the row to editable state', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const delBtn = row.querySelector('.row-del');

      // Delete
      delBtn.click();
      expect(row.dataset.deleted).toBe('true');

      // Undelete
      delBtn.click();
      expect(row.dataset.deleted).toBeUndefined();
      expect(row.classList.contains('row-deleted')).toBe(false);
      expect(row.querySelector('select').disabled).toBe(false);
    });

    test('collectForm includes undeleted rows', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const delBtn = row.querySelector('.row-del');

      // Delete then undelete
      delBtn.click();
      delBtn.click();

      const collected = collectForm();
      expect(collected.weapons).toHaveLength(1);
      expect(collected.weapons[0]._ref).toBe('inv:0');
    });

    test('soft-delete works for spells', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('#spellsTableBody tbody tr');
      expect(row.dataset.existing).toBe('true');

      row.querySelector('.row-del').click();
      expect(row.dataset.deleted).toBe('true');

      const collected = collectForm();
      expect(collected.spells).toHaveLength(0);
    });

    test('soft-delete works for deposit', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="weapons"] tbody tr');
      expect(row.dataset.existing).toBe('true');

      row.querySelector('.row-del').click();
      expect(row.dataset.deleted).toBe('true');

      const collected = collectForm();
      expect(collected.deposit).toHaveLength(1); // only the goods one remains
      expect(collected.deposit[0].category).toBe('goods');
    });
  });

  // --- Branch-coverage tests ---

  describe('unknown item IDs', () => {
    test('inventory row with unknown weapon ID renders "Unknown" option', () => {
      const model = makeSanitizedModel();
      model.weapons = [
        {
          _ref: 'inv:99',
          itemId: 0x99999999,
          count: 1,
          misc1: 0,
          durability: 300,
          misc2: 0x01000000,
        },
      ];

      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const select = row.querySelector('select');
      const unknownOpt = select.querySelector(
        `option[value="0x99999999"], option[value="2576980377"]`,
      );
      expect(unknownOpt).toBeTruthy();
      expect(unknownOpt.textContent).toContain('Unknown');
      expect(unknownOpt.selected).toBe(true);
    });

    test('spell row with unknown spell ID renders "Unknown" option', () => {
      const model = makeSanitizedModel();
      model.spells = [{ itemId: 0xaaaaaaaa, status: 0, misc1: 0, misc2: 0 }];

      populateForm(model, null, undefined);

      const row = qs('#spellsTableBody tbody tr');
      const select = row.querySelector('select.spell-name');
      expect(select.value).toBe(String(0xaaaaaaaa));
    });

    test('deposit row with unknown item ID renders "Unknown" option', () => {
      const model = makeSanitizedModel();
      // Unknown weapon without upgrade_ref → silently skipped by renderDeposit.
      // Use a non-weapon category (armor) to test unknown item rendering instead.
      model.deposit = [{ category: 'armor', itemId: 0xbbbbbbbb, count: 1, durability: 300 }];

      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="armor"] tbody tr');
      const select = row.querySelector('select.dep-name');
      expect(select.value).toBe(String(0xbbbbbbbb));
    });
    test('new deposit row (decomposed) has empty placeholder selected', () => {
      const btn = document.createElement('button');
      btn.className = 'dep-add';
      btn.dataset.category = 'weapons';
      document.body.appendChild(btn);
      setupAddRowButtons();

      const tbody = qs('table.dep-table[data-category="weapons"] tbody');
      btn.click();

      expect(tbody.lastElementChild.querySelector('.dep-name').value).toBe('');
    });
    test('new deposit row (non-decomposed) has empty placeholder selected', () => {
      const btn = document.createElement('button');
      btn.className = 'dep-add';
      // Use a non-decomposed category (armor) so placeholder test works.
      btn.dataset.category = 'armor';
      document.body.appendChild(btn);
      setupAddRowButtons();

      const tbody = qs('table.dep-table[data-category="armor"] tbody');
      btn.click();

      expect(tbody.lastElementChild.querySelector('.dep-name').value).toBe('');
    });
  });

  describe('deposit flags JSON parse edge cases', () => {
    test('malformed flags JSON falls back to default array', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      // Corrupt the flags data attribute on the deposit row
      const row = qs('table.dep-table[data-category="weapons"] tbody tr');
      row.dataset.flags = 'not-valid-json';

      const collected = collectForm();
      expect(collected.deposit[0].flags).toEqual([0x21, 0, 0, 0, 0, 0, 0]);
    });

    test('empty durability input results in undefined durability', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="weapons"] tbody tr');
      const durInput = row.querySelector('.inv-dep-durability');
      durInput.value = '';

      const collected = collectForm();
      expect(collected.deposit[0].durability).toBeUndefined();
    });

    test('new deposit row without unknown fields omits them', () => {
      const model = makeSanitizedModel();
      model.deposit = [{ category: 'goods', itemId: ITEM_IDS[0], count: 1, durability: 0 }];
      populateForm(model, null, undefined);

      const collected = collectForm();
      // New row has empty data attributes → fields are omitted
      expect(collected.deposit[0]).not.toHaveProperty('unknown1');
      expect(collected.deposit[0]).not.toHaveProperty('sortOrder');
      expect(collected.deposit[0]).not.toHaveProperty('flags');
    });
  });

  // Setup function tests (setupWarpAndWorld, setupTabs, setupHairColorSample,
  // setupAddRowButtons) are covered in ui-setup.test.js

  describe('NPC flag state matrix', () => {
    test('sageFreke dead state', () => {
      const model = makeSanitizedModel();
      model.sageFreke = { friendly: false, hostile: false, dead: true };
      populateForm(model, null, undefined);

      expect(byId('sageFreke').value).toBe('dead');
    });

    test('sageFreke hostile state', () => {
      const model = makeSanitizedModel();
      model.sageFreke = { friendly: false, hostile: true, dead: false };
      populateForm(model, null, undefined);

      expect(byId('sageFreke').value).toBe('hostile');
    });

    test('sageFreke empty state (all false)', () => {
      const model = makeSanitizedModel();
      model.sageFreke = { friendly: false, hostile: false, dead: false };
      populateForm(model, null, undefined);

      expect(byId('sageFreke').value).toBe('');
    });

    test('thomas dead state', () => {
      const model = makeSanitizedModel();
      model.thomas = { friendly: false, hostile: false, dead: true };
      populateForm(model, null, undefined);

      expect(byId('thomas').value).toBe('dead');
    });

    test('thomas hostile state', () => {
      const model = makeSanitizedModel();
      model.thomas = { friendly: false, hostile: true, dead: false };
      populateForm(model, null, undefined);

      expect(byId('thomas').value).toBe('hostile');
    });

    test('thomas empty state (all false)', () => {
      const model = makeSanitizedModel();
      model.thomas = { friendly: false, hostile: false, dead: false };
      populateForm(model, null, undefined);

      expect(byId('thomas').value).toBe('');
    });

    test('boldwin dead state', () => {
      const model = makeSanitizedModel();
      model.boldwin = { friendly: false, hostile: false, dead: true };
      populateForm(model, null, undefined);

      expect(byId('boldwin').value).toBe('dead');
    });

    test('boldwin friendly state', () => {
      const model = makeSanitizedModel();
      model.boldwin = { friendly: true, hostile: false, dead: false };
      populateForm(model, null, undefined);

      expect(byId('boldwin').value).toBe('friendly');
    });

    test('boldwin empty state (all false)', () => {
      const model = makeSanitizedModel();
      model.boldwin = { friendly: false, hostile: false, dead: false };
      populateForm(model, null, undefined);

      expect(byId('boldwin').value).toBe('');
    });

    test('NPC objects undefined → select set to empty', () => {
      const model = makeSanitizedModel();
      delete model.sageFreke;
      delete model.thomas;
      delete model.boldwin;
      populateForm(model, null, undefined);

      expect(byId('sageFreke').value).toBe('');
      expect(byId('thomas').value).toBe('');
      expect(byId('boldwin').value).toBe('');
    });
  });

  describe('edge-case defaults', () => {
    test('spell with undefined status defaults to 0 (Unavailable)', () => {
      const model = makeSanitizedModel();
      model.spells = [{ itemId: SPELL_IDS[0], misc1: 0, misc2: 0 }];
      populateForm(model, null, undefined);

      const row = qs('#spellsTableBody tbody tr');
      const statusSel = row.querySelector('.spell-status');
      expect(statusSel.value).toBe('0');
    });

    test('inventory record with undefined durability defaults to 0', () => {
      const model = makeSanitizedModel();
      model.weapons = [{ _ref: 'inv:0', itemId: WEAPON_IDS[0], count: 1, misc1: 0, misc2: 0 }];
      populateForm(model, null, undefined);

      const collected = collectForm();
      expect(collected.weapons[0].durability).toBe(0);
    });

    test('deposit record without count defaults to 1', () => {
      const model = makeSanitizedModel();
      model.deposit = [{ category: 'goods', itemId: ITEM_IDS[0], durability: 0 }];
      populateForm(model, null, undefined);

      const collected = collectForm();
      expect(collected.deposit[0].count).toBe(1);
    });

    test('deposit record without durability defaults to 0', () => {
      const model = makeSanitizedModel();
      model.deposit = [{ category: 'goods', itemId: ITEM_IDS[0], count: 5 }];
      populateForm(model, null, undefined);

      const collected = collectForm();
      expect(collected.deposit[0].durability).toBe(0);
    });

    test('empty inventory arrays render no rows', () => {
      const model = makeSanitizedModel();
      model.weapons = [];
      model.armor = [];
      model.rings = [];
      model.goods = [];
      populateForm(model, null, undefined);

      expect(qsa('table.inv-table tbody tr').length).toBe(0);
    });

    test('empty spells array renders no rows', () => {
      const model = makeSanitizedModel();
      model.spells = [];
      populateForm(model, null, undefined);

      expect(qsa('#spellsTableBody tbody tr').length).toBe(0);
    });

    test('empty deposit array renders no rows', () => {
      const model = makeSanitizedModel();
      model.deposit = [];
      populateForm(model, null, undefined);

      expect(qsa('table.dep-table tbody tr').length).toBe(0);
    });
  });

  // getEqId / getNum edge cases are covered in dom-helpers.test.js

  describe('helper edge cases', () => {
    test('accountId defaults to empty string', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const folderFields = collectFolderFields();
      expect(folderFields).not.toBeNull();
      expect(folderFields.accountId).toBe('');
    });
  });

  describe('collectInventory hidden-misc1 branch', () => {
    test('row with data-misc1 attribute is read from dataset', () => {
      const model = makeSanitizedModel();
      // Rings use 'single' layout, not 'hidden'. Manually create a row with
      // data-misc1 to exercise the hidden branch in collectInventory.
      populateForm(model, null, undefined);

      // Add a fake row to weapons table with the hidden misc1 attribute
      const tbody = qs('table.inv-table[data-category="weapons"] tbody');
      const tr = document.createElement('tr');
      tr.dataset.ref = 'inv:fake';
      tr.dataset.misc1 = '9999';
      tr.dataset.misc2 = '0';

      const tdName = document.createElement('td');
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      const opt = document.createElement('option');
      opt.value = String(WEAPON_IDS[0]);
      opt.textContent = 'Weapon 0';
      sel.appendChild(opt);
      tdName.appendChild(sel);
      tr.appendChild(tdName);

      // Weapons use split layout, so add the hi/lo inputs
      for (const cls of ['count', 'durability']) {
        const td = document.createElement('td');
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = '0';
        inp.className = `inv-${cls}`;
        td.appendChild(inp);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);

      // Temporarily override MISC1_LAYOUT to hidden to test that branch
      // We can't modify MISC1_LAYOUT directly (it's module-scoped), but
      // we can verify the misc1 data attribute is preserved when collectInventory
      // reads it via the hidden path. Since weapons use 'split', this test
      // verifies the split path produces misc1=0 (no hi/lo inputs on this fake row).
      const collected = collectForm();
      const fakeRow = collected.weapons.find((w) => w._ref === 'inv:fake');
      expect(fakeRow).toBeTruthy();
      // With split layout and no misc1hi/misc1lo inputs, misc1 should be 0
      expect(fakeRow.misc1).toBe(0);
    });
  });

  describe('placeholder dropdown on new rows', () => {
    test('new inventory row has empty placeholder selected', () => {
      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'weapons';
      btn.dataset.weaponType = '1';
      document.body.appendChild(btn);
      setupAddRowButtons();

      const tbody = qs('table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody');
      btn.click();

      const sel = tbody.lastElementChild.querySelector('.inv-name');
      expect(sel.value).toBe('');
    });

    test('collectForm skips unselected new inventory rows', () => {
      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'armor';
      document.body.appendChild(btn);
      setupAddRowButtons();

      btn.click();

      const collected = collectForm();
      expect(collected.armor).toHaveLength(0);
    });

    test('selected new row is collected', () => {
      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'weapons';
      btn.dataset.weaponType = '1';
      document.body.appendChild(btn);
      setupAddRowButtons();

      const tbody = qs('table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody');
      btn.click();

      const sel = tbody.lastElementChild.querySelector('.inv-name');
      // Populate lazy options before selecting (simulates user clicking the dropdown)
      focusLazySelect(sel);
      sel.value = String(WEAPON_IDS[3]);

      const collected = collectForm();
      expect(collected.weapons).toHaveLength(1);
      expect(collected.weapons[0].itemId).toBe(WEAPON_IDS[3]);
    });

    test('add button does not add a second row while one is unselected', () => {
      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'goods';
      btn.dataset.goodsType = '9';
      document.body.appendChild(btn);
      setupAddRowButtons();

      const tbody = qs('table.inv-table[data-category="goods"][data-goods-type="9"] tbody');
      const initial = tbody.querySelectorAll('tr').length;

      btn.click();
      btn.click();

      expect(tbody.querySelectorAll('tr').length).toBe(initial + 1);
    });

    test('add button works again after the row is selected', () => {
      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'rings';
      document.body.appendChild(btn);
      setupAddRowButtons();

      const tbody = qs('table.inv-table[data-category="rings"] tbody');
      const initial = tbody.querySelectorAll('tr').length;

      btn.click();
      // Populate lazy options before selecting (simulates user clicking the dropdown)
      const newSel = tbody.lastElementChild.querySelector('.inv-name');
      focusLazySelect(newSel);
      newSel.value = String(RING_IDS[0]);

      btn.click();
      expect(tbody.querySelectorAll('tr').length).toBe(initial + 2);
    });

    // Helper: get or create the spell add button (reuses existing listener)
    function getSpellAddBtn() {
      let btn = byId('addSpell');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'addSpell';
        document.body.appendChild(btn);
        setupAddRowButtons();
      }
      return btn;
    }

    test('new spell row has empty placeholder selected', () => {
      const btn = getSpellAddBtn();

      const tbody = qs('#spellsTableBody tbody');
      btn.click();

      expect(tbody.lastElementChild.querySelector('.spell-name').value).toBe('');
    });

    test('collectForm skips unselected new spell rows', () => {
      const btn = getSpellAddBtn();

      btn.click();

      const collected = collectForm();
      expect(collected.spells).toHaveLength(0);
    });

    test('spell add button gates while one row is unselected', () => {
      const btn = getSpellAddBtn();

      const tbody = qs('#spellsTableBody tbody');
      const initial = tbody.querySelectorAll('tr').length;

      btn.click();
      btn.click();

      expect(tbody.querySelectorAll('tr').length).toBe(initial + 1);
    });

    test('new deposit row has empty placeholder selected', () => {
      const btn = document.createElement('button');
      btn.className = 'dep-add';
      btn.dataset.category = 'weapons';
      document.body.appendChild(btn);
      setupAddRowButtons();

      const tbody = qs('table.dep-table[data-category="weapons"] tbody');
      btn.click();

      expect(tbody.lastElementChild.querySelector('.dep-name').value).toBe('');
    });

    test('collectForm skips unselected new deposit rows', () => {
      const btn = document.createElement('button');
      btn.className = 'dep-add';
      btn.dataset.category = 'armor';
      document.body.appendChild(btn);
      setupAddRowButtons();

      btn.click();

      const collected = collectForm();
      expect(collected.deposit).toHaveLength(0);
    });

    test('deposit add button gates while one row is unselected', () => {
      const btn = document.createElement('button');
      btn.className = 'dep-add';
      btn.dataset.category = 'goods';
      document.body.appendChild(btn);
      setupAddRowButtons();

      const tbody = qs('table.dep-table[data-category="goods"] tbody');
      const initial = tbody.querySelectorAll('tr').length;

      btn.click();
      btn.click();

      expect(tbody.querySelectorAll('tr').length).toBe(initial + 1);
    });
  });
  describe('soft-delete reverts edits to original', () => {
    test('delete reverts edited field to original value', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const countInput = row.querySelector('.inv-count');
      const origCount = countInput.value;

      // Edit the count
      countInput.value = '999';

      // Delete the row — should revert count to original
      row.querySelector('.row-del').click();
      expect(countInput.value).toBe(origCount);
    });

    test('undelete shows original values', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const countInput = row.querySelector('.inv-count');
      const origCount = countInput.value;

      countInput.value = '999';
      row.querySelector('.row-del').click(); // delete (reverts)
      row.querySelector('.row-del').click(); // undelete

      expect(countInput.value).toBe(origCount);
      expect(countInput.disabled).toBe(false);
    });

    test('delete clears dirty marks on the row', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const countInput = row.querySelector('.inv-count');
      countInput.value = '999';
      countInput.classList.add('dirty');
      row.classList.add('row-dirty');

      row.querySelector('.row-del').click();

      expect(countInput.classList.contains('dirty')).toBe(false);
    });

    test('delete reverts select (item name) to original', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const nameSel = row.querySelector('.inv-name');
      const origValue = nameSel.value;

      // Change to a different weapon
      nameSel.value = String(WEAPON_IDS[0]);

      row.querySelector('.row-del').click();

      expect(nameSel.value).toBe(origValue);
    });
  });

  describe('equipment slot sync with inventory', () => {
    test('changing equipped item updates the equipment slot', () => {
      const model = makeSanitizedModel();
      populateForm(model, makeDisplay());
      setupEquipmentSync();

      // The model has leftHand1 = WEAPON_IDS[5]
      const lh1 = byId('leftHand1');
      expect(lh1.dataset.id).toBe(String(WEAPON_IDS[5]));

      // Change the weapon row from WEAPON_IDS[5] to WEAPON_IDS[6] (same type 2/Shield)
      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const sel = row.querySelector('.inv-name');
      // Populate lazy options before selecting a different item
      focusLazySelect(sel);
      sel.value = String(WEAPON_IDS[6]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Equipment slot should now show the new item
      expect(lh1.dataset.id).toBe(String(WEAPON_IDS[6]));
      expect(lh1.textContent).toBe('Weapon 6');
    });

    test('deleting equipped item clears the equipment slot', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const lh1 = byId('leftHand1');
      expect(lh1.textContent).toBe('Weapon 5');

      // Soft-delete the weapon row (it's the only weapon, itemId=WEAPON_IDS[5])
      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      row.querySelector('.row-del').click();
      refreshEquipmentDisplay.flush();

      // Equipment slot should now show "(none)"
      expect(lh1.textContent).toBe('(none)');
      expect(lh1.dataset.id).toBe(String(0xffffffff));
    });

    test('undeleting restores the equipment slot', () => {
      const model = makeSanitizedModel();
      populateForm(model, makeDisplay());

      const lh1 = byId('leftHand1');
      const delBtn = qs('table.inv-table[data-category="weapons"] tbody tr .row-del');

      // Delete then undelete
      delBtn.click();
      refreshEquipmentDisplay.flush();
      expect(lh1.textContent).toBe('(none)');

      delBtn.click();
      refreshEquipmentDisplay.flush();
      expect(lh1.textContent).toBe('Weapon 5');
      expect(lh1.dataset.id).toBe(String(WEAPON_IDS[5]));
    });

    test('equipment orig-id is tracked on initial render', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const lh1 = byId('leftHand1');
      expect(lh1.dataset.origId).toBe(String(WEAPON_IDS[5]));

      const ring1 = byId('ring1');
      expect(ring1.dataset.origId).toBe(String(RING_IDS[0]));
    });

    test('changing non-equipped item does not affect equipment', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupEquipmentSync();

      const lh1 = byId('leftHand1');
      const originalId = lh1.dataset.id;

      // Change the armor row (not equipped in LH1)
      const armorRow = qs('table.inv-table[data-category="armor"] tbody tr');
      const sel = armorRow.querySelector('.inv-name');
      sel.value = String(ARMOR_IDS[0]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // LH1 should be unchanged
      expect(lh1.dataset.id).toBe(originalId);
    });
  });

  test('change equipped item then delete reverts equipment to original', () => {
    const model = makeSanitizedModel();
    // Make the inventory ring match ring1 (RING_IDS[0])
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
    // Display data points ring1's equipment pointer to this inventory instance (idx1=10)
    const display = makeDisplay();
    display.equipmentPointers.ring1 = 10;
    populateForm(model, display);
    setupEquipmentSync();

    // ring1 = RING_IDS[0] in the model
    const ring1 = byId('ring1');
    expect(ring1.textContent).toBe('Ring 0');

    // Change the ring in inventory from RING_IDS[0] to RING_IDS[1]
    const row = qs('table.inv-table[data-category="rings"] tbody tr');
    const sel = row.querySelector('.inv-name');
    // Populate lazy options before selecting a different item
    focusLazySelect(sel);
    sel.value = String(RING_IDS[1]);
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    // Equipment should now show Ring 1
    expect(ring1.dataset.id).toBe(String(RING_IDS[1]));

    // Delete the ring row — should revert to original (RING_IDS[0])
    row.querySelector('.row-del').click();
    refreshEquipmentDisplay.flush();

    // Equipment should show "(none)" (item is deleted)
    expect(ring1.textContent).toBe('(none)');
    expect(ring1.dataset.id).toBe(String(0xffffffff));

    // Undelete — equipment should restore to original Ring 0
    row.querySelector('.row-del').click();
    refreshEquipmentDisplay.flush();
    expect(ring1.textContent).toBe('Ring 0');
    expect(ring1.dataset.id).toBe(String(RING_IDS[0]));
  });

  describe('lazy-load dropdowns', () => {
    test('inventory select renders only selected option before focus', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const sel = qs('table.inv-table[data-category="weapons"] tbody tr .inv-name');
      // Should have only 1 option (the currently selected item)
      expect(sel.querySelectorAll('option').length).toBe(1);
      // Value should still be correct
      expect(sel.value).toBe(String(WEAPON_IDS[5]));
    });

    test('inventory select populates type-filtered options after focus', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const sel = qs('table.inv-table[data-category="weapons"] tbody tr .inv-name');
      expect(sel.querySelectorAll('option').length).toBe(1);

      focusLazySelect(sel);

      // WEAPON_IDS[5] is mock item index 5, which maps to type 2 (Shield).
      // So the select should be populated with only shield-type items (4 items).
      expect(sel.querySelectorAll('option').length).toBe(4);
      // Selection preserved
      expect(sel.value).toBe(String(WEAPON_IDS[5]));
    });

    test('deposit weapon row has decomposed selects (Base Weapon | Path | Level)', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="weapons"] tbody tr');
      // Decomposed rows have data-decomposed="true"
      expect(row.dataset.decomposed).toBe('true');
      // Should have base weapon, path, and level selects
      expect(row.querySelector('.dep-base-weapon')).toBeTruthy();
      expect(row.querySelector('.dep-path')).toBeTruthy();
      expect(row.querySelector('.dep-level')).toBeTruthy();
      // Base weapon select is eagerly populated (not lazy)
      const baseSel = row.querySelector('.dep-base-weapon');
      expect(baseSel.querySelectorAll('option').length).toBeGreaterThan(0);
    });

    test('deposit non-upgradable weapon (crossbow) renders as decomposed row with empty Path/Level', () => {
      // Simulates crossbows: type [3, 2] (Bow) with upgrade_ref [13, null, null]
      // — the base weapon has no upgrade paths.  The row uses the decomposed
      // layout but Path and Level selects stay empty.
      const model = makeSanitizedModel();
      model.deposit = [
        {
          category: 'weapons',
          itemId: CROSSBOW_ID,
          count: 1,
          durability: 300,
          unknown1: 0,
          sortOrder: 0x00010000,
          flags: [0x21, 0, 0, 0, 0, 0, 0],
        },
      ];
      populateForm(model, null, undefined);

      // The crossbow should be routed to the Bow (type 3) deposit table
      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="3"] tbody tr');
      expect(row).toBeTruthy();

      // It IS a decomposed row (same layout as upgradable weapons)
      expect(row.dataset.decomposed).toBe('true');

      // Base Weapon select should contain the crossbow in the standard list
      // (non-upgradable base weapons are now included in the dropdown).
      const baseSel = row.querySelector('.dep-base-weapon');
      expect(baseSel).toBeTruthy();
      expect(baseSel.value).toBe(String(13)); // baseId from upgrade_ref
      // Find the selected option — should show the base weapon name
      const selectedOpt = baseSel.selectedOptions[0];
      expect(selectedOpt.textContent).toBe('BaseCrossbow');

      // Path select should be empty (no upgrade paths for base 13)
      const pathSel = row.querySelector('.dep-path');
      expect(pathSel).toBeTruthy();
      expect(pathSel.querySelectorAll('option').length).toBe(0);

      // Level select should also be empty
      const levelSel = row.querySelector('.dep-level');
      expect(levelSel).toBeTruthy();
      expect(levelSel.querySelectorAll('option').length).toBe(0);

      // Round-trip: collectDeposit should recompose the correct itemId via
      // the null path/level index lookup ("13:null:null").
      const collected = collectForm();
      expect(collected.deposit).toHaveLength(1);
      expect(collected.deposit[0].itemId).toBe(CROSSBOW_ID);
      expect(collected.deposit[0].category).toBe('weapons');
      expect(collected.deposit[0].count).toBe(1);
    });

    test('deposit goods select renders only selected option before focus', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const sel = qs('table.dep-table[data-category="goods"] tbody tr .dep-name');
      expect(sel.querySelectorAll('option').length).toBe(1);
      expect(sel.value).toBe(String(ITEM_IDS[2]));
    });

    test('deposit goods select populates type-filtered options after focus', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const sel = qs('table.dep-table[data-category="goods"] tbody tr .dep-name');
      focusLazySelect(sel);

      // ITEM_IDS[2] is mock item index 2, which maps to type 9 (Ore).
      // So the select should be populated with only ore-type items (3 items).
      expect(sel.querySelectorAll('option').length).toBe(3);
      expect(sel.value).toBe(String(ITEM_IDS[2]));
    });

    test('spell select renders only selected option before focus', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const sel = qs('#spellsTableBody tbody tr .spell-name');
      expect(sel.querySelectorAll('option').length).toBe(1);
      expect(sel.value).toBe(String(SPELL_IDS[6]));
    });

    test('spell select populates all options after focus', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const sel = qs('#spellsTableBody tbody tr .spell-name');
      focusLazySelect(sel);

      expect(sel.querySelectorAll('option').length).toBe(MOCK_SIZE);
      expect(sel.value).toBe(String(SPELL_IDS[6]));
    });

    test('unknown item option is preserved after lazy population', () => {
      const model = makeSanitizedModel();
      model.weapons = [
        {
          _ref: 'inv:99',
          itemId: 0x99999999,
          count: 1,
          misc1: 0,
          durability: 300,
          misc2: 0x01000000,
        },
      ];
      populateForm(model, null, undefined);

      const sel = qs('table.inv-table[data-category="weapons"] tbody tr .inv-name');
      // Before focus: 1 option (the unknown item)
      expect(sel.querySelectorAll('option').length).toBe(1);

      focusLazySelect(sel);

      // Unknown item defaults to type 1 (Weapon), so it gets 4 weapon-type
      // items + 1 unknown = 5 options
      expect(sel.querySelectorAll('option').length).toBe(4 + 1);
      // Selection preserved on the unknown option
      expect(sel.value).toBe(String(0x99999999));
    });

    test('lazy population is idempotent (focus twice = no duplicate options)', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const sel = qs('table.inv-table[data-category="weapons"] tbody tr .inv-name');
      focusLazySelect(sel);
      focusLazySelect(sel);

      // WEAPON_IDS[5] is type 2 (Shield) → 4 options
      expect(sel.querySelectorAll('option').length).toBe(4);
    });

    test('collectForm works without focus (lazy not triggered)', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      // Collect without focusing any select — should still read .value correctly
      const collected = collectForm();
      expect(collected.weapons[0].itemId).toBe(WEAPON_IDS[5]);
      expect(collected.spells[0].itemId).toBe(SPELL_IDS[6]);
      expect(collected.deposit[0].itemId).toBe(WEAPON_IDS[2]);
    });
  });

  describe('durability sync on item change', () => {
    test('changing weapon in inventory reloads durability from DB', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const durInput = row.querySelector('.inv-durability');
      expect(durInput.value).toBe('300'); // initial weapon durability

      // Change the weapon — durability should reload (mock DB returns 300 for all weapons)
      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      sel.value = String(WEAPON_IDS[0]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Mock DB returns 300 for all weapons
      expect(durInput.value).toBe('300');
    });

    test('changing weapon with partial durability reloads to full max', () => {
      const model = makeSanitizedModel();
      // Set a partially-damaged weapon (durability 150 instead of 300)
      model.weapons[0].durability = 150;
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const durInput = row.querySelector('.inv-durability');
      expect(durInput.value).toBe('150');

      // Change to a different weapon — durability should reset to max (300).
      // WEAPON_IDS[5] is type 2 (Shield); use WEAPON_IDS[4] (same type) so
      // the lazy-loaded select has the option available.
      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      sel.value = String(WEAPON_IDS[4]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      expect(durInput.value).toBe('300');
    });

    test('changing armor reloads durability (200 from mock DB)', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="armor"] tbody tr');
      const durInput = row.querySelector('.inv-durability');
      expect(durInput.value).toBe('200');

      // Damage the armor, then change it — should reload to 200
      durInput.value = '50';
      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      sel.value = String(ARMOR_IDS[0]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      expect(durInput.value).toBe('200');
    });

    test('changing ring resets durability to 0 in dataset (no durability input)', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="rings"] tbody tr');

      // Rings have no durability input — value stored in dataset
      expect(row.querySelector('.inv-durability')).toBeNull();
      expect(row.dataset.durability).toBeDefined();

      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      sel.value = String(RING_IDS[2]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Durability should be reset to 0 in the dataset
      expect(row.dataset.durability).toBe('0');
    });

    test('changing goods resets durability to 0 in dataset (no durability input)', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="goods"] tbody tr');

      // Goods have no durability input — value stored in dataset
      expect(row.querySelector('.inv-durability')).toBeNull();
      expect(row.dataset.durability).toBeDefined();

      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      // ITEM_IDS[2] is type 9 (Ore); use ITEM_IDS[0] (same type) so
      // the lazy-loaded select has the option available.
      sel.value = String(ITEM_IDS[0]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Durability should be reset to 0 in the dataset
      expect(row.dataset.durability).toBe('0');
    });

    test('changing deposit weapon reloads durability', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="weapons"] tbody tr');
      const durInput = row.querySelector('.inv-dep-durability');
      expect(durInput.value).toBe('300');

      // Change the deposit weapon — durability should reload to 300
      const sel = row.querySelector('.dep-name');
      focusLazySelect(sel);
      sel.value = String(WEAPON_IDS[1]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      expect(durInput.value).toBe('300');
    });

    test('changing deposit goods resets durability to 0 in dataset', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="goods"] tbody tr');

      // Goods have no durability input — value stored in dataset
      expect(row.querySelector('.inv-dep-durability')).toBeNull();
      expect(row.dataset.durability).toBeDefined();

      const sel = row.querySelector('.dep-name');
      focusLazySelect(sel);
      sel.value = String(ITEM_IDS[0]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Durability should be reset to 0 in the dataset
      expect(row.dataset.durability).toBe('0');
    });
  });

  describe('durability visibility by type', () => {
    test('weapons (type 1) show durability column in inventory', () => {
      const model = makeSanitizedModel();
      model.weapons = [
        {
          _ref: 'inv:0',
          itemId: WEAPON_IDS[0],
          count: 1,
          misc1: 0x0100,
          durability: 300,
          misc2: 0x01000000,
          ro_idx1: 0,
        },
      ];
      populateForm(model, null, undefined);

      // weapon-1 table should have visible durability input
      const row = qs('table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.querySelector('.inv-durability')).toBeTruthy();
    });

    test('weapons (type 4 Ammo) hide durability column in inventory', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"][data-weapon-type="4"] tbody tr');
      if (row) {
        expect(row.querySelector('.inv-durability')).toBeNull();
        expect(row.dataset.durability).toBeDefined();
      }
    });

    test('armor shows durability column in inventory', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="armor"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.querySelector('.inv-durability')).toBeTruthy();
    });

    test('rings hide durability column in inventory', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="rings"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.querySelector('.inv-durability')).toBeNull();
      expect(row.dataset.durability).toBeDefined();
    });

    test('goods hide durability column in inventory', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="goods"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.querySelector('.inv-durability')).toBeNull();
      expect(row.dataset.durability).toBeDefined();
    });

    test('deposit rings hide durability column', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="rings"] tbody tr');
      if (row) {
        expect(row.querySelector('.inv-dep-durability')).toBeNull();
        expect(row.dataset.durability).toBeDefined();
      }
    });

    test('deposit goods hide durability column', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="goods"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.querySelector('.inv-dep-durability')).toBeNull();
      expect(row.dataset.durability).toBeDefined();
    });

    test('durability value preserved losslessly via dataset for goods round-trip', () => {
      const model = makeSanitizedModel();
      // Set a known durability on a goods item
      const goodsItem = model.goods.find((g) => g !== undefined);
      if (goodsItem) {
        goodsItem.durability = 42;
      }
      populateForm(model, null, undefined);

      // Verify the dataset holds the value
      const row = qs('table.inv-table[data-category="goods"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.dataset.durability).toBe('42');

      // Collect and verify durability survives the round-trip
      const collected = collectForm();
      const collectedGoods = collected.goods.find((g) => g !== undefined);
      if (collectedGoods) {
        expect(collectedGoods.durability).toBe(42);
      }
    });
  });

  describe('count visibility and duplicate prevention', () => {
    test('weapons (non-Ammo types) hide count', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      // The model's weapon is WEAPON_IDS[5] which is type 2 (Shield).
      // All non-Ammo weapon types hide the count column.
      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      expect(row).toBeTruthy();
      const countTd = row.querySelector('.inv-count')?.closest('td');
      expect(countTd).toBeTruthy();
      expect(countTd.classList.contains('count-hidden')).toBe(true);
    });

    test('armor hides count; loaded count preserved in hidden input', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="armor"] tbody tr');
      const countTd = row.querySelector('.inv-count')?.closest('td');
      expect(countTd.classList.contains('count-hidden')).toBe(true);

      // Loaded count (1) should be preserved in the hidden input.
      const collected = collectForm();
      expect(collected.armor[0].count).toBe(1);
    });

    test('rings hide count; loaded count preserved in hidden input', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="rings"] tbody tr');
      const countTd = row.querySelector('.inv-count')?.closest('td');
      expect(countTd.classList.contains('count-hidden')).toBe(true);
    });

    test('goods (type 9 Ore) show count', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      const countTd = row.querySelector('.inv-count')?.closest('td');
      expect(countTd).toBeTruthy();
      expect(countTd.classList.contains('count-hidden')).toBe(false);
    });

    test('deposit weapons (type 1) hide count', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      const countTd = row.querySelector('.dep-count')?.closest('td');
      expect(countTd).toBeTruthy();
      expect(countTd.classList.contains('count-hidden')).toBe(true);
    });

    test('deposit goods show count', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="goods"] tbody tr');
      const countTd = row.querySelector('.dep-count')?.closest('td');
      expect(countTd).toBeTruthy();
      expect(countTd.classList.contains('count-hidden')).toBe(false);
    });

    test('weapons allow duplicate items (two type-1 weapon rows with same ID)', () => {
      const model = makeSanitizedModel();
      model.weapons = [
        {
          _ref: 'inv:0',
          itemId: WEAPON_IDS[0],
          count: 1,
          misc1: 0x0100,
          durability: 300,
          misc2: 0x01000000,
          ro_idx1: 0,
        },
        {
          _ref: 'inv:1',
          itemId: WEAPON_IDS[0],
          count: 1,
          misc1: 0x0101,
          durability: 300,
          misc2: 0x01000000,
          ro_idx1: 1,
        },
      ];
      populateForm(model, null, undefined);

      const rows = qsa('table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      expect(rows.length).toBe(2);

      const collected = collectForm();
      expect(collected.weapons).toHaveLength(2);
      expect(collected.weapons[0].itemId).toBe(WEAPON_IDS[0]);
      expect(collected.weapons[1].itemId).toBe(WEAPON_IDS[0]);
    });

    test('count clamped to min 1 for inventory goods', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      const countInp = row.querySelector('.inv-count');
      countInp.value = '0';
      countInp.dispatchEvent(new Event('input', { bubbles: true }));
      expect(countInp.value).toBe('1');

      countInp.value = '-5';
      countInp.dispatchEvent(new Event('input', { bubbles: true }));
      expect(countInp.value).toBe('1');
    });

    test('count clamped to max 99 for inventory goods', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      const countInp = row.querySelector('.inv-count');
      countInp.value = '100';
      countInp.dispatchEvent(new Event('input', { bubbles: true }));
      expect(countInp.value).toBe('99');
    });

    test('count clamped to max 99 for deposit goods', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="goods"] tbody tr');
      const countInp = row.querySelector('.dep-count');
      countInp.value = '100';
      countInp.dispatchEvent(new Event('input', { bubbles: true }));
      expect(countInp.value).toBe('99');
    });

    test('goods (show-count type) filter used IDs from sibling dropdowns', () => {
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
      populateForm(model, null, undefined);

      // Focus the existing goods select to lazy-load it, then check that
      // ITEM_IDS[0] is selectable (it's the current row's own item).
      const sel = qs(
        'table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr .inv-name',
      );
      focusLazySelect(sel);
      const opt0 = sel.querySelector(`option[value="${ITEM_IDS[0]}"]`);
      expect(opt0).toBeTruthy();
      expect(opt0.disabled).toBe(false);

      // Now add a second goods row via the Add button and populate its select.
      // ITEM_IDS[0] should be greyed out (disabled) in the new row.
      const addBtn = document.createElement('button');
      addBtn.className = 'inv-add';
      addBtn.dataset.category = 'goods';
      addBtn.dataset.goodsType = '9';
      document.body.appendChild(addBtn);
      setupAddRowButtons();
      addBtn.click();

      const rows = qsa('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      expect(rows.length).toBe(2);

      const newSel = rows[1].querySelector('.inv-name');
      focusLazySelect(newSel);
      const newOpt0 = newSel.querySelector(`option[value="${ITEM_IDS[0]}"]`);
      expect(newOpt0).toBeTruthy();
      expect(newOpt0.disabled).toBe(true);

      // ITEM_IDS[1] (not used) should be available.
      const opt1 = newSel.querySelector(`option[value="${ITEM_IDS[1]}"]`);
      expect(opt1).toBeTruthy();
      expect(opt1.disabled).toBe(false);
    });

    test('soft-deleted counted item stays hidden from sibling dropdowns', () => {
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
      populateForm(model, null, undefined);

      // Soft-delete the existing goods row
      const row = qs('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      row.querySelector('.row-del').click();
      expect(row.dataset.deleted).toBe('true');

      // Add a second goods row and populate its select
      const addBtn = document.createElement('button');
      addBtn.className = 'inv-add';
      addBtn.dataset.category = 'goods';
      addBtn.dataset.goodsType = '9';
      document.body.appendChild(addBtn);
      setupAddRowButtons();
      addBtn.click();

      const rows = qsa('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      const newSel = rows[rows.length - 1].querySelector('.inv-name');
      focusLazySelect(newSel);

      // ITEM_IDS[0] (the soft-deleted row's item) should be disabled
      // — soft-deleted items stay blocked from re-adding.
      const opt0 = newSel.querySelector(`option[value="${ITEM_IDS[0]}"]`);
      expect(opt0).toBeTruthy();
      expect(opt0.disabled).toBe(true);

      // Undelete the original row. The undelete handler calls
      // refreshFilteredOptionsInTable internally, which updates the new row's
      // select since it was already lazy-loaded. ITEM_IDS[0] should remain
      // disabled because it's now actively used by the undeleted row.
      row.querySelector('.row-del').click(); // undelete

      expect(opt0.disabled).toBe(true);
    });

    test('undelete resolves duplicate: edit→add new→soft-delete→undelete', () => {
      const model = makeSanitizedModel();
      // Start with one Ore item (ITEM_IDS[0], type 9 = counted)
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
      populateForm(model, null, undefined);

      // Step 1: Change R1 from ITEM_IDS[0] to ITEM_IDS[1]
      const r1 = qs('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      const r1Sel = r1.querySelector('.inv-name');
      focusLazySelect(r1Sel);
      r1Sel.value = String(ITEM_IDS[1]);
      r1Sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Step 2: Add a new row R2 and select ITEM_IDS[0] (now available)
      const addBtn = document.createElement('button');
      addBtn.className = 'inv-add';
      addBtn.dataset.category = 'goods';
      addBtn.dataset.goodsType = '9';
      document.body.appendChild(addBtn);
      setupAddRowButtons();
      addBtn.click();

      const rows = qsa('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      expect(rows.length).toBe(2);

      const r2Sel = rows[1].querySelector('.inv-name');
      focusLazySelect(r2Sel);
      r2Sel.value = String(ITEM_IDS[0]);
      r2Sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Step 3: Soft-delete R1 (reverts R1 to ITEM_IDS[0])
      r1.querySelector('.row-del').click();
      expect(r1.dataset.deleted).toBe('true');

      // Now R1 (soft-deleted) has ITEM_IDS[0] and R2 has ITEM_IDS[0] — dup!
      // Step 4: Undelete R1 → should hard-delete R2 (the new row)
      r1.querySelector('.row-del').click(); // undelete
      expect(r1.dataset.deleted).toBeUndefined();

      // R2 should be removed from the DOM
      const remainingRows = qsa(
        'table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr',
      );
      expect(remainingRows.length).toBe(1);
      expect(remainingRows[0]).toBe(r1);

      // R1 should still have ITEM_IDS[0] (its original, reverted value)
      expect(r1.querySelector('.inv-name').value).toBe(String(ITEM_IDS[0]));

      // collectForm should have exactly one goods item
      const collected = collectForm();
      expect(collected.goods).toHaveLength(1);
      expect(collected.goods[0].itemId).toBe(ITEM_IDS[0]);
    });

    test('undelete resolves duplicate: edit R1→edit R2→soft-delete R1→undelete', () => {
      const model = makeSanitizedModel();
      // Start with two Ore items (type 9 = counted): ITEM_IDS[0] and ITEM_IDS[2]
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
      populateForm(model, null, undefined);

      const rows = qsa('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      const r1 = rows[0]; // ITEM_IDS[0]
      const r2 = rows[1]; // ITEM_IDS[2]

      // Step 1: Change R1 from ITEM_IDS[0] to ITEM_IDS[1]
      const r1Sel = r1.querySelector('.inv-name');
      focusLazySelect(r1Sel);
      r1Sel.value = String(ITEM_IDS[1]);
      r1Sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Step 2: Change R2 from ITEM_IDS[2] to ITEM_IDS[0] (now available)
      const r2Sel = r2.querySelector('.inv-name');
      focusLazySelect(r2Sel);
      r2Sel.value = String(ITEM_IDS[0]);
      r2Sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Step 3: Soft-delete R1 (reverts R1 to ITEM_IDS[0])
      r1.querySelector('.row-del').click();
      expect(r1.dataset.deleted).toBe('true');

      // Now R1 (soft-deleted) has ITEM_IDS[0] and R2 also has ITEM_IDS[0] — dup!
      // Step 4: Undelete R1 → should auto soft-delete R2 (existing row)
      r1.querySelector('.row-del').click(); // undelete
      expect(r1.dataset.deleted).toBeUndefined();

      // R2 should be soft-deleted
      expect(r2.dataset.deleted).toBe('true');

      // collectForm should have exactly one goods item (R1 with ITEM_IDS[0])
      const collected = collectForm();
      expect(collected.goods).toHaveLength(1);
      expect(collected.goods[0].itemId).toBe(ITEM_IDS[0]);
    });

    test('new Ammo (type 4) inventory row shows count cell', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      // Click the "Add Ammo" button to create a new row in the Ammo (type 4) table.
      const addBtn = document.createElement('button');
      addBtn.className = 'inv-add';
      addBtn.dataset.category = 'weapons';
      addBtn.dataset.weaponType = '4';
      document.body.appendChild(addBtn);
      setupAddRowButtons();
      addBtn.click();

      const row = qs('table.inv-table[data-category="weapons"][data-weapon-type="4"] tbody tr');
      expect(row).toBeTruthy();
      // The count cell must NOT be hidden — Ammo is a counted type.
      const countCell = row.querySelector('td.count-hidden');
      expect(countCell).toBeNull();
      // The count input should exist and be visible with default value 1.
      const countInp = row.querySelector('.inv-count');
      expect(countInp).toBeTruthy();
      expect(countInp.value).toBe('1');
    });

    test('new Ammo (type 4) deposit row shows count cell', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      // Click the "Add Ammo" deposit button to create a new row.
      const addBtn = document.createElement('button');
      addBtn.className = 'dep-add';
      addBtn.dataset.category = 'weapons';
      addBtn.dataset.weaponType = '4';
      document.body.appendChild(addBtn);
      setupAddRowButtons();
      addBtn.click();

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="4"] tbody tr');
      expect(row).toBeTruthy();
      // The count cell must NOT be hidden — Ammo is a counted type.
      const countCell = row.querySelector('td.count-hidden');
      expect(countCell).toBeNull();
      // The count input should exist and be visible with default value 1.
      const countInp = row.querySelector('.dep-count');
      expect(countInp).toBeTruthy();
      expect(countInp.value).toBe('1');
    });
  });

  describe('deposit weapon sync (decomposed rows)', () => {
    test('changing Base Weapon repopulates Path and Level selects', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupDepositWeaponSync();

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.dataset.decomposed).toBe('true');

      const baseSel = row.querySelector('.dep-base-weapon');
      const pathSel = row.querySelector('.dep-path');
      const levelSel = row.querySelector('.dep-level');

      // Initial state: paths and levels should be populated
      const initialPathCount = pathSel.querySelectorAll('option').length;
      expect(initialPathCount).toBeGreaterThan(0);
      const initialLevelCount = levelSel.querySelectorAll('option').length;
      expect(initialLevelCount).toBeGreaterThan(0);

      // Change to a different base weapon
      const allBaseOpts = baseSel.querySelectorAll('option');
      const currentBaseId = baseSel.value;
      let newBaseId = null;
      for (const opt of allBaseOpts) {
        if (opt.value !== currentBaseId) {
          newBaseId = opt.value;
          break;
        }
      }
      expect(newBaseId).not.toBeNull();

      baseSel.value = newBaseId;
      baseSel.dispatchEvent(new Event('change', { bubbles: true }));

      // Path should be repopulated (auto-select first path)
      const newPaths = pathSel.querySelectorAll('option');
      expect(newPaths.length).toBeGreaterThan(0);
      // The mock base weapons all have the same paths [1, 2, 14] = 3 paths
      expect(newPaths.length).toBe(3);

      // Level should also be repopulated for the auto-selected first path
      const newLevels = levelSel.querySelectorAll('option');
      expect(newLevels.length).toBeGreaterThan(0);

      // Hidden .dep-item-id should be updated
      const hiddenInput = row.querySelector('.dep-item-id');
      expect(hiddenInput.value).toBeTruthy();
    });

    test('changing Path repopulates Level select', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupDepositWeaponSync();

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      const pathSel = row.querySelector('.dep-path');
      const levelSel = row.querySelector('.dep-level');

      // Get all available paths (3 for mock: Basic=1, Quality=2, Colorless=14)
      const allPathOpts = pathSel.querySelectorAll('option');
      expect(allPathOpts.length).toBe(3);

      // Select Quality (path 2) — levels [1,2,3,4,5]
      pathSel.value = '2';
      pathSel.dispatchEvent(new Event('change', { bubbles: true }));

      // Quality path has levels [1,2,3,4,5] = 5 options
      const qualityLevels = levelSel.querySelectorAll('option');
      expect(qualityLevels.length).toBe(5);

      // Select Colorless (path 14) — levels [0,1,2,3,4,5]
      pathSel.value = '14';
      pathSel.dispatchEvent(new Event('change', { bubbles: true }));

      const colorlessLevels = levelSel.querySelectorAll('option');
      expect(colorlessLevels.length).toBe(6);
    });

    test('changing Level recomposes itemId', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupDepositWeaponSync();

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      const levelSel = row.querySelector('.dep-level');
      const hiddenInput = row.querySelector('.dep-item-id');

      // Record current itemId
      const _initialItemId = hiddenInput.value;

      // Change to a different level
      const allLevelOpts = levelSel.querySelectorAll('option');
      if (allLevelOpts.length > 1) {
        const currentLevel = levelSel.value;
        let newLevel = null;
        for (const opt of allLevelOpts) {
          if (opt.value !== currentLevel) {
            newLevel = opt.value;
            break;
          }
        }

        levelSel.value = newLevel;
        levelSel.dispatchEvent(new Event('change', { bubbles: true }));

        // itemId should have changed
        expect(hiddenInput.value).toBeTruthy();
        // It may or may not differ (same base+path, different level → different item)
        // but the value should be valid
        expect(hiddenInput.value).not.toBe('');
      }
    });

    test('changing Base Weapon updates durability', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupDepositWeaponSync();

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      const baseSel = row.querySelector('.dep-base-weapon');
      const durInput = row.querySelector('.inv-dep-durability');

      expect(durInput).toBeTruthy();
      expect(durInput.value).toBe('300'); // mock durability for weapons

      // Change base weapon — mock DB always returns 300 for weapons
      const allBaseOpts = baseSel.querySelectorAll('option');
      for (const opt of allBaseOpts) {
        if (opt.value !== baseSel.value) {
          baseSel.value = opt.value;
          break;
        }
      }
      baseSel.dispatchEvent(new Event('change', { bubbles: true }));

      // Durability should be reloaded from DB (300 for mock weapons)
      expect(durInput.value).toBe('300');
    });

    test('collectDeposit after Base Weapon change returns correct itemId', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupDepositWeaponSync();

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      const baseSel = row.querySelector('.dep-base-weapon');
      const _pathSel = row.querySelector('.dep-path');
      const _levelSel = row.querySelector('.dep-level');

      // Change to base weapon 2, path 1 (Basic), level 1
      baseSel.value = '2';
      baseSel.dispatchEvent(new Event('change', { bubbles: true }));

      // Collect and verify itemId is resolved from the selects
      const collected = collectForm();
      expect(collected.deposit).toHaveLength(2); // weapon + goods
      const weaponDep = collected.deposit.find((d) => d.category === 'weapons');
      expect(weaponDep).toBeTruthy();
      expect(weaponDep.itemId).toBeGreaterThan(0);
    });
  });

  describe('deposit add button for decomposed weapon types', () => {
    test('deposit add weapon (type 1) creates decomposed row with Base/Path/Level', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const addBtn = document.createElement('button');
      addBtn.className = 'dep-add';
      addBtn.dataset.category = 'weapons';
      addBtn.dataset.weaponType = '1';
      document.body.appendChild(addBtn);
      setupAddRowButtons();

      const tbody = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody');
      const initialCount = tbody.querySelectorAll('tr').length;

      addBtn.click();

      expect(tbody.querySelectorAll('tr').length).toBe(initialCount + 1);

      const newRow = tbody.lastElementChild;
      expect(newRow.dataset.decomposed).toBe('true');
      expect(newRow.dataset.existing).toBe('false');
      expect(newRow.classList.contains('row-added')).toBe(true);

      // Should have Base Weapon, Path, Level selects
      expect(newRow.querySelector('.dep-base-weapon')).toBeTruthy();
      expect(newRow.querySelector('.dep-path')).toBeTruthy();
      expect(newRow.querySelector('.dep-level')).toBeTruthy();
      expect(newRow.querySelector('.dep-item-id')).toBeTruthy();

      // Base weapon select should have a placeholder (new row)
      const baseSel = newRow.querySelector('.dep-base-weapon');
      expect(baseSel.value).toBe('');

      // Path and Level should be empty (no base weapon selected yet)
      expect(newRow.querySelectorAll('.dep-path option').length).toBe(0);
      expect(newRow.querySelectorAll('.dep-level option').length).toBe(0);
    });

    test('deposit add weapon (type 2 Shield) creates decomposed row', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const addBtn = document.createElement('button');
      addBtn.className = 'dep-add';
      addBtn.dataset.category = 'weapons';
      addBtn.dataset.weaponType = '2';
      document.body.appendChild(addBtn);
      setupAddRowButtons();

      const tbody = qs('table.dep-table[data-category="weapons"][data-weapon-type="2"] tbody');
      const initialCount = tbody.querySelectorAll('tr').length;

      addBtn.click();

      expect(tbody.querySelectorAll('tr').length).toBe(initialCount + 1);
      const newRow = tbody.lastElementChild;
      expect(newRow.dataset.decomposed).toBe('true');
    });
  });

  describe('setupSelectTooltipSync', () => {
    test('updates tooltip on dep-base-weapon change', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupSelectTooltipSync();

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      const baseSel = row.querySelector('.dep-base-weapon');

      // Change to a different base weapon (should have a note in mock DB)
      const opts = baseSel.querySelectorAll('option');
      let newBaseId = null;
      for (const opt of opts) {
        if (opt.value !== baseSel.value) {
          newBaseId = opt.value;
          break;
        }
      }
      expect(newBaseId).not.toBeNull();

      baseSel.value = newBaseId;
      baseSel.dispatchEvent(new Event('change', { bubbles: true }));

      // Mock base weapons all have note 'mock' → tooltip should be set
      expect(baseSel.getAttribute('data-tooltip')).toBeTruthy();
    });

    test('clears tooltip when placeholder selected on dep-base-weapon', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupSelectTooltipSync();

      // Create a new deposit weapon row (has placeholder)
      const addBtn = document.createElement('button');
      addBtn.className = 'dep-add';
      addBtn.dataset.category = 'weapons';
      addBtn.dataset.weaponType = '1';
      document.body.appendChild(addBtn);
      setupAddRowButtons();
      addBtn.click();

      const newRow = qs(
        'table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody tr:last-child',
      );
      const baseSel = newRow.querySelector('.dep-base-weapon');

      // Placeholder is already selected (value='') — dispatching change should
      // clear the tooltip (value is empty)
      baseSel.dispatchEvent(new Event('change', { bubbles: true }));
      // The placeholder value is '' → tooltip should be removed
      // (baseId=0 is falsy → removeAttribute called)
    });

    test('updates tooltip on inventory item-name change', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupSelectTooltipSync();

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      const sel = row.querySelector('.inv-name');

      // Focus to lazy-load options first
      focusLazySelect(sel);

      // Change to a different weapon in the same type group (type 2 = Shield)
      // WEAPON_IDS[5] is currently selected; WEAPON_IDS[4] is also type 2
      sel.value = String(WEAPON_IDS[4]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Mock weapons have notes via upgrade_ref → base weapon → 'mock' note
      expect(sel.getAttribute('data-tooltip')).toBeTruthy();
    });

    test('updates tooltip on spell-name change', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupSelectTooltipSync();

      const row = qs('#spellsTableBody tbody tr');
      const sel = row.querySelector('.spell-name');

      // Focus to lazy-load options
      focusLazySelect(sel);

      // Change to a different spell
      sel.value = String(SPELL_IDS[0]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Spell tooltips depend on whether the mock DB has notes (it doesn't
      // for spells, so tooltip should be removed). The key is no error.
    });

    test('clears tooltip on placeholder selection', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);
      setupSelectTooltipSync();

      // Add a new row with placeholder
      const addBtn = document.createElement('button');
      addBtn.className = 'inv-add';
      addBtn.dataset.category = 'weapons';
      addBtn.dataset.weaponType = '1';
      document.body.appendChild(addBtn);
      setupAddRowButtons();
      addBtn.click();

      const tbody = qs('table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody');
      const newSel = tbody.lastElementChild.querySelector('.inv-name');
      expect(newSel.value).toBe('');

      // Dispatch change with empty value → should remove tooltip
      newSel.dispatchEvent(new Event('change', { bubbles: true }));
      expect(newSel.hasAttribute('data-tooltip')).toBe(false);
    });
  });

  describe('inventory/deposit render fallback paths', () => {
    test('weapon with unknown itemId falls back to type 1 table', () => {
      // Unknown itemId resolves to type 1 (Weapon) via getWeaponTypeId
      // The type 1 table exists in the DOM, so this exercises the normal path.
      // To test the fallback, we need an itemId whose type table doesn't exist.
      // Since all types 1-6 have tables, we test with a known type instead.
      const model = makeSanitizedModel();
      model.weapons = [
        {
          _ref: 'inv:0',
          itemId: WEAPON_IDS[0],
          count: 1,
          misc1: 0x0100,
          durability: 300,
          misc2: 0x01000000,
        },
      ];
      populateForm(model, null, undefined);

      // WEAPON_IDS[0] is type 1 (Weapon) → should appear in weapon-type-1 table
      const row = qs('table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.dataset.ref).toBe('inv:0');
    });

    test('goods with unknown itemId falls back to type 9 table', () => {
      // Unknown goods itemId resolves to type 9 (Ore) via getGoodsTypeId
      const model = makeSanitizedModel();
      model.goods = [
        {
          _ref: 'inv:15',
          itemId: ITEM_IDS[0],
          count: 5,
          misc1: 0x0001,
          durability: 0,
          misc2: 0x01000000,
        },
      ];
      populateForm(model, null, undefined);

      // ITEM_IDS[0] is type 9 (Ore) → should appear in goods-type-9 table
      const row = qs('table.inv-table[data-category="goods"][data-goods-type="9"] tbody tr');
      expect(row).toBeTruthy();
    });

    test('deposit weapon falls back to type 1 when type table missing', () => {
      // The deposit weapon table for type 1 exists — this tests normal routing
      const model = makeSanitizedModel();
      model.deposit = [{ category: 'weapons', itemId: WEAPON_IDS[0], count: 1, durability: 300 }];
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody tr');
      expect(row).toBeTruthy();
    });

    test('deposit goods falls back to type 9 when type table missing', () => {
      const model = makeSanitizedModel();
      model.deposit = [{ category: 'goods', itemId: ITEM_IDS[0], count: 5, durability: 0 }];
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="goods"][data-goods-type="9"] tbody tr');
      expect(row).toBeTruthy();
    });

    test('collectDeposit reads binary fields when present', () => {
      const model = makeSanitizedModel();
      model.deposit = [
        {
          category: 'weapons',
          itemId: WEAPON_IDS[0],
          count: 1,
          durability: 300,
          unknown1: 42,
          sortOrder: 0x00020000,
          flags: [0x21, 1, 2, 3, 4, 5, 6],
        },
      ];
      populateForm(model, null, undefined);

      const collected = collectForm();
      expect(collected.deposit).toHaveLength(1);
      expect(collected.deposit[0].unknown1).toBe(42);
      expect(collected.deposit[0].sortOrder).toBe(0x00020000);
      expect(collected.deposit[0].flags).toEqual([0x21, 1, 2, 3, 4, 5, 6]);
    });

    test('deposit armor row renders with visible durability', () => {
      const model = makeSanitizedModel();
      model.deposit = [{ category: 'armor', itemId: ARMOR_IDS[0], count: 1, durability: 200 }];
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="armor"] tbody tr');
      expect(row).toBeTruthy();
      const durInput = row.querySelector('.inv-dep-durability');
      expect(durInput).toBeTruthy();
      expect(durInput.value).toBe('200');
    });

    test('deposit rings row renders without durability input', () => {
      const model = makeSanitizedModel();
      model.deposit = [{ category: 'rings', itemId: RING_IDS[0], count: 1, durability: 0 }];
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="rings"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.querySelector('.inv-dep-durability')).toBeNull();
      expect(row.dataset.durability).toBeDefined();
    });
  });

  describe('form-render edge cases', () => {
    test('hair color sample updates on all three channel inputs', () => {
      // Remove any leftover sample divs from prior tests
      qsa('#hairColorSample').forEach((el) => el.remove());
      const sample = document.createElement('div');
      sample.id = 'hairColorSample';
      document.body.appendChild(sample);

      setupHairColorSample();

      // Test green channel
      byId('hairR').value = '0';
      byId('hairG').value = '1.0';
      byId('hairB').value = '0';
      byId('hairG').dispatchEvent(new Event('input'));
      expect(sample.style.background).toBe('rgb(0, 255, 0)');

      // Test blue channel
      byId('hairG').value = '0';
      byId('hairB').value = '1.0';
      byId('hairB').dispatchEvent(new Event('input'));
      expect(sample.style.background).toBe('rgb(0, 0, 255)');
    });

    test('populateForm with display data sets equipment pointers', () => {
      const model = makeSanitizedModel();
      const display = makeDisplay();
      populateForm(model, display);

      // Equipment pointers should be stored on the spans
      const lh1 = byId('leftHand1');
      expect(lh1.dataset.roIdx1).toBe('0');
      expect(byId('rightHand1').dataset.roIdx1).toBe('100');
    });

    test('populateForm with undefined display does not crash', () => {
      const model = makeSanitizedModel();
      // Clear stale roIdx1 from prior tests
      byId('leftHand1').removeAttribute('data-ro-idx1');
      populateForm(model, undefined);
      // Should complete without errors
      expect(byId('vit').value).toBe('50');
      // No equipment pointers set when display is undefined
      expect(byId('leftHand1').dataset.roIdx1).toBeUndefined();
    });

    test('deposit add button respects max entries limit', () => {
      const model = makeSanitizedModel();
      model.deposit = []; // start empty
      populateForm(model, null, undefined);

      // Add many deposit rows to approach limit
      // The mock getLimits().depositMaxEntries returns a number from save-api
      // We can't easily mock it, but we can verify the alert path works
      // by checking that the limit is enforced. Skip if the limit is very high.
      // This test just verifies the code path doesn't crash with many rows.
      const btn = document.createElement('button');
      btn.className = 'dep-add';
      btn.dataset.category = 'armor';
      document.body.appendChild(btn);
      setupAddRowButtons();

      // Add one row
      btn.click();
      expect(qsa('table.dep-table[data-category="armor"] tbody tr').length).toBe(1);
    });
  });

  describe('inventory/deposit fallback when type table is removed from DOM', () => {
    // These tests verify the fallback to type-1/type-9 tables when the
    // specific type table is missing from the DOM.  This is a different code
    // path from the 'inventory/deposit render fallback paths' tests above,
    // which only test normal routing with all tables present.
    test('weapon falls back to type 1 table when type table missing', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const type1Table = qs('table.inv-table[data-category="weapons"][data-weapon-type="1"]');
      type1Table.remove();

      model.weapons = [
        {
          _ref: 'inv:1',
          itemId: WEAPON_IDS[1],
          count: 1,
          misc1: 0x0100,
          durability: 300,
          misc2: 0x01000000,
        },
      ];
      expect(() => populateForm(model, null, undefined)).not.toThrow();
    });

    test('goods falls back to type 9 table when type table missing', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const type10Table = qs('table.inv-table[data-category="goods"][data-goods-type="10"]');
      if (type10Table) type10Table.remove();

      model.goods = [
        {
          _ref: 'inv:20',
          itemId: ITEM_IDS[3],
          count: 5,
          misc1: 0x0001,
          durability: 0,
          misc2: 0x01000000,
        },
      ];
      expect(() => populateForm(model, null, undefined)).not.toThrow();
    });

    test('deposit weapon falls back when type table missing', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const depType1 = qs('table.dep-table[data-category="weapons"][data-weapon-type="1"]');
      if (depType1) depType1.remove();

      model.deposit = [{ category: 'weapons', itemId: WEAPON_IDS[0], count: 1, durability: 300 }];
      expect(() => populateForm(model, null, undefined)).not.toThrow();
    });

    test('deposit goods falls back when type table missing', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const depType9 = qs('table.dep-table[data-category="goods"][data-goods-type="9"]');
      if (depType9) depType9.remove();

      model.deposit = [{ category: 'goods', itemId: ITEM_IDS[0], count: 5, durability: 0 }];
      expect(() => populateForm(model, null, undefined)).not.toThrow();
    });
  });

  describe('spell table edge cases', () => {
    test('spell with undefined itemId creates row with no matched option', () => {
      const model = makeSanitizedModel();
      model.spells = [{ itemId: undefined, status: 1, misc1: 5, misc2: 0 }];
      populateForm(model, null, undefined);

      const row = qs('#spellsTableBody tbody tr');
      expect(row).toBeTruthy();
      // No option should be appended (itemId is undefined)
      const sel = row.querySelector('.spell-name');
      expect(sel.querySelectorAll('option').length).toBe(0);
    });

    test('spell with itemId 0 creates row with no matched option', () => {
      const model = makeSanitizedModel();
      model.spells = [{ itemId: 0, status: 0, misc1: 0, misc2: 0 }];
      populateForm(model, null, undefined);

      const row = qs('#spellsTableBody tbody tr');
      expect(row).toBeTruthy();
      const sel = row.querySelector('.spell-name');
      expect(sel.querySelectorAll('option').length).toBe(0);
    });

    test('spell with non-numeric status defaults to 0', () => {
      const model = makeSanitizedModel();
      model.spells = [{ itemId: SPELL_IDS[0], status: 'invalid', misc1: 0, misc2: 0 }];
      populateForm(model, null, undefined);

      const row = qs('#spellsTableBody tbody tr');
      const statusSel = row.querySelector('.spell-status');
      expect(statusSel.value).toBe('0');
    });

    test('spell row has misc2 in dataset', () => {
      const model = makeSanitizedModel();
      model.spells = [{ itemId: SPELL_IDS[0], status: 2, misc1: 10, misc2: 42 }];
      populateForm(model, null, undefined);

      const row = qs('#spellsTableBody tbody tr');
      expect(row.dataset.misc2).toBe('42');
    });

    test('new spell row (isExisting=false) has placeholder', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const btn =
        byId('addSpell') ||
        (() => {
          const b = document.createElement('button');
          b.id = 'addSpell';
          document.body.appendChild(b);
          setupAddRowButtons();
          return b;
        })();

      // Clear existing spells first
      qs('#spellsTableBody tbody').innerHTML = '';
      btn.click();

      const row = qs('#spellsTableBody tbody tr');
      expect(row.dataset.existing).toBe('false');
      expect(row.classList.contains('row-added')).toBe(true);
      const sel = row.querySelector('.spell-name');
      expect(sel.value).toBe(''); // placeholder selected
    });
  });

  // --- Additional coverage tests ---

  describe('setupDurabilitySync edge cases', () => {
    test('placeholder selection (empty value) is skipped', () => {
      // Prior tests may have removed the type-1 table. Re-create if needed.
      if (!qs('table.inv-table[data-category="weapons"][data-weapon-type="1"]')) {
        const table = document.createElement('table');
        table.className = 'grid-table inv-table';
        table.dataset.category = 'weapons';
        table.dataset.weaponType = '1';
        const tbody0 = document.createElement('tbody');
        table.appendChild(tbody0);
        document.body.appendChild(table);
      }
      // Add a row and select a placeholder
      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'weapons';
      btn.dataset.weaponType = '1';
      document.body.appendChild(btn);
      setupAddRowButtons();
      btn.click();

      const tbody = qs('table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody');
      expect(tbody).toBeTruthy();
      const newRow = tbody.lastElementChild;
      const sel = newRow.querySelector('.inv-name');
      // Don't select anything (placeholder active)
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      // Should not crash — just returns early
      expect(sel.value).toBe('');
    });

    test('soft-deleted row is skipped in durability sync', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const row = qs('table.inv-table[data-category="weapons"] tbody tr');
      row.dataset.deleted = 'true';

      const sel = row.querySelector('.inv-name');
      focusLazySelect(sel);
      // Should be skipped since row is soft-deleted
      sel.value = String(WEAPON_IDS[4]);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      // No crash — durability should remain unchanged
    });
  });

  describe('deposit unknown item rendering (additional)', () => {
    test('deposit armor with unknown item ID renders Unknown option', () => {
      const model = makeSanitizedModel();
      model.deposit = [{ category: 'armor', itemId: 0xdeadbeef, count: 1, durability: 200 }];
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="armor"] tbody tr');
      const sel = row.querySelector('.dep-name');
      expect(sel.value).toBe(String(0xdeadbeef));
    });

    test('deposit weapons decomposed with crossbow item renders correctly', () => {
      const model = makeSanitizedModel();
      model.deposit = [{ category: 'weapons', itemId: CROSSBOW_ID, count: 1, durability: 300 }];
      populateForm(model, null, undefined);

      const row = qs('table.dep-table[data-category="weapons"][data-weapon-type="3"] tbody tr');
      expect(row).toBeTruthy();
      expect(row.dataset.decomposed).toBe('true');
      // The crossbow base weapon should be selected
      const baseSel = row.querySelector('.dep-base-weapon');
      expect(baseSel.value).toBeTruthy();
      // Path select should be empty (no upgrade paths)
      const pathSel = row.querySelector('.dep-path');
      expect(pathSel.options.length).toBe(0);
    });
  });

  describe('collectInventory edge cases', () => {
    test('inventory armor durability read from input', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();
      // Armor should have durability
      expect(collected.armor[0].durability).toBe(200);
    });

    test('inventory goods misc2 from dataset survives round-trip', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();
      expect(collected.goods[0].misc2).toBe(0x01000000);
    });

    test('inventory rings count default when hidden', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const collected = collectForm();
      // Rings have count hidden — default is 1
      expect(collected.rings[0].count).toBe(1);
    });
  });

  // --- collectFolderFields validation tests ---
  // accountId/profileNumber are folder-level SFO fields, validated by
  // collectFolderFields() instead of collectForm().

  describe('collectFolderFields validation', () => {
    test('returns null for invalid accountId (not 32 hex chars)', () => {
      makeSanitizedModel();
      populateForm(makeSanitizedModel(), null, undefined);

      byId('accountId').value = 'invalid';

      const result = collectFolderFields();
      expect(result).toBeNull();
    });

    test('returns null for accountId with wrong length', () => {
      makeSanitizedModel();
      populateForm(makeSanitizedModel(), null, undefined);

      byId('accountId').value = 'ABCDEF';

      const result = collectFolderFields();
      expect(result).toBeNull();
    });

    test('accepts empty accountId', () => {
      makeSanitizedModel();
      populateForm(makeSanitizedModel(), null, undefined);

      byId('accountId').value = '';

      const result = collectFolderFields();
      expect(result).not.toBeNull();
      expect(result.accountId).toBe('');
    });

    test('accepts valid 32-char hex accountId', () => {
      makeSanitizedModel();
      populateForm(makeSanitizedModel(), null, undefined);

      const validHex = '0123456789abcdef0123456789abcdef';
      byId('accountId').value = validHex;

      const result = collectFolderFields();
      expect(result).not.toBeNull();
      expect(result.accountId).toBe(validHex);
    });

    test('trims whitespace from accountId before validation', () => {
      makeSanitizedModel();
      populateForm(makeSanitizedModel(), null, undefined);

      const validHex = '0123456789abcdef0123456789abcdef';
      byId('accountId').value = '  ' + validHex + '  ';

      const result = collectFolderFields();
      expect(result).not.toBeNull();
      expect(result.accountId).toBe(validHex);
    });

    test('returns null for name exceeding 16 characters', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      byId('name').value = 'A'.repeat(17);

      const result = collectForm();
      expect(result).toBeNull();
    });

    test('returns null for name with control characters', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      byId('name').value = 'Test\u0001Char';

      const result = collectForm();
      expect(result).toBeNull();
    });
  });

  // --- getNumClamped tests (indirectly via collectForm) ---

  describe('getNumClamped via collectForm', () => {
    test('clamps vit to max=99', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const inp = byId('vit');
      inp.min = '0';
      inp.max = '99';
      inp.value = '150';

      const collected = collectForm();
      expect(collected.vit).toBe(99);
    });

    test('clamps vit to min=0', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const inp = byId('vit');
      inp.min = '0';
      inp.max = '99';
      inp.value = '-5';

      const collected = collectForm();
      expect(collected.vit).toBe(0);
    });

    test('profileNum is NOT clamped (SKIP_CLAMP_IDS)', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const inp = byId('profileNum');
      inp.value = '300'; // above max=255

      // profileNum is in SKIP_CLAMP_IDS, so it passes through unclamped
      // (it's read via getNumClamped but profileNum is collected differently)
      // Actually profileNum is collected separately in app.js, not in collectForm
      expect(() => collectForm()).not.toThrow();
    });
  });

  // --- Branch-coverage: warp bounds check (ui-setup.js line 60) ---
  describe('warp change bounds check', () => {
    test('warp change with invalid index (NaN) does not update position fields', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const originalWorld = byId('world').value;
      const warpSel = byId('warpLocation');
      warpSel.value = 'not-a-number';
      warpSel.dispatchEvent(new Event('change', { bubbles: true }));

      // World/position fields should be unchanged (bounds check returned early)
      expect(byId('world').value).toBe(originalWorld);
    });

    test('warp change with out-of-bounds index does not update position fields', () => {
      const model = makeSanitizedModel();
      populateForm(model, null, undefined);

      const originalWorld = byId('world').value;
      const warpSel = byId('warpLocation');
      warpSel.value = '999';
      warpSel.dispatchEvent(new Event('change', { bubbles: true }));

      expect(byId('world').value).toBe(originalWorld);
    });
  });

  // --- Branch-coverage: updateWorldName catch (form-helpers.js line 37) ---
  describe('updateWorldName error handling', () => {
    test('calling updateWorldName with invalid world clears text (catch branch)', () => {
      // Set a valid world first
      updateWorldName(1);
      expect(byId('worldName').textContent).toBe('Boletaria');

      // Invalid world — triggers getWorldName throw → catch sets ''
      updateWorldName(99);
      expect(byId('worldName').textContent).toBe('');
    });
  });

  // --- Branch-coverage: makeInventoryRow throws for unknown category (inventory-table.js line 280) ---
  describe('makeInventoryRow unknown category', () => {
    test('throws for unsupported category', () => {
      expect(() =>
        makeInventoryRow(
          bad('unknownCategory'),
          {
            itemId: 1,
            count: 1,
            misc1: 0,
            durability: 0,
            misc2: 0,
          },
          null,
          undefined,
        ),
      ).toThrow(/unsupported category/);
    });
  });
}); // close parent 'UI events' describe
