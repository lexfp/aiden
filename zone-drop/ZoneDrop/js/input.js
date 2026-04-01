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

    // Pointer lock on click
    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock();
    });

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
  }
}
