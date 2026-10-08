// Beasts of the Vale. Low-poly, jointed for procedural gaits like Wisp, and merged into a few skinned
// meshes (one per material) once built. All original designs.
import * as THREE from '../lib/three.js';
import { mat, mesh, box, cone, group, mergeRig } from './kit.js';

// Mire Hound: a starved ash-grey hound from the lake fogs. Ribs like a cage, a ridge of bone spurs
// down the spine, ember eyes and a smouldering maw. Faces +Z with its feet at the root.
// `mother` builds Vharra instead: soot-dark hide, a crown of bone, four eyes and a smouldering mane.
// `frost` builds a Rime Wolf: white and pale-grey coat, ice-blue eyes and maw, a ruff of frost.
export function buildHound({ mother = false, frost = false } = {}) {
  const hide = mat(mother ? 0x4a4644 : frost ? 0xd9dee2 : 0x6b6e6f, { roughness: 0.95 });
  const dark = mat(mother ? 0x2a2626 : frost ? 0x8e9aa6 : 0x3e4043, { roughness: 0.95 });
  const bone = mat(frost ? 0xbfd8e6 : 0xd8cfb8);
  const ember = frost ? mat(0xcff0ff, { emissive: 0x58b8ff, emissiveIntensity: 2.4 }) : mat(0xffb04a, { emissive: 0xff7a1a, emissiveIntensity: 2.4, unique: mother }); // hers flares in phase two
  const maw = frost ? mat(0x2a4a6a, { emissive: 0x3a8ad8, emissiveIntensity: 0.8 }) : mat(0x6a2414, { emissive: 0xff4a10, emissiveIntensity: 0.7 });

  const root = new THREE.Group();
  const body = group({ y: 0.7 });
  root.add(body);
  // Deep chest, wasp waist, bony haunch: the gaunt silhouette reads at a distance.
  body.add(mesh(box(0.4, 0.42, 0.46), hide, { z: 0.26, y: 0.02 }));
  body.add(mesh(box(0.26, 0.26, 0.44), dark, { z: -0.16, y: 0.06 }));
  body.add(mesh(box(0.34, 0.34, 0.34), hide, { z: -0.5, y: 0.04 }));
  for (let i = 0; i < 3; i++) body.add(mesh(box(0.43, 0.035, 0.045), bone, { z: 0.14 + i * 0.1, y: 0.02 - i * 0.03, rx: 0.25 }));
  // Spurs: five hooked cones down the spine, raked back and shrinking toward the tail.
  for (let i = 0; i < 5; i++) {
    const s = 1 - i * 0.14;
    body.add(mesh(cone(0.055 * s, 0.26 * s, 4), bone, { z: 0.36 - i * 0.22, y: 0.24 + (i === 2 ? -0.04 : 0), rx: -0.7 }));
  }

  const neck = group({ y: 0.12, z: 0.46, rx: -0.55 });
  body.add(neck);
  neck.add(mesh(box(0.19, 0.2, 0.38), hide, { z: 0.16 }));
  neck.add(mesh(cone(0.04, 0.16, 4), bone, { y: 0.12, z: 0.1, rx: -0.9 }));
  const head = group({ z: 0.36, rx: 0.55 });
  neck.add(head);
  head.add(mesh(box(0.24, 0.19, 0.24), hide));
  head.add(mesh(box(0.13, 0.1, 0.28), dark, { z: 0.24, y: -0.02 }));
  head.add(mesh(box(0.045, 0.035, 0.03), ember, { x: 0.075, y: 0.04, z: 0.12, shadow: false }));
  head.add(mesh(box(0.045, 0.035, 0.03), ember, { x: -0.075, y: 0.04, z: 0.12, shadow: false }));
  for (const x of [0.08, -0.08]) head.add(mesh(cone(0.045, 0.16, 4), dark, { x, y: 0.13, z: -0.08, rx: -0.75 }));
  // The jaw hinges open for the bite; the glow inside shows only when it gapes.
  const jaw = group({ y: -0.07, z: 0.06 });
  head.add(jaw);
  jaw.add(mesh(box(0.11, 0.045, 0.3), dark, { z: 0.15 }));
  jaw.add(mesh(box(0.08, 0.02, 0.22), maw, { z: 0.14, y: 0.03, shadow: false }));
  for (const x of [0.04, -0.04]) jaw.add(mesh(cone(0.016, 0.06, 3), bone, { x, y: 0.05, z: 0.27 }));

  if (frost) {
    // A ruff of frost along the neck and shoulders.
    for (let i = 0; i < 4; i++) neck.add(mesh(cone(0.05, 0.16, 4), mat(0xf2f8fc), { x: (i % 2 ? 1 : -1) * 0.08, y: 0.1, z: 0.28 - i * 0.08, rx: -0.6, rz: (i % 2 ? -1 : 1) * 0.4 }));
    body.add(mesh(box(0.44, 0.1, 0.4), mat(0xf2f8fc), { y: 0.22, z: 0.28 }));
  }
  if (mother) {
    // Ember mane down the neck and shoulders, a second pair of eyes, a crown of hooked horns, and a
    // glowing seam along the belly where the litter-fire burns.
    for (let i = 0; i < 4; i++) neck.add(mesh(box(0.05, 0.12 + i * 0.02, 0.07), ember, { y: 0.11, z: 0.3 - i * 0.09, rx: -0.4, shadow: false }));
    for (let i = 0; i < 3; i++) body.add(mesh(box(0.06, 0.1, 0.08), ember, { y: 0.24, z: 0.5 - i * 0.12, shadow: false }));
    for (const x of [0.06, -0.06]) head.add(mesh(box(0.035, 0.028, 0.03), ember, { x, y: 0.085, z: 0.09, shadow: false }));
    for (const x of [0.1, -0.1]) {
      head.add(mesh(cone(0.04, 0.24, 4), bone, { x, y: 0.12, z: 0.02, rx: -1.1, rz: x * -3 }));
      head.add(mesh(cone(0.03, 0.14, 4), bone, { x: x * 1.3, y: 0.02, z: -0.08, rx: -1.4, rz: x * -6 }));
    }
    body.add(mesh(box(0.14, 0.03, 0.5), maw, { y: -0.2, z: 0.1, shadow: false }));
    for (let i = 0; i < 4; i++) body.add(mesh(box(0.45, 0.04, 0.05), bone, { z: -0.36 - i * 0.08, y: 0.0 + i * 0.01, rx: 0.2 }));
  }

  const tail = group({ y: 0.12, z: -0.66, rx: -0.6 });
  body.add(tail);
  tail.add(mesh(box(0.06, 0.06, 0.46), dark, { z: -0.22 }));
  tail.add(mesh(cone(0.04, 0.14, 4), bone, { z: -0.5, rx: -Math.PI / 2 }));

  const legs = [];
  const mkLeg = (x, z, front) => {
    const hip = group({ x, y: -0.1, z });
    body.add(hip);
    hip.add(mesh(box(0.11, 0.32, 0.14), front ? hide : dark, { y: -0.15 }));
    const knee = group({ y: -0.3 });
    hip.add(knee);
    knee.add(mesh(box(0.075, 0.3, 0.085), dark, { y: -0.15 }));
    knee.add(mesh(box(0.1, 0.05, 0.15), dark, { y: -0.3, z: 0.03 }));
    if (!front) knee.add(mesh(cone(0.03, 0.12, 4), bone, { y: -0.02, z: -0.06, rx: -2.2 }));
    legs.push({ hip, knee, front, side: Math.sign(x) });
  };
  mkLeg(0.15, 0.3, true);
  mkLeg(-0.15, 0.3, true);
  mkLeg(0.14, -0.5, false);
  mkLeg(-0.14, -0.5, false);

  mergeRig(root, [body, neck, head, jaw, tail, ...legs.flatMap((l) => [l.hip, l.knee])]);
  return { root, body, neck, head, jaw, tail, legs, materials: { ember } };
}
