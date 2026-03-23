    // ═══════ INPUT & CAMERA DRAG ═══════
    const keys = {};
    let cameraYaw = 0, cameraPitch = 0.35;
    const camDist = 8, camSmooth = { pos: new THREE.Vector3(0, 5, 10), tgt: new THREE.Vector3() };
    let ptrLocked = false, homeOpen = false;

    // Right-click drag state
    let rmbDown = false, rmbDragActive = false;
    let lastMouseX = 0, lastMouseY = 0;

    document.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'Tab') { e.preventDefault(); homeOpen ? closeHomePanel() : openHomePanel(); return; }
      if (!gameStarted) return;
      if (e.code === 'KeyQ') activateAbilityQ();
      if (e.code === 'KeyE') activateTechMove(0);
      if (e.code === 'KeyR') activateTechMove(1);
      if (e.code === 'KeyT') activateTechMove(2);
      if (e.code === 'KeyF') activateTechMove(3);
      if (e.code === 'KeyG' && typeof interactWithNPC !== 'undefined') interactWithNPC();
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });

    document.addEventListener('mousemove', e => {
      // Pointer lock path (fallback when locked)
      if (ptrLocked) {
        cameraYaw -= e.movementX * 0.003; cameraPitch += e.movementY * 0.003;
        cameraPitch = Math.max(-0.5, Math.min(1.2, cameraPitch)); return;
      }
      // Right-click drag path
      if (rmbDown) {
        const dx = e.clientX - lastMouseX, dy = e.clientY - lastMouseY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) rmbDragActive = true;
        cameraYaw -= dx * 0.005;
        cameraPitch += dy * 0.005;
        cameraPitch = Math.max(-0.5, Math.min(1.2, cameraPitch));
        lastMouseX = e.clientX; lastMouseY = e.clientY;
        document.getElementById('xhair').classList.add('rmb-drag');
      }
    });

    document.addEventListener('mousedown', e => {
      if (!gameStarted) return;
      if (e.button === 2) {
        rmbDown = true; rmbDragActive = false;
        lastMouseX = e.clientX; lastMouseY = e.clientY;
        document.body.style.cursor = 'grabbing';
      }
      if (e.button === 0) {
        // Left click — light attack (or request pointer lock if canvas clicked)
        if (!ptrLocked && e.target === renderer.domElement) { renderer.domElement.requestPointerLock(); }
        performLightAttack();
      }
    });

    document.addEventListener('mouseup', e => {
      if (e.button === 2) {
        // If barely moved, treat as heavy attack click
        if (!rmbDragActive && gameStarted) performHeavyAttack();
        rmbDown = false; rmbDragActive = false;
        document.getElementById('xhair').classList.remove('rmb-drag');
        document.body.style.cursor = 'crosshair';
      }
    });

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      ptrLocked = document.pointerLockElement === renderer.domElement;
    });
