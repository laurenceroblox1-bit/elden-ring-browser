// Game: owns the renderer, the loop and the glue between systems (deaths, shrines, the boss fight, saves).
import * as THREE from '../lib/three.js';
import { Events } from './Events.js';
import { Input } from './Input.js';
import { AudioFx } from './Audio.js';
import { CameraRig } from './CameraRig.js';
import { World } from '../world/World.js';
import { Sky } from '../world/Sky.js';
import { Particles } from '../effects/Particles.js';
import { Effects } from '../effects/Effects.js';
import { Combat } from '../systems/Combat.js';
import { Quests } from '../systems/Quests.js';
import { Interactions } from '../systems/Interactions.js';
import { Save, newGameState, levelOf, levelCost } from '../systems/Save.js';
import { Player } from '../entities/Player.js';
import { Horse } from '../entities/Horse.js';
import { Sentry } from '../entities/Sentry.js';
import { Warden } from '../entities/Warden.js';
import { NPC } from '../entities/NPC.js';
import { HUD } from '../ui/HUD.js';
import { QUESTS } from '../data/quests.js';
import { DIALOGUE } from '../data/dialogue.js';
import { ITEMS } from '../data/items.js';
import { WORLD, ZONES, NOTICE, ENEMY_SPAWNS, PICKUPS, NPCS, ARENA } from '../data/world.js';
import { glowSprite, mesh, ico, mat } from '../models/kit.js';

const tmp = new THREE.Vector3();

export class Game {
  constructor(app) {
    this.app = app;
    this.canvas = app.querySelector('#view');
    this.debug = location.hash.includes('debug');
    this.quality = Save.pref('quality') ?? 'high';

    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2400);

    this.time = 0;
    this.hitstop = 0;
    this.timers = [];
    this.mode = 'title';
    this.modal = null;
    this.bossFight = false;
    this.lockTarget = null;
    this.zone = null;
    this.zoneT = 0;
    this.pickups = [];
    this.remnant = null;

    this.events = new Events();
    this.input = new Input(this.canvas);
    this.audio = new AudioFx();
    this.audio.muted = !!Save.pref('muted');
    this.state = newGameState();
    this.hud = new HUD(app.querySelector('#hud'), this);
    this.particles = new Particles(this.scene);
    this.effects = new Effects(this);
    this.sky = new Sky(this.scene);
    this.sky.bakeEnvironment(r);
    this.world = new World(this);
    this.combat = new Combat(this);
    this.quests = new Quests(this, QUESTS);
    this.interactions = new Interactions(this);
    this.player = new Player(this);
    this.horse = new Horse(this);
    this.enemies = ENEMY_SPAWNS.map((s) => new Sentry(this, s));
    this.boss = new Warden(this);
    this.npcs = NPCS.map((d) => new NPC(this, d));
    this.cam = new CameraRig(this);
    this._registerInteractables();
    this._combatTips();

    this.input.onLockChange = (locked) => this._onLockChange(locked);
    addEventListener('resize', () => this.resize());
    this.setQuality(this.quality);

    // Title backdrop: the first shrine, lit, with the Unbound standing by it.
    this.world.shrines.get('firstlight').lit = true;
    this.player.applyStats(this.state.stats, this.state.flasksMax);
    this.player.respawn(WORLD.spawn.x, WORLD.spawn.z, WORLD.spawn.yaw);
    this.hud.showTitle(!!Save.load());

    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- setup ----------

  _registerInteractables() {
    const I = this.interactions;
    for (const s of this.world.shrines.values()) {
      I.add({ x: s.x, z: s.z, radius: 3.2, label: () => (s.lit ? 'Rest at the lantern' : 'Kindle the lantern'), action: () => (s.lit ? this.rest(s) : this.kindle(s)) });
    }
    for (const n of NPCS) I.add({ x: n.x, z: n.z, radius: 2.8, label: () => `Talk to ${n.name}`, action: () => this.talk(n.id) });
    I.add({ x: NOTICE.x, z: NOTICE.z, radius: 2.4, label: () => 'Read the notice', action: () => this.talk('notice') });
    const fog = this.world.fogGate;
    I.add({ x: fog.x, z: fog.z + 1.8, radius: 3.2, enabled: () => fog.active && !this.bossFight, label: () => 'Pass through the mist', action: () => this.enterMist() });
    const cd = this.world.castleDoor;
    I.add({ x: cd.x, z: cd.z + 3, radius: 5, label: () => 'Examine the doors', action: () => this.talk('castle') });
  }

  // One-time hints the first time the player meets each guard mechanic (per page session).
  _combatTips() {
    const shown = new Set();
    const tip = (event, text) => this.events.on(event, () => {
      if (shown.has(event)) return;
      shown.add(event);
      this.after(0.4, () => this.hud.toast(text));
    });
    tip('parry', 'A clean parry. Strike while your foe reels to riposte.');
    tip('guardBreak', 'Your guard broke. Blocking costs stamina, and a sword alone stops little.');
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const pr = Math.min(devicePixelRatio || 1, this.quality === 'high' ? 1.75 : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.particles.setViewport(h * pr, this.camera.fov);
  }

  setQuality(q) {
    this.quality = q;
    Save.pref('quality', q);
    this.sky.sun.castShadow = q === 'high';
    this.resize();
  }

  setMuted(m) {
    this.audio.setMuted(m);
    Save.pref('muted', m);
  }

  // ---------- state ----------

  newGame() {
    Save.clear();
    this.state = newGameState();
    this.quests.load(null);
    this._enterWorld();
    this.hud.banner('Ashen Vale', 'The Shrine of First Light', 'area', 4200);
    this.zone = 'firstlight';
    this.after(1.5, () => this.quests.start('warden'));
    this.after(4.5, () => this.hud.toast('Kindle the lantern beside you with E. Press J for your journal.'));
    this.save();
  }

  continueGame() {
    const saved = Save.load();
    if (!saved) return this.newGame();
    this.state = { ...newGameState(), ...saved, flags: { ...newGameState().flags, ...saved.flags } };
    this.quests.load(saved.quests);
    this._enterWorld();
    const s = this.world.shrines.get(this.state.shrine);
    this.hud.banner(s?.name ?? 'Ashen Vale', '', 'area');
  }

  _enterWorld() {
    const st = this.state;
    this.audio.init();
    this.hud.hideTitle();
    this.mode = 'playing';
    this.input.captureOnClick = true;
    this.modal = null;
    for (const s of this.world.shrines.values()) s.lit = st.shrinesLit.includes(s.id);
    this.player.applyStats(st.stats, st.flasksMax);
    this._clearPickups();
    for (const p of PICKUPS) if (!this.hasItem(p.item) && (!p.quest || this.quests.status(p.quest) !== 'done')) this.spawnPickup(p.item, p.x, p.z);
    if (st.remnant) this.spawnRemnant(st.remnant.x, st.remnant.z, st.remnant.amount);
    else this._removeRemnant();
    if (st.flags.wardenDead) {
      this.boss.vanish();
      this.world.setFogGate(false);
      this.world.fogGate.collider.enabled = false;
      this.world.openGate(true);
    }
    this.resetWorld();
    this._spawnAtShrine();
    this.input.requestLock();
  }

  _spawnAtShrine() {
    const s = this.world.shrines.get(this.state.shrine);
    if (this.state.shrine === 'firstlight' && !s.lit) {
      this.player.respawn(WORLD.spawn.x, WORLD.spawn.z, WORLD.spawn.yaw);
    } else {
      const yaw = Math.PI;
      this.player.respawn(s.x - Math.sin(yaw) * 2.5, s.z - Math.cos(yaw) * 2.5, yaw);
    }
    this.cam.snapBehind(this.player.yaw);
  }

  // Respawns enemies and resets an unfinished boss fight. Called on rest and on death.
  resetWorld() {
    for (const e of this.enemies) e.reset();
    this.effects.clear();
    this.lockTarget = null;
    if (!this.state.flags.wardenDead) {
      this.boss.reset();
      this.world.setFogGate(true);
      this.world.fogGate.collider.enabled = true;
      if (this.world.gateDoors.open > 0) this.world.closeGate();
    }
    this.bossFight = false;
    this.hud.setBoss(null);
    this.audio.setMusic(false);
    if (this.horse.ridden) this.horse.dismount(true);
    this.horse.hideNow();
  }

  save() {
    if (this.mode !== 'playing') return;
    this.state.quests = this.quests.serialize();
    Save.write(this.state);
  }

  quitToTitle() {
    this.save();
    this.modal = null;
    this.hud.showScreen('pause', false);
    this.mode = 'title';
    this.input.captureOnClick = false;
    this.input.exitLock();
    this.resetWorld();
    this.hud.setPrompt(null);
    this.hud.clearBanner();
    this.hud.showTitle(true);
  }

  after(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  // ---------- inventory & currency ----------

  hasItem(id) { return (this.state.inventory[id] ?? 0) > 0; }

  giveItem(id) {
    this.state.inventory[id] = (this.state.inventory[id] ?? 0) + 1;
    this.hud.toast(`Acquired: ${ITEMS[id]?.name ?? id}`, 'item');
    this.audio.play('pickup');
    this.events.emit('itemGained', id);
    this.save();
  }

  takeItem(id) {
    if (this.hasItem(id)) this.state.inventory[id]--;
  }

  addAsh(n) {
    this.state.ash += Math.round(n);
  }

  levelUp(stat) {
    const cost = levelCost(levelOf(this.state.stats));
    if (this.state.ash < cost) return;
    this.state.ash -= cost;
    this.state.stats[stat]++;
    const p = this.player;
    p.applyStats(this.state.stats, this.state.flasksMax);
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    this.audio.play('kindle');
    this.save();
    this.hud.refreshShrine();
  }

  // ---------- world objects ----------

  spawnPickup(item, x, z) {
    const y = this.world.getHeight(x, z);
    const glow = glowSprite(0xfff0c0, 1.6, 0.9);
    glow.position.set(x, y + 0.5, z);
    const gem = mesh(ico(0.12, 0), mat(0xfff4d0, { emissive: 0xffd080, emissiveIntensity: 2 }), { x, y: y + 0.45, z, shadow: false });
    this.scene.add(glow, gem);
    const pk = { item, x, z, y, glow, gem };
    pk.inter = this.interactions.add({ x, z, radius: 2.2, label: () => 'Pick up', action: () => {
      this.giveItem(item);
      this._removePickup(pk);
    } });
    this.pickups.push(pk);
  }

  _removePickup(pk) {
    this.scene.remove(pk.glow, pk.gem);
    this.interactions.remove(pk.inter);
    this.pickups.splice(this.pickups.indexOf(pk), 1);
  }

  _clearPickups() {
    while (this.pickups.length) this._removePickup(this.pickups[0]);
  }

  spawnRemnant(x, z, amount) {
    this._removeRemnant();
    const y = this.world.getHeight(x, z);
    const glow = glowSprite(0xc8e6a0, 2.2, 0.85);
    glow.position.set(x, y + 0.7, z);
    this.scene.add(glow);
    this.state.remnant = { x, z, amount };
    this.remnant = { x, z, y, amount, glow };
    this.remnant.inter = this.interactions.add({ x, z, radius: 2.2, label: () => `Reclaim your ash (${amount})`, action: () => {
      this.addAsh(amount);
      this.audio.play('pickup');
      this.hud.toast(`Reclaimed ${amount} ash`, 'item');
      this._removeRemnant();
      this.save();
    } });
  }

  _removeRemnant() {
    if (!this.remnant) {
      this.state.remnant = null;
      return;
    }
    this.scene.remove(this.remnant.glow);
    this.interactions.remove(this.remnant.inter);
    this.remnant = null;
    this.state.remnant = null;
  }

  // ---------- interactions ----------

  kindle(s) {
    s.lit = true;
    if (!this.state.shrinesLit.includes(s.id)) this.state.shrinesLit.push(s.id);
    this.state.shrine = s.id;
    const p = this.player;
    p.hp = p.maxHp;
    p.flasks = p.flasksMax;
    this.audio.play('kindle');
    this.hud.banner('Lantern Kindled', s.name, 'kindle', 3200);
    this.particles.emit({ x: s.x + 0.38, y: this.world.getHeight(s.x, s.z) + 2, z: s.z, count: 60, speed: 3, up: 2, color: 0xffb050, color2: 0xfff0c0, life: [0.6, 1.4], size: [0.08, 0.18], drag: 1.5 });
    this.events.emit('shrineKindled', s.id);
    this.save();
  }

  rest(s) {
    this.state.shrine = s.id;
    this.resetWorld();
    const p = this.player;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.flasks = p.flasksMax;
    this.save();
    this.openModal('shrine', true);
    this.hud.openShrine(s);
  }

  talk(id) {
    const d = DIALOGUE[id](this);
    this.openModal('dialogue');
    this.hud.openDialogue(d.name, d.lines, () => {
      this.closeModal();
      d.effect?.();
    });
  }

  enterMist() {
    const f = this.world.fogGate;
    f.collider.enabled = false;
    this.audio.play('mist');
    this.lockTarget = null;
    this.player.startFogWalk(f.x, f.z + 1.2, f.x, f.z - 4, () => {
      f.collider.enabled = true;
      if (!this.state.flags.wardenDead) this.startBossFight();
    });
  }

  startBossFight() {
    this.bossFight = true;
    this.boss.awaken();
    this.hud.setBoss(this.boss.name);
    this.audio.setMusic(true);
  }

  // ---------- outcomes ----------

  onEnemyKilled(e) {
    this.addAsh(e.ash);
    this.events.emit('enemyKilled', e);
    if (this.lockTarget === e) this.lockTarget = null;
    const drop = e.spawn.drop;
    if (drop && !this.hasItem(drop) && this.quests.status('steed') !== 'done') {
      const x = e.pos.x, z = e.pos.z;
      this.after(1.2, () => {
        if (!this.pickups.some((pk) => pk.item === drop)) this.spawnPickup(drop, x, z);
      });
    }
  }

  onBossDefeated(b) {
    this.lockTarget = null;
    this.audio.setMusic(false);
    this.after(2.6, () => {
      this.hud.banner('The Warden Is Silenced', 'Odran, the Bell-Warden', 'victory', 6000);
      this.audio.play('victory');
      this.addAsh(b.ash);
      this.state.flags.wardenDead = true;
      this.bossFight = false;
      this.hud.setBoss(null);
      this.world.setFogGate(false);
      this.world.fogGate.collider.enabled = false;
      this.world.openGate();
      this.events.emit('bossDefeated', 'warden');
      this.after(2.5, () => this.giveItem('warden_bell'));
      this.save();
    });
  }

  onPlayerDeath() {
    this.lockTarget = null;
    this.audio.play('death');
    this.audio.setMusic(false);
    const at = this.player.pos.clone();
    this.after(1.4, () => this.hud.banner('You Have Fallen', '', 'death', 4200));
    this.after(5.2, () => {
      if (this.state.ash > 0) this.spawnRemnant(at.x, at.z, this.state.ash);
      else this._removeRemnant();
      this.state.ash = 0;
      this.hud.ashShown = 0;
      this.resetWorld();
      this._spawnAtShrine();
      this.save();
    });
  }

  cameraShake(amount) {
    this.cam.shake(amount);
  }

  // ---------- modals ----------

  openModal(name, needsCursor = false) {
    this.modal = name;
    if (needsCursor && this.input.locked) {
      this.expectUnlock = true;
      this.input.exitLock();
    }
    if (name === 'pause' || name === 'journal' || name === 'shrine') this.hud.showScreen(name, true);
    this.hud.setPrompt(null);
  }

  closeModal() {
    const m = this.modal;
    this.modal = null;
    if (m === 'pause' || m === 'journal' || m === 'shrine') this.hud.showScreen(m, false);
    if (this.mode === 'playing' && !this.input.locked) this.input.requestLock();
  }

  _onLockChange(locked) {
    if (locked || this.mode !== 'playing') return;
    if (this.expectUnlock) {
      this.expectUnlock = false;
      return;
    }
    if (!this.modal) this.openModal('pause', false);
  }

  _modalKeys() {
    const i = this.input;
    const hadModal = !!this.modal;
    switch (this.modal) {
      case 'dialogue':
        if (i.pressed('interact') || i.pressed('roll') || i.pressed('light')) this.hud.advanceDialogue();
        break;
      case 'journal':
        if (i.pressed('journal') || i.pressed('pause')) this.closeModal();
        break;
      case 'pause':
        if (i.pressed('pause')) this.closeModal();
        break;
      case 'shrine':
        if (i.pressed('pause') || i.pressed('interact')) this.closeModal();
        break;
      case null:
        if (i.pressed('pause')) this.openModal('pause', true);
        else if (i.pressed('journal')) this.openModal('journal');
        break;
    }
    // The key that closes a menu or dialogue must not also act in the world this frame.
    if (hadModal || this.modal) for (const a of ['interact', 'roll', 'light', 'heavy', 'guard', 'pause', 'journal']) i.consume(a);
  }

  // ---------- loop ----------

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    if (this.mode === 'playing') this._play(dt);
    else this._title(dt);
    this.particles.update(this.modal ? 0 : dt);
    this.world.update(dt, this.time);
    this.sky.update(this.camera.position, this.player.pos);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _title(dt) {
    const s = this.world.shrines.get('firstlight');
    const a = this.time * 0.04 + 2.2;
    const y = this.world.getHeight(s.x, s.z);
    this.camera.position.set(s.x + Math.sin(a) * 15, y + 5.5, s.z + Math.cos(a) * 15);
    this.camera.lookAt(s.x - 2, y + 2.2, s.z - 4);
    this.player._animate(dt, 0);
    for (const n of this.npcs) n.update(dt);
    this._ambient(dt, this.camera.position);
  }

  _play(dt) {
    this._modalKeys();
    if (!this.modal) {
      let sdt = dt;
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        sdt = dt * 0.12;
      }
      this._lockOn();
      this._whistle();
      if (this.debug) this._debugKeys();
      this.player.update(sdt);
      this.horse.update(sdt);
      for (const e of this.enemies) e.update(sdt);
      this.boss.update(sdt);
      this._separate();
      for (const n of this.npcs) n.update(sdt);
      this.effects.update(sdt);
      this.combat.update(dt);
      this.interactions.update();
      this._timers(sdt);
      this._zones(dt);
      this._pickupFx(dt);
      this._ambient(dt, this.player.pos);
    }
    this.cam.update(dt, !this.modal || this.modal === 'dialogue');
  }

  _timers(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if ((t.t -= dt) <= 0) {
        this.timers.splice(i, 1);
        t.fn();
      }
    }
  }

  _lockOn() {
    const t = this.lockTarget;
    if (t && (!t.alive || !t.lockable || t.pos.distanceTo(this.player.pos) > 34 || !this.player.alive)) this.lockTarget = null;
    if (!this.input.pressed('lockOn')) return;
    if (this.lockTarget) {
      this.lockTarget = null;
      return;
    }
    const cam = this.camera;
    const fwd = cam.getWorldDirection(tmp).setY(0).normalize();
    let best = null, bestScore = Infinity;
    for (const e of [...this.enemies, this.boss]) {
      if (!e.alive || !e.lockable) continue;
      const dx = e.pos.x - this.player.pos.x, dz = e.pos.z - this.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 26) continue;
      const dot = (dx * fwd.x + dz * fwd.z) / (d || 1);
      if (dot < 0.2 && d > 4) continue;
      const score = d * 0.15 + (1 - dot) * 6;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    this.lockTarget = best;
    if (!best) this.cam.snapBehind(this.player.yaw);
  }

  _whistle() {
    if (!this.input.pressed('whistle')) return;
    this.input.consume('whistle');
    if (this.horse.ridden) {
      this.horse.dismount();
      return;
    }
    const reason = this.horse.blockedReason();
    if (reason) this.hud.toast(reason);
    else if (reason === null) this.horse.summon();
  }

  // Bodies don't overlap: the player is pushed out of enemies (and enemies out of each other a little).
  _separate() {
    const p = this.player;
    if (p.mounted) return;
    for (const e of [...this.enemies, this.boss]) {
      if (!e.alive || !e.model.root.visible) continue;
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
      const min = p.radius + e.radius;
      const d = Math.hypot(dx, dz);
      if (d >= min || d < 1e-4) continue;
      const push = min - d;
      const share = e === this.boss ? 1 : 0.6;
      p.pos.x += (dx / d) * push * share;
      p.pos.z += (dz / d) * push * share;
      e.pos.x -= (dx / d) * push * (1 - share);
      e.pos.z -= (dz / d) * push * (1 - share);
    }
  }

  _zones(dt) {
    if ((this.zoneT -= dt) > 0) return;
    this.zoneT = 0.5;
    const p = this.player.pos;
    let found = null;
    for (const [id, z] of Object.entries(ZONES)) if (Math.hypot(p.x - z.x, p.z - z.z) < z.r) found = id;
    if (found && found !== this.zone && !this.bossFight && this.player.alive) this.hud.banner(ZONES[found].name, '', 'area');
    if (found) this.zone = found;
  }

  _pickupFx(dt) {
    for (const pk of this.pickups) {
      pk.gem.rotation.y += dt * 2;
      pk.glow.material.opacity = 0.7 + Math.sin(this.time * 3 + pk.x) * 0.2;
      if (Math.random() < dt * 4) this.particles.emit({ x: pk.x, y: pk.y + 0.4, z: pk.z, count: 1, speed: 0.2, up: 1, color: 0xfff0c0, life: [0.8, 1.4], size: [0.04, 0.08], jitter: 0.2 });
    }
    if (this.remnant && Math.random() < dt * 5) {
      const r = this.remnant;
      this.particles.emit({ x: r.x, y: r.y + 0.4, z: r.z, count: 1, speed: 0.3, up: 1.2, color: 0xc8e6a0, life: [0.8, 1.5], size: [0.05, 0.1], jitter: 0.3 });
    }
  }

  // Drifting golden motes around the viewer.
  _ambient(dt, around) {
    if (Math.random() < dt * 14) {
      this.particles.emit({
        x: around.x + (Math.random() - 0.5) * 40, y: around.y + 0.5 + Math.random() * 6, z: around.z + (Math.random() - 0.5) * 40,
        count: 1, speed: 0.25, up: 0.15, color: 0xffe0a0, color2: 0xfff6dd, life: [3, 6], size: [0.04, 0.08], drag: 0.2,
      });
    }
  }

  // ---------- debug (#debug in the URL) ----------

  _debugKeys() {
    const i = this.input;
    const go = (x, z) => {
      if (this.horse.ridden) this.horse.dismount();
      this.player.pos.set(x, this.world.getHeight(x, z), z);
    };
    const jumps = { Digit1: ZONES.firstlight, Digit2: ZONES.camp, Digit3: ZONES.ruins, Digit4: ZONES.lake, Digit5: ZONES.moor, Digit6: ZONES.gatehouse };
    for (const [code, z] of Object.entries(jumps)) if (i.justDown.has(code)) go(z.x + 3, z.z + 3);
    if (i.justDown.has('Digit7')) go(ARENA.x, ARENA.z + ARENA.r + 4);
    if (i.justDown.has('KeyG')) { this.player.god = !this.player.god; this.hud.toast(`God mode ${this.player.god ? 'on' : 'off'}`); }
    if (i.justDown.has('KeyU')) { this.state.flags.horse = true; this.hud.toast('Wisp unlocked'); }
    if (i.justDown.has('KeyK') && this.bossFight) this.boss.takeHit({ dmg: 9999, poise: 0, dirX: 0, dirZ: 1 });
    if (i.justDown.has('KeyL')) { this.state.ash += 5000; }
  }
}

