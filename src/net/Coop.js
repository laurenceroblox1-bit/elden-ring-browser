// Shared enemies for multiplayer. One player's game is the host (picked by Net: the lowest key among
// the players in the Vale); it runs every enemy and boss as usual, except they now hunt whichever
// player is nearest. Everyone else's enemies become puppets: no AI, just the host's positions, states
// and moves replayed through their own animation code (snapshot in the host's presence, ~15 a second).
//
// Hits travel as small events (Net's event list, also in presence):
//   hit    a client's blow landed on a puppet  -> the host applies it to the real enemy
//   rip    a client started a riposte          -> the host holds the enemy for it
//   parry  a client parried a puppet's swing   -> the host staggers the real enemy
//   hurt   the host's enemy hit a client       -> that client resolves it against its own guard
//   fx     a projectile, shockwave, ice spike or falling bell -> everyone else draws it (no damage)
// So everyone's weapons, arts and rites hurt the same enemies, and everyone sees everyone's spells.
// The Warden (sealed in his arena) stays each player's own fight.
import * as THREE from '../lib/three.js';
import { damp, dampAngle } from '../core/math.js';

const SNAP_MAX = 26; // enemies per snapshot (nearest to any player first)
const SNAP_RANGE = 90; // metres from a player within which enemies are shared
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const FX_OWNER = { team: 'fx', pos: new THREE.Vector3(), alive: false };

// Projectile options worth sending (functions and hit objects stay home).
const PROJ_KEYS = ['kind', 'x', 'y', 'z', 'dirX', 'dirY', 'dirZ', 'speed', 'gravity', 'radius', 'life', 'scale', 'hug', 'pierce', 'color', 'color2', 'sound'];
const FX_KEYS = ['maxR', 'speed', 'color', 'start', 'thickness', 'radius', 'count', 'life', 'look', 'noBolt', 'height'];

export class Coop {
  constructor(game, net) {
    this.game = game;
    this.net = net;
    this.role = 'solo'; // solo | host | client
    this.extraSeq = 0;
    this.seen = new Map(); // client: netId -> seconds since last in a snapshot (for puppet extras)
  }

  get host() { return this.role === 'host'; }
  get client() { return this.role === 'client'; }

  // ---------- roles ----------

  setRole(role) {
    if (role === this.role) return;
    const g = this.game, was = this.role;
    this.role = role;
    for (const e of g.enemies) {
      if (e.netId === undefined) continue;
      const puppet = role === 'client';
      if (e.netPuppet && !puppet) {
        // Taking over as host: the enemy picks up from where the old host left it.
        e.netPuppet = false;
        e.move = null;
        if (e.alive && !['idle', 'dead'].includes(e.state)) {
          if (e._engage) e._engage();
          else { e.state = 'chase'; e.t = 0; }
        }
      }
      e.netPuppet = puppet;
    }
    if (was === 'client' && role !== 'client') {
      // Puppet copies of the old host's summons go.
      g.despawnExtras((e) => e.netPuppet || e.netRemote);
    }
    for (const gh of this.net.ghosts.values()) this._registerActor(gh);
    if (role !== 'client' && g.fieldBoss?.netPuppet) g.endFoeFight();
  }

  // Ghosts are combat targets for the host's enemies (and only there).
  _registerActor(gh) {
    const a = gh.actor;
    if (!a) return;
    if (this.host) this.game.combat.register(a);
    else this.game.combat.unregister(a);
  }

  onGhostAdded(gh) {
    gh.actor = makeActor(this, gh);
    this._registerActor(gh);
  }

  onGhostRemoved(gh) {
    if (gh.actor) this.game.combat.unregister(gh.actor);
  }

  // ---------- targeting (host and solo) ----------

  // The player an enemy should go after: the nearest one still standing.
  targetFor(e) {
    const p = this.game.player;
    if (!this.host) return p;
    let best = p.alive ? p : null, bd = best ? Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) : Infinity;
    for (const gh of this.net.ghosts.values()) {
      const a = gh.actor;
      if (!a?.alive) continue;
      const d = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z);
      if (d < bd) { bd = d; best = a; }
    }
    return best ?? p;
  }

  // Is another player within `r` metres of this enemy?
  othersNear(e, r) {
    for (const gh of this.net.ghosts.values()) if (gh.actor?.alive && Math.hypot(gh.actor.pos.x - e.pos.x, gh.actor.pos.z - e.pos.z) < r) return true;
    return false;
  }

  // Distance from an enemy to the nearest player (for sleeping far-off AI).
  nearestDist(e) {
    const p = this.game.player.pos;
    let d = Math.hypot(p.x - e.pos.x, p.z - e.pos.z);
    if (this.host) for (const gh of this.net.ghosts.values()) if (gh.actor?.alive) d = Math.min(d, Math.hypot(gh.actor.pos.x - e.pos.x, gh.actor.pos.z - e.pos.z));
    return d;
  }

  // ---------- host: snapshot ----------

  snapshot() {
    const g = this.game;
    const players = [g.player.pos, ...[...this.net.ghosts.values()].filter((gh) => gh.actor?.alive).map((gh) => gh.actor.pos)];
    const list = [];
    for (const e of g.enemies) {
      if (e.netRemote || e.ally) continue; // spirit allies are each player's own
      let d = Infinity;
      for (const q of players) d = Math.min(d, Math.hypot(q.x - e.pos.x, q.z - e.pos.z));
      if (d > SNAP_RANGE) continue;
      if (e.netId === undefined) {
        if (!g.extras.has(e)) continue;
        e.netId = `x${++this.extraSeq}`;
      }
      list.push([d, e]);
    }
    list.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [, e] of list.slice(0, SNAP_MAX)) {
      const mv = e.moveName ?? e.move?.name ?? (typeof e.move === 'string' ? e.move : null);
      const m = mv && (e.state === 'attack' || e.state === mv) ? mv : 0;
      const flags = (e.isOpen?.() ? 1 : 0) | (e.invuln ? 2 : 0) | (e.alive ? 4 : 0) | (e.lockable ? 8 : 0);
      const row = [e.netId, r1(e.pos.x), r1(e.pos.y), r1(e.pos.z), r2(e.yaw), Math.ceil(e.hp), e.state, r2(e.t), m, flags];
      if (typeof e.netId === 'string') row.push(e.spawn.kind, e.spawn.pack ?? 0);
      out.push(row);
    }
    return out;
  }

  // ---------- client: puppets ----------

  applySnapshot(rows, fb) {
    const g = this.game;
    const byId = new Map();
    for (const e of g.enemies) if (e.netId !== undefined) byId.set(e.netId, e);
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 10) continue;
      const [id, x, y, z, yaw, hp, state, t, m, flags, kind, pack] = row;
      if (![x, y, z, yaw, hp, t].every(Number.isFinite) || typeof state !== 'string') continue;
      let e = byId.get(id);
      if (!e && typeof id === 'string' && typeof kind === 'string') {
        // One of the host's summons: make a puppet copy of it here.
        e = g.summonEnemy(kind, x, z, yaw, pack ? { pack } : {});
        if (!e) continue;
        e.netId = id;
        e.netRemote = true;
        byId.set(id, e);
      }
      if (!e) continue;
      e.netPuppet = true;
      this.seen.set(e, 0);
      const wasAlive = e.netAlive ?? e.alive;
      e.net = { x, y, z, yaw };
      e.hp = Math.max(0, hp);
      e.alive = !!(flags & 4);
      e.invuln = !!(flags & 2);
      e.openT = flags & 1 ? 0.5 : 0;
      e.lockable = !!(flags & 8);
      if (m && m !== e.netMove) {
        e.netMove = m;
        try { (e._startMove ?? e._start)?.call(e, m); } catch { /* a move this build does not know */ }
      } else if (!m) e.netMove = null;
      if (e.state !== state || Math.abs(e.t - t) > 0.25) {
        e.state = state;
        e.t = t;
      }
      if (e.netFirst === undefined) {
        e.netFirst = true;
        e.pos.set(x, y, z);
        e.yaw = yaw;
      }
      if (wasAlive && !e.alive) this._puppetDied(e);
      e.netAlive = e.alive;
    }
    // The field boss the host is fighting: show its bar here when it's near.
    const boss = fb != null ? byId.get(fb) : null;
    const p = g.player.pos;
    if (boss && boss.alive && Math.hypot(boss.pos.x - p.x, boss.pos.z - p.z) < 90) {
      if (g.fieldBoss !== boss) {
        g.fieldBoss = boss;
        g.hud.setBoss(boss.name);
        g.audio.setMusic(true, boss.music ?? 'bell');
      }
    } else if (g.fieldBoss?.netPuppet) {
      g.fieldBoss = null;
      g.hud.setBoss(null);
      g.audio.setMusic(false);
    }
  }

  // A puppet died on the host: everyone near gets the ash and the quest credit (and a boss's reward).
  _puppetDied(e) {
    const g = this.game, p = g.player.pos;
    e.state = 'dead';
    e.t = 0;
    if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) > 70) return;
    if (e.isBoss && e.flag) g.onFoeBossDefeated(e);
    g.onEnemyKilled(e);
  }

  // Per frame, for each puppet: ease toward the host's numbers and animate.
  updatePuppet(e, dt) {
    const n = e.net;
    if (n) {
      if (Math.hypot(n.x - e.pos.x, n.z - e.pos.z) > 8) e.pos.set(n.x, n.y, n.z);
      e.pos.x = damp(e.pos.x, n.x, 12, dt);
      e.pos.y = damp(e.pos.y, n.y, 12, dt);
      e.pos.z = damp(e.pos.z, n.z, 12, dt);
      e.yaw = dampAngle(e.yaw, n.yaw, 12, dt);
    }
    e.t += dt;
    if (e.recentT > 0) e.recentT -= dt;
    if (e.state === 'dead') {
      if (e.shown !== undefined) e.shown = e.t < 3.6;
      else if (e.t > 3.6) e.model.root.visible = false;
    } else if (e.alive) {
      if (e.shown !== undefined) e.shown = true;
    }
    try {
      e._animate(dt, null);
    } catch {
      // A state whose move didn't come through: stand ready until the next snapshot.
      e.state = e.shown !== undefined ? 'stalk' : 'circle';
      e.move = null;
    }
    e._sync?.();
  }

  // Puppet extras the host no longer sends (gone on its side) are removed after a few seconds.
  tick(dt) {
    if (!this.client) return;
    let stale = null;
    for (const [e, t] of this.seen) {
      const nt = t + dt;
      this.seen.set(e, nt);
      if (e.netRemote && nt > 4) (stale ??= []).push(e);
    }
    if (stale) {
      for (const e of stale) this.seen.delete(e);
      this.game.despawnExtras((e) => stale.includes(e));
    }
  }

  // ---------- events ----------

  // Client: my blow landed on a puppet.
  sendHit(e, h) {
    this.net.send('hit', {
      i: e.netId, d: r1(h.dmg), p: r1(h.poise ?? 10), f: h.frost ? r1(h.frost) : 0, h: h.heavy ? 1 : 0,
      bu: h.burn ? r1(h.burn) : 0, po: h.poison ? r1(h.poison) : 0,
      r: h.riposte ? 1 : 0, b: h.backstabbed ? 1 : 0, u: h.unblockable ? 1 : 0, k: h.knock ?? 0,
    });
    e.recentDmg = (e.recentT > 0 ? e.recentDmg ?? 0 : 0) + h.dmg;
    e.recentT = 2.2;
  }

  riposte(e) {
    if (!e.isOpen?.()) return false;
    this.net.send('rip', { i: e.netId });
    e.state = 'riposted';
    e.t = 0;
    e.openT = 0;
    return true;
  }

  parried(e) {
    this.net.send('parry', { i: e.netId });
  }

  // Host: one of my enemies hit a ghost. Its owner resolves the blow against their own guard.
  hurtGhost(gh, hit) {
    const a = hit.attacker;
    this.net.send('hurt', {
      to: gh.key, i: a?.netId ?? null, d: r1(hit.dmg), p: r1(hit.poise ?? 20), f: hit.frost ? r1(hit.frost) : 0,
      bu: hit.burn ? r1(hit.burn) : 0, po: hit.poison ? r1(hit.poison) : 0,
      h: hit.heavy ? 1 : 0, u: hit.unblockable ? 1 : 0, pa: hit.parryable ? 1 : 0, k: hit.knock ?? 0,
      ox: r1(a?.pos?.x ?? gh.actor.pos.x), oz: r1(a?.pos?.z ?? gh.actor.pos.z),
    });
    return true;
  }

  // An event from another player (`from` is their key).
  receive(type, d, from) {
    const g = this.game;
    if (!d || typeof d !== 'object') return;
    const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);
    if (type === 'fx') return this._replayFx(d);
    if (type === 'hurt') {
      if (d.to !== this.net.selfKey) return;
      const e = this._byId(d.i);
      const attacker = e ?? { team: 'enemy', pos: new THREE.Vector3(d.ox, 0, d.oz), onParried() {}, alive: true };
      const hit = { dmg: num(d.d, 0, 400), poise: num(d.p, 0, 200), frost: num(d.f, 0, 100), burn: num(d.bu, 0, 100), poison: num(d.po, 0, 100), heavy: !!d.h, unblockable: !!d.u, knock: num(d.k, 0, 12) };
      g.combat.apply(attacker, g.player, hit, new Set(), num(d.ox, -2000, 2000), num(d.oz, -2000, 2000), !!d.pa);
      return;
    }
    if (!this.host) return;
    const e = this._byId(d.i);
    const gh = this.net.ghosts.get(from);
    if (!e || !gh?.actor || e.netPuppet) return;
    if (type === 'hit') {
      if (!e.alive) return;
      const hit = { dmg: num(d.d, 0, 2000), poise: num(d.p, 0, 300), frost: num(d.f, 0, 100), burn: num(d.bu, 0, 100), poison: num(d.po, 0, 100), heavy: !!d.h, riposte: !!d.r, backstabbed: !!d.b, unblockable: !!d.u, knock: num(d.k, 0, 12) };
      g.combat.apply(gh.actor, e, hit, new Set(), gh.actor.pos.x, gh.actor.pos.z, false);
    } else if (type === 'rip') {
      e.onRiposte?.(gh.actor);
    } else if (type === 'parry') {
      e.onParried?.(gh.actor);
    }
  }

  _byId(id) {
    if (id === null || id === undefined) return null;
    for (const e of this.game.enemies) if (e.netId === id) return e;
    return null;
  }

  // ---------- effects ----------

  // Called by Projectiles and Effects when something is spawned: mine (and my enemies', as host) go out.
  fx(kind, owner, o, extra = {}) {
    if (this.role === 'solo' || o?.ghostFx) return;
    const g = this.game;
    const mine = owner === g.player || (this.host && owner?.netId !== undefined && !owner.netPuppet);
    if (!mine) return;
    const d = { k: kind, ...extra };
    for (const key of kind === 'p' ? PROJ_KEYS : FX_KEYS) {
      const v = o[key];
      if (v === undefined) continue;
      d[key] = typeof v === 'number' ? r2(v) : v;
    }
    this.net.send('fx', d);
  }

  _replayFx(d) {
    const g = this.game;
    const n = (v) => (Number.isFinite(v) ? v : 0);
    const o = { ghostFx: true };
    for (const key of [...PROJ_KEYS, ...FX_KEYS]) if (d[key] !== undefined && (typeof d[key] === 'number' || typeof d[key] === 'string' || typeof d[key] === 'boolean')) o[key] = d[key];
    if (d.k === 'p') {
      if (!['bolt', 'crescent', 'arrow', 'shard', 'boulder', 'fire', 'magma', 'spore', 'water', 'sand', 'spark'].includes(o.kind)) return;
      g.projectiles.spawn(FX_OWNER, { ...o, x: n(o.x), y: n(o.y), z: n(o.z), dirX: n(o.dirX), dirY: n(o.dirY), dirZ: n(o.dirZ) });
    } else if (d.k === 'wave') g.effects.shockwave(FX_OWNER, n(d.x), n(d.z), o);
    else if (d.k === 'spike') g.effects.iceSpike(FX_OWNER, n(d.x), n(d.z), Math.min(3, n(d.delay)), o);
    else if (d.k === 'bell') g.effects.bellDrop(FX_OWNER, n(d.x), n(d.z), Math.min(3, n(d.delay)), o);
    else if (d.k === 'bolt') g.effects.lightning(FX_OWNER, n(d.x), n(d.z), Math.min(3, n(d.delay)), o);
    else if (d.k === 'haz') g.effects.hazard(FX_OWNER, n(d.x), n(d.z), { ...o, life: Math.min(12, n(o.life)), radius: Math.min(12, n(o.radius)) });
  }
}

// What the host's enemies see of another player: a combat target that forwards blows to its owner.
function makeActor(coop, gh) {
  const a = {
    isGhost: true,
    team: 'player',
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    radius: 0.45,
    height: 1.8,
    lockHeight: 1.3,
    alive: false,
    invuln: false,
    lockable: false,
    state: 'move',
    atkSeq: 0,
    get forwardX() { return Math.sin(this.yaw); },
    get forwardZ() { return Math.cos(this.yaw); },
    lockPoint(out) { return out.set(this.pos.x, this.pos.y + this.lockHeight, this.pos.z); },
    takeHit: (hit) => coop.hurtGhost(gh, hit),
    addFrost() {},
    isOpen: () => false,
    onParried() {},
    onRiposte: () => false,
  };
  return a;
}
