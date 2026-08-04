/**
 * ui-setup.js — Tab switching, warp/world, hair color, add-row buttons,
 * and deferred dirty tracking for new rows.
 *
 * Extracted from form-render.js to keep that module focused on
 * form population/collection + durability sync.
 */

import { getWarps } from '../../des-db/index.js';
const WARPS = getWarps();
import { updateHairColorSample, updateWorldName } from './form-helpers.js';
import {
  getCategoryData,
  getWeaponTypeData,
  getGoodsTypeData,
  getBaseWeaponsForType,
  getPathsForBaseWeapon,
  resolveItemIdFromRef,
} from '../core/controls.js';
import { getUpgradePathDef } from '../../des-db/index.js';
import { onRowAdded } from '../core/dirty.js';
import { $, setVal } from '../core/dom-helpers.js';
import { lookupMaxDurability } from '../core/item-helpers.js';
import { makeInventoryRow } from '../tables/inventory-table.js';
import { makeSpellRow } from '../tables/spell-table.js';
import {
  makeDepositRow,
  makeDepositWeaponRow,
  DECOMPOSED_WEAPON_TYPES,
} from '../tables/deposit-table.js';
import { getLimits } from '../../des-savefile/save-api.js';
import { showAlert } from '../widgets/modal.js';
import { registerChangeHandler } from '../core/event-dispatcher.js';

/* ------------------------------------------------------------------ */
/* Hair color sample                                                   */
/* ------------------------------------------------------------------ */

export function setupHairColorSample() {
  for (const id of ['hairR', 'hairG', 'hairB']) {
    const input = $(id);
    if (input) {
      input.addEventListener('input', updateHairColorSample);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Warp select / world name                                            */
/* ------------------------------------------------------------------ */

export function setupWarpAndWorld() {
  // Null-guard: if elements don't exist (e.g. buildPage not called),
  // skip listener attachment instead of crashing.
  const warpLocation = $('warpLocation');
  if (!warpLocation) return;

  warpLocation.addEventListener('change', (e) => {
    const idx = parseInt(/** @type {HTMLSelectElement} */ (e.target).value, 10);
    if (isNaN(idx) || idx < 0 || idx >= WARPS.length) return;
    const area = WARPS[idx];
    setVal('world', area.world);
    setVal('block', area.block);
    setVal('xpos', area.x);
    setVal('ypos', area.y);
    setVal('zpos', area.z);
    setVal('rot', area.rot);
    updateWorldName(area.world);
  });

  const worldInput = $('world');
  if (worldInput) {
    worldInput.addEventListener('input', (e) => {
      updateWorldName(parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10));
    });
  }
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export function setupTabs() {
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.tab-group')).forEach(
    (group) => {
      // Use :scope to select only direct children — avoids interference between
      // nested tab-groups (e.g. top-level tabs vs inventory sub-tabs).
      const tabs = group.querySelectorAll(':scope > .tabs > .tab');
      const contents = group.querySelectorAll(':scope > .tab-content');

      // Ensure ARIA tablist role on the tab container (for raw HTML tab groups
      // that don't use tabButton()). Already set by tabButton() in others.
      const tabsContainer = group.querySelector(':scope > .tabs');
      if (tabsContainer && !tabsContainer.getAttribute('role')) {
        tabsContainer.setAttribute('role', 'tablist');
      }

      // Ensure tab/tabpanel roles + dynamic ARIA attributes on all tabs and
      // content panels (catches raw HTML in charPanel + invCategoryTab).
      tabs.forEach((tab) => {
        if (!tab.getAttribute('role')) tab.setAttribute('role', 'tab');
      });
      contents.forEach((c) => {
        if (!c.getAttribute('role')) c.setAttribute('role', 'tabpanel');
      });

      // Sub-tab groups are wrapped in .sub-tab-container, which also holds a
      // .sub-tab-actions bar with per-category add buttons.  When switching
      // sub-tabs, show the add button for the newly active category.
      const actionsContainer = group.parentElement?.querySelector(':scope > .sub-tab-actions');

      /**
       * Activate a tab by index, updating aria-selected, tabindex, and
       * content visibility.
       */
      function activateTab(tabIndex) {
        tabs.forEach((t, i) => {
          const isActive = i === tabIndex;
          t.classList.toggle('active', isActive);
          // ARIA: update selected state and roving tabindex
          t.setAttribute('aria-selected', String(isActive));
          /** @type {HTMLElement} */ (t).tabIndex = isActive ? 0 : -1;
        });
        const target = /** @type {HTMLElement} */ (tabs[tabIndex])?.dataset.tab;
        contents.forEach((c) => {
          /** @type {HTMLElement} */ (c).hidden =
            /** @type {HTMLElement} */ (c).dataset.tab !== target;
        });
        // Sync add buttons with the active sub-tab (matched by data-tab)
        if (actionsContainer) {
          actionsContainer.querySelectorAll('button').forEach((btn) => {
            btn.hidden = btn.dataset.tab !== target;
          });
        }
        // Move focus to the newly activated tab
        /** @type {HTMLElement} */ (tabs[tabIndex])?.focus();
      }

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateTab(index));

        // Arrow-key navigation between tabs (WAI-ARIA Authoring Practices)
        tab.addEventListener('keydown', (e) => {
          const tabCount = tabs.length;
          let newIndex = null;

          const ke = /** @type {KeyboardEvent} */ (e);
          if (ke.key === 'ArrowRight' || ke.key === 'ArrowDown') {
            newIndex = (index + 1) % tabCount;
          } else if (ke.key === 'ArrowLeft' || ke.key === 'ArrowUp') {
            newIndex = (index - 1 + tabCount) % tabCount;
          } else if (ke.key === 'Home') {
            newIndex = 0;
          } else if (ke.key === 'End') {
            newIndex = tabCount - 1;
          }

          if (newIndex !== null) {
            e.preventDefault();
            activateTab(newIndex);
          }
        });
      });
    },
  );
}

/* ------------------------------------------------------------------ */
/* Add-row buttons                                                     */
/* ------------------------------------------------------------------ */

/**
 * Scroll the scrollable table body container to the bottom.
 * @param {HTMLElement} tbody  a <tbody> inside a .sub-tab-table-body
 */
function scrollTableBodyToBottom(tbody) {
  const scrollBody = tbody.closest('.sub-tab-table-body');
  if (scrollBody) {
    /** @type {HTMLElement} */ (scrollBody).scrollTop = scrollBody.scrollHeight;
  }
}

export function setupAddRowButtons() {
  // Set up deferred dirty tracking for new rows
  setupDeferredRowAdded();

  // Inventory add buttons
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.inv-add')).forEach((btn) => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;

      // For weapons, use the button's data-weapon-type to target the
      // correct per-type table directly (flat tab structure).
      let tbody;
      let defaultItemId;
      let typeId = null;
      if (category === 'weapons') {
        typeId = Number(btn.dataset.weaponType || '1');
        tbody = document.querySelector(
          `table.inv-table[data-category="weapons"][data-weapon-type="${typeId}"] tbody`,
        );
        const { ids: typeIds } = getWeaponTypeData(typeId);
        defaultItemId = typeIds[0] ?? 0;
      } else if (category === 'goods') {
        typeId = Number(btn.dataset.goodsType || '9');
        tbody = document.querySelector(
          `table.inv-table[data-category="goods"][data-goods-type="${typeId}"] tbody`,
        );
        const { ids: typeIds } = getGoodsTypeData(typeId);
        defaultItemId = typeIds[0] ?? 0;
      } else {
        tbody = document.querySelector(`table.inv-table[data-category="${category}"] tbody`);
        const { ids: invIds } = getCategoryData(/** @type {any} */ (category));
        defaultItemId = invIds[0] ?? 0;
      }
      if (!tbody) return;

      // Gate: don't add another row while an unselected one exists.
      for (const tr of tbody.querySelectorAll('tr')) {
        if (tr.dataset.deleted === 'true') continue;
        if (!(/** @type {HTMLSelectElement|null} */ (tr.querySelector('.inv-name'))?.value)) {
          // Reveal the pending unselected row before bailing out, so the
          // user is always brought to the actionable row on Add.
          scrollTableBodyToBottom(/** @type {HTMLElement} */ (tbody));
          return;
        }
      }
      // Look up max durability from des-db for weapons/armor.
      // Falls back to 200 if not found (or for non-durability categories).
      const durability = lookupMaxDurability(/** @type {any} */ (category), defaultItemId);
      const rec = {
        _ref: '',
        itemId: undefined,
        count: 1,
        misc1: 0,
        durability,
        misc2: 0x01000000,
      };
      const newTr = makeInventoryRow(
        /** @type {any} */ (category),
        rec,
        /** @type {any} */ (typeId),
        undefined,
      );
      tbody.appendChild(newTr);
      // onRowAdded deferred until user selects an item (change listener)
      scrollTableBodyToBottom(/** @type {HTMLElement} */ (tbody));
    });
  });

  // Spell add button
  $('addSpell')?.addEventListener('click', () => {
    const tbody = document.querySelector('#spellsTableBody tbody');
    if (!tbody) return;

    // Gate: don't add another row while an unselected one exists.
    for (const tr of tbody.querySelectorAll('tr')) {
      if (tr.dataset.deleted === 'true') continue;
      if (!(/** @type {HTMLSelectElement|null} */ (tr.querySelector('.spell-name'))?.value)) {
        scrollTableBodyToBottom(/** @type {HTMLElement} */ (tbody));
        return;
      }
    }

    const newSpellTr = makeSpellRow({ itemId: undefined, status: 0, misc1: 0, misc2: 0 }, false);
    tbody.appendChild(newSpellTr);
    void tbody;
    // onRowAdded deferred until user selects a spell (change listener)
    scrollTableBodyToBottom(/** @type {HTMLElement} */ (tbody));
  });

  // Deposit add buttons (per category / per type)
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.dep-add')).forEach((btn) => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;

      // Count existing (non-deleted) deposit rows across ALL tables to enforce limit
      // (category is already typed as string from dataset)
      const DEPOSIT_MAX_ENTRIES = getLimits().depositMaxEntries;

      let totalCount = 0;
      const allDepTbodies = document.querySelectorAll('table.dep-table tbody');
      for (const t of allDepTbodies) {
        for (const tr of t.querySelectorAll('tr')) {
          if (tr.dataset.deleted !== 'true') totalCount++;
        }
      }
      if (totalCount >= DEPOSIT_MAX_ENTRIES) {
        showAlert(
          `Deposit is full (max ${DEPOSIT_MAX_ENTRIES} items). Remove items before adding more.`,
          { title: 'Storage Full' },
        );
        return;
      }

      // For weapons/goods, use the button's data-weapon-type/data-goods-type
      // to target the correct per-type table (same as inventory add buttons).
      let tbody;
      let defaultItemId;
      if (category === 'weapons') {
        const typeId = btn.dataset.weaponType || '1';
        tbody = document.querySelector(
          `table.dep-table[data-category="weapons"][data-weapon-type="${typeId}"] tbody`,
        );
        const { ids: typeIds } = getWeaponTypeData(Number(typeId));
        defaultItemId = typeIds[0] ?? 0;
      } else if (category === 'goods') {
        const typeId = btn.dataset.goodsType || '9';
        tbody = document.querySelector(
          `table.dep-table[data-category="goods"][data-goods-type="${typeId}"] tbody`,
        );
        const { ids: typeIds } = getGoodsTypeData(Number(typeId));
        defaultItemId = typeIds[0] ?? 0;
      } else {
        const { ids: depIds } = getCategoryData(/** @type {any} */ (category));
        defaultItemId = depIds[0] ?? 0;
        tbody = document.querySelector(`table.dep-table[data-category="${category}"] tbody`);
      }

      // Gate: don't add another row while an unselected one exists.
      for (const tr of tbody.querySelectorAll('tr')) {
        if (tr.dataset.deleted === 'true') continue;
        if (!(/** @type {HTMLSelectElement|null} */ (tr.querySelector('.dep-name'))?.value)) {
          scrollTableBodyToBottom(/** @type {HTMLElement} */ (tbody));
          return;
        }
      }

      // For weapon types 1/2/3, use the decomposed 5-column row layout.
      // Otherwise, use the standard single-item-select row.
      let typeId = category === 'weapons' ? Number(btn.dataset.weaponType || '1') : null;
      if (category === 'goods') {
        typeId = Number(btn.dataset.goodsType || '9');
      }
      const isDecomposable = typeId != null && DECOMPOSED_WEAPON_TYPES.has(typeId);

      if (isDecomposable) {
        // Default to first base weapon, first path, first level
        const baseWeapons = getBaseWeaponsForType(typeId);
        const firstBaseId = baseWeapons[0]?.baseId ?? 0;
        const paths = getPathsForBaseWeapon(firstBaseId);
        const firstPathId = paths[0]?.pathId ?? 0;
        const pathDef = firstPathId ? getUpgradePathDef(firstPathId) : null;
        const firstLevel = pathDef?.levels?.[0] ?? 0;
        const decomposedItemId = resolveItemIdFromRef(firstBaseId, firstPathId, firstLevel) ?? 0;
        const defaultDurability = lookupMaxDurability('weapons', decomposedItemId);

        const newDepTr = makeDepositWeaponRow(
          typeId,
          {
            itemId: undefined, // triggers placeholder for new row
            count: 1,
            durability: defaultDurability,
          },
          false,
        );
        tbody.appendChild(newDepTr);
      } else {
        const defaultDurability = lookupMaxDurability(/** @type {any} */ (category), defaultItemId);
        const newDepTr = makeDepositRow(
          /** @type {any} */ (category),
          {
            itemId: undefined,
            count: 1,
            durability: defaultDurability,
          },
          false,
          typeId,
        );
        tbody.appendChild(newDepTr);
      }
      // onRowAdded deferred until user selects an item (change listener)
      scrollTableBodyToBottom(/** @type {HTMLElement} */ (tbody));
    });
  });
}

/* ------------------------------------------------------------------ */
/* New-row dirty tracking: deferred onRowAdded                         */
/* ------------------------------------------------------------------ */

/**
 * Attach a delegated change listener that fires onRowAdded when a new
 * (user-inserted) row's item select goes from placeholder (empty) to
 * a real value.
 *
 * New rows are created with itemId=undefined and a placeholder select
 * (value=''). Until the user selects an actual item, the row contributes
 * nothing to the save — so it should NOT be marked dirty. Only when the
 * user picks a real item does the row become a meaningful addition.
 *
 * This listener detects the empty→non-empty transition and calls
 * onRowAdded() at that point. onRowAdded is idempotent (guarded by
 * newRowContributesDirty), so subsequent changes to the same row are safe.
 */
function setupDeferredRowAdded() {
  registerChangeHandler((e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement)) return;

    // Only item-name selects in table rows (inventory, spells, deposit)
    if (
      !sel.classList.contains('inv-name') &&
      !sel.classList.contains('spell-name') &&
      !sel.classList.contains('dep-name')
    )
      return;

    const tr = sel.closest('tr');
    if (!tr) return;

    // Only new (user-inserted) rows need deferred tracking
    if (tr.dataset.existing !== 'false') return;

    // Only fire when the select transitions from empty to a real value
    if (sel.value) {
      onRowAdded(tr);
    }
  });
}
