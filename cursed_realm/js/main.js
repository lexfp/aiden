    // ═══════════════════ GAME LOOP ═══════════════════
    function gameLoop() {
      requestAnimationFrame(gameLoop); const rawDt = Math.min(clock.getDelta(), 0.05);
      updateSlowMo(rawDt); dt = rawDt * slowMoScale; elapsed = clock.getElapsedTime();
      if (!gameStarted) { camera.position.set(Math.sin(elapsed * 0.12) * 80, 25, Math.cos(elapsed * 0.12) * 80); camera.lookAt(0, 3, 0); renderer.render(scene, camera); return; }
      updatePlayer(dt); updateCamera(dt); updateEnemies(dt); updatePvpBots(dt); updateDomain(dt);
      updateWaveSystem(rawDt); updateChests(); updateLootDrops(dt); updateAmbushSystem(rawDt);
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
      if (dustPts) { const dp = dustPts.geometry.attributes.position; for (let i = 0; i < DUST_CNT; i++) { dp.array[i * 3 + 1] += dt * 0.22; if (dp.array[i * 3 + 1] > 24) dp.array[i * 3 + 1] = 0; } dp.needsUpdate = true; }
      worldLights.forEach(({ light, base, phase }) => { light.intensity = base + Math.sin(elapsed * 1.5 + phase) * 0.6; });

      // Shrine orb bob
      scene.traverse(obj => { if (obj.isMesh && obj.userData.isOrb) { obj.position.y = 2.2 + Math.sin(elapsed * 2) * 0.22; obj.material.opacity = 0.6 + Math.sin(elapsed * 3.5) * 0.18; obj.rotation.y += dt * 0.8; } });
      renderer.render(scene, camera);
    }
    buildWorld();
    gameLoop();
