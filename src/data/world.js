// World layout data. North is -Z. Everything that places content in the Vale lives here,
// so new areas start as data before they need code.

export const WORLD = {
  size: 900, // terrain square edge, metres
  segments: 300,
  playRadius: 330, // hard edge; mountains rise from ~270
  spawn: { x: 0, z: 204, yaw: Math.PI },
};

// Named places. `flat` levels the ground for building; `r` is the banner trigger radius.
export const ZONES = {
  firstlight: { name: 'Shrine of First Light', x: 0, z: 212, r: 16, flat: 16 },
  camp: { name: "Brannoc's Camp", x: -58, z: 158, r: 16, flat: 14 },
  ruins: { name: 'The Watch Ruins', x: 130, z: 32, r: 30, flat: 28 },
  lake: { name: 'Mirelake Shore', x: -142, z: -26, r: 16, flat: 11 },
  moor: { name: 'The Western Moor', x: -228, z: -166, r: 18, flat: 10 },
  gatehouse: { name: 'Gatehouse Shrine', x: 16, z: -194, r: 12, flat: 11 },
  arena: { name: 'The Shattered Gate', x: 0, z: -252, r: 34, flat: 40 },
  castle: { name: 'Castle Dunmarrow', x: 0, z: -318, r: 22, flat: 34 },
};

export const ROADS = [
  [[0, 214], [6, 170], [-12, 115], [4, 45], [28, -25], [16, -95], [6, -160], [0, -224]],
  [[4, 45], [60, 42], [122, 34]],
  [[6, 170], [-52, 160]],
  [[-12, 115], [-70, 70], [-136, -22]],
  [[-136, -22], [-182, -100], [-226, -162]],
  [[0, -280], [0, -302]],
];

export const LAKE = { x: -195, z: 42, r: 50 };

export const ARENA = { x: 0, z: -252, r: 30, segments: 32 };

export const SHRINES = [
  { id: 'firstlight', name: 'Shrine of First Light', x: 5, z: 211 },
  { id: 'gatehouse', name: 'Gatehouse Shrine', x: 16, z: -194 },
];

export const NPCS = [
  { id: 'brannoc', name: 'Brannoc', title: 'Stablemaster', x: -55, z: 162, yaw: 2.2 },
  { id: 'ilse', name: 'Sister Ilse', title: 'Pilgrim', x: -143, z: -22, yaw: 2.4 },
];

export const NOTICE = { x: 11, z: 206, yaw: -0.6 };

export const ENEMY_SPAWNS = [
  { kind: 'sentry', x: 116, z: 42, yaw: 1.2 },
  { kind: 'sentry', x: 131, z: 47, yaw: 3.0 },
  { kind: 'sentry', x: 121, z: 19, yaw: -0.4 },
  { kind: 'sentry', x: 147, z: 39, yaw: 2.2 },
  { kind: 'captain', x: 139, z: 25, yaw: 0.6, drop: 'bone_whistle' },
  { kind: 'sentry', x: 25, z: -44, yaw: 0.2 },
  { kind: 'sentry', x: 12, z: -128, yaw: 0 },
  { kind: 'sentry', x: -217, z: -152, yaw: 2.4 },
];

export const PICKUPS = [
  { item: 'locket', quest: 'locket', x: -231, z: -170 },
];

// Fires get a flickering light (campfires) or just a glow (braziers).
export const FIRES = [
  { x: -51, z: 154, light: true },
  { x: 128, z: 34, light: true },
  { x: -146, z: -19, light: true },
  { x: -6, z: -219, light: false },
  { x: 6, z: -219, light: false },
];
