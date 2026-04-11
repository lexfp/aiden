const fs = require('fs');

const content = fs.readFileSync('./hunters-game.js', 'utf8');

// Find and remove garbage between culling_arena and ice maps
// The culling_arena ends with: playerSpawn: { x: 0, z: 0 },
// Then there's garbage from the old bunker
// Then the ice map starts with: id: 'ice'

const fixed = content.replace(
    /(\}, \{ x: 5, z: 0, w: \.5[\s\S]*?playerSpawn: \{ x: 0, z: 10 \},\s*\},)/,
    ''
);

fs.writeFileSync('./hunters-game.js', fixed, 'utf8');
console.log('✓ Cleaned up garbage between culling_arena and ice map');
