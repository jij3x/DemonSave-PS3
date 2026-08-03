export default {
  _meta: {
    description: "Demon's Souls item type and sub-type relationship table.",
    source: 'http://demonssouls.wikidot.com/ (wiki)',
    schema:
      'Keyed by integer type_id. Each type entry has { name, sub_types } where sub_types is keyed by integer sub_type_id (starting from 0 within each type; 0 is reserved for Experimental) with { name }.',
  },
  types: {
    0: {
      name: 'Non-functional Leftover',
      sub_types: {
        0: {
          name: 'Unused Items',
        },
      },
    },
    1: {
      name: 'Weapon',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Dagger',
        },
        2: {
          name: 'Straight Sword',
        },
        3: {
          name: 'Large Sword',
        },
        4: {
          name: 'Very Large Sword',
        },
        5: {
          name: 'Curved Sword',
        },
        6: {
          name: 'Katana',
        },
        7: {
          name: 'Rapier',
        },
        8: {
          name: 'Axe',
        },
        9: {
          name: 'Large Axe',
        },
        10: {
          name: 'Hammer',
        },
        11: {
          name: 'Large Hammer',
        },
        12: {
          name: 'Fist',
        },
        13: {
          name: 'Spear',
        },
        14: {
          name: 'Pole',
        },
      },
    },
    2: {
      name: 'Shield',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Parry Shield',
        },
        2: {
          name: 'Bash Shield',
        },
      },
    },
    3: {
      name: 'Bow',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Bow',
        },
        2: {
          name: 'Crossbow',
        },
      },
    },
    4: {
      name: 'Ammo',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Arrow',
        },
        2: {
          name: 'Bolt',
        },
      },
    },
    5: {
      name: 'Armor',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Head',
        },
        2: {
          name: 'Chest',
        },
        3: {
          name: 'Arms',
        },
        4: {
          name: 'Legs',
        },
      },
    },
    6: {
      name: 'Casting Tool',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Catalyst',
        },
        2: {
          name: 'Talisman',
        },
      },
    },
    7: {
      name: 'Spell',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Magic',
        },
        2: {
          name: 'Miracle',
        },
      },
    },
    8: {
      name: 'Ring',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Ring',
        },
      },
    },
    9: {
      name: 'Ore',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Ore',
        },
      },
    },
    10: {
      name: 'Consumables',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Health Restoration',
        },
        2: {
          name: 'Magic Restoration',
        },
        3: {
          name: 'Status Ailment Cure',
        },
        4: {
          name: 'Projectile Weapon',
        },
        5: {
          name: 'Weapon Buff',
        },
        6: {
          name: 'Other',
        },
      },
    },
    11: {
      name: 'Souls',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Souls',
        },
        2: {
          name: "Demon's Souls",
        },
      },
    },
    12: {
      name: 'Key Item',
      sub_types: {
        0: {
          name: 'Experimental',
        },
        1: {
          name: 'Eye Stone',
        },
        2: {
          name: 'Special',
        },
        3: {
          name: 'Key',
        },
      },
    },
  },
};
