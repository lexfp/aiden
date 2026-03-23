// ═══════════════════ MAIN GAME LOOP ═══════════════════

let canvas, ctx;
let gameState;
let currentState = 'title'; // title, dungeon_select, playing, stat_allocate, level_clear, game_over, pause
let player;
let particles;
let enemies = [];
let projectiles = [];
let currentBoss = null;
let currentPlatforms = [];
let currentDungeon = null;
let camera = { x: 0, y: 0, shakeX: 0, shakeY: 0 };
let keys = {};
let lastTime = 0;
let elapsed = 0;
let groundY = 0;
let enemiesSlain = 0;
let bossSlain = false;
let levelStartTime = 0;

// ── Input ──
function initInput() {
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;

    if (currentState === 'playing') {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        player.jump();
        e.preventDefault();
      }
      if (e.code === 'KeyZ' || e.code === 'KeyJ') performAttack('light');
      if (e.code === 'KeyX' || e.code === 'KeyK') performAttack('heavy');
      if (e.code === 'KeyC' || e.code === 'KeyL') performAttack('shadow');
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.dash();
      if (e.code === 'Escape') togglePause();
    }
    if (currentState === 'game_over' && e.code === 'KeyR') retryLevel();
    if (currentState === 'pause' && e.code === 'Escape') togglePause();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
}

function performAttack(type) {
  let hitbox;
  if (type === 'light') hitbox = player.lightAttack();
  else if (type === 'heavy') hitbox = player.heavyAttack();
  else if (type === 'shadow') hitbox = player.shadowStrike();
  if (!hitbox) return;

  // Check enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    if (hitbox.x < e.x + e.w && hitbox.x + hitbox.w > e.x &&
        hitbox.y < e.y + e.h && hitbox.y + hitbox.h > e.y) {
      const killed = e.takeDamage(hitbox.damage, player.x);
      showDmgNumber(e.x + e.w / 2, e.y - 10, hitbox.damage, hitbox.crit, camera.x);
      player.registerHit();
      if (killed) {
        enemiesSlain++;
        gameState.totalKills++;
        addXP(e.xp);
        checkEnemiesCleared();
      }
    }
  }
  // Check boss
  if (currentBoss && !currentBoss.dying) {
    if (hitbox.x < currentBoss.x + currentBoss.w && hitbox.x + hitbox.w > currentBoss.x &&
        hitbox.y < currentBoss.y + currentBoss.h && hitbox.y + hitbox.h > currentBoss.y) {
      const killed = currentBoss.takeDamage(hitbox.damage, player.x);
      showDmgNumber(currentBoss.x + currentBoss.w / 2, currentBoss.y - 15, hitbox.damage, hitbox.crit, camera.x);
      player.registerHit();
      if (killed) {
        bossSlain = true;
        addXP(currentBoss.xp);
        setTimeout(() => {
          if (currentBoss && !currentBoss.alive) {
            showAriseNotif();
            setTimeout(() => completeDungeon(), 2000);
          }
        }, 1600);
      }
    }
  }
}

// ── Screen Shake ──
function screenShake(intensity) {
  camera.shakeX = (Math.random() - 0.5) * intensity;
  camera.shakeY = (Math.random() - 0.5) * intensity;
}

// ── XP & Leveling ──
function addXP(amount) {
  gameState.xp += amount;
  const needed = xpForLevel(gameState.level);
  while (gameState.xp >= needed) {
    gameState.xp -= xpForLevel(gameState.level);
    gameState.level++;
    gameState.statPoints += CONFIG.STAT_POINTS_PER_LEVEL;
    const newRank = getRank(gameState.level);
    if (newRank.rank !== gameState.rank) {
      gameState.rank = newRank.rank;
      systemNotify('RANK UP! You are now ' + newRank.rank + '-Rank!', newRank.color, 3);
    }
    systemNotify('LEVEL UP! You are now Level ' + gameState.level, COLORS.xp);
    particles.levelUpBurst(player.x + player.w / 2, player.y + player.h / 2);
    player.recalcStats();
    player.fullHeal();
  }
}

// ── Pause ──
function togglePause() {
  if (currentState === 'playing') {
    currentState = 'pause';
    document.getElementById('pause-screen').classList.add('active');
  } else if (currentState === 'pause') {
    currentState = 'playing';
    document.getElementById('pause-screen').classList.remove('active');
    lastTime = performance.now();
  }
}

// ── Dungeon Flow ──
function startDungeon(id) {
  currentDungeon = DUNGEONS[id];
  const ww = currentDungeon.worldWidth;
  groundY = canvas.height - CONFIG.GROUND_Y_OFFSET;

  // Generate world
  currentPlatforms = generatePlatforms(currentDungeon, groundY);

  // Spawn enemies
  enemies = [];
  const enemyZoneStart = 500;
  const enemyZoneEnd = ww - 800;
  const scaleFactor = 1 + currentDungeon.id * 0.4;
  for (let i = 0; i < currentDungeon.enemyCount; i++) {
    const ex = enemyZoneStart + (enemyZoneEnd - enemyZoneStart) * (i / currentDungeon.enemyCount) + Math.random() * 80;
    const etype = currentDungeon.enemyTypes[Math.floor(Math.random() * currentDungeon.enemyTypes.length)];
    const ey = groundY - ENEMY_DEFS[etype].h;
    enemies.push(new Enemy(ex, ey, etype, scaleFactor));
  }

  // Spawn boss at end
  const bossDef = BOSS_DEFS[currentDungeon.bossType];
  currentBoss = new Boss(ww - 350, groundY - bossDef.h, currentDungeon.bossType, scaleFactor);

  // Reset player position
  player.reset();
  player.recalcStats();
  player.fullHeal();

  projectiles = [];
  particles.clear();
  enemiesSlain = 0;
  bossSlain = false;
  camera.x = 0;
  levelStartTime = performance.now();

  // Show screens
  hideAllScreens();
  currentState = 'playing';

  systemNotify(currentDungeon.rank + '-RANK GATE: ' + currentDungeon.name, getRank(gameState.level).color, 3);
  if (currentBoss) {
    setTimeout(() => showBossAnnounce(currentBoss.name), 3500);
  }
}

function checkEnemiesCleared() {
  const aliveEnemies = enemies.filter(e => e.alive).length;
  if (aliveEnemies === 0 && !bossSlain && currentBoss) {
    systemNotify('All enemies defeated! Defeat the boss!', COLORS.boss);
  }
}

function completeDungeon() {
  currentState = 'level_clear';
  const d = currentDungeon;

  if (!gameState.clearedDungeons.includes(d.id)) {
    gameState.clearedDungeons.push(d.id);
  }
  gameState.highestDungeon = Math.max(gameState.highestDungeon, d.id + 1);
  gameState.shadows += d.shadowsReward;
  gameState.statPoints += d.statPointsReward;

  saveGame();

  // Show clear screen
  const el = document.getElementById('level-clear-screen');
  el.querySelector('.lc-name').textContent = d.name;
  el.querySelector('.lc-xp').textContent = '+' + d.xpReward + ' XP';
  el.querySelector('.lc-shadows').textContent = '+' + d.shadowsReward + ' Shadows';
  el.querySelector('.lc-stats').textContent = '+' + d.statPointsReward + ' Stat Points';
  el.querySelector('.lc-kills').textContent = enemiesSlain + ' enemies slain';
  el.classList.add('active');
}

function retryLevel() {
  if (currentDungeon) {
    startDungeon(currentDungeon.id);
  }
}

// ── Screen Management ──
function hideAllScreens() {
  document.querySelectorAll('.game-screen').forEach(s => s.classList.remove('active'));
}

function showTitleScreen() {
  hideAllScreens();
  currentState = 'title';
  document.getElementById('title-screen').classList.add('active');
  const hasSaved = hasSave();
  document.getElementById('continue-btn').style.display = hasSaved ? 'inline-block' : 'none';
  document.getElementById('new-game-btn').style.display = hasSaved ? 'inline-block' : 'none';
}

function showDungeonSelect() {
  hideAllScreens();
  currentState = 'dungeon_select';
  const el = document.getElementById('dungeon-select');
  el.classList.add('active');
  // Update header stats
  document.getElementById('ds-level').textContent = gameState.level;
  document.getElementById('ds-rank').textContent = gameState.rank;
  document.getElementById('ds-shadows').textContent = gameState.shadows;
  const spEl = document.getElementById('ds-stat-points');
  if (gameState.statPoints > 0) {
    spEl.style.display = 'inline';
    document.getElementById('ds-sp').textContent = gameState.statPoints;
  } else {
    spEl.style.display = 'none';
  }
  renderDungeonCards();
}

function showStatScreen() {
  hideAllScreens();
  currentState = 'stat_allocate';
  const el = document.getElementById('stat-screen');
  el.classList.add('active');
  renderStatAllocation();
}

function showGameOver() {
  currentState = 'game_over';
  document.getElementById('game-over-screen').classList.add('active');
}

function renderDungeonCards() {
  const grid = document.getElementById('dungeon-grid');
  grid.innerHTML = '';
  for (const d of DUNGEONS) {
    const locked = gameState.level < d.requiredLevel;
    const cleared = gameState.clearedDungeons.includes(d.id);
    const rankDef = RANK_DEFS.find(r => r.rank === d.rank) || RANK_DEFS[0];

    const card = document.createElement('div');
    card.className = 'dungeon-card' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '');
    card.innerHTML = `
      <div class="dc-rank" style="color:${rankDef.color}">${d.rank}-RANK</div>
      <div class="dc-name">${d.name}</div>
      <div class="dc-info">Required Level: ${d.requiredLevel}</div>
      <div class="dc-reward">XP: ${d.xpReward} · Shadows: ${d.shadowsReward}</div>
      ${locked ? '<div class="dc-lock">🔒 LOCKED</div>' : ''}
      ${cleared ? '<div class="dc-cleared">✦ CLEARED</div>' : ''}
    `;
    if (!locked) {
      card.addEventListener('click', () => startDungeon(d.id));
    }
    grid.appendChild(card);
  }
}

function renderStatAllocation() {
  const container = document.getElementById('stat-grid');
  container.innerHTML = '';
  document.getElementById('stat-points-avail').textContent = gameState.statPoints;

  const statNames = ['STR', 'AGI', 'VIT', 'INT', 'PER'];
  const statDescs = {
    STR: 'Physical Damage',
    AGI: 'Speed & Dodge',
    VIT: 'Max HP',
    INT: 'Shadow Damage & MP',
    PER: 'Critical Hit Chance'
  };

  for (const name of statNames) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <div class="sr-name">${name}</div>
      <div class="sr-desc">${statDescs[name]}</div>
      <div class="sr-val">${gameState.stats[name]}</div>
      <button class="sr-btn" ${gameState.statPoints <= 0 ? 'disabled' : ''}>+</button>
    `;
    row.querySelector('.sr-btn').addEventListener('click', () => {
      if (gameState.statPoints > 0) {
        gameState.stats[name]++;
        gameState.statPoints--;
        player.recalcStats();
        renderStatAllocation();
      }
    });
    container.appendChild(row);
  }
}

// ── Main Loop ──
function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const rawDt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += rawDt;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  groundY = canvas.height - CONFIG.GROUND_Y_OFFSET;

  if (currentState === 'playing') {
    updatePlaying(rawDt);
  }

  // Always draw if playing
  if (currentState === 'playing' || currentState === 'pause') {
    drawGame();
  }
  if (currentState === 'title') {
    drawTitleBG();
  }

  updateSystemNotifs(rawDt);

  // Decay screen shake
  camera.shakeX *= CONFIG.SCREEN_SHAKE_DECAY;
  camera.shakeY *= CONFIG.SCREEN_SHAKE_DECAY;
}

function updatePlaying(dt) {
  // Player
  player.update(dt, keys, currentPlatforms, groundY);

  // Camera follow
  const targetX = player.x - canvas.width / 2 + player.w / 2;
  camera.x += (targetX - camera.x) * CONFIG.CAMERA_LERP;
  camera.x = Math.max(0, Math.min(camera.x, (currentDungeon ? currentDungeon.worldWidth : 2000) - canvas.width));

  // Enemies
  for (const e of enemies) {
    e.update(dt, player.x, player.y, currentPlatforms, groundY);
    // Enemy attacks
    const atk = e.getAttackHitbox();
    if (atk) {
      if (atk.type === 'projectile') {
        projectiles.push(new Projectile(atk.x, atk.y, atk.dir, atk.speed, atk.dmg, e.eyeColor));
      } else {
        if (atk.x < player.x + player.w && atk.x + atk.w > player.x &&
            atk.y < player.y + player.h && atk.y + atk.h > player.y) {
          const dead = player.takeDamage(atk.dmg);
          if (dead) showGameOver();
        }
      }
    }
  }

  // Boss
  if (currentBoss && currentBoss.alive) {
    currentBoss.update(dt, player.x, player.y, currentPlatforms, groundY);
    const bAtk = currentBoss.getAttackHitbox();
    if (bAtk && bAtk.type === 'melee') {
      if (bAtk.x < player.x + player.w && bAtk.x + bAtk.w > player.x &&
          bAtk.y < player.y + player.h && bAtk.y + bAtk.h > player.y) {
        const dead = player.takeDamage(Math.floor(bAtk.dmg));
        if (dead) showGameOver();
      }
    }
  }

  // Projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    projectiles[i].update(dt);
    if (projectiles[i].hits(player)) {
      const dead = player.takeDamage(projectiles[i].dmg);
      projectiles[i].alive = false;
      if (dead) showGameOver();
    }
    if (!projectiles[i].alive) projectiles.splice(i, 1);
  }

  // Particles
  particles.update(dt);
  particles.ambientDust(canvas.width, canvas.height, camera.x);
}

function drawGame() {
  const cw = canvas.width;
  const ch = canvas.height;
  const camX = camera.x + camera.shakeX;

  ctx.clearRect(0, 0, cw, ch);

  // Background
  const theme = currentDungeon ? currentDungeon.bgTheme : 'cave';
  drawBackground(ctx, camX, theme, elapsed, cw, ch);

  // Platforms
  for (const p of currentPlatforms) {
    p.draw(ctx, camX, theme);
  }

  // Enemies
  for (const e of enemies) {
    e.draw(ctx, camX);
  }

  // Boss
  if (currentBoss) {
    currentBoss.draw(ctx, camX);
  }

  // Projectiles
  for (const p of projectiles) {
    p.draw(ctx, camX);
  }

  // Player
  player.draw(ctx, camX);

  // Particles (on top)
  particles.draw(ctx, camX);

  // HUD
  drawHUD(ctx, player, cw, ch);
  // Only show boss bar when player is near
  if (currentBoss && currentBoss.alive && currentDungeon) {
    const bossDistX = Math.abs(player.x - currentBoss.x);
    if (bossDistX < canvas.width) {
      drawBossBar(ctx, currentBoss, cw);
    }
  }

  // Pause overlay
  if (currentState === 'pause') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, cw, ch);
  }
}

function drawTitleBG() {
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  // Dark gradient
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, '#050310');
  grad.addColorStop(0.5, '#0a0618');
  grad.addColorStop(1, '#080510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // Animated floating particles
  for (let i = 0; i < 30; i++) {
    const px = (Math.sin(elapsed * 0.3 + i * 1.7) * 0.5 + 0.5) * cw;
    const py = (Math.cos(elapsed * 0.2 + i * 2.3) * 0.5 + 0.5) * ch;
    const sz = 1 + Math.sin(elapsed + i) * 1;
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.sin(elapsed * 1.5 + i) * 0.15;
    ctx.fillStyle = COLORS.shadow;
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.shadow;
    ctx.beginPath();
    ctx.arc(px, py, sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── INIT ──
function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  particles = new ParticleSystem();
  gameState = getDefaultState();
  player = new Player();

  initInput();

  // Button wiring
  document.getElementById('enter-btn').addEventListener('click', () => {
    gameState = getDefaultState();
    showDungeonSelect();
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    const saved = loadGame();
    if (saved) {
      gameState = saved;
      player.recalcStats();
      showDungeonSelect();
    }
  });
  document.getElementById('new-game-btn').addEventListener('click', () => {
    deleteSave();
    gameState = getDefaultState();
    player.recalcStats();
    showDungeonSelect();
  });

  document.getElementById('lc-continue-btn').addEventListener('click', () => {
    if (gameState.statPoints > 0) {
      showStatScreen();
    } else {
      showDungeonSelect();
    }
  });

  document.getElementById('stat-confirm-btn').addEventListener('click', () => {
    saveGame();
    showDungeonSelect();
  });

  document.getElementById('retry-btn').addEventListener('click', retryLevel);
  document.getElementById('go-back-btn').addEventListener('click', () => {
    saveGame();
    showDungeonSelect();
  });

  document.getElementById('pause-resume').addEventListener('click', togglePause);
  document.getElementById('pause-quit').addEventListener('click', () => {
    currentState = 'title';
    document.getElementById('pause-screen').classList.remove('active');
    saveGame();
    showTitleScreen();
  });

  showTitleScreen();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('load', init);
