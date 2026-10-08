// Weapons and shields are data. A weapon owns its moveset (timings, reach, damage, poise, stamina),
// how it blocks when there's no shield (`guard`, the same shape as Player.guardStats), its stance
// (models/weapons.js STANCES) and its weapon art (data/abilities.js ARTS).
//
// Move fields: stamina, dmg, poise, windup, active, recover (seconds), lunge (m/s during the swing),
// reach (m) and arc (half-angle, radians) of the hit sector, pose ([wind, strike] in MOVE_POSES),
// next (the move a further light press chains into), heavy (bigger stagger; breaks shield guards), sfx.
// Damage scales with Strength: dmg x (1 + (Strength - 10) x 0.05 x scale).

// Mounted swings are the same for every weapon (Wisp sets the pace, not the blade).
export const MOUNTED = { stamina: 10, dmg: 22, poise: 20, windup: 0.2, active: 0.18, recover: 0.38, reach: 3.2, arc: 1.1, yawOffset: -0.75, height: 3.5, pose: 'mounted', sfx: 'swing' };

export const WEAPONS = {
  wayfarer_blade: {
    name: "Wayfarer's Blade",
    type: 'Straight sword',
    hands: 1,
    stance: 'blade',
    scale: 1,
    desc: 'A plain, honest sword. It has walked further than most pilgrims and never once complained.',
    art: 'ember_arc',
    riposte: { dmg: 24 },
    guard: { name: 'blade', absorb: 0.6, cost: 1.5, parryWindow: 0.2, raiseTime: 0.1, arc: 1.75 },
    moves: {
      light1: { stamina: 14, dmg: 17, poise: 14, windup: 0.16, active: 0.14, recover: 0.36, lunge: 2.6, reach: 2.3, arc: 1.0, pose: 'slashR', next: 'light2', sfx: 'swing' },
      light2: { stamina: 14, dmg: 17, poise: 14, windup: 0.14, active: 0.14, recover: 0.36, lunge: 2.6, reach: 2.3, arc: 1.0, pose: 'slashL', next: 'light3', sfx: 'swing' },
      light3: { stamina: 18, dmg: 24, poise: 22, windup: 0.22, active: 0.12, recover: 0.44, lunge: 3.6, reach: 2.7, arc: 0.5, pose: 'thrust', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 30, dmg: 42, poise: 48, windup: 0.52, active: 0.15, recover: 0.52, lunge: 3.2, reach: 2.6, arc: 0.65, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 14, dmg: 15, poise: 10, windup: 0.1, active: 0.14, recover: 0.36, lunge: 3.0, reach: 2.4, arc: 0.6, pose: 'thrust', next: 'light2', sfx: 'swing' },
    },
  },

  ashen_greatblade: {
    name: 'Ashen Greatblade',
    type: 'Greatsword',
    hands: 2,
    stance: 'great',
    scale: 1.4,
    desc: 'Forged for a watch-captain of the old tower and quenched in the fire that took it. The seam of embers along its spine has never cooled.',
    art: 'quake',
    riposte: { dmg: 32 },
    guard: { name: 'greatblade', absorb: 0.72, cost: 1.25, parryWindow: 0.14, raiseTime: 0.14, arc: 1.75, speed: 2.0 },
    moves: {
      light1: { stamina: 24, dmg: 30, poise: 28, windup: 0.4, active: 0.2, recover: 0.55, lunge: 2.2, reach: 3.1, arc: 1.45, pose: 'gSweepR', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 24, dmg: 30, poise: 28, windup: 0.36, active: 0.2, recover: 0.58, lunge: 2.2, reach: 3.1, arc: 1.45, pose: 'gSweepL', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 38, dmg: 62, poise: 58, windup: 0.8, active: 0.18, recover: 0.72, lunge: 3.0, reach: 3.3, arc: 0.6, pose: 'gOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 20, dmg: 26, poise: 22, windup: 0.18, active: 0.16, recover: 0.5, lunge: 3.4, reach: 3.0, arc: 0.45, pose: 'gThrust', next: 'light2', sfx: 'swing' },
    },
  },

  pilgrim_spear: {
    name: "Pilgrim's Spear",
    type: 'Spear',
    hands: 1,
    stance: 'spear',
    scale: 1,
    desc: 'A walking-spear with a red pilgrim\'s ribbon. Brannoc kept it for the road he never took. Thrusts can be made from behind a raised shield.',
    art: 'lunging_pierce',
    guardAttack: true, // a light press while guarding with a shield thrusts without lowering it
    riposte: { dmg: 26 },
    guard: { name: 'spear', absorb: 0.5, cost: 1.6, parryWindow: 0.16, raiseTime: 0.1, arc: 1.75 },
    moves: {
      light1: { stamina: 12, dmg: 15, poise: 12, windup: 0.18, active: 0.12, recover: 0.32, lunge: 2.2, reach: 3.4, arc: 0.34, pose: 'sThrustHi', next: 'light2', sfx: 'swing' },
      light2: { stamina: 12, dmg: 15, poise: 12, windup: 0.16, active: 0.12, recover: 0.32, lunge: 2.2, reach: 3.4, arc: 0.34, pose: 'sThrustLo', next: 'light3', sfx: 'swing' },
      light3: { stamina: 16, dmg: 19, poise: 18, windup: 0.24, active: 0.16, recover: 0.42, lunge: 2.4, reach: 3.0, arc: 1.05, pose: 'sSweep', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 28, dmg: 36, poise: 38, windup: 0.5, active: 0.14, recover: 0.5, lunge: 5.0, reach: 3.8, arc: 0.3, pose: 'sCharge', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 12, dmg: 16, poise: 10, windup: 0.1, active: 0.12, recover: 0.34, lunge: 3.2, reach: 3.4, arc: 0.34, pose: 'sThrustLo', next: 'light1', sfx: 'swing' },
    },
  },

  twin_fangs: {
    name: 'Twin Fangs',
    type: 'Paired daggers',
    hands: 2,
    stance: 'fangs',
    scale: 0.8,
    desc: 'Two pale daggers ground from one blade, found beside a wreck on the moor. Quick, cheap on the breath, and cruel from behind.',
    art: 'ghoststep',
    riposte: { dmg: 22, crit: 4 },
    guard: { name: 'fangs', absorb: 0.4, cost: 1.7, parryWindow: 0.26, raiseTime: 0.06, arc: 1.6 },
    moves: {
      light1: { stamina: 7, dmg: 9, poise: 7, windup: 0.09, active: 0.1, recover: 0.22, lunge: 2.4, reach: 2.0, arc: 0.85, pose: 'fStabR', next: 'light2', sfx: 'swing' },
      light2: { stamina: 7, dmg: 9, poise: 7, windup: 0.09, active: 0.1, recover: 0.22, lunge: 2.4, reach: 2.0, arc: 0.85, pose: 'fStabL', next: 'light3', sfx: 'swing' },
      light3: { stamina: 7, dmg: 10, poise: 8, windup: 0.09, active: 0.1, recover: 0.22, lunge: 2.4, reach: 2.0, arc: 0.85, pose: 'fStabR', next: 'light4', sfx: 'swing' },
      light4: { stamina: 10, dmg: 14, poise: 14, windup: 0.15, active: 0.12, recover: 0.32, lunge: 3.0, reach: 2.2, arc: 1.2, pose: 'fCross', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 20, dmg: 26, poise: 26, windup: 0.32, active: 0.14, recover: 0.42, lunge: 3.4, reach: 2.2, arc: 0.7, pose: 'fRend', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 7, dmg: 11, poise: 8, windup: 0.07, active: 0.1, recover: 0.24, lunge: 3.4, reach: 2.0, arc: 0.85, pose: 'fStabL', next: 'light3', sfx: 'swing' },
    },
  },

  bell_maul: {
    name: "Warden's Bell-Maul",
    type: 'Great hammer',
    hands: 2,
    stance: 'maul',
    scale: 1.5,
    desc: 'Odran\'s maul, its haft broken and rebound to a size a person can swing. The bell in its head still remembers how to toll.',
    art: 'toll_of_silence',
    riposte: { dmg: 34 },
    guard: { name: 'maul', absorb: 0.7, cost: 1.3, parryWindow: 0.1, raiseTime: 0.1, arc: 1.75, speed: 1.9 },
    moves: {
      light1: { stamina: 30, dmg: 44, poise: 42, windup: 0.58, active: 0.16, recover: 0.68, lunge: 2.4, reach: 2.9, arc: 0.75, pose: 'mOverhead', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 30, dmg: 40, poise: 38, windup: 0.5, active: 0.2, recover: 0.7, lunge: 2.4, reach: 3.0, arc: 1.3, pose: 'mSwing', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 45, dmg: 80, poise: 75, windup: 0.95, active: 0.18, recover: 0.85, lunge: 2.6, reach: 3.0, arc: 0.6, pose: 'mOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 26, dmg: 36, poise: 32, windup: 0.3, active: 0.18, recover: 0.6, lunge: 3.0, reach: 2.9, arc: 1.2, pose: 'mSwing', next: 'light1', sfx: 'heavySwing' },
    },
  },
};

// Shields go in the left hand, only with a one-handed weapon. Their `guard` replaces the weapon's.
// `speed` is the walk speed while guarding (the default is 2.4 m/s). Keep raiseTime <= parryWindow in
// every guard: otherwise a press made just between the two neither parries nor blocks.
export const SHIELDS = {
  pilgrim_buckler: {
    name: "Pilgrim's Buckler",
    type: 'Small shield',
    desc: 'A little round shield of oak and leather, left by the notice board for whoever answers it. It stops most of a blow, and it turns one aside beautifully if you time it.',
    guard: { name: 'buckler', absorb: 0.8, cost: 0.95, parryWindow: 0.24, raiseTime: 0.07, arc: 1.75 },
  },
  gatewarden_greatshield: {
    name: 'Gatewarden Greatshield',
    type: 'Greatshield',
    desc: 'A door of a shield, banded in iron and painted with the Gate\'s bell. Nothing gets past it, but you walk like a wall behind it and it is slow to turn a blade aside.',
    guard: { name: 'greatshield', absorb: 1, cost: 0.6, parryWindow: 0.12, raiseTime: 0.12, arc: 1.95, speed: 1.6 },
  },
};

export const STARTING_WEAPON = 'wayfarer_blade';

// Rough speed label for the equipment screen, from a light swing's full length.
export function speedLabel(w) {
  const m = w.moves.light1;
  const t = m.windup + m.active + m.recover;
  return t < 0.5 ? 'Very fast' : t < 0.75 ? 'Fast' : t < 1.0 ? 'Measured' : t < 1.3 ? 'Slow' : 'Very slow';
}
