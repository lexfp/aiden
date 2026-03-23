    // ═══════════════════ ENEMIES ═══════════════════
    const ENEMY_TYPES = {
      cursed_worm: { hp: 32, dmg: 5, spd: 11, range: 2.2, atkCD: 0.6, col: 0x44ff88, size: 0.7, xp: 15, ranged: false, boss: false },
      grunt: { hp: 65, dmg: 8, spd: 5.5, range: 2.5, atkCD: 1.5, col: 0xff4444, size: 1, xp: 25, ranged: false, boss: false },
      curse_user: { hp: 78, dmg: 18, spd: 4, range: 11, atkCD: 2.2, col: 0xff8800, size: 1, xp: 45, ranged: true, boss: false },
      brute: { hp: 155, dmg: 20, spd: 3, range: 3, atkCD: 2, col: 0xcc4400, size: 1.4, xp: 80, ranged: false, boss: false },
      transfigured: { hp: 105, dmg: 15, spd: 8, range: 2.5, atkCD: 0.8, col: 0xcc44ff, size: 1.1, xp: 65, ranged: false, boss: false },
      finger_bearer: { hp: 480, dmg: 35, spd: 2, range: 4.5, atkCD: 3, col: 0xff2200, size: 1.8, xp: 220, ranged: false, boss: true },
    };
    const ZONE_SPAWNS = { 
        forest: ['grunt', 'cursed_worm', 'curse_user'], 
        fire: ['brute', 'grunt', 'cursed_worm'], 
        desert: ['transfigured', 'grunt', 'cursed_worm'], 
        snow: ['curse_user', 'grunt', 'brute'], 
        swamp: ['grunt', 'finger_bearer', 'brute', 'curse_user'], 
        city: [] 
    };
    const enemies = [];

    function buildEnemyParts(cfg, type) {
      const s = cfg.size, c = cfg.col, parts = [];
      if (type === 'cursed_worm') { for (let i = 0; i < 5; i++)parts.push({ geo: new THREE.SphereGeometry((0.28 - i * 0.04) * s, 7, 5), mat: new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: new THREE.Color(c).multiplyScalar(0.2) }), pos: [0, 0.28 * s - i * 0.16 * s, 0], name: 'seg' + i }); }
      else if (type === 'finger_bearer') {
        parts.push({ geo: new THREE.BoxGeometry(1.2 * s, 1.6 * s, 0.8 * s), mat: new THREE.MeshStandardMaterial({ color: 0x1a0500 }), pos: [0, 1.8 * s, 0], name: 'body' });
        parts.push({ geo: new THREE.SphereGeometry(0.45 * s, 10, 8), mat: new THREE.MeshStandardMaterial({ color: 0x221100 }), pos: [0, 3 * s, 0], name: 'head' });
        parts.push({ geo: new THREE.BoxGeometry(0.3 * s, 1 * s, 0.3 * s), mat: new THREE.MeshStandardMaterial({ color: 0x1a0500 }), pos: [-0.8 * s, 1.8 * s, 0], name: 'leftArm' });
        parts.push({ geo: new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.2 * s, 6), mat: new THREE.MeshStandardMaterial({ color: 0x3a1000 }), pos: [0.8 * s, 1.8 * s, 0], name: 'rightArm' });
        parts.push({ geo: new THREE.ConeGeometry(0.1 * s, 0.6 * s, 5), mat: new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.5 }), pos: [0.8 * s, 0.7 * s, 0], name: 'tip' });
        parts.push({ geo: new THREE.BoxGeometry(0.4 * s, 1 * s, 0.4 * s), mat: new THREE.MeshStandardMaterial({ color: 0x1a0500 }), pos: [-0.3 * s, 0.8 * s, 0], name: 'leftLeg' });
        parts.push({ geo: new THREE.BoxGeometry(0.4 * s, 1 * s, 0.4 * s), mat: new THREE.MeshStandardMaterial({ color: 0x1a0500 }), pos: [0.3 * s, 0.8 * s, 0], name: 'rightLeg' });
      } else {
        parts.push({ geo: new THREE.BoxGeometry(0.8 * s, 1.4 * s, 0.5 * s), mat: new THREE.MeshStandardMaterial({ color: 0x1a0a0a }), pos: [0, 1.5 * s, 0], name: 'body' });
        parts.push({ geo: new THREE.SphereGeometry(0.3 * s, 10, 8), mat: new THREE.MeshStandardMaterial({ color: 0x332222 }), pos: [0, 2.5 * s, 0], name: 'head' });
        [-0.1, 0.1].forEach((ex, i) => { parts.push({ geo: new THREE.SphereGeometry(0.07 * s, 6, 6), mat: new THREE.MeshBasicMaterial({ color: c }), pos: [ex, 2.52 * s, 0.25 * s], name: 'eye' + i }); });
        parts.push({ geo: new THREE.BoxGeometry(0.22 * s, 0.8 * s, 0.22 * s), mat: new THREE.MeshStandardMaterial({ color: 0x1a0a0a }), pos: [-0.6 * s, 1.5 * s, 0], name: 'leftArm' });
        parts.push({ geo: new THREE.BoxGeometry(0.22 * s, 0.8 * s, 0.22 * s), mat: new THREE.MeshStandardMaterial({ color: 0x1a0a0a }), pos: [0.6 * s, 1.5 * s, 0], name: 'rightArm' });
        parts.push({ geo: new THREE.BoxGeometry(0.25 * s, 0.8 * s, 0.25 * s), mat: new THREE.MeshStandardMaterial({ color: 0x1a0a0a }), pos: [-0.2 * s, 0.6 * s, 0], name: 'leftLeg' });
        parts.push({ geo: new THREE.BoxGeometry(0.25 * s, 0.8 * s, 0.25 * s), mat: new THREE.MeshStandardMaterial({ color: 0x1a0a0a }), pos: [0.2 * s, 0.6 * s, 0], name: 'rightLeg' });
        if (type === 'curse_user') { parts.push({ geo: new THREE.SphereGeometry(0.2 * s, 8, 8), mat: new THREE.MeshBasicMaterial({ color: c }), pos: [0.8 * s, 2 * s, 0], name: 'orb' }); }
        if (type === 'transfigured') { parts.push({ geo: new THREE.BoxGeometry(0.18 * s, 0.9 * s, 0.18 * s), mat: new THREE.MeshStandardMaterial({ color: 0x330033 }), pos: [0.3 * s, 2.2 * s, 0.3 * s], name: 'extraArm' }); }
      }
      return parts;
    }

    function createEnemy(type, x, z) {
      const cfg = ENEMY_TYPES[type], g = new THREE.Group();
      buildEnemyParts(cfg, type).forEach(p => { const m = new THREE.Mesh(p.geo, p.mat); m.position.set(...p.pos); m.name = p.name; m.castShadow = true; g.add(m); });
      g.position.set(x, 0, z); scene.add(g);
      const e = {
        type, cfg, group: g, health: cfg.hp, maxHealth: cfg.hp, dead: false, state: 'patrol', stateTimer: 0, attackCD: 0,
        patrolTarget: new THREE.Vector3(x + (Math.random() - 0.5) * 16, 0, z + (Math.random() - 0.5) * 16),
        patrolWait: 0, knockbackVel: new THREE.Vector3(), hitFlashTimer: 0, spawnPos: new THREE.Vector3(x, 0, z)
      };
      enemies.push(e); return e;
    }
    function updateEnemies(dt) {
      const pp = player.group.position;
      enemies.forEach(e => {
        if (e.dead) return;
        const toP = new THREE.Vector3().subVectors(pp, e.group.position); const dist = toP.length(); toP.normalize();
        if (e.attackCD > 0) e.attackCD -= dt; if (e.hitFlashTimer > 0) e.hitFlashTimer -= dt;
        if (e.knockbackVel.lengthSq() > 0.1) { e.group.position.addScaledVector(e.knockbackVel, dt); e.knockbackVel.multiplyScalar(0.85); if (e.group.position.y > 0) e.knockbackVel.y -= 20 * dt; else { e.group.position.y = 0; e.knockbackVel.y = 0; } }
        e.group.traverse(c => { if (!c.isMesh || !c.material?.emissive) return; if (e.hitFlashTimer > 0) { c.material.emissive.setHex(0xff4444); c.material.emissiveIntensity = e.hitFlashTimer * 8; } else c.material.emissiveIntensity = 0; });
        if (e.state === 'stunned') { e.stateTimer -= dt; if (e.stateTimer <= 0) e.state = dist < 22 ? 'chase' : 'patrol'; return; }
        // Don't enter safe zone
        if (isInSafeZone(e.group.position.x, e.group.position.z) && !isInSafeZone(e.spawnPos.x, e.spawnPos.z)) {
          const awayDir = new THREE.Vector3(e.group.position.x - SAFE_ISLAND.x, 0, e.group.position.z - SAFE_ISLAND.z).normalize();
          e.group.position.addScaledVector(awayDir, e.cfg.spd * dt * 2); return;
        }
        // Don't chase into safe zone
        const wouldEnter = isInSafeZone(pp.x, pp.z);
        const detect = e.cfg.boss ? 40 : 24, atkR = e.cfg.range;
        if (e.state === 'patrol') {
          if (dist < detect && !wouldEnter) { e.state = 'chase'; return; }
          const toT = new THREE.Vector3().subVectors(e.patrolTarget, e.group.position); toT.y = 0;
          if (toT.length() < 1) { e.patrolWait += dt; if (e.patrolWait > 2) { e.patrolWait = 0; e.patrolTarget.set(e.spawnPos.x + (Math.random() - 0.5) * 14, 0, e.spawnPos.z + (Math.random() - 0.5) * 14); } }
          else { toT.normalize(); e.group.position.addScaledVector(toT, e.cfg.spd * 0.4 * dt); e.group.rotation.y = Math.atan2(toT.x, toT.z); }
          animEnemyWalk(e, 0.4);
        } else if (e.state === 'chase') {
          if (dist > detect * 1.5 || wouldEnter) { e.state = 'patrol'; return; }
          if (dist < atkR) { e.state = 'attack'; return; }
          if (e.cfg.ranged && dist < atkR * 1.5) { e.state = 'attack'; return; }
          e.group.position.addScaledVector(toP, e.cfg.spd * dt); e.group.rotation.y = Math.atan2(toP.x, toP.z); animEnemyWalk(e, 1);
        } else if (e.state === 'attack') {
          if (wouldEnter) { e.state = 'patrol'; return; }
          e.group.rotation.y = Math.atan2(toP.x, toP.z);
          if (!e.cfg.ranged && dist > atkR * 1.5) { e.state = 'chase'; return; }
          if (e.cfg.ranged && dist > atkR * 2) { e.state = 'chase'; return; }
          if (e.cfg.ranged && dist < 6) e.group.position.addScaledVector(toP, -e.cfg.spd * 0.5 * dt);
          else if (!e.cfg.ranged && dist > atkR) e.group.position.addScaledVector(toP, e.cfg.spd * 0.5 * dt);
          if (e.attackCD <= 0) { e.attackCD = e.cfg.atkCD; doEnemyAtk(e, dist); }
          const ra = e.group.getObjectByName('rightArm'); if (ra && e.attackCD > e.cfg.atkCD - 0.3) { const t = 1 - ((e.attackCD - (e.cfg.atkCD - 0.3)) / 0.3); ra.rotation.x = -Math.sin(t * Math.PI) * 1.5; }
        }
        if (e.group.position.y < 0) e.group.position.y = 0;
        // Animate elite enemy aura
        if (e.isElite) {
          const ea = e.group.getObjectByName('eliteAura');
          if (ea) { ea.material.opacity = 0.1 + Math.sin(elapsed * 3) * 0.06; ea.scale.setScalar(1 + Math.sin(elapsed * 2) * 0.15); }
          const ec = e.group.getObjectByName('eliteCrown');
          if (ec) { ec.position.y = 3.2 * (e.cfg.size || 1) + Math.sin(elapsed * 2) * 0.15; ec.rotation.y += dt * 1.5; }
        }
      });
    }
    function animEnemyWalk(e, sm) {
      const la = e.group.getObjectByName('leftArm'), ra = e.group.getObjectByName('rightArm'), ll = e.group.getObjectByName('leftLeg'), rl = e.group.getObjectByName('rightLeg');
      const c = Math.sin(elapsed * 6 * sm) * 0.5; if (la) la.rotation.x = c; if (ra) ra.rotation.x = -c; if (ll) ll.rotation.x = -c; if (rl) rl.rotation.x = c;
      if (e.type === 'transfigured') { const ea = e.group.getObjectByName('extraArm'); if (ea) ea.rotation.z = Math.sin(elapsed * 4) * 0.8; }
    }
    function doEnemyAtk(e, dist) {
      if (player.inSafeZone) return;
      if (e.cfg.ranged && dist < e.cfg.range + 2) { for (let i = 0; i < 4; i++)spawnParticle(e.group.position.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3().subVectors(player.group.position, e.group.position).normalize().multiplyScalar(8 + (Math.random() - 0.5) * 2).add(new THREE.Vector3((Math.random() - 0.5) * 1, 0, (Math.random() - 0.5) * 1)), e.cfg.col, 0.12, 0.6); damagePlayer(e.cfg.dmg); }
      else if (!e.cfg.ranged && dist < e.cfg.range + 1) damagePlayer(e.cfg.dmg);
    }
    function killEnemy(enemy) {
      enemy.dead = true; totalKills++;
      if (typeof updateQuestProgress !== 'undefined') updateQuestProgress('kill', 1);

      // Enhanced death animation - ragdoll-like tumble and fade
      const deathDur = 0.8; let deathT = 0;
      const tumbleDir = (Math.random() - 0.5) * 2;
      const tumbleSpeed = 3 + Math.random() * 4;
      const deathAnim = () => {
        deathT += 0.016; const t = deathT / deathDur;
        if (t >= 1) { enemy.group.visible = false; enemy.group.scale.set(1, 1, 1); enemy.group.rotation.set(0, 0, 0); return; }
        // Ragdoll tumble - spin and fall
        enemy.group.scale.set(1 - t * 0.4, 1 - t * 0.3 + Math.sin(t * Math.PI) * 0.2, 1 - t * 0.4);
        enemy.group.position.y = Math.max(-0.5, enemy.group.position.y - 0.03 - t * 0.06);
        enemy.group.rotation.x += tumbleDir * dt * tumbleSpeed;
        enemy.group.rotation.z += tumbleDir * dt * tumbleSpeed * 0.7;
        enemy.group.traverse(c => { if (c.isMesh && c.material) { c.material.transparent = true; c.material.opacity = Math.max(0, 1 - t * 1.3); } });
        requestAnimationFrame(deathAnim);
      };
      deathAnim();

      // Explosion particles (more for bosses/elites)
      const particleCount = enemy.isElite ? 50 : (enemy.cfg.boss ? 40 : 18);
      for (let i = 0; i < particleCount; i++)spawnParticle(enemy.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 10, (Math.random() - 0.5) * 12), enemy.cfg.col, 0.15 + Math.random() * 0.15, 0.8 + Math.random() * 0.5);

      // Ground debris on death
      spawnDebris(enemy.group.position.clone(), enemy.cfg.boss ? 10 : 4);

      // Coin reward (elites give more)
      const eliteMult = enemy.isElite ? 2.5 : 1;
      const coinReward = Math.floor((enemy.cfg.boss ? enemy.cfg.xp * 0.5 : enemy.cfg.xp * 0.3) * eliteMult);
      addCoins(coinReward); spawnCoinPickup(enemy.group.position.clone().add(new THREE.Vector3(0, 2, 0)));

      // Loot drop chance (higher for bosses/elites)
      if (Math.random() < (enemy.cfg.boss ? 0.9 : (enemy.isElite ? 0.7 : 0.35))) {
        spawnLootDrop(enemy.group.position.clone());
      }

      const prefix = enemy.isElite ? '★ ELITE: ' : (enemy.cfg.boss ? '★ BOSS: ' : '✦ ');
      const xpReward = Math.floor(enemy.cfg.xp * eliteMult);
      addKillMsg(prefix + enemy.type.toUpperCase() + ' +' + xpReward + 'XP +' + coinReward + '🪙', '#ff8866');
      gainXP(xpReward); gainMastery(enemy.cfg.boss ? 1.5 : (enemy.isElite ? 1 : 0.3));

      // Slow motion on boss/elite kills
      if (enemy.cfg.boss || enemy.isElite) { triggerSlowMo(0.35); cameraShake(0.5); screenFlash('heavy', 0.4); }
      setTimeout(() => {
        if (!enemy) return; const isl = ISLANDS[1 + Math.floor(Math.random() * (ISLANDS.length - 1))];
        const ang = Math.random() * Math.PI * 2, r = 7 + Math.random() * 10;
        enemy.group.position.set(isl.x + Math.cos(ang) * r, 0, isl.z + Math.sin(ang) * r);
        enemy.health = enemy.maxHealth; enemy.dead = false; enemy.group.visible = true; enemy.state = 'patrol';
        enemy.knockbackVel.set(0, 0, 0); enemy.spawnPos.copy(enemy.group.position);
      }, enemy.cfg.boss ? 12000 : 5000 + Math.random() * 4000);
    }
    function spawnInitialEnemies() {
      ISLANDS.forEach(isl => {
        if (isl.safe) return;
        const sp = ZONE_SPAWNS[isl.theme]; if (!sp || sp.length === 0) return;
        const cnt = isl.theme === 'ruins' ? 5 : 4;
        for (let i = 0; i < cnt; i++) {
          const t = sp[i % sp.length]; const ang = (i / cnt) * Math.PI * 2 + Math.random() * 0.5; const r = 6 + Math.random() * 9;
          const e = createEnemy(t, isl.x + Math.cos(ang) * r, isl.z + Math.sin(ang) * r);
          // 15% chance to be elite
          if (Math.random() < 0.15 && !e.cfg.boss) makeElite(e);
        }
      });
    }
