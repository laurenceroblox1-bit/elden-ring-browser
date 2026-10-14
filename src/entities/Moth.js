// Lumora, Mother of Moths: a moth the size of a cart that roosts over the Western Moor, where the
// moor-lights people follow at night are her children. She fights on the wing, hovering out of reach of
// a short blade: a beat of her wings that throws you back, dives that come in low and fast, clouds of
// glittering scale-dust that sicken (poison), and slow orbs of moth-light. At half health the moon comes
// down to her call: pillars of moonlight fall on you and around you.
// The body hovers: its logical position stays on the ground (so blows and hitboxes work as for any
// foe) and the model floats above it, dropping low at the bottom of a dive.
import { BigFoe } from './BigFoe.js';
import { buildMoth } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { angleDiff, clamp, damp } from '../core/math.js';

const SIZE = 1.7;
const HOVER = 2.4;
// Wings spread: forewing spars out to the sides (sRz/sLz), legs folded.
const FOLD = { lRx: -1.2, kR: 1.8, lLx: -1.2, kL: 1.8 };
const P = (o) => pose({ sRz: -1.35, sLz: 1.35, sRx: -0.2, sLx: -0.2, eR: 0, eL: 0, torsoX: 0.5, headX: -0.4, ...FOLD, ...o });
const POSES = {
  rest: P({}),
  roar: P({ sRz: -1.9, sLz: 1.9, torsoX: -0.1, headX: -0.6 }),
  gust: [P({ sRz: -2.3, sLz: 2.3, sRx: 0.4, sLx: 0.4, torsoX: 0.2 }), P({ sRz: -0.6, sLz: 0.6, sRx: -0.8, sLx: -0.8, torsoX: 0.7 })],
  dive: [P({ sRz: -2.0, sLz: 2.0, torsoX: 0.1, headX: -0.6 }), P({ sRz: -0.4, sLz: 0.4, sRx: 0.6, sLx: 0.6, torsoX: 1.1, headX: 0.2 })],
  dust: [P({ sRz: -2.1, sLz: 2.1, sRx: -0.6, sLx: -0.6, torsoX: 0.3 }), P({ sRz: -1.0, sLz: 1.0, sRx: 0.3, sLx: 0.3, torsoX: 0.6 })],
  orbs: [P({ sRz: -1.7, sLz: 1.7, torsoX: 0.0, headX: -0.7 }), P({ sRz: -1.4, sLz: 1.4, torsoX: 0.6, headX: 0.1 })],
  moon: [P({ sRz: -2.4, sLz: 2.4, torsoX: -0.3, headX: -0.9 }), P({ sRz: -2.0, sLz: 2.0, torsoX: -0.1, headX: -0.6 })],
  hurt: P({ torsoX: 0.1, headX: -0.2, sRz: -1.0, sLz: 1.0 }),
  parried: P({ torsoX: -0.2, headX: -0.4, sRz: -2.2, sLz: 2.2 }),
  riposted: P({ torsoX: 0.9, headX: 0.3, sRz: -0.6, sLz: 0.6 }),
  dead: P({ torsoX: 1.3, headX: 0.5, sRz: -0.4, sLz: 0.4, pivotX: -0.6, pivotH: -0.5 }),
};
const KNOCKDOWN = 2.2;
export const MOOR = { x: -262, z: -150, r: 24, trigger: 18, leash: 50 };

export class Moth extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'moth';
    this.name = 'Lumora, Mother of Moths';
    this.bossId = 'lumora';
    this.flag = 'lumoraDead';
    this.music = 'moth';
    this.intro = { title: 'Mother of the Moor-Lights', open: 'bellSmall', roar: 'wings', scale: 1.0, lift: 0.8, roarAt: [5.5, 2] };
    this.reward = { gear: 'moonbeam', banner: ['The Moor Is Dark', 'Lumora, Mother of Moths'] };
    this.model = buildMoth();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 1500;
    this.maxPoise = 90;
    this.ash = 3600;
    this.radius = 1.0;
    this.height = 4.2; // she hangs in the air: tall enough that a blade's reach finds her
    this.lockHeight = HOVER + 1.2;
    this.accel = 4;
    this.burnResist = 1.6; // moths and flame
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.6;
    this.ring = 6.5;
    this.chaseSpeed = 6.5;
    this.circleSpeed = 3.6;
    this.poses = POSES;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    this.moves = {
      gust: {
        windup: 0.75, active: 0.12, recover: 0.7, track: 3, pose: 'gust', cd: 1.2,
        start: (self) => self.game.audio.playAt('wings', self.pos, 70),
        fire: (self) => self._gust(),
      },
      dive: {
        windup: 0.8, active: 0.5, recover: 0.8, track: 3.5, pose: 'dive', lunge: 15, cd: 1.4,
        start: (self) => self.game.audio.playAt('wings', self.pos, 60),
        melee: { reach: 3.0, arc: 0.9, dmg: 34, poise: 50, heavy: true, height: 5, knock: 7 },
      },
      dust: { windup: 0.85, active: 0.1, recover: 0.7, track: 3, pose: 'dust', cd: 1.3, fire: (self, c) => self._dust(c.p) },
      orbs: { windup: 0.7, active: 0.1, recover: 0.6, track: 4, pose: 'orbs', cd: 1.2, fire: (self, c) => self._orbs(c.p) },
      moon: { windup: 1.1, active: 0.1, recover: 0.8, track: 2, pose: 'moon', cd: 1.3, fire: (self, c) => self._moon(c.p) },
    };
    this._enter();
  }

  enter() { return { x: MOOR.x + 18, z: MOOR.z + 18, yaw: Math.PI + 0.8 }; }
  arena() { return { x: MOOR.x, z: MOOR.z, leash: MOOR.leash }; }
  _sees(c) { return Math.hypot(c.p.pos.x - MOOR.x, c.p.pos.z - MOOR.z) < MOOR.trigger; }

  awaken(len) {
    super.awaken(len ?? 1.6);
    this.game.audio.playAt('wings', this.pos, 100);
  }

  _wakePose(p) { Object.assign(p, POSES.roar); }
  _onWake(t, dt, c) { this.turnTo(c.toP, 2, dt); }

  _pick(c) {
    const { dist, toP } = c;
    const ahead = Math.abs(angleDiff(this.yaw, toP)) < 0.8;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 5.5) opts.push(['gust', 3]);
    if (dist > 5 && dist < 18 && ahead) opts.push(['dive', 2.6]);
    if (dist < 14) opts.push(['dust', 1.8]);
    if (dist > 7 && dist < 30) opts.push(['orbs', 1.8]);
    if (p2 && dist < 30) opts.push(['moon', 2.6]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  _gust() {
    const g = this.game;
    g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 8, speed: 15, color: 0xf0e8d8, hit: { dmg: 16, poise: 50, knock: 10, unblockable: true } });
    g.particles.emit({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z, count: 40, speed: 8, up: 0.6, color: 0xfff6e0, color2: 0xd8c8a8, life: [0.3, 0.7], size: [0.06, 0.14], drag: 2 });
  }

  // A shimmering cloud of scale-dust, where you stand and between you.
  _dust(p) {
    const g = this.game;
    const n = this.phase === 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n;
      const x = this.pos.x + (p.pos.x - this.pos.x) * k, z = this.pos.z + (p.pos.z - this.pos.z) * k;
      g.effects.hazard(this, x, z, { radius: 2.8, life: 5, look: 'spore', color: 0xe8d8a0, hit: { dmg: 3, poise: 0, poison: 20, unblockable: true } });
    }
    g.audio.playAt('spore', this.pos, 60);
  }

  // Slow orbs of moth-light in a fan.
  _orbs(p) {
    const g = this.game;
    const sx = this.pos.x, sy = this.pos.y + HOVER + 1, sz = this.pos.z;
    const base = Math.atan2(p.pos.x - sx, p.pos.z - sz), n = this.phase === 2 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.22;
      g.projectiles.spawn(this, {
        kind: 'bolt', x: sx, y: sy, z: sz, dirX: Math.sin(a), dirY: (p.pos.y + 1 - sy) / Math.max(5, Math.hypot(p.pos.x - sx, p.pos.z - sz)), dirZ: Math.cos(a),
        speed: 11, radius: 0.5, life: 3, scale: 1.6, color: 0xfff0c0, color2: 0xc8d8ff, hit: { dmg: 18, poise: 16, parryable: false }, sound: 'bellSmall',
      });
    }
    g.audio.playAt('cast', this.pos, 60);
  }

  // Phase two: the moon answers her. Pillars of moonlight on you and around you.
  _moon(p) {
    const g = this.game;
    const hit = { dmg: 30, poise: 40, knock: 5, unblockable: true };
    g.effects.moonbeam(this, p.pos.x + p.vel.x * 0.6, p.pos.z + p.vel.z * 0.6, 1.1, { radius: 2.6, hit });
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 5;
      g.effects.moonbeam(this, p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d, 1.3 + i * 0.2, { radius: 2.3, hit });
    }
  }

  // Half health: she rises, the light in her wings flares, and she calls the moon down.
  _phase(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.0;
    if (!this.phased && this.t > 0.6) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.85;
      this.chaseSpeed = 7.5;
      this.game.audio.playAt('wings', this.pos, 100);
      this._gust();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.game.effects.moonbeam(this, this.pos.x + Math.sin(a) * 7, this.pos.z + Math.cos(a) * 7, 0.8 + (i % 2) * 0.3, { radius: 2.2, hit: { dmg: 24, poise: 30, knock: 5, unblockable: true } });
      }
    }
    if (this.t >= 2.0) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }

  // Wingbeats on whatever else she's doing, faster in a hurry, the hind wings a beat behind.
  _poseExtra(p, dt) {
    if (this.state === 'dead' || this.state === 'idle') return;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.beat = (this.beat ?? 0) + dt * (9 + sp * 0.8);
    const f = Math.sin(this.beat) * (this.state === 'attack' ? 0.25 : 0.45);
    p.sRz -= f;
    p.sLz += f;
    p.pivotH += Math.cos(this.beat) * 0.06;
  }

  update(dt) {
    super.update(dt);
    const m = this.model, r = m.root;
    // Hover: high in the air, swaying; low at the bottom of a dive; down on the moor when dead or asleep.
    const M = this.move;
    let h = HOVER;
    if (this.state === 'idle') h = 0.4;
    if (this.state === 'dead') h = Math.max(0, HOVER * (1 - this.t / 1.2));
    if (this.state === 'knockdown') h = 0.6;
    if (M?.name === 'dive' && this.state === 'attack') h = this.t < M.windup ? HOVER + 1 : this.t < M.windup + M.active ? 0.6 : HOVER * clamp((this.t - M.windup - M.active) / M.recover, 0.3, 1);
    this.hov = damp(this.hov ?? 0.4, h, 4, dt);
    r.position.y += this.hov + Math.sin(this.game.time * 1.7) * 0.15;
    const bt = Math.sin(this.beat ?? 0);
    m.hindR.rotation.z = damp(m.hindR.rotation.z, 0.3 + bt * 0.35, 12, dt);
    m.hindL.rotation.z = damp(m.hindL.rotation.z, -0.3 - bt * 0.35, 12, dt);
    const k = this.phase === 2 ? 1.8 : 1;
    m.glow.emissiveIntensity = 1.2 * k + Math.sin(this.game.time * 2.3) * 0.3;
    m.halo.material.opacity = (this.alive ? 0.3 : 0) * k;
    // Scale-dust drifting off her wings.
    if (this.alive && this.shown && this.state !== 'idle' && Math.random() < dt * 10) {
      this.game.particles.emit({ x: this.pos.x + (Math.random() - 0.5) * 4, y: this.pos.y + this.hov + 1 + Math.random(), z: this.pos.z + (Math.random() - 0.5) * 4, count: 1, speed: 0.3, up: -0.3, color: 0xfff0d0, color2: 0xe8d8a0, life: [1.2, 2.4], size: [0.04, 0.08], drag: 0.4, jitter: 0.5 });
    }
  }

  // Her lock point floats with her.
  lockPoint(out) {
    return out.set(this.pos.x, this.pos.y + (this.hov ?? HOVER) + 1.2 * (this.size / SIZE), this.pos.z);
  }
}
