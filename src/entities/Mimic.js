// Mimics: chests with teeth. Open the wrong chest and it stands up on four long legs and comes for you
// like a starving hound: lunging bites that take a great deal of health. Kill it and whatever it was
// guarding spills out (Game.onEnemyKilled reads `chest`).
import { Hound } from './Hound.js';
import { buildMimic } from '../models/creatures.js';

export class Mimic extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a grey pup; swap in the chest
    this.game.combat.unregister(this);
    this.tag = 'mimic';
    this.name = 'Mimic';
    this.model = buildMimic();
    this.size = 1;
    this.maxHp = 240;
    this.maxPoise = 40;
    this.ash = 600;
    this.radius = 0.7;
    this.height = 1.4;
    this.lockHeight = 0.9;
    this.dmgMul = 3.0;
    this.speedMul = 1.15;
    this.chest = spawn.chest;
    this._enter();
  }

  update(dt) {
    super.update(dt);
    // The lid chatters while it hunts.
    if (this.alive && this.state !== 'lunge' && this.model.neck) this.model.neck.rotation.x = -Math.abs(Math.sin(this.game.time * 9)) * 0.25;
  }
}
