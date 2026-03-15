    // ═══════════════════ WORLD / ISLANDS ═══════════════════
    const ISLANDS = [
      { name: 'SORCERER SHRINE', x: 0, z: 0, w: 52, d: 52, theme: 'shrine', lightCol: 0x88ffcc, floorCol: 0x0a0f10, safe: true },
      { name: 'CURSED VOID', x: 70, z: 0, w: 42, d: 42, theme: 'void', lightCol: 0x8844ff, floorCol: 0x0a0a18, safe: false },
      { name: 'VOLCANIC WASTE', x: -70, z: 0, w: 42, d: 42, theme: 'fire', lightCol: 0xff4400, floorCol: 0x1a0500, safe: false },
      { name: 'SHADOW MAW', x: 0, z: -70, w: 42, d: 42, theme: 'shadow', lightCol: 0x224488, floorCol: 0x050810, safe: false },
      { name: 'HEAVENLY SPIRE', x: 0, z: 70, w: 42, d: 42, theme: 'light', lightCol: 0xffffff, floorCol: 0x181822, safe: false },
      { name: 'SUNKEN COLISEUM', x: 62, z: 62, w: 36, d: 36, theme: 'ruins', lightCol: 0x664422, floorCol: 0x120d08, safe: false },
    ];
    const SAFE_ISLAND = ISLANDS[0];
    const SAFE_RADIUS = 30;

    function isInSafeZone(px, pz) { return Math.abs(px - SAFE_ISLAND.x) < SAFE_RADIUS && Math.abs(pz - SAFE_ISLAND.z) < SAFE_RADIUS; }
    function isOnIsland(px, pz) { for (const isl of ISLANDS) { if (Math.abs(px - isl.x) < isl.w / 2 && Math.abs(pz - isl.z) < isl.d / 2) return isl; } return null; }
    function getCurrentZone(px, pz) { const isl = isOnIsland(px, pz); return isl ? isl.name : 'VOID'; }

    const floatingRocks = [], worldLights = [];
    let dustPts = null; const DUST_CNT = 350;

    function buildWorld() {
      scene.add(new THREE.AmbientLight(0x111122, 0.6));
      const dir = new THREE.DirectionalLight(0x6666ff, 0.7);
      dir.position.set(-30, 50, -20); dir.castShadow = true;
      dir.shadow.mapSize.set(2048, 2048); dir.shadow.camera.left = -100; dir.shadow.camera.right = 100;
      dir.shadow.camera.top = 100; dir.shadow.camera.bottom = -100; dir.shadow.bias = -0.001;
      scene.add(dir);

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

      // Floating rocks between islands
      for (let i = 0; i < 22; i++) {
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
      const dg = new THREE.BufferGeometry(); const dp = new Float32Array(DUST_CNT * 3);
      for (let i = 0; i < DUST_CNT; i++) { dp[i * 3] = (Math.random() - 0.5) * 130; dp[i * 3 + 1] = Math.random() * 25; dp[i * 3 + 2] = (Math.random() - 0.5) * 130; }
      dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      dustPts = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x6644aa, size: 0.12, transparent: true, opacity: 0.3 }));
      scene.add(dustPts);
    }

    function buildIslandDecor(isl) {
      const { x, z, theme } = isl;
      if (theme === 'shrine') {
        // Central glowing altar
        const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x221144, roughness: 0.3, metalness: 0.7, emissive: 0x441188, emissiveIntensity: 0.4 }));
        altar.position.set(x, 0.75, z); scene.add(altar);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.7 }));
        orb.position.set(x, 2.2, z); orb.userData.isOrb = true; scene.add(orb);
        const al = new THREE.PointLight(0x44ffaa, 3, 18); al.position.set(x, 3, z); scene.add(al);
        // Safe zone dome ring
        const dr = new THREE.Mesh(new THREE.TorusGeometry(SAFE_RADIUS, 0.15, 6, 60), new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.35, depthWrite: false }));
        dr.position.set(x, 0.1, z); dr.rotation.x = Math.PI / 2; scene.add(dr);
        // Rune marks on floor
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const rm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 6), new THREE.MeshBasicMaterial({ color: 0x44ffaa }));
          rm.position.set(x + Math.cos(ang) * 12, 0.06, z + Math.sin(ang) * 12); scene.add(rm);
        }
        // NPC Sorcerer guards (static)
        for (let i = 0; i < 2; i++) { buildStaticSorcerer(x + (i === 0 ? -6 : 6), z, i === 0 ? 0x2244ff : 0xff4422, i === 0 ? 0x0055ff : 0xff2200); }
      } else if (theme === 'fire') {
        for (let i = 0; i < 6; i++) { const geo = new THREE.DodecahedronGeometry(0.9 + Math.random(), 0); const mat = new THREE.MeshStandardMaterial({ color: 0x330800, roughness: 0.9, emissive: 0x440a00, emissiveIntensity: 0.3 }); const m = new THREE.Mesh(geo, mat); m.position.set(x + (Math.random() - 0.5) * 30, 0.3, z + (Math.random() - 0.5) * 30); scene.add(m); }
      } else if (theme === 'shadow') {
        for (let i = 0; i < 5; i++) { const h = 3 + Math.random() * 5; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, h, 5), new THREE.MeshStandardMaterial({ color: 0x060610, roughness: 0.9 })); m.position.set(x + (Math.random() - 0.5) * 26, h / 2, z + (Math.random() - 0.5) * 26); m.rotation.z = (Math.random() - 0.5) * 0.3; scene.add(m); }
      } else if (theme === 'light') {
        for (let i = 0; i < 5; i++) { const h = 2 + Math.random() * 4; const m = new THREE.Mesh(new THREE.ConeGeometry(0.3, h, 6), new THREE.MeshStandardMaterial({ color: 0xccccff, roughness: 0.2, metalness: 0.8, emissive: 0x8888ff, emissiveIntensity: 0.2 })); m.position.set(x + (Math.random() - 0.5) * 28, h / 2, z + (Math.random() - 0.5) * 28); scene.add(m); }
      } else if (theme === 'ruins') {
        for (let i = 0; i < 6; i++) { const h = 1 + Math.random() * 3; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, h, 8), new THREE.MeshStandardMaterial({ color: 0x3a2e20, roughness: 0.95 })); m.position.set(x + (Math.random() - 0.5) * 24, h / 2, z + (Math.random() - 0.5) * 24); m.rotation.z = (Math.random() - 0.5) * 0.5; scene.add(m); }
      } else {
        for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 4 + Math.random() * 4), new THREE.MeshBasicMaterial({ color: 0x6633cc, transparent: true, opacity: 0.6 })); m.position.set(x + (Math.random() - 0.5) * 20, 0.02, z + (Math.random() - 0.5) * 20); m.rotation.y = Math.random() * Math.PI; scene.add(m); }
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
