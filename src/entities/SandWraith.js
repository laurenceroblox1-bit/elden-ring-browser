// Sand Wraiths: the dunes' dead, held together by the wind. They fight like the Rime Wraiths (keep
// their distance, blink away in a gust when rushed), throwing knots of scouring sand, and when crowded
// they burst outward in a blast that throws you back.
import { Wraith } from './Wraith.js';
import { buildSandWraith } from '../models/creatures.js';

export class SandWraith extends Wraith {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'sandwraith';
    this.name = 'Sand Wraith';
    this.model = buildSandWraith();
    this.maxHp = 72;
    this.ash = 140;
    this.frostResist = 1;
    this.shard = { speed: 20, radius: 0.36, life: 2.2, dmg: 13, poise: 12, fan: 0.16, count: 4 };
    this.nova = { maxR: 7, speed: 13, dmg: 16, poise: 40, knock: 8 };
    this.look = { kind: 'sand', c1: 0xe8c080, c2: 0xfff0c8, sound: 'spore', swirl: [0xe8c890, 0xc89050] };
    this._enter();
  }
}
