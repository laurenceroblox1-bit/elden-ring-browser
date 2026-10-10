// Captain Morrow, the Drowned: master of the ship the sea threw up the beach. He waits on the sand by
// his wreck, looking out to sea, until someone comes aboard his stretch of shore. He swings the ship's
// anchor on its chain: a crushing overhead slam that throws up a wave, wide sweeps (parryable), and a
// long hooking lunge. At half health his lantern flares green, the tide answers him (rings of surf that
// knock you flat) and his drowned crew climb out of the shallows to help.
import { BigFoe } from './BigFoe.js';
import { buildCaptain } from '../models/creatures.js';
import { pose, copyPose, applyPose } from '../models/pose.js';
import { WRECK } from '../data/biomes.js';
import { angleDiff, dampK } from '../core/math.js';

const SIZE = 1.7;
const SW_A = pose({ sRx: -1.3, sRy: -1.6, eR: -0.3, hRx: 1.4, torsoY: -1.0, torsoX: 0.15, sLx: -0.3, eL: -0.5, kR: 0.25, kL: 0.25 });
const SW_B = pose({ sRx: -1.3, sRy: 1.35, eR: -0.1, hRx: 1.4, torsoY: 0.9, torsoX: 0.25, sLx: 0.2, eL: -0.3, kR: 0.25, kL: 0.25 });
const POSES = {
  rest: pose({ sRx: -0.25, eR: -0.4, hRx: 1.3, sLx: -0.1, eL: -0.6, torsoX: 0.1, headX: 0.05, kR: 0.1, kL: 0.1 }),
  watch: pose({ sRx: -0.1, eR: -0.2, hRx: 1.0, sLx: -0.2, eL: -1.4, sLy: 0.4, torsoX: -0.05, headX: -0.15 }),
  roar: pose({ sLx: -2.8, eL: -0.2, torsoX: -0.35, headX: -0.4, sRx: -0.4, eR: -0.6, hRx: 1.3, kR: 0.2, kL: 0.2 }),
  slam: [pose({ sRx: -3.0, eR: -0.7, hRx: 0.9, sLx: -2.8, eL: -0.7, torsoX: -0.35, headX: -0.3, kR: 0.2, kL: 0.2 }),
    pose({ sRx: -0.9, eR: -0.1, hRx: 1.5, sLx: -0.8, eL: -0.1, torsoX: 0.6, hipsH: -0.16, kR: 0.5, kL: 0.5, lRx: -0.4, lLx: -0.3 })],
  sweep: [SW_A, SW_B],
  sweepB: [SW_B, SW_A],
  hook: [pose({ sRx: -0.4, eR: -1.7, hRx: 2.0, torsoY: -0.7, lRx: 0.3, lLx: -0.4, kL: 0.3 }),
    pose({ sRx: -1.55, eR: 0, hRx: 1.55, torsoY: 0.4, torsoX: 0.35, hipsH: -0.12, lRx: -0.7, kR: 0.4, lLx: 0.45 })],
  tide: [pose({ sRx: -2.9, eR: -0.4, hRx: 0.6, sLx: -2.7, eL: -0.4, torsoX: -0.3, headX: -0.3 }),
    pose({ sRx: -1.0, eR: -0.2, hRx: 2.2, sLx: -0.9, eL: -0.2, torsoX: 0.6, hipsH: -0.2, kR: 0.5, kL: 0.5 })],
  hurt: pose({ torsoX: -0.3, headX: -0.3, sRz: -0.5, sLz: 0.5, sRx: -0.4, eR: -0.8, hRx: 1.3, hipsH: -0.06 }),
  parried: pose({ sRx: -2.6, sRz: -0.5, eR: -0.3, hRx: 1.0, torsoX: -0.45, headX: -0.4, sLz: 0.6, eL: -0.6, hipsH: -0.1, lRx: 0.4, kR: 0.3 }),
  riposted: pose({ torsoX: 0.6, headX: 0.35, sRx: -0.3, sRz: -0.4, eR: -0.2, hRx: 1.0, sLx: -0.4, sLz: 0.4, eL: -0.4, hipsH: -0.14, kR: 0.4, kL: 0.4 }),
  dead: pose({ pivotX: -1.45, pivotH: -0.72, sRz: -1.1, sLz: 1.0, lRx: -0.3 }),
};
const KNOCKDOWN = 2.4;

export class Captain extends BigFoe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'captain_drowned';
    this.name = 'Captain Morrow, the Drowned';
    this.bossId = 'morrow';
    this.flag = 'morrowDead';
    this.music = 'sea';
    this.summonPack = 'morrow-crew';
    this.intro = { title: 'Master of the Lost Ship', open: 'splash', roar: 'roarBig', scale: 1.15, lift: -0.6, roarAt: [3.6, 1.4] };
    this.reward = { gear: 'drowned_anchor', banner: ['The Tide Goes Out', 'Captain Morrow, the Drowned'] };
    this.model = buildCaptain();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 1900;
    this.maxPoise = 130;
    this.ash = 3800;
    this.radius = 0.85;
    this.height = 3.1;
    this.lockHeight = 2.1;
    this.accel = 6;
    this.knockdownTime = KNOCKDOWN;
    this.parriedTime = 2.0;
    this.ring = 4.4;
    this.chaseSpeed = 4.6;
    this.circleSpeed = 1.6;
    this.poses = POSES;
    this.knockKeys = [[0, POSES.riposted], [0.4, POSES.dead], [KNOCKDOWN - 0.8, POSES.dead], [KNOCKDOWN, POSES.rest]];
    const anchor = (dmg, reach, arc, extra = {}) => ({ reach, arc, dmg, poise: 40, height: 4, knock: 5, ...extra });
    this.moves = {
      slam: { windup: 1.0, active: 0.16, recover: 0.9, track: 3, pose: 'slam', cd: 1.4, melee: anchor(42, 4.8, 0.5, { heavy: true, poise: 65 }), fire: (self) => self._splash(3.4, 7, 20) },
      sweep: { windup: 0.75, active: 0.22, recover: 0.55, track: 4, pose: 'sweep', parry: true, cd: 1.2, next: ['sweepB', 0.45], melee: anchor(30, 5.4, 1.45) },
      sweepB: { windup: 0.5, active: 0.22, recover: 0.7, track: 3, pose: 'sweepB', parry: true, cd: 1.3, melee: anchor(28, 5.4, 1.45) },
      hook: { windup: 0.85, active: 0.2, recover: 0.8, track: 3, pose: 'hook', parry: true, lunge: 10, cd: 1.3, melee: anchor(34, 6.5, 0.32) },
      tide: { windup: 1.1, active: 0.1, recover: 1.0, track: 1, pose: 'tide', cd: 2.0, fire: (self) => self._tide() },
      crew: { windup: 0.9, active: 0.1, recover: 0.7, track: 0, pose: 'tide', cd: 1.2, fire: (self) => self._crew() },
    };
    this._enter();
  }

  enter() { return { x: WRECK.x + 22, z: WRECK.z + 4, yaw: -Math.PI / 2 }; }
  arena() { return { x: WRECK.x, z: WRECK.z, leash: WRECK.leash }; }
  _sees(c) { return Math.hypot(c.p.pos.x - WRECK.x, c.p.pos.z - WRECK.z) < WRECK.trigger; }

  _onReset() {
    super._onReset();
    this.crewCd = 0;
    this.crewOut = 0;
    this._lamp(1);
  }

  _lamp(k) {
    const m = this.model;
    m.lamp.emissiveIntensity = 1.2 * k;
    m.glow.material.opacity = 0.35 * k;
    m.glow.scale.setScalar(0.9 + k * 0.6);
  }

  // Looking out to sea, the lantern swinging a little.
  _idle(dt) {
    this.yaw = -Math.PI / 2 + Math.sin(this.game.time * 0.2) * 0.2;
    if (Math.random() < dt * 0.5) this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 0.2, z: this.pos.z, count: 3, speed: 0.4, up: 0.6, color: 0x9fe0ff, life: [0.5, 1], size: [0.06, 0.12], jitter: 0.6 });
  }

  awaken(len) {
    super.awaken(len ?? 1.6);
    this.game.audio.playAt('splash', this.pos, 80);
  }

  _wakePose(p, t) { Object.assign(p, t < 1.5 ? POSES.watch : POSES.roar); }
  _onWake(t, dt, c) { if (t > 1) this.turnTo(c.toP, 2, dt); }

  update(dt) {
    if (this.crewCd > 0) this.crewCd -= dt;
    super.update(dt);
    if (this.phase === 2 && this.alive) this._lamp(1.6 + Math.sin(this.game.time * 6) * 0.3);
  }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.3;
    const p2 = this.phase === 2;
    const opts = [];
    if (dist < 6.5) opts.push(['sweep', behind ? 3 : 2.5], ['slam', 2]);
    if (dist > 4 && dist < 10) opts.push(['hook', 2.5]);
    if (p2 && dist < 16) opts.push(['tide', 2]);
    if (p2 && this.crewCd <= 0 && this.crewOut < 4) opts.push(['crew', 3]);
    if (dist >= 10 && !p2) opts.push(['hook', 0.5]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  // The anchor comes down and the sea comes with it.
  _splash(ahead, maxR, dmg) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.shockwave(this, x, z, { maxR, speed: 13, color: 0x9fe0ff, hit: { dmg, poise: 35, knock: 5 } });
    g.audio.playAt('splash', this.pos, 70);
    g.audio.playAt('slam', this.pos, 70);
    g.cameraShake(0.3, Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 12 ? 1 : 0.4);
    g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.5, z, count: 44, speed: 6, up: 5, color: 0x9fe0ff, color2: 0xffffff, life: [0.5, 1.1], size: [0.12, 0.3], drag: 1.5, gravity: 9, jitter: 0.8 });
  }

  // Three rings of surf roll out from him, one after another; the last goes through any guard.
  _tide() {
    const g = this.game;
    for (let i = 0; i < 3; i++) {
      g.after(i * 0.45, () => {
        if (!this.alive) return;
        g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 13, speed: 12, color: 0x8fd8ff, hit: { dmg: 16, poise: 40, knock: 8, unblockable: i === 2 } });
        g.audio.playAt('splash', this.pos, 80);
      });
    }
    g.cameraShake(0.35);
  }

  // His crew climb out of the shallows behind him.
  _crew() {
    const g = this.game;
    this.crewCd = 26;
    for (let i = 0; i < 2; i++) {
      const a = this.yaw + Math.PI + (i ? 0.7 : -0.7);
      const x = this.pos.x + Math.sin(a) * 7, z = this.pos.z + Math.cos(a) * 7;
      const e = g.summonEnemy?.('drowned', x, z, a + Math.PI, { pack: 'morrow-crew' });
      if (!e) continue;
      e.state = 'chase';
      this.crewOut++;
      g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.5, z, count: 30, speed: 3, up: 3, color: 0x9fe0ff, color2: 0x5a7a6a, life: [0.6, 1.2], size: [0.15, 0.3], jitter: 1 });
    }
    g.audio.playAt('splash', this.pos, 80);
  }

  // Half health: the lantern flares and the tide answers.
  _phase(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    this.invuln = this.t < 1.0;
    if (!this.phased && this.t > 0.5) {
      this.phased = true;
      this.phase = 2;
      this.pace = 0.85;
      this.chaseSpeed = 5.2;
      this.game.audio.playAt('roarBig', this.pos, 80);
      this._tide();
    }
    if (this.t >= 2.0) {
      this.invuln = false;
      this._engage();
    }
    return false;
  }

  _animate(dt) {
    if (this.state !== 'idle') return super._animate(dt);
    copyPose(this.poseBuf, POSES.watch);
    applyPose(this.model, this.poseBuf, dampK(6, dt));
  }

  onFightEnd() {
    this.crewOut = 0;
  }
}
