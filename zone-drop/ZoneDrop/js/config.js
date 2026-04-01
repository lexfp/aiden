// =============================================================================
// STORM ZONE — Configuration
// All game constants in one place for easy tuning.
// =============================================================================

const CFG = {
  MAP: { SIZE: 800, HALF: 400 },
  GRID: 4, // building snap grid size (units)

  PLAYER: {
    SPEED: 10,
    SPRINT_MULT: 1.65,
    CROUCH_MULT: 0.5,
    JUMP_POWER: 10,
    GRAVITY: -26,
    HEIGHT: 1.8,    // total capsule height
    MAX_HP: 100,
    MAX_SHIELD: 100,
    CAM_DIST: 5.5,
    CAM_HEIGHT: 1.4, // look-at offset above feet
    CAM_PITCH_MIN: -0.5,
    CAM_PITCH_MAX: 1.1,
    MOUSE_SENS: 0.0018,
  },

  // Each weapon: name, damage, rps (rounds/sec), reload (sec), mag, maxAmmo,
  // ammoType, spread (radians half-angle), type ('hitscan'|'projectile'),
  // rarity, pellets (shotgun), splashR (splash radius for explosives)
  WEAPONS: {
    blast_rifle: {
      name: 'Blast Rifle', damage: 28, rps: 7, reload: 1.8,
      mag: 30, maxAmmo: 180, ammoType: 'light',
      spread: 0.025, type: 'hitscan', rarity: 'common',
      color: 0x888888, weight: 40,
    },
    pump_scatter: {
      name: 'Pump Scatter', damage: 15, pellets: 7, rps: 0.9, reload: 0.6,
      mag: 7, maxAmmo: 56, ammoType: 'heavy',
      spread: 0.1, type: 'hitscan', range: 55, rarity: 'uncommon',
      color: 0x8B4513, weight: 25,
    },
    phantom_smg: {
      name: 'Phantom SMG', damage: 17, rps: 12, reload: 1.4,
      mag: 45, maxAmmo: 270, ammoType: 'light',
      spread: 0.06, type: 'hitscan', rarity: 'common',
      color: 0x4169E1, weight: 35,
    },
    vortex_sniper: {
      name: 'Vortex Sniper', damage: 105, rps: 0.55, reload: 2.5,
      mag: 5, maxAmmo: 35, ammoType: 'sniper',
      spread: 0.002, type: 'hitscan', rarity: 'rare',
      color: 0x9B59B6, weight: 15,
    },
    detonator: {
      name: 'Detonator', damage: 80, splashR: 5.5, rps: 0.5, reload: 2.0,
      mag: 4, maxAmmo: 16, ammoType: 'rocket',
      spread: 0, type: 'projectile', projSpeed: 60, rarity: 'epic',
      color: 0xFF4500, weight: 5,
    },
  },

  // Ammo pool key names (also used in pickup items)
  AMMO_TYPES: ['light', 'heavy', 'sniper', 'rocket'],

  BUILDING: {
    GRID: 4,
    W: 4, H: 4, THICK: 0.3,
    COST: { wall: 10, floor: 10, ramp: 10, roof: 10 }, // wood cost
    MAT_HP: { wood: 150, stone: 300, metal: 500 },
  },

  // Storm phases: wait=safe-zone waiting time, shrink=shrink time,
  //   damage=hp/s outside, radiusEnd=safe radius after shrink
  STORM: {
    PHASES: [
      { wait: 80,  shrink: 40, damage: 1,  radiusEnd: 300 },
      { wait: 60,  shrink: 35, damage: 2,  radiusEnd: 200 },
      { wait: 45,  shrink: 25, damage: 4,  radiusEnd: 120 },
      { wait: 30,  shrink: 20, damage: 8,  radiusEnd: 60  },
      { wait: 20,  shrink: 15, damage: 16, radiusEnd: 20  },
      { wait: 10,  shrink: 10, damage: 50, radiusEnd: 0   },
    ],
    START_RADIUS: 420,
    CENTER_X: 0, CENTER_Z: 0,
  },

  LOOT: {
    CHESTS: 30,
    WEAPON_CRATES: 15, // special crates that always contain weapons
    FLOOR_LOOT: 45,
    INTERACT_DIST: 3.2,
    RARITY_WEIGHTS: { common: 45, uncommon: 30, rare: 15, epic: 8, legendary: 2 },
    RARITY_COLORS: {
      common: 0xaaaaaa, uncommon: 0x27ae60,
      rare: 0x3498db, epic: 0x8e44ad, legendary: 0xf39c12,
    },
  },

  BOTS: {
    COUNT: 19,
    SPEED: 7,
    SPRINT_MULT: 1.4,
    SHOOT_RANGE: 45,
    SIGHT_RANGE: 55,
    WANDER_INTERVAL: [3, 8], // [min, max] seconds between wander targets
  },

  // World environment
  WORLD: {
    TREE_COUNT: 80,
    ROCK_COUNT: 50,
    HOUSE_COUNT: 12,
    FOG_COLOR: 0x87CEEB,
    FOG_NEAR: 200,
    FOG_FAR: 600,
    SKY_COLOR: 0x87CEEB,
    GROUND_COLOR: 0x4a7c59,
    TREE_WOOD: 30,  // wood gained per hit on tree
    ROCK_STONE: 20, // stone gained per hit on rock
    HIT_COUNT: 3,   // hits to harvest resource node
  },
};
