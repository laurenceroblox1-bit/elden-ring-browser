// Swing trails: a short ribbon of light that follows a blade's edge while it swings, fading in a fifth
// of a second. One ribbon per actor, reused; Game.updateTrails() feeds it the player's weapon and the
// weapons of armed foes near the camera, only while they are mid-swing.
import * as THREE from '../lib/three.js';

const N = 14; // samples kept per ribbon
const LIFE = 0.2; // seconds a sample lasts
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

class Ribbon {
  constructor(scene, color) {
    const pos = new Float32Array(N * 2 * 3), col = new Float32Array(N * 2 * 3);
    const idx = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.samples = []; // { a, b, age }
    this.color = new THREE.Color(color);
    this.seen = 0;
  }

  push(a, b) {
    const s = this.samples.length >= N ? this.samples.shift() : { a: new THREE.Vector3(), b: new THREE.Vector3() };
    s.a.copy(a);
    s.b.copy(b);
    s.age = 0;
    this.samples.push(s);
  }

  update(dt) {
    for (const s of this.samples) s.age += dt;
    while (this.samples.length && this.samples[0].age > LIFE) this.samples.shift();
    const n = this.samples.length;
    this.mesh.visible = n >= 2;
    if (n < 2) return;
    const geo = this.mesh.geometry;
    const pos = geo.attributes.position.array, col = geo.attributes.color.array;
    for (let i = 0; i < N; i++) {
      const s = this.samples[Math.min(n - 1, Math.max(0, i - (N - n)))];
      const k = Math.max(0, 1 - s.age / LIFE) * (i - (N - n) < 0 ? 0 : 1);
      // Brightest at the edge (b), fading toward the hilt (a).
      const o = i * 6;
      pos[o] = s.a.x; pos[o + 1] = s.a.y; pos[o + 2] = s.a.z;
      pos[o + 3] = s.b.x; pos[o + 4] = s.b.y; pos[o + 5] = s.b.z;
      col[o] = this.color.r * k * 0.2; col[o + 1] = this.color.g * k * 0.2; col[o + 2] = this.color.b * k * 0.2;
      col[o + 3] = this.color.r * k; col[o + 4] = this.color.g * k; col[o + 5] = this.color.b * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

export class Trails {
  constructor(game) {
    this.game = game;
    this.ribbons = new Map(); // actor -> Ribbon
  }

  // While `active`, add a sample from `base` to `tip` (world points) to the actor's ribbon.
  track(actor, active, base, tip, color = 0xfff2d8) {
    let r = this.ribbons.get(actor);
    if (!active) {
      if (r) r.seen = 0;
      return;
    }
    if (!r) {
      r = new Ribbon(this.game.scene, color);
      this.ribbons.set(actor, r);
    }
    r.color.setHex(color);
    r.push(base, tip);
    r.seen = 0;
  }

  update(dt) {
    for (const [actor, r] of this.ribbons) {
      r.update(dt);
      r.seen += dt;
      // A ribbon nobody has swung for a while is let go.
      if (r.seen > 5 && !r.samples.length) {
        r.dispose(this.game.scene);
        this.ribbons.delete(actor);
      }
    }
  }

  clear() {
    for (const r of this.ribbons.values()) r.dispose(this.game.scene);
    this.ribbons.clear();
  }
}

// How far along its length (+Z in the hand) a weapon reaches, measured once from its meshes.
export function weaponReach(group) {
  if (group.userData.reach) return group.userData.reach;
  let lo = Infinity, hi = -Infinity;
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    for (const z of [bb.min.z, bb.max.z]) for (const y of [bb.min.y, bb.max.y]) {
      tmpA.set(0, y, z).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      lo = Math.min(lo, tmpA.z);
      hi = Math.max(hi, tmpA.z);
    }
  });
  group.userData.reach = { lo: Number.isFinite(lo) ? lo : 0, hi: Number.isFinite(hi) ? hi : 1 };
  return group.userData.reach;
}

export { tmpA as trailA, tmpB as trailB };
