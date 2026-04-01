// =============================================================================
// STORM ZONE — Utility / Helper Functions
// =============================================================================

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
function snap(v, g) { return Math.round(v / g) * g; }

// Shortest-path lerp for angles (radians)
function lerpAngle(a, b, t) {
  let diff = ((b - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return a + diff * t;
}

// Deterministic rolling-hill terrain height at world (x, z).
// Must match vertex displacement in WorldSystem.
function terrainH(x, z) {
  const s = 0.007;
  return Math.sin(x * s * 2.3) * Math.cos(z * s * 1.9) * 4.0
       + Math.sin(x * s * 5.1 + 1.2) * Math.cos(z * s * 4.7) * 1.5
       + Math.cos(x * s * 1.1 + 0.5) * Math.sin(z * s * 1.3) * 3.0;
}

// 2-D distance (ignores Y)
function dist2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Pick a random map spawn point (not too close to centre or edges)
function randSpawn(minR, maxR) {
  const angle = Math.random() * Math.PI * 2;
  const radius = rand(minR, maxR);
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
  };
}

// Weighted random choice: weights = { key: weight, ... }
function weightedRandom(weights) {
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return key;
  }
  return Object.keys(weights)[0];
}

// Format seconds as M:SS
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

// Quick hex string from Three.js color int
function hexStr(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

// Build a character mesh — uses the Soldier GLB model if available, else falls
// back to the old box capsule.  The returned group always carries:
//   .userData.mixer   — AnimationMixer (null for fallback)
//   .userData.actions — { Idle, Walk, Run } AnimationActions (empty for fallback)
//   .userData.currentAction — name of the playing clip
function makeCharacterMesh(bodyColor) {
  if (window.SOLDIER_MODEL && window.SOLDIER_ANIMATIONS) {
    return _cloneSoldier(bodyColor);
  }
  return _makeBoxCharacter(bodyColor);
}

function _cloneSoldier(bodyColor) {
  const clone = SkeletonUtils.clone(window.SOLDIER_MODEL);

  // The Soldier model is ~1.8 units tall with feet at y = 0.
  // Existing code places the group at terrainH + 0.9 (centre-mass).
  // Shift the model down so feet align with y = -0.9 of the group.
  clone.position.y = -0.9;

  // Tint materials
  const tint = new THREE.Color(bodyColor);
  clone.traverse(child => {
    if (child.isMesh) {
      child.material = child.material.clone();
      child.material.color.lerp(tint, 0.45);
      child.castShadow = true;
      child.frustumCulled = false;
    }
  });

  // Wrapper group so existing position maths remain unchanged
  const wrapper = new THREE.Group();
  wrapper.add(clone);

  // Animation
  const mixer   = new THREE.AnimationMixer(clone);
  const actions  = {};
  for (const clip of window.SOLDIER_ANIMATIONS) {
    actions[clip.name] = mixer.clipAction(clip);
  }

  // Start idle
  const startName = actions['Idle'] ? 'Idle' : Object.keys(actions)[0];
  if (startName && actions[startName]) actions[startName].play();

  wrapper.userData.mixer         = mixer;
  wrapper.userData.actions       = actions;
  wrapper.userData.currentAction = startName || '';

  return wrapper;
}

// Cross-fade to a new animation clip by name
function setCharacterAnim(group, name) {
  const ud = group.userData;
  if (!ud.mixer || !ud.actions[name] || ud.currentAction === name) return;

  const prev = ud.actions[ud.currentAction];
  const next = ud.actions[name];

  if (prev) prev.fadeOut(0.2);
  next.reset().fadeIn(0.2).play();
  ud.currentAction = name;
}

// Fallback box character (original implementation)
function _makeBoxCharacter(bodyColor) {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 1.2, 0.45),
    new THREE.MeshLambertMaterial({ color: bodyColor })
  );
  body.position.y = 0.1;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xfddbb4 })
  );
  head.position.y = 0.95;
  head.castShadow = true;
  g.add(head);

  const legGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
  const legMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  [-0.2, 0.2].forEach(ox => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(ox, -0.6, 0);
    leg.castShadow = true;
    g.add(leg);
  });

  // Compat stubs
  g.userData.mixer = null;
  g.userData.actions = {};
  g.userData.currentAction = '';

  return g;
}

// Spawn a hit-spark particle effect at position (one-shot)
function spawnSpark(scene, pos, color = 0xffdd44) {
  const mats = [];
  const meshes = [];
  const life = { t: 0, max: 0.18 };

  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 4, 4),
      new THREE.MeshBasicMaterial({ color })
    );
    m.position.copy(pos);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      Math.random() * 6 + 2,
      (Math.random() - 0.5) * 8
    );
    m.userData.vel = vel;
    scene.add(m);
    meshes.push(m);
    mats.push(m.material);
  }

  // Tracked globally so Game.update can tick particles
  if (!window._particles) window._particles = [];
  window._particles.push({ meshes, life, scene });
}

// Called each frame by Game to update transient particles
function tickParticles(dt) {
  if (!window._particles) return;
  window._particles = window._particles.filter(p => {
    p.life.t += dt;
    const alpha = 1 - p.life.t / p.life.max;
    p.meshes.forEach(m => {
      m.position.addScaledVector(m.userData.vel, dt);
      m.userData.vel.y -= 20 * dt;
      m.material.opacity = alpha;
      m.material.transparent = true;
    });
    if (p.life.t >= p.life.max) {
      p.meshes.forEach(m => p.scene.remove(m));
      return false;
    }
    return true;
  });
}
