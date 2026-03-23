// ═══════════════════ HUD DRAWING ═══════════════════

function drawHUD(ctx, player, canvasW, canvasH) {
  const pad = 16;
  const barW = 200;
  const barH = 14;
  const x0 = pad;
  const y0 = canvasH - pad - 90;

  // Background panel
  ctx.fillStyle = 'rgba(10,6,16,0.75)';
  ctx.strokeStyle = 'rgba(148,0,211,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, x0 - 8, y0 - 8, barW + 70, 96, 6);
  ctx.fill();
  ctx.stroke();

  // HP bar
  drawBar(ctx, x0, y0, barW, barH, player.hp, player.maxHp, COLORS.hp, 'HP');

  // MP bar
  drawBar(ctx, x0, y0 + 22, barW, barH, player.mp, player.maxMp, COLORS.mp, 'MP');

  // XP bar
  const xpNeeded = xpForLevel(gameState.level);
  drawBar(ctx, x0, y0 + 44, barW, barH, gameState.xp, xpNeeded, COLORS.xp, 'XP');

  // Level & Rank
  const rank = getRank(gameState.level);
  ctx.font = 'bold 22px Rajdhani, sans-serif';
  ctx.fillStyle = rank.color;
  ctx.textAlign = 'left';
  ctx.fillText('LV ' + gameState.level, x0, y0 - 14);
  ctx.font = '13px Rajdhani, sans-serif';
  ctx.fillStyle = rank.color;
  ctx.fillText(rank.rank + '-Rank Hunter', x0 + 60, y0 - 14);

  // Shadows count (top right)
  ctx.font = 'bold 14px Rajdhani, sans-serif';
  ctx.fillStyle = COLORS.shadow;
  ctx.textAlign = 'right';
  ctx.shadowBlur = 8;
  ctx.shadowColor = COLORS.shadow;
  ctx.fillText('SHADOWS: ' + gameState.shadows, canvasW - pad, 30);
  ctx.shadowBlur = 0;

  // Kills
  ctx.font = '12px Rajdhani, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('KILLS: ' + gameState.totalKills, canvasW - pad, 48);

  // Combo
  if (player.combo > 1) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px Rajdhani, sans-serif';
    ctx.fillStyle = COLORS.xp;
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.xp;
    ctx.fillText(player.combo + ' HIT COMBO', canvasW / 2, 50);
    ctx.restore();
  }

  // Cooldown indicators (bottom right)
  drawCooldownSlots(ctx, canvasW, canvasH, player);

  ctx.textAlign = 'left';
}

function drawBar(ctx, x, y, w, h, val, max, color, label) {
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, w, h);
  // Fill
  const pct = Math.max(0, val / max);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * pct, h);
  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  // Label
  ctx.font = 'bold 10px Rajdhani, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y + h - 3);
  // Value
  ctx.textAlign = 'right';
  ctx.fillText(Math.floor(val) + '/' + Math.floor(max), x + w - 4, y + h - 3);
}

function drawCooldownSlots(ctx, cw, ch, player) {
  const slots = [
    { key: 'Z', label: 'Light', cd: player.lightCD, maxCd: CONFIG.LIGHT_CD },
    { key: 'X', label: 'Heavy', cd: player.heavyCD, maxCd: CONFIG.HEAVY_CD },
    { key: 'C', label: 'Shadow', cd: player.shadowCD, maxCd: CONFIG.SHADOW_CD },
    { key: '⇧', label: 'Dash', cd: player.dashCD, maxCd: CONFIG.DASH_COOLDOWN }
  ];
  const slotW = 44;
  const slotH = 44;
  const gap = 6;
  const totalW = slots.length * (slotW + gap) - gap;
  const sx = cw - 16 - totalW;
  const sy = ch - 16 - slotH;

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const x = sx + i * (slotW + gap);
    const ready = s.cd <= 0;

    ctx.fillStyle = ready ? 'rgba(148,0,211,0.2)' : 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = ready ? COLORS.shadow : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = ready ? 2 : 1;
    roundRect(ctx, x, sy, slotW, slotH, 4);
    ctx.fill();
    ctx.stroke();

    // Cooldown overlay
    if (!ready) {
      const pct = s.cd / s.maxCd;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, sy + slotH * (1 - pct), slotW, slotH * pct);
    }

    ctx.font = 'bold 16px Rajdhani, sans-serif';
    ctx.fillStyle = ready ? '#ffffff' : '#666666';
    ctx.textAlign = 'center';
    ctx.fillText(s.key, x + slotW / 2, sy + 20);
    ctx.font = '9px Rajdhani, sans-serif';
    ctx.fillStyle = ready ? COLORS.textDim : '#444444';
    ctx.fillText(s.label, x + slotW / 2, sy + 35);
  }
}

function drawBossBar(ctx, boss, canvasW) {
  if (!boss || !boss.alive) return;
  const barW = 400;
  const barH = 16;
  const x = canvasW / 2 - barW / 2;
  const y = 20;

  // Name
  ctx.font = 'bold 16px Rajdhani, sans-serif';
  ctx.fillStyle = boss.phase === 2 ? boss.phase2Color : COLORS.boss;
  ctx.textAlign = 'center';
  ctx.shadowBlur = 10;
  ctx.shadowColor = boss.phase === 2 ? boss.phase2Color : COLORS.boss;
  ctx.fillText(boss.name, canvasW / 2, y - 4);
  ctx.shadowBlur = 0;

  // Bar bg
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, barW, barH);
  // Fill
  const pct = boss.hp / boss.maxHp;
  ctx.fillStyle = boss.phase === 2 ? boss.phase2Color : COLORS.boss;
  ctx.fillRect(x, y, barW * pct, barH);
  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barW, barH);
  // HP text
  ctx.font = 'bold 10px Rajdhani, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(Math.floor(boss.hp) + ' / ' + boss.maxHp, canvasW / 2, y + barH - 3);

  ctx.textAlign = 'left';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
