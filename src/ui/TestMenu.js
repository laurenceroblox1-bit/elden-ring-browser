// Test menu (` or Pause > Test menu): teleports, cheats, gear, enemies, the boss, quests and the
// environment, for trying things out quickly. Lists come from the data modules each time it opens,
// so new zones, gear, items and enemy kinds show up without touching this file.
import { ZONES, NPCS } from '../data/world.js';
import { WEAPONS, SHIELDS } from '../data/weapons.js';
import { RITES } from '../data/abilities.js';
import { ITEMS } from '../data/items.js';
import { ALL_GEAR, LOOT, gearOf } from '../data/loot.js';
import { Save, mergeSave } from '../systems/Save.js';
import { enemyKinds } from '../entities/spawn.js';

const SCALES = [0.25, 0.5, 1, 2];
// Bosses outside the arena that run their own fights (Game.startFoeFight), by enemy tag.
const FOE_BOSSES = [['matriarch', 'Vharra, Mother of the Mire'], ['troll', 'Grimhorn, the Howling Field\'s troll'], ['saelith', 'Saelith, the Winter Lantern'],
  ['drake', 'Ashmaw, the Cinder Drake'], ['captain_drowned', 'Captain Morrow, the Drowned'], ['witch', 'Sylvara, the Bloom Witch'],
  ['scarab', 'Solkar, the Sun Scarab'], ['herald', 'Vaelor, the Storm Herald'], ['bellringer', 'The Bell-Ringer'], ['antlerking', 'Hornwood, the Antlered King'], ['colossus', 'Corundel, the Glass Colossus']];
const BOSS_HP = [0.75, 0.5, 0.25, 0.1];
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

// Save codes: the save as base64 JSON, so a set-up moment can be copied out and pasted back in.
const encodeSave = (st) => btoa(unescape(encodeURIComponent(JSON.stringify(st))));
const decodeSave = (code) => JSON.parse(decodeURIComponent(escape(atob(code.trim()))));

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

      case 'tpShrine': {
        const sh = g.world.shrines.get(arg);
        close = g.teleport(sh.x, sh.z + 2.5, Math.PI);
        break;
      }
      case 'tpNpc': {
        const n = NPCS.find((x) => x.id === arg);
        close = g.teleport(n.x + Math.sin(n.yaw) * 2.5, n.z + Math.cos(n.yaw) * 2.5, n.yaw + Math.PI);
        break;
      }
      case 'tpLoot': {
        const l = LOOT[Number(arg)];
        close = g.teleport(l.x, l.z + 2, Math.PI);
        break;
      }
      case 'tpRemnant': {
        const r = st.remnant;
        if (!r) { note = 'You have no dropped ash lying anywhere.'; break; }
        close = g.teleport(r.x, r.z + 2, Math.PI);
        break;
      }
      case 'kindleAll':
        note = `Kindled ${g.kindleAll()} lantern(s). Fast-travel between them from the map (M).`;
        break;
      case 'revealMap':
        st.discovered = Object.keys(ZONES);
        g.save();
        note = 'Every place in the Vale is now named on the map.';
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

      case 'oneHit': g.cheats.oneHit = !g.cheats.oneHit; break;
      case 'flasks': g.cheats.flasks = !g.cheats.flasks; break;

      // enemies
      case 'kill':
        note = `Felled ${g.killNearby(NEARBY)} within ${NEARBY} m.`;
        break;
      case 'respawn':
        g.respawnEnemies();
        note = 'Every enemy is back at its post; spawned extras are gone.';
        break;
      case 'freeze': g.cheats.freeze = !g.cheats.freeze; break;
      case 'pack':
        for (const off of [-0.5, 0, 0.5]) {
          const e = g.spawnEnemy('hound', 7);
          e.pos.x += Math.cos(p.yaw) * off * 6;
          e.pos.z -= Math.sin(p.yaw) * off * 6;
        }
        note = 'A pack of three Mire Hounds is circling ahead of you.';
        break;
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

      // boss extras
      case 'bossHp': {
        const b = g.boss;
        if (!b.alive) { note = 'The Warden is silenced. Revive him first.'; break; }
        b.hp = b.maxHp * Number(arg);
        note = `Odran set to ${Math.round(Number(arg) * 100)}% health${Number(arg) <= 0.5 && b.phase === 1 ? ' (phase 2 begins when he next acts)' : ''}.`;
        break;
      }
      case 'rehearse': {
        if (st.flags.wardenDead) g.reviveWarden();
        if (!p.alive) { note = 'You have fallen. Wait to rise at the lantern.'; break; }
        Object.assign(p, { hp: p.maxHp, stamina: p.maxStamina, focus: p.maxFocus, flasks: p.flasksMax, winded: false });
        close = g.enterBossFight({ cutscene: arg !== 'skip' });
        break;
      }

      // Roaming bosses (Vharra, Saelith, the troll): arg is 'tag' or 'tag:extra'
      case 'foe': {
        const [tag, how] = arg.split(':');
        if (!p.alive) { note = 'You have fallen. Wait to rise at the lantern.'; break; }
        Object.assign(p, { hp: p.maxHp, stamina: p.maxStamina, focus: p.maxFocus, flasks: p.flasksMax, winded: false });
        close = g.enterFoeFight(tag, { cutscene: how !== 'skip' });
        break;
      }
      case 'foeHp': {
        const [tag, v] = arg.split(':');
        const b = g.fieldBoss;
        if (!b || b.tag !== tag) { note = 'Start that fight first.'; break; }
        b.hp = b.maxHp * Number(v);
        note = `${b.name} set to ${Math.round(Number(v) * 100)}% health.`;
        break;
      }
      case 'foeKill': {
        const b = g.fieldBoss;
        if (!b || b.tag !== arg) { note = 'Start that fight first.'; break; }
        b.invuln = false;
        g.combat.strike(p, b, { dmg: 1e6, poise: 0 });
        break;
      }
      case 'foeReset': {
        const b = g.enemies.find((e) => e.tag === arg);
        if (g.fieldBoss === b) g.endFoeFight();
        if (b) {
          st.flags[b.flag] = false;
          b.reset();
          note = `${b.name} is back at its post.`;
        }
        break;
      }

      // debug views
      case 'hitboxes': g.debugViews.setHitboxes(!g.debugViews.hitboxes); break;
      case 'colliders': g.debugViews.setColliders(!g.debugViews.colliders); break;
      case 'freecam':
        g.debugViews.setFreeCam(!g.debugViews.free);
        close = !!g.debugViews.free;
        if (!close) note = 'Back behind your character.';
        break;

      // saves
      case 'saveNow':
        g.save();
        note = 'Saved.';
        break;
      case 'wipeSave':
        if (this.wipeArmed) {
          Save.clear();
          this.wipeArmed = false;
          note = 'Save wiped. The title screen will offer only a new journey until you play again.';
        } else {
          this.wipeArmed = true;
          note = 'Press "Wipe save" again to delete your progress for good.';
        }
        break;
      case 'copyCode': {
        g.save();
        const code = encodeSave(st);
        const box = this.root.querySelector('.test-code');
        if (box) box.value = code;
        const done = () => { this.note = 'Save code copied. Paste it here later to come back to this moment.'; this.render(); };
        try {
          navigator.clipboard.writeText(code).then(done, () => { box?.select(); this.note = 'Select the code in the box and copy it.'; this.render(); });
        } catch {
          box?.select();
        }
        note = 'Save code is in the box below.';
        this.code = code;
        break;
      }
      case 'loadCode': {
        const box = this.root.querySelector('.test-code');
        try {
          const loaded = mergeSave(decodeSave(box.value));
          Save.write(loaded);
          g.closeModal();
          g.continueGame();
          return;
        } catch {
          note = 'That code could not be read. Copy the whole code, with no spaces missing.';
        }
        break;
      }
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
        btn('tpRemnant', 'Your dropped ash', { disabled: !st.remnant })
        + btn('kindleAll', 'Kindle every lantern')
        + btn('revealMap', 'Reveal the whole map')
      ) + sub('Lanterns, people and gear lying in the Vale:') + row(
        [...g.world.shrines.values()].map((sh) => btn('tpShrine', esc(sh.name), { arg: sh.id })).join('')
        + NPCS.map((n) => btn('tpNpc', esc(n.name), { arg: n.id })).join('')
        + LOOT.map((l, i) => btn('tpLoot', esc(gearOf(l.gear)?.def.name ?? l.gear), { arg: i, disabled: owned(l.gear), cls: owned(l.gear) ? 'owned' : '' })).join('')
      ) + row(
        btn('mist', 'Mist gate (boss)')
        + (dead ? btn('revive', 'Revive the Warden', { cls: 'warn' }) : btn('bossStart', 'Start the boss fight', { cls: 'warn' }))
      ), 'wide'),

      group('Player', row(
        toggle('god', 'God mode', p.god)
        + toggle('stamina', 'Infinite stamina', g.cheats.stamina)
        + toggle('focus', 'Infinite focus', g.cheats.focus)
        + toggle('flasks', 'Infinite flasks', g.cheats.flasks)
        + toggle('oneHit', 'One-hit kills', g.cheats.oneHit)
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
        + btn('pack', 'Spawn a hound pack')
      ) + sub('Spawn 5 m ahead, facing you:') + row(
        enemyKinds().filter((k) => !FOE_BOSSES.some(([t]) => t === k)).map((k) => btn('spawn', `Spawn ${esc(title(k))}`, { arg: k })).join('')
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
      ) + sub('Health:') + row(BOSS_HP.map((v) => btn('bossHp', `${v * 100}%`, { arg: v, disabled: dead })).join(''))
        + sub('Rehearsal: full restore, then straight into the fight.') + row(
          btn('rehearse', 'Rehearse (with cutscene)', { cls: 'warn' }) + btn('rehearse', 'Rehearse (skip cutscene)', { arg: 'skip', cls: 'warn' })
        )),

      group('Other bosses', FOE_BOSSES.map(([tag, label]) => {
        const b = g.enemies.find((e) => e.tag === tag);
        if (!b) return '';
        const on = g.fieldBoss === b;
        const state = st.flags[b.flag] ? 'beaten' : on ? `fighting, phase ${b.phase ?? 1}, ${Math.ceil(b.hp)} / ${b.maxHp} HP` : 'waiting at its post';
        return sub(`${esc(label)}: ${esc(state)}.`) + row(
          btn('foe', b.intro ? 'Fight (with cutscene)' : 'Fight', { arg: tag, cls: 'warn' })
          + (b.intro ? btn('foe', 'Fight (skip cutscene)', { arg: `${tag}:skip`, cls: 'warn' }) : '')
          + btn('foeHp', 'Health 50%', { arg: `${tag}:0.5`, disabled: !on })
          + btn('foeHp', '10%', { arg: `${tag}:0.1`, disabled: !on })
          + btn('foeKill', 'Kill', { arg: tag, disabled: !on, cls: 'warn' })
          + btn('foeReset', 'Reset', { arg: tag })
        );
      }).join(''), 'wide'),

      group('Debug views', row(
        toggle('hitboxes', 'Hitboxes and attack reach', g.debugViews.hitboxes)
        + toggle('colliders', 'Walls and colliders', g.debugViews.colliders)
        + toggle('freecam', 'Free camera', !!g.debugViews.free)
      ) + sub('Free camera: WASD flies, mouse looks, E rises, Q sinks, Shift is fast. Turn it off here.')),

      group('Saves', row(
        btn('saveNow', 'Save now')
        + btn('copyCode', 'Copy save code')
        + btn('loadCode', 'Load save code')
        + btn('wipeSave', this.wipeArmed ? 'Wipe save: are you sure?' : 'Wipe save', { cls: 'warn' })
      ) + `<textarea class="test-code" rows="2" spellcheck="false" aria-label="Save code" placeholder="Paste a save code here, then Load save code">${esc(this.code ?? '')}</textarea>`),

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
