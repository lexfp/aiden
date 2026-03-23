    // ═══════════════════ LOOT DROP SYSTEM ═══════════════════
    // Enemies can drop loot items with visual effects
    const LOOT_TABLE = [
      { name: 'Cursed Fragment', rarity: 'common', color: '#88aacc', coins: 10, xp: 20 },
      { name: 'Spirit Orb', rarity: 'uncommon', color: '#44ff88', coins: 25, xp: 40 },
      { name: 'Technique Scroll', rarity: 'rare', color: '#8844ff', coins: 50, xp: 80 },
      { name: 'Domain Fragment', rarity: 'epic', color: '#ff44aa', coins: 100, xp: 150 },
      { name: 'Six Eyes Shard', rarity: 'legendary', color: '#ffdd44', coins: 250, xp: 300 },
    ];

    function rollLoot() {
      const r = Math.random();
      if (r < 0.02) return LOOT_TABLE[4]; // legendary 2%
      if (r < 0.08) return LOOT_TABLE[3]; // epic 6%
      if (r < 0.22) return LOOT_TABLE[2]; // rare 14%
      if (r < 0.50) return LOOT_TABLE[1]; // uncommon 28%
      return LOOT_TABLE[0]; // common 50%
    }

    function spawnLootDrop(worldPos) {
      const loot = rollLoot();
      // 3D floating orb at position
      const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(loot.color), transparent: true, opacity: 0.8, depthWrite: false });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), orbMat);
      orb.position.copy(worldPos).add(new THREE.Vector3(0, 1.5, 0));
      scene.add(orb);
      const gl = new THREE.PointLight(new THREE.Color(loot.color).getHex(), 2, 5);
      gl.position.copy(orb.position); scene.add(gl);

      // Collect after delay (auto pickup when near)
      const lootObj = { orb, light: gl, loot, collected: false, timer: 0 };
      activeLoot.push(lootObj);
    }

    const activeLoot = [];
    function updateLootDrops(dt) {
      const pp = player.group.position;
      for (let i = activeLoot.length - 1; i >= 0; i--) {
        const l = activeLoot[i];
        if (l.collected) continue;
        l.timer += dt;
        // Bob animation
        l.orb.position.y += Math.sin(elapsed * 3 + i) * 0.003;
        l.orb.rotation.y += dt * 2;
        l.orb.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.15);
        // Auto collect when near
        const dist = pp.distanceTo(l.orb.position);
        if (dist < 2.5) {
          l.collected = true;
          scene.remove(l.orb); scene.remove(l.light);
          l.orb.geometry.dispose(); l.orb.material.dispose();
          addCoins(l.loot.coins); gainXP(l.loot.xp);
          // Celebration particles
          for (let j = 0; j < 10; j++) spawnParticle(l.orb.position.clone(),
            new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4),
            new THREE.Color(l.loot.color).getHex(), 0.06, 0.4);
          // UI notification
          const sp = l.orb.position.clone().project(camera);
          if (sp.z < 1) {
            const x = (sp.x * 0.5 + 0.5) * innerWidth, y = (-sp.y * 0.5 + 0.5) * innerHeight;
            const el = document.createElement('div'); el.className = 'loot-drop-3d';
            el.textContent = l.loot.name + ' +' + l.loot.coins + '\uD83E\uDE99';
            el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.color = l.loot.color;
            document.getElementById('ui').appendChild(el);
            setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2500);
          }
          activeLoot.splice(i, 1);
        }
        // Expire after 30s
        if (l.timer > 30 && !l.collected) {
          scene.remove(l.orb); scene.remove(l.light);
          l.orb.geometry.dispose(); l.orb.material.dispose();
          activeLoot.splice(i, 1);
        }
      }
    }

    // ═══════════════════ ELITE ENEMY SYSTEM ═══════════════════
    // Random elite variants with enhanced stats and glowing aura
    function makeElite(enemy) {
      enemy.isElite = true;
      enemy.maxHealth = Math.floor(enemy.maxHealth * 2.2);
      enemy.health = enemy.maxHealth;
      enemy.cfg = { ...enemy.cfg, dmg: Math.floor(enemy.cfg.dmg * 1.5), xp: Math.floor(enemy.cfg.xp * 3), spd: enemy.cfg.spd * 1.1 };
      // Add glowing aura to elite
      const aura = new THREE.Mesh(new THREE.SphereGeometry(1.2 * (enemy.cfg.size || 1), 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }));
      aura.position.y = 1.5; aura.name = 'eliteAura';
      enemy.group.add(aura);
      // Crown marker
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 5),
        new THREE.MeshBasicMaterial({ color: 0xffdd44 }));
      crown.position.y = 3.2 * (enemy.cfg.size || 1); crown.name = 'eliteCrown';
      enemy.group.add(crown);
    }

    // ═══════════════════ RANDOM COMBAT EVENTS ═══════════════════
    // Ambush events and mini-boss spawns
    let ambushTimer = 120, ambushActive = false;
    function updateAmbushSystem(dt) {
      if (!gameStarted || player.inSafeZone) return;
      ambushTimer -= dt;
      if (ambushTimer <= 0 && !ambushActive) {
        ambushActive = true;
        ambushTimer = 90 + Math.random() * 60;
        const pp = player.group.position;
        const isl = isOnIsland(pp.x, pp.z);
        if (!isl || isl.safe) { ambushActive = false; return; }

        const count = 4 + Math.floor(Math.random() * 3);
        const ann = document.getElementById('wave-ann');
        ann.innerHTML = '\u26A0 AMBUSH! \u26A0<br><span style="font-size:16px;opacity:0.7">Elite enemies incoming!</span>';
        ann.classList.remove('show'); void ann.offsetWidth; ann.classList.add('show');
        addKillMsg('\u26A0 AMBUSH! Elite enemies surround you!', '#ff4466');
        screenFlash('heavy', 0.4);

        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2;
          const r = 8 + Math.random() * 5;
          const types = Object.keys(ENEMY_TYPES);
          const t = types[Math.floor(Math.random() * (types.length - 1))];
          setTimeout(() => {
            if (gameStarted) {
              const e = createEnemy(t, pp.x + Math.cos(ang) * r, pp.z + Math.sin(ang) * r);
              if (Math.random() < 0.4) makeElite(e);
            }
          }, i * 400);
        }
        setTimeout(() => { ambushActive = false; }, count * 400 + 10000);
      }
    }
