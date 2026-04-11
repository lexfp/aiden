// =============================================================================
// STORM ZONE — Combat System
// Shooting, hitscan / projectile resolution, hit effects.
// =============================================================================

class CombatSystem {
  constructor(scene, player, world) {
    this.scene   = scene;
    this.player  = player;
    this.world   = world;

    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = 800;

    // Active projectiles: { mesh, vel:Vector3, damage, splashR, owner, life }
    this._projectiles = [];

    // Visual bullet tracers: { points[], mesh, life }
    this._tracers = [];

    // References set externally after construction
    this.network      = null; // set by Game (NetworkManager)
    this.lootSystem   = null; // set by Game (for harvesting resource nodes)
    this.onKillFeed   = null; // callback(killerName, victimName)
  }

  // ── Per-frame update ─────────────────────────────────────────────────────
  update(dt) {
    this._handlePlayerFire();
    this._tickProjectiles(dt);
    this._tickTracers(dt);
  }

  // ── Player shooting ───────────────────────────────────────────────────────
  _handlePlayerFire() {
    const inp = this.player.input;
    const w   = this.player.currentWeapon();
    if (!w) return;

    const auto = w.def.rps >= 3; // auto-fire for high RPS weapons
    const wantFire = auto ? inp.mouseLeft : inp._leftJust;
    if (!wantFire) return;

    const fired = this.player.tryFire();
    if (!fired) return;

    const def = fired.def;
    const origin = this.player.camera.position.clone();

    // Camera forward direction
    const forward = new THREE.Vector3();
    forward.subVectors(this.player._camTarget, origin).normalize();

    if (def.type === 'hitscan') {
      const pellets = def.pellets || 1;
      for (let p = 0; p < pellets; p++) {
        const dir = forward.clone();
        if (def.spread > 0) {
          dir.x += (Math.random() - 0.5) * def.spread * 2;
          dir.y += (Math.random() - 0.5) * def.spread * 2;
          dir.z += (Math.random() - 0.5) * def.spread * 2;
          dir.normalize();
        }
        this._fireHitscan(origin, dir, def, 'player');
      }
    } else {
      // Projectile (e.g., Detonator)
      this._spawnProjectile(origin, forward, def, 'player');
    }
  }

  // ── Hitscan ───────────────────────────────────────────────────────────────
  _fireHitscan(origin, direction, def, ownerTag) {
    this._raycaster.set(origin, direction);

    const maxRange = def.range || 800;
    this._raycaster.far = maxRange;

    // Collect all hittable objects
    const targets = [...this.world.getCollidables()];
    if (this.network) {
      targets.push(...this.network.getHitboxes());
    }
    // Don't hit the player's own mesh
    const hits = this._raycaster.intersectObjects(targets, false);

    let hitPoint = null;
    if (hits.length > 0) {
      const h = hits[0];
      hitPoint = h.point.clone();

      const ud = h.object.userData;
      if (ud.type === 'remotePlayer' && ownerTag === 'player') {
        // Hit a real player — send damage through network
        const hitY = h.point.y;
        const playerY = h.object.position.y;
        const headshot = hitY > playerY + 0.9;
        const dmg = def.damage * (headshot ? 1.5 : 1.0);
        this.network.sendHit(ud.playerId, dmg, headshot);
        spawnSpark(this.scene, hitPoint, 0xff4444);
      } else if (ud.type === 'resource' && ownerTag === 'player') {
        // Harvest resource node with melee/shots
        this._harvestNode(ud);
        spawnSpark(this.scene, hitPoint, 0xddaa55);
      } else if (ud.type === 'structure' || ud.type === 'terrain') {
        spawnSpark(this.scene, hitPoint, 0xcccccc);
        if (ud.type === 'structure' && ud.hp !== undefined) {
          ud.hp -= def.damage * 0.5;
          if (ud.hp <= 0 && ud.group) {
            this.scene.remove(h.object);
          }
        }
      }
    } else {
      // No hit: tracer goes full range
      hitPoint = origin.clone().addScaledVector(direction, maxRange);
    }

    // Draw tracer line
    this._addTracer(origin, hitPoint, def.color || 0xffff88);

    // Broadcast shot to other players
    if (ownerTag === 'player' && this.network) {
      this.network.sendShoot(origin, direction, def.color || 0xffff88, hitPoint);
    }
  }

  // ── Projectile (rocket / grenade) ─────────────────────────────────────────
  _spawnProjectile(origin, direction, def, ownerTag) {
    const geo  = new THREE.SphereGeometry(0.18, 6, 6);
    const mat  = new THREE.MeshBasicMaterial({ color: def.color || 0xff4500 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    this._projectiles.push({
      mesh,
      vel: direction.clone().multiplyScalar(def.projSpeed || 60),
      damage: def.damage,
      splashR: def.splashR || 5,
      ownerTag,
      life: 0,
      maxLife: 6,
    });
  }

  _tickProjectiles(dt) {
    this._projectiles = this._projectiles.filter(p => {
      p.life += dt;
      if (p.life > p.maxLife) {
        this.scene.remove(p.mesh);
        return false;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 10 * dt; // gravity on rocket

      // Check terrain collision
      const groundY = terrainH(p.mesh.position.x, p.mesh.position.z);
      if (p.mesh.position.y <= groundY + 0.2) {
        this._explode(p.mesh.position, p.damage, p.splashR, p.ownerTag);
        this.scene.remove(p.mesh);
        return false;
      }

      // Check target collision (remote players)
      if (p.ownerTag === 'player' && this.network) {
        for (const hb of this.network.getHitboxes()) {
          const d = p.mesh.position.distanceTo(hb.position);
          if (d < 1.5) {
            this._explode(p.mesh.position, p.damage, p.splashR, p.ownerTag);
            this.scene.remove(p.mesh);
            p.life = p.maxLife;
            break;
          }
        }
      }
      return p.life < p.maxLife;
    });
  }

  _explode(pos, damage, radius, ownerTag) {
    spawnSpark(this.scene, pos, 0xff6600);
    // Splash damage to remote players
    if (ownerTag === 'player' && this.network) {
      for (const hb of this.network.getHitboxes()) {
        const d = pos.distanceTo(hb.position);
        if (d < radius) {
          const splashDmg = damage * (1 - d / radius);
          this.network.sendHit(hb.userData.playerId, splashDmg, false);
        }
      }
    }
  }

  // ── Resource harvesting ───────────────────────────────────────────────────
  _harvestNode(ud) {
    ud.hits++;
    if (ud.hits >= ud.maxHits) {
      // Grant resources
      if (ud.resType === 'tree') {
        this.player.resources.wood += CFG.WORLD.TREE_WOOD;
      } else if (ud.resType === 'rock') {
        this.player.resources.stone += CFG.WORLD.ROCK_STONE;
      }
      // Remove node mesh
      if (ud.group) this.scene.remove(ud.group);
      // Remove hitbox from world collidables
      const idx = this.world.collidables.indexOf(ud.group);
      if (idx !== -1) this.world.collidables.splice(idx, 1);
      ud.hits = ud.maxHits + 100; // prevent re-harvesting
    }
  }

  // ── Tracers ───────────────────────────────────────────────────────────────
  _addTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this._tracers.push({ line, life: 0, maxLife: 0.06 });
  }

  _tickTracers(dt) {
    this._tracers = this._tracers.filter(t => {
      t.life += dt;
      t.line.material.opacity = 0.8 * (1 - t.life / t.maxLife);
      if (t.life >= t.maxLife) {
        this.scene.remove(t.line);
        return false;
      }
      return true;
    });
  }
}
