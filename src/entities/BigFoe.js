// Shared base for humanoid bosses that run their own fights out in the world (Grimhorn the troll,
// Saelith). A subclass supplies the model, its stats and:
//   moves      { name: { windup, active, recover, track, pose, lunge?, melee?: hit, fire?(self, c),
//                         parry?: true, cd?, next?: [name, chance] } }
//   poses      { rest, roar, hurt, parried, riposted, dead, [move poses as [wind, strike]] }
//   _pick(c)   chooses the next move name (or null to keep circling)
//   arena()    { x, z, leash }: the fight ends when the player leaves `leash` metres of (x, z)
//   _sees(c)   true when the sleeping/idle boss notices the player (starts the fight)
// optional: _idle(dt, c), _phase(dt, c) (the phase-two transition), _wakePose(p, t), _onWake(t)
// It handles the rest: waking (timed to a cutscene when there is one), circling, running moves with
// wind-up, active frames, lunges, chained follow-ups, the phase-two switch at `phaseAt` of health,
// the boss bar's damage counter, and staying dead once beaten (state.flags[flag]).
// An `elite` (the Cinder Golems) uses the same moveset machinery as an ordinary foe instead: no boss
// fight, no bar, leashed to its post, back on its feet after you rest.
import { Foe } from './Foe.js';
import { pose, copyPose, applyPose, attackPose, addGait, framePose } from '../models/pose.js';
import { clamp, damp, dampK, easeOut } from '../core/math.js';

export class BigFoe extends Foe {
  constructor(game, spawn) {
    super(game, spawn);
    this.isBoss = true;
    this.leash = Infinity; // the arena decides when the fight ends, not the post
    this.phaseAt = 0.5;
    this.pace = 1;
    this.ring = 4; // preferred distance while circling
    this.chaseSpeed = 5;
    this.circleSpeed = 1.6;
    this.dmgMul = 1;
    this.parryable = new Set(['attack']);
    this.poseBuf = pose();
    this.gait = 0;
  }

  _onReset() {
    this.phase = 1;
    this.pace = 1;
    this.recentDmg = 0;
    this.recentT = 0;
    this.move = null;
    this.chainT = 0;
    this.invuln = false;
    this.lockable = false;
    this.flipT = 2;
    copyPose(this.poseBuf, this.poses.rest);
    applyPose(this.model, this.poseBuf, 1);
    if (this.elite) this.lockable = true;
    if (this.flag && this.game.state?.flags?.[this.flag]) {
      // Beaten for good.
      this.alive = false;
      this.state = 'dead';
      this.t = 99;
      this.shown = false;
    }
  }

  awaken(len = 1.6) {
    this._setState('wake');
    this.introLen = len;
    this.lockable = true;
    this.woke = {};
  }

  busy() { return !!this.move || this.state === 'phase' || this.state === 'wake'; }

  // ---------- combat hooks ----------

  takeHit(hit) {
    if (!this.alive) return false;
    if (this.state === 'idle' && !this.hitWhileIdle && !this.elite) return false;
    if (!this.elite && (this.state === 'idle' || this.state === 'return')) this.game.startFoeFight(this, { cutscene: false });
    const before = this.hp;
    // Bosses shrug off ordinary flinches mid-move: only poise breaks (or ripostes) stagger them.
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
    if (!this.move?.parry) return;
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
    this.invuln = false;
    const r = super._die(hit);
    this.lockable = false;
    if (!this.elite) this.game.onFoeBossDefeated(this);
    return r;
  }

  // ---------- behaviour ----------

  update(dt) {
    if (this.recentT > 0) this.recentT -= dt;
    super.update(dt);
  }

  _engage() {
    this.move = null;
    this._setState('chase');
    this.cooldown = Math.max(this.cooldown, 0.4 + Math.random() * 0.5);
  }

  _think(dt, c) {
    const g = this.game, p = c.p;
    if (this.state === 'idle') {
      this._idle?.(dt, c);
      if (this.elite) {
        if (p.alive && this._sees(c)) { this.awaken(); this._onAlert?.(); }
        return true;
      }
      if (p.alive && !g.cutscene && !g.fieldBoss && this._sees(c)) g.startFoeFight(this);
      return true;
    }
    if (this.state === 'wake') {
      this._onWake?.(this.t, dt, c);
      if (this.t >= this.introLen) {
        this._engage();
        this.cooldown = 0.6;
      }
      return false;
    }
    if (!this.elite) {
      const A = this.arena();
      if (!p.alive || Math.hypot(p.pos.x - A.x, p.pos.z - A.z) > A.leash) {
        g.endFoeFight();
        return false;
      }
    }
    if (this.phase === 1 && this.state !== 'phase' && !this.move && this.hp <= this.maxHp * this.phaseAt) {
      this._setState('phase');
      this.phased = false;
    }
    if (this.state === 'phase') return this._phase(dt, c);
    if (this.move) return this._runMove(dt, c);

    const w = this.want, { dist, toP } = c;
    this.turnTo(toP, 4, dt);
    if (dist > this.ring + 5) {
      w.x = Math.sin(toP) * this.chaseSpeed;
      w.z = Math.cos(toP) * this.chaseSpeed;
    } else {
      if ((this.flipT -= dt) <= 0) { this.strafe *= -1; this.flipT = 2 + Math.random() * 2.5; }
      const side = toP + (Math.PI / 2) * this.strafe;
      const ring = this.cooldown < 0.8 ? this.ring * 0.7 : this.ring + 1.5;
      const radial = clamp((dist - ring) * 1.4, -3, 5);
      w.x = Math.sin(side) * this.circleSpeed + Math.sin(toP) * radial;
      w.z = Math.cos(side) * this.circleSpeed + Math.cos(toP) * radial;
    }
    if ((this.cooldown -= dt) <= 0 && p.alive) {
      const name = this._pick(c);
      if (name) this._startMove(name);
    }
    return true;
  }

  _startMove(name) {
    const M = this.moves[name];
    const k = this.pace;
    this.move = { ...M, name, windup: M.windup * k, recover: M.recover * k };
    this._setState('attack');
    this.hitSet = new Set();
    this.fired = false;
    this.swung = false;
    M.start?.(this);
  }

  _runMove(dt, c) {
    const M = this.move, t = this.t;
    const tw = M.windup, ta = tw + M.active;
    if (t < tw) this.turnTo(c.toP, M.track ?? 3, dt);
    const lunge = M.lunge && t > tw * 0.75 && t < ta ? M.lunge : 0;
    this.vel.x = damp(this.vel.x, this.forwardX * lunge, lunge ? 14 : 8, dt);
    this.vel.z = damp(this.vel.z, this.forwardZ * lunge, lunge ? 14 : 8, dt);
    if (!this.swung && t >= tw * 0.85) {
      this.swung = true;
      if (M.melee) this.game.audio.playAt('heavySwing', this.pos);
    }
    if (!this.fired && t >= tw) {
      this.fired = true;
      M.fire?.(this, c);
    }
    if (M.melee && t >= tw && t < ta) {
      this.game.combat.melee(this, { ...M.melee, dmg: M.melee.dmg * this.dmgMul, parryable: !!M.parry }, this.hitSet);
    }
    if (t >= ta + M.recover) {
      const nx = M.next;
      if (nx && Math.random() < nx[1] * (this.phase === 2 ? 1.4 : 1)) {
        this._startMove(nx[0]);
        return false;
      }
      this.move = null;
      this._setState('chase');
      this.cooldown = (M.cd ?? 1.2) * (this.phase === 2 ? 0.7 : 1);
      this.strafe = Math.random() < 0.5 ? -1 : 1;
    }
    return false;
  }

  // ---------- animation ----------

  _animate(dt) {
    const p = this.poseBuf, P = this.poses;
    let k = dampK(12, dt);
    switch (this.state) {
      case 'attack': {
        const M = this.move;
        const [wind, strike] = P[M.pose];
        attackPose(p, P.rest, wind, strike, this.t, M.windup, M.active, M.recover, easeOut);
        k = dampK(this.t < M.windup ? 10 : 22, dt);
        break;
      }
      case 'wake':
        this._wakePose(p, this.t);
        k = dampK(5, dt);
        break;
      case 'phase':
        copyPose(p, P.roar);
        p.torsoZ += this.t > 0.6 ? Math.sin(this.t * 18) * 0.03 : 0;
        k = dampK(8, dt);
        break;
      case 'hurt': copyPose(p, P.hurt); k = dampK(18, dt); break;
      case 'parried':
        copyPose(p, P.parried);
        p.torsoZ += Math.sin(this.t * 8) * 0.06 * Math.max(0, 1 - this.t / this.parriedTime);
        k = dampK(this.t < 0.2 ? 22 : 6, dt);
        break;
      case 'riposted': copyPose(p, P.riposted); k = dampK(14, dt); break;
      case 'knockdown': framePose(p, this.knockKeys, this.t, easeOut); k = dampK(10, dt); break;
      case 'dead': copyPose(p, P.dead); k = dampK(5, dt); p.pivotH -= clamp(this.t - 2.2, 0, 1.4) * 0.4; break;
      default: {
        copyPose(p, P.rest);
        const sp = Math.hypot(this.vel.x, this.vel.z) / (this.size ?? 1);
        this.gait += dt * (1.6 + sp * 1.6);
        addGait(p, this.gait, clamp(sp / 3, 0, 0.9), 0.3);
        p.torsoX += Math.sin(this.game.time * 1.3 + this.spawn.x) * 0.03;
      }
    }
    applyPose(this.model, p, k);
  }
}
