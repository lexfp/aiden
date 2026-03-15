// ═══════════════════ TECHNIQUES ═══════════════════
const TECHNIQUES = [
  {
    id: 'limitless', name: 'Limitless', user: 'Gojo Satoru', icon: '∞', color: '#00ccff', hex: 0x00ccff, rarity: 'legendary',
    desc: 'Manipulate space with the Six Eyes.', domainName: 'Infinite Void', domainBg: 0x000d18, domainFog: 0x000816, domainPrt: 0x88eeff,
    moves: [{ name: 'Infinity', key: 'E', cost: 20, cd: 6, dmg: 50, range: 6, req: 0, desc: 'Infinite barrier — stun enemies.' }, { name: 'Blue', key: 'R', cost: 35, cd: 12, dmg: 80, range: 9, req: 15, desc: 'Attraction — pull all enemies.' }, { name: 'Red', key: 'T', cost: 55, cd: 18, dmg: 120, range: 11, req: 40, desc: 'Repulsion — massive blast.' }, { name: 'Infinite Void', key: 'F', cost: 100, cd: 60, dmg: 300, range: 999, req: 80, desc: 'DOMAIN — Information overload.' }]
  },
  {
    id: 'tenShadows', name: 'Ten Shadows', user: 'Fushiguro Megumi', icon: '影', color: '#4466cc', hex: 0x4466cc, rarity: 'epic',
    desc: 'Summon shikigami from shadows.', domainName: 'Chimera Shadow Garden', domainBg: 0x000510, domainFog: 0x010218, domainPrt: 0x2244aa,
    moves: [{ name: 'Divine Dog', key: 'E', cost: 20, cd: 8, dmg: 55, range: 6, req: 0, desc: 'Summon Dogs to shred.' }, { name: 'Nue Strike', key: 'R', cost: 35, cd: 14, dmg: 75, range: 10, req: 15, desc: 'Lightning strike from above.' }, { name: 'Great Serpent', key: 'T', cost: 55, cd: 20, dmg: 110, range: 8, req: 40, desc: 'Serpent binds all nearby.' }, { name: 'Chimera Garden', key: 'F', cost: 100, cd: 60, dmg: 270, range: 999, req: 80, desc: 'DOMAIN — All shikigami unleashed.' }]
  },
  {
    id: 'strawDoll', name: 'Straw Doll', user: 'Kugisaki Nobara', icon: '🪆', color: '#ff6622', hex: 0xff6622, rarity: 'rare',
    desc: 'Drive nails into straw dolls.', domainName: 'Hollow Wicker Basket', domainBg: 0x1a0800, domainFog: 0x0d0400, domainPrt: 0xff6622,
    moves: [{ name: 'Nail Barrage', key: 'E', cost: 15, cd: 5, dmg: 40, range: 7, req: 0, desc: 'Volley of cursed nails.' }, { name: 'Hairpin', key: 'R', cost: 30, cd: 10, dmg: 65, range: 8, req: 15, desc: 'Explosive cursed hairpin.' }, { name: 'Resonance', key: 'T', cost: 50, cd: 20, dmg: 100, range: 10, req: 40, desc: 'Damage resonates through all.' }, { name: 'Wicker Basket', key: 'F', cost: 90, cd: 55, dmg: 250, range: 999, req: 80, desc: 'DOMAIN — 1,000 nails rain.' }]
  },
  {
    id: 'bloodManip', name: 'Blood Manipulation', user: 'Choso', icon: '血', color: '#cc1133', hex: 0xcc1133, rarity: 'epic',
    desc: 'Wield blood as weapons.', domainName: 'Womb Profusion', domainBg: 0x1a0005, domainFog: 0x0d0003, domainPrt: 0xff0033,
    moves: [{ name: 'Flowing Scale', key: 'E', cost: 15, cd: 5, dmg: 45, range: 6, req: 0, desc: 'Blood-hardened strike.' }, { name: 'Piercing Blood', key: 'R', cost: 35, cd: 12, dmg: 85, range: 18, req: 15, desc: 'Blood lance pierces line.' }, { name: 'Supernova', key: 'T', cost: 55, cd: 22, dmg: 120, range: 10, req: 40, desc: 'Blood spheres everywhere.' }, { name: 'Womb Profusion', key: 'F', cost: 95, cd: 55, dmg: 260, range: 999, req: 80, desc: 'DOMAIN — Blood blade air.' }]
  },
  {
    id: 'disasterFlames', name: 'Disaster Flames', user: 'Jogo', icon: '🌋', color: '#ff4400', hex: 0xff4400, rarity: 'legendary',
    desc: 'Volcanic cursed fire technique.', domainName: 'Coffin of Iron Mountain', domainBg: 0x1a0500, domainFog: 0x0d0300, domainPrt: 0xff6600,
    moves: [{ name: 'Ember Insects', key: 'E', cost: 20, cd: 7, dmg: 50, range: 7, req: 0, desc: 'Burning insects swarm.' }, { name: 'Flame Arrow', key: 'R', cost: 35, cd: 12, dmg: 76, range: 12, req: 15, desc: 'Superheated flame projectile.' }, { name: 'Maximum: Meteor', key: 'T', cost: 65, cd: 25, dmg: 135, range: 12, req: 40, desc: 'Volcanic meteor strike.' }, { name: 'Coffin of Iron', key: 'F', cost: 100, cd: 60, dmg: 280, range: 999, req: 80, desc: 'DOMAIN — Volcanic incinerator.' }]
  },
  {
    id: 'boogieWoogie', name: 'Boogie Woogie', user: 'Aoi Todo', icon: '👏', color: '#22ff66', hex: 0x22ff66, rarity: 'rare',
    desc: 'Swap positions with a clap.', domainName: 'Body Swap Chaos', domainBg: 0x001a08, domainFog: 0x000d04, domainPrt: 0x22ff66,
    moves: [{ name: 'Simple Swap', key: 'E', cost: 20, cd: 8, dmg: 38, range: 15, req: 0, desc: 'Teleport behind nearest enemy.' }, { name: 'Boogie Woogie', key: 'R', cost: 35, cd: 14, dmg: 58, range: 20, req: 15, desc: 'Swap all nearby enemies.' }, { name: 'Phantom Clap', key: 'T', cost: 50, cd: 20, dmg: 88, range: 12, req: 40, desc: 'Clone swaps & strikes.' }, { name: 'Swap Storm', key: 'F', cost: 95, cd: 55, dmg: 215, range: 999, req: 80, desc: 'DOMAIN — Chaotic swap dance.' }]
  },
  {
    id: 'ratioTech', name: 'Ratio Technique', user: 'Higuruma', icon: '⚖️', color: '#ffcc00', hex: 0xffcc00, rarity: 'epic',
    desc: 'Judgment — all are guilty.', domainName: 'Deadly Sentencing', domainBg: 0x1a1400, domainFog: 0x0d0a00, domainPrt: 0xffcc00,
    moves: [{ name: 'Evidence', key: 'E', cost: 20, cd: 8, dmg: 55, range: 6, req: 0, desc: 'Judgment-charged strike.' }, { name: 'Judgeman', key: 'R', cost: 35, cd: 14, dmg: 75, range: 10, req: 15, desc: 'Judgeman slows all.' }, { name: 'Confiscation', key: 'T', cost: 55, cd: 22, dmg: 112, range: 8, req: 40, desc: 'Confiscate technique — stun.' }, { name: 'Deadly Sentence', key: 'F', cost: 100, cd: 60, dmg: 255, range: 999, req: 80, desc: 'DOMAIN — Death sentence all.' }]
  },
  {
    id: 'idleTransfig', name: 'Idle Transfiguration', user: 'Mahito', icon: '💀', color: '#aa44ff', hex: 0xaa44ff, rarity: 'legendary',
    desc: 'Reshape souls into weapons.', domainName: 'Self-Embodiment of Perfection', domainBg: 0x0a0015, domainFog: 0x060010, domainPrt: 0xaa44ff,
    moves: [{ name: 'Body Repel', key: 'E', cost: 15, cd: 5, dmg: 42, range: 5, req: 0, desc: 'Soul-punch devastates.' }, { name: 'Soul Multiplicity', key: 'R', cost: 35, cd: 14, dmg: 72, range: 9, req: 15, desc: 'Merged souls as blast.' }, { name: 'Tombstone', key: 'T', cost: 55, cd: 22, dmg: 106, range: 8, req: 40, desc: 'Transfigure nearby foes.' }, { name: 'Perfection', key: 'F', cost: 100, cd: 60, dmg: 250, range: 999, req: 80, desc: 'DOMAIN — All souls transfigured.' }]
  },
  {
    id: 'divFist', name: 'Divergent Fist', user: 'Yuji Itadori', icon: '👊', color: '#ff6600', hex: 0xff6600, rarity: 'epic',
    desc: 'Cursed energy amplifies fists.', domainName: 'Malevolent Shrine', domainBg: 0x1a0800, domainFog: 0x0d0400, domainPrt: 0xff6600,
    moves: [{ name: 'Divergent Fist', key: 'E', cost: 15, cd: 4, dmg: 45, range: 4, req: 0, desc: 'Delayed energy erupts.' }, { name: 'Black Flash', key: 'R', cost: 40, cd: 15, dmg: 110, range: 5, req: 15, desc: 'Spatial distortion punch.' }, { name: 'Sukunas Cut', key: 'T', cost: 60, cd: 22, dmg: 130, range: 8, req: 40, desc: 'Sukuna slashing technique.' }, { name: 'Malevolent Shrine', key: 'F', cost: 100, cd: 60, dmg: 285, range: 999, req: 80, desc: 'DOMAIN — Dismantle / Cleave all.' }]
  },
  {
    id: 'cursedSpeech', name: 'Cursed Speech', user: 'Inumaki', icon: '📢', color: '#22aaff', hex: 0x22aaff, rarity: 'epic',
    desc: 'Compel reality with cursed words.', domainName: 'Word Binding', domainBg: 0x001a22, domainFog: 0x000d11, domainPrt: 0x22aaff,
    moves: [{ name: 'Blast Away', key: 'E', cost: 15, cd: 5, dmg: 40, range: 8, req: 0, desc: 'Knockback all enemies.' }, { name: "Don't Move", key: 'R', cost: 35, cd: 14, dmg: 0, range: 12, req: 15, desc: 'Stun all enemies 3s.' }, { name: 'Explode', key: 'T', cost: 60, cd: 22, dmg: 125, range: 10, req: 40, desc: 'Enemies detonate.' }, { name: 'Die', key: 'F', cost: 100, cd: 60, dmg: 300, range: 999, req: 80, desc: "DOMAIN — 'Die' resonates." }]
  },
  {
    id: 'thunderclap', name: 'Thunderclap', user: 'Ryu Ishigori', icon: '⚡', color: '#88ddff', hex: 0x88ddff, rarity: 'legendary',
    desc: 'Discharge cursed lightning.', domainName: 'Shrine of Grace', domainBg: 0x000d1a, domainFog: 0x00060d, domainPrt: 0x88ddff,
    moves: [{ name: 'Discharge', key: 'E', cost: 20, cd: 6, dmg: 52, range: 8, req: 0, desc: 'Lightning burst forward.' }, { name: 'Thunder Punch', key: 'R', cost: 35, cd: 12, dmg: 80, range: 6, req: 15, desc: 'Electrified devastating punch.' }, { name: 'Rock Solid', key: 'T', cost: 55, cd: 20, dmg: 120, range: 10, req: 40, desc: 'Stone + lightning wall.' }, { name: 'Shrine of Grace', key: 'F', cost: 100, cd: 60, dmg: 290, range: 999, req: 80, desc: 'DOMAIN — Lightning grid.' }]
  },
  {
    id: 'iceFormation', name: 'Ice Formation', user: 'Uraume', icon: '❄️', color: '#aaddff', hex: 0xaaddff, rarity: 'rare',
    desc: 'Shape and hurl cursed ice.', domainName: 'Absolute Zero', domainBg: 0x001122, domainFog: 0x000811, domainPrt: 0xaaddff,
    moves: [{ name: 'Ice Stake', key: 'E', cost: 15, cd: 5, dmg: 40, range: 9, req: 0, desc: 'Sharp ice stake fires.' }, { name: 'Frost Shards', key: 'R', cost: 30, cd: 12, dmg: 65, range: 8, req: 15, desc: 'Ice shards all directions.' }, { name: 'Ice Prison', key: 'T', cost: 55, cd: 22, dmg: 100, range: 10, req: 40, desc: 'Encase enemies in ice.' }, { name: 'Absolute Zero', key: 'F', cost: 95, cd: 55, dmg: 250, range: 999, req: 80, desc: 'DOMAIN — All frozen instantly.' }]
  },
  {
    id: 'projSorcery', name: 'Projection Sorcery', user: 'Naoya Zenin', icon: '🎯', color: '#dddddd', hex: 0xdddddd, rarity: 'epic',
    desc: 'Fix movement in 1/24s frames.', domainName: 'Moon Dregs', domainBg: 0x111111, domainFog: 0x0a0a0a, domainPrt: 0xffffff,
    moves: [{ name: 'Flash Strike', key: 'E', cost: 15, cd: 4, dmg: 44, range: 5, req: 0, desc: 'Instant 1-frame strike.' }, { name: 'Frame Loop', key: 'R', cost: 35, cd: 14, dmg: 70, range: 8, req: 15, desc: 'Loop strike 3 times fast.' }, { name: 'Stillness Bind', key: 'T', cost: 55, cd: 22, dmg: 95, range: 10, req: 40, desc: 'Trap enemies in frames.' }, { name: 'Moon Dregs', key: 'F', cost: 100, cd: 60, dmg: 260, range: 999, req: 80, desc: 'DOMAIN — All frozen in frame.' }]
  },
  {
    id: 'graniteBlast', name: 'Granite Blast', user: 'Hanami', icon: '🌿', color: '#336633', hex: 0x336633, rarity: 'rare',
    desc: 'Disaster plants technique.', domainName: 'Forest of Carnage', domainBg: 0x020d02, domainFog: 0x010601, domainPrt: 0x336633,
    moves: [{ name: 'Flower Field', key: 'E', cost: 20, cd: 7, dmg: 45, range: 7, req: 0, desc: 'Explosive petal burst.' }, { name: 'Cursed Bud', key: 'R', cost: 35, cd: 14, dmg: 72, range: 12, req: 15, desc: 'Exploding plant bud.' }, { name: 'Wooden Ball', key: 'T', cost: 55, cd: 22, dmg: 108, range: 10, req: 40, desc: 'Massive wooden crusher.' }, { name: 'Forest of Carnage', key: 'F', cost: 95, cd: 55, dmg: 245, range: 999, req: 80, desc: 'DOMAIN — Forest of death.' }]
  },
  {
    id: 'rotTech', name: 'Rot Technique', user: 'Hazenoki', icon: '☣️', color: '#88cc22', hex: 0x88cc22, rarity: 'rare',
    desc: 'Detonate body parts as grenades.', domainName: 'Chain Reaction', domainBg: 0x0d1100, domainFog: 0x060800, domainPrt: 0x88cc22,
    moves: [{ name: 'Teeth Bomb', key: 'E', cost: 15, cd: 5, dmg: 42, range: 7, req: 0, desc: 'Explosive teeth projectiles.' }, { name: 'Ear Grenade', key: 'R', cost: 30, cd: 12, dmg: 68, range: 10, req: 15, desc: 'Explosive ears lobbed.' }, { name: 'Body Burst', key: 'T', cost: 50, cd: 20, dmg: 105, range: 8, req: 40, desc: 'Detonate torso — massive AoE.' }, { name: 'Chain Reaction', key: 'F', cost: 90, cd: 55, dmg: 240, range: 999, req: 80, desc: 'DOMAIN — Cascading explosions.' }]
  },
  {
    id: 'puppet', name: 'Puppet Manipulation', user: 'Mechamaru', icon: '🤖', color: '#448899', hex: 0x448899, rarity: 'rare',
    desc: 'Control puppet as ultimate weapon.', domainName: 'Ultramechamaru World', domainBg: 0x000d11, domainFog: 0x000608, domainPrt: 0x448899,
    moves: [{ name: 'Cannon Mode', key: 'E', cost: 20, cd: 6, dmg: 48, range: 10, req: 0, desc: 'Ultra Cannon energy blast.' }, { name: 'Boost On', key: 'R', cost: 30, cd: 12, dmg: 65, range: 6, req: 15, desc: 'Rocket-propelled slam.' }, { name: 'Sword Option', key: 'T', cost: 50, cd: 20, dmg: 100, range: 7, req: 40, desc: 'Energy sword cleaves all.' }, { name: 'Ultramechamaru', key: 'F', cost: 95, cd: 55, dmg: 240, range: 999, req: 80, desc: 'DOMAIN — Ultimate weapon fires.' }]
  },
];
const RARITY_C = { legendary: '#ffaa00', epic: '#cc44ff', rare: '#4488ff' };
