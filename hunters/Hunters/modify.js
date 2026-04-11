const fs = require('fs');

const filePath = 'hunters-game.js';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add culling mode to GAME_MODES
if (!code.includes("id: 'culling'")) {
    const gamemodesMatch = code.match(/(const GAME_MODES = \[[\s\S]*?\{ id: 'timed'[\s\S]*?\},\s*\];)/);
    if (gamemodesMatch) {
        const replacement = gamemodesMatch[0].replace(
            /(\},\s*\];)$/,
            ", { id: 'culling', name: 'Culling Game', icon: '⚔️', desc: 'Merge with Tengen and dominate' }];"
        );
        code = code.replace(gamemodesMatch[0], replacement);
        console.log("[+] Added culling mode");
    }
} else {
    console.log("[*] Culling mode already exists");
}

// 2. Add tengen_merge powerup to POWERUP_TYPES
if (!code.includes("id: 'tengen_merge'")) {
    const powerupsMatch = code.match(/(const POWERUP_TYPES = \[[\s\S]*?\{ id: 'shield'[\s\S]*?\} \},\s*\];)/);
    if (powerupsMatch) {
        const replacement = powerupsMatch[0].replace(
            /(\} \},\s*\];)$/,
            ", { id: 'tengen_merge', icon: '⚛️', color: 0xaa00ff, label: 'TENGEN FUSION', apply(G) { G._tengenMerged = true; G._tengenMergeDur = 45; G.playerHp = G.playerMaxHp; G._charDmgMult = (G._charDmgMult || 1) * 1.5; G._charSpeedMult = (G._charSpeedMult || 1) * 1.3; G.updateHUD(); } }];"
        );
        code = code.replace(powerupsMatch[0], replacement);
        console.log("[+] Added tengen_merge powerup");
    }
} else {
    console.log("[*] Tengen merge already exists");
}

// 3. Replace bunker map with culling_arena
if (!code.includes("id: 'culling_arena'")) {
    // Match the bunker map definition
    const bunkerPattern = /\{\s*id: 'bunker',\s*name: 'Culling Game'[\s\S]*?\},\s*\{/;
    if (bunkerPattern.test(code)) {
        const cullingArena = `{
                id: 'culling_arena', name: 'Culling Arena', icon: '⚔️', size: 'GIANT',
                floor: 0x151505, wall: 0x1a1a12, accent: 0xff8800,
                ambient: 0x0a0a08, fog: [0x151505, .015],
                botCount: 15,
                generator: 'culling',
                bounds: 200,
                spawnPts: [
                    { x: -140, z: -140 }, { x: 140, z: -140 }, { x: -140, z: 140 }, { x: 140, z: 140 },
                    { x: -180, z: 0 }, { x: 180, z: 0 }, { x: 0, z: -180 }, { x: 0, z: 180 }
                ],
                playerSpawn: { x: 0, z: 0 },
            }, {`;
        code = code.replace(bunkerPattern, cullingArena);
        console.log("[+] Replaced bunker map with culling_arena");
    }
} else {
    console.log("[*] Culling arena already exists");
}

// Write file
fs.writeFileSync(filePath, code, 'utf8');
console.log("[✓] File updated successfully!");
