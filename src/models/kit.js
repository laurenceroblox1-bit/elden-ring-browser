// Shared building blocks for the procedural low-poly models.
import * as THREE from '../lib/three.js';

const matCache = new Map();

// Smooth-shaded standard material (soft, rounded look; pass flat: true for a faceted one).
// Cached by look unless `unique` (needed when a material animates).
export function mat(color, o = {}) {
  const key = [color, o.metalness ?? 0, o.roughness ?? 0.85, o.emissive ?? 0, o.emissiveIntensity ?? 1, o.opacity ?? 1, o.side ?? 0, o.flat ? 1 : 0].join('|');
  if (!o.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color,
    flatShading: !!o.flat,
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
// Boxes get rounded edges (radius ~32% of the thinnest side) with smooth normals, so armour, robes
// and props read as soft carved shapes instead of sharp blocks. plainBox() keeps hard edges for
// geometry that is scaled non-uniformly (instanced walls), where a rounded corner would stretch.
export const box = (w, h, d) => cached(`b${w},${h},${d}`, () => roundedBox(w, h, d, Math.min(w, h, d) * 0.32));
export const plainBox = (w, h, d) => cached(`pb${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
// Curved shapes get enough segments to read as round under smooth shading.
export const cyl = (rt, rb, h, seg = 12, open = false) => {
  const n = Math.max(seg, 12);
  return cached(`c${rt},${rb},${h},${n},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, n, 1, open));
};
export const cone = (r, h, seg = 10) => {
  const n = Math.max(seg, 10);
  return cached(`k${r},${h},${n}`, () => new THREE.ConeGeometry(r, h, n));
};
export const ico = (r, d = 0) => cached(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
export const sphere = (r, w = 14, h = 10) => cached(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
// A capsule `len` long overall (caps included), centred on its origin, along Y.
export const capsule = (r, len, seg = 10) =>
  cached(`p${r},${len},${seg}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, seg));

// A box whose edges and corners are rounded by `r`. Built from a subdivided box: the outer band of
// each axis is squeezed into the last `r`, then every vertex is pushed onto a sphere of radius r around
// the nearest point of the inner box. Normals point straight out of that sphere, so shading is smooth.
function roundedBox(w, h, d, r, seg = 4) {
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const half = [w / 2, h / 2, d / 2];
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const p = new THREE.Vector3(), inner = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const c = p.toArray();
    for (let a = 0; a < 3; a++) {
      const hw = half[a], t = Math.abs(c[a]) / hw, rr = Math.min(r / hw, 0.5);
      // Inner half of the axis spans [0, 1 - rr]; the outer half spans the rounded band [1 - rr, 1].
      const t2 = t <= 0.5 ? (t / 0.5) * (1 - rr) : 1 - rr + ((t - 0.5) / 0.5) * rr;
      c[a] = Math.sign(c[a]) * t2 * hw;
    }
    p.fromArray(c);
    inner.set(
      THREE.MathUtils.clamp(p.x, -half[0] + r, half[0] - r),
      THREE.MathUtils.clamp(p.y, -half[1] + r, half[1] - r),
      THREE.MathUtils.clamp(p.z, -half[2] + r, half[2] - r),
    );
    n.subVectors(p, inner);
    if (n.lengthSq() > 1e-12) {
      n.normalize();
      p.copy(inner).addScaledVector(n, r);
    } else n.fromBufferAttribute(nor, i);
    pos.setXYZ(i, p.x, p.y, p.z);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  geo.computeBoundingSphere();
  return geo;
}

export function mesh(geo, material, t = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  m.rotation.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
  if (t.s) m.scale.setScalar(t.s);
  if (t.sx || t.sy || t.sz) m.scale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
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

// ---------- rig merging ----------
// A jointed model is ~30 small meshes, each a draw call (two with shadows). mergeRig() collapses every
// static mesh into one skinned mesh per material: each mesh is baked into the space of the bone group
// that carries it and skinned rigidly (weight 1) to that bone, so posing still just rotates the groups
// and every pose looks exactly as before. Nothing is copied per frame; the GPU applies bone matrices.
//   bones   the groups that move (pose joints); any mesh below a bone, through static sub-groups, is baked
//   keep    subtrees left alone: swappable gear, things toggled or animated on their own (flask, cloak)
// Meshes with a different shadow setting stay apart. Merged geometry is cached, so identical rigs
// (every sentry) share their GPU buffers.
const mergedGeo = new Map();
const _mat = new THREE.Matrix4();
const _nrm = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _box = new THREE.Box3();

export function mergeRig(root, bones, { keep = [] } = {}) {
  root.updateMatrixWorld(true);
  const boneSet = new Set(bones);
  const stop = new Set(keep);
  const buckets = new Map();
  const merged = [];
  bones.forEach((bone, bi) => {
    // Matrices are built relative to the bone; descent stops at the next bone or a kept subtree.
    const walk = (o, rel) => {
      for (const c of o.children) {
        if (boneSet.has(c) || stop.has(c) || !c.visible) continue;
        const m = new THREE.Matrix4().multiplyMatrices(rel, c.matrix);
        if (c.isMesh && !c.isInstancedMesh && !c.isSkinnedMesh && !Array.isArray(c.material) && c.geometry.attributes.position) {
          const key = `${c.material.uuid}|${c.castShadow}|${c.receiveShadow}|${c.renderOrder}`;
          if (!buckets.has(key)) buckets.set(key, { src: c, parts: [] });
          buckets.get(key).parts.push({ geo: c.geometry, m, bone: bi });
          merged.push(c);
        }
        walk(c, m);
      }
    };
    walk(bone, new THREE.Matrix4());
  });
  if (!merged.length) return [];

  // Take the originals out. A merged mesh that still carries something unmerged (a sprite, a marker)
  // leaves a plain group with its transform behind.
  const gone = new Set(merged);
  for (const c of merged) {
    const rest = c.children.filter((k) => !gone.has(k));
    if (rest.length) {
      const g = new THREE.Group();
      g.position.copy(c.position);
      g.quaternion.copy(c.quaternion);
      g.scale.copy(c.scale);
      g.add(...rest);
      c.parent.add(g);
    }
    c.parent.remove(c);
  }

  // Rest-pose bounds, widened so swings, rolls and falls stay inside (the sphere is fixed, not re-skinned).
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  _box.makeEmpty();
  for (const { parts } of buckets.values()) {
    for (const p of parts) {
      _mat.multiplyMatrices(rootInv, bones[p.bone].matrixWorld).multiply(p.m);
      const pos = p.geo.attributes.position;
      for (let i = 0; i < pos.count; i++) _box.expandByPoint(_v.fromBufferAttribute(pos, i).applyMatrix4(_mat));
    }
  }
  const sphere = _box.getBoundingSphere(new THREE.Sphere());
  sphere.radius = sphere.radius * 1.5 + 0.3;

  const skeleton = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  const out = [];
  for (const { src, parts } of buckets.values()) {
    const sm = new THREE.SkinnedMesh(bakeParts(parts), src.material);
    sm.castShadow = src.castShadow;
    sm.receiveShadow = src.receiveShadow;
    sm.renderOrder = src.renderOrder;
    sm.bind(skeleton, new THREE.Matrix4()); // identity bind: vertices already sit in their bone's space
    sm.boundingSphere = sphere;
    sm.name = 'merged';
    root.add(sm);
    out.push(sm);
  }
  return out;
}

// Hand-merges geometries (indexed or not) into one indexed geometry with rigid skin weights.
// Positions and normals are baked through each part's matrix; a mirroring matrix flips the winding.
function bakeParts(parts) {
  const key = parts.map((p) => `${p.geo.uuid}:${p.bone}:${p.m.elements.map((e) => e.toFixed(4)).join(',')}`).join(';');
  if (mergedGeo.has(key)) return mergedGeo.get(key);
  let nv = 0, ni = 0;
  for (const p of parts) {
    nv += p.geo.attributes.position.count;
    ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count;
  }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
  const skinIndex = new Uint16Array(nv * 4), skinWeight = new Float32Array(nv * 4);
  const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const p of parts) {
    const g = p.geo, P = g.attributes.position, N = g.attributes.normal;
    _nrm.getNormalMatrix(p.m);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(p.m).toArray(pos, (vo + i) * 3);
      if (N) _v.fromBufferAttribute(N, i).applyMatrix3(_nrm).normalize().toArray(nor, (vo + i) * 3);
      skinIndex[(vo + i) * 4] = p.bone;
      skinWeight[(vo + i) * 4] = 1;
    }
    const n = g.index ? g.index.count : P.count;
    const at = g.index ? (j) => g.index.getX(j) : (j) => j;
    const flip = p.m.determinant() < 0;
    for (let j = 0; j < n; j += 3) {
      index[io++] = vo + at(j);
      index[io++] = vo + at(flip ? j + 2 : j + 1);
      index[io++] = vo + at(flip ? j + 1 : j + 2);
    }
    vo += P.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  mergedGeo.set(key, geo);
  return geo;
}
