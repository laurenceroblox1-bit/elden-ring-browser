// Shared humanoid rig. Every character (player, sentries, NPCs, the Warden) dresses this skeleton.
// root (feet on ground) > pivot (body centre, used for rolls and falls) > rig > hips > torso > head/arms, hips > legs
import * as THREE from '../lib/three.js';
import { box, mesh, mergeRig } from './kit.js';

export function buildHumanoid(m, dims = {}) {
  const d = {
    shoulderW: 0.34, chestW: 0.54, chestD: 0.3, waistW: 0.44,
    armW: 0.14, upperArm: 0.32, foreArm: 0.3, legW: 0.17, thigh: 0.42, shin: 0.42,
    headW: 0.24, headH: 0.26, ...dims,
  };
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = 0.9;
  root.add(pivot);
  const rig = new THREE.Group();
  rig.position.y = -0.9;
  pivot.add(rig);

  const hips = new THREE.Group();
  hips.position.y = 0.9;
  rig.add(hips);
  hips.add(mesh(box(d.waistW - 0.02, 0.2, 0.26), m.legs));

  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);
  torso.add(mesh(box(d.waistW, 0.32, 0.26), m.body, { y: 0.16 }));
  torso.add(mesh(box(d.chestW, 0.3, d.chestD), m.body, { y: 0.42 }));

  const head = new THREE.Group();
  head.position.y = 0.6;
  torso.add(head);
  head.add(mesh(box(0.11, 0.08, 0.11), m.skin, { y: -0.02 }));
  head.add(mesh(box(d.headW, d.headH, d.headW + 0.02), m.skin, { y: d.headH / 2 + 0.02 }));

  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * d.shoulderW, 0.52, 0);
    shoulder.rotation.order = 'YXZ';
    torso.add(shoulder);
    shoulder.add(mesh(box(d.armW, d.upperArm, d.armW), m.arms, { y: -d.upperArm / 2 }));
    const elbow = new THREE.Group();
    elbow.position.y = -d.upperArm;
    shoulder.add(elbow);
    elbow.add(mesh(box(d.armW - 0.01, d.foreArm, d.armW - 0.01), m.arms, { y: -d.foreArm / 2 }));
    const hand = new THREE.Group();
    hand.position.y = -d.foreArm - 0.02;
    elbow.add(hand);
    hand.add(mesh(box(0.11, 0.11, 0.12), m.hands ?? m.skin));
    return { shoulder, elbow, hand };
  };

  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, -0.06, 0);
    hips.add(hip);
    hip.add(mesh(box(d.legW, d.thigh, d.legW + 0.02), m.legs, { y: -d.thigh / 2 }));
    const knee = new THREE.Group();
    knee.position.y = -d.thigh;
    hip.add(knee);
    knee.add(mesh(box(d.legW - 0.02, d.shin, d.legW - 0.01), m.legs, { y: -d.shin / 2 }));
    knee.add(mesh(box(d.legW, 0.08, 0.26), m.boots ?? m.legs, { y: -d.shin + 0.02, z: 0.04 }));
    return { hip, knee };
  };

  // Right is -X when facing +Z.
  return {
    root, pivot, rig, hips, torso, head,
    armR: arm(-1), armL: arm(1), legR: leg(-1), legL: leg(1),
    base: { pivot: 0.9, hips: 0.9 },
  };
}

// The groups a pose moves, i.e. the bones a merged humanoid is skinned to.
export const humanoidBones = (r) => [
  r.hips, r.torso, r.head,
  r.armR.shoulder, r.armR.elbow, r.armR.hand, r.armL.shoulder, r.armL.elbow, r.armL.hand,
  r.legR.hip, r.legR.knee, r.legL.hip, r.legL.knee,
];

// Call once a character is fully dressed (and before gear that can be swapped goes in its hands):
// its static meshes become a few skinned meshes, one per material. `keep` subtrees stay as they are.
export function mergeHumanoid(r, keep = []) {
  r.merged = mergeRig(r.root, humanoidBones(r), { keep });
  return r;
}
