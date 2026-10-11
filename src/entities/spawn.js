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
import { Imp } from './Imp.js';
import { EmberHound } from './EmberHound.js';
import { Golem } from './Golem.js';
import { Drake } from './Drake.js';
import { Crab } from './Crab.js';
import { Captain } from './Captain.js';
import { Sporeling } from './Sporeling.js';
import { Stalker } from './Stalker.js';
import { Witch } from './Witch.js';
import { Scorpion } from './Scorpion.js';
import { SandWraith } from './SandWraith.js';
import { Scarab } from './Scarab.js';
import { ThunderWolf } from './ThunderWolf.js';
import { Gargoyle } from './Gargoyle.js';
import { Herald } from './Herald.js';
import { BellRinger } from './BellRinger.js';
import { Boar } from './Boar.js';
import { Barkhusk } from './Barkhusk.js';
import { AntlerKing } from './AntlerKing.js';
import { Shardback } from './Shardback.js';
import { PrismWraith } from './PrismWraith.js';
import { PrismGolem } from './PrismGolem.js';
import { Colossus } from './Colossus.js';
import { Skeleton } from './Skeleton.js';
import { Ghoul } from './Ghoul.js';
import { Gravewarden } from './Gravewarden.js';
import { OssuaryQueen } from './OssuaryQueen.js';

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
  // The Cinderfall Wastes.
  imp: Imp,
  firehound: EmberHound,
  golem: Golem, // an elite: a boss's moveset, an ordinary foe's leash
  drake: Drake, // Ashmaw, the Wastes' boss, asleep in the caldera
  // The Drowned Coast.
  drowned: Sentry, // Drowned Sailors: the sentry's state machine with a harpoon and no shield
  crab: Crab,
  captain_drowned: Captain, // Captain Morrow, the coast's boss, by his wreck
  // The Glowcap Hollows.
  sporeling: Sporeling,
  stalker: Stalker,
  witch: Witch, // Sylvara, the Hollows' boss, in the Heartcap Grove
  // The Gilded Dunes.
  scorpion: Scorpion,
  revenant: Sentry, // Sand Revenants: khopesh and a little gold shield
  sandwraith: SandWraith,
  scarab: Scarab, // Solkar, the Dunes' boss, under the Sanctum's sand
  // The Stormspire Heights.
  stormknight: Sentry, // Spire Knights: the knight's moveset with a crackling sword
  thunderwolf: ThunderWolf,
  gargoyle: Gargoyle, // an elite, like the Cinder Golems
  herald: Herald, // Vaelor, the Heights' boss, on the summit
  // The Hollow Bell.
  bellringer: BellRinger, // the last fight: waits beyond the Bell's mist until the five great ones fall
  // The Amberwood.
  boar: Boar,
  poacher: Sentry, // Amberwood Poachers: the sentry's state machine with a hatchet and no shield
  barkhusk: Barkhusk, // an elite, like the Cinder Golems
  antlerking: AntlerKing, // Hornwood, the Amberwood's boss, in the Antlered Glade
  // The Shardlands.
  shardback: Shardback,
  glassminer: Sentry, // Glass-Mad Miners: a heavy pick and no shield
  prismwraith: PrismWraith,
  prismgolem: PrismGolem, // an elite
  colossus: Colossus, // Corundel, the Shardlands' boss, in the Heart of Glass
  // The Undercroft.
  skeleton: Skeleton, // the sentry's moveset, and it gets back up once unless finished properly
  ghoul: Ghoul,
  gravewarden: Gravewarden, // an elite
  ossuaryqueen: OssuaryQueen, // Vesperine, the Undercroft's boss, in the Bone Chapel
};

export function createEnemy(game, spawn) {
  const Kind = KINDS[spawn.kind] ?? Sentry;
  return new Kind(game, spawn);
}

// Kind names, e.g. for a test menu's spawn list.
export const enemyKinds = () => Object.keys(KINDS);
