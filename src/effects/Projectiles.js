// Projectiles: anything that flies and then hits. Used by the player's Ember Arc and Lantern Bolt, and
// written so enemies can use it too: hits go through Combat.sphere against the owner's foes, so team,
// i-frames (a roll dodges it) and shield guards all work the same as for melee.
//
// spawn(owner, o) options:
//   kind      'bolt' (a ball of lantern fire), 'crescent' (a flat burning arc), 'arrow' (a bowman's
//             shaft, nose along its flight), 'shard' (a spike of ice), 'boulder' (a lump of ice), 'fire',
//             'magma' (a lobbed lump), 'spore', 'water', 'sand', 'spark', 'leaf' or 'crystal'; the look
//   x, y, z   start point;  dirX, dirY, dirZ  direction (normalised here);  speed (m/s)
//   radius    hit sphere radius (m);  life (s) before it fizzles
//   hit       the hit object passed to Combat (dmg, poise, heavy, ...)
//   pierce    keep flying through targets (each is hit once) instead of bursting on the first
//   hug       hold this height above the ground instead of flying straight (Ember Arc skims the earth)
//   gravity   m/s^2 pulling it down (arrows, lobbed things); default 0
//   scale     visual size;  color, color2  trail and burst colours;  sound  cue played on impact
import * as THREE from '../lib/three.js';
import { ico, glowTexture } from '../models/kit.js';

const tmp = new THREE.Vector3();
const probe = new THREE.Vector3();

// Shared geometry and materials: a projectile costs one mesh and one sprite, nothing allocated per shot.
const additive = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const ARC = Math.PI * 0.8;
let LOOKS = null;
function looks() {
  if (LOOKS) return LOOKS;
  // The crescent lies flat (XZ), its apex at the origin and its horns trailing back along -Z.
  const crescent = new THREE.TorusGeometry(1, 0.11, 3, 14, ARC);
  crescent.rotateZ(Math.PI / 2 - ARC / 2);
  crescent.rotateX(Math.PI / 2);
  crescent.translate(0, 0, -1);
  crescent.scale(1, 0.6, 1);
  const glow = (color, opacity) => new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  LOOKS = {
    bolt: { geo: ico(0.15, 1), mat: additive(0xfff0c8), glow: glow(0xffa040, 0.95), glowSize: 1.5, color: 0xffb050, color2: 0xfff0c0 },
    crescent: { geo: crescent, mat: additive(0xff9a40, 0.9), glow: glow(0xff6a20, 0.7), glowSize: 2.2, color: 0xff7a2a, color2: 0xffd080 },
    arrow: { geo: new THREE.BoxGeometry(0.035, 0.035, 0.85), mat: new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.8 }), glow: glow(0xffffff, 0.0), glowSize: 0.1, color: 0x8a7a66, color2: 0xd8ccb8, aligned: true, trail: 0 },
    shard: { geo: new THREE.OctahedronGeometry(0.16, 0).scale(0.7, 0.7, 2.6), mat: new THREE.MeshStandardMaterial({ color: 0xcfefff, emissive: 0x4aa8ff, emissiveIntensity: 1.4, roughness: 0.2, flatShading: true }), glow: glow(0x8fd0ff, 0.6), glowSize: 1.0, color: 0xbfe8ff, color2: 0xffffff, aligned: true, trail: 1 },
    boulder: { geo: new THREE.IcosahedronGeometry(0.7, 0), mat: new THREE.MeshStandardMaterial({ color: 0xb8d0dc, roughness: 0.5, flatShading: true }), glow: glow(0xbfe8ff, 0.0), glowSize: 0.1, color: 0xd8eef8, color2: 0xffffff, trail: 1 },
    // The outer regions: a ball of drake- or imp-fire, a lobbed lump of magma, a puff of spores, a gout of seawater.
    fire: { geo: ico(0.18, 1), mat: additive(0xffd090), glow: glow(0xff5a10, 0.95), glowSize: 1.8, color: 0xff6a1a, color2: 0xffd060, trail: 3 },
    magma: { geo: new THREE.IcosahedronGeometry(0.6, 0), mat: new THREE.MeshStandardMaterial({ color: 0x3a2a24, emissive: 0xff5010, emissiveIntensity: 0.9, roughness: 0.8, flatShading: true }), glow: glow(0xff6a20, 0.6), glowSize: 2.0, color: 0xff6a1a, color2: 0xffc060, trail: 2 },
    spore: { geo: ico(0.2, 1), mat: additive(0xd0ffc0, 0.85), glow: glow(0x90e070, 0.8), glowSize: 1.6, color: 0x9ae070, color2: 0xe080ff, trail: 2 },
    water: { geo: ico(0.22, 1), mat: additive(0xd0f4ff, 0.8), glow: glow(0x60c0e0, 0.7), glowSize: 1.6, color: 0x9fe0ff, color2: 0xffffff, trail: 3 },
    sand: { geo: ico(0.2, 1), mat: additive(0xfff0c0, 0.7), glow: glow(0xd8a050, 0.7), glowSize: 1.5, color: 0xe8c080, color2: 0xfff0c8, trail: 3 },
    // The Amberwood's razor leaves and the Shardlands' splinters of crystal.
    leaf: { geo: new THREE.OctahedronGeometry(0.2, 0).scale(1.4, 0.25, 0.8), mat: additive(0xffb050, 0.95), glow: glow(0xff8a20, 0.6), glowSize: 1.2, color: 0xd8742e, color2: 0xffd060, trail: 2 },
    crystal: { geo: new THREE.OctahedronGeometry(0.16, 0).scale(0.7, 0.7, 2.6), mat: new THREE.MeshStandardMaterial({ color: 0xe8e0ff, emissive: 0x9a70ff, emissiveIntensity: 1.4, roughness: 0.1, flatShading: true }), glow: glow(0xc0a0ff, 0.7), glowSize: 1.1, color: 0xd8c8ff, color2: 0x9ae8ff, aligned: true, trail: 1 },
    spark: { geo: new THREE.OctahedronGeometry(0.14, 0).scale(0.6, 0.6, 3), mat: additive(0xf0f8ff), glow: glow(0x70c0ff, 0.9), glowSize: 1.6, color: 0xbfe8ff, color2: 0xffffff, aligned: true, trail: 3 },
  };
  return LOOKS;
}

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(owner, o) {
    this.game.net?.coop.fx('p', owner, o); // other players see it too (net/Coop.js)
    const L = looks()[o.kind ?? 'bolt'];
    const mesh = new THREE.Mesh(L.geo, L.mat);
    const glow = new THREE.Sprite(L.glow);
    const s = o.scale ?? 1;
    mesh.scale.setScalar(s);
    glow.scale.setScalar(L.glowSize * s);
    mesh.renderOrder = glow.renderOrder = 5;
    const len = Math.hypot(o.dirX, o.dirY ?? 0, o.dirZ) || 1;
    const speed = o.speed ?? 20;
    const p = {
      owner, o, mesh, glow,
      pos: new THREE.Vector3(o.x, o.y, o.z),
      vel: new THREE.Vector3((o.dirX / len) * speed, ((o.dirY ?? 0) / len) * speed, (o.dirZ / len) * speed),
      age: 0, life: o.life ?? 1.5, radius: o.radius ?? 0.4,
      hitSet: new Set(), hits: 0,
      color: o.color ?? L.color, color2: o.color2 ?? L.color2,
      hugY: o.hug ?? null,
    };
    mesh.position.copy(p.pos);
    glow.position.copy(p.pos);
    this._face(p);
    this.game.scene.add(mesh, glow);
    this.list.push(p);
    return p;
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!this._step(p, dt)) {
        this._remove(p);
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.list) this._remove(p);
    this.list.length = 0;
  }

  // Moves one projectile; false when it is spent.
  _step(p, dt) {
    const g = this.game, o = p.o, w = g.world;
    p.age += dt;
    if (p.age >= p.life) return this._burst(p, 0.5);
    if (o.gravity) p.vel.y -= o.gravity * dt;
    p.pos.addScaledVector(p.vel, dt);
    const ground = w.getHeight(p.pos.x, p.pos.z);
    if (p.hugY !== null) {
      // Skim the ground, easing towards the hug height; a sheer rise (a wall of earth) still stops it.
      const want = ground + p.hugY;
      if (want - p.pos.y > 1.6) return this._burst(p, 1);
      p.pos.y += (want - p.pos.y) * Math.min(1, dt * 10);
    } else if (p.pos.y < ground + 0.05) {
      p.pos.y = ground + 0.05;
      return this._burst(p, 1);
    }
    // Walls, rocks, pillars: anything the world pushes a small circle out of.
    probe.copy(p.pos);
    if (w.resolve(probe, Math.min(p.radius, 0.3) * 0.5)) return this._burst(p, 1);

    const before = p.hitSet.size;
    if (o.hit && !o.ghostFx) g.combat.sphere(p.owner, p.pos, p.radius, o.hit, p.hitSet);
    if (p.hitSet.size > before) {
      p.hits += p.hitSet.size - before;
      if (!o.pierce) return this._burst(p, 1);
      g.particles.emit({ x: p.pos.x, y: p.pos.y, z: p.pos.z, count: 12, speed: 4, up: 1, color: p.color, color2: p.color2, life: [0.2, 0.5], size: [0.06, 0.14], drag: 2 });
    }

    p.mesh.position.copy(p.pos);
    p.glow.position.copy(p.pos);
    this._face(p);
    if (o.kind === 'crescent') {
      const u = p.age / p.life;
      p.mesh.scale.setScalar((o.scale ?? 1) * (1 + u * 0.35));
      p.mesh.material.opacity = 0.9; // shared: keep it steady, fade is done by the burst
    } else if (o.kind === 'boulder' || o.kind === 'magma') {
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.y += dt * 3;
    } else if (!looks()[o.kind ?? 'bolt'].aligned) {
      p.mesh.rotation.z += dt * 9;
    }
    // Trail of embers (sparkles for ice, nothing for an arrow).
    const n = looks()[o.kind ?? 'bolt'].trail ?? (o.kind === 'crescent' ? 3 : 2);
    for (let k = 0; k < n; k++) {
      const side = o.kind === 'crescent' ? (Math.random() - 0.5) * 1.6 * (o.scale ?? 1) : 0;
      const vx = p.vel.x, vz = p.vel.z, l = Math.hypot(vx, vz) || 1;
      g.particles.emit({
        x: p.pos.x + (vz / l) * side, y: p.pos.y, z: p.pos.z - (vx / l) * side, count: 1, speed: 0.6, up: 0.8,
        color: p.color, color2: p.color2, life: [0.25, 0.6], size: [0.07, 0.16], drag: 2, jitter: 0.08,
      });
    }
    return true;
  }

  _face(p) {
    const k = p.o.kind ?? 'bolt';
    if (k === 'crescent') {
      tmp.copy(p.pos).add(p.vel);
      p.mesh.lookAt(tmp.x, p.pos.y, tmp.z);
    } else if (looks()[k].aligned) {
      tmp.copy(p.pos).add(p.vel);
      p.mesh.lookAt(tmp); // nose along the flight, arcing with gravity
    }
  }

  // Impact (or fizzle, at a smaller `power`): sparks, a flash and a sound. Always returns false.
  _burst(p, power) {
    const g = this.game;
    g.particles.emit({ x: p.pos.x, y: p.pos.y, z: p.pos.z, count: Math.round(26 * power) + 4, speed: 5 * power + 1, up: 1.6, color: p.color, color2: p.color2, life: [0.25, 0.7], size: [0.08, 0.2], drag: 2.2, gravity: 2 });
    if (power >= 1) {
      g.combat.flash(p.pos, p.color2, 2.2 * (p.o.scale ?? 1), 0.18);
      if (p.o.sound) g.audio.play(p.o.sound);
    }
    p.o.onBurst?.(p);
    return false;
  }

  _remove(p) {
    this.game.scene.remove(p.mesh, p.glow);
  }
}
