// Multiplayer client. Shares the Vale with other players: each game still runs its own world (enemies,
// bosses, loot are yours alone) and sends ~15 times a second where your knight is and exactly how it's
// posed, so everyone sees everyone else walk, ride, roll, swing and emote. Plus chat.
//
// Two ways to meet, picked by where the page runs:
//  - On claude.ai (the published link) the page's live room (`claude.use("room")`) carries it: your
//    pose rides in your room presence, chat is a room event. Everyone with the page open is in the
//    same Vale automatically; a party code moves you into a private named room.
//  - Anywhere else, server.js relays over WebSocket (see server.js for the message format).
import { Ghost, playerJoints, horseJoints } from './Ghost.js';

const SEND_RATE = 1 / 15;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const NAME_KEY = 'ashenvale.name';
const URL_KEY = 'ashenvale.server';
const SHOW_KEY = 'ashenvale.visible';

// A stable small number from a room peer label (for the cloak colour).
const hashId = (s) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export class Net {
  constructor(game) {
    this.game = game;
    this.mode = null; // 'room' (claude.ai) | 'ws' (server.js) | null
    this.ws = null;
    this.id = null;
    this.status = 'offline'; // offline | connecting | online
    this.error = '';
    this.ghosts = new Map(); // ws: player id -> Ghost; room: peer label -> Ghost
    this.sendT = 0;
    this.chatLog = []; // { name, text, self, t }
    this.onChange = null; // the multiplayer panel re-renders on this
    this.storedName = this._load(NAME_KEY);
    this.name = this.storedName || `Wanderer ${Math.floor(Math.random() * 900 + 100)}`;
    this.url = this._load(URL_KEY) || this.defaultUrl();
    // Room mode state.
    this.roomApi = null; // the lobby namespace, once claude.ai hands it over
    this.target = null; // the lobby or a named party room
    this.party = '';
    this.visible = this._load(SHOW_KEY) !== '0';
    this.unsubs = [];
    this.roomTried = false;
    this._tryRoom();
  }

  _load(k) {
    try { return localStorage.getItem(k) || ''; } catch { return ''; }
  }

  _store(k, v) {
    try { localStorage.setItem(k, v); } catch { /* private mode: fine */ }
  }

  // When the page itself came from server.js, the relay is on the same address.
  defaultUrl() {
    if (this.mode === 'room') return '';
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return '';
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }

  get online() { return this.status === 'online'; }
  get roomMode() { return this.mode === 'room'; }

  _changed() { this.onChange?.(); }

  // ---------- claude.ai room ----------

  async _tryRoom() {
    const use = globalThis.claude?.use;
    if (typeof use !== 'function') {
      this.roomTried = true;
      return;
    }
    let room = null;
    try { room = await use.call(globalThis.claude, 'room'); } catch { room = null; }
    this.roomTried = true;
    if (!room) {
      this._changed();
      return;
    }
    this.roomApi = room;
    this.mode = 'room';
    // Your claude.ai first name as the default, until you pick one.
    if (!this.storedName) {
      try {
        const user = await use.call(globalThis.claude, 'user');
        const n = clean((await user?.name?.()) || '', 20).split(' ')[0];
        if (n) this.name = n;
      } catch { /* keep the wanderer name */ }
    }
    this._enter(room);
  }

  // Listens to a room (the lobby, or a party) and starts sharing your knight there.
  _enter(target) {
    this._leaveTarget();
    this.target = target;
    this.status = target.connected() ? 'online' : 'connecting';
    this.unsubs.push(
      target.onConnection((c) => {
        const was = this.status;
        this.status = c ? 'online' : 'connecting';
        if (was !== this.status) this._changed();
      }, (e) => this._roomError(e)),
      target.onPeers((change) => this._peers(change), (e) => this._roomError(e)),
      target.on('chat', (msg) => {
        const d = msg.data;
        if (!d || typeof d !== 'object') return;
        const text = clean(d.text, 200);
        if (text) this._chat(clean(d.n, 20) || 'Someone', text, msg.isMe && msg.sameTab);
      }, () => {}),
    );
    this._changed();
  }

  _leaveTarget() {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    if (this.target) this.target.presence({ s: null, n: null }).catch(() => {});
    this._clear();
    this.target = null;
  }

  _roomError(e) {
    // Terminal for this page load (no access to the room): play alone, quietly.
    this.status = 'offline';
    this.error = e?.code === 'not_granted' || e?.code === 'revoked' ? 'Multiplayer is not available to you on this page.' : '';
    this._clear();
    this._changed();
  }

  _peers(change) {
    for (const p of change.left) this._drop(p.peer);
    for (const p of [...change.joined, ...change.updated]) {
      if (p.sameTab || p.kind !== 'viewer') continue;
      const pr = p.presence || {};
      const s = pr.s;
      if (!s || typeof s !== 'object' || !Array.isArray(s.p) || !Array.isArray(s.b)) {
        this._drop(p.peer); // here, but not showing themselves (title screen, or hidden)
        continue;
      }
      const name = clean(pr.n, 20) || 'Wanderer';
      let g = this.ghosts.get(p.peer);
      if (!g) {
        g = new Ghost(this.game, hashId(p.peer), name);
        this.ghosts.set(p.peer, g);
        this.game.hud.toast(`${name} has entered the Vale.`, 'item');
        this.game.audio.play('bellSmall');
        this._changed();
      } else if (g.name !== name) {
        g.setName(name);
        this._changed();
      }
      g.receive(s);
    }
  }

  _drop(key) {
    const g = this.ghosts.get(key);
    if (!g) return;
    this.game.hud.toast(`${g.name} has left the Vale.`);
    g.dispose();
    this.ghosts.delete(key);
    this._changed();
  }

  // A party: a private named room (share the code with friends). '' goes back to the lobby.
  async joinParty(code) {
    if (!this.roomApi) return;
    code = String(code || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40);
    this.error = '';
    if (!code) {
      if (this.target !== this.roomApi) this.target?.leave?.().catch(() => {});
      this.party = '';
      this._enter(this.roomApi);
      return;
    }
    try {
      const room = await this.roomApi.join(`party-${code}`);
      if (this.target && this.target !== this.roomApi) this.target.leave().catch(() => {});
      this.party = code;
      this._enter(room);
    } catch (e) {
      this.error = e?.code === 'not_permitted' ? 'Parties are not available here; you are still in the shared Vale.' : 'Could not join that party. Try again in a moment.';
      this._changed();
    }
  }

  setVisible(on) {
    this.visible = on;
    this._store(SHOW_KEY, on ? '1' : '0');
    if (!on && this.target) this.target.presence({ s: null }).catch(() => {});
    this._changed();
  }

  setName(name) {
    name = clean(name, 20);
    if (!name) return;
    this.name = this.storedName = name;
    this._store(NAME_KEY, name);
    this._changed();
  }

  // ---------- server.js (WebSocket) ----------

  connect(url = this.url, name = this.name) {
    if (this.roomMode) return;
    this.disconnect();
    this.url = url.trim();
    this.setName(name);
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
    this.mode = 'ws';
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
        this.game.audio.play('bellSmall');
        this._changed();
        break;
      case 'leave':
        this._drop(m.id);
        break;
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

  // ---------- chat ----------

  _chat(name, text, self = false) {
    this.chatLog.push({ name, text, self, t: performance.now() });
    if (this.chatLog.length > 50) this.chatLog.shift();
    this.game.hud.chatLine?.(name, text, self);
    this._changed();
  }

  say(text) {
    text = clean(text, 200);
    if (!text || !this.online) return;
    if (this.roomMode) {
      this.target.emit('chat', { n: this.name, text }).catch((e) => {
        this.game.hud.toast(e?.code === 'not_permitted' ? 'Only people who can edit or contribute to this page can chat.' : 'That message did not go through.');
      });
    } else this.ws.send(JSON.stringify({ t: 'chat', text }));
  }

  // ---------- your knight ----------

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
    if (!this.online) return;
    if ((this.sendT -= dt) > 0) return;
    this.sendT = SEND_RATE;
    if (this.roomMode) {
      if (!this.target || !this.visible) return;
      const playing = this.game.mode === 'playing';
      this.target.presence({ n: this.name, s: playing ? this.capture() : null }).catch(() => {});
      return;
    }
    if (!this.ws || this.ws.readyState !== 1) return;
    if (this.ws.bufferedAmount > 64 * 1024) return; // a slow link: skip rather than queue up lag
    this.ws.send(JSON.stringify(this.capture()));
  }
}
