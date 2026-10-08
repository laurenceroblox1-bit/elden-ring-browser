// The Vale: heightmap terrain, roads, lake, vegetation, set pieces and 2D colliders.
import * as THREE from '../lib/three.js';
import { createNoise2D, fbm, smoothstep, clamp, lerp, mulberry32, distToSegment } from '../core/math.js';
import { WORLD, ZONES, ROADS, LAKE, ARENA, SHRINES, NOTICE, FIRES } from '../data/world.js';
import * as P from '../models/props.js';
import { mat, mesh, box, glowSprite } from '../models/kit.js';

const SIZE = WORLD.size;
const SEG = WORLD.segments;
const CELL = SIZE / SEG;
const HALF = SIZE / 2;
const GRID = 16; // collider hash cell, metres

const C = (hex) => new THREE.Color(hex);
const COL = {
  gold: C(0xa38f48), olive: C(0x6f7838), deep: C(0x4f5a2c), dry: C(0x9c8058),
  dirt: C(0x7d6649), road: C(0x9a8460), rock: C(0x77736a), rockDark: C(0x55524b),
  snow: C(0xdcd9d2), ash: C(0x6e6962), mud: C(0x4d4234), moor: C(0x6b5f4a),
};

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.noise = createNoise2D(7);
    this.noise2 = createNoise2D(31);
    this.circles = [];
    this.boxes = [];
    this.dynamic = [];
    this.grid = new Map();
    this.fires = [];
    this.shrines = new Map();
    this.blocks = [];

    this.roadSegs = [];
    for (const road of ROADS) for (let i = 0; i < road.length - 1; i++) this.roadSegs.push([...road[i], ...road[i + 1]]);

    this.flatZones = Object.values(ZONES).map((z) => ({ x: z.x, z: z.z, r: z.flat, h: this._raw(z.x, z.z).big }));
    this.waterLevel = this._raw(LAKE.x, LAKE.z).big - 2;

    this._buildHeights();
    this._buildTerrain();
    this._buildWater();
    this._buildStructures();
    this._buildVegetation();
    this._buildBlocks();
    this._indexColliders();
  }

  // ---------- height field ----------

  _raw(x, z) {
    let big = fbm(this.noise, x * 0.0032, z * 0.0032, 4) * 24;
    const r = Math.hypot(x, z);
    big += smoothstep(265, 410, r) * (80 + fbm(this.noise2, x * 0.008, z * 0.008, 3) * 50);
    const detail = fbm(this.noise2, x * 0.02 + 40, z * 0.02 - 17, 3) * 3.2;
    return { big, h: big + detail };
  }

  roadDistance(x, z) {
    let d = Infinity;
    for (const s of this.roadSegs) {
      const v = distToSegment(x, z, s[0], s[1], s[2], s[3]);
      if (v < d) d = v;
    }
    return d;
  }

  _heightAt(x, z) {
    const { big, h: h0 } = this._raw(x, z);
    let h = h0;
    const rd = this.roadDistance(x, z);
    h = lerp(h, big, (1 - smoothstep(2.5, 9, rd)) * 0.92);
    const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
    h = lerp(h, this.waterLevel - 3.5, 1 - smoothstep(LAKE.r * 0.4, LAKE.r, ld));
    for (const zn of this.flatZones) {
      const d = Math.hypot(x - zn.x, z - zn.z);
      const w = 1 - smoothstep(zn.r, zn.r + 14, d);
      if (w > 0) h = lerp(h, zn.h, w);
    }
    return h;
  }

  _buildHeights() {
    const n = SEG + 1;
    this.heights = new Float32Array(n * n);
    this.roadW = new Float32Array(n * n);
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
        this.heights[iz * n + ix] = this._heightAt(x, z);
        this.roadW[iz * n + ix] = 1 - smoothstep(2, 5.5, this.roadDistance(x, z));
      }
    }
  }

  // Exact height of the rendered triangle under (x, z).
  getHeight(x, z) {
    const n = SEG + 1;
    const fx = clamp((x + HALF) / CELL, 0, SEG - 0.001);
    const fz = clamp((z + HALF) / CELL, 0, SEG - 0.001);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const u = fx - ix, v = fz - iz;
    const H = this.heights;
    const ha = H[iz * n + ix], hb = H[(iz + 1) * n + ix], hd = H[iz * n + ix + 1], hc = H[(iz + 1) * n + ix + 1];
    if (u + v <= 1) return ha + (hd - ha) * u + (hb - ha) * v;
    return hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
  }

  slopeAt(x, z) {
    const e = 1.5;
    const dx = (this.getHeight(x + e, z) - this.getHeight(x - e, z)) / (2 * e);
    const dz = (this.getHeight(x, z + e) - this.getHeight(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }

  inArena(x, z, pad = 0) {
    return Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + pad;
  }

  // ---------- terrain mesh ----------

  _buildTerrain() {
    const n = SEG + 1;
    const pos = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const c = new THREE.Color();
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
        const h = this.heights[i];
        pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;

        const hl = this.heights[iz * n + Math.max(0, ix - 1)], hr = this.heights[iz * n + Math.min(SEG, ix + 1)];
        const hu = this.heights[Math.max(0, iz - 1) * n + ix], hdn = this.heights[Math.min(SEG, iz + 1) * n + ix];
        const slope = Math.hypot(hr - hl, hdn - hu) / (2 * CELL);

        const t = fbm(this.noise2, x * 0.012, z * 0.012, 2) * 0.5 + 0.5;
        c.copy(COL.olive).lerp(COL.gold, smoothstep(0.35, 0.75, t));
        c.lerp(COL.deep, smoothstep(0.55, 0.9, fbm(this.noise, x * 0.03 + 9, z * 0.03, 2) * 0.5 + 0.5) * 0.6);
        if (x < -150 && z < -60) c.lerp(COL.moor, smoothstep(-150, -230, x) * 0.7);
        c.lerp(COL.dry, smoothstep(0.6, 0.95, (this.noise(x * 0.05, z * 0.05) + 1) / 2) * 0.35);
        c.lerp(COL.road, this.roadW[i] * 0.9);
        c.lerp(COL.rock, smoothstep(0.45, 0.8, slope));
        c.lerp(COL.rockDark, smoothstep(0.9, 1.3, slope) * 0.6);
        const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
        c.lerp(COL.mud, 1 - smoothstep(LAKE.r * 0.85, LAKE.r * 1.05, ld));
        const ad = Math.hypot(x - ARENA.x, z - ARENA.z);
        c.lerp(COL.ash, 1 - smoothstep(ARENA.r - 2, ARENA.r + 12, ad));
        c.lerp(COL.snow, smoothstep(78, 96, h + this.noise(x * 0.04, z * 0.04) * 6));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
    }
    const idx = new Uint32Array(SEG * SEG * 6);
    let k = 0;
    for (let iz = 0; iz < SEG; iz++) {
      for (let ix = 0; ix < SEG; ix++) {
        const a = iz * n + ix, b = (iz + 1) * n + ix, d = iz * n + ix + 1, cc = (iz + 1) * n + ix + 1;
        idx[k++] = a; idx[k++] = b; idx[k++] = d;
        idx[k++] = b; idx[k++] = cc; idx[k++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    this.terrain = terrain;
  }

  _buildWater() {
    const geo = new THREE.CircleGeometry(LAKE.r * 1.05, 48);
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x41606b, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.86,
    }));
    water.position.set(LAKE.x, this.waterLevel, LAKE.z);
    water.receiveShadow = true;
    this.scene.add(water);
  }

  isWater(x, z) {
    return Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r && this.getHeight(x, z) < this.waterLevel - 0.3;
  }

  // ---------- placement helpers ----------

  place(obj, x, z, yaw = 0, sink = 0) {
    obj.position.set(x, this.getHeight(x, z) - sink, z);
    obj.rotation.y = yaw;
    this.scene.add(obj);
    return obj;
  }

  // Stone blocks are batched into one InstancedMesh; `collide` adds an oriented box collider.
  block(x, z, sx, sy, sz, ry = 0, o = {}) {
    const y = o.y ?? this.getHeight(x, z) - 0.3;
    this.blocks.push({ x, y: y + sy / 2, z, sx, sy, sz, ry, color: o.color ?? 0x8a8478 });
    if (o.collide !== false) this.addBox(x, z, sx / 2, sz / 2, ry);
  }

  addCircle(x, z, r) {
    const c = { x, z, r };
    this.circles.push(c);
    return c;
  }

  addBox(x, z, hx, hz, rot = 0, dynamic = false) {
    const b = { x, z, hx, hz, c: Math.cos(rot), s: Math.sin(rot), enabled: true };
    (dynamic ? this.dynamic : this.boxes).push(b);
    return b;
  }

  // ---------- set pieces ----------

  _buildStructures() {
    // Shrines.
    for (const s of SHRINES) {
      const shrine = P.buildShrine();
      this.place(shrine.group, s.x, s.z, 0, 0.1);
      this.addCircle(s.x, s.z, 1.3);
      const light = new THREE.PointLight(0xffb060, 0, 16, 2);
      light.position.set(s.x + 0.38, this.getHeight(s.x, s.z) + 2.1, s.z);
      this.scene.add(light);
      this.shrines.set(s.id, { ...s, ...shrine, light, lit: false });
    }

    const notice = P.buildNoticeBoard();
    this.place(notice, NOTICE.x, NOTICE.z, NOTICE.yaw);
    this.addBox(NOTICE.x, NOTICE.z, 0.85, 0.2, NOTICE.yaw);

    // First Light: a ring of broken pillars around the shrine.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = ZONES.firstlight.x + Math.sin(a) * 11, z = ZONES.firstlight.z + Math.cos(a) * 11;
      if (Math.abs(x) < 6 && z < ZONES.firstlight.z) continue; // keep the road open
      this.place(P.buildPillar(2.5 + (i % 3) * 1.4, i % 2 === 0), x, z, a);
      this.addCircle(x, z, 0.6);
    }

    // Brannoc's camp.
    const camp = ZONES.camp;
    this.place(P.buildTent(), camp.x - 6, camp.z + 2, 0.8);
    this.addCircle(camp.x - 6, camp.z + 2, 2.0);
    for (const [dx, dz, ry, len] of [[6, -5, 0.3, 8], [9, 1, 1.7, 6], [-2, -8, 0.1, 6]]) {
      this.place(P.buildFence(len), camp.x + dx, camp.z + dz, ry);
      this.addBox(camp.x + dx, camp.z + dz, len / 2, 0.15, ry);
    }

    // Watch Ruins: broken curtain walls and a tower stump.
    const ru = ZONES.ruins;
    const wall = (x, z, len, h, ry) => {
      const pieces = Math.ceil(len / 3);
      for (let i = 0; i < pieces; i++) {
        const t = (i + 0.5) / pieces - 0.5;
        const px = x + Math.cos(ry) * t * len, pz = z - Math.sin(ry) * t * len;
        const ph = h * (0.45 + 0.55 * Math.abs(Math.sin(i * 2.3 + x)));
        this.block(px, pz, len / pieces + 0.1, ph, 1.2, ry, { color: 0x847e72 });
      }
    };
    wall(ru.x - 16, ru.z - 4, 18, 4.5, Math.PI / 2);
    wall(ru.x - 4, ru.z - 18, 22, 5, 0);
    wall(ru.x + 18, ru.z + 4, 14, 3.5, Math.PI / 2);
    wall(ru.x + 2, ru.z + 20, 10, 3, 0.1);
    const tx = ru.x + 14, tz = ru.z - 14;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const h = 9 - (i % 4) * 2.2 - (i > 6 ? 3 : 0);
      this.block(tx + Math.sin(a) * 4.2, tz + Math.cos(a) * 4.2, 2.4, h, 1.2, a, { color: 0x7c766b });
    }
    for (let i = 0; i < 14; i++) {
      const rng = mulberry32(100 + i);
      const x = ru.x + (rng() - 0.5) * 40, z = ru.z + (rng() - 0.5) * 40;
      this.block(x, z, 0.8 + rng() * 1.2, 0.5 + rng() * 0.8, 0.8 + rng(), rng() * 3, { color: 0x6e695f, collide: false });
    }

    // Mirelake shore: Ilse's bedroll and a cairn.
    const lk = ZONES.lake;
    this.scene.add(mesh(box(0.9, 0.12, 2), mat(0x6e5a44), { x: lk.x + 3, y: this.getHeight(lk.x + 3, lk.z + 1) + 0.06, z: lk.z + 1, ry: 0.4 }));
    for (let i = 0; i < 4; i++) this.block(lk.x - 4, lk.z - 3, 0.8 - i * 0.15, 0.35, 0.8 - i * 0.15, i, { y: this.getHeight(lk.x - 4, lk.z - 3) + i * 0.3 - 0.1, collide: i === 0 });

    // Western Moor: the wrecked cart and its dead horse-less traces.
    const mo = ZONES.moor;
    this.place(P.buildCart(), mo.x, mo.z, 0.7);
    this.addBox(mo.x, mo.z, 1.0, 1.5, 0.7);

    // Road dressing: pillars and graves on the way north.
    const rng = mulberry32(5);
    for (const [x, z] of [[-6, 120], [14, 60], [36, -20], [-2, -90], [26, -100], [-8, -160], [14, -165]]) {
      this.place(P.buildPillar(2 + rng() * 4, rng() < 0.6), x, z, rng() * 3);
      this.addCircle(x, z, 0.6);
    }
    for (let i = 0; i < 40; i++) {
      const x = -30 + rng() * 60, z = -170 - rng() * 40;
      if (Math.abs(x) < 7 || this.roadDistance(x, z) < 5) continue;
      if (Math.hypot(x - ZONES.gatehouse.x, z - ZONES.gatehouse.z) < 6) continue;
      this.place(P.buildGrave(rng), x, z, rng() * 0.6 - 0.3, 0.05);
    }
    for (const x of [-12, 12]) {
      this.place(P.buildStatue(), x, -212, x < 0 ? 0.3 : -0.3);
      this.addCircle(x, -212, 1.0);
    }

    this._buildArena();
    this._buildCastle();

    // The Hollow Bell on the eastern peaks.
    const spire = P.buildSpire();
    spire.group.position.set(255, this.getHeight(255, -300) - 10, -300);
    this.scene.add(spire.group);

    // Fires.
    for (const f of FIRES) {
      const fire = f.light ? P.buildCampfire() : P.buildBrazier();
      this.place(fire.group, f.x, f.z);
      this.addCircle(f.x, f.z, f.light ? 0.7 : 0.4);
      let light = null;
      if (f.light) {
        light = new THREE.PointLight(0xff8a3a, 28, 14, 2);
        light.position.set(f.x, this.getHeight(f.x, f.z) + 1.2, f.z);
        this.scene.add(light);
      }
      this.fires.push({ ...f, ...fire, lightObj: light, y: this.getHeight(f.x, f.z), seed: Math.random() * 10 });
    }
  }

  _buildArena() {
    const A = ARENA;
    const segs = A.segments;
    const segLen = (2 * Math.PI * A.r) / segs + 0.4;
    for (let i = 0; i < segs; i++) {
      if (i === 0 || i === segs / 2) continue; // south entrance, north gate
      const a = (i / segs) * Math.PI * 2;
      const x = A.x + Math.sin(a) * A.r, z = A.z + Math.cos(a) * A.r;
      const broken = i % 7 === 3;
      const h = broken ? 3.2 : 7 + Math.sin(i * 1.7) * 0.8;
      const y = this.getHeight(x, z) - 0.4;
      this.block(x, z, segLen, h, 2.4, a, { y, color: 0x7a756c });
      if (!broken && i % 2 === 0) this.block(x, z, 1.6, 1.0, 2.6, a, { y: y + h, color: 0x6c675f, collide: false });
    }
    // Entrance pillars and the mist across the opening.
    const ex = A.x, ez = A.z + A.r;
    for (const s of [-1, 1]) {
      this.block(ex + s * 3.6, ez, 1.8, 9.5, 2.8, 0, { color: 0x6c675f });
    }
    this.block(ex, ez, 9, 1.4, 2.8, 0, { y: this.getHeight(ex, ez) + 8.6, color: 0x6c675f, collide: false });
    this.fogGate = this._buildFogGate(ex, ez);

    // North gate: frame and hinged doors.
    const nx = A.x, nz = A.z - A.r;
    for (const s of [-1, 1]) this.block(nx + s * 4, nz, 2.2, 11, 3, 0, { color: 0x6c675f });
    this.block(nx, nz, 10.5, 2, 3, 0, { y: this.getHeight(nx, nz) + 9.5, color: 0x6c675f, collide: false });
    const doors = P.buildGateDoors(6, 8.5);
    doors.group.position.set(nx, this.getHeight(nx, nz) - 0.1, nz);
    this.scene.add(doors.group);
    this.gateDoors = { ...doors, collider: this.addBox(nx, nz, 3.2, 0.5, 0, true), open: 0, opening: false };

    // Arena floor dressing: broken flagstones and two braziers inside.
    const rng = mulberry32(77);
    for (let i = 0; i < 46; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (A.r - 3);
      const x = A.x + Math.sin(a) * d, z = A.z + Math.cos(a) * d;
      this.block(x, z, 1.6 + rng() * 1.6, 0.2, 1.6 + rng() * 1.6, rng() * 3, { y: this.getHeight(x, z) - 0.12, color: 0x7d786f, collide: false });
    }
  }

  _buildFogGate(x, z) {
    const uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xf2e2b8) }, uOpacity: { value: 1 } };
    const m = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
        void main(){
          vec2 p = vUv * vec2(3.0, 4.0);
          float n = noise(p + vec2(uTime*0.12, -uTime*0.45)) * 0.6 + noise(p*2.3 - vec2(uTime*0.3, uTime*0.6)) * 0.4;
          float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(1.0, 0.8, vUv.y) * smoothstep(0.0, 0.06, vUv.y);
          float a = (0.28 + n * 0.6) * edge * uOpacity;
          gl_FragColor = vec4(uColor * (0.75 + n * 0.6), a);
          #include <colorspace_fragment>
        }`,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 8), m);
    plane.position.set(x, this.getHeight(x, z) + 4, z);
    this.scene.add(plane);
    const glow = glowSprite(0xffe2a0, 9, 0.25);
    glow.position.set(x, this.getHeight(x, z) + 3, z + 0.5);
    this.scene.add(glow);
    return { mesh: plane, glow, uniforms, collider: this.addBox(x, z, 2.9, 0.6, 0, true), x, z, active: true };
  }

  setFogGate(active) {
    const f = this.fogGate;
    f.active = active;
    f.mesh.visible = active;
    f.glow.visible = active;
  }

  _buildCastle() {
    const c = ZONES.castle;
    const castle = P.buildCastle();
    castle.position.set(c.x, this.getHeight(c.x, c.z) - 0.5, c.z - 8);
    this.scene.add(castle);
    this.addBox(c.x, c.z - 8, 33, 3.5, 0);
    this.addCircle(c.x - 30, c.z - 8, 6);
    this.addCircle(c.x + 30, c.z - 8, 6);
    this.castleDoor = { x: c.x, z: c.z - 4 };
  }

  // ---------- vegetation ----------

  _buildVegetation() {
    const G = P.treeGeometries();
    const rng = mulberry32(99);
    const ok = (x, z, pad) => {
      if (Math.hypot(x, z) > 290) return false;
      if (this.roadDistance(x, z) < 6 + pad) return false;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 3) return false;
      for (const zn of Object.values(ZONES)) if (Math.hypot(x - zn.x, z - zn.z) < zn.flat + 4 + pad) return false;
      if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 14) return false;
      return this.slopeAt(x, z) < 0.6;
    };

    const trees = [];
    for (let i = 0; i < 9000 && trees.length < 950; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 290;
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      const forest = fbm(this.noise, x * 0.007 + 3, z * 0.007 - 5, 2);
      if (forest < -0.05 && rng() > 0.12) continue;
      if (!ok(x, z, 0)) continue;
      const moorish = x < -140 && z < -40;
      const roll = rng();
      const type = moorish ? (roll < 0.5 ? 'dead' : 'pine') : roll < 0.52 ? 'pine' : roll < 0.9 ? 'broad' : 'dead';
      trees.push({ x, z, type, s: 0.8 + rng() * 0.7, ry: rng() * 6.28, y: this.getHeight(x, z) });
    }

    const count = (t) => trees.filter((tr) => tr.type === t).length;
    const barkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.8 });
    const trunks = new THREE.InstancedMesh(G.trunk, barkMat, trees.length);
    const pinesA = new THREE.InstancedMesh(G.pine, leafMat, count('pine'));
    const pinesB = new THREE.InstancedMesh(G.pine, leafMat, count('pine'));
    const crowns = new THREE.InstancedMesh(G.crown, leafMat, count('broad'));
    const branches = new THREE.InstancedMesh(G.branch, barkMat, count('dead') * 2);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const counters = { trunk: 0, pine: 0, crown: 0, branch: 0 };
    const set = (im, key, x, y, z, sx, sy, sz, ry, hex, rx = 0, rz = 0) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      im.setMatrixAt(counters[key], dummy.matrix);
      color.setHex(hex).offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.08);
      im.setColorAt(counters[key], color);
      counters[key]++;
    };
    for (const t of trees) {
      const s = t.s;
      if (t.type === 'pine') {
        set(trunks, 'trunk', t.x, t.y - 0.2, t.z, s, 3 * s, s, t.ry, 0x4a3a2a);
        set(pinesA, 'pine', t.x, t.y + 1.6 * s, t.z, 2.2 * s, 4.2 * s, 2.2 * s, t.ry, 0x34482e);
        counters.pine--;
        set(pinesB, 'pine', t.x, t.y + 3.6 * s, t.z, 1.5 * s, 3.4 * s, 1.5 * s, t.ry, 0x3c5232);
      } else if (t.type === 'broad') {
        set(trunks, 'trunk', t.x, t.y - 0.2, t.z, 1.2 * s, 3.4 * s, 1.2 * s, t.ry, 0x55402c);
        const hue = [0xb5832e, 0xc29a3a, 0x8f7a2e, 0xa4612a][Math.floor(rng() * 4)];
        set(crowns, 'crown', t.x, t.y + 4.3 * s, t.z, 2.6 * s, 2.1 * s, 2.6 * s, t.ry, hue);
      } else {
        set(trunks, 'trunk', t.x, t.y - 0.2, t.z, 0.8 * s, 4.5 * s, 0.8 * s, t.ry, 0x4d4640);
        set(branches, 'branch', t.x, t.y + 2.6 * s, t.z, s, 1.8 * s, s, t.ry, 0x4d4640, 0, 0.8);
        set(branches, 'branch', t.x, t.y + 3.2 * s, t.z, s, 1.4 * s, s, t.ry + 2.5, 0x4d4640, 0, -0.7);
      }
      this.addCircle(t.x, t.z, 0.35 * s);
    }
    for (const im of [trunks, pinesA, pinesB, crowns, branches]) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.scene.add(im);
    }

    // Rocks.
    const rocks = [];
    for (let i = 0; i < 1600 && rocks.length < 320; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 300;
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (!ok(x, z, -3)) continue;
      rocks.push({ x, z, s: 0.4 + Math.pow(rng(), 2.5) * 2.6 });
    }
    const rockMesh = new THREE.InstancedMesh(G.rock, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 }), rocks.length);
    counters.rock = 0;
    for (const r of rocks) {
      const y = this.getHeight(r.x, r.z);
      set(rockMesh, 'rock', r.x, y + r.s * 0.2, r.z, r.s * (1 + rng() * 0.6), r.s * (0.6 + rng() * 0.4), r.s * (1 + rng() * 0.5), rng() * 6, 0x7a766d, rng(), rng());
      if (r.s > 0.9) this.addCircle(r.x, r.z, r.s * 0.95);
    }
    rockMesh.castShadow = rockMesh.receiveShadow = true;
    rockMesh.instanceMatrix.needsUpdate = true;
    rockMesh.instanceColor.needsUpdate = true;
    this.scene.add(rockMesh);

    // Grass tufts: decorative only.
    const tufts = [];
    for (let i = 0; i < 26000 && tufts.length < 9000; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 280;
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (this.roadDistance(x, z) < 3.5 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r) continue;
      if (this.inArena(x, z, 4) || this.slopeAt(x, z) > 0.5) continue;
      tufts.push({ x, z });
    }
    const tuftMesh = new THREE.InstancedMesh(G.tuft, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }), tufts.length);
    counters.tuft = 0;
    for (const t of tufts) {
      const s = 0.7 + rng() * 0.9;
      set(tuftMesh, 'tuft', t.x, this.getHeight(t.x, t.z) - 0.05, t.z, s, s * (0.8 + rng() * 0.8), s, rng() * 6, rng() < 0.6 ? 0xb39a4e : 0x7c8740, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5);
    }
    tuftMesh.instanceMatrix.needsUpdate = true;
    tuftMesh.instanceColor.needsUpdate = true;
    this.scene.add(tuftMesh);
  }

  _buildBlocks() {
    const im = new THREE.InstancedMesh(box(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.92 }), this.blocks.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const rng = mulberry32(3);
    this.blocks.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.ry, 0);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, color.setHex(b.color).offsetHSL(0, 0, (rng() - 0.5) * 0.06));
    });
    im.castShadow = im.receiveShadow = true;
    this.scene.add(im);
  }

  // ---------- collision ----------

  _indexColliders() {
    const put = (key, c) => {
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(c);
    };
    const insert = (c, x, z, r) => {
      for (let gx = Math.floor((x - r) / GRID); gx <= Math.floor((x + r) / GRID); gx++)
        for (let gz = Math.floor((z - r) / GRID); gz <= Math.floor((z + r) / GRID); gz++) put(gx + ',' + gz, c);
    };
    for (const c of this.circles) insert(c, c.x, c.z, c.r);
    for (const b of this.boxes) insert(b, b.x, b.z, Math.hypot(b.hx, b.hz));
  }

  _pushCircle(pos, radius, c) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const min = c.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) return false;
    const d = Math.sqrt(d2) || 0.0001;
    pos.x = c.x + (dx / d) * min;
    pos.z = c.z + (dz / d) * min;
    return true;
  }

  _pushBox(pos, radius, b) {
    if (!b.enabled) return false;
    const dx = pos.x - b.x, dz = pos.z - b.z;
    const lx = dx * b.c - dz * b.s;
    const lz = dx * b.s + dz * b.c;
    const cx = clamp(lx, -b.hx, b.hx), cz = clamp(lz, -b.hz, b.hz);
    let ux = lx - cx, uz = lz - cz;
    const d = Math.hypot(ux, uz);
    if (d >= radius) return false;
    let push;
    if (d > 1e-5) {
      push = radius - d;
      ux /= d; uz /= d;
    } else {
      const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
      if (px < pz) { ux = Math.sign(lx) || 1; uz = 0; push = px + radius; }
      else { ux = 0; uz = Math.sign(lz) || 1; push = pz + radius; }
    }
    pos.x += (ux * b.c + uz * b.s) * push;
    pos.z += (-ux * b.s + uz * b.c) * push;
    return true;
  }

  // Pushes a circle of `radius` at pos out of all colliders. Returns true if anything was hit.
  resolve(pos, radius) {
    let hit = false;
    const gx = Math.floor(pos.x / GRID), gz = Math.floor(pos.z / GRID);
    for (let ix = gx - 1; ix <= gx + 1; ix++) {
      for (let iz = gz - 1; iz <= gz + 1; iz++) {
        const list = this.grid.get(ix + ',' + iz);
        if (!list) continue;
        for (const c of list) hit = (c.r !== undefined ? this._pushCircle(pos, radius, c) : this._pushBox(pos, radius, c)) || hit;
      }
    }
    for (const b of this.dynamic) hit = this._pushBox(pos, radius, b) || hit;
    const r = Math.hypot(pos.x, pos.z);
    if (r > WORLD.playRadius) {
      pos.x *= WORLD.playRadius / r;
      pos.z *= WORLD.playRadius / r;
      hit = true;
    }
    return hit;
  }

  // ---------- per-frame ----------

  update(dt, time) {
    this.fogGate.uniforms.uTime.value = time;
    const ps = this.game.particles;
    for (const f of this.fires) {
      const flick = 0.85 + Math.sin(time * 13 + f.seed) * 0.08 + Math.sin(time * 7.3 + f.seed * 2) * 0.07;
      f.flame.scale.set(1, flick * 1.1, 1);
      f.glow.material.opacity = 0.45 * flick;
      if (f.lightObj) f.lightObj.intensity = 26 * flick;
      if (Math.random() < dt * 6) {
        ps.emit({ x: f.x, y: f.y + (f.light ? 0.6 : 1.9), z: f.z, count: 1, speed: 0.4, up: 1.6, color: 0xffa040, color2: 0xffd080, life: [0.8, 1.6], size: [0.06, 0.12], drag: 0.6, jitter: 0.25 });
      }
    }
    for (const s of this.shrines.values()) {
      const pulse = s.lit ? 1 + Math.sin(time * 2.2) * 0.12 : 0.4;
      s.glow.material.opacity = (s.lit ? 0.7 : 0.18) * pulse;
      s.flameMat.emissiveIntensity = s.lit ? 2.4 * pulse : 0.3;
      s.light.intensity = s.lit ? 22 * pulse : 0;
      if (s.lit && Math.random() < dt * 3) {
        ps.emit({ x: s.x + 0.38, y: this.getHeight(s.x, s.z) + 2.1, z: s.z, count: 1, speed: 0.3, up: 0.6, color: 0xffd080, life: [1.5, 2.5], size: [0.05, 0.1], drag: 0.3, jitter: 0.6 });
      }
    }
    if (this.fogGate.active && Math.random() < dt * 8) {
      const f = this.fogGate;
      ps.emit({ x: f.x + (Math.random() - 0.5) * 5, y: this.getHeight(f.x, f.z) + Math.random() * 6, z: f.z, count: 1, speed: 0.2, up: 0.5, color: 0xfff0c0, life: [1, 2], size: [0.06, 0.12], drag: 0.5 });
    }
    const gd = this.gateDoors;
    if (gd.opening && gd.open < 1) {
      gd.open = Math.min(1, gd.open + dt * 0.25);
      const a = (1 - Math.pow(1 - gd.open, 3)) * 1.7;
      gd.left.rotation.y = -a;
      gd.right.rotation.y = a;
    }
  }

  closeGate() {
    const gd = this.gateDoors;
    gd.opening = false;
    gd.open = 0;
    gd.collider.enabled = true;
    gd.left.rotation.y = 0;
    gd.right.rotation.y = 0;
  }

  openGate(instant = false) {
    const gd = this.gateDoors;
    gd.opening = true;
    gd.collider.enabled = false;
    if (instant) {
      gd.open = 1;
      gd.left.rotation.y = -1.7;
      gd.right.rotation.y = 1.7;
    }
  }
}
