// Solkar, the Sun Scarab: the beetle that rolled the sun across the old sky, or so the Sanctum's
// priests said. It sleeps under the sand of the Sanctum floor; step in and it bursts up out of it.
// A goring horn (parryable), a long charge across the floor, a burrow that brings it up under your feet,
// a beam of sunfire from the disc on its back, and a wing-buzz that throws you off. At half health it
// calls up a sandstorm and burrows more, rising in a ring of sunfire.
// States: idle (buried) -> wake -> stalk/chase <-> gore, charge, burrow, beam, buzz; phase.
import { Hound } from './Hound.js';
import { buildScarab } from '../models/creatures.js';
import { SANCTUM } from '../data/biomes.js';
import { clamp, damp, dampK, angleDiff } from '../core/math.js';

const SIZE = 4.4;
const MOVES = {
  gore: { windup: 0.62, active: 0.28, recover: 0.6, dmg: 34, poise: 42, reach: 5.2, arc: 0.7 },
  charge: { windup: 0.85, run: 1.4, recover: 0.9, speed: 19, dmg: 40, poise: 70 },
  burrow: { down: 0.8, under: 1.6, up: 0.5, recover: 0.8, dmg: 30 },
  beam: { windup: 1.0, active: 1.2, recover: 0.7, dmg: 10, burn: 16 },
  buzz: { windup: 0.6, active: 0.4, recover: 0.6 },
};

export class Scarab extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root);
    this.game.combat.unregister(this);
    this.tag = 'scarab';
    this.name = 'Solkar, the Sun Scarab';
    this.isBoss = true;
    this.bossId = 'solkar';
    this.flag = 'solkarDead';
    this.music = 'fire';
    this.intro = { title: 'Wheel of the Old Sun', open: 'slam', roar: 'roarBig', scale: 1.8, lift: 0.8, roarAt: [6, 3.5] };
    this.reward = { gear: 'scarab_horn', banner: ['The Sun Sets', 'Solkar, the Sun Scarab'] };
    this.model = buildScarab();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 2300;
    this.maxPoise = 180;
    this.ash = 5000;
    this.radius = 2.4;
    this.height = 3.6;
    this.lockHeight = 2.4;
    this.leash = Infinity;
    this.returnSpeed = 6;
    this.accel = 5;
    this.parryable = new Set(['gore']);
    this.parriedTime = 2.0;
    this.knockdownTime = 2.6;
    this.burnResist = 0;
    this._enter();
  }

  _onReset() {
    super._onReset();
    this.phase = 1;
    this.recentDmg = 0;
    this.recentT = 0;
    this.lockable = false;
    this.move = null;
    this.under = false;
    this.invuln = false;
    this.roared = false;
    this.burrowCd = 6;
    this.model.root.visible = true;
    if (this.game.state?.flags?.solkarDead) {
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

  enter() { return { x: SANCTUM.x - 26, z: SANCTUM.z, yaw: Math.PI / 2 }; }
  arena() { return { x: SANCTUM.x, z: SANCTUM.z, leash: SANCTUM.leash }; }
  busy() { return !!this.move || this.state === 'phase' || this.state === 'wake'; }

  takeHit(hit) {
    if (this.state === 'idle' || !this.alive || this.under) return false;
    const before = this.hp;
    const r = super.takeHit(hit);
    const d = before - Math.max(0, this.hp);
    if (d > 0) {
      this.recentDmg = this.recentT > 0 ? this.recentDmg + d : d;
      this.recentT = 2.2;
    }
    if (this.state === 'hurt' || this.state === 'knockdown') this.move = null;
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
    this.under = false;
    const r = super._die(hit);
    this.lockable = false;
    this.game.onFoeBossDefeated(this);
    return r;
  }

  update(dt) {
    if (this.recentT > 0) this.recentT -= dt;
    if (this.burrowCd > 0) this.burrowCd -= dt;
    super.update(dt);
  }

  _engage() {
    this.move = null;
    this.under = false;
    this.invuln = false;
    this._setState('stalk');
    this.cooldown = Math.max(this.cooldown, 0.5 + Math.random() * 0.6);
  }

  _think(dt, c) {
    const g = this.game, p = c.p;
    if (this.state === 'idle') {
      // Buried: only a mound of sand, breathing.
      if (Math.random() < dt * 2) this._sand(1, 0.6);
      const pd = Math.hypot(p.pos.x - SANCTUM.x, p.pos.z - SANCTUM.z);
      if (p.alive && pd < SANCTUM.trigger && !g.cutscene && !g.fieldBoss) g.startFoeFight(this);
      return false;
    }
    if (this.state === 'wake') {
      this.turnTo(c.toP, 1.5, dt);
      const L = this.introLen, burst = L > 4 ? 2.4 : 0.2;
      if (!this.roared && this.t > burst) {
        this.roared = true;
        g.audio.play('roarBig');
        g.audio.play('slam');
        this._sand(60, 4);
        g.cameraShake(0.4);
      }
      if (this.t >= L) { this._engage(); this.cooldown = 0.8; }
      return false;
    }
    const pd = Math.hypot(p.pos.x - SANCTUM.x, p.pos.z - SANCTUM.z);
    if (!p.alive || pd > SANCTUM.leash) {
      g.endFoeFight();
      return false;
    }
    if (this.phase === 1 && this.state !== 'phase' && this.hp <= this.maxHp * 0.5 && !this.move) {
      this._setState('phase');
      this.roared = false;
    }
    if (this.state === 'phase') return this._rage(dt);
    if (this.move) return this._doMove(dt, c);
    const w = this.want, { dist, toP } = c;
    this.turnTo(toP, 3.2, dt);
    if (dist > 16) {
      w.x = Math.sin(toP) * 8;
      w.z = Math.cos(toP) * 8;
    } else {
      if ((this.flipT -= dt) <= 0) { this.strafe *= -1; this.flipT = 2.5 + Math.random() * 2.5; }
      const side = toP + (Math.PI / 2) * this.strafe;
      const ring = this.cooldown < 1 ? 5 : 8.5;
      const radial = clamp((dist - ring) * 1.2, -3.5, 6);
      w.x = Math.sin(side) * 2.4 + Math.sin(toP) * radial;
      w.z = Math.cos(side) * 2.4 + Math.cos(toP) * radial;
    }
    if ((this.cooldown -= dt) <= 0 && p.alive) this._pick(c);
    return true;
  }

  _pick(c) {
    const { dist, toP } = c;
    const flank = Math.abs(angleDiff(this.yaw, toP)) > 1.1;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 6.5) opts.push(['gore', flank ? 0.8 : 3]);
    if (dist < 5) opts.push(['buzz', flank ? 3 : 1]);
    if (dist > 8 && dist < 30 && !flank) opts.push(['charge', 2.5]);
    if (dist > 6 && dist < 22 && !flank) opts.push(['beam', p2 ? 2.5 : 1.6]);
    if (this.burrowCd <= 0) opts.push(['burrow', p2 ? 4 : 2]);
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
    this.landed = false;
    this.tick = 0;
    if (id === 'burrow') this.burrowCd = this.phase === 2 ? 7 : 12;
    if (id === 'gore') this.game.audio.playAt('snarl', this.pos, 60);
  }

  _finish(cd) {
    this.move = null;
    this.under = false;
    this.invuln = false;
    this._setState('stalk');
    this.cooldown = cd * (this.phase === 2 ? 0.7 : 1);
  }

  _doMove(dt, c) {
    const g = this.game, t = this.t;
    switch (this.move) {
      case 'gore': {
        const M = MOVES.gore;
        if (t < M.windup) {
          this.turnTo(c.toP, 4, dt);
          this.vel.multiplyScalar(Math.exp(-8 * dt));
        } else if (t < M.windup + M.active) {
          if (!this.fired) {
            this.fired = true;
            const sp = clamp((c.dist - 3) / M.active, 2, 12);
            this.vel.set(this.forwardX * sp, 0, this.forwardZ * sp);
            g.audio.playAt('heavySwing', this.pos);
          }
          g.combat.melee(this, { dmg: M.dmg, poise: M.poise, reach: M.reach, arc: M.arc, height: 4, knock: 5, heavy: true }, this.hitSet);
        } else {
          this.vel.multiplyScalar(Math.exp(-6 * dt));
          if (t >= M.windup + M.active + M.recover) this._finish(1.0 + Math.random() * 0.6);
        }
        return false;
      }
      case 'charge': {
        const M = MOVES.charge;
        if (t < M.windup) {
          // Pawing the sand, lowering the horn: the tell.
          this.turnTo(c.toP, 3, dt);
          this.vel.multiplyScalar(Math.exp(-8 * dt));
          if (Math.random() < dt * 12) this._sand(2, 1);
        } else if (t < M.windup + M.run) {
          if (!this.fired) { this.fired = true; g.audio.playAt('roarBig', this.pos, 70); }
          this.turnTo(c.toP, 0.6, dt);
          this.vel.set(this.forwardX * M.speed, 0, this.forwardZ * M.speed);
          g.combat.melee(this, { dmg: M.dmg, poise: M.poise, reach: 3.6, arc: 0.9, height: 4, knock: 9, heavy: true }, this.hitSet);
          if (Math.random() < dt * 20) this._sand(2, 1.2);
          // Into the Sanctum's columns: it stops dead and staggers.
          if (Math.hypot(this.pos.x - SANCTUM.x, this.pos.z - SANCTUM.z) > SANCTUM.r - 3) {
            this.t = M.windup + M.run;
            g.audio.playAt('slam', this.pos, 70);
            g.cameraShake(0.3);
          }
        } else {
          this.vel.multiplyScalar(Math.exp(-5 * dt));
          if (t >= M.windup + M.run + M.recover) this._finish(1.2);
        }
        return false;
      }
      case 'burrow': {
        const M = MOVES.burrow;
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (t < M.down) {
          if (Math.random() < dt * 30) this._sand(3, 1.5);
        } else if (t < M.down + M.under) {
          // Under the sand: a racing mound, then a warning circle where it will come up.
          if (!this.under) { this.under = true; this.invuln = true; g.audio.playAt('slam', this.pos, 60); }
          const to = Math.atan2(c.p.pos.x - this.pos.x, c.p.pos.z - this.pos.z);
          const sp = Math.min(c.dist / 0.25, 16);
          this.vel.set(Math.sin(to) * sp, 0, Math.cos(to) * sp);
          if (Math.random() < dt * 40) this._sand(2, 0.8);
          if (!this.fired && t > M.down + M.under - 0.7) {
            this.fired = true;
            this.upAt = { x: c.p.pos.x, z: c.p.pos.z };
            g.effects.lightning(this, this.upAt.x, this.upAt.z, 0.7, { radius: 3.2, noBolt: true, color: 0xe8c080 }); // where it will come up
          }
        } else if (!this.landed) {
          this.landed = true;
          this.under = false;
          this.invuln = false;
          if (this.upAt) this.pos.set(this.upAt.x, this.pos.y, this.upAt.z);
          g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 9, speed: 14, color: 0xe8c080, hit: { dmg: M.dmg, poise: 50, knock: 7, heavy: true } });
          g.combat.sphere(this, { x: this.pos.x, y: this.pos.y + 1, z: this.pos.z }, 3.2, { dmg: M.dmg, poise: 60, heavy: true, knock: 8 }, this.hitSet);
          if (this.phase === 2) for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            g.effects.hazard(this, this.pos.x + Math.sin(a) * 6, this.pos.z + Math.cos(a) * 6, { radius: 2, life: 4, look: 'fire', color: 0xffc040, hit: { dmg: 4, poise: 0, burn: 14, unblockable: true } });
          }
          g.audio.playAt('slam', this.pos, 80);
          g.cameraShake(0.45);
          this._sand(70, 5);
        } else if (t >= M.down + M.under + M.up + M.recover) {
          this._finish(1.0);
        }
        return false;
      }
      case 'beam': {
        const M = MOVES.beam;
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (t < M.windup) {
          this.turnTo(c.toP, 3, dt);
        } else if (t < M.windup + M.active) {
          this.turnTo(c.toP, 0.9, dt);
          if ((this.tick -= dt) <= 0) {
            this.tick = 0.12;
            const x = this.pos.x, y = this.pos.y + 2.8 * (this.size / SIZE), z = this.pos.z;
            const a = this.yaw + (Math.random() - 0.5) * 0.06;
            g.projectiles.spawn(this, {
              kind: 'fire', x: x + Math.sin(a) * 1.5, y, z: z + Math.cos(a) * 1.5, dirX: Math.sin(a), dirY: (c.p.pos.y + 1 - y) / Math.max(4, c.dist), dirZ: Math.cos(a),
              speed: 30, radius: 0.55, life: 1.0, scale: 1.4, color: 0xffd040, color2: 0xfff4c0,
              hit: { dmg: M.dmg, poise: 8, burn: M.burn, parryable: false },
            });
          }
        } else if (t >= M.windup + M.active + M.recover) {
          this._finish(1.4);
        }
        return false;
      }
      case 'buzz': {
        const M = MOVES.buzz;
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (!this.fired && t >= M.windup) {
          this.fired = true;
          g.audio.playAt('wings', this.pos, 70);
          g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 9, speed: 15, color: 0xe8c080, hit: { dmg: 12, poise: 50, knock: 9, unblockable: true } });
          this._sand(50, 2);
        }
        if (t >= M.windup + M.active + M.recover) this._finish(1.0);
        return false;
      }
    }
    this.move = null;
    return false;
  }

  // Half health: the sun on its back flares and a sandstorm fills the Sanctum.
  _rage(dt) {
    const g = this.game, t = this.t;
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = t < 1.2;
    if (!this.roared && t > 0.8) {
      this.roared = true;
      this.phase = 2;
      g.audio.playAt('roarBig', this.pos, 100);
      g.cameraShake(0.45);
      g.weatherLock = true;
      g.world.setWeather('sandstorm');
      g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 13, speed: 13, color: 0xffd040, hit: { dmg: 18, poise: 30, burn: 30, knock: 6, unblockable: true } });
      this.burrowCd = 0;
    }
    if (t >= 2.4) { this.invuln = false; this._engage(); this.cooldown = 0.4; }
    return false;
  }

  onFightEnd() {
    const g = this.game;
    if (g.weatherLock) {
      g.weatherLock = false;
      g.weatherRegion = null;
    }
  }

  _sand(count, spread) {
    const g = this.game;
    g.particles.emit({ x: this.pos.x, y: g.world.getHeight(this.pos.x, this.pos.z) + 0.4, z: this.pos.z, count, speed: 4, up: 3, color: 0xe8c080, color2: 0xc89050, life: [0.5, 1.1], size: [0.15, 0.35], drag: 2, gravity: 5, jitter: spread });
  }

  // ---------- animation ----------

  _pose(T, o, dt) {
    const t = this.t;
    this.wingOpen = 0;
    this.sunk = 0;
    switch (this.state) {
      case 'idle': this.sunk = 1; T.y = -0.5; o.legs = 'fold'; o.k = dampK(4, dt); return;
      case 'wake': {
        const burst = this.introLen > 4 ? 2.4 : 0.2;
        this.sunk = t < burst ? 1 : Math.max(0, 1 - (t - burst) * 2);
        if (t > burst && t < burst + 2.4) { T.x = -0.45; T.neck = -0.8; T.jaw = 1; o.legs = 'rear'; this.wingOpen = 1; }
        o.k = dampK(6, dt);
        return;
      }
      case 'gore': {
        const M = MOVES.gore;
        if (t < M.windup) { T.y = -0.12; T.x = 0.15; T.neck = 0.5; T.head = 0.4; o.legs = 'coil'; o.k = dampK(12, dt); }
        else if (t < M.windup + M.active) { T.x = -0.25; T.neck = -0.5; T.head = -0.5; T.jaw = 1; o.legs = 'stretch'; o.k = dampK(24, dt); }
        return;
      }
      case 'charge': {
        const M = MOVES.charge;
        if (t < M.windup) { T.y = -0.15; T.x = 0.18; T.neck = 0.5; T.head = 0.5; o.legs = 'coil'; o.k = dampK(10, dt); }
        else if (t < M.windup + M.run) { T.x = 0.12; T.neck = 0.35; T.head = 0.35; o.k = dampK(14, dt); }
        else { T.z = Math.sin(t * 12) * 0.08; T.neck = -0.2; }
        return;
      }
      case 'burrow': {
        const M = MOVES.burrow;
        if (t < M.down) { this.sunk = t / M.down; T.y = -0.4 * this.sunk; o.legs = 'coil'; }
        else if (!this.landed) { this.sunk = 1; T.y = -0.6; o.legs = 'fold'; }
        else { this.sunk = Math.max(0, 1 - (t - M.down - M.under) * 4); T.x = -0.4; T.neck = -0.6; T.jaw = 1; o.legs = 'rear'; this.wingOpen = 1; }
        o.k = dampK(10, dt);
        return;
      }
      case 'beam': {
        const M = MOVES.beam;
        this.wingOpen = t < M.windup ? t / M.windup : t < M.windup + M.active ? 1 : 0;
        T.y = -0.1; T.neck = 0.3; o.legs = 'coil'; o.k = dampK(8, dt);
        return;
      }
      case 'buzz': this.wingOpen = this.t < MOVES.buzz.windup ? 0.6 : 1; T.y = 0.05; o.k = dampK(14, dt); return;
      case 'phase': this.wingOpen = 1; T.x = -0.45; T.neck = -0.8; T.jaw = 1; o.legs = 'rear'; o.k = dampK(8, dt); return;
    }
    super._pose(T, o, dt);
  }

  _animate(dt) {
    super._animate(dt);
    const m = this.model;
    // Sunk into the sand while buried; wing-cases lift and buzz when it beams or flies at you.
    const sunk = this.sunk ?? 0;
    m.root.position.y = this.pos.y - sunk * 2.4 * (this.size / SIZE);
    const buzz = this.state === 'buzz' || (this.state === 'beam' && this.wingOpen >= 1);
    for (const w of m.wings) {
      const z = w.side * (this.wingOpen * 0.9 + (buzz ? Math.sin(this.game.time * 40) * 0.15 : 0));
      w.wing.rotation.z += (z - w.wing.rotation.z) * dampK(14, dt);
      w.wing.rotation.x += (-this.wingOpen * 0.3 - w.wing.rotation.x) * dampK(14, dt);
    }
    const flare = this.state === 'beam' && this.t > MOVES.beam.windup * 0.5 ? 4 : this.phase === 2 ? 2.8 : 1.8;
    m.sun.emissiveIntensity += (flare - m.sun.emissiveIntensity) * dampK(6, dt);
    m.glow.material.opacity = 0.35 + (flare - 1.8) * 0.15;
  }

  _sync() {
    super._sync();
    if (this.model && this.sunk) this.model.root.position.y = this.pos.y - this.sunk * 2.4 * (this.size / SIZE);
  }
}
