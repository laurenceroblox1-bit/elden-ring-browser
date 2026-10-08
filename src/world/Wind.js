// Shared wind. Every swaying material reads the same uniforms, so gusts roll across the Vale
// together and one write per frame animates all of it.
import * as THREE from '../lib/three.js';

export const WIND = {
  uTime: { value: 0 },
  uStrength: { value: 1 },
  uDir: { value: new THREE.Vector2(0.82, 0.57) },
};

// Patches a built-in material so vertices sway by the `aWind` attribute: x = sway in metres at a
// full gust, y = phase. Phases come from world position, so neighbours move together like a gust.
// With `fadeFar`, small props sink into the ground between fadeNear and fadeFar from the camera,
// so their chunks can be dropped past that range without a visible pop.
export function windPatch(material, { fadeNear = 0, fadeFar = 0 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = WIND.uTime;
    shader.uniforms.uWindStrength = WIND.uStrength;
    shader.uniforms.uWindDir = WIND.uDir;
    const fade = fadeFar
      ? `transformed.y -= smoothstep(${fadeNear.toFixed(1)}, ${fadeFar.toFixed(1)}, distance(cameraPosition.xz, transformed.xz)) * 1.6;`
      : '';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aWind;
uniform float uWindTime;
uniform float uWindStrength;
uniform vec2 uWindDir;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  float ph = aWind.y;
  float gust = 0.5 + 0.5 * sin(uWindTime * 0.31 + ph * 0.21);
  float s = sin(uWindTime * 1.7 + ph) * 0.65 + sin(uWindTime * 3.3 + ph * 1.7) * 0.25;
  transformed.xz += uWindDir * (s * (0.35 + gust * 0.65) + gust * 0.45) * aWind.x * uWindStrength;
  ${fade}
}`);
  };
  material.customProgramCacheKey = () => `wind:${fadeNear}:${fadeFar}`;
  return material;
}

// Fog for additive glows: fading to black rather than to the fog colour, which would otherwise
// light up the whole point quad. Use in place of <fog_fragment> (with fog_pars_* included).
export const ADDITIVE_FOG = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
    float fogF = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.rgb *= 1.0 - fogF;
#endif`;

// Shadow-pass twin of a wind material so swaying crowns cast swaying shadows.
export function windDepthMaterial() {
  return windPatch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
}
