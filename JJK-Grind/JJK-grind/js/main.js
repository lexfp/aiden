    // ═══════════════════ GAME LOOP & DAY/NIGHT ═══════════════════
    let timeOfDay = 8.0; // Starts at 8 AM
    const DAY_LENGTH_SEC = 240; // Real-world seconds per in-game day

    function updateDayNight(dt) {
      if (!sunLight) return;
      timeOfDay += (dt / DAY_LENGTH_SEC) * 24;
      if (timeOfDay >= 24) timeOfDay -= 24;

      const sunAngle = ((timeOfDay - 6) / 12) * Math.PI; // 0 at dawn, PI at dusk

      if (timeOfDay >= 6 && timeOfDay <= 18) {
        sunLight.intensity = Math.max(0.2, Math.sin(sunAngle) * 1.5);
        sunLight.position.set(Math.cos(sunAngle) * -200, Math.sin(sunAngle) * 150, -50);
        
        if (timeOfDay < 7.5 || timeOfDay > 16.5) {
          // Sunrise & Sunset (Orange/Pink)
          sunLight.color.setHex(0xffaa66);
          ambientLight.color.setHex(0x442222);
          scene.background = new THREE.Color().setHSL(0.08, 0.6, 0.4);
          scene.fog.color.setHSL(0.08, 0.6, 0.4);
        } else {
          // Midday (Bright Blue)
          sunLight.color.setHex(0xffffff);
          ambientLight.color.setHex(0x555566);
          scene.background = new THREE.Color().setHSL(0.55, 0.8, 0.7);
          scene.fog.color.setHSL(0.55, 0.8, 0.7);
        }
      } else {
        // Night (Dark Blue, Moonlight)
        sunLight.intensity = 0.2;
        sunLight.position.set(Math.cos(sunAngle) * -200, Math.sin(sunAngle) * -150, -50);
        sunLight.color.setHex(0x6688ff);
        ambientLight.color.setHex(0x111122);
        scene.background = new THREE.Color().setHSL(0.65, 0.8, 0.05);
        scene.fog.color.setHSL(0.65, 0.8, 0.05);
      }
    }

    function gameLoop() {
      requestAnimationFrame(gameLoop); const rawDt = Math.min(clock.getDelta(), 0.05);
      updateSlowMo(rawDt); dt = rawDt * slowMoScale; elapsed = clock.getElapsedTime();
      
      updateDayNight(dt);

      if (!gameStarted) { camera.position.set(Math.sin(elapsed * 0.12) * 80, 25, Math.cos(elapsed * 0.12) * 80); camera.lookAt(0, 3, 0); renderer.render(scene, camera); return; }
      updatePlayer(dt); updateCamera(dt); updateEnemies(dt); updatePvpBots(dt); updateDomain(dt);
      updateWaveSystem(rawDt); updateChests(); updateLootDrops(dt); updateAmbushSystem(rawDt);
      updateNPCs(dt);
      if (abilQ.currentCD > 0) abilQ.currentCD -= dt;
      updateParticles(dt); updateSlashTrails(dt); updateHitFlashes(dt); updateDashTrails(dt); spawnEnergyPts();
      updateBarsUI(); updateCDsUI(); updateEnemyHPBars(); updateTechUI(); updateMinimap(); updateCoinsUI();

      // Low HP vignette
      const hp = player.health / player.maxHealth;
      document.getElementById('vignette').style.opacity = hp < 0.35 ? (1 + (hp - 0.35) * 3) * 0.85 : '1';
      document.getElementById('vignette').style.background = hp < 0.35
        ? `radial-gradient(ellipse at center,transparent 45%,rgba(180,0,30,${0.45 * (1 - hp / 0.35)}) 100%)`
        : `radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,0.55) 100%)`;

      floatingRocks.forEach(r => { r.position.y = r.userData.by + Math.sin(elapsed * r.userData.fs + r.userData.fo) * 1.5; r.rotation.y += dt * 0.22; r.rotation.x += dt * 0.08; });
      if (window.parrotCameos && window.parrotCameos.length) {
        window.parrotCameos.forEach((o) => {
          if (o.userData.isParrotCameo) {
            o.position.y = o.userData.baseY + Math.sin(elapsed * 2.2) * 0.35;
            o.rotation.y += dt * 0.45;
          }
          if (o.userData.mixer) o.userData.mixer.update(dt);
        });
      }
      if (dustPts) { const dp = dustPts.geometry.attributes.position; for (let i = 0; i < DUST_CNT; i++) { dp.array[i * 3 + 1] += dt * 0.22; if (dp.array[i * 3 + 1] > 24) dp.array[i * 3 + 1] = 0; } dp.needsUpdate = true; }
      worldLights.forEach(({ light, base, phase }) => { light.intensity = base + Math.sin(elapsed * 1.5 + phase) * 0.6; });

      // Shrine orb bob
      scene.traverse(obj => { if (obj.isMesh && obj.userData.isOrb) { obj.position.y = 2.2 + Math.sin(elapsed * 2) * 0.22; obj.material.opacity = 0.6 + Math.sin(elapsed * 3.5) * 0.18; obj.rotation.y += dt * 0.8; } });
      renderer.render(scene, camera);
    }
    buildWorld();
    initNPCs();
    gameLoop();
