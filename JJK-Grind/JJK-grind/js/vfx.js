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
    // Each technique + move index gets distinct visuals (anime-inspired silhouettes).
    function spawnTechniqueVFX(pos, techId, moveIdx, range) {
      const tech = playerTech;
      if (!tech) return;
      const col = tech.hex;
      const rot = typeof player !== 'undefined' && player.group ? player.group.rotation.y : 0;
      const fw = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
      const rt = new THREE.Vector3(-fw.z, 0, fw.x);
      let skipFooterRing = false;
      let shake = 0.28 + moveIdx * 0.14;
      let flashAmt = 0.28 + moveIdx * 0.09;

      if (techId === 'limitless') {
        if (moveIdx === 0) {
          skipFooterRing = true;
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
        if (moveIdx === 0) {
          for (let i = 0; i < 28; i++) {
            const a = (i / 28) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.2, 0)),
              new THREE.Vector3(Math.cos(a) * 5, Math.random() * 3, Math.sin(a) * 5), 0xff3355, 0.07, 0.45);
          }
        } else if (moveIdx === 1) {
          const beam = new THREE.Mesh(_geoCyl, new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.75, depthWrite: false }));
          beam.scale.set(0.22, 0.5 + range * 0.35, 0.22);
          beam.position.copy(pos).add(fw.clone().multiplyScalar(3 + range * 0.25)).add(new THREE.Vector3(0, 1.4, 0));
          beam.rotation.z = Math.PI / 2; beam.rotation.y = rot;
          scene.add(beam); hitFlashes.push({ mesh: beam, lifetime: 0.35, maxLifetime: 0.35 });
          for (let i = 0; i < 14; i++) {
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), fw.clone().multiplyScalar(18 + Math.random() * 10).add(new THREE.Vector3(0, (Math.random() - 0.5) * 4, 0)), 0xcc1133, 0.06, 0.35);
          }
        } else if (moveIdx === 2) {
          for (let i = 0; i < 28; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r = 1 + Math.random() * range * 0.3;
            spawnParticle(pos.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0.5 + Math.random() * 3, Math.sin(ang) * r)),
              new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 4, (Math.random() - 0.5) * 6), 0xff1144, 0.12 + Math.random() * 0.04, 0.55);
          }
        }
        for (let i = 0; i < 18; i++) {
          const streamAngle = Math.random() * Math.PI * 2;
          const vel = new THREE.Vector3(Math.cos(streamAngle) * (3 + Math.random() * 6), -1 + Math.random() * 5, Math.sin(streamAngle) * (3 + Math.random() * 6));
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), vel, 0xcc1133, 0.06 + Math.random() * 0.08, 0.5 + Math.random() * 0.4);
        }
        if (moveIdx >= 1) {
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
        if (moveIdx === 0) {
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(Math.cos(a) * 2, 0.2, Math.sin(a) * 2)),
              new THREE.Vector3(-Math.cos(a) * 4, 0.5 + Math.random() * 2, -Math.sin(a) * 4), 0x111122, 0.18, 0.9);
          }
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const dog = new THREE.Mesh(_geoCone, new THREE.MeshBasicMaterial({ color: 0x001133, transparent: true, opacity: 0.85, depthWrite: false }));
            dog.scale.set(0.45, 1.6 + Math.random(), 0.45);
            dog.position.copy(pos).add(new THREE.Vector3(Math.cos(a) * 2.5, 0.9, Math.sin(a) * 2.5));
            scene.add(dog); hitFlashes.push({ mesh: dog, lifetime: 0.75, maxLifetime: 0.75 });
          }
        } else if (moveIdx === 1) {
          for (let i = 0; i < 12; i++) {
            const bolt = new THREE.Mesh(_geoCyl, new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.9, depthWrite: false }));
            bolt.scale.set(0.04, 7 + Math.random() * 5, 0.04);
            bolt.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * range * 0.4, 2 + Math.random() * 3, (Math.random() - 0.5) * range * 0.4));
            bolt.rotation.z = (Math.random() - 0.5) * 1.2;
            scene.add(bolt); hitFlashes.push({ mesh: bolt, lifetime: 0.25, maxLifetime: 0.25 });
          }
          getLight(pos.clone().add(new THREE.Vector3(0, 2, 0)), 0x6688ff, 14, 22, 120);
        } else if (moveIdx === 2) {
          for (let i = 0; i < 28; i++) {
            const ang = (i / 28) * Math.PI * 2;
            const r = 2 + (i % 5) * 0.6;
            const serp = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: 0x001122, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
            serp.scale.set(0.3, 2 + Math.random() * 2, 1);
            serp.position.copy(pos).add(new THREE.Vector3(Math.cos(ang) * r, 0.8, Math.sin(ang) * r));
            serp.rotation.y = ang + rot;
            scene.add(serp); hitFlashes.push({ mesh: serp, lifetime: 0.6, maxLifetime: 0.6 });
          }
        }
        for (let i = 0; i < 10; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 0.5, (Math.random() - 0.5) * 4)),
            new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), 0x112244, 0.2 + Math.random() * 0.2, 0.8 + Math.random() * 0.5);
        }

      } else if (techId === 'disasterFlames') {
        if (moveIdx === 0) {
          for (let i = 0; i < 28; i++) {
            const vel = fw.clone().multiplyScalar(4 + Math.random() * 5).add(new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3));
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.2, 0)), vel, [0xffaa33, 0xff6600, 0xff4400][i % 3], 0.1 + Math.random() * 0.08, 0.5);
          }
        } else if (moveIdx === 1) {
          const arrow = new THREE.Mesh(_geoCone, new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9, depthWrite: false }));
          arrow.scale.set(0.35, 1.6, 0.35);
          arrow.position.copy(pos).add(fw.clone().multiplyScalar(4)).add(new THREE.Vector3(0, 1.6, 0));
          arrow.rotation.x = Math.PI / 2; arrow.rotation.z = -rot;
          scene.add(arrow); hitFlashes.push({ mesh: arrow, lifetime: 0.35, maxLifetime: 0.35 });
          for (let i = 0; i < 14; i++) {
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), fw.clone().multiplyScalar(18 + Math.random() * 8), 0xff4400, 0.08, 0.4);
          }
        } else if (moveIdx === 2) {
          const meteor = new THREE.Mesh(_geoDod, new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9, depthWrite: false }));
          meteor.scale.setScalar(1.2);
          meteor.position.copy(pos).add(new THREE.Vector3(0, 8, 0));
          scene.add(meteor); hitFlashes.push({ mesh: meteor, lifetime: 0.6, maxLifetime: 0.6 });
          spawnDebris(pos, 10);
        }
        for (let i = 0; i < 14; i++) {
          const vel = new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 8, (Math.random() - 0.5) * 8);
          const fireCol = [0xff4400, 0xff6600, 0xffaa00][Math.floor(Math.random() * 3)];
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), vel, fireCol, 0.1 + Math.random() * 0.15, 0.4 + Math.random() * 0.4);
        }
        const heatMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.2, side: THREE.BackSide, depthWrite: false });
        const heat = new THREE.Mesh(_geoSphere, heatMat);
        heat.scale.setScalar(range * 0.35);
        heat.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
        scene.add(heat); hitFlashes.push({ mesh: heat, lifetime: 0.5, maxLifetime: 0.5 });

      } else if (techId === 'iceFormation') {
        if (moveIdx === 0) {
          const stake = new THREE.Mesh(_geoCone, new THREE.MeshBasicMaterial({ color: 0xddffff, transparent: true, opacity: 0.9, depthWrite: false }));
          stake.scale.set(0.12, 2.2, 0.12);
          stake.position.copy(pos).add(fw.clone().multiplyScalar(4)).add(new THREE.Vector3(0, 1.6, 0));
          stake.rotation.x = Math.PI / 2; stake.rotation.z = -rot;
          scene.add(stake); hitFlashes.push({ mesh: stake, lifetime: 0.45, maxLifetime: 0.45 });
        } else if (moveIdx === 1) {
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
              new THREE.Vector3(Math.cos(a) * 5, Math.random() * 3, Math.sin(a) * 5), 0xaaddff, 0.08, 0.4);
          }
        } else if (moveIdx === 2) {
          const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5, depthWrite: false }));
          cage.position.copy(pos).add(new THREE.Vector3(0, 1.8, 0));
          scene.add(cage); hitFlashes.push({ mesh: cage, lifetime: 0.7, maxLifetime: 0.7 });
        }
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
        if (moveIdx === 0) {
          const burst = new THREE.Mesh(_geoSphere, new THREE.MeshBasicMaterial({ color: 0xccffff, transparent: true, opacity: 0.45, depthWrite: false }));
          burst.scale.setScalar(1.2);
          burst.position.copy(pos).add(fw.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 1.5, 0));
          scene.add(burst); hitFlashes.push({ mesh: burst, lifetime: 0.3, maxLifetime: 0.3, baseScale: 1.2, isSphere: true });
        } else if (moveIdx === 1) {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(Math.cos(a) * 2, 1.5, Math.sin(a) * 2)),
              fw.clone().multiplyScalar(4 + Math.random() * 5), 0xffee88, 0.06, 0.35);
          }
        } else if (moveIdx === 2) {
          for (let i = 0; i < 6; i++) {
            const rock = new THREE.Mesh(_geoDod, new THREE.MeshBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.9, depthWrite: false }));
            rock.scale.setScalar(0.35 + Math.random() * 0.2);
            rock.position.copy(pos).add(fw.clone().multiplyScalar(1.5 + i * 0.6)).add(new THREE.Vector3(0, 0.5, 0));
            scene.add(rock); hitFlashes.push({ mesh: rock, lifetime: 0.5, maxLifetime: 0.5 });
          }
        }
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

      } else if (techId === 'strawDoll') {
        if (moveIdx === 0) {
          for (let i = 0; i < 22; i++) {
            const a = (i / 22) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
              new THREE.Vector3(Math.cos(a) * 5, Math.random() * 3, Math.sin(a) * 5), 0xff6622, 0.05, 0.45);
          }
        } else if (moveIdx === 1) {
          const pin = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
          pin.scale.set(0.4, 1.2, 1);
          pin.position.copy(pos).add(fw.clone().multiplyScalar(3.5)).add(new THREE.Vector3(0, 1.8, 0));
          pin.rotation.y = rot; pin.rotation.z = Math.PI / 2; scene.add(pin); hitFlashes.push({ mesh: pin, lifetime: 0.35, maxLifetime: 0.35 });
        } else if (moveIdx === 2) {
          for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(Math.cos(a) * 2, 1.5, Math.sin(a) * 2)),
              new THREE.Vector3(-Math.cos(a) * 3, -1, -Math.sin(a) * 3), 0xff8844, 0.08, 0.55);
          }
        }
        for (let i = 0; i < 18; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8), 0xff6622, 0.08, 0.45);
        }

      } else if (techId === 'boogieWoogie') {
        const swapCol = 0x22ff66;
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          const ring = new THREE.Mesh(_geoRing, new THREE.MeshBasicMaterial({ color: swapCol, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
          ring.scale.setScalar(0.5 + moveIdx * 0.35);
          ring.position.copy(pos).add(new THREE.Vector3(Math.cos(a) * 2, 0.2, Math.sin(a) * 2));
          ring.rotation.x = -Math.PI / 2;
          scene.add(ring); hitFlashes.push({ mesh: ring, lifetime: 0.4, maxLifetime: 0.4 });
        }
        if (moveIdx >= 1) {
          for (let i = 0; i < 6; i++) {
            spawnParticle(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * range * 0.4, 1.5, (Math.random() - 0.5) * range * 0.4)),
              new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 4, (Math.random() - 0.5) * 6), swapCol, 0.1, 0.5);
          }
        } else {
          for (let i = 0; i < 12; i++) {
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), fw.clone().multiplyScalar(8 + Math.random() * 12).add(rt.clone().multiplyScalar((Math.random() - 0.5) * 12)), swapCol, 0.1, 0.5);
          }
        }
        getLight(pos.clone().add(new THREE.Vector3(0, 2, 0)), swapCol, 10, 18, 200);

      } else if (techId === 'ratioTech') {
        const gold = 0xffcc00;
        if (moveIdx === 0) {
          const gavel = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
          gavel.scale.set(1.2, 0.6, 1);
          gavel.position.copy(pos).add(new THREE.Vector3(0, 2.2, 0)); gavel.rotation.x = Math.PI / 2;
          scene.add(gavel); hitFlashes.push({ mesh: gavel, lifetime: 0.35, maxLifetime: 0.35 });
        } else if (moveIdx === 1) {
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(Math.cos(a) * 5, -1.5, Math.sin(a) * 5), 0xffdd44, 0.06, 0.6);
          }
        } else if (moveIdx === 2) {
          for (let i = 0; i < 12; i++) {
            const chain = new THREE.Mesh(_geoCyl, new THREE.MeshBasicMaterial({ color: 0x886600, transparent: true, opacity: 0.9, depthWrite: false }));
            chain.scale.set(0.08, 1.5 + Math.random(), 0.08);
            chain.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 4, 0.5 + Math.random() * 2, (Math.random() - 0.5) * 4));
            scene.add(chain); hitFlashes.push({ mesh: chain, lifetime: 0.55, maxLifetime: 0.55 });
          }
        }
        for (let i = 0; i < 10; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8), gold, 0.08, 0.4);
        }

      } else if (techId === 'idleTransfig') {
        const purp = 0xaa44ff;
        if (moveIdx === 0) {
          const rip = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: purp, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
          rip.scale.set(1.5, 2, 1.5);
          rip.position.copy(pos).add(fw.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 1.5, 0));
          rip.rotation.y = rot; scene.add(rip); hitFlashes.push({ mesh: rip, lifetime: 0.35, maxLifetime: 0.35 });
        } else if (moveIdx === 1) {
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3(Math.cos(a) * 6, Math.random() * 4, Math.sin(a) * 6), purp, 0.1, 0.5);
          }
        } else if (moveIdx === 2) {
          for (let i = 0; i < 10; i++) {
            const blob = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: purp, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
            blob.scale.set(0.4 + Math.random() * 0.4, 0.4 + Math.random() * 0.4, 1);
            blob.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 4, 0.5 + Math.random() * 2, (Math.random() - 0.5) * 4));
            scene.add(blob); hitFlashes.push({ mesh: blob, lifetime: 0.45, maxLifetime: 0.45 });
          }
        }
        for (let i = 0; i < 10; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8), purp, 0.1, 0.45);
        }

      } else if (techId === 'divFist') {
        const orange = 0xff6600;
        if (moveIdx === 0) {
          const fist = new THREE.Mesh(_geoSphere, new THREE.MeshBasicMaterial({ color: orange, transparent: true, opacity: 0.9, depthWrite: false }));
          fist.scale.setScalar(0.45);
          fist.position.copy(pos).add(fw.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 1.5, 0));
          scene.add(fist); hitFlashes.push({ mesh: fist, lifetime: 0.25, maxLifetime: 0.25, baseScale: 0.45, isSphere: true });
        } else if (moveIdx === 1) {
          for (let i = 0; i < 8; i++) {
            const arc = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
            arc.scale.set(0.8 + i * 0.05, 0.5, 1);
            arc.position.copy(pos).add(fw.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 1.5, 0));
            arc.rotation.y = rot + i * 0.15;
            scene.add(arc); hitFlashes.push({ mesh: arc, lifetime: 0.35, maxLifetime: 0.35 });
          }
        } else if (moveIdx === 2) {
          for (let i = 0; i < 12; i++) {
            const slash = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
            slash.scale.set(0.3, 2 + Math.random() * 2, 1);
            slash.position.copy(pos).add(fw.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 1.5, 0));
            slash.rotation.y = rot + (Math.random() - 0.5) * 0.5;
            scene.add(slash); hitFlashes.push({ mesh: slash, lifetime: 0.4, maxLifetime: 0.4 });
          }
        }
        for (let i = 0; i < 10; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8), orange, 0.06, 0.4);
        }

      } else if (techId === 'cursedSpeech') {
        const speech = 0x22aaff;
        if (moveIdx === 0) {
          for (let i = 0; i < 14; i++) {
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), fw.clone().multiplyScalar(10 + Math.random() * 5).add(new THREE.Vector3(0, (Math.random() - 0.5) * 3, 0)), speech, 0.06, 0.4);
          }
        } else if (moveIdx === 1) {
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const chain = new THREE.Mesh(_geoTorus, new THREE.MeshBasicMaterial({ color: speech, transparent: true, opacity: 0.5, depthWrite: false }));
            chain.scale.setScalar(0.6 + i * 0.05);
            chain.position.copy(pos).add(new THREE.Vector3(Math.cos(a) * 2, 1.5, Math.sin(a) * 2));
            chain.rotation.x = Math.PI / 2;
            scene.add(chain); hitFlashes.push({ mesh: chain, lifetime: 0.55, maxLifetime: 0.55 });
          }
        } else if (moveIdx === 2) {
          for (let i = 0; i < 20; i++) {
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 10, 2 + Math.random() * 5, (Math.random() - 0.5) * 10), 0xff4444, 0.12, 0.5);
          }
        }
        for (let i = 0; i < 18; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8), speech, 0.06, 0.35);
        }

      } else if (techId === 'projSorcery') {
        const gray = 0xdddddd;
        if (moveIdx === 0) {
          const frame = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: gray, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
          frame.scale.set(1.2, 1.6, 1);
          frame.position.copy(pos).add(fw.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 1.5, 0));
          frame.rotation.y = rot; scene.add(frame); hitFlashes.push({ mesh: frame, lifetime: 0.18, maxLifetime: 0.18 });
        } else if (moveIdx === 1) {
          for (let i = 0; i < 4; i++) {
            const dup = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
            dup.scale.set(0.6, 1.2, 1);
            dup.position.copy(pos).add(fw.clone().multiplyScalar(1.8 + i * 0.4)).add(new THREE.Vector3(0, 1.5, 0));
            dup.rotation.y = rot; scene.add(dup); hitFlashes.push({ mesh: dup, lifetime: 0.22, maxLifetime: 0.22 });
          }
        } else if (moveIdx === 2) {
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const bar = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
            bar.scale.set(0.15, 1.5, 1);
            bar.position.copy(pos).add(new THREE.Vector3(Math.cos(a) * 2.5, 1.8, Math.sin(a) * 2.5));
            bar.rotation.y = a + rot;
            scene.add(bar); hitFlashes.push({ mesh: bar, lifetime: 0.5, maxLifetime: 0.5 });
          }
        }
        for (let i = 0; i < 8; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8), 0xcccccc, 0.05, 0.2);
        }

      } else if (techId === 'graniteBlast') {
        const green = 0x336633;
        if (moveIdx === 0) {
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(Math.cos(a) * 2, 0.2, Math.sin(a) * 2)),
              new THREE.Vector3(-Math.cos(a) * 3, 1 + Math.random() * 2, -Math.sin(a) * 3), 0x44aa44, 0.06, 0.55);
          }
        } else if (moveIdx === 1) {
          const bud = new THREE.Mesh(_geoSphere, new THREE.MeshBasicMaterial({ color: 0x228822, transparent: true, opacity: 0.9, depthWrite: false }));
          bud.scale.setScalar(0.9);
          bud.position.copy(pos).add(fw.clone().multiplyScalar(3.5)).add(new THREE.Vector3(0, 1.5, 0));
          scene.add(bud); hitFlashes.push({ mesh: bud, lifetime: 0.45, maxLifetime: 0.45, baseScale: 0.9, isSphere: true });
        } else if (moveIdx === 2) {
          const ball = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: green, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
          ball.scale.set(2.2, 2.2, 1);
          ball.position.copy(pos).add(new THREE.Vector3(0, 1.8, 0));
          scene.add(ball); hitFlashes.push({ mesh: ball, lifetime: 0.5, maxLifetime: 0.5 });
        }
        for (let i = 0; i < 12; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8), green, 0.08, 0.4);
        }

      } else if (techId === 'rotTech') {
        const sick = 0x88cc22;
        if (moveIdx === 0) {
          for (let i = 0; i < 14; i++) {
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), fw.clone().multiplyScalar(10 + Math.random() * 5).add(new THREE.Vector3(0, (Math.random() - 0.5) * 3, 0)), sick, 0.06, 0.4);
          }
        } else if (moveIdx === 1) {
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            spawnParticle(pos.clone().add(new THREE.Vector3(Math.cos(a) * 2, 1.5, Math.sin(a) * 2)), new THREE.Vector3(rt.x * (Math.random() * 5), 2, rt.z * (Math.random() * 5)), sick, 0.06, 0.45);
          }
        } else if (moveIdx === 2) {
          for (let i = 0; i < 16; i++) {
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 10, 2 + Math.random() * 5, (Math.random() - 0.5) * 10), 0xaadd00, 0.12, 0.5);
          }
        }
        for (let i = 0; i < 18; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8), sick, 0.06, 0.35);
        }

      } else if (techId === 'puppet') {
        const mech = 0x448899;
        if (moveIdx === 0) {
          const beam = new THREE.Mesh(_geoCyl, new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.9, depthWrite: false }));
          beam.scale.set(0.25, 0.5 + range * 0.35, 0.25);
          beam.position.copy(pos).add(fw.clone().multiplyScalar(3 + range * 0.25)).add(new THREE.Vector3(0, 1.5, 0));
          beam.rotation.z = Math.PI / 2; beam.rotation.y = rot;
          scene.add(beam); hitFlashes.push({ mesh: beam, lifetime: 0.35, maxLifetime: 0.35 });
        } else if (moveIdx === 1) {
          for (let i = 0; i < 16; i++) {
            spawnParticle(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 4, (Math.random() - 0.5) * 6), 0x66aacc, 0.08, 0.45);
          }
        } else if (moveIdx === 2) {
          for (let i = 0; i < 10; i++) {
            const blade = new THREE.Mesh(_geoPlane, new THREE.MeshBasicMaterial({ color: 0xccffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
            blade.scale.set(0.2, 2.2, 1);
            blade.position.copy(pos).add(fw.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 1.5, 0));
            blade.rotation.y = rot + (Math.random() - 0.5) * 0.5;
            scene.add(blade); hitFlashes.push({ mesh: blade, lifetime: 0.35, maxLifetime: 0.35 });
          }
        }
        for (let i = 0; i < 10; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8), mech, 0.06, 0.35);
        }

      } else {
        for (let i = 0; i < 25; i++) {
          spawnParticle(pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
            new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10),
            col, 0.1 + Math.random() * 0.1, 0.5 + Math.random() * 0.4);
        }
      }

      if (!skipFooterRing) {
        const waveMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
        const wave = new THREE.Mesh(new THREE.RingGeometry(0.3, range * 0.3, 32), waveMat);
        wave.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0)); wave.rotation.x = -Math.PI / 2;
        scene.add(wave); hitFlashes.push({ mesh: wave, lifetime: 0.5, maxLifetime: 0.5 });
      }

      screenFlash('tech', flashAmt);
      cameraShake(shake);
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
