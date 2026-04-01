// =============================================================================
// STORM ZONE — Player System
// Third-person controller, camera, inventory, stats.
// =============================================================================

class PlayerSystem {
  constructor(scene, camera, input) {
    this.scene  = scene;
    this.camera = camera;
    this.input  = input;

    // ── World state ──────────────────────────────────────────────────────
    this.position = new THREE.Vector3(0, 10, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.onGround = false;
    this.crouching = false;
    this.sprinting = false;

    // ── Camera orbit ─────────────────────────────────────────────────────
    this.camYaw   = Math.PI;  // start facing -Z  (south)
    this.camPitch = 0.3;      // slight downward angle
    this._camTarget = new THREE.Vector3();

    // ── Combat stats ─────────────────────────────────────────────────────
    this.hp      = CFG.PLAYER.MAX_HP;
    this.shield  = 0;
    this.alive   = true;
    this.kills   = 0;

    // ── Inventory: 5 weapon slots + ammo pool ────────────────────────────
    this.weapons     = [null, null, null, null, null];
    this.currentSlot = 0;
    this.ammo = { light: 60, heavy: 30, sniper: 10, rocket: 2 };

    // ── Building resources ───────────────────────────────────────────────
    this.resources = { wood: 100, stone: 50, metal: 0 };

    // ── Build mode (managed by BuildingSystem, we just carry state) ───────
    this.buildMode = false;

    // ── Internal timers ─────────────────────────────────────────────────
    this._shotCooldown  = 0;
    this._reloadTimer   = 0;
    this._reloading     = false;
    this._damageCooldown = 0; // invincibility frames after hit

    this._buildMesh();
    this._initWeapon();
  }

  // ── Mesh Setup ───────────────────────────────────────────────────────────
  _buildMesh() {
    this.group = makeCharacterMesh(0x2980b9);
    this.group.position.copy(this.position);
    this.scene.add(this.group);

    // Held weapon visual (updated when equipping)
    this.weaponVisual = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x555555 })
    );
    this.weaponVisual.position.set(0.5, 0.2, 0.25);
    this.group.add(this.weaponVisual);
  }

  _initWeapon() {
    // Give the player a starting Blast Rifle
    this.giveWeapon('blast_rifle');
  }

  // ── Weapon Management ────────────────────────────────────────────────────

  /** Add a weapon to the next free slot.  Returns true if picked up. */
  giveWeapon(weaponId) {
    const def = CFG.WEAPONS[weaponId];
    if (!def) return false;

    // If already held, top up ammo instead
    for (let i = 0; i < this.weapons.length; i++) {
      if (this.weapons[i] && this.weapons[i].id === weaponId) {
        this.ammo[def.ammoType] = Math.min(
          this.ammo[def.ammoType] + def.maxAmmo * 0.3,
          def.maxAmmo * 2
        );
        return true;
      }
    }

    const freeSlot = this.weapons.findIndex(w => w === null);
    if (freeSlot === -1) return false; // inventory full

    this.weapons[freeSlot] = {
      id: weaponId,
      def,
      mag: def.mag, // current magazine
    };
    if (this.weapons[this.currentSlot] === null) {
      this.currentSlot = freeSlot;
    }
    this._refreshWeaponVisual();
    return true;
  }

  currentWeapon() { return this.weapons[this.currentSlot]; }

  switchSlot(slot) {
    if (slot < 0 || slot >= this.weapons.length) return;
    if (slot === this.currentSlot) return;
    this.currentSlot = slot;
    this._reloading = false;
    this._reloadTimer = 0;
    this._refreshWeaponVisual();
  }

  _refreshWeaponVisual() {
    const w = this.currentWeapon();
    if (w) {
      this.weaponVisual.material.color.setHex(w.def.color);
      this.weaponVisual.visible = true;
    } else {
      this.weaponVisual.visible = false;
    }
  }

  // ── Shooting API (called by CombatSystem) ────────────────────────────────

  /** Returns the current weapon if it can fire right now (not on cooldown, has ammo). */
  tryFire() {
    if (!this.alive || this._reloading || this.buildMode) return null;
    const w = this.currentWeapon();
    if (!w) return null;
    if (this._shotCooldown > 0) return null;
    if (w.mag <= 0) {
      this.startReload();
      return null;
    }
    // Consume ammo
    w.mag--;
    this._shotCooldown = 1 / w.def.rps;
    return w;
  }

  startReload() {
    const w = this.currentWeapon();
    if (!w || this._reloading) return;
    if (this.ammo[w.def.ammoType] <= 0) return;
    if (w.mag >= w.def.mag) return;
    this._reloading = true;
    this._reloadTimer = w.def.reload;
  }

  // ── Damage ───────────────────────────────────────────────────────────────

  takeDamage(amount) {
    if (!this.alive) return;
    if (this._damageCooldown > 0) return; // invincibility frames
    this._damageCooldown = 0.08;

    // Shields absorb first
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
    }
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }

    // Red flash
    const flash = document.getElementById('hitFlash');
    if (flash) {
      flash.style.background = 'rgba(231,76,60,0.35)';
      setTimeout(() => { flash.style.background = 'rgba(231,76,60,0)'; }, 120);
    }
  }

  heal(amount) {
    this.hp = Math.min(CFG.PLAYER.MAX_HP, this.hp + amount);
  }

  addShield(amount) {
    this.shield = Math.min(CFG.PLAYER.MAX_SHIELD, this.shield + amount);
  }

  // ── Update ───────────────────────────────────────────────────────────────

  update(dt) {
    if (!this.alive) return;

    this._damageCooldown = Math.max(0, this._damageCooldown - dt);
    this._shotCooldown   = Math.max(0, this._shotCooldown   - dt);

    this._handleInput(dt);
    this._applyPhysics(dt);
    this._updateReload(dt);
    this._updateCamera();
    this._updateAnimation(dt);
  }

  _updateAnimation(dt) {
    const mixer = this.group.userData.mixer;
    if (!mixer) return;
    mixer.update(dt);

    // Choose animation based on movement
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (speed > 1) {
      setCharacterAnim(this.group, this.sprinting ? 'Run' : 'Run');
    } else {
      setCharacterAnim(this.group, 'Idle');
    }
  }

  _handleInput(dt) {
    const inp = this.input;

    // Camera look (mouse + mobile right joystick)
    if (inp.locked) {
      const lookX = inp.mouseX + inp.joyLookX;
      const lookY = inp.mouseY + inp.joyLookY;
      this.camYaw   -= lookX * CFG.PLAYER.MOUSE_SENS;
      this.camPitch -= lookY * CFG.PLAYER.MOUSE_SENS;
      this.camPitch  = clamp(this.camPitch, CFG.PLAYER.CAM_PITCH_MIN, CFG.PLAYER.CAM_PITCH_MAX);
    }

    // Crouch toggle
    if (inp.justPressed('KeyC')) this.crouching = !this.crouching;

    // Sprint (hold Shift)
    this.sprinting = inp.keys['ShiftLeft'] && !this.crouching && this.onGround;

    // Jump
    if (inp.justPressed('Space') && this.onGround) {
      this.velocity.y = CFG.PLAYER.JUMP_POWER;
      this.onGround = false;
    }

    // Weapon slots via number keys 1-5
    for (let i = 0; i < 5; i++) {
      if (inp.justPressed('Digit' + (i + 1))) this.switchSlot(i);
    }
    // Scroll to cycle slots
    if (inp.scrollDelta !== 0) {
      const dir = inp.scrollDelta > 0 ? 1 : -1;
      this.switchSlot((this.currentSlot + dir + 5) % 5);
    }

    // Reload
    if (inp.justPressed('KeyR')) this.startReload();

    // Horizontal movement — only when not in build mode (BuildingSystem sets this)
    if (!this.buildMode) {
      const speed = this.sprinting  ? CFG.PLAYER.SPEED * CFG.PLAYER.SPRINT_MULT
                  : this.crouching  ? CFG.PLAYER.SPEED * CFG.PLAYER.CROUCH_MULT
                  : CFG.PLAYER.SPEED;

      let mx = 0, mz = 0;
      if (inp.keys['KeyW']) mz -= 1;
      if (inp.keys['KeyS']) mz += 1;
      if (inp.keys['KeyA']) mx -= 1;
      if (inp.keys['KeyD']) mx += 1;

      // Merge mobile joystick input
      mx += inp.joyMoveX;
      mz += inp.joyMoveY;

      const len = Math.sqrt(mx * mx + mz * mz);
      if (len > 0) { mx /= len; mz /= len; }

      // Rotate movement by camera yaw
      const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
      this.velocity.x = (mx * cy + mz * sy) * speed;
      this.velocity.z = (-mx * sy + mz * cy) * speed;

      // Face movement direction
      if (len > 0) {
        const wx = mx * cy + mz * sy;
        const wz = -mx * sy + mz * cy;
        const tgt = Math.atan2(wx, wz);
        this.group.rotation.y = lerpAngle(this.group.rotation.y, tgt, 12 * dt);
      }
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  _applyPhysics(dt) {
    // Gravity
    this.velocity.y += CFG.PLAYER.GRAVITY * dt;

    // Integrate
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Map bounds
    this.position.x = clamp(this.position.x, -CFG.MAP.HALF + 1, CFG.MAP.HALF - 1);
    this.position.z = clamp(this.position.z, -CFG.MAP.HALF + 1, CFG.MAP.HALF - 1);

    // Ground
    const groundY = terrainH(this.position.x, this.position.z) + CFG.PLAYER.HEIGHT / 2;
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.onGround = true;
    } else if (this.velocity.y < 0) {
      this.onGround = false;
    }

    // Crouch squash
    this.group.scale.y = this.crouching ? 0.7 : 1.0;
    this.group.position.copy(this.position);
  }

  _updateReload(dt) {
    if (!this._reloading) return;
    this._reloadTimer -= dt;
    if (this._reloadTimer <= 0) {
      const w = this.currentWeapon();
      if (w) {
        const need = w.def.mag - w.mag;
        const have = this.ammo[w.def.ammoType];
        const fill = Math.min(need, have);
        w.mag += fill;
        this.ammo[w.def.ammoType] -= fill;
      }
      this._reloading = false;
      this._reloadTimer = 0;
    }
  }

  _updateCamera() {
    const p  = this.position;
    const yh = CFG.PLAYER.CAM_HEIGHT;

    // Look-at is slightly above player feet
    this._camTarget.set(p.x, p.y + yh, p.z);

    const dist  = CFG.PLAYER.CAM_DIST;
    const pitch = this.camPitch;
    const yaw   = this.camYaw;

    const hDist = Math.cos(pitch) * dist;
    const camPos = new THREE.Vector3(
      p.x + Math.sin(yaw) * hDist,
      p.y + yh + Math.sin(pitch) * dist,
      p.z + Math.cos(yaw) * hDist
    );

    // Simple camera-terrain clip: push camera up if below ground
    const camGround = terrainH(camPos.x, camPos.z) + 0.5;
    if (camPos.y < camGround) camPos.y = camGround;

    this.camera.position.copy(camPos);
    this.camera.lookAt(this._camTarget);
  }

  // ── Ray from camera centre (for shooting / interaction) ─────────────────
  getAimRay() {
    // Direction from camera toward the look-at point
    const dir = new THREE.Vector3();
    dir.subVectors(this._camTarget, this.camera.position).normalize();
    return new THREE.Ray(this.camera.position.clone(), dir);
  }

  isReloading() { return this._reloading; }
  reloadProgress() {
    const w = this.currentWeapon();
    if (!w || !this._reloading) return 1;
    return 1 - this._reloadTimer / w.def.reload;
  }
}
