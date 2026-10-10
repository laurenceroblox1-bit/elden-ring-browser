// Sporelings: walking puffballs of the Glowcap Hollows. They waddle towards you, and when close their
// cap swells and flashes and they burst in a cloud of poison spores that hangs in the air. Kill one
// before it bursts and it still pops (a smaller cloud): hit it from range, or strike and step away.
// States: idle (waddling) -> alert -> chase -> swell -> (burst: dead); plus Foe's hurt/dead.
import { Foe } from './Foe.js';
import { buildSporeling } from '../models/creatures.js';
import { pose, copyPose, applyPose, addGait } from '../models/pose.js';
import { clamp, dampK, angleDiff } from '../core/math.js';

const SWELL = 1.15;
const REST = pose({ sRx: -0.4, eR: -0.6, sLx: -0.4, eL: -0.6, sRz: -0.3, sLz: 0.3 });
const DEAD = pose({ pivotX: -1.4, pivotH: -0.45 });

export class Sporeling extends Foe {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'sporeling';
    this.name = 'Sporeling';
    this.model = buildSporeling();
    this.maxHp = 24;
    this.maxPoise = 6;
    this.ash = 40;
    this.radius = 0.4;
    this.height = 1.0;
    this.lockHeight = 0.6;
    this.leash = 26;
    this.returnSpeed = 2.5;
    this.parryable = new Set();
    this.poisonResist = 0;
    this.poseBuf = pose();
    this.gait = Math.random() * 6;
    this._enter();
  }

  _onReset() {
    this.burst = false;
    this.model.capG.scale.setScalar(1);
    this.model.cap.emissiveIntensity = 0.8;
    copyPose(this.poseBuf, REST);
  }

  busy() { return this.state === 'swell'; }
  _engage() { this._setState('chase'); }

  _think(dt, c) {
    const { p, dist, toP } = c;
    const w = this.want;
    switch (this.state) {
      case 'idle':
        if (p.alive && (dist < 11 || (dist < 18 && Math.abs(angleDiff(this.yaw, toP)) < 1.8))) {
          this._setState('alert');
          this.game.audio.playAt('spore', this.pos);
        }
        break;
      case 'alert':
        this.turnTo(toP, 6, dt);
        if (this.t > 0.4) this._engage();
        break;
      case 'chase':
        this.turnTo(toP, 5, dt);
        w.x = Math.sin(toP) * 3.6;
        w.z = Math.cos(toP) * 3.6;
        if (dist < 2.2 && p.alive) this._setState('swell');
        break;
      case 'swell':
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        this.model.capG.scale.setScalar(1 + (this.t / SWELL) * 0.8);
        this.model.cap.emissiveIntensity = 0.8 + Math.sin(this.t * (8 + this.t * 20)) * 0.8 + this.t * 2;
        if (this.t >= SWELL) this._burst(1);
        return false;
    }
    return true;
  }

  // The cap splits: a puff of spores that poisons whoever stands in it.
  _burst(k) {
    if (this.burst) return;
    this.burst = true;
    const g = this.game;
    g.audio.playAt('spore', this.pos, 50);
    g.combat.sphere(this, { x: this.pos.x, y: this.pos.y + 0.8, z: this.pos.z }, 2.2 * k, { dmg: 12 * k, poise: 18, poison: 45 * k, knock: 3 }, new Set());
    g.effects.hazard(this, this.pos.x, this.pos.z, { radius: 2.8 * k, life: 6 * k, look: 'spore', hit: { dmg: 2, poise: 0, poison: 16, unblockable: true } });
    g.particles.emit({ x: this.pos.x, y: this.pos.y + 0.8, z: this.pos.z, count: 50, speed: 4, up: 1.5, color: 0x9ae070, color2: 0xd070f0, life: [0.6, 1.3], size: [0.15, 0.35], drag: 2, jitter: 0.5 });
    if (this.alive) {
      this.hp = 0;
      this.alive = false;
      this._setState('dead');
      this.ashGiven = true;
      g.onEnemyKilled(this);
    }
    this.shown = false;
  }

  _die(hit) {
    const r = super._die(hit);
    // Even dying, it pops.
    this.game.after?.(0.25, () => this._burst(0.6));
    return r;
  }

  _animate(dt) {
    const p = this.poseBuf;
    let k = dampK(12, dt);
    if (this.state === 'dead') { copyPose(p, DEAD); k = dampK(8, dt); }
    else {
      copyPose(p, REST);
      const sp = Math.hypot(this.vel.x, this.vel.z);
      this.gait += dt * (3 + sp * 3);
      addGait(p, this.gait, clamp(sp / 3, 0, 1), 0.3);
      // A waddle: side to side.
      p.torsoZ += Math.sin(this.gait) * 0.15 * clamp(sp / 2, 0, 1);
      if (this.state === 'swell') { p.torsoX = -0.3; p.sRz = -1.2; p.sLz = 1.2; }
    }
    applyPose(this.model, p, k);
  }
}
