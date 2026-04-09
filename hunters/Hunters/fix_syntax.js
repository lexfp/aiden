const fs = require('fs');
const filePath = './hunters-game.js';

try {
    // Read file
    let code = fs.readFileSync(filePath, 'utf8');
    
    // FIX 1: Fix broken GAME_MODES (remove the malformed culling entry and rebuild)
    code = code.replace(
        /const GAME_MODES = \[([\s\S]*?)\];/,
        function(match) {
            // Check if already has culling properly
            if (!match.includes("'culling'")) {
                return `const GAME_MODES = [
            { id: 'elimination', name: 'Extermination', icon: '☠️', desc: 'Eliminate all cursed spirits' },
            { id: 'survival', name: 'Domain Siege', icon: '🌊', desc: 'Survive 5 waves of curses' },
            { id: 'timed', name: 'Cursed Hunt', icon: '⏱️', desc: 'Most exorcisms in 2 min' },
            { id: 'culling', name: 'Culling Game', icon: '⚔️', desc: 'Merge with Tengen and dominate' },
        ];`;
            }
            return match;
        }
    );
    
    // FIX 2: Fix broken POWERUP_TYPES (remove the malformed tengen entry and rebuild)
    code = code.replace(
        /const POWERUP_TYPES = \[([\s\S]*?)\];([\s\S]*?const JJK_CHARACTER_TYPES)/,
        function(match) {
            if (!match.includes("'tengen_merge'")) {
                return `const POWERUP_TYPES = [
            { id: 'health', icon: '❤️', color: 0xff4444, label: 'HEALTH PACK', apply(G) { G.playerHp = Math.min(G.playerMaxHp, G.playerHp + 40); G.updateHUD(); } },
            { id: 'ammo', icon: '📦', color: 0xffcc44, label: 'AMMO CRATE', apply(G) { G.weapons.forEach(w => { if (w.cat !== 'melee') { w.curMag = w.mag; w.totalAmmo = w.mag * 3; } }); G.updateHUD(); } },
            { id: 'speed', icon: '⚡', color: 0x44ffff, label: 'SPEED BOOST', apply(G) { G._speedBoost = 8; } },
            { id: 'damage', icon: '🔥', color: 0xff8800, label: 'DAMAGE BOOST', apply(G) { G._dmgBoost = 8; } },
            { id: 'shield', icon: '🛡️', color: 0x4488ff, label: 'SHIELD', apply(G) { G.playerHp = Math.min(G.playerMaxHp + 50, G.playerHp + 50); G.playerMaxHp = Math.max(G.playerMaxHp, G.playerHp); G.updateHUD(); } },
            { id: 'tengen_merge', icon: '⚛️', color: 0xaa00ff, label: 'TENGEN FUSION', apply(G) { G._tengenMerged = true; G._tengenMergeDur = 45; G.playerHp = G.playerMaxHp; G._charDmgMult = (G._charDmgMult || 1) * 1.5; G._charSpeedMult = (G._charSpeedMult || 1) * 1.3; G.updateHUD(); } },
        ];

        // ============================================================
        // JJK CHARACTER TYPES`;
            }
            return match;
        }
    );
    
    // Write back
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('✓ Fixed broken syntax in hunters-game.js');
    
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
