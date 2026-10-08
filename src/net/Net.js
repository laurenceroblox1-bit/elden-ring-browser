// Multiplayer client. Connects to server.js over WebSocket and shares the Vale with other players:
// each game still runs its own world (enemies, bosses, loot are yours alone), and sends ~15 times a
// second where your knight is and exactly how it's posed, so everyone sees everyone else walk, ride,
// roll and swing. Plus chat. See server.js for the message format.
import { Ghost, playerJoints, horseJoints } from './Ghost.js';

const SEND_RATE = 1 / 15;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const NAME_KEY = 'ashenvale.name';
const URL_KEY = 'ashenvale.server';

export class Net {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.id = null;
    this.status = 'offline'; // offline | connecting | online
    this.error = '';
    this.ghosts = new Map();
    this.sendT = 0;
    this.chatLog = []; // { name, text, self, t }
    this.onChange = null; // the multiplayer panel re-renders on this
    this.name = this._load(NAME_KEY) || `Wanderer ${Math.floor(Math.random() * 900 + 100)}`;
    this.url = this._load(URL_KEY) || this.defaultUrl();
  }

  _load(k) {
    try { return localStorage.getItem(k) || ''; } catch { return ''; }
  }

  _store(k, v) {
    try { localStorage.setItem(k, v); } catch { /* private mode: fine */ }
  }

  // When the page itself came from server.js, the relay is on the same address.
  defaultUrl() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return '';
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }

  get online() { return this.status === 'online'; }

  connect(url = this.url, name = this.name) {
    this.disconnect();
    this.url = url.trim();
    this.name = name.trim().slice(0, 20) || this.name;
    this._store(NAME_KEY, this.name);
    this._store(URL_KEY, this.url);
    this.error = '';
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this.error = 'That address is not a WebSocket address (it should start with ws:// or wss://).';
      this._changed();
      return;
    }
    this.ws = ws;
    this.status = 'connecting';
    this._changed();
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name: this.name }));
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      this._message(m);
    };
    ws.onerror = () => {
      if (this.ws === ws) this.error = 'Could not reach the server. Is server.js running at that address?';
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      const was = this.status;
      this.ws = null;
      this.status = 'offline';
      this._clear();
      if (was === 'online') this.game.hud.toast('Disconnected from the shared Vale.');
      this._changed();
    };
  }

  disconnect() {
    if (!this.ws) return;
    const ws = this.ws;
    this.ws = null;
    ws.close();
    this.status = 'offline';
    this._clear();
    this._changed();
  }

  _clear() {
    for (const g of this.ghosts.values()) g.dispose();
    this.ghosts.clear();
    this.id = null;
  }

  _changed() { this.onChange?.(); }

  _message(m) {
    const hud = this.game.hud;
    switch (m.t) {
      case 'welcome':
        this.id = m.id;
        this.status = 'online';
        for (const p of m.peers) this._ghost(p.id, p.name);
        hud.toast(m.peers.length ? `Joined the shared Vale: ${m.peers.length} other${m.peers.length > 1 ? 's' : ''} here.` : 'Joined the shared Vale. Nobody else is here yet.', 'item');
        this._changed();
        break;
      case 'join':
        this._ghost(m.id, m.name);
        hud.toast(`${m.name} has entered the Vale.`, 'item');
        this._changed();
        break;
      case 'leave': {
        const g = this.ghosts.get(m.id);
        if (g) {
          hud.toast(`${g.name} has left the Vale.`);
          g.dispose();
          this.ghosts.delete(m.id);
        }
        this._changed();
        break;
      }
      case 'state':
        this.ghosts.get(m.id)?.receive(m);
        break;
      case 'chat':
        this._chat(m.name, m.text, m.id === this.id);
        break;
    }
  }

  _ghost(id, name) {
    if (!this.ghosts.has(id)) this.ghosts.set(id, new Ghost(this.game, id, name));
  }

  _chat(name, text, self = false) {
    this.chatLog.push({ name, text, self, t: performance.now() });
    if (this.chatLog.length > 50) this.chatLog.shift();
    this.game.hud.chatLine?.(name, text, self);
    this._changed();
  }

  say(text) {
    text = text.trim();
    if (!text || !this.online) return;
    this.ws.send(JSON.stringify({ t: 'chat', text }));
  }

  // Your knight as the others will see it: root transform, joint angles, gear, and Wisp if you ride.
  capture() {
    const g = this.game, p = g.player, r = p.model;
    const root = r.root;
    const b = [];
    for (const j of playerJoints(r)) b.push(r3(j.rotation.x), r3(j.rotation.y), r3(j.rotation.z));
    const m = {
      t: 'state',
      p: [r2(root.position.x), r2(root.position.y), r2(root.position.z)],
      r: [r3(root.rotation.x), r3(root.rotation.y), r3(root.rotation.z)],
      py: r3(r.pivot.position.y), hy: r3(r.hips.position.y),
      b, w: p.weaponId, s: p.shieldId ?? null,
      v: g.mode === 'playing' && root.visible ? 1 : 0,
    };
    const horse = g.horse;
    if (horse.ridden && horse.model.root.visible) {
      const h = horse.model;
      const hb = [];
      for (const j of horseJoints(h)) hb.push(r3(j.rotation.x), r3(j.rotation.y), r3(j.rotation.z));
      m.h = { p: [r2(h.root.position.x), r2(h.root.position.y), r2(h.root.position.z)], y: r3(h.root.rotation.y), by: r3(h.body.position.y), b: hb };
    }
    return m;
  }

  update(dt) {
    for (const g of this.ghosts.values()) g.update(dt);
    if (!this.online || this.ws.readyState !== 1) return;
    if ((this.sendT -= dt) > 0) return;
    this.sendT = SEND_RATE;
    if (this.ws.bufferedAmount > 64 * 1024) return; // a slow link: skip rather than queue up lag
    this.ws.send(JSON.stringify(this.capture()));
  }
}
