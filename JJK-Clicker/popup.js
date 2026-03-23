// =============================================
//   JJK CURSED ENERGY CLICKER — Game Logic
// =============================================

const SORCERERS = [
  {
    id: 'yuji',
    name: 'Yuji Itadori',
    emoji: '👊',
    desc: 'Divergent Fist pulses with cursed energy.',
    baseCost: 15,
    baseCPS: 0.1,
    color: '#ff6b6b',
    unlockAt: 0,
  },
  {
    id: 'megumi',
    name: 'Megumi Fushiguro',
    emoji: '🐾',
    desc: 'Shikigami roam and gather CE passively.',
    baseCost: 100,
    baseCPS: 0.5,
    color: '#4a9eff',
    unlockAt: 10,
  },
  {
    id: 'nobara',
    name: 'Nobara Kugisaki',
    emoji: '🔨',
    desc: 'Straw Doll drives curses into submission.',
    baseCost: 500,
    baseCPS: 2,
    color: '#ff9f43',
    unlockAt: 75,
  },
  {
    id: 'nanami',
    name: 'Kento Nanami',
    emoji: '⚡',
    desc: 'Ratio Technique splits curses precisely.',
    baseCost: 2000,
    baseCPS: 8,
    color: '#ffd700',
    unlockAt: 250,
  },
  {
    id: 'todo',
    name: 'Aoi Todo',
    emoji: '🤜',
    desc: 'Boogie Woogie swaps positions for CE.',
    baseCost: 8000,
    baseCPS: 25,
    color: '#a855f7',
    unlockAt: 750,
  },
  {
    id: 'maki',
    name: 'Maki Zenin',
    emoji: '⚔️',
    desc: 'Heavenly Restriction channels pure force.',
    baseCost: 30000,
    baseCPS: 80,
    color: '#22d3ee',
    unlockAt: 2500,
  },
  {
    id: 'toji',
    name: 'Toji Fushiguro',
    emoji: '🗡️',
    desc: 'Sorcerer Killer hunts with lethal precision.',
    baseCost: 150000,
    baseCPS: 300,
    color: '#f43f5e',
    unlockAt: 10000,
  },
  {
    id: 'sukuna',
    name: 'Ryomen Sukuna',
    emoji: '😈',
    desc: 'The King of Curses radiates boundless malice.',
    baseCost: 1000000,
    baseCPS: 2000,
    color: '#ff0055',
    unlockAt: 100000,
  },
  {
    id: 'gojo',
    name: 'Satoru Gojo',
    emoji: '🌌',
    desc: 'Infinity bends reality; CE flows unlimited.',
    baseCost: 10000000,
    baseCPS: 15000,
    color: '#00f5ff',
    unlockAt: 1000000,
  },
];

const UPGRADES = [
  { id: 'blackflash', name: 'Black Flash', desc: '+2× click power — cursed energy concentrates at impact.', cost: 200, type: 'click', multiplier: 2, requires: 0, color: '#4a9eff' },
  { id: 'cursedtools', name: 'Cursed Tools', desc: '+3 CE per click — forge weapons from cursed energy.', cost: 1000, type: 'click', flat: 3, requires: 0, color: '#a855f7' },
  { id: 'shikigami', name: 'Ten Shadows', desc: 'All sorcerers produce 2× CE.', cost: 5000, type: 'global', multiplier: 2, requires: 100, color: '#22d3ee' },
  { id: 'slaughter', name: 'Cleave & Dismantle', desc: '+5× click power — Sukuna\'s slicing dismantles everything.', cost: 20000, type: 'click', multiplier: 5, requires: 500, color: '#ff0055' },
  { id: 'hollow', name: 'Hollow Purple', desc: 'Void merges attraction and repulsion — 3× all production.', cost: 100000, type: 'global', multiplier: 3, requires: 2000, color: '#c084fc' },
  { id: 'reverse', name: 'Reverse Cursed Technique', desc: 'Positive energy heals — CE auto-regenerates 20% faster.', cost: 300000, type: 'cps', multiplier: 1.2, requires: 10000, color: '#4ade80' },
  { id: 'domain', name: 'Domain Amplification', desc: 'Domain Expansion charges 2× faster.', cost: 500000, type: 'domain', multiplier: 2, requires: 25000, color: '#fbbf24' },
  { id: 'sixeyes', name: 'Six Eyes', desc: 'Gojo\'s eyes see all — click power triples.', cost: 5000000, type: 'click', multiplier: 3, requires: 100000, color: '#00f5ff' },
  { id: 'cursedspirit', name: 'Cursed Spirit Manipulation', desc: 'Absorbed spirits work for you — 5× all production.', cost: 25000000, type: 'global', multiplier: 5, requires: 500000, color: '#fb923c' },
  { id: 'limitless', name: 'Limitless', desc: 'Infinity becomes boundless — 10× everything.', cost: 500000000, type: 'both', multiplier: 10, requires: 10000000, color: '#00f5ff' },
];

const TECHNIQUES = [
  { id: 't1', name: 'DIVERGENT FIST', color: '#ff6b6b', border: '#ff6b6b', requires: 50 },
  { id: 't2', name: 'STRAW DOLL', color: '#ff9f43', border: '#ff9f43', requires: 500 },
  { id: 't3', name: 'TEN SHADOWS', color: '#4a9eff', border: '#4a9eff', requires: 5000 },
  { id: 't4', name: 'HOLLOW PURPLE', color: '#c084fc', border: '#c084fc', requires: 50000 },
  { id: 't5', name: 'LIMITLESS', color: '#00f5ff', border: '#00f5ff', requires: 500000 },
];

const GRADES = [
  { grade: 4, at: 0 },
  { grade: 3, at: 100 },
  { grade: 2, at: 1000 },
  { grade: '1', at: 10000 },
  { grade: 'Special 1', at: 100000 },
  { grade: '0', at: 1000000 },
  { grade: 'SPECIAL GRADE', at: 10000000 },
];

const DOMAIN_MAX = 100;
const SAVE_KEY = 'jjk_clicker_save';

// ---- STATE ----
let state = {
  ce: 0,
  totalCe: 0,
  clickPower: 1,
  clickFlat: 0,
  globalMult: 1,
  cpsMult: 1,
  domainMult: 1,
  domainCharge: 0,
  domainChargeRate: 1, // per second
  prestige: 0,
  prestigeMult: 1,
  sorcerers: {},   // { id: count }
  upgrades: {},    // { id: true }
};

let tickInterval = null;
let saveInterval = null;

// ---- INIT ----
function init() {
  loadState();
  buildTechniqueList();
  buildShop();
  bindEvents();
  spawnParticles();
  tickInterval = setInterval(tick, 100);
  saveInterval = setInterval(saveState, 5000);
  updateUI();
}

// ---- SAVE / LOAD ----
function saveState() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [SAVE_KEY]: JSON.stringify(state) });
    } else {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    }
  } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...state, ...saved };
    }
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(SAVE_KEY, (result) => {
        if (result[SAVE_KEY]) {
          try {
            const saved = JSON.parse(result[SAVE_KEY]);
            state = { ...state, ...saved };
            recalculate();
            updateUI();
          } catch(e) {}
        }
      });
    }
  } catch(e) {}
}

// ---- BUILD UI ----
function buildTechniqueList() {
  const list = document.getElementById('technique-list');
  list.innerHTML = '';
  TECHNIQUES.forEach(t => {
    const badge = document.createElement('div');
    badge.className = 'technique-badge';
    badge.id = 'tech-' + t.id;
    badge.textContent = t.name;
    badge.style.color = t.color;
    badge.style.borderColor = t.border;
    list.appendChild(badge);
  });
}

function buildShop() {
  buildSorcerers();
  buildUpgrades();
}

function buildSorcerers() {
  const list = document.getElementById('sorcerers-list');
  list.innerHTML = '';
  SORCERERS.forEach(s => {
    const card = document.createElement('div');
    card.className = 'sorcerer-card';
    card.id = 'sorc-' + s.id;
    card.style.setProperty('--card-accent', s.color);
    card.innerHTML = `
      <div class="sorcerer-header">
        <div>
          <div class="sorcerer-name">${s.emoji} ${s.name}</div>
          <div class="sorcerer-desc">${s.desc}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px">
        <div class="sorcerer-cost" id="sorc-cost-${s.id}">${fmtNum(sorcererCost(s.id))} CE</div>
        <div class="sorcerer-count">Owned: <span id="sorc-count-${s.id}">0</span></div>
      </div>
    `;
    card.addEventListener('click', () => buySorcerer(s.id));
    list.appendChild(card);
  });
}

function buildUpgrades() {
  const list = document.getElementById('upgrades-list');
  list.innerHTML = '';
  UPGRADES.forEach(u => {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.id = 'upg-' + u.id;
    card.innerHTML = `
      <div class="upgrade-name" style="color:${u.color}">${u.name}</div>
      <div class="upgrade-desc">${u.desc}</div>
      <div class="upgrade-cost">${fmtNum(u.cost)} CE</div>
    `;
    card.addEventListener('click', () => buyUpgrade(u.id));
    list.appendChild(card);
  });
}

// ---- EVENTS ----
function bindEvents() {
  document.getElementById('click-btn').addEventListener('click', handleClick);
  document.getElementById('domain-btn').addEventListener('click', activateDomain);
  document.getElementById('prestige-btn').addEventListener('click', handlePrestige);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('shop-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ---- GAME LOGIC ----
function handleClick(e) {
  const power = getClickPower();
  state.ce += power;
  state.totalCe += power;

  // Domain charge from clicks
  state.domainCharge = Math.min(DOMAIN_MAX, state.domainCharge + 0.5 * state.domainMult);

  spawnFloater(e.clientX, e.clientY, '+' + fmtNum(power));
  
  const btn = document.getElementById('click-btn');
  btn.classList.remove('clicked');
  void btn.offsetWidth;
  btn.classList.add('clicked');

  updateUI();
  checkMilestones();
}

function getClickPower() {
  const base = (1 + state.clickFlat) * state.clickPower * state.prestigeMult;
  return Math.max(1, Math.floor(base));
}

function getCPS() {
  let cps = 0;
  SORCERERS.forEach(s => {
    const count = state.sorcerers[s.id] || 0;
    if (count > 0) {
      cps += s.baseCPS * count * state.globalMult * state.cpsMult * state.prestigeMult;
    }
  });
  return cps;
}

function sorcererCost(id) {
  const s = SORCERERS.find(x => x.id === id);
  const count = state.sorcerers[id] || 0;
  return Math.floor(s.baseCost * Math.pow(1.15, count));
}

function buySorcerer(id) {
  const cost = sorcererCost(id);
  if (state.ce < cost) return;
  state.ce -= cost;
  state.sorcerers[id] = (state.sorcerers[id] || 0) + 1;
  recalculate();
  updateUI();
  saveState();
}

function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u || state.upgrades[id] || state.ce < u.cost) return;
  state.ce -= u.cost;
  state.upgrades[id] = true;
  recalculate();
  updateUI();
  saveState();
  showMilestone(`✦ ${u.name} acquired!`);
}

function recalculate() {
  state.clickPower = 1;
  state.clickFlat = 0;
  state.globalMult = 1;
  state.cpsMult = 1;
  state.domainMult = 1;

  UPGRADES.forEach(u => {
    if (!state.upgrades[u.id]) return;
    if (u.type === 'click') {
      if (u.multiplier) state.clickPower *= u.multiplier;
      if (u.flat) state.clickFlat += u.flat;
    } else if (u.type === 'global') {
      state.globalMult *= u.multiplier;
    } else if (u.type === 'cps') {
      state.cpsMult *= u.multiplier;
    } else if (u.type === 'domain') {
      state.domainMult *= u.multiplier;
    } else if (u.type === 'both') {
      state.clickPower *= u.multiplier;
      state.globalMult *= u.multiplier;
    }
  });
}

function tick() {
  const cps = getCPS();
  const gained = cps / 10; // 100ms tick
  state.ce += gained;
  state.totalCe += gained;

  // Domain charge from CPS
  state.domainCharge = Math.min(DOMAIN_MAX, state.domainCharge + 0.05 * state.domainMult);

  updateUI();
}

function activateDomain() {
  if (state.domainCharge < DOMAIN_MAX) return;
  state.domainCharge = 0;

  const cps = getCPS();
  const bonus = Math.floor(cps * 30 + getClickPower() * 100);
  state.ce += bonus;
  state.totalCe += bonus;

  const overlay = document.getElementById('domain-overlay');
  const bonusEl = document.getElementById('domain-bonus');
  bonusEl.textContent = '+' + fmtNum(bonus) + ' CE';

  overlay.classList.remove('hidden');

  // Pick random domain
  const domains = ['INFINITE VOID', 'CHIMERA SHADOW GARDEN', 'COFFIN OF THE IRON MOUNTAIN', 'MALEVOLENT SHRINE'];
  const subs = ['Unlimited Void', 'Ten Shadows', 'Straw Doll', 'Dismantle & Cleave'];
  const idx = Math.floor(Math.random() * domains.length);
  document.getElementById('domain-title').textContent = domains[idx];
  document.getElementById('domain-sub').textContent = subs[idx];

  setTimeout(() => {
    overlay.classList.add('hidden');
    updateUI();
  }, 2500);

  updateUI();
  showMilestone('Domain Expansion activated!');
}

function handlePrestige() {
  if (state.totalCe < 1000000) return;
  const pCount = state.prestige + 1;
  const prestigeBonus = 1 + pCount * 0.5;

  state.ce = 0;
  state.totalCe = 0;
  state.sorcerers = {};
  state.upgrades = {};
  state.domainCharge = 0;
  state.prestige = pCount;
  state.prestigeMult = prestigeBonus;

  recalculate();
  buildShop();
  updateUI();
  saveState();
  showMilestone(`✦ Prestige ${pCount}! All power ×${prestigeBonus.toFixed(1)}`);
}

// ---- UI UPDATE ----
function updateUI() {
  const ce = Math.floor(state.ce);
  const total = Math.floor(state.totalCe);
  const cps = getCPS();

  document.getElementById('ce-count').textContent = fmtNum(ce);
  document.getElementById('total-count').textContent = fmtNum(total);
  document.getElementById('cps-val').textContent = fmtNum(cps);
  document.getElementById('click-power').textContent = '×' + fmtNum(getClickPower());

  // Domain
  const pct = Math.floor(state.domainCharge);
  document.getElementById('domain-charge-bar').style.width = pct + '%';
  document.getElementById('domain-charge-text').textContent = pct + '%';
  const domainBtn = document.getElementById('domain-btn');
  domainBtn.disabled = state.domainCharge < DOMAIN_MAX;

  // Grade
  let grade = GRADES[0].grade;
  for (const g of GRADES) {
    if (total >= g.at) grade = g.grade;
  }
  document.getElementById('grade-value').textContent = grade;

  // Prestige
  const prestigeBtn = document.getElementById('prestige-btn');
  prestigeBtn.disabled = state.totalCe < 1000000;
  document.getElementById('p-count').textContent = state.prestige;
  document.getElementById('prestige-cost-text').textContent = state.totalCe >= 1000000 ? 'READY!' : 'Need 1M CE total';

  // Sorcerers
  SORCERERS.forEach(s => {
    const count = state.sorcerers[s.id] || 0;
    const cost = sorcererCost(s.id);
    const card = document.getElementById('sorc-' + s.id);
    const costEl = document.getElementById('sorc-cost-' + s.id);
    const countEl = document.getElementById('sorc-count-' + s.id);
    if (!card) return;

    countEl.textContent = count;
    costEl.textContent = fmtNum(cost) + ' CE';
    costEl.className = 'sorcerer-cost' + (ce < cost ? ' cant-afford' : '');

    if (total < s.unlockAt) {
      card.classList.add('locked');
      card.classList.remove('affordable');
    } else {
      card.classList.remove('locked');
      if (ce >= cost) card.classList.add('affordable');
      else card.classList.remove('affordable');
    }
  });

  // Upgrades
  UPGRADES.forEach(u => {
    const card = document.getElementById('upg-' + u.id);
    if (!card) return;
    if (state.upgrades[u.id]) {
      card.classList.add('purchased');
      card.classList.remove('locked');
    } else if (total < u.requires) {
      card.classList.add('locked');
      card.classList.remove('purchased');
    } else {
      card.classList.remove('locked', 'purchased');
    }
  });

  // Techniques
  TECHNIQUES.forEach(t => {
    const badge = document.getElementById('tech-' + t.id);
    if (!badge) return;
    if (total >= t.requires) badge.classList.add('unlocked');
    else badge.classList.remove('unlocked');
  });
}

// ---- MILESTONE / TOAST ----
let toastTimeout = null;
function showMilestone(msg) {
  const toast = document.getElementById('milestone-toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3000);
}

let lastMilestone = -1;
const MILESTONES = [
  { at: 100, msg: '⚡ First 100 CE collected!' },
  { at: 1000, msg: '🔥 1,000 CE — Grade 3 Sorcerer!' },
  { at: 10000, msg: '🌀 10,000 CE — Grade 1 Sorcerer!' },
  { at: 100000, msg: '👁️ 100K CE — Special Grade!' },
  { at: 1000000, msg: '🌌 1M CE — Gojo\'s level!' },
];
function checkMilestones() {
  for (const m of MILESTONES) {
    if (state.totalCe >= m.at && lastMilestone < m.at) {
      lastMilestone = m.at;
      showMilestone(m.msg);
      break;
    }
  }
}

// ---- FLOATERS ----
function spawnFloater(x, y, text) {
  const floater = document.createElement('div');
  floater.className = 'floater';
  floater.textContent = text;
  floater.style.left = (x - 20) + 'px';
  floater.style.top = (y - 10) + 'px';
  document.getElementById('floaters').appendChild(floater);
  setTimeout(() => floater.remove(), 900);
}

// ---- PARTICLES ----
function spawnParticles() {
  const container = document.getElementById('particles');
  const colors = ['#3ab5ff', '#9d4eff', '#00f5ff', '#ff3a5e', '#ffd700'];
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.bottom = Math.random() * 20 + 'px';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDuration = (4 + Math.random() * 8) + 's';
      p.style.animationDelay = (Math.random() * 10) + 's';
      p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
      container.appendChild(p);
    }, i * 200);
  }
}

// ---- FORMAT NUMBER ----
function fmtNum(n) {
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Qa';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4)  return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
}

// ---- START ----
document.addEventListener('DOMContentLoaded', init);
