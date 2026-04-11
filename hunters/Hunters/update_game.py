#!/usr/bin/env python3
import re

with open('hunters-game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# NOTE: Culling is intentionally a homescreen-only special event.
# Do not inject a 'culling' entry into GAME_MODES here. The homescreen
# feature card remains and is handled by the UI (G.startCullingGame()).
# Previous behavior auto-inserted a culling entry; that is now disabled.

# Add Tengen merge power-up if not present
if "id: 'tengen_merge'" not in content:
    lines = content.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        new_lines.append(line)
        if "id: 'shield'" in line and 'SHIELD' in line and 'apply' in line:
            # Find end of this powerup and add Tengen after
            j = i + 1
            while j < len(lines) and '},' not in lines[j]:
                j += 1
            if j < len(lines):
                indent = '            '
                tengen_line = f"{indent}{{ id: 'tengen_merge', icon: '☯️', color: 0xaa00ff, label: 'TENGEN FUSION', apply(G) {{ G._tengenMerged = true; G._tengenMergeDur = 45; G.playerMaxHp = Math.floor(G.playerMaxHp * 1.8); G.playerHp = G.playerMaxHp; G._charDmgMult *= 1.5; G._charSpeedMult *= 1.3; G.showNotif('TENGEN MERGED - OVERWHELMING POWER!', 3000); G.updateHUD(); }} }},"
                new_lines.extend(lines[i+1:j+1])
                new_lines.append(tengen_line)
                for k in range(j+1, len(lines)):
                    new_lines.append(lines[k])
                break
    content = '\n'.join(new_lines)

# Replace bunker map with culling arena
if "id: 'bunker'" in content and "name: 'Culling Game'" in content:
    # Find and replace the small bunker map definition
    pattern = r"\{\s*id:\s*'bunker'[^}]*?playerSpawn:\s*\{[^}]*?\}\s*\},"
    replacement = """{\n                id: 'culling_arena', name: 'Culling Game: Tengen Battlefield', icon: '⚔️', size: 'GIANT',\n                floor: 0x1a1a2a, wall: 0x2a2a3a, accent: 0xff6600,\n                ambient: 0x1a1a2a, fog: [0x1a1a2a, .008],\n                botCount: 15,\n                generator: 'culling',\n                bounds: 200,\n                spawnPts: [{ x: -180, z: -180 }, { x: 180, z: -180 }, { x: -180, z: 180 }, { x: 180, z: 180 }, { x: 0, z: -180 }, { x: 0, z: 180 }, { x: -180, z: 0 }, { x: 180, z: 0 }],\n                playerSpawn: { x: 0, z: 0 },\n            },"""
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('hunters-game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Updated hunters-game.js")
