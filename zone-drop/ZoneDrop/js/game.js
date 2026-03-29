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
    this._hookUI();

    this._clock = new THREE.Clock();
    this._loop();
  }

  // ── Renderer / Scene ──────────────────────────────────────────────────────
  _initRenderer() {
    const canvas = document.getElementById('gameCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CFG.WORLD.SKY_COLOR);
    this.scene.fog = new THREE.Fog(CFG.WORLD.FOG_COLOR, CFG.WORLD.FOG_NEAR, CFG.WORLD.FOG_FAR);

    this.camera = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.1, 900
    );
    this.camera.position.set(0, 15, 20);
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

    // Bots (combat needed for firing)
    this.botMgr   = new BotManager(this.scene, this.combat);
    this.combat.botManager = this.botMgr;

    // UI
    this.ui = new UISystem(this.player, this.storm, this.botMgr);

    // Kill feed hook
    this.combat.onKillFeed = (killer, victim) => {
      this.ui.addKill(killer, victim);
    };
  }

  // ── UI wiring ─────────────────────────────────────────────────────────────
  _hookUI() {
    // Lobby deploy button
    window.onOverlayBtn = () => {
      if (this.state === 'LOBBY' || this.state === 'DEAD' || this.state === 'WIN') {
        this._startMatch();
      }
    };
  }

  // ── Match lifecycle ────────────────────────────────────────────────────────
  _startMatch() {
    // Reset player
    this.player.position.set(rand(-80, 80), 10, rand(-80, 80));
    this.player.velocity.set(0, 0, 0);
    this.player.hp     = CFG.PLAYER.MAX_HP;
    this.player.shield = 0;
    this.player.alive  = true;
    this.player.kills  = 0;
    this.player.weapons.fill(null);
    this.player.ammo = { light: 60, heavy: 30, sniper: 10, rocket: 2 };
    this.player.resources = { wood: 100, stone: 50, metal: 0 };
    this.player.currentSlot = 0;
    this.player._giveWeapon_called = false;
    this.player.giveWeapon('blast_rifle');

    // Reset storm
    this.storm.phaseIndex   = 0;
    this.storm.phaseTimer   = 0;
    this.storm.shrinking    = false;
    this.storm.currentRadius = CFG.STORM.START_RADIUS;
    this.storm.damagePerSec = 0;
    this.storm._damageTick  = 0;
    this.storm._startWait();

    // Reset bots (remove old + re-spawn)
    this.botMgr.bots.forEach(b => {
      if (b.alive) { this.scene.remove(b.mesh); this.scene.remove(b.hitbox); }
    });
    this.botMgr.bots = [];
    const names = ['Shadow','Viper','Blaze','Echo','Storm','Raven','Frost','Ember',
                   'Spike','Comet','Drift','Nova','Titan','Ghost','Lynx','Cipher','Razor','Pulse','Nexus'];
    for (let i = 0; i < CFG.BOTS.COUNT; i++) {
      const sp = randSpawn(30, CFG.MAP.HALF - 20);
      this.botMgr.bots.push(new Bot(this.scene, sp.x, sp.z, names[i] || 'Bot' + i, this.combat));
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

    // Request pointer lock
    document.getElementById('gameCanvas').requestPointerLock();
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this._clock.getDelta(), 0.05); // cap at 50 ms

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
    this.storm.update(dt, this.botMgr.bots, this.player);
    this.botMgr.update(dt, this.player, this.storm);
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
    } else if (this.botMgr.aliveCount() === 0) {
      this.state = 'WIN';
      this.ui.setOverlay('VICTORY!', '#1 — Storm Zone Champion', 'PLAY AGAIN',
        { elapsed: this.elapsed });
      this.ui.hideHUD();
      this.ui.showOverlay();
      document.exitPointerLock();
    }
  }
}
