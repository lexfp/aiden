    // ═══════════════════ COINS & REWARDS ═══════════════════
    function initCoins() { if (!player.coins) player.coins = 0; if (!player.upgrades) player.upgrades = { hp: 0, energy: 0, speed: 0, damage: 0, regen: 0 }; }
    function addCoins(amt) { player.coins = (player.coins || 0) + amt; updateCoinsUI(); }
    function updateCoinsUI() { document.getElementById('coins-val').textContent = player.coins || 0; }
    function spawnCoinPickup(pos) {
      const sp = pos.clone().project(camera); if (sp.z > 1) return;
      const x = (sp.x * 0.5 + 0.5) * innerWidth, y = (-sp.y * 0.5 + 0.5) * innerHeight;
      const el = document.createElement('div'); el.className = 'coin-pickup'; el.textContent = '+🪙';
      el.style.left = x + 'px'; el.style.top = y + 'px';
      document.getElementById('ui').appendChild(el); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1000);
    }

    // ═══════════════════ SKILL TREE / UPGRADES ═══════════════════
    const SKILL_DEFS = [
      { id: 'hp', name: 'MAX HP', desc: '+10 HP', cost: 50, costMult: 1.5, max: 20, apply: (lvl) => { player.maxHealth = 100 + lvl * 10; player.health = Math.min(player.health, player.maxHealth); } },
      { id: 'energy', name: 'MAX ENERGY', desc: '+5 Energy', cost: 40, costMult: 1.4, max: 20, apply: (lvl) => { player.maxEnergy = 100 + lvl * 5; } },
      { id: 'speed', name: 'MOVE SPEED', desc: '+0.5 Speed', cost: 60, costMult: 1.6, max: 15, apply: (lvl) => { player.speed = 12 + lvl * 0.5; } },
      { id: 'damage', name: 'DAMAGE', desc: '+3% DMG', cost: 75, costMult: 1.7, max: 20, apply: (lvl) => {/* applied in damageBonus calc */ } },
      { id: 'regen', name: 'ENERGY REGEN', desc: '+1 Regen', cost: 45, costMult: 1.4, max: 15, apply: (lvl) => { player.energyRegen = 8 + lvl; } },
    ];
    function getSkillCost(skill) {
      const lvl = (player.upgrades || {})[skill.id] || 0;
      return Math.floor(skill.cost * Math.pow(skill.costMult, lvl));
    }
    function buySkill(skillId) {
      const skill = SKILL_DEFS.find(s => s.id === skillId); if (!skill) return;
      if (!player.upgrades) player.upgrades = { hp: 0, energy: 0, speed: 0, damage: 0, regen: 0 };
      const lvl = player.upgrades[skillId] || 0;
      if (lvl >= skill.max) { showMasteryNotif('⚠ Max level reached'); return; }
      const cost = getSkillCost(skill);
      if ((player.coins || 0) < cost) { showMasteryNotif('⚠ Not enough coins (' + cost + ' 🪙)'); return; }
      player.coins -= cost; player.upgrades[skillId] = (lvl + 1);
      skill.apply(player.upgrades[skillId]);
      updateCoinsUI(); buildSkillGrid(); updateBarsUI();
      showMasteryNotif('⬆ ' + skill.name + ' upgraded to Lv.' + (lvl + 1));
    }
    function applyAllUpgrades() {
      if (!player.upgrades) return;
      SKILL_DEFS.forEach(s => { const lvl = player.upgrades[s.id] || 0; if (lvl > 0) s.apply(lvl); });
    }
    function buildSkillGrid() {
      const grid = document.getElementById('skill-grid'); if (!grid) return; grid.innerHTML = '';
      if (!player.upgrades) player.upgrades = { hp: 0, energy: 0, speed: 0, damage: 0, regen: 0 };
      SKILL_DEFS.forEach(s => {
        const lvl = player.upgrades[s.id] || 0; const cost = getSkillCost(s); const maxed = lvl >= s.max;
        const node = document.createElement('div'); node.className = 'skill-node';
        node.innerHTML = `<div class="sn-name">${s.name}</div><div class="sn-lvl">Lv.${lvl}/${s.max} · ${s.desc}</div><div class="sn-cost">${maxed ? 'MAXED' : cost + ' 🪙'}</div>`;
        if (!maxed) node.onclick = () => buySkill(s.id);
        else node.style.borderColor = 'rgba(68,255,170,0.4)';
        grid.appendChild(node);
      });
      document.getElementById('hp-coins').textContent = (player.coins || 0) + ' 🪙';
    }
