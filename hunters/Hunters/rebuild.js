const fs = require('fs');
const path = './hunters-game.js';

// Read full file
const content = fs.readFileSync(path, 'utf8');

// Split into before, broken section, and after
const lines = content.split('\n');

// Find GAME_MODES start and end
let gamemodesStart = -1, gamemodesEnd = -1;
let powerupStart = -1, powerupEnd = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const GAME_MODES')) gamemodesStart = i;
    if (gamemodesStart > -1 && gamemodesEnd === -1 && lines[i].includes('];')) gamemodesEnd = i;
    if (lines[i].includes('const POWERUP_TYPES')) powerupStart = i;
    if (powerupStart > -1 && powerupEnd === -1 && lines[i].includes('];')) powerupEnd = i;
}

console.log(`GAME_MODES: ${gamemodesStart}-${gamemodesEnd}`);
console.log(`POWERUP_TYPES: ${powerupStart}-${powerupEnd}`);

// Rebuild arrays
const newGameModes = [
    "        // GAME MODE DEFINITIONS",
    "        // ============================================================",
    "        const GAME_MODES = [",
    "            { id: 'elimination', name: 'Extermination', icon: '☠️', desc: 'Eliminate all cursed spirits' },",
    "            { id: 'survival', name: 'Domain Siege', icon: '🌊', desc: 'Survive 5 waves of curses' },",
    "            { id: 'timed', name: 'Cursed Hunt', icon: '⏱️', desc: 'Most exorcisms in 2 min' },",
    // Note: culling mode is homescreen-only and should not be inserted into GAME_MODES by rebuild
    "        ];"
];

const newPowerups = [
    "        // ============================================================",
    "        // POWERUP DEFINITIONS",
    "        // ============================================================",
    "        const POWERUP_TYPES = [",
    "            { id: 'health', icon: '❤️', color: 0xff4444, label: 'HEALTH PACK', apply(G) { G.playerHp = Math.min(G.playerMaxHp, G.playerHp + 40); G.updateHUD(); } },",
    "            { id: 'ammo', icon: '📦', color: 0xffcc44, label: 'AMMO CRATE', apply(G) { G.weapons.forEach(w => { if (w.cat !== 'melee') { w.curMag = w.mag; w.totalAmmo = w.mag * 3; } }); G.updateHUD(); } },",
    "            { id: 'speed', icon: '⚡', color: 0x44ffff, label: 'SPEED BOOST', apply(G) { G._speedBoost = 8; } },",
    "            { id: 'damage', icon: '🔥', color: 0xff8800, label: 'DAMAGE BOOST', apply(G) { G._dmgBoost = 8; } },",
    "            { id: 'shield', icon: '🛡️', color: 0x4488ff, label: 'SHIELD', apply(G) { G.playerHp = Math.min(G.playerMaxHp + 50, G.playerHp + 50); G.playerMaxHp = Math.max(G.playerMaxHp, G.playerHp); G.updateHUD(); } },",
    "            { id: 'tengen_merge', icon: '⚛️', color: 0xaa00ff, label: 'TENGEN FUSION', apply(G) { G._tengenMerged = true; G._tengenMergeDur = 45; G.playerHp = G.playerMaxHp; G._charDmgMult = (G._charDmgMult || 1) * 1.5; G._charSpeedMult = (G._charSpeedMult || 1) * 1.3; G.updateHUD(); } },",
    "        ];"
];

// Reconstruct file
let newLines = [
    ...lines.slice(0, gamemodesStart),
    ...newGameModes,
    ...newPowerups,
    ...lines.slice(powerupEnd + 1)
];

// Write back
fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log('✓ Fixed syntax and updated GAME_MODES (left out homescreen-only modes) + tengen powerup');
