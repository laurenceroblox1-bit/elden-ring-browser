// Vesperine, the Ossuary Queen: the last abbess of the Undercroft's chapel, who would not leave her
// dead and now will not let them go. Tall and quick, a reaper's scythe swung in long arcs (parryable)
// and a spinning dance of cuts; bone spears driven up through the floor in lines and under your feet;
// a blink through her candle-smoke; and her dead, called up out of the chapel floor. At half health
// the candles burn high and green: two lines of spears at once, more dead, and a ring of bone round her
// when you crowd her.
import { BigFoe } from './BigFoe.js';
import { buildOssuaryQueen } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { CHAPEL } from '../data/biomes.js';
import { angleDiff } from '../core/math.js';

const SIZE = 1.6;
const SW_A = pose({ sRx: -1.4, sRy: -1.6, eR: -0.3, hRx: 1.5, torsoY: -1.0, torsoX: 0.1, sLx: -0.4, eL: -0.6, kR: 0.2, kL: 0.2 });
const SW_B = pose({ sRx: -1.3, sRy: 1.3, eR: -0.1, hRx: 1.5, torsoY: 0.95, torsoX: 0.25, sLx: 0.2, eL: -0.3, kR: 0.2, kL: 0.2 });
const POSES = {
  rest: pose({ sRx: -0.5, eR: -1.1, hRx: 1.5, sLx: -0.3, eL: -0.6, torsoX: 0.1, headX: 0.1 }),
  roar: pose({ sLx: -2.6, eL: -0.2, sRx: -0.6, eR: -1.0, hRx: 1.4, torsoX: -0.3, headX: -0.5 }),
  sweep: [SW_A, SW_B],
  sweepB: [SW_B, SW_A],
  spin: [pose({ sRx: -1.5, sRy: -1.7, eR: -0.2, hRx: 1.5, torsoY: -1.3, sLx: -1.2, eL: -0.3, kR: 0.4, kL: 0.4, hipsH: -0.1 }),
    pose({ sRx: -1.5, sRy: 1.6, eR: -0.1, hRx: 1.5, torsoY: 1.3, sLx: -1.2, eL: -0.2, kR: 0.3, kL: 0.3 })],
  spears: [pose({ sLx: -2.8, eL: -0.1, sRx: -0.4, eR: -0.9, hRx: 1.5, torsoX: -0.3, headX: -0.3 }),
    pose({ sLx: -1.0, eL: 0, sRx: -0.4, eR: -0.9, hRx: 1.5, torsoX: 0.5, hipsH: -0.1, headX: 0.2 })],
  call: [pose({ sLx: -2.6, eL: -0.2, sRx: -2.4, eR: -0.4, hRx: 1.2, torsoX: -0.35, headX: -0.5 }),
    pose({ sLx: -2.0, eL: -0.1, sRx: -2.0, eR: -0.2, hRx: 1.4, torsoX: -0.1, headX: -0.2 })],
  hurt: pose({ torsoX: -0.35, headX: -0.3, sRz: -0.5, sLz: 0.5, sRx: -0.4, eR: -0.9, hRx: 1.4, hipsH: -0.06 }),
  parried: pose({ sRx: -2.6, sRz: -0.5, eR: -0.3, hRx: 1.0, torsoX: -0.45, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.6, headX: 0.35, sRx: -0.3, sRz: -0.4, eR: -0.2, hRx: 1.0, sLx: -0.4, sLz: 0.4, eL: -0.4, hipsH: -0.14, kR: 0.4, kL: 0.4 }),
  dead: pose({ hipsH: -0.42, lRx: -1.35, kR: 1.55, lLx: 0.25, kL: 1.9, torsoX: 0.7, headX: 0.6, sRz: -0.6, sLz: 0.6 }),
};
const KNOCKDOWN = 2.2;

export class OssuaryQueen extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'ossuaryqueen';
    this.name = 'Vesperine, the Ossuary Queen';
    this.bossId = 'vesperine';
    this.flag = 'vesperineDead';
    this.music = 'crypt';
    this.summonPack = 'vesperine-dead';
    this.intro = { title: 'Abbess of the Undercroft', open: 'bellSmall', roar: 'roarBig', scale: 1.1, lift: -1.2, roarAt: [3.4, 1.6] };
    this.reward = { gear: 'queens_scythe', banner: ['The Dead Rest', 'Vesperine, the Ossuary Queen'] };
    this.model = buildOssuaryQueen();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 1700;
    this.maxPoise = 100;
    this.ash = 4000;
    this.radius = 0.7;
    this.height = 3.0;
    this.lockHeight = 2.0;
    this.accel = 8;
    this.burnResist = 1.4;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.9;
    this.ring = 4.6;
    this.chaseSpeed = 5.8;
    this.circleSpeed = 2.4;
    this.poses = POSES;
    this.trailLen = 1.85; // the blade's reach from the hand, for swing trails
    this.trailColor = 0xb0f080;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    const blade = (dmg, reach, arc, extra = {}) => ({ reach, arc, dmg, poise: 32, height: 4, knock: 4, ...extra });
    this.moves = {
      sweep: { windup: 0.64, active: 0.2, recover: 0.5, track: 4, pose: 'sweep', parry: true, cd: 1.1, next: ['sweepB', 0.6], melee: blade(30, 4.8, 1.4) },
      sweepB: { windup: 0.4, active: 0.2, recover: 0.6, track: 3, pose: 'sweepB', parry: true, cd: 1.2, next: ['spin', 0.3], melee: blade(28, 4.8, 1.4) },
      spin: {
        windup: 0.6, active: 0.7, recover: 0.7, track: 2, pose: 'spin', cd: 1.4,
        start: (self) => self.game.audio.playAt('heavySwing', self.pos, 60),
        melee: { reach: 4.4, arc: Math.PI, dmg: 22, poise: 26, height: 4, knock: 4 },
      },
      spears: { windup: 0.9, active: 0.1, recover: 0.8, track: 3, pose: 'spears', cd: 1.5, fire: (self, c) => self._spearLine(c.p) },
      under: { windup: 0.8, active: 0.1, recover: 0.7, track: 2, pose: 'spears', cd: 1.4, fire: (self, c) => self._under(c.p) },
      blink: { windup: 0.4, active: 0.1, recover: 0.3, track: 0, pose: 'call', cd: 0.4, fire: (self, c) => self._blink(c.p) },
      call: { windup: 1.1, active: 0.1, recover: 0.8, track: 2, pose: 'call', cd: 1.2, fire: (self) => self._call() },
      nova: { windup: 0.6, active: 0.1, recover: 0.8, track: 0, pose: 'call', cd: 1.2, fire: (self) => self._nova() },
    };
    this._enter();
  }

  enter() { return { x: CHAPEL.x, z: CHAPEL.z + 22, yaw: Math.PI }; }
  arena() { return { x: CHAPEL.x, z: CHAPEL.z, leash: CHAPEL.leash }; }
  _sees(c) { return Math.hypot(c.p.pos.x - CHAPEL.x, c.p.pos.z - CHAPEL.z) < CHAPEL.trigger; }
  _idle() { this.yaw = this.spawn.yaw ?? 0; }

  _onReset() {
    super._onReset();
    this.callCd = 6;
  }

  awaken(len) {
    super.awaken(len ?? 1.6);
    this.game.audio.playAt('bellSmall', this.pos, 100);
  }

  _wakePose(p) { Object.assign(p, POSES.roar); }
  _onWake(t, dt, c) { this.turnTo(c.toP, 2.5, dt); }

  update(dt) {
    super.update(dt);
    if (this.callCd > 0) this.callCd -= dt;
    if (this.alive) {
      const k = this.phase === 2 ? 1.7 : 1;
      this.model.flame.emissiveIntensity = 2 * k + Math.sin(this.game.time * 9) * 0.4;
      this.model.glow.material.opacity = 0.4 + 0.2 * k;
    }
  }

  _deadLeft() {
    let n = 0;
    for (const e of this.game.enemies) if (e.pack === this.summonPack && e.alive) n++;
    return n;
  }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.3;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 5.5) opts.push(['sweep', 3], ['spin', behind ? 3 : 1.2]);
    if (dist < 4 && p2) opts.push(['nova', behind ? 3 : 1.5]);
    if (dist < 3.5 && !p2) opts.push(['blink', 0.8]);
    if (dist > 6 && dist < 26) opts.push(['spears', 2.2], ['under', 1.6]);
    if (dist > 14) opts.push(['blink', 1.5]);
    if (this.callCd <= 0 && this._deadLeft() < (p2 ? 3 : 2)) opts.push(['call', 3]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  _spearLine(p) {
    const g = this.game;
    const base = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const lines = this.phase === 2 ? [-0.28, 0.28] : [0];
    for (const off of lines) {
      const a = base + off;
      for (let i = 0; i < 7; i++) {
        const k = 2.5 + i * 2.8;
        g.effects.iceSpike(this, this.pos.x + Math.sin(a) * k, this.pos.z + Math.cos(a) * k, 0.4 + i * 0.1, { look: 'bone', radius: 1.6, count: 4, hit: { dmg: 26, poise: 30, knock: 4, unblockable: true } });
      }
    }
    g.audio.playAt('slam', this.pos, 50);
  }

  _under(p) {
    const g = this.game;
    const hit = { dmg: 30, poise: 36, knock: 5, unblockable: true };
    g.effects.iceSpike(this, p.pos.x + p.vel.x * 0.5, p.pos.z + p.vel.z * 0.5, 0.9, { look: 'bone', radius: 2.4, hit });
    if (this.phase === 2) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        g.effects.iceSpike(this, p.pos.x + Math.sin(a) * 4, p.pos.z + Math.cos(a) * 4, 1.15 + i * 0.15, { look: 'bone', radius: 2, hit });
      }
    }
  }

  // Into her candle-smoke and out again, beside you.
  _blink(p) {
    const g = this.game, w = g.world;
    const puff = (x, z) => g.particles.emit({ x, y: this.pos.y + 1.4, z, count: 40, speed: 2.5, up: 1.5, color: 0x3a3a34, color2: 0x90f060, life: [0.5, 1.1], size: [0.15, 0.3], jitter: 0.8 });
    puff(this.pos.x, this.pos.z);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 3;
      const x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d;
      if (Math.hypot(x - CHAPEL.x, z - CHAPEL.z) > CHAPEL.r - 2) continue;
      this.pos.set(x, w.getHeight(x, z), z);
      this.yaw = Math.atan2(p.pos.x - x, p.pos.z - z);
      break;
    }
    puff(this.pos.x, this.pos.z);
    g.audio.playAt('blink', this.pos, 60);
  }

  // Her dead climb out of the chapel floor.
  _call() {
    const g = this.game;
    this.callCd = this.phase === 2 ? 16 : 22;
    const n = this.phase === 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = this.yaw + (i - (n - 1) / 2) * 1.2;
      const x = this.pos.x + Math.sin(a) * 5, z = this.pos.z + Math.cos(a) * 5;
      const e = g.summonEnemy?.('skeleton', x, z, a, { pack: this.summonPack });
      if (!e) continue;
      e.pack = this.summonPack; // sentries don't carry their spawn's pack
      e.ash = 0;
      e.baseAsh = 0;
      e.revived = true; // the called dead don't get up twice
      e.state = 'chase';
      g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.4, z, count: 24, speed: 2, up: 2, color: 0xd8cdb0, color2: 0x90f060, life: [0.6, 1.2], size: [0.1, 0.22], jitter: 0.8 });
    }
    g.audio.playAt('bellSmall', this.pos, 80);
  }

  _nova() {
    const g = this.game;
    g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 7, speed: 13, color: 0xd8f0b0, hit: { dmg: 22, poise: 40, knock: 6, unblockable: true } });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.effects.iceSpike(this, this.pos.x + Math.sin(a) * 5, this.pos.z + Math.cos(a) * 5, 0.4, { look: 'bone', radius: 1.6, count: 4, hit: { dmg: 20, poise: 30, knock: 5, unblockable: true } });
    }
  }

  onFightEnd() {
    const g = this.game;
    g.despawnExtras?.((e) => e.pack === this.summonPack);
  }

  // Half health: the candles flare green and the floor gives up more of her dead.
  _phase(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.0;
    if (!this.phased && this.t > 0.5) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.85;
      this.chaseSpeed = 6.4;
      this.callCd = 0;
      this.game.audio.playAt('roarBig', this.pos, 90);
      this._nova();
    }
    if (this.t >= 2.0) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }
}
