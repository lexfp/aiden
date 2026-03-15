    // ═══════════════════ PLAYER ═══════════════════
    const MAX_LVL = 3000;
    let totalKills = 0, pvpWins = 0, pvpLosses = 0;
    const player = {
      group: new THREE.Group(), health: 100, maxHealth: 100, energy: 100, maxEnergy: 100, energyRegen: 8,
      speed: 12, dashSpeed: 40, jumpForce: 14, velocity: new THREE.Vector3(), grounded: true,
      isDashing: false, dashTimer: 0, dashDuration: 0.2, dashCooldown: 0, dashCooldownMax: 1, dashDirection: new THREE.Vector3(),
      isAttacking: false, attackTimer: 0, comboCount: 0, comboTimer: 0, comboWindow: 0.8,
      lightAttackCD: 0, heavyAttackCD: 0, invincible: false, invincibleTimer: 0, hitFlashTimer: 0, hitStaggerTimer: 0,
      currentAttackType: 'light', currentComboHit: 0,
      level: 1, xp: 0, xpToNext: 100, damageBonus: 1, inSafeZone: false, name: 'Sorcerer',
    };
    function getXpToNext(lvl) { return Math.floor(100 + lvl * 30); }
    function getLevelTitle(lvl) {
      if (lvl >= 3000) return '★ SIX EYES ★'; if (lvl >= 2001) return 'Special Grade ★★★'; if (lvl >= 1001) return 'Special Grade ★★';
      if (lvl >= 501) return 'Special Grade ★'; if (lvl >= 301) return 'Special Grade'; if (lvl >= 101) return 'Grade 1 Sorcerer';
      if (lvl >= 51) return 'Grade 2 Sorcerer'; if (lvl >= 11) return 'Semi-Grade'; return 'Cursed Novice';
    }
    function gainXP(amt) {
      if (player.level >= MAX_LVL) return; player.xp += amt;
      while (player.xp >= player.xpToNext && player.level < MAX_LVL) { player.xp -= player.xpToNext; player.level++; player.xpToNext = getXpToNext(player.level); onLevelUp(); }
      updateLevelUI();
    }
    function onLevelUp() {
      if (player.level % 10 === 0) { player.maxHealth += 5; player.health = Math.min(player.health + 5, player.maxHealth); player.maxEnergy += 2; }
      if (player.level % 50 === 0) { player.speed += 0.3; player.energyRegen += 0.5; }
      player.damageBonus = 1 + (player.level - 1) * 0.005;
      const el = document.getElementById('lvlup');
      el.innerHTML = `LEVEL UP!<br><span style="font-size:24px;color:#fff">Lv.${player.level}</span><br><span style="font-size:14px;color:${playerTech ? playerTech.color : '#ffdd44'}">${getLevelTitle(player.level)}</span>`;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      // Celebration particle burst
      if (gameStarted) {
        const pp = player.group.position;
        for (let i = 0; i < 30; i++) {
          const ang = (i / 30) * Math.PI * 2;
          spawnParticle(pp.clone().add(new THREE.Vector3(0, 2, 0)),
            new THREE.Vector3(Math.cos(ang) * 6, 3 + Math.random() * 5, Math.sin(ang) * 6),
            0xffdd44, 0.1 + Math.random() * 0.1, 0.8 + Math.random() * 0.5);
        }
        cameraShake(0.2); screenFlash('domain', 0.2);
        // Every 10 levels: big celebration
        if (player.level % 10 === 0) {
          triggerSlowMo(0.3);
          for (let i = 0; i < 50; i++) {
            const col = [0xff4466, 0xffdd44, 0x44ffaa, 0x8844ff, 0x00ccff][Math.floor(Math.random() * 5)];
            spawnParticle(pp.clone().add(new THREE.Vector3(0, 2, 0)),
              new THREE.Vector3((Math.random() - 0.5) * 15, 5 + Math.random() * 10, (Math.random() - 0.5) * 15),
              col, 0.12 + Math.random() * 0.1, 1 + Math.random() * 0.5);
          }
        }
      }
      // Save on level up
      saveGame(); showSaveIndicator();
    }
