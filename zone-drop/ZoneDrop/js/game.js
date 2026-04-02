// =============================================================================
// STORM ZONE — Main Game Class
// Orchestrates all systems, owns the Three.js scene + render loop.
// States: LOBBY → PLAYING → DEAD → WIN
// =============================================================================

class Game {
  constructor() {
    this.state   = 'LOBBY';
    this.elapsed = 0; // seconds since match start

    this._initRenderer();
    this._initScene();
    this._initSystems();

    this._timer = new window.Timer();
    this._timer.connect(document);
    this._loop();
  }

  // ── Renderer / Scene ──────────────────────────────────────────────────────
  _initRenderer() {
    const canvas = document.getElementById('gameCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc8ddf0, 150, 550);

    this.camera = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.1, 900
    );
    this.camera.position.set(0, 15, 20);

    // Procedural sky
    this._initSky();
  }

  _initSky() {
    const sky = new Sky();
    sky.scale.setScalar(10000);
    this.scene.add(sky);

    const uniforms = sky.material.uniforms;
    uniforms['turbidity'].value = 0;
    uniforms['rayleigh'].value = 3;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.7;
    uniforms['cloudElevation'] = { value: 1 }; // from the example
    
    // Sun position from example: (-0.8, 0.19, 0.56)
    uniforms['sunPosition'].value.set(-0.8, 0.19, 0.56);

    // Generate environment map from sky for PBR reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const tmpScene = new THREE.Scene();
    const tmpSky = new Sky();
    tmpSky.scale.setScalar(10000);
    tmpScene.add(tmpSky);
    const tmpUniforms = tmpSky.material.uniforms;
    tmpUniforms['turbidity'].value = uniforms['turbidity'].value;
    tmpUniforms['rayleigh'].value = uniforms['rayleigh'].value;
    tmpUniforms['mieCoefficient'].value = uniforms['mieCoefficient'].value;
    tmpUniforms['mieDirectionalG'].value = uniforms['mieDirectionalG'].value;
    tmpUniforms['sunPosition'].value.set(-0.8, 0.19, 0.56);
    const envRT = pmrem.fromScene(tmpScene);
    this.scene.environment = envRT.texture;
    this.scene.background  = envRT.texture;
    pmrem.dispose();
  }

  _initSystems() {
    // Core
    this.input    = new InputManager(document.getElementById('gameCanvas'));
    this.world    = new WorldSystem(this.scene);
    this.player   = new PlayerSystem(this.scene, this.camera, this.input);

    // Combat (needs world + player)
    this.combat   = new CombatSystem(this.scene, this.player, this.world);

    // Building
    this.building = new BuildingSystem(this.scene, this.player, this.input, this.camera);

    // Loot (needs player reference)
    this.loot     = new LootSystem(this.scene, this.player);

    // Storm
    this.storm    = new StormSystem(this.scene);

    // Network (replaces bots — real players!)
    this.network  = new NetworkManager(this.scene, this.combat);
    this.combat.network = this.network;

    // UI (pass network instead of botManager)
    this.ui = new UISystem(this.player, this.storm, this.network);

    // Kill feed hooks
    this.combat.onKillFeed = (killer, victim) => {
      this.ui.addKill(killer, victim);
    };
    this.network.onKillFeed = (killer, victim) => {
      this.ui.addKill(killer, victim);
    };
    this.network.onDamage = (amount, fromName, headshot) => {
      this.player.takeDamage(amount);
    };
  }

  // ── Match lifecycle ────────────────────────────────────────────────────────
  _startMatch() {
    // Reset player
    this.player.position.set(rand(-80, 80), 10, rand(-80, 80));
    this.player.velocity.set(0, 0, 0);
    this.player.hp            = CFG.PLAYER.MAX_HP;
    this.player.shield        = 0;
    this.player.alive         = true;
    this.player.kills         = 0;
    this.player.buildMode     = false;
    this.player.crouching     = false;
    this.player.sprinting     = false;
    this.player.onGround      = false;
    this.player._reloading    = false;
    this.player._reloadTimer  = 0;
    this.player._shotCooldown = 0;
    this.player._damageCooldown = 0;
    this.player.weapons.fill(null);
    this.player.ammo = { light: 60, heavy: 30, sniper: 10, rocket: 2 };
    this.player.resources = { wood: 100, stone: 50, metal: 0 };
    this.player.currentSlot = 0;
    this.player.giveWeapon('blast_rifle');

    // Reset storm
    this.storm.phaseIndex    = 0;
    this.storm.phaseTimer    = 0;
    this.storm.shrinking     = false;
    this.storm.currentRadius = CFG.STORM.START_RADIUS;
    this.storm.damagePerSec  = 0;
    this.storm._damageTick   = 0;
    this.storm._startWait();
    this.storm._rebuildRing();

    // Clear lingering projectiles / tracers from previous match
    this.combat._projectiles.forEach(p => this.scene.remove(p.mesh));
    this.combat._projectiles = [];
    this.combat._tracers.forEach(t => this.scene.remove(t.line));
    this.combat._tracers = [];

    // Connect to multiplayer server
    const playerName = document.getElementById('nameInput').value.trim() || 'Player';
    if (!this.network.connected) {
      this.network.connect(playerName);
    }

    // Reset loot (remove existing, re-spawn)
    this.loot.items.forEach(it => {
      this.scene.remove(it.mesh);
      if (it.ring) this.scene.remove(it.ring);
      if (it.pill) this.scene.remove(it.pill);
    });
    this.loot.items = [];
    this.loot._spawnAll();

    this.elapsed = 0;
    this.state   = 'PLAYING';

    this.ui.hideOverlay();
    this.ui.showHUD();

    // Request pointer lock (skip on mobile — joystick handles camera)
    if (!this.input.isMobile) {
      const lockResult = document.getElementById('gameCanvas').requestPointerLock();
      if (lockResult instanceof Promise) lockResult.catch(() => {});
    }
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  _loop() {
    requestAnimationFrame(() => this._loop());
    this._timer.update();
    const dt = Math.min(this._timer.getDelta(), 0.05); // cap at 50 ms

    if (this.state === 'PLAYING') {
      this._updatePlaying(dt);
    }

    this.renderer.render(this.scene, this.camera);
    this.input.flush();
    tickParticles(dt);
  }

  _updatePlaying(dt) {
    this.elapsed += dt;

    this.player.update(dt);
    this.combat.update(dt);
    this.building.update(dt);
    this.loot.update(dt);
    this.storm.update(dt, [], this.player); // no bots, only real players
    this.network.update(dt, this.player);
    this.ui.update(dt);

    this._checkEndConditions();
  }

  _checkEndConditions() {
    if (!this.player.alive) {
      this.state = 'DEAD';
      this.ui.setOverlay('ELIMINATED', 'Better luck next time', 'PLAY AGAIN',
        { elapsed: this.elapsed });
      this.ui.hideHUD();
      this.ui.showOverlay();
      document.exitPointerLock();
    } else if (this.network.aliveCount() === 0 && this.network.connected && this.elapsed > 5) {
      // Win if all other players are eliminated (only if others have joined)
      // Don't trigger immediately — give time for players to connect
    }
  }
}
