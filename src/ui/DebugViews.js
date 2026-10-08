// Test-menu views: hitbox outlines (body capsules and attack reach), world colliders around you,
// and a free-flying camera. All drawn with plain line geometry so they cost almost nothing.
import * as THREE from '../lib/three.js';

const RING = 20; // segments per circle
const COLLIDER_RADIUS = 45; // metres around the player
const lineMat = (color) => new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85, fog: false });

// Grows a Float32Array line buffer on demand.
class Lines {
  constructor(scene, color) {
    this.max = 4096;
    this.pos = new Float32Array(this.max * 6);
    this.geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.attr);
    this.obj = new THREE.LineSegments(this.geo, lineMat(color));
    this.obj.frustumCulled = false;
    this.obj.renderOrder = 20;
    this.obj.visible = false;
    scene.add(this.obj);
    this.n = 0;
  }

  begin() { this.n = 0; }

  seg(ax, ay, az, bx, by, bz) {
    if (this.n >= this.max) return;
    const i = this.n++ * 6;
    this.pos[i] = ax; this.pos[i + 1] = ay; this.pos[i + 2] = az;
    this.pos[i + 3] = bx; this.pos[i + 4] = by; this.pos[i + 5] = bz;
  }

  circle(x, y, z, r) {
    for (let k = 0; k < RING; k++) {
      const a = (k / RING) * Math.PI * 2, b = ((k + 1) / RING) * Math.PI * 2;
      this.seg(x + Math.sin(a) * r, y, z + Math.cos(a) * r, x + Math.sin(b) * r, y, z + Math.cos(b) * r);
    }
  }

  end() {
    this.geo.setDrawRange(0, this.n * 2);
    this.attr.needsUpdate = true;
  }
}

export class DebugViews {
  constructor(game) {
    this.game = game;
    this.hitboxes = false;
    this.colliders = false;
    this.free = null; // { yaw, pitch } while flying
    this.bodies = new Lines(game.scene, 0x7cff9a);
    this.danger = new Lines(game.scene, 0xff5a4a);
    this.walls = new Lines(game.scene, 0x7ac8ff);
    this.wallT = 0;
  }

  setHitboxes(on) {
    this.hitboxes = on;
    this.bodies.obj.visible = this.danger.obj.visible = on;
  }

  setColliders(on) {
    this.colliders = on;
    this.walls.obj.visible = on;
    this.wallT = 0;
  }

  // ---------- free camera ----------

  setFreeCam(on) {
    const cam = this.game.camera;
    if (on) {
      const dir = cam.getWorldDirection(new THREE.Vector3());
      this.free = { yaw: Math.atan2(dir.x, dir.z), pitch: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) };
    } else {
      this.free = null;
      this.game.cam.snapBehind(this.game.player.yaw);
    }
  }

  // WASD flies along the view, E/Q rise and sink, Shift goes fast. Called instead of the camera rig.
  updateFreeCam(dt) {
    const g = this.game, i = g.input, f = this.free, cam = g.camera;
    f.yaw -= i.mdx * 0.0024 + i.look.x * 2.4 * dt;
    f.pitch = THREE.MathUtils.clamp(f.pitch - i.mdy * 0.0024 - i.look.y * 1.4 * dt, -1.5, 1.5);
    const speed = (i.held('sprint') ? 40 : 10) * dt;
    const cp = Math.cos(f.pitch);
    const fx = Math.sin(f.yaw) * cp, fy = Math.sin(f.pitch), fz = Math.cos(f.yaw) * cp;
    const ax = i.axis();
    const rx = -Math.cos(f.yaw), rz = Math.sin(f.yaw);
    cam.position.x += (fx * ax.y + rx * ax.x) * speed;
    cam.position.y += fy * ax.y * speed + ((i.held('interact') ? 1 : 0) - (i.held('lockOn') ? 1 : 0)) * speed;
    cam.position.z += (fz * ax.y + rz * ax.x) * speed;
    cam.lookAt(cam.position.x + fx, cam.position.y + fy, cam.position.z + fz);
  }

  // ---------- per frame ----------

  update(dt) {
    if (this.hitboxes) this._drawHitboxes();
    if (this.colliders && (this.wallT -= dt) <= 0) {
      this.wallT = 0.4;
      this._drawColliders();
    }
  }

  _drawHitboxes() {
    const g = this.game, b = this.bodies, d = this.danger;
    b.begin();
    d.begin();
    const actors = [g.player, g.boss, ...g.enemies].filter((a) => a.alive && a.model?.root.visible !== false);
    for (const a of actors) {
      const top = a.pos.y + a.height;
      const lines = a.invuln ? d : b; // invulnerable (rolling, cutscene) shows red
      lines.circle(a.pos.x, a.pos.y + 0.05, a.pos.z, a.radius);
      lines.circle(a.pos.x, top, a.pos.z, a.radius);
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2;
        const x = a.pos.x + Math.sin(ang) * a.radius, z = a.pos.z + Math.cos(ang) * a.radius;
        lines.seg(x, a.pos.y + 0.05, z, x, top, z);
      }
      // Attack reach: a wedge on the ground for whoever is swinging (reach and arc of the current hit).
      const hit = a.hit;
      const attacking = hit && hit.reach && (a.state === 'attack' || (a === g.player && a.atk));
      if (attacking) {
        const y = a.pos.y + 0.12, steps = 10;
        const from = a.yaw + (hit.yawOffset ?? 0) - hit.arc, to = a.yaw + (hit.yawOffset ?? 0) + hit.arc;
        let px = a.pos.x + Math.sin(from) * hit.reach, pz = a.pos.z + Math.cos(from) * hit.reach;
        d.seg(a.pos.x, y, a.pos.z, px, y, pz);
        for (let k = 1; k <= steps; k++) {
          const ang = from + ((to - from) * k) / steps;
          const x = a.pos.x + Math.sin(ang) * hit.reach, z = a.pos.z + Math.cos(ang) * hit.reach;
          d.seg(px, y, pz, x, y, z);
          px = x;
          pz = z;
        }
        d.seg(px, y, pz, a.pos.x, y, a.pos.z);
      }
    }
    b.end();
    d.end();
  }

  _drawColliders() {
    const g = this.game, w = g.world, L = this.walls, p = g.player.pos;
    L.begin();
    const near = (x, z, r) => Math.hypot(x - p.x, z - p.z) < COLLIDER_RADIUS + r;
    for (const c of w.circles) {
      if (!near(c.x, c.z, c.r)) continue;
      const y = w.getHeight(c.x, c.z) + 0.15;
      L.circle(c.x, y, c.z, c.r);
    }
    for (const bx of [...w.boxes, ...w.dynamic]) {
      if (bx.enabled === false || !near(bx.x, bx.z, Math.hypot(bx.hx, bx.hz))) continue;
      const corner = (sx, sz) => {
        // Box space to world: x' = lx*c + lz*s, z' = -lx*s + lz*c (matches World._pushBox).
        const lx = sx * bx.hx, lz = sz * bx.hz;
        const x = bx.x + lx * bx.c + lz * bx.s, z = bx.z - lx * bx.s + lz * bx.c;
        return [x, w.getHeight(x, z) + 0.15, z];
      };
      const cs = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      for (let k = 0; k < 4; k++) L.seg(...cs[k], ...cs[(k + 1) % 4]);
    }
    L.end();
  }
}
