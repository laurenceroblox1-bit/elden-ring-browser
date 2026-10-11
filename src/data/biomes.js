// The outer regions: each is a lobe of the play area beyond the Vale's ring of mountains, reached by a
// pass. data/world.js merges everything here into its own lists (ZONES, ROADS, SHRINES, ...), so the
// rest of the game treats these places like any other. World.js and Scenery.js dress each biome.
//
//   cinder  The Cinderfall Wastes (south): black ash, basalt, lava pools and a lava river, an obsidian
//           field, the Sunken Forge, and Ashmaw's caldera under the smoking volcano.
//   coast   The Drowned Coast (west): pale sand, the open sea, wrecks in the shallows, the broken
//           lighthouse, the ruined village of Saltmarrow and the Drowned Captain's ship.
//   glow    The Glowcap Hollows (north-west): a forest of giant glowing mushrooms in violet spore-mist,
//           the Myconid's Ring and the Heartcap Grove.
//   dunes   The Gilded Dunes (east, past the Ashen Fen): golden sand, sandstone mesas and arches, the
//           Oasis of Seven Palms, and the Sanctum of the Sun where the Sun Scarab sleeps under the sand.
//   storm   The Stormspire Heights (north-east): grey crags and needle spires under a sky that never
//           stops thundering, a ruined watch-monastery, and the summit where the Storm Herald waits.
//   bell    The Hollow Bell (east, high on the peaks between the Dunes and the Heights): a barren shelf
//           of cracked bronze and fallen bells under the great spire. Its mist only lifts once the five
//           great ones of the outer regions are dead; the Bell-Ringer waits beyond it.
//   amber   The Amberwood (south-east): an old forest in endless autumn, red and gold, leaf litter
//           ankle-deep, the Amber Mere, the Huntsman's Lodge, and the Antlered Glade where the king of
//           the wood holds court.
//   crypt   The Undercroft (under Castle Dunmarrow, reached by the keep's stair): catacombs of the old
//           watch's dead, built off the map's edge as a hidden lobe (no pass, no rim) with walls and a
//           ceiling of its own. Skeletons that pull themselves back together, ghouls, traps, and the
//           Ossuary Queen in the bone chapel at its far end.
//   shard   The Shardlands (south-west): a pale stone steppe split by ridges of living crystal that hum
//           in the wind, the Singing Spires, Pell's Dig, and the Heart of Glass where the Colossus stands.

// Play-area lobes (the Rimewold's is in world.js as RIME). Each is a circle; a ridge of peaks follows
// its rim where it overlaps the Vale, broken only by a pass at `gate` (the road through), so the way
// in is plain. The coast's lobe runs on west to the sea (`band`: no rim on that side).
export const LOBES = {
  cinder: { x: 0, z: 530, r: 150, gate: [0, 380], gap: 10 },
  coast: { x: -545, z: 10, r: 165, gate: [-380, 8], gap: 11, band: true },
  glow: { x: -390, z: -410, r: 160, gate: [-297, -280], gap: 10 },
  dunes: { x: 590, z: 80, r: 160, gate: [431, 63], gap: 11 },
  storm: { x: 390, z: -400, r: 150, gate: [347, -257], gap: 10 },
  bell: { x: 500, z: -170, r: 75, gate: [440, -124], gap: 7 },
  amber: { x: 420, z: 420, r: 150, gate: [312, 312], gap: 10 },
  shard: { x: -420, z: 420, r: 150, gate: [-312, 312], gap: 10 },
  // Hidden: off the map, reached only by the keep's stair (Game.descend), walled and roofed by World.
  crypt: { x: -700, z: -700, r: 95, gate: [-700, -605], gap: 0, hidden: true },
};

// The Undercroft's floor plan, in metres from its centre (u east, v south). Cells of CRYPT.cell metres
// whose centres fall in a room or passage are open; every closed cell touching one is a wall.
export const CRYPT = {
  x: -700, z: -700, cell: 6, half: 66, floor: 4, ceiling: 9.6,
  rooms: [
    { r: [-10, 38, 10, 62] }, // the stair hall (you arrive here)
    { r: [-3, 20, 3, 38] }, // the long stair passage
    { c: [0, 6, 15] }, // the ossuary
    { r: [-42, 3, -14, 9] }, // the west passage (spike plates)
    { r: [-60, -24, -36, 30] }, // the catacombs
    { r: [-45, -36, -39, -24] }, // a gap in the catacomb wall...
    { r: [-48, -48, -30, -36] }, // ...to a forgotten reliquary
    { r: [14, 3, 42, 9] }, // the east passage (blades)
    { r: [36, -24, 60, 30] }, // the cistern
    { r: [-3, -30, 3, -9] }, // the north passage (fire vents)
    { c: [0, -46, 16] }, // the bone chapel
  ],
  arrive: { u: 0, v: 54, yaw: Math.PI },
  stair: { u: 0, v: 58 },
  keepDoor: { x: -5.2, z: -354, yaw: Math.PI / 2 }, // the keep's door in Castle Dunmarrow's courtyard
  blades: [{ u: 22, v: 6 }, { u: 30, v: 6 }],
  spikes: [{ u: -22, v: 6 }, { u: -30, v: 6 }, { u: -38, v: 6 }],
  // Fire vents in a wall at (u, v), breathing along (du, dv) for `len` metres.
  vents: [{ u: -6, v: -24, du: 1, dv: 0, len: 9 }, { u: 6, v: -15, du: -1, dv: 0, len: 9 }, { u: 36, v: -12, du: 1, dv: 0, len: 6 }, { u: 60, v: 12, du: -1, dv: 0, len: 6 }],
};
export const cryptW = (u, v) => [CRYPT.x + u, CRYPT.z + v];
export function cryptOpen(u, v) {
  for (const rm of CRYPT.rooms) {
    if (rm.r && u >= rm.r[0] && u <= rm.r[2] && v >= rm.r[1] && v <= rm.r[3]) return true;
    if (rm.c && Math.hypot(u - rm.c[0], v - rm.c[1]) <= rm.c[2]) return true;
  }
  return false;
}
export const CHAPEL = { x: -700, z: -746, r: 15, trigger: 12, leash: 30 };

// The coast: the sea's surface level, and how far west you can wade before the water is too deep.
export const SEA = { level: -9, shoreX: -575, walkX: -598 };

// Lava: pools (a glowing surface on a carved basin) and one river (a channel along a polyline).
export const LAVA = {
  pools: [
    { x: 52, z: 468, r: 13 },
    { x: -62, z: 486, r: 10 },
    { x: 92, z: 560, r: 15 },
    { x: -112, z: 598, r: 12 },
    { x: 64, z: 598, r: 8 },
  ],
  river: [[150, 410], [118, 445], [100, 490], [96, 545]],
  riverW: 4.5,
};

// Ashmaw's volcano, south of the caldera: a cone with a crater of lava at its top (outside the play area).
export const VOLCANO = { x: 0, z: 770, r: 130, h: 150, crater: 24 };

// Boss arenas (like HALL in world.js): a trigger radius that wakes the boss, a leash that ends the fight.
export const CALDERA = { x: 0, z: 622, r: 32, trigger: 22, leash: 50 };
export const WRECK = { x: -560, z: -46, r: 28, trigger: 18, leash: 46 };
export const GROVE = { x: -455, z: -482, r: 30, trigger: 21, leash: 46 };
export const SANCTUM = { x: 650, z: 120, r: 32, trigger: 22, leash: 50 };
export const SUMMIT = { x: 420, z: -470, r: 28, trigger: 19, leash: 44 };
export const BELLYARD = { x: 488, z: -168, r: 30, trigger: 20, leash: 46 };
export const SPIRE_AT = { x: 528, z: -204 };
// The five great ones whose deaths lift the Bell's mist: [flag, name].
export const GREAT_ONES = [
  ['ashmawDead', 'Ashmaw, the Cinder Drake'], ['morrowDead', 'Captain Morrow, the Drowned'], ['sylvaraDead', 'Sylvara, the Bloom Witch'],
  ['solkarDead', 'Solkar, the Sun Scarab'], ['vaelorDead', 'Vaelor, the Storm Herald'],
];
export const GLADE = { x: 490, z: 500, r: 30, trigger: 20, leash: 46 };
export const HEART = { x: -490, z: 500, r: 30, trigger: 20, leash: 46 };
// The oasis pool (a little Water surface on a carved hollow), and the Amberwood's mere (the same).
export const OASIS = { x: 560, z: 20, r: 16 };
export const MERE = { x: 474, z: 366, r: 18 };

export const BIOME_ZONES = {
  // Cinderfall
  cinderpass: { name: 'The Cinder Pass', x: 2, z: 392, r: 22, flat: null },
  emberwatch: { name: 'Emberwatch Shrine', x: -16, z: 440, r: 12, flat: 10 },
  cinder: { name: 'The Cinderfall Wastes', x: 4, z: 500, r: 46, flat: null },
  forge: { name: 'The Sunken Forge', x: -82, z: 540, r: 22, flat: 22 },
  obsidian: { name: 'The Obsidian Field', x: 84, z: 506, r: 28, flat: null },
  caldera: { name: "Ashmaw's Caldera", x: CALDERA.x, z: CALDERA.z, r: 34, flat: 42 },
  // Drowned Coast
  saltroad: { name: 'The Salt Road', x: -330, z: 0, r: 26, flat: null },
  tidehold: { name: 'Tidehold Shrine', x: -446, z: 30, r: 12, flat: 10 },
  coast: { name: 'The Drowned Coast', x: -490, z: 0, r: 44, flat: null },
  saltmarrow: { name: 'Saltmarrow', x: -476, z: 112, r: 26, flat: 24 },
  lighthouse: { name: 'The Broken Lighthouse', x: -522, z: -116, r: 18, flat: 16 },
  wreck: { name: "The Captain's Wreck", x: WRECK.x, z: WRECK.z, r: 30, flat: null },
  // Glowcap Hollows
  sporepass: { name: 'The Spore Pass', x: -300, z: -270, r: 22, flat: null },
  mossdeep: { name: 'Mossdeep Shrine', x: -328, z: -334, r: 12, flat: 10 },
  glowcap: { name: 'The Glowcap Hollows', x: -392, z: -404, r: 46, flat: null },
  ring: { name: "The Myconid's Ring", x: -310, z: -440, r: 16, flat: 14 },
  grove: { name: 'The Heartcap Grove', x: GROVE.x, z: GROVE.z, r: 32, flat: 38 },
  // Gilded Dunes
  dunegate: { name: 'The Sand Gate', x: 431, z: 63, r: 20, flat: null },
  sunrest: { name: 'Sunrest Shrine', x: 470, z: 52, r: 12, flat: 10 },
  dunes: { name: 'The Gilded Dunes', x: 540, z: 90, r: 50, flat: null },
  oasis: { name: 'The Oasis of Seven Palms', x: OASIS.x, z: OASIS.z, r: 28, flat: null },
  caravan: { name: 'The Lost Caravan', x: 520, z: 160, r: 18, flat: 14 },
  sanctum: { name: 'The Sanctum of the Sun', x: SANCTUM.x, z: SANCTUM.z, r: 34, flat: 42 },
  // Stormspire Heights
  stormpass: { name: 'The Thunder Stair', x: 347, z: -257, r: 20, flat: null },
  stormgate: { name: 'Stormgate Shrine', x: 360, z: -300, r: 12, flat: 10 },
  heights: { name: 'The Stormspire Heights', x: 380, z: -380, r: 50, flat: null },
  monastery: { name: 'The Broken Monastery', x: 320, z: -410, r: 22, flat: 22 },
  summit: { name: "The Herald's Summit", x: SUMMIT.x, z: SUMMIT.z, r: 30, flat: 36 },
  // The Hollow Bell
  bellmist: { name: "The Bell's Mist", x: 440, z: -124, r: 14, flat: null },
  bellfoot: { name: 'Bellfoot Shrine', x: 432, z: -104, r: 12, flat: 10 },
  bellyard: { name: 'The Hollow Bell', x: BELLYARD.x, z: BELLYARD.z, r: 34, flat: 40 },
  // The Amberwood
  huntersgap: { name: "The Hunter's Gap", x: 312, z: 312, r: 20, flat: null },
  leafwatch: { name: 'Leafwatch Shrine', x: 356, z: 340, r: 12, flat: 10 },
  amberwood: { name: 'The Amberwood', x: 420, z: 420, r: 50, flat: null },
  lodge: { name: "The Huntsman's Lodge", x: 362, z: 468, r: 20, flat: 18 },
  mere: { name: 'The Amber Mere', x: MERE.x, z: MERE.z, r: 26, flat: null },
  glade: { name: 'The Antlered Glade', x: GLADE.x, z: GLADE.z, r: 32, flat: 38 },
  // The Undercroft
  stairhall: { name: 'The Undercroft', x: -700, z: -650, r: 14, flat: null },
  ossuary: { name: 'The Ossuary', x: -700, z: -694, r: 14, flat: null },
  catacombs: { name: 'The Catacombs', x: -748, z: -697, r: 18, flat: null },
  reliquary: { name: 'The Forgotten Reliquary', x: -739, z: -742, r: 9, flat: null },
  cistern: { name: 'The Cistern', x: -652, z: -697, r: 18, flat: null },
  bonechapel: { name: 'The Bone Chapel', x: CHAPEL.x, z: CHAPEL.z, r: 16, flat: null },
  // The Shardlands
  glassgate: { name: 'The Glass Gate', x: -312, z: 312, r: 20, flat: null },
  prismwatch: { name: 'Prismwatch Shrine', x: -356, z: 340, r: 12, flat: 10 },
  shardlands: { name: 'The Shardlands', x: -420, z: 420, r: 50, flat: null },
  dig: { name: "Pell's Dig", x: -472, z: 368, r: 20, flat: 18 },
  spires: { name: 'The Singing Spires', x: -366, z: 476, r: 24, flat: null },
  heart: { name: 'The Heart of Glass', x: HEART.x, z: HEART.z, r: 32, flat: 38 },
};

export const BIOME_ROADS = [
  // South from First Light through the Cinder Pass to the caldera.
  [[0, 214], [8, 290], [-6, 360], [2, 420], [-8, 470], [6, 530], [0, 588]],
  [[-8, 470], [-50, 500], [-82, 530]],
  // West from Mirelake Shore along the Salt Road to the sea.
  [[-136, -22], [-240, -12], [-330, 0], [-420, 14], [-470, 20], [-520, 0], [-536, -36]],
  [[-470, 20], [-476, 90]],
  [[-470, 20], [-500, -60], [-518, -100]],
  // North-west from the moor road into the Hollows.
  [[-226, -162], [-268, -236], [-310, -300], [-360, -370], [-400, -420], [-440, -462]],
  [[-360, -370], [-322, -430]],
  // East from Fenwatch through the Sand Gate, past the oasis to the Sanctum of the Sun.
  [[288, 58], [360, 66], [431, 63], [470, 56], [520, 40], [560, 40], [610, 90], [628, 108]],
  [[520, 40], [522, 100], [520, 150]],
  // North from the fen road, west of the Mother's Hollow, up the Thunder Stair to the summit.
  [[248, 54], [262, -10], [285, -90], [320, -170], [347, -257], [360, -300], [372, -350], [390, -400], [410, -440]],
  [[372, -350], [340, -390], [322, -405]],
  // North-east from the dunes road up to the Bell's mist and the yard beyond.
  [[360, 66], [400, 0], [422, -70], [432, -104], [440, -124], [462, -146]],
  // South-east off the Cinder road, through the Hunter's Gap and the Amberwood to the Antlered Glade.
  [[8, 290], [90, 300], [180, 304], [260, 304], [312, 312], [350, 348], [392, 392], [430, 432], [462, 470]],
  [[392, 392], [376, 432], [366, 456]],
  [[392, 392], [440, 380], [452, 372]],
  // South-west from Brannoc's camp, through the Glass Gate to the Heart of Glass.
  [[-52, 160], [-120, 200], [-200, 248], [-270, 290], [-312, 312], [-350, 348], [-392, 392], [-430, 432], [-462, 470]],
  [[-392, 392], [-436, 380], [-460, 372]],
  [[-392, 392], [-380, 440], [-372, 462]],
];

export const BIOME_SHRINES = [
  { id: 'emberwatch', name: 'Emberwatch Shrine', x: -16, z: 440 },
  { id: 'calderasteps', name: 'Caldera Steps Shrine', x: 18, z: 576 },
  { id: 'tidehold', name: 'Tidehold Shrine', x: -446, z: 30 },
  { id: 'mossdeep', name: 'Mossdeep Shrine', x: -328, z: -334 },
  { id: 'sunrest', name: 'Sunrest Shrine', x: 470, z: 52 },
  { id: 'stormgate', name: 'Stormgate Shrine', x: 360, z: -300 },
  { id: 'bellfoot', name: 'Bellfoot Shrine', x: 432, z: -100 },
  { id: 'leafwatch', name: 'Leafwatch Shrine', x: 356, z: 340 },
  { id: 'gladesedge', name: "Glade's Edge Shrine", x: 446, z: 452 },
  { id: 'prismwatch', name: 'Prismwatch Shrine', x: -356, z: 340 },
  { id: 'glasslight', name: 'Glasslight Shrine', x: -446, z: 452 },
  { id: 'undercroft', name: 'Undercroft Shrine', x: -692, z: -648 },
];

export const BIOME_NPCS = [
  { id: 'hessa', name: 'Hessa', title: 'Smith of the Sunken Forge', x: -76, z: 536, yaw: -2.2 },
  { id: 'wenna', name: 'Old Wenna', title: 'Last of Saltmarrow', x: -470, z: 106, yaw: 1.4 },
  { id: 'murk', name: 'Murk', title: 'Myconid', x: -306, z: -436, yaw: -2.0 },
  { id: 'tamsin', name: 'Tamsin', title: 'Wandering Trader', x: 548, z: 38, yaw: 2.4 },
  { id: 'aldous', name: 'Brother Aldous', title: 'Last Monk of the Spire', x: 326, z: -404, yaw: 1.0 },
  { id: 'edda', name: 'Edda', title: 'Huntress of the Lodge', x: 366, z: 462, yaw: 0.6 },
  { id: 'pell', name: 'Pell', title: 'Glass-Cutter', x: -466, z: 364, yaw: -0.6 },
  { id: 'dorn', name: 'Dorn', title: 'Gravedigger of Dunmarrow', x: -706, z: -652, yaw: 1.4 },
];

export const BIOME_SPAWNS = [
  // Cinderfall Wastes
  { kind: 'imp', x: -6, z: 404, yaw: 3.1 },
  { kind: 'imp', x: 24, z: 470, yaw: 3.0 },
  { kind: 'imp', x: -30, z: 520, yaw: 2.6 },
  { kind: 'imp', x: 70, z: 530, yaw: -2.6 },
  { kind: 'firehound', pack: 'cinder1', x: 40, z: 440, yaw: 3.0 },
  { kind: 'firehound', pack: 'cinder1', x: 44, z: 444, yaw: 2.8 },
  { kind: 'firehound', pack: 'cinder1', x: 36, z: 446, yaw: 3.2 },
  { kind: 'golem', x: 84, z: 500, yaw: 2.4 },
  { kind: 'golem', x: -40, z: 566, yaw: 2.9 },
  { kind: 'imp', x: 30, z: 560, yaw: 3.1 },
  { kind: 'drake', x: CALDERA.x, z: CALDERA.z + 8, yaw: Math.PI },
  // Drowned Coast
  { kind: 'drowned', x: -380, z: 6, yaw: 1.5 },
  { kind: 'drowned', x: -450, z: -10, yaw: 1.2 },
  { kind: 'drowned', x: -480, z: 120, yaw: 2.0 },
  { kind: 'drowned', x: -462, z: 100, yaw: 0.6 },
  { kind: 'drowned', x: -510, z: -90, yaw: 0.3 },
  { kind: 'crab', pack: 'beach1', x: -545, z: 30, yaw: 1.6 },
  { kind: 'crab', pack: 'beach1', x: -550, z: 38, yaw: 1.4 },
  { kind: 'crab', pack: 'beach2', x: -548, z: 120, yaw: 1.8 },
  { kind: 'crab', pack: 'beach2', x: -552, z: 128, yaw: 1.5 },
  { kind: 'crab', pack: 'beach3', x: -540, z: -150, yaw: 0.8 },
  { kind: 'bowman', x: -520, z: -128, yaw: 1.0 },
  { kind: 'captain_drowned', x: WRECK.x - 4, z: WRECK.z - 6, yaw: 1.2 },
  // Glowcap Hollows
  { kind: 'sporeling', x: -296, z: -290, yaw: 2.2 },
  { kind: 'sporeling', x: -346, z: -360, yaw: 2.6 },
  { kind: 'sporeling', x: -352, z: -366, yaw: 2.4 },
  { kind: 'sporeling', x: -420, z: -380, yaw: 1.9 },
  { kind: 'sporeling', x: -426, z: -388, yaw: 2.1 },
  { kind: 'sporeling', x: -380, z: -450, yaw: 2.6 },
  { kind: 'stalker', x: -360, z: -400, yaw: 2.0 },
  { kind: 'stalker', x: -440, z: -420, yaw: 1.6 },
  { kind: 'stalker', x: -410, z: -460, yaw: 1.2 },
  { kind: 'witch', x: GROVE.x - 6, z: GROVE.z - 8, yaw: 0.6 },
  // Gilded Dunes
  { kind: 'scorpion', pack: 'dune1', x: 480, z: 90, yaw: -1.5 },
  { kind: 'scorpion', pack: 'dune1', x: 486, z: 96, yaw: -1.7 },
  { kind: 'scorpion', pack: 'dune2', x: 590, z: 150, yaw: -2.4 },
  { kind: 'scorpion', pack: 'dune2', x: 596, z: 144, yaw: -2.2 },
  { kind: 'revenant', x: 505, z: 60, yaw: -1.4 },
  { kind: 'revenant', x: 516, z: 166, yaw: -2.0 },
  { kind: 'revenant', x: 528, z: 154, yaw: -1.2 },
  { kind: 'revenant', x: 612, z: 92, yaw: -2.2 },
  { kind: 'sandwraith', x: 560, z: 120, yaw: -1.8 },
  { kind: 'sandwraith', x: 600, z: 40, yaw: -2.6 },
  { kind: 'scarab', x: SANCTUM.x + 6, z: SANCTUM.z + 6, yaw: -2.3 },
  // Stormspire Heights
  { kind: 'stormknight', x: 352, z: -272, yaw: 2.9 },
  { kind: 'stormknight', x: 368, z: -330, yaw: 2.8 },
  { kind: 'stormknight', x: 330, z: -400, yaw: 2.2 },
  { kind: 'thunderwolf', pack: 'storm1', x: 400, z: -360, yaw: 2.6 },
  { kind: 'thunderwolf', pack: 'storm1', x: 404, z: -364, yaw: 2.4 },
  { kind: 'thunderwolf', pack: 'storm1', x: 396, z: -366, yaw: 2.8 },
  { kind: 'gargoyle', x: 386, z: -410, yaw: 2.4 },
  { kind: 'gargoyle', x: 300, z: -420, yaw: 1.4 },
  { kind: 'herald', x: SUMMIT.x + 4, z: SUMMIT.z - 6, yaw: 2.6 },
  // The Hollow Bell
  { kind: 'bellringer', x: BELLYARD.x + 8, z: BELLYARD.z - 8, yaw: -2.4 },
  // The Amberwood
  { kind: 'boar', pack: 'amber1', x: 330, z: 360, yaw: -2.2 },
  { kind: 'boar', pack: 'amber1', x: 334, z: 366, yaw: -2.4 },
  { kind: 'boar', pack: 'amber2', x: 450, z: 410, yaw: -2.6 },
  { kind: 'boar', pack: 'amber2', x: 456, z: 404, yaw: -2.2 },
  { kind: 'boar', pack: 'amber3', x: 520, z: 430, yaw: -2.0 },
  { kind: 'poacher', x: 372, z: 380, yaw: -2.4 },
  { kind: 'poacher', x: 400, z: 444, yaw: -2.8 },
  { kind: 'poacher', x: 340, z: 440, yaw: 2.6 },
  { kind: 'poacher', x: 432, z: 392, yaw: -2.0 },
  { kind: 'bowman', x: 410, z: 470, yaw: -2.6 },
  { kind: 'bowman', x: 488, z: 380, yaw: -2.0 },
  { kind: 'barkhusk', x: 420, z: 410, yaw: -2.4 },
  { kind: 'barkhusk', x: 500, z: 440, yaw: -2.6 },
  { kind: 'antlerking', x: GLADE.x + 6, z: GLADE.z + 6, yaw: -2.4 },
  // The Shardlands
  { kind: 'shardback', pack: 'shard1', x: -334, z: 362, yaw: 2.2 },
  { kind: 'shardback', pack: 'shard1', x: -340, z: 366, yaw: 2.4 },
  { kind: 'shardback', pack: 'shard2', x: -440, z: 420, yaw: 2.6 },
  { kind: 'shardback', pack: 'shard2', x: -446, z: 414, yaw: 2.2 },
  { kind: 'shardback', pack: 'shard3', x: -520, z: 440, yaw: 2.0 },
  { kind: 'glassminer', x: -372, z: 380, yaw: 2.4 },
  { kind: 'glassminer', x: -486, z: 388, yaw: 2.8 },
  { kind: 'glassminer', x: -402, z: 446, yaw: 2.6 },
  { kind: 'prismwraith', x: -366, z: 470, yaw: 2.4 },
  { kind: 'prismwraith', x: -500, z: 420, yaw: 2.0 },
  { kind: 'prismwraith', x: -420, z: 500, yaw: 2.8 },
  { kind: 'prismgolem', x: -420, z: 400, yaw: 2.4 },
  { kind: 'prismgolem', x: -510, z: 460, yaw: 2.6 },
  { kind: 'colossus', x: HEART.x - 6, z: HEART.z + 6, yaw: 2.4 },
  // The Undercroft
  { kind: 'skeleton', x: -697, z: -676, yaw: 0 },
  { kind: 'skeleton', x: -706, z: -690, yaw: 0.6 },
  { kind: 'skeleton', x: -692, z: -700, yaw: -0.6 },
  { kind: 'ghoul', pack: 'crypt1', x: -745, z: -680, yaw: 1.2 },
  { kind: 'ghoul', pack: 'crypt1', x: -750, z: -676, yaw: 1.4 },
  { kind: 'skeleton', x: -752, z: -710, yaw: 0.4 },
  { kind: 'skeleton', x: -742, z: -716, yaw: 0.2 },
  { kind: 'gravewarden', x: -748, z: -694, yaw: 1.6 },
  { kind: 'ghoul', pack: 'crypt2', x: -654, z: -710, yaw: -1.4 },
  { kind: 'ghoul', pack: 'crypt2', x: -648, z: -706, yaw: -1.2 },
  { kind: 'ghoul', pack: 'crypt2', x: -656, z: -682, yaw: -1.6 },
  { kind: 'skeleton', x: -646, z: -692, yaw: -1.6 },
  { kind: 'gravewarden', x: -652, z: -716, yaw: -1.0 },
  { kind: 'skeleton', x: -697, z: -720, yaw: 0 },
  { kind: 'ossuaryqueen', x: CHAPEL.x, z: CHAPEL.z - 6, yaw: 0 },
];

export const BIOME_PICKUPS = [
  { item: 'drowned_bell', quest: 'tides', x: -556, z: 96 },
  { item: 'sun_disc', quest: 'caravan', x: 524, z: 166 },
  { item: 'prism_lamp', quest: 'pellslamp', x: -360, z: 484 },
];

export const BIOME_LOOT = [
  { gear: 'ember_flamberge', x: 88, z: 512 }, // in the Obsidian Field
  { gear: 'flame_breath', x: -88, z: 546 }, // on the forge's cold anvil
  { gear: 'cutlass', x: -480, z: 124 }, // in a Saltmarrow house
  { gear: 'harpoon', x: -526, z: -112 }, // at the lighthouse door
  { gear: 'spore_burst', x: -318, z: -446 }, // inside the Myconid's Ring
  { gear: 'thornguard', x: -424, z: -392 }, // under a giant glowcap
  { gear: 'sun_khopesh', x: 512, z: 158 }, // among the caravan's wagons
  { gear: 'sandstorm', x: 566, z: 32 }, // by the oasis pool
  { gear: 'storm_spear', x: 318, z: -414 }, // in the monastery's chapel
  { gear: 'lightning_call', x: 404, z: -414 }, // on a spire's foot
  { gear: 'hunters_hatchet', x: 350, z: 464.5 }, // by the lodge's chopping block
  { gear: 'oakheart_shield', x: 497, z: 361 }, // at the foot of the mere's little jetty
  { gear: 'bramble_snare', x: 520, z: 470 }, // in a ring of thorn by the glade
  { gear: 'prism_blade', x: -380, z: 392 }, // stuck in a crystal on the road
  { gear: 'glass_aegis', x: -476.5, z: 361 }, // propped against Pell's cart
  { gear: 'shard_volley', x: -530, z: 420 }, // in a crystal hollow under the western ridge
  { gear: 'gravedigger_spade', x: -756, z: -700 }, // on a catacomb shelf
  { gear: 'bone_ward', x: -652, z: -680 }, // in the cistern's shallows
  { gear: 'grave_chill', x: -739, z: -742 }, // in the forgotten reliquary
];

export const BIOME_KEEP_CLEAR = [
  ...BIOME_LOOT.map((l) => ({ x: l.x, z: l.z, r: 3 })),
  ...BIOME_PICKUPS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
];

export const BIOME_FIRES = [
  { x: -86, z: 532, light: true }, // the forge's hearth
  { x: -466, z: 100, light: true }, // Wenna's fire
  { x: -12, z: 448, light: false },
  { x: 544, z: 36, light: true }, // Tamsin's camp at the oasis
  { x: 330, z: -400, light: true }, // the monastery hearth
  { x: 370, z: 466, light: true }, // the lodge's hearth
  { x: -468, z: 369, light: true }, // Pell's fire
];

// Smithing stones (weapon upgrades, see data/smithing.js) lying in the outer regions.
export const STONES = [
  { x: 30, z: 430 }, { x: -100, z: 470 }, { x: 120, z: 590 }, { x: -60, z: 640 },
  { x: -420, z: -60 }, { x: -500, z: 170 }, { x: -590, z: 60 }, { x: -470, z: -150 },
  { x: -290, z: -380 }, { x: -470, z: -400 }, { x: -380, z: -500 }, { x: -260, z: -320 },
  { x: 150, z: 60 }, { x: -170, z: -180 }, { x: 40, z: -470 }, { x: -60, z: -540 },
  { x: 500, z: 120 }, { x: 640, z: 40 }, { x: 580, z: 190 }, { x: 700, z: 90 },
  { x: 350, z: -350 }, { x: 430, z: -400 }, { x: 300, z: -440 }, { x: 460, z: -500 },
  { x: 330, z: 400 }, { x: 440, z: 480 }, { x: 520, z: 380 }, { x: 400, z: 520 },
  { x: -330, z: 400 }, { x: -440, z: 480 }, { x: -520, z: 380 }, { x: -400, z: 520 },
  { x: -755, z: -720 }, { x: -645, z: -715 }, { x: -735, z: -738 },
];

// Treasure chests, in every region. `loot`: { ash } | { stones } | { gear }. A `mimic` is a chest with
// teeth: open it and it fights (entities/Mimic.js); its loot drops when it dies.
export const CHESTS = [
  // The Vale.
  { x: 126, z: 20, yaw: 0.4, loot: { ash: 400 } },
  { x: -126, z: 90, yaw: 2.6, loot: { stones: 1 } },
  { x: -238, z: -174, yaw: 1.2, loot: { ash: 500 } },
  { x: 302, z: -14, yaw: -1.0, loot: { ash: 900 }, mimic: true },
  { x: 22, z: -340, yaw: -1.6, loot: { stones: 2 } },
  // The Rimewold.
  { x: -112, z: -418, yaw: 0.8, loot: { ash: 700 } },
  { x: 92, z: -478, yaw: 2.0, loot: { gear: 'mimic_fang' }, mimic: true },
  // The Cinderfall Wastes.
  { x: -70, z: 548, yaw: -1.6, loot: { stones: 2 } },
  { x: 30, z: 500, yaw: -2.6, loot: { ash: 1000 } },
  // The Drowned Coast.
  { x: -488, z: 120, yaw: 1.4, loot: { ash: 800 } },
  { x: -514, z: -128, yaw: 0.6, loot: { ash: 1400 }, mimic: true },
  // The Glowcap Hollows.
  { x: -318, z: -452, yaw: 2.2, loot: { stones: 2 } },
  { x: -410, z: -452, yaw: 1.0, loot: { ash: 900 } },
  // The Gilded Dunes.
  { x: 530, z: 174, yaw: -2.0, loot: { ash: 1600 }, mimic: true },
  { x: 632, z: 96, yaw: -0.8, loot: { gear: 'gilded_rapier' } },
  // The Stormspire Heights.
  { x: 326, z: -414, yaw: 0, loot: { stones: 2 } },
  // The Amberwood.
  { x: 346, z: 480, yaw: 1.2, loot: { ash: 900 } },
  { x: 506, z: 520, yaw: -2.4, loot: { ash: 1600 }, mimic: true },
  // The Shardlands.
  { x: -488, z: 382, yaw: -1.0, loot: { stones: 2 } },
  { x: -378, z: 492, yaw: 2.4, loot: { ash: 1100 } },
  // The Undercroft.
  { x: -756, z: -716, yaw: 1.6, loot: { stones: 2 } },
  { x: -744, z: -744, yaw: 0.0, loot: { ash: 2000 }, mimic: true },
  { x: -646, z: -720, yaw: -1.6, loot: { ash: 1200 } },
];
