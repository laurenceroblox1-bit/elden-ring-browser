// Keyboard + mouse input with action bindings, per-frame edge detection and pointer lock.
export const BINDINGS = {
  forward: ['KeyW'],
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  roll: ['Space'],
  light: ['Mouse0'],
  heavy: ['Mouse2', 'KeyF'],
  lockOn: ['KeyQ', 'Mouse1'],
  flask: ['KeyR'],
  interact: ['KeyE'],
  whistle: ['KeyH'],
  journal: ['KeyJ'],
  pause: ['Escape', 'KeyP'],
  camLeft: ['ArrowLeft'],
  camRight: ['ArrowRight'],
  camUp: ['ArrowUp'],
  camDown: ['ArrowDown'],
};

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  constructor(el) {
    this.el = el;
    this.down = new Set();
    this.justDown = new Set();
    this.consumed = new Set();
    this.mdx = 0;
    this.mdy = 0;
    this.wheel = 0;
    this.locked = false;
    this.onLockChange = null;

    addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.justDown.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    el.addEventListener('mousedown', (e) => {
      // The first click only captures the mouse; it shouldn't also swing the sword.
      if (this.captureOnClick && !this.locked && !this.lockFailed && e.button === 0) {
        this.requestLock();
        return;
      }
      this.down.add('Mouse' + e.button);
      this.justDown.add('Mouse' + e.button);
    });
    addEventListener('mouseup', (e) => this.down.delete('Mouse' + e.button));
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mdx += e.movementX;
      this.mdy += e.movementY;
    });
    el.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => this.down.clear());
    // Some embeds and browsers refuse pointer lock; fall back to arrow-key camera and normal clicks.
    // A refusal only counts as "unsupported" if a lock has never worked (Chrome also refuses briefly after Esc).
    document.addEventListener('pointerlockerror', () => this._lockRefused());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (this.locked) {
        this.everLocked = true;
        this.lockFailed = false;
      }
      this.onLockChange?.(this.locked);
    });
  }

  requestLock() {
    if (!this.el.requestPointerLock) {
      this._lockRefused();
      return;
    }
    try {
      const p = this.el.requestPointerLock();
      if (p && p.catch) p.catch(() => this._lockRefused());
    } catch {
      this._lockRefused(); // pointer lock is optional (phones, some embeds)
    }
  }

  _lockRefused() {
    if (!this.everLocked) this.lockFailed = true;
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  held(action) {
    return BINDINGS[action].some((c) => this.down.has(c));
  }

  pressed(action) {
    if (this.consumed.has(action)) return false;
    return BINDINGS[action].some((c) => this.justDown.has(c));
  }

  // Stops later readers in the same frame from also seeing the press.
  consume(action) {
    this.consumed.add(action);
  }

  axis() {
    const x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const y = (this.held('forward') ? 1 : 0) - (this.held('back') ? 1 : 0);
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len, mag: 1 } : { x: 0, y: 0, mag: 0 };
  }

  endFrame() {
    this.justDown.clear();
    this.consumed.clear();
    this.mdx = 0;
    this.mdy = 0;
    this.wheel = 0;
  }
}
