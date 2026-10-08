// Quests are data. Each stage completes on one event:
//   { type: 'shrine', id } kindle a shrine     { type: 'boss', id }  defeat a boss
//   { type: 'item', id }   hold an item         { type: 'kill', tag, count } kill tagged enemies
//   { type: 'talk', id }   advanced from dialogue (see data/dialogue.js)
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
};
