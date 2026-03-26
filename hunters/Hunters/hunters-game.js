'use strict';

        // ============================================================
        // WEAPON DEFINITIONS
        // ============================================================
        const WDEFS = [
            // === PISTOLS ===
            { id: 'glock', name: 'Glock 17', cat: 'pistol', tier: 'common', dmg: 24, rpm: 480, range: 55, acc: .85, mag: 17, price: 0, auto: false, color: 0x333344 },
            { id: 'deagle', name: 'Desert Eagle', cat: 'pistol', tier: 'rare', dmg: 62, rpm: 180, range: 62, acc: .82, mag: 7, price: 350, auto: false, color: 0x888866 },
            { id: 'revolver', name: 'Revolver .357', cat: 'pistol', tier: 'rare', dmg: 68, rpm: 120, range: 58, acc: .90, mag: 6, price: 450, auto: false, color: 0x556677 },
            { id: 'auto_pistol', name: 'Auto Pistol', cat: 'pistol', tier: 'common', dmg: 12, rpm: 1000, range: 40, acc: .78, mag: 20, price: 200, auto: true, color: 0x445566 },
            { id: 'ricochet', name: 'Ricochet Pistol', cat: 'pistol', tier: 'rare', dmg: 22, rpm: 240, range: 50, acc: .88, mag: 10, price: 900, auto: false, bounce: 2, color: 0x557799 },
            // === RIFLES ===
            { id: 'ar15', name: 'AR-15', cat: 'rifle', tier: 'common', dmg: 28, rpm: 720, range: 85, acc: .88, mag: 30, price: 800, auto: true, color: 0x223322 },
            { id: 'ak47', name: 'AK-47', cat: 'rifle', tier: 'common', dmg: 34, rpm: 600, range: 78, acc: .80, mag: 30, price: 900, auto: true, color: 0x443322 },
            { id: 'm4a1', name: 'M4A1', cat: 'rifle', tier: 'rare', dmg: 27, rpm: 800, range: 88, acc: .91, mag: 30, price: 1100, auto: true, color: 0x334433 },
            { id: 'famas', name: 'FAMAS', cat: 'rifle', tier: 'common', dmg: 23, rpm: 900, range: 72, acc: .84, mag: 25, price: 750, auto: true, color: 0x445544 },
            { id: 'smg', name: 'MP5', cat: 'rifle', tier: 'common', dmg: 19, rpm: 800, range: 44, acc: .78, mag: 35, price: 600, auto: true, color: 0x444444 },
            { id: 'burst_rifle', name: 'Burst Rifle', cat: 'rifle', tier: 'rare', dmg: 32, rpm: 450, range: 80, acc: .87, mag: 24, price: 1000, auto: false, burst: 3, color: 0x334444 },
            { id: 'hmg', name: 'HMG', cat: 'rifle', tier: 'epic', dmg: 22, rpm: 1100, range: 65, acc: .72, mag: 100, price: 2200, auto: true, heavy: true, color: 0x554433 },
            { id: 'lmg', name: 'LMG', cat: 'rifle', tier: 'common', dmg: 20, rpm: 700, range: 70, acc: .76, mag: 80, price: 1300, auto: true, color: 0x445533 },
            // === SNIPERS ===
            { id: 'awp', name: 'AWP', cat: 'sniper', tier: 'epic', dmg: 130, rpm: 45, range: 250, acc: .98, mag: 5, price: 2200, auto: false, scope: true, color: 0x224422 },
            { id: 'barrett', name: 'Barrett M82', cat: 'sniper', tier: 'epic', dmg: 160, rpm: 35, range: 300, acc: .97, mag: 10, price: 2800, auto: false, scope: true, color: 0x333333 },
            { id: 'dragunov', name: 'Dragunov', cat: 'sniper', tier: 'rare', dmg: 95, rpm: 120, range: 200, acc: .95, mag: 10, price: 1600, auto: false, scope: true, color: 0x443322 },
            { id: 'burst_sniper', name: 'DMR Rifle', cat: 'sniper', tier: 'rare', dmg: 65, rpm: 200, range: 180, acc: .94, mag: 15, price: 1800, auto: false, burst: 2, scope: true, color: 0x334422 },
            // === SHOTGUNS ===
            { id: 'pump', name: 'Pump Shotgun', cat: 'shotgun', tier: 'common', dmg: 88, rpm: 90, range: 20, acc: .70, mag: 8, price: 700, auto: false, pellets: 8, color: 0x665544 },
            { id: 'auto_sg', name: 'Auto Shotgun', cat: 'shotgun', tier: 'rare', dmg: 65, rpm: 240, range: 18, acc: .65, mag: 12, price: 1200, auto: true, pellets: 6, color: 0x554433 },
            { id: 'sawed', name: 'Sawed-Off', cat: 'shotgun', tier: 'common', dmg: 110, rpm: 60, range: 12, acc: .72, mag: 4, price: 500, auto: false, pellets: 10, color: 0x776655 },
            { id: 'wide_sg', name: 'Widowmaker', cat: 'shotgun', tier: 'rare', dmg: 50, rpm: 70, range: 14, acc: .50, mag: 6, price: 1100, auto: false, pellets: 14, color: 0x776644 },
            { id: 'slug_sg', name: 'Slug Cannon', cat: 'shotgun', tier: 'rare', dmg: 100, rpm: 80, range: 45, acc: .88, mag: 4, price: 1000, auto: false, pellets: 1, color: 0x665533 },
            // === MELEE ===
            { id: 'knife', name: 'Combat Knife', cat: 'melee', tier: 'common', dmg: 48, rpm: 300, range: 2.8, acc: 1.0, mag: Infinity, price: 0, auto: false, color: 0x999999 },
            { id: 'sword', name: 'Katana', cat: 'melee', tier: 'rare', dmg: 75, rpm: 180, range: 3.5, acc: 1.0, mag: Infinity, price: 600, auto: false, color: 0xaaaacc },
            { id: 'hammer', name: 'Sledgehammer', cat: 'melee', tier: 'rare', dmg: 110, rpm: 90, range: 3.2, acc: 1.0, mag: Infinity, price: 850, auto: false, color: 0x886644 },
            { id: 'energy_blade', name: 'Energy Blade', cat: 'melee', tier: 'epic', dmg: 95, rpm: 250, range: 4.2, acc: 1.0, mag: Infinity, price: 1500, auto: false, color: 0x0044aa, energyTrail: true, laserColor: 0x0099ff },
            { id: 'rapid_knife', name: 'Rapid Knife', cat: 'melee', tier: 'rare', dmg: 30, rpm: 600, range: 2.5, acc: 1.0, mag: Infinity, price: 800, auto: false, color: 0xbbbbcc },
            // === SPECIAL ===
            { id: 'plasma', name: 'Plasma Rifle', cat: 'special', tier: 'epic', dmg: 38, rpm: 900, range: 95, acc: .92, mag: 40, price: 2000, auto: true, laserColor: 0x0066ff, color: 0x002255 },
            { id: 'grenade_l', name: 'Grenade Launcher', cat: 'special', tier: 'epic', dmg: 160, rpm: 60, range: 55, acc: .80, mag: 6, price: 2500, auto: false, explosive: true, splashRadius: 4, color: 0x445566 },
            { id: 'railgun', name: 'Rail Gun', cat: 'special', tier: 'legendary', dmg: 220, rpm: 30, range: 400, acc: .99, mag: 3, price: 3200, auto: false, laserColor: 0x00aaff, color: 0x002244 },
            { id: 'minigun', name: 'Minigun', cat: 'special', tier: 'epic', dmg: 14, rpm: 1200, range: 62, acc: .74, mag: 200, price: 4500, auto: true, heavy: true, color: 0x554422 },
            { id: 'rocket', name: 'Rocket Launcher', cat: 'special', tier: 'epic', dmg: 180, rpm: 30, range: 120, acc: .90, mag: 4, price: 3000, auto: false, explosive: true, splashRadius: 5, color: 0x664422 },
            { id: 'laser_beam', name: 'Laser Beam', cat: 'special', tier: 'epic', dmg: 10, rpm: 1800, range: 150, acc: 1.0, mag: 200, price: 2800, auto: true, laserColor: 0xff0044, color: 0x440022 },
            { id: 'freeze_ray', name: 'Freeze Ray', cat: 'special', tier: 'rare', dmg: 15, rpm: 360, range: 60, acc: .90, mag: 30, price: 1800, auto: true, status: 'slow', laserColor: 0x44aaff, color: 0x002244 },
            { id: 'flamethrower', name: 'Flamethrower', cat: 'special', tier: 'epic', dmg: 8, rpm: 600, range: 18, acc: .82, mag: 60, price: 2000, auto: true, status: 'burn', color: 0x883300 },
            { id: 'shockwave_gun', name: 'Shockwave Gun', cat: 'special', tier: 'epic', dmg: 55, rpm: 60, range: 25, acc: .85, mag: 8, price: 2200, auto: false, status: 'knockback', laserColor: 0x6688ff, color: 0x334455 },
            { id: 'bouncer', name: 'Bouncer', cat: 'special', tier: 'legendary', dmg: 45, rpm: 120, range: 80, acc: .85, mag: 12, price: 4000, auto: false, bounce: 4, color: 0x552200 },
            { id: 'charge_rifle', name: 'Charge Rifle', cat: 'special', tier: 'legendary', dmg: 60, rpm: 40, range: 200, acc: .98, mag: 8, price: 5000, auto: false, charge: true, maxChargeMult: 5, laserColor: 0xffaa00, color: 0x001133 },
            // === NEW PISTOLS ===
            { id: 'hand_cannon', name: 'Hand Cannon', cat: 'pistol', tier: 'epic', dmg: 95, rpm: 100, range: 65, acc: .88, mag: 5, price: 1200, auto: false, color: 0x665544 },
            { id: 'dual_smg', name: 'Dual SMGs', cat: 'pistol', tier: 'rare', dmg: 11, rpm: 1200, range: 35, acc: .72, mag: 40, price: 1400, auto: true, color: 0x334444 },
            // === NEW RIFLES ===
            { id: 'p90', name: 'P90', cat: 'rifle', tier: 'common', dmg: 16, rpm: 950, range: 38, acc: .82, mag: 50, price: 850, auto: true, color: 0x334455 },
            { id: 'nail_gun', name: 'Nail Gun', cat: 'rifle', tier: 'rare', dmg: 14, rpm: 1100, range: 50, acc: .74, mag: 60, price: 1500, auto: true, color: 0x556655 },
            { id: 'vector', name: 'Vector SMG', cat: 'rifle', tier: 'rare', dmg: 18, rpm: 1200, range: 42, acc: .80, mag: 33, price: 1100, auto: true, color: 0x445544 },
            // === NEW SNIPERS ===
            { id: 'crossbow', name: 'Crossbow', cat: 'sniper', tier: 'epic', dmg: 110, rpm: 50, range: 200, acc: .97, mag: 1, price: 2600, auto: false, color: 0x111111 },
            { id: 'anti_mat', name: 'Anti-Materiel', cat: 'sniper', tier: 'legendary', dmg: 240, rpm: 20, range: 400, acc: .99, mag: 3, price: 4200, auto: false, scope: true, explosive: true, splashRadius: 2, color: 0x222233 },
            // === NEW SHOTGUNS ===
            { id: 'tactical_sg', name: 'Tactical SG', cat: 'shotgun', tier: 'epic', dmg: 45, rpm: 160, range: 22, acc: .72, mag: 9, price: 1600, auto: false, burst: 3, pellets: 4, color: 0x445566 },
            { id: 'double_barrel', name: 'Double Barrel', cat: 'shotgun', tier: 'rare', dmg: 140, rpm: 40, range: 14, acc: .68, mag: 2, price: 800, auto: false, pellets: 12, color: 0x665544 },
            // === NEW MELEE ===
            { id: 'chainsaw', name: 'Chainsaw', cat: 'melee', tier: 'epic', dmg: 22, rpm: 900, range: 3.0, acc: 1.0, mag: Infinity, price: 2000, auto: true, color: 0x554422 },
            { id: 'spear', name: 'Spear', cat: 'melee', tier: 'rare', dmg: 60, rpm: 150, range: 5.5, acc: 1.0, mag: Infinity, price: 1000, auto: false, color: 0x888877 },
            { id: 'nunchucks', name: 'Nunchucks', cat: 'melee', tier: 'common', dmg: 35, rpm: 480, range: 3.0, acc: 1.0, mag: Infinity, price: 400, auto: false, color: 0x554433 },
            // === NEW SPECIAL ===
            { id: 'void_rifle', name: 'Void Rifle', cat: 'special', tier: 'epic', dmg: 70, rpm: 200, range: 120, acc: .93, mag: 12, price: 3500, auto: false, pierce: true, laserColor: 0x8800ff, color: 0x220044 },
            { id: 'thunder', name: 'Thunder Rifle', cat: 'special', tier: 'legendary', dmg: 85, rpm: 80, range: 80, acc: .88, mag: 10, price: 4500, auto: false, chain: true, laserColor: 0xffff00, color: 0x221100 },
            { id: 'gravity_gun', name: 'Gravity Gun', cat: 'special', tier: 'legendary', dmg: 40, rpm: 60, range: 20, acc: .95, mag: 6, price: 5500, auto: false, status: 'knockback', laserColor: 0x8844ff, color: 0x220033 },
            { id: 'acid_launcher', name: 'Acid Launcher', cat: 'special', tier: 'epic', dmg: 12, rpm: 180, range: 40, acc: .82, mag: 12, price: 2800, auto: false, explosive: true, splashRadius: 3, status: 'burn', laserColor: 0x44ff00, color: 0x112200 },
            { id: 'tesla', name: 'Tesla Coil', cat: 'special', tier: 'epic', dmg: 25, rpm: 600, range: 18, acc: .88, mag: 50, price: 2400, auto: true, status: 'slow', laserColor: 0x00ffff, color: 0x001133 },
        ];

        // ============================================================
        // CHARACTER DEFINITIONS
        // ============================================================
        const CDEFS = [
            { id: 'soldier', name: 'Soldier', icon: 'ðŸª–', desc: 'Balanced fighter', hp: 100, speed: 1.0, dmgMult: 1.0, price: 0 },
            { id: 'scout', name: 'Scout', icon: 'ðŸƒ', desc: '+Speed -HP', hp: 75, speed: 1.4, dmgMult: 0.9, price: 800 },
            { id: 'tank', name: 'Tank', icon: 'ðŸ›¡ï¸', desc: '+HP -Speed', hp: 160, speed: 0.7, dmgMult: 1.1, price: 1200 },
            { id: 'marksman', name: 'Marksman', icon: 'ðŸŽ¯', desc: '+Damage -HP', hp: 80, speed: 1.0, dmgMult: 1.4, price: 1500 },
            { id: 'berserker', name: 'Berserker', icon: 'ðŸ˜¤', desc: 'Rage at low HP', hp: 110, speed: 1.1, dmgMult: 1.0, rage: true, price: 2200 },
        ];

        // ============================================================
        // GAME MODE DEFINITIONS
        // ============================================================
        const GAME_MODES = [
            { id: 'elimination', name: 'Elimination', icon: 'â˜ ï¸', desc: 'Kill all enemies' },
            { id: 'survival', name: 'Survival', icon: 'ðŸŒŠ', desc: 'Survive 5 waves' },
            { id: 'timed', name: 'Timed Hunt', icon: 'â±ï¸', desc: 'Most kills in 2 min' },
        ];

        // ============================================================
        // POWERUP DEFINITIONS
        // ============================================================
        const POWERUP_TYPES = [
            { id: 'health', icon: 'â¤ï¸', color: 0xff4444, label: 'HEALTH PACK', apply(G) { G.playerHp = Math.min(G.playerMaxHp, G.playerHp + 40); G.updateHUD(); } },
            { id: 'ammo', icon: 'ðŸ“¦', color: 0xffcc44, label: 'AMMO CRATE', apply(G) { G.weapons.forEach(w => { if (w.cat !== 'melee') { w.curMag = w.mag; w.totalAmmo = w.mag * 3; } }); G.updateHUD(); } },
            { id: 'speed', icon: 'âš¡', color: 0x44ffff, label: 'SPEED BOOST', apply(G) { G._speedBoost = 8; } },
            { id: 'damage', icon: 'ðŸ”¥', color: 0xff8800, label: 'DAMAGE BOOST', apply(G) { G._dmgBoost = 8; } },
            { id: 'shield', icon: 'ðŸ›¡', color: 0x4488ff, label: 'SHIELD', apply(G) { G.playerHp = Math.min(G.playerMaxHp + 50, G.playerHp + 50); G.playerMaxHp = Math.max(G.playerMaxHp, G.playerHp); G.updateHUD(); } },
        ];

        // ============================================================
        // MAP DEFINITIONS
        // ============================================================
        const MDEFS = [
            {
                id: 'arena', name: 'Combat Arena', icon: 'ðŸŸï¸', size: 'SMALL',
                floor: 0x1a1a2a, wall: 0x2a2244, accent: 0xff3366,
                ambient: 0x221133, fog: [0x1a1a2a, .04],
                botCount: 3,
                obstacles: [
                    // center pillars
                    { x: 0, z: 0, w: 1.5, d: 1.5, h: 4, c: 0x332244 }, { x: 5, z: 0, w: 1.2, d: 1.2, h: 4, c: 0x332244 }, { x: -5, z: 0, w: 1.2, d: 1.2, h: 4, c: 0x332244 },
                    { x: 0, z: 5, w: 1.2, d: 1.2, h: 4, c: 0x332244 }, { x: 0, z: -5, w: 1.2, d: 1.2, h: 4, c: 0x332244 },
                    // corner blocks
                    { x: 8, z: 8, w: 3, d: 2, h: 1.5, c: 0x221133 }, { x: -8, z: 8, w: 3, d: 2, h: 1.5, c: 0x221133 }, { x: 8, z: -8, w: 3, d: 2, h: 1.5, c: 0x221133 }, { x: -8, z: -8, w: 3, d: 2, h: 1.5, c: 0x221133 },
                    // side walls (inner arena)
                    { x: 10, z: 0, w: .6, d: 8, h: 3, c: 0x442255 }, { x: -10, z: 0, w: .6, d: 8, h: 3, c: 0x442255 }, { x: 0, z: 10, w: 8, d: .6, h: 3, c: 0x442255 }, { x: 0, z: -10, w: 8, d: .6, h: 3, c: 0x442255 },
                ],
                bounds: 14,
                spawnPts: [{ x: 0, z: -11 }, { x: -11, z: 0 }, { x: 11, z: 0 }],
                playerSpawn: { x: 0, z: 11 },
            },
            {
                id: 'warehouse', name: 'Warehouse', icon: 'ðŸ­', size: 'MEDIUM',
                floor: 0x1a1610, wall: 0x2a2014, accent: 0xff8800,
                ambient: 0x221a10, fog: [0x1a1610, .025],
                obstacles: [
                    // crate rows
                    { x: -8, z: -4, w: 2, d: 2, h: 2, c: 0x554422 }, { x: -8, z: -1, w: 2, d: 2, h: 2, c: 0x554422 }, { x: -8, z: 2, w: 2, d: 2, h: 2, c: 0x554422 },
                    { x: 8, z: 4, w: 2, d: 2, h: 2, c: 0x443311 }, { x: 8, z: 1, w: 2, d: 2, h: 2, c: 0x443311 }, { x: 8, z: -2, w: 2, d: 2, h: 2, c: 0x443311 },
                    { x: -4, z: 8, w: 2, d: 2, h: 2, c: 0x554422 }, { x: -1, z: 8, w: 2, d: 2, h: 2, c: 0x554422 }, { x: 2, z: 8, w: 2, d: 2, h: 2, c: 0x554422 },
                    { x: 4, z: -8, w: 2, d: 2, h: 2, c: 0x443311 }, { x: 1, z: -8, w: 2, d: 2, h: 2, c: 0x443311 }, { x: -2, z: -8, w: 2, d: 2, h: 2, c: 0x443311 },
                    // central cover
                    { x: 0, z: 0, w: 4, d: 1, h: 1.5, c: 0x665533 }, { x: 3, z: 3, w: 1.5, d: 1.5, h: 3, c: 0x554422 }, { x: -3, z: -3, w: 1.5, d: 1.5, h: 3, c: 0x554422 },
                    // shelving
                    { x: 5, z: -6, w: 1, d: 5, h: 3, c: 0x332211 }, { x: -5, z: 6, w: 1, d: 5, h: 3, c: 0x332211 },
                ],
                bounds: 18,
                spawnPts: [{ x: -14, z: 0 }, { x: 14, z: 0 }, { x: 0, z: -14 }, { x: 0, z: 14 }],
                playerSpawn: { x: 0, z: 0 },
            },
            {
                id: 'rooftop', name: 'Rooftop', icon: 'ðŸ™ï¸', size: 'MEDIUM',
                urbanGltf: true,
                floor: 0x181820, wall: 0x222233, accent: 0x00ccff,
                ambient: 0x101020, fog: [0x101522, .02],
                obstacles: [
                    // HVAC units
                    { x: -6, z: -6, w: 3, d: 2, h: 2, c: 0x333344 }, { x: 6, z: -6, w: 3, d: 2, h: 2, c: 0x333344 }, { x: -6, z: 6, w: 3, d: 2, h: 2, c: 0x333344 }, { x: 6, z: 6, w: 3, d: 2, h: 2, c: 0x333344 },
                    // vent structures
                    { x: 0, z: -7, w: 1, d: 3, h: 1.5, c: 0x444455 }, { x: 0, z: 7, w: 1, d: 3, h: 1.5, c: 0x444455 },
                    // low walls
                    { x: -10, z: 0, w: .5, d: 8, h: 1.2, c: 0x222233 }, { x: 10, z: 0, w: .5, d: 8, h: 1.2, c: 0x222233 }, { x: 0, z: -10, w: 8, d: .5, h: 1.2, c: 0x222233 }, { x: 0, z: 10, w: 8, d: .5, h: 1.2, c: 0x222233 },
                    // stairwell box
                    { x: -2, z: 2, w: 4, d: 3, h: 2.5, c: 0x2a2a3a },
                    // pipes/machinery
                    { x: 4, z: -2, w: 1, d: 4, h: 1, c: 0x334444 }, { x: -4, z: 2, w: 1, d: 4, h: 1, c: 0x334444 },
                ],
                bounds: 16,
                spawnPts: [{ x: -13, z: -13 }, { x: 13, z: -13 }, { x: -13, z: 13 }, { x: 13, z: 13 }],
                playerSpawn: { x: 0, z: 0 },
            },
            {
                id: 'desert', name: 'Desert Ruins', icon: 'ðŸœï¸', size: 'LARGE',
                floor: 0x3a2a10, wall: 0x4a3820, accent: 0xffaa00,
                ambient: 0x302010, fog: [0x4a3820, .015],
                obstacles: [
                    // rock formations
                    { x: -10, z: -5, w: 4, d: 3, h: 3, c: 0x5a4020 }, { x: 10, z: 5, w: 4, d: 3, h: 3, c: 0x5a4020 }, { x: -10, z: 10, w: 3, d: 4, h: 2, c: 0x4a3010 }, { x: 10, z: -10, w: 3, d: 4, h: 2, c: 0x4a3010 },
                    // ruins walls
                    { x: 0, z: -8, w: 8, d: .8, h: 2.5, c: 0x665544 }, { x: 0, z: 8, w: 8, d: .8, h: 2.5, c: 0x665544 }, { x: -8, z: 0, w: .8, d: 8, h: 2.5, c: 0x665544 }, { x: 8, z: 0, w: .8, d: 8, h: 2.5, c: 0x665544 },
                    // small rock clusters
                    { x: 5, z: -15, w: 2, d: 2, h: 2, c: 0x5a4020 }, { x: -5, z: 15, w: 2, d: 2, h: 2, c: 0x5a4020 }, { x: 15, z: 5, w: 2, d: 2, h: 2, c: 0x5a4020 }, { x: -15, z: -5, w: 2, d: 2, h: 2, c: 0x5a4020 },
                    // central obelisk
                    { x: 0, z: 0, w: 2, d: 2, h: 6, c: 0x775533 },
                    // scattered debris
                    { x: 7, z: 7, w: 1.5, d: 1.5, h: 1, c: 0x5a4020 }, { x: -7, z: -7, w: 1.5, d: 1.5, h: 1, c: 0x5a4020 }, { x: 7, z: -7, w: 1.5, d: 1.5, h: 1, c: 0x5a4020 }, { x: -7, z: 7, w: 1.5, d: 1.5, h: 1, c: 0x5a4020 },
                ],
                bounds: 22,
                spawnPts: [{ x: -18, z: 0 }, { x: 18, z: 0 }, { x: 0, z: -18 }, { x: 0, z: 18 }],
                playerSpawn: { x: 0, z: 12 },
            },
            {
                id: 'neon', name: 'Neon City', icon: 'ðŸŒ†', size: 'LARGE',
                urbanGltf: true,
                floor: 0x050510, wall: 0x0a0a20, accent: 0xff00ff,
                ambient: 0x050515, fog: [0x050510, .018],
                obstacles: [
                    { x: -8, z: -8, w: 4, d: 4, h: 5, c: 0x112222 }, { x: 8, z: -8, w: 4, d: 4, h: 5, c: 0x221122 }, { x: -8, z: 8, w: 4, d: 4, h: 5, c: 0x221122 }, { x: 8, z: 8, w: 4, d: 4, h: 5, c: 0x112222 },
                    { x: -3, z: -10, w: 2, d: 4, h: 1.2, c: 0x332211 }, { x: 3, z: 10, w: 2, d: 4, h: 1.2, c: 0x113322 }, { x: -10, z: 3, w: 4, d: 2, h: 1.2, c: 0x221133 }, { x: 10, z: -3, w: 4, d: 2, h: 1.2, c: 0x332211 },
                    { x: 0, z: -4, w: 3, d: 1, h: 1.5, c: 0x224422 }, { x: 0, z: 4, w: 3, d: 1, h: 1.5, c: 0x442244 }, { x: -4, z: 0, w: 1, d: 3, h: 1.5, c: 0x224444 }, { x: 4, z: 0, w: 1, d: 3, h: 1.5, c: 0x224444 },
                    { x: -13, z: -13, w: 1.5, d: 1.5, h: 6, c: 0x001133 }, { x: 13, z: -13, w: 1.5, d: 1.5, h: 6, c: 0x110033 }, { x: -13, z: 13, w: 1.5, d: 1.5, h: 6, c: 0x110033 }, { x: 13, z: 13, w: 1.5, d: 1.5, h: 6, c: 0x001133 },
                ],
                bounds: 20,
                spawnPts: [{ x: -16, z: -16 }, { x: 16, z: -16 }, { x: -16, z: 16 }, { x: 16, z: 16 }],
                playerSpawn: { x: 0, z: 0 },
            },
            {
                id: 'bunker', name: 'Bunker', icon: 'ðŸ—ï¸', size: 'SMALL',
                floor: 0x141410, wall: 0x1e1e16, accent: 0x88ff44,
                ambient: 0x101008, fog: [0x141410, .07],
                botCount: 3,
                obstacles: [
                    // corridor walls
                    { x: -5, z: 0, w: .5, d: 12, h: 3, c: 0x2a2a1e }, { x: 5, z: 0, w: .5, d: 12, h: 3, c: 0x2a2a1e },
                    { x: 0, z: -3, w: 8, d: .5, h: 3, c: 0x2a2a1e }, { x: 0, z: 3, w: 8, d: .5, h: 3, c: 0x2a2a1e },
                    // crate cover
                    { x: -3, z: -6, w: 1.5, d: 1.5, h: 2, c: 0x443322 }, { x: 3, z: 6, w: 1.5, d: 1.5, h: 2, c: 0x443322 },
                    { x: 3, z: -6, w: 1.5, d: 1.5, h: 2, c: 0x443322 }, { x: -3, z: 6, w: 1.5, d: 1.5, h: 2, c: 0x443322 },
                    // pillars
                    { x: -7, z: -7, w: 1, d: 1, h: 3, c: 0x333322 }, { x: 7, z: -7, w: 1, d: 1, h: 3, c: 0x333322 },
                    { x: -7, z: 7, w: 1, d: 1, h: 3, c: 0x333322 }, { x: 7, z: 7, w: 1, d: 1, h: 3, c: 0x333322 },
                    // machinery
                    { x: 0, z: 0, w: 2, d: 2, h: 2.5, c: 0x445533 },
                ],
                bounds: 13,
                spawnPts: [{ x: -10, z: -10 }, { x: 10, z: -10 }, { x: 0, z: -11 }],
                playerSpawn: { x: 0, z: 10 },
            },
            {
                id: 'ice', name: 'Ice Field', icon: 'â„ï¸', size: 'LARGE',
                floor: 0x99bbdd, wall: 0xaaccee, accent: 0x00ffff,
                ambient: 0x7799aa, fog: [0xaabbcc, .010],
                botCount: 4,
                obstacles: [
                    // ice chunks
                    { x: -12, z: -6, w: 4, d: 3, h: 2.5, c: 0x88aabb }, { x: 12, z: 6, w: 4, d: 3, h: 2.5, c: 0x88aabb },
                    { x: -6, z: 12, w: 3, d: 4, h: 2, c: 0x99bbcc }, { x: 6, z: -12, w: 3, d: 4, h: 2, c: 0x99bbcc },
                    // frozen pillars
                    { x: 0, z: 0, w: 2, d: 2, h: 5, c: 0xaabbcc }, { x: -7, z: -7, w: 1.5, d: 1.5, h: 3, c: 0x88aacc },
                    { x: 7, z: 7, w: 1.5, d: 1.5, h: 3, c: 0x88aacc }, { x: -7, z: 7, w: 1.5, d: 1.5, h: 3, c: 0x88aacc },
                    { x: 7, z: -7, w: 1.5, d: 1.5, h: 3, c: 0x88aacc },
                    // snowbanks
                    { x: -15, z: 0, w: 1, d: 8, h: 1.5, c: 0xccddee }, { x: 15, z: 0, w: 1, d: 8, h: 1.5, c: 0xccddee },
                    { x: 0, z: -15, w: 8, d: 1, h: 1.5, c: 0xccddee }, { x: 0, z: 15, w: 8, d: 1, h: 1.5, c: 0xccddee },
                    // debris
                    { x: 4, z: -4, w: 2, d: 1, h: 1, c: 0x8899aa }, { x: -4, z: 4, w: 2, d: 1, h: 1, c: 0x8899aa },
                ],
                bounds: 22,
                spawnPts: [{ x: -18, z: 0 }, { x: 18, z: 0 }, { x: 0, z: -18 }, { x: 0, z: 18 }],
                playerSpawn: { x: 0, z: 14 },
            },
            {
                id: 'temple', name: 'Ancient Temple', icon: 'ðŸ›ï¸', size: 'LARGE',
                floor: 0x2a1e0a, wall: 0x3a2810, accent: 0xffcc44,
                ambient: 0x1e1408, fog: [0x2a1a08, .014],
                botCount: 4,
                obstacles: [
                    // temple pillars
                    { x: -8, z: -8, w: 1.5, d: 1.5, h: 5, c: 0x664422 }, { x: 8, z: -8, w: 1.5, d: 1.5, h: 5, c: 0x664422 },
                    { x: -8, z: 8, w: 1.5, d: 1.5, h: 5, c: 0x664422 }, { x: 8, z: 8, w: 1.5, d: 1.5, h: 5, c: 0x664422 },
                    { x: -8, z: 0, w: 1.5, d: 1.5, h: 5, c: 0x553311 }, { x: 8, z: 0, w: 1.5, d: 1.5, h: 5, c: 0x553311 },
                    { x: 0, z: -8, w: 1.5, d: 1.5, h: 5, c: 0x553311 }, { x: 0, z: 8, w: 1.5, d: 1.5, h: 5, c: 0x553311 },
                    // altar center
                    { x: 0, z: 0, w: 3, d: 3, h: 1.5, c: 0x775533 }, { x: 0, z: 0, w: 1.5, d: 1.5, h: 3, c: 0x886644 },
                    // walls
                    { x: -14, z: 0, w: .8, d: 10, h: 3, c: 0x554422 }, { x: 14, z: 0, w: .8, d: 10, h: 3, c: 0x554422 },
                    { x: 0, z: -14, w: 10, d: .8, h: 3, c: 0x554422 }, { x: 0, z: 14, w: 10, d: .8, h: 3, c: 0x554422 },
                    // rubble
                    { x: 5, z: -5, w: 2, d: 1.5, h: 1.2, c: 0x665533 }, { x: -5, z: 5, w: 2, d: 1.5, h: 1.2, c: 0x665533 },
                    { x: 5, z: 5, w: 1.5, d: 2, h: 1, c: 0x554422 }, { x: -5, z: -5, w: 1.5, d: 2, h: 1, c: 0x554422 },
                ],
                bounds: 20,
                spawnPts: [{ x: -16, z: -16 }, { x: 16, z: -16 }, { x: -16, z: 16 }, { x: 16, z: 16 }],
                playerSpawn: { x: 5, z: -12 },
            },
            {
                id: 'space', name: 'Space Station', icon: 'ðŸš€', size: 'MEDIUM',
                floor: 0x080818, wall: 0x101028, accent: 0x0088ff,
                ambient: 0x040412, fog: [0x060616, .025],
                botCount: 4,
                obstacles: [
                    // module walls
                    { x: -6, z: -6, w: 3, d: .5, h: 2.5, c: 0x111122 }, { x: 6, z: 6, w: 3, d: .5, h: 2.5, c: 0x111122 },
                    { x: -6, z: 6, w: .5, d: 3, h: 2.5, c: 0x111122 }, { x: 6, z: -6, w: .5, d: 3, h: 2.5, c: 0x111122 },
                    // console panels
                    { x: 0, z: -8, w: 4, d: 1, h: 1.8, c: 0x223344 }, { x: 0, z: 8, w: 4, d: 1, h: 1.8, c: 0x223344 },
                    { x: -8, z: 0, w: 1, d: 4, h: 1.8, c: 0x223344 }, { x: 8, z: 0, w: 1, d: 4, h: 1.8, c: 0x223344 },
                    // core
                    { x: 0, z: 0, w: 2, d: 2, h: 3, c: 0x0a1a3a },
                    // struts
                    { x: -4, z: -4, w: .5, d: .5, h: 3.5, c: 0x223355 }, { x: 4, z: -4, w: .5, d: .5, h: 3.5, c: 0x223355 },
                    { x: -4, z: 4, w: .5, d: .5, h: 3.5, c: 0x223355 }, { x: 4, z: 4, w: .5, d: .5, h: 3.5, c: 0x223355 },
                ],
                bounds: 16,
                spawnPts: [{ x: -12, z: -12 }, { x: 12, z: -12 }, { x: -12, z: 12 }, { x: 12, z: 12 }],
                playerSpawn: { x: 0, z: 0 },
            },
        ];

        // ============================================================
        // DIFFICULTY SETTINGS
        // ============================================================
        const DIFFS = {
            easy: { label: 'EASY', react: .55, acc: .58, aggroRange: 16, speed: 2.8, hp: 90, dmgMult: 1.05, strafe: .7, reward: 1.0 },
            medium: { label: 'MEDIUM', react: .26, acc: .76, aggroRange: 22, speed: 3.7, hp: 135, dmgMult: 1.18, strafe: 1.0, reward: 1.5 },
            hard: { label: 'HARD', react: .14, acc: .88, aggroRange: 28, speed: 4.6, hp: 190, dmgMult: 1.35, strafe: 1.2, reward: 2.5 },
            extreme: { label: 'EXTREME', react: .05, acc: .97, aggroRange: 34, speed: 5.5, hp: 270, dmgMult: 1.6, strafe: 1.45, reward: 4.0 },
        };

        // ============================================================
        // SAVE SYSTEM
        // ============================================================
        const SAVE_KEY = 'hunters_v2';
        let save = {
            coins: 500,
            owned: ['glock', 'knife'],
            loadout: { primary: 'glock', secondary: null, melee: 'knife' },
            kills: 0,
            matches: 0,
            wins: 0,
            character: 'soldier',
            ownedChars: ['soldier'],
            bestWave: 0,
        };
        function loadSave() {
            try {
                const d = localStorage.getItem(SAVE_KEY);
                if (d) {
                    const p = JSON.parse(d);
                    Object.assign(save, p);
                    // Ensure new fields have defaults
                    if (!save.ownedChars) save.ownedChars = ['soldier'];
                    if (!save.character) save.character = 'soldier';
                    if (!save.bestWave) save.bestWave = 0;
                }
            } catch (e) { }
        }
        function writeSave() {
            try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { }
        }
        loadSave();

        // ============================================================
        // AUDIO SYSTEM
        // ============================================================
        let audioCtx = null;
        function getAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
        function playShot(weapon) {
            const ctx = getAudio();
            const buf = ctx.createBuffer(1, ctx.sampleRate * .08, ctx.sampleRate);
            const data = buf.getChannelData(0);
            const isMelee = weapon && weapon.cat === 'melee';
            const isSniper = weapon && weapon.cat === 'sniper';
            const isShotgun = weapon && weapon.cat === 'shotgun';
            if (isMelee) {
                for (let i = 0; i < data.length; i++)data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * .1)) * .8;
            } else {
                for (let i = 0; i < data.length; i++) {
                    const t = i / data.length;
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * (isSniper ? 8 : isShotgun ? 6 : 14)) * (isSniper ? 1.2 : isShotgun ? 1.0 : .7);
                }
            }
            const src = ctx.createBufferSource(); src.buffer = buf;
            const gain = ctx.createGain();
            const baseGain = isMelee ? .4 : isSniper ? 1.2 : isShotgun ? .9 : .6;
            gain.gain.setValueAtTime(baseGain, ctx.currentTime);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = isSniper ? 3000 : isShotgun ? 2500 : 8000;
            src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
            src.start();
        }
        function playHit() {
            const ctx = getAudio();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.frequency.setValueAtTime(300, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + .15);
            gain.gain.setValueAtTime(.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .15);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .15);
        }
        function playKill() {
            const ctx = getAudio();
            [440, 550, 660, 880].forEach((f, i) => {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.frequency.value = f; gain.gain.setValueAtTime(.2, ctx.currentTime + i * .07); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i * .07 + .15);
                osc.connect(gain); gain.connect(ctx.destination); osc.start(ctx.currentTime + i * .07); osc.stop(ctx.currentTime + i * .07 + .2);
            });
        }
        function playReload() {
            const ctx = getAudio();
            [[200, .08], [400, .05]].forEach(([f, d], i) => {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.type = 'square'; osc.frequency.value = f;
                gain.gain.setValueAtTime(.15, ctx.currentTime + i * .15); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i * .15 + d);
                osc.connect(gain); gain.connect(ctx.destination); osc.start(ctx.currentTime + i * .15); osc.stop(ctx.currentTime + i * .15 + d + .01);
            });
        }
        function playWin() {
            const ctx = getAudio();
            [523, 659, 784, 1047].forEach((f, i) => {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.type = 'triangle'; osc.frequency.value = f;
                gain.gain.setValueAtTime(.25, ctx.currentTime + i * .12); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i * .12 + .4);
                osc.connect(gain); gain.connect(ctx.destination); osc.start(ctx.currentTime + i * .12); osc.stop(ctx.currentTime + i * .12 + .5);
            });
        }
        function playLose() {
            const ctx = getAudio();
            [440, 330, 220].forEach((f, i) => {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.type = 'sawtooth'; osc.frequency.value = f;
                gain.gain.setValueAtTime(.2, ctx.currentTime + i * .18); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i * .18 + .3);
                osc.connect(gain); gain.connect(ctx.destination); osc.start(ctx.currentTime + i * .18); osc.stop(ctx.currentTime + i * .18 + .4);
            });
        }
        function playExplosion() {
            const ctx = getAudio();
            const buf = ctx.createBuffer(1, ctx.sampleRate * .4, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) { const t = i / data.length; data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, .4) * (1 - t * .7); }
            const src = ctx.createBufferSource(); src.buffer = buf;
            const gain = ctx.createGain(); gain.gain.value = 1.0;
            const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700;
            src.connect(filter); filter.connect(gain); gain.connect(ctx.destination); src.start();
        }
        function playLaserShot(laserColor) {
            const ctx = getAudio();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sawtooth';
            const baseFreq = laserColor === 0xff0044 ? 900 : laserColor === 0xffaa00 ? 700 : 600;
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + .1);
            gain.gain.setValueAtTime(.18, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .1);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .12);
        }
        function playFreezeShot() {
            const ctx = getAudio();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(1600, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(700, ctx.currentTime + .12);
            gain.gain.setValueAtTime(.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .12);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .15);
        }
        function playChargeFire(mult) {
            const ctx = getAudio();
            const buf = ctx.createBuffer(1, ctx.sampleRate * .25, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) { const t = i / data.length; data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 4) * (1 + (mult - 1) * .4); }
            const src = ctx.createBufferSource(); src.buffer = buf;
            const gain = ctx.createGain(); gain.gain.value = Math.min(1.5, .5 + (mult - 1) * .25);
            src.connect(gain); gain.connect(ctx.destination); src.start();
        }
        function playBounceHit() {
            const ctx = getAudio();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'square'; osc.frequency.setValueAtTime(500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + .06);
            gain.gain.setValueAtTime(.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .06);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .08);
        }

        // ============================================================
        // THREE.JS SETUP
        // ============================================================
        let renderer, scene, camera;
        function setupThreeJS() {
            if (renderer || !window.THREE) return;
            const THREE = window.THREE;
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
            renderer.setSize(innerWidth, innerHeight);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            document.body.appendChild(renderer.domElement);

            scene = new THREE.Scene();
            if (typeof HuntersGL !== 'undefined') HuntersGL.initEnvironment(scene, renderer);
            camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 500);
            camera.position.set(0, 1.7, 0);

            window.addEventListener('resize', () => {
                renderer.setSize(innerWidth, innerHeight);
                camera.aspect = innerWidth / innerHeight;
                camera.updateProjectionMatrix();
            });
        }


        // ============================================================
        // PARTICLE SYSTEM
        // ============================================================
        class Particle {
            constructor(pos, vel, color, life, size) {
                const geo = new THREE.SphereGeometry(size || .04, 4, 4);
                const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
                this.mesh = new THREE.Mesh(geo, mat);
                this.mesh.position.copy(pos);
                this.vel = vel.clone();
                this.life = life || .4;
                this.maxLife = this.life;
                scene.add(this.mesh);
            }
            update(dt) {
                this.vel.y -= 12 * dt;
                this.mesh.position.addScaledVector(this.vel, dt);
                this.life -= dt;
                this.mesh.material.opacity = Math.max(0, this.life / this.maxLife);
                return this.life > 0;
            }
            destroy() { scene.remove(this.mesh); }
        }
        const particles = [];
        function spawnImpact(pos, color) {
            for (let i = 0; i < 8; i++) {
                const v = new THREE.Vector3((Math.random() - .5) * 6, (Math.random()) * 4, (Math.random() - .5) * 6);
                particles.push(new Particle(pos, v, color || 0xffaa44, .3, .05));
            }
        }
        function spawnMuzzleFlash(pos) {
            const flash = new THREE.PointLight(0xffaa44, 3, 3);
            flash.position.copy(pos);
            scene.add(flash);
            setTimeout(() => scene.remove(flash), 60);
        }

        // ============================================================
        // WEAPON MODEL BUILDER
        // ============================================================
        function buildWeaponModel(wdef) {
            const g = new THREE.Group();
            const catColors = { pistol: 0x333344, rifle: 0x223322, sniper: 0x224422, shotgun: 0x554422, melee: 0x888888, special: 0x002244 };
            const c = wdef.color || catColors[wdef.cat] || 0x444444;
            const mat = new THREE.MeshLambertMaterial({ color: c });
            const matDark = new THREE.MeshLambertMaterial({ color: new THREE.Color(c).multiplyScalar(.5) });

            if (wdef.cat === 'pistol') {
                if (wdef.id === 'dual_smg') {
                    // Two compact SMGs side by side
                    const makeSmg = (ox) => {
                        const b = new THREE.Mesh(new THREE.BoxGeometry(.04, .08, .22), mat);
                        b.position.x = ox;
                        const brl = new THREE.Mesh(new THREE.BoxGeometry(.025, .025, .14), matDark);
                        brl.position.set(ox, .02, .2);
                        const gr = new THREE.Mesh(new THREE.BoxGeometry(.035, .1, .06), matDark);
                        gr.position.set(ox, -.08, .01);
                        return [b, brl, gr];
                    };
                    makeSmg(-.06).forEach(m => g.add(m));
                    makeSmg(.06).forEach(m => g.add(m));
                } else if (wdef.id === 'hand_cannon') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.08, .14, .28), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .22, 8), matDark);
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .04, .26);
                    const grip = new THREE.Mesh(new THREE.BoxGeometry(.07, .16, .09), new THREE.MeshLambertMaterial({ color: 0x554433 }));
                    grip.position.set(0, -.12, .02);
                    const trigger = new THREE.Mesh(new THREE.BoxGeometry(.006, .05, .02), matDark);
                    trigger.position.set(0, -.04, .1);
                    g.add(body, barrel, grip, trigger);
                } else {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.06, .12, .25), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .18, 8), matDark);
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .04, .22);
                    const slide = new THREE.Mesh(new THREE.BoxGeometry(.05, .04, .2), new THREE.MeshLambertMaterial({ color: new THREE.Color(c).multiplyScalar(.7) }));
                    slide.position.set(0, .05, .05);
                    const grip = new THREE.Mesh(new THREE.BoxGeometry(.05, .14, .08), matDark);
                    grip.position.set(0, -.1, .02);
                    const trigger = new THREE.Mesh(new THREE.BoxGeometry(.005, .04, .015), matDark);
                    trigger.position.set(0, -.03, .08);
                    g.add(body, barrel, slide, grip, trigger);
                }
            } else if (wdef.cat === 'rifle') {
                if (wdef.id === 'p90' || wdef.id === 'vector') {
                    // Bullpup SMG â€” compact, futuristic
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.06, .1, .38), mat);
                    const barrel = new THREE.Mesh(new THREE.BoxGeometry(.035, .035, .22), matDark);
                    barrel.position.set(0, .03, .3);
                    const topRail = new THREE.Mesh(new THREE.BoxGeometry(.03, .015, .32), new THREE.MeshLambertMaterial({ color: 0x222222 }));
                    topRail.position.set(0, .08, .06);
                    const grip = new THREE.Mesh(new THREE.BoxGeometry(.04, .1, .07), matDark);
                    grip.position.set(0, -.1, .08);
                    const mag = new THREE.Mesh(new THREE.BoxGeometry(.08, .06, .14), matDark);
                    mag.position.set(0, .01, -.1);
                    g.add(body, barrel, topRail, grip, mag);
                } else if (wdef.id === 'nail_gun') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.07, .12, .35), mat);
                    const barrel = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .22), matDark);
                    barrel.position.set(0, .04, .29);
                    const nailMag = new THREE.Mesh(new THREE.BoxGeometry(.04, .16, .05), new THREE.MeshLambertMaterial({ color: 0x333344 }));
                    nailMag.position.set(0, -.14, .05);
                    const vent1 = new THREE.Mesh(new THREE.BoxGeometry(.072, .01, .02), matDark); vent1.position.set(0, .04, .1);
                    const vent2 = vent1.clone(); vent2.position.set(0, .04, .16);
                    g.add(body, barrel, nailMag, vent1, vent2);
                } else {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.07, .1, .5), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .28, 8), matDark);
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .03, .42);
                    const handguard = new THREE.Mesh(new THREE.BoxGeometry(.055, .06, .24), new THREE.MeshLambertMaterial({ color: new THREE.Color(c).multiplyScalar(.65) }));
                    handguard.position.set(0, 0, .25);
                    const stock = new THREE.Mesh(new THREE.BoxGeometry(.055, .08, .22), matDark);
                    stock.position.set(0, -.02, -.3);
                    const mag = new THREE.Mesh(new THREE.BoxGeometry(.04, .12, .06), matDark);
                    mag.position.set(0, -.12, .05);
                    const grip = new THREE.Mesh(new THREE.BoxGeometry(.04, .1, .07), new THREE.MeshLambertMaterial({ color: 0x332211 }));
                    grip.position.set(0, -.1, .1);
                    g.add(body, barrel, handguard, stock, mag, grip);
                }
            } else if (wdef.cat === 'sniper') {
                if (wdef.id === 'crossbow') {
                    const blackMat = new THREE.MeshLambertMaterial({ color: 0x101010 });
                    const blackMatSoft = new THREE.MeshLambertMaterial({ color: 0x1d1d1d });
                    const metalMat = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });
                    const stringMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
                    const boltMat = new THREE.MeshLambertMaterial({ color: 0x2f2f2f });
                    const fletchMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

                    const stock = new THREE.Mesh(new THREE.BoxGeometry(.055, .08, .36), blackMat);
                    stock.position.set(0, -.01, -.18);
                    const cheek = new THREE.Mesh(new THREE.BoxGeometry(.045, .03, .12), blackMatSoft);
                    cheek.position.set(0, .045, -.24);
                    const grip = new THREE.Mesh(new THREE.BoxGeometry(.045, .12, .07), blackMat);
                    grip.position.set(0, -.1, -.02);
                    grip.rotation.x = -.32;
                    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(.04, .09, .05), blackMatSoft);
                    foregrip.position.set(0, -.08, .18);
                    foregrip.rotation.x = -.2;
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(.03, .022, .6), metalMat);
                    rail.position.set(0, .03, .12);
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .18), blackMat);
                    body.position.set(0, 0, .02);
                    const stirrup = new THREE.Mesh(new THREE.TorusGeometry(.06, .008, 6, 16), metalMat);
                    stirrup.rotation.x = Math.PI / 2;
                    stirrup.position.set(0, -.02, .43);
                    const limbCore = new THREE.Mesh(new THREE.BoxGeometry(.34, .02, .035), blackMat);
                    limbCore.position.set(0, .02, .34);
                    const limbLeft = new THREE.Mesh(new THREE.BoxGeometry(.19, .018, .03), blackMatSoft);
                    limbLeft.position.set(.16, .025, .34);
                    limbLeft.rotation.z = .45;
                    const limbRight = limbLeft.clone();
                    limbRight.position.x = -.16;
                    limbRight.rotation.z = -.45;
                    const camLeft = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .012, 12), metalMat);
                    camLeft.rotation.z = Math.PI / 2;
                    camLeft.position.set(.29, .03, .35);
                    const camRight = camLeft.clone();
                    camRight.position.x = -.29;
                    const stringLeft = new THREE.Mesh(new THREE.BoxGeometry(.002, .002, .32), stringMat);
                    stringLeft.position.set(.145, .03, .19);
                    stringLeft.rotation.x = .95;
                    stringLeft.rotation.y = -.42;
                    const stringRight = stringLeft.clone();
                    stringRight.position.x = -.145;
                    stringRight.rotation.y = .42;
                    const centerString = new THREE.Mesh(new THREE.BoxGeometry(.002, .002, .12), stringMat);
                    centerString.position.set(0, .03, .11);
                    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .42, 6), boltMat);
                    bolt.rotation.x = Math.PI / 2;
                    bolt.position.set(0, .046, .14);
                    const boltTip = new THREE.Mesh(new THREE.ConeGeometry(.012, .05, 6), metalMat);
                    boltTip.rotation.x = Math.PI / 2;
                    boltTip.position.set(0, .046, .38);
                    const fletchLeft = new THREE.Mesh(new THREE.BoxGeometry(.018, .003, .035), fletchMat);
                    fletchLeft.position.set(.01, .046, -.04);
                    fletchLeft.rotation.z = .35;
                    const fletchRight = fletchLeft.clone();
                    fletchRight.position.x = -.01;
                    fletchRight.rotation.z = -.35;
                    const scope = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .18, 12), blackMat);
                    scope.rotation.x = Math.PI / 2;
                    scope.position.set(0, .08, .06);
                    const scopeMountFront = new THREE.Mesh(new THREE.BoxGeometry(.018, .03, .018), metalMat);
                    scopeMountFront.position.set(0, .055, .12);
                    const scopeMountRear = scopeMountFront.clone();
                    scopeMountRear.position.z = 0;
                    g.add(stock, cheek, grip, foregrip, rail, body, stirrup, limbCore, limbLeft, limbRight, camLeft, camRight, stringLeft, stringRight, centerString, bolt, boltTip, fletchLeft, fletchRight, scope, scopeMountFront, scopeMountRear);
                } else {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.07, .1, .7), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .45, 8), matDark);
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .03, .6);
                    const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .06), new THREE.MeshLambertMaterial({ color: 0x222222 }));
                    muzzleBrake.position.set(0, .03, .86);
                    const scope = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .28), new THREE.MeshLambertMaterial({ color: 0x111111 }));
                    scope.position.set(0, .1, .1);
                    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .06, 8), new THREE.MeshLambertMaterial({ color: 0x001133 }));
                    scopeLens.rotation.x = Math.PI / 2; scopeLens.position.set(0, .1, .25);
                    const stock = new THREE.Mesh(new THREE.BoxGeometry(.055, .08, .28), matDark);
                    stock.position.set(0, -.02, -.46);
                    const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(.05, .04, .16), new THREE.MeshLambertMaterial({ color: 0x332211 }));
                    cheekRest.position.set(0, .06, -.38);
                    g.add(body, barrel, muzzleBrake, scope, scopeLens, stock, cheekRest);
                }
            } else if (wdef.cat === 'shotgun') {
                if (wdef.id === 'double_barrel') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.09, .1, .5), mat);
                    const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .32, 8), matDark);
                    barrel1.rotation.x = Math.PI / 2; barrel1.position.set(.03, .04, .4);
                    const barrel2 = barrel1.clone(); barrel2.position.set(-.03, .04, .4);
                    const stock = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .24), new THREE.MeshLambertMaterial({ color: 0x554422 }));
                    stock.position.set(0, -.01, -.33);
                    g.add(body, barrel1, barrel2, stock);
                } else if (wdef.id === 'tactical_sg') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .52), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .3, 8), matDark);
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .04, .42);
                    const topRail = new THREE.Mesh(new THREE.BoxGeometry(.04, .012, .3), new THREE.MeshLambertMaterial({ color: 0x333333 }));
                    topRail.position.set(0, .08, .12);
                    const stock = new THREE.Mesh(new THREE.BoxGeometry(.06, .08, .2), matDark);
                    stock.position.set(0, -.01, -.34);
                    const mag = new THREE.Mesh(new THREE.BoxGeometry(.05, .09, .06), matDark);
                    mag.position.set(0, -.1, .04);
                    g.add(body, barrel, topRail, stock, mag);
                } else {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.09, .11, .55), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .3, 8), matDark);
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .04, .44);
                    const pumpHandle = new THREE.Mesh(new THREE.BoxGeometry(.06, .04, .14), new THREE.MeshLambertMaterial({ color: 0x554422 }));
                    pumpHandle.position.set(0, -.01, .28);
                    const stock = new THREE.Mesh(new THREE.BoxGeometry(.065, .09, .24), new THREE.MeshLambertMaterial({ color: 0x554422 }));
                    stock.position.set(0, -.01, -.35);
                    g.add(body, barrel, pumpHandle, stock);
                }
            } else if (wdef.cat === 'melee') {
                if (wdef.id === 'knife') {
                    const blade = new THREE.Mesh(new THREE.BoxGeometry(.025, .01, .3), new THREE.MeshLambertMaterial({ color: 0xddddee }));
                    const edge = new THREE.Mesh(new THREE.BoxGeometry(.004, .008, .28), new THREE.MeshLambertMaterial({ color: 0xffffff }));
                    edge.position.set(.013, 0, 0);
                    const handle = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .12), mat);
                    handle.position.set(0, 0, -.2);
                    const guard = new THREE.Mesh(new THREE.BoxGeometry(.05, .02, .02), matDark);
                    guard.position.set(0, 0, -.12);
                    g.add(blade, edge, guard, handle);
                } else if (wdef.id === 'sword') {
                    const blade = new THREE.Mesh(new THREE.BoxGeometry(.025, .01, .55), new THREE.MeshLambertMaterial({ color: 0xccccdd }));
                    const shine = new THREE.Mesh(new THREE.BoxGeometry(.004, .008, .5), new THREE.MeshLambertMaterial({ color: 0xeeeeff }));
                    shine.position.set(.013, 0, .02);
                    const guard = new THREE.Mesh(new THREE.BoxGeometry(.14, .04, .04), new THREE.MeshLambertMaterial({ color: 0xaa8833 }));
                    guard.position.set(0, 0, -.18);
                    const handle = new THREE.Mesh(new THREE.BoxGeometry(.025, .025, .18), new THREE.MeshLambertMaterial({ color: 0x443311 }));
                    handle.position.set(0, 0, -.3);
                    const pommel = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 6), new THREE.MeshLambertMaterial({ color: 0xaa8833 }));
                    pommel.position.set(0, 0, -.4);
                    g.add(blade, shine, guard, handle, pommel);
                } else if (wdef.id === 'energy_blade') {
                    const blade = new THREE.Mesh(new THREE.BoxGeometry(.03, .015, .6), new THREE.MeshLambertMaterial({ color: 0x0099ff, emissive: new THREE.Color(0x0099ff), emissiveIntensity: 1.2 }));
                    const innerBlade = new THREE.Mesh(new THREE.BoxGeometry(.012, .006, .58), new THREE.MeshLambertMaterial({ color: 0x88ddff, emissive: new THREE.Color(0x88ddff), emissiveIntensity: 2.0 }));
                    const guard = new THREE.Mesh(new THREE.BoxGeometry(.14, .04, .04), mat);
                    guard.position.set(0, 0, -.18);
                    const handle = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .18), matDark);
                    handle.position.set(0, 0, -.3);
                    g.add(blade, innerBlade, guard, handle);
                } else if (wdef.id === 'rapid_knife') {
                    const blade = new THREE.Mesh(new THREE.BoxGeometry(.02, .008, .22), new THREE.MeshLambertMaterial({ color: 0xddddee }));
                    const handle = new THREE.Mesh(new THREE.BoxGeometry(.025, .025, .1), mat);
                    handle.position.set(0, 0, -.15);
                    const wrap = new THREE.Mesh(new THREE.BoxGeometry(.028, .028, .09), new THREE.MeshLambertMaterial({ color: 0x333344 }));
                    wrap.position.set(0, 0, -.16);
                    g.add(blade, handle, wrap);
                } else if (wdef.id === 'chainsaw') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .45), mat);
                    const bar = new THREE.Mesh(new THREE.BoxGeometry(.03, .06, .38), matDark);
                    bar.position.set(0, .05, .25);
                    const chain1 = new THREE.Mesh(new THREE.BoxGeometry(.035, .012, .36), new THREE.MeshLambertMaterial({ color: 0x888888 }));
                    chain1.position.set(0, .08, .25);
                    const motor = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .1, 8), new THREE.MeshLambertMaterial({ color: 0x554422 }));
                    motor.rotation.z = Math.PI / 2; motor.position.set(0, 0, -.15);
                    g.add(body, bar, chain1, motor);
                } else if (wdef.id === 'spear') {
                    const shaft = new THREE.Mesh(new THREE.BoxGeometry(.025, .025, .7), new THREE.MeshLambertMaterial({ color: 0x664422 }));
                    const head = new THREE.Mesh(new THREE.ConeGeometry(.025, .18, 6), new THREE.MeshLambertMaterial({ color: 0xccccaa }));
                    head.rotation.x = Math.PI / 2; head.position.set(0, 0, .44);
                    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(.08, .02, .03), new THREE.MeshLambertMaterial({ color: 0xaa8833 }));
                    crossguard.position.set(0, 0, .3);
                    g.add(shaft, head, crossguard);
                } else if (wdef.id === 'nunchucks') {
                    const stick1 = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .2, 8), new THREE.MeshLambertMaterial({ color: 0x443311 }));
                    stick1.rotation.x = Math.PI / 2; stick1.position.set(.06, 0, .05);
                    const stick2 = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .2, 8), new THREE.MeshLambertMaterial({ color: 0x443311 }));
                    stick2.rotation.x = Math.PI / 2; stick2.position.set(-.06, 0, .05);
                    const chain = new THREE.Mesh(new THREE.BoxGeometry(.003, .003, .08), new THREE.MeshLambertMaterial({ color: 0x888888 }));
                    chain.position.set(0, 0, .05);
                    g.add(stick1, stick2, chain);
                } else {
                    const head = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .14), mat);
                    head.position.set(0, 0, .22);
                    const shaft = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .55), matDark);
                    const grip = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .15), new THREE.MeshLambertMaterial({ color: 0x332211 }));
                    grip.position.set(0, 0, -.32);
                    g.add(head, shaft, grip);
                }
            } else { // special
                if (wdef.id === 'rocket' || wdef.id === 'grenade_l') {
                    // Rocket / grenade launcher â€” wide tube
                    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .7, 10), mat);
                    tube.rotation.x = Math.PI / 2;
                    const grip = new THREE.Mesh(new THREE.BoxGeometry(.05, .14, .08), matDark);
                    grip.position.set(0, -.08, -.05);
                    const fin1 = new THREE.Mesh(new THREE.BoxGeometry(.14, .03, .12), matDark);
                    fin1.position.set(0, -.07, .2);
                    g.add(tube, grip, fin1);
                } else if (wdef.id === 'flamethrower') {
                    // Flamethrower â€” wide nozzle
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .55), mat);
                    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.06, .03, .25, 8), new THREE.MeshLambertMaterial({ color: 0xcc4400 }));
                    nozzle.rotation.x = Math.PI / 2; nozzle.position.set(0, .02, .4);
                    const tank = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .3, 8), matDark);
                    tank.position.set(0, -.08, -.1);
                    g.add(body, nozzle, tank);
                } else if (wdef.id === 'charge_rifle') {
                    // Charge rifle â€” sleek with glowing coil
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .6), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .4, 8), new THREE.MeshLambertMaterial({ color: 0x002244 }));
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .03, .5);
                    const coil = new THREE.Mesh(new THREE.TorusGeometry(.05, .012, 6, 12), new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: new THREE.Color(0xffaa00), emissiveIntensity: .5 }));
                    coil.rotation.y = Math.PI / 2; coil.position.set(0, .02, .1);
                    g.add(body, barrel, coil);
                } else if (wdef.id === 'laser_beam') {
                    // Laser â€” thin sleek body
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.06, .08, .5), mat);
                    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(.018, .03, .2, 8), new THREE.MeshLambertMaterial({ color: 0xff0044, emissive: new THREE.Color(0xff0044), emissiveIntensity: .8 }));
                    emitter.rotation.x = Math.PI / 2; emitter.position.set(0, .02, .38);
                    g.add(body, emitter);
                } else if (wdef.id === 'freeze_ray') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .48), mat);
                    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(.022, .032, .18, 8), new THREE.MeshLambertMaterial({ color: 0x44aaff, emissive: new THREE.Color(0x44aaff), emissiveIntensity: .6 }));
                    emitter.rotation.x = Math.PI / 2; emitter.position.set(0, .02, .35);
                    g.add(body, emitter);
                } else if (wdef.id === 'bouncer') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.09, .1, .5), mat);
                    const barrel = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .25), matDark);
                    barrel.position.set(0, .03, .38);
                    const sphere = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 8), new THREE.MeshLambertMaterial({ color: 0xff8800, emissive: new THREE.Color(0xff4400), emissiveIntensity: .5 }));
                    sphere.position.set(0, .03, .55);
                    g.add(body, barrel, sphere);
                } else if (wdef.id === 'void_rifle') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .55), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, .38, 8), new THREE.MeshLambertMaterial({ color: 0x440088, emissive: new THREE.Color(0x440088), emissiveIntensity: .8 }));
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .03, .47);
                    const orb = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 8), new THREE.MeshLambertMaterial({ color: 0xaa44ff, emissive: new THREE.Color(0x8800ff), emissiveIntensity: 1.5 }));
                    orb.position.set(0, .03, .67);
                    const scope = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .2), new THREE.MeshLambertMaterial({ color: 0x110022 }));
                    scope.position.set(0, .09, .1);
                    g.add(body, barrel, orb, scope);
                } else if (wdef.id === 'thunder') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .52), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.015, .025, .35, 6), new THREE.MeshLambertMaterial({ color: 0xffff00, emissive: new THREE.Color(0xffcc00), emissiveIntensity: .7 }));
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .03, .44);
                    const coil1 = new THREE.Mesh(new THREE.TorusGeometry(.04, .008, 4, 8), new THREE.MeshLambertMaterial({ color: 0xffff44, emissive: new THREE.Color(0xffff00), emissiveIntensity: 1 }));
                    coil1.rotation.y = Math.PI / 2; coil1.position.set(0, .02, .15);
                    const coil2 = coil1.clone(); coil2.position.set(0, .02, -.05);
                    g.add(body, barrel, coil1, coil2);
                } else if (wdef.id === 'gravity_gun') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.09, .1, .5), mat);
                    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, .28, 6), new THREE.MeshLambertMaterial({ color: 0x6633aa, emissive: new THREE.Color(0x440088), emissiveIntensity: .9 }));
                    emitter.rotation.x = Math.PI / 2; emitter.position.set(0, .02, .38);
                    const ring = new THREE.Mesh(new THREE.TorusGeometry(.06, .01, 6, 16), new THREE.MeshLambertMaterial({ color: 0x8844ff, emissive: new THREE.Color(0x6622ff), emissiveIntensity: 1 }));
                    ring.rotation.y = Math.PI / 2; ring.position.set(0, .02, .55);
                    g.add(body, emitter, ring);
                } else if (wdef.id === 'crossbow') {
                    const blackMat = new THREE.MeshLambertMaterial({ color: 0x101010 });
                    const blackMatSoft = new THREE.MeshLambertMaterial({ color: 0x1d1d1d });
                    const metalMat = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });
                    const stringMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
                    const boltMat = new THREE.MeshLambertMaterial({ color: 0x2f2f2f });
                    const fletchMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

                    const stock = new THREE.Mesh(new THREE.BoxGeometry(.055, .08, .36), blackMat);
                    stock.position.set(0, -.01, -.18);
                    const cheek = new THREE.Mesh(new THREE.BoxGeometry(.045, .03, .12), blackMatSoft);
                    cheek.position.set(0, .045, -.24);
                    const grip = new THREE.Mesh(new THREE.BoxGeometry(.045, .12, .07), blackMat);
                    grip.position.set(0, -.1, -.02);
                    grip.rotation.x = -.32;
                    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(.04, .09, .05), blackMatSoft);
                    foregrip.position.set(0, -.08, .18);
                    foregrip.rotation.x = -.2;
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(.03, .022, .6), metalMat);
                    rail.position.set(0, .03, .12);
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .18), blackMat);
                    body.position.set(0, 0, .02);
                    const stirrup = new THREE.Mesh(new THREE.TorusGeometry(.06, .008, 6, 16), metalMat);
                    stirrup.rotation.x = Math.PI / 2;
                    stirrup.position.set(0, -.02, .43);
                    const limbCore = new THREE.Mesh(new THREE.BoxGeometry(.34, .02, .035), blackMat);
                    limbCore.position.set(0, .02, .34);
                    const limbLeft = new THREE.Mesh(new THREE.BoxGeometry(.19, .018, .03), blackMatSoft);
                    limbLeft.position.set(.16, .025, .34);
                    limbLeft.rotation.z = .45;
                    const limbRight = limbLeft.clone();
                    limbRight.position.x = -.16;
                    limbRight.rotation.z = -.45;
                    const camLeft = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .012, 12), metalMat);
                    camLeft.rotation.z = Math.PI / 2;
                    camLeft.position.set(.29, .03, .35);
                    const camRight = camLeft.clone();
                    camRight.position.x = -.29;
                    const stringLeft = new THREE.Mesh(new THREE.BoxGeometry(.002, .002, .32), stringMat);
                    stringLeft.position.set(.145, .03, .19);
                    stringLeft.rotation.x = .95;
                    stringLeft.rotation.y = -.42;
                    const stringRight = stringLeft.clone();
                    stringRight.position.x = -.145;
                    stringRight.rotation.y = .42;
                    const centerString = new THREE.Mesh(new THREE.BoxGeometry(.002, .002, .12), stringMat);
                    centerString.position.set(0, .03, .11);
                    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .42, 6), boltMat);
                    bolt.rotation.x = Math.PI / 2;
                    bolt.position.set(0, .046, .14);
                    const boltTip = new THREE.Mesh(new THREE.ConeGeometry(.012, .05, 6), metalMat);
                    boltTip.rotation.x = Math.PI / 2;
                    boltTip.position.set(0, .046, .38);
                    const fletchLeft = new THREE.Mesh(new THREE.BoxGeometry(.018, .003, .035), fletchMat);
                    fletchLeft.position.set(.01, .046, -.04);
                    fletchLeft.rotation.z = .35;
                    const fletchRight = fletchLeft.clone();
                    fletchRight.position.x = -.01;
                    fletchRight.rotation.z = -.35;
                    const scope = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .18, 12), blackMat);
                    scope.rotation.x = Math.PI / 2;
                    scope.position.set(0, .08, .06);
                    const scopeMountFront = new THREE.Mesh(new THREE.BoxGeometry(.018, .03, .018), metalMat);
                    scopeMountFront.position.set(0, .055, .12);
                    const scopeMountRear = scopeMountFront.clone();
                    scopeMountRear.position.z = 0;
                    g.add(stock, cheek, grip, foregrip, rail, body, stirrup, limbCore, limbLeft, limbRight, camLeft, camRight, stringLeft, stringRight, centerString, bolt, boltTip, fletchLeft, fletchRight, scope, scopeMountFront, scopeMountRear);
                } else if (wdef.id === 'tesla') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .45), mat);
                    const emitter = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 8), new THREE.MeshLambertMaterial({ color: 0x00ffff, emissive: new THREE.Color(0x00ffff), emissiveIntensity: 1 }));
                    emitter.position.set(0, .03, .3);
                    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(.035, .006, 4, 12), new THREE.MeshLambertMaterial({ color: 0x44ffff, emissive: new THREE.Color(0x00ddff), emissiveIntensity: .8 }));
                    ring1.rotation.y = Math.PI / 2; ring1.position.set(0, .03, .3);
                    g.add(body, emitter, ring1);
                } else if (wdef.id === 'acid_launcher') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .5), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .3, 8), new THREE.MeshLambertMaterial({ color: 0x224400 }));
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .02, .38);
                    const tank = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .25, 8), new THREE.MeshLambertMaterial({ color: 0x44ff00, emissive: new THREE.Color(0x22aa00), emissiveIntensity: .5 }));
                    tank.position.set(0, -.07, -.05);
                    g.add(body, barrel, tank);
                } else if (wdef.id === 'anti_mat') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.09, .12, .75), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .55, 8), matDark);
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .04, .65);
                    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(.035, .025, .1, 8), matDark);
                    muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, .04, .95);
                    const scope = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .3), new THREE.MeshLambertMaterial({ color: 0x111111 }));
                    scope.position.set(0, .12, .15);
                    const bipod1 = new THREE.Mesh(new THREE.BoxGeometry(.004, .12, .004), new THREE.MeshLambertMaterial({ color: 0x444444 }));
                    bipod1.position.set(.06, -.04, .4);
                    const bipod2 = bipod1.clone(); bipod2.position.set(-.06, -.04, .4);
                    g.add(body, barrel, muzzle, scope, bipod1, bipod2);
                } else {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.09, .1, .55), mat);
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .35, 8), matDark);
                    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .04, .45);
                    const detail = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .15), new THREE.MeshLambertMaterial({ color: new THREE.Color(c).multiplyScalar(2) }));
                    detail.position.set(0, 0, .1);
                    g.add(body, barrel, detail);
                }
            }
            return g;
        }

        function buildWeaponModelDetailed(wdef) {
            const g = new THREE.Group();
            const catColors = { pistol: 0x333344, rifle: 0x223322, sniper: 0x224422, shotgun: 0x554422, melee: 0x888888, special: 0x002244 };
            const c = wdef.color || catColors[wdef.cat] || 0x444444;
            const phong = (color, shine = 30, spec = 0x222222) => new THREE.MeshPhongMaterial({ color, shininess: shine, specular: spec });
            const mat = phong(c, 26, 0x191919);
            const matDark = phong(new THREE.Color(c).multiplyScalar(.5), 18, 0x111111);
            const matSoft = phong(new THREE.Color(c).multiplyScalar(.72), 22, 0x181818);
            const blackMat = phong(0x111111, 42, 0x2a2a2a);
            const metalMat = phong(0x2d2d2d, 56, 0x454545);
            const steelMat = phong(0x8f949c, 78, 0x7a7f88);
            const woodMat = phong(0x5a4230, 10, 0x1c1410);
            const gripMat = phong(0x2a221d, 8, 0x111111);

            const add = (geo, material, pos, rot) => {
                const mesh = new THREE.Mesh(geo, material);
                if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
                if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
                g.add(mesh);
                return mesh;
            };
            const addBox = (size, material, pos, rot) => add(new THREE.BoxGeometry(size[0], size[1], size[2]), material, pos, rot);
            const addCyl = (rTop, rBottom, len, radial, material, pos, rot) => add(new THREE.CylinderGeometry(rTop, rBottom, len, radial || 8), material, pos, rot);
            const addRail = (length, pos) => {
                addBox([.042, .014, length], blackMat, pos);
                for (let i = -2; i <= 2; i++) addBox([.05, .004, .022], metalMat, [pos[0], pos[1] + .008, pos[2] + i * .05]);
            };
            const addScope = (length, pos, color) => {
                addCyl(.022, .022, length, 12, new THREE.MeshLambertMaterial({ color: color || 0x101010 }), pos, [Math.PI / 2, 0, 0]);
                addCyl(.028, .028, .025, 12, metalMat, [pos[0], pos[1], pos[2] - length / 2 + .01], [Math.PI / 2, 0, 0]);
                addCyl(.028, .028, .025, 12, metalMat, [pos[0], pos[1], pos[2] + length / 2 - .01], [Math.PI / 2, 0, 0]);
                addBox([.016, .028, .018], metalMat, [pos[0], pos[1] - .025, pos[2] - .05]);
                addBox([.016, .028, .018], metalMat, [pos[0], pos[1] - .025, pos[2] + .05]);
            };
            const addMuzzle = (z, radius, length) => addCyl(radius, radius * .9, length, 10, blackMat, [0, .03, z], [Math.PI / 2, 0, 0]);
            const addPistolBase = (opts = {}) => {
                addBox([opts.bodyW || .06, opts.bodyH || .11, opts.bodyL || .23], mat, [0, 0, opts.bodyZ || .04]);
                addBox([.055, .045, opts.slideL || .22], matSoft, [0, .045, opts.slideZ || .06]);
                addCyl(opts.barrelR || .014, opts.barrelR || .014, opts.barrelL || .18, 10, metalMat, [0, .035, opts.barrelZ || .2], [Math.PI / 2, 0, 0]);
                addBox([.05, .14, .075], gripMat, [0, -.1, opts.gripZ || .02], [-.26, 0, 0]);
                addBox([.01, .04, .015], metalMat, [0, -.03, opts.triggerZ || .08], [.5, 0, 0]);
                addBox([.018, .02, .03], steelMat, [0, .075, -.025]);
                addBox([.014, .02, .018], steelMat, [0, .07, .16]);
            };
            const addRifleBase = (opts = {}) => {
                addBox([opts.bodyW || .075, opts.bodyH || .1, opts.bodyL || .56], mat, [0, 0, opts.bodyZ || .05]);
                addBox([.06, .055, opts.handguardL || .24], matSoft, [0, -.005, opts.handguardZ || .24]);
                addBox([.082, .035, (opts.bodyL || .56) - .06], blackMat, [0, .035, (opts.bodyZ || .05) + .02]);
                addBox([.07, .03, (opts.handguardL || .24) + .04], matSoft, [0, .018, opts.handguardZ || .24]);
                addCyl(opts.barrelR || .015, opts.barrelR || .015, opts.barrelL || .34, 10, metalMat, [0, .03, opts.barrelZ || .46], [Math.PI / 2, 0, 0]);
                addBox([.06, .085, opts.stockL || .24], matDark, [0, -.015, opts.stockZ || -.28]);
                addBox([.05, .05, .08], blackMat, [0, .02, (opts.stockZ || -.28) - ((opts.stockL || .24) / 2) + .03]);
                addBox([.05, .11, .075], gripMat, [0, -.1, opts.gripZ || .09], [-.28, 0, 0]);
                addBox([.045, .13, .06], blackMat, [0, -.12, opts.magZ || .04], [.08, 0, 0]);
                addRail(opts.railL || .32, [0, .075, opts.railZ || .06]);
                addBox([.01, .04, .018], metalMat, [0, -.035, opts.triggerZ || .09], [.5, 0, 0]);
                addMuzzle(opts.muzzleZ || .65, opts.muzzleR || .018, opts.muzzleL || .05);
            };
            const addCrossbow = () => {
                const cbBlack = phong(0x0d0d0d, 40, 0x222222);
                const cbShell = phong(0x171717, 28, 0x1f1f1f);
                const cbMetal = phong(0x303030, 72, 0x565656);
                const cbString = phong(0x252525, 5, 0x111111);
                const cbBolt = phong(0x3a3a3a, 64, 0x666666);
                addBox([.06, .078, .4], cbBlack, [0, -.01, -.12]);
                addBox([.054, .042, .2], cbShell, [0, .04, -.2]);
                addBox([.058, .14, .08], cbBlack, [0, -.1, -.02], [-.35, 0, 0]);
                addBox([.052, .1, .12], cbShell, [0, -.09, .14], [-.2, 0, 0]);
                addBox([.085, .095, .2], cbBlack, [0, 0, .04]);
                addBox([.066, .05, .3], cbShell, [0, .026, .08]);
                addBox([.038, .022, .74], cbMetal, [0, .034, .12]);
                addBox([.05, .04, .4], cbShell, [0, .02, .15]);
                addRail(.25, [0, .075, .05]);
                addBox([.07, .03, .05], cbMetal, [0, .02, .32]);
                // Bow mechanism
                add(new THREE.TorusGeometry(.055, .01, 10, 16), cbMetal, [0, -.02, .48], [Math.PI / 2, 0, 0]);
                // Limbs
                addBox([.28, .025, .035], cbShell, [.16, .03, .36], [0, 0, .45]);
                addBox([.28, .025, .035], cbShell, [-.16, .03, .36], [0, 0, -.45]);
                // Cams
                addCyl(.02, .02, .02, 12, cbMetal, [.32, .03, .38], [0, 0, Math.PI / 2]);
                addCyl(.02, .02, .02, 12, cbMetal, [-.32, .03, .38], [0, 0, Math.PI / 2]);
                // Strings
                addCyl(.004, .004, .38, 6, cbString, [.16, .03, .2], [1.0, -.4, 0]);
                addCyl(.004, .004, .38, 6, cbString, [-.16, .03, .2], [1.0, .4, 0]);
                addBox([.006, .006, .12], cbString, [0, .03, .08]);
                addCyl(.008, .008, .5, 6, cbBolt, [0, .045, .15], [Math.PI / 2, 0, 0]);
                add(new THREE.ConeGeometry(.012, .08, 6), cbMetal, [0, .045, .44], [Math.PI / 2, 0, 0]);
                addBox([.02, .004, .04], cbBlack, [.012, .045, -.065], [0, 0, .4]);
                addBox([.02, .004, .04], cbBlack, [-.012, .045, -.065], [0, 0, -.4]);
                addScope(.22, [0, .095, .04], 0x0a0a0a);
            };

            if (wdef.cat === 'pistol') {
                if (wdef.id === 'dual_smg') {
                    const makeSmg = (ox) => {
                        addBox([.045, .085, .24], mat, [ox, 0, .02]);
                        addBox([.038, .035, .18], matSoft, [ox, .05, .05]);
                        addBox([.032, .11, .06], gripMat, [ox, -.09, .01], [-.24, 0, 0]);
                        addBox([.03, .11, .05], blackMat, [ox, -.1, -.055], [.1, 0, 0]);
                        addBox([.018, .016, .12], metalMat, [ox, .018, .205]);
                        addRail(.12, [ox, .08, .035]);
                        addBox([.008, .03, .014], metalMat, [ox, -.03, .07], [.5, 0, 0]);
                    };
                    makeSmg(-.065);
                    makeSmg(.065);
                } else if (wdef.id === 'hand_cannon') {
                    addPistolBase({ bodyW: .08, bodyH: .14, bodyL: .3, slideL: .26, barrelR: .024, barrelL: .24, barrelZ: .25 });
                    addBox([.078, .03, .16], matSoft, [0, .08, .04]);
                    addBox([.07, .16, .09], woodMat, [0, -.125, 0], [-.24, 0, 0]);
                    addBox([.024, .05, .05], blackMat, [0, -.01, .14]);
                    addBox([.025, .03, .045], steelMat, [0, .065, .2]);
                } else {
                    addPistolBase();
                    addBox([.035, .09, .05], blackMat, [0, -.1, -.04], [.08, 0, 0]);
                    addBox([.05, .02, .06], matSoft, [0, -.01, -.02]);
                }
            } else if (wdef.cat === 'rifle') {
                if (wdef.id === 'p90' || wdef.id === 'vector') {
                    addBox([.075, .11, .4], mat, [0, 0, .04]);
                    addBox([.05, .05, .2], matSoft, [0, .045, .02]);
                    addBox([.078, .03, .32], blackMat, [0, .022, .05]);
                    addBox([.04, .13, .07], gripMat, [0, -.095, .09], [-.24, 0, 0]);
                    addBox([.08, .05, .16], blackMat, [0, .02, -.11]);
                    addBox([.048, .055, .18], matDark, [0, -.015, .15]);
                    addBox([.032, .018, .34], blackMat, [0, .085, .06]);
                    addCyl(.016, .016, .22, 10, metalMat, [0, .03, .31], [Math.PI / 2, 0, 0]);
                    addBox([.03, .03, .045], steelMat, [0, .03, .43]);
                    addBox([.04, .08, .1], matDark, [0, -.03, -.22]);
                } else if (wdef.id === 'nail_gun') {
                    addBox([.082, .12, .38], mat, [0, 0, .03]);
                    addBox([.058, .06, .2], matSoft, [0, .04, .07]);
                    addBox([.08, .03, .24], blackMat, [0, .02, .08]);
                    addBox([.045, .16, .055], new THREE.MeshLambertMaterial({ color: 0x2f3440 }), [0, -.13, .04]);
                    addBox([.04, .1, .07], gripMat, [0, -.1, .09], [-.26, 0, 0]);
                    addBox([.02, .02, .26], metalMat, [0, .025, .29]);
                    addBox([.072, .01, .025], blackMat, [0, .055, .07]);
                    addBox([.072, .01, .025], blackMat, [0, .055, .13]);
                    addBox([.072, .01, .025], blackMat, [0, .055, .19]);
                    addRail(.16, [0, .09, -.02]);
                } else {
                    addRifleBase();
                    if (wdef.id === 'scar' || wdef.id === 'burst') addScope(.16, [0, .108, .04], 0x151515);
                    else addBox([.018, .045, .02], steelMat, [0, .1, -.02]);
                    addBox([.018, .025, .05], blackMat, [0, -.005, .25]);
                    addBox([.016, .016, .18], metalMat, [.038, -.005, .26]);
                    addBox([.016, .016, .18], metalMat, [-.038, -.005, .26]);
                }
            } else if (wdef.cat === 'sniper') {
                if (wdef.id === 'crossbow') {
                    addCrossbow();
                } else {
                    addBox([.082, .105, .76], mat, [0, 0, .08]);
                    addBox([.055, .05, .3], matSoft, [0, .045, .02]);
                    addBox([.086, .034, .58], blackMat, [0, .03, .1]);
                    addBox([.06, .09, .3], matDark, [0, -.02, -.43]);
                    addBox([.05, .035, .17], blackMat, [0, .055, -.34]);
                    addBox([.05, .11, .075], gripMat, [0, -.1, .08], [-.26, 0, 0]);
                    addCyl(.015, .015, .56, 10, metalMat, [0, .03, .63], [Math.PI / 2, 0, 0]);
                    addMuzzle(.93, .022, .09);
                    addScope(.34, [0, .11, .13], 0x0d0d0d);
                    addRail(.24, [0, .083, .13]);
                    addBox([.006, .12, .006], steelMat, [.055, -.05, .42], [.3, 0, .28]);
                    addBox([.006, .12, .006], steelMat, [-.055, -.05, .42], [.3, 0, -.28]);
                }
            } else if (wdef.cat === 'shotgun') {
                if (wdef.id === 'double_barrel') {
                    addBox([.095, .1, .3], mat, [0, 0, -.02]);
                    addBox([.1, .03, .18], blackMat, [0, .022, -.02]);
                    addCyl(.022, .022, .44, 10, steelMat, [.028, .035, .27], [Math.PI / 2, 0, 0]);
                    addCyl(.022, .022, .44, 10, steelMat, [-.028, .035, .27], [Math.PI / 2, 0, 0]);
                    addBox([.07, .09, .28], woodMat, [0, -.01, -.27]);
                    addBox([.04, .025, .16], woodMat, [0, -.02, .14]);
                    addBox([.018, .045, .02], steelMat, [0, .08, -.08]);
                } else if (wdef.id === 'tactical_sg') {
                    addRifleBase({ bodyL: .54, handguardL: .22, handguardZ: .23, barrelR: .028, barrelL: .34, barrelZ: .44, stockL: .22, stockZ: -.33, magZ: .04, railL: .28, railZ: .1, muzzleZ: .62, muzzleR: .03 });
                    addScope(.14, [0, .105, .08], 0x131313);
                    addBox([.05, .12, .08], blackMat, [0, -.11, .05], [.06, 0, 0]);
                } else {
                    addBox([.094, .11, .36], mat, [0, 0, .04]);
                    addBox([.09, .03, .22], blackMat, [0, .025, .08]);
                    addCyl(.03, .03, .34, 10, steelMat, [0, .035, .41], [Math.PI / 2, 0, 0]);
                    addBox([.05, .035, .18], woodMat, [0, -.015, .23]);
                    addBox([.068, .09, .28], woodMat, [0, -.015, -.26]);
                    addBox([.04, .1, .07], gripMat, [0, -.1, -.01], [-.26, 0, 0]);
                    addBox([.012, .02, .42], metalMat, [0, -.005, .26]);
                    addBox([.018, .045, .02], steelMat, [0, .08, -.04]);
                }
            } else if (wdef.cat === 'melee') {
                if (wdef.id === 'knife') {
                    addBox([.025, .012, .32], steelMat, [0, 0, .02]);
                    addBox([.004, .006, .28], new THREE.MeshLambertMaterial({ color: 0xffffff }), [.012, 0, .05]);
                    addBox([.05, .02, .02], blackMat, [0, 0, -.12]);
                    addBox([.03, .035, .13], gripMat, [0, 0, -.22]);
                    addBox([.032, .037, .09], new THREE.MeshLambertMaterial({ color: 0x31313b }), [0, 0, -.22]);
                } else if (wdef.id === 'sword') {
                    addBox([.026, .012, .58], steelMat, [0, 0, .06]);
                    addBox([.005, .007, .48], new THREE.MeshLambertMaterial({ color: 0xf0f4ff }), [.012, 0, .1]);
                    addBox([.15, .04, .04], new THREE.MeshLambertMaterial({ color: 0xaa8833 }), [0, 0, -.19]);
                    addBox([.028, .028, .19], gripMat, [0, 0, -.31]);
                    add(new THREE.SphereGeometry(.032, 8, 8), new THREE.MeshLambertMaterial({ color: 0xaa8833 }), [0, 0, -.42]);
                } else if (wdef.id === 'energy_blade') {
                    addBox([.032, .016, .62], new THREE.MeshLambertMaterial({ color: 0x0099ff, emissive: new THREE.Color(0x0099ff), emissiveIntensity: 1.2 }), [0, 0, .08]);
                    addBox([.014, .007, .58], new THREE.MeshLambertMaterial({ color: 0x88ddff, emissive: new THREE.Color(0x88ddff), emissiveIntensity: 2 }), [0, 0, .08]);
                    addBox([.14, .04, .04], mat, [0, 0, -.18]);
                    addBox([.03, .03, .18], blackMat, [0, 0, -.3]);
                } else if (wdef.id === 'rapid_knife') {
                    addBox([.02, .008, .24], steelMat, [0, 0, .04]);
                    addBox([.025, .025, .11], gripMat, [0, 0, -.14]);
                    addBox([.03, .03, .09], blackMat, [0, 0, -.16]);
                } else if (wdef.id === 'chainsaw') {
                    addBox([.085, .11, .32], mat, [0, 0, -.02]);
                    addBox([.038, .065, .42], metalMat, [0, .05, .23]);
                    addBox([.042, .012, .4], steelMat, [0, .08, .23]);
                    addCyl(.042, .042, .12, 10, woodMat, [0, 0, -.16], [0, 0, Math.PI / 2]);
                    addBox([.04, .1, .08], gripMat, [0, -.08, -.05], [-.26, 0, 0]);
                    addBox([.06, .025, .08], blackMat, [0, .08, -.02], [0, 0, .45]);
                } else if (wdef.id === 'spear') {
                    addBox([.026, .026, .72], woodMat, [0, 0, .03]);
                    add(new THREE.ConeGeometry(.028, .2, 6), steelMat, [0, 0, .49], [Math.PI / 2, 0, 0]);
                    addBox([.09, .02, .035], new THREE.MeshLambertMaterial({ color: 0xaa8833 }), [0, 0, .31]);
                    addBox([.03, .03, .12], gripMat, [0, 0, -.25]);
                } else if (wdef.id === 'nunchucks') {
                    addCyl(.016, .016, .22, 10, woodMat, [.065, 0, .05], [Math.PI / 2, 0, 0]);
                    addCyl(.016, .016, .22, 10, woodMat, [-.065, 0, .05], [Math.PI / 2, 0, 0]);
                    addBox([.003, .003, .09], steelMat, [0, 0, .05]);
                    addBox([.018, .018, .06], blackMat, [.065, 0, .05]);
                    addBox([.018, .018, .06], blackMat, [-.065, 0, .05]);
                } else {
                    addBox([.2, .2, .14], mat, [0, 0, .23]);
                    addBox([.14, .04, .04], metalMat, [0, 0, .13]);
                    addBox([.04, .04, .56], matDark, [0, 0, -.02]);
                    addBox([.05, .05, .16], gripMat, [0, 0, -.33]);
                }
            } else {
                if (wdef.id === 'rocket' || wdef.id === 'grenade_l') {
                    addCyl(.055, .055, .72, 12, mat, [0, .015, .05], [Math.PI / 2, 0, 0]);
                    addBox([.05, .14, .08], gripMat, [0, -.085, -.05], [-.26, 0, 0]);
                    addBox([.16, .03, .12], blackMat, [0, -.065, .2]);
                    addBox([.04, .02, .18], blackMat, [0, .055, -.05]);
                    addBox([.05, .05, .1], steelMat, [0, .02, .36]);
                } else if (wdef.id === 'flamethrower') {
                    addBox([.1, .1, .42], mat, [0, 0, .04]);
                    addCyl(.06, .03, .28, 10, new THREE.MeshLambertMaterial({ color: 0xcc4400 }), [0, .03, .36], [Math.PI / 2, 0, 0]);
                    addCyl(.05, .05, .3, 10, metalMat, [0, -.08, -.1], [Math.PI / 2, 0, 0]);
                    addBox([.04, .1, .07], gripMat, [0, -.095, .07], [-.26, 0, 0]);
                    addBox([.018, .018, .2], blackMat, [.04, -.03, .1], [.45, 0, 0]);
                } else if (wdef.id === 'charge_rifle') {
                    addBox([.075, .09, .62], mat, [0, 0, .05]);
                    addCyl(.02, .02, .42, 10, new THREE.MeshLambertMaterial({ color: 0x002244 }), [0, .03, .5], [Math.PI / 2, 0, 0]);
                    add(new THREE.TorusGeometry(.05, .012, 6, 12), new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: new THREE.Color(0xffaa00), emissiveIntensity: .5 }), [0, .02, .1], [0, Math.PI / 2, 0]);
                    add(new THREE.TorusGeometry(.042, .01, 6, 12), new THREE.MeshLambertMaterial({ color: 0xffdd77, emissive: new THREE.Color(0xffdd77), emissiveIntensity: .6 }), [0, .02, -.02], [0, Math.PI / 2, 0]);
                    addBox([.04, .1, .07], gripMat, [0, -.1, .03], [-.24, 0, 0]);
                } else if (wdef.id === 'laser_beam') {
                    addBox([.065, .085, .52], mat, [0, 0, .04]);
                    addCyl(.018, .03, .22, 10, new THREE.MeshLambertMaterial({ color: 0xff0044, emissive: new THREE.Color(0xff0044), emissiveIntensity: .8 }), [0, .02, .39], [Math.PI / 2, 0, 0]);
                    addRail(.24, [0, .08, .05]);
                    addBox([.04, .1, .07], gripMat, [0, -.095, .03], [-.24, 0, 0]);
                } else if (wdef.id === 'freeze_ray') {
                    addBox([.07, .09, .5], mat, [0, 0, .04]);
                    addCyl(.022, .032, .2, 10, new THREE.MeshLambertMaterial({ color: 0x44aaff, emissive: new THREE.Color(0x44aaff), emissiveIntensity: .6 }), [0, .02, .36], [Math.PI / 2, 0, 0]);
                    addCyl(.03, .03, .16, 10, metalMat, [0, -.055, -.03], [Math.PI / 2, 0, 0]);
                    addBox([.04, .1, .07], gripMat, [0, -.095, .03], [-.24, 0, 0]);
                } else if (wdef.id === 'bouncer') {
                    addBox([.09, .1, .5], mat, [0, 0, .04]);
                    addBox([.06, .06, .25], matDark, [0, .03, .38]);
                    add(new THREE.SphereGeometry(.04, 8, 8), new THREE.MeshLambertMaterial({ color: 0xff8800, emissive: new THREE.Color(0xff4400), emissiveIntensity: .5 }), [0, .03, .57]);
                    addBox([.05, .12, .08], gripMat, [0, -.1, .03], [-.24, 0, 0]);
                } else if (wdef.id === 'void_rifle') {
                    addBox([.07, .09, .56], mat, [0, 0, .05]);
                    addCyl(.018, .022, .4, 10, new THREE.MeshLambertMaterial({ color: 0x440088, emissive: new THREE.Color(0x440088), emissiveIntensity: .8 }), [0, .03, .48], [Math.PI / 2, 0, 0]);
                    add(new THREE.SphereGeometry(.03, 8, 8), new THREE.MeshLambertMaterial({ color: 0xaa44ff, emissive: new THREE.Color(0x8800ff), emissiveIntensity: 1.5 }), [0, .03, .69]);
                    addScope(.18, [0, .095, .1], 0x110022);
                    addBox([.04, .1, .07], gripMat, [0, -.1, .02], [-.24, 0, 0]);
                } else if (wdef.id === 'thunder') {
                    addBox([.08, .1, .54], mat, [0, 0, .04]);
                    addCyl(.015, .025, .36, 8, new THREE.MeshLambertMaterial({ color: 0xffff00, emissive: new THREE.Color(0xffcc00), emissiveIntensity: .7 }), [0, .03, .45], [Math.PI / 2, 0, 0]);
                    add(new THREE.TorusGeometry(.04, .008, 4, 8), new THREE.MeshLambertMaterial({ color: 0xffff44, emissive: new THREE.Color(0xffff00), emissiveIntensity: 1 }), [0, .02, .16], [0, Math.PI / 2, 0]);
                    add(new THREE.TorusGeometry(.04, .008, 4, 8), new THREE.MeshLambertMaterial({ color: 0xffff44, emissive: new THREE.Color(0xffff00), emissiveIntensity: 1 }), [0, .02, -.02], [0, Math.PI / 2, 0]);
                    addBox([.04, .1, .07], gripMat, [0, -.1, .02], [-.24, 0, 0]);
                } else if (wdef.id === 'gravity_gun') {
                    addBox([.09, .1, .52], mat, [0, 0, .04]);
                    addCyl(.04, .06, .3, 8, new THREE.MeshLambertMaterial({ color: 0x6633aa, emissive: new THREE.Color(0x440088), emissiveIntensity: .9 }), [0, .02, .39], [Math.PI / 2, 0, 0]);
                    add(new THREE.TorusGeometry(.06, .01, 6, 16), new THREE.MeshLambertMaterial({ color: 0x8844ff, emissive: new THREE.Color(0x6622ff), emissiveIntensity: 1 }), [0, .02, .58], [0, Math.PI / 2, 0]);
                    addBox([.05, .12, .08], gripMat, [0, -.1, .03], [-.24, 0, 0]);
                } else if (wdef.id === 'crossbow') {
                    addCrossbow();
                } else if (wdef.id === 'tesla') {
                    addBox([.07, .09, .46], mat, [0, 0, .03]);
                    add(new THREE.SphereGeometry(.04, 8, 8), new THREE.MeshLambertMaterial({ color: 0x00ffff, emissive: new THREE.Color(0x00ffff), emissiveIntensity: 1 }), [0, .03, .31]);
                    add(new THREE.TorusGeometry(.035, .006, 4, 12), new THREE.MeshLambertMaterial({ color: 0x44ffff, emissive: new THREE.Color(0x00ddff), emissiveIntensity: .8 }), [0, .03, .31], [0, Math.PI / 2, 0]);
                    addBox([.04, .1, .07], gripMat, [0, -.1, -.02], [-.24, 0, 0]);
                } else if (wdef.id === 'acid_launcher') {
                    addBox([.08, .1, .5], mat, [0, 0, .04]);
                    addCyl(.04, .04, .3, 8, new THREE.MeshLambertMaterial({ color: 0x224400 }), [0, .02, .38], [Math.PI / 2, 0, 0]);
                    addCyl(.04, .04, .25, 8, new THREE.MeshLambertMaterial({ color: 0x44ff00, emissive: new THREE.Color(0x22aa00), emissiveIntensity: .5 }), [0, -.07, -.05], [Math.PI / 2, 0, 0]);
                    addBox([.04, .1, .07], gripMat, [0, -.1, .03], [-.24, 0, 0]);
                } else if (wdef.id === 'anti_mat') {
                    addBox([.09, .12, .78], mat, [0, 0, .08]);
                    addCyl(.022, .022, .58, 10, metalMat, [0, .04, .68], [Math.PI / 2, 0, 0]);
                    addCyl(.035, .025, .12, 10, blackMat, [0, .04, .98], [Math.PI / 2, 0, 0]);
                    addScope(.34, [0, .125, .16], 0x101010);
                    addBox([.006, .14, .006], steelMat, [.06, -.03, .42], [.4, 0, .32]);
                    addBox([.006, .14, .006], steelMat, [-.06, -.03, .42], [.4, 0, -.32]);
                    addBox([.055, .09, .28], matDark, [0, -.02, -.47]);
                    addBox([.05, .11, .075], gripMat, [0, -.1, .06], [-.26, 0, 0]);
                } else {
                    addRifleBase({ bodyL: .56, bodyZ: .04, handguardL: .2, handguardZ: .23, barrelR: .024, barrelL: .36, barrelZ: .45, stockL: .22, stockZ: -.3, railL: .2, railZ: .08, muzzleZ: .64, muzzleR: .026 });
                    addBox([.07, .07, .15], new THREE.MeshLambertMaterial({ color: new THREE.Color(c).multiplyScalar(1.5) }), [0, 0, .09]);
                }
            }

            return g;
        }

        // ============================================================
        // MAP BUILDER
        // ============================================================
        let mapObstacles = [];
        let mapObstacleMeshes = [];
        let mapCityMeshes = [];
        let mapDef = null;

        function getRaycastTargets() {
            return mapCityMeshes.length ? mapObstacleMeshes.concat(mapCityMeshes) : mapObstacleMeshes;
        }

        function buildMap(mdef) {
            mapObstacles = [];
            mapObstacleMeshes = [];
            mapCityMeshes.length = 0;
            mapDef = mdef;
            if (typeof HuntersGL !== 'undefined') HuntersGL.removeCity(scene);

            // Clear old map objects
            const toRemove = [];
            scene.traverse(o => { if (o.userData.isMap) toRemove.push(o); });
            toRemove.forEach(o => scene.remove(o));

            // Sky / fog
            scene.background = new THREE.Color(mdef.fog[0]);
            scene.fog = new THREE.FogExp2(mdef.fog[0], mdef.fog[1]);

            // Lighting
            scene.children.filter(c => c.isLight).forEach(l => scene.remove(l));
            const amb = new THREE.AmbientLight(mdef.ambient, 1.5);
            scene.add(amb);
            const sun = new THREE.DirectionalLight(0xffffff, .8);
            sun.position.set(10, 20, 10);
            sun.castShadow = true;
            sun.shadow.mapSize.width = 1024; sun.shadow.mapSize.height = 1024;
            sun.shadow.camera.near = .1; sun.shadow.camera.far = 100;
            sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
            sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
            scene.add(sun);
            // Accent point light
            const accent = new THREE.PointLight(mdef.accent, 2, 20);
            accent.position.set(0, 8, 0);
            scene.add(accent);

            const bounds = mdef.bounds;

            // Floor
            const floorGeo = new THREE.PlaneGeometry(bounds * 2, bounds * 2, 20, 20);
            const floorMat = new THREE.MeshLambertMaterial({ color: mdef.floor });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            floor.userData.isMap = true;
            floor.userData.isFloor = true;
            scene.add(floor);

            if (typeof HuntersGL !== 'undefined') HuntersGL.applyCityForMap(mdef, scene, mapCityMeshes, floor);

            // Outer walls (invisible collision bounds - just use bounds check in code)
            // Visible border walls
            const wallMat = new THREE.MeshLambertMaterial({ color: mdef.wall });
            const wallH = 4, wallT = 1;
            [
                [0, bounds + wallT / 2, bounds * 2 + wallT * 2, wallT],
                [0, -(bounds + wallT / 2), bounds * 2 + wallT * 2, wallT],
                [bounds + wallT / 2, 0, wallT, bounds * 2],
                [-(bounds + wallT / 2), 0, wallT, bounds * 2],
            ].forEach(([x, z, w, d]) => {
                const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
                m.position.set(x, wallH / 2, z);
                m.receiveShadow = true; m.castShadow = true;
                m.userData.isMap = true;
                scene.add(m);
                // Add to obstacles
                const box = new THREE.Box3();
                box.setFromCenterAndSize(new THREE.Vector3(x, wallH / 2, z), new THREE.Vector3(w, wallH, d));
                mapObstacles.push(box);
                mapObstacleMeshes.push(m);
            });

            // Obstacles
            mdef.obstacles.forEach(obs => {
                const mat = new THREE.MeshLambertMaterial({ color: obs.c || mdef.wall });
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(obs.w, obs.h, obs.d), mat);
                mesh.position.set(obs.x, obs.h / 2, obs.z);
                mesh.castShadow = true; mesh.receiveShadow = true;
                mesh.userData.isMap = true;
                scene.add(mesh);
                mapObstacleMeshes.push(mesh);
                const box = new THREE.Box3();
                box.setFromCenterAndSize(new THREE.Vector3(obs.x, obs.h / 2, obs.z), new THREE.Vector3(obs.w, obs.h, obs.d));
                mapObstacles.push(box);
            });

            // Special map lighting
            if (mdef.id === 'neon') {
                [[0xff00ff, [-8, -8]], [0x00ffff, [8, -8]], [0xff0088, [-8, 8]], [0x0088ff, [8, 8]]].forEach(([col, [x, z]]) => {
                    const l = new THREE.PointLight(col, 1.5, 15);
                    l.position.set(x, 3, z);
                    l.userData.isMap = true;
                    scene.add(l);
                });
            }
            if (mdef.id === 'space') {
                [[0x0088ff, [-6, -6]], [0x0044ff, [6, 6]], [0x0066ff, [-6, 6]], [0x00aaff, [6, -6]]].forEach(([col, [x, z]]) => {
                    const l = new THREE.PointLight(col, 1.2, 12);
                    l.position.set(x, 2, z);
                    l.userData.isMap = true;
                    scene.add(l);
                });
            }
            if (mdef.id === 'ice') {
                const iceLight = new THREE.PointLight(0x88ddff, 1.5, 30);
                iceLight.position.set(0, 8, 0);
                iceLight.userData.isMap = true;
                scene.add(iceLight);
            }
            if (mdef.id === 'temple') {
                [[0xffcc44, [-8, -8]], [0xff8800, [8, 8]], [0xffcc44, [-8, 8]], [0xff8800, [8, -8]]].forEach(([col, [x, z]]) => {
                    const l = new THREE.PointLight(col, 1.3, 12);
                    l.position.set(x, 3, z);
                    l.userData.isMap = true;
                    scene.add(l);
                });
            }
            if (mdef.id === 'bunker') {
                [[-5, -8], [5, -8], [-5, 8], [5, 8], [0, 0]].forEach(([x, z]) => {
                    const l = new THREE.PointLight(0x88ff44, .8, 8);
                    l.position.set(x, 2.5, z);
                    l.userData.isMap = true;
                    scene.add(l);
                });
            }
        }

        function collidesWithObstacle(x, z, radius) {
            const testBox = new THREE.Box3(
                new THREE.Vector3(x - radius, -1, z - radius),
                new THREE.Vector3(x + radius, 3, z + radius)
            );
            for (const obs of mapObstacles) {
                if (obs.intersectsBox(testBox)) return true;
            }
            return false;
        }

        function clampToBounds(x, z, r) {
            const b = mapDef ? mapDef.bounds - r : 13;
            return { x: Math.max(-b, Math.min(b, x)), z: Math.max(-b, Math.min(b, z)) };
        }

        // ============================================================
        // BOT CLASS
        // ============================================================
        const BOT_RADIUS = .4;
        const BOT_HEIGHT = 1.8;
        const BOT_EYE = 1.6;

        class Bot {
            constructor(pos, diff, index) {
                this.pos = pos.clone();
                this.diff = diff;
                this.maxHp = diff.hp;
                this.hp = this.maxHp;
                this.speed = diff.speed;
                this.yaw = Math.random() * Math.PI * 2;
                this.state = 'patrol';
                this.shootTimer = diff.react + Math.random() * .5;
                this.patrolTimer = 2 + Math.random() * 2;
                this.patrolTarget = null;
                this.steerAngle = 0;
                this.steerTimer = 0;
                this.strafeDir = Math.random() > .5 ? 1 : -1;
                this.strafeTimer = .8 + Math.random() * 1.1;
                this.hoverPhase = Math.random() * Math.PI * 2;
                this.hitFlash = 0;
                this.alive = true;
                this.index = index;
                this.colors = [0xff4444, 0x44aaff, 0x44ff44, 0xffaa00, 0xff44ff, 0x44ffff];
                this.color = this.colors[index % this.colors.length];
                this.statusEffects = {};
                // Assign a random weapon (ranged only, not melee, not legendary)
                const botWeps = WDEFS.filter(w => w.cat !== 'melee' && w.price <= 4200);
                this.weapon = botWeps[Math.floor(Math.random() * botWeps.length)];
                this.buildMesh();
            }

            buildMesh() {
                this.group = new THREE.Group();
                this.useGLTF = false;
                this.gltfMixer = null;
                this.idleAction = null;
                this.runAction = null;

                const gltfBot = (typeof HuntersGL !== 'undefined' && HuntersGL.xbot && typeof SkeletonUtils !== 'undefined')
                    ? HuntersGL.cloneXbotBot(this.color)
                    : null;

                if (gltfBot) {
                    this.useGLTF = true;
                    this.group.add(gltfBot.root);
                    this.gltfMixer = gltfBot.mixer;
                    this.idleAction = gltfBot.idleAction;
                    this.runAction = gltfBot.runAction;
                    this.bodyMesh = null;
                    this.headMesh = null;
                    this.lArm = this.rArm = this.lLeg = this.rLeg = null;
                } else {
                    const bodyMat = new THREE.MeshLambertMaterial({ color: this.color });
                    const headMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.color).multiplyScalar(1.4) });
                    const body = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.1, .35), bodyMat);
                    body.position.y = .55;
                    const head = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .4), headMat);
                    head.position.y = 1.3;
                    const armMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.color).multiplyScalar(.7) });
                    const lArm = new THREE.Mesh(new THREE.BoxGeometry(.2, .7, .2), armMat);
                    lArm.position.set(-.45, .5, 0);
                    const rArm = new THREE.Mesh(new THREE.BoxGeometry(.2, .7, .2), armMat);
                    rArm.position.set(.45, .5, 0);
                    const legMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.color).multiplyScalar(.5) });
                    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(.25, .8, .25), legMat);
                    lLeg.position.set(-.2, -.4, 0);
                    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(.25, .8, .25), legMat);
                    rLeg.position.set(.2, -.4, 0);

                    this.group.add(body, head, lArm, rArm, lLeg, rLeg);
                    this.bodyMesh = body;
                    this.headMesh = head;
                    this.lArm = lArm;
                    this.rArm = rArm;
                    this.lLeg = lLeg;
                    this.rLeg = rLeg;
                }

                this.group.position.copy(this.pos);
                this.group.castShadow = true;
                scene.add(this.group);

                // Health bar (sprite)
                const canvas = document.createElement('canvas');
                canvas.width = 128; canvas.height = 24;
                this.hbCanvas = canvas;
                this.hbCtx = canvas.getContext('2d');
                this.hbTex = new THREE.CanvasTexture(canvas);
                const hbMat = new THREE.SpriteMaterial({ map: this.hbTex, transparent: true, depthTest: false });
                this.hbSprite = new THREE.Sprite(hbMat);
                this.hbSprite.scale.set(1.5, .3, 1);
                this.hbSprite.position.y = 2.2;
                this.group.add(this.hbSprite);
                this.updateHBar();

                // Weapon prop (colored by bot's weapon)
                const wepGeo = new THREE.BoxGeometry(.06, .06, .4);
                const wepColor = this.weapon ? this.weapon.color : 0x555555;
                const wepMat = new THREE.MeshLambertMaterial({ color: wepColor });
                this.wepMesh = new THREE.Mesh(wepGeo, wepMat);
                this.wepMesh.position.set(.3, .6, .2);
                this.wepMesh.rotation.x = -.15;
                this.group.add(this.wepMesh);
            }

            updateHBar() {
                const ctx = this.hbCtx; const cv = this.hbCanvas;
                ctx.clearRect(0, 0, cv.width, cv.height);
                ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(2, 2, cv.width - 4, cv.height - 4);
                const pct = Math.max(0, this.hp / this.maxHp);
                const col = pct > .6 ? '#44ff66' : pct > .3 ? '#ffcc00' : '#ff3333';
                ctx.fillStyle = col; ctx.fillRect(3, 3, Math.round((cv.width - 6) * pct), cv.height - 6);
                this.hbTex.needsUpdate = true;
            }

            update(dt, playerPos, playerBox) {
                if (!this.alive) return;
                const toPlayer = new THREE.Vector3().subVectors(playerPos, this.pos);
                toPlayer.y = 0;
                const dist = toPlayer.length();

                // State transitions
                if (dist < this.diff.aggroRange) this.state = 'chase';
                else if (this.state === 'chase' && dist > this.diff.aggroRange * 1.3) this.state = 'patrol';

                if (dist < (this.diff.aggroRange * .6)) this.state = 'attack';
                else if (this.state === 'attack' && dist > this.diff.aggroRange * .9) this.state = 'chase';

                // Face direction
                if (this.state !== 'patrol') {
                    const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
                    this.yaw = lerp(this.yaw, targetYaw, .08);
                }

                // Movement
                let moved = false;
                if (this.state === 'chase' || this.state === 'patrol') {
                    let moveDir;
                    if (this.state === 'patrol') {
                        this.patrolTimer -= dt;
                        if (!this.patrolTarget || this.patrolTimer <= 0) {
                            const b = mapDef ? mapDef.bounds - 2 : 12;
                            this.patrolTarget = new THREE.Vector3((Math.random() - .5) * b * 2, 0, (Math.random() - .5) * b * 2);
                            this.patrolTimer = 3 + Math.random() * 3;
                        }
                        moveDir = new THREE.Vector3().subVectors(this.patrolTarget, this.pos);
                        moveDir.y = 0;
                        if (moveDir.length() < 1) this.patrolTarget = null;
                        else moveDir.normalize();
                    } else {
                        moveDir = toPlayer.clone().normalize();
                        if (this.state === 'attack') {
                            this.strafeTimer -= dt;
                            if (this.strafeTimer <= 0) {
                                this.strafeDir *= -1;
                                this.strafeTimer = .45 + Math.random() * .6;
                            }
                            const strafe = new THREE.Vector3(moveDir.z, 0, -moveDir.x).multiplyScalar(this.strafeDir * .7 * (this.diff.strafe || 1));
                            const forwardBias = dist > 8 ? .35 : dist < 4 ? -.2 : 0;
                            moveDir.multiplyScalar(forwardBias).add(strafe).normalize();
                        }
                    }

                    // Obstacle avoidance (slow penalty from status effects)
                    const slowMult = this.statusEffects.slow ? .35 : 1;
                    const spd = (this.state === 'patrol' ? this.speed * .5 : this.speed) * slowMult;
                    const step = spd * dt;
                    this.steerTimer -= dt;

                    let moved = false;
                    const angles = [0, 20, -20, 40, -40, 70, -70, 110, -110, 160];
                    for (const ang of angles) {
                        const rad = ang * Math.PI / 180;
                        const dir = moveDir.clone();
                        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rad + this.steerAngle);
                        const nx = this.pos.x + dir.x * step;
                        const nz = this.pos.z + dir.z * step;
                        if (!collidesWithObstacle(nx, nz, BOT_RADIUS)) {
                            const clamped = clampToBounds(nx, nz, BOT_RADIUS);
                            this.pos.x = clamped.x; this.pos.z = clamped.z;
                            this.yaw = Math.atan2(dir.x, dir.z);
                            if (ang !== 0 && this.steerTimer <= 0) {
                                this.steerAngle = ang * Math.PI / 180;
                                this.steerTimer = .5;
                            }
                            moved = true; break;
                        }
                    }
                    if (!moved && this.steerTimer <= 0) {
                        this.steerAngle = (Math.random() - .5) * Math.PI;
                        this.steerTimer = 1;
                    }
                }

                // Status effect processing
                if (this.statusEffects.burn) {
                    const b = this.statusEffects.burn;
                    b.timer -= dt; b.tick -= dt;
                    if (b.tick <= 0) {
                        b.tick = .5;
                        this.hp -= b.dmg;
                        this.updateHBar();
                        spawnImpact(this.group.position.clone().add(new THREE.Vector3(0, .8, 0)), 0xff5500);
                        if (this.hp <= 0) { this.die(); return; }
                    }
                    if (b.timer <= 0) delete this.statusEffects.burn;
                }
                if (this.statusEffects.slow) {
                    this.statusEffects.slow.timer -= dt;
                    if (this.statusEffects.slow.timer <= 0) delete this.statusEffects.slow;
                }
                if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 7);

                // Shooting
                this.shootTimer -= dt;
                if (this.shootTimer <= 0 && (this.state === 'attack' || this.state === 'chase')) {
                    this.shootTimer = Math.max(.04, this.diff.react + Math.random() * Math.max(.08, this.diff.react * 1.2));
                    this.tryShoot(playerPos, playerBox);
                }

                const t = Date.now() * .003 + this.hoverPhase;
                if (this.useGLTF && this.gltfMixer) {
                    let moving = this.state === 'chase' || this.state === 'attack';
                    if (this.state === 'patrol') {
                        moving = !!(this.patrolTarget && this.pos.distanceTo(this.patrolTarget) > 1.2);
                    }
                    const runTarget = moving ? 1 : 0;
                    const tw = 4 * dt;
                    if (this.idleAction) this.idleAction.weight = THREE.MathUtils.lerp(this.idleAction.weight || 1, 1 - runTarget, tw);
                    if (this.runAction) this.runAction.weight = THREE.MathUtils.lerp(this.runAction.weight || 0, runTarget, tw);
                    this.gltfMixer.update(dt);
                } else {
                    const moveAmt = this.state === 'attack' ? .35 : this.state === 'chase' ? 1 : .65;
                    this.group.position.y = Math.sin(t * 2.5) * .03;
                    this.bodyMesh.rotation.z = Math.sin(t * 3) * .04;
                    this.headMesh.rotation.y = Math.sin(t * 1.8) * .12;
                    this.lArm.rotation.x = Math.sin(t + Math.PI) * .3 * moveAmt - .1;
                    this.rArm.rotation.x = Math.sin(t) * .3 * moveAmt + .35;
                    this.lLeg.rotation.x = Math.sin(t) * .42 * moveAmt;
                    this.rLeg.rotation.x = Math.sin(t + Math.PI) * .42 * moveAmt;
                    this.wepMesh.rotation.z = Math.sin(t * 5) * .08;
                    this.wepMesh.rotation.x = -.18 + Math.sin(t * 2.2) * .04;
                    this.wepMesh.position.y = .6 + Math.sin(t * 4) * .02;
                    if (this.hitFlash > 0) this.headMesh.scale.setScalar(1 + this.hitFlash * .08);
                    else this.headMesh.scale.set(1, 1, 1);
                }

                this.group.position.copy(this.pos);
                this.group.position.y += Math.sin(t * 2.5) * .03;
                this.group.rotation.y = this.yaw;
                this.hbSprite.material.rotation = 0;
            }

            tryShoot(playerPos, playerBox) {
                // Miss chance based on accuracy (adjusted by bot's weapon accuracy too)
                const hitChance = this.diff.acc * (this.weapon ? (0.5 + this.weapon.acc * 0.5) : 1.0);
                if (Math.random() > hitChance) return;

                // Raytrace to player
                const from = new THREE.Vector3(this.pos.x, BOT_EYE, this.pos.z);
                const dir = new THREE.Vector3().subVectors(playerPos, from);
                const dist = dir.length();

                // Range check using bot's weapon range
                const wepRange = this.weapon ? this.weapon.range : 40;
                if (dist > wepRange) return;

                dir.normalize();

                // Check if line of sight is clear
                const ray = new THREE.Raycaster(from, dir);
                const hits = ray.intersectObjects(getRaycastTargets());
                if (hits.length > 0 && hits[0].distance < dist - .5) return;

                // Damage based on bot's weapon
                const baseDmg = this.weapon ? Math.round((this.weapon.dmg * (.52 + Math.random() * .18)) * (this.diff.dmgMult || 1)) : Math.round((18 + Math.random() * 12) * (this.diff.dmgMult || 1));
                G.playerTakeDamage(baseDmg);

                // Visual: tracer with weapon color
                const tracerColor = (this.weapon && this.weapon.laserColor) ? this.weapon.laserColor : this.color;
                spawnTracer(from, playerPos, tracerColor);
            }

            takeDamage(dmg, isHead) {
                if (!this.alive) return;
                this.hp -= dmg * (isHead ? 2 : 1);
                this.updateHBar();
                this.hitFlash = 1;
                this.group.traverse(c => {
                    if (!c.isMesh) return;
                    const mats = Array.isArray(c.material) ? c.material : [c.material];
                    mats.forEach(m => {
                        if (!m) return;
                        if (m.color) {
                            const old = m.color.clone();
                            m.color.set(0xffffff);
                            setTimeout(() => m.color.copy(old), 80);
                        } else if (m.emissive) {
                            const old = m.emissive.clone();
                            m.emissive.set(0xffffff);
                            setTimeout(() => m.emissive.copy(old), 80);
                        }
                    });
                });
                if (this.hp <= 0) this.die();
            }

            die() {
                this.alive = false;
                // Death animation - fall over
                const tween = (elapsed) => {
                    const t = Math.min(1, elapsed / 400);
                    this.group.rotation.z = t * (Math.PI / 2);
                    this.group.position.y = -t * .5;
                    if (t < 1) requestAnimationFrame(() => tween(elapsed + 16));
                    else setTimeout(() => scene.remove(this.group), 1500);
                };
                tween(0);
            }
        }

        function spawnTracer(from, to, color) {
            const dir = new THREE.Vector3().subVectors(to, from);
            const len = dir.length();
            const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(.5);
            const geo = new THREE.BoxGeometry(.02, .02, len);
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .6 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(mid);
            mesh.lookAt(to);
            scene.add(mesh);
            setTimeout(() => scene.remove(mesh), 100);
        }

        function lerp(a, b, t) { return a + (b - a) * t; }

        // ============================================================
        // SPECIAL WEAPON MECHANICS
        // ============================================================

        // Explosion AOE: damages all bots and player within radius, spawns particles
        function explosiveSplash(pos, radius, damage) {
            G.bots.forEach(bot => {
                if (!bot.alive) return;
                const d = pos.distanceTo(bot.group.position);
                if (d < radius) {
                    const falloff = 1 - (d / radius);
                    bot.takeDamage(Math.round(damage * falloff), false);
                    spawnImpact(bot.group.position.clone().add(new THREE.Vector3(0, .5, 0)), 0xff6600);
                }
            });
            // Player self-damage (reduced)
            const ppos = new THREE.Vector3(G.playerPos.x, G.EYE_HEIGHT, G.playerPos.z);
            const pd = pos.distanceTo(ppos);
            if (pd < radius) G.playerTakeDamage(Math.round(damage * .35 * (1 - pd / radius)));
            // Explosion particles
            for (let i = 0; i < 28; i++) {
                const v = new THREE.Vector3((Math.random() - .5) * 10, Math.random() * 8 + 1, (Math.random() - .5) * 10);
                particles.push(new Particle(pos.clone(), v, i < 14 ? 0xff6600 : 0xffcc00, .6 + Math.random() * .3, .08 + Math.random() * .05));
            }
            // Light flash
            const fl = new THREE.PointLight(0xff6600, 8, radius * 4);
            fl.position.copy(pos);
            scene.add(fl);
            setTimeout(() => scene.remove(fl), 220);
            G._shakeAmt = Math.max(G._shakeAmt || 0, .14);
            playExplosion();
        }

        // Apply status effect to a bot
        function applyStatus(bot, status, w) {
            if (!bot.alive) return;
            if (status === 'burn') {
                bot.statusEffects.burn = { timer: 3.0, dmg: Math.max(3, w.dmg * .35), tick: .5 };
            } else if (status === 'slow') {
                bot.statusEffects.slow = { timer: 2.5 };
                for (let i = 0; i < 5; i++) {
                    const v = new THREE.Vector3((Math.random() - .5) * 2.5, Math.random() * 2.5, (Math.random() - .5) * 2.5);
                    particles.push(new Particle(bot.group.position.clone(), v, 0x44aaff, .5, .06));
                }
            } else if (status === 'knockback') {
                const away = new THREE.Vector3().subVectors(bot.pos, G.playerPos);
                away.y = 0; away.normalize();
                bot.pos.addScaledVector(away, 5);
                const c = clampToBounds(bot.pos.x, bot.pos.z, BOT_RADIUS);
                bot.pos.x = c.x; bot.pos.z = c.z;
                for (let i = 0; i < 10; i++) {
                    const v = new THREE.Vector3((Math.random() - .5) * 6, Math.random() * 4, (Math.random() - .5) * 6);
                    particles.push(new Particle(bot.group.position.clone(), v, 0x6688ff, .4, .07));
                }
                G._shakeAmt = Math.max(G._shakeAmt || 0, .07);
            }
        }

        // Bouncing raycast projectile (reflects off walls up to w.bounce times)
        function fireBouncingRay(w, spread) {
            let pos = camera.position.clone();
            let dir = new THREE.Vector3((Math.random() - .5) * spread * 2, (Math.random() - .5) * spread * 2, -1);
            dir.normalize(); dir.applyQuaternion(camera.quaternion);
            const maxBounces = w.bounce || 2;
            const tracerPath = [pos.clone()];
            const col = w.laserColor || w.color || 0xffdd44;
            for (let b = 0; b <= maxBounces; b++) {
                const ray = new THREE.Raycaster(pos.clone(), dir.clone(), 0, w.range || 100);
                let closestBot = null, botDist = Infinity;
                G.bots.forEach(bot => {
                    if (!bot.alive) return;
                    const toBot = new THREE.Vector3().subVectors(bot.group.position, pos);
                    const proj = toBot.dot(dir);
                    if (proj < 0) return;
                    const closest = pos.clone().addScaledVector(dir, proj);
                    const bd = closest.distanceTo(new THREE.Vector3(bot.group.position.x, BOT_HEIGHT / 2, bot.group.position.z));
                    if (bd < BOT_RADIUS * 2 && proj < botDist) { botDist = proj; closestBot = bot; }
                });
                const wallHits = ray.intersectObjects(getRaycastTargets());
                const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;
                if (closestBot && botDist < wallDist) {
                    const hp = pos.clone().addScaledVector(dir, botDist);
                    tracerPath.push(hp);
                    G.hitBot(closestBot, w.dmg, false);
                    spawnImpact(hp, col);
                    break;
                } else if (wallHits.length > 0) {
                    const wp = wallHits[0].point.clone();
                    tracerPath.push(wp);
                    if (b < maxBounces) {
                        const nm = new THREE.Matrix3().getNormalMatrix(wallHits[0].object.matrixWorld);
                        const normal = wallHits[0].face.normal.clone().applyMatrix3(nm).normalize();
                        dir.reflect(normal).normalize();
                        pos = wp.clone().addScaledVector(dir, .05);
                        spawnImpact(wp, 0xffdd88);
                        playBounceHit();
                    } else { spawnImpact(wp, 0xaaaaaa); break; }
                } else {
                    tracerPath.push(pos.clone().addScaledVector(dir, w.range || 100));
                    break;
                }
            }
            for (let i = 0; i < tracerPath.length - 1; i++) spawnTracer(tracerPath[i], tracerPath[i + 1], col);
        }

        // Show hit marker on crosshair
        function showHitMarker() {
            const hm = document.createElement('div');
            hm.className = 'hitmark';
            document.body.appendChild(hm);
            setTimeout(() => hm.remove(), 300);
        }

        // ============================================================
        // GAME STATE
        // ============================================================
        window.G = {
            state: 'menu',
            // Match state
            bots: [],
            playerHp: 100,
            playerMaxHp: 100,
            playerPos: new THREE.Vector3(0, 0, 0),
            playerYaw: 0,
            playerPitch: 0,
            playerVel: new THREE.Vector3(),
            onGround: true,
            // Weapon state
            weapons: [],   // active loadout wdef array
            wepIndex: 0,
            currentMag: 0,
            isReloading: false,
            reloadTimer: 0,
            fireTimer: 0,
            scopeMode: false,
            // Weapon model in world
            wepModel: null,
            // Input
            keys: {},
            mouseDown: false,
            // Pointer lock
            locked: false,
            // Match config
            selMap: 0,
            selDiff: 'medium',
            selBots: 3,
            selMode: 'elimination',
            selChar: 'soldier',
            // Stats
            matchKills: 0,
            matchDmgDealt: 0,
            // Timing
            lastTime: 0,
            animId: null,
            // Special weapon state
            _shakeAmt: 0,
            _isCharging: false,
            _chargeStart: 0,
            _chargeVfx: null,
            // Powerup state
            powerups: [],
            _powerupTimer: 0,
            _speedBoost: 0,
            _dmgBoost: 0,
            // Survival mode
            waveNum: 0,
            waveBotsLeft: 0,
            // Timed mode
            matchTimer: 0,
            // Physics
            GRAVITY: 20,
            JUMP_VEL: 7,
            PLAYER_SPEED: 5.5,
            EYE_HEIGHT: 1.7,
            PLAYER_RADIUS: .3,

            init() {
                console.log('G.init() started');
                setupThreeJS();
                this.buildPreplayUI();
                this.buildShopUI();
                this.buildLoadoutUI();
                this.setupInput();
                this.renderLoop(0);
            },

            // ---- UI ----
            showScreen(id) {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                document.getElementById(id).classList.add('active');
                document.getElementById('hud').classList.remove('active');
                this.state = id;
                if (id === 's-shop') { document.getElementById('shop-coins-val').textContent = save.coins; this.buildShopUI(); }
                if (id === 's-loadout') this.buildLoadoutUI();
            },

            showPreplay() {
                console.log('G.showPreplay() called');
                this.buildPreplayUI();
                this.showScreen('s-preplay');
            },

            showNotif(msg, dur = 2000) {
                const n = document.getElementById('notif');
                n.textContent = msg; n.style.display = 'block';
                clearTimeout(n._t); n._t = setTimeout(() => n.style.display = 'none', dur);
            },

            buildPreplayUI() {
                // Game mode row
                const mr = document.getElementById('mode-row');
                mr.innerHTML = '';
                GAME_MODES.forEach(m => {
                    const c = document.createElement('div');
                    c.className = 'gcard' + (m.id === this.selMode ? ' sel' : '');
                    c.innerHTML = `<div class="gcard-icon">${m.icon}</div><div class="gcard-name">${m.name}</div><div class="gcard-desc">${m.desc}</div>`;
                    c.onclick = () => { this.selMode = m.id; this.buildPreplayUI(); };
                    mr.appendChild(c);
                });
                // Map grid
                const mg = document.getElementById('map-grid');
                mg.innerHTML = '';
                MDEFS.forEach((m, i) => {
                    const c = document.createElement('div');
                    c.className = 'mcard' + (i === this.selMap ? ' sel' : '');
                    c.innerHTML = `<div class="mcard-icon">${m.icon}</div><div class="mcard-name">${m.name}</div><div class="mcard-size">${m.size}</div>`;
                    c.onclick = () => { this.selMap = i; this.buildPreplayUI(); };
                    mg.appendChild(c);
                });
                // Diff
                const dr = document.getElementById('diff-row');
                dr.innerHTML = '';
                const dColors = { easy: '#44ff88', medium: '#ffcc00', hard: '#ff6644', extreme: '#ff00ff' };
                Object.entries(DIFFS).forEach(([k, v]) => {
                    const c = document.createElement('div');
                    c.className = 'dcard' + (k === this.selDiff ? ' sel' : '');
                    c.style.borderColor = k === this.selDiff ? dColors[k] : 'rgba(255,255,255,.1)';
                    c.innerHTML = `<div class="dcard-name" style="color:${dColors[k]}">${v.label}</div><div class="dcard-desc">Ã—${v.reward} coins</div>`;
                    c.onclick = () => { this.selDiff = k; this.buildPreplayUI(); };
                    dr.appendChild(c);
                });
                // Bot count
                const bcr = document.getElementById('bc-row');
                bcr.innerHTML = '';
                [1, 2, 3, 4, 5, 6].forEach(n => {
                    const c = document.createElement('div');
                    c.className = 'bcbtn' + (n === this.selBots ? ' sel' : '');
                    c.textContent = n;
                    c.onclick = () => { this.selBots = n; this.buildPreplayUI(); };
                    bcr.appendChild(c);
                });
                // Character row
                const cr = document.getElementById('char-row');
                cr.innerHTML = '';
                CDEFS.forEach(ch => {
                    const owned = save.ownedChars && save.ownedChars.includes(ch.id);
                    const sel = ch.id === this.selChar;
                    const c = document.createElement('div');
                    c.className = 'ccard' + (sel ? ' sel' : '');
                    c.innerHTML = `<div class="ccard-icon">${ch.icon}</div><div class="ccard-name">${ch.name}</div><div class="ccard-desc">${ch.desc}</div><div class="ccard-price">${owned ? (sel ? 'âœ“ SELECTED' : 'OWNED') : 'ðŸ’° ' + ch.price}</div>`;
                    c.onclick = () => {
                        if (!owned) {
                            if (save.coins >= ch.price) { save.coins -= ch.price; if (!save.ownedChars) save.ownedChars = ['soldier']; save.ownedChars.push(ch.id); writeSave(); this.selChar = ch.id; this.buildPreplayUI(); this.showNotif('Unlocked: ' + ch.name); }
                            else this.showNotif('Not enough coins!');
                        } else { this.selChar = ch.id; this.buildPreplayUI(); }
                    };
                    cr.appendChild(c);
                });
            },

            buildShopUI() {
                const cats = ['all', 'pistol', 'rifle', 'sniper', 'shotgun', 'melee', 'special', 'characters'];
                if (!this._shopCat) this._shopCat = 'all';
                const tabsEl = document.getElementById('cat-tabs');
                tabsEl.innerHTML = '';
                cats.forEach(c => {
                    const t = document.createElement('div');
                    t.className = 'cat-tab' + (c === this._shopCat ? ' active' : '');
                    t.textContent = c === 'all' ? 'ALL' : c.toUpperCase();
                    t.onclick = () => { this._shopCat = c; this.buildShopUI(); };
                    tabsEl.appendChild(t);
                });
                const grid = document.getElementById('shop-grid');
                grid.innerHTML = '';
                document.getElementById('shop-coins-val').textContent = save.coins;

                // Characters tab
                if (this._shopCat === 'characters') {
                    CDEFS.forEach(ch => {
                        const owned = save.ownedChars && save.ownedChars.includes(ch.id);
                        const isSel = ch.id === this.selChar;
                        const c = document.createElement('div');
                        c.className = 'wcard' + (isSel ? ' equipped' : owned ? ' owned' : '');
                        c.innerHTML = `
                            <div style="font-size:28px;text-align:center;margin-bottom:6px">${ch.icon}</div>
                            <div class="wcard-name">${ch.name}</div>
                            <div class="wcard-cat">character</div>
                            <div class="wcard-stat">HP <b>${ch.hp}</b></div>
                            <div class="stat-bar"><div class="stat-fill" style="width:${Math.round(ch.hp / 2)}%"></div></div>
                            <div class="wcard-stat">SPEED <b>${Math.round(ch.speed * 100)}%</b></div>
                            <div class="stat-bar"><div class="stat-fill" style="width:${Math.round(ch.speed * 70)}%"></div></div>
                            <div class="wcard-stat">DMG MULT <b>${Math.round(ch.dmgMult * 100)}%</b></div>
                            <div class="wcard-stat" style="color:#888;font-size:9px;margin-top:4px">${ch.desc}</div>
                            <div class="wcard-price ${ch.price === 0 ? 'free' : ''}">${ch.price === 0 ? 'FREE' : 'ðŸ’° ' + ch.price}</div>
                            <div class="wcard-tag" style="color:${isSel ? '#ff9944' : owned ? '#66ff66' : '#888'}">${isSel ? 'SELECTED' : owned ? 'OWNED' : 'BUY'}</div>
                        `;
                        if (!owned) {
                            c.onclick = () => {
                                if (save.coins >= ch.price) { save.coins -= ch.price; if (!save.ownedChars) save.ownedChars = ['soldier']; save.ownedChars.push(ch.id); this.selChar = ch.id; save.character = ch.id; writeSave(); this.buildShopUI(); this.showNotif('Unlocked: ' + ch.name); }
                                else this.showNotif('Not enough coins!');
                            };
                        } else if (!isSel) {
                            c.onclick = () => { this.selChar = ch.id; save.character = ch.id; writeSave(); this.buildShopUI(); this.showNotif('Character: ' + ch.name); };
                        }
                        grid.appendChild(c);
                    });
                    return;
                }

                const tierColors = { common: '#aaa', rare: '#4499ff', epic: '#aa44ff', legendary: '#ff9900' };
                WDEFS.filter(w => this._shopCat === 'all' || w.cat === this._shopCat).forEach(w => {
                    const owned = save.owned.includes(w.id);
                    const equipped = Object.values(save.loadout).includes(w.id);
                    const tier = w.tier || 'common';
                    const tc = tierColors[tier] || '#aaa';
                    const c = document.createElement('div');
                    c.className = 'wcard' + (equipped ? ' equipped' : owned ? ' owned' : '') + ' tier-' + tier;
                    // Special properties badge
                    const specials = [];
                    if (w.burst) specials.push('BURST');
                    if (w.bounce) specials.push('BOUNCE');
                    if (w.explosive) specials.push('EXPLOSIVE');
                    if (w.charge) specials.push('CHARGE');
                    if (w.status) specials.push(w.status.toUpperCase());
                    if (w.heavy) specials.push('HEAVY');
                    const specialTags = specials.map(s => `<span style="font-size:8px;color:#888;letter-spacing:1px">${s}</span>`).join(' ');
                    c.innerHTML = `
        <div class="badge-tier badge-${tier}">${tier.toUpperCase()}</div>
        <div class="wcard-name" style="color:${tc}">${w.name}</div>
        <div class="wcard-cat">${w.cat}</div>
        ${specials.length ? `<div style="margin-bottom:4px">${specialTags}</div>` : ''}
        <div class="wcard-stat">DMG <b>${w.dmg}</b></div>
        <div class="stat-bar"><div class="stat-fill" style="width:${Math.round(Math.min(100, w.dmg / 2.5))}%"></div></div>
        <div class="wcard-stat">RPM <b>${w.rpm}</b></div>
        <div class="stat-bar"><div class="stat-fill" style="width:${Math.round(Math.min(100, w.rpm / 15))}%"></div></div>
        <div class="wcard-stat">RANGE <b>${w.range}m</b></div>
        <div class="wcard-price ${w.price === 0 ? 'free' : ''}">${w.price === 0 ? 'FREE' : 'ðŸ’° ' + w.price}</div>
        <div class="wcard-tag" style="color:${equipped ? '#ff9944' : owned ? '#66ff66' : '#888'}">${equipped ? 'EQUIPPED' : owned ? 'OWNED' : 'BUY'}</div>
      `;
                    if (!owned) {
                        c.onclick = () => {
                            if (save.coins >= w.price) { save.coins -= w.price; save.owned.push(w.id); writeSave(); this.buildShopUI(); this.showNotif('Unlocked: ' + w.name); }
                            else this.showNotif('Not enough coins!');
                        };
                    }
                    grid.appendChild(c);
                });
            },

            buildLoadoutUI() {
                const slots = [
                    { key: 'primary', filter: w => ['rifle', 'sniper', 'special'].includes(w.cat), nameEl: 'lo-p-name', statsEl: 'lo-p-stats', listEl: 'lo-p-list' },
                    { key: 'secondary', filter: w => ['pistol', 'shotgun'].includes(w.cat), nameEl: 'lo-s-name', statsEl: 'lo-s-stats', listEl: 'lo-s-list' },
                    { key: 'melee', filter: w => w.cat === 'melee', nameEl: 'lo-m-name', statsEl: 'lo-m-stats', listEl: 'lo-m-list' },
                ];
                slots.forEach(slot => {
                    const cur = save.loadout[slot.key];
                    const wdef = cur ? WDEFS.find(w => w.id === cur) : null;
                    document.getElementById(slot.nameEl).textContent = wdef ? wdef.name : 'â€”';
                    document.getElementById(slot.statsEl).innerHTML = wdef ? `DMG ${wdef.dmg} Â· RPM ${wdef.rpm} Â· MAG ${wdef.mag === Infinity ? 'âˆž' : wdef.mag}` : '';
                    const list = document.getElementById(slot.listEl);
                    list.innerHTML = '';
                    WDEFS.filter(slot.filter).forEach(w => {
                        const owned = save.owned.includes(w.id);
                        const sel = cur === w.id;
                        const el = document.createElement('div');
                        el.className = 'lo-item' + (sel ? ' sel' : !owned ? ' lock' : '');
                        el.textContent = w.name + (owned ? '' : ' ðŸ”’');
                        if (owned) el.onclick = () => { save.loadout[slot.key] = w.id; writeSave(); this.buildLoadoutUI(); };
                        list.appendChild(el);
                    });
                });
            },

            // ---- MATCH ----
            startMatch() {
                this.matchKills = 0;
                this.matchDmgDealt = 0;
                this._killStreak = 0;
                this.isReloading = false;
                this.scopeMode = false;
                this._speedBoost = 0;
                this._dmgBoost = 0;
                this.powerups = [];
                this._powerupTimer = 20;
                camera.fov = 72;
                camera.updateProjectionMatrix();
                document.getElementById('scope-ov').style.display = 'none';
                document.getElementById('reload-ind').style.display = 'none';

                // Save selections
                save.character = this.selChar;
                writeSave();
                // Apply character stats
                const cdef = CDEFS.find(c => c.id === this.selChar) || CDEFS[0];
                this.playerMaxHp = cdef.hp;
                this.playerHp = cdef.hp;
                this._charDmgMult = cdef.dmgMult;
                this._charSpeedMult = cdef.speed;
                this._charRage = cdef.rage || false;

                const mdef = MDEFS[this.selMap];
                buildMap(mdef);

                const diff = DIFFS[this.selDiff];

                // Spawn player
                const sp = mdef.playerSpawn;
                this.playerPos.set(sp.x, 0, sp.z);
                this.playerYaw = 0; this.playerPitch = 0;
                this.playerVel.set(0, 0, 0);
                camera.position.copy(this.playerPos);
                camera.position.y = this.EYE_HEIGHT;

                // Build weapons array from loadout
                this.weapons = [];
                const lo = save.loadout;
                if (lo.primary) { const w = WDEFS.find(x => x.id === lo.primary); if (w) this.weapons.push({ ...w, curMag: w.mag, totalAmmo: w.mag * 3 }); }
                if (lo.secondary) { const w = WDEFS.find(x => x.id === lo.secondary); if (w) this.weapons.push({ ...w, curMag: w.mag, totalAmmo: w.mag * 3 }); }
                if (lo.melee) { const w = WDEFS.find(x => x.id === lo.melee); if (w) this.weapons.push({ ...w, curMag: Infinity, totalAmmo: Infinity }); }
                if (this.weapons.length === 0) {
                    const glock = WDEFS.find(x => x.id === 'glock');
                    this.weapons = [{ ...glock, curMag: glock.mag, totalAmmo: glock.mag * 4 }];
                }
                this.wepIndex = 0;
                this.fireTimer = 0;

                // Game mode setup
                if (this.selMode === 'survival') {
                    this.waveNum = 0;
                    document.getElementById('wave-d').style.display = 'block';
                    document.getElementById('timer-d').style.display = 'none';
                    this.bots = [];
                    this.spawnWave(mdef, diff);
                } else if (this.selMode === 'timed') {
                    this.matchTimer = 120; // 2 minutes
                    document.getElementById('timer-d').style.display = 'block';
                    document.getElementById('wave-d').style.display = 'none';
                    this.bots = [];
                    const spawnPts = mdef.spawnPts;
                    for (let i = 0; i < this.selBots; i++) {
                        const sp2 = spawnPts[i % spawnPts.length];
                        const jitter = new THREE.Vector3((Math.random() - .5) * 3, 0, (Math.random() - .5) * 3);
                        this.bots.push(new Bot(new THREE.Vector3(sp2.x, 0, sp2.z).add(jitter), diff, i));
                    }
                } else {
                    document.getElementById('wave-d').style.display = 'none';
                    document.getElementById('timer-d').style.display = 'none';
                    this.bots = [];
                    const spawnPts = mdef.spawnPts;
                    for (let i = 0; i < this.selBots; i++) {
                        const sp2 = spawnPts[i % spawnPts.length];
                        const jitter = new THREE.Vector3((Math.random() - .5) * 3, 0, (Math.random() - .5) * 3);
                        this.bots.push(new Bot(new THREE.Vector3(sp2.x, 0, sp2.z).add(jitter), diff, i));
                    }
                }

                // Weapon model
                this.updateWeaponModel();

                // Show HUD
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                document.getElementById('hud').classList.add('active');
                this.state = 'playing';

                // Request pointer lock
                renderer.domElement.requestPointerLock();
                document.getElementById('ptr-msg').style.display = 'block';
                setTimeout(() => document.getElementById('ptr-msg').style.display = 'none', 2500);

                this.updateHUD();
                save.matches++; writeSave();
            },

            spawnWave(mdef, diff) {
                this.waveNum++;
                const waveSize = this.selBots + Math.floor((this.waveNum - 1) * 1.5);
                const spawnPts = mdef.spawnPts;
                // Scale difficulty each wave
                const waveDiff = {
                    ...diff,
                    hp: Math.round(diff.hp * (1 + (this.waveNum - 1) * 0.34)),
                    acc: Math.min(0.995, diff.acc + (this.waveNum - 1) * 0.04),
                    react: Math.max(0.03, diff.react - (this.waveNum - 1) * 0.025),
                    speed: diff.speed + (this.waveNum - 1) * 0.32,
                    dmgMult: (diff.dmgMult || 1) + (this.waveNum - 1) * 0.08,
                    strafe: (diff.strafe || 1) + (this.waveNum - 1) * 0.08
                };
                for (let i = 0; i < waveSize; i++) {
                    const sp2 = spawnPts[i % spawnPts.length];
                    const jitter = new THREE.Vector3((Math.random() - .5) * 4, 0, (Math.random() - .5) * 4);
                    this.bots.push(new Bot(new THREE.Vector3(sp2.x, 0, sp2.z).add(jitter), waveDiff, this.bots.length));
                }
                document.getElementById('wave-d').textContent = 'WAVE ' + this.waveNum;
                this.showNotif('WAVE ' + this.waveNum + ' - ' + waveSize + ' ENEMIES!', 2500);
            },

            updateWeaponModel() {
                if (this.wepModel) { scene.remove(this.wepModel); this.wepModel = null; }
                const w = this.weapons[this.wepIndex];
                if (!w) return;
                this.wepModel = buildWeaponModelDetailed(w);
                this.wepModel.visible = !this.scopeMode;
                scene.add(this.wepModel);
            },

            setScopeMode(enabled) {
                const w = this.weapons[this.wepIndex];
                const canScope = !!(w && (w.scope || w.cat === 'sniper'));
                this.scopeMode = !!(enabled && canScope);
                document.getElementById('scope-ov').style.display = this.scopeMode ? 'block' : 'none';
                camera.fov = this.scopeMode ? 22 : 72;
                camera.updateProjectionMatrix();
                if (this.wepModel) this.wepModel.visible = !this.scopeMode;
            },

            endMatch(won, quit = false) {
                if (this.state !== 'playing') return;
                this.state = 'gameover';
                if (this.wepModel) { scene.remove(this.wepModel); this.wepModel = null; }
                // Clear bots and powerups
                this.bots.forEach(b => { if (b.group) scene.remove(b.group); });
                this.bots = [];
                this.powerups.forEach(p => { if (p.mesh) scene.remove(p.mesh); });
                this.powerups = [];
                document.exitPointerLock();
                this.locked = false;
                document.getElementById('wave-d').style.display = 'none';
                document.getElementById('timer-d').style.display = 'none';

                let coins = 0;
                const diff = DIFFS[this.selDiff];
                let extraInfo = '';
                if (won) {
                    coins = Math.round((50 + this.matchKills * 25) * diff.reward);
                    if (this.selMode === 'survival') {
                        coins = Math.round(coins * this.waveNum);
                        extraInfo = `Waves Survived: ${this.waveNum}<br>`;
                        if (this.waveNum > (save.bestWave || 0)) { save.bestWave = this.waveNum; extraInfo += `NEW BEST WAVE!<br>`; }
                    }
                    save.wins++;
                    playWin();
                } else {
                    coins = Math.round(this.matchKills * 10 * diff.reward);
                    if (this.selMode === 'timed') { won = true; extraInfo = `Time's Up!<br>`; }
                    else if (this.selMode === 'survival') { extraInfo = `Waves Survived: ${this.waveNum}<br>`; if (this.waveNum > (save.bestWave || 0)) save.bestWave = this.waveNum; }
                    if (!won) playLose(); else playWin();
                }
                save.coins += coins;
                save.kills += this.matchKills;
                writeSave();

                const title = document.getElementById('res-title');
                const isWin = won || this.selMode === 'timed';
                title.textContent = quit ? 'QUIT' : isWin ? 'VICTORY' : 'DEFEAT';
                title.className = isWin ? 'r-win' : 'r-loss';
                document.getElementById('res-stats').innerHTML = `
      ${extraInfo}Eliminations: ${this.matchKills}<br>
      Damage Dealt: ${this.matchDmgDealt}<br>
      Coins Earned: +${coins}<br>
      Total Coins: ${save.coins}
    `;
                this.showScreen('s-over');
            },

            resume() {
                if (this.state !== 's-pause') return;
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                document.getElementById('hud').classList.add('active');
                this.state = 'playing';
                renderer.domElement.requestPointerLock();
            },

            // ---- COMBAT ----
            shoot(chargeMult) {
                const w = this.weapons[this.wepIndex];
                if (!w || this.isReloading) return;
                // Charge weapons only fire on release (handled in mouseup)
                if (w.charge && !chargeMult) return;
                if (w.curMag <= 0) { this.startReload(); return; }
                const now = performance.now();
                const minInterval = 60000 / w.rpm;
                if ((now - this._lastShot) < minInterval) return;
                this._lastShot = now;

                const mult = chargeMult || 1;

                // --- BURST FIRE: queue shots with small delay ---
                if (w.burst) {
                    const shots = Math.min(w.burst, w.curMag);
                    for (let i = 0; i < shots; i++) {
                        setTimeout(() => {
                            if (w.curMag <= 0) return;
                            w.curMag--;
                            playShot(w);
                            if (this.wepModel) { const wp = new THREE.Vector3(); this.wepModel.getWorldPosition(wp); spawnMuzzleFlash(wp); }
                            const spread = this.scopeMode ? 0 : (1 - w.acc) * .05;
                            this.fireRay(w, spread, 1);
                            this._kick = Math.max(this._kick, .03);
                            this.updateHUD();
                            if (w.curMag === 0) this.startReload();
                        }, i * 80);
                    }
                    return;
                }

                w.curMag--;

                // Play appropriate sound
                if (w.laserColor) playLaserShot(w.laserColor);
                else if (w.status === 'slow') playFreezeShot();
                else if (chargeMult && chargeMult > 1) playChargeFire(chargeMult);
                else playShot(w);

                this.updateHUD();

                // Muzzle flash
                if (this.wepModel) {
                    const wpos = new THREE.Vector3();
                    this.wepModel.getWorldPosition(wpos);
                    spawnMuzzleFlash(wpos);
                    if (w.laserColor) {
                        const fl = new THREE.PointLight(w.laserColor, 4, 4);
                        fl.position.copy(wpos); scene.add(fl);
                        setTimeout(() => scene.remove(fl), 70);
                    }
                }

                // Weapon kick (charge weapons kick harder)
                this._kick = .04 * mult;

                const isMelee = w.cat === 'melee';
                const isShotgun = w.cat === 'shotgun';

                if (isMelee) {
                    this.bots.forEach(bot => {
                        if (!bot.alive) return;
                        const dist = camera.position.distanceTo(bot.group.position);
                        if (dist < w.range) {
                            this.hitBot(bot, Math.round(w.dmg * mult), false);
                            if (w.energyTrail) spawnImpact(bot.group.position.clone().add(new THREE.Vector3(0, .8, 0)), 0x0099ff);
                        }
                    });
                    this._swingAnim = .2;
                } else if (isShotgun) {
                    const pellets = w.pellets || 8;
                    for (let i = 0; i < pellets; i++) {
                        const spread = (1 - w.acc) * .12;
                        if (w.bounce) fireBouncingRay(w, spread);
                        else this.fireRay(w, spread, mult);
                    }
                } else if (w.bounce) {
                    const spread = this.scopeMode ? 0 : (1 - w.acc) * .05;
                    fireBouncingRay(w, spread);
                } else {
                    const spread = this.scopeMode ? 0 : (1 - w.acc) * .05;
                    this.fireRay(w, spread, mult);
                }

                if (w.curMag === 0 && w.cat !== 'melee') this.startReload();
            },

            fireRay(w, spread, dmgMult) {
                dmgMult = dmgMult || 1;
                const dir = new THREE.Vector3(
                    (Math.random() - .5) * spread * 2,
                    (Math.random() - .5) * spread * 2,
                    -1
                );
                dir.normalize();
                dir.applyQuaternion(camera.quaternion);

                const ray = new THREE.Raycaster(camera.position.clone(), dir, 0, w.range || 200);
                const wallHits = ray.intersectObjects(getRaycastTargets());
                const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;
                let hitBot = null, hitDist = Infinity;
                this.bots.forEach(bot => {
                    if (!bot.alive) return;
                    const toBot = new THREE.Vector3().subVectors(bot.group.position, camera.position);
                    toBot.y = BOT_HEIGHT / 2;
                    const proj = toBot.dot(dir);
                    if (proj < 0) return;
                    const closest = new THREE.Vector3().copy(camera.position).addScaledVector(dir, proj);
                    const dist = closest.distanceTo(new THREE.Vector3(bot.group.position.x, BOT_HEIGHT / 2 + bot.group.position.y, bot.group.position.z));
                    if (dist < BOT_RADIUS * 2 && proj < hitDist && proj < wallDist) { hitDist = proj; hitBot = bot; }
                });

                // Tracer color based on weapon type
                const tracerCol = w.laserColor || (w.status === 'burn' ? 0xff4400 : w.status === 'slow' ? 0x44aaff : w.status === 'knockback' ? 0x6688ff : 0xffcc88);

                if (hitBot) {
                    const isHead = hitDist < camera.position.distanceTo(hitBot.group.position) && Math.random() < .15;
                    const dmg = Math.round(w.dmg * dmgMult);
                    this.hitBot(hitBot, dmg, isHead);
                    const hp = new THREE.Vector3().copy(camera.position).addScaledVector(dir, hitDist);
                    spawnImpact(hp, isHead ? 0xffcccc : tracerCol);
                    spawnTracer(camera.position.clone(), hp, tracerCol);
                    showHitMarker();
                    if (w.status) applyStatus(hitBot, w.status, w);
                    if (w.explosive) explosiveSplash(hp, w.splashRadius || 4, w.dmg * .5);
                    // Pierce: continue ray past first hit
                    if (w.pierce) {
                        this.bots.forEach(b2 => {
                            if (!b2.alive || b2 === hitBot) return;
                            const d2 = new THREE.Vector3().subVectors(b2.group.position, camera.position).dot(dir);
                            if (d2 > hitDist && d2 < (w.range || 200)) {
                                const closest2 = new THREE.Vector3().copy(camera.position).addScaledVector(dir, d2);
                                if (closest2.distanceTo(new THREE.Vector3(b2.group.position.x, BOT_HEIGHT / 2, b2.group.position.z)) < BOT_RADIUS * 2) {
                                    this.hitBot(b2, Math.round(dmg * 0.7), false);
                                }
                            }
                        });
                    }
                    // Chain lightning: jump to nearby bots
                    if (w.chain) {
                        this.bots.forEach(b2 => {
                            if (!b2.alive || b2 === hitBot) return;
                            if (b2.group.position.distanceTo(hitBot.group.position) < 6) {
                                this.hitBot(b2, Math.round(dmg * 0.5), false);
                                spawnTracer(hitBot.group.position.clone().add(new THREE.Vector3(0, .8, 0)), b2.group.position.clone().add(new THREE.Vector3(0, .8, 0)), tracerCol);
                                spawnImpact(b2.group.position.clone().add(new THREE.Vector3(0, .8, 0)), tracerCol);
                            }
                        });
                    }
                } else {
                    const hits = ray.intersectObjects(getRaycastTargets());
                    if (hits.length > 0) {
                        spawnImpact(hits[0].point, w.status === 'burn' ? 0xff5500 : 0xaaaaaa);
                        spawnTracer(camera.position.clone(), hits[0].point, tracerCol);
                        if (w.explosive) explosiveSplash(hits[0].point, w.splashRadius || 4, w.dmg);
                    } else {
                        const endPt = camera.position.clone().addScaledVector(dir, w.range || 200);
                        spawnTracer(camera.position.clone(), endPt, tracerCol);
                    }
                }
            },

            hitBot(bot, dmg, isHead) {
                // Apply character dmg mult + damage boost powerup + berserker rage
                let mult = (this._charDmgMult || 1.0) * (this._dmgBoost > 0 ? 2.0 : 1.0);
                if (this._charRage && this.playerHp < this.playerMaxHp * 0.3) mult *= 2.0;
                const finalDmg = Math.round(dmg * mult);
                this.matchDmgDealt += isHead ? finalDmg * 2 : finalDmg;
                bot.takeDamage(finalDmg, isHead);
                playHit();
                if (isHead) {
                    const ki = document.getElementById('kill-ind');
                    ki.textContent = 'HEADSHOT!'; ki.style.color = '#ffdd00'; ki.style.opacity = 1;
                    setTimeout(() => ki.style.opacity = 0, 800);
                }
                if (!bot.alive) {
                    this.matchKills++;
                    this._killStreak = (this._killStreak || 0) + 1;
                    save.kills++;
                    playKill();
                    const streakMsgs = { 3: 'ðŸ”¥ TRIPLE KILL!', 5: 'âš¡ KILLING SPREE!', 7: 'â˜ ï¸ RAMPAGE!', 10: 'ðŸ’€ UNSTOPPABLE!' };
                    if (streakMsgs[this._killStreak]) this.showNotif(streakMsgs[this._killStreak], 2500);
                    this.addKillFeed('ELIMINATED');
                    const ki = document.getElementById('kill-ind');
                    ki.textContent = 'ELIMINATED'; ki.style.color = '#ff3333'; ki.style.opacity = 1;
                    setTimeout(() => ki.style.opacity = 0, 900);
                    this.updateHUD();
                    // Check win conditions
                    const allDead = this.bots.every(b => !b.alive);
                    if (allDead) {
                        if (this.selMode === 'survival') {
                            // Spawn next wave after 3s
                            if (this.waveNum < 5) {
                                setTimeout(() => { if (this.state === 'playing') this.spawnWave(MDEFS[this.selMap], DIFFS[this.selDiff]); }, 3000);
                            } else {
                                setTimeout(() => this.endMatch(true), 800);
                            }
                        } else if (this.selMode !== 'timed') {
                            setTimeout(() => this.endMatch(true), 800);
                        }
                    }
                    // Timed mode: respawn bot
                    if (this.selMode === 'timed' && this.matchTimer > 0) {
                        setTimeout(() => {
                            if (this.state !== 'playing') return;
                            const mdef = MDEFS[this.selMap];
                            const sp2 = mdef.spawnPts[Math.floor(Math.random() * mdef.spawnPts.length)];
                            const jitter = new THREE.Vector3((Math.random() - .5) * 3, 0, (Math.random() - .5) * 3);
                            const nb = new Bot(new THREE.Vector3(sp2.x, 0, sp2.z).add(jitter), DIFFS[this.selDiff], this.bots.length);
                            this.bots.push(nb);
                        }, 4000);
                    }
                }
            },

            addKillFeed(msg) {
                const kf = document.getElementById('kfeed');
                const el = document.createElement('span');
                el.className = 'kmsg'; el.textContent = msg;
                kf.appendChild(el);
                setTimeout(() => el.remove(), 2100);
            },

            startReload() {
                const w = this.weapons[this.wepIndex];
                if (!w || w.cat === 'melee' || this.isReloading) return;
                if (w.totalAmmo === 0) return;
                this.isReloading = true;
                this.reloadTimer = 2.0 - (w.rpm / 2000);
                document.getElementById('reload-ind').style.display = 'block';
                playReload();
            },

            playerTakeDamage(dmg) {
                this._killStreak = 0;
                this.playerHp = Math.max(0, this.playerHp - dmg);
                // Damage flash
                const ov = document.getElementById('dmg-ov');
                ov.style.opacity = 1; setTimeout(() => ov.style.opacity = 0, 200);
                this.updateHUD();
                if (this.playerHp <= 0) this.endMatch(false);
            },

            // ---- MOVEMENT ----
            updatePlayer(dt) {
                // Boost timers
                if (this._speedBoost > 0) { this._speedBoost -= dt; if (this._speedBoost <= 0) { this._speedBoost = 0; document.getElementById('boost-d').textContent = ''; } else { document.getElementById('boost-d').textContent = 'âš¡ SPEED ' + Math.ceil(this._speedBoost) + 's'; } }
                if (this._dmgBoost > 0) { this._dmgBoost -= dt; if (this._dmgBoost <= 0) { this._dmgBoost = 0; if (this._speedBoost <= 0) document.getElementById('boost-d').textContent = ''; } else { document.getElementById('boost-d').textContent = 'ðŸ”¥ DAMAGE ' + Math.ceil(this._dmgBoost) + 's'; } }
                // Timed mode countdown
                if (this.selMode === 'timed') {
                    this.matchTimer -= dt;
                    const m = Math.floor(this.matchTimer / 60); const s = Math.floor(this.matchTimer % 60);
                    document.getElementById('timer-d').textContent = m + ':' + (s < 10 ? '0' : '') + s;
                    if (this.matchTimer <= 0) { this.endMatch(false); return; }
                }
                // Powerup spawn timer
                this._powerupTimer -= dt;
                if (this._powerupTimer <= 0) {
                    this._powerupTimer = 20 + Math.random() * 15;
                    this.spawnPowerup();
                }
                // Check powerup pickups
                this.updatePowerups();

                const w_cur = this.weapons[this.wepIndex];
                const heavyPenalty = (w_cur && w_cur.heavy) ? .55 : 1;
                const speedBoostMult = this._speedBoost > 0 ? 1.8 : 1;
                const speed = this.PLAYER_SPEED * (this.scopeMode ? .5 : 1) * heavyPenalty * (this._charSpeedMult || 1) * speedBoostMult;
                const fwd = new THREE.Vector3(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
                const right = new THREE.Vector3(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));
                const moveVel = new THREE.Vector3();

                if (this.keys['KeyW'] || this.keys['ArrowUp']) moveVel.addScaledVector(fwd, speed);
                if (this.keys['KeyS'] || this.keys['ArrowDown']) moveVel.addScaledVector(fwd, -speed);
                if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveVel.addScaledVector(right, -speed);
                if (this.keys['KeyD'] || this.keys['ArrowRight']) moveVel.addScaledVector(right, speed);

                // Gravity
                if (!this.onGround) this.playerVel.y -= this.GRAVITY * dt;
                else this.playerVel.y = Math.max(0, this.playerVel.y);

                // Apply horizontal movement with collision
                const newX = this.playerPos.x + moveVel.x * dt;
                const newZ = this.playerPos.z + moveVel.z * dt;

                if (!collidesWithObstacle(newX, this.playerPos.z, this.PLAYER_RADIUS)) {
                    const c = clampToBounds(newX, this.playerPos.z, this.PLAYER_RADIUS);
                    this.playerPos.x = c.x;
                }
                if (!collidesWithObstacle(this.playerPos.x, newZ, this.PLAYER_RADIUS)) {
                    const c = clampToBounds(this.playerPos.x, newZ, this.PLAYER_RADIUS);
                    this.playerPos.z = c.z;
                }

                // Vertical
                this.playerPos.y += this.playerVel.y * dt;
                if (this.playerPos.y <= 0) {
                    this.playerPos.y = 0;
                    this.playerVel.y = 0;
                    this.onGround = true;
                } else {
                    this.onGround = false;
                }

                // Bobbing
                const moving = moveVel.length() > 0.1 && this.onGround;
                if (moving) {
                    this._bobT = (this._bobT || 0) + dt * 12;
                    this._bobAmt = Math.sin(this._bobT) * .04;
                    this._strafeTilt = lerp(this._strafeTilt || 0, THREE.MathUtils.clamp(moveVel.dot(right) / Math.max(speed, .01), -1, 1) * .035, .12);
                } else {
                    this._bobAmt = (this._bobAmt || 0) * 0.85;
                    this._strafeTilt = lerp(this._strafeTilt || 0, 0, .1);
                }
                this._landBounce = lerp(this._landBounce || 0, this.onGround ? 0 : -.015, .08);

                // Update camera
                camera.position.set(this.playerPos.x, this.playerPos.y + this.EYE_HEIGHT + this._bobAmt + (this._landBounce || 0), this.playerPos.z);
                camera.rotation.order = 'YXZ';
                camera.rotation.y = this.playerYaw;
                camera.rotation.x = this.playerPitch;
                camera.rotation.z = this._strafeTilt || 0;

                // Weapon kick
                if (this._kick > 0) {
                    this._kick = Math.max(0, this._kick - dt * .22);
                    camera.rotation.x -= this._kick * .3;
                }

                // Swing animation for melee
                if (this._swingAnim > 0) {
                    this._swingAnim -= dt;
                    camera.rotation.x -= Math.sin(this._swingAnim * Math.PI / .2) * .3;
                }

                // Screen shake
                if (this._shakeAmt > 0) {
                    camera.position.x += (Math.random() - .5) * this._shakeAmt;
                    camera.position.y += (Math.random() - .5) * this._shakeAmt * .5;
                    this._shakeAmt = Math.max(0, this._shakeAmt - dt * 3);
                }

                // Charge weapon VFX
                if (this._isCharging) {
                    const cw = this.weapons[this.wepIndex];
                    if (cw && cw.charge) {
                        const elapsed = (performance.now() - this._chargeStart) / 1000;
                        const pct = Math.min(1, elapsed / 1.5);
                        if (!this._chargeVfx) {
                            this._chargeVfx = new THREE.PointLight(cw.laserColor || 0xffaa00, 0, 3);
                            scene.add(this._chargeVfx);
                        }
                        this._chargeVfx.intensity = pct * 5;
                        this._chargeVfx.position.copy(camera.position).addScaledVector(
                            new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), .6
                        );
                        const ci = document.getElementById('charge-ind');
                        if (ci) { ci.style.display = 'block'; ci.textContent = 'CHARGING ' + Math.round(pct * 100) + '%'; }
                    }
                }

                // Update weapon model (attached to camera)
                if (this.wepModel) {
                    const w = this.weapons[this.wepIndex];
                    const isMelee = w && w.cat === 'melee';
                    const offset = new THREE.Vector3(.2, -.18, -.35);
                    if (this.scopeMode) offset.set(0, -.1, -.3);
                    const swayX = (this._strafeTilt || 0) * 2.2 + Math.sin((this._bobT || 0) * .5) * .015;
                    const swayY = (this._bobAmt || 0) * 1.6 - (this._kick || 0) * .45;
                    const swayZ = moving ? Math.cos(this._bobT || 0) * .02 : 0;
                    offset.x += swayX;
                    offset.y += swayY;
                    offset.z += swayZ;
                    this.wepModel.position.copy(camera.position).add(
                        offset.clone().applyEuler(new THREE.Euler(camera.rotation.x, camera.rotation.y, 0, 'YXZ'))
                    );
                    this.wepModel.rotation.copy(camera.rotation);
                    this.wepModel.rotateY(Math.PI);
                    this.wepModel.rotation.z += (this._strafeTilt || 0) * 3;
                    this.wepModel.rotation.y += Math.sin((this._bobT || 0) * .5) * .03;
                    if (isMelee && this._swingAnim > 0) {
                        this.wepModel.rotation.x += Math.sin(this._swingAnim * Math.PI / .2) * .8;
                    }
                    const animTime = performance.now() * .002;
                    this.wepModel.traverse(o => {
                        if (!o.isMesh) return;
                        o.rotation.z += Math.sin(animTime + o.position.z * 4) * .002;
                    });
                }

                // Auto fire
                const w = this.weapons[this.wepIndex];
                if (this.mouseDown && w && w.auto && !this.isReloading) this.shoot();

                // Reload timer
                if (this.isReloading) {
                    this.reloadTimer -= dt;
                    if (this.reloadTimer <= 0) {
                        const ww = this.weapons[this.wepIndex];
                        if (ww && ww.cat !== 'melee') {
                            const needed = ww.mag - ww.curMag;
                            const from = Math.min(needed, ww.totalAmmo === Infinity ? needed : ww.totalAmmo);
                            ww.curMag += from;
                            if (ww.totalAmmo !== Infinity) ww.totalAmmo -= from;
                        }
                        this.isReloading = false;
                        document.getElementById('reload-ind').style.display = 'none';
                        this.updateHUD();
                    }
                }
            },

            updateBots(dt) {
                const playerBox = new THREE.Box3(
                    new THREE.Vector3(this.playerPos.x - this.PLAYER_RADIUS, this.playerPos.y, this.playerPos.z - this.PLAYER_RADIUS),
                    new THREE.Vector3(this.playerPos.x + this.PLAYER_RADIUS, this.playerPos.y + 1.8, this.playerPos.z + this.PLAYER_RADIUS)
                );
                const eyePos = new THREE.Vector3(this.playerPos.x, this.playerPos.y + this.EYE_HEIGHT, this.playerPos.z);
                this.bots.forEach(b => b.update(dt, eyePos, playerBox));
            },

            updateParticles(dt) {
                for (let i = particles.length - 1; i >= 0; i--) {
                    if (!particles[i].update(dt)) { particles[i].destroy(); particles.splice(i, 1); }
                }
            },

            spawnPowerup() {
                if (this.powerups.length >= 4) return;
                const mdef = MDEFS[this.selMap];
                if (!mdef) return;
                const b = mdef.bounds - 3;
                const x = (Math.random() - .5) * b * 2;
                const z = (Math.random() - .5) * b * 2;
                if (collidesWithObstacle(x, z, .5)) return;
                const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                const geo = new THREE.OctahedronGeometry(.35, 0);
                const mat = new THREE.MeshLambertMaterial({ color: type.color, emissive: new THREE.Color(type.color), emissiveIntensity: .6 });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, .7, z);
                scene.add(mesh);
                // Spinning point light
                const light = new THREE.PointLight(type.color, 1.5, 4);
                light.position.set(x, .7, z);
                scene.add(light);
                this.powerups.push({ type, mesh, light, x, z });
            },

            updatePowerups() {
                const t = Date.now() * .002;
                for (let i = this.powerups.length - 1; i >= 0; i--) {
                    const p = this.powerups[i];
                    // Spin + float
                    p.mesh.rotation.y = t + i;
                    p.mesh.position.y = .7 + Math.sin(t * 2 + i) * .15;
                    p.light.position.y = p.mesh.position.y;
                    // Pickup check
                    const dx = this.playerPos.x - p.x, dz = this.playerPos.z - p.z;
                    if (Math.sqrt(dx * dx + dz * dz) < 1.2) {
                        p.type.apply(this);
                        this.showNotif(p.type.icon + ' ' + p.type.label + '!');
                        scene.remove(p.mesh); scene.remove(p.light);
                        spawnImpact(new THREE.Vector3(p.x, .7, p.z), p.type.color);
                        this.powerups.splice(i, 1);
                    }
                }
            },

            updateHUD() {
                if (this.state !== 'playing') return;
                document.getElementById('hp-fill').style.width = (this.playerHp / this.playerMaxHp * 100) + '%';
                document.getElementById('hp-val').textContent = this.playerHp;
                const w = this.weapons[this.wepIndex];
                if (w) {
                    document.getElementById('ammo-c').textContent = w.cat === 'melee' ? 'âˆž' : (w.curMag || 0);
                    document.getElementById('ammo-m').textContent = w.cat === 'melee' ? '' : `/ ${w.totalAmmo === Infinity ? 'âˆž' : w.totalAmmo}`;
                    document.getElementById('wep-name').textContent = w.name.toUpperCase();
                }
                document.getElementById('hud-coins').textContent = save.coins;
                const alive = this.bots.filter(b => b.alive).length;
                if (this.selMode === 'survival') {
                    document.getElementById('bots-alive').textContent = alive;
                } else {
                    document.getElementById('bots-alive').textContent = alive;
                }
                // Rage indicator overrides boost display
                if (this._charRage && this.playerHp < this.playerMaxHp * 0.3) {
                    document.getElementById('boost-d').style.color = '#ff4444';
                    document.getElementById('boost-d').textContent = 'ðŸ˜¤ RAGE ACTIVE!';
                } else if (this._speedBoost <= 0 && this._dmgBoost <= 0) {
                    document.getElementById('boost-d').textContent = '';
                }
            },

            // ---- INPUT ----
            setupInput() {
                document.addEventListener('keydown', e => {
                    this.keys[e.code] = true;
                    if (this.state === 'playing') {
                        if (e.code === 'KeyR') this.startReload();
                        if (e.code === 'Digit1' || e.code === 'Numpad1') this.switchWeapon(0);
                        if (e.code === 'Digit2' || e.code === 'Numpad2') this.switchWeapon(1);
                        if (e.code === 'Digit3' || e.code === 'Numpad3') this.switchWeapon(2);
                        if (e.code === 'Space' && this.onGround) { this.playerVel.y = this.JUMP_VEL; this.onGround = false; }
                        if (e.code === 'Escape') {
                            document.exitPointerLock();
                            this.showScreen('s-pause');
                        }
                    }
                });
                document.addEventListener('keyup', e => { this.keys[e.code] = false; });

                document.addEventListener('mousedown', e => {
                    if (this.state === 'playing' && this.locked) {
                        if (e.button === 0) {
                            this.mouseDown = true;
                            const w = this.weapons[this.wepIndex];
                            if (w && w.charge) {
                                // Start charging
                                this._isCharging = true;
                                this._chargeStart = performance.now();
                            } else if (!w || !w.auto) {
                                this.shoot();
                            }
                        }
                        if (e.button === 2) {
                            this.setScopeMode(true);
                        }
                    }
                });
                document.addEventListener('mouseup', e => {
                    if (e.button === 0) {
                        this.mouseDown = false;
                        if (this.state === 'playing' && this._isCharging) {
                            const w = this.weapons[this.wepIndex];
                            if (w && w.charge) {
                                const elapsed = (performance.now() - this._chargeStart) / 1000;
                                const mult = Math.max(1, Math.min(w.maxChargeMult || 5, 1 + elapsed * 2.5));
                                this._isCharging = false;
                                if (this._chargeVfx) { scene.remove(this._chargeVfx); this._chargeVfx = null; }
                                const ci = document.getElementById('charge-ind');
                                if (ci) ci.style.display = 'none';
                                this.shoot(mult);
                            }
                        }
                    } else if (e.button === 2) {
                        this.setScopeMode(false);
                    }
                });
                document.addEventListener('contextmenu', e => e.preventDefault());

                document.addEventListener('mousemove', e => {
                    if (this.state !== 'playing' || !this.locked) return;
                    const sens = this.scopeMode ? .0005 : .002;
                    this.playerYaw -= e.movementX * sens;
                    this.playerPitch -= e.movementY * sens;
                    this.playerPitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.playerPitch));
                });

                document.addEventListener('wheel', e => {
                    if (this.state !== 'playing') return;
                    const dir = e.deltaY > 0 ? 1 : -1;
                    this.switchWeapon((this.wepIndex + dir + this.weapons.length) % this.weapons.length);
                });

                document.addEventListener('pointerlockchange', () => {
                    this.locked = document.pointerLockElement === renderer.domElement;
                    if (this.locked) { document.getElementById('ptr-msg').style.display = 'none'; }
                    else if (this.state === 'playing') { document.getElementById('ptr-msg').style.display = 'block'; }
                });

                renderer.domElement.addEventListener('click', () => {
                    if (this.state === 'playing' && !this.locked) renderer.domElement.requestPointerLock();
                });
            },

            switchWeapon(idx) {
                if (idx < 0 || idx >= this.weapons.length) return;
                this.wepIndex = idx;
                this.isReloading = false;
                document.getElementById('reload-ind').style.display = 'none';
                if (this.scopeMode) this.setScopeMode(false);
                this.updateWeaponModel();
                this.updateHUD();
            },

            // ---- RENDER LOOP ----
            renderLoop(time) {
                this.animId = requestAnimationFrame(t => this.renderLoop(t));
                const dt = Math.min(.05, (time - this.lastTime) / 1000);
                this.lastTime = time;

                if (this.state === 'playing') {
                    this.updatePlayer(dt);
                    this.updateBots(dt);
                    this.updateParticles(dt);
                    this.updateHUD();
                }

                const pulseT = time * .0012;
                scene.children.forEach(obj => {
                    if (!obj.isPointLight || !obj.userData.isMap) return;
                    obj.intensity = (obj.userData.baseIntensity || obj.intensity);
                    if (!obj.userData.baseIntensity) obj.userData.baseIntensity = obj.intensity;
                    obj.intensity = obj.userData.baseIntensity * (0.9 + Math.sin(pulseT + obj.position.x * .08 + obj.position.z * .08) * .12);
                });

                renderer.render(scene, camera);
            },
        };

        // Init game
        window.G._lastShot = 0;
        window.G._kick = 0;
        window.G._bobT = 0;
        window.G._bobAmt = 0;
        window.G._swingAnim = 0;
        window.G._shopCat = 'all';
        window.G._charDmgMult = 1.0;
        window.G._charSpeedMult = 1.0;
        window.G._charRage = false;
        window.G.selChar = save.character || 'soldier';
        window.G.selMode = 'elimination';

        if (typeof window.HuntersGL !== 'undefined' && window.HuntersGL.preload) {
            console.log('Starting HuntersGL preload');
            window.HuntersGL.preload().then(function () { console.log('Preload done'); window.G.init(); }).catch(function (e) { console.warn('Preload failed', e); window.G.init(); });
        } else {
            console.log('No HuntersGL, initing G directly');
            window.G.init();
        }
        console.log('G is defined on window');

