// Gradient sky dome with a low golden sun, plus the scene lights and fog that match it.
import * as THREE from '../lib/three.js';

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
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
  col = mix(col, uGround, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSun * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.6);
  col += uSun * smoothstep(0.9993, 0.9997, s) * 4.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const SUN_DIR = new THREE.Vector3(-0.58, 0.36, 0.73).normalize();

export class Sky {
  constructor(scene) {
    this.scene = scene;
    const fogColor = new THREE.Color(0xb7a184);
    scene.fog = new THREE.FogExp2(fogColor, 0.0024);
    scene.background = fogColor;

    this.uniforms = {
      uZenith: { value: new THREE.Color(0x4d5f7d) },
      uHorizon: { value: new THREE.Color(0xd8b88a) },
      uGround: { value: new THREE.Color(0x8f7a60) },
      uSun: { value: new THREE.Color(0xffcf8a) },
      uSunDir: { value: SUN_DIR.clone() },
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

    this.sun = new THREE.DirectionalLight(0xffd3a2, 2.7);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55;
    sc.near = 1; sc.far = 400;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);
  }

  // Bakes the sky into an environment map so metal armour and bronze pick up the sky and sun.
  bakeEnvironment(renderer) {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(this.dome.geometry, this.dome.material));
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.02, 0.1, 2000).texture;
    pmrem.dispose();
  }

  // Keeps the dome centred on the camera and the shadow frustum centred on the action.
  update(cameraPos, focus) {
    this.dome.position.copy(cameraPos);
    const texel = 110 / 2048;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + SUN_DIR.x * 150, focus.y + SUN_DIR.y * 150, fz + SUN_DIR.z * 150);
  }
}
