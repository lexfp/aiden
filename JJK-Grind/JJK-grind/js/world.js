    // ═══════════════════ WORLD / ISLANDS ═══════════════════
    const ISLANDS = [
      { name: 'TOKYO METROPOLIS', x: 0, z: 0, w: 160, d: 160, theme: 'city', lightCol: 0xaaaaee, floorCol: 0x2a2a35, safe: true },
      { name: 'BAMBOO FOREST', x: 220, z: 0, w: 140, d: 140, theme: 'forest', lightCol: 0xaaff88, floorCol: 0x263c1a, safe: false },
      { name: 'VOLCANIC CRATER', x: -220, z: 0, w: 140, d: 140, theme: 'fire', lightCol: 0xff4400, floorCol: 0x1a0500, safe: false },
      { name: 'DESERT RUINS', x: 0, z: -220, w: 140, d: 140, theme: 'desert', lightCol: 0xffddaa, floorCol: 0xaa8844, safe: false },
      { name: 'FROST PEAK', x: 0, z: 220, w: 140, d: 140, theme: 'snow', lightCol: 0xddffff, floorCol: 0xbbddee, safe: false },
      { name: 'CURSED SWAMP', x: 180, z: 180, w: 120, d: 120, theme: 'swamp', lightCol: 0x662288, floorCol: 0x100a1f, safe: false },
    ];
    const SAFE_ISLAND = ISLANDS[0];
    const SAFE_RADIUS = 75;

    const BRIDGES = [];
    function isInSafeZone(px, pz) { return Math.abs(px - SAFE_ISLAND.x) < SAFE_RADIUS && Math.abs(pz - SAFE_ISLAND.z) < SAFE_RADIUS; }
    function isOnIsland(px, pz) { for (const isl of ISLANDS) { if (Math.abs(px - isl.x) < isl.w / 2 && Math.abs(pz - isl.z) < isl.d / 2) return isl; } return null; }
    function isOnBridge(px, pz) {
      for (const b of BRIDGES) {
        const dx = px - b.x, dz = pz - b.z;
        const cos = Math.cos(-b.angle), sin = Math.sin(-b.angle);
        const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
        if (Math.abs(lx) < b.w / 2 && Math.abs(lz) < b.len / 2) return true;
      }
      return false;
    }
    function isGrounded(px, pz) { return isOnIsland(px, pz) !== null || isOnBridge(px, pz); }
    function getCurrentZone(px, pz) { const isl = isOnIsland(px, pz); return isl ? isl.name : (isOnBridge(px, pz) ? 'CONNECTING BRIDGE' : 'VOID'); }

    const floatingRocks = [], worldLights = [];
    let dustPts = null; const DUST_CNT = 350;
    let sunLight, ambientLight;

    function buildWorld() {
      if (typeof initPbrEnvironment === 'function') initPbrEnvironment(scene, renderer);
      ambientLight = new THREE.AmbientLight(0x111122, 0.6);
      scene.add(ambientLight);
      sunLight = new THREE.DirectionalLight(0x6666ff, 0.7);
      sunLight.position.set(-30, 50, -20); sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024); 
      sunLight.shadow.camera.left = -250; sunLight.shadow.camera.right = 250;
      sunLight.shadow.camera.top = 250; sunLight.shadow.camera.bottom = -250; 
      sunLight.shadow.bias = -0.001;
      scene.add(sunLight);

      ISLANDS.forEach(isl => {
        // Platform
        const geo = new THREE.BoxGeometry(isl.w, 3, isl.d);
        const mat = new THREE.MeshStandardMaterial({ color: isl.floorCol, roughness: 0.85, metalness: 0.1 });
        const mesh = new THREE.Mesh(geo, mat); mesh.position.set(isl.x, -1.5, isl.z); mesh.receiveShadow = true; scene.add(mesh);
        // Grid
        const grid = new THREE.GridHelper(Math.min(isl.w, isl.d) - 2, Math.floor((Math.min(isl.w, isl.d) - 2) / 3),
          new THREE.Color(isl.lightCol).multiplyScalar(0.4).getHex(), new THREE.Color(isl.lightCol).multiplyScalar(0.15).getHex());
        grid.position.set(isl.x, 0.01, isl.z); scene.add(grid);
        // Island light
        const pl = new THREE.PointLight(isl.lightCol, 2.5, 35); pl.position.set(isl.x, 9, isl.z); scene.add(pl);
        worldLights.push({ light: pl, base: 2.5, phase: Math.random() * Math.PI * 2 });
        // Corner pillars
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([cx, cz]) => {
          const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3.5, 6), new THREE.MeshStandardMaterial({ color: 0x151525, roughness: 0.5, metalness: 0.5 }));
          pm.position.set(isl.x + cx * (isl.w / 2 - 1.2), 1.75, isl.z + cz * (isl.d / 2 - 1.2)); pm.castShadow = true; scene.add(pm);
          const rm = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 6, 16), new THREE.MeshBasicMaterial({ color: isl.lightCol }));
          rm.position.set(isl.x + cx * (isl.w / 2 - 1.2), 3.6, isl.z + cz * (isl.d / 2 - 1.2)); rm.rotation.x = Math.PI / 2; scene.add(rm);
        });
        buildIslandDecor(isl);
      });

      // Build Bridges
      ISLANDS.forEach(isl => {
        if (isl.safe) return; // Skip center island connecting to itself
        const dist = Math.sqrt(isl.x*isl.x + isl.z*isl.z);
        const angle = Math.atan2(isl.x, isl.z);
        const bw = 14, bLen = dist;
        const bx = isl.x / 2, bz = isl.z / 2;
        
        BRIDGES.push({ x: bx, z: bz, w: bw, len: bLen, angle: angle });

        const bGeo = new THREE.BoxGeometry(bw, 2, bLen);
        const bMat = new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.9, metalness: 0.1 });
        const bridge = new THREE.Mesh(bGeo, bMat);
        bridge.position.set(bx, -1.0, bz);
        bridge.rotation.y = angle;
        bridge.receiveShadow = true; bridge.castShadow = true;
        scene.add(bridge);

        // Bridge lanterns (visual-only pillars, no PointLights to save draw calls)
        const numLights = Math.floor(bLen / 50);
        for (let j = 1; j < numLights; j++) {
           const t = j / numLights;
           const lx = isl.x * t, lz = isl.z * t;
           const pm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 1.5), new THREE.MeshStandardMaterial({color: 0x111118}));
           pm.position.set(lx, 2, lz); scene.add(pm);
           // Use a tiny emissive bulb instead of a real PointLight
           const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 6), new THREE.MeshBasicMaterial({color: 0xffaa55}));
           bulb.position.set(lx, 4.5, lz); scene.add(bulb);
        }
      });

      // Floating rocks between islands
      for (let i = 0; i < 12; i++) {
        const sz = 0.4 + Math.random() * 1.8;
        const geo = new THREE.DodecahedronGeometry(sz, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x101020, roughness: 0.7, metalness: 0.2 });
        const r = new THREE.Mesh(geo, mat);
        const ang = Math.random() * Math.PI * 2, d = 35 + Math.random() * 22;
        r.position.set(Math.cos(ang) * d, 4 + Math.random() * 18, Math.sin(ang) * d);
        r.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        r.userData = { fs: 0.3 + Math.random() * 0.5, fo: Math.random() * Math.PI * 2, by: r.position.y };
        r.castShadow = true; scene.add(r); floatingRocks.push(r);
      }
      // Dust
      const dg = new THREE.BufferGeometry(); const dp = new Float32Array(180 * 3);
      for (let i = 0; i < 180; i++) { dp[i * 3] = (Math.random() - 0.5) * 100; dp[i * 3 + 1] = Math.random() * 20; dp[i * 3 + 2] = (Math.random() - 0.5) * 100; }
      dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      dustPts = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x6644aa, size: 0.12, transparent: true, opacity: 0.3 }));
      scene.add(dustPts);
      const DUST_CNT_ACT = 180;
    }

    function buildIslandDecor(isl) {
      const { x, z, theme, w, d } = isl;
      const hw = w/2 - 4, hd = d/2 - 4; // spawn bounds

      if (theme === 'city') {
        // Safe zone dome indicator showing domain edges
        const dr = new THREE.Mesh(new THREE.TorusGeometry(SAFE_RADIUS, 0.25, 6, 60), new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.25, depthWrite: false }));
        dr.position.set(x, 0.1, z); dr.rotation.x = Math.PI / 2; scene.add(dr);
        // City buildings (tall blocky towers)
        for (let i = 0; i < 35; i++) {
          const bw = 4 + Math.random() * 8, bd = 4 + Math.random() * 8, bh = 15 + Math.random() * 40;
          const px = x + (Math.random() - 0.5) * hw * 1.8, pz = z + (Math.random() - 0.5) * hd * 1.8;
          if (isInSafeZone(px, pz) && Math.sqrt((px-x)**2 + (pz-z)**2) < 25) continue; // Keep center clear
          const bldg = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.6, metalness: 0.3 }));
          bldg.position.set(px, bh/2, pz); scene.add(bldg);
        }
        // NPC Sorcerer guards near center
        for (let i = 0; i < 4; i++) {
            const ang = (i/4) * Math.PI*2;
            buildStaticSorcerer(x + Math.cos(ang)*20, z + Math.sin(ang)*20, 0x111111, 0x44ccff);
        }
      } else if (theme === 'forest') {
        // Bamboo / Trees
        for (let i = 0; i < 60; i++) {
          const px = x + (Math.random() - 0.5) * hw * 1.8, pz = z + (Math.random() - 0.5) * hd * 1.8;
          const bh = 10 + Math.random() * 15;
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, bh, 5), new THREE.MeshStandardMaterial({ color: 0x338833, roughness: 0.9 }));
          m.position.set(px, bh/2, pz); m.rotation.z = (Math.random()-0.5)*0.1; scene.add(m);
        }
      } else if (theme === 'fire') {
        // Magma rocks
        for (let i = 0; i < 25; i++) {
          const geo = new THREE.DodecahedronGeometry(2 + Math.random()*3, 1);
          const mat = new THREE.MeshStandardMaterial({ color: 0x110300, roughness: 0.9, emissive: 0x440a00, emissiveIntensity: 0.8 });
          const m = new THREE.Mesh(geo, mat); m.position.set(x + (Math.random() - 0.5) * hw*1.8, 0.5, z + (Math.random() - 0.5) * hd*1.8);
          scene.add(m);
        }
      } else if (theme === 'snow') {
        // Ice spikes / Snowmen
        for (let i = 0; i < 40; i++) {
          const h = 4 + Math.random() * 8;
          const m = new THREE.Mesh(new THREE.ConeGeometry(1.5, h, 6), new THREE.MeshStandardMaterial({ color: 0xddffff, roughness: 0.2, metalness: 0.6, emissive: 0x88bbff, emissiveIntensity: 0.3 }));
          m.position.set(x + (Math.random() - 0.5) * hw*1.8, h / 2, z + (Math.random() - 0.5) * hd*1.8); scene.add(m);
        }
      } else if (theme === 'desert') {
        // Sand ruins & Pyramids
        for (let i = 0; i < 15; i++) {
          const h = 8 + Math.random() * 12;
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0, Math.random()*5 + 4, h, 4), new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.95 }));
          m.position.set(x + (Math.random() - 0.5) * hw*1.8, h / 2, z + (Math.random() - 0.5) * hd*1.8); m.rotation.y = Math.random() * Math.PI; scene.add(m);
        }
      } else if (theme === 'swamp') {
        // Swamp trees / dark monoliths
        for (let i = 0; i < 30; i++) {
          const h = 5 + Math.random() * 10;
          const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.5), new THREE.MeshStandardMaterial({ color: 0x0a0511, roughness: 0.8 }));
          m.position.set(x + (Math.random() - 0.5) * hw*1.8, h / 2, z + (Math.random() - 0.5) * hd*1.8); m.rotation.y = Math.random() * Math.PI; scene.add(m);
        }
      }
    }

    function buildStaticSorcerer(x, z, hairC, eyeC) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.45), new THREE.MeshStandardMaterial({ color: 0x111133, roughness: 0.5 }));
      body.position.y = 1.8; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0xeebb99, roughness: 0.6 }));
      head.position.y = 2.65; g.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 6), new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.7 }));
      hair.position.y = 2.72; hair.scale.set(1, 0.4, 1); g.add(hair);
      [-0.1, 0.1].forEach(ex => { const em = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 5), new THREE.MeshBasicMaterial({ color: eyeC })); em.position.set(ex, 2.67, 0.26); g.add(em); });
      // Floating glow orb above NPC
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: eyeC, transparent: true, opacity: 0.7 }));
      orb.position.y = 3.5; g.add(orb);
      g.position.set(x, 0, z); scene.add(g);
      return g;
    }
