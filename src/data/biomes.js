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

// Play-area lobes (the Rimewold's is in world.js as RIME). Each is a circle; a ridge of peaks follows
// its rim where it overlaps the Vale, broken only by a pass at `gate` (the road through), so the way
// in is plain. The coast's lobe runs on west to the sea (`band`: no rim on that side).
export const LOBES = {
  cinder: { x: 0, z: 530, r: 150, gate: [0, 380], gap: 10 },
  coast: { x: -545, z: 10, r: 165, gate: [-380, 8], gap: 11, band: true },
  glow: { x: -390, z: -410, r: 160, gate: [-297, -280], gap: 10 },
};

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
];

export const BIOME_SHRINES = [
  { id: 'emberwatch', name: 'Emberwatch Shrine', x: -16, z: 440 },
  { id: 'calderasteps', name: 'Caldera Steps Shrine', x: 18, z: 576 },
  { id: 'tidehold', name: 'Tidehold Shrine', x: -446, z: 30 },
  { id: 'mossdeep', name: 'Mossdeep Shrine', x: -328, z: -334 },
];

export const BIOME_NPCS = [
  { id: 'hessa', name: 'Hessa', title: 'Smith of the Sunken Forge', x: -76, z: 536, yaw: -2.2 },
  { id: 'wenna', name: 'Old Wenna', title: 'Last of Saltmarrow', x: -470, z: 106, yaw: 1.4 },
  { id: 'murk', name: 'Murk', title: 'Myconid', x: -306, z: -436, yaw: -2.0 },
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
];

export const BIOME_PICKUPS = [
  { item: 'drowned_bell', quest: 'tides', x: -556, z: 96 },
];

export const BIOME_LOOT = [
  { gear: 'ember_flamberge', x: 88, z: 512 }, // in the Obsidian Field
  { gear: 'flame_breath', x: -88, z: 546 }, // on the forge's cold anvil
  { gear: 'cutlass', x: -480, z: 124 }, // in a Saltmarrow house
  { gear: 'harpoon', x: -526, z: -112 }, // at the lighthouse door
  { gear: 'spore_burst', x: -318, z: -446 }, // inside the Myconid's Ring
  { gear: 'thornguard', x: -424, z: -392 }, // under a giant glowcap
];

export const BIOME_KEEP_CLEAR = [
  ...BIOME_LOOT.map((l) => ({ x: l.x, z: l.z, r: 3 })),
  ...BIOME_PICKUPS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
];

export const BIOME_FIRES = [
  { x: -86, z: 532, light: true }, // the forge's hearth
  { x: -466, z: 100, light: true }, // Wenna's fire
  { x: -12, z: 448, light: false },
];

// Smithing stones (weapon upgrades, see data/smithing.js) lying in the outer regions.
export const STONES = [
  { x: 30, z: 430 }, { x: -100, z: 470 }, { x: 120, z: 590 }, { x: -60, z: 640 },
  { x: -420, z: -60 }, { x: -500, z: 170 }, { x: -590, z: 60 }, { x: -470, z: -150 },
  { x: -290, z: -380 }, { x: -470, z: -400 }, { x: -380, z: -500 }, { x: -260, z: -320 },
  { x: 150, z: 60 }, { x: -170, z: -180 }, { x: 40, z: -470 }, { x: -60, z: -540 },
];
