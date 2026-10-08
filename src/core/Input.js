// Keyboard, mouse and gamepad input with action bindings, per-frame edge detection and pointer lock.
// Gamepad buttons arrive as virtual codes 'Pad0'..'Pad16' (standard mapping, see Gamepad.js), plus
// 'PadSprint' while L3's sprint latch holds.
import { Gamepad } from './Gamepad.js';

export const BINDINGS = {
  forward: ['KeyW'],
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  sprint: ['ShiftLeft', 'ShiftRight', 'PadSprint'],
  roll: ['Space', 'Pad0'], // A
  light: ['Mouse0', 'Pad5'], // RB
  heavy: ['KeyF', 'Pad7'], // RT
  guard: ['Mouse2', 'Pad4'], // LB. Hold to guard; a fresh press opens a short parry window
  art: ['KeyC', 'Pad6'], // LT: weapon art
  rite: ['KeyV', 'Pad12'], // D-pad up: cast the equipped rite
  lockOn: ['KeyQ', 'Mouse1', 'Pad11'], // R3
  flask: ['KeyR', 'Pad2'], // X
  interact: ['KeyE', 'Pad1'], // B
  whistle: ['KeyH', 'Pad3'], // Y
  journal: ['KeyJ', 'Pad8'], // Back / Select
  equipment: ['KeyI', 'Pad13'], // D-pad down
  map: ['KeyM', 'Pad15'], // D-pad right
  testMenu: ['Backquote'],
  multiplayer: ['KeyN'],
  chat: ['Enter', 'NumpadEnter'],
  pause: ['Escape', 'KeyP', 'Pad9'], // Start
  back: ['Pad1'], // B closes menus
  confirm: ['Pad0'], // A presses the focused menu button
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
    this.fullTilt = false;
    this.usingPad = false; // true from the last gamepad input until the keyboard or mouse is used again
    this.pad = new Gamepad(this);

    addEventListener('keydown', (e) => {
      // Typing in a text field (chat, save codes) isn't playing. Key-ups still count, so nothing sticks.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (PREVENT.has(e.code)) e.preventDefault();
      this.usingPad = false;
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
      this.usingPad = false;
      this.down.add('Mouse' + e.button);
      this.justDown.add('Mouse' + e.button);
    });
    addEventListener('mouseup', (e) => this.down.delete('Mouse' + e.button));
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.usingPad = false;
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

  // Removes one raw code's press for this frame (menus take the D-pad before the game sees it).
  eat(code) {
    this.justDown.delete(code);
  }

  // Reads the gamepad. Game calls this at the start of every simulation frame.
  poll() {
    this.pad.poll();
  }

  // Movement intent in stick space (+y forward). Keys give a unit vector; the left stick keeps its
  // analog magnitude, so a half-tilted stick walks at half speed. Game sets `fullTilt` on the frame a
  // roll starts, because a roll takes its length from this vector and should always go the full way.
  axis() {
    const x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const y = (this.held('forward') ? 1 : 0) - (this.held('back') ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 0) return { x: x / len, y: y / len, mag: 1 };
    const m = this.pad.move;
    if (!(m.mag > 0)) return { x: 0, y: 0, mag: 0 };
    if (this.fullTilt) return { x: m.x / m.mag, y: m.y / m.mag, mag: 1 };
    return { x: m.x, y: m.y, mag: m.mag };
  }

  // Camera stick, -1..1 per axis (x right, y down).
  get look() {
    return this.pad.look;
  }

  endFrame() {
    this.justDown.clear();
    this.consumed.clear();
    this.mdx = 0;
    this.mdy = 0;
    this.wheel = 0;
  }
}
