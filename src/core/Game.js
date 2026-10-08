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
import { Projectiles } from '../effects/Projectiles.js';
import { Combat } from '../systems/Combat.js';
import { BossIntro, BOSS_INTRO_LENGTH } from './Cutscene.js';
import { Quests } from '../systems/Quests.js';
import { Interactions } from '../systems/Interactions.js';
import { Save, newGameState, mergeSave, levelOf, levelCost } from '../systems/Save.js';
import { Player } from '../entities/Player.js';
import { Horse } from '../entities/Horse.js';
import { createEnemy } from '../entities/spawn.js';
import { Warden } from '../entities/Warden.js';
import { NPC } from '../entities/NPC.js';
import { HUD } from '../ui/HUD.js';
import { TestMenu } from '../ui/TestMenu.js';
import { MapScreen } from '../ui/MapScreen.js';
import { navigate, focusFirst } from './Gamepad.js';
import { QUESTS } from '../data/quests.js';
import { DIALOGUE } from '../data/dialogue.js';
import { ITEMS } from '../data/items.js';
import { WORLD, ZONES, NOTICE, ENEMY_SPAWNS, PICKUPS, NPCS, ARENA } from '../data/world.js';
import { LOOT, gearOf, ALL_GEAR } from '../data/loot.js';
import { WEAPONS } from '../data/weapons.js';
import { glowSprite, mesh, ico, mat } from '../models/kit.js';
import { buildGearDisplay } from '../models/weapons.js';

const tmp = new THREE.Vector3();
const SCREENS = new Set(['pause', 'journal', 'shrine', 'equipment']); // modals with their own HUD screen
const MENU_KEYS = ['interact', 'roll', 'light', 'heavy', 'guard', 'art', 'rite', 'pause', 'journal', 'equipment', 'map', 'testMenu', 'back', 'confirm', 'whistle', 'flask', 'lockOn'];
const DPAD = ['Pad12', 'Pad13', 'Pad14', 'Pad15'];

const DRAW_DIST = 150; // metres from the camera beyond which enemies aren't drawn
const THINK_DIST = 120; // idle enemies further than this from the player don't run their AI

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
    this.timeScale = 1; // test menu: scales the simulation step
    this.cheats = { stamina: false, focus: false, freeze: false };
    this.extras = new Set(); // enemies spawned from the test menu; removed on rest, death and respawn-all

    this.events = new Events();
    this.input = new Input(this.canvas);
    this.audio = new AudioFx();
    this.audio.muted = !!Save.pref('muted');
    this.state = newGameState();
    this.hud = new HUD(app.querySelector('#hud'), this);
    this.hud.perf = this.debug; // the performance overlay starts on with #debug
    this.particles = new Particles(this.scene);
    this.effects = new Effects(this);
    this.projectiles = new Projectiles(this);
    this.sky = new Sky(this.scene);
    this.sky.bakeEnvironment(r);
    this.world = new World(this);
    this.combat = new Combat(this);
    this.quests = new Quests(this, QUESTS);
    this.interactions = new Interactions(this);
    this.player = new Player(this);
    this.horse = new Horse(this);
    this.enemies = ENEMY_SPAWNS.map((s) => createEnemy(this, s));
    this.boss = new Warden(this);
    this.npcs = NPCS.map((d) => new NPC(this, d));
    this.cam = new CameraRig(this);
    // Full-screen menus that build their own DOM (the others live in HUD's template).
    this.panels = { testmenu: new TestMenu(this.hud.root, this), map: new MapScreen(this.hud.root, this) };
    this.input.pad.onChange = (on, id) => this._onPad(on, id);
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
    const bell = this.world.chapelBell;
    if (bell) I.add({ x: bell.x, z: bell.z, radius: 3, label: () => 'Examine the cracked bell', action: () => this.talk('chapel_bell') });
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
    tip('guardBreak', 'Your guard broke. Blocking costs stamina, and a blade alone stops little. A shield stops more.');
    tip('noFocus', 'Not enough focus. It creeps back on its own and refills at a lantern. Mind raises it.');
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    // resScale drops automatically when frames run slow (see _adaptResolution).
    const pr = Math.min(devicePixelRatio || 1, this.quality === 'high' ? 1.75 : 1) * (this.resScale ?? 1);
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
    this.state = mergeSave(saved);
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
    this.player.equip(st.gear);
    this._clearPickups();
    for (const p of PICKUPS) if (!this.hasItem(p.item) && (!p.quest || this.quests.status(p.quest) !== 'done')) this.spawnPickup(p.item, p.x, p.z);
    for (const l of LOOT) if (!this.hasGear(l.gear)) this.spawnPickup(l.gear, l.x, l.z);
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
    if (!this.input.usingPad) this.input.requestLock();
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
    if (this.cutscene) {
      this.cutscene.done = true;
      this.cutscene = null;
      this.hud.setLetterbox(false);
    }
    this.despawnExtras();
    for (const e of this.enemies) e.reset();
    this.effects.clear();
    this.projectiles.clear();
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

  // ---------- gear ----------

  hasGear(id) { return this.state.gear.owned.includes(id); }

  // Adds a weapon, shield or rite to what you own. Returns false if it was already yours.
  giveGear(id) {
    const info = gearOf(id);
    if (!info || this.hasGear(id)) return false;
    this.state.gear.owned.push(id);
    this.hud.toast(`Acquired: ${info.def.name}`, 'item');
    this.audio.play('pickup');
    this.events.emit('gearGained', id);
    if (!this.state.flags.gearTip) {
      this.state.flags.gearTip = true;
      this.after(1.6, () => this.hud.toast('Press I to open your equipment and take it in hand.'));
    }
    this.save();
    return true;
  }

  // Puts owned gear `id` in `slot` ('right' | 'left' | 'rite'), or empties the slot with id null.
  // A two-handed weapon stows the shield; a shield takes a one-handed weapon, or it can't be raised.
  equip(slot, id) {
    const g = this.state.gear;
    if (id && !this.hasGear(id)) return false;
    if (slot === 'right') {
      if (!WEAPONS[id]) return false;
      g.right = id;
      if (WEAPONS[id].hands > 1 && g.left) {
        g.left = null;
        this.hud.toast('Both hands on the weapon: your shield is stowed.');
      }
    } else if (slot === 'left') {
      if (id && gearOf(id)?.slot !== 'shield') return false;
      if (id && WEAPONS[g.right].hands > 1) {
        this.hud.toast(`The ${WEAPONS[g.right].name} needs both hands.`);
        return false;
      }
      g.left = id;
    } else if (slot === 'rite') {
      if (id && gearOf(id)?.slot !== 'rite') return false;
      g.rite = id;
    } else return false;
    this.player.equip(g);
    this.audio.play('equip');
    this.events.emit('equipped', { slot, id });
    this.save();
    return true;
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
    p.focus = p.maxFocus;
    this.audio.play('kindle');
    this.save();
    this.hud.refreshShrine();
  }

  // ---------- world objects ----------

  // A key item (a glinting gem) or a piece of gear (the thing itself, turning slowly over a cooler glow).
  spawnPickup(item, x, z) {
    const y = this.world.getHeight(x, z);
    const gear = gearOf(item);
    const glow = glowSprite(gear ? 0xd8e6ff : 0xfff0c0, gear ? 2.2 : 1.6, 0.9);
    glow.position.set(x, y + 0.5, z);
    let gem;
    if (gear) {
      gem = buildGearDisplay(item);
      gem.position.set(x, y + (gear.slot === 'rite' ? 0.7 : 0.95), z);
      gem.traverse((o) => { o.castShadow = false; }); // small and glowing: the shadow pass isn't worth its calls
    } else {
      gem = mesh(ico(0.12, 0), mat(0xfff4d0, { emissive: 0xffd080, emissiveIntensity: 2 }), { x, y: y + 0.45, z, shadow: false });
    }
    this.scene.add(glow, gem);
    const pk = { item, x, z, y, glow, gem, spin: gear ? 0.8 : 2 };
    pk.inter = this.interactions.add({ x, z, radius: gear ? 2.6 : 2.2, label: () => (gear ? `Take the ${gear.def.name}` : 'Pick up'), action: () => {
      if (gear) this.giveGear(item);
      else this.giveItem(item);
      this._removePickup(pk);
    } });
    this.pickups.push(pk);
  }

  _removePickup(pk) {
    this.scene.remove(pk.glow, pk.gem);
    this.interactions.remove(pk.inter);
    this.pickups.splice(this.pickups.indexOf(pk), 1);
  }

  // Takes any pickup of `item` off the ground (the test menu hands it over directly).
  removePickupsOf(item) {
    for (const pk of [...this.pickups]) if (pk.item === item) this._removePickup(pk);
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
    p.focus = p.maxFocus;
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
    p.focus = p.maxFocus;
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

  startBossFight({ cutscene = true } = {}) {
    this.bossFight = true;
    this.audio.setMusic(true);
    if (!cutscene) {
      this.boss.awaken();
      this.hud.setBoss(this.boss.name);
      return;
    }
    this.boss.awaken(BOSS_INTRO_LENGTH);
    this.cutscene = new BossIntro(this, () => {
      this.cutscene = null;
      // A skipped cutscene cuts the Warden's rise short too.
      this.boss.introLen = Math.min(this.boss.introLen ?? BOSS_INTRO_LENGTH, this.boss.t + 0.6);
      this.hud.setBoss(this.boss.name);
    });
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
      this.after(3.4, () => this.giveGear('bell_maul')); // no-op if the quest reward already gave it
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
    if (SCREENS.has(name)) this.hud.showScreen(name, true);
    this.panels[name]?.show();
    this.hud.setPrompt(null);
    if (this.input.usingPad) focusFirst(this._menuRoot());
  }

  // Menus that need the mouse (equipment, map, test menu). From the pause menu the cursor is
  // already free, so the pause screen just gives way.
  openMenu(name) {
    if (this.mode !== 'playing') return;
    if (this.modal === 'pause') {
      this.hud.showScreen('pause', false);
      this.modal = null;
    }
    if (this.modal) return;
    this.openModal(name, true);
  }

  openEquipment() {
    this.openMenu('equipment');
  }

  closeModal() {
    const m = this.modal;
    this.modal = null;
    if (SCREENS.has(m)) this.hud.showScreen(m, false);
    this.panels[m]?.hide();
    if (document.activeElement?.blur && this.hud.root.contains(document.activeElement)) document.activeElement.blur();
    if (this.mode === 'playing' && !this.input.locked && !this.input.usingPad) this.input.requestLock();
  }

  // The DOM root of the open menu that the gamepad can move around in, or null (none, or a dialogue).
  _menuRoot() {
    if (this.mode !== 'playing') return this.hud.el.title;
    if (SCREENS.has(this.modal)) return this.hud.el[this.modal];
    return this.panels[this.modal]?.root ?? null;
  }

  // D-pad or left stick moves the focus between buttons, A presses the focused one. Returns true
  // when A was used here, so the same press doesn't also close or act.
  _padMenu(root) {
    const i = this.input;
    for (const c of DPAD) i.eat(c);
    const n = i.pad.nav;
    if (n.x || n.y) {
      navigate(root, n.x, n.y);
      this.audio.play('ui');
    }
    if (!i.pressed('confirm')) return false;
    i.consume('confirm');
    i.consume('roll');
    const el = document.activeElement;
    if (el && root.contains(el) && el.tagName === 'BUTTON') el.click();
    else focusFirst(root);
    return true;
  }

  _onPad(connected, id) {
    const name = id.replace(/\s*\(.*$/, '').slice(0, 40) || 'Gamepad';
    this.hud.toast(connected ? `Gamepad connected: ${name}` : 'Gamepad disconnected', connected ? 'item' : '');
    this.hud.setPadMode(connected && this.input.usingPad);
    // Losing the pad mid-fight shouldn't leave you standing there: pause.
    if (!connected && this.mode === 'playing' && !this.modal) this.openModal('pause', true);
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
    const root = this.modal ? this._menuRoot() : null;
    const used = root ? this._padMenu(root) : false;
    const shut = (...actions) => actions.some((a) => i.pressed(a)) && this.closeModal();
    if (!used) switch (this.modal) {
      case 'dialogue':
        if (i.pressed('interact') || i.pressed('roll') || i.pressed('light')) this.hud.advanceDialogue();
        break;
      case 'journal': shut('journal', 'pause', 'back'); break;
      case 'pause': shut('pause', 'back'); break;
      case 'shrine': shut('pause', 'interact'); break;
      case 'equipment': shut('equipment', 'pause', 'back'); break;
      case 'testmenu': shut('testMenu', 'pause', 'back'); break;
      case 'map': shut('map', 'pause', 'back'); break;
      case null:
        if (i.pressed('pause')) this.openModal('pause', true);
        else if (i.pressed('journal')) this.openModal('journal');
        else if (i.pressed('equipment')) this.openEquipment();
        else if (i.pressed('map')) this.openMenu('map');
        else if (i.pressed('testMenu')) this.openMenu('testmenu');
        break;
    }
    // The key that closes a menu or dialogue must not also act in the world this frame.
    if (hadModal || this.modal) for (const a of MENU_KEYS) i.consume(a);
  }

  // ---------- loop ----------

  frame() {
    const now = performance.now();
    this._adaptResolution((now - this.last) / 1000);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    if (this.mode === 'playing') this._play(dt);
    else this._title(dt);
    this.particles.update(this.modal ? 0 : dt * this.timeScale);
    this.world.update(dt * this.timeScale, this.time);
    this.sky.update(this.camera.position, this.player.pos);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  // Dynamic resolution: if the frame rate sags below ~40 fps for a second, render fewer pixels;
  // when it has headroom again, climb back toward full resolution.
  _adaptResolution(raw) {
    if (!(raw > 0) || raw > 0.5) return; // tab switches and first frames aren't real frame times
    this.frameAvg = this.frameAvg ? this.frameAvg + (raw - this.frameAvg) * 0.05 : raw;
    this.resScale ??= 1;
    if ((this.resT = (this.resT ?? 0) + raw) < 1.5) return;
    this.resT = 0;
    const before = this.resScale;
    if (this.frameAvg > 1 / 40 && this.resScale > 0.55) this.resScale = Math.max(0.55, this.resScale - 0.1);
    else if (this.frameAvg < 1 / 57 && this.resScale < 1) this.resScale = Math.min(1, this.resScale + 0.05);
    if (this.resScale !== before) this.resize();
  }

  // Enemies far from the player that are only standing guard skip their AI, and anything beyond
  // the draw distance from the camera isn't drawn at all (frustum culling already skips what's
  // behind the camera). Foes (hounds, acolytes) manage their own draw distance.
  _updateEnemies(dt) {
    const c = this.camera.position, p = this.player.pos;
    for (const e of this.enemies) {
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (!(d > THINK_DIST && e.state === 'idle')) e.update(dt);
      if (e.shown !== undefined) continue;
      const far = Math.hypot(e.pos.x - c.x, e.pos.z - c.z) > DRAW_DIST;
      const root = e.model.root;
      if (far && root.visible) {
        root.visible = false;
        e.culled = true;
      } else if (!far && e.culled) {
        e.culled = false;
        if (e.alive) root.visible = true;
      }
    }
  }

  _title(dt) {
    const i = this.input;
    i.pad.menu = true;
    i.poll();
    this._padModeSync();
    if (i.pad.connected) this._padMenu(this.hud.el.title);
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
    const i = this.input;
    i.pad.menu = !!(this.modal && this._menuRoot());
    i.poll();
    this._padModeSync();
    this._modalKeys();
    if (this.cutscene && !this.modal) {
      // Cutscene: the world keeps breathing (the Warden rises, particles drift) but nobody acts.
      this.boss.update(dt);
      this.effects.update(dt);
      this.combat.update(dt);
      for (const n of this.npcs) n.update(dt);
      this._timers(dt);
      this.cutscene?.update(dt);
      return;
    }
    if (!this.modal) {
      // The test menu's time scale slows or speeds the whole simulation; hit-stop slows it further.
      let sdt = dt * this.timeScale;
      if (this.hitstop > 0) {
        this.hitstop -= sdt;
        sdt *= 0.12;
      }
      this._lockOn();
      this._whistle();
      if (this.debug) this._debugKeys();
      // A roll takes its length from the stick: start it at full tilt even from a half-pushed stick.
      i.fullTilt = i.pressed('roll') || this.player.buffer?.a === 'roll';
      this.player.update(sdt);
      i.fullTilt = false;
      this._cheats();
      this.horse.update(sdt);
      if (!this.cheats.freeze) {
        this._updateEnemies(sdt);
        this.boss.update(sdt);
      }
      this._separate();
      for (const n of this.npcs) n.update(sdt);
      this.effects.update(sdt);
      this.projectiles.update(sdt);
      this.combat.update(dt * this.timeScale);
      this.interactions.update();
      this._timers(sdt);
      this._zones(dt);
      this._pickupFx(dt);
      this._ambient(dt, this.player.pos);
    }
    this.cam.update(dt, !this.modal || this.modal === 'dialogue');
  }

  // Keeps the HUD's key glyphs and control lists in step with the device in use.
  _padModeSync() {
    const pad = this.input.usingPad && this.input.pad.connected;
    if (pad !== this.hud.padMode) this.hud.setPadMode(pad);
  }

  _cheats() {
    const p = this.player, c = this.cheats;
    if (c.stamina) {
      p.stamina = p.maxStamina;
      p.winded = false;
    }
    if (c.focus) p.focus = p.maxFocus;
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
    const found = this.zoneAt(p.x, p.z);
    if (found && found !== this.zone && this.player.alive) {
      if (!this.bossFight) this.hud.banner(ZONES[found].name, '', 'area');
      this.events.emit('zoneEntered', found);
    }
    if (found) {
      this.zone = found;
      this._discover(found);
    }
  }

  zoneAt(x, z) {
    let found = null;
    for (const [id, zn] of Object.entries(ZONES)) if (Math.hypot(x - zn.x, z - zn.z) < zn.r) found = id;
    return found;
  }

  // The map labels places once you've been there.
  _discover(id) {
    const d = this.state.discovered;
    if (!id || d.includes(id)) return;
    d.push(id);
    this.save();
  }

  // ---------- travel and test tools (test menu, map) ----------

  // Puts the player at (x, z) facing `yaw`, leaving the game consistent: off the horse, no lock-on,
  // any running boss fight ended (unless `keepFight`), the zone banner shown. False while fallen.
  teleport(x, z, yaw = Math.PI, { keepFight = false, banner = true } = {}) {
    const p = this.player;
    if (!p.alive) return false;
    if (this.horse.ridden) this.horse.dismount(true);
    this.horse.hideNow();
    this.lockTarget = null;
    if (this.bossFight && !keepFight) this.endBossFight();
    if (p.state === 'fog') this.world.fogGate.collider.enabled = true; // the walk's onDone won't run now
    p.pos.set(x, 0, z);
    this.world.resolve(p.pos, p.radius);
    p.pos.y = this.world.getHeight(p.pos.x, p.pos.z);
    p.vel.set(0, 0, 0);
    p.vy = 0;
    p.onGround = true;
    p.yaw = yaw;
    p.state = 'move';
    p.atk = p.act = p.buffer = p.rip = null;
    p.invuln = false;
    p.model.flask.visible = false;
    this.cam.snapBehind(yaw);
    const zone = this.zoneAt(p.pos.x, p.pos.z);
    this.zone = zone;
    this._discover(zone);
    if (banner && zone) this.hud.banner(ZONES[zone].name, '', 'area');
    return true;
  }

  // Stops a running Warden fight without a winner: he kneels again and the mist seals.
  endBossFight() {
    if (!this.bossFight) return;
    this.bossFight = false;
    this.hud.setBoss(null);
    this.audio.setMusic(false);
    if (this.lockTarget === this.boss) this.lockTarget = null;
    if (!this.boss.alive) return; // already beaten: let the victory play out
    this.boss.reset();
    this.effects.clear();
    this.projectiles.clear();
    this.world.setFogGate(true);
    this.world.fogGate.collider.enabled = true;
  }

  // Inside the arena, facing Odran, and the fight begins (a fresh one if one was running).
  enterBossFight() {
    if (this.state.flags.wardenDead || !this.player.alive) return false;
    this.endBossFight();
    if (this.boss.state !== 'dormant') this.boss.reset();
    const f = this.world.fogGate;
    this.teleport(f.x, f.z - 5, Math.PI);
    this.startBossFight();
    return true;
  }

  // Undoes the Warden's defeat: he kneels in the arena again, the mist re-seals and the north gate shuts.
  reviveWarden() {
    this.state.flags.wardenDead = false;
    this.bossFight = false;
    this.boss.reset();
    this.hud.setBoss(null);
    this.audio.setMusic(false);
    this.world.setFogGate(true);
    this.world.fogGate.collider.enabled = true;
    this.world.closeGate();
    const p = this.player.pos;
    if (this.world.inArena(p.x, p.z, 2)) this.teleport(this.world.fogGate.x, this.world.fogGate.z + 4, Math.PI);
    this.save();
  }

  // Map fast travel: a rest-free hop to a lit lantern. Returns a reason it can't happen, or null.
  fastTravel(id) {
    const s = this.world.shrines.get(id);
    if (!s || !s.lit) return 'That lantern has not been kindled.';
    if (this.bossFight) return 'The mist holds you here until the fight is done.';
    if (!this.player.alive) return 'You cannot travel while fallen.';
    if (this.player.state === 'fog') return 'Not while passing through the mist.';
    this.teleport(s.x, s.z + 2.5, Math.PI, { banner: false });
    this.hud.banner(s.name, 'The lantern answers', 'kindle', 3000);
    this.audio.play('mist');
    return null;
  }

  // Spawns an enemy of `kind` a few metres in front of the player, facing them.
  spawnEnemy(kind, dist = 5) {
    const p = this.player;
    tmp.set(p.pos.x + Math.sin(p.yaw) * dist, 0, p.pos.z + Math.cos(p.yaw) * dist);
    this.world.resolve(tmp, 0.6);
    const e = createEnemy(this, { kind, x: tmp.x, z: tmp.z, yaw: p.yaw + Math.PI });
    this.enemies.push(e);
    this.extras.add(e);
    return e;
  }

  despawnExtras() {
    if (!this.extras.size) return;
    for (const e of this.extras) {
      this.scene.remove(e.model.root);
      this.combat.unregister(e);
      e.dispose?.();
      if (this.lockTarget === e) this.lockTarget = null;
    }
    this.enemies = this.enemies.filter((e) => !this.extras.has(e));
    this.extras.clear();
  }

  respawnEnemies() {
    this.despawnExtras();
    for (const e of this.enemies) e.reset();
    this.lockTarget = null;
  }

  // Fells every living enemy within `r` metres (not the Warden). Returns how many.
  killNearby(r = 30) {
    const p = this.player;
    let n = 0;
    for (const e of [...this.enemies]) {
      if (!e.alive || Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > r) continue;
      e.invuln = false;
      this.combat.strike(p, e, { dmg: 1e6, poise: 1e3, heavy: true, unblockable: true });
      n++;
    }
    return n;
  }

  _pickupFx(dt) {
    const pp = this.player.pos;
    for (const pk of this.pickups) {
      // Far away only the glow shows, as a beacon; the model (several draw calls) appears up close.
      pk.gem.visible = Math.abs(pk.x - pp.x) + Math.abs(pk.z - pp.z) < 80;
      pk.gem.rotation.y += dt * pk.spin;
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
    const go = (x, z) => this.teleport(x, z, this.player.yaw, { banner: false });
    const jumps = { Digit1: ZONES.firstlight, Digit2: ZONES.camp, Digit3: ZONES.ruins, Digit4: ZONES.lake, Digit5: ZONES.moor, Digit6: ZONES.gatehouse };
    for (const [code, z] of Object.entries(jumps)) if (i.justDown.has(code)) go(z.x + 3, z.z + 3);
    if (i.justDown.has('Digit7')) go(ARENA.x, ARENA.z + ARENA.r + 4);
    if (i.justDown.has('KeyG')) { this.player.god = !this.player.god; this.hud.toast(`God mode ${this.player.god ? 'on' : 'off'}`); }
    if (i.justDown.has('KeyU')) { this.state.flags.horse = true; this.hud.toast('Wisp unlocked'); }
    if (i.justDown.has('KeyK') && this.bossFight) this.boss.takeHit({ dmg: 9999, poise: 0, dirX: 0, dirZ: 1 });
    if (i.justDown.has('KeyL')) { this.state.ash += 5000; }
    if (i.justDown.has('KeyY')) { for (const id of ALL_GEAR) this.giveGear(id); }
  }
}

