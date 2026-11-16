# Wasted for Six (WastedForSix)

English (`us`) parody game about the GTA 6 launch day (2026-11-19): an ordinary fan who waited 13 years gets free from
work, gets the game, gets home and types the password. Built on `GamesTemplate/`; read `GamesTemplate/docs/RULES.md`
first. Brief, decisions and humor seeds: `research.md` (idea A, sections 6A / 7 / 10 / 11).

**Real brand (yellow, approved 2026-11-17):** "GTA 6", "Rockstar", "Take-Two" appear ONLY in `content.facts`. In-game it
is "the game", "Six", "launch day". WASTED is drawn in our own 5x7 pixel font (`src/pixel.ts`), never the real game's
typography. No sprites, HUD, logo or font copied; the top-down pixel look is an original homage.

## Story / flow (one `play` scene, six stages, DECISIONS 40)

```
commute (drive home → office) → boss (gray scene) → launch (drive office → detour → store) → clerk (gray scene)
→ home (chase store → home) → pc (type WASTED) → PRESS START beat (1.5 s, rule 13ג) → R.win
```
- **boss:** agree → in-scene WASTED card, then the scene again without that option (`G.agreed`) · fake sick → branch
  `sick` · quit → branch `quit`, money → $0.
- **launch, sick:** forced clinic stop (beat "BRIBING", takes ALL money → sick note). HR minivan roams (biased toward
  you); inside its red circle before the note = fail `fired`; after = toast.
- **launch, quit:** fuel starts at 62% and drains 1/50 per second; empty = fail `fuel`. Forced gas station stop (beat
  "PUMPING", no gray scene) → 0.9 s later a cop spawns, 1 star. The cop's position is saved on store entry (`G.copPos`).
- **clerk:** loan → loan-shark sedan · steal → cop (+1 star) · trade-in → console / couch refused (option removed),
  ring → spouse minivan. Both branches arrive with $0.
- **home:** chaser per store choice; quit branch adds the gas-theft cop resumed from `G.copPos` (≥300 px away). Caught =
  fail (`shark` / `cop` / `spouse`). Chasers sit still for 1.2 s after the banner.
- **pc:** on-screen QWERTY + physical keys, auto-submit at 6 letters. Wrong tries: joke + "n/6 letters in the right
  spot"; from the 5th wrong try the slots reveal W, A, S… as ghosts. First try = +500.
- Password hints: lose heading WASTED; graffiti letters W·A / S·T / E·D painted on each leg's roads (HUD shows found
  letters in password order); "waste" lines (boss, clerk, phone text); sticky notes on the PC.

Retry from a stage restores the snapshot taken when the stage started (`G.entry`: score, money, letters, note, fuel,
stars, copPos, refused trade items). `G.agreed` survives retries on purpose.

## Layout

```
game.json            slug "wasted-for-six", audience us/en, score max 10000 / min 35 s (bot run 45 s in the 3D city, 2026-11-17), status draft
src/main.ts          createGame + title (pixel title, store band), lose art (wreck), result art (TV + fan); lose line by reason
src/content.ts       ALL player-facing text: ranks, BANNERS, LINES, BOSS, CLERK, PC, LOSE_LINES, CONSOLATION, facts, cutscene
src/play.ts          stage machine G, setStage/stageDone/fail/finishGame, HUD (money, score, heat + stars, letters, goal, fuel/note), end beat, debug hooks
src/legs.ts          the three driving legs (commute / launch / home): events → story, beats, game-time timers, time bonus
src/scenes.ts        boss / clerk decision UI (gray world + color portrait + options), in-scene WASTED card, pc password
src/drive.ts         driving logic: player car with the scene's handling (keys + virtual stick, Space = handbrake drift), grid traffic, HR minivan, chasers (cost field to the player), pickups, letters, GPS (gpsTarget), camera; renderWorld = 3D frame + 2D overlays (GPS arrow, HR tag, floats), loading card
src/city.ts          the one shared city, ported from Scene/sun-city-heist.html as data (fixed seed): 12x12 blocks, districts, superblocks, curved roads, roundabouts; PLACES (home/office/store/clinic/gas) on reserved blocks; collision (buildings only, as in the scene); nav grid + costField / downhill / los
src/world3d-api.ts   types shared with the lazy renderer (CityData, Frame, World3D)
src/lazy/world3d.ts  the three.js renderer (sky, sun + shadows, bloom, merged city meshes, cars, pickups, letters, markers, sparks) → lazy/world3d.js, loaded after the first frame (DECISIONS 72)
Scene/sun-city-heist.html  the original scene (source only, not built)
src/art.ts           pixel car sprites (title / cutscene), the fan, sunset/palms, title band, cutscene rooms, TV, LAUNCH DAY sticker
src/pixel.ts         original 5x7 bitmap font (ptxt), string-grid sprites (sprite/blit), grayOut (saturation blend, Safari-safe)
src/portraits.ts     lazy loading of assets/portraits/*.webp after the first frame; drawPortrait + sticker geometry
src/sfx.ts, theme.ts game sounds + MUSIC (4 looped files); asphalt / sunset theme. Sound rule (Nadav, 2026-11-17): the game
                     plays ONLY sounds made for it (music, carsound.ts, sfx.fuelLow). sfx.ts empties the template kit in
                     this game, main.ts stingerFor → null. New sounds go into sfx.ts OURS. Ours now (F minor, Rhodes /
                     real-world style): cash, can, letter (spray + lick), crash, wasted, tick + ok (template buttons),
                     choose (boss/clerk option), type / erase / pwWrong / pwRight (PC), fuelLow. Debug: __sfx(name)
src/carsound.ts      continuous driving sounds (synth, 0 KB): engine (4 arcade gears, louder on gas), drift squeal, wall
                     scrape, HR proximity beeper (sick branch before the note). drive.ts stepWorld calls carSound() every
                     step; a watchdog fades it out when no leg is driving. Low fuel = one sfx.fuelLow chime (legs.ts)
assets/audio/        4 G-funk loops from ACE-Step, ~215 KB each (DECISIONS 74): theme = title/cutscene/PRESS START/result,
                     drive = commute + launch, chase = home, scheme = boss/clerk/pc (play.ts STAGE_MUSIC); lose = silence.
                     Made with /make-music: music/chosen.json says which candidate, prompt and seed each one is
                     (theme = styles-v2/D-lowrider-2, drive/chase/scheme = styles-v2/A-gfunk-1/2/3)
assets/portraits/    8 portraits, 720x960 WebP q70 (~0.9 MB total), shipped next to index.html (DECISIONS 67)
assets-src/portraits/ the 1086x1448 originals (not shipped; regenerate the 720 px set from these)
```

## Tuning values (where to change them)

| value | where | now |
|---|---|---|
| player handling (the scene's) | `src/drive.ts` `MAX_V`, `stepPlayer` | top 46 u/s · +38/s · brake −60/s · let go = coast (×(1−0.8·dt)) · reverse −14 |
| steering / drift | `stepPlayer` | 2.3 rad/s (3.4 with Space), scaled by speed up to 10 u/s; grip 7 (1.4 with Space) |
| touch stick | `stepPlayer` stick branch, `stickPos` | fixed bottom-left (76 from the left, 108 above the screen bottom), grabbed within 100; steer = 2.5 × heading error (capped); gas when within 1.2 rad, brake above 22 u/s in a sharper turn; stick more than 2.2 rad behind the car = reverse (tail aims at the stick) until it is back within 1.2 rad |
| wall hit | `stepPlayer` collide branch | the scene's: any hit −60% speed; sparks + crash above 18 u/s |
| what is solid | `src/city.ts` `solids` | only buildings (the scene): lawns and sidewalks are drivable. Routes (GPS, chasers) keep to roads: block cells cost 4x (`offroad`), the GPS shortcut never crosses a lawn (`roadLine2`) |
| camera + pixels | `drive.ts` `D.zoom`, `PIX` | the scene's: height 95 → 130 with speed (×0.9 per u/s), fov 40, slight tilt; 3D frame at 1/4 of the CSS pixels (PIX 4), drawn with no smoothing |
| GPS around HR | `gpsTarget`, `D.avoidHr` | sick branch before the note: with the HR minivan within 90 u the route avoids a radius of HR_R + 10 |
| chaser top speeds | `addChaser` | shark 41.5 · cop 39.5 · spouse 37.5 u/s (player 46) |
| chaser spawn distance / start hold | `src/legs.ts` home `enter` | 95 u behind · 1.2 s still |
| HR sight radius / spawn / hunting | `HR_R`, `legs.ts` launch, `stepNpc` | 12 u (red circle) · starts 100 u west + 60 u south of the clinic · turns toward you at 35% of junctions |
| traffic | `NPC_N`, `resetWorld` | 44 cars, 17–26 u/s, right-hand lane ±4 |
| fuel | `legs.ts` launch | start 0.62, drain 1/50 per s |
| start wallet | `play.ts` `START_MONEY` | $60 (+$20 per cash pickup in leg 1) |
| leg time-bonus targets | `play.ts` `LEG_TARGET_S` | 40 / 60 / 50 s (bonus = 10 × seconds under) |
| score | pickups +50, near miss +10, letter +200, crash −20, escape +1000 − 10×crashes, password first try +500 |
| boss sticker | `src/portraits.ts` `STICKER` (source px of the 1086-wide original) | cx 948, cy 196, 250x72, −0.2 rad |
| car sound levels | `src/carsound.ts` `IDLE_G` / `ENGINE_G` / `SKID_G` / `SCRAPE_G`, `HR_NEAR` | 0.01 / 0.028 / 0.07 / 0.09 · beeper from 75 u beyond the red circle (1 beep/s → 8/s) |

## Commands (from `GamesTemplate/common-game-code`)

```
npm run check -- WastedForSix
npm run build -- WastedForSix     → GamesTemplate/dist/wasted-for-six/index.html (~122 KB) + lazy/world3d.js (~540 KB) + assets/portraits
npm run dev -- WastedForSix       → http://127.0.0.1:5173/wasted-for-six/
```
The preview tool can't start the dev server from Desktop (macOS EPERM): run `node build.mjs dev WastedForSix` in a
shell and attach the `game-dev` launch config. Debug: `__stage(name, branch?, store?)`, `__world()`, `__warp()` (car
next to the current goal), `__hrHere()`, `__chaserHere()`, `__lose()`, `__stages()`, `__carSound()` (live engine / skid / scrape levels), `__peek()` (car + GPS point, read by
the bot in `playthrough.mjs`: sick → ring → WASTED), plus the template's `__go`, `__advance`, `__state`.

## Ideas to build later (Nadav, 2026-11-17; not started)

1. **Story timeline at the top.** A line across the top of the screen from "woke up" to "playing Six", with a
   dot per milestone and a marker that moves along it as you play. Each time you reach a milestone (e.g. a
   mini-game such as the boss scene), its name appears above the dot: "Getting a day off", "Getting a copy of
   the game", etc. Hooks: the six stages in `play.ts` (`ORDER`, `setStage` / `stageDone`); the HUD already uses the
   top band (`hud()`), so the timeline has to share or replace part of it.
2. **Shoot from the car, with a cooldown.** A fire button (touch) plus a key; after a shot it is unusable for a
   while, with a visible cooldown. Open: what it hits (chasers? HR minivan?) and what a hit does.
3. **Day/night cycle with lighting.** The light changes over the run (morning commute → evening/night by the drive
   home), with lights that matter at night: street lamps, headlights, neon. Hooks: `lazy/world3d.ts` (sun light,
   hemisphere light, fog, sky shader, the lamp points, car headlight meshes); the time of day can follow the stage.

## Still missing for publishing

`assets/og.png` + `assets/cover.png` (`/publish-game` generates them), API registration of the slug,
`status: "draft"`. Not published (Nadav publishes).
