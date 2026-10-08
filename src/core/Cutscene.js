// A boss's opening: letterbox, a slow push across the arena, the boss rising and roaring, its name,
// then the camera swings back behind the player and the fight begins. Skippable after half a second.
// Written for Odran; other bosses pass { boss, name, title, open, roar, scale } (scale pushes the close
// shots further out for a bigger body).
import * as THREE from '../lib/three.js';
import { clamp, easeInOut } from './math.js';

export const BOSS_INTRO_LENGTH = 7.2;

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const look = new THREE.Vector3();

export class BossIntro {
  constructor(game, onDone, o = {}) {
    this.game = game;
    this.onDone = onDone;
    this.boss = o.boss ?? game.boss;
    this.name = o.name ?? 'Odran, the Bell-Warden';
    this.title = o.title ?? 'Keeper of the Shattered Gate';
    this.roar = o.roar ?? 'roar';
    this.k = o.scale ?? 1;
    this.lift = o.lift ?? 0; // raises the close shots for a taller head
    this.roarAt = o.roarAt ?? [4.2, 1.2]; // the roar shot's camera: metres in front of the boss, and to its side
    this.t = 0;
    this.done = false;
    this.titled = false;
    this.roared = false;
    game.hud.setLetterbox(true);
    game.audio.play(o.open ?? 'bell');
  }

  // Camera shots as functions of the Warden's position and facing; each returns [position, look-at].
  _shot(t) {
    const b = this.boss, p = this.game.player, k = this.k;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    const by = b.pos.y + (t > 2.4 ? this.lift : 0);
    if (t < 2.4) {
      // Wide: over the player's shoulder across the ash floor, creeping forward.
      const u = easeInOut(t / 2.4);
      tmpA.set(p.pos.x + 1.4, p.pos.y + 2.4 - u * 0.4, p.pos.z + 3.2 - u * 2.2);
      look.set(b.pos.x, by + 2.2, b.pos.z);
    } else if (t < 4.6) {
      // Low and close as he rises: from in front and to the side, looking up at the bell helm.
      const u = easeInOut((t - 2.4) / 2.2);
      const side = 0.9 - u * 0.5;
      tmpA.set(b.pos.x + fx * (6.5 - u * 1.5) * k + fz * side * 4 * k, by + 0.9 + u * 0.6, b.pos.z + fz * (6.5 - u * 1.5) * k - fx * side * 4 * k);
      look.set(b.pos.x, by + 2.6 + u * 1.2, b.pos.z);
    } else if (t < 6.2) {
      // The roar: tight on the helm, slightly below it.
      const [f, s] = this.roarAt;
      tmpA.set(b.pos.x + (fx * f + fz * s) * k, by + 2.6, b.pos.z + (fz * f - fx * s) * k);
      look.set(b.pos.x, by + 4.0, b.pos.z);
    } else {
      // Swing back to the gameplay camera behind the player.
      const u = easeInOut(clamp((t - 6.2) / 1.0, 0, 1));
      const cam = this.game.cam;
      cam.snapBehind(Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z));
      const cp = Math.cos(cam.pitch);
      tmpB.set(p.pos.x + Math.sin(cam.yaw) * cp * cam.zoom, p.pos.y + 1.55 + Math.sin(cam.pitch) * cam.zoom, p.pos.z + Math.cos(cam.yaw) * cp * cam.zoom);
      const [f, s] = this.roarAt;
      tmpA.set(b.pos.x + (fx * f + fz * s) * k, by + 2.6, b.pos.z + (fz * f - fx * s) * k).lerp(tmpB, u);
      look.set(b.pos.x, by + 3.0, b.pos.z).lerp(tmpB.set(p.pos.x, p.pos.y + 1.55, p.pos.z), u);
    }
    return [tmpA, look];
  }

  update(dt) {
    if (this.done) return;
    const g = this.game, i = g.input;
    this.t += dt;
    if (!this.titled && this.t > 4.7) {
      this.titled = true;
      g.hud.banner(this.name, this.title, 'bosstitle', 2600);
    }
    if (!this.roared && this.t > 4.5) {
      this.roared = true;
      g.audio.play(this.roar);
      g.cam.shake(0.35);
    }
    const [pos, at] = this._shot(this.t);
    const cam = g.camera;
    cam.position.copy(pos);
    if (g.cam.shakeT > 0) {
      g.cam.shakeT -= dt;
      const s = g.cam.shakeAmp * Math.max(0, g.cam.shakeT / 0.35);
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }
    cam.position.y = Math.max(cam.position.y, g.world.getHeight(cam.position.x, cam.position.z) + 0.4);
    cam.lookAt(at);
    const skip = this.t > 0.5 && (i.pressed('interact') || i.pressed('roll') || i.pressed('pause') || i.pressed('light'));
    if (skip) for (const a of ['interact', 'roll', 'pause', 'light']) i.consume(a);
    if (this.t >= BOSS_INTRO_LENGTH || skip) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const g = this.game;
    g.hud.setLetterbox(false);
    if (!this.titled) g.hud.banner(this.name, this.title, 'bosstitle', 2200);
    const b = this.boss, p = g.player;
    g.cam.snapBehind(Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z));
    this.onDone?.();
  }
}
