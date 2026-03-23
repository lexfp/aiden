// ═══════════════════ SYSTEM NOTIFICATIONS ═══════════════════

const systemQueue = [];
let activeSystemNotif = null;
let systemNotifTimer = 0;

function systemNotify(text, color, duration) {
  systemQueue.push({ text, color: color || COLORS.systemBorder, duration: duration || 2.5 });
}

function updateSystemNotifs(dt) {
  if (activeSystemNotif) {
    systemNotifTimer -= dt;
    if (systemNotifTimer <= 0) {
      activeSystemNotif = null;
    }
  }
  if (!activeSystemNotif && systemQueue.length > 0) {
    activeSystemNotif = systemQueue.shift();
    systemNotifTimer = activeSystemNotif.duration;
    const el = document.getElementById('system-notif');
    el.querySelector('.sn-text').textContent = activeSystemNotif.text;
    el.style.borderColor = activeSystemNotif.color;
    el.querySelector('.sn-header').style.color = activeSystemNotif.color;
    el.classList.remove('sn-hide');
    el.classList.add('sn-show');
    setTimeout(() => {
      el.classList.remove('sn-show');
      el.classList.add('sn-hide');
    }, (activeSystemNotif.duration - 0.4) * 1000);
  }
}

function showBossAnnounce(name) {
  const el = document.getElementById('boss-announce');
  el.querySelector('.ba-name').textContent = name;
  el.classList.add('ba-show');
  setTimeout(() => el.classList.remove('ba-show'), 3000);
}

function showAriseNotif() {
  const el = document.getElementById('arise-notif');
  el.classList.add('arise-show');
  setTimeout(() => el.classList.remove('arise-show'), 2500);
}

function showDmgNumber(x, y, dmg, crit, camX) {
  const el = document.createElement('div');
  el.className = 'dmg-number' + (crit ? ' crit' : '');
  el.textContent = dmg;
  el.style.left = (x - camX) + 'px';
  el.style.top = y + 'px';
  document.getElementById('dmg-layer').appendChild(el);
  setTimeout(() => el.remove(), 800);
}
