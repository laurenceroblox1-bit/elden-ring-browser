// Wisp, the spectral steed. Blocky like everything in the Vale, but built like a horse: a deep chest and
// a rounded rump, a crested neck with a glowing mane, a long head, jointed legs with fetlocks and hooves
// that trail spirit-light, a three-part tail, and a proper saddle with stirrups and reins.
// The animated groups (body, neck, head, tail, legs[hip, knee]) match what entities/Horse.js drives.
import * as THREE from '../lib/three.js';
import { mat, mesh, box, group, mergeRig } from './kit.js';

export function buildHorse() {
  const coat = mat(0xc8d0d4, { unique: true, emissive: 0x2a4050, emissiveIntensity: 0.6, roughness: 0.6, opacity: 0.95 });
  const dark = mat(0x6d7a80, { unique: true, emissive: 0x2a4050, emissiveIntensity: 0.5 });
  const spirit = mat(0xdff4ff, { unique: true, emissive: 0x8fd4ff, emissiveIntensity: 1.6, opacity: 0.85 });
  const leather = mat(0x4a3324);
  const leatherDark = mat(0x2e2018);
  const brass = mat(0xb08d4a, { metalness: 0.6, roughness: 0.4 });
  const cloth = mat(0x2d4a4c);
  const eye = mat(0xbfe8ff, { emissive: 0x8fd4ff, emissiveIntensity: 2.2 });

  const root = new THREE.Group();
  const body = group({ y: 1.45 });
  root.add(body);
  // Barrel: chest (deep, forward), middle, rump (higher and rounder), belly underneath.
  body.add(mesh(box(0.8, 0.86, 0.8), coat, { z: 0.66, y: 0.02 }));
  body.add(mesh(box(0.74, 0.72, 0.9), coat, { z: -0.02, y: 0.04 }));
  body.add(mesh(box(0.8, 0.8, 0.7), coat, { z: -0.72, y: 0.08 }));
  body.add(mesh(box(0.66, 0.2, 0.5), coat, { z: -0.9, y: 0.5 })); // croup
  body.add(mesh(box(0.6, 0.18, 1.4), dark, { y: -0.36 })); // belly
  body.add(mesh(box(0.7, 0.24, 0.5), coat, { z: 0.88, y: -0.3 })); // breast
  // Saddle: seat, raised pommel and cantle, blanket, girth strap, stirrups.
  body.add(mesh(box(0.9, 0.34, 0.74), cloth, { y: 0.3, z: 0.04 }));
  body.add(mesh(box(0.62, 0.1, 0.62), leather, { y: 0.47, z: 0.04 }));
  body.add(mesh(box(0.42, 0.14, 0.1), leatherDark, { y: 0.55, z: 0.34 }));
  body.add(mesh(box(0.52, 0.18, 0.1), leatherDark, { y: 0.56, z: -0.26 }));
  body.add(mesh(box(0.82, 0.06, 0.12), leatherDark, { y: -0.05, z: 0.18 }));
  for (const s of [-1, 1]) {
    body.add(mesh(box(0.02, 0.5, 0.04), leatherDark, { x: s * 0.46, y: 0.12, z: 0.06 }));
    body.add(mesh(box(0.1, 0.04, 0.14), brass, { x: s * 0.47, y: -0.15, z: 0.06 }));
  }

  // Neck: two blocks for a crested, arched line, with the mane in stepped glowing strands.
  const neck = group({ y: 0.3, z: 0.95, rx: 0.65 });
  body.add(neck);
  neck.add(mesh(box(0.42, 0.55, 0.56), coat, { y: 0.22 }));
  neck.add(mesh(box(0.34, 0.55, 0.46), coat, { y: 0.66, z: 0.02 }));
  for (let i = 0; i < 6; i++) {
    neck.add(mesh(box(0.06, 0.2, 0.16 + (i % 2) * 0.06), spirit, { y: 0.1 + i * 0.16, z: -0.26 - (i % 2) * 0.04, shadow: false }));
  }
  const head = group({ y: 0.92, rx: 0.05 });
  neck.add(head);
  head.add(mesh(box(0.34, 0.36, 0.42), coat, { z: 0.12 })); // skull
  head.add(mesh(box(0.28, 0.3, 0.42), coat, { z: 0.48, y: -0.04 })); // face
  head.add(mesh(box(0.26, 0.24, 0.24), dark, { z: 0.76, y: -0.08 })); // muzzle
  head.add(mesh(box(0.22, 0.08, 0.36), dark, { z: 0.56, y: -0.22 })); // jaw
  for (const s of [-1, 1]) {
    head.add(mesh(box(0.06, 0.2, 0.08), coat, { x: s * 0.11, y: 0.25, z: 0.02, rz: s * -0.15 })); // ears
    head.add(mesh(box(0.03, 0.06, 0.08), eye, { x: s * 0.175, y: 0.06, z: 0.22, shadow: false }));
    head.add(mesh(box(0.02, 0.04, 0.5), leatherDark, { x: s * 0.15, y: -0.02, z: 0.5 })); // bridle cheekpiece
    head.add(mesh(box(0.04, 0.04, 0.04), brass, { x: s * 0.15, y: -0.1, z: 0.74 })); // bit ring
    head.add(mesh(box(0.02, 0.02, 0.9), leatherDark, { x: s * 0.2, y: -0.28, z: 0.36, rx: 0.5 })); // reins
  }
  head.add(mesh(box(0.08, 0.18, 0.1), spirit, { y: 0.22, z: 0.16, rx: 0.4, shadow: false })); // forelock

  // Tail in three glowing pieces, each kinked a little further, so the tail reads as flowing.
  const tail = group({ y: 0.3, z: -1.08, rx: -0.5 });
  body.add(tail);
  tail.add(mesh(box(0.16, 0.36, 0.2), spirit, { y: -0.16, shadow: false }));
  tail.add(mesh(box(0.14, 0.34, 0.18), spirit, { y: -0.48, z: -0.04, rx: -0.2, shadow: false }));
  tail.add(mesh(box(0.1, 0.3, 0.14), spirit, { y: -0.78, z: -0.12, rx: -0.35, shadow: false }));

  const legs = [];
  const mkLeg = (x, z, phaseWalk, phaseGallop) => {
    const front = z > 0;
    const hip = group({ x, y: -0.22, z });
    body.add(hip);
    // Upper leg: forearm in front, a thicker gaskin behind.
    hip.add(mesh(box(front ? 0.2 : 0.24, 0.62, front ? 0.24 : 0.32), coat, { y: -0.3, z: front ? 0 : -0.03 }));
    const knee = group({ y: -0.62 });
    hip.add(knee);
    knee.add(mesh(box(0.15, 0.08, 0.17), coat, { y: -0.02 })); // knee / hock joint
    knee.add(mesh(box(0.12, 0.42, 0.14), dark, { y: -0.25 })); // cannon
    knee.add(mesh(box(0.14, 0.1, 0.16), dark, { y: -0.48, z: 0.02 })); // fetlock
    knee.add(mesh(box(0.17, 0.08, 0.2), leatherDark, { y: -0.57, z: 0.03 })); // hoof
    knee.add(mesh(box(0.2, 0.05, 0.22), spirit, { y: -0.6, z: 0.03, shadow: false })); // spirit-light at the hoof
    legs.push({ hip, knee, phaseWalk, phaseGallop, front });
  };
  mkLeg(0.24, 0.8, 0, 0);
  mkLeg(-0.24, 0.8, Math.PI, 0.35);
  mkLeg(0.25, -0.78, Math.PI * 0.5, Math.PI);
  mkLeg(-0.25, -0.78, Math.PI * 1.5, Math.PI + 0.35);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // Every static block becomes one skinned mesh per material; the gait still just turns the groups.
  mergeRig(root, [body, neck, head, tail, ...legs.flatMap((l) => [l.hip, l.knee])]);
  return { root, body, neck, head, tail, legs, materials: [coat, dark, spirit] };
}
