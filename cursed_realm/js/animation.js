// ═══════ ANIMATION STATE ═══════
const anim = {
  // Smoothed values
  walkCycle: 0, walkSpeed: 0,      // 0→1 phase
  bodyBob: 0,                     // vertical bob
  hipSway: 0,                     // side lean
  torsoPitch: 0,                  // forward lean
  torsoRoll: 0,                   // side tilt
  headBob: 0,
  // Attack state
  atkPhase: 0, atkArm: 0,
  atkKick: false,
  // Jump state
  jumpSquash: 0,                  // squash on land
  airTilt: 0,                     // lean forward in air
  // Dash lean
  dashLean: 0,
  // Breathing
  breathPhase: 0,
  // Target values for lerp
  tWalkSpeed: 0, tHipSway: 0, tTorsoPitch: 0, tTorsoRoll: 0,
};

// Extra named bones we'll add to the model
let torsoRef = null, headRef = null, hipsRef = null;

function updatePlayer(dt) {
  const inSafe = isInSafeZone(player.group.position.x, player.group.position.z);
  // Safe zone regen
  if (inSafe) {
    player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.008 * dt);
    player.energy = Math.min(player.maxEnergy, player.energy + player.maxEnergy * 0.05 * dt);
  }
  player.inSafeZone = inSafe;
  // Zone UI
  const zn = getCurrentZone(player.group.position.x, player.group.position.z);
  const zb = document.getElementById('zone-banner'); zb.textContent = zn;
  if (inSafe) { zb.classList.add('safe'); document.getElementById('safe-indicator').classList.add('show'); }
  else { zb.classList.remove('safe'); document.getElementById('safe-indicator').classList.remove('show'); }

  player.energy = Math.min(player.maxEnergy, player.energy + player.energyRegen * dt);
  if (player.lightAttackCD > 0) player.lightAttackCD -= dt; if (player.heavyAttackCD > 0) player.heavyAttackCD -= dt;
  if (player.dashCooldown > 0) player.dashCooldown -= dt; if (player.attackTimer > 0) player.attackTimer -= dt;
  if (player.attackTimer <= 0) player.isAttacking = false;
  if (player.invincibleTimer > 0) { player.invincibleTimer -= dt; if (player.invincibleTimer <= 0) player.invincible = false; }
  if (player.hitFlashTimer > 0) player.hitFlashTimer -= dt;
  if (player.hitStaggerTimer > 0) { player.hitStaggerTimer -= dt;/* stagger anim handled in animPlayerModel */ }
  for (let i = 0; i < techMoveCDs.length; i++)if (techMoveCDs[i] > 0) techMoveCDs[i] -= dt;
  if (player.comboTimer > 0) { player.comboTimer -= dt; if (player.comboTimer <= 0) { player.comboCount = 0; updateComboUI(); } }
  if (player.isDashing) { player.dashTimer -= dt; if (player.dashTimer <= 0) player.isDashing = false; else { player.group.position.addScaledVector(player.dashDirection, player.dashSpeed * dt); return; } }

  const mv = new THREE.Vector3();
  const fw = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const rt = new THREE.Vector3(-fw.z, 0, fw.x);
  if (keys['KeyW']) mv.add(fw); if (keys['KeyS']) mv.sub(fw); if (keys['KeyA']) mv.sub(rt); if (keys['KeyD']) mv.add(rt);
  if (mv.lengthSq() > 0) {
    mv.normalize();
    player.group.position.addScaledVector(mv, (player.isAttacking ? player.speed * 0.3 : player.speed) * dt);
    const ta = Math.atan2(-mv.x, -mv.z); let diff = ta - player.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    player.group.rotation.y += diff * 10 * dt;
  }
  if (keys['Space'] && player.grounded) { player.velocity.y = player.jumpForce; player.grounded = false; }
  if (keys['ShiftLeft'] && player.dashCooldown <= 0 && !player.isDashing) {
    player.isDashing = true; player.dashTimer = player.dashDuration; player.dashCooldown = player.dashCooldownMax;
    player.invincible = true; player.invincibleTimer = player.dashDuration;
    player.dashDirection.copy(mv.lengthSq() > 0 ? mv : new THREE.Vector3(-Math.sin(player.group.rotation.y), 0, -Math.cos(player.group.rotation.y)));
    player.dashDirection.normalize(); spawnDashTrail(player.group.position.clone());
  }
  if (!player.grounded) player.velocity.y -= 35 * dt;
  player.group.position.y += player.velocity.y * dt;
  const isl = isOnIsland(player.group.position.x, player.group.position.z);
  if (isl && player.group.position.y <= 0.05 && player.velocity.y <= 0) { player.group.position.y = 0; player.velocity.y = 0; player.grounded = true; }
  if (player.group.position.y < -20) respawnPlayer();

  animPlayerModel(dt);

  // Hit flash on all meshes
  player.group.traverse(c => {
    if (!c.isMesh || !c.material?.emissive) return;
    if (player.hitFlashTimer > 0) { c.material.emissive.setHex(0xff2244); c.material.emissiveIntensity = player.hitFlashTimer * 6; }
    else c.material.emissiveIntensity = 0;
  });

  // Landing squash trigger
  if (player.grounded && player.velocity.y < -5) {
    anim.jumpSquash = Math.min(0.9, Math.abs(player.velocity.y) * 0.04);
  }
}
function lerpA(a, b, t) { return a + (b - a) * t; }
function sineEase(t) { return 0.5 - 0.5 * Math.cos(t * Math.PI); }

function animPlayerModel(dt) {
  const g = player.group;
  const hips = g.getObjectByName('hips');
  const torso = g.getObjectByName('torso');
  const head = g.getObjectByName('head');
  const lAP = g.getObjectByName('leftArmPivot');
  const rAP = g.getObjectByName('rightArmPivot');
  const lEP = g.getObjectByName('leftArmElbow');
  const rEP = g.getObjectByName('rightArmElbow');
  const lLP = g.getObjectByName('leftLegPivot');
  const rLP = g.getObjectByName('rightLegPivot');
  const lKP = g.getObjectByName('leftLegKnee');
  const rKP = g.getObjectByName('rightLegKnee');
  const aura = g.getObjectByName('aura');
  const auraCore = g.getObjectByName('auraCore');
  if (!hips || !torso) return;

  const moving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];
  const inAir = !player.grounded;
  const dashing = player.isDashing;

  // ── walk speed & phase ──
  anim.tWalkSpeed = moving ? (dashing ? 1.8 : 1.0) : 0;
  anim.walkSpeed = lerpA(anim.walkSpeed, anim.tWalkSpeed, 12 * dt);
  anim.walkCycle += anim.walkSpeed * 8 * dt;
  anim.breathPhase += dt * 1.2;

  const wc = anim.walkCycle;
  const spd = anim.walkSpeed;
  const breath = Math.sin(anim.breathPhase) * 0.012;

  // ── Gait phase helpers (dual-sine for natural foot timing) ──
  const sinW = Math.sin(wc);
  const cosW = Math.cos(wc);
  const sin2W = Math.sin(wc * 2);           // double-frequency for bob (2 bobs per stride)
  const cosHW = Math.cos(wc * 0.5);         // half-frequency for subtle sway
  // Asymmetric leg curves: sharper lift, slower plant
  const lLegSwing = Math.sin(wc);         // left leg: forward when positive
  const rLegSwing = Math.sin(wc + Math.PI); // right leg: opposite phase
  const lLegLift = Math.max(0, Math.sin(wc));          // left foot off ground
  const rLegLift = Math.max(0, Math.sin(wc + Math.PI));  // right foot off ground
  // Push-off emphasis (foot pushes back harder)
  const lPush = Math.max(0, -Math.sin(wc));
  const rPush = Math.max(0, Math.sin(wc));

  // ── Running vs walking multipliers ──
  const isRunning = spd > 1.2;
  const walkLerp = Math.min(spd, 1.0);         // 0..1 for walk blend
  const runLerp = Math.max(0, spd - 1.0) * 1.25; // 0..1 for run blend
  const gaitMult = walkLerp + runLerp * 0.6;    // overall motion intensity

  // ── Hips: double-frequency bob + lateral weight shift ──
  const hipBob = -Math.abs(sin2W) * 0.06 * gaitMult;   // dip at each foot strike
  const hipLateral = cosW * 0.04 * gaitMult;                // shift over planted foot
  const hipDrop = sinW * 0.025 * gaitMult;               // pelvis drop on swing side
  hips.position.y = 1.1 + hipBob - (inAir ? 0.05 : 0) + breath;
  hips.position.x = lerpA(hips.position.x || 0, hipLateral, 12 * dt);
  hips.rotation.z = lerpA(hips.rotation.z, hipDrop + cosW * 0.04 * gaitMult, 10 * dt);
  hips.rotation.y = lerpA(hips.rotation.y, sinW * 0.08 * gaitMult, 10 * dt); // counter-rotation

  // ── Torso: counter-rotate against hips, forward lean ──
  const torsoYaw = -sinW * 0.12 * gaitMult;  // upper body counters hip rotation
  const fwdLean = dashing ? 0.32 : (moving ? (0.06 + runLerp * 0.1) : 0);
  const torsoSideRoll = -cosW * 0.06 * gaitMult; // counter the hip drop
  anim.tTorsoPitch = fwdLean;
  anim.tTorsoRoll = torsoSideRoll;
  anim.torsoPitch = lerpA(anim.torsoPitch, anim.tTorsoPitch, 9 * dt);
  anim.torsoRoll = lerpA(anim.torsoRoll, anim.tTorsoRoll, 9 * dt);
  torso.rotation.x = anim.torsoPitch;
  torso.rotation.z = anim.torsoRoll;
  torso.rotation.y = lerpA(torso.rotation.y, torsoYaw, 10 * dt);
  // Breathing expansion
  torso.scale.x = 1 + breath * 0.5;
  torso.scale.z = 1 + breath * 0.8;

  // ── Jump squash/stretch ──
  anim.jumpSquash = lerpA(anim.jumpSquash, 0, 8 * dt);
  if (inAir) {
    const airRise = player.velocity.y > 0;
    g.scale.set(1 - 0.08 * (airRise ? 1 : 0), 1 + 0.12 * (airRise ? 1 : 0), 1 - 0.08 * (airRise ? 1 : 0));
  } else {
    const sq = anim.jumpSquash;
    g.scale.set(1 + sq * 0.18, 1 - sq * 0.22, 1 + sq * 0.18);
  }
  if (anim.jumpSquash === 0 && !inAir) g.scale.set(1, 1, 1);

  // ── HIT STAGGER ANIMATION ──
  if (player.hitStaggerTimer > 0) {
    const stag = player.hitStaggerTimer / 0.3;
    const recoil = Math.sin(stag * Math.PI) * 0.4;
    torso.rotation.x = -recoil * 0.35; // reel backward
    torso.rotation.z = (Math.random() - 0.5) * recoil * 0.15; // wobble
    hips.position.y = 1.1 - recoil * 0.08; // sink
    if (lAP) { lAP.rotation.x = recoil * 0.5; lAP.rotation.z = recoil * 0.3; }
    if (rAP) { rAP.rotation.x = recoil * 0.5; rAP.rotation.z = -recoil * 0.3; }
    if (head) { head.rotation.x = -recoil * 0.2; head.rotation.z = (Math.random() - 0.5) * recoil * 0.1; }
    return; // override other animations during stagger
  }

  // ── UNIQUE ATTACK ANIMATIONS PER MOVE TYPE ──
  if (player.isAttacking) {
    const tp = Math.max(0, player.attackTimer);
    const atkType = player.currentAttackType || 'light';

    if (atkType === 'light') {
      // Fast punch combo - alternating arms with quick snaps
      const dur = 0.25;
      const t = Math.max(0, 1 - (tp / dur));
      const sw = Math.sin(t * Math.PI);
      const hit = player.currentComboHit || 1;
      const isRight = hit % 2 === 1;
      const isKick = hit % 3 === 0; // every 3rd hit is a kick

      if (isKick) {
        // Kick animation
        if (lLP) { lLP.rotation.x = -sw * 1.4; }
        if (lKP) { lKP.rotation.x = sw * 0.8; }
        torso.rotation.x = -sw * 0.15;
        hips.rotation.y = sw * 0.2;
        if (lAP) { lAP.rotation.x = sw * 0.3; lAP.rotation.z = sw * 0.2; }
        if (rAP) { rAP.rotation.x = -sw * 0.3; rAP.rotation.z = -sw * 0.2; }
      } else if (isRight) {
        // Right punch - fast jab
        if (rAP) { rAP.rotation.x = -sw * 1.8; rAP.rotation.z = -sw * 0.3; }
        if (rEP) { rEP.rotation.x = -sw * 0.6; }
        if (lAP) { lAP.rotation.x = sw * 0.35; lAP.rotation.z = sw * 0.12; }
        torso.rotation.y = sw * 0.25;
        hips.rotation.y = -sw * 0.1;
      } else {
        // Left hook - wider swing
        if (lAP) { lAP.rotation.x = -sw * 1.5; lAP.rotation.z = sw * 0.5; lAP.rotation.y = -sw * 0.4; }
        if (lEP) { lEP.rotation.x = -sw * 0.7; }
        if (rAP) { rAP.rotation.x = sw * 0.3; rAP.rotation.z = -sw * 0.1; }
        torso.rotation.y = -sw * 0.3;
        hips.rotation.y = sw * 0.12;
      }
      // Glowing knuckle on active hand
      const kn = g.getObjectByName((isRight ? 'right' : 'left') + 'Knuckle');
      if (kn) { kn.material.opacity = sw * 0.6; }

    } else if (atkType === 'heavy') {
      // Heavy attack - wind up then slam with body twist
      const dur = 0.5;
      const t = Math.max(0, 1 - (tp / dur));
      let sw;
      if (t < 0.4) {
        // Wind up phase - lean back, raise arm
        sw = t / 0.4;
        torso.rotation.x = -sw * 0.3; // lean back
        torso.rotation.y = -sw * 0.4; // twist
        if (rAP) { rAP.rotation.x = sw * 0.8; rAP.rotation.z = -sw * 0.5; } // arm raised
        if (rEP) { rEP.rotation.x = -sw * 0.9; } // elbow cocked
        if (lAP) { lAP.rotation.x = -sw * 0.2; }
        hips.position.y = 1.1 - sw * 0.08; // sink slightly
      } else {
        // Slam phase - explosive forward
        sw = Math.sin(((t - 0.4) / 0.6) * Math.PI);
        torso.rotation.x = sw * 0.35; // lean forward hard
        torso.rotation.y = sw * 0.5; // twist through
        if (rAP) { rAP.rotation.x = -sw * 2.0; rAP.rotation.z = -sw * 0.3; } // slam down
        if (rEP) { rEP.rotation.x = -sw * 0.4; }
        if (lAP) { lAP.rotation.x = sw * 0.5; }
        hips.position.y = 1.1 + sw * 0.05;
      }
      // Both knuckles glow during heavy
      ['leftKnuckle', 'rightKnuckle'].forEach(n => { const k = g.getObjectByName(n); if (k) k.material.opacity = (t > 0.4 ? sw : 0) * 0.7; });

    } else if (atkType === 'cursed') {
      // Cursed strike - energy gathering then burst, both hands forward
      const dur = 0.5;
      const t = Math.max(0, 1 - (tp / dur));
      if (t < 0.35) {
        // Charge phase - arms draw inward, energy gathers
        const ch = t / 0.35;
        if (lAP) { lAP.rotation.x = -ch * 0.6; lAP.rotation.z = ch * 0.8; } // arms inward
        if (rAP) { rAP.rotation.x = -ch * 0.6; rAP.rotation.z = -ch * 0.8; }
        if (lEP) { lEP.rotation.x = -ch * 1.0; }
        if (rEP) { rEP.rotation.x = -ch * 1.0; }
        torso.rotation.x = -ch * 0.15; // lean slightly back
        hips.position.y = 1.1 + ch * 0.05; // rise up slightly
      } else {
        // Release phase - thrust both hands forward
        const rel = Math.sin(((t - 0.35) / 0.65) * Math.PI);
        if (lAP) { lAP.rotation.x = -rel * 1.8; lAP.rotation.z = rel * 0.2; }
        if (rAP) { rAP.rotation.x = -rel * 1.8; rAP.rotation.z = -rel * 0.2; }
        if (lEP) { lEP.rotation.x = 0; }
        if (rEP) { rEP.rotation.x = 0; }
        torso.rotation.x = rel * 0.25;
        hips.position.y = 1.1 - rel * 0.06;
      }
      // Strong knuckle glow
      ['leftKnuckle', 'rightKnuckle'].forEach(n => { const k = g.getObjectByName(n); if (k) k.material.opacity = 0.8; });

    } else if (atkType === 'technique') {
      // Technique moves - dramatic pose with energy channeling
      const dur = 0.4;
      const t = Math.max(0, 1 - (tp / dur));
      const sw = Math.sin(t * Math.PI);
      // One hand extended forward, other pulled back
      if (rAP) { rAP.rotation.x = -sw * 1.5; rAP.rotation.z = -sw * 0.15; }
      if (rEP) { rEP.rotation.x = 0; }
      if (lAP) { lAP.rotation.x = sw * 0.6; lAP.rotation.z = sw * 0.3; }
      if (lEP) { lEP.rotation.x = -sw * 0.8; }
      torso.rotation.x = sw * 0.15; // lean into it
      torso.rotation.y = -sw * 0.2;
      hips.rotation.y = sw * 0.1;
      // Both knuckles glow with technique color
      ['leftKnuckle', 'rightKnuckle'].forEach(n => { const k = g.getObjectByName(n); if (k) k.material.opacity = sw * 0.7; });

    } else {
      // Fallback: original animation
      const dur = 0.3; const t = Math.max(0, 1 - (tp / dur)); const sw = Math.sin(t * Math.PI);
      if (rAP) { rAP.rotation.x = -sw * 1.6; } if (lAP) { lAP.rotation.x = sw * 0.4; }
      torso.rotation.y = sw * 0.22;
    }
    return;
  }

  // Reset knuckle glow
  ['leftKnuckle', 'rightKnuckle'].forEach(n => { const k = g.getObjectByName(n); if (k) k.material.opacity = 0; });

  if (moving) {
    // ── WALK / RUN — realistic gait ──

    // --- LEGS: thigh swing + IK-style knee bend ---
    // Thigh swings forward/back; when leg swings forward, knee bends more (passing phase)
    const thighAmplitude = 0.55 + runLerp * 0.35;  // bigger stride when running
    const kneeBase = 0.08;                   // slight resting bend
    const kneeLiftMult = 0.6 + runLerp * 0.5;     // more knee lift when running

    if (lLP) {
      lLP.rotation.x = -lLegSwing * thighAmplitude * gaitMult;
      lLP.rotation.z = 0;
    }
    if (rLP) {
      rLP.rotation.x = -rLegSwing * thighAmplitude * gaitMult;
      rLP.rotation.z = 0;
    }
    // Knee: bends when foot lifts (swing phase), extends on plant
    if (lKP) lKP.rotation.x = kneeBase + lLegLift * kneeLiftMult * gaitMult + lPush * 0.12 * gaitMult;
    if (rKP) rKP.rotation.x = kneeBase + rLegLift * kneeLiftMult * gaitMult + rPush * 0.12 * gaitMult;

    // --- ARMS: counter-swing with natural elbow flex ---
    const armSwingAmp = 0.5 + runLerp * 0.4;
    const elbowFlex = 0.35 + runLerp * 0.45; // arms bend more when running

    if (lAP) {
      lAP.rotation.x = sinW * armSwingAmp * gaitMult;          // opposite to right leg
      lAP.rotation.z = 0.06 + runLerp * 0.04;                    // slight outward splay
      lAP.rotation.y = cosW * 0.04 * gaitMult;                 // subtle cross-body
    }
    if (rAP) {
      rAP.rotation.x = -sinW * armSwingAmp * gaitMult;
      rAP.rotation.z = -0.06 - runLerp * 0.04;
      rAP.rotation.y = -cosW * 0.04 * gaitMult;
    }
    // Elbow: flexes when arm swings back (like a runner pulling back)
    if (lEP) lEP.rotation.x = -elbowFlex * (0.3 + Math.max(0, -sinW) * 0.7) * gaitMult;
    if (rEP) rEP.rotation.x = -elbowFlex * (0.3 + Math.max(0, sinW) * 0.7) * gaitMult;

    // --- HEAD: stabilizes, slight counter-bob ---
    if (head) {
      head.rotation.x = lerpA(head.rotation.x || 0, -anim.torsoPitch * 0.4 + Math.abs(sin2W) * 0.03 * gaitMult, 10 * dt);
      head.rotation.z = lerpA(head.rotation.z || 0, -torsoSideRoll * 0.5, 8 * dt);
      head.rotation.y = lerpA(head.rotation.y || 0, -torsoYaw * 0.3, 8 * dt); // eyes stay forward
    }
  } else {
    // ── IDLE: subtle weight shift + breathing ──
    const idleT = elapsed * 0.8;  // slow, relaxed cycle
    const idleSin = Math.sin(idleT);
    const idleCos = Math.cos(idleT);
    const idleSin2 = Math.sin(idleT * 1.7 + 0.8); // secondary rhythm for variety

    // Subtle weight shift side to side
    hips.rotation.z = lerpA(hips.rotation.z, idleSin * 0.015, 5 * dt);
    hips.position.x = lerpA(hips.position.x || 0, idleSin * 0.012, 5 * dt);

    // Arms hang naturally with slight sway
    if (lAP) { lAP.rotation.x = idleSin * 0.03; lAP.rotation.z = 0.08 + idleCos * 0.01; lAP.rotation.y = 0; }
    if (rAP) { rAP.rotation.x = -idleSin * 0.03; rAP.rotation.z = -0.08 - idleCos * 0.01; rAP.rotation.y = 0; }
    if (lEP) lEP.rotation.x = -0.1 + idleSin2 * 0.03;
    if (rEP) rEP.rotation.x = -0.1 - idleSin2 * 0.03;

    // Legs relaxed, one slightly bent
    if (lLP) { lLP.rotation.x = idleSin * 0.01; lLP.rotation.z = 0; }
    if (rLP) { rLP.rotation.x = -idleSin * 0.01; rLP.rotation.z = 0; }
    if (lKP) lKP.rotation.x = 0.02 + Math.max(0, idleSin) * 0.02;
    if (rKP) rKP.rotation.x = 0.02 + Math.max(0, -idleSin) * 0.02;

    // Head: subtle look-around
    if (head) {
      head.rotation.x = lerpA(head.rotation.x || 0, idleSin * 0.02 + breath * 1.5, 4 * dt);
      head.rotation.z = lerpA(head.rotation.z || 0, idleSin2 * 0.025, 4 * dt);
      head.rotation.y = lerpA(head.rotation.y || 0, Math.sin(idleT * 0.4) * 0.06, 3 * dt);
    }

    // Smooth torso back to neutral
    torso.rotation.y = lerpA(torso.rotation.y, 0, 6 * dt);
  }

  // ── Dash lean ──
  if (dashing) {
    anim.dashLean = lerpA(anim.dashLean, 0.45, 18 * dt);
    torso.rotation.x = anim.dashLean;
  } else {
    anim.dashLean = lerpA(anim.dashLean, 0, 8 * dt);
  }

  // ── AURA ──
  const energyRatio = player.energy / player.maxEnergy;
  const techCol = playerTech ? playerTech.hex : 0x8844ff;
  if (aura) {
    aura.material.color.setHex(techCol);
    aura.material.opacity = energyRatio * 0.09 + Math.sin(elapsed * 3) * 0.035;
    aura.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.12 + spd * 0.08);
  }
  if (auraCore) {
    auraCore.material.color.setHex(techCol);
    auraCore.material.opacity = (energyRatio > 0.3 ? 0.08 : 0) + Math.sin(elapsed * 5) * 0.04;
    auraCore.scale.setScalar(0.9 + Math.sin(elapsed * 4) * 0.2);
  }

  // ── ACCESSORY ANIMATIONS ──
  // Scarf physics - swings with movement
  const st1 = g.getObjectByName('scarfTail1');
  const st2 = g.getObjectByName('scarfTail2');
  if (st1) { st1.rotation.x = Math.sin(elapsed * 4 + 0.3) * 0.3 * spd + Math.sin(elapsed * 1.5) * 0.05 + 0.15; st1.rotation.z = Math.sin(elapsed * 3) * 0.15 * spd; }
  if (st2) { st2.rotation.x = Math.sin(elapsed * 4 + 1.2) * 0.25 * spd + Math.sin(elapsed * 1.8) * 0.04 + 0.18; st2.rotation.z = Math.sin(elapsed * 3.5 + 0.5) * 0.12 * spd; }

  // Eye trails - glow when moving fast, attacking, or energy is high
  const eyeIntensity = Math.max(spd * 0.3, player.isAttacking ? 0.6 : 0, energyRatio > 0.7 ? 0.25 : 0);
  const etL = g.getObjectByName('eyeTrailL'), etR = g.getObjectByName('eyeTrailR');
  if (etL) { etL.material.opacity = lerpA(etL.material.opacity, eyeIntensity, 8 * dt); etL.scale.y = 1 + spd * 0.5; }
  if (etR) { etR.material.opacity = lerpA(etR.material.opacity || 0, eyeIntensity, 8 * dt); etR.scale.y = 1 + spd * 0.5; }

  // Hand aura - glows when energy is high or during attacks
  const handGlow = player.isAttacking ? 0.5 : (energyRatio > 0.5 ? energyRatio * 0.15 : 0);
  const lha = g.getObjectByName('leftHandAura'), rha = g.getObjectByName('rightHandAura');
  if (lha) { lha.material.opacity = lerpA(lha.material.opacity || 0, handGlow, 10 * dt); lha.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.3); }
  if (rha) { rha.material.opacity = lerpA(rha.material.opacity || 0, handGlow, 10 * dt); rha.scale.setScalar(1 + Math.sin(elapsed * 5 + 1) * 0.3); }
}
// ═══════ CAMERA EFFECTS ═══════
let camShakeIntensity = 0, camShakeDecay = 8, camZoomOffset = 0, camZoomDecay = 5;
function cameraShake(intensity) { camShakeIntensity = Math.max(camShakeIntensity, intensity); }
function cameraZoom(amount) { camZoomOffset = Math.max(camZoomOffset, amount); }

function updateCamera(dt) {
  const pp = player.group.position;
  const spd = anim.walkSpeed;
  // Camera bob (only on ground while moving)
  const bob = player.grounded ? Math.sin(anim.walkCycle) * 0.055 * spd : 0;
  const sway = player.grounded ? Math.cos(anim.walkCycle * 0.5) * 0.022 * spd : 0;
  // Apply zoom offset for attack zoom
  const zoomDist = camDist - camZoomOffset * 3;
  const actualOx = Math.sin(cameraYaw) * Math.cos(cameraPitch) * zoomDist;
  const actualOy = Math.sin(cameraPitch) * zoomDist + 3 + bob;
  const actualOz = Math.cos(cameraYaw) * Math.cos(cameraPitch) * zoomDist;
  camSmooth.pos.lerp(new THREE.Vector3(pp.x + actualOx + sway, pp.y + actualOy, pp.z + actualOz), 9 * dt);
  camSmooth.tgt.lerp(new THREE.Vector3(pp.x, pp.y + 2.1, pp.z), 11 * dt);
  camera.position.copy(camSmooth.pos);
  // Camera shake
  if (camShakeIntensity > 0.01) {
    camera.position.x += (Math.random() - 0.5) * camShakeIntensity * 2;
    camera.position.y += (Math.random() - 0.5) * camShakeIntensity * 1.5;
    camShakeIntensity *= Math.pow(0.01, dt / 0.15); // smooth decay
  } else camShakeIntensity = 0;
  // Zoom decay
  if (camZoomOffset > 0.01) camZoomOffset *= Math.pow(0.01, dt / 0.3); else camZoomOffset = 0;
  camera.lookAt(camSmooth.tgt);

  // Speed lines when dashing
  document.getElementById('speed-lines').style.opacity = player.isDashing ? '1' : '0';
}
