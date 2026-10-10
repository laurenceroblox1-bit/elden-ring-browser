// Corundel, the Glass Colossus: the Heart of Glass given a body, a giant of clear and violet crystal
// grown round a core of white light. Slow, enormous, and never still: a two-fisted slam that cracks
// crystal up through the floor where it lands, a backhand you can turn aside, lines of crystal driven at
// you through the ground, a beam of hard light poured from its core, and crystal erupting under your
// feet. At half health the core flares: the beam splits three ways, and getting close sets off a ring
// of crystal round it.
import { BigFoe } from './BigFoe.js';
import { buildColossus } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { HEART } from '../data/biomes.js';
import { angleDiff } from '../core/math.js';

const SIZE = 2.7;
const POSES = {
  rest: pose({ torsoX: 0.2, headX: -0.1, sRx: -0.2, eR: -0.5, sLx: -0.2, eL: -0.5, sRz: -0.25, sLz: 0.25, kR: 0.15, kL: 0.15 }),
  slam: [pose({ sRx: -3.0, eR: -0.6, sLx: -3.0, eL: -0.6, torsoX: -0.35, headX: -0.3, kR: 0.2, kL: 0.2 }),
    pose({ sRx: -1.0, eR: -0.1, sLx: -1.0, eL: -0.1, torsoX: 0.7, hipsH: -0.18, kR: 0.5, kL: 0.5, lRx: -0.4, lLx: -0.3 })],
  backhand: [pose({ sRx: -1.3, sRy: -1.6, eR: -0.5, torsoY: -1.0, torsoX: 0.15, kR: 0.3, kL: 0.3 }),
    pose({ sRx: -1.3, sRy: 1.3, eR: -0.1, torsoY: 0.9, torsoX: 0.3, kR: 0.3, kL: 0.3 })],
  stomp: [pose({ lRx: -1.2, kR: 1.0, torsoX: -0.1, sRz: -0.6, sLz: 0.6, hipsH: 0.04 }),
    pose({ lRx: -0.1, kR: 0.15, torsoX: 0.45, hipsH: -0.14, sRz: -0.4, sLz: 0.4, kL: 0.4 })],
  beam: [pose({ torsoX: -0.4, headX: -0.3, sRz: -1.3, sLz: 1.3, sRx: -0.2, sLx: -0.2, eR: -0.2, eL: -0.2 }),
    pose({ torsoX: 0.15, headX: 0.1, sRz: -1.4, sLz: 1.4, sRx: 0.1, sLx: 0.1, eR: -0.1, eL: -0.1, kR: 0.3, kL: 0.3, hipsH: -0.06 })],
  raise: [pose({ sRx: -2.9, eR: -0.2, sLx: -2.9, eL: -0.2, torsoX: -0.3, headX: -0.5 }),
    pose({ sRx: -2.5, eR: -0.1, sLx: -2.5, eL: -0.1, torsoX: -0.1, headX: -0.2, kR: 0.3, kL: 0.3 })],
  roar: pose({ torsoX: -0.45, headX: -0.5, sRz: -1.0, sLz: 1.0, sRx: -0.8, sLx: -0.8, eR: -0.6, eL: -0.6, kR: 0.3, kL: 0.3 }),
  hurt: pose({ torsoX: -0.2, headX: -0.3, sRz: -0.6, sLz: 0.6, sRx: -0.3, eR: -0.6, hipsH: -0.06 }),
  parried: pose({ sRx: -2.6, sRz: -0.5, eR: -0.3, torsoX: -0.4, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.7, headX: 0.4, sRx: -0.3, sRz: -0.5, eR: -0.2, sLz: 0.5, hipsH: -0.25, kR: 0.8, kL: 0.8, lRx: -0.5, lLx: -0.5 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.1, sLz: 1.0, lRx: -0.3 }),
};
const KNOCKDOWN = 2.6;

export class Colossus extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'colossus';
    this.name = 'Corundel, the Glass Colossus';
    this.bossId = 'corundel';
    this.flag = 'corundelDead';
    this.music = 'glass';
    this.intro = { title: 'Heart of the Shardlands', open: 'crack', roar: 'roarBig', scale: 1.0, lift: -0.6, roarAt: [3.4, 1.6] };
    this.reward = { gear: 'colossus_shard', banner: ['The Heart Is Still', 'Corundel, the Glass Colossus'] };
    this.model = buildColossus();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 2400;
    this.maxPoise = 140;
    this.ash = 4800;
    this.radius = 1.35;
    this.height = 5.0;
    this.lockHeight = 3.1;
    this.accel = 4;
    this.burnResist = 0.3;
    this.frostResist = 0.3;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 2.0;
    this.ring = 5.2;
    this.chaseSpeed = 3.8;
    this.circleSpeed = 1.2;
    this.poses = POSES;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    this.moves = {
      slam: {
        windup: 1.1, active: 0.16, recover: 1.0, track: 2.5, pose: 'slam', cd: 1.5,
        melee: { reach: 5.0, arc: 0.6, dmg: 46, poise: 70, heavy: true, height: 6, knock: 7 },
        fire: (self) => self._crystals(3.6),
      },
      backhand: {
        windup: 0.8, active: 0.25, recover: 0.8, track: 3, pose: 'backhand', parry: true, cd: 1.3,
        melee: { reach: 5.2, arc: 1.4, dmg: 34, poise: 45, height: 5, knock: 6 },
      },
      stomp: { windup: 0.6, active: 0.1, recover: 0.8, track: 0, pose: 'stomp', cd: 1.2, fire: (self) => self._quake(5.5) },
      spikes: { windup: 1.0, active: 0.1, recover: 0.9, track: 3, pose: 'slam', cd: 1.6, fire: (self, c) => self._spikeLine(c.p) },
      beam: { windup: 1.1, active: 1.5, recover: 0.8, track: 2, pose: 'beam', cd: 1.8, start: (self) => self.game.audio.playAt('crack', self.pos, 80) },
      erupt: { windup: 0.9, active: 0.1, recover: 0.8, track: 2, pose: 'raise', cd: 1.5, fire: (self, c) => self._erupt(c.p) },
      nova: { windup: 0.7, active: 0.1, recover: 0.9, track: 0, pose: 'stomp', cd: 1.3, fire: (self) => self._nova() },
    };
    this._enter();
  }

  enter() { return { x: HEART.x + 20, z: HEART.z - 22, yaw: -0.75 }; }
  arena() { return { x: HEART.x, z: HEART.z, leash: HEART.leash }; }
  _sees(c) { return Math.hypot(c.p.pos.x - HEART.x, c.p.pos.z - HEART.z) < HEART.trigger; }
  _idle() { this.yaw = this.spawn.yaw ?? 0; }

  awaken(len) {
    super.awaken(len ?? 1.8);
    this.game.audio.playAt('crack', this.pos, 100);
  }

  _wakePose(p) { Object.assign(p, POSES.roar); }
  _onWake(t, dt, c) { this.turnTo(c.toP, 2, dt); }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.2;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 6.5) opts.push(['backhand', behind ? 1 : 3], ['slam', 3]);
    if (dist < 5) opts.push(['stomp', behind ? 4 : 1]);
    if (dist < 6 && p2) opts.push(['nova', 2.5]);
    if (dist > 8 && dist < 28) opts.push(['spikes', 2], ['beam', p2 ? 2.4 : 1.6], ['erupt', 1.6]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  _crystals(ahead) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.shockwave(this, x, z, { maxR: 6, speed: 13, color: 0xd8c8ff, hit: { dmg: 20, poise: 30, knock: 5 } });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.random();
      g.effects.iceSpike(this, x + Math.sin(a) * 3.8, z + Math.cos(a) * 3.8, 0.45 + i * 0.06, { look: 'crystal', radius: 2, count: 5, hit: { dmg: 24, poise: 32, knock: 5, unblockable: true } });
    }
    g.audio.playAt('slam', this.pos, 70);
    g.cameraShake(0.3, Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 14 ? 1 : 0.4);
  }

  _quake(maxR) {
    const g = this.game;
    g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR, speed: 13, color: 0xd8c8ff, hit: { dmg: 24, poise: 45, heavy: true, knock: 6 } });
    g.audio.playAt('slam', this.pos, 70);
  }

  _spikeLine(p) {
    const g = this.game;
    const base = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const lines = this.phase === 2 ? [-0.3, 0, 0.3] : [0];
    for (const off of lines) {
      const a = base + off;
      for (let i = 0; i < 8; i++) {
        const k = 3 + i * 3;
        g.effects.iceSpike(this, this.pos.x + Math.sin(a) * k, this.pos.z + Math.cos(a) * k, 0.4 + i * 0.1, { look: 'crystal', radius: 1.8, count: 4, hit: { dmg: 28, poise: 34, knock: 5, unblockable: true } });
      }
    }
    g.audio.playAt('crack', this.pos, 70);
  }

  // Crystal erupting under you, and (in the second phase) all round you.
  _erupt(p) {
    const g = this.game;
    const hit = { dmg: 30, poise: 40, knock: 5, unblockable: true };
    g.effects.iceSpike(this, p.pos.x + p.vel.x * 0.5, p.pos.z + p.vel.z * 0.5, 1.0, { look: 'crystal', radius: 2.6, hit });
    const n = this.phase === 2 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 3;
      g.effects.iceSpike(this, p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d, 1.2 + i * 0.2, { look: 'crystal', radius: 2.2, hit });
    }
  }

  _nova() {
    const g = this.game;
    g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 9, speed: 14, color: 0xe8e0ff, hit: { dmg: 24, poise: 45, knock: 7, unblockable: true } });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.effects.iceSpike(this, this.pos.x + Math.sin(a) * 6, this.pos.z + Math.cos(a) * 6, 0.45, { look: 'crystal', radius: 1.8, count: 4, hit: { dmg: 22, poise: 30, knock: 5, unblockable: true } });
    }
    g.audio.playAt('crack', this.pos, 80);
  }

  update(dt) {
    super.update(dt);
    const g = this.game, M = this.move;
    // The beam: hard light poured from the core while the move is active (three ways in phase two).
    if (this.alive && M?.name === 'beam' && this.t >= M.windup && this.t < M.windup + M.active) {
      const p = g.player;
      this.turnTo(Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z), 0.8, dt);
      if ((this.beamT = (this.beamT ?? 0) - dt) <= 0) {
        this.beamT = 0.1;
        const y = this.pos.y + 2.4 * (this.size / SIZE) * 1.15, dist = Math.max(4, Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z));
        const fan = this.phase === 2 ? [-0.32, 0, 0.32] : [0];
        for (const off of fan) {
          const a = this.yaw + off + (Math.random() - 0.5) * 0.05;
          g.projectiles.spawn(this, {
            kind: 'crystal', x: this.pos.x + Math.sin(a) * 1.6, y, z: this.pos.z + Math.cos(a) * 1.6, dirX: Math.sin(a), dirY: (p.pos.y + 1 - y) / dist, dirZ: Math.cos(a),
            speed: 32, radius: 0.55, life: 1.0, scale: 1.5, hit: { dmg: 11, poise: 8, parryable: false },
          });
        }
      }
    }
    if (this.alive) {
      const k = this.phase === 2 ? 1.7 : 1;
      const charging = M?.name === 'beam' && this.t < M.windup + M.active;
      this.model.core.emissiveIntensity = 1.8 * k + (charging ? 2.5 : 0) + Math.sin(g.time * 2.2) * 0.3;
      this.model.glow.material.opacity = 0.4 + 0.2 * k + (charging ? 0.3 : 0);
    }
  }

  // Half health: the core flares, the body cracks with light.
  _phase(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.0;
    if (!this.phased && this.t > 0.5) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.85;
      this.chaseSpeed = 4.4;
      this._nova();
    }
    if (this.t >= 2.0) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }
}
