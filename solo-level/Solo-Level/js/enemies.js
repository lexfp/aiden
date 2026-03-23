// ═══════════════════ ENEMIES & BOSSES ═══════════════════

class Enemy {
  constructor(x, y, type, scaleFactor) {
    const def = ENEMY_DEFS[type];
    this.x = x;
    this.y = y;
    this.type = type;
    this.w = def.w;
    this.h = def.h;
    this.hp = Math.floor(def.hp * scaleFactor);
    this.maxHp = this.hp;
    this.dmg = Math.floor(def.dmg * scaleFactor);
    this.speed = def.speed;
    this.xp = Math.floor(def.xp * scaleFactor);
    this.color = def.color;
    this.eyeColor = def.eyeColor;
    this.aggroRange = def.aggroRange;
    this.attackRange = def.attackRange;
    this.attackCD = def.attackCD;
    this.ranged = def.ranged || false;
    this.projSpeed = def.projSpeed || 0;

    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.alive = true;
    this.attackTimer = 0;
    this.hurtFlash = 0;
    this.animTimer = 0;
    this.state = 'patrol'; // patrol, aggro, attack, dead
    this.patrolDir = Math.random() > 0.5 ? 1 : -1;
    this.patrolTimer = 2 + Math.random() * 3;
    this.spawnX = x;
    this.onGround = false;
  }

  update(dt, playerX, playerY, platforms, groundY) {
    if (!this.alive) return;

    this.attackTimer -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    this.animTimer += dt;

    // Gravity
    this.vy += CONFIG.GRAVITY;
    if (this.vy > CONFIG.MAX_FALL) this.vy = CONFIG.MAX_FALL;

    const dist = Math.abs(playerX - this.x);
    const dy = Math.abs(playerY - this.y);

    // State machine
    if (dist < this.aggroRange && dy < 150) {
      this.state = 'aggro';
      this.facing = playerX < this.x ? -1 : 1;

      if (dist < this.attackRange && this.attackTimer <= 0) {
        this.state = 'attack';
      } else if (dist >= this.attackRange) {
        this.vx = this.facing * this.speed;
      } else {
        this.vx = 0;
      }
    } else {
      this.state = 'patrol';
      this.patrolTimer -= dt;
      if (this.patrolTimer <= 0) {
        this.patrolDir *= -1;
        this.patrolTimer = 2 + Math.random() * 3;
      }
      this.vx = this.patrolDir * this.speed * 0.4;
      this.facing = this.patrolDir;
      // Don't wander too far
      if (Math.abs(this.x - this.spawnX) > 200) {
        this.patrolDir = this.x > this.spawnX ? -1 : 1;
      }
    }

    this.x += this.vx;
    this.y += this.vy;

    // Platform collision
    this.onGround = false;
    for (const p of platforms) {
      if (this.x + this.w > p.x && this.x < p.x + p.w &&
          this.vy >= 0 &&
          this.y + this.h >= p.y && this.y + this.h <= p.y + p.h + this.vy + 6) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    }
    if (this.y + this.h > groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    }
  }

  getAttackHitbox() {
    if (this.state !== 'attack' || this.attackTimer > 0) return null;
    this.attackTimer = this.attackCD;
    if (this.ranged) {
      return { type: 'projectile', x: this.x + this.w / 2, y: this.y + this.h / 2, dir: this.facing, speed: this.projSpeed, dmg: this.dmg };
    }
    return {
      type: 'melee',
      x: this.facing === 1 ? this.x + this.w : this.x - this.attackRange,
      y: this.y,
      w: this.attackRange,
      h: this.h,
      dmg: this.dmg
    };
  }

  takeDamage(dmg, fromX) {
    this.hp -= dmg;
    this.hurtFlash = 0.15;
    this.vx = fromX < this.x ? 3 : -3;
    this.vy = -2;
    if (this.hp <= 0) {
      this.alive = false;
      particles.deathExplosion(this.x + this.w / 2, this.y + this.h / 2, this.color);
      return true;
    }
    particles.hitSparks(this.x + this.w / 2, this.y + this.h / 2, this.eyeColor);
    return false;
  }

  draw(ctx, camX) {
    if (!this.alive) return;
    const sx = this.x - camX;
    if (sx + this.w < -50 || sx > ctx.canvas.width + 50) return;

    const cx = sx + this.w / 2;
    const cy = this.y + this.h / 2;

    ctx.save();
    if (this.hurtFlash > 0) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffffff';
    }

    ctx.translate(cx, cy);
    if (this.facing === -1) ctx.scale(-1, 1);

    // Body
    ctx.fillStyle = this.hurtFlash > 0 ? '#ffffff' : this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

    // Eyes
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.eyeColor;
    ctx.fillStyle = this.eyeColor;
    ctx.beginPath();
    ctx.arc(-4, -this.h / 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, -this.h / 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // HP bar
    if (this.hp < this.maxHp) {
      const barW = 30;
      const barH = 4;
      const bx = sx + this.w / 2 - barW / 2;
      const by = this.y - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = COLORS.boss;
      ctx.fillRect(bx, by, barW * (this.hp / this.maxHp), barH);
    }
  }
}

// ═══════════════════ BOSS ═══════════════════

class Boss {
  constructor(x, y, type, scaleFactor) {
    const def = BOSS_DEFS[type];
    this.x = x;
    this.y = y;
    this.type = type;
    this.w = def.w;
    this.h = def.h;
    this.hp = Math.floor(def.hp * scaleFactor);
    this.maxHp = this.hp;
    this.dmg = Math.floor(def.dmg * scaleFactor);
    this.speed = def.speed;
    this.xp = Math.floor(def.xp * scaleFactor);
    this.color = def.color;
    this.eyeColor = def.eyeColor;
    this.name = def.name;
    this.attackRange = def.attackRange;
    this.attackCD = def.attackCD;
    this.phase2Color = def.phase2Color;

    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.alive = true;
    this.phase = 1;
    this.attackTimer = 1.5; // Initial delay
    this.hurtFlash = 0;
    this.animTimer = 0;
    this.specialTimer = 3;
    this.introTimer = 2.0;
    this.deathTimer = 0;
    this.dying = false;
    this.onGround = false;
    this.pulseAngle = 0;
  }

  update(dt, playerX, playerY, platforms, groundY) {
    if (this.dying) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.alive = false;
      }
      return;
    }

    if (this.introTimer > 0) {
      this.introTimer -= dt;
      return;
    }

    this.attackTimer -= dt;
    this.specialTimer -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    this.animTimer += dt;
    this.pulseAngle += dt * 3;

    // Phase 2 at 50% HP
    if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.speed *= 1.4;
      this.attackCD *= 0.7;
      screenShake(15);
      particles.bossDeathExplosion(this.x + this.w / 2, this.y + this.h / 2);
      systemNotify('The boss is enraged!', COLORS.boss);
    }

    // Gravity
    this.vy += CONFIG.GRAVITY;
    if (this.vy > CONFIG.MAX_FALL) this.vy = CONFIG.MAX_FALL;

    // AI
    this.facing = playerX < this.x ? -1 : 1;
    const dist = Math.abs(playerX - this.x);

    if (dist > this.attackRange) {
      this.vx = this.facing * this.speed;
    } else {
      this.vx = 0;
    }

    // Special attack: jump slam
    if (this.specialTimer <= 0 && this.onGround) {
      this.vy = -14;
      this.vx = this.facing * 5;
      this.specialTimer = this.phase === 2 ? 3 : 5;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Platform collision
    this.onGround = false;
    for (const p of platforms) {
      if (p.type !== 'solid') continue;
      if (this.x + this.w > p.x && this.x < p.x + p.w &&
          this.vy >= 0 &&
          this.y + this.h >= p.y && this.y + this.h <= p.y + p.h + this.vy + 6) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    }
    if (this.y + this.h > groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    }
  }

  getAttackHitbox() {
    if (this.dying || this.introTimer > 0) return null;
    if (this.attackTimer > 0) return null;
    this.attackTimer = this.attackCD;
    return {
      type: 'melee',
      x: this.facing === 1 ? this.x + this.w : this.x - this.attackRange,
      y: this.y - 10,
      w: this.attackRange,
      h: this.h + 20,
      dmg: this.dmg * (this.phase === 2 ? 1.3 : 1)
    };
  }

  takeDamage(dmg, fromX) {
    if (this.dying) return false;
    this.hp -= dmg;
    this.hurtFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying = true;
      this.deathTimer = 1.5;
      particles.bossDeathExplosion(this.x + this.w / 2, this.y + this.h / 2);
      screenShake(20);
      return true;
    }
    particles.hitSparks(this.x + this.w / 2, this.y + this.h / 2, this.eyeColor);
    screenShake(4);
    return false;
  }

  draw(ctx, camX) {
    const sx = this.x - camX;
    const cx = sx + this.w / 2;
    const cy = this.y + this.h / 2;

    if (this.dying) {
      // Death animation: flash and particle burst
      ctx.save();
      ctx.globalAlpha = this.deathTimer / 1.5;
      ctx.translate(cx, cy);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 40;
      ctx.shadowColor = this.eyeColor;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
      if (Math.random() > 0.5) {
        particles.hitSparks(this.x + Math.random() * this.w, this.y + Math.random() * this.h, this.eyeColor);
      }
      return;
    }

    ctx.save();
    ctx.translate(cx, cy);
    if (this.facing === -1) ctx.scale(-1, 1);

    // Aura glow
    const auraColor = this.phase === 2 ? this.phase2Color : this.eyeColor;
    const pulse = 0.4 + Math.sin(this.pulseAngle) * 0.2;
    ctx.save();
    const auraGrad = ctx.createRadialGradient(0, 0, this.w * 0.3, 0, 0, this.w);
    auraGrad.addColorStop(0, auraColor + '40');
    auraGrad.addColorStop(1, auraColor + '00');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = auraGrad;
    ctx.fillRect(-this.w, -this.h, this.w * 2, this.h * 2);
    ctx.restore();

    // Body
    const bodyColor = this.hurtFlash > 0 ? '#ffffff' : (this.phase === 2 ? this.phase2Color : this.color);
    ctx.fillStyle = bodyColor;
    if (this.hurtFlash > 0) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ffffff';
    }
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

    // Crown/horns
    ctx.fillStyle = this.phase === 2 ? this.phase2Color : this.eyeColor;
    ctx.beginPath();
    ctx.moveTo(-8, -this.h / 2);
    ctx.lineTo(-4, -this.h / 2 - 14);
    ctx.lineTo(0, -this.h / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -this.h / 2);
    ctx.lineTo(4, -this.h / 2 - 14);
    ctx.lineTo(8, -this.h / 2);
    ctx.fill();

    // Eyes
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.eyeColor;
    ctx.fillStyle = this.eyeColor;
    ctx.beginPath();
    ctx.ellipse(-8, -this.h / 4, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -this.h / 4, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}

// ═══════════════════ PROJECTILE ═══════════════════

class Projectile {
  constructor(x, y, dir, speed, dmg, color) {
    this.x = x;
    this.y = y;
    this.vx = dir * speed;
    this.w = 8;
    this.h = 4;
    this.dmg = dmg;
    this.color = color || '#ff4444';
    this.alive = true;
    this.life = 3;
  }
  update(dt) {
    this.x += this.vx;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx, camX) {
    if (!this.alive) return;
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - camX, this.y, this.w, this.h);
    ctx.restore();
  }
  hits(target) {
    return this.x < target.x + target.w && this.x + this.w > target.x &&
           this.y < target.y + target.h && this.y + this.h > target.y;
  }
}
