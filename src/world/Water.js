// Mirelake: a faceted, gently rippling surface. Colour runs from a clear shallow green to deep
// slate by the depth of the terrain underneath, the sky shows in it at grazing angles, the sun
// glints off the facets, and a soft foam band traces the shore where the depth reaches zero.
import * as THREE from '../lib/three.js';

const VERT = /* glsl */ `
attribute float aDepth;
uniform float uTime;
varying float vDepth;
varying vec3 vWorld;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float calm = smoothstep(0.0, 1.2, aDepth);
  float w = sin(wp.x * 0.37 + uTime * 1.1) * 0.5 + sin(wp.z * 0.43 - uTime * 0.9) * 0.5
          + sin((wp.x + wp.z) * 0.9 + uTime * 1.9) * 0.3;
  wp.y += w * 0.06 * calm;
  vWorld = wp.xyz;
  vDepth = aDepth;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uRain;
uniform float uLight;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform vec3 uFoam;
varying float vDepth;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // Facet normal from screen-space derivatives: flat-shaded like the rest of the Vale.
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  vec3 v = normalize(cameraPosition - vWorld);
  float ndv = max(dot(n, v), 0.0);
  float fres = pow(1.0 - ndv, 4.0);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.2, 3.0, vDepth)) * uLight;
  col = mix(col, uSky, 0.08 + fres * 0.45);
  vec3 h = normalize(uSunDir + v);
  col += uSun * pow(max(dot(n, h), 0.0), 90.0) * 1.4 * step(0.0, uSunDir.y);
  // Rain: a sparkle of tiny rings that come and go.
  if (uRain > 0.0) {
    vec2 cell = floor(vWorld.xz * 1.6);
    float t = fract(uTime * 0.9 + hash(cell) * 7.0);
    float r = length(fract(vWorld.xz * 1.6) - 0.5);
    col += uSky * smoothstep(0.05, 0.0, abs(r - t * 0.45)) * (1.0 - t) * uRain * 0.6;
  }
  float wob = sin(vWorld.x * 1.3 + uTime * 0.8) * sin(vWorld.z * 1.1 - uTime * 0.6);
  float foam = 1.0 - smoothstep(0.04, 0.32 + wob * 0.08, vDepth);
  foam *= 0.75 + 0.25 * sin(uTime * 1.4 + vWorld.x * 0.3 + vWorld.z * 0.2);
  col = mix(col, uFoam * uLight, foam * 0.75);
  float alpha = mix(0.55, 0.9, smoothstep(0.0, 2.2, vDepth)) + fres * 0.1;
  gl_FragColor = vec4(col, clamp(max(alpha, foam), 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// Sky light (see update) at the default golden hour, so the lake keeps its tuned look there.
const GOLDEN_LIGHT = (() => {
  const lum = (c) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  return 0.55 * lum(new THREE.Color(0xa9bad0)) + 2.7 * lum(new THREE.Color(0xffd3a2)) * 0.4;
})();

export class Water {
  // `depthAt(x, z)` returns water level minus terrain height (negative on dry land).
  constructor(scene, lake, level, depthAt) {
    const R = lake.r * 1.05;
    const step = 2.4;
    const n = Math.ceil((R * 2) / step);
    const pos = [], depth = [], idx = [];
    const vid = new Map();
    // A jittered triangle grid clipped to the shore: the jitter keeps the facets from lining up.
    const vert = (i, j) => {
      const key = i * 1000 + j;
      if (vid.has(key)) return vid.get(key);
      const jx = (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
      const jz = (Math.sin(i * 39.346 + j * 11.135) * 24634.6345) % 1;
      const x = -R + i * step + jx * step * 0.3, z = -R + j * step + jz * step * 0.3;
      pos.push(x, 0, z);
      depth.push(Math.max(-1.5, depthAt(lake.x + x, lake.z + z)));
      vid.set(key, pos.length / 3 - 1);
      return pos.length / 3 - 1;
    };
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cx = -R + (i + 0.5) * step, cz = -R + (j + 0.5) * step;
        if (Math.hypot(cx, cz) > R) continue;
        // Skip cells well up the bank: nothing there would be visible above the terrain.
        let wet = false;
        for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (depthAt(lake.x - R + (i + a) * step, lake.z - R + (j + b) * step) > -0.8) wet = true;
        if (!wet) continue;
        const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
        if ((i + j) % 2) idx.push(a, c, b, b, c, d);
        else idx.push(a, c, d, a, d, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();

    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 },
      uRain: { value: 0 },
      uLight: { value: 1 },
      uShallow: { value: new THREE.Color(0x5f7a5c) },
      uDeep: { value: new THREE.Color(0x2c4651) },
      uSky: { value: new THREE.Color(0xd8b88a) },
      uSun: { value: new THREE.Color(0xffcf8a) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uFoam: { value: new THREE.Color(0xe8dcc0) },
    }]);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      fog: true,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(lake.x, level, lake.z);
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  // sky: the Sky (for its current horizon, sun colour and direction). rain: 0..1.
  update(time, sky, rain) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uRain.value = rain;
    if (sky) {
      // What the surface mirrors at a glance: somewhere between the horizon and the zenith.
      u.uSky.value.copy(sky.uniforms.uHorizon.value).lerp(sky.uniforms.uZenith.value, 0.45).lerp(sky.uniforms.uFog.value, sky.uniforms.uHaze.value);
      // Glints follow the key light: the sun by day, the moon by night.
      u.uSun.value.copy(sky.uniforms.uSun.value).multiplyScalar(Math.min(1, sky.sun.intensity / 1.5));
      u.uSunDir.value.copy(sky.lightDir);
      // The water is unlit, so scale its body colour by how much light the Sky is giving
      // (1 at the default golden hour, lower at night and under heavy weather).
      const lum = (c) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
      const b = sky.hemi.intensity * lum(sky.hemi.color) + sky.sun.intensity * lum(sky.sun.color) * 0.4;
      u.uLight.value = Math.min(1.3, b / GOLDEN_LIGHT);
    }
  }
}
