// Friendly, talkable characters. What they say lives in data/dialogue.js.
import { buildBrannoc, buildIlse, buildOrmund, buildHessa, buildWenna, buildMurk } from '../models/characters.js';
import { buildTamsin, buildAldous, buildEdda, buildPell, buildDorn } from '../models/creatures.js';
import { pose, copyPose, applyPose } from '../models/pose.js';
import { clamp, dampK, angleDiff, yawTo, damp } from '../core/math.js';

const BUILDERS = { brannoc: buildBrannoc, ilse: buildIlse, ormund: buildOrmund, hessa: buildHessa, wenna: buildWenna, murk: buildMurk, tamsin: buildTamsin, aldous: buildAldous, edda: buildEdda, pell: buildPell, dorn: buildDorn };
const IDLE = {
  brannoc: pose({ torsoX: 0.3, headX: -0.25, sRx: 0.1, eR: -0.4, sLx: -0.2, eL: -0.8 }),
  ilse: pose({ sLx: -0.4, eL: -0.9, hLx: -0.27, sRx: -0.3, eR: -0.9, sRy: 0.4, headX: 0.1 }),
  ormund: pose({ sRx: -0.9, eR: -1.6, sRz: 0.3, sLx: 0.1, eL: -0.3, torsoX: 0.12, headX: 0.05 }),
  hessa: pose({ sRx: -0.2, eR: -1.2, sRz: 0.15, sLx: 0.05, eL: -1.4, sLy: -0.6, torsoX: 0.08 }),
  wenna: pose({ torsoX: 0.4, headX: -0.3, sLx: -0.5, eL: -0.5, sRx: 0.1, eR: -0.3 }),
  murk: pose({ sRx: -0.2, eR: -0.6, sLx: -0.2, eL: -0.6, sRz: 0.25, sLz: -0.25, headX: 0.1 }),
  tamsin: pose({ sRx: -0.5, eR: -1.4, sRy: 0.4, sLx: -0.5, eL: -1.4, sLy: -0.4, torsoX: 0.05 }),
  aldous: pose({ torsoX: 0.3, headX: -0.2, sLx: -0.4, eL: -0.5, sRx: 0.1, eR: -0.4 }),
  edda: pose({ sRx: -0.3, eR: -0.6, sLx: -0.1, eL: -0.3, torsoX: -0.05, headX: 0.05, lRx: 0.1, lLx: -0.15 }),
  dorn: pose({ torsoX: 0.35, headX: -0.25, sRx: -0.3, eR: -0.6, sLx: -0.2, eL: -0.4, kR: 0.1, kL: 0.15 }),
  pell: pose({ sRx: -0.6, eR: -1.5, sRy: 0.3, sLx: -0.6, eL: -1.5, sLy: -0.3, torsoX: 0.1, headX: 0.1 }),
};

export class NPC {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.id = def.id;
    this.model = BUILDERS[def.id]();
    this.pose = pose();
    const y = game.world.getHeight(def.x, def.z);
    this.model.root.position.set(def.x, y, def.z);
    this.model.root.rotation.y = def.yaw;
    game.scene.add(this.model.root);
    game.world.addCircle(def.x, def.z, 0.5);
  }

  update(dt) {
    const p = this.game.player.pos;
    copyPose(this.pose, IDLE[this.id]);
    this.pose.torsoX += Math.sin(this.game.time * 1.6 + this.def.x) * 0.025;
    const d = Math.hypot(p.x - this.def.x, p.z - this.def.z);
    if (d < 9) {
      const look = angleDiff(this.def.yaw, yawTo(this.def.x, this.def.z, p.x, p.z));
      this.pose.headY = clamp(look, -1.1, 1.1);
      this.pose.torsoY = clamp(look * 0.3, -0.4, 0.4);
    }
    // In conversation: turn to face you, nod along, and talk with the hands.
    const talking = this.game.talkingTo === this.id && this.game.modal === 'dialogue';
    this.turn = damp(this.turn ?? 0, talking ? angleDiff(this.def.yaw, yawTo(this.def.x, this.def.z, p.x, p.z)) : 0, 4, dt);
    this.model.root.rotation.y = this.def.yaw + this.turn;
    if (talking) {
      const t = this.game.time;
      this.pose.headY -= this.turn * 0.9;
      this.pose.torsoY -= this.turn * 0.3;
      this.pose.headX += Math.sin(t * 5.3) * 0.06;
      const k = 0.5 + 0.5 * Math.sin(t * 1.7);
      this.pose.sRx = -0.5 - k * 0.5 + Math.sin(t * 4.1) * 0.08;
      this.pose.eR = -1.2 - Math.sin(t * 3.3) * 0.25;
      this.pose.sRz = -0.15 - k * 0.2;
    }
    // Murk's cap pulses gently; brighter while you're near.
    if (this.model.cap) this.model.cap.emissiveIntensity = (d < 9 ? 1.6 : 1.0) + Math.sin(this.game.time * 1.3) * 0.3;
    applyPose(this.model, this.pose, dampK(5, dt));
  }
}
