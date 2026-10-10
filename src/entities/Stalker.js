// Glowcap Stalkers: tall mushroom-folk that drift between the giant caps of the Hollows. They fight
// like the Rime Wraiths (keep their distance, blink away when rushed) but what they throw is spores:
// glowing puffs that poison, and when crowded they burst in a ring of spores that leaves a cloud behind.
import { Wraith } from './Wraith.js';
import { buildStalker } from '../models/creatures.js';

export class Stalker extends Wraith {
  constructor(game, spawn) {
    super(game, spawn);
    this.tag = 'stalker';
    this.name = 'Glowcap Stalker';
    this.model = buildStalker();
    this.maxHp = 80;
    this.ash = 150;
    this.frostResist = 1;
    this.poisonResist = 0;
    this.shard = { speed: 15, radius: 0.4, life: 2.6, dmg: 10, poise: 8, poison: 26, fan: 0.24, count: 3 };
    this.nova = { maxR: 6, speed: 10, dmg: 12, poise: 18, poison: 30, cloud: 3.4 };
    this.look = { kind: 'spore', c1: 0x9ae070, c2: 0xd070f0, sound: 'spore', swirl: [0x8ff0dc, 0xd070f0] };
    this._enter();
  }
}
