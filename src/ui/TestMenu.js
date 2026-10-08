// Test menu (` or Pause > Test menu): teleports, cheats, gear, enemies, the boss, quests and the
// environment, for trying things out quickly. Lists come from the data modules each time it opens,
// so new zones, gear, items and enemy kinds show up without touching this file.
import { ZONES } from '../data/world.js';
import { WEAPONS, SHIELDS } from '../data/weapons.js';
import { RITES } from '../data/abilities.js';
import { ITEMS } from '../data/items.js';
import { ALL_GEAR } from '../data/loot.js';
import { enemyKinds } from '../entities/spawn.js';

const SCALES = [0.25, 0.5, 1, 2];
const NEARBY = 30; // metres, for "kill all nearby"

// The #debug number-key shortcuts (Game._debugKeys), listed at the bottom.
const DEBUG_KEYS = [
  ['1 – 6', 'First Light, the camp, the ruins, the lake, the moor, the Gatehouse'],
  ['7', 'The mist gate'],
  ['G', 'God mode'],
  ['U', 'Unlock Wisp'],
  ['L', '+5,000 ash'],
  ['K', 'Kill the Warden (during the fight)'],
  ['Y', 'Every weapon, shield and rite'],
];

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const title = (id) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const clock = (h) => {
  const m = Math.round(h * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export class TestMenu {
  constructor(hudRoot, game) {
    this.game = game;
    this.note = '';
    const el = document.createElement('section');
    el.className = 'screen test-screen';
    el.hidden = true;
    el.innerHTML = `
      <div class="panel wide test-panel" role="dialog" aria-label="Test menu">
        <div class="panel-head">
          <h2>Test menu</h2>
          <span class="close-hint"><kbd data-glyph="close" data-key="\`">\`</kbd> Close</span>
        </div>
        <p class="test-status" aria-live="polite"></p>
        <div class="test-body"></div>
      </div>`;
    hudRoot.appendChild(el);
    this.root = el;
    this.body = el.querySelector('.test-body');
    this.status = el.querySelector('.test-status');
    // One delegated handler: every button carries data-act (and data-arg).
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-act]');
      if (!b || b.disabled) return;
      game.audio.play('ui');
      this.run(b.dataset.act, b.dataset.arg ?? '');
    });
    el.addEventListener('input', (ev) => {
      if (!ev.target.matches('.test-tod')) return;
      const h = Number(ev.target.value);
      game.sky.setTimeOfDay(h);
      el.querySelector('.test-tod-v').textContent = clock(h);
    });
  }

  show() {
    this.note = '';
    this.render();
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  // ---------- actions ----------

  run(act, arg) {
    const g = this.game, p = g.player, st = g.state;
    let note = '';
    let close = false; // travel actions close the menu so you land in the world
    switch (act) {
      // travel
      case 'zone': {
        const z = ZONES[arg];
        // A zone that holds the sealed arena puts you at the mist instead of inside with a sleeping Warden.
        if (g.world.inArena(z.x, z.z) && !st.flags.wardenDead) return this.run('mist', '');
        close = g.teleport(z.x, z.z + Math.min(5, z.r * 0.4), Math.PI);
        break;
      }
      case 'mist': {
        const f = g.world.fogGate;
        close = g.teleport(f.x, f.z + 3.5, Math.PI); // just inside the Shattered Gate's zone, so its banner shows
        break;
      }
      case 'bossStart':
        close = g.enterBossFight();
        break;
      case 'revive':
        g.reviveWarden();
        note = 'The Warden kneels in the arena again. The mist is sealed and the north gate shut.';
        break;

      // player
      case 'god': p.god = !p.god; break;
      case 'stamina': g.cheats.stamina = !g.cheats.stamina; break;
      case 'focus': g.cheats.focus = !g.cheats.focus; break;
      case 'restore':
        if (!p.alive) { note = 'You have fallen. Wait to rise at the lantern.'; break; }
        p.hp = p.maxHp;
        p.stamina = p.maxStamina;
        p.focus = p.maxFocus;
        p.flasks = p.flasksMax;
        p.winded = false;
        note = 'Health, stamina, focus and flasks restored.';
        break;
      case 'ash':
        g.addAsh(5000);
        note = `Ash: ${st.ash}.`;
        break;
      case 'stats':
        for (const k of Object.keys(st.stats)) st.stats[k] += 5;
        p.applyStats(st.stats, st.flasksMax);
        if (p.alive) {
          p.hp = p.maxHp;
          p.stamina = p.maxStamina;
          p.focus = p.maxFocus;
        }
        g.save();
        note = `Stats: ${Object.entries(st.stats).map(([k, v]) => `${title(k)} ${v}`).join(', ')}.`;
        break;
      case 'fall':
        if (!p.alive) break;
        if (g.horse.ridden) g.horse.dismount(true);
        g.closeModal();
        p.hp = 0;
        p.die();
        return;

      // gear and items
      case 'horse': {
        st.flags.horse = true;
        g.save();
        if (g.horse.ridden) { note = 'You are already riding Wisp.'; break; }
        const why = g.horse.blockedReason();
        if (why === null) {
          g.closeModal();
          g.horse.summon();
          return;
        }
        note = `Wisp is yours. ${why || 'Call her with H when you are standing.'}`;
        break;
      }
      case 'gearAll':
        for (const id of ALL_GEAR) {
          g.giveGear(id);
          g.removePickupsOf(id);
        }
        note = 'Every weapon, shield and rite is yours. Equip them with I.';
        break;
      case 'gear':
        g.giveGear(arg);
        g.removePickupsOf(arg);
        break;
      case 'item':
        g.giveItem(arg);
        g.removePickupsOf(arg);
        break;

      // enemies
      case 'kill':
        note = `Felled ${g.killNearby(NEARBY)} within ${NEARBY} m.`;
        break;
      case 'respawn':
        g.respawnEnemies();
        note = 'Every enemy is back at its post; spawned extras are gone.';
        break;
      case 'freeze': g.cheats.freeze = !g.cheats.freeze; break;
      case 'spawn': {
        const e = g.spawnEnemy(arg);
        note = `${e.name ?? title(arg)} spawned 5 m ahead (${g.extras.size} spawned in all).`;
        break;
      }

      // boss
      case 'phase2': {
        const b = g.boss;
        if (st.flags.wardenDead) { note = 'The Warden is silenced. Revive him first.'; break; }
        if (!g.bossFight) g.enterBossFight();
        if (b.phase === 2) { note = 'Already in his second phase.'; break; }
        b.hp = Math.min(b.hp, b.maxHp * 0.5 - 1); // he turns as soon as he's fighting
        close = true;
        break;
      }
      case 'stagger': {
        const b = g.boss;
        if (!g.bossFight || !['engage', 'attack', 'recoil'].includes(b.state)) { note = 'He has to be up and fighting first.'; break; }
        b._stagger();
        close = true;
        break;
      }
      case 'bossKill': {
        const b = g.boss;
        if (st.flags.wardenDead || !b.alive) { note = 'The Warden is already silenced.'; break; }
        if (!g.bossFight) g.enterBossFight();
        b.invuln = false;
        b.takeHit({ dmg: 1e7, poise: 0, dirX: 0, dirZ: -1 });
        close = true;
        break;
      }
      case 'bossReset':
        if (st.flags.wardenDead) return this.run('revive', '');
        g.endBossFight();
        g.boss.reset();
        if (g.world.inArena(p.pos.x, p.pos.z, 2)) this.run('mist', '');
        note = 'The Warden kneels again; the fight is reset.';
        break;

      // quests
      case 'questAdvance': {
        const q = g.quests, id = this._mainQuest();
        const s = q.state[id].status;
        if (s === 'inactive') q.start(id);
        else if (s === 'active') q.advance(id);
        note = s === 'done' ? 'The main quest is already complete.' : q.objectiveText(id) || 'Main quest complete.';
        break;
      }
      case 'questAll':
        for (const id of Object.keys(g.quests.defs)) {
          if (g.quests.status(id) === 'inactive') g.quests.start(id, true);
          g.quests.complete(id);
        }
        note = 'Every quest is complete, rewards and all.';
        break;
      case 'questReset':
        g.quests.load(null);
        g.quests.start(this._mainQuest(), true);
        g.save();
        note = 'Quests reset. The main quest is active again.';
        break;

      // world
      case 'cycle': g.sky.cycle = !g.sky.cycle; break;
      case 'weather':
        g.world.setWeather(arg);
        break;
      case 'scale':
        g.timeScale = Number(arg);
        break;
      case 'hud': g.hud.setVisible(!g.hud.visible); break;
      case 'perf': g.hud.perf = !g.hud.perf; break;
    }
    if (close) {
      g.closeModal();
      return;
    }
    if (!note && !p.alive && ['zone', 'mist', 'bossStart'].includes(act)) note = 'You have fallen. Travel once you rise at the lantern.';
    this.note = note;
    this.render();
  }

  _mainQuest() {
    const defs = this.game.quests.defs;
    return Object.keys(defs).find((id) => defs[id].main) ?? Object.keys(defs)[0];
  }

  // ---------- view ----------

  render() {
    const g = this.game, p = g.player, st = g.state, b = g.boss;
    // Re-rendering replaces the buttons: keep the focused one (gamepad) and the scroll position.
    const focused = this.root.contains(document.activeElement) ? document.activeElement : null;
    const keep = focused?.dataset.act ? `[data-act="${focused.dataset.act}"]${focused.dataset.arg !== undefined ? `[data-arg="${focused.dataset.arg}"]` : ''}` : focused?.classList.contains('test-tod') ? '.test-tod' : null;
    const scroll = this.body.scrollTop;

    const btn = (act, label, { arg, on, disabled, cls = '' } = {}) =>
      `<button class="btn small${on ? ' on' : ''}${cls ? ' ' + cls : ''}" data-act="${act}"${arg !== undefined ? ` data-arg="${esc(arg)}"` : ''}${on !== undefined ? ` aria-pressed="${!!on}"` : ''}${disabled ? ' disabled' : ''}>${label}</button>`;
    const toggle = (act, label, on) => btn(act, `${label}: <b>${on ? 'on' : 'off'}</b>`, { on });
    const group = (name, inner, cls = '') => `<section class="test-group${cls ? ' ' + cls : ''}"><h3>${name}</h3>${inner}</section>`;
    const row = (inner) => `<div class="test-btns">${inner}</div>`;
    const sub = (text) => `<p class="test-sub">${text}</p>`;

    const dead = st.flags.wardenDead;
    const fighting = g.bossFight;
    const owned = (id) => g.hasGear(id);
    const gearBtn = (id, def) => btn('gear', esc(def.name), { arg: id, disabled: owned(id), cls: owned(id) ? 'owned' : '' });
    const bossState = dead ? 'silenced' : fighting ? `fighting, phase ${b.phase}, ${Math.ceil(b.hp)} / ${b.maxHp} HP` : 'kneeling, asleep';
    const q = g.quests, mq = this._mainQuest();
    const tod = g.sky.getTimeOfDay();

    this.status.innerHTML = this.note
      ? esc(this.note)
      : `${esc(ZONES[g.zone]?.name ?? 'The Vale')} · ${p.pos.x.toFixed(0)}, ${p.pos.z.toFixed(0)} · Warden ${bossState} · ${st.ash} ash`;

    this.body.innerHTML = [
      group('Travel', row(
        Object.entries(ZONES).map(([id, z]) => btn('zone', esc(z.name), { arg: id })).join('')
      ) + row(
        btn('mist', 'Mist gate (boss)')
        + (dead ? btn('revive', 'Revive the Warden', { cls: 'warn' }) : btn('bossStart', 'Start the boss fight', { cls: 'warn' }))
      ), 'wide'),

      group('Player', row(
        toggle('god', 'God mode', p.god)
        + toggle('stamina', 'Infinite stamina', g.cheats.stamina)
        + toggle('focus', 'Infinite focus', g.cheats.focus)
      ) + row(
        btn('restore', 'Restore all')
        + btn('ash', '+5,000 ash')
        + btn('stats', '+5 to every stat')
        + btn('fall', 'Fall (test death)', { cls: 'warn', disabled: !p.alive })
      )),

      group('Enemies', row(
        btn('kill', `Kill all nearby (${NEARBY} m)`)
        + btn('respawn', 'Respawn all')
        + toggle('freeze', 'Freeze enemy AI', g.cheats.freeze)
      ) + sub('Spawn 5 m ahead, facing you:') + row(
        enemyKinds().map((k) => btn('spawn', `Spawn ${esc(title(k))}`, { arg: k })).join('')
      )),

      group('Gear and items', row(
        btn('horse', st.flags.horse ? 'Summon Wisp (horse)' : 'Give Wisp (horse)')
        + btn('gearAll', 'Give all gear', { disabled: ALL_GEAR.every(owned) })
      ) + sub('Weapons') + row(Object.entries(WEAPONS).map(([id, d]) => gearBtn(id, d)).join(''))
        + sub('Shields') + row(Object.entries(SHIELDS).map(([id, d]) => gearBtn(id, d)).join(''))
        + sub('Rites') + row(Object.entries(RITES).map(([id, d]) => gearBtn(id, d)).join(''))
        + sub('Key items') + row(Object.entries(ITEMS).map(([id, d]) => btn('item', `${esc(d.name)}${g.hasItem(id) ? ` ×${st.inventory[id]}` : ''}`, { arg: id })).join('')),
      'wide'),

      group('Boss', sub(`Odran: ${esc(bossState)}.`) + row(
        (dead ? btn('revive', 'Revive the Warden') : btn('bossStart', fighting ? 'Restart the fight' : 'Start fight'))
        + btn('phase2', 'Force phase 2', { disabled: dead || b.phase === 2 })
        + btn('stagger', 'Stagger', { disabled: dead || !fighting })
        + btn('bossKill', 'Kill', { disabled: dead || !b.alive, cls: 'warn' })
        + btn('bossReset', dead ? 'Reset (revive)' : 'Reset')
      )),

      group('Quests', sub(`${esc(q.defs[mq].title)}: ${esc(q.status(mq) === 'done' ? 'complete' : q.status(mq) === 'inactive' ? 'not started' : q.objectiveText(mq))}`) + row(
        btn('questAdvance', 'Advance main quest', { disabled: q.status(mq) === 'done' })
        + btn('questAll', 'Complete all')
        + btn('questReset', 'Reset all', { cls: 'warn' })
      )),

      group('World', `
        <label class="test-slider"><span>Time of day <b class="test-tod-v">${clock(tod)}</b></span>
          <input class="test-tod" type="range" min="0" max="24" step="0.25" value="${tod.toFixed(2)}" aria-label="Time of day, hours">
        </label>`
        + row(toggle('cycle', 'Day cycle', g.sky.cycle))
        + sub('Weather') + row(g.world.weatherNames.map((w) => btn('weather', esc(title(w)), { arg: w, on: g.world.getWeather() === w })).join(''))
        + sub('Time scale') + row(SCALES.map((v) => btn('scale', `${v}x`, { arg: v, on: g.timeScale === v })).join(''))
        + row(toggle('hud', 'HUD', g.hud.visible) + toggle('perf', 'Performance overlay', g.hud.perf)),
      'wide'),

      group('Debug keys (add #debug to the URL)', `<div class="test-keys">${DEBUG_KEYS.map(([k, v]) => `<div class="ctl"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div>`, 'wide'),
    ].join('');

    this.body.scrollTop = scroll;
    if (keep) this.root.querySelector(keep)?.focus({ preventScroll: true });
  }
}
