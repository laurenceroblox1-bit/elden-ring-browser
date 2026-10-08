// Grimhorn, the troll of the Howling Field: a field boss. It lumbers about its patch of the field until
// it sees you (or you hit it), roars, and fights until you leave the field or one of you falls. Slow
// and enormous: an overhead slam that cracks the ground in a shockwave, a wide sweep of its club, a
// stomp when you hide at its feet, and lumps of ice it tears up and hurls when you keep your distance.
// Below 45% health it enrages: faster, and the slam comes twice.
import { BigFoe } from './BigFoe.js';
import { buildTroll } from '../models/characters.js';
import { pose } from '../models/pose.js';
import { angleDiff } from '../core/math.js';

const SIZE = 2.4;

const POSES = {
  rest: pose({ torsoX: 0.35, headX: -0.25, sRx: -0.35, eR: -0.7, hRx: 1.2, sLx: -0.1, eL: -0.5, kR: 0.25, kL: 0.25, lRx: -0.15, lLx: -0.15, hipsH: -0.06 }),
  slam: [pose({ sRx: -3.0, eR: -0.8, hRx: 1.0, sLx: -2.8, eL: -0.7, torsoX: -0.35, headX: -0.3, kR: 0.2, kL: 0.2 }),
    pose({ sRx: -0.9, eR: -0.1, hRx: 1.4, sLx: -0.8, eL: -0.1, torsoX: 0.65, headX: 0.1, hipsH: -0.16, kR: 0.5, kL: 0.5, lRx: -0.4, lLx: -0.3 })],
  sweep: [pose({ sRx: -1.4, sRy: -1.5, eR: -0.4, hRx: 1.3, torsoY: -0.95, torsoX: 0.2, sLx: -0.3, kR: 0.3, kL: 0.3 }),
    pose({ sRx: -1.3, sRy: 1.25, eR: -0.1, hRx: 1.3, torsoY: 0.85, torsoX: 0.3, sLx: 0.2, kR: 0.3, kL: 0.3 })],
  stomp: [pose({ lRx: -1.3, kR: 1.1, torsoX: -0.1, sRz: -0.5, sLz: 0.5, sRx: -0.5, eR: -0.7, hRx: 1.2, hipsH: 0.04 }),
    pose({ lRx: -0.1, kR: 0.15, torsoX: 0.45, hipsH: -0.14, sRz: -0.3, sLz: 0.3, kL: 0.4, sRx: -0.4, eR: -0.6, hRx: 1.2 })],
  throw: [pose({ sLx: -0.2, sRx: 0.5, eR: -1.6, hRx: 1.2, torsoY: -0.8, torsoX: 0.55, hipsH: -0.14, kR: 0.5, kL: 0.5 }),
    pose({ sRx: -2.5, eR: -0.2, hRx: 1.2, torsoY: 0.6, torsoX: -0.1, sLx: -0.5, kR: 0.2 })],
  roar: pose({ torsoX: -0.5, headX: -0.6, sRz: -1.0, sLz: 1.0, sRx: -0.8, sLx: -0.8, eR: -0.6, eL: -0.6, hRx: 1.2, kR: 0.3, kL: 0.3 }),
  hurt: pose({ torsoX: -0.2, headX: -0.3, sRz: -0.6, sLz: 0.6, sRx: -0.3, eR: -0.6, hRx: 1.2, hipsH: -0.06 }),
  parried: pose({ sRx: -2.8, sRz: -0.5, eR: -0.3, hRx: 1.0, torsoX: -0.4, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.7, headX: 0.4, sRx: -0.3, sRz: -0.5, eR: -0.2, hRx: 1.0, sLz: 0.5, hipsH: -0.25, kR: 0.8, kL: 0.8, lRx: -0.5, lLx: -0.5 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.1, sLz: 1.0, lRx: -0.3 }),
};
const KNOCKDOWN = 2.6;

export class Troll extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'troll';
    this.name = 'Grimhorn, the Howling Field';
    this.bossId = 'troll';
    this.flag = 'trollDead';
    this.music = 'winter';
    this.intro = null; // a field boss: it just roars
    this.reward = { gear: 'trollbone_club', banner: ['Giant Felled', 'Grimhorn, the Howling Field'] };
    this.model = buildTroll();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 1150;
    this.maxPoise = 150;
    this.ash = 2000;
    this.radius = 1.3;
    this.height = 4.4;
    this.lockHeight = 2.8;
    this.returnSpeed = 4;
    this.accel = 4;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 2.0;
    this.ring = 4.5;
    this.chaseSpeed = 4.6;
    this.circleSpeed = 1.2;
    this.phaseAt = 0.45;
    this.hitWhileIdle = true;
    this.frostResist = 0.5;
    this.poses = POSES;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    this.moves = {
      slam: {
        windup: 1.05, active: 0.16, recover: 1.0, track: 2.5, pose: 'slam', parry: false, cd: 1.4, next: ['slam2', 0],
        melee: { reach: 4.8, arc: 0.5, dmg: 42, poise: 70, heavy: true, height: 6, knock: 6 },
        fire: (self) => self._quake(3.6, 6.5, 26),
      },
      slam2: {
        windup: 0.7, active: 0.16, recover: 1.1, track: 3, pose: 'slam', parry: false, cd: 1.6,
        melee: { reach: 4.8, arc: 0.5, dmg: 42, poise: 70, heavy: true, height: 6, knock: 6 },
        fire: (self) => self._quake(3.6, 7.5, 26),
      },
      sweep: {
        windup: 0.85, active: 0.3, recover: 0.85, track: 3, pose: 'sweep', parry: true, cd: 1.2,
        melee: { reach: 5.2, arc: 1.5, dmg: 32, poise: 45, height: 5, knock: 5 },
      },
      stomp: {
        windup: 0.6, active: 0.1, recover: 0.75, track: 0, pose: 'stomp', parry: false, cd: 1.0,
        fire: (self) => self._quake(0.5, 5.5, 22),
      },
      throw: {
        windup: 1.15, active: 0.1, recover: 0.75, track: 3, pose: 'throw', parry: false, cd: 1.8,
        start: (self) => self._dig(),
        fire: (self, c) => self._hurl(c.p),
      },
    };
    this._enter();
  }

  enter() { return { x: this.spawn.x - 8, z: this.spawn.z + 18, yaw: Math.PI + 0.4 }; }
  arena() { return { x: this.spawn.x, z: this.spawn.z, leash: 60 }; }

  _sees(c) {
    return (c.dist < 24 && Math.abs(angleDiff(this.yaw, c.toP)) < 1.6) || c.dist < 12;
  }

  // Lumbering about its patch of field, now and then sniffing the air.
  _idle(dt, c) {
    const a = this.game.time * 0.12 + this.spawn.z;
    const tx = this.spawn.x + Math.cos(a) * 8, tz = this.spawn.z + Math.sin(a) * 8;
    const hx = tx - this.pos.x, hz = tz - this.pos.z;
    if (Math.hypot(hx, hz) > 1) {
      this.turnTo(Math.atan2(hx, hz), 1, dt);
      this.want.x = this.forwardX * 1.2;
      this.want.z = this.forwardZ * 1.2;
    }
  }

  awaken(len) {
    super.awaken(len ?? 1.7);
    this.game.audio.playAt('roarBig', this.pos, 80);
    this.game.cam.shake(0.3);
  }

  _wakePose(p) {
    Object.assign(p, POSES.roar);
  }

  _onWake(t, dt, c) {
    this.turnTo(c.toP, 3, dt);
  }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.2;
    const opts = [];
    if (dist < 6.5) opts.push(['sweep', behind ? 1 : 3], ['slam', this.phase === 2 ? 2 : 3]);
    if (dist < 4.5) opts.push(['stomp', behind ? 5 : 1.2]);
    if (dist > 9 && dist < 34) opts.push(['throw', 3]);
    if (dist >= 6.5 && dist <= 9) opts.push(['slam', 1]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  // The ground cracks: a shockwave from `ahead` metres in front of it.
  _quake(ahead, maxR, dmg) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.shockwave(this, x, z, { maxR, speed: 13, color: 0xd8e8f0, hit: { dmg, poise: 40, heavy: true, knock: 5 } });
    g.audio.playAt('slam', this.pos, 70);
    g.cam.shake(Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 14 ? 0.35 : 0.15);
    g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.5, z, count: 40, speed: 6, up: 3, color: 0xe8f0f4, color2: 0xb0c4d0, life: [0.4, 1.0], size: [0.15, 0.35], drag: 2, gravity: 4, jitter: 1 });
  }

  _dig() {
    const g = this.game;
    const x = this.pos.x + this.forwardX * 2, z = this.pos.z + this.forwardZ * 2;
    g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.3, z, count: 24, speed: 3, up: 2.5, color: 0xeef4f8, color2: 0xb8ccd8, life: [0.4, 0.9], size: [0.12, 0.26], gravity: 5 });
  }

  // Hurls a lump of ice in an arc at where you will be; it bursts in a small shockwave where it lands.
  _hurl(p) {
    const g = this.game;
    const sx = this.pos.x + this.forwardX * 1.2, sy = this.pos.y + 4.6, sz = this.pos.z + this.forwardZ * 1.2;
    const speed = 24, grav = 14;
    const d = Math.hypot(p.pos.x - sx, p.pos.z - sz);
    const flight = d / speed;
    const tx = p.pos.x + p.vel.x * flight * 0.6, tz = p.pos.z + p.vel.z * flight * 0.6;
    const drop = 0.5 * grav * flight * flight;
    g.projectiles.spawn(this, {
      kind: 'boulder', x: sx, y: sy, z: sz, dirX: tx - sx, dirY: p.pos.y + 0.5 - sy + drop, dirZ: tz - sz,
      speed, gravity: grav, radius: 1.0, life: 3, scale: 1.4,
      hit: { dmg: 34, poise: 55, heavy: true, frost: 18, knock: 6, parryable: false }, sound: 'slam',
      onBurst: (pr) => g.effects.shockwave(this, pr.pos.x, pr.pos.z, { maxR: 3.5, speed: 10, color: 0xd8eef8, hit: { dmg: 16, poise: 20, frost: 12 } }),
    });
    g.audio.playAt('heavySwing', this.pos);
  }

  // Enrage: it beats its chest and roars; faster from here on, and the slam comes twice.
  _phase(dt, c) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.0;
    if (!this.phased && this.t > 0.5) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.8;
      this.chaseSpeed = 5.6;
      this.moves.slam.next = ['slam2', 0.65];
      this.game.audio.playAt('roarBig', this.pos, 80);
      this.game.cam.shake(0.4);
      this.game.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 9, speed: 12, color: 0xe8f0f4, hit: { dmg: 14, poise: 30, knock: 5 } });
    }
    if (this.t >= 2.0) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }

  _onReset() {
    super._onReset();
    if (this.moves) this.moves.slam.next = ['slam2', 0];
    this.chaseSpeed = 4.6;
    this.hitWhileIdle = true;
  }
}
