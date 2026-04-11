// =============================================================================
// STORM ZONE — Storm System
// Shrinking safe zone with visual ring and per-second damage.
// =============================================================================

class StormSystem {
  constructor(scene) {
    this.scene = scene;

    this.cx = CFG.STORM.CENTER_X;
    this.cz = CFG.STORM.CENTER_Z;

    this.phaseIndex  = 0;
    this.phaseTimer  = 0; // seconds elapsed in this phase
    this.shrinking   = false;

    this.currentRadius = CFG.STORM.START_RADIUS;
    this.targetRadius  = CFG.STORM.PHASES[0].radiusEnd;
    this.damagePerSec  = 0; // 0 while waiting

    this._damageTick = 0; // accumulates time for 1-second damage ticks

    this._buildVisuals();
    this._startWait();
  }

  // ── Visual ring ───────────────────────────────────────────────────────────
  _buildVisuals() {
    // Safe-zone ring: thin torus at the boundary
    this._ringGeo = new THREE.TorusGeometry(this.currentRadius, 0.6, 8, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x9b59b6, transparent: true, opacity: 0.85 });
    this._ringMesh = new THREE.Mesh(this._ringGeo, ringMat);
    this._ringMesh.rotation.x = Math.PI / 2;
    this._ringMesh.position.set(this.cx, 0.5, this.cz);
    this.scene.add(this._ringMesh);

    // Outer storm "wall" fog cylinder (semi-transparent purple)
    const wallGeo = new THREE.CylinderGeometry(CFG.MAP.HALF * 1.2, CFG.MAP.HALF * 1.2, 60, 32, 1, true);
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x6a0dad, transparent: true, opacity: 0.18, side: THREE.BackSide
    });
    this._wallMesh = new THREE.Mesh(wallGeo, wallMat);
    this._wallMesh.position.set(this.cx, 5, this.cz);
    this.scene.add(this._wallMesh);
  }

  _rebuildRing() {
    this.scene.remove(this._ringMesh);
    this._ringGeo.dispose();
    const r = Math.max(0.5, this.currentRadius);
    this._ringGeo = new THREE.TorusGeometry(r, 0.6, 8, 64);
    this._ringMesh.geometry = this._ringGeo;
    this.scene.add(this._ringMesh);
  }

  // ── Phase control ─────────────────────────────────────────────────────────
  _startWait() {
    if (this.phaseIndex >= CFG.STORM.PHASES.length) return;
    this.shrinking   = false;
    this.damagePerSec = 0;
    this.phaseTimer   = 0;
  }

  _startShrink() {
    this.shrinking    = true;
    this.phaseTimer   = 0;
    const ph          = CFG.STORM.PHASES[this.phaseIndex];
    this.damagePerSec = ph.damage;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(dt, bots, player) {
    if (this.phaseIndex >= CFG.STORM.PHASES.length) return;

    const ph = CFG.STORM.PHASES[this.phaseIndex];

    if (!this.shrinking) {
      // Waiting phase
      this.phaseTimer += dt;
      if (this.phaseTimer >= ph.wait) {
        this._startShrink();
      }
    } else {
      // Shrinking phase
      this.phaseTimer += dt;
      const t = Math.min(this.phaseTimer / ph.shrink, 1);
      const startR = (this.phaseIndex === 0)
        ? CFG.STORM.START_RADIUS
        : CFG.STORM.PHASES[this.phaseIndex - 1].radiusEnd;
      this.currentRadius = lerp(startR, ph.radiusEnd, t);

      // Update ring geometry every few frames (cheap threshold)
      this._rebuildRing();

      if (t >= 1) {
        this.currentRadius = ph.radiusEnd;
        this.phaseIndex++;
        if (this.phaseIndex < CFG.STORM.PHASES.length) {
          this._startWait();
        }
      }
    }

    // Damage anyone outside the safe zone once per second
    this._damageTick += dt;
    if (this._damageTick >= 1) {
      this._damageTick -= 1;
      this._applyDamage(player, bots);
    }

    // Keep ring Y close to terrain under the centre
    const baseY = terrainH(this.cx, this.cz);
    this._ringMesh.position.y = baseY + 0.5;
  }

  _applyDamage(player, bots) {
    if (this.damagePerSec <= 0) return;

    // Player
    if (player.alive) {
      const d = dist2D(player.position.x, player.position.z, this.cx, this.cz);
      if (d > this.currentRadius) {
        player.takeDamage(this.damagePerSec);
      }
    }

    // Bots
    bots.forEach(b => {
      if (!b.alive) return;
      const d = dist2D(b.position.x, b.position.z, this.cx, this.cz);
      if (d > this.currentRadius) {
        b.takeDamage(this.damagePerSec);
      }
    });
  }

  // ── Accessors used by UI / bots ───────────────────────────────────────────
  isOutside(x, z) {
    return dist2D(x, z, this.cx, this.cz) > this.currentRadius;
  }

  timeToNextPhase() {
    if (this.phaseIndex >= CFG.STORM.PHASES.length) return 0;
    const ph = CFG.STORM.PHASES[this.phaseIndex];
    if (!this.shrinking) return ph.wait - this.phaseTimer;
    return ph.shrink - this.phaseTimer;
  }

  statusText() {
    if (this.phaseIndex >= CFG.STORM.PHASES.length) return 'STORM CLOSED';
    return this.shrinking ? 'STORM MOVING' : 'SAFE ZONE';
  }

  phaseLabel() {
    return 'Phase ' + (this.phaseIndex + 1) + ' / ' + CFG.STORM.PHASES.length;
  }
}
