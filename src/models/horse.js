// Wisp, the spectral steed. Low-poly horse with jointed legs for a procedural gait.
import * as THREE from '../lib/three.js';
import { mat, mesh, box, cyl, group } from './kit.js';

export function buildHorse() {
  const coat = mat(0xc8d0d4, { unique: true, emissive: 0x2a4050, emissiveIntensity: 0.6, roughness: 0.6, opacity: 0.95 });
  const dark = mat(0x6d7a80, { unique: true, emissive: 0x2a4050, emissiveIntensity: 0.5 });
  const spirit = mat(0xdff4ff, { unique: true, emissive: 0x8fd4ff, emissiveIntensity: 1.6, opacity: 0.85 });
  const leather = mat(0x4a3324);

  const root = new THREE.Group();
  const body = group({ y: 1.45 });
  root.add(body);
  body.add(mesh(box(0.78, 0.78, 2.0), coat));
  body.add(mesh(box(0.84, 0.82, 0.7), coat, { z: 0.72, y: 0.04 }));
  body.add(mesh(box(0.8, 0.76, 0.6), coat, { z: -0.78 }));
  // Saddle and blanket.
  body.add(mesh(box(0.86, 0.1, 0.7), leather, { y: 0.42, z: 0.05 }));
  body.add(mesh(box(0.9, 0.36, 0.62), mat(0x2d4a4c), { y: 0.26, z: 0.05 }));

  const neck = group({ y: 0.28, z: 0.95, rx: 0.65 });
  body.add(neck);
  neck.add(mesh(box(0.36, 0.95, 0.5), coat, { y: 0.42 }));
  neck.add(mesh(box(0.08, 0.95, 0.3), spirit, { y: 0.45, z: -0.24, shadow: false }));
  const head = group({ y: 0.9, rx: 0.05 });
  neck.add(head);
  head.add(mesh(box(0.32, 0.36, 0.78), coat, { z: 0.3 }));
  head.add(mesh(box(0.26, 0.26, 0.3), dark, { z: 0.7, y: -0.05 }));
  head.add(mesh(box(0.06, 0.18, 0.08), coat, { x: 0.1, y: 0.24, z: 0.02 }));
  head.add(mesh(box(0.06, 0.18, 0.08), coat, { x: -0.1, y: 0.24, z: 0.02 }));
  head.add(mesh(box(0.34, 0.05, 0.05), spirit, { y: 0.08, z: 0.42, shadow: false }));

  const tail = group({ y: 0.25, z: -1.05, rx: -0.5 });
  body.add(tail);
  tail.add(mesh(box(0.14, 0.9, 0.18), spirit, { y: -0.45, shadow: false }));

  const legs = [];
  const mkLeg = (x, z, phaseWalk, phaseGallop) => {
    const hip = group({ x, y: -0.25, z });
    body.add(hip);
    hip.add(mesh(box(0.2, 0.6, 0.26), coat, { y: -0.3 }));
    const knee = group({ y: -0.6 });
    hip.add(knee);
    knee.add(mesh(box(0.14, 0.58, 0.16), dark, { y: -0.29 }));
    knee.add(mesh(box(0.18, 0.08, 0.2), spirit, { y: -0.6, shadow: false }));
    legs.push({ hip, knee, phaseWalk, phaseGallop, front: z > 0 });
  };
  mkLeg(0.25, 0.78, 0, 0);
  mkLeg(-0.25, 0.78, Math.PI, 0.35);
  mkLeg(0.25, -0.78, Math.PI * 0.5, Math.PI);
  mkLeg(-0.25, -0.78, Math.PI * 1.5, Math.PI + 0.35);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, neck, head, tail, legs, materials: [coat, dark, spirit] };
}
