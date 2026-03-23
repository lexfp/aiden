    // ═══════════════════ UNIQUE ATTACK VFX SYSTEM ═══════════════════
    // Pre-baked shared geometries to avoid per-hit allocations on GPU
    const _geoPlane = new THREE.PlaneGeometry(1, 1);
    const _geoRing = new THREE.RingGeometry(0.5, 1, 24);
    const _geoTorus = new THREE.TorusGeometry(1, 0.12, 6, 24);
    const _geoSphere = new THREE.SphereGeometry(1, 8, 8);
    const _geoCone = new THREE.ConeGeometry(1, 1, 5);
    const _geoCyl = new THREE.CylinderGeometry(1, 1, 1, 6);
    const _geoDod = new THREE.DodecahedronGeometry(1, 0);

    /* --- LIGHT ATTACK VFX: fast slash combos with spark trails --- */
    function spawnLightAttackVFX(pos, rot, comboNum) {
      const fw = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
      const slashAngle = (comboNum % 3 === 0) ? 0.4 : (comboNum % 3 === 1) ? -0.4 : 0;
      const slashColor = comboNum >= 3 ? '#ff88ff' : (comboNum % 2 === 0 ? '#ffffff' : '#ff6688');

      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(slashColor), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      const m = new THREE.Mesh(_geoPlane, mat);
      m.scale.set(1.8 + comboNum * 0.2, 0.6, 1);
      m.position.copy(pos).add(fw.clone().multiplyScalar(1.8)).add(new THREE.Vector3(0, 1.6, 0));
      m.rotation.y = rot; m.rotation.z = slashAngle;
      scene.add(m); slashTrails.push({ mesh: m, lifetime: 0.18, maxLifetime: 0.18 });

      const sparkCol = comboNum >= 3 ? 0xff44ff : 0xffaa44;
      for (let i = 0; i < Math.min(5 + comboNum, 10); i++) {
        const dir = fw.clone().multiplyScalar(4 + Math.random() * 5);
        dir.x += (Math.random() - 0.5) * 4; dir.y += Math.random() * 3; dir.z += (Math.random() - 0.5) * 4;
        spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)).add(fw.clone().multiplyScalar(1.5)), dir, sparkCol, 0.04 + Math.random() * 0.04, 0.2 + Math.random() * 0.15);
      }
      getLight(pos.clone().add(fw.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 1.5, 0)), sparkCol, 3, 5, 60);
      cameraShake(0.08 + comboNum * 0.03);
    }

    function spawnHeavyAttackVFX(pos, rot, isCrit) {
      const fw = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
      const impactPos = pos.clone().add(fw.clone().multiplyScalar(2.5));

      const ringMat = new THREE.MeshBasicMaterial({ color: isCrit ? 0xffdd44 : 0xff4400, transparent: true, opacity: 0.9, depthWrite: false });
      const ring = new THREE.Mesh(_geoTorus, ringMat);
      ring.scale.setScalar(1.5);
      ring.position.copy(impactPos).add(new THREE.Vector3(0, 0.5, 0)); ring.rotation.x = Math.PI / 2;
      scene.add(ring); hitFlashes.push({ mesh: ring, lifetime: 0.4, maxLifetime: 0.4 });

      const arcMat = new THREE.MeshBasicMaterial({ color: isCrit ? 0xffdd44 : 0xff2244, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
      const arc = new THREE.Mesh(_geoPlane, arcMat);
      arc.scale.set(4.5, 1.8, 1);
      arc.position.copy(impactPos).add(new THREE.Vector3(0, 1.5, 0)); arc.rotation.y = rot;
      scene.add(arc); slashTrails.push({ mesh: arc, lifetime: 0.35, maxLifetime: 0.35 });

      spawnDebris(impactPos, isCrit ? 8 : 4);

      const col = isCrit ? 0xffdd44 : 0xff4400;
      for (let i = 0; i < (isCrit ? 16 : 10); i++) {
        spawnParticle(impactPos.clone().add(new THREE.Vector3(0, 1, 0)),
          new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 8, (Math.random() - 0.5) * 12),
          col, 0.1 + Math.random() * 0.12, 0.5 + Math.random() * 0.3);
      }
      screenFlash(isCrit ? 'domain' : 'heavy', isCrit ? 0.5 : 0.35);
      cameraShake(isCrit ? 0.7 : 0.35);
      if (isCrit) cameraZoom(0.4);
      getLight(impactPos.clone().add(new THREE.Vector3(0, 1.5, 0)), col, isCrit ? 12 : 8, 15, 180);
    }

    function spawnCursedStrikeVFX(pos, rot) {
      const techCol = playerTech ? playerTech.hex : 0x8844ff;
      const fw = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));

      const sphereMat = new THREE.MeshBasicMaterial({ color: techCol, transparent: true, opacity: 0.7, depthWrite: false });
      const sphere = new THREE.Mesh(_geoSphere, sphereMat);
      sphere.scale.setScalar(0.8);
      sphere.position.copy(pos).add(new THREE.Vector3(0, 1.8, 0));
      scene.add(sphere); hitFlashes.push({ mesh: sphere, lifetime: 0.6, maxLifetime: 0.6 });

      const waveMat = new THREE.MeshBasicMaterial({ color: techCol, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
      const wave = new THREE.Mesh(_geoRing, waveMat);
      wave.scale.setScalar(3.5);
      wave.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0)); wave.rotation.x = -Math.PI / 2;
      scene.add(wave); hitFlashes.push({ mesh: wave, lifetime: 0.5, maxLifetime: 0.5 });

      const beamMat = new THREE.MeshBasicMaterial({ color: techCol, transparent: true, opacity: 0.8, depthWrite: false });
      const beam = new THREE.Mesh(_geoCyl, beamMat);
      beam.scale.set(0.3, 5, 0.3);
      beam.position.copy(pos).add(fw.clone().multiplyScalar(3.5)).add(new THREE.Vector3(0, 1.5, 0));
      beam.rotation.z = Math.PI / 2; beam.rotation.y = rot;
      scene.add(beam); hitFlashes.push({ mesh: beam, lifetime: 0.35, maxLifetime: 0.35 });

      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 4;
        const r = 1 + i * 0.15;
        const vel = new THREE.Vector3(Math.cos(angle) * r * 3, 2 + Math.random() * 5, Math.sin(angle) * r * 3);
        spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.8, 0)), vel, techCol, 0.08 + Math.random() * 0.1, 0.4 + Math.random() * 0.4);
      }
      screenFlash('cursed', 0.4);
      cameraShake(0.5);
      cameraZoom(0.25);
      getLight(pos.clone().add(new THREE.Vector3(0, 2, 0)), techCol, 15, 25, 400);
    }

    /* --- TECHNIQUE-SPECIFIC VFX --- */
    // Each technique gets unique visual effects for E/R/T moves
    function spawnTechniqueVFX(pos, techId, moveIdx, range) {
      const tech = playerTech;
      if (!tech) return;
      const col = tech.hex;

      if (techId === 'limitless') {
        if (moveIdx === 0) {
          // INFINITY — translucent barrier dome
          const domeMat = new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
          const dome = new THREE.Mesh(_geoSphere, domeMat);
          dome.scale.setScalar(range * 0.5);
          dome.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0));
          scene.add(dome); hitFlashes.push({ mesh: dome, lifetime: 1.2, maxLifetime: 1.2, baseScale: range * 0.5, isSphere: true });
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(Math.cos(a) * 2, 1.5, Math.sin(a) * 2)),
              new THREE.Vector3(-Math.cos(a) * 3, Math.random() * 2, -Math.sin(a) * 3), 0x00ccff, 0.06, 0.8);
          }
        } else if (moveIdx === 1) {
          // BLUE — swirling blue orb
          const orbMat = new THREE.MeshBasicMaterial({ color: 0x0066ff, transparent: true, opacity: 0.85, depthWrite: false });
          const orb = new THREE.Mesh(_geoSphere, orbMat);
          orb.scale.setScalar(0.6);
          orb.position.copy(pos).add(new THREE.Vector3(0, 2, 0));
          scene.add(orb); hitFlashes.push({ mesh: orb, lifetime: 1.5, maxLifetime: 1.5, baseScale: 0.6, isSphere: true });
          const distMat = new THREE.MeshBasicMaterial({ color: 0x0044aa, transparent: true, opacity: 0.1, side: THREE.BackSide, depthWrite: false });
          const dist = new THREE.Mesh(_geoSphere, distMat);
          dist.scale.setScalar(2.5);
          dist.position.copy(pos).add(new THREE.Vector3(0, 2, 0));
          scene.add(dist); hitFlashes.push({ mesh: dist, lifetime: 1.2, maxLifetime: 1.2, baseScale: 2.5, isSphere: true });
          for (let i = 0; i < 25; i++) {
            const a = (i / 25) * Math.PI * 6;
            const r = 3 + (i / 25) * 5;
            const start = pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 1.5 + Math.random() * 2, Math.sin(a) * r));
            const vel = new THREE.Vector3(-Math.cos(a) * r * 2, (2 - start.y + pos.y) * 2, -Math.sin(a) * r * 2);
            spawnParticle(start, vel, [0x0066ff, 0x00ccff, 0x4488ff][i % 3], 0.05 + Math.random() * 0.06, 0.6 + Math.random() * 0.5);
          }
          getLight(pos.clone().add(new THREE.Vector3(0, 2, 0)), 0x0066ff, 12, 20, 800);
        } else if (moveIdx === 2) {
          // RED
          const blastMat = new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
          const blast = new THREE.Mesh(_geoSphere, blastMat);
          blast.scale.setScalar(1);
          blast.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0));
          scene.add(blast); hitFlashes.push({ mesh: blast, lifetime: 0.8, maxLifetime: 0.8, baseScale: 1, isSphere: true });
          for (let i = 0; i < 30; i++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 8 + Math.random() * 12;
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
              new THREE.Vector3(Math.cos(a) * spd, (Math.random() - 0.3) * 8, Math.sin(a) * spd),
              [0xff2244, 0xff4466, 0xff0000][i % 3], 0.1 + Math.random() * 0.1, 0.5 + Math.random() * 0.4);
          }
          spawnDebris(pos, 8);
          getLight(pos.clone().add(new THREE.Vector3(0, 2, 0)), 0xff2244, 18, 30, 500);
          triggerSlowMo(0.25);
        }

      } else if (techId === 'bloodManip') {
        // Red fluid particle streams
        for (let i = 0; i < 35; i++) {
          const streamAngle = Math.random() * Math.PI * 2;
          const vel = new THREE.Vector3(Math.cos(streamAngle) * (3 + Math.random() * 6), -1 + Math.random() * 5, Math.sin(streamAngle) * (3 + Math.random() * 6));
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), vel, 0xcc1133, 0.06 + Math.random() * 0.08, 0.5 + Math.random() * 0.4);
        }
        if (moveIdx >= 1) {
          // Blood spikes from ground
          for (let i = 0; i < 6 + moveIdx * 2; i++) {
            const ang = (i / (6 + moveIdx * 2)) * Math.PI * 2;
            const r = 2 + Math.random() * (range * 0.4);
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.5 + Math.random(), 4),
              new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.8, depthWrite: false }));
            spike.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * r, 0.75, Math.sin(ang) * r));
            scene.add(spike); hitFlashes.push({ mesh: spike, lifetime: 0.7, maxLifetime: 0.7 });
          }
        }

      } else if (techId === 'tenShadows') {
        for (let i = 0; i < 12; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 0.5, (Math.random() - 0.5) * 4)),
            new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), 0x112244, 0.2 + Math.random() * 0.2, 0.8 + Math.random() * 0.5);
        }
        if (moveIdx >= 0) {
          const creatureCount = 2 + moveIdx;
          for (let i = 0; i < creatureCount; i++) {
            const ang = (i / creatureCount) * Math.PI * 2;
            const r = 2 + Math.random() * 3;
            const creature = new THREE.Mesh(_geoCone, new THREE.MeshBasicMaterial({ color: 0x001133, transparent: true, opacity: 0.85, depthWrite: false }));
            creature.scale.set(0.4, 2.5 + Math.random(), 0.4);
            creature.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * r, 1.25, Math.sin(ang) * r));
            scene.add(creature); hitFlashes.push({ mesh: creature, lifetime: 0.8, maxLifetime: 0.8 });
          }
        }

      } else if (techId === 'disasterFlames') {
        for (let i = 0; i < 22; i++) {
          const vel = new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 8, (Math.random() - 0.5) * 8);
          const fireCol = [0xff4400, 0xff6600, 0xffaa00][Math.floor(Math.random() * 3)];
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), vel, fireCol, 0.1 + Math.random() * 0.15, 0.4 + Math.random() * 0.4);
        }
        const heatMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.2, side: THREE.BackSide, depthWrite: false });
        const heat = new THREE.Mesh(_geoSphere, heatMat);
        heat.scale.setScalar(range * 0.35);
        heat.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
        scene.add(heat); hitFlashes.push({ mesh: heat, lifetime: 0.5, maxLifetime: 0.5 });
        if (moveIdx === 2) {
          const meteor = new THREE.Mesh(_geoDod, new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9, depthWrite: false }));
          meteor.scale.setScalar(1.2);
          meteor.position.copy(pos).add(new THREE.Vector3(0, 8, 0));
          scene.add(meteor); hitFlashes.push({ mesh: meteor, lifetime: 0.6, maxLifetime: 0.6 });
          spawnDebris(pos, 10);
        }

      } else if (techId === 'iceFormation') {
        for (let i = 0; i < 12; i++) {
          const vel = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6);
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1, 0)), vel, 0xaaddff, 0.08 + Math.random() * 0.1, 0.6 + Math.random() * 0.3);
        }
        for (let i = 0; i < 4 + moveIdx * 2; i++) {
          const ang = (i / (4 + moveIdx * 2)) * Math.PI * 2;
          const r = 1.5 + Math.random() * range * 0.3;
          const spike = new THREE.Mesh(_geoCone, new THREE.MeshBasicMaterial({ color: 0xcceeFF, transparent: true, opacity: 0.7, depthWrite: false }));
          spike.scale.set(0.12, 1.2 + Math.random() * 1.5, 0.12);
          spike.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * r, 0.6, Math.sin(ang) * r));
          scene.add(spike); hitFlashes.push({ mesh: spike, lifetime: 0.8, maxLifetime: 0.8 });
        }

      } else if (techId === 'thunderclap') {
        for (let i = 0; i < 5 + moveIdx * 2; i++) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * range * 0.5;
          const bolt = new THREE.Mesh(_geoCyl, new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.9, depthWrite: false }));
          bolt.scale.set(0.04, 4 + Math.random() * 4, 0.04);
          bolt.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * r, 2, Math.sin(ang) * r));
          bolt.rotation.z = (Math.random() - 0.5) * 1.5; bolt.rotation.x = (Math.random() - 0.5) * 0.5;
          scene.add(bolt); hitFlashes.push({ mesh: bolt, lifetime: 0.25, maxLifetime: 0.25 });
        }
        getLight(pos.clone().add(new THREE.Vector3(0, 5, 0)), 0xffffff, 20, 40, 80);
        for (let i = 0; i < 15; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 3, 0)),
            new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 10, (Math.random() - 0.5) * 12), 0x88ddff, 0.05, 0.2);
        }

      } else {
        // Default technique VFX for other techniques
        for (let i = 0; i < 25; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
            new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10),
            col, 0.1 + Math.random() * 0.1, 0.5 + Math.random() * 0.4);
        }
      }

      // All techniques get a shockwave ring
      const waveMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
      const wave = new THREE.Mesh(new THREE.RingGeometry(0.3, range * 0.3, 32), waveMat);
      wave.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0)); wave.rotation.x = -Math.PI / 2;
      scene.add(wave); hitFlashes.push({ mesh: wave, lifetime: 0.5, maxLifetime: 0.5 });

      screenFlash('tech', 0.3 + moveIdx * 0.1);
      cameraShake(0.3 + moveIdx * 0.15);
      if (moveIdx >= 2) { triggerSlowMo(0.2); cameraZoom(0.2); }
    }

    // ═══════════════════ DEBRIS SYSTEM ═══════════════════
    const debrisPool = [];
    const baseBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const baseDodGeo = new THREE.DodecahedronGeometry(1, 0);
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.9, metalness: 0.1, transparent: true });

    // Spawns rock/ground chunks on heavy impacts
    function spawnDebris(pos, count) {
      for (let i = 0; i < count; i++) {
        const size = 0.08 + Math.random() * 0.18;
        let m;
        if (debrisPool.length > 0) {
          m = debrisPool.pop();
          m.visible = true;
          m.material.opacity = 1;
        } else {
          const geo = Math.random() > 0.5 ? baseBoxGeo : baseDodGeo;
          m = new THREE.Mesh(geo, debrisMat);
          scene.add(m);
        }
        m.scale.setScalar(size);
        m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1, 0.2, (Math.random() - 0.5) * 1));
        m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const vel = new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 7, (Math.random() - 0.5) * 8);
        particles.push({ mesh: m, velocity: vel, lifetime: 1.0 + Math.random() * 0.5, maxLifetime: 1.5, gravity: -15, baseSize: size, isDebris: true });
      }
    }

    // ═══════════════════ SCREEN FLASH HELPER ═══════════════════
    function screenFlash(type, intensity) {
      const sf = document.getElementById('screen-flash');
      sf.className = type || '';
      sf.style.transition = 'none'; sf.style.opacity = String(Math.min(1, intensity));
      setTimeout(() => { sf.style.transition = 'opacity 0.35s'; sf.style.opacity = '0'; }, 40);
    }
