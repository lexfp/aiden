    // ═══════════════════ UI ═══════════════════
    function updateBarsUI() {
      document.getElementById('health-fill').style.width = (player.health / player.maxHealth * 100) + '%';
      document.getElementById('energy-fill').style.width = (player.energy / player.maxEnergy * 100) + '%';
      document.getElementById('hp-txt').textContent = Math.ceil(player.health) + '/' + player.maxHealth;
    }
    function updateLevelUI() {
      document.getElementById('xp-fill').style.width = (player.xp / player.xpToNext * 100) + '%';
      document.getElementById('xp-txt').textContent = Math.floor(player.xp) + '/' + player.xpToNext;
      document.getElementById('level-num').textContent = player.level;
      document.getElementById('rank-title').textContent = getLevelTitle(player.level);
      if (player.level >= 3000) document.getElementById('level-num').style.color = '#ff4466';
    }
    function updateTechUI() {
      if (!playerTech) return;
      const p = document.getElementById('tech-panel'); p.style.display = 'flex';
      const tn = document.getElementById('tech-name'); tn.textContent = playerTech.name; tn.style.color = playerTech.color;
      document.getElementById('mastery-fill').style.width = (techMastery / MAX_MASTERY * 100) + '%';
      document.getElementById('mastery-fill').style.background = playerTech.color;
      document.getElementById('mastery-lbl').textContent = `MASTERY ${Math.floor(techMastery)}/${MAX_MASTERY}`;
      const sc = document.getElementById('move-slots'); sc.innerHTML = '';
      playerTech.moves.forEach((m, i) => {
        const ul = techMastery >= m.req, onCD = techMoveCDs[i] > 0;
        const slot = document.createElement('div'); slot.className = 'mv' + (ul ? '' : ' locked');
        slot.style.borderColor = ul ? playerTech.color : 'rgba(255,255,255,0.1)';
        const ov = document.createElement('div'); ov.className = 'mcd'; ov.style.background = playerTech.color + '44';
        ov.style.height = onCD ? ((techMoveCDs[i] / m.cd) * 100) + '%' : '0%';
        slot.innerHTML = `${!ul ? '<span style="position:absolute;top:3px;right:4px;font-size:12px;opacity:0.45">🔒</span>' : ''}<span class="mk">${m.key}</span><span class="mn">${m.name}</span>${!ul ? `<span class="mr">${m.req}</span>` : ''}`;
        slot.appendChild(ov); sc.appendChild(slot);
      });
    }
    function updateCDsUI() {
      cdSlot('cd-lmb', player.lightAttackCD, 0.35); cdSlot('cd-rmb', player.heavyAttackCD, 0.8);
      cdSlot('cd-q', abilQ.currentCD, abilQ.cooldown); cdSlot('cd-sh', player.dashCooldown, player.dashCooldownMax);
    }
    function cdSlot(id, cur, max) {
      const el = document.getElementById(id), ov = el.querySelector('.cd-ov');
      if (cur <= 0) { el.classList.add('ready'); ov.style.height = '0%'; } else { el.classList.remove('ready'); ov.style.height = (cur / max * 100) + '%'; }
    }
    function updateComboUI() {
      const el = document.getElementById('combo');
      if (player.comboCount > 1) {
        const mult = getComboMultiplier().toFixed(1);
        const techCol = playerTech ? playerTech.color : '#ff4466';
        // Enhanced combo display with scaling animation
        el.innerHTML = `<div class="combo-num" style="color:${player.comboCount >= 4 ? techCol : '#ff4466'}">${player.comboCount}x</div><div class="combo-label">COMBO</div><div class="combo-mult">×${mult} DMG</div>`;
        el.classList.add('show');
        const s = 1 + player.comboCount * 0.06;
        el.style.transform = `translateY(-50%) scale(${s})`;
        // Pulse effect on combo increase
        el.style.textShadow = `0 0 ${20 + player.comboCount * 5}px ${techCol}, 0 0 ${40 + player.comboCount * 8}px ${techCol}44`;
      } else el.classList.remove('show');
    }
    function addKillMsg(msg, color = '#ff8866') {
      const f = document.getElementById('killfeed'); const el = document.createElement('div'); el.className = 'kmsg'; el.textContent = msg; el.style.color = color; el.style.textShadow = '0 0 8px ' + color;
      f.appendChild(el); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
      if (f.children.length > 6) f.removeChild(f.firstChild);
    }
    function spawnDmgNum(pos, dmg, color = '#ffdd44', isCrit = false) {
      const sp = pos.clone().project(camera); if (sp.z > 1) return;
      const x = (sp.x * 0.5 + 0.5) * innerWidth, y = (-sp.y * 0.5 + 0.5) * innerHeight;
      const el = document.createElement('div'); el.className = 'dmg-n' + (isCrit ? ' crit' : '');
      el.textContent = (isCrit ? '⚡ ' : '') + Math.round(dmg) + (isCrit ? ' CRIT!' : '');
      el.style.left = (x + (Math.random() - 0.5) * 28) + 'px'; el.style.top = y + 'px';
      el.style.color = color; el.style.setProperty('--c', color);
      document.getElementById('ui').appendChild(el); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, isCrit ? 1200 : 1000);
    }
    const ehpEls = [];
    function updateEnemyHPBars() {
      ehpEls.forEach(el => { if (el.parentNode) el.parentNode.removeChild(el); }); ehpEls.length = 0;
      const allUnits = [...enemies, ...pvpBots];
      allUnits.forEach(e => {
        if (e.dead || e.health >= e.maxHealth) return;
        const wp = e.group.position.clone().add(new THREE.Vector3(0, 3.2 * (e.cfg ? e.cfg.size : 1), 0));
        const sp = wp.project(camera); if (sp.z > 1) return;
        const x = (sp.x * 0.5 + 0.5) * innerWidth, y = (-sp.y * 0.5 + 0.5) * innerHeight;
        const cont = document.createElement('div'); cont.className = 'ehp'; cont.style.left = (x - 40) + 'px'; cont.style.top = y + 'px';
        const nm = document.createElement('div'); nm.className = 'ehp-name';
        const isPvp = !e.cfg;
        const isElite = !isPvp && e.isElite;
        const col = isPvp ? e.tech.color : (e.cfg.boss ? '#ff6600' : (isElite ? '#ffaa00' : '#ff4466'));
        nm.style.color = col; nm.textContent = isPvp ? e.name : (e.cfg.boss ? '★ BOSS: ' + e.type.toUpperCase() : (isElite ? '⚡ ELITE: ' + e.type.toUpperCase() : e.type.toUpperCase()));
        const bar = document.createElement('div'); bar.className = 'ehp-bar'; bar.style.width = isPvp ? '80px' : '60px';
        const fill = document.createElement('div'); fill.className = 'ehp-fill'; fill.style.background = isPvp ? `linear-gradient(90deg,${e.tech.color},${e.tech.color}aa)` : 'linear-gradient(90deg,#ff2244,#ff6644)';
        fill.style.width = (e.health / e.maxHealth * 100) + '%';
        bar.appendChild(fill); cont.appendChild(nm); cont.appendChild(bar);
        document.getElementById('ui').appendChild(cont); ehpEls.push(cont);
      });
    }

    // MINIMAP
    function updateMinimap() {
      const cv = document.getElementById('mm-canvas'); if (!cv) return;
      const ctx = cv.getContext('2d'); const W = 140, H = 140;
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);
      const scale = 0.85;// world units to pixels
      function wToM(wx, wz) { return { x: W / 2 + wx * scale, y: H / 2 + wz * scale }; }
      // Islands
      ISLANDS.forEach(isl => {
        const p = wToM(isl.x, isl.z);
        const col = isl.safe ? 'rgba(68,255,170,0.25)' : 'rgba(80,60,120,0.3)';
        ctx.fillStyle = col; ctx.strokeStyle = isl.safe ? 'rgba(68,255,170,0.6)' : 'rgba(136,68,255,0.4)';
        ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(p.x - isl.w * scale / 2, p.y - isl.d * scale / 2, isl.w * scale, isl.d * scale); ctx.fill(); ctx.stroke();
      });
      // Safe zone circle
      const sc = wToM(SAFE_ISLAND.x, SAFE_ISLAND.z); ctx.strokeStyle = 'rgba(68,255,170,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(sc.x, sc.y, SAFE_RADIUS * scale, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      // PvP bots
      pvpBots.forEach(b => { if (b.dead) return; const bp = wToM(b.group.position.x, b.group.position.z); ctx.fillStyle = b.tech.color; ctx.beginPath(); ctx.arc(bp.x, bp.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
      // Enemies
      enemies.forEach(e => { if (e.dead) return; const ep = wToM(e.group.position.x, e.group.position.z); ctx.fillStyle = e.cfg.boss ? '#ff6600' : 'rgba(255,80,80,0.8)'; ctx.beginPath(); ctx.arc(ep.x, ep.y, e.cfg.boss ? 3.5 : 1.8, 0, Math.PI * 2); ctx.fill(); });
      // Player
      const pp2 = wToM(player.group.position.x, player.group.position.z);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pp2.x, pp2.y, 4, 0, Math.PI * 2); ctx.fill();
      const fc = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pp2.x, pp2.y); ctx.lineTo(pp2.x + fc.x * 8, pp2.y + fc.z * 8); ctx.stroke();
    }

    // HOME PANEL
    function openHomePanel() {
      homeOpen = true; document.exitPointerLock();
      const p = document.getElementById('home-panel'); p.classList.add('open');
      document.getElementById('hp-name').textContent = player.name;
      document.getElementById('hp-level').textContent = 'Lv.' + player.level;
      document.getElementById('hp-rank').textContent = getLevelTitle(player.level);
      document.getElementById('hp-tech').textContent = playerTech ? playerTech.name : 'None';
      document.getElementById('hp-mastery').textContent = Math.floor(techMastery) + '/' + MAX_MASTERY;
      document.getElementById('hp-kills').textContent = totalKills;
      document.getElementById('hp-pvpw').textContent = pvpWins;
      document.getElementById('hp-pvpl').textContent = pvpLosses;
      document.getElementById('hp-dmgb').textContent = '+' + ((player.damageBonus - 1) * 100).toFixed(1) + '%';
      document.getElementById('reroll-cost').textContent = '(' + Math.min(9999, player.level * 20) + ' XP)';
      buildSkillGrid();
      const tb = document.getElementById('hp-pvp-table'); tb.innerHTML = '';
      pvpBots.forEach(b => { const r = document.createElement('div'); r.className = 'pvp-score-row'; r.innerHTML = `<span class="ps-name" style="color:${b.tech.color}">${b.name}</span><span class="ps-kills" title="your kills">K:${b.deaths}</span><span class="ps-deaths" title="their kills">D:${b.kills}</span>`; tb.appendChild(r); });
    }
    function closeHomePanel() { homeOpen = false; document.getElementById('home-panel').classList.remove('open'); }
    function rerollTech() {
      const cost = Math.min(9999, player.level * 20); if (player.xp < cost) { showMasteryNotif('⚠ Not enough XP'); return; }
      player.xp -= cost; techMastery = 0; techMoveCDs = [];
      const t = TECHNIQUES[Math.floor(Math.random() * TECHNIQUES.length)];
      playerTech = t; techMoveCDs = new Array(t.moves.length).fill(0);
      updateLevelUI(); updateTechUI(); showMasteryNotif('🎲 Rerolled: ' + t.name); closeHomePanel();
    }