    // ═══════ SKINNED MESH HELPERS ═══════
    function mergeSkinnedGeos(parts) {
      let totalV = 0;
      parts.forEach(p => totalV += p.geo.attributes.position.count);
      const pos = new Float32Array(totalV * 3), nrm = new Float32Array(totalV * 3), col = new Float32Array(totalV * 3);
      const sIdx = new Float32Array(totalV * 4), sWgt = new Float32Array(totalV * 4);
      const indices = [];
      let vOff = 0;
      parts.forEach(p => {
        const pp = p.geo.attributes.position, pn = p.geo.attributes.normal, cnt = pp.count;
        const r = ((p.color >> 16) & 0xff) / 255, gg = ((p.color >> 8) & 0xff) / 255, b = (p.color & 0xff) / 255;
        for (let i = 0; i < cnt; i++) {
          const vi = (vOff + i) * 3;
          pos[vi] = pp.getX(i); pos[vi + 1] = pp.getY(i); pos[vi + 2] = pp.getZ(i);
          nrm[vi] = pn.getX(i); nrm[vi + 1] = pn.getY(i); nrm[vi + 2] = pn.getZ(i);
          col[vi] = r; col[vi + 1] = gg; col[vi + 2] = b;
          const wi = (vOff + i) * 4;
          sIdx[wi] = p.si[i][0]; sIdx[wi + 1] = p.si[i][1]; sIdx[wi + 2] = p.si[i][2]; sIdx[wi + 3] = p.si[i][3];
          sWgt[wi] = p.sw[i][0]; sWgt[wi + 1] = p.sw[i][1]; sWgt[wi + 2] = p.sw[i][2]; sWgt[wi + 3] = p.sw[i][3];
        }
        if (p.geo.index) { const idx = p.geo.index; for (let i = 0; i < idx.count; i++)indices.push(idx.getX(i) + vOff); }
        else { for (let i = 0; i < cnt; i++)indices.push(i + vOff); }
        vOff += cnt;
      });
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      merged.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      merged.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      merged.setAttribute('skinIndex', new THREE.Float32BufferAttribute(sIdx, 4));
      merged.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sWgt, 4));
      if (indices.length) merged.setIndex(indices);
      return merged;
    }

    function createPlayerModel() {
      const g = player.group; g.clear();

      // ── BONE HIERARCHY ──
      // Indices: 0=hips 1=torso 2=head 3=lShoulder 4=lElbow 5=lHand 6=rShoulder 7=rElbow 8=rHand 9=lHip 10=lKnee 11=lAnkle 12=rHip 13=rKnee 14=rAnkle
      const bones = [];
      function mkBone(nm, par, x, y, z) { const b = new THREE.Bone(); b.name = nm; b.position.set(x, y, z); if (par) par.add(b); bones.push(b); return b; }

      const hipsBone = mkBone('hips', null, 0, 1.1, 0);
      const torsoBone = mkBone('torso', hipsBone, 0, 0.6, 0);
      const headBone = mkBone('head', torsoBone, 0, 0.78, 0);
      const lShBone = mkBone('leftArmPivot', torsoBone, -0.65, 0.5, 0);
      const lElBone = mkBone('leftArmElbow', lShBone, 0, -0.52, 0);
      const lHaBone = mkBone('leftHand', lElBone, 0, -0.46, 0);
      const rShBone = mkBone('rightArmPivot', torsoBone, 0.65, 0.5, 0);
      const rElBone = mkBone('rightArmElbow', rShBone, 0, -0.52, 0);
      const rHaBone = mkBone('rightHand', rElBone, 0, -0.46, 0);
      const lHpBone = mkBone('leftLegPivot', hipsBone, -0.21, -0.02, 0);
      const lKnBone = mkBone('leftLegKnee', lHpBone, 0, -0.52, 0);
      const lAnBone = mkBone('leftAnkle', lKnBone, 0, -0.54, 0);
      const rHpBone = mkBone('rightLegPivot', hipsBone, 0.21, -0.02, 0);
      const rKnBone = mkBone('rightLegKnee', rHpBone, 0, -0.52, 0);
      const rAnBone = mkBone('rightAnkle', rKnBone, 0, -0.54, 0);

      // ── BUILD SKINNED BODY GEOMETRY ──
      // All positions in bind-pose mesh space (Y=0 is ground)
      // Bone world positions: hips=1.1 torso=1.7 head=2.48 shoulders=2.2 elbows=1.68 hands=1.22 hipJoints=1.08 knees=0.56 ankles=0.02
      const outCol = AC.outfitColor, skCol = AC.skinColor;
      const collarCol = new THREE.Color(outCol).multiplyScalar(0.7).getHex();
      const parts = [];

      // Cylinder blended between two bones along Y gradient
      function seg(rT, rB, h, segs, b1, b2, cx, cy, cz, color) {
        const geo = new THREE.CylinderGeometry(rT, rB, h, segs, 4); geo.translate(cx, cy, cz);
        const pp = geo.attributes.position, cnt = pp.count, si = [], sw = [];
        const yMin = cy - h / 2, range = h || 1;
        for (let i = 0; i < cnt; i++) { const t = Math.max(0, Math.min(1, (pp.getY(i) - yMin) / range)); si.push([b1, b2, 0, 0]); sw.push([1 - t, t, 0, 0]); }
        parts.push({ geo, si, sw, color });
      }
      // Rigid single-bone cylinder
      function segR(rT, rB, h, segs, bIdx, cx, cy, cz, color) {
        const geo = new THREE.CylinderGeometry(rT, rB, h, segs, 1); geo.translate(cx, cy, cz);
        const cnt = geo.attributes.position.count, si = [], sw = [];
        for (let i = 0; i < cnt; i++) { si.push([bIdx, 0, 0, 0]); sw.push([1, 0, 0, 0]); }
        parts.push({ geo, si, sw, color });
      }
      // Rigid single-bone sphere
      function sph(r, s1, s2, bIdx, cx, cy, cz, color) {
        const geo = new THREE.SphereGeometry(r, s1, s2); geo.translate(cx, cy, cz);
        const cnt = geo.attributes.position.count, si = [], sw = [];
        for (let i = 0; i < cnt; i++) { si.push([bIdx, 0, 0, 0]); sw.push([1, 0, 0, 0]); }
        parts.push({ geo, si, sw, color });
      }
      // Blended sphere between two bones
      function sphB(r, s1, s2, b1, b2, w1, cx, cy, cz, color) {
        const geo = new THREE.SphereGeometry(r, s1, s2); geo.translate(cx, cy, cz);
        const cnt = geo.attributes.position.count, si = [], sw = [];
        for (let i = 0; i < cnt; i++) { si.push([b1, b2, 0, 0]); sw.push([w1, 1 - w1, 0, 0]); }
        parts.push({ geo, si, sw, color });
      }
      // Rigid single-bone box
      function box(w, h, d, bIdx, cx, cy, cz, color) {
        const geo = new THREE.BoxGeometry(w, h, d); geo.translate(cx, cy, cz);
        const cnt = geo.attributes.position.count, si = [], sw = [];
        for (let i = 0; i < cnt; i++) { si.push([bIdx, 0, 0, 0]); sw.push([1, 0, 0, 0]); }
        parts.push({ geo, si, sw, color });
      }

      // ── TORSO (hips y=1.1 → torso y=1.7 → collar y=2.3) ──
      seg(0.30, 0.44, 0.60, 10, 0, 1, 0, 1.40, 0, outCol);     // lower torso hips→torso
      seg(0.44, 0.36, 0.60, 10, 1, 1, 0, 2.00, 0, outCol);     // upper chest (rigid to torso)
      sphB(0.32, 8, 6, 0, 1, 0.7, 0, 1.40, 0, outCol);           // waist connector
      sphB(0.28, 8, 6, 1, 1, 1.0, 0, 2.30, 0, outCol);           // chest cap
      segR(0.46, 0.46, 0.14, 10, 0, 0, 1.10, 0, 0x4422aa);      // belt
      segR(0.39, 0.34, 0.12, 10, 1, 0, 2.28, 0, collarCol);     // collar

      // ── NECK (torso→head) ──
      seg(0.13, 0.11, 0.20, 8, 1, 2, 0, 2.38, 0, skCol);

      // ── HEAD ──
      sph(0.32, 14, 10, 2, 0, 2.48, 0, skCol);

      // ── SHOULDER JOINTS ──
      sphB(0.14, 8, 6, 1, 3, 0.4, -0.65, 2.20, 0, outCol);
      sphB(0.14, 8, 6, 1, 6, 0.4, 0.65, 2.20, 0, outCol);

      // ── LEFT ARM: upper(3→4) elbow(4) forearm(4→5) hand(5) ──
      seg(0.13, 0.11, 0.52, 8, 3, 4, -0.65, 1.94, 0, outCol);
      sph(0.12, 6, 5, 4, -0.65, 1.68, 0, outCol);
      seg(0.11, 0.10, 0.44, 8, 4, 5, -0.65, 1.46, 0, outCol);
      sph(0.13, 8, 6, 5, -0.65, 1.22, 0, skCol);

      // ── RIGHT ARM: upper(6→7) elbow(7) forearm(7→8) hand(8) ──
      seg(0.13, 0.11, 0.52, 8, 6, 7, 0.65, 1.94, 0, outCol);
      sph(0.12, 6, 5, 7, 0.65, 1.68, 0, outCol);
      seg(0.11, 0.10, 0.44, 8, 7, 8, 0.65, 1.46, 0, outCol);
      sph(0.13, 8, 6, 8, 0.65, 1.22, 0, skCol);

      // ── HIP JOINTS ──
      sphB(0.16, 6, 5, 0, 9, 0.4, -0.21, 1.08, 0, 0x080810);
      sphB(0.16, 6, 5, 0, 12, 0.4, 0.21, 1.08, 0, 0x080810);

      // ── LEFT LEG: thigh(9→10) knee(10) shin(10→11) boot(11) ──
      seg(0.16, 0.14, 0.52, 8, 9, 10, -0.21, 0.82, 0, 0x080810);
      sph(0.14, 6, 5, 10, -0.21, 0.56, 0, 0x080810);
      seg(0.13, 0.12, 0.50, 8, 10, 11, -0.21, 0.31, 0, 0x080810);
      box(0.26, 0.18, 0.32, 11, -0.21, 0.02, -0.04, 0x1a1128);

      // ── RIGHT LEG: thigh(12→13) knee(13) shin(13→14) boot(14) ──
      seg(0.16, 0.14, 0.52, 8, 12, 13, 0.21, 0.82, 0, 0x080810);
      sph(0.14, 6, 5, 13, 0.21, 0.56, 0, 0x080810);
      seg(0.13, 0.12, 0.50, 8, 13, 14, 0.21, 0.31, 0, 0x080810);
      box(0.26, 0.18, 0.32, 14, 0.21, 0.02, -0.04, 0x1a1128);

      // ── MERGE & CREATE SKINNED MESH ──
      const merged = mergeSkinnedGeos(parts);
      const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.3, side: THREE.DoubleSide });
      const bodyMesh = new THREE.SkinnedMesh(merged, bodyMat);
      bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; bodyMesh.frustumCulled = false;
      bodyMesh.name = 'bodyMesh';
      bodyMesh.add(hipsBone);
      g.add(bodyMesh);
      // Force full world matrix computation before binding
      bodyMesh.updateMatrixWorld(true);
      const skeleton = new THREE.Skeleton(bones);
      bodyMesh.bind(skeleton, bodyMesh.matrixWorld.clone());

      // ── HAIR (children of head bone — positioned relative to bone) ──
      const hairMat = new THREE.MeshStandardMaterial({ color: AC.hairColor, roughness: 0.65 });
      const spikeCount = AC.hairStyle === 3 ? 10 : 7;
      if (AC.hairStyle === 0 || AC.hairStyle === 3) {
        for (let i = 0; i < spikeCount; i++) {
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42 + Math.random() * 0.28, 4), hairMat);
          const a = (i / spikeCount) * Math.PI * 2;
          sp.position.set(Math.cos(a) * 0.22, 0.25 + Math.random() * 0.08, Math.sin(a) * 0.22);
          sp.rotation.x = Math.sin(a) * (AC.hairStyle === 3 ? 0.65 : 0.42); sp.rotation.z = -Math.cos(a) * (AC.hairStyle === 3 ? 0.65 : 0.42);
          headBone.add(sp);
        }
      } else if (AC.hairStyle === 1) {
        const lh = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.82, 0.13), hairMat); lh.position.set(0, 0.02, 0.2); headBone.add(lh);
        const tp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 7), hairMat); tp.scale.set(1, 0.48, 1); tp.position.y = 0.12; headBone.add(tp);
      } else {
        const cp = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 7), hairMat); cp.scale.set(1, 0.44, 1); cp.position.y = 0.11; headBone.add(cp);
      }

      // ── EYES (children of head bone) ──
      const eyeM = new THREE.MeshBasicMaterial({ color: AC.eyeColor });
      [-0.1, 0.1].forEach(ex => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), eyeM);
        e.position.set(ex, 0.02, -0.28); headBone.add(e);
        const eg = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: AC.eyeColor, transparent: true, opacity: 0.25, depthWrite: false }));
        eg.position.set(ex, 0.02, -0.27); headBone.add(eg);
      });

      // ── KNUCKLE GLOW (children of hand bones) ──
      [['left', lHaBone], ['right', rHaBone]].forEach(([side, hb]) => {
        const kg = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: AC.eyeColor, transparent: true, opacity: 0, depthWrite: false }));
        kg.name = side + 'Knuckle'; hb.add(kg);
      });

      // ── ACCESSORIES (children of bones for animation) ──
      // Shoulder armor pads
      const armorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(outCol).multiplyScalar(0.6).getHex(), roughness: 0.3, metalness: 0.7 });
      const lPad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.26), armorMat);
      lPad.position.set(-0.15, 0.05, 0); lShBone.add(lPad);
      const rPad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.26), armorMat);
      rPad.position.set(0.15, 0.05, 0); rShBone.add(rPad);

      // Belt with technique-colored buckle
      const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08),
        new THREE.MeshBasicMaterial({ color: playerTech ? playerTech.hex : 0x8844ff }));
      beltBuckle.position.set(0, -0.48, -0.24); torsoBone.add(beltBuckle);

      // Scarf/bandana (animated cloth hanging from neck)
      const scarfMat = new THREE.MeshStandardMaterial({ color: playerTech ? playerTech.hex : AC.eyeColor, roughness: 0.8, side: THREE.DoubleSide });
      const scarf1 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.5), scarfMat);
      scarf1.position.set(0.08, -0.1, 0.16); scarf1.name = 'scarfTail1'; headBone.add(scarf1);
      const scarf2 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.4), scarfMat);
      scarf2.position.set(-0.06, -0.15, 0.15); scarf2.name = 'scarfTail2'; headBone.add(scarf2);

      // Glowing eye trails (technique colored, visible during combat)
      const eyeTrailMat = new THREE.MeshBasicMaterial({ color: AC.eyeColor, transparent: true, opacity: 0, depthWrite: false });
      const eyeTrailL = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.2), eyeTrailMat);
      eyeTrailL.position.set(-0.1, 0.02, -0.32); eyeTrailL.name = 'eyeTrailL'; headBone.add(eyeTrailL);
      const eyeTrailR = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.2), eyeTrailMat.clone());
      eyeTrailR.position.set(0.1, 0.02, -0.32); eyeTrailR.name = 'eyeTrailR'; headBone.add(eyeTrailR);

      // Technique-matching aura effects on hands
      if (playerTech) {
        const handAuraMat = new THREE.MeshBasicMaterial({ color: playerTech.hex, transparent: true, opacity: 0, depthWrite: false });
        const lhAura = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), handAuraMat);
        lhAura.name = 'leftHandAura'; lHaBone.add(lhAura);
        const rhAura = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), handAuraMat.clone());
        rhAura.name = 'rightHandAura'; rHaBone.add(rhAura);
      }

      // ── AURA (not skinned — attached to group) ──
      const aura = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 16), new THREE.MeshBasicMaterial({ color: 0x8844ff, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false }));
      aura.position.y = 1.5; aura.name = 'aura'; g.add(aura);
      const auraCore = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), new THREE.MeshBasicMaterial({ color: 0x8844ff, transparent: true, opacity: 0, depthWrite: false }));
      auraCore.position.y = 1.8; auraCore.name = 'auraCore'; g.add(auraCore);

      g.position.set(0, 0, 0); if (!g.parent) scene.add(g);

      // Store refs
      torsoRef = torsoBone;
      headRef = headBone;
      hipsRef = hipsBone;

      tryLoadGLTFPlayer();
    }
