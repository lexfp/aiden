    // ═══════════════════ SAVE / LOAD SYSTEM ═══════════════════
    const SAVE_KEY = 'cursedRealm_save';
    function saveGame() {
      if (!gameStarted || !playerTech) return;
      const data = {
        name: player.name, level: player.level, xp: player.xp, xpToNext: player.xpToNext,
        health: player.health, maxHealth: player.maxHealth, energy: player.energy, maxEnergy: player.maxEnergy,
        energyRegen: player.energyRegen, speed: player.speed, damageBonus: player.damageBonus,
        techId: playerTech.id, techMastery: techMastery,
        kills: totalKills, pvpWins: pvpWins, pvpLosses: pvpLosses,
        avatar: { hairColor: AC.hairColor, hairStyle: AC.hairStyle, skinColor: AC.skinColor, outfitColor: AC.outfitColor, eyeColor: AC.eyeColor },
        coins: player.coins || 0, upgrades: player.upgrades || { hp: 0, energy: 0, speed: 0, damage: 0, regen: 0 },
        statPoints: player.statPoints || 0, stats: player.stats || { hp:0, dmg:0, energy:0, speed:0 },
        timestamp: Date.now()
      };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { }
    }
    function loadGame() {
      try {
        const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    }
    function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
    function deleteSave() { localStorage.removeItem(SAVE_KEY); }
    function applySaveData(data) {
      player.name = data.name || 'Sorcerer'; player.level = data.level || 1; player.xp = data.xp || 0;
      player.xpToNext = data.xpToNext || 100; player.health = data.health || 100; player.maxHealth = data.maxHealth || 100;
      player.energy = data.energy || 100; player.maxEnergy = data.maxEnergy || 100;
      player.energyRegen = data.energyRegen || 8; player.speed = data.speed || 12; player.damageBonus = data.damageBonus || 1;
      totalKills = data.kills || 0; pvpWins = data.pvpWins || 0; pvpLosses = data.pvpLosses || 0;
      player.coins = data.coins || 0; player.upgrades = data.upgrades || { hp: 0, energy: 0, speed: 0, damage: 0, regen: 0 };
      player.statPoints = data.statPoints === undefined ? 0 : data.statPoints; player.stats = data.stats || { hp:0, dmg:0, energy:0, speed:0 };
      
      // Retroactive point grant for older saves
      const usedStats = player.stats.hp + player.stats.dmg + player.stats.energy + player.stats.speed;
      if (player.statPoints === 0 && usedStats === 0 && player.level > 1) {
        player.statPoints = (player.level - 1) * 3;
      }
      
      if (data.avatar) { AC.hairColor = data.avatar.hairColor; AC.hairStyle = data.avatar.hairStyle; AC.skinColor = data.avatar.skinColor; AC.outfitColor = data.avatar.outfitColor; AC.eyeColor = data.avatar.eyeColor; }
      const tech = TECHNIQUES.find(t => t.id === data.techId);
      if (tech) { playerTech = tech; techMastery = data.techMastery || 0; techMoveCDs = new Array(tech.moves.length).fill(0); }
    }
    function autoSave() { setInterval(() => { if (gameStarted) { saveGame(); showSaveIndicator(); } }, 30000); }
    function showSaveIndicator() { const el = document.getElementById('save-indicator'); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2000); }
    function newGame() { if (confirm('Delete save and start fresh?')) { deleteSave(); location.reload(); } }
    function loadAndStart() {
      const data = loadGame(); if (!data) return;
      applySaveData(data);
      document.getElementById('title-screen').style.opacity = '0';
      setTimeout(() => { document.getElementById('title-screen').style.display = 'none'; startGame(); }, 600);
    }
    // Save on tab close
    window.addEventListener('beforeunload', () => { if (gameStarted) saveGame(); });
    // Check for existing save on load
    window.addEventListener('DOMContentLoaded', () => {
      if (hasSave()) {
        document.getElementById('continue-btn').style.display = 'block';
        document.getElementById('newgame-btn').style.display = 'block';
      } else {
        document.getElementById('newgame-btn').style.display = 'none';
      }
    });
