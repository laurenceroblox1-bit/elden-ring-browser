// The journal's bestiary: every kind of foe, grouped by where it's found, with what you've learned
// about it. Entries stay hidden ("???") until you've killed one (state.kills, by tag); bosses count
// once their flag is set.
export const BESTIARY = [
  ['The Vale', [
    ['sentry', 'Hollow Sentry', 'The Gate\'s old watch, hollowed out and still at their posts. Shield up, sword ready: break the guard with heavy blows, or wait for the swing and parry.'],
    ['hound', 'Mire Hound', 'Starved ash-hounds that hunt the fen fogs in packs, darting in one at a time. A parried lunge leaves one open.'],
    ['acolyte', 'Lantern Acolyte', 'Robed keepers of the old lanterns who throw their fire from a distance. Close in fast.'],
    ['bowman', 'Dunmarrow Bowman', 'Archers of the castle watch. Their arrows can be blocked, rolled, or simply outrun to their faces.'],
    ['knight', 'Dunmarrow Knight', 'Plate, a kite shield and a shield-bash. Patient, and harder to break than a sentry.'],
    ['matriarch', 'Vharra, Mother of the Mire', 'The mother of every Mire Hound, asleep in a ring of standing stones in the Ashen Fen.', 'motherDead'],
    ['warden', 'Odran, the Bell-Warden', 'The guardian of the Shattered Gate. Three parries in quick succession bring him to his knees.', 'wardenDead'],
  ]],
  ['The Rimewold', [
    ['wolf', 'Rime Wolf', 'Pale wolves of the highland, quick to surround you.'],
    ['wraith', 'Rime Wraith', 'Drifting frost-shapes that throw shards of ice and blink away when rushed. Their cold builds frostbite.'],
    ['troll', 'Grimhorn', 'The troll of the Howling Field, with a thighbone for a club.', 'trollDead'],
    ['saelith', 'Saelith, the Winter Lantern', 'The keeper of the flame that holds the Rimewold in winter.', 'saelithDead'],
  ]],
  ['The Cinderfall Wastes', [
    ['imp', 'Cinder Imp', 'Knee-high fire-sprites with a ball of flame cupped in one claw.'],
    ['firehound', 'Ember Hound', 'Burning kin of the Mire Hounds. Their bite sets you alight.'],
    ['golem', 'Cinder Golem', 'Basalt walls with a furnace inside. Slow, and fire does nothing to them.'],
    ['drake', 'Ashmaw, the Cinder Drake', 'The drake of the caldera: fire breath, tail sweeps and a dive from the sky.', 'ashmawDead'],
  ]],
  ['The Drowned Coast', [
    ['drowned', 'Drowned Sailor', 'Morrow\'s crew, walked back out of the sea with their harpoons.'],
    ['crab', 'Tidecrab', 'Ordinary blows turn on the shell. Hit them hard, or from the side.'],
    ['captain_drowned', 'Captain Morrow, the Drowned', 'An anchor on a chain, rings of surf, and a crew that climbs out of the shallows.', 'morrowDead'],
  ]],
  ['The Glowcap Hollows', [
    ['sporeling', 'Sporeling', 'Little walking caps that burst into poison when they die. Kill them from a distance, or roll away.'],
    ['stalker', 'Glowcap Stalker', 'Tall shapes that drift between the giant caps.'],
    ['witch', 'Sylvara, the Bloom Witch', 'Roots, spores and petals, and a brood of sporelings.', 'sylvaraDead'],
  ]],
  ['The Gilded Dunes', [
    ['scorpion', 'Dune Scorpion', 'Gold-shelled and quick, with a poison sting.'],
    ['revenant', 'Sand Revenant', 'The Sanctum\'s dead guards, khopesh and gilded shield.'],
    ['sandwraith', 'Sand Wraith', 'The dunes\' dead held together by the wind, throwing knots of scouring sand.'],
    ['scarab', 'Solkar, the Sun Scarab', 'A beetle the size of a house that rolls the sun. Charges, burrows, and a beam of sunfire.', 'solkarDead'],
  ]],
  ['The Stormspire Heights', [
    ['stormknight', 'Spire Knight', 'The storm-monks\' sworn guard, in verdigris plate.'],
    ['thunderwolf', 'Thunder Wolf', 'Grey-blue wolves with a crest of crackling light.'],
    ['gargoyle', 'Spire Gargoyle', 'Stone watchers from the monastery roof. They swoop.'],
    ['herald', 'Vaelor, the Storm Herald', 'The last abbot, with a glaive of captured lightning.', 'vaelorDead'],
  ]],
  ['The Amberwood', [
    ['boar', 'Rustback Boar', 'Boars as big as ponies. Their charge throws you off your feet.'],
    ['poacher', 'Amberwood Poacher', 'Hooded woodsmen with hatchets, quick and mean.'],
    ['barkhusk', 'Barkhusk', 'Old oaks that got up and walked. Roots burst from the ground where they strike. Fire hurts them.'],
    ['antlerking', 'Hornwood, the Antlered King', 'The old king of the wood, crowned with antlers. At half health he calls the Wild Hunt.', 'hornwoodDead'],
  ]],
  ['The Shardlands', [
    ['shardback', 'Shardback Lizard', 'Low, quick lizards with crystal backs that shatter when they die.'],
    ['glassminer', 'Glass-Mad Miner', 'Pell\'s old crew, crystal grown through them, swinging picks.'],
    ['prismwraith', 'Prism Wraith', 'Folded light that throws fans of crystal splinters.'],
    ['prismgolem', 'Prism Golem', 'Stone and crystal elites with a heart-stone that sprays splinters.'],
    ['colossus', 'Corundel, the Glass Colossus', 'The Heart of Glass given a body. Mind the beam.', 'corundelDead'],
  ]],
  ['The Undercroft', [
    ['skeleton', 'Skeleton of the Watch', 'They get back up. A heavy blow, a riposte, a backstab or fire keeps them down.'],
    ['ghoul', 'Ghoul', 'Grave-eaters on all fours. Their bite festers.'],
    ['gravewarden', 'Gravewarden', 'Armoured grave-keepers with a slab for a shield and a club that brings up bone.'],
    ['ossuaryqueen', 'Vesperine, the Ossuary Queen', 'The last abbess of the Undercroft, who would not let her dead go.', 'vesperineDead'],
  ]],
  ['The Hollow Bell', [
    ['bellringer', 'The Bell-Ringer', 'The thing the Hollow Bell was cast to keep asleep.', 'bellDead'],
  ]],
  ['Anywhere', [
    ['mimic', 'Mimic', 'A chest with teeth. Not every chest in the Vale is a chest.'],
  ]],
];

// Feats: milestones, checked against the save now and then (Game._checkFeats). [id, name, how, test]
const lit = (s) => (s.shrinesLit ?? []).length;
const kills = (s) => Object.values(s.kills ?? {}).reduce((a, b) => a + b, 0);
const GREAT = ['ashmawDead', 'morrowDead', 'sylvaraDead', 'solkarDead', 'vaelorDead'];
const ALL_BOSSES = ['wardenDead', 'motherDead', 'trollDead', 'saelithDead', ...GREAT, 'bellDead', 'hornwoodDead', 'corundelDead', 'vesperineDead'];
export const FEATS = [
  ['firstlight', 'First Light', 'Kindle a lantern.', (s) => lit(s) >= 1],
  ['lamplighter', 'Lamplighter', 'Kindle fifteen lanterns.', (s) => lit(s) >= 15],
  ['warden', 'The Gate Opens', 'Defeat Odran, the Bell-Warden.', (s) => s.flags.wardenDead],
  ['hunter', 'Hunter', 'Slay a hundred foes.', (s) => kills(s) >= 100],
  ['slayer', 'Slayer', 'Slay five hundred foes.', (s) => kills(s) >= 500],
  ['greatones', 'The Five Great Ones', 'Defeat Ashmaw, Morrow, Sylvara, Solkar and Vaelor.', (s) => GREAT.every((f) => s.flags[f])],
  ['bell', 'The Bell Is Silent', 'Defeat the Bell-Ringer.', (s) => s.flags.bellDead],
  ['allbosses', 'Bane of Great Foes', 'Defeat every great foe in the Vale and beyond.', (s) => ALL_BOSSES.every((f) => s.flags[f])],
  ['smith', 'Master Smith', 'Raise a weapon to +5.', (s) => Object.values(s.upgrades ?? {}).some((n) => n >= 5)],
  ['collector', 'Collector', 'Own thirty pieces of gear.', (s) => (s.gear?.owned ?? []).length >= 30],
  ['explorer', 'Wayfarer', 'Find fifty named places.', (s) => (s.discovered ?? []).length >= 50],
  ['chests', 'Treasure Hunter', 'Open ten chests.', (s) => (s.chests ?? []).length >= 10],
  ['mimic', 'Not a Chest', 'Slay a mimic.', (s) => (s.kills?.mimic ?? 0) >= 1],
  ['undercroft', 'Into the Dark', 'Go down into the Undercroft.', (s) => (s.discovered ?? []).includes('stairhall')],
  ['backstab', 'From Behind', 'Land ten backstabs.', (s) => (s.tally?.backstabs ?? 0) >= 10],
  ['parry', 'Turned Aside', 'Parry fifty blows.', (s) => (s.tally?.parries ?? 0) >= 50],
  ['journey', 'Again', 'Begin a second journey.', (s) => (s.journey ?? 1) >= 2],
  ['skeleton', 'Stay Down', 'Put a skeleton down for good.', (s) => (s.kills?.skeleton ?? 0) >= 1],
];

// Every boss flag for the bestiary's "felled" line.
export const BOSS_FLAGS = new Set(ALL_BOSSES);
