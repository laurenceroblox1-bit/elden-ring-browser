// Hand-held gear: weapon and shield models (<= 6 meshes each) and the poses that wield them.
// Weapons are built along the hand's +Z with the grip at the origin, like the old built-in sword.
// Shields hang off the left forearm with their face along +X, so the shield-guard pose turns them forward.
//
// Poses for new weapons are authored as targets instead of raw joint angles: where the right hand should
// be and which way the weapon points, in torso space (+Z forward, +X the character's left, y up from the
// waist). A tiny solver turns that into shoulder/elbow/wrist angles, and for two-handed weapons it closes
// the left hand on the haft, so grips actually meet whatever the swing.
import * as THREE from '../lib/three.js';
import { mat, mesh, box, cyl, cone, ico, group, glowSprite } from './kit.js';
import { pose } from './pose.js';

// ---------- materials ----------

const M = {
  steel: () => mat(0xc9cdd2, { metalness: 0.8, roughness: 0.25 }),
  ashSteel: () => mat(0x8e8a82, { metalness: 0.65, roughness: 0.35 }),
  ember: () => mat(0xff8a3a, { emissive: 0xff5a10, emissiveIntensity: 1.6 }),
  leather: () => mat(0x3b2f25),
  wood: () => mat(0x6b4f33),
  trim: () => mat(0xb08d4a, { metalness: 0.6, roughness: 0.4 }),
  iron: () => mat(0x3a3836, { metalness: 0.55, roughness: 0.5 }),
  bronze: () => mat(0x8c6a3c, { metalness: 0.7, roughness: 0.38 }),
  verdigris: () => mat(0x4f7a6a, { metalness: 0.4, roughness: 0.6 }),
  bone: () => mat(0xd8cfb8),
  fang: () => mat(0xdfe6ee, { metalness: 0.7, roughness: 0.3, emissive: 0x24384a, emissiveIntensity: 0.6 }),
  pilgrimCloth: () => mat(0xb0473a),
  teal: () => mat(0x34504e),
  midnight: () => mat(0x1f2c4a),
  silver: () => mat(0xc9ced6, { metalness: 0.7, roughness: 0.3 }),
  ice: () => mat(0xcfefff, { emissive: 0x3a90d8, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1 }),
  rimeSteel: () => mat(0x6d7c8a, { metalness: 0.6, roughness: 0.4 }),
  basalt: () => mat(0x2c292e, { roughness: 0.8 }),
  brass: () => mat(0x8a7a3a, { metalness: 0.6, roughness: 0.45 }),
  seaRot: () => mat(0x6a8a7a, { metalness: 0.5, roughness: 0.5 }),
  capFlesh: () => mat(0xc8a8d8, { emissive: 0x7a2a8a, emissiveIntensity: 0.5 }),
  sporeGlow: () => mat(0x8ff0dc, { emissive: 0x30c0a0, emissiveIntensity: 1.4 }),
  grove: () => mat(0x3a2a24),
  frostRim: () => mat(0xe8f4fa, { roughness: 0.6 }),
};

// ---------- weapon models ----------

const BUILD = {
  // Wayfarer's Blade: the plain straight sword the Unbound wakes with.
  wayfarer_blade() {
    const g = group();
    g.add(mesh(box(0.045, 0.045, 0.22), M.leather(), { z: -0.02 }));
    g.add(mesh(box(0.07, 0.07, 0.06), M.trim(), { z: -0.15 }));
    g.add(mesh(box(0.26, 0.04, 0.05), M.trim(), { z: 0.1 }));
    g.add(mesh(box(0.065, 0.016, 1.0), M.steel(), { z: 0.62 }));
    return { right: g };
  },
  // Ashen Greatblade: a slab of ash-grey steel with a seam of embers that never cooled.
  ashen_greatblade() {
    const g = group();
    g.add(mesh(box(0.05, 0.05, 0.42), M.leather(), { z: -0.08 }));
    g.add(mesh(box(0.09, 0.09, 0.08), M.iron(), { z: -0.32 }));
    g.add(mesh(box(0.44, 0.06, 0.08), M.iron(), { z: 0.15 }));
    g.add(mesh(box(0.14, 0.028, 1.42), M.ashSteel(), { z: 0.89 }));
    g.add(mesh(box(0.03, 0.034, 1.26), M.ember(), { z: 0.86, shadow: false }));
    const tip = mesh(cone(0.07, 0.22, 4), M.ashSteel(), { z: 1.7, rx: Math.PI / 2, ry: Math.PI / 4 });
    tip.scale.set(1, 1, 0.3);
    g.add(tip);
    return { right: g };
  },
  // Pilgrim's Spear: ash shaft, leaf head, a faded red pilgrim's ribbon.
  pilgrim_spear() {
    const g = group();
    g.add(mesh(cyl(0.024, 0.026, 2.3, 6), M.wood(), { rx: Math.PI / 2, z: 0.45 }));
    g.add(mesh(cyl(0.032, 0.022, 0.07, 6), M.iron(), { rx: Math.PI / 2, z: -0.72 }));
    g.add(mesh(cyl(0.04, 0.04, 0.08, 6), M.trim(), { rx: Math.PI / 2, z: 1.58 }));
    const head = mesh(cone(0.07, 0.38, 4), M.steel(), { rx: Math.PI / 2, z: 1.8 });
    head.scale.set(1, 1, 0.35);
    g.add(head);
    g.add(mesh(box(0.016, 0.22, 0.07), M.pilgrimCloth(), { z: 1.5, y: -0.12, shadow: false }));
    return { right: g };
  },
  // Twin Fangs: two bone-hilted daggers ground from the same pale blade.
  twin_fangs() {
    const fang = () => {
      const g = group();
      g.add(mesh(box(0.04, 0.04, 0.15), M.bone(), { z: -0.01 }));
      g.add(mesh(box(0.13, 0.03, 0.04), M.iron(), { z: 0.08 }));
      const blade = mesh(cone(0.045, 0.46, 4), M.fang(), { rx: Math.PI / 2, z: 0.33 });
      blade.scale.set(1, 1, 0.3);
      g.add(blade);
      return g;
    };
    return { right: fang(), left: fang() };
  },
  // Warden's Bell-Maul: Odran's maul, cut down to a size a person can swing.
  bell_maul() {
    const g = group();
    g.add(mesh(cyl(0.034, 0.04, 1.5, 6), M.iron(), { rx: Math.PI / 2, z: 0.42 }));
    g.add(mesh(cyl(0.046, 0.046, 0.34, 6), M.leather(), { rx: Math.PI / 2, z: -0.05 }));
    const head = group({ z: 1.2 });
    head.add(mesh(cyl(0.13, 0.25, 0.34, 8), M.bronze(), { rz: Math.PI / 2 }));
    head.add(mesh(cyl(0.26, 0.26, 0.04, 8), M.verdigris(), { rz: Math.PI / 2, x: -0.18 }));
    head.add(mesh(cyl(0.05, 0.05, 0.14, 6), M.bronze(), { rz: Math.PI / 2, x: 0.23 }));
    g.add(head);
    return { right: g };
  },
  // Cinder Saber: a curved blade in three angled blocks, its edge glowing like a coal.
  cinder_saber() {
    const g = group();
    g.add(mesh(box(0.045, 0.045, 0.2), M.leather(), { z: -0.02 }));
    g.add(mesh(box(0.06, 0.06, 0.05), M.iron(), { z: -0.14 }));
    g.add(mesh(box(0.18, 0.035, 0.04), M.iron(), { z: 0.09 }));
    g.add(mesh(box(0.06, 0.016, 0.42), M.steel(), { z: 0.32, x: 0 }));
    g.add(mesh(box(0.06, 0.016, 0.36), M.steel(), { z: 0.67, x: -0.035, ry: 0.16 }));
    g.add(mesh(box(0.055, 0.016, 0.26), M.steel(), { z: 0.95, x: -0.1, ry: 0.36 }));
    g.add(mesh(box(0.012, 0.018, 0.62), M.ember(), { z: 0.6, x: 0.03, ry: 0.1, shadow: false }));
    return { right: g };
  },
  // Mirewatch Halberd: long ash haft, an axe-blade on one side, a hook on the other, a spike on top.
  mirewatch_halberd() {
    const g = group();
    g.add(mesh(cyl(0.026, 0.028, 2.5, 6), M.wood(), { rx: Math.PI / 2, z: 0.5 }));
    g.add(mesh(cyl(0.034, 0.024, 0.08, 6), M.iron(), { rx: Math.PI / 2, z: -0.76 }));
    g.add(mesh(box(0.05, 0.06, 0.24), M.iron(), { z: 1.62 }));
    g.add(mesh(box(0.03, 0.34, 0.26), M.ashSteel(), { z: 1.6, y: 0.2 })); // axe-blade
    g.add(mesh(box(0.03, 0.16, 0.06), M.iron(), { z: 1.62, y: -0.12, rx: 0.5 })); // hook
    const spike = mesh(cone(0.05, 0.34, 4), M.steel(), { rx: Math.PI / 2, z: 1.9 });
    spike.scale.set(1, 1, 0.5);
    g.add(spike);
    return { right: g };
  },
  // Captain's Cleaver: a broad square-ended slab with a riveted spine.
  // Mother's Fang: one long curved fang, yellowed, with a dark root bound in leather and a smouldering
  // crack down its length.
  mothers_fang() {
    const g = group();
    g.add(mesh(box(0.06, 0.06, 0.46), M.leather(), { z: -0.1 }));
    g.add(mesh(box(0.1, 0.1, 0.1), M.wood(), { z: -0.36 }));
    g.add(mesh(box(0.2, 0.12, 0.14), M.wood(), { z: 0.16 }));
    const bone = M.bone();
    g.add(mesh(box(0.16, 0.07, 0.5), bone, { z: 0.46 }));
    g.add(mesh(box(0.13, 0.06, 0.46), bone, { z: 0.9, x: 0.02, ry: -0.08 }));
    g.add(mesh(box(0.1, 0.05, 0.36), bone, { z: 1.28, x: 0.06, ry: -0.18 }));
    const tip = mesh(cone(0.05, 0.3, 4), bone, { z: 1.58, x: 0.12, rx: Math.PI / 2, ry: Math.PI / 4 });
    tip.scale.set(1, 1, 0.5);
    g.add(tip);
    g.add(mesh(box(0.02, 0.075, 0.8), M.ember(), { z: 0.8, x: 0.02, ry: -0.1, shadow: false }));
    return { right: g };
  },
  // Dunmarrow Longsword: a long straight blade, silver crossguard, the grip wound in midnight blue.
  dunmarrow_longsword() {
    const g = group();
    g.add(mesh(box(0.045, 0.045, 0.26), M.midnight(), { z: -0.04 }));
    g.add(mesh(box(0.07, 0.07, 0.06), M.silver(), { z: -0.2 }));
    g.add(mesh(box(0.3, 0.04, 0.05), M.silver(), { z: 0.12 }));
    g.add(mesh(box(0.07, 0.018, 1.08), M.steel(), { z: 0.7 }));
    const tip = mesh(cone(0.05, 0.16, 4), M.steel(), { z: 1.3, rx: Math.PI / 2, ry: Math.PI / 4 });
    tip.scale.set(1, 1, 0.3);
    g.add(tip);
    return { right: g };
  },
  // Icicle Estoc: a needle of ice that never thaws, with a guard of frost.
  icicle_estoc() {
    const g = group();
    g.add(mesh(box(0.04, 0.04, 0.22), M.leather(), { z: -0.03 }));
    g.add(mesh(box(0.2, 0.05, 0.06), M.ice(), { z: 0.11 }));
    const blade = mesh(cone(0.04, 1.15, 4), M.ice(), { rx: Math.PI / 2, z: 0.73 });
    blade.scale.set(1, 1, 0.6);
    g.add(blade);
    return { right: g };
  },
  // Rime Glaive: a black iron haft with a crescent of blue ice grown around the old blade.
  rime_glaive() {
    const g = group();
    g.add(mesh(cyl(0.026, 0.03, 2.3, 6), M.iron(), { rx: Math.PI / 2, z: 0.45 }));
    g.add(mesh(cyl(0.04, 0.04, 0.1, 6), M.silver(), { rx: Math.PI / 2, z: 1.55 }));
    g.add(mesh(box(0.035, 0.18, 0.42), M.ice(), { z: 1.82, y: 0.05 }));
    g.add(mesh(box(0.03, 0.14, 0.26), M.ice(), { z: 2.08, y: 0.13, rx: -0.5 }));
    g.add(mesh(box(0.03, 0.1, 0.18), M.ice(), { z: 1.62, y: 0.15, rx: 0.6 }));
    return { right: g };
  },
  // Trollbone Club: a huge thighbone knotted with ice and bound in hide.
  trollbone_club() {
    const g = group();
    g.add(mesh(box(0.08, 0.08, 0.4), M.leather(), { z: -0.02 }));
    g.add(mesh(box(0.1, 0.1, 0.7), M.bone(), { z: 0.5 }));
    g.add(mesh(box(0.2, 0.18, 0.34), M.bone(), { z: 1.0 }));
    g.add(mesh(box(0.16, 0.24, 0.22), M.bone(), { z: 1.18, y: 0.03 }));
    g.add(mesh(box(0.12, 0.08, 0.14), M.ice(), { z: 1.05, y: 0.12, x: 0.06 }));
    g.add(mesh(box(0.08, 0.1, 0.1), M.ice(), { z: 0.86, y: -0.09, x: -0.05 }));
    return { right: g };
  },
  captains_cleaver() {
    const g = group();
    g.add(mesh(box(0.05, 0.05, 0.24), M.leather(), { z: -0.04 }));
    g.add(mesh(box(0.08, 0.08, 0.06), M.iron(), { z: -0.18 }));
    g.add(mesh(box(0.24, 0.05, 0.05), M.iron(), { z: 0.1 }));
    g.add(mesh(box(0.2, 0.022, 0.84), M.ashSteel(), { z: 0.55, x: 0.04 }));
    g.add(mesh(box(0.03, 0.03, 0.82), M.iron(), { z: 0.55, x: -0.07 })); // spine
    for (let i = 0; i < 4; i++) g.add(mesh(box(0.02, 0.03, 0.02), M.trim(), { z: 0.25 + i * 0.2, x: -0.07, y: 0.012 }));
    return { right: g };
  },
  // Ember Flamberge: a long wavy blade (offset segments) with a glowing core.
  ember_flamberge() {
    const g = group();
    g.add(mesh(box(0.05, 0.05, 0.42), M.leather(), { z: -0.08 }));
    g.add(mesh(box(0.42, 0.06, 0.08), M.iron(), { z: 0.15 }));
    for (let i = 0; i < 5; i++) g.add(mesh(box(0.12, 0.026, 0.32), M.ashSteel(), { z: 0.38 + i * 0.28, x: (i % 2 ? 0.025 : -0.025), ry: (i % 2 ? -0.12 : 0.12) }));
    g.add(mesh(box(0.025, 0.032, 1.36), M.ember(), { z: 0.92, shadow: false }));
    return { right: g };
  },
  // Ashmaw's Fang: a huge curved fang on a basalt haft, glowing at the root.
  ashmaw_fang() {
    const g = group();
    g.add(mesh(box(0.07, 0.07, 0.6), M.basalt(), { z: -0.12 }));
    g.add(mesh(box(0.24, 0.16, 0.16), M.basalt(), { z: 0.24 }));
    g.add(mesh(box(0.2, 0.08, 0.7), M.bone(), { z: 0.66 }));
    g.add(mesh(box(0.16, 0.07, 0.6), M.bone(), { z: 1.24, x: 0.04, ry: -0.1 }));
    const tip = mesh(cone(0.08, 0.5, 4), M.bone(), { z: 1.74, x: 0.1, rx: Math.PI / 2, ry: Math.PI / 4 });
    tip.scale.set(1, 1, 0.45);
    g.add(tip);
    g.add(mesh(box(0.03, 0.09, 0.9), M.ember(), { z: 0.75, x: -0.04, shadow: false }));
    return { right: g };
  },
  // Saltmarrow Cutlass: a short curved blade with a brass basket hilt.
  cutlass() {
    const g = group();
    g.add(mesh(box(0.045, 0.045, 0.18), M.leather(), { z: -0.02 }));
    g.add(mesh(box(0.1, 0.12, 0.2), M.brass(), { z: 0.0, x: 0.03 }));
    g.add(mesh(box(0.08, 0.018, 0.4), M.seaRot(), { z: 0.3 }));
    g.add(mesh(box(0.08, 0.018, 0.3), M.seaRot(), { z: 0.62, x: -0.03, ry: 0.15 }));
    g.add(mesh(box(0.07, 0.018, 0.2), M.seaRot(), { z: 0.82, x: -0.08, ry: 0.4 }));
    return { right: g };
  },
  // Lighthouse Harpoon: a long shaft, a barbed iron head, a coil of rope.
  harpoon() {
    const g = group();
    g.add(mesh(cyl(0.026, 0.028, 2.4, 6), M.wood(), { rx: Math.PI / 2, z: 0.5 }));
    g.add(mesh(cyl(0.06, 0.06, 0.12, 6), M.leather(), { rx: Math.PI / 2, z: 0.0 }));
    const head = mesh(cone(0.07, 0.34, 4), M.iron(), { rx: Math.PI / 2, z: 1.85 });
    g.add(head);
    g.add(mesh(box(0.02, 0.02, 0.16), M.iron(), { x: 0.06, z: 1.68, ry: 0.5 }));
    g.add(mesh(box(0.02, 0.02, 0.16), M.iron(), { x: -0.06, z: 1.68, ry: -0.5 }));
    return { right: g };
  },
  // Morrow's Anchor: the ship's anchor, shank up the hands, flukes at the far end.
  drowned_anchor() {
    const g = group();
    g.add(mesh(box(0.09, 0.09, 1.4), M.iron(), { z: 0.5 }));
    g.add(mesh(box(0.06, 0.06, 0.3), M.leather(), { z: -0.1 }));
    g.add(mesh(box(0.7, 0.09, 0.09), M.iron(), { z: 1.18 }));
    g.add(mesh(box(0.09, 0.09, 0.3), M.iron(), { x: 0.36, z: 1.05, ry: 0.4 }));
    g.add(mesh(box(0.09, 0.09, 0.3), M.iron(), { x: -0.36, z: 1.05, ry: -0.4 }));
    g.add(mesh(box(0.36, 0.07, 0.07), M.seaRot(), { z: 0.15 }));
    return { right: g };
  },
  // Bloom Scythe: a glowing curved blade of cap-flesh on a grove-wood staff.
  bloom_scythe() {
    const g = group();
    g.add(mesh(cyl(0.026, 0.03, 2.2, 6), M.grove(), { rx: Math.PI / 2, z: 0.4 }));
    g.add(mesh(box(0.05, 0.08, 0.1), M.grove(), { z: 1.5 }));
    g.add(mesh(box(0.03, 0.12, 0.5), M.capFlesh(), { z: 1.5, y: 0.25, x: 0.0, rx: 1.2 }));
    g.add(mesh(box(0.03, 0.1, 0.4), M.capFlesh(), { z: 1.3, y: 0.55, rx: 2.0 }));
    g.add(mesh(box(0.02, 0.03, 0.4), M.sporeGlow(), { z: 1.44, y: 0.34, rx: 1.4, shadow: false }));
    return { right: g };
  },
};

const BUILD_SHIELD = {
  // Thornguard: a kite shield of grey cap-flesh bristling with violet thorns.
  thornguard() {
    const g = group({ x: 0.09, y: -0.15 });
    g.add(mesh(box(0.05, 0.7, 0.46), mat(0x6a6070)));
    g.add(mesh(cone(0.23, 0.3, 4), mat(0x6a6070), { y: -0.5, rx: Math.PI }));
    for (const [y, z] of [[0.2, 0.12], [0.2, -0.12], [-0.05, 0], [-0.25, 0.1], [-0.25, -0.1]]) g.add(mesh(cone(0.04, 0.16, 4), M.capFlesh(), { x: 0.08, y, z, rz: -Math.PI / 2 }));
    return g;
  },
  // Pilgrim's Buckler: a small round shield, light enough to turn a blade aside at the last moment.
  pilgrim_buckler() {
    const g = group({ x: 0.08, y: -0.17 });
    g.add(mesh(cyl(0.25, 0.25, 0.03, 10), M.leather(), { rz: Math.PI / 2, x: -0.012 }));
    g.add(mesh(cyl(0.23, 0.23, 0.04, 10), M.wood(), { rz: Math.PI / 2 }));
    g.add(mesh(cone(0.08, 0.09, 8), M.trim(), { rz: -Math.PI / 2, x: 0.06 }));
    return g;
  },
  // Rimeguard Greatshield: a blue-grey tower shield, rimed white at the edges, an ice-crystal boss.
  rimeguard_greatshield() {
    const g = group({ x: 0.09, y: -0.12 });
    g.add(mesh(box(0.05, 0.98, 0.58), M.rimeSteel()));
    g.add(mesh(box(0.07, 0.06, 0.62), M.frostRim(), { y: 0.47 }));
    g.add(mesh(box(0.07, 0.06, 0.62), M.frostRim(), { y: -0.47 }));
    g.add(mesh(box(0.065, 0.98, 0.05), M.frostRim(), { z: 0.28 }));
    g.add(mesh(box(0.065, 0.98, 0.05), M.frostRim(), { z: -0.28 }));
    const boss = mesh(cone(0.1, 0.24, 4), M.ice(), { rz: -Math.PI / 2, x: 0.08 });
    g.add(boss);
    return g;
  },
  // Gatewarden Greatshield: a tall iron-banded door of a shield with the Gate's bell on its face.
  gatewarden_greatshield() {
    const g = group({ x: 0.09, y: -0.12 });
    g.add(mesh(box(0.05, 1.0, 0.62), M.teal()));
    g.add(mesh(box(0.07, 0.08, 0.66), M.iron(), { y: 0.46 }));
    g.add(mesh(box(0.07, 0.08, 0.66), M.iron(), { y: -0.46 }));
    g.add(mesh(box(0.065, 0.9, 0.08), M.iron()));
    g.add(mesh(cone(0.12, 0.2, 6), M.bronze(), { rz: -Math.PI / 2, x: 0.08, y: 0.08 }));
    return g;
  },
};

export const hasModel = (id) => !!(BUILD[id] || BUILD_SHIELD[id]);

// Puts weapon `weaponId` in the rig's hands and shield `shieldId` (or none) on the left forearm.
// Built models are cached on the rig, so swapping back and forth allocates nothing new.
export function equipModel(r, weaponId, shieldId) {
  const g = (r.gear ??= { cache: new Map(), parts: [] });
  for (const o of g.parts) o.parent?.remove(o);
  g.parts.length = 0;
  const get = (key, make) => {
    if (!g.cache.has(key)) g.cache.set(key, make());
    return g.cache.get(key);
  };
  const w = get(weaponId, () => BUILD[weaponId]());
  r.armR.hand.add(w.right);
  g.parts.push(w.right);
  if (w.left) {
    r.armL.hand.add(w.left);
    g.parts.push(w.left);
  }
  if (shieldId) {
    const s = get(shieldId, () => BUILD_SHIELD[shieldId]());
    r.armL.elbow.add(s);
    g.parts.push(s);
  }
  r.sword = w.right; // older code calls the right-hand weapon "sword"
  g.weapon = weaponId;
  g.shield = shieldId;
}

// A copy of a piece of gear for showing in the world (pickups): upright, centred on its middle.
export function buildGearDisplay(id) {
  const g = group();
  if (BUILD[id]) {
    const w = BUILD[id]();
    const stand = group({ rx: -Math.PI / 2 });
    w.right.position.x = w.left ? -0.12 : 0;
    stand.add(w.right);
    if (w.left) {
      w.left.position.x = 0.12;
      stand.add(w.left);
    }
    const len = new THREE.Box3().setFromObject(stand).getSize(new THREE.Vector3()).y;
    stand.position.y = -len * 0.25;
    g.add(stand);
  } else if (BUILD_SHIELD[id]) {
    const s = BUILD_SHIELD[id]();
    s.position.set(0, 0, 0);
    s.rotation.y = Math.PI / 2;
    g.add(s);
  } else {
    // Rites: a little lantern-charm of light.
    g.add(mesh(ico(0.13, 0), mat(0xfff0c8, { emissive: 0xffb050, emissiveIntensity: 2.4 }), { shadow: false }));
    g.add(mesh(box(0.03, 0.34, 0.03), M.trim(), { y: 0.0, rz: 0.6, shadow: false }));
    g.add(glowSprite(0xffc070, 0.9, 0.8));
  }
  return g;
}

// ---------- pose solving ----------

const rotX = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const rotY = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const rotZ = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const mv = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const tv = (m, v) => [0, 1, 2].map((j) => m[0][j] * v[0] + m[1][j] * v[1] + m[2][j] * v[2]); // transpose(m) * v
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

// Forward kinematics of one arm in torso space, matching models/humanoid.js (player proportions).
// side -1 is the right arm. Shoulders use Euler YXZ, hands XYZ.
const SHOULDER_X = 0.34, SHOULDER_Y = 0.52, UPPER = 0.32, FORE = 0.32;
function armFK(side, sx, sy, sz, e) {
  const S = mm(mm(rotY(sy), rotX(sx)), rotZ(sz));
  const E = mm(S, rotX(e));
  const a = mv(S, [0, -UPPER, 0]), b = mv(E, [0, -FORE, 0]);
  return { hand: [side * SHOULDER_X + a[0] + b[0], SHOULDER_Y + a[1] + b[1], a[2] + b[2]], frame: E };
}

// How far each solved hand ended up from its target (metres), for tuning poses that ask too much of an arm.
export const POSE_MISS = [];
const miss = (h, at) => Math.hypot(h[0] - at[0], h[1] - at[1], h[2] - at[2]);

// Shoulder and elbow angles that put the hand at `at`, staying close to `hint` (so the elbow bends naturally).
function reach(side, at, hint, sz) {
  let p = [...hint];
  const cost = (q) => {
    const h = armFK(side, q[0], q[1], sz, q[2]).hand;
    return (h[0] - at[0]) ** 2 + (h[1] - at[1]) ** 2 + (h[2] - at[2]) ** 2
      + 0.0015 * ((q[0] - hint[0]) ** 2 + (q[1] - hint[1]) ** 2 + (q[2] - hint[2]) ** 2);
  };
  let best = cost(p), step = 0.4;
  while (step > 0.0008) {
    let moved = false;
    for (let k = 0; k < 3; k++) {
      for (const s of [step, -step]) {
        const q = [...p];
        q[k] += s;
        if (k === 2) q[2] = Math.min(0, Math.max(-2.7, q[2]));
        const c = cost(q);
        if (c < best) { best = c; p = q; moved = true; }
      }
    }
    if (!moved) step *= 0.5;
  }
  return p;
}

// Wrist angles (Euler XYZ) that point the hand's +Z along `dir`, given the forearm frame.
function wrist(frame, dir) {
  const v = tv(frame, norm(dir));
  const hy = Math.asin(Math.max(-1, Math.min(1, v[0])));
  return [Math.atan2(-v[1], v[2]), hy];
}

const R_HINT = [-0.7, 0.3, -1.1];
const L_HINT = [-0.7, -0.3, -1.1];

// Builds a pose from hand targets. spec:
//   R: { at, dir, hint?, roll? }          right hand position + weapon direction (torso space)
//   L: { at, dir, hint? } | { grip: d }   left hand target, or close it on the weapon `d` metres along it
//   body: other joint angles (torso, legs, hips) as in pose()
export function held(spec, body = {}) {
  const p = pose(body);
  const sRz = body.sRz ?? -0.08, sLz = body.sLz ?? 0.08;
  const r = reach(-1, spec.R.at, spec.R.hint ?? R_HINT, sRz);
  const rf = armFK(-1, r[0], r[1], sRz, r[2]);
  POSE_MISS.push(['R', miss(rf.hand, spec.R.at)]);
  const [hx, hy] = wrist(rf.frame, spec.R.dir);
  Object.assign(p, { sRx: r[0], sRy: r[1], eR: r[2], hRx: hx, hRy: hy, hRz: spec.R.roll ?? 0 });
  let L = spec.L;
  if (L?.grip !== undefined) {
    const d = norm(spec.R.dir);
    L = { at: [rf.hand[0] + d[0] * L.grip, rf.hand[1] + d[1] * L.grip, rf.hand[2] + d[2] * L.grip], dir: spec.R.dir, hint: L.hint };
  }
  if (L) {
    const l = reach(1, L.at, L.hint ?? L_HINT, sLz);
    const lf = armFK(1, l[0], l[1], sLz, l[2]);
    POSE_MISS.push(['L', miss(lf.hand, L.at)]);
    const [lx, ly] = wrist(lf.frame, L.dir ?? [0, 0, 1]);
    Object.assign(p, { sLx: l[0], sLy: l[1], eL: l[2], hLx: lx, hLy: ly, hLz: 0 });
  }
  return p;
}

// Left-arm joints, for overlaying a shield guard or a casting hand on another pose.
export const ARM_L = ['sLx', 'sLy', 'sLz', 'eL', 'hLx', 'hLy', 'hLz'];
export function overlay(base, top, joints) {
  const p = { ...base };
  for (const j of joints) p[j] = top[j];
  return p;
}

// ---------- stances (rest / guard / sprint per weapon class) ----------

const LEGS_BRACE = { lRx: 0.25, lLx: -0.35, kL: 0.35, kR: 0.15, hipsH: -0.06 };
const LEGS_LUNGE = { lRx: -0.6, kR: 0.4, lLx: 0.4, kL: 0.1, hipsH: -0.1 };
const LEFT_FREE = { sLx: 0.05, eL: -0.25 };

const blade = {
  rest: pose({ sRx: -0.2, eR: -0.55, hRx: 1.1, ...LEFT_FREE }),
  guard: pose({ sRx: -0.9, sRy: 0.7, eR: -1.3, hRx: 1.0, hRy: -0.5, sLx: -0.9, sLy: -0.3, eL: -1.1, torsoY: -0.25, torsoX: 0.08, headX: -0.05, ...LEGS_BRACE }),
  sprint: pose({ torsoX: 0.28, headX: -0.2, sRx: 0.2, eR: -0.4, hRx: 1.4, sLx: 0.1, eL: -0.6 }),
};

export const STANCES = {
  blade,
  great: {
    rest: held({ R: { at: [-0.02, 0.14, 0.36], dir: [0.12, 0.62, 0.78] }, L: { grip: -0.17 } }, { torsoY: -0.12, lRx: 0.12, lLx: -0.18, kL: 0.12 }),
    guard: held({ R: { at: [-0.24, 0.4, 0.36], dir: [0.96, 0.22, 0.12] }, L: { grip: 0.5 } }, { torsoX: 0.08, headX: -0.05, ...LEGS_BRACE }),
    sprint: held({ R: { at: [-0.42, -0.02, 0.0], dir: [-0.1, -0.4, -0.9] } }, { torsoX: 0.3, headX: -0.2, sLx: 0.2, eL: -0.6 }),
  },
  spear: {
    rest: held({ R: { at: [-0.32, 0.04, 0.24], dir: [0.07, 0.14, 0.99] } }, { sLx: -0.25, eL: -0.55 }),
    guard: held({ R: { at: [-0.22, 0.36, 0.34], dir: [0.45, 0.85, 0.25] }, L: { grip: 0.32 } }, { torsoY: -0.2, torsoX: 0.06, ...LEGS_BRACE }),
    sprint: held({ R: { at: [-0.4, 0.02, 0.05], dir: [0, 0.35, -0.94] } }, { torsoX: 0.28, headX: -0.2, sLx: 0.15, eL: -0.6 }),
  },
  fangs: {
    rest: held({ R: { at: [-0.3, 0.06, 0.28], dir: [0.1, 0.15, 0.98] }, L: { at: [0.3, 0.06, 0.28], dir: [-0.1, 0.15, 0.98] } }, { torsoX: 0.12, hipsH: -0.04, kL: 0.12, kR: 0.12 }),
    guard: held({ R: { at: [-0.06, 0.44, 0.38], dir: [0.72, 0.62, 0.22] }, L: { at: [0.06, 0.4, 0.4], dir: [-0.72, 0.62, 0.22] } }, { torsoX: 0.12, headX: -0.08, ...LEGS_BRACE }),
    sprint: held({ R: { at: [-0.38, 0.0, -0.05], dir: [0, -0.3, 0.95] }, L: { at: [0.38, 0.0, -0.05], dir: [0, -0.3, 0.95] } }, { torsoX: 0.36, headX: -0.25 }),
  },
  maul: {
    rest: held({ R: { at: [0.0, 0.28, 0.32], dir: [-0.2, 0.9, -0.38] }, L: { grip: -0.22 } }, { torsoY: -0.1 }),
    guard: held({ R: { at: [-0.3, 0.4, 0.36], dir: [0.98, 0.18, 0.05] }, L: { grip: 0.52 } }, { torsoX: 0.08, ...LEGS_BRACE }),
    sprint: held({ R: { at: [-0.36, 0.1, 0.08], dir: [-0.1, 0.7, -0.7] } }, { torsoX: 0.3, headX: -0.2, sLx: 0.2, eL: -0.6 }),
  },
};

// Shield raised across the chest, its face turned forward; and its flinch when a blow lands.
export const SHIELD_GUARD = pose({ sLx: -1.2, sLy: -1.1, eL: -1.0 });
export const SHIELD_HIT = pose({ sLx: -1.0, sLy: -1.1, eL: -1.15 });

// The flinch of a guard taking a blow: lean back, knees give.
export function guardHitOf(g) {
  return { ...g, torsoX: g.torsoX - 0.22, headX: g.headX - 0.1, hipsH: g.hipsH - 0.04, lRx: g.lRx + 0.2, kL: g.kL + 0.1 };
}

// ---------- move poses: [wind, strike] pairs, or single poses used as keys ----------

const TWIST_R = { torsoY: -1.0, hipsY: -0.2, torsoX: 0.05 };
const TWIST_L = { torsoY: 0.92, hipsY: 0.2, torsoX: 0.15, hipsH: -0.1 };
const g2 = (R, body) => held({ R, L: { grip: -0.17 } }, body);
const m2 = (R, body) => held({ R, L: { grip: -0.26 } }, body);
const fangs = (R, L, body) => held({ R, L }, body);

export const MOVE_POSES = {
  // Wayfarer's Blade (the original sword set)
  slashR: [pose({ sRx: -1.35, sRy: -1.4, eR: -0.25, hRx: 1.3, torsoY: -0.6, sLx: -0.3, eL: -0.5 }),
    pose({ sRx: -1.3, sRy: 1.0, eR: -0.1, hRx: 1.3, torsoY: 0.6, torsoX: 0.1, sLx: 0.2 })],
  slashL: [pose({ sRx: -1.3, sRy: 1.1, eR: -0.3, hRx: 1.3, torsoY: 0.55, sLx: 0.2 }),
    pose({ sRx: -1.3, sRy: -1.3, eR: -0.1, hRx: 1.3, torsoY: -0.55, torsoX: 0.1, sLx: -0.3 })],
  thrust: [pose({ sRx: -0.5, sRy: -0.2, eR: -1.5, hRx: 1.9, torsoY: -0.45, lRx: 0.3, lLx: -0.4, kL: 0.3 }),
    pose({ sRx: -1.5, eR: 0, hRx: 1.5, torsoY: 0.25, torsoX: 0.18, lRx: -0.5, kR: 0.3, lLx: 0.4, hipsH: -0.08 })],
  overhead: [pose({ sRx: -2.9, eR: -0.6, hRx: 1.0, sLx: -2.6, eL: -0.6, torsoX: -0.22, torsoY: -0.15 }),
    pose({ sRx: -0.7, eR: -0.1, hRx: 1.0, sLx: -0.7, eL: -0.2, torsoX: 0.45, hipsH: -0.14, lRx: -0.6, kR: 0.5, lLx: 0.3 })],
  // Art: Ember Arc, a wide burning sweep
  emberWind: held({ R: { at: [-0.56, 0.42, -0.12], dir: [-0.62, 0.22, -0.75] } }, { torsoY: -1.05, hipsY: -0.2, sLx: -0.5, sLy: -0.4, eL: -0.6, ...LEGS_BRACE }),
  emberStrike: held({ R: { at: [0.12, 0.4, 0.42], dir: [0.92, 0.05, 0.38] } }, { torsoY: 0.95, hipsY: 0.25, torsoX: 0.12, sLx: 0.3, sLz: 0.5, ...LEGS_LUNGE }),

  // Ashen Greatblade: two-handed, the sweep comes from the hips
  gSweepR: [g2({ at: [-0.3, 0.36, 0.26], dir: [-0.78, 0.25, -0.57] }, TWIST_R),
    g2({ at: [0.06, 0.24, 0.42], dir: [0.86, -0.06, 0.5] }, { ...TWIST_L, ...LEGS_LUNGE })],
  gSweepL: [g2({ at: [0.08, 0.4, 0.3], dir: [0.8, 0.28, -0.52] }, TWIST_L),
    g2({ at: [-0.28, 0.16, 0.44], dir: [-0.86, -0.06, 0.5] }, { ...TWIST_R, ...LEGS_LUNGE })],
  gOverhead: [g2({ at: [-0.08, 0.98, 0.06], dir: [0, 0.35, -0.94] }, { torsoX: -0.25, headX: -0.2 }),
    g2({ at: [-0.12, 0.12, 0.45], dir: [0, -0.5, 0.86] }, { torsoX: 0.45, hipsH: -0.16, lRx: -0.6, kR: 0.5, lLx: 0.3 })],
  gThrust: [g2({ at: [-0.2, 0.24, 0.08], dir: [0.05, 0.02, 1] }, { torsoY: -0.4, ...LEGS_BRACE }),
    g2({ at: [-0.14, 0.26, 0.54], dir: [0, -0.06, 1] }, { torsoY: 0.2, torsoX: 0.2, ...LEGS_LUNGE })],
  // Art: Quake
  quakeRaise: g2({ at: [-0.06, 1.04, 0.14], dir: [0, 0.98, -0.2] }, { torsoX: -0.3, headX: -0.25, hipsH: 0.02 }),
  quakeSlam: g2({ at: [-0.14, 0.1, 0.44], dir: [0, -0.8, 0.6] }, { torsoX: 0.72, headX: -0.3, hipsH: -0.38, lRx: -0.7, kR: 0.9, lLx: 0.4, kL: 0.7 }),

  // Pilgrim's Spear: one hand on the shaft, thrusts from the shoulder
  sThrustHi: [held({ R: { at: [-0.36, 0.3, -0.16], dir: [0.06, 0.02, 1] } }, { torsoY: -0.4, sLx: -0.4, eL: -0.7, ...LEGS_BRACE }),
    held({ R: { at: [-0.2, 0.28, 0.56], dir: [0.04, -0.05, 1] } }, { torsoY: 0.28, torsoX: 0.15, sLx: 0.1, eL: -0.6, ...LEGS_LUNGE })],
  sThrustLo: [held({ R: { at: [-0.36, -0.02, -0.12], dir: [0.06, 0.12, 1] } }, { torsoY: -0.35, sLx: -0.4, eL: -0.7, ...LEGS_BRACE }),
    held({ R: { at: [-0.2, 0.15, 0.5], dir: [0.02, -0.04, 1] } }, { torsoY: 0.3, torsoX: 0.25, sLx: 0.1, eL: -0.6, ...LEGS_LUNGE })],
  sSweep: [held({ R: { at: [-0.5, 0.3, 0.18], dir: [-0.72, 0.08, 0.68] } }, { torsoY: -0.8, sLx: -0.3, eL: -0.6 }),
    held({ R: { at: [0.0, 0.3, 0.5], dir: [0.82, 0.0, 0.58] } }, { torsoY: 0.6, torsoX: 0.1, sLx: 0.2, eL: -0.5, ...LEGS_LUNGE })],
  sCharge: [held({ R: { at: [-0.4, 0.42, -0.24], dir: [0.05, -0.05, 1] } }, { torsoY: -0.62, torsoX: -0.05, hipsH: -0.14, sLx: -0.8, eL: -0.6, lRx: 0.45, lLx: -0.5, kL: 0.5 }),
    held({ R: { at: [-0.16, 0.34, 0.56], dir: [0, -0.1, 1] } }, { torsoY: 0.4, torsoX: 0.3, sLx: 0.4, eL: -0.3, lRx: -0.85, kR: 0.7, lLx: 0.6, kL: 0.2, hipsH: -0.2 })],
  // Art: Lunging Pierce
  pierceCrouch: held({ R: { at: [-0.42, 0.3, -0.2], dir: [0.04, 0, 1] } }, { torsoX: 0.35, torsoY: -0.4, hipsH: -0.28, sLx: -0.9, eL: -0.5, lRx: -0.4, kR: 0.9, lLx: 0.3, kL: 0.8 }),
  pierceDrive: held({ R: { at: [-0.16, 0.3, 0.56], dir: [0, -0.04, 1] } }, { torsoX: 0.4, torsoY: 0.35, sLx: 0.5, eL: -0.2, lRx: -0.95, kR: 0.6, lLx: 0.75, kL: 0.15, hipsH: -0.22 }),

  // Twin Fangs: alternating stabs, then a crossing rend
  fStabR: [fangs({ at: [-0.36, 0.2, -0.06], dir: [0.1, 0, 1] }, { at: [0.28, 0.16, 0.3], dir: [-0.1, 0.2, 0.97] }, { torsoY: -0.35, ...LEGS_BRACE }),
    fangs({ at: [-0.14, 0.24, 0.54], dir: [0.06, 0, 1] }, { at: [0.32, 0.04, 0.1], dir: [-0.1, 0.1, 0.99] }, { torsoY: 0.35, torsoX: 0.12, ...LEGS_LUNGE })],
  fStabL: [fangs({ at: [-0.28, 0.16, 0.3], dir: [0.1, 0.2, 0.97] }, { at: [0.36, 0.2, -0.06], dir: [-0.1, 0, 1] }, { torsoY: 0.35, lLx: 0.25, lRx: -0.35, kR: 0.35, hipsH: -0.06 }),
    fangs({ at: [-0.32, 0.04, 0.1], dir: [0.1, 0.1, 0.99] }, { at: [0.14, 0.24, 0.54], dir: [-0.06, 0, 1] }, { torsoY: -0.35, torsoX: 0.12, lLx: -0.6, kL: 0.4, lRx: 0.4, hipsH: -0.1 })],
  fCross: [fangs({ at: [-0.46, 0.58, 0.14], dir: [0.3, 0.35, 0.89] }, { at: [0.46, 0.58, 0.14], dir: [-0.3, 0.35, 0.89] }, { torsoX: -0.12, headX: -0.1 }),
    fangs({ at: [-0.02, 0.15, 0.45], dir: [0.62, -0.3, 0.72] }, { at: [0.02, 0.13, 0.45], dir: [-0.62, -0.3, 0.72] }, { torsoX: 0.3, ...LEGS_LUNGE })],
  fRend: [fangs({ at: [-0.24, 0.92, 0.02], dir: [0, 0.6, -0.8] }, { at: [0.24, 0.92, 0.02], dir: [0, 0.6, -0.8] }, { torsoX: -0.25, headX: -0.2, hipsH: 0.02 }),
    fangs({ at: [-0.22, 0.12, 0.48], dir: [0, -0.62, 0.78] }, { at: [0.22, 0.12, 0.48], dir: [0, -0.62, 0.78] }, { torsoX: 0.5, hipsH: -0.18, lRx: -0.6, kR: 0.6, lLx: 0.35 })],
  // Art: Ghoststep
  ghostCrouch: fangs({ at: [-0.36, -0.02, -0.16], dir: [0, -0.3, 0.95] }, { at: [0.36, -0.02, -0.16], dir: [0, -0.3, 0.95] }, { torsoX: 0.55, headX: -0.3, hipsH: -0.22, lRx: -0.5, kR: 0.8, lLx: 0.2, kL: 0.7 }),
  ghostStab: fangs({ at: [-0.14, 0.24, 0.52], dir: [0.1, -0.05, 1] }, { at: [0.14, 0.2, 0.52], dir: [-0.1, -0.05, 1] }, { torsoX: 0.35, lRx: -0.8, kR: 0.6, lLx: 0.6, hipsH: -0.18 }),

  // Warden's Bell-Maul: whole-body swings
  mOverhead: [m2({ at: [-0.1, 0.96, -0.02], dir: [0, 0.15, -0.99] }, { torsoX: -0.3, headX: -0.2, hipsH: 0.02 }),
    m2({ at: [-0.12, 0.12, 0.45], dir: [0, -0.62, 0.78] }, { torsoX: 0.55, hipsH: -0.2, lRx: -0.65, kR: 0.6, lLx: 0.35, kL: 0.3 })],
  mSwing: [m2({ at: [-0.3, 0.34, 0.2], dir: [-0.62, 0.3, -0.72] }, { ...TWIST_R, torsoY: -1.1 }),
    m2({ at: [0.04, 0.24, 0.42], dir: [0.82, -0.12, 0.56] }, { ...TWIST_L, ...LEGS_LUNGE })],
  // Art: Toll of Silence
  tollRaise: m2({ at: [-0.08, 1.02, 0.16], dir: [0, 1, 0.08] }, { torsoX: -0.3, headX: -0.35, hipsH: 0.03 }),
  tollSlam: m2({ at: [-0.14, 0.1, 0.44], dir: [0, -0.85, 0.52] }, { torsoX: 0.75, headX: -0.25, hipsH: -0.4, lRx: -0.7, kR: 0.95, lLx: 0.4, kL: 0.75 }),

  // Rites: the left hand gathers the light, then thrusts it out (overlaid on the stance, see ARM_L)
  castGather: held({ R: { at: [-0.3, 0.05, 0.25], dir: [0, 0, 1] }, L: { at: [0.1, 0.4, 0.28], dir: [-0.3, 0.9, 0.2] } }),
  castThrust: held({ R: { at: [-0.3, 0.05, 0.25], dir: [0, 0, 1] }, L: { at: [0.16, 0.42, 0.62], dir: [0, 0.4, 0.9] } }),
  castRaise: held({ R: { at: [-0.3, 0.05, 0.25], dir: [0, 0, 1] }, L: { at: [0.26, 1.0, 0.18], dir: [0, 1, 0] } }),
};
