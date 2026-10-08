// Third-person orbit camera with lock-on framing, terrain avoidance, shake and speed FOV.
import * as THREE from '../lib/three.js';
import { clamp, damp, dampAngle, yawTo } from './math.js';
import { ARENA } from '../data/world.js';

const tmp = new THREE.Vector3();

export class CameraRig {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.yaw = 0;
    this.pitch = 0.3;
    this.dist = 5.5;
    this.zoom = 5.5;
    this.focus = new THREE.Vector3();
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.sens = 0.0024;
    this.padYaw = 2.8; // right-stick turn rates at full tilt, radians per second
    this.padPitch = 1.6;
  }

  snapBehind(yaw) {
    this.yaw = yaw + Math.PI;
    this.pitch = 0.28;
    const p = this.game.player.pos;
    this.focus.set(p.x, p.y + 1.55, p.z);
  }

  shake(amount) {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = 0.35;
  }

  update(dt, controllable) {
    const g = this.game;
    const input = g.input;
    const p = g.player;
    if (controllable) {
      this.yaw -= input.mdx * this.sens;
      this.pitch += input.mdy * this.sens;
      if (input.held('camLeft')) this.yaw += 2.2 * dt;
      if (input.held('camRight')) this.yaw -= 2.2 * dt;
      if (input.held('camUp')) this.pitch -= 1.4 * dt;
      if (input.held('camDown')) this.pitch += 1.4 * dt;
      const look = input.look;
      this.yaw -= look.x * this.padYaw * dt;
      this.pitch += look.y * this.padPitch * dt;
      this.zoom = clamp(this.zoom + input.wheel * 0.6, 3, 10);
    }
    const lock = g.lockTarget;
    if (lock) {
      lock.lockPoint(tmp);
      this.yaw = dampAngle(this.yaw, yawTo(tmp.x, tmp.z, p.pos.x, p.pos.z), 7, dt);
      const flat = Math.hypot(tmp.x - p.pos.x, tmp.z - p.pos.z);
      const rise = tmp.y - (p.pos.y + 1.6);
      this.pitch = damp(this.pitch, clamp(0.22 - Math.atan2(rise, flat + 4) * 0.8, 0.05, 0.7), 5, dt);
    }
    this.pitch = clamp(this.pitch, -0.45, 1.25);

    const lift = p.mounted ? 1.25 : 0;
    const fx = p.pos.x, fy = p.pos.y + 1.55 + lift, fz = p.pos.z;
    this.focus.x = damp(this.focus.x, fx, 16, dt);
    this.focus.y = damp(this.focus.y, fy, 10, dt);
    this.focus.z = damp(this.focus.z, fz, 16, dt);
    const want = this.zoom + (p.mounted ? 2 : 0) + (lock ? 0.9 : 0) + (lock === g.boss ? 2.2 : 0);
    this.dist = damp(this.dist, want, 5, dt);

    const cp = Math.cos(this.pitch);
    const ox = Math.sin(this.yaw) * cp, oy = Math.sin(this.pitch), oz = Math.cos(this.yaw) * cp;
    // March toward the camera and pull in where the terrain would block the view.
    let d = this.dist;
    for (let i = 1; i <= 10; i++) {
      const f = (i / 10) * this.dist;
      const x = this.focus.x + ox * f, y = this.focus.y + oy * f, z = this.focus.z + oz * f;
      if (g.world.getHeight(x, z) + 0.45 > y) {
        d = Math.max(1.2, f - this.dist / 10);
        break;
      }
    }
    // Inside the Warden's arena the boom stays within the wall ring, so walls and mist never block the fight.
    if (g.world.inArena(p.pos.x, p.pos.z)) {
      const fx = this.focus.x - ARENA.x, fz = this.focus.z - ARENA.z;
      const r = ARENA.r - 1.8;
      const a = ox * ox + oz * oz, b = 2 * (fx * ox + fz * oz), c = fx * fx + fz * fz - r * r;
      const disc = b * b - 4 * a * c;
      if (a > 1e-6 && disc > 0) d = Math.max(1.2, Math.min(d, (-b + Math.sqrt(disc)) / (2 * a)));
    }
    const cam = this.camera;
    cam.position.set(this.focus.x + ox * d, this.focus.y + oy * d, this.focus.z + oz * d);
    // Squeezed boom (walls, arena edge): rise a little and look past the player instead of at their back.
    const squeeze = Math.max(0, this.dist - d - 0.5);
    cam.position.y += Math.min(1.2, squeeze * 0.25);
    const ahead = Math.min(4, squeeze * 0.6);
    cam.position.y = Math.max(cam.position.y, g.world.getHeight(cam.position.x, cam.position.z) + 0.4);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeAmp * Math.max(0, this.shakeT / 0.35);
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
    } else this.shakeAmp = 0;
    if (lock) {
      // Aim between the player and the target so both stay in frame.
      lock.lockPoint(tmp);
      cam.lookAt(this.focus.x + (tmp.x - this.focus.x) * 0.35, this.focus.y + (tmp.y - this.focus.y) * 0.35 + 0.3, this.focus.z + (tmp.z - this.focus.z) * 0.35);
    } else cam.lookAt(this.focus.x - ox * ahead, this.focus.y, this.focus.z - oz * ahead);

    const fast = p.sprinting || (p.mounted && g.horse.speed > 11);
    const fov = damp(cam.fov, fast ? 67 : 60, 4, dt);
    if (Math.abs(fov - cam.fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }
}
