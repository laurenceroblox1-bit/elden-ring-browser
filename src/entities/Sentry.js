// Hollow sentries: the Vale's common foe. A small state machine that's easy to copy for new enemies:
// idle -> alert -> chase <-> attack -> circle, plus hurt, return (leash) and dead.
// Shield play: guard (raised when the player swings at their front), broken (guard smashed),
// parried (their swing was parried), riposted (held for the player's riposte) and knockdown.
import { Actor } from './Actor.js';
import { buildSentry, buildKnight } from '../models/characters.js';
import { buildDrowned } from '../models/creatures.js';
import { pose, copyPose, applyPose, attackPose, addGait, framePose } from '../models/pose.js';
import { clamp, damp, dampK, yawTo, angleDiff, easeOut } from '../core/math.js';

const MOVES = {
  slash: { windup: 0.62, active: 0.16, recover: 0.62, dmg: 16, poise: 18, reach: 2.3, arc: 0.9, lunge: 2.5, track: 5, pose: 'slash' },
  thrust: { windup: 0.78, active: 0.14, recover: 0.75, dmg: 20, poise: 22, reach: 3.0, arc: 0.4, lunge: 6, track: 3.5, pose: 'thrust' },
  // Knights only: a shove with the shield that breaks a guard (it can't be parried: no blade).
  bash: { windup: 0.5, active: 0.14, recover: 0.6, dmg: 10, poise: 45, reach: 1.9, arc: 0.8, lunge: 5, track: 5, pose: 'bash', heavy: true, parryable: false },
};

// Sentry-type foes: the Vale's hollow sentries, their captain, and Castle Dunmarrow's knights.
const VARIANTS = {
  sentry: { tag: 'sentry', name: 'Hollow Sentry', hp: 62, poise: 22, ash: 70, radius: 0.45, height: 1.8, lock: 1.3, speed: 1, dmg: 1, guard: 0.35, guardMax: 55, reach: 1, pace: 1, build: () => buildSentry(false) },
  captain: { tag: 'sentry', name: 'Hollow Captain', hp: 170, poise: 45, ash: 260, radius: 0.55, height: 2.1, lock: 1.5, speed: 0.92, dmg: 1.4, guard: 0.5, guardMax: 90, reach: 1.12, pace: 0.85, build: () => buildSentry(true) },
  // The Drowned Coast's sailors: no shield, a long harpoon they mostly thrust with.
  drowned: { tag: 'drowned', name: 'Drowned Sailor', hp: 95, poise: 30, ash: 130, radius: 0.48, height: 1.9, lock: 1.35, speed: 0.9, dmg: 1.3, guard: 0, guardMax: 0, reach: 1.35, pace: 1.05, thrust: 0.75, build: buildDrowned },
  knight: { tag: 'knight', name: 'Dunmarrow Knight', hp: 160, poise: 50, ash: 240, radius: 0.5, height: 2.0, lock: 1.45, speed: 0.95, dmg: 1.55, guard: 0.6, guardMax: 120, reach: 1.15, pace: 0.9, bash: true, build: buildKnight },
};

const POSES = {
  rest: pose({ sRx: -0.2, eR: -0.5, hRx: 1.2, sLx: -0.6, eL: -0.9, torsoX: 0.12, headX: -0.1 }),
  slash: [pose({ sRx: -2.6, eR: -0.6, hRx: 0.9, torsoY: -0.35, sLx: -0.6, eL: -0.9, torsoX: -0.1 }),
    pose({ sRx: -0.5, eR: 0, hRx: 1.1, torsoY: 0.3, torsoX: 0.3, sLx: -0.4, eL: -0.9 })],
  bash: [pose({ sLx: -0.5, sLy: -0.7, eL: -1.5, torsoY: 0.45, sRx: -0.3, eR: -0.8, hRx: 1.4, lLx: 0.3 }),
    pose({ sLx: -1.5, sLy: -0.95, eL: -0.25, torsoY: -0.35, torsoX: 0.25, sRx: -0.2, eR: -0.6, hRx: 1.2, lRx: -0.5, kR: 0.4, lLx: 0.3, hipsH: -0.06 })],
  thrust: [pose({ sRx: -0.5, eR: -1.6, hRx: 2.0, torsoY: -0.45, sLx: -0.8, eL: -1.0 }),
    pose({ sRx: -1.55, eR: 0, hRx: 1.55, torsoY: 0.3, torsoX: 0.25, hipsH: -0.1, lRx: -0.6, kR: 0.4, lLx: 0.4 })],
  hurt: pose({ torsoX: -0.4, headX: -0.3, sRz: -0.5, sLz: 0.5, hRx: 1.1, hipsH: -0.06 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.1, sLz: 1.0, lRx: -0.3 }),
  // Shield turned to face forward (sLy) and lifted across the chest, sword cocked to answer.
  guard: pose({ sLx: -1.2, sLy: -1.1, eL: -1.0, sRx: -0.6, eR: -1.0, hRx: 1.5, torsoX: 0.18, headX: -0.15, lRx: 0.2, lLx: -0.3, kL: 0.3, hipsH: -0.06 }),
  shieldHit: pose({ sLx: -1.0, sLy: -1.1, eL: -1.15, sRx: -0.4, eR: -0.9, hRx: 1.4, torsoX: -0.12, headX: -0.25, lRx: 0.4, kR: 0.2, lLx: -0.2, kL: 0.4, hipsH: -0.1 }),
  parried: pose({ sRx: -2.6, sRz: -0.6, eR: -0.3, hRx: 1.0, torsoX: -0.45, headX: -0.4, sLx: -0.2, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3, lLx: -0.3 }),
  broken: pose({ sLz: 1.3, sLx: -0.6, eL: -0.2, torsoX: -0.35, headX: -0.3, sRx: 0.1, sRz: -0.5, eR: -0.4, hRx: 1.1, hipsH: -0.08, lLx: 0.35, kL: 0.3, lRx: -0.2 }),
  riposted: pose({ torsoX: 0.55, headX: 0.35, sRx: -0.3, sRz: -0.4, eR: -0.2, hRx: 1.0, sLx: -0.4, sLz: 0.4, eL: -0.4, hipsH: -0.12, kR: 0.3, kL: 0.3, lRx: -0.2, lLx: -0.2 }),
};

const KNOCKDOWN_TIME = 2.1;
const KNOCKDOWN_KEYS = [[0, POSES.riposted], [0.35, POSES.dead], [KNOCKDOWN_TIME - 0.75, POSES.dead], [KNOCKDOWN_TIME, POSES.rest]];
// States in which the AI doesn't steer (scripted motion or reactions).
const NO_STEER = new Set(['attack', 'hurt', 'dead', 'parried', 'broken', 'riposted', 'knockdown']);

export class Sentry extends Actor {
  constructor(game, spawn) {
    super(game);
    this.spawn = spawn;
    const V = (this.variant = VARIANTS[spawn.kind] ?? VARIANTS.sentry);
    this.captain = spawn.kind === 'captain';
    this.tag = V.tag;
    this.name = V.name;
    this.model = V.build();
    game.scene.add(this.model.root);
    this.maxHp = V.hp;
    this.maxPoise = V.poise;
    this.ash = V.ash;
    this.radius = V.radius;
    this.height = V.height;
    this.lockHeight = V.lock;
    this.speedMul = V.speed;
    this.dmgMul = V.dmg;
    this.guardChance = V.guard; // chance to raise the shield against a swing at its front
    this.guardMax = V.guardMax; // shield stamina: light hits drain it, heavies break it outright
    this.poseBuf = pose();
    this.gait = 0;
    game.combat.register(this);
    this.reset();
  }

  reset() {
    const s = this.spawn;
    this.pos.set(s.x, this.game.world.getHeight(s.x, s.z), s.z);
    this.vel.set(0, 0, 0);
    this.yaw = s.yaw;
    this.hp = this.maxHp;
    this.poise = this.maxPoise;
    this.alive = true;
    this.state = 'idle';
    this.t = 0;
    this.cooldown = 0;
    this.strafe = 1;
    this.openT = 0;
    this.guardHp = this.guardMax;
    this.guardHold = 0;
    this.frost = this.frostbite = 0;
    this.clearBurnPoison();
    this.shieldHit = 0;
    this.seenAtk = this.game.player?.atkSeq ?? 0;
    this.model.root.visible = true;
    this.model.pivot.rotation.x = 0;
    copyPose(this.poseBuf, POSES.rest);
    applyPose(this.model, this.poseBuf, 1);
    this._sync();
  }

  // ---------- combat hooks ----------

  isOpen() {
    return this.alive && this.openT > 0 && this.state !== 'riposted' && this.state !== 'knockdown';
  }

  onParried(by) {
    if (!this.alive || this.state !== 'attack') return;
    this.state = 'parried';
    this.t = 0;
    this.hurtDur = 1.6;
    this.openT = 1.8;
    const dx = this.pos.x - by.pos.x, dz = this.pos.z - by.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / d) * 2.2, 0, (dz / d) * 2.2);
  }

  onRiposte(by) {
    if (!this.isOpen()) return false;
    this.state = 'riposted';
    this.t = 0;
    this.openT = 0;
    this.vel.set(0, 0, 0);
    this.yaw = yawTo(this.pos.x, this.pos.z, by.pos.x, by.pos.z);
    return true;
  }

  _die(hit) {
    this.hp = 0;
    this.alive = false;
    this.state = 'dead';
    this.t = 0;
    this.openT = 0;
    this.vel.set(hit.dirX * 3, 0, hit.dirZ * 3);
    this.game.onEnemyKilled(this);
    return true;
  }

  // Blocked on the shield: a little chip damage and shield stamina, or a broken guard (open to a riposte).
  _shieldBlock(hit) {
    this.guardHold = Math.max(this.guardHold, 0.5);
    this.shieldHit = 0.2;
    this.guardHp -= hit.dmg * 1.4;
    const broke = hit.heavy || this.guardHp <= 0;
    this.hp -= hit.dmg * (broke ? 0.35 : 0.12);
    if (this.hp <= 0) return this._die(hit);
    if (broke) {
      this.state = 'broken';
      this.t = 0;
      this.hurtDur = 1.5;
      this.openT = 1.8;
      this.guardHp = this.guardMax;
      this.vel.set(hit.dirX * 3, 0, hit.dirZ * 3);
      return 'break';
    }
    this.vel.set(hit.dirX * 1.6, 0, hit.dirZ * 1.6);
    return 'block';
  }

  takeHit(hit) {
    if (!this.alive) return false;
    const front = Math.abs(angleDiff(this.yaw, Math.atan2(-hit.dirX, -hit.dirZ))) < 1.75;
    if (this.state === 'guard' && this.t >= 0.1 && front && !hit.unblockable && !hit.riposte) return this._shieldBlock(hit);
    this.hp -= hit.dmg;
    this.flinch = 0.25;
    if (this.hp <= 0) return this._die(hit);
    if (hit.riposte) {
      this.state = 'knockdown';
      this.t = 0;
      this.openT = 0;
      this.vel.set(hit.dirX * 3, 0, hit.dirZ * 3);
      return true;
    }
    // Already reeling: extra hits hurt but don't restart the reaction.
    if (this.state === 'riposted' || this.state === 'knockdown' || this.state === 'parried' || this.state === 'broken') return true;
    this.poise -= hit.poise;
    this.poiseTimer = 3;
    if (this.state === 'idle' || this.state === 'return') this.state = 'chase';
    if (this.poise <= 0) {
      this.poise = this.maxPoise;
      this.state = 'hurt';
      this.t = 0;
      this.hurtDur = hit.heavy ? 1.0 : 0.6;
      this.vel.set(hit.dirX * 4, 0, hit.dirZ * 4);
    }
    return true;
  }

  update(dt) {
    this.t += dt;
    const p = this.game.targetFor(this);
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const toP = Math.atan2(dx, dz);
    const fromHome = Math.hypot(this.pos.x - this.spawn.x, this.pos.z - this.spawn.z);
    if ((this.poiseTimer -= dt) <= 0) this.poise = this.maxPoise;
    if (this.openT > 0) this.openT -= dt;
    this.tickFrost(dt);
    if (this.flinch > 0) this.flinch -= dt;
    if (this.shieldHit > 0) this.shieldHit -= dt;
    if (this.state !== 'guard') this.guardHp = Math.min(this.guardMax, this.guardHp + 15 * dt);
    let want = { x: 0, z: 0 };

    switch (this.state) {
      case 'idle': {
        const seen = dist < 15 && Math.abs(angleDiff(this.yaw, toP)) < 1.9;
        if (p.alive && (seen || dist < 5)) {
          this.state = 'alert';
          this.t = 0;
          this.game.audio.playAt('alertHuman', this.pos);
        }
        break;
      }
      case 'alert':
        this.turnTo(toP, 6, dt);
        if (this.t > 0.35) this.state = 'chase';
        break;
      case 'chase': {
        if (!p.alive || fromHome > 38) { this.state = 'return'; break; }
        if (this._maybeGuard(p, dist, toP)) break;
        this.turnTo(toP, 5, dt);
        if (dist > 2.1) want = { x: Math.sin(toP) * 3.7, z: Math.cos(toP) * 3.7 };
        if ((this.cooldown -= dt) <= 0 && dist < 3.1) {
          const bash = this.variant.bash && dist < 2.2 && Math.random() < 0.3;
          this._startMove(bash ? 'bash' : dist > 2.4 || Math.random() < (this.variant.thrust ?? 0.3) ? 'thrust' : 'slash');
        }
        break;
      }
      case 'circle': {
        if (!p.alive) { this.state = 'return'; break; }
        if (this._maybeGuard(p, dist, toP)) break;
        this.turnTo(toP, 5, dt);
        const side = toP + (Math.PI / 2) * this.strafe;
        const back = dist < 2.6 ? -1.2 : dist > 4 ? 1.2 : 0;
        want = { x: Math.sin(side) * 1.5 + Math.sin(toP) * back, z: Math.cos(side) * 1.5 + Math.cos(toP) * back };
        if ((this.cooldown -= dt) <= 0) this.state = 'chase';
        break;
      }
      case 'attack': this._attack(dt, toP); break;
      case 'guard': {
        if (!p.alive) { this.state = 'return'; break; }
        this.turnTo(toP, 8, dt);
        const side = toP + (Math.PI / 2) * this.strafe;
        const back = dist < 2.2 ? -1 : 0;
        want = { x: Math.sin(side) * 0.8 + Math.sin(toP) * back, z: Math.cos(side) * 0.8 + Math.cos(toP) * back };
        // Lowering the shield goes straight into a counter if the player is close.
        if ((this.guardHold -= dt) <= 0) { this.state = 'chase'; this.cooldown = 0.15; }
        break;
      }
      case 'hurt':
      case 'parried':
      case 'broken':
        this.vel.multiplyScalar(Math.exp(-6 * dt));
        if (this.t >= this.hurtDur) { this.state = 'chase'; this.cooldown = 0.2; }
        break;
      case 'riposted':
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        if (this.t > 2) { this.state = 'chase'; this.cooldown = 0.3; } // the blow never came
        break;
      case 'knockdown':
        this.vel.multiplyScalar(Math.exp(-4 * dt));
        if (this.t >= KNOCKDOWN_TIME) { this.state = 'chase'; this.cooldown = 0.6; }
        break;
      case 'return': {
        const hy = yawTo(this.pos.x, this.pos.z, this.spawn.x, this.spawn.z);
        this.turnTo(hy, 5, dt);
        want = { x: Math.sin(hy) * 3, z: Math.cos(hy) * 3 };
        this.hp = Math.min(this.maxHp, this.hp + 30 * dt);
        if (fromHome < 1.5) { this.state = 'idle'; this.turnTo(this.spawn.yaw, 10, 1); }
        else if (p.alive && dist < 8 && fromHome < 30) this.state = 'chase';
        break;
      }
      case 'dead':
        this.vel.multiplyScalar(Math.exp(-5 * dt));
        if (this.t > 2.2 && this.t < 3.6 && Math.random() < 0.5) {
          this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 0.3, z: this.pos.z, count: 3, speed: 0.6, up: 1.5, color: 0x4a4540, color2: 0xb0a090, life: [0.8, 1.4], size: [0.1, 0.2], jitter: 0.6 });
        }
        if (this.t > 3.6) this.model.root.visible = false;
        break;
    }

    if (!NO_STEER.has(this.state)) {
      this.vel.x = damp(this.vel.x, want.x * this.speedMul * this.frostSlow, 8, dt);
      this.vel.z = damp(this.vel.z, want.z * this.speedMul * this.frostSlow, 8, dt);
    }
    if (this.state !== 'dead' || this.t < 3.6) this.integrate(dt);
    this._animate(dt);
  }

  // Once per player swing: a swing started at our front may get the shield.
  _maybeGuard(p, dist, toP) {
    if (p.atkSeq === this.seenAtk) return false;
    this.seenAtk = p.atkSeq;
    if (p.state !== 'attack' || dist > 5 || Math.abs(angleDiff(this.yaw, toP)) > 1.2) return false;
    if (Math.random() >= this.guardChance) return false;
    this.state = 'guard';
    this.t = 0;
    this.guardHold = 0.9 + Math.random() * 0.6;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    return true;
  }

  _startMove(name) {
    const m = MOVES[name];
    this.moveName = name; // (multiplayer: other players replay the move by name)
    const sp = this.variant.pace;
    this.move = { ...m, windup: m.windup * sp, recover: m.recover * sp };
    this.hit = { dmg: m.dmg * this.dmgMul, poise: m.poise, reach: m.reach * this.variant.reach, arc: m.arc, heavy: m.heavy, parryable: m.parryable, frost: this.variant.frost, burn: this.variant.burn, poison: this.variant.poison };
    this.hitSet = new Set();
    this.state = 'attack';
    this.t = 0;
    this.swung = false;
  }

  _attack(dt, toP) {
    const m = this.move;
    const tw = m.windup, ta = tw + m.active;
    if (this.t < tw) this.turnTo(toP, m.track, dt);
    const lunge = this.t > tw * 0.7 && this.t < ta ? m.lunge : 0;
    this.vel.x = damp(this.vel.x, Math.sin(this.yaw) * lunge, 14, dt);
    this.vel.z = damp(this.vel.z, Math.cos(this.yaw) * lunge, 14, dt);
    if (!this.swung && this.t >= tw) { this.swung = true; this.game.audio.play('swing'); }
    if (this.t >= tw && this.t < ta) this.game.combat.melee(this, this.hit, this.hitSet);
    if (this.t >= ta + m.recover) {
      this.state = 'circle';
      this.t = 0;
      this.cooldown = 0.6 + Math.random() * 1.1;
      this.strafe = Math.random() < 0.5 ? -1 : 1;
    }
  }

  _animate(dt) {
    const p = this.poseBuf;
    let k = dampK(12, dt);
    switch (this.state) {
      case 'attack': {
        const m = this.move;
        const [wind, strike] = POSES[m.pose];
        attackPose(p, POSES.rest, wind, strike, this.t, m.windup, m.active, m.recover, easeOut);
        k = dampK(28, dt);
        break;
      }
      case 'hurt': copyPose(p, POSES.hurt); k = dampK(20, dt); break;
      case 'guard': {
        copyPose(p, this.shieldHit > 0 ? POSES.shieldHit : POSES.guard);
        const sp = Math.hypot(this.vel.x, this.vel.z);
        this.gait += dt * (2 + sp * 1.6);
        addGait(p, this.gait, clamp(sp / 3, 0, 0.5), 0);
        k = dampK(this.t < 0.15 || this.shieldHit > 0 ? 30 : 14, dt);
        break;
      }
      case 'parried':
      case 'broken':
        copyPose(p, POSES[this.state]);
        p.torsoZ += Math.sin(this.t * 8) * 0.07 * Math.max(0, 1 - this.t / this.hurtDur);
        k = dampK(this.t < 0.2 ? 24 : 6, dt);
        break;
      case 'riposted': copyPose(p, POSES.riposted); k = dampK(14, dt); break;
      case 'knockdown': framePose(p, KNOCKDOWN_KEYS, this.t, easeOut); k = dampK(12, dt); break;
      case 'dead': copyPose(p, POSES.dead); k = dampK(6, dt); p.pivotH -= clamp(this.t - 2.2, 0, 1.4) * 0.5; break;
      default: {
        copyPose(p, POSES.rest);
        const sp = Math.hypot(this.vel.x, this.vel.z);
        this.gait += dt * (2 + sp * 1.4);
        addGait(p, this.gait, clamp(sp / 5, 0, 1), 0.35);
        p.torsoX += Math.sin(this.game.time * 1.7 + this.spawn.x) * 0.03;
      }
    }
    if (this.flinch > 0 && this.alive) { p.torsoX -= this.flinch * 0.9; p.headX -= this.flinch * 0.8; k = Math.max(k, 0.5); }
    applyPose(this.model, p, k);
    this._sync();
  }

  _sync() {
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
  }
}
