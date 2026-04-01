// =============================================================================
// ZONE DROP — Network Manager
// WebSocket client for real-time multiplayer.
// =============================================================================

class NetworkManager {
  constructor(scene, combat) {
    this.scene   = scene;
    this.combat  = combat;
    this.ws      = null;
    this.myId    = null;

    // Remote players: id → { mesh, hitbox, name, state, mixer }
    this.remotePlayers = new Map();

    // Callbacks set externally
    this.onDamage   = null; // (amount, fromName, headshot)
    this.onKillFeed = null; // (killerName, victimName)

    this._sendTimer = 0;
    this._connected = false;
  }

  // ── Connect ────────────────────────────────────────────────────────────────
  connect(playerName) {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = protocol + '://' + location.host;
    this.ws = new WebSocket(url);
    this._playerName = playerName;

    this.ws.onopen = () => {
      this._connected = true;
      this.ws.send(JSON.stringify({ type: 'join', name: playerName }));
    };

    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this._handleMessage(msg);
    };

    this.ws.onclose = () => {
      this._connected = false;
      console.log('Disconnected from server');
    };
  }

  get connected() { return this._connected; }

  // ── Message handling ──────────────────────────────────────────────────────
  _handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this.myId = msg.id;
        // Add existing players
        msg.players.forEach(p => {
          this._addRemotePlayer(p.id, p.name);
          if (p.state) this._applyState(p.id, p.state);
        });
        break;

      case 'playerJoin':
        if (msg.id !== this.myId) {
          this._addRemotePlayer(msg.id, msg.name);
        }
        break;

      case 'playerLeave':
        this._removeRemotePlayer(msg.id);
        break;

      case 'states':
        for (const [id, state] of Object.entries(msg.players)) {
          if (id === this.myId) continue;
          if (!this.remotePlayers.has(id)) {
            this._addRemotePlayer(id, state.name || 'Player');
          }
          this._applyState(id, state);
        }
        break;

      case 'damage':
        if (this.onDamage) this.onDamage(msg.amount, msg.fromName, msg.headshot);
        break;

      case 'shot':
        this._showRemoteShot(msg);
        break;

      case 'kill':
        if (this.onKillFeed) this.onKillFeed(msg.killerName, msg.victimName);
        break;
    }
  }

  // ── Remote player management ──────────────────────────────────────────────
  _addRemotePlayer(id, name) {
    if (this.remotePlayers.has(id)) return;

    // Random color for each remote player
    const colors = [0xe74c3c, 0xe67e22, 0x8e44ad, 0x27ae60, 0x2980b9, 0xf39c12, 0x1abc9c, 0xd35400];
    const color = colors[parseInt(id) % colors.length];

    const mesh = makeCharacterMesh(color);
    mesh.visible = false; // hidden until first state update
    this.scene.add(mesh);

    // Hitbox for raycasting
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.8, 0.5),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData.type = 'remotePlayer';
    hitbox.userData.playerId = id;
    hitbox.userData.playerName = name;
    this.scene.add(hitbox);

    this.remotePlayers.set(id, {
      mesh,
      hitbox,
      name,
      state: null,
      targetPos: new THREE.Vector3(),
      targetRot: 0,
    });
  }

  _removeRemotePlayer(id) {
    const rp = this.remotePlayers.get(id);
    if (!rp) return;
    this.scene.remove(rp.mesh);
    this.scene.remove(rp.hitbox);
    this.remotePlayers.delete(id);
  }

  _applyState(id, state) {
    const rp = this.remotePlayers.get(id);
    if (!rp) return;

    rp.state = state;
    if (state.pos) {
      rp.targetPos.set(state.pos[0], state.pos[1], state.pos[2]);
    }
    if (state.rot !== undefined) {
      rp.targetRot = state.rot;
    }

    // Show/hide based on alive status
    rp.mesh.visible   = state.alive !== false;
    rp.hitbox.visible = state.alive !== false;

    // Update name reference for kill feed
    if (state.name) rp.name = state.name;
    rp.hitbox.userData.playerName = rp.name;
  }

  _showRemoteShot(msg) {
    if (!this.combat) return;
    const origin = new THREE.Vector3(msg.origin[0], msg.origin[1], msg.origin[2]);
    const hitPt  = msg.hitPoint
      ? new THREE.Vector3(msg.hitPoint[0], msg.hitPoint[1], msg.hitPoint[2])
      : origin.clone().add(new THREE.Vector3(msg.dir[0], msg.dir[1], msg.dir[2]).multiplyScalar(300));
    this.combat._addTracer(origin, hitPt, msg.weaponColor || 0xff6600);
  }

  // ── Per-frame update ──────────────────────────────────────────────────────
  update(dt, player) {
    if (!this._connected) return;

    // Smoothly interpolate remote player positions
    for (const [id, rp] of this.remotePlayers) {
      // Lerp position
      rp.mesh.position.lerp(rp.targetPos, 10 * dt);
      rp.hitbox.position.copy(rp.mesh.position);

      // Lerp rotation
      rp.mesh.rotation.y = lerpAngle(rp.mesh.rotation.y, rp.targetRot, 10 * dt);

      // Animation
      const mixer = rp.mesh.userData.mixer;
      if (mixer) {
        mixer.update(dt);
        if (rp.state && rp.state.anim) {
          setCharacterAnim(rp.mesh, rp.state.anim);
        }
      }
    }

    // Send own state at ~20Hz
    this._sendTimer += dt;
    if (this._sendTimer >= 0.05 && player) {
      this._sendTimer = 0;
      const w = player.currentWeapon();
      this._send({
        type: 'state',
        pos: [player.position.x, player.position.y, player.position.z],
        rot: player.group.rotation.y,
        anim: this._getPlayerAnim(player),
        hp: player.hp,
        shield: player.shield,
        alive: player.alive,
        weaponColor: w ? w.def.color : 0x888888,
      });
    }
  }

  _getPlayerAnim(player) {
    const speed = Math.sqrt(
      player.velocity.x * player.velocity.x +
      player.velocity.z * player.velocity.z
    );
    return speed > 1 ? 'Run' : 'Idle';
  }

  // ── Sending events ────────────────────────────────────────────────────────
  sendShoot(origin, dir, weaponColor, hitPoint) {
    this._send({
      type: 'shoot',
      origin: [origin.x, origin.y, origin.z],
      dir: [dir.x, dir.y, dir.z],
      weaponColor,
      hitPoint: hitPoint ? [hitPoint.x, hitPoint.y, hitPoint.z] : null,
    });
  }

  sendHit(targetId, damage, headshot) {
    this._send({
      type: 'hit',
      targetId,
      damage,
      headshot,
    });
  }

  sendKill(victimId, victimName) {
    this._send({
      type: 'kill',
      victimId,
      victimName,
    });
  }

  // ── Accessors ─────────────────────────────────────────────────────────────
  aliveCount() {
    let count = 0;
    for (const [, rp] of this.remotePlayers) {
      if (rp.state && rp.state.alive !== false) count++;
    }
    return count;
  }

  getHitboxes() {
    const boxes = [];
    for (const [, rp] of this.remotePlayers) {
      if (rp.state && rp.state.alive !== false) {
        boxes.push(rp.hitbox);
      }
    }
    return boxes;
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(obj));
    }
  }
}
