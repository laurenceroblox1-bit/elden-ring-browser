# Ashen Vale

A soulslike action RPG that runs in the browser, built on three.js with no build step. It's an
original world inspired by the genre: the names, characters, boss and story are all new, so the
project can grow into its own game.

Walk north up the old road through the Vale and kindle lantern shrines. Help the people you meet,
call your spectral mare Wisp, and pass through the mist at the Shattered Gate to face **Odran, the
Bell-Warden**.

## Run it

ES modules need a web server (opening `index.html` straight from disk won't work):

```sh
cd ashen-vale
npx http-server -c-1 -p 8080 .      # or: python3 -m http.server 8080
```

Then open http://localhost:8080. Everything is local, three.js included (`vendor/`). The two
Google Fonts fall back to system serif faces when offline.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse (click the game to capture it) | Look. Arrow keys also turn the camera |
| Shift | Sprint; gallop when riding |
| Space | Roll (with a direction), backstep (without), jump on horseback |
| Left click | Light attack; press again to chain (2 to 4 hits, by weapon). Riposte a reeling foe |
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

- **Open vale** (about 660 m across): procedural heightmap terrain, roads, a lake, forests, ruins,
  a graveyard approach, the walled arena and Castle Dunmarrow's facade. The Hollow Bell spire stands
  on the eastern peaks as a landmark.
- **Combat**: stamina-gated light combo, heavy attack, roll with i-frames, backstep, rolling
  attack, poise and stagger, lock-on with strafing, hit-stop, camera shake and sparks.
- **Guard, parry, riposte**: see *Guarding* below.
- **Gear**: five weapons with their own movesets and weapon arts, two shields, and three rites cast
  with focus. See *Weapons, shields and rites* below.
- **The Warden**: a two-phase boss with six attacks. Phase 1 has the sweep, backsweep, a delayed
  overhead slam with a shockwave, and a leaping strike. Phase 2 starts at half health and adds a
  bell toll ring (roll through it) and spectral bells falling from the sky. He staggers when his
  poise breaks, and a fog gate seals the arena during the fight.
- **Wisp, the horse**: summoned and dismissed with H. She has camera-relative steering, a walk and
  gallop gait, and a jump, and you can attack from the saddle. She won't enter the arena.
- **Quests**: data-driven, with a journal, a tracker, and compass pins. There are four to start:
  - *The Warden at the Gate* (main quest)
  - *A Steed for the Road* (Brannoc unlocks Wisp)
  - *The Pilgrim's Locket* (Sister Ilse gives you an extra flask charge)
  - *Ash in the Watchtower* (a bounty from the notice board; pays ash and the Lantern Bolt rite)
- **Soulslike loop**: lantern shrines are your checkpoints. Resting refills your flask and respawns
  enemies, and you level up there with ash (Vigor, Endurance, Strength, Mind). Resting also refills
  focus. If you die, you drop your
  ash where you fell and can reclaim it. Progress autosaves to localStorage.
- **Presentation**: golden-hour sky with sun and fog, a sky-baked environment map, shadows,
  particles, a HUD (bars with damage lag, compass, boss bar, toasts, banners), and synthesized
  WebAudio sound effects plus a drone for the boss fight.

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

| Guard | Absorbs | Stamina per damage | Parry window | Notes |
| --- | --- | --- | --- | --- |
| Pilgrim's Buckler (near the First Light notice board) | 80% | 0.95 | 0.24 s | Quick to raise |
| Gatewarden Greatshield (by the Gatehouse Shrine) | 100% | 0.6 | 0.12 s | Wider arc; you walk at 1.6 m/s behind it |
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
travel while the Warden's fight is on (the mist holds you) or while you're down.

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
- **Boss**: start the fight, force phase 2, stagger, kill, reset.
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
```

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
| G | God mode |
| U | Unlock Wisp |
| L | Gain 5000 ash |
| K | Kill the boss (during the fight) |
| Y | Give every weapon, shield and rite |

`window.game` is exposed in the console.

## Known gaps and next steps

- **Combat depth**: weapon upgrades, backstabs on ordinary attacks (only Ghoststep has one today),
  jump attacks. Enemies don't use projectiles yet, though the system supports it. Ripostes use the
  sword's animation for every weapon.
- **Camera**: it avoids terrain and stays inside the arena, but it can still clip through ruins and
  castle walls.
- **Performance**: each character is about 40 meshes. Merging meshes per bone, or skinned glTF
  models, would cut draw calls (about 500 in open areas today). Vegetation has no level of detail
  (LOD).
- **Input**: keyboard, mouse and gamepad; no touch controls yet, and no key rebinding screen.
- **Map**: fixed scale with no zoom or pan, and no custom waypoints.
- **World**: Castle Dunmarrow is a facade with barred doors and is the hook for region two. The
  sentries are the only regular enemy type.
- **Audio**: everything is synthesized. Recorded sounds and a real boss score would lift it a lot.
- **Saves**: a single autosave slot in localStorage.
