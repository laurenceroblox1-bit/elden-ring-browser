// Shardback Lizards: low, quick lizards of the Shardlands with a ridge of living crystal down their
// backs. They hunt in pairs like the hounds; their bite is a hard snap, and when one dies the crystal
// on its back shatters outward in a spray of splinters.
import { Hound } from './Hound.js';
import { buildShardback } from '../models/creatures.js';

export class Shardback extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a grey pup; swap in the lizard
    this.game.combat.unregister(this);
    this.tag = 'shardback';
    this.name = 'Shardback Lizard';
    this.model = buildShardback();
    this.model.root.scale.setScalar(1.25);
    this.size = 1.25;
    this.maxHp = 76;
    this.maxPoise = 24;
    this.ash = 115;
    this.radius = 0.6;
    this.height = 0.8;
    this.lockHeight = 0.5;
    this.dmgMul = 1.5;
    this.speedMul = 1.2;
    this._enter();
  }

  _die(hit) {
    const r = super._die(hit);
    const g = this.game;
    if (!this.ally) g.effects.shockwave(this, this.pos.x, this.pos.z, { maxR: 3, speed: 10, color: 0xd8c8ff, hit: { dmg: 10, poise: 10 } });
    g.particles.emit({ x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z, count: 26, speed: 5, up: 3, gravity: 6, color: 0xe8f4ff, color2: 0xb890ff, life: [0.4, 0.8], size: [0.06, 0.14], drag: 1.5 });
    g.audio.playAt('crack', this.pos, 40);
    return r;
  }
}
