    // ═══════════════════ SCREEN FLOW ═══════════════════
    function goToAvatar() { const ts = document.getElementById('title-screen'); ts.style.opacity = '0'; setTimeout(() => { ts.style.display = 'none'; const av = document.getElementById('av-screen'); av.style.display = 'flex'; av.style.opacity = '0'; setTimeout(() => av.style.opacity = '1', 50); }, 600); setupAvatarScreen(); }
    function goToRoll() { const av = document.getElementById('av-screen'); player.name = document.getElementById('av-name').value || 'Sorcerer'; av.style.opacity = '0'; setTimeout(() => { av.style.display = 'none'; const rs = document.getElementById('roll-screen'); rs.style.display = 'flex'; rs.style.opacity = '0'; setTimeout(() => rs.style.opacity = '1', 50); buildRollStrip(); }, 600); }
    function startGame() {
      gameStarted = true;
      initCoins(); applyAllUpgrades();
      buildWorld(); createPlayerModel(); spawnInitialEnemies(); spawnPvpBots(); spawnChests();
      updateLevelUI(); updateTechUI(); updateCoinsUI();
      autoSave();
      renderer.domElement.requestPointerLock();
    }
