// Hornwood, the Antlered King: the old king of the Amberwood, who made a pact with the wood to keep it
// from the axe and was crowned for it with antlers that grew through his helm. He holds court in the
// Antlered Glade, and the wood fights for him. An antler greatblade swung in wide sweeps (parryable);
// a charge with his head down that will not be turned aside; roots driven up through the ground in a
// line at you; a fan of razor-edged leaves. At half health he sounds the horn of the Wild Hunt: two
// boars come crashing out of the trees, the leaves fly thicker, and he roots the glade round him.
import { BigFoe } from './BigFoe.js';
import { buildAntlerKing } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { GLADE } from '../data/biomes.js';
import { angleDiff } from '../core/math.js';

const SIZE = 1.6;
const SW_A = pose({ sRx: -1.3, sRy: -1.7, eR: -0.3, hRx: 1.4, torsoY: -1.0, torsoX: 0.1, sLx: -0.6, eL: -0.6, kR: 0.2, kL: 0.2 });
const SW_B = pose({ sRx: -1.2, sRy: 1.4, eR: -0.1, hRx: 1.4, torsoY: 0.95, torsoX: 0.3, sLx: 0.2, eL: -0.3, kR: 0.25, kL: 0.2 });
const POSES = {
  rest: pose({ sRx: -0.5, eR: -1.0, hRx: 1.4, sLx: -0.2, eL: -0.4, torsoX: 0.05, headX: 0.05 }),
  roar: pose({ torsoX: -0.4, headX: -0.6, sRx: -0.4, eR: -0.9, hRx: 1.4, sLx: -2.6, eL: -0.2, kR: 0.15, kL: 0.15 }),
  sweep: [SW_A, SW_B],
  sweepB: [SW_B, SW_A],
  overhead: [pose({ sRx: -3.0, eR: -0.5, hRx: 1.2, sLx: -2.6, eL: -0.6, torsoX: -0.3, headX: -0.2 }),
    pose({ sRx: -1.1, eR: -0.1, hRx: 1.5, sLx: -0.9, eL: -0.2, torsoX: 0.6, hipsH: -0.16, kR: 0.5, kL: 0.4, lRx: -0.4 })],
  gore: [pose({ torsoX: 0.7, headX: 0.6, hipsH: -0.2, kR: 0.8, kL: 0.8, lRx: -0.5, lLx: 0.2, sRx: 0.3, eR: -0.8, hRx: 1.4, sLx: 0.4, eL: -0.4 }),
    pose({ torsoX: 0.9, headX: 0.8, hipsH: -0.1, lRx: -1.0, kR: 0.5, lLx: 0.6, kL: 0.2, sRx: 0.6, eR: -0.5, hRx: 1.4, sLx: 0.6, eL: -0.3 })],
  roots: [pose({ sRx: -2.8, eR: -0.3, hRx: 2.0, sLx: -2.6, eL: -0.4, torsoX: -0.2, headX: -0.2 }),
    pose({ sRx: -0.6, eR: 0, hRx: 2.6, sLx: -0.6, eL: -0.1, torsoX: 0.8, hipsH: -0.3, kR: 0.9, kL: 0.7, lRx: -0.5 })],
  leaves: [pose({ sRx: -0.6, sRy: -1.4, eR: -0.6, hRx: 1.6, torsoY: -1.1, torsoX: 0.1, sLx: -0.8, eL: -0.6 }),
    pose({ sRx: -1.6, sRy: 1.2, eR: 0, hRx: 1.4, torsoY: 0.9, torsoX: 0.1, sLx: 0.2, eL: -0.2 })],
  hurt: pose({ torsoX: -0.35, headX: -0.3, sRz: -0.5, sLz: 0.5, sRx: -0.4, eR: -0.9, hRx: 1.4, hipsH: -0.06 }),
  parried: pose({ sRx: -2.6, sRz: -0.5, eR: -0.3, hRx: 1.0, torsoX: -0.45, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.6, headX: 0.35, sRx: -0.3, sRz: -0.4, eR: -0.2, hRx: 1.0, sLx: -0.4, sLz: 0.4, eL: -0.4, hipsH: -0.14, kR: 0.4, kL: 0.4 }),
  dead: pose({ hipsH: -0.42, lRx: -1.35, kR: 1.55, lLx: 0.25, kL: 1.9, torsoX: 0.7, headX: 0.6, sRz: -0.6, sLz: 0.6 }),
};
const KNOCKDOWN = 2.3;

export class AntlerKing extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'antlerking';
    this.name = 'Hornwood, the Antlered King';
    this.bossId = 'hornwood';
    this.flag = 'hornwoodDead';
    this.music = 'hunt';
    this.summonPack = 'hornwood-hunt';
    this.intro = { title: 'King of the Amberwood', open: 'roarBig', roar: 'roarBig', scale: 1.1, lift: -1.2, roarAt: [3.4, 1.6] };
    this.reward = { gear: 'kings_antler', banner: ['The Wood Is Free', 'Hornwood, the Antlered King'] };
    this.model = buildAntlerKing();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 1900;
    this.maxPoise = 115;
    this.ash = 4400;
    this.radius = 0.75;
    this.height = 3.0;
    this.lockHeight = 2.0;
    this.accel = 7;
    this.burnResist = 1.3;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.9;
    this.ring = 4.8;
    this.chaseSpeed = 5.6;
    this.circleSpeed = 2.2;
    this.poses = POSES;
    this.trailLen = 1.6; // the blade's reach from the hand, for swing trails
    this.trailColor = 0xffc070;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    const blade = (dmg, reach, arc, extra = {}) => ({ reach, arc, dmg, poise: 34, height: 4, knock: 4, ...extra });
    this.moves = {
      sweep: { windup: 0.7, active: 0.2, recover: 0.5, track: 4, pose: 'sweep', parry: true, cd: 1.1, next: ['sweepB', 0.55], melee: blade(32, 5.0, 1.4) },
      sweepB: { windup: 0.42, active: 0.2, recover: 0.6, track: 3, pose: 'sweepB', parry: true, cd: 1.2, next: ['overhead', 0.25], melee: blade(30, 5.0, 1.4) },
      overhead: {
        windup: 0.9, active: 0.18, recover: 0.8, track: 3, pose: 'overhead', parry: true, cd: 1.4, melee: blade(44, 5.2, 0.5, { poise: 55, heavy: true }),
        fire: (self) => self._splitGround(),
      },
      gore: {
        windup: 0.85, active: 0.6, recover: 0.8, track: 4, pose: 'gore', lunge: 17, cd: 1.6,
        start: (self) => self.game.audio.playAt('roarBig', self.pos, 60),
        melee: { reach: 3.0, arc: 0.9, dmg: 42, poise: 60, heavy: true, height: 4, knock: 8 },
      },
      roots: { windup: 1.0, active: 0.1, recover: 0.9, track: 3, pose: 'roots', cd: 1.6, fire: (self, c) => self._rootLine(c.p) },
      leaves: { windup: 0.8, active: 0.1, recover: 0.6, track: 4, pose: 'leaves', cd: 1.3, fire: (self, c) => self._leaves(c.p) },
      hunt: { windup: 1.2, active: 0.1, recover: 0.8, track: 2, pose: 'roots', cd: 1.2, start: (self) => self.game.audio.playAt('roarBig', self.pos, 90), fire: (self) => self._hunt() },
    };
    this._enter();
  }

  enter() { return { x: GLADE.x - 20, z: GLADE.z - 22, yaw: 0.75 }; }
  arena() { return { x: GLADE.x, z: GLADE.z, leash: GLADE.leash }; }
  _sees(c) { return Math.hypot(c.p.pos.x - GLADE.x, c.p.pos.z - GLADE.z) < GLADE.trigger; }

  _onReset() {
    super._onReset();
    this.huntCd = 0;
  }

  _idle() { this.yaw = this.spawn.yaw ?? 0; }

  awaken(len) {
    super.awaken(len ?? 1.6);
    this.game.audio.playAt('roarBig', this.pos, 100);
  }

  _wakePose(p) { Object.assign(p, POSES.roar); }
  _onWake(t, dt, c) { this.turnTo(c.toP, 2.5, dt); }

  update(dt) {
    super.update(dt);
    if (this.huntCd > 0) this.huntCd -= dt;
    if (this.alive) {
      const k = this.phase === 2 ? 1.6 : 1;
      this.model.eye.emissiveIntensity = 1.8 * k + Math.sin(this.game.time * 3) * 0.3;
      this.model.glow.material.opacity = 0.4 + 0.2 * k;
      // Leaves stream off his cloak as he moves.
      if (this.shown && Math.random() < dt * (this.phase === 2 ? 14 : 6)) {
        this.game.particles.emit({ x: this.pos.x + (Math.random() - 0.5), y: this.pos.y + 1.5 + Math.random() * 2, z: this.pos.z + (Math.random() - 0.5), count: 1, speed: 1, up: 0.2, gravity: 1, color: 0xc8742e, color2: 0xa8442a, life: [1, 2], size: [0.08, 0.14], drag: 0.5, jitter: 0.5 });
      }
    }
  }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.3;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 5.8) opts.push(['sweep', 3], ['overhead', behind ? 0.5 : 1.5]);
    if (dist > 6 && dist < 20) opts.push(['gore', 2.2], ['leaves', 1.5]);
    if (dist > 7 && dist < 26) opts.push(['roots', p2 ? 2.5 : 1.8]);
    if (p2 && this.huntCd <= 0 && this._huntLeft() < 2) opts.push(['hunt', 6]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  _huntLeft() {
    let n = 0;
    for (const e of this.game.enemies) if (e.pack === this.summonPack && e.alive) n++;
    return n;
  }

  // The overhead blow splits the ground ahead: roots burst up where it lands.
  _splitGround() {
    const g = this.game;
    const x = this.pos.x + this.forwardX * 4, z = this.pos.z + this.forwardZ * 4;
    g.effects.iceSpike(this, x, z, 0.3, { look: 'root', radius: 2.4, count: 6, hit: { dmg: 22, poise: 30, knock: 5, unblockable: true } });
    g.audio.playAt('slam', this.pos, 60);
    g.cameraShake(0.2, 0.6);
  }

  _rootLine(p) {
    const g = this.game;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
    const lines = this.phase === 2 ? [-0.35, 0, 0.35] : [0];
    for (const off of lines) {
      const a = Math.atan2(dx, dz) + off;
      for (let i = 0; i < 7; i++) {
        const k = 2.5 + i * 3;
        g.effects.iceSpike(this, this.pos.x + Math.sin(a) * k, this.pos.z + Math.cos(a) * k, 0.4 + i * 0.11, { look: 'root', radius: 1.7, count: 4, hit: { dmg: 26, poise: 32, knock: 4, unblockable: true } });
      }
    }
    g.audio.playAt('slam', this.pos, 60);
    void d;
  }

  // A fan of razor leaves flung off the blade.
  _leaves(p) {
    const g = this.game;
    const sx = this.pos.x + this.forwardX, sy = this.pos.y + 2.4, sz = this.pos.z + this.forwardZ;
    const base = Math.atan2(p.pos.x - sx, p.pos.z - sz);
    const n = this.phase === 2 ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.13;
      g.projectiles.spawn(this, {
        kind: 'leaf', x: sx, y: sy, z: sz, dirX: Math.sin(a), dirY: (p.pos.y + 1 - sy) / Math.max(4, Math.hypot(p.pos.x - sx, p.pos.z - sz)), dirZ: Math.cos(a),
        speed: 22, radius: 0.4, life: 1.6, scale: 1.4, hit: { dmg: 15, poise: 10, parryable: false }, sound: 'swing',
      });
    }
    g.audio.playAt('heavySwing', this.pos, 60);
  }

  // The Wild Hunt: boars come crashing out of the trees round the glade.
  _hunt() {
    const g = this.game;
    this.huntCd = 26;
    for (let i = 0; i < 2; i++) {
      const a = Math.atan2(this.pos.x - GLADE.x, this.pos.z - GLADE.z) + (i ? 2.2 : -2.2);
      const x = GLADE.x + Math.sin(a) * (GLADE.r - 4), z = GLADE.z + Math.cos(a) * (GLADE.r - 4);
      const e = g.summonEnemy?.('boar', x, z, a + Math.PI, { pack: this.summonPack });
      if (!e) continue;
      e.ash = 0;
      e._alertPack?.();
      e._engage?.();
      g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.6, z, count: 26, speed: 3, up: 2.5, color: 0xc8742e, color2: 0xa8442a, life: [0.6, 1.2], size: [0.1, 0.22], jitter: 0.8 });
    }
  }

  // When the fight ends either way, the hunt melts back into the trees.
  onFightEnd() {
    const g = this.game;
    for (const e of g.enemies) if (e.pack === this.summonPack && e.alive) g.particles.emit({ x: e.pos.x, y: e.pos.y + 0.8, z: e.pos.z, count: 20, speed: 2, up: 2, color: 0xc8742e, color2: 0xa8442a, life: [0.5, 1.0], size: [0.1, 0.2], jitter: 0.6 });
    g.despawnExtras?.((e) => e.pack === this.summonPack);
  }

  // Half health: the horn of the Wild Hunt, and the glade turns on you.
  _phase(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.0;
    const g = this.game;
    if (!this.phased && this.t > 0.5) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.85;
      this.chaseSpeed = 6.2;
      g.audio.playAt('roarBig', this.pos, 100);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.effects.iceSpike(this, this.pos.x + Math.sin(a) * 6, this.pos.z + Math.cos(a) * 6, 0.5 + (i % 2) * 0.25, { look: 'root', radius: 2, count: 5, hit: { dmg: 22, poise: 30, knock: 5, unblockable: true } });
      }
      this._hunt();
    }
    if (this.t >= 2.0) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }
}
