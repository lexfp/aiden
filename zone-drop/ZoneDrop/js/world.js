// =============================================================================
// STORM ZONE — World System
// Builds terrain, lighting, static environment objects.
// =============================================================================

class WorldSystem {
  constructor(scene) {
    this.scene = scene;
    // Objects that can be hit by raycasts (bullets / interaction)
    this.collidables = [];
    // Resource nodes: { mesh, type:'tree'|'rock', hits, maxHits }
    this.resourceNodes = [];

    this._buildLights();
    this._buildTerrain();
    this._buildEnvironment();
  }

  // ── Lighting ──────────────────────────────────────────────────────────────
  _buildLights() {
    const s = this.scene;
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x4a7c59, 0.8);
    s.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sun.position.set(200, 300, 100);
    sun.castShadow = false; // shadows too expensive without a GPU hint
    s.add(sun);
  }

  // ── Terrain ───────────────────────────────────────────────────────────────
  _buildTerrain() {
    const segs = 120;
    const geo = new THREE.PlaneGeometry(CFG.MAP.SIZE, CFG.MAP.SIZE, segs, segs);
    const pos = geo.attributes.position;

    // Displace Z (height) of each vertex to match terrainH(worldX, worldZ).
    // PlaneGeometry lies in XY before rotation; after rotation.x = -PI/2:
    //   geo X → world X, geo Y → world -Z, geo Z → world Y (height)
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = -pos.getY(i); // geometry Y flips to -Z after rotation
      pos.setZ(i, terrainH(wx, wz));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ color: CFG.WORLD.GROUND_COLOR });
    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.rotation.x = -Math.PI / 2;
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.userData.type = 'terrain';
    this.scene.add(this.terrainMesh);
    this.collidables.push(this.terrainMesh);
  }

  // ── Static Environment ────────────────────────────────────────────────────
  _buildEnvironment() {
    this._spawnTrees();
    this._spawnRocks();
    this._spawnHouses();
  }

  _placeOnTerrain(obj, x, z, yOffset = 0) {
    const y = terrainH(x, z) + yOffset;
    obj.position.set(x, y, z);
  }

  _spawnTrees() {
    for (let i = 0; i < CFG.WORLD.TREE_COUNT; i++) {
      const sp = randSpawn(20, CFG.MAP.HALF - 10);
      const x = sp.x, z = sp.z;
      const scale = rand(0.8, 1.4);

      const group = new THREE.Group();

      // Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2 * scale, 7),
        new THREE.MeshLambertMaterial({ color: 0x6B4226 })
      );
      trunk.position.y = scale;
      group.add(trunk);

      // Canopy (two overlapping spheres for bulk)
      [0, 1.2 * scale].forEach(yo => {
        const canopy = new THREE.Mesh(
          new THREE.SphereGeometry(1.4 * scale - yo * 0.2, 7, 6),
          new THREE.MeshLambertMaterial({ color: 0x2d6a2d })
        );
        canopy.position.y = 2.5 * scale + yo;
        group.add(canopy);
      });

      this._placeOnTerrain(group, x, z, 0);
      group.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(group);

      // Collision box for bullets + resource interaction
      const hitbox = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 3 * scale, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitbox.position.copy(group.position);
      hitbox.position.y += scale;
      hitbox.userData.type = 'resource';
      hitbox.userData.resType = 'tree';
      hitbox.userData.hits = 0;
      hitbox.userData.maxHits = CFG.WORLD.HIT_COUNT;
      hitbox.userData.group = group;
      this.scene.add(hitbox);
      this.collidables.push(hitbox);
      this.resourceNodes.push(hitbox);
    }
  }

  _spawnRocks() {
    for (let i = 0; i < CFG.WORLD.ROCK_COUNT; i++) {
      const sp = randSpawn(15, CFG.MAP.HALF - 10);
      const x = sp.x, z = sp.z;
      const scale = rand(0.6, 1.8);

      const group = new THREE.Group();
      // Multiple box shards for a rocky look
      for (let j = 0; j < 3; j++) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.6 * scale, 0),
          new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        rock.position.set(
          (Math.random() - 0.5) * 0.6 * scale,
          j * 0.3 * scale,
          (Math.random() - 0.5) * 0.6 * scale
        );
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(rock);
      }

      this._placeOnTerrain(group, x, z, 0);
      this.scene.add(group);

      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(1.5 * scale, 1.2 * scale, 1.5 * scale),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitbox.position.copy(group.position);
      hitbox.position.y += 0.6 * scale;
      hitbox.userData.type = 'resource';
      hitbox.userData.resType = 'rock';
      hitbox.userData.hits = 0;
      hitbox.userData.maxHits = CFG.WORLD.HIT_COUNT;
      hitbox.userData.group = group;
      this.scene.add(hitbox);
      this.collidables.push(hitbox);
      this.resourceNodes.push(hitbox);
    }
  }

  _spawnHouses() {
    const positions = [
      [-60, -80], [80, 60], [-100, 120], [150, -30],
      [-180, 50], [40, 180], [120, 130], [-140, -160],
      [200, -120], [-70, 220], [90, -190], [230, 100],
    ];
    positions.slice(0, CFG.WORLD.HOUSE_COUNT).forEach(([x, z]) => {
      this._buildHouse(x, z);
    });
  }

  _buildHouse(cx, cz) {
    const baseY = terrainH(cx, cz);
    const W = rand(10, 16), D = rand(8, 14), H = rand(4, 6);

    // Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xd4b483 });
    const wallGeo = new THREE.BoxGeometry(W, H, D);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(cx, baseY + H / 2, cz);
    wall.userData.type = 'structure';
    wall.userData.hp = 500;
    wall.userData.maxHp = 500;
    this.scene.add(wall);
    this.collidables.push(wall);

    // Roof
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8B3A3A });
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, W * 0.72, H * 0.6, 4),
      roofMat
    );
    roof.position.set(cx, baseY + H + H * 0.3, cz);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);

    // Floor pad
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.5, 0.3, D + 0.5),
      floorMat
    );
    floor.position.set(cx, baseY - 0.1, cz);
    this.scene.add(floor);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Get an array of collidable meshes for raycasting. */
  getCollidables() {
    return this.collidables;
  }
}
