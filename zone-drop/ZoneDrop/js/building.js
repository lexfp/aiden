// =============================================================================
// STORM ZONE — Building System
// Grid-snapped structure placement with ghost preview.
// =============================================================================

class BuildingSystem {
  constructor(scene, player, input, camera) {
    this.scene  = scene;
    this.player = player;
    this.input  = input;
    this.camera = camera;

    this.active = false; // build mode on/off

    // Piece type: 'wall' | 'floor' | 'ramp' | 'roof'
    this.pieceType = 'wall';
    this.pieceRot  = 0; // 0,1,2,3 × 90° around Y

    // Built structures for collision / destruction
    this.structures = [];

    // Ghost (preview) mesh
    this._ghost = null;
    this._ghostValid = false;

    this._raycaster = new THREE.Raycaster();

    // Ghost materials
    this._matOK  = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.4, depthWrite: false });
    this._matBad = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.4, depthWrite: false });

    this._buildGhost();
  }

  // ── Ghost mesh ────────────────────────────────────────────────────────────
  _buildGhost() {
    const geo = this._geometryForPiece(this.pieceType);
    this._ghost = new THREE.Mesh(geo, this._matOK.clone());
    this._ghost.visible = false;
    this.scene.add(this._ghost);
  }

  _geometryForPiece(type) {
    const G = CFG.BUILDING;
    switch (type) {
      case 'wall':  return new THREE.BoxGeometry(G.W, G.H, G.THICK);
      case 'floor': return new THREE.BoxGeometry(G.W, G.THICK, G.W);
      case 'ramp':  return new THREE.BoxGeometry(G.W, G.H, G.W);
      case 'roof':  return new THREE.BoxGeometry(G.W, G.THICK, G.W);
      default:      return new THREE.BoxGeometry(G.W, G.H, G.THICK);
    }
  }

  // ── Toggle / input ────────────────────────────────────────────────────────
  toggle() {
    this.active = !this.active;
    this.player.buildMode = this.active;
    this._ghost.visible = this.active;
  }

  update(dt) {
    const inp = this.input;

    // Toggle build mode with F
    if (inp.justPressed('KeyF')) this.toggle();

    if (!this.active) return;

    // Piece type keys
    const types = ['wall', 'floor', 'ramp', 'roof'];
    for (let i = 0; i < types.length; i++) {
      if (inp.justPressed('Digit' + (i + 1))) {
        this.pieceType = types[i];
        this._rebuildGhost();
      }
    }

    // Rotate with Q
    if (inp.justPressed('KeyQ')) {
      this.pieceRot = (this.pieceRot + 1) % 4;
    }

    // Update ghost position
    this._updateGhostPosition();

    // Place on left click
    if (inp._leftJust && this._ghostValid) {
      this._place();
    }

    // Exit on right click
    if (inp.mouseRight) {
      this.active = false;
      this.player.buildMode = false;
      this._ghost.visible = false;
    }
  }

  _rebuildGhost() {
    this.scene.remove(this._ghost);
    this._buildGhost();
    this._ghost.visible = this.active;
  }

  // ── Ghost position via raycast ────────────────────────────────────────────
  _updateGhostPosition() {
    // Raycast from camera toward terrain / structures
    const dir = new THREE.Vector3();
    dir.subVectors(this.player._camTarget, this.camera.position).normalize();
    this._raycaster.set(this.camera.position, dir);
    this._raycaster.far = 20;

    const hits = this._raycaster.intersectObjects(
      [this.player.group.parent ? null : null, // skip player self
      ...this.structures.map(s => s.mesh)].filter(Boolean),
      false
    );

    // Fall back to terrain ray
    let placePos;
    const terrRay = this._raycastTerrain();
    if (terrRay) {
      placePos = terrRay;
    } else {
      placePos = this.player.position.clone();
      placePos.z -= 4;
    }

    // Snap to grid
    const G = CFG.BUILDING.GRID;
    placePos.x = snap(placePos.x, G);
    placePos.z = snap(placePos.z, G);

    // Determine Y based on piece type
    const groundY = terrainH(placePos.x, placePos.z);
    if (this.pieceType === 'wall') {
      placePos.y = groundY + CFG.BUILDING.H / 2;
    } else if (this.pieceType === 'floor' || this.pieceType === 'roof') {
      placePos.y = groundY + CFG.BUILDING.THICK / 2;
    } else if (this.pieceType === 'ramp') {
      placePos.y = groundY + CFG.BUILDING.H / 2;
    }

    this._ghost.position.copy(placePos);
    this._ghost.rotation.y = this.pieceRot * (Math.PI / 2);

    // Ramp tilt
    if (this.pieceType === 'ramp') {
      this._ghost.rotation.x = -Math.PI / 6;
    } else {
      this._ghost.rotation.x = 0;
    }

    // Check cost validity
    const cost = CFG.BUILDING.COST[this.pieceType] || 10;
    this._ghostValid = this.player.resources.wood >= cost;
    this._ghost.material.color.setHex(this._ghostValid ? 0x44aaff : 0xff4444);
    this._ghost.material.opacity = 0.4;
  }

  _raycastTerrain() {
    // Cast a ray from camera, find where it hits the approximate terrain plane
    // Simple approach: step along the ray until y < terrainH
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    dir.subVectors(this.player._camTarget, origin).normalize();

    for (let d = 2; d < 22; d += 0.5) {
      const p = origin.clone().addScaledVector(dir, d);
      if (p.y <= terrainH(p.x, p.z) + 0.3) {
        return p;
      }
    }
    return null;
  }

  // ── Place a structure ─────────────────────────────────────────────────────
  _place() {
    const cost = CFG.BUILDING.COST[this.pieceType] || 10;
    if (this.player.resources.wood < cost) return;
    this.player.resources.wood -= cost;

    const geo = this._geometryForPiece(this.pieceType);
    const mat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(this._ghost.position);
    mesh.rotation.copy(this._ghost.rotation);

    if (this.pieceType === 'ramp') {
      mesh.rotation.x = -Math.PI / 6;
    }

    const G = CFG.BUILDING;
    const hp = G.MAT_HP.wood;
    mesh.userData.type = 'structure';
    mesh.userData.hp   = hp;
    mesh.userData.maxHp = hp;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);
    this.structures.push({ mesh, hp, type: this.pieceType });
  }

  getStructureMeshes() {
    return this.structures.map(s => s.mesh);
  }
}
