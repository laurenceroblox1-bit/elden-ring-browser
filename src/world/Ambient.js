// Small life in the Vale: fireflies over Mirelake and the chapel at dusk and night, leaves
// drifting down from the autumn broadleaf trees near the viewer, and pollen over the flowers.
import * as THREE from '../lib/three.js';
import { mulberry32 } from '../core/math.js';
import { LAKE, ZONES } from '../data/world.js';
import { BROAD_HUES } from '../models/props.js';
import { WIND, ADDITIVE_FOG } from './Wind.js';

const FLY_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uScale;
varying float vGlow;
#include <common>
#include <fog_pars_vertex>
void main() {
  float t = uTime * (0.25 + aSeed.w * 0.2);
  vec3 p = position + vec3(sin(t + aSeed.x * 6.28) * 2.2, sin(t * 1.7 + aSeed.y * 6.28) * 0.6, cos(t * 0.8 + aSeed.z * 6.28) * 2.2);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vGlow = pow(0.5 + 0.5 * sin(uTime * (1.5 + aSeed.w * 2.0) + aSeed.x * 40.0), 3.0);
  // Clamped: one drifting past the lens should stay a spark, not a blurry disc.
  gl_PointSize = clamp(0.28 * uScale / max(0.1, -mvPosition.z), 2.0, 14.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FLY_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vGlow;
#include <common>
#include <fog_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * a * (0.15 + vGlow) * uIntensity, 1.0);
  #include <colorspace_fragment>
  ${ADDITIVE_FOG}
}`;

const LEAF_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aRot;
attribute float aAlpha;
uniform float uScale;
varying vec3 vColor;
varying float vRot;
varying float vAlpha;
#include <common>
#include <fog_pars_vertex>
void main() {
  vColor = aColor;
  vRot = aRot;
  vAlpha = aAlpha;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 0.2 * uScale / max(0.1, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const LEAF_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vRot;
varying float vAlpha;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vRot), co = cos(vRot);
  c = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
  // A diamond leaf whose width pulses as it tumbles.
  if (abs(c.x) * (1.4 + abs(sin(vRot * 2.0)) * 1.6) + abs(c.y) > 0.48) discard;
  gl_FragColor = vec4(vColor, vAlpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const LEAVES = 160;

export class Ambient {
  constructor(world, scenery) {
    this.world = world;
    this.scenery = scenery;
    const scene = world.scene;
    const rng = mulberry32(2024);

    // Fireflies: anchors around the lake margin and the chapel; motion and blinking are in the shader.
    const anchors = [];
    const wl = world.waterLevel;
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2, d = LAKE.r * (0.8 + rng() * 0.45);
      const x = LAKE.x + Math.sin(a) * d, z = LAKE.z + Math.cos(a) * d;
      anchors.push([x, Math.max(wl, world.getHeight(x, z)) + 0.6 + rng() * 1.6, z]);
    }
    for (const zn of [ZONES.chapel, ZONES.camp]) {
      if (!zn) continue;
      for (let i = 0; i < 16; i++) {
        const a = rng() * Math.PI * 2, d = 4 + rng() * 14;
        const x = zn.x + Math.sin(a) * d, z = zn.z + Math.cos(a) * d;
        anchors.push([x, world.getHeight(x, z) + 0.5 + rng() * 1.8, z]);
      }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(anchors.flat(), 3));
    fg.setAttribute('aSeed', new THREE.Float32BufferAttribute(anchors.flatMap(() => [rng(), rng(), rng(), rng()]), 4));
    this.flyMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uScale: { value: 500 }, uColor: { value: new THREE.Color(0xd8f080) }, uIntensity: { value: 0 } }]),
      vertexShader: FLY_VERT,
      fragmentShader: FLY_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    });
    this.flies = new THREE.Points(fg, this.flyMat);
    this.flies.renderOrder = 5;
    scene.add(this.flies);

    // Leaves: a small CPU pool, re-spawned from crowns near the viewer.
    this.leaf = {
      pos: new Float32Array(LEAVES * 3), vel: new Float32Array(LEAVES * 3), col: new Float32Array(LEAVES * 3),
      rot: new Float32Array(LEAVES), spin: new Float32Array(LEAVES), alpha: new Float32Array(LEAVES), life: new Float32Array(LEAVES),
    };
    const lg = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.leaf.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.BufferAttribute(this.leaf.rot, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.leaf.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.leaf.col, 3);
    lg.setAttribute('position', this.aPos);
    lg.setAttribute('aRot', this.aRot);
    lg.setAttribute('aAlpha', this.aAlpha);
    lg.setAttribute('aColor', this.aCol);
    this.leafMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 500 } }]),
      vertexShader: LEAF_VERT,
      fragmentShader: LEAF_FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.leaves = new THREE.Points(lg, this.leafMat);
    this.leaves.frustumCulled = false;
    scene.add(this.leaves);
    this.leafColors = BROAD_HUES.map((h) => new THREE.Color(h));
    this.nearTrees = [];
    this.nearFlowers = [];
    this.scanT = 0;
    this.spawnAcc = 0;
    this.pollenAcc = 0;
  }

  _scan(cam) {
    const near = (list, r) => list.filter((t) => Math.abs(t.x - cam.x) < r && Math.abs(t.z - cam.z) < r);
    this.nearTrees = near(this.scenery.broadTrees, 45);
    this.nearFlowers = near(this.scenery.flowerSpots, 26);
  }

  _spawnLeaf(i) {
    const L = this.leaf;
    const t = this.nearTrees[Math.floor(Math.random() * this.nearTrees.length)];
    const a = Math.random() * Math.PI * 2, r = Math.random() * 2.2 * t.s;
    L.pos[i * 3] = t.x + Math.sin(a) * r;
    L.pos[i * 3 + 1] = t.y + (3.4 + Math.random() * 1.8) * t.s;
    L.pos[i * 3 + 2] = t.z + Math.cos(a) * r;
    L.vel[i * 3] = (Math.random() - 0.5) * 0.6;
    L.vel[i * 3 + 1] = -(0.55 + Math.random() * 0.5);
    L.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    L.rot[i] = Math.random() * 6.28;
    L.spin[i] = (Math.random() - 0.5) * 6;
    L.life[i] = 1;
    const c = this.leafColors[Math.floor(Math.random() * this.leafColors.length)];
    L.col[i * 3] = c.r; L.col[i * 3 + 1] = c.g; L.col[i * 3 + 2] = c.b;
    this.aCol.needsUpdate = true;
  }

  // night 0..1, dusk 0..1 from the Sky; weather name; viewport point scale shared with Particles.
  update(dt, time, cam, { night, dusk, weather, scale }) {
    if (scale) {
      this.flyMat.uniforms.uScale.value = scale;
      this.leafMat.uniforms.uScale.value = scale;
    }

    // Fireflies come out at dusk, brightest at night, and hide from rain and ash.
    const calm = weather === 'clear' || weather === 'mist' ? 1 : 0.15;
    const fly = Math.min(1, dusk * 0.8 + night) * calm;
    this.flyMat.uniforms.uIntensity.value = fly * 1.6;
    this.flyMat.uniforms.uTime.value = time;
    this.flies.visible = fly > 0.02;

    if ((this.scanT -= dt) <= 0) {
      this.scanT = 0.5;
      this._scan(cam);
    }

    // Leaves: spawn faster in a stronger wind, carry them on it, tumble, fade out on the ground.
    const L = this.leaf;
    const wind = WIND.uStrength.value, wd = WIND.uDir.value;
    if (this.nearTrees.length) this.spawnAcc += dt * Math.min(40, this.nearTrees.length * 0.9) * (0.4 + wind * 0.6);
    let any = false;
    for (let i = 0; i < LEAVES; i++) {
      if (L.life[i] <= 0) {
        if (this.spawnAcc >= 1 && this.nearTrees.length) {
          this.spawnAcc -= 1;
          this._spawnLeaf(i);
        } else {
          L.alpha[i] = 0;
          continue;
        }
      }
      any = true;
      const k = i * 3;
      const flutter = Math.sin(time * 3 + i) * 0.8;
      L.pos[k] += (L.vel[k] + wd.x * wind * 1.1 + flutter * 0.4) * dt;
      L.pos[k + 1] += L.vel[k + 1] * (1 + Math.sin(time * 4 + i * 1.7) * 0.4) * dt;
      L.pos[k + 2] += (L.vel[k + 2] + wd.y * wind * 1.1) * dt;
      L.rot[i] += L.spin[i] * dt;
      const ground = this.world.getHeight(L.pos[k], L.pos[k + 2]) + 0.05;
      if (L.pos[k + 1] <= ground) {
        L.pos[k + 1] = ground;
        L.vel[k] = L.vel[k + 2] = L.spin[i] = 0;
        L.life[i] -= dt * 0.5;
      }
      L.alpha[i] = Math.min(1, L.life[i] * 3);
    }
    this.spawnAcc = Math.min(this.spawnAcc, 3);
    this.leaves.visible = any;
    if (any) this.aPos.needsUpdate = this.aRot.needsUpdate = this.aAlpha.needsUpdate = true;

    // Pollen drifts up from flower patches on clear days.
    const ps = this.world.game.particles;
    if (weather === 'clear' && night < 0.5 && this.nearFlowers.length) {
      this.pollenAcc += dt * Math.min(8, this.nearFlowers.length * 0.6);
      while (this.pollenAcc >= 1) {
        this.pollenAcc -= 1;
        const f = this.nearFlowers[Math.floor(Math.random() * this.nearFlowers.length)];
        ps.emit({ x: f.x, y: f.y + 0.4, z: f.z, count: 1, speed: 0.15, up: 0.25, jitter: 0.6, color: 0xf0e090, color2: 0xfff4c0, life: [2.5, 4.5], size: [0.03, 0.05], drag: 0.4, dir: { x: wd.x * 0.3, y: 0, z: wd.y * 0.3 } });
      }
    }
  }
}
