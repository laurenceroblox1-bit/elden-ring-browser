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
import { PostFX } from './PostFX.js';
import { DebugViews } from '../ui/DebugViews.js';
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
import { NetPanel } from '../ui/NetPanel.js';
import { ShopPanel } from '../ui/ShopPanel.js';
import { Net } from '../net/Net.js';
import { MapScreen } from '../ui/MapScreen.js';
import { navigate, focusFirst } from './Gamepad.js';
import { QUESTS } from '../data/quests.js';
import { DIALOGUE } from '../data/dialogue.js';
import { ITEMS } from '../data/items.js';
import { WORLD, ZONES, NOTICE, ENEMY_SPAWNS, PICKUPS, NPCS, ARENA, HOLLOW, RIME, HALL, FEN } from '../data/world.js';
import { STONES, GREAT_ONES, LOBES } from '../data/biomes.js';
import { MAX_LEVEL, upgradeCost, levelName } from '../data/smithing.js';

// The weather each region brings with it; the Vale and the fen keep whatever the Vale has.
const REGION_WEATHER = { rime: 'snow', cinder: 'cinders', coast: 'seamist', glow: 'spores', dunes: 'dunesun', storm: 'storm', bell: 'bellmist' };
import { LOOT, gearOf, ALL_GEAR } from '../data/loot.js';
import { WEAPONS } from '../data/weapons.js';
import { glowSprite, mesh, ico, mat } from '../models/kit.js';
import { buildGearDisplay } from '../models/weapons.js';

const tmp = new THREE.Vector3();
const SCREENS = new Set(['pause', 'journal', 'shrine', 'equipment']); // modals with their own HUD screen
const MENU_KEYS = ['multiplayer', 'chat', 'interact', 'roll', 'light', 'heavy', 'guard', 'art', 'rite', 'pause', 'journal', 'equipment', 'map', 'testMenu', 'back', 'confirm', 'whistle', 'flask', 'lockOn'];
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
    this.post = new PostFX(r);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2400);

    this.time = 0;
    this.hitstop = 0;
    this.timers = [];
    this.mode = 'title';
    this.modal = null;
    this.bossFight = false;
    this.fieldBoss = null; // a roaming boss while its fight runs (Vharra, Saelith, the troll)
    this.lockTarget = null;
    this.zone = null;
    this.zoneT = 0;
    this.pickups = [];
    this.remnant = null;
    this.timeScale = 1; // test menu: scales the simulation step
    this.cheats = { stamina: false, focus: false, freeze: false, oneHit: false, flasks: false };
    this.extras = new Set(); // enemies spawned from the test menu; removed on rest, death and respawn-all
    this.allies = new Set(); // spirit allies (summonAllies)

    this.events = new Events();
    this.input = new Input(this.canvas);
    this.audio = new AudioFx();
    this.audio.listener = this.camera;
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
    // The Hollow Bell: each great one's death is a step towards it; the last fight ends the journey.
    this.events.on('bossDefeated', (id) => {
      this._checkBell();
      if (id === 'bellringer') this.after(9, () => this.showEnding());
    });
    this.interactions = new Interactions(this);
    this.player = new Player(this);
    this.horse = new Horse(this);
    this.enemies = ENEMY_SPAWNS.map((s, i) => Object.assign(createEnemy(this, s), { netId: i })); // netId: shared in multiplayer
    this.boss = new Warden(this);
    this.npcs = NPCS.map((d) => new NPC(this, d));
    this.cam = new CameraRig(this);
    this.debugViews = new DebugViews(this);
    // Full-screen menus that build their own DOM (the others live in HUD's template).
    this.net = new Net(this);
    this.panels = { testmenu: new TestMenu(this.hud.root, this), map: new MapScreen(this.hud.root, this), multiplayer: new NetPanel(this.hud.root, this), shop: new ShopPanel(this.hud.root, this) };
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
    I.add({ x: cd.x, z: cd.z, radius: 4, enabled: () => !this.state.flags.wardenDead, label: () => 'Examine the doors', action: () => this.talk('castle') });
    // The Bell's mist: it tells you who still lives.
    const bg = LOBES.bell.gate;
    I.add({ x: bg[0] - 3, z: bg[1] + 3, radius: 4, enabled: () => !GREAT_ONES.every(([k]) => this.state.flags[k]), label: () => "Examine the Bell's mist", action: () => {
      const left = GREAT_ONES.filter(([k]) => !this.state.flags[k]).map(([, n]) => n);
      this.hud.toast(`The mist will not part while ${left.length > 1 ? 'these still live' : 'this one still lives'}: ${left.join('; ')}.`);
    } });
    // Tamsin's crates at the oasis: her shop, once you've spoken with her.
    I.add({ x: 551, z: 36, radius: 2.4, enabled: () => !!this.state.flags.metTamsin, label: () => "Trade with Tamsin", action: () => this.openMenu('shop') });
    // Hessa's anvil in the Sunken Forge: smithing (data/smithing.js).
    I.add({ x: -90, z: 545, radius: 2.4, label: () => this._anvilLabel(), action: () => this.smith() });
  }

  _anvilLabel() {
    const id = this.player.weaponId, lvl = this.state.upgrades?.[id] ?? 0;
    const name = levelName(WEAPONS[id].name, lvl);
    if (lvl >= MAX_LEVEL) return `${name} is as strong as Hessa can make it`;
    const c = upgradeCost(lvl);
    return `Smith ${name} to +${lvl + 1} (${c.stones} stone${c.stones > 1 ? 's' : ''}, ${c.ash} ash)`;
  }

  // Raises the weapon in hand one level at the anvil, if you have the stones and the ash.
  smith() {
    const id = this.player.weaponId, ups = (this.state.upgrades ??= {});
    const lvl = ups[id] ?? 0;
    if (lvl >= MAX_LEVEL) return this.hud.toast('Hessa shakes her head: no more can be done for that one.');
    const c = upgradeCost(lvl);
    const have = this.state.inventory.smithing_stone ?? 0;
    if (have < c.stones) return this.hud.toast(`You need ${c.stones} smithing stone${c.stones > 1 ? 's' : ''} (you have ${have}).`);
    if (this.state.ash < c.ash) return this.hud.toast(`You need ${c.ash} ash.`);
    this.state.inventory.smithing_stone = have - c.stones;
    this.state.ash -= c.ash;
    ups[id] = lvl + 1;
    this.player._scaleDamage();
    this.audio.play('smith');
    this.particles.emit({ x: -90, y: this.world.getHeight(-90, 545) + 1.2, z: 545, count: 40, speed: 4, up: 3, color: 0xffa040, color2: 0xfff0c0, life: [0.3, 0.8], size: [0.05, 0.12], gravity: 8, drag: 1 });
    this.hud.toast(`${levelName(WEAPONS[id].name, lvl + 1)}: it bites harder now.`, 'item');
    this.events.emit('smithed', id);
    this.save();
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
    this.post.setSize(Math.round(w * pr), Math.round(h * pr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.particles.setViewport(h * pr, this.camera.fov);
  }

  setQuality(q) {
    this.quality = q;
    Save.pref('quality', q);
    this.sky.sun.castShadow = q === 'high';
    this.post.enabled = q === 'high';
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

  // Starts the Hollow Bell quest once a great one has fallen, and moves it on once all five have.
  _checkBell(quiet = false) {
    const f = this.state.flags, q = this.quests;
    const dead = GREAT_ONES.filter(([flag]) => f[flag]).length;
    if (!dead) return;
    if (q.status('hollowbell') === 'inactive') q.start('hollowbell', quiet);
    if (dead === GREAT_ONES.length && q.status('hollowbell') === 'active' && q.state.hollowbell.stage === 0) {
      q.advance('hollowbell');
      if (!quiet) this.after(4, () => this.hud.banner('The Mist Lifts', 'The Hollow Bell waits on the eastern peaks', 'kindle', 5000));
    }
  }

  // The end of the journey: a card over the world, then back to exploring.
  showEnding() {
    if (this.endingShown) return;
    this.endingShown = true;
    const st = this.state, f = st.flags;
    const bosses = ['wardenDead', 'motherDead', 'trollDead', 'saelithDead', ...GREAT_ONES.map(([k]) => k), 'bellDead'].filter((k) => f[k]).length;
    const el = document.createElement('section');
    el.className = 'screen ending-screen';
    el.innerHTML = `
      <div class="panel ending-panel" role="dialog" aria-label="The journey's end">
        <h2>The Bell Is Silent</h2>
        <p>The Bell-Ringer lies broken under the spire, and the Hollow Bell will never toll again. The Warden's gate stands open, the Rimewold thaws, the Old Fire is out, the tide runs clean, the Hollows grow back, the dunes are quiet and the storm has broken.</p>
        <p>The Vale is free. Thank you for playing.</p>
        <ul class="ending-stats">
          <li><b>${bosses}</b><span>great foes felled</span></li>
          <li><b>${levelOf(st.stats)}</b><span>level</span></li>
          <li><b>${st.gear.owned.length}</b><span>pieces of gear</span></li>
          <li><b>${st.discovered.length}</b><span>places found</span></li>
        </ul>
        <div class="test-btns"><button class="btn primary ending-go">Keep exploring</button></div>
      </div>`;
    this.hud.root.appendChild(el);
    this.input.exitLock?.();
    const close = () => { el.remove(); if (this.mode === 'playing' && !this.input.usingPad) this.input.requestLock?.(); };
    el.querySelector('.ending-go').addEventListener('click', close);
    this.audio.play('victory');
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
    this._checkBell(true);
    // Smithing stones: each one is picked up once per journey.
    const taken = (this.state.stonesTaken ??= []);
    STONES.forEach((st, i) => {
      if (!taken.includes(i)) this.spawnPickup('smithing_stone', st.x, st.z, () => taken.includes(i) || taken.push(i));
    });
    if (st.remnant) this.spawnRemnant(st.remnant.x, st.remnant.z, st.remnant.amount);
    else this._removeRemnant();
    if (st.flags.wardenDead) {
      this.boss.vanish();
      this.world.setFogGate(false);
      this.world.fogGate.collider.enabled = false;
      this.world.openGate(true);
      if (this.quests.status('winter') === 'inactive') this.after(1, () => this.quests.start('winter'));
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
    // Multiplayer host: enemies another player is fighting right now carry on (they aren't yours to reset).
    const busy = (e) => this.net.coop.host && this.net.coop.othersNear(e, 60);
    this.despawnExtras((e) => !busy(e));
    for (const e of this.enemies) if (!busy(e)) e.reset();
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
    if (this.fieldBoss && !busy(this.fieldBoss)) {
      this.fieldBoss.onFightEnd?.();
      this.fieldBoss = null; // it went back to its post with the reset above
    }
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
  spawnPickup(item, x, z, onTake = null) {
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
      onTake?.();
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
    this.audio.play('return');
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

  // Is the roaming boss fight yours (you're near it), rather than one another player is having?
  _nearFieldBoss() {
    const b = this.fieldBoss, p = this.player.pos;
    return !!b && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 90;
  }

  // The player an enemy goes after: you, or in multiplayer whoever is nearest (net/Coop.js).
  // Spirit allies (see summonAllies) fight whoever is near you; enemies go for whichever of you, the
  // other players and your allies is nearest.
  targetFor(e) {
    if (e.ally) return this._allyTarget(e);
    const t = this.net ? this.net.coop.targetFor(e) : this.player;
    if (!this.allies.size) return t;
    let best = t, bd = t.alive ? Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z) : Infinity;
    for (const a of this.allies) {
      if (!a.alive) continue;
      const d = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z);
      if (d < bd - 2) { best = a; bd = d; }
    }
    return best;
  }

  // An ally's target: the nearest foe that's awake and near you (or near it), else nobody (a
  // stand-in at your side that isn't "alive", so it walks back to you).
  _allyTarget(a) {
    const p = this.player.pos;
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.ally || e.team !== 'enemy' || e.invuln && e.state === 'idle') continue;
      const dp = Math.hypot(e.pos.x - p.x, e.pos.z - p.z), da = Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z);
      if (dp > 20 && da > 10) continue;
      if (e.state === 'idle' && dp > 9 && da > 6) continue; // let sleeping things lie, unless you're on top of them
      if (da < bd) { best = e; bd = da; }
    }
    return best ?? (this.allyLeader ??= { pos: this.player.pos, vel: this.player.vel, alive: false, yaw: 0, team: 'player', radius: 0.4 });
  }

  // Calls `n` spectral allies of `kind` around you for `life` seconds (rites; data/abilities.js).
  // Any you already have fade first.
  summonAllies(kind, n, life) {
    this.dismissAllies();
    const p = this.player;
    for (let i = 0; i < n; i++) {
      const a = p.yaw + Math.PI + (i - (n - 1) / 2) * 0.9;
      const x = p.pos.x + Math.sin(a) * 2.5, z = p.pos.z + Math.cos(a) * 2.5;
      const e = this.summonEnemy(kind, x, z, p.yaw, {});
      e.ally = true;
      e.team = 'player';
      e.lockable = false;
      e.ash = 0;
      e.allyT = life;
      e.allyOff = { a: (i - (n - 1) / 2) * 1.2 + Math.PI, d: 2.5 };
      e.leash = 24;
      e.returnSpeed = 7;
      spectral(e.model.root);
      this.allies.add(e);
      this.particles.emit({ x, y: e.pos.y + 1, z, count: 30, speed: 2.5, up: 2, color: 0xbfe0ff, color2: 0xffffff, life: [0.5, 1.1], size: [0.1, 0.22], jitter: 0.6 });
    }
    this.audio.play('blink');
  }

  dismissAllies() {
    for (const a of this.allies) this.particles.emit({ x: a.pos.x, y: a.pos.y + 1, z: a.pos.z, count: 24, speed: 2, up: 2, color: 0xbfe0ff, color2: 0xffffff, life: [0.4, 0.9], size: [0.1, 0.2], jitter: 0.6 });
    const gone = this.allies;
    this.allies = new Set();
    this.despawnExtras((e) => gone.has(e));
  }

  // Allies keep their "post" at your side, and fade when their time is up or a while after they fall.
  _updateAllies(dt) {
    if (!this.allies.size) return;
    const p = this.player;
    for (const a of [...this.allies]) {
      a.spawn.x = p.pos.x + Math.sin(p.yaw + a.allyOff.a) * a.allyOff.d;
      a.spawn.z = p.pos.z + Math.cos(p.yaw + a.allyOff.a) * a.allyOff.d;
      a.spawn.yaw = p.yaw;
      a.allyT -= dt;
      // A foe near you: it goes for it straight away, whichever way it was facing.
      if (a.alive && (a.state === 'idle' || a.state === 'return')) {
        const t = this._allyTarget(a);
        if (t.alive && Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z) < 16) {
          a.state = 'alert';
          a.t = 0;
          continue;
        }
      }
      // Idle and left behind: it trots after you. Far behind (you rode off): it catches up at once.
      if (a.alive && a.state === 'idle' && Math.hypot(a.pos.x - a.spawn.x, a.pos.z - a.spawn.z) > 3.5) {
        a.state = 'return';
        a.t = 0;
      }
      if (a.alive && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) > 30) {
        a.pos.set(a.spawn.x, this.world.getHeight(a.spawn.x, a.spawn.z), a.spawn.z);
        this.particles.emit({ x: a.pos.x, y: a.pos.y + 1, z: a.pos.z, count: 16, speed: 2, up: 2, color: 0xbfe0ff, color2: 0xffffff, life: [0.4, 0.8], size: [0.1, 0.2], jitter: 0.5 });
      }
      if (a.allyT <= 0 || (!a.alive && a.t > 2.5) || !p.alive) {
        this.allies.delete(a);
        this.particles.emit({ x: a.pos.x, y: a.pos.y + 1, z: a.pos.z, count: 24, speed: 2, up: 2, color: 0xbfe0ff, color2: 0xffffff, life: [0.4, 0.9], size: [0.1, 0.2], jitter: 0.6 });
        this.despawnExtras((e) => e === a);
      }
    }
  }

  // The boss whose bar is showing: a roaming boss while it fights (Vharra, Saelith, the troll),
  // otherwise the Warden while his fight runs.
  get activeBoss() {
    return this.fieldBoss ?? (this.bossFight ? this.boss : null);
  }

  // Bosses outside the arena wake and end their own fights; each one describes itself:
  //   bossId (the quest event), flag (state.flags when beaten), intro (BossIntro options or null),
  //   music ('bell' | 'winter'), summonPack (its summons scatter when the fight ends),
  //   reward { gear, banner: [title, sub] }, enter() { x, z, yaw } for the test menu.
  startFoeFight(b, { cutscene = true } = {}) {
    if (this.fieldBoss || !b.alive) return;
    // Woken by another player far away (multiplayer): no cutscene here, and no bar unless you're near.
    const near = Math.hypot(b.pos.x - this.player.pos.x, b.pos.z - this.player.pos.z);
    if (near > 45) cutscene = false;
    if (near > 90) {
      b.awaken();
      this.fieldBoss = b;
      return;
    }
    this.fieldBoss = b;
    this.lockTarget = null;
    this.audio.setMusic(true, b.music ?? 'bell');
    if (this.horse.ridden) this.horse.dismount(true);
    if (!cutscene || !b.intro) {
      b.awaken();
      this.hud.setBoss(b.name);
      return;
    }
    b.awaken(BOSS_INTRO_LENGTH);
    this.cutscene = new BossIntro(this, () => {
      this.cutscene = null;
      b.introLen = Math.min(b.introLen, b.t + 0.6);
      this.hud.setBoss(b.name);
    }, { boss: b, name: b.name, ...b.intro });
  }

  // Ends a roaming boss's fight without a winner: it goes back to its post healed, its summons scatter.
  endFoeFight() {
    const b = this.fieldBoss;
    if (!b) return;
    this.fieldBoss = null;
    this.hud.setBoss(null);
    this.audio.setMusic(false);
    if (this.lockTarget === b) this.lockTarget = null;
    if (b.summonPack) this.despawnExtras((e) => e.pack === b.summonPack);
    b.onFightEnd?.();
    if (b.alive) b.reset();
  }

  onFoeBossDefeated(b) {
    if (this.fieldBoss === b) this.fieldBoss = null;
    this.lockTarget = null;
    this.audio.setMusic(false);
    this.hud.setBoss(null);
    b.onFightEnd?.();
    this.after(2.6, () => {
      const [title, sub] = b.reward?.banner ?? ['Enemy Felled', b.name];
      this.hud.banner(title, sub, 'victory', 6000);
      this.audio.play('victory');
      this.state.flags[b.flag] = true;
      this.events.emit('bossDefeated', b.bossId);
      if (b.reward?.gear) this.after(2.5, () => this.giveGear(b.reward.gear));
      b.onDefeated?.();
      this.weatherRegion = null; // the region's sky is worked out afresh (a beaten boss can change it)
      this.save();
    });
  }

  // Test menu: puts the player where the boss's fight starts and wakes it (reviving it if beaten).
  enterFoeFight(tag, { cutscene = true } = {}) {
    const b = this.enemies.find((e) => e.tag === tag);
    if (!b || !this.player.alive) return false;
    this.endFoeFight();
    this.state.flags[b.flag] = false;
    b.reset();
    const at = b.enter();
    this.teleport(at.x, at.z, at.yaw, { banner: false });
    this.startFoeFight(b, { cutscene });
    return true;
  }

  // ---------- outcomes ----------

  onEnemyKilled(e) {
    if (e.ally) return; // a spirit ally fading is not a kill
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
      this.after(6, () => { if (this.quests.status('winter') === 'inactive') this.quests.start('winter'); });
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
      case 'multiplayer': shut('multiplayer', 'pause', 'back'); break;
      case 'shop': shut('interact', 'pause', 'back'); break;
      case null:
        if (i.pressed('pause')) this.openModal('pause', true);
        else if (i.pressed('journal')) this.openModal('journal');
        else if (i.pressed('equipment')) this.openEquipment();
        else if (i.pressed('map')) this.openMenu('map');
        else if (i.pressed('testMenu')) this.openMenu('testmenu');
        else if (i.pressed('multiplayer')) this.openMenu('multiplayer');
        else if (i.pressed('chat')) this.panels.multiplayer.openChat();
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
    this.net.update(dt);
    this.particles.update(this.modal ? 0 : dt * this.timeScale);
    this.world.update(dt * this.timeScale, this.time);
    this.sky.update(this.camera.position, this.player.pos);
    this.hud.update(dt);
    this.post.render(this.scene, this.camera);
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
    this._updateAllies(dt);
    const c = this.camera.position;
    const coop = this.net.coop;
    for (const e of this.enemies) {
      if (e.netPuppet) coop.updatePuppet(e, dt); // another player's game runs it
      else if (!(coop.nearestDist(e) > THINK_DIST && e.state === 'idle')) e.update(dt);
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
    if (this.debugViews.free && !this.modal) {
      // Free camera (test menu): the world runs on, the player stands still, the camera flies.
      if (!this.cheats.freeze) {
        this._updateEnemies(dt);
        this.boss.update(dt);
      }
      this.effects.update(dt);
      this.projectiles.update(dt);
      this.debugViews.updateFreeCam(dt);
      this.debugViews.update(dt);
      return;
    }
    if (this.cutscene && !this.modal) {
      // Cutscene: the world keeps breathing (the boss rises, particles drift) but nobody acts.
      this.cutscene.boss.update(dt);
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
    this.debugViews.update(dt);
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
    if (c.flasks) p.flasks = p.flasksMax;
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
      const share = e === this.boss || e.isBoss ? 1 : 0.6;
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
      if (!this.activeBoss) this.hud.banner(ZONES[found].name, '', 'area');
      this.events.emit('zoneEntered', found);
    }
    if (found) {
      this.zone = found;
      this._discover(found);
    }
    this._regionWeather(p);
  }

  // Each region keeps its own sky: snow north of the ridge, falling cinders over the Wastes, sea mist
  // on the coast, spores in the Hollows. Crossing back into the Vale restores the Vale's weather
  // (a boss that brings its own weather sets weatherLock while it lasts).
  _regionWeather(p, instant = false) {
    const region = this.world.regionAt(p.x, p.z);
    this.audio.setRegion(region);
    if (region === this.weatherRegion || this.weatherLock) return;
    const was = this.weatherRegion;
    this.weatherRegion = region;
    const own = REGION_WEATHER[region];
    if (was && !REGION_WEATHER[was]) this.valeWeather = this.world.getWeather(); // leaving the Vale: remember its sky
    if (own) {
      // A region's boss beaten changes its sky: the snow stops once the Winter Lantern is out, the
      // storm breaks over the Stormspire, the spores settle in the Hollows, the sea mist lifts.
      const f = this.state.flags;
      const after = { rime: f.saelithDead && 'clear', storm: f.vaelorDead && 'clear', glow: f.sylvaraDead && 'mist', coast: f.morrowDead && 'clear', cinder: f.ashmawDead && 'ashfall', bell: f.bellDead && 'clear' };
      this.world.setWeather(after[region] || own, instant);
    } else if (was === null || REGION_WEATHER[was]) {
      this.world.setWeather(this.valeWeather ?? 'clear', instant);
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
    if (this.fieldBoss && !keepFight && this._nearFieldBoss()) this.endFoeFight();
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
    this._regionWeather(p.pos, true);
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

  // Test menu: light every lantern without the ceremony (quests still hear about it).
  kindleAll() {
    let n = 0;
    for (const s of this.world.shrines.values()) {
      if (s.lit) continue;
      s.lit = true;
      if (!this.state.shrinesLit.includes(s.id)) this.state.shrinesLit.push(s.id);
      this.events.emit('shrineKindled', s.id);
      n++;
    }
    this.save();
    return n;
  }

  // Inside the arena, facing Odran, and the fight begins (a fresh one if one was running).
  enterBossFight({ cutscene = true } = {}) {
    if (this.state.flags.wardenDead || !this.player.alive) return false;
    this.endBossFight();
    if (this.boss.state !== 'dormant') this.boss.reset();
    const f = this.world.fogGate;
    this.teleport(f.x, f.z - 5, Math.PI);
    this.startBossFight({ cutscene });
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
    if (this.fieldBoss && this._nearFieldBoss()) return 'Not in the middle of a fight like this.';
    if (!this.player.alive) return 'You cannot travel while fallen.';
    if (this.player.state === 'fog') return 'Not while passing through the mist.';
    this.teleport(s.x, s.z + 2.5, Math.PI, { banner: false });
    this.hud.banner(s.name, 'The lantern answers', 'kindle', 3000);
    this.audio.play('mist');
    return null;
  }

  // Multiplayer: travel to another player's side (the lanterns carry you to them). Same limits as fast
  // travel. Returns a reason it can't happen, or null.
  travelToFriend(key) {
    const gh = this.net?.ghosts.get(key);
    if (!gh?.target || !gh.model.root.visible) return 'They are not out in the world right now.';
    if (this.bossFight) return 'The mist holds you here until the fight is done.';
    if (this.fieldBoss && this._nearFieldBoss()) return 'Not in the middle of a fight like this.';
    if (!this.player.alive) return 'You cannot travel while fallen.';
    if (this.player.state === 'fog') return 'Not while passing through the mist.';
    if (this.player.mounted) this.horse.dismount(true);
    const at = gh.model.root.position, yaw = gh.model.root.rotation.y;
    // Just behind and beside them, wherever there is ground.
    let x = at.x - Math.sin(yaw) * 2.2 + Math.cos(yaw) * 1.2, z = at.z - Math.cos(yaw) * 2.2 - Math.sin(yaw) * 1.2;
    if (!this.world.inPlay(x, z, 1)) { x = at.x; z = at.z; }
    this.teleport(x, z, yaw, { banner: true });
    this.hud.banner(gh.name, 'You arrive at their side', 'kindle', 3000);
    this.audio.play('mist');
    return null;
  }

  // Spawns an enemy of `kind` a few metres in front of the player, facing them.
  spawnEnemy(kind, dist = 5) {
    const p = this.player;
    return this.summonEnemy(kind, p.pos.x + Math.sin(p.yaw) * dist, p.pos.z + Math.cos(p.yaw) * dist, p.yaw + Math.PI);
  }

  // A temporary enemy at (x, z): it lives until the next rest, death or despawnExtras().
  summonEnemy(kind, x, z, yaw = 0, extra = {}) {
    tmp.set(x, 0, z);
    this.world.resolve(tmp, 0.6);
    const e = createEnemy(this, { kind, x: tmp.x, z: tmp.z, yaw, ...extra });
    this.enemies.push(e);
    this.extras.add(e);
    this.audio.playAt('spawn', e.pos);
    this.particles.emit({ x: e.pos.x, y: e.pos.y + 0.8, z: e.pos.z, count: 22, speed: 2, up: 2, color: 0x6a6660, color2: 0xb0a898, life: [0.5, 1.1], size: [0.15, 0.32], jitter: 0.8 });
    return e;
  }

  // Removes temporary enemies (all of them, or those `which(e)` picks).
  despawnExtras(which = null) {
    if (!this.extras.size) return;
    const gone = which ? [...this.extras].filter(which) : [...this.extras];
    for (const e of gone) {
      this.scene.remove(e.model.root);
      this.combat.unregister(e);
      e.dispose?.();
      if (this.lockTarget === e) this.lockTarget = null;
      this.extras.delete(e);
      this.allies.delete(e);
    }
    const set = new Set(gone);
    this.enemies = this.enemies.filter((e) => !set.has(e));
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
    if (i.justDown.has('KeyK') && this.activeBoss) this.activeBoss.takeHit({ dmg: 9999, poise: 0, dirX: 0, dirZ: 1 });
    if (i.justDown.has('KeyL')) { this.state.ash += 5000; }
    if (i.justDown.has('KeyY')) { for (const id of ALL_GEAR) this.giveGear(id); }
  }
}

// Spirit allies look like ghosts: every material on the model swapped for a pale, glowing,
// see-through copy (copies, so the ordinary enemies sharing those materials are untouched).
function spectral(root) {
  const copies = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      if (!m || !m.isMeshStandardMaterial) return m;
      if (!copies.has(m)) {
        const c = m.clone();
        c.color.lerp(new THREE.Color(0xbfe0ff), 0.6);
        c.emissive.setHex(0x3a78c8);
        c.emissiveIntensity = 0.7;
        c.transparent = true;
        c.opacity = 0.62;
        copies.set(m, c);
      }
      return copies.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.castShadow = false;
  });
}
