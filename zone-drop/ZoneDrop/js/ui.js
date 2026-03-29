// =============================================================================
// STORM ZONE — UI System
// HUD, menus, minimap, kill feed, inventory slots.
// =============================================================================

class UISystem {
  constructor(player, storm, botManager) {
    this.player     = player;
    this.storm      = storm;
    this.botManager = botManager;

    // Kill feed: [{ text, timer }]
    this._killFeed = [];
    this._minimapCtx = null;

    const mc = document.getElementById('minimapCanvas');
    if (mc) this._minimapCtx = mc.getContext('2d');
  }

  // ── Screen management ─────────────────────────────────────────────────────
  showHUD()     { document.getElementById('hud').style.display = 'block'; }
  hideHUD()     { document.getElementById('hud').style.display = 'none';  }
  showOverlay() { document.getElementById('overlayScreen').style.display = 'flex';  }
  hideOverlay() { document.getElementById('overlayScreen').style.display = 'none';  }

  setOverlay(title, subtitle, btnText, showStats) {
    document.getElementById('overlayTitle').textContent    = title;
    document.getElementById('overlaySubtitle').textContent = subtitle;
    document.getElementById('overlayBtn').textContent      = btnText;

    const stats = document.getElementById('overlayStats');
    if (showStats) {
      stats.innerHTML = `
        <div class="stat-row">Kills: ${this.player.kills}</div>
        <div class="stat-row">Survived: ${Math.floor(showStats.elapsed)}s</div>
      `;
    } else {
      stats.innerHTML = '';
    }
  }

  // ── Per-frame HUD update ─────────────────────────────────────────────────
  update(dt) {
    this._updateHealth();
    this._updateWeaponSlots();
    this._updateAmmo();
    this._updateResources();
    this._updateStormInfo();
    this._updatePlayerCount();
    this._updateBuildMode();
    this._tickKillFeed(dt);
    this._drawMinimap();
  }

  // ── Health / Shield ───────────────────────────────────────────────────────
  _updateHealth() {
    const p = this.player;
    const hpPct  = (p.hp     / 100) * 100;
    const shPct  = (p.shield / 100) * 100;

    this._set('hpBar',     'width', hpPct  + '%');
    this._set('shieldBar', 'width', shPct  + '%');
    this._setText('hpText',     Math.ceil(p.hp));
    this._setText('shieldText', Math.ceil(p.shield));
  }

  // ── Weapon slots ──────────────────────────────────────────────────────────
  _updateWeaponSlots() {
    const p = this.player;
    for (let i = 0; i < 5; i++) {
      const slot = document.getElementById('slot' + i);
      const w    = p.weapons[i];
      if (!slot) continue;

      slot.classList.toggle('active', i === p.currentSlot);

      const icon = document.getElementById('slotIcon' + i);
      const name = document.getElementById('slotName' + i);
      const ammo = document.getElementById('slotAmmo' + i);

      if (w) {
        if (icon) icon.style.background = hexStr(w.def.color);
        if (name) name.textContent = w.def.name;
        if (ammo) ammo.textContent = w.mag + '/' + p.ammo[w.def.ammoType];
      } else {
        if (icon) icon.style.background = 'transparent';
        if (name) name.textContent = 'EMPTY';
        if (ammo) ammo.textContent = '';
      }
    }
  }

  // ── Ammo display (bottom right) ───────────────────────────────────────────
  _updateAmmo() {
    const p = this.player;
    const w = p.currentWeapon();
    const mainEl    = document.getElementById('ammoMain');
    const reserveEl = document.getElementById('ammoReserve');
    const reloadEl  = document.getElementById('reloadText');

    if (!mainEl) return;

    if (!w) {
      mainEl.textContent    = '--';
      reserveEl.textContent = '';
      reloadEl.style.display = 'none';
      return;
    }

    if (p.isReloading()) {
      reloadEl.style.display = 'block';
      mainEl.textContent     = 'RELOADING';
      reserveEl.textContent  = '';
    } else {
      reloadEl.style.display = 'none';
      mainEl.textContent     = w.mag + ' / ' + w.def.mag;
      reserveEl.textContent  = p.ammo[w.def.ammoType];
    }
  }

  // ── Building resources ────────────────────────────────────────────────────
  _updateResources() {
    const r = this.player.resources;
    this._setText('resWood',  r.wood);
    this._setText('resStone', r.stone);
    this._setText('resMetal', r.metal);
  }

  // ── Storm info ────────────────────────────────────────────────────────────
  _updateStormInfo() {
    const s = this.storm;
    const t = Math.max(0, s.timeToNextPhase());
    this._setText('stormTimer', fmtTime(t));
    this._setText('stormPhase', s.statusText() + ' — ' + s.phaseLabel());

    // Pulse red when player is outside storm
    const p = this.player;
    const outside = s.isOutside(p.position.x, p.position.z);
    const stormEl = document.getElementById('stormInfo');
    if (stormEl) stormEl.style.color = outside ? '#e74c3c' : '#9b59b6';
  }

  // ── Player count ─────────────────────────────────────────────────────────
  _updatePlayerCount() {
    const alive = this.botManager.aliveCount() + (this.player.alive ? 1 : 0);
    this._setText('playerCount', alive);
  }

  // ── Build mode ────────────────────────────────────────────────────────────
  _updateBuildMode() {
    const bm  = document.getElementById('buildMode');
    const bph = document.getElementById('buildPieceHint');
    if (!bm) return;
    const active = this.player.buildMode;
    bm.style.display  = active ? 'block' : 'none';
    bph.style.display = active ? 'block' : 'none';
  }

  // ── Kill feed ─────────────────────────────────────────────────────────────
  addKill(killer, victim) {
    const feed = document.getElementById('killFeed');
    if (!feed) return;

    const el = document.createElement('div');
    el.className = 'kill-entry';
    el.textContent = killer + ' → ' + victim;
    feed.appendChild(el);
    this._killFeed.push({ el, timer: 4 });
  }

  _tickKillFeed(dt) {
    this._killFeed = this._killFeed.filter(kf => {
      kf.timer -= dt;
      if (kf.timer <= 0) {
        kf.el.remove();
        return false;
      }
      if (kf.timer < 1) kf.el.style.opacity = kf.timer.toString();
      return true;
    });
  }

  // ── Minimap ───────────────────────────────────────────────────────────────
  _drawMinimap() {
    const ctx = this._minimapCtx;
    if (!ctx) return;

    const W = 120, H = 120;
    const scale = W / CFG.MAP.SIZE; // pixels per world unit
    const cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    // Storm circle
    const sR = this.storm.currentRadius * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, sR, 0, Math.PI * 2);
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Bots (red dots)
    ctx.fillStyle = '#e74c3c';
    this.botManager.bots.forEach(b => {
      if (!b.alive) return;
      const bx = cx + b.position.x * scale;
      const by = cy + b.position.z * scale;
      ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI * 2); ctx.fill();
    });

    // Player (blue dot, larger)
    const px = cx + this.player.position.x * scale;
    const py = cy + this.player.position.z * scale;
    ctx.fillStyle = '#3498db';
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();

    // Direction arrow
    const angle = -this.player.camYaw + Math.PI;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(-3, 2); ctx.lineTo(3, 2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _set(id, prop, val) {
    const el = document.getElementById(id);
    if (el) el.style[prop] = val;
  }
  _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
}
