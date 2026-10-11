// The Unbound's appearance: cloak colour, armour finish and a helm ornament, chosen on the Appearance
// screen (ui/AppearancePanel.js) and sent to other players as a short code (net/Net.js `lk`).
// applyLook() swaps the knight's shared cloth and steel materials for copies in the chosen colours, so
// enemies built from the same cached materials are untouched, and hangs the ornament on the helm.
import * as THREE from '../lib/three.js';
import { mat, mesh, box, cone, group } from './kit.js';

export const CLOAKS = [
  ['teal', 'Teal', 0x2d4a4c], ['crimson', 'Crimson', 0x8a3a30], ['royal', 'Royal blue', 0x3a5a8a], ['ochre', 'Ochre', 0x7a6a2a],
  ['violet', 'Violet', 0x5a3a7a], ['forest', 'Forest', 0x2a6a4a], ['ash', 'Ash grey', 0x6a6a6a], ['midnight', 'Midnight', 0x2a2a3a],
  ['rust', 'Rust', 0x8a5a2a], ['rose', 'Rose', 0xa85a6a],
];
export const ARMOURS = [
  ['steel', 'Weathered steel', 0x7d828a, 0x4a4e55], ['black', 'Blackened', 0x3c3c44, 0x26262c], ['gilded', 'Gilded', 0xb89a5a, 0x6a5a3a],
  ['verdigris', 'Verdigris', 0x5a8a7a, 0x34484a], ['bone', 'Bone white', 0xd8d0c0, 0x8a8478], ['rust', 'Rusted', 0x8a5a3a, 0x4a3426],
];
export const ORNAMENTS = [['none', 'Plain crest'], ['plume', 'Plume'], ['horns', 'Horns'], ['wings', 'Wings'], ['antlers', 'Antlers'], ['halo', 'Halo']];

export const DEFAULT_LOOK = { cloak: 'teal', armour: 'steel', ornament: 'none' };

const pick = (list, id) => list.find((e) => e[0] === id) ?? list[0];

export function cleanLook(l) {
  return { cloak: pick(CLOAKS, l?.cloak)[0], armour: pick(ARMOURS, l?.armour)[0], ornament: pick(ORNAMENTS, l?.ornament)[0] };
}

// Short code for the network: "teal.steel.none".
export const lookCode = (l) => `${l.cloak}.${l.armour}.${l.ornament}`;
export function parseLook(code) {
  if (typeof code !== 'string' || code.length > 40) return null;
  const [cloak, armour, ornament] = code.split('.');
  return cleanLook({ cloak, armour, ornament });
}
export const cloakHex = (l) => pick(CLOAKS, l?.cloak)[2];

// The original colours buildPlayer() uses for its cloth and steel.
const ORIG = { cloth: 0x2d4a4c, steel: 0x7d828a, dark: 0x4a4e55 };

function ornament(id) {
  const g = group();
  const gold = mat(0xb08d4a, { metalness: 0.6, roughness: 0.4 });
  if (id === 'plume') {
    const red = mat(0xb03a2a, { side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) g.add(mesh(box(0.05, 0.28 - i * 0.03, 0.08), red, { y: 0.4 + i * 0.02, z: -0.04 - i * 0.07, rx: -0.5 - i * 0.25 }));
  } else if (id === 'horns') {
    const horn = mat(0xd8cfb8);
    for (const s of [-1, 1]) {
      g.add(mesh(cone(0.05, 0.22, 5), horn, { x: s * 0.16, y: 0.3, rz: -s * 1.1 }));
      g.add(mesh(cone(0.035, 0.14, 5), horn, { x: s * 0.27, y: 0.4, rz: -s * 0.2 }));
    }
  } else if (id === 'wings') {
    const steel = mat(0xc9cdd2, { metalness: 0.7, roughness: 0.3 });
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.add(mesh(box(0.02, 0.16 - i * 0.03, 0.08), steel, { x: s * 0.16, y: 0.22 + i * 0.05, z: -0.04 - i * 0.05, rz: -s * 0.5, rx: -0.4 }));
  } else if (id === 'antlers') {
    const bone = mat(0xe8dcc0);
    for (const s of [-1, 1]) {
      g.add(mesh(box(0.03, 0.3, 0.03), bone, { x: s * 0.1, y: 0.42, rz: -s * 0.5 }));
      g.add(mesh(box(0.025, 0.14, 0.025), bone, { x: s * 0.2, y: 0.5, rz: s * 0.4 }));
      g.add(mesh(box(0.025, 0.12, 0.025), bone, { x: s * 0.14, y: 0.56, rz: -s * 0.2, rx: 0.4 }));
    }
  } else if (id === 'halo') {
    const light = mat(0xfff0c0, { emissive: 0xffc860, emissiveIntensity: 1.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 4, 16), light);
    ring.rotation.x = Math.PI / 2 - 0.2;
    ring.position.set(0, 0.48, -0.06);
    g.add(ring);
  }
  void gold;
  return g;
}

export function applyLook(model, look) {
  const l = cleanLook(look);
  if (!model._look) {
    // First time: swap the shared materials for this model's own copies.
    const copies = new Map(), slots = {};
    model.root.traverse((o) => {
      if (!o.isMesh || o === model._ornament) return;
      const swap = (m) => {
        const k = m?.color && Object.keys(ORIG).find((key) => ORIG[key] === m.color.getHex());
        if (!k) return m;
        if (!copies.has(m)) {
          const c = m.clone();
          copies.set(m, c);
          slots[k] = c;
        }
        return copies.get(m);
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    model._look = slots;
  }
  const S = model._look;
  S.cloth?.color.setHex(pick(CLOAKS, l.cloak)[2]);
  const a = pick(ARMOURS, l.armour);
  S.steel?.color.setHex(a[2]);
  S.dark?.color.setHex(a[3]);
  if (S.steel) S.steel.metalness = l.armour === 'bone' ? 0.15 : 0.55;
  if (model._ornamentId !== l.ornament) {
    if (model._ornament) model.head.remove(model._ornament);
    model._ornament = ornament(l.ornament);
    model.head.add(model._ornament);
    model._ornamentId = l.ornament;
  }
  return l;
}
