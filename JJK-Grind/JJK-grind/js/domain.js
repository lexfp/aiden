    // ═══════════════════ DOMAIN ═══════════════════
    const domain = { active: false, timer: 0, max: 10, meshes: [], savedFog: null, savedBg: null };
    function activateDomain(tech) {
      if (domain.active) return;
      domain.active = true; domain.timer = domain.max;
      domain.savedFog = scene.fog.clone(); domain.savedBg = scene.background.clone();
      domain.meshes = [];
      scene.fog = new THREE.FogExp2(tech.domainFog, 0.025); scene.background = new THREE.Color(tech.domainBg);
      const sp = new THREE.Mesh(new THREE.SphereGeometry(58, 14, 14), new THREE.MeshBasicMaterial({ color: tech.hex, transparent: true, opacity: 0.1, side: THREE.BackSide, depthWrite: false }));
      sp.position.copy(player.group.position); scene.add(sp); domain.meshes.push({ mesh: sp, type: 'sphere' });
      buildDomainGeo(tech);
      const dl = new THREE.PointLight(tech.hex, 18, 85); dl.position.copy(player.group.position).add(new THREE.Vector3(0, 3, 0)); scene.add(dl);
      domain.meshes.push({ mesh: dl, type: 'light', si: 18 });
      // Announce
      const an = document.getElementById('domain-ann');
      an.innerHTML = `DOMAIN EXPANSION<br><span style="font-size:14px;letter-spacing:3px;opacity:0.8">${tech.domainName}</span>`;
      an.style.color = tech.color; an.style.textShadow = '0 0 20px ' + tech.color;
      an.classList.remove('show'); void an.offsetWidth; an.classList.add('show');
      document.getElementById('domain-bar').style.background = tech.color;
      for (let i = 0; i < 90; i++)spawnParticle(player.group.position.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3((Math.random() - 0.5) * 22, Math.random() * 12, (Math.random() - 0.5) * 22), tech.hex, 0.16 + Math.random() * 0.18, 2 + Math.random());
      enemies.forEach(e => { if (e.dead) return; const d = new THREE.Vector3().subVectors(e.group.position, player.group.position).normalize(); damageEnemy(e, Math.floor(tech.moves[3].dmg * player.damageBonus), 28, d); });
      // Also hit PvP bots
      pvpBots.forEach(b => { if (b.dead || b.inSafeZone) return; const d = new THREE.Vector3().subVectors(b.group.position, player.group.position).normalize(); damagePvpBot(b, Math.floor(tech.moves[3].dmg * 0.6), 20, d); });
      gainMastery(5); addKillMsg(`⚔ DOMAIN EXPANSION: ${tech.domainName}!`, '#ffaa44');
    }
    function buildDomainGeo(t) {
      const c = player.group.position.clone();
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2, r = 9 + Math.random() * 14;
        const pos = new THREE.Vector3(c.x + Math.cos(ang) * r, Math.random() * 8, c.z + Math.sin(ang) * r);
        let geo, mat;
        if (t.id === 'limitless') { geo = new THREE.TorusGeometry(0.8 + Math.random() * 0.8, 0.06, 6, 24); mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }); }
        else if (t.id === 'disasterFlames') { geo = new THREE.ConeGeometry(0.3 + Math.random() * 0.4, 2 + Math.random() * 3, 4); mat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.6, depthWrite: false }); }
        else if (t.id === 'iceFormation') { geo = new THREE.ConeGeometry(0.2, 1.5 + Math.random() * 2, 4); mat = new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.7, depthWrite: false }); }
        else if (t.id === 'tenShadows') { geo = new THREE.ConeGeometry(0.3 + Math.random() * 0.4, 4 + Math.random() * 4, 3); mat = new THREE.MeshBasicMaterial({ color: 0x001133, transparent: true, opacity: 0.8, depthWrite: false }); }
        else { geo = new THREE.SphereGeometry(0.3 + Math.random() * 0.5, 4, 4); mat = new THREE.MeshBasicMaterial({ color: t.hex, transparent: true, opacity: 0.5, depthWrite: false }); }
        const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.userData = { sy: pos.y, fs: 0.5 + Math.random(), fo: Math.random() * Math.PI * 2 };
        scene.add(m); domain.meshes.push({ mesh: m, type: 'decor' });
      }
    }
    function updateDomain(dt) {
      if (!domain.active) return;
      domain.timer -= dt;
      document.getElementById('domain-bar').style.width = (Math.max(0, domain.timer / domain.max) * 100) + '%';
      if (domain.timer <= 0) { collapseDomain(); return; }
      const pct = domain.timer / domain.max;
      if (Math.floor(domain.timer * 2) !== Math.floor((domain.timer + dt) * 2)) {
        enemies.forEach(e => { if (e.dead) return; if (e.group.position.distanceTo(player.group.position) < 40) damageEnemy(e, Math.floor(8 * player.damageBonus), 0, new THREE.Vector3(0, 0, 1)); });
        pvpBots.forEach(b => { if (b.dead) return; if (b.group.position.distanceTo(player.group.position) < 40) damagePvpBot(b, 6, 0, new THREE.Vector3(0, 0, 1)); });
      }
      domain.meshes.forEach(({ mesh, type, si }) => {
        if (type === 'sphere') { mesh.material.opacity = 0.08 + pct * 0.06; mesh.rotation.y += dt * 0.1; }
        else if (type === 'decor') { mesh.position.y = mesh.userData.sy + Math.sin(elapsed * mesh.userData.fs + mesh.userData.fo) * 0.8; mesh.rotation.y += dt * 0.5; mesh.material.opacity = pct * 0.6; }
        else if (type === 'light') mesh.intensity = si * pct * 0.5;
      });
    }
    function collapseDomain() {
      domain.active = false; domain.meshes.forEach(({ mesh }) => scene.remove(mesh)); domain.meshes = [];
      scene.fog = domain.savedFog; scene.background = domain.savedBg;
      document.getElementById('domain-bar').style.width = '0%';
    }
