export default {
  _meta: {
    description: "Demon's Souls spells (magic and miracles).",
    source:
      'https://github.com/Wulf2k/DeS-SaveEdit (VB source), http://demonssouls.wikidot.com/ (wiki)',
    schema:
      'Keyed by hex ID. Each entry has { name, type } and optionally { note }. type is [type_id, sub_type_id] where sub_type_ids start from 0 (0 is reserved for Experimental). note is an optional wikidot-sourced summary.',
  },
  items: {
    '0x64': {
      name: 'Invoke Magic Sq.',
      type: [7, 1],
      note: 'System entry for the magic spell selection square UI. Not a learnable spell.',
    },
    '0x3E8': {
      name: 'Soul Arrow',
      type: [7, 1],
      note: "Basic projectile magic. MP 5, 1 slot. Learned from Freke's Apprentice or Sage Freke for 1000 souls. Default spell of the Royalty class. Requires a catalyst to cast.",
    },
    '0x3E9': {
      name: 'Flame Toss',
      type: [7, 1],
      note: "Launches a single bolt of flame. MP 9, 1 slot. Learned from Freke's Apprentice or Sage Freke for 1000 souls. Default spell of the Magician class.",
    },
    '0x3EA': {
      name: 'Relief',
      type: [7, 1],
      note: "Fully recovers a touched ally's HP. MP 10, 1 slot. Learned from Yuria the Witch, requires Pureblood Demon's Soul (from 5-3 Maiden Astraea). The only magic spell that heals others.",
    },
    '0x3EB': {
      name: 'Enchant Weapon',
      type: [7, 1],
      note: "Adds low Magic damage to a right-hand weapon; scales with Magic stat. MP 20, 1 slot. Learned from Freke's Apprentice or Sage Freke for 5000 souls. Only works on enchantable weapons. Personal buffs do not stack with each other.",
    },
    '0x3EC': {
      name: 'Curse Weapon',
      type: [7, 1],
      note: "Boosts weapon damage by 50% but gradually lowers HP. MP 100, 3 slots. Learned from Yuria the Witch, requires Silver Demon's Soul (from 1-3 Penetrator). The strongest weapon enchant but costly in slots and HP. Does not stack with other personal buffs.",
    },
    '0x3ED': {
      name: 'Soul Thirst',
      type: [7, 1],
      note: "Increases souls gained by 50%. MP 200, 3 slots. Learned from Yuria the Witch, requires Yellow Demon's Soul (from 3-3 Old Monk). Excellent for soul farming runs despite the high slot and MP cost. Stacks with Ring of Avarice and Silver Bracelets.",
    },
    '0x3EE': {
      name: 'Poison Cloud',
      type: [7, 1],
      note: "Creates a poison cloud that infects enemies with poison. MP 15, 1 slot. Learned from Sage Freke, requires Wriggling Demon's Soul (from 5-1 Leechmonger). Effective for wearing down tough enemies over time.",
    },
    '0x3EF': {
      name: "Demon's Prank",
      type: [7, 1],
      note: "Creates a noise in the distance; enemies look toward the spell's landing point. MP 4, 1 slot. Learned from Freke's Apprentice or Sage Freke for 500 souls. Useful for distracting enemies to sneak past or set up ambushes.",
    },
    '0x3F0': {
      name: 'Fireball',
      type: [7, 1],
      note: "Launches a large ball of flame. MP 20, 2 slots. Learned from Sage Freke, requires Dragon Demon's Soul (from 2-3 Dragon God). Solid mid-tier fire damage spell.",
    },
    '0x3F1': {
      name: 'Ignite',
      type: [7, 1],
      note: "Fast, point-blank fire attack with high direct damage and limited splash damage. MP 18, 2 slots. Learned from Yuria the Witch, requires Hard Demon's Soul (from 2-1 Armor Spider). Excellent for close-range burst damage.",
    },
    '0x3F2': {
      name: 'Soul Ray',
      type: [7, 1],
      note: "A projectile that can penetrate multiple enemies; more powerful than Soul Arrow. MP 15, 1 slot. Learned from Sage Freke, requires Doll Demon's Soul (from 3-1 Fool's Idol). Great for hallway encounters.",
    },
    '0x3F3': {
      name: 'Homing Soul Arrow',
      type: [7, 1],
      note: "Creates several orbs of light that auto-track and attack the nearest targeted enemy. MP 40, 2 slots. Learned from Sage Freke, requires Yellow Demon's Soul (from 3-3 Old Monk). Excellent against agile enemies.",
    },
    '0x3F4': {
      name: 'Cloak',
      type: [7, 1],
      note: "Makes it harder for enemies to see the caster. MP 10, 1 slot. Learned from Freke's Apprentice or Sage Freke for 500 souls. Useful for stealth approaches in PvE.",
    },
    '0x3F5': {
      name: 'Protection',
      type: [7, 1],
      note: "Slightly reduces physical damage taken. MP 20, 1 slot. Learned from Freke's Apprentice or Sage Freke for 5000 souls. A personal buff — does not stack with other buffs like Warding, Water Veil, or Second Chance.",
    },
    '0x3F6': {
      name: 'Light Weapon',
      type: [7, 1],
      note: "Adds high Magic damage to a right-hand weapon; Magic damage scales with Magic stat. MP 50, 2 slots. Learned from Sage Freke, requires Silver Demon's Soul (from 1-3 Penetrator). Stronger than Enchant Weapon but costs more slots and MP.",
    },
    '0x3F7': {
      name: 'Water Veil',
      type: [7, 1],
      note: "Slightly reduces Fire damage taken; works against all types of Fire. MP 20, 1 slot. Learned from Freke's Apprentice or Sage Freke for 500 souls. Default spell of the Magician class. Does not stack with other personal buffs.",
    },
    '0x3F8': {
      name: 'Death Cloud',
      type: [7, 1],
      note: "Creates a plague cloud that infects enemies with plague — more severe than poison. MP 30, 2 slots. Learned from Sage Freke, requires Pureblood Demon's Soul (from 5-3 Maiden Astraea). Devastating against high-HP enemies.",
    },
    '0x3F9': {
      name: 'Fire Spray',
      type: [7, 1],
      note: "Very weak damage but high rate of fire; can be cast repeatedly while moving. MP 4, 1 slot. Learned from Sage Freke, requires Hard Demon's Soul (from 2-1 Armor Spider). Useful for chip damage and finishing off low-HP enemies.",
    },
    '0x3FA': {
      name: 'Soulsucker',
      type: [7, 1],
      note: "Instantly kills any non-boss Demon NPC and awards double souls. MP 100, 3 slots. Learned from Yuria the Witch, requires Maiden in Black's Demon's Soul (end game). The ultimate soul farming tool.",
    },
    '0x3FB': {
      name: 'Acid Cloud',
      type: [7, 1],
      note: "Creates an erosive cloud that reduces enemy equipment durability. MP 30, 1 slot. Learned from Sage Freke, requires Eroded Demon's Soul (from 5-2 Dirty Colossus). Can degrade enemy weapons and armor, weakening their offense and defense.",
    },
    '0x3FC': {
      name: 'Warding',
      type: [7, 1],
      note: "Greatly reduces physical damage taken. MP 50, 2 slots. Learned from Sage Freke, requires Iron Demon's Soul (from 1-2 Tower Knight). A premier survival spell for melee-oriented magic users. Does not stack with other personal buffs.",
    },
    '0x3FD': {
      name: 'Firestorm',
      type: [7, 1],
      note: "A large area of effect fire damage spell — one of the most damaging spells in the game. MP 100, 3 slots. Learned from Yuria the Witch, requires Dragon Demon's Soul (from 2-3 Dragon God). Devastating against groups and bosses.",
    },
    '0x7D0': {
      name: "God's Wrath",
      type: [7, 2],
      note: "Area of effect attack that creates a sphere of damage around the caster. MP 100, 2 slots. Learned from Saint Urbain, requires Dragon Demon's Soul (from 2-3 Dragon God). The miracle equivalent of Firestorm. Pairs well with Ring of Sincere Prayer for +50% miracle power.",
    },
    '0x7D1': {
      name: 'Anti-Magic Field',
      type: [7, 2],
      note: "Makes it impossible to use Magic near the caster. MP 10, 2 slots. Learned from Saint Urbain, requires Storm Demon's Soul (from 4-3 Storm King). Affects both PvE and PvP — shuts down enemy spellcasters within range.",
    },
    '0x7D2': {
      name: 'Recovery',
      type: [7, 2],
      note: "Caster recovers a large amount of HP; scales with Faith stat. More powerful than Heal. MP 60, 2 slots. Learned from Saint Urbain, requires 3 Colorless Demon's Souls. The strongest self-healing miracle.",
    },
    '0x7D3': {
      name: 'Second Chance',
      type: [7, 2],
      note: "Revives the caster with 50% HP upon death. MP 100, 2 slots. Learned from Saint Urbain, requires Hero Demon's Soul (from 4-2 Old Hero). A premier survival miracle — essentially an extra life. Does not stack with other personal buffs.",
    },
    '0x7D4': {
      name: 'Regeneration',
      type: [7, 2],
      note: "Gradually regenerates HP over time. MP 40, 1 slot. Learned from Saint Urbain, requires Swollen Demon's Soul (from 4-1 Adjudicator). Stacks with Regenerator's Ring, Blessed weaponry, and Adjudicator's Shield for sustained healing.",
    },
    '0x7D5': {
      name: 'Resurrection',
      type: [7, 2],
      note: "Nearby Blue Phantoms regain their body and return to their world. MP 50, 1 slot. Learned from Saint Urbain, requires Pureblood Demon's Soul (from 5-3 Maiden Astraea). A co-op only miracle — revives fallen allies in their own world.",
    },
    '0x7D6': {
      name: 'Cure',
      type: [7, 2],
      note: "Complete status recovery — cures Poison, Plague, and Bleeding all at once. MP 30, 1 slot. Learned from Saint Urbain, requires Wriggling Demon's Soul (from 5-1 Leechmonger). The most comprehensive status cure available.",
    },
    '0x7D7': {
      name: 'Hidden Soul',
      type: [7, 2],
      note: 'Makes it harder for Black Phantoms to see the caster. MP 30, 1 slot. Learned from Disciple of God or Saint Urbain for 3000 souls. The miracle counterpart to Cloak — specifically useful in online PvP against invaders.',
    },
    '0x7D8': {
      name: 'Evacuate',
      type: [7, 2],
      note: 'Transports the caster back to the Nexus while retaining all collected souls. MP 40, 1 slot. Learned from Disciple of God or Saint Urbain for 20,000 souls. Incredibly useful for farming — safely return to the Nexus without risking lost souls.',
    },
    '0x7D9': {
      name: 'Banish',
      type: [7, 2],
      note: "Returns nearby invading Black Phantoms to their own world. MP 50, 2 slots. Learned from Saint Urbain, requires Yellow Demon's Soul (from 3-3 Old Monk). Essential for online play when invaded.",
    },
    '0x7DA': {
      name: 'Heal',
      type: [7, 2],
      note: 'Caster recovers some HP; scales with Faith stat. MP 30, 1 slot. Learned from Disciple of God or Saint Urbain for 5000 souls. Default miracle for the Temple Knight and Priest classes. The basic healing miracle.',
    },
    '0x7DB': {
      name: 'Antidote',
      type: [7, 2],
      note: 'Cures the caster of Poison. MP 20, 1 slot. Learned from Disciple of God or Saint Urbain for 3000 souls. Only cures poison — use Cure for full status recovery including Plague and Bleeding.',
    },
  },
};
