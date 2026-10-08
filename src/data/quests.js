// Quests are data. Each stage completes on one event:
//   { type: 'shrine', id } kindle a shrine     { type: 'boss', id }  defeat a boss
//   { type: 'item', id }   hold an item         { type: 'kill', tag, count } kill tagged enemies
//   { type: 'talk', id }   advanced from dialogue (see data/dialogue.js)
//   { type: 'zone', id }   walk into a named place (data/world.js ZONES)
// `reward` may hold ash, flask, horse, and gear ids: weapon, shield, rite (see data/weapons.js, abilities.js).
// `marker` puts a pin on the compass while the stage is current.
export const QUESTS = {
  warden: {
    title: 'The Warden at the Gate',
    main: true,
    giver: 'The road itself',
    summary: 'The old road north ends at the Shattered Gate. Something still keeps it, and nothing passes.',
    stages: [
      { text: 'Follow the old road north and kindle the Gatehouse Shrine.', on: { type: 'shrine', id: 'gatehouse' }, marker: [16, -194] },
      { text: 'Pass through the mist and silence the Bell-Warden.', on: { type: 'boss', id: 'warden' }, marker: [0, -222] },
    ],
    reward: { weapon: 'bell_maul' },
    doneText: 'The Shattered Gate stands open. Castle Dunmarrow waits beyond, for another day.',
  },
  steed: {
    title: 'A Steed for the Road',
    giver: 'Brannoc, Stablemaster',
    summary: 'Hollows at the old watchtower stole the bone whistle that calls Brannoc\'s spirit mare.',
    stages: [
      { text: "Take the bone whistle back from the Hollow Captain at the Watch Ruins.", on: { type: 'item', id: 'bone_whistle' }, marker: [139, 25] },
      { text: 'Bring the bone whistle to Brannoc at his camp.', on: { type: 'talk', id: 'brannoc' }, marker: [-55, 162] },
    ],
    reward: { horse: true, ash: 150 },
    doneText: 'Wisp answers the whistle now. Press H to call her, and H again to dismount.',
  },
  locket: {
    title: "The Pilgrim's Locket",
    giver: 'Sister Ilse, Pilgrim',
    summary: 'Ilse lost her locket when her cart was overrun on the western moor.',
    stages: [
      { text: 'Search the wrecked cart on the Western Moor for the locket.', on: { type: 'item', id: 'locket' }, marker: [-231, -170] },
      { text: 'Return the locket to Sister Ilse at Mirelake Shore.', on: { type: 'talk', id: 'ilse' }, marker: [-143, -22] },
    ],
    reward: { flask: 1, ash: 250 },
    doneText: 'Ilse pressed her sunmoss into your flask. It holds one more draught.',
  },
  sentries: {
    title: 'Ash in the Watchtower',
    giver: 'A notice at the Shrine of First Light',
    summary: 'The hollow sentries grow bolder every night. Whoever puts them down earns the bounty.',
    stages: [
      { text: 'Put down hollow sentries', on: { type: 'kill', tag: 'sentry', count: 5 }, marker: [130, 32] },
    ],
    reward: { ash: 400, rite: 'lantern_bolt' },
    doneText: 'The bounty is yours, and the lantern-keeper\'s rite with it: Lantern Bolt. Prepare it in your equipment (I) and cast it with V.',
  },
  hounds: {
    title: 'Teeth in the Mire',
    giver: 'Sister Ilse, Pilgrim',
    summary: 'Gaunt grey hounds circle the lake shore after dark, and the moor road is worse. Ilse asks you to thin the packs.',
    stages: [
      { text: 'Put down Mire Hounds on the lake shore and the moor road', on: { type: 'kill', tag: 'hound', count: 5 }, marker: [-185, -85] },
    ],
    reward: { ash: 350 },
    doneText: 'The shore is quiet again. Ilse says she slept through the night for the first time in weeks.',
  },
  mother: {
    title: 'The Mother of the Mire',
    giver: 'Sister Ilse, Pilgrim',
    summary: 'The hounds keep coming back however many fall. Ilse has heard that they are whelped far to the east, in a fen of grey ash, by something very much larger.',
    stages: [
      { text: 'Follow the fen road east from the Watch Ruins into the Ashen Fen.', on: { type: 'zone', id: 'fen' }, marker: [312, 18] },
      { text: "Find the Mother's Hollow at the heart of the fen and put the Mother to rest.", on: { type: 'boss', id: 'mother' }, marker: [345, -42] },
    ],
    reward: { ash: 800, flask: 1 },
    doneText: "Vharra sleeps for good. No new litters will come out of the fen, and Ilse can finally sleep.",
  },
  acolytes: {
    title: 'Snuff the Lanterns',
    giver: 'Brannoc, Stablemaster',
    summary: 'Robed hollows carry lanterns that burn without oil and throw fire at anyone on the road. Brannoc wants them gone before more travellers die.',
    stages: [
      { text: 'Put down Lantern Acolytes at the Watch Ruins and along the graveyard road', on: { type: 'kill', tag: 'acolyte', count: 4 }, marker: [150, 14] },
    ],
    reward: { ash: 450, weapon: 'cinder_saber' },
    doneText: 'The lanterns are out. One of the monks\' curved blades still glows: the Cinder Saber is yours.',
  },
  letter: {
    title: 'A Letter for Mirelake',
    giver: 'Brannoc, Stablemaster',
    summary: 'Brannoc has written to Sister Ilse and won\'t say what about. He is too stiff for the ride, so the letter is yours to carry.',
    stages: [
      { text: "Carry Brannoc's letter to Sister Ilse at Mirelake Shore.", on: { type: 'talk', id: 'ilse' }, marker: [-143, -22] },
    ],
    reward: { ash: 200 },
    doneText: 'Ilse read the letter twice and laughed once. Whatever it said, it was kind.',
  },
  bell: {
    title: 'The Cracked Bell',
    giver: 'Sister Ilse, Pilgrim',
    summary: 'The chapel on the rise above the lake rang its own bell the night the Warden took the gate, and cracked doing it. Ilse wants to know why.',
    stages: [
      { text: 'Climb to the Chapel of the Cracked Bell above Mirelake.', on: { type: 'zone', id: 'chapel' }, marker: [-120, 80] },
      { text: 'Examine the cracked bell lying in the chapel grass.', on: { type: 'talk', id: 'chapel_bell' }, marker: [-120, 80] },
      { text: 'Bring the bell shard to Sister Ilse.', on: { type: 'talk', id: 'ilse' }, marker: [-143, -22] },
    ],
    reward: { ash: 300, flask: 1 },
    doneText: 'Ilse ground a little of the shard into your flask. It holds one more draught, and it tastes of bronze.',
  },
};
