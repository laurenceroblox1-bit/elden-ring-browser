// The Unbound. Stamina-gated soulslike moveset: light combo, heavy, roll with i-frames,
// backstep, flask, guard / parry / riposte, lock-on strafing, and riding. Gear comes from data:
// the weapon (data/weapons.js) sets the moveset, stance, damage scaling and weapon art; a shield sets
// the guard; the rite (data/abilities.js) is the spell on V. Arts and rites spend focus.
import * as THREE from '../lib/three.js';
import { Actor } from './Actor.js';
import { buildPlayer } from '../models/characters.js';
import { pose, copyPose, applyPose, attackPose, addGait, framePose } from '../models/pose.js';
import { STANCES, MOVE_POSES, SHIELD_GUARD, SHIELD_HIT, ARM_L, overlay, guardHitOf, equipModel } from '../models/weapons.js';
import { WEAPONS, SHIELDS, MOUNTED, STARTING_WEAPON } from '../data/weapons.js';
import { ARTS, RITES } from '../data/abilities.js';
import { upgradeMult } from '../data/smithing.js';
import { clamp, damp, dampK, dampAngle, yawTo, angleDiff, easeOut, easeInOut } from '../core/math.js';

// The starting sword's moves, kept under the old name for tools and tests that read them.
export const ATTACKS = {
  ...WEAPONS[STARTING_WEAPON].moves,
  mounted: MOUNTED,
  // Scripted critical thrust on an opened foe: dmg x crit lands once, at `impact`. The player is
  // invulnerable for the whole `time`. `reach` is measured from the foe's body, `spacing` is where we stand.
  // A weapon's `riposte` ({ dmg, crit }) overrides the damage.
  riposte: { dmg: 24, crit: 3, time: 1.1, stab: 0.36, impact: 0.62, reach: 2.6, spacing: 0.8, sfx: 'swing' },
};

// How the current guard holds. Weapons and shields carry their own (player.guardStats):
//   absorb      fraction of a blocked hit's damage the guard stops
//   cost        stamina lost per point of incoming damage; run dry and the guard breaks
//   parryWindow seconds after a fresh guard press in which a parryable blow is parried (0 = can't parry)
//   raiseTime   seconds before a raised guard starts blocking
//   arc         half-angle (radians) of the guarded front
//   speed       walk speed while guarding (default GUARD_SPEED)
// The sword alone is a poor shield: much of the blow still gets through and it costs a lot of stamina.
export const SWORD_GUARD = WEAPONS[STARTING_WEAPON].guard;

// Emotes (Z wave, X bow, B sit, T cheer): pose tracks played on the spot. Other players see them too,
// since multiplayer mirrors every joint. `hold` keeps the last pose until you move (sitting).
const EP = (o) => pose(o);
const WAVE_UP = EP({ sRx: -2.7, sRz: -0.35, eR: -0.5, hRx: 0.2, torsoY: 0.15, headY: 0.1 });
const WAVE_OUT = EP({ sRx: -2.6, sRz: -0.85, eR: -0.7, hRx: 0.2, torsoY: 0.15, headY: 0.1 });
const BOW = EP({ torsoX: 0.85, headX: 0.45, sRx: 0.25, eR: -0.2, sLx: -0.7, sLy: 0.6, eL: -1.5, hipsH: -0.04 });
const SIT = EP({ hipsH: -0.62, lRx: -1.45, kR: 1.6, lLx: -1.35, kL: 1.7, lRz: 0.25, lLz: -0.25, torsoX: 0.18, headX: 0.12, sRx: -0.5, eR: -0.8, sLx: -0.5, eL: -0.8 });
const CHEER_A = EP({ sRx: -3.0, eR: -0.25, sLx: -3.0, eL: -0.25, sRz: -0.2, sLz: 0.2, torsoX: -0.2, headX: -0.3 });
const CHEER_B = EP({ sRx: -2.5, eR: -0.9, sLx: -2.5, eL: -0.9, sRz: -0.3, sLz: 0.3, torsoX: -0.1, headX: -0.2, hipsH: 0.05 });
const EMOTES = {
  emoteWave: { time: 2.0, keys: [[0, null], [0.3, WAVE_UP], [0.55, WAVE_OUT], [0.8, WAVE_UP], [1.05, WAVE_OUT], [1.3, WAVE_UP], [1.6, WAVE_UP], [2.0, null]] },
  emoteBow: { time: 2.0, keys: [[0, null], [0.45, BOW], [1.4, BOW], [2.0, null]] },
  emoteSit: { time: 1.0, hold: true, keys: [[0, null], [0.9, SIT], [1.0, SIT]] },
  emoteCheer: { time: 1.8, keys: [[0, null], [0.25, CHEER_A], [0.5, CHEER_B], [0.75, CHEER_A], [1.0, CHEER_B], [1.25, CHEER_A], [1.8, null]] },
};

const POSES = {
  rest: STANCES.blade.rest,
  riding: pose({ lRx: -1.35, lRz: -0.5, kR: 1.5, lLx: -1.35, lLz: 0.5, kL: 1.5, sRx: -0.5, eR: -0.9, hRx: 1.4, sLx: -0.5, eL: -0.9, torsoX: 0.15 }),
  mountedSwing: [pose({ sRx: -2.5, sRz: -0.4, eR: -0.4, hRx: 1.0 }), pose({ sRx: -0.5, sRz: -1.0, eR: -0.1, hRx: 1.1, torsoY: -0.45 })],
  tuck: pose({ torsoX: 0.7, headX: 0.5, lRx: -1.6, kR: 2.0, lLx: -1.6, kL: 2.0, sRx: -0.8, eR: -1.2, hRx: 1.6, sLx: -0.8, eL: -1.2 }),
  backstep: pose({ torsoX: -0.2, lRx: 0.4, lLx: -0.3, kL: 0.4, sRx: -0.3, eR: -0.7, hRx: 1.2 }),
  heal: pose({ sRx: -0.2, eR: -0.55, hRx: 1.1, sLx: -1.75, sLz: -0.2, eL: -1.7, hLx: 0.4, headX: -0.25 }),
  hurt: pose({ torsoX: -0.35, headX: -0.3, sRz: -0.6, sLz: 0.6, sRx: 0.2, hRx: 1.1, hipsH: -0.06, lRx: 0.3, lLx: -0.3 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.2, sLz: 1.2, headX: -0.2, lRx: -0.2, lLx: 0.15 }),
  fog: pose({ sRx: -0.2, eR: -0.55, hRx: 1.1, sLx: -1.1, eL: -0.4, sLz: -0.3, torsoX: 0.12 }),
  guardBreak: pose({ sRx: -2.3, sRz: -0.7, eR: -0.4, hRx: 1.0, sLx: -1.0, sLz: 0.9, eL: -0.3, torsoX: -0.45, headX: -0.45, hipsH: -0.12, lRx: 0.45, kR: 0.4, lLx: -0.35, kL: 0.2 }),
  // Riposte: draw back, drive the blade in, lean on it, wrench it free.
  ripWind: pose({ sRx: -0.35, sRy: -0.25, eR: -1.7, hRx: 2.0, torsoY: -0.65, torsoX: -0.05, sLx: -1.1, eL: -0.6, lRx: 0.45, lLx: -0.5, kL: 0.45, hipsH: -0.06 }),
  ripStab: pose({ sRx: -1.55, eR: -0.05, hRx: 1.55, torsoY: 0.3, torsoX: 0.25, sLx: -0.4, eL: -0.9, lRx: -0.6, kR: 0.45, lLx: 0.45, hipsH: -0.12 }),
  ripDrive: pose({ sRx: -1.4, sRy: 0.25, eR: -0.25, hRx: 1.55, hRz: 0.8, torsoY: 0.55, torsoX: 0.42, headX: 0.1, sLx: -1.2, sLy: 0.5, eL: -1.2, lRx: -0.85, kR: 0.75, lLx: 0.6, kL: 0.2, hipsH: -0.22 }),
  ripPull: pose({ sRx: -0.7, sRy: -0.2, eR: -1.2, hRx: 1.7, torsoY: -0.35, torsoX: 0.05, sLx: 0.1, lRx: 0.2, lLx: -0.2, hipsH: -0.05 }),
};

const R = ATTACKS.riposte;
// Down on one knee, head hanging, waiting for a friend (multiplayer).
const DOWNED_TIME = 20;
const DOWNED = pose({ hipsH: -0.45, lRx: -1.4, kR: 1.7, lLx: 0.35, kL: 1.95, torsoX: 0.55, headX: 0.45, sRx: 0.2, eR: -0.6, sLx: -0.3, eL: -1.2, sLz: 0.2 });
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
const FOCUS_REGEN = 1.5; // per second, always
const BRACE = { torsoX: 0.1, headX: -0.08, lRx: 0.25, lLx: -0.35, kL: 0.35, kR: 0.15, hipsH: -0.06 };
const GUARD_KIT = new Map(); // `${stance}|${shield}` -> { guard, hit }, built on first equip

// Guard and flinch poses for a stance, with or without a shield on the left arm. With a shield the
// weapon stays cocked at rest and the shield arm comes up across the chest.
function guardPoses(stanceId, shield) {
  const key = `${stanceId}|${!!shield}`;
  if (!GUARD_KIT.has(key)) {
    const st = STANCES[stanceId];
    const guard = shield ? overlay({ ...st.rest, ...BRACE, sRx: st.rest.sRx - 0.25 }, SHIELD_GUARD, ARM_L) : st.guard;
    const hit = shield ? overlay(guardHitOf(guard), SHIELD_HIT, ARM_L) : guardHitOf(guard);
    GUARD_KIT.set(key, { guard, hit });
  }
  return GUARD_KIT.get(key);
}

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
    this.parryT = 0; // parry window left from the last fresh guard press
    this.sincePress = 99; // seconds since the guard button was last pressed
    this.guardRecoil = 0;
    this.stats = { blocks: 0, parries: 0, guardBreaks: 0, ripostes: 0, arts: 0, rites: 0 }; // session counters (tests, future feats)
    this.atkSeq = 0; // bumps on every attack start so enemies can react once per swing
    this.rip = null;
    this.riposteCandidate = null;
    // Focus feeds weapon arts and rites. Mind raises it; it refills at shrines and creeps back on its own.
    this.focus = this.maxFocus = 60;
    this.riteMult = 1;
    this.artCd = 0;
    this.riteCd = 0;
    this.act = null; // the art or rite being performed
    this.ward = null; // { t, reduce } from Ward of Ash
    this.mend = null; // { t, rate } from Mending Light
    this.wardFx = this._buildWardFx();
    this.statsRef = { strength: 10 };
    this.equip({});
    game.combat.register(this);
  }

  applyStats(stats, flasksMax) {
    this.statsRef = stats;
    this.maxHp = 100 + (stats.vigor - 10) * 9;
    this.maxStamina = 90 + (stats.endurance - 10) * 6;
    this.maxFocus = 60 + ((stats.mind ?? 10) - 10) * 6;
    this.riteMult = 1 + ((stats.mind ?? 10) - 10) * 0.06;
    this.flasksMax = flasksMax;
    this._scaleDamage();
  }

  // Strength scales each weapon by its own `scale`: heavy weapons gain the most from it.
  _scaleDamage() {
    // Hessa's smithing adds its own share on top (data/smithing.js).
    this.dmgMult = (1 + ((this.statsRef.strength ?? 10) - 10) * 0.05 * (this.weapon?.scale ?? 1)) * upgradeMult(this.game.state?.upgrades?.[this.weaponId]);
  }

  // Equips gear by id: { right: weapon, left: shield | null, rite: rite | null }. Unknown ids fall back
  // to the starting sword / empty slots, and a two-handed weapon leaves no room for a shield.
  equip({ right = STARTING_WEAPON, left = null, rite = null }) {
    this.weaponId = WEAPONS[right] ? right : STARTING_WEAPON;
    this.weapon = WEAPONS[this.weaponId];
    this.shieldId = this.weapon.hands === 1 && SHIELDS[left] ? left : null;
    this.shield = this.shieldId ? SHIELDS[this.shieldId] : null;
    this.riteId = RITES[rite] ? rite : null;
    this.rite = this.riteId ? RITES[this.riteId] : null;
    this.art = ARTS[this.weapon.art] ?? null;
    this.moves = this.weapon.moves;
    this.stance = STANCES[this.weapon.stance];
    this.guardKit = guardPoses(this.weapon.stance, this.shield);
    this.guardStats = { ...(this.shield ? this.shield.guard : this.weapon.guard) };
    equipModel(this.model, this.weaponId, this.shieldId);
    this._scaleDamage();
    // Whatever was mid-swing used the old weapon's timings: settle back to standing.
    if (['attack', 'art', 'guard'].includes(this.state)) {
      this.state = 'move';
      this.atk = null;
      this.act = null;
    }
    this.atkGuard = false;
  }

  respawn(x, z, yaw) {
    this.alive = true;
    this.frost = this.frostbite = 0;
    this.clearBurnPoison();
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.flasks = this.flasksMax;
    this.focus = this.maxFocus;
    this.artCd = this.riteCd = 0;
    this.act = null;
    this.ward = this.mend = null;
    this.wardFx.visible = false;
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
    copyPose(this.poseBuf, this.stance.rest);
    applyPose(this.model, this.poseBuf, 1);
  }

  // A thin ring of warm ash at the feet while Ward of Ash holds. Hidden (no draw call) otherwise.
  _buildWardFx() {
    const geo = new THREE.RingGeometry(0.75, 0.95, 28);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false;
    m.renderOrder = 4;
    this.game.scene.add(m);
    return m;
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
    for (const a of ['roll', 'light', 'heavy', 'flask', 'art', 'rite', 'jump']) {
      if (input.pressed(a)) this.buffer = { a, t: a === 'flask' ? 0.2 : 0.38 };
    }
    // On a gamepad, A while sprinting jumps instead of rolling.
    if (this.buffer?.a === 'roll' && input.usingPad && this.sprinting && this.state === 'move') this.buffer.a = 'jump';
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
    const def = name === 'mounted' ? MOUNTED : this.moves[name] ?? this.moves.light1;
    this.stamina = Math.max(0, this.stamina - def.stamina);
    this.staminaDelay = 0.75;
    this.state = this.mounted ? 'mounted' : 'attack';
    this.atkSeq++;
    this.atkGuard = false;
    this.atk = def;
    this.atkT = 0;
    this.t = 0;
    this.hitSet = new Set();
    this.swung = false;
    this.hit = { dmg: def.dmg * this.dmgMult, poise: def.poise, reach: def.reach, arc: def.arc, heavy: def.heavy, height: def.height, yawOffset: def.yawOffset, frost: def.frost ?? WEAPONS[this.weaponId]?.frost, burn: def.burn ?? WEAPONS[this.weaponId]?.burn, poison: def.poison ?? WEAPONS[this.weaponId]?.poison };
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
    this.kickUp(0.8);
    return true;
  }

  // A jump: carries your running speed; an attack pressed in the air becomes a plunging blow that
  // comes straight down and lands in a small shockwave (heavy weapons hit harder and wider).
  startJump(mi) {
    if (this.stamina <= 0 || !this.onGround || this.mounted) return false;
    this.stamina = Math.max(0, this.stamina - 14);
    this.staminaDelay = 0.6;
    this.state = 'jump';
    this.t = 0;
    this.plunge = false;
    this.vy = 8.2;
    this.onGround = false;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (mi.mag > 0 && sp < 3) { this.vel.x = mi.x * 3; this.vel.z = mi.z * 3; }
    this.game.audio.play('roll');
    return true;
  }

  _jump(dt, mi) {
    // A little air control, no more.
    if (mi.mag > 0) {
      this.vel.x += mi.x * 4 * dt;
      this.vel.z += mi.z * 4 * dt;
      this.yaw = dampAngle(this.yaw, Math.atan2(mi.x, mi.z), 4, dt);
    }
    if (!this.plunge && (this._take('light') || this._take('heavy')) && this.stamina > 0) {
      this.plunge = true;
      this.plungeT = this.t;
      this.vy = Math.min(this.vy, -4);
      this.stamina = Math.max(0, this.stamina - 16);
      this.game.audio.play('heavySwing');
    }
    if (this.plunge) this.vy = Math.min(this.vy, -18);
    if (this.t > 0.08 && this.onGround) {
      if (this.plunge) {
        const g = this.game, w = this.weapon;
        const big = (w.hands ?? 1) > 1;
        const f = { x: this.pos.x + this.forwardX * 1.2, y: this.pos.y + 0.8, z: this.pos.z + this.forwardZ * 1.2 };
        const hit = { dmg: w.moves.heavy.dmg * 1.15 * this.dmgMult, poise: w.moves.heavy.poise * 1.2, heavy: true, frost: w.frost, burn: w.burn, poison: w.poison };
        g.combat.sphere(this, f, big ? 2.6 : 1.9, hit, new Set());
        g.effects.shockwave(this, f.x, f.z, { start: 0.5, maxR: big ? 6 : 4, speed: 12, color: 0xffd9a0, hit: { dmg: 14 * this.dmgMult, poise: 30 } });
        g.audio.play('slam');
        g.cameraShake(0.3);
        g.particles.emit({ x: f.x, y: f.y - 0.6, z: f.z, count: 30, speed: 5, up: 2, color: 0x9a8d78, color2: 0xd0c4a8, life: [0.4, 0.9], size: [0.15, 0.3], gravity: 3, drag: 2.5, jitter: 0.6 });
        this.state = 'attack';
        this.atk = { ...w.moves.heavy, windup: 0, active: 0.05, recover: 0.5, lunge: 0, pose: w.moves.heavy.pose };
        this.atkT = 0;
        this.t = 0.06; // straight into the recovery of the heavy swing
        this.swung = true;
        this.hit = null;
        this.hitSet = new Set();
        this.vel.set(0, 0, 0);
      } else {
        this.state = 'move';
        this.vel.multiplyScalar(0.6);
      }
    }
  }

  // Light attack button: a riposte if an opened foe is in front of us, otherwise the given swing.
  _light(mi, name = 'light1') {
    const foe = this.findRiposteTarget();
    if (foe) return this.startRiposte(foe);
    const back = this.findBackstabTarget();
    if (back) return this.startRiposte(back, true);
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

  // A foe we stand right behind, close and facing it, that isn't mid-swing: a critical blow from behind.
  findBackstabTarget() {
    if (this.mounted) return null;
    const lock = this.game.lockTarget;
    let best = null, bestD = Infinity;
    for (const e of this.game.combat.targetsFor(this)) {
      if (!e.canBackstab?.()) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) - e.radius;
      if (d > R.reach * 0.85 || Math.abs(e.pos.y - this.pos.y) > 1.2) continue;
      if (Math.abs(angleDiff(e.yaw, Math.atan2(-dx, -dz))) < 2.35) continue; // not behind it
      if (e !== lock && Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz))) > 0.9) continue;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  startRiposte(foe, back = false) {
    if (back ? !foe.onBackstab(this) : !(foe.netPuppet ? this.game.net.coop.riposte(foe) : foe.onRiposte(this))) return false;
    this.state = 'riposte';
    this.t = 0;
    this.atk = null;
    this.rip = { target: foe, stabbed: false, struck: false, back };
    this.yaw = yawTo(this.pos.x, this.pos.z, foe.pos.x, foe.pos.z);
    this.vel.set(0, 0, 0);
    this.invuln = true;
    this.game.events.emit('riposte', foe);
    return true;
  }

  // Weapon art (C). False if it can't start; a short focus never wastes the stamina.
  startArt(mi) {
    if (this.mounted || !this.art || this.artCd > 0 || this.stamina <= 0) return false;
    if (this.focus < this.art.focus) return this._noFocus();
    this.artCd = this.art.cooldown;
    this.stamina = Math.max(0, this.stamina - (this.art.stamina ?? 0));
    this.staminaDelay = 0.8;
    this.stats.arts++;
    this.atkSeq++; // sentries may raise their shields against it like any other swing
    return this._act(this.art, 'art', mi);
  }

  // Cast the equipped rite (V).
  startRite(mi) {
    if (this.mounted) return false;
    if (!this.rite) {
      this.game.hud.toast('No rite is prepared. Choose one in your equipment (I).');
      return false;
    }
    if (this.riteCd > 0) return false;
    if (this.focus < this.rite.focus) return this._noFocus();
    this.riteCd = this.rite.cooldown;
    this.stats.rites++;
    return this._act(this.rite, 'rite', mi);
  }

  _noFocus() {
    this.game.events.emit('noFocus');
    this.game.audio.play('noFocus');
    this.game.hud.flashFocus();
    return false;
  }

  _act(def, kind, mi) {
    this.focus -= def.focus;
    this.state = 'art';
    this.t = 0;
    this.atk = null;
    this.atkGuard = false;
    const rest = this.stance.rest;
    this.act = {
      def, kind, next: 0,
      keys: def.keys.map(([t, n]) => [t, n === 'rest' ? rest : def.overlay ? overlay(rest, MOVE_POSES[n], ARM_L) : MOVE_POSES[n]]),
    };
    const lock = this.game.lockTarget;
    if (lock) this.yaw = yawTo(this.pos.x, this.pos.z, lock.pos.x, lock.pos.z);
    else if (mi.mag > 0) this.yaw = Math.atan2(mi.x, mi.z);
    this.game.events.emit(kind === 'art' ? 'weaponArt' : 'rite', def);
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
  // A spear thrust made from behind a shield (atkGuard) still blocks, but can't parry.
  _guardOutcome(hit) {
    const guarding = this.state === 'guard' || (this.state === 'attack' && this.atkGuard);
    if (!guarding || hit.unblockable) return null;
    const gs = this.guardStats;
    if (Math.abs(angleDiff(this.yaw, Math.atan2(-hit.dirX, -hit.dirZ))) > gs.arc) return null;
    if (this.state !== 'guard') return 'block';
    if (hit.parryable && gs.parryWindow > 0 && this.parryT > 0) return 'parry';
    return this.t >= gs.raiseTime ? 'block' : null;
  }

  _parry(hit) {
    this.parryT = 0;
    this.guardRecoil = 0.16;
    this.stats.parries++;
    if (hit.attacker?.netPuppet) this.game.net.coop.parried(hit.attacker);
    else hit.attacker?.onParried(this, hit);
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
    const dmg = (hit.dmg * (1 - gs.absorb) + hit.dmg * gs.absorb * (1 - covered)) * this._wardMult();
    if (!this.god) this.hp -= dmg;
    this.game.events.emit('playerHurt', { ...hit, dmg, blocked: true });
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }
    const k = hit.knock ?? (hit.heavy ? 4.5 : 2.4);
    if (covered < 1) {
      this.atkGuard = false;
      this.state = 'guardbreak';
      this.t = 0;
      this.vel.set(hit.dirX * k * 1.3, 0, hit.dirZ * k * 1.3);
      this.stats.guardBreaks++;
      this.game.events.emit('guardBreak', hit.attacker);
      return 'break';
    }
    this.guardRecoil = hit.heavy ? 0.4 : 0.22;
    this.vel.set(hit.dirX * k, 0, hit.dirZ * k);
    // A thorned shield poisons whatever strikes it up close.
    const a = hit.attacker;
    if (gs.thorns && a?.addPoison && a.pos && Math.hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z) < 6) a.addPoison(gs.thorns);
    this.stats.blocks++;
    return 'block';
  }

  takeHit(hit) {
    if (!this.alive || this.invuln) return false;
    const guard = this._guardOutcome(hit);
    if (guard === 'parry') return this._parry(hit);
    if (guard === 'block') return this._block(hit);
    const dmg = hit.dmg * this._wardMult();
    if (!this.god) this.hp -= dmg;
    this.game.events.emit('playerHurt', { ...hit, dmg });
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
      // Which way the blow pushed, in the body's own frame (the hurt pose reels away from it).
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      this.hurtFwd = (hit.dirX ?? 0) * fx + (hit.dirZ ?? 0) * fz;
      this.hurtSide = (hit.dirX ?? 0) * fz - (hit.dirZ ?? 0) * fx;
      const k = hit.knock ?? (hit.heavy ? 7 : 3.5);
      this.vel.set(hit.dirX * k, 0, hit.dirZ * k);
      this.atk = null;
      this.act = null;
      this.atkGuard = false;
      this.model.flask.visible = false;
    }
    return true;
  }

  _wardMult() {
    return this.ward ? 1 - this.ward.reduce : 1;
  }

  die() {
    // In a shared Vale with a friend close by you go down instead, and they can lift you up again.
    if (this.state !== 'downed' && this.game.canBeDowned?.()) {
      this.alive = false;
      this.act = null;
      this.ward = this.mend = null;
      this.wardFx.visible = false;
      this.state = 'downed';
      this.t = 0;
      this.downT = DOWNED_TIME;
      this.vel.set(0, 0, 0);
      this.model.flask.visible = false;
      this.game.onPlayerDowned();
      return;
    }
    this.alive = false;
    this.act = null;
    this.ward = this.mend = null;
    this.wardFx.visible = false;
    this.state = 'dead';
    this.t = 0;
    this.vel.set(0, 0, 0);
    this.model.flask.visible = false;
    this.game.onPlayerDeath();
  }

  // Lava scalds whoever wades in it, and soon sets them alight.
  _lava(dt) {
    const w = this.game.world;
    this.inLava = w.isLava(this.pos.x, this.pos.z) && this.pos.y < w.lavaLevelAt(this.pos.x, this.pos.z) + 0.6;
    if (!this.inLava) { this.lavaAcc = 0; return; }
    this.addBurn(70 * dt);
    this.lavaAcc = (this.lavaAcc ?? 0) + 26 * dt;
    if (Math.random() < dt * 20) this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 0.3, z: this.pos.z, count: 2, speed: 1, up: 3, color: 0xff6a1a, color2: 0xffd060, life: [0.3, 0.7], size: [0.08, 0.16], jitter: 0.4 });
    if (this.lavaAcc >= 5) {
      const dmg = this.lavaAcc;
      this.lavaAcc = 0;
      this.takeHit({ dmg, poise: 0, dirX: 0, dirZ: 0, unblockable: true, status: 'lava' });
    }
  }

  // ---------- update ----------

  // A friend lifts you up: back on your feet with some of your health, untouchable for a moment.
  revive() {
    if (this.state !== 'downed') return false;
    this.alive = true;
    this.hp = Math.round(this.maxHp * 0.4);
    this.state = 'move';
    this.t = 0;
    this.graceT = 2;
    this.downT = 0;
    return true;
  }

  update(dt) {
    this.t += dt;
    if (this.state === 'downed') {
      // Down, waiting for a friend: give in with E, or bleed out.
      this.downT -= dt;
      const give = this.game.input.pressed('interact') && this.t > 1;
      if (this.downT <= 0 || give) {
        if (give) this.game.input.consume('interact');
        this.state = 'dead';
        this.t = 0;
        this.game.onPlayerDeath();
      }
    }
    if (!this.alive) {
      this.vel.multiplyScalar(Math.exp(-6 * dt));
      this.integrate(dt);
      this._animate(dt, 0);
      return;
    }
    this.tickFrost(dt);
    this._lava(dt);
    this._readBuffer(dt);
    this._guardTimers(dt);
    this._focusAndBuffs(dt);
    if ((this.poiseTimer -= dt) <= 0) this.poise = this.maxPoise;
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else if (!this.sprinting) this.stamina = Math.min(this.maxStamina, this.stamina + 50 * dt * (this.state === 'guard' ? GUARD_REGEN : 1));

    const mi = this.moveIntent();
    const lock = this.game.lockTarget;
    this.sprinting = false;
    this.invuln = false;
    if (this.graceT > 0) { this.graceT -= dt; this.invuln = true; }

    switch (this.state) {
      case 'move': this._move(dt, mi, lock); break;
      case 'roll': this._roll(dt, mi); break;
      case 'jump': this._jump(dt, mi); break;
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
      case 'art': this._art(dt, mi, lock); break;
      case 'emote':
        // Moving, rolling, attacking or guarding ends it; otherwise it plays out (a sit holds).
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        if (this._startEmote()) break; // another emote replaces it
        if (mi.mag > 0 || this.game.input.held('guard') || ['roll', 'light', 'heavy', 'art', 'rite', 'flask'].some((a) => this.game.input.pressed(a)) || (!this.emote.hold && this.t >= this.emote.time)) {
          this.state = 'move';
          this._move(dt, mi, lock);
        }
        break;
    }
    const s = this.state;
    this.riposteCandidate = s === 'move' || s === 'guard' || s === 'attack' ? this.findRiposteTarget() ?? this.findBackstabTarget() : null;

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

  // Focus creeps back, cooldowns run down, and the ward and mending tick.
  _focusAndBuffs(dt) {
    this.focus = Math.min(this.maxFocus, this.focus + FOCUS_REGEN * dt);
    if (this.artCd > 0) this.artCd -= dt;
    if (this.riteCd > 0) this.riteCd -= dt;
    const g = this.game;
    if (this.mend) {
      this.hp = Math.min(this.maxHp, this.hp + this.mend.rate * dt);
      if (Math.random() < dt * 14) g.particles.emit({ x: this.pos.x, y: this.pos.y + 0.3 + Math.random() * 1.4, z: this.pos.z, count: 1, speed: 0.3, up: 1.4, color: 0xffe08a, color2: 0xfff6c8, life: [0.6, 1.1], size: [0.06, 0.12], jitter: 0.45, drag: 1 });
      if ((this.mend.t -= dt) <= 0) this.mend = null;
    }
    const fx = this.wardFx;
    if (this.ward) {
      const left = (this.ward.t -= dt);
      fx.visible = true;
      fx.position.set(this.pos.x, this.pos.y + 0.06, this.pos.z);
      fx.rotation.y += dt * 1.5;
      // Flickers in its last two seconds so you know it is about to fail.
      fx.material.opacity = left < 2 ? 0.25 + 0.3 * Math.abs(Math.sin(left * 9)) : 0.5 + Math.sin(g.time * 3) * 0.08;
      if (Math.random() < dt * 10) {
        const a = Math.random() * Math.PI * 2;
        g.particles.emit({ x: this.pos.x + Math.sin(a) * 0.85, y: this.pos.y + 0.15, z: this.pos.z + Math.cos(a) * 0.85, count: 1, speed: 0.2, up: 1.1, color: 0xcfc2a8, color2: 0xffe0a0, life: [0.6, 1.2], size: [0.05, 0.1], drag: 0.6 });
      }
      if (left <= 0) {
        this.ward = null;
        fx.visible = false;
      }
    }
  }

  _move(dt, mi, lock) {
    const input = this.game.input;
    if (this._take('jump') && this.startJump(mi)) return;
    if (this._take('roll') && this.startRoll(mi)) return;
    if (this._take('light') && this._light(mi)) return;
    if (this._take('heavy') && this.startAttack('heavy', mi)) return;
    if (this._take('art') && this.startArt(mi)) return;
    if (this._take('rite') && this.startRite(mi)) return;
    if (this._take('flask') && this.startHeal()) return;
    if (input.held('guard')) { this._raiseGuard(); return; }
    if (this.onGround && mi.mag === 0 && this._startEmote()) return;

    const moving = mi.mag > 0;
    if (input.held('sprint') && moving && this.stamina > 1 && !this.winded) {
      this.sprinting = true;
      this.stamina -= 14 * dt;
      this.staminaDelay = 0.5;
      if (this.stamina <= 0) this.winded = true;
    }
    if (this.winded && this.stamina > 25) this.winded = false;
    let speed = this.sprinting ? 7.4 : lock ? 3.8 : 4.6;
    if (this.game.world.isWater(this.pos.x, this.pos.z) || this.inLava) speed *= 0.55;
    speed *= this.frostSlow;
    this.vel.x = damp(this.vel.x, mi.x * speed, 12, dt);
    this.vel.z = damp(this.vel.z, mi.z * speed, 12, dt);
    if (lock && !this.sprinting) this.yaw = dampAngle(this.yaw, yawTo(this.pos.x, this.pos.z, lock.pos.x, lock.pos.z), 14, dt);
    else if (moving) this.yaw = dampAngle(this.yaw, Math.atan2(mi.x, mi.z), 12, dt);
  }

  // Starts the emote whose key was just pressed, if any.
  _startEmote() {
    const input = this.game.input;
    for (const name in EMOTES) {
      if (!input.pressed(name)) continue;
      input.consume(name);
      this.state = 'emote';
      this.t = 0;
      this.emote = EMOTES[name];
      this.emoteKeys = this.emote.keys.map(([t, p]) => [t, p ?? this.stance.rest]);
      return true;
    }
    return false;
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
      if (d.next && t >= ta + 0.04 && this._take('light')) {
        const keep = this.atkGuard && this.game.input.held('guard');
        this._light(mi, d.next);
        if (keep && this.state === 'attack') this.atkGuard = true;
        return;
      }
      if (t >= ta + 0.1 && this._take('heavy')) { this.startAttack('heavy', mi); return; }
      if (t >= ta + 0.1 && this.buffer?.a === 'art' && this.startArt(mi)) { this.buffer = null; return; }
      if (t >= ta + 0.1 && this.buffer?.a === 'rite' && this.startRite(mi)) { this.buffer = null; return; }
      if (t >= ta + d.recover * 0.3 && this._take('roll')) { this.state = 'move'; this.startRoll(mi); return; }
    }
    if (t >= tr) {
      // A thrust from behind the shield drops straight back into the guard.
      if (this.atkGuard && this.game.input.held('guard')) {
        this._raiseGuard();
        this.t = this.guardStats.raiseTime;
      } else this.state = 'move';
      this.atkGuard = false;
    }
  }

  _guard(dt, mi, lock) {
    const input = this.game.input;
    if (this._take('roll') && this.startRoll(mi)) return;
    if (this._take('light')) {
      // Spear and shield: thrust from behind the raised shield instead of lowering it.
      if (this.weapon.guardAttack && this.shield && !this.findRiposteTarget()) {
        if (this.startAttack('light1', mi)) { this.atkGuard = true; return; }
      } else if (this._light(mi)) return;
    }
    if (this._take('heavy') && this.startAttack('heavy', mi)) return;
    if (this._take('art') && this.startArt(mi)) return;
    if (this._take('rite') && this.startRite(mi)) return;
    if (this._take('flask') && this.startHeal()) return;
    if (!input.held('guard')) { this.state = 'move'; return; }
    if (this.guardRecoil > 0) {
      this.vel.multiplyScalar(Math.exp(-7 * dt)); // ride out the knockback of the blocked blow
    } else {
      const speed = (this.guardStats.speed ?? GUARD_SPEED) * (this.game.world.isWater(this.pos.x, this.pos.z) ? 0.55 : 1);
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
      const wr = this.weapon.riposte ?? {};
      const k = r.back ? 0.85 : 1; // from behind: a little less than a riposte
      if (foe.alive && g.combat.strike(this, foe, { dmg: (wr.dmg ?? R.dmg) * (wr.crit ?? R.crit) * k * this.dmgMult, poise: 0, heavy: true, riposte: true })) {
        g.audio.play('riposte');
        g.cameraShake(0.5);
        g.hitstop = Math.max(g.hitstop, 0.14);
        if (r.back) this.stats.backstabs = (this.stats.backstabs ?? 0) + 1;
        else this.stats.ripostes++;
      }
    }
    if (t >= R.time) {
      this.state = 'move';
      this.rip = null;
    }
  }

  // Weapon arts and rites: a scripted action driven by its data (see data/abilities.js).
  _art(dt, mi, lock) {
    const a = this.act, d = a.def, t = this.t;
    if (d.invuln) this.invuln = t >= d.invuln[0] && t < d.invuln[1];
    if (lock && t < (d.track ?? 0)) this.turnTo(yawTo(this.pos.x, this.pos.z, lock.pos.x, lock.pos.z), 10, dt);
    // Events first, so a move() that reads what an event set up sees it on the same frame.
    while (a.next < d.events.length && t >= d.events[a.next][0]) {
      d.events[a.next++][1](this, a);
      if (this.state !== 'art' || this.act !== a) return; // the event ended it (a death, a reset)
    }
    if (d.move) d.move(this, a, dt);
    else {
      const sp = d.walk ?? 0;
      this.vel.x = damp(this.vel.x, mi.x * sp, 10, dt);
      this.vel.z = damp(this.vel.z, mi.z * sp, 10, dt);
    }
    if (d.cancel !== undefined && t >= d.cancel && this._take('roll')) {
      this.state = 'move';
      this.act = null;
      this.startRoll(mi);
      return;
    }
    if (t >= d.time) {
      this.state = 'move';
      this.act = null;
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
    if (amp > 0.2 && step !== this.lastStep) {
      this.game.audio.play('step');
      if (Math.hypot(this.vel.x, this.vel.z) > 4.5) this.kickUp(0.5);
    }
    this.lastStep = step;
  }

  // A puff from the ground underfoot, in the colour of what you're running on (or a splash in water).
  kickUp(k = 1) {
    const g = this.game, w = g.world, x = this.pos.x, z = this.pos.z, y = w.getHeight(x, z);
    if (w.isWater(x, z)) {
      g.particles.emit({ x, y: Math.max(y, this.pos.y) + 0.1, z, count: Math.round(8 * k), speed: 1.6, up: 2.4, gravity: 9, color: 0xd8f0ff, color2: 0xffffff, life: [0.3, 0.6], size: [0.06, 0.12], drag: 1 });
      return;
    }
    const r = w.regionAt(x, z);
    const SURF = { rime: [0xf0f4f8, 0xd8e4ec], dunes: [0xe8c890, 0xc8a060], coast: [0xe0d0a8, 0xc8b890], cinder: [0x6a625a, 0x3a3634], amber: [0xc8742e, 0xa8442a], shard: [0xd8d0e8, 0xb8a8e0], glow: [0x6a5a8a, 0x5ef0d8], bell: [0xa8a0a8, 0x8a8490], fen: [0x6a6a5a, 0x4a4a40], crypt: [0x5a5650, 0x3a3632], storm: [0x7a7e86, 0x5a5e66] };
    const [c1, c2] = SURF[r] ?? [0xa89a78, 0x8a7a5a];
    g.particles.emit({ x, y: y + 0.1, z, count: Math.round(6 * k), speed: 0.8, up: 0.9, gravity: 2, color: c1, color2: c2, life: [0.4, 0.8], size: [0.08, 0.18], drag: 2, jitter: 0.25 });
  }

  // Small things layered on whatever the body is doing, so it never stands like a statue: breathing
  // (panting when winded), weight shifting from foot to foot and a glance around when idle, leaning
  // into turns, squashing on a hard landing, hunching when badly hurt.
  _layers(p, dt, speed) {
    const st = this.state, time = this.game.time;
    const upright = st === 'move' || st === 'guard';
    // Turning: lean into it, head first.
    const rate = angleDiff(this.lastYaw ?? this.yaw, this.yaw) / Math.max(dt, 1e-4);
    this.lastYaw = this.yaw;
    this.turnLean = damp(this.turnLean ?? 0, clamp(rate * speed * 0.014, -0.24, 0.24), 8, dt);
    if (upright || st === 'attack') {
      p.torsoZ -= this.turnLean;
      p.hipsZ -= this.turnLean * 0.4;
      p.headY += clamp(rate * 0.05, -0.3, 0.3);
    }
    if (upright) {
      const still = 1 - clamp(speed / 1.2, 0, 1);
      this.pant = damp(this.pant ?? 0, this.winded || this.stamina < this.maxStamina * 0.25 ? 1 : 0, 1.5, dt);
      this.breath = (this.breath ?? 0) + dt * (1.6 + this.pant * 2.8);
      const b = Math.sin(this.breath);
      p.torsoX += b * (0.016 + this.pant * 0.035) + this.pant * 0.14 * still;
      p.headX -= b * 0.012 + this.pant * 0.06 * still;
      p.sRz -= b * 0.02 * still;
      p.sLz += b * 0.02 * still;
      if (st === 'move' && still > 0.3) {
        // Weight from one foot to the other, and now and then a look around.
        const w = Math.sin(time * 0.42 + 1.3) * still;
        p.hipsZ += w * 0.045;
        p.kR += Math.max(0, w) * 0.16;
        p.kL += Math.max(0, -w) * 0.16;
        const glance = clamp((Math.sin(time * 0.17) - 0.55) * 3, 0, 1);
        p.headY += Math.sin(time * 0.6) * 0.45 * glance * still;
      }
      // Badly hurt: a hunch, and the off arm held in.
      const low = clamp(1 - this.hp / (this.maxHp * 0.3), 0, 1);
      if (low > 0) {
        p.torsoX += low * 0.16;
        p.headX += low * 0.04;
        if (!this.shield) { p.sLx -= low * 0.3; p.eL -= low * 0.6; }
      }
      // Poisoned: a sick sway. Burning: beating at the flames.
      if (this.poisoned > 0) p.torsoZ += Math.sin(time * 1.7) * 0.06;
      if (this.burning > 0 && st === 'move') { p.sLx -= 0.4 + Math.abs(Math.sin(time * 11)) * 0.5; p.eL -= 0.8; }
    }
    // A hard landing: knees give and the body drops, then springs back.
    if (this.landAt && time - this.landAt < 0.4 && this.landV > 5) {
      const u = 1 - (time - this.landAt) / 0.4, k = clamp((this.landV - 5) / 10, 0.25, 1) * u * u;
      p.hipsH -= 0.16 * k;
      p.kR += 0.7 * k;
      p.kL += 0.7 * k;
      p.lRx -= 0.35 * k;
      p.lLx -= 0.35 * k;
      p.torsoX += 0.25 * k;
    }
  }

  _animate(dt, speed) {
    const r = this.model;
    const p = this.poseBuf;
    let k = dampK(14, dt);
    let pivotOverride = null;
    switch (this.state) {
      case 'move': {
        copyPose(p, this.sprinting ? this.stance.sprint : this.stance.rest);
        const amp = clamp(speed / 6.5, 0, 1.1);
        this.gait += dt * (2.2 + speed * 1.35);
        addGait(p, this.gait, amp, 0.5);
        p.torsoX += Math.sin(this.game.time * 2) * 0.02;
        this._footsteps(amp);
        break;
      }
      case 'guard': {
        copyPose(p, this.guardRecoil > 0 ? this.guardKit.hit : this.guardKit.guard);
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
        if (u >= 1) copyPose(p, this.stance.rest);
        k = dampK(24, dt);
        break;
      }
      case 'jump': {
        // Knees up at the top of the jump, legs reaching for the ground on the way down; a plunge
        // holds the weapon high to drive it down.
        if (this.plunge) {
          const [wind] = MOVE_POSES[this.weapon.moves.heavy.pose];
          copyPose(p, wind);
          p.lRx -= 0.5; p.kR += 0.8; p.lLx -= 0.3; p.kL += 0.6;
        } else {
          copyPose(p, this.stance.rest);
          const up = clamp(this.vy / 8, -1, 1);
          p.lRx -= 0.7 + up * 0.3; p.kR += 1.1 + up * 0.3;
          p.lLx -= 0.2; p.kL += 0.5 + up * 0.4;
          p.sLx -= 0.5; p.sLz += 0.4; p.eL -= 0.3;
          p.torsoX += 0.15 - up * 0.1;
        }
        k = dampK(16, dt);
        break;
      }
      case 'backstep':
        copyPose(p, POSES.backstep);
        p.hipsH = Math.sin(clamp(this.t / BACKSTEP_TIME, 0, 1) * Math.PI) * 0.12;
        k = dampK(20, dt);
        break;
      case 'attack': {
        const d = this.atk;
        const [wind, strike] = MOVE_POSES[d.pose];
        attackPose(p, this.stance.rest, wind, strike, this.t, d.windup, d.active, d.recover, easeOut);
        if (this.atkGuard) for (const j of ARM_L) p[j] = SHIELD_GUARD[j]; // the shield stays up
        k = dampK(32, dt);
        break;
      }
      case 'art': {
        framePose(p, this.act.keys, this.t, easeInOut);
        const amp = clamp(speed / 3, 0, 0.5);
        if (amp > 0.05) addGait(p, (this.gait += dt * (2.2 + speed * 1.8)), amp, 0);
        k = dampK(28, dt);
        break;
      }
      case 'mounted': {
        copyPose(p, POSES.riding);
        if (this.atk) {
          const d = this.atk;
          const [wind, strike] = POSES.mountedSwing;
          attackPose(p, POSES.riding, { ...POSES.riding, ...pick(wind) }, { ...POSES.riding, ...pick(strike) }, this.atkT, d.windup, d.active, d.recover, easeOut);
          k = dampK(30, dt);
        }
        p.torsoX += clamp((this.horse?.speed ?? 0) / 18, 0, 1) * 0.25;
        break;
      }
      case 'emote':
        framePose(p, this.emoteKeys, Math.min(this.t, this.emote.time), easeInOut);
        k = dampK(14, dt);
        break;
      case 'heal': copyPose(p, POSES.heal); break;
      case 'hurt': {
        copyPose(p, POSES.hurt);
        // Reel away from the blow: thrown back by one from the front, pitched forward by one from
        // behind, twisted by one from the side. Heavier blows hit harder and settle slower.
        const f = this.hurtFwd ?? -1, sd = this.hurtSide ?? 0, u = Math.max(0, 1 - this.t / (this.hurtDur ?? 0.45));
        p.torsoX += f * 0.35 * u + (f > 0 ? 0.25 : 0);
        p.torsoZ += sd * 0.35 * u;
        p.torsoY += sd * 0.3 * u;
        p.headX += f * 0.25 * u;
        p.hipsH -= 0.08 * u;
        k = dampK(this.t < 0.08 ? 34 : 14, dt);
        break;
      }
      case 'fog': copyPose(p, POSES.fog); addGait(p, (this.gait += dt * 5), 0.35); break;
      case 'dead': copyPose(p, POSES.dead); k = dampK(5, dt); break;
      case 'downed':
        copyPose(p, DOWNED);
        p.torsoX += Math.sin(this.t * 2.2) * 0.04; // laboured breathing
        k = dampK(6, dt);
        break;
    }
    this._layers(p, dt, speed);
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
