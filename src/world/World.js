// The Vale: heightmap terrain, roads, lake, vegetation, set pieces and 2D colliders.
import * as THREE from '../lib/three.js';
import { createNoise2D, fbm, smoothstep, clamp, lerp, mulberry32, distToSegment } from '../core/math.js';
import { WORLD, ZONES, ROADS, LAKE, FEN, FEN_POOLS, RIME, TARN, HALL, ARENA, SHRINES, NOTICE, FIRES, KEEP_CLEAR } from '../data/world.js';
import * as P from '../models/props.js';
import { mat, mesh, box, cyl, cone, plainBox, glowSprite } from '../models/kit.js';
import { Scenery } from './Scenery.js';
import { Water } from './Water.js';
import { Weather, WEATHER } from './Weather.js';
import { Ambient } from './Ambient.js';
import { WIND } from './Wind.js';
import { LOBES, SEA, LAVA, VOLCANO, OASIS, SPIRE_AT } from '../data/biomes.js';
import { buildBiomes, updateBiomes } from './Biomes.js';

const SIZE = WORLD.size;
const SEG = WORLD.segments;
const CELL = SIZE / SEG;
const HALF = SIZE / 2;
const GRID = 16; // collider hash cell, metres
const ROAD_CELL = 32, ROAD_REACH = 26, ROAD_FAR = 1e4; // road lookup grid (see roadDistance)
const TILES = 3; // terrain is split into TILES x TILES meshes so off-screen ground is culled

const C = (hex) => new THREE.Color(hex);
const tmpC = new THREE.Color();
const tmpC2 = new THREE.Color();
const COL = {
  gold: C(0xa38f48), olive: C(0x6f7838), deep: C(0x4f5a2c), dry: C(0x9c8058),
  dirt: C(0x7d6649), road: C(0x9a8460), rock: C(0x77736a), rockDark: C(0x55524b),
  snow: C(0xdcd9d2), ash: C(0x6e6962), mud: C(0x4d4234), moor: C(0x6b5f4a),
  warm: C(0xb08a48), cool: C(0x5e6c3a), damp: C(0x4c5530), canopy: C(0x55602e),
  rut: C(0x87714f), scree: C(0x8a8578), rockWarm: C(0x857a6a),
  fen: C(0x6d6c56), fenAsh: C(0x85827a), bog: C(0x3b382e), fenMoss: C(0x55603f),
  snowLit: C(0xeef2f4), snowShade: C(0xc6d2dc), snowRoad: C(0xa9a197), iceRock: C(0x6c7680), hallIce: C(0xb4cbd8),
  // The Cinderfall Wastes.
  cinder: C(0x3f3b39), cinderLit: C(0x5a534c), basalt: C(0x2b292f), rust: C(0x6e3d26), sulfur: C(0xa3943e),
  scorch: C(0xb4471c), cinderRoad: C(0x6a5f52),
  // The Drowned Coast.
  sand: C(0xdcc898), sandDim: C(0xc4ad80), wetSand: C(0xa6946e), seabed: C(0x7d8f7a), seaDeep: C(0x5a7066),
  duneGrass: C(0x99a159), coastRock: C(0x8b8476), coastRoad: C(0xbca77c),
  // The Glowcap Hollows.
  moss: C(0x43345c), mossTeal: C(0x2d5d5d), spore: C(0x5cc4b2), sporePink: C(0xb05aa8), hollowRock: C(0x4b4560),
  hollowRoad: C(0x5a4d68),
  // The Gilded Dunes.
  dune: C(0xe2b46a), duneLit: C(0xf0cc84), duneShade: C(0xc08e4e), sandstone: C(0xb4683e), sandstoneDark: C(0x8e4e30),
  oasisGrass: C(0x6e9a3a), duneRoad: C(0xc8a070),
  // The Hollow Bell.
  bellAsh: C(0x8a8490), bellAsh2: C(0x6e6878), bronze: C(0x8a6a3c),
  // The Stormspire Heights.
  slate: C(0x5c6068), slateDark: C(0x3c4048), stormMoss: C(0x4e5e48), stormLichen: C(0x8a8e6a), stormRoad: C(0x6e6a64),
};

// Points along the lava river, as segments.
const RIVER = [];
for (let i = 0; i < LAVA.river.length - 1; i++) RIVER.push([...LAVA.river[i], ...LAVA.river[i + 1]]);


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
    this.glowSpots = []; // small flames (candles) for Scenery's batched glow
    this.statics = []; // placed set pieces whose plain meshes Scenery bakes into its chunks
    this.indexed = false;

    this.roadSegs = [];
    for (const road of ROADS) for (let i = 0; i < road.length - 1; i++) this.roadSegs.push([...road[i], ...road[i + 1]]);
    // Road segments by grid cell, so a distance query only looks at the few roads nearby (every
    // caller only cares within ROAD_REACH metres of a road; further than that reads as far away).
    this.roadGrid = new Map();
    for (const sg of this.roadSegs) {
      const x0 = Math.floor((Math.min(sg[0], sg[2]) - ROAD_REACH) / ROAD_CELL), x1 = Math.floor((Math.max(sg[0], sg[2]) + ROAD_REACH) / ROAD_CELL);
      const z0 = Math.floor((Math.min(sg[1], sg[3]) - ROAD_REACH) / ROAD_CELL), z1 = Math.floor((Math.max(sg[1], sg[3]) + ROAD_REACH) / ROAD_CELL);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gz = z0; gz <= z1; gz++) {
          const key = gx * 4096 + gz;
          if (!this.roadGrid.has(key)) this.roadGrid.set(key, []);
          this.roadGrid.get(key).push(sg);
        }
      }
    }

    this.waterLevel = this._raw(LAKE.x, LAKE.z).big - 2;
    // The fen's pools all share one level, just under the fen floor.
    this.fenFloor = this._raw(FEN.x, FEN.z).big;
    this.fenLevel = this.fenFloor - 0.35;
    // Each lava pool's surface sits a little under the ash around it.
    this.oasisLevel = this._raw(OASIS.x, OASIS.z).big - 1.2;
    this.lavaPools = LAVA.pools.map((p) => ({ ...p, level: this._raw(p.x, p.z).big - 1.0 }));
    this.flatZones = Object.values(ZONES).filter((z) => z.flat != null).map((z) => ({ x: z.x, z: z.z, r: z.flat, h: this._flatHeight(z.x, z.z) }));

    this._buildHeights();
    this._buildTerrain();
    this._buildWater();
    this._buildStructures();
    this._buildVegetation();
    this._buildBlocks();
    this._indexColliders();

    this.weather = new Weather(this.scene, game.sky);
    this.ambient = new Ambient(this, this.scenery);
  }

  // ---------- height field ----------

  // How far inside the Rimewold lobe (x, z) is: 1 well inside, 0 outside.
  rimeLobe(x, z) {
    return 1 - smoothstep(RIME.r * 0.8, RIME.r * 1.2, Math.hypot(x - RIME.x, z - RIME.z));
  }

  // 0 south of the ridge, 1 in the snow.
  snowAt(x, z) {
    return smoothstep(RIME.snowZ + 4, RIME.snowZ - 22, z);
  }

  // Distance from an outer region's centre (the coast's lobe runs on west as a band to the sea).
  lobeDist(L, x, z) {
    return L.band && x < L.x ? Math.abs(z - L.z) : Math.hypot(x - L.x, z - L.z);
  }

  // How far inside each outer region (x, z) is, sharply at its rim (where its ridge stands):
  // { cinder, coast, glow }, each 0..1.
  biomeW(x, z) {
    const o = {};
    for (const k in LOBES) {
      const L = LOBES[k];
      o[k] = smoothstep(L.r + 12, L.r - 26, this.lobeDist(L, x, z));
    }
    return o;
  }

  // The outer region (x, z) lies in ('cinder' | 'coast' | 'glow'), or null for the Vale and the
  // Rimewold. `pad` metres past a region's rim still count.
  biomeAt(x, z, pad = 0) {
    for (const k in LOBES) if (this.lobeDist(LOBES[k], x, z) < LOBES[k].r + pad) return k;
    return null;
  }

  // Where (x, z) is, for weather, music and ambience: 'cinder' | 'coast' | 'glow' | 'rime' | 'fen' | 'vale'.
  regionAt(x, z) {
    const b = this.biomeAt(x, z);
    if (b) return b;
    if (z < RIME.snowZ - 4) return 'rime';
    if (Math.hypot(x - FEN.x, z - FEN.z) < FEN.r) return 'fen';
    return 'vale';
  }

  _raw(x, z) {
    let big = fbm(this.noise, x * 0.0032, z * 0.0032, 4) * 24;
    const r = Math.hypot(x, z);
    const lobe = this.rimeLobe(x, z);
    // The Rimewold is a highland a little above the Vale, ringed by its own peaks.
    big += lobe * smoothstep(RIME.ridgeZ + 10, RIME.ridgeZ - 40, z) * 8;
    // The ring of mountains stands back from every lobe of the play area.
    let open = lobe;
    for (const k in LOBES) {
      const L = LOBES[k];
      open = Math.max(open, 1 - smoothstep(L.r * 0.8, L.r * 1.2, this.lobeDist(L, x, z)));
    }
    big += smoothstep(WORLD.mountainStart, WORLD.mountainEnd, r) * (80 + fbm(this.noise2, x * 0.008, z * 0.008, 3) * 50) * (1 - open);
    // The ridge between the Vale and the Rimewold; Castle Dunmarrow holds the only pass through it.
    const ridge = (1 - smoothstep(8, 46, Math.abs(z - RIME.ridgeZ))) * smoothstep(36, 95, Math.abs(x));
    if (ridge > 0) big += ridge * (46 + fbm(this.noise2, x * 0.02 + 5, z * 0.02, 2) * 14);
    // The outer regions: each has its own ground, and a ridge along its rim with one pass through.
    const B = this.biomeW(x, z);
    if (B.cinder > 0) {
      // Black mesas in broken terraces.
      let t = fbm(this.noise2, x * 0.007 + 20, z * 0.007 - 4, 3) * 26 + 6;
      const q = 3.6, f = t / q - Math.floor(t / q);
      t = (Math.floor(t / q) + smoothstep(0.55, 1, f)) * q;
      big = lerp(big, t, B.cinder);
    }
    if (B.coast > 0) {
      // Dunes sloping down to the sea, and the seabed shelving away under it.
      const d = x - SEA.shoreX;
      const dune = fbm(this.noise2, x * 0.02 - 30, z * 0.02 + 8, 2) * 2.6 * smoothstep(5, 45, d);
      const shelf = d > 0 ? Math.min(d * 0.1, 9) : Math.max(d * 0.12, -12);
      big = lerp(big, SEA.level + 0.6 + shelf + dune, B.coast);
    }
    if (B.glow > 0) {
      // A sunken hollow with a soft, rolling floor.
      big = lerp(big, big * 0.35 - 7 + fbm(this.noise2, x * 0.015 + 9, z * 0.015 + 3, 2) * 4, B.glow);
    }
    if (B.dunes > 0) {
      // Long dune ridges across the wind, and flat-topped sandstone mesas standing out of them.
      const n = fbm(this.noise2, x * 0.006 - 40, z * 0.006 + 12, 3);
      const ridge = Math.sin((x * 0.75 + z * 0.66) * 0.045 + n * 3) * 4.5 + Math.sin((x * 0.4 - z * 0.9) * 0.09 + n * 5) * 1.4;
      const mesa = smoothstep(0.42, 0.5, fbm(this.noise, x * 0.011 + 31, z * 0.011 - 8, 2)) * 14;
      big = lerp(big, 6 + ridge + n * 8 + mesa, B.dunes);
    }
    if (B.bell > 0) {
      // A high, barren shelf under the spire.
      big = lerp(big, 34 + fbm(this.noise2, x * 0.02 - 3, z * 0.02 + 51, 2) * 3, B.bell);
    }
    if (B.storm > 0) {
      // A high, broken plateau of crags: ridged noise, sharp and grey.
      const rn = 1 - Math.abs(fbm(this.noise2, x * 0.009 + 77, z * 0.009 - 21, 3));
      big = lerp(big, 22 + rn * rn * 26 + fbm(this.noise, x * 0.004, z * 0.004, 2) * 10, B.storm);
    }
    for (const k in LOBES) {
      const L = LOBES[k];
      const d = this.lobeDist(L, x, z);
      if (Math.abs(d - L.r) > 40 || (L.band && x < L.x) || r > WORLD.playRadius + 60) continue;
      const rim = (1 - smoothstep(6, 30, Math.abs(d - L.r))) * smoothstep(L.gap, L.gap + 34, Math.hypot(x - L.gate[0], z - L.gate[1]));
      big += rim * (40 + fbm(this.noise2, x * 0.02 - 11, z * 0.02 + 6, 2) * 14) * (1 - smoothstep(WORLD.playRadius, WORLD.playRadius + 60, r));
    }
    // Ashmaw's volcano.
    const vd = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    if (vd < VOLCANO.r) {
      const c = 1 - vd / VOLCANO.r;
      big += Math.pow(c, 1.4) * VOLCANO.h - smoothstep(VOLCANO.crater + 6, VOLCANO.crater - 8, vd) * 34;
    }
    const detail = fbm(this.noise2, x * 0.02 + 40, z * 0.02 - 17, 3) * 3.2 * (1 - B.coast * 0.6);
    return { big, h: big + detail };
  }

  // 0 off the lava, rising to 1 in the middle of a pool or the river's channel.
  lavaDepth(x, z) {
    if (this.lobeDist(LOBES.cinder, x, z) > LOBES.cinder.r + 50) return 0;
    let best = 0;
    for (const p of LAVA.pools) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d > p.r * 1.3) continue;
      best = Math.max(best, 1 - smoothstep(p.r * 0.45, p.r, d + this.noise(x * 0.13, z * 0.13) * p.r * 0.2));
    }
    let rd = Infinity;
    for (const s of RIVER) rd = Math.min(rd, distToSegment(x, z, s[0], s[1], s[2], s[3]));
    return Math.max(best, 1 - smoothstep(LAVA.riverW * 0.55, LAVA.riverW * 1.5, rd));
  }

  // The lava's surface level at (x, z): a pool's own level, or the river's, which runs downhill.
  lavaLevelAt(x, z) {
    for (const p of this.lavaPools) if (Math.hypot(x - p.x, z - p.z) < p.r * 1.3) return p.level;
    let best = Infinity, bx = x, bz = z;
    for (const s of RIVER) {
      const dx = s[2] - s[0], dz = s[3] - s[1];
      const t = clamp(((x - s[0]) * dx + (z - s[1]) * dz) / (dx * dx + dz * dz), 0, 1);
      const px = s[0] + dx * t, pz = s[1] + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; bx = px; bz = pz; }
    }
    return this._raw(bx, bz).big - 1.0;
  }

  // Standing in lava?
  isLava(x, z) {
    return this.lavaDepth(x, z) > 0.55;
  }

  // Level a zone settles at: its own ground, or the fen floor when it sits inside the fen.
  _flatHeight(x, z) {
    const big = this._raw(x, z).big;
    const fd = Math.hypot(x - FEN.x, z - FEN.z);
    return fd < FEN.r ? lerp(big, this.fenFloor, 1 - smoothstep(FEN.r * 0.5, FEN.r, fd)) : big;
  }

  // Distance to the nearest road's centre line (anything past ROAD_REACH metres reads as far away).
  roadDistance(x, z) {
    const list = this.roadGrid.get(Math.floor(x / ROAD_CELL) * 4096 + Math.floor(z / ROAD_CELL));
    if (!list) return ROAD_FAR;
    let d = ROAD_FAR;
    for (const s of list) {
      const v = distToSegment(x, z, s[0], s[1], s[2], s[3]);
      if (v < d) d = v;
    }
    return d;
  }

  _heightAt(x, z, rd = this.roadDistance(x, z)) {
    const { big, h: h0 } = this._raw(x, z);
    let h = h0;
    h = lerp(h, big, (1 - smoothstep(2.5, 9, rd)) * 0.92);
    // The fen is a broad, nearly level basin with a little hummock left in it.
    const fd = Math.hypot(x - FEN.x, z - FEN.z);
    if (fd < FEN.r) h = lerp(h, this.fenFloor + (h0 - big) * 0.4, 1 - smoothstep(FEN.r * 0.5, FEN.r, fd));
    const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
    h = lerp(h, this.waterLevel - 3.5, 1 - smoothstep(LAKE.r * 0.4, LAKE.r, ld));
    for (const zn of this.flatZones) {
      if (Math.abs(x - zn.x) > zn.r + 14 || Math.abs(z - zn.z) > zn.r + 14) continue;
      const d = Math.hypot(x - zn.x, z - zn.z);
      const w = 1 - smoothstep(zn.r, zn.r + 14, d);
      if (w > 0) h = lerp(h, zn.h, w);
    }
    // Fen pools, with ragged shores; the road stays a causeway between them.
    const pool = this.fenPoolDepth(x, z);
    if (pool > 0) h = lerp(h, this.fenLevel - 2.6, pool * smoothstep(3.5, 8, rd));
    // The oasis pool, sunk into the dunes.
    const od = Math.hypot(x - OASIS.x, z - OASIS.z);
    if (od < OASIS.r * 1.6) h = lerp(h, this.oasisLevel - 2.4, 1 - smoothstep(OASIS.r * 0.5, OASIS.r * 1.05 + this.noise(x * 0.1, z * 0.1) * 2, od));
    // Lava basins and the lava river's channel, sunk below the ash.
    const lava = this.lavaDepth(x, z);
    if (lava > 0) h = lerp(h, this.lavaLevelAt(x, z) - 1.6, lava);
    return h;
  }

  _buildHeights() {
    const n = SEG + 1;
    this.heights = new Float32Array(n * n);
    this.roadW = new Float32Array(n * n);
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
        const rd = this.roadDistance(x, z);
        this.heights[iz * n + ix] = this._heightAt(x, z, rd);
        this.roadW[iz * n + ix] = 1 - smoothstep(2, 5.5, rd);
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

        const nz = this.noise(x * 0.04, z * 0.04);
        const t = fbm(this.noise2, x * 0.012, z * 0.012, 2) * 0.5 + 0.5;
        c.copy(COL.olive).lerp(COL.gold, smoothstep(0.35, 0.75, t));
        // Broad warm and cool drifts across the whole Vale, so distant fields aren't one flat tone.
        const macro = fbm(this.noise, x * 0.0045 + 11, z * 0.0045 - 7, 2);
        c.lerp(COL.warm, smoothstep(0.15, 0.65, macro) * 0.3);
        c.lerp(COL.cool, smoothstep(-0.15, -0.65, macro) * 0.35);
        c.lerp(COL.deep, smoothstep(0.55, 0.9, fbm(this.noise, x * 0.03 + 9, z * 0.03, 2) * 0.5 + 0.5) * 0.6);
        // Darker ground under the forests (same field Scenery plants trees by).
        c.lerp(COL.canopy, smoothstep(0.0, 0.35, fbm(this.noise, x * 0.007 + 3, z * 0.007 - 5, 2)) * 0.35);
        if (x < -150 && z < -60) c.lerp(COL.moor, smoothstep(-150, -230, x) * 0.7);
        c.lerp(COL.dry, smoothstep(0.6, 0.95, (this.noise(x * 0.05, z * 0.05) + 1) / 2) * 0.35);
        // Roads: packed earth with darker, trodden shoulders.
        const rw = this.roadW[i];
        c.lerp(COL.road, rw * 0.9);
        c.lerp(COL.rut, rw * (1 - rw) * 1.6 * (0.6 + nz * 0.4));
        // Rock: warm and dark strata on the steep faces, scree below the snow line.
        const strata = 0.5 + 0.5 * Math.sin(h * 0.42 + nz * 2.2);
        c.lerp(tmpC.copy(COL.rock).lerp(COL.rockWarm, strata * 0.7), smoothstep(0.45, 0.8, slope));
        c.lerp(COL.rockDark, smoothstep(0.9, 1.3, slope) * (0.4 + strata * 0.35));
        const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
        c.lerp(COL.damp, (1 - smoothstep(LAKE.r * 1.0, LAKE.r * 1.5 + nz * 8, ld)) * 0.55);
        c.lerp(COL.mud, 1 - smoothstep(LAKE.r * 0.85, LAKE.r * 1.05, ld));
        // The Ashen Fen: grey-green ash ground, mossy patches, black mud around the pools.
        const fw = 1 - smoothstep(FEN.r * 0.65, FEN.r, Math.hypot(x - FEN.x, z - FEN.z) + nz * 10);
        if (fw > 0) {
          c.lerp(tmpC.copy(COL.fen).lerp(COL.fenAsh, smoothstep(0.1, 0.6, t)), fw * 0.85);
          c.lerp(COL.fenMoss, smoothstep(0.2, 0.7, macro) * fw * 0.4);
          const pd = this.fenPoolDepth(x, z);
          c.lerp(COL.bog, smoothstep(0.0, 0.25, pd) * fw);
        }
        // The Rimewold: lit and shaded snow drifts, packed snow on the roads, blue-grey rock on the
        // steep faces, and pale ice-stone around the Hall of the Winter Lantern.
        const sn = this.snowAt(x, z + nz * 6);
        if (sn > 0) {
          tmpC.copy(COL.snowShade).lerp(COL.snowLit, smoothstep(0.2, 0.8, t));
          tmpC.lerp(COL.iceRock, smoothstep(0.5, 0.95, slope));
          c.lerp(tmpC, sn);
          c.lerp(COL.snowRoad, rw * 0.75 * sn);
          const hd = Math.hypot(x - HALL.x, z - HALL.z);
          c.lerp(COL.hallIce, (1 - smoothstep(HALL.r - 4, HALL.r + 6, hd)) * 0.8);
        }
        const B = this.biomeW(x + nz * 5, z - nz * 5);
        if (B.cinder > 0) {
          // Black ash and basalt, rusty drifts, sulphur crusts, and scorched rock round the lava.
          tmpC.copy(COL.cinder).lerp(COL.cinderLit, smoothstep(0.3, 0.8, t));
          tmpC.lerp(COL.rust, smoothstep(0.25, 0.7, macro) * 0.5);
          tmpC.lerp(COL.sulfur, smoothstep(0.72, 0.92, (this.noise(x * 0.06 + 3, z * 0.06) + 1) / 2) * 0.55);
          tmpC.lerp(COL.basalt, smoothstep(0.35, 0.75, slope));
          tmpC.lerp(COL.cinderRoad, rw * 0.85);
          const lv = this.lavaDepth(x, z);
          tmpC.lerp(COL.scorch, smoothstep(0.0, 0.5, lv) * 0.9);
          c.lerp(tmpC, B.cinder);
        }
        if (B.coast > 0) {
          // Pale dunes, wet sand at the tide line, the seabed going green-grey under the water.
          tmpC.copy(COL.sandDim).lerp(COL.sand, smoothstep(0.2, 0.8, t));
          tmpC.lerp(COL.duneGrass, smoothstep(0.2, 0.6, macro) * smoothstep(SEA.shoreX + 30, SEA.shoreX + 70, x) * 0.7);
          tmpC.lerp(COL.coastRock, smoothstep(0.45, 0.8, slope));
          tmpC.lerp(COL.coastRoad, rw * 0.6);
          tmpC.lerp(COL.wetSand, smoothstep(SEA.level + 1.6, SEA.level + 0.3, h));
          tmpC.lerp(COL.seabed, smoothstep(SEA.level - 0.2, SEA.level - 1.5, h));
          tmpC.lerp(COL.seaDeep, smoothstep(SEA.level - 2, SEA.level - 8, h));
          c.lerp(tmpC, B.coast);
        }
        if (B.glow > 0) {
          // Violet and teal moss, with luminous rings of spore-light here and there.
          tmpC.copy(COL.moss).lerp(COL.mossTeal, smoothstep(0.25, 0.75, t));
          const ring = (this.noise(x * 0.07 - 5, z * 0.07 + 9) + 1) / 2;
          tmpC.lerp(macro > 0.1 ? COL.spore : COL.sporePink, smoothstep(0.78, 0.9, ring) * 0.6);
          tmpC.lerp(COL.hollowRock, smoothstep(0.45, 0.8, slope));
          tmpC.lerp(COL.hollowRoad, rw * 0.8);
          c.lerp(tmpC, B.glow);
        }
        if (B.dunes > 0) {
          // Gold sand, lit on the windward faces of the ridges; red sandstone on the mesas' cliffs;
          // green round the oasis.
          tmpC.copy(COL.duneShade).lerp(COL.dune, smoothstep(0.1, 0.6, t)).lerp(COL.duneLit, smoothstep(0.1, 0.5, (hr - hl) / CELL) * 0.6);
          tmpC.lerp(tmpC2.copy(COL.sandstone).lerp(COL.sandstoneDark, strata), smoothstep(0.4, 0.75, slope));
          tmpC.lerp(COL.duneRoad, rw * 0.7);
          const od = Math.hypot(x - OASIS.x, z - OASIS.z);
          tmpC.lerp(COL.oasisGrass, (1 - smoothstep(OASIS.r * 1.1, OASIS.r * 1.9 + nz * 4, od)) * 0.85);
          c.lerp(tmpC, B.dunes);
        }
        if (B.storm > 0) {
          // Grey slate and dark crag, moss in the hollows, pale lichen on the tops.
          tmpC.copy(COL.slate).lerp(COL.stormMoss, smoothstep(0.2, 0.7, macro) * 0.6);
          tmpC.lerp(COL.stormLichen, smoothstep(0.65, 0.9, t) * 0.4);
          tmpC.lerp(COL.slateDark, smoothstep(0.4, 0.85, slope));
          tmpC.lerp(COL.stormRoad, rw * 0.8);
          c.lerp(tmpC, B.storm);
        }
        if (B.bell > 0) {
          // Pale ash with a violet cast, and a green-bronze crust where old bells have rotted into it.
          tmpC.copy(COL.bellAsh2).lerp(COL.bellAsh, smoothstep(0.2, 0.7, t));
          tmpC.lerp(COL.bronze, smoothstep(0.75, 0.92, (this.noise(x * 0.08 + 7, z * 0.08) + 1) / 2) * 0.6);
          tmpC.lerp(COL.slateDark, smoothstep(0.45, 0.8, slope));
          tmpC.lerp(COL.road, rw * 0.5);
          c.lerp(tmpC, B.bell);
        }
        const ad = Math.hypot(x - ARENA.x, z - ARENA.z);
        c.lerp(COL.ash, 1 - smoothstep(ARENA.r - 2, ARENA.r + 12, ad));
        const snowLine = h + nz * 7;
        // Around the Wastes the high peaks are ash and rock, not snow.
        const hot = 1 - smoothstep(LOBES.cinder.r * 1.1, LOBES.cinder.r * 1.6, Math.hypot(x - LOBES.cinder.x, z - LOBES.cinder.z));
        if (hot > 0) c.lerp(tmpC.copy(COL.basalt).lerp(COL.cinder, strata), hot * smoothstep(30, 60, h));
        // ...and round the Dunes they are red rock.
        const dry = 1 - smoothstep(LOBES.dunes.r * 1.1, LOBES.dunes.r * 1.6, Math.hypot(x - LOBES.dunes.x, z - LOBES.dunes.z));
        if (dry > 0) c.lerp(tmpC.copy(COL.sandstone).lerp(COL.sandstoneDark, strata), dry * smoothstep(25, 50, h));
        const snow = smoothstep(76, 92, snowLine) * (1 - smoothstep(0.85, 1.4, slope) * 0.7) * (1 - Math.max(hot, dry));
        c.lerp(COL.scree, smoothstep(58, 76, snowLine) * smoothstep(0.3, 0.7, slope) * 0.45 * (1 - snow));
        c.lerp(COL.snow, snow);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
    }
    // One shared vertex buffer, TILES x TILES index ranges: each tile is its own mesh with a tight
    // bounding sphere, so the camera only draws the ground in front of it.
    const pAttr = new THREE.BufferAttribute(pos, 3);
    const cAttr = new THREE.BufferAttribute(col, 3);
    const full = new THREE.BufferGeometry();
    full.setAttribute('position', pAttr);
    full.setIndex(new THREE.BufferAttribute(this._terrainIndex(0, 0, SEG), 1));
    full.computeVertexNormals();
    const nAttr = full.getAttribute('normal');
    full.dispose();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
    this.terrain = new THREE.Group();
    const span = SEG / TILES;
    for (let tz = 0; tz < TILES; tz++) {
      for (let tx = 0; tx < TILES; tx++) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', pAttr);
        geo.setAttribute('normal', nAttr);
        geo.setAttribute('color', cAttr);
        geo.setIndex(new THREE.BufferAttribute(this._terrainIndex(tx * span, tz * span, span), 1));
        let lo = Infinity, hi = -Infinity;
        for (let iz = tz * span; iz <= (tz + 1) * span; iz++) {
          for (let ix = tx * span; ix <= (tx + 1) * span; ix++) {
            const hh = this.heights[iz * n + ix];
            if (hh < lo) lo = hh;
            if (hh > hi) hi = hh;
          }
        }
        const cx = -HALF + (tx + 0.5) * span * CELL, cz = -HALF + (tz + 0.5) * span * CELL;
        const half = (span * CELL) / 2;
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, (lo + hi) / 2, cz), Math.hypot(half, half, (hi - lo) / 2));
        geo.boundingBox = new THREE.Box3(new THREE.Vector3(cx - half, lo, cz - half), new THREE.Vector3(cx + half, hi, cz + half));
        const tile = new THREE.Mesh(geo, material);
        tile.receiveShadow = true;
        tile.matrixAutoUpdate = false;
        this.terrain.add(tile);
      }
    }
    this.scene.add(this.terrain);
  }

  _terrainIndex(x0, z0, span) {
    const n = SEG + 1;
    const idx = new Uint32Array(span * span * 6);
    let k = 0;
    for (let iz = z0; iz < z0 + span; iz++) {
      for (let ix = x0; ix < x0 + span; ix++) {
        const a = iz * n + ix, b = (iz + 1) * n + ix, d = iz * n + ix + 1, cc = (iz + 1) * n + ix + 1;
        idx[k++] = a; idx[k++] = b; idx[k++] = d;
        idx[k++] = b; idx[k++] = cc; idx[k++] = d;
      }
    }
    return idx;
  }

  // 0 on dry ground, rising to 1 in the middle of a fen pool.
  fenPoolDepth(x, z) {
    if (Math.hypot(x - FEN.x, z - FEN.z) > FEN.r) return 0;
    let best = 0;
    for (const p of FEN_POOLS) {
      const d = Math.hypot(x - p.x, z - p.z) + this.noise(x * 0.11, z * 0.11) * p.r * 0.25;
      best = Math.max(best, 1 - smoothstep(p.r * 0.35, p.r, d));
    }
    return best;
  }

  _buildWater() {
    this.water = new Water(this.scene, LAKE, this.waterLevel, (x, z) => this.waterLevel - this.getHeight(x, z));
    // Black, still fen water: same shader, darker colours.
    this.pools = FEN_POOLS.map((p) => {
      const w = new Water(this.scene, { x: p.x, z: p.z, r: p.r * 1.3 }, this.fenLevel, (x, z) => this.fenLevel - this.getHeight(x, z));
      w.uniforms.uShallow.value.setHex(0x4a5240);
      w.uniforms.uDeep.value.setHex(0x161c1c);
      w.uniforms.uFoam.value.setHex(0x9a9684);
      return w;
    });
  }

  isWater(x, z) {
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r) return this.getHeight(x, z) < this.waterLevel - 0.3;
    if (x < SEA.shoreX + 30 && this.lobeDist(LOBES.coast, x, z) < LOBES.coast.r + 10) return this.getHeight(x, z) < SEA.level - 0.3;
    if (Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.r * 1.2) return this.getHeight(x, z) < this.oasisLevel - 0.3;
    return this.fenPoolDepth(x, z) > 0 && this.getHeight(x, z) < this.fenLevel - 0.3;
  }

  // ---------- placement helpers ----------

  place(obj, x, z, yaw = 0, sink = 0) {
    obj.position.set(x, this.getHeight(x, z) - sink, z);
    obj.rotation.y = yaw;
    this.scene.add(obj);
    return obj;
  }

  // place() for set pieces that never move: Scenery bakes their plain stone, wood and cloth meshes
  // into its chunk batches, so a graveyard costs a draw call or two instead of one per mesh.
  _static(obj, x, z, yaw = 0, sink = 0) {
    this.place(obj, x, z, yaw, sink);
    this.statics.push(obj);
    return obj;
  }

  // Stone blocks are batched into one InstancedMesh; `collide` adds an oriented box collider.
  // o.rx / o.rz tilt the block (beams, fallen stones); the collider only follows ry.
  block(x, z, sx, sy, sz, ry = 0, o = {}) {
    const y = o.y ?? this.getHeight(x, z) - 0.3;
    this.blocks.push({ x, y: y + sy / 2, z, sx, sy, sz, ry, rx: o.rx ?? 0, rz: o.rz ?? 0, color: o.color ?? 0x8a8478 });
    if (o.collide !== false) this.addBox(x, z, sx / 2, sz / 2, ry);
  }

  // Colliders added after the world is built (NPCs) go straight into the spatial hash.
  addCircle(x, z, r) {
    const c = { x, z, r };
    this.circles.push(c);
    if (this.indexed) this._insert(c, x, z, r);
    return c;
  }

  addBox(x, z, hx, hz, rot = 0, dynamic = false) {
    const b = { x, z, hx, hz, c: Math.cos(rot), s: Math.sin(rot), enabled: true };
    (dynamic ? this.dynamic : this.boxes).push(b);
    if (this.indexed && !dynamic) this._insert(b, x, z, Math.hypot(hx, hz));
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
    this._static(notice, NOTICE.x, NOTICE.z, NOTICE.yaw);
    this.addBox(NOTICE.x, NOTICE.z, 0.85, 0.2, NOTICE.yaw);

    // First Light: a ring of broken pillars around the shrine.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = ZONES.firstlight.x + Math.sin(a) * 11, z = ZONES.firstlight.z + Math.cos(a) * 11;
      if (Math.abs(x) < 6 && z < ZONES.firstlight.z) continue; // keep the road open
      this._static(P.buildPillar(2.5 + (i % 3) * 1.4, i % 2 === 0), x, z, a);
      this.addCircle(x, z, 0.6);
    }

    // Brannoc's camp.
    const camp = ZONES.camp;
    this._static(P.buildTent(), camp.x - 6, camp.z + 2, 0.8);
    this.addCircle(camp.x - 6, camp.z + 2, 2.0);
    for (const [dx, dz, ry, len] of [[6, -5, 0.3, 8], [9, 1, 1.7, 6], [-2, -8, 0.1, 6]]) {
      this._static(P.buildFence(len), camp.x + dx, camp.z + dz, ry);
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
    const bedroll = new THREE.Group();
    bedroll.add(mesh(box(0.9, 0.12, 2), mat(0x6e5a44), { y: 0.06 }));
    this._static(bedroll, lk.x + 3, lk.z + 1, 0.4);
    for (let i = 0; i < 4; i++) this.block(lk.x - 4, lk.z - 3, 0.8 - i * 0.15, 0.35, 0.8 - i * 0.15, i, { y: this.getHeight(lk.x - 4, lk.z - 3) + i * 0.3 - 0.1, collide: i === 0 });

    // Western Moor: the wrecked cart and its dead horse-less traces.
    const mo = ZONES.moor;
    this._static(P.buildCart(), mo.x, mo.z, 0.7);
    this.addBox(mo.x, mo.z, 1.0, 1.5, 0.7);

    // Road dressing: pillars and graves on the way north.
    const rng = mulberry32(5);
    for (const [x, z] of [[-6, 120], [14, 60], [36, -20], [-2, -90], [26, -100], [-8, -160], [14, -165]]) {
      this._static(P.buildPillar(2 + rng() * 4, rng() < 0.6), x, z, rng() * 3);
      this.addCircle(x, z, 0.6);
    }
    for (let i = 0; i < 40; i++) {
      const x = -30 + rng() * 60, z = -170 - rng() * 40;
      if (Math.abs(x) < 7 || this.roadDistance(x, z) < 5) continue;
      if (Math.hypot(x - ZONES.gatehouse.x, z - ZONES.gatehouse.z) < 6) continue;
      const grave = P.buildGrave(rng), ry = rng() * 0.6 - 0.3;
      if (KEEP_CLEAR.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue; // the rng is spent either way
      this._static(grave, x, z, ry, 0.05);
    }
    for (const x of [-12, 12]) {
      this._static(P.buildStatue(), x, -212, x < 0 ? 0.3 : -0.3);
      this.addCircle(x, -212, 1.0);
    }

    this._buildChapel();
    this._buildArena();
    this._buildCastle();
    this._buildRimewold();
    buildBiomes(this);

    // The Hollow Bell on the eastern peaks.
    const spire = P.buildSpire();
    spire.group.position.set(SPIRE_AT.x, this.getHeight(SPIRE_AT.x, SPIRE_AT.z) - 10, SPIRE_AT.z); // over the Hollow Bell's yard
    this.addCircle(SPIRE_AT.x, SPIRE_AT.z, 16.5);
    this.scene.add(spire.group);
    this.statics.push(spire.group);

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

  // Chapel of the Cracked Bell: a roofless nave on the rise above Mirelake. The door faces the road
  // to the east, the bell tower looks west over the water. Built from blocks so it is one draw call
  // with the ruins and the arena, and its walls collide.
  _buildChapel() {
    const ch = ZONES.chapel;
    const yaw = Math.PI / 2;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const gy = this.getHeight(ch.x, ch.z);
    const STONE = 0x8d877a, DARK = 0x6f6a60, WOOD = 0x4a3a2a;
    // Local (lx along the facade, lz from the altar to the door) to world.
    const at = (lx, lz) => [ch.x + lx * cs + lz * sn, ch.z - lx * sn + lz * cs];
    const blk = (lx, lz, sx, sy, sz, o = {}) => {
      const [x, z] = at(lx, lz);
      this.block(x, z, sx, sy, sz, yaw + (o.ry ?? 0), { ...o, y: o.y ?? gy - 0.3 });
    };
    // Side walls in broken courses: the left one has mostly fallen.
    const left = [4.2, 2.0, 4.6, 3.4, 1.4], right = [4.6, 4.4, 2.6, 4.8, 3.8];
    for (let i = 0; i < 5; i++) {
      const lz = -4.8 + i * 2.4;
      blk(-3.6, lz, 0.8, left[i], 2.5, { color: i % 2 ? DARK : STONE });
      blk(3.6, lz, 0.8, right[i], 2.5, { color: i % 2 ? STONE : DARK });
    }
    // Facade with an open doorway, and the back wall with an arch into the tower.
    blk(-2.4, 6, 2.4, 5.4, 0.8, { color: STONE });
    blk(2.4, 6, 2.4, 4.6, 0.8, { color: STONE });
    // What stands of the gable: one raking coping climbing from the left, a stub on the right.
    blk(-1.75, 6, 3.9, 0.55, 0.95, { y: gy + 5.85, rz: 0.52, color: DARK, collide: false });
    blk(2.6, 6, 1.9, 0.55, 0.95, { y: gy + 4.75, rz: -0.52, color: DARK, collide: false });
    blk(-1.6, 6, 1.5, 1.3, 0.8, { y: gy + 5.0, color: STONE, collide: false });
    blk(0.6, 7.6, 2.8, 0.5, 0.7, { y: gy - 0.15, ry: 0.4, color: DARK, collide: false }); // fallen lintel
    blk(-2.6, -6, 2.0, 5.0, 0.8, { color: STONE });
    blk(2.6, -6, 2.0, 5.0, 0.8, { color: STONE });
    blk(0, -6, 3.4, 0.7, 0.8, { y: gy + 3.9, color: DARK, collide: false });
    // Bell tower: four corner piers, low broken walls, an open belfry and its snapped beam.
    for (const [lx, lz, h] of [[-1.9, -6.6, 9.4], [1.9, -6.6, 9.8], [-1.9, -9.8, 9.6], [1.9, -9.8, 8.8]]) blk(lx, lz, 1.0, h, 1.0, { color: DARK });
    blk(0, -9.8, 2.8, 2.6, 0.7, { color: STONE });
    blk(-1.9, -8.2, 0.7, 4.2, 2.2, { color: STONE });
    blk(1.9, -8.2, 0.7, 1.6, 2.2, { color: STONE });
    blk(0, -6.6, 4.8, 0.6, 0.9, { y: gy + 8.6, color: STONE, collide: false });
    blk(0, -9.8, 4.8, 0.6, 0.9, { y: gy + 8.2, color: STONE, collide: false });
    blk(-1.9, -8.2, 0.9, 0.6, 4.2, { y: gy + 8.6, color: STONE, collide: false });
    blk(-0.6, -8.2, 2.6, 0.3, 0.3, { y: gy + 7.4, rz: -0.35, color: WOOD, collide: false });
    // What is left of the roof: three rafters, one fallen into the nave, and a stub of ridge beam.
    blk(0, -2.6, 8.2, 0.3, 0.35, { y: gy + 4.0, rz: 0.05, color: WOOD, collide: false });
    blk(0.5, 3.4, 6.8, 0.3, 0.35, { y: gy + 3.9, rz: -0.08, color: WOOD, collide: false });
    blk(-1.5, 0.6, 6.0, 0.3, 0.35, { y: gy + 1.4, rz: 0.48, ry: 0.15, color: WOOD, collide: false });
    blk(0, -3.2, 0.35, 0.35, 5.5, { y: gy + 5.0, color: WOOD, collide: false });
    // Altar with candles, flagstones, rubble.
    blk(0, -4.4, 2.0, 1.2, 0.9, { color: DARK });
    blk(0, -4.4, 2.3, 0.15, 1.1, { y: gy + 0.9, color: STONE, collide: false });
    for (const lx of [-0.7, -0.35, 0.55]) {
      const [x, z] = at(lx, -4.4);
      blk(lx, -4.4, 0.09, 0.22, 0.09, { y: gy + 1.05, color: 0xe8dcc0, collide: false });
      this.glowSpots.push({ x, y: gy + 1.33, z, size: 0.45 });
    }
    const rng = mulberry32(1311);
    for (let i = 0; i < 22; i++) {
      const lx = (rng() - 0.5) * 6, lz = -5.2 + rng() * 10.6;
      blk(lx, lz, 0.9 + rng() * 0.8, 0.2, 0.8 + rng() * 0.8, { y: gy - 0.18, ry: rng() * 0.5, color: rng() < 0.5 ? 0x8a8478 : 0x7d786f, collide: false });
    }
    for (let i = 0; i < 12; i++) {
      const a = rng() * Math.PI * 2, d = 6 + rng() * 5;
      const lx = Math.sin(a) * d * 0.8, lz = Math.cos(a) * d;
      if (Math.abs(lx) < 2 && lz > 5) continue; // keep the doorway clear
      blk(lx, lz, 0.5 + rng() * 0.6, 0.3 + rng() * 0.4, 0.5 + rng() * 0.6, { y: gy - 0.15, ry: rng() * 3, rx: (rng() - 0.5) * 0.4, color: rng() < 0.5 ? STONE : DARK, collide: false });
    }
    // The fallen bell itself is batched with the scenery; Scenery reads this.
    const [bx, bz] = at(4.1, -9.4);
    this.chapelBell = { x: bx, z: bz, ry: yaw + 0.5 };
    this.addCircle(bx, bz, 1.25);
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

  // Castle Dunmarrow holds the pass north: a curtain wall with a gatehouse (its doors open with the
  // arena's when the Warden falls), a courtyard with the keep and a tower, and a rear gate onto the
  // Rimewold. Walls run on from the corner towers up into the ridge, so the castle is the only way through.
  _buildCastle() {
    const F = -326, B = -366, W = 30; // front wall line, rear wall line, half width
    const stone = 0x6f6a62, dark = 0x5c5850, cap = 0x7a756c;
    const gy = this.getHeight(0, -346);
    // Front and rear walls, each with a gate gap in the middle and battlements along the top.
    for (const [z, h] of [[F, 14], [B, 12]]) {
      for (const sx of [-1, 1]) {
        this.block(sx * 17.25, z, 25.5, h, 4, 0, { y: gy - 0.3, color: stone });
        for (let x = 6; x < 29; x += 3) this.block(sx * x, z, 1.4, 1.2, 4.2, 0, { y: gy - 0.3 + h, color: cap, collide: false });
      }
      this.block(0, z, 9.5, h - 9.5, 4, 0, { y: gy + 9.2, color: dark, collide: false }); // over the gate
    }
    // Side walls.
    for (const sx of [-1, 1]) {
      this.block(sx * W, (F + B) / 2, 3, 12, F - B, 0, { y: gy - 0.3, color: stone });
    }
    // Corner towers and the keep, as meshes Scenery bakes in; colliders by hand.
    const castle = new THREE.Group();
    const wallM = mat(stone), roofM = mat(0x3c4250), winM = mat(0xffc27a, { emissive: 0xff9a40, emissiveIntensity: 1.6 });
    for (const [x, z] of [[-W, F], [W, F], [-W, B], [W, B]]) {
      castle.add(mesh(cyl(4.4, 5, 20, 10), wallM, { x, y: 10, z }));
      castle.add(mesh(cone(5.6, 8, 10), roofM, { x, y: 24, z }));
      this.addCircle(x, z, 4.8);
    }
    // The keep (west) and a tall tower (east).
    castle.add(mesh(box(20, 22, 14), wallM, { x: -17, y: 11, z: -352 }));
    castle.add(mesh(cone(13, 10, 4), roofM, { x: -17, y: 27, z: -352, ry: Math.PI / 4 }));
    this.addBox(-17, -352, 10, 7);
    castle.add(mesh(cyl(4, 4.6, 30, 10), wallM, { x: 18, y: 15, z: -354 }));
    castle.add(mesh(cone(5.2, 12, 10), roofM, { x: 18, y: 36, z: -354 }));
    this.addCircle(18, -354, 4.7);
    castle.position.y = gy - 0.4;
    this.scene.add(castle);
    this.statics.push(castle);
    // Lit windows and the keep's door (kept out of the static bake so they glow).
    const lit = new THREE.Group();
    for (const [x, y, z] of [[-11, 16, -344.9], [-23, 16, -344.9], [-17, 9, -344.9], [-6.9, 12, -349], [-6.9, 17, -355], [18, 22, -349.8], [18, 14, -349.8]]) {
      lit.add(mesh(box(1, 1.8, 0.4), winM, { x, y, z, ry: x === -6.9 ? Math.PI / 2 : 0, shadow: false }));
    }
    lit.add(mesh(box(0.4, 4.2, 3), mat(0x2f251c), { x: -6.9, y: 2.1, z: -354 }));
    lit.position.y = gy - 0.4;
    this.scene.add(lit);
    // Courtyard: worn flagstones, a well, weapon racks, a fallen banner.
    const rng = mulberry32(912);
    for (let i = 0; i < 40; i++) {
      const x = -26 + rng() * 52, z = F - 4 - rng() * 34;
      if (x < -6 && z < -344 && z > -360) continue; // under the keep
      this.block(x, z, 1.4 + rng() * 1.6, 0.18, 1.4 + rng() * 1.6, rng() * 3, { y: gy - 0.12, color: 0x7d786f, collide: false });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.block(4 + Math.sin(a) * 1.5, -342 + Math.cos(a) * 1.5, 1.3, 1.1, 0.5, a, { y: gy - 0.3, color: 0x6c675f, collide: false });
    }
    this.addCircle(4, -342, 1.9);
    for (const [x, z] of [[24, -335], [24, -340]]) {
      this.block(x, z, 0.3, 2.2, 3, 0, { y: gy - 0.3, color: 0x4a3a2a });
    }
    // Walls on from the corner towers, climbing into the ridge on either side.
    for (const sx of [-1, 1]) {
      for (let x = 36; x <= 100; x += 4) {
        const z = F - 4 - (x - 36) * 0.02;
        const y = this.getHeight(sx * x, z);
        this.block(sx * x, z, 4.3, 10, 3, 0, { y: y - 1, color: stone });
        this.block(sx * x, z, 1.4, 1.2, 3.2, 0, { y: y + 9, color: cap, collide: false });
      }
      // Past the built wall the ridge itself stops you (an invisible line along its crest).
      this.addBox(sx * 220, RIME.ridgeZ, 120, 2.5);
    }
    // The gatehouse doors (open with the arena's north gate) and the rear archway's lintel.
    const doors = P.buildGateDoors(8.6, 9);
    doors.group.position.set(0, gy - 0.1, F + 1.4);
    this.scene.add(doors.group);
    this.castleDoors = { ...doors, collider: this.addBox(0, F, 4.6, 2.2, 0, true), open: 0, opening: false };
    this.castleDoor = { x: 0, z: F + 4 };
  }

  // The Rimewold's set pieces: the frozen tarn's ice, crystal clusters, Ormund's hut, a ruined frost
  // chapel, frozen statues along the road and the Hall of the Winter Lantern.
  _buildRimewold() {
    const rng = mulberry32(4411);
    // The tarn: a sheet of ice on the levelled ground, ragged at the shore, with dark cracks.
    const ty = this.getHeight(TARN.x, TARN.z);
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r = TARN.r * (0.9 + 0.1 * this.noise(Math.cos(a) * 2, Math.sin(a) * 2));
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    const iceGeo = new THREE.ShapeGeometry(new THREE.Shape(pts));
    iceGeo.rotateX(-Math.PI / 2);
    const ice = new THREE.Mesh(iceGeo, new THREE.MeshStandardMaterial({ color: 0xbcd9e8, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.86, flatShading: true }));
    ice.position.set(TARN.x, ty + 0.05, TARN.z);
    ice.receiveShadow = true;
    ice.renderOrder = 1;
    this.scene.add(ice);
    this.tarnIce = ice;
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * TARN.r * 0.8;
      this.block(TARN.x + Math.sin(a) * d, TARN.z + Math.cos(a) * d, 0.12, 0.02, 2 + rng() * 5, rng() * 3, { y: ty + 0.06, color: 0x5f7684, collide: false });
    }
    // Ormund's ice-fishing hole and his hut on the shore.
    const hut = ZONES.hut;
    const hy = this.getHeight(hut.x, hut.z);
    const wood = 0x5a4632, roofC = 0x3b2f25;
    this.block(hut.x - 2.6, hut.z, 0.4, 3, 5, 0, { y: hy - 0.3, color: wood });
    this.block(hut.x + 2.6, hut.z, 0.4, 3, 5, 0, { y: hy - 0.3, color: wood });
    this.block(hut.x, hut.z - 2.5, 5.6, 3, 0.4, 0, { y: hy - 0.3, color: wood });
    this.block(hut.x - 1.9, hut.z + 2.5, 1.8, 3, 0.4, 0, { y: hy - 0.3, color: wood });
    this.block(hut.x + 1.9, hut.z + 2.5, 1.8, 3, 0.4, 0, { y: hy - 0.3, color: wood });
    for (const sx of [-1, 1]) this.block(hut.x + sx * 1.5, hut.z, 3.6, 0.3, 6, 0, { y: hy + 3.5, rz: sx * -0.55, color: roofC, collide: false });
    this.block(hut.x, hut.z, 0.4, 0.4, 6.2, 0, { y: hy + 4.4, color: 0xeef2f4, collide: false });
    this.block(TARN.x - 20, TARN.z + 22, 1.6, 0.06, 1.6, 0.4, { y: ty + 0.04, color: 0x1c2a32, collide: false });
    // Crystal clusters: tall shards of blue ice that glow faintly (one instanced mesh for all).
    const shards = [];
    const cluster = (cx, cz, n, size) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, d = i ? 0.8 + rng() * 2.2 * size : 0;
        const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
        const h = (i ? 1.2 + rng() * 2 : 3 + rng() * 1.5) * size;
        shards.push({ x, z, h, w: h * (0.18 + rng() * 0.08), rx: (rng() - 0.5) * 0.6, rz: (rng() - 0.5) * 0.6, ry: rng() * 3 });
        if (!i) this.addCircle(cx, cz, 0.7 * size);
      }
    };
    for (const [x, z, n, s] of [[40, -392, 5, 1], [-36, -404, 6, 1.2], [96, -430, 7, 1.4], [-118, -470, 6, 1.3], [62, -520, 8, 1.6], [-70, -538, 7, 1.5], [26, -470, 4, 0.9], [-8, -500, 3, 0.8], [120, -480, 6, 1.2], [-104, -510, 5, 1.1], [-28, -592, 6, 1.5], [36, -596, 6, 1.4]]) {
      cluster(x, z, n, s);
    }
    const shardGeo = new THREE.OctahedronGeometry(1, 0);
    shardGeo.scale(1, 1, 0.7);
    const shardMat = new THREE.MeshStandardMaterial({ color: 0xa8dcff, emissive: 0x2f8fd8, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });
    const im = new THREE.InstancedMesh(shardGeo, shardMat, shards.length);
    const dummy = new THREE.Object3D();
    shards.forEach((sh, i) => {
      dummy.position.set(sh.x, this.getHeight(sh.x, sh.z) + sh.h * 0.45, sh.z);
      dummy.rotation.set(sh.rx, sh.ry, sh.rz);
      dummy.scale.set(sh.w, sh.h * 0.6, sh.w);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.castShadow = true;
    this.scene.add(im);
    this.crystals = { mesh: im, mat: shardMat, list: shards };
    // The frost chapel: a ruined nave on the east rise, its rite lying inside.
    const fc = { x: 108, z: -506 };
    const fy = this.getHeight(fc.x, fc.z);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const h = 4 + Math.sin(i * 2.1 + sx) * 1.6;
        this.block(fc.x + sx * 5, fc.z - 7 + i * 4.6, 1, h, 4.4, 0, { y: fy - 0.5, color: 0x8c96a0 });
      }
    }
    this.block(fc.x, fc.z - 9.5, 11, 6.5, 1, 0, { y: fy - 0.5, color: 0x8c96a0 });
    this.block(fc.x, fc.z - 9.5, 3, 2.4, 1.2, 0, { y: fy + 5.8, color: 0x9aa4ae, collide: false });
    for (let i = 0; i < 10; i++) this.block(fc.x + (rng() - 0.5) * 12, fc.z + (rng() - 0.5) * 18, 0.9 + rng(), 0.4 + rng() * 0.5, 0.9 + rng(), rng() * 3, { color: 0x7f8992, collide: false });
    // Frozen statues of the old watch along the road north, rimed white.
    for (const [x, z, ry] of [[-10, -414, 0.4], [16, -456, -0.3], [-10, -506, 0.3], [12, -520, -0.4]]) {
      const st = P.buildStatue();
      st.traverse((o) => { if (o.isMesh) o.material = mat(0xc8d4dc); });
      this._static(st, x, z, ry);
      this.addCircle(x, z, 1.0);
    }
    // The Hall of the Winter Lantern: a ring of ice-stone pillars open to the south, an altar, and
    // the great lantern hanging over it (its light dims while Saelith carries the flame).
    const hy2 = this.getHeight(HALL.x, HALL.z);
    const segs = 18;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.32) continue; // the way in, from the south
      const x = HALL.x + Math.sin(a) * HALL.r, z = HALL.z + Math.cos(a) * HALL.r;
      const h = 7 + Math.sin(i * 2.7) * 2;
      this.block(x, z, 2.2, h, 2.2, a, { y: hy2 - 0.4, color: 0x9fb2c0 });
      this.block(x, z, 2.8, 0.6, 2.8, a, { y: hy2 - 0.4 + h, color: 0xc8dae6, collide: false });
    }
    for (let i = 0; i < 60; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (HALL.r - 3);
      this.block(HALL.x + Math.sin(a) * d, HALL.z + Math.cos(a) * d, 1.6 + rng() * 1.8, 0.16, 1.6 + rng() * 1.8, rng() * 3, { y: hy2 - 0.1, color: 0xa9bfcc, collide: false });
    }
    this.block(HALL.x, HALL.z - 20, 4, 1.2, 2.4, 0, { y: hy2 - 0.3, color: 0x8798a6 });
    const lantern = new THREE.Group();
    const lm = mat(0x2f3338, { metalness: 0.6, roughness: 0.4 });
    const flameM = mat(0xcfefff, { emissive: 0x6fc8ff, emissiveIntensity: 2.6 });
    lantern.add(mesh(box(0.2, 7, 0.2), lm, { y: 9.5 }));
    lantern.add(mesh(box(1.6, 0.25, 1.6), lm, { y: 6 }));
    lantern.add(mesh(box(1.6, 0.25, 1.6), lm, { y: 3.4 }));
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) lantern.add(mesh(box(0.14, 2.6, 0.14), lm, { x, y: 4.7, z }));
    lantern.add(mesh(box(0.9, 1.4, 0.9), flameM, { y: 4.7, shadow: false }));
    const lglow = glowSprite(0x9fdcff, 9, 0.6);
    lglow.position.y = 4.7;
    lantern.add(lglow);
    lantern.position.set(HALL.x, hy2 + 0.8, HALL.z - 20);
    this.scene.add(lantern);
    const llight = new THREE.PointLight(0x9fdcff, 30, 30, 2);
    llight.position.set(HALL.x, hy2 + 5.5, HALL.z - 20);
    this.scene.add(llight);
    this.hallLantern = { group: lantern, flame: flameM, glow: lglow, light: llight, lit: 1 };
  }

  // ---------- vegetation ----------

  // Forests, rocks, grass, flowers, lake plants and road dressing: see world/Scenery.js.
  _buildVegetation() {
    this.scenery = new Scenery(this);
  }

  _buildBlocks() {
    const im = new THREE.InstancedMesh(plainBox(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.92 }), this.blocks.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const rng = mulberry32(3);
    this.blocks.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(b.rx, b.ry, b.rz, 'YXZ');
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, color.setHex(b.color).offsetHSL(0, 0, (rng() - 0.5) * 0.06));
    });
    im.castShadow = im.receiveShadow = true;
    this.scene.add(im);
  }

  // ---------- collision ----------

  _insert(c, x, z, r) {
    for (let gx = Math.floor((x - r) / GRID); gx <= Math.floor((x + r) / GRID); gx++) {
      for (let gz = Math.floor((z - r) / GRID); gz <= Math.floor((z + r) / GRID); gz++) {
        const key = gx + ',' + gz;
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(c);
      }
    }
  }

  _indexColliders() {
    for (const c of this.circles) this._insert(c, c.x, c.z, c.r);
    for (const b of this.boxes) this._insert(b, b.x, b.z, Math.hypot(b.hx, b.hz));
    this.indexed = true;
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
    if (this.clampToPlay(pos)) hit = true;
    return hit;
  }

  // The walkable area: the Vale's circle plus the lobes beyond it (the Rimewold to the north and
  // the outer regions); the sea stops you once it is too deep to wade. A point outside them all goes
  // back to whichever edge is nearest. True if it moved.
  clampToPlay(pos) {
    const PR = WORLD.playRadius;
    const r = Math.hypot(pos.x, pos.z);
    const coast = LOBES.coast;
    if (pos.x < SEA.walkX && this.lobeDist(coast, pos.x, pos.z) < coast.r + 4) {
      pos.x = SEA.walkX;
      return true;
    }
    if (r <= PR) return false;
    let best = r - PR, fix = () => { pos.x *= PR / r; pos.z *= PR / r; };
    const dl = Math.hypot(pos.x - RIME.x, pos.z - RIME.z);
    if (dl <= RIME.r) return false;
    if (dl - RIME.r < best) {
      best = dl - RIME.r;
      fix = () => { pos.x = RIME.x + ((pos.x - RIME.x) / dl) * RIME.r; pos.z = RIME.z + ((pos.z - RIME.z) / dl) * RIME.r; };
    }
    for (const k in LOBES) {
      const L = LOBES[k];
      const d = this.lobeDist(L, pos.x, pos.z);
      if (d <= L.r) return false;
      if (d - L.r < best) {
        best = d - L.r;
        fix = L.band && pos.x < L.x
          ? () => { pos.z = L.z + Math.sign(pos.z - L.z) * L.r; }
          : () => { pos.x = L.x + ((pos.x - L.x) / d) * L.r; pos.z = L.z + ((pos.z - L.z) / d) * L.r; };
      }
    }
    fix();
    return true;
  }

  // Signed distance to the walkable area's edge: negative inside (for the map's vignette).
  playEdgeDist(x, z) {
    let d = Math.min(Math.hypot(x, z) - WORLD.playRadius, Math.hypot(x - RIME.x, z - RIME.z) - RIME.r);
    for (const k in LOBES) d = Math.min(d, this.lobeDist(LOBES[k], x, z) - LOBES[k].r);
    if (x < SEA.walkX) d = Math.max(d, SEA.walkX - x);
    return d;
  }

  // Inside the walkable area (with `pad` metres to spare)?
  inPlay(x, z, pad = 0) {
    if (Math.hypot(x, z) < WORLD.playRadius - pad || Math.hypot(x - RIME.x, z - RIME.z) < RIME.r - pad) return true;
    for (const k in LOBES) {
      if (this.lobeDist(LOBES[k], x, z) < LOBES[k].r - pad) return k !== 'coast' || x > SEA.walkX + pad;
    }
    return false;
  }

  // ---------- per-frame ----------

  update(dt, time) {
    this.fogGate.uniforms.uTime.value = time;
    const ps = this.game.particles;
    this._updateEnvironment(dt, time);
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
    for (const gd of [this.gateDoors, this.castleDoors]) {
      if (gd.opening && gd.open < 1) {
        gd.open = Math.min(1, gd.open + dt * 0.25);
        const a = (1 - Math.pow(1 - gd.open, 3)) * 1.7;
        gd.left.rotation.y = -a;
        gd.right.rotation.y = a;
      }
    }
    // The ice crystals breathe a little light; the hall's lantern flickers cold.
    updateBiomes(this, dt, time);
    if (this.crystals) this.crystals.mat.emissiveIntensity = 0.8 + Math.sin(time * 0.9) * 0.18;
    const hl = this.hallLantern;
    if (hl) {
      const f = hl.lit * (0.9 + Math.sin(time * 5.3) * 0.06 + Math.sin(time * 11.1) * 0.04);
      hl.flame.emissiveIntensity = 0.3 + 2.4 * f;
      hl.glow.material.opacity = 0.6 * f;
      hl.light.intensity = 30 * f;
    }
  }

  // Wind, sky, weather, water, scenery culling and ambient life, all keyed off the camera.
  _updateEnvironment(dt, time) {
    const g = this.game;
    const cam = g.camera.position;
    const sky = g.sky;
    const scale = g.particles.material.uniforms.uScale.value; // px per metre at 1 m, kept by Game.resize
    WIND.uTime.value = time;
    sky.tick(dt, cam);
    this.weather.update(dt, time, cam);
    this.weather.setViewportScale(scale);
    this.water.update(time, sky, this.weather.rain);
    for (const p of this.pools) p.update(time, sky, this.weather.rain);
    this.scenery.update(cam, sky.night, scale);
    this.ambient.update(dt, time, cam, { night: sky.night, dusk: sky.dusk, weather: this.weather.name, scale });
  }

  // ---------- environment API ----------

  // 'clear' | 'ashfall' | 'rain' | 'mist'. Blends over a few seconds unless `instant`.
  setWeather(name, instant = false) {
    this.weather.set(name, instant);
  }

  getWeather() {
    return this.weather.name;
  }

  get weatherNames() {
    return Object.keys(WEATHER);
  }

  // The arena's north gate and Castle Dunmarrow's gatehouse open and shut together (with the Warden).
  closeGate() {
    for (const gd of [this.gateDoors, this.castleDoors]) {
      gd.opening = false;
      gd.open = 0;
      gd.collider.enabled = true;
      gd.left.rotation.y = 0;
      gd.right.rotation.y = 0;
    }
  }

  openGate(instant = false) {
    for (const gd of [this.gateDoors, this.castleDoors]) {
      gd.opening = true;
      gd.collider.enabled = false;
      if (instant) {
        gd.open = 1;
        gd.left.rotation.y = -1.7;
        gd.right.rotation.y = 1.7;
      }
    }
  }
}
