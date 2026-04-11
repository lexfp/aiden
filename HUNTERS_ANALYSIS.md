# Hunters Game - Selection & Ability System Analysis

## 1. CHARACTER SELECTION & SETUP

### JJK Character Definitions (Line 110-119)
```javascript
const JJK_CHARACTER_TYPES = {
    gojo:   { health: 120, speed: 1.2, color: 0x88ccff, ability: 'shield',      ... label: 'Gojo' },
    sukuna: { health: 200, speed: 1.0, color: 0xff4444, ability: 'slash',       ... label: 'Sukuna' },
    nanami: { health: 140, speed: 1.0, color: 0xffdd88, ability: 'critical',    ... label: 'Nanami' },
    mahito: { health: 100, speed: 1.3, color: 0xaa66ff, ability: 'dodge',       ... label: 'Mahito' },
    megumi: { health: 130, speed: 1.1, color: 0x3333ff, ability: 'summon',      ... label: 'Megumi' },
    yuji:   { health: 150, speed: 1.2, color: 0xff8888, ability: 'burst',       ... label: 'Yuji' },
    yuta:   { health: 160, speed: 1.1, color: 0xffffff, ability: 'energy',      ... label: 'Yuta' },
    toji:   { health: 170, speed: 1.4, color: 0x222222, ability: 'rush',        ... label: 'Toji' },
    geto:   { health: 150, speed: 1.0, color: 0x5500aa, ability: 'projectile',  ... label: 'Geto' }
};
const JJK_TYPES_LIST = Object.keys(JJK_CHARACTER_TYPES);  // Line 121
```

### Player Character Selection UI (buildPreplayUI function, Lines 2800-2868)
**Function:** `buildPreplayUI()` - Line 2800
- Builds the pre-match UI for player to select game configuration
- **Character row building:** Lines 2851-2868
- Creates `char-row` div with character cards
- Each card has:
  - Icon display
  - Name
  - Description
  - Price or status (OWNED/SELECTED)
  - Click handler: `c.onclick = () => { ... this.selChar = ch.id; ... }`
  - Purchase logic or selection logic

**Key Line:** Line 2860 - Character selection click handler:
```javascript
c.onclick = () => {
    if (!owned) {
        // Purchase if not yet owned
        if (save.coins >= ch.price) { 
            save.coins -= ch.price; 
            if (!save.ownedChars) save.ownedChars = ['soldier']; 
            save.ownedChars.push(ch.id); 
            this.selChar = ch.id; 
            this.buildPreplayUI(); 
            this.showNotif('Unlocked: ' + ch.name); 
        } else this.showNotif('Not enough coins!');
    } else { 
        // Select if owned
        this.selChar = ch.id; 
        this.buildPreplayUI(); 
    }
};
```

---

## 2. BOT CHARACTER SELECTION & SETUP

### Bot Constructor - Character Assignment (Line 1809-1820)
```javascript
// Line 1809-1811: JJK Character Type Assignment
// JJK character type
this.jjkDef = JJK_CHARACTER_TYPES[typeKey] || JJK_CHARACTER_TYPES.gojo;
this.jjkLabel = this.jjkDef.label;

// Line 1816-1820: Character stats application
this.maxHp = Math.round(diff.hp * (this.jjkDef.health / 130));
this.hp = this.maxHp;
this.speed = diff.speed * this.jjkDef.speed;
this.color = this.jjkDef.color;
```

### Random JJK Assignment for Bots (In startMatch & spawnWave)
**Lines 3107-3110 (timed/elimination modes):**
```javascript
const jjkType = JJK_TYPES_LIST[Math.floor(Math.random() * JJK_TYPES_LIST.length)];
this.bots.push(new Bot(new THREE.Vector3(sp2.x, 0, sp2.z).add(jitter), diff, i, jjkType));
```

**Lines 3140-3142 (survival mode):**
```javascript
const jjkType = JJK_TYPES_LIST[Math.floor(Math.random() * JJK_TYPES_LIST.length)];
this.bots.push(new Bot(new THREE.Vector3(sp2.x, 0, sp2.z).add(jitter), waveDiff, this.bots.length, jjkType));
```

---

## 3. ABILITY SYSTEM

### Ability Trigger Condition (Line 1968-1971)
```javascript
// Ability system tick
this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
if (this.abilityCooldown <= 0 && this.state !== 'patrol') {
    this.useAbility(playerPos);
}
```

**When is it called?**
- During bot `update()` function every frame
- Ability fires when:
  1. Cooldown reaches 0 (bot hasn't used ability recently)
  2. Bot is NOT in patrol state (i.e., engaging or attacking player)

### Bot useAbility() Function (Line 2172-2309)
**Function location:** Line 2172

**Ability types and behaviors:**

| Ability | Character | Function |
|---------|-----------|----------|
| **shield** | Gojo | 3s invulnerability, turns blue, cooldown 12s |
| **slash** | Sukuna | 40 damage AoE if player within 6 units, red particles, cooldown 5s |
| **critical** | Nanami | Flags next shot as 3x damage, cooldown 8s |
| **dodge** | Mahito | 2s dodge window (40% to avoid all damage), cooldown 10s |
| **summon** | Megumi | Spawns 2 small helper bots (shikigami), cooldown 15s |
| **burst** | Yuji | 4s speed & damage boost (1.8x speed), cooldown 9s |
| **energy** | Yuta | 40 damage ranged energy attack up to 60 units, cooldown 7s |
| **rush** | Toji | Dash 4 units toward player, 50 damage if within 3 units, cooldown 6s |
| **projectile** | Geto | 70 damage delayed (0.8s) ranged attack up to 50 units, cooldown 8s |

---

## 4. DOMAIN EXPANSION SYSTEM

### Domain Trigger (Line 1975-1978)
```javascript
// Domain Expansion trigger: fires once when bot HP drops below 30%
if (window.G && window.G.domainManager && !this.domainUsed &&
    this.hp > 0 && (this.hp / this.maxHp) < 0.30) {
    window.G.domainManager.tryActivate(this);
}
```

**When triggered:**
- Bot HP drops below 30% of max HP
- Only fires once per bot (`domainUsed` flag prevents repeats)

### Domain Manager Class (Line 2381-2550)
**Constructor:** Line 2381

**Key method - tryActivate():** Line 2400-2408
```javascript
tryActivate(bot) {
    if (this.active || bot.domainUsed) return false;
    const typeKey = DOMAIN_LABEL_MAP[bot.jjkDef && bot.jjkDef.label];
    if (!typeKey) return false;
    bot.domainUsed = true;
    this.activate(DOMAIN_CONFIGS[typeKey], bot);
    return true;
}
```

**Domain Label Map:** Line 2379
```javascript
const DOMAIN_LABEL_MAP = { 'Gojo': 'gojo', 'Sukuna': 'sukuna', 'Mahito': 'mahito', 'Megumi': 'megumi' };
```

### Domain Configs (Line 2373-2378)
```javascript
const DOMAIN_CONFIGS = {
    gojo:   { type: 'gojo',   label: 'INFINITE VOID',                radius: 18, duration: 18, cssClass: 'domain-gojo',   bannerColor: '#44aaff', bannerText: 'INFINITE VOID' },
    sukuna: { type: 'sukuna', label: 'MALEVOLENT SHRINE',             radius: 18, duration: 20, cssClass: 'domain-sukuna', bannerColor: '#ff2222', bannerText: 'MALEVOLENT SHRINE' },
    mahito: { type: 'mahito', label: 'SELF-EMBODIMENT OF PERFECTION', radius: 18, duration: 15, cssClass: 'domain-mahito', bannerColor: '#aa44ff', bannerText: 'EMBODIMENT OF PERFECTION' },
    megumi: { type: 'megumi', label: 'CHIMERA SHADOW GARDEN',         radius: 18, duration: 20, cssClass: 'domain-megumi', bannerColor: '#3355cc', bannerText: 'CHIMERA SHADOW GARDEN' },
};
```

### Domain Expand Effects:
- **Gojo (INFINITE VOID):** Freezes all bots in 18-unit radius to 0.15 speed, gives player speed boost
- **Sukuna (MALEVOLENT SHRINE):** 8 damage/second to player if inside, aggros all bots
- **Mahito (EMBODIMENT OF PERFECTION):** Distorts player camera position randomly, buffs all bot dodges
- **Megumi (CHIMERA SHADOW GARDEN):** Spawns up to 6 shadow minions every 4 seconds

### Domain Manager Initialization (Line 3859)
```javascript
window.G.domainManager = new DomainManager();
```

---

## 5. BUTTON CLICK HANDLERS & EVENT LISTENERS

### Game Mode Selection (Line 2816)
```javascript
c.onclick = () => { this.selMode = m.id; this.buildPreplayUI(); };
```
- Click mode card (Extermination, Domain Siege, Cursed Hunt)
- Sets `this.selMode` and rebuilds UI

### Map Selection (Line 2826)
```javascript
c.onclick = () => { this.selMap = i; this.buildPreplayUI(); };
```
- Click map card (Arena, Warehouse, Rooftop, Desert, etc.)
- Sets `this.selMap` index

### Difficulty Selection (Line 2838)
```javascript
c.onclick = () => { this.selDiff = k; this.buildPreplayUI(); };
```
- Click difficulty card (easy, medium, hard, extreme)
- Sets `this.selDiff`

### Bot Count Selection (Line 2848)
```javascript
c.onclick = () => { this.selBots = n; this.buildPreplayUI(); };
```
- Click bot count button (1-6)
- Sets `this.selBots`

### Input Setup Function (Line 3730)
```javascript
setupInput() {
    document.addEventListener('keydown', e => {
        this.keys[e.code] = true;
        if (this.state === 'playing') {
            if (e.code === 'KeyR') this.startReload();           // Reload
            if (e.code === 'Digit1' || e.code === 'Numpad1') this.switchWeapon(0);
            if (e.code === 'Digit2' || e.code === 'Numpad2') this.switchWeapon(1);
            if (e.code === 'Digit3' || e.code === 'Numpad3') this.switchWeapon(2);
            if (e.code === 'Space' && this.onGround) { this.playerVel.y = this.JUMP_VEL; this.onGround = false; }  // Jump
            if (e.code === 'Escape') { /* Pause menu */ }
        }
    });
}
```

### Mouse Input (Line 3755-3793)
- **Left Click (mousedown):** Fire weapon or start charging
- **Right Click (mousedown):** Scope/zoom
- **Scroll wheel:** Switch weapons
- **Pointer lock:** Enables mouse look

---

## 6. UI SCREENS

### Screen IDs in HTML:
- `s-menu` - Main menu
- `s-preplay` - Pre-match selection screen
- `s-shop` - Shop/armory
- `s-loadout` - Weapon loadout
- `s-pause` - Pause menu
- `hud` - In-game HUD

### Show Screen Method (Line 2786-2792)
```javascript
showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('hud').classList.remove('active');
    this.state = id;
    if (id === 's-shop') { document.getElementById('shop-coins-val').textContent = save.coins; this.buildShopUI(); }
    if (id === 's-loadout') this.buildLoadoutUI();
}
```

---

## 7. MATCH START FLOW

### startMatch() Function (Line 3000+)
**Key steps:**
1. Line 3000: Check Three.js initialization
2. Line 3036: Apply character stats (HP, speed, damage mult)
3. Line 3056-3073: Build weapons array from loadout
4. Line 3075-3108: Game mode setup (survival/timed/elimination)
5. Line 3130-3136: Spawn bots with random JJK types
6. Line 3147-3156: Show HUD, request pointer lock

### Character Stats Applied (Line 3036-3040)
```javascript
const cdef = CDEFS.find(c => c.id === this.selChar) || CDEFS[0];
this.playerMaxHp = cdef.hp;
this.playerHp = cdef.hp;
this._charDmgMult = cdef.dmgMult;
this._charSpeedMult = cdef.speed;
```

---

## 8. SUMMARY TABLE

| Component | Location | Key Function | Trigger |
|-----------|----------|--------------|---------|
| Character Selection UI | Line 2851-2868 | `buildPreplayUI()` | Player clicks character card |
| Bot Spawn | Line 3107-3110 | `new Bot()` | Match start |
| Ability System | Line 1968-1971 | `useAbility()` | Ability cooldown expired & not patrolling |
| Domain Expansion | Line 1975-1978 | `domainManager.tryActivate()` | Bot HP < 30% |
| Domain Manager | Line 2381-2550 | `activate()` | Domain trigger |
| Input Events | Line 3730+ | `setupInput()` | Game initialization |
| Shop UI | Line 2878+ | `buildShopUI()` | Player opens shop |
| Loadout UI | Line 2962+ | `buildLoadoutUI()` | Player opens loadout |

---

## 9. AVAILABLE ABILITIES BY CHARACTER

### Player Perspective (CDEFS - Line 82-86)
Player chooses from: Soldier, Scout, Tank, Marksman, Berserker

### Bot/Enemy Perspective (JJK_CHARACTER_TYPES - Line 110-119)
Bots randomly spawn as: Gojo, Sukuna, Nanami, Mahito, Megumi, Yuji, Yuta, Toji, Geto

**NOTE:** Player character selection is separate from bot JJK type system. Players select basic character classes, while bots spawn with JJK cursed sorcerer types.
