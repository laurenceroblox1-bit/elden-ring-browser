// The Unbound. Stamina-gated soulslike moveset: light combo, heavy, roll with i-frames,
// backstep, flask, guard / parry / riposte, lock-on strafing, and riding.
import { Actor } from './Actor.js';
import { buildPlayer } from '../models/characters.js';
import { pose, copyPose, applyPose, attackPose, addGait, framePose } from '../models/pose.js';
import { clamp, damp, dampK, dampAngle, yawTo, angleDiff, easeOut, easeInOut } from '../core/math.js';

export const ATTACKS = {
  light1: { stamina: 14, dmg: 17, poise: 14, windup: 0.16, active: 0.14, recover: 0.36, lunge: 2.6, reach: 2.3, arc: 1.0, pose: 'slashR', next: 'light2', sfx: 'swing' },
  light2: { stamina: 14, dmg: 17, poise: 14, windup: 0.14, active: 0.14, recover: 0.36, lunge: 2.6, reach: 2.3, arc: 1.0, pose: 'slashL', next: 'light3', sfx: 'swing' },
  light3: { stamina: 18, dmg: 24, poise: 22, windup: 0.22, active: 0.12, recover: 0.44, lunge: 3.6, reach: 2.7, arc: 0.5, pose: 'thrust', next: 'light1', sfx: 'swing' },
  heavy: { stamina: 30, dmg: 42, poise: 48, windup: 0.52, active: 0.15, recover: 0.52, lunge: 3.2, reach: 2.6, arc: 0.65, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
  rolling: { stamina: 14, dmg: 15, poise: 10, windup: 0.1, active: 0.14, recover: 0.36, lunge: 3.0, reach: 2.4, arc: 0.6, pose: 'thrust', next: 'light2', sfx: 'swing' },
  mounted: { stamina: 10, dmg: 22, poise: 20, windup: 0.2, active: 0.18, recover: 0.38, reach: 3.2, arc: 1.1, yawOffset: -0.75, height: 3.5, pose: 'mounted', sfx: 'swing' },
  // Scripted critical thrust on an opened foe: dmg x crit lands once, at `impact`. The player is
  // invulnerable for the whole `time`. `reach` is measured from the foe's body, `spacing` is where we stand.
  riposte: { dmg: 24, crit: 3, time: 1.1, stab: 0.36, impact: 0.62, reach: 2.6, spacing: 0.8, sfx: 'swing' },
};

// How the current guard holds. Weapons and shields swap in their own object (player.guardStats):
//   absorb      fraction of a blocked hit's damage the guard stops
//   cost        stamina lost per point of incoming damage; run dry and the guard breaks
//   parryWindow seconds after a fresh guard press in which a parryable blow is parried (0 = can't parry)
//   raiseTime   seconds before a raised guard starts blocking
//   arc         half-angle (radians) of the guarded front
// The sword alone is a poor shield: much of the blow still gets through and it costs a lot of stamina.
export const SWORD_GUARD = { name: 'sword', absorb: 0.6, cost: 1.5, parryWindow: 0.2, raiseTime: 0.1, arc: 1.75 };

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
  // Blade held up across the body, off hand braced behind it, weight on the back foot.
  guard: pose({ sRx: -0.9, sRy: 0.7, eR: -1.3, hRx: 1.0, hRy: -0.5, sLx: -0.9, sLy: -0.3, eL: -1.1, torsoY: -0.25, torsoX: 0.08, headX: -0.05, lRx: 0.25, lLx: -0.35, kL: 0.35, kR: 0.15, hipsH: -0.06 }),
  guardHit: pose({ sRx: -0.7, sRy: 0.65, eR: -1.4, hRx: 1.1, hRy: -0.5, sLx: -0.7, sLy: -0.3, eL: -1.2, torsoY: -0.3, torsoX: -0.14, headX: -0.15, lRx: 0.45, kR: 0.2, lLx: -0.3, kL: 0.45, hipsH: -0.1 }),
  guardBreak: pose({ sRx: -2.3, sRz: -0.7, eR: -0.4, hRx: 1.0, sLx: -1.0, sLz: 0.9, eL: -0.3, torsoX: -0.45, headX: -0.45, hipsH: -0.12, lRx: 0.45, kR: 0.4, lLx: -0.35, kL: 0.2 }),
  // Riposte: draw back, drive the blade in, lean on it, wrench it free.
  ripWind: pose({ sRx: -0.35, sRy: -0.25, eR: -1.7, hRx: 2.0, torsoY: -0.65, torsoX: -0.05, sLx: -1.1, eL: -0.6, lRx: 0.45, lLx: -0.5, kL: 0.45, hipsH: -0.06 }),
  ripStab: pose({ sRx: -1.55, eR: -0.05, hRx: 1.55, torsoY: 0.3, torsoX: 0.25, sLx: -0.4, eL: -0.9, lRx: -0.6, kR: 0.45, lLx: 0.45, hipsH: -0.12 }),
  ripDrive: pose({ sRx: -1.4, sRy: 0.25, eR: -0.25, hRx: 1.55, hRz: 0.8, torsoY: 0.55, torsoX: 0.42, headX: 0.1, sLx: -1.2, sLy: 0.5, eL: -1.2, lRx: -0.85, kR: 0.75, lLx: 0.6, kL: 0.2, hipsH: -0.22 }),
  ripPull: pose({ sRx: -0.7, sRy: -0.2, eR: -1.2, hRx: 1.7, torsoY: -0.35, torsoX: 0.05, sLx: 0.1, lRx: 0.2, lLx: -0.2, hipsH: -0.05 }),
};

const R = ATTACKS.riposte;
const RIPOSTE_KEYS = [
  [0, POSES.rest], [0.3, POSES.ripWind], [R.stab, POSES.ripStab], [R.impact - 0.08, POSES.ripStab],
  [R.impact, POSES.ripDrive], [0.86, POSES.ripDrive], [0.98, POSES.ripPull], [R.time, POSES.rest],
];

const ROLL_TIME = 0.62;
const BACKSTEP_TIME = 0.42;
const GUARD_SPEED = 2.4;
const GUARD_REGEN = 0.4; // stamina regen multiplier while the guard is up
const PARRY_REARM = 0.45; // a guard press only opens a parry window if the previous press was this long ago
const GUARD_BREAK_TIME = 1.0;

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
    this.guardStats = { ...SWORD_GUARD };
    this.parryT = 0; // parry window left from the last fresh guard press
    this.sincePress = 99; // seconds since the guard button was last pressed
    this.guardRecoil = 0;
    this.stats = { blocks: 0, parries: 0, guardBreaks: 0, ripostes: 0 }; // session counters (tests, future feats)
    this.atkSeq = 0; // bumps on every attack start so enemies can react once per swing
    this.rip = null;
    this.riposteCandidate = null;
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
    this.parryT = 0;
    this.guardRecoil = 0;
    this.rip = null;
    this.riposteCandidate = null;
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
    this.atkSeq++;
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

  // Light attack button: a riposte if an opened foe is in front of us, otherwise the given swing.
  _light(mi, name = 'light1') {
    const foe = this.findRiposteTarget();
    if (foe) return this.startRiposte(foe);
    return this.startAttack(name, mi);
  }

  // The closest opened foe we stand in front of, within riposte reach, that we face (or have locked).
  findRiposteTarget() {
    if (this.mounted) return null;
    const lock = this.game.lockTarget;
    let best = null, bestD = Infinity;
    for (const e of this.game.combat.targetsFor(this)) {
      if (!e.isOpen()) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) - e.radius;
      if (d > R.reach || Math.abs(e.pos.y - this.pos.y) > 1.5) continue;
      if (Math.abs(angleDiff(e.yaw, Math.atan2(-dx, -dz))) > 1.9) continue;
      if (e !== lock && d > 0.3 && Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz))) > 1.1) continue;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  startRiposte(foe) {
    if (!foe.onRiposte(this)) return false;
    this.state = 'riposte';
    this.t = 0;
    this.atk = null;
    this.rip = { target: foe, stabbed: false, struck: false };
    this.yaw = yawTo(this.pos.x, this.pos.z, foe.pos.x, foe.pos.z);
    this.vel.set(0, 0, 0);
    this.invuln = true;
    this.game.events.emit('riposte', foe);
    return true;
  }

  _raiseGuard() {
    this.state = 'guard';
    this.t = 0;
    this.guardRecoil = 0;
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

  // null (the guard doesn't apply), 'parry' or 'block'.
  _guardOutcome(hit) {
    if (this.state !== 'guard' || hit.unblockable) return null;
    const gs = this.guardStats;
    if (Math.abs(angleDiff(this.yaw, Math.atan2(-hit.dirX, -hit.dirZ))) > gs.arc) return null;
    if (hit.parryable && gs.parryWindow > 0 && this.parryT > 0) return 'parry';
    return this.t >= gs.raiseTime ? 'block' : null;
  }

  _parry(hit) {
    this.parryT = 0;
    this.guardRecoil = 0.16;
    this.stats.parries++;
    hit.attacker?.onParried(this, hit);
    this.game.events.emit('parry', hit.attacker);
    return 'parry';
  }

  // Blocked: the guard absorbs part of the blow and pays for it in stamina. Whatever stamina can't
  // cover comes through unabsorbed and breaks the guard.
  _block(hit) {
    const gs = this.guardStats;
    const need = hit.dmg * gs.cost;
    const covered = need > 0 ? Math.min(1, this.stamina / need) : 1;
    this.stamina = Math.max(0, this.stamina - need);
    this.staminaDelay = Math.max(this.staminaDelay, 0.5);
    const dmg = hit.dmg * (1 - gs.absorb) + hit.dmg * gs.absorb * (1 - covered);
    if (!this.god) this.hp -= dmg;
    this.game.events.emit('playerHurt', { ...hit, dmg, blocked: true });
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }
    const k = hit.knock ?? (hit.heavy ? 4.5 : 2.4);
    if (covered < 1) {
      this.state = 'guardbreak';
      this.t = 0;
      this.vel.set(hit.dirX * k * 1.3, 0, hit.dirZ * k * 1.3);
      this.stats.guardBreaks++;
      this.game.events.emit('guardBreak', hit.attacker);
      return 'break';
    }
    this.guardRecoil = hit.heavy ? 0.4 : 0.22;
    this.vel.set(hit.dirX * k, 0, hit.dirZ * k);
    this.stats.blocks++;
    return 'block';
  }

  takeHit(hit) {
    if (!this.alive || this.invuln) return false;
    const guard = this._guardOutcome(hit);
    if (guard === 'parry') return this._parry(hit);
    if (guard === 'block') return this._block(hit);
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
    this._guardTimers(dt);
    if ((this.poiseTimer -= dt) <= 0) this.poise = this.maxPoise;
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else if (!this.sprinting) this.stamina = Math.min(this.maxStamina, this.stamina + 50 * dt * (this.state === 'guard' ? GUARD_REGEN : 1));

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
      case 'guard': this._guard(dt, mi, lock); break;
      case 'guardbreak':
        this.vel.multiplyScalar(Math.exp(-5 * dt));
        if (this.t >= GUARD_BREAK_TIME) this.state = 'move';
        break;
      case 'riposte': this._riposte(dt); break;
    }
    const s = this.state;
    this.riposteCandidate = s === 'move' || s === 'guard' || s === 'attack' ? this.findRiposteTarget() : null;

    if (this.state !== 'mounted') this.integrate(dt);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this._animate(dt, speed);
  }

  // Parry window and anti-mash bookkeeping run in every state, so a press made just before an
  // attack or roll ends still counts once the guard comes up.
  _guardTimers(dt) {
    this.sincePress += dt;
    if (this.parryT > 0) this.parryT -= dt;
    if (this.guardRecoil > 0) this.guardRecoil -= dt;
    if (this.mounted || !this.game.input.pressed('guard')) return;
    this.parryT = this.sincePress > PARRY_REARM ? this.guardStats.parryWindow : 0;
    this.sincePress = 0;
  }

  _move(dt, mi, lock) {
    const input = this.game.input;
    if (this._take('roll') && this.startRoll(mi)) return;
    if (this._take('light') && this._light(mi)) return;
    if (this._take('heavy') && this.startAttack('heavy', mi)) return;
    if (this._take('flask') && this.startHeal()) return;
    if (input.held('guard')) { this._raiseGuard(); return; }

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
      this._light(mi, 'rolling');
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
      if (d.next && t >= ta + 0.04 && this._take('light')) { this._light(mi, d.next); return; }
      if (t >= ta + 0.1 && this._take('heavy')) { this.startAttack('heavy', mi); return; }
      if (t >= ta + d.recover * 0.3 && this._take('roll')) { this.state = 'move'; this.startRoll(mi); return; }
    }
    if (t >= tr) this.state = 'move';
  }

  _guard(dt, mi, lock) {
    const input = this.game.input;
    if (this._take('roll') && this.startRoll(mi)) return;
    if (this._take('light') && this._light(mi)) return;
    if (this._take('heavy') && this.startAttack('heavy', mi)) return;
    if (this._take('flask') && this.startHeal()) return;
    if (!input.held('guard')) { this.state = 'move'; return; }
    if (this.guardRecoil > 0) {
      this.vel.multiplyScalar(Math.exp(-7 * dt)); // ride out the knockback of the blocked blow
    } else {
      const speed = GUARD_SPEED * (this.game.world.isWater(this.pos.x, this.pos.z) ? 0.55 : 1);
      this.vel.x = damp(this.vel.x, mi.x * speed, 10, dt);
      this.vel.z = damp(this.vel.z, mi.z * speed, 10, dt);
    }
    if (lock) this.yaw = dampAngle(this.yaw, yawTo(this.pos.x, this.pos.z, lock.pos.x, lock.pos.z), 14, dt);
    else if (mi.mag > 0) this.yaw = dampAngle(this.yaw, Math.atan2(mi.x, mi.z), 6, dt);
  }

  _riposte(dt) {
    const r = this.rip, foe = r.target, t = this.t;
    const g = this.game;
    this.invuln = true;
    // Close to a fixed spacing before the blade goes in, so the thrust lands on the body.
    if (t < R.impact && foe.alive) {
      const dx = foe.pos.x - this.pos.x, dz = foe.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = clamp((d - foe.radius - R.spacing) * 8, -4, 6);
      this.vel.set((dx / d) * sp, 0, (dz / d) * sp);
      this.turnTo(Math.atan2(dx, dz), 12, dt);
    } else {
      this.vel.multiplyScalar(Math.exp(-10 * dt));
    }
    if (!r.stabbed && t >= R.stab) {
      r.stabbed = true;
      g.audio.play(R.sfx);
    }
    if (!r.struck && t >= R.impact) {
      r.struck = true;
      // The foe may have died or vanished mid-animation (a rest, a reset): then the blow simply misses.
      if (foe.alive && g.combat.strike(this, foe, { dmg: R.dmg * R.crit * this.dmgMult, poise: 0, heavy: true, riposte: true })) {
        g.audio.play('riposte');
        g.cameraShake(0.5);
        g.hitstop = Math.max(g.hitstop, 0.14);
        this.stats.ripostes++;
      }
    }
    if (t >= R.time) {
      this.state = 'move';
      this.rip = null;
    }
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

  _footsteps(amp) {
    const step = Math.sign(Math.sin(this.gait));
    if (amp > 0.2 && step !== this.lastStep) this.game.audio.play('step');
    this.lastStep = step;
  }

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
        this._footsteps(amp);
        break;
      }
      case 'guard': {
        copyPose(p, this.guardRecoil > 0 ? POSES.guardHit : POSES.guard);
        const amp = clamp(speed / 3.2, 0, 0.6);
        this.gait += dt * (2.2 + speed * 1.8);
        addGait(p, this.gait, amp, 0); // arms stay up
        this._footsteps(amp);
        k = dampK(this.t < 0.15 || this.guardRecoil > 0 ? 30 : 16, dt); // the guard snaps up
        break;
      }
      case 'guardbreak':
        copyPose(p, POSES.guardBreak);
        p.torsoZ += Math.sin(this.t * 10) * 0.08 * Math.max(0, 1 - this.t);
        k = dampK(this.t < 0.2 ? 26 : 8, dt);
        break;
      case 'riposte':
        framePose(p, RIPOSTE_KEYS, this.t, easeInOut);
        k = dampK(30, dt);
        break;
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
