// ═══════════════════ SOLO LEVELING — CONFIG ═══════════════════

const CONFIG = {
  GRAVITY: 0.6,
  MAX_FALL: 14,
  GROUND_Y_OFFSET: 60,
  WORLD_WIDTH: 5000,
  CAMERA_LERP: 0.08,
  CAMERA_DEAD_ZONE: 40,
  PLAYER_WIDTH: 28,
  PLAYER_HEIGHT: 52,
  DASH_SPEED: 14,
  DASH_DURATION: 0.18,
  DASH_COOLDOWN: 0.8,
  IFRAME_DURATION: 0.3,
  COMBO_TIMEOUT: 1.5,
  SCREEN_SHAKE_DECAY: 0.88,
  BASE_MOVE_SPEED: 3.5,
  BASE_JUMP_FORCE: -11.5,
  BASE_HP: 100,
  BASE_MP: 50,
  MP_REGEN: 0.03,
  BASE_LIGHT_DMG: 10,
  BASE_HEAVY_DMG: 25,
  BASE_SHADOW_DMG: 40,
  LIGHT_CD: 0.3,
  HEAVY_CD: 0.6,
  SHADOW_CD: 1.2,
  SHADOW_MP_COST: 20,
  XP_BASE: 100,
  XP_SCALE: 1.35,
  STAT_POINTS_PER_LEVEL: 5
};

const COLORS = {
  bg: '#080610',
  shadow: '#9400D3',
  purpleLight: '#b44fff',
  purpleDark: '#32174D',
  systemAccent: '#3b82f6',
  systemBorder: '#22d3ee',
  systemBg: '#0a1628',
  hp: '#22c55e',
  mp: '#8b5cf6',
  xp: '#f59e0b',
  boss: '#ef4444',
  text: '#f0e8ff',
  textDim: '#9488aa',
  rankE: '#6b7280',
  rankD: '#3b82f6',
  rankC: '#22c55e',
  rankB: '#f59e0b',
  rankA: '#f97316',
  rankS: '#ef4444',
  rankNational: '#fbbf24'
};

const RANK_DEFS = [
  { rank: 'E', minLevel: 1, color: COLORS.rankE },
  { rank: 'D', minLevel: 11, color: COLORS.rankD },
  { rank: 'C', minLevel: 26, color: COLORS.rankC },
  { rank: 'B', minLevel: 46, color: COLORS.rankB },
  { rank: 'A', minLevel: 71, color: COLORS.rankA },
  { rank: 'S', minLevel: 101, color: COLORS.rankS },
  { rank: 'National Level', minLevel: 131, color: COLORS.rankNational }
];

function getRank(level) {
  let r = RANK_DEFS[0];
  for (const rd of RANK_DEFS) {
    if (level >= rd.minLevel) r = rd;
  }
  return r;
}

function xpForLevel(lv) {
  return Math.floor(CONFIG.XP_BASE * Math.pow(CONFIG.XP_SCALE, lv - 1));
}

const DUNGEONS = [
  {
    id: 0, name: 'Cave of Goblins', rank: 'E', requiredLevel: 1,
    enemyTypes: ['goblin', 'goblin_archer'],
    bossType: 'goblin_king', enemyCount: 10,
    bgTheme: 'cave',
    xpReward: 500, shadowsReward: 1, statPointsReward: 2,
    worldWidth: 4000
  },
  {
    id: 1, name: 'Frozen Palace', rank: 'D', requiredLevel: 10,
    enemyTypes: ['ice_wolf', 'frost_skeleton'],
    bossType: 'kasaka', enemyCount: 14,
    bgTheme: 'ice',
    xpReward: 1500, shadowsReward: 2, statPointsReward: 3,
    worldWidth: 4500
  },
  {
    id: 2, name: 'Demon Tower', rank: 'C', requiredLevel: 25,
    enemyTypes: ['demon', 'hellhound'],
    bossType: 'cerberus', enemyCount: 16,
    bgTheme: 'demon',
    xpReward: 4000, shadowsReward: 3, statPointsReward: 4,
    worldWidth: 5000
  },
  {
    id: 3, name: 'Double Dungeon', rank: 'B', requiredLevel: 45,
    enemyTypes: ['shadow_knight', 'phantom'],
    bossType: 'igris', enemyCount: 18,
    bgTheme: 'void',
    xpReward: 10000, shadowsReward: 5, statPointsReward: 5,
    worldWidth: 5500
  },
  {
    id: 4, name: 'Ant Kingdom', rank: 'A', requiredLevel: 70,
    enemyTypes: ['ant_soldier', 'ant_worker'],
    bossType: 'ant_queen', enemyCount: 22,
    bgTheme: 'ant',
    xpReward: 25000, shadowsReward: 10, statPointsReward: 6,
    worldWidth: 6000
  }
];

const ENEMY_DEFS = {
  goblin:          { w: 22, h: 36, hp: 30,  dmg: 5,   speed: 1.2, xp: 15,  color: '#3a7d44', eyeColor: '#ff0', aggroRange: 180, attackRange: 30, attackCD: 1.4 },
  goblin_archer:   { w: 20, h: 38, hp: 22,  dmg: 7,   speed: 0.8, xp: 20,  color: '#2d6b35', eyeColor: '#ff0', aggroRange: 250, attackRange: 220, attackCD: 2.0, ranged: true, projSpeed: 4 },
  ice_wolf:        { w: 30, h: 28, hp: 55,  dmg: 15,  speed: 2.5, xp: 35,  color: '#8ecae6', eyeColor: '#00f5ff', aggroRange: 250, attackRange: 35, attackCD: 0.8 },
  frost_skeleton:  { w: 24, h: 44, hp: 45,  dmg: 18,  speed: 1.0, xp: 30,  color: '#b8d4e3', eyeColor: '#4fc3f7', aggroRange: 200, attackRange: 32, attackCD: 1.2 },
  demon:           { w: 30, h: 48, hp: 100, dmg: 25,  speed: 1.0, xp: 60,  color: '#8b0000', eyeColor: '#ff4444', aggroRange: 220, attackRange: 35, attackCD: 1.0 },
  hellhound:       { w: 32, h: 26, hp: 70,  dmg: 22,  speed: 3.0, xp: 50,  color: '#cc3300', eyeColor: '#ff8800', aggroRange: 280, attackRange: 30, attackCD: 0.7 },
  shadow_knight:   { w: 28, h: 50, hp: 150, dmg: 30,  speed: 1.5, xp: 90,  color: '#1a1a2e', eyeColor: '#9400D3', aggroRange: 240, attackRange: 38, attackCD: 0.9 },
  phantom:         { w: 26, h: 42, hp: 80,  dmg: 35,  speed: 2.2, xp: 80,  color: '#2a1545', eyeColor: '#b44fff', aggroRange: 260, attackRange: 30, attackCD: 1.0 },
  ant_soldier:     { w: 28, h: 34, hp: 120, dmg: 28,  speed: 2.8, xp: 100, color: '#1a3a1a', eyeColor: '#00ff88', aggroRange: 250, attackRange: 32, attackCD: 0.6 },
  ant_worker:      { w: 22, h: 28, hp: 60,  dmg: 15,  speed: 3.2, xp: 55,  color: '#2d4a2d', eyeColor: '#66ff99', aggroRange: 200, attackRange: 26, attackCD: 0.8 }
};

const BOSS_DEFS = {
  goblin_king: { w: 48, h: 64, hp: 300,  dmg: 20, speed: 1.5, xp: 200, color: '#2d8b3a', eyeColor: '#ffdd00', name: 'GOBLIN KING', attackRange: 50, attackCD: 1.2, phase2Color: '#ff6600' },
  kasaka:      { w: 56, h: 70, hp: 600,  dmg: 35, speed: 1.2, xp: 500, color: '#4a90d9', eyeColor: '#00e5ff', name: 'KASAKA THE LIZARD KING', attackRange: 55, attackCD: 1.0, phase2Color: '#00bcd4' },
  cerberus:    { w: 64, h: 60, hp: 1000, dmg: 45, speed: 1.8, xp: 1000, color: '#b71c1c', eyeColor: '#ff1744', name: 'CERBERUS', attackRange: 60, attackCD: 0.8, phase2Color: '#ff5722' },
  igris:       { w: 44, h: 72, hp: 1800, dmg: 55, speed: 2.0, xp: 2500, color: '#4a0e4e', eyeColor: '#e040fb', name: 'IGRIS THE BLOODRED', attackRange: 55, attackCD: 0.7, phase2Color: '#ff0000' },
  ant_queen:   { w: 72, h: 80, hp: 3000, dmg: 65, speed: 1.0, xp: 5000, color: '#1b5e20', eyeColor: '#76ff03', name: 'ANT QUEEN', attackRange: 65, attackCD: 0.6, phase2Color: '#ff6d00' }
};
