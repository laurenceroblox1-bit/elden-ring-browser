// Gear lying in the Vale, and the lookup that tells weapons, shields and rites apart.
// Pickups whose gear is already owned don't spawn. Quest rewards hand out gear too (see data/quests.js).
import { WEAPONS, SHIELDS } from './weapons.js';
import { RITES } from './abilities.js';

export const LOOT = [
  // Early and right by the road: the buckler teaches blocking before the first sentry.
  { gear: 'pilgrim_buckler', x: 15.5, z: 202 },
  // In the broken doorway of the Watch Ruins tower stump, among the captain's hollows.
  { gear: 'ashen_greatblade', x: 142.4, z: 20.8 },
  // Leaning by Brannoc's tent.
  { gear: 'pilgrim_spear', x: -61, z: 156.5 },
  // Thrown clear of the wreck on the Western Moor.
  { gear: 'twin_fangs', x: -224.5, z: -169 },
  // Beside the cairn at Mirelake Shore.
  { gear: 'mending_light', x: -148, z: -26.5 },
  // Among the graves on the last stretch of road before the Gate.
  { gear: 'ward_of_ash', x: -10, z: -178 },
  // Lying on the moor road among the hound packs, where the old lake watch fell.
  { gear: 'mirewatch_halberd', x: -197, z: -112 },
  // Propped against the cracked bell in the chapel.
  { gear: 'captains_cleaver', x: -114, z: 86 },
  // Castle Dunmarrow: by the keep's door in the courtyard.
  { gear: 'dunmarrow_longsword', x: -4, z: -356 },
  // The ruined frost chapel on the Rimewold's east rise.
  { gear: 'frost_nova', x: 108, z: -506 },
  // Among the bones of the troll's den on the Howling Field.
  { gear: 'rimeguard_greatshield', x: 140, z: -470 },
  // Propped against the Gatehouse Shrine, for whoever means to face the Warden.
  { gear: 'gatewarden_greatshield', x: 20.5, z: -190 },
];

// { id, slot: 'weapon' | 'shield' | 'rite', def } or null.
export function gearOf(id) {
  if (WEAPONS[id]) return { id, slot: 'weapon', def: WEAPONS[id] };
  if (SHIELDS[id]) return { id, slot: 'shield', def: SHIELDS[id] };
  if (RITES[id]) return { id, slot: 'rite', def: RITES[id] };
  return null;
}

export const ALL_GEAR = [...Object.keys(WEAPONS), ...Object.keys(SHIELDS), ...Object.keys(RITES)];
