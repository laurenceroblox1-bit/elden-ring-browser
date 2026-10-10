// Tidecrabs: cart-sized shore crabs that sun themselves on the Drowned Coast in twos and threes. They
// circle and snap like the hounds (it's the same hunting code), but slower, and their shell turns aside
// a third of every ordinary blow: heavy weapons, ripostes and blows to the back go straight through.
import { Hound } from './Hound.js';
import { buildCrab } from '../models/creatures.js';
import { angleDiff } from '../core/math.js';

export class Crab extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a pup; swap in the crab
    this.game.combat.unregister(this);
    this.tag = 'crab';
    this.name = 'Tidecrab';
    this.model = buildCrab();
    this.model.root.scale.setScalar(1.25);
    this.size = 1.25;
    this.maxHp = 90;
    this.maxPoise = 34;
    this.ash = 95;
    this.radius = 0.75;
    this.height = 1.1;
    this.lockHeight = 0.7;
    this.dmgMul = 1.5;
    this.speedMul = 0.8;
    this._enter();
  }

  takeHit(hit) {
    // The shell: blows to its front that aren't heavy lose a third.
    if (this.alive && !hit.heavy && !hit.riposte && !hit.status) {
      const from = Math.atan2(-(hit.dirX ?? 0), -(hit.dirZ ?? 0));
      if (Math.abs(angleDiff(this.yaw, from)) < 1.8) hit = { ...hit, dmg: hit.dmg * 0.66, poise: (hit.poise ?? 10) * 0.7 };
    }
    return super.takeHit(hit);
  }
}
