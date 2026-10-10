// Rustback Boars: the Amberwood's boars, as big as ponies. They run in pairs like the hounds do, but
// they are heavier and slower to turn: a charge with the tusks down that throws you off your feet,
// and they take a good deal more killing.
import { Hound } from './Hound.js';
import { buildBoar } from '../models/creatures.js';

export class Boar extends Hound {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Hound built a grey pup; swap in the boar
    this.game.combat.unregister(this);
    this.tag = 'boar';
    this.name = 'Rustback Boar';
    this.model = buildBoar();
    this.model.root.scale.setScalar(1.15);
    this.size = 1.15;
    this.maxHp = 120;
    this.maxPoise = 40;
    this.ash = 150;
    this.radius = 0.7;
    this.height = 1.2;
    this.lockHeight = 0.75;
    this.dmgMul = 1.9;
    this.speedMul = 1.1;
    this.knockdownTime = 1.4;
    this._enter();
  }

  update(dt) {
    super.update(dt);
    // Leaves kicked up while it runs.
    if (this.alive && this.shown && this.onGround && Math.hypot(this.vel.x, this.vel.z) > 4 && Math.random() < dt * 14) {
      this.game.particles.emit({ x: this.pos.x - this.forwardX * 0.6, y: this.pos.y + 0.1, z: this.pos.z - this.forwardZ * 0.6, count: 1, speed: 1.2, up: 1.5, gravity: 4, color: 0xc8742e, color2: 0xa8442a, life: [0.4, 0.8], size: [0.06, 0.12] });
    }
  }
}
