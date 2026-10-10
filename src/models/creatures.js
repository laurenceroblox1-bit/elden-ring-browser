// Creatures of the outer regions (the Cinderfall Wastes, the Drowned Coast and the Glowcap Hollows).
// Humanoids dress the shared rig (models/humanoid.js) so the pose system drives them; the drake and
// the crab use the hound's joint layout (body, neck, head, jaw, tail, legs) so its gaits drive them.
// All original designs.
import * as THREE from '../lib/three.js';
import { buildHumanoid, mergeHumanoid } from './humanoid.js';
import { mat, mesh, box, cyl, cone, ico, group, glowSprite, mergeRig } from './kit.js';

// ---------- the Cinderfall Wastes ----------

// Cinder Imps: knee-high fire-sprites of the Wastes. Charcoal skin cracked with ember light, back-swept
// horns, a whip of a tail, and a ball of fire cupped in one claw that swells before it's thrown. The
// flame is unique so a cast can brighten its own (same interface as the Acolyte's lantern).
export function buildImp() {
  const skin = mat(0x2e2420, { roughness: 0.9 });
  const crack = mat(0xffa040, { emissive: 0xff5a10, emissiveIntensity: 2.0 });
  const horn = mat(0x8a6a50);
  const r = buildHumanoid({ skin, body: skin, arms: skin, legs: skin, boots: mat(0x1e1814), hands: skin },
    { chestW: 0.42, waistW: 0.3, shoulderW: 0.28, armW: 0.11, legW: 0.14, thigh: 0.34, shin: 0.36, headW: 0.3, headH: 0.26 });
  for (const s of [-1, 1]) {
    r.head.add(mesh(cone(0.05, 0.3, 4), horn, { x: s * 0.12, y: 0.3, z: -0.06, rx: -0.9, rz: -s * 0.3 }));
    r.head.add(mesh(box(0.06, 0.04, 0.03), crack, { x: s * 0.07, y: 0.14, z: 0.16, shadow: false }));
  }
  r.head.add(mesh(box(0.14, 0.03, 0.03), crack, { y: 0.05, z: 0.16, shadow: false })); // a grin of fire
  r.torso.add(mesh(box(0.05, 0.3, 0.02), crack, { x: 0.06, y: 0.36, z: 0.16, rz: 0.3, shadow: false }));
  r.torso.add(mesh(box(0.05, 0.22, 0.02), crack, { x: -0.1, y: 0.2, z: 0.14, rz: -0.4, shadow: false }));
  const tail = group({ y: -0.05, z: -0.14, rx: 0.9 });
  tail.add(mesh(box(0.05, 0.05, 0.5), skin, { z: -0.25 }));
  tail.add(mesh(cone(0.06, 0.14, 4), crack, { z: -0.54, rx: -Math.PI / 2, shadow: false }));
  r.hips.add(tail);
  // The fireball, cupped in the right claw (it hangs a little below the hand).
  const flame = mat(0xffd08a, { unique: true, emissive: 0xff7a1a, emissiveIntensity: 1.6 });
  const lantern = group({ y: -0.14, z: 0.06 });
  lantern.add(mesh(ico(0.1, 0), flame, { shadow: false }));
  const glow = glowSprite(0xff8a30, 0.9, 0.8);
  lantern.add(glow);
  r.armR.hand.add(lantern);
  r.rig.position.y -= 0.14; // the short legs
  r.root.scale.setScalar(0.82);
  mergeHumanoid(r, [lantern]);
  return { ...r, lantern, glow, flame };
}

// Cinder Golems: walls of black basalt held together by the fire inside. Molten seams glow between
// the slabs, its fists are boulders, and its head is a single lump with a furnace mouth. Built at person
// size and scaled up by the entity.
export function buildGolem() {
  const rock = mat(0x34302e, { roughness: 0.95 });
  const rock2 = mat(0x4a4440, { roughness: 0.95 });
  const magma = mat(0xffb050, { unique: true, emissive: 0xff5010, emissiveIntensity: 1.8 });
  const r = buildHumanoid({ skin: rock2, body: rock, arms: rock2, legs: rock, boots: rock2, hands: rock },
    { chestW: 0.74, chestD: 0.44, waistW: 0.5, shoulderW: 0.46, armW: 0.2, legW: 0.22, headW: 0.3, headH: 0.24 });
  r.torso.add(mesh(box(0.86, 0.36, 0.5), rock2, { y: 0.5, rz: 0.05 }));
  r.torso.add(mesh(box(0.5, 0.06, 0.04), magma, { y: 0.32, z: 0.23, shadow: false }));
  r.torso.add(mesh(box(0.06, 0.4, 0.04), magma, { x: 0.12, y: 0.3, z: 0.23, shadow: false }));
  r.torso.add(mesh(box(0.5, 0.3, 0.3), rock, { y: 0.62, z: -0.18, rx: -0.3 })); // a hump of slabs
  for (const s of [-1, 1]) (s < 0 ? r.armR : r.armL).shoulder.add(mesh(ico(0.24, 0), rock2, { y: 0.06 }));
  for (const arm of [r.armR, r.armL]) {
    arm.hand.add(mesh(ico(0.2, 0), rock2, { y: -0.04 }));
    arm.elbow.add(mesh(box(0.04, 0.2, 0.22), magma, { y: -0.15, x: 0.1, shadow: false }));
  }
  r.head.add(mesh(box(0.18, 0.05, 0.04), magma, { y: 0.1, z: 0.15, shadow: false }));
  for (const x of [-0.07, 0.07]) r.head.add(mesh(box(0.05, 0.04, 0.03), magma, { x, y: 0.2, z: 0.16, shadow: false }));
  for (const leg of [r.legR, r.legL]) leg.knee.add(mesh(box(0.05, 0.25, 0.2), magma, { y: -0.2, x: 0.11, shadow: false }));
  mergeHumanoid(r);
  return { ...r, magma };
}

// Ashmaw, the Cinder Drake. A great four-legged drake of black scale with an ember-orange belly, a
// crown of swept horns, a long whipping tail and leathery wings. Its joints follow the hound's (body,
// neck, head, jaw, tail, four legs) so the same gait code walks it; the wings flap on their own joints.
// Faces +Z, feet at the root, about a hound's size: the entity scales it up.
export function buildDrake() {
  const scale = mat(0x4a3632, { roughness: 0.8 });
  const scale2 = mat(0x5e4038, { roughness: 0.8 });
  const belly = mat(0x9a4a22, { roughness: 0.8 });
  const horn = mat(0xc8b8a0);
  const ember = mat(0xffc060, { unique: true, emissive: 0xff6a10, emissiveIntensity: 2.2 });
  const membrane = mat(0x8a3a28, { roughness: 0.9, side: THREE.DoubleSide });
  const maw = mat(0x6a2414, { emissive: 0xff4a10, emissiveIntensity: 1.2 });

  const root = new THREE.Group();
  const body = group({ y: 0.72 });
  root.add(body);
  body.add(mesh(box(0.54, 0.46, 0.6), scale, { z: 0.2, y: 0.04 }));
  body.add(mesh(box(0.44, 0.38, 0.5), scale2, { z: -0.3, y: 0.04 }));
  body.add(mesh(box(0.4, 0.1, 0.9), belly, { y: -0.2, z: -0.04 }));
  for (let i = 0; i < 4; i++) body.add(mesh(box(0.44, 0.03, 0.05), ember, { y: -0.17, z: 0.28 - i * 0.18, shadow: false })); // glowing seams
  for (let i = 0; i < 6; i++) body.add(mesh(cone(0.05, 0.18 - i * 0.015, 4), horn, { y: 0.28, z: 0.4 - i * 0.16, rx: -0.6 })); // back spines

  const neck = group({ y: 0.14, z: 0.5, rx: -0.55 });
  body.add(neck);
  neck.add(mesh(box(0.26, 0.26, 0.62), scale, { z: 0.28 }));
  neck.add(mesh(box(0.14, 0.06, 0.56), belly, { y: -0.14, z: 0.28 }));
  for (let i = 0; i < 3; i++) neck.add(mesh(cone(0.035, 0.14, 4), horn, { y: 0.15, z: 0.1 + i * 0.18, rx: -0.7 }));
  const head = group({ z: 0.58, rx: 0.55 });
  neck.add(head);
  head.add(mesh(box(0.3, 0.22, 0.32), scale));
  head.add(mesh(box(0.2, 0.13, 0.36), scale2, { z: 0.3, y: -0.02 }));
  for (const s of [-1, 1]) {
    head.add(mesh(box(0.06, 0.04, 0.04), ember, { x: s * 0.1, y: 0.06, z: 0.15, shadow: false }));
    head.add(mesh(cone(0.05, 0.36, 4), horn, { x: s * 0.11, y: 0.12, z: -0.14, rx: -1.25, rz: -s * 0.2 }));
    head.add(mesh(cone(0.035, 0.2, 4), horn, { x: s * 0.16, y: 0.02, z: -0.1, rx: -1.4, rz: -s * 0.7 }));
    head.add(mesh(box(0.03, 0.03, 0.03), ember, { x: s * 0.05, y: 0.03, z: 0.48, shadow: false })); // nostrils
  }
  const jaw = group({ y: -0.09, z: 0.08 });
  head.add(jaw);
  jaw.add(mesh(box(0.17, 0.06, 0.4), scale2, { z: 0.2 }));
  jaw.add(mesh(box(0.13, 0.03, 0.32), maw, { z: 0.18, y: 0.04, shadow: false }));
  for (const x of [0.055, -0.055]) for (let i = 0; i < 3; i++) jaw.add(mesh(cone(0.016, 0.06, 3), horn, { x, y: 0.06, z: 0.34 - i * 0.1 }));

  const tail = group({ y: 0.08, z: -0.56, rx: -0.6 });
  body.add(tail);
  tail.add(mesh(box(0.22, 0.2, 0.7), scale2, { z: -0.32 }));
  tail.add(mesh(box(0.14, 0.13, 0.6), scale, { z: -0.92, rx: 0.12 }));
  tail.add(mesh(box(0.08, 0.08, 0.5), scale2, { z: -1.4, rx: 0.25 }));
  tail.add(mesh(cone(0.12, 0.3, 4), horn, { z: -1.7, y: 0.05, rx: -Math.PI / 2 - 0.25 }));
  for (let i = 0; i < 4; i++) tail.add(mesh(cone(0.035, 0.12, 4), horn, { y: 0.12 - i * 0.02, z: -0.2 - i * 0.35, rx: -0.6 }));

  // Wings: an arm of bone from the shoulder, a fan of finger-bones, and the membrane between them.
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = group({ x: s * 0.24, y: 0.22, z: 0.32 });
    body.add(wing);
    wing.add(mesh(box(0.7, 0.07, 0.07), scale2, { x: s * 0.35 }));
    const tip = group({ x: s * 0.7 });
    wing.add(tip);
    tip.add(mesh(box(0.6, 0.05, 0.05), scale2, { x: s * 0.3, rz: s * 0.15 }));
    for (let i = 0; i < 3; i++) tip.add(mesh(box(0.04, 0.03, 0.75 - i * 0.12), scale2, { x: s * (0.2 + i * 0.2), z: -0.35 + i * 0.04, ry: s * (0.25 - i * 0.25) }));
    tip.add(mesh(box(0.95, 0.015, 0.72), membrane, { x: s * 0.42, z: -0.36, y: -0.02 }));
    wing.add(mesh(box(0.7, 0.015, 0.62), membrane, { x: s * 0.35, z: -0.3, y: -0.02 }));
    tip.add(mesh(cone(0.03, 0.1, 3), horn, { x: s * 0.62, y: 0.02, rz: -s * Math.PI / 2 }));
    wings.push({ wing, tip, side: s });
  }

  const legs = [];
  const mkLeg = (x, z, front) => {
    const hip = group({ x, y: -0.1, z });
    body.add(hip);
    hip.add(mesh(box(0.17, 0.36, 0.2), front ? scale : scale2, { y: -0.16 }));
    const knee = group({ y: -0.32 });
    hip.add(knee);
    knee.add(mesh(box(0.12, 0.3, 0.13), scale2, { y: -0.15 }));
    knee.add(mesh(box(0.16, 0.06, 0.22), scale, { y: -0.3, z: 0.05 }));
    for (const cx of [-0.05, 0.05]) knee.add(mesh(cone(0.02, 0.08, 3), horn, { x: cx, y: -0.3, z: 0.18, rx: Math.PI / 2 }));
    legs.push({ hip, knee, front, side: Math.sign(x) });
  };
  mkLeg(0.24, 0.32, true);
  mkLeg(-0.24, 0.32, true);
  mkLeg(0.22, -0.42, false);
  mkLeg(-0.22, -0.42, false);

  // The fire in its throat: a glow at the jaw that swells before a breath.
  const throat = glowSprite(0xff7a2a, 0.9, 0);
  throat.position.set(0, 0.02, 0.4);
  head.add(throat);
  mergeRig(root, [body, neck, head, jaw, tail, ...wings.flatMap((w) => [w.wing, w.tip]), ...legs.flatMap((l) => [l.hip, l.knee])], { keep: [throat] });
  return { root, body, neck, head, jaw, tail, legs, wings, throat, materials: { ember } };
}

// ---------- the Drowned Coast ----------

// The Drowned: sailors the sea gave back. Bloated grey-green skin, a rotted striped shirt, kelp in their
// hair, barnacles on their shoulders and a rusted harpoon (thrusts reach far; no shield).
export function buildDrowned() {
  const skin = mat(0x7d8f7a, { roughness: 0.9 });
  const shirt = mat(0x5a6670), stripe = mat(0xb8b4a0), kelp = mat(0x3a5a2a), rust = mat(0x6a4a32, { metalness: 0.4, roughness: 0.7 });
  const r = buildHumanoid({ skin, body: shirt, arms: skin, legs: mat(0x3a3e40), boots: mat(0x2a2a28), hands: skin }, { chestW: 0.54, waistW: 0.5 });
  for (let i = 0; i < 3; i++) r.torso.add(mesh(box(0.56, 0.04, 0.32), stripe, { y: 0.2 + i * 0.12 }));
  r.head.add(mesh(box(0.27, 0.06, 0.29), kelp, { y: 0.3 }));
  for (let i = 0; i < 4; i++) r.head.add(mesh(box(0.04, 0.24, 0.03), kelp, { x: -0.11 + i * 0.07, y: 0.2, z: -0.15, rz: (i - 1.5) * 0.15 }));
  for (const x of [-0.05, 0.05]) r.head.add(mesh(box(0.04, 0.03, 0.02), mat(0xc8f0e0, { emissive: 0x40c0a0, emissiveIntensity: 1.4 }), { x, y: 0.15, z: 0.135, shadow: false }));
  for (const arm of [r.armR, r.armL]) arm.shoulder.add(mesh(ico(0.07, 0), mat(0xc8c0b0), { x: 0.03, y: 0.04 }));
  r.hips.add(mesh(box(0.06, 0.4, 0.04), kelp, { x: 0.15, y: -0.25, z: 0.12 }));
  // Harpoon: a long shaft with a barbed iron head and a coil of rope.
  const harpoon = group();
  harpoon.add(mesh(cyl(0.025, 0.025, 2.0, 5), mat(0x5a4632), { rx: Math.PI / 2, z: 0.55 }));
  harpoon.add(mesh(cone(0.06, 0.24, 4), rust, { rx: Math.PI / 2, z: 1.66 }));
  for (const s of [-1, 1]) harpoon.add(mesh(box(0.02, 0.02, 0.14), rust, { x: s * 0.05, z: 1.5, ry: s * 0.5 }));
  harpoon.add(mesh(cyl(0.05, 0.05, 0.08, 6), mat(0x9a8a62), { rx: Math.PI / 2, z: -0.1 }));
  r.armR.hand.add(harpoon);
  const mid = group({ z: 1.0 }), tip = group({ z: 1.75 });
  r.armR.hand.add(mid, tip);
  mergeHumanoid(r);
  return { ...r, markers: { mid, tip } };
}

// Captain Morrow, the Drowned: master of the ship the sea took. A greatcoat gone green, a tricorne
// hung with weed, a lantern of drowned light at his belt and the ship's own anchor for a weapon, swung
// on its chain. Built at person size; the entity scales him up.
export function buildCaptain() {
  const coat = mat(0x2e4a46, { side: THREE.DoubleSide }), skin = mat(0x8a9c88), gold = mat(0xa8904a, { metalness: 0.6, roughness: 0.4 });
  const iron = mat(0x4a4a4e, { metalness: 0.6, roughness: 0.5 }), kelp = mat(0x3a5a2a);
  const r = buildHumanoid({ skin, body: coat, arms: coat, legs: mat(0x2a3230), boots: mat(0x1e2220), hands: skin },
    { chestW: 0.6, waistW: 0.5, shoulderW: 0.36, armW: 0.15 });
  r.head.add(mesh(cyl(0.22, 0.26, 0.12, 3), mat(0x1e2a28), { y: 0.33, ry: Math.PI / 6 })); // the tricorne
  r.head.add(mesh(box(0.04, 0.26, 0.03), kelp, { x: 0.18, y: 0.18, z: 0.05 }));
  r.head.add(mesh(box(0.22, 0.12, 0.05), mat(0x5a6a58), { y: 0.03, z: 0.13 })); // a beard of weed
  for (const x of [-0.055, 0.055]) r.head.add(mesh(box(0.045, 0.03, 0.02), mat(0xc8fff0, { emissive: 0x40e0c0, emissiveIntensity: 2 }), { x, y: 0.15, z: 0.135, shadow: false }));
  r.torso.add(mesh(box(0.06, 0.4, 0.33), gold, { y: 0.32, x: 0.02 })); // buttons
  for (const s of [-1, 1]) (s < 0 ? r.armR : r.armL).shoulder.add(mesh(box(0.24, 0.06, 0.28), gold, { y: 0.05 }));
  r.hips.add(mesh(cyl(0.3, 0.46, 0.75, 8, true), coat, { y: -0.36 })); // coat tails
  const lamp = mat(0xb8fff0, { unique: true, emissive: 0x40e0c0, emissiveIntensity: 1.6 });
  const lantern = group({ x: 0.28, y: -0.1, z: 0.1 });
  lantern.add(mesh(box(0.12, 0.16, 0.12), lamp, { shadow: false }));
  lantern.add(mesh(box(0.14, 0.03, 0.14), iron, { y: 0.09 }));
  const glow = glowSprite(0x60f0d0, 0.9, 0.6);
  lantern.add(glow);
  r.hips.add(lantern);
  // The anchor: a shank, a ring, two curved arms with flukes, carried by the shank.
  const anchor = group();
  anchor.add(mesh(box(0.1, 0.1, 1.5), iron, { z: 0.65 }));
  anchor.add(mesh(cyl(0.14, 0.14, 0.05, 8, true), iron, { rz: Math.PI / 2, z: -0.12 }));
  anchor.add(mesh(box(0.9, 0.1, 0.1), iron, { z: 1.32 }));
  for (const s of [-1, 1]) {
    anchor.add(mesh(box(0.1, 0.1, 0.34), iron, { x: s * 0.46, z: 1.18, ry: s * 0.4 }));
    anchor.add(mesh(cone(0.1, 0.2, 3), iron, { x: s * 0.52, z: 0.98, rx: -Math.PI / 2 }));
  }
  anchor.add(mesh(box(0.42, 0.08, 0.08), iron, { z: 0.15 })); // the stock
  r.armR.hand.add(anchor);
  mergeHumanoid(r, [lantern]);
  return { ...r, lamp, glow };
}

// Tidecrabs: shore crabs grown to the size of a cart. A domed shell, two eyestalks, one great claw and
// one small, six walking legs. The jointed parts map onto the hound's layout: the claws are the
// "head" (raised and lowered), the great claw's pincer is the "jaw", the eyestalks the "neck".
export function buildCrab() {
  const shell = mat(0xb04a2a, { roughness: 0.7 }), shell2 = mat(0x8a3a22, { roughness: 0.7 }), pale = mat(0xe8c8a0);
  const root = new THREE.Group();
  const body = group({ y: 0.5 });
  root.add(body);
  body.add(mesh(box(1.0, 0.34, 0.8), shell));
  body.add(mesh(box(0.8, 0.14, 0.62), shell2, { y: 0.22 }));
  body.add(mesh(box(0.86, 0.1, 0.66), pale, { y: -0.2 }));
  for (const s of [-1, 1]) body.add(mesh(cone(0.06, 0.18, 4), pale, { x: s * 0.5, y: 0.05, z: 0.3, rz: -s * 1.3 }));
  for (let i = 0; i < 5; i++) body.add(mesh(ico(0.05, 0), mat(0xd8d0c0), { x: -0.3 + i * 0.15, y: 0.3, z: -0.1 + (i % 2) * 0.12 })); // barnacles
  const neck = group({ y: 0.16, z: 0.32, rx: -0.55 });
  body.add(neck);
  for (const s of [-1, 1]) {
    neck.add(mesh(box(0.04, 0.04, 0.22), shell2, { x: s * 0.12, z: 0.1, rx: -0.9 }));
    neck.add(mesh(box(0.08, 0.08, 0.08), mat(0x101010), { x: s * 0.12, y: 0.12, z: 0.18 }));
  }
  const head = group({ z: 0.1, rx: 0.55 });
  neck.add(head);
  // The great claw (right) and the small one (left), on short arms out front.
  head.add(mesh(box(0.14, 0.12, 0.34), shell2, { x: -0.36, y: -0.12, z: 0.2, ry: 0.4 }));
  head.add(mesh(box(0.3, 0.24, 0.36), shell, { x: -0.48, y: -0.06, z: 0.46 }));
  head.add(mesh(box(0.1, 0.1, 0.24), shell2, { x: 0.34, y: -0.12, z: 0.18, ry: -0.4 }));
  head.add(mesh(box(0.16, 0.14, 0.24), shell, { x: 0.42, y: -0.08, z: 0.36 }));
  head.add(mesh(box(0.06, 0.05, 0.2), pale, { x: 0.42, y: -0.08, z: 0.54 }));
  const jaw = group({ x: -0.48, y: -0.12, z: 0.62 });
  head.add(jaw);
  jaw.add(mesh(box(0.22, 0.1, 0.32), pale, { z: 0.14 }));
  head.add(mesh(box(0.22, 0.1, 0.3), shell, { x: -0.48, y: 0.06, z: 0.76 }));
  const tail = group({ y: -0.05, z: -0.42, rx: -0.6 });
  body.add(tail);
  tail.add(mesh(box(0.4, 0.08, 0.2), shell2, { z: -0.05 }));
  // Four jointed legs walk; two more stand still between them.
  const legs = [];
  const mkLeg = (x, z, front, joint = true) => {
    const s = Math.sign(x);
    const hip = group({ x, y: -0.05, z, rz: -s * 0.9 });
    body.add(hip);
    hip.add(mesh(box(0.08, 0.36, 0.08), shell2, { y: -0.16 }));
    const knee = group({ y: -0.34, rz: s * 1.3 });
    hip.add(knee);
    knee.add(mesh(box(0.06, 0.44, 0.06), shell, { y: -0.2 }));
    knee.add(mesh(cone(0.03, 0.12, 3), pale, { y: -0.46, rx: Math.PI }));
    if (joint) legs.push({ hip, knee, front, side: s });
  };
  mkLeg(0.5, 0.22, true);
  mkLeg(-0.5, 0.22, true);
  mkLeg(0.5, -0.26, false);
  mkLeg(-0.5, -0.26, false);
  mkLeg(0.52, -0.02, false, false);
  mkLeg(-0.52, -0.02, false, false);
  mergeRig(root, [body, neck, head, jaw, tail, ...legs.flatMap((l) => [l.hip, l.knee])]);
  return { root, body, neck, head, jaw, tail, legs, materials: {} };
}

// ---------- the Glowcap Hollows ----------

// Sporelings: walking puffballs as high as your knee. A swollen glowing cap over a stubby body on two
// root-feet, black bead eyes. When it bursts the cap goes first. The cap is unique so it can swell.
export function buildSporeling() {
  const stalk = mat(0xd8cce4), cap = mat(0xa8f070, { unique: true, emissive: 0x5ac030, emissiveIntensity: 0.8 });
  const r = buildHumanoid({ skin: stalk, body: stalk, arms: stalk, legs: mat(0xb8a8c8), boots: mat(0x6a5a78), hands: stalk },
    { chestW: 0.4, waistW: 0.44, shoulderW: 0.24, armW: 0.1, upperArm: 0.2, foreArm: 0.2, thigh: 0.2, shin: 0.2, headW: 0.26, headH: 0.22 });
  const capG = group({ y: 0.32 });
  capG.add(mesh(ico(0.34, 1), cap, { sy: 0.8, shadow: false }));
  for (const [x, z] of [[0.18, 0.18], [-0.2, 0.1], [0.05, -0.25], [-0.1, 0.24]]) capG.add(mesh(box(0.06, 0.03, 0.06), mat(0xf0ffe0), { x, y: 0.22, z }));
  r.head.add(capG);
  for (const x of [-0.05, 0.05]) r.head.add(mesh(box(0.04, 0.05, 0.02), mat(0x101010), { x, y: 0.14, z: 0.14 }));
  r.rig.position.y -= 0.42;
  mergeHumanoid(r, [capG]);
  return { ...r, cap, capG };
}

// Glowcap Stalkers: tall, thin mushroom-folk that drift between the caps. A drooping hood-cap trailing
// glowing gills, long arms ending in hooked fingers, a body of pale fibre. They throw clouds of spores.
export function buildStalker() {
  const fibre = mat(0xc8bcd8, { roughness: 0.9, emissive: 0x30204a, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const capM = mat(0x6a3a8a, { roughness: 0.8, side: THREE.DoubleSide });
  const gill = mat(0xb0ffe8, { emissive: 0x40e0c0, emissiveIntensity: 1.4 });
  const r = buildHumanoid({ skin: fibre, body: fibre, arms: fibre, legs: fibre, boots: fibre, hands: fibre },
    { chestW: 0.4, waistW: 0.3, armW: 0.1, upperArm: 0.42, foreArm: 0.42, headW: 0.2 });
  for (const leg of [r.legR, r.legL]) for (const g of [leg.hip, leg.knee]) for (const c of [...g.children]) if (c.isMesh) g.remove(c);
  r.head.add(mesh(cone(0.42, 0.42, 7), capM, { y: 0.3 }));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    r.head.add(mesh(box(0.04, 0.3, 0.02), gill, { x: Math.sin(a) * 0.34, y: 0.0, z: Math.cos(a) * 0.34, ry: a, shadow: false }));
  }
  for (const x of [-0.05, 0.05]) r.head.add(mesh(box(0.03, 0.03, 0.02), gill, { x, y: 0.12, z: 0.115, shadow: false }));
  r.hips.add(mesh(cyl(0.18, 0.36, 1.0, 7, true), fibre, { y: -0.5 }));
  for (const arm of [r.armR, r.armL]) for (let i = 0; i < 3; i++) arm.hand.add(mesh(cone(0.018, 0.22, 3), capM, { x: (i - 1) * 0.035, y: -0.13, rx: Math.PI - 0.3 }));
  mergeHumanoid(r);
  return r;
}

// Sylvara, the Bloom Witch: the grove's keeper, half woman and half mushroom. A gown of layered petal-caps
// in pink and violet, a crown of tiny glowcaps, bark-dark skin, and a staff topped with a heart of spore
// light. The heart is unique so it can swell with each spell.
export function buildWitch() {
  const gown = mat(0x8a3a7a, { side: THREE.DoubleSide }), gown2 = mat(0x5a2a6a, { side: THREE.DoubleSide });
  const skin = mat(0x6a5048), wood = mat(0x3a2a24);
  const glowM = mat(0xffb0f0, { emissive: 0xff40c0, emissiveIntensity: 1.6 });
  const r = buildHumanoid({ skin, body: gown, arms: gown2, legs: gown2, boots: wood, hands: skin }, { chestW: 0.46, waistW: 0.36 });
  for (let i = 0; i < 4; i++) r.hips.add(mesh(cyl(0.28 + i * 0.07, 0.42 + i * 0.08, 0.32, 9, true), i % 2 ? gown : gown2, { y: -0.12 - i * 0.24 }));
  r.torso.add(mesh(cyl(0.18, 0.36, 0.14, 9, true), gown2, { y: 0.58 })); // a collar of petals
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    r.head.add(mesh(cyl(0.005, 0.05, 0.07, 6), glowM, { x: Math.sin(a) * 0.14, y: 0.33, z: Math.cos(a) * 0.14, shadow: false }));
  }
  r.head.add(mesh(box(0.27, 0.14, 0.29), mat(0x2a1a2a), { y: 0.24, z: -0.03 })); // dark hair
  r.head.add(mesh(box(0.06, 0.4, 0.06), mat(0x2a1a2a), { y: 0.0, z: -0.15 }));
  for (const x of [-0.05, 0.05]) r.head.add(mesh(box(0.04, 0.025, 0.02), glowM, { x, y: 0.15, z: 0.135, shadow: false }));
  const heart = mat(0xffd0f8, { unique: true, emissive: 0xff50d0, emissiveIntensity: 1.6 });
  const staff = group();
  staff.add(mesh(cyl(0.025, 0.035, 1.8, 5), wood, { rx: Math.PI / 2, z: 0.3 }));
  const orb = group({ z: 1.22 });
  orb.add(mesh(ico(0.13, 1), heart, { shadow: false }));
  for (let i = 0; i < 4; i++) orb.add(mesh(box(0.03, 0.03, 0.26), wood, { ry: (i / 4) * Math.PI, rx: 0.5 }));
  const glow = glowSprite(0xff70d0, 1.4, 0.6);
  orb.add(glow);
  staff.add(orb);
  r.armL.hand.add(staff);
  mergeHumanoid(r, [orb]);
  return { ...r, heart, glow, orb };
}
