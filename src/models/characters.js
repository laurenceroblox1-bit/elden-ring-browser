// Character models built from the shared humanoid rig. All original designs.
import * as THREE from '../lib/three.js';
import { buildHumanoid, mergeHumanoid } from './humanoid.js';
import { mat, mesh, box, cyl, cone, group, glowSprite } from './kit.js';
import { equipModel } from './weapons.js';

function addWeaponMarkers(handGroup, length) {
  const mid = group({ z: length * 0.55 });
  const tip = group({ z: length });
  handGroup.add(mid, tip);
  return { mid, tip };
}

// The Unbound: the player. Weathered steel, teal cloak. Weapons and shields come from models/weapons.js.
export function buildPlayer() {
  const steel = mat(0x7d828a, { metalness: 0.55, roughness: 0.45 });
  const darkSteel = mat(0x4a4e55, { metalness: 0.5, roughness: 0.5 });
  const leather = mat(0x3b2f25);
  const cloth = mat(0x2d4a4c, { side: THREE.DoubleSide });
  const trim = mat(0xb08d4a, { metalness: 0.6, roughness: 0.4 });
  const r = buildHumanoid({ skin: darkSteel, body: steel, arms: darkSteel, legs: leather, boots: darkSteel, hands: leather });

  // Helmet with a visor slit and crest.
  r.head.add(mesh(box(0.3, 0.32, 0.32), steel, { y: 0.16 }));
  r.head.add(mesh(box(0.22, 0.03, 0.02), mat(0x111111), { y: 0.18, z: 0.165, shadow: false }));
  r.head.add(mesh(box(0.04, 0.1, 0.3), trim, { y: 0.36 }));
  // Pauldrons, belt and tabard.
  r.armR.shoulder.add(mesh(box(0.22, 0.12, 0.26), steel, { y: 0.02, x: -0.03 }));
  r.armL.shoulder.add(mesh(box(0.22, 0.12, 0.26), steel, { y: 0.02, x: 0.03 }));
  r.torso.add(mesh(box(0.47, 0.06, 0.28), trim, { y: 0.02 }));
  r.hips.add(mesh(box(0.3, 0.42, 0.02), cloth, { y: -0.22, z: 0.15 }));

  // Cloak hangs from the shoulders; its pivot sways with speed.
  const cloak = group({ y: 0.56, z: -0.17 });
  const cloakGeo = new THREE.PlaneGeometry(0.6, 1.15, 1, 4);
  cloakGeo.translate(0, -0.575, 0);
  cloak.add(mesh(cloakGeo, cloth));
  r.torso.add(cloak);

  // Flask in the off hand, only shown while drinking.
  const flask = group();
  flask.add(mesh(cyl(0.05, 0.07, 0.16, 6), mat(0xd9c46a, { emissive: 0x8a6d1d, emissiveIntensity: 1.4 })));
  flask.visible = false;
  r.armL.hand.add(flask);

  // The cloak sways and the flask blinks in and out, so they stay separate; gear goes in after the merge.
  mergeHumanoid(r, [cloak, flask]);
  const out = { ...r, cloak, flask };
  equipModel(out, 'wayfarer_blade', null);
  return out;
}

// Hollow sentries: rusted kettle helms, ragged cloth, sword and round shield.
export function buildSentry(captain = false) {
  const rust = mat(captain ? 0x6b5a4a : 0x6e5a44, { metalness: 0.35, roughness: 0.7 });
  const cloth = mat(captain ? 0x6e2a24 : 0x524636);
  const skin = mat(0x8a8f7c);
  const r = buildHumanoid({ skin, body: cloth, arms: skin, legs: mat(0x3e372c), boots: rust, hands: skin }, { chestW: 0.5 });

  r.torso.add(mesh(box(0.5, 0.3, 0.32), rust, { y: 0.43 }));
  r.head.add(mesh(cyl(0.3, 0.3, 0.04, 8), rust, { y: 0.24 }));
  r.head.add(mesh(cyl(0.12, 0.17, 0.14, 8), rust, { y: 0.3 }));
  r.head.add(mesh(box(0.14, 0.03, 0.02), mat(0xe0b060, { emissive: 0xa06a20, emissiveIntensity: 1.2 }), { y: 0.15, z: 0.135, shadow: false }));
  if (captain) {
    r.head.add(mesh(box(0.05, 0.28, 0.24), mat(0x9b2d22), { y: 0.48 }));
    r.armR.shoulder.add(mesh(box(0.22, 0.12, 0.26), rust, { y: 0.02 }));
    r.armL.shoulder.add(mesh(box(0.22, 0.12, 0.26), rust, { y: 0.02 }));
  }
  r.hips.add(mesh(box(0.4, 0.36, 0.02), cloth, { y: -0.2, z: 0.15 }));

  const blade = mat(0x9a948a, { metalness: 0.6, roughness: 0.5 });
  const sword = group();
  sword.add(mesh(box(0.04, 0.04, 0.2), mat(0x2b241d)));
  sword.add(mesh(box(0.2, 0.035, 0.04), rust, { z: 0.1 }));
  sword.add(mesh(box(0.07, 0.016, captain ? 1.05 : 0.85), blade, { z: captain ? 0.63 : 0.53 }));
  r.armR.hand.add(sword);
  const markers = addWeaponMarkers(r.armR.hand, captain ? 1.15 : 0.95);

  const shield = mesh(cyl(0.34, 0.34, 0.05, 10), rust, { rz: Math.PI / 2, x: 0.07 });
  shield.add(mesh(cyl(0.08, 0.08, 0.06, 6), mat(0x3a3128), { y: 0.03 }));
  r.armL.elbow.add(shield);
  shield.position.y = -0.18;

  if (captain) r.root.scale.setScalar(1.15);
  mergeHumanoid(r); // sword and shield never leave a sentry's hands, so they merge too
  return { ...r, markers };
}

// The Bell-Warden: towering robed keeper of the Shattered Gate. A bronze bell for a helm,
// a bell-headed war maul, and a lantern of grave-fire at the hip.
export function buildWarden() {
  const robe = mat(0x4a4640, { side: THREE.DoubleSide });
  const inner = mat(0x2b2926);
  const bronze = mat(0x8c6a3c, { metalness: 0.7, roughness: 0.38 });
  const verdigris = mat(0x4f7a6a, { metalness: 0.4, roughness: 0.6 });
  const skin = mat(0x6e6a62);
  const eye = mat(0xffb04a, { unique: true, emissive: 0xff8a20, emissiveIntensity: 2.2 });
  const r = buildHumanoid({ skin, body: robe, arms: robe, legs: inner, boots: inner, hands: skin },
    { chestW: 0.62, chestD: 0.36, shoulderW: 0.4, armW: 0.16, upperArm: 0.4, foreArm: 0.38 });

  // Bell helm with a single burning slit.
  r.head.add(mesh(cyl(0.15, 0.24, 0.38, 8), bronze, { y: 0.18 }));
  r.head.add(mesh(cyl(0.05, 0.08, 0.08, 6), bronze, { y: 0.4 }));
  r.head.add(mesh(cyl(0.25, 0.25, 0.04, 8), verdigris, { y: 0.0 }));
  r.head.add(mesh(box(0.2, 0.03, 0.03), eye, { y: 0.14, z: 0.2, shadow: false }));
  // Mantle, robe skirt, chains of small bells.
  r.torso.add(mesh(cyl(0.22, 0.5, 0.36, 8), robe, { y: 0.52 }));
  r.hips.add(mesh(cyl(0.3, 0.62, 0.92, 8, true), robe, { y: -0.44 }));
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    r.hips.add(mesh(cyl(0.035, 0.06, 0.08, 6), bronze, { x: Math.sin(a) * 0.36, y: -0.08, z: Math.cos(a) * 0.36 }));
  }
  // Grave-fire lantern at the left hip.
  const lantern = group({ x: 0.36, y: -0.22, z: 0.1 });
  lantern.add(mesh(box(0.14, 0.18, 0.14), bronze));
  lantern.add(mesh(box(0.1, 0.12, 0.1), mat(0xffc070, { emissive: 0xff8a2a, emissiveIntensity: 2 }), { shadow: false }));
  lantern.add(glowSprite(0xff9a40, 0.9, 0.7));
  r.hips.add(lantern);

  // The bell-maul: long iron haft, bronze bell head across the end.
  const maul = group();
  maul.add(mesh(cyl(0.045, 0.05, 2.1, 6), mat(0x2e2a26, { metalness: 0.5 }), { rx: Math.PI / 2, z: 0.55 }));
  const head = group({ z: 1.62 });
  const headMat = mat(0x8c6a3c, { unique: true, metalness: 0.7, roughness: 0.38, emissive: 0x3060ff, emissiveIntensity: 0 });
  head.add(mesh(cyl(0.2, 0.4, 0.52, 8), headMat, { rz: Math.PI / 2 }));
  head.add(mesh(cyl(0.42, 0.42, 0.05, 8), verdigris, { rz: Math.PI / 2, x: -0.27 }));
  head.add(mesh(cyl(0.08, 0.08, 0.2, 6), bronze, { rz: Math.PI / 2, x: 0.34 }));
  maul.add(head);
  r.armR.hand.add(maul);

  r.root.scale.setScalar(2.15);
  // The eye and the maul head animate through their own (unique) materials, which merging keeps.
  mergeHumanoid(r);
  return { ...r, eye, headMat, maulHead: head, lantern };
}

// Brannoc the stablemaster: hunched, long coat, wide hat.
export function buildBrannoc() {
  const coat = mat(0x5b4630);
  const r = buildHumanoid({ skin: mat(0xb08a6a), body: coat, arms: coat, legs: mat(0x3a3027), boots: mat(0x2a221b) });
  r.head.add(mesh(cyl(0.36, 0.36, 0.03, 10), mat(0x3a2c1f), { y: 0.3 }));
  r.head.add(mesh(cyl(0.15, 0.17, 0.16, 8), mat(0x3a2c1f), { y: 0.38 }));
  r.head.add(mesh(box(0.2, 0.16, 0.06), mat(0x9a9590), { y: 0.06, z: 0.13 }));
  r.hips.add(mesh(cyl(0.26, 0.36, 0.55, 8, true), mat(0x5b4630, { side: THREE.DoubleSide }), { y: -0.26 }));
  return mergeHumanoid(r);
}

// Sister Ilse: a pilgrim in pale robes with a hand-bell staff.
export function buildIlse() {
  const robe = mat(0xb9b2a0, { side: THREE.DoubleSide });
  const r = buildHumanoid({ skin: mat(0xc9a88a), body: robe, arms: robe, legs: robe, boots: mat(0x4a3f33) }, { chestW: 0.46, waistW: 0.38 });
  r.head.add(mesh(cone(0.22, 0.42, 6), robe, { y: 0.24, z: -0.03 }));
  r.hips.add(mesh(cyl(0.22, 0.4, 0.86, 8, true), robe, { y: -0.42 }));
  const staff = group();
  staff.add(mesh(cyl(0.025, 0.025, 1.7, 5), mat(0x5a4632), { rx: Math.PI / 2, z: 0.2 }));
  staff.add(mesh(cyl(0.05, 0.09, 0.1, 6), mat(0x8c6a3c, { metalness: 0.6 }), { z: 1.08 }));
  r.armL.hand.add(staff);
  return mergeHumanoid(r);
}

// Lantern Acolytes: hollowed keepers of the old lantern rites, hooded in ash-pale robes with a faceless
// dark under the cowl. Each carries a hooked lantern-staff and flings its fire. The flame material is
// unique per acolyte so a cast can brighten its own lantern.
export function buildAcolyte() {
  const robe = mat(0x9a8f7c, { side: THREE.DoubleSide });
  const hood = mat(0x5e554a, { side: THREE.DoubleSide });
  const skin = mat(0x8a8f7c);
  const rope = mat(0xc9b48a);
  const wood = mat(0x3e3226);
  const bronze = mat(0x8c6a3c, { metalness: 0.7, roughness: 0.38 });
  const flame = mat(0xffd08a, { unique: true, emissive: 0xff8a2a, emissiveIntensity: 1.6 });
  const r = buildHumanoid({ skin, body: robe, arms: robe, legs: hood, boots: wood, hands: skin },
    { chestW: 0.46, waistW: 0.4, shoulderW: 0.31, armW: 0.13 });

  // Deep cowl over a face of shadow, two pinpricks of ember for eyes.
  r.head.add(mesh(cone(0.25, 0.5, 6), hood, { y: 0.26, z: -0.05, rx: -0.12 }));
  r.head.add(mesh(box(0.2, 0.18, 0.04), mat(0x17130f), { y: 0.13, z: 0.12, shadow: false }));
  for (const x of [0.045, -0.045]) r.head.add(mesh(box(0.03, 0.02, 0.02), mat(0xffc070, { emissive: 0xff9030, emissiveIntensity: 2 }), { x, y: 0.15, z: 0.145, shadow: false }));
  // Mantle, rope belt with a dangling lantern charm, long robe.
  r.torso.add(mesh(cyl(0.2, 0.38, 0.26, 7), hood, { y: 0.5 }));
  r.torso.add(mesh(box(0.44, 0.05, 0.3), rope, { y: 0.04 }));
  r.hips.add(mesh(cyl(0.24, 0.42, 0.9, 7, true), robe, { y: -0.42 }));
  r.hips.add(mesh(box(0.05, 0.3, 0.02), rope, { x: 0.12, y: -0.18, z: 0.16 }));

  // The lantern-staff: a crooked haft with a caged flame hung from its hook.
  const staff = group();
  staff.add(mesh(cyl(0.025, 0.03, 1.5, 5), wood, { rx: Math.PI / 2, z: 0.4 }));
  staff.add(mesh(box(0.04, 0.04, 0.2), wood, { z: 1.2, y: -0.06, rx: 0.9 }));
  const lantern = group({ z: 1.25, y: -0.22 });
  lantern.add(mesh(box(0.15, 0.03, 0.15), bronze, { y: 0.1 }));
  lantern.add(mesh(box(0.15, 0.03, 0.15), bronze, { y: -0.1 }));
  lantern.add(mesh(box(0.1, 0.16, 0.1), flame, { shadow: false }));
  const glow = glowSprite(0xffa040, 0.8, 0.75);
  lantern.add(glow);
  staff.add(lantern);
  r.armR.hand.add(staff);

  mergeHumanoid(r);
  return { ...r, lantern, glow, flame };
}
