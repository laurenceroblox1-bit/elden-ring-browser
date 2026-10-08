// Friendly, talkable characters. What they say lives in data/dialogue.js.
import { buildBrannoc, buildIlse, buildOrmund } from '../models/characters.js';
import { pose, copyPose, applyPose } from '../models/pose.js';
import { clamp, dampK, angleDiff, yawTo } from '../core/math.js';

const BUILDERS = { brannoc: buildBrannoc, ilse: buildIlse, ormund: buildOrmund };
const IDLE = {
  brannoc: pose({ torsoX: 0.3, headX: -0.25, sRx: 0.1, eR: -0.4, sLx: -0.2, eL: -0.8 }),
  ilse: pose({ sLx: -0.4, eL: -0.9, hLx: -0.27, sRx: -0.3, eR: -0.9, sRy: 0.4, headX: 0.1 }),
  ormund: pose({ sRx: -0.9, eR: -1.6, sRz: 0.3, sLx: 0.1, eL: -0.3, torsoX: 0.12, headX: 0.05 }),
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
    applyPose(this.model, this.pose, dampK(5, dt));
  }
}
