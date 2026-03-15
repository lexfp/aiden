    // ═══════════════════ EFFECTS ═══════════════════
    const particles = [], slashTrails = [], hitFlashes = [], dashTrails = [];
    function spawnParticle(pos, vel, color, size, lifetime) { const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }); const m = new THREE.Mesh(new THREE.SphereGeometry(size, 4, 4), mat); m.position.copy(pos); scene.add(m); particles.push({ mesh: m, velocity: vel.clone(), lifetime, maxLifetime: lifetime, gravity: -8 }); }
    function updateParticles(dt) { for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.lifetime -= dt; if (p.lifetime <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); particles.splice(i, 1); continue; } p.velocity.y += p.gravity * dt; p.mesh.position.addScaledVector(p.velocity, dt); p.mesh.material.opacity = p.lifetime / p.maxLifetime; p.mesh.scale.setScalar(p.lifetime / p.maxLifetime); } }
    function spawnSlashTrail(pos, rot, color, scale) {
      // Main arc slash
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8 * scale, 1.1 * scale), mat);
      m.position.copy(pos).add(new THREE.Vector3(-Math.sin(rot) * 2.2, 1.6, -Math.cos(rot) * 2.2));
      m.rotation.y = rot; m.rotation.z = (Math.random() - 0.5) * 0.6;
      scene.add(m); slashTrails.push({ mesh: m, lifetime: 0.35, maxLifetime: 0.35 });
      // Second thinner trail offset
      const mat2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      const m2 = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * scale, 0.45 * scale), mat2);
      m2.position.copy(pos).add(new THREE.Vector3(-Math.sin(rot) * 2, 2.1, -Math.cos(rot) * 2));
      m2.rotation.y = rot; m2.rotation.z = (Math.random() - 0.5) * 0.4;
      scene.add(m2); slashTrails.push({ mesh: m2, lifetime: 0.25, maxLifetime: 0.25 });
      // Spark burst
      const sc = new THREE.Color(color).getHex();
      for (let i = 0; i < 10; i++) {
        spawnParticle(m.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.5)),
          new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 5, (Math.random() - 0.5) * 9),
          sc, 0.07 + Math.random() * 0.09, 0.28 + Math.random() * 0.28);
      }
      // Point light flash
      const fl = new THREE.PointLight(sc, 5, 7); fl.position.copy(m.position); scene.add(fl); setTimeout(() => scene.remove(fl), 100);
    }
    function updateSlashTrails(dt) {
      for (let i = slashTrails.length - 1; i >= 0; i--) { const s = slashTrails[i]; s.lifetime -= dt; if (s.lifetime <= 0) { scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); slashTrails.splice(i, 1); continue; } const t = s.lifetime / s.maxLifetime; s.mesh.material.opacity = t * 0.9; s.mesh.scale.x = 1 + (1 - t) * 0.7; s.mesh.scale.y = 1 + (1 - t) * 0.3; }
    }
    function spawnHitFlash(pos, color, scale) {
      // Sphere burst
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 1, depthWrite: false });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5 * scale, 8, 8), mat);
      m.position.copy(pos); scene.add(m); hitFlashes.push({ mesh: m, lifetime: 0.22, maxLifetime: 0.22 });
      // Ring
      const rmat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.8, depthWrite: false, wireframe: false });
      const rm = new THREE.Mesh(new THREE.TorusGeometry(0.55 * scale, 0.07, 6, 20), rmat);
      rm.position.copy(pos); rm.rotation.x = Math.PI / 2; scene.add(rm);
      hitFlashes.push({ mesh: rm, lifetime: 0.3, maxLifetime: 0.3 });
      const fl = new THREE.PointLight(new THREE.Color(color).getHex(), 5, 10); fl.position.copy(pos); scene.add(fl); setTimeout(() => scene.remove(fl), 130);
    }
    function updateHitFlashes(dt) {
      for (let i = hitFlashes.length - 1; i >= 0; i--) { const h = hitFlashes[i]; h.lifetime -= dt; if (h.lifetime <= 0) { scene.remove(h.mesh); h.mesh.geometry.dispose(); h.mesh.material.dispose(); hitFlashes.splice(i, 1); continue; } const t = h.lifetime / h.maxLifetime; h.mesh.material.opacity = t; h.mesh.scale.setScalar(1 + (1 - t) * 4); }
    }
    function spawnDashTrail(pos) {
      const col = playerTech ? playerTech.hex : 0xcc66ff;
      for (let i = 0; i < 12; i++) {
        const sz = 0.08 + Math.random() * 0.12;
        const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false });
        const m = new THREE.Mesh(new THREE.SphereGeometry(sz, 4, 4), mat);
        m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.4 + Math.random() * 2.2, (Math.random() - 0.5) * 0.9));
        scene.add(m); dashTrails.push({ mesh: m, lifetime: 0.45 + Math.random() * 0.25, maxLifetime: 0.7, velocity: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3) });
      }
      // Flash light
      const fl = new THREE.PointLight(col, 8, 14); fl.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0)); scene.add(fl); setTimeout(() => scene.remove(fl), 120);
    }
    function updateDashTrails(dt) {
      for (let i = dashTrails.length - 1; i >= 0; i--) { const d = dashTrails[i]; d.lifetime -= dt; if (d.lifetime <= 0) { scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); dashTrails.splice(i, 1); continue; } d.mesh.position.addScaledVector(d.velocity, dt); d.mesh.material.opacity = (d.lifetime / d.maxLifetime) * 0.8; d.mesh.scale.setScalar(d.lifetime / d.maxLifetime); }
    }
    function spawnCursedBurst(pos, rot) {
      const col = playerTech ? playerTech.hex : 0x8844ff;
      const fw = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
      // Central ring
      const rg = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.22, 8, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false }));
      rg.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(fw, 2.2); rg.rotation.x = Math.PI / 2; scene.add(rg); hitFlashes.push({ mesh: rg, lifetime: 0.65, maxLifetime: 0.65 });
      // Second outer ring
      const rg2 = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.1, 6, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false }));
      rg2.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(fw, 2); rg2.rotation.x = Math.PI / 2; scene.add(rg2); hitFlashes.push({ mesh: rg2, lifetime: 0.45, maxLifetime: 0.45 });
      // Wave
      const wm = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
      wm.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(fw, 3); wm.rotation.y = rot; scene.add(wm); hitFlashes.push({ mesh: wm, lifetime: 0.4, maxLifetime: 0.4 });
      // Particles
      for (let i = 0; i < 35; i++) { const d = fw.clone().multiplyScalar(3 + Math.random() * 9); d.x += (Math.random() - 0.5) * 7; d.y += Math.random() * 6; d.z += (Math.random() - 0.5) * 7; spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.6, 0)), d, col, 0.1 + Math.random() * 0.22, 0.5 + Math.random() * 0.6); }
      const fl = new THREE.PointLight(col, 12, 25); fl.position.copy(pos).add(new THREE.Vector3(0, 2.2, 0)); scene.add(fl); setTimeout(() => scene.remove(fl), 350);
    }
    function spawnTechFX(pos, color, range, type) { if (type === 'burst' || type === 'wave') { const m = new THREE.Mesh(new THREE.TorusGeometry(Math.min(range * 0.5, 5), 0.22, 8, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })); m.position.copy(pos); m.rotation.x = Math.PI / 2; scene.add(m); hitFlashes.push({ mesh: m, lifetime: 0.5, maxLifetime: 0.5 }); } if (type === 'ring' || type === 'wave') { const m = new THREE.Mesh(new THREE.PlaneGeometry(range * 1.5, range * 1.5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })); m.position.copy(pos); m.rotation.x = Math.PI / 2; scene.add(m); hitFlashes.push({ mesh: m, lifetime: 0.4, maxLifetime: 0.4 }); } for (let i = 0; i < 18; i++)spawnParticle(pos.clone(), new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10), color, 0.11 + Math.random() * 0.11, 0.6 + Math.random() * 0.4); const fl = new THREE.PointLight(color, 6, 20); fl.position.copy(pos); scene.add(fl); setTimeout(() => scene.remove(fl), 300); }
    function spawnEnergyPts() { if (Math.random() > 0.3 || player.energy < 20) return; const col = playerTech ? playerTech.hex : 0x6633cc; const pos = player.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 3, (Math.random() - 0.5) * 2)); spawnParticle(pos, new THREE.Vector3((Math.random() - 0.5) * 0.5, 1 + Math.random(), (Math.random() - 0.5) * 0.5), col, 0.05 + Math.random() * 0.05, 0.5 + Math.random() * 0.5); }