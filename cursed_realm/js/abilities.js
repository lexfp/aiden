    // ═══════════════════ ABILITIES ═══════════════════
    const abilQ = { energyCost: 35, cooldown: 3, currentCD: 0, damage: 50, range: 6, knockback: 20 };
    function activateAbilityQ() {
      if (abilQ.currentCD > 0 || player.energy < abilQ.energyCost) return;
      player.energy -= abilQ.energyCost; abilQ.currentCD = abilQ.cooldown; player.isAttacking = true; player.attackTimer = 0.5;
      player.currentAttackType = 'cursed';
      const fw = new THREE.Vector3(-Math.sin(player.group.rotation.y), 0, -Math.cos(player.group.rotation.y));
      enemies.forEach(e => { if (e.dead) return; const toE = new THREE.Vector3().subVectors(e.group.position, player.group.position); if (toE.length() > abilQ.range) return; toE.normalize(); if (fw.dot(toE) < -0.1) return; damageEnemy(e, Math.floor(abilQ.damage * player.damageBonus), abilQ.knockback, toE); });
      pvpBots.forEach(b => { if (b.dead || b.inSafeZone) return; const toB = new THREE.Vector3().subVectors(b.group.position, player.group.position); if (toB.length() > abilQ.range) return; toB.normalize(); if (fw.dot(toB) < -0.1) return; damagePvpBot(b, Math.floor(abilQ.damage * player.damageBonus * 0.8), abilQ.knockback, toB); });
      // Use new unique cursed strike VFX
      spawnCursedStrikeVFX(player.group.position.clone(), player.group.rotation.y);
      spawnCursedBurst(player.group.position.clone(), player.group.rotation.y); updateBarsUI();
    }
    function activateTechMove(idx) {
      if (!playerTech || !gameStarted) return;
      const move = playerTech.moves[idx]; if (!move) return;
      if (techMastery < move.req) { showMasteryNotif('⚠ Requires Mastery ' + move.req); return; }
      if (techMoveCDs[idx] > 0) return; if (player.energy < move.cost) return;
      if (move.req >= 80) { activateDomain(playerTech); techMoveCDs[idx] = move.cd; updateBarsUI(); return; }
      player.energy -= move.cost; techMoveCDs[idx] = move.cd;
      execTechMove(move, idx); gainMastery(1.5); updateBarsUI();
    }
    function execTechMove(move, idx) {
      const t = playerTech, pp = player.group.position.clone();
      const fw = new THREE.Vector3(-Math.sin(player.group.rotation.y), 0, -Math.cos(player.group.rotation.y));
      const kb = idx === 2 ? 22 : (idx === 1 ? 16 : 10);
      function hitAll(range, dmg, kbf) {
        enemies.forEach(e => { if (e.dead) return; const toE = new THREE.Vector3().subVectors(e.group.position, pp); if (toE.length() > range) return; toE.normalize(); if (fw.dot(toE) > -0.3) damageEnemy(e, Math.floor(dmg * player.damageBonus), kbf, toE); });
        pvpBots.forEach(b => { if (b.dead || b.inSafeZone) return; const toB = new THREE.Vector3().subVectors(b.group.position, pp); if (toB.length() > range) return; toB.normalize(); if (fw.dot(toB) > -0.3) damagePvpBot(b, Math.floor(dmg * player.damageBonus * 0.7), kbf, toB); });
      }
      if (t.id === 'limitless' && idx === 1) { enemies.forEach(e => { if (e.dead) return; if (e.group.position.distanceTo(pp) > move.range) return; const d = new THREE.Vector3().subVectors(pp, e.group.position).normalize(); e.knockbackVel.copy(d.multiplyScalar(20)); e.knockbackVel.y = 5; damageEnemy(e, move.dmg, 0, d); }); pvpBots.forEach(b => { if (b.dead || b.inSafeZone) return; if (b.group.position.distanceTo(pp) > move.range) return; const d = new THREE.Vector3().subVectors(pp, b.group.position).normalize(); b.knockbackVel.copy(d.multiplyScalar(20)); damagePvpBot(b, Math.floor(move.dmg * 0.7), 0, d); }); spawnTechFX(pp, t.hex, move.range, 'ring'); return; }
      if (t.id === 'limitless' && idx === 2) { enemies.forEach(e => { if (e.dead) return; if (e.group.position.distanceTo(pp) > move.range) return; const d = new THREE.Vector3().subVectors(e.group.position, pp).normalize(); e.knockbackVel.copy(d.multiplyScalar(30)); e.knockbackVel.y = 8; damageEnemy(e, move.dmg, 0, d); }); pvpBots.forEach(b => { if (b.dead || b.inSafeZone) return; if (b.group.position.distanceTo(pp) > move.range) return; const d = new THREE.Vector3().subVectors(b.group.position, pp).normalize(); b.knockbackVel.copy(d.multiplyScalar(25)); damagePvpBot(b, Math.floor(move.dmg * 0.7), 0, d); }); spawnTechFX(pp, t.hex, move.range, 'burst'); return; }
      if (t.id === 'cursedSpeech' && idx === 1) { enemies.forEach(e => { if (e.dead) return; if (e.group.position.distanceTo(pp) > move.range) return; e.state = 'stunned'; e.stateTimer = 3; spawnHitFlash(e.group.position.clone().add(new THREE.Vector3(0, 2, 0)), t.color, 1); }); pvpBots.forEach(b => { if (b.dead || b.inSafeZone) return; if (b.group.position.distanceTo(pp) > move.range) return; b.state = 'stunned'; b.stateTimer = 3; }); spawnTechFX(pp, t.hex, move.range, 'ring'); return; }
      if (t.id === 'boogieWoogie' && idx === 0) { let near = null, nd = 999; enemies.forEach(e => { if (e.dead) return; const d = e.group.position.distanceTo(pp); if (d < nd && d < move.range) { nd = d; near = e; } }); pvpBots.forEach(b => { if (b.dead || b.inSafeZone) return; const d = b.group.position.distanceTo(pp); if (d < nd && d < move.range) { nd = d; near = b; } }); if (near) { const beh = near.group.position.clone().add(new THREE.Vector3(Math.sin(near.group.rotation.y) * 2, 0, Math.cos(near.group.rotation.y) * 2)); player.group.position.copy(beh); spawnDashTrail(pp); if (near.cfg) damageEnemy(near, move.dmg, 15, new THREE.Vector3(0, 0, 1)); else damagePvpBot(near, Math.floor(move.dmg * 0.7), 15, new THREE.Vector3(0, 0, 1)); spawnTechFX(near.group.position.clone(), t.hex, 3, 'burst'); } return; }
      hitAll(move.range, move.dmg, kb);
      // Use technique-specific VFX system
      spawnTechniqueVFX(pp.clone(), t.id, idx, move.range);
      spawnTechFX(pp.clone().add(new THREE.Vector3(0, 1.5, 0)), t.hex, move.range, idx === 0 ? 'burst' : (idx === 1 ? 'ring' : 'wave'));
      player.isAttacking = true; player.attackTimer = 0.4; player.currentAttackType = 'technique';
    }