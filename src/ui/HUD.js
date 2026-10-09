// DOM overlay: bars, compass, quest tracker, prompts, toasts, banners, boss bar, and every menu screen.
import * as THREE from '../lib/three.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS, SHIELDS, speedLabel } from '../data/weapons.js';
import { ARTS, RITES } from '../data/abilities.js';
import { levelOf, levelCost } from '../systems/Save.js';
import { wrapAngle } from '../core/math.js';
import { EnemyBars } from './EnemyBars.js';

export const CONTROLS = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look (arrow keys also work)'],
  ['Shift', 'Sprint, or gallop on Wisp'],
  ['Space', 'Roll · backstep (no direction) · horse jump'],
  ['Left click', 'Light attack, press again to chain · riposte a reeling foe'],
  ['Hold right click', 'Guard · raise it just as a blow lands to parry'],
  ['F', 'Heavy attack'],
  ['C', 'Weapon art (spends focus)'],
  ['V', 'Cast your rite (spends focus)'],
  ['Q / middle click', 'Lock on to an enemy'],
  ['R', 'Drink from your flask'],
  ['E', 'Talk, pick up, rest, pass the mist'],
  ['H', 'Call Wisp, or dismount'],
  ['J', 'Journal'],
  ['I', 'Equipment'],
  ['M', 'Map · fast travel between lit lanterns'],
  ['N', 'Multiplayer · Enter to chat'],
  ['Z X B T', 'Emotes: wave, bow, sit, cheer'],
  ['Esc / P', 'Pause'],
  ['`', 'Test menu'],
];

// Standard-mapping gamepad (see core/Gamepad.js). Shown instead of the keys while a pad is in use.
export const PAD_CONTROLS = [
  ['Left stick', 'Move (tilt to walk) · click L3 to sprint or gallop'],
  ['Right stick', 'Look · click R3 to lock on'],
  ['A', 'Roll · backstep · horse jump · next line'],
  ['B', 'Talk, pick up, rest · back out of menus'],
  ['RB', 'Light attack · riposte'],
  ['RT', 'Heavy attack'],
  ['Hold LB', 'Guard · tap as a blow lands to parry'],
  ['LT', 'Weapon art'],
  ['D-pad up', 'Cast your rite'],
  ['X', 'Drink from your flask'],
  ['Y', 'Call Wisp, or dismount'],
  ['D-pad down', 'Equipment'],
  ['D-pad right', 'Map'],
  ['Back', 'Journal'],
  ['Start', 'Pause'],
];

// Key glyphs that change with the device: [keyboard, gamepad].
const GLYPHS = { interact: ['E', 'B'], art: ['C', 'LT'], rite: ['V', 'D-pad ↑'], light: ['Left click', 'RB'], next: ['E', 'A'], close: [null, 'B'] };

// The title lists only what you play with; the test menu is mentioned in the pause menu and README.
const forTitle = (list) => list.filter(([k]) => k !== '`');
const controlsHTML = (list = CONTROLS) => list.map(([k, v]) => `<div class="ctl"><kbd>${k}</kbd><span>${v}</span></div>`).join('');

const TEMPLATE = `
<div class="vitals">
  <div class="bar hp"><div class="lag"></div><div class="fill"></div></div>
  <div class="bar fo"><div class="fill"></div></div>
  <div class="bar st"><div class="fill"></div></div>
  <div class="bar fr" hidden title="Frostbite"><div class="fill"></div></div>
  <div class="perf" hidden aria-hidden="true"></div>
</div>
<div class="gear" aria-label="Equipped gear">
  <div class="gear-hands">
    <div class="gear-hand"><span class="gear-k">Right</span><b class="gear-r"></b></div>
    <div class="gear-hand"><span class="gear-k">Left</span><b class="gear-l"></b></div>
  </div>
  <div class="gear-ab art"><kbd data-glyph="art">C</kbd><span class="gear-ab-name"></span><span class="gear-ab-cost"></span><i class="gear-cd"></i></div>
  <div class="gear-ab rite"><kbd data-glyph="rite">V</kbd><span class="gear-ab-name"></span><span class="gear-ab-cost"></span><i class="gear-cd"></i></div>
</div>
<div class="compass" aria-hidden="true"><div class="compass-track"></div><div class="compass-needle"></div></div>
<aside class="tracker" aria-label="Current objectives"></aside>
<div class="purse">
  <div class="flask" title="Sunmoss flask"><span class="flask-glyph"></span><span class="flask-n">4</span></div>
  <div class="ash"><span class="ash-label">Ash</span><span class="ash-n">0</span></div>
</div>
<div class="toasts" role="status" aria-live="polite"></div>
<div class="prompt" hidden></div>
<div class="lock" hidden></div>
<div class="riposte-hint" hidden><kbd data-glyph="light">Left click</kbd> Riposte</div>
<div class="hint" hidden>Click to take control of the camera</div>
<div class="banner" hidden><div class="banner-text"></div><div class="banner-sub"></div></div>
<section class="bossbar" hidden>
  <div class="boss-head"><span class="boss-name"></span><span class="boss-dmg"></span></div>
  <div class="boss-track"><div class="boss-lag"></div><div class="boss-fill"></div></div>
</section>
<section class="dialogue" hidden>
  <div class="dlg-name"></div>
  <p class="dlg-text"></p>
  <div class="dlg-next"><kbd data-glyph="next">E</kbd> Continue</div>
</section>

<section class="screen title-screen">
  <div class="title-card">
    <p class="eyebrow">A soulslike in the browser</p>
    <h1>Ashen Vale</h1>
    <p class="tagline">The bell at the Shattered Gate has rung for forty years. Walk north and silence it.</p>
    <div class="menu">
      <button class="btn primary" id="btn-new">Begin a new journey</button>
      <button class="btn" id="btn-continue" hidden>Continue</button>
    </div>
    <p class="device-note">Ashen Vale needs a keyboard and mouse, or a gamepad.</p>
  </div>
  <div class="title-controls"><h2>Controls <span class="ctl-device">· Keyboard and mouse</span></h2><div class="ctl-grid">${controlsHTML(forTitle(CONTROLS))}</div></div>
</section>

<section class="screen pause-screen" hidden>
  <div class="panel">
    <h2>Paused</h2>
    <div class="menu">
      <button class="btn primary" id="btn-resume">Resume</button>
      <button class="btn" id="btn-equipment">Equipment</button>
      <button class="btn" id="btn-map">Map</button>
      <button class="btn" id="btn-multiplayer">Multiplayer</button>
      <button class="btn" id="btn-quality"></button>
      <button class="btn" id="btn-sound"></button>
      <button class="btn" id="btn-testmenu">Test menu</button>
      <button class="btn danger" id="btn-quit">Quit to title</button>
    </div>
    <div class="ctl-grid">${controlsHTML()}</div>
  </div>
</section>

<section class="screen journal-screen" hidden>
  <div class="panel wide">
    <div class="panel-head"><h2>Journal</h2><span class="close-hint"><kbd data-glyph="close" data-key="J">J</kbd> Close</span></div>
    <div class="journal-body"></div>
  </div>
</section>

<section class="screen equipment-screen" hidden>
  <div class="panel wide equip-panel">
    <div class="panel-head"><h2>Equipment</h2><span class="close-hint"><kbd data-glyph="close" data-key="I">I</kbd> Close</span></div>
    <div class="equip-body">
      <div class="equip-slots" role="tablist" aria-label="Slots"></div>
      <div class="equip-list" role="list"></div>
    </div>
    <div class="equip-foot"></div>
  </div>
</section>

<section class="screen shrine-screen" hidden>
  <div class="panel wide shrine-panel">
    <div class="shrine-left">
      <p class="eyebrow">Lantern shrine</p>
      <h2 class="shrine-name"></h2>
      <p class="shrine-note">You rest by the lantern. Your wounds close, your flask is full, and the hollows of the Vale rise again.</p>
      <button class="btn" id="btn-leave">Leave the lantern</button>
    </div>
    <div class="shrine-right">
      <div class="level-head"><span>Level <b class="lv"></b></span><span>Ash <b class="lv-ash"></b></span><span>Next level <b class="lv-cost"></b></span></div>
      <div class="stats"></div>
    </div>
  </div>
</section>
`;

const STATS = [
  ['vigor', 'Vigor', 'Health'],
  ['endurance', 'Endurance', 'Stamina'],
  ['strength', 'Strength', 'Damage'],
  ['mind', 'Mind', 'Focus and rites'],
];

// Equipment screen slots: which gear each lists, and what an empty slot means.
const SLOTS = [
  ['right', 'Right hand', 'weapon'],
  ['left', 'Left hand', 'shield'],
  ['rite', 'Rite', 'rite'],
];
const pct = (f) => `${Math.round(f * 100)}%`;

const CARDINALS = [['N', 0], ['NE', Math.PI / 4], ['E', Math.PI / 2], ['SE', (3 * Math.PI) / 4], ['S', Math.PI], ['SW', (-3 * Math.PI) / 4], ['W', -Math.PI / 2], ['NW', -Math.PI / 4]];

const tmp = new THREE.Vector3();

export class HUD {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    root.innerHTML = TEMPLATE;
    const $ = (s) => root.querySelector(s);
    this.$ = $;
    this.el = {
      hpBar: $('.bar.hp'), hpFill: $('.bar.hp .fill'), hpLag: $('.bar.hp .lag'),
      stBar: $('.bar.st'), stFill: $('.bar.st .fill'), frBar: $('.bar.fr'), frFill: $('.bar.fr .fill'), foBar: $('.bar.fo'), foFill: $('.bar.fo .fill'),
      flaskN: $('.flask-n'), flask: $('.flask'), ashN: $('.ash-n'),
      tracker: $('.tracker'), compass: $('.compass-track'), toasts: $('.toasts'), prompt: $('.prompt'),
      lock: $('.lock'), riposte: $('.riposte-hint'), hint: $('.hint'), banner: $('.banner'), bannerText: $('.banner-text'), bannerSub: $('.banner-sub'),
      boss: $('.bossbar'), bossName: $('.boss-name'), bossFill: $('.boss-fill'), bossLag: $('.boss-lag'), bossDmg: $('.boss-dmg'),
      dlg: $('.dialogue'), dlgName: $('.dlg-name'), dlgText: $('.dlg-text'), perf: $('.perf'),
      title: $('.title-screen'), pause: $('.pause-screen'), journal: $('.journal-screen'), shrine: $('.shrine-screen'),
      equipment: $('.equipment-screen'), eqSlots: $('.equip-slots'), eqList: $('.equip-list'), eqFoot: $('.equip-foot'),
      vitals: $('.vitals'),
      gearR: $('.gear-r'), gearL: $('.gear-l'),
      art: this._abilityEls($('.gear-ab.art')), rite: this._abilityEls($('.gear-ab.rite')),
    };
    this.eqSlot = 'right'; // which slot the equipment screen is listing
    this.gearKey = '';
    this.hpLag = 1;
    this.lagHold = 0;
    this.lastHp = 1;
    this.bossLagV = 1;
    this.ashShown = 0;
    this.trackerKey = '';
    this.trackerT = 0;
    this.fpsT = 0;
    this.frames = 0;
    this.perf = false; // performance overlay (fps, draw calls, triangles, position); Game turns it on for #debug
    this.padMode = false;
    this.bannerTimer = null;

    this.cardinals = CARDINALS.map(([label, b]) => {
      const e = document.createElement('span');
      e.className = 'cardinal' + (label.length === 1 ? ' major' : '');
      e.textContent = label;
      this.el.compass.appendChild(e);
      return { e, b };
    });
    this.pins = [];

    $('#btn-new').addEventListener('click', () => game.newGame());
    $('#btn-continue').addEventListener('click', () => game.continueGame());
    $('#btn-resume').addEventListener('click', () => game.closeModal());
    $('#btn-equipment').addEventListener('click', () => game.openEquipment());
    $('#btn-map').addEventListener('click', () => game.openMenu('map'));
    $('#btn-testmenu').addEventListener('click', () => game.openMenu('testmenu'));
    $('#btn-multiplayer').addEventListener('click', () => game.openMenu('multiplayer'));
    // One delegated handler for the whole equipment screen: slot tabs and gear rows carry data attributes.
    $('.equip-panel').addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.slot) {
        this.eqSlot = b.dataset.slot;
        game.audio.play('ui');
      } else if (b.dataset.equip !== undefined) {
        game.equip(b.dataset.for, b.dataset.equip || null);
      }
      this.renderEquipment();
    });    $('#btn-leave').addEventListener('click', () => game.closeModal());
    $('#btn-quality').addEventListener('click', () => { game.setQuality(game.quality === 'high' ? 'low' : 'high'); this.refreshPause(); });
    $('#btn-sound').addEventListener('click', () => { game.setMuted(!game.audio.muted); this.refreshPause(); });
    const quit = $('#btn-quit');
    quit.addEventListener('click', () => {
      if (quit.dataset.armed) game.quitToTitle();
      else {
        quit.dataset.armed = '1';
        quit.textContent = 'Click again to quit (progress is saved at shrines)';
        setTimeout(() => { delete quit.dataset.armed; quit.textContent = 'Quit to title'; }, 3000);
      }
    });
  }

  // ---------- screens ----------

  showTitle(hasSave) {
    this.el.title.hidden = false;
    this.$('#btn-continue').hidden = !hasSave;
    this.root.classList.add('at-title');
  }

  hideTitle() {
    this.el.title.hidden = true;
    this.root.classList.remove('at-title');
  }

  showScreen(name, on) {
    this.el[name].hidden = !on;
    if (on && name === 'pause') this.refreshPause();
    if (on && name === 'journal') this.renderJournal();
    if (on && name === 'equipment') this.renderEquipment();
  }

  // Gamepad in use: key glyphs and control lists switch to the pad's buttons, and focused menu
  // buttons get a visible ring (there's no mouse hover to show where you are).
  setPadMode(on) {
    this.padMode = on;
    this.root.classList.toggle('pad', on);
    for (const k of this.root.querySelectorAll('kbd[data-glyph]')) {
      const [key, pad] = GLYPHS[k.dataset.glyph];
      k.textContent = on ? pad : key ?? k.dataset.key;
    }
    const list = on ? PAD_CONTROLS : CONTROLS;
    for (const grid of this.root.querySelectorAll('.ctl-grid')) grid.innerHTML = controlsHTML(grid.closest('.title-screen') ? forTitle(list) : list);
    const dev = this.$('.ctl-device');
    if (dev) dev.textContent = on ? '· Gamepad' : '· Keyboard and mouse';
    this.promptText = undefined; // re-render the E/B prompt
  }

  // Hides the in-world HUD (bars, compass, widgets, toasts) for clean screenshots; menus still show.
  setVisible(on) {
    this.root.classList.toggle('hud-off', !on);
  }

  get visible() {
    return !this.root.classList.contains('hud-off');
  }

  refreshPause() {
    const g = this.game;
    this.$('#btn-quality').textContent = `Graphics: ${g.quality === 'high' ? 'High (shadows on)' : 'Low (faster)'}`;
    this.$('#btn-sound').textContent = `Sound: ${g.audio.muted ? 'Off' : 'On'}`;
  }

  renderJournal() {
    const g = this.game;
    const entries = g.quests.journal();
    const items = Object.entries(g.state.inventory).filter(([, n]) => n > 0);
    const quest = (q) => `
      <article class="jq ${q.status}${q.main ? ' main' : ''}">
        <header><h3>${q.title}</h3><span class="jq-status">${q.status === 'done' ? 'Complete' : q.main ? 'Main quest' : 'Active'}</span></header>
        <p class="jq-giver">From ${q.giver}</p>
        <p class="jq-summary">${q.summary}</p>
        <p class="jq-obj">${q.status === 'done' ? q.doneText ?? '' : q.objective}</p>
      </article>`;
    this.$('.journal-body').innerHTML = `
      <div class="jcol">${entries.length ? entries.map(quest).join('') : '<p class="empty">No quests yet. Talk to the people of the Vale, and read the notice by the first shrine.</p>'}</div>
      <div class="jcol items"><h3>Key items</h3>${items.length ? items.map(([id]) => `<div class="item"><b>${ITEMS[id]?.name ?? id}</b><p>${ITEMS[id]?.desc ?? ''}</p></div>`).join('') : '<p class="empty">Nothing yet.</p>'}</div>`;
  }

  // Equipment: the three slots on the left, everything owned for the chosen slot on the right.
  // Rows are buttons; clicking one equips it at once (Game.equip swaps the model and moveset).
  renderEquipment() {
    this._keepFocus(this.el.equipment, () => this._renderEquipment());
  }

  // Re-rendering replaces buttons; put the focus (gamepad navigation) back on the same one.
  _keepFocus(root, render) {
    const f = root.contains(document.activeElement) ? document.activeElement : null;
    const keys = f ? Object.entries(f.dataset) : [];
    render();
    if (!keys.length) return;
    const sel = 'button' + keys.map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${CSS.escape(v)}"]`).join('');
    root.querySelector(sel)?.focus({ preventScroll: true });
  }

  _renderEquipment() {
    const g = this.game;
    const gear = g.state.gear;
    const p = g.player;
    const twoHanded = WEAPONS[gear.right].hands > 1;
    const nameOf = (slot) => {
      if (slot === 'right') return WEAPONS[gear.right].name;
      if (slot === 'left') return twoHanded ? 'Both hands on the weapon' : gear.left ? SHIELDS[gear.left].name : 'Nothing';
      return gear.rite ? RITES[gear.rite].name : 'None prepared';
    };
    this.el.eqSlots.innerHTML = SLOTS.map(([slot, label]) => `
      <button class="eq-slot${slot === this.eqSlot ? ' on' : ''}" data-slot="${slot}" role="tab" aria-selected="${slot === this.eqSlot}">
        <span class="eq-slot-k">${label}</span><b>${nameOf(slot)}</b>
      </button>`).join('');

    const [slot, , kind] = SLOTS.find(([s]) => s === this.eqSlot);
    const table = kind === 'weapon' ? WEAPONS : kind === 'shield' ? SHIELDS : RITES;
    const owned = gear.owned.filter((id) => table[id]);
    const current = gear[slot];
    const str = g.state.stats.strength;
    const row = (id, title, sub, stats, desc, disabledWhy = '') => `
      <button class="eq-item${id === (current ?? '') ? ' on' : ''}" data-for="${slot}" data-equip="${id}" role="listitem" ${disabledWhy ? 'disabled' : ''}>
        <span class="eq-item-head"><b>${title}</b><span>${id === (current ?? '') ? 'Equipped' : disabledWhy || sub}</span></span>
        ${stats ? `<span class="eq-stats">${stats.map(([k, v]) => `<span><i>${k}</i>${v}</span>`).join('')}</span>` : ''}
        ${desc ? `<span class="eq-desc">${desc}</span>` : ''}
      </button>`;
    let rows = '';
    if (kind === 'weapon') {
      rows = owned.map((id) => {
        const w = WEAPONS[id], art = ARTS[w.art];
        const m = 1 + (str - 10) * 0.05 * w.scale;
        return row(id, w.name, `${w.type} · ${w.hands > 1 ? 'two hands' : 'one hand'}`, [
          ['Damage', `${Math.round(w.moves.light1.dmg * m)} / ${Math.round(w.moves.heavy.dmg * m)}`],
          ['Speed', speedLabel(w)],
          ['Reach', `${w.moves.light1.reach.toFixed(1)} m`],
          ['Guard', pct(w.guard.absorb)],
          ['Art', `${art.name} · ${art.focus} focus`],
        ], w.desc);
      }).join('');
    } else if (kind === 'shield') {
      const why = twoHanded ? 'Needs a one-handed weapon' : '';
      rows = row('', 'Nothing', 'Block with your weapon', [['Guard', pct(WEAPONS[gear.right].guard.absorb)], ['Parry', `${WEAPONS[gear.right].guard.parryWindow.toFixed(2)} s`]], '', '')
        + owned.map((id) => {
          const sh = SHIELDS[id], gs = sh.guard;
          return row(id, sh.name, sh.type, [
            ['Guard', pct(gs.absorb)],
            ['Stamina', `${gs.cost.toFixed(2)} per damage`],
            ['Parry', `${gs.parryWindow.toFixed(2)} s`],
            ['Guard walk', gs.speed ? 'Slow' : 'Normal'],
          ], sh.desc, why);
        }).join('');
    } else {
      rows = row('', 'None', 'No rite prepared', null, '')
        + owned.map((id) => {
          const r = RITES[id];
          return row(id, r.name, r.type, [['Focus', r.focus], ['Cooldown', `${r.cooldown} s`]], r.desc);
        }).join('');
    }
    if (!owned.length) rows += `<p class="empty">${kind === 'shield' ? 'You carry no shield yet.' : 'You know no rites yet. They are found in the Vale, and earned.'}</p>`;
    this.el.eqList.innerHTML = rows;
    this.el.eqFoot.innerHTML = `
      <span>Focus <b>${Math.floor(p.focus)} / ${p.maxFocus}</b></span>
      <span>Strength <b>${str}</b></span><span>Mind <b>${g.state.stats.mind}</b></span>
      <span class="equip-tip">Damage is light / heavy. Strength adds more to heavy weapons, Mind to rites.</span>`;
  }

  openShrine(shrine) {
    this.$('.shrine-name').textContent = shrine.name;
    this.refreshShrine();
    this.showScreen('shrine', true);
  }

  refreshShrine() {
    this._keepFocus(this.el.shrine, () => this._renderShrine());
  }

  _renderShrine() {
    const g = this.game;
    const s = g.state.stats;
    const lv = levelOf(s);
    const cost = levelCost(lv);
    this.$('.lv').textContent = lv;
    this.$('.lv-ash').textContent = g.state.ash;
    this.$('.lv-cost').textContent = cost;
    const box = this.$('.stats');
    box.innerHTML = STATS.map(([key, label, what]) => `
      <div class="stat">
        <div><b>${label}</b><span>${what}</span></div>
        <span class="stat-v">${s[key]}</span>
        <button class="btn small" data-stat="${key}" ${g.state.ash < cost ? 'disabled' : ''} aria-label="Raise ${label}">+1</button>
      </div>`).join('');
    box.querySelectorAll('button[data-stat]').forEach((b) => b.addEventListener('click', () => g.levelUp(b.dataset.stat)));
  }

  // ---------- dialogue ----------

  openDialogue(name, lines, onEnd) {
    this.dlg = { lines, i: 0, onEnd };
    this.el.dlg.hidden = false;
    this.el.dlgName.textContent = name;
    this.el.dlgText.textContent = lines[0];
  }

  advanceDialogue() {
    const d = this.dlg;
    if (!d) return;
    d.i++;
    if (d.i >= d.lines.length) {
      this.el.dlg.hidden = true;
      this.dlg = null;
      d.onEnd?.();
      return;
    }
    this.el.dlgText.textContent = d.lines[d.i];
    this.game.audio.play('ui');
  }

  // ---------- transient ----------

  setPrompt(text) {
    if (text === this.promptText) return;
    this.promptText = text;
    this.el.prompt.hidden = !text;
    if (text) this.el.prompt.innerHTML = `<kbd>${GLYPHS.interact[this.padMode ? 1 : 0]}</kbd> ${text}`;
  }

  toast(text, kind = '') {
    if (!text) return;
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = text;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 5000);
  }

  // kind: area | kindle | death | victory
  banner(text, sub = '', kind = 'area', ms = 3600) {
    const b = this.el.banner;
    clearTimeout(this.bannerTimer);
    b.hidden = false;
    b.className = 'banner';
    void b.offsetWidth; // restart the CSS animation
    b.className = `banner ${kind}`;
    b.style.setProperty('--dur', `${ms}ms`);
    this.el.bannerText.textContent = text;
    this.el.bannerSub.textContent = sub;
    this.bannerTimer = setTimeout(() => { b.hidden = true; }, ms);
  }

  clearBanner() {
    clearTimeout(this.bannerTimer);
    this.el.banner.hidden = true;
  }

  // Cinematic bars for cutscenes; the rest of the HUD fades while they're up.
  setLetterbox(on) {
    if (!this.letterbox) {
      this.letterbox = document.createElement('div');
      this.letterbox.className = 'letterbox';
      this.letterbox.innerHTML = '<div class="lb-top"></div><div class="lb-bottom"></div>';
      this.root.appendChild(this.letterbox);
    }
    this.letterbox.classList.toggle('on', on);
    this.root.classList.toggle('cinematic', on);
  }

  setBoss(name) {
    this.el.boss.hidden = !name;
    if (name) {
      this.el.bossName.textContent = name;
      this.bossLagV = 1;
    }
  }

  // ---------- per frame ----------

  update(dt) {
    const g = this.game;
    if (g.mode !== 'playing') {
      this.enemyBars?.clear();
      return;
    }
    if (!this.enemyBars) this.enemyBars = new EnemyBars(this.root, g);
    this.enemyBars.update(dt);
    const p = g.player;
    const e = this.el;

    e.hpBar.style.width = `min(${p.maxHp * 2.3}px, 52vw)`;
    e.stBar.style.width = `min(${p.maxStamina * 2.3}px, 52vw)`;
    e.foBar.style.width = `min(${p.maxFocus * 2.3}px, 52vw)`;
    e.foFill.style.transform = `scaleX(${Math.max(0, p.focus / p.maxFocus)})`;
    const hpF = p.hp / p.maxHp;
    if (hpF < this.lastHp) this.lagHold = 0.7;
    this.lastHp = hpF;
    if ((this.lagHold -= dt) <= 0) this.hpLag = Math.max(hpF, this.hpLag - dt * 0.5);
    if (this.hpLag < hpF) this.hpLag = hpF;
    e.hpFill.style.transform = `scaleX(${hpF})`;
    e.hpLag.style.transform = `scaleX(${this.hpLag})`;
    e.stFill.style.transform = `scaleX(${Math.max(0, p.stamina / p.maxStamina)})`;
    // Frostbite: the buildup while it fills, then the time left frostbitten (glowing).
    const fr = p.frostbite > 0 ? p.frostbite / 6 : p.frost / 100;
    if (e.frBar.hidden !== !(fr > 0.005)) e.frBar.hidden = !(fr > 0.005);
    if (fr > 0.005) {
      e.frFill.style.transform = `scaleX(${Math.min(1, fr)})`;
      e.frBar.classList.toggle('bitten', p.frostbite > 0);
    }
    e.stBar.classList.toggle('winded', !!p.winded);
    e.stBar.classList.toggle('guarding', p.state === 'guard');
    e.flaskN.textContent = p.flasks;
    e.flask.classList.toggle('empty', p.flasks === 0);

    const ash = g.state.ash;
    if (this.ashShown !== ash) {
      const diff = ash - this.ashShown;
      this.ashShown = Math.abs(diff) < 2 ? ash : Math.round(this.ashShown + diff * Math.min(1, dt * 8));
      e.ashN.textContent = this.ashShown;
    }

    if ((this.trackerT -= dt) <= 0) {
      this.trackerT = 0.25;
      const list = g.quests.tracked();
      const key = JSON.stringify(list);
      if (key !== this.trackerKey) {
        this.trackerKey = key;
        e.tracker.innerHTML = list.map((q) => `<div class="tq${q.main ? ' main' : ''}"><b>${q.title}</b><span>${q.text}</span></div>`).join('');
      }
    }

    this._gear();
    this._compass();
    this._boss(dt);
    this._lock();

    const wantsHint = !g.input.locked && !g.input.lockFailed && !g.input.usingPad && (!g.modal || g.modal === 'dialogue' || g.modal === 'journal');
    if (e.hint.hidden === wantsHint) e.hint.hidden = !wantsHint;
    if (g.input.lockFailed && !this.lockNoted) {
      this.lockNoted = true;
      this.toast('Mouse capture is not available here. Turn the camera with the arrow keys.');
    }

    this._perf(dt);
  }

  // Performance overlay, under the bars so it never covers them. Updates twice a second; the
  // renderer's counters describe the last rendered frame.
  _perf(dt) {
    const e = this.el.perf;
    if (!this.perf) {
      if (!e.hidden) e.hidden = true;
      return;
    }
    this.frames++;
    if ((this.fpsT += dt) < 0.5 && !e.hidden) return;
    const g = this.game, p = g.player.pos, r = g.renderer.info.render;
    const fps = this.fpsT > 0 ? Math.round(this.frames / this.fpsT) : 0;
    e.hidden = false;
    e.textContent = `${fps} fps · ${r.calls} calls · ${(r.triangles / 1000).toFixed(0)}k tris\n`
      + `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}${g.zone ? ' · ' + g.zone : ''}${g.timeScale !== 1 ? ` · ${g.timeScale}x` : ''}`;
    this.frames = 0;
    this.fpsT = 0;
  }

  _abilityEls(root) {
    return { root, name: root.querySelector('.gear-ab-name'), cost: root.querySelector('.gear-ab-cost'), cd: root.querySelector('.gear-cd'), state: '' };
  }

  // Low focus: the focus bar blinks once (an art or rite was refused).
  flashFocus() {
    const b = this.el.foBar;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  // Bottom-left gear widget. Names only change on equip; the art and rite rows track ready, cooling
  // (a draining sweep) and short on focus. DOM writes happen only when something visible changes.
  _gear() {
    const p = this.game.player;
    const key = `${p.weaponId}|${p.shieldId}|${p.riteId}`;
    if (key !== this.gearKey) {
      this.gearKey = key;
      this.el.gearR.textContent = p.weapon.name;
      this.el.gearL.textContent = p.weapon.hands > 1 ? 'Both hands' : p.shield ? p.shield.name : 'Nothing';
      const set = (ab, def) => {
        ab.name.textContent = def ? def.name : 'No rite';
        ab.cost.textContent = def ? `${def.focus}` : '';
        ab.cost.title = def ? `${def.focus} focus` : '';
      };
      set(this.el.art, p.art);
      set(this.el.rite, p.rite);
    }
    const show = (ab, def, cd) => {
      const state = !def ? 'none' : cd > 0 ? 'cool' : p.focus < def.focus ? 'low' : 'ready';
      if (state !== ab.state) {
        ab.state = state;
        ab.root.dataset.state = state;
      }
      const f = state === 'cool' ? Math.round((cd / def.cooldown) * 40) / 40 : 0;
      if (f !== ab.f) {
        ab.f = f;
        ab.cd.style.transform = `scaleX(${f})`;
      }
    };
    show(this.el.art, p.art, p.artCd);
    show(this.el.rite, p.rite, p.riteCd);
  }

  _compass() {
    const g = this.game;
    const heading = -g.cam.yaw;
    const place = (e, bearing) => {
      const rel = wrapAngle(bearing - heading);
      const vis = Math.abs(rel) < Math.PI / 2;
      e.style.opacity = vis ? String(1 - Math.abs(rel) / (Math.PI / 2) * 0.6) : '0';
      e.style.left = `${50 + (rel / (Math.PI / 2)) * 50}%`;
    };
    for (const c of this.cardinals) place(c.e, c.b);
    const p = g.player.pos;
    const marks = g.quests.markers();
    for (const s of g.world.shrines.values()) if (s.lit) marks.push({ x: s.x, z: s.z, shrine: true, label: s.name });
    while (this.pins.length < marks.length) {
      const e = document.createElement('span');
      this.el.compass.appendChild(e);
      this.pins.push(e);
    }
    this.pins.forEach((e, i) => {
      const m = marks[i];
      if (!m) { e.style.opacity = '0'; return; }
      e.className = 'pin' + (m.main ? ' main' : '') + (m.shrine ? ' shrine' : '');
      e.title = m.label;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      e.dataset.dist = d < 15 ? '' : `${Math.round(d)}m`;
      place(e, Math.atan2(m.x - p.x, -(m.z - p.z)));
    });
  }

  _boss(dt) {
    const b = this.game.activeBoss ?? this.game.boss;
    if (this.el.boss.hidden) return;
    const f = Math.max(0, b.hp / b.maxHp);
    this.bossLagV = Math.max(f, this.bossLagV - dt * (b.recentT > 0 ? 0 : 0.35));
    this.el.bossFill.style.transform = `scaleX(${f})`;
    this.el.bossLag.style.transform = `scaleX(${this.bossLagV})`;
    this.el.bossDmg.textContent = b.recentT > 0 ? Math.round(b.recentDmg) : '';
    this.el.boss.classList.toggle('phase2', b.phase === 2);
  }

  // Lock reticle (red while the locked foe is reeling and open to a riposte) and the riposte hint.
  _lock() {
    const g = this.game;
    const t = g.lockTarget;
    const foe = g.player.riposteCandidate;
    this._pin(this.el.lock, t, 0);
    if (t) this.el.lock.classList.toggle('open', t.isOpen());
    this._pin(this.el.riposte, foe, -0.9);
  }

  // Shows `el` over an actor's lock point (lowered by `dy` metres), or hides it.
  _pin(el, actor, dy) {
    if (!actor) {
      if (!el.hidden) el.hidden = true;
      return;
    }
    actor.lockPoint(tmp);
    tmp.y += dy;
    tmp.project(this.game.camera);
    const vis = tmp.z < 1;
    if (el.hidden === vis) el.hidden = !vis;
    if (vis) el.style.transform = `translate(${((tmp.x + 1) / 2) * innerWidth}px, ${((1 - tmp.y) / 2) * innerHeight}px)`;
  }
}
