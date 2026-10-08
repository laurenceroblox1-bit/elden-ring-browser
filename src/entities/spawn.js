// Maps a spawn's `kind` (data/world.js ENEMY_SPAWNS) to the class that builds it.
// New enemy types register here; every class must offer the Sentry interface
// (pos, radius, height, alive, lockable, lockPoint, takeHit, reset, update, model.root, spawn, ash, tag).
import { Sentry } from './Sentry.js';

const KINDS = {
  sentry: Sentry,
  captain: Sentry,
};

export function createEnemy(game, spawn) {
  const Kind = KINDS[spawn.kind] ?? Sentry;
  return new Kind(game, spawn);
}

// Kind names, e.g. for a test menu's spawn list.
export const enemyKinds = () => Object.keys(KINDS);
