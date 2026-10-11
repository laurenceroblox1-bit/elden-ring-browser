# Ashen Vale

A soulslike action RPG that runs in the browser, built on three.js with no build step. It's an
original world inspired by the genre: the names, characters, boss and story are all new, so the
project can grow into its own game.

Walk north up the old road through the Vale and kindle lantern shrines. Help the people you meet,
call your spectral mare Wisp, and pass through the mist at the Shattered Gate to face **Odran, the
Bell-Warden**. Out east, past the Watch Ruins, the road sinks into the Ashen Fen, where **Vharra,
Mother of the Mire** sleeps in a ring of standing stones. Beat the Warden and the gates of Castle
Dunmarrow open onto the **Rimewold**, a frozen highland where a troll owns the Howling Field and
**Saelith, the Winter Lantern** keeps the flame that holds the land in winter. Past the mountains
around the Vale lie seven more regions, each with its own weather, enemies, people and boss: the
volcanic **Cinderfall Wastes**, the **Drowned Coast**, the **Glowcap Hollows**, the **Gilded Dunes**,
the **Stormspire Heights**, the autumn **Amberwood** and the crystal **Shardlands** (see *The outer
regions*). Under Castle Dunmarrow, the keep's stair goes down into **the Undercroft**, a torch-lit
catacomb where the dead won't stay buried. Fell all five of their great ones and the
mist lifts from the **Hollow Bell**, where the **Bell-Ringer** waits under the last spire. Play
alone, or with friends in a shared Vale (see *Multiplayer*).

## Run it

ES modules need a web server (opening `index.html` straight from disk won't work). The game comes
with its own, which is also the multiplayer server. It needs Node 18 or newer and nothing else:

```sh
cd elden-ring-browser
node server.js            # or: npm start. PORT=3000 node server.js for another port
```

Then open http://localhost:8080. Any static server works too if you only want to play alone
(`python3 -m http.server 8080`). Everything is local, three.js included (`vendor/`). The two
Google Fonts fall back to system serif faces when offline.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse (click the game to capture it) | Look. Arrow keys also turn the camera |
| Shift | Sprint; gallop when riding |
| Space | Roll (with a direction), backstep (without), jump on horseback |
| G | Jump. Attack in the air for a plunging blow (A while sprinting on a gamepad) |
| Left click | Light attack; press again to chain (2 to 4 hits, by weapon). Riposte a reeling foe, or stab an unaware one in the back |
| Hold right click | Guard. Raise it just as a blow lands to parry |
| F | Heavy attack |
| C | Weapon art (costs focus and some stamina) |
| V | Cast your equipped rite (costs focus) |
| Q / middle click | Lock on |
| R | Drink from the flask |
| E | Talk, pick up, kindle or rest at a shrine, pass through the mist |
| H | Call Wisp, or dismount |
| J | Journal |
| I | Equipment (also a button in the pause menu) |
| M | Map, with fast travel between lit lanterns (also in the pause menu) |
| N | Multiplayer: join a shared Vale, see who's there, read the chat |
| Enter | Chat (when connected): Enter sends, Esc cancels |
| Z / X / B / T | Emotes: wave, bow, sit (until you move), cheer. Other players see them |
| Y | Mark the spot you're looking at (or the foe you're locked on to). Other players see the mark in your cloak colour, on the ground and on their compass |
| Esc / P | Pause (graphics quality and sound toggles are here) |
| ` (backquote) | Test menu (also in the pause menu) |

### Gamepad

Any controller the browser exposes with the standard mapping (Xbox and PlayStation pads in
Chrome, Edge and Firefox) works alongside the keyboard and mouse; press a button once so the
browser reveals it. A toast says when a pad connects or disconnects, and losing the pad mid-game
pauses. While the pad is in use, the on-screen key hints and control lists switch to its buttons.

| Button | Action |
| --- | --- |
| Left stick | Move. Tilt it partway to walk slower; a roll always goes the full length |
| L3 (click the left stick) | Sprint, or gallop on Wisp, until the stick returns to centre |
| Right stick | Look |
| R3 (click the right stick) | Lock on |
| A | Roll, backstep, horse jump; next line in a conversation |
| B | Talk, pick up, kindle or rest, pass the mist; back out of any menu |
| X | Drink from the flask |
| Y | Call Wisp, or dismount |
| RB | Light attack (riposte a reeling foe) |
| RT | Heavy attack |
| LB (hold) | Guard. Press it just as a blow lands to parry, as with right click |
| LT | Weapon art |
| D-pad up | Cast your rite |
| D-pad down | Equipment |
| D-pad right | Map |
| Back / Select | Journal |
| Start | Pause (Start or B closes it again) |

In menus the D-pad or left stick moves between buttons (holding repeats), A presses the focused
one and B or Start backs out; on the time slider, left and right change the value. D-pad left is
free. Buttons become virtual key codes `Pad0` to `Pad16` (plus `PadSprint` while the L3 latch
holds) in `core/Input.js`'s `BINDINGS`, so every `pressed()`/`held()` check works unchanged; the
sticks feed `Input.axis()` and `Input.look` (`core/Gamepad.js`).

## What's in the foundation

- **Open vale** (about 900 m across inside the mountains): procedural heightmap terrain, roads, a
  lake, forests, ruins, a roofless chapel, a graveyard approach and the walled arena. East of the
  Watch Ruins, the fen road leads down into the **Ashen Fen**: a basin of grey ash ground, black
  pools, reed beds and dead trees, with the Fenwatch Shrine at its edge and the Mother's Hollow at
  its heart. The Hollow Bell spire stands on the far eastern peaks.
- **Castle Dunmarrow and the Rimewold**: north of the arena a ridge of peaks closes the Vale, and
  Castle Dunmarrow holds the only pass. Its gatehouse opens with the arena's north gate when the
  Warden falls: a courtyard with the keep, knights and bowmen, and a rear gate onto the
  **Rimewold**, a snowy highland. Snow falls as you cross the ridge and the wind howls. There are
  dark stands of snow-laden pines, frosted snags, glowing ice crystals, the cracked ice of the
  **Frozen Tarn**, Ormund the Ice-Cutter's hut, a ruined frost chapel, rimed statues along the
  road, the **Howling Field**, and at the far end the ring of ice-stone pillars of the **Hall of
  the Winter Lantern**. There are two new shrines: the Rimegate and the Lantern Steps.
- **Look**: chunky, faceted blocks (slightly bevelled, flat-shaded), golden-hour light, and on
  *High* graphics a bloom-and-grade pass (`core/PostFX.js`) that makes fires, lanterns, spells and
  Wisp glow. Distant enemies and scenery aren't drawn (and far-off idle enemies don't think), and
  the resolution drops a little when the frame rate sags.
- **Enemies**: hollow sentries and their captain, packs of Mire Hounds that circle and take turns
  to lunge, and lantern-bearing Acolytes that throw fire. North of the ridge:
  - **Dunmarrow Knights**: plate, a heater shield and a guard-breaking shield bash.
  - **Dunmarrow Bowmen**: keep their distance and loose arcing arrows that lead a runner. The
    string's creak is the tell.
  - **Rime Wolves**: their bite builds frostbite.
  - **Rime Wraiths**: hover, throw fans of ice shards, burst in a ring of frost when rushed, or
    blink away in a swirl of snow.

  Floating health bars appear over whatever you're fighting, with damage numbers and a frost meter.
  Every enemy gives an alert cry when it spots you, louder when close and panned left or right.
  Summoned enemies arrive with a rush of sound.
- **Frostbite**: frost hits (wolves, wraiths, the north's bosses, frost weapons) fill a meter.
  When it fills, the cold bites: a burst of damage and six seconds of slowness. It works on you
  (a pale bar under your stamina) and on enemies.
- **Combat**: stamina-gated light combo, heavy attack, roll with i-frames, backstep, rolling
  attack, poise and stagger, lock-on with strafing, hit-stop, camera shake and sparks.
- **Guard, parry, riposte**: see *Guarding* below.
- **Gear**: fourteen weapons with their own movesets and weapon arts, three shields, and four
  rites cast with focus. See *Weapons, shields and rites* below.
- **The Warden**: a two-phase boss with six attacks. Phase 1 has the sweep, backsweep, a delayed
  overhead slam with a shockwave, and a leaping strike. Phase 2 starts at half health and adds a
  bell toll ring (roll through it) and spectral bells falling from the sky. He staggers when his
  poise breaks, and a fog gate seals the arena during the fight. Passing the mist plays his opening
  cutscene (skippable with E, Space or a click): he rises from his knees, roars, and his name card
  appears.
- **Vharra, Mother of the Mire**: the second boss, a hound the size of a cart. Step into her
  hollow and she wakes in her own cutscene, rising and howling. She bites (parryable), pounces onto
  you and lands in a shockwave, and spins her tail at anyone standing at her flank. At half health
  she rears and screams (the wave goes through guards) and adds a fan of ember spit and a howl that
  calls her litter. Leave the hollow and she goes back to sleep, healed. Beating her gives the
  **Mother's Fang**.
- **Grimhorn, the Howling Field** (field boss): a 4 m troll that roars when it sees you or you hit
  it. It has an overhead slam that cracks the ground in a shockwave, a wide club sweep (parryable),
  a stomp when you hide at its feet, and lumps of ice hurled in an arc that burst where they land.
  At 45% health it enrages: faster, and the slam comes twice. Leave the field and it goes back to
  its patch. Drops the **Trollbone Club**.
- **Saelith, the Winter Lantern**: the Rimewold's boss. She kneels before the hall's great lantern.
  Walk into the hall and her cutscene shows her rising and taking its flame (the hall goes dark).
  - Phase one: glaive sweeps (and back), a lunging thrust (both parryable), fans of ice shards, and
    ice spikes that erupt under you after a telegraph.
  - Phase two (half health): the lantern flares, a blizzard fills the hall and a frost ring bursts
    out that goes through guards. Then she blinks behind you for quick thrusts and adds frost novas.
  - Beat her and the Winter Lantern goes out: the snow stops falling on the Rimewold. She rewards
    the **Rime Glaive**.
- **Wisp, the horse**: summoned and dismissed with H. She has camera-relative steering, a walk and
  gallop gait, and a jump, and you can attack from the saddle. She won't enter the arena or join a
  boss fight. She's built like a horse now: deep chest, crested neck with a glowing mane, jointed
  legs with fetlocks, bridle and reins.
- **Quests**: data-driven, with a journal, a tracker, and compass pins:
  - *The Warden at the Gate* (main quest)
  - *A Steed for the Road* (Brannoc unlocks Wisp)
  - *The Pilgrim's Locket* (Sister Ilse gives you an extra flask charge)
  - *Ash in the Watchtower* (a bounty from the notice board; pays ash and the Lantern Bolt rite)
  - *Teeth in the Mire* (Ilse: thin the hound packs)
  - *The Mother of the Mire* (Ilse, after the hounds: find the fen and put Vharra to rest)
  - *Snuff the Lanterns* (Brannoc: the acolytes; pays the Cinder Saber)
  - *A Letter for Mirelake* (Brannoc's letter to Ilse)
  - *The Cracked Bell* (Ilse: visit the chapel bell)
  - *The Winter Lantern* (main quest, after the Warden: through the castle to the Hall)
  - *A Lantern on the Steps* (Ormund: find his brother's lantern; pays the Icicle Estoc)
  - *The Thing in the Howling Field* (Ormund: the troll)
- **Soulslike loop**: lantern shrines are your checkpoints. Resting refills your flask and respawns
  enemies, and you level up there with ash (Vigor, Endurance, Strength, Mind). Resting also refills
  focus. If you die, you drop your
  ash where you fell and can reclaim it. Progress autosaves to localStorage.
- **Presentation**: golden-hour sky with sun and fog, a sky-baked environment map, shadows,
  particles, a HUD (bars with damage lag, compass, boss bar, toasts, banners), and synthesized
  WebAudio sound effects plus a drone for the boss fight.

## The outer regions

Each region sits behind the Vale's ring of mountains, behind a ridge with one pass where its road
comes through (`data/biomes.js` holds all their layout; `world/Biomes.js` builds them).

| Region | Where | What's there |
| --- | --- | --- |
| **The Cinderfall Wastes** | South, through the Cinder Pass | Black ash mesas, lava pools and a lava river (wading in it burns), the Obsidian Field, the smoking volcano. Cinder Imps, Ember Hounds, Cinder Golems. Hessa's **Sunken Forge**. Boss: **Ashmaw, the Cinder Drake**, asleep in the caldera: fire breath, tail spins, wing buffets, fireballs, and flights that end in a dive. |
| **The Drowned Coast** | West, along the Salt Road | Dunes and the open sea, wrecks, the ruined village of Saltmarrow, the Broken Lighthouse (its lamp turns at night). Drowned Sailors with harpoons, Tidecrabs (their shells turn ordinary blows). Old Wenna. Boss: **Captain Morrow, the Drowned**, by his wreck: an anchor on a chain, rings of surf, and his crew climbing out of the shallows. |
| **The Glowcap Hollows** | North-west, off the moor road | A violet hollow of giant glowing mushrooms in spore-mist. Sporelings that burst into poison clouds (even when killed), Glowcap Stalkers. Murk the Myconid. Boss: **Sylvara, the Bloom Witch**, under the Heartcap: thorny roots, spore volleys and clouds, petal blinks, a brood of sporelings. |
| **The Gilded Dunes** | East, past the Ashen Fen | Golden dune ridges and sandstone mesas, the Oasis of Seven Palms, the Lost Caravan, the Sanctum of the Sun. Dune Scorpions (poison stings), Sand Revenants, Sand Wraiths. Tamsin the trader. Boss: **Solkar, the Sun Scarab**: charges, burrows up under you, a beam of sunfire, a sandstorm. |
| **The Amberwood** | South-east, off the Cinder road through the Hunter's Gap | An old forest stuck in autumn: red and gold oaks, birches, leaf drifts, fireflies after dark. The Huntsman's Lodge, the Amber Mere. Rustback Boars (in pairs), Amberwood Poachers with hatchets, archers, and Barkhusks (walking oaks: roots burst up round their slams and in lines at you; fire hurts them). Edda the huntress. Boss: **Hornwood, the Antlered King**, in the Antlered Glade: antler-greatblade sweeps, a charge you can't turn aside, lines of roots, a fan of razor leaves, and at half health the Wild Hunt (boars come out of the trees). |
| **The Shardlands** | South-west, from Brannoc's camp through the Glass Gate | A pale stone steppe split by ridges of glowing crystal that sing in the wind. Pell's Dig, the Singing Spires. Shardback Lizards (they shatter when they die), Glass-Mad Miners, Prism Wraiths, Prism Golems. Pell the glass-cutter. Boss: **Corundel, the Glass Colossus**, in the Heart of Glass: crystal slams, lines of crystal through the ground, crystal erupting under you, and a beam of hard light from its core (three beams at half health). |
| **The Stormspire Heights** | North-east, up the Thunder Stair | Grey crags and needle spires in a thunderstorm whose bolts strike near you after a crackling warning (roll out of the circle). The Broken Monastery. Spire Knights, Thunder Wolves, Spire Gargoyles. Brother Aldous. Boss: **Vaelor, the Storm Herald**: a glaive of captured lightning, thrown bolts, lightning called down on and around you. |

- **Burning and poison** work like frostbite: hits fill a meter (under your stamina bar, and on
  enemies' bars). Burning bursts and then burns for five seconds; poison has no burst but eats at
  you for fourteen. Each region has its own sky (falling cinders, sea mist, drifting spores, desert
  sun, thunderstorms), its own ambience and its own boss music.
- **Smithing**: smithing stones lie in the outer regions and the Vale's far corners. Lay your
  weapon on Hessa's anvil in the Sunken Forge with stones and ash to raise it a level, up to +5
  (9% more damage per level).
- **New gear out there**: the Huntsman's Hatchet (thrown art), the King's Antler (a charge that
  leaves roots behind you), the Prism Blade (a lance of light), the Colossus Shard (crystal erupts in a
  line), the Oakheart and Glass Aegis shields, and the Bramble Snare and Shard Volley rites.
- **Tamsin's wares**: once you've spoken to her at the oasis, her crates sell smithing stones, flask
  seeds (one more flask each) and the Sunsteel Shield (which turns fire aside).
- **The Hollow Bell**: east of the Vale, between the Dunes and the Heights (a branch off the Dunes
  road climbs to it), a plateau of fallen bells sits behind a wall of mist. The mist holds until
  Ashmaw, Morrow, Sylvara, Solkar and Vaelor are all dead (touch it to see who still stands).
  Behind it, in the bell-yard under the spire, is **the Bell-Ringer**: hammer slams that ring outward, a sweep you can parry, a triple toll you
  can't guard, bells dropped on and around you, and in its second phase the spire's great bell
  tolls on its own. Beat it for the Ringer's Hammer and the ending (you can keep exploring after).
- **Spirit summons**: the Spirit Wolves rite (the hounds quest's reward) and the Spirit Knight rite
  (found in the Vale) call spectral allies with blue health bars that fight beside you, follow you,
  and fade after a while or when you rest.
- **Elites**: the Cinder Golems, Spire Gargoyles, Barkhusks and Prism Golems fight with a boss's moveset but are ordinary
  foes: leashed to their posts and back on their feet after you rest.

## Guarding

- **Guard** (hold right click). The guard takes 0.1 s to come up. While it's up you walk at about
  2.4 m/s, lock-on strafing still works, and stamina comes back at 40% of the usual rate. Blows
  from the front (about 100 degrees either side of where you face) are blocked. The guard absorbs
  part of the damage, and each blocked hit costs `damage x cost` stamina. If your stamina can't
  cover a hit, the share it couldn't pay for comes through unabsorbed and your guard breaks: you
  reel for about a second. You can't guard while riding, rolling, attacking, drinking or reeling.
  If you're still holding the button when one of those ends, the guard comes back up.
- **Parry**. A guard press opens a 0.2 s parry window. A parryable blow that lands inside it is
  turned aside: you take no damage and lose no stamina, and the attacker reels. Mashing doesn't
  work, because a press only opens a new window if the previous press was more than 0.45 s
  earlier.
- **Riposte**. A foe you parry or guard-break, or the Warden while he's staggered, is open for
  about 1.8 s. Stand within about 2.6 m in front of it and light-attack to riposte: a 1.1 s scripted
  thrust that deals 3x damage once. You're invulnerable during it. The lock reticle turns red and a
  *Riposte* hint appears under the foe when one is available.
- **What can be parried**. Sword swings can be parried. Shockwaves, leaps and other area hits can
  only be blocked. Anything glowing **spectral blue**, such as the Warden's toll ring, his falling
  bells and the wave when his second phase begins, goes through any guard and has to be rolled. His
  windups for these glow the same blue.
- **Sentries** carry shields. When you swing at a sentry's front, it sometimes raises the shield
  (35% for a sentry, 50% for a captain). Light hits do only chip damage and drain the shield. A
  heavy attack, or enough light hits, breaks the guard and opens the sentry to a riposte. A parried
  sentry staggers for 1.6 s.
- **The Warden**. You can parry his sweep and backsweep. Each parry rocks him back for about a
  second and takes 60 from his poise, and three parries within 10 s force his full stagger. His
  slam and leap can only be blocked.

`player.guardStats` comes from the shield in your left hand, or from the weapon's own `guard` when
there's no shield (see the table below). It holds `absorb`, `cost`, `parryWindow`, `raiseTime`, `arc`
and an optional guard walk `speed`. `ATTACKS.riposte` in `entities/Player.js` holds the riposte's
timing, and a weapon's `riposte` field sets its damage. Hit objects carry `parryable`, `unblockable`, `heavy` and
`riposte` flags (see the header of `systems/Combat.js`). An actor joins in by overriding
`isOpen()`, `onParried(by)` and `onRiposte(by)` from `Actor`. `takeHit` returns `true`, `'block'`,
`'parry'` or `'break'`, and Combat plays the matching sparks, flash, sound and hit-stop.

## Weapons, shields and rites

Open the equipment screen with **I** (or *Equipment* in the pause menu). It pauses the game and
lists what you own for the right hand, the left hand and the rite slot, with damage, speed, reach,
guard and the weapon art's focus cost. Click a row to equip it at once: the model swaps in your hand
and the moveset changes. A two-handed weapon stows your shield, and a shield needs a one-handed
weapon. The bottom-left widget shows what you're holding, plus the art (C) and rite (V) with their
focus costs. Each one dims while it cools down and its cost turns red when you're short of focus.

| Weapon | Hands | Light chain | Character | Art (C) | Where |
| --- | --- | --- | --- | --- | --- |
| Wayfarer's Blade | One | 3 hits | The all-rounder you start with | **Ember Arc** (12 focus): a burning crescent that skims the ground and cuts through every foe in its path | Start |
| Ashen Greatblade | Two | 2 sweeps | Slow and wide, with heavy poise damage | **Quake** (18): drive it into the ground; the blow and the shockwave stagger | Watch Ruins, in the tower stump |
| Pilgrim's Spear | One | 3 thrusts | Longest reach. With a shield, a light press while guarding thrusts from behind it | **Lunging Pierce** (10): a long dash thrust with i-frames | Brannoc's camp |
| Twin Fangs | Two (paired) | 4 quick stabs | Cheap on stamina, weakest guard, widest parry window | **Ghoststep** (10): blink behind your lock target (or a few strides ahead) and stab; 1.6x from behind | By the wreck on the Western Moor |
| Warden's Bell-Maul | Two | 2 swings | Very slow, huge damage and poise | **Toll of Silence** (22): a ring shockwave around you, then an echo | Reward for silencing the Warden |
| Cinder Saber | One | 4 quick cuts | Fast, light, wide arcs | **Ember Arc** (12) | Reward for *Snuff the Lanterns* |
| Mirewatch Halberd | Two | 3 thrusts | Long reach, sweeping heavy | **Lunging Pierce** (10) | On the moor road among the hound packs |
| Captain's Cleaver | One | 2 heavy chops | Slow for a one-hander, hits like a greatsword | **Toll of Silence** (22) | Against the cracked bell in the chapel |
| Mother's Fang | Two | 3 swings | A greatsword of bone: big poise damage | **Mother's Pounce** (16): leap onto your foe and land in a ring of ash, untouchable at the top | Reward for beating Vharra |
| Dunmarrow Longsword | One | 3 hits | Longer and a touch slower than the Wayfarer's Blade | **Lunging Pierce** (10) | By the keep's door in the castle courtyard |
| Icicle Estoc | One | 3 thrusts | Needle-quick; every hit builds frostbite | **Winter's Edge** (12): three thrusts in a heartbeat, each leaving frost | Reward for *A Lantern on the Steps* |
| Rime Glaive | Two | 3 sweeps and thrusts | Long reach; every hit builds frostbite | **Glacial Lance** (16): hurl a lance of ice that pierces through a line of foes | Reward for beating Saelith |
| Trollbone Club | Two | 2 swings | The slowest and heaviest in the game | **Quake** (18) | Reward for felling Grimhorn |

| Guard | Absorbs | Stamina per damage | Parry window | Notes |
| --- | --- | --- | --- | --- |
| Pilgrim's Buckler (near the First Light notice board) | 80% | 0.95 | 0.24 s | Quick to raise |
| Gatewarden Greatshield (by the Gatehouse Shrine) | 100% | 0.6 | 0.12 s | Wider arc; you walk at 1.6 m/s behind it |
| Rimeguard Greatshield (in the troll's den on the Howling Field) | 100% | 0.68 | 0.14 s | Lighter than the Gatewarden: 1.8 m/s behind it |
| No shield | 40% to 72% by weapon | 1.25 to 1.7 | 0.1 s to 0.26 s | See each weapon's `guard` |

**Focus** is the blue bar between health and stamina. It starts at 60, and each point of **Mind**
adds 6 to it and 6% to rite strength. It comes back at 1.5 per second and refills when you rest at
a shrine or level up. Arts also cost stamina, and both arts and rites have short cooldowns. Pressing
C or V without enough focus just blinks the bar.

| Rite (V) | Focus | Cooldown | Effect | Where |
| --- | --- | --- | --- | --- |
| Lantern Bolt | 14 | 0.9 s | A fire bolt that flies at your lock target, or at the foe in front of you | Bounty reward (*Ash in the Watchtower*) |
| Ward of Ash | 25 | 14 s | 8 s of 40% less damage taken (a ring of ash at your feet; it flickers before it fails) | Among the graves on the road north |
| Mending Light | 30 | 12 s | Heals 80 over 6 s | Beside the cairn at Mirelake Shore |
| Frost Nova | 28 | 7 s | A ring of frost bursts from you: 26 damage and heavy frostbite to everything it passes | In the ruined frost chapel on the Rimewold's east rise |

Gear on the ground shows as the item itself turning over a pale glow. Press E to take it and you'll
see *Acquired: ...*. Pickups you've taken never come back, because owned gear doesn't respawn.
Owned gear, equipped slots and Mind are saved, and older saves load with the starting gear.

Balance check (a stepped bot in god mode with base stats and no shield, fighting the Warden with
light chains, the art and ripostes): every weapon kills him in 33 to 49 s and takes about three
staggers. The bot would have taken 280 to 620 damage against 100 HP, so dodging is still on you.

## Map and fast travel

**M** (or *Map* in the pause menu, or D-pad right) opens a full-screen map of the Vale: shaded
relief drawn once from the terrain's height field, with the lake, the roads, the arena ring and
Castle Dunmarrow. Markers show where you are and which way you face, lit lanterns, the people you
can talk to, quest objectives, the mist gate and any ash you dropped. A place gets its name on the
map once you've walked into it; discovered places are saved (`state.discovered`), and saves from
before the map count the places of kindled lanterns.

Click a lit lantern, on the map or in the list beside it, to travel there. It's a plain teleport:
it doesn't count as resting, so enemies stay as they are and your flask isn't refilled. You can't
travel during a boss fight or while you're down. The fen pools show on the map in black.

Scroll (or the + and - buttons) to zoom, and drag to pan. Friends in a shared Vale show on the map
and the compass. Click anywhere on the map to set your own waypoint: a pale blue pin on the map and
the compass, and a pillar of light in the world. Click it again to clear it; it clears itself when you
arrive.

## The Undercroft

Once the castle is open, the door in the keep's east wall (in Castle Dunmarrow's courtyard) leads down
into the Undercroft: the watch's catacombs, roofed and walled, lit only by torches. It is built off the
edge of the map as a hidden lobe (`data/biomes.js` CRYPT holds its floor plan as rooms and passages on a
6 m grid; `world/Biomes.js` raises a wall round every open cell and a vault over it), so the camera is
kept inside its walls and under its roof (`World.camBlocked`), and the sun and most of the sky light
are shut out (the `crypt` weather's `cave` setting). Four lights follow the torches nearest you.

- **The stair hall**, with Dorn the gravedigger and the Undercroft Shrine; **the ossuary**, a ring of
  pillars round a heap of bones, walls full of skulls; **the catacombs** to the west, and a forgotten
  reliquary off them; **the cistern** to the east, black water between stone piers; and **the Bone
  Chapel** at the far north end.
- **Traps**: blades swinging across the east passage from the vault, iron spikes under the plates of the
  west passage, and vents breathing fire across the north passage and the cistern. They strike
  anything in the way, foes included.
- **Skeletons of the Watch** fight like the sentries, and get back up a few seconds after you cut them
  down, once, unless the last blow was heavy, a riposte or a backstab, or fire was in their bones.
  **Ghouls** run in packs and their bite festers. **Gravewardens** (elites) carry a grave-slab shield,
  send bone spikes up round their slams and charge across the room.
- **Vesperine, the Ossuary Queen**, the chapel's last abbess: long scythe sweeps (parryable) and a
  spinning dance, bone spears in lines and under your feet, a blink through her candle-smoke, and her
  dead called up from the floor. At half health the candles flare green and everything doubles.
- **Gear**: the Gravedigger's Spade (bone spears in a ring), the Bone Ward shield, the Grave Chill rite
  (a cone of tomb-cold that builds frost), and the Queen's Scythe, whose art calls two spectral
  skeletons to fight beside you.

## Backstabs, appearance and New Game+

- **Backstabs**: get right behind an ordinary foe that isn't mid-swing (and hasn't noticed you, for
  the elites) and a light attack becomes a critical stab, a little weaker than a riposte. The riposte
  marker shows when one is ready. Bosses can't be stabbed in the back.
- **Appearance** (pause menu): ten cloak colours, six armour finishes (steel, blackened, gilded,
  verdigris, bone white, rusted) and six helm ornaments (plain, plume, horns, wings, antlers, a halo).
  It's kept between journeys, and other players in a shared Vale see you as you chose.
- **New Game+**: the ending card offers the next journey. You keep your level, gear, smithing, ash,
  items and flasks; every foe and great one comes back, takes 60% more killing and hits 35% harder for
  each journey past the first, and gives half again as much ash. The level screen shows which journey
  you're on.

## Test menu

Press **`** (backquote), or choose *Test menu* in the pause menu. It pauses the game and frees the
cursor; ` or Esc closes it. It's always available, not only with `#debug`.

- **Travel**: every place in `data/world.js` (new zones appear by themselves), the mist gate (you
  stand in front of it, facing it), and *Start the boss fight* (inside the arena, Odran awake). If
  the Warden is dead, *Revive the Warden* resets him, seals the mist and shuts the north gate.
  Travel gets you off the horse, clears the lock-on, ends a running boss fight, shows the place's
  banner and closes the menu.
- **Player**: god mode, infinite stamina, infinite focus, restore everything (health, stamina,
  focus, flasks), +5,000 ash, +5 to every stat, and *Fall* to test dying.
- **Enemies**: kill everything within 30 m, respawn all, freeze enemy AI, and spawn any kind from
  `enemyKinds()` 5 m in front of you. Spawned enemies vanish when you rest, die or respawn all, so
  saves and quests stay sane.
- **Gear and items**: give Wisp (and call her), give all gear, or any single weapon, shield, rite or
  key item (read from the data files).
- **Boss**: start the fight, force phase 2, stagger, kill, reset, set his health, and *Rehearse*
  (full restore, then straight into the fight, with or without the cutscene).
- **Second boss**: fight Vharra (with or without her cutscene; revives her if she's beaten), set
  her to 50% (phase 2) or 10%, kill her, or put her back to sleep.
- **Debug views**: hitboxes (body capsules, red while invulnerable, and attack reach wedges),
  colliders near you, and a free camera (WASD, mouse, E up, Q down, Shift fast).
- **Saves**: save now, wipe (asks twice), and copy or paste a save code to share a moment.
- **Quests**: advance the main quest a stage, complete everything (with rewards), reset all.
- **World**: a time-of-day slider (live), the day cycle, weather, the simulation speed (0.25x to 2x),
  the HUD on or off, and a performance overlay (fps, draw calls, triangles, position, zone) that
  sits under the health, focus and stamina bars.

The `#debug` key shortcuts are listed at the bottom of the menu.

## Code map

```
index.html, style.css      page shell and all UI styles
vendor/                    three.js r160 (MIT, see THREE_LICENSE)
src/main.js                boot
src/lib/three.js           the single three.js import, so CDN vs. vendored vs. bundler is one line
src/core/                  Game (loop + glue), Input (keys, mouse, gamepad), CameraRig, Audio, Events, math/noise
src/world/                 World (terrain, colliders, set pieces), Sky
src/models/                procedural models: humanoid rig, characters, horse, props, weapons + shields
                           (weapons.js, with the stances and move poses); pose.js animates them
src/entities/              Player, Horse, Sentry (common enemy), Warden (boss), NPC
src/systems/               Combat (hit detection), Quests, Interactions (E prompts), Save
src/effects/               Particles, Effects (shockwaves, falling bells), Projectiles (bolts, crescents)
src/data/                  world layout, quests, dialogue, items, weapons + shields, arts + rites
                           (abilities.js), gear pickups (loot.js): content lives here as data
src/core/Gamepad.js        Gamepad API polling (standard mapping) and D-pad menu navigation
src/ui/HUD.js              DOM overlay and most menus
src/ui/TestMenu.js         the test menu (`)
src/ui/MapScreen.js        the map and fast travel (M)
src/ui/NetPanel.js         the multiplayer screen (N) and the chat bar
src/ui/EnemyBars.js        floating enemy health bars and damage numbers
src/ui/DebugViews.js       hitbox, collider and free-camera views for the test menu
src/net/                   Net (multiplayer client) and Ghost (another player's knight)
src/entities/BigFoe.js     base for humanoid bosses that run their own fights (Troll, Saelith, Morrow,
                           Sylvara, Vaelor) and for elites (Golem, Gargoyle)
src/entities/Drake.js      Ashmaw (and Scarab.js, Solkar): four-legged bosses on the hound's gait code
src/data/biomes.js         the outer regions' layout: lobes, zones, roads, shrines, spawns, loot, stones
src/data/smithing.js       weapon levels and their costs
src/entities/BellRinger.js the Hollow Bell's boss
src/entities/AntlerKing.js, Colossus.js  the Amberwood's and the Shardlands' bosses
src/entities/OssuaryQueen.js, Skeleton.js  the Undercroft's boss, and its dead that get back up
src/world/Biomes.js        the outer regions' set pieces, lava, sea, oasis, glowcaps, storms, scenery
src/models/creatures.js    the outer regions' creatures, bosses and traders
src/ui/ShopPanel.js        Tamsin's wares
src/core/Cutscene.js       boss opening cutscenes (letterbox, camera shots, name card)
src/core/PostFX.js         bloom, colour grade and vignette on High graphics
server.js                  static server + multiplayer relay (Node, no dependencies)
```

### Where the animations are

Everything moves procedurally; there are no animation files. Look here:

- `src/models/pose.js`: the pose system. A pose is a flat object of joint angles; `attackPose`,
  `framePose` and `addGait` blend them over time.
- `src/models/weapons.js`: `STANCES` (how each weapon is held at rest, guarding, sprinting) and
  `MOVE_POSES` (every attack's wind-up and strike poses).
- `src/entities/Player.js`: the player's states (rolls, attacks, guard, ripostes, flask, riding).
- `src/entities/Warden.js`: Odran's moves and his cutscene intro (kneel, rise, roar).
- `src/entities/Hound.js` (`_pose`) and `src/entities/Matriarch.js`: the hounds and Vharra (sleep,
  rise, howl, bite, pounce, tail sweep).
- `src/entities/Troll.js` and `src/entities/Saelith.js`: the north's bosses (their `POSES` and
  move tables); `Bowman.js` and `Wraith.js` for the bowmen and wraiths.
- Emotes: `EMOTES` at the top of `src/entities/Player.js`.
- `src/entities/Horse.js`: Wisp's walk and gallop gaits.
- `src/data/abilities.js`: weapon arts and rites as pose tracks (`keys`) plus timed events.

## Multiplayer

Run `node server.js` on one computer. It prints the addresses to open: `http://localhost:8080` on
that computer, and `http://<its-ip>:8080` for friends on the same network. To play over the
internet, put the folder on any Node host (Render, Railway, Fly.io, a small VPS) and share that
address. Then press **N** in game and choose *Join the shared Vale*. The server address is filled in
automatically when the page came from the game server.

What's shared:
- **Players**: everyone sees everyone else's knight, posed joint for joint (walking, rolling,
  swinging, drinking, riding Wisp, emoting), with their name over their head, their own cloak
  colour and the weapon they hold.
- **Enemies and roaming bosses** (Vharra, Grimhorn, Saelith): one player's game hosts them (shown
  under N; if the host leaves, the next player takes over where things stood). They hunt whoever is
  nearest. Everyone's weapons, arts and rites hurt the same enemies. Their blows are resolved on the
  victim's own screen, so your guard, parries and ripostes work as in single player. Kills give ash
  and quest credit to everyone nearby, and a boss's reward to everyone in the fight.
- **Effects**: arrows, bolts, crescents, ice shards, shockwaves, ice spikes and falling bells show
  for everyone.
- **Chat** with Enter.

Not shared: loot pickups and quests are each player's own (everyone can collect every weapon), and
the Warden is each player's own fight behind his mist. When the host rests or dies, enemies near
other players carry on; the rest respawn. Up to 16 players per server.

**On the claude.ai link** there's no server to run. The page joins its live room by itself, so
everyone who has it open at the same time plays in the same Vale. Share the page with friends from
its Share menu; they need to be signed in to claude.ai (people opening a public link can't join the
room). To play with only some of them, everyone types the same **party code** under N. *Show me
to others* hides you, and *Reconnect* rejoins after a hiccup. Everything (chat included) travels in
each player's room presence, which every viewer can send, so view-only access is enough.

**On your own website** (GitHub Pages, Netlify, any static host) there's no server either: players
connect straight to each other over WebRTC, finding each other through the free PeerJS service
(`vendor/peerjs.min.js`). Everyone opening the site joins the public lobby automatically; a party
code under N makes a private group. The first player in a group relays for the rest, and if they
leave someone else takes over.

How it works: `src/net/Net.js` (presence, events, host election) and `src/net/Coop.js` (shared
enemies, hits, effects).

### Adding things

- **A place**: add a zone to `data/world.js` (it gets flattened ground and an area banner), then
  dress it in `World._buildStructures()`.
- **An enemy**: copy `entities/Sentry.js`. Its state machine (idle, alert, chase, attack, circle,
  hurt, return, dead) and its move table are the template. Add spawns in `ENEMY_SPAWNS`.
- **A quest**: add an entry to `data/quests.js`. Stages complete on events (`shrine`, `boss`,
  `item`, `kill`, `talk`), and NPC scripts in `data/dialogue.js` start or finish quests.
- **A weapon**: add an entry to `WEAPONS` in `data/weapons.js` (moves, `guard`, `stance`, `art`), a
  builder in `BUILD` in `models/weapons.js` (6 meshes or fewer, grip at the origin along +Z), and
  its poses in `MOVE_POSES`. Poses for new weapons are hand targets that `held()` solves into joint
  angles, and it closes the off hand on two-handed hafts. Then place it in `data/loot.js` or give it
  as a quest `reward.weapon`.
- **A shield or rite**: `SHIELDS` (a `guard` object plus a builder in `BUILD_SHIELD`), or `RITES`
  in `data/abilities.js`. Arts and rites are scripted actions: a pose track (`keys`), timed `events`,
  optional `move`, i-frames (`invuln`) and a roll `cancel` time. Anything that flies goes through
  `game.projectiles.spawn(owner, {...})`, which enemies can use too: it hits the owner's foes via
  `Combat.sphere`, so rolls and guards work against it.
- **An attack or animation**: poses are flat joint-angle objects (`models/pose.js`). An attack is a
  wind pose plus a strike pose, timed by windup, active and recover. For a longer scripted move
  like the riposte, use `framePose` with a list of `[time, pose]` keys.

### Models and Blender

Every model is built in code from low-poly primitives, so there are no asset files and no Blender
step yet. When it's time for authored models, export glTF from Blender and load it with three.js's
`GLTFLoader`. Name the bones like the rig in `models/humanoid.js` (hips, torso, head, shoulder,
elbow, hand, hip, knee) and the procedural pose system can keep driving them.

## Debug

Add `#debug` to the URL to start with the performance overlay on (fps, draw calls, triangles,
position; the test menu toggles it any time), plus these keys:

| Key | Action |
| --- | --- |
| 1–6 | Teleport to First Light, Brannoc's camp, the ruins, the lake, the moor, the Gatehouse |
| 7 | Teleport to the mist gate |
| 0 | God mode |
| U | Unlock Wisp |
| L | Gain 5000 ash |
| K | Kill the boss you're fighting |
| 9 | Give every weapon, shield and rite |

`window.game` is exposed in the console.

## Known gaps and next steps

- **Combat depth**: ripostes and backstabs use the sword's animation for every weapon. Smithing raises damage only, not scaling.
- **Camera**: it avoids terrain and stays inside the arena, but it can still clip through ruins and
  castle walls.
- **Performance**: characters are merged into a few skinned meshes and distant things are culled
  (about 150 to 250 draw calls in open areas). Vegetation has no level of detail (LOD).
- **Input**: keyboard, mouse and gamepad; no touch controls yet, and no key rebinding screen.
- **World**: the castle keep's interior is a hook for a later region. Beaten outer bosses clear
  their region's sky, but their land doesn't otherwise change (the Rimewold's thaw does).
- **Multiplayer**: other players show on the compass and the map, and the Multiplayer panel's
  *Go to them* button takes you to their side. Enemies are host-run, so other players see them with a little delay (about a
  tenth of a second), and blows that land at the edge of reach can be judged differently. Loot
  and the Warden aren't shared yet. Player-versus-player is not in.
- **Audio**: everything is synthesized. Recorded sounds and a real boss score would lift it a lot.
- **Saves**: a single autosave slot in localStorage.
