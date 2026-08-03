export default {
  _meta: {
    description: "Demon's Souls rings.",
    source:
      'https://github.com/Wulf2k/DeS-SaveEdit (VB source), http://demonssouls.wikidot.com/ (wiki)',
    schema:
      'Keyed by hex ID. Each entry has { name, type } and optionally { note }. type is [type_id, sub_type_id] where sub_type_ids start from 0 (0 is reserved for Experimental). note is an optional wikidot-sourced summary.',
  },
  items: {
    '0x64': {
      name: 'Ring of Great Strength',
      type: [8, 1],
      note: "Increases equip weight by 50%, allowing heavier gear. Weight 0.2. Found under the dragon's sweeping tail in 1-1, or dropped by Biorr of the Twin Fangs.",
    },
    '0x65': {
      name: 'Ring of Herculean Strength',
      type: [8, 1],
      note: 'Increases item burden (load weight) by 50%. Weight 0.2. Give Jade Hair Ornament to Stockpile Thomas in the Nexus, or dropped by him. Cannot remove the ring if it would cause your load to exceed your natural capacity.',
    },
    '0x66': {
      name: "Clever Rat's Ring",
      type: [8, 1],
      note: 'When HP is below 30%, increases attack power by 50%. Weight 0.2. Found in 3-1 after turning off the ballista machine. Works with spells, bows, and other attacks. Stacks with Morion Blade for massive damage output.',
    },
    '0x67': {
      name: "Dull Rat's Ring",
      type: [8, 1],
      note: 'When HP is below 30%, increases defense by 50%. Weight 0.2. Found in 3-1 after rescuing Lord Rydell. Obtaining this ring unlocks the door to the second floor of the Tower of Latria.',
    },
    '0x68': {
      name: "Eternal Warrior's Ring",
      type: [8, 1],
      note: 'Increases stamina regeneration speed by 12 stamina per second. Weight 0.2. Dropped by Old King Doran in 1-1.',
    },
    '0x69': {
      name: 'Fragrant Ring',
      type: [8, 1],
      note: 'Recovers MP over time at 1 MP per 4 seconds. Weight 0.2. Found in 3-2 swamp near the Primeval Demon, or give Brass Telescope to Sparkly the Crow in 4-1. Stacks with Crescent weaponry (darkmoonstone) and the Phosphorescent Pole.',
    },
    '0x6A': {
      name: "Regenerator's Ring",
      type: [8, 1],
      note: "Recovers HP over time at 4 HP per second. Weight 0.2. Give Jade Hair Ornament to Sparkly the Crow in 4-1, or found along the far path before the Adjudicator boss in 4-1. Stacks with Blessed weaponry (faintstone), Adjudicator's Shield, and the Regeneration miracle.",
    },
    '0x6B': {
      name: 'Ring of Flame Resistance',
      type: [8, 1],
      note: "Fire Defense +40. Weight 0.2. Found outdoors in the dragon's nest in 1-1, or gifted by Patches the Hyena in 2-2 after defeating his trap. Stacks with Dragon Bone Smasher and Water Veil spell.",
    },
    '0x6C': {
      name: 'Ring of Poison Resistance',
      type: [8, 1],
      note: "Multiplies base Poison Resistance by 4 (not including armor). Weight 0.2. Found in Miralda's area in 1-1, or hidden area in the lava pit in 2-1. Stacks with Istarelle and Bramd.",
    },
    '0x6D': {
      name: 'Ring of Magical Sharpness',
      type: [8, 1],
      note: "Magic Power +20%, Magic Defense -30%. Weight 0.2. Found in the room with 4 iron maidens in 3-1, or dropped by Sage Freke. Stacks with Kris Blade and Monk's Head Collar for maximum spell damage.",
    },
    '0x6E': {
      name: 'Ring of Magical Dullness',
      type: [8, 1],
      note: 'Magic Defense +20%, Magic Power -40%. Weight 0.2. Found on the last platform at the end of the first shortcut in 5-1, or give Phosphorescent Pole to Sparkly the Crow in 4-1. Stacks with Dark Silver Shield, Rune Sword, and Rune Shield.',
    },
    '0x6F': {
      name: 'Ring of Magical Nature',
      type: [8, 1],
      note: "Grants +1 magic memory slot. Weight 0.2. Found in Yuria the Witch's tower in 1-3, or dropped by Yuria. Removing the ring while at slot capacity will deactivate one of your spells.",
    },
    '0x70': {
      name: 'Ring of Sincere Prayer',
      type: [8, 1],
      note: "Increases miracle power by 50%, but slightly increases miracle casting time. Weight 0.2. Found at the Maiden Astraea Archstone in 5-3. Especially useful when casting God's Wrath.",
    },
    '0x71': {
      name: 'Cling Ring',
      type: [8, 1],
      note: 'Increases Max HP in Soul Form by 40%. Weight 0.2. Found in 1-1 between the double portcullis at the bottom of the tower stairwell past the first Blue Eye Knight. The exact HP bonus varies with Character Tendency and World Tendency.',
    },
    '0x72': {
      name: "Friend's Ring",
      type: [8, 1],
      note: "Increases all damage by 20% as a Blue Phantom (co-op). Weight 0.2. Speak to The Monumental in the Nexus with pure white Character Tendency. Must have answered 'Yes' to The Monumental's request during the first encounter.",
    },
    '0x73': {
      name: "Foe's Ring",
      type: [8, 1],
      note: 'Increases all damage by 20% as a Black Phantom (invasion). Weight 0.2. Reward from the Mephistopheles assassination quest in the Nexus.',
    },
    '0x74': {
      name: "Thief's Ring",
      type: [8, 1],
      note: 'Makes it harder for enemies to detect the wearer. Weight 0.2. Found on the platform behind Ostrava in 1-1. Reduces enemy awareness range significantly. May also reduce Guard Break Reduction (possible bug).',
    },
    '0x75': {
      name: "Graverobber's Ring",
      type: [8, 1],
      note: 'Makes it harder for Black Phantoms to detect the wearer. Weight 0.2. Found in 4-1 climbing stairs before the boss, or dropped by Graverobber Blige. Note that aura-producing buffs like MP regeneration will still reveal your position to other players.',
    },
    '0x76': {
      name: "Cat's Ring",
      type: [8, 1],
      note: 'Nullifies all falling damage. Weight 0.2. Found in 5-2 on the left side of the first fog gate, or sold by Patches in the Nexus for 40,000 souls. Fatal falls remain lethal, but all other falling damage is negated.',
    },
    '0x77': {
      name: 'Ring of the Accursed',
      type: [8, 1],
      note: "Makes the wielder enemies' top attack priority. Weight 0.2. Found in Yuria the Witch's tower in 1-3, or dropped by Mephistopheles. Useful in co-op or the 1-3 boss fight to draw aggro away from allies, similar to Biorr's role.",
    },
    '0x78': {
      name: 'Ring of Avarice',
      type: [8, 1],
      note: 'Grants 20% more souls from defeated enemies. Weight 0.2. Sold by Once Royal Mistress in 3-1 for 50,000 souls, or found at the bottom of the boss tower in 3-2 after the heart is dropped. Stacks with Silver Bracelet and Soul Thirst spell.',
    },
    '0x79': {
      name: "Ronin's Ring",
      type: [8, 1],
      note: 'Reduces the rate of weapon durability attrition. Weight 0.2. Found in the slug cave area in 4-2, or dropped by Body Form Scirvir the Wanderer in 2-2. Great for extended farming sessions, such as killing storm beasts in 4-3 with the Stormruler.',
    },
    '0x7A': {
      name: '(Nothing?)',
      type: [8, 1],
      note: 'Unused/placeholder ring slot. No item exists at this ID in the game data.',
    },
    '0x7B': {
      name: "Master's Ring",
      type: [8, 1],
      note: 'Increases Sweet Spot damage by 15%, but decreases damage for all other attacks. Weight 0.2. Dropped by Body Form Miralda in 1-1 (white World Tendency), or found in 2-3 at the dead end past the second ballista. Sweet Spot bonus applies to weapons that benefit from direct hits, such as axes and maces.',
    },
    '0x7C': {
      name: 'Ring of Devout Prayer',
      type: [8, 1],
      note: "Grants +1 miracle memory slot. Weight 0.2. Give Large Sword of Moonlight to Sparkly the Crow in 4-1, or obtained from Selen Vinland's quest in 5-2 (Pure White World Tendency). Removing the ring while at slot capacity will deactivate one of your miracles.",
    },
    '0x7D': {
      name: 'Ring of Gash Resistance',
      type: [8, 1],
      note: 'Multiplies Bleeding Resistance by 4. Weight 0.2. Found on a corpse in the tunnel under the bridge in 1-2, or obtained by speaking to Patches the Hyena in 4-2 after rescuing Saint Urbain.',
    },
    '0x7E': {
      name: 'Ring of Disease Resistance',
      type: [8, 1],
      note: 'Multiplies base Plague Resistance by 4 (not including armor). Weight 0.2. Found on scaffolding opposite Scirvir the Wanderer in 2-2, or at the Primeval Demon location in 3-2. Stacks with Istarelle and Bramd.',
    },
  },
};
