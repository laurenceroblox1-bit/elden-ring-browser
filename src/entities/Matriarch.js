// Vharra, Mother of the Mire: the great hound that whelped every Mire Hound in the Vale, asleep in a
// ring of standing stones at the heart of the Ashen Fen. A Hound at three times the size, with a boss's
// moveset and her own fight (no mist wall: step into the hollow and she wakes; run far enough and she
// lies back down to lick her wounds).
//
// Moves: bite (parryable), pounce (leaps onto you, lands in a shockwave), tail sweep (a full spin that
// punishes standing at her flank), and in the second phase ember spit (three burning gobs in a fan) and a
// howl that calls two of her litter out of the fog.
// States: idle (asleep) -> wake (the intro; timed to the cutscene) -> stalk/chase <-> bite, pounce, sweep,
// spit, howl; phase (the half-health rage); plus the shared hurt/parried/riposted/knockdown/dead (Foe).
import { Hound } from './Hound.js';
import { buildHound } from '../models/beasts.js';
import { HOLLOW } from '../data/world.js';
import { clamp, damp, dampK, angleDiff } from '../core/math.js';

const SIZE = 3.2;
const MOVES = {
  bite: { windup: 0.62, active: 0.3, recover: 0.62, dmg: 30, poise: 34, reach: 3.6, arc: 0.7 },
  pounce: { windup: 0.8, air: 0.62, recover: 0.95, dmg: 26, poise: 40, wave: { maxR: 7.5, speed: 15, dmg: 20 } },
  sweep: { windup: 0.5, active: 0.5, recover: 0.65, dmg: 24, poise: 30, reach: 4.8, arc: 0.55 },
  spit: { windup: 0.7, recover: 0.75, dmg: 17, count: 3, fan: 0.24, speed: 17 },
  howl: { length: 1.8, at: 0.55, summons: 2 },
};
const PHASE_LENGTH = 2.3;

export class Matriarch extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a pup; swap in the mother
    this.game.combat.unregister(this);
    this.tag = 'matriarch';
    this.name = 'Vharra, Mother of the Mire';
    this.isBoss = true;
    this.model = buildHound({ mother: true });
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 1450;
    this.maxPoise = 120;
    this.ash = 2400;
    this.radius = 1.7;
    this.height = 3.2;
    this.lockHeight = 2.1;
    this.leash = Infinity; // the hollow decides when the fight ends, not her own post
    this.returnSpeed = 6;
    this.accel = 5;
    this.parryable = new Set(['bite']);
    this.parriedTime = 1.9;
    this.knockdownTime = 2.4;
    this._enter();
  }

  _onReset() {
    super._onReset();
    this.phase = 1;
    this.recentDmg = 0;
    this.recentT = 0;
    this.lockable = false;
    this.summonCd = 0;
    this.summoned = 0;
    this.move = null;
    this.chained = false;
    this.howled = false;
    this.invuln = false;
    this._glow(1);
    if (this.game.state?.flags?.motherDead) {
      // Beaten for good: nothing left in the hollow but the bones.
      this.alive = false;
      this.state = 'dead';
      this.t = 99;
      this.shown = false;
    }
  }

  // The intro: she rises over `len` seconds (the cutscene's length, or a short wake without one).
  awaken(len = 2.4) {
    this._setState('wake');
    this.introLen = len;
    this.howled = false;
    this.lockable = true;
  }

  busy() { return !!this.move || this.state === 'phase' || this.state === 'wake'; }

  _glow(k) {
    const m = this.model.materials?.ember;
    if (m) m.emissiveIntensity = 2.4 * k;
  }

  // ---------- combat hooks ----------

  takeHit(hit) {
    if (this.state === 'idle' || !this.alive) return false; // asleep: she isn't part of the world's fights yet
    const before = this.hp;
    const r = super.takeHit(hit);
    const d = before - Math.max(0, this.hp);
    if (d > 0) {
      this.recentDmg = this.recentT > 0 ? this.recentDmg + d : d;
      this.recentT = 2.2;
    }
    // Big blows stagger her, but she shrugs off the little ones mid-move.
    if (this.state === 'hurt') this.move = null;
    return r;
  }

  onParried(by) {
    super.onParried(by);
    if (this.state === 'parried') this.move = null;
  }

  onRiposte(by) {
    const ok = super.onRiposte(by);
    if (ok) this.move = null;
    return ok;
  }

  _die(hit) {
    this.move = null;
    const r = super._die(hit);
    this.lockable = false;
    this.game.onMotherDefeated?.(this);
    return r;
  }

  // ---------- behaviour ----------

  update(dt) {
    if (this.recentT > 0) this.recentT -= dt;
    if (this.summonCd > 0) this.summonCd -= dt;
    super.update(dt);
  }

  _engage() {
    this.move = null;
    this._setState('stalk');
    this.cooldown = Math.max(this.cooldown, 0.5 + Math.random() * 0.6);
  }

  _think(dt, c) {
    const g = this.game, p = c.p;
    if (this.state === 'idle') {
      // Asleep. Breath of ash from her nostrils now and then.
      if (Math.random() < dt * 0.8) this._puff(0x8a8478, 3);
      const pd = Math.hypot(p.pos.x - HOLLOW.x, p.pos.z - HOLLOW.z);
      if (p.alive && pd < HOLLOW.trigger && !g.cutscene) g.startMotherFight?.(this);
      return false;
    }
    if (this.state === 'wake') {
      this._wake(dt, c);
      return false;
    }
    // Out of the hollow (or fallen): the hunt is over and she goes back to sleep.
    const pd = Math.hypot(p.pos.x - HOLLOW.x, p.pos.z - HOLLOW.z);
    if (!p.alive || pd > HOLLOW.leash) {
      g.endMotherFight?.();
      return false;
    }
    if (this.phase === 1 && this.state !== 'phase' && this.hp <= this.maxHp * 0.5 && !this.move) {
      this._setState('phase');
      this.howled = false;
    }
    if (this.state === 'phase') return this._rage(dt, c);
    if (this.move) return this._doMove(dt, c);

    const w = this.want, { dist, toP } = c;
    if (this.state === 'chase' || dist > 17) {
      if (this.state !== 'chase') this._setState('chase');
      this.turnTo(toP, 4, dt);
      w.x = Math.sin(toP) * 10;
      w.z = Math.cos(toP) * 10;
      if (dist < 12) this._setState('stalk');
    } else {
      // Circle at a few body-lengths, closing in when she's ready to strike.
      this.turnTo(toP, 4.5, dt);
      if ((this.flipT -= dt) <= 0) { this.strafe *= -1; this.flipT = 2 + Math.random() * 2.5; }
      const side = toP + (Math.PI / 2) * this.strafe;
      // Closing in as her next move comes up, so the bite is in reach when it does.
      const ring = this.cooldown < 1 ? 4.5 : 8;
      const radial = clamp((dist - ring) * 1.4, -4, 7);
      w.x = Math.sin(side) * 3.4 + Math.sin(toP) * radial;
      w.z = Math.cos(side) * 3.4 + Math.cos(toP) * radial;
    }
    if ((this.cooldown -= dt) <= 0 && p.alive) this._pick(c);
    return true;
  }

  _pick(c) {
    const { dist, toP } = c;
    const flank = Math.abs(angleDiff(this.yaw, toP)) > 1.1;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 8.5) opts.push(['bite', 3]);
    if (dist < 6) opts.push(['sweep', flank ? 4 : 1.5]);
    if (dist > 6 && dist < 19) opts.push(['pounce', dist > 10 ? 3 : 1.2]);
    if (p2 && dist > 6 && dist < 24) opts.push(['spit', 2]);
    if (p2 && this.summonCd <= 0 && this.summoned < 4) opts.push(['howl', 3]);
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
    if (id === 'bite' || id === 'pounce') this.game.audio.play('snarl');
  }

  _finish(cd) {
    this.move = null;
    this._setState('stalk');
    this.cooldown = cd * (this.phase === 2 ? 0.7 : 1);
  }

  _doMove(dt, c) {
    const g = this.game, t = this.t;
    switch (this.move) {
      case 'bite': {
        const M = MOVES.bite;
        if (t < M.windup) {
          this.turnTo(c.toP, 5, dt);
          this.vel.x = damp(this.vel.x, -this.forwardX * 1.2, 8, dt);
          this.vel.z = damp(this.vel.z, -this.forwardZ * 1.2, 8, dt);
        } else if (t < M.windup + M.active) {
          if (!this.fired) {
            this.fired = true;
            const sp = clamp((c.dist - 2.6) / M.active, 3, 15);
            this.vel.set(this.forwardX * sp, 0, this.forwardZ * sp);
            g.audio.play('heavySwing');
          }
          g.combat.melee(this, { dmg: M.dmg, poise: M.poise, reach: M.reach, arc: M.arc, height: 3.4, knock: 4, heavy: true }, this.hitSet);
        } else {
          this.vel.multiplyScalar(Math.exp(-6 * dt));
          if (t >= M.windup + M.active + M.recover) {
            // In the second phase she sometimes snaps twice.
            if (this.phase === 2 && !this.chained && Math.random() < 0.5) {
              this.chained = true;
              this._start('bite');
              this.t = 0.2;
              return false;
            }
            this.chained = false;
            this._finish(1.0 + Math.random() * 0.8);
          }
        }
        return false;
      }
      case 'pounce': {
        const M = MOVES.pounce;
        if (t < M.windup) {
          this.turnTo(c.toP, 4, dt);
          this.vel.multiplyScalar(Math.exp(-8 * dt));
        } else if (!this.landed) {
          if (!this.leapt) {
            this.leapt = true;
            // Aim to land on the spot the player stands on now (a roll sideways makes her miss).
            const sp = clamp((c.dist - 1.2) / M.air, 4, 24);
            this.vel.set(this.forwardX * sp, 0, this.forwardZ * sp);
            this.vy = 0.5 * 26 * M.air;
            this.onGround = false;
            g.audio.play('heavySwing');
          }
          g.combat.sphere(this, { x: this.pos.x, y: this.pos.y + 1.2, z: this.pos.z }, 1.8, { dmg: M.dmg, poise: M.poise, heavy: true, knock: 5 }, this.hitSet);
          if (this.onGround && t > M.windup + 0.15) {
            this.landed = true;
            this.landT = t;
            this.vel.set(0, 0, 0);
            g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: M.wave.maxR, speed: M.wave.speed, color: 0xc8b8a0, hit: { dmg: M.wave.dmg, poise: 24, knock: 4 } });
            g.audio.play('slam');
            g.cam.shake(0.3);
            this._puff(0x9a9080, 18);
          }
        } else if (t - this.landT >= M.recover) {
          this._finish(1.2 + Math.random() * 0.8);
        }
        return false;
      }
      case 'sweep': {
        const M = MOVES.sweep;
        if (t < M.windup) {
          this.vel.multiplyScalar(Math.exp(-8 * dt));
        } else if (t < M.windup + M.active) {
          if (!this.fired) { this.fired = true; g.audio.play('heavySwing'); }
          // One full turn; the tail and flank sweep everything around her.
          this.yaw += (Math.PI * 2 * dt) / M.active * this.strafe;
          g.combat.melee(this, { dmg: M.dmg, poise: M.poise, reach: M.reach, arc: M.arc, height: 3, knock: 5 }, this.hitSet);
        } else if (t >= M.windup + M.active + M.recover) {
          this._finish(0.9 + Math.random() * 0.7);
        }
        return false;
      }
      case 'spit': {
        const M = MOVES.spit;
        if (t < M.windup) {
          this.turnTo(c.toP, 4, dt);
          this.vel.multiplyScalar(Math.exp(-8 * dt));
          if (Math.random() < 0.5) this._puff(0xff7a2a, 1, 2.6);
        } else if (!this.fired) {
          this.fired = true;
          g.audio.play('bolt');
          const hx = this.pos.x + this.forwardX * 2.8, hz = this.pos.z + this.forwardZ * 2.8, hy = this.pos.y + 2.0;
          const aim = Math.atan2(c.p.pos.x - hx, c.p.pos.z - hz);
          const dy = (c.p.pos.y + 1 - hy) / Math.max(4, c.dist);
          for (let i = 0; i < M.count; i++) {
            const a = aim + (i - (M.count - 1) / 2) * M.fan;
            g.projectiles.spawn(this, {
              kind: 'bolt', x: hx, y: hy, z: hz, dirX: Math.sin(a), dirY: dy, dirZ: Math.cos(a),
              speed: M.speed, radius: 0.55, life: 2.2, scale: 1.7, color: 0xff6a20, color2: 0xffc070,
              hit: { dmg: M.dmg, poise: 14 }, sound: 'boltHit',
            });
          }
        } else if (t >= M.windup + M.recover) {
          this._finish(1.1 + Math.random() * 0.6);
        }
        return false;
      }
      case 'howl': {
        const M = MOVES.howl;
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (!this.fired && t >= M.at) {
          this.fired = true;
          g.audio.play('howl');
          g.cam.shake(0.2);
          this._summon(M.summons);
        }
        if (t >= M.length) this._finish(0.8);
        return false;
      }
    }
    this.move = null;
    return false;
  }

  // Her litter answers from the fog at the hollow's edge.
  _summon(n) {
    const g = this.game;
    this.summonCd = 22;
    for (let i = 0; i < n; i++) {
      const a = this.yaw + Math.PI + (i - (n - 1) / 2) * 1.2;
      const x = this.pos.x + Math.sin(a) * 9, z = this.pos.z + Math.cos(a) * 9;
      const pup = g.summonEnemy?.('hound', x, z, a + Math.PI, { pack: 'vharra-litter' });
      if (!pup) continue;
      pup._setState('alert');
      this.summoned++;
      g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.6, z, count: 24, speed: 2, up: 2, color: 0x6a6660, color2: 0xb0a898, life: [0.6, 1.2], size: [0.2, 0.4], jitter: 1 });
    }
  }

  // Half health: she rears up and screams, the shockwave goes through any guard, and the embers
  // inside her flare. Phase two adds the spit and the howl, and quicker recovery between moves.
  _rage(dt, c) {
    const g = this.game, t = this.t;
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = t < 1.2;
    if (!this.howled && t > 0.8) {
      this.howled = true;
      this.phase = 2;
      this._glow(1.9);
      g.audio.play('howl');
      g.cam.shake(0.45);
      g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 12, speed: 13, color: 0xff8a40, hit: { dmg: 18, poise: 30, knock: 5, unblockable: true } });
      this._puff(0xff7a2a, 30, 1.5);
    }
    if (t >= PHASE_LENGTH) {
      this.invuln = false;
      this._engage();
      this.cooldown = 0.4;
    }
    return false;
  }

  // The intro, timed to the cutscene: asleep, stirring, rising, then a howl up at the sky.
  _wake(dt, c) {
    const L = this.introLen, long = L > 4;
    const rise = long ? 2.4 : 0.2, howl = long ? 4.3 : 1.0;
    if (this.t > rise) this.turnTo(c.toP, 1.6, dt);
    if (!this.howled && this.t > howl + 0.2) {
      this.howled = true;
      this.game.audio.play('howl');
      this._puff(0x8a8478, 16, 2.4);
    }
    if (this.t >= L) {
      this._engage();
      this.cooldown = 0.8;
    }
  }

  _puff(color, count, up = 1) {
    const hx = this.pos.x + this.forwardX * 2.9, hz = this.pos.z + this.forwardZ * 2.9;
    this.game.particles.emit({ x: hx, y: this.pos.y + 1.5, z: hz, count, speed: 0.8, up, color, color2: 0xd8cfb8, life: [0.6, 1.2], size: [0.12, 0.3], jitter: 0.6 });
  }

  // ---------- animation ----------

  _pose(T, o, dt) {
    const t = this.t;
    const breathe = Math.sin(this.game.time * 1.3) * 0.02;
    switch (this.state) {
      case 'idle':
        T.y = -0.44 + breathe; T.neck = 0.8; T.head = 0.45; T.jaw = 0; T.tailX = 0.9; T.tailY = 0.9;
        o.legs = 'fold';
        o.k = dampK(4, dt);
        return;
      case 'wake': {
        const L = this.introLen, long = L > 4;
        const rise = long ? 2.4 : 0.2, stand = long ? 4.3 : 1.0, settle = long ? 6.3 : 2.1;
        if (t < rise) {
          T.y = -0.44 + breathe; T.neck = t > rise - 0.7 ? 0.2 : 0.8; T.head = 0.3; T.tailX = 0.8; T.tailY = 0.6;
          o.legs = 'fold';
          o.k = dampK(3, dt);
        } else if (t < stand) {
          // Up onto her forelegs first, then the haunches.
          const u = (t - rise) / (stand - rise);
          T.y = -0.44 * (1 - u); T.x = 0.2 * (1 - u) - 0.1; T.neck = 0.1 - u * 0.3; T.head = -0.1; T.jaw = 0.25;
          o.legs = u < 0.5 ? 'coil' : 'gait';
          o.k = dampK(3.5, dt);
        } else if (t < settle) {
          // The howl: up on her hind legs, muzzle to the sky.
          T.y = 0.12; T.x = -0.5; T.neck = -1.0; T.head = -0.35; T.jaw = 1.0; T.tailX = -0.3;
          T.z = Math.sin(t * 14) * 0.03;
          o.legs = 'rear';
          o.k = dampK(5, dt);
        } else {
          T.neck = 0.25; T.head = -0.2; T.jaw = 0.3;
          o.k = dampK(5, dt);
        }
        return;
      }
      case 'bite': {
        const M = MOVES.bite;
        if (t < M.windup) {
          const u = t / M.windup;
          T.y = -0.18 * u; T.x = 0.14 * u; T.neck = 0.35; T.head = -0.4; T.jaw = 0.5 * u; T.tailX = -0.2;
          o.legs = 'coil'; o.k = dampK(14, dt);
        } else if (t < M.windup + M.active) {
          T.x = -0.1; T.neck = -0.1; T.head = -0.3; T.jaw = t < M.windup + M.active * 0.6 ? 1.0 : 0.05;
          o.legs = 'stretch'; o.k = dampK(26, dt);
        } else {
          T.neck = 0.25; T.jaw = 0.2;
        }
        return;
      }
      case 'pounce': {
        const M = MOVES.pounce;
        if (t < M.windup) {
          const u = t / M.windup;
          T.y = -0.28 * u; T.x = 0.12; T.neck = 0.45; T.head = -0.45; T.jaw = 0.4; T.tailX = -0.3;
          o.legs = 'coil'; o.k = dampK(10, dt);
        } else if (!this.landed) {
          T.x = -0.2; T.neck = -0.1; T.jaw = 0.9; T.tailX = -0.6;
          o.legs = 'stretch'; o.k = dampK(20, dt);
        } else {
          T.y = -0.2; T.x = 0.15; T.neck = 0.4; T.jaw = 0.3;
          o.legs = 'splay'; o.k = dampK(14, dt);
        }
        return;
      }
      case 'sweep': {
        const M = MOVES.sweep;
        if (t < M.windup) {
          T.y = -0.12; T.z = -0.18 * this.strafe; T.neck = 0.2; T.tailX = -0.3; T.tailY = -1.0 * this.strafe;
          o.legs = 'coil'; o.k = dampK(12, dt);
        } else {
          T.z = 0.22 * this.strafe; T.neck = 0.1; T.jaw = 0.4; T.tailX = -0.2; T.tailY = 1.2 * this.strafe;
          o.k = dampK(16, dt);
        }
        return;
      }
      case 'spit':
        if (t < MOVES.spit.windup) {
          T.x = -0.15; T.neck = -0.6; T.head = -0.25; T.jaw = 0.3;
          o.k = dampK(10, dt);
        } else {
          T.x = 0.08; T.neck = 0.3; T.head = -0.1; T.jaw = 1.0;
          o.k = dampK(22, dt);
        }
        return;
      case 'howl':
      case 'phase': {
        const at = this.state === 'phase' ? 0.8 : MOVES.howl.at;
        T.y = 0.12; T.x = -0.48; T.neck = -1.0; T.head = -0.35; T.jaw = t > at - 0.2 ? 1.0 : 0.3;
        T.z = t > at ? Math.sin(t * 16) * 0.04 : 0;
        o.legs = 'rear'; o.k = dampK(8, dt);
        return;
      }
    }
    super._pose(T, o, dt);
  }
}
