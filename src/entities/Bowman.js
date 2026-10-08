// Dunmarrow Bowmen: hollowed archers of the castle watch. They hold you at range (back away if you
// close in, edge nearer if you hang back), draw for a full second (the creak of the string is the
// tell), and loose an arrow that arcs a little and leads a runner. Arrows can be blocked or rolled
// through, never parried. Corner one and it swipes with the bow; that swipe can be parried.
// States: idle -> alert -> keep <-> attack (shoot or swipe), plus the shared Foe states.
import { Foe } from './Foe.js';
import { buildBowman } from '../models/characters.js';
import { pose, copyPose, applyPose, attackPose, addGait, framePose } from '../models/pose.js';
import { clamp, damp, dampK, angleDiff, easeOut } from '../core/math.js';

const MOVES = {
  shoot: { windup: 1.05, active: 0.08, recover: 0.6, track: 3.5, pose: 'shoot' },
  swipe: { windup: 0.42, active: 0.14, recover: 0.5, track: 5, pose: 'swipe', dmg: 10, poise: 14, reach: 1.9, arc: 0.9, lunge: 2.5 },
};
const ARROW = { speed: 34, gravity: 6, radius: 0.22, life: 2.2, dmg: 20, poise: 16, lead: 0.7 };
const RANGE = { near: 9, far: 22, shoot: [4, 32] };

const POSES = {
  rest: pose({ sLx: -0.35, eL: -0.4, hLx: -1.2, sRx: -0.1, eR: -0.3, torsoX: 0.08 }), // bow upright at the side
  // Side-on, bow arm out straight, string hand drawn back to the jaw.
  shoot: [pose({ torsoY: 0.75, headY: -0.7, sLx: -1.6, sLy: 0.0, eL: 0, hLx: 0, sRx: -1.6, sRy: 0.5, eR: -2.3, hRx: 0.2, lRx: -0.2, lLx: 0.25, kL: 0.15 }),
    pose({ torsoY: 0.75, headY: -0.7, sLx: -1.6, eL: 0, sRx: -1.3, sRy: 0.9, eR: -0.9, lRx: -0.2, lLx: 0.25, kL: 0.15 })],
  swipe: [pose({ sLx: -2.3, eL: -0.4, torsoY: 0.4, torsoX: -0.1, sRx: -0.4 }), pose({ sLx: -0.7, eL: -0.1, torsoY: -0.35, torsoX: 0.3, lRx: -0.4, kR: 0.3 })],
  hurt: pose({ torsoX: -0.4, headX: -0.3, sRz: -0.5, sLz: 0.5, sRx: -0.3, eR: -0.5, hipsH: -0.06 }),
  parried: pose({ sLx: -2.6, sLz: 0.5, eL: -0.3, torsoX: -0.45, headX: -0.4, sRz: -0.6, eR: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3, lLx: -0.3 }),
  riposted: pose({ torsoX: 0.55, headX: 0.35, sRx: -0.3, sRz: -0.4, eR: -0.2, sLx: -0.4, sLz: 0.4, eL: -0.4, hipsH: -0.12, kR: 0.3, kL: 0.3, lRx: -0.2, lLx: -0.2 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.1, sLz: 1.0, lRx: -0.3 }),
};
const KNOCKDOWN = 1.9;
const KNOCKDOWN_KEYS = [[0, POSES.riposted], [0.35, POSES.dead], [KNOCKDOWN - 0.7, POSES.dead], [KNOCKDOWN, POSES.rest]];

export class Bowman extends Foe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'bowman';
    this.name = 'Dunmarrow Bowman';
    this.model = buildBowman();
    this.maxHp = 70;
    this.maxPoise = 16;
    this.ash = 110;
    this.radius = 0.42;
    this.height = 1.8;
    this.lockHeight = 1.3;
    this.leash = 34;
    this.returnSpeed = 3;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.6;
    this.parryable = new Set(['attack']);
    this.poseBuf = pose();
    this.gait = 0;
    this._enter();
  }

  _onReset() {
    this.flipT = 2;
    this.swipeCd = 0;
    this.move = null;
    copyPose(this.poseBuf, POSES.rest);
    applyPose(this.model, this.poseBuf, 1);
  }

  busy() { return this.state === 'attack'; }

  // Only the bow swipe is a blade to turn; a parried shot is impossible (onParried checks the move).
  onParried(by) {
    if (this.move !== MOVES.swipe) return;
    super.onParried(by);
  }

  _engage() {
    this._setState('keep');
    this.cooldown = Math.max(this.cooldown, 0.6 + Math.random() * 0.8);
  }

  _think(dt, c) {
    const { p, dist, toP } = c;
    const w = this.want;
    switch (this.state) {
      case 'idle': {
        const seen = dist < 30 && Math.abs(angleDiff(this.yaw, toP)) < 1.8;
        if (p.alive && (seen || dist < 10)) {
          this._setState('alert');
          this.game.audio.playAt('alertHuman', this.pos);
        }
        break;
      }
      case 'alert':
        this.turnTo(toP, 6, dt);
        if (this.t > 0.4) this._engage();
        break;
      case 'keep': {
        this.turnTo(toP, 5, dt);
        if ((this.flipT -= dt) <= 0) { this.strafe *= -1; this.flipT = 1.8 + Math.random() * 2.5; }
        const side = toP + (Math.PI / 2) * this.strafe;
        const radial = dist < RANGE.near ? -3.6 : dist > RANGE.far ? 3 : 0;
        const lateral = dist < RANGE.near ? 1.0 : 1.6;
        w.x = Math.sin(side) * lateral + Math.sin(toP) * radial;
        w.z = Math.cos(side) * lateral + Math.cos(toP) * radial;
        this.cooldown -= dt;
        this.swipeCd -= dt;
        if (dist < 2.4 && this.swipeCd <= 0) this._startMove('swipe');
        else if (this.cooldown <= 0 && dist > RANGE.shoot[0] && dist < RANGE.shoot[1] && p.alive) this._startMove('shoot');
        break;
      }
      case 'attack': return this._attack(dt, c);
    }
    return true;
  }

  _startMove(name) {
    this.move = MOVES[name];
    this._setState('attack');
    this.fired = false;
    this.hitSet = new Set();
    this.game.audio.play(name === 'shoot' ? 'bowDraw' : 'swing');
  }

  _attack(dt, c) {
    const m = this.move, t = this.t;
    const tw = m.windup, ta = tw + m.active;
    if (t < tw) this.turnTo(c.toP + (m === MOVES.shoot ? -0.0 : 0), m.track, dt);
    const lunge = m.lunge && t > tw * 0.7 && t < ta ? m.lunge : 0;
    this.vel.x = damp(this.vel.x, this.forwardX * lunge, 12, dt);
    this.vel.z = damp(this.vel.z, this.forwardZ * lunge, 12, dt);
    if (m === MOVES.shoot) {
      if (!this.fired && t >= tw) { this.fired = true; this._loose(c.p); }
    } else if (t >= tw && t < ta) {
      this.game.combat.melee(this, { dmg: m.dmg, poise: m.poise, reach: m.reach, arc: m.arc }, this.hitSet);
    }
    if (t >= ta + m.recover) {
      this._setState('keep');
      if (m === MOVES.shoot) this.cooldown = 1.9 + Math.random() * 1.3;
      else this.swipeCd = 1.4 + Math.random() * 0.6;
      this.strafe = Math.random() < 0.5 ? -1 : 1;
    }
    return false;
  }

  // An arrow at the player's chest, aimed up a touch for the drop and led against a runner.
  _loose(p) {
    const g = this.game;
    const sx = this.pos.x + this.forwardX * 0.6, sy = this.pos.y + 1.5, sz = this.pos.z + this.forwardZ * 0.6;
    const d = Math.hypot(p.pos.x - sx, p.pos.z - sz);
    const flight = d / ARROW.speed;
    const tx = p.pos.x + p.vel.x * flight * ARROW.lead, tz = p.pos.z + p.vel.z * flight * ARROW.lead;
    const drop = 0.5 * ARROW.gravity * flight * flight;
    const ty = p.pos.y + 1.1 + drop;
    g.projectiles.spawn(this, {
      kind: 'arrow', x: sx, y: sy, z: sz, dirX: tx - sx, dirY: ty - sy, dirZ: tz - sz,
      speed: ARROW.speed, gravity: ARROW.gravity, radius: ARROW.radius, life: ARROW.life,
      hit: { dmg: ARROW.dmg, poise: ARROW.poise, knock: 2, parryable: false }, sound: 'hit',
    });
    g.audio.play('arrow');
  }

  _animate(dt) {
    const p = this.poseBuf;
    let k = dampK(12, dt);
    switch (this.state) {
      case 'attack': {
        const m = this.move;
        const [wind, strike] = POSES[m.pose];
        if (m === MOVES.shoot) {
          // Raise and draw over the windup, hold, then the string hand flies back on release.
          copyPose(p, this.t < m.windup ? wind : strike);
          k = dampK(this.t < m.windup ? 7 : 30, dt);
        } else {
          attackPose(p, POSES.rest, wind, strike, this.t, m.windup, m.active, m.recover, easeOut);
          k = dampK(26, dt);
        }
        break;
      }
      case 'hurt': copyPose(p, POSES.hurt); k = dampK(20, dt); break;
      case 'parried':
        copyPose(p, POSES.parried);
        p.torsoZ += Math.sin(this.t * 8) * 0.07 * Math.max(0, 1 - this.t / this.parriedTime);
        k = dampK(this.t < 0.2 ? 24 : 6, dt);
        break;
      case 'riposted': copyPose(p, POSES.riposted); k = dampK(14, dt); break;
      case 'knockdown': framePose(p, KNOCKDOWN_KEYS, this.t, easeOut); k = dampK(12, dt); break;
      case 'dead': copyPose(p, POSES.dead); k = dampK(6, dt); p.pivotH -= clamp(this.t - 2.2, 0, 1.4) * 0.5; break;
      default: {
        copyPose(p, POSES.rest);
        const sp = Math.hypot(this.vel.x, this.vel.z);
        this.gait += dt * (2 + sp * 1.5);
        addGait(p, this.gait, clamp(sp / 4, 0, 0.9), 0.3);
        p.headY = Math.sin(this.game.time * 0.6 + this.spawn.x) * 0.25;
      }
    }
    applyPose(this.model, p, k);
  }
}
