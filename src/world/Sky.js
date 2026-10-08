// Gradient sky dome with sun, moon and stars, plus the scene lights and fog that match it.
// Time of day drives everything here: Sky.setTimeOfDay(hours) or Sky.cycle = true. The default is
// the Vale's golden hour (17.5), which reproduces the original fixed look exactly.
import * as THREE from '../lib/three.js';
import { clamp, lerp, smoothstep } from '../core/math.js';
import { Clouds, Birds } from './SkyLife.js';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uMoon;
uniform vec3 uFog;
uniform float uHaze;
uniform float uStars;
uniform float uTime;
varying vec3 vDir;
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
  col = mix(col, uGround, smoothstep(0.0, -0.25, h));
  // Weather haze pulls the sky toward the fog colour, most of all near the horizon.
  col = mix(col, uFog, uHaze * (1.0 - smoothstep(-0.1, 0.6, h) * 0.45));
  float s = max(dot(d, uSunDir), 0.0);
  float sunVis = 1.0 - uHaze * 0.85;
  col += uSun * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.6) * sunVis;
  col += uSun * smoothstep(0.9993, 0.9997, s) * 4.0 * sunVis * step(-0.02, uSunDir.y);
  if (uStars > 0.001 && h > 0.0) {
    vec3 p = d * 230.0;
    vec3 c = floor(p);
    float r = hash3(c);
    float star = step(0.9925, r) * smoothstep(0.22, 0.0, length(fract(p) - 0.5));
    star *= 0.6 + 0.4 * sin(uTime * (2.0 + r * 3.0) + r * 90.0);
    col += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.0, 0.25, h) * (1.0 - uHaze);
  }
  // A faceted hexagonal moon, half in shadow.
  float md = dot(d, uMoonDir);
  if (md > 0.99) {
    vec3 t1 = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(t1, uMoonDir);
    vec2 q = vec2(dot(d, t1), dot(d, t2)) / 0.028;
    vec2 aq = abs(q);
    float hex = max(aq.x * 0.866 + aq.y * 0.5, aq.y);
    float sector = floor((atan(q.y, q.x) + 3.1416) / 1.0472);
    float facet = 0.82 + 0.18 * fract(sin(sector * 12.9898) * 43758.5453);
    float lit = mix(0.35, 1.0, smoothstep(-0.6, 0.2, q.x));
    col = mix(col, uMoon * facet * lit * 1.4, (1.0 - smoothstep(0.92, 1.0, hex)) * (1.0 - uHaze * 0.7));
  }
  float mg = max(md, 0.0);
  col += uMoon * (pow(mg, 180.0) * 0.16 + pow(mg, 1500.0) * 0.3) * (1.0 - uHaze * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// The original fixed sun. setTimeOfDay() rewrites this vector in place, so anything holding it
// follows the sun (it is the light direction while the sun is up).
export const SUN_DIR = new THREE.Vector3(-0.58, 0.36, 0.73).normalize();

// Sun path, anchored so 17.5 h lands exactly on the original SUN_DIR.
const GOLDEN = 17.5;
const RISE = 6.0, SET = 19.6;
const EL0 = Math.asin(SUN_DIR.y);
const AZ0 = Math.atan2(SUN_DIR.x, -SUN_DIR.z); // clockwise from north (-Z)
const EMAX = EL0 / Math.sin((Math.PI * (GOLDEN - RISE)) / (SET - RISE));
const NOON = (RISE + SET) / 2;
const AZ_RATE = (AZ0 - Math.PI) / (GOLDEN - NOON); // due south at noon
const AZ_RISE = Math.PI - AZ_RATE * (NOON - RISE), AZ_SET = Math.PI + AZ_RATE * (SET - NOON);
const ENIGHT = 0.62; // how far below the horizon the sun sinks at midnight (radians)

export function sunDirection(hours, out = new THREE.Vector3()) {
  const h = ((hours % 24) + 24) % 24;
  let az, el;
  if (h >= RISE && h <= SET) {
    const t = (h - RISE) / (SET - RISE);
    az = AZ_RISE + (AZ_SET - AZ_RISE) * t;
    el = EMAX * Math.sin(Math.PI * t);
  } else {
    const t = ((h - SET + 24) % 24) / (24 - SET + RISE);
    az = AZ_SET + (AZ_RISE + Math.PI * 2 - AZ_SET) * t;
    el = -ENIGHT * Math.sin(Math.PI * t);
  }
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

// Colour keys through the day. 17.5 is the original golden-hour look, value for value.
const K = (hour, o) => ({ hour, ...o });
const KEYS = [
  K(0, { zenith: 0x0d1830, horizon: 0x2c3a58, ground: 0x1c2028, glow: 0x5a6a90, fog: 0x2a3448, hemiSky: 0x7f95c8, hemiGround: 0x3a3a46, hemiI: 0.95, light: 0xa8c0f0, lightI: 0.7, stars: 1, density: 1.0, moon: 0xdfe6f5 }),
  K(4.6, { zenith: 0x16223e, horizon: 0x4a4a68, ground: 0x24242c, glow: 0x6a6a90, fog: 0x3a3e54, hemiSky: 0x8090c0, hemiGround: 0x3a3840, hemiI: 0.9, light: 0xa8c0f0, lightI: 0.55, stars: 0.85, density: 1.1, moon: 0xdfe6f5 }),
  K(5.8, { zenith: 0x34456e, horizon: 0xc0887a, ground: 0x4a4048, glow: 0xff9a70, fog: 0x8a7478, hemiSky: 0x9aa4c8, hemiGround: 0x4a4038, hemiI: 0.6, light: 0xffb08a, lightI: 0.4, stars: 0.25, density: 1.35, moon: 0xd8dcea }),
  K(7.0, { zenith: 0x48618e, horizon: 0xe4b48e, ground: 0x7a6a5a, glow: 0xffc080, fog: 0xc4a88e, hemiSky: 0xa8b6d4, hemiGround: 0x54483a, hemiI: 0.55, light: 0xffc898, lightI: 1.9, stars: 0, density: 1.3, moon: 0xd8dcea }),
  K(10, { zenith: 0x4a76ac, horizon: 0xcdd0c4, ground: 0x8c8470, glow: 0xfff0d0, fog: 0xbcbcac, hemiSky: 0xb6c6dc, hemiGround: 0x5a4c36, hemiI: 0.6, light: 0xfff0dc, lightI: 2.8, stars: 0, density: 0.9, moon: 0xd8dcea }),
  K(14, { zenith: 0x4a72a6, horizon: 0xd2cdb8, ground: 0x8f8670, glow: 0xfff0d8, fog: 0xc0b8a0, hemiSky: 0xb4c4da, hemiGround: 0x5a4c36, hemiI: 0.6, light: 0xffefd8, lightI: 2.9, stars: 0, density: 0.9, moon: 0xd8dcea }),
  K(GOLDEN, { zenith: 0x4d5f7d, horizon: 0xd8b88a, ground: 0x8f7a60, glow: 0xffcf8a, fog: 0xb7a184, hemiSky: 0xa9bad0, hemiGround: 0x54452f, hemiI: 0.55, light: 0xffd3a2, lightI: 2.7, stars: 0, density: 1.0, moon: 0xd8dcea }),
  K(19.2, { zenith: 0x3a4468, horizon: 0xe08a5a, ground: 0x6a5040, glow: 0xff8a4a, fog: 0xa47a64, hemiSky: 0x9094b8, hemiGround: 0x4a3a2c, hemiI: 0.55, light: 0xff9a60, lightI: 1.6, stars: 0.05, density: 1.05, moon: 0xd8dcea }),
  K(20.3, { zenith: 0x1e2846, horizon: 0x6a5470, ground: 0x2e2a32, glow: 0xc07070, fog: 0x4c4458, hemiSky: 0x8088b8, hemiGround: 0x3a3438, hemiI: 0.8, light: 0xa8b8e8, lightI: 0.5, stars: 0.6, density: 1.05, moon: 0xdfe6f5 }),
  K(21.5, { zenith: 0x0f1a34, horizon: 0x2e3c5c, ground: 0x1c2028, glow: 0x5a6a90, fog: 0x2c3650, hemiSky: 0x7f95c8, hemiGround: 0x3a3a46, hemiI: 0.95, light: 0xa8c0f0, lightI: 0.7, stars: 1, density: 1.0, moon: 0xdfe6f5 }),
].map((k) => {
  const o = { ...k };
  for (const f of ['zenith', 'horizon', 'ground', 'glow', 'fog', 'hemiSky', 'hemiGround', 'light', 'moon']) o[f] = new THREE.Color(k[f]);
  return o;
});
const COLOR_FIELDS = ['zenith', 'horizon', 'ground', 'glow', 'fog', 'hemiSky', 'hemiGround', 'light', 'moon'];
const NUM_FIELDS = ['hemiI', 'lightI', 'stars', 'density'];

const BASE_DENSITY = 0.0024;
const tmpC = new THREE.Color();

export class Sky {
  constructor(scene) {
    this.scene = scene;
    const fogColor = new THREE.Color(0xb7a184);
    scene.fog = new THREE.FogExp2(fogColor, BASE_DENSITY);
    scene.background = fogColor;

    this.uniforms = {
      uZenith: { value: new THREE.Color(0x4d5f7d) },
      uHorizon: { value: new THREE.Color(0xd8b88a) },
      uGround: { value: new THREE.Color(0x8f7a60) },
      uSun: { value: new THREE.Color(0xffcf8a) },
      uSunDir: { value: SUN_DIR.clone() },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uMoon: { value: new THREE.Color(0xd8dcea) },
      uFog: { value: fogColor.clone() },
      uHaze: { value: 0 },
      uStars: { value: 0 },
      uTime: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(1000, 32, 16);
    this.dome = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }));
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.hemi = new THREE.HemisphereLight(0xa9bad0, 0x54452f, 0.55);
    scene.add(this.hemi);

    // `sun` is the key light: the sun by day, the moon by night.
    this.sun = new THREE.DirectionalLight(0xffd3a2, 2.7);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55;
    sc.near = 1; sc.far = 400;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);

    this.clouds = new Clouds(scene);
    this.birds = new Birds(scene);

    this.hours = GOLDEN;
    this.cycle = false; // when true, tick() advances the clock
    this.cycleSpeed = 24 / 720; // in-game hours per real second: a full day in 12 minutes
    this.lightDir = SUN_DIR.clone(); // where the key light comes from right now
    this.moonDir = new THREE.Vector3();
    this.night = 0; // 0 in daylight .. 1 at full night
    this.dusk = 0; // peaks around sunset and dawn
    this.weather = { fogMul: 1, dim: 0, haze: 0, tint: new THREE.Color(0xb7a184), cover: 0.55 };
    this.palette = {};
    for (const f of COLOR_FIELDS) this.palette[f] = new THREE.Color();
    this.renderer = null;
    this.pmrem = null;
    this.envTarget = null;
    this.bakedKey = '';
    this.bakeCooldown = 0;
    this.time = 0;
    this._apply();
  }

  // ---------- time of day ----------

  // hours: 0..24 (wraps). 17.5 is the default golden hour; nights are moonlit and stay playable.
  setTimeOfDay(hours) {
    this.hours = ((hours % 24) + 24) % 24;
    this._apply();
  }

  getTimeOfDay() {
    return this.hours;
  }

  // Weather overlay, set by World.setWeather: fog multiplier, light dimming, sky haze toward `tint`.
  setWeatherLook(look) {
    Object.assign(this.weather, look);
    this._apply();
  }

  // Linear blend between the two keys around `h` (KEYS starts at 0 h, so it wraps at midnight).
  _samplePalette(h) {
    let i = 0;
    for (let j = 0; j < KEYS.length; j++) if (KEYS[j].hour <= h) i = j;
    const a = KEYS[i], b = KEYS[(i + 1) % KEYS.length];
    const tb = b.hour <= a.hour ? b.hour + 24 : b.hour;
    const t = clamp((h - a.hour) / (tb - a.hour), 0, 1);
    const p = this.palette;
    for (const f of COLOR_FIELDS) p[f].copy(a[f]).lerp(b[f], t);
    for (const f of NUM_FIELDS) p[f] = lerp(a[f], b[f], t);
    return p;
  }

  _apply() {
    const p = this._samplePalette(this.hours);
    const w = this.weather;
    const u = this.uniforms;
    const sun = sunDirection(this.hours, SUN_DIR);
    const moon = this.moonDir.set(-sun.x, -sun.y + 0.3, -sun.z).normalize();
    u.uSunDir.value.copy(sun);
    u.uMoonDir.value.copy(moon);

    // The key light crossfades through zero at sunset, so its direction can swap to the moon.
    const sunUp = sun.y > -0.02;
    const k = sunUp ? smoothstep(-0.02, 0.07, sun.y) : smoothstep(-0.02, -0.14, sun.y) * smoothstep(0.0, 0.12, moon.y);
    this.lightDir.copy(sunUp ? sun : moon);
    this.night = p.stars;
    this.dusk = Math.max(0, 1 - Math.abs(sun.y - 0.02) / 0.22) * (1 - p.stars * 0.5);

    // Weather: haze tints toward the weather colour, scaled to the time of day's brightness.
    const lum = (c) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    const haze = tmpC.copy(w.tint).multiplyScalar(lum(p.fog) / Math.max(0.001, lum(w.tint)));
    const fog = this.scene.fog;
    fog.color.copy(p.fog).lerp(haze, w.haze);
    fog.density = BASE_DENSITY * p.density * w.fogMul;
    u.uFog.value.copy(fog.color);
    if (this.scene.background?.isColor) this.scene.background.copy(fog.color);
    u.uHaze.value = w.haze;
    u.uZenith.value.copy(p.zenith);
    u.uHorizon.value.copy(p.horizon);
    u.uGround.value.copy(p.ground);
    u.uSun.value.copy(p.glow);
    u.uMoon.value.copy(p.moon).multiplyScalar(smoothstep(-0.05, 0.1, moon.y) * (0.35 + 0.65 * p.stars));
    u.uStars.value = p.stars;

    this.sun.color.copy(p.light);
    this.sun.intensity = p.lightI * k * (1 - w.dim * 0.85);
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiI * (1 - w.dim * 0.25);

    // Clouds take the light of the hour: warm by day, slate at night, grey under rain.
    const cm = this.clouds.material;
    cm.color.setRGB(1, 1, 1).lerp(fog.color, 0.25 + w.dim * 0.5);
    cm.emissive.copy(p.horizon).lerp(fog.color, 0.5).multiplyScalar((0.55 - w.dim * 0.2) * (1 - p.stars * 0.6));
    this.clouds.cover = w.cover;
  }

  // ---------- environment ----------

  // Bakes the sky into an environment map so metal armour and bronze pick up the sky and sun.
  // Re-baked by update() only when the hour or the weather has visibly changed.
  bakeEnvironment(renderer) {
    this.renderer = renderer;
    if (!this.pmrem) {
      this.pmrem = new THREE.PMREMGenerator(renderer);
      this.envScene = new THREE.Scene();
      this.envScene.add(new THREE.Mesh(this.dome.geometry, this.dome.material));
    }
    const target = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 2000);
    this.scene.environment = target.texture;
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = target;
    this.bakedKey = this._envKey();
  }

  _envKey() {
    const w = this.weather;
    return `${Math.round(this.hours * 4)}|${Math.round(w.haze * 8)}|${Math.round(w.dim * 8)}`;
  }

  // ---------- per frame ----------

  // Advances the clock (when cycling) and the sky's life. World.update calls this every frame.
  tick(dt, camPos) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    if (this.cycle) this.setTimeOfDay(this.hours + dt * this.cycleSpeed);
    this.bakeCooldown -= dt;
    this.clouds.update(dt, camPos);
    this.birds.update(this.time, this.night < 0.6 && this.weather.dim < 0.5);
  }

  // Keeps the dome centred on the camera and the shadow frustum centred on the action.
  update(cameraPos, focus) {
    this.dome.position.copy(cameraPos);
    const texel = 110 / 2048;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    const d = this.lightDir;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + d.x * 150, focus.y + Math.max(0.15, d.y) * 150, fz + d.z * 150);
    if (this.renderer && this.bakeCooldown <= 0 && this._envKey() !== this.bakedKey) {
      this.bakeEnvironment(this.renderer);
      this.bakeCooldown = 1.5;
    }
  }
}
