    // ═══════════════════ UNIQUE ATTACK VFX SYSTEM ═══════════════════
    // Each attack type has completely different visual effects

    /* --- LIGHT ATTACK VFX: fast slash combos with spark trails --- */
    function spawnLightAttackVFX(pos, rot, comboNum) {
      const fw = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
      // Alternate slash directions per combo hit
      const slashAngle = (comboNum % 3 === 0) ? 0.4 : (comboNum % 3 === 1) ? -0.4 : 0;
      const slashColor = comboNum >= 3 ? '#ff88ff' : (comboNum % 2 === 0 ? '#ffffff' : '#ff6688');

      // Short, fast slash trail
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(slashColor), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8 + comboNum * 0.2, 0.6), mat);
      m.position.copy(pos).add(fw.clone().multiplyScalar(1.8)).add(new THREE.Vector3(0, 1.6, 0));
      m.rotation.y = rot; m.rotation.z = slashAngle;
      scene.add(m); slashTrails.push({ mesh: m, lifetime: 0.18, maxLifetime: 0.18 });

      // Quick spark particles (small, fast-fading)
      const sparkCol = comboNum >= 3 ? 0xff44ff : 0xffaa44;
      for (let i = 0; i < 5 + comboNum * 2; i++) {
        const dir = fw.clone().multiplyScalar(4 + Math.random() * 5);
        dir.x += (Math.random() - 0.5) * 4; dir.y += Math.random() * 3; dir.z += (Math.random() - 0.5) * 4;
        spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)).add(fw.clone().multiplyScalar(1.5)), dir, sparkCol, 0.04 + Math.random() * 0.04, 0.2 + Math.random() * 0.15);
      }
      // Tiny point light flash
      const fl = new THREE.PointLight(sparkCol, 3, 5); fl.position.copy(pos).add(fw.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 1.5, 0));
      scene.add(fl); setTimeout(() => scene.remove(fl), 60);
      cameraShake(0.08 + comboNum * 0.03);
    }

    /* --- HEAVY ATTACK VFX: big impact with ground debris --- */
    function spawnHeavyAttackVFX(pos, rot, isCrit) {
      const fw = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
      const impactPos = pos.clone().add(fw.clone().multiplyScalar(2.5));

      // Large impact ring expanding from hit point
      const ringMat = new THREE.MeshBasicMaterial({ color: isCrit ? 0xffdd44 : 0xff4400, transparent: true, opacity: 0.9, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.15, 8, 24), ringMat);
      ring.position.copy(impactPos).add(new THREE.Vector3(0, 0.5, 0)); ring.rotation.x = Math.PI / 2;
      scene.add(ring); hitFlashes.push({ mesh: ring, lifetime: 0.4, maxLifetime: 0.4 });

      // Wide slash arc
      const arcMat = new THREE.MeshBasicMaterial({ color: isCrit ? 0xffdd44 : 0xff2244, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
      const arc = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.8), arcMat);
      arc.position.copy(impactPos).add(new THREE.Vector3(0, 1.5, 0)); arc.rotation.y = rot;
      scene.add(arc); slashTrails.push({ mesh: arc, lifetime: 0.35, maxLifetime: 0.35 });

      // Ground debris chunks
      spawnDebris(impactPos, isCrit ? 12 : 6);

      // Heavy impact particles (larger, slower)
      const col = isCrit ? 0xffdd44 : 0xff4400;
      for (let i = 0; i < (isCrit ? 25 : 15); i++) {
        spawnParticle(impactPos.clone().add(new THREE.Vector3(0, 1, 0)),
          new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 8, (Math.random() - 0.5) * 12),
          col, 0.1 + Math.random() * 0.12, 0.5 + Math.random() * 0.3);
      }

      // Screen flash
      screenFlash(isCrit ? 'domain' : 'heavy', isCrit ? 0.5 : 0.35);
      cameraShake(isCrit ? 0.7 : 0.35);
      if (isCrit) cameraZoom(0.4);

      // Impact light
      const fl = new THREE.PointLight(col, isCrit ? 12 : 8, 15);
      fl.position.copy(impactPos).add(new THREE.Vector3(0, 1.5, 0));
      scene.add(fl); setTimeout(() => scene.remove(fl), 180);
    }

    /* --- CURSED STRIKE (Q) VFX: energy charge + shockwave --- */
    function spawnCursedStrikeVFX(pos, rot) {
      const techCol = playerTech ? playerTech.hex : 0x8844ff;
      const fw = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));

      // Central energy sphere that expands
      const sphereMat = new THREE.MeshBasicMaterial({ color: techCol, transparent: true, opacity: 0.7, depthWrite: false });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), sphereMat);
      sphere.position.copy(pos).add(new THREE.Vector3(0, 1.8, 0));
      scene.add(sphere); hitFlashes.push({ mesh: sphere, lifetime: 0.6, maxLifetime: 0.6 });

      // Expanding shockwave ring on ground
      const waveMat = new THREE.MeshBasicMaterial({ color: techCol, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
      const wave = new THREE.Mesh(new THREE.RingGeometry(0.5, 3.5, 32), waveMat);
      wave.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0)); wave.rotation.x = -Math.PI / 2;
      scene.add(wave); hitFlashes.push({ mesh: wave, lifetime: 0.5, maxLifetime: 0.5 });

      // Energy beam forward
      const beamMat = new THREE.MeshBasicMaterial({ color: techCol, transparent: true, opacity: 0.8, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 5, 8), beamMat);
      beam.position.copy(pos).add(fw.clone().multiplyScalar(3.5)).add(new THREE.Vector3(0, 1.5, 0));
      beam.rotation.z = Math.PI / 2; beam.rotation.y = rot;
      scene.add(beam); hitFlashes.push({ mesh: beam, lifetime: 0.35, maxLifetime: 0.35 });

      // Spiral particles outward
      for (let i = 0; i < 40; i++) {
        const angle = (i / 40) * Math.PI * 4;
        const r = 1 + i * 0.15;
        const vel = new THREE.Vector3(Math.cos(angle) * r * 3, 2 + Math.random() * 5, Math.sin(angle) * r * 3);
        spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.8, 0)), vel, techCol, 0.08 + Math.random() * 0.1, 0.4 + Math.random() * 0.4);
      }

      screenFlash('cursed', 0.4);
      cameraShake(0.5);
      cameraZoom(0.25);
      // Big light burst
      const fl = new THREE.PointLight(techCol, 15, 25); fl.position.copy(pos).add(new THREE.Vector3(0, 2, 0));
      scene.add(fl); setTimeout(() => scene.remove(fl), 400);
    }

    /* --- TECHNIQUE-SPECIFIC VFX --- */
    // Each technique gets unique visual effects for E/R/T moves
    function spawnTechniqueVFX(pos, techId, moveIdx, range) {
      const tech = playerTech;
      if (!tech) return;
      const col = tech.hex;

      if (techId === 'limitless') {
        // Swirling blue energy vortex
        for (let i = 0; i < 30; i++) {
          const angle = (i / 30) * Math.PI * 2;
          const r = 1 + moveIdx * 2;
          const vel = new THREE.Vector3(Math.cos(angle + elapsed * 3) * r * 4, Math.random() * 3, Math.sin(angle + elapsed * 3) * r * 4);
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), vel, 0x00ccff, 0.08, 0.6);
        }
        // Distortion sphere
        const distMat = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.15, side: THREE.BackSide, depthWrite: false });
        const dist = new THREE.Mesh(new THREE.SphereGeometry(range * 0.4, 16, 16), distMat);
        dist.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0));
        scene.add(dist); hitFlashes.push({ mesh: dist, lifetime: 0.6, maxLifetime: 0.6 });
        if (moveIdx === 1) {
          // Blue: attraction pull lines
          for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            const lineMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.7, depthWrite: false });
            const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, range * 0.8, 4), lineMat);
            line.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * range * 0.4, 1.5, Math.sin(ang) * range * 0.4));
            line.rotation.z = Math.PI / 2; line.rotation.y = ang;
            scene.add(line); hitFlashes.push({ mesh: line, lifetime: 0.4, maxLifetime: 0.4 });
          }
        } else if (moveIdx === 2) {
          // Red: explosion push wave
          const pushMat = new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
          const push = new THREE.Mesh(new THREE.SphereGeometry(range * 0.6, 12, 12), pushMat);
          push.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0));
          scene.add(push); hitFlashes.push({ mesh: push, lifetime: 0.4, maxLifetime: 0.4 });
          for (let i = 0; i < 20; i++) spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
            new THREE.Vector3((Math.random() - 0.5) * 18, Math.random() * 8, (Math.random() - 0.5) * 18), 0xff4466, 0.12, 0.5);
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
        // Dark smoke effects
        for (let i = 0; i < 25; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 0.5, (Math.random() - 0.5) * 4)),
            new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), 0x112244, 0.2 + Math.random() * 0.2, 0.8 + Math.random() * 0.5);
        }
        // Shadow creature silhouettes (dark cones rising from ground)
        if (moveIdx >= 0) {
          const creatureCount = 2 + moveIdx;
          for (let i = 0; i < creatureCount; i++) {
            const ang = (i / creatureCount) * Math.PI * 2 + Math.random() * 0.5;
            const r = 2 + Math.random() * 3;
            const creature = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.5 + Math.random(), 5),
              new THREE.MeshBasicMaterial({ color: 0x001133, transparent: true, opacity: 0.85, depthWrite: false }));
            creature.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * r, 1.25, Math.sin(ang) * r));
            scene.add(creature); hitFlashes.push({ mesh: creature, lifetime: 0.8, maxLifetime: 0.8 });
            // Shadow creature eyes
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6),
              new THREE.MeshBasicMaterial({ color: 0x4466cc }));
            eye.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * r, 2.2, Math.sin(ang) * r));
            scene.add(eye); hitFlashes.push({ mesh: eye, lifetime: 0.6, maxLifetime: 0.6 });
          }
        }

      } else if (techId === 'disasterFlames') {
        // Fire jets and flame particles
        for (let i = 0; i < 40; i++) {
          const vel = new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 8, (Math.random() - 0.5) * 8);
          const fireCol = [0xff4400, 0xff6600, 0xffaa00, 0xff2200][Math.floor(Math.random() * 4)];
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), vel, fireCol, 0.1 + Math.random() * 0.15, 0.4 + Math.random() * 0.4);
        }
        // Heat glow sphere
        const heatMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.2, side: THREE.BackSide, depthWrite: false });
        const heat = new THREE.Mesh(new THREE.SphereGeometry(range * 0.35, 12, 12), heatMat);
        heat.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
        scene.add(heat); hitFlashes.push({ mesh: heat, lifetime: 0.5, maxLifetime: 0.5 });
        if (moveIdx === 2) {
          // Meteor: big falling rock effect
          const meteor = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0),
            new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9, depthWrite: false }));
          meteor.position.copy(pos).add(new THREE.Vector3(0, 8, 0));
          scene.add(meteor); hitFlashes.push({ mesh: meteor, lifetime: 0.6, maxLifetime: 0.6 });
          spawnDebris(pos, 15);
        }

      } else if (techId === 'iceFormation') {
        // Ice crystals and frost
        for (let i = 0; i < 20; i++) {
          const vel = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6);
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1, 0)), vel, 0xaaddff, 0.08 + Math.random() * 0.1, 0.6 + Math.random() * 0.3);
        }
        // Ice spike pillars
        for (let i = 0; i < 4 + moveIdx * 2; i++) {
          const ang = (i / (4 + moveIdx * 2)) * Math.PI * 2;
          const r = 1.5 + Math.random() * range * 0.3;
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2 + Math.random() * 1.5, 4),
            new THREE.MeshBasicMaterial({ color: 0xcceeFF, transparent: true, opacity: 0.7, depthWrite: false }));
          spike.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * r, 0.6, Math.sin(ang) * r));
          scene.add(spike); hitFlashes.push({ mesh: spike, lifetime: 0.8, maxLifetime: 0.8 });
        }

      } else if (techId === 'thunderclap') {
        // Lightning bolts (jagged lines)
        for (let i = 0; i < 5 + moveIdx * 2; i++) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * range * 0.5;
          const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4 + Math.random() * 4, 3),
            new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.9, depthWrite: false }));
          bolt.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * r, 2, Math.sin(ang) * r));
          bolt.rotation.z = (Math.random() - 0.5) * 1.5; bolt.rotation.x = (Math.random() - 0.5) * 0.5;
          scene.add(bolt); hitFlashes.push({ mesh: bolt, lifetime: 0.25, maxLifetime: 0.25 });
        }
        // Flash the whole scene briefly
        const fl = new THREE.PointLight(0xffffff, 20, 40); fl.position.copy(pos).add(new THREE.Vector3(0, 5, 0));
        scene.add(fl); setTimeout(() => scene.remove(fl), 80);
        for (let i = 0; i < 30; i++) {
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
    // Spawns rock/ground chunks on heavy impacts
    function spawnDebris(pos, count) {
      for (let i = 0; i < count; i++) {
        const size = 0.08 + Math.random() * 0.18;
        const geo = Math.random() > 0.5 ? new THREE.BoxGeometry(size, size, size) : new THREE.DodecahedronGeometry(size, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.9, metalness: 0.1 });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1, 0.2, (Math.random() - 0.5) * 1));
        m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const vel = new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 7, (Math.random() - 0.5) * 8);
        scene.add(m);
        particles.push({ mesh: m, velocity: vel, lifetime: 1.0 + Math.random() * 0.5, maxLifetime: 1.5, gravity: -15 });
      }
    }

    // ═══════════════════ SCREEN FLASH HELPER ═══════════════════
    function screenFlash(type, intensity) {
      const sf = document.getElementById('screen-flash');
      sf.className = type || '';
      sf.style.transition = 'none'; sf.style.opacity = String(Math.min(1, intensity));
      setTimeout(() => { sf.style.transition = 'opacity 0.35s'; sf.style.opacity = '0'; }, 40);
    }
