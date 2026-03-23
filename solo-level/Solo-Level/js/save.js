// ═══════════════════ SAVE / LOAD ═══════════════════

const SAVE_KEY = 'solo_leveling_save';

function getDefaultState() {
  return {
    level: 1,
    xp: 0,
    stats: { STR: 5, AGI: 5, VIT: 5, INT: 5, PER: 5 },
    statPoints: 0,
    rank: 'E',
    clearedDungeons: [],
    highestDungeon: 0,
    totalKills: 0,
    shadows: 0
  };
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    showSaveIndicator();
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

function loadGame() {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return Object.assign(getDefaultState(), parsed);
    }
  } catch (e) {
    console.warn('Load failed:', e);
  }
  return null;
}

function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

function showSaveIndicator() {
  const el = document.getElementById('save-indicator');
  el.classList.add('si-show');
  setTimeout(() => el.classList.remove('si-show'), 1500);
}
