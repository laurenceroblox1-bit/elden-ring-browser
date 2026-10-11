// Ghouls: pale grave-eaters that run on all fours through the catacombs in twos and threes. The hounds'
// pack hunting, quicker and frailer, and their bite festers (it builds poison).
import { Hound } from './Hound.js';
import { buildGhoul } from '../models/creatures.js';

export class Ghoul extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a grey pup; swap in the ghoul
    this.game.combat.unregister(this);
    this.tag = 'ghoul';
    this.name = 'Ghoul';
    this.model = buildGhoul();
    this.model.root.scale.setScalar(1.1);
    this.size = 1.1;
    this.maxHp = 64;
    this.maxPoise = 18;
    this.ash = 95;
    this.radius = 0.5;
    this.height = 1.0;
    this.lockHeight = 0.65;
    this.dmgMul = 1.35;
    this.speedMul = 1.3;
    this.bitePoison = 26;
    this._enter();
  }
}
