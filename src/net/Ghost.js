// Another player in your Vale: the same knight model as yours (in their own cloak colour), with a name
// over their head, posed joint for joint from what their game sends (see Net.js capture()). Between
// messages every value eases toward the latest one, so 15 updates a second still move smoothly.
// Their horse appears under them while they ride.
import * as THREE from '../lib/three.js';
import { buildPlayer } from '../models/characters.js';
import { buildHorse } from '../models/horse.js';
import { equipModel } from '../models/weapons.js';
import { damp, dampAngle } from '../core/math.js';
import { WEAPONS, SHIELDS } from '../data/weapons.js';

// Messages come from other players: anything malformed is dropped rather than drawn.
const nums = (a, n) => Array.isArray(a) && a.length >= n && a.length <= 200 && a.every((v) => typeof v === 'number' && Number.isFinite(v));
function valid(m) {
  if (!m || !nums(m.p, 3) || !nums(m.r, 3) || !nums(m.b, 3) || !Number.isFinite(m.py) || !Number.isFinite(m.hy)) return false;
  if (m.h && (!nums(m.h.p, 3) || !nums(m.h.b, 3) || !Number.isFinite(m.h.y) || !Number.isFinite(m.h.by))) return false;
  return true;
}

// Cloak colours handed out by player id.
const CLOAKS = [0x8a3a30, 0x3a5a8a, 0x7a6a2a, 0x5a3a7a, 0x2a6a4a, 0x8a5a2a, 0x6a6a6a, 0x2a2a3a];

// The joints a pose moves, in a fixed order shared by sender and receiver.
export const playerJoints = (r) => [
  r.pivot, r.hips, r.torso, r.head, r.armR.shoulder, r.armR.elbow, r.armR.hand,
  r.armL.shoulder, r.armL.elbow, r.armL.hand, r.legR.hip, r.legR.knee, r.legL.hip, r.legL.knee, r.cloak,
];
export const horseJoints = (h) => [h.body, h.neck, h.head, h.tail, ...h.legs.flatMap((l) => [l.hip, l.knee])];

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 48;
  const x = c.getContext('2d');
  x.font = '600 26px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineWidth = 5;
  x.strokeStyle = 'rgba(20, 16, 12, 0.85)';
  x.strokeText(text, 128, 24);
  x.fillStyle = '#efe2c0';
  x.fillText(text, 128, 24);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(2.0, 0.375, 1);
  s.renderOrder = 6;
  return s;
}

export class Ghost {
  constructor(game, id, name) {
    this.game = game;
    this.id = id;
    this.name = name;
    this.model = buildPlayer();
    this._tint(CLOAKS[id % CLOAKS.length]);
    this.joints = playerJoints(this.model);
    this.tag = nameTag(name);
    this.tag.position.y = 2.35;
    this.model.root.add(this.tag);
    this.model.root.visible = false;
    game.scene.add(this.model.root);
    this.target = null; // the latest message
    this.horse = null;
    this.weapon = 'wayfarer_blade';
    this.shield = null;
    this.seen = 0; // seconds since the last message
  }

  // Their cloak and tabard in their own colour (the shared cloth material is swapped for a copy).
  _tint(hex) {
    const copies = new Map();
    this.model.root.traverse((o) => {
      if (!o.isMesh) return;
      const swap = (m) => {
        if (!m?.color || m.color.getHex() !== 0x2d4a4c) return m;
        if (!copies.has(m)) copies.set(m, Object.assign(m.clone(), { color: new THREE.Color(hex) }));
        return copies.get(m);
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
  }

  setName(name) {
    this.name = name;
    this.model.root.remove(this.tag);
    this.tag.material.map.dispose();
    this.tag.material.dispose();
    this.tag = nameTag(name);
    this.tag.position.y = 2.35;
    this.model.root.add(this.tag);
  }

  receive(m) {
    if (!valid(m)) return;
    const first = !this.target;
    this.target = m;
    this.seen = 0;
    const w = Object.hasOwn(WEAPONS, m.w) ? m.w : null;
    const sh = Object.hasOwn(SHIELDS, m.s) ? m.s : null;
    if (w && (w !== this.weapon || sh !== this.shield)) {
      try {
        equipModel(this.model, w, sh);
        this.weapon = w;
        this.shield = sh;
      } catch { /* gear this build doesn't know: keep what they had */ }
    }
    if (first) this._snap();
  }

  _snap() {
    const m = this.target, r = this.model.root;
    r.visible = !!m.v;
    r.position.set(m.p[0], m.p[1], m.p[2]);
    r.rotation.set(m.r[0], m.r[1], m.r[2]);
    this._joints(this.joints, m.b, 1, 0);
    if (m.h) this._horse(m.h, 1, 0);
  }

  // Eases each joint's rotation toward the message (k = 1 snaps).
  _joints(list, b, k, dt) {
    for (let i = 0; i < list.length && i * 3 + 2 < b.length; i++) {
      const rot = list[i].rotation;
      if (k >= 1) rot.set(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]);
      else {
        rot.x = dampAngle(rot.x, b[i * 3], 20, dt);
        rot.y = dampAngle(rot.y, b[i * 3 + 1], 20, dt);
        rot.z = dampAngle(rot.z, b[i * 3 + 2], 20, dt);
      }
    }
  }

  _horse(h, k, dt) {
    if (!this.horse) {
      this.horse = buildHorse();
      this.horseJoints = horseJoints(this.horse);
      this.game.scene.add(this.horse.root);
      k = 1;
    }
    const r = this.horse.root;
    r.visible = true;
    if (k >= 1) {
      r.position.set(h.p[0], h.p[1], h.p[2]);
      r.rotation.y = h.y;
      this.horse.body.position.y = h.by;
    } else {
      r.position.x = damp(r.position.x, h.p[0], 16, dt);
      r.position.y = damp(r.position.y, h.p[1], 16, dt);
      r.position.z = damp(r.position.z, h.p[2], 16, dt);
      r.rotation.y = dampAngle(r.rotation.y, h.y, 16, dt);
      this.horse.body.position.y = damp(this.horse.body.position.y, h.by, 16, dt);
    }
    this._joints(this.horseJoints, h.b, k, dt);
  }

  update(dt) {
    this.seen += dt;
    const m = this.target;
    if (!m) return;
    const r = this.model.root;
    r.visible = !!m.v;
    const far = Math.hypot(m.p[0] - r.position.x, m.p[2] - r.position.z) > 12;
    if (far) this._snap(); // a teleport or fast travel: jump rather than slide across the world
    r.position.x = damp(r.position.x, m.p[0], 16, dt);
    r.position.y = damp(r.position.y, m.p[1], 16, dt);
    r.position.z = damp(r.position.z, m.p[2], 16, dt);
    r.rotation.x = dampAngle(r.rotation.x, m.r[0], 16, dt);
    r.rotation.y = dampAngle(r.rotation.y, m.r[1], 16, dt);
    r.rotation.z = dampAngle(r.rotation.z, m.r[2], 16, dt);
    this.model.pivot.position.y = damp(this.model.pivot.position.y, m.py, 20, dt);
    this.model.hips.position.y = damp(this.model.hips.position.y, m.hy, 20, dt);
    this._joints(this.joints, m.b, 0, dt);
    if (m.h) this._horse(m.h, 0, dt);
    else if (this.horse) this.horse.root.visible = false;
  }

  dispose() {
    this.game.scene.remove(this.model.root);
    if (this.horse) this.game.scene.remove(this.horse.root);
    this.tag.material.map.dispose();
    this.tag.material.dispose();
  }
}
