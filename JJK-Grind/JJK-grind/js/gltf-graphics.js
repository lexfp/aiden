// ═══════════════════ GLTF + PBR (three.js skinning / keyframe-style workflow) ═══════════════════
// References: https://threejs.org/examples/#webgl_animation_skinning_blending
//             https://threejs.org/examples/#webgl_animation_keyframes
// Offline: place Xbot.glb (and optional Parrot.glb) in ./models/ — loaded before CDN fallback.

let _pbrEnvInitialized = false;
window.parrotCameos = window.parrotCameos || [];

function loadGltfWithFallback(urls, onLoad, onError) {
  if (typeof GLTFLoader === 'undefined') { if (onError) onError(); return; }
  const loader = new GLTFLoader();
  let i = 0;
  function tryNext() {
    if (i >= urls.length) { if (onError) onError(); return; }
    loader.load(
      urls[i],
      onLoad,
      undefined,
      () => { i++; tryNext(); }
    );
  }
  tryNext();
}

function initPbrEnvironment(scene, renderer) {
  if (_pbrEnvInitialized || typeof RoomEnvironment === 'undefined' || !THREE.PMREMGenerator) return;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new RoomEnvironment();
    scene.environment = pmrem.fromScene(env, 0.04).texture;
    env.dispose();
    pmrem.dispose();
    _pbrEnvInitialized = true;
  } catch (e) { console.warn('initPbrEnvironment:', e); }
}

/** Idle/run blend weights for Xbot-style clips (animation blending). */
function updateGlTFPlayerAnimations(dt) {
  const m = player.gltfMixer;
  if (!m) return;
  const moving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];
  const dashing = player.isDashing;
  const runTarget = (dashing || moving) ? 1 : 0;
  const t = 4 * dt;
  if (player.gltfActionIdle) {
    player.gltfActionIdle.weight = THREE.MathUtils.lerp(player.gltfActionIdle.weight || 1, 1 - runTarget, t);
  }
  if (player.gltfActionRun) {
    player.gltfActionRun.weight = THREE.MathUtils.lerp(player.gltfActionRun.weight || 0, runTarget, t);
  }
  m.update(dt);
}

function _pickClip(anims, ...keywords) {
  const low = keywords.map(k => k.toLowerCase());
  for (const a of anims) {
    const n = (a.name || '').toLowerCase();
    if (low.some(k => n.includes(k))) return a;
  }
  return anims[0] || null;
}

function _applyGltfPlayer(gltf) {
  const root = gltf.scene;
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        if (mat && mat.map && mat.map.colorSpace !== undefined) mat.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
  });
  root.name = 'gltfPlayer';
  root.scale.setScalar(0.018);
  root.position.set(0, 0, 0);
  player.group.add(root);

  const bm = player.group.getObjectByName('bodyMesh');
  if (bm) bm.visible = false;

  player.useGLTF = true;
  player.gltfRoot = root;
  player.gltfMixer = new THREE.AnimationMixer(root);
  const anims = gltf.animations || [];
  const idleClip = _pickClip(anims, 'idle', 'neutral') || anims[0];
  const runClip = _pickClip(anims, 'run', 'jog', 'walk', 'sprint') || idleClip;
  if (idleClip) {
    player.gltfActionIdle = player.gltfMixer.clipAction(idleClip);
    player.gltfActionIdle.play();
  }
  if (runClip) {
    player.gltfActionRun = player.gltfMixer.clipAction(runClip);
    player.gltfActionRun.play();
    player.gltfActionRun.weight = 0;
  }
}

/**
 * Loads Xbot GLB (skinned mesh + clips). Tries ./models/Xbot.glb first, then jsDelivr (works offline with local file).
 */
function tryLoadGLTFPlayer() {
  const urls = [
    './models/Xbot.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Xbot.glb',
  ];
  loadGltfWithFallback(urls, _applyGltfPlayer, () => {
    console.warn('GLTF player load failed (using procedural mesh).');
  });
}

/** Small keyframe-style scene cameo (Parrot from three.js examples). */
function loadWorldGltfCameos() {
  const urls = [
    './models/Parrot.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Parrot.glb',
  ];
  loadGltfWithFallback(urls, (gltf) => {
    const root = gltf.scene;
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (mat && mat.map && mat.map.colorSpace !== undefined) mat.map.colorSpace = THREE.SRGBColorSpace;
        }
      }
    });
    root.name = 'gltfParrotCameo';
    root.scale.setScalar(0.07);
    const hub = typeof ISLANDS !== 'undefined' ? ISLANDS[0] : { x: 0, z: 0 };
    const bx = hub.x + 22;
    const bz = hub.z + 14;
    const baseY = 2.8;
    root.position.set(bx, baseY, bz);
    root.userData.isParrotCameo = true;
    root.userData.baseY = baseY;
    scene.add(root);
    window.parrotCameos.push(root);
    if (gltf.animations && gltf.animations.length) {
      const mx = new THREE.AnimationMixer(root);
      gltf.animations.forEach((clip) => mx.clipAction(clip).play());
      root.userData.mixer = mx;
    }
  }, () => {});
}
