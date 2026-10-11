// Skeletons of the old watch, down in the Undercroft: the sentry's fighting (sword, shield, guard
// breaks, ripostes) in old bones. Cut one down with ordinary blows and it pulls itself back together a
// few seconds later; a heavy blow, a riposte or a backstab, or fire in its bones, keeps it down. It only
// gets up the once.
import { Sentry } from './Sentry.js';

const REVIVE_AT = 3.0;
const KNOCKDOWN_TIME = 2.1; // Sentry's

export class Skeleton extends Sentry {
  constructor(game, spawn) {
    super(game, spawn);
    this.baseAsh = this.ash;
  }

  reset() {
    super.reset();
    this.revived = false;
    this.reviveT = 0;
    if (this.baseAsh !== undefined) this.ash = this.baseAsh;
    if (this.model) this.model.root.visible = true;
  }

  _die(hit) {
    const r = super._die(hit);
    const stays = this.revived || this.ally || hit.heavy || hit.riposte || hit.backstabbed || (this.burn ?? 0) > 40 || hit.status === 'burn';
    this.reviveT = stays ? 0 : REVIVE_AT;
    return r;
  }

  update(dt) {
    super.update(dt);
    if (this.state !== 'dead' || !this.reviveT) return;
    const g = this.game;
    if (this.t > REVIVE_AT - 1 && Math.random() < dt * 20) {
      g.particles.emit({ x: this.pos.x + (Math.random() - 0.5), y: this.pos.y + 0.3, z: this.pos.z + (Math.random() - 0.5), count: 1, speed: 0.8, up: 1.2, color: 0xd8cdb0, color2: 0x9fd0ff, life: [0.4, 0.8], size: [0.05, 0.1], jitter: 0.3 });
    }
    if (this.t >= this.reviveT) {
      // Back on its feet: it rises the way a knocked-down sentry does.
      this.reviveT = 0;
      this.revived = true;
      this.alive = true;
      this.hp = this.maxHp * 0.6;
      this.poise = this.maxPoise;
      this.ash = Math.round(this.baseAsh * 0.5);
      this.model.root.visible = true;
      this.state = 'knockdown';
      this.t = KNOCKDOWN_TIME - 1.0;
      g.audio.playAt('spawn', this.pos, 40);
      if (!g.state.flags.skeletonTip) {
        g.state.flags.skeletonTip = true;
        g.hud.toast('The dead here do not stay down. A heavy blow, a riposte or fire finishes them.');
      }
    }
  }
}
