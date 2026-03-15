    // ═══════════════════ PVP BOTS ═══════════════════
    const BOT_NAMES = ['Nanami Kento', 'Yuta Okkotsu', 'Maki Zenin', 'Mei Mei', 'Toji Fushiguro', 'Kinji Hakari', 'Takuma Ino', 'Miwa Kasumi'];
    const BOT_OUTFIT_C = [0x003366, 0x660000, 0x003300, 0x333300, 0x330033, 0x006666, 0x552200, 0x111133];
    const pvpBots = [];
    let pvpBotChips = {};

    function createPvpBot(name, tech, outfitColor, x, z) {
      const g = new THREE.Group();
      const skinCol = SKIN_C[Math.floor(Math.random() * SKIN_C.length)];
      const hairCol = HAIR_C[Math.floor(Math.random() * HAIR_C.length)];
      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.15, 0.48), new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.5, metalness: 0.3 }));
      body.position.y = 1.8; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 10), new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.6 }));
      head.position.y = 2.68; head.castShadow = true; g.add(head);
      // Hair
      const hairMat = new THREE.MeshStandardMaterial({ color: hairCol, roughness: 0.7 });
      const hairStyle = Math.floor(Math.random() * 4);
      if (hairStyle < 2) { for (let i = 0; i < 7; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 4), hairMat); const a = (i / 7) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.2, 2.93, Math.sin(a) * 0.2); sp.rotation.x = Math.sin(a) * 0.4; sp.rotation.z = -Math.cos(a) * 0.4; g.add(sp); } }
      else { const cp = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 6), hairMat); cp.position.y = 2.76; cp.scale.set(1, 0.45, 1); g.add(cp); }
      // Eyes glow with technique color
      const eyeM = new THREE.MeshBasicMaterial({ color: tech.hex });
      [-0.1, 0.1].forEach(ex => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeM); e.position.set(ex, 2.7, 0.27); g.add(e); });
      // Arms/legs
      const armM = new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.5 });
      ['leftArm', 'rightArm'].forEach((nm, i) => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.88, 0.24), armM.clone()); a.position.set(i === 0 ? -0.64 : 0.64, 1.74, 0); a.castShadow = true; a.name = nm; g.add(a); });
      const handM = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.6 });
      ['leftHand', 'rightHand'].forEach((nm, i) => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), handM); h.position.set(i === 0 ? -0.64 : 0.64, 1.2, 0); h.name = nm; g.add(h); });
      const legM = new THREE.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.6 });
      ['leftLeg', 'rightLeg'].forEach((nm, i) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.88, 0.28), legM); l.position.set(i === 0 ? -0.21 : 0.21, 0.64, 0); l.castShadow = true; l.name = nm; g.add(l); });
      // Aura
      const aura = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 14), new THREE.MeshBasicMaterial({ color: tech.hex, transparent: true, opacity: 0.08, side: THREE.BackSide }));
      aura.position.y = 1.8; aura.name = 'aura'; g.add(aura);
      // Name plate floating above
      g.position.set(x, 0, z); scene.add(g);

      const maxHP = 100 + Math.floor(Math.random() * 80);
      const bot = {
        name, tech, group: g, health: maxHP, maxHealth: maxHP, energy: 100, maxEnergy: 100,
        dead: false, state: 'idle', stateTimer: 0, attackCD: 0, techCDs: [0, 0, 0, 0],
        knockbackVel: new THREE.Vector3(), hitFlashTimer: 0,
        patrolTarget: new THREE.Vector3(x + (Math.random() - 0.5) * 20, 0, z + (Math.random() - 0.5) * 20),
        spawnPos: new THREE.Vector3(x, 0, z),
        techUseTimer: 5 + Math.random() * 5,
        kills: 0, deaths: 0, inSafeZone: false, outfitColor,
      };
      pvpBots.push(bot);
      buildPvpBotHudChip(bot);
      return bot;
    }

    function buildPvpBotHudChip(bot) {
      const hud = document.getElementById('pvp-hud');
      const chip = document.createElement('div'); chip.className = 'pvp-bot-chip';
      chip.innerHTML = `<div class="bc-name">${bot.name}</div><div class="bc-tech" style="color:${bot.tech.color}">${bot.tech.name}</div><div class="bc-hp-wrap"><div class="bc-hp" style="width:100%;background:${bot.tech.color}"></div></div>`;
      hud.appendChild(chip); pvpBotChips[bot.name] = chip;
    }

    function updatePvpBotChip(bot) {
      const chip = pvpBotChips[bot.name]; if (!chip) return;
      const hp = chip.querySelector('.bc-hp'); if (hp) hp.style.width = (Math.max(0, bot.health / bot.maxHealth) * 100) + '%';
      chip.classList.toggle('dead', bot.dead);
    }

    function updatePvpBots(dt) {
      const pp = player.group.position;
      pvpBots.forEach(bot => {
        if (bot.dead) return;
        bot.energy = Math.min(bot.maxEnergy, bot.energy + 5 * dt);
        for (let i = 0; i < 4; i++)if (bot.techCDs[i] > 0) bot.techCDs[i] -= dt;
        if (bot.attackCD > 0) bot.attackCD -= dt;
        if (bot.hitFlashTimer > 0) bot.hitFlashTimer -= dt;
        if (bot.techUseTimer > 0) bot.techUseTimer -= dt;

        const inSafe = isInSafeZone(bot.group.position.x, bot.group.position.z);
        bot.inSafeZone = inSafe;

        // Knockback
        if (bot.knockbackVel.lengthSq() > 0.1) { bot.group.position.addScaledVector(bot.knockbackVel, dt); bot.knockbackVel.multiplyScalar(0.82); if (bot.group.position.y > 0) bot.knockbackVel.y -= 20 * dt; else { bot.group.position.y = 0; bot.knockbackVel.y = 0; } }

        // Hit flash
        bot.group.traverse(c => { if (!c.isMesh || !c.material?.emissive) return; if (bot.hitFlashTimer > 0) { c.material.emissive.setHex(new THREE.Color(bot.tech.color).getHex()); c.material.emissiveIntensity = bot.hitFlashTimer * 6; } else c.material.emissiveIntensity = 0; });

        const toP = new THREE.Vector3().subVectors(pp, bot.group.position); const dist = toP.length(); toP.normalize();

        if (bot.state === 'stunned') { bot.stateTimer -= dt; if (bot.stateTimer <= 0) bot.state = 'idle'; return; }

        // Don't fight inside safe zone
        if (player.inSafeZone) {
          // Patrol nearby safe zone edge
          botPatrol(bot, dt); return;
        }

        if (dist < 22) {
          // Decide: attack or tech
          if (dist < 3 && bot.attackCD <= 0) {
            bot.attackCD = 1.2;
            damagePlayer(12 + Math.floor(bot.health / bot.maxHealth * 8), true);
            spawnHitFlash(player.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), bot.tech.color, 0.8);
            addKillMsg(`⚡ ${bot.name} strikes you!`, '#ff4466');
          }
          // Tech use
          if (bot.techUseTimer <= 0 && bot.energy >= bot.tech.moves[0].cost) {
            useBotTech(bot); bot.techUseTimer = 7 + Math.random() * 8;
          }
          // Chase
          if (dist > 3) { bot.group.position.addScaledVector(toP, 7 * dt); bot.group.rotation.y = Math.atan2(toP.x, toP.z); }
          bot.state = 'chase';
          // Dash occasionally
          if (Math.random() < 0.002 && dist > 4 && dist < 18) {
            bot.group.position.addScaledVector(toP, 8); spawnDashTrail(bot.group.position.clone());
          }
        } else {
          botPatrol(bot, dt);
        }

        if (bot.group.position.y < 0) bot.group.position.y = 0;

        // Anim
        const la = bot.group.getObjectByName('leftArm'), ra = bot.group.getObjectByName('rightArm');
        const ll = bot.group.getObjectByName('leftLeg'), rl = bot.group.getObjectByName('rightLeg');
        const wc = Math.sin(elapsed * 7) * 0.4;
        if (la) la.rotation.x = wc; if (ra) ra.rotation.x = -wc; if (ll) ll.rotation.x = -wc; if (rl) rl.rotation.x = wc;
        updatePvpBotChip(bot);
      });
    }

    function botPatrol(bot, dt) {
      const toT = new THREE.Vector3().subVectors(bot.patrolTarget, bot.group.position); toT.y = 0;
      if (toT.length() < 1.5) { bot.patrolTarget.set(bot.spawnPos.x + (Math.random() - 0.5) * 18, 0, bot.spawnPos.z + (Math.random() - 0.5) * 18); }
      else { toT.normalize(); bot.group.position.addScaledVector(toT, 4 * dt); bot.group.rotation.y = Math.atan2(toT.x, toT.z); }
    }

    function useBotTech(bot) {
      // Pick a random unlocked move
      const unlocked = bot.tech.moves.filter((m, i) => i < 3 && bot.techCDs[i] <= 0 && bot.energy >= m.cost);
      if (!unlocked.length) return;
      const move = unlocked[Math.floor(Math.random() * unlocked.length)];
      const moveIdx = bot.tech.moves.indexOf(move);
      bot.energy -= move.cost; bot.techCDs[moveIdx] = move.cd;
      if (player.inSafeZone) return;
      const dist = bot.group.position.distanceTo(player.group.position);
      if (dist < move.range + 2) {
        const dmg = Math.floor(move.dmg * 0.5);
        damagePlayer(dmg, true);
        spawnTechFX(bot.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), bot.tech.hex, move.range, 'burst');
        addKillMsg(`⚡ ${bot.name} uses ${move.name}!`, bot.tech.color);
      }
    }

    function damagePvpBot(bot, damage, knockback, direction, isCrit = false) {
      if (bot.dead || bot.inSafeZone) return;
      bot.health -= damage; bot.hitFlashTimer = 0.15;
      if (knockback > 0) { bot.knockbackVel = direction.clone().multiplyScalar(knockback); bot.knockbackVel.y = knockback * 0.3; }
      bot.state = 'chase'; bot.stateTimer = 0;
      spawnHitFlash(bot.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), isCrit ? '#ff2244' : bot.tech.color, isCrit ? 2 : 1);
      spawnDmgNum(bot.group.position.clone().add(new THREE.Vector3(0, 3, 0)), damage, isCrit ? '#ff2244' : bot.tech.color, isCrit);
      for (let i = 0; i < (isCrit ? 6 : 2); i++)spawnParticle(bot.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5), isCrit ? 0xff2244 : bot.tech.hex, 0.06, 0.3);
      updatePvpBotChip(bot);
      if (bot.health <= 0) killPvpBot(bot);
    }

    function killPvpBot(bot) {
      bot.dead = true; bot.deaths++; bot.group.visible = false; pvpWins++; totalKills++;
      for (let i = 0; i < 20; i++)spawnParticle(bot.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8), bot.tech.hex, 0.15, 1 + Math.random() * 0.5);
      const pvpCoins = 100 + Math.floor(Math.random() * 100);
      addKillMsg(`⚔ DEFEATED ${bot.name} (${bot.tech.name})! +200XP +${pvpCoins}🪙`, '#44ffcc');
      gainXP(200); gainMastery(2); addCoins(pvpCoins); updatePvpBotChip(bot);
      setTimeout(() => {
        if (!bot) return;
        const isl = ISLANDS[1 + Math.floor(Math.random() * (ISLANDS.length - 1))];
        const ang = Math.random() * Math.PI * 2, r = 8 + Math.random() * 10;
        bot.group.position.set(isl.x + Math.cos(ang) * r, 0, isl.z + Math.sin(ang) * r);
        bot.health = bot.maxHealth; bot.dead = false; bot.group.visible = true;
        bot.state = 'idle'; bot.knockbackVel.set(0, 0, 0); bot.spawnPos.copy(bot.group.position);
        bot.techUseTimer = 5 + Math.random() * 5; updatePvpBotChip(bot);
      }, 10000 + Math.random() * 5000);
    }

    function spawnPvpBots() {
      const combatIslands = ISLANDS.filter(i => !i.safe);
      BOT_NAMES.slice(0, 4).forEach((name, i) => {
        const tech = TECHNIQUES[Math.floor(Math.random() * TECHNIQUES.length)];
        const outfit = BOT_OUTFIT_C[i % BOT_OUTFIT_C.length];
        const isl = combatIslands[i % combatIslands.length];
        const ang = Math.random() * Math.PI * 2, r = 8 + Math.random() * 8;
        createPvpBot(name, tech, outfit, isl.x + Math.cos(ang) * r, isl.z + Math.sin(ang) * r);
      });
    }
