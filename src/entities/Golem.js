// Cinder Golems: elites of the Wastes, walls of basalt with a furnace inside. They stand like part of
// the landscape until you come close, then lumber after you. A slow overhead slam that splashes magma
// around where it lands, a wide backhand, a stomp for anyone under its feet, and lumps of molten rock
// torn from the ground and lobbed at anyone who keeps their distance (they burst into burning ground).
// Not a boss: it is leashed to its post and gets up again after you rest (BigFoe's `elite` mode).
import { BigFoe } from './BigFoe.js';
import { buildGolem } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { angleDiff } from '../core/math.js';

const SIZE = 1.9;
const POSES = {
  rest: pose({ torsoX: 0.25, headX: -0.15, sRx: -0.2, eR: -0.5, sLx: -0.2, eL: -0.5, sRz: -0.25, sLz: 0.25, kR: 0.2, kL: 0.2, hipsH: -0.04 }),
  slam: [pose({ sRx: -3.0, eR: -0.6, sLx: -3.0, eL: -0.6, torsoX: -0.35, headX: -0.3, kR: 0.2, kL: 0.2 }),
    pose({ sRx: -1.0, eR: -0.1, sLx: -1.0, eL: -0.1, torsoX: 0.7, hipsH: -0.18, kR: 0.5, kL: 0.5, lRx: -0.4, lLx: -0.3 })],
  backhand: [pose({ sRx: -1.3, sRy: -1.6, eR: -0.5, torsoY: -1.0, torsoX: 0.15, kR: 0.3, kL: 0.3 }),
    pose({ sRx: -1.3, sRy: 1.3, eR: -0.1, torsoY: 0.9, torsoX: 0.3, kR: 0.3, kL: 0.3 })],
  stomp: [pose({ lRx: -1.2, kR: 1.0, torsoX: -0.1, sRz: -0.6, sLz: 0.6, hipsH: 0.04 }),
    pose({ lRx: -0.1, kR: 0.15, torsoX: 0.45, hipsH: -0.14, sRz: -0.4, sLz: 0.4, kL: 0.4 })],
  lob: [pose({ sRx: 0.6, eR: -1.4, torsoY: -0.7, torsoX: 0.5, hipsH: -0.14, kR: 0.5, kL: 0.5 }),
    pose({ sRx: -2.6, eR: -0.2, torsoY: 0.6, torsoX: -0.1, sLx: -0.5, kR: 0.2 })],
  roar: pose({ torsoX: -0.45, headX: -0.5, sRz: -1.0, sLz: 1.0, sRx: -0.8, sLx: -0.8, eR: -0.6, eL: -0.6, kR: 0.3, kL: 0.3 }),
  hurt: pose({ torsoX: -0.2, headX: -0.3, sRz: -0.6, sLz: 0.6, sRx: -0.3, eR: -0.6, hipsH: -0.06 }),
  parried: pose({ sRx: -2.6, sRz: -0.5, eR: -0.3, torsoX: -0.4, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.7, headX: 0.4, sRx: -0.3, sRz: -0.5, eR: -0.2, sLz: 0.5, hipsH: -0.25, kR: 0.8, kL: 0.8, lRx: -0.5, lLx: -0.5 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.1, sLz: 1.0, lRx: -0.3 }),
};
const KNOCKDOWN = 2.4;

export class Golem extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.elite = true;
    this.isBoss = false;
    this.tag = 'golem';
    this.name = 'Cinder Golem';
    this.model = buildGolem();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 420;
    this.maxPoise = 90;
    this.ash = 650;
    this.radius = 1.0;
    this.height = 3.4;
    this.lockHeight = 2.3;
    this.leash = 30;
    this.returnSpeed = 3;
    this.accel = 4;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.9;
    this.ring = 3.6;
    this.chaseSpeed = 3.4;
    this.circleSpeed = 1.0;
    this.phaseAt = 0; // no second phase
    this.burnResist = 0;
    this.poses = POSES;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    this.moves = {
      slam: {
        windup: 1.1, active: 0.16, recover: 1.0, track: 2.5, pose: 'slam', cd: 1.6,
        melee: { reach: 3.8, arc: 0.55, dmg: 38, poise: 60, heavy: true, height: 5, knock: 6, burn: 20 },
        fire: (self) => self._splash(2.8),
      },
      backhand: {
        windup: 0.8, active: 0.25, recover: 0.8, track: 3, pose: 'backhand', parry: true, cd: 1.3,
        melee: { reach: 4.0, arc: 1.4, dmg: 28, poise: 40, height: 4, knock: 5 },
      },
      stomp: {
        windup: 0.6, active: 0.1, recover: 0.8, track: 0, pose: 'stomp', cd: 1.2,
        fire: (self) => self._quake(0.4, 5, 20),
      },
      lob: {
        windup: 1.1, active: 0.1, recover: 0.8, track: 3, pose: 'lob', cd: 2.2,
        start: (self) => self._dig(),
        fire: (self, c) => self._lob(c.p),
      },
    };
    if (new.target === Golem) this._enter();
  }

  arena() { return { x: this.spawn.x, z: this.spawn.z, leash: this.leash }; }
  _sees(c) { return c.dist < 13 || (c.dist < 22 && Math.abs(angleDiff(this.yaw, c.toP)) < 1.2); }

  awaken(len) {
    super.awaken(len ?? 1.2);
    this.game.audio.playAt('roarBig', this.pos, 50);
  }

  _wakePose(p) { Object.assign(p, POSES.roar); }
  _onWake(t, dt, c) { this.turnTo(c.toP, 3, dt); }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.2;
    const opts = [];
    if (dist < 5.5) opts.push(['backhand', behind ? 1 : 3], ['slam', 3]);
    if (dist < 4) opts.push(['stomp', behind ? 5 : 1.2]);
    if (dist > 8 && dist < 28) opts.push(['lob', 3]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  _phase() { this._engage(); return false; }

  // Magma splashes out where the slam lands: a ring of fire and a patch of burning ground.
  _splash(ahead) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.shockwave(this, x, z, { maxR: 5, speed: 12, color: 0xff7a2a, hit: { dmg: 18, poise: 25, burn: 22, knock: 4 } });
    g.effects.hazard(this, x, z, { radius: 2.4, life: 4, look: 'fire', hit: { dmg: 4, poise: 0, burn: 14, unblockable: true } });
    g.audio.playAt('slam', this.pos, 60);
    g.cameraShake(0.25, Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 12 ? 1 : 0.4);
    g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.4, z, count: 36, speed: 6, up: 3, color: 0xff6a1a, color2: 0xffd060, life: [0.4, 0.9], size: [0.12, 0.28], drag: 2, gravity: 6, jitter: 0.8 });
  }

  _quake(ahead, maxR, dmg) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.shockwave(this, x, z, { maxR, speed: 13, color: 0xffa060, hit: { dmg, poise: 40, heavy: true, knock: 5 } });
    g.audio.playAt('slam', this.pos, 60);
  }

  _dig() {
    const g = this.game;
    const x = this.pos.x + this.forwardX * 1.6, z = this.pos.z + this.forwardZ * 1.6;
    g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.3, z, count: 22, speed: 3, up: 2.5, color: 0xff6a1a, color2: 0x3a3634, life: [0.4, 0.9], size: [0.12, 0.26], gravity: 5 });
  }

  // A lump of magma lobbed at where you'll be; it bursts into a patch of burning ground.
  _lob(p) {
    const g = this.game;
    const sx = this.pos.x + this.forwardX, sy = this.pos.y + 3.8, sz = this.pos.z + this.forwardZ;
    const speed = 20, grav = 14;
    const flight = Math.hypot(p.pos.x - sx, p.pos.z - sz) / speed;
    const tx = p.pos.x + p.vel.x * flight * 0.6, tz = p.pos.z + p.vel.z * flight * 0.6;
    const drop = 0.5 * grav * flight * flight;
    g.projectiles.spawn(this, {
      kind: 'magma', x: sx, y: sy, z: sz, dirX: tx - sx, dirY: p.pos.y + 0.5 - sy + drop, dirZ: tz - sz,
      speed, gravity: grav, radius: 0.9, life: 3, scale: 1.1,
      hit: { dmg: 26, poise: 40, heavy: true, burn: 30, knock: 5, parryable: false }, sound: 'slam',
      onBurst: (pr) => g.effects.hazard(this, pr.pos.x, pr.pos.z, { radius: 2.6, life: 5, look: 'fire', hit: { dmg: 4, poise: 0, burn: 14, unblockable: true } }),
    });
  }

  update(dt) {
    super.update(dt);
    // The furnace inside it breathes.
    if (this.model.magma) this.model.magma.emissiveIntensity = 1.6 + Math.sin(this.game.time * 2.2 + this.spawn.x) * 0.4 + (this.state === 'attack' ? 0.8 : 0);
    if (this.tag === 'golem' && this.alive && this.shown && Math.random() < dt * 3) {
      this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 3.2, z: this.pos.z, count: 1, speed: 0.2, up: 1.5, color: 0xff7a2a, color2: 0xffc060, life: [0.6, 1.2], size: [0.06, 0.12], jitter: 0.5 });
    }
  }
}
