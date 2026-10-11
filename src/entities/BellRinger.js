// The Bell-Ringer: what the Hollow Bell was cast to keep asleep, and what the five great ones of the
// outer regions were, in their way, keeping in. With all five dead the Bell's mist lifts and it stands
// in the yard under the spire, waiting. The last fight: a towering bell-headed giant with a bell-hammer.
// Slams that ring out in a shockwave, wide sweeps (parryable), tolls that roll out in rings no guard
// stops, spectral bells falling from the sky, and a grab-like lunge. At half health the spire's bell
// begins to toll on its own: rings come on the beat, more bells fall, and it moves faster.
import { BigFoe } from './BigFoe.js';
import { buildBellRinger } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { BELLYARD } from '../data/biomes.js';
import { angleDiff } from '../core/math.js';

const SIZE = 2.6;
const SPECTRAL = 0x9fd0ff; // the colour that means "unblockable: roll"
const POSES = {
  rest: pose({ torsoX: 0.25, headX: -0.15, sRx: -0.3, eR: -0.7, hRx: 1.2, sLx: -0.2, eL: -0.5, kR: 0.15, kL: 0.15 }),
  slam: [pose({ sRx: -3.0, eR: -0.8, hRx: 1.0, sLx: -2.8, eL: -0.7, torsoX: -0.35, headX: -0.3, kR: 0.2, kL: 0.2 }),
    pose({ sRx: -0.9, eR: -0.1, hRx: 1.4, sLx: -0.8, eL: -0.1, torsoX: 0.65, headX: 0.1, hipsH: -0.16, kR: 0.5, kL: 0.5, lRx: -0.4, lLx: -0.3 })],
  sweep: [pose({ sRx: -1.4, sRy: -1.5, eR: -0.4, hRx: 1.3, torsoY: -0.95, torsoX: 0.2, sLx: -0.3, kR: 0.3, kL: 0.3 }),
    pose({ sRx: -1.3, sRy: 1.25, eR: -0.1, hRx: 1.3, torsoY: 0.85, torsoX: 0.3, sLx: 0.2, kR: 0.3, kL: 0.3 })],
  toll: [pose({ sRx: -3.0, eR: -0.3, hRx: 0.8, sLx: -0.4, torsoX: -0.4, headX: -0.5 }),
    pose({ sRx: -0.4, eR: -0.1, hRx: 1.6, torsoX: 0.7, hipsH: -0.2, kR: 0.5, kL: 0.5 })],
  call: [pose({ sLx: -2.9, eL: -0.1, sRx: -0.6, eR: -0.8, hRx: 1.2, torsoX: -0.3, headX: -0.5 }),
    pose({ sLx: -2.4, eL: 0, sRx: -0.6, eR: -0.8, hRx: 1.2, torsoX: 0.1 })],
  lunge: [pose({ sLx: 0.4, eL: -1.2, torsoX: 0.3, torsoY: -0.6, hipsH: -0.1, kR: 0.4 }),
    pose({ sLx: -1.6, eL: -0.1, torsoX: 0.5, torsoY: 0.4, lRx: -0.7, kR: 0.4, lLx: 0.4 })],
  roar: pose({ torsoX: -0.5, headX: -0.6, sRz: -1.0, sLz: 1.0, sRx: -0.8, sLx: -0.8, eR: -0.6, eL: -0.6, hRx: 1.2, kR: 0.3, kL: 0.3 }),
  hurt: pose({ torsoX: -0.2, headX: -0.3, sRz: -0.6, sLz: 0.6, sRx: -0.3, eR: -0.6, hRx: 1.2, hipsH: -0.06 }),
  parried: pose({ sRx: -2.8, sRz: -0.5, eR: -0.3, hRx: 1.0, torsoX: -0.4, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.7, headX: 0.4, sRx: -0.3, sRz: -0.5, eR: -0.2, hRx: 1.0, sLz: 0.5, hipsH: -0.25, kR: 0.8, kL: 0.8, lRx: -0.5, lLx: -0.5 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.1, sLz: 1.0, lRx: -0.3 }),
};
const KNOCKDOWN = 2.8;

export class BellRinger extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'bellringer';
    this.name = 'The Bell-Ringer';
    this.bossId = 'bellringer';
    this.flag = 'bellDead';
    this.music = 'bell';
    this.intro = { title: 'What the Hollow Bell Kept', open: 'bell', roar: 'roarBig', scale: 1.7, lift: 1.6, roarAt: [5.5, 2.2] };
    this.reward = { gear: 'ringers_hammer', banner: ['The Bell Is Silent', 'The Bell-Ringer'] };
    this.model = buildBellRinger();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 3200;
    this.maxPoise = 190;
    this.ash = 9000;
    this.radius = 1.3;
    this.height = 4.6;
    this.lockHeight = 3.0;
    this.accel = 5;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 2.1;
    this.ring = 5;
    this.chaseSpeed = 5;
    this.circleSpeed = 1.6;
    this.poses = POSES;
    this.trailLen = 1.6; // the blade's reach from the hand, for swing trails
    this.trailColor = 0xffd8a0;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    this.moves = {
      slam: {
        windup: 1.0, active: 0.16, recover: 0.9, track: 2.5, pose: 'slam', cd: 1.4,
        melee: { reach: 5, arc: 0.5, dmg: 48, poise: 75, heavy: true, height: 6, knock: 7 },
        fire: (self) => self._ring(4, 9, 26, false),
      },
      sweep: { windup: 0.8, active: 0.28, recover: 0.75, track: 3, pose: 'sweep', parry: true, cd: 1.2, melee: { reach: 5.6, arc: 1.5, dmg: 36, poise: 48, height: 5, knock: 5 } },
      toll: { windup: 1.2, active: 0.1, recover: 0.9, track: 1, pose: 'toll', cd: 1.6, fire: (self) => self._toll() },
      bells: { windup: 0.95, active: 0.1, recover: 0.7, track: 2, pose: 'call', cd: 1.5, fire: (self, c) => self._bells(c.p) },
      lunge: { windup: 0.7, active: 0.25, recover: 0.8, track: 4, pose: 'lunge', parry: true, lunge: 13, cd: 1.3, melee: { reach: 4.4, arc: 0.6, dmg: 34, poise: 50, height: 5, knock: 6 } },
    };
    this._enter();
  }

  enter() { return { x: BELLYARD.x - 20, z: BELLYARD.z + 22, yaw: Math.PI - 0.7 }; }
  arena() { return { x: BELLYARD.x, z: BELLYARD.z, leash: BELLYARD.leash }; }
  _sees(c) { return Math.hypot(c.p.pos.x - BELLYARD.x, c.p.pos.z - BELLYARD.z) < BELLYARD.trigger; }

  _onReset() {
    super._onReset();
    this.beat = 0;
  }

  awaken(len) {
    super.awaken(len ?? 1.8);
    this.game.audio.playAt('bell', this.pos, 120);
  }

  _wakePose(p) { Object.assign(p, POSES.roar); }
  _onWake(t, dt, c) { this.turnTo(c.toP, 2, dt); }

  update(dt) {
    super.update(dt);
    if (!this.alive) return;
    this.model.light.emissiveIntensity = (this.phase === 2 ? 3 : 2) + Math.sin(this.game.time * 3) * 0.4;
    // Phase two: the spire's bell tolls by itself, and a ring rolls out from the Ringer on each stroke.
    if (this.phase === 2 && this.game.fieldBoss === this && (this.beat -= dt) <= 0) {
      this.beat = 6.5;
      this._ring(0, 12, 14, true);
      this.game.audio.play('bell');
    }
  }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.2;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 6.5) opts.push(['sweep', behind ? 1.5 : 3], ['slam', 3]);
    if (dist < 5) opts.push(['toll', behind ? 4 : 1]);
    if (dist > 6 && dist < 14) opts.push(['lunge', 2.5]);
    if (dist > 7 && dist < 34) opts.push(['bells', p2 ? 3 : 2]);
    if (p2 && dist < 12) opts.push(['toll', 1.5]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  // A ring of sound from the hammer's strike (spectral blue goes through any guard: roll).
  _ring(ahead, maxR, dmg, unblockable) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.shockwave(this, x, z, { maxR, speed: 13, color: unblockable ? SPECTRAL : 0xffd9a0, hit: { dmg, poise: 40, knock: 5, heavy: !unblockable, unblockable } });
    g.audio.playAt('slam', this.pos, 80);
    g.cameraShake(0.3, Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 14 ? 1 : 0.4);
  }

  // Three tolls, each a ring no guard stops.
  _toll() {
    const g = this.game;
    for (let i = 0; i < 3; i++) {
      g.after(i * 0.55, () => {
        if (!this.alive) return;
        this._ring(0, 16, 22, true);
        g.audio.play('bellSmall');
      });
    }
  }

  // Spectral bells fall on and around you.
  _bells(p) {
    const g = this.game;
    const n = this.phase === 2 ? 7 : 4;
    g.effects.bellDrop(this, p.pos.x + p.vel.x * 0.6, p.pos.z + p.vel.z * 0.6, 1.3, { radius: 2.8, hit: { dmg: 34, poise: 50, heavy: true, knock: 6 } });
    for (let i = 1; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 7;
      g.effects.bellDrop(this, p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d, 1.3 + i * 0.22, { radius: 2.6, hit: { dmg: 30, poise: 45, heavy: true, knock: 6 } });
    }
  }

  _phase(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.2;
    if (!this.phased && this.t > 0.6) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.8;
      this.chaseSpeed = 6;
      this.beat = 2;
      this.game.audio.play('bell');
      this.game.audio.playAt('roarBig', this.pos, 120);
      this._ring(0, 16, 24, true);
    }
    if (this.t >= 2.4) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }
}
