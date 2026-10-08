// Wisp: called with the bone whistle, ridden with camera-relative steering, gallops and jumps.
// She fades away when you dismount and will not cross into the Warden's arena.
import * as THREE from '../lib/three.js';
import { buildHorse } from '../models/horse.js';
import { ARENA } from '../data/world.js';
import { clamp, damp, angleDiff, turnToward } from '../core/math.js';

const GRAVITY = 24;
const SADDLE = 1.02;

export class Horse {
  constructor(game) {
    this.game = game;
    this.model = buildHorse();
    this.model.root.visible = false;
    game.scene.add(this.model.root);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.vy = 0;
    this.onGround = true;
    this.state = 'hidden';
    this.t = 0;
    this.gait = 0;
    this.warned = 0;
  }

  get ridden() { return this.state === 'ridden' || this.state === 'appearing'; }

  // Returns a reason the whistle can't be used right now, or null.
  blockedReason() {
    const g = this.game;
    if (!g.state.flags.horse) return 'You have no way to call a steed.';
    if (g.bossFight || g.fieldBoss) return 'Wisp will not come here.';
    if (g.world.inArena(g.player.pos.x, g.player.pos.z, 4)) return 'Wisp will not come here.';
    if (!['move', 'guard'].includes(g.player.state)) return '';
    return null;
  }

  summon() {
    const p = this.game.player;
    this.pos.copy(p.pos);
    this.yaw = p.yaw;
    this.speed = Math.hypot(p.vel.x, p.vel.z);
    this.vy = 0;
    this.onGround = true;
    this.state = 'appearing';
    this.t = 0;
    this.model.root.visible = true;
    this.game.audio.play('whistle');
    this._burst();
    p.mount(this);
  }

  dismount(forced = false) {
    if (!this.ridden) return;
    this.game.player.dismount(this);
    this.state = 'vanishing';
    this.t = 0;
    if (forced) this.speed *= 0.3;
  }

  hideNow() {
    this.state = 'hidden';
    this.model.root.visible = false;
  }

  _burst() {
    this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 1.3, z: this.pos.z, count: 40, speed: 3, up: 1, color: 0x9fd8ff, color2: 0xffffff, life: [0.5, 1.1], size: [0.08, 0.18], jitter: 1.2, drag: 2 });
  }

  update(dt) {
    if (this.state === 'hidden') return;
    const g = this.game;
    this.t += dt;
    let scale = 1;

    if (this.state === 'appearing') {
      scale = clamp(this.t / 0.35, 0.2, 1);
      if (this.t >= 0.35) this.state = 'ridden';
    }
    if (this.state === 'vanishing') {
      scale = clamp(1 - this.t / 0.7, 0.01, 1);
      this.speed = damp(this.speed, 0, 3, dt);
      if (Math.random() < 0.6) this._sparkle();
      if (this.t >= 0.7) {
        this._burst();
        this.hideNow();
        return;
      }
    }
    if (this.ridden) this._control(dt);

    this.pos.x += Math.sin(this.yaw) * this.speed * dt;
    this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    const bx = this.pos.x, bz = this.pos.z;
    g.world.resolve(this.pos, 0.85);
    if (Math.hypot(this.pos.x - bx, this.pos.z - bz) > 0.02) this.speed *= Math.exp(-6 * dt);
    this._keepOutOfArena();

    const ground = g.world.getHeight(this.pos.x, this.pos.z);
    if (!this.onGround || this.pos.y > ground + 0.05) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        if (!this.onGround && this.vy < -6) g.audio.play('step');
        this.pos.y = ground;
        this.vy = 0;
        this.onGround = true;
      } else this.onGround = false;
    } else this.pos.y = ground;

    if (this.ridden) {
      const p = g.player;
      const bob = this.onGround ? Math.abs(Math.sin(this.gait)) * clamp(this.speed / 16, 0, 1) * 0.12 : 0;
      p.pos.set(this.pos.x, this.pos.y + SADDLE + bob, this.pos.z);
      p.yaw = this.yaw;
      p.vel.set(Math.sin(this.yaw) * this.speed, 0, Math.cos(this.yaw) * this.speed);
    }

    if (this.speed > 11 && this.onGround && Math.random() < dt * 20) {
      g.particles.emit({ x: this.pos.x, y: this.pos.y + 0.1, z: this.pos.z, count: 2, speed: 1, up: 1, color: 0x8f7a5a, life: [0.4, 0.8], size: [0.15, 0.3], jitter: 0.6, drag: 2 });
    }
    this._animate(dt, scale);
  }

  _control(dt) {
    const g = this.game;
    const input = g.input;
    if (input.pressed('interact') || input.pressed('whistle')) {
      input.consume('interact');
      input.consume('whistle');
      this.dismount();
      return;
    }
    const mi = g.player.moveIntent();
    let target = 0;
    if (mi.mag > 0) {
      const want = Math.atan2(mi.x, mi.z);
      const diff = angleDiff(this.yaw, want);
      this.yaw = turnToward(this.yaw, want, (this.speed > 10 ? 2.3 : 3.6) * dt);
      const align = Math.max(0, Math.cos(diff));
      target = (input.held('sprint') ? 17 : 7.5) * (0.3 + 0.7 * align);
    }
    if (g.world.isWater(this.pos.x, this.pos.z)) target = Math.min(target, 4);
    this.speed = damp(this.speed, target, target > this.speed ? 1.5 : 3, dt);
    if (input.pressed('roll') && this.onGround) {
      input.consume('roll');
      this.vy = 9.5;
      this.onGround = false;
      g.audio.play('roll');
    }
  }

  _keepOutOfArena() {
    const dx = this.pos.x - ARENA.x, dz = this.pos.z - ARENA.z;
    const d = Math.hypot(dx, dz);
    const min = ARENA.r + 3.5;
    if (d < min) {
      this.pos.x = ARENA.x + (dx / d) * min;
      this.pos.z = ARENA.z + (dz / d) * min;
      this.speed *= 0.5;
      if (this.game.time - this.warned > 4) {
        this.warned = this.game.time;
        this.game.hud.toast('Wisp shies from the mist. Go on foot.');
      }
    }
  }

  _sparkle() {
    this.game.particles.emit({ x: this.pos.x, y: this.pos.y + 1.4, z: this.pos.z, count: 1, speed: 0.5, up: 1, color: 0x9fd8ff, life: [0.5, 0.9], size: [0.06, 0.12], jitter: 1 });
  }

  _animate(dt, scale) {
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    m.root.scale.setScalar(scale);
    const sp = this.speed;
    const galloping = sp > 9.5;
    this.gait += dt * (galloping ? 6.5 + sp * 0.2 : 1.2 + sp * 1.05);
    const amp = clamp(sp / 7, 0, 1);
    for (const leg of m.legs) {
      let hip, knee;
      if (!this.onGround) {
        hip = leg.front ? -0.9 : 0.75;
        knee = leg.front ? 1.3 : -0.9;
      } else {
        const ph = this.gait + (galloping ? leg.phaseGallop : leg.phaseWalk);
        const s = Math.sin(ph);
        hip = s * (galloping ? 0.75 : 0.45) * amp;
        const bend = Math.max(0, Math.sin(ph + 1.3)) * (galloping ? 1.1 : 0.7) * amp;
        knee = leg.front ? bend : -bend * 0.8;
      }
      leg.hip.rotation.x = damp(leg.hip.rotation.x, hip, 18, dt);
      leg.knee.rotation.x = damp(leg.knee.rotation.x, knee, 18, dt);
    }
    const gal = galloping ? 1 : 0;
    m.body.position.y = 1.45 + (this.onGround ? Math.sin(this.gait * (galloping ? 1 : 2)) * 0.05 * amp : 0);
    m.body.rotation.x = damp(m.body.rotation.x, (this.onGround ? Math.sin(this.gait) * 0.06 * gal : -this.vy * 0.03), 10, dt);
    m.neck.rotation.x = 0.65 + Math.sin(this.gait + 0.6) * (0.08 + 0.1 * gal) * amp + Math.sin(this.game.time * 1.3) * 0.03;
    m.tail.rotation.x = -0.5 - clamp(sp / 17, 0, 1) * 0.6 + Math.sin(this.game.time * 3) * 0.05;
    m.tail.rotation.z = Math.sin(this.game.time * 2.1) * 0.15;
  }
}
