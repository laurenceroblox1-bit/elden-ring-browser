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

  // Ember Flamberge: an overhead slam that sends a line of fire racing along the ground ahead.
  flame_wave: {
    name: 'Flame Wave',
    desc: 'Bring the flamberge down so hard the ground splits, and a line of fire races out ahead of you, burning everything in its path and leaving the ground alight behind it.',
    focus: 18, stamina: 26, cooldown: 5,
    time: 1.3, track: 0.6, cancel: 1.0,
    keys: [[0, 'rest'], [0.38, 'quakeRaise'], [0.6, 'quakeRaise'], [0.72, 'quakeSlam'], [1.05, 'quakeSlam'], [1.3, 'rest']],
    events: [
      [0.3, (p) => p.game.audio.play('heavySwing')],
      [0.72, (p) => {
        const g = p.game;
        const f = front(p, 1.6, 0.8);
        g.combat.sphere(p, f, 2.0, { dmg: 30 * p.dmgMult, poise: 50, heavy: true, burn: 30 }, new Set());
        g.audio.play('slam');
        g.audio.play('ignite');
        g.cameraShake(0.35);
        const hitSet = new Set();
        for (let i = 0; i < 6; i++) {
          g.after(i * 0.09, () => {
            const d = 2.5 + i * 2.2;
            const x = p.pos.x + p.forwardX * d, z = p.pos.z + p.forwardZ * d;
            g.combat.sphere(p, { x, y: g.world.getHeight(x, z) + 0.8, z }, 1.8, { dmg: 18 * p.dmgMult, poise: 24, burn: 26 }, hitSet);
            g.particles.emit({ x, y: g.world.getHeight(x, z) + 0.3, z, count: 22, speed: 3, up: 5, color: 0xff6a1a, color2: 0xffd060, life: [0.4, 0.9], size: [0.15, 0.3], drag: 1.5, jitter: 0.8 });
            if (i % 2) g.effects.hazard(p, x, z, { radius: 1.8, life: 3, look: 'fire', hit: { dmg: 3 * p.dmgMult, poise: 0, burn: 12 } });
          });
        }
      }],
    ],
  },

  // Ashmaw's Fang: the drake's own breath, a short river of fire ahead.
  drake_breath: {
    name: "Drake's Breath",
    desc: 'Plant the fang and breathe out the fire still burning in it: a roaring cone of flame ahead of you for a long moment. Sweep it with your aim.',
    focus: 24, stamina: 20, cooldown: 6,
    time: 1.8, track: 1.6, walk: 0.6, cancel: 1.5,
    keys: [[0, 'rest'], [0.3, 'castThrust'], [1.5, 'castThrust'], [1.8, 'rest']],
    events: [
      [0.25, (p) => p.game.audio.play('breath')],
    ],
    move(p, act, dt) {
      const g = p.game, t = p.t;
      p.vel.x *= Math.exp(-8 * dt);
      p.vel.z *= Math.exp(-8 * dt);
      if (t < 0.32 || t > 1.5) return;
      const f = front(p, 0.9, 1.4);
      for (let i = 0; i < 3; i++) {
        const sp = 11 + Math.random() * 4, a = p.yaw + (Math.random() - 0.5) * 0.4;
        g.particles.emit({ x: f.x, y: f.y, z: f.z, count: 1, speed: 0.8, color: 0xff5a10, color2: 0xffe080, life: [0.35, 0.6], size: [0.25, 0.5], drag: 0.6, jitter: 0.15, dir: { x: Math.sin(a) * sp, y: -0.8, z: Math.cos(a) * sp } });
      }
      act.tick = (act.tick ?? 0) - dt;
      if (act.tick <= 0) {
        act.tick = 0.2;
        g.combat.melee(p, { dmg: 9 * p.dmgMult, poise: 8, reach: 7, arc: 0.4, burn: 20, height: 3 }, new Set());
      }
    },
  },

  // Saltmarrow Cutlass: a slash that throws a crescent of seawater through everything in a line.
  tidecaller: {
    name: 'Tidecaller',
    desc: 'A wide slash that throws a crescent of seawater skimming over the ground. It cuts through every foe in its path and knocks them back.',
    focus: 12, stamina: 12, cooldown: 2.4,
    time: 0.8, track: 0.26, cancel: 0.55,
    keys: [[0, 'rest'], [0.22, 'emberWind'], [0.32, 'emberStrike'], [0.54, 'emberStrike'], [0.8, 'rest']],
    events: [
      [0.32, (p) => {
        const g = p.game;
        const f = front(p, 0.8, 0.9);
        g.projectiles.spawn(p, {
          kind: 'crescent', x: f.x, y: f.y, z: f.z, dirX: p.forwardX, dirY: 0, dirZ: p.forwardZ, speed: 22, life: 0.75, radius: 1.3,
          pierce: true, hug: 0.9, scale: 1.4, color: 0x9fe0ff, color2: 0xffffff, sound: 'splash',
          hit: { dmg: 26 * p.dmgMult, poise: 30, knock: 4 },
        });
        g.audio.play('splash');
      }],
    ],
  },

  // Bloom Scythe: a wide reap that sows a cloud of spores ahead.
  spore_cloud: {
    name: 'Sow Spores',
    desc: 'A wide reaping sweep that scatters the spores caught in the blade: a poison cloud blooms where it ends and lingers a while.',
    focus: 16, stamina: 16, cooldown: 4,
    time: 0.95, track: 0.3, cancel: 0.7,
    keys: [[0, 'rest'], [0.24, 'emberWind'], [0.36, 'emberStrike'], [0.6, 'emberStrike'], [0.95, 'rest']],
    events: [
      [0.36, (p) => {
        const g = p.game;
        g.audio.play('heavySwing');
        g.audio.play('spore');
        g.combat.melee(p, { dmg: 24 * p.dmgMult, poise: 26, reach: 4, arc: 1.4, poison: 30 }, new Set());
        const f = front(p, 4, 0);
        g.effects.hazard(p, f.x, f.z, { radius: 3.4, life: 6, look: 'spore', hit: { dmg: 3 * p.dmgMult, poise: 0, poison: 18 } });
      }],
    ],
  },

  // Sun Khopesh: a flashing disc of sunlight thrown along the ground.
  solar_arc: {
    name: 'Solar Arc',
    desc: 'A rising slash that throws a disc of sunlight skimming over the ground. It cuts through every foe in its path and sets them burning.',
    focus: 14, stamina: 12, cooldown: 2.6,
    time: 0.82, track: 0.26, cancel: 0.55,
    keys: [[0, 'rest'], [0.24, 'emberWind'], [0.34, 'emberStrike'], [0.56, 'emberStrike'], [0.82, 'rest']],
    events: [
      [0.34, (p) => {
        const g = p.game;
        const f = front(p, 0.8, 0.9);
        g.projectiles.spawn(p, {
          kind: 'crescent', x: f.x, y: f.y, z: f.z, dirX: p.forwardX, dirY: 0, dirZ: p.forwardZ, speed: 24, life: 0.8, radius: 1.3,
          pierce: true, hug: 0.9, scale: 1.3, color: 0xffd040, color2: 0xfff4c0, sound: 'boltHit',
          hit: { dmg: 24 * p.dmgMult, poise: 24, burn: 30 },
        });
        g.audio.play('bolt');
      }],
    ],
  },

  // Spire Spear: drive the point down and a bolt falls where it points.
  thunder_thrust: {
    name: 'Thunder Thrust',
    desc: 'Drive the spear forward and call the storm: a bolt of lightning strikes the ground a few strides ahead a moment later. Through any guard.',
    focus: 16, stamina: 16, cooldown: 3.5,
    time: 0.95, track: 0.4, cancel: 0.7,
    keys: [[0, 'rest'], [0.18, 'pierceCrouch'], [0.3, 'pierceDrive'], [0.62, 'pierceDrive'], [0.95, 'rest']],
    events: [
      [0.3, (p) => {
        const g = p.game;
        g.audio.play('pierce');
        g.combat.melee(p, { dmg: 22 * p.dmgMult, poise: 24, reach: 3.4, arc: 0.4 }, new Set());
        const t = g.lockTarget && Math.hypot(g.lockTarget.pos.x - p.pos.x, g.lockTarget.pos.z - p.pos.z) < 16 ? g.lockTarget.pos : front(p, 5, 0);
        g.effects.lightning(p, t.x, t.z, 0.45, { radius: 2.4, hit: { dmg: 40 * p.dmgMult, poise: 40, knock: 4, unblockable: true } });
      }],
    ],
  },

  // Herald's Glaive: the storm comes down in a ring around you.
  stormcall: {
    name: 'Stormcall',
    desc: "Raise the Herald's glaive to the sky. Bolts of lightning come down in a ring around you, one after another, striking everything near.",
    focus: 26, stamina: 18, cooldown: 7,
    time: 1.4, track: 0, cancel: 1.1,
    keys: [[0, 'rest'], [0.3, 'castRaise'], [1.1, 'castRaise'], [1.4, 'rest']],
    events: [
      [0.4, (p) => {
        const g = p.game;
        g.audio.play('thunder');
        for (let i = 0; i < 6; i++) {
          const a = p.yaw + (i / 6) * Math.PI * 2;
          g.effects.lightning(p, p.pos.x + Math.sin(a) * 4.5, p.pos.z + Math.cos(a) * 4.5, 0.25 + i * 0.12, { radius: 2.4, hit: { dmg: 30 * p.dmgMult, poise: 34, knock: 4 } });
        }
      }],
    ],
  },

  // Ringer's Hammer: strike the ground and the spectral bells fall in a ring around you.
  bell_toll: {
    name: 'Toll of Bells',
    desc: 'Strike the ground with the bell-hammer: it tolls, and a ring of spectral bells falls from the sky around you a moment later.',
    focus: 28, stamina: 26, cooldown: 7,
    time: 1.35, track: 0.6, cancel: 1.0,
    keys: [[0, 'rest'], [0.4, 'quakeRaise'], [0.62, 'quakeRaise'], [0.74, 'quakeSlam'], [1.08, 'quakeSlam'], [1.35, 'rest']],
    events: [
      [0.74, (p) => {
        const g = p.game;
        g.audio.play('bell');
        g.effects.shockwave(p, p.pos.x, p.pos.z, { start: 0.8, maxR: 6, speed: 12, color: 0xffd9a0, hit: { dmg: 20 * p.dmgMult, poise: 40 } });
        for (let i = 0; i < 6; i++) {
          const a = p.yaw + (i / 6) * Math.PI * 2;
          g.effects.bellDrop(p, p.pos.x + Math.sin(a) * 5, p.pos.z + Math.cos(a) * 5, 0.7 + i * 0.1, { radius: 2.4, hit: { dmg: 38 * p.dmgMult, poise: 50, heavy: true } });
        }
      }],
    ],
  },

  // Huntsman's Hatchet: thrown spinning at the foe.
  hatchet_throw: {
    name: 'Hatchet Throw',
    desc: 'Throw the hatchet end over end at your foe; it cuts through the first thing it meets and is back in your hand before you know it.',
    focus: 10, stamina: 12, cooldown: 1.8,
    time: 0.7, track: 0.3, cancel: 0.5,
    keys: [[0, 'rest'], [0.2, 'emberWind'], [0.3, 'emberStrike'], [0.5, 'emberStrike'], [0.7, 'rest']],
    events: [
      [0.3, (p) => {
        const g = p.game;
        const f = front(p, 0.8, 1.3);
        const a = aim(p, f.x, f.y, f.z, 26, 0.3);
        g.projectiles.spawn(p, {
          kind: 'leaf', x: f.x, y: f.y, z: f.z, dirX: a.x, dirY: a.y ?? 0, dirZ: a.z, speed: 26, life: 0.9, radius: 0.55,
          scale: 1.6, color: 0x9a9890, color2: 0xd8d0c0, sound: 'boltHit',
          hit: { dmg: 34 * p.dmgMult, poise: 30 },
        });
        g.audio.play('swing');
      }],
    ],
  },

  // King's Antler: head down and charge, with roots bursting up in your wake.
  antler_rush: {
    name: 'Antler Rush',
    desc: "Lower your head like the Antlered King and charge. Whatever you run into is thrown down, and roots burst out of the ground along the way you came.",
    focus: 18, stamina: 26, cooldown: 4.5,
    time: 1.0, track: 0.2, invuln: [0.18, 0.45], cancel: 0.8,
    keys: [[0, 'rest'], [0.16, 'pierceCrouch'], [0.26, 'pierceDrive'], [0.66, 'pierceDrive'], [1.0, 'rest']],
    events: [
      [0.18, (p, act) => {
        p.game.audio.play('heavySwing');
        act.hit = { dmg: 46 * p.dmgMult, poise: 70, reach: 2.8, arc: 0.8, heavy: true, knock: 6 };
        act.hitSet = new Set();
        act.rootT = 0;
      }],
    ],
    move(p, act, dt) {
      const t = p.t, g = p.game;
      let sp = 0;
      if (act.hit && t < 0.62) {
        sp = 16;
        const lock = g.lockTarget;
        if (lock && Math.hypot(lock.pos.x - p.pos.x, lock.pos.z - p.pos.z) < lock.radius + 1.4) sp = 0;
        g.combat.melee(p, act.hit, act.hitSet);
        if ((act.rootT -= dt) <= 0) {
          act.rootT = 0.12;
          g.effects.iceSpike(p, p.pos.x - p.forwardX * 1.5, p.pos.z - p.forwardZ * 1.5, 0.25, { look: 'root', radius: 1.5, count: 4, hit: { dmg: 18 * p.dmgMult, poise: 24, knock: 3 } });
        }
      }
      p.vel.x = sp ? p.forwardX * sp : p.vel.x * Math.exp(-10 * dt);
      p.vel.z = sp ? p.forwardZ * sp : p.vel.z * Math.exp(-10 * dt);
    },
  },

  // Prism Blade: a lance of hard light.
  prism_lance: {
    name: 'Prism Lance',
    desc: 'Thrust the crystal blade and loose a lance of hard light along it, piercing every foe in a line.',
    focus: 14, stamina: 12, cooldown: 2.6,
    time: 0.8, track: 0.3, cancel: 0.55,
    keys: [[0, 'rest'], [0.18, 'pierceCrouch'], [0.3, 'pierceDrive'], [0.55, 'pierceDrive'], [0.8, 'rest']],
    events: [
      [0.3, (p) => {
        const g = p.game;
        const f = front(p, 1.0, 1.2);
        const a = aim(p, f.x, f.y, f.z, 30, 0.3);
        g.projectiles.spawn(p, {
          kind: 'crystal', x: f.x, y: f.y, z: f.z, dirX: a.x, dirY: a.y ?? 0, dirZ: a.z, speed: 38, life: 0.8, radius: 0.6,
          pierce: true, scale: 2.4, sound: 'boltHit',
          hit: { dmg: 30 * p.dmgMult, poise: 26 },
        });
        g.audio.play('crack');
      }],
    ],
  },

  // Colossus Shard: crystal erupts in a line ahead.
  crystal_rise: {
    name: 'Crystal Rise',
    desc: 'Drive the shard into the ground. Crystal erupts in a line ahead of you, one spike after another, through any guard.',
    focus: 22, stamina: 28, cooldown: 5.5,
    time: 1.35, track: 0.6, cancel: 1.0,
    keys: [[0, 'rest'], [0.4, 'quakeRaise'], [0.62, 'quakeRaise'], [0.74, 'quakeSlam'], [1.08, 'quakeSlam'], [1.35, 'rest']],
    events: [
      [0.3, (p) => p.game.audio.play('heavySwing')],
      [0.74, (p) => {
        const g = p.game;
        const f = front(p, 1.8, 0.8);
        g.combat.sphere(p, f, 2.1, { dmg: 38 * p.dmgMult, poise: 60, heavy: true }, new Set());
        for (let i = 0; i < 7; i++) {
          const k = 3 + i * 2.6;
          g.effects.iceSpike(p, p.pos.x + p.forwardX * k, p.pos.z + p.forwardZ * k, 0.1 + i * 0.08, { look: 'crystal', radius: 1.7, count: 4, hit: { dmg: 30 * p.dmgMult, poise: 34, knock: 3, unblockable: true } });
        }
        g.audio.play('slam');
        g.cameraShake(0.4);
        dust(g, f.x, f.z, 24, 0xc8c0e0, 0xffffff);
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
  flame_breath: {
    name: 'Flame Breath',
    type: 'Fire rite',
    desc: 'Learned from the Sunken Forge\'s cold anvil: breathe out a short, roaring cone of fire. Hold your ground while it burns; everything in front of you catches light.',
    focus: 26, cooldown: 6,
    time: 1.4, keys: [[0, 'rest'], [0.25, 'castThrust'], [1.15, 'castThrust'], [1.4, 'rest']], overlay: true, walk: 0.5, cancel: 1.2,
    events: [[0.2, (p) => p.game.audio.play('breath')]],
    move(p, act, dt) {
      const g = p.game, t = p.t;
      if (t < 0.25 || t > 1.15) return;
      const f = front(p, 0.7, 1.5);
      for (let i = 0; i < 3; i++) {
        const sp = 10 + Math.random() * 4, a = p.yaw + (Math.random() - 0.5) * 0.45;
        g.particles.emit({ x: f.x, y: f.y, z: f.z, count: 1, speed: 0.8, color: 0xff6a1a, color2: 0xffe080, life: [0.3, 0.55], size: [0.2, 0.42], drag: 0.6, jitter: 0.12, dir: { x: Math.sin(a) * sp, y: -0.6, z: Math.cos(a) * sp } });
      }
      act.tick = (act.tick ?? 0) - dt;
      if (act.tick <= 0) {
        act.tick = 0.2;
        g.combat.melee(p, { dmg: 8 * p.riteMult, poise: 6, reach: 6, arc: 0.45, burn: 22, height: 3 }, new Set());
      }
    },
  },
  spore_burst: {
    name: 'Spore Burst',
    type: 'Poison rite',
    desc: "Murk's gift: a puff of the Hollows' spores bursts out from you in a ring and hangs in the air around you. Everything caught in it sickens.",
    focus: 24, cooldown: 8,
    time: 0.9, keys: RAISE, overlay: true, walk: 0.8, cancel: 0.7,
    events: [
      [0.45, (p) => {
        const g = p.game;
        g.effects.shockwave(p, p.pos.x, p.pos.z, { start: 0.6, maxR: 7, speed: 12, color: 0xb070e0, hit: { dmg: 16 * p.riteMult, poise: 20, poison: 50 } });
        g.effects.hazard(p, p.pos.x, p.pos.z, { radius: 4, life: 6, look: 'spore', hit: { dmg: 3 * p.riteMult, poise: 0, poison: 18 } });
        g.audio.play('spore');
      }],
    ],
  },
  sandstorm: {
    name: 'Sandstorm',
    type: 'Wind rite',
    desc: 'Learned at the Oasis of Seven Palms: a whirling wall of sand bursts out from you, scouring and throwing back everything near.',
    focus: 22, cooldown: 7,
    time: 0.9, keys: RAISE, overlay: true, walk: 0.8, cancel: 0.7,
    events: [
      [0.45, (p) => {
        const g = p.game;
        g.effects.shockwave(p, p.pos.x, p.pos.z, { start: 0.6, maxR: 9, speed: 15, color: 0xe8c080, hit: { dmg: 22 * p.riteMult, poise: 45, knock: 9 } });
        g.particles.emit({ x: p.pos.x, y: p.pos.y + 0.8, z: p.pos.z, count: 70, speed: 9, up: 1.5, color: 0xe8c080, color2: 0xc89050, life: [0.4, 1.0], size: [0.12, 0.3], drag: 2, jitter: 1 });
        g.audio.play('spore');
      }],
    ],
  },
  lightning_call: {
    name: 'Call Lightning',
    type: 'Storm rite',
    desc: 'Point at the sky and name your foe: three bolts fall on them one after another, each after a crackling warning. Lock on to aim it.',
    focus: 30, cooldown: 9,
    time: 1.0, keys: RAISE, overlay: true, walk: 0.6, cancel: 0.8,
    events: [
      [0.45, (p) => {
        const g = p.game;
        const f = front(p, 0, 1.5);
        const a = aim(p, f.x, f.y, f.z, 30, 0.5);
        const t = a.target?.pos ?? front(p, 10, 0);
        for (let i = 0; i < 3; i++) {
          g.after(i * 0.35, () => {
            const q = a.target?.alive ? a.target.pos : t;
            g.effects.lightning(p, q.x, q.z, 0.5, { radius: 2.2, hit: { dmg: 34 * p.riteMult, poise: 30, knock: 3 } });
          });
        }
        g.audio.play('cast');
      }],
    ],
  },
  spirit_wolves: {
    name: 'Spirit Wolves',
    type: 'Spirit rite',
    desc: 'Ring the little bone bell and the spirits of three Rime Wolves answer, pale as frost. They run at your side and hunt whatever comes for you, until the bell\'s note fades (45 seconds) or they fall.',
    focus: 45, cooldown: 50,
    time: 1.0, keys: RAISE, overlay: true, walk: 0.8, cancel: 0.8,
    events: [[0.5, (p) => p.game.summonAllies('wolf', 3, 45)]],
  },
  spirit_knight: {
    name: 'Spirit Knight',
    type: 'Spirit rite',
    desc: 'A Dunmarrow Knight\'s oath, still binding: one of the old watch rises at your call, shield up, and fights beside you for a minute.',
    focus: 45, cooldown: 60,
    time: 1.0, keys: RAISE, overlay: true, walk: 0.8, cancel: 0.8,
    events: [[0.5, (p) => p.game.summonAllies('knight', 1, 60)]],
  },
  bramble_snare: {
    name: 'Bramble Snare',
    type: 'Wood rite',
    desc: 'A twist of the Amberwood\'s thorn, burned at one end. Roots erupt from the ground under your foe, then twice more around them. Lock on to aim it.',
    focus: 26, cooldown: 8,
    time: 0.9, keys: RAISE, overlay: true, walk: 0.7, cancel: 0.7,
    events: [
      [0.45, (p) => {
        const g = p.game;
        const f = front(p, 0, 1.5);
        const a = aim(p, f.x, f.y, f.z, 24, 0.5);
        const t = a.target?.pos ?? front(p, 8, 0);
        const hit = { dmg: 30 * p.riteMult, poise: 34, knock: 3 };
        g.effects.iceSpike(p, t.x, t.z, 0.4, { look: 'root', radius: 2.2, hit });
        for (let i = 0; i < 2; i++) {
          const ang = Math.random() * Math.PI * 2;
          g.effects.iceSpike(p, t.x + Math.sin(ang) * 2.6, t.z + Math.cos(ang) * 2.6, 0.7 + i * 0.2, { look: 'root', radius: 1.8, count: 5, hit });
        }
        g.audio.play('cast');
      }],
    ],
  },
  shard_volley: {
    name: 'Shard Volley',
    type: 'Crystal rite',
    desc: 'Learned from the crystal hollows under the Shardlands\' western ridge: five splinters of crystal fly from your hand in a fan.',
    focus: 20, cooldown: 4,
    time: 0.8, keys: CAST, overlay: true, walk: 0.8, cancel: 0.6,
    events: [
      [0.36, (p) => {
        const g = p.game;
        const f = front(p, 0.8, 1.3);
        const a = aim(p, f.x, f.y, f.z, 26, 0.35);
        const base = Math.atan2(a.x, a.z), dy = (a.y ?? 0) / Math.max(1, Math.hypot(a.x, a.z));
        for (let i = -2; i <= 2; i++) {
          const ang = base + i * 0.12;
          g.projectiles.spawn(p, {
            kind: 'crystal', x: f.x, y: f.y, z: f.z, dirX: Math.sin(ang), dirY: dy, dirZ: Math.cos(ang), speed: 30, life: 1.0, radius: 0.4,
            scale: 1.3, sound: 'boltHit', hit: { dmg: 16 * p.riteMult, poise: 12 },
          });
        }
        g.audio.play('crack');
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
