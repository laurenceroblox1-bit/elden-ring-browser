// Base for anything that moves, can be hit and stands on the terrain.
import * as THREE from '../lib/three.js';
import { turnToward } from '../core/math.js';

const GRAVITY = 26;

export class Actor {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.vy = 0;
    this.onGround = true;
    this.radius = 0.45;
    this.height = 1.8;
    this.maxHp = this.hp = 100;
    this.alive = true;
    this.team = 'enemy';
    this.invuln = false;
    this.lockable = true;
    this.lockHeight = 1.3;
    this.openT = 0; // seconds left in which a riposte can land (after a parry or a guard break)
    this.frost = 0; // frostbite buildup, 0..100
    this.frostT = 0; // seconds before the buildup starts to thaw
    this.frostbite = 0; // seconds left frostbitten (slowed)
    this.clearBurnPoison();
  }

  clearBurnPoison() {
    this.burn = this.burnT = this.burning = 0; // buildup, pause before it cools, seconds left on fire
    this.poison = this.poisonT = this.poisoned = 0; // buildup, pause before it clears, seconds left poisoned
    this.dotAcc = 0;
  }

  // ---------- frostbite ----------
  // Frost hits (hit.frost) build toward 100; at 100 the cold bites: a burst of damage (a share of max
  // health, less for bosses) and six seconds of slowness. The buildup thaws after a short pause.
  addFrost(n) {
    if (!this.alive || this.frostbite > 0 || n <= 0) return;
    this.frost = Math.min(100, this.frost + n * (this.frostResist ?? 1));
    this.frostT = 2.5;
    if (this.frost < 100) return;
    this.frost = 0;
    this.frostbite = 6;
    const g = this.game;
    g.particles.emit({ x: this.pos.x, y: this.pos.y + this.height * 0.6, z: this.pos.z, count: 34, speed: 4.5, up: 2, color: 0xcfefff, color2: 0x7cc8ff, life: [0.4, 0.9], size: [0.08, 0.2], drag: 2, jitter: this.radius });
    g.audio.play('frostbite');
    g.events.emit('frostbite', this);
    const dmg = this.maxHp * (this.isBoss ? 0.05 : 0.12) + 18;
    this.takeHit({ dmg, poise: 0, dirX: 0, dirZ: 0, unblockable: true, frostbite: true });
  }

  // ---------- burning and poison ----------
  // Fire hits (hit.burn) build toward 100; at 100 you catch light: a burst of damage, then five seconds
  // of burning. Poison (hit.poison) builds the same way but has no burst: fourteen seconds of sickness
  // that eats at you. Damage over time lands in small unguardable ticks.
  addBurn(n) {
    if (!this.alive || this.burning > 0 || n <= 0) return;
    this.burn = Math.min(100, this.burn + n * (this.burnResist ?? 1));
    this.burnT = 2.5;
    if (this.burn < 100) return;
    this.burn = 0;
    this.burning = 5;
    const g = this.game;
    g.particles.emit({ x: this.pos.x, y: this.pos.y + this.height * 0.5, z: this.pos.z, count: 36, speed: 4, up: 3, color: 0xff6a1a, color2: 0xffd060, life: [0.4, 0.9], size: [0.1, 0.22], drag: 2, jitter: this.radius });
    g.audio.play('ignite');
    g.events.emit('ignite', this);
    this.takeHit({ dmg: this.maxHp * (this.isBoss ? 0.03 : 0.07) + 12, poise: 0, dirX: 0, dirZ: 0, unblockable: true, status: 'burn' });
  }

  addPoison(n) {
    if (!this.alive || this.poisoned > 0 || n <= 0) return;
    this.poison = Math.min(100, this.poison + n * (this.poisonResist ?? 1));
    this.poisonT = 3;
    if (this.poison < 100) return;
    this.poison = 0;
    this.poisoned = 14;
    const g = this.game;
    g.particles.emit({ x: this.pos.x, y: this.pos.y + this.height * 0.6, z: this.pos.z, count: 30, speed: 2.5, up: 1, color: 0x8acb3a, color2: 0xc070e0, life: [0.6, 1.2], size: [0.08, 0.18], drag: 2, jitter: this.radius });
    g.audio.play('poison');
    g.events.emit('poisoned', this);
  }

  // Remedies (the Mosswort item, a shrine's rest) clear both.
  cure() {
    this.burn = this.burning = this.poison = this.poisoned = 0;
  }

  _tickBurnPoison(dt) {
    let dps = 0;
    const ps = this.game.particles;
    if (this.burning > 0) {
      this.burning -= dt;
      dps += this.maxHp * (this.isBoss ? 0.004 : 0.016) + 3;
      if (Math.random() < dt * 14) ps.emit({ x: this.pos.x, y: this.pos.y + this.height * Math.random() * 0.8, z: this.pos.z, count: 1, speed: 0.5, up: 2.5, color: 0xff6a1a, color2: 0xffc040, life: [0.3, 0.6], size: [0.1, 0.2], jitter: this.radius });
    }
    if (this.poisoned > 0) {
      this.poisoned -= dt;
      dps += this.maxHp * (this.isBoss ? 0.002 : 0.008) + 2;
      if (Math.random() < dt * 5) ps.emit({ x: this.pos.x, y: this.pos.y + this.height * (0.4 + Math.random() * 0.5), z: this.pos.z, count: 1, speed: 0.3, up: 0.6, color: 0x8acb3a, color2: 0xa060d0, life: [0.8, 1.4], size: [0.06, 0.12], jitter: this.radius });
    }
    if ((this.burnT -= dt) <= 0 && this.burn > 0) this.burn = Math.max(0, this.burn - 20 * dt);
    if ((this.poisonT -= dt) <= 0 && this.poison > 0) this.poison = Math.max(0, this.poison - 8 * dt);
    if (dps <= 0 || !this.alive) return;
    this.dotAcc += dps * dt;
    if (this.dotAcc >= 3) {
      const dmg = this.dotAcc;
      this.dotAcc = 0;
      this.takeHit({ dmg, poise: 0, dirX: 0, dirZ: 0, unblockable: true, status: 'dot' });
    }
  }

  // Ticks every status: frost, fire and poison.
  tickFrost(dt) {
    this._tickBurnPoison(dt);
    if (this.frostbite > 0) {
      this.frostbite -= dt;
      if (Math.random() < dt * 5) this.game.particles.emit({ x: this.pos.x, y: this.pos.y + this.height * (0.3 + Math.random() * 0.6), z: this.pos.z, count: 1, speed: 0.3, up: -0.3, color: 0xdff4ff, life: [0.6, 1], size: [0.05, 0.1], jitter: this.radius });
    }
    if ((this.frostT -= dt) <= 0 && this.frost > 0) this.frost = Math.max(0, this.frost - 16 * dt);
  }

  // Movement multiplier while frostbitten.
  get frostSlow() { return this.frostbite > 0 ? 0.65 : 1; }

  // Combat hooks. Enemies override these; the defaults make any actor safe to parry or riposte-check.
  // isOpen(): true while a riposte can start on this actor.
  isOpen() { return false; }
  // onParried(by, hit): this actor's parryable swing was parried.
  onParried() {}
  // onRiposte(by): a riposte has started on this actor; hold still until the blow lands. Return false to refuse.
  onRiposte() { return false; }
  // canBackstab(): true while a critical blow from behind can start on this actor (unaware or busy
  // elsewhere, not mid-swing); onBackstab(by) starts it, like onRiposte.
  canBackstab() { return false; }
  onBackstab() { return false; }

  get forwardX() { return Math.sin(this.yaw); }
  get forwardZ() { return Math.cos(this.yaw); }

  lockPoint(out) {
    return out.set(this.pos.x, this.pos.y + this.lockHeight, this.pos.z);
  }

  turnTo(targetYaw, rate, dt) {
    this.yaw = turnToward(this.yaw, targetYaw, rate * dt);
  }

  // Integrates horizontal velocity, gravity and collisions against the world.
  integrate(dt) {
    const w = this.game.world;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    w.resolve(this.pos, this.radius);
    this.constrain?.();
    const ground = w.getHeight(this.pos.x, this.pos.z);
    if (!this.onGround || this.pos.y > ground + 0.05) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        this.pos.y = ground;
        this.landV = -this.vy; // how hard it came down (the player's landing squash reads this)
        this.landAt = this.game.time;
        if (this.landV > 6) this.kickUp?.(Math.min(2, this.landV / 6)); // a hard landing throws up the ground
        this.vy = 0;
        this.onGround = true;
      } else {
        this.onGround = false;
      }
    } else {
      this.pos.y = ground;
      this.vy = 0;
    }
  }
}
