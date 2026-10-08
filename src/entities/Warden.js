// Odran, the Bell-Warden: the Vale's first great foe, keeper of the Shattered Gate.
// Phase 1: maul sweeps, a delayed overhead slam with a shockwave, and a leaping strike.
// Phase 2 (below half health): faster, toll rings you must roll through, and spectral bells from the sky.
// Guarding: the sweeps can be parried; the slam and the leap can only be blocked; anything spectral blue
// (the toll ring, the falling bells, the phase-change wave) goes through any guard and must be rolled.
import { Actor } from './Actor.js';
import { buildWarden } from '../models/characters.js';
import { ARENA } from '../data/world.js';
import { pose, copyPose, applyPose, attackPose, addGait, mixPose } from '../models/pose.js';
import { clamp, damp, dampK, yawTo, easeOut, easeInOut } from '../core/math.js';
import * as THREE from '../lib/three.js';

const MOVES = {
  sweep: { windup: 0.85, active: 0.26, recover: 0.75, dmg: 30, poise: 60, reach: 5.8, arc: 1.25, lunge: 6, track: 2.6, pose: 'sweep', range: [0, 6.5], weight: 3, follow: 'backsweep', followChance: [0.45, 0.7] },
  backsweep: { windup: 0.42, active: 0.24, recover: 0.85, dmg: 28, poise: 50, reach: 5.8, arc: 1.25, lunge: 4, track: 3.4, pose: 'backsweep', follow: 'slam', followChance: [0.2, 0.6] },
  slam: { windup: 1.1, hold: 0.4, active: 0.16, recover: 1.05, dmg: 44, poise: 90, heavy: true, parryable: false, reach: 5.0, arc: 0.55, lunge: 3, track: 3.2, pose: 'slam', range: [0, 6], weight: 2, shockwave: { maxR: 10, speed: 13, dmg: 18 } },
  leap: { windup: 0.6, air: 0.9, active: 0.15, recover: 1.15, dmg: 40, poise: 90, heavy: true, pose: 'leap', range: [8, 26], weight: 2.4, aoe: 3.6, track: 4 },
  toll: { windup: 1.35, active: 0.15, recover: 1.0, pose: 'toll', range: [0, 14], weight: 2, phase: 2, ring: { maxR: 22, speed: 12, dmg: 30 }, track: 2, unblockable: true },
  bells: { windup: 0.95, active: 0.2, recover: 0.9, pose: 'summon', range: [4, 30], weight: 1.6, phase: 2, count: 5, track: 3, unblockable: true },
};

const W = {
  stance: pose({ torsoX: 0.3, headX: -0.25, sRx: -0.35, eR: -0.7, hRx: 1.45, sLx: -0.45, eL: -0.6, sLy: -0.3, hipsH: -0.05 }),
  sweep: [pose({ torsoY: -0.9, sRx: -1.25, sRy: -1.6, eR: -0.2, hRx: 1.35, sLx: -0.6, torsoX: 0.15, hipsH: -0.15 }),
    pose({ torsoY: 0.85, sRx: -1.25, sRy: 1.25, eR: -0.1, hRx: 1.3, torsoX: 0.2, hipsH: -0.15, sLx: 0.2 })],
  backsweep: [pose({ torsoY: 0.9, sRx: -1.25, sRy: 1.35, eR: -0.1, hRx: 1.3, torsoX: 0.15, hipsH: -0.12 }),
    pose({ torsoY: -0.85, sRx: -1.25, sRy: -1.5, eR: -0.2, hRx: 1.35, torsoX: 0.2, hipsH: -0.15, sLx: -0.4 })],
  slam: [pose({ sRx: -3.0, eR: -0.5, hRx: 1.1, sLx: -2.8, eL: -0.4, torsoX: -0.25, headX: -0.3, hipsH: 0.05 }),
    pose({ sRx: -0.75, eR: -0.1, hRx: 1.45, sLx: -0.85, torsoX: 0.65, hipsH: -0.35, lRx: -0.5, kR: 0.6, lLx: 0.3, kL: 0.5 })],
  crouch: pose({ hipsH: -0.4, torsoX: 0.6, lRx: -0.6, kR: 1.0, lLx: -0.6, kL: 1.0, sRx: -0.4, eR: -0.4, hRx: 1.3, sLx: -0.3 }),
  air: pose({ sRx: -3.0, eR: -0.5, hRx: 1.1, sLx: -2.8, eL: -0.4, torsoX: -0.2, lRx: -0.8, kR: 1.2, lLx: -0.3, kL: 0.8 }),
  toll: [pose({ sRx: -3.0, eR: 0, hRx: 1.45, torsoX: -0.35, headX: -0.5, sLz: 0.9, sLx: -0.4 }),
    pose({ sRx: -0.75, eR: -0.1, hRx: 1.45, sLx: -0.85, torsoX: 0.65, hipsH: -0.35, lRx: -0.5, kR: 0.6, lLx: 0.3, kL: 0.5 })],
  summon: [pose({ sLx: -3.0, eL: -0.1, sLz: 0.2, headX: -0.55, torsoX: -0.2, sRx: -0.3, eR: -0.6, hRx: 1.45 }),
    pose({ sLx: -2.4, eL: -0.3, sLz: 0.9, headX: -0.3, torsoX: 0.1, sRx: -0.3, eR: -0.6, hRx: 1.45 })],
  roar: pose({ sRz: -1.3, sLz: 1.3, sRx: -0.4, sLx: -0.4, hRx: 1.4, torsoX: -0.35, headX: -0.6, hipsH: -0.05 }),
  kneel: pose({ hipsH: -0.6, torsoX: 0.75, lRx: -1.45, kR: 1.55, lLx: 0.25, kL: 1.6, sRx: -0.2, eR: -0.3, hRx: 1.5, sLx: -0.6, eL: -0.5, headX: 0.3 }),
  dead: pose({ hipsH: -0.6, torsoX: 0.9, lRx: -1.45, kR: 1.55, lLx: 0.25, kL: 1.6, sRz: -0.9, sLz: 0.9, headX: 0.6, pivotX: 0.35 }),
  // Parried: the maul rebounds up and back and he rocks onto his heels.
  recoil: pose({ sRx: -2.5, sRy: 0.5, sRz: -0.3, eR: -0.6, hRx: 1.2, sLx: -0.3, sLz: 0.5, torsoX: -0.4, torsoY: 0.3, headX: -0.45, hipsH: -0.08, lRx: 0.35, kR: 0.3, lLx: -0.2 }),
  // Riposted on his knees: head snapped back by the blow, then slumping.
  struck: pose({ hipsH: -0.6, torsoX: 0.2, lRx: -1.45, kR: 1.55, lLx: 0.25, kL: 1.6, sRz: -0.6, sLz: 0.7, sRx: -0.2, eR: -0.3, hRx: 1.5, headX: -0.55 }),
};

const RECOIL_TIME = 1.0;
const PARRY_STAGGER = { count: 3, within: 10, poise: 60 }; // three parries inside ten seconds force a stagger
const RIPOSTED_TIME = 2.3;
const SPECTRAL = 0x9fd0ff; // the colour that means "unblockable: roll"

const tmpV = new THREE.Vector3();

export class Warden extends Actor {
  constructor(game) {
    super(game);
    this.name = 'Odran, the Bell-Warden';
    this.model = buildWarden();
    game.scene.add(this.model.root);
    this.radius = 1.15;
    this.height = 4.0;
    this.lockHeight = 2.7;
    this.maxHp = 1050;
    this.maxPoise = 150;
    this.ash = 3200;
    this.poseBuf = pose();
    this.gait = 0;
    game.combat.register(this);
    this.reset();
  }

  reset() {
    this.pos.set(ARENA.x, this.game.world.getHeight(ARENA.x, ARENA.z - 6), ARENA.z - 6);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.hp = this.maxHp;
    this.poise = this.maxPoise;
    this.alive = true;
    this.phase = 1;
    this.state = 'dormant';
    this.lockable = false;
    this.invuln = true;
    this.t = 0;
    this.cooldown = 1.2;
    this.strafe = 1;
    this.lastMove = null;
    this.recentDmg = 0;
    this.recentT = 0;
    this.clock = 0;
    this.parryTimes = [];
    this.model.root.visible = true;
    this.model.root.scale.setScalar(2.15);
    this.model.pivot.rotation.x = 0;
    this._aura(0);
    copyPose(this.poseBuf, W.kneel);
    this.poseBuf.headX = 0.6;
    applyPose(this.model, this.poseBuf, 1);
    this._sync();
  }

  // Hide entirely (used when loading a save where the Warden is already dead).
  vanish() {
    this.alive = false;
    this.state = 'gone';
    this.lockable = false;
    this.model.root.visible = false;
  }

  // `introLen` stretches the rise to fit the opening cutscene (see core/Cutscene.js).
  awaken(introLen = 2.4) {
    this.state = 'intro';
    this.introLen = introLen;
    this.lockable = true;
    this.t = 0;
    if (introLen <= 2.4) this.game.audio.play('bell');
  }

  constrain() {
    const dx = this.pos.x - ARENA.x, dz = this.pos.z - ARENA.z;
    const d = Math.hypot(dx, dz);
    const max = ARENA.r - 2.2;
    if (d > max) {
      this.pos.x = ARENA.x + (dx / d) * max;
      this.pos.z = ARENA.z + (dz / d) * max;
    }
  }

  _aura(level) {
    this.model.headMat.emissiveIntensity = level * 1.4;
    this.model.eye.emissiveIntensity = 2.2 + level * 2.5;
    this.model.eye.emissive.setHex(level > 0 ? 0x9fd0ff : 0xff8a20);
  }

  // ---------- combat hooks ----------

  // Only his full stagger opens him to a riposte; a single parry just rocks him back.
  isOpen() {
    return this.alive && this.state === 'stagger';
  }

  onParried() {
    if (!this.alive || this.state !== 'attack') return;
    this.parryTimes = this.parryTimes.filter((t) => this.clock - t < PARRY_STAGGER.within);
    this.parryTimes.push(this.clock);
    this.poise -= PARRY_STAGGER.poise;
    this.poiseTimer = 4;
    this.vel.set(0, 0, 0);
    if (this.poise <= 0 || this.parryTimes.length >= PARRY_STAGGER.count) {
      this._stagger();
      return;
    }
    this.state = 'recoil';
    this.t = 0;
    this.game.audio.play('clang');
  }

  onRiposte(by) {
    if (!this.isOpen()) return false;
    this.state = 'riposted';
    this.t = 0;
    this.struck = false;
    this.vel.set(0, 0, 0);
    return true;
  }

  _stagger() {
    this.poise = this.maxPoise;
    this.parryTimes.length = 0;
    this.state = 'stagger';
    this.t = 0;
    this.vel.set(0, 0, 0);
    this._aura(this.phase === 2 ? 1 : 0); // drop any windup glow the stagger interrupted
    this.game.audio.play('clang');
  }

  takeHit(hit) {
    if (!this.alive || this.invuln) return false;
    const mult = this.state === 'stagger' && !hit.riposte ? 1.5 : 1;
    const dmg = hit.dmg * mult;
    this.hp -= dmg;
    if (hit.riposte) this.struck = true;
    this.recentDmg = this.recentT > 0 ? this.recentDmg + dmg : dmg;
    this.recentT = 2.2;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.lockable = false;
      this.state = 'dead';
      this.t = 0;
      this.vel.set(0, 0, 0);
      this.game.audio.play('bell');
      this.game.onBossDefeated(this);
      return true;
    }
    if (this.state !== 'stagger' && this.state !== 'phase' && this.state !== 'riposted') {
      this.poise -= hit.poise;
      this.poiseTimer = 4;
      if (this.poise <= 0) this._stagger();
    }
    return true;
  }

  update(dt) {
    if (this.state === 'gone') return;
    this.t += dt;
    this.clock += dt;
    if (this.recentT > 0) this.recentT -= dt;
    if ((this.poiseTimer -= dt) <= 0) this.poise = this.maxPoise;
    const p = this.game.player;
    const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const toP = yawTo(this.pos.x, this.pos.z, p.pos.x, p.pos.z);
    const p2 = this.phase === 2;
    let want = null;

    switch (this.state) {
      case 'dormant':
        break;
      case 'intro':
        if (this.t > (this.introLen ?? 2.4)) {
          this.state = 'engage';
          this.invuln = false;
          this.lockable = true;
          this.cooldown = 0.6;
        }
        break;
      case 'engage': {
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
          this.state = 'phase';
          this.t = 0;
          this.invuln = true;
          this.game.audio.play('roar');
          this.game.audio.play('bell');
          break;
        }
        this.turnTo(toP, p2 ? 3.3 : 2.5, dt);
        if (p.alive && (this.cooldown -= dt) <= 0) {
          const m = this._pick(dist);
          if (m) { this._start(m); break; }
        }
        if (!p.alive) { want = { x: 0, z: 0 }; break; }
        const sp = p2 ? 4.3 : 3.3;
        if (dist > 7) want = { x: Math.sin(toP) * sp, z: Math.cos(toP) * sp };
        else if (dist < 3.2) want = { x: -Math.sin(toP) * 1.6, z: -Math.cos(toP) * 1.6 };
        else {
          if (Math.random() < dt * 0.4) this.strafe *= -1;
          const side = toP + (Math.PI / 2) * this.strafe;
          want = { x: Math.sin(side) * 1.6, z: Math.cos(side) * 1.6 };
        }
        break;
      }
      case 'attack': this._attack(dt, toP, dist); break;
      case 'stagger':
        if (this.t > 2.4) { this.state = 'engage'; this.cooldown = 0.3; }
        break;
      case 'recoil':
        if (this.t > RECOIL_TIME) { this.state = 'engage'; this.cooldown = 0.35; }
        break;
      case 'riposted':
        if (this.t > RIPOSTED_TIME) { this.state = 'engage'; this.cooldown = 0.5; }
        break;
      case 'phase':
        this._aura(clamp(this.t / 1.5, 0, 1));
        if (Math.random() < 0.7) {
          this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 2.5, z: this.pos.z, count: 4, speed: 4, up: 2, color: 0x9fd0ff, color2: 0xffffff, life: [0.5, 1.2], size: [0.12, 0.28], jitter: 1.2, drag: 1.5 });
        }
        if (this.t > 1.0 && this.t - dt <= 1.0) {
          this.game.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 12, speed: 16, color: SPECTRAL, hit: { dmg: 10, poise: 30, knock: 6, unblockable: true } });
          this.game.cameraShake(0.4, 1);
        }
        if (this.t > 2.4) {
          this.phase = 2;
          this.invuln = false;
          this.state = 'engage';
          this.cooldown = 0.4;
        }
        break;
      case 'dead':
        if (this.t > 2.0 && this.t < 5.5) {
          for (let i = 0; i < 3; i++) {
            this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 0.5 + Math.random() * 3.5, z: this.pos.z, count: 2, speed: 0.8, up: 2.5, color: 0xffc070, color2: 0x9fd0ff, life: [1, 2], size: [0.1, 0.24], jitter: 1.4, drag: 0.8 });
          }
          this.model.root.scale.setScalar(2.15 * (1 - clamp((this.t - 2.5) / 3, 0, 1) * 0.15));
        }
        if (this.t > 5.5) this.model.root.visible = false;
        break;
    }

    if (want) {
      this.vel.x = damp(this.vel.x, want.x, 6, dt);
      this.vel.z = damp(this.vel.z, want.z, 6, dt);
    } else if (this.state !== 'attack') {
      this.vel.multiplyScalar(Math.exp(-8 * dt));
    }
    if (this.state !== 'dormant' && !(this.state === 'attack' && this.move.airborne)) this.integrate(dt);
    this._animate(dt);
  }

  _pick(dist) {
    const opts = [];
    let total = 0;
    for (const [name, m] of Object.entries(MOVES)) {
      if (!m.range || (m.phase && m.phase > this.phase)) continue;
      if (dist < m.range[0] || dist > m.range[1]) continue;
      const w = m.weight * (name === this.lastMove ? 0.35 : 1);
      opts.push([name, w]);
      total += w;
    }
    if (!opts.length) return null;
    let r = Math.random() * total;
    for (const [name, w] of opts) if ((r -= w) <= 0) return name;
    return opts[opts.length - 1][0];
  }

  _start(name) {
    const m = MOVES[name];
    const speed = this.phase === 2 ? 0.87 : 1;
    const hold = m.hold ? Math.random() * m.hold : 0;
    this.move = { ...m, name, windup: m.windup * speed + hold, recover: m.recover * speed, airborne: false };
    this.hit = { dmg: m.dmg, poise: m.poise, reach: m.reach, arc: m.arc, heavy: m.heavy, parryable: m.parryable };
    this.hitSet = new Set();
    this.state = 'attack';
    this.t = 0;
    this.fired = false;
    this.lastMove = name;
    if (name === 'slam' || name === 'toll') this.game.audio.play('heavySwing');
  }

  _attack(dt, toP, dist) {
    const m = this.move;
    const g = this.game;
    const air = m.air ?? 0;
    const tw = m.windup + air, ta = tw + m.active, tr = ta + m.recover;
    const t = this.t;
    if (t < m.windup) this.turnTo(toP, m.track, dt);
    if (m.unblockable && t < tw) this._spectralTell(t / tw);

    // Leap: launch at end of windup, arc onto where the player is heading.
    if (m.name === 'leap') {
      if (!m.airborne && t >= m.windup && t < tw) {
        const p = g.player;
        m.airborne = true;
        m.from = this.pos.clone();
        const lead = Math.min(dist, 22);
        const tx = p.pos.x + p.vel.x * 0.35, tz = p.pos.z + p.vel.z * 0.35;
        const ly = yawTo(this.pos.x, this.pos.z, tx, tz);
        this.yaw = ly;
        const reach = Math.max(0, Math.min(Math.hypot(tx - this.pos.x, tz - this.pos.z) - 2.2, lead));
        m.to = new THREE.Vector3(this.pos.x + Math.sin(ly) * reach, 0, this.pos.z + Math.cos(ly) * reach);
        g.audio.play('roll');
      }
      if (m.airborne && t < tw) {
        const u = (t - m.windup) / air;
        this.pos.x = m.from.x + (m.to.x - m.from.x) * u;
        this.pos.z = m.from.z + (m.to.z - m.from.z) * u;
        this.constrain();
        const ground = g.world.getHeight(this.pos.x, this.pos.z);
        this.pos.y = ground + Math.sin(u * Math.PI) * 6.5;
      }
      if (m.airborne && t >= tw) {
        m.airborne = false;
        this.pos.y = g.world.getHeight(this.pos.x, this.pos.z);
        g.combat.sphere(this, tmpV.set(this.pos.x + Math.sin(this.yaw) * 1.5, this.pos.y + 1, this.pos.z + Math.cos(this.yaw) * 1.5), m.aoe, this.hit, this.hitSet);
        g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 7, speed: 12, hit: { dmg: 14, poise: 30 } });
        g.audio.play('slam');
        g.cameraShake(0.5, 1);
        this._dust(this.pos.x, this.pos.z, 40);
      }
    } else {
      const lunge = t > m.windup * 0.6 && t < ta ? m.lunge ?? 0 : 0;
      const close = dist < this.radius + 1.6;
      this.vel.x = damp(this.vel.x, close ? 0 : Math.sin(this.yaw) * lunge, 10, dt);
      this.vel.z = damp(this.vel.z, close ? 0 : Math.cos(this.yaw) * lunge, 10, dt);
      if (t >= tw && t < ta && m.reach) g.combat.melee(this, this.hit, this.hitSet);
    }
    if (!m.airborne && m.name !== 'leap') this.vel.multiplyScalar(t >= ta ? Math.exp(-8 * dt) : 1);

    if (!this.fired && t >= tw) {
      this.fired = true;
      if (m.name === 'sweep' || m.name === 'backsweep') g.audio.play('heavySwing');
      if (m.shockwave) {
        const hx = this.pos.x + Math.sin(this.yaw) * 4.3, hz = this.pos.z + Math.cos(this.yaw) * 4.3;
        g.effects.shockwave(this, hx, hz, { maxR: m.shockwave.maxR, speed: m.shockwave.speed, hit: { dmg: m.shockwave.dmg, poise: 30 } });
        g.audio.play('slam');
        g.cameraShake(0.35, 1);
        this._dust(hx, hz, 30);
      }
      if (m.unblockable) this._aura(this.phase === 2 ? 1 : 0); // end the windup glow
      if (m.ring) {
        const hx = this.pos.x + Math.sin(this.yaw) * 4.3, hz = this.pos.z + Math.cos(this.yaw) * 4.3;
        g.effects.shockwave(this, this.pos.x, this.pos.z, { start: 1.5, maxR: m.ring.maxR, speed: m.ring.speed, thickness: 1.3, color: SPECTRAL, hit: { dmg: m.ring.dmg, poise: 60, heavy: true, unblockable: true } });
        g.audio.play('bell');
        g.audio.play('slam');
        g.cameraShake(0.45, 1);
        this._dust(hx, hz, 30);
      }
      if (m.count) {
        const p = g.player;
        g.audio.play('bellSmall');
        for (let i = 0; i < m.count; i++) {
          const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 2.5 + Math.random() * 4.5;
          g.effects.bellDrop(this, p.pos.x + Math.sin(a) * r, p.pos.z + Math.cos(a) * r, 1.15 + i * 0.28, { radius: 2.6, hit: { dmg: 32, poise: 60, heavy: true, unblockable: true } });
        }
      }
    }

    if (t >= tr) {
      const fc = m.followChance?.[this.phase - 1] ?? 0;
      if (m.follow && Math.random() < fc && dist < 8) {
        this._start(m.follow);
        return;
      }
      this.state = 'engage';
      this.cooldown = this.phase === 2 ? 0.25 + Math.random() * 0.7 : 0.5 + Math.random() * 0.9;
    }
  }

  // Windup tell for unblockable moves: the maul head (toll) or the raised hand (bells) gathers
  // spectral blue light, the same colour as the ring and bells, so "blue means roll".
  _spectralTell(u) {
    const g = this.game;
    this.model.headMat.emissiveIntensity = 1.4 + u * 4 + Math.sin(this.t * 30) * 0.6;
    if (Math.random() < 0.6) {
      const src = this.move.name === 'toll' ? this.model.maulHead : this.model.armL.hand;
      src.getWorldPosition(tmpV);
      g.particles.emit({ x: tmpV.x, y: tmpV.y, z: tmpV.z, count: 3, speed: 1.5 + u * 2, up: 0.6, color: SPECTRAL, color2: 0xffffff, life: [0.25, 0.5], size: [0.1, 0.22], jitter: 0.35, drag: 3 });
    }
  }

  _dust(x, z, n) {
    this.game.particles.emit({ x, y: this.game.world.getHeight(x, z) + 0.3, z, count: n, speed: 5, up: 2, color: 0x9a8d78, color2: 0xd0c4a8, life: [0.4, 1], size: [0.15, 0.35], gravity: 3, drag: 2.5, jitter: 0.8 });
  }

  _animate(dt) {
    const p = this.poseBuf;
    let k = dampK(8, dt);
    switch (this.state) {
      case 'dormant':
        copyPose(p, W.kneel);
        p.headX = 0.6 + Math.sin(this.game.time * 0.8) * 0.04;
        break;
      case 'intro': {
        const len = this.introLen ?? 2.4;
        if (len > 4) {
          // Cutscene timing: kneel, rise as the camera drops low (2.5-4.3 s), roar on the close-up (4.3-6.3 s).
          const t = this.t;
          if (t < 2.5) copyPose(p, W.kneel);
          else if (t < 4.3) mixPose(p, W.kneel, W.stance, easeInOut((t - 2.5) / 1.8));
          else if (t < 6.3) mixPose(p, W.stance, W.roar, Math.sin(((t - 4.3) / 2.0) * Math.PI));
          else copyPose(p, W.stance);
          this.model.eye.emissiveIntensity = 0.4 + clamp((t - 2.6) / 1.4, 0, 1) * 1.8;
          k = dampK(6, dt);
        } else {
          const u = clamp(this.t / 2.2, 0, 1);
          if (u < 0.55) copyPose(p, W.kneel);
          else mixPose(p, W.stance, W.roar, Math.sin(((u - 0.55) / 0.45) * Math.PI));
          k = dampK(4, dt);
        }
        break;
      }
      case 'engage': {
        copyPose(p, W.stance);
        const sp = Math.hypot(this.vel.x, this.vel.z);
        this.gait += dt * (1.4 + sp * 1.1);
        addGait(p, this.gait, clamp(sp / 4, 0, 0.8), 0.15);
        p.torsoX += Math.sin(this.game.time * 1.4) * 0.03;
        break;
      }
      case 'attack': {
        const m = this.move;
        if (m.name === 'leap') {
          if (this.t < m.windup) mixPose(p, W.stance, W.crouch, easeOut(this.t / m.windup));
          else if (this.t < m.windup + m.air) copyPose(p, W.air);
          else mixPose(p, W.slam[1], W.stance, easeInOut(clamp((this.t - m.windup - m.air - m.active) / m.recover, 0, 1)));
          k = dampK(16, dt);
        } else {
          const [wind, strike] = W[m.pose];
          attackPose(p, W.stance, wind, strike, this.t, m.windup, m.active, m.recover, easeOut);
          k = dampK(m.pose === 'sweep' || m.pose === 'backsweep' ? 20 : 14, dt);
        }
        break;
      }
      case 'stagger': copyPose(p, W.kneel); k = dampK(10, dt); break;
      case 'recoil':
        copyPose(p, W.recoil);
        k = dampK(this.t < 0.25 ? 18 : 5, dt);
        break;
      case 'riposted':
        // Knelt while the blade goes in; the impact snaps his head back, then he slumps and rises.
        copyPose(p, !this.struck ? W.kneel : this.t < RIPOSTED_TIME - 0.6 ? W.struck : W.stance);
        k = dampK(this.t < 1 ? 16 : 4, dt);
        break;
      case 'phase': copyPose(p, W.roar); k = dampK(6, dt); break;
      case 'dead': copyPose(p, W.dead); k = dampK(2.5, dt); break;
    }
    applyPose(this.model, p, k);
    this._sync();
  }

  _sync() {
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
  }
}
