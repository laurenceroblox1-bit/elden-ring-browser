// Things that live in the sky: drifting low-poly clouds and circling flocks of crows.
// Each is a single InstancedMesh, so the whole sky costs two draw calls.
import * as THREE from '../lib/three.js';
import { mulberry32 } from '../core/math.js';
import { WIND } from './Wind.js';

const dummy = new THREE.Object3D();

export class Clouds {
  constructor(scene, count = 22) {
    const rng = mulberry32(404);
    this.max = count;
    this.clouds = [];
    const puffs = [];
    for (let i = 0; i < count; i++) {
      const c = { x: (rng() - 0.5) * 1600, z: (rng() - 0.5) * 1600, y: 175 + rng() * 70, s: 0.8 + rng() * 0.7, puffs: [] };
      const n = 3 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const t = n === 1 ? 0 : k / (n - 1) - 0.5;
        c.puffs.push({ dx: t * 34 + (rng() - 0.5) * 6, dy: (1 - Math.abs(t) * 1.6) * 4 + rng() * 2, dz: (rng() - 0.5) * 10, sx: 13 + rng() * 9, sy: 6 + rng() * 4, sz: 11 + rng() * 6, ry: rng() * 6 });
        puffs.push([i, k]);
      }
      this.clouds.push(c);
    }
    this.puffIndex = puffs;
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, emissive: 0x8a7a68, emissiveIntensity: 0.55, fog: false });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.material, puffs.length);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -5;
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    scene.add(this.mesh);
    this.cover = 0.55; // fraction of clouds shown; weather raises it
    this.drift = 0;
  }

  // Clouds drift with the wind and wrap around the viewer so the sky never empties.
  update(dt, camPos) {
    this.drift += dt;
    const dir = WIND.uDir.value;
    const speed = 2.2 * Math.max(0.5, WIND.uStrength.value);
    const shown = Math.round(this.max * this.cover);
    let n = 0;
    for (const [ci, k] of this.puffIndex) {
      const c = this.clouds[ci];
      if (ci >= shown) continue;
      if (k === 0) {
        c.x += dir.x * speed * dt;
        c.z += dir.y * speed * dt;
        const rx = c.x - camPos.x, rz = c.z - camPos.z;
        if (rx > 800) c.x -= 1600; else if (rx < -800) c.x += 1600;
        if (rz > 800) c.z -= 1600; else if (rz < -800) c.z += 1600;
      }
      const p = c.puffs[k];
      dummy.position.set(c.x + p.dx * c.s, c.y + p.dy * c.s, c.z + p.dz * c.s);
      dummy.rotation.set(0, p.ry, 0);
      dummy.scale.set(p.sx * c.s, p.sy * c.s, p.sz * c.s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(n++, dummy.matrix);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const FLOCKS = [
  { x: -195, z: 42, r: 55, h: 46, w: 0.16 }, // over Mirelake
  { x: 130, z: 32, r: 38, h: 40, w: -0.21 }, // over the Watch Ruins
  { x: 0, z: -262, r: 46, h: 58, w: 0.13 }, // crows over the Shattered Gate
];
const PER_FLOCK = 7;

export class Birds {
  constructor(scene) {
    const rng = mulberry32(77);
    // A V of two thin wings; the vertex shader flaps the tips.
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0.25, -0.85, 0.05, -0.1, 0, 0, -0.2,
      0, 0, 0.25, 0, 0, -0.2, 0.85, 0.05, -0.1,
      0, 0.02, 0.35, -0.08, 0, -0.1, 0.08, 0, -0.1,
    ], 3));
    g.computeVertexNormals();
    const phase = new Float32Array(FLOCKS.length * PER_FLOCK);
    this.birds = [];
    FLOCKS.forEach((f, fi) => {
      for (let i = 0; i < PER_FLOCK; i++) {
        phase[fi * PER_FLOCK + i] = rng() * 6.28;
        this.birds.push({ f, a0: rng() * 0.5 - i * 0.06, dr: (rng() - 0.5) * 9, dh: (rng() - 0.5) * 5, bob: rng() * 6.28 });
      }
    });
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    this.uTime = { value: 0 };
    const m = new THREE.MeshBasicMaterial({ color: 0x2a2420, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aPhase;\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        float flap = sin(uTime * 9.0 + aPhase) * 0.5 + 0.5;
        flap = mix(flap, 0.35, step(0.5, sin(uTime * 0.7 + aPhase * 3.0))); // glide now and then
        transformed.y += abs(position.x) * (flap - 0.4) * 0.9;`);
    };
    m.customProgramCacheKey = () => 'birds';
    this.mesh = new THREE.InstancedMesh(g, m, this.birds.length);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
  }

  update(time, visible) {
    this.uTime.value = time;
    this.mesh.visible = visible;
    if (!visible) return;
    this.birds.forEach((b, i) => {
      const f = b.f;
      const a = time * f.w + b.a0;
      const r = f.r + b.dr;
      const x = f.x + Math.sin(a) * r, z = f.z + Math.cos(a) * r;
      const y = f.h + b.dh + Math.sin(time * 0.8 + b.bob) * 1.5;
      dummy.position.set(x, y, z);
      // Heading: the tangent of the circle, banked into the turn.
      const heading = a + (f.w > 0 ? Math.PI / 2 : -Math.PI / 2);
      dummy.rotation.set(0, heading, f.w > 0 ? -0.25 : 0.25, 'YXZ');
      dummy.scale.setScalar(1.3);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
