// Rime Wraiths: the frozen dead of the Rimewold. They drift a hand's breadth above the snow, keep a
// middling distance and throw fans of ice shards that build frostbite (block them, or roll between).
// Rush one and it either bursts in a ring of frost (roll through the ring) or blinks away in a swirl of
// snow to start again. Frail: a few good blows end it.
// States: idle (drifting) -> alert -> keep <-> attack (shards or nova) and blink, plus the Foe states.
import { Foe } from './Foe.js';
import { buildWraith } from '../models/characters.js';
import { pose, copyPose, applyPose, attackPose, framePose } from '../models/pose.js';
import { clamp, damp, dampK, angleDiff, easeOut } from '../core/math.js';

const MOVES = {
  shards: { windup: 0.85, active: 0.1, recover: 0.6, track: 4, pose: 'shards' },
  nova: { windup: 0.65, active: 0.1, recover: 0.8, track: 2, pose: 'nova' },
};
const SHARD = { speed: 19, radius: 0.3, life: 2.2, dmg: 11, poise: 8, frost: 22, fan: 0.2, count: 3 };
const NOVA = { maxR: 6.5, speed: 11, dmg: 14, poise: 18, frost: 34 };
const BLINK = { out: 0.35, back: 0.35, cd: 5, dist: [7, 11] };
const HOVER = 0.45;

const POSES = {
  rest: pose({ sRx: -0.5, eR: -0.7, sLx: -0.5, eL: -0.7, torsoX: 0.25, headX: 0.15, lRx: -0.3, kR: 0.5, lLx: -0.2, kL: 0.6 }),
  shards: [pose({ sRx: -2.8, eR: -0.3, sLx: -2.8, eL: -0.3, torsoX: -0.3, headX: -0.25, sRz: -0.3, sLz: 0.3 }),
    pose({ sRx: -1.5, eR: 0, sLx: -1.5, eL: 0, torsoX: 0.35, headX: 0.1, sRz: 0.15, sLz: -0.15 })],
  nova: [pose({ sRx: -0.4, sRz: -1.3, eR: -0.2, sLx: -0.4, sLz: 1.3, eL: -0.2, torsoX: -0.35, headX: -0.4 }),
    pose({ sRx: -0.2, sRz: -1.5, eR: 0, sLx: -0.2, sLz: 1.5, eL: 0, torsoX: 0.2, headX: 0.2 })],
  hurt: pose({ torsoX: -0.45, headX: -0.35, sRz: -0.6, sLz: 0.6, sRx: -0.3, eR: -0.5 }),
  parried: pose({ torsoX: -0.5, headX: -0.4, sRx: -2.4, sLx: -2.4, eR: -0.3, eL: -0.3 }),
  riposted: pose({ torsoX: 0.6, headX: 0.4, sRx: -0.2, sLx: -0.2, sRz: -0.4, sLz: 0.4 }),
  dead: pose({ pivotX: -1.3, pivotH: -0.7, sRz: -1.1, sLz: 1.0 }),
};
const KNOCKDOWN = 1.7;
const KNOCKDOWN_KEYS = [[0, POSES.riposted], [0.35, POSES.dead], [KNOCKDOWN - 0.6, POSES.dead], [KNOCKDOWN, POSES.rest]];

export class Wraith extends Foe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'wraith';
    this.name = 'Rime Wraith';
    this.model = buildWraith();
    this.maxHp = 66;
    this.maxPoise = 18;
    this.ash = 130;
    this.radius = 0.45;
    this.height = 2.0;
    this.lockHeight = 1.5;
    this.leash = 32;
    this.returnSpeed = 3.5;
    this.accel = 5;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.4;
    this.parryable = new Set(); // claws of ice and bursts of frost: nothing to turn aside
    this.frostResist = 0; // the cold is what it is made of
    this.poseBuf = pose();
    // What it throws and bursts with, and its colours (the Glowcap Stalker swaps these for spores).
    this.shard = SHARD;
    this.nova = NOVA;
    this.look = { kind: 'shard', c1: 0xcfefff, c2: 0x7cc8ff, sound: 'frostbite', swirl: [0xe8f6ff, 0x9fd8ff] };
    if (new.target === Wraith) this._enter();
  }

  _onReset() {
    this.flipT = 2;
    this.blinkCd = 2;
    this.move = null;
    this.blinkTo = null;
    this.invuln = false;
    copyPose(this.poseBuf, POSES.rest);
    applyPose(this.model, this.poseBuf, 1);
  }

  busy() { return this.state === 'attack' || this.state === 'blink'; }

  _engage() {
    this._setState('keep');
    this.cooldown = Math.max(this.cooldown, 0.8 + Math.random() * 0.7);
  }

  _think(dt, c) {
    const { p, dist, toP } = c;
    const w = this.want;
    this.blinkCd -= dt;
    switch (this.state) {
      case 'idle': {
        // Drift in a slow circle around its post.
        const a = this.game.time * 0.25 + this.spawn.x;
        w.x = Math.cos(a) * 0.6;
        w.z = -Math.sin(a) * 0.6;
        this.turnTo(Math.atan2(w.x, w.z), 1.5, dt);
        const seen = dist < 24 && Math.abs(angleDiff(this.yaw, toP)) < 2.2;
        if (p.alive && (seen || dist < 10)) {
          this._setState('alert');
          this.game.audio.playAt('wraithAlert', this.pos);
        }
        break;
      }
      case 'alert':
        this.turnTo(toP, 5, dt);
        if (this.t > 0.6) this._engage();
        break;
      case 'keep': {
        this.turnTo(toP, 4, dt);
        if ((this.flipT -= dt) <= 0) { this.strafe *= -1; this.flipT = 2 + Math.random() * 2; }
        const side = toP + (Math.PI / 2) * this.strafe;
        const radial = dist < 6 ? -2.2 : dist > 13 ? 2.4 : 0;
        w.x = Math.sin(side) * 1.6 + Math.sin(toP) * radial;
        w.z = Math.cos(side) * 1.6 + Math.cos(toP) * radial;
        this.cooldown -= dt;
        if (dist < 3.6 && p.alive) {
          if (this.blinkCd <= 0 && Math.random() < 0.5) this._startBlink(c);
          else if (this.cooldown <= 0.4) this._startMove('nova');
        } else if (this.cooldown <= 0 && dist < 22 && p.alive) this._startMove('shards');
        break;
      }
      case 'attack': return this._attack(dt, c);
      case 'blink': return this._blink(dt);
    }
    return true;
  }

  _startMove(name) {
    this.move = MOVES[name];
    this.moveName = name; // (multiplayer: other players replay the move by name)
    this._setState('attack');
    this.fired = false;
    this.game.audio.play(name === 'nova' ? 'cast' : 'cast');
  }

  _attack(dt, c) {
    const g = this.game, m = this.move, t = this.t;
    const tw = m.windup, ta = tw + m.active;
    if (t < tw) this.turnTo(c.toP, m.track, dt);
    this.vel.x = damp(this.vel.x, 0, 6, dt);
    this.vel.z = damp(this.vel.z, 0, 6, dt);
    // Frost gathering in its hands: the tell.
    if (t < tw && Math.random() < dt * 25) {
      const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 0.5;
      g.particles.emit({ x: this.pos.x + Math.sin(a) * r, y: this.pos.y + HOVER + 1.5 + (Math.random() - 0.5) * 0.6, z: this.pos.z + Math.cos(a) * r, count: 1, speed: 0.2, up: 0.2, color: this.look.c1, color2: 0xffffff, life: [0.2, 0.45], size: [0.05, 0.1], dir: { x: -Math.sin(a) * 2, y: 0, z: -Math.cos(a) * 2 } });
    }
    if (!this.fired && t >= tw) {
      this.fired = true;
      if (m === MOVES.shards) this._shards(c.p);
      else {
        const N = this.nova;
        g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: N.maxR, speed: N.speed, color: this.look.c1, hit: { dmg: N.dmg, poise: N.poise, frost: N.frost, poison: N.poison, knock: 3 } });
        if (N.cloud) g.effects.hazard(this, this.pos.x, this.pos.z, { radius: N.cloud, life: 5, look: 'spore', hit: { dmg: 2, poise: 0, poison: 14, unblockable: true } });
        g.audio.play(this.look.sound);
        g.particles.emit({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z, count: 30, speed: 5, up: 1, color: this.look.c1, color2: this.look.c2, life: [0.3, 0.7], size: [0.08, 0.18], drag: 2 });
      }
    }
    if (t >= ta + m.recover) {
      this._setState('keep');
      this.cooldown = m === MOVES.shards ? 2.0 + Math.random() * 1.2 : 2.4;
      this.strafe = Math.random() < 0.5 ? -1 : 1;
    }
    return false;
  }

  _shards(p) {
    const g = this.game, S = this.shard;
    const sx = this.pos.x + this.forwardX * 0.6, sy = this.pos.y + HOVER + 1.5, sz = this.pos.z + this.forwardZ * 0.6;
    const flight = Math.hypot(p.pos.x - sx, p.pos.z - sz) / S.speed;
    const tx = p.pos.x + p.vel.x * flight * 0.5, tz = p.pos.z + p.vel.z * flight * 0.5;
    const aim = Math.atan2(tx - sx, tz - sz), d = Math.hypot(tx - sx, tz - sz);
    const dy = (p.pos.y + 1.1 - sy) / Math.max(d, 1);
    for (let i = 0; i < S.count; i++) {
      const a = aim + (i - (S.count - 1) / 2) * S.fan;
      g.projectiles.spawn(this, {
        kind: this.look.kind, x: sx, y: sy, z: sz, dirX: Math.sin(a), dirY: dy, dirZ: Math.cos(a),
        speed: S.speed, radius: S.radius, life: S.life,
        hit: { dmg: S.dmg, poise: S.poise, frost: S.frost, poison: S.poison, parryable: false }, sound: this.look.kind === 'shard' ? 'shard' : 'spore', color: this.look.c1, color2: this.look.c2,
      });
    }
    g.audio.play(this.look.kind === 'shard' ? 'shard' : 'spore');
  }

  // Vanish in a swirl of snow and reappear a few strides away, out of reach.
  _startBlink(c) {
    const w = this.game.world;
    let best = null;
    for (let k = 0; k < 6; k++) {
      const a = c.toP + Math.PI + (Math.random() - 0.5) * 2.4;
      const d = BLINK.dist[0] + Math.random() * (BLINK.dist[1] - BLINK.dist[0]);
      const x = this.pos.x + Math.sin(a) * d, z = this.pos.z + Math.cos(a) * d;
      if (!w.inPlay(x, z, 4) || w.slopeAt(x, z) > 0.7 || Math.hypot(x - this.spawn.x, z - this.spawn.z) > this.leash - 4) continue;
      best = { x, z };
      break;
    }
    if (!best) return;
    this.blinkTo = best;
    this.blinkCd = BLINK.cd;
    this._setState('blink');
    this.invuln = true;
    this.game.audio.play('blink');
    this._swirl();
  }

  _blink(dt) {
    this.vel.set(0, 0, 0);
    if (this.blinkTo && this.t >= BLINK.out) {
      this.pos.x = this.blinkTo.x;
      this.pos.z = this.blinkTo.z;
      this.pos.y = this.game.world.getHeight(this.pos.x, this.pos.z);
      this.blinkTo = null;
      this._swirl();
    }
    if (this.t >= BLINK.out + BLINK.back) {
      this.invuln = false;
      this._engage();
      this.cooldown = 0.5;
    }
    return false;
  }

  _swirl() {
    this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 1.2, z: this.pos.z, count: 36, speed: 3, up: 1.5, color: this.look.swirl[0], color2: this.look.swirl[1], life: [0.4, 0.9], size: [0.08, 0.2], drag: 2, jitter: 0.6 });
  }

  _die(hit) {
    this.invuln = false;
    const r = super._die(hit);
    this._swirl();
    return r;
  }

  _animate(dt) {
    const p = this.poseBuf;
    let k = dampK(10, dt);
    switch (this.state) {
      case 'attack': {
        const m = this.move;
        const [wind, strike] = POSES[m.pose];
        attackPose(p, POSES.rest, wind, strike, this.t, m.windup, m.active, m.recover, easeOut);
        k = dampK(20, dt);
        break;
      }
      case 'hurt': copyPose(p, POSES.hurt); k = dampK(20, dt); break;
      case 'parried': copyPose(p, POSES.parried); break;
      case 'riposted': copyPose(p, POSES.riposted); k = dampK(14, dt); break;
      case 'knockdown': framePose(p, KNOCKDOWN_KEYS, this.t, easeOut); k = dampK(12, dt); break;
      case 'dead': copyPose(p, POSES.dead); k = dampK(6, dt); break;
      default: {
        copyPose(p, POSES.rest);
        const tt = this.game.time + this.spawn.x;
        p.torsoX += Math.sin(tt * 1.4) * 0.06;
        p.sRx += Math.sin(tt * 1.1) * 0.15;
        p.sLx += Math.sin(tt * 1.1 + 1.5) * 0.15;
        // Lean into the drift.
        const sp = Math.hypot(this.vel.x, this.vel.z);
        p.torsoX += clamp(sp / 4, 0, 0.4);
      }
    }
    applyPose(this.model, p, k);
    // The hover, and fading out mid-blink.
    const root = this.model.root;
    const bob = Math.sin(this.game.time * 2 + this.spawn.z) * 0.12;
    root.position.y = this.pos.y + (this.alive ? HOVER + bob : 0);
    const out = this.state === 'blink' && this.t < BLINK.out + BLINK.back;
    root.scale.setScalar(out ? Math.max(0.05, Math.abs(this.t - BLINK.out) / BLINK.out) : 1);
  }

  _sync() {
    super._sync();
    const root = this.model.root;
    root.position.y = this.pos.y + (this.alive ? HOVER + Math.sin(this.game.time * 2 + this.spawn.z) * 0.12 : 0);
  }
}
