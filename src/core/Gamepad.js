// Gamepad support through the Gamepad API (standard mapping). Buttons become virtual key codes
// 'Pad0'..'Pad16' in Input's down/justDown sets, so every pressed()/held() check works unchanged;
// the sticks feed Input.axis() (analog movement) and Input.look (camera).
//
// Standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start, 10 L3, 11 R3,
// 12 D-pad up, 13 down, 14 left, 15 right, 16 Home.

const DEAD = 0.18; // radial dead zone for both sticks
const TRIGGER = 0.35; // analog triggers count as pressed past this
const NAV_DELAY = 0.38; // menu navigation: first repeat after holding a direction, then every NAV_RATE
const NAV_RATE = 0.12;
const NAV_CODES = { Pad12: [0, -1], Pad13: [0, 1], Pad14: [-1, 0], Pad15: [1, 0] };

// Dead zone, then rescale so the stick still reaches 1 at full tilt.
function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return { x: 0, y: 0, mag: 0 };
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return { x: x * k, y: y * k, mag: Math.min(1, m * k) };
}

export class Gamepad {
  constructor(input) {
    this.input = input;
    this.index = -1; // which navigator.getGamepads() slot we follow
    this.id = '';
    this.prev = [];
    this.move = { x: 0, y: 0, mag: 0 };
    this.look = { x: 0, y: 0 };
    this.sprintLatch = false;
    this.menu = false; // set by Game while a menu wants D-pad / stick navigation
    this.nav = { x: 0, y: 0 }; // this frame's menu step, if any
    this.navHeld = null;
    this.navT = 0;
    this.lastT = 0;
    this.onChange = null; // (connected, id) => void
  }

  get connected() { return this.index >= 0; }

  _find() {
    let pads = [];
    try {
      pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    } catch {
      return null; // blocked by a permissions policy
    }
    if (this.index >= 0 && pads[this.index]?.connected) return pads[this.index];
    return pads.find((p) => p && p.connected && p.buttons?.length) ?? null;
  }

  // Called once per simulation frame, before anything reads input.
  poll(now = performance.now()) {
    const dt = Math.min(0.1, Math.max(0, (now - (this.lastT || now)) / 1000));
    this.lastT = now;
    const pad = this._find();
    const inp = this.input;
    if (!pad) {
      if (this.connected) this._lost();
      return;
    }
    if (pad.index !== this.index) {
      if (this.connected) this._release();
      this.index = pad.index;
      this.id = pad.id || 'Gamepad';
      this.prev = [];
      this.onChange?.(true, this.id);
    }

    let active = false;
    for (let i = 0; i < pad.buttons.length && i < 17; i++) {
      const b = pad.buttons[i];
      const on = !!b && (b.pressed || b.value > TRIGGER);
      const code = 'Pad' + i;
      if (on && !this.prev[i]) {
        inp.down.add(code);
        inp.justDown.add(code);
        active = true;
      } else if (!on && this.prev[i]) inp.down.delete(code);
      this.prev[i] = on;
    }
    const ax = pad.axes ?? [];
    this.move = stick(ax[0] ?? 0, -(ax[1] ?? 0)); // stick up is negative on the pad; forward is +y here
    const r = stick(ax[2] ?? 0, ax[3] ?? 0);
    // A gentle curve on the camera stick: fine aim near the centre, full speed at the rim.
    this.look = { x: r.x * Math.abs(r.x) * 0.6 + r.x * 0.4, y: r.y * Math.abs(r.y) * 0.6 + r.y * 0.4 };
    if (this.move.mag > 0 || r.mag > 0) active = true;

    // L3 latches a sprint until the stick comes back to centre (Shift's job on the keyboard).
    if (inp.justDown.has('Pad10')) this.sprintLatch = true;
    if (this.move.mag < 0.25) this.sprintLatch = false;
    if (this.sprintLatch) inp.down.add('PadSprint');
    else inp.down.delete('PadSprint');

    this._navigate(dt);
    if (active) inp.usingPad = true;
  }

  // Menu steps from the D-pad and the left stick, with a held-direction repeat.
  _navigate(dt) {
    this.nav = { x: 0, y: 0 };
    if (!this.menu) {
      this.navHeld = null;
      return;
    }
    let dir = null;
    for (const [code, d] of Object.entries(NAV_CODES)) if (this.input.down.has(code)) dir = d;
    const m = this.move;
    if (!dir && m.mag > 0.55) dir = Math.abs(m.x) > Math.abs(m.y) ? [Math.sign(m.x), 0] : [0, -Math.sign(m.y)];
    const key = dir ? dir.join() : null;
    if (key !== this.navHeld) {
      this.navHeld = key;
      this.navT = NAV_DELAY;
      if (dir) this.nav = { x: dir[0], y: dir[1] };
    } else if (dir && (this.navT -= dt) <= 0) {
      this.navT = NAV_RATE;
      this.nav = { x: dir[0], y: dir[1] };
    }
  }

  _release() {
    for (let i = 0; i < 17; i++) this.input.down.delete('Pad' + i);
    this.input.down.delete('PadSprint');
    this.prev = [];
    this.move = { x: 0, y: 0, mag: 0 };
    this.look = { x: 0, y: 0 };
    this.sprintLatch = false;
  }

  _lost() {
    this._release();
    const id = this.id;
    this.index = -1;
    this.id = '';
    this.input.usingPad = false;
    this.onChange?.(false, id);
  }
}

// ---------- menu navigation helpers (D-pad / stick over DOM buttons) ----------

const FOCUSABLE = 'button:not(:disabled), input[type=range]';

const visible = (el) => el.getClientRects().length > 0 && !el.closest('[hidden]');

export function focusables(root) {
  return root ? [...root.querySelectorAll(FOCUSABLE)].filter(visible) : [];
}

export function focusFirst(root) {
  const list = focusables(root);
  const pick = list.find((b) => b.classList.contains('primary')) ?? list[0];
  pick?.focus({ preventScroll: false });
  return pick ?? null;
}

// Moves focus to the nearest control in direction (dx, dy) inside `root`. A focused slider takes
// left/right as value changes instead.
export function navigate(root, dx, dy) {
  const list = focusables(root);
  if (!list.length) return null;
  const cur = list.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) return focusFirst(root);
  if (cur.type === 'range' && dx) {
    const step = Number(cur.step) || 1;
    cur.value = String(Number(cur.value) + dx * step * 2);
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    return cur;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  // Sideways distance counts only as the gap between the two boxes, so a control that shares a
  // column (or row) with the current one wins over a nearer one off to the side.
  const gap = (lo1, hi1, lo2, hi2) => Math.max(0, lo2 - hi1, lo1 - hi2);
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const vx = b.left + b.width / 2 - ax, vy = b.top + b.height / 2 - ay;
    const along = vx * dx + vy * dy;
    if (along <= 4) continue;
    const side = dx ? gap(a.top, a.bottom, b.top, b.bottom) : gap(a.left, a.right, b.left, b.right);
    const score = along + side * 3 + Math.abs(dx ? vy : vx) * 0.1;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  return best ?? cur;
}
