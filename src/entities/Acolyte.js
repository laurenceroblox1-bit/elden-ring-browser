// Lantern Acolytes: robed hollows that keep their distance and hurl lantern-fire. A bolt is telegraphed
// by the lantern swelling bright as the staff goes up; it can be blocked or rolled through, never
// parried (there's no blade to turn). Close in and the acolyte backs away, swatting with its staff
// when cornered; that swat can be parried and riposted.
// States: idle -> alert -> keep (hold range: back off, strafe, advance) <-> attack (cast or swat),
// plus the shared hurt, parried, riposted, knockdown, return and dead (entities/Foe.js).
import * as THREE from '../lib/three.js';
import { Foe } from './Foe.js';
import { buildAcolyte } from '../models/characters.js';
import { pose, copyPose, applyPose, attackPose, addGait, framePose } from '../models/pose.js';
import { clamp, damp, dampK, angleDiff, easeOut } from '../core/math.js';

const MOVES = {
  cast: { windup: 0.85, active: 0.1, recover: 0.55, track: 4, pose: 'cast' },
  swat: { windup: 0.45, active: 0.14, recover: 0.55, track: 5, pose: 'swat', dmg: 8, poise: 12, reach: 2.0, arc: 0.9, lunge: 2 },
};
const BOLT = { speed: 15, radius: 0.32, life: 2.4, dmg: 16, poise: 18, lead: 0.5 };
const RANGE = { near: 6.5, far: 15, cast: [4, 24] };

const POSES = {
  // Staff held up before it, lantern at head height.
  rest: pose({ sRx: -0.35, eR: -0.65, hRx: -0.2, sLx: -0.25, eL: -0.6, torsoX: 0.1, headX: 0.05 }),
  cast: [pose({ sRx: -2.6, eR: -0.3, hRx: 0.7, sLx: -0.8, sLz: 0.5, eL: -0.4, torsoX: -0.25, torsoY: -0.3, headX: -0.2, lRx: 0.3, lLx: -0.2 }),
    pose({ sRx: -1.45, eR: -0.15, hRx: 0.6, sLx: 0.2, sLz: 0.3, torsoX: 0.3, torsoY: 0.25, lRx: -0.45, kR: 0.3, lLx: 0.3 })],
  swat: [pose({ sRx: -2.8, eR: -0.4, hRx: 0.6, sLx: -0.4, torsoX: -0.2, torsoY: -0.25 }),
    pose({ sRx: -0.55, eR: -0.1, hRx: 1.0, torsoX: 0.35, torsoY: 0.2, sLx: 0.2, lRx: -0.4, kR: 0.3 })],
  hurt: pose({ torsoX: -0.4, headX: -0.3, sRz: -0.5, sLz: 0.5, sRx: -0.3, eR: -0.5, hipsH: -0.06 }),
  parried: pose({ sRx: -2.7, sRz: -0.5, eR: -0.3, hRx: 0.4, torsoX: -0.45, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3, lLx: -0.3 }),
  riposted: pose({ torsoX: 0.55, headX: 0.35, sRx: -0.3, sRz: -0.4, eR: -0.2, sLx: -0.4, sLz: 0.4, eL: -0.4, hipsH: -0.12, kR: 0.3, kL: 0.3, lRx: -0.2, lLx: -0.2 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.1, sLz: 1.0, lRx: -0.3 }),
};
const KNOCKDOWN = 1.9;
const KNOCKDOWN_KEYS = [[0, POSES.riposted], [0.35, POSES.dead], [KNOCKDOWN - 0.7, POSES.dead], [KNOCKDOWN, POSES.rest]];

const tmp = new THREE.Vector3();

export class Acolyte extends Foe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'acolyte';
    this.name = 'Lantern Acolyte';
    this.model = buildAcolyte();
    this.maxHp = 50;
    this.maxPoise = 14;
    this.ash = 85;
    this.radius = 0.42;
    this.height = 1.8;
    this.lockHeight = 1.3;
    this.leash = 30;
    this.returnSpeed = 2.8;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.6;
    this.poseBuf = pose();
    this.gait = 0;
    this._enter();
  }

  _onReset() {
    this.flipT = 2;
    this.swatCd = 0;
    this.move = null;
    this._glow(0);
    copyPose(this.poseBuf, POSES.rest);
    applyPose(this.model, this.poseBuf, 1);
  }

  busy() { return this.state === 'attack'; }

  _engage() {
    this._setState('keep');
    this.cooldown = Math.max(this.cooldown, 0.8 + Math.random() * 0.8);
  }

  _think(dt, c) {
    const { p, dist, toP } = c;
    const w = this.want;
    switch (this.state) {
      case 'idle': {
        const seen = dist < 22 && Math.abs(angleDiff(this.yaw, toP)) < 1.9;
        if (p.alive && (seen || dist < 9)) {
          this._setState('alert');
          this.game.audio.playAt('chant', this.pos);
        }
        break;
      }
      case 'alert':
        this.turnTo(toP, 6, dt);
        if (this.t > 0.5) this._engage();
        break;
      case 'keep': {
        this.turnTo(toP, 5, dt);
        if ((this.flipT -= dt) <= 0) { this.strafe *= -1; this.flipT = 2 + Math.random() * 2.5; }
        const side = toP + (Math.PI / 2) * this.strafe;
        // Too close: back away (it's slower than you, so it gets cornered). Too far: drift closer.
        const radial = dist < RANGE.near ? -3.0 : dist > RANGE.far ? 2.6 : 0;
        const lateral = dist < RANGE.near ? 0.8 : 1.3;
        w.x = Math.sin(side) * lateral + Math.sin(toP) * radial;
        w.z = Math.cos(side) * lateral + Math.cos(toP) * radial;
        this.cooldown -= dt;
        this.swatCd -= dt;
        if (dist < 2.6 && this.swatCd <= 0) this._startMove('swat');
        else if (this.cooldown <= 0 && dist > RANGE.cast[0] && dist < RANGE.cast[1] && p.alive) this._startMove('cast');
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
    this.game.audio.play(name === 'cast' ? 'cast' : 'swing');
  }

  _attack(dt, c) {
    const m = this.move, t = this.t;
    const tw = m.windup, ta = tw + m.active;
    if (t < tw) this.turnTo(c.toP, m.track, dt);
    const lunge = m.lunge && t > tw * 0.7 && t < ta ? m.lunge : 0;
    this.vel.x = damp(this.vel.x, this.forwardX * lunge, 12, dt);
    this.vel.z = damp(this.vel.z, this.forwardZ * lunge, 12, dt);
    if (m === MOVES.cast) {
      const u = clamp(t / tw, 0, 1) * (t < ta ? 1 : 0);
      this._glow(u);
      // Sparks drawn into the lantern: the tell to raise a guard or get ready to roll.
      if (u > 0 && Math.random() < dt * 30) {
        this.model.lantern.getWorldPosition(tmp);
        const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 0.4;
        this.game.particles.emit({ x: tmp.x + Math.sin(a) * r, y: tmp.y + (Math.random() - 0.3) * 0.5, z: tmp.z + Math.cos(a) * r, count: 1, speed: 0.2, up: 0.4, color: 0xffb050, color2: 0xfff0c0, life: [0.2, 0.4], size: [0.05, 0.1], dir: { x: -Math.sin(a) * 2, y: 0, z: -Math.cos(a) * 2 } });
      }
      if (!this.fired && t >= tw) { this.fired = true; this._fire(c.p); }
    } else if (t >= tw && t < ta) {
      this.game.combat.melee(this, { dmg: m.dmg, poise: m.poise, reach: m.reach, arc: m.arc }, this.hitSet);
    }
    if (t >= ta + m.recover) {
      this._setState('keep');
      if (m === MOVES.cast) this.cooldown = 2.2 + Math.random() * 1.0;
      else this.swatCd = 1.3 + Math.random() * 0.6;
      this.strafe = Math.random() < 0.5 ? -1 : 1;
    }
    return false;
  }

  // A ball of lantern-fire at the player's chest, led a little against a runner. It leaves from where the
  // lantern's swing comes over, above and ahead of the acolyte, so it clears the acolyte's own body.
  _fire(p) {
    const g = this.game;
    const sx = this.pos.x + this.forwardX * 0.7, sy = this.pos.y + 2.0, sz = this.pos.z + this.forwardZ * 0.7;
    const flight = Math.hypot(p.pos.x - sx, p.pos.z - sz) / BOLT.speed;
    const tx = p.pos.x + p.vel.x * flight * BOLT.lead, tz = p.pos.z + p.vel.z * flight * BOLT.lead;
    const ty = p.pos.y + 1.1;
    g.projectiles.spawn(this, {
      kind: 'bolt', x: sx, y: sy, z: sz, dirX: tx - sx, dirY: ty - sy, dirZ: tz - sz,
      speed: BOLT.speed, radius: BOLT.radius, life: BOLT.life, scale: 0.9,
      hit: { dmg: BOLT.dmg, poise: BOLT.poise, knock: 2.5, parryable: false },
      color: 0xff8a30, color2: 0xffd890, sound: 'boltHit',
    });
    g.audio.play('bolt');
  }

  // The lantern swells while a bolt gathers (0 = idle flicker, 1 = about to loose).
  _glow(u) {
    const m = this.model;
    const flick = Math.sin(this.game.time * 13 + this.spawn.x) * 0.15;
    m.flame.emissiveIntensity = 1.6 + flick + u * 4;
    m.glow.scale.setScalar(0.8 + u * 2.4 + flick * 0.3);
  }

  _animate(dt, c) {
    const p = this.poseBuf;
    let k = dampK(12, dt);
    switch (this.state) {
      case 'attack': {
        const m = this.move;
        const [wind, strike] = POSES[m.pose];
        attackPose(p, POSES.rest, wind, strike, this.t, m.windup, m.active, m.recover, easeOut);
        k = dampK(26, dt);
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
        addGait(p, this.gait, clamp(sp / 4, 0, 0.8), 0.2);
        p.torsoX += Math.sin(this.game.time * 1.3 + this.spawn.z) * 0.04;
        p.headY = Math.sin(this.game.time * 0.7 + this.spawn.x) * 0.2;
      }
    }
    if (this.state !== 'attack') this._glow(0);
    applyPose(this.model, p, k);
  }
}
