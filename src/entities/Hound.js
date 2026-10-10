// Mire Hounds: starved ash-hounds that hunt the lake fogs and the moor in packs of two or three.
// They circle at a few strides (stalk), then one at a time a hound darts in with a lunging bite and
// hops back out. Fast but frail: one hit in three staggers them, and a parried bite leaves the hound
// reeling and open to a riposte.
// States: idle (prowling) -> alert -> stalk <-> chase, lunge (crouch, leap + bite, land) -> hop -> stalk,
// plus the shared hurt, parried, riposted, knockdown, return and dead (entities/Foe.js).
import { Foe } from './Foe.js';
import { buildHound } from '../models/beasts.js';
import { clamp, damp, dampK, angleDiff } from '../core/math.js';

const LUNGE = { windup: 0.5, leap: 0.34, recover: 0.4, dmg: 12, poise: 16, reach: 1.25, arc: 0.8, height: 1.6 };
const HOP_TIME = 0.36;
// Packmates take turns: after one lunges, the rest hold off for this long.
const PACK_GAP = 0.8;
const packBusy = new Map();

export class Hound extends Foe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'hound';
    this.name = 'Mire Hound';
    this.model = buildHound();
    this.maxHp = 46;
    this.maxPoise = 20;
    this.ash = 45;
    this.radius = 0.5;
    this.height = 1.0;
    this.lockHeight = 0.62;
    this.leash = 30;
    this.returnSpeed = 5;
    this.accel = 7;
    this.parryable = new Set(['lunge']);
    this.parriedTime = 1.5;
    this.knockdownTime = 1.7;
    this.gait = Math.random() * 6;
    this.anim = { y: 0, x: 0, z: 0, neck: 0, head: 0, jaw: 0, tailX: 0, tailY: 0 };
    this._enter();
  }

  _onReset() {
    this.ring = 4.2 + Math.random() * 1.6; // its own stalking distance, so a pack doesn't stack up
    this.flipT = 2 + Math.random() * 2;
    this.wander = { x: this.spawn.x, z: this.spawn.z, t: 0 };
    this.hitSet = null;
  }

  // Mid-lunge or mid-hop it finishes the move before the leash can pull it home.
  busy() { return this.state === 'lunge' || this.state === 'hop'; }

  _engage() {
    this._setState('stalk');
    this.cooldown = Math.max(this.cooldown, 0.6 + Math.random() * 0.8);
  }

  _think(dt, c) {
    const { p, dist, toP } = c;
    const w = this.want;
    switch (this.state) {
      case 'idle': {
        // Prowl: amble between spots near its post, nose to the ground.
        const wd = this.wander;
        if ((wd.t -= dt) <= 0) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 3.5;
          wd.x = this.spawn.x + Math.sin(a) * r;
          wd.z = this.spawn.z + Math.cos(a) * r;
          wd.t = 3 + Math.random() * 3;
        }
        const hx = wd.x - this.pos.x, hz = wd.z - this.pos.z, hd = Math.hypot(hx, hz);
        if (hd > 0.6) {
          this.turnTo(Math.atan2(hx, hz), 2.5, dt);
          w.x = this.forwardX * 1.1;
          w.z = this.forwardZ * 1.1;
        }
        const seen = dist < 18 && Math.abs(angleDiff(this.yaw, toP)) < 2.0;
        if (p.alive && (seen || dist < 8)) {
          this._setState('alert');
          this.game.audio.playAt('snarl', this.pos);
          this._alertPack();
        }
        break;
      }
      case 'alert':
        this.turnTo(toP, 7, dt);
        if (this.t > 0.45) this._engage();
        break;
      case 'chase':
        this.turnTo(toP, 6, dt);
        w.x = Math.sin(toP) * 7;
        w.z = Math.cos(toP) * 7;
        if (dist < 7.5) this._engage();
        break;
      case 'stalk': {
        if (dist > 11) { this._setState('chase'); break; }
        this.turnTo(toP, 7, dt);
        if ((this.flipT -= dt) <= 0) { this.strafe *= -1; this.flipT = 1.8 + Math.random() * 2.4; }
        const side = toP + (Math.PI / 2) * this.strafe;
        // Ready to strike: close to springing distance; otherwise hold its own ring.
        const ring = this.cooldown <= 0 ? 3.6 : this.ring;
        const radial = clamp((dist - ring) * 1.6, -3.2, 4);
        w.x = Math.sin(side) * 3.1 + Math.sin(toP) * radial;
        w.z = Math.cos(side) * 3.1 + Math.cos(toP) * radial;
        this._spread(w);
        if ((this.cooldown -= dt) <= 0 && dist < 5 && p.alive && this._takeTurn()) this._startLunge();
        break;
      }
      case 'lunge': return this._lunge(dt, c);
      case 'hop':
        if (this.t >= HOP_TIME && this.onGround) {
          this._setState('stalk');
          this.cooldown = 0.8 + Math.random() * 1.1;
        }
        return false;
    }
    return true;
  }

  // Packmates keep a little apart while they circle.
  _spread(w) {
    for (const e of this.game.enemies) {
      if (e === this || !e.alive || e.pack !== this.pack) continue;
      const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 2.6) {
        w.x += (dx / d) * (2.6 - d) * 2;
        w.z += (dz / d) * (2.6 - d) * 2;
      }
    }
  }

  _takeTurn() {
    const key = this.pack ?? this;
    const now = this.game.time;
    if ((packBusy.get(key) ?? -1) > now) return false;
    packBusy.set(key, now + LUNGE.windup + LUNGE.leap + PACK_GAP);
    return true;
  }

  _startLunge() {
    this._setState('lunge');
    this.leapt = false;
    this.hitSet = new Set();
  }

  _lunge(dt, c) {
    const L = LUNGE, t = this.t;
    if (t < L.windup) {
      // Crouch and coil, still tracking; a little creep backwards sells the spring.
      this.turnTo(c.toP, 6, dt);
      this.vel.x = damp(this.vel.x, -this.forwardX * 0.6, 10, dt);
      this.vel.z = damp(this.vel.z, -this.forwardZ * 0.6, 10, dt);
    } else if (t < L.windup + L.leap) {
      if (!this.leapt) {
        this.leapt = true;
        // Aim to land just in front of the player; never a standing snap, never a mile.
        const sp = clamp((c.dist - 0.7) / L.leap, 5, 13);
        this.vel.set(this.forwardX * sp, 0, this.forwardZ * sp);
        this.vy = 3.4;
        this.onGround = false;
        this.game.audio.play('swing');
      }
      this.turnTo(c.toP, 1.5, dt);
      if (t > L.windup + 0.05) {
        const hit = { dmg: L.dmg * (this.dmgMul ?? 1), poise: L.poise, reach: L.reach * (this.size ?? 1), arc: L.arc, height: L.height, knock: 2.5, frost: this.biteFrost, burn: this.biteBurn, poison: this.bitePoison };
        this.game.combat.melee(this, hit, this.hitSet);
      }
    } else {
      this.vel.multiplyScalar(Math.exp(-7 * dt));
      if (t >= L.windup + L.leap + L.recover) {
        // Spring back out of reach.
        this._setState('hop');
        this.vel.set(-this.forwardX * 5.5, 0, -this.forwardZ * 5.5);
        this.vy = 2.6;
        this.onGround = false;
      }
    }
    return false;
  }

  // ---------- animation ----------

  // Target pose for the current state: fills T (body offsets and joint angles), and o.legs / o.k (the
  // leg mode and how fast the pose is reached). Subclasses add their own states and fall back here.
  _pose(T, o, dt) {
    const t = this.t;
    let legs = o.legs, k = o.k;
    switch (this.state) {
      case 'idle':
        T.neck = 0.45; T.head = 0.15 + Math.sin(this.game.time * 5) * 0.06; T.tailX = 0.35;
        break;
      case 'alert':
        T.neck = -0.25; T.head = -0.1; T.jaw = 0.25; T.tailX = -0.4;
        break;
      case 'stalk':
      case 'chase':
        T.y = this.state === 'stalk' ? -0.08 : 0; T.neck = 0.25; T.head = -0.2; T.jaw = 0.18; T.tailX = 0.1;
        break;
      case 'lunge': {
        const L = LUNGE;
        if (t < L.windup) {
          const u = t / L.windup;
          T.y = -0.2 * u; T.x = 0.14 * u; T.neck = 0.35; T.head = -0.35; T.jaw = 0.35 * u; T.tailX = -0.2;
          legs = 'coil';
          k = dampK(16, dt);
        } else if (t < L.windup + L.leap) {
          T.x = -0.18; T.neck = -0.05; T.head = -0.25; T.jaw = 0.8; T.tailX = -0.5;
          legs = 'stretch';
          k = dampK(28, dt);
        } else {
          T.neck = 0.2; T.head = 0; T.jaw = 0.1;
        }
        break;
      }
      case 'hop':
        T.x = -0.12; T.neck = 0.1; T.jaw = 0.2; legs = 'tuck'; k = dampK(20, dt);
        break;
      case 'hurt':
        T.z = 0.18; T.neck = -0.3; T.head = 0.3; T.jaw = 0.4; k = dampK(20, dt);
        break;
      case 'parried':
        // Snout knocked skyward, staggering on its hind legs.
        T.x = -0.32; T.neck = -0.7; T.head = 0.25; T.jaw = 0.6; T.z = Math.sin(t * 9) * 0.12 * Math.max(0, 1 - t / this.parriedTime);
        legs = 'splay';
        k = dampK(t < 0.2 ? 24 : 8, dt);
        break;
      case 'riposted':
        T.y = -0.15; T.neck = 0.5; T.head = 0.3; T.jaw = 0.5; legs = 'splay';
        break;
      case 'knockdown': {
        const down = t < this.knockdownTime - 0.5;
        T.z = down ? 1.4 : 0; T.y = down ? -0.42 : 0; T.neck = 0.3; T.jaw = 0.4;
        legs = down ? 'limp' : 'gait';
        k = dampK(down ? 10 : 8, dt);
        break;
      }
      case 'dead':
        T.z = 1.45; T.y = -0.47 - clamp(t - 2.2, 0, 1.4) * 0.25; T.neck = 0.4; T.head = 0.2; T.jaw = 0.45; T.tailX = 0.5;
        legs = 'limp';
        k = dampK(8, dt);
        break;
      case 'return':
        T.neck = 0.2; T.tailX = 0.4;
        break;
    }
    o.legs = legs;
    o.k = k;
  }

  _animate(dt) {
    const m = this.model, a = this.anim;
    // Speeds are judged at the hound's own size (a scaled-up hound strides slower).
    const sp = Math.hypot(this.vel.x, this.vel.z) / (this.size ?? 1);
    const T = { y: 0, x: 0, z: 0, neck: 0, head: 0, jaw: 0.05, tailX: 0, tailY: Math.sin(this.game.time * 2 + this.spawn.x) * 0.15 };
    const o = { legs: 'gait', k: dampK(12, dt) };
    this._pose(T, o, dt);
    const legs = o.legs, k = o.k;
    if (this.flinch > 0 && this.alive) { T.z += this.flinch * 0.8; T.neck -= this.flinch; }

    for (const key in T) a[key] += (T[key] - a[key]) * k;
    const ground = this.onGround ? 1 : 0;
    m.body.position.y = 0.7 + a.y + ground * Math.abs(Math.sin(this.gait)) * clamp(sp / 7, 0, 1) * 0.05;
    m.body.rotation.x = a.x + (this.onGround ? 0 : clamp(-this.vy * 0.05, -0.3, 0.3));
    m.body.rotation.z = a.z;
    m.neck.rotation.x = -0.55 + a.neck;
    m.head.rotation.x = 0.55 + a.head;
    m.jaw.rotation.x = a.jaw * 0.6;
    m.tail.rotation.x = -0.6 + a.tailX - clamp(sp / 8, 0, 1) * 0.4;
    m.tail.rotation.y = a.tailY;

    // Legs: a trot (diagonal pairs) at a walk, a bounding gallop (front pair, then back pair) at speed.
    const gallop = sp > 4.6;
    this.gait += dt * (gallop ? 9 + sp * 0.5 : 2.5 + sp * 2.2);
    const amp = clamp(sp / 5, 0, 1);
    const lk = dampK(legs === 'gait' ? 18 : 22, dt);
    for (const leg of m.legs) {
      let hip, knee;
      const rest = leg.front ? [0, 0] : [0.3, -0.45];
      if (legs === 'coil') { hip = leg.front ? -0.2 : 0.75; knee = leg.front ? 0.7 : -1.1; }
      else if (legs === 'stretch') { hip = leg.front ? -1.1 : 1.0; knee = leg.front ? 0.25 : -0.15; }
      else if (legs === 'tuck') { hip = leg.front ? -0.5 : 0.6; knee = leg.front ? 1.0 : -1.0; }
      else if (legs === 'splay') { hip = leg.front ? -0.5 : 0.1; knee = leg.front ? 0.2 : -0.6; }
      else if (legs === 'limp') { hip = leg.front ? -0.3 : 0.5; knee = leg.front ? 0.4 : -0.3; }
      else if (legs === 'fold') { hip = leg.front ? -1.35 : -0.55; knee = leg.front ? 0.15 : -1.7; } // lying down
      else if (legs === 'rear') { hip = leg.front ? -0.9 : 0.55; knee = leg.front ? 1.2 : -0.9; } // up on the hind legs
      else {
        const phase = gallop ? (leg.front ? 0 : Math.PI) + (leg.side > 0 ? 0 : 0.35) : (leg.front === leg.side > 0 ? 0 : Math.PI);
        const s = Math.sin(this.gait + phase);
        hip = rest[0] + s * (gallop ? 0.8 : 0.5) * amp;
        const bend = Math.max(0, Math.sin(this.gait + phase + 1.3)) * (gallop ? 1.0 : 0.75) * amp;
        knee = rest[1] + (leg.front ? bend : -bend * 0.8);
      }
      leg.hip.rotation.x += (hip - leg.hip.rotation.x) * lk;
      leg.knee.rotation.x += (knee - leg.knee.rotation.x) * lk;
    }
  }
}
