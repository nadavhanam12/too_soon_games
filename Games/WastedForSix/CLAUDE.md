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
game.json            slug "wasted-for-six", audience us/en, score max 10000 / min 120 s, status draft
src/main.ts          createGame + title (pixel title, store band), lose art (wreck), result art (TV + fan); lose line by reason
src/content.ts       ALL player-facing text: ranks, BANNERS, LINES, BOSS, CLERK, PC, LOSE_LINES, CONSOLATION, facts, cutscene
src/play.ts          stage machine G, setStage/stageDone/fail/finishGame, HUD (money, score, heat + stars, letters, goal, fuel/note), end beat, debug hooks
src/legs.ts          the three driving legs (commute / launch / home): events → story, beats, game-time timers, time bonus
src/scenes.ts        boss / clerk decision UI (gray world + color portrait + options), in-scene WASTED card, pc password
src/drive.ts         driving world: player car + virtual stick + keys + steering assist, road-following GPS arrow (gpsTarget), traffic, HR minivan, chasers (BFS over intersections), pickups, letters, camera, render
src/map.ts           the one shared city: 10x10 blocks, 32 px tiles, closed segments → parks, PLACES (home/office/store/clinic/gas), collision, offscreen paint
src/art.ts           pixel car sprites (player/cop/shark/hr/spouse/npc), the fan, sunset/palms, title band, cutscene rooms, TV, LAUNCH DAY sticker
src/pixel.ts         original 5x7 bitmap font (ptxt), string-grid sprites (sprite/blit), grayOut (saturation blend, Safari-safe)
src/portraits.ts     lazy loading of assets/portraits/*.webp after the first frame; drawPortrait + sticker geometry
src/sfx.ts, theme.ts game sounds + synth progression (Am F C G); asphalt / sunset theme
assets/portraits/    8 portraits, 720x960 WebP q70 (~0.9 MB total), shipped next to index.html (DECISIONS 67)
assets-src/portraits/ the 1086x1448 originals (not shipped; regenerate the 720 px set from these)
```

## Tuning values (where to change them)

| value | where | now |
|---|---|---|
| player top speed / accel / brake | `src/drive.ts` `MAX_V`, `stepPlayer` | 175 px/s · +260/s · let go = −340/s |
| turn rate | `TURN_STICK` / `TURN_KEYS` | 6.0 / 4.2 rad/s at speed (55% from standstill) |
| auto-slow in a turn | `stepPlayer` stick branch | target speed × (0.45 + 0.55·cos(turn angle)); ← / → with ↑ caps at 60% (`TURN_SLOW_KEYS`) |
| stick snap to road axis | `STICK_SNAP` | within 0.55 rad (~31°) |
| straighten + lane keeping when not turning | `assist()`, `ASSIST_SNAP`, `LANE` | heading within 0.6 rad, right-hand lane ±14 px |
| crash vs wall slide | `CRASH_V`, `CRASH_DOT` | crash only above 110 px/s and near head-on (dot > 0.85); otherwise slide along the wall |
| chaser top speeds | `addChaser` | shark 166 · cop 158 · spouse 150 |
| chaser spawn distance / start hold | `src/legs.ts` home `enter` | 380 px behind · 1.2 s still |
| HR sight radius | `HR_R` | 84 px (drawn as the red circle) |
| fuel | `legs.ts` launch | start 0.62, drain 1/50 per s |
| start wallet | `play.ts` `START_MONEY` | $60 (+$20 per cash pickup in leg 1) |
| leg time-bonus targets | `play.ts` `LEG_TARGET_S` | 40 / 60 / 50 s (bonus = 10 × seconds under) |
| score | pickups +50, near miss +10, letter +200, crash −20, escape +1000 − 10×crashes, password first try +500 |
| boss sticker | `src/portraits.ts` `STICKER` (source px of the 1086-wide original) | cx 948, cy 196, 250x72, −0.2 rad |

## Commands (from `GamesTemplate/common-game-code`)

```
npm run check -- WastedForSix
npm run build -- WastedForSix     → GamesTemplate/dist/wasted-for-six/index.html (~94 KB) + assets/portraits
npm run dev -- WastedForSix       → http://127.0.0.1:5173/wasted-for-six/
```
The preview tool can't start the dev server from Desktop (macOS EPERM): run `node build.mjs dev WastedForSix` in a
shell and attach the `game-dev` launch config. Debug: `__stage(name, branch?, store?)`, `__world()`, `__warp()` (car
next to the current goal), `__hrHere()`, `__chaserHere()`, plus the template's `__go`, `__advance`, `__state`.

## Still missing for publishing

`assets/og.png` + `assets/cover.png` (`/publish-game` generates them), API registration of the slug,
`status: "draft"`. Not published (Nadav publishes).
