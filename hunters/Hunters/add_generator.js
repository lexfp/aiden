const fs = require('fs');

const content = fs.readFileSync('./hunters-game.js', 'utf8');

const generateCullingCode = `
        function generateCulling() {
            const obs = [];
            // Giant tournament arena with tiered terrain
            
            // Central combat area - open floor
            obs.push({ x: 0, z: 0, w: 100, d: 100, h: 0.3, c: 0x2a2a1a });
            
            // Observation platforms around perimeter - elevated
            const platformRadius = 130;
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const px = Math.cos(angle) * platformRadius;
                const pz = Math.sin(angle) * platformRadius;
                obs.push({ x: px, z: pz, w: 20, d: 20, h: 2, c: 0x3a3a2a });
            }
            
            // Rock formations for tactical cover - arranged in octagon
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + Math.PI / 16;
                const rx = Math.cos(angle) * 90;
                const rz = Math.sin(angle) * 90;
                for (let j = 0; j < 3; j++) {
                    const offset = (j - 1) * 15;
                    obs.push({
                        x: rx + Math.cos(angle + Math.PI / 2) * offset,
                        z: rz + Math.sin(angle + Math.PI / 2) * offset,
                        w: 8 + Math.random() * 4,
                        d: 8 + Math.random() * 4,
                        h: 5 + Math.random() * 8,
                        c: 0x4a4a3a
                    });
                }
            }
            
            // Center arena elevated pillars (tetsukkei-style)
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const pillarRad = 35;
                obs.push({
                    x: Math.cos(angle) * pillarRad,
                    z: Math.sin(angle) * pillarRad,
                    w: 6,
                    d: 6,
                    h: 12,
                    c: 0x5a5a4a
                });
            }
            
            // Scattered debris and obstacles
            for (let i = 0; i < 25; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 30 + Math.random() * 140;
                obs.push({
                    x: Math.cos(angle) * radius,
                    z: Math.sin(angle) * radius,
                    w: 4 + Math.random() * 6,
                    d: 4 + Math.random() * 6,
                    h: 2 + Math.random() * 5,
                    c: 0x3a3a2a + Math.floor(Math.random() * 0x1a1a1a)
                });
            }
            
            return obs;
        }
`;

// Find the point to insert - right before "function buildMap"
const insertPoint = content.indexOf('        function buildMap(mdef)');

if (insertPoint > -1) {
    const newContent = content.slice(0, insertPoint) + generateCullingCode + '\n' + content.slice(insertPoint);
    fs.writeFileSync('./hunters-game.js', newContent, 'utf8');
    console.log('✓ Added generateCulling() function');
} else {
    console.error('Could not find insertion point');
    process.exit(1);
}
