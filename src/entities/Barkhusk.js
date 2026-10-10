// Barkhusks: old oaks of the Amberwood that pulled up their roots and walked when the king's pact went
// sour. Elites like the Cinder Golems: they stand among the trees like trees until you come close.
// A slam that sends roots bursting up round where it lands, a wide bough-sweep, a stomp, and roots
// driven through the ground in a line at anyone who keeps their distance. Old wood: fire hurts them.
import { Golem } from './Golem.js';
import { buildBarkhusk } from '../models/creatures.js';
import { angleDiff } from '../core/math.js';

const SIZE = 1.85;

export class Barkhusk extends Golem {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'barkhusk';
    this.name = 'Barkhusk';
    this.model = buildBarkhusk();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 440;
    this.maxPoise = 90;
    this.ash = 680;
    this.burnResist = 1.8;
    this.chaseSpeed = 3.2;
    this.moves.slam.melee = { ...this.moves.slam.melee, burn: 0 };
    this.moves.slam.fire = (self) => self._roots(3);
    this.moves.stomp.fire = (self) => self._quake(0.4, 5, 20);
    delete this.moves.lob;
    this.moves.rootline = {
      windup: 1.0, active: 0.1, recover: 0.9, track: 3, pose: 'slam', cd: 2.0,
      fire: (self, c) => self._rootLine(c.p),
    };
    this._enter();
  }

  _sees(c) { return c.dist < 11 || (c.dist < 18 && Math.abs(angleDiff(this.yaw, c.toP)) < 1.0); }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.2;
    const opts = [];
    if (dist < 5.5) opts.push(['backhand', behind ? 1 : 3], ['slam', 3]);
    if (dist < 4) opts.push(['stomp', behind ? 5 : 1.2]);
    if (dist > 7 && dist < 24) opts.push(['rootline', 3]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  // Roots burst up in a ring round where the slam lands.
  _roots(ahead) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.shockwave(this, x, z, { maxR: 4, speed: 12, color: 0xc8742e, hit: { dmg: 16, poise: 25, knock: 4 } });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.random();
      g.effects.iceSpike(this, x + Math.sin(a) * 3.2, z + Math.cos(a) * 3.2, 0.5 + i * 0.08, { look: 'root', radius: 1.8, count: 5, hit: { dmg: 22, poise: 30, knock: 4, unblockable: true } });
    }
    g.audio.playAt('slam', this.pos, 60);
    g.cameraShake(0.25, Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 12 ? 1 : 0.4);
  }

  // A line of roots punching up through the ground towards you, one after another.
  _rootLine(p) {
    const g = this.game;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
    for (let i = 0; i < 6; i++) {
      const k = 2.5 + i * 3;
      g.effects.iceSpike(this, this.pos.x + (dx / d) * k, this.pos.z + (dz / d) * k, 0.45 + i * 0.12, { look: 'root', radius: 1.6, count: 4, hit: { dmg: 24, poise: 30, knock: 4, unblockable: true } });
    }
    g.audio.playAt('slam', this.pos, 50);
  }

  update(dt) {
    super.update(dt);
    // The sap in its cracks glows brighter when it moves to strike.
    if (this.model.magma) this.model.magma.emissiveIntensity = 1.1 + Math.sin(this.game.time * 1.8 + this.spawn.x) * 0.25 + (this.state === 'attack' ? 0.9 : 0);
  }
}
