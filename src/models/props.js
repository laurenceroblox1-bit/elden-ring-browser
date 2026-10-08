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

// Geometries for instanced vegetation. Each is translated so y=0 is the base.
export function treeGeometries() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 1, 5);
  trunk.translate(0, 0.5, 0);
  const pine = new THREE.ConeGeometry(1, 1, 6);
  pine.translate(0, 0.5, 0);
  const crown = new THREE.IcosahedronGeometry(1, 0);
  const rock = new THREE.IcosahedronGeometry(1, 0);
  const tuft = new THREE.ConeGeometry(0.1, 0.6, 3);
  tuft.translate(0, 0.3, 0);
  const branch = new THREE.BoxGeometry(0.1, 1, 0.1);
  branch.translate(0, 0.5, 0);
  return { trunk, pine, crown, rock, tuft, branch };
}
