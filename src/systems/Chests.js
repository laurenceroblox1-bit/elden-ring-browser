// Treasure chests (data/biomes.js CHESTS): an E prompt opens one, its lid swings up and what's inside
// is yours. Some are mimics: the chest stands up and fights (entities/Mimic.js), and its loot is only
// yours once it's dead. Opened chests are saved (`state.chests`, indices into CHESTS) and stay open.
import { CHESTS } from '../data/biomes.js';
import { buildChest } from '../models/props.js';
import { gearOf } from '../data/loot.js';

export class Chests {
  constructor(game) {
    this.game = game;
    this.list = CHESTS.map((def, i) => {
      const m = buildChest();
      game.world.place(m.group, def.x, def.z, def.yaw ?? 0);
      game.world.addCircle(def.x, def.z, 0.7);
      const c = { def, i, ...m, open: 0, opening: false, mimic: null };
      game.interactions.add({
        x: def.x + Math.sin(def.yaw ?? 0) * 1.0, z: def.z + Math.cos(def.yaw ?? 0) * 1.0, radius: 1.8,
        enabled: () => !this.opened(i) && !c.mimic && c.group.visible,
        label: () => 'Open the chest',
        action: () => this.open(i),
      });
      return c;
    });
  }

  opened(i) { return (this.game.state.chests ?? []).includes(i); }

  // Lids open or shut, and hidden mimics back in their places, to match the save.
  sync() {
    for (const c of this.list) {
      if (c.mimic && !c.mimic.alive) c.mimic = null;
      if (c.mimic && !this.game.enemies.includes(c.mimic)) c.mimic = null; // it went with the rest
      c.group.visible = !c.mimic;
      c.open = this.opened(c.i) ? 1 : 0;
      c.opening = false;
      c.lid.rotation.x = -c.open * 1.9;
      c.shine.material.opacity = 0;
    }
  }

  open(i) {
    const g = this.game, c = this.list[i];
    if (!c || this.opened(i) || c.mimic) return;
    if (c.def.mimic) {
      // It was never a chest.
      c.group.visible = false;
      const e = g.summonEnemy('mimic', c.def.x, c.def.z, (c.def.yaw ?? 0), { chest: i });
      e._alertPack?.();
      e._engage?.();
      c.mimic = e;
      g.audio.playAt('roarBig', e.pos, 50);
      g.cameraShake(0.3);
      g.hud.toast('The chest has teeth!');
      return;
    }
    c.opening = true;
    g.audio.play('pickup');
    g.after(0.5, () => this._give(c));
  }

  _give(c) {
    const g = this.game, L = c.def.loot;
    (g.state.chests ??= []).push(c.i);
    if (L.ash) {
      g.addAsh(L.ash);
      g.hud.toast(`Found ${L.ash} ash.`, 'item');
    }
    for (let k = 0; k < (L.stones ?? 0); k++) g.giveItem('smithing_stone');
    if (L.gear) {
      if (g.hasGear(L.gear) || !gearOf(L.gear)) {
        g.addAsh(1000);
        g.hud.toast('Found 1000 ash.', 'item');
      } else g.giveGear(L.gear);
    }
    g.events.emit('chestOpened', c.i);
    g.save();
  }

  // A mimic died: its chest is opened for good, and the loot is yours.
  onMimicKilled(e) {
    const c = this.list[e.chest];
    if (!c) return;
    c.mimic = null;
    c.group.visible = true;
    c.group.position.set(e.pos.x, this.game.world.getHeight(e.pos.x, e.pos.z), e.pos.z);
    c.open = 1;
    c.lid.rotation.x = -1.9;
    this.game.events.emit('mimicSlain', e.chest);
    this.game.after(1.2, () => this._give(c));
  }

  update(dt) {
    for (const c of this.list) {
      if (c.opening && c.open < 1) {
        c.open = Math.min(1, c.open + dt * 2.2);
        c.lid.rotation.x = -(1 - Math.pow(1 - c.open, 3)) * 1.9;
        c.shine.material.opacity = Math.sin(c.open * Math.PI) * 0.9;
      }
    }
  }
}
