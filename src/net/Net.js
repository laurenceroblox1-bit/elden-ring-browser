// Multiplayer client. Everyone in the same Vale (or party) shares one world: you see each other's
// knights posed joint for joint, the enemies and roaming bosses are shared (net/Coop.js: one player's
// game hosts them, everyone's blows land on them), spells and arrows show for everyone, and there is chat.
//
// Everything a player shares rides in one "presence" object, sent ~15 times a second:
//   { nv: 2, n: name, s: knight pose (or null off the title screen), ev: [[seq, type, data], ...],
//     e: enemy snapshot (host only), fb: the field boss the host is fighting }
// `ev` is a short rolling list of recent events (chat, hits, parries, effects); receivers keep the last
// seq they handled per player, so nothing is applied twice and a dropped update loses nothing recent.
//
// Two ways to meet, picked by where the page runs:
//  - On claude.ai (the published link): the page's live room (`claude.use("room")`). Presence can be
//    set by every viewer (view-only too), so everything works for anyone the page is shared with.
//  - Anywhere else: server.js relays the same presence objects over WebSocket.
import { Ghost, playerJoints, horseJoints } from './Ghost.js';
import { Coop } from './Coop.js';

const SEND_RATE = 1 / 15;
const EV_KEEP = 2.5; // seconds an event stays in the list
const EV_MAX = 16;
const PRESENCE_MAX = 3900; // bytes (the room allows 4 KiB)
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const NAME_KEY = 'ashenvale.name';
const URL_KEY = 'ashenvale.server';
const SHOW_KEY = 'ashenvale.visible';

// A stable small number from a key (for the cloak colour).
const hashId = (s) => {
  let h = 7;
  s = String(s);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export class Net {
  constructor(game) {
    this.game = game;
    this.mode = null; // 'room' (claude.ai) | 'ws' (server.js) | null
    this.ws = null;
    this.selfKey = null;
    this.status = 'offline'; // offline | connecting | online
    this.error = '';
    this.ghosts = new Map(); // key -> Ghost (only players in game, not on the title screen)
    this.present = new Map(); // key -> latest presence (everyone connected, playing or not)
    this.lastSeq = new Map(); // key -> last event seq handled
    this.sendT = 0;
    this.seq = 0;
    this.outbox = []; // [seq, type, data, time]
    this.chatLog = []; // { name, text, self, t }
    this.onChange = null; // the multiplayer panel re-renders on this
    this.storedName = this._load(NAME_KEY);
    this.name = this.storedName || `Wanderer ${Math.floor(Math.random() * 900 + 100)}`;
    this.url = this._load(URL_KEY) || this.defaultUrl();
    this.coop = new Coop(game, this);
    this.hostKey = null;
    // Room mode state.
    this.roomApi = null;
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
  get partyMode() { return this.mode === 'room' || this.mode === 'p2p'; } // party codes, no server address
  get hostName() {
    if (!this.hostKey) return '';
    if (this.hostKey === this.selfKey) return this.name;
    return this.ghosts.get(this.hostKey)?.name ?? '';
  }

  _changed() { this.onChange?.(); }

  // ---------- events ----------

  send(type, data) {
    if (!this.online) return;
    this.outbox.push([++this.seq, type, data, performance.now()]);
    if (this.outbox.length > EV_MAX) this.outbox.shift();
    this.sendT = Math.min(this.sendT, 0.02); // out with the next frame
  }

  _events(key, list) {
    if (!Array.isArray(list)) return;
    const last = this.lastSeq.get(key);
    let max = last ?? 0;
    for (const ev of list) {
      if (!Array.isArray(ev) || !Number.isFinite(ev[0])) continue;
      const [seq, type, data] = ev;
      max = Math.max(max, seq);
      if (last === undefined || seq <= last) continue; // first sight of a player: don't replay old news
      if (type === 'chat') {
        const text = clean(data?.text, 200);
        if (text) this._chat(this.ghosts.get(key)?.name ?? clean(this.present.get(key)?.n, 20) ?? 'Someone', text, false);
      } else this.coop.receive(type, data, key);
    }
    this.lastSeq.set(key, max);
  }

  // ---------- presence from others (both transports) ----------

  _presence(key, pr) {
    if (key === this.selfKey) return;
    if (!pr || typeof pr !== 'object') { this._drop(key); return; }
    this.present.set(key, pr);
    const s = pr.s;
    const playing = s && typeof s === 'object' && Array.isArray(s.p) && Array.isArray(s.b);
    if (!playing) {
      this._drop(key, true);
      return;
    }
    const name = clean(pr.n, 20) || 'Wanderer';
    let g = this.ghosts.get(key);
    if (!g) {
      g = new Ghost(this.game, hashId(key), name);
      g.key = key;
      this.ghosts.set(key, g);
      this.coop.onGhostAdded(g);
      this.game.hud.toast(`${name} has entered the Vale.`, 'item');
      this.game.audio.play('bellSmall');
      this._changed();
    } else if (g.name !== name) {
      g.setName(name);
      this._changed();
    }
    g.receive(s);
    this._events(key, pr.ev);
    if (key === this.hostKey && this.coop.client && Array.isArray(pr.e)) this.coop.applySnapshot(pr.e, pr.fb);
  }

  _drop(key, keepPresence = false) {
    if (!keepPresence) {
      this.present.delete(key);
      this.lastSeq.delete(key);
    }
    const g = this.ghosts.get(key);
    if (!g) return;
    this.game.hud.toast(`${g.name} has left the Vale.`);
    this.coop.onGhostRemoved(g);
    g.dispose();
    this.ghosts.delete(key);
    this._changed();
  }

  _clear() {
    for (const g of this.ghosts.values()) {
      this.coop.onGhostRemoved(g);
      g.dispose();
    }
    this.ghosts.clear();
    this.present.clear();
    this.lastSeq.clear();
    this.hostKey = null;
    this.coop.setRole('solo');
  }

  // Host: the lowest key among the players in the Vale. Recomputed every send.
  _elect() {
    const playing = this.online && this.visible && this.game.mode === 'playing';
    const keys = [...this.ghosts.keys()];
    if (playing && this.selfKey != null) keys.push(this.selfKey);
    if (!playing || keys.length < 2) {
      this.hostKey = null;
      this.coop.setRole('solo');
      return;
    }
    keys.sort((a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
    const was = this.hostKey;
    this.hostKey = keys[0];
    this.coop.setRole(this.hostKey === this.selfKey ? 'host' : 'client');
    if (was !== this.hostKey) this._changed();
  }

  // ---------- claude.ai room ----------

  async _tryRoom() {
    const use = globalThis.claude?.use;
    if (typeof use !== 'function') {
      this.roomTried = true;
      // A plain website (GitHub Pages, Netlify...): no server, so players connect straight to each
      // other. Everyone lands in the public lobby unless they pick a party code.
      if (P2P.auto()) this.joinP2P('lobby');
      return;
    }
    let room = null;
    try { room = await use.call(globalThis.claude, 'room'); } catch { room = null; }
    this.roomTried = true;
    if (!room) {
      this.error = 'This page could not open its live room (shared Vale). Reload the page to try again.';
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
    this.error = '';
    this.status = target.connected() ? 'online' : 'connecting';
    this.unsubs.push(
      target.onConnection((c) => {
        const was = this.status;
        this.status = c ? 'online' : 'connecting';
        if (was !== this.status) this._changed();
      }, (e) => this._roomError(e)),
      target.onPeers((change) => {
        for (const p of change.left) this._drop(p.peer);
        for (const p of [...change.joined, ...change.updated]) {
          if (p.sameTab) { this.selfKey = p.peer; continue; }
          if (p.kind !== 'viewer') continue;
          this._presence(p.peer, p.presence);
        }
      }, (e) => this._roomError(e)),
    );
    // Our own peer label, if the room already knows it.
    const me = target.peers?.().find?.((p) => p.sameTab);
    if (me) this.selfKey = me.peer;
    this._changed();
  }

  _leaveTarget() {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    if (this.target) this.target.presence({ s: null, n: null, ev: null, e: null }).catch(() => {});
    this._clear();
    this.target = null;
  }

  _roomError(e) {
    this.status = 'offline';
    this.error = e?.code === 'not_granted' || e?.code === 'revoked'
      ? 'The shared Vale is not available to you on this page (it works for people the page is shared with, signed in to claude.ai).'
      : `The shared Vale stopped (${e?.code ?? 'error'}). Reload the page to rejoin.`;
    this._clear();
    this._changed();
  }

  // A party: a private named room (share the code with friends). '' goes back to the lobby.
  async joinParty(code) {
    if (this.mode === 'p2p') {
      code = String(code || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
      this.joinP2P(code || 'lobby');
      return;
    }
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
      else if (this.target) this.target.presence({ s: null, ev: null, e: null }).catch(() => {});
      this.party = code;
      this._enter(room);
    } catch (e) {
      this.error = e?.code === 'not_permitted' ? 'Parties are not available here; you are still in the shared Vale.' : 'Could not join that party. Try again in a moment.';
      this._changed();
    }
  }

  // Rejoin after a hiccup (the panel's Reconnect button).
  reconnect() {
    if (this.mode === 'p2p') this.joinP2P(this.party || 'lobby');
    else if (this.roomMode) this.joinParty(this.party);
    else if (this.url) this.connect(this.url, this.name);
  }

  setVisible(on) {
    this.visible = on;
    this._store(SHOW_KEY, on ? '1' : '0');
    if (!on) this._push({ nv: 2, n: this.name, s: null, ev: null, e: null });
    this._changed();
  }

  setName(name) {
    name = clean(name, 20);
    if (!name) return;
    this.name = this.storedName = name;
    this._store(NAME_KEY, name);
    this._changed();
  }

  // ---------- peer to peer (static websites) ----------

  // Joins party `code` directly with other players (WebRTC). The first one in becomes the party's hub
  // and relays everyone's presence, like server.js would; if the hub leaves, someone else takes over.
  joinP2P(code) {
    this.p2p?.close();
    this._clear();
    this.mode = 'p2p';
    this.party = code === 'lobby' ? '' : code;
    this.error = '';
    this.status = 'connecting';
    this._changed();
    this.p2p = new P2P(this, code);
  }

  // ---------- server.js (WebSocket) ----------

  connect(url = this.url, name = this.name) {
    if (this.roomMode) return;
    this.p2p?.close();
    this.p2p = null;
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

  _message(m) {
    switch (m.t) {
      case 'welcome':
        this.selfKey = m.id;
        this.status = 'online';
        this.game.hud.toast(m.peers.length ? `Joined the shared Vale: ${m.peers.length} other${m.peers.length > 1 ? 's' : ''} here.` : 'Joined the shared Vale. Nobody else is here yet.', 'item');
        this._changed();
        break;
      case 'leave':
        this._drop(m.id);
        break;
      case 'pr':
        this._presence(m.id, m.pr);
        break;
    }
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
    this.send('chat', { text });
    this._chat(this.name, text, true);
  }

  // ---------- your knight ----------

  // Your knight as the others will see it: root transform, joint angles, gear, Wisp if you ride, and
  // what the host's enemies need to fight you (state, swing count, alive, rolling).
  capture() {
    const g = this.game, p = g.player, r = p.model;
    const root = r.root;
    const b = [];
    for (const j of playerJoints(r)) b.push(r3(j.rotation.x), r3(j.rotation.y), r3(j.rotation.z));
    const m = {
      p: [r2(root.position.x), r2(root.position.y), r2(root.position.z)],
      r: [r3(root.rotation.x), r3(root.rotation.y), r3(root.rotation.z)],
      py: r3(r.pivot.position.y), hy: r3(r.hips.position.y),
      b, w: p.weaponId, s: p.shieldId ?? null,
      v: g.mode === 'playing' && root.visible ? 1 : 0,
      a: p.alive ? 1 : 0, st: p.state, as: p.atkSeq ?? 0, iv: p.invuln ? 1 : 0,
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

  // The whole presence object, trimmed to fit.
  _build() {
    const now = performance.now();
    while (this.outbox.length && now - this.outbox[0][3] > EV_KEEP * 1000) this.outbox.shift();
    const playing = this.game.mode === 'playing';
    const pr = { nv: 2, n: this.name, s: playing ? this.capture() : null, ev: this.outbox.map(([s, t, d]) => [s, t, d]) };
    if (this.coop.host) {
      pr.e = this.coop.snapshot();
      pr.fb = this.game.fieldBoss?.netId ?? null;
    }
    let json = JSON.stringify(pr);
    while (json.length > PRESENCE_MAX) {
      if (pr.e?.length > 8) pr.e.length = Math.floor(pr.e.length * 0.75);
      else if (pr.ev.length > 4) pr.ev.splice(0, pr.ev.length - 4);
      else if (pr.s?.h) delete pr.s.h;
      else break;
      json = JSON.stringify(pr);
    }
    return pr;
  }

  _push(pr) {
    if (this.mode === 'p2p') this.p2p?.send(pr);
    else if (this.roomMode) this.target?.presence(pr).catch(() => {});
    else if (this.ws?.readyState === 1 && this.ws.bufferedAmount < 64 * 1024) this.ws.send(JSON.stringify({ t: 'pr', pr }));
  }

  update(dt) {
    for (const g of this.ghosts.values()) g.update(dt);
    this.coop.tick(dt);
    if (!this.online) return;
    if ((this.sendT -= dt) > 0) return;
    this.sendT = SEND_RATE;
    this._elect();
    if (!this.visible) return;
    this._push(this._build());
  }
}

// ---------- WebRTC transport (PeerJS) ----------

const PEERJS_URL = new URL('../../vendor/peerjs.min.js', import.meta.url).href;
let peerLib = null;
function loadPeer() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  peerLib ??= new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = PEERJS_URL;
    sc.onload = () => resolve(globalThis.Peer);
    sc.onerror = () => { peerLib = null; reject(new Error('peerjs')); };
    document.head.appendChild(sc);
  });
  return peerLib;
}

class P2P {
  // Join the public lobby automatically on a real website (not on localhost, where server.js runs).
  static auto() {
    return location.protocol === 'https:' && !/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
  }

  constructor(net, code) {
    this.net = net;
    this.hubId = `ashenvale-v2-${code}-hub`;
    this.conns = new Map(); // hub: peer id -> connection
    this.conn = null; // client: the connection to the hub
    this.closed = false;
    this.opts = globalThis.ASHEN_PEER_OPTS ?? { debug: 0 };
    loadPeer().then(() => this._claim()).catch(() => this._fail('Could not load the multiplayer library.'));
  }

  // Try to become the hub; if the hub name is taken, join it as a client.
  _claim() {
    if (this.closed) return;
    const peer = new globalThis.Peer(this.hubId, this.opts);
    this.peer = peer;
    peer.on('open', (id) => this._online(id, true));
    peer.on('connection', (c) => this._accept(c));
    peer.on('error', (e) => {
      if (this.closed) return;
      if (e.type === 'unavailable-id') {
        peer.destroy();
        this._join();
      } else if (e.type !== 'peer-unavailable') this._fail(`Connection problem (${e.type}).`);
    });
  }

  _join() {
    if (this.closed) return;
    const peer = new globalThis.Peer(this.opts);
    this.peer = peer;
    peer.on('open', (id) => {
      const c = peer.connect(this.hubId, { serialization: 'json', reliable: true });
      this.conn = c;
      c.on('open', () => this._online(id, false));
      c.on('data', (m) => this.net._message(m));
      c.on('close', () => this._hubGone());
      c.on('error', () => this._hubGone());
    });
    peer.on('error', (e) => {
      if (this.closed) return;
      if (e.type === 'peer-unavailable') this._hubGone();
      else this._fail(`Connection problem (${e.type}).`);
    });
  }

  _online(id, hub) {
    const net = this.net;
    this.hub = hub;
    net.selfKey = id;
    net.status = 'online';
    net.error = '';
    net.game.hud.toast(hub ? 'Online: waiting for others to join your Vale.' : 'Joined the shared Vale.', 'item');
    net._changed();
  }

  // Hub: a player joins. Their presence is relayed to everyone else, and ours to them.
  _accept(c) {
    c.on('open', () => this.conns.set(c.peer, c));
    c.on('data', (m) => {
      if (!m || m.t !== 'pr' || typeof m.pr !== 'object') return;
      const msg = { t: 'pr', id: c.peer, pr: m.pr };
      for (const [id, o] of this.conns) if (id !== c.peer && o.open) o.send(msg);
      this.net._presence(c.peer, m.pr);
    });
    c.on('close', () => {
      this.conns.delete(c.peer);
      for (const o of this.conns.values()) if (o.open) o.send({ t: 'leave', id: c.peer });
      this.net._drop(c.peer);
    });
  }

  // The hub left: everyone tries to take over (one wins, the rest join it).
  _hubGone() {
    if (this.closed) return;
    this.net._clear();
    this.net.status = 'connecting';
    this.net._changed();
    this.peer?.destroy();
    this.conn = null;
    setTimeout(() => this._claim(), 500 + Math.random() * 1500);
  }

  _fail(msg) {
    this.net.status = 'offline';
    this.net.error = msg;
    this.net._changed();
  }

  send(pr) {
    if (this.hub) {
      const msg = { t: 'pr', id: this.net.selfKey, pr };
      for (const c of this.conns.values()) if (c.open) c.send(msg);
    } else if (this.conn?.open) this.conn.send({ t: 'pr', pr });
  }

  close() {
    this.closed = true;
    this.peer?.destroy();
  }
}
