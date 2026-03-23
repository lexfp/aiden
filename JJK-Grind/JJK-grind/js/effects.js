    // ═══════════════════ EFFECTS ═══════════════════
    const particles = [], slashTrails = [], hitFlashes = [], dashTrails = [];
    const pPool = [], dtPool = [], stPool = [], hfPool = [], rPool = [];
    const baseSphereGeo = new THREE.SphereGeometry(1, 4, 4);
    const basePlaneGeo = new THREE.PlaneGeometry(1, 1);
    const baseTorusGeo = new THREE.TorusGeometry(1, 0.1, 6, 20);

    const lightPool = [];
    for(let i=0; i<15; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 0);
      scene.add(l);
      lightPool.push(l);
    }
    function getLight(pos, color, intensity, dist, timeMs) {
      if(lightPool.length > 0) {
        const l = lightPool.pop();
        l.color.setHex(color); l.intensity = intensity; l.distance = dist;
        l.position.copy(pos);
        setTimeout(() => { l.intensity = 0; lightPool.push(l); }, timeMs);
      }
    }

    function spawnParticle(pos, vel, color, size, lifetime) { 
      let m;
      if (pPool.length > 0) {
        m = pPool.pop();
        m.material.color.setHex(color);
        m.material.opacity = 1;
        m.visible = true;
      } else {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
        m = new THREE.Mesh(baseSphereGeo, mat);
        scene.add(m);
      }
      m.scale.setScalar(size);
      m.position.copy(pos); 
      particles.push({ mesh: m, velocity: vel.clone(), lifetime, maxLifetime: lifetime, gravity: -8, baseSize: size }); 
    }
    function updateParticles(dt) { 
        for (let i = particles.length - 1; i >= 0; i--) { 
            const p = particles[i]; p.lifetime -= dt; 
            if (p.lifetime <= 0) { 
                p.mesh.visible = false;
                if (p.isDebris && typeof debrisPool !== 'undefined') {
                  debrisPool.push(p.mesh);
                } else {
                  pPool.push(p.mesh);
                }
                particles.splice(i, 1); 
                continue; 
            } 
            p.velocity.y += p.gravity * dt; 
            p.mesh.position.addScaledVector(p.velocity, dt); 
            p.mesh.material.opacity = p.lifetime / p.maxLifetime; 
            p.mesh.scale.setScalar(p.baseSize * (p.lifetime / p.maxLifetime)); 
        } 
    }
    function getPlaneMesh(color, opacity) {
      if (stPool.length > 0) {
        const m = stPool.pop();
        m.material.color.setHex(color);
        m.material.opacity = opacity;
        m.visible = true;
        return m;
      }
      const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, side: THREE.DoubleSide, depthWrite: false });
      const m = new THREE.Mesh(basePlaneGeo, mat);
      scene.add(m);
      return m;
    }
    function spawnSlashTrail(pos, rot, color, scale) {
      // Main arc slash
      const cHex = new THREE.Color(color).getHex();
      const m = getPlaneMesh(cHex, 0.9);
      m.scale.set(2.8 * scale, 1.1 * scale, 1);
      m.position.copy(pos).add(new THREE.Vector3(-Math.sin(rot) * 2.2, 1.6, -Math.cos(rot) * 2.2));
      m.rotation.set(0, rot, (Math.random() - 0.5) * 0.6);
      slashTrails.push({ mesh: m, lifetime: 0.35, maxLifetime: 0.35, baseScaleX: 2.8 * scale, baseScaleY: 1.1 * scale });
      
      // Second thinner trail offset
      const c2Hex = new THREE.Color(color).multiplyScalar(1.4).getHex();
      const m2 = getPlaneMesh(c2Hex, 0.55);
      m2.scale.set(2.2 * scale, 0.45 * scale, 1);
      m2.position.copy(pos).add(new THREE.Vector3(-Math.sin(rot) * 2, 2.1, -Math.cos(rot) * 2));
      m2.rotation.set(0, rot, (Math.random() - 0.5) * 0.4);
      slashTrails.push({ mesh: m2, lifetime: 0.25, maxLifetime: 0.25, baseScaleX: 2.2 * scale, baseScaleY: 0.45 * scale });
      
      // Spark burst
      for (let i = 0; i < 10; i++) {
        spawnParticle(m.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.5)),
          new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 5, (Math.random() - 0.5) * 9),
          cHex, 0.07 + Math.random() * 0.09, 0.28 + Math.random() * 0.28);
      }
      getLight(m.position, cHex, 5, 7, 100);
    }
    function updateSlashTrails(dt) {
      for (let i = slashTrails.length - 1; i >= 0; i--) { 
        const s = slashTrails[i]; s.lifetime -= dt; 
        if (s.lifetime <= 0) { 
          s.mesh.visible = false;
          stPool.push(s.mesh);
          slashTrails.splice(i, 1); 
          continue; 
        } 
        const t = s.lifetime / s.maxLifetime; 
        s.mesh.material.opacity = t * 0.9; 
        s.mesh.scale.x = s.baseScaleX * (1 + (1 - t) * 0.7); 
        s.mesh.scale.y = s.baseScaleY * (1 + (1 - t) * 0.3); 
      }
    }
    function getTorusMesh(color, opacity, geom) {
      if (rPool.length > 0) {
        const m = rPool.pop();
        m.material.color.setHex(color);
        m.material.opacity = opacity;
        m.geometry = geom;
        m.visible = true;
        return m;
      }
      const rmat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false, wireframe: false });
      const rm = new THREE.Mesh(geom, rmat);
      scene.add(rm);
      return rm;
    }
    function spawnHitFlash(pos, color, scale) {
      // Sphere burst
      const cHex = new THREE.Color(color).getHex();
      let m;
      if (hfPool.length > 0) {
        m = hfPool.pop();
        m.material.color.setHex(cHex);
        m.material.opacity = 1;
        m.visible = true;
      } else {
        const mat = new THREE.MeshBasicMaterial({ color: cHex, transparent: true, opacity: 1, depthWrite: false });
        m = new THREE.Mesh(baseSphereGeo, mat);
        scene.add(m);
      }
      m.scale.setScalar(0.5 * scale);
      m.position.copy(pos); 
      hitFlashes.push({ mesh: m, lifetime: 0.22, maxLifetime: 0.22, baseScale: 0.5 * scale, isSphere: true });
      
      // Ring
      const rm = getTorusMesh(cHex, 0.8, baseTorusGeo);
      rm.scale.setScalar(scale);
      rm.position.copy(pos); rm.rotation.x = Math.PI / 2;
      hitFlashes.push({ mesh: rm, lifetime: 0.3, maxLifetime: 0.3, baseScale: scale, isSphere: false });
      
      getLight(pos, cHex, 5, 10, 130);
    }
    function updateHitFlashes(dt) {
      for (let i = hitFlashes.length - 1; i >= 0; i--) { 
        const h = hitFlashes[i]; h.lifetime -= dt; 
        if (h.lifetime <= 0) { 
          h.mesh.visible = false;
          if (h.isSphere) hfPool.push(h.mesh);
          else rPool.push(h.mesh);
          hitFlashes.splice(i, 1); 
          continue; 
        } 
        const t = h.lifetime / h.maxLifetime; 
        h.mesh.material.opacity = t; 
        h.mesh.scale.setScalar(h.baseScale * (1 + (1 - t) * 4)); 
      }
    }
    function spawnDashTrail(pos) {
      const col = playerTech ? playerTech.hex : 0xcc66ff;
      for (let i = 0; i < 12; i++) {
        const sz = 0.08 + Math.random() * 0.12;
        let m;
        if (dtPool.length > 0) {
          m = dtPool.pop();
          m.material.color.setHex(col);
          m.material.opacity = 0.8;
          m.visible = true;
        } else {
          const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false });
          m = new THREE.Mesh(baseSphereGeo, mat);
          scene.add(m);
        }
        m.scale.setScalar(sz);
        m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.4 + Math.random() * 2.2, (Math.random() - 0.5) * 0.9));
        dashTrails.push({ mesh: m, lifetime: 0.45 + Math.random() * 0.25, maxLifetime: 0.7, velocity: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3), baseSize: sz });
      }
      getLight(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), col, 8, 14, 120);
    }
    function updateDashTrails(dt) {
      for (let i = dashTrails.length - 1; i >= 0; i--) { 
        const d = dashTrails[i]; d.lifetime -= dt; 
        if (d.lifetime <= 0) { 
          d.mesh.visible = false;
          dtPool.push(d.mesh);
          dashTrails.splice(i, 1); 
          continue; 
        } 
        d.mesh.position.addScaledVector(d.velocity, dt); 
        d.mesh.material.opacity = (d.lifetime / d.maxLifetime) * 0.8; 
        d.mesh.scale.setScalar(d.baseSize * (d.lifetime / d.maxLifetime)); 
      }
    }
    // These specific large VFX create new geometries. We won't pool them extensively, but we replaced the PointLight.
    function spawnCursedBurst(pos, rot) {
      const col = playerTech ? playerTech.hex : 0x8844ff;
      const fw = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
      const rgGeometry = new THREE.TorusGeometry(2.2, 0.22, 8, 32);
      const rg = getTorusMesh(col, 0.9, rgGeometry);
      rg.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(fw, 2.2); rg.rotation.set(Math.PI / 2, 0, 0); rg.scale.set(1,1,1);
      hitFlashes.push({ mesh: rg, lifetime: 0.65, maxLifetime: 0.65, baseScale: 1, isSphere: false });
      
      const rg2Geometry = new THREE.TorusGeometry(3.5, 0.1, 6, 28);
      const rg2 = getTorusMesh(col, 0.5, rg2Geometry);
      rg2.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(fw, 2); rg2.rotation.set(Math.PI / 2, 0, 0); rg2.scale.set(1,1,1);
      hitFlashes.push({ mesh: rg2, lifetime: 0.45, maxLifetime: 0.45, baseScale: 1, isSphere: false });
      
      const wm = getPlaneMesh(col, 0.25);
      wm.scale.set(8, 8, 1);
      wm.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(fw, 3); wm.rotation.y = rot;
      hitFlashes.push({ mesh: wm, lifetime: 0.4, maxLifetime: 0.4, baseScale: 1, isSphere: true }); // Using sphere pool hack for Planes
      
      for (let i = 0; i < 35; i++) { const d = fw.clone().multiplyScalar(3 + Math.random() * 9); d.x += (Math.random() - 0.5) * 7; d.y += Math.random() * 6; d.z += (Math.random() - 0.5) * 7; spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.6, 0)), d, col, 0.1 + Math.random() * 0.22, 0.5 + Math.random() * 0.6); }
      getLight(pos.clone().add(new THREE.Vector3(0, 2.2, 0)), col, 12, 25, 350);
    }
    function spawnTechFX(pos, color, range, type) { 
      if (type === 'burst' || type === 'wave') { 
        const mGeometry = new THREE.TorusGeometry(Math.min(range * 0.5, 5), 0.22, 8, 32);
        const m = getTorusMesh(color, 0.9, mGeometry);
        m.position.copy(pos); m.rotation.set(Math.PI / 2, 0, 0); m.scale.set(1,1,1);
        hitFlashes.push({ mesh: m, lifetime: 0.5, maxLifetime: 0.5, baseScale: 1, isSphere: false }); 
      } 
      if (type === 'ring' || type === 'wave') { 
        const m = getPlaneMesh(color, 0.3);
        m.scale.set(range * 1.5, range * 1.5, 1);
        m.position.copy(pos); m.rotation.set(Math.PI / 2, 0, 0); 
        hitFlashes.push({ mesh: m, lifetime: 0.4, maxLifetime: 0.4, baseScale: 1, isSphere: true }); 
      } 
      for (let i = 0; i < 18; i++) spawnParticle(pos.clone(), new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10), color, 0.11 + Math.random() * 0.11, 0.6 + Math.random() * 0.4); 
      getLight(pos, color, 6, 20, 300); 
    }
    function spawnEnergyPts() { if (Math.random() > 0.3 || player.energy < 20) return; const col = playerTech ? playerTech.hex : 0x6633cc; const pos = player.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 3, (Math.random() - 0.5) * 2)); spawnParticle(pos, new THREE.Vector3((Math.random() - 0.5) * 0.5, 1 + Math.random(), (Math.random() - 0.5) * 0.5), col, 0.05 + Math.random() * 0.05, 0.5 + Math.random() * 0.5); }