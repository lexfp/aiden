    // ═══════════════════ ENEMY WAVES ═══════════════════
    let waveActive = false, waveTimer = 0, waveNumber = 0, waveInterval = 90, waveCountdown = 60;
    function updateWaveSystem(dt) {
      if (!gameStarted) return;
      waveCountdown -= dt;
      if (waveCountdown <= 0 && !waveActive) { triggerWave(); waveCountdown = waveInterval + waveNumber * 5; }
    }
    function triggerWave() {
      waveActive = true; waveNumber++;
      const cnt = 3 + Math.floor(waveNumber * 1.5);
      const types = Object.keys(ENEMY_TYPES);
      const ann = document.getElementById('wave-ann');
      ann.innerHTML = `⚔ ENEMY WAVE ${waveNumber} ⚔<br><span style="font-size:16px;opacity:0.7">${cnt} enemies incoming!</span>`;
      ann.classList.remove('show'); void ann.offsetWidth; ann.classList.add('show');
      addKillMsg(`⚔ WAVE ${waveNumber} — ${cnt} enemies!`, '#ff4466');
      const pp = player.group.position;
      const isl = isOnIsland(pp.x, pp.z) || ISLANDS[1];
      for (let i = 0; i < cnt; i++) {
        const t = types[Math.floor(Math.random() * (types.length - 1))]; // exclude finger_bearer from basic waves
        const realType = (waveNumber >= 5 && i === 0) ? 'finger_bearer' : t;
        const ang = Math.random() * Math.PI * 2, r = 12 + Math.random() * 8;
        setTimeout(() => { if (gameStarted) createEnemy(realType, isl.x + Math.cos(ang) * r, isl.z + Math.sin(ang) * r); }, i * 500);
      }
      setTimeout(() => { waveActive = false; addKillMsg('✦ Wave ' + waveNumber + ' complete! +' + waveNumber * 50 + ' coins', '#ffdd44'); addCoins(waveNumber * 50); }, cnt * 500 + 15000);
    }

    // ═══════════════════ SECRET CHESTS ═══════════════════
    const chests = [];
    function spawnChests() {
      ISLANDS.forEach(isl => {
        if (isl.safe) return;
        if (Math.random() < 0.6) {
          const ang = Math.random() * Math.PI * 2, r = 5 + Math.random() * 10;
          const cx = isl.x + Math.cos(ang) * r, cz = isl.z + Math.sin(ang) * r;
          const geo = new THREE.BoxGeometry(0.6, 0.5, 0.4);
          const mat = new THREE.MeshStandardMaterial({ color: 0xaa7722, roughness: 0.4, metalness: 0.6, emissive: 0x442200, emissiveIntensity: 0.3 });
          const mesh = new THREE.Mesh(geo, mat); mesh.position.set(cx, 0.25, cz); mesh.castShadow = true; scene.add(mesh);
          // Glow
          const glow = new THREE.PointLight(0xffdd44, 1.5, 5); glow.position.set(cx, 1, cz); scene.add(glow);
          chests.push({ mesh, light: glow, x: cx, z: cz, collected: false });
        }
      });
    }
    function updateChests() {
      const pp = player.group.position;
      chests.forEach(c => {
        if (c.collected) return;
        c.mesh.rotation.y += dt * 0.5;
        c.mesh.position.y = 0.25 + Math.sin(elapsed * 2) * 0.15;
        const dist = Math.sqrt((pp.x - c.x) ** 2 + (pp.z - c.z) ** 2);
        if (dist < 2) {
          c.collected = true; scene.remove(c.mesh); scene.remove(c.light);
          const reward = 20 + Math.floor(Math.random() * 50);
          addCoins(reward);
          spawnCoinPickup(new THREE.Vector3(c.x, 2, c.z));
          addKillMsg('🎁 Chest opened! +' + reward + ' coins', '#ffdd44');
          for (let i = 0; i < 12; i++)spawnParticle(new THREE.Vector3(c.x, 1, c.z), new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5), 0xffdd44, 0.1, 0.6);
          // Respawn after 60s
          setTimeout(() => {
            if (!c) return; c.collected = false;
            const isl = ISLANDS[1 + Math.floor(Math.random() * (ISLANDS.length - 1))];
            const ang = Math.random() * Math.PI * 2, r = 5 + Math.random() * 10;
            c.x = isl.x + Math.cos(ang) * r; c.z = isl.z + Math.sin(ang) * r;
            c.mesh.position.set(c.x, 0.25, c.z); c.light.position.set(c.x, 1, c.z);
            scene.add(c.mesh); scene.add(c.light);
          }, 60000);
        }
      });
    }

    // ═══════════════════ SLOW MOTION ═══════════════════
    let slowMoTimer = 0, slowMoScale = 1;
    function triggerSlowMo(duration = 0.3) { slowMoTimer = duration; document.getElementById('slowmo-overlay').style.opacity = '1'; }
    function updateSlowMo(rawDt) {
      if (slowMoTimer > 0) { slowMoTimer -= rawDt; slowMoScale = 0.2; if (slowMoTimer <= 0) { slowMoScale = 1; document.getElementById('slowmo-overlay').style.opacity = '0'; } }
      else slowMoScale = 1;
    }

    // ═══════════════════ CRITICAL HITS ═══════════════════
    const CRIT_CHANCE = 0.12;
    function rollCrit() { return Math.random() < CRIT_CHANCE; }
    function applyCrit(dmg) { return Math.floor(dmg * 2.5); }
