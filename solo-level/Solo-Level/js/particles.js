// ═══════════════════ PARTICLE SYSTEM ═══════════════════

class Particle {
  constructor(x, y, vx, vy, life, size, color, alpha, shrink, gravity) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size; this.color = color;
    this.alpha = alpha || 1;
    this.shrink = shrink !== undefined ? shrink : true;
    this.gravity = gravity || 0;
    this.alive = true;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.alive = false; return; }
    this.vx *= 0.98;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    if (this.shrink) {
      this.size *= 0.97;
    }
  }
  draw(ctx, camX) {
    if (!this.alive) return;
    const progress = this.life / this.maxLife;
    const a = this.alpha * progress;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = this.size * 2;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camX, this.y, Math.max(this.size, 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }
  add(p) { this.particles.push(p); }
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (!this.particles[i].alive) this.particles.splice(i, 1);
    }
  }
  draw(ctx, camX) {
    for (const p of this.particles) p.draw(ctx, camX);
  }
  clear() { this.particles = []; }

  // ── Presets ──
  shadowBurst(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.add(new Particle(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        0.4 + Math.random() * 0.6,
        2 + Math.random() * 4,
        Math.random() > 0.5 ? COLORS.shadow : COLORS.purpleLight,
        0.9, true, 0.05
      ));
    }
  }
  hitSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      this.add(new Particle(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        0.2 + Math.random() * 0.3,
        1 + Math.random() * 3,
        color || '#ffffff',
        1, true, 0.1
      ));
    }
  }
  deathExplosion(x, y, color) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 6;
      this.add(new Particle(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        0.5 + Math.random() * 1.0,
        2 + Math.random() * 6,
        color,
        1, true, 0.15
      ));
    }
  }
  levelUpBurst(x, y) {
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      this.add(new Particle(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed - 2,
        0.6 + Math.random() * 1.2,
        2 + Math.random() * 5,
        [COLORS.xp, COLORS.shadow, COLORS.purpleLight, '#ffffff'][Math.floor(Math.random() * 4)],
        1, true, 0.08
      ));
    }
  }
  shadowAura(x, y) {
    if (Math.random() > 0.3) return;
    this.add(new Particle(
      x + (Math.random() - 0.5) * 30,
      y + (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 0.5,
      -0.5 - Math.random() * 1.5,
      0.3 + Math.random() * 0.5,
      1 + Math.random() * 3,
      Math.random() > 0.6 ? COLORS.shadow : COLORS.purpleDark,
      0.5, true, 0
    ));
  }
  trailDash(x, y) {
    for (let i = 0; i < 4; i++) {
      this.add(new Particle(
        x + (Math.random() - 0.5) * 10,
        y + (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 1,
        0.15 + Math.random() * 0.2,
        3 + Math.random() * 5,
        COLORS.shadow,
        0.7, true, 0
      ));
    }
  }
  bossDeathExplosion(x, y) {
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 10;
      const colors = [COLORS.shadow, COLORS.purpleLight, COLORS.boss, '#ffffff', COLORS.xp];
      this.add(new Particle(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        0.8 + Math.random() * 1.5,
        3 + Math.random() * 8,
        colors[Math.floor(Math.random() * colors.length)],
        1, true, 0.1
      ));
    }
  }
  ambientDust(canvasW, canvasH, camX) {
    if (Math.random() > 0.15) return;
    this.add(new Particle(
      camX + Math.random() * canvasW,
      Math.random() * canvasH,
      (Math.random() - 0.5) * 0.3,
      -0.1 - Math.random() * 0.3,
      2 + Math.random() * 3,
      0.5 + Math.random() * 1.5,
      COLORS.shadow,
      0.15, false, 0
    ));
  }
}
