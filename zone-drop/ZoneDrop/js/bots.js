// =============================================================================
// STORM ZONE — Bot Manager
// AI bots with FSM: WANDER → ENGAGE → FLEE_STORM.
// =============================================================================

class BotManager {
  constructor(scene, combat) {
    this.scene  = scene;
    this.combat = combat;

    this.bots = [];
    this._spawnAll();
  }

  _spawnAll() {
    const names = [
      'Shadow', 'Viper', 'Blaze', 'Echo', 'Storm',
      'Raven', 'Frost', 'Ember', 'Spike', 'Comet',
      'Drift', 'Nova', 'Titan', 'Ghost', 'Lynx',
      'Cipher', 'Razor', 'Pulse', 'Nexus',
    ];
    for (let i = 0; i < CFG.BOTS.COUNT; i++) {
      const sp  = randSpawn(30, CFG.MAP.HALF - 20);
      const name = names[i] || ('Bot' + i);
      this.bots.push(new Bot(this.scene, sp.x, sp.z, name, this.combat));
    }
  }

  update(dt, player, storm) {
    this.bots.forEach(b => b.update(dt, player, storm));
  }

  aliveCount() {
    return this.bots.filter(b => b.alive).length;
  }
}

// ────────────────────────────────────────────────────────────────────────────

class Bot {
  constructor(scene, x, z, name, combat) {
    this.scene  = scene;
    this.combat = combat;
    this.name   = name;

    this.position = new THREE.Vector3(x, terrainH(x, z) + 0.9, z);
    this.velocity = new THREE.Vector3();

    this.hp     = 100;
    this.shield = 0;
    this.alive  = true;

    // Pick a random weapon
    const wKeys  = Object.keys(CFG.WEAPONS);
    const wKey   = wKeys[Math.floor(Math.random() * wKeys.length)];
    this.weaponDef = CFG.WEAPONS[wKey];
    this.mag = this.weaponDef.mag;

    // FSM
    this.state            = 'WANDER';
    this.wanderTarget     = null;
    this.wanderTimer      = 0;
    this.engageTimer      = 0;  // how long chasing without LoS
    this.shootCooldown    = rand(0.3, 1.2); // staggered start

    this._buildMesh();
  }

  _buildMesh() {
    // Colour coded by weapon rarity
    const rarityColors = { common: 0xe74c3c, uncommon: 0xe67e22, rare: 0x8e44ad, epic: 0xc0392b, legendary: 0xf39c12 };
    const color = rarityColors[this.weaponDef.rarity] || 0xe74c3c;

    this.mesh = makeCharacterMesh(color);
    this.mesh.position.copy(this.position);
    this.mesh.userData.type = 'botGroup';
    this.scene.add(this.mesh);

    // Invisible hitbox for raycasting
    this.hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.8, 0.5),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitbox.position.copy(this.position);
    this.hitbox.userData.type = 'bot';
    this.hitbox.userData.bot  = this;
    this.scene.add(this.hitbox);
  }

  // ── Damage / death ────────────────────────────────────────────────────────
  takeDamage(amount) {
    if (!this.alive) return;
    if (this.shield > 0) {
      const abs = Math.min(this.shield, amount);
      this.shield -= abs; amount -= abs;
    }
    this.hp -= amount;
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.scene.remove(this.mesh);
    this.scene.remove(this.hitbox);
  }

  // ── Main update ───────────────────────────────────────────────────────────
  update(dt, player, storm) {
    if (!this.alive) return;

    this.shootCooldown -= dt;

    const pPos   = player.position;
    const myPos  = this.position;
    const distToPlayer = dist2D(myPos.x, myPos.z, pPos.x, pPos.z);
    const outsideStorm = storm.isOutside(myPos.x, myPos.z);

    // ── State transitions ──────────────────────────────────────────────────
    if (outsideStorm) {
      this.state = 'FLEE_STORM';
    } else if (this.state === 'FLEE_STORM' && !outsideStorm) {
      this.state = 'WANDER';
    } else if (distToPlayer < CFG.BOTS.SIGHT_RANGE && player.alive) {
      this.state = 'ENGAGE';
      this.engageTimer = 0;
    } else if (this.state === 'ENGAGE') {
      this.engageTimer += dt;
      if (this.engageTimer > 8) this.state = 'WANDER';
    }

    // ── Movement ──────────────────────────────────────────────────────────
    const speed = CFG.BOTS.SPEED;
    let moveX = 0, moveZ = 0;

    if (this.state === 'ENGAGE' && player.alive) {
      // Advance until within shoot range, then strafe
      if (distToPlayer > CFG.BOTS.SHOOT_RANGE * 0.65) {
        const dx = pPos.x - myPos.x, dz = pPos.z - myPos.z;
        const d  = Math.sqrt(dx * dx + dz * dz);
        moveX = dx / d; moveZ = dz / d;
      } else {
        // Circle-strafe: perpendicular to player direction
        const dx = pPos.x - myPos.x, dz = pPos.z - myPos.z;
        const d  = Math.sqrt(dx * dx + dz * dz);
        const perp = ((Math.floor(this.position.x * 10) % 2 === 0) ? 1 : -1);
        moveX = (-dz / d) * perp;
        moveZ = ( dx / d) * perp;
      }

      // Shoot
      if (this.shootCooldown <= 0 && distToPlayer < CFG.BOTS.SHOOT_RANGE && player.alive) {
        this._shoot(player);
        this.shootCooldown = 1 / this.weaponDef.rps + rand(0, 0.3);
      }

    } else if (this.state === 'FLEE_STORM') {
      // Move toward storm centre
      const dx = storm.cx - myPos.x, dz = storm.cz - myPos.z;
      const d  = Math.sqrt(dx * dx + dz * dz) || 1;
      moveX = dx / d; moveZ = dz / d;

    } else {
      // WANDER — pick a random target and walk to it
      this.wanderTimer -= dt;
      if (!this.wanderTarget || this.wanderTimer <= 0) {
        const sp = randSpawn(0, 80);
        this.wanderTarget = new THREE.Vector3(
          clamp(myPos.x + sp.x, -CFG.MAP.HALF + 5, CFG.MAP.HALF - 5),
          0,
          clamp(myPos.z + sp.z, -CFG.MAP.HALF + 5, CFG.MAP.HALF - 5)
        );
        this.wanderTimer = rand(...CFG.BOTS.WANDER_INTERVAL);
      }
      const dx = this.wanderTarget.x - myPos.x;
      const dz = this.wanderTarget.z - myPos.z;
      const d  = Math.sqrt(dx * dx + dz * dz);
      if (d > 1) { moveX = dx / d; moveZ = dz / d; } else { this.wanderTarget = null; }
    }

    // Apply movement
    this.position.x += moveX * speed * dt;
    this.position.z += moveZ * speed * dt;
    this.position.x  = clamp(this.position.x, -CFG.MAP.HALF + 1, CFG.MAP.HALF - 1);
    this.position.z  = clamp(this.position.z, -CFG.MAP.HALF + 1, CFG.MAP.HALF - 1);
    this.position.y  = terrainH(this.position.x, this.position.z) + 0.9;

    // Sync meshes
    this.mesh.position.copy(this.position);
    this.hitbox.position.copy(this.position);
    this.hitbox.position.y += 0.0;

    // Face direction of movement / target
    if (this.state === 'ENGAGE' && player.alive) {
      this.mesh.lookAt(player.position.x, this.position.y, player.position.z);
    } else if (Math.abs(moveX) + Math.abs(moveZ) > 0.01) {
      this.mesh.rotation.y = Math.atan2(moveX, moveZ);
    }

    // Bob animation: simple leg bob
    const bob = Math.sin(Date.now() * 0.006) * 0.06;
    this.mesh.position.y = this.position.y + bob;
  }

  _shoot(player) {
    if (!player.alive) return;
    // Delegate to CombatSystem
    const shootOrigin = this.position.clone();
    shootOrigin.y += 1.0;
    const dir = new THREE.Vector3(
      player.position.x - shootOrigin.x,
      (player.position.y + 0.9) - shootOrigin.y,
      player.position.z - shootOrigin.z
    ).normalize();

    this.combat.fireBotShot(shootOrigin, dir, this.weaponDef, this);
  }
}
