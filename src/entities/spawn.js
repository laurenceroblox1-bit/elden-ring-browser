// Maps a spawn's `kind` (data/world.js ENEMY_SPAWNS) to the class that builds it.
// New enemy types register here; every class must offer the Sentry interface
// (pos, radius, height, alive, lockable, lockPoint, takeHit, reset, update, model.root, spawn, ash, tag).
import { Sentry } from './Sentry.js';
import { Hound } from './Hound.js';
import { Acolyte } from './Acolyte.js';
import { Matriarch } from './Matriarch.js';
import { Wolf } from './Wolf.js';
import { Bowman } from './Bowman.js';
import { Wraith } from './Wraith.js';
import { Troll } from './Troll.js';
import { Saelith } from './Saelith.js';

const KINDS = {
  sentry: Sentry,
  captain: Sentry,
  hound: Hound, // packs share a `pack` id: they wake together and take turns to lunge
  acolyte: Acolyte,
  matriarch: Matriarch, // Vharra, the fen's boss: runs her own fight (Game.startFoeFight)
  knight: Sentry, // Dunmarrow Knights: the sentry's state machine in plate, with a shield bash
  bowman: Bowman,
  wolf: Wolf,
  wraith: Wraith,
  troll: Troll, // Grimhorn, the Howling Field's field boss
  saelith: Saelith, // the Rimewold's boss, in the Hall of the Winter Lantern
};

export function createEnemy(game, spawn) {
  const Kind = KINDS[spawn.kind] ?? Sentry;
  return new Kind(game, spawn);
}

// Kind names, e.g. for a test menu's spawn list.
export const enemyKinds = () => Object.keys(KINDS);
