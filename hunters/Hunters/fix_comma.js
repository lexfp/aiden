const fs = require('fs');

const content = fs.readFileSync('./hunters-game.js', 'utf8');

// Fix the missing comma between culling_arena and ice
const fixed = content.replace(
    /playerSpawn: \{ x: 0, z: 0 \},\s+\{[\s\S]*?id: 'ice'/,
    "playerSpawn: { x: 0, z: 0 },\n            },\n            {\n                id: 'ice'"
);

fs.writeFileSync('./hunters-game.js', fixed, 'utf8');
console.log('✓ Added missing comma between maps');
