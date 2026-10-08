// Saelith, the Winter Lantern: the last keeper of the Rime-Watch. When the Winter Lantern began to
// gutter she took its flame into her own lantern rather than let it die, and the Rimewold has been
// frozen ever since. She kneels before the hall's great lantern until someone walks into the hall.
//
// Phase one: glaive sweeps (one way, then back), a lunging thrust (both parryable), a fan of ice shards
// from the lantern, and ice spikes that erupt under you after a telegraph. At half health the lantern
// flares, a blizzard fills the hall and a ring of frost goes through any guard; phase two adds a blink
// that puts her behind you with a quick thrust, more spikes and frost novas when you crowd her.
// Beat her and the Winter Lantern goes out: the snow stops falling on the Rimewold.
import { BigFoe } from './BigFoe.js';
import { buildSaelith } from '../models/characters.js';
import { pose } from '../models/pose.js';
import { HALL } from '../data/world.js';

const SIZE = 1.55;

const SW_A = pose({ sRx: -1.4, sRy: -1.6, eR: -0.3, hRx: 1.5, torsoY: -1.0, torsoX: 0.1, sLx: -0.3, eL: -0.5, kR: 0.2, kL: 0.2 });
const SW_B = pose({ sRx: -1.3, sRy: 1.3, eR: -0.1, hRx: 1.5, torsoY: 0.9, torsoX: 0.25, sLx: 0.2, eL: -0.3, kR: 0.2, kL: 0.2 });
const POSES = {
  rest: pose({ sRx: -0.55, eR: -1.2, hRx: 1.5, sLx: -0.2, eL: -0.3, torsoX: 0.05, headX: 0.05 }),
  kneel: pose({ hipsH: -0.42, lRx: -1.35, kR: 1.55, lLx: 0.25, kL: 1.9, torsoX: 0.35, headX: 0.45, sRx: -0.25, eR: -0.4, hRx: 1.0, sLx: -0.7, eL: -0.9 }),
  roar: pose({ sLx: -2.9, eL: -0.15, torsoX: -0.3, headX: -0.4, sRx: -0.5, eR: -1.0, hRx: 1.4, kR: 0.15, kL: 0.15 }),
  sweep: [SW_A, SW_B],
  sweepB: [SW_B, SW_A],
  thrust: [pose({ sRx: -0.4, eR: -1.8, hRx: 1.9, torsoY: -0.6, lRx: 0.3, lLx: -0.4, kL: 0.3 }),
    pose({ sRx: -1.55, eR: 0, hRx: 1.55, torsoY: 0.35, torsoX: 0.3, hipsH: -0.12, lRx: -0.7, kR: 0.4, lLx: 0.45 })],
  shards: [pose({ sLx: -2.6, eL: -0.3, torsoX: -0.2, headX: -0.2, sRx: -0.5, eR: -1.1, hRx: 1.4 }),
    pose({ sLx: -1.6, eL: 0, torsoX: 0.2, sRx: -0.5, eR: -1.1, hRx: 1.4 })],
  pillars: [pose({ sRx: -2.8, eR: -0.5, hRx: 0.6, sLx: -2.6, eL: -0.5, torsoX: -0.25, headX: -0.2 }),
    pose({ sRx: -1.0, eR: -0.2, hRx: 2.4, sLx: -0.9, eL: -0.2, torsoX: 0.6, hipsH: -0.2, kR: 0.5, kL: 0.5 })],
  hurt: pose({ torsoX: -0.35, headX: -0.3, sRz: -0.5, sLz: 0.5, sRx: -0.4, eR: -0.9, hRx: 1.4, hipsH: -0.06 }),
  parried: pose({ sRx: -2.6, sRz: -0.5, eR: -0.3, hRx: 1.0, torsoX: -0.45, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.6, headX: 0.35, sRx: -0.3, sRz: -0.4, eR: -0.2, hRx: 1.0, sLx: -0.4, sLz: 0.4, eL: -0.4, hipsH: -0.14, kR: 0.4, kL: 0.4 }),
  dead: pose({ hipsH: -0.42, lRx: -1.35, kR: 1.55, lLx: 0.25, kL: 1.9, torsoX: 0.7, headX: 0.6, sRz: -0.6, sLz: 0.6, sRx: 0.1, sLx: 0.1 }),
};
const KNOCKDOWN = 2.3;

export class Saelith extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'saelith';
    this.name = 'Saelith, the Winter Lantern';
    this.bossId = 'saelith';
    this.flag = 'saelithDead';
    this.music = 'winter';
    this.intro = { title: 'Last Keeper of the Rime-Watch', open: 'bellSmall', roar: 'lanternFlare', scale: 1.1, lift: -1.3, roarAt: [3.4, 1.6] };
    this.reward = { gear: 'rime_glaive', banner: ['The Lantern Goes Out', 'Saelith, the Winter Lantern'] };
    this.model = buildSaelith();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 1700;
    this.maxPoise = 110;
    this.ash = 3200;
    this.radius = 0.75;
    this.height = 2.9;
    this.lockHeight = 2.0;
    this.accel = 7;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.9;
    this.ring = 4.2;
    this.chaseSpeed = 5.2;
    this.circleSpeed = 2.0;
    this.frostResist = 0.2;
    this.poses = POSES;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    const blade = (dmg, reach, arc, extra = {}) => ({ reach, arc, dmg, poise: 32, frost: 12, height: 4, knock: 4, ...extra });
    this.moves = {
      sweep: { windup: 0.68, active: 0.2, recover: 0.5, track: 4, pose: 'sweep', parry: true, cd: 1.1, next: ['sweepB', 0.5], melee: blade(30, 4.8, 1.4) },
      sweepB: { windup: 0.42, active: 0.2, recover: 0.6, track: 3, pose: 'sweepB', parry: true, cd: 1.2, melee: blade(28, 4.8, 1.4) },
      thrust: { windup: 0.82, active: 0.18, recover: 0.7, track: 3, pose: 'thrust', parry: true, lunge: 11, cd: 1.3, melee: blade(36, 5.0, 0.38, { poise: 40 }) },
      thrustQuick: { windup: 0.42, active: 0.18, recover: 0.75, track: 6, pose: 'thrust', parry: true, lunge: 8, cd: 1.3, melee: blade(30, 4.8, 0.4) },
      shards: { windup: 0.9, active: 0.1, recover: 0.6, track: 4, pose: 'shards', cd: 1.4, fire: (self, c) => self._shards(c.p) },
      pillars: { windup: 1.0, active: 0.1, recover: 0.8, track: 2, pose: 'pillars', cd: 1.6, fire: (self, c) => self._pillars(c.p) },
      nova: { windup: 0.7, active: 0.1, recover: 0.8, track: 0, pose: 'shards', cd: 1.2, fire: (self) => self._nova(10, 24, false) },
      blink: {
        windup: 0.42, active: 0.05, recover: 0.1, track: 0, pose: 'thrust', cd: 0.5, next: ['thrustQuick', 1],
        start: (self) => { self.invuln = true; self._swirl(); self.game.audio.playAt('blink', self.pos); },
        fire: (self, c) => self._blinkBehind(c.p),
      },
    };
    this._enter();
  }

  enter() { return { x: HALL.x + 4, z: HALL.z + 26, yaw: Math.PI }; }
  arena() { return { x: HALL.x, z: HALL.z, leash: HALL.leash }; }

  _sees(c) {
    return Math.hypot(c.p.pos.x - HALL.x, c.p.pos.z - HALL.z) < HALL.trigger;
  }

  _onReset() {
    super._onReset();
    if (this.state === 'idle') this.yaw = Math.PI; // kneeling to the altar
    this._lantern(1);
    const hl = this.game.world?.hallLantern;
    if (hl) hl.lit = this.game.state?.flags?.saelithDead ? 0 : 1;
  }

  // Her lantern's flame (0 = the hall still holds it, 1 = hers, 2 = flaring).
  _lantern(k) {
    const m = this.model;
    m.flame.emissiveIntensity = 0.6 + k * 1.4;
    m.glow.material.opacity = 0.2 + k * 0.35;
    m.glow.scale.setScalar(1.2 + k * 1.2);
  }

  _idle() {
    // Kneeling: nothing moves but the cape and her breath.
    if (Math.random() < 0.02) this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 2, z: this.pos.z - 0.5, count: 2, speed: 0.3, up: 0.4, color: 0xe8f4fa, life: [0.8, 1.4], size: [0.06, 0.12] });
  }

  _wakePose(p, t) {
    const long = this.introLen > 4;
    const rise = long ? 2.4 : 0.1, lift = long ? 4.3 : 0.6, settle = long ? 6.3 : 1.4;
    Object.assign(p, t < rise ? POSES.kneel : t < lift ? POSES.rest : t < settle ? POSES.roar : POSES.rest);
  }

  // The intro: rising, turning to face you, then taking the flame from the hall's lantern.
  _onWake(t, dt, c) {
    const long = this.introLen > 4;
    const rise = long ? 2.4 : 0.1, lift = long ? 4.3 : 0.6;
    if (t > rise) this.turnTo(c.toP, 1.8, dt);
    const hl = this.game.world.hallLantern;
    if (t > lift && !this.woke.flare) {
      this.woke.flare = true;
      this.game.audio.playAt('lanternFlare', this.pos, 90);
      this._swirl();
    }
    const u = Math.min(1, Math.max(0, (t - lift) / 0.8));
    if (hl) hl.lit = 1 - u * 0.85;
    this._lantern(u);
  }

  _pick(c) {
    const { dist } = c;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 5.6) opts.push(['sweep', 3], ['thrust', 1.2]);
    if (dist < 4.2 && p2) opts.push(['nova', 1.6]);
    if (dist >= 5.6 && dist < 12) opts.push(['thrust', 3], ['pillars', 1.4]);
    if (dist >= 8) opts.push(['shards', 2.4], ['pillars', 1.8]);
    if (dist >= 7 && p2) opts.push(['blink', 2.6]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  _shards(p) {
    const g = this.game, n = this.phase === 2 ? 7 : 5;
    const sx = this.pos.x + this.forwardX * 1.2, sy = this.pos.y + 2.8, sz = this.pos.z + this.forwardZ * 1.2;
    const d = Math.hypot(p.pos.x - sx, p.pos.z - sz);
    const aim = Math.atan2(p.pos.x - sx, p.pos.z - sz);
    const dy = (p.pos.y + 1.1 - sy) / Math.max(d, 1);
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * 0.15;
      g.projectiles.spawn(this, {
        kind: 'shard', x: sx, y: sy, z: sz, dirX: Math.sin(a), dirY: dy, dirZ: Math.cos(a), speed: 23, radius: 0.34, life: 2.2, scale: 1.4,
        hit: { dmg: 15, poise: 12, frost: 24, parryable: false }, sound: 'shard',
      });
    }
    g.audio.playAt('shard', this.pos, 60);
  }

  // Spikes erupt where you stand (and, in phase two, around it too), a second after the circles appear.
  _pillars(p) {
    const g = this.game;
    const spots = [[p.pos.x + p.vel.x * 0.5, p.pos.z + p.vel.z * 0.5]];
    const extra = this.phase === 2 ? 4 : 2;
    for (let i = 0; i < extra; i++) {
      const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 3;
      spots.push([p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d]);
    }
    spots.forEach(([x, z], i) => g.effects.iceSpike(this, x, z, 1.05 + i * 0.12, { radius: 2.2, hit: { dmg: 30, poise: 40, frost: 30, heavy: true, knock: 5 } }));
    g.audio.playAt('frostbite', this.pos, 60);
  }

  _nova(maxR, dmg, unblockable) {
    const g = this.game;
    g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR, speed: 12, color: 0xbfe8ff, hit: { dmg, poise: 30, frost: 40, knock: 5, unblockable } });
    g.audio.playAt('frostbite', this.pos, 70);
    g.particles.emit({ x: this.pos.x, y: this.pos.y + 1.5, z: this.pos.z, count: 40, speed: 6, up: 1.5, color: 0xdff4ff, color2: 0x7cc8ff, life: [0.3, 0.8], size: [0.1, 0.22], drag: 2 });
  }

  _blinkBehind(p) {
    const w = this.game.world;
    const back = p.yaw + Math.PI;
    let x = p.pos.x + Math.sin(back) * 3.6, z = p.pos.z + Math.cos(back) * 3.6;
    if (Math.hypot(x - HALL.x, z - HALL.z) > HALL.r - 2) { x = p.pos.x - Math.sin(back) * 3.6; z = p.pos.z - Math.cos(back) * 3.6; }
    this.pos.set(x, w.getHeight(x, z), z);
    w.resolve(this.pos, this.radius);
    this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    this.invuln = false;
    this._swirl();
  }

  _swirl() {
    this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 1.6, z: this.pos.z, count: 40, speed: 3.5, up: 1.6, color: 0xe8f6ff, color2: 0x9fd8ff, life: [0.4, 0.9], size: [0.1, 0.24], drag: 2, jitter: 0.8 });
  }

  // Half health: the lantern flares, a blizzard fills the hall, and a ring of frost goes through any guard.
  _phase(dt) {
    const g = this.game;
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.3;
    if (!this.phased && this.t > 0.9) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.85;
      this.chaseSpeed = 6;
      this._lantern(2);
      g.audio.playAt('lanternFlare', this.pos, 90);
      g.weatherLock = true;
      g.world.setWeather('blizzard');
      g.cam.shake(0.35);
      this._nova(14, 20, true);
    }
    if (this.t >= 2.8) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }

  // Leaving or dying ends the blizzard; she keeps the flame unless she is beaten.
  onFightEnd() {
    const g = this.game;
    if (g.weatherLock) {
      g.weatherLock = false;
      g.inRime = null; // the region weather is worked out afresh
    }
  }

  onDefeated() {
    const hl = this.game.world.hallLantern;
    if (hl) hl.lit = 0;
    this._lantern(0);
    this.game.inRime = null;
  }

  _animate(dt) {
    super._animate(dt);
    // Mid-blink she thins to nothing, then steps out of the snow behind you.
    const M = this.move;
    const fading = this.state === 'attack' && M?.name === 'blink' && this.t < M.windup;
    this.model.root.scale.setScalar(SIZE * (fading ? Math.max(0.05, 1 - this.t / M.windup) : 1));
  }
}
