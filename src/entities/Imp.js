// Cinder Imps: the Wastes' fire-sprites. They fight like the Lantern Acolytes (hold their distance,
// strafe, swat when cornered) but are smaller, quicker, and what they throw is fire that sticks: a few
// hits and you catch light (see Actor.addBurn). Their fireball swells in the claw before it flies.
import { Acolyte } from './Acolyte.js';
import { buildImp } from '../models/creatures.js';

const FIRE = { speed: 16, radius: 0.34, life: 2.4, dmg: 13, poise: 14, burn: 30, lead: 0.55 };

export class Imp extends Acolyte {
  constructor(game, spawn) {
    super(game, spawn);
    this.game.scene.remove(this.model.root); // Acolyte built a monk; swap in the imp
    this.game.combat.unregister(this);
    this.tag = 'imp';
    this.name = 'Cinder Imp';
    this.model = buildImp();
    this.maxHp = 40;
    this.maxPoise = 10;
    this.ash = 75;
    this.radius = 0.36;
    this.height = 1.3;
    this.lockHeight = 0.9;
    this.speedMul = 1.3;
    this.burnResist = 0; // fire is what it is made of
    this._enter();
  }

  _fire(p) {
    const g = this.game;
    const sx = this.pos.x + this.forwardX * 0.6, sy = this.pos.y + 1.5, sz = this.pos.z + this.forwardZ * 0.6;
    const flight = Math.hypot(p.pos.x - sx, p.pos.z - sz) / FIRE.speed;
    const tx = p.pos.x + p.vel.x * flight * FIRE.lead, tz = p.pos.z + p.vel.z * flight * FIRE.lead;
    g.projectiles.spawn(this, {
      kind: 'fire', x: sx, y: sy, z: sz, dirX: tx - sx, dirY: p.pos.y + 1.1 - sy, dirZ: tz - sz,
      speed: FIRE.speed, radius: FIRE.radius, life: FIRE.life, scale: 0.9,
      hit: { dmg: FIRE.dmg, poise: FIRE.poise, burn: FIRE.burn, knock: 2, parryable: false },
      color: 0xff6a1a, color2: 0xffd060, sound: 'boltHit',
    });
    g.audio.play('bolt');
  }

  update(dt) {
    super.update(dt);
    // A thread of smoke and sparks rises off it.
    if (this.alive && this.shown && Math.random() < dt * 4) {
      this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 1.0, z: this.pos.z, count: 1, speed: 0.2, up: 1.4, color: 0xff7a2a, color2: 0xffc060, life: [0.5, 1], size: [0.05, 0.1], jitter: 0.2 });
    }
  }
}
