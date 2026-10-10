// Prism Golems: the Shardlands' elites, boulders of pale stone with crystal grown through them like
// bones. A slam that cracks crystal spikes up round where it lands, a backhand, a stomp, and a spray of
// splinters flung from the geode in its chest at anyone who keeps away.
import { Golem } from './Golem.js';
import { buildPrismGolem } from '../models/creatures.js';
import { angleDiff } from '../core/math.js';

const SIZE = 1.75;

export class PrismGolem extends Golem {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'prismgolem';
    this.name = 'Prism Golem';
    this.model = buildPrismGolem();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 400;
    this.maxPoise = 85;
    this.ash = 660;
    this.burnResist = 0.5;
    this.moves.slam.melee = { ...this.moves.slam.melee, burn: 0 };
    this.moves.slam.fire = (self) => self._crystals(2.8);
    delete this.moves.lob;
    this.moves.spray = {
      windup: 0.9, active: 0.1, recover: 0.8, track: 3, pose: 'lob', cd: 2.0,
      fire: (self, c) => self._spray(c.p),
    };
    this._enter();
  }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.2;
    const opts = [];
    if (dist < 5.5) opts.push(['backhand', behind ? 1 : 3], ['slam', 3]);
    if (dist < 4) opts.push(['stomp', behind ? 5 : 1.2]);
    if (dist > 7 && dist < 26) opts.push(['spray', 3]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  _crystals(ahead) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.shockwave(this, x, z, { maxR: 4.5, speed: 12, color: 0xd8c8ff, hit: { dmg: 16, poise: 25, knock: 4 } });
    g.effects.iceSpike(this, x, z, 0.35, { look: 'crystal', radius: 2.6, hit: { dmg: 24, poise: 34, knock: 5, unblockable: true } });
    g.audio.playAt('slam', this.pos, 60);
    g.cameraShake(0.25, Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 12 ? 1 : 0.4);
  }

  _spray(p) {
    const g = this.game;
    const sx = this.pos.x + this.forwardX * 1.2, sy = this.pos.y + 2.4, sz = this.pos.z + this.forwardZ * 1.2;
    const base = Math.atan2(p.pos.x - sx, p.pos.z - sz);
    for (let i = -2; i <= 2; i++) {
      const a = base + i * 0.14;
      g.projectiles.spawn(this, {
        kind: 'crystal', x: sx, y: sy, z: sz, dirX: Math.sin(a), dirY: (p.pos.y + 1 - sy) / Math.max(4, Math.hypot(p.pos.x - sx, p.pos.z - sz)), dirZ: Math.cos(a),
        speed: 24, radius: 0.4, life: 1.6, scale: 1.3, hit: { dmg: 16, poise: 14, parryable: false }, sound: 'crack',
      });
    }
    g.audio.playAt('crack', this.pos, 60);
  }

  update(dt) {
    super.update(dt);
    if (this.model.magma) this.model.magma.emissiveIntensity = 1.3 + Math.sin(this.game.time * 2.6 + this.spawn.z) * 0.35 + (this.state === 'attack' ? 1.0 : 0);
  }
}
