// Prism Wraiths: drifting shapes of folded light over the Shardlands. They fight like the Rime Wraiths
// (keep their distance, blink away when rushed), throwing fans of crystal splinters, and when crowded
// they flare outward in a burst of hard light.
import { Wraith } from './Wraith.js';
import { buildPrismWraith } from '../models/creatures.js';

export class PrismWraith extends Wraith {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'prismwraith';
    this.name = 'Prism Wraith';
    this.model = buildPrismWraith();
    this.maxHp = 80;
    this.ash = 150;
    this.frostResist = 0.5;
    this.shard = { speed: 26, radius: 0.34, life: 2.0, dmg: 14, poise: 12, fan: 0.12, count: 5 };
    this.nova = { maxR: 7, speed: 14, dmg: 18, poise: 40, knock: 7 };
    this.look = { kind: 'crystal', c1: 0xd8c8ff, c2: 0x9ae8ff, sound: 'crack', swirl: [0xe8f4ff, 0xb890ff] };
    this._enter();
  }
}
