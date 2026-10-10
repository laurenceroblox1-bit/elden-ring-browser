// Ashmaw, the Cinder Drake: the old drake that sleeps in the caldera under the smoking volcano, curled
// on the warm basalt. Wake it and it fights like a beast four times your height: a lunging bite
// (parryable), a sweeping river of fire breath that sets you alight, a tail spin that punishes standing
// at its flank, a wing buffet that throws you back, and fireballs that leave burning ground. Now and
// then it takes to the air, circles over you spitting fire, and dives onto where you stand.
// At half health it roars a ring of fire through any guard and the fire inside it burns hotter:
// breath twice in a row, more dives, faster recovery.
// States: idle (asleep) -> wake (the intro) -> stalk/chase <-> bite, breath, sweep, buffet, spit, fly;
// phase (the rage); plus the shared hurt/parried/riposted/knockdown/dead (Foe).
import * as THREE from '../lib/three.js';
import { Hound } from './Hound.js';
import { buildDrake } from '../models/creatures.js';
import { CALDERA } from '../data/biomes.js';
import { clamp, damp, dampK, angleDiff } from '../core/math.js';

const SIZE = 3.4;
const MOVES = {
  bite: { windup: 0.6, active: 0.3, recover: 0.6, dmg: 34, poise: 40, reach: 4.6, arc: 0.6 },
  breath: { windup: 0.95, active: 1.9, recover: 0.8, reach: 13, arc: 0.32, sweep: 0.9, dmg: 7, burn: 16 },
  sweep: { windup: 0.55, active: 0.55, recover: 0.7, dmg: 30, poise: 36, reach: 7.5, arc: 0.55 },
  buffet: { windup: 0.7, active: 0.2, recover: 0.7, wave: { maxR: 11, speed: 16, dmg: 12 } },
  spit: { windup: 0.7, recover: 0.8, dmg: 20, count: 3, fan: 0.22, speed: 19 },
  fly: { rise: 1.2, hover: 2.2, dive: 0.55, land: 1.0, height: 15 },
};
const PHASE_LENGTH = 2.6;
const MOUTH = new THREE.Vector3();

export class Drake extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a pup; swap in the drake
    this.game.combat.unregister(this);
    this.tag = 'drake';
    this.name = 'Ashmaw, the Cinder Drake';
    this.isBoss = true;
    this.bossId = 'ashmaw';
    this.flag = 'ashmawDead';
    this.music = 'fire';
    this.intro = { title: 'Old Fire of the Caldera', open: 'snarl', roar: 'roarBig', scale: 2.1, lift: 3.4, roarAt: [6.5, 4.5] };
    this.reward = { gear: 'ashmaw_fang', banner: ['Drake Slain', 'Ashmaw, the Cinder Drake'] };
    this.model = buildDrake();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 2400;
    this.maxPoise = 170;
    this.ash = 5200;
    this.radius = 2.0;
    this.height = 3.6;
    this.lockHeight = 2.4;
    this.leash = Infinity; // the caldera decides when the fight ends
    this.returnSpeed = 6;
    this.accel = 4;
    this.parryable = new Set(['bite']);
    this.parriedTime = 2.0;
    this.knockdownTime = 2.6;
    this.burnResist = 0;
    this.frostResist = 1.4; // the cold bites it hard
    this._enter();
  }

  _onReset() {
    super._onReset();
    this.phase = 1;
    this.recentDmg = 0;
    this.recentT = 0;
    this.lockable = false;
    this.move = null;
    this.flying = false;
    this.flyY = 0;
    this.chained = false;
    this.roared = false;
    this.invuln = false;
    this.breathYaw = 0;
    this.flyCd = 8;
    this._glow(1);
    if (this.game.state?.flags?.ashmawDead) {
      this.alive = false;
      this.state = 'dead';
      this.t = 99;
      this.shown = false;
    }
  }

  awaken(len = 2.4) {
    this._setState('wake');
    this.introLen = len;
    this.roared = false;
    this.lockable = true;
  }

  enter() { return { x: CALDERA.x, z: CALDERA.z - 26, yaw: 0 }; }
  arena() { return { x: CALDERA.x, z: CALDERA.z, leash: CALDERA.leash }; }

  busy() { return !!this.move || this.state === 'phase' || this.state === 'wake'; }

  _glow(k) {
    const m = this.model.materials?.ember;
    if (m) m.emissiveIntensity = 2.2 * k;
  }

  // ---------- combat hooks ----------

  takeHit(hit) {
    if (this.state === 'idle' || !this.alive) return false;
    const before = this.hp;
    const r = super.takeHit(hit);
    const d = before - Math.max(0, this.hp);
    if (d > 0) {
      this.recentDmg = this.recentT > 0 ? this.recentDmg + d : d;
      this.recentT = 2.2;
    }
    // Only a poise break or a riposte stops it mid-move (and never in the air).
    if (this.state === 'hurt' || this.state === 'knockdown') this._land();
    return r;
  }

  onParried(by) {
    super.onParried(by);
    if (this.state === 'parried') this.move = null;
  }

  onRiposte(by) {
    if (this.flying) return false;
    const ok = super.onRiposte(by);
    if (ok) this.move = null;
    return ok;
  }

  _die(hit) {
    this._land();
    const r = super._die(hit);
    this.lockable = false;
    this.game.onFoeBossDefeated(this);
    return r;
  }

  // Back on the ground (a move cut short in the air drops it).
  _land() {
    this.move = null;
    this.flying = false;
  }

  // In the air it ignores colliders and gravity and holds its flying height.
  integrate(dt) {
    if (!this.flying) return super.integrate(dt);
    const w = this.game.world;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    w.clampToPlay(this.pos);
    this.pos.y = Math.max(w.getHeight(this.pos.x, this.pos.z), this.flyY);
    this.onGround = false;
    this.vy = 0;
  }

  // ---------- behaviour ----------

  update(dt) {
    if (this.recentT > 0) this.recentT -= dt;
    if (this.flyCd > 0) this.flyCd -= dt;
    super.update(dt);
    // Smoke from its nostrils, embers off its back.
    if (this.alive && this.shown && Math.random() < dt * (this.state === 'idle' ? 1.5 : 5)) this._puff(this.state === 'idle' ? 0x6a625a : 0xff7a2a, 1, 1);
  }

  _engage() {
    this.move = null;
    this.flying = false;
    this._setState('stalk');
    this.cooldown = Math.max(this.cooldown, 0.5 + Math.random() * 0.6);
  }

  _think(dt, c) {
    const g = this.game, p = c.p;
    if (this.state === 'idle') {
      const pd = Math.hypot(p.pos.x - CALDERA.x, p.pos.z - CALDERA.z);
      if (p.alive && pd < CALDERA.trigger && !g.cutscene && !g.fieldBoss) g.startFoeFight(this);
      return false;
    }
    if (this.state === 'wake') {
      this._wake(dt, c);
      return false;
    }
    const pd = Math.hypot(p.pos.x - CALDERA.x, p.pos.z - CALDERA.z);
    if (!p.alive || pd > CALDERA.leash) {
      g.endFoeFight();
      return false;
    }
    if (this.phase === 1 && this.state !== 'phase' && this.hp <= this.maxHp * 0.5 && !this.move) {
      this._setState('phase');
      this.roared = false;
    }
    if (this.state === 'phase') return this._rage(dt, c);
    if (this.move) return this._doMove(dt, c);

    const w = this.want, { dist, toP } = c;
    if (this.state === 'chase' || dist > 20) {
      if (this.state !== 'chase') this._setState('chase');
      this.turnTo(toP, 3, dt);
      w.x = Math.sin(toP) * 9;
      w.z = Math.cos(toP) * 9;
      if (dist < 14) this._setState('stalk');
    } else {
      this.turnTo(toP, 3.2, dt);
      if ((this.flipT -= dt) <= 0) { this.strafe *= -1; this.flipT = 2.5 + Math.random() * 2.5; }
      const side = toP + (Math.PI / 2) * this.strafe;
      const ring = this.cooldown < 1 ? 5.5 : 9;
      const radial = clamp((dist - ring) * 1.2, -3.5, 6);
      w.x = Math.sin(side) * 2.6 + Math.sin(toP) * radial;
      w.z = Math.cos(side) * 2.6 + Math.cos(toP) * radial;
    }
    if ((this.cooldown -= dt) <= 0 && p.alive) this._pick(c);
    return true;
  }

  _pick(c) {
    const { dist, toP } = c;
    const flank = Math.abs(angleDiff(this.yaw, toP)) > 1.1;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 7) opts.push(['bite', flank ? 0.6 : 3]);
    if (dist < 7.5) opts.push(['sweep', flank ? 4 : 1]);
    if (dist < 5.5) opts.push(['buffet', 1.5]);
    if (dist < 14 && !flank) opts.push(['breath', p2 ? 3 : 2.2]);
    if (dist > 9 && dist < 26) opts.push(['spit', p2 ? 2.5 : 1.2]);
    if (this.flyCd <= 0 && dist > 6) opts.push(['fly', p2 ? 3 : 1.6]);
    if (!opts.length) return;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    let pick = opts[0][0];
    for (const [id, wt] of opts) if ((r -= wt) <= 0) { pick = id; break; }
    this._start(pick);
  }

  _start(id) {
    this.move = id;
    this._setState(id);
    this.hitSet = new Set();
    this.fired = false;
    this.leapt = false;
    this.landed = false;
    this.tick = 0;
    if (id === 'bite') this.game.audio.playAt('snarl', this.pos, 70);
    if (id === 'fly') { this.flyCd = this.phase === 2 ? 12 : 18; this.dives = this.phase === 2 && Math.random() < 0.5 ? 2 : 1; }
  }

  _finish(cd) {
    this.move = null;
    this.flying = false;
    this.breathYaw = 0;
    this._setState('stalk');
    this.cooldown = cd * (this.phase === 2 ? 0.7 : 1);
  }

  // Where its fire comes from: the throat glow in its jaws (the pose decides where that is).
  _mouth() {
    const a = this.yaw + this.breathYaw;
    this.model.root.updateMatrixWorld(true);
    this.model.throat.getWorldPosition(MOUTH);
    return { x: MOUTH.x + Math.sin(a) * 0.6, y: MOUTH.y, z: MOUTH.z + Math.cos(a) * 0.6, a };
  }

  _doMove(dt, c) {
    const g = this.game, t = this.t;
    switch (this.move) {
      case 'bite': {
        const M = MOVES.bite;
        if (t < M.windup) {
          this.turnTo(c.toP, 4, dt);
          this.vel.x = damp(this.vel.x, -this.forwardX * 1.2, 8, dt);
          this.vel.z = damp(this.vel.z, -this.forwardZ * 1.2, 8, dt);
        } else if (t < M.windup + M.active) {
          if (!this.fired) {
            this.fired = true;
            const sp = clamp((c.dist - 3.4) / M.active, 2, 14);
            this.vel.set(this.forwardX * sp, 0, this.forwardZ * sp);
            g.audio.playAt('heavySwing', this.pos);
          }
          g.combat.melee(this, { dmg: M.dmg, poise: M.poise, reach: M.reach, arc: M.arc, height: 4, knock: 4, heavy: true, burn: 10 }, this.hitSet);
        } else {
          this.vel.multiplyScalar(Math.exp(-6 * dt));
          if (t >= M.windup + M.active + M.recover) {
            if (this.phase === 2 && !this.chained && Math.random() < 0.45) {
              this.chained = true;
              this._start('bite');
              this.t = 0.2;
              return false;
            }
            this.chained = false;
            this._finish(1.0 + Math.random() * 0.7);
          }
        }
        return false;
      }
      case 'breath': {
        const M = MOVES.breath;
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (t < M.windup) {
          this.turnTo(c.toP, 3, dt);
          // The tell: its throat swells with light and it rears back, sucking in air.
          if (!this.fired && t > M.windup - 0.3) { this.fired = true; g.audio.playAt('breath', this.pos, 80); }
        } else if (t < M.windup + M.active) {
          // The river of fire sweeps across in front of it (drawn in _animate, so other players see it).
          const dir = this.yaw + this.breathYaw;
          if ((this.tick -= dt) <= 0) {
            this.tick = 0.22;
            g.combat.melee(this, { dmg: M.dmg, poise: 6, reach: M.reach, arc: M.arc, height: 6, burn: M.burn, yawOffset: this.breathYaw, knock: 1.5, parryable: false }, new Set());
          }
          // Where the stream lands the ground keeps burning.
          if (Math.random() < dt * 2.2) {
            const d = 6 + Math.random() * 5;
            g.effects.hazard(this, this.pos.x + Math.sin(dir) * d, this.pos.z + Math.cos(dir) * d, { radius: 2.2, life: 4, look: 'fire', hit: { dmg: 4, poise: 0, burn: 14, unblockable: true } });
          }
        } else {
          if (t >= M.windup + M.active + M.recover) {
            if (this.phase === 2 && !this.chained && Math.random() < 0.35) {
              this.chained = true;
              this.strafe *= -1;
              this._start('breath');
              return false;
            }
            this.chained = false;
            this._finish(1.4 + Math.random() * 0.8);
          }
        }
        return false;
      }
      case 'sweep': {
        const M = MOVES.sweep;
        if (t < M.windup) {
          this.vel.multiplyScalar(Math.exp(-8 * dt));
        } else if (t < M.windup + M.active) {
          if (!this.fired) { this.fired = true; g.audio.playAt('heavySwing', this.pos); }
          this.yaw += (Math.PI * 2 * dt) / M.active * this.strafe;
          g.combat.melee(this, { dmg: M.dmg, poise: M.poise, reach: M.reach, arc: M.arc, height: 3, knock: 6, heavy: true, yawOffset: Math.PI }, this.hitSet);
        } else if (t >= M.windup + M.active + M.recover) {
          this._finish(0.9 + Math.random() * 0.6);
        }
        return false;
      }
      case 'buffet': {
        const M = MOVES.buffet;
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (!this.fired && t >= M.windup) {
          this.fired = true;
          g.audio.playAt('wings', this.pos, 70);
          g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: M.wave.maxR, speed: M.wave.speed, color: 0xd8b8a0, hit: { dmg: M.wave.dmg, poise: 50, knock: 9, unblockable: true } });
          g.particles.emit({ x: this.pos.x, y: this.pos.y + 0.5, z: this.pos.z, count: 50, speed: 9, up: 1, color: 0x8a8078, color2: 0xff7a2a, life: [0.4, 1.0], size: [0.15, 0.35], drag: 2, jitter: 2 });
          g.cameraShake(0.3);
        }
        if (t >= M.windup + M.active + M.recover) this._finish(1.0);
        return false;
      }
      case 'spit': {
        const M = MOVES.spit;
        if (t < M.windup) {
          this.turnTo(c.toP, 4, dt);
          this.vel.multiplyScalar(Math.exp(-8 * dt));
          this.model.throat.material.opacity = t / M.windup;
        } else if (!this.fired) {
          this.fired = true;
          this._spit(c.p, M);
        } else if (t >= M.windup + M.recover) {
          this.model.throat.material.opacity = 0;
          this._finish(1.0 + Math.random() * 0.6);
        }
        return false;
      }
      case 'fly': return this._fly(dt, c);
    }
    this.move = null;
    return false;
  }

  // Fireballs in a fan; each bursts into a patch of burning ground.
  _spit(p, M, from = null) {
    const g = this.game;
    const mo = from ?? this._mouth();
    const aim = Math.atan2(p.pos.x - mo.x, p.pos.z - mo.z);
    const d = Math.max(3, Math.hypot(p.pos.x - mo.x, p.pos.z - mo.z));
    const dy = (p.pos.y + 0.6 - mo.y) / d;
    g.audio.playAt('bolt', this.pos, 70);
    for (let i = 0; i < M.count; i++) {
      const a = aim + (i - (M.count - 1) / 2) * M.fan;
      g.projectiles.spawn(this, {
        kind: 'fire', x: mo.x, y: mo.y, z: mo.z, dirX: Math.sin(a), dirY: dy, dirZ: Math.cos(a),
        speed: M.speed, radius: 0.7, life: 2.6, scale: 2.2, color: 0xff5a10, color2: 0xffd060,
        hit: { dmg: M.dmg, poise: 20, burn: 26, knock: 3, parryable: false }, sound: 'boltHit',
        onBurst: (pr) => g.effects.hazard(this, pr.pos.x, pr.pos.z, { radius: 2.4, life: 4.5, look: 'fire', hit: { dmg: 4, poise: 0, burn: 14, unblockable: true } }),
      });
    }
  }

  // Take off, circle over the player spitting fire, then dive onto where they stand.
  _fly(dt, c) {
    const g = this.game, t = this.t, M = MOVES.fly;
    const ground = g.world.getHeight(this.pos.x, this.pos.z);
    if (t < M.rise) {
      if (!this.flying) {
        this.flying = true;
        this.flyY = this.pos.y;
        g.audio.playAt('wings', this.pos, 80);
        g.particles.emit({ x: this.pos.x, y: ground + 0.4, z: this.pos.z, count: 40, speed: 8, up: 1, color: 0x8a8078, color2: 0xc8b8a0, life: [0.5, 1.2], size: [0.2, 0.4], drag: 2, jitter: 2 });
      }
      this.flyY = ground + M.height * (t / M.rise) * (t / M.rise);
      this.vel.multiplyScalar(Math.exp(-4 * dt));
      this.turnTo(c.toP, 2, dt);
      if (Math.random() < dt * 2.5) g.audio.playAt('wings', this.pos, 80);
      return false;
    }
    if (t < M.rise + M.hover) {
      // Circling high, keeping a little off to one side, spitting fire twice.
      this.turnTo(c.toP, 3, dt);
      const side = c.toP + (Math.PI / 2) * this.strafe;
      const radial = clamp((c.dist - 10) * 1.2, -6, 9);
      this.vel.x = damp(this.vel.x, Math.sin(side) * 5 + Math.sin(c.toP) * radial, 3, dt);
      this.vel.z = damp(this.vel.z, Math.cos(side) * 5 + Math.cos(c.toP) * radial, 3, dt);
      this.flyY = damp(this.flyY, g.world.getHeight(this.pos.x, this.pos.z) + M.height, 3, dt);
      const u = t - M.rise;
      if (Math.random() < dt * 2.2) g.audio.playAt('wings', this.pos, 80);
      if ((u > 0.7 && this.tick === 0) || (u > 1.6 && this.tick === 1)) {
        this.tick++;
        this._spit(c.p, { ...MOVES.spit, count: this.phase === 2 ? 3 : 2, speed: 22 });
      }
      this.diveTo = { x: c.p.pos.x, z: c.p.pos.z };
      return false;
    }
    if (t < M.rise + M.hover + M.dive) {
      // The dive: straight at where you stood a moment ago (a roll sideways makes it miss).
      const u = (t - M.rise - M.hover) / M.dive;
      if (!this.leapt) {
        this.leapt = true;
        this.from = { x: this.pos.x, z: this.pos.z, y: this.flyY };
        this.yaw = Math.atan2(this.diveTo.x - this.pos.x, this.diveTo.z - this.pos.z);
        g.audio.playAt('roarBig', this.pos, 90);
      }
      const f = this.from;
      const gy = g.world.getHeight(this.diveTo.x, this.diveTo.z);
      this.pos.x = f.x + (this.diveTo.x - f.x) * u;
      this.pos.z = f.z + (this.diveTo.z - f.z) * u;
      this.flyY = f.y + (gy - f.y) * u * u;
      this.vel.set(0, 0, 0);
      g.combat.sphere(this, { x: this.pos.x, y: this.flyY + 1.5, z: this.pos.z }, 2.6, { dmg: 34, poise: 60, heavy: true, knock: 7, burn: 20 }, this.hitSet);
      return false;
    }
    if (!this.landed) {
      this.landed = true;
      this.flying = false;
      this.pos.y = ground;
      g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 10, speed: 15, color: 0xff7a2a, hit: { dmg: 22, poise: 30, burn: 24, knock: 5 } });
      g.effects.hazard(this, this.pos.x, this.pos.z, { radius: 4.5, life: 4, look: 'fire', hit: { dmg: 4, poise: 0, burn: 14, unblockable: true } });
      g.audio.playAt('slam', this.pos, 90);
      g.cameraShake(0.45);
      g.particles.emit({ x: this.pos.x, y: ground + 0.5, z: this.pos.z, count: 60, speed: 9, up: 3, color: 0xff6a1a, color2: 0x6a625a, life: [0.5, 1.2], size: [0.2, 0.45], drag: 2, gravity: 4, jitter: 2 });
    }
    if (t >= M.rise + M.hover + M.dive + M.land) {
      if (--this.dives > 0) {
        // Up again for a second dive.
        this.t = 0;
        this.leapt = false;
        this.landed = false;
        this.tick = 0;
        return false;
      }
      this._finish(1.2);
    }
    return false;
  }

  // Half health: it rears up, roars a ring of fire through any guard, and burns hotter from here on.
  _rage(dt, c) {
    const g = this.game, t = this.t;
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = t < 1.4;
    if (!this.roared && t > 0.9) {
      this.roared = true;
      this.phase = 2;
      this._glow(1.8);
      g.audio.playAt('roarBig', this.pos, 100);
      g.cameraShake(0.5);
      g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 14, speed: 13, color: 0xff6a1a, hit: { dmg: 20, poise: 30, burn: 40, knock: 6, unblockable: true } });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.effects.hazard(this, this.pos.x + Math.sin(a) * 9, this.pos.z + Math.cos(a) * 9, { radius: 2.4, life: 6, look: 'fire', hit: { dmg: 4, poise: 0, burn: 14, unblockable: true } });
      }
    }
    if (this.roared && Math.random() < dt * 30) this._puff(0xff6a1a, 2, 4);
    if (t >= PHASE_LENGTH) {
      this.invuln = false;
      this._engage();
      this.cooldown = 0.4;
      this.flyCd = 2;
    }
    return false;
  }

  // The intro: curled asleep, stirring, rising, then rearing up with a roar of fire into the sky.
  _wake(dt, c) {
    const L = this.introLen, long = L > 4;
    const rise = long ? 2.4 : 0.2, roar = long ? 4.4 : 1.0;
    if (this.t > rise) this.turnTo(c.toP, 1.4, dt);
    if (!this.roared && this.t > roar) {
      this.roared = true;
      this.game.audio.play('roarBig');
      this.game.audio.play('breath');
    }
    if (this.t >= L) {
      this._engage();
      this.cooldown = 0.8;
    }
  }

  _puff(color, count, up = 1) {
    const hx = this.pos.x + this.forwardX * 4.4, hz = this.pos.z + this.forwardZ * 4.4;
    this.game.particles.emit({ x: hx, y: this.pos.y + 2.4, z: hz, count, speed: 0.6, up, color, color2: 0xffd090, life: [0.6, 1.2], size: [0.12, 0.3], jitter: 0.5 });
  }

  // ---------- animation ----------

  _pose(T, o, dt) {
    const t = this.t;
    const breathe = Math.sin(this.game.time * 1.1) * 0.02;
    this.wingMode = 'fold';
    switch (this.state) {
      case 'idle':
        T.y = -0.42 + breathe; T.neck = 0.9; T.head = 0.5; T.tailX = 0.9; T.tailY = 1.1;
        o.legs = 'fold';
        o.k = dampK(4, dt);
        return;
      case 'wake': {
        const L = this.introLen, long = L > 4;
        const rise = long ? 2.4 : 0.2, roar = long ? 4.4 : 1.0, settle = long ? 6.4 : 2.1;
        if (t < rise) {
          T.y = -0.42 + breathe; T.neck = t > rise - 0.8 ? 0.2 : 0.9; T.head = 0.3; T.tailX = 0.8; T.tailY = 0.8;
          o.legs = 'fold'; o.k = dampK(3, dt);
        } else if (t < roar) {
          const u = (t - rise) / (roar - rise);
          T.y = -0.42 * (1 - u); T.neck = 0.1 - u * 0.3; T.head = -0.1; T.jaw = 0.3;
          o.legs = u < 0.5 ? 'coil' : 'gait'; o.k = dampK(3.5, dt);
          this.wingMode = 'half';
        } else if (t < settle) {
          T.y = 0.15; T.x = -0.55; T.neck = -1.1; T.head = -0.4; T.jaw = 1.0; T.tailX = -0.3;
          T.z = Math.sin(t * 13) * 0.03;
          o.legs = 'rear'; o.k = dampK(5, dt);
          this.wingMode = 'spread';
        } else {
          T.neck = 0.2; T.head = -0.15; T.jaw = 0.3;
          o.k = dampK(5, dt);
        }
        return;
      }
      case 'bite': {
        const M = MOVES.bite;
        if (t < M.windup) {
          const u = t / M.windup;
          T.y = -0.14 * u; T.x = 0.12 * u; T.neck = 0.4; T.head = -0.4; T.jaw = 0.5 * u; T.tailX = -0.2;
          o.legs = 'coil'; o.k = dampK(14, dt);
        } else if (t < M.windup + M.active) {
          T.x = -0.08; T.neck = -0.15; T.head = -0.3; T.jaw = t < M.windup + M.active * 0.6 ? 1.0 : 0.05;
          o.legs = 'stretch'; o.k = dampK(24, dt);
        } else {
          T.neck = 0.25; T.jaw = 0.2;
        }
        return;
      }
      case 'breath': {
        const M = MOVES.breath;
        if (t < M.windup) {
          const u = t / M.windup;
          T.x = -0.25 * u; T.y = 0.06; T.neck = -0.7 * u; T.head = 0.3 * u; T.jaw = 0.2;
          o.k = dampK(8, dt);
          this.wingMode = 'half';
        } else if (t < M.windup + M.active) {
          T.x = 0.12; T.y = -0.06; T.neck = 0.2; T.head = -0.25; T.jaw = 1.0;
          o.legs = 'coil'; o.k = dampK(14, dt);
          this.wingMode = 'half';
        } else {
          T.neck = 0.2; T.jaw = 0.3;
        }
        return;
      }
      case 'sweep': {
        const M = MOVES.sweep;
        if (t < M.windup) {
          T.y = -0.12; T.z = -0.16 * this.strafe; T.neck = 0.25; T.tailX = -0.3; T.tailY = -1.1 * this.strafe;
          o.legs = 'coil'; o.k = dampK(12, dt);
        } else {
          T.z = 0.2 * this.strafe; T.neck = 0.15; T.jaw = 0.4; T.tailX = -0.25; T.tailY = 1.3 * this.strafe;
          o.k = dampK(16, dt);
        }
        return;
      }
      case 'buffet': {
        const M = MOVES.buffet;
        T.y = 0.1; T.x = -0.45; T.neck = -0.6; T.head = -0.2; T.jaw = 0.6;
        o.legs = 'rear'; o.k = dampK(t < M.windup ? 8 : 18, dt);
        this.wingMode = t < M.windup ? 'spread' : 'beat';
        return;
      }
      case 'spit':
        if (t < MOVES.spit.windup) {
          T.x = -0.18; T.neck = -0.6; T.head = -0.25; T.jaw = 0.3;
          o.k = dampK(10, dt);
        } else {
          T.x = 0.08; T.neck = 0.3; T.head = -0.1; T.jaw = 1.0;
          o.k = dampK(22, dt);
        }
        return;
      case 'fly': {
        const M = MOVES.fly;
        const diving = t >= M.rise + M.hover && !this.landed;
        if (this.landed) {
          T.y = -0.2; T.x = 0.15; T.neck = 0.4; T.jaw = 0.3;
          o.legs = 'splay'; o.k = dampK(14, dt);
          this.wingMode = 'half';
        } else {
          T.x = diving ? 0.5 : -0.1; T.neck = diving ? 0.3 : 0; T.head = -0.2; T.jaw = diving ? 0.9 : 0.3; T.tailX = -0.4;
          o.legs = 'tuck'; o.k = dampK(10, dt);
          this.wingMode = diving ? 'swept' : 'flap';
        }
        return;
      }
      case 'phase': {
        T.y = 0.15; T.x = -0.5; T.neck = -1.1; T.head = -0.4; T.jaw = t > 0.7 ? 1.0 : 0.3;
        T.z = t > 0.9 ? Math.sin(t * 16) * 0.04 : 0;
        o.legs = 'rear'; o.k = dampK(8, dt);
        this.wingMode = 'spread';
        return;
      }
      case 'dead':
        this.wingMode = 'limp';
        break;
    }
    super._pose(T, o, dt);
  }

  // The breath's look, from the move's clock alone (so a puppet in someone else's game draws it too):
  // the throat swelling in the wind-up, the stream sweeping across, the glow fading after.
  _breathFx(dt) {
    const M = MOVES.breath, t = this.t, m = this.model, g = this.game;
    if (this.state !== 'breath') {
      if (this.state === 'wake' && this.introLen) {
        // The intro's roar of fire into the sky.
        const roar = this.introLen > 4 ? 4.4 : 1.0;
        if (t > roar && t < roar + 1.5) {
          const mo = this._mouth();
          for (let i = 0; i < 3; i++) g.particles.emit({ x: mo.x, y: mo.y + 1, z: mo.z, count: 1, speed: 1, color: 0xff5a10, color2: 0xffe080, life: [0.5, 0.9], size: [0.3, 0.6], drag: 0.5, jitter: 0.3, dir: { x: 0, y: 14, z: 0 } });
        }
      }
      if (this.state !== 'spit' && this.state !== 'fly') m.throat.material.opacity = Math.max(0, m.throat.material.opacity - dt * 3);
      this.breathYaw *= Math.exp(-6 * dt);
      return;
    }
    const side = this.strafe || 1;
    if (t < M.windup) {
      m.throat.material.opacity = t / M.windup;
      m.throat.scale.setScalar(0.6 + (t / M.windup) * 1.4);
      this.breathYaw = -M.sweep * side * (t / M.windup);
    } else if (t < M.windup + M.active) {
      const u = (t - M.windup) / M.active;
      this.breathYaw = M.sweep * side * (2 * u - 1);
      m.throat.material.opacity = 1;
      const mo = this._mouth();
      for (let i = 0; i < 5; i++) {
        const sp = 14 + Math.random() * 6;
        g.particles.emit({ x: mo.x, y: mo.y, z: mo.z, count: 1, speed: 1.2, up: -0.5, color: 0xff5a10, color2: 0xffe080, life: [0.45, 0.75], size: [0.35, 0.7], drag: 0.6, jitter: 0.3, dir: { x: Math.sin(mo.a) * sp, y: -1.6, z: Math.cos(mo.a) * sp } });
      }
    } else {
      m.throat.material.opacity = Math.max(0, 1 - (t - M.windup - M.active) * 3);
      this.breathYaw *= Math.exp(-6 * dt);
    }
  }

  _animate(dt) {
    this._breathFx(dt);
    super._animate(dt);
    const m = this.model;
    m.neck.rotation.y += (this.breathYaw * 0.7 - m.neck.rotation.y) * dampK(10, dt);
    // Wings: folded along the back; half-open when it rears; spread and beating in the air.
    const time = this.game.time;
    const k = dampK(8, dt);
    for (const w of m.wings) {
      const s = w.side;
      let y = 0, z = 0, ty = 0, tz = 0;
      switch (this.wingMode) {
        case 'fold': y = s * 1.25; z = s * 0.35; ty = s * 1.6; tz = -s * 0.1; break;
        case 'half': y = s * 0.5; z = s * 0.45; ty = s * 0.6; tz = s * 0.1; break;
        case 'spread': y = s * 0.05; z = s * (0.35 + Math.sin(time * 3) * 0.08); ty = 0; tz = s * 0.15; break;
        case 'beat': y = 0; z = -s * 0.6; ty = 0; tz = -s * 0.4; break;
        case 'flap': { const f = Math.sin(time * 7); y = 0; z = s * f * 0.75; ty = 0; tz = s * Math.sin(time * 7 - 0.8) * 0.5; break; }
        case 'swept': y = s * 0.7; z = s * 0.2; ty = s * 0.5; tz = 0; break;
        case 'limp': y = s * 0.3; z = -s * 0.5; ty = s * 0.2; tz = -s * 0.3; break;
      }
      const kk = this.wingMode === 'flap' || this.wingMode === 'beat' ? dampK(24, dt) : k;
      w.wing.rotation.y += (y - w.wing.rotation.y) * kk;
      w.wing.rotation.z += (z - w.wing.rotation.z) * kk;
      w.tip.rotation.y += (ty - w.tip.rotation.y) * kk;
      w.tip.rotation.z += (tz - w.tip.rotation.z) * kk;
    }
  }
}
