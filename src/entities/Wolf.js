// Rime Wolves: the Mire Hounds' cousins on the Rimewold. Bigger, white as the snow they lie in, and
// their bite carries frost: three or four bites and the cold takes hold (see Actor.addFrost).
import { Hound } from './Hound.js';
import { buildHound } from '../models/beasts.js';

export class Wolf extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a grey pup; swap in the wolf
    this.game.combat.unregister(this);
    this.tag = 'wolf';
    this.name = 'Rime Wolf';
    this.model = buildHound({ frost: true });
    this.model.root.scale.setScalar(1.2);
    this.size = 1.2;
    this.maxHp = 72;
    this.maxPoise = 26;
    this.ash = 90;
    this.radius = 0.6;
    this.height = 1.2;
    this.lockHeight = 0.75;
    this.dmgMul = 1.35;
    this.biteFrost = 28;
    this.frostResist = 0.4; // born to the cold
    this.speedMul = 1.1;
    this._enter();
  }
}
