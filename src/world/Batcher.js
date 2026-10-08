// Bakes many small static props into one vertex-coloured mesh per spatial chunk. One chunk is one
// draw call however many species it holds, and chunks are small enough for frustum culling (and
// distance culling of the small stuff) to skip most of the Vale on any given frame.
import * as THREE from '../lib/three.js';

const v = new THREE.Vector3();
const n = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const m3 = new THREE.Matrix3();

class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.wind = [];
    this.idx = [];
  }
}

export class ChunkBatcher {
  constructor(size = 90) {
    this.size = size;
    this.chunks = new Map();
    this.count = 0;
  }

  _chunk(x, z) {
    const cx = Math.floor(x / this.size), cz = Math.floor(z / this.size);
    const key = cx + ',' + cz;
    let c = this.chunks.get(key);
    if (!c) this.chunks.set(key, (c = new Chunk(cx, cz)));
    return c;
  }

  // parts: [{ geo, matrix, color, flex?, sway?(lx, ly, lz, wy), phaseK? }] in prop space (base at
  // origin). `inst` places the prop; the chunk is picked by its origin so a prop never straddles two
  // meshes. Sway is `flex` metres per metre above `baseY` (trees bend from the root) unless `sway`
  // is given; wy is the vertex's height above baseY. phaseK * wy delays the motion up or down a part.
  add(parts, inst, baseY, phase) {
    const ox = inst.elements[12], oz = inst.elements[14];
    const c = this._chunk(ox, oz);
    for (const p of parts) {
      m4.multiplyMatrices(inst, p.matrix);
      m3.getNormalMatrix(m4);
      const g = p.geo;
      const P = g.attributes.position, N = g.attributes.normal;
      const base = c.pos.length / 3;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i);
        const lx = v.x, ly = v.y, lz = v.z;
        v.applyMatrix4(m4);
        n.fromBufferAttribute(N, i).applyMatrix3(m3).normalize();
        c.pos.push(v.x, v.y, v.z);
        c.nor.push(n.x, n.y, n.z);
        c.col.push(p.color.r, p.color.g, p.color.b);
        const wy = v.y - baseY;
        const w = p.sway ? p.sway(lx, ly, lz, wy) : (p.flex ?? 0) * Math.max(0, wy);
        c.wind.push(w, phase + (p.phaseK ?? 0) * wy);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) c.idx.push(base + g.index.getX(i));
      else for (let i = 0; i < P.count; i++) c.idx.push(base + i);
    }
    this.count++;
  }

  // Returns [{ mesh, x, z, r }] (chunk centre and radius) and frees the staging arrays.
  build(material, { castShadow = false, receiveShadow = true, depthMaterial = null, pad = 1 } = {}) {
    const out = [];
    for (const c of this.chunks.values()) {
      if (!c.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(c.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(c.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(c.col, 3));
      g.setAttribute('aWind', new THREE.Float32BufferAttribute(c.wind, 2));
      const vcount = c.pos.length / 3;
      g.setIndex(vcount > 65535 ? new THREE.Uint32BufferAttribute(c.idx, 1) : new THREE.Uint16BufferAttribute(c.idx, 1));
      g.computeBoundingSphere();
      g.boundingSphere.radius += pad; // room for the sway
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      if (depthMaterial) mesh.customDepthMaterial = depthMaterial;
      mesh.matrixAutoUpdate = false;
      const s = g.boundingSphere;
      out.push({ mesh, x: s.center.x, z: s.center.z, r: s.radius });
    }
    this.chunks.clear();
    return out;
  }
}
