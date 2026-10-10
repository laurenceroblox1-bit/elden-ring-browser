// Thunder Wolves: the hounds of the Stormspire, grey-blue with a crest of crackling light. Their bite
// lands with a crack of lightning that goes through a guard more than a fang should.
import { Hound } from './Hound.js';
import { buildHound } from '../models/beasts.js';

export class ThunderWolf extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a grey pup; swap in the wolf
    this.game.combat.unregister(this);
    this.tag = 'thunderwolf';
    this.name = 'Thunder Wolf';
    this.model = buildHound({ storm: true });
    this.model.root.scale.setScalar(1.2);
    this.size = 1.2;
    this.maxHp = 78;
    this.maxPoise = 26;
    this.ash = 120;
    this.radius = 0.6;
    this.height = 1.2;
    this.lockHeight = 0.75;
    this.dmgMul = 1.5;
    this.speedMul = 1.2;
    this._enter();
  }

  update(dt) {
    super.update(dt);
    if (this.alive && this.shown && Math.random() < dt * (this.state === 'lunge' ? 30 : 4)) {
      this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 1.0, z: this.pos.z, count: 1, speed: 2, up: 0.5, color: 0xcff0ff, color2: 0x70c0ff, life: [0.1, 0.25], size: [0.05, 0.1], jitter: 0.5 });
    }
  }
}
