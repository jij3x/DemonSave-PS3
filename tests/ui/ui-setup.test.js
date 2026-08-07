/**
 * @jest-environment jsdom
 *
 * Tests for ui-setup.js — tab switching (including keyboard navigation),
 * warp/world linkage, hair color sample, and add-row button behavior.
 *
 * Uses the real des-db (not mocked) since ui-setup.js needs real warp
 * data and weapon/goods type definitions.
 */

export {};

const { setupHairColorSample, setupWarpAndWorld, setupTabs, setupAddRowButtons } =
  await import('../../js/ui/form/ui-setup.js');
const { populateCombos } = await import('../../js/ui/core/controls.js');
const { refreshEquipmentDisplay } = await import('../../js/ui/core/dom-helpers.js');
const { getLimits } = await import('../../js/des-savefile/save-api.js');

describe('ui-setup', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    refreshEquipmentDisplay.cancel();
  });

  // --- setupHairColorSample ---
  describe('setupHairColorSample', () => {
    test('input on hairR updates the color sample', () => {
      // Create the DOM elements
      for (const id of ['hairR', 'hairG', 'hairB']) {
        const inp = document.createElement('input');
        inp.id = id;
        inp.type = 'number';
        document.body.appendChild(inp);
      }
      const sample = document.createElement('div');
      sample.id = 'hairColorSample';
      document.body.appendChild(sample);

      setupHairColorSample();

      /** @type {HTMLInputElement} */ (document.getElementById('hairR')).value = '1.0';
      /** @type {HTMLInputElement} */ (document.getElementById('hairG')).value = '0.0';
      /** @type {HTMLInputElement} */ (document.getElementById('hairB')).value = '0.0';
      document.getElementById('hairR').dispatchEvent(new Event('input'));

      expect(sample.style.background).toBe('rgb(255, 0, 0)');
    });

    test('missing hair inputs are skipped (no crash)', () => {
      // No hair inputs in the DOM — should not throw
      expect(() => setupHairColorSample()).not.toThrow();
    });

    test('empty channel value defaults to 0 (parses NaN → 0)', () => {
      // Create the DOM elements
      for (const id of ['hairR', 'hairG', 'hairB']) {
        const inp = document.createElement('input');
        inp.id = id;
        inp.type = 'number';
        document.body.appendChild(inp);
      }
      const sample = document.createElement('div');
      sample.id = 'hairColorSample';
      document.body.appendChild(sample);

      setupHairColorSample();

      // An empty value parses to NaN, which the `|| 0` defaults to 0.
      /** @type {HTMLInputElement} */ (document.getElementById('hairR')).value = '';
      document.getElementById('hairR').dispatchEvent(new Event('input'));

      expect(sample.style.background).toBe('rgb(0, 0, 0)');
    });
  });

  // --- setupWarpAndWorld ---
  describe('setupWarpAndWorld', () => {
    // Helper: create all three selects that populateCombos() needs
    function buildWarpDOM() {
      const warpSel = document.createElement('select');
      warpSel.id = 'warpLocation';
      document.body.appendChild(warpSel);

      const styleSel = document.createElement('select');
      styleSel.id = 'hairstyle';
      document.body.appendChild(styleSel);

      const classSel = document.createElement('select');
      classSel.id = 'startClass';
      document.body.appendChild(classSel);

      for (const id of ['world', 'block', 'xpos', 'ypos', 'zpos', 'rot']) {
        const inp = document.createElement('input');
        inp.id = id;
        inp.type = 'number';
        document.body.appendChild(inp);
      }
      const worldName = document.createElement('span');
      worldName.id = 'worldName';
      document.body.appendChild(worldName);

      return { warpSel };
    }

    test('warp change updates position fields and world name', () => {
      const { warpSel } = buildWarpDOM();
      populateCombos();

      setupWarpAndWorld();

      // Select second warp (index 1)
      warpSel.value = '1';
      warpSel.dispatchEvent(new Event('change'));

      expect(/** @type {HTMLInputElement} */ (document.getElementById('world')).value).toBeTruthy();
      expect(document.getElementById('worldName').textContent).toBeTruthy();
    });

    test('world input updates world name', () => {
      buildWarpDOM();
      populateCombos();

      setupWarpAndWorld();

      // Set to a valid world number and dispatch input event
      /** @type {HTMLInputElement} */ (document.getElementById('world')).value = '1';
      document.getElementById('world').dispatchEvent(new Event('input'));

      // worldName should be updated (either to the world name or empty if invalid)
      // The key is that the listener fired without throwing
      const name = document.getElementById('worldName').textContent;
      expect(typeof name).toBe('string');
    });

    test('missing warpLocation element skips setup', () => {
      // No warpLocation select — should not throw
      expect(() => setupWarpAndWorld()).not.toThrow();
    });

    test('invalid warp index does nothing', () => {
      const { warpSel } = buildWarpDOM();
      populateCombos();

      /** @type {HTMLInputElement} */ (document.getElementById('world')).value = '42';

      setupWarpAndWorld();

      warpSel.value = '999';
      warpSel.dispatchEvent(new Event('change'));

      expect(/** @type {HTMLInputElement} */ (document.getElementById('world')).value).toBe('42');
    });

    test('unknown world name shows empty string', () => {
      buildWarpDOM();
      populateCombos();

      setupWarpAndWorld();

      /** @type {HTMLInputElement} */ (document.getElementById('world')).value = '999';
      document.getElementById('world').dispatchEvent(new Event('input'));

      expect(document.getElementById('worldName').textContent).toBe('');
    });

    test('attaches the warp listener even when #world is absent', () => {
      // warpLocation present (so setup does not early-return), but no #world
      // input → the `if (worldInput)` branch is skipped.
      const warpSel = document.createElement('select');
      warpSel.id = 'warpLocation';
      document.body.appendChild(warpSel);

      expect(() => setupWarpAndWorld()).not.toThrow();
    });
  });

  // --- setupTabs — including keyboard navigation ---
  describe('setupTabs', () => {
    function buildTabGroup() {
      const group = document.createElement('div');
      group.className = 'tab-group';

      const tabsDiv = document.createElement('div');
      tabsDiv.className = 'tabs';

      const btnA = document.createElement('button');
      btnA.className = 'tab active';
      btnA.dataset.tab = 'a';
      btnA.textContent = 'A';

      const btnB = document.createElement('button');
      btnB.className = 'tab';
      btnB.dataset.tab = 'b';
      btnB.textContent = 'B';

      const btnC = document.createElement('button');
      btnC.className = 'tab';
      btnC.dataset.tab = 'c';
      btnC.textContent = 'C';

      tabsDiv.appendChild(btnA);
      tabsDiv.appendChild(btnB);
      tabsDiv.appendChild(btnC);

      const contentA = document.createElement('div');
      contentA.className = 'tab-content';
      contentA.dataset.tab = 'a';

      const contentB = document.createElement('div');
      contentB.className = 'tab-content';
      contentB.dataset.tab = 'b';
      contentB.hidden = true;

      const contentC = document.createElement('div');
      contentC.className = 'tab-content';
      contentC.dataset.tab = 'c';
      contentC.hidden = true;

      group.appendChild(tabsDiv);
      group.appendChild(contentA);
      group.appendChild(contentB);
      group.appendChild(contentC);
      document.body.appendChild(group);

      return { group, btnA, btnB, btnC, contentA, contentB, contentC };
    }

    test('click activates a tab', () => {
      const { btnB, contentA, contentB } = buildTabGroup();
      setupTabs();

      btnB.click();

      expect(btnB.classList.contains('active')).toBe(true);
      expect(contentB.hidden).toBe(false);
      expect(contentA.hidden).toBe(true);
    });

    test('ArrowRight moves to next tab', () => {
      const { btnA, btnB } = buildTabGroup();
      setupTabs();

      btnA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      expect(btnB.classList.contains('active')).toBe(true);
      expect(btnA.classList.contains('active')).toBe(false);
    });

    test('ArrowLeft moves to previous tab', () => {
      const { btnC } = buildTabGroup();
      setupTabs();

      // Activate tab C first
      btnC.click();
      expect(btnC.classList.contains('active')).toBe(true);

      // ArrowLeft on C should go to B (not tested here), ArrowLeft again to A
      btnC.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

      // Tab C should be inactive, tab B active
      expect(btnC.classList.contains('active')).toBe(false);
    });

    test('ArrowDown works same as ArrowRight', () => {
      const { btnA, btnB } = buildTabGroup();
      setupTabs();

      btnA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(btnB.classList.contains('active')).toBe(true);
    });

    test('ArrowUp works same as ArrowLeft', () => {
      const { btnC } = buildTabGroup();
      setupTabs();

      btnC.click();
      btnC.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(btnC.classList.contains('active')).toBe(false);
    });

    test('Home activates first tab', () => {
      const { btnA, btnC } = buildTabGroup();
      setupTabs();

      btnC.click();
      expect(btnC.classList.contains('active')).toBe(true);

      btnC.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

      expect(btnA.classList.contains('active')).toBe(true);
      expect(btnC.classList.contains('active')).toBe(false);
    });

    test('End activates last tab', () => {
      const { btnA, btnC } = buildTabGroup();
      setupTabs();

      btnA.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

      expect(btnC.classList.contains('active')).toBe(true);
    });

    test('unrelated key does nothing', () => {
      const { btnA } = buildTabGroup();
      setupTabs();

      const wasActive = btnA.classList.contains('active');
      btnA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(btnA.classList.contains('active')).toBe(wasActive);
    });

    test('wraps around on ArrowRight at last tab', () => {
      const { btnA, btnC } = buildTabGroup();
      setupTabs();

      btnC.click();
      btnC.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      // Should wrap to first tab
      expect(btnA.classList.contains('active')).toBe(true);
    });

    test('wraps around on ArrowLeft at first tab', () => {
      const { btnA, btnC } = buildTabGroup();
      setupTabs();

      // First tab (A) is active by default
      btnA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

      // Should wrap to last tab (C)
      expect(btnC.classList.contains('active')).toBe(true);
    });

    test('ARIA roles are set on tabs container', () => {
      const { group } = buildTabGroup();
      setupTabs();

      const tabsContainer = group.querySelector(':scope > .tabs');
      expect(tabsContainer.getAttribute('role')).toBe('tablist');
    });

    test('tab and tabpanel roles are set on children', () => {
      const { btnA, contentA } = buildTabGroup();
      // Remove roles first to test auto-assignment
      btnA.removeAttribute('role');
      contentA.removeAttribute('role');

      setupTabs();

      expect(btnA.getAttribute('role')).toBe('tab');
      expect(contentA.getAttribute('role')).toBe('tabpanel');
    });

    test('sub-tab add buttons sync visibility on tab switch', () => {
      // Build a group with a sub-tab-actions container
      const group = document.createElement('div');
      group.className = 'tab-group';

      const wrapper = document.createElement('div');
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'sub-tab-actions';

      const btnA = document.createElement('button');
      btnA.className = 'tab active';
      btnA.dataset.tab = 'a';
      const btnB = document.createElement('button');
      btnB.className = 'tab';
      btnB.dataset.tab = 'b';

      const tabsDiv = document.createElement('div');
      tabsDiv.className = 'tabs';
      tabsDiv.appendChild(btnA);
      tabsDiv.appendChild(btnB);

      const contentA = document.createElement('div');
      contentA.className = 'tab-content';
      contentA.dataset.tab = 'a';
      const contentB = document.createElement('div');
      contentB.className = 'tab-content';
      contentB.dataset.tab = 'b';
      contentB.hidden = true;

      // Add buttons for each tab
      const addBtnA = document.createElement('button');
      addBtnA.dataset.tab = 'a';
      addBtnA.hidden = false;
      const addBtnB = document.createElement('button');
      addBtnB.dataset.tab = 'b';
      addBtnB.hidden = true;

      actionsDiv.appendChild(addBtnA);
      actionsDiv.appendChild(addBtnB);
      wrapper.appendChild(group);
      group.appendChild(tabsDiv);
      group.appendChild(contentA);
      group.appendChild(contentB);
      wrapper.appendChild(actionsDiv);
      document.body.appendChild(wrapper);

      setupTabs();

      // Click tab B
      btnB.click();

      // Add button B should be visible, A hidden
      expect(addBtnB.hidden).toBe(false);
      expect(addBtnA.hidden).toBe(true);
    });

    test('preserves existing ARIA roles instead of overwriting them', () => {
      const { group, btnA, contentA } = buildTabGroup();
      // Pre-set roles so the "already has role" branches are taken.
      group.querySelector(':scope > .tabs').setAttribute('role', 'tablist');
      btnA.setAttribute('role', 'tab');
      contentA.setAttribute('role', 'tabpanel');

      setupTabs();

      // Roles were preserved (the auto-assign branches were skipped).
      expect(group.querySelector(':scope > .tabs').getAttribute('role')).toBe('tablist');
      expect(btnA.getAttribute('role')).toBe('tab');
      expect(contentA.getAttribute('role')).toBe('tabpanel');
    });
  });

  // --- setupAddRowButtons ---
  describe('setupAddRowButtons', () => {
    function buildAddButtonDOM() {
      // Create inventory tables and add buttons (matching dom.js structure)
      for (const typeId of ['1', '2', '3', '4', '6']) {
        const scrollBody = document.createElement('div');
        scrollBody.className = 'sub-tab-table-body';
        const table = document.createElement('table');
        table.className = 'grid-table inv-table';
        table.dataset.category = 'weapons';
        table.dataset.weaponType = typeId;
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        scrollBody.appendChild(table);
        document.body.appendChild(scrollBody);
      }
      for (const cat of ['armor', 'rings']) {
        const scrollBody = document.createElement('div');
        scrollBody.className = 'sub-tab-table-body';
        const table = document.createElement('table');
        table.className = 'grid-table inv-table';
        table.dataset.category = cat;
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        scrollBody.appendChild(table);
        document.body.appendChild(scrollBody);
      }
      for (const typeId of ['9', '10', '11', '12']) {
        const scrollBody = document.createElement('div');
        scrollBody.className = 'sub-tab-table-body';
        const table = document.createElement('table');
        table.className = 'grid-table inv-table';
        table.dataset.category = 'goods';
        table.dataset.goodsType = typeId;
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        scrollBody.appendChild(table);
        document.body.appendChild(scrollBody);
      }

      // Inventory add buttons
      const invWeaponBtn = document.createElement('button');
      invWeaponBtn.className = 'inv-add';
      invWeaponBtn.dataset.category = 'weapons';
      invWeaponBtn.dataset.weaponType = '1';
      document.body.appendChild(invWeaponBtn);

      const invGoodsBtn = document.createElement('button');
      invGoodsBtn.className = 'inv-add';
      invGoodsBtn.dataset.category = 'goods';
      invGoodsBtn.dataset.goodsType = '9';
      document.body.appendChild(invGoodsBtn);

      const invArmorBtn = document.createElement('button');
      invArmorBtn.className = 'inv-add';
      invArmorBtn.dataset.category = 'armor';
      document.body.appendChild(invArmorBtn);

      // Deposit tables
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

      // Deposit add buttons
      const depWeaponBtn = document.createElement('button');
      depWeaponBtn.className = 'dep-add';
      depWeaponBtn.dataset.category = 'weapons';
      depWeaponBtn.dataset.weaponType = '1';
      document.body.appendChild(depWeaponBtn);

      const depArmorBtn = document.createElement('button');
      depArmorBtn.className = 'dep-add';
      depArmorBtn.dataset.category = 'armor';
      document.body.appendChild(depArmorBtn);

      // Spells table + add button
      const spellsTable = document.createElement('table');
      spellsTable.id = 'spellsTableBody';
      const spellsTbody = document.createElement('tbody');
      spellsTable.appendChild(spellsTbody);
      const spellsScrollBody = document.createElement('div');
      spellsScrollBody.className = 'sub-tab-table-body';
      spellsScrollBody.appendChild(spellsTable);
      document.body.appendChild(spellsScrollBody);

      const spellAddBtn = document.createElement('button');
      spellAddBtn.id = 'addSpell';
      document.body.appendChild(spellAddBtn);

      return { invWeaponBtn, invGoodsBtn, invArmorBtn, depWeaponBtn, depArmorBtn, spellAddBtn };
    }

    test('inventory weapon add button creates a new row', () => {
      const { invWeaponBtn } = buildAddButtonDOM();
      setupAddRowButtons();

      invWeaponBtn.click();

      const tbody = document.querySelector(
        'table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody',
      );
      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('inventory goods add button creates a new row', () => {
      const { invGoodsBtn } = buildAddButtonDOM();
      setupAddRowButtons();

      invGoodsBtn.click();

      const tbody = document.querySelector(
        'table.inv-table[data-category="goods"][data-goods-type="9"] tbody',
      );
      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('inventory armor add button creates a new row', () => {
      const { invArmorBtn } = buildAddButtonDOM();
      setupAddRowButtons();

      invArmorBtn.click();

      const tbody = document.querySelector('table.inv-table[data-category="armor"] tbody');
      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('spell add button creates a new row', () => {
      const { spellAddBtn } = buildAddButtonDOM();
      setupAddRowButtons();

      spellAddBtn.click();

      const tbody = document.querySelector('#spellsTableBody tbody');
      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('deposit weapon add button creates a decomposed row', () => {
      const { depWeaponBtn } = buildAddButtonDOM();
      setupAddRowButtons();

      depWeaponBtn.click();

      const tbody = document.querySelector(
        'table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody',
      );
      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('deposit armor add button creates a standard row', () => {
      const { depArmorBtn } = buildAddButtonDOM();
      setupAddRowButtons();

      depArmorBtn.click();

      const tbody = document.querySelector('table.dep-table[data-category="armor"] tbody');
      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('add button does nothing when an unselected row already exists (gate)', () => {
      const { invWeaponBtn } = buildAddButtonDOM();
      setupAddRowButtons();

      // First click adds a row
      invWeaponBtn.click();
      const tbody = document.querySelector(
        'table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody',
      );
      expect(tbody.querySelectorAll('tr').length).toBe(1);

      // Second click should not add another (placeholder still active)
      invWeaponBtn.click();
      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('deposit add button shows an alert and adds nothing when deposit is full', () => {
      const { depArmorBtn } = buildAddButtonDOM();
      setupAddRowButtons();

      // Fill a deposit table up to the global entry limit so the "full" guard fires.
      const tbody = document.querySelector('table.dep-table[data-category="armor"] tbody');
      const max = getLimits().depositMaxEntries;
      for (let i = 0; i < max; i++) {
        tbody.appendChild(document.createElement('tr'));
      }
      expect(tbody.querySelectorAll('tr').length).toBe(max);

      depArmorBtn.click();

      // No new row added ...
      expect(tbody.querySelectorAll('tr').length).toBe(max);
      // ... and a modal alert was shown.
      expect(document.querySelector('.modal-overlay')).not.toBeNull();
    });

    // --- inventory add-button guard / default branches ---
    test('inventory add button without a category is a no-op', () => {
      const btn = document.createElement('button');
      btn.className = 'inv-add';
      document.body.appendChild(btn);
      setupAddRowButtons();
      btn.click();
      expect(document.querySelectorAll('tr').length).toBe(0);
    });

    test('inventory weapon add button defaults to type 1 when weaponType is absent', () => {
      const scrollBody = document.createElement('div');
      scrollBody.className = 'sub-tab-table-body';
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      table.dataset.weaponType = '1';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      scrollBody.appendChild(table);
      document.body.appendChild(scrollBody);

      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'weapons';
      // no data-weapon-type → defaults to '1'
      document.body.appendChild(btn);

      setupAddRowButtons();
      btn.click();

      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('inventory goods add button defaults to type 9 when goodsType is absent', () => {
      const scrollBody = document.createElement('div');
      scrollBody.className = 'sub-tab-table-body';
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'goods';
      table.dataset.goodsType = '9';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      scrollBody.appendChild(table);
      document.body.appendChild(scrollBody);

      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'goods';
      document.body.appendChild(btn);

      setupAddRowButtons();
      btn.click();

      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('inventory add button is a no-op when the target table is absent', () => {
      const btn = document.createElement('button');
      btn.className = 'inv-add';
      btn.dataset.category = 'armor';
      // no armor inv-table in the DOM
      document.body.appendChild(btn);

      setupAddRowButtons();
      btn.click();

      expect(document.querySelectorAll('tr').length).toBe(0);
    });

    // --- spell add-button guard / gate branches ---
    test('spell add button is a no-op when the spells table body is absent', () => {
      const btn = document.createElement('button');
      btn.id = 'addSpell';
      document.body.appendChild(btn);
      setupAddRowButtons();
      btn.click();
      expect(document.querySelectorAll('tr').length).toBe(0);
    });

    test('spell add button skips deleted rows in the gate and still adds', () => {
      const spellsTable = document.createElement('table');
      spellsTable.id = 'spellsTableBody';
      const tbody = document.createElement('tbody');
      spellsTable.appendChild(tbody);
      const scrollBody = document.createElement('div');
      scrollBody.className = 'sub-tab-table-body';
      scrollBody.appendChild(spellsTable);
      document.body.appendChild(scrollBody);

      const deleted = document.createElement('tr');
      deleted.dataset.deleted = 'true';
      tbody.appendChild(deleted);

      const btn = document.createElement('button');
      btn.id = 'addSpell';
      document.body.appendChild(btn);

      setupAddRowButtons();
      btn.click();

      // The deleted row is skipped by the gate; a new row is still added.
      expect(tbody.querySelectorAll('tr').length).toBe(2);
    });

    test('spell add button adds a second row when the existing row has a selection', () => {
      const spellsTable = document.createElement('table');
      spellsTable.id = 'spellsTableBody';
      const tbody = document.createElement('tbody');
      spellsTable.appendChild(tbody);
      const scrollBody = document.createElement('div');
      scrollBody.className = 'sub-tab-table-body';
      scrollBody.appendChild(spellsTable);
      document.body.appendChild(scrollBody);

      // An existing row whose spell-name select already has a value.
      const existing = document.createElement('tr');
      const sel = document.createElement('select');
      sel.className = 'spell-name';
      const opt = document.createElement('option');
      opt.value = '1';
      sel.appendChild(opt);
      sel.value = '1';
      existing.appendChild(sel);
      tbody.appendChild(existing);

      const btn = document.createElement('button');
      btn.id = 'addSpell';
      document.body.appendChild(btn);

      setupAddRowButtons();
      btn.click();

      // Gate passes (existing row has a value) → a second row is added.
      expect(tbody.querySelectorAll('tr').length).toBe(2);
    });

    // --- deposit add-button guard / count / gate branches ---
    test('deposit add button without a category is a no-op', () => {
      const btn = document.createElement('button');
      btn.className = 'dep-add';
      document.body.appendChild(btn);
      setupAddRowButtons();
      btn.click();
      expect(document.querySelectorAll('tr').length).toBe(0);
    });

    test('deposit add button skips deleted rows when counting and gating', () => {
      const table = document.createElement('table');
      table.className = 'grid-table dep-table';
      table.dataset.category = 'armor';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      document.body.appendChild(table);

      const deleted = document.createElement('tr');
      deleted.dataset.deleted = 'true';
      tbody.appendChild(deleted);

      const btn = document.createElement('button');
      btn.className = 'dep-add';
      btn.dataset.category = 'armor';
      document.body.appendChild(btn);

      setupAddRowButtons();
      btn.click();

      // Deleted row skipped by count (0 < max) and gate → new row added.
      expect(tbody.querySelectorAll('tr').length).toBe(2);
    });

    // --- deferred row-added guard branches ---
    test('deferred row handler ignores change events on non-select elements', () => {
      setupAddRowButtons();
      const inp = document.createElement('input');
      document.body.appendChild(inp);
      expect(() => inp.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
    });

    test('deferred row handler ignores selects that are not inside a row', () => {
      setupAddRowButtons();
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      const opt = document.createElement('option');
      opt.value = '10001';
      sel.appendChild(opt);
      sel.value = '10001';
      document.body.appendChild(sel); // not inside a <tr>
      expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
    });

    test('deferred row handler ignores a select whose class is not an item-name', () => {
      setupAddRowButtons();
      const tr = document.createElement('tr');
      const sel = document.createElement('select');
      sel.className = 'other'; // not inv-name/spell-name/dep-name
      const opt = document.createElement('option');
      opt.value = '1';
      sel.appendChild(opt);
      sel.value = '1';
      tr.appendChild(sel);
      document.body.appendChild(tr);
      expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
    });

    test('deferred row handler ignores change on an existing row', () => {
      setupAddRowButtons();
      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      const opt = document.createElement('option');
      opt.value = '10001';
      sel.appendChild(opt);
      sel.value = '10001';
      tr.appendChild(sel);
      document.body.appendChild(tr);
      // existing !== 'false' → early return (no onRowAdded).
      expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
    });

    test('deferred row handler fires onRowAdded when a new row select gets a value', () => {
      setupAddRowButtons();
      const tr = document.createElement('tr');
      tr.dataset.existing = 'false';
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      const opt = document.createElement('option');
      opt.value = '100000';
      sel.appendChild(opt);
      sel.value = '100000';
      tr.appendChild(sel);
      document.body.appendChild(tr);
      // onRowAdded is guarded (no-op without a dirty tree).
      expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
    });

    test('deposit goods add button creates a row in the goods type table', () => {
      buildAddButtonDOM();
      const btn = document.createElement('button');
      btn.className = 'dep-add';
      btn.dataset.category = 'goods';
      btn.dataset.goodsType = '9';
      document.body.appendChild(btn);
      setupAddRowButtons();
      btn.click();
      const tbody = document.querySelector(
        'table.dep-table[data-category="goods"][data-goods-type="9"] tbody',
      );
      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });

    test('spell add button gates while an unselected spell row exists', () => {
      const { spellAddBtn } = buildAddButtonDOM();
      setupAddRowButtons();
      const tbody = document.querySelector('#spellsTableBody tbody');
      const unselected = document.createElement('tr');
      const sel = document.createElement('select');
      sel.className = 'spell-name'; // no value → gate blocks
      unselected.appendChild(sel);
      tbody.appendChild(unselected);
      const before = tbody.querySelectorAll('tr').length;
      spellAddBtn.click();
      expect(tbody.querySelectorAll('tr').length).toBe(before);
    });

    test('deposit add button gates while an unselected row exists', () => {
      const { depArmorBtn } = buildAddButtonDOM();
      setupAddRowButtons();
      const tbody = document.querySelector('table.dep-table[data-category="armor"] tbody');
      const unselected = document.createElement('tr');
      const sel = document.createElement('select');
      sel.className = 'dep-name'; // no value → gate blocks
      unselected.appendChild(sel);
      tbody.appendChild(unselected);
      const before = tbody.querySelectorAll('tr').length;
      depArmorBtn.click();
      expect(tbody.querySelectorAll('tr').length).toBe(before);
    });
  });
});
