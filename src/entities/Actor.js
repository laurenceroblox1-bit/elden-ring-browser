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
  }

  // Combat hooks. Enemies override these; the defaults make any actor safe to parry or riposte-check.
  // isOpen(): true while a riposte can start on this actor.
  isOpen() { return false; }
  // onParried(by, hit): this actor's parryable swing was parried.
  onParried() {}
  // onRiposte(by): a riposte has started on this actor; hold still until the blow lands. Return false to refuse.
  onRiposte() { return false; }

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
