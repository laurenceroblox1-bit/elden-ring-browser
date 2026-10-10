// Gargoyles: the monastery's stone watchers, elites of the Stormspire. They crouch like statues on
// their plinths until you pass, then come for you: a two-fisted slam, a wide backhand, a stomp, and a
// leaping swoop on half-spread stone wings that carries them right across to you.
import { Golem } from './Golem.js';
import { buildGargoyle } from '../models/creatures.js';
import { pose } from '../models/pose.js';
import { angleDiff } from '../core/math.js';

const SIZE = 1.5;
const SWOOP = [pose({ torsoX: 0.6, hipsH: -0.25, kR: 1.0, kL: 1.0, lRx: -0.6, lLx: -0.6, sRx: 0.6, sLx: 0.6, sRz: -0.8, sLz: 0.8 }),
  pose({ torsoX: 0.5, sRx: -1.6, sLx: -1.6, eR: -0.2, eL: -0.2, lRx: -0.8, kR: 0.6, lLx: 0.4 })];

export class Gargoyle extends Golem {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'gargoyle';
    this.name = 'Spire Gargoyle';
    this.model = buildGargoyle();
    this.model.root.scale.setScalar(SIZE);
    this.size = SIZE;
    this.maxHp = 360;
    this.maxPoise = 80;
    this.ash = 600;
    this.radius = 0.85;
    this.height = 2.7;
    this.lockHeight = 1.9;
    this.chaseSpeed = 4.2;
    this.burnResist = 1;
    this.poses = { ...this.poses, swoop: SWOOP };
    this.moves.slam.fire = (self) => self._quake(2.4, 5, 18);
    this.moves.slam.melee = { ...this.moves.slam.melee, burn: 0 };
    delete this.moves.lob;
    this.moves.swoop = {
      windup: 0.7, active: 0.4, recover: 0.8, track: 4, pose: 'swoop', cd: 1.8, lunge: 15,
      melee: { reach: 2.8, arc: 0.8, dmg: 30, poise: 45, heavy: true, height: 4, knock: 5 },
      fire: (self) => { self.vy = 6; self.onGround = false; self.game.audio.playAt('wings', self.pos, 50); },
    };
    this._enter();
  }

  _pick(c) {
    const { dist, toP } = c;
    const behind = Math.abs(angleDiff(this.yaw, toP)) > 1.2;
    const opts = [];
    if (dist < 5) opts.push(['backhand', behind ? 1 : 3], ['slam', 3]);
    if (dist < 3.5) opts.push(['stomp', behind ? 5 : 1.2]);
    if (dist > 6 && dist < 18) opts.push(['swoop', 4]);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [id, wt] of opts) if ((r -= wt) <= 0) return id;
    return opts[0][0];
  }

  update(dt) {
    super.update(dt);
    // Its eyes kindle when it wakes.
    if (this.model.magma) this.model.magma.emissiveIntensity = this.state === 'idle' ? 0.3 : 1.8 + Math.sin(this.game.time * 5) * 0.3;
  }
}
