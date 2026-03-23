// ═══════════════════ PLAYER ═══════════════════

class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 100;
    this.y = 300;
    this.vx = 0;
    this.vy = 0;
    this.w = CONFIG.PLAYER_WIDTH;
    this.h = CONFIG.PLAYER_HEIGHT;
    this.facing = 1; // 1 = right, -1 = left
    this.onGround = false;
    this.jumps = 0;
    this.maxJumps = 2;

    // Combat
    this.attacking = false;
    this.attackType = null;
    this.attackTimer = 0;
    this.attackDuration = 0;
    this.lightCD = 0;
    this.heavyCD = 0;
    this.shadowCD = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastHitTime = 0;

    // Dash
    this.dashing = false;
    this.dashTimer = 0;
    this.dashCD = 0;
    this.dashDir = 1;

    // I-frames
    this.invincible = false;
    this.iframeTimer = 0;

    // Animation
    this.animFrame = 0;
    this.animTimer = 0;
    this.hurtFlash = 0;
    this.shadowOrbAngle = 0;

    // Stats-derived
    this.recalcStats();
  }

  recalcStats() {
    const s = gameState.stats;
    this.maxHp = CONFIG.BASE_HP + s.VIT * 8;
    this.maxMp = CONFIG.BASE_MP + s.INT * 5;
    this.hp = Math.min(this.hp || this.maxHp, this.maxHp);
    this.mp = Math.min(this.mp || this.maxMp, this.maxMp);
    this.moveSpeed = CONFIG.BASE_MOVE_SPEED + s.AGI * 0.12;
    this.jumpForce = CONFIG.BASE_JUMP_FORCE - s.AGI * 0.05;
    this.lightDmg = CONFIG.BASE_LIGHT_DMG + s.STR * 2;
    this.heavyDmg = CONFIG.BASE_HEAVY_DMG + s.STR * 3.5;
    this.shadowDmg = CONFIG.BASE_SHADOW_DMG + s.INT * 4;
    this.critChance = 0.05 + s.PER * 0.01;
  }

  fullHeal() {
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }

  update(dt, keys, platforms, groundY) {
    // Cooldowns
    if (this.lightCD > 0) this.lightCD -= dt;
    if (this.heavyCD > 0) this.heavyCD -= dt;
    if (this.shadowCD > 0) this.shadowCD -= dt;
    if (this.dashCD > 0) this.dashCD -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // MP regen
    this.mp = Math.min(this.mp + CONFIG.MP_REGEN, this.maxMp);

    // I-frames
    if (this.invincible) {
      this.iframeTimer -= dt;
      if (this.iframeTimer <= 0) this.invincible = false;
    }

    // Dash
    if (this.dashing) {
      this.dashTimer -= dt;
      this.vx = this.dashDir * CONFIG.DASH_SPEED;
      this.vy = 0;
      if (this.dashTimer <= 0) this.dashing = false;
      particles.trailDash(this.x + this.w / 2, this.y + this.h / 2);
    } else {
      // Movement
      let moveX = 0;
      if (keys['ArrowLeft'] || keys['KeyA']) { moveX = -1; this.facing = -1; }
      if (keys['ArrowRight'] || keys['KeyD']) { moveX = 1; this.facing = 1; }
      this.vx = moveX * this.moveSpeed;

      // Gravity
      this.vy += CONFIG.GRAVITY;
      if (this.vy > CONFIG.MAX_FALL) this.vy = CONFIG.MAX_FALL;
    }

    // Attack timer
    if (this.attacking) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this.attacking = false;
    }

    // Animation
    this.animTimer += dt;
    if (this.animTimer > 0.12) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }
    this.shadowOrbAngle += dt * 2;

    // Apply velocity
    this.x += this.vx;
    this.y += this.vy;

    // Platform collision
    this.onGround = false;
    for (const p of platforms) {
      if (this.x + this.w > p.x && this.x < p.x + p.w) {
        // Landing on top
        if (this.vy >= 0 &&
            this.y + this.h >= p.y &&
            this.y + this.h <= p.y + p.h + this.vy + 6) {
          if (p.type === 'passthrough' && keys['ArrowDown']) continue;
          this.y = p.y - this.h;
          this.vy = 0;
          this.onGround = true;
          this.jumps = 0;
        }
        // Side collision for solid platforms
        if (p.type === 'solid' && this.y + this.h > p.y + 4) {
          if (this.vx > 0 && this.x + this.w > p.x && this.x < p.x) {
            this.x = p.x - this.w;
          }
          if (this.vx < 0 && this.x < p.x + p.w && this.x + this.w > p.x + p.w) {
            this.x = p.x + p.w;
          }
        }
      }
    }

    // World bounds
    if (this.x < 0) this.x = 0;
    if (this.y + this.h > groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
      this.jumps = 0;
    }

    // Shadow aura
    particles.shadowAura(this.x + this.w / 2, this.y + this.h / 2);
  }

  jump() {
    if (this.jumps < this.maxJumps) {
      this.vy = this.jumpForce;
      this.jumps++;
      particles.shadowBurst(this.x + this.w / 2, this.y + this.h, 6);
    }
  }

  dash() {
    if (this.dashCD > 0 || this.dashing) return;
    this.dashing = true;
    this.dashTimer = CONFIG.DASH_DURATION;
    this.dashCD = CONFIG.DASH_COOLDOWN;
    this.dashDir = this.facing;
    this.invincible = true;
    this.iframeTimer = CONFIG.IFRAME_DURATION;
    particles.shadowBurst(this.x + this.w / 2, this.y + this.h / 2, 12);
  }

  lightAttack() {
    if (this.lightCD > 0 || this.attacking) return;
    this.attacking = true;
    this.attackType = 'light';
    this.attackTimer = 0.2;
    this.attackDuration = 0.2;
    this.lightCD = CONFIG.LIGHT_CD;
    return this._getAttackHitbox(40, this.lightDmg);
  }

  heavyAttack() {
    if (this.heavyCD > 0 || this.attacking) return;
    this.attacking = true;
    this.attackType = 'heavy';
    this.attackTimer = 0.35;
    this.attackDuration = 0.35;
    this.heavyCD = CONFIG.HEAVY_CD;
    return this._getAttackHitbox(55, this.heavyDmg);
  }

  shadowStrike() {
    if (this.shadowCD > 0 || this.attacking || this.mp < CONFIG.SHADOW_MP_COST) return;
    this.mp -= CONFIG.SHADOW_MP_COST;
    this.attacking = true;
    this.attackType = 'shadow';
    this.attackTimer = 0.4;
    this.attackDuration = 0.4;
    this.shadowCD = CONFIG.SHADOW_CD;
    particles.shadowBurst(this.x + this.w / 2, this.y + this.h / 2, 25);
    return this._getAttackHitbox(70, this.shadowDmg);
  }

  _getAttackHitbox(range, baseDmg) {
    const isCrit = Math.random() < this.critChance;
    const dmg = Math.floor(baseDmg * (isCrit ? 2 : 1) * (1 + this.combo * 0.1));
    return {
      x: this.facing === 1 ? this.x + this.w : this.x - range,
      y: this.y - 5,
      w: range,
      h: this.h + 10,
      damage: dmg,
      crit: isCrit,
      type: this.attackType
    };
  }

  takeDamage(dmg) {
    if (this.invincible) return false;
    this.hp -= dmg;
    this.hurtFlash = 0.2;
    this.invincible = true;
    this.iframeTimer = 0.5;
    screenShake(6);
    particles.hitSparks(this.x + this.w / 2, this.y + this.h / 2, '#ff4444');
    if (this.hp <= 0) {
      this.hp = 0;
      return true; // dead
    }
    return false;
  }

  registerHit() {
    this.combo++;
    this.comboTimer = CONFIG.COMBO_TIMEOUT;
    this.lastHitTime = performance.now();
  }

  draw(ctx, camX) {
    const sx = this.x - camX;
    const sy = this.y;
    const cx = sx + this.w / 2;
    const cy = sy + this.h / 2;

    // Skip frames for invincibility blink
    if (this.invincible && Math.floor(performance.now() / 80) % 2 === 0) return;

    ctx.save();
    ctx.translate(cx, cy);
    if (this.facing === -1) ctx.scale(-1, 1);

    // Hurt flash
    if (this.hurtFlash > 0) {
      ctx.globalAlpha = 0.6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff0000';
    }

    // Shadow aura glow
    ctx.save();
    const auraGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 35);
    auraGrad.addColorStop(0, 'rgba(148,0,211,0.15)');
    auraGrad.addColorStop(1, 'rgba(148,0,211,0)');
    ctx.fillStyle = auraGrad;
    ctx.fillRect(-40, -35, 80, 70);
    ctx.restore();

    // Shadow orbs orbiting
    for (let i = 0; i < 3; i++) {
      const angle = this.shadowOrbAngle + (i * Math.PI * 2 / 3);
      const ox = Math.cos(angle) * 22;
      const oy = Math.sin(angle) * 10 - 5;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = COLORS.shadow;
      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath();
      ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Legs
    const legBob = this.vx !== 0 ? Math.sin(this.animTimer * 50) * 4 : 0;
    ctx.fillStyle = '#110820';
    ctx.fillRect(-8, 8, 6, 18 + legBob);
    ctx.fillRect(2, 8, 6, 18 - legBob);

    // Body
    ctx.fillStyle = '#0d0515';
    ctx.fillRect(-12, -16, 24, 26);

    // Shoulder plates
    ctx.fillStyle = '#1a0a2e';
    ctx.fillRect(-14, -14, 6, 8);
    ctx.fillRect(8, -14, 6, 8);

    // Head
    ctx.fillStyle = '#110820';
    ctx.beginPath();
    ctx.arc(0, -24, 11, 0, Math.PI * 2);
    ctx.fill();

    // Eyes - glowing purple
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = COLORS.shadow;
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(-4, -25, 2.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -25, 2.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye glow core
    ctx.fillStyle = COLORS.purpleLight;
    ctx.beginPath();
    ctx.ellipse(-4, -25, 1, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -25, 1, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sword in hand
    if (!this.attacking) {
      ctx.strokeStyle = 'rgba(200,200,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, -8);
      ctx.lineTo(12, 10);
      ctx.stroke();
    }

    // Attack slash effect
    if (this.attacking) {
      const progress = 1 - this.attackTimer / this.attackDuration;
      ctx.save();
      if (this.attackType === 'shadow') {
        ctx.strokeStyle = COLORS.shadow;
        ctx.shadowBlur = 25;
        ctx.shadowColor = COLORS.shadow;
        ctx.lineWidth = 5;
      } else if (this.attackType === 'heavy') {
        ctx.strokeStyle = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = 'rgba(200,200,255,0.8)';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(200,200,255,0.5)';
        ctx.lineWidth = 3;
      }
      ctx.globalAlpha = 1 - progress;
      const slashAngle = -Math.PI / 2 + progress * Math.PI * 1.2;
      const slashLen = this.attackType === 'shadow' ? 45 : (this.attackType === 'heavy' ? 38 : 30);
      ctx.beginPath();
      ctx.arc(8, -5, slashLen, slashAngle - 0.8, slashAngle + 0.1);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}
