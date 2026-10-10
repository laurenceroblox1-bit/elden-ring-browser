// localStorage save. Every access is guarded: storage can be missing (private windows, embeds).
import { gearOf } from '../data/loot.js';
import { STARTING_WEAPON, WEAPONS } from '../data/weapons.js';
import { ZONES } from '../data/world.js';

const KEY = 'ashen-vale.save.v1';

export const Save = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  },
  pref(name, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(`ashen-vale.pref.${name}`));
      localStorage.setItem(`ashen-vale.pref.${name}`, JSON.stringify(value));
    } catch {
      return null;
    }
    return value;
  },
};

export function newGameState() {
  return {
    v: 1,
    stats: { vigor: 10, endurance: 10, strength: 10, mind: 10 },
    ash: 0,
    flasksMax: 4,
    shrine: 'firstlight',
    shrinesLit: [],
    discovered: [], // zone ids the player has walked into; the map labels these
    inventory: {},
    flags: { horse: false, wardenDead: false },
    remnant: null,
    quests: null,
    upgrades: {}, // weapon id -> smithing level (data/smithing.js)
    stonesTaken: [], // indices into data/biomes.js STONES already picked up
    // Owned gear ids, and what is in each hand and the rite slot (null = empty).
    gear: { owned: [STARTING_WEAPON], right: STARTING_WEAPON, left: null, rite: null },
  };
}

// A loaded save on top of today's defaults. Saves from before a field existed (gear, Mind) still load,
// and unknown or unowned gear ids fall back to something valid.
export function mergeSave(saved) {
  const d = newGameState();
  const st = { ...d, ...saved, stats: { ...d.stats, ...saved.stats }, flags: { ...d.flags, ...saved.flags } };
  const g = { ...d.gear, ...saved.gear };
  const owned = (g.owned ?? []).filter((id) => gearOf(id));
  if (!owned.includes(STARTING_WEAPON)) owned.unshift(STARTING_WEAPON);
  const ok = (id, slot) => (id && owned.includes(id) && gearOf(id).slot === slot ? id : null);
  st.gear = { owned, right: ok(g.right, 'weapon') ?? STARTING_WEAPON, left: ok(g.left, 'shield'), rite: ok(g.rite, 'rite') };
  if (WEAPONS[st.gear.right].hands > 1) st.gear.left = null; // two hands on the weapon: no shield
  // Saves from before the map: count the zones of kindled shrines (their ids match) as discovered.
  const found = Array.isArray(saved.discovered) ? saved.discovered : st.shrinesLit ?? [];
  st.discovered = [...new Set(found)].filter((id) => ZONES[id]);
  return st;
}

export const levelOf = (stats) => stats.vigor + stats.endurance + stats.strength + (stats.mind ?? 10) - 39;
export const levelCost = (level) => Math.floor(90 + level * 30 + level * level * 4);
