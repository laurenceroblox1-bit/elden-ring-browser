// Procedural animation: a pose is a flat set of joint angles; poses are mixed and then eased onto a rig.
// Conventions (character faces +Z): negative shoulder/hip X swings a limb forward,
// positive knee X bends the shin back, negative elbow X bends the forearm forward.
// Shoulders use Euler order YXZ so sRy swings a raised arm horizontally.
export const JOINTS = [
  'pivotX', 'pivotH', 'hipsH', 'hipsX', 'hipsY', 'hipsZ', 'torsoX', 'torsoY', 'torsoZ', 'headX', 'headY',
  'sRx', 'sRy', 'sRz', 'eR', 'hRx', 'hRy', 'hRz',
  'sLx', 'sLy', 'sLz', 'eL', 'hLx', 'hLy', 'hLz',
  'lRx', 'lRz', 'kR', 'lLx', 'lLz', 'kL',
];

const BASE = Object.fromEntries(JOINTS.map((j) => [j, 0]));
BASE.sRz = -0.08;
BASE.sLz = 0.08;

export const pose = (over = {}) => Object.assign({ ...BASE }, over);

export function copyPose(out, src) {
  for (const j of JOINTS) out[j] = src[j];
  return out;
}

export function mixPose(out, a, b, t) {
  for (const j of JOINTS) out[j] = a[j] + (b[j] - a[j]) * t;
  return out;
}

// Three-key attack curve: rest -> wind (windup) -> strike (active) -> rest (recover).
export function attackPose(out, rest, wind, strike, t, windup, active, recover, ease = (x) => x) {
  if (t < windup) return mixPose(out, rest, wind, ease(t / windup));
  if (t < windup + active) return mixPose(out, wind, strike, (t - windup) / active);
  return mixPose(out, strike, rest, ease(Math.min(1, (t - windup - active) / recover)));
}

// Keyframed pose track for scripted moves (ripostes, recoils): keys are [time, pose] in ascending time.
// Holds the first pose before the first key and the last pose after the last one.
export function framePose(out, keys, t, ease = (x) => x) {
  if (t <= keys[0][0]) return copyPose(out, keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    const [t1, p1] = keys[i];
    if (t < t1) {
      const [t0, p0] = keys[i - 1];
      return mixPose(out, p0, p1, ease((t - t0) / (t1 - t0)));
    }
  }
  return copyPose(out, keys[keys.length - 1][1]);
}

export function applyPose(r, p, k) {
  const s = (o, key, v) => { o[key] += (v - o[key]) * k; };
  s(r.pivot.rotation, 'x', p.pivotX);
  s(r.pivot.position, 'y', r.base.pivot + p.pivotH);
  s(r.hips.position, 'y', r.base.hips + p.hipsH);
  s(r.hips.rotation, 'x', p.hipsX);
  s(r.hips.rotation, 'y', p.hipsY);
  s(r.hips.rotation, 'z', p.hipsZ);
  s(r.torso.rotation, 'x', p.torsoX);
  s(r.torso.rotation, 'y', p.torsoY);
  s(r.torso.rotation, 'z', p.torsoZ);
  s(r.head.rotation, 'x', p.headX);
  s(r.head.rotation, 'y', p.headY);
  const aR = r.armR, aL = r.armL;
  s(aR.shoulder.rotation, 'x', p.sRx); s(aR.shoulder.rotation, 'y', p.sRy); s(aR.shoulder.rotation, 'z', p.sRz);
  s(aR.elbow.rotation, 'x', p.eR);
  s(aR.hand.rotation, 'x', p.hRx); s(aR.hand.rotation, 'y', p.hRy); s(aR.hand.rotation, 'z', p.hRz);
  s(aL.shoulder.rotation, 'x', p.sLx); s(aL.shoulder.rotation, 'y', p.sLy); s(aL.shoulder.rotation, 'z', p.sLz);
  s(aL.elbow.rotation, 'x', p.eL);
  s(aL.hand.rotation, 'x', p.hLx); s(aL.hand.rotation, 'y', p.hLy); s(aL.hand.rotation, 'z', p.hLz);
  s(r.legR.hip.rotation, 'x', p.lRx); s(r.legR.hip.rotation, 'z', p.lRz); s(r.legR.knee.rotation, 'x', p.kR);
  s(r.legL.hip.rotation, 'x', p.lLx); s(r.legL.hip.rotation, 'z', p.lLz); s(r.legL.knee.rotation, 'x', p.kL);
}

// Adds a walk/run cycle on top of a pose. amp 0..1, phase in radians.
export function addGait(p, phase, amp, armSwing = 0.5) {
  const s = Math.sin(phase);
  p.lRx += -s * 0.75 * amp;
  p.lLx += s * 0.75 * amp;
  p.kR += Math.max(0, Math.sin(phase + 1.2)) * 1.0 * amp;
  p.kL += Math.max(0, Math.sin(phase + 1.2 + Math.PI)) * 1.0 * amp;
  p.sRx += s * armSwing * amp;
  p.sLx += -s * armSwing * amp;
  p.hipsH += (Math.cos(phase * 2) - 1) * 0.035 * amp;
  p.torsoY += s * 0.08 * amp;
  // The hips twist against the shoulders and roll over each planted foot; the head stays level; a
  // fast stride leans forward into it.
  p.hipsY -= s * 0.09 * amp;
  p.hipsZ += Math.cos(phase) * 0.035 * amp;
  p.headY -= s * 0.05 * amp;
  p.torsoX += 0.07 * amp * amp;
  return p;
}
