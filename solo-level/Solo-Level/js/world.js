// ═══════════════════ WORLD / PLATFORMS / BACKGROUNDS ═══════════════════

class Platform {
  constructor(x, y, w, h, type) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.type = type || 'solid'; // 'solid' or 'passthrough'
  }
  draw(ctx, camX, theme) {
    const sx = this.x - camX;
    if (sx + this.w < -50 || sx > ctx.canvas.width + 50) return;
    const colors = {
      cave: ['#2a1f1a', '#3d2e22'],
      ice: ['#1a3040', '#254555'],
      demon: ['#3a1010', '#501818'],
      void: ['#15102a', '#201838'],
      ant: ['#1a2a18', '#253a22']
    };
    const [fill, border] = colors[theme] || colors.cave;
    ctx.fillStyle = fill;
    ctx.fillRect(sx, this.y, this.w, this.h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, this.y, this.w, this.h);
    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(sx, this.y, this.w, 3);
  }
}

function generatePlatforms(dungeon, groundY) {
  const platforms = [];
  const ww = dungeon.worldWidth;
  // Ground
  platforms.push(new Platform(0, groundY, ww, 80, 'solid'));
  // Floating platforms spread across the level
  const platCount = 12 + dungeon.id * 3;
  const segW = ww / (platCount + 2);
  for (let i = 0; i < platCount; i++) {
    const px = segW * (i + 1) + (Math.random() - 0.5) * segW * 0.4;
    const py = groundY - 80 - Math.random() * 160;
    const pw = 80 + Math.random() * 100;
    platforms.push(new Platform(px, py, pw, 16, 'passthrough'));
  }
  // Boss arena platform (wide, near end)
  platforms.push(new Platform(ww - 600, groundY - 5, 550, 20, 'solid'));
  return platforms;
}

// ── Parallax Background Drawing ──
const BG_THEMES = {
  cave: {
    sky: ['#0a0610', '#120820', '#1a0e30'],
    midColor: '#0d0818',
    farMountains: '#150c22',
    nearColor: '#1e1230',
    groundColor: '#2a1f1a',
    starColor: 'rgba(148,0,211,0.3)',
    hasMoon: true, moonColor: '#9400D3'
  },
  ice: {
    sky: ['#060d15', '#0a1825', '#102535'],
    midColor: '#081520',
    farMountains: '#0c1e2e',
    nearColor: '#152838',
    groundColor: '#1a3040',
    starColor: 'rgba(100,200,255,0.3)',
    hasMoon: true, moonColor: '#4fc3f7'
  },
  demon: {
    sky: ['#150505', '#250808', '#351010'],
    midColor: '#1a0808',
    farMountains: '#280c0c',
    nearColor: '#351515',
    groundColor: '#3a1010',
    starColor: 'rgba(255,60,30,0.3)',
    hasMoon: true, moonColor: '#ff4444'
  },
  void: {
    sky: ['#05030f', '#0a0618', '#120a25'],
    midColor: '#080515',
    farMountains: '#0f0a20',
    nearColor: '#180e30',
    groundColor: '#15102a',
    starColor: 'rgba(180,80,255,0.4)',
    hasMoon: true, moonColor: '#b44fff'
  },
  ant: {
    sky: ['#050f08', '#081a0d', '#0c2512'],
    midColor: '#071208',
    farMountains: '#0c1e10',
    nearColor: '#152a18',
    groundColor: '#1a2a18',
    starColor: 'rgba(0,255,100,0.25)',
    hasMoon: false
  }
};

// Pre-generate stars per theme
const bgStars = {};
function initBgStars(theme) {
  if (bgStars[theme]) return;
  bgStars[theme] = [];
  for (let i = 0; i < 120; i++) {
    bgStars[theme].push({
      x: Math.random() * 3000,
      y: Math.random() * 400,
      s: 0.3 + Math.random() * 1.5,
      twinkle: Math.random() * Math.PI * 2
    });
  }
}

// Pre-generate mountain silhouettes
const bgMountains = {};
function initBgMountains(theme) {
  if (bgMountains[theme]) return;
  bgMountains[theme] = { far: [], near: [] };
  // Far mountains
  for (let x = 0; x < 3500; x += 25) {
    bgMountains[theme].far.push(200 + Math.sin(x * 0.005) * 80 + Math.sin(x * 0.013) * 40 + Math.sin(x * 0.031) * 20);
  }
  // Near mountains
  for (let x = 0; x < 4500; x += 20) {
    bgMountains[theme].near.push(280 + Math.sin(x * 0.007) * 60 + Math.sin(x * 0.019) * 30 + Math.sin(x * 0.041) * 15);
  }
}

function drawBackground(ctx, camX, theme, elapsed, canvasW, canvasH) {
  const t = BG_THEMES[theme] || BG_THEMES.cave;
  initBgStars(theme);
  initBgMountains(theme);

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasH);
  t.sky.forEach((c, i) => skyGrad.addColorStop(i / (t.sky.length - 1), c));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Stars (parallax 0.05)
  const stars = bgStars[theme];
  for (const star of stars) {
    const sx = ((star.x - camX * 0.05) % canvasW + canvasW) % canvasW;
    const sy = star.y;
    const twinkle = 0.3 + Math.sin(elapsed * 2 + star.twinkle) * 0.4;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = t.starColor;
    ctx.beginPath();
    ctx.arc(sx, sy, star.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Moon
  if (t.hasMoon) {
    const mx = canvasW * 0.75 - camX * 0.02;
    const my = 80;
    ctx.save();
    ctx.shadowBlur = 60;
    ctx.shadowColor = t.moonColor;
    ctx.fillStyle = t.moonColor;
    ctx.globalAlpha = 0.25 + Math.sin(elapsed * 0.5) * 0.1;
    ctx.beginPath();
    ctx.arc(mx, my, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(mx, my, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Far mountains (parallax 0.15)
  const farM = bgMountains[theme].far;
  ctx.fillStyle = t.farMountains;
  ctx.beginPath();
  ctx.moveTo(0, canvasH);
  for (let i = 0; i < farM.length; i++) {
    const sx = i * 25 - (camX * 0.15) % (farM.length * 25);
    ctx.lineTo(sx, farM[i]);
  }
  ctx.lineTo(canvasW + 100, canvasH);
  ctx.closePath();
  ctx.fill();

  // Near mountains (parallax 0.35)
  const nearM = bgMountains[theme].near;
  ctx.fillStyle = t.nearColor;
  ctx.beginPath();
  ctx.moveTo(0, canvasH);
  for (let i = 0; i < nearM.length; i++) {
    const sx = i * 20 - (camX * 0.35) % (nearM.length * 20);
    ctx.lineTo(sx, nearM[i]);
  }
  ctx.lineTo(canvasW + 100, canvasH);
  ctx.closePath();
  ctx.fill();
}
