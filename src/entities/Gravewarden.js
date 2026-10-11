// Gravewardens: the catacombs' keepers, armoured giants of the dead watch with a grave-slab for a shield.
// Elites like the Cinder Golems: a club slam that sends a ring of bone spikes up round where it lands, a
// wide backhand, a stomp, and a shield-charge across the room. Fire doesn't take in iron; blows from
// behind do.
import { Golem } from './Golem.js';
import { buildGravewarden } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { angleDiff } from '../core/math.js';

const SIZE = 1.6;
const CHARGE = [pose({ sLx: -1.2, sLy: -1.1, eL: -1.0, torsoX: 0.5, hipsH: -0.2, kR: 0.8, kL: 0.8, lRx: -0.6, sRx: 0.3, eR: -0.8 }),
  pose({ sLx: -1.3, sLy: -1.1, eL: -0.9, torsoX: 0.6, lRx: -1.0, kR: 0.5, lLx: 0.6, kL: 0.2, sRx: 0.4, eR: -0.6 })];

export class Gravewarden extends Golem {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'gravewarden';
    this.name = 'Gravewarden';
    this.model = buildGravewarden();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 460;
    this.maxPoise = 100;
    this.ash = 720;
    this.radius = 0.9;
    this.height = 3.0;
    this.lockHeight = 2.1;
    this.burnResist = 0.3;
    this.chaseSpeed = 3.6;
    this.poses = { ...this.poses, charge: CHARGE };
    this.moves.slam.melee = { ...this.moves.slam.melee, burn: 0 };
    this.moves.slam.fire = (self) => self._bones(3);
    delete this.moves.lob;
    this.moves.charge = {
      windup: 0.8, active: 0.6, recover: 0.8, track: 4, pose: 'charge', lunge: 14, cd: 1.8,
      melee: { reach: 2.6, arc: 0.9, dmg: 34, poise: 55, heavy: true, height: 4, knock: 7 },
      start: (self) => self.game.audio.playAt('roarBig', self.pos, 40),
    };
    this._enter();
  }

  _sees(c) { return c.dist < 10 || (c.dist < 18 && Math.abs(angleDiff(this.yaw, c.toP)) < 1.0); }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.2;
    const opts = [];
    if (dist < 5.5) opts.push(['backhand', behind ? 1 : 3], ['slam', 3]);
    if (dist < 4) opts.push(['stomp', behind ? 5 : 1.2]);
    if (dist > 6 && dist < 18) opts.push(['charge', 3]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  _bones(ahead) {
    const g = this.game;
    const x = this.pos.x + this.forwardX * ahead, z = this.pos.z + this.forwardZ * ahead;
    g.effects.shockwave(this, x, z, { maxR: 4.5, speed: 12, color: 0xd8cdb0, hit: { dmg: 16, poise: 25, knock: 4 } });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.random();
      g.effects.iceSpike(this, x + Math.sin(a) * 3, z + Math.cos(a) * 3, 0.5 + i * 0.07, { look: 'bone', radius: 1.7, count: 5, hit: { dmg: 22, poise: 30, knock: 4, unblockable: true } });
    }
    g.audio.playAt('slam', this.pos, 60);
    g.cameraShake(0.25, Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 12 ? 1 : 0.4);
  }

  update(dt) {
    super.update(dt);
    if (this.model.magma) this.model.magma.emissiveIntensity = this.state === 'idle' ? 0.8 : 2.0 + Math.sin(this.game.time * 6) * 0.3;
  }
}
