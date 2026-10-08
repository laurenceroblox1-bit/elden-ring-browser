// Hit detection and hit feedback. Attacks are short checks run every frame of an active window;
// a per-swing hitSet makes sure each swing hits a target at most once.
//
// Hit flags (all optional on the hit object):
//   parryable   - can be parried. Defaults to true for enemy melee() swings, false for ring/sphere/strike.
//   unblockable - goes straight through any guard (must be rolled). Defaults to false.
//   heavy       - bigger stagger and knockback; breaks an enemy's shield guard.
//   riposte     - a scripted critical blow (see Player riposte); targets skip their poise logic.
//   backstab    - melee only: damage multiplier when the attacker strikes the target's back (it also staggers).
// takeHit(hit) returns false (ignored), true (landed), or a guard outcome: 'block', 'parry' or 'break'.
import * as THREE from '../lib/three.js';
import { clamp, angleDiff } from '../core/math.js';
import { glowSprite } from '../models/kit.js';

const tmp = new THREE.Vector3();
const FLASHES = 3;

export class Combat {
  constructor(game) {
    this.game = game;
    this.actors = new Set();
    // A tiny pool of additive glow sprites for parry and guard-break flashes: no allocation mid-fight.
    this.flashes = [];
    for (let i = 0; i < FLASHES; i++) {
      const s = glowSprite(0xffffff, 1, 0);
      s.visible = false;
      s.renderOrder = 6;
      game.scene.add(s);
      this.flashes.push({ s, t: 0, life: 0, size: 1 });
    }
    this.nextFlash = 0;
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
      // From behind: the attacker stands within ~70 degrees of straight behind the target.
      const h = hit.backstab && Math.abs(angleDiff(t.yaw, Math.atan2(-dx, -dz))) > 1.95
        ? { ...hit, dmg: hit.dmg * hit.backstab, heavy: true, backstabbed: true } : hit;
      this.apply(attacker, t, h, hitSet, attacker.pos.x, attacker.pos.z, hit.parryable ?? attacker.team !== 'player');
    }
  }

  // Sphere against each target's vertical capsule. Never parryable (there's no blade to deflect).
  sphere(attacker, center, radius, hit, hitSet) {
    for (const t of this.targetsFor(attacker)) {
      if (hitSet.has(t)) continue;
      const cy = clamp(center.y, t.pos.y, t.pos.y + t.height);
      const d = Math.hypot(center.x - t.pos.x, center.y - cy, center.z - t.pos.z);
      if (d < radius + t.radius) this.apply(attacker, t, hit, hitSet, center.x, center.z, false);
    }
  }

  // Thin expanding ring on the ground (shockwaves, the Warden's toll). Never parryable.
  ring(attacker, cx, cz, r, thickness, hit, hitSet) {
    for (const t of this.targetsFor(attacker)) {
      if (hitSet.has(t)) continue;
      const d = Math.hypot(t.pos.x - cx, t.pos.z - cz);
      if (Math.abs(d - r) > thickness / 2 + t.radius) continue;
      if (t.pos.y - this.game.world.getHeight(t.pos.x, t.pos.z) > 1.2) continue;
      this.apply(attacker, t, hit, hitSet, cx, cz, false);
    }
  }

  // A scripted blow on one known target (ripostes). Skips the reach/arc test.
  strike(attacker, target, hit) {
    if (!target.alive) return false;
    return this.apply(attacker, target, hit, new Set(), attacker.pos.x, attacker.pos.z, false);
  }

  // (ox, oz) is where the blow comes from, so guards can tell front from back.
  apply(attacker, target, hit, hitSet, ox = attacker.pos.x, oz = attacker.pos.z, parryable = false) {
    if (target.invuln) return false; // dodged: not added to hitSet, so a lingering hitbox can still connect
    hitSet.add(target);
    const dx = target.pos.x - ox, dz = target.pos.z - oz;
    const len = Math.hypot(dx, dz);
    const h = {
      ...hit, attacker, parryable, unblockable: !!hit.unblockable,
      dirX: len > 1e-3 ? dx / len : -target.forwardX, dirZ: len > 1e-3 ? dz / len : -target.forwardZ,
    };
    if (attacker === this.game.player && this.game.cheats?.oneHit) h.dmg = 99999; // test menu
    const result = target.takeHit(h);
    if (!result) return result;
    // Frost: a blow that lands builds frostbite; a guarded one lets a little of the cold through.
    if (h.frost && result !== 'parry' && target.alive) target.addFrost(result === 'block' ? h.frost * 0.35 : h.frost);
    this.feedback(attacker, target, h, result);
    return result;
  }

  feedback(attacker, target, hit, result) {
    const g = this.game;
    target.lockPoint(tmp);
    tmp.y -= target.lockHeight * 0.25;
    const playerHurt = target === g.player;
    const byPlayer = attacker === g.player;
    if (result === true) {
      g.particles.emit({
        x: tmp.x, y: tmp.y, z: tmp.z, count: playerHurt ? 18 : 14, speed: 5, up: 1.5,
        color: playerHurt ? 0xc0301e : 0xffc070, color2: playerHurt ? 0x6a1010 : 0xfff0c0,
        life: [0.2, 0.5], size: [0.06, 0.14], gravity: 9, drag: 2,
      });
      g.audio.play(playerHurt ? 'hurt' : 'hit');
      if (playerHurt || byPlayer) g.hitstop = Math.max(g.hitstop, hit.heavy ? 0.1 : 0.06);
      g.cameraShake(playerHurt ? 0.3 : 0.14, playerHurt ? 1 : 0.5);
      return;
    }
    // Guard outcomes spark at the guard, a little in front of the defender toward the blow.
    tmp.x -= hit.dirX * (target.radius + 0.15);
    tmp.z -= hit.dirZ * (target.radius + 0.15);
    tmp.y += target.lockHeight * 0.1;
    const sparks = (count, speed, color, color2, life = [0.15, 0.4]) => g.particles.emit({
      x: tmp.x, y: tmp.y, z: tmp.z, count, speed, up: 1.2, color, color2, life, size: [0.04, 0.1], gravity: 12, drag: 1.5,
      dir: { x: -hit.dirX * 2, y: 0.5, z: -hit.dirZ * 2 },
    });
    if (result === 'parry') {
      sparks(46, 9, 0xfff4c8, 0xffb040, [0.2, 0.6]);
      this.flash(tmp, 0xfff0c0, 3.2, 0.22);
      g.audio.play('parry');
      g.hitstop = Math.max(g.hitstop, 0.12);
      g.cameraShake(0.22);
    } else if (result === 'block') {
      const shield = target !== g.player || !!g.player.shield;
      sparks(shield ? 10 : 18, 5, shield ? 0xffd9a0 : 0xfff0d0, 0xff9a40);
      g.audio.play(shield ? 'shield' : 'block');
      if (playerHurt || byPlayer) g.hitstop = Math.max(g.hitstop, 0.05);
      g.cameraShake(playerHurt ? 0.16 : 0.08);
    } else if (result === 'break') {
      sparks(32, 7, 0xffe0a0, 0xff6a30, [0.2, 0.55]);
      this.flash(tmp, 0xffa060, 2.4, 0.2);
      g.audio.play('guardBreak');
      g.hitstop = Math.max(g.hitstop, 0.1);
      g.cameraShake(0.3);
    }
  }

  // A brief additive bloom at a point (parries, guard breaks, ripostes).
  flash(at, color, size, life) {
    const f = this.flashes[this.nextFlash];
    this.nextFlash = (this.nextFlash + 1) % FLASHES;
    f.s.position.copy(at);
    f.s.material.color.setHex(color);
    f.s.visible = true;
    f.t = 0;
    f.life = life;
    f.size = size;
  }

  update(dt) {
    for (const f of this.flashes) {
      if (!f.s.visible) continue;
      f.t += dt;
      const u = f.t / f.life;
      if (u >= 1) { f.s.visible = false; continue; }
      f.s.scale.setScalar(f.size * (0.35 + u * 0.9));
      f.s.material.opacity = 1 - u * u;
    }
  }
}
