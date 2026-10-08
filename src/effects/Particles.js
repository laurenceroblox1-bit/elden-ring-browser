// One pooled additive point cloud for sparks, embers, motes and ash.
import * as THREE from '../lib/three.js';

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d) * vAlpha);
  #include <colorspace_fragment>
}`;

const tmpColor = new THREE.Color();
const tmpColor2 = new THREE.Color();
const rand = (r) => (Array.isArray(r) ? r[0] + Math.random() * (r[1] - r[0]) : r);

export class Particles {
  constructor(scene, max = 2500) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);

    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  setViewport(heightPx, fovDeg) {
    this.material.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  emit(o) {
    const n = o.count ?? 8;
    tmpColor.setHex(o.color ?? 0xffffff);
    tmpColor2.setHex(o.color2 ?? o.color ?? 0xffffff);
    for (let k = 0; k < n; k++) {
      if (this.count >= this.max) return;
      const i = this.count++;
      const j = o.jitter ?? 0;
      this.pos[i * 3] = o.x + (Math.random() - 0.5) * 2 * j;
      this.pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * 2 * j * 0.5;
      this.pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * 2 * j;
      // Random direction, optionally biased by o.dir.
      let vx = Math.random() * 2 - 1, vy = Math.random() * 2 - 1, vz = Math.random() * 2 - 1;
      const l = Math.hypot(vx, vy, vz) || 1;
      const sp = rand(o.speed ?? 2) * (0.4 + Math.random() * 0.6);
      vx = (vx / l) * sp; vy = (vy / l) * sp; vz = (vz / l) * sp;
      if (o.dir) { vx += o.dir.x; vy += o.dir.y; vz += o.dir.z; }
      this.vel[i * 3] = vx;
      this.vel[i * 3 + 1] = vy + (o.up ?? 0) * (0.5 + Math.random() * 0.5);
      this.vel[i * 3 + 2] = vz;
      const t = Math.random();
      this.col[i * 3] = tmpColor.r + (tmpColor2.r - tmpColor.r) * t;
      this.col[i * 3 + 1] = tmpColor.g + (tmpColor2.g - tmpColor.g) * t;
      this.col[i * 3 + 2] = tmpColor.b + (tmpColor2.b - tmpColor.b) * t;
      this.size[i] = rand(o.size ?? [0.08, 0.16]);
      this.maxLife[i] = this.life[i] = rand(o.life ?? [0.4, 0.8]);
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 1.5;
      this.alpha[i] = 1;
    }
  }

  _kill(i) {
    const last = --this.count;
    if (i === last) return;
    for (let a = 0; a < 3; a++) {
      this.pos[i * 3 + a] = this.pos[last * 3 + a];
      this.vel[i * 3 + a] = this.vel[last * 3 + a];
      this.col[i * 3 + a] = this.col[last * 3 + a];
    }
    this.size[i] = this.size[last];
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.grav[i] = this.grav[last];
    this.drag[i] = this.drag[last];
    this.alpha[i] = this.alpha[last];
  }

  update(dt) {
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this._kill(i);
        continue;
      }
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, f * 2.5) * Math.min(1, (1 - f) * 8 + 0.2);
    }
    this.points.geometry.setDrawRange(0, this.count);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }

  clear() {
    this.count = 0;
  }
}
