// Short-lived gameplay effects that also deal damage: shockwaves and the Warden's falling bells.
import * as THREE from '../lib/three.js';
import { buildBellDrop } from '../models/props.js';

const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
ringGeo.rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 40);
discGeo.rotateX(-Math.PI / 2);
const spikeGeo = new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0);

function fxMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

export class Effects {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  add(fx) {
    this.list.push(fx);
    return fx;
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].update(dt)) {
        this.list[i].dispose();
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const fx of this.list) fx.dispose();
    this.list.length = 0;
  }

  // Expanding ground ring. Anyone on the ring's edge takes the hit; rolling through it dodges.
  shockwave(owner, x, z, o = {}) {
    const game = this.game;
    const m = new THREE.Mesh(ringGeo, fxMaterial(o.color ?? 0xffd9a0, 0.9));
    const y = game.world.getHeight(x, z) + 0.15;
    m.position.set(x, y, z);
    game.scene.add(m);
    const hitSet = new Set();
    let r = o.start ?? 0.5;
    const maxR = o.maxR ?? 9;
    const speed = o.speed ?? 14;
    const thick = o.thickness ?? 1.1;
    return this.add({
      update(dt) {
        r += speed * dt;
        m.scale.set(r, 1, r);
        m.material.opacity = 0.9 * (1 - r / maxR);
        game.combat.ring(owner, x, z, r, thick, o.hit, hitSet);
        if (Math.random() < 0.8) {
          const a = Math.random() * Math.PI * 2;
          game.particles.emit({ x: x + Math.sin(a) * r, y: y + 0.2, z: z + Math.cos(a) * r, count: 2, speed: 1, up: 2, color: o.color ?? 0xffd9a0, life: [0.3, 0.6], size: [0.1, 0.2] });
        }
        return r < maxR;
      },
      dispose() {
        game.scene.remove(m);
        m.material.dispose();
      },
    });
  }

  // A ring of ice spikes bursts out of the ground at (x, z) after `delay` seconds, telegraphed by a
  // pale circle filling in. Anyone standing in it when it erupts is struck (roll out or through).
  iceSpike(owner, x, z, delay, o = {}) {
    const game = this.game;
    const R = o.radius ?? 2.2;
    const y = game.world.getHeight(x, z);
    const ring = new THREE.Mesh(ringGeo, fxMaterial(0xbfe8ff, 0));
    ring.position.set(x, y + 0.12, z);
    ring.scale.set(R, 1, R);
    const disc = new THREE.Mesh(discGeo, fxMaterial(0x7cc8ff, 0));
    disc.position.set(x, y + 0.1, z);
    disc.scale.set(0.01, 1, 0.01);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xcfefff, emissive: 0x3a90d8, emissiveIntensity: 0.8, roughness: 0.15, flatShading: true, transparent: true, opacity: 0.95 });
    const spikes = new THREE.Group();
    const n = o.count ?? 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, d = i ? R * (0.35 + Math.random() * 0.5) : 0;
      const h = (i ? 1.6 + Math.random() * 1.6 : 3.2) * (R / 2.2);
      const m = new THREE.Mesh(spikeGeo, spikeMat);
      m.position.set(Math.sin(a) * d, 0, Math.cos(a) * d);
      m.scale.set(h * 0.2, h, h * 0.2);
      m.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * 3, (Math.random() - 0.5) * 0.5);
      m.castShadow = true;
      spikes.add(m);
    }
    spikes.position.set(x, y, z);
    spikes.scale.set(1, 0.01, 1);
    spikes.visible = false;
    game.scene.add(ring, disc, spikes);
    let t = 0, burst = false;
    const hitSet = new Set();
    return this.add({
      update(dt) {
        t += dt;
        if (!burst) {
          const warn = Math.min(1, t / delay);
          ring.material.opacity = 0.8 * Math.min(1, t * 3);
          disc.material.opacity = 0.28;
          disc.scale.set(R * warn, 1, R * warn);
          if (t >= delay) {
            burst = true;
            spikes.visible = true;
            game.combat.sphere(owner, new THREE.Vector3(x, y + 0.8, z), R, o.hit, hitSet);
            game.audio.playAt('frostbite', { x, z });
            game.particles.emit({ x, y: y + 0.5, z, count: 30, speed: 6, up: 4, color: 0xdff4ff, color2: 0x7cc8ff, life: [0.4, 0.9], size: [0.1, 0.22], drag: 2.5, gravity: 4 });
          }
          return true;
        }
        const u = t - delay;
        spikes.scale.y = u < 0.12 ? Math.max(0.01, u / 0.12) : u > 1.1 ? Math.max(0.01, 1 - (u - 1.1) / 0.5) : 1;
        ring.material.opacity = disc.material.opacity = Math.max(0, 0.6 - u);
        return u < 1.6;
      },
      dispose() {
        game.scene.remove(ring, disc, spikes);
        ring.material.dispose();
        disc.material.dispose();
        spikeMat.dispose();
      },
    });
  }

  // A spectral bell falls from the sky after `delay` seconds onto a telegraphed circle.
  bellDrop(owner, x, z, delay, o = {}) {
    const game = this.game;
    const R = o.radius ?? 2.6;
    const y = game.world.getHeight(x, z);
    const ring = new THREE.Mesh(ringGeo, fxMaterial(0x9fd0ff, 0.0));
    ring.position.set(x, y + 0.12, z);
    ring.scale.set(R, 1, R);
    const disc = new THREE.Mesh(discGeo, fxMaterial(0x6fb6ff, 0.0));
    disc.position.set(x, y + 0.1, z);
    disc.scale.set(0.01, 1, 0.01);
    const bell = buildBellDrop();
    bell.group.position.set(x, y + 16, z);
    bell.group.scale.setScalar(R / 1.5);
    bell.group.visible = false;
    game.scene.add(ring, disc, bell.group);
    let t = 0;
    let landed = false;
    const hitSet = new Set();
    return this.add({
      update(dt) {
        t += dt;
        const warn = Math.min(1, t / delay);
        ring.material.opacity = 0.75 * Math.min(1, t * 3);
        disc.material.opacity = 0.25;
        disc.scale.set(R * warn, 1, R * warn);
        const fallStart = delay - 0.4;
        if (t > fallStart && !landed) {
          bell.group.visible = true;
          const f = Math.min(1, (t - fallStart) / 0.4);
          bell.group.position.y = y + 16 * (1 - f * f);
        }
        if (t >= delay && !landed) {
          landed = true;
          bell.group.position.y = y;
          game.combat.sphere(owner, new THREE.Vector3(x, y + 1, z), R, o.hit, hitSet);
          game.audio.play('bellSmall');
          game.particles.emit({ x, y: y + 0.4, z, count: 40, speed: 7, up: 3, color: 0x9fd0ff, color2: 0xffffff, life: [0.4, 0.9], size: [0.1, 0.24], drag: 2.5 });
          game.cameraShake(0.25, game.player.pos.distanceTo(bell.group.position) < 12 ? 1 : 0.4);
        }
        if (landed) {
          const f = (t - delay) / 0.7;
          bell.material.opacity = 0.85 * (1 - f);
          ring.material.opacity = 0.75 * (1 - f);
          disc.material.opacity = 0.25 * (1 - f);
          return f < 1;
        }
        return true;
      },
      dispose() {
        game.scene.remove(ring, disc, bell.group);
        ring.material.dispose();
        disc.material.dispose();
        bell.material.dispose();
      },
    });
  }
}
