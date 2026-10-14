// Post-processing for 'high' quality: the scene renders to an HDR target, bright parts (fires, lanterns,
// spells, the sun, the spectral horse) bleed a soft glow, then one composite pass grades the colour,
// adds a gentle vignette, and tone-maps to the screen. Hand-written passes, no three.js addons.
import * as THREE from '../lib/three.js';

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Keeps what is brighter than the threshold, with a soft knee so the glow fades in rather than popping.
const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float knee = 0.35;
  float w = clamp((l - uThreshold + knee) / (2.0 * knee), 0.0, 1.0);
  w = l > uThreshold + knee ? 1.0 : w * w;
  gl_FragColor = vec4(c * w, 1.0);
}`;

// 9-tap separable gaussian (linear-sampled weights).
const BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform float uBloom;
uniform float uVignette;
uniform float uSaturation;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform sampler2D tDepth;
uniform float uOutline;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;
float linDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  // Clean style: a thin dark line wherever depth jumps (silhouettes and the edges of blocks), fading
  // out with distance so far hills don't get drawn over.
  if (uOutline > 0.0) {
    float d = linDepth(vUv);
    // The second difference: zero across any flat or evenly sloping surface, large at a silhouette.
    float lx = abs(linDepth(vUv + vec2(uTexel.x, 0.0)) + linDepth(vUv - vec2(uTexel.x, 0.0)) - 2.0 * d);
    float ly = abs(linDepth(vUv + vec2(0.0, uTexel.y)) + linDepth(vUv - vec2(0.0, uTexel.y)) - 2.0 * d);
    float edge = smoothstep(0.012, 0.05, max(lx, ly) / max(d, 0.5));
    edge *= 1.0 - smoothstep(40.0, 140.0, d);
    c = mix(c, c * 0.18, edge * uOutline);
  }
  c += (texture2D(tBloomA, vUv).rgb * 0.6 + texture2D(tBloomB, vUv).rgb * 0.8) * uBloom;
  // Grade: warm the highlights, cool the shadows a touch, then a little extra saturation.
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c *= mix(uShadowTint, uHighlightTint, smoothstep(0.05, 0.9, l));
  c = mix(vec3(l), c, uSaturation);
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.scene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.scene.depthTexture = new THREE.DepthTexture(1, 1);
    this.scene.depthTexture.type = THREE.UnsignedIntType;
    this.half = [new THREE.WebGLRenderTarget(1, 1, rtOpts), new THREE.WebGLRenderTarget(1, 1, rtOpts)];
    this.quarter = [new THREE.WebGLRenderTarget(1, 1, rtOpts), new THREE.WebGLRenderTarget(1, 1, rtOpts)];

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const pass = (frag, uniforms, toneMapped = false) => new THREE.ShaderMaterial({
      uniforms, vertexShader: QUAD_VERT, fragmentShader: frag, depthTest: false, depthWrite: false, toneMapped,
    });
    this.bright = pass(BRIGHT_FRAG, { tScene: { value: null }, uThreshold: { value: 1.05 } });
    this.blur = pass(BLUR_FRAG, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.composite = pass(COMPOSITE_FRAG, {
      tScene: { value: this.scene.texture },
      tBloomA: { value: this.half[0].texture },
      tBloomB: { value: this.quarter[0].texture },
      uBloom: { value: 0.55 },
      uVignette: { value: 0.32 },
      uSaturation: { value: 1.1 },
      uShadowTint: { value: new THREE.Vector3(0.94, 0.97, 1.05) },
      uHighlightTint: { value: new THREE.Vector3(1.04, 1.0, 0.94) },
      tDepth: { value: this.scene.depthTexture },
      uOutline: { value: 0 },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 1000 },
    }, true);
    this.setStyle('clean');
  }

  // 'clean': outlines, a lighter vignette and grade, a softer bloom. 'painterly': the original look.
  setStyle(style) {
    this.style = style;
    const u = this.composite.uniforms, clean = style === 'clean';
    u.uOutline.value = clean ? 0.85 : 0;
    u.uVignette.value = clean ? 0.16 : 0.32;
    u.uBloom.value = clean ? 0.42 : 0.55;
    u.uSaturation.value = clean ? 1.16 : 1.1;
    u.uShadowTint.value.set(clean ? 0.97 : 0.94, clean ? 0.98 : 0.97, clean ? 1.02 : 1.05);
    u.uHighlightTint.value.set(clean ? 1.02 : 1.04, 1.0, clean ? 0.97 : 0.94);
  }

  setSize(w, h) {
    this.scene.setSize(w, h);
    this.composite.uniforms.uTexel.value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
    for (const rt of this.half) rt.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    for (const rt of this.quarter) rt.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
  }

  _draw(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  _blur(pair, src) {
    const [a, b] = pair;
    const u = this.blur.uniforms;
    u.tSrc.value = src;
    u.uDir.value.set(1 / a.width, 0);
    this._draw(this.blur, b);
    u.tSrc.value = b.texture;
    u.uDir.value.set(0, 1 / a.height);
    this._draw(this.blur, a);
  }

  render(scene, camera) {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.scene);
    r.render(scene, camera);
    this.bright.uniforms.tScene.value = this.scene.texture;
    this._draw(this.bright, this.half[1]);
    this._blur(this.half, this.half[1].texture);
    this._blur(this.quarter, this.half[0].texture);
    this._blur(this.quarter, this.quarter[0].texture); // a second, wider pass for the soft halo
    this.composite.uniforms.uNear.value = camera.near;
    this.composite.uniforms.uFar.value = camera.far;
    this._draw(this.composite, null);
  }
}
