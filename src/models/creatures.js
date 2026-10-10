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

// ---------- the Gilded Dunes ----------

// Dune Scorpions: the crab's layout again (claws as the "head", pincer as the "jaw"), but long and low,
// sand-gold, with a jointed tail curled over its back and a glowing violet sting.
export function buildScorpion() {
  const shell = mat(0xc8902e, { roughness: 0.7 }), shell2 = mat(0x8a5a1e, { roughness: 0.7 }), sting = mat(0xe090ff, { emissive: 0xa040e0, emissiveIntensity: 1.6 });
  const root = new THREE.Group();
  const body = group({ y: 0.45 });
  root.add(body);
  for (let i = 0; i < 4; i++) body.add(mesh(box(0.66 - i * 0.06, 0.24, 0.3), i % 2 ? shell2 : shell, { z: 0.36 - i * 0.26 }));
  const neck = group({ y: 0.1, z: 0.5, rx: -0.55 });
  body.add(neck);
  for (const s of [-1, 1]) neck.add(mesh(box(0.06, 0.06, 0.06), mat(0x101010), { x: s * 0.1, y: 0.06, z: 0.08 }));
  const head = group({ z: 0.1, rx: 0.55 });
  neck.add(head);
  for (const s of [-1, 1]) {
    head.add(mesh(box(0.1, 0.1, 0.36), shell2, { x: s * 0.3, y: -0.08, z: 0.2, ry: -s * 0.3 }));
    head.add(mesh(box(0.2, 0.14, 0.3), shell, { x: s * 0.42, y: -0.06, z: 0.48 }));
  }
  const jaw = group({ x: 0.42, y: -0.1, z: 0.62 });
  head.add(jaw);
  jaw.add(mesh(box(0.08, 0.06, 0.26), shell2, { z: 0.12 }));
  head.add(mesh(box(0.08, 0.06, 0.26), shell2, { x: -0.42, y: -0.1, z: 0.74 }));
  // The tail: segments climbing back and up over the body to the sting.
  const tail = group({ y: 0.08, z: -0.5, rx: -0.6 });
  body.add(tail);
  let y = 0, z = 0;
  for (let i = 0; i < 5; i++) {
    const a = -0.3 - i * 0.45;
    tail.add(mesh(box(0.16 - i * 0.015, 0.14, 0.26), i % 2 ? shell : shell2, { y, z, rx: a }));
    y += Math.sin(-a) * 0.24;
    z += -Math.cos(a) * 0.22 * (i < 3 ? 1 : -1);
  }
  tail.add(mesh(cone(0.07, 0.24, 4), sting, { y: y + 0.05, z: z + 0.12, rx: 2.2, shadow: false }));
  const legs = [];
  const mkLeg = (x, zz, front, joint = true) => {
    const s = Math.sign(x);
    const hip = group({ x, y: -0.05, z: zz, rz: -s * 0.8 });
    body.add(hip);
    hip.add(mesh(box(0.06, 0.32, 0.06), shell2, { y: -0.14 }));
    const knee = group({ y: -0.3, rz: s * 1.2 });
    hip.add(knee);
    knee.add(mesh(box(0.05, 0.36, 0.05), shell, { y: -0.16 }));
    if (joint) legs.push({ hip, knee, front, side: s });
  };
  mkLeg(0.32, 0.3, true); mkLeg(-0.32, 0.3, true); mkLeg(0.3, -0.2, false); mkLeg(-0.3, -0.2, false);
  mkLeg(0.32, 0.05, false, false); mkLeg(-0.32, 0.05, false, false); mkLeg(0.28, -0.42, false, false); mkLeg(-0.28, -0.42, false, false);
  mergeRig(root, [body, neck, head, jaw, tail, ...legs.flatMap((l) => [l.hip, l.knee])]);
  return { root, body, neck, head, jaw, tail, legs, materials: {} };
}

// Sand Revenants: the Sanctum's dead priest-guards, bound in sun-bleached wrappings with a gilded
// collar, a curved khopesh and a little round shield of beaten gold. Their eyes are sun-coloured.
export function buildRevenant() {
  const wrap = mat(0xd8c8a0), wrap2 = mat(0xb8a47a), gold = mat(0xd8a840, { metalness: 0.7, roughness: 0.35 });
  const r = buildHumanoid({ skin: wrap, body: wrap2, arms: wrap, legs: wrap2, boots: mat(0x8a7a5a), hands: wrap }, { chestW: 0.48, waistW: 0.4 });
  for (let i = 0; i < 4; i++) r.torso.add(mesh(box(0.5, 0.03, 0.31), mat(0x9a8a62), { y: 0.12 + i * 0.12, rz: (i % 2 ? 0.08 : -0.08) }));
  r.torso.add(mesh(cyl(0.3, 0.3, 0.06, 10), gold, { y: 0.57 })); // the collar
  r.head.add(mesh(box(0.27, 0.12, 0.29), mat(0x2e4a8a), { y: 0.3, z: -0.03 })); // a striped headcloth
  r.head.add(mesh(box(0.06, 0.28, 0.24), mat(0x2e4a8a), { x: 0.14, y: 0.12, z: -0.04 }));
  r.head.add(mesh(box(0.06, 0.28, 0.24), mat(0x2e4a8a), { x: -0.14, y: 0.12, z: -0.04 }));
  for (const x of [-0.05, 0.05]) r.head.add(mesh(box(0.04, 0.025, 0.02), mat(0xffd070, { emissive: 0xffa020, emissiveIntensity: 2 }), { x, y: 0.15, z: 0.135, shadow: false }));
  r.hips.add(mesh(box(0.42, 0.38, 0.02), mat(0x2e4a8a), { y: -0.2, z: 0.15 }));
  const blade = mat(0xb8a060, { metalness: 0.7, roughness: 0.35 });
  const sword = group();
  sword.add(mesh(box(0.04, 0.04, 0.2), mat(0x2b241d)));
  sword.add(mesh(box(0.07, 0.016, 0.4), blade, { z: 0.3 }));
  sword.add(mesh(box(0.1, 0.016, 0.34), blade, { z: 0.62, x: 0.05, ry: -0.6 })); // the hooked khopesh blade
  r.armR.hand.add(sword);
  const mid = group({ z: 0.45 }), tip = group({ z: 0.85 });
  r.armR.hand.add(mid, tip);
  const shield = mesh(cyl(0.26, 0.26, 0.05, 12), gold, { rz: Math.PI / 2, x: 0.07 });
  r.armL.elbow.add(shield);
  shield.position.y = -0.18;
  mergeHumanoid(r);
  return { ...r, markers: { mid, tip } };
}

// Sand Wraiths: the dunes' dead, made of blown sand held in the shape of a hooded figure.
export function buildSandWraith() {
  const sand = mat(0xd8b070, { roughness: 1, emissive: 0x5a3a10, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const dark = mat(0x9a7040, { roughness: 1, side: THREE.DoubleSide });
  const eye = mat(0xfff0b0, { emissive: 0xffc040, emissiveIntensity: 3 });
  const r = buildHumanoid({ skin: dark, body: sand, arms: sand, legs: sand, boots: sand, hands: dark }, { chestW: 0.46, waistW: 0.36 });
  for (const leg of [r.legR, r.legL]) for (const g of [leg.hip, leg.knee]) for (const c of [...g.children]) if (c.isMesh) g.remove(c);
  r.head.add(mesh(cone(0.25, 0.5, 6), dark, { y: 0.2, z: -0.05 }));
  r.head.add(mesh(box(0.2, 0.18, 0.06), mat(0x1a120a), { y: 0.06, z: 0.12 }));
  for (const x of [-0.05, 0.05]) r.head.add(mesh(box(0.035, 0.025, 0.02), eye, { x, y: 0.08, z: 0.155, shadow: false }));
  r.hips.add(mesh(cyl(0.22, 0.46, 1.0, 8, true), sand, { y: -0.5 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    r.hips.add(mesh(box(0.14, 0.4, 0.02), dark, { x: Math.sin(a) * 0.4, y: -0.95, z: Math.cos(a) * 0.4, ry: a, rx: 0.2 }));
  }
  mergeHumanoid(r);
  return r;
}

// Solkar, the Sun Scarab: a beetle the size of a house, gold and lapis-blue, a great forked horn, a
// sun-disc glowing between its wing-cases. The hound layout again (horn on the "head", mandibles as
// the "jaw", wing-cases on their own joints).
export function buildScarab() {
  const gold = mat(0xd8a838, { metalness: 0.5, roughness: 0.4 }), lapis = mat(0x2a4a9a, { metalness: 0.3, roughness: 0.5 });
  const dark = mat(0x3a2a1a), sun = mat(0xfff0a0, { unique: true, emissive: 0xffb020, emissiveIntensity: 2.0 });
  const root = new THREE.Group();
  const body = group({ y: 0.62 });
  root.add(body);
  body.add(mesh(box(0.86, 0.36, 1.1), dark, { y: -0.04 }));
  body.add(mesh(box(0.8, 0.12, 0.3), gold, { z: 0.5, y: 0.08 })); // the pronotum's rim
  body.add(mesh(box(0.7, 0.3, 0.36), lapis, { z: 0.48, y: 0.16 }));
  const disc = mesh(cyl(0.18, 0.18, 0.04, 12), sun, { y: 0.34, z: 0.05, shadow: false });
  body.add(disc);
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = group({ x: s * 0.06, y: 0.24, z: 0.3 });
    body.add(wing);
    wing.add(mesh(box(0.4, 0.14, 0.82), s < 0 ? lapis : lapis, { x: s * 0.2, z: -0.42 }));
    wing.add(mesh(box(0.42, 0.04, 0.84), gold, { x: s * 0.2, z: -0.42, y: 0.08 }));
    wings.push({ wing, side: s });
  }
  const neck = group({ y: 0.1, z: 0.66, rx: -0.55 });
  body.add(neck);
  neck.add(mesh(box(0.42, 0.24, 0.2), dark, { z: 0.08 }));
  const head = group({ z: 0.18, rx: 0.55 });
  neck.add(head);
  head.add(mesh(box(0.44, 0.2, 0.26), gold));
  head.add(mesh(box(0.12, 0.12, 0.5), gold, { y: 0.14, z: 0.2, rx: -0.6 })); // the horn
  for (const s of [-1, 1]) head.add(mesh(box(0.06, 0.06, 0.24), gold, { x: s * 0.07, y: 0.42, z: 0.4, rx: -1.0, ry: s * 0.4 })); // its fork
  for (const s of [-1, 1]) head.add(mesh(box(0.06, 0.05, 0.05), sun, { x: s * 0.16, y: 0.04, z: 0.13, shadow: false }));
  const jaw = group({ y: -0.08, z: 0.14 });
  head.add(jaw);
  for (const s of [-1, 1]) jaw.add(mesh(box(0.05, 0.05, 0.22), dark, { x: s * 0.12, z: 0.08, ry: -s * 0.4 }));
  const tail = group({ y: -0.02, z: -0.6, rx: -0.6 });
  body.add(tail);
  tail.add(mesh(box(0.5, 0.2, 0.2), dark));
  const legs = [];
  const mkLeg = (x, zz, front, joint = true) => {
    const s = Math.sign(x);
    const hip = group({ x, y: -0.1, z: zz, rz: -s * 0.7 });
    body.add(hip);
    hip.add(mesh(box(0.08, 0.36, 0.08), dark, { y: -0.16 }));
    const knee = group({ y: -0.34, rz: s * 1.0 });
    hip.add(knee);
    knee.add(mesh(box(0.06, 0.4, 0.06), gold, { y: -0.18 }));
    if (joint) legs.push({ hip, knee, front, side: s });
  };
  mkLeg(0.42, 0.36, true); mkLeg(-0.42, 0.36, true); mkLeg(0.44, -0.3, false); mkLeg(-0.44, -0.3, false);
  mkLeg(0.46, 0.03, false, false); mkLeg(-0.46, 0.03, false, false);
  const glow = glowSprite(0xffc040, 1.4, 0.6);
  glow.position.set(0, 0.36, 0.05);
  body.add(glow);
  mergeRig(root, [body, neck, head, jaw, tail, ...wings.map((w) => w.wing), ...legs.flatMap((l) => [l.hip, l.knee])], { keep: [glow] });
  return { root, body, neck, head, jaw, tail, legs, wings, sun, glow, materials: { ember: sun } };
}

// Tamsin, a wandering trader: a tall figure in layered desert robes and a wrapped turban, a scarf over
// the face, rings of brass at the wrists, a pack bristling with goods on the back.
export function buildTamsin() {
  const robe = mat(0x8a3a2a, { side: THREE.DoubleSide }), sand = mat(0xd8c090), brass = mat(0xb08d4a, { metalness: 0.6, roughness: 0.4 });
  const r = buildHumanoid({ skin: mat(0x9a6a4a), body: robe, arms: sand, legs: robe, boots: mat(0x5a3a22) }, { chestW: 0.5, waistW: 0.44 });
  r.head.add(mesh(cyl(0.17, 0.19, 0.2, 8), sand, { y: 0.32 }));
  r.head.add(mesh(box(0.27, 0.1, 0.06), mat(0x2e4a8a), { y: 0.06, z: 0.13 })); // face scarf
  r.hips.add(mesh(cyl(0.24, 0.42, 0.8, 8, true), robe, { y: -0.38 }));
  for (const arm of [r.armR, r.armL]) arm.elbow.add(mesh(cyl(0.08, 0.08, 0.04, 8), brass, { y: -0.26 }));
  const pack = group({ y: 0.36, z: -0.26 });
  pack.add(mesh(box(0.44, 0.56, 0.3), mat(0x6a4a2e)));
  pack.add(mesh(box(0.1, 0.5, 0.1), brass, { x: 0.18, y: 0.42 }));
  pack.add(mesh(cyl(0.08, 0.08, 0.5, 6), mat(0xd8c8a0), { z: 0.0, y: 0.34, rz: Math.PI / 2 }));
  r.torso.add(pack);
  mergeHumanoid(r);
  return r;
}

// ---------- the Stormspire Heights ----------

// Spire Knights: the storm-monks' sworn guard, in verdigris plate with a crackling blue sword-edge
// and a tall kite shield.
export function buildStormKnight() {
  const plate = mat(0x5a8a7a, { metalness: 0.55, roughness: 0.45 }), dark = mat(0x34484a, { metalness: 0.5, roughness: 0.5 });
  const spark = mat(0xcff0ff, { emissive: 0x60b0ff, emissiveIntensity: 2.2 });
  const r = buildHumanoid({ skin: dark, body: plate, arms: plate, legs: dark, boots: dark, hands: dark }, { chestW: 0.58, shoulderW: 0.37 });
  r.head.add(mesh(box(0.3, 0.36, 0.32), plate, { y: 0.17 }));
  r.head.add(mesh(cone(0.08, 0.3, 4), plate, { y: 0.48 }));
  r.head.add(mesh(box(0.22, 0.035, 0.02), spark, { y: 0.2, z: 0.165, shadow: false }));
  for (const s of [-1, 1]) (s < 0 ? r.armR : r.armL).shoulder.add(mesh(box(0.26, 0.14, 0.3), plate, { y: 0.03 }));
  r.hips.add(mesh(box(0.42, 0.5, 0.02), mat(0x2a3a5a), { y: -0.24, z: 0.15 }));
  const sword = group();
  sword.add(mesh(box(0.045, 0.045, 0.24), mat(0x2b241d)));
  sword.add(mesh(box(0.26, 0.04, 0.05), plate, { z: 0.13 }));
  sword.add(mesh(box(0.07, 0.018, 1.05), mat(0xb8c6ce, { metalness: 0.75, roughness: 0.3 }), { z: 0.68 }));
  sword.add(mesh(box(0.02, 0.022, 0.98), spark, { z: 0.68, x: 0.035, shadow: false }));
  r.armR.hand.add(sword);
  const mid = group({ z: 0.65 }), tip = group({ z: 1.2 });
  r.armR.hand.add(mid, tip);
  const shield = group({ x: 0.07, y: -0.2 });
  shield.add(mesh(box(0.06, 0.7, 0.46), dark));
  shield.add(mesh(box(0.07, 0.5, 0.06), spark, { shadow: false }));
  r.armL.elbow.add(shield);
  r.root.scale.setScalar(1.06);
  mergeHumanoid(r);
  return { ...r, markers: { mid, tip } };
}

// Gargoyles: winged stone watchers from the monastery's roofs. A crouching body of grey stone, horns,
// a beak, folded stone wings and claws; built at person size and scaled up.
export function buildGargoyle() {
  const stone = mat(0x7a7e86, { roughness: 0.95 }), stone2 = mat(0x5a5e66, { roughness: 0.95 });
  const eye = mat(0xbfe8ff, { unique: true, emissive: 0x60b0ff, emissiveIntensity: 1.6 });
  const r = buildHumanoid({ skin: stone, body: stone, arms: stone2, legs: stone2, boots: stone, hands: stone },
    { chestW: 0.6, waistW: 0.42, shoulderW: 0.38, armW: 0.16, legW: 0.19 });
  for (const s of [-1, 1]) {
    r.head.add(mesh(cone(0.05, 0.3, 4), stone2, { x: s * 0.1, y: 0.32, z: -0.05, rx: -0.7, rz: -s * 0.4 }));
    r.head.add(mesh(box(0.05, 0.035, 0.02), eye, { x: s * 0.06, y: 0.16, z: 0.135, shadow: false }));
    // Folded wings of stone, rising behind the shoulders.
    r.torso.add(mesh(box(0.06, 0.7, 0.5), stone2, { x: s * 0.24, y: 0.7, z: -0.28, rz: s * 0.5, rx: 0.3 }));
    r.torso.add(mesh(box(0.06, 0.5, 0.34), stone, { x: s * 0.48, y: 0.98, z: -0.38, rz: s * 0.9, rx: 0.3 }));
  }
  r.head.add(mesh(cone(0.07, 0.16, 4), stone2, { y: 0.08, z: 0.16, rx: Math.PI / 2 + 0.4 })); // beak
  for (const arm of [r.armR, r.armL]) for (let i = 0; i < 3; i++) arm.hand.add(mesh(cone(0.025, 0.16, 3), stone2, { x: (i - 1) * 0.04, y: -0.12, rx: Math.PI }));
  mergeHumanoid(r);
  return { ...r, magma: eye };
}

// Vaelor, the Storm Herald: the monastery's last abbot, who called the storm down and became its
// voice. Tall, robed in storm-grey and copper, a crown of copper rods crackling with light, a long
// spear-glaive whose head is a captured bolt.
export function buildHerald() {
  const robe = mat(0x4a5060, { side: THREE.DoubleSide }), copper = mat(0x5aa08a, { metalness: 0.6, roughness: 0.4 });
  const spark = mat(0xe0f4ff, { unique: true, emissive: 0x70c0ff, emissiveIntensity: 2.2 });
  const r = buildHumanoid({ skin: mat(0xa8a0b0), body: robe, arms: robe, legs: robe, boots: mat(0x2a2a30), hands: mat(0x6a6a78) }, { chestW: 0.52, waistW: 0.4 });
  for (let i = 0; i < 3; i++) r.hips.add(mesh(cyl(0.28 + i * 0.08, 0.42 + i * 0.08, 0.36, 8, true), robe, { y: -0.14 - i * 0.28 }));
  r.torso.add(mesh(box(0.56, 0.08, 0.32), copper, { y: 0.56 }));
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.35;
    r.head.add(mesh(box(0.03, 0.26 + (i === 2 ? 0.12 : 0), 0.03), copper, { x: Math.sin(a) * 0.12, y: 0.4, z: Math.cos(a) * 0.08 - 0.04, rz: -a * 0.5 }));
  }
  for (const x of [-0.05, 0.05]) r.head.add(mesh(box(0.04, 0.025, 0.02), spark, { x, y: 0.15, z: 0.135, shadow: false }));
  const glaive = group();
  glaive.add(mesh(cyl(0.026, 0.03, 2.4, 6), mat(0x2a2a30), { rx: Math.PI / 2, z: 0.4 }));
  glaive.add(mesh(cyl(0.05, 0.05, 0.1, 6), copper, { rx: Math.PI / 2, z: 1.58 }));
  glaive.add(mesh(box(0.03, 0.12, 0.5), spark, { z: 1.86, shadow: false }));
  glaive.add(mesh(box(0.03, 0.2, 0.08), spark, { z: 1.7, y: 0.1, rx: 0.6, shadow: false }));
  const glow = glowSprite(0x80c8ff, 1.4, 0.7);
  glow.position.z = 1.86;
  glaive.add(glow);
  r.armR.hand.add(glaive);
  mergeHumanoid(r, [glaive]);
  return { ...r, spark, glow };
}

// Brother Aldous: an old monk in a grey habit with a copper-wired staff, bent but quick-eyed.
export function buildAldous() {
  const habit = mat(0x5a5a62, { side: THREE.DoubleSide });
  const r = buildHumanoid({ skin: mat(0xc4a088), body: habit, arms: habit, legs: habit, boots: mat(0x3a3028) }, { chestW: 0.46, waistW: 0.4 });
  r.head.add(mesh(cone(0.23, 0.42, 6), habit, { y: 0.22, z: -0.06, rx: -0.2 }));
  r.head.add(mesh(box(0.2, 0.14, 0.05), mat(0xe8e4dc), { y: 0.03, z: 0.13 }));
  r.hips.add(mesh(cyl(0.22, 0.4, 0.84, 8, true), habit, { y: -0.4 }));
  r.torso.add(mesh(box(0.46, 0.04, 0.3), mat(0x8a6a3a), { y: 0.06 }));
  const staff = group();
  staff.add(mesh(cyl(0.025, 0.025, 1.7, 5), mat(0x4a3a2a), { rx: Math.PI / 2, z: 0.2 }));
  staff.add(mesh(cyl(0.035, 0.035, 0.4, 5), mat(0x5aa08a, { metalness: 0.6 }), { rx: Math.PI / 2, z: 1.0 }));
  staff.add(mesh(box(0.05, 0.05, 0.05), mat(0xcff0ff, { emissive: 0x60b0ff, emissiveIntensity: 1.6 }), { z: 1.1, shadow: false }));
  r.armL.hand.add(staff);
  mergeHumanoid(r);
  return r;
}

// ---------- the Hollow Bell ----------

// The Bell-Ringer: the thing the Hollow Bell was cast to keep asleep. A hollow giant in a mantle of
// tarnished bronze plates, a bell for a head with a glowing clapper for a face, chains hanging from
// its arms, and the great bell-hammer that rings the spire. Built at person size; the entity scales it.
export function buildBellRinger() {
  const bronze = mat(0x8a6a3c, { metalness: 0.6, roughness: 0.45 }), verd = mat(0x4f7a6a, { metalness: 0.4, roughness: 0.6 });
  const cloth = mat(0x2e2a34, { side: THREE.DoubleSide }), iron = mat(0x3a3836, { metalness: 0.55, roughness: 0.5 });
  const light = mat(0xffe2a8, { unique: true, emissive: 0xffb050, emissiveIntensity: 2.0 });
  const r = buildHumanoid({ skin: iron, body: bronze, arms: cloth, legs: cloth, boots: iron, hands: iron },
    { chestW: 0.66, chestD: 0.38, waistW: 0.5, shoulderW: 0.42, armW: 0.16 });
  // The bell head: a flared bronze bell, its clapper glowing where a face should be.
  r.head.add(mesh(cyl(0.16, 0.3, 0.42, 10), bronze, { y: 0.24 }));
  r.head.add(mesh(cyl(0.31, 0.31, 0.05, 10), verd, { y: 0.04 }));
  r.head.add(mesh(box(0.12, 0.06, 0.12), bronze, { y: 0.48 }));
  r.head.add(mesh(ico(0.08, 0), light, { y: 0.06, z: 0.05, shadow: false }));
  for (const s of [-1, 1]) (s < 0 ? r.armR : r.armL).shoulder.add(mesh(box(0.3, 0.16, 0.34), bronze, { y: 0.04 }));
  for (let i = 0; i < 3; i++) r.torso.add(mesh(box(0.7, 0.05, 0.4), verd, { y: 0.15 + i * 0.16 }));
  r.hips.add(mesh(cyl(0.3, 0.5, 0.9, 9, true), cloth, { y: -0.42 }));
  for (const arm of [r.armR, r.armL]) for (let i = 0; i < 4; i++) arm.elbow.add(mesh(box(0.05, 0.08, 0.05), iron, { y: -0.3 - i * 0.09, x: 0.09 })); // trailing chain
  // The bell-hammer: a long haft with a bell for its head.
  const hammer = group();
  hammer.add(mesh(cyl(0.04, 0.045, 1.8, 6), iron, { rx: Math.PI / 2, z: 0.55 }));
  hammer.add(mesh(cyl(0.16, 0.3, 0.42, 9), bronze, { rz: Math.PI / 2, z: 1.4 }));
  hammer.add(mesh(cyl(0.31, 0.31, 0.04, 9), verd, { rz: Math.PI / 2, z: 1.4, x: -0.2 }));
  r.armR.hand.add(hammer);
  const glow = glowSprite(0xffc070, 1.4, 0.6);
  glow.position.set(0, 0.1, 0.1);
  r.head.add(glow);
  mergeHumanoid(r, [glow]);
  return { ...r, light, glow };
}

// ---------- the Amberwood ----------

// Rustback Boars: bristling red-brown boars as big as a pony, with yellowed tusks and a ridge of stiff
// dark bristles. The hound's joint layout, so the hound's gaits drive them.
export function buildBoar() {
  const hide = mat(0x7a4a2e, { roughness: 0.95 }), dark = mat(0x4a2e1e, { roughness: 0.95 }), tusk = mat(0xe8dcb0);
  const eye = mat(0xffd070, { emissive: 0xff9a20, emissiveIntensity: 1.4 });
  const root = new THREE.Group();
  const body = group({ y: 0.66 });
  root.add(body);
  body.add(mesh(box(0.5, 0.5, 0.56), hide, { z: 0.2, y: 0.04 }));
  body.add(mesh(box(0.44, 0.44, 0.5), hide, { z: -0.3, y: 0.02 }));
  body.add(mesh(box(0.46, 0.3, 0.4), dark, { z: -0.02, y: -0.12 }));
  for (let i = 0; i < 6; i++) body.add(mesh(box(0.06, 0.14, 0.14), dark, { z: 0.42 - i * 0.16, y: 0.3 - Math.abs(i - 1.5) * 0.015 }));
  const neck = group({ y: 0.02, z: 0.46, rx: -0.2 });
  body.add(neck);
  neck.add(mesh(box(0.36, 0.36, 0.26), hide, { z: 0.08 }));
  const head = group({ z: 0.22, rx: 0.3 });
  neck.add(head);
  head.add(mesh(box(0.3, 0.28, 0.3), hide));
  head.add(mesh(box(0.2, 0.18, 0.26), dark, { z: 0.24, y: -0.04 }));
  head.add(mesh(box(0.16, 0.12, 0.04), mat(0x3a2a24), { z: 0.38, y: -0.04 })); // snout
  for (const x of [-0.1, 0.1]) {
    head.add(mesh(box(0.04, 0.03, 0.03), eye, { x, y: 0.06, z: 0.15, shadow: false }));
    head.add(mesh(box(0.08, 0.1, 0.03), dark, { x: x * 1.3, y: 0.18, z: -0.04, rz: x * 3 })); // ears
  }
  const jaw = group({ y: -0.12, z: 0.1 });
  head.add(jaw);
  jaw.add(mesh(box(0.16, 0.06, 0.26), dark, { z: 0.14 }));
  for (const x of [-0.08, 0.08]) jaw.add(mesh(cone(0.03, 0.2, 4), tusk, { x, y: 0.08, z: 0.28, rx: -0.5, rz: x * -3 }));
  const tail = group({ y: 0.12, z: -0.56, rx: -0.9 });
  body.add(tail);
  tail.add(mesh(box(0.04, 0.04, 0.22), dark, { z: -0.1 }));
  const legs = [];
  const mkLeg = (x, z, front) => {
    const hip = group({ x, y: -0.12, z });
    body.add(hip);
    hip.add(mesh(box(0.14, 0.28, 0.16), front ? hide : dark, { y: -0.12 }));
    const knee = group({ y: -0.26 });
    hip.add(knee);
    knee.add(mesh(box(0.09, 0.28, 0.1), dark, { y: -0.13 }));
    knee.add(mesh(box(0.1, 0.05, 0.12), mat(0x2a2220), { y: -0.27, z: 0.02 }));
    legs.push({ hip, knee, front, side: Math.sign(x) });
  };
  mkLeg(0.17, 0.3, true); mkLeg(-0.17, 0.3, true); mkLeg(0.16, -0.38, false); mkLeg(-0.16, -0.38, false);
  mergeRig(root, [body, neck, head, jaw, tail, ...legs.flatMap((l) => [l.hip, l.knee])]);
  return { root, body, neck, head, jaw, tail, legs, materials: { ember: eye } };
}

// Amberwood Poachers: hooded woodsmen in leaf-brown leathers who took the old lodge's hunting grounds
// for their own. A bearded hatchet and no shield; fast, mean, and fond of a backhand.
export function buildPoacher() {
  const leather = mat(0x6a4a2e), cloth = mat(0x8a5a2a, { side: THREE.DoubleSide }), hood = mat(0x4a5a2a, { side: THREE.DoubleSide });
  const r = buildHumanoid({ skin: mat(0xc49a78), body: leather, arms: cloth, legs: mat(0x4a3a2a), boots: mat(0x2e2420), hands: mat(0x5a3a22) }, { chestW: 0.5, waistW: 0.42 });
  r.head.add(mesh(cone(0.22, 0.34, 6), hood, { y: 0.26, z: -0.04, rx: -0.25 }));
  r.head.add(mesh(box(0.27, 0.12, 0.26), hood, { y: 0.24 }));
  r.head.add(mesh(box(0.2, 0.08, 0.04), mat(0x3a2a20), { y: 0.03, z: 0.13 })); // a mask of cloth
  r.torso.add(mesh(box(0.52, 0.05, 0.31), mat(0x3a2a1e), { y: 0.1 }));
  r.torso.add(mesh(box(0.06, 0.6, 0.06), mat(0x3a2a1e), { y: 0.36, z: 0.0, rz: 0.7 })); // a strap
  const quiver = group({ y: 0.4, z: -0.18, rz: 0.4 });
  quiver.add(mesh(cyl(0.06, 0.06, 0.5, 6), mat(0x5a3a22)));
  for (let i = 0; i < 3; i++) quiver.add(mesh(box(0.02, 0.2, 0.02), mat(0xd8d0c0), { x: (i - 1) * 0.03, y: 0.32 }));
  r.torso.add(quiver);
  r.hips.add(mesh(box(0.42, 0.34, 0.02), cloth, { y: -0.18, z: 0.15 }));
  const axe = group();
  axe.add(mesh(box(0.04, 0.04, 0.62), mat(0x5a3e28), { z: 0.2 }));
  axe.add(mesh(box(0.025, 0.24, 0.18), mat(0x9a9890, { metalness: 0.6, roughness: 0.4 }), { z: 0.48, y: 0.08 }));
  r.armR.hand.add(axe);
  const mid = group({ z: 0.3 }), tip = group({ z: 0.55 });
  r.armR.hand.add(mid, tip);
  mergeHumanoid(r);
  return { ...r, markers: { mid, tip } };
}

// Barkhusks: old oaks that got up and walked when the king's wood went wrong. A body of grey-brown bark
// with amber sap glowing in the cracks, arms like boughs ending in knotted root-fists, a crown of
// red leaves. Built at person size and scaled up.
export function buildBarkhusk() {
  const bark = mat(0x5a4636, { roughness: 0.95 }), bark2 = mat(0x6e5a44, { roughness: 0.95 });
  const sap = mat(0xffc860, { unique: true, emissive: 0xff8a20, emissiveIntensity: 1.4 });
  const leaf = mat(0xb8442a), leaf2 = mat(0xd8862e);
  const r = buildHumanoid({ skin: bark2, body: bark, arms: bark2, legs: bark, boots: bark2, hands: bark },
    { chestW: 0.7, chestD: 0.44, waistW: 0.5, shoulderW: 0.44, armW: 0.19, legW: 0.22, headW: 0.3, headH: 0.3 });
  r.torso.add(mesh(box(0.06, 0.4, 0.04), sap, { x: -0.1, y: 0.36, z: 0.23, rz: 0.2, shadow: false }));
  r.torso.add(mesh(box(0.3, 0.05, 0.04), sap, { x: 0.08, y: 0.48, z: 0.23, rz: -0.2, shadow: false }));
  for (const x of [-0.07, 0.07]) r.head.add(mesh(box(0.06, 0.04, 0.03), sap, { x, y: 0.17, z: 0.16, shadow: false }));
  r.head.add(mesh(box(0.12, 0.05, 0.03), mat(0x2a1e16), { y: 0.06, z: 0.16 }));
  // A crown of red leaves and broken branches.
  r.head.add(mesh(ico(0.3, 0), leaf, { y: 0.44, x: 0.05 }));
  r.head.add(mesh(ico(0.22, 0), leaf2, { y: 0.5, x: -0.18, z: -0.06 }));
  r.head.add(mesh(box(0.05, 0.4, 0.05), bark, { x: 0.18, y: 0.5, rz: -0.6 }));
  r.torso.add(mesh(ico(0.3, 0), leaf2, { y: 0.66, x: 0.3, z: -0.1 }));
  r.torso.add(mesh(ico(0.26, 0), leaf, { y: 0.62, x: -0.3, z: -0.12 }));
  for (const arm of [r.armR, r.armL]) {
    arm.hand.add(mesh(ico(0.18, 0), bark2, { y: -0.04 }));
    for (let i = 0; i < 3; i++) arm.hand.add(mesh(box(0.05, 0.22, 0.05), bark, { x: (i - 1) * 0.07, y: -0.16, rz: (i - 1) * 0.3 }));
    arm.shoulder.add(mesh(box(0.05, 0.3, 0.05), bark2, { y: 0.2, x: 0.08, rz: -0.5 }));
  }
  mergeHumanoid(r);
  return { ...r, magma: sap };
}

// Hornwood, the Antlered King: the old king of the wood, who made a pact with it and was crowned with
// a stag's antlers that grew through his helm. Tall and gaunt, a cloak of red and gold leaves, a
// stag's skull for a face with amber eyes, and a long greatblade carved from a single antler.
export function buildAntlerKing() {
  const cloak = mat(0x8a3a24, { side: THREE.DoubleSide }), cloak2 = mat(0xc8742e, { side: THREE.DoubleSide });
  const bone = mat(0xe8dcc0), wood = mat(0x4a3626), gold = mat(0xc8a040, { metalness: 0.6, roughness: 0.4 });
  const eye = mat(0xffd060, { unique: true, emissive: 0xffa020, emissiveIntensity: 2.0 });
  const r = buildHumanoid({ skin: bone, body: mat(0x5a3e2a), arms: wood, legs: mat(0x3a2a1e), boots: wood, hands: wood },
    { chestW: 0.56, waistW: 0.42, shoulderW: 0.38, armW: 0.13, headW: 0.22, headH: 0.3 });
  // The stag-skull face, and antlers branching high above.
  r.head.add(mesh(box(0.16, 0.12, 0.22), bone, { y: 0.08, z: 0.12 }));
  for (const x of [-0.06, 0.06]) r.head.add(mesh(box(0.045, 0.03, 0.02), eye, { x, y: 0.2, z: 0.13, shadow: false }));
  r.head.add(mesh(cyl(0.15, 0.16, 0.06, 8), gold, { y: 0.32 })); // the old crown, sunk into the bone
  const antlers = group({ y: 0.34 });
  for (const s of [-1, 1]) {
    const beam = group({ x: s * 0.09, rz: -s * 0.6 });
    beam.add(mesh(box(0.05, 0.7, 0.05), bone, { y: 0.35 }));
    for (let i = 0; i < 4; i++) beam.add(mesh(box(0.035, 0.28 - i * 0.04, 0.035), bone, { y: 0.15 + i * 0.16, x: -s * 0.08, rz: s * 0.9, rx: (i % 2 ? 0.3 : -0.3) }));
    const top = group({ y: 0.68, rz: s * 0.5 });
    top.add(mesh(box(0.04, 0.4, 0.04), bone, { y: 0.2 }));
    top.add(mesh(box(0.03, 0.22, 0.03), bone, { y: 0.24, x: s * 0.08, rz: -s * 0.8 }));
    beam.add(top);
    antlers.add(beam);
  }
  r.head.add(antlers);
  // The leaf cloak: layered mantle and a long skirt of leaves.
  r.torso.add(mesh(box(0.66, 0.14, 0.38), cloak, { y: 0.58 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI - Math.PI / 2;
    r.torso.add(mesh(box(0.14, 0.4, 0.03), i % 2 ? cloak : cloak2, { x: Math.sin(a) * 0.3, y: 0.38, z: -0.16 - Math.cos(a) * 0.05, rx: 0.15 }));
  }
  for (let i = 0; i < 3; i++) r.hips.add(mesh(cyl(0.26 + i * 0.07, 0.38 + i * 0.08, 0.36, 8, true), i % 2 ? cloak2 : cloak, { y: -0.14 - i * 0.28 }));
  for (const s of [-1, 1]) (s < 0 ? r.armR : r.armL).shoulder.add(mesh(box(0.24, 0.12, 0.28), cloak2, { y: 0.04 }));
  // The antler greatblade.
  const blade = group();
  blade.add(mesh(cyl(0.03, 0.035, 0.5, 6), wood, { rx: Math.PI / 2, z: 0.05 }));
  blade.add(mesh(box(0.22, 0.05, 0.06), gold, { z: 0.3 }));
  blade.add(mesh(box(0.08, 0.04, 1.3), bone, { z: 0.98 }));
  for (let i = 0; i < 3; i++) blade.add(mesh(box(0.03, 0.03, 0.26), bone, { z: 0.7 + i * 0.32, x: 0.08, ry: -0.6 }));
  blade.add(mesh(box(0.012, 0.02, 1.2), eye, { z: 0.98, y: 0.025, shadow: false }));
  r.armR.hand.add(blade);
  const glow = glowSprite(0xffb040, 1.4, 0.55);
  glow.position.set(0, 0.2, 0.14);
  r.head.add(glow);
  mergeHumanoid(r, [antlers, blade, glow]);
  return { ...r, eye, glow };
}

// Edda, the lodge's last huntress: grey braid, a green hood, a longbow on her back.
export function buildEdda() {
  const hood = mat(0x4a6a3a, { side: THREE.DoubleSide }), leather = mat(0x7a5a3a);
  const r = buildHumanoid({ skin: mat(0xc8a084), body: leather, arms: hood, legs: mat(0x4a3a2a), boots: mat(0x3a2a1e) }, { chestW: 0.48, waistW: 0.4 });
  r.head.add(mesh(box(0.27, 0.12, 0.27), hood, { y: 0.26 }));
  r.head.add(mesh(box(0.08, 0.36, 0.06), mat(0xb8b4ac), { y: 0.0, z: -0.15 })); // the braid
  r.hips.add(mesh(box(0.42, 0.34, 0.02), hood, { y: -0.18, z: 0.15 }));
  const bow = group({ y: 0.36, z: -0.2, rz: 0.5 });
  bow.add(mesh(box(0.04, 1.3, 0.04), mat(0x6a4a2a)));
  bow.add(mesh(box(0.01, 1.24, 0.01), mat(0xe8e0d0), { z: -0.06 }));
  r.torso.add(bow);
  mergeHumanoid(r);
  return r;
}

// ---------- the Shardlands ----------

// Shardback Lizards: long, low lizards of the steppe with a ridge of crystal growing from their backs,
// pale lilac scales and eyes like chips of glass. The hound's layout once more.
export function buildShardback() {
  const scale = mat(0x8a82a0, { roughness: 0.8 }), belly = mat(0xc8c0d4, { roughness: 0.8 });
  const glass = mat(0xd0f0ff, { emissive: 0x6a50d0, emissiveIntensity: 0.9, roughness: 0.15, flatShading: true });
  const eye = mat(0xe0f8ff, { emissive: 0x60e0ff, emissiveIntensity: 2.0 });
  const root = new THREE.Group();
  const body = group({ y: 0.42 });
  root.add(body);
  body.add(mesh(box(0.42, 0.24, 0.9), scale, { z: 0.0 }));
  body.add(mesh(box(0.36, 0.08, 0.86), belly, { y: -0.12 }));
  for (let i = 0; i < 5; i++) body.add(mesh(ico(0.08 + (i % 2) * 0.04, 0), glass, { y: 0.16 + (i % 2) * 0.05, z: 0.34 - i * 0.18, x: (i % 2 ? 0.05 : -0.05), shadow: false }));
  const neck = group({ y: 0.02, z: 0.46, rx: -0.15 });
  body.add(neck);
  neck.add(mesh(box(0.24, 0.18, 0.26), scale, { z: 0.1 }));
  const head = group({ z: 0.24, rx: 0.15 });
  neck.add(head);
  head.add(mesh(box(0.26, 0.14, 0.32), scale, { z: 0.08 }));
  for (const x of [-0.1, 0.1]) head.add(mesh(box(0.05, 0.04, 0.04), eye, { x, y: 0.06, z: 0.12, shadow: false }));
  head.add(mesh(ico(0.06, 0), glass, { y: 0.1, z: -0.02, shadow: false }));
  const jaw = group({ y: -0.06, z: 0.04 });
  head.add(jaw);
  jaw.add(mesh(box(0.22, 0.04, 0.3), belly, { z: 0.12 }));
  const tail = group({ y: 0.0, z: -0.46, rx: 0.15 });
  body.add(tail);
  tail.add(mesh(box(0.2, 0.14, 0.5), scale, { z: -0.24 }));
  tail.add(mesh(box(0.1, 0.08, 0.5), scale, { z: -0.7 }));
  tail.add(mesh(ico(0.07, 0), glass, { z: -0.95, shadow: false }));
  const legs = [];
  const mkLeg = (x, z, front) => {
    const hip = group({ x, y: -0.04, z, rz: -Math.sign(x) * 0.9 });
    body.add(hip);
    hip.add(mesh(box(0.1, 0.24, 0.1), scale, { y: -0.1 }));
    const knee = group({ y: -0.22, rz: Math.sign(x) * 0.9 });
    hip.add(knee);
    knee.add(mesh(box(0.07, 0.22, 0.07), scale, { y: -0.1 }));
    knee.add(mesh(box(0.12, 0.04, 0.14), belly, { y: -0.21, z: 0.03 }));
    legs.push({ hip, knee, front, side: Math.sign(x) });
  };
  mkLeg(0.22, 0.3, true); mkLeg(-0.22, 0.3, true); mkLeg(0.22, -0.3, false); mkLeg(-0.22, -0.3, false);
  mergeRig(root, [body, neck, head, jaw, tail, ...legs.flatMap((l) => [l.hip, l.knee])]);
  return { root, body, neck, head, jaw, tail, legs, materials: { ember: eye } };
}

// Glass-Mad Miners: Pell's old crew, who dug too deep and came up with crystal growing out of them.
// Grimy leathers, a lamp on the brow gone violet, shards jutting from their shoulders, a pick.
export function buildGlassMiner() {
  const leather = mat(0x5a4a3e), cloth = mat(0x6a6070), glass = mat(0xd0f0ff, { emissive: 0x7a50d0, emissiveIntensity: 0.9, roughness: 0.15, flatShading: true });
  const r = buildHumanoid({ skin: mat(0xa8a0b0), body: leather, arms: cloth, legs: mat(0x3e3a40), boots: mat(0x2a2628), hands: mat(0x4a4040) }, { chestW: 0.52, waistW: 0.44 });
  r.head.add(mesh(cyl(0.15, 0.17, 0.12, 8), mat(0x6a5a3a, { metalness: 0.4 }), { y: 0.3 }));
  r.head.add(mesh(box(0.08, 0.06, 0.04), mat(0xe0d0ff, { emissive: 0xa070ff, emissiveIntensity: 2 }), { y: 0.3, z: 0.16, shadow: false }));
  for (const x of [-0.05, 0.05]) r.head.add(mesh(box(0.035, 0.025, 0.02), mat(0xe0f8ff, { emissive: 0x80c0ff, emissiveIntensity: 2 }), { x, y: 0.15, z: 0.135, shadow: false }));
  for (const s of [-1, 1]) {
    const sh = (s < 0 ? r.armR : r.armL).shoulder;
    sh.add(mesh(ico(0.08, 0), glass, { y: 0.14, x: s * -0.04, shadow: false }));
    sh.add(mesh(cone(0.05, 0.26, 4), glass, { y: 0.2, rz: s * 0.4, shadow: false }));
  }
  r.torso.add(mesh(cone(0.07, 0.3, 4), glass, { y: 0.56, z: -0.16, rx: -0.6, shadow: false }));
  r.hips.add(mesh(box(0.46, 0.12, 0.3), mat(0x3a2e24), { y: 0.0 }));
  const pick = group();
  pick.add(mesh(box(0.04, 0.04, 0.8), mat(0x5a3e28), { z: 0.26 }));
  pick.add(mesh(box(0.04, 0.5, 0.05), mat(0x8a8890, { metalness: 0.6, roughness: 0.4 }), { z: 0.62, rx: 0.15 }));
  pick.add(mesh(cone(0.03, 0.12, 4), glass, { z: 0.62, y: 0.3, shadow: false }));
  r.armR.hand.add(pick);
  const mid = group({ z: 0.4 }), tip = group({ z: 0.7 });
  r.armR.hand.add(mid, tip);
  mergeHumanoid(r);
  return { ...r, markers: { mid, tip } };
}

// Prism Wraiths: shapes of folded light that drift over the steppe, throwing splinters of crystal.
export function buildPrismWraith() {
  const robe = mat(0xd8d0f0, { roughness: 0.4, emissive: 0x6a4ab0, emissiveIntensity: 0.55, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });
  const shroud = mat(0xa8a0d0, { roughness: 0.4, emissive: 0x4a3a90, emissiveIntensity: 0.5, side: THREE.DoubleSide });
  const glass = mat(0xe8f8ff, { emissive: 0x70d0ff, emissiveIntensity: 1.2, roughness: 0.1, flatShading: true });
  const eye = mat(0xffffff, { emissive: 0xc090ff, emissiveIntensity: 3 });
  const r = buildHumanoid({ skin: shroud, body: robe, arms: robe, legs: robe, boots: robe, hands: glass }, { chestW: 0.44, waistW: 0.34 });
  for (const leg of [r.legR, r.legL]) for (const g of [leg.hip, leg.knee]) for (const c of [...g.children]) if (c.isMesh) g.remove(c);
  r.head.add(mesh(cone(0.24, 0.5, 4), shroud, { y: 0.2, z: -0.05, ry: Math.PI / 4 }));
  r.head.add(mesh(box(0.2, 0.18, 0.06), mat(0x14102a), { y: 0.06, z: 0.12 }));
  for (const x of [-0.05, 0.05]) r.head.add(mesh(box(0.035, 0.025, 0.02), eye, { x, y: 0.08, z: 0.155, shadow: false }));
  r.hips.add(mesh(cyl(0.2, 0.42, 1.0, 6, true), robe, { y: -0.5 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    r.hips.add(mesh(cone(0.06, 0.4, 4), glass, { x: Math.sin(a) * 0.38, y: -1.0, z: Math.cos(a) * 0.38, rx: Math.PI, shadow: false }));
  }
  r.torso.add(mesh(ico(0.12, 0), glass, { y: 0.44, z: 0.16, shadow: false }));
  for (const arm of [r.armR, r.armL]) for (let i = 0; i < 3; i++) arm.hand.add(mesh(cone(0.02, 0.2, 4), glass, { x: (i - 1) * 0.035, y: -0.12, rx: Math.PI }));
  mergeHumanoid(r);
  return r;
}

// Prism Golems: the Shardlands' elites, boulders of pale stone with crystal growing through them like
// bones, a geode of a head that glows from inside.
export function buildPrismGolem() {
  const rock = mat(0x8a8496, { roughness: 0.9 }), rock2 = mat(0x6e687c, { roughness: 0.9 });
  const glow = mat(0xe0f0ff, { unique: true, emissive: 0x8a60ff, emissiveIntensity: 1.6, roughness: 0.15, flatShading: true });
  const glass = mat(0xd0f0ff, { emissive: 0x5a9ad0, emissiveIntensity: 0.8, roughness: 0.15, flatShading: true });
  const r = buildHumanoid({ skin: rock2, body: rock, arms: rock2, legs: rock, boots: rock2, hands: rock },
    { chestW: 0.72, chestD: 0.44, waistW: 0.5, shoulderW: 0.46, armW: 0.2, legW: 0.22, headW: 0.32, headH: 0.26 });
  r.head.add(mesh(ico(0.12, 0), glow, { y: 0.16, z: 0.12, shadow: false }));
  r.torso.add(mesh(box(0.84, 0.36, 0.5), rock2, { y: 0.5 }));
  for (const [x, y, rz, h] of [[0.28, 0.82, -0.3, 0.5], [-0.24, 0.86, 0.35, 0.6], [0.02, 0.9, 0.05, 0.42], [-0.4, 0.7, 0.8, 0.34]]) r.torso.add(mesh(cone(0.1, h, 4), glass, { x, y, z: -0.12, rz, shadow: false }));
  r.torso.add(mesh(ico(0.14, 0), glow, { y: 0.36, z: 0.22, shadow: false })); // the heart-stone
  for (const arm of [r.armR, r.armL]) {
    arm.hand.add(mesh(ico(0.2, 0), rock2, { y: -0.04 }));
    arm.elbow.add(mesh(cone(0.06, 0.3, 4), glass, { y: -0.1, x: 0.12, rz: -1.0, shadow: false }));
  }
  mergeHumanoid(r);
  return { ...r, magma: glow };
}

// Corundel, the Glass Colossus: the Heart of Glass given a body. A giant of clear and violet crystal
// grown around a core of white light, shoulders of jagged shards, a faceted head with no face at all.
export function buildColossus() {
  const clear = mat(0xd8ecf8, { roughness: 0.12, metalness: 0.15, emissive: 0x3a5a9a, emissiveIntensity: 0.5, flatShading: true });
  const violet = mat(0xb898e8, { roughness: 0.15, metalness: 0.1, emissive: 0x5a3a9a, emissiveIntensity: 0.6, flatShading: true });
  const stone = mat(0x6e687c, { roughness: 0.9 });
  const core = mat(0xffffff, { unique: true, emissive: 0xd0c0ff, emissiveIntensity: 2.2 });
  const r = buildHumanoid({ skin: clear, body: violet, arms: clear, legs: stone, boots: violet, hands: clear },
    { chestW: 0.7, chestD: 0.42, waistW: 0.46, shoulderW: 0.44, armW: 0.17, legW: 0.2, headW: 0.26, headH: 0.32 });
  r.head.add(mesh(ico(0.2, 0), clear, { y: 0.2 }));
  r.head.add(mesh(cone(0.08, 0.3, 4), violet, { y: 0.42, shadow: false }));
  r.torso.add(mesh(ico(0.16, 0), core, { y: 0.42, z: 0.14, shadow: false }));
  for (const s of [-1, 1]) {
    const sh = (s < 0 ? r.armR : r.armL).shoulder;
    for (let i = 0; i < 3; i++) sh.add(mesh(cone(0.07, 0.36 - i * 0.06, 4), i % 2 ? violet : clear, { y: 0.16, x: s * -0.02 + (i - 1) * 0.06, rz: s * (0.2 + i * 0.35), shadow: false }));
  }
  for (const [x, rz] of [[0.18, -0.3], [-0.16, 0.3], [0, 0]]) r.torso.add(mesh(cone(0.09, 0.5, 4), violet, { x, y: 0.72, z: -0.16, rz, rx: -0.3, shadow: false }));
  for (const arm of [r.armR, r.armL]) {
    arm.hand.add(mesh(ico(0.17, 0), violet, { y: -0.06 }));
    for (let i = 0; i < 3; i++) arm.hand.add(mesh(cone(0.03, 0.2, 4), clear, { x: (i - 1) * 0.06, y: -0.2, rx: Math.PI }));
  }
  const glow = glowSprite(0xc0a8ff, 1.8, 0.6);
  glow.position.set(0, 0.42, 0.18);
  r.torso.add(glow);
  mergeHumanoid(r, [glow]);
  return { ...r, core, glow };
}

// Pell, the glass-cutter: a stout old miner with goggles pushed up, a leather apron full of tools.
export function buildPell() {
  const apron = mat(0x6a4a2e), shirt = mat(0x8a7a6a);
  const r = buildHumanoid({ skin: mat(0xd0a888), body: shirt, arms: shirt, legs: mat(0x4a4038), boots: mat(0x2e2620) }, { chestW: 0.56, waistW: 0.52 });
  r.head.add(mesh(box(0.25, 0.06, 0.04), mat(0x3a3a3a), { y: 0.3, z: 0.12 }));
  for (const x of [-0.06, 0.06]) r.head.add(mesh(cyl(0.04, 0.04, 0.03, 8), mat(0xc8e8ff, { emissive: 0x4080c0, emissiveIntensity: 0.6 }), { x, y: 0.3, z: 0.14, rx: Math.PI / 2 }));
  r.head.add(mesh(box(0.2, 0.1, 0.06), mat(0xd8d0c8), { y: 0.02, z: 0.12 })); // a white beard
  r.torso.add(mesh(box(0.5, 0.56, 0.04), apron, { y: 0.26, z: 0.16 }));
  r.torso.add(mesh(box(0.12, 0.1, 0.03), mat(0x8a8890, { metalness: 0.6 }), { x: 0.12, y: 0.2, z: 0.19 }));
  mergeHumanoid(r);
  return r;
}
