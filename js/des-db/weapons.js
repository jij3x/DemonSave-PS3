export default {
  _meta: {
    description: "Demon's Souls weapons, shields, bows, ammo, and casting tools.",
    source:
      'https://github.com/Wulf2k/DeS-SaveEdit (VB source), http://demonssouls.wikidot.com/ (wiki)',
    schema:
      'Keyed by hex ID. Each entry has { name, type } and optionally { upgrade_ref, durability, note }. type is [type_id, sub_type_id] where sub_type_ids start from 0 (0 is reserved for Experimental) within each type. upgrade_ref is an optional [base_weapon_id, path_id, level] referencing rel-upgrades.js; present only for Weapon (type 1), Shield (type 2), and Bow (type 3) entries; path_id and level are null for base weapons 69-89 with no upgrade levels. durability is an optional integer (max durability from the wikidot weapons page) populated for Casting Tool (type 6) entries. note is an optional wikidot-sourced summary, populated for Casting Tool (type 6), Arrow (type 4 sub 1), Bolt (type 4 sub 2), and a few special entries.',
  },
  items: {
    '0x2710': {
      name: 'Dagger',
      type: [1, 1],
      upgrade_ref: [1, 1, 0],
    },
    '0x2711': {
      name: 'Dagger+1',
      type: [1, 1],
      upgrade_ref: [1, 1, 1],
    },
    '0x2712': {
      name: 'Dagger+2',
      type: [1, 1],
      upgrade_ref: [1, 1, 2],
    },
    '0x2713': {
      name: 'Dagger+3',
      type: [1, 1],
      upgrade_ref: [1, 1, 3],
    },
    '0x2714': {
      name: 'Dagger+4',
      type: [1, 1],
      upgrade_ref: [1, 1, 4],
    },
    '0x2715': {
      name: 'Dagger+5',
      type: [1, 1],
      upgrade_ref: [1, 1, 5],
    },
    '0x2716': {
      name: 'Dagger+6',
      type: [1, 1],
      upgrade_ref: [1, 1, 6],
    },
    '0x2717': {
      name: 'Dagger+7',
      type: [1, 1],
      upgrade_ref: [1, 1, 7],
    },
    '0x2718': {
      name: 'Dagger+8',
      type: [1, 1],
      upgrade_ref: [1, 1, 8],
    },
    '0x2719': {
      name: 'Dagger+9',
      type: [1, 1],
      upgrade_ref: [1, 1, 9],
    },
    '0x271A': {
      name: 'Dagger+10',
      type: [1, 1],
      upgrade_ref: [1, 1, 10],
    },
    '0x271B': {
      name: 'Quality Dagger+1',
      type: [1, 1],
      upgrade_ref: [1, 2, 1],
    },
    '0x271C': {
      name: 'Quality Dagger+2',
      type: [1, 1],
      upgrade_ref: [1, 2, 2],
    },
    '0x271D': {
      name: 'Quality Dagger+3',
      type: [1, 1],
      upgrade_ref: [1, 2, 3],
    },
    '0x271E': {
      name: 'Quality Dagger+4',
      type: [1, 1],
      upgrade_ref: [1, 2, 4],
    },
    '0x271F': {
      name: 'Quality Dagger+5',
      type: [1, 1],
      upgrade_ref: [1, 2, 5],
    },
    '0x2725': {
      name: 'Mercury Dagger+1',
      type: [1, 1],
      upgrade_ref: [1, 7, 1],
    },
    '0x2726': {
      name: 'Mercury Dagger+2',
      type: [1, 1],
      upgrade_ref: [1, 7, 2],
    },
    '0x2727': {
      name: 'Mercury Dagger+3',
      type: [1, 1],
      upgrade_ref: [1, 7, 3],
    },
    '0x2728': {
      name: 'Mercury Dagger+4',
      type: [1, 1],
      upgrade_ref: [1, 7, 4],
    },
    '0x2729': {
      name: 'Mercury Dagger+5',
      type: [1, 1],
      upgrade_ref: [1, 7, 5],
    },
    '0x272F': {
      name: 'Sharp Dagger+1',
      type: [1, 1],
      upgrade_ref: [1, 4, 1],
    },
    '0x2730': {
      name: 'Sharp Dagger+2',
      type: [1, 1],
      upgrade_ref: [1, 4, 2],
    },
    '0x2731': {
      name: 'Sharp Dagger+3',
      type: [1, 1],
      upgrade_ref: [1, 4, 3],
    },
    '0x2732': {
      name: 'Sharp Dagger+4',
      type: [1, 1],
      upgrade_ref: [1, 4, 4],
    },
    '0x2733': {
      name: 'Sharp Dagger+5',
      type: [1, 1],
      upgrade_ref: [1, 4, 5],
    },
    '0x2739': {
      name: 'Fatal Dagger+1',
      type: [1, 1],
      upgrade_ref: [1, 8, 1],
    },
    '0x273A': {
      name: 'Fatal Dagger+2',
      type: [1, 1],
      upgrade_ref: [1, 8, 2],
    },
    '0x273B': {
      name: 'Fatal Dagger+3',
      type: [1, 1],
      upgrade_ref: [1, 8, 3],
    },
    '0x273C': {
      name: 'Fatal Dagger+4',
      type: [1, 1],
      upgrade_ref: [1, 8, 4],
    },
    '0x273D': {
      name: 'Fatal Dagger+5',
      type: [1, 1],
      upgrade_ref: [1, 8, 5],
    },
    '0x2743': {
      name: 'Crescent Dagger+1',
      type: [1, 1],
      upgrade_ref: [1, 10, 1],
    },
    '0x2744': {
      name: 'Crescent Dagger+2',
      type: [1, 1],
      upgrade_ref: [1, 10, 2],
    },
    '0x2745': {
      name: 'Crescent Dagger+3',
      type: [1, 1],
      upgrade_ref: [1, 10, 3],
    },
    '0x2746': {
      name: 'Crescent Dagger+4',
      type: [1, 1],
      upgrade_ref: [1, 10, 4],
    },
    '0x2747': {
      name: 'Crescent Dagger+5',
      type: [1, 1],
      upgrade_ref: [1, 10, 5],
    },
    '0x2774': {
      name: 'Parrying Dagger',
      type: [1, 1],
      upgrade_ref: [2, 1, 0],
    },
    '0x2775': {
      name: 'Parrying Dagger+1',
      type: [1, 1],
      upgrade_ref: [2, 1, 1],
    },
    '0x2776': {
      name: 'Parrying Dagger+2',
      type: [1, 1],
      upgrade_ref: [2, 1, 2],
    },
    '0x2777': {
      name: 'Parrying Dagger+3',
      type: [1, 1],
      upgrade_ref: [2, 1, 3],
    },
    '0x2778': {
      name: 'Parrying Dagger+4',
      type: [1, 1],
      upgrade_ref: [2, 1, 4],
    },
    '0x2779': {
      name: 'Parrying Dagger+5',
      type: [1, 1],
      upgrade_ref: [2, 1, 5],
    },
    '0x277A': {
      name: 'Parrying Dagger+6',
      type: [1, 1],
      upgrade_ref: [2, 1, 6],
    },
    '0x277B': {
      name: 'Parrying Dagger+7',
      type: [1, 1],
      upgrade_ref: [2, 1, 7],
    },
    '0x277C': {
      name: 'Parrying Dagger+8',
      type: [1, 1],
      upgrade_ref: [2, 1, 8],
    },
    '0x277D': {
      name: 'Parrying Dagger+9',
      type: [1, 1],
      upgrade_ref: [2, 1, 9],
    },
    '0x277E': {
      name: 'Parrying Dagger+10',
      type: [1, 1],
      upgrade_ref: [2, 1, 10],
    },
    '0x277F': {
      name: 'Quality Parrying Dagger+1',
      type: [1, 1],
      upgrade_ref: [2, 2, 1],
    },
    '0x2780': {
      name: 'Quality Parrying Dagger+2',
      type: [1, 1],
      upgrade_ref: [2, 2, 2],
    },
    '0x2781': {
      name: 'Quality Parrying Dagger+3',
      type: [1, 1],
      upgrade_ref: [2, 2, 3],
    },
    '0x2782': {
      name: 'Quality Parrying Dagger+4',
      type: [1, 1],
      upgrade_ref: [2, 2, 4],
    },
    '0x2783': {
      name: 'Quality Parrying Dagger+5',
      type: [1, 1],
      upgrade_ref: [2, 2, 5],
    },
    '0x2789': {
      name: 'Mercury Parrying Dagger+1',
      type: [1, 1],
      upgrade_ref: [2, 7, 1],
    },
    '0x278A': {
      name: 'Mercury Parrying Dagger+2',
      type: [1, 1],
      upgrade_ref: [2, 7, 2],
    },
    '0x278B': {
      name: 'Mercury Parrying Dagger+3',
      type: [1, 1],
      upgrade_ref: [2, 7, 3],
    },
    '0x278C': {
      name: 'Mercury Parrying Dagger+4',
      type: [1, 1],
      upgrade_ref: [2, 7, 4],
    },
    '0x278D': {
      name: 'Mercury Parrying Dagger+5',
      type: [1, 1],
      upgrade_ref: [2, 7, 5],
    },
    '0x2793': {
      name: 'Fatal Parrying Dagger+1',
      type: [1, 1],
      upgrade_ref: [2, 8, 1],
    },
    '0x2794': {
      name: 'Fatal Parrying Dagger+2',
      type: [1, 1],
      upgrade_ref: [2, 8, 2],
    },
    '0x2795': {
      name: 'Fatal Parrying Dagger+3',
      type: [1, 1],
      upgrade_ref: [2, 8, 3],
    },
    '0x2796': {
      name: 'Fatal Parrying Dagger+4',
      type: [1, 1],
      upgrade_ref: [2, 8, 4],
    },
    '0x2797': {
      name: 'Fatal Parrying Dagger+5',
      type: [1, 1],
      upgrade_ref: [2, 8, 5],
    },
    '0x279D': {
      name: 'Sharp Parrying Dagger+1',
      type: [1, 1],
      upgrade_ref: [2, 4, 1],
    },
    '0x279E': {
      name: 'Sharp Parrying Dagger+2',
      type: [1, 1],
      upgrade_ref: [2, 4, 2],
    },
    '0x279F': {
      name: 'Sharp Parrying Dagger+3',
      type: [1, 1],
      upgrade_ref: [2, 4, 3],
    },
    '0x27A0': {
      name: 'Sharp Parrying Dagger+4',
      type: [1, 1],
      upgrade_ref: [2, 4, 4],
    },
    '0x27A1': {
      name: 'Sharp Parrying Dagger+5',
      type: [1, 1],
      upgrade_ref: [2, 4, 5],
    },
    '0x27A7': {
      name: 'Crescent Parrying Dagger+1',
      type: [1, 1],
      upgrade_ref: [2, 10, 1],
    },
    '0x27A8': {
      name: 'Crescent Parrying Dagger+2',
      type: [1, 1],
      upgrade_ref: [2, 10, 2],
    },
    '0x27A9': {
      name: 'Crescent Parrying Dagger+3',
      type: [1, 1],
      upgrade_ref: [2, 10, 3],
    },
    '0x27AA': {
      name: 'Crescent Parrying Dagger+4',
      type: [1, 1],
      upgrade_ref: [2, 10, 4],
    },
    '0x27AB': {
      name: 'Crescent Parrying Dagger+5',
      type: [1, 1],
      upgrade_ref: [2, 10, 5],
    },
    '0x27D8': {
      name: 'Mail Breaker',
      type: [1, 1],
      upgrade_ref: [3, 1, 0],
    },
    '0x27D9': {
      name: 'Mail Breaker+1',
      type: [1, 1],
      upgrade_ref: [3, 1, 1],
    },
    '0x27DA': {
      name: 'Mail Breaker+2',
      type: [1, 1],
      upgrade_ref: [3, 1, 2],
    },
    '0x27DB': {
      name: 'Mail Breaker+3',
      type: [1, 1],
      upgrade_ref: [3, 1, 3],
    },
    '0x27DC': {
      name: 'Mail Breaker+4',
      type: [1, 1],
      upgrade_ref: [3, 1, 4],
    },
    '0x27DD': {
      name: 'Mail Breaker+5',
      type: [1, 1],
      upgrade_ref: [3, 1, 5],
    },
    '0x27DE': {
      name: 'Mail Breaker+6',
      type: [1, 1],
      upgrade_ref: [3, 1, 6],
    },
    '0x27DF': {
      name: 'Mail Breaker+7',
      type: [1, 1],
      upgrade_ref: [3, 1, 7],
    },
    '0x27E0': {
      name: 'Mail Breaker+8',
      type: [1, 1],
      upgrade_ref: [3, 1, 8],
    },
    '0x27E1': {
      name: 'Mail Breaker+9',
      type: [1, 1],
      upgrade_ref: [3, 1, 9],
    },
    '0x27E2': {
      name: 'Mail Breaker+10',
      type: [1, 1],
      upgrade_ref: [3, 1, 10],
    },
    '0x27E3': {
      name: 'Quality Mail Breaker+1',
      type: [1, 1],
      upgrade_ref: [3, 2, 1],
    },
    '0x27E4': {
      name: 'Quality Mail Breaker+2',
      type: [1, 1],
      upgrade_ref: [3, 2, 2],
    },
    '0x27E5': {
      name: 'Quality Mail Breaker+3',
      type: [1, 1],
      upgrade_ref: [3, 2, 3],
    },
    '0x27E6': {
      name: 'Quality Mail Breaker+4',
      type: [1, 1],
      upgrade_ref: [3, 2, 4],
    },
    '0x27E7': {
      name: 'Quality Mail Breaker+5',
      type: [1, 1],
      upgrade_ref: [3, 2, 5],
    },
    '0x27ED': {
      name: 'Mercury Mail Breaker+1',
      type: [1, 1],
      upgrade_ref: [3, 7, 1],
    },
    '0x27EE': {
      name: 'Mercury Mail Breaker+2',
      type: [1, 1],
      upgrade_ref: [3, 7, 2],
    },
    '0x27EF': {
      name: 'Mercury Mail Breaker+3',
      type: [1, 1],
      upgrade_ref: [3, 7, 3],
    },
    '0x27F0': {
      name: 'Mercury Mail Breaker+4',
      type: [1, 1],
      upgrade_ref: [3, 7, 4],
    },
    '0x27F1': {
      name: 'Mercury Mail Breaker+5',
      type: [1, 1],
      upgrade_ref: [3, 7, 5],
    },
    '0x27F7': {
      name: 'Fatal Mail Breaker+1',
      type: [1, 1],
      upgrade_ref: [3, 8, 1],
    },
    '0x27F8': {
      name: 'Fatal Mail Breaker+2',
      type: [1, 1],
      upgrade_ref: [3, 8, 2],
    },
    '0x27F9': {
      name: 'Fatal Mail Breaker+3',
      type: [1, 1],
      upgrade_ref: [3, 8, 3],
    },
    '0x27FA': {
      name: 'Fatal Mail Breaker+4',
      type: [1, 1],
      upgrade_ref: [3, 8, 4],
    },
    '0x27FB': {
      name: 'Fatal Mail Breaker+5',
      type: [1, 1],
      upgrade_ref: [3, 8, 5],
    },
    '0x2801': {
      name: 'Sharp Mail Breaker+1',
      type: [1, 1],
      upgrade_ref: [3, 4, 1],
    },
    '0x2802': {
      name: 'Sharp Mail Breaker+2',
      type: [1, 1],
      upgrade_ref: [3, 4, 2],
    },
    '0x2803': {
      name: 'Sharp Mail Breaker+3',
      type: [1, 1],
      upgrade_ref: [3, 4, 3],
    },
    '0x2804': {
      name: 'Sharp Mail Breaker+4',
      type: [1, 1],
      upgrade_ref: [3, 4, 4],
    },
    '0x2805': {
      name: 'Sharp Mail Breaker+5',
      type: [1, 1],
      upgrade_ref: [3, 4, 5],
    },
    '0x280B': {
      name: 'Crescent Mail Breaker+1',
      type: [1, 1],
      upgrade_ref: [3, 10, 1],
    },
    '0x280C': {
      name: 'Crescent Mail Breaker+2',
      type: [1, 1],
      upgrade_ref: [3, 10, 2],
    },
    '0x280D': {
      name: 'Crescent Mail Breaker+3',
      type: [1, 1],
      upgrade_ref: [3, 10, 3],
    },
    '0x280E': {
      name: 'Crescent Mail Breaker+4',
      type: [1, 1],
      upgrade_ref: [3, 10, 4],
    },
    '0x280F': {
      name: 'Crescent Mail Breaker+5',
      type: [1, 1],
      upgrade_ref: [3, 10, 5],
    },
    '0x28A0': {
      name: "Baby's Nail",
      type: [1, 1],
      upgrade_ref: [48, 14, 0],
    },
    '0x28A1': {
      name: "Baby's Nail+1",
      type: [1, 1],
      upgrade_ref: [48, 14, 1],
    },
    '0x28A2': {
      name: "Baby's Nail+2",
      type: [1, 1],
      upgrade_ref: [48, 14, 2],
    },
    '0x28A3': {
      name: "Baby's Nail+3",
      type: [1, 1],
      upgrade_ref: [48, 14, 3],
    },
    '0x28A4': {
      name: "Baby's Nail+4",
      type: [1, 1],
      upgrade_ref: [48, 14, 4],
    },
    '0x28A5': {
      name: "Baby's Nail+5",
      type: [1, 1],
      upgrade_ref: [48, 14, 5],
    },
    '0x2904': {
      name: "Geri's Stiletto",
      type: [1, 1],
      upgrade_ref: [53, 14, 0],
    },
    '0x2905': {
      name: "Geri's Stiletto+1",
      type: [1, 1],
      upgrade_ref: [53, 14, 1],
    },
    '0x2906': {
      name: "Geri's Stiletto+2",
      type: [1, 1],
      upgrade_ref: [53, 14, 2],
    },
    '0x2907': {
      name: "Geri's Stiletto+3",
      type: [1, 1],
      upgrade_ref: [53, 14, 3],
    },
    '0x2908': {
      name: "Geri's Stiletto+4",
      type: [1, 1],
      upgrade_ref: [53, 14, 4],
    },
    '0x2909': {
      name: "Geri's Stiletto+5",
      type: [1, 1],
      upgrade_ref: [53, 14, 5],
    },
    '0x2968': {
      name: 'Kris Blade',
      type: [1, 2],
      upgrade_ref: [57, 14, 0],
    },
    '0x2969': {
      name: 'Kris Blade+1',
      type: [1, 2],
      upgrade_ref: [57, 14, 1],
    },
    '0x296A': {
      name: 'Kris Blade+2',
      type: [1, 2],
      upgrade_ref: [57, 14, 2],
    },
    '0x296B': {
      name: 'Kris Blade+3',
      type: [1, 2],
      upgrade_ref: [57, 14, 3],
    },
    '0x296C': {
      name: 'Kris Blade+4',
      type: [1, 2],
      upgrade_ref: [57, 14, 4],
    },
    '0x296D': {
      name: 'Kris Blade+5',
      type: [1, 2],
      upgrade_ref: [57, 14, 5],
    },
    '0x29CC': {
      name: 'Secret Dagger',
      type: [1, 1],
      upgrade_ref: [4, 1, 0],
    },
    '0x29CD': {
      name: 'Secret Dagger+1',
      type: [1, 1],
      upgrade_ref: [4, 1, 1],
    },
    '0x29CE': {
      name: 'Secret Dagger+2',
      type: [1, 1],
      upgrade_ref: [4, 1, 2],
    },
    '0x29CF': {
      name: 'Secret Dagger+3',
      type: [1, 1],
      upgrade_ref: [4, 1, 3],
    },
    '0x29D0': {
      name: 'Secret Dagger+4',
      type: [1, 1],
      upgrade_ref: [4, 1, 4],
    },
    '0x29D1': {
      name: 'Secret Dagger+5',
      type: [1, 1],
      upgrade_ref: [4, 1, 5],
    },
    '0x29D2': {
      name: 'Secret Dagger+6',
      type: [1, 1],
      upgrade_ref: [4, 1, 6],
    },
    '0x29D3': {
      name: 'Secret Dagger+7',
      type: [1, 1],
      upgrade_ref: [4, 1, 7],
    },
    '0x29D4': {
      name: 'Secret Dagger+8',
      type: [1, 1],
      upgrade_ref: [4, 1, 8],
    },
    '0x29D5': {
      name: 'Secret Dagger+9',
      type: [1, 1],
      upgrade_ref: [4, 1, 9],
    },
    '0x29D6': {
      name: 'Secret Dagger+10',
      type: [1, 1],
      upgrade_ref: [4, 1, 10],
    },
    '0x29D7': {
      name: 'Sharp Secret Dagger+1',
      type: [1, 1],
      upgrade_ref: [4, 4, 1],
    },
    '0x29D8': {
      name: 'Sharp Secret Dagger+2',
      type: [1, 1],
      upgrade_ref: [4, 4, 2],
    },
    '0x29D9': {
      name: 'Sharp Secret Dagger+3',
      type: [1, 1],
      upgrade_ref: [4, 4, 3],
    },
    '0x29DA': {
      name: 'Sharp Secret Dagger+4',
      type: [1, 1],
      upgrade_ref: [4, 4, 4],
    },
    '0x29DB': {
      name: 'Sharp Secret Dagger+5',
      type: [1, 1],
      upgrade_ref: [4, 4, 5],
    },
    '0x29E1': {
      name: 'Tearing Dagger+1',
      type: [1, 1],
    },
    '0x29E2': {
      name: 'Tearing Dagger+2',
      type: [1, 1],
    },
    '0x29E3': {
      name: 'Tearing Dagger+3',
      type: [1, 1],
    },
    '0x29EB': {
      name: 'Crescent Secret Dagger+1',
      type: [1, 1],
      upgrade_ref: [4, 10, 1],
    },
    '0x29EC': {
      name: 'Crescent Secret Dagger+2',
      type: [1, 1],
      upgrade_ref: [4, 10, 2],
    },
    '0x29ED': {
      name: 'Crescent Secret Dagger+3',
      type: [1, 1],
      upgrade_ref: [4, 10, 3],
    },
    '0x29EE': {
      name: 'Crescent Secret Dagger+4',
      type: [1, 1],
      upgrade_ref: [4, 10, 4],
    },
    '0x29EF': {
      name: 'Crescent Secret Dagger+5',
      type: [1, 1],
      upgrade_ref: [4, 10, 5],
    },
    '0x29F5': {
      name: 'Quality Secret Dagger+1',
      type: [1, 1],
      upgrade_ref: [4, 2, 1],
    },
    '0x29F6': {
      name: 'Quality Secret Dagger+2',
      type: [1, 1],
      upgrade_ref: [4, 2, 2],
    },
    '0x29F7': {
      name: 'Quality Secret Dagger+3',
      type: [1, 1],
      upgrade_ref: [4, 2, 3],
    },
    '0x29F8': {
      name: 'Quality Secret Dagger+4',
      type: [1, 1],
      upgrade_ref: [4, 2, 4],
    },
    '0x29F9': {
      name: 'Quality Secret Dagger+5',
      type: [1, 1],
      upgrade_ref: [4, 2, 5],
    },
    '0x29FF': {
      name: 'Mercury Secret Dagger+1',
      type: [1, 1],
      upgrade_ref: [4, 7, 1],
    },
    '0x2A00': {
      name: 'Mercury Secret Dagger+2',
      type: [1, 1],
      upgrade_ref: [4, 7, 2],
    },
    '0x2A01': {
      name: 'Mercury Secret Dagger+3',
      type: [1, 1],
      upgrade_ref: [4, 7, 3],
    },
    '0x2A02': {
      name: 'Mercury Secret Dagger+4',
      type: [1, 1],
      upgrade_ref: [4, 7, 4],
    },
    '0x2A03': {
      name: 'Mercury Secret Dagger+5',
      type: [1, 1],
      upgrade_ref: [4, 7, 5],
    },
    '0x2A09': {
      name: 'Fatal Secret Dagger+1',
      type: [1, 1],
      upgrade_ref: [4, 8, 1],
    },
    '0x2A0A': {
      name: 'Fatal Secret Dagger+2',
      type: [1, 1],
      upgrade_ref: [4, 8, 2],
    },
    '0x2A0B': {
      name: 'Fatal Secret Dagger+3',
      type: [1, 1],
      upgrade_ref: [4, 8, 3],
    },
    '0x2A0C': {
      name: 'Fatal Secret Dagger+4',
      type: [1, 1],
      upgrade_ref: [4, 8, 4],
    },
    '0x2A0D': {
      name: 'Fatal Secret Dagger+5',
      type: [1, 1],
      upgrade_ref: [4, 8, 5],
    },
    '0x4A38': {
      name: '_?_?w?Rc   (Ghost dagger)',
      type: [1, 0],
    },
    '0x4E20': {
      name: 'Short Sword',
      type: [1, 2],
      upgrade_ref: [5, 1, 0],
    },
    '0x4E21': {
      name: 'Short Sword+1',
      type: [1, 2],
      upgrade_ref: [5, 1, 1],
    },
    '0x4E22': {
      name: 'Short Sword+2',
      type: [1, 2],
      upgrade_ref: [5, 1, 2],
    },
    '0x4E23': {
      name: 'Short Sword+3',
      type: [1, 2],
      upgrade_ref: [5, 1, 3],
    },
    '0x4E24': {
      name: 'Short Sword+4',
      type: [1, 2],
      upgrade_ref: [5, 1, 4],
    },
    '0x4E25': {
      name: 'Short Sword+5',
      type: [1, 2],
      upgrade_ref: [5, 1, 5],
    },
    '0x4E26': {
      name: 'Short Sword+6',
      type: [1, 2],
      upgrade_ref: [5, 1, 6],
    },
    '0x4E27': {
      name: 'Short Sword+7',
      type: [1, 2],
      upgrade_ref: [5, 1, 7],
    },
    '0x4E28': {
      name: 'Short Sword+8',
      type: [1, 2],
      upgrade_ref: [5, 1, 8],
    },
    '0x4E29': {
      name: 'Short Sword+9',
      type: [1, 2],
      upgrade_ref: [5, 1, 9],
    },
    '0x4E2A': {
      name: 'Short Sword+10',
      type: [1, 2],
      upgrade_ref: [5, 1, 10],
    },
    '0x4E2B': {
      name: 'Quality Short Sword+1',
      type: [1, 2],
      upgrade_ref: [5, 2, 1],
    },
    '0x4E2C': {
      name: 'Quality Short Sword+2',
      type: [1, 2],
      upgrade_ref: [5, 2, 2],
    },
    '0x4E2D': {
      name: 'Quality Short Sword+3',
      type: [1, 2],
      upgrade_ref: [5, 2, 3],
    },
    '0x4E2E': {
      name: 'Quality Short Sword+4',
      type: [1, 2],
      upgrade_ref: [5, 2, 4],
    },
    '0x4E2F': {
      name: 'Quality Short Sword+5',
      type: [1, 2],
      upgrade_ref: [5, 2, 5],
    },
    '0x4E35': {
      name: 'Dragon Short Sword+1',
      type: [1, 2],
      upgrade_ref: [5, 5, 1],
    },
    '0x4E36': {
      name: 'Dragon Short Sword+2',
      type: [1, 2],
      upgrade_ref: [5, 5, 2],
    },
    '0x4E37': {
      name: 'Dragon Short Sword+3',
      type: [1, 2],
      upgrade_ref: [5, 5, 3],
    },
    '0x4E38': {
      name: 'Dragon Short Sword+4',
      type: [1, 2],
      upgrade_ref: [5, 5, 4],
    },
    '0x4E39': {
      name: 'Dragon Short Sword+5',
      type: [1, 2],
      upgrade_ref: [5, 5, 5],
    },
    '0x4E3F': {
      name: 'Moon Short Sword+1',
      type: [1, 2],
      upgrade_ref: [5, 9, 1],
    },
    '0x4E40': {
      name: 'Moon Short Sword+2',
      type: [1, 2],
      upgrade_ref: [5, 9, 2],
    },
    '0x4E41': {
      name: 'Moon Short Sword+3',
      type: [1, 2],
      upgrade_ref: [5, 9, 3],
    },
    '0x4E42': {
      name: 'Moon Short Sword+4',
      type: [1, 2],
      upgrade_ref: [5, 9, 4],
    },
    '0x4E43': {
      name: 'Moon Short Sword+5',
      type: [1, 2],
      upgrade_ref: [5, 9, 5],
    },
    '0x4E49': {
      name: 'Crushing Short Sword+1',
      type: [1, 2],
      upgrade_ref: [5, 3, 1],
    },
    '0x4E4A': {
      name: 'Crushing Short Sword+2',
      type: [1, 2],
      upgrade_ref: [5, 3, 2],
    },
    '0x4E4B': {
      name: 'Crushing Short Sword+3',
      type: [1, 2],
      upgrade_ref: [5, 3, 3],
    },
    '0x4E4C': {
      name: 'Crushing Short Sword+4',
      type: [1, 2],
      upgrade_ref: [5, 3, 4],
    },
    '0x4E4D': {
      name: 'Crushing Short Sword+5',
      type: [1, 2],
      upgrade_ref: [5, 3, 5],
    },
    '0x4E53': {
      name: 'Blessed Short Sword+1',
      type: [1, 2],
      upgrade_ref: [5, 11, 1],
    },
    '0x4E54': {
      name: 'Blessed Short Sword+2',
      type: [1, 2],
      upgrade_ref: [5, 11, 2],
    },
    '0x4E55': {
      name: 'Blessed Short Sword+3',
      type: [1, 2],
      upgrade_ref: [5, 11, 3],
    },
    '0x4E56': {
      name: 'Blessed Short Sword+4',
      type: [1, 2],
      upgrade_ref: [5, 11, 4],
    },
    '0x4E57': {
      name: 'Blessed Short Sword+5',
      type: [1, 2],
      upgrade_ref: [5, 11, 5],
    },
    '0x4E84': {
      name: 'Broadsword',
      type: [1, 2],
      upgrade_ref: [16, 1, 0],
    },
    '0x4E85': {
      name: 'Broadsword+1',
      type: [1, 2],
      upgrade_ref: [16, 1, 1],
    },
    '0x4E86': {
      name: 'Broadsword+2',
      type: [1, 2],
      upgrade_ref: [16, 1, 2],
    },
    '0x4E87': {
      name: 'Broadsword+3',
      type: [1, 2],
      upgrade_ref: [16, 1, 3],
    },
    '0x4E88': {
      name: 'Broadsword+4',
      type: [1, 2],
      upgrade_ref: [16, 1, 4],
    },
    '0x4E89': {
      name: 'Broadsword+5',
      type: [1, 2],
      upgrade_ref: [16, 1, 5],
    },
    '0x4E8A': {
      name: 'Broadsword+6',
      type: [1, 2],
      upgrade_ref: [16, 1, 6],
    },
    '0x4E8B': {
      name: 'Broadsword+7',
      type: [1, 2],
      upgrade_ref: [16, 1, 7],
    },
    '0x4E8C': {
      name: 'Broadsword+8',
      type: [1, 2],
      upgrade_ref: [16, 1, 8],
    },
    '0x4E8D': {
      name: 'Broadsword+9',
      type: [1, 2],
      upgrade_ref: [16, 1, 9],
    },
    '0x4E8E': {
      name: 'Broadsword+10',
      type: [1, 2],
      upgrade_ref: [16, 1, 10],
    },
    '0x4E8F': {
      name: 'Sharp Broadsword+1',
      type: [1, 2],
      upgrade_ref: [16, 4, 1],
    },
    '0x4E90': {
      name: 'Sharp Broadsword+2',
      type: [1, 2],
      upgrade_ref: [16, 4, 2],
    },
    '0x4E91': {
      name: 'Sharp Broadsword+3',
      type: [1, 2],
      upgrade_ref: [16, 4, 3],
    },
    '0x4E92': {
      name: 'Sharp Broadsword+4',
      type: [1, 2],
      upgrade_ref: [16, 4, 4],
    },
    '0x4E93': {
      name: 'Sharp Broadsword+5',
      type: [1, 2],
      upgrade_ref: [16, 4, 5],
    },
    '0x4E99': {
      name: 'Tearing Broadsword+1',
      type: [1, 2],
      upgrade_ref: [16, 6, 1],
    },
    '0x4E9A': {
      name: 'Tearing Broadsword+2',
      type: [1, 2],
      upgrade_ref: [16, 6, 2],
    },
    '0x4E9B': {
      name: 'Tearing Broadsword+3',
      type: [1, 2],
      upgrade_ref: [16, 6, 3],
    },
    '0x4E9C': {
      name: 'Tearing Broadsword+4',
      type: [1, 2],
      upgrade_ref: [16, 6, 4],
    },
    '0x4E9D': {
      name: 'Tearing Broadsword+5',
      type: [1, 2],
      upgrade_ref: [16, 6, 5],
    },
    '0x4EA3': {
      name: 'Crescent Broadsword+1',
      type: [1, 2],
      upgrade_ref: [16, 10, 1],
    },
    '0x4EA4': {
      name: 'Crescent Broadsword+2',
      type: [1, 2],
      upgrade_ref: [16, 10, 2],
    },
    '0x4EA5': {
      name: 'Crescent Broadsword+3',
      type: [1, 2],
      upgrade_ref: [16, 10, 3],
    },
    '0x4EA6': {
      name: 'Crescent Broadsword+4',
      type: [1, 2],
      upgrade_ref: [16, 10, 4],
    },
    '0x4EA7': {
      name: 'Crescent Broadsword+5',
      type: [1, 2],
      upgrade_ref: [16, 10, 5],
    },
    '0x4EAD': {
      name: 'Quality Broadsword+1',
      type: [1, 2],
      upgrade_ref: [16, 2, 1],
    },
    '0x4EAE': {
      name: 'Quality Broadsword+2',
      type: [1, 2],
      upgrade_ref: [16, 2, 2],
    },
    '0x4EAF': {
      name: 'Quality Broadsword+3',
      type: [1, 2],
      upgrade_ref: [16, 2, 3],
    },
    '0x4EB0': {
      name: 'Quality Broadsword+4',
      type: [1, 2],
      upgrade_ref: [16, 2, 4],
    },
    '0x4EB1': {
      name: 'Quality Broadsword+5',
      type: [1, 2],
      upgrade_ref: [16, 2, 5],
    },
    '0x4EB7': {
      name: 'Mercury Broadsword+1',
      type: [1, 2],
      upgrade_ref: [16, 7, 1],
    },
    '0x4EB8': {
      name: 'Mercury Broadsword+2',
      type: [1, 2],
      upgrade_ref: [16, 7, 2],
    },
    '0x4EB9': {
      name: 'Mercury Broadsword+3',
      type: [1, 2],
      upgrade_ref: [16, 7, 3],
    },
    '0x4EBA': {
      name: 'Mercury Broadsword+4',
      type: [1, 2],
      upgrade_ref: [16, 7, 4],
    },
    '0x4EBB': {
      name: 'Mercury Broadsword+5',
      type: [1, 2],
      upgrade_ref: [16, 7, 5],
    },
    '0x4EC1': {
      name: 'Moon Broadsword+1',
      type: [1, 2],
      upgrade_ref: [16, 9, 1],
    },
    '0x4EC2': {
      name: 'Moon Broadsword+2',
      type: [1, 2],
      upgrade_ref: [16, 9, 2],
    },
    '0x4EC3': {
      name: 'Moon Broadsword+3',
      type: [1, 2],
      upgrade_ref: [16, 9, 3],
    },
    '0x4EC4': {
      name: 'Moon Broadsword+4',
      type: [1, 2],
      upgrade_ref: [16, 9, 4],
    },
    '0x4EC5': {
      name: 'Moon Broadsword+5',
      type: [1, 2],
      upgrade_ref: [16, 9, 5],
    },
    '0x4EE8': {
      name: 'Long Sword',
      type: [1, 2],
      upgrade_ref: [6, 1, 0],
    },
    '0x4EE9': {
      name: 'Long Sword+1',
      type: [1, 2],
      upgrade_ref: [6, 1, 1],
    },
    '0x4EEA': {
      name: 'Long Sword+2',
      type: [1, 2],
      upgrade_ref: [6, 1, 2],
    },
    '0x4EEB': {
      name: 'Long Sword+3',
      type: [1, 2],
      upgrade_ref: [6, 1, 3],
    },
    '0x4EEC': {
      name: 'Long Sword+4',
      type: [1, 2],
      upgrade_ref: [6, 1, 4],
    },
    '0x4EED': {
      name: 'Long Sword+5',
      type: [1, 2],
      upgrade_ref: [6, 1, 5],
    },
    '0x4EEE': {
      name: 'Long Sword+6',
      type: [1, 2],
      upgrade_ref: [6, 1, 6],
    },
    '0x4EEF': {
      name: 'Long Sword+7',
      type: [1, 2],
      upgrade_ref: [6, 1, 7],
    },
    '0x4EF0': {
      name: 'Long Sword+8',
      type: [1, 2],
      upgrade_ref: [6, 1, 8],
    },
    '0x4EF1': {
      name: 'Long Sword+9',
      type: [1, 2],
      upgrade_ref: [6, 1, 9],
    },
    '0x4EF2': {
      name: 'Long Sword+10',
      type: [1, 2],
      upgrade_ref: [6, 1, 10],
    },
    '0x4EF3': {
      name: 'Quality Long Sword+1',
      type: [1, 2],
      upgrade_ref: [6, 2, 1],
    },
    '0x4EF4': {
      name: 'Quality Long Sword+2',
      type: [1, 2],
      upgrade_ref: [6, 2, 2],
    },
    '0x4EF5': {
      name: 'Quality Long Sword+3',
      type: [1, 2],
      upgrade_ref: [6, 2, 3],
    },
    '0x4EF6': {
      name: 'Quality Long Sword+4',
      type: [1, 2],
      upgrade_ref: [6, 2, 4],
    },
    '0x4EF7': {
      name: 'Quality Long Sword+5',
      type: [1, 2],
      upgrade_ref: [6, 2, 5],
    },
    '0x4EFD': {
      name: 'Dragon Long Sword+1',
      type: [1, 2],
      upgrade_ref: [6, 5, 1],
    },
    '0x4EFE': {
      name: 'Dragon Long Sword+2',
      type: [1, 2],
      upgrade_ref: [6, 5, 2],
    },
    '0x4EFF': {
      name: 'Dragon Long Sword+3',
      type: [1, 2],
      upgrade_ref: [6, 5, 3],
    },
    '0x4F00': {
      name: 'Dragon Long Sword+4',
      type: [1, 2],
      upgrade_ref: [6, 5, 4],
    },
    '0x4F01': {
      name: 'Dragon Long Sword+5',
      type: [1, 2],
      upgrade_ref: [6, 5, 5],
    },
    '0x4F07': {
      name: 'Moon Long Sword+1',
      type: [1, 2],
      upgrade_ref: [6, 9, 1],
    },
    '0x4F08': {
      name: 'Moon Long Sword+2',
      type: [1, 2],
      upgrade_ref: [6, 9, 2],
    },
    '0x4F09': {
      name: 'Moon Long Sword+3',
      type: [1, 2],
      upgrade_ref: [6, 9, 3],
    },
    '0x4F0A': {
      name: 'Moon Long Sword+4',
      type: [1, 2],
      upgrade_ref: [6, 9, 4],
    },
    '0x4F0B': {
      name: 'Moon Long Sword+5',
      type: [1, 2],
      upgrade_ref: [6, 9, 5],
    },
    '0x4F11': {
      name: 'Crushing Long Sword+1',
      type: [1, 2],
      upgrade_ref: [6, 3, 1],
    },
    '0x4F12': {
      name: 'Crushing Long Sword+2',
      type: [1, 2],
      upgrade_ref: [6, 3, 2],
    },
    '0x4F13': {
      name: 'Crushing Long Sword+3',
      type: [1, 2],
      upgrade_ref: [6, 3, 3],
    },
    '0x4F14': {
      name: 'Crushing Long Sword+4',
      type: [1, 2],
      upgrade_ref: [6, 3, 4],
    },
    '0x4F15': {
      name: 'Crushing Long Sword+5',
      type: [1, 2],
      upgrade_ref: [6, 3, 5],
    },
    '0x4F1B': {
      name: 'Blessed Long Sword+1',
      type: [1, 2],
      upgrade_ref: [6, 11, 1],
    },
    '0x4F1C': {
      name: 'Blessed Long Sword+2',
      type: [1, 2],
      upgrade_ref: [6, 11, 2],
    },
    '0x4F1D': {
      name: 'Blessed Long Sword+3',
      type: [1, 2],
      upgrade_ref: [6, 11, 3],
    },
    '0x4F1E': {
      name: 'Blessed Long Sword+4',
      type: [1, 2],
      upgrade_ref: [6, 11, 4],
    },
    '0x4F1F': {
      name: 'Blessed Long Sword+5',
      type: [1, 2],
      upgrade_ref: [6, 11, 5],
    },
    '0x4F4C': {
      name: 'Flamberge',
      type: [1, 3],
      upgrade_ref: [10, 1, 0],
    },
    '0x4F4D': {
      name: 'Flamberge+1',
      type: [1, 3],
      upgrade_ref: [10, 1, 1],
    },
    '0x4F4E': {
      name: 'Flamberge+2',
      type: [1, 3],
      upgrade_ref: [10, 1, 2],
    },
    '0x4F4F': {
      name: 'Flamberge+3',
      type: [1, 3],
      upgrade_ref: [10, 1, 3],
    },
    '0x4F50': {
      name: 'Flamberge+4',
      type: [1, 3],
      upgrade_ref: [10, 1, 4],
    },
    '0x4F51': {
      name: 'Flamberge+5',
      type: [1, 3],
      upgrade_ref: [10, 1, 5],
    },
    '0x4F52': {
      name: 'Flamberge+6',
      type: [1, 3],
      upgrade_ref: [10, 1, 6],
    },
    '0x4F53': {
      name: 'Flamberge+7',
      type: [1, 3],
      upgrade_ref: [10, 1, 7],
    },
    '0x4F54': {
      name: 'Flamberge+8',
      type: [1, 3],
      upgrade_ref: [10, 1, 8],
    },
    '0x4F55': {
      name: 'Flamberge+9',
      type: [1, 3],
      upgrade_ref: [10, 1, 9],
    },
    '0x4F56': {
      name: 'Flamberge+10',
      type: [1, 3],
      upgrade_ref: [10, 1, 10],
    },
    '0x4F57': {
      name: 'Sharp Flamberge+1',
      type: [1, 3],
      upgrade_ref: [10, 4, 1],
    },
    '0x4F58': {
      name: 'Sharp Flamberge+2',
      type: [1, 3],
      upgrade_ref: [10, 4, 2],
    },
    '0x4F59': {
      name: 'Sharp Flamberge+3',
      type: [1, 3],
      upgrade_ref: [10, 4, 3],
    },
    '0x4F5A': {
      name: 'Sharp Flamberge+4',
      type: [1, 3],
      upgrade_ref: [10, 4, 4],
    },
    '0x4F5B': {
      name: 'Sharp Flamberge+5',
      type: [1, 3],
      upgrade_ref: [10, 4, 5],
    },
    '0x4F61': {
      name: 'Tearing Flamberge+1',
      type: [1, 3],
      upgrade_ref: [10, 6, 1],
    },
    '0x4F62': {
      name: 'Tearing Flamberge+2',
      type: [1, 3],
      upgrade_ref: [10, 6, 2],
    },
    '0x4F63': {
      name: 'Tearing Flamberge+3',
      type: [1, 3],
      upgrade_ref: [10, 6, 3],
    },
    '0x4F64': {
      name: 'Tearing Flamberge+4',
      type: [1, 3],
      upgrade_ref: [10, 6, 4],
    },
    '0x4F65': {
      name: 'Tearing Flamberge+5',
      type: [1, 3],
      upgrade_ref: [10, 6, 5],
    },
    '0x4F6B': {
      name: 'Crescent Flamberge+1',
      type: [1, 3],
      upgrade_ref: [10, 10, 1],
    },
    '0x4F6C': {
      name: 'Crescent Flamberge+2',
      type: [1, 3],
      upgrade_ref: [10, 10, 2],
    },
    '0x4F6D': {
      name: 'Crescent Flamberge+3',
      type: [1, 3],
      upgrade_ref: [10, 10, 3],
    },
    '0x4F6E': {
      name: 'Crescent Flamberge+4',
      type: [1, 3],
      upgrade_ref: [10, 10, 4],
    },
    '0x4F6F': {
      name: 'Crescent Flamberge+5',
      type: [1, 3],
      upgrade_ref: [10, 10, 5],
    },
    '0x4F75': {
      name: 'Quality Flamberge+1',
      type: [1, 3],
      upgrade_ref: [10, 2, 1],
    },
    '0x4F76': {
      name: 'Quality Flamberge+2',
      type: [1, 3],
      upgrade_ref: [10, 2, 2],
    },
    '0x4F77': {
      name: 'Quality Flamberge+3',
      type: [1, 3],
      upgrade_ref: [10, 2, 3],
    },
    '0x4F78': {
      name: 'Quality Flamberge+4',
      type: [1, 3],
      upgrade_ref: [10, 2, 4],
    },
    '0x4F79': {
      name: 'Quality Flamberge+5',
      type: [1, 3],
      upgrade_ref: [10, 2, 5],
    },
    '0x4F7F': {
      name: 'Mercury Flamberge+1',
      type: [1, 3],
      upgrade_ref: [10, 7, 1],
    },
    '0x4F80': {
      name: 'Mercury Flamberge+2',
      type: [1, 3],
      upgrade_ref: [10, 7, 2],
    },
    '0x4F81': {
      name: 'Mercury Flamberge+3',
      type: [1, 3],
      upgrade_ref: [10, 7, 3],
    },
    '0x4F82': {
      name: 'Mercury Flamberge+4',
      type: [1, 3],
      upgrade_ref: [10, 7, 4],
    },
    '0x4F83': {
      name: 'Mercury Flamberge+5',
      type: [1, 3],
      upgrade_ref: [10, 7, 5],
    },
    '0x4F89': {
      name: 'Moon Flamberge+1',
      type: [1, 3],
      upgrade_ref: [10, 9, 1],
    },
    '0x4F8A': {
      name: 'Moon Flamberge+2',
      type: [1, 3],
      upgrade_ref: [10, 9, 2],
    },
    '0x4F8B': {
      name: 'Moon Flamberge+3',
      type: [1, 3],
      upgrade_ref: [10, 9, 3],
    },
    '0x4F8C': {
      name: 'Moon Flamberge+4',
      type: [1, 3],
      upgrade_ref: [10, 9, 4],
    },
    '0x4F8D': {
      name: 'Moon Flamberge+5',
      type: [1, 3],
      upgrade_ref: [10, 9, 5],
    },
    '0x4FB0': {
      name: 'Bastard Sword',
      type: [1, 3],
      upgrade_ref: [8, 1, 0],
    },
    '0x4FB1': {
      name: 'Bastard Sword+1',
      type: [1, 3],
      upgrade_ref: [8, 1, 1],
    },
    '0x4FB2': {
      name: 'Bastard Sword+2',
      type: [1, 3],
      upgrade_ref: [8, 1, 2],
    },
    '0x4FB3': {
      name: 'Bastard Sword+3',
      type: [1, 3],
      upgrade_ref: [8, 1, 3],
    },
    '0x4FB4': {
      name: 'Bastard Sword+4',
      type: [1, 3],
      upgrade_ref: [8, 1, 4],
    },
    '0x4FB5': {
      name: 'Bastard Sword+5',
      type: [1, 3],
      upgrade_ref: [8, 1, 5],
    },
    '0x4FB6': {
      name: 'Bastard Sword+6',
      type: [1, 3],
      upgrade_ref: [8, 1, 6],
    },
    '0x4FB7': {
      name: 'Bastard Sword+7',
      type: [1, 3],
      upgrade_ref: [8, 1, 7],
    },
    '0x4FB8': {
      name: 'Bastard Sword+8',
      type: [1, 3],
      upgrade_ref: [8, 1, 8],
    },
    '0x4FB9': {
      name: 'Bastard Sword+9',
      type: [1, 3],
      upgrade_ref: [8, 1, 9],
    },
    '0x4FBA': {
      name: 'Bastard Sword+10',
      type: [1, 3],
      upgrade_ref: [8, 1, 10],
    },
    '0x4FBB': {
      name: 'Quality Bastard Sword+1',
      type: [1, 3],
      upgrade_ref: [8, 2, 1],
    },
    '0x4FBC': {
      name: 'Quality Bastard Sword+2',
      type: [1, 3],
      upgrade_ref: [8, 2, 2],
    },
    '0x4FBD': {
      name: 'Quality Bastard Sword+3',
      type: [1, 3],
      upgrade_ref: [8, 2, 3],
    },
    '0x4FBE': {
      name: 'Quality Bastard Sword+4',
      type: [1, 3],
      upgrade_ref: [8, 2, 4],
    },
    '0x4FBF': {
      name: 'Quality Bastard Sword+5',
      type: [1, 3],
      upgrade_ref: [8, 2, 5],
    },
    '0x4FC5': {
      name: 'Dragon Bastard Sword+1',
      type: [1, 3],
      upgrade_ref: [8, 5, 1],
    },
    '0x4FC6': {
      name: 'Dragon Bastard Sword+2',
      type: [1, 3],
      upgrade_ref: [8, 5, 2],
    },
    '0x4FC7': {
      name: 'Dragon Bastard Sword+3',
      type: [1, 3],
      upgrade_ref: [8, 5, 3],
    },
    '0x4FC8': {
      name: 'Dragon Bastard Sword+4',
      type: [1, 3],
      upgrade_ref: [8, 5, 4],
    },
    '0x4FC9': {
      name: 'Dragon Bastard Sword+5',
      type: [1, 3],
      upgrade_ref: [8, 5, 5],
    },
    '0x4FCF': {
      name: 'Moon Bastard Sword+1',
      type: [1, 3],
      upgrade_ref: [8, 9, 1],
    },
    '0x4FD0': {
      name: 'Moon Bastard Sword+2',
      type: [1, 3],
      upgrade_ref: [8, 9, 2],
    },
    '0x4FD1': {
      name: 'Moon Bastard Sword+3',
      type: [1, 3],
      upgrade_ref: [8, 9, 3],
    },
    '0x4FD2': {
      name: 'Moon Bastard Sword+4',
      type: [1, 3],
      upgrade_ref: [8, 9, 4],
    },
    '0x4FD3': {
      name: 'Moon Bastard Sword+5',
      type: [1, 3],
      upgrade_ref: [8, 9, 5],
    },
    '0x4FD9': {
      name: 'Crushing Bastard Sword+1',
      type: [1, 3],
      upgrade_ref: [8, 3, 1],
    },
    '0x4FDA': {
      name: 'Crushing Bastard Sword+2',
      type: [1, 3],
      upgrade_ref: [8, 3, 2],
    },
    '0x4FDB': {
      name: 'Crushing Bastard Sword+3',
      type: [1, 3],
      upgrade_ref: [8, 3, 3],
    },
    '0x4FDC': {
      name: 'Crushing Bastard Sword+4',
      type: [1, 3],
      upgrade_ref: [8, 3, 4],
    },
    '0x4FDD': {
      name: 'Crushing Bastard Sword+5',
      type: [1, 3],
      upgrade_ref: [8, 3, 5],
    },
    '0x4FE3': {
      name: 'Blessed Bastard Sword+1',
      type: [1, 3],
      upgrade_ref: [8, 11, 1],
    },
    '0x4FE4': {
      name: 'Blessed Bastard Sword+2',
      type: [1, 3],
      upgrade_ref: [8, 11, 2],
    },
    '0x4FE5': {
      name: 'Blessed Bastard Sword+3',
      type: [1, 3],
      upgrade_ref: [8, 11, 3],
    },
    '0x4FE6': {
      name: 'Blessed Bastard Sword+4',
      type: [1, 3],
      upgrade_ref: [8, 11, 4],
    },
    '0x4FE7': {
      name: 'Blessed Bastard Sword+5',
      type: [1, 3],
      upgrade_ref: [8, 11, 5],
    },
    '0x5014': {
      name: 'Claymore',
      type: [1, 3],
      upgrade_ref: [9, 1, 0],
    },
    '0x5015': {
      name: 'Claymore+1',
      type: [1, 3],
      upgrade_ref: [9, 1, 1],
    },
    '0x5016': {
      name: 'Claymore+2',
      type: [1, 3],
      upgrade_ref: [9, 1, 2],
    },
    '0x5017': {
      name: 'Claymore+3',
      type: [1, 3],
      upgrade_ref: [9, 1, 3],
    },
    '0x5018': {
      name: 'Claymore+4',
      type: [1, 3],
      upgrade_ref: [9, 1, 4],
    },
    '0x5019': {
      name: 'Claymore+5',
      type: [1, 3],
      upgrade_ref: [9, 1, 5],
    },
    '0x501A': {
      name: 'Claymore+6',
      type: [1, 3],
      upgrade_ref: [9, 1, 6],
    },
    '0x501B': {
      name: 'Claymore+7',
      type: [1, 3],
      upgrade_ref: [9, 1, 7],
    },
    '0x501C': {
      name: 'Claymore+8',
      type: [1, 3],
      upgrade_ref: [9, 1, 8],
    },
    '0x501D': {
      name: 'Claymore+9',
      type: [1, 3],
      upgrade_ref: [9, 1, 9],
    },
    '0x501E': {
      name: 'Claymore+10',
      type: [1, 3],
      upgrade_ref: [9, 1, 10],
    },
    '0x501F': {
      name: 'Quality Claymore+1',
      type: [1, 3],
      upgrade_ref: [9, 2, 1],
    },
    '0x5020': {
      name: 'Quality Claymore+2',
      type: [1, 3],
      upgrade_ref: [9, 2, 2],
    },
    '0x5021': {
      name: 'Quality Claymore+3',
      type: [1, 3],
      upgrade_ref: [9, 2, 3],
    },
    '0x5022': {
      name: 'Quality Claymore+4',
      type: [1, 3],
      upgrade_ref: [9, 2, 4],
    },
    '0x5023': {
      name: 'Quality Claymore+5',
      type: [1, 3],
      upgrade_ref: [9, 2, 5],
    },
    '0x5029': {
      name: 'Dragon Claymore+1',
      type: [1, 3],
      upgrade_ref: [9, 5, 1],
    },
    '0x502A': {
      name: 'Dragon Claymore+2',
      type: [1, 3],
      upgrade_ref: [9, 5, 2],
    },
    '0x502B': {
      name: 'Dragon Claymore+3',
      type: [1, 3],
      upgrade_ref: [9, 5, 3],
    },
    '0x502C': {
      name: 'Dragon Claymore+4',
      type: [1, 3],
      upgrade_ref: [9, 5, 4],
    },
    '0x502D': {
      name: 'Dragon Claymore+5',
      type: [1, 3],
      upgrade_ref: [9, 5, 5],
    },
    '0x5033': {
      name: 'Moon Claymore+1',
      type: [1, 3],
      upgrade_ref: [9, 9, 1],
    },
    '0x5034': {
      name: 'Moon Claymore+2',
      type: [1, 3],
      upgrade_ref: [9, 9, 2],
    },
    '0x5035': {
      name: 'Moon Claymore+3',
      type: [1, 3],
      upgrade_ref: [9, 9, 3],
    },
    '0x5036': {
      name: 'Moon Claymore+4',
      type: [1, 3],
      upgrade_ref: [9, 9, 4],
    },
    '0x5037': {
      name: 'Moon Claymore+5',
      type: [1, 3],
      upgrade_ref: [9, 9, 5],
    },
    '0x503D': {
      name: 'Crushing Claymore+1',
      type: [1, 3],
      upgrade_ref: [9, 3, 1],
    },
    '0x503E': {
      name: 'Crushing Claymore+2',
      type: [1, 3],
      upgrade_ref: [9, 3, 2],
    },
    '0x503F': {
      name: 'Crushing Claymore+3',
      type: [1, 3],
      upgrade_ref: [9, 3, 3],
    },
    '0x5040': {
      name: 'Crushing Claymore+4',
      type: [1, 3],
      upgrade_ref: [9, 3, 4],
    },
    '0x5041': {
      name: 'Crushing Claymore+5',
      type: [1, 3],
      upgrade_ref: [9, 3, 5],
    },
    '0x5047': {
      name: 'Blessed Claymore+1',
      type: [1, 3],
      upgrade_ref: [9, 11, 1],
    },
    '0x5048': {
      name: 'Blessed Claymore+2',
      type: [1, 3],
      upgrade_ref: [9, 11, 2],
    },
    '0x5049': {
      name: 'Blessed Claymore+3',
      type: [1, 3],
      upgrade_ref: [9, 11, 3],
    },
    '0x504A': {
      name: 'Blessed Claymore+4',
      type: [1, 3],
      upgrade_ref: [9, 11, 4],
    },
    '0x504B': {
      name: 'Blessed Claymore+5',
      type: [1, 3],
      upgrade_ref: [9, 11, 5],
    },
    '0x5078': {
      name: 'Great Sword',
      type: [1, 4],
      upgrade_ref: [11, 1, 0],
    },
    '0x5079': {
      name: 'Great Sword+1',
      type: [1, 4],
      upgrade_ref: [11, 1, 1],
    },
    '0x507A': {
      name: 'Great Sword+2',
      type: [1, 4],
      upgrade_ref: [11, 1, 2],
    },
    '0x507B': {
      name: 'Great Sword+3',
      type: [1, 4],
      upgrade_ref: [11, 1, 3],
    },
    '0x507C': {
      name: 'Great Sword+4',
      type: [1, 4],
      upgrade_ref: [11, 1, 4],
    },
    '0x507D': {
      name: 'Great Sword+5',
      type: [1, 4],
      upgrade_ref: [11, 1, 5],
    },
    '0x507E': {
      name: 'Great Sword+6',
      type: [1, 4],
      upgrade_ref: [11, 1, 6],
    },
    '0x507F': {
      name: 'Great Sword+7',
      type: [1, 4],
      upgrade_ref: [11, 1, 7],
    },
    '0x5080': {
      name: 'Great Sword+8',
      type: [1, 4],
      upgrade_ref: [11, 1, 8],
    },
    '0x5081': {
      name: 'Great Sword+9',
      type: [1, 4],
      upgrade_ref: [11, 1, 9],
    },
    '0x5082': {
      name: 'Great Sword+10',
      type: [1, 4],
      upgrade_ref: [11, 1, 10],
    },
    '0x5083': {
      name: 'Quality Great Sword+1',
      type: [1, 4],
      upgrade_ref: [11, 2, 1],
    },
    '0x5084': {
      name: 'Quality Great Sword+2',
      type: [1, 4],
      upgrade_ref: [11, 2, 2],
    },
    '0x5085': {
      name: 'Quality Great Sword+3',
      type: [1, 4],
      upgrade_ref: [11, 2, 3],
    },
    '0x5086': {
      name: 'Quality Great Sword+4',
      type: [1, 4],
      upgrade_ref: [11, 2, 4],
    },
    '0x5087': {
      name: 'Quality Great Sword+5',
      type: [1, 4],
      upgrade_ref: [11, 2, 5],
    },
    '0x508D': {
      name: 'Dragon Great Sword+1',
      type: [1, 4],
      upgrade_ref: [11, 5, 1],
    },
    '0x508E': {
      name: 'Dragon Great Sword+2',
      type: [1, 4],
      upgrade_ref: [11, 5, 2],
    },
    '0x508F': {
      name: 'Dragon Great Sword+3',
      type: [1, 4],
      upgrade_ref: [11, 5, 3],
    },
    '0x5090': {
      name: 'Dragon Great Sword+4',
      type: [1, 4],
      upgrade_ref: [11, 5, 4],
    },
    '0x5091': {
      name: 'Dragon Great Sword+5',
      type: [1, 4],
      upgrade_ref: [11, 5, 5],
    },
    '0x5097': {
      name: 'Moon Great Sword+1',
      type: [1, 4],
      upgrade_ref: [11, 9, 1],
    },
    '0x5098': {
      name: 'Moon Great Sword+2',
      type: [1, 4],
      upgrade_ref: [11, 9, 2],
    },
    '0x5099': {
      name: 'Moon Great Sword+3',
      type: [1, 4],
      upgrade_ref: [11, 9, 3],
    },
    '0x509A': {
      name: 'Moon Great Sword+4',
      type: [1, 4],
      upgrade_ref: [11, 9, 4],
    },
    '0x509B': {
      name: 'Moon Great Sword+5',
      type: [1, 4],
      upgrade_ref: [11, 9, 5],
    },
    '0x50A1': {
      name: 'Crushing Great Sword+1',
      type: [1, 4],
      upgrade_ref: [11, 3, 1],
    },
    '0x50A2': {
      name: 'Crushing Great Sword+2',
      type: [1, 4],
      upgrade_ref: [11, 3, 2],
    },
    '0x50A3': {
      name: 'Crushing Great Sword+3',
      type: [1, 4],
      upgrade_ref: [11, 3, 3],
    },
    '0x50A4': {
      name: 'Crushing Great Sword+4',
      type: [1, 4],
      upgrade_ref: [11, 3, 4],
    },
    '0x50A5': {
      name: 'Crushing Great Sword+5',
      type: [1, 4],
      upgrade_ref: [11, 3, 5],
    },
    '0x50AB': {
      name: 'Blessed Great Sword+1',
      type: [1, 4],
      upgrade_ref: [11, 11, 1],
    },
    '0x50AC': {
      name: 'Blessed Great Sword+2',
      type: [1, 4],
      upgrade_ref: [11, 11, 2],
    },
    '0x50AD': {
      name: 'Blessed Great Sword+3',
      type: [1, 4],
      upgrade_ref: [11, 11, 3],
    },
    '0x50AE': {
      name: 'Blessed Great Sword+4',
      type: [1, 4],
      upgrade_ref: [11, 11, 4],
    },
    '0x50AF': {
      name: 'Blessed Great Sword+5',
      type: [1, 4],
      upgrade_ref: [11, 11, 5],
    },
    '0x50DC': {
      name: 'Dragon Bone Smasher',
      type: [1, 4],
      upgrade_ref: [51, 14, 0],
    },
    '0x50DD': {
      name: 'Dragon Bone Smasher+1',
      type: [1, 4],
      upgrade_ref: [51, 14, 1],
    },
    '0x50DE': {
      name: 'Dragon Bone Smasher+2',
      type: [1, 4],
      upgrade_ref: [51, 14, 2],
    },
    '0x50DF': {
      name: 'Dragon Bone Smasher+3',
      type: [1, 4],
      upgrade_ref: [51, 14, 3],
    },
    '0x50E0': {
      name: 'Dragon Bone Smasher+4',
      type: [1, 4],
      upgrade_ref: [51, 14, 4],
    },
    '0x50E1': {
      name: 'Dragon Bone Smasher+5',
      type: [1, 4],
      upgrade_ref: [51, 14, 5],
    },
    '0x5140': {
      name: 'Rune Sword',
      type: [1, 3],
      upgrade_ref: [62, 14, 0],
    },
    '0x5141': {
      name: 'Rune Sword+1',
      type: [1, 3],
      upgrade_ref: [62, 14, 1],
    },
    '0x5142': {
      name: 'Rune Sword+2',
      type: [1, 3],
      upgrade_ref: [62, 14, 2],
    },
    '0x5143': {
      name: 'Rune Sword+3',
      type: [1, 3],
      upgrade_ref: [62, 14, 3],
    },
    '0x5144': {
      name: 'Rune Sword+4',
      type: [1, 3],
      upgrade_ref: [62, 14, 4],
    },
    '0x5145': {
      name: 'Rune Sword+5',
      type: [1, 3],
      upgrade_ref: [62, 14, 5],
    },
    '0x51A4': {
      name: 'Soulbrandt',
      type: [1, 4],
      upgrade_ref: [77, null, null],
    },
    '0x5208': {
      name: 'Demonbrandt',
      type: [1, 4],
      upgrade_ref: [78, null, null],
    },
    '0x526C': {
      name: 'Storm Ruler',
      type: [1, 3],
      upgrade_ref: [80, null, null],
    },
    '0x526D': {
      name: 'Storm Ruler',
      type: [1, 3],
    },
    '0x526E': {
      name: 'Storm Ruler',
      type: [1, 3],
    },
    '0x526F': {
      name: 'Storm Ruler',
      type: [1, 3],
    },
    '0x5270': {
      name: 'Storm Ruler',
      type: [1, 3],
    },
    '0x5271': {
      name: 'Storm Ruler',
      type: [1, 3],
    },
    '0x5272': {
      name: 'Storm Ruler',
      type: [1, 3],
    },
    '0x5273': {
      name: 'Storm Ruler',
      type: [1, 3],
    },
    '0x5334': {
      name: 'Knight Sword',
      type: [1, 2],
      upgrade_ref: [7, 1, 0],
    },
    '0x5335': {
      name: 'Knight Sword+1',
      type: [1, 2],
      upgrade_ref: [7, 1, 1],
    },
    '0x5336': {
      name: 'Knight Sword+2',
      type: [1, 2],
      upgrade_ref: [7, 1, 2],
    },
    '0x5337': {
      name: 'Knight Sword+3',
      type: [1, 2],
      upgrade_ref: [7, 1, 3],
    },
    '0x5338': {
      name: 'Knight Sword+4',
      type: [1, 2],
      upgrade_ref: [7, 1, 4],
    },
    '0x5339': {
      name: 'Knight Sword+5',
      type: [1, 2],
      upgrade_ref: [7, 1, 5],
    },
    '0x533A': {
      name: 'Knight Sword+6',
      type: [1, 2],
      upgrade_ref: [7, 1, 6],
    },
    '0x533B': {
      name: 'Knight Sword+7',
      type: [1, 2],
      upgrade_ref: [7, 1, 7],
    },
    '0x533C': {
      name: 'Knight Sword+8',
      type: [1, 2],
      upgrade_ref: [7, 1, 8],
    },
    '0x533D': {
      name: 'Knight Sword+9',
      type: [1, 2],
      upgrade_ref: [7, 1, 9],
    },
    '0x533E': {
      name: 'Knight Sword+10',
      type: [1, 2],
      upgrade_ref: [7, 1, 10],
    },
    '0x533F': {
      name: 'Quality Knight Sword+1',
      type: [1, 2],
      upgrade_ref: [7, 2, 1],
    },
    '0x5340': {
      name: 'Quality Knight Sword+2',
      type: [1, 2],
      upgrade_ref: [7, 2, 2],
    },
    '0x5341': {
      name: 'Quality Knight Sword+3',
      type: [1, 2],
      upgrade_ref: [7, 2, 3],
    },
    '0x5342': {
      name: 'Quality Knight Sword+4',
      type: [1, 2],
      upgrade_ref: [7, 2, 4],
    },
    '0x5343': {
      name: 'Quality Knight Sword+5',
      type: [1, 2],
      upgrade_ref: [7, 2, 5],
    },
    '0x5349': {
      name: 'Dragon Knight Sword+1',
      type: [1, 2],
      upgrade_ref: [7, 5, 1],
    },
    '0x534A': {
      name: 'Dragon Knight Sword+2',
      type: [1, 2],
      upgrade_ref: [7, 5, 2],
    },
    '0x534B': {
      name: 'Dragon Knight Sword+3',
      type: [1, 2],
      upgrade_ref: [7, 5, 3],
    },
    '0x534C': {
      name: 'Dragon Knight Sword+4',
      type: [1, 2],
      upgrade_ref: [7, 5, 4],
    },
    '0x534D': {
      name: 'Dragon Knight Sword+5',
      type: [1, 2],
      upgrade_ref: [7, 5, 5],
    },
    '0x5353': {
      name: 'Moon Knight Sword+1',
      type: [1, 2],
      upgrade_ref: [7, 9, 1],
    },
    '0x5354': {
      name: 'Moon Knight Sword+2',
      type: [1, 2],
      upgrade_ref: [7, 9, 2],
    },
    '0x5355': {
      name: 'Moon Knight Sword+3',
      type: [1, 2],
      upgrade_ref: [7, 9, 3],
    },
    '0x5356': {
      name: 'Moon Knight Sword+4',
      type: [1, 2],
      upgrade_ref: [7, 9, 4],
    },
    '0x5357': {
      name: 'Moon Knight Sword+5',
      type: [1, 2],
      upgrade_ref: [7, 9, 5],
    },
    '0x535D': {
      name: 'Crushing Knight Sword+1',
      type: [1, 2],
      upgrade_ref: [7, 3, 1],
    },
    '0x535E': {
      name: 'Crushing Knight Sword+2',
      type: [1, 2],
      upgrade_ref: [7, 3, 2],
    },
    '0x535F': {
      name: 'Crushing Knight Sword+3',
      type: [1, 2],
      upgrade_ref: [7, 3, 3],
    },
    '0x5360': {
      name: 'Crushing Knight Sword+4',
      type: [1, 2],
      upgrade_ref: [7, 3, 4],
    },
    '0x5361': {
      name: 'Crushing Knight Sword+5',
      type: [1, 2],
      upgrade_ref: [7, 3, 5],
    },
    '0x5367': {
      name: 'Blessed Knight Sword+1',
      type: [1, 2],
      upgrade_ref: [7, 11, 1],
    },
    '0x5368': {
      name: 'Blessed Knight Sword+2',
      type: [1, 2],
      upgrade_ref: [7, 11, 2],
    },
    '0x5369': {
      name: 'Blessed Knight Sword+3',
      type: [1, 2],
      upgrade_ref: [7, 11, 3],
    },
    '0x536A': {
      name: 'Blessed Knight Sword+4',
      type: [1, 2],
      upgrade_ref: [7, 11, 4],
    },
    '0x536B': {
      name: 'Blessed Knight Sword+5',
      type: [1, 2],
      upgrade_ref: [7, 11, 5],
    },
    '0x5398': {
      name: 'Broken Sword',
      type: [1, 2],
      upgrade_ref: [81, null, null],
    },
    '0x53FC': {
      name: 'Northern Regalia',
      type: [1, 4],
      upgrade_ref: [79, null, null],
    },
    '0x53FD': {
      name: 'Northern Regalia',
      type: [1, 4],
    },
    '0x5460': {
      name: 'Large Sword of Moonlight',
      type: [1, 3],
      upgrade_ref: [58, 14, 0],
    },
    '0x5461': {
      name: 'Large Sword of Moonlight+1',
      type: [1, 3],
      upgrade_ref: [58, 14, 1],
    },
    '0x5462': {
      name: 'Large Sword of Moonlight+2',
      type: [1, 3],
      upgrade_ref: [58, 14, 2],
    },
    '0x5463': {
      name: 'Large Sword of Moonlight+3',
      type: [1, 3],
      upgrade_ref: [58, 14, 3],
    },
    '0x5464': {
      name: 'Large Sword of Moonlight+4',
      type: [1, 3],
      upgrade_ref: [58, 14, 4],
    },
    '0x5465': {
      name: 'Large Sword of Moonlight+5',
      type: [1, 3],
      upgrade_ref: [58, 14, 5],
    },
    '0x54C4': {
      name: 'Blueblood Sword',
      type: [1, 2],
      upgrade_ref: [82, null, null],
    },
    '0x5528': {
      name: 'Penetrating Sword',
      type: [1, 2],
      upgrade_ref: [60, 14, 0],
    },
    '0x5529': {
      name: 'Penetrating Sword+1',
      type: [1, 2],
      upgrade_ref: [60, 14, 1],
    },
    '0x552A': {
      name: 'Penetrating Sword+2',
      type: [1, 2],
      upgrade_ref: [60, 14, 2],
    },
    '0x552B': {
      name: 'Penetrating Sword+3',
      type: [1, 2],
      upgrade_ref: [60, 14, 3],
    },
    '0x552C': {
      name: 'Penetrating Sword+4',
      type: [1, 2],
      upgrade_ref: [60, 14, 4],
    },
    '0x552D': {
      name: 'Penetrating Sword+5',
      type: [1, 2],
      upgrade_ref: [60, 14, 5],
    },
    '0x558C': {
      name: 'Morion Blade',
      type: [1, 3],
      upgrade_ref: [83, null, null],
    },
    '0x558D': {
      name: 'Morion Blade',
      type: [1, 3],
    },
    '0x558E': {
      name: 'Morion Blade',
      type: [1, 3],
    },
    '0x558F': {
      name: 'Morion Blade',
      type: [1, 3],
    },
    '0x5590': {
      name: 'Morion Blade',
      type: [1, 3],
    },
    '0x5591': {
      name: 'Morion Blade',
      type: [1, 3],
    },
    '0x7148': {
      name: '_?_?v?Rc    (Ghost Sword)',
      type: [1, 0],
    },
    '0x7530': {
      name: 'Rapier',
      type: [1, 7],
      upgrade_ref: [18, 1, 0],
    },
    '0x7531': {
      name: 'Rapier+1',
      type: [1, 7],
      upgrade_ref: [18, 1, 1],
    },
    '0x7532': {
      name: 'Rapier+2',
      type: [1, 7],
      upgrade_ref: [18, 1, 2],
    },
    '0x7533': {
      name: 'Rapier+3',
      type: [1, 7],
      upgrade_ref: [18, 1, 3],
    },
    '0x7534': {
      name: 'Rapier+4',
      type: [1, 7],
      upgrade_ref: [18, 1, 4],
    },
    '0x7535': {
      name: 'Rapier+5',
      type: [1, 7],
      upgrade_ref: [18, 1, 5],
    },
    '0x7536': {
      name: 'Rapier+6',
      type: [1, 7],
      upgrade_ref: [18, 1, 6],
    },
    '0x7537': {
      name: 'Rapier+7',
      type: [1, 7],
      upgrade_ref: [18, 1, 7],
    },
    '0x7538': {
      name: 'Rapier+8',
      type: [1, 7],
      upgrade_ref: [18, 1, 8],
    },
    '0x7539': {
      name: 'Rapier+9',
      type: [1, 7],
      upgrade_ref: [18, 1, 9],
    },
    '0x753A': {
      name: 'Rapier+10',
      type: [1, 7],
      upgrade_ref: [18, 1, 10],
    },
    '0x753B': {
      name: 'Quality Rapier+1',
      type: [1, 7],
      upgrade_ref: [18, 2, 1],
    },
    '0x753C': {
      name: 'Quality Rapier+2',
      type: [1, 7],
      upgrade_ref: [18, 2, 2],
    },
    '0x753D': {
      name: 'Quality Rapier+3',
      type: [1, 7],
      upgrade_ref: [18, 2, 3],
    },
    '0x753E': {
      name: 'Quality Rapier+4',
      type: [1, 7],
      upgrade_ref: [18, 2, 4],
    },
    '0x753F': {
      name: 'Quality Rapier+5',
      type: [1, 7],
      upgrade_ref: [18, 2, 5],
    },
    '0x7545': {
      name: 'Mercury Rapier+1',
      type: [1, 7],
      upgrade_ref: [18, 7, 1],
    },
    '0x7546': {
      name: 'Mercury Rapier+2',
      type: [1, 7],
      upgrade_ref: [18, 7, 2],
    },
    '0x7547': {
      name: 'Mercury Rapier+3',
      type: [1, 7],
      upgrade_ref: [18, 7, 3],
    },
    '0x7548': {
      name: 'Mercury Rapier+4',
      type: [1, 7],
      upgrade_ref: [18, 7, 4],
    },
    '0x7549': {
      name: 'Mercury Rapier+5',
      type: [1, 7],
      upgrade_ref: [18, 7, 5],
    },
    '0x754F': {
      name: 'Fatal Rapier+1',
      type: [1, 7],
      upgrade_ref: [18, 8, 1],
    },
    '0x7550': {
      name: 'Fatal Rapier+2',
      type: [1, 7],
      upgrade_ref: [18, 8, 2],
    },
    '0x7551': {
      name: 'Fatal Rapier+3',
      type: [1, 7],
      upgrade_ref: [18, 8, 3],
    },
    '0x7552': {
      name: 'Fatal Rapier+4',
      type: [1, 7],
      upgrade_ref: [18, 8, 4],
    },
    '0x7553': {
      name: 'Fatal Rapier+5',
      type: [1, 7],
      upgrade_ref: [18, 8, 5],
    },
    '0x7559': {
      name: 'Sharp Rapier+1',
      type: [1, 7],
      upgrade_ref: [18, 4, 1],
    },
    '0x755A': {
      name: 'Sharp Rapier+2',
      type: [1, 7],
      upgrade_ref: [18, 4, 2],
    },
    '0x755B': {
      name: 'Sharp Rapier+3',
      type: [1, 7],
      upgrade_ref: [18, 4, 3],
    },
    '0x755C': {
      name: 'Sharp Rapier+4',
      type: [1, 7],
      upgrade_ref: [18, 4, 4],
    },
    '0x755D': {
      name: 'Sharp Rapier+5',
      type: [1, 7],
      upgrade_ref: [18, 4, 5],
    },
    '0x7563': {
      name: 'Crescent Rapier+1',
      type: [1, 7],
      upgrade_ref: [18, 10, 1],
    },
    '0x7564': {
      name: 'Crescent Rapier+2',
      type: [1, 7],
      upgrade_ref: [18, 10, 2],
    },
    '0x7565': {
      name: 'Crescent Rapier+3',
      type: [1, 7],
      upgrade_ref: [18, 10, 3],
    },
    '0x7566': {
      name: 'Crescent Rapier+4',
      type: [1, 7],
      upgrade_ref: [18, 10, 4],
    },
    '0x7567': {
      name: 'Crescent Rapier+5',
      type: [1, 7],
      upgrade_ref: [18, 10, 5],
    },
    '0x7594': {
      name: 'Estoc',
      type: [1, 7],
      upgrade_ref: [19, 1, 0],
    },
    '0x7595': {
      name: 'Estoc+1',
      type: [1, 7],
      upgrade_ref: [19, 1, 1],
    },
    '0x7596': {
      name: 'Estoc+2',
      type: [1, 7],
      upgrade_ref: [19, 1, 2],
    },
    '0x7597': {
      name: 'Estoc+3',
      type: [1, 7],
      upgrade_ref: [19, 1, 3],
    },
    '0x7598': {
      name: 'Estoc+4',
      type: [1, 7],
      upgrade_ref: [19, 1, 4],
    },
    '0x7599': {
      name: 'Estoc+5',
      type: [1, 7],
      upgrade_ref: [19, 1, 5],
    },
    '0x759A': {
      name: 'Estoc+6',
      type: [1, 7],
      upgrade_ref: [19, 1, 6],
    },
    '0x759B': {
      name: 'Estoc+7',
      type: [1, 7],
      upgrade_ref: [19, 1, 7],
    },
    '0x759C': {
      name: 'Estoc+8',
      type: [1, 7],
      upgrade_ref: [19, 1, 8],
    },
    '0x759D': {
      name: 'Estoc+9',
      type: [1, 7],
      upgrade_ref: [19, 1, 9],
    },
    '0x759E': {
      name: 'Estoc+10',
      type: [1, 7],
      upgrade_ref: [19, 1, 10],
    },
    '0x759F': {
      name: 'Quality Estoc+1',
      type: [1, 7],
      upgrade_ref: [19, 2, 1],
    },
    '0x75A0': {
      name: 'Quality Estoc+2',
      type: [1, 7],
      upgrade_ref: [19, 2, 2],
    },
    '0x75A1': {
      name: 'Quality Estoc+3',
      type: [1, 7],
      upgrade_ref: [19, 2, 3],
    },
    '0x75A2': {
      name: 'Quality Estoc+4',
      type: [1, 7],
      upgrade_ref: [19, 2, 4],
    },
    '0x75A3': {
      name: 'Quality Estoc+5',
      type: [1, 7],
      upgrade_ref: [19, 2, 5],
    },
    '0x75A9': {
      name: 'Mercury Estoc+1',
      type: [1, 7],
      upgrade_ref: [19, 7, 1],
    },
    '0x75AA': {
      name: 'Mercury Estoc+2',
      type: [1, 7],
      upgrade_ref: [19, 7, 2],
    },
    '0x75AB': {
      name: 'Mercury Estoc+3',
      type: [1, 7],
      upgrade_ref: [19, 7, 3],
    },
    '0x75AC': {
      name: 'Mercury Estoc+4',
      type: [1, 7],
      upgrade_ref: [19, 7, 4],
    },
    '0x75AD': {
      name: 'Mercury Estoc+5',
      type: [1, 7],
      upgrade_ref: [19, 7, 5],
    },
    '0x75B3': {
      name: 'Fatal Estoc+1',
      type: [1, 7],
      upgrade_ref: [19, 8, 1],
    },
    '0x75B4': {
      name: 'Fatal Estoc+2',
      type: [1, 7],
      upgrade_ref: [19, 8, 2],
    },
    '0x75B5': {
      name: 'Fatal Estoc+3',
      type: [1, 7],
      upgrade_ref: [19, 8, 3],
    },
    '0x75B6': {
      name: 'Fatal Estoc+4',
      type: [1, 7],
      upgrade_ref: [19, 8, 4],
    },
    '0x75B7': {
      name: 'Fatal Estoc+5',
      type: [1, 7],
      upgrade_ref: [19, 8, 5],
    },
    '0x75BD': {
      name: 'Sharp Estoc+1',
      type: [1, 7],
      upgrade_ref: [19, 4, 1],
    },
    '0x75BE': {
      name: 'Sharp Estoc+2',
      type: [1, 7],
      upgrade_ref: [19, 4, 2],
    },
    '0x75BF': {
      name: 'Sharp Estoc+3',
      type: [1, 7],
      upgrade_ref: [19, 4, 3],
    },
    '0x75C0': {
      name: 'Sharp Estoc+4',
      type: [1, 7],
      upgrade_ref: [19, 4, 4],
    },
    '0x75C1': {
      name: 'Sharp Estoc+5',
      type: [1, 7],
      upgrade_ref: [19, 4, 5],
    },
    '0x75C7': {
      name: 'Crescent Estoc+1',
      type: [1, 7],
      upgrade_ref: [19, 10, 1],
    },
    '0x75C8': {
      name: 'Crescent Estoc+2',
      type: [1, 7],
      upgrade_ref: [19, 10, 2],
    },
    '0x75C9': {
      name: 'Crescent Estoc+3',
      type: [1, 7],
      upgrade_ref: [19, 10, 3],
    },
    '0x75CA': {
      name: 'Crescent Estoc+4',
      type: [1, 7],
      upgrade_ref: [19, 10, 4],
    },
    '0x75CB': {
      name: 'Crescent Estoc+5',
      type: [1, 7],
      upgrade_ref: [19, 10, 5],
    },
    '0x75F8': {
      name: 'Epee Rapier',
      type: [1, 7],
      upgrade_ref: [52, 14, 0],
    },
    '0x75F9': {
      name: 'Epee Rapier+1',
      type: [1, 7],
      upgrade_ref: [52, 14, 1],
    },
    '0x75FA': {
      name: 'Epee Rapier+2',
      type: [1, 7],
      upgrade_ref: [52, 14, 2],
    },
    '0x75FB': {
      name: 'Epee Rapier+3',
      type: [1, 7],
      upgrade_ref: [52, 14, 3],
    },
    '0x75FC': {
      name: 'Epee Rapier+4',
      type: [1, 7],
      upgrade_ref: [52, 14, 4],
    },
    '0x75FD': {
      name: 'Epee Rapier+5',
      type: [1, 7],
      upgrade_ref: [52, 14, 5],
    },
    '0x765C': {
      name: 'Spiral Rapier',
      type: [1, 7],
      upgrade_ref: [20, 1, 0],
    },
    '0x765D': {
      name: 'Spiral Rapier+1',
      type: [1, 7],
      upgrade_ref: [20, 1, 1],
    },
    '0x765E': {
      name: 'Spiral Rapier+2',
      type: [1, 7],
      upgrade_ref: [20, 1, 2],
    },
    '0x765F': {
      name: 'Spiral Rapier+3',
      type: [1, 7],
      upgrade_ref: [20, 1, 3],
    },
    '0x7660': {
      name: 'Spiral Rapier+4',
      type: [1, 7],
      upgrade_ref: [20, 1, 4],
    },
    '0x7661': {
      name: 'Spiral Rapier+5',
      type: [1, 7],
      upgrade_ref: [20, 1, 5],
    },
    '0x7662': {
      name: 'Spiral Rapier+6',
      type: [1, 7],
      upgrade_ref: [20, 1, 6],
    },
    '0x7663': {
      name: 'Spiral Rapier+7',
      type: [1, 7],
      upgrade_ref: [20, 1, 7],
    },
    '0x7664': {
      name: 'Spiral Rapier+8',
      type: [1, 7],
      upgrade_ref: [20, 1, 8],
    },
    '0x7665': {
      name: 'Spiral Rapier+9',
      type: [1, 7],
      upgrade_ref: [20, 1, 9],
    },
    '0x7666': {
      name: 'Spiral Rapier+10',
      type: [1, 7],
      upgrade_ref: [20, 1, 10],
    },
    '0x7667': {
      name: 'Quality Spiral Rapier+1',
      type: [1, 7],
      upgrade_ref: [20, 2, 1],
    },
    '0x7668': {
      name: 'Quality Spiral Rapier+2',
      type: [1, 7],
      upgrade_ref: [20, 2, 2],
    },
    '0x7669': {
      name: 'Quality Spiral Rapier+3',
      type: [1, 7],
      upgrade_ref: [20, 2, 3],
    },
    '0x766A': {
      name: 'Quality Spiral Rapier+4',
      type: [1, 7],
      upgrade_ref: [20, 2, 4],
    },
    '0x766B': {
      name: 'Quality Spiral Rapier+5',
      type: [1, 7],
      upgrade_ref: [20, 2, 5],
    },
    '0x7671': {
      name: 'Mercury Spiral Rapier+1',
      type: [1, 7],
      upgrade_ref: [20, 7, 1],
    },
    '0x7672': {
      name: 'Mercury Spiral Rapier+2',
      type: [1, 7],
      upgrade_ref: [20, 7, 2],
    },
    '0x7673': {
      name: 'Mercury Spiral Rapier+3',
      type: [1, 7],
      upgrade_ref: [20, 7, 3],
    },
    '0x7674': {
      name: 'Mercury Spiral Rapier+4',
      type: [1, 7],
      upgrade_ref: [20, 7, 4],
    },
    '0x7675': {
      name: 'Mercury Spiral Rapier+5',
      type: [1, 7],
      upgrade_ref: [20, 7, 5],
    },
    '0x767B': {
      name: 'Fatal Spiral Rapier+1',
      type: [1, 7],
      upgrade_ref: [20, 8, 1],
    },
    '0x767C': {
      name: 'Fatal Spiral Rapier+2',
      type: [1, 7],
      upgrade_ref: [20, 8, 2],
    },
    '0x767D': {
      name: 'Fatal Spiral Rapier+3',
      type: [1, 7],
      upgrade_ref: [20, 8, 3],
    },
    '0x767E': {
      name: 'Fatal Spiral Rapier+4',
      type: [1, 7],
      upgrade_ref: [20, 8, 4],
    },
    '0x767F': {
      name: 'Fatal Spiral Rapier+5',
      type: [1, 7],
      upgrade_ref: [20, 8, 5],
    },
    '0x7685': {
      name: 'Sharp Spiral Rapier+1',
      type: [1, 7],
      upgrade_ref: [20, 4, 1],
    },
    '0x7686': {
      name: 'Sharp Spiral Rapier+2',
      type: [1, 7],
      upgrade_ref: [20, 4, 2],
    },
    '0x7687': {
      name: 'Sharp Spiral Rapier+3',
      type: [1, 7],
      upgrade_ref: [20, 4, 3],
    },
    '0x7688': {
      name: 'Sharp Spiral Rapier+4',
      type: [1, 7],
      upgrade_ref: [20, 4, 4],
    },
    '0x7689': {
      name: 'Sharp Spiral Rapier+5',
      type: [1, 7],
      upgrade_ref: [20, 4, 5],
    },
    '0x768F': {
      name: 'Crescent Spiral Rapier+1',
      type: [1, 7],
      upgrade_ref: [20, 10, 1],
    },
    '0x7690': {
      name: 'Crescent Spiral Rapier+2',
      type: [1, 7],
      upgrade_ref: [20, 10, 2],
    },
    '0x7691': {
      name: 'Crescent Spiral Rapier+3',
      type: [1, 7],
      upgrade_ref: [20, 10, 3],
    },
    '0x7692': {
      name: 'Crescent Spiral Rapier+4',
      type: [1, 7],
      upgrade_ref: [20, 10, 4],
    },
    '0x7693': {
      name: 'Crescent Spiral Rapier+5',
      type: [1, 7],
      upgrade_ref: [20, 10, 5],
    },
    '0x76C0': {
      name: 'Needle of Eternal Agony',
      type: [1, 7],
      upgrade_ref: [84, null, null],
    },
    '0x76C1': {
      name: 'Needle of Eternal Agony',
      type: [1, 7],
    },
    '0x76C2': {
      name: 'Needle of Eternal Agony',
      type: [1, 7],
    },
    '0x76C3': {
      name: 'Needle of Eternal Agony',
      type: [1, 7],
    },
    '0x76C4': {
      name: 'Needle of Eternal Agony',
      type: [1, 7],
    },
    '0x76C5': {
      name: 'Needle of Eternal Agony',
      type: [1, 7],
    },
    '0x76C6': {
      name: 'Needle of Eternal Agony',
      type: [1, 7],
    },
    '0x76C7': {
      name: 'Needle of Eternal Agony',
      type: [1, 7],
    },
    '0x9858': {
      name: '_?_?R:Rc    (Ghost Rapier)',
      type: [1, 0],
    },
    '0x9C40': {
      name: 'Scimitar',
      type: [1, 5],
      upgrade_ref: [12, 1, 0],
    },
    '0x9C41': {
      name: 'Scimitar+1',
      type: [1, 5],
      upgrade_ref: [12, 1, 1],
    },
    '0x9C42': {
      name: 'Scimitar+2',
      type: [1, 5],
      upgrade_ref: [12, 1, 2],
    },
    '0x9C43': {
      name: 'Scimitar+3',
      type: [1, 5],
      upgrade_ref: [12, 1, 3],
    },
    '0x9C44': {
      name: 'Scimitar+4',
      type: [1, 5],
      upgrade_ref: [12, 1, 4],
    },
    '0x9C45': {
      name: 'Scimitar+5',
      type: [1, 5],
      upgrade_ref: [12, 1, 5],
    },
    '0x9C46': {
      name: 'Scimitar+6',
      type: [1, 5],
      upgrade_ref: [12, 1, 6],
    },
    '0x9C47': {
      name: 'Scimitar+7',
      type: [1, 5],
      upgrade_ref: [12, 1, 7],
    },
    '0x9C48': {
      name: 'Scimitar+8',
      type: [1, 5],
      upgrade_ref: [12, 1, 8],
    },
    '0x9C49': {
      name: 'Scimitar+9',
      type: [1, 5],
      upgrade_ref: [12, 1, 9],
    },
    '0x9C4A': {
      name: 'Scimitar+10',
      type: [1, 5],
      upgrade_ref: [12, 1, 10],
    },
    '0x9C4B': {
      name: 'Sharp Scimitar+1',
      type: [1, 5],
      upgrade_ref: [12, 4, 1],
    },
    '0x9C4C': {
      name: 'Sharp Scimitar+2',
      type: [1, 5],
      upgrade_ref: [12, 4, 2],
    },
    '0x9C4D': {
      name: 'Sharp Scimitar+3',
      type: [1, 5],
      upgrade_ref: [12, 4, 3],
    },
    '0x9C4E': {
      name: 'Sharp Scimitar+4',
      type: [1, 5],
      upgrade_ref: [12, 4, 4],
    },
    '0x9C4F': {
      name: 'Sharp Scimitar+5',
      type: [1, 5],
      upgrade_ref: [12, 4, 5],
    },
    '0x9C55': {
      name: 'Tearing Scimitar+1',
      type: [1, 5],
      upgrade_ref: [12, 6, 1],
    },
    '0x9C56': {
      name: 'Tearing Scimitar+2',
      type: [1, 5],
      upgrade_ref: [12, 6, 2],
    },
    '0x9C57': {
      name: 'Tearing Scimitar+3',
      type: [1, 5],
      upgrade_ref: [12, 6, 3],
    },
    '0x9C58': {
      name: 'Tearing Scimitar+4',
      type: [1, 5],
      upgrade_ref: [12, 6, 4],
    },
    '0x9C59': {
      name: 'Tearing Scimitar+5',
      type: [1, 5],
      upgrade_ref: [12, 6, 5],
    },
    '0x9C5F': {
      name: 'Crescent Scimitar+1',
      type: [1, 5],
      upgrade_ref: [12, 10, 1],
    },
    '0x9C60': {
      name: 'Crescent Scimitar+2',
      type: [1, 5],
      upgrade_ref: [12, 10, 2],
    },
    '0x9C61': {
      name: 'Crescent Scimitar+3',
      type: [1, 5],
      upgrade_ref: [12, 10, 3],
    },
    '0x9C62': {
      name: 'Crescent Scimitar+4',
      type: [1, 5],
      upgrade_ref: [12, 10, 4],
    },
    '0x9C63': {
      name: 'Crescent Scimitar+5',
      type: [1, 5],
      upgrade_ref: [12, 10, 5],
    },
    '0x9C69': {
      name: 'Quality Scimitar+1',
      type: [1, 5],
      upgrade_ref: [12, 2, 1],
    },
    '0x9C6A': {
      name: 'Quality Scimitar+2',
      type: [1, 5],
      upgrade_ref: [12, 2, 2],
    },
    '0x9C6B': {
      name: 'Quality Scimitar+3',
      type: [1, 5],
      upgrade_ref: [12, 2, 3],
    },
    '0x9C6C': {
      name: 'Quality Scimitar+4',
      type: [1, 5],
      upgrade_ref: [12, 2, 4],
    },
    '0x9C6D': {
      name: 'Quality Scimitar+5',
      type: [1, 5],
      upgrade_ref: [12, 2, 5],
    },
    '0x9C73': {
      name: 'Mercury Scimitar+1',
      type: [1, 5],
      upgrade_ref: [12, 7, 1],
    },
    '0x9C74': {
      name: 'Mercury Scimitar+2',
      type: [1, 5],
      upgrade_ref: [12, 7, 2],
    },
    '0x9C75': {
      name: 'Mercury Scimitar+3',
      type: [1, 5],
      upgrade_ref: [12, 7, 3],
    },
    '0x9C76': {
      name: 'Mercury Scimitar+4',
      type: [1, 5],
      upgrade_ref: [12, 7, 4],
    },
    '0x9C77': {
      name: 'Mercury Scimitar+5',
      type: [1, 5],
      upgrade_ref: [12, 7, 5],
    },
    '0x9C7D': {
      name: 'Moon Scimitar+1',
      type: [1, 5],
      upgrade_ref: [12, 9, 1],
    },
    '0x9C7E': {
      name: 'Moon Scimitar+2',
      type: [1, 5],
      upgrade_ref: [12, 9, 2],
    },
    '0x9C7F': {
      name: 'Moon Scimitar+3',
      type: [1, 5],
      upgrade_ref: [12, 9, 3],
    },
    '0x9C80': {
      name: 'Moon Scimitar+4',
      type: [1, 5],
      upgrade_ref: [12, 9, 4],
    },
    '0x9C81': {
      name: 'Moon Scimitar+5',
      type: [1, 5],
      upgrade_ref: [12, 9, 5],
    },
    '0x9CA4': {
      name: 'Kilij',
      type: [1, 5],
      upgrade_ref: [13, 1, 0],
    },
    '0x9CA5': {
      name: 'Kilij+1',
      type: [1, 5],
      upgrade_ref: [13, 1, 1],
    },
    '0x9CA6': {
      name: 'Kilij+2',
      type: [1, 5],
      upgrade_ref: [13, 1, 2],
    },
    '0x9CA7': {
      name: 'Kilij+3',
      type: [1, 5],
      upgrade_ref: [13, 1, 3],
    },
    '0x9CA8': {
      name: 'Kilij+4',
      type: [1, 5],
      upgrade_ref: [13, 1, 4],
    },
    '0x9CA9': {
      name: 'Kilij+5',
      type: [1, 5],
      upgrade_ref: [13, 1, 5],
    },
    '0x9CAA': {
      name: 'Kilij+6',
      type: [1, 5],
      upgrade_ref: [13, 1, 6],
    },
    '0x9CAB': {
      name: 'Kilij+7',
      type: [1, 5],
      upgrade_ref: [13, 1, 7],
    },
    '0x9CAC': {
      name: 'Kilij+8',
      type: [1, 5],
      upgrade_ref: [13, 1, 8],
    },
    '0x9CAD': {
      name: 'Kilij+9',
      type: [1, 5],
      upgrade_ref: [13, 1, 9],
    },
    '0x9CAE': {
      name: 'Kilij+10',
      type: [1, 5],
      upgrade_ref: [13, 1, 10],
    },
    '0x9CAF': {
      name: 'Sharp Kilij+1',
      type: [1, 5],
      upgrade_ref: [13, 4, 1],
    },
    '0x9CB0': {
      name: 'Sharp Kilij+2',
      type: [1, 5],
      upgrade_ref: [13, 4, 2],
    },
    '0x9CB1': {
      name: 'Sharp Kilij+3',
      type: [1, 5],
      upgrade_ref: [13, 4, 3],
    },
    '0x9CB2': {
      name: 'Sharp Kilij+4',
      type: [1, 5],
      upgrade_ref: [13, 4, 4],
    },
    '0x9CB3': {
      name: 'Sharp Kilij+5',
      type: [1, 5],
      upgrade_ref: [13, 4, 5],
    },
    '0x9CB9': {
      name: 'Tearing Kilij+1',
      type: [1, 5],
      upgrade_ref: [13, 6, 1],
    },
    '0x9CBA': {
      name: 'Tearing Kilij+2',
      type: [1, 5],
      upgrade_ref: [13, 6, 2],
    },
    '0x9CBB': {
      name: 'Tearing Kilij+3',
      type: [1, 5],
      upgrade_ref: [13, 6, 3],
    },
    '0x9CBC': {
      name: 'Tearing Kilij+4',
      type: [1, 5],
      upgrade_ref: [13, 6, 4],
    },
    '0x9CBD': {
      name: 'Tearing Kilij+5',
      type: [1, 5],
      upgrade_ref: [13, 6, 5],
    },
    '0x9CC3': {
      name: 'Crescent Kilij+1',
      type: [1, 5],
      upgrade_ref: [13, 10, 1],
    },
    '0x9CC4': {
      name: 'Crescent Kilij+2',
      type: [1, 5],
      upgrade_ref: [13, 10, 2],
    },
    '0x9CC5': {
      name: 'Crescent Kilij+3',
      type: [1, 5],
      upgrade_ref: [13, 10, 3],
    },
    '0x9CC6': {
      name: 'Crescent Kilij+4',
      type: [1, 5],
      upgrade_ref: [13, 10, 4],
    },
    '0x9CC7': {
      name: 'Crescent Kilij+5',
      type: [1, 5],
      upgrade_ref: [13, 10, 5],
    },
    '0x9CCD': {
      name: 'Quality Kilij+1',
      type: [1, 5],
      upgrade_ref: [13, 2, 1],
    },
    '0x9CCE': {
      name: 'Quality Kilij+2',
      type: [1, 5],
      upgrade_ref: [13, 2, 2],
    },
    '0x9CCF': {
      name: 'Quality Kilij+3',
      type: [1, 5],
      upgrade_ref: [13, 2, 3],
    },
    '0x9CD0': {
      name: 'Quality Kilij+4',
      type: [1, 5],
      upgrade_ref: [13, 2, 4],
    },
    '0x9CD1': {
      name: 'Quality Kilij+5',
      type: [1, 5],
      upgrade_ref: [13, 2, 5],
    },
    '0x9CD7': {
      name: 'Mercury Kilij+1',
      type: [1, 5],
      upgrade_ref: [13, 7, 1],
    },
    '0x9CD8': {
      name: 'Mercury Kilij+2',
      type: [1, 5],
      upgrade_ref: [13, 7, 2],
    },
    '0x9CD9': {
      name: 'Mercury Kilij+3',
      type: [1, 5],
      upgrade_ref: [13, 7, 3],
    },
    '0x9CDA': {
      name: 'Mercury Kilij+4',
      type: [1, 5],
      upgrade_ref: [13, 7, 4],
    },
    '0x9CDB': {
      name: 'Mercury Kilij+5',
      type: [1, 5],
      upgrade_ref: [13, 7, 5],
    },
    '0x9CE1': {
      name: 'Moon Kilij+1',
      type: [1, 5],
      upgrade_ref: [13, 9, 1],
    },
    '0x9CE2': {
      name: 'Moon Kilij+2',
      type: [1, 5],
      upgrade_ref: [13, 9, 2],
    },
    '0x9CE3': {
      name: 'Moon Kilij+3',
      type: [1, 5],
      upgrade_ref: [13, 9, 3],
    },
    '0x9CE4': {
      name: 'Moon Kilij+4',
      type: [1, 5],
      upgrade_ref: [13, 9, 4],
    },
    '0x9CE5': {
      name: 'Moon Kilij+5',
      type: [1, 5],
      upgrade_ref: [13, 9, 5],
    },
    '0x9D08': {
      name: 'Shotel',
      type: [1, 5],
      upgrade_ref: [15, 1, 0],
    },
    '0x9D09': {
      name: 'Shotel+1',
      type: [1, 5],
      upgrade_ref: [15, 1, 1],
    },
    '0x9D0A': {
      name: 'Shotel+2',
      type: [1, 5],
      upgrade_ref: [15, 1, 2],
    },
    '0x9D0B': {
      name: 'Shotel+3',
      type: [1, 5],
      upgrade_ref: [15, 1, 3],
    },
    '0x9D0C': {
      name: 'Shotel+4',
      type: [1, 5],
      upgrade_ref: [15, 1, 4],
    },
    '0x9D0D': {
      name: 'Shotel+5',
      type: [1, 5],
      upgrade_ref: [15, 1, 5],
    },
    '0x9D0E': {
      name: 'Shotel+6',
      type: [1, 5],
      upgrade_ref: [15, 1, 6],
    },
    '0x9D0F': {
      name: 'Shotel+7',
      type: [1, 5],
      upgrade_ref: [15, 1, 7],
    },
    '0x9D10': {
      name: 'Shotel+8',
      type: [1, 5],
      upgrade_ref: [15, 1, 8],
    },
    '0x9D11': {
      name: 'Shotel+9',
      type: [1, 5],
      upgrade_ref: [15, 1, 9],
    },
    '0x9D12': {
      name: 'Shotel+10',
      type: [1, 5],
      upgrade_ref: [15, 1, 10],
    },
    '0x9D13': {
      name: 'Sharp Shotel+1',
      type: [1, 5],
      upgrade_ref: [15, 4, 1],
    },
    '0x9D14': {
      name: 'Sharp Shotel+2',
      type: [1, 5],
      upgrade_ref: [15, 4, 2],
    },
    '0x9D15': {
      name: 'Sharp Shotel+3',
      type: [1, 5],
      upgrade_ref: [15, 4, 3],
    },
    '0x9D16': {
      name: 'Sharp Shotel+4',
      type: [1, 5],
      upgrade_ref: [15, 4, 4],
    },
    '0x9D17': {
      name: 'Sharp Shotel+5',
      type: [1, 5],
      upgrade_ref: [15, 4, 5],
    },
    '0x9D1D': {
      name: 'Tearing Shotel+1',
      type: [1, 5],
      upgrade_ref: [15, 6, 1],
    },
    '0x9D1E': {
      name: 'Tearing Shotel+2',
      type: [1, 5],
      upgrade_ref: [15, 6, 2],
    },
    '0x9D1F': {
      name: 'Tearing Shotel+3',
      type: [1, 5],
      upgrade_ref: [15, 6, 3],
    },
    '0x9D20': {
      name: 'Tearing Shotel+4',
      type: [1, 5],
      upgrade_ref: [15, 6, 4],
    },
    '0x9D21': {
      name: 'Tearing Shotel+5',
      type: [1, 5],
      upgrade_ref: [15, 6, 5],
    },
    '0x9D27': {
      name: 'Quality Shotel+1',
      type: [1, 5],
      upgrade_ref: [15, 2, 1],
    },
    '0x9D28': {
      name: 'Quality Shotel+2',
      type: [1, 5],
      upgrade_ref: [15, 2, 2],
    },
    '0x9D29': {
      name: 'Quality Shotel+3',
      type: [1, 5],
      upgrade_ref: [15, 2, 3],
    },
    '0x9D2A': {
      name: 'Quality Shotel+4',
      type: [1, 5],
      upgrade_ref: [15, 2, 4],
    },
    '0x9D2B': {
      name: 'Quality Shotel+5',
      type: [1, 5],
      upgrade_ref: [15, 2, 5],
    },
    '0x9D31': {
      name: 'Mercury Shotel+1',
      type: [1, 5],
      upgrade_ref: [15, 7, 1],
    },
    '0x9D32': {
      name: 'Mercury Shotel+2',
      type: [1, 5],
      upgrade_ref: [15, 7, 2],
    },
    '0x9D33': {
      name: 'Mercury Shotel+3',
      type: [1, 5],
      upgrade_ref: [15, 7, 3],
    },
    '0x9D34': {
      name: 'Mercury Shotel+4',
      type: [1, 5],
      upgrade_ref: [15, 7, 4],
    },
    '0x9D35': {
      name: 'Mercury Shotel+5',
      type: [1, 5],
      upgrade_ref: [15, 7, 5],
    },
    '0x9D3B': {
      name: 'Moon Shotel+1',
      type: [1, 5],
      upgrade_ref: [15, 9, 1],
    },
    '0x9D3C': {
      name: 'Moon Shotel+2',
      type: [1, 5],
      upgrade_ref: [15, 9, 2],
    },
    '0x9D3D': {
      name: 'Moon Shotel+3',
      type: [1, 5],
      upgrade_ref: [15, 9, 3],
    },
    '0x9D3E': {
      name: 'Moon Shotel+4',
      type: [1, 5],
      upgrade_ref: [15, 9, 4],
    },
    '0x9D3F': {
      name: 'Moon Shotel+5',
      type: [1, 5],
      upgrade_ref: [15, 9, 5],
    },
    '0x9D45': {
      name: 'Crescent Shotel+1',
      type: [1, 5],
      upgrade_ref: [15, 10, 1],
    },
    '0x9D46': {
      name: 'Crescent Shotel+2',
      type: [1, 5],
      upgrade_ref: [15, 10, 2],
    },
    '0x9D47': {
      name: 'Crescent Shotel+3',
      type: [1, 5],
      upgrade_ref: [15, 10, 3],
    },
    '0x9D48': {
      name: 'Crescent Shotel+4',
      type: [1, 5],
      upgrade_ref: [15, 10, 4],
    },
    '0x9D49': {
      name: 'Crescent Shotel+5',
      type: [1, 5],
      upgrade_ref: [15, 10, 5],
    },
    '0x9D6C': {
      name: 'Falchion',
      type: [1, 5],
      upgrade_ref: [14, 1, 0],
    },
    '0x9D6D': {
      name: 'Falchion+1',
      type: [1, 5],
      upgrade_ref: [14, 1, 1],
    },
    '0x9D6E': {
      name: 'Falchion+2',
      type: [1, 5],
      upgrade_ref: [14, 1, 2],
    },
    '0x9D6F': {
      name: 'Falchion+3',
      type: [1, 5],
      upgrade_ref: [14, 1, 3],
    },
    '0x9D70': {
      name: 'Falchion+4',
      type: [1, 5],
      upgrade_ref: [14, 1, 4],
    },
    '0x9D71': {
      name: 'Falchion+5',
      type: [1, 5],
      upgrade_ref: [14, 1, 5],
    },
    '0x9D72': {
      name: 'Falchion+6',
      type: [1, 5],
      upgrade_ref: [14, 1, 6],
    },
    '0x9D73': {
      name: 'Falchion+7',
      type: [1, 5],
      upgrade_ref: [14, 1, 7],
    },
    '0x9D74': {
      name: 'Falchion+8',
      type: [1, 5],
      upgrade_ref: [14, 1, 8],
    },
    '0x9D75': {
      name: 'Falchion+9',
      type: [1, 5],
      upgrade_ref: [14, 1, 9],
    },
    '0x9D76': {
      name: 'Falchion+10',
      type: [1, 5],
      upgrade_ref: [14, 1, 10],
    },
    '0x9D77': {
      name: 'Sharp Falchion+1',
      type: [1, 5],
      upgrade_ref: [14, 4, 1],
    },
    '0x9D78': {
      name: 'Sharp Falchion+2',
      type: [1, 5],
      upgrade_ref: [14, 4, 2],
    },
    '0x9D79': {
      name: 'Sharp Falchion+3',
      type: [1, 5],
      upgrade_ref: [14, 4, 3],
    },
    '0x9D7A': {
      name: 'Sharp Falchion+4',
      type: [1, 5],
      upgrade_ref: [14, 4, 4],
    },
    '0x9D7B': {
      name: 'Sharp Falchion+5',
      type: [1, 5],
      upgrade_ref: [14, 4, 5],
    },
    '0x9D81': {
      name: 'Tearing Falchion+1',
      type: [1, 5],
      upgrade_ref: [14, 6, 1],
    },
    '0x9D82': {
      name: 'Tearing Falchion+2',
      type: [1, 5],
      upgrade_ref: [14, 6, 2],
    },
    '0x9D83': {
      name: 'Tearing Falchion+3',
      type: [1, 5],
      upgrade_ref: [14, 6, 3],
    },
    '0x9D84': {
      name: 'Tearing Falchion+4',
      type: [1, 5],
      upgrade_ref: [14, 6, 4],
    },
    '0x9D85': {
      name: 'Tearing Falchion+5',
      type: [1, 5],
      upgrade_ref: [14, 6, 5],
    },
    '0x9D8B': {
      name: 'Crescent Falchion+1',
      type: [1, 5],
      upgrade_ref: [14, 10, 1],
    },
    '0x9D8C': {
      name: 'Crescent Falchion+2',
      type: [1, 5],
      upgrade_ref: [14, 10, 2],
    },
    '0x9D8D': {
      name: 'Crescent Falchion+3',
      type: [1, 5],
      upgrade_ref: [14, 10, 3],
    },
    '0x9D8E': {
      name: 'Crescent Falchion+4',
      type: [1, 5],
      upgrade_ref: [14, 10, 4],
    },
    '0x9D8F': {
      name: 'Crescent Falchion+5',
      type: [1, 5],
      upgrade_ref: [14, 10, 5],
    },
    '0x9D95': {
      name: 'Quality Falchion+1',
      type: [1, 5],
      upgrade_ref: [14, 2, 1],
    },
    '0x9D96': {
      name: 'Quality Falchion+2',
      type: [1, 5],
      upgrade_ref: [14, 2, 2],
    },
    '0x9D97': {
      name: 'Quality Falchion+3',
      type: [1, 5],
      upgrade_ref: [14, 2, 3],
    },
    '0x9D98': {
      name: 'Quality Falchion+4',
      type: [1, 5],
      upgrade_ref: [14, 2, 4],
    },
    '0x9D99': {
      name: 'Quality Falchion+5',
      type: [1, 5],
      upgrade_ref: [14, 2, 5],
    },
    '0x9D9F': {
      name: 'Mercury Falchion+1',
      type: [1, 5],
      upgrade_ref: [14, 7, 1],
    },
    '0x9DA0': {
      name: 'Mercury Falchion+2',
      type: [1, 5],
      upgrade_ref: [14, 7, 2],
    },
    '0x9DA1': {
      name: 'Mercury Falchion+3',
      type: [1, 5],
      upgrade_ref: [14, 7, 3],
    },
    '0x9DA2': {
      name: 'Mercury Falchion+4',
      type: [1, 5],
      upgrade_ref: [14, 7, 4],
    },
    '0x9DA3': {
      name: 'Mercury Falchion+5',
      type: [1, 5],
      upgrade_ref: [14, 7, 5],
    },
    '0x9DA9': {
      name: 'Moon Falchion+1',
      type: [1, 5],
      upgrade_ref: [14, 9, 1],
    },
    '0x9DAA': {
      name: 'Moon Falchion+2',
      type: [1, 5],
      upgrade_ref: [14, 9, 2],
    },
    '0x9DAB': {
      name: 'Moon Falchion+3',
      type: [1, 5],
      upgrade_ref: [14, 9, 3],
    },
    '0x9DAC': {
      name: 'Moon Falchion+4',
      type: [1, 5],
      upgrade_ref: [14, 9, 4],
    },
    '0x9DAD': {
      name: 'Moon Falchion+5',
      type: [1, 5],
      upgrade_ref: [14, 9, 5],
    },
    '0x9DD0': {
      name: 'Uchigatana',
      type: [1, 6],
      upgrade_ref: [17, 1, 0],
    },
    '0x9DD1': {
      name: 'Uchigatana+1',
      type: [1, 6],
      upgrade_ref: [17, 1, 1],
    },
    '0x9DD2': {
      name: 'Uchigatana+2',
      type: [1, 6],
      upgrade_ref: [17, 1, 2],
    },
    '0x9DD3': {
      name: 'Uchigatana+3',
      type: [1, 6],
      upgrade_ref: [17, 1, 3],
    },
    '0x9DD4': {
      name: 'Uchigatana+4',
      type: [1, 6],
      upgrade_ref: [17, 1, 4],
    },
    '0x9DD5': {
      name: 'Uchigatana+5',
      type: [1, 6],
      upgrade_ref: [17, 1, 5],
    },
    '0x9DD6': {
      name: 'Uchigatana+6',
      type: [1, 6],
      upgrade_ref: [17, 1, 6],
    },
    '0x9DD7': {
      name: 'Uchigatana+7',
      type: [1, 6],
      upgrade_ref: [17, 1, 7],
    },
    '0x9DD8': {
      name: 'Uchigatana+8',
      type: [1, 6],
      upgrade_ref: [17, 1, 8],
    },
    '0x9DD9': {
      name: 'Uchigatana+9',
      type: [1, 6],
      upgrade_ref: [17, 1, 9],
    },
    '0x9DDA': {
      name: 'Uchigatana+10',
      type: [1, 6],
      upgrade_ref: [17, 1, 10],
    },
    '0x9DDB': {
      name: 'Sharp Uchigatana+1',
      type: [1, 6],
      upgrade_ref: [17, 4, 1],
    },
    '0x9DDC': {
      name: 'Sharp Uchigatana+2',
      type: [1, 6],
      upgrade_ref: [17, 4, 2],
    },
    '0x9DDD': {
      name: 'Sharp Uchigatana+3',
      type: [1, 6],
      upgrade_ref: [17, 4, 3],
    },
    '0x9DDE': {
      name: 'Sharp Uchigatana+4',
      type: [1, 6],
      upgrade_ref: [17, 4, 4],
    },
    '0x9DDF': {
      name: 'Sharp Uchigatana+5',
      type: [1, 6],
      upgrade_ref: [17, 4, 5],
    },
    '0x9DE5': {
      name: 'Tearing Uchigatana+1',
      type: [1, 6],
      upgrade_ref: [17, 6, 1],
    },
    '0x9DE6': {
      name: 'Tearing Uchigatana+2',
      type: [1, 6],
      upgrade_ref: [17, 6, 2],
    },
    '0x9DE7': {
      name: 'Tearing Uchigatana+3',
      type: [1, 6],
      upgrade_ref: [17, 6, 3],
    },
    '0x9DE8': {
      name: 'Tearing Uchigatana+4',
      type: [1, 6],
      upgrade_ref: [17, 6, 4],
    },
    '0x9DE9': {
      name: 'Tearing Uchigatana+5',
      type: [1, 6],
      upgrade_ref: [17, 6, 5],
    },
    '0x9DEF': {
      name: 'Crescent Uchigatana+1',
      type: [1, 6],
      upgrade_ref: [17, 10, 1],
    },
    '0x9DF0': {
      name: 'Crescent Uchigatana+2',
      type: [1, 6],
      upgrade_ref: [17, 10, 2],
    },
    '0x9DF1': {
      name: 'Crescent Uchigatana+3',
      type: [1, 6],
      upgrade_ref: [17, 10, 3],
    },
    '0x9DF2': {
      name: 'Crescent Uchigatana+4',
      type: [1, 6],
      upgrade_ref: [17, 10, 4],
    },
    '0x9DF3': {
      name: 'Crescent Uchigatana+5',
      type: [1, 6],
      upgrade_ref: [17, 10, 5],
    },
    '0x9DF9': {
      name: 'Quality Uchigatana+1',
      type: [1, 6],
      upgrade_ref: [17, 2, 1],
    },
    '0x9DFA': {
      name: 'Quality Uchigatana+2',
      type: [1, 6],
      upgrade_ref: [17, 2, 2],
    },
    '0x9DFB': {
      name: 'Quality Uchigatana+3',
      type: [1, 6],
      upgrade_ref: [17, 2, 3],
    },
    '0x9DFC': {
      name: 'Quality Uchigatana+4',
      type: [1, 6],
      upgrade_ref: [17, 2, 4],
    },
    '0x9DFD': {
      name: 'Quality Uchigatana+5',
      type: [1, 6],
      upgrade_ref: [17, 2, 5],
    },
    '0x9E03': {
      name: 'Mercury Uchigatana+1',
      type: [1, 6],
      upgrade_ref: [17, 7, 1],
    },
    '0x9E04': {
      name: 'Mercury Uchigatana+2',
      type: [1, 6],
      upgrade_ref: [17, 7, 2],
    },
    '0x9E05': {
      name: 'Mercury Uchigatana+3',
      type: [1, 6],
      upgrade_ref: [17, 7, 3],
    },
    '0x9E06': {
      name: 'Mercury Uchigatana+4',
      type: [1, 6],
      upgrade_ref: [17, 7, 4],
    },
    '0x9E07': {
      name: 'Mercury Uchigatana+5',
      type: [1, 6],
      upgrade_ref: [17, 7, 5],
    },
    '0x9E0D': {
      name: 'Moon Uchigatana+1',
      type: [1, 6],
      upgrade_ref: [17, 9, 1],
    },
    '0x9E0E': {
      name: 'Moon Uchigatana+2',
      type: [1, 6],
      upgrade_ref: [17, 9, 2],
    },
    '0x9E0F': {
      name: 'Moon Uchigatana+3',
      type: [1, 6],
      upgrade_ref: [17, 9, 3],
    },
    '0x9E10': {
      name: 'Moon Uchigatana+4',
      type: [1, 6],
      upgrade_ref: [17, 9, 4],
    },
    '0x9E11': {
      name: 'Moon Uchigatana+5',
      type: [1, 6],
      upgrade_ref: [17, 9, 5],
    },
    '0x9E34': {
      name: 'Hiltless',
      type: [1, 6],
      upgrade_ref: [55, 14, 0],
    },
    '0x9E35': {
      name: 'Hiltless+1',
      type: [1, 6],
      upgrade_ref: [55, 14, 1],
    },
    '0x9E36': {
      name: 'Hiltless+2',
      type: [1, 6],
      upgrade_ref: [55, 14, 2],
    },
    '0x9E37': {
      name: 'Hiltless+3',
      type: [1, 6],
      upgrade_ref: [55, 14, 3],
    },
    '0x9E38': {
      name: 'Hiltless+4',
      type: [1, 6],
      upgrade_ref: [55, 14, 4],
    },
    '0x9E39': {
      name: 'Hiltless+5',
      type: [1, 6],
      upgrade_ref: [55, 14, 5],
    },
    '0x9E98': {
      name: 'Blind',
      type: [1, 6],
      upgrade_ref: [49, 14, 0],
    },
    '0x9E99': {
      name: 'Blind+1',
      type: [1, 6],
      upgrade_ref: [49, 14, 1],
    },
    '0x9E9A': {
      name: 'Blind+2',
      type: [1, 6],
      upgrade_ref: [49, 14, 2],
    },
    '0x9E9B': {
      name: 'Blind+3',
      type: [1, 6],
      upgrade_ref: [49, 14, 3],
    },
    '0x9E9C': {
      name: 'Blind+4',
      type: [1, 6],
      upgrade_ref: [49, 14, 4],
    },
    '0x9E9D': {
      name: 'Blind+5',
      type: [1, 6],
      upgrade_ref: [49, 14, 5],
    },
    '0x9EFC': {
      name: "Magic Sword 'Makoto'",
      type: [1, 6],
      upgrade_ref: [59, 14, 0],
    },
    '0x9EFD': {
      name: "Magic Sword 'Makoto'+1",
      type: [1, 6],
      upgrade_ref: [59, 14, 1],
    },
    '0x9EFE': {
      name: "Magic Sword 'Makoto'+2",
      type: [1, 6],
      upgrade_ref: [59, 14, 2],
    },
    '0x9EFF': {
      name: "Magic Sword 'Makoto'+3",
      type: [1, 6],
      upgrade_ref: [59, 14, 3],
    },
    '0x9F00': {
      name: "Magic Sword 'Makoto'+4",
      type: [1, 6],
      upgrade_ref: [59, 14, 4],
    },
    '0x9F01': {
      name: "Magic Sword 'Makoto'+5",
      type: [1, 6],
      upgrade_ref: [59, 14, 5],
    },
    '0x9FC4': {
      name: 'Large Sword of Searching',
      type: [1, 4],
      upgrade_ref: [85, null, null],
    },
    '0x9FC5': {
      name: 'Large Sword of Searching',
      type: [1, 4],
    },
    '0x9FC6': {
      name: 'Large Sword of Searching',
      type: [1, 4],
    },
    '0x9FC7': {
      name: 'Large Sword of Searching',
      type: [1, 4],
    },
    '0x9FC8': {
      name: 'Large Sword of Searching',
      type: [1, 4],
    },
    '0x9FC9': {
      name: 'Large Sword of Searching',
      type: [1, 4],
    },
    '0x9FCA': {
      name: 'Large Sword of Searching',
      type: [1, 4],
    },
    '0x9FCB': {
      name: 'Large Sword of Searching',
      type: [1, 4],
    },
    '0x9FCC': {
      name: 'Large Sword of Searching',
      type: [1, 4],
    },
    '0xBF68': {
      name: '_?_?f?Rc    (Ghost Falchion)',
      type: [1, 0],
    },
    '0xC350': {
      name: 'Battle Axe',
      type: [1, 8],
      upgrade_ref: [21, 1, 0],
    },
    '0xC351': {
      name: 'Battle Axe+1',
      type: [1, 8],
      upgrade_ref: [21, 1, 1],
    },
    '0xC352': {
      name: 'Battle Axe+2',
      type: [1, 8],
      upgrade_ref: [21, 1, 2],
    },
    '0xC353': {
      name: 'Battle Axe+3',
      type: [1, 8],
      upgrade_ref: [21, 1, 3],
    },
    '0xC354': {
      name: 'Battle Axe+4',
      type: [1, 8],
      upgrade_ref: [21, 1, 4],
    },
    '0xC355': {
      name: 'Battle Axe+5',
      type: [1, 8],
      upgrade_ref: [21, 1, 5],
    },
    '0xC356': {
      name: 'Battle Axe+6',
      type: [1, 8],
      upgrade_ref: [21, 1, 6],
    },
    '0xC357': {
      name: 'Battle Axe+7',
      type: [1, 8],
      upgrade_ref: [21, 1, 7],
    },
    '0xC358': {
      name: 'Battle Axe+8',
      type: [1, 8],
      upgrade_ref: [21, 1, 8],
    },
    '0xC359': {
      name: 'Battle Axe+9',
      type: [1, 8],
      upgrade_ref: [21, 1, 9],
    },
    '0xC35A': {
      name: 'Battle Axe+10',
      type: [1, 8],
      upgrade_ref: [21, 1, 10],
    },
    '0xC35B': {
      name: 'Crushing Battle Axe+1',
      type: [1, 8],
      upgrade_ref: [21, 3, 1],
    },
    '0xC35C': {
      name: 'Crushing Battle Axe+2',
      type: [1, 8],
      upgrade_ref: [21, 3, 2],
    },
    '0xC35D': {
      name: 'Crushing Battle Axe+3',
      type: [1, 8],
      upgrade_ref: [21, 3, 3],
    },
    '0xC35E': {
      name: 'Crushing Battle Axe+4',
      type: [1, 8],
      upgrade_ref: [21, 3, 4],
    },
    '0xC35F': {
      name: 'Crushing Battle Axe+5',
      type: [1, 8],
      upgrade_ref: [21, 3, 5],
    },
    '0xC365': {
      name: 'Dragon Battle Axe+1',
      type: [1, 8],
      upgrade_ref: [21, 5, 1],
    },
    '0xC366': {
      name: 'Dragon Battle Axe+2',
      type: [1, 8],
      upgrade_ref: [21, 5, 2],
    },
    '0xC367': {
      name: 'Dragon Battle Axe+3',
      type: [1, 8],
      upgrade_ref: [21, 5, 3],
    },
    '0xC368': {
      name: 'Dragon Battle Axe+4',
      type: [1, 8],
      upgrade_ref: [21, 5, 4],
    },
    '0xC369': {
      name: 'Dragon Battle Axe+5',
      type: [1, 8],
      upgrade_ref: [21, 5, 5],
    },
    '0xC36F': {
      name: 'Moon Battle Axe+1',
      type: [1, 8],
      upgrade_ref: [21, 9, 1],
    },
    '0xC370': {
      name: 'Moon Battle Axe+2',
      type: [1, 8],
      upgrade_ref: [21, 9, 2],
    },
    '0xC371': {
      name: 'Moon Battle Axe+3',
      type: [1, 8],
      upgrade_ref: [21, 9, 3],
    },
    '0xC372': {
      name: 'Moon Battle Axe+4',
      type: [1, 8],
      upgrade_ref: [21, 9, 4],
    },
    '0xC373': {
      name: 'Moon Battle Axe+5',
      type: [1, 8],
      upgrade_ref: [21, 9, 5],
    },
    '0xC379': {
      name: 'Quality Battle Axe+1',
      type: [1, 8],
      upgrade_ref: [21, 2, 1],
    },
    '0xC37A': {
      name: 'Quality Battle Axe+2',
      type: [1, 8],
      upgrade_ref: [21, 2, 2],
    },
    '0xC37B': {
      name: 'Quality Battle Axe+3',
      type: [1, 8],
      upgrade_ref: [21, 2, 3],
    },
    '0xC37C': {
      name: 'Quality Battle Axe+4',
      type: [1, 8],
      upgrade_ref: [21, 2, 4],
    },
    '0xC37D': {
      name: 'Quality Battle Axe+5',
      type: [1, 8],
      upgrade_ref: [21, 2, 5],
    },
    '0xC383': {
      name: 'Blessed Battle Axe+1',
      type: [1, 8],
      upgrade_ref: [21, 11, 1],
    },
    '0xC384': {
      name: 'Blessed Battle Axe+2',
      type: [1, 8],
      upgrade_ref: [21, 11, 2],
    },
    '0xC385': {
      name: 'Blessed Battle Axe+3',
      type: [1, 8],
      upgrade_ref: [21, 11, 3],
    },
    '0xC386': {
      name: 'Blessed Battle Axe+4',
      type: [1, 8],
      upgrade_ref: [21, 11, 4],
    },
    '0xC387': {
      name: 'Blessed Battle Axe+5',
      type: [1, 8],
      upgrade_ref: [21, 11, 5],
    },
    '0xC418': {
      name: 'Great Axe',
      type: [1, 9],
      upgrade_ref: [24, 1, 0],
    },
    '0xC419': {
      name: 'Great Axe+1',
      type: [1, 9],
      upgrade_ref: [24, 1, 1],
    },
    '0xC41A': {
      name: 'Great Axe+2',
      type: [1, 9],
      upgrade_ref: [24, 1, 2],
    },
    '0xC41B': {
      name: 'Great Axe+3',
      type: [1, 9],
      upgrade_ref: [24, 1, 3],
    },
    '0xC41C': {
      name: 'Great Axe+4',
      type: [1, 9],
      upgrade_ref: [24, 1, 4],
    },
    '0xC41D': {
      name: 'Great Axe+5',
      type: [1, 9],
      upgrade_ref: [24, 1, 5],
    },
    '0xC41E': {
      name: 'Great Axe+6',
      type: [1, 9],
      upgrade_ref: [24, 1, 6],
    },
    '0xC41F': {
      name: 'Great Axe+7',
      type: [1, 9],
      upgrade_ref: [24, 1, 7],
    },
    '0xC420': {
      name: 'Great Axe+8',
      type: [1, 9],
      upgrade_ref: [24, 1, 8],
    },
    '0xC421': {
      name: 'Great Axe+9',
      type: [1, 9],
      upgrade_ref: [24, 1, 9],
    },
    '0xC422': {
      name: 'Great Axe+10',
      type: [1, 9],
      upgrade_ref: [24, 1, 10],
    },
    '0xC423': {
      name: 'Crushing Great Axe+1',
      type: [1, 9],
      upgrade_ref: [24, 3, 1],
    },
    '0xC424': {
      name: 'Crushing Great Axe+2',
      type: [1, 9],
      upgrade_ref: [24, 3, 2],
    },
    '0xC425': {
      name: 'Crushing Great Axe+3',
      type: [1, 9],
      upgrade_ref: [24, 3, 3],
    },
    '0xC426': {
      name: 'Crushing Great Axe+4',
      type: [1, 9],
      upgrade_ref: [24, 3, 4],
    },
    '0xC427': {
      name: 'Crushing Great Axe+5',
      type: [1, 9],
      upgrade_ref: [24, 3, 5],
    },
    '0xC42D': {
      name: 'Dragon Great Axe+1',
      type: [1, 9],
      upgrade_ref: [24, 5, 1],
    },
    '0xC42E': {
      name: 'Dragon Great Axe+2',
      type: [1, 9],
      upgrade_ref: [24, 5, 2],
    },
    '0xC42F': {
      name: 'Dragon Great Axe+3',
      type: [1, 9],
      upgrade_ref: [24, 5, 3],
    },
    '0xC430': {
      name: 'Dragon Great Axe+4',
      type: [1, 9],
      upgrade_ref: [24, 5, 4],
    },
    '0xC431': {
      name: 'Dragon Great Axe+5',
      type: [1, 9],
      upgrade_ref: [24, 5, 5],
    },
    '0xC437': {
      name: 'Moon Great Axe+1',
      type: [1, 9],
      upgrade_ref: [24, 9, 1],
    },
    '0xC438': {
      name: 'Moon Great Axe+2',
      type: [1, 9],
      upgrade_ref: [24, 9, 2],
    },
    '0xC439': {
      name: 'Moon Great Axe+3',
      type: [1, 9],
      upgrade_ref: [24, 9, 3],
    },
    '0xC43A': {
      name: 'Moon Great Axe+4',
      type: [1, 9],
      upgrade_ref: [24, 9, 4],
    },
    '0xC43B': {
      name: 'Moon Great Axe+5',
      type: [1, 9],
      upgrade_ref: [24, 9, 5],
    },
    '0xC441': {
      name: 'Quality Great Axe+1',
      type: [1, 9],
      upgrade_ref: [24, 2, 1],
    },
    '0xC442': {
      name: 'Quality Great Axe+2',
      type: [1, 9],
      upgrade_ref: [24, 2, 2],
    },
    '0xC443': {
      name: 'Quality Great Axe+3',
      type: [1, 9],
      upgrade_ref: [24, 2, 3],
    },
    '0xC444': {
      name: 'Quality Great Axe+4',
      type: [1, 9],
      upgrade_ref: [24, 2, 4],
    },
    '0xC445': {
      name: 'Quality Great Axe+5',
      type: [1, 9],
      upgrade_ref: [24, 2, 5],
    },
    '0xC44B': {
      name: 'Blessed Great Axe+1',
      type: [1, 9],
      upgrade_ref: [24, 11, 1],
    },
    '0xC44C': {
      name: 'Blessed Great Axe+2',
      type: [1, 9],
      upgrade_ref: [24, 11, 2],
    },
    '0xC44D': {
      name: 'Blessed Great Axe+3',
      type: [1, 9],
      upgrade_ref: [24, 11, 3],
    },
    '0xC44E': {
      name: 'Blessed Great Axe+4',
      type: [1, 9],
      upgrade_ref: [24, 11, 4],
    },
    '0xC44F': {
      name: 'Blessed Great Axe+5',
      type: [1, 9],
      upgrade_ref: [24, 11, 5],
    },
    '0xC47C': {
      name: 'Crescent Axe',
      type: [1, 8],
      upgrade_ref: [23, 1, 0],
    },
    '0xC47D': {
      name: 'Crescent Axe+1',
      type: [1, 8],
      upgrade_ref: [23, 1, 1],
    },
    '0xC47E': {
      name: 'Crescent Axe+2',
      type: [1, 8],
      upgrade_ref: [23, 1, 2],
    },
    '0xC47F': {
      name: 'Crescent Axe+3',
      type: [1, 8],
      upgrade_ref: [23, 1, 3],
    },
    '0xC480': {
      name: 'Crescent Axe+4',
      type: [1, 8],
      upgrade_ref: [23, 1, 4],
    },
    '0xC481': {
      name: 'Crescent Axe+5',
      type: [1, 8],
      upgrade_ref: [23, 1, 5],
    },
    '0xC482': {
      name: 'Crescent Axe+6',
      type: [1, 8],
      upgrade_ref: [23, 1, 6],
    },
    '0xC483': {
      name: 'Crescent Axe+7',
      type: [1, 8],
      upgrade_ref: [23, 1, 7],
    },
    '0xC484': {
      name: 'Crescent Axe+8',
      type: [1, 8],
      upgrade_ref: [23, 1, 8],
    },
    '0xC485': {
      name: 'Crescent Axe+9',
      type: [1, 8],
      upgrade_ref: [23, 1, 9],
    },
    '0xC486': {
      name: 'Crescent Axe+10',
      type: [1, 8],
      upgrade_ref: [23, 1, 10],
    },
    '0xC487': {
      name: 'Crushing Crescent Axe+1',
      type: [1, 8],
      upgrade_ref: [23, 3, 1],
    },
    '0xC488': {
      name: 'Crushing Crescent Axe+2',
      type: [1, 8],
      upgrade_ref: [23, 3, 2],
    },
    '0xC489': {
      name: 'Crushing Crescent Axe+3',
      type: [1, 8],
      upgrade_ref: [23, 3, 3],
    },
    '0xC48A': {
      name: 'Crushing Crescent Axe+4',
      type: [1, 8],
      upgrade_ref: [23, 3, 4],
    },
    '0xC48B': {
      name: 'Crushing Crescent Axe+5',
      type: [1, 8],
      upgrade_ref: [23, 3, 5],
    },
    '0xC491': {
      name: 'Dragon Crescent Axe+1',
      type: [1, 8],
      upgrade_ref: [23, 5, 1],
    },
    '0xC492': {
      name: 'Dragon Crescent Axe+2',
      type: [1, 8],
      upgrade_ref: [23, 5, 2],
    },
    '0xC493': {
      name: 'Dragon Crescent Axe+3',
      type: [1, 8],
      upgrade_ref: [23, 5, 3],
    },
    '0xC494': {
      name: 'Dragon Crescent Axe+4',
      type: [1, 8],
      upgrade_ref: [23, 5, 4],
    },
    '0xC495': {
      name: 'Dragon Crescent Axe+5',
      type: [1, 8],
      upgrade_ref: [23, 5, 5],
    },
    '0xC49B': {
      name: 'Moon Crescent Axe+1',
      type: [1, 8],
      upgrade_ref: [23, 9, 1],
    },
    '0xC49C': {
      name: 'Moon Crescent Axe+2',
      type: [1, 8],
      upgrade_ref: [23, 9, 2],
    },
    '0xC49D': {
      name: 'Moon Crescent Axe+3',
      type: [1, 8],
      upgrade_ref: [23, 9, 3],
    },
    '0xC49E': {
      name: 'Moon Crescent Axe+4',
      type: [1, 8],
      upgrade_ref: [23, 9, 4],
    },
    '0xC49F': {
      name: 'Moon Crescent Axe+5',
      type: [1, 8],
      upgrade_ref: [23, 9, 5],
    },
    '0xC4A5': {
      name: 'Quality Crescent Axe+1',
      type: [1, 8],
      upgrade_ref: [23, 2, 1],
    },
    '0xC4A6': {
      name: 'Quality Crescent Axe+2',
      type: [1, 8],
      upgrade_ref: [23, 2, 2],
    },
    '0xC4A7': {
      name: 'Quality Crescent Axe+3',
      type: [1, 8],
      upgrade_ref: [23, 2, 3],
    },
    '0xC4A8': {
      name: 'Quality Crescent Axe+4',
      type: [1, 8],
      upgrade_ref: [23, 2, 4],
    },
    '0xC4A9': {
      name: 'Quality Crescent Axe+5',
      type: [1, 8],
      upgrade_ref: [23, 2, 5],
    },
    '0xC4AF': {
      name: 'Blessed Crescent Axe+1',
      type: [1, 8],
      upgrade_ref: [23, 11, 1],
    },
    '0xC4B0': {
      name: 'Blessed Crescent Axe+2',
      type: [1, 8],
      upgrade_ref: [23, 11, 2],
    },
    '0xC4B1': {
      name: 'Blessed Crescent Axe+3',
      type: [1, 8],
      upgrade_ref: [23, 11, 3],
    },
    '0xC4B2': {
      name: 'Blessed Crescent Axe+4',
      type: [1, 8],
      upgrade_ref: [23, 11, 4],
    },
    '0xC4B3': {
      name: 'Blessed Crescent Axe+5',
      type: [1, 8],
      upgrade_ref: [23, 11, 5],
    },
    '0xC4E0': {
      name: 'Guillotine Axe',
      type: [1, 8],
      upgrade_ref: [22, 1, 0],
    },
    '0xC4E1': {
      name: 'Guillotine Axe+1',
      type: [1, 8],
      upgrade_ref: [22, 1, 1],
    },
    '0xC4E2': {
      name: 'Guillotine Axe+2',
      type: [1, 8],
      upgrade_ref: [22, 1, 2],
    },
    '0xC4E3': {
      name: 'Guillotine Axe+3',
      type: [1, 8],
      upgrade_ref: [22, 1, 3],
    },
    '0xC4E4': {
      name: 'Guillotine Axe+4',
      type: [1, 8],
      upgrade_ref: [22, 1, 4],
    },
    '0xC4E5': {
      name: 'Guillotine Axe+5',
      type: [1, 8],
      upgrade_ref: [22, 1, 5],
    },
    '0xC4E6': {
      name: 'Guillotine Axe+6',
      type: [1, 8],
      upgrade_ref: [22, 1, 6],
    },
    '0xC4E7': {
      name: 'Guillotine Axe+7',
      type: [1, 8],
      upgrade_ref: [22, 1, 7],
    },
    '0xC4E8': {
      name: 'Guillotine Axe+8',
      type: [1, 8],
      upgrade_ref: [22, 1, 8],
    },
    '0xC4E9': {
      name: 'Guillotine Axe+9',
      type: [1, 8],
      upgrade_ref: [22, 1, 9],
    },
    '0xC4EA': {
      name: 'Guillotine Axe+10',
      type: [1, 8],
      upgrade_ref: [22, 1, 10],
    },
    '0xC4EB': {
      name: 'Crushing Guillotine Axe+1',
      type: [1, 8],
      upgrade_ref: [22, 3, 1],
    },
    '0xC4EC': {
      name: 'Crushing Guillotine Axe+2',
      type: [1, 8],
      upgrade_ref: [22, 3, 2],
    },
    '0xC4ED': {
      name: 'Crushing Guillotine Axe+3',
      type: [1, 8],
      upgrade_ref: [22, 3, 3],
    },
    '0xC4EE': {
      name: 'Crushing Guillotine Axe+4',
      type: [1, 8],
      upgrade_ref: [22, 3, 4],
    },
    '0xC4EF': {
      name: 'Crushing Guillotine Axe+5',
      type: [1, 8],
      upgrade_ref: [22, 3, 5],
    },
    '0xC4F5': {
      name: 'Dragon Guillotine Axe+1',
      type: [1, 8],
      upgrade_ref: [22, 5, 1],
    },
    '0xC4F6': {
      name: 'Dragon Guillotine Axe+2',
      type: [1, 8],
      upgrade_ref: [22, 5, 2],
    },
    '0xC4F7': {
      name: 'Dragon Guillotine Axe+3',
      type: [1, 8],
      upgrade_ref: [22, 5, 3],
    },
    '0xC4F8': {
      name: 'Dragon Guillotine Axe+4',
      type: [1, 8],
      upgrade_ref: [22, 5, 4],
    },
    '0xC4F9': {
      name: 'Dragon Guillotine Axe+5',
      type: [1, 8],
      upgrade_ref: [22, 5, 5],
    },
    '0xC4FF': {
      name: 'Moon Guillotine Axe+1',
      type: [1, 8],
      upgrade_ref: [22, 9, 1],
    },
    '0xC500': {
      name: 'Moon Guillotine Axe+2',
      type: [1, 8],
      upgrade_ref: [22, 9, 2],
    },
    '0xC501': {
      name: 'Moon Guillotine Axe+3',
      type: [1, 8],
      upgrade_ref: [22, 9, 3],
    },
    '0xC502': {
      name: 'Moon Guillotine Axe+4',
      type: [1, 8],
      upgrade_ref: [22, 9, 4],
    },
    '0xC503': {
      name: 'Moon Guillotine Axe+5',
      type: [1, 8],
      upgrade_ref: [22, 9, 5],
    },
    '0xC509': {
      name: 'Quality Guillotine Axe+1',
      type: [1, 8],
      upgrade_ref: [22, 2, 1],
    },
    '0xC50A': {
      name: 'Quality Guillotine Axe+2',
      type: [1, 8],
      upgrade_ref: [22, 2, 2],
    },
    '0xC50B': {
      name: 'Quality Guillotine Axe+3',
      type: [1, 8],
      upgrade_ref: [22, 2, 3],
    },
    '0xC50C': {
      name: 'Quality Guillotine Axe+4',
      type: [1, 8],
      upgrade_ref: [22, 2, 4],
    },
    '0xC50D': {
      name: 'Quality Guillotine Axe+5',
      type: [1, 8],
      upgrade_ref: [22, 2, 5],
    },
    '0xC513': {
      name: 'Blessed Guillotine Axe+1',
      type: [1, 8],
      upgrade_ref: [22, 11, 1],
    },
    '0xC514': {
      name: 'Blessed Guillotine Axe+2',
      type: [1, 8],
      upgrade_ref: [22, 11, 2],
    },
    '0xC515': {
      name: 'Blessed Guillotine Axe+3',
      type: [1, 8],
      upgrade_ref: [22, 11, 3],
    },
    '0xC516': {
      name: 'Blessed Guillotine Axe+4',
      type: [1, 8],
      upgrade_ref: [22, 11, 4],
    },
    '0xC517': {
      name: 'Blessed Guillotine Axe+5',
      type: [1, 8],
      upgrade_ref: [22, 11, 5],
    },
    '0xC544': {
      name: 'Dozer Axe',
      type: [1, 9],
      upgrade_ref: [86, null, null],
    },
    '0xC545': {
      name: 'Dozer Axe',
      type: [1, 9],
    },
    '0xC546': {
      name: 'Dozer Axe',
      type: [1, 9],
    },
    '0xC547': {
      name: 'Dozer Axe',
      type: [1, 9],
    },
    '0xC548': {
      name: 'Dozer Axe',
      type: [1, 9],
    },
    '0xE678': {
      name: '_?_?e?    (Ghost Hand Axe)',
      type: [1, 0],
    },
    '0xEA60': {
      name: 'Club',
      type: [1, 10],
      upgrade_ref: [69, null, null],
    },
    '0xEA61': {
      name: 'Crushing Club+1',
      type: [1, 10],
    },
    '0xEA62': {
      name: 'Crushing Club+2',
      type: [1, 10],
    },
    '0xEA63': {
      name: 'Crushing Club+3',
      type: [1, 10],
    },
    '0xEA64': {
      name: 'Crushing Club+4',
      type: [1, 10],
    },
    '0xEA65': {
      name: 'Crushing Club+5',
      type: [1, 10],
    },
    '0xEA6B': {
      name: 'Blessed Club+1',
      type: [1, 10],
    },
    '0xEA6C': {
      name: 'Blessed Club+2',
      type: [1, 10],
    },
    '0xEA6D': {
      name: 'Blessed Club+3',
      type: [1, 10],
    },
    '0xEA6E': {
      name: 'Blessed Club+4',
      type: [1, 10],
    },
    '0xEA6F': {
      name: 'Blessed Club+5',
      type: [1, 10],
    },
    '0xEAC4': {
      name: 'Mace',
      type: [1, 10],
      upgrade_ref: [25, 1, 0],
    },
    '0xEAC5': {
      name: 'Crushing Mace+1',
      type: [1, 10],
      upgrade_ref: [25, 3, 1],
    },
    '0xEAC6': {
      name: 'Crushing Mace+2',
      type: [1, 10],
      upgrade_ref: [25, 3, 2],
    },
    '0xEAC7': {
      name: 'Crushing Mace+3',
      type: [1, 10],
      upgrade_ref: [25, 3, 3],
    },
    '0xEAC8': {
      name: 'Crushing Mace+4',
      type: [1, 10],
      upgrade_ref: [25, 3, 4],
    },
    '0xEAC9': {
      name: 'Crushing Mace+5',
      type: [1, 10],
      upgrade_ref: [25, 3, 5],
    },
    '0xEACF': {
      name: 'Blessed Mace+1',
      type: [1, 10],
      upgrade_ref: [25, 11, 1],
    },
    '0xEAD0': {
      name: 'Blessed Mace+2',
      type: [1, 10],
      upgrade_ref: [25, 11, 2],
    },
    '0xEAD1': {
      name: 'Blessed Mace+3',
      type: [1, 10],
      upgrade_ref: [25, 11, 3],
    },
    '0xEAD2': {
      name: 'Blessed Mace+4',
      type: [1, 10],
      upgrade_ref: [25, 11, 4],
    },
    '0xEAD3': {
      name: 'Blessed Mace+5',
      type: [1, 10],
      upgrade_ref: [25, 11, 5],
    },
    '0xEAD9': {
      name: 'Mace+1',
      type: [1, 10],
      upgrade_ref: [25, 1, 1],
    },
    '0xEADA': {
      name: 'Mace+2',
      type: [1, 10],
      upgrade_ref: [25, 1, 2],
    },
    '0xEADB': {
      name: 'Mace+3',
      type: [1, 10],
      upgrade_ref: [25, 1, 3],
    },
    '0xEADC': {
      name: 'Mace+4',
      type: [1, 10],
      upgrade_ref: [25, 1, 4],
    },
    '0xEADD': {
      name: 'Mace+5',
      type: [1, 10],
      upgrade_ref: [25, 1, 5],
    },
    '0xEADE': {
      name: 'Mace+6',
      type: [1, 10],
      upgrade_ref: [25, 1, 6],
    },
    '0xEADF': {
      name: 'Mace+7',
      type: [1, 10],
      upgrade_ref: [25, 1, 7],
    },
    '0xEAE0': {
      name: 'Mace+8',
      type: [1, 10],
      upgrade_ref: [25, 1, 8],
    },
    '0xEAE1': {
      name: 'Mace+9',
      type: [1, 10],
      upgrade_ref: [25, 1, 9],
    },
    '0xEAE2': {
      name: 'Mace+10',
      type: [1, 10],
      upgrade_ref: [25, 1, 10],
    },
    '0xEAE3': {
      name: 'Quality Mace+1',
      type: [1, 10],
      upgrade_ref: [25, 2, 1],
    },
    '0xEAE4': {
      name: 'Quality Mace+2',
      type: [1, 10],
      upgrade_ref: [25, 2, 2],
    },
    '0xEAE5': {
      name: 'Quality Mace+3',
      type: [1, 10],
      upgrade_ref: [25, 2, 3],
    },
    '0xEAE6': {
      name: 'Quality Mace+4',
      type: [1, 10],
      upgrade_ref: [25, 2, 4],
    },
    '0xEAE7': {
      name: 'Quality Mace+5',
      type: [1, 10],
      upgrade_ref: [25, 2, 5],
    },
    '0xEAED': {
      name: 'Dragon Mace+1',
      type: [1, 10],
      upgrade_ref: [25, 5, 1],
    },
    '0xEAEE': {
      name: 'Dragon Mace+2',
      type: [1, 10],
      upgrade_ref: [25, 5, 2],
    },
    '0xEAEF': {
      name: 'Dragon Mace+3',
      type: [1, 10],
      upgrade_ref: [25, 5, 3],
    },
    '0xEAF0': {
      name: 'Dragon Mace+4',
      type: [1, 10],
      upgrade_ref: [25, 5, 4],
    },
    '0xEAF1': {
      name: 'Dragon Mace+5',
      type: [1, 10],
      upgrade_ref: [25, 5, 5],
    },
    '0xEAF7': {
      name: 'Moon Mace+1',
      type: [1, 10],
      upgrade_ref: [25, 9, 1],
    },
    '0xEAF8': {
      name: 'Moon Mace+2',
      type: [1, 10],
      upgrade_ref: [25, 9, 2],
    },
    '0xEAF9': {
      name: 'Moon Mace+3',
      type: [1, 10],
      upgrade_ref: [25, 9, 3],
    },
    '0xEAFA': {
      name: 'Moon Mace+4',
      type: [1, 10],
      upgrade_ref: [25, 9, 4],
    },
    '0xEAFB': {
      name: 'Moon Mace+5',
      type: [1, 10],
      upgrade_ref: [25, 9, 5],
    },
    '0xEB28': {
      name: 'War Pick',
      type: [1, 10],
      upgrade_ref: [35, 1, 0],
    },
    '0xEB29': {
      name: 'War Pick+1',
      type: [1, 10],
      upgrade_ref: [35, 1, 1],
    },
    '0xEB2A': {
      name: 'War Pick+2',
      type: [1, 10],
      upgrade_ref: [35, 1, 2],
    },
    '0xEB2B': {
      name: 'War Pick+3',
      type: [1, 10],
      upgrade_ref: [35, 1, 3],
    },
    '0xEB2C': {
      name: 'War Pick+4',
      type: [1, 10],
      upgrade_ref: [35, 1, 4],
    },
    '0xEB2D': {
      name: 'War Pick+5',
      type: [1, 10],
      upgrade_ref: [35, 1, 5],
    },
    '0xEB2E': {
      name: 'War Pick+6',
      type: [1, 10],
      upgrade_ref: [35, 1, 6],
    },
    '0xEB2F': {
      name: 'War Pick+7',
      type: [1, 10],
      upgrade_ref: [35, 1, 7],
    },
    '0xEB30': {
      name: 'War Pick+8',
      type: [1, 10],
      upgrade_ref: [35, 1, 8],
    },
    '0xEB31': {
      name: 'War Pick+9',
      type: [1, 10],
      upgrade_ref: [35, 1, 9],
    },
    '0xEB32': {
      name: 'War Pick+10',
      type: [1, 10],
      upgrade_ref: [35, 1, 10],
    },
    '0xEB33': {
      name: 'Quality War Pick+1',
      type: [1, 10],
      upgrade_ref: [35, 2, 1],
    },
    '0xEB34': {
      name: 'Quality War Pick+2',
      type: [1, 10],
      upgrade_ref: [35, 2, 2],
    },
    '0xEB35': {
      name: 'Quality War Pick+3',
      type: [1, 10],
      upgrade_ref: [35, 2, 3],
    },
    '0xEB36': {
      name: 'Quality War Pick+4',
      type: [1, 10],
      upgrade_ref: [35, 2, 4],
    },
    '0xEB37': {
      name: 'Quality War Pick+5',
      type: [1, 10],
      upgrade_ref: [35, 2, 5],
    },
    '0xEB3D': {
      name: 'Mercury War Pick+1',
      type: [1, 10],
      upgrade_ref: [35, 7, 1],
    },
    '0xEB3E': {
      name: 'Mercury War Pick+2',
      type: [1, 10],
      upgrade_ref: [35, 7, 2],
    },
    '0xEB3F': {
      name: 'Mercury War Pick+3',
      type: [1, 10],
      upgrade_ref: [35, 7, 3],
    },
    '0xEB40': {
      name: 'Mercury War Pick+4',
      type: [1, 10],
      upgrade_ref: [35, 7, 4],
    },
    '0xEB41': {
      name: 'Mercury War Pick+5',
      type: [1, 10],
      upgrade_ref: [35, 7, 5],
    },
    '0xEB47': {
      name: 'Sharp War Pick+1',
      type: [1, 10],
      upgrade_ref: [35, 4, 1],
    },
    '0xEB48': {
      name: 'Sharp War Pick+2',
      type: [1, 10],
      upgrade_ref: [35, 4, 2],
    },
    '0xEB49': {
      name: 'Sharp War Pick+3',
      type: [1, 10],
      upgrade_ref: [35, 4, 3],
    },
    '0xEB4A': {
      name: 'Sharp War Pick+4',
      type: [1, 10],
      upgrade_ref: [35, 4, 4],
    },
    '0xEB4B': {
      name: 'Sharp War Pick+5',
      type: [1, 10],
      upgrade_ref: [35, 4, 5],
    },
    '0xEB51': {
      name: 'Tearing War Pick+1',
      type: [1, 10],
      upgrade_ref: [35, 6, 1],
    },
    '0xEB52': {
      name: 'Tearing War Pick+2',
      type: [1, 10],
      upgrade_ref: [35, 6, 2],
    },
    '0xEB53': {
      name: 'Tearing War Pick+3',
      type: [1, 10],
      upgrade_ref: [35, 6, 3],
    },
    '0xEB54': {
      name: 'Tearing War Pick+4',
      type: [1, 10],
      upgrade_ref: [35, 6, 4],
    },
    '0xEB55': {
      name: 'Tearing War Pick+5',
      type: [1, 10],
      upgrade_ref: [35, 6, 5],
    },
    '0xEB5B': {
      name: 'Moon War Pick+1',
      type: [1, 10],
      upgrade_ref: [35, 9, 1],
    },
    '0xEB5C': {
      name: 'Moon War Pick+2',
      type: [1, 10],
      upgrade_ref: [35, 9, 2],
    },
    '0xEB5D': {
      name: 'Moon War Pick+3',
      type: [1, 10],
      upgrade_ref: [35, 9, 3],
    },
    '0xEB5E': {
      name: 'Moon War Pick+4',
      type: [1, 10],
      upgrade_ref: [35, 9, 4],
    },
    '0xEB5F': {
      name: 'Moon War Pick+5',
      type: [1, 10],
      upgrade_ref: [35, 9, 5],
    },
    '0xEB8C': {
      name: 'Morning Star',
      type: [1, 10],
      upgrade_ref: [26, 1, 0],
    },
    '0xEB8D': {
      name: 'Crushing Morning Star+1',
      type: [1, 10],
      upgrade_ref: [26, 3, 1],
    },
    '0xEB8E': {
      name: 'Crushing Morning Star+2',
      type: [1, 10],
      upgrade_ref: [26, 3, 2],
    },
    '0xEB8F': {
      name: 'Crushing Morning Star+3',
      type: [1, 10],
      upgrade_ref: [26, 3, 3],
    },
    '0xEB90': {
      name: 'Crushing Morning Star+4',
      type: [1, 10],
      upgrade_ref: [26, 3, 4],
    },
    '0xEB91': {
      name: 'Crushing Morning Star+5',
      type: [1, 10],
      upgrade_ref: [26, 3, 5],
    },
    '0xEB97': {
      name: 'Blessed Morning Star+1',
      type: [1, 10],
      upgrade_ref: [26, 11, 1],
    },
    '0xEB98': {
      name: 'Blessed Morning Star+2',
      type: [1, 10],
      upgrade_ref: [26, 11, 2],
    },
    '0xEB99': {
      name: 'Blessed Morning Star+3',
      type: [1, 10],
      upgrade_ref: [26, 11, 3],
    },
    '0xEB9A': {
      name: 'Blessed Morning Star+4',
      type: [1, 10],
      upgrade_ref: [26, 11, 4],
    },
    '0xEB9B': {
      name: 'Blessed Morning Star+5',
      type: [1, 10],
      upgrade_ref: [26, 11, 5],
    },
    '0xEBA1': {
      name: 'Morning Star+1',
      type: [1, 10],
      upgrade_ref: [26, 1, 1],
    },
    '0xEBA2': {
      name: 'Morning Star+2',
      type: [1, 10],
      upgrade_ref: [26, 1, 2],
    },
    '0xEBA3': {
      name: 'Morning Star+3',
      type: [1, 10],
      upgrade_ref: [26, 1, 3],
    },
    '0xEBA4': {
      name: 'Morning Star+4',
      type: [1, 10],
      upgrade_ref: [26, 1, 4],
    },
    '0xEBA5': {
      name: 'Morning Star+5',
      type: [1, 10],
      upgrade_ref: [26, 1, 5],
    },
    '0xEBA6': {
      name: 'Morning Star+6',
      type: [1, 10],
      upgrade_ref: [26, 1, 6],
    },
    '0xEBA7': {
      name: 'Morning Star+7',
      type: [1, 10],
      upgrade_ref: [26, 1, 7],
    },
    '0xEBA8': {
      name: 'Morning Star+8',
      type: [1, 10],
      upgrade_ref: [26, 1, 8],
    },
    '0xEBA9': {
      name: 'Morning Star+9',
      type: [1, 10],
      upgrade_ref: [26, 1, 9],
    },
    '0xEBAA': {
      name: 'Morning Star+10',
      type: [1, 10],
      upgrade_ref: [26, 1, 10],
    },
    '0xEBAB': {
      name: 'Quality Morning Star+1',
      type: [1, 10],
      upgrade_ref: [26, 2, 1],
    },
    '0xEBAC': {
      name: 'Quality Morning Star+2',
      type: [1, 10],
      upgrade_ref: [26, 2, 2],
    },
    '0xEBAD': {
      name: 'Quality Morning Star+3',
      type: [1, 10],
      upgrade_ref: [26, 2, 3],
    },
    '0xEBAE': {
      name: 'Quality Morning Star+4',
      type: [1, 10],
      upgrade_ref: [26, 2, 4],
    },
    '0xEBAF': {
      name: 'Quality Morning Star+5',
      type: [1, 10],
      upgrade_ref: [26, 2, 5],
    },
    '0xEBB5': {
      name: 'Dragon Morning Star+1',
      type: [1, 10],
      upgrade_ref: [26, 5, 1],
    },
    '0xEBB6': {
      name: 'Dragon Morning Star+2',
      type: [1, 10],
      upgrade_ref: [26, 5, 2],
    },
    '0xEBB7': {
      name: 'Dragon Morning Star+3',
      type: [1, 10],
      upgrade_ref: [26, 5, 3],
    },
    '0xEBB8': {
      name: 'Dragon Morning Star+4',
      type: [1, 10],
      upgrade_ref: [26, 5, 4],
    },
    '0xEBB9': {
      name: 'Dragon Morning Star+5',
      type: [1, 10],
      upgrade_ref: [26, 5, 5],
    },
    '0xEBBF': {
      name: 'Moon Morning Star+1',
      type: [1, 10],
      upgrade_ref: [26, 9, 1],
    },
    '0xEBC0': {
      name: 'Moon Morning Star+2',
      type: [1, 10],
      upgrade_ref: [26, 9, 2],
    },
    '0xEBC1': {
      name: 'Moon Morning Star+3',
      type: [1, 10],
      upgrade_ref: [26, 9, 3],
    },
    '0xEBC2': {
      name: 'Moon Morning Star+4',
      type: [1, 10],
      upgrade_ref: [26, 9, 4],
    },
    '0xEBC3': {
      name: 'Moon Morning Star+5',
      type: [1, 10],
      upgrade_ref: [26, 9, 5],
    },
    '0xEBF0': {
      name: 'Great Club',
      type: [1, 11],
      upgrade_ref: [70, null, null],
    },
    '0xEBF1': {
      name: 'Crushing Great Club+1',
      type: [1, 11],
    },
    '0xEBF2': {
      name: 'Crushing Great Club+2',
      type: [1, 11],
    },
    '0xEBF3': {
      name: 'Crushing Great Club+3',
      type: [1, 11],
    },
    '0xEBF4': {
      name: 'Crushing Great Club+4',
      type: [1, 11],
    },
    '0xEBF5': {
      name: 'Crushing Great Club+5',
      type: [1, 11],
    },
    '0xEBFB': {
      name: 'Blessed Great Club+1',
      type: [1, 11],
    },
    '0xEBFC': {
      name: 'Blessed Great Club+2',
      type: [1, 11],
    },
    '0xEBFD': {
      name: 'Blessed Great Club+3',
      type: [1, 11],
    },
    '0xEBFE': {
      name: 'Blessed Great Club+4',
      type: [1, 11],
    },
    '0xEBFF': {
      name: 'Blessed Great Club+5',
      type: [1, 11],
    },
    '0xEC54': {
      name: 'Bramd',
      type: [1, 11],
      upgrade_ref: [50, 14, 0],
    },
    '0xEC55': {
      name: 'Bramd+1',
      type: [1, 11],
      upgrade_ref: [50, 14, 1],
    },
    '0xEC56': {
      name: 'Bramd+2',
      type: [1, 11],
      upgrade_ref: [50, 14, 2],
    },
    '0xEC57': {
      name: 'Bramd+3',
      type: [1, 11],
      upgrade_ref: [50, 14, 3],
    },
    '0xEC58': {
      name: 'Bramd+4',
      type: [1, 11],
      upgrade_ref: [50, 14, 4],
    },
    '0xEC59': {
      name: 'Bramd+5',
      type: [1, 11],
      upgrade_ref: [50, 14, 5],
    },
    '0xECB8': {
      name: 'Pickaxe',
      type: [1, 10],
      upgrade_ref: [34, 1, 0],
    },
    '0xECB9': {
      name: 'Pickaxe+1',
      type: [1, 10],
      upgrade_ref: [34, 1, 1],
    },
    '0xECBA': {
      name: 'Pickaxe+2',
      type: [1, 10],
      upgrade_ref: [34, 1, 2],
    },
    '0xECBB': {
      name: 'Pickaxe+3',
      type: [1, 10],
      upgrade_ref: [34, 1, 3],
    },
    '0xECBC': {
      name: 'Pickaxe+4',
      type: [1, 10],
      upgrade_ref: [34, 1, 4],
    },
    '0xECBD': {
      name: 'Pickaxe+5',
      type: [1, 10],
      upgrade_ref: [34, 1, 5],
    },
    '0xECBE': {
      name: 'Pickaxe+6',
      type: [1, 10],
      upgrade_ref: [34, 1, 6],
    },
    '0xECBF': {
      name: 'Pickaxe+7',
      type: [1, 10],
      upgrade_ref: [34, 1, 7],
    },
    '0xECC0': {
      name: 'Pickaxe+8',
      type: [1, 10],
      upgrade_ref: [34, 1, 8],
    },
    '0xECC1': {
      name: 'Pickaxe+9',
      type: [1, 10],
      upgrade_ref: [34, 1, 9],
    },
    '0xECC2': {
      name: 'Pickaxe+10',
      type: [1, 10],
      upgrade_ref: [34, 1, 10],
    },
    '0xECC3': {
      name: 'Quality Pickaxe+1',
      type: [1, 10],
      upgrade_ref: [34, 2, 1],
    },
    '0xECC4': {
      name: 'Quality Pickaxe+2',
      type: [1, 10],
      upgrade_ref: [34, 2, 2],
    },
    '0xECC5': {
      name: 'Quality Pickaxe+3',
      type: [1, 10],
      upgrade_ref: [34, 2, 3],
    },
    '0xECC6': {
      name: 'Quality Pickaxe+4',
      type: [1, 10],
      upgrade_ref: [34, 2, 4],
    },
    '0xECC7': {
      name: 'Quality Pickaxe+5',
      type: [1, 10],
      upgrade_ref: [34, 2, 5],
    },
    '0xECCD': {
      name: 'Mercury Pickaxe+1',
      type: [1, 10],
      upgrade_ref: [34, 7, 1],
    },
    '0xECCE': {
      name: 'Mercury Pickaxe+2',
      type: [1, 10],
      upgrade_ref: [34, 7, 2],
    },
    '0xECCF': {
      name: 'Mercury Pickaxe+3',
      type: [1, 10],
      upgrade_ref: [34, 7, 3],
    },
    '0xECD0': {
      name: 'Mercury Pickaxe+4',
      type: [1, 10],
      upgrade_ref: [34, 7, 4],
    },
    '0xECD1': {
      name: 'Mercury Pickaxe+5',
      type: [1, 10],
      upgrade_ref: [34, 7, 5],
    },
    '0xECD7': {
      name: 'Sharp Pickaxe+1',
      type: [1, 10],
      upgrade_ref: [34, 4, 1],
    },
    '0xECD8': {
      name: 'Sharp Pickaxe+2',
      type: [1, 10],
      upgrade_ref: [34, 4, 2],
    },
    '0xECD9': {
      name: 'Sharp Pickaxe+3',
      type: [1, 10],
      upgrade_ref: [34, 4, 3],
    },
    '0xECDA': {
      name: 'Sharp Pickaxe+4',
      type: [1, 10],
      upgrade_ref: [34, 4, 4],
    },
    '0xECDB': {
      name: 'Sharp Pickaxe+5',
      type: [1, 10],
      upgrade_ref: [34, 4, 5],
    },
    '0xECE1': {
      name: 'Tearing Pickaxe+1',
      type: [1, 10],
      upgrade_ref: [34, 6, 1],
    },
    '0xECE2': {
      name: 'Tearing Pickaxe+2',
      type: [1, 10],
      upgrade_ref: [34, 6, 2],
    },
    '0xECE3': {
      name: 'Tearing Pickaxe+3',
      type: [1, 10],
      upgrade_ref: [34, 6, 3],
    },
    '0xECE4': {
      name: 'Tearing Pickaxe+4',
      type: [1, 10],
      upgrade_ref: [34, 6, 4],
    },
    '0xECE5': {
      name: 'Tearing Pickaxe+5',
      type: [1, 10],
      upgrade_ref: [34, 6, 5],
    },
    '0xECEB': {
      name: 'Moon Pickaxe+1',
      type: [1, 10],
      upgrade_ref: [34, 9, 1],
    },
    '0xECEC': {
      name: 'Moon Pickaxe+2',
      type: [1, 10],
      upgrade_ref: [34, 9, 2],
    },
    '0xECED': {
      name: 'Moon Pickaxe+3',
      type: [1, 10],
      upgrade_ref: [34, 9, 3],
    },
    '0xECEE': {
      name: 'Moon Pickaxe+4',
      type: [1, 10],
      upgrade_ref: [34, 9, 4],
    },
    '0xECEF': {
      name: 'Moon Pickaxe+5',
      type: [1, 10],
      upgrade_ref: [34, 9, 5],
    },
    '0xED1C': {
      name: 'Meat Cleaver',
      type: [1, 11],
      upgrade_ref: [87, null, null],
    },
    '0xED1D': {
      name: 'Meat Cleaver',
      type: [1, 11],
    },
    '0xED1E': {
      name: 'Meat Cleaver',
      type: [1, 11],
    },
    '0xED1F': {
      name: 'Meat Cleaver',
      type: [1, 11],
    },
    '0xED20': {
      name: 'Meat Cleaver',
      type: [1, 11],
    },
    '0xED21': {
      name: 'Meat Cleaver',
      type: [1, 11],
    },
    '0xED22': {
      name: 'Meat Cleaver',
      type: [1, 11],
    },
    '0xED23': {
      name: 'Meat Cleaver',
      type: [1, 11],
    },
    '0xED80': {
      name: 'Torch    (Non-functioning)',
      type: [1, 11],
      note: 'In the actual game, torches appear as environmental props (e.g., in Valley of Defilement, used to burn flies off during the Leechmonger fight). But as an equippable weapon item, it does nothing — the developers left the entry in the item tables but never made it functional. Players cannot normally obtain it.',
    },
    '0x10D88': {
      name: '_?_?i?    (Ghost Club)',
      type: [1, 0],
    },
    '0x11170': {
      name: 'Short Spear',
      type: [1, 13],
      upgrade_ref: [31, 1, 0],
    },
    '0x11171': {
      name: 'Short Spear+1',
      type: [1, 13],
      upgrade_ref: [31, 1, 1],
    },
    '0x11172': {
      name: 'Short Spear+2',
      type: [1, 13],
      upgrade_ref: [31, 1, 2],
    },
    '0x11173': {
      name: 'Short Spear+3',
      type: [1, 13],
      upgrade_ref: [31, 1, 3],
    },
    '0x11174': {
      name: 'Short Spear+4',
      type: [1, 13],
      upgrade_ref: [31, 1, 4],
    },
    '0x11175': {
      name: 'Short Spear+5',
      type: [1, 13],
      upgrade_ref: [31, 1, 5],
    },
    '0x11176': {
      name: 'Short Spear+6',
      type: [1, 13],
      upgrade_ref: [31, 1, 6],
    },
    '0x11177': {
      name: 'Short Spear+7',
      type: [1, 13],
      upgrade_ref: [31, 1, 7],
    },
    '0x11178': {
      name: 'Short Spear+8',
      type: [1, 13],
      upgrade_ref: [31, 1, 8],
    },
    '0x11179': {
      name: 'Short Spear+9',
      type: [1, 13],
      upgrade_ref: [31, 1, 9],
    },
    '0x1117A': {
      name: 'Short Spear+10',
      type: [1, 13],
      upgrade_ref: [31, 1, 10],
    },
    '0x1117B': {
      name: 'Quality Short Spear+1',
      type: [1, 13],
      upgrade_ref: [31, 2, 1],
    },
    '0x1117C': {
      name: 'Quality Short Spear+2',
      type: [1, 13],
      upgrade_ref: [31, 2, 2],
    },
    '0x1117D': {
      name: 'Quality Short Spear+3',
      type: [1, 13],
      upgrade_ref: [31, 2, 3],
    },
    '0x1117E': {
      name: 'Quality Short Spear+4',
      type: [1, 13],
      upgrade_ref: [31, 2, 4],
    },
    '0x1117F': {
      name: 'Quality Short Spear+5',
      type: [1, 13],
      upgrade_ref: [31, 2, 5],
    },
    '0x11185': {
      name: 'Mercury Short Spear+1',
      type: [1, 13],
      upgrade_ref: [31, 7, 1],
    },
    '0x11186': {
      name: 'Mercury Short Spear+2',
      type: [1, 13],
      upgrade_ref: [31, 7, 2],
    },
    '0x11187': {
      name: 'Mercury Short Spear+3',
      type: [1, 13],
      upgrade_ref: [31, 7, 3],
    },
    '0x11188': {
      name: 'Mercury Short Spear+4',
      type: [1, 13],
      upgrade_ref: [31, 7, 4],
    },
    '0x11189': {
      name: 'Mercury Short Spear+5',
      type: [1, 13],
      upgrade_ref: [31, 7, 5],
    },
    '0x1118F': {
      name: 'Sharp Short Spear+1',
      type: [1, 13],
      upgrade_ref: [31, 4, 1],
    },
    '0x11190': {
      name: 'Sharp Short Spear+2',
      type: [1, 13],
      upgrade_ref: [31, 4, 2],
    },
    '0x11191': {
      name: 'Sharp Short Spear+3',
      type: [1, 13],
      upgrade_ref: [31, 4, 3],
    },
    '0x11192': {
      name: 'Sharp Short Spear+4',
      type: [1, 13],
      upgrade_ref: [31, 4, 4],
    },
    '0x11193': {
      name: 'Sharp Short Spear+5',
      type: [1, 13],
      upgrade_ref: [31, 4, 5],
    },
    '0x11199': {
      name: 'Fatal Short Spear+1',
      type: [1, 13],
      upgrade_ref: [31, 8, 1],
    },
    '0x1119A': {
      name: 'Fatal Short Spear+2',
      type: [1, 13],
      upgrade_ref: [31, 8, 2],
    },
    '0x1119B': {
      name: 'Fatal Short Spear+3',
      type: [1, 13],
      upgrade_ref: [31, 8, 3],
    },
    '0x1119C': {
      name: 'Fatal Short Spear+4',
      type: [1, 13],
      upgrade_ref: [31, 8, 4],
    },
    '0x1119D': {
      name: 'Fatal Short Spear+5',
      type: [1, 13],
      upgrade_ref: [31, 8, 5],
    },
    '0x111A3': {
      name: 'Moon Short Spear+1',
      type: [1, 13],
      upgrade_ref: [31, 9, 1],
    },
    '0x111A4': {
      name: 'Moon Short Spear+2',
      type: [1, 13],
      upgrade_ref: [31, 9, 2],
    },
    '0x111A5': {
      name: 'Moon Short Spear+3',
      type: [1, 13],
      upgrade_ref: [31, 9, 3],
    },
    '0x111A6': {
      name: 'Moon Short Spear+4',
      type: [1, 13],
      upgrade_ref: [31, 9, 4],
    },
    '0x111A7': {
      name: 'Moon Short Spear+5',
      type: [1, 13],
      upgrade_ref: [31, 9, 5],
    },
    '0x111D4': {
      name: 'Winged Spear',
      type: [1, 13],
      upgrade_ref: [32, 1, 0],
    },
    '0x111D5': {
      name: 'Winged Spear+1',
      type: [1, 13],
      upgrade_ref: [32, 1, 1],
    },
    '0x111D6': {
      name: 'Winged Spear+2',
      type: [1, 13],
      upgrade_ref: [32, 1, 2],
    },
    '0x111D7': {
      name: 'Winged Spear+3',
      type: [1, 13],
      upgrade_ref: [32, 1, 3],
    },
    '0x111D8': {
      name: 'Winged Spear+4',
      type: [1, 13],
      upgrade_ref: [32, 1, 4],
    },
    '0x111D9': {
      name: 'Winged Spear+5',
      type: [1, 13],
      upgrade_ref: [32, 1, 5],
    },
    '0x111DA': {
      name: 'Winged Spear+6',
      type: [1, 13],
      upgrade_ref: [32, 1, 6],
    },
    '0x111DB': {
      name: 'Winged Spear+7',
      type: [1, 13],
      upgrade_ref: [32, 1, 7],
    },
    '0x111DC': {
      name: 'Winged Spear+8',
      type: [1, 13],
      upgrade_ref: [32, 1, 8],
    },
    '0x111DD': {
      name: 'Winged Spear+9',
      type: [1, 13],
      upgrade_ref: [32, 1, 9],
    },
    '0x111DE': {
      name: 'Winged Spear+10',
      type: [1, 13],
      upgrade_ref: [32, 1, 10],
    },
    '0x111DF': {
      name: 'Quality Winged Spear+1',
      type: [1, 13],
      upgrade_ref: [32, 2, 1],
    },
    '0x111E0': {
      name: 'Quality Winged Spear+2',
      type: [1, 13],
      upgrade_ref: [32, 2, 2],
    },
    '0x111E1': {
      name: 'Quality Winged Spear+3',
      type: [1, 13],
      upgrade_ref: [32, 2, 3],
    },
    '0x111E2': {
      name: 'Quality Winged Spear+4',
      type: [1, 13],
      upgrade_ref: [32, 2, 4],
    },
    '0x111E3': {
      name: 'Quality Winged Spear+5',
      type: [1, 13],
      upgrade_ref: [32, 2, 5],
    },
    '0x111E9': {
      name: 'Mercury Winged Spear+1',
      type: [1, 13],
      upgrade_ref: [32, 7, 1],
    },
    '0x111EA': {
      name: 'Mercury Winged Spear+2',
      type: [1, 13],
      upgrade_ref: [32, 7, 2],
    },
    '0x111EB': {
      name: 'Mercury Winged Spear+3',
      type: [1, 13],
      upgrade_ref: [32, 7, 3],
    },
    '0x111EC': {
      name: 'Mercury Winged Spear+4',
      type: [1, 13],
      upgrade_ref: [32, 7, 4],
    },
    '0x111ED': {
      name: 'Mercury Winged Spear+5',
      type: [1, 13],
      upgrade_ref: [32, 7, 5],
    },
    '0x111F3': {
      name: 'Sharp Winged Spear+1',
      type: [1, 13],
      upgrade_ref: [32, 4, 1],
    },
    '0x111F4': {
      name: 'Sharp Winged Spear+2',
      type: [1, 13],
      upgrade_ref: [32, 4, 2],
    },
    '0x111F5': {
      name: 'Sharp Winged Spear+3',
      type: [1, 13],
      upgrade_ref: [32, 4, 3],
    },
    '0x111F6': {
      name: 'Sharp Winged Spear+4',
      type: [1, 13],
      upgrade_ref: [32, 4, 4],
    },
    '0x111F7': {
      name: 'Sharp Winged Spear+5',
      type: [1, 13],
      upgrade_ref: [32, 4, 5],
    },
    '0x111FD': {
      name: 'Fatal Winged Spear+1',
      type: [1, 13],
      upgrade_ref: [32, 8, 1],
    },
    '0x111FE': {
      name: 'Fatal Winged Spear+2',
      type: [1, 13],
      upgrade_ref: [32, 8, 2],
    },
    '0x111FF': {
      name: 'Fatal Winged Spear+3',
      type: [1, 13],
      upgrade_ref: [32, 8, 3],
    },
    '0x11200': {
      name: 'Fatal Winged Spear+4',
      type: [1, 13],
      upgrade_ref: [32, 8, 4],
    },
    '0x11201': {
      name: 'Fatal Winged Spear+5',
      type: [1, 13],
      upgrade_ref: [32, 8, 5],
    },
    '0x11207': {
      name: 'Moon Winged Spear+1',
      type: [1, 13],
      upgrade_ref: [32, 9, 1],
    },
    '0x11208': {
      name: 'Moon Winged Spear+2',
      type: [1, 13],
      upgrade_ref: [32, 9, 2],
    },
    '0x11209': {
      name: 'Moon Winged Spear+3',
      type: [1, 13],
      upgrade_ref: [32, 9, 3],
    },
    '0x1120A': {
      name: 'Moon Winged Spear+4',
      type: [1, 13],
      upgrade_ref: [32, 9, 4],
    },
    '0x1120B': {
      name: 'Moon Winged Spear+5',
      type: [1, 13],
      upgrade_ref: [32, 9, 5],
    },
    '0x1129C': {
      name: 'Istarelle',
      type: [1, 13],
      upgrade_ref: [56, 14, 0],
    },
    '0x1129D': {
      name: 'Istarelle+1',
      type: [1, 13],
      upgrade_ref: [56, 14, 1],
    },
    '0x1129E': {
      name: 'Istarelle+2',
      type: [1, 13],
      upgrade_ref: [56, 14, 2],
    },
    '0x1129F': {
      name: 'Istarelle+3',
      type: [1, 13],
      upgrade_ref: [56, 14, 3],
    },
    '0x112A0': {
      name: 'Istarelle+4',
      type: [1, 13],
      upgrade_ref: [56, 14, 4],
    },
    '0x112A1': {
      name: 'Istarelle+5',
      type: [1, 13],
      upgrade_ref: [56, 14, 5],
    },
    '0x11300': {
      name: 'Scraping Spear',
      type: [1, 13],
      upgrade_ref: [88, null, null],
    },
    '0x11301': {
      name: 'Scraping Spear',
      type: [1, 13],
    },
    '0x11302': {
      name: 'Scraping Spear',
      type: [1, 13],
    },
    '0x11303': {
      name: 'Scraping Spear',
      type: [1, 13],
    },
    '0x11304': {
      name: 'Scraping Spear',
      type: [1, 13],
    },
    '0x11305': {
      name: 'Scraping Spear',
      type: [1, 13],
    },
    '0x13498': {
      name: '_?_?i?    (Ghost Spear)',
      type: [1, 0],
    },
    '0x13880': {
      name: 'War Scythe',
      type: [1, 14],
      upgrade_ref: [33, 1, 0],
    },
    '0x13881': {
      name: 'War Scythe+1',
      type: [1, 14],
      upgrade_ref: [33, 1, 1],
    },
    '0x13882': {
      name: 'War Scythe+2',
      type: [1, 14],
      upgrade_ref: [33, 1, 2],
    },
    '0x13883': {
      name: 'War Scythe+3',
      type: [1, 14],
      upgrade_ref: [33, 1, 3],
    },
    '0x13884': {
      name: 'War Scythe+4',
      type: [1, 14],
      upgrade_ref: [33, 1, 4],
    },
    '0x13885': {
      name: 'War Scythe+5',
      type: [1, 14],
      upgrade_ref: [33, 1, 5],
    },
    '0x13886': {
      name: 'War Scythe+6',
      type: [1, 14],
      upgrade_ref: [33, 1, 6],
    },
    '0x13887': {
      name: 'War Scythe+7',
      type: [1, 14],
      upgrade_ref: [33, 1, 7],
    },
    '0x13888': {
      name: 'War Scythe+8',
      type: [1, 14],
      upgrade_ref: [33, 1, 8],
    },
    '0x13889': {
      name: 'War Scythe+9',
      type: [1, 14],
      upgrade_ref: [33, 1, 9],
    },
    '0x1388A': {
      name: 'War Scythe+10',
      type: [1, 14],
      upgrade_ref: [33, 1, 10],
    },
    '0x1388B': {
      name: 'Sharp War Scythe+1',
      type: [1, 14],
      upgrade_ref: [33, 4, 1],
    },
    '0x1388C': {
      name: 'Sharp War Scythe+2',
      type: [1, 14],
      upgrade_ref: [33, 4, 2],
    },
    '0x1388D': {
      name: 'Sharp War Scythe+3',
      type: [1, 14],
      upgrade_ref: [33, 4, 3],
    },
    '0x1388E': {
      name: 'Sharp War Scythe+4',
      type: [1, 14],
      upgrade_ref: [33, 4, 4],
    },
    '0x1388F': {
      name: 'Sharp War Scythe+5',
      type: [1, 14],
      upgrade_ref: [33, 4, 5],
    },
    '0x13895': {
      name: 'Tearing War Scythe+1',
      type: [1, 14],
      upgrade_ref: [33, 6, 1],
    },
    '0x13896': {
      name: 'Tearing War Scythe+2',
      type: [1, 14],
      upgrade_ref: [33, 6, 2],
    },
    '0x13897': {
      name: 'Tearing War Scythe+3',
      type: [1, 14],
      upgrade_ref: [33, 6, 3],
    },
    '0x13898': {
      name: 'Tearing War Scythe+4',
      type: [1, 14],
      upgrade_ref: [33, 6, 4],
    },
    '0x13899': {
      name: 'Tearing War Scythe+5',
      type: [1, 14],
      upgrade_ref: [33, 6, 5],
    },
    '0x1389F': {
      name: 'Crescent War Scythe+1',
      type: [1, 14],
    },
    '0x138A0': {
      name: 'Crescent War Scythe+2',
      type: [1, 14],
    },
    '0x138A1': {
      name: 'Crescent War Scythe+3',
      type: [1, 14],
    },
    '0x138A2': {
      name: 'Crescent War Scythe+4',
      type: [1, 14],
    },
    '0x138A3': {
      name: 'Crescent War Scythe+5',
      type: [1, 14],
    },
    '0x138A9': {
      name: 'Quality War Scythe+1',
      type: [1, 14],
      upgrade_ref: [33, 2, 1],
    },
    '0x138AA': {
      name: 'Quality War Scythe+2',
      type: [1, 14],
      upgrade_ref: [33, 2, 2],
    },
    '0x138AB': {
      name: 'Quality War Scythe+3',
      type: [1, 14],
      upgrade_ref: [33, 2, 3],
    },
    '0x138AC': {
      name: 'Quality War Scythe+4',
      type: [1, 14],
      upgrade_ref: [33, 2, 4],
    },
    '0x138AD': {
      name: 'Quality War Scythe+5',
      type: [1, 14],
      upgrade_ref: [33, 2, 5],
    },
    '0x138B3': {
      name: 'Mercury War Scythe+1',
      type: [1, 14],
      upgrade_ref: [33, 7, 1],
    },
    '0x138B4': {
      name: 'Mercury War Scythe+2',
      type: [1, 14],
      upgrade_ref: [33, 7, 2],
    },
    '0x138B5': {
      name: 'Mercury War Scythe+3',
      type: [1, 14],
      upgrade_ref: [33, 7, 3],
    },
    '0x138B6': {
      name: 'Mercury War Scythe+4',
      type: [1, 14],
      upgrade_ref: [33, 7, 4],
    },
    '0x138B7': {
      name: 'Mercury War Scythe+5',
      type: [1, 14],
      upgrade_ref: [33, 7, 5],
    },
    '0x138BD': {
      name: 'Moon War Scythe+1',
      type: [1, 14],
      upgrade_ref: [33, 9, 1],
    },
    '0x138BE': {
      name: 'Moon War Scythe+2',
      type: [1, 14],
      upgrade_ref: [33, 9, 2],
    },
    '0x138BF': {
      name: 'Moon War Scythe+3',
      type: [1, 14],
      upgrade_ref: [33, 9, 3],
    },
    '0x138C0': {
      name: 'Moon War Scythe+4',
      type: [1, 14],
      upgrade_ref: [33, 9, 4],
    },
    '0x138C1': {
      name: 'Moon War Scythe+5',
      type: [1, 14],
      upgrade_ref: [33, 9, 5],
    },
    '0x138E4': {
      name: 'Mirdan Hammer',
      type: [1, 14],
      upgrade_ref: [27, 1, 0],
    },
    '0x138E5': {
      name: 'Mirdan Hammer+1',
      type: [1, 14],
      upgrade_ref: [27, 1, 1],
    },
    '0x138E6': {
      name: 'Mirdan Hammer+2',
      type: [1, 14],
      upgrade_ref: [27, 1, 2],
    },
    '0x138E7': {
      name: 'Mirdan Hammer+3',
      type: [1, 14],
      upgrade_ref: [27, 1, 3],
    },
    '0x138E8': {
      name: 'Mirdan Hammer+4',
      type: [1, 14],
      upgrade_ref: [27, 1, 4],
    },
    '0x138E9': {
      name: 'Mirdan Hammer+5',
      type: [1, 14],
      upgrade_ref: [27, 1, 5],
    },
    '0x138EA': {
      name: 'Mirdan Hammer+6',
      type: [1, 14],
      upgrade_ref: [27, 1, 6],
    },
    '0x138EB': {
      name: 'Mirdan Hammer+7',
      type: [1, 14],
      upgrade_ref: [27, 1, 7],
    },
    '0x138EC': {
      name: 'Mirdan Hammer+8',
      type: [1, 14],
      upgrade_ref: [27, 1, 8],
    },
    '0x138ED': {
      name: 'Mirdan Hammer+9',
      type: [1, 14],
      upgrade_ref: [27, 1, 9],
    },
    '0x138EE': {
      name: 'Mirdan Hammer+10',
      type: [1, 14],
      upgrade_ref: [27, 1, 10],
    },
    '0x138EF': {
      name: 'Quality Mirdan Hammer+1',
      type: [1, 14],
      upgrade_ref: [27, 2, 1],
    },
    '0x138F0': {
      name: 'Quality Mirdan Hammer+2',
      type: [1, 14],
      upgrade_ref: [27, 2, 2],
    },
    '0x138F1': {
      name: 'Quality Mirdan Hammer+3',
      type: [1, 14],
      upgrade_ref: [27, 2, 3],
    },
    '0x138F2': {
      name: 'Quality Mirdan Hammer+4',
      type: [1, 14],
      upgrade_ref: [27, 2, 4],
    },
    '0x138F3': {
      name: 'Quality Mirdan Hammer+5',
      type: [1, 14],
      upgrade_ref: [27, 2, 5],
    },
    '0x138F9': {
      name: 'Mercury Mirdan Hammer+1',
      type: [1, 14],
    },
    '0x138FA': {
      name: 'Mercury Mirdan Hammer+2',
      type: [1, 14],
    },
    '0x138FB': {
      name: 'Mercury Mirdan Hammer+3',
      type: [1, 14],
    },
    '0x13903': {
      name: 'Crushing Mirdan Hammer+1',
      type: [1, 14],
      upgrade_ref: [27, 3, 1],
    },
    '0x13904': {
      name: 'Crushing Mirdan Hammer+2',
      type: [1, 14],
      upgrade_ref: [27, 3, 2],
    },
    '0x13905': {
      name: 'Crushing Mirdan Hammer+3',
      type: [1, 14],
      upgrade_ref: [27, 3, 3],
    },
    '0x13906': {
      name: 'Crushing Mirdan Hammer+4',
      type: [1, 14],
      upgrade_ref: [27, 3, 4],
    },
    '0x13907': {
      name: 'Crushing Mirdan Hammer+5',
      type: [1, 14],
      upgrade_ref: [27, 3, 5],
    },
    '0x1390D': {
      name: 'Dragon Mirdan Hammer+1',
      type: [1, 14],
      upgrade_ref: [27, 5, 1],
    },
    '0x1390E': {
      name: 'Dragon Mirdan Hammer+2',
      type: [1, 14],
      upgrade_ref: [27, 5, 2],
    },
    '0x1390F': {
      name: 'Dragon Mirdan Hammer+3',
      type: [1, 14],
      upgrade_ref: [27, 5, 3],
    },
    '0x13910': {
      name: 'Dragon Mirdan Hammer+4',
      type: [1, 14],
      upgrade_ref: [27, 5, 4],
    },
    '0x13911': {
      name: 'Dragon Mirdan Hammer+5',
      type: [1, 14],
      upgrade_ref: [27, 5, 5],
    },
    '0x13917': {
      name: 'Moon Mirdan Hammer+1',
      type: [1, 14],
      upgrade_ref: [27, 9, 1],
    },
    '0x13918': {
      name: 'Moon Mirdan Hammer+2',
      type: [1, 14],
      upgrade_ref: [27, 9, 2],
    },
    '0x13919': {
      name: 'Moon Mirdan Hammer+3',
      type: [1, 14],
      upgrade_ref: [27, 9, 3],
    },
    '0x1391A': {
      name: 'Moon Mirdan Hammer+4',
      type: [1, 14],
      upgrade_ref: [27, 9, 4],
    },
    '0x1391B': {
      name: 'Moon Mirdan Hammer+5',
      type: [1, 14],
      upgrade_ref: [27, 9, 5],
    },
    '0x13921': {
      name: 'Blessed Mirdan Hammer+1',
      type: [1, 14],
      upgrade_ref: [27, 11, 1],
    },
    '0x13922': {
      name: 'Blessed Mirdan Hammer+2',
      type: [1, 14],
      upgrade_ref: [27, 11, 2],
    },
    '0x13923': {
      name: 'Blessed Mirdan Hammer+3',
      type: [1, 14],
      upgrade_ref: [27, 11, 3],
    },
    '0x13924': {
      name: 'Blessed Mirdan Hammer+4',
      type: [1, 14],
      upgrade_ref: [27, 11, 4],
    },
    '0x13925': {
      name: 'Blessed Mirdan Hammer+5',
      type: [1, 14],
      upgrade_ref: [27, 11, 5],
    },
    '0x13948': {
      name: 'Halberd',
      type: [1, 14],
      upgrade_ref: [28, 1, 0],
    },
    '0x13949': {
      name: 'Halberd+1',
      type: [1, 14],
      upgrade_ref: [28, 1, 1],
    },
    '0x1394A': {
      name: 'Halberd+2',
      type: [1, 14],
      upgrade_ref: [28, 1, 2],
    },
    '0x1394B': {
      name: 'Halberd+3',
      type: [1, 14],
      upgrade_ref: [28, 1, 3],
    },
    '0x1394C': {
      name: 'Halberd+4',
      type: [1, 14],
      upgrade_ref: [28, 1, 4],
    },
    '0x1394D': {
      name: 'Halberd+5',
      type: [1, 14],
      upgrade_ref: [28, 1, 5],
    },
    '0x1394E': {
      name: 'Halberd+6',
      type: [1, 14],
      upgrade_ref: [28, 1, 6],
    },
    '0x1394F': {
      name: 'Halberd+7',
      type: [1, 14],
      upgrade_ref: [28, 1, 7],
    },
    '0x13950': {
      name: 'Halberd+8',
      type: [1, 14],
      upgrade_ref: [28, 1, 8],
    },
    '0x13951': {
      name: 'Halberd+9',
      type: [1, 14],
      upgrade_ref: [28, 1, 9],
    },
    '0x13952': {
      name: 'Halberd+10',
      type: [1, 14],
      upgrade_ref: [28, 1, 10],
    },
    '0x13953': {
      name: 'Quality Halberd+1',
      type: [1, 14],
      upgrade_ref: [28, 2, 1],
    },
    '0x13954': {
      name: 'Quality Halberd+2',
      type: [1, 14],
      upgrade_ref: [28, 2, 2],
    },
    '0x13955': {
      name: 'Quality Halberd+3',
      type: [1, 14],
      upgrade_ref: [28, 2, 3],
    },
    '0x13956': {
      name: 'Quality Halberd+4',
      type: [1, 14],
      upgrade_ref: [28, 2, 4],
    },
    '0x13957': {
      name: 'Quality Halberd+5',
      type: [1, 14],
      upgrade_ref: [28, 2, 5],
    },
    '0x1395D': {
      name: 'Mercury Halberd+1',
      type: [1, 14],
    },
    '0x1395E': {
      name: 'Mercury Halberd+2',
      type: [1, 14],
    },
    '0x1395F': {
      name: 'Mercury Halberd+3',
      type: [1, 14],
    },
    '0x13967': {
      name: 'Crushing Halberd+1',
      type: [1, 14],
      upgrade_ref: [28, 3, 1],
    },
    '0x13968': {
      name: 'Crushing Halberd+2',
      type: [1, 14],
      upgrade_ref: [28, 3, 2],
    },
    '0x13969': {
      name: 'Crushing Halberd+3',
      type: [1, 14],
      upgrade_ref: [28, 3, 3],
    },
    '0x1396A': {
      name: 'Crushing Halberd+4',
      type: [1, 14],
      upgrade_ref: [28, 3, 4],
    },
    '0x1396B': {
      name: 'Crushing Halberd+5',
      type: [1, 14],
      upgrade_ref: [28, 3, 5],
    },
    '0x13971': {
      name: 'Dragon Halberd+1',
      type: [1, 14],
      upgrade_ref: [28, 5, 1],
    },
    '0x13972': {
      name: 'Dragon Halberd+2',
      type: [1, 14],
      upgrade_ref: [28, 5, 2],
    },
    '0x13973': {
      name: 'Dragon Halberd+3',
      type: [1, 14],
      upgrade_ref: [28, 5, 3],
    },
    '0x13974': {
      name: 'Dragon Halberd+4',
      type: [1, 14],
      upgrade_ref: [28, 5, 4],
    },
    '0x13975': {
      name: 'Dragon Halberd+5',
      type: [1, 14],
      upgrade_ref: [28, 5, 5],
    },
    '0x1397B': {
      name: 'Moon Halberd+1',
      type: [1, 14],
      upgrade_ref: [28, 9, 1],
    },
    '0x1397C': {
      name: 'Moon Halberd+2',
      type: [1, 14],
      upgrade_ref: [28, 9, 2],
    },
    '0x1397D': {
      name: 'Moon Halberd+3',
      type: [1, 14],
      upgrade_ref: [28, 9, 3],
    },
    '0x1397E': {
      name: 'Moon Halberd+4',
      type: [1, 14],
      upgrade_ref: [28, 9, 4],
    },
    '0x1397F': {
      name: 'Moon Halberd+5',
      type: [1, 14],
      upgrade_ref: [28, 9, 5],
    },
    '0x13985': {
      name: 'Blessed Halberd+1',
      type: [1, 14],
      upgrade_ref: [28, 11, 1],
    },
    '0x13986': {
      name: 'Blessed Halberd+2',
      type: [1, 14],
      upgrade_ref: [28, 11, 2],
    },
    '0x13987': {
      name: 'Blessed Halberd+3',
      type: [1, 14],
      upgrade_ref: [28, 11, 3],
    },
    '0x13988': {
      name: 'Blessed Halberd+4',
      type: [1, 14],
      upgrade_ref: [28, 11, 4],
    },
    '0x13989': {
      name: 'Blessed Halberd+5',
      type: [1, 14],
      upgrade_ref: [28, 11, 5],
    },
    '0x139AC': {
      name: 'Phosphorescent Pole',
      type: [1, 14],
      upgrade_ref: [61, 14, 0],
    },
    '0x139AD': {
      name: 'Phosphorescent Pole+1',
      type: [1, 14],
      upgrade_ref: [61, 14, 1],
    },
    '0x139AE': {
      name: 'Phosphorescent Pole+2',
      type: [1, 14],
      upgrade_ref: [61, 14, 2],
    },
    '0x139AF': {
      name: 'Phosphorescent Pole+3',
      type: [1, 14],
      upgrade_ref: [61, 14, 3],
    },
    '0x139B0': {
      name: 'Phosphorescent Pole+4',
      type: [1, 14],
      upgrade_ref: [61, 14, 4],
    },
    '0x139B1': {
      name: 'Phosphorescent Pole+5',
      type: [1, 14],
      upgrade_ref: [61, 14, 5],
    },
    '0x15BA8': {
      name: '_?_?z?r?    (Ghost Spear #2)',
      type: [1, 0],
    },
    '0x15F90': {
      name: 'Wooden Catalyst',
      type: [6, 1],
      durability: 30,
      note: "The most basic catalyst for casting magic. Magic Adjustment 126, Physical damage 55. Weighs 0.3, requires 5 STR. Can be forged into the Insanity Catalyst using the Yellow Demon's Soul (Old Monk).",
    },
    '0x15F91': {
      name: 'Crushing Wooden Catalyst+1',
      type: [6, 0],
      durability: 30,
      note: "Upgraded Wooden Catalyst. The base catalyst (Magic Adjustment 126) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15F92': {
      name: 'Crushing Wooden Catalyst+2',
      type: [6, 0],
      durability: 30,
      note: "Upgraded Wooden Catalyst. The base catalyst (Magic Adjustment 126) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15F93': {
      name: 'Crushing Wooden Catalyst+3',
      type: [6, 0],
      durability: 30,
      note: "Upgraded Wooden Catalyst. The base catalyst (Magic Adjustment 126) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15F94': {
      name: 'Crushing Wooden Catalyst+4',
      type: [6, 0],
      durability: 30,
      note: "Upgraded Wooden Catalyst. The base catalyst (Magic Adjustment 126) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15F95': {
      name: 'Crushing Wooden Catalyst+5',
      type: [6, 0],
      durability: 30,
      note: "Upgraded Wooden Catalyst. The base catalyst (Magic Adjustment 126) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15FF4': {
      name: 'Silver Catalyst',
      type: [6, 1],
      durability: 40,
      note: "Catalyst of the Yormedar lineage magicians. Magic Adjustment 119, Physical damage 57. Weighs 0.5, requires 6 STR. Increases maximum MP by 20%. Can be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15FF5': {
      name: 'Crushing Silver Catalyst+1',
      type: [6, 0],
      durability: 40,
      note: "Upgraded Silver Catalyst. Retains the +20% max MP effect. The base Silver Catalyst (Magic Adjustment 119) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15FF6': {
      name: 'Crushing Silver Catalyst+2',
      type: [6, 0],
      durability: 40,
      note: "Upgraded Silver Catalyst. Retains the +20% max MP effect. The base Silver Catalyst (Magic Adjustment 119) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15FF7': {
      name: 'Crushing Silver Catalyst+3',
      type: [6, 0],
      durability: 40,
      note: "Upgraded Silver Catalyst. Retains the +20% max MP effect. The base Silver Catalyst (Magic Adjustment 119) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15FF8': {
      name: 'Crushing Silver Catalyst+4',
      type: [6, 0],
      durability: 40,
      note: "Upgraded Silver Catalyst. Retains the +20% max MP effect. The base Silver Catalyst (Magic Adjustment 119) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x15FF9': {
      name: 'Crushing Silver Catalyst+5',
      type: [6, 0],
      durability: 40,
      note: "Upgraded Silver Catalyst. Retains the +20% max MP effect. The base Silver Catalyst (Magic Adjustment 119) can alternatively be forged into the Insanity Catalyst using the Yellow Demon's Soul.",
    },
    '0x16058': {
      name: 'Insanity Catalyst',
      type: [6, 1],
      durability: 400,
      note: "Forged from the Old Monk's Demon's Soul. The strongest catalyst with Magic Adjustment 143, Physical damage 59. Weighs 0.5, requires 6 STR and 16 MAG. Drastically increases spell power but halves maximum MP.",
    },
    '0x16059': {
      name: 'Insanity Catalyst',
      type: [6, 0],
      durability: 400,
      note: "Forged from the Old Monk's Demon's Soul. The strongest catalyst with Magic Adjustment 143, Physical damage 59. Weighs 0.5, requires 6 STR and 16 MAG. Drastically increases spell power but halves maximum MP.",
    },
    '0x16120': {
      name: 'Talisman of God',
      type: [6, 2],
      durability: 300,
      note: "The basic talisman for casting Miracles. Miracle Adjustment 131, Physical damage 50. Weighs 0.2, requires 5 STR. Ideal for miracle builds not meeting the Talisman of Beasts' dual 18 MAG/18 FTH requirement.",
    },
    '0x16184': {
      name: 'Talisman of Beasts',
      type: [6, 2],
      durability: 150,
      note: 'A dual-purpose catalyst that casts both Magic and Miracles. Magic Adjustment 121, Physical damage 50. Weighs 0.2, requires 4 STR, 18 MAG, and 18 FTH. Second strongest in Magic Power behind the Insanity Catalyst; lets you cast both spell types from one equipment slot.',
    },
    '0x182B8': {
      name: '_?_???Z?    (Ghost Catalyst)',
      type: [6, 0],
    },
    '0x186A0': {
      name: 'Iron Knuckles',
      type: [1, 12],
      upgrade_ref: [29, 1, 0],
    },
    '0x186A1': {
      name: 'Crushing Iron Knuckles+1',
      type: [1, 12],
      upgrade_ref: [29, 3, 1],
    },
    '0x186A2': {
      name: 'Crushing Iron Knuckles+2',
      type: [1, 12],
      upgrade_ref: [29, 3, 2],
    },
    '0x186A3': {
      name: 'Crushing Iron Knuckles+3',
      type: [1, 12],
      upgrade_ref: [29, 3, 3],
    },
    '0x186A4': {
      name: 'Crushing Iron Knuckles+4',
      type: [1, 12],
      upgrade_ref: [29, 3, 4],
    },
    '0x186A5': {
      name: 'Crushing Iron Knuckles+5',
      type: [1, 12],
      upgrade_ref: [29, 3, 5],
    },
    '0x186AB': {
      name: 'Blessed Iron Knuckles+1',
      type: [1, 12],
      upgrade_ref: [29, 11, 1],
    },
    '0x186AC': {
      name: 'Blessed Iron Knuckles+2',
      type: [1, 12],
      upgrade_ref: [29, 11, 2],
    },
    '0x186AD': {
      name: 'Blessed Iron Knuckles+3',
      type: [1, 12],
      upgrade_ref: [29, 11, 3],
    },
    '0x186AE': {
      name: 'Blessed Iron Knuckles+4',
      type: [1, 12],
      upgrade_ref: [29, 11, 4],
    },
    '0x186AF': {
      name: 'Blessed Iron Knuckles+5',
      type: [1, 12],
      upgrade_ref: [29, 11, 5],
    },
    '0x186B5': {
      name: 'Iron Knuckles+1',
      type: [1, 12],
      upgrade_ref: [29, 1, 1],
    },
    '0x186B6': {
      name: 'Iron Knuckles+2',
      type: [1, 12],
      upgrade_ref: [29, 1, 2],
    },
    '0x186B7': {
      name: 'Iron Knuckles+3',
      type: [1, 12],
      upgrade_ref: [29, 1, 3],
    },
    '0x186B8': {
      name: 'Iron Knuckles+4',
      type: [1, 12],
      upgrade_ref: [29, 1, 4],
    },
    '0x186B9': {
      name: 'Iron Knuckles+5',
      type: [1, 12],
      upgrade_ref: [29, 1, 5],
    },
    '0x186BA': {
      name: 'Iron Knuckles+6',
      type: [1, 12],
      upgrade_ref: [29, 1, 6],
    },
    '0x186BB': {
      name: 'Iron Knuckles+7',
      type: [1, 12],
      upgrade_ref: [29, 1, 7],
    },
    '0x186BC': {
      name: 'Iron Knuckles+8',
      type: [1, 12],
      upgrade_ref: [29, 1, 8],
    },
    '0x186BD': {
      name: 'Iron Knuckles+9',
      type: [1, 12],
      upgrade_ref: [29, 1, 9],
    },
    '0x186BE': {
      name: 'Iron Knuckles+10',
      type: [1, 12],
      upgrade_ref: [29, 1, 10],
    },
    '0x186BF': {
      name: 'Quality Iron Knuckles+1',
      type: [1, 12],
      upgrade_ref: [29, 2, 1],
    },
    '0x186C0': {
      name: 'Quality Iron Knuckles+2',
      type: [1, 12],
      upgrade_ref: [29, 2, 2],
    },
    '0x186C1': {
      name: 'Quality Iron Knuckles+3',
      type: [1, 12],
      upgrade_ref: [29, 2, 3],
    },
    '0x186C2': {
      name: 'Quality Iron Knuckles+4',
      type: [1, 12],
      upgrade_ref: [29, 2, 4],
    },
    '0x186C3': {
      name: 'Quality Iron Knuckles+5',
      type: [1, 12],
      upgrade_ref: [29, 2, 5],
    },
    '0x186C9': {
      name: 'Dragon Iron Knuckles+1',
      type: [1, 12],
      upgrade_ref: [29, 5, 1],
    },
    '0x186CA': {
      name: 'Dragon Iron Knuckles+2',
      type: [1, 12],
      upgrade_ref: [29, 5, 2],
    },
    '0x186CB': {
      name: 'Dragon Iron Knuckles+3',
      type: [1, 12],
      upgrade_ref: [29, 5, 3],
    },
    '0x186CC': {
      name: 'Dragon Iron Knuckles+4',
      type: [1, 12],
      upgrade_ref: [29, 5, 4],
    },
    '0x186CD': {
      name: 'Dragon Iron Knuckles+5',
      type: [1, 12],
      upgrade_ref: [29, 5, 5],
    },
    '0x186D3': {
      name: 'Moon Iron Knuckles+1',
      type: [1, 12],
      upgrade_ref: [29, 9, 1],
    },
    '0x186D4': {
      name: 'Moon Iron Knuckles+2',
      type: [1, 12],
      upgrade_ref: [29, 9, 2],
    },
    '0x186D5': {
      name: 'Moon Iron Knuckles+3',
      type: [1, 12],
      upgrade_ref: [29, 9, 3],
    },
    '0x186D6': {
      name: 'Moon Iron Knuckles+4',
      type: [1, 12],
      upgrade_ref: [29, 9, 4],
    },
    '0x186D7': {
      name: 'Moon Iron Knuckles+5',
      type: [1, 12],
      upgrade_ref: [29, 9, 5],
    },
    '0x18704': {
      name: 'Claws',
      type: [1, 12],
      upgrade_ref: [30, 1, 0],
    },
    '0x18705': {
      name: 'Claws+1',
      type: [1, 12],
      upgrade_ref: [30, 1, 1],
    },
    '0x18706': {
      name: 'Claws+2',
      type: [1, 12],
      upgrade_ref: [30, 1, 2],
    },
    '0x18707': {
      name: 'Claws+3',
      type: [1, 12],
      upgrade_ref: [30, 1, 3],
    },
    '0x18708': {
      name: 'Claws+4',
      type: [1, 12],
      upgrade_ref: [30, 1, 4],
    },
    '0x18709': {
      name: 'Claws+5',
      type: [1, 12],
      upgrade_ref: [30, 1, 5],
    },
    '0x1870A': {
      name: 'Claws+6',
      type: [1, 12],
      upgrade_ref: [30, 1, 6],
    },
    '0x1870B': {
      name: 'Claws+7',
      type: [1, 12],
      upgrade_ref: [30, 1, 7],
    },
    '0x1870C': {
      name: 'Claws+8',
      type: [1, 12],
      upgrade_ref: [30, 1, 8],
    },
    '0x1870D': {
      name: 'Claws+9',
      type: [1, 12],
      upgrade_ref: [30, 1, 9],
    },
    '0x1870E': {
      name: 'Claws+10',
      type: [1, 12],
      upgrade_ref: [30, 1, 10],
    },
    '0x1870F': {
      name: 'Sharp Claws+1',
      type: [1, 12],
      upgrade_ref: [30, 4, 1],
    },
    '0x18710': {
      name: 'Sharp Claws+2',
      type: [1, 12],
      upgrade_ref: [30, 4, 2],
    },
    '0x18711': {
      name: 'Sharp Claws+3',
      type: [1, 12],
      upgrade_ref: [30, 4, 3],
    },
    '0x18712': {
      name: 'Sharp Claws+4',
      type: [1, 12],
      upgrade_ref: [30, 4, 4],
    },
    '0x18713': {
      name: 'Sharp Claws+5',
      type: [1, 12],
      upgrade_ref: [30, 4, 5],
    },
    '0x18719': {
      name: 'Tearing Claws+1',
      type: [1, 12],
      upgrade_ref: [30, 6, 1],
    },
    '0x1871A': {
      name: 'Tearing Claws+2',
      type: [1, 12],
      upgrade_ref: [30, 6, 2],
    },
    '0x1871B': {
      name: 'Tearing Claws+3',
      type: [1, 12],
      upgrade_ref: [30, 6, 3],
    },
    '0x1871C': {
      name: 'Tearing Claws+4',
      type: [1, 12],
      upgrade_ref: [30, 6, 4],
    },
    '0x1871D': {
      name: 'Tearing Claws+5',
      type: [1, 12],
      upgrade_ref: [30, 6, 5],
    },
    '0x18723': {
      name: 'Crescent Claws+1',
      type: [1, 12],
    },
    '0x18724': {
      name: 'Crescent Claws+2',
      type: [1, 12],
    },
    '0x18725': {
      name: 'Crescent Claws+3',
      type: [1, 12],
    },
    '0x18726': {
      name: 'Crescent Claws+4',
      type: [1, 12],
    },
    '0x18727': {
      name: 'Crescent Claws+5',
      type: [1, 12],
    },
    '0x1872D': {
      name: 'Quality Claws+1',
      type: [1, 12],
      upgrade_ref: [30, 2, 1],
    },
    '0x1872E': {
      name: 'Quality Claws+2',
      type: [1, 12],
      upgrade_ref: [30, 2, 2],
    },
    '0x1872F': {
      name: 'Quality Claws+3',
      type: [1, 12],
      upgrade_ref: [30, 2, 3],
    },
    '0x18730': {
      name: 'Quality Claws+4',
      type: [1, 12],
      upgrade_ref: [30, 2, 4],
    },
    '0x18731': {
      name: 'Quality Claws+5',
      type: [1, 12],
      upgrade_ref: [30, 2, 5],
    },
    '0x18737': {
      name: 'Mercury Claws+1',
      type: [1, 12],
      upgrade_ref: [30, 7, 1],
    },
    '0x18738': {
      name: 'Mercury Claws+2',
      type: [1, 12],
      upgrade_ref: [30, 7, 2],
    },
    '0x18739': {
      name: 'Mercury Claws+3',
      type: [1, 12],
      upgrade_ref: [30, 7, 3],
    },
    '0x1873A': {
      name: 'Mercury Claws+4',
      type: [1, 12],
      upgrade_ref: [30, 7, 4],
    },
    '0x1873B': {
      name: 'Mercury Claws+5',
      type: [1, 12],
      upgrade_ref: [30, 7, 5],
    },
    '0x18741': {
      name: 'Moon Claws+1',
      type: [1, 12],
      upgrade_ref: [30, 9, 1],
    },
    '0x18742': {
      name: 'Moon Claws+2',
      type: [1, 12],
      upgrade_ref: [30, 9, 2],
    },
    '0x18743': {
      name: 'Moon Claws+3',
      type: [1, 12],
      upgrade_ref: [30, 9, 3],
    },
    '0x18744': {
      name: 'Moon Claws+4',
      type: [1, 12],
      upgrade_ref: [30, 9, 4],
    },
    '0x18745': {
      name: 'Moon Claws+5',
      type: [1, 12],
      upgrade_ref: [30, 9, 5],
    },
    '0x18768': {
      name: 'Hands of God',
      type: [1, 12],
      upgrade_ref: [54, 14, 0],
    },
    '0x18769': {
      name: 'Hands of God+1',
      type: [1, 12],
      upgrade_ref: [54, 14, 1],
    },
    '0x1876A': {
      name: 'Hands of God+2',
      type: [1, 12],
      upgrade_ref: [54, 14, 2],
    },
    '0x1876B': {
      name: 'Hands of God+3',
      type: [1, 12],
      upgrade_ref: [54, 14, 3],
    },
    '0x1876C': {
      name: 'Hands of God+4',
      type: [1, 12],
      upgrade_ref: [54, 14, 4],
    },
    '0x1876D': {
      name: 'Hands of God+5',
      type: [1, 12],
      upgrade_ref: [54, 14, 5],
    },
    '0x187CC': {
      name: 'Bare Fists',
      type: [1, 12],
    },
    '0x1A9C8': {
      name: '_?_?b?    (Ghost fists)',
      type: [1, 0],
    },
    '0x1FBD0': {
      name: 'Short Bow',
      type: [3, 1],
      upgrade_ref: [36, 1, 0],
    },
    '0x1FBD1': {
      name: 'Short Bow+1',
      type: [3, 1],
      upgrade_ref: [36, 1, 1],
    },
    '0x1FBD2': {
      name: 'Short Bow+2',
      type: [3, 1],
      upgrade_ref: [36, 1, 2],
    },
    '0x1FBD3': {
      name: 'Short Bow+3',
      type: [3, 1],
      upgrade_ref: [36, 1, 3],
    },
    '0x1FBD4': {
      name: 'Short Bow+4',
      type: [3, 1],
      upgrade_ref: [36, 1, 4],
    },
    '0x1FBD5': {
      name: 'Short Bow+5',
      type: [3, 1],
      upgrade_ref: [36, 1, 5],
    },
    '0x1FBD6': {
      name: 'Short Bow+6',
      type: [3, 1],
      upgrade_ref: [36, 1, 6],
    },
    '0x1FBD7': {
      name: 'Short Bow+7',
      type: [3, 1],
      upgrade_ref: [36, 1, 7],
    },
    '0x1FBD8': {
      name: 'Short Bow+8',
      type: [3, 1],
      upgrade_ref: [36, 1, 8],
    },
    '0x1FBD9': {
      name: 'Short Bow+9',
      type: [3, 1],
      upgrade_ref: [36, 1, 9],
    },
    '0x1FBDA': {
      name: 'Short Bow+10',
      type: [3, 1],
      upgrade_ref: [36, 1, 10],
    },
    '0x1FBDB': {
      name: 'R[??0nShort Bow+1',
      type: [3, 1],
    },
    '0x1FBDC': {
      name: 'R[??0nShort Bow+2',
      type: [3, 1],
    },
    '0x1FBDD': {
      name: 'R[??0nShort Bow+3',
      type: [3, 1],
    },
    '0x1FBDE': {
      name: 'R[??0nShort Bow+4',
      type: [3, 1],
    },
    '0x1FBDF': {
      name: 'R[??0nShort Bow+5',
      type: [3, 1],
    },
    '0x1FBE5': {
      name: 'Sticky Short Bow+1',
      type: [3, 1],
      upgrade_ref: [36, 12, 1],
    },
    '0x1FBE6': {
      name: 'Sticky Short Bow+2',
      type: [3, 1],
      upgrade_ref: [36, 12, 2],
    },
    '0x1FBE7': {
      name: 'Sticky Short Bow+3',
      type: [3, 1],
      upgrade_ref: [36, 12, 3],
    },
    '0x1FBE8': {
      name: 'Sticky Short Bow+4',
      type: [3, 1],
      upgrade_ref: [36, 12, 4],
    },
    '0x1FBE9': {
      name: 'Sticky Short Bow+5',
      type: [3, 1],
      upgrade_ref: [36, 12, 5],
    },
    '0x1FBEF': {
      name: 'Quality Short Bow+1',
      type: [3, 1],
      upgrade_ref: [36, 2, 1],
    },
    '0x1FBF0': {
      name: 'Quality Short Bow+2',
      type: [3, 1],
      upgrade_ref: [36, 2, 2],
    },
    '0x1FBF1': {
      name: 'Quality Short Bow+3',
      type: [3, 1],
      upgrade_ref: [36, 2, 3],
    },
    '0x1FBF2': {
      name: 'Quality Short Bow+4',
      type: [3, 1],
      upgrade_ref: [36, 2, 4],
    },
    '0x1FBF3': {
      name: 'Quality Short Bow+5',
      type: [3, 1],
      upgrade_ref: [36, 2, 5],
    },
    '0x1FC34': {
      name: 'Compound Short Bow',
      type: [3, 1],
      upgrade_ref: [37, 1, 0],
    },
    '0x1FC35': {
      name: 'Compound Short Bow+1',
      type: [3, 1],
      upgrade_ref: [37, 1, 1],
    },
    '0x1FC36': {
      name: 'Compound Short Bow+2',
      type: [3, 1],
      upgrade_ref: [37, 1, 2],
    },
    '0x1FC37': {
      name: 'Compound Short Bow+3',
      type: [3, 1],
      upgrade_ref: [37, 1, 3],
    },
    '0x1FC38': {
      name: 'Compound Short Bow+4',
      type: [3, 1],
      upgrade_ref: [37, 1, 4],
    },
    '0x1FC39': {
      name: 'Compound Short Bow+5',
      type: [3, 1],
      upgrade_ref: [37, 1, 5],
    },
    '0x1FC3A': {
      name: 'Compound Short Bow+6',
      type: [3, 1],
      upgrade_ref: [37, 1, 6],
    },
    '0x1FC3B': {
      name: 'Compound Short Bow+7',
      type: [3, 1],
      upgrade_ref: [37, 1, 7],
    },
    '0x1FC3C': {
      name: 'Compound Short Bow+8',
      type: [3, 1],
      upgrade_ref: [37, 1, 8],
    },
    '0x1FC3D': {
      name: 'Compound Short Bow+9',
      type: [3, 1],
      upgrade_ref: [37, 1, 9],
    },
    '0x1FC3E': {
      name: 'Compound Short Bow+10',
      type: [3, 1],
      upgrade_ref: [37, 1, 10],
    },
    '0x1FC3F': {
      name: 'R[??0nCompound Short Bow+1',
      type: [3, 1],
    },
    '0x1FC40': {
      name: 'R[??0nCompound Short Bow+2',
      type: [3, 1],
    },
    '0x1FC41': {
      name: 'R[??0nCompound Short Bow+3',
      type: [3, 1],
    },
    '0x1FC42': {
      name: 'R[??0nCompound Short Bow+4',
      type: [3, 1],
    },
    '0x1FC43': {
      name: 'R[??0nCompound Short Bow+5',
      type: [3, 1],
    },
    '0x1FC49': {
      name: 'Sticky Compound Short Bow+1',
      type: [3, 1],
      upgrade_ref: [37, 12, 1],
    },
    '0x1FC4A': {
      name: 'Sticky Compound Short Bow+2',
      type: [3, 1],
      upgrade_ref: [37, 12, 2],
    },
    '0x1FC4B': {
      name: 'Sticky Compound Short Bow+3',
      type: [3, 1],
      upgrade_ref: [37, 12, 3],
    },
    '0x1FC4C': {
      name: 'Sticky Compound Short Bow+4',
      type: [3, 1],
      upgrade_ref: [37, 12, 4],
    },
    '0x1FC4D': {
      name: 'Sticky Compound Short Bow+5',
      type: [3, 1],
      upgrade_ref: [37, 12, 5],
    },
    '0x1FC53': {
      name: 'Quality Compound Short Bow+1',
      type: [3, 1],
      upgrade_ref: [37, 2, 1],
    },
    '0x1FC54': {
      name: 'Quality Compound Short Bow+2',
      type: [3, 1],
      upgrade_ref: [37, 2, 2],
    },
    '0x1FC55': {
      name: 'Quality Compound Short Bow+3',
      type: [3, 1],
      upgrade_ref: [37, 2, 3],
    },
    '0x1FC56': {
      name: 'Quality Compound Short Bow+4',
      type: [3, 1],
      upgrade_ref: [37, 2, 4],
    },
    '0x1FC57': {
      name: 'Quality Compound Short Bow+5',
      type: [3, 1],
      upgrade_ref: [37, 2, 5],
    },
    '0x1FC98': {
      name: 'Long Bow',
      type: [3, 1],
      upgrade_ref: [38, 1, 0],
    },
    '0x1FC99': {
      name: 'Long Bow+1',
      type: [3, 1],
      upgrade_ref: [38, 1, 1],
    },
    '0x1FC9A': {
      name: 'Long Bow+2',
      type: [3, 1],
      upgrade_ref: [38, 1, 2],
    },
    '0x1FC9B': {
      name: 'Long Bow+3',
      type: [3, 1],
      upgrade_ref: [38, 1, 3],
    },
    '0x1FC9C': {
      name: 'Long Bow+4',
      type: [3, 1],
      upgrade_ref: [38, 1, 4],
    },
    '0x1FC9D': {
      name: 'Long Bow+5',
      type: [3, 1],
      upgrade_ref: [38, 1, 5],
    },
    '0x1FC9E': {
      name: 'Long Bow+6',
      type: [3, 1],
      upgrade_ref: [38, 1, 6],
    },
    '0x1FC9F': {
      name: 'Long Bow+7',
      type: [3, 1],
      upgrade_ref: [38, 1, 7],
    },
    '0x1FCA0': {
      name: 'Long Bow+8',
      type: [3, 1],
      upgrade_ref: [38, 1, 8],
    },
    '0x1FCA1': {
      name: 'Long Bow+9',
      type: [3, 1],
      upgrade_ref: [38, 1, 9],
    },
    '0x1FCA2': {
      name: 'Long Bow+10',
      type: [3, 1],
      upgrade_ref: [38, 1, 10],
    },
    '0x1FCA3': {
      name: 'R[??0nLong Bow+1',
      type: [3, 1],
    },
    '0x1FCA4': {
      name: 'R[??0nLong Bow+2',
      type: [3, 1],
    },
    '0x1FCA5': {
      name: 'R[??0nLong Bow+3',
      type: [3, 1],
    },
    '0x1FCA6': {
      name: 'R[??0nLong Bow+4',
      type: [3, 1],
    },
    '0x1FCA7': {
      name: 'R[??0nLong Bow+5',
      type: [3, 1],
    },
    '0x1FCAD': {
      name: 'Sticky Long Bow+1',
      type: [3, 1],
      upgrade_ref: [38, 12, 1],
    },
    '0x1FCAE': {
      name: 'Sticky Long Bow+2',
      type: [3, 1],
      upgrade_ref: [38, 12, 2],
    },
    '0x1FCAF': {
      name: 'Sticky Long Bow+3',
      type: [3, 1],
      upgrade_ref: [38, 12, 3],
    },
    '0x1FCB0': {
      name: 'Sticky Long Bow+4',
      type: [3, 1],
      upgrade_ref: [38, 12, 4],
    },
    '0x1FCB1': {
      name: 'Sticky Long Bow+5',
      type: [3, 1],
      upgrade_ref: [38, 12, 5],
    },
    '0x1FCB7': {
      name: 'Quality Long Bow+1',
      type: [3, 1],
      upgrade_ref: [38, 2, 1],
    },
    '0x1FCB8': {
      name: 'Quality Long Bow+2',
      type: [3, 1],
      upgrade_ref: [38, 2, 2],
    },
    '0x1FCB9': {
      name: 'Quality Long Bow+3',
      type: [3, 1],
      upgrade_ref: [38, 2, 3],
    },
    '0x1FCBA': {
      name: 'Quality Long Bow+4',
      type: [3, 1],
      upgrade_ref: [38, 2, 4],
    },
    '0x1FCBB': {
      name: 'Quality Long Bow+5',
      type: [3, 1],
      upgrade_ref: [38, 2, 5],
    },
    '0x1FCFC': {
      name: 'Compound Long Bow',
      type: [3, 1],
      upgrade_ref: [39, 1, 0],
    },
    '0x1FCFD': {
      name: 'Compound Long Bow+1',
      type: [3, 1],
      upgrade_ref: [39, 1, 1],
    },
    '0x1FCFE': {
      name: 'Compound Long Bow+2',
      type: [3, 1],
      upgrade_ref: [39, 1, 2],
    },
    '0x1FCFF': {
      name: 'Compound Long Bow+3',
      type: [3, 1],
      upgrade_ref: [39, 1, 3],
    },
    '0x1FD00': {
      name: 'Compound Long Bow+4',
      type: [3, 1],
      upgrade_ref: [39, 1, 4],
    },
    '0x1FD01': {
      name: 'Compound Long Bow+5',
      type: [3, 1],
      upgrade_ref: [39, 1, 5],
    },
    '0x1FD02': {
      name: 'Compound Long Bow+6',
      type: [3, 1],
      upgrade_ref: [39, 1, 6],
    },
    '0x1FD03': {
      name: 'Compound Long Bow+7',
      type: [3, 1],
      upgrade_ref: [39, 1, 7],
    },
    '0x1FD04': {
      name: 'Compound Long Bow+8',
      type: [3, 1],
      upgrade_ref: [39, 1, 8],
    },
    '0x1FD05': {
      name: 'Compound Long Bow+9',
      type: [3, 1],
      upgrade_ref: [39, 1, 9],
    },
    '0x1FD06': {
      name: 'Compound Long Bow+10',
      type: [3, 1],
      upgrade_ref: [39, 1, 10],
    },
    '0x1FD07': {
      name: 'R[??0nCompound Long Bow+1',
      type: [3, 1],
    },
    '0x1FD08': {
      name: 'R[??0nCompound Long Bow+2',
      type: [3, 1],
    },
    '0x1FD09': {
      name: 'R[??0nCompound Long Bow+3',
      type: [3, 1],
    },
    '0x1FD0A': {
      name: 'R[??0nCompound Long Bow+4',
      type: [3, 1],
    },
    '0x1FD0B': {
      name: 'R[??0nCompound Long Bow+5',
      type: [3, 1],
    },
    '0x1FD11': {
      name: 'Sticky Compound Long Bow+1',
      type: [3, 1],
      upgrade_ref: [39, 12, 1],
    },
    '0x1FD12': {
      name: 'Sticky Compound Long Bow+2',
      type: [3, 1],
      upgrade_ref: [39, 12, 2],
    },
    '0x1FD13': {
      name: 'Sticky Compound Long Bow+3',
      type: [3, 1],
      upgrade_ref: [39, 12, 3],
    },
    '0x1FD14': {
      name: 'Sticky Compound Long Bow+4',
      type: [3, 1],
      upgrade_ref: [39, 12, 4],
    },
    '0x1FD15': {
      name: 'Sticky Compound Long Bow+5',
      type: [3, 1],
      upgrade_ref: [39, 12, 5],
    },
    '0x1FD1B': {
      name: 'Quality Compound Long Bow+1',
      type: [3, 1],
      upgrade_ref: [39, 2, 1],
    },
    '0x1FD1C': {
      name: 'Quality Compound Long Bow+2',
      type: [3, 1],
      upgrade_ref: [39, 2, 2],
    },
    '0x1FD1D': {
      name: 'Quality Compound Long Bow+3',
      type: [3, 1],
      upgrade_ref: [39, 2, 3],
    },
    '0x1FD1E': {
      name: 'Quality Compound Long Bow+4',
      type: [3, 1],
      upgrade_ref: [39, 2, 4],
    },
    '0x1FD1F': {
      name: 'Quality Compound Long Bow+5',
      type: [3, 1],
      upgrade_ref: [39, 2, 5],
    },
    '0x1FD60': {
      name: 'White Bow',
      type: [3, 1],
      upgrade_ref: [63, 14, 0],
    },
    '0x1FD61': {
      name: 'White Bow+1',
      type: [3, 1],
      upgrade_ref: [63, 14, 1],
    },
    '0x1FD62': {
      name: 'White Bow+2',
      type: [3, 1],
      upgrade_ref: [63, 14, 2],
    },
    '0x1FD63': {
      name: 'White Bow+3',
      type: [3, 1],
      upgrade_ref: [63, 14, 3],
    },
    '0x1FD64': {
      name: 'White Bow+4',
      type: [3, 1],
      upgrade_ref: [63, 14, 4],
    },
    '0x1FD65': {
      name: 'White Bow+5',
      type: [3, 1],
      upgrade_ref: [63, 14, 5],
    },
    '0x1FDC4': {
      name: 'Lava Bow',
      type: [3, 1],
      upgrade_ref: [89, null, null],
    },
    '0x1FDC5': {
      name: 'Lava Bow',
      type: [3, 1],
    },
    '0x1FDC6': {
      name: 'Lava Bow',
      type: [3, 1],
    },
    '0x1FDC7': {
      name: 'Lava Bow',
      type: [3, 1],
    },
    '0x21EF8': {
      name: '_?_?_    (Ghost Short Bow)',
      type: [3, 0],
    },
    '0x222E0': {
      name: 'Light Crossbow',
      type: [3, 2],
      upgrade_ref: [71, null, null],
    },
    '0x22344': {
      name: 'Heavy Crossbow',
      type: [3, 2],
      upgrade_ref: [72, null, null],
    },
    '0x223A8': {
      name: 'Gargoyle Crossbow',
      type: [3, 2],
      upgrade_ref: [73, null, null],
    },
    '0x24608': {
      name: '_?_?_)    (Ghost Crossbow)',
      type: [3, 0],
    },
    '0x249F0': {
      name: 'Buckler',
      type: [2, 1],
      upgrade_ref: [40, 1, 0],
    },
    '0x249F1': {
      name: 'Buckler+1',
      type: [2, 1],
      upgrade_ref: [40, 1, 1],
    },
    '0x249F2': {
      name: 'Buckler+2',
      type: [2, 1],
      upgrade_ref: [40, 1, 2],
    },
    '0x249F3': {
      name: 'Buckler+3',
      type: [2, 1],
      upgrade_ref: [40, 1, 3],
    },
    '0x249F4': {
      name: 'Buckler+4',
      type: [2, 1],
      upgrade_ref: [40, 1, 4],
    },
    '0x249F5': {
      name: 'Buckler+5',
      type: [2, 1],
      upgrade_ref: [40, 1, 5],
    },
    '0x249F6': {
      name: 'Buckler+6',
      type: [2, 1],
      upgrade_ref: [40, 1, 6],
    },
    '0x249F7': {
      name: 'Buckler+7',
      type: [2, 1],
      upgrade_ref: [40, 1, 7],
    },
    '0x249F8': {
      name: 'Buckler+8',
      type: [2, 1],
      upgrade_ref: [40, 1, 8],
    },
    '0x249F9': {
      name: 'Buckler+9',
      type: [2, 1],
      upgrade_ref: [40, 1, 9],
    },
    '0x249FA': {
      name: 'Buckler+10',
      type: [2, 1],
      upgrade_ref: [40, 1, 10],
    },
    '0x249FB': {
      name: '0o0X0OBuckler+1',
      type: [2, 1],
    },
    '0x249FC': {
      name: '0o0X0OBuckler+2',
      type: [2, 1],
    },
    '0x249FD': {
      name: '0o0X0OBuckler+3',
      type: [2, 1],
    },
    '0x249FE': {
      name: '0o0X0OBuckler+4',
      type: [2, 1],
    },
    '0x249FF': {
      name: '0o0X0OBuckler+5',
      type: [2, 1],
    },
    '0x24A05': {
      name: 'Dark Buckler+1',
      type: [2, 1],
      upgrade_ref: [40, 13, 1],
    },
    '0x24A06': {
      name: 'Dark Buckler+2',
      type: [2, 1],
      upgrade_ref: [40, 13, 2],
    },
    '0x24A07': {
      name: 'Dark Buckler+3',
      type: [2, 1],
      upgrade_ref: [40, 13, 3],
    },
    '0x24A08': {
      name: 'Dark Buckler+4',
      type: [2, 1],
      upgrade_ref: [40, 13, 4],
    },
    '0x24A09': {
      name: 'Dark Buckler+5',
      type: [2, 1],
      upgrade_ref: [40, 13, 5],
    },
    '0x24A54': {
      name: 'Wooden Shield',
      type: [2, 1],
      upgrade_ref: [74, null, null],
    },
    '0x24AB8': {
      name: 'Kite Shield',
      type: [2, 1],
      upgrade_ref: [42, 1, 0],
    },
    '0x24AB9': {
      name: 'Kite Shield+1',
      type: [2, 1],
      upgrade_ref: [42, 1, 1],
    },
    '0x24ABA': {
      name: 'Kite Shield+2',
      type: [2, 1],
      upgrade_ref: [42, 1, 2],
    },
    '0x24ABB': {
      name: 'Kite Shield+3',
      type: [2, 1],
      upgrade_ref: [42, 1, 3],
    },
    '0x24ABC': {
      name: 'Kite Shield+4',
      type: [2, 1],
      upgrade_ref: [42, 1, 4],
    },
    '0x24ABD': {
      name: 'Kite Shield+5',
      type: [2, 1],
      upgrade_ref: [42, 1, 5],
    },
    '0x24ABE': {
      name: 'Kite Shield+6',
      type: [2, 1],
      upgrade_ref: [42, 1, 6],
    },
    '0x24ABF': {
      name: 'Kite Shield+7',
      type: [2, 1],
      upgrade_ref: [42, 1, 7],
    },
    '0x24AC0': {
      name: 'Kite Shield+8',
      type: [2, 1],
      upgrade_ref: [42, 1, 8],
    },
    '0x24AC1': {
      name: 'Kite Shield+9',
      type: [2, 1],
      upgrade_ref: [42, 1, 9],
    },
    '0x24AC2': {
      name: 'Kite Shield+10',
      type: [2, 1],
      upgrade_ref: [42, 1, 10],
    },
    '0x24AC3': {
      name: '0o0X0OKite Shield+1',
      type: [2, 1],
    },
    '0x24AC4': {
      name: '0o0X0OKite Shield+2',
      type: [2, 1],
    },
    '0x24AC5': {
      name: '0o0X0OKite Shield+3',
      type: [2, 1],
    },
    '0x24AC6': {
      name: '0o0X0OKite Shield+4',
      type: [2, 1],
    },
    '0x24AC7': {
      name: '0o0X0OKite Shield+5',
      type: [2, 1],
    },
    '0x24ACD': {
      name: 'Dark Kite Shield+1',
      type: [2, 1],
      upgrade_ref: [42, 13, 1],
    },
    '0x24ACE': {
      name: 'Dark Kite Shield+2',
      type: [2, 1],
      upgrade_ref: [42, 13, 2],
    },
    '0x24ACF': {
      name: 'Dark Kite Shield+3',
      type: [2, 1],
      upgrade_ref: [42, 13, 3],
    },
    '0x24AD0': {
      name: 'Dark Kite Shield+4',
      type: [2, 1],
      upgrade_ref: [42, 13, 4],
    },
    '0x24AD1': {
      name: 'Dark Kite Shield+5',
      type: [2, 1],
      upgrade_ref: [42, 13, 5],
    },
    '0x24B1C': {
      name: 'Heater Shield',
      type: [2, 1],
      upgrade_ref: [41, 1, 0],
    },
    '0x24B1D': {
      name: 'Heater Shield+1',
      type: [2, 1],
      upgrade_ref: [41, 1, 1],
    },
    '0x24B1E': {
      name: 'Heater Shield+2',
      type: [2, 1],
      upgrade_ref: [41, 1, 2],
    },
    '0x24B1F': {
      name: 'Heater Shield+3',
      type: [2, 1],
      upgrade_ref: [41, 1, 3],
    },
    '0x24B20': {
      name: 'Heater Shield+4',
      type: [2, 1],
      upgrade_ref: [41, 1, 4],
    },
    '0x24B21': {
      name: 'Heater Shield+5',
      type: [2, 1],
      upgrade_ref: [41, 1, 5],
    },
    '0x24B22': {
      name: 'Heater Shield+6',
      type: [2, 1],
      upgrade_ref: [41, 1, 6],
    },
    '0x24B23': {
      name: 'Heater Shield+7',
      type: [2, 1],
      upgrade_ref: [41, 1, 7],
    },
    '0x24B24': {
      name: 'Heater Shield+8',
      type: [2, 1],
      upgrade_ref: [41, 1, 8],
    },
    '0x24B25': {
      name: 'Heater Shield+9',
      type: [2, 1],
      upgrade_ref: [41, 1, 9],
    },
    '0x24B26': {
      name: 'Heater Shield+10',
      type: [2, 1],
      upgrade_ref: [41, 1, 10],
    },
    '0x24B27': {
      name: '0o0X0OHeater Shield+1',
      type: [2, 1],
    },
    '0x24B28': {
      name: '0o0X0OHeater Shield+2',
      type: [2, 1],
    },
    '0x24B29': {
      name: '0o0X0OHeater Shield+3',
      type: [2, 1],
    },
    '0x24B2A': {
      name: '0o0X0OHeater Shield+4',
      type: [2, 1],
    },
    '0x24B2B': {
      name: '0o0X0OHeater Shield+5',
      type: [2, 1],
    },
    '0x24B31': {
      name: 'Dark Heater Shield+1',
      type: [2, 1],
      upgrade_ref: [41, 13, 1],
    },
    '0x24B32': {
      name: 'Dark Heater Shield+2',
      type: [2, 1],
      upgrade_ref: [41, 13, 2],
    },
    '0x24B33': {
      name: 'Dark Heater Shield+3',
      type: [2, 1],
      upgrade_ref: [41, 13, 3],
    },
    '0x24B34': {
      name: 'Dark Heater Shield+4',
      type: [2, 1],
      upgrade_ref: [41, 13, 4],
    },
    '0x24B35': {
      name: 'Dark Heater Shield+5',
      type: [2, 1],
      upgrade_ref: [41, 13, 5],
    },
    '0x24B80': {
      name: "Adjudicator's Shield",
      type: [2, 2],
      upgrade_ref: [64, 14, 0],
    },
    '0x24B81': {
      name: "Adjudicator's Shield+1",
      type: [2, 2],
      upgrade_ref: [64, 14, 1],
    },
    '0x24B82': {
      name: "Adjudicator's Shield+2",
      type: [2, 2],
      upgrade_ref: [64, 14, 2],
    },
    '0x24B83': {
      name: "Adjudicator's Shield+3",
      type: [2, 2],
      upgrade_ref: [64, 14, 3],
    },
    '0x24B84': {
      name: "Adjudicator's Shield+4",
      type: [2, 2],
      upgrade_ref: [64, 14, 4],
    },
    '0x24B85': {
      name: "Adjudicator's Shield+5",
      type: [2, 2],
      upgrade_ref: [64, 14, 5],
    },
    '0x24B8B': {
      name: "0o0X0OAdjudicator's Shield+1",
      type: [2, 2],
    },
    '0x24B8C': {
      name: "0o0X0OAdjudicator's Shield+2",
      type: [2, 2],
    },
    '0x24B8D': {
      name: "0o0X0OAdjudicator's Shield+3",
      type: [2, 2],
    },
    '0x24B8E': {
      name: "0o0X0OAdjudicator's Shield+4",
      type: [2, 2],
    },
    '0x24B8F': {
      name: "0o0X0OAdjudicator's Shield+5",
      type: [2, 2],
    },
    '0x24BE4': {
      name: 'Spiked Shield',
      type: [2, 1],
      upgrade_ref: [47, 1, 0],
    },
    '0x24BE5': {
      name: 'Spiked Shield+1',
      type: [2, 1],
      upgrade_ref: [47, 1, 1],
    },
    '0x24BE6': {
      name: 'Spiked Shield+2',
      type: [2, 1],
      upgrade_ref: [47, 1, 2],
    },
    '0x24BE7': {
      name: 'Spiked Shield+3',
      type: [2, 1],
      upgrade_ref: [47, 1, 3],
    },
    '0x24BE8': {
      name: 'Spiked Shield+4',
      type: [2, 1],
      upgrade_ref: [47, 1, 4],
    },
    '0x24BE9': {
      name: 'Spiked Shield+5',
      type: [2, 1],
      upgrade_ref: [47, 1, 5],
    },
    '0x24BEA': {
      name: 'Spiked Shield+6',
      type: [2, 1],
      upgrade_ref: [47, 1, 6],
    },
    '0x24BEB': {
      name: 'Spiked Shield+7',
      type: [2, 1],
      upgrade_ref: [47, 1, 7],
    },
    '0x24BEC': {
      name: 'Spiked Shield+8',
      type: [2, 1],
      upgrade_ref: [47, 1, 8],
    },
    '0x24BED': {
      name: 'Spiked Shield+9',
      type: [2, 1],
      upgrade_ref: [47, 1, 9],
    },
    '0x24BEE': {
      name: 'Spiked Shield+10',
      type: [2, 1],
      upgrade_ref: [47, 1, 10],
    },
    '0x24BEF': {
      name: '0o0X0OSpiked Shield+1',
      type: [2, 1],
    },
    '0x24BF0': {
      name: '0o0X0OSpiked Shield+2',
      type: [2, 1],
    },
    '0x24BF1': {
      name: '0o0X0OSpiked Shield+3',
      type: [2, 1],
    },
    '0x24BF2': {
      name: '0o0X0OSpiked Shield+4',
      type: [2, 1],
    },
    '0x24BF3': {
      name: '0o0X0OSpiked Shield+5',
      type: [2, 1],
    },
    '0x24BF9': {
      name: 'Sharp Spiked Shield+1',
      type: [2, 1],
      upgrade_ref: [47, 4, 1],
    },
    '0x24BFA': {
      name: 'Sharp Spiked Shield+2',
      type: [2, 1],
      upgrade_ref: [47, 4, 2],
    },
    '0x24BFB': {
      name: 'Sharp Spiked Shield+3',
      type: [2, 1],
      upgrade_ref: [47, 4, 3],
    },
    '0x24BFC': {
      name: 'Sharp Spiked Shield+4',
      type: [2, 1],
      upgrade_ref: [47, 4, 4],
    },
    '0x24BFD': {
      name: 'Sharp Spiked Shield+5',
      type: [2, 1],
      upgrade_ref: [47, 4, 5],
    },
    '0x24C48': {
      name: 'Tower Shield',
      type: [2, 2],
      upgrade_ref: [68, 14, 0],
    },
    '0x24C49': {
      name: 'Tower Shield+1',
      type: [2, 2],
      upgrade_ref: [68, 14, 1],
    },
    '0x24C4A': {
      name: 'Tower Shield+2',
      type: [2, 2],
      upgrade_ref: [68, 14, 2],
    },
    '0x24C4B': {
      name: 'Tower Shield+3',
      type: [2, 2],
      upgrade_ref: [68, 14, 3],
    },
    '0x24C4C': {
      name: 'Tower Shield+4',
      type: [2, 2],
      upgrade_ref: [68, 14, 4],
    },
    '0x24C4D': {
      name: 'Tower Shield+5',
      type: [2, 2],
      upgrade_ref: [68, 14, 5],
    },
    '0x24CAC': {
      name: 'Dark Silver Shield',
      type: [2, 2],
      upgrade_ref: [65, 14, 0],
    },
    '0x24CAD': {
      name: 'Dark Silver Shield+1',
      type: [2, 2],
      upgrade_ref: [65, 14, 1],
    },
    '0x24CAE': {
      name: 'Dark Silver Shield+2',
      type: [2, 2],
      upgrade_ref: [65, 14, 2],
    },
    '0x24CAF': {
      name: 'Dark Silver Shield+3',
      type: [2, 2],
      upgrade_ref: [65, 14, 3],
    },
    '0x24CB0': {
      name: 'Dark Silver Shield+4',
      type: [2, 2],
      upgrade_ref: [65, 14, 4],
    },
    '0x24CB1': {
      name: 'Dark Silver Shield+5',
      type: [2, 2],
      upgrade_ref: [65, 14, 5],
    },
    '0x24D10': {
      name: "Soldier's Shield",
      type: [2, 1],
      upgrade_ref: [44, 1, 0],
    },
    '0x24D11': {
      name: "Soldier's Shield+1",
      type: [2, 1],
      upgrade_ref: [44, 1, 1],
    },
    '0x24D12': {
      name: "Soldier's Shield+2",
      type: [2, 1],
      upgrade_ref: [44, 1, 2],
    },
    '0x24D13': {
      name: "Soldier's Shield+3",
      type: [2, 1],
      upgrade_ref: [44, 1, 3],
    },
    '0x24D14': {
      name: "Soldier's Shield+4",
      type: [2, 1],
      upgrade_ref: [44, 1, 4],
    },
    '0x24D15': {
      name: "Soldier's Shield+5",
      type: [2, 1],
      upgrade_ref: [44, 1, 5],
    },
    '0x24D16': {
      name: "Soldier's Shield+6",
      type: [2, 1],
      upgrade_ref: [44, 1, 6],
    },
    '0x24D17': {
      name: "Soldier's Shield+7",
      type: [2, 1],
      upgrade_ref: [44, 1, 7],
    },
    '0x24D18': {
      name: "Soldier's Shield+8",
      type: [2, 1],
      upgrade_ref: [44, 1, 8],
    },
    '0x24D19': {
      name: "Soldier's Shield+9",
      type: [2, 1],
      upgrade_ref: [44, 1, 9],
    },
    '0x24D1A': {
      name: "Soldier's Shield+10",
      type: [2, 1],
      upgrade_ref: [44, 1, 10],
    },
    '0x24D25': {
      name: "Dark Soldier's Shield+1",
      type: [2, 1],
      upgrade_ref: [44, 13, 1],
    },
    '0x24D26': {
      name: "Dark Soldier's Shield+2",
      type: [2, 1],
      upgrade_ref: [44, 13, 2],
    },
    '0x24D27': {
      name: "Dark Soldier's Shield+3",
      type: [2, 1],
      upgrade_ref: [44, 13, 3],
    },
    '0x24D28': {
      name: "Dark Soldier's Shield+4",
      type: [2, 1],
      upgrade_ref: [44, 13, 4],
    },
    '0x24D29': {
      name: "Dark Soldier's Shield+5",
      type: [2, 1],
      upgrade_ref: [44, 13, 5],
    },
    '0x24D74': {
      name: "Knight's Shield",
      type: [2, 1],
      upgrade_ref: [43, 1, 0],
    },
    '0x24D75': {
      name: "Knight's Shield+1",
      type: [2, 1],
      upgrade_ref: [43, 1, 1],
    },
    '0x24D76': {
      name: "Knight's Shield+2",
      type: [2, 1],
      upgrade_ref: [43, 1, 2],
    },
    '0x24D77': {
      name: "Knight's Shield+3",
      type: [2, 1],
      upgrade_ref: [43, 1, 3],
    },
    '0x24D78': {
      name: "Knight's Shield+4",
      type: [2, 1],
      upgrade_ref: [43, 1, 4],
    },
    '0x24D79': {
      name: "Knight's Shield+5",
      type: [2, 1],
      upgrade_ref: [43, 1, 5],
    },
    '0x24D7A': {
      name: "Knight's Shield+6",
      type: [2, 1],
      upgrade_ref: [43, 1, 6],
    },
    '0x24D7B': {
      name: "Knight's Shield+7",
      type: [2, 1],
      upgrade_ref: [43, 1, 7],
    },
    '0x24D7C': {
      name: "Knight's Shield+8",
      type: [2, 1],
      upgrade_ref: [43, 1, 8],
    },
    '0x24D7D': {
      name: "Knight's Shield+9",
      type: [2, 1],
      upgrade_ref: [43, 1, 9],
    },
    '0x24D7E': {
      name: "Knight's Shield+10",
      type: [2, 1],
      upgrade_ref: [43, 1, 10],
    },
    '0x24D7F': {
      name: "0o0X0OKnight's Shield+1",
      type: [2, 1],
    },
    '0x24D80': {
      name: "0o0X0OKnight's Shield+2",
      type: [2, 1],
    },
    '0x24D81': {
      name: "0o0X0OKnight's Shield+3",
      type: [2, 1],
    },
    '0x24D82': {
      name: "0o0X0OKnight's Shield+4",
      type: [2, 1],
    },
    '0x24D83': {
      name: "0o0X0OKnight's Shield+5",
      type: [2, 1],
    },
    '0x24D89': {
      name: "Dark Knight's Shield+1",
      type: [2, 1],
      upgrade_ref: [43, 13, 1],
    },
    '0x24D8A': {
      name: "Dark Knight's Shield+2",
      type: [2, 1],
      upgrade_ref: [43, 13, 2],
    },
    '0x24D8B': {
      name: "Dark Knight's Shield+3",
      type: [2, 1],
      upgrade_ref: [43, 13, 3],
    },
    '0x24D8C': {
      name: "Dark Knight's Shield+4",
      type: [2, 1],
      upgrade_ref: [43, 13, 4],
    },
    '0x24D8D': {
      name: "Dark Knight's Shield+5",
      type: [2, 1],
      upgrade_ref: [43, 13, 5],
    },
    '0x24DD8': {
      name: "Slave's Shield",
      type: [2, 1],
      upgrade_ref: [75, null, null],
    },
    '0x24E3C': {
      name: 'Rune Shield',
      type: [2, 1],
      upgrade_ref: [67, 14, 0],
    },
    '0x24E3D': {
      name: 'Rune Shield+1',
      type: [2, 1],
      upgrade_ref: [67, 14, 1],
    },
    '0x24E3E': {
      name: 'Rune Shield+2',
      type: [2, 1],
      upgrade_ref: [67, 14, 2],
    },
    '0x24E3F': {
      name: 'Rune Shield+3',
      type: [2, 1],
      upgrade_ref: [67, 14, 3],
    },
    '0x24E40': {
      name: 'Rune Shield+4',
      type: [2, 1],
      upgrade_ref: [67, 14, 4],
    },
    '0x24E41': {
      name: 'Rune Shield+5',
      type: [2, 1],
      upgrade_ref: [67, 14, 5],
    },
    '0x24EA0': {
      name: 'Large Brushwood Shield',
      type: [2, 2],
      upgrade_ref: [66, 14, 0],
    },
    '0x24EA1': {
      name: 'Large Brushwood Shield+1',
      type: [2, 2],
      upgrade_ref: [66, 14, 1],
    },
    '0x24EA2': {
      name: 'Large Brushwood Shield+2',
      type: [2, 2],
      upgrade_ref: [66, 14, 2],
    },
    '0x24EA3': {
      name: 'Large Brushwood Shield+3',
      type: [2, 2],
      upgrade_ref: [66, 14, 3],
    },
    '0x24EA4': {
      name: 'Large Brushwood Shield+4',
      type: [2, 2],
      upgrade_ref: [66, 14, 4],
    },
    '0x24EA5': {
      name: 'Large Brushwood Shield+5',
      type: [2, 2],
      upgrade_ref: [66, 14, 5],
    },
    '0x24F04': {
      name: 'Steel Shield',
      type: [2, 2],
      upgrade_ref: [45, 1, 0],
    },
    '0x24F05': {
      name: 'Steel Shield+1',
      type: [2, 2],
      upgrade_ref: [45, 1, 1],
    },
    '0x24F06': {
      name: 'Steel Shield+2',
      type: [2, 2],
      upgrade_ref: [45, 1, 2],
    },
    '0x24F07': {
      name: 'Steel Shield+3',
      type: [2, 2],
      upgrade_ref: [45, 1, 3],
    },
    '0x24F08': {
      name: 'Steel Shield+4',
      type: [2, 2],
      upgrade_ref: [45, 1, 4],
    },
    '0x24F09': {
      name: 'Steel Shield+5',
      type: [2, 2],
      upgrade_ref: [45, 1, 5],
    },
    '0x24F0A': {
      name: 'Steel Shield+6',
      type: [2, 2],
      upgrade_ref: [45, 1, 6],
    },
    '0x24F0B': {
      name: 'Steel Shield+7',
      type: [2, 2],
      upgrade_ref: [45, 1, 7],
    },
    '0x24F0C': {
      name: 'Steel Shield+8',
      type: [2, 2],
      upgrade_ref: [45, 1, 8],
    },
    '0x24F0D': {
      name: 'Steel Shield+9',
      type: [2, 2],
      upgrade_ref: [45, 1, 9],
    },
    '0x24F0E': {
      name: 'Steel Shield+10',
      type: [2, 2],
      upgrade_ref: [45, 1, 10],
    },
    '0x24F19': {
      name: 'Dark Steel Shield+1',
      type: [2, 2],
      upgrade_ref: [45, 13, 1],
    },
    '0x24F1A': {
      name: 'Dark Steel Shield+2',
      type: [2, 2],
      upgrade_ref: [45, 13, 2],
    },
    '0x24F1B': {
      name: 'Dark Steel Shield+3',
      type: [2, 2],
      upgrade_ref: [45, 13, 3],
    },
    '0x24F1C': {
      name: 'Dark Steel Shield+4',
      type: [2, 2],
      upgrade_ref: [45, 13, 4],
    },
    '0x24F1D': {
      name: 'Dark Steel Shield+5',
      type: [2, 2],
      upgrade_ref: [45, 13, 5],
    },
    '0x24F68': {
      name: 'Purple Flame Shield',
      type: [2, 2],
      upgrade_ref: [46, 1, 0],
    },
    '0x24F69': {
      name: 'Purple Flame Shield+1',
      type: [2, 2],
      upgrade_ref: [46, 1, 1],
    },
    '0x24F6A': {
      name: 'Purple Flame Shield+2',
      type: [2, 2],
      upgrade_ref: [46, 1, 2],
    },
    '0x24F6B': {
      name: 'Purple Flame Shield+3',
      type: [2, 2],
      upgrade_ref: [46, 1, 3],
    },
    '0x24F6C': {
      name: 'Purple Flame Shield+4',
      type: [2, 2],
      upgrade_ref: [46, 1, 4],
    },
    '0x24F6D': {
      name: 'Purple Flame Shield+5',
      type: [2, 2],
      upgrade_ref: [46, 1, 5],
    },
    '0x24F6E': {
      name: 'Purple Flame Shield+6',
      type: [2, 2],
      upgrade_ref: [46, 1, 6],
    },
    '0x24F6F': {
      name: 'Purple Flame Shield+7',
      type: [2, 2],
      upgrade_ref: [46, 1, 7],
    },
    '0x24F70': {
      name: 'Purple Flame Shield+8',
      type: [2, 2],
      upgrade_ref: [46, 1, 8],
    },
    '0x24F71': {
      name: 'Purple Flame Shield+9',
      type: [2, 2],
      upgrade_ref: [46, 1, 9],
    },
    '0x24F72': {
      name: 'Purple Flame Shield+10',
      type: [2, 2],
      upgrade_ref: [46, 1, 10],
    },
    '0x24F7D': {
      name: 'Dark Purple Flame Shield+1',
      type: [2, 2],
      upgrade_ref: [46, 13, 1],
    },
    '0x24F7E': {
      name: 'Dark Purple Flame Shield+2',
      type: [2, 2],
      upgrade_ref: [46, 13, 2],
    },
    '0x24F7F': {
      name: 'Dark Purple Flame Shield+3',
      type: [2, 2],
      upgrade_ref: [46, 13, 3],
    },
    '0x24F80': {
      name: 'Dark Purple Flame Shield+4',
      type: [2, 2],
      upgrade_ref: [46, 13, 4],
    },
    '0x24F81': {
      name: 'Dark Purple Flame Shield+5',
      type: [2, 2],
      upgrade_ref: [46, 13, 5],
    },
    '0x24FCC': {
      name: 'Leather Shield',
      type: [2, 1],
      upgrade_ref: [76, null, null],
    },
    '0x26D18': {
      name: '_?_?v?    (Ghost Shield)',
      type: [2, 0],
    },
    '0x27100': {
      name: 'Arrow',
      type: [4, 1],
      note: 'Standard arrow for bows. 70/0/0 physical damage, Piercing type, weight 0.1. Sold by Blacksmith Boldwin (20 souls) and Graverobber Blige (10 souls).',
    },
    '0x27164': {
      name: 'Heavy Arrow',
      type: [4, 1],
      note: 'High-damage arrow for bows. 85/0/0 physical damage, Piercing type, weight 0.1. Sold by Patches in the Nexus (30 souls).',
    },
    '0x271C8': {
      name: 'Light Arrow',
      type: [4, 1],
      note: 'Extended-range arrow for bows. 70/0/0 physical damage, Piercing type, weight 0.1. Sold by Graverobber Blige in 4-2 (50 souls). Deals the same damage as a standard Arrow but flies farther.',
    },
    '0x2722C': {
      name: '0?0?0?0?0?0?0?    (Nothing loads)',
      type: [4, 0],
    },
    '0x27290': {
      name: 'Fire Arrow',
      type: [4, 1],
      note: 'Fire-damage arrow for bows. 40/0/80 split physical/fire damage, Piercing type, weight 0.1. Sold by Graverobber Blige in 4-2 (50 souls).',
    },
    '0x272F4': {
      name: 'Rotten Arrow',
      type: [4, 1],
      note: 'Poison-inflicting arrow for bows. 35/0/0 physical damage, Piercing type, weight 0.1, Poison 240 buildup. Sold by the Filthy Woman in 5-x (400 souls).',
    },
    '0x27358': {
      name: 'Holy Arrow',
      type: [4, 1],
      note: 'Magic-damage arrow for bows. 0/150/0 pure magic damage, Piercing type, weight 0.1. Also known as Toad-Eye Arrow. Sold by Graverobber Blige in 4-2 (200 souls); also dropped by Silver Skeleton archers in 4-1.',
    },
    '0x273BC': {
      name: 'White Arrow',
      type: [4, 1],
      note: 'The hardest-hitting standard arrow for bows. 115/0/0 physical damage, Piercing type, weight 0.1. Sold by Patches in the Nexus (500 souls) or obtained by trading with Sparkly the Crow in 4-1 (Soul Remains, Augite of Guidance, or Moonlightstone shards/chunks).',
    },
    '0x27420': {
      name: 'Wooden Arrow',
      type: [4, 1],
      note: 'The cheapest, weakest arrow for bows. 60/0/0 physical damage, Piercing type, weight 0.1. Sold by Graverobber Blige in 4-x (5 souls).',
    },
    '0x29428': {
      name: '_?_?w?{R    (Ghost Quiver)',
      type: [4, 0],
    },
    '0x29810': {
      name: 'Bolt',
      type: [4, 2],
      note: 'Standard bolt for crossbows. 50/0/0 physical damage, Piercing type, weight 0.1. Sold by Blacksmith Boldwin in the Nexus (30 souls).',
    },
    '0x29874': {
      name: 'Heavy Bolt',
      type: [4, 2],
      note: 'High-damage bolt for crossbows. 60/0/0 physical damage, Piercing type, weight 0.1. Sold by Patches in the Nexus (40 souls).',
    },
    '0x298D8': {
      name: 'Black Bolt',
      type: [4, 2],
      note: 'The strongest bolt for crossbows. 80/0/0 physical damage, Piercing type, weight 0.1. Sold by the Dregling Merchant in 1-x (200 souls) or the Once Royal Mistress in 3-1 (100 souls); also a rare drop from Gargoyle crossbowmen in 3-2.',
    },
    '0x2993C': {
      name: 'Wooden Bolt',
      type: [4, 2],
      note: 'The cheapest, weakest bolt for crossbows. 40/0/0 physical damage, Piercing type, weight 0.1. Sold by the Dregling Merchant in 1-x (10 souls).',
    },
  },
};
