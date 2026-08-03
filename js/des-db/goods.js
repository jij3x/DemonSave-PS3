export default {
  _meta: {
    description:
      "Demon's Souls consumable items, upgrade materials (ore), souls, keys, eye stones, and special/trade items.",
    source:
      'https://github.com/Wulf2k/DeS-SaveEdit (VB source), http://demonssouls.wikidot.com/ (wiki)',
    schema:
      'Keyed by hex ID. Each entry has { name, type } and optionally { note }. type is [type_id, sub_type_id] where sub_type_ids start from 0 (0 is reserved for Experimental). note is an optional wikidot-sourced summary.',
  },
  items: {
    '0x6': {
      name: 'Execution Grounds Key (Inactive)',
      type: [12, 2],
      note: 'Inactive key item. Does not open any door in the final game.',
    },
    '0x7': {
      name: "False King's Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Old King Allant (1-4). Consume for 60,000 souls. Used by Blacksmith Ed to forge the Northern Regalia (requires Demonbrandt + Soulbrandt).',
    },
    '0x8': {
      name: 'Iron Ring of Keys',
      type: [12, 3],
      note: 'Key item. Found on a Fat Official in 1-3. Opens the 1-2 dungeon door near the Tower Knight entrance to release Biorr of the Twin Fangs.',
    },
    '0x9': {
      name: 'Copper Key',
      type: [12, 3],
      note: 'Key item. Found at the bottom of the tower on the right side of the first fog door in 4-1. Opens the cell in the left side tower to release Graverobber Blige.',
    },
    '0xA': {
      name: 'Prison of Hope, 1F Key',
      type: [12, 3],
      note: 'Key item. Found in 3-1 Prison of Hope at 2.5F. Opens the 1F gate.',
    },
    '0xB': {
      name: 'Prison of Hope, 2F Key',
      type: [12, 3],
      note: "Key item. Found in 3-2 at the top of the first worshipper/chain tower. Requires Pure White World Tendency. Opens Lord Rydell's cell on 2F West.",
    },
    '0xC': {
      name: 'Prison of Hope, 3F Key',
      type: [12, 3],
      note: 'Key item. Found in 3-1 Prison of Hope at 3F East, NE corner. Opens the 3F gate. Often the first key to retrieve in a new game.',
    },
    '0xD': {
      name: 'Prison of Hope, 4F Key',
      type: [12, 3],
      note: 'Key item. Found in 3-1 Prison of Hope at 4F East, SW corner. Opens the 4F gates.',
    },
    '0xE': {
      name: "Prison of Hope, Warden's Key",
      type: [12, 3],
      note: "Key item (aka Jailer's Key). Found in 3-1 at the edge of the ballista hallway. Opens doors to hallways between floors 2 and 3.",
    },
    '0xF': {
      name: "Lead Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Phalanx (1-1). Consume for 1,520 souls. Used by Blacksmith Ed to forge the Scraping Spear (from Short Spear +7 or Winged Spear +7).',
    },
    '0x10': {
      name: "Iron Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Tower Knight (1-2). Consume for 5,000 souls. Used by Sage Freke to learn the Warding spell.',
    },
    '0x11': {
      name: "Silver Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Penetrator (1-3). Consume for 36,000 souls. Used by Sage Freke for Light Weapon and by Yuria the Witch for Cursed Weapon.',
    },
    '0x12': {
      name: "Swollen Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Adjudicator (4-1). Consume for 13,200 souls. Used by Saint Urbain to learn the Regeneration miracle.',
    },
    '0x13': {
      name: "Hero Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Old Hero (4-2). Consume for 20,000 souls. Used by Saint Urbain to learn the Second Chance miracle.',
    },
    '0x14': {
      name: "Storm Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Storm King (4-3). Consume for 26,400 souls. Used by Blacksmith Ed to forge the Morion Blade (from any +0 dagger) and by Saint Urbain to learn Anti-Magic Field.',
    },
    '0x15': {
      name: "Doll Demon's Soul",
      type: [11, 2],
      note: "Dropped by Fool's Idol (3-1). Consume for 7,600 souls. Used by Sage Freke to learn the Soul Ray spell.",
    },
    '0x16': {
      name: "Mixed Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Maneater (3-2). Consume for 19,600 souls. Used by Blacksmith Ed to forge the Needle of Eternal Agony (from various +7 daggers).',
    },
    '0x17': {
      name: "Yellow Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Old Monk (3-3). Consume for 26,400 souls. Used by Sage Freke for Homing Soul Arrow, Yuria the Witch for Soul Thirst, and Saint Urbain for Banish.',
    },
    '0x18': {
      name: "Wriggling Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Leechmonger (5-1). Used by Sage Freke to learn Poison Cloud and by Saint Urbain to learn Cure.',
    },
    '0x19': {
      name: "Eroded Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Dirty Colossus (5-2). Used by Sage Freke to learn the Acid Cloud spell.',
    },
    '0x1A': {
      name: "Pureblood Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Maiden Astraea (5-3). Used by Blacksmith Ed to forge the Blueblood Sword, by Sage Freke for Death Cloud, Yuria the Witch for Relief, and Saint Urbain for Resurrection.',
    },
    '0x1B': {
      name: "Hard Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Armor Spider (2-1). Consume for 3,200 souls. Used by Blacksmith Ed to forge the Lava Bow, by Sage Freke for Fire Spray, and Yuria the Witch for Ignite.',
    },
    '0x1C': {
      name: "Red Hot Demon's Soul",
      type: [11, 2],
      note: "Dropped by Flamelurker (2-2). Consume for 18,000 souls. Give to Blacksmith Ed to unlock all advanced weapon upgrades using other Demon's Souls. Essential for progression — do not consume.",
    },
    '0x1D': {
      name: "Dragon Demon's Soul",
      type: [11, 2],
      note: "Dropped by Dragon God (2-3). Consume for 26,400 souls. Used by Sage Freke for Fireball, Yuria the Witch for Firestorm, and Saint Urbain for God's Wrath.",
    },
    '0x1E': {
      name: "Maiden in Black's Demon's Soul",
      type: [11, 2],
      note: 'Obtained by killing the Maiden in Black at the end of the game. Consume for 60,000 souls. Used by Yuria the Witch to learn the Soulsucker spell.',
    },
    '0x1F': {
      name: "Grey Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Vanguard (4-1 or tutorial). Consume for 1,500 souls. Used by Blacksmith Ed to forge the Dozer Axe (from Halberd +6).',
    },
    '0x20': {
      name: "Small Flame Scale Demon's Soul",
      type: [11, 2],
      note: 'Dropped by the Red Dragon (1-1/1-4). Consume for 10,000 souls. No known crafting or spell use.',
    },
    '0x21': {
      name: "Large Flame Scale Demon's Soul",
      type: [11, 2],
      note: 'Dropped by the Blue Dragon (1-4). Consume for 30,000 souls. No known crafting or spell use.',
    },
    '0x22': {
      name: "Colorless Demon's Soul",
      type: [11, 2],
      note: 'Dropped by Primeval Demons (one per world, Pure Black World Tendency) and Crystal Lizards. Consume for 5,000 souls. Used by Blacksmith Ed for unique weapon/shield upgrades (+5) and by Saint Urbain for the Recovery miracle (costs 3).',
    },
    '0x23': {
      name: 'Mausoleum Key',
      type: [12, 3],
      note: 'Key item. Dropped by Ostrava in 1-1 or given by Ostrava in 1-4. Opens the family mausoleum in 1-1 to fight Old King Doran.',
    },
    '0x24': {
      name: 'Bloody Iron Key',
      type: [12, 3],
      note: 'Key item. Found on a Fat Official in the 1-3 palace dungeon. Opens the 1-3 alley door near the dog carts to reach and release Yuria the Witch.',
    },
    '0x25': {
      name: 'Crest of Vinland',
      type: [12, 2],
      note: 'Trade item. Dropped by Black Phantom Garl Vinland in 5-3 (requires Pure Black World Tendency). Give to Selen Vinland in 5-2 in exchange for the Ring of Devout Prayer.',
    },
    '0x26': {
      name: 'Jade Hair Ornament',
      type: [12, 2],
      note: 'Trade item. Found in 1-1 after cutting the chains from the balcony of the tower left of the Phalanx gate. Trade to Stockpile Thomas for the Ring of Herculean Strength.',
    },
    '0x27': {
      name: 'Prison of Hope, 1F Cell Key',
      type: [12, 3],
      note: 'Key item. Found in 3-1 Prison of Hope at 2.5F. Opens the 1F cells.',
    },
    '0x28': {
      name: 'Prison of Hope, 2F W. Cell Key',
      type: [12, 3],
      note: "Key item. Found in 3-2 at the top of the first worshipper/chain tower. Requires Pure White World Tendency. Opens Lord Rydell's cell on 2F West.",
    },
    '0x29': {
      name: 'Prison of Hope, 3F Cell Key',
      type: [12, 3],
      note: 'Key item. Found in 3-1 Prison of Hope at 3F West, NE corner. Opens most 3F cells.',
    },
    '0x2A': {
      name: 'Prison of Hope, 4F Cell Key',
      type: [12, 3],
      note: 'Key item. Found in 3-1 Prison of Hope at 4F East, SW corner. Opens the 4F cells.',
    },
    '0x2B': {
      name: 'Prison of Hope, 2F E. Cell Key',
      type: [12, 3],
      note: 'Key item. Found in 3-1 Prison of Hope at 2F East, far cell. Opens the 2F East cells. Requires the 2F West Cell Key first (from 3-2).',
    },
    '0x2C': {
      name: 'Prison of Hope, Special Key',
      type: [12, 3],
      note: "Key item. Found in 3-1 in the east transept of the church overlooking the Fool's Idol fight. Opens Sage Freke's cell on 3F East.",
    },
    '0x2D': {
      name: "Beast's Demon's Soul",
      type: [11, 2],
      note: 'Obtained from King Allant (the Old One, end game) if the evil ending is chosen. Consume for 200,000 souls — the highest soul value in the game.',
    },
    '0x63': {
      name: 'Augite of Souls',
      type: [12, 3],
      note: "Player's default starting item; worn on the waist and emits light. Not a consumable/soul despite the name.",
    },
    '0x3E8': {
      name: 'Crescent Moon Grass',
      type: [10, 1],
      note: 'Healing item. Restores 120 HP. Weight 0.1. The most basic healing grass, found throughout the game.',
    },
    '0x3E9': {
      name: 'Half Moon Grass',
      type: [10, 1],
      note: 'Healing item. Restores 240 HP. Weight 0.1. Found throughout the game.',
    },
    '0x3EA': {
      name: 'Late Moon Grass',
      type: [10, 1],
      note: 'Healing item. Restores 400 HP. Weight 0.1. Found throughout the game.',
    },
    '0x3EB': {
      name: 'Full Moon Grass',
      type: [10, 1],
      note: 'Healing item. Restores 600 HP. Weight 0.1. Found throughout the game.',
    },
    '0x3EC': {
      name: 'New Moon Grass',
      type: [10, 1],
      note: 'Healing item. Restores HP to 100%. Weight 0.1. Found throughout the game. Full heal regardless of max HP.',
    },
    '0x3ED': {
      name: 'Fresh Spice',
      type: [10, 2],
      note: 'Magic restoration item. Restores 50 MP. Weight 0.1. Found mostly in the Tower of Latria, sold by Blacksmith Boldwin.',
    },
    '0x3EE': {
      name: 'Old Spice',
      type: [10, 2],
      note: 'Magic restoration item. Restores 100 MP. Weight 0.1. Found mostly in the Tower of Latria, sold by the Once Royal Mistress and the Filthy Woman.',
    },
    '0x3EF': {
      name: 'Royal Lotus',
      type: [10, 3],
      note: 'Status cure item. Cures Poison. Weight 0.1. Found mostly in the Tower of Latria, sold by the Once Royal Mistress and the Filthy Woman.',
    },
    '0x3F0': {
      name: "Widow's Lotus",
      type: [10, 3],
      note: 'Status cure item. Cures Plague. Weight 0.2. Found mostly in the Tower of Latria and the Valley of Defilement, sold by the Once Royal Mistress and the Filthy Woman.',
    },
    '0x3F1': {
      name: 'Dark Moon Grass',
      type: [10, 1],
      note: 'Healing item. Restores HP to 100% and cures all status ailments. Weight 0.1. Found throughout the game. The only grass that works at full effectiveness when Plagued or Poisoned.',
    },
    '0x3F2': {
      name: "Ed's Grindstone",
      type: [10, 6],
      note: 'Utility item. Repairs complete durability to right-handed weapons and shields. Weight 0.3. Found mostly in the Boletarian Palace and Stonefang Tunnel, sold by Blacksmith Boldwin and the Filthy Man.',
    },
    '0x3F3': {
      name: 'Throwing Knife',
      type: [10, 4],
      note: 'Projectile weapon. Deals a small amount of damage when thrown. Weight 0.2. Found mostly in the Boletarian Palace, sold by the Dregling Merchant.',
    },
    '0x3F4': {
      name: 'Kunai',
      type: [10, 4],
      note: 'Projectile weapon. Deals a small amount of damage when thrown with a chance to poison the target. Weight 0.2. Sold by Graverobber Blige.',
    },
    '0x3F5': {
      name: 'Firebomb',
      type: [10, 4],
      note: 'Projectile weapon. Deals fire damage with small splash damage. Target will flinch if the Firebomb is not blocked. Weight 0.3. Found mostly in the Boletarian Palace, sold by the Dregling Merchant.',
    },
    '0x3F6': {
      name: 'Soul Remains',
      type: [10, 6],
      note: 'Decoy item. Diverts the attention of most enemies to the remains. Weight 0.1. Found mostly in the Shrine of Storms, sold by Graverobber Blige. Useful for sneaking past enemies or setting up backstabs.',
    },
    '0x3F7': {
      name: 'Turpentine',
      type: [10, 5],
      note: 'Weapon buff. Deals an additional 80 Fire damage for 60 seconds when applied to a right-hand weapon. Weight 0.2. Found mostly in the Boletarian Palace, sold by the Dregling Merchant in 1-2 and 1-3.',
    },
    '0x3F8': {
      name: 'Black Turpentine',
      type: [10, 5],
      note: 'Weapon buff. Deals an additional 150 Fire damage for 30 seconds when applied to a right-hand weapon. Weight 0.2. Found mostly in the Valley of Defilement, sold by the Filthy Woman. Stronger than regular Turpentine but shorter duration.',
    },
    '0x3F9': {
      name: 'Sticky White Stuff',
      type: [10, 5],
      note: 'Weapon buff. Deals an additional 110 Magic damage for 60 seconds when applied to a right-hand weapon. Weight 0.2. Dropped by Phosphorescent Slugs in 5-2, sold by Graverobber Blige.',
    },
    '0x3FA': {
      name: 'Brass Telescope',
      type: [12, 2],
      note: 'Utility item. Makes far away places appear to be nearer. Weight 0.5. Gift from Ostrava. Can be traded to Sparkly the Crow in 4-1 for a Fragrant Ring.',
    },
    '0x3FC': {
      name: 'Shard of Archstone',
      type: [10, 6],
      note: 'Utility item. Transports the player back to the Nexus with all recovered souls. Weight 0.3. Found in various places, sold by Patches the Hyena. Similar to the Evacuate miracle but does not require spell slots.',
    },
    '0x3FD': {
      name: 'Stone of Ephemeral Eyes',
      type: [10, 6],
      note: 'Special item. When used in Soul Form, returns the player to Body Form, restoring full HP and MP. Weight 0.1. Found in various places. Rare and valuable for maintaining Body Form.',
    },
    '0x3FE': {
      name: 'Augite of Guidance',
      type: [10, 6],
      note: 'Utility item. Creates a small orb of light on the ground for illumination. Weight 0.1. Found in various places, sold by the Once Royal Mistress.',
    },
    '0x3FF': {
      name: "Soldier's Lotus",
      type: [10, 3],
      note: 'Status cure item. Cures Bleeding. Weight 0.1. Found mostly in the Boletarian Palace, sold by the Dregling Merchant.',
    },
    '0x400': {
      name: 'Secret Throwing Dagger',
      type: [10, 4],
      note: 'Projectile weapon. Deals a moderate amount of damage when thrown. Weight 0.2. Dropped by the Imperial Spies in 1-3 and 1-4. Stronger than Throwing Knife or Kunai.',
    },
    '0x401': {
      name: "Unknown Soldier's Soul",
      type: [11, 1],
      note: 'Consumable soul. Grants 200 souls when used. Found in various areas.',
    },
    '0x402': {
      name: "Unknown Hero's Soul",
      type: [11, 1],
      note: 'Consumable soul. Grants 400 souls when used. Found in various areas.',
    },
    '0x403': {
      name: "Renowned Soldier's Soul",
      type: [11, 1],
      note: 'Consumable soul. Grants 800 souls when used. Found in various areas.',
    },
    '0x404': {
      name: "Renowned Hero's Soul",
      type: [11, 1],
      note: 'Consumable soul. Grants 1,000 souls when used. Found in various areas.',
    },
    '0x405': {
      name: "Storied Soldier's Soul",
      type: [11, 1],
      note: 'Consumable soul. Grants 2,000 souls when used. Found in various areas.',
    },
    '0x406': {
      name: "Storied Hero's Soul",
      type: [11, 1],
      note: 'Consumable soul. Grants 4,000 souls when used. Found in various areas.',
    },
    '0x407': {
      name: "Legendary Soldier's Soul",
      type: [11, 1],
      note: 'Consumable soul. Grants 8,000 souls when used. Found in various areas.',
    },
    '0x408': {
      name: "Legendary Hero's Soul",
      type: [11, 1],
      note: 'Consumable soul. Grants 10,000 souls when used. The highest-value consumable soul. Found in various areas.',
    },
    '0x409': {
      name: 'Nexial Binding',
      type: [12, 2],
      note: 'Utility item. Returns the player to the Nexus, but all recovered souls are lost. Weight 0.0. Acquired upon first visit to the Nexus. Use Shard of Archstone or Evacuate instead to keep souls.',
    },
    '0x7D0': {
      name: 'Shard of Hardstone',
      type: [9, 1],
      note: 'Upgrade material for the Hardstone path. Used to upgrade swords, axes, hammers, and shields from +0 to +3. The basic upgrade path that evenly increases physical damage.',
    },
    '0x7D1': {
      name: 'Large Hardstone Shard',
      type: [9, 1],
      note: 'Upgrade material for the Hardstone path. Used to upgrade weapons and shields from +4 to +6.',
    },
    '0x7D2': {
      name: 'Chunk of Hardstone',
      type: [9, 1],
      note: 'Upgrade material for the Hardstone path. Used to upgrade weapons and shields from +7 to +9.',
    },
    '0x7D3': {
      name: 'Pure Hardstone',
      type: [9, 1],
      note: 'Upgrade material for the Hardstone path. Used for the final upgrade to +10. Very rare.',
    },
    '0x7D4': {
      name: 'Shard of Sharpstone',
      type: [9, 1],
      note: 'Upgrade material for the Sharpstone path. Used to upgrade daggers, curved swords, spears, and the Spiked Shield from +0 to +3. The basic upgrade path for lighter weapons.',
    },
    '0x7D5': {
      name: 'Large Sharpstone Shard',
      type: [9, 1],
      note: 'Upgrade material for the Sharpstone path. Used to upgrade weapons from +4 to +6.',
    },
    '0x7D6': {
      name: 'Chunk of Sharpstone',
      type: [9, 1],
      note: 'Upgrade material for the Sharpstone path. Used to upgrade weapons from +7 to +9.',
    },
    '0x7D7': {
      name: 'Pure Sharpstone',
      type: [9, 1],
      note: 'Upgrade material for the Sharpstone path. Used for the final upgrade to +10. Very rare.',
    },
    '0x7DC': {
      name: 'Shard of Clearstone',
      type: [9, 1],
      note: 'Upgrade material for the Quality path (Clearstone). Used to upgrade weapons from +3. Quality path evens out STR and DEX bonuses for balanced scaling.',
    },
    '0x7DD': {
      name: 'Chunk of Clearstone',
      type: [9, 1],
      note: 'Upgrade material for the Quality path (Clearstone). Mid-tier material for the Quality upgrade path.',
    },
    '0x7DE': {
      name: 'Pure Clearstone',
      type: [9, 1],
      note: 'Upgrade material for the Quality path (Clearstone). Used for the final upgrade. Very rare.',
    },
    '0x7DF': {
      name: 'Shard of Greystone',
      type: [9, 1],
      note: 'Upgrade material for the Crushing path (Greystone). Used to upgrade weapons from +0 or +3. Crushing path greatly increases STR bonus and removes DEX bonus.',
    },
    '0x7E0': {
      name: 'Chunk of Greystone',
      type: [9, 1],
      note: 'Upgrade material for the Crushing path (Greystone). Mid-tier material for the Crushing upgrade path.',
    },
    '0x7E1': {
      name: 'Pure Greystone',
      type: [9, 1],
      note: 'Upgrade material for the Crushing path (Greystone). Used for the final upgrade. Very rare.',
    },
    '0x7E5': {
      name: 'Shard of Bladestone',
      type: [9, 1],
      note: 'Upgrade material for the Sharp path (Bladestone). Used to upgrade daggers, curved swords, spears from +0. Sharp path greatly increases DEX bonus.',
    },
    '0x7E6': {
      name: 'Chunk of Bladestone',
      type: [9, 1],
      note: 'Upgrade material for the Sharp path (Bladestone). Mid-tier material for the Sharp upgrade path.',
    },
    '0x7E7': {
      name: 'Pure Bladestone',
      type: [9, 1],
      note: 'Upgrade material for the Sharp path (Bladestone). Used for the final upgrade. Notoriously rare drop from Black Skeletons in 4-2.',
    },
    '0x7E8': {
      name: 'Shard of Spiderstone',
      type: [9, 1],
      note: 'Upgrade material for the Sticky path (Spiderstone). Used to upgrade bows only (not crossbows) from +3. Sticky path greatly increases DEX bonus and adds range.',
    },
    '0x7E9': {
      name: 'Chunk of Spiderstone',
      type: [9, 1],
      note: 'Upgrade material for the Sticky path (Spiderstone). Mid-tier material for the Sticky upgrade path (bows only).',
    },
    '0x7EA': {
      name: 'Pure Spiderstone',
      type: [9, 1],
      note: 'Upgrade material for the Sticky path (Spiderstone). Used for the final upgrade (bows only). Very rare.',
    },
    '0x7EB': {
      name: 'Shard of Mercurystone',
      type: [9, 1],
      note: 'Upgrade material for the Mercury path (Mercurystone). Used to upgrade daggers, curved swords, spears from +3. Mercury path gives a chance to inflict poison.',
    },
    '0x7EC': {
      name: 'Chunk of Mercurystone',
      type: [9, 1],
      note: 'Upgrade material for the Mercury path (Mercurystone). Mid-tier material for the Mercury upgrade path.',
    },
    '0x7ED': {
      name: 'Pure Mercurystone',
      type: [9, 1],
      note: 'Upgrade material for the Mercury path (Mercurystone). Used for the final upgrade. Very rare.',
    },
    '0x7EE': {
      name: 'Shard of Dragonstone',
      type: [9, 1],
      note: 'Upgrade material for the Dragon path (Dragonstone). Used to upgrade weapons from +3. Dragon path adds high base fire damage but removes ALL stat bonuses.',
    },
    '0x7EF': {
      name: 'Chunk of Dragonstone',
      type: [9, 1],
      note: 'Upgrade material for the Dragon path (Dragonstone). Mid-tier material for the Dragon upgrade path.',
    },
    '0x7F0': {
      name: 'Pure Dragonstone',
      type: [9, 1],
      note: 'Upgrade material for the Dragon path (Dragonstone). Used for the final upgrade. Very rare.',
    },
    '0x7F1': {
      name: 'Shard of Suckerstone',
      type: [9, 1],
      note: 'Upgrade material for the Tearing path (Suckerstone). Used to upgrade curved swords and katanas from +0 or +3. Tearing path adds bleed damage and increases DEX.',
    },
    '0x7F2': {
      name: 'Chunk of Suckerstone',
      type: [9, 1],
      note: 'Upgrade material for the Tearing path (Suckerstone). Mid-tier material for the Tearing upgrade path.',
    },
    '0x7F3': {
      name: 'Pure Suckerstone',
      type: [9, 1],
      note: 'Upgrade material for the Tearing path (Suckerstone). Used for the final upgrade. Very rare.',
    },
    '0x7F4': {
      name: 'Shard of Marrowstone',
      type: [9, 1],
      note: 'Upgrade material for the Fatal path (Marrowstone). Used to upgrade daggers, knives, and spears from +3. Fatal path adds critical damage (backstab/riposte) but lowers base damage.',
    },
    '0x7F5': {
      name: 'Chunk of Marrowstone',
      type: [9, 1],
      note: 'Upgrade material for the Fatal path (Marrowstone). Mid-tier material for the Fatal upgrade path.',
    },
    '0x7F6': {
      name: 'Pure Marrowstone',
      type: [9, 1],
      note: 'Upgrade material for the Fatal path (Marrowstone). Used for the final upgrade. Very rare.',
    },
    '0x7F7': {
      name: 'Shard of Moonlightstone',
      type: [9, 1],
      note: 'Upgrade material for the Moon path (Moonlightstone). Used to upgrade weapons from +6. Moon path adds magic damage that scales with the MAG stat.',
    },
    '0x7F8': {
      name: 'Chunk of Moonlightstone',
      type: [9, 1],
      note: 'Upgrade material for the Moon path (Moonlightstone). Mid-tier material for the Moon upgrade path.',
    },
    '0x7F9': {
      name: 'Pure Moonlightstone',
      type: [9, 1],
      note: 'Upgrade material for the Moon path (Moonlightstone). Used for the final upgrade. Very rare.',
    },
    '0x7FA': {
      name: 'Shard of Darkmoonstone',
      type: [9, 1],
      note: 'Upgrade material for the Crescent path (Darkmoonstone). Used to upgrade weapons from +6. Crescent path adds magic damage (scales MAG) and MP regeneration, but eliminates STR/DEX bonuses.',
    },
    '0x7FB': {
      name: 'Chunk of Darkmoonstone',
      type: [9, 1],
      note: 'Upgrade material for the Crescent path (Darkmoonstone). Mid-tier material for the Crescent upgrade path.',
    },
    '0x7FC': {
      name: 'Pure Darkmoonstone',
      type: [9, 1],
      note: 'Upgrade material for the Crescent path (Darkmoonstone). Used for the final upgrade. Very rare.',
    },
    '0x7FD': {
      name: 'Shard of Faintstone',
      type: [9, 1],
      note: 'Upgrade material for the Blessed path (Faintstone). Used to upgrade weapons from +6. Blessed path adds magic damage (scales FTH) and HP regeneration, but lowers STR/DEX bonuses.',
    },
    '0x7FE': {
      name: 'Chunk of Faintstone',
      type: [9, 1],
      note: 'Upgrade material for the Blessed path (Faintstone). Mid-tier material for the Blessed upgrade path.',
    },
    '0x7FF': {
      name: 'Pure Faintstone',
      type: [9, 1],
      note: 'Upgrade material for the Blessed path (Faintstone). Used for the final upgrade. Very rare.',
    },
    '0x800': {
      name: 'Shard of Cloudstone',
      type: [9, 1],
      note: 'Upgrade material for the Dark path (Cloudstone). Used to upgrade shields only from +6. Dark path raises Magic Damage Reduction % but resets Guard Break Reduction to default.',
    },
    '0x801': {
      name: 'Chunk of Cloudstone',
      type: [9, 1],
      note: 'Upgrade material for the Dark path (Cloudstone). Mid-tier material for the Dark upgrade path (shields only).',
    },
    '0x802': {
      name: 'Pure Cloudstone',
      type: [9, 1],
      note: 'Upgrade material for the Dark path (Cloudstone). Used for the final upgrade (shields only). Very rare.',
    },
    '0x806': {
      name: 'Shard of Meltstone',
      type: [9, 1],
      note: 'Special upgrade material. Returns an upgraded weapon/shield to its original base state so it can be upgraded differently. Any stones used in the prior upgrade are lost. Found near the first Fire Gecko in 2-1 or rare drop from Fire Geckos.',
    },
    '0x807': {
      name: 'Large Clearstone Shard',
      type: [9, 1],
      note: 'Upgrade material for the Quality path (Clearstone). Used to upgrade weapons from +4 to +6.',
    },
    '0x808': {
      name: 'Large Greystone Shard',
      type: [9, 1],
      note: 'Upgrade material for the Crushing path (Greystone). Used to upgrade weapons from +4 to +6.',
    },
    '0x809': {
      name: 'Large Bladestone Shard',
      type: [9, 1],
      note: 'Upgrade material for the Sharp path (Bladestone). Used to upgrade weapons from +4 to +6.',
    },
    '0x270B': {
      name: 'Black Eye Stone',
      type: [12, 1],
      note: 'Online item. Allows the player to invade other worlds as a Black Phantom. Weight 0.0. Dropped by the first unnamed Black Phantom slain.',
    },
    '0x270C': {
      name: 'Red Eye Stone',
      type: [12, 1],
      note: 'Online item. Lay down a red sign for others to see. If summoned, fight the host and any phantoms in a PvP duel for souls. Weight 0.0. Acquired after killing the Maiden in Black in the End Game scenario.',
    },
    '0x270D': {
      name: 'Blue Eye Stone',
      type: [12, 1],
      note: 'Online item. Lay down a blue sign for others to see. The player then assists the host as an allied Blue Phantom (co-op). Weight 0.0. Acquired after clearing 1-1.',
    },
    '0x270E': {
      name: 'Kick Item',
      type: [12, 1],
      note: 'Allows kicking attack in place of a consumable.',
    },
    '0x270F': {
      name: 'White Eye Stone',
      type: [12, 1],
      note: 'Online item. Returns a Blue Phantom to their world, or as a host, gives the option to send away summoned Blue Phantoms. Weight 0.0. Acquired after clearing 1-1.',
    },
  },
};
