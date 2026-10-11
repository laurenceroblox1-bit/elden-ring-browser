// Short-lived gameplay effects that also deal damage: shockwaves and the Warden's falling bells.
import * as THREE from '../lib/three.js';
import { buildBellDrop } from '../models/props.js';

const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
ringGeo.rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 40);
discGeo.rotateX(-Math.PI / 2);
const spikeGeo = new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function fxMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

// Looks for iceSpike: ice (the default), the Bloom Witch's thorns, the Amberwood's roots, crystal.
const SPIKE_LOOKS = {
  ice: { ring: 0xbfe8ff, disc: 0x7cc8ff, color: 0xcfefff, emissive: 0x3a90d8, ei: 0.8, rough: 0.15, sound: 'frostbite', p1: 0xdff4ff, p2: 0x7cc8ff },
  thorn: { ring: 0xf080e0, disc: 0x9a3a8a, color: 0x4a3a58, emissive: 0x7a2a8a, ei: 0.6, rough: 0.8, sound: 'spore', p1: 0x9ae070, p2: 0xd070f0 },
  root: { ring: 0xffb050, disc: 0x8a4a1a, color: 0x5a3e28, emissive: 0x8a4a10, ei: 0.4, rough: 0.9, sound: 'slam', p1: 0xc8742e, p2: 0x6a4a2a },
  bone: { ring: 0xe8f0c0, disc: 0x6a7a4a, color: 0xe0d6bc, emissive: 0x4a5a2a, ei: 0.3, rough: 0.8, sound: 'slam', p1: 0xe0d6bc, p2: 0x90f060 },
  iron: { ring: 0xffb090, disc: 0x8a3a2a, color: 0x5a5a60, emissive: 0x000000, ei: 0, rough: 0.4, sound: 'slam', p1: 0xc8c0b8, p2: 0x8a8480 },
  crystal: { ring: 0xd8c0ff, disc: 0x8a60e0, color: 0xe0d8ff, emissive: 0x7a50e0, ei: 1.0, rough: 0.1, sound: 'crack', p1: 0xe8f4ff, p2: 0xb890ff },
};

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
  // (Effects from the local player, and from shared enemies on the multiplayer host, are sent to the
  // other players, who draw them with `ghostFx`: the look without the damage. See net/Coop.js.)
  shockwave(owner, x, z, o = {}) {
    const game = this.game;
    game.net?.coop.fx('wave', owner, o, { x, z });
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
        if (o.hit && !o.ghostFx) game.combat.ring(owner, x, z, r, thick, o.hit, hitSet);
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
    game.net?.coop.fx('spike', owner, o, { x, z, delay });
    const R = o.radius ?? 2.2;
    const y = game.world.getHeight(x, z);
    // o.look 'thorn': the Bloom Witch's roots; 'root': the Amberwood's; 'crystal': the Shardlands'.
    const L = SPIKE_LOOKS[o.look] ?? SPIKE_LOOKS.ice;
    const ring = new THREE.Mesh(ringGeo, fxMaterial(L.ring, 0));
    ring.position.set(x, y + 0.12, z);
    ring.scale.set(R, 1, R);
    const disc = new THREE.Mesh(discGeo, fxMaterial(L.disc, 0));
    disc.position.set(x, y + 0.1, z);
    disc.scale.set(0.01, 1, 0.01);
    const spikeMat = new THREE.MeshStandardMaterial({ color: L.color, emissive: L.emissive, emissiveIntensity: L.ei, roughness: L.rough, flatShading: true, transparent: true, opacity: 0.97 });
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
            if (o.hit && !o.ghostFx) game.combat.sphere(owner, new THREE.Vector3(x, y + 0.8, z), R, o.hit, hitSet);
            game.audio.playAt(L.sound, { x, z });
            game.particles.emit({ x, y: y + 0.5, z, count: 30, speed: 6, up: 4, color: L.p1, color2: L.p2, life: [0.4, 0.9], size: [0.1, 0.22], drag: 2.5, gravity: 4 });
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

  // A lingering hazard on the ground: a patch of fire (o.look 'fire') or a cloud of spores ('spore').
  // Anyone inside is struck every half second for `life` seconds (o.hit, usually light with burn or
  // poison buildup). Fades in, holds, fades out.
  hazard(owner, x, z, o = {}) {
    const game = this.game;
    game.net?.coop.fx('haz', owner, o, { x, z });
    const R = o.radius ?? 3, life = o.life ?? 5, spore = o.look === 'spore';
    const color = o.color ?? (spore ? 0x8acb3a : 0xff6a1a);
    const y = game.world.getHeight(x, z);
    const disc = new THREE.Mesh(discGeo, fxMaterial(color, 0));
    disc.position.set(x, y + 0.12, z);
    disc.scale.set(R, 1, R);
    game.scene.add(disc);
    let t = 0, tick = 0;
    const center = new THREE.Vector3(x, y + 0.8, z);
    return this.add({
      update(dt) {
        t += dt;
        const a = Math.min(1, t * 4) * Math.min(1, (life - t) * 1.5);
        disc.material.opacity = (spore ? 0.22 : 0.3) * a;
        if ((tick -= dt) <= 0 && o.hit && !o.ghostFx && t > 0.2) {
          tick = 0.5;
          game.combat.sphere(owner, center, R * 0.9, o.hit, new Set());
        }
        if (Math.random() < dt * R * (spore ? 6 : 10)) {
          const ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R;
          game.particles.emit(spore
            ? { x: x + Math.sin(ang) * d, y: y + 0.3 + Math.random(), z: z + Math.cos(ang) * d, count: 1, speed: 0.3, up: 0.5, color, color2: 0xc070e0, life: [0.8, 1.6], size: [0.15, 0.3], drag: 1, jitter: 0.3 }
            : { x: x + Math.sin(ang) * d, y: y + 0.2, z: z + Math.cos(ang) * d, count: 1, speed: 0.5, up: 2.5, color, color2: 0xffd060, life: [0.3, 0.7], size: [0.1, 0.22], drag: 1, jitter: 0.2 });
        }
        return t < life;
      },
      dispose() {
        game.scene.remove(disc);
        disc.material.dispose();
      },
    });
  }

  // A bolt of lightning strikes (x, z) after `delay` seconds, telegraphed by a crackling white circle
  // on the ground. Anyone in it when it lands is struck (o.hit); the flash lights up the country round.
  lightning(owner, x, z, delay, o = {}) {
    const game = this.game;
    game.net?.coop.fx('bolt', owner, o, { x, z, delay });
    const R = o.radius ?? 2.2;
    const y = game.world.getHeight(x, z);
    const ring = new THREE.Mesh(ringGeo, fxMaterial(o.color ?? 0xdff0ff, 0));
    ring.position.set(x, y + 0.12, z);
    ring.scale.set(R, 1, R);
    const disc = new THREE.Mesh(discGeo, fxMaterial(o.color ?? 0x9fc8ff, 0));
    disc.position.set(x, y + 0.1, z);
    disc.scale.set(0.01, 1, 0.01);
    // The bolt: a jagged chain of thin glowing boxes from the clouds to the ground.
    const bolt = new THREE.Group();
    const boltMat = fxMaterial(0xeef6ff, 1);
    let px = x, py = y + (o.height ?? 45), pz = z;
    const n = 9;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const nx = i === n ? x : x + (Math.random() - 0.5) * 5 * (1 - u * 0.6), ny = y + (o.height ?? 45) * (1 - u), nz = i === n ? z : z + (Math.random() - 0.5) * 5 * (1 - u * 0.6);
      const len = Math.hypot(nx - px, ny - py, nz - pz);
      const seg = new THREE.Mesh(boxGeo, boltMat);
      seg.position.set((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2);
      seg.scale.set(0.35, len, 0.35);
      seg.lookAt(nx, ny, nz);
      seg.rotateX(Math.PI / 2);
      bolt.add(seg);
      px = nx; py = ny; pz = nz;
    }
    bolt.visible = false;
    game.scene.add(ring, disc, bolt);
    let t = 0, struck = false;
    const hitSet = new Set();
    return this.add({
      update(dt) {
        t += dt;
        if (!struck) {
          const warn = Math.min(1, t / delay);
          ring.material.opacity = (0.5 + Math.random() * 0.4) * Math.min(1, t * 3);
          disc.material.opacity = 0.22;
          disc.scale.set(R * warn, 1, R * warn);
          if (t >= delay) {
            struck = true;
            if (o.noBolt) return true; // just the warning circle (something else comes up out of it)
            bolt.visible = true;
            if (o.hit && !o.ghostFx) game.combat.sphere(owner, new THREE.Vector3(x, y + 0.9, z), R, o.hit, hitSet);
            const d = Math.hypot(game.player.pos.x - x, game.player.pos.z - z);
            game.audio.playAt('crack', { x, z }, 120);
            game.after?.(Math.min(2, d / 120), () => game.audio.play('thunder'));
            game.particles.emit({ x, y: y + 0.5, z, count: 40, speed: 7, up: 3, color: 0xeef6ff, color2: 0x8fc8ff, life: [0.2, 0.6], size: [0.08, 0.2], drag: 2.5, gravity: 4 });
            game.world.biomes?.flash?.(x, y + 6, z);
            if (d < 25) game.cameraShake(0.3, d < 10 ? 1 : 0.5);
          }
          return true;
        }
        const u = t - delay;
        bolt.visible = !o.noBolt && (u < 0.08 || (u > 0.12 && u < 0.2));
        ring.material.opacity = disc.material.opacity = Math.max(0, 0.5 - u);
        return u < 0.6;
      },
      dispose() {
        game.scene.remove(ring, disc, bolt);
        ring.material.dispose();
        disc.material.dispose();
        boltMat.dispose();
      },
    });
  }

  // A spectral bell falls from the sky after `delay` seconds onto a telegraphed circle.
  bellDrop(owner, x, z, delay, o = {}) {
    const game = this.game;
    game.net?.coop.fx('bell', owner, o, { x, z, delay });
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
          if (o.hit && !o.ghostFx) game.combat.sphere(owner, new THREE.Vector3(x, y + 1, z), R, o.hit, hitSet);
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
