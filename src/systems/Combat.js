// Hit detection and hit feedback. Attacks are short checks run every frame of an active window;
// a per-swing hitSet makes sure each swing hits a target at most once.
import * as THREE from '../lib/three.js';
import { clamp, angleDiff } from '../core/math.js';

const tmp = new THREE.Vector3();

export class Combat {
  constructor(game) {
    this.game = game;
    this.actors = new Set();
  }

  register(a) { this.actors.add(a); }
  unregister(a) { this.actors.delete(a); }

  *targetsFor(attacker) {
    for (const a of this.actors) {
      if (a !== attacker && a.alive && a.team !== attacker.team) yield a;
    }
  }

  // Melee sector in front of the attacker: within `reach` metres and `arc` radians of facing.
  melee(attacker, hit, hitSet) {
    for (const t of this.targetsFor(attacker)) {
      if (hitSet.has(t)) continue;
      const dx = t.pos.x - attacker.pos.x, dz = t.pos.z - attacker.pos.z;
      const d = Math.hypot(dx, dz);
      if (d - t.radius > hit.reach) continue;
      if (Math.abs(t.pos.y - attacker.pos.y) > (hit.height ?? 2.5)) continue;
      const allowance = Math.atan2(t.radius, Math.max(d, 0.01));
      const facing = attacker.yaw + (hit.yawOffset ?? 0);
      if (d > 0.6 && Math.abs(angleDiff(facing, Math.atan2(dx, dz))) > hit.arc + allowance) continue;
      this.apply(attacker, t, hit, hitSet);
    }
  }

  // Sphere against each target's vertical capsule.
  sphere(attacker, center, radius, hit, hitSet) {
    for (const t of this.targetsFor(attacker)) {
      if (hitSet.has(t)) continue;
      const cy = clamp(center.y, t.pos.y, t.pos.y + t.height);
      const d = Math.hypot(center.x - t.pos.x, center.y - cy, center.z - t.pos.z);
      if (d < radius + t.radius) this.apply(attacker, t, hit, hitSet);
    }
  }

  // Thin expanding ring on the ground (shockwaves, the Warden's toll).
  ring(attacker, cx, cz, r, thickness, hit, hitSet) {
    for (const t of this.targetsFor(attacker)) {
      if (hitSet.has(t)) continue;
      const d = Math.hypot(t.pos.x - cx, t.pos.z - cz);
      if (Math.abs(d - r) > thickness / 2 + t.radius) continue;
      if (t.pos.y - this.game.world.getHeight(t.pos.x, t.pos.z) > 1.2) continue;
      this.apply(attacker, t, hit, hitSet);
    }
  }

  apply(attacker, target, hit, hitSet) {
    if (target.invuln) return; // dodged: not added to hitSet, so a lingering hitbox can still connect
    hitSet.add(target);
    const dx = target.pos.x - attacker.pos.x, dz = target.pos.z - attacker.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const landed = target.takeHit({ ...hit, attacker, dirX: dx / len, dirZ: dz / len });
    if (!landed) return;
    const g = this.game;
    target.lockPoint(tmp);
    tmp.y -= target.lockHeight * 0.25;
    const playerHurt = target === g.player;
    g.particles.emit({
      x: tmp.x, y: tmp.y, z: tmp.z, count: playerHurt ? 18 : 14, speed: 5, up: 1.5,
      color: playerHurt ? 0xc0301e : 0xffc070, color2: playerHurt ? 0x6a1010 : 0xfff0c0,
      life: [0.2, 0.5], size: [0.06, 0.14], gravity: 9, drag: 2,
    });
    g.audio.play(playerHurt ? 'hurt' : 'hit');
    if (playerHurt || attacker === g.player) g.hitstop = Math.max(g.hitstop, hit.heavy ? 0.1 : 0.06);
    g.cameraShake(playerHurt ? 0.3 : 0.14, playerHurt ? 1 : 0.5);
  }
}
