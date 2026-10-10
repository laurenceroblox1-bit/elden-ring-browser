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
  winter: {
    title: 'The Winter Lantern',
    main: true,
    giver: 'The open gate',
    summary: 'With the Warden silenced, the gates of Castle Dunmarrow stand open. Beyond the castle lies the Rimewold, held in a winter that never ends while the Winter Lantern burns.',
    stages: [
      { text: 'Pass through Castle Dunmarrow, north of the Shattered Gate.', on: { type: 'zone', id: 'castle' }, marker: [0, -326] },
      { text: 'Cross the castle courtyard and kindle the Rimegate Shrine.', on: { type: 'shrine', id: 'rimegate' }, marker: [10, -386] },
      { text: 'Follow the frozen road north to the Hall of the Winter Lantern and face its keeper.', on: { type: 'boss', id: 'saelith' }, marker: [0, -548] },
    ],
    reward: { ash: 1500, flask: 1 },
    doneText: 'The Winter Lantern is out. The Rimewold will thaw, slowly, the way old ice does.',
  },
  brother: {
    title: 'A Lantern on the Steps',
    giver: 'Ormund, Ice-Cutter',
    summary: "Ormund's brother Eskil went north to the Hall of the Winter Lantern two winters ago and never came back.",
    stages: [
      { text: "Look for Eskil's brass lantern on the steps below the Hall of the Winter Lantern.", on: { type: 'item', id: 'brothers_lantern' }, marker: [-14, -534] },
      { text: "Bring Eskil's lantern back to Ormund at his hut by the tarn.", on: { type: 'talk', id: 'ormund' }, marker: [-100, -425] },
    ],
    reward: { weapon: 'icicle_estoc', ash: 400 },
    doneText: "Ormund hung his brother's lantern by the door of the hut. He lights it every night.",
  },
  troll: {
    title: 'The Thing in the Howling Field',
    giver: 'Ormund, Ice-Cutter',
    summary: 'Something huge lives on the Howling Field east of the road, and it throws Ormund\'s ice back at him.',
    stages: [
      { text: 'Hunt down whatever lives on the Howling Field.', on: { type: 'boss', id: 'troll' }, marker: [80, -462] },
    ],
    reward: { ash: 700, flask: 1 },
    doneText: 'The Howling Field is quiet. Ormund kept his word about the flask.',
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
    reward: { ash: 350, rite: 'spirit_wolves' },
    doneText: 'The shore is quiet again. Ilse gave you a little bone bell she found on the moor: the Spirit Wolves rite. Prepare it in your equipment (I) and cast it with V.',
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
  // ---------- the outer regions ----------
  ashmaw: {
    title: 'The Old Fire',
    main: true,
    giver: 'Hessa, Smith of the Sunken Forge',
    summary: 'South through the Cinder Pass, the Wastes run up to a smoking volcano. In the caldera beneath it sleeps Ashmaw, the drake whose breath turned the south of the Vale to cinders. Hessa wants its fire out.',
    stages: [
      { text: 'Kindle the Caldera Steps Shrine below the volcano.', on: { type: 'shrine', id: 'calderasteps' }, marker: [18, 576] },
      { text: "Go down into Ashmaw's Caldera and slay the Cinder Drake.", on: { type: 'boss', id: 'ashmaw' }, marker: [0, 622] },
      { text: 'Tell Hessa at the Sunken Forge that the drake is dead.', on: { type: 'talk', id: 'hessa' }, marker: [-76, 536] },
    ],
    reward: { ash: 2000, flask: 1 },
    doneText: 'The Old Fire is out. Hessa says the forge will never burn so hot again, and seems glad of it.',
  },
  golems: {
    title: 'Stone That Walks',
    giver: 'Hessa, Smith of the Sunken Forge',
    summary: 'Two golems of black basalt walk the Wastes, made in the Sunken Forge long ago and never unmade. Hessa wants them broken.',
    stages: [
      { text: 'Break the Cinder Golems that walk the Wastes', on: { type: 'kill', tag: 'golem', count: 2 }, marker: [84, 500] },
    ],
    reward: { ash: 700, item: 'smithing_stone', items: 2 },
    doneText: "Hessa took the golems' cores and gave you stones for the anvil in return.",
  },
  tides: {
    title: "Saltmarrow's Bell",
    giver: 'Old Wenna, last of Saltmarrow',
    summary: "Saltmarrow's harbour bell was torn away the night the Captain's ship came ashore. Wenna wants it back where it belongs.",
    stages: [
      { text: "Find Saltmarrow's bell, washed up at the end of the pier.", on: { type: 'item', id: 'drowned_bell' }, marker: [-556, 96] },
      { text: 'Bring the bell back to Old Wenna.', on: { type: 'talk', id: 'wenna' }, marker: [-470, 106] },
    ],
    reward: { ash: 500, flask: 1 },
    doneText: 'Wenna hung the bell over her door. It rang once on its own, which she says is the sea saying thank you.',
  },
  morrow: {
    title: 'The Drowned Captain',
    main: true,
    giver: 'Old Wenna, last of Saltmarrow',
    summary: "Captain Morrow ran his ship onto the coast and drowned with it; now he and his crew walk the beach and drag anyone they catch into the sea. Wenna was his wife's sister.",
    stages: [
      { text: 'Kindle the Tidehold Shrine on the Salt Road.', on: { type: 'shrine', id: 'tidehold' }, marker: [-446, 30] },
      { text: "Find Captain Morrow by his wreck and send him back to the sea.", on: { type: 'boss', id: 'morrow' }, marker: [-560, -46] },
    ],
    reward: { ash: 1600, flask: 1 },
    doneText: 'The tide went out further than Wenna has ever seen it, and came back clean.',
  },
  stalkers: {
    title: 'Things Between the Caps',
    giver: 'Murk, a Myconid',
    summary: "Tall things drift between the glowcaps, throwing spores at anything that moves. Murk says they were Myconids once, before the Bloom Witch's spores got into them.",
    stages: [
      { text: 'Put the Glowcap Stalkers to rest', on: { type: 'kill', tag: 'stalker', count: 3 }, marker: [-400, -420] },
    ],
    reward: { ash: 600 },
    doneText: 'Murk hums for a long while. It is, apparently, a song of thanks.',
  },
  bloom: {
    title: 'The Bloom Witch',
    main: true,
    giver: 'Murk, a Myconid',
    summary: 'In the Heartcap Grove at the end of the Hollows a woman went to sleep under the great mushroom and woke up as something else. Her spores are spreading. Murk asks you to end it.',
    stages: [
      { text: 'Kindle the Mossdeep Shrine in the Hollows.', on: { type: 'shrine', id: 'mossdeep' }, marker: [-328, -334] },
      { text: 'Walk into the Heartcap Grove and face Sylvara, the Bloom Witch.', on: { type: 'boss', id: 'sylvara' }, marker: [-455, -482] },
      { text: 'Tell Murk the grove is quiet.', on: { type: 'talk', id: 'murk' }, marker: [-306, -436] },
    ],
    reward: { ash: 1600, item: 'glowcap_spore', flask: 1 },
    doneText: 'The Hollows are already growing back, gently, the way they did before.',
  },
  caravan: {
    title: 'The Lost Caravan',
    giver: 'Tamsin, Wandering Trader',
    summary: "Tamsin's family crossed the dunes every year with a caravan of goods for the Sanctum. One year they didn't come back. She has found the oasis; she hasn't dared go further.",
    stages: [
      { text: 'Find the Lost Caravan north of the oasis and bring back its sun-disc.', on: { type: 'item', id: 'sun_disc' }, marker: [520, 160] },
      { text: 'Bring the sun-disc to Tamsin at the oasis.', on: { type: 'talk', id: 'tamsin' }, marker: [548, 38] },
    ],
    reward: { ash: 600, item: 'smithing_stone', items: 2 },
    doneText: 'Tamsin wears the disc on a cord now. She says it is the first time she has felt like a trader and not a runaway.',
  },
  solkar: {
    title: 'Under the Sanctum Sand',
    main: true,
    giver: 'Tamsin, Wandering Trader',
    summary: "Something huge moves under the sand of the Sanctum of the Sun. The revenants still guard it as if it were holy. Tamsin thinks it is what took her family's caravan.",
    stages: [
      { text: 'Kindle the Sunrest Shrine at the edge of the Dunes.', on: { type: 'shrine', id: 'sunrest' }, marker: [470, 52] },
      { text: 'Step into the Sanctum of the Sun and face what lies under its sand.', on: { type: 'boss', id: 'solkar' }, marker: [650, 120] },
    ],
    reward: { ash: 1800, flask: 1 },
    doneText: 'The Sanctum is quiet. Tamsin says the dunes already sound different; she can\'t say how.',
  },
  gargoyles: {
    title: 'Stone Watchers',
    giver: 'Brother Aldous',
    summary: 'The gargoyles from the monastery roof came down when the storm did, and now they watch the Heights for the Herald. Aldous wants them stilled.',
    stages: [
      { text: 'Still the Spire Gargoyles', on: { type: 'kill', tag: 'gargoyle', count: 2 }, marker: [386, -410] },
    ],
    reward: { ash: 700, item: 'smithing_stone', items: 2 },
    doneText: 'Aldous rang the little hand-bell he keeps, twice, for each of them.',
  },
  vaelor: {
    title: 'The Storm Herald',
    main: true,
    giver: 'Brother Aldous',
    summary: "Abbot Vaelor called the storm down to guard the Stormspire when the Warden fell silent, and the storm took him. He stands on the summit still, calling it. Aldous asks you to end his vigil.",
    stages: [
      { text: 'Kindle the Stormgate Shrine on the Thunder Stair.', on: { type: 'shrine', id: 'stormgate' }, marker: [360, -300] },
      { text: "Climb to the Herald's Summit and break the storm.", on: { type: 'boss', id: 'vaelor' }, marker: [420, -470] },
      { text: 'Tell Brother Aldous at the monastery.', on: { type: 'talk', id: 'aldous' }, marker: [326, -404] },
    ],
    reward: { ash: 1800, flask: 1 },
    doneText: 'For the first time in years the sun came out over the Stormspire. Aldous sat in it all afternoon.',
  },
};
