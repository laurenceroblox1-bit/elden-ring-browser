// Vaelor, the Storm Herald: the Stormspire monastery's last abbot, who called the storm down to guard
// the summit and became its voice. He stands at the foot of the great lightning-mast with his back to
// the road until someone climbs to him. A spear-glaive of captured lightning: sweeps and thrusts
// (parryable), a thrown bolt that flies like a spear, and his call: bolts from the sky on and around
// you after a crackling warning. At half health the storm comes right down onto the summit: more bolts,
// a ring of lightning when you crowd him, and a leap that brings a bolt down where he lands.
import { BigFoe } from './BigFoe.js';
import { buildHerald } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { SUMMIT } from '../data/biomes.js';
import { angleDiff } from '../core/math.js';

const SIZE = 1.55;
const SW_A = pose({ sRx: -1.4, sRy: -1.6, eR: -0.3, hRx: 1.5, torsoY: -1.0, torsoX: 0.1, sLx: -0.3, eL: -0.5, kR: 0.2, kL: 0.2 });
const SW_B = pose({ sRx: -1.3, sRy: 1.3, eR: -0.1, hRx: 1.5, torsoY: 0.9, torsoX: 0.25, sLx: 0.2, eL: -0.3, kR: 0.2, kL: 0.2 });
const POSES = {
  rest: pose({ sRx: -0.55, eR: -1.2, hRx: 1.5, sLx: -0.2, eL: -0.3, torsoX: 0.05, headX: 0.05 }),
  watch: pose({ sRx: -0.2, eR: -0.4, hRx: 1.6, sLx: -2.6, eL: -0.1, headX: -0.4, torsoX: -0.1 }),
  roar: pose({ sLx: -2.9, eL: -0.15, torsoX: -0.3, headX: -0.4, sRx: -0.5, eR: -1.0, hRx: 1.4, kR: 0.15, kL: 0.15 }),
  sweep: [SW_A, SW_B],
  sweepB: [SW_B, SW_A],
  thrust: [pose({ sRx: -0.4, eR: -1.8, hRx: 1.9, torsoY: -0.6, lRx: 0.3, lLx: -0.4, kL: 0.3 }),
    pose({ sRx: -1.55, eR: 0, hRx: 1.55, torsoY: 0.35, torsoX: 0.3, hipsH: -0.12, lRx: -0.7, kR: 0.4, lLx: 0.45 })],
  hurl: [pose({ sRx: 0.4, sRz: -0.4, eR: -1.4, hRx: 1.6, torsoY: -0.8, torsoX: -0.1, sLx: -1.2, lLx: -0.3 }),
    pose({ sRx: -2.4, eR: -0.1, hRx: 1.4, torsoY: 0.6, torsoX: 0.3, sLx: 0.3, lRx: -0.5, kR: 0.3 })],
  call: [pose({ sLx: -2.9, eL: -0.1, sRx: -2.6, eR: -0.3, hRx: 1.2, torsoX: -0.3, headX: -0.4 }),
    pose({ sLx: -2.4, eL: 0, sRx: -0.8, eR: -0.6, hRx: 1.6, torsoX: 0.2, headX: 0.1 })],
  leap: [pose({ hipsH: -0.3, kR: 1.2, kL: 1.2, lRx: -0.8, lLx: -0.8, torsoX: 0.4, sRx: 0.4, eR: -1.0, hRx: 1.6 }),
    pose({ sRx: -2.8, eR: -0.2, hRx: 2.2, torsoX: 0.5, lRx: -1.2, kR: 1.4, lLx: 0.4, kL: 0.4 })],
  hurt: pose({ torsoX: -0.35, headX: -0.3, sRz: -0.5, sLz: 0.5, sRx: -0.4, eR: -0.9, hRx: 1.4, hipsH: -0.06 }),
  parried: pose({ sRx: -2.6, sRz: -0.5, eR: -0.3, hRx: 1.0, torsoX: -0.45, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.6, headX: 0.35, sRx: -0.3, sRz: -0.4, eR: -0.2, hRx: 1.0, sLx: -0.4, sLz: 0.4, eL: -0.4, hipsH: -0.14, kR: 0.4, kL: 0.4 }),
  dead: pose({ hipsH: -0.42, lRx: -1.35, kR: 1.55, lLx: 0.25, kL: 1.9, torsoX: 0.7, headX: 0.6, sRz: -0.6, sLz: 0.6 }),
};
const KNOCKDOWN = 2.3;

export class Herald extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'herald';
    this.name = 'Vaelor, the Storm Herald';
    this.bossId = 'vaelor';
    this.flag = 'vaelorDead';
    this.music = 'storm';
    this.intro = { title: 'Voice of the Stormspire', open: 'thunder', roar: 'crack', scale: 1.1, lift: -1.2, roarAt: [3.4, 1.6] };
    this.reward = { gear: 'heralds_glaive', banner: ['The Storm Breaks', 'Vaelor, the Storm Herald'] };
    this.model = buildHerald();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 1800;
    this.maxPoise = 110;
    this.ash = 4200;
    this.radius = 0.75;
    this.height = 2.9;
    this.lockHeight = 2.0;
    this.accel = 7;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.9;
    this.ring = 4.6;
    this.chaseSpeed = 5.4;
    this.circleSpeed = 2.2;
    this.poses = POSES;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    const blade = (dmg, reach, arc, extra = {}) => ({ reach, arc, dmg, poise: 32, height: 4, knock: 4, ...extra });
    this.moves = {
      sweep: { windup: 0.66, active: 0.2, recover: 0.5, track: 4, pose: 'sweep', parry: true, cd: 1.1, next: ['sweepB', 0.5], melee: blade(30, 4.9, 1.4) },
      sweepB: { windup: 0.42, active: 0.2, recover: 0.6, track: 3, pose: 'sweepB', parry: true, cd: 1.2, melee: blade(28, 4.9, 1.4) },
      thrust: { windup: 0.8, active: 0.18, recover: 0.7, track: 3, pose: 'thrust', parry: true, lunge: 12, cd: 1.3, melee: blade(36, 5.2, 0.38, { poise: 42 }) },
      hurl: { windup: 0.9, active: 0.1, recover: 0.6, track: 5, pose: 'hurl', cd: 1.4, fire: (self, c) => self._hurl(c.p) },
      call: { windup: 1.0, active: 0.1, recover: 0.8, track: 2, pose: 'call', cd: 1.6, fire: (self, c) => self._call(c.p) },
      nova: { windup: 0.7, active: 0.1, recover: 0.8, track: 0, pose: 'call', cd: 1.2, fire: (self) => self._nova() },
      leap: {
        windup: 0.55, active: 0.45, recover: 0.8, track: 4, pose: 'leap', lunge: 13, cd: 1.6,
        start: (self) => self.game.audio.playAt('heavySwing', self.pos),
        fire: (self) => { self.vy = 8; self.onGround = false; self.leaping = true; },
      },
    };
    this._enter();
  }

  enter() { return { x: SUMMIT.x - 18, z: SUMMIT.z + 24, yaw: Math.PI - 0.6 }; }
  arena() { return { x: SUMMIT.x, z: SUMMIT.z, leash: SUMMIT.leash }; }
  _sees(c) { return Math.hypot(c.p.pos.x - SUMMIT.x, c.p.pos.z - SUMMIT.z) < SUMMIT.trigger; }

  _onReset() {
    super._onReset();
    this.leaping = false;
    this._spark(1);
  }

  _spark(k) {
    const m = this.model;
    m.spark.emissiveIntensity = 1.6 * k + Math.random() * 0.4;
    m.glow.material.opacity = 0.4 + 0.2 * k;
  }

  _idle(dt) {
    // Facing the mast, one hand raised to the sky.
    this.yaw = this.spawn.yaw ?? 0;
    if (Math.random() < dt * 0.4 && this.game.world.biomes?.mast) {
      const m = this.game.world.biomes.mast;
      this.game.effects.lightning(this, m.x, m.z, 0.05, { height: 35, radius: 0.5 });
    }
  }

  awaken(len) {
    super.awaken(len ?? 1.6);
    this.game.audio.playAt('thunder', this.pos, 100);
  }

  _wakePose(p) { Object.assign(p, POSES.roar); }
  _onWake(t, dt, c) { this.turnTo(c.toP, 2.5, dt); }

  update(dt) {
    super.update(dt);
    // A leap ends in a bolt where he lands.
    if (this.leaping && this.onGround && this.t > (this.move?.windup ?? 0) + 0.1) {
      this.leaping = false;
      const g = this.game;
      g.effects.lightning(this, this.pos.x + this.forwardX * 1.5, this.pos.z + this.forwardZ * 1.5, 0.02, { radius: 3.5, hit: { dmg: 30, poise: 45, knock: 6, heavy: true } });
    }
    if (this.alive) this._spark(this.phase === 2 ? 1.7 : 1);
  }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.3;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 5.5) opts.push(['sweep', 3], ['thrust', behind ? 0.5 : 1.5]);
    if (dist < 4 && p2) opts.push(['nova', behind ? 3 : 1.5]);
    if (dist > 5 && dist < 12) opts.push(['thrust', 2], ['leap', p2 ? 2 : 1]);
    if (dist > 7 && dist < 30) opts.push(['hurl', 2], ['call', p2 ? 3 : 2]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  // A bolt hurled like a spear, led a little against a runner.
  _hurl(p) {
    const g = this.game;
    const sx = this.pos.x + this.forwardX, sy = this.pos.y + 2.8, sz = this.pos.z + this.forwardZ;
    const flight = Math.hypot(p.pos.x - sx, p.pos.z - sz) / 32;
    const tx = p.pos.x + p.vel.x * flight * 0.6, tz = p.pos.z + p.vel.z * flight * 0.6;
    g.projectiles.spawn(this, {
      kind: 'spark', x: sx, y: sy, z: sz, dirX: tx - sx, dirY: p.pos.y + 1 - sy, dirZ: tz - sz,
      speed: 32, radius: 0.5, life: 1.6, scale: 2.2, hit: { dmg: 30, poise: 34, knock: 4, parryable: false }, sound: 'crack',
      onBurst: (pr) => g.effects.shockwave(this, pr.pos.x, pr.pos.z, { maxR: 3, speed: 10, color: 0xcff0ff, hit: { dmg: 12, poise: 15 } }),
    });
    g.audio.playAt('crack', this.pos, 70);
  }

  // Bolts from the sky: on you, and in the second phase around you too.
  _call(p) {
    const g = this.game;
    const hit = { dmg: 32, poise: 40, knock: 5, unblockable: true };
    g.effects.lightning(this, p.pos.x + p.vel.x * 0.5, p.pos.z + p.vel.z * 0.5, 1.0, { radius: 2.6, hit });
    const n = this.phase === 2 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 3.5 + Math.random() * 4;
      g.effects.lightning(this, p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d, 1.2 + i * 0.25, { radius: 2.4, hit });
    }
  }

  _nova() {
    const g = this.game;
    g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 8, speed: 14, color: 0xcff0ff, hit: { dmg: 22, poise: 40, knock: 6, unblockable: true } });
    g.audio.playAt('crack', this.pos, 70);
    g.particles.emit({ x: this.pos.x, y: this.pos.y + 1.4, z: this.pos.z, count: 40, speed: 6, up: 1, color: 0xe0f4ff, color2: 0x70c0ff, life: [0.2, 0.5], size: [0.06, 0.14], drag: 2 });
  }

  // Half health: he raises the glaive and the storm comes down onto the summit.
  _phase(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.0;
    const g = this.game;
    if (!this.phased && this.t > 0.5) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.85;
      this.chaseSpeed = 6;
      g.audio.playAt('thunder', this.pos, 100);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.effects.lightning(this, this.pos.x + Math.sin(a) * 7, this.pos.z + Math.cos(a) * 7, 0.6 + (i % 2) * 0.3, { radius: 2.2, hit: { dmg: 24, poise: 30, knock: 5, unblockable: true } });
      }
    }
    if (this.t >= 2.0) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }

  onFightEnd() {
    this.leaping = false;
  }
}
