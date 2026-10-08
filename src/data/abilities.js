// Weapon arts (one per weapon, C) and rites (one equipped, V). Both cost focus, and arts some stamina,
// and both go on a short cooldown. They play as scripted actions on the player (state 'art'):
//   time      total length (s);  keys  [time, pose name] track ('rest' = the weapon's stance, the rest
//             are models/weapons.js MOVE_POSES);  overlay  only the left arm follows the keys (rites)
//   track     lock-on keeps turning the player until this time;  invuln  [from, to] i-frames
//   walk      walking speed allowed while casting (default: rooted)
//   cancel    a roll can cut the recovery short after this time
//   events    [time, fn(player, act)] fired once each, in order;  move(player, act, dt) steers the body
// Damage: arts scale like the weapon (player.dmgMult); rites scale with Mind (player.riteMult).
import { ARENA } from './world.js';

// ---------- shared helpers ----------

const SPECTRE = 0xb8d8ff; // Ghoststep's pale blink, kept clear of the Warden's spectral blue ("blue means roll")

// Where a cast or thrown thing should go: the lock target, else the nearest foe roughly ahead,
// else straight ahead. Returns a direction from (x, y, z).
export function aim(p, x, y, z, range = 30, cone = 0.35) {
  const g = p.game;
  let t = g.lockTarget;
  if (!t) {
    let best = Infinity;
    for (const e of g.combat.targetsFor(p)) {
      if (!e.lockable) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 0.5) continue;
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - p.yaw), Math.cos(Math.atan2(dx, dz) - p.yaw)));
      if (off > cone) continue;
      if (d + off * 10 < best) { best = d + off * 10; t = e; }
    }
  }
  if (t) {
    const tx = t.pos.x, ty = t.pos.y + t.lockHeight * 0.75, tz = t.pos.z;
    return { x: tx - x, y: ty - y, z: tz - z, target: t };
  }
  return { x: p.forwardX, y: 0, z: p.forwardZ, target: null };
}

// A point `ahead` metres in front of the player at `up` metres, plus the hand it would come from.
function front(p, ahead, up) {
  return { x: p.pos.x + p.forwardX * ahead, y: p.pos.y + up, z: p.pos.z + p.forwardZ * ahead };
}

function dust(g, x, z, n, color = 0x9a8d78, color2 = 0xd0c4a8) {
  g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.3, z, count: n, speed: 5, up: 2, color, color2, life: [0.4, 1], size: [0.15, 0.35], gravity: 3, drag: 2.5, jitter: 0.8 });
}

// ---------- weapon arts ----------

export const ARTS = {
  // Wayfarer's Blade: a wide sweep that looses a crescent of burning ash. It skims the ground and
  // cuts through everything in its path.
  ember_arc: {
    name: 'Ember Arc',
    desc: 'Sweep wide and loose a crescent of burning ash that skims the ground and cuts through every foe in its path.',
    focus: 12, stamina: 12, cooldown: 2.2,
    time: 0.82, track: 0.26, cancel: 0.55,
    keys: [[0, 'rest'], [0.24, 'emberWind'], [0.34, 'emberStrike'], [0.56, 'emberStrike'], [0.82, 'rest']],
    events: [
      [0.3, (p) => {
        const g = p.game;
        const f = front(p, 0.9, 1.0);
        const a = aim(p, f.x, f.y, f.z, 24, 0.3);
        g.projectiles.spawn(p, {
          kind: 'crescent', x: f.x, y: f.y, z: f.z, dirX: a.x, dirY: 0, dirZ: a.z, speed: 17, life: 1.0, radius: 1.15,
          hug: 0.9, pierce: true, scale: 0.95, sound: 'boltHit',
          hit: { dmg: 30 * p.dmgMult, poise: 22 },
        });
        g.audio.play('emberArc');
      }],
    ],
  },

  // Ashen Greatblade: raise it high and drive it into the earth. The blow and the shockwave stagger.
  quake: {
    name: 'Quake',
    desc: 'Drive the greatblade into the earth. The blow and the shockwave that rolls out from it stagger whatever they catch.',
    focus: 18, stamina: 26, cooldown: 5,
    time: 1.35, track: 0.6, cancel: 1.0,
    keys: [[0, 'rest'], [0.4, 'quakeRaise'], [0.62, 'quakeRaise'], [0.74, 'quakeSlam'], [1.08, 'quakeSlam'], [1.35, 'rest']],
    events: [
      [0.3, (p) => p.game.audio.play('heavySwing')],
      [0.74, (p) => {
        const g = p.game;
        const f = front(p, 1.7, 0.8);
        g.combat.sphere(p, f, 2.1, { dmg: 36 * p.dmgMult, poise: 60, heavy: true }, new Set());
        g.effects.shockwave(p, f.x, f.z, { start: 0.8, maxR: 8, speed: 13, color: 0xffa060, hit: { dmg: 24 * p.dmgMult, poise: 45, heavy: true } });
        g.audio.play('slam');
        g.cameraShake(0.45);
        g.hitstop = Math.max(g.hitstop, 0.06);
        dust(g, f.x, f.z, 36);
        g.particles.emit({ x: f.x, y: f.y - 0.6, z: f.z, count: 26, speed: 4, up: 3, color: 0xff7a2a, color2: 0xffd080, life: [0.3, 0.8], size: [0.06, 0.14], gravity: 6, drag: 1.5 });
      }],
    ],
  },

  // Mother's Fang: Vharra's own pounce. A crouch, a leap a few strides forward, and a landing that
  // splits the ground in a ring of ash. Untouchable at the top of the leap.
  mothers_pounce: {
    name: "Mother's Pounce",
    desc: 'Crouch like the Mother of the Mire, leap onto your foe and land in a ring of ash. Nothing can touch you at the top of the leap.',
    focus: 16, stamina: 26, cooldown: 4,
    time: 1.3, track: 0.3, invuln: [0.24, 0.6], cancel: 1.0,
    keys: [[0, 'rest'], [0.2, 'quakeRaise'], [0.62, 'quakeRaise'], [0.72, 'quakeSlam'], [1.05, 'quakeSlam'], [1.3, 'rest']],
    events: [
      [0.22, (p, act) => {
        p.game.audio.play('heavySwing');
        p.vy = 7.5;
        p.onGround = false;
        act.leap = true;
      }],
      [0.72, (p, act) => {
        const g = p.game;
        act.leap = false;
        const f = front(p, 1.6, 0.8);
        g.combat.sphere(p, f, 2.2, { dmg: 40 * p.dmgMult, poise: 60, heavy: true }, new Set());
        g.effects.shockwave(p, p.pos.x, p.pos.z, { start: 1, maxR: 7, speed: 14, color: 0xd8c8a8, hit: { dmg: 22 * p.dmgMult, poise: 40, heavy: true } });
        g.audio.play('slam');
        g.cameraShake(0.4);
        g.hitstop = Math.max(g.hitstop, 0.06);
        dust(g, f.x, f.z, 40);
      }],
    ],
    move(p, act, dt) {
      const g = p.game;
      let sp = 0;
      if (act.leap) {
        sp = 9;
        const lock = g.lockTarget;
        if (lock && Math.hypot(lock.pos.x - p.pos.x, lock.pos.z - p.pos.z) < lock.radius + 1.4) sp = 0;
      }
      p.vel.x = sp ? p.forwardX * sp : p.vel.x * Math.exp(-10 * dt);
      p.vel.z = sp ? p.forwardZ * sp : p.vel.z * Math.exp(-10 * dt);
    },
  },

  // Icicle Estoc: three quick thrusts on the spot, each leaving frost in the wound.
  winters_edge: {
    name: "Winter's Edge",
    desc: 'Three needle-quick thrusts in a heartbeat, each one leaving frost behind. Two flurries frostbite most foes.',
    focus: 12, stamina: 20, cooldown: 2.4,
    time: 0.98, track: 0.6, cancel: 0.75,
    keys: [[0, 'rest'], [0.1, 'pierceCrouch'], [0.2, 'pierceDrive'], [0.3, 'pierceCrouch'], [0.42, 'pierceDrive'], [0.52, 'pierceCrouch'], [0.64, 'pierceDrive'], [0.98, 'rest']],
    events: [0.2, 0.42, 0.64].map((t) => [t, (p) => {
      const g = p.game;
      g.audio.play('swing');
      g.combat.melee(p, { dmg: 15 * p.dmgMult, poise: 12, reach: 3.0, arc: 0.45, frost: 22 }, new Set());
      const f = front(p, 1.8, 1.2);
      g.particles.emit({ x: f.x, y: f.y, z: f.z, count: 8, speed: 2, up: 0.5, color: 0xdff4ff, color2: 0x8fd0ff, life: [0.2, 0.45], size: [0.05, 0.12], drag: 2 });
    }]),
    move(p, act, dt) {
      const t = p.t;
      const sp = (t > 0.18 && t < 0.24) || (t > 0.4 && t < 0.46) || (t > 0.62 && t < 0.68) ? 5 : 0;
      p.vel.x = sp ? p.forwardX * sp : p.vel.x * Math.exp(-12 * dt);
      p.vel.z = sp ? p.forwardZ * sp : p.vel.z * Math.exp(-12 * dt);
    },
  },

  // Rime Glaive: draw back and hurl a lance of ice that pierces through everything in a line.
  glacial_lance: {
    name: 'Glacial Lance',
    desc: 'Draw the glaive back and hurl a lance of blue ice. It flies straight through every foe in its path and leaves them half-frozen.',
    focus: 16, stamina: 20, cooldown: 3,
    time: 1.0, track: 0.5, cancel: 0.8,
    keys: [[0, 'rest'], [0.24, 'pierceCrouch'], [0.46, 'pierceCrouch'], [0.56, 'pierceDrive'], [1.0, 'rest']],
    events: [
      [0.2, (p) => p.game.audio.play('cast')],
      [0.56, (p) => {
        const g = p.game;
        const f = front(p, 1.0, 1.35);
        const a = aim(p, f.x, f.y, f.z, 30, 0.3);
        g.projectiles.spawn(p, {
          kind: 'shard', x: f.x, y: f.y, z: f.z, dirX: a.x, dirY: a.y * 0.6, dirZ: a.z, speed: 30, life: 1.3, radius: 0.6,
          pierce: true, scale: 2.4, sound: 'shard', hit: { dmg: 40 * p.dmgMult, poise: 34, frost: 50 },
        });
        g.audio.play('shard');
      }],
    ],
  },

  // Pilgrim's Spear: a low crouch, then a long dash behind the spearpoint. Untouchable while it flies.
  lunging_pierce: {
    name: 'Lunging Pierce',
    desc: 'Crouch, then drive forward behind the spearpoint in a long dash. Nothing can touch you while you fly.',
    focus: 10, stamina: 18, cooldown: 3,
    time: 0.92, track: 0.2, invuln: [0.16, 0.5], cancel: 0.7,
    keys: [[0, 'rest'], [0.16, 'pierceCrouch'], [0.26, 'pierceDrive'], [0.6, 'pierceDrive'], [0.92, 'rest']],
    events: [
      [0.18, (p, act) => {
        p.game.audio.play('pierce');
        act.hit = { dmg: 34 * p.dmgMult, poise: 40, reach: 2.6, arc: 0.55, heavy: true };
        act.hitSet = new Set();
      }],
    ],
    move(p, act, dt) {
      const t = p.t, g = p.game;
      let sp = 0;
      if (act.hit && t < 0.5) { // from the 0.18 s event on
        sp = 17;
        const lock = g.lockTarget;
        // Stop at the target rather than running through it.
        if (lock && Math.hypot(lock.pos.x - p.pos.x, lock.pos.z - p.pos.z) < lock.radius + 1.2) sp = 0;
        g.combat.melee(p, act.hit, act.hitSet);
        if (Math.random() < 0.8) g.particles.emit({ x: p.pos.x, y: p.pos.y + 0.6, z: p.pos.z, count: 2, speed: 0.5, up: 0.5, color: 0xd8c8a0, color2: 0xffffff, life: [0.2, 0.4], size: [0.08, 0.16], jitter: 0.3 });
      }
      p.vel.x = sp ? p.forwardX * sp : p.vel.x * Math.exp(-10 * dt);
      p.vel.z = sp ? p.forwardZ * sp : p.vel.z * Math.exp(-10 * dt);
    },
  },

  // Twin Fangs: blink to the locked foe's back (or a few strides ahead) and stab twice. A stab from
  // behind cuts deeper and staggers.
  ghoststep: {
    name: 'Ghoststep',
    desc: 'Blink to your locked foe\'s back, or a few strides ahead, and stab with both fangs. From behind the stab cuts deep and staggers.',
    focus: 10, stamina: 12, cooldown: 2.4,
    time: 0.78, invuln: [0.04, 0.34], cancel: 0.6,
    keys: [[0, 'rest'], [0.12, 'ghostCrouch'], [0.3, 'ghostCrouch'], [0.4, 'ghostStab'], [0.58, 'ghostStab'], [0.78, 'rest']],
    events: [
      [0.14, (p) => {
        const g = p.game, t = g.lockTarget;
        const from = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
        let x, z, yaw;
        if (t && t.alive && Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) < 10) {
          const d = t.radius + p.radius + 0.55;
          x = t.pos.x - Math.sin(t.yaw) * d;
          z = t.pos.z - Math.cos(t.yaw) * d;
          yaw = t.yaw;
        } else {
          x = p.pos.x + p.forwardX * 5;
          z = p.pos.z + p.forwardZ * 5;
          yaw = p.yaw;
        }
        // Stay inside the arena during the fight, and out of walls everywhere.
        if (g.bossFight) {
          const dx = x - ARENA.x, dz = z - ARENA.z, r = Math.hypot(dx, dz), max = ARENA.r - 2.5;
          if (r > max) { x = ARENA.x + (dx / r) * max; z = ARENA.z + (dz / r) * max; }
        }
        p.pos.x = x;
        p.pos.z = z;
        g.world.resolve(p.pos, p.radius);
        p.pos.y = g.world.getHeight(p.pos.x, p.pos.z);
        p.vel.set(0, 0, 0);
        p.yaw = yaw;
        g.audio.play('ghost');
        for (const at of [from, p.pos]) {
          g.particles.emit({ x: at.x, y: at.y + 1, z: at.z, count: 22, speed: 2.5, up: 0.8, color: SPECTRE, color2: 0xffffff, life: [0.3, 0.7], size: [0.08, 0.18], jitter: 0.5, drag: 2.5 });
        }
      }],
      [0.38, (p) => {
        p.game.audio.play('swing');
        p.game.combat.melee(p, { dmg: 28 * p.dmgMult, poise: 24, reach: 2.2, arc: 0.8, backstab: 1.6 }, new Set());
      }],
    ],
  },

  // Warden's Bell-Maul: lift the bell high and bring it down. The toll rolls out as a ring of sound.
  toll_of_silence: {
    name: 'Toll of Silence',
    desc: 'Lift the bell high and bring it down. Its toll rolls out around you as a ring that knocks foes off their feet, and a softer echo follows it.',
    focus: 22, stamina: 30, cooldown: 6,
    time: 1.45, track: 0.5, cancel: 1.1,
    keys: [[0, 'rest'], [0.45, 'tollRaise'], [0.66, 'tollRaise'], [0.8, 'tollSlam'], [1.15, 'tollSlam'], [1.45, 'rest']],
    events: [
      [0.2, (p) => p.game.audio.play('bellSmall')],
      [0.8, (p) => {
        const g = p.game;
        const ring = (dmg, poise, maxR, delay) => g.after(delay, () => {
          if (!p.alive) return;
          g.effects.shockwave(p, p.pos.x, p.pos.z, { start: 0.8, maxR, speed: 15, thickness: 1.3, color: 0xffd9a0, hit: { dmg, poise, heavy: poise >= 60 } });
        });
        ring(46 * p.dmgMult, 70, 10, 0);
        ring(18 * p.dmgMult, 30, 7, 0.35);
        g.audio.play('toll');
        g.cameraShake(0.5);
        g.hitstop = Math.max(g.hitstop, 0.06);
        dust(g, p.pos.x + p.forwardX * 1.6, p.pos.z + p.forwardZ * 1.6, 40);
      }],
    ],
  },
};

// ---------- rites ----------

const CAST = [[0, 'rest'], [0.24, 'castGather'], [0.36, 'castThrust'], [0.55, 'castThrust'], [0.75, 'rest']];
const RAISE = [[0, 'rest'], [0.3, 'castRaise'], [0.62, 'castRaise'], [0.9, 'rest']];

export const RITES = {
  lantern_bolt: {
    name: 'Lantern Bolt',
    type: 'Fire rite',
    desc: 'Cup the lantern-flame in your hand and throw it. It flies straight at your locked foe, or whatever stands in front of you.',
    focus: 14, cooldown: 0.9,
    time: 0.75, keys: CAST, overlay: true, walk: 1.2, track: 0.36, cancel: 0.5,
    events: [
      [0.08, (p) => p.game.audio.play('cast')],
      [0.36, (p) => {
        const g = p.game;
        const f = front(p, 0.7, 1.45);
        const a = aim(p, f.x, f.y, f.z);
        g.projectiles.spawn(p, {
          kind: 'bolt', x: f.x, y: f.y, z: f.z, dirX: a.x, dirY: a.y, dirZ: a.z, speed: 26, life: 1.4, radius: 0.4,
          sound: 'boltHit', hit: { dmg: 38 * p.riteMult, poise: 24 },
        });
        g.audio.play('bolt');
      }],
    ],
  },
  ward_of_ash: {
    name: 'Ward of Ash',
    type: 'Warding rite',
    desc: 'Draw a ring of warm ash around yourself. For 8 seconds every blow that lands on you does 40% less harm.',
    focus: 25, cooldown: 14, duration: 8, reduce: 0.4,
    time: 0.9, keys: RAISE, overlay: true, walk: 1.0, cancel: 0.7,
    events: [
      [0.4, (p, act) => {
        p.ward = { t: act.def.duration, reduce: act.def.reduce };
        p.game.audio.play('ward');
        p.game.particles.emit({ x: p.pos.x, y: p.pos.y + 0.4, z: p.pos.z, count: 40, speed: 3, up: 1.5, color: 0xcfc2a8, color2: 0xffe0a0, life: [0.5, 1.1], size: [0.08, 0.16], drag: 2, jitter: 0.6 });
      }],
    ],
  },
  frost_nova: {
    name: 'Frost Nova',
    type: 'Frost rite',
    desc: 'Breathe out the cold of the Rimewold. A ring of frost bursts from you, harming and half-freezing everything it passes. Roll-proof foes beware; it never misses at your feet.',
    focus: 28, cooldown: 7,
    time: 0.9, keys: RAISE, overlay: true, walk: 0.8, cancel: 0.7,
    events: [
      [0.45, (p) => {
        const g = p.game;
        g.effects.shockwave(p, p.pos.x, p.pos.z, { start: 0.6, maxR: 8, speed: 14, color: 0xbfe8ff, hit: { dmg: 26 * p.riteMult, poise: 30, frost: 55 } });
        g.audio.play('frostbite');
        g.particles.emit({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z, count: 40, speed: 5, up: 1.2, color: 0xdff4ff, color2: 0x7cc8ff, life: [0.3, 0.8], size: [0.08, 0.18], drag: 2 });
      }],
    ],
  },
  mending_light: {
    name: 'Mending Light',
    type: 'Healing rite',
    desc: 'Kindle a small light in your chest. It knits your wounds over six seconds, 80 health in all, and more with a stronger Mind.',
    focus: 30, cooldown: 12, duration: 6, heal: 80,
    time: 0.9, keys: RAISE, overlay: true, walk: 1.0, cancel: 0.7,
    events: [
      [0.45, (p, act) => {
        p.mend = { t: act.def.duration, rate: (act.def.heal * p.riteMult) / act.def.duration };
        p.game.audio.play('mend');
      }],
    ],
  },
};

export const GEAR_KIND = { weapon: 'Weapon', shield: 'Shield', rite: 'Rite' };
