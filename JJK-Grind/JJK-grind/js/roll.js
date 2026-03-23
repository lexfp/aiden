// ═══════════════════ ROLL ═══════════════════
let rolledTech = null;
function buildRollStrip() {
  const strip = document.getElementById('roll-strip'); strip.innerHTML = '';
  for (let i = 0; i < 80; i++) { const t = TECHNIQUES[i % TECHNIQUES.length]; const c = document.createElement('div'); c.className = 'rcard'; c.style.borderColor = t.color + '55'; c.innerHTML = `<div class="ri">${t.icon}</div><div class="rn">${t.name}</div><div class="ru">${t.user}</div><div class="rr" style="color:${RARITY_C[t.rarity]}">${t.rarity}</div>`; strip.appendChild(c); }
}
function doRoll() {
  const btn = document.getElementById('roll-btn'); btn.disabled = true;
  document.getElementById('tech-result').style.display = 'none'; document.getElementById('confirm-btn').style.display = 'none';
  const idx = Math.floor(Math.random() * TECHNIQUES.length); rolledTech = TECHNIQUES[idx];
  const strip = document.getElementById('roll-strip'); const tX = -(50 * 176 - (680 / 2) + 88);
  let t0 = null;
  function ease(t) { return 1 - Math.pow(1 - t, 4); }
  function anim(ts) { if (!t0) t0 = ts; const p = Math.min((ts - t0) / 3500, 1); strip.style.transform = `translateX(${tX * ease(p)}px)`; if (p < 1) requestAnimationFrame(anim); else { showRollResult(); btn.disabled = false; } }
  requestAnimationFrame(anim);
}
function showRollResult() {
  const t = rolledTech;
  document.getElementById('res-name').textContent = t.name; document.getElementById('res-name').style.color = t.color;
  document.getElementById('res-user').textContent = 'User: ' + t.user; document.getElementById('res-desc').textContent = t.desc;
  const rc = document.getElementById('res-card'); rc.style.borderColor = t.color; rc.style.boxShadow = '0 0 28px ' + t.color + '44';
  const mv = document.getElementById('res-moves'); mv.innerHTML = '';
  t.moves.forEach(m => { const d = document.createElement('div'); d.className = 'rmv'; d.innerHTML = `<span class="rk">${m.key}</span><span class="rnm">${m.name}</span><span class="rreq">${m.req === 0 ? 'UNLOCKED' : 'Mastery ' + m.req}</span>`; mv.appendChild(d); });
  document.getElementById('tech-result').style.display = 'flex'; document.getElementById('confirm-btn').style.display = 'block';
}
function confirmTech() {
  playerTech = rolledTech; techMoveCDs = new Array(playerTech.moves.length).fill(0);
  document.getElementById('roll-screen').style.opacity = '0';
  setTimeout(() => { document.getElementById('roll-screen').style.display = 'none'; startGame(); }, 600);
}

// ═══════════════════ TECHNIQUE STATE ═══════════════════
let playerTech = null, techMastery = 0, techMoveCDs = [];
const MAX_MASTERY = 100;
function gainMastery(amt) {
  if (techMastery >= MAX_MASTERY) return; const prev = techMastery; techMastery = Math.min(MAX_MASTERY, techMastery + amt);
  if (playerTech) playerTech.moves.forEach(m => { if (m.req > 0 && prev < m.req && techMastery >= m.req) showMasteryNotif('✦ UNLOCKED: ' + m.name + ' [' + m.key + ']'); });
  updateTechUI();
}
function showMasteryNotif(msg) {
  const el = document.getElementById('mastery-notif'); if (playerTech) el.style.borderLeftColor = playerTech.color;
  el.textContent = msg; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
