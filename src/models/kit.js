// Shared building blocks for the procedural low-poly models.
import * as THREE from '../lib/three.js';

const matCache = new Map();

// Flat-shaded standard material. Cached by look unless `unique` (needed when a material animates).
export function mat(color, o = {}) {
  const key = [color, o.metalness ?? 0, o.roughness ?? 0.85, o.emissive ?? 0, o.emissiveIntensity ?? 1, o.opacity ?? 1, o.side ?? 0].join('|');
  if (!o.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: o.roughness ?? 0.85,
    metalness: o.metalness ?? 0,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: (o.opacity ?? 1) < 1,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
  });
  if (!o.unique) matCache.set(key, m);
  return m;
}

const geoCache = new Map();
const cached = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
};
export const box = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, seg = 8, open = false) =>
  cached(`c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
export const cone = (r, h, seg = 6) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const ico = (r, d = 0) => cached(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
export const sphere = (r, w = 8, h = 6) => cached(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));

export function mesh(geo, material, t = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  m.rotation.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
  if (t.s) m.scale.setScalar(t.s);
  m.castShadow = t.shadow ?? true;
  m.receiveShadow = t.receive ?? false;
  return m;
}

export function group(t = {}) {
  const g = new THREE.Group();
  g.position.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  g.rotation.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
  return g;
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glowSprite(color, size = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}
