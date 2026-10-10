// Smithing: Hessa's anvil in the Sunken Forge raises a weapon a level at a time, up to +5. Each level
// costs smithing stones (found lying in the outer regions and the Vale's far corners, see
// data/biomes.js STONES) and ash, and adds 9% to the weapon's damage (its art's too).
export const MAX_LEVEL = 5;
export const upgradeCost = (level) => ({ stones: level + 1, ash: 250 * (level + 1) });
export const upgradeMult = (level) => 1 + (level ?? 0) * 0.09;
export const levelName = (name, level) => (level ? `${name} +${level}` : name);
