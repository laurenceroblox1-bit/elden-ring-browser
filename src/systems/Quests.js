// Data-driven quest tracker. Listens to game events and advances stages; dialogue can also
// start/complete quests directly.
import { ITEMS } from '../data/items.js';

export class Quests {
  constructor(game, defs) {
    this.game = game;
    this.defs = defs;
    this.state = {};
    this.order = 0;
    for (const id of Object.keys(defs)) this.state[id] = { status: 'inactive', stage: 0, count: 0, touched: 0 };
    const ev = game.events;
    ev.on('shrineKindled', (id) => this.notify({ type: 'shrine', id }));
    ev.on('bossDefeated', (id) => this.notify({ type: 'boss', id }));
    ev.on('itemGained', (id) => this.notify({ type: 'item', id }));
    ev.on('enemyKilled', (e) => this.notify({ type: 'kill', tag: e.tag }));
  }

  load(saved) {
    for (const id of Object.keys(this.defs)) this.state[id] = { status: 'inactive', stage: 0, count: 0, touched: 0 };
    for (const [id, s] of Object.entries(saved ?? {})) if (this.state[id]) Object.assign(this.state[id], s);
    this.order = Math.max(0, ...Object.values(this.state).map((s) => s.touched));
  }

  serialize() {
    return JSON.parse(JSON.stringify(this.state));
  }

  status(id) { return this.state[id].status; }
  stageDef(id) { return this.defs[id].stages[this.state[id].stage]; }

  start(id, quiet = false) {
    const s = this.state[id];
    if (s.status !== 'inactive') return;
    s.status = 'active';
    s.stage = 0;
    s.count = 0;
    s.touched = ++this.order;
    if (!quiet) {
      this.game.hud.toast(`Quest started: ${this.defs[id].title}`, 'quest');
      this.game.audio.play('quest');
    }
    this._checkHeld(id);
    this.game.save();
  }

  advance(id) {
    const s = this.state[id];
    s.stage++;
    s.count = 0;
    s.touched = ++this.order;
    if (s.stage >= this.defs[id].stages.length) {
      this.complete(id);
      return;
    }
    this.game.hud.toast(`${this.defs[id].title}: ${this.stageDef(id).text}`, 'quest');
    this.game.audio.play('quest');
    this._checkHeld(id);
    this.game.save();
  }

  complete(id) {
    const s = this.state[id];
    if (s.status === 'done') return;
    const def = this.defs[id];
    s.status = 'done';
    s.stage = def.stages.length;
    s.touched = ++this.order;
    const r = def.reward ?? {};
    const g = this.game;
    if (r.ash) g.addAsh(r.ash);
    if (r.flask) {
      g.state.flasksMax += r.flask;
      g.player.applyStats(g.state.stats, g.state.flasksMax);
      g.player.flasks = Math.min(g.player.flasks + r.flask, g.player.flasksMax);
    }
    if (r.horse) g.state.flags.horse = true;
    g.hud.toast(`Quest complete: ${def.title}`, 'quest');
    if (def.doneText) g.hud.toast(def.doneText);
    g.audio.play('quest');
    g.save();
  }

  // Item stages complete immediately if the item is already in the bag.
  _checkHeld(id) {
    const st = this.stageDef(id);
    if (this.state[id].status === 'active' && st?.on.type === 'item' && this.game.hasItem(st.on.id)) this.advance(id);
  }

  // An event completes the current stage, or skips ahead if it matches a later one
  // (e.g. beating the boss without kindling the shrine on the way).
  notify(evt) {
    const matches = (on) => on.type === evt.type && (!on.id || on.id === evt.id) && (!on.tag || on.tag === evt.tag);
    for (const [id, s] of Object.entries(this.state)) {
      if (s.status !== 'active') continue;
      const stages = this.defs[id].stages;
      let at = -1;
      for (let i = s.stage; i < stages.length; i++) if (matches(stages[i].on)) { at = i; break; }
      if (at < 0) continue;
      if (at > s.stage) {
        s.stage = at;
        s.count = 0;
      }
      const on = stages[at].on;
      if (on.count) {
        s.count++;
        s.touched = ++this.order;
        if (s.count < on.count) {
          this.game.hud.toast(`${this.defs[id].title}: ${s.count}/${on.count}`);
          continue;
        }
      }
      this.advance(id);
    }
  }

  objectiveText(id) {
    const st = this.stageDef(id);
    if (!st) return this.defs[id].doneText ?? '';
    const s = this.state[id];
    return st.on.count ? `${st.text} (${s.count}/${st.on.count})` : st.text;
  }

  // Main quest first, then the most recently touched side quests.
  tracked(limit = 3) {
    return Object.keys(this.defs)
      .filter((id) => this.state[id].status === 'active')
      .sort((a, b) => (this.defs[b].main ? 1 : 0) - (this.defs[a].main ? 1 : 0) || this.state[b].touched - this.state[a].touched)
      .slice(0, limit)
      .map((id) => ({ id, title: this.defs[id].title, text: this.objectiveText(id), main: !!this.defs[id].main }));
  }

  markers() {
    return Object.keys(this.defs)
      .filter((id) => this.state[id].status === 'active' && this.stageDef(id)?.marker)
      .map((id) => ({ x: this.stageDef(id).marker[0], z: this.stageDef(id).marker[1], main: !!this.defs[id].main, label: this.defs[id].title }));
  }

  journal() {
    return Object.keys(this.defs)
      .filter((id) => this.state[id].status !== 'inactive')
      .sort((a, b) => this.state[b].touched - this.state[a].touched)
      .map((id) => ({ id, ...this.defs[id], status: this.state[id].status, objective: this.objectiveText(id) }));
  }

  itemName(id) {
    return ITEMS[id]?.name ?? id;
  }
}
