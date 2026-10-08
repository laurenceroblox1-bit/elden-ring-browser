// The Unbound. Stamina-gated soulslike moveset: light combo, heavy, roll with i-frames,
// backstep, flask, lock-on strafing, and riding.
import { Actor } from './Actor.js';
import { buildPlayer } from '../models/characters.js';
import { pose, copyPose, applyPose, attackPose, addGait } from '../models/pose.js';
import { clamp, damp, dampK, dampAngle, yawTo, easeOut } from '../core/math.js';

export const ATTACKS = {
  light1: { stamina: 14, dmg: 17, poise: 14, windup: 0.16, active: 0.14, recover: 0.36, lunge: 2.6, reach: 2.3, arc: 1.0, pose: 'slashR', next: 'light2', sfx: 'swing' },
  light2: { stamina: 14, dmg: 17, poise: 14, windup: 0.14, active: 0.14, recover: 0.36, lunge: 2.6, reach: 2.3, arc: 1.0, pose: 'slashL', next: 'light3', sfx: 'swing' },
  light3: { stamina: 18, dmg: 24, poise: 22, windup: 0.22, active: 0.12, recover: 0.44, lunge: 3.6, reach: 2.7, arc: 0.5, pose: 'thrust', next: 'light1', sfx: 'swing' },
  heavy: { stamina: 30, dmg: 42, poise: 48, windup: 0.52, active: 0.15, recover: 0.52, lunge: 3.2, reach: 2.6, arc: 0.65, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
  rolling: { stamina: 14, dmg: 15, poise: 10, windup: 0.1, active: 0.14, recover: 0.36, lunge: 3.0, reach: 2.4, arc: 0.6, pose: 'thrust', next: 'light2', sfx: 'swing' },
  mounted: { stamina: 10, dmg: 22, poise: 20, windup: 0.2, active: 0.18, recover: 0.38, reach: 3.2, arc: 1.1, yawOffset: -0.75, height: 3.5, pose: 'mounted', sfx: 'swing' },
};

const POSES = {
  rest: pose({ sRx: -0.2, eR: -0.55, hRx: 1.1, sLx: 0.05, eL: -0.25 }),
  sprint: pose({ torsoX: 0.28, headX: -0.2, sRx: 0.2, eR: -0.4, hRx: 1.4, sLx: 0.1, eL: -0.6 }),
  slashR: [pose({ sRx: -1.35, sRy: -1.4, eR: -0.25, hRx: 1.3, torsoY: -0.6, sLx: -0.3, eL: -0.5 }),
    pose({ sRx: -1.3, sRy: 1.0, eR: -0.1, hRx: 1.3, torsoY: 0.6, torsoX: 0.1, sLx: 0.2 })],
  slashL: [pose({ sRx: -1.3, sRy: 1.1, eR: -0.3, hRx: 1.3, torsoY: 0.55, sLx: 0.2 }),
    pose({ sRx: -1.3, sRy: -1.3, eR: -0.1, hRx: 1.3, torsoY: -0.55, torsoX: 0.1, sLx: -0.3 })],
  thrust: [pose({ sRx: -0.5, sRy: -0.2, eR: -1.5, hRx: 1.9, torsoY: -0.45, lRx: 0.3, lLx: -0.4, kL: 0.3 }),
    pose({ sRx: -1.5, eR: 0, hRx: 1.5, torsoY: 0.25, torsoX: 0.18, lRx: -0.5, kR: 0.3, lLx: 0.4, hipsH: -0.08 })],
  overhead: [pose({ sRx: -2.9, eR: -0.6, hRx: 1.0, sLx: -2.6, eL: -0.6, torsoX: -0.22, torsoY: -0.15 }),
    pose({ sRx: -0.7, eR: -0.1, hRx: 1.0, sLx: -0.7, eL: -0.2, torsoX: 0.45, hipsH: -0.14, lRx: -0.6, kR: 0.5, lLx: 0.3 })],
  riding: pose({ lRx: -1.35, lRz: -0.5, kR: 1.5, lLx: -1.35, lLz: 0.5, kL: 1.5, sRx: -0.5, eR: -0.9, hRx: 1.4, sLx: -0.5, eL: -0.9, torsoX: 0.15 }),
  mounted: [pose({ sRx: -2.5, sRz: -0.4, eR: -0.4, hRx: 1.0 }), pose({ sRx: -0.5, sRz: -1.0, eR: -0.1, hRx: 1.1, torsoY: -0.45 })],
  tuck: pose({ torsoX: 0.7, headX: 0.5, lRx: -1.6, kR: 2.0, lLx: -1.6, kL: 2.0, sRx: -0.8, eR: -1.2, hRx: 1.6, sLx: -0.8, eL: -1.2 }),
  backstep: pose({ torsoX: -0.2, lRx: 0.4, lLx: -0.3, kL: 0.4, sRx: -0.3, eR: -0.7, hRx: 1.2 }),
  heal: pose({ sRx: -0.2, eR: -0.55, hRx: 1.1, sLx: -1.75, sLz: -0.2, eL: -1.7, hLx: 0.4, headX: -0.25 }),
  hurt: pose({ torsoX: -0.35, headX: -0.3, sRz: -0.6, sLz: 0.6, sRx: 0.2, hRx: 1.1, hipsH: -0.06, lRx: 0.3, lLx: -0.3 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.2, sLz: 1.2, headX: -0.2, lRx: -0.2, lLx: 0.15 }),
  fog: pose({ sRx: -0.2, eR: -0.55, hRx: 1.1, sLx: -1.1, eL: -0.4, sLz: -0.3, torsoX: 0.12 }),
};

const ROLL_TIME = 0.62;
const BACKSTEP_TIME = 0.42;

export class Player extends Actor {
  constructor(game) {
    super(game);
    this.team = 'player';
    this.lockable = false;
    this.model = buildPlayer();
    game.scene.add(this.model.root);
    this.poseBuf = pose();
    this.state = 'move';
    this.t = 0;
    this.gait = 0;
    this.buffer = null;
    this.stamina = 100;
    this.staminaDelay = 0;
    this.poise = this.maxPoise = 30;
    this.poiseTimer = 0;
    this.flasks = 4;
    this.flasksMax = 4;
    this.dmgMult = 1;
    this.mounted = false;
    this.horse = null;
    this.god = false;
    this.lastStep = 0;
    game.combat.register(this);
  }

  applyStats(stats, flasksMax) {
    this.maxHp = 100 + (stats.vigor - 10) * 9;
    this.maxStamina = 90 + (stats.endurance - 10) * 6;
    this.dmgMult = 1 + (stats.strength - 10) * 0.05;
    this.flasksMax = flasksMax;
  }

  respawn(x, z, yaw) {
    this.alive = true;
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.flasks = this.flasksMax;
    this.poise = this.maxPoise;
    this.pos.set(x, this.game.world.getHeight(x, z), z);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.yaw = yaw;
    this.state = 'move';
    this.mounted = false;
    this.invuln = false;
    this.buffer = null;
    this.model.pivot.rotation.x = 0;
    this.model.flask.visible = false;
    copyPose(this.poseBuf, POSES.rest);
    applyPose(this.model, this.poseBuf, 1);
  }

  // ---------- intent ----------

  moveIntent() {
    const ax = this.game.input.axis();
    const cy = this.game.cam.yaw;
    return {
      x: ax.x * Math.cos(cy) - ax.y * Math.sin(cy),
      z: -ax.x * Math.sin(cy) - ax.y * Math.cos(cy),
      mag: ax.mag,
    };
  }

  _readBuffer(dt) {
    const input = this.game.input;
    for (const a of ['roll', 'light', 'heavy', 'flask']) {
      if (input.pressed(a)) this.buffer = { a, t: a === 'flask' ? 0.2 : 0.38 };
    }
    if (this.buffer && (this.buffer.t -= dt) <= 0) this.buffer = null;
  }

  _take(a) {
    if (this.buffer?.a !== a) return false;
    this.buffer = null;
    return true;
  }

  // ---------- actions ----------

  startAttack(name, mi = this.moveIntent()) {
    if (this.stamina <= 0) return false;
    const def = ATTACKS[name];
    this.stamina = Math.max(0, this.stamina - def.stamina);
    this.staminaDelay = 0.75;
    this.state = this.mounted ? 'mounted' : 'attack';
    this.atk = def;
    this.atkT = 0;
    this.t = 0;
    this.hitSet = new Set();
    this.swung = false;
    this.hit = { dmg: def.dmg * this.dmgMult, poise: def.poise, reach: def.reach, arc: def.arc, heavy: def.heavy, height: def.height, yawOffset: def.yawOffset };
    if (!this.mounted) {
      const lock = this.game.lockTarget;
      if (lock) this.yaw = yawTo(this.pos.x, this.pos.z, lock.pos.x, lock.pos.z);
      else if (mi.mag > 0) this.yaw = Math.atan2(mi.x, mi.z);
    }
    return true;
  }

  startRoll(mi) {
    if (this.stamina <= 0) return false;
    this.stamina = Math.max(0, this.stamina - 18);
    this.staminaDelay = 0.7;
    this.t = 0;
    this.atk = null;
    if (mi.mag > 0) {
      this.state = 'roll';
      this.yaw = Math.atan2(mi.x, mi.z);
      this.rollDir = { x: mi.x, z: mi.z };
    } else {
      this.state = 'backstep';
      this.rollDir = { x: -this.forwardX, z: -this.forwardZ };
    }
    this.game.audio.play('roll');
    return true;
  }

  startHeal() {
    if (this.flasks <= 0) {
      this.game.hud.toast('Your flask is empty. Rest at a shrine to refill it.');
      return false;
    }
    this.state = 'heal';
    this.t = 0;
    this.healed = false;
    this.model.flask.visible = true;
    return true;
  }

  // Walks from (fromX, fromZ) through the mist to (x, z) on rails, so you always end up inside.
  startFogWalk(fromX, fromZ, x, z, onDone) {
    this.state = 'fog';
    this.t = 0;
    this.fogTarget = { fromX, fromZ, x, z, onDone };
    this.invuln = true;
    this.vel.set(0, 0, 0);
    this.yaw = yawTo(fromX, fromZ, x, z);
  }

  mount(horse) {
    this.mounted = true;
    this.horse = horse;
    this.state = 'mounted';
    this.atk = null;
    this.vel.set(0, 0, 0);
  }

  dismount(horse) {
    this.mounted = false;
    this.horse = null;
    this.state = 'move';
    this.atk = null;
    const rx = Math.cos(horse.yaw), rz = -Math.sin(horse.yaw);
    this.pos.x = horse.pos.x + rx * 1.3;
    this.pos.z = horse.pos.z + rz * 1.3;
    this.game.world.resolve(this.pos, this.radius);
    this.pos.y = Math.max(this.game.world.getHeight(this.pos.x, this.pos.z), horse.pos.y);
    this.onGround = false;
    this.vy = 0;
    this.yaw = horse.yaw;
  }

  takeHit(hit) {
    if (!this.alive || this.invuln) return false;
    if (!this.god) this.hp -= hit.dmg;
    this.game.events.emit('playerHurt', hit);
    if (this.mounted && (hit.heavy || this.hp <= 0)) this.game.horse.dismount(true);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }
    this.poise -= hit.poise ?? 20;
    this.poiseTimer = 2.5;
    if (!this.mounted && (this.poise <= 0 || hit.heavy)) {
      this.poise = this.maxPoise;
      this.state = 'hurt';
      this.t = 0;
      this.hurtDur = hit.heavy ? 0.85 : 0.45;
      const k = hit.knock ?? (hit.heavy ? 7 : 3.5);
      this.vel.set(hit.dirX * k, 0, hit.dirZ * k);
      this.atk = null;
      this.model.flask.visible = false;
    }
    return true;
  }

  die() {
    this.alive = false;
    this.state = 'dead';
    this.t = 0;
    this.vel.set(0, 0, 0);
    this.model.flask.visible = false;
    this.game.onPlayerDeath();
  }

  // ---------- update ----------

  update(dt) {
    this.t += dt;
    if (!this.alive) {
      this.vel.multiplyScalar(Math.exp(-6 * dt));
      this.integrate(dt);
      this._animate(dt, 0);
      return;
    }
    this._readBuffer(dt);
    if ((this.poiseTimer -= dt) <= 0) this.poise = this.maxPoise;
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else if (!this.sprinting) this.stamina = Math.min(this.maxStamina, this.stamina + 50 * dt);

    const mi = this.moveIntent();
    const lock = this.game.lockTarget;
    this.sprinting = false;
    this.invuln = false;

    switch (this.state) {
      case 'move': this._move(dt, mi, lock); break;
      case 'roll': this._roll(dt, mi); break;
      case 'backstep': this._backstep(dt); break;
      case 'attack': this._attack(dt, mi, lock); break;
      case 'heal': this._heal(dt, mi); break;
      case 'hurt':
        this.vel.multiplyScalar(Math.exp(-5 * dt));
        if (this.t >= this.hurtDur) this.state = 'move';
        break;
      case 'fog': this._fog(dt); break;
      case 'mounted': this._mounted(dt); break;
    }

    if (this.state !== 'mounted') this.integrate(dt);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this._animate(dt, speed);
  }

  _move(dt, mi, lock) {
    const input = this.game.input;
    if (this._take('roll') && this.startRoll(mi)) return;
    if (this._take('light') && this.startAttack('light1', mi)) return;
    if (this._take('heavy') && this.startAttack('heavy', mi)) return;
    if (this._take('flask') && this.startHeal()) return;

    const moving = mi.mag > 0;
    if (input.held('sprint') && moving && this.stamina > 1 && !this.winded) {
      this.sprinting = true;
      this.stamina -= 14 * dt;
      this.staminaDelay = 0.5;
      if (this.stamina <= 0) this.winded = true;
    }
    if (this.winded && this.stamina > 25) this.winded = false;
    let speed = this.sprinting ? 7.4 : lock ? 3.8 : 4.6;
    if (this.game.world.isWater(this.pos.x, this.pos.z)) speed *= 0.55;
    this.vel.x = damp(this.vel.x, mi.x * speed, 12, dt);
    this.vel.z = damp(this.vel.z, mi.z * speed, 12, dt);
    if (lock && !this.sprinting) this.yaw = dampAngle(this.yaw, yawTo(this.pos.x, this.pos.z, lock.pos.x, lock.pos.z), 14, dt);
    else if (moving) this.yaw = dampAngle(this.yaw, Math.atan2(mi.x, mi.z), 12, dt);
  }

  _roll(dt, mi) {
    const u = this.t / ROLL_TIME;
    const sp = 9.2 * Math.max(0, 1 - u * u);
    this.vel.set(this.rollDir.x * sp, 0, this.rollDir.z * sp);
    this.invuln = this.t > 0.03 && this.t < 0.4;
    if (this.t > 0.42 && this._take('light')) {
      this.state = 'move';
      this.startAttack('rolling', mi);
      return;
    }
    if (this.t >= ROLL_TIME) this.state = 'move';
  }

  _backstep(dt) {
    const u = this.t / BACKSTEP_TIME;
    const sp = 7 * Math.max(0, 1 - u * u);
    this.vel.set(this.rollDir.x * sp, 0, this.rollDir.z * sp);
    this.invuln = this.t > 0.02 && this.t < 0.24;
    if (this.t >= BACKSTEP_TIME) this.state = 'move';
  }

  _attack(dt, mi, lock) {
    const d = this.atk;
    const tw = d.windup, ta = tw + d.active, tr = ta + d.recover;
    const t = this.t;
    if (t < tw && lock) this.turnTo(yawTo(this.pos.x, this.pos.z, lock.pos.x, lock.pos.z), 7, dt);
    let lunge = 0;
    if (t > tw * 0.5 && t < ta + 0.05) {
      lunge = d.lunge;
      if (lock && Math.hypot(lock.pos.x - this.pos.x, lock.pos.z - this.pos.z) < lock.radius + 1.3) lunge = 0;
    }
    this.vel.x = damp(this.vel.x, this.forwardX * lunge, 16, dt);
    this.vel.z = damp(this.vel.z, this.forwardZ * lunge, 16, dt);
    if (!this.swung && t >= tw) {
      this.swung = true;
      this.game.audio.play(d.sfx);
    }
    if (t >= tw && t < ta) this.game.combat.melee(this, this.hit, this.hitSet);
    if (t >= ta) {
      if (d.next && t >= ta + 0.04 && this._take('light')) { this.startAttack(d.next, mi); return; }
      if (t >= ta + 0.1 && this._take('heavy')) { this.startAttack('heavy', mi); return; }
      if (t >= ta + d.recover * 0.3 && this._take('roll')) { this.state = 'move'; this.startRoll(mi); return; }
    }
    if (t >= tr) this.state = 'move';
  }

  _heal(dt, mi) {
    this.vel.x = damp(this.vel.x, mi.x * 1.4, 10, dt);
    this.vel.z = damp(this.vel.z, mi.z * 1.4, 10, dt);
    if (!this.healed && this.t >= 0.6) {
      this.healed = true;
      this.flasks--;
      this.hp = Math.min(this.maxHp, this.hp + 60);
      this.game.audio.play('heal');
      this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z, count: 24, speed: 1.2, up: 1.8, color: 0xe8d070, color2: 0xfff6c8, life: [0.6, 1.1], size: [0.06, 0.12], jitter: 0.4, drag: 1 });
    }
    if (this.t >= 1.1) {
      this.state = 'move';
      this.model.flask.visible = false;
    }
  }

  _fog(dt) {
    const f = this.fogTarget;
    this.invuln = true;
    const u = Math.min(1, this.t / 1.4);
    this.vel.set(0, 0, 0);
    this.pos.x = f.fromX + (f.x - f.fromX) * u;
    this.pos.z = f.fromZ + (f.z - f.fromZ) * u;
    if (this.t >= 1.4) {
      this.state = 'move';
      this.invuln = false;
      f.onDone?.();
    }
  }

  _mounted(dt) {
    if (this.atk) {
      this.atkT += dt;
      const d = this.atk;
      if (!this.swung && this.atkT >= d.windup) { this.swung = true; this.game.audio.play(d.sfx); }
      if (this.atkT >= d.windup && this.atkT < d.windup + d.active) this.game.combat.melee(this, this.hit, this.hitSet);
      if (this.atkT >= d.windup + d.active + d.recover) this.atk = null;
    } else if (this._take('light')) {
      this.startAttack('mounted');
    }
  }

  // ---------- animation ----------

  _animate(dt, speed) {
    const r = this.model;
    const p = this.poseBuf;
    let k = dampK(14, dt);
    let pivotOverride = null;
    switch (this.state) {
      case 'move': {
        copyPose(p, this.sprinting ? POSES.sprint : POSES.rest);
        const amp = clamp(speed / 6.5, 0, 1.1);
        this.gait += dt * (2.2 + speed * 1.35);
        addGait(p, this.gait, amp, 0.5);
        p.torsoX += Math.sin(this.game.time * 2) * 0.02;
        const step = Math.sign(Math.sin(this.gait));
        if (amp > 0.2 && step !== this.lastStep) this.game.audio.play('step');
        this.lastStep = step;
        break;
      }
      case 'roll': {
        copyPose(p, POSES.tuck);
        const u = clamp(this.t / 0.5, 0, 1);
        pivotOverride = { x: easeOut(u) * Math.PI * 2, h: -Math.sin(u * Math.PI) * 0.5 };
        if (u >= 1) copyPose(p, POSES.rest);
        k = dampK(24, dt);
        break;
      }
      case 'backstep':
        copyPose(p, POSES.backstep);
        p.hipsH = Math.sin(clamp(this.t / BACKSTEP_TIME, 0, 1) * Math.PI) * 0.12;
        k = dampK(20, dt);
        break;
      case 'attack': {
        const d = this.atk;
        const [wind, strike] = POSES[d.pose];
        attackPose(p, POSES.rest, wind, strike, this.t, d.windup, d.active, d.recover, easeOut);
        k = dampK(32, dt);
        break;
      }
      case 'mounted': {
        copyPose(p, POSES.riding);
        if (this.atk) {
          const d = this.atk;
          const [wind, strike] = POSES.mounted;
          attackPose(p, POSES.riding, { ...POSES.riding, ...pick(wind) }, { ...POSES.riding, ...pick(strike) }, this.atkT, d.windup, d.active, d.recover, easeOut);
          k = dampK(30, dt);
        }
        p.torsoX += clamp((this.horse?.speed ?? 0) / 18, 0, 1) * 0.25;
        break;
      }
      case 'heal': copyPose(p, POSES.heal); break;
      case 'hurt': copyPose(p, POSES.hurt); k = dampK(20, dt); break;
      case 'fog': copyPose(p, POSES.fog); addGait(p, (this.gait += dt * 5), 0.35); break;
      case 'dead': copyPose(p, POSES.dead); k = dampK(5, dt); break;
    }
    applyPose(r, p, k);
    if (pivotOverride) {
      r.pivot.rotation.x = pivotOverride.x;
      r.pivot.position.y = r.base.pivot + pivotOverride.h;
    } else if (r.pivot.rotation.x > Math.PI) {
      r.pivot.rotation.x = 0; // a finished roll wraps back to upright instead of unwinding
    }
    r.cloak.rotation.x = damp(r.cloak.rotation.x, 0.08 + clamp(speed, 0, 9) * 0.07 + (this.mounted ? 0.5 : 0), 6, dt);
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.yaw;
  }
}

// Only the arm/torso joints of an attack overlay, so mounted swings keep the riding legs.
function pick(p) {
  const out = {};
  for (const key of ['sRx', 'sRy', 'sRz', 'eR', 'hRx', 'hRy', 'hRz', 'torsoY']) out[key] = p[key];
  return out;
}
