// Sir Corvel, the Ashen Rider: a knight of the old watch who rode out the night the Gate fell and never
// came back. He rides the Vale's old road after dark, walking his black horse up and down between the
// shrine and the Watch Ruins, and is gone at dawn. Mounted, he fights at the gallop: charges with the
// halberd couched (no parrying a horse), wide sweeps from the saddle (parryable), an overhead chop, the
// horse rearing and stamping fire out of the road, and burning javelins at anyone who keeps away. At
// half health the horse's mane catches fully alight and every charge leaves a trail of fire behind it.
import { BigFoe } from './BigFoe.js';
import { buildAshenRider } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { angleDiff, clamp, damp } from '../core/math.js';

// The rider's legs straddle the saddle whatever his arms are doing.
const SEAT = { lRx: -1.45, lRz: -0.45, kR: 1.45, lLx: -1.45, lLz: 0.45, kL: 1.45, hipsH: 0 };
const P = (o) => pose({ ...o, ...SEAT });
const POSES = {
  rest: P({ sRx: -0.5, eR: -1.0, hRx: 1.4, sLx: -0.7, eL: -1.2, torsoX: 0.05 }),
  roar: P({ sRx: -2.8, eR: -0.3, hRx: 1.2, sLx: -0.7, eL: -1.2, torsoX: -0.35, headX: -0.4 }),
  charge: [P({ sRx: -0.3, eR: -0.5, hRx: 1.65, sLx: -0.7, eL: -1.2, torsoX: 0.35, headX: -0.2 }),
    P({ sRx: -1.45, eR: -0.05, hRx: 1.6, sLx: -0.7, eL: -1.2, torsoX: 0.5, headX: -0.3 })],
  sweep: [P({ sRx: -1.3, sRy: -1.7, eR: -0.3, hRx: 1.5, torsoY: -1.1, sLx: -0.7, eL: -1.2 }),
    P({ sRx: -1.25, sRy: 1.35, eR: -0.1, hRx: 1.5, torsoY: 1.0, torsoX: 0.2, sLx: -0.7, eL: -1.2 })],
  overhead: [P({ sRx: -3.0, eR: -0.5, hRx: 1.2, torsoX: -0.35, headX: -0.2, sLx: -0.7, eL: -1.2 }),
    P({ sRx: -0.9, eR: -0.1, hRx: 1.5, torsoX: 0.55, sLx: -0.7, eL: -1.2 })],
  rear: [P({ sRx: -2.7, eR: -0.2, hRx: 1.2, sLx: -1.2, eL: -0.4, torsoX: 0.4, headX: -0.3 }),
    P({ sRx: -1.6, eR: -0.2, hRx: 1.5, sLx: -0.7, eL: -1.2, torsoX: 0.25 })],
  hurl: [P({ sRx: 0.4, sRz: -0.4, eR: -1.4, hRx: 1.6, torsoY: -0.8, sLx: -0.7, eL: -1.2 }),
    P({ sRx: -2.4, eR: -0.1, hRx: 1.4, torsoY: 0.6, torsoX: 0.3, sLx: -0.7, eL: -1.2 })],
  hurt: P({ torsoX: -0.4, headX: -0.3, sRz: -0.5, sLz: 0.5, sRx: -0.4, eR: -0.9, hRx: 1.4 }),
  parried: P({ sRx: -2.6, sRz: -0.5, eR: -0.3, hRx: 1.0, torsoX: -0.5, headX: -0.4, sLz: 0.6, eL: -0.6 }),
  riposted: P({ torsoX: 0.7, headX: 0.4, sRx: -0.3, sRz: -0.4, eR: -0.2, hRx: 1.0, sLx: -0.4, sLz: 0.4, eL: -0.4 }),
  dead: P({ torsoX: 1.1, headX: 0.6, sRz: -0.9, sLz: 0.9, sRx: 0.2, eR: -0.2 }),
};
const KNOCKDOWN = 2.0;
// His beat along the old road, at night.
const ROUTE = [[-10, 112], [2, 60], [14, 20], [2, 60]];

export class AshenRider extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'ashenrider';
    this.name = 'Sir Corvel, the Ashen Rider';
    this.bossId = 'corvel';
    this.flag = 'corvelDead';
    this.music = 'rider';
    this.intro = { title: 'The Rider on the Old Road', open: 'roarBig', roar: 'roarBig', scale: 1.0, lift: -0.4, roarAt: [5.2, 2.2] };
    this.reward = { gear: 'ashen_halberd', banner: ['The Road Is Quiet', 'Sir Corvel, the Ashen Rider'] };
    this.model = buildAshenRider();
    this.size = 1.6;
    this.maxHp = 1800;
    this.maxPoise = 130;
    this.ash = 4200;
    this.radius = 1.1;
    this.height = 3.2;
    this.lockHeight = 2.4;
    this.accel = 3.5;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 1.6;
    this.ring = 8;
    this.chaseSpeed = 9;
    this.circleSpeed = 5;
    this.poses = POSES;
    this.trailLen = 2.3;
    this.trailColor = 0xffa060;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.hurt], [KNOCKDOWN - 0.6, POSES.hurt], [KNOCKDOWN, POSES.rest]];
    this.moves = {
      charge: {
        windup: 0.75, active: 1.3, recover: 1.0, track: 3, pose: 'charge', lunge: 17, cd: 1.4,
        start: (self) => self.game.audio.playAt('roarBig', self.pos, 60),
        melee: { reach: 3.4, arc: 0.8, dmg: 42, poise: 70, heavy: true, height: 4, knock: 9 },
      },
      sweep: { windup: 0.7, active: 0.22, recover: 0.6, track: 4, pose: 'sweep', parry: true, cd: 1.0, lunge: 6, melee: { reach: 4.8, arc: 1.5, dmg: 32, poise: 34, height: 4, knock: 5 } },
      overhead: { windup: 0.85, active: 0.18, recover: 0.7, track: 3, pose: 'overhead', parry: true, cd: 1.2, lunge: 4, melee: { reach: 4.6, arc: 0.5, dmg: 40, poise: 50, heavy: true, height: 4, knock: 6 }, fire: (self) => self._embers(3.5, 2.4) },
      rear: { windup: 0.9, active: 0.12, recover: 0.9, track: 1, pose: 'rear', cd: 1.3, start: (self) => self.game.audio.playAt('roarBig', self.pos, 70), fire: (self) => self._stamp() },
      hurl: { windup: 0.8, active: 0.1, recover: 0.6, track: 5, pose: 'hurl', cd: 1.2, fire: (self, c) => self._hurl(c.p) },
    };
    this.route = 0;
    this._enter();
  }

  enter() { return { x: this.spawn.x + 26, z: this.spawn.z, yaw: -Math.PI / 2 }; }
  arena() { return { x: this.spawn.x, z: this.spawn.z, leash: 75 }; }
  get night() { return (this.game.sky?.night ?? 0) > 0.55; }
  _sees(c) { return this.night && c.dist < 24; }

  _onReset() {
    super._onReset();
    this.route = 0;
    this.trailT = 0;
  }

  // At night he walks his horse up and down the road; by day he isn't there at all.
  _idle(dt) {
    const night = this.night;
    this.shown = night && this.alive;
    this.invuln = !night;
    if (!night) {
      this.pos.set(this.spawn.x, this.pos.y, this.spawn.z);
      return;
    }
    const [tx, tz] = ROUTE[this.route];
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 3) this.route = (this.route + 1) % ROUTE.length;
    this.turnTo(Math.atan2(dx, dz), 1.5, dt);
    this.want.x = this.forwardX * 2.6;
    this.want.z = this.forwardZ * 2.6;
    if (!this.game.state.flags.riderHeard && Math.hypot(this.game.player.pos.x - this.pos.x, this.game.player.pos.z - this.pos.z) < 90) {
      this.game.state.flags.riderHeard = true;
      this.game.hud.toast('Hoofbeats on the old road, though nobody rides it any more.');
    }
  }

  awaken(len) {
    super.awaken(len ?? 1.4);
    this.shown = true;
    this.invuln = false;
    this.game.audio.playAt('roarBig', this.pos, 100);
  }

  _wakePose(p) { Object.assign(p, POSES.roar); }
  _onWake(t, dt, c) { this.turnTo(c.toP, 2, dt); }

  _pick(c) {
    const { dist, toP } = c;
    const ahead = Math.abs(angleDiff(this.yaw, toP)) < 0.7;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 6) opts.push(['sweep', 3], ['overhead', 1.6], ['rear', p2 ? 2 : 1.2]);
    if (dist > 7 && dist < 30 && ahead) opts.push(['charge', p2 ? 4 : 3]);
    if (dist > 9 && dist < 32) opts.push(['hurl', 1.5]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  // The horse rears and comes down with both forefeet: fire bursts out of the road.
  _stamp() {
    const g = this.game;
    const x = this.pos.x + this.forwardX * 2, z = this.pos.z + this.forwardZ * 2;
    g.effects.shockwave(this, x, z, { maxR: 7, speed: 13, color: 0xff8a3a, hit: { dmg: 28, poise: 50, knock: 7, burn: 20, unblockable: true } });
    this._embers(2, this.phase === 2 ? 3.4 : 2.6);
    g.audio.playAt('slam', this.pos, 80);
    g.cameraShake(0.35, Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 14 ? 1 : 0.4);
  }

  _embers(ahead, r) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.hazard(this, x, z, { radius: r, life: 4, look: 'fire', hit: { dmg: 5, poise: 0, burn: 16, unblockable: true } });
  }

  // A javelin of grave-fire, led a little against a runner.
  _hurl(p) {
    const g = this.game;
    const sx = this.pos.x + this.forwardX, sy = this.pos.y + 3.6, sz = this.pos.z + this.forwardZ;
    const flight = Math.hypot(p.pos.x - sx, p.pos.z - sz) / 30;
    const tx = p.pos.x + p.vel.x * flight * 0.6, tz = p.pos.z + p.vel.z * flight * 0.6;
    g.projectiles.spawn(this, {
      kind: 'fire', x: sx, y: sy, z: sz, dirX: tx - sx, dirY: p.pos.y + 1 - sy, dirZ: tz - sz,
      speed: 30, radius: 0.5, life: 1.6, scale: 1.6, hit: { dmg: 26, poise: 30, burn: 30, knock: 4, parryable: false }, sound: 'ignite',
      onBurst: (pr) => g.effects.hazard(this, pr.pos.x, pr.pos.z, { radius: 2, life: 3, look: 'fire', hit: { dmg: 4, poise: 0, burn: 14, unblockable: true } }),
    });
    g.audio.playAt('heavySwing', this.pos, 60);
  }

  update(dt) {
    super.update(dt);
    const M = this.move;
    // Phase two: charges leave a trail of fire.
    if (this.alive && this.phase === 2 && M?.name === 'charge' && this.t > M.windup && this.t < M.windup + M.active && (this.trailT -= dt) <= 0) {
      this.trailT = 0.14;
      this.game.effects.hazard(this, this.pos.x - this.forwardX * 2, this.pos.z - this.forwardZ * 2, { radius: 1.6, life: 3.5, look: 'fire', hit: { dmg: 4, poise: 0, burn: 14, unblockable: true } });
    }
    if (this.alive && this.shown && Math.random() < dt * (this.phase === 2 ? 30 : 12)) {
      const h = this.model.horse;
      h.neck.getWorldPosition(this._v ??= this.pos.clone());
      this.game.particles.emit({ x: this._v.x, y: this._v.y + 0.6, z: this._v.z, count: 1, speed: 0.6, up: 1.4, color: 0xff7a2a, color2: 0xffd080, life: [0.4, 0.9], size: [0.06, 0.12], jitter: 0.3 });
    }
    this.model.ember.emissiveIntensity = (this.phase === 2 ? 3 : 2) + Math.sin(this.game.time * 7) * 0.3;
  }

  // Half health: the horse rears and screams, fire bursts from the road all round, the mane takes light.
  _phase(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.2;
    if (!this.phased && this.t > 0.6) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.85;
      this.chaseSpeed = 10.5;
      const g = this.game;
      g.audio.playAt('roarBig', this.pos, 100);
      g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 9, speed: 14, color: 0xff8a3a, hit: { dmg: 24, poise: 50, knock: 8, burn: 30, unblockable: true } });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.effects.hazard(this, this.pos.x + Math.sin(a) * 6, this.pos.z + Math.cos(a) * 6, { radius: 2, life: 5, look: 'fire', hit: { dmg: 5, poise: 0, burn: 16, unblockable: true } });
      }
    }
    if (this.t >= 2.0) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }

  // The rider's arms come from the pose system; the horse runs its own gait under him.
  _animate(dt) {
    super._animate(dt);
    const m = this.model, h = m.horse, M = this.move;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const gallop = sp > 7;
    this.hgait = (this.hgait ?? 0) + dt * (gallop ? 6.5 + sp * 0.2 : 1.2 + sp * 1.05);
    const amp = clamp(sp / 7, 0, 1);
    // Rearing: the forehand lifts through the wind-up and comes down at the stamp.
    let rear = 0;
    if (this.state === 'attack' && M?.name === 'rear') rear = this.t < M.windup ? Math.sin((this.t / M.windup) * Math.PI * 0.5) : Math.max(0, 1 - (this.t - M.windup) / 0.18);
    if (this.state === 'phase') rear = Math.sin(clamp(this.t / 1.6, 0, 1) * Math.PI);
    const dead = this.state === 'dead' ? clamp(this.t / 1.2, 0, 1) : 0;
    for (const leg of h.legs) {
      const ph = this.hgait + (gallop ? leg.phaseGallop : leg.phaseWalk);
      let hip = Math.sin(ph) * (gallop ? 0.75 : 0.45) * amp;
      const bend = Math.max(0, Math.sin(ph + 1.3)) * (gallop ? 1.1 : 0.7) * amp;
      let knee = leg.front ? bend : -bend * 0.8;
      if (rear > 0) { hip = leg.front ? -1.0 * rear : 0.5 * rear; knee = leg.front ? 1.5 * rear : -0.6 * rear; }
      if (dead > 0) { hip = leg.front ? -1.2 * dead : 1.0 * dead; knee = leg.front ? 1.8 * dead : -1.6 * dead; }
      leg.hip.rotation.x = damp(leg.hip.rotation.x, hip, 18, dt);
      leg.knee.rotation.x = damp(leg.knee.rotation.x, knee, 18, dt);
    }
    h.body.position.y = 1.45 + Math.sin(this.hgait * (gallop ? 1 : 2)) * 0.05 * amp - dead * 0.9 + rear * 0.35;
    h.body.rotation.x = damp(h.body.rotation.x, Math.sin(this.hgait) * 0.06 * (gallop ? 1 : 0) - rear * 0.75, 10, dt);
    h.body.rotation.z = damp(h.body.rotation.z, dead * 0.5, 4, dt);
    h.neck.rotation.x = 0.65 + Math.sin(this.hgait + 0.6) * (0.08 + 0.1 * (gallop ? 1 : 0)) * amp - rear * 0.5 + Math.sin(this.game.time * 1.3) * 0.03;
    h.tail.rotation.x = -0.5 - clamp(sp / 17, 0, 1) * 0.6 + Math.sin(this.game.time * 3) * 0.05;
    // The rider rides the horse's back: he rises and pitches with it.
    m.rider.position.y = 1.1 + (h.body.position.y - 1.45) + rear * 0.6;
    m.rider.rotation.x = h.body.rotation.x * 0.8;
    m.rider.position.z = 0.05 - rear * 0.35;
    m.cloak.rotation.x = damp(m.cloak.rotation.x, 0.1 + clamp(sp, 0, 16) * 0.06, 6, dt);
  }
}
