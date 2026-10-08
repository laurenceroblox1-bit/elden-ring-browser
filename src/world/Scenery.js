// Everything scattered over the Vale: forests, rocks, grass, flowers, lake plants, road dressing.
// It is all baked into per-chunk meshes (world/Batcher.js): "big" chunks (trees, rocks, logs, posts)
// cast shadows and are frustum culled; "small" chunks (grass, flowers, ferns, path stones) are also
// dropped past SMALL_FAR from the camera, where the fog and their size hide them anyway.
import * as THREE from '../lib/three.js';
import { fbm, mulberry32 } from '../core/math.js';
import { ZONES, ROADS, LAKE, SHRINES, NPCS, NOTICE, ENEMY_SPAWNS, PICKUPS, FIRES, KEEP_CLEAR } from '../data/world.js';
import * as P from '../models/props.js';
import { ChunkBatcher } from './Batcher.js';
import { windPatch, windDepthMaterial, ADDITIVE_FOG } from './Wind.js';

// Big chunks are coarse (fewer draw calls for what is seen far off); small chunks are fine-grained
// so distance culling trims them closely.
const BIG_CHUNK = 96;
const SMALL_CHUNK = 80;
const SMALL_FAR = 150; // metres from the camera to a small chunk's edge before it is dropped
const POIS = [...SHRINES, ...NPCS, NOTICE, ...ENEMY_SPAWNS, ...PICKUPS, ...FIRES];

const HALO_VERT = /* glsl */ `
attribute float aSize;
uniform float uScale;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
#include <common>
#include <fog_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * a * a * uOpacity, 1.0);
  #include <colorspace_fragment>
  ${ADDITIVE_FOG}
}`;

export class Scenery {
  constructor(world) {
    this.world = world;
    this.big = new ChunkBatcher(BIG_CHUNK);
    this.small = new ChunkBatcher(SMALL_CHUNK);
    this.rng = mulberry32(99);
    this.trees = [];
    this.broadTrees = []; // crowns that shed leaves (world/Ambient.js)
    this.flowerSpots = [];
    this.glowSpots = [...world.glowSpots]; // lantern flames, plus World's candles
    this.m = new THREE.Matrix4();

    this._trees();
    this._rocks();
    this._outcrops();
    this._undergrowth();
    this._logs();
    this._grass();
    this._flowers();
    this._lakeside();
    this._roads();
    this._stoneRing(-60, -110, 7.5);
    this._bakeStatics();
    const bell = world.chapelBell;
    if (bell) this._put(this.big, P.fallenBellParts(this.rng), bell.x, bell.z, { ry: bell.ry, sink: 0.2 });

    this._build();
  }

  // ---------- placement rules ----------

  clearOfPois(x, z, r) {
    for (const p of POIS) if (Math.hypot(x - p.x, z - p.z) < r) return false;
    return this.clearOfGear(x, z);
  }

  // Gear spots and the tower stump stay bare so pickups are never hidden in a bush.
  clearOfGear(x, z, pad = 0) {
    for (const k of KEEP_CLEAR) if (Math.hypot(x - k.x, z - k.z) < k.r + pad) return false;
    return true;
  }

  // Free ground for a large prop: off roads, out of zones, the lake and the arena.
  ok(x, z, pad = 0, maxSlope = 0.6) {
    const w = this.world;
    if (Math.hypot(x, z) > 290) return false;
    if (w.roadDistance(x, z) < 6 + pad) return false;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 3) return false;
    for (const zn of Object.values(ZONES)) if (Math.hypot(x - zn.x, z - zn.z) < zn.flat + 4 + pad) return false;
    if (w.inArena(x, z, 14)) return false;
    return w.slopeAt(x, z) < maxSlope;
  }

  forest(x, z) {
    return fbm(this.world.noise, x * 0.007 + 3, z * 0.007 - 5, 2);
  }

  meadow(x, z) {
    return fbm(this.world.noise2, x * 0.011 + 50, z * 0.011 - 20, 2);
  }

  _put(batch, parts, x, z, o = {}) {
    const y = o.y ?? this.world.getHeight(x, z) - (o.sink ?? 0);
    const s = o.s ?? 1;
    this.m.copy(P.xform(x, y, z, o.rx ?? 0, o.ry ?? this.rng() * 6.28, o.rz ?? 0, o.sx ?? s, o.sy ?? s, o.sz ?? s));
    batch.add(parts, this.m, y, x * 0.12 + z * 0.09 + this.rng() * 0.6);
  }

  _scatter(n, tries, radius, accept) {
    const rng = this.rng;
    let placed = 0;
    for (let i = 0; i < tries && placed < n; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * radius;
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (this.clearOfGear(x, z, 1.5) && accept(x, z)) placed++;
    }
  }

  // ---------- content ----------

  _trees() {
    const rng = this.rng, w = this.world;
    this._scatter(950, 9000, 290, (x, z) => {
      if (this.forest(x, z) < -0.05 && rng() > 0.12) return false;
      if (!this.ok(x, z, 0)) return false;
      const moorish = x < -140 && z < -40;
      const roll = rng();
      const type = moorish ? (roll < 0.5 ? 'dead' : 'pine') : roll < 0.52 ? 'pine' : roll < 0.9 ? 'broad' : 'dead';
      const s = 0.8 + rng() * 0.7;
      const parts = type === 'pine' ? P.pineParts(rng) : type === 'broad' ? P.broadParts(rng) : P.deadParts(rng);
      const y = w.getHeight(x, z);
      this._put(this.big, parts, x, z, { s, y });
      w.addCircle(x, z, 0.35 * s);
      const t = { x, z, y, s, type };
      this.trees.push(t);
      if (type === 'broad') this.broadTrees.push(t);
      return true;
    });
  }

  _rocks() {
    const rng = this.rng, w = this.world;
    this._scatter(320, 1600, 300, (x, z) => {
      if (!this.ok(x, z, -3)) return false;
      const s = 0.4 + Math.pow(rng(), 2.5) * 2.6;
      // Rocks big enough to block are kept off the road shoulders.
      if (s > 0.9 && (w.roadDistance(x, z) < 6 || !this.clearOfPois(x, z, 3))) return false;
      const y = w.getHeight(x, z) + s * (0.2 - w.slopeAt(x, z) * 0.6);
      this._put(this.big, P.rockParts(rng), x, z, { y, rx: rng(), rz: rng(), sx: s * (1 + rng() * 0.6), sy: s * (0.6 + rng() * 0.4), sz: s * (1 + rng() * 0.5) });
      if (s > 0.9) w.addCircle(x, z, s * 0.95);
      return true;
    });
  }

  // Craggy clusters on the steep flanks, where the old scatter never put anything.
  _outcrops() {
    const rng = this.rng, w = this.world;
    this._scatter(48, 4000, 305, (x, z) => {
      const sl = w.slopeAt(x, z);
      if (sl < 0.55 || sl > 1.2 || Math.hypot(x, z) < 90) return false;
      if (w.roadDistance(x, z) < 16 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 8 || w.inArena(x, z, 20)) return false;
      for (const zn of Object.values(ZONES)) if (Math.hypot(x - zn.x, z - zn.z) < zn.flat + 10) return false;
      if (!this.clearOfPois(x, z, 12)) return false;
      const n = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const a = rng() * 6.28, d = i ? 1.5 + rng() * 2.5 : 0;
        const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
        const s = (i ? 1.2 : 2.2) + rng() * 1.6;
        // Sunk by the slope: on a steep face the downhill side would otherwise float.
        const y = w.getHeight(px, pz) - s * (0.15 + w.slopeAt(px, pz) * 0.5);
        this._put(this.big, P.rockParts(rng, rng() < 0.5 ? 0x77736a : 0x6a665e), px, pz, { y, rx: rng() * 0.6, rz: rng() * 0.6, sx: s * (0.9 + rng() * 0.4), sy: s * (0.8 + rng() * 0.6), sz: s * (0.9 + rng() * 0.4) });
        w.addCircle(px, pz, s * 0.85);
      }
      return true;
    });
  }

  // Bushes along forest edges, ferns and mushrooms under the trees.
  _undergrowth() {
    const rng = this.rng, w = this.world;
    this._scatter(480, 6000, 285, (x, z) => {
      const f = this.forest(x, z);
      if (Math.abs(f + 0.05) > 0.14 && rng() > 0.15) return false;
      if (!this.ok(x, z, -2, 0.5)) return false;
      this._put(this.big, P.bushParts(rng), x, z, { s: 0.8 + rng() * 0.6, sink: 0.15 });
      return true;
    });
    for (const t of this.trees) {
      if (t.type !== 'dead' && rng() < 0.55) {
        const a = rng() * 6.28, d = 1.4 + rng() * 2.2;
        const x = t.x + Math.sin(a) * d, z = t.z + Math.cos(a) * d;
        if (w.roadDistance(x, z) > 4.5 && w.slopeAt(x, z) < 0.6 && this.clearOfGear(x, z)) this._put(this.small, P.fernParts(rng), x, z, { s: 0.7 + rng() * 0.6, sink: 0.05 });
      }
      if (rng() < 0.2) {
        const a = rng() * 6.28, d = 0.6 + rng() * 0.7;
        const x = t.x + Math.sin(a) * d, z = t.z + Math.cos(a) * d;
        if (w.roadDistance(x, z) > 4 && this.clearOfGear(x, z)) this._put(this.small, P.mushroomParts(rng), x, z, { s: 0.9 + rng() * 0.6, sink: 0.02 });
      }
    }
  }

  _logs() {
    const rng = this.rng, w = this.world;
    this._scatter(30, 3000, 280, (x, z) => {
      if (this.forest(x, z) < 0.05 || !this.ok(x, z, 3, 0.35) || !this.clearOfPois(x, z, 8)) return false;
      const len = 2.6 + rng() * 2.2, ry = rng() * 6.28;
      this._put(this.big, P.logParts(rng, len), x, z, { ry, sink: 0.12 });
      w.addBox(x, z, len / 2, 0.4, ry);
      return true;
    });
  }

  _grass() {
    const rng = this.rng, w = this.world;
    this._scatter(14000, 40000, 280, (x, z) => {
      if (w.roadDistance(x, z) < 3.5 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 0.95) return false;
      if (w.inArena(x, z, 4) || w.slopeAt(x, z) > 0.5) return false;
      // Thinner in deep forest, thicker in the meadows.
      if (this.forest(x, z) > 0.2 && rng() < 0.5) return false;
      const s = 0.8 + rng() * 0.8;
      this._put(this.small, P.tuftParts(rng), x, z, { s, sy: s * (0.8 + rng() * 0.6), sink: 0.05, rx: (rng() - 0.5) * 0.3, rz: (rng() - 0.5) * 0.3 });
      return true;
    });
  }

  _flowers() {
    const rng = this.rng, w = this.world;
    this._scatter(950, 20000, 275, (x, z) => {
      if (this.meadow(x, z) < 0.12 || this.forest(x, z) > 0.05) return false;
      if (w.roadDistance(x, z) < 3.2 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r) return false;
      if (w.inArena(x, z, 10) || w.slopeAt(x, z) > 0.45 || x < -150 && z < -60) return false;
      this._put(this.small, P.flowerParts(rng), x, z, { s: 0.9 + rng() * 0.4, sink: 0.03 });
      this.flowerSpots.push({ x, z, y: w.getHeight(x, z) });
      return true;
    });
  }

  // Reeds on the wet margin, lily pads on the shallows.
  _lakeside() {
    const rng = this.rng, w = this.world;
    const wl = w.waterLevel;
    let reeds = 0, lilies = 0;
    for (let i = 0; i < 5000 && (reeds < 170 || lilies < 120); i++) {
      const a = rng() * Math.PI * 2, d = LAKE.r * (0.55 + rng() * 0.55);
      const x = LAKE.x + Math.sin(a) * d, z = LAKE.z + Math.cos(a) * d;
      const depth = wl - w.getHeight(x, z);
      if (reeds < 170 && depth > -0.5 && depth < 0.8 && this.clearOfPois(x, z, 3.5)) {
        this._put(this.small, P.reedParts(rng), x, z, { s: 0.8 + rng() * 0.5, sink: 0.1 });
        reeds++;
      } else if (lilies < 120 && depth > 0.7 && depth < 2.6) {
        this._put(this.small, P.lilyParts(rng), x, z, { y: wl + 0.07, ry: rng() * 6.28 });
        lilies++;
      }
    }
  }

  // Worn stones along the road shoulders, cairns at the junctions, lanterns and banners on the
  // main road north. Nothing that collides comes within 4.5 m of a road's centre line.
  _roads() {
    const rng = this.rng, w = this.world;
    for (const road of ROADS) {
      for (let i = 0; i < road.length - 1; i++) {
        const [ax, az] = road[i], [bx, bz] = road[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len, nz = (bx - ax) / len;
        for (let d = 0; d < len; d += 1.8) {
          const t = d / len;
          const cx = ax + (bx - ax) * t, cz = az + (bz - az) * t;
          if (w.inArena(cx, cz, 6) || w.isWater(cx, cz)) continue;
          for (const side of [-1, 1]) {
            if (rng() > 0.22) continue;
            const off = side * (2.6 + rng() * 1.4);
            this._put(this.small, P.pathStoneParts(rng), cx + nx * off, cz + nz * off, {});
          }
          if (rng() < 0.05) this._put(this.small, P.pathStoneParts(rng), cx + nx * (rng() - 0.5) * 2.4, cz + nz * (rng() - 0.5) * 2.4, { sink: 0.03 });
        }
      }
    }

    for (const [x, z] of [[11, 52], [-3, 123], [14, 178], [-62, 152], [-20, 108]]) {
      if (w.roadDistance(x, z) < 5 || !this.clearOfPois(x, z, 4)) continue;
      this._put(this.big, P.cairnParts(rng), x, z, { s: 1 + rng() * 0.3, sink: 0.1 });
      w.addCircle(x, z, 0.6);
    }

    // Lanterns every ~38 m along the main road, alternating sides, facing the road.
    const main = ROADS[0];
    let along = 18, side = 1;
    for (let i = 0; i < main.length - 1; i++) {
      const [ax, az] = main[i], [bx, bz] = main[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (; along < len; along += 38) {
        const t = along / len, s = side;
        const x = ax + (bx - ax) * t + nx * s * 4.8, z = az + (bz - az) * t + nz * s * 4.8;
        side = -side;
        if (z > 196 || z < -214 || !this.clearOfPois(x, z, 6) || w.roadDistance(x, z) < 4.5) continue;
        // The arm hangs the lantern over the road: local +X maps to world (cos ry, -sin ry).
        this._lantern(x, z, Math.atan2(nz * s, -nx * s));
      }
      along -= len;
    }

    // Banners: the crossroads to the ruins and the last stretch before the Gatehouse.
    // The cloth faces along the road so travellers see it; the crossbar points away from the road.
    const H = Math.PI / 2;
    for (const [x, z, hex, ry] of [[10, 51, 0x7a3a2a, 0], [-3, 39, 0x7a3a2a, Math.PI], [62, 47, 0x8a6a2e, -H], [12, -168, 0x5a3a4a, 0], [-1, -170, 0x5a3a4a, Math.PI], [14, -140, 0x5a3a4a, 0]]) {
      if (w.roadDistance(x, z) < 4.5 || !this.clearOfPois(x, z, 4)) continue;
      this._put(this.big, P.bannerParts(rng, hex), x, z, { ry: ry + (rng() - 0.5) * 0.3, sink: 0.1 });
      w.addCircle(x, z, 0.25);
    }
  }

  _lantern(x, z, yaw) {
    const y = this.world.getHeight(x, z);
    this._put(this.big, P.lanternPostParts(this.rng), x, z, { y, ry: yaw });
    const c = P.LANTERN_CORE;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    this.glowSpots.push({ x: x + c.x * cos + c.z * sin, y: y + c.y, z: z - c.x * sin + c.z * cos, size: 1 });
    this.world.addCircle(x, z, 0.22);
  }

  // A ring of leaning standing stones on a hilltop, with a flat offering stone at its heart.
  _stoneRing(cx, cz, r) {
    const rng = this.rng, w = this.world;
    const n = 9;
    for (let i = 0; i < n; i++) {
      if (i === 4) continue; // one has fallen
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      this._put(this.big, P.standingStoneParts(rng, 2.2 + rng() * 1.6), x, z, { ry: a + Math.PI / 2 });
      w.addCircle(x, z, 0.6);
    }
    const a = (4 / n) * Math.PI * 2;
    this._put(this.big, P.standingStoneParts(rng, 2.6), cx + Math.sin(a) * (r + 1.2), cz + Math.cos(a) * (r + 1.2), { ry: a, rx: Math.PI / 2 - 0.08, sink: 0.1, y: w.getHeight(cx + Math.sin(a) * r, cz + Math.cos(a) * r) + 0.35 });
    this._put(this.big, P.rockParts(rng, 0x8a8478), cx, cz, { sx: 1.4, sy: 0.35, sz: 1.0, ry: 0.4 });
    w.addCircle(cx, cz, 1.1);
  }

  // World's static set pieces (graves, pillars, fences, the castle...): plain matte meshes join the
  // big chunks, warm emissive windows join the lantern cores, and anything else (metal, glass,
  // unfogged, animated) stays a mesh of its own.
  _bakeStatics() {
    const inv = new THREE.Matrix4();
    this.hotParts = [];
    for (const root of this.world.statics) {
      root.updateMatrixWorld(true);
      inv.copy(root.matrixWorld).invert();
      const baked = [];
      root.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
        const m = o.material;
        if (!m.isMeshStandardMaterial || m.transparent || m.fog === false || m.metalness > 0.3 || m.map) return;
        const hot = m.emissiveIntensity > 0 && m.emissive.r + m.emissive.g + m.emissive.b > 0.05;
        const part = { geo: o.geometry, matrix: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), color: m.color.clone() };
        if (hot) this.hotParts.push({ ...part, matrix: o.matrixWorld.clone() });
        else baked.push(part);
        o.userData.baked = true;
      });
      if (baked.length) {
        const e = root.matrixWorld.elements;
        this.big.add(baked, root.matrixWorld, e[13], 0);
      }
      const gone = [];
      root.traverse((o) => o.userData.baked && gone.push(o));
      for (const o of gone) o.removeFromParent();
      // Nothing left but empty groups: drop the root too.
      let left = 0;
      root.traverse((o) => { if (o.isMesh || o.isSprite || o.isPoints || o.isLight) left++; });
      if (!left) root.removeFromParent();
    }
  }

  // ---------- meshes ----------

  _build() {
    const scene = this.world.scene;
    this.bigMat = windPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }));
    this.smallMat = windPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { fadeNear: SMALL_FAR - 45, fadeFar: SMALL_FAR - 12 });
    this.bigChunks = this.big.build(this.bigMat, { castShadow: true, receiveShadow: true, depthMaterial: windDepthMaterial(), pad: 1 });
    this.smallChunks = this.small.build(this.smallMat, { castShadow: false, receiveShadow: true, pad: 0.6 });
    for (const c of [...this.bigChunks, ...this.smallChunks]) scene.add(c.mesh);

    // Lantern flames: one emissive mesh for every core, one point cloud for every halo.
    const cores = new ChunkBatcher(100000);
    const core = [{ geo: P.sceneryGeometries().octa, matrix: new THREE.Matrix4(), color: new THREE.Color(0xffd59a) }];
    for (const g of this.glowSpots) {
      this.m.makeScale(0.11 * g.size, 0.15 * g.size, 0.11 * g.size).setPosition(g.x, g.y, g.z);
      cores.add(core, this.m, g.y, 0);
    }
    if (this.hotParts.length) cores.add(this.hotParts, new THREE.Matrix4(), 0, 0);
    this.coreMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffa040, emissiveIntensity: 1.5, flatShading: true });
    this.coreMeshes = cores.build(this.coreMat, { receiveShadow: false });
    for (const c of this.coreMeshes) scene.add(c.mesh);

    const pos = new Float32Array(this.glowSpots.length * 3);
    const size = new Float32Array(this.glowSpots.length);
    this.glowSpots.forEach((g, i) => {
      pos.set([g.x, g.y, g.z], i * 3);
      size[i] = 2.2 * g.size;
    });
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    hg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.haloMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 500 }, uColor: { value: new THREE.Color(0xffa850) }, uOpacity: { value: 0.4 } }]),
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    });
    this.halos = new THREE.Points(hg, this.haloMat);
    this.halos.renderOrder = 4;
    if (this.glowSpots.length) scene.add(this.halos);
  }

  // Drops small chunks that are out of range; lantern glow follows the night (0 day .. 1 night).
  update(camPos, night, viewportScale) {
    const far = SMALL_FAR;
    for (const c of this.smallChunks) {
      const d = Math.hypot(c.x - camPos.x, c.z - camPos.z) - c.r;
      c.mesh.visible = d < far;
    }
    this.coreMat.emissiveIntensity = 1.2 + night * 2.4;
    this.haloMat.uniforms.uOpacity.value = 0.22 + night * 0.65;
    if (viewportScale) this.haloMat.uniforms.uScale.value = viewportScale;
  }
}
