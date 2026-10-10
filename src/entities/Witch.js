// Sylvara, the Bloom Witch: keeper of the Heartcap Grove, more mushroom than woman now. She waits under
// the great Heartcap and blooms awake when you step into the grove. A staff sweep (parryable), thorny
// roots that burst up under you after a telegraph, volleys of poison spores, blooms of spore-cloud
// around her when you crowd her, and a swirl of petals that puts her across the grove. At half health
// the Heartcap pours out spores (the grove's air thickens) and sporelings waddle out of the moss.
import { BigFoe } from './BigFoe.js';
import { buildWitch } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { GROVE } from '../data/biomes.js';
import { angleDiff } from '../core/math.js';

const SIZE = 1.45;
const POSES = {
  rest: pose({ sLx: -0.5, eL: -1.0, hLx: 0.3, sRx: -0.3, eR: -0.6, torsoX: 0.05, headX: 0.05 }),
  roar: pose({ sLx: -2.9, eL: -0.1, sRx: -2.6, eR: -0.2, torsoX: -0.35, headX: -0.4 }),
  sweep: [pose({ sLx: -1.4, sLy: 1.5, eL: -0.3, torsoY: 1.0, torsoX: 0.1, kR: 0.2, kL: 0.2 }),
    pose({ sLx: -1.3, sLy: -1.3, eL: -0.1, torsoY: -0.9, torsoX: 0.25, kR: 0.2, kL: 0.2 })],
  cast: [pose({ sLx: -2.7, eL: -0.3, torsoX: -0.25, headX: -0.25, sRx: -1.2, eR: -0.4 }),
    pose({ sLx: -1.5, eL: 0, torsoX: 0.25, sRx: -0.8, eR: -0.2 })],
  root: [pose({ sLx: -2.8, eL: -0.4, sRx: -2.6, eR: -0.4, torsoX: -0.25, headX: -0.2 }),
    pose({ sLx: -0.9, eL: -0.2, sRx: -0.9, eR: -0.2, torsoX: 0.6, hipsH: -0.2, kR: 0.5, kL: 0.5 })],
  bloom: [pose({ sLx: -0.3, sLz: 1.3, sRx: -0.3, sRz: -1.3, torsoX: -0.3, headX: -0.4 }),
    pose({ sLx: -0.2, sLz: 1.5, sRx: -0.2, sRz: -1.5, torsoX: 0.2, headX: 0.2 })],
  hurt: pose({ torsoX: -0.35, headX: -0.3, sRz: -0.5, sLz: 0.5, sRx: -0.4, eR: -0.8, hipsH: -0.06 }),
  parried: pose({ sLx: -2.6, sLz: 0.5, eL: -0.3, torsoX: -0.45, headX: -0.4, sRz: -0.6, eR: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.6, headX: 0.35, sRx: -0.3, sRz: -0.4, eR: -0.2, sLx: -0.4, sLz: 0.4, eL: -0.4, hipsH: -0.14, kR: 0.4, kL: 0.4 }),
  dead: pose({ hipsH: -0.42, lRx: -1.35, kR: 1.55, lLx: 0.25, kL: 1.9, torsoX: 0.7, headX: 0.6, sRz: -0.6, sLz: 0.6 }),
};
const KNOCKDOWN = 2.2;

export class Witch extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'witch';
    this.name = 'Sylvara, the Bloom Witch';
    this.bossId = 'sylvara';
    this.flag = 'sylvaraDead';
    this.music = 'spore';
    this.summonPack = 'sylvara-brood';
    this.intro = { title: 'Heart of the Glowcap Hollows', open: 'spore', roar: 'cast', scale: 1.05, lift: -1.0, roarAt: [3.4, 1.4] };
    this.reward = { gear: 'bloom_scythe', banner: ['The Grove Wilts', 'Sylvara, the Bloom Witch'] };
    this.model = buildWitch();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 1600;
    this.maxPoise = 95;
    this.ash = 3600;
    this.radius = 0.7;
    this.height = 2.7;
    this.lockHeight = 1.9;
    this.accel = 7;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.8;
    this.ring = 6;
    this.chaseSpeed = 4.4;
    this.circleSpeed = 2.2;
    this.poisonResist = 0;
    this.poses = POSES;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    this.moves = {
      sweep: { windup: 0.6, active: 0.2, recover: 0.55, track: 4, pose: 'sweep', parry: true, cd: 1.1, melee: { reach: 4.2, arc: 1.4, dmg: 26, poise: 30, height: 4, knock: 4, poison: 14 } },
      volley: { windup: 0.8, active: 0.1, recover: 0.5, track: 5, pose: 'cast', cd: 1.3, fire: (self, c) => self._volley(c.p) },
      roots: { windup: 0.9, active: 0.1, recover: 0.7, track: 2, pose: 'root', cd: 1.5, fire: (self, c) => self._roots(c.p) },
      bloom: { windup: 0.7, active: 0.1, recover: 0.8, track: 0, pose: 'bloom', cd: 1.2, fire: (self) => self._bloom() },
      petals: {
        windup: 0.45, active: 0.05, recover: 0.2, track: 0, pose: 'bloom', cd: 0.3, next: ['volley', 1],
        start: (self) => { self.invuln = true; self._swirl(); self.game.audio.playAt('blink', self.pos); },
        fire: (self, c) => self._blinkAway(c.p),
      },
      brood: { windup: 0.9, active: 0.1, recover: 0.6, track: 0, pose: 'bloom', cd: 1.0, fire: (self) => self._brood() },
    };
    this._enter();
  }

  enter() { return { x: GROVE.x + 20, z: GROVE.z + 22, yaw: Math.PI + 0.7 }; }
  arena() { return { x: GROVE.x, z: GROVE.z, leash: GROVE.leash }; }
  _sees(c) { return Math.hypot(c.p.pos.x - GROVE.x, c.p.pos.z - GROVE.z) < GROVE.trigger; }

  _onReset() {
    super._onReset();
    this.broodCd = 0;
    this.broodOut = 0;
    this._heart(1);
  }

  _heart(k) {
    const m = this.model;
    m.heart.emissiveIntensity = 1.2 * k;
    m.glow.scale.setScalar(1 + k * 0.8);
  }

  _idle(dt) {
    if (Math.random() < dt * 2) this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 2.5, z: this.pos.z, count: 1, speed: 0.3, up: 0.3, color: 0xff80e0, color2: 0x8ff0dc, life: [1, 2], size: [0.06, 0.12], jitter: 1 });
  }

  awaken(len) {
    super.awaken(len ?? 1.5);
    this.game.audio.playAt('spore', this.pos, 70);
  }

  _wakePose(p) { Object.assign(p, POSES.roar); }
  _onWake(t, dt, c) { this.turnTo(c.toP, 2, dt); this._heart(1 + Math.min(1, t)); }

  update(dt) {
    if (this.broodCd > 0) this.broodCd -= dt;
    super.update(dt);
    if (this.alive && this.state === 'attack' && this.t < (this.move?.windup ?? 0)) this._heart(1 + this.t * 2);
    else if (this.alive) this._heart(this.phase === 2 ? 1.6 : 1);
  }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.3;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 5) opts.push(['sweep', 3], ['bloom', behind ? 3 : 1.5], ['petals', 1.2]);
    if (dist > 4 && dist < 26) opts.push(['volley', 2.5], ['roots', 2]);
    if (p2 && this.broodCd <= 0 && this.broodOut < 4) opts.push(['brood', 3]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  _orb() {
    return { x: this.pos.x + this.forwardX * 0.8, y: this.pos.y + 3.2, z: this.pos.z + this.forwardZ * 0.8 };
  }

  // A fan of spore-puffs from the staff's heart (five in the second phase).
  _volley(p) {
    const g = this.game, o = this._orb();
    const n = this.phase === 2 ? 5 : 3;
    const aim = Math.atan2(p.pos.x - o.x, p.pos.z - o.z);
    const d = Math.max(3, Math.hypot(p.pos.x - o.x, p.pos.z - o.z));
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * 0.2;
      g.projectiles.spawn(this, {
        kind: 'spore', x: o.x, y: o.y, z: o.z, dirX: Math.sin(a), dirY: (p.pos.y + 1 - o.y) / d, dirZ: Math.cos(a),
        speed: 16, radius: 0.45, life: 2.6, scale: 1.3, color: 0xff80e0, color2: 0x9ae070,
        hit: { dmg: 14, poise: 12, poison: 24, parryable: false }, sound: 'spore',
      });
    }
    g.audio.play('cast');
  }

  // Roots burst up under you, and beside you in the second phase.
  _roots(p) {
    const g = this.game;
    const hit = { dmg: 30, poise: 40, poison: 18, knock: 4, heavy: true };
    g.effects.iceSpike(this, p.pos.x + p.vel.x * 0.4, p.pos.z + p.vel.z * 0.4, 0.95, { radius: 2.4, look: 'thorn', hit });
    if (this.phase === 2) {
      for (const s of [-1, 1]) {
        const a = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + s * Math.PI / 2;
        g.effects.iceSpike(this, p.pos.x + Math.sin(a) * 3.5, p.pos.z + Math.cos(a) * 3.5, 1.3, { radius: 2.2, look: 'thorn', hit });
      }
    }
  }

  // Spore-clouds bloom around her and a ring of spores bursts out.
  _bloom() {
    const g = this.game;
    g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 7, speed: 10, color: 0xd070f0, hit: { dmg: 14, poise: 24, poison: 30, knock: 4 } });
    for (let i = 0; i < 4; i++) {
      const a = this.yaw + (i / 4) * Math.PI * 2 + 0.4;
      g.effects.hazard(this, this.pos.x + Math.sin(a) * 4, this.pos.z + Math.cos(a) * 4, { radius: 2.4, life: 6, look: 'spore', hit: { dmg: 2, poise: 0, poison: 14, unblockable: true } });
    }
    g.audio.playAt('spore', this.pos, 60);
  }

  _swirl() {
    this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 1.5, z: this.pos.z, count: 40, speed: 3.5, up: 1.5, color: 0xff80e0, color2: 0x8ff0dc, life: [0.4, 1.0], size: [0.1, 0.22], drag: 2, jitter: 0.6 });
  }

  // A swirl of petals and she's elsewhere in the grove.
  _blinkAway(p) {
    const w = this.game.world;
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2, d = 9 + Math.random() * 10;
      const x = GROVE.x + Math.sin(a) * Math.min(d, GROVE.r - 4), z = GROVE.z + Math.cos(a) * Math.min(d, GROVE.r - 4);
      if (Math.hypot(x - p.pos.x, z - p.pos.z) < 8 || w.slopeAt(x, z) > 0.6) continue;
      this.pos.set(x, w.getHeight(x, z), z);
      this.yaw = Math.atan2(p.pos.x - x, p.pos.z - z);
      break;
    }
    this.invuln = false;
    this._swirl();
  }

  _brood() {
    const g = this.game;
    this.broodCd = 24;
    for (let i = 0; i < 3; i++) {
      const a = this.yaw + (i - 1) * 1.1;
      const x = this.pos.x + Math.sin(a) * 5, z = this.pos.z + Math.cos(a) * 5;
      const e = g.summonEnemy?.('sporeling', x, z, a, { pack: 'sylvara-brood' });
      if (!e) continue;
      e._setState('chase');
      this.broodOut++;
      g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.4, z, count: 20, speed: 2, up: 2, color: 0x9ae070, color2: 0xd070f0, life: [0.6, 1.2], size: [0.12, 0.25], jitter: 0.8 });
    }
    g.audio.playAt('spore', this.pos, 70);
  }

  // Half health: the Heartcap pours out spores and the grove's air goes thick.
  _phase(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.0;
    if (!this.phased && this.t > 0.5) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.85;
      const g = this.game;
      g.audio.playAt('roarBig', this.pos, 80);
      g.weatherLock = true;
      g.world.setWeather('spores');
      this._bloom();
    }
    if (this.t >= 2.0) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }

  onFightEnd() {
    const g = this.game;
    this.broodOut = 0;
    if (g.weatherLock) {
      g.weatherLock = false;
      g.weatherRegion = null;
    }
  }
}
