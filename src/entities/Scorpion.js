// Dune Scorpions: the Tidecrab's desert cousins. The same shell (a third of an ordinary blow to the front
// glances off) and the same circling and snapping, quicker, and their sting is poison.
import { Crab } from './Crab.js';
import { buildScorpion } from '../models/creatures.js';

export class Scorpion extends Crab {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'scorpion';
    this.name = 'Dune Scorpion';
    this.model = buildScorpion();
    this.model.root.scale.setScalar(1.35);
    this.size = 1.35;
    this.maxHp = 80;
    this.ash = 110;
    this.radius = 0.7;
    this.speedMul = 1.05;
    this.bitePoison = 34;
    this.poisonResist = 0;
    this._enter();
  }
}
