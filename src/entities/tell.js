// The tell: a glint in a boss's striking hand just before a blow lands, gold if it can be parried and
// red if it can't (roll it). `lead` is the time left until the blow (negative or null: no blow coming).
import { glowSprite } from '../models/kit.js';
import { damp } from '../core/math.js';

const WINDOW = 0.32;

export function updateTell(actor, dt, lead, parry) {
  const hand = actor.model.armR?.hand;
  if (!hand) return;
  if (!actor.tellGlint) {
    actor.tellGlint = glowSprite(0xffffff, 1.6, 0);
    actor.tellGlint.renderOrder = 6;
    actor.tellGlint.position.z = (actor.trailLen ?? 0.6) * 0.8;
    hand.add(actor.tellGlint);
  }
  const g = actor.tellGlint;
  if (lead > 0 && lead < WINDOW) {
    if (!actor.told) {
      actor.told = true;
      g.material.color.setHex(parry ? 0xffe08a : 0xff5a3a);
    }
    const k = 1 - lead / WINDOW;
    g.material.opacity = Math.sin(k * Math.PI) * 0.95;
    g.scale.setScalar((1.2 + k * 1.4) / (actor.size ?? 1));
  } else {
    if (!(lead > 0)) actor.told = false;
    g.material.opacity = damp(g.material.opacity, 0, 18, dt);
  }
}
