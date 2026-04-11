// =============================================================================
// STORM ZONE — Loot System
// Chests and floor loot, pickup interactions, consumables.
// =============================================================================

class LootSystem {
  constructor(scene, player) {
    this.scene  = scene;
    this.player = player;

    // All loot entities: { mesh, type:'chest'|'floor', item, opened }
    this.items = [];

    this._spawnAll();
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────
  _spawnAll() {
    for (let i = 0; i < CFG.LOOT.CHESTS; i++)        this._spawnChest();
    for (let i = 0; i < CFG.LOOT.WEAPON_CRATES; i++) this._spawnWeaponCrate();
    for (let i = 0; i < CFG.LOOT.FLOOR_LOOT; i++)    this._spawnFloorLoot();
  }

  _spawnChest() {
    const sp = randSpawn(10, CFG.MAP.HALF - 15);
    const y  = terrainH(sp.x, sp.z);

    // Chest body
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xc8a04e, roughness: 0.5, metalness: 0.3 })
    );
    body.castShadow = true;
    group.add(body);

    // Lid
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.2, 0.62),
      new THREE.MeshStandardMaterial({ color: 0xd4a843, roughness: 0.4, metalness: 0.35 })
    );
    lid.position.y = 0.37;
    lid.castShadow = true;
    group.add(lid);

    // Lock clasp
    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.18, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8 })
    );
    clasp.position.set(0, 0.2, 0.32);
    group.add(clasp);

    group.position.set(sp.x, y + 0.28, sp.z);
    group.rotation.y = Math.random() * Math.PI * 2;

    // Glow ring under chest
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.75, 16),
      new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(sp.x, y + 0.02, sp.z);
    this.scene.add(ring);

    group.userData.type = 'chest';
    this.scene.add(group);
    this.items.push({ mesh: group, type: 'chest', item: null, opened: false, ring });
  }

  _spawnWeaponCrate() {
    const sp = randSpawn(20, CFG.MAP.HALF - 20);
    const y  = terrainH(sp.x, sp.z);

    const group = new THREE.Group();

    // Military-style crate body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x3a5c3a, roughness: 0.7, metalness: 0.2 })
    );
    body.castShadow = true;
    group.add(body);

    // Metal edges
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.3, metalness: 0.7 });
    [[-0.6, 0], [0.6, 0]].forEach(([ox]) => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.72), edgeMat);
      edge.position.x = ox;
      group.add(edge);
    });

    // Weapon icon (crossed bars on top)
    const barMat = new THREE.MeshStandardMaterial({ color: 0xdd4444, roughness: 0.4, metalness: 0.5 });
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.06), barMat);
    bar1.position.y = 0.37;
    bar1.rotation.z = 0.3;
    group.add(bar1);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.06), barMat);
    bar2.position.y = 0.37;
    bar2.rotation.z = -0.3;
    group.add(bar2);

    group.position.set(sp.x, y + 0.35, sp.z);
    group.rotation.y = Math.random() * Math.PI * 2;

    // Red glow ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.85, 16),
      new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(sp.x, y + 0.02, sp.z);
    this.scene.add(ring);

    group.userData.type = 'weaponCrate';
    this.scene.add(group);
    this.items.push({ mesh: group, type: 'weaponCrate', item: null, opened: false, ring });
  }

  _spawnFloorLoot() {
    const sp = randSpawn(5, CFG.MAP.HALF - 10);
    const y  = terrainH(sp.x, sp.z);
    const rarity  = weightedRandom(CFG.LOOT.RARITY_WEIGHTS);
    const item    = this._randomItem(rarity);
    const color   = CFG.LOOT.RARITY_COLORS[rarity];

    const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(sp.x, y + 0.06, sp.z);

    // Item indicator
    const pill = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.35, 0.1),
      new THREE.MeshBasicMaterial({ color })
    );
    pill.position.set(sp.x, y + 0.35, sp.z);
    this.scene.add(pill);

    mesh.userData.type = 'floorLoot';
    this.scene.add(mesh);
    this.items.push({ mesh, type: 'floor', item, opened: false, pill });
  }

  // ── Item generation ───────────────────────────────────────────────────────
  _randomItem(rarity) {
    // Possible item types: weapon, ammo_light, ammo_heavy, ammo_sniper,
    //                      medkit, bandage, small_shield, large_shield
    const roll = Math.random();
    if (roll < 0.4) {
      // Weapon
      const weapons = Object.keys(CFG.WEAPONS);
      // Filter by rarity
      const matching = weapons.filter(id => {
        const wr = CFG.WEAPONS[id].rarity;
        return wr === rarity;
      });
      const pool = matching.length > 0 ? matching : weapons;
      const id   = pool[Math.floor(Math.random() * pool.length)];
      return { type: 'weapon', id, rarity };
    }
    if (roll < 0.6) {
      const ammos = ['light', 'heavy', 'sniper'];
      const at    = ammos[Math.floor(Math.random() * ammos.length)];
      return { type: 'ammo', ammoType: at, amount: at === 'sniper' ? 5 : 30, rarity };
    }
    if (roll < 0.75) return { type: 'medkit',  healAmount: 50, rarity };
    if (roll < 0.85) return { type: 'bandage', healAmount: 15, rarity };
    if (roll < 0.93) return { type: 'small_shield', amount: 25, rarity };
    return                  { type: 'large_shield', amount: 50, rarity };
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(dt) {
    if (!this.player.alive) return;
    const pPos = this.player.position;

    let nearestDist = Infinity;
    let nearest     = null;

    this.items.forEach(it => {
      if (it.opened) return;
      const d = dist2D(pPos.x, pPos.z, it.mesh.position.x, it.mesh.position.z);

      if (d < CFG.LOOT.INTERACT_DIST) {
        if (d < nearestDist) {
          nearestDist = d;
          nearest     = it;
        }
        // Bobbing animation for proximity
        it.mesh.rotation.y += dt * 1.5;
      }
    });

    // Show interact prompt
    const prompt = document.getElementById('interactPrompt');
    if (nearest && prompt) {
      const label = nearest.type === 'chest' ? 'Open Chest'
                  : nearest.type === 'weaponCrate' ? 'Open Weapon Crate'
                  : this._itemLabel(nearest.item);
      prompt.textContent = '[E] ' + label;
      prompt.style.display = 'block';
    } else if (prompt) {
      prompt.style.display = 'none';
    }

    // Pickup on E
    if (nearest && this.player.input.justPressed('KeyE')) {
      if (nearest.type === 'chest') {
        this._openChest(nearest);
      } else if (nearest.type === 'weaponCrate') {
        this._openWeaponCrate(nearest);
      } else {
        this._pickup(nearest);
      }
    }
  }

  _itemLabel(item) {
    if (!item) return 'Pick up';
    switch (item.type) {
      case 'weapon':       return CFG.WEAPONS[item.id]?.name || 'Weapon';
      case 'ammo':         return item.ammoType + ' ammo ×' + item.amount;
      case 'medkit':       return 'Med-Kit (+' + item.healAmount + 'HP)';
      case 'bandage':      return 'Bandage (+' + item.healAmount + 'HP)';
      case 'small_shield': return 'Shield Sip (+' + item.amount + ')';
      case 'large_shield': return 'Shield Jug (+' + item.amount + ')';
      default:             return 'Item';
    }
  }

  _openChest(ent) {
    // Drop 2-3 items
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const rarity = weightedRandom(CFG.LOOT.RARITY_WEIGHTS);
      const item   = this._randomItem(rarity);
      this._applyItem(item);
    }
    this._removeEntity(ent);
    spawnSpark(this.scene, ent.mesh.position.clone(), 0xffdd44);
  }

  _openWeaponCrate(ent) {
    // Always drops 1-2 weapons, plus ammo
    const weaponKeys = Object.keys(CFG.WEAPONS);
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const id = weaponKeys[Math.floor(Math.random() * weaponKeys.length)];
      this._applyItem({ type: 'weapon', id, rarity: CFG.WEAPONS[id].rarity });
    }
    // Bonus ammo
    const ammos = ['light', 'heavy', 'sniper'];
    const at = ammos[Math.floor(Math.random() * ammos.length)];
    this._applyItem({ type: 'ammo', ammoType: at, amount: at === 'sniper' ? 10 : 60 });
    this._removeEntity(ent);
    spawnSpark(this.scene, ent.mesh.position.clone(), 0xff4444);
  }

  _pickup(ent) {
    if (ent.item) this._applyItem(ent.item);
    this._removeEntity(ent);
  }

  _applyItem(item) {
    const p = this.player;
    switch (item.type) {
      case 'weapon':
        p.giveWeapon(item.id);
        break;
      case 'ammo':
        p.ammo[item.ammoType] = Math.min(
          (p.ammo[item.ammoType] || 0) + item.amount,
          999
        );
        break;
      case 'medkit':
        p.heal(item.healAmount);
        break;
      case 'bandage':
        p.heal(item.healAmount);
        break;
      case 'small_shield':
        p.addShield(item.amount);
        break;
      case 'large_shield':
        p.addShield(item.amount);
        break;
    }
  }

  _removeEntity(ent) {
    ent.opened = true;
    this.scene.remove(ent.mesh);
    if (ent.ring)  this.scene.remove(ent.ring);
    if (ent.pill)  this.scene.remove(ent.pill);
  }
}
