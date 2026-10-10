// The outer regions' set pieces, surfaces and scenery (layout in data/biomes.js):
//   The Cinderfall Wastes: lava pools and the lava river, the volcano, the Sunken Forge, the Obsidian
//     Field, the basalt ring of Ashmaw's Caldera.
//   The Drowned Coast: the sea, Saltmarrow's ruined houses and pier, the Broken Lighthouse, the
//     Captain's Wreck and the masts of older wrecks offshore.
//   The Glowcap Hollows: giant glowing mushrooms, the Myconid's Ring, the Heartcap Grove.
// buildBiomes(world) runs with World's other set pieces; biomeScenery(scenery) adds the batched
// plants and rocks; updateBiomes(world, dt, time) animates lava, sea, glow, smoke and the lighthouse.
import * as THREE from '../lib/three.js';
import { mulberry32, smoothstep } from '../core/math.js';
import { LOBES, SEA, LAVA, VOLCANO, CALDERA, WRECK, GROVE, SANCTUM, SUMMIT, OASIS, BELLYARD, GREAT_ONES, BIOME_ZONES as Z } from '../data/biomes.js';
import { WORLD } from '../data/world.js';
import { mat, mesh, box, cyl, cone, glowSprite, glowTexture } from '../models/kit.js';
import * as P from '../models/props.js';
import { Water } from './Water.js';

// ---------- surfaces ----------

const LAVA_VERT = /* glsl */ `
attribute float aFlow;
varying vec3 vW;
varying float vFlow;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vFlow = aFlow;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const LAVA_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vW;
varying float vFlow;
#include <common>
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  // Blocky cells of crust drifting on bright melt; the river's cells run downstream.
  vec2 p = floor(vW.xz * 0.9) / 0.9 * 0.16;
  p.y -= uTime * 0.06 * vFlow;
  float n = vnoise(p + vec2(uTime * 0.02, uTime * 0.015)) * 0.65 + vnoise(p * 2.6 - uTime * 0.05) * 0.35;
  float crust = smoothstep(0.52, 0.7, n);
  float pulse = 0.85 + 0.15 * sin(uTime * 1.7 + vW.x * 0.2 + vW.z * 0.13);
  vec3 hot = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.78, 0.28), smoothstep(0.15, 0.45, n));
  vec3 col = mix(hot * 1.5 * pulse, vec3(0.16, 0.08, 0.06), crust * 0.9);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function lavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: LAVA_VERT,
    fragmentShader: LAVA_FRAG,
    fog: true,
  });
}

function withFlow(geo, flow) {
  const n = geo.getAttribute('position').count;
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(new Float32Array(n).fill(flow), 1));
  return geo;
}

// A faceted disc of lava at `y`.
function lavaDisc(m, x, y, z, r) {
  const geo = withFlow(new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2), 0);
  const d = new THREE.Mesh(geo, m);
  d.position.set(x, y, z);
  return d;
}

// The river: a ribbon down its polyline, each cross-section at the river's own level there.
function lavaRiver(world, m) {
  const pts = LAVA.river;
  const pos = [], idx = [];
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    const steps = Math.ceil(len / 2.5);
    for (let s = i ? 1 : 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + (bx - ax) * t, cz = az + (bz - az) * t;
      const y = world.lavaLevelAt(cx, cz);
      const w = LAVA.riverW * 1.25;
      pos.push(cx + nx * w, y, cz + nz * w, cx - nx * w, y, cz - nz * w);
      if (k) idx.push(k * 2 - 2, k * 2 - 1, k * 2, k * 2 - 1, k * 2 + 1, k * 2);
      k++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  withFlow(geo, 1);
  geo.computeBoundingSphere();
  return new THREE.Mesh(geo, m);
}

// ---------- build ----------

export function buildBiomes(w) {
  const B = (w.biomes = { glows: [], smoke: [], beams: null });
  const scene = w.scene;

  // The ridge along each region's rim stops you everywhere but the pass.
  for (const k in LOBES) {
    const L = LOBES[k];
    const steps = Math.ceil((2 * Math.PI * L.r) / 6);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = L.x + Math.sin(a) * L.r, z = L.z + Math.cos(a) * L.r;
      if (L.band && x < L.x) continue;
      if (Math.hypot(x, z) > WORLD.playRadius + 4) continue;
      if (Math.hypot(x - L.gate[0], z - L.gate[1]) < L.gap + 3) continue;
      w.addCircle(x, z, 4.5);
    }
  }

  // Lava: pools, the river, and the volcano's crater.
  B.lavaMat = lavaMaterial();
  for (const p of w.lavaPools) {
    scene.add(lavaDisc(B.lavaMat, p.x, p.level, p.z, p.r * 1.02));
    const g = glowSprite(0xff7a2a, p.r * 2.6, 0.35);
    g.position.set(p.x, p.level + 2, p.z);
    scene.add(g);
    B.glows.push(g);
  }
  scene.add(lavaRiver(w, B.lavaMat));
  const vy = w.getHeight(VOLCANO.x, VOLCANO.z);
  scene.add(lavaDisc(B.lavaMat, VOLCANO.x, vy + 3, VOLCANO.z, VOLCANO.crater * 0.8));
  const vg = glowSprite(0xff6a20, 90, 0.5);
  vg.position.set(VOLCANO.x, vy + 16, VOLCANO.z);
  scene.add(vg);
  B.volcanoGlow = vg;
  B.volcanoTop = new THREE.Vector3(VOLCANO.x, vy + 6, VOLCANO.z);
  // A slow column of smoke: soft grey billboards rising and recycling.
  const smokeMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x3a3634, transparent: true, opacity: 0.5, depthWrite: false, fog: true });
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(smokeMat.clone());
    s.userData.t = i / 16;
    scene.add(s);
    B.smoke.push(s);
  }

  // The sea: the open water off the coast, out past the edge of the land.
  B.sea = new Water(scene, { x: -820, z: LOBES.coast.z, r: 360 }, SEA.level, (x, z) => SEA.level - w.getHeight(Math.max(x, -WORLD.size / 2 + 1), z), { step: 7, amp: 0.3 });
  B.sea.uniforms.uShallow.value.setHex(0x5fa6a0);
  B.sea.uniforms.uDeep.value.setHex(0x1f4c66);
  B.sea.uniforms.uFoam.value.setHex(0xf4f0e2);

  // The oasis: a small pool of clear green water in the dunes.
  B.oasis = new Water(scene, { x: OASIS.x, z: OASIS.z, r: OASIS.r * 1.2 }, w.oasisLevel, (x, z) => w.oasisLevel - w.getHeight(x, z));
  B.oasis.uniforms.uShallow.value.setHex(0x6fbfa8);
  B.oasis.uniforms.uDeep.value.setHex(0x2a6a70);

  // One light for lightning flashes (kept in the scene at zero so the light count never changes).
  B.flashLight = new THREE.PointLight(0xdfe8ff, 0, 260, 1.2);
  scene.add(B.flashLight);
  B.flashT = 0;
  B.flash = (x, y, z) => {
    B.flashLight.position.set(x, y, z);
    B.flashT = 0.3;
  };
  B.stormT = 4;

  cinder(w, B);
  coast(w, B);
  glowcap(w, B);
  dunes(w, B);
  storm(w, B);
  bell(w, B);
}

// ---------- the Hollow Bell ----------

function bell(w, B) {
  const rng = mulberry32(4404);
  const STONE = 0x6a6660, BRONZE = 0x7a6a40, DARK = 0x4a4650;
  // The mist across the pass: like the arena's, but it holds until the five great ones are dead.
  const L = LOBES.bell, gx = L.gate[0], gz = L.gate[1];
  const into = Math.atan2(L.x - gx, L.z - gz);
  const fog = w._buildFogGate(gx, gz);
  fog.mesh.rotation.y = into;
  fog.mesh.scale.x = 2.4;
  fog.glow.scale.multiplyScalar(1.8);
  fog.collider.enabled = false;
  fog.wall = w.addBox(gx, gz, 7, 0.8, -into + Math.PI / 2, true);
  B.bellGate = fog;
  for (const sd of [-1, 1]) {
    const x = gx + Math.cos(into) * sd * 8, z = gz - Math.sin(into) * sd * 8;
    w.block(x, z, 2.4, 12, 2.4, into, { color: STONE });
    w.block(x, z, 3.0, 1.0, 3.0, into, { y: w.getHeight(x, z) + 11.4, color: BRONZE, collide: false });
  }
  // The yard: bell-frames standing round it, open towards the pass, and fallen bells everywhere.
  const Y = BELLYARD, yy = w.getHeight(Y.x, Y.z);
  const open = Math.atan2(gx - Y.x, gz - Y.z);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - open), Math.cos(a - open))) < 0.4) continue;
    const x = Y.x + Math.sin(a) * (Y.r + 2), z = Y.z + Math.cos(a) * (Y.r + 2);
    const cs = Math.cos(a), sn = Math.sin(a);
    for (const sd of [-1, 1]) w.block(x + cs * sd * 2, z - sn * sd * 2, 0.8, 7, 0.8, a, { y: yy - 0.4, color: DARK });
    w.block(x, z, 5, 0.8, 0.8, a, { y: yy + 6.4, color: DARK, collide: false });
    B.yardBells = B.yardBells ?? [];
    B.yardBells.push({ x, z, y: yy + 3.6, ry: a });
  }
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (Y.r - 3);
    w.block(Y.x + Math.sin(a) * d, Y.z + Math.cos(a) * d, 1.6 + rng() * 1.6, 0.16, 1.6 + rng() * 1.6, rng() * 3, { y: yy - 0.1, color: 0x7a7480, collide: false });
  }
}

// The Bell's mist lifts once every great one is dead; it shimmers until then.
export function bellGateOpen(flags) {
  return GREAT_ONES.every(([f]) => flags?.[f]);
}

// The storm itself is a combatant of sorts: its bolts strike players and beasts alike.
const STORM = { team: 'storm', pos: new THREE.Vector3(), alive: true, yaw: 0, onParried() {} };

// ---------- the Cinderfall Wastes ----------

function cinder(w, B) {
  const rng = mulberry32(6601);
  const BASALT = 0x2f2c31, DARK = 0x3e3a3a, RUST = 0x5a3a2a;
  // The Cinder Pass: a broken arch over the road where it comes through the ridge.
  for (const s of [-1, 1]) w.block(s * 7.5, 386, 2.2, 9 + s, 2.6, 0, { color: BASALT });
  w.block(-3.5, 386, 6.5, 1.2, 2.6, 0, { y: w.getHeight(-3.5, 386) + 8.6, rz: 0.08, color: DARK, collide: false });
  w.block(5, 389, 3, 0.9, 2.2, 0.7, { color: DARK, collide: false });
  // Emberwatch: the stumps of an old watch post round the shrine.
  const ew = Z.emberwatch;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    if (Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) < 0) continue;
    w.block(ew.x + Math.sin(a) * 8, ew.z + Math.cos(a) * 8, 1.4, 1.5 + rng() * 3, 1.4, a, { color: DARK });
  }

  // The Sunken Forge: a roofless hall of dark stone, its great chimney still standing.
  const fy = w.getHeight(-82, 538) - 0.3;
  const STONE = 0x4a4440;
  const wall = (x0, z0, x1, z1, gapAt = null) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0);
    const n = Math.ceil(len / 3);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (gapAt && Math.hypot(x - gapAt[0], z - gapAt[1]) < 2.6) continue;
      const h = 3 + Math.abs(Math.sin(i * 1.9 + x0)) * 3.5;
      w.block(x, z, len / n + 0.05, h, 1.1, ry, { y: fy, color: i % 3 ? STONE : DARK });
    }
  };
  wall(-94, 526, -70, 526, [-82, 526]);
  wall(-94, 550, -70, 550);
  wall(-94, 526, -94, 550);
  wall(-70, 526, -70, 550, [-70, 541]);
  w.block(-91.5, 528.5, 3.2, 15, 3.2, 0, { y: fy, color: BASALT }); // the chimney
  w.block(-91.5, 528.5, 3.8, 0.8, 3.8, 0, { y: fy + 15, color: DARK, collide: false });
  w.block(-87, 528.6, 4.5, 1.6, 2.4, 0, { y: fy, color: DARK }); // the hearth's back
  w.block(-91, 546, 1.6, 0.9, 0.8, 0.2, { y: fy + 0.3, color: 0x2f3036 }); // the cold anvil
  w.block(-91, 546, 0.8, 0.4, 0.5, 0.2, { y: fy, color: 0x2f3036 });
  w.block(-77, 547.5, 4, 1.2, 1.2, 0, { y: fy, color: 0x3a3330 }); // a quenching trough
  for (let i = 0; i < 4; i++) w.block(-82 + (i - 1.5) * 5, 538, 0.5, 0.5, 24, 0, { y: fy + 0.15 + (i % 2) * 0.4, rx: 0.08, color: 0x2a221c, collide: false }); // fallen beams
  for (let i = 0; i < 26; i++) {
    const x = -93 + rng() * 22, z = 527 + rng() * 22;
    w.block(x, z, 1.2 + rng(), 0.16, 1.2 + rng(), rng() * 3, { y: fy + 0.18, color: 0x55504a, collide: false });
  }
  w.glowSpots.push({ x: -87, y: fy + 1.4, z: 530.4, size: 1.4 });

  // The Obsidian Field: tall shards of black glass (instanced, with a glassy sheen).
  const shards = [];
  for (let i = 0, tries = 0; shards.length < 46 && tries < 900; tries++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 34;
    const x = Z.obsidian.x + Math.sin(a) * d, z = Z.obsidian.z + Math.cos(a) * d;
    if (Math.hypot(x - 88, z - 512) < 5 || w.lavaDepth(x, z) > 0 || w.roadDistance(x, z) < 6) continue;
    const h = 1.2 + Math.pow(rng(), 1.6) * 6;
    shards.push({ x, z, h, wd: h * (0.2 + rng() * 0.1), rx: (rng() - 0.5) * 0.7, rz: (rng() - 0.5) * 0.7, ry: rng() * 3 });
    if (h > 2.5) w.addCircle(x, z, h * 0.16);
    i++;
  }
  // A few in the Caldera's approach and round the pools too.
  for (const p of LAVA.pools) {
    for (let i = 0; i < 4; i++) {
      const a = rng() * Math.PI * 2, d = p.r + 2 + rng() * 5;
      const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      if (w.roadDistance(x, z) < 6 || w.lavaDepth(x, z) > 0) continue;
      const h = 1 + rng() * 3;
      shards.push({ x, z, h, wd: h * 0.25, rx: (rng() - 0.5) * 0.6, rz: (rng() - 0.5) * 0.6, ry: rng() * 3 });
    }
  }
  const geo = new THREE.OctahedronGeometry(1, 0);
  geo.scale(1, 1, 0.65);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a1622, roughness: 0.12, metalness: 0.5, flatShading: true, emissive: 0x2a0e30, emissiveIntensity: 0.25 });
  const im = new THREE.InstancedMesh(geo, glass, shards.length);
  const dummy = new THREE.Object3D();
  shards.forEach((s, i) => {
    dummy.position.set(s.x, w.getHeight(s.x, s.z) + s.h * 0.4, s.z);
    dummy.rotation.set(s.rx, s.ry, s.rz);
    dummy.scale.set(s.wd, s.h * 0.6, s.wd);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  });
  im.castShadow = true;
  w.scene.add(im);

  // Ashmaw's Caldera: a ring of basalt columns open to the north, veins of lava in its floor.
  const C = CALDERA;
  const cy = w.getHeight(C.x, C.z);
  const segs = 30;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.3) continue; // the way in
    const r = C.r + 1 + rng() * 1.5;
    const x = C.x + Math.sin(a) * r, z = C.z + Math.cos(a) * r;
    const h = 7 + rng() * 8;
    w.block(x, z, 2.6, h, 2.6, a + rng() * 0.3, { y: cy - 0.5, color: rng() < 0.5 ? BASALT : 0x37333a });
    if (rng() < 0.4) w.block(x + (rng() - 0.5) * 2, z + (rng() - 0.5) * 2, 1.8, h * 0.6, 1.8, a, { y: cy - 0.5, color: BASALT });
  }
  for (const s of [-1, 1]) w.block(C.x + s * 6, C.z - C.r - 1.5, 3.2, 16, 3.2, 0, { y: cy - 0.5, color: 0x26232a });
  for (let i = 0; i < 9; i++) {
    const a0 = rng() * Math.PI * 2, len = 6 + rng() * 10, d = 4 + rng() * (C.r - 12);
    const x = C.x + Math.sin(a0) * d, z = C.z + Math.cos(a0) * d;
    const vein = new THREE.Mesh(withFlow(new THREE.PlaneGeometry(0.5 + rng() * 0.5, len).rotateX(-Math.PI / 2), 0), B.lavaMat);
    vein.position.set(x, w.getHeight(x, z) + 0.06, z);
    vein.rotation.y = rng() * Math.PI;
    w.scene.add(vein);
  }
  // The bones of an older drake on the approach: a skull, a spine and a cage of ribs.
  const bx = 22, bz = 592, BONE = 0xd8cfb8;
  const by = w.getHeight(bx, bz);
  for (let i = 0; i < 9; i++) {
    const z = bz - 8 + i * 2;
    w.block(bx, z, 0.8, 0.7, 1.4, 0, { y: by - 0.1, color: BONE, collide: false });
    if (i > 1 && i < 8) for (const s of [-1, 1]) w.block(bx + s * 2.2, z, 0.35, 4.2 - Math.abs(i - 4.5) * 0.5, 0.35, 0, { y: by - 0.2, rz: -s * 0.55, color: BONE, collide: false });
  }
  w.block(bx, bz - 11.5, 2.4, 1.6, 3.2, 0, { y: by - 0.2, color: BONE });
  w.block(bx, bz - 13.4, 1.6, 0.6, 1.6, 0, { y: by + 0.2, color: 0xc8bfa8, collide: false });
  w.addBox(bx, bz, 2.6, 8);
}

// ---------- the Drowned Coast ----------

function coast(w, B) {
  const rng = mulberry32(7703);
  const WOOD = 0x6b5a46, DRIFT = 0x8f7f68, STONE = 0x8b8476, SLATE = 0x4b5a66, THATCH = 0x8a7448;
  // Tidehold: sea-worn pillars round the shrine.
  const th = Z.tidehold;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.9;
    w.block(th.x + Math.sin(a) * 7.5, th.z + Math.cos(a) * 7.5, 1.2, 2 + rng() * 3.5, 1.2, a, { color: 0x9a9384 });
  }

  // Saltmarrow: a handful of roofless or half-roofed fishers' houses round a well.
  const sm = Z.saltmarrow;
  const house = (ox, oz, yaw, roof) => {
    const cx = sm.x + ox, cz = sm.z + oz;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const at = (lx, lz) => [cx + lx * cs + lz * sn, cz - lx * sn + lz * cs];
    const gy = w.getHeight(cx, cz) - 0.3;
    const blk = (lx, lz, sx, sy, sz, o = {}) => {
      const [x, z] = at(lx, lz);
      w.block(x, z, sx, sy, sz, yaw + (o.ry ?? 0), { ...o, y: o.y ?? gy });
    };
    blk(0, -2.6, 6.4, 3.2, 0.5, { color: STONE }); // back wall
    blk(-3, 0, 0.5, 3.2, 5.2, { color: STONE });
    blk(3, 0, 0.5, 2.2 + rng(), 5.2, { color: STONE });
    blk(-2.1, 2.6, 2.2, 3.2, 0.5, { color: WOOD }); // front, with a door
    blk(2.1, 2.6, 2.2, 3.2, 0.5, { color: WOOD });
    blk(0, 2.6, 2.0, 0.6, 0.5, { y: gy + 2.9, color: WOOD, collide: false });
    if (roof) {
      blk(0, -1.4, 7, 0.25, 3.2, { y: gy + 3.9, rx: 0.5, color: roof, collide: false });
      if (rng() < 0.6) blk(0, 1.4, 7, 0.25, 3.2, { y: gy + 3.9, rx: -0.5, color: roof, collide: false });
      else blk(0.5, 1.6, 6, 0.25, 3, { y: gy + 0.5, rx: -0.2, rz: 0.15, color: roof, collide: false }); // fallen in
    }
  };
  house(-4, 13, 0, THATCH); // the cutlass lies in this one
  house(-16, -6, 0.3, SLATE);
  house(14, 12, -0.4, THATCH);
  house(-17, 15, 0.5, null);
  house(19, -9, -1.2, SLATE);
  // The well.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    w.block(sm.x + 2 + Math.sin(a) * 1.4, sm.z + 2 + Math.cos(a) * 1.4, 1.2, 1.0, 0.45, a, { color: STONE, collide: false });
  }
  w.addCircle(sm.x + 2, sm.z + 2, 1.8);
  // Drying racks with their nets still on them.
  for (const [ox, oz] of [[-8, -16], [6, 22]]) {
    for (const s of [-1, 1]) w.block(sm.x + ox + s * 2, sm.z + oz, 0.25, 2.4, 0.25, 0, { color: WOOD });
    w.block(sm.x + ox, sm.z + oz, 4.4, 0.15, 0.15, 0, { y: w.getHeight(sm.x + ox, sm.z + oz) + 2.1, color: WOOD, collide: false });
    w.block(sm.x + ox, sm.z + oz, 3.8, 1.6, 0.06, 0, { y: w.getHeight(sm.x + ox, sm.z + oz) + 0.5, color: 0x8a7a5a, collide: false });
  }
  // The pier, running out into the sea on its posts.
  for (let x = -568; x > -612; x -= 3) {
    const g = w.getHeight(x, 112);
    const deck = Math.max(g + 0.25, SEA.level + 1.1);
    if (x > -606 || rng() < 0.5) w.block(x, 112, 3.1, 0.3, 3.4, (rng() - 0.5) * 0.06, { y: deck, color: x < -598 ? 0x5a4a38 : DRIFT, collide: false });
    for (const s of [-1, 1]) {
      w.block(x, 112 + s * 1.6, 0.4, deck - g + 1.4, 0.4, 0, { y: g - 0.4, color: 0x4a3c2e, collide: false });
      w.addCircle(x, 112 + s * 1.6, 0.3);
    }
  }
  // Beached boats along the strand.
  for (const [x, z, ry] of [[-566, 60, 0.4], [-570, 148, -0.3], [-562, -10, 1.2], [-556, 176, 2.4]]) boat(w, x, z, ry, rng);

  // The Broken Lighthouse: banded tower, cracked gallery, a lamp that still turns at night.
  const LH = { x: -522, z: -121 };
  const ly = w.getHeight(LH.x, LH.z);
  const tower = new THREE.Group();
  const white = mat(0xe6e0d2), red = mat(0xa6453a), dark = mat(0x3a3a40);
  for (let i = 0; i < 5; i++) tower.add(mesh(cyl(3.5 - i * 0.22, 3.75 - i * 0.22, 4.4, 10), i % 2 ? red : white, { y: 2.2 + i * 4.4 }));
  tower.add(mesh(cyl(3.9, 3.9, 0.5, 10), dark, { y: 22.3 }));
  tower.add(mesh(cone(3.2, 3.6, 10), red, { y: 26.6, rz: 0.35, x: 0.9 }));
  tower.add(mesh(box(1.4, 2.6, 0.4), mat(0x2a2219), { y: 1.3, z: 3.6 }));
  tower.rotation.y = 0.35; // the door looks out over the harpoon
  w._static(tower, LH.x, LH.z, 0.35, 0.3);
  w.addCircle(LH.x, LH.z, 4.0);
  const lamp = new THREE.Group();
  const lampMat = mat(0xfff1c0, { unique: true, emissive: 0xffc860, emissiveIntensity: 2 });
  lamp.add(mesh(box(2.2, 1.8, 2.2), lampMat, { y: 23.5, shadow: false }));
  const beamGeo = new THREE.ConeGeometry(2.6, 34, 10, 1, true).rotateZ(Math.PI / 2).translate(17, 0, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const beams = new THREE.Group();
  beams.add(new THREE.Mesh(beamGeo, beamMat));
  const b2 = new THREE.Mesh(beamGeo, beamMat);
  b2.rotation.y = Math.PI;
  beams.add(b2);
  beams.position.y = 23.5;
  lamp.add(beams);
  const lg = glowSprite(0xffd890, 8, 0.6);
  lg.position.y = 23.5;
  lamp.add(lg);
  lamp.position.set(LH.x, ly - 0.3, LH.z);
  w.scene.add(lamp);
  B.lighthouse = { beams, beamMat, lampMat, glow: lg };
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2, d = 5 + rng() * 6;
    w.block(LH.x + Math.sin(a) * d, LH.z + Math.cos(a) * d, 0.8 + rng(), 0.5 + rng() * 0.6, 0.8 + rng(), rng() * 3, { color: rng() < 0.6 ? 0xd8d2c4 : 0x9a4a40, collide: false });
  }

  // The Captain's Wreck: a great ship driven up the beach, keeled over towards the sea.
  const S = { x: WRECK.x - 22, z: WRECK.z + 2 };
  const sy = Math.max(w.getHeight(S.x, S.z), SEA.level - 1.2);
  const HULL = 0x4e3e30, HULL2 = 0x3c3026;
  const lean = 0.22;
  w.block(S.x, S.z, 6, 1.4, 24, 0, { y: sy - 0.6, color: HULL2, collide: false });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = S.z - 10 + i * 4;
      if (s > 0 && i === 3) continue; // a hole stove in her landward side
      w.block(S.x + s * 3.4, z, 0.6, 4.2 - Math.abs(i - 2.5) * 0.3, 4.1, 0, { y: sy, rz: -s * 0.18 + lean, color: i % 2 ? HULL : HULL2, collide: false });
    }
  }
  for (const s of [-1, 1]) w.block(S.x + s * 1.8, S.z - 13.6, 0.6, 4.4, 4.6, s * 0.55, { y: sy, rz: lean, color: HULL, collide: false }); // bow
  w.block(S.x, S.z + 12.6, 7, 6.5, 0.8, 0, { y: sy, rz: lean, color: HULL2, collide: false }); // stern
  w.block(S.x - 0.5, S.z + 10.5, 6.6, 0.4, 5, 0, { y: sy + 5.6, rz: lean, color: HULL, collide: false }); // the stern deck
  w.block(S.x, S.z - 2, 6, 0.35, 9, 0, { y: sy + 3.6, rz: lean, color: 0x5a4838, collide: false });
  w.block(S.x - 1.4, S.z - 3, 0.8, 16, 0.8, 0, { y: sy + 2, rz: lean + 0.12, color: 0x3a2c22, collide: false }); // mainmast
  w.block(S.x - 3.4, S.z - 3, 9, 0.5, 0.5, 0, { y: sy + 13, rz: lean, ry: 0.4, color: 0x3a2c22, collide: false });
  w.block(S.x - 0.6, S.z + 6, 0.7, 6, 0.7, 0, { y: sy + 2, rz: lean, color: 0x3a2c22, collide: false }); // snapped foremast
  w.block(S.x + 4, S.z + 2, 0.7, 0.7, 9, 0.3, { y: w.getHeight(S.x + 4, S.z + 2), rx: 0.1, color: 0x3a2c22, collide: false });
  w.addBox(S.x, S.z, 3.8, 13.5);
  B.wreckSails = [[S.x - 1.4, S.z - 3, sy + 11], [S.x - 0.6, S.z + 6, sy + 6.5]];
  // Older wrecks offshore: masts and ribs breaking the swell.
  for (const [x, z] of [[-640, -80], [-660, 70], [-700, -20], [-625, 160]]) {
    const g = w.getHeight(x, z);
    w.block(x, z, 0.6, SEA.level - g + 7 + rng() * 5, 0.6, 0, { y: g, rz: (rng() - 0.5) * 0.5, rx: (rng() - 0.5) * 0.4, color: 0x3a2c22, collide: false });
    for (let i = 0; i < 5; i++) w.block(x + 2, z - 4 + i * 2, 0.35, SEA.level - g + 1.6, 0.35, 0, { y: g, rz: 0.4, color: 0x3a2c22, collide: false });
  }
}

function boat(w, x, z, ry, rng) {
  const g = w.getHeight(x, z);
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  for (const s of [-1, 1]) {
    const [px, pz] = at(s * 0.9, 0);
    w.block(px, pz, 0.25, 0.9, 4.6, ry, { y: g - 0.3, rz: s * 0.4, color: 0x5a4632, collide: false });
  }
  const [bx, bz] = at(0, 0);
  w.block(bx, bz, 1.4, 0.3, 4.4, ry, { y: g - 0.3, color: 0x4a3a2a, collide: false });
  w.block(bx, bz, 1.8, 0.15, 0.3, ry, { y: g + 0.45, color: 0x6a5a46, collide: false });
  w.addBox(x, z, 1.1, 2.4, ry);
}

// ---------- the Glowcap Hollows ----------

// Every glowing cap (giant and small) is one instanced, unlit mesh so it shines in the dark.
function glowcap(w, B) {
  const rng = mulberry32(8807);
  B.caps = [];
  B.ringShrooms = [];
  const addCap = (x, y, z, r, h, hex) => B.caps.push({ x, y, z, r, h, hex });
  B.addCap = addCap;
  // The Myconid's Ring: a fairy ring of tall glowcaps, open towards the road.
  const R = Z.ring;
  const gate = Math.atan2(-322 - R.x, -430 - R.z);
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - gate), Math.cos(a - gate))) < 0.4) continue;
    const x = R.x + Math.sin(a) * 12, z = R.z + Math.cos(a) * 12;
    B.ringShrooms.push({ x, z, h: 3 + rng() * 2.5, r: 1.4 + rng() * 0.8 });
    w.addCircle(x, z, 0.5);
  }
  // The Heartcap: one vast mushroom at the back of the grove, roots arching round the arena.
  const G = GROVE;
  const into = Math.atan2(-440 - G.x, -462 - G.z); // towards the way in
  const hx = G.x - Math.sin(into) * (G.r - 4), hz = G.z - Math.cos(into) * (G.r - 4);
  B.heartcap = { x: hx, z: hz };
  w.addCircle(hx, hz, 3.4);
  const gy = w.getHeight(G.x, G.z);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - into), Math.cos(a - into))) < 0.32) continue;
    const r = G.r + 1.5 + rng() * 2;
    const x = G.x + Math.sin(a) * r, z = G.z + Math.cos(a) * r;
    w.block(x, z, 1.6, 5 + rng() * 6, 1.6, a, { y: gy - 0.5, rx: (rng() - 0.5) * 0.3, rz: (rng() - 0.5) * 0.3, color: rng() < 0.5 ? 0x3b2f48 : 0x4a3a58 });
    if (i % 3 === 0) B.ringShrooms.push({ x: x + Math.sin(a) * 2.5, z: z + Math.cos(a) * 2.5, h: 4 + rng() * 4, r: 1.6 + rng() });
  }
  // Mossdeep: roots and old stones round the shrine.
  const md = Z.mossdeep;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    w.block(md.x + Math.sin(a) * 7.5, md.z + Math.cos(a) * 7.5, 1.1, 1.5 + rng() * 2.5, 1.1, a, { color: 0x5a5068 });
  }
}

// ---------- the Gilded Dunes ----------

function dunes(w, B) {
  const rng = mulberry32(9901);
  const SAND = 0xc88a50, SAND2 = 0xa86a3e, GOLD = 0xd8b058;
  const obelisk = (x, z, h, ry = 0) => {
    w.block(x, z, 1.6, h, 1.6, ry, { color: SAND });
    w.block(x, z, 1.0, 1.2, 1.0, ry, { y: w.getHeight(x, z) - 0.3 + h, color: SAND2, collide: false });
  };
  // The Sand Gate: two obelisks either side of the pass, one fallen across the dunes.
  obelisk(431 - 1, 63 + 9, 11, 0.1);
  obelisk(431 + 1, 63 - 9, 9, -0.1);
  w.block(442, 70, 1.4, 1.4, 9, 0.6, { y: w.getHeight(442, 70) - 0.2, color: SAND, collide: false });
  // Sunrest: a broken colonnade round the shrine.
  const sr = Z.sunrest;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    if (Math.cos(a) < -0.5) continue;
    w.block(sr.x + Math.sin(a) * 7.5, sr.z + Math.cos(a) * 7.5, 1.3, 2.5 + rng() * 3.5, 1.3, a, { color: SAND });
  }
  // Tamsin's camp at the oasis: a striped awning on poles, rugs, crates.
  const tx = 548, tz = 38;
  for (const [dx, dz] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) w.block(tx + dx, tz + dz, 0.2, 2.6, 0.2, 0, { color: 0x5a4632 });
  w.block(tx, tz, 4.6, 0.12, 3.6, 0, { y: w.getHeight(tx, tz) + 2.4, rx: 0.08, color: 0xb04030, collide: false });
  w.block(tx, tz, 4.6, 0.13, 1.2, 0, { y: w.getHeight(tx, tz) + 2.45, color: 0xe8d8b0, collide: false });
  w.block(tx + 0.5, tz + 0.4, 2.4, 0.05, 1.6, 0.2, { y: w.getHeight(tx, tz) - 0.24, color: 0x8a3a5a, collide: false });
  for (const [dx, dz, s] of [[3.2, -2.2, 0.9], [3.9, -1.2, 0.7], [-3.4, 2.4, 0.8]]) w.block(tx + dx, tz + dz, s, s, s, rng(), { color: 0x7a5a3a });
  // The Lost Caravan: overturned wagons, scattered crates, the bones of its beasts.
  const cv = Z.caravan;
  for (const [dx, dz, ry, tip] of [[-6, -4, 0.5, 1.3], [5, 3, 2.1, 0], [-1, 8, 1.2, 1.5]]) {
    const x = cv.x + dx, z = cv.z + dz, gy = w.getHeight(x, z);
    w.block(x, z, 2.2, 1.0, 4.2, ry, { y: gy - 0.2 + (tip ? 0.6 : 0.3), rz: tip, color: 0x6a4a2e });
    if (!tip) w.block(x, z, 2.4, 1.2, 4.0, ry, { y: gy + 1.2, rx: 0.1, color: 0xd8c8a0, collide: false });
    for (const s of [-1, 1]) w.block(x + Math.cos(ry) * s * 1.2, z - Math.sin(ry) * s * 1.2, 0.2, 1.3, 1.3, ry, { y: gy - 0.4, rz: tip ? 1.2 : 0, color: 0x3a2a1e, collide: false });
  }
  for (let i = 0; i < 12; i++) w.block(cv.x + (rng() - 0.5) * 22, cv.z + (rng() - 0.5) * 22, 0.7 + rng() * 0.5, 0.6 + rng() * 0.4, 0.7 + rng() * 0.5, rng() * 3, { color: rng() < 0.5 ? 0x7a5a3a : 0x8a6a46, collide: false });
  for (let i = 0; i < 3; i++) {
    const x = cv.x + 8 + i * 3, z = cv.z - 6 - i * 2, gy = w.getHeight(x, z);
    for (let k = 0; k < 5; k++) w.block(x + k * 0.5, z, 0.12, 1.1, 0.12, 0, { y: gy - 0.2, rz: 0.5, color: 0xe8dcc0, collide: false });
  }
  // Sandstone arches out in the dunes.
  for (const [x, z, ry] of [[505, 110, 0.4], [600, 60, -0.3], [570, 170, 1.2], [480, 140, 0.9]]) {
    const cs = Math.cos(ry), sn = Math.sin(ry), gy = Math.min(w.getHeight(x - cs * 4, z + sn * 4), w.getHeight(x + cs * 4, z - sn * 4));
    for (const sd of [-1, 1]) w.block(x + cs * sd * 4, z - sn * sd * 4, 2.2, 9, 2.6, ry, { y: gy - 0.5, color: SAND2 });
    w.block(x, z, 10.5, 2.0, 2.6, ry, { y: gy + 8.2, color: SAND, collide: false });
  }
  // The Sanctum of the Sun: a ring of columns open to the west, a stepped pyramid at its back with the
  // sun's golden disc on its face, and a floor of worn flagstones.
  const S = SANCTUM, sy = w.getHeight(S.x, S.z);
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.36) continue; // the way in, from the west
    const x = S.x + Math.sin(a) * (S.r + 1), z = S.z + Math.cos(a) * (S.r + 1);
    const h = i % 4 === 1 ? 4 + rng() * 2 : 9 + rng() * 1.5;
    w.block(x, z, 2.2, h, 2.2, a, { y: sy - 0.5, color: SAND });
    if (h > 8) w.block(x, z, 2.8, 0.7, 2.8, a, { y: sy - 0.5 + h, color: GOLD, collide: false });
  }
  const px = S.x + S.r + 14, pz = S.z;
  for (let k = 0; k < 6; k++) w.block(px + k * 1.5, pz, 22 - k * 3.2, 3, 22 - k * 3.2, 0, { y: sy - 0.4 + k * 3, color: k % 2 ? SAND2 : SAND, collide: k === 0 });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4, 16), mat(0xffd070, { emissive: 0xffa020, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  disc.position.set(px - 10.5, sy + 9, pz);
  disc.rotation.y = -Math.PI / 2;
  w.scene.add(disc);
  B.sunDisc = disc;
  for (let i = 0; i < 50; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (S.r - 3);
    w.block(S.x + Math.sin(a) * d, S.z + Math.cos(a) * d, 1.6 + rng() * 1.6, 0.16, 1.6 + rng() * 1.6, rng() * 3, { y: sy - 0.1, color: 0xc89a60, collide: false });
  }
}

// ---------- the Stormspire Heights ----------

function storm(w, B) {
  const rng = mulberry32(1203);
  const STONE = 0x6a6e76, DARK = 0x4a4e56, COPPER = 0x5a8a7a;
  // The Thunder Stair: weathered waymarks with copper rods along the climb.
  for (const [x, z] of [[340, -232], [356, -282], [366, -322], [380, -372]]) {
    w.block(x + 5, z, 1.2, 3.2, 1.2, rng(), { color: STONE });
    w.block(x + 5, z, 0.12, 2.2, 0.12, 0, { y: w.getHeight(x + 5, z) + 2.8, color: COPPER, collide: false });
  }
  // Stormgate: a ring of standing stones round the shrine.
  const sg = Z.stormgate;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    if (Math.cos(a) > 0.6) continue;
    w.block(sg.x + Math.sin(a) * 7.5, sg.z + Math.cos(a) * 7.5, 1.2, 2.8 + rng() * 2.4, 0.8, a, { color: STONE });
  }
  // The Broken Monastery: a walled cloister, a roofless chapel and a leaning bell tower.
  const mo = Z.monastery, my = w.getHeight(mo.x, mo.z) - 0.3;
  const wall = (x0, z0, x1, z1, gap = null) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0), n = Math.ceil(len / 3);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (gap && Math.hypot(x - gap[0], z - gap[1]) < 2.8) continue;
      w.block(x, z, len / n + 0.05, 2.5 + Math.abs(Math.sin(i * 2.3 + x0)) * 3.5, 1.0, ry, { y: my, color: i % 3 ? STONE : DARK });
    }
  };
  wall(mo.x - 14, mo.z - 12, mo.x + 14, mo.z - 12);
  wall(mo.x - 14, mo.z + 12, mo.x + 14, mo.z + 12, [mo.x + 6, mo.z + 12]);
  wall(mo.x - 14, mo.z - 12, mo.x - 14, mo.z + 12);
  wall(mo.x + 14, mo.z - 12, mo.x + 14, mo.z + 12, [mo.x + 14, mo.z + 4]);
  // The chapel: a raised floor, an altar, and two broken arches.
  w.block(mo.x - 6, mo.z - 6, 9, 0.4, 7, 0, { y: my + 0.1, color: DARK, collide: false });
  w.block(mo.x - 6, mo.z - 9, 2.4, 1.1, 1.0, 0, { y: my + 0.4, color: 0x8a8e96 });
  for (const sx of [-1, 1]) {
    w.block(mo.x - 6 + sx * 3.6, mo.z - 3, 1.0, 6, 1.0, 0, { y: my, color: STONE });
    w.block(mo.x - 6 + sx * 3.6, mo.z - 8, 1.0, 5, 1.0, 0, { y: my, color: STONE });
  }
  w.block(mo.x - 6, mo.z - 3, 8.2, 0.8, 1.0, 0, { y: my + 6, color: DARK, collide: false });
  // The bell tower, leaning, its bell long gone.
  for (let i = 0; i < 5; i++) w.block(mo.x + 9, mo.z - 7, 3.4 - i * 0.2, 3, 3.4 - i * 0.2, 0, { y: my + i * 3, rz: i * 0.03, color: i % 2 ? STONE : DARK, collide: i === 0 });
  w.block(mo.x + 9.6, mo.z - 7, 0.2, 4, 0.2, 0, { y: my + 15, color: COPPER, collide: false });
  // Spires: needles of dark rock all over the heights, a few with copper rods that draw the lightning.
  B.rods = [];
  const spires = [];
  for (let i = 0, tries = 0; spires.length < 70 && tries < 2000; tries++) {
    const L = LOBES.storm;
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (L.r - 8);
    const x = L.x + Math.sin(a) * d, z = L.z + Math.cos(a) * d;
    if (w.roadDistance(x, z) < 9) continue;
    let ok = true;
    for (const zn of Object.values(Z)) if (zn.flat != null && Math.hypot(x - zn.x, z - zn.z) < zn.flat + 8) ok = false;
    if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < SUMMIT.r + 6 || Math.hypot(x - 404, z + 414) < 5) ok = false;
    if (!ok) continue;
    const h = 8 + Math.pow(rng(), 1.5) * 30, r = 1.4 + h * 0.07 + rng();
    spires.push({ x, z, h, r });
    w.addCircle(x, z, r * 0.8);
    if (h > 22 && B.rods.length < 12) B.rods.push({ x, z, y: w.getHeight(x, z) + h * 0.98 });
    i++;
  }
  const geo = new THREE.CylinderGeometry(0.25, 1, 1, 6).translate(0, 0.5, 0);
  const sm = new THREE.MeshStandardMaterial({ color: 0x4e525a, roughness: 0.9, flatShading: true });
  const im = new THREE.InstancedMesh(geo, sm, spires.length);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  spires.forEach((sp, i) => {
    dummy.position.set(sp.x, w.getHeight(sp.x, sp.z) - 1, sp.z);
    dummy.rotation.set((rng() - 0.5) * 0.12, rng() * 6, (rng() - 0.5) * 0.12);
    dummy.scale.set(sp.r, sp.h, sp.r);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    im.setColorAt(i, col.setHex(0xffffff).offsetHSL(0, 0, (rng() - 0.5) * 0.15));
  });
  im.castShadow = im.receiveShadow = true;
  w.scene.add(im);
  const rodM = mat(0x8fd8c8, { emissive: 0x60c0ff, emissiveIntensity: 0.6 });
  for (const r of B.rods) w.scene.add(mesh(box(0.2, 3, 0.2), rodM, { x: r.x, y: r.y + 1.5, z: r.z }));
  B.rodMat = rodM;
  // The Herald's Summit: a ring of stones, each with a copper rod, round a great iron lightning-mast.
  const S = SUMMIT, sy = w.getHeight(S.x, S.z);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - 3.6), Math.cos(a - 3.6))) < 0.4) continue; // the way in, from the road
    const x = S.x + Math.sin(a) * (S.r + 1), z = S.z + Math.cos(a) * (S.r + 1);
    w.block(x, z, 1.8, 5 + rng() * 2, 1.2, a, { y: sy - 0.5, color: STONE });
    w.block(x, z, 0.15, 2.4, 0.15, 0, { y: sy + 6.2, color: COPPER, collide: false });
  }
  const mx = S.x + Math.sin(0.5) * 18, mz = S.z + Math.cos(0.5) * 18;
  w.block(mx, mz, 1.4, 22, 1.4, 0, { y: sy - 0.5, color: 0x3a3e46 });
  for (let k = 0; k < 3; k++) w.block(mx, mz, 4 - k, 0.3, 0.3, k, { y: sy + 8 + k * 5, color: 0x3a3e46, collide: false });
  B.mast = { x: mx, z: mz, y: sy + 22 };
  B.rods.push({ x: mx, z: mz, y: sy + 21.5 });
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (S.r - 3);
    w.block(S.x + Math.sin(a) * d, S.z + Math.cos(a) * d, 1.4 + rng() * 1.6, 0.16, 1.4 + rng() * 1.6, rng() * 3, { y: sy - 0.1, color: 0x7a7e86, collide: false });
  }
}

// ---------- scenery (batched by world/Scenery.js) ----------

const sg = () => P.sceneryGeometries();
const { xform, tone } = P;

function basaltParts(rng) {
  const parts = [];
  const n = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.28, d = i ? 0.7 + rng() * 0.8 : 0;
    const h = (i ? 1.2 + rng() * 2.5 : 3 + rng() * 3);
    const r = 0.45 + rng() * 0.3;
    parts.push({ geo: sg().hex, matrix: xform(Math.sin(a) * d, -0.3, Math.cos(a) * d, 0, rng(), 0, r, h, r), color: tone(rng() < 0.5 ? 0x2e2b31 : 0x3a3539, rng) });
  }
  return parts;
}

function charredParts(rng) {
  const c = tone(0x2a2522, rng);
  return [
    { geo: sg().trunk, matrix: xform(0, -0.2, 0, 0, 0, 0, 0.75, 4 + rng() * 2, 0.75), color: c, flex: 0.01 },
    { geo: sg().branch, matrix: xform(0, 2.4, 0, 0, rng() * 6, 0.9, 1, 1.6, 1), color: c, flex: 0.01 },
    { geo: sg().branch, matrix: xform(0, 3.1, 0, 0, rng() * 6, -0.8, 1, 1.2, 1), color: c, flex: 0.01 },
    { geo: sg().octa, matrix: xform(0, 0.1, 0, 0, 0, 0, 0.5, 0.3, 0.5), color: tone(0x8a3a1c, rng) },
  ];
}

function palmParts(rng) {
  const parts = [];
  const lean = 0.15 + rng() * 0.3, dir = rng() * 6.28;
  let x = 0, y = -0.2, z = 0;
  for (let i = 0; i < 6; i++) {
    const t = lean * (i / 6);
    parts.push({ geo: sg().trunk, matrix: xform(x, y, z, Math.cos(dir) * t, 0, -Math.sin(dir) * t, 0.85 - i * 0.06, 1.35, 0.85 - i * 0.06), color: tone(i % 2 ? 0x8a7050 : 0x7a6244, rng), flex: 0.03 });
    x += Math.sin(dir) * Math.sin(t) * 1.3;
    z += Math.cos(dir) * Math.sin(t) * 1.3;
    y += 1.28;
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rng() * 0.3;
    parts.push({ geo: sg().blade, matrix: xform(x, y, z, Math.cos(a) * 1.9, a, -Math.sin(a) * 1.9, 0.5, 3.2 + rng() * 0.8, 0.18), color: tone(rng() < 0.5 ? 0x5e8a34 : 0x7a9a3c, rng), flex: 0.08 });
  }
  for (let i = 0; i < 3; i++) parts.push({ geo: sg().octa, matrix: xform(x + (rng() - 0.5) * 0.5, y - 0.3, z + (rng() - 0.5) * 0.5, 0, 0, 0, 0.22, 0.22, 0.22), color: tone(0x5a4228, rng), flex: 0.04 });
  return parts;
}

function stemParts(rng, h, r, hex = 0xd6cbe0) {
  return [
    { geo: sg().stem, matrix: xform(0, -0.2, 0, 0, 0, 0, r * 0.32, h, r * 0.32), color: tone(hex, rng) },
    { geo: sg().disc, matrix: xform(0, h - 0.3, 0, 0, 0, 0, r * 0.92, 0.25, r * 0.92), color: tone(0x5a4870, rng) }, // gills
    { geo: sg().disc, matrix: xform(0, 0.1, 0, 0, 0, 0, r * 0.45, 0.25, r * 0.45), color: tone(0x6a5a7a, rng) }, // the volva
  ];
}

function sporeFernParts(rng) {
  const parts = [];
  const n = 6 + Math.floor(rng() * 3);
  const hue = rng() < 0.5 ? 0x6a4a8a : 0x3f7a74;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rng() * 0.4, tilt = 0.9 + rng() * 0.35;
    parts.push({ geo: sg().blade, matrix: xform(0, 0, 0, Math.cos(a) * tilt, a, -Math.sin(a) * tilt, 0.14, 0.9 + rng() * 0.4, 0.05), color: tone(hue, rng), flex: 0.4 });
  }
  return parts;
}

export function biomeScenery(sc) {
  const w = sc.world, rng = sc.rng, B = w.biomes;
  const spot = (L, pad = 0) => {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (L.r - pad);
    return [L.x + Math.sin(a) * d, L.z + Math.cos(a) * d];
  };
  const free = (k, x, z, pad) => {
    if (w.biomeAt(x, z, -6) !== k || !w.inPlay(x, z, 4)) return false;
    if (w.roadDistance(x, z) < 5 + pad) return false;
    for (const zn of Object.values(Z)) if (zn.flat != null && Math.hypot(x - zn.x, z - zn.z) < zn.flat + 3 + pad) return false;
    for (const a of [CALDERA, WRECK, GROVE]) if (Math.hypot(x - a.x, z - a.z) < a.r + 3 + pad) return false;
    return sc.clearOfGear(x, z, 2) && sc.clearOfPois(x, z, 2.5);
  };
  const scatter = (k, n, tries, pad, fn, L = LOBES[k]) => {
    for (let i = 0, placed = 0; i < tries && placed < n; i++) {
      const [x, z] = spot(L, 4);
      if (!free(k, x, z, pad)) continue;
      if (fn(x, z) !== false) placed++;
    }
  };

  // Cinderfall: basalt columns, charred snags, ash grass, scattered dark rocks.
  scatter('cinder', 90, 2500, 0, (x, z) => {
    if (w.lavaDepth(x, z) > 0 || w.slopeAt(x, z) > 0.9) return false;
    sc._put(sc.big, basaltParts(rng), x, z, { s: 0.9 + rng() * 0.8, sink: 0.1 });
    w.addCircle(x, z, 1.2);
  });
  scatter('cinder', 120, 2500, 0, (x, z) => {
    if (w.lavaDepth(x, z) > 0 || w.slopeAt(x, z) > 0.6) return false;
    const s = 0.8 + rng() * 0.6;
    sc._put(sc.big, charredParts(rng), x, z, { s });
    w.addCircle(x, z, 0.3 * s);
    sc.trees.push({ x, z, y: w.getHeight(x, z), s, type: 'dead' });
  });
  scatter('cinder', 260, 3000, -3, (x, z) => {
    if (w.lavaDepth(x, z) > 0) return false;
    const s = 0.4 + Math.pow(rng(), 2.3) * 2.2;
    if (s > 0.9 && w.roadDistance(x, z) < 6) return false;
    sc._put(sc.big, P.rockParts(rng, rng() < 0.7 ? 0x3a3634 : 0x5a3a2a), x, z, { y: w.getHeight(x, z) + s * 0.1, rx: rng(), rz: rng(), sx: s * 1.2, sy: s * 0.7, sz: s });
    if (s > 0.9) w.addCircle(x, z, s * 0.9);
  });
  scatter('cinder', 1800, 6000, -3.5, (x, z) => {
    if (w.lavaDepth(x, z) > 0 || w.slopeAt(x, z) > 0.5) return false;
    const s = 0.6 + rng() * 0.6;
    sc._put(sc.small, P.tuftParts(rng, rng() < 0.6 ? 0x6d655c : 0x7a5a3c), x, z, { s, sy: s * 0.7, sink: 0.05 });
  });

  // The coast: palms and dune grass above the tide line, driftwood and shells on the strand, rocks and
  // sea stacks out in the water.
  const sand = (x, z) => w.getHeight(x, z) > SEA.level + 0.5;
  scatter('coast', 120, 3000, 0, (x, z) => {
    if (!sand(x, z) || w.slopeAt(x, z) > 0.5 || x < SEA.shoreX + 12) return false;
    const s = 0.8 + rng() * 0.5;
    sc._put(sc.big, palmParts(rng), x, z, { s, ry: 0 });
    w.addCircle(x, z, 0.3 * s);
    sc.trees.push({ x, z, y: w.getHeight(x, z), s, type: 'pine' });
  });
  scatter('coast', 2600, 8000, -3.5, (x, z) => {
    if (!sand(x, z) || x < SEA.shoreX + 6) return false;
    const s = 0.7 + rng() * 0.7;
    sc._put(sc.small, P.tuftParts(rng, rng() < 0.6 ? 0xb2a866 : 0x8f9a52), x, z, { s, sy: s * (0.8 + rng() * 0.6), sink: 0.05 });
  });
  scatter('coast', 70, 2000, -2, (x, z) => {
    const g = w.getHeight(x, z);
    if (g < SEA.level - 0.2 || g > SEA.level + 3) return false;
    const len = 2 + rng() * 3, ry = rng() * 6.28;
    sc._put(sc.big, [{ geo: sg().log, matrix: xform(0, 0.2, 0, 0, 0, Math.PI / 2, 0.24, len, 0.24), color: tone(0x9a8a72, rng) }], x, z, { ry, sink: 0.05 });
  });
  scatter('coast', 700, 5000, -4, (x, z) => {
    const g = w.getHeight(x, z);
    if (g < SEA.level - 0.1 || g > SEA.level + 2.5) return false;
    sc._put(sc.small, [{ geo: sg().octa, matrix: xform(0, 0.02, 0, 0, rng() * 6, 0, 0.09, 0.05, 0.12), color: tone([0xf2e6d8, 0xe8b0a8, 0xd8c0e0][Math.floor(rng() * 3)], rng) }], x, z, {});
  });
  scatter('coast', 150, 3000, -2, (x, z) => {
    const s = 0.4 + Math.pow(rng(), 2) * 2.2;
    if (s > 0.9 && w.roadDistance(x, z) < 6) return false;
    sc._put(sc.big, P.rockParts(rng, 0x8b8476), x, z, { rx: rng(), rz: rng(), sx: s * 1.2, sy: s * 0.7, sz: s });
    if (s > 0.9) w.addCircle(x, z, s * 0.9);
  });
  for (let i = 0; i < 26; i++) {
    const x = SEA.walkX - 10 - rng() * 120, z = LOBES.coast.z + (rng() - 0.5) * 300;
    const s = 3 + rng() * 6, g = w.getHeight(x, z);
    sc._put(sc.big, P.rockParts(rng, 0x7a756a), x, z, { y: g + s * 0.5, ry: rng() * 6, sx: s, sy: s * (1.4 + rng()), sz: s * 0.9 });
  }
  if (B.wreckSails) for (const [x, z, y] of B.wreckSails) sc._put(sc.big, P.bannerParts(rng, 0xb8ad94), x, z, { y: y - 4.7, ry: 0.4 });

  // The Hollows: giant glowcaps for trees, small glowing clusters, spore ferns and teal moss.
  const L = LOBES.glow;
  scatter('glow', 130, 4000, 0, (x, z) => {
    if (w.slopeAt(x, z) > 0.6) return false;
    const h = 4 + Math.pow(rng(), 1.5) * 12, r = h * (0.3 + rng() * 0.15);
    sc._put(sc.big, stemParts(rng, h, r), x, z, { ry: rng() * 6 });
    B.addCap(x, w.getHeight(x, z) + h - 0.35, z, r, r * (0.5 + rng() * 0.25), rng() < 0.65 ? 0x5ef0d8 : rng() < 0.5 ? 0xd070f0 : 0x8ab0ff);
    w.addCircle(x, z, r * 0.32);
    sc.trees.push({ x, z, y: w.getHeight(x, z), s: 1, type: 'dead' });
  });
  scatter('glow', 420, 4000, -3, (x, z) => {
    const n = 2 + Math.floor(rng() * 4), y0 = w.getHeight(x, z);
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, d = i ? 0.2 + rng() * 0.6 : 0;
      const h = 0.25 + rng() * 0.5, r = 0.15 + rng() * 0.2;
      const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      sc._put(sc.small, [{ geo: sg().stem, matrix: xform(0, 0, 0, 0, 0, 0, 0.05, h, 0.05), color: tone(0xd8d0e8, rng) }], px, pz, { y: y0 - 0.05 });
      B.addCap(px, y0 + h - 0.08, pz, r, r * 0.6, rng() < 0.5 ? 0x7af8e0 : 0xf090ff);
    }
  });
  scatter('glow', 700, 5000, -3, (x, z) => {
    if (w.slopeAt(x, z) > 0.6) return false;
    sc._put(sc.small, sporeFernParts(rng), x, z, { s: 0.8 + rng() * 0.7, sink: 0.05 });
  });
  scatter('glow', 2200, 8000, -3.5, (x, z) => {
    if (w.slopeAt(x, z) > 0.5) return false;
    const s = 0.6 + rng() * 0.6;
    sc._put(sc.small, P.tuftParts(rng, rng() < 0.5 ? 0x4a7a76 : 0x6a5a8a), x, z, { s, sy: s * 0.8, sink: 0.05 });
  });
  scatter('glow', 140, 3000, -2, (x, z) => {
    const s = 0.4 + Math.pow(rng(), 2) * 2;
    if (s > 0.9 && w.roadDistance(x, z) < 6) return false;
    sc._put(sc.big, P.rockParts(rng, 0x4b4560), x, z, { rx: rng(), rz: rng(), sx: s * 1.2, sy: s * 0.7, sz: s });
    if (s > 0.9) w.addCircle(x, z, s * 0.9);
  });
  for (const m of B.ringShrooms) {
    sc._put(sc.big, stemParts(rng, m.h, m.r * 1.6), m.x, m.z, { ry: rng() * 6 });
    B.addCap(m.x, w.getHeight(m.x, m.z) + m.h - 0.35, m.z, m.r * 1.6, m.r * 0.9, rng() < 0.5 ? 0x5ef0d8 : 0xd070f0);
  }
  const hc = B.heartcap;
  if (hc) {
    sc._put(sc.big, stemParts(rng, 26, 12, 0xcfc0dc), hc.x, hc.z, { ry: 0.3 });
    B.addCap(hc.x, w.getHeight(hc.x, hc.z) + 25.6, hc.z, 12, 6.5, 0xff70c8);
  }
  void L;
  buildCaps(w, B);

  // The Dunes: palms round the oasis, cacti, dry scrub and wind-carved rocks, gold grass in the hollows.
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + rng() * 0.2, d = OASIS.r * (1.1 + rng() * 0.6);
    const x = OASIS.x + Math.sin(a) * d, z = OASIS.z + Math.cos(a) * d;
    if (!sc.clearOfPois(x, z, 2.5) || w.roadDistance(x, z) < 4.5) continue;
    const s = 0.9 + rng() * 0.5;
    sc._put(sc.big, palmParts(rng), x, z, { s, ry: 0 });
    w.addCircle(x, z, 0.3 * s);
    sc.trees.push({ x, z, y: w.getHeight(x, z), s, type: 'pine' });
  }
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2, d = OASIS.r * (0.9 + rng() * 0.9);
    sc._put(sc.small, P.reedParts(rng), OASIS.x + Math.sin(a) * d, OASIS.z + Math.cos(a) * d, { s: 0.8 + rng() * 0.4, sink: 0.1 });
  }
  scatter('dunes', 70, 2500, 0, (x, z) => {
    if (w.slopeAt(x, z) > 0.5 || Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.r * 1.5) return false;
    sc._put(sc.big, cactusParts(rng), x, z, { s: 0.8 + rng() * 0.6 });
    w.addCircle(x, z, 0.4);
  });
  scatter('dunes', 160, 3000, -2, (x, z) => {
    if (Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.r * 1.2) return false;
    const s = 0.4 + Math.pow(rng(), 2) * 2.4;
    if (s > 0.9 && w.roadDistance(x, z) < 6) return false;
    sc._put(sc.big, P.rockParts(rng, rng() < 0.5 ? 0xb4683e : 0xc88a50), x, z, { rx: rng() * 0.3, rz: rng() * 0.3, sx: s * 1.3, sy: s * 0.8, sz: s });
    if (s > 0.9) w.addCircle(x, z, s * 0.9);
  });
  scatter('dunes', 1300, 6000, -3.5, (x, z) => {
    if (w.slopeAt(x, z) > 0.4 || Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.r) return false;
    const s = 0.6 + rng() * 0.6;
    sc._put(sc.small, P.tuftParts(rng, rng() < 0.6 ? 0xc8a85a : 0xa89048), x, z, { s, sy: s * 0.9, sink: 0.05 });
  });
  scatter('dunes', 60, 2000, -2, (x, z) => {
    sc._put(sc.big, P.deadParts(rng), x, z, { s: 0.6 + rng() * 0.4 });
    w.addCircle(x, z, 0.25);
  });
  // The Hollow Bell: bells hanging dead in their frames, cracked bells half-sunk in the ash, dead trees.
  for (const b of B.yardBells ?? []) sc._put(sc.big, P.fallenBellParts(rng), b.x, b.z, { y: b.y - 1.4, ry: b.ry, rz: 0, s: 1.1 });
  scatter('bell', 22, 1500, 0, (x, z) => {
    sc._put(sc.big, P.fallenBellParts(rng), x, z, { ry: rng() * 6, s: 0.8 + rng() * 1.2, sink: 0.4 });
    w.addCircle(x, z, 1.2);
  });
  scatter('bell', 40, 1500, 0, (x, z) => {
    sc._put(sc.big, P.deadParts(rng), x, z, { s: 0.8 + rng() * 0.5 });
    w.addCircle(x, z, 0.3);
  });
  scatter('bell', 600, 3000, -3, (x, z) => {
    const s = 0.6 + rng() * 0.6;
    sc._put(sc.small, P.tuftParts(rng, 0x9a9488), x, z, { s, sy: s * 0.7, sink: 0.05 });
  });
  // The Heights: twisted wind-bent pines, boulders and lichen-grey grass.
  scatter('storm', 140, 3000, 0, (x, z) => {
    if (w.slopeAt(x, z) > 0.55) return false;
    const s = 0.7 + rng() * 0.5;
    sc._put(sc.big, P.pineParts(rng), x, z, { s, rz: (rng() - 0.5) * 0.25, rx: (rng() - 0.5) * 0.25 });
    w.addCircle(x, z, 0.3 * s);
    sc.trees.push({ x, z, y: w.getHeight(x, z), s, type: 'pine' });
  });
  scatter('storm', 220, 3000, -2, (x, z) => {
    const s = 0.4 + Math.pow(rng(), 2) * 2.4;
    if (s > 0.9 && w.roadDistance(x, z) < 6) return false;
    sc._put(sc.big, P.rockParts(rng, rng() < 0.6 ? 0x5c6068 : 0x6e7270), x, z, { rx: rng(), rz: rng(), sx: s * 1.2, sy: s * 0.8, sz: s });
    if (s > 0.9) w.addCircle(x, z, s * 0.9);
  });
  scatter('storm', 1600, 6000, -3.5, (x, z) => {
    if (w.slopeAt(x, z) > 0.5) return false;
    const s = 0.6 + rng() * 0.6;
    sc._put(sc.small, P.tuftParts(rng, rng() < 0.5 ? 0x8a8e6a : 0x6a7458), x, z, { s, sy: s * 0.8, sink: 0.05 });
  });
}

function cactusParts(rng) {
  const c = tone(0x5a8a3a, rng), parts = [];
  const h = 2.5 + rng() * 2;
  parts.push({ geo: sg().hex, matrix: xform(0, -0.2, 0, 0, 0, 0, 0.32, h, 0.32), color: c });
  for (const sd of [-1, 1]) {
    if (rng() < 0.3) continue;
    const y = 0.8 + rng() * (h - 1.6);
    parts.push({ geo: sg().hex, matrix: xform(sd * 0.25, y, 0, 0, 0, -sd * Math.PI / 2, 0.18, 0.55, 0.18), color: c });
    parts.push({ geo: sg().hex, matrix: xform(sd * 0.75, y - 0.1, 0, 0, 0, 0, 0.18, 1.0 + rng() * 0.6, 0.18), color: c });
  }
  if (rng() < 0.4) parts.push({ geo: sg().octa, matrix: xform(0, h - 0.1, 0, 0, 0, 0, 0.15, 0.15, 0.15), color: tone(0xe86a8a, rng) });
  return parts;
}

function buildCaps(w, B) {
  const caps = B.caps;
  if (!caps.length) return;
  const geo = new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
  const im = new THREE.InstancedMesh(geo, m, caps.length);
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  const halo = [];
  caps.forEach((cp, i) => {
    dummy.position.set(cp.x, cp.y, cp.z);
    dummy.rotation.set(0, (i * 1.7) % 6.28, 0);
    dummy.scale.set(cp.r, cp.h, cp.r);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    im.setColorAt(i, c.setHex(cp.hex).multiplyScalar(0.8));
    if (cp.r > 0.8) halo.push(cp.x, cp.y + cp.h * 0.4, cp.z);
  });
  w.scene.add(im);
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(halo, 3));
  const hm = new THREE.PointsMaterial({ map: glowTexture(), color: 0x7ff0e0, size: 9, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const pts = new THREE.Points(hg, hm);
  pts.renderOrder = 4;
  w.scene.add(pts);
  B.capMesh = im;
  B.capMat = m;
  B.haloMat = hm;
}

// ---------- per frame ----------

export function updateBiomes(w, dt, time) {
  const B = w.biomes;
  if (!B) return;
  const g = w.game;
  const sky = g.sky;
  const night = sky?.night ?? 0;
  B.lavaMat.uniforms.uTime.value = time;
  B.sea.update(time, sky, w.weather.rain);
  const cam = g.camera.position;
  const ps = g.particles;
  // The volcano: glow breathing, smoke climbing from the crater and drifting off (until Ashmaw dies:
  // then the Old Fire is out and the mountain only steams a little).
  const flags = g.state?.flags ?? {};
  const fire = flags.ashmawDead ? 0.25 : 1;
  B.volcanoGlow.material.opacity = (0.4 + Math.sin(time * 0.6) * 0.08) * fire;
  for (const s of B.smoke) {
    s.userData.t = (s.userData.t + dt * 0.025) % 1;
    const t = s.userData.t;
    s.position.set(B.volcanoTop.x + t * 60 + Math.sin(t * 9 + s.id) * 6, B.volcanoTop.y + t * 120, B.volcanoTop.z + Math.cos(t * 7 + s.id) * 6);
    s.scale.setScalar(16 + t * 70);
    s.material.opacity = 0.55 * smoothstep(0, 0.1, t) * (1 - t) * fire;
  }
  // The lighthouse turns its lamp at dusk and through the night.
  const lh = B.lighthouse;
  lh.beams.rotation.y = time * 0.5;
  lh.beamMat.opacity = night * 0.12;
  lh.lampMat.emissiveIntensity = 0.6 + night * 2.4;
  lh.glow.material.opacity = 0.2 + night * 0.6;
  // Glowcaps brighten after dark and breathe a little.
  if (B.capMat) {
    const k = (0.65 + night * 0.45) * (0.92 + Math.sin(time * 0.8) * 0.08);
    B.capMat.color.setScalar(k);
    B.haloMat.opacity = 0.12 + night * 0.4;
  }
  // Region motes round the camera: embers over the Wastes, spores drifting in the Hollows.
  const region = w.biomeAt(cam.x, cam.z, 20);
  if (region === 'cinder' && Math.random() < dt * 14) {
    const x = cam.x + (Math.random() - 0.5) * 50, z = cam.z + (Math.random() - 0.5) * 50;
    ps.emit({ x, y: w.getHeight(x, z) + 0.5, z, count: 1, speed: 0.3, up: 1.6, color: 0xff7a2a, color2: 0xffc060, life: [2.5, 4.5], size: [0.06, 0.12], drag: 0.3, jitter: 0.5 });
  }
  if (region === 'glow' && Math.random() < dt * 16) {
    const x = cam.x + (Math.random() - 0.5) * 40, z = cam.z + (Math.random() - 0.5) * 40;
    ps.emit({ x, y: w.getHeight(x, z) + 0.5 + Math.random() * 4, z, count: 1, speed: 0.15, up: 0.2, color: 0x6ff0d8, color2: 0xe080ff, life: [3, 6], size: [0.05, 0.1], drag: 0.2, jitter: 1.5 });
  }
  // Lightning: the flash, the rods on the spires glowing, and over the Heights the storm striking now
  // and then (on a rod, or near you: watch for the crackling circle).
  if (B.flashT > 0) {
    B.flashT -= dt;
    B.flashLight.intensity = B.flashT > 0 ? 9000 * (B.flashT / 0.3) * (0.6 + Math.random() * 0.4) : 0;
  }
  if (B.rodMat) B.rodMat.emissiveIntensity = 0.5 + Math.random() * 0.15 + (B.flashT > 0 ? 3 : 0);
  if (region === 'storm' && !flags.vaelorDead && !g.cutscene && g.mode === 'playing' && (B.stormT -= dt) <= 0) {
    B.stormT = 3.5 + Math.random() * 5;
    const p = g.player.pos;
    if (Math.random() < 0.45 && B.rods.length) {
      const r = B.rods[Math.floor(Math.random() * B.rods.length)];
      g.effects.lightning(STORM, r.x, r.z, 0.05, { height: 40, radius: 0.5 });
    } else if (g.player.alive && !g.fieldBoss) {
      const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 28;
      const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      if (w.inPlay(x, z, 2)) g.effects.lightning(STORM, x, z, 1.3, { radius: 2.4, hit: { dmg: 28, poise: 30, knock: 4, unblockable: true } });
    }
  }
  if (B.sunDisc) B.sunDisc.rotation.z = time * 0.1;
  // The Bell's mist.
  const bg = B.bellGate;
  if (bg) {
    const shut = !bellGateOpen(flags);
    bg.uniforms.uTime.value = time;
    bg.mesh.visible = bg.glow.visible = shut;
    bg.wall.enabled = shut;
  }
  B.oasis.update(time, sky, w.weather.rain);
  if (region === 'dunes' && Math.random() < dt * 8) {
    const x = cam.x + (Math.random() - 0.5) * 40, z = cam.z + (Math.random() - 0.5) * 40;
    ps.emit({ x, y: w.getHeight(x, z) + 0.2, z, count: 2, speed: 0.4, up: 0.2, color: 0xe8c890, color2: 0xfff0c8, life: [1, 2], size: [0.05, 0.1], drag: 0.3, jitter: 0.4, dir: { x: 3, y: 0.2, z: 1 } });
  }
  // Lava spits now and then from the pools near you.
  if (region === 'cinder' && Math.random() < dt * 3) {
    for (const p of w.lavaPools) {
      if (Math.hypot(p.x - cam.x, p.z - cam.z) > 70) continue;
      const a = Math.random() * 6.28, d = Math.random() * p.r * 0.6;
      ps.emit({ x: p.x + Math.sin(a) * d, y: p.level + 0.2, z: p.z + Math.cos(a) * d, count: 6, speed: 1.5, up: 4, gravity: 9, color: 0xff6a1a, color2: 0xffd060, life: [0.6, 1.2], size: [0.1, 0.2], drag: 0.2 });
    }
  }
}
