// localStorage save. Every access is guarded: storage can be missing (private windows, embeds).
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
    stats: { vigor: 10, endurance: 10, strength: 10 },
    ash: 0,
    flasksMax: 4,
    shrine: 'firstlight',
    shrinesLit: [],
    inventory: {},
    flags: { horse: false, wardenDead: false },
    remnant: null,
    quests: null,
  };
}

export const levelOf = (stats) => stats.vigor + stats.endurance + stats.strength - 29;
export const levelCost = (level) => Math.floor(90 + level * 30 + level * level * 4);
