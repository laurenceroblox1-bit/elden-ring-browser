// Shared base for the Vale's ordinary foes beyond the sentries (hounds, acolytes, whatever comes next).
// It owns what every foe does the same way: spawning and resetting at its post, poise and stagger, the
// guard hooks (parried -> open -> riposted -> knocked down), leashing home, dying and respawning on rest.
// A subclass sets its stats in the constructor, then supplies:
//   _think(dt, c)    the state machine for its own states; sets this.want = { x, z } (m/s) to steer
//   _animate(dt, c)  poses the model for the current state
//   parryable        Set of its states whose blows can be parried (onParried ignores the rest)
// `c` is the per-frame context: { p (player), dx, dz, dist, toP (yaw to the player), fromHome }.
import { Actor } from './Actor.js';
import { damp, yawTo } from '../core/math.js';

// States the shared code drives (the AI doesn't steer in them).
const REELING = new Set(['hurt', 'parried', 'riposted', 'knockdown']);
// Past this distance from the camera a foe is a few fogged pixels: it isn't drawn (saving its draw calls
// and its shadow's) though it keeps thinking.
const DRAW_DIST = 150;

export class Foe extends Actor {
  constructor(game, spawn) {
    super(game);
    this.spawn = spawn;
    this.pack = spawn.pack ?? null;
    this.want = { x: 0, z: 0 };
    this.parryable = new Set(['attack']);
    this.leash = 32; // metres from its post before it gives up and goes home
    this.knockdownTime = 1.8;
    this.parriedTime = 1.5;
    this.speedMul = 1;
  }

  // Call at the end of the subclass constructor, once the model and stats exist.
  _enter() {
    this.game.scene.add(this.model.root);
    this.game.combat.register(this);
    this.reset();
  }

  reset() {
    const s = this.spawn;
    this.pos.set(s.x, this.game.world.getHeight(s.x, s.z), s.z);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.onGround = true;
    this.yaw = s.yaw ?? 0;
    this.hp = this.maxHp;
    this.poise = this.maxPoise;
    this.poiseTimer = 0;
    this.alive = true;
    this.state = 'idle';
    this.t = 0;
    this.cooldown = 0;
    this.openT = 0;
    this.flinch = 0;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.shown = true;
    this._onReset?.();
    this._sync();
  }

  // ---------- combat hooks ----------

  isOpen() {
    return this.alive && this.openT > 0 && this.state !== 'riposted' && this.state !== 'knockdown';
  }

  onParried(by) {
    if (!this.alive || !this.parryable.has(this.state)) return;
    this._setState('parried');
    this.openT = this.parriedTime + 0.3;
    const dx = this.pos.x - by.pos.x, dz = this.pos.z - by.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / d) * 2.4, 0, (dz / d) * 2.4);
  }

  onRiposte(by) {
    if (!this.isOpen()) return false;
    this._setState('riposted');
    this.openT = 0;
    this.vel.set(0, 0, 0);
    this.yaw = yawTo(this.pos.x, this.pos.z, by.pos.x, by.pos.z);
    return true;
  }

  takeHit(hit) {
    if (!this.alive) return false;
    this.hp -= hit.dmg;
    this.flinch = 0.25;
    if (this.hp <= 0) return this._die(hit);
    if (hit.riposte) {
      this._setState('knockdown');
      this.openT = 0;
      this.vel.set(hit.dirX * 3, 0, hit.dirZ * 3);
      return true;
    }
    if (REELING.has(this.state)) return true; // extra hits hurt but don't restart the reaction
    this.poise -= hit.poise ?? 10;
    this.poiseTimer = 3;
    if (this.state === 'idle' || this.state === 'return' || this.state === 'alert') this._engage();
    if (this.poise <= 0) {
      this.poise = this.maxPoise;
      this._setState('hurt');
      this.hurtDur = hit.heavy ? 0.9 : 0.5;
      const k = hit.heavy ? 5 : 3.5;
      this.vel.set(hit.dirX * k, 0, hit.dirZ * k);
    }
    return true;
  }

  _die(hit) {
    this.hp = 0;
    this.alive = false;
    this._setState('dead');
    this.openT = 0;
    this.vel.set(hit.dirX * 3, 0, hit.dirZ * 3);
    this.game.onEnemyKilled(this);
    return true;
  }

  // ---------- behaviour ----------

  _setState(s) {
    this.state = s;
    this.t = 0;
  }

  // Into the fight (subclasses pick their opening state).
  _engage() { this._setState('chase'); }

  // Waking packmates (and itself) when one of the pack spots the player.
  _alertPack() {
    if (!this.pack) return;
    for (const e of this.game.enemies) {
      if (e !== this && e.pack === this.pack && e.alive && (e.state === 'idle' || e.state === 'return')) e._setState('alert');
    }
  }

  update(dt) {
    this.t += dt;
    const p = this.game.player;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const c = {
      p, dx, dz, dist: Math.hypot(dx, dz), toP: Math.atan2(dx, dz),
      fromHome: Math.hypot(this.pos.x - this.spawn.x, this.pos.z - this.spawn.z),
    };
    if ((this.poiseTimer -= dt) <= 0) this.poise = this.maxPoise;
    if (this.openT > 0) this.openT -= dt;
    if (this.flinch > 0) this.flinch -= dt;
    this.want.x = this.want.z = 0;
    let steer = true;

    switch (this.state) {
      case 'hurt':
      case 'parried': {
        steer = false;
        this.vel.multiplyScalar(Math.exp(-6 * dt));
        const dur = this.state === 'hurt' ? this.hurtDur : this.parriedTime;
        if (this.t >= dur) { this._engage(); this.cooldown = Math.max(this.cooldown, 0.3); }
        break;
      }
      case 'riposted':
        steer = false;
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        if (this.t > 2) { this._engage(); this.cooldown = 0.3; } // the blow never came
        break;
      case 'knockdown':
        steer = false;
        this.vel.multiplyScalar(Math.exp(-4 * dt));
        if (this.t >= this.knockdownTime) { this._engage(); this.cooldown = 0.6; }
        break;
      case 'return': {
        const hy = yawTo(this.pos.x, this.pos.z, this.spawn.x, this.spawn.z);
        this.turnTo(hy, 6, dt);
        this.want.x = Math.sin(hy) * this.returnSpeed;
        this.want.z = Math.cos(hy) * this.returnSpeed;
        this.hp = Math.min(this.maxHp, this.hp + 30 * dt);
        if (c.fromHome < 1.5) { this._setState('idle'); this.yaw = this.spawn.yaw ?? this.yaw; }
        else if (c.p.alive && c.dist < 7 && c.fromHome < this.leash - 8) this._engage();
        break;
      }
      case 'dead':
        steer = false;
        this.vel.multiplyScalar(Math.exp(-5 * dt));
        if (this.t > 2.2 && this.t < 3.6 && Math.random() < 0.5) {
          this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 0.3, z: this.pos.z, count: 3, speed: 0.6, up: 1.5, color: 0x4a4540, color2: 0xb0a090, life: [0.8, 1.4], size: [0.1, 0.2], jitter: 0.6 });
        }
        if (this.t > 3.6) this.shown = false;
        break;
      default:
        // Leash: too far from its post, or nobody left to fight.
        if (this.state !== 'idle' && this.state !== 'alert' && !this.busy?.() && (!c.p.alive || c.fromHome > this.leash)) {
          this._setState('return');
          break;
        }
        steer = this._think(dt, c) !== false;
    }

    if (steer) {
      this.vel.x = damp(this.vel.x, this.want.x * this.speedMul, this.accel ?? 8, dt);
      this.vel.z = damp(this.vel.z, this.want.z * this.speedMul, this.accel ?? 8, dt);
    }
    if (this.state !== 'dead' || this.t < 3.6) this.integrate(dt);
    this._animate(dt, c);
    this._sync();
  }

  _sync() {
    const root = this.model.root, cam = this.game.camera.position;
    root.position.copy(this.pos);
    root.rotation.y = this.yaw;
    root.visible = this.shown && Math.hypot(this.pos.x - cam.x, this.pos.z - cam.z) < DRAW_DIST;
  }
}
