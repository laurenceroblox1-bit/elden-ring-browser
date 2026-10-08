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
| Left click | Light attack, chains three hits |
| Right click / F | Heavy attack |
| Q / middle click | Lock on |
| R | Drink from the flask |
| E | Talk, pick up, kindle or rest at a shrine, pass through the mist |
| H | Call Wisp, or dismount |
| J | Journal |
| Esc / P | Pause (graphics quality and sound toggles are here) |

## What's in the foundation

- **Open vale** (about 660 m across): procedural heightmap terrain, roads, a lake, forests, ruins,
  a graveyard approach, the walled arena and Castle Dunmarrow's facade. The Hollow Bell spire stands
  on the eastern peaks as a landmark.
- **Combat**: stamina-gated light combo, heavy attack, roll with i-frames, backstep, rolling
  attack, poise and stagger, lock-on with strafing, hit-stop, camera shake and sparks.
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
  - *Ash in the Watchtower* (a bounty from the notice board)
- **Soulslike loop**: lantern shrines are your checkpoints. Resting refills your flask and respawns
  enemies, and you level up there with ash (Vigor, Endurance, Strength). If you die, you drop your
  ash where you fell and can reclaim it. Progress autosaves to localStorage.
- **Presentation**: golden-hour sky with sun and fog, a sky-baked environment map, shadows,
  particles, a HUD (bars with damage lag, compass, boss bar, toasts, banners), and synthesized
  WebAudio sound effects plus a drone for the boss fight.

## Code map

```
index.html, style.css      page shell and all UI styles
vendor/                    three.js r160 (MIT, see THREE_LICENSE)
src/main.js                boot
src/lib/three.js           the single three.js import, so CDN vs. vendored vs. bundler is one line
src/core/                  Game (loop + glue), Input, CameraRig, Audio, Events, math/noise
src/world/                 World (terrain, colliders, set pieces), Sky
src/models/                procedural models: humanoid rig, characters, horse, props; pose.js animates them
src/entities/              Player, Horse, Sentry (common enemy), Warden (boss), NPC
src/systems/               Combat (hit detection), Quests, Interactions (E prompts), Save
src/effects/               Particles, Effects (shockwaves, falling bells)
src/data/                  world layout, quests, dialogue, items: content lives here as data
src/ui/HUD.js              DOM overlay and every menu
```

### Adding things

- **A place**: add a zone to `data/world.js` (it gets flattened ground and an area banner), then
  dress it in `World._buildStructures()`.
- **An enemy**: copy `entities/Sentry.js`. Its state machine (idle, alert, chase, attack, circle,
  hurt, return, dead) and its move table are the template. Add spawns in `ENEMY_SPAWNS`.
- **A quest**: add an entry to `data/quests.js`. Stages complete on events (`shrine`, `boss`,
  `item`, `kill`, `talk`), and NPC scripts in `data/dialogue.js` start or finish quests.
- **An attack or animation**: poses are flat joint-angle objects (`models/pose.js`). An attack is a
  wind pose plus a strike pose, timed by windup, active and recover.

### Models and Blender

Every model is built in code from low-poly primitives, so there are no asset files and no Blender
step yet. When it's time for authored models, export glTF from Blender and load it with three.js's
`GLTFLoader`. Name the bones like the rig in `models/humanoid.js` (hips, torso, head, shoulder,
elbow, hand, hip, knee) and the procedural pose system can keep driving them.

## Debug

Add `#debug` to the URL for an FPS and position readout, plus these keys:

| Key | Action |
| --- | --- |
| 1–6 | Teleport to First Light, Brannoc's camp, the ruins, the lake, the moor, the Gatehouse |
| 7 | Teleport to the mist gate |
| G | God mode |
| U | Unlock Wisp |
| L | Gain 5000 ash |
| K | Kill the boss (during the fight) |

`window.game` is exposed in the console.

## Known gaps and next steps

- **Combat depth**: blocking, parrying and ripostes, more weapons and an equipment screen,
  backstabs, jump attacks.
- **Camera**: it avoids terrain and stays inside the arena, but it can still clip through ruins and
  castle walls.
- **Performance**: each character is about 40 meshes. Merging meshes per bone, or skinned glTF
  models, would cut draw calls (about 500 in open areas today). Vegetation has no level of detail
  (LOD).
- **Input**: no gamepad or touch controls yet; keyboard and mouse only.
- **World**: Castle Dunmarrow is a facade with barred doors and is the hook for region two. The
  sentries are the only regular enemy type.
- **Audio**: everything is synthesized. Recorded sounds and a real boss score would lift it a lot.
- **Saves**: a single autosave slot in localStorage.
