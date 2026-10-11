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

  cinder_saber: {
    name: 'Cinder Saber',
    type: 'Curved sword',
    hands: 1,
    stance: 'blade',
    scale: 0.95,
    desc: 'A curved blade taken from the lantern monks, its edge still glowing like a coal. Light in the hand and quick to the next cut.',
    art: 'ember_arc',
    riposte: { dmg: 22 },
    guard: { name: 'saber', absorb: 0.55, cost: 1.55, parryWindow: 0.22, raiseTime: 0.08, arc: 1.75 },
    moves: {
      light1: { stamina: 11, dmg: 14, poise: 10, windup: 0.12, active: 0.13, recover: 0.28, lunge: 2.8, reach: 2.3, arc: 1.15, pose: 'slashR', next: 'light2', sfx: 'swing' },
      light2: { stamina: 11, dmg: 14, poise: 10, windup: 0.11, active: 0.13, recover: 0.28, lunge: 2.8, reach: 2.3, arc: 1.15, pose: 'slashL', next: 'light3', sfx: 'swing' },
      light3: { stamina: 11, dmg: 15, poise: 11, windup: 0.11, active: 0.13, recover: 0.3, lunge: 2.8, reach: 2.3, arc: 1.15, pose: 'slashR', next: 'light4', sfx: 'swing' },
      light4: { stamina: 15, dmg: 22, poise: 18, windup: 0.2, active: 0.12, recover: 0.42, lunge: 3.8, reach: 2.7, arc: 0.5, pose: 'thrust', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 26, dmg: 36, poise: 40, windup: 0.44, active: 0.15, recover: 0.48, lunge: 3.4, reach: 2.6, arc: 0.7, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 11, dmg: 15, poise: 10, windup: 0.08, active: 0.13, recover: 0.3, lunge: 3.4, reach: 2.4, arc: 0.8, pose: 'slashL', next: 'light1', sfx: 'swing' },
    },
  },

  mothers_fang: {
    name: "Mother's Fang",
    type: 'Greatsword',
    hands: 2,
    stance: 'great',
    scale: 1.45,
    desc: 'A fang from the jaw of Vharra, Mother of the Mire, bound to a grip of fen-oak. It is still warm, and the hounds of the Vale will not come near whoever carries it.',
    art: 'mothers_pounce',
    riposte: { dmg: 34 },
    guard: { name: 'fang', absorb: 0.7, cost: 1.3, parryWindow: 0.15, raiseTime: 0.13, arc: 1.75, speed: 2.1 },
    moves: {
      light1: { stamina: 23, dmg: 32, poise: 30, windup: 0.36, active: 0.2, recover: 0.52, lunge: 2.6, reach: 3.2, arc: 1.4, pose: 'gSweepR', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 23, dmg: 32, poise: 30, windup: 0.33, active: 0.2, recover: 0.54, lunge: 2.6, reach: 3.2, arc: 1.4, pose: 'gSweepL', next: 'light3', sfx: 'heavySwing' },
      light3: { stamina: 26, dmg: 40, poise: 40, windup: 0.4, active: 0.18, recover: 0.6, lunge: 4.2, reach: 3.4, arc: 0.45, pose: 'gThrust', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 38, dmg: 66, poise: 62, windup: 0.76, active: 0.18, recover: 0.7, lunge: 3.2, reach: 3.4, arc: 0.6, pose: 'gOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 20, dmg: 28, poise: 24, windup: 0.16, active: 0.16, recover: 0.48, lunge: 3.6, reach: 3.1, arc: 0.45, pose: 'gThrust', next: 'light2', sfx: 'swing' },
    },
  },

  mirewatch_halberd: {
    name: 'Mirewatch Halberd',
    type: 'Halberd',
    hands: 2,
    stance: 'spear',
    scale: 1.25,
    desc: 'The polearm of the lake\'s old watch: an axe-blade, a spike and a hook on a long ash haft. It keeps hounds and worse at a respectful distance.',
    art: 'lunging_pierce',
    riposte: { dmg: 30 },
    guard: { name: 'halberd', absorb: 0.65, cost: 1.35, parryWindow: 0.14, raiseTime: 0.12, arc: 1.75, speed: 2.1 },
    moves: {
      light1: { stamina: 20, dmg: 26, poise: 24, windup: 0.32, active: 0.2, recover: 0.5, lunge: 2.0, reach: 3.9, arc: 1.3, pose: 'sSweep', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 18, dmg: 22, poise: 18, windup: 0.24, active: 0.14, recover: 0.42, lunge: 2.4, reach: 4.0, arc: 0.36, pose: 'sThrustHi', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 34, dmg: 48, poise: 50, windup: 0.62, active: 0.16, recover: 0.6, lunge: 5.0, reach: 4.2, arc: 0.34, pose: 'sCharge', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 18, dmg: 22, poise: 18, windup: 0.16, active: 0.14, recover: 0.44, lunge: 3.2, reach: 3.9, arc: 0.36, pose: 'sThrustLo', next: 'light1', sfx: 'swing' },
    },
  },

  dunmarrow_longsword: {
    name: 'Dunmarrow Longsword',
    type: 'Longsword',
    hands: 1,
    stance: 'blade',
    scale: 1.1,
    desc: 'The sword of a knight of Castle Dunmarrow: long, straight and silver-hilted, the grip still wound in the castle\'s midnight blue. A little slower than a pilgrim\'s blade, and it reaches further.',
    art: 'lunging_pierce',
    riposte: { dmg: 28 },
    guard: { name: 'longsword', absorb: 0.62, cost: 1.45, parryWindow: 0.19, raiseTime: 0.1, arc: 1.75 },
    moves: {
      light1: { stamina: 15, dmg: 21, poise: 17, windup: 0.18, active: 0.15, recover: 0.38, lunge: 2.8, reach: 2.7, arc: 1.0, pose: 'slashR', next: 'light2', sfx: 'swing' },
      light2: { stamina: 15, dmg: 21, poise: 17, windup: 0.16, active: 0.15, recover: 0.38, lunge: 2.8, reach: 2.7, arc: 1.0, pose: 'slashL', next: 'light3', sfx: 'swing' },
      light3: { stamina: 19, dmg: 28, poise: 24, windup: 0.24, active: 0.13, recover: 0.46, lunge: 4.0, reach: 3.1, arc: 0.45, pose: 'thrust', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 32, dmg: 48, poise: 52, windup: 0.54, active: 0.16, recover: 0.54, lunge: 3.4, reach: 3.0, arc: 0.6, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 15, dmg: 18, poise: 12, windup: 0.11, active: 0.14, recover: 0.38, lunge: 3.2, reach: 2.8, arc: 0.6, pose: 'thrust', next: 'light2', sfx: 'swing' },
    },
  },

  icicle_estoc: {
    name: 'Icicle Estoc',
    type: 'Thrusting sword',
    hands: 1,
    stance: 'blade',
    scale: 1.05,
    frost: 14, // every hit builds frostbite
    desc: 'Eskil cut it from the ice under the Hall of the Winter Lantern and it has never thawed. Long and needle-thin; every thrust leaves a little of the cold behind in the wound.',
    art: 'winters_edge',
    riposte: { dmg: 26 },
    guard: { name: 'estoc', absorb: 0.52, cost: 1.6, parryWindow: 0.24, raiseTime: 0.08, arc: 1.75 },
    moves: {
      light1: { stamina: 12, dmg: 16, poise: 10, windup: 0.13, active: 0.12, recover: 0.3, lunge: 3.2, reach: 2.9, arc: 0.4, pose: 'thrust', next: 'light2', sfx: 'swing' },
      light2: { stamina: 12, dmg: 16, poise: 10, windup: 0.12, active: 0.12, recover: 0.3, lunge: 3.2, reach: 2.9, arc: 0.4, pose: 'thrust', next: 'light3', sfx: 'swing' },
      light3: { stamina: 14, dmg: 19, poise: 14, windup: 0.15, active: 0.13, recover: 0.36, lunge: 2.6, reach: 2.5, arc: 0.95, pose: 'slashR', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 28, dmg: 40, poise: 36, windup: 0.46, active: 0.14, recover: 0.5, lunge: 5.0, reach: 3.2, arc: 0.36, pose: 'thrust', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 12, dmg: 16, poise: 10, windup: 0.1, active: 0.12, recover: 0.32, lunge: 3.6, reach: 2.9, arc: 0.4, pose: 'thrust', next: 'light2', sfx: 'swing' },
    },
  },

  rime_glaive: {
    name: 'Rime Glaive',
    type: 'Glaive',
    hands: 2,
    stance: 'spear',
    scale: 1.35,
    frost: 16,
    desc: 'Saelith\'s glaive: a long haft of black iron and a crescent of blue ice that the cold of the Winter Lantern grew around the old steel. Its weapon art throws a lance of that same ice.',
    art: 'glacial_lance',
    riposte: { dmg: 34 },
    guard: { name: 'glaive', absorb: 0.68, cost: 1.3, parryWindow: 0.15, raiseTime: 0.12, arc: 1.75, speed: 2.1 },
    moves: {
      light1: { stamina: 20, dmg: 29, poise: 24, windup: 0.3, active: 0.2, recover: 0.48, lunge: 2.2, reach: 4.0, arc: 1.35, pose: 'sSweep', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 18, dmg: 25, poise: 20, windup: 0.22, active: 0.14, recover: 0.42, lunge: 2.6, reach: 4.1, arc: 0.36, pose: 'sThrustHi', next: 'light3', sfx: 'swing' },
      light3: { stamina: 22, dmg: 31, poise: 28, windup: 0.32, active: 0.2, recover: 0.52, lunge: 2.2, reach: 4.0, arc: 1.35, pose: 'sSweep', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 34, dmg: 54, poise: 54, windup: 0.6, active: 0.16, recover: 0.6, lunge: 5.0, reach: 4.3, arc: 0.36, pose: 'sCharge', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 18, dmg: 24, poise: 18, windup: 0.16, active: 0.14, recover: 0.42, lunge: 3.2, reach: 4.0, arc: 0.36, pose: 'sThrustLo', next: 'light1', sfx: 'swing' },
    },
  },

  trollbone_club: {
    name: 'Trollbone Club',
    type: 'Great club',
    hands: 2,
    stance: 'maul',
    scale: 1.55,
    desc: 'A thighbone from something that lived on the Howling Field before the troll did, knotted with ice and bound in hide. Slow, very slow, and whatever it lands on stays down.',
    art: 'quake',
    riposte: { dmg: 36 },
    guard: { name: 'club', absorb: 0.7, cost: 1.3, parryWindow: 0.1, raiseTime: 0.12, arc: 1.75, speed: 1.9 },
    moves: {
      light1: { stamina: 32, dmg: 48, poise: 50, windup: 0.62, active: 0.18, recover: 0.7, lunge: 2.4, reach: 3.0, arc: 1.3, pose: 'mSwing', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 32, dmg: 46, poise: 48, windup: 0.6, active: 0.16, recover: 0.72, lunge: 2.4, reach: 2.9, arc: 0.75, pose: 'mOverhead', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 48, dmg: 88, poise: 85, windup: 1.0, active: 0.18, recover: 0.9, lunge: 2.6, reach: 3.0, arc: 0.6, pose: 'mOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 28, dmg: 38, poise: 36, windup: 0.32, active: 0.18, recover: 0.62, lunge: 3.0, reach: 2.9, arc: 1.2, pose: 'mSwing', next: 'light1', sfx: 'heavySwing' },
    },
  },

  captains_cleaver: {
    name: "Captain's Cleaver",
    type: 'Heavy blade',
    hands: 1,
    stance: 'blade',
    scale: 1.2,
    desc: 'A broad, square-ended blade that a captain of the old watch carried instead of a sword. It does not cut so much as arrive.',
    art: 'toll_of_silence',
    riposte: { dmg: 30 },
    guard: { name: 'cleaver', absorb: 0.68, cost: 1.35, parryWindow: 0.16, raiseTime: 0.1, arc: 1.75 },
    moves: {
      light1: { stamina: 19, dmg: 25, poise: 26, windup: 0.26, active: 0.15, recover: 0.46, lunge: 2.4, reach: 2.4, arc: 1.05, pose: 'slashR', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 19, dmg: 25, poise: 26, windup: 0.24, active: 0.15, recover: 0.46, lunge: 2.4, reach: 2.4, arc: 1.05, pose: 'slashL', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 34, dmg: 54, poise: 64, windup: 0.62, active: 0.16, recover: 0.6, lunge: 3.0, reach: 2.6, arc: 0.6, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 17, dmg: 22, poise: 22, windup: 0.14, active: 0.15, recover: 0.44, lunge: 3.0, reach: 2.4, arc: 0.7, pose: 'thrust', next: 'light2', sfx: 'heavySwing' },
    },
  },

  // ---------- the outer regions ----------

  ember_flamberge: {
    name: 'Ember Flamberge',
    type: 'Greatsword',
    hands: 2,
    stance: 'great',
    scale: 1.45,
    burn: 12, // every hit builds burning
    desc: 'A wavy-edged greatsword forged in the Sunken Forge and dropped in the Obsidian Field when its bearer burned. The waves in the blade hold heat like coals; a few good blows set a foe alight.',
    art: 'flame_wave',
    riposte: { dmg: 32 },
    guard: { name: 'greatblade', absorb: 0.7, cost: 1.25, parryWindow: 0.14, raiseTime: 0.14, arc: 1.75, speed: 2.0 },
    moves: {
      light1: { stamina: 24, dmg: 29, poise: 26, windup: 0.38, active: 0.2, recover: 0.55, lunge: 2.2, reach: 3.1, arc: 1.45, pose: 'gSweepR', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 24, dmg: 29, poise: 26, windup: 0.34, active: 0.2, recover: 0.58, lunge: 2.2, reach: 3.1, arc: 1.45, pose: 'gSweepL', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 38, dmg: 60, poise: 56, windup: 0.78, active: 0.18, recover: 0.72, lunge: 3.0, reach: 3.3, arc: 0.6, pose: 'gOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 20, dmg: 25, poise: 22, windup: 0.18, active: 0.16, recover: 0.5, lunge: 3.4, reach: 3.0, arc: 0.45, pose: 'gThrust', next: 'light2', sfx: 'swing' },
    },
  },

  ashmaw_fang: {
    name: "Ashmaw's Fang",
    type: 'Colossal sword',
    hands: 2,
    stance: 'great',
    scale: 1.6,
    burn: 18,
    desc: "A fang from the Cinder Drake's jaw, still hot at the root, bound to a haft of black basalt. Slow as a falling tree; its weapon art breathes the drake's own fire.",
    art: 'drake_breath',
    riposte: { dmg: 38 },
    guard: { name: 'greatblade', absorb: 0.76, cost: 1.2, parryWindow: 0.12, raiseTime: 0.14, arc: 1.75, speed: 1.9 },
    moves: {
      light1: { stamina: 30, dmg: 40, poise: 40, windup: 0.5, active: 0.22, recover: 0.64, lunge: 2.4, reach: 3.4, arc: 1.4, pose: 'gSweepR', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 30, dmg: 40, poise: 40, windup: 0.46, active: 0.22, recover: 0.66, lunge: 2.4, reach: 3.4, arc: 1.4, pose: 'gSweepL', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 44, dmg: 78, poise: 75, windup: 0.92, active: 0.18, recover: 0.8, lunge: 3.0, reach: 3.6, arc: 0.6, pose: 'gOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 26, dmg: 32, poise: 30, windup: 0.22, active: 0.18, recover: 0.56, lunge: 3.4, reach: 3.3, arc: 0.45, pose: 'gThrust', next: 'light2', sfx: 'heavySwing' },
    },
  },

  cutlass: {
    name: 'Saltmarrow Cutlass',
    type: 'Curved sword',
    hands: 1,
    stance: 'blade',
    scale: 1,
    desc: 'A short, broad, curved sailor\'s blade with a basket of brass around the grip, green with sea-rot but sharp as the day it was ground. Quick, and its weapon art throws a slash of seawater.',
    art: 'tidecaller',
    riposte: { dmg: 24 },
    guard: { name: 'blade', absorb: 0.58, cost: 1.5, parryWindow: 0.22, raiseTime: 0.09, arc: 1.75 },
    moves: {
      light1: { stamina: 12, dmg: 15, poise: 12, windup: 0.13, active: 0.14, recover: 0.32, lunge: 2.6, reach: 2.2, arc: 1.05, pose: 'slashR', next: 'light2', sfx: 'swing' },
      light2: { stamina: 12, dmg: 15, poise: 12, windup: 0.12, active: 0.14, recover: 0.32, lunge: 2.6, reach: 2.2, arc: 1.05, pose: 'slashL', next: 'light3', sfx: 'swing' },
      light3: { stamina: 14, dmg: 18, poise: 16, windup: 0.14, active: 0.14, recover: 0.36, lunge: 3.0, reach: 2.2, arc: 1.05, pose: 'slashR', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 26, dmg: 38, poise: 40, windup: 0.44, active: 0.15, recover: 0.48, lunge: 3.4, reach: 2.4, arc: 0.7, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 12, dmg: 15, poise: 10, windup: 0.09, active: 0.14, recover: 0.32, lunge: 3.2, reach: 2.3, arc: 0.6, pose: 'thrust', next: 'light2', sfx: 'swing' },
    },
  },

  harpoon: {
    name: 'Lighthouse Harpoon',
    type: 'Spear',
    hands: 1,
    stance: 'spear',
    scale: 1.1,
    desc: 'A whaler\'s harpoon left at the lighthouse door: a long shaft, a barbed iron head, a coil of rotten rope. Thrusts reach a long way, and can be made from behind a raised shield.',
    art: 'lunging_pierce',
    guardAttack: true,
    riposte: { dmg: 28 },
    guard: { name: 'spear', absorb: 0.5, cost: 1.6, parryWindow: 0.18, raiseTime: 0.1, arc: 1.75 },
    moves: {
      light1: { stamina: 15, dmg: 21, poise: 16, windup: 0.2, active: 0.14, recover: 0.4, lunge: 2.6, reach: 3.6, arc: 0.36, pose: 'sThrustHi', next: 'light2', sfx: 'swing' },
      light2: { stamina: 15, dmg: 21, poise: 16, windup: 0.18, active: 0.14, recover: 0.4, lunge: 2.6, reach: 3.6, arc: 0.36, pose: 'sThrustLo', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 30, dmg: 44, poise: 42, windup: 0.52, active: 0.16, recover: 0.56, lunge: 5.2, reach: 3.9, arc: 0.36, pose: 'sCharge', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 15, dmg: 20, poise: 14, windup: 0.14, active: 0.14, recover: 0.4, lunge: 3.4, reach: 3.6, arc: 0.36, pose: 'sThrustLo', next: 'light1', sfx: 'swing' },
    },
  },

  drowned_anchor: {
    name: "Morrow's Anchor",
    type: 'Colossal weapon',
    hands: 2,
    stance: 'maul',
    scale: 1.6,
    desc: "The anchor of Captain Morrow's lost ship. It took the sea a long time to give it back. Swung, it lands like the ship coming down on top of you; its art splits the ground.",
    art: 'quake',
    riposte: { dmg: 40 },
    guard: { name: 'club', absorb: 0.74, cost: 1.25, parryWindow: 0.1, raiseTime: 0.12, arc: 1.75, speed: 1.8 },
    moves: {
      light1: { stamina: 34, dmg: 52, poise: 56, windup: 0.66, active: 0.18, recover: 0.72, lunge: 2.4, reach: 3.2, arc: 1.3, pose: 'mSwing', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 34, dmg: 50, poise: 54, windup: 0.62, active: 0.16, recover: 0.74, lunge: 2.4, reach: 3.1, arc: 0.75, pose: 'mOverhead', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 50, dmg: 95, poise: 92, windup: 1.05, active: 0.18, recover: 0.92, lunge: 2.6, reach: 3.2, arc: 0.6, pose: 'mOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 30, dmg: 40, poise: 40, windup: 0.34, active: 0.18, recover: 0.64, lunge: 3.0, reach: 3.0, arc: 1.2, pose: 'mSwing', next: 'light1', sfx: 'heavySwing' },
    },
  },

  bloom_scythe: {
    name: 'Bloom Scythe',
    type: 'Reaper',
    hands: 2,
    stance: 'spear',
    scale: 1.4,
    poison: 14, // every hit builds poison
    desc: "Sylvara's scythe: a curved blade of living cap-flesh on a staff of grove-wood, still faintly glowing. Every cut leaves spores in the wound; its art sows a cloud of them.",
    art: 'spore_cloud',
    riposte: { dmg: 32 },
    guard: { name: 'glaive', absorb: 0.66, cost: 1.3, parryWindow: 0.15, raiseTime: 0.12, arc: 1.75, speed: 2.1 },
    moves: {
      light1: { stamina: 20, dmg: 27, poise: 22, windup: 0.3, active: 0.2, recover: 0.46, lunge: 2.2, reach: 3.9, arc: 1.4, pose: 'sSweep', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 20, dmg: 27, poise: 22, windup: 0.28, active: 0.2, recover: 0.46, lunge: 2.2, reach: 3.9, arc: 1.4, pose: 'sSweep', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 34, dmg: 52, poise: 50, windup: 0.6, active: 0.18, recover: 0.6, lunge: 4.0, reach: 4.1, arc: 1.0, pose: 'sCharge', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 18, dmg: 23, poise: 18, windup: 0.16, active: 0.16, recover: 0.42, lunge: 3.2, reach: 3.9, arc: 1.2, pose: 'sSweep', next: 'light1', sfx: 'swing' },
    },
  },

  sun_khopesh: {
    name: 'Sun Khopesh',
    type: 'Curved sword',
    hands: 1,
    stance: 'blade',
    scale: 1.05,
    burn: 8,
    desc: 'A hooked bronze blade from the Lost Caravan, its edge still warm from a sun that set centuries ago. Its art flashes a disc of sunlight that burns whatever it cuts.',
    art: 'solar_arc',
    riposte: { dmg: 26 },
    guard: { name: 'blade', absorb: 0.6, cost: 1.5, parryWindow: 0.2, raiseTime: 0.1, arc: 1.75 },
    moves: {
      light1: { stamina: 13, dmg: 17, poise: 13, windup: 0.15, active: 0.14, recover: 0.34, lunge: 2.6, reach: 2.3, arc: 1.05, pose: 'slashR', next: 'light2', sfx: 'swing' },
      light2: { stamina: 13, dmg: 17, poise: 13, windup: 0.13, active: 0.14, recover: 0.34, lunge: 2.6, reach: 2.3, arc: 1.05, pose: 'slashL', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 28, dmg: 42, poise: 44, windup: 0.48, active: 0.15, recover: 0.5, lunge: 3.2, reach: 2.5, arc: 0.7, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 13, dmg: 16, poise: 11, windup: 0.1, active: 0.14, recover: 0.34, lunge: 3.2, reach: 2.4, arc: 0.6, pose: 'thrust', next: 'light2', sfx: 'swing' },
    },
  },

  scarab_horn: {
    name: "Solkar's Horn",
    type: 'Great hammer',
    hands: 2,
    stance: 'maul',
    scale: 1.55,
    desc: "The Sun Scarab's horn on a haft of gilded cedar: a hammer that the Sanctum's priests would have called holy. Each blow lands with the weight of a beetle that once rolled the sun.",
    art: 'quake',
    riposte: { dmg: 38 },
    guard: { name: 'club', absorb: 0.72, cost: 1.25, parryWindow: 0.1, raiseTime: 0.12, arc: 1.75, speed: 1.9 },
    moves: {
      light1: { stamina: 30, dmg: 46, poise: 52, windup: 0.6, active: 0.18, recover: 0.68, lunge: 2.4, reach: 3.0, arc: 1.3, pose: 'mSwing', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 30, dmg: 45, poise: 50, windup: 0.58, active: 0.16, recover: 0.7, lunge: 2.4, reach: 2.9, arc: 0.75, pose: 'mOverhead', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 46, dmg: 86, poise: 85, windup: 0.98, active: 0.18, recover: 0.88, lunge: 2.6, reach: 3.0, arc: 0.6, pose: 'mOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 27, dmg: 36, poise: 36, windup: 0.3, active: 0.18, recover: 0.6, lunge: 3.0, reach: 2.9, arc: 1.2, pose: 'mSwing', next: 'light1', sfx: 'heavySwing' },
    },
  },

  storm_spear: {
    name: 'Spire Spear',
    type: 'Spear',
    hands: 1,
    stance: 'spear',
    scale: 1.05,
    desc: 'A monk-guard\'s spear with a copper-wound haft that hums before a storm. Its art drives the point into the ground and calls a bolt down where it points. Thrusts can be made from behind a raised shield.',
    art: 'thunder_thrust',
    guardAttack: true,
    riposte: { dmg: 27 },
    guard: { name: 'spear', absorb: 0.5, cost: 1.6, parryWindow: 0.18, raiseTime: 0.1, arc: 1.75 },
    moves: {
      light1: { stamina: 14, dmg: 20, poise: 15, windup: 0.18, active: 0.14, recover: 0.38, lunge: 2.6, reach: 3.3, arc: 0.36, pose: 'sThrustHi', next: 'light2', sfx: 'swing' },
      light2: { stamina: 14, dmg: 20, poise: 15, windup: 0.16, active: 0.14, recover: 0.38, lunge: 2.6, reach: 3.3, arc: 0.36, pose: 'sThrustLo', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 30, dmg: 42, poise: 40, windup: 0.5, active: 0.16, recover: 0.54, lunge: 5.0, reach: 3.6, arc: 0.36, pose: 'sCharge', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 14, dmg: 19, poise: 13, windup: 0.13, active: 0.14, recover: 0.38, lunge: 3.4, reach: 3.3, arc: 0.36, pose: 'sThrustLo', next: 'light1', sfx: 'swing' },
    },
  },

  heralds_glaive: {
    name: "Herald's Glaive",
    type: 'Glaive',
    hands: 2,
    stance: 'spear',
    scale: 1.35,
    desc: "Vaelor's spear-glaive, its head a bolt of lightning caught and held. Its art raises it to the sky and brings the storm down in a ring around you.",
    art: 'stormcall',
    riposte: { dmg: 34 },
    guard: { name: 'glaive', absorb: 0.68, cost: 1.3, parryWindow: 0.15, raiseTime: 0.12, arc: 1.75, speed: 2.1 },
    moves: {
      light1: { stamina: 20, dmg: 29, poise: 24, windup: 0.3, active: 0.2, recover: 0.48, lunge: 2.2, reach: 4.0, arc: 1.35, pose: 'sSweep', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 18, dmg: 26, poise: 20, windup: 0.22, active: 0.14, recover: 0.42, lunge: 2.6, reach: 4.1, arc: 0.36, pose: 'sThrustHi', next: 'light3', sfx: 'swing' },
      light3: { stamina: 22, dmg: 31, poise: 28, windup: 0.32, active: 0.2, recover: 0.52, lunge: 2.2, reach: 4.0, arc: 1.35, pose: 'sSweep', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 34, dmg: 55, poise: 54, windup: 0.6, active: 0.16, recover: 0.6, lunge: 5.0, reach: 4.3, arc: 0.36, pose: 'sCharge', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 18, dmg: 25, poise: 18, windup: 0.16, active: 0.14, recover: 0.42, lunge: 3.2, reach: 4.0, arc: 0.36, pose: 'sThrustLo', next: 'light1', sfx: 'swing' },
    },
  },

  ringers_hammer: {
    name: "Ringer's Hammer",
    type: 'Colossal hammer',
    hands: 2,
    stance: 'maul',
    scale: 1.65,
    desc: 'The bell-hammer that rang the Hollow Bell, cut down to a size a person can swing (just). Every blow lands like a toll; its art brings the spectral bells down around you.',
    art: 'bell_toll',
    riposte: { dmg: 42 },
    guard: { name: 'club', absorb: 0.76, cost: 1.2, parryWindow: 0.1, raiseTime: 0.12, arc: 1.75, speed: 1.8 },
    moves: {
      light1: { stamina: 34, dmg: 56, poise: 60, windup: 0.66, active: 0.18, recover: 0.72, lunge: 2.4, reach: 3.2, arc: 1.3, pose: 'mSwing', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 34, dmg: 54, poise: 58, windup: 0.62, active: 0.16, recover: 0.74, lunge: 2.4, reach: 3.1, arc: 0.75, pose: 'mOverhead', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 50, dmg: 100, poise: 95, windup: 1.05, active: 0.18, recover: 0.92, lunge: 2.6, reach: 3.2, arc: 0.6, pose: 'mOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 30, dmg: 42, poise: 42, windup: 0.34, active: 0.18, recover: 0.64, lunge: 3.0, reach: 3.0, arc: 1.2, pose: 'mSwing', next: 'light1', sfx: 'heavySwing' },
    },
  },

  hunters_hatchet: {
    name: "Huntsman's Hatchet",
    type: 'Axe',
    hands: 1,
    stance: 'blade',
    scale: 0.95,
    desc: "Edda's late husband's hatchet, left on the lodge's chopping block with the edge still keen. Quick and light; its art throws it spinning at your foe, and it always seems to come back to your hand.",
    art: 'hatchet_throw',
    riposte: { dmg: 25 },
    guard: { name: 'blade', absorb: 0.55, cost: 1.6, parryWindow: 0.2, raiseTime: 0.1, arc: 1.75 },
    moves: {
      light1: { stamina: 12, dmg: 18, poise: 15, windup: 0.14, active: 0.12, recover: 0.32, lunge: 2.4, reach: 2.1, arc: 0.95, pose: 'slashR', next: 'light2', sfx: 'swing' },
      light2: { stamina: 12, dmg: 18, poise: 15, windup: 0.12, active: 0.12, recover: 0.32, lunge: 2.4, reach: 2.1, arc: 0.95, pose: 'slashL', next: 'light3', sfx: 'swing' },
      light3: { stamina: 16, dmg: 25, poise: 24, windup: 0.22, active: 0.12, recover: 0.4, lunge: 3.0, reach: 2.3, arc: 0.6, pose: 'overhead', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 26, dmg: 44, poise: 46, windup: 0.46, active: 0.14, recover: 0.5, lunge: 3.0, reach: 2.4, arc: 0.6, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 12, dmg: 16, poise: 12, windup: 0.1, active: 0.12, recover: 0.34, lunge: 3.0, reach: 2.2, arc: 0.7, pose: 'slashR', next: 'light2', sfx: 'swing' },
    },
  },

  kings_antler: {
    name: "King's Antler",
    type: 'Greatsword',
    hands: 2,
    stance: 'great',
    scale: 1.5,
    desc: "Hornwood's greatblade, carved from a single antler of the first stag of the wood and bound to a hilt of the old king's gold. Its art lowers your head like the king's and charges, and roots burst up behind you where you run.",
    art: 'antler_rush',
    riposte: { dmg: 34 },
    guard: { name: 'greatblade', absorb: 0.72, cost: 1.2, parryWindow: 0.14, raiseTime: 0.14, arc: 1.75, speed: 2.0 },
    moves: {
      light1: { stamina: 24, dmg: 33, poise: 28, windup: 0.38, active: 0.2, recover: 0.55, lunge: 2.2, reach: 3.3, arc: 1.45, pose: 'gSweepR', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 24, dmg: 33, poise: 28, windup: 0.34, active: 0.2, recover: 0.58, lunge: 2.2, reach: 3.3, arc: 1.45, pose: 'gSweepL', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 38, dmg: 66, poise: 60, windup: 0.78, active: 0.18, recover: 0.72, lunge: 3.0, reach: 3.5, arc: 0.6, pose: 'gOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 20, dmg: 28, poise: 24, windup: 0.18, active: 0.16, recover: 0.5, lunge: 3.4, reach: 3.2, arc: 0.45, pose: 'gThrust', next: 'light2', sfx: 'swing' },
    },
  },

  prism_blade: {
    name: 'Prism Blade',
    type: 'Straight sword',
    hands: 1,
    stance: 'blade',
    scale: 1.05,
    desc: 'A sword of clear crystal that grew around the steel of an older one, found stuck fast in a crystal on the Shardlands road. Light splits into colours along its edge. Its art throws a lance of hard light.',
    art: 'prism_lance',
    riposte: { dmg: 26 },
    guard: { name: 'blade', absorb: 0.62, cost: 1.45, parryWindow: 0.2, raiseTime: 0.1, arc: 1.75 },
    moves: {
      light1: { stamina: 14, dmg: 19, poise: 14, windup: 0.16, active: 0.14, recover: 0.36, lunge: 2.6, reach: 2.4, arc: 1.0, pose: 'slashR', next: 'light2', sfx: 'swing' },
      light2: { stamina: 14, dmg: 19, poise: 14, windup: 0.14, active: 0.14, recover: 0.36, lunge: 2.6, reach: 2.4, arc: 1.0, pose: 'slashL', next: 'light3', sfx: 'swing' },
      light3: { stamina: 18, dmg: 26, poise: 22, windup: 0.22, active: 0.12, recover: 0.44, lunge: 3.6, reach: 2.8, arc: 0.5, pose: 'thrust', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 30, dmg: 45, poise: 48, windup: 0.52, active: 0.15, recover: 0.52, lunge: 3.2, reach: 2.7, arc: 0.65, pose: 'overhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 14, dmg: 17, poise: 10, windup: 0.1, active: 0.14, recover: 0.36, lunge: 3.0, reach: 2.5, arc: 0.6, pose: 'thrust', next: 'light2', sfx: 'swing' },
    },
  },

  colossus_shard: {
    name: 'Colossus Shard',
    type: 'Colossal sword',
    hands: 2,
    stance: 'great',
    scale: 1.65,
    desc: "A splinter of Corundel's arm as long as a person, still faintly lit from inside. Heavy as a gate, and it rings when it lands. Its art drives it into the ground and crystal erupts in a line ahead of you.",
    art: 'crystal_rise',
    riposte: { dmg: 38 },
    guard: { name: 'greatblade', absorb: 0.76, cost: 1.15, parryWindow: 0.12, raiseTime: 0.12, arc: 1.75, speed: 1.9 },
    moves: {
      light1: { stamina: 30, dmg: 44, poise: 44, windup: 0.5, active: 0.2, recover: 0.66, lunge: 2.2, reach: 3.5, arc: 1.45, pose: 'gSweepR', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 30, dmg: 44, poise: 44, windup: 0.46, active: 0.2, recover: 0.68, lunge: 2.2, reach: 3.5, arc: 1.45, pose: 'gSweepL', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 46, dmg: 88, poise: 80, windup: 0.95, active: 0.18, recover: 0.85, lunge: 3.0, reach: 3.7, arc: 0.6, pose: 'gOverhead', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 26, dmg: 36, poise: 34, windup: 0.24, active: 0.16, recover: 0.58, lunge: 3.4, reach: 3.4, arc: 0.45, pose: 'gThrust', next: 'light2', sfx: 'heavySwing' },
    },
  },

  gravedigger_spade: {
    name: "Gravedigger's Spade",
    type: 'Spade',
    hands: 2,
    stance: 'spear',
    scale: 1.2,
    desc: "Dorn's spare spade, left on a catacomb shelf. A long ash haft and an iron blade worn sharp on a hundred years of graves. Its art drives it into the floor and the bones under it come up as spears.",
    art: 'unearth',
    riposte: { dmg: 30 },
    guard: { name: 'glaive', absorb: 0.64, cost: 1.35, parryWindow: 0.15, raiseTime: 0.12, arc: 1.75, speed: 2.1 },
    moves: {
      light1: { stamina: 18, dmg: 25, poise: 22, windup: 0.28, active: 0.18, recover: 0.44, lunge: 2.2, reach: 3.6, arc: 1.3, pose: 'sSweep', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 16, dmg: 23, poise: 18, windup: 0.2, active: 0.14, recover: 0.4, lunge: 2.6, reach: 3.7, arc: 0.36, pose: 'sThrustHi', next: 'light1', sfx: 'swing' },
      heavy: { stamina: 32, dmg: 50, poise: 50, windup: 0.58, active: 0.16, recover: 0.58, lunge: 4.0, reach: 3.9, arc: 0.4, pose: 'sCharge', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 16, dmg: 22, poise: 16, windup: 0.16, active: 0.14, recover: 0.4, lunge: 3.2, reach: 3.6, arc: 0.36, pose: 'sThrustLo', next: 'light1', sfx: 'swing' },
    },
  },

  queens_scythe: {
    name: "Queen's Scythe",
    type: 'Reaper',
    hands: 2,
    stance: 'spear',
    scale: 1.45,
    desc: "Vesperine's scythe: a thighbone haft and an iron blade that still burns faintly green. The dead of the Undercroft remember it; its art calls two of them up to fight beside you for a while.",
    art: 'ossuary_call',
    riposte: { dmg: 34 },
    guard: { name: 'glaive', absorb: 0.68, cost: 1.3, parryWindow: 0.15, raiseTime: 0.12, arc: 1.75, speed: 2.1 },
    moves: {
      light1: { stamina: 20, dmg: 30, poise: 24, windup: 0.3, active: 0.2, recover: 0.46, lunge: 2.2, reach: 4.0, arc: 1.4, pose: 'sSweep', next: 'light2', sfx: 'heavySwing' },
      light2: { stamina: 20, dmg: 30, poise: 24, windup: 0.28, active: 0.2, recover: 0.46, lunge: 2.2, reach: 4.0, arc: 1.4, pose: 'sSweep', next: 'light1', sfx: 'heavySwing' },
      heavy: { stamina: 34, dmg: 58, poise: 52, windup: 0.6, active: 0.18, recover: 0.6, lunge: 4.0, reach: 4.2, arc: 1.0, pose: 'sCharge', heavy: true, sfx: 'heavySwing' },
      rolling: { stamina: 18, dmg: 26, poise: 18, windup: 0.16, active: 0.16, recover: 0.42, lunge: 3.2, reach: 4.0, arc: 1.2, pose: 'sSweep', next: 'light1', sfx: 'swing' },
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
  rimeguard_greatshield: {
    name: 'Rimeguard Greatshield',
    type: 'Greatshield',
    desc: 'A tower shield of blue-grey steel from the old Rime-Watch, rimed white at the edges. Lighter than it looks, and the cold that soaks into it never reaches the arm behind it.',
    guard: { name: 'greatshield', absorb: 1, cost: 0.68, parryWindow: 0.14, raiseTime: 0.1, arc: 1.95, speed: 1.8 },
  },
  sunsteel_shield: {
    name: 'Sunsteel Shield',
    type: 'Medium shield',
    desc: 'A round shield of gilded steel from Tamsin\'s pack, polished bright enough to blind a revenant. It turns aside fire better than any other shield in the Vale.',
    guard: { name: 'shield', absorb: 0.94, cost: 0.8, parryWindow: 0.2, raiseTime: 0.08, arc: 1.8, fireWard: true },
  },
  thornguard: {
    name: 'Thornguard',
    type: 'Medium shield',
    desc: 'A kite shield grown, not made: a shell of hard grey cap-flesh bristling with violet thorns, found under a giant glowcap. Whatever strikes it too hard comes away poisoned.',
    guard: { name: 'shield', absorb: 0.92, cost: 0.85, parryWindow: 0.2, raiseTime: 0.08, arc: 1.8, thorns: 14 },
  },
  oakheart_shield: {
    name: 'Oakheart Shield',
    type: 'Medium shield',
    desc: 'A round shield cut from the heart of a Barkhusk, still sweet with amber sap. It drinks blows like old wood drinks rain, and it barely tires the arm.',
    guard: { name: 'shield', absorb: 0.9, cost: 0.7, parryWindow: 0.2, raiseTime: 0.08, arc: 1.8 },
  },
  glass_aegis: {
    name: 'Glass Aegis',
    type: 'Small shield',
    desc: 'A disc of clear crystal ground smooth by Pell\'s crew. It catches the light, and the eye, and a blow timed just so slides off it as if it had never been aimed.',
    guard: { name: 'buckler', absorb: 0.78, cost: 1.0, parryWindow: 0.3, raiseTime: 0.07, arc: 1.75 },
  },
  bone_ward: {
    name: 'Bone Ward',
    type: 'Medium shield',
    desc: 'A shield of a Gravewarden\'s, cut down from a grave-slab and bound with bone. Heavy for its size and almost nothing gets through it; the dead\'s cold doesn\'t either.',
    guard: { name: 'shield', absorb: 0.96, cost: 0.78, parryWindow: 0.18, raiseTime: 0.09, arc: 1.8 },
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
