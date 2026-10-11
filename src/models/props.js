// Static set pieces. Each builder returns a Group positioned at the origin; World places them.
import * as THREE from '../lib/three.js';
import { mat, mesh, box, cyl, cone, ico, group, glowSprite } from './kit.js';

const stone = () => mat(0x8a8478);
const darkStone = () => mat(0x5e5a53);
const wood = () => mat(0x5a4330);
const darkWood = () => mat(0x3a2b1f);
const bronze = () => mat(0x8c6a3c, { metalness: 0.7, roughness: 0.4 });

// Lantern shrine: the checkpoint. `flame` is the emissive part that brightens when kindled.
export function buildShrine() {
  const g = new THREE.Group();
  g.add(mesh(cyl(1.3, 1.5, 0.35, 6), darkStone(), { y: 0.17, receive: true }));
  g.add(mesh(cyl(0.9, 1.1, 0.3, 6), stone(), { y: 0.48, receive: true }));
  g.add(mesh(box(0.28, 1.9, 0.28), stone(), { y: 1.5 }));
  g.add(mesh(box(0.9, 0.1, 0.12), bronze(), { y: 2.35 }));
  const cage = group({ y: 2.0, x: 0.38 });
  cage.add(mesh(box(0.3, 0.04, 0.3), bronze(), { y: 0.22 }));
  cage.add(mesh(box(0.3, 0.04, 0.3), bronze(), { y: -0.18 }));
  for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) cage.add(mesh(box(0.03, 0.4, 0.03), bronze(), { x, z }));
  const flameMat = mat(0xffd59a, { unique: true, emissive: 0xffa040, emissiveIntensity: 0.3 });
  const flame = mesh(ico(0.1, 0), flameMat, { shadow: false });
  cage.add(flame);
  const glow = glowSprite(0xffb560, 2.4, 0.15);
  cage.add(glow);
  g.add(cage);
  return { group: g, flameMat, glow, lanternOffset: new THREE.Vector3(0.38, 2.0, 0) };
}

export function buildNoticeBoard() {
  const g = new THREE.Group();
  g.add(mesh(box(0.12, 2.0, 0.12), darkWood(), { x: -0.6, y: 1.0 }));
  g.add(mesh(box(0.12, 2.0, 0.12), darkWood(), { x: 0.6, y: 1.0 }));
  g.add(mesh(box(1.5, 0.9, 0.06), wood(), { y: 1.45 }));
  g.add(mesh(box(0.5, 0.6, 0.02), mat(0xd8cba8), { x: -0.3, y: 1.48, z: 0.04, rz: 0.05 }));
  g.add(mesh(box(0.4, 0.45, 0.02), mat(0xcbbd98), { x: 0.35, y: 1.42, z: 0.04, rz: -0.08 }));
  g.add(mesh(box(1.7, 0.08, 0.3), darkWood(), { y: 1.95 }));
  return g;
}

export function buildTent() {
  const g = new THREE.Group();
  const cloth = mat(0x7a6a4e, { side: THREE.DoubleSide });
  const t = mesh(cone(2.2, 2.4, 4), cloth, { y: 1.2, ry: Math.PI / 4 });
  g.add(t);
  g.add(mesh(box(0.9, 1.2, 0.05), mat(0x2a2219), { y: 0.6, z: 1.4, shadow: false }));
  return g;
}

export function buildCampfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(mesh(ico(0.18, 0), darkStone(), { x: Math.cos(a) * 0.55, y: 0.08, z: Math.sin(a) * 0.55 }));
  }
  g.add(mesh(box(0.9, 0.12, 0.12), darkWood(), { y: 0.12, ry: 0.5 }));
  g.add(mesh(box(0.9, 0.12, 0.12), darkWood(), { y: 0.16, ry: -0.7 }));
  const flame = mesh(cone(0.28, 0.6, 5), mat(0xffb050, { emissive: 0xff7a1a, emissiveIntensity: 2.2 }), { y: 0.42, shadow: false });
  g.add(flame);
  const glow = glowSprite(0xff8a30, 2.6, 0.55);
  glow.position.y = 0.6;
  g.add(glow);
  return { group: g, flame, glow };
}

export function buildBrazier() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.12, 0.2, 1.2, 6), darkStone(), { y: 0.6 }));
  g.add(mesh(cyl(0.5, 0.3, 0.35, 8), bronze(), { y: 1.3 }));
  const flame = mesh(cone(0.36, 0.8, 5), mat(0xffb050, { emissive: 0xff7a1a, emissiveIntensity: 2.2 }), { y: 1.75, shadow: false });
  g.add(flame);
  const glow = glowSprite(0xff8a30, 3.2, 0.6);
  glow.position.y = 1.9;
  g.add(glow);
  return { group: g, flame, glow };
}

export function buildCart() {
  const g = new THREE.Group();
  const bed = group({ y: 0.55, rz: 0.22, rx: -0.08 });
  bed.add(mesh(box(1.6, 0.12, 2.6), wood()));
  bed.add(mesh(box(0.08, 0.5, 2.6), wood(), { x: 0.78, y: 0.3 }));
  bed.add(mesh(box(1.6, 0.5, 0.08), wood(), { y: 0.3, z: -1.28 }));
  g.add(bed);
  const wheel = (x, z, rx, ry, y = 0.5) => g.add(mesh(cyl(0.5, 0.5, 0.1, 10), darkWood(), { x, y, z, rz: Math.PI / 2, rx, ry }));
  wheel(0.95, 0.7, 0, 0);
  wheel(1.8, -1.6, 0, 1.2, 0.08);
  g.children[g.children.length - 1].rotation.set(0, 0, 0.02);
  g.add(mesh(box(0.6, 0.6, 0.6), wood(), { x: -1.5, y: 0.3, z: 0.4, ry: 0.4 }));
  g.add(mesh(box(0.5, 0.5, 0.5), darkWood(), { x: -1.1, y: 0.25, z: 1.3, ry: -0.3, rz: 0.4 }));
  g.add(mesh(box(0.08, 0.08, 2.2), wood(), { x: 0.2, y: 0.2, z: 2.2, ry: 0.3 }));
  return g;
}

export function buildFence(len = 4) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 2) + 1);
  for (let i = 0; i < n; i++) g.add(mesh(box(0.12, 1.1, 0.12), darkWood(), { x: -len / 2 + (i * len) / (n - 1), y: 0.55 }));
  g.add(mesh(box(len, 0.1, 0.06), wood(), { y: 0.85 }));
  g.add(mesh(box(len, 0.1, 0.06), wood(), { y: 0.45 }));
  return g;
}

export function buildPillar(height = 4, broken = false) {
  const g = new THREE.Group();
  g.add(mesh(box(1.1, 0.4, 1.1), darkStone(), { y: 0.2, receive: true }));
  g.add(mesh(cyl(0.38, 0.42, height, 8), stone(), { y: 0.4 + height / 2 }));
  if (!broken) g.add(mesh(box(1.0, 0.35, 1.0), darkStone(), { y: 0.4 + height + 0.17 }));
  else g.add(mesh(ico(0.4, 0), stone(), { y: 0.4 + height, s: 0.9 }));
  return g;
}

export function buildGrave(rng) {
  const g = new THREE.Group();
  const tilt = (rng() - 0.5) * 0.3;
  if (rng() < 0.5) g.add(mesh(box(0.6, 0.9, 0.16), darkStone(), { y: 0.4, rz: tilt, rx: tilt * 0.5 }));
  else {
    g.add(mesh(box(0.14, 1.1, 0.14), darkStone(), { y: 0.5, rz: tilt }));
    g.add(mesh(box(0.6, 0.14, 0.14), darkStone(), { y: 0.75, rz: tilt }));
  }
  return g;
}

// A kneeling stone figure for the arena approach.
export function buildStatue() {
  const g = new THREE.Group();
  const s = mat(0x77736b);
  g.add(mesh(box(1.4, 0.6, 1.4), darkStone(), { y: 0.3 }));
  g.add(mesh(box(0.7, 0.9, 0.8), s, { y: 1.05, z: -0.1 }));
  g.add(mesh(box(0.8, 1.0, 0.45), s, { y: 1.85, rx: 0.25 }));
  g.add(mesh(box(0.36, 0.4, 0.36), s, { y: 2.55, z: 0.18, rx: 0.4 }));
  g.add(mesh(box(0.08, 2.4, 0.12), s, { x: 0.5, y: 1.6, z: 0.5 }));
  return g;
}

// Two hinged leaves; rotate `left.rotation.y` / `right.rotation.y` to open.
export function buildGateDoors(width = 6, height = 7) {
  const g = new THREE.Group();
  const door = mat(0x3b2e22);
  const iron = mat(0x2d2b29, { metalness: 0.6, roughness: 0.5 });
  const leaf = (side) => {
    const hinge = group({ x: side * width / 2 });
    const w = width / 2;
    hinge.add(mesh(box(w, height, 0.4), door, { x: -side * w / 2, y: height / 2 }));
    for (let i = 0; i < 3; i++) hinge.add(mesh(box(w, 0.2, 0.46), iron, { x: -side * w / 2, y: 1 + i * 2.4 }));
    g.add(hinge);
    return hinge;
  };
  return { group: g, left: leaf(-1), right: leaf(1) };
}

// Castle Dunmarrow's facade, seen past the arena. Visual only for now.
export function buildCastle() {
  const g = new THREE.Group();
  const wall = mat(0x6f6a62);
  const roof = mat(0x3c4250);
  const win = mat(0xffc27a, { emissive: 0xff9a40, emissiveIntensity: 1.6 });
  g.add(mesh(box(60, 16, 6), wall, { y: 8 }));
  for (let i = -5; i <= 5; i++) g.add(mesh(box(3, 2, 6.2), wall, { x: i * 5.6, y: 17 }));
  g.add(mesh(box(26, 30, 18), wall, { y: 15, z: -14 }));
  g.add(mesh(cone(15, 12, 4), roof, { y: 36, z: -14, ry: Math.PI / 4 }));
  for (const x of [-30, 30]) {
    g.add(mesh(cyl(5, 6, 34, 8), wall, { x, y: 17 }));
    g.add(mesh(cone(6.5, 12, 8), roof, { x, y: 40 }));
  }
  for (const x of [-16, 16]) {
    g.add(mesh(cyl(3.2, 3.6, 44, 8), wall, { x, y: 22, z: -20 }));
    g.add(mesh(cone(4.2, 14, 8), roof, { x, y: 51, z: -20 }));
  }
  for (const [x, y] of [[-6, 22], [0, 24], [6, 22], [-6, 14], [6, 14], [-30, 24], [30, 24], [-16, 34], [16, 34]]) {
    g.add(mesh(box(1, 1.8, 0.4), win, { x, y, z: x === -16 || x === 16 ? -16.7 : (Math.abs(x) === 30 ? 5.8 : -4.8), shadow: false }));
  }
  // Main door, barred.
  g.add(mesh(box(7, 9, 0.6), mat(0x2f251c), { y: 4.5, z: 3.2 }));
  g.add(mesh(box(8, 0.5, 0.8), mat(0x2d2b29, { metalness: 0.6 }), { y: 4.5, z: 3.4 }));
  return g;
}

// The Hollow Bell: a vast spire on the eastern peaks with a bell that never stops glowing.
export function buildSpire() {
  const g = new THREE.Group();
  const s = mat(0x6a6660);
  let y = 0;
  const tiers = [[16, 60], [12, 50], [9, 45], [7, 40], [5, 30]];
  for (const [r, h] of tiers) {
    g.add(mesh(cyl(r * 0.85, r, h, 8), s, { y: y + h / 2, shadow: false }));
    y += h;
  }
  const bellMat = mat(0xffe2a8, { emissive: 0xffb050, emissiveIntensity: 1.8 });
  bellMat.fog = false;
  g.add(mesh(box(14, 2, 2), s, { y: y + 14, shadow: false }));
  g.add(mesh(box(2, 16, 2), s, { x: -6, y: y + 7, shadow: false }));
  g.add(mesh(box(2, 16, 2), s, { x: 6, y: y + 7, shadow: false }));
  g.add(mesh(cyl(2.6, 5.2, 8, 10), bellMat, { y: y + 8, shadow: false }));
  const glow = glowSprite(0xffc070, 46, 0.55);
  glow.material.fog = false;
  glow.position.y = y + 8;
  g.add(glow);
  return { group: g, bellY: y + 8 };
}

export function buildBellDrop() {
  const m = mat(0xcfe8ff, { unique: true, emissive: 0x6fb6ff, emissiveIntensity: 1.6, opacity: 0.85 });
  const g = new THREE.Group();
  g.add(mesh(cyl(0.7, 1.4, 1.8, 10, true), m, { y: 0.9, shadow: false }));
  g.add(mesh(cyl(0.2, 0.7, 0.3, 10), m, { y: 1.95, shadow: false }));
  return { group: g, material: m };
}

// ---------- batched scenery ----------
// Templates for World's chunk batcher. Each returns parts in prop space (base at y = 0):
// { geo, matrix, color, flex | sway, phaseK }. Geometry is shared; colours are per call so every
// clump comes out a little different. See world/Batcher.js for how sway and phase are used.

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
export function xform(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

export function tone(hex, rng, dh = 0.02, dl = 0.07) {
  return new THREE.Color(hex).offsetHSL((rng() - 0.5) * dh, 0, (rng() - 0.5) * dl);
}

let SG = null;
// Shared low-poly shapes, each with its base at y = 0.
export function sceneryGeometries() {
  if (SG) return SG;
  const up = (g, y) => g.translate(0, y, 0);
  // Three-sided blade without a base: the cheapest thing that reads as grass from every side.
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 1, 0, 0, -0.5, 0, 0.866, -0.5, 0, -0.866], 3));
  blade.setIndex([1, 3, 0, 3, 2, 0, 2, 1, 0]);
  blade.computeVertexNormals();
  SG = {
    blade,
    trunk: up(new THREE.CylinderGeometry(0.16, 0.26, 1, 5), 0.5),
    pine: up(new THREE.ConeGeometry(1, 1, 6), 0.5),
    crown: new THREE.IcosahedronGeometry(1, 0),
    rock: new THREE.IcosahedronGeometry(1, 0),
    lump: new THREE.DodecahedronGeometry(1, 0),
    branch: up(new THREE.BoxGeometry(0.1, 1, 0.1), 0.5),
    octa: new THREE.OctahedronGeometry(1, 0),
    log: new THREE.CylinderGeometry(1, 1, 1, 7),
    disc: up(new THREE.CylinderGeometry(1, 1, 1, 7), 0.5),
    hex: up(new THREE.CylinderGeometry(1, 1.08, 1, 6), 0.5),
    stem: up(new THREE.CylinderGeometry(0.8, 1, 1, 5), 0.5),
    cap: up(new THREE.ConeGeometry(1, 1, 6), 0.5),
    box: up(new THREE.BoxGeometry(1, 1, 1), 0.5),
    cloth: new THREE.BoxGeometry(1, 1, 1, 1, 5, 1).translate(0, -0.5, 0),
    bell: up(new THREE.CylinderGeometry(0.55, 1, 1.1, 9), 0),
  };
  return SG;
}

export const TREE_FLEX = 0.026;

export function pineParts(rng) {
  const G = sceneryGeometries();
  return [
    { geo: G.trunk, matrix: xform(0, -0.2, 0, 0, 0, 0, 1, 3, 1), color: tone(0x4a3a2a, rng), flex: TREE_FLEX },
    { geo: G.pine, matrix: xform(0, 1.6, 0, 0, 0, 0, 2.2, 4.2, 2.2), color: tone(0x34482e, rng), flex: TREE_FLEX },
    { geo: G.pine, matrix: xform(0, 3.6, 0, 0, 0.5, 0, 1.5, 3.4, 1.5), color: tone(0x3c5232, rng), flex: TREE_FLEX },
  ];
}

// Rimewold pines: darker, bluer needles with snow lying on each tier.
export function snowPineParts(rng) {
  const G = sceneryGeometries();
  const snow = tone(0xeef3f6, rng, 0.01, 0.04);
  const t = 0.85 + rng() * 0.3;
  return [
    { geo: G.trunk, matrix: xform(0, -0.2, 0, 0, 0, 0, 1, 3, 1), color: tone(0x3e3228, rng), flex: TREE_FLEX },
    { geo: G.pine, matrix: xform(0, 1.4, 0, 0, 0, 0, 2.3, 3.8 * t, 2.3), color: tone(0x2a3c34, rng), flex: TREE_FLEX },
    { geo: G.pine, matrix: xform(0, 1.9, 0, 0, 0.3, 0, 2.0, 2.2 * t, 2.0), color: snow, flex: TREE_FLEX },
    { geo: G.pine, matrix: xform(0, 3.3, 0, 0, 0.5, 0, 1.6, 3.4 * t, 1.6), color: tone(0x2f4238, rng), flex: TREE_FLEX },
    { geo: G.pine, matrix: xform(0, 3.9, 0, 0, 0.9, 0, 1.25, 2.4 * t, 1.25), color: snow, flex: TREE_FLEX },
    { geo: G.pine, matrix: xform(0, 5.4, 0, 0, 0.2, 0, 0.8, 2.2 * t, 0.8), color: snow, flex: TREE_FLEX },
  ];
}

// A frosted snag: a dead tree with rime along its branches.
export function frostSnagParts(rng) {
  const parts = deadParts(rng);
  const G = sceneryGeometries();
  const rime = tone(0xdfe8ee, rng, 0.01, 0.04);
  parts.push({ geo: G.branch, matrix: xform(0.05, 2.62, 0, 0, 0, 0.8, 1.25, 1.75, 1.25), color: rime, flex: TREE_FLEX * 0.6 });
  parts.push({ geo: G.trunk, matrix: xform(0, 3.9, 0, 0, 0, 0, 0.55, 0.4, 0.55), color: rime, flex: TREE_FLEX * 0.6 });
  return parts;
}

// A grey-blue boulder with a cap of snow on top.
export function snowRockParts(rng) {
  const G = sceneryGeometries();
  return [
    { geo: G.rock, matrix: new THREE.Matrix4(), color: tone(0x7f858c, rng, 0.02, 0.1) },
    { geo: G.lump, matrix: xform(0, 0.55, 0, 0, rng() * 6, 0, 0.82, 0.38, 0.82), color: tone(0xf0f4f7, rng, 0.01, 0.04) },
  ];
}

// A wind-carved snowdrift: a few flattened lumps.
export function driftParts(rng) {
  const G = sceneryGeometries();
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = rng() * 6.28, d = i ? 0.8 + rng() * 0.8 : 0;
    parts.push({ geo: G.lump, matrix: xform(Math.sin(a) * d, -0.15, Math.cos(a) * d, 0, rng() * 6, 0, 1.2 + rng() * 0.8, 0.35 + rng() * 0.25, 0.8 + rng() * 0.6), color: tone(0xeaf0f4, rng, 0.01, 0.05) });
  }
  return parts;
}

export const BROAD_HUES = [0xb5832e, 0xc29a3a, 0x8f7a2e, 0xa4612a];

export function broadParts(rng) {
  const G = sceneryGeometries();
  const hue = BROAD_HUES[Math.floor(rng() * BROAD_HUES.length)];
  const a = rng() * 6.28;
  return [
    { geo: G.trunk, matrix: xform(0, -0.2, 0, 0, 0, 0, 1.2, 3.4, 1.2), color: tone(0x55402c, rng), flex: TREE_FLEX },
    { geo: G.crown, matrix: xform(0, 4.3, 0, 0, a, 0, 2.6, 2.1, 2.6), color: tone(hue, rng), flex: TREE_FLEX },
    { geo: G.crown, matrix: xform(Math.sin(a) * 1.3, 5.3, Math.cos(a) * 1.3, 0.4, a, 0, 1.5, 1.25, 1.5), color: tone(hue, rng).offsetHSL(0, 0, 0.04), flex: TREE_FLEX },
  ];
}

export function deadParts(rng) {
  const G = sceneryGeometries();
  const c = tone(0x4d4640, rng);
  return [
    { geo: G.trunk, matrix: xform(0, -0.2, 0, 0, 0, 0, 0.8, 4.5, 0.8), color: c, flex: TREE_FLEX * 0.6 },
    { geo: G.branch, matrix: xform(0, 2.6, 0, 0, 0, 0.8, 1, 1.8, 1), color: c, flex: TREE_FLEX * 0.6 },
    { geo: G.branch, matrix: xform(0, 3.2, 0, 0, 2.5, -0.7, 1, 1.4, 1), color: c, flex: TREE_FLEX * 0.6 },
  ];
}

export function rockParts(rng, hex = 0x7a766d) {
  return [{ geo: sceneryGeometries().rock, matrix: new THREE.Matrix4(), color: tone(hex, rng, 0.02, 0.1) }];
}

const GRASS = [0xb39a4e, 0x7c8740, 0x9a9446, 0x8a8a3e];
export function tuftParts(rng, hex) {
  const G = sceneryGeometries();
  const parts = [];
  const hue = hex ?? GRASS[Math.floor(rng() * GRASS.length)];
  const n = 3 + (rng() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rng();
    const tilt = 0.15 + rng() * 0.3;
    const h = 0.45 + rng() * 0.45;
    parts.push({ geo: G.blade, matrix: xform(Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06, Math.cos(a) * tilt, rng() * 6, -Math.sin(a) * tilt, 0.07, h, 0.07), color: tone(hue, rng, 0.03, 0.12), flex: 0.24 });
  }
  return parts;
}

const PETALS = [0xe8dcb0, 0x9a86b8, 0xc0563a, 0x8fa8c8, 0xd8b440, 0xe0a0a8];
export function flowerParts(rng) {
  const G = sceneryGeometries();
  const parts = [];
  const hue = PETALS[Math.floor(rng() * PETALS.length)];
  const hue2 = rng() < 0.3 ? PETALS[Math.floor(rng() * PETALS.length)] : hue;
  const n = 4 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.28, d = Math.sqrt(rng()) * 0.8;
    const x = Math.sin(a) * d, z = Math.cos(a) * d, h = 0.25 + rng() * 0.3;
    parts.push({ geo: G.blade, matrix: xform(x, 0, z, 0, rng() * 6, 0, 0.02, h, 0.02), color: tone(0x6d7a3a, rng), flex: 0.35 });
    const s = 0.06 + rng() * 0.04;
    parts.push({ geo: G.octa, matrix: xform(x, h, z, 0, rng(), 0, s, s * 0.6, s), color: tone(i % 3 ? hue : hue2, rng, 0.03, 0.1), flex: 0.35 });
  }
  return parts;
}

export function fernParts(rng) {
  const G = sceneryGeometries();
  const parts = [];
  const n = 6 + Math.floor(rng() * 3);
  const hue = rng() < 0.7 ? 0x4f6b34 : 0x7a7234;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rng() * 0.4;
    const tilt = 0.9 + rng() * 0.35;
    parts.push({ geo: G.blade, matrix: xform(0, 0, 0, Math.cos(a) * tilt, a, -Math.sin(a) * tilt, 0.13, 0.8 + rng() * 0.35, 0.05), color: tone(hue, rng), flex: 0.4 });
  }
  return parts;
}

const BUSH = [0x56652f, 0x4a5a2c, 0x76703a, 0x8a4f2a, 0x6a6a30];
export function bushParts(rng) {
  const G = sceneryGeometries();
  const parts = [];
  const hue = BUSH[Math.floor(rng() * BUSH.length)];
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.28, d = i ? 0.5 + rng() * 0.3 : 0;
    const s = (i ? 0.55 : 0.8) + rng() * 0.3;
    parts.push({ geo: G.lump, matrix: xform(Math.sin(a) * d, s * 0.55, Math.cos(a) * d, rng(), rng() * 6, rng(), s, s * 0.8, s), color: tone(hue, rng, 0.03, 0.1), flex: 0.07 });
  }
  return parts;
}

export function mushroomParts(rng) {
  const G = sceneryGeometries();
  const parts = [];
  const red = rng() < 0.45;
  const n = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.28, d = i ? 0.12 + rng() * 0.2 : 0;
    const x = Math.sin(a) * d, z = Math.cos(a) * d, h = 0.1 + rng() * 0.14, r = 0.07 + rng() * 0.07;
    parts.push({ geo: G.stem, matrix: xform(x, 0, z, 0, 0, 0, 0.035, h, 0.035), color: tone(0xd8ccb0, rng) });
    parts.push({ geo: G.cap, matrix: xform(x, h - 0.02, z, (rng() - 0.5) * 0.3, rng(), 0, r, r * 0.7, r), color: tone(red ? 0xa8452f : 0x8a6a4a, rng, 0.02, 0.1) });
  }
  return parts;
}

// Fallen log lying along local X. Collider: a box of half-size (len / 2, 0.4).
export function logParts(rng, len) {
  const G = sceneryGeometries();
  return [
    { geo: G.log, matrix: xform(0, 0.3, 0, 0, 0, Math.PI / 2, 0.36, len, 0.36), color: tone(0x4e3d2c, rng) },
    { geo: G.box, matrix: xform(len * 0.1, 0.6, 0, 0, 0, 0, len * 0.5, 0.06, 0.4), color: tone(0x5d6b34, rng) },
    { geo: G.branch, matrix: xform(-len * 0.2, 0.45, 0.2, 0.9, 0, 0.3, 1.2, 0.8, 1.2), color: tone(0x4e3d2c, rng) },
    { geo: G.disc, matrix: xform(len / 2, 0.3, 0, 0, 0, Math.PI / 2, 0.3, 0.02, 0.3), color: tone(0x9c8058, rng) },
  ];
}

export function reedParts(rng) {
  const G = sceneryGeometries();
  const parts = [];
  const n = 7 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.28, d = Math.sqrt(rng()) * 0.6;
    const x = Math.sin(a) * d, z = Math.cos(a) * d, h = 1.0 + rng() * 0.9;
    const tilt = (rng() - 0.5) * 0.25;
    parts.push({ geo: G.blade, matrix: xform(x, 0, z, tilt, rng() * 6, tilt, 0.035, h, 0.035), color: tone(rng() < 0.5 ? 0x6f7a3a : 0x8f8a48, rng), flex: 0.16 });
    if (i < 2) parts.push({ geo: G.stem, matrix: xform(x, h * 0.72, z, 0, 0, 0, 0.05, 0.24, 0.05), color: tone(0x5a4030, rng), flex: 0.16 });
  }
  return parts;
}

export function lilyParts(rng) {
  const G = sceneryGeometries();
  const s = 0.25 + rng() * 0.2;
  const parts = [{ geo: G.disc, matrix: xform(0, 0, 0, 0, rng() * 6, 0, s, 0.03, s), color: tone(0x4f6a3a, rng) }];
  if (rng() < 0.3) parts.push({ geo: G.octa, matrix: xform(s * 0.2, 0.06, 0, 0, rng(), 0, 0.09, 0.07, 0.09), color: tone(rng() < 0.5 ? 0xf0e8d8 : 0xe0a0b0, rng) });
  return parts;
}

export function pathStoneParts(rng) {
  const s = 0.18 + rng() * 0.2;
  return [{ geo: sceneryGeometries().hex, matrix: xform(0, -0.07, 0, (rng() - 0.5) * 0.12, rng() * 6, (rng() - 0.5) * 0.12, s, 0.11, s * (0.7 + rng() * 0.5)), color: tone(rng() < 0.5 ? 0x958b76 : 0x80786a, rng, 0.02, 0.1) }];
}

export function standingStoneParts(rng, h) {
  const G = sceneryGeometries();
  const tilt = (rng() - 0.5) * 0.16;
  return [
    { geo: G.box, matrix: xform(0, -0.4, 0, tilt, 0, tilt, 0.9 + rng() * 0.3, h, 0.55 + rng() * 0.2), color: tone(0x77736a, rng) },
    { geo: G.box, matrix: xform(0, h - 0.48, 0, tilt, 0, tilt, 0.95, 0.12, 0.6), color: tone(0x7f8460, rng) },
  ];
}

export function cairnParts(rng) {
  const G = sceneryGeometries();
  const parts = [];
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const s = 0.6 - i * 0.1;
    parts.push({ geo: G.rock, matrix: xform((rng() - 0.5) * 0.1, y + s * 0.35, (rng() - 0.5) * 0.1, 0, rng() * 6, 0, s, s * 0.55, s), color: tone(0x8a8478, rng, 0.02, 0.12) });
    y += s * 0.62;
  }
  return parts;
}

// Road banner: pole, crossbar and a cloth that flutters from the bar down.
export function bannerParts(rng, hex) {
  const G = sceneryGeometries();
  const top = 4.7;
  const sway = (lx, ly, lz, wy) => Math.max(0, top - wy) * 0.14;
  const cloth = tone(hex, rng);
  return [
    { geo: G.box, matrix: xform(0, -0.3, 0, 0, 0, 0, 0.16, 5.4, 0.16), color: tone(0x3a2b1f, rng) },
    { geo: G.box, matrix: xform(0.45, top, 0, 0, 0, 0, 1.4, 0.1, 0.1), color: tone(0x3a2b1f, rng) },
    { geo: G.cloth, matrix: xform(0.55, top, 0, 0, 0, 0, 1.0, 2.3, 0.04), color: cloth, sway, phaseK: -0.9 },
    { geo: G.octa, matrix: xform(0.55, top - 1.0, 0.03, 0, 0, 0, 0.22, 0.32, 0.02), color: tone(0xd8c48a, rng), sway, phaseK: -0.9 },
    { geo: G.cap, matrix: xform(0.55, top - 2.3, 0, Math.PI, 0, 0, 0.5, 0.35, 0.03), color: cloth, sway, phaseK: -0.9 },
  ];
}

// Lantern post; the glowing core is drawn separately (World batches all cores into one mesh).
export const LANTERN_CORE = new THREE.Vector3(0.62, 2.72, 0);
export function lanternPostParts(rng) {
  const G = sceneryGeometries();
  const wood = tone(0x3a2b1f, rng);
  const metal = tone(0x4a3c2a, rng);
  return [
    { geo: G.box, matrix: xform(0, -0.3, 0, 0, 0, 0, 0.18, 3.5, 0.18), color: wood },
    { geo: G.box, matrix: xform(0.35, 3.05, 0, 0, 0, 0, 0.8, 0.1, 0.1), color: wood },
    { geo: G.box, matrix: xform(0.62, 2.5, 0, 0, 0, 0, 0.32, 0.04, 0.32), color: metal },
    { geo: G.cap, matrix: xform(0.62, 2.92, 0, 0, Math.PI / 4, 0, 0.26, 0.2, 0.26), color: metal },
    { geo: G.box, matrix: xform(0.62, 2.95, 0, 0, 0, 0, 0.03, 0.12, 0.03), color: metal },
  ];
}

// The chapel's fallen bell, cracked and tipped in the grass.
export function fallenBellParts(rng) {
  const G = sceneryGeometries();
  return [
    { geo: G.bell, matrix: xform(0, 0.9, 0, 0, 0, 1.25, 1.1, 1.1, 1.1), color: tone(0x7c6a40, rng) },
    { geo: G.box, matrix: xform(-1.15, 1.6, 0, 0, 0, 1.25, 0.5, 0.3, 0.5), color: tone(0x6a5a36, rng) },
    { geo: G.box, matrix: xform(0.1, 1.0, 1.02, 0.2, 0, 0.9, 0.06, 0.9, 0.03), color: tone(0x3a3226, rng) },
  ];
}

// A treasure chest: an iron-banded wooden box whose lid (its own group, hinged at the back) swings open.
export function buildChest() {
  const g = new THREE.Group();
  const iron = mat(0x3a3836, { metalness: 0.6, roughness: 0.5 }), gold = mat(0xb08d4a, { metalness: 0.7, roughness: 0.35 });
  g.add(mesh(box(1.1, 0.6, 0.7), wood(), { y: 0.3 }));
  for (const x of [-0.42, 0.42]) g.add(mesh(box(0.08, 0.62, 0.72), iron, { x, y: 0.3 }));
  const lid = group({ y: 0.6, z: -0.35 });
  lid.add(mesh(box(1.1, 0.26, 0.7), darkWood(), { y: 0.13, z: 0.35 }));
  for (const x of [-0.42, 0.42]) lid.add(mesh(box(0.08, 0.28, 0.72), iron, { x, y: 0.13, z: 0.35 }));
  lid.add(mesh(box(0.16, 0.16, 0.05), gold, { y: 0.02, z: 0.71 })); // the lock plate
  g.add(lid);
  // The glint of what's inside, seen only once it opens.
  const shine = glowSprite(0xffd890, 1.2, 0);
  shine.position.set(0, 0.7, 0);
  g.add(shine);
  return { group: g, lid, shine };
}
