// Ember Hounds: the Mire Hounds' kin in the Cinderfall Wastes. Charred, burning, a little quicker, and
// their bite sets you alight if it lands often enough (see Actor.addBurn). Sparks trail them.
import { Hound } from './Hound.js';
import { buildHound } from '../models/beasts.js';

export class EmberHound extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a grey pup; swap in the ember hound
    this.game.combat.unregister(this);
    this.tag = 'firehound';
    this.name = 'Ember Hound';
    this.model = buildHound({ fire: true });
    this.model.root.scale.setScalar(1.1);
    this.size = 1.1;
    this.maxHp = 60;
    this.maxPoise = 22;
    this.ash = 80;
    this.radius = 0.55;
    this.height = 1.1;
    this.lockHeight = 0.7;
    this.dmgMul = 1.25;
    this.biteBurn = 30;
    this.burnResist = 0;
    this.speedMul = 1.15;
    this._enter();
  }

  update(dt) {
    super.update(dt);
    if (this.alive && this.shown && Math.random() < dt * 8) {
      this.game.particles.emit({ x: this.pos.x - this.forwardX * 0.5, y: this.pos.y + 0.9, z: this.pos.z - this.forwardZ * 0.5, count: 1, speed: 0.3, up: 1.2, color: 0xff6a1a, color2: 0xffc060, life: [0.4, 0.8], size: [0.06, 0.12], jitter: 0.25 });
    }
  }
}
