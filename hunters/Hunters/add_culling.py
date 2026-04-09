#!/usr/bin/env python3
import re
import sys

try:
    # Read the file with UTF-8 encoding
    with open('hunters-game.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add culling mode to GAME_MODES if not present
    if "'culling'" not in content:
        # Find GAME_MODES array and add culling mode
        game_modes_pattern = r"(const GAME_MODES = \[[\s\S]*?)\];"
        game_modes_sub = r"\1, { id: 'culling', name: 'Culling Game', icon: '⚔️', desc: 'Merge with Tengen and dominate' }];"
        content = re.sub(game_modes_pattern, game_modes_sub, content, count=1)
        print("[+] Added culling mode to GAME_MODES")
    else:
        print("[*] Culling mode already exists")

    # 2. Add tengen_merge powerup if not present
    if "'tengen_merge'" not in content:
        # Find POWERUP_TYPES array and add tengen_merge
        powerups_pattern = r"(const POWERUP_TYPES = \[[\s\S]*?)\];"
        powerups_sub = r"\1, { id: 'tengen_merge', icon: '⚛️', color: 0xaa00ff, label: 'TENGEN FUSION', apply(G) { G._tengenMerged = true; G._tengenMergeDur = 45; G.playerHp = G.playerMaxHp; G._charDmgMult = (G._charDmgMult || 1) * 1.5; G._charSpeedMult = (G._charSpeedMult || 1) * 1.3; G.updateHUD(); } }];"
        content = re.sub(powerups_pattern, powerups_sub, content, count=1)
        print("[+] Added tengen_merge powerup to POWERUP_TYPES")
    else:
        print("[*] Tengen merge already exists")

    # 3. Replace bunker map with culling_arena
    if "id: 'culling_arena'" not in content:
        # Find bunker map and replace it
        bunker_pattern = r"\{\s*id: 'bunker',\s*name: 'Culling Game'[\s\S]*?\},\s*\{"
        culling_arena = """{
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
            }, {"""
        content = re.sub(bunker_pattern, culling_arena, content, count=1)
        print("[+] Replaced bunker map with culling_arena")
    else:
        print("[*] Culling arena already exists")

    # Write back with UTF-8 encoding
    with open('hunters-game.js', 'w', encoding='utf-8') as f:
        f.write(content)

    print("[✓] File updated successfully!")
    sys.exit(0)

except Exception as e:
    print(f"[ERROR] {type(e).__name__}: {e}")
    sys.exit(1)
