    // ═══════════════════ COMBAT ═══════════════════
    function getComboMultiplier() { return 1 + Math.min(player.comboCount * 0.15, 1.5); }
    function getDmgBonus() { return player.damageBonus * (1 + ((player.upgrades || {}).damage || 0) * 0.03); }
    function performLightAttack() {
      if (player.lightAttackCD > 0 || player.isAttacking) return;
      if (player.isDashing) { performDashAtk(); return; }
      player.isAttacking = true; player.attackTimer = 0.25; player.lightAttackCD = 0.35;
      player.comboCount++; player.comboTimer = player.comboWindow;
      // Store which attack type for animation system
      player.currentAttackType = 'light'; player.currentComboHit = player.comboCount;
      updateComboUI();
      const isAir = !player.grounded;
      let dmg = Math.floor((12 + (player.comboCount >= 3 ? 8 : 0) + (isAir ? 6 : 0)) * getDmgBonus() * getComboMultiplier());
      const isCrit = rollCrit(); if (isCrit) { dmg = applyCrit(dmg); triggerSlowMo(0.15); cameraShake(0.4); }
      hitEnemiesRange(3.5, dmg, 8 + (player.comboCount >= 3 ? 5 : 0), isCrit); hitPvpBotsRange(3.5, dmg, 8, isCrit);
      // Use new unique light attack VFX instead of generic slash
      spawnLightAttackVFX(player.group.position.clone(), player.group.rotation.y, player.comboCount);
      if (isCrit) spawnSlashTrail(player.group.position.clone(), player.group.rotation.y, '#ff2244', 1.0);
      // Combo finisher at 4 hits
      if (player.comboCount >= 4) {
        player.comboCount = 0; player.comboTimer = 0;
        spawnSlashTrail(player.group.position.clone(), player.group.rotation.y, '#8844ff', 1.2);
        spawnCursedStrikeVFX(player.group.position.clone(), player.group.rotation.y); // finisher burst
        hitEnemiesRange(4.5, Math.floor(20 * getDmgBonus()), 15, false); hitPvpBotsRange(4.5, Math.floor(20 * getDmgBonus()), 15, false);
        triggerSlowMo(0.15); cameraShake(0.35); updateComboUI();
      }
    }
    function performHeavyAttack() {
      if (player.heavyAttackCD > 0 || player.isAttacking || player.energy < 15) return;
      player.energy -= 15; player.isAttacking = true; player.attackTimer = 0.5; player.heavyAttackCD = 0.8;
      player.currentAttackType = 'heavy';
      let dmg = Math.floor(30 * getDmgBonus() * getComboMultiplier());
      const isCrit = rollCrit(); if (isCrit) { dmg = applyCrit(dmg); triggerSlowMo(0.3); cameraShake(0.8); }
      hitEnemiesRange(4.5, dmg, 18, isCrit); hitPvpBotsRange(4.5, dmg, 18, isCrit);
      // Use new unique heavy attack VFX
      spawnHeavyAttackVFX(player.group.position.clone(), player.group.rotation.y, isCrit);
      if (isCrit) cameraZoom(0.4);
    }
    function performDashAtk() {
      player.isDashing = false; player.isAttacking = true; player.attackTimer = 0.3; player.lightAttackCD = 0.5;
      player.currentAttackType = 'light';
      let dmg = Math.floor(22 * getDmgBonus());
      const isCrit = rollCrit(); if (isCrit) { dmg = applyCrit(dmg); triggerSlowMo(0.2); cameraShake(0.5); }
      hitEnemiesRange(5.5, dmg, 22, isCrit); hitPvpBotsRange(5.5, dmg, 22, isCrit);
      // Dash attack: wide arc slash + motion trail
      spawnSlashTrail(player.group.position.clone(), player.group.rotation.y, isCrit ? '#ff2244' : '#cc66ff', 2.2);
      spawnHitFlash(player.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), isCrit ? '#ffdd44' : '#cc66ff', 2);
      spawnDebris(player.group.position.clone(), 3);
      if (isCrit) cameraZoom(0.35);
    }
    function hitEnemiesRange(range, dmg, kb, isCrit = false) {
      const pp = player.group.position, fw = new THREE.Vector3(-Math.sin(player.group.rotation.y), 0, -Math.cos(player.group.rotation.y));
      enemies.forEach(e => { if (e.dead) return; const toE = new THREE.Vector3().subVectors(e.group.position, pp); if (toE.length() > range) return; toE.normalize(); if (fw.dot(toE) < -0.3) return; damageEnemy(e, dmg, isCrit ? kb * 1.8 : kb, toE, isCrit); });
    }
    function hitPvpBotsRange(range, dmg, kb, isCrit = false) {
      const pp = player.group.position, fw = new THREE.Vector3(-Math.sin(player.group.rotation.y), 0, -Math.cos(player.group.rotation.y));
      pvpBots.forEach(b => { if (b.dead || b.inSafeZone) return; const toB = new THREE.Vector3().subVectors(b.group.position, pp); if (toB.length() > range) return; toB.normalize(); if (fw.dot(toB) < -0.3) return; damagePvpBot(b, dmg, isCrit ? kb * 1.8 : kb, toB, isCrit); });
    }
    function damageEnemy(enemy, damage, knockback, direction, isCrit = false) {
      enemy.health -= damage; enemy.hitFlashTimer = 0.15;
      if (knockback > 0) { enemy.knockbackVel = direction.clone().multiplyScalar(knockback); enemy.knockbackVel.y = knockback * 0.3; }
      enemy.state = 'stunned'; enemy.stateTimer = isCrit ? 0.7 : 0.4;
      // Stagger animation - tilt enemy on hit
      enemy.group.rotation.x = (Math.random() - 0.5) * 0.3;
      setTimeout(() => { if (enemy.group) enemy.group.rotation.x = 0; }, 200);
      spawnHitFlash(enemy.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), isCrit ? '#ff2244' : '#ffdd44', isCrit ? 2 : 1);
      spawnDmgNum(enemy.group.position.clone().add(new THREE.Vector3(0, 3, 0)), damage, isCrit ? '#ff2244' : '#ffdd44', isCrit);
      // Hit sparks
      for (let i = 0; i < (isCrit ? 8 : 3); i++)spawnParticle(enemy.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6), isCrit ? 0xff2244 : 0xffdd44, 0.06, 0.3);
      if (isCrit) cameraShake(0.3);
      if (enemy.health <= 0) killEnemy(enemy);
    }
    function damagePlayer(amount, fromPvp = false) {
      if (player.invincible || player.inSafeZone) return;
      player.health -= amount; player.hitFlashTimer = 0.25; player.invincible = true; player.invincibleTimer = 0.5;
      // Hit stagger - brief knockback and animation disruption
      player.hitStaggerTimer = 0.3;
      player.isAttacking = false; player.attackTimer = 0;
      // Camera shake scaled to damage
      cameraShake(Math.min(amount / 25, 1.2));
      // Screen flash
      screenFlash('', Math.min(amount / 40, 0.6));
      // Hit overlay border flash
      const ho = document.getElementById('hit-overlay');
      ho.classList.add('active'); setTimeout(() => ho.classList.remove('active'), 200);
      // Bar pulse
      const hf = document.getElementById('health-fill');
      hf.classList.remove('bar-hit'); void hf.offsetWidth; hf.classList.add('bar-hit');
      // Slow motion on big hits
      if (amount >= 30) triggerSlowMo(0.15);
      if (player.health <= 0) { player.health = 0; if (fromPvp) pvpLosses++; respawnPlayer(); }
      updateBarsUI();
    }
    function respawnPlayer(full = false) {
      if (full) { if (player.xp < 500) return; player.xp -= 500; updateLevelUI(); }
      player.health = player.maxHealth; player.energy = player.maxEnergy;
      player.group.position.set(0, 0, 0); player.velocity.set(0, 0, 0); player.comboCount = 0;
      updateBarsUI(); updateComboUI();
    }
