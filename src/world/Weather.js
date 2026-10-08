// Weather: 'clear' | 'ashfall' | 'rain' | 'mist'. Each preset sets fog, light, haze, cloud cover
// and wind, and blends to them over a few seconds. Falling ash and rain are one point cloud in a
// box that wraps around the camera, animated entirely in the vertex shader (no per-frame uploads).
import * as THREE from '../lib/three.js';
import { damp } from '../core/math.js';
import { WIND } from './Wind.js';

export const WEATHER = {
  clear: { fogMul: 1, dim: 0, haze: 0, tint: 0xb7a184, cover: 0.55, wind: 1, fall: null },
  ashfall: { fogMul: 2.3, dim: 0.45, haze: 0.62, tint: 0x8f8a84, cover: 0.9, wind: 0.6, fall: 'ash' },
  rain: { fogMul: 1.6, dim: 0.7, haze: 0.55, tint: 0x8a929a, cover: 1, wind: 1.9, fall: 'rain' },
  mist: { fogMul: 3.6, dim: 0.35, haze: 0.75, tint: 0xd8d4c8, cover: 0.7, wind: 0.35, fall: null },
};

const FALL = {
  ash: { count: 2200, speed: 0.9, size: 0.15, color: 0xd8d2c8, opacity: 0.85, sway: 0.7, streak: 0 },
  rain: { count: 2600, speed: 15, size: 0.55, color: 0xb8c4d2, opacity: 0.38, sway: 0, streak: 1 },
};
const MAX = 2600;
const tmpTint = new THREE.Color();
const BOX = new THREE.Vector3(56, 28, 56);

const VERT = /* glsl */ `
attribute vec3 aSeed;
uniform vec3 uOrigin;
uniform vec3 uBox;
uniform float uTime;
uniform float uSpeed;
uniform float uSway;
uniform float uSize;
uniform float uScale;
uniform vec2 uWind;
varying float vFade;
void main() {
  vec3 p = aSeed * uBox;
  float k = 0.8 + 0.4 * fract(aSeed.x * 37.13);
  p.y -= uTime * uSpeed * k;
  p.xz += uWind * uTime * (0.6 + uSway);
  p.x += sin(uTime * 1.3 + aSeed.y * 40.0) * uSway;
  p.z += cos(uTime * 1.1 + aSeed.z * 40.0) * uSway;
  vec3 lo = uOrigin - uBox * 0.5;
  p = mod(p - lo, uBox) + lo;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Fade out at the edges of the box so the wrap is invisible.
  vec3 q = abs(p - uOrigin) / (uBox * 0.5);
  vFade = 1.0 - smoothstep(0.75, 1.0, max(q.x, max(q.y, q.z)));
  gl_PointSize = uSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uStreak;
varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a;
  if (uStreak > 0.5) a = smoothstep(0.05, 0.0, abs(c.x)) * smoothstep(0.5, 0.1, abs(c.y));
  else a = smoothstep(0.5, 0.15, length(c));
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a * uOpacity * vFade);
  #include <colorspace_fragment>
}`;

export class Weather {
  constructor(scene, sky) {
    this.sky = sky;
    this.name = 'clear';
    const p = WEATHER.clear;
    this.cur = { fogMul: p.fogMul, dim: p.dim, haze: p.haze, cover: p.cover, wind: p.wind, tint: new THREE.Color(p.tint) };
    this.target = WEATHER.clear;
    this.mode = null; // falling particle mode now shown
    this.amount = 0; // 0..1 fade of the falling particles
    this.settled = true;

    const seeds = new Float32Array(MAX * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    g.setDrawRange(0, 0);
    this.uniforms = {
      uOrigin: { value: new THREE.Vector3() },
      uBox: { value: BOX.clone() },
      uTime: { value: 0 },
      uSpeed: { value: 1 },
      uSway: { value: 0 },
      uSize: { value: 0.1 },
      uScale: { value: 600 },
      uWind: { value: new THREE.Vector2() },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 0 },
      uStreak: { value: 0 },
    };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.points.visible = false;
    scene.add(this.points);
  }

  set(name, instant = false) {
    if (!WEATHER[name]) throw new Error(`Unknown weather '${name}' (use ${Object.keys(WEATHER).join(', ')})`);
    this.name = name;
    this.target = WEATHER[name];
    this.settled = false;
    if (instant) this.update(60, 0, null, true);
  }

  // How much rain is falling right now (0..1), for the lake's ripples.
  get rain() {
    return this.mode === 'rain' ? this.amount : 0;
  }

  update(dt, time, camPos, instant = false) {
    const t = this.target, c = this.cur;
    if (!this.settled) {
      const k = instant ? 1 : 1 - Math.exp(-0.6 * dt);
      c.fogMul += (t.fogMul - c.fogMul) * k;
      c.dim += (t.dim - c.dim) * k;
      c.haze += (t.haze - c.haze) * k;
      c.cover += (t.cover - c.cover) * k;
      c.wind += (t.wind - c.wind) * k;
      c.tint.lerp(tmpTint.setHex(t.tint), k);
      if (Math.abs(t.fogMul - c.fogMul) < 0.01 && Math.abs(t.haze - c.haze) < 0.005 && Math.abs(t.dim - c.dim) < 0.005) {
        Object.assign(c, { fogMul: t.fogMul, dim: t.dim, haze: t.haze, cover: t.cover, wind: t.wind });
        c.tint.setHex(t.tint);
        this.settled = true;
      }
      this.sky.setWeatherLook(c);
      WIND.uStrength.value = c.wind;
    }

    // Falling particles fade out before switching kind, then fade in.
    if (this.mode !== t.fall) {
      this.amount = instant ? 0 : damp(this.amount, 0, 2.5, dt);
      if (this.amount < 0.02) {
        this.mode = t.fall;
        this.amount = 0;
        if (this.mode) {
          const f = FALL[this.mode];
          const u = this.uniforms;
          u.uSpeed.value = f.speed;
          u.uSway.value = f.sway;
          u.uSize.value = f.size;
          u.uColor.value.setHex(f.color);
          u.uStreak.value = f.streak;
          this.points.geometry.setDrawRange(0, f.count);
          if (instant) this.amount = 1;
        }
      }
    } else if (this.mode) {
      this.amount = instant ? 1 : damp(this.amount, 1, 0.8, dt);
    }
    const u = this.uniforms;
    u.uOpacity.value = this.mode ? FALL[this.mode].opacity * this.amount : 0;
    this.points.visible = !!this.mode && this.amount > 0.01;
    u.uTime.value = time;
    if (camPos) u.uOrigin.value.copy(camPos);
    u.uWind.value.copy(WIND.uDir.value).multiplyScalar(WIND.uStrength.value * 1.2);
  }

  setViewportScale(s) {
    this.uniforms.uScale.value = s;
  }
}
