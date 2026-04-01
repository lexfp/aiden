// =============================================================================
// STORM ZONE — Input Manager
// Centralises keyboard, mouse, and pointer-lock state.
// =============================================================================

class InputManager {
  constructor(canvas) {
    this.canvas = canvas;

    // Held keys — keyed by KeyboardEvent.code
    this.keys = {};
    // Keys pressed this frame only
    this._justPressed = {};
    // Mouse deltas accumulated since last flush()
    this.mouseX = 0;
    this.mouseY = 0;
    // Mouse button states
    this.mouseLeft  = false;
    this.mouseRight = false;
    this._leftJust  = false;
    this._rightJust = false;
    // Scroll wheel delta
    this.scrollDelta = 0;

    this.locked = false;

    // Mobile joystick state (analog, -1..1)
    this.joyMoveX = 0;
    this.joyMoveY = 0;
    this.joyLookX = 0;
    this.joyLookY = 0;
    this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    this._bind();
    if (this.isMobile) this._bindTouch();
  }

  _bind() {
    const canvas = this.canvas;

    // Pointer lock on click (desktop only)
    if (!this.isMobile) {
      canvas.addEventListener('click', () => {
        if (!this.locked) canvas.requestPointerLock();
      });
    }

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', e => {
      if (this.locked) {
        this.mouseX += e.movementX;
        this.mouseY += e.movementY;
      }
    });

    document.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mouseLeft  = true; this._leftJust  = true; }
      if (e.button === 2) { this.mouseRight = true; this._rightJust = true; }
    });

    document.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseLeft  = false;
      if (e.button === 2) this.mouseRight = false;
    });

    document.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('keydown', e => {
      if (!this.keys[e.code]) this._justPressed[e.code] = true;
      this.keys[e.code] = true;
      // Prevent space/arrow scrolling the page
      if (['Space','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
    });

    document.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    canvas.addEventListener('wheel', e => {
      this.scrollDelta += e.deltaY > 0 ? 1 : -1;
    });
  }

  // Returns true if key was pressed this frame
  justPressed(code) { return !!this._justPressed[code]; }

  // Call at end of each frame to clear per-frame state
  flush() {
    this._justPressed = {};
    this._leftJust  = false;
    this._rightJust = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.scrollDelta = 0;
    this.joyLookX = 0;
    this.joyLookY = 0;
  }

  // ── Mobile touch controls ──────────────────────────────────────────────────
  _bindTouch() {
    // Show mobile UI
    document.querySelectorAll('.joystick-zone, .mobile-btn').forEach(el => {
      el.style.display = 'block';
    });

    // On mobile, skip pointer-lock and treat as always "locked" for camera
    this.locked = true;

    const self = this;

    // --- Joystick logic ---
    this._setupJoystick('joystickLeft', 'knobLeft', (nx, ny) => {
      self.joyMoveX = nx;
      self.joyMoveY = ny;
    }, () => {
      self.joyMoveX = 0;
      self.joyMoveY = 0;
    });

    this._setupJoystick('joystickRight', 'knobRight', (nx, ny) => {
      // Map to mouse-like deltas each frame
      self.joyLookX += nx * 8;
      self.joyLookY += ny * 8;
    }, () => {});

    // --- Action buttons ---
    const fireBtn = document.getElementById('mobileFireBtn');
    fireBtn.addEventListener('touchstart', e => { e.preventDefault(); self.mouseLeft = true; self._leftJust = true; });
    fireBtn.addEventListener('touchend',   e => { e.preventDefault(); self.mouseLeft = false; });

    const jumpBtn = document.getElementById('mobileJumpBtn');
    jumpBtn.addEventListener('touchstart', e => { e.preventDefault(); self._justPressed['Space'] = true; self.keys['Space'] = true; });
    jumpBtn.addEventListener('touchend',   e => { e.preventDefault(); self.keys['Space'] = false; });

    const reloadBtn = document.getElementById('mobileReloadBtn');
    reloadBtn.addEventListener('touchstart', e => { e.preventDefault(); self._justPressed['KeyR'] = true; });

    const interactBtn = document.getElementById('mobileInteractBtn');
    interactBtn.addEventListener('touchstart', e => { e.preventDefault(); self._justPressed['KeyE'] = true; });
  }

  _setupJoystick(zoneId, knobId, onMove, onEnd) {
    const zone = document.getElementById(zoneId);
    const knob = document.getElementById(knobId);
    let touchId = null;
    const maxR = 45; // max knob travel in px

    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchId = t.identifier;
      _update(t);
    });

    zone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) { _update(t); break; }
      }
    });

    const endHandler = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) {
          touchId = null;
          knob.style.transform = 'translate(-50%, -50%)';
          onEnd();
          break;
        }
      }
    };
    zone.addEventListener('touchend', endHandler);
    zone.addEventListener('touchcancel', endHandler);

    function _update(touch) {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      onMove(dx / maxR, dy / maxR);
    }
  }
}
