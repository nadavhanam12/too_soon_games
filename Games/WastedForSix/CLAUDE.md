# TSG: Nice City (GameId WastedForSix, slug nice-city)

Renamed twice on 2026-11-17: first "Calling In Wasted" (calling-in-wasted), then "TSG: Nice City" (nice-city). The GameId (folder, leaderboard key) stays WastedForSix.

English (`us`) parody game about the GTA 6 launch day (2026-11-19): an ordinary fan who waited 13 years gets free from
work, gets the game, gets home and types the password. Built on `GamesTemplate/`; read `GamesTemplate/docs/RULES.md`
first. Brief, decisions and humor seeds: `research.md` (idea A, sections 6A / 7 / 10 / 11).

**Real brand (yellow, approved 2026-11-17):** "GTA 6", "Rockstar", "Take-Two" appear ONLY in `content.facts`. In-game it
is "the game", "VI" (never "Six", Nadav 2026-11-17), "launch day". WASTED is drawn in our own 5x7 pixel font (`src/pixel.ts`), never the real game's
typography. No sprites, HUD, logo or font copied; the top-down pixel look is an original homage.

## Story / flow (one `play` scene, seven stages, DECISIONS 40)

```
commute (drive home → office) → boss (gray scene) → launch (drive office → detour → store) → clerk (gray scene)
→ home (chase store → home) → fiancee (gray scene) → pc (type WASTED) → PRESS START beat (1.5 s, rule 13ג) → R.win
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
- **fiancee:** she is on the couch between you and the PC (opens with "Where is the ring" after the ring trade).
  Tiptoe past → refused, option removed · fake listening → "what did I just say?" quiz, every answer is wrong, option
  removed · asking honestly for one hour → on to the PC; +300 if it was your first pick (`scenes.ts` `HONESTY_BONUS`).
  Cannot be lost. Portraits `fiancee-idle / ring / caught / quiz / ok` (added 2026-11-17, ~105 KB each): a modern PC
  behind her shows WASTED in yellow pixel letters on black (a password hint).
- **pc:** on-screen QWERTY + physical keys, auto-submit at 6 letters. Wrong tries: joke + "n/6 letters in the right
  spot"; every wrong try gives one more letter, already typed in its slot in yellow and not deletable (`scenes.ts` `given`; W, then A, S…; at most 5), so the player only types the rest. From the first wrong try on, the bottom of the monitor shows `content.PC.caughtHint` in yellow instead of the rotating tips. First try = +500.
- Password hints: lose heading WASTED; graffiti letters W·A / S·T / E·D painted on each leg's roads (HUD shows found
  letters in password order); "waste" lines (boss, clerk, phone text); sticky notes on the PC.

Retry from a stage restores the snapshot taken when the stage started (`G.entry`: score, money, letters, note, fuel,
stars, copPos, refused trade items). `G.agreed` survives retries on purpose.

## Layout

```
game.json            slug "nice-city", audience us/en, score max 10000 / min 35 s (bot run 45 s in the 3D city, 2026-11-17), status draft
src/main.ts          createGame, the end-screen hooks (endings.ts), the share picture hook; lose line by reason
src/endings.ts       the two end screens (2026-11-17); the template still owns their texts, buttons and logic. Lose: a gray strip across the top with the painting of whoever ended the run (`culprit`: fired → boss-sick, shark → clerk-loan, spouse → fiancee-caught, cop after stealing the game → clerk-steal, empty tank / gas-station cop → cut-driveway; `cy` = the row kept in the middle), a rubber stamp (`content.LOSE_STAMP`), the heading as a tilted black band with WASTED in the pixel font (`wastedBand`, called from `theme.heading` on the lose screen), a card behind the line + consolation, the timeline under the score. Result: MISSION PASSED kicker, the montage poster (left, 148 x 185) and a receipt of the run's choices (right; `content.RECEIPT`: day off / the game / graffiti / password). `theme.bg` puts result, board, facts and community on the cutscene's halftone backdrop
src/content.ts       ALL player-facing text: ranks, BANNERS, LINES, BOSS, CLERK, PC, LOSE_LINES, CONSOLATION, facts, cutscene
src/play.ts          stage machine G, setStage/stageDone/fail/finishGame, HUD (money, score, heat + stars, letters, goal, fuel/note), end beat, debug hooks
src/legs.ts          the three driving legs (commute / launch / home): events → story, beats, game-time timers, time bonus
src/scenes.ts        boss / clerk decision UI (gray world + color portrait + options), in-scene WASTED card, pc password
src/drive.ts         driving logic: player car with the scene's handling (keys + virtual stick, Space = handbrake drift), grid traffic, HR minivan, chasers (cost field to the player), pickups, letters, GPS (gpsTarget), camera; renderWorld = 3D frame + 2D overlays (GPS arrow, HR tag, floats), loading card
src/city.ts          the one shared city, ported from Scene/sun-city-heist.html as data (fixed seed): 12x12 blocks, districts, superblocks, curved roads, roundabouts; PLACES (home/office/store/clinic/gas) on reserved blocks; collision (buildings only, as in the scene); nav grid + costField / downhill / los
src/world3d-api.ts   types shared with the lazy renderer (CityData, Frame, World3D)
src/lazy/world3d.ts  the three.js renderer (sky, sun + shadows, bloom, merged city meshes, cars, pickups, letters, markers, sparks) → lazy/world3d.js, loaded after the first frame (DECISIONS 72)
Scene/sun-city-heist.html  the original scene (source only, not built)
src/opening.ts       the painted opening: own title scene (full-bleed key art, neon logo, sticker, tagline with its numbers big and yellow (`bigNumbers`, wraps by words; `
` in a content line = line break, also in comic captions), start button with sparks in its colour (`buttonSparks`), credit line + the studio logo from `env.studioLogo`), the cutscene as three comic panels (comicPanel, phoneMessage types the boss's text onto the phone painting's blank LCD, rect `LCD`), comicBackdrop, and missionCard (the stage banner, via the template's optional theme.banner)
src/montage.ts       the character montage (Nadav, 2026-11-17): four slanted panels (YOU = cut-driveway.webp, boss / clerk / fiancee = their `-idle` portrait) with the neon logo ON the pictures (dark halo + screen blend). `G.met` (play.ts, in the stage snapshot, so a retry restores it) says who is in; a panel not met yet is a dark silhouette with "?". Shown (1) full screen after each conversation's Continue, before the next stage (`scenes.ts` `meet` → `montageMoment`: in from black 0.2 s, the new face fades in 0.35–1.15 s with a yellow frame, its name tag stamps, a tap after `MONTAGE_TAP_S` 1.3 s fades out; clerk: montage → ITEM ACQUIRED; boss "agree" → no montage); (2) on the result screen as a poster (`montagePoster`, called from endings.ts `resultArt`); (3) on the link's preview card: `main.ts` `__ogPic()` (all four faces, PNG data URL) is read by `make-assets.mjs`, which puts it on `assets/og.jpg` (JPEG, ~130 KB: WhatsApp shows no picture for a card image over ~300 KB) in place of the title screen (`node GamesTemplate/other-services/assets/make-assets.mjs WastedForSix --force` after the montage changes). The share itself is the link only, never a file (template `overlays.ts`, 2026-11-17: with a file attached Facebook / Messenger open their photo picker, WhatsApp splits the message, iOS drops the text). Crops per panel: `SLOTS` fx / fy / zoom (the faces stay clear of the logo)
src/item.ts          ITEM ACQUIRED: the moment after the clerk's Continue (sunburst, the game case rising, shine, header, "Paid with" line per store choice from content.ITEM), tap → the case flies to the HUD and the home leg starts; itemIcon = the case in the home leg's HUD (`ITEM_HUD`). The name on the cover is drawn in code on the painting's blank band (`BAND`)
src/art.ts           pixel car sprites, the fan, sunset/palms (the title's backdrop while its painting loads), TV, LAUNCH DAY sticker
src/pixel.ts         original 5x7 bitmap font (ptxt), string-grid sprites (sprite/blit), grayOut (saturation blend, Safari-safe)
src/portraits.ts     lazy loading of assets/portraits/*.webp after the first frame; drawPortrait + sticker geometry
src/sfx.ts, theme.ts game sounds + MUSIC (4 looped files); asphalt / sunset theme. Sound rule (Nadav, 2026-11-17): the game
                     plays ONLY sounds made for it (music, carsound.ts, sfx.fuelLow). sfx.ts empties the template kit in
                     this game, main.ts stingerFor → null. New sounds go into sfx.ts OURS. Ours now (F minor, Rhodes /
                     real-world style): cash, can, letter (spray + lick), crash, wasted, tick + ok (template buttons),
                     choose (boss/clerk option), type / erase / pwWrong / pwRight (PC), fuelLow, bump (wall / traffic
                     nudge) + near (near miss), approved 2026-11-17. Debug: __sfx(name)
src/carsound.ts      continuous driving sounds (synth, 0 KB): engine (4 arcade gears, louder on gas), drift squeal, wall
                     scrape, HR proximity beeper (sick branch before the note), police siren (copSiren: a wail that
                     grows with the nearest cop and turns into a yelp at the bumper), helicopter rotor (heliSound: soft
                     11 Hz "whup" + low hum, fades in over HELI_HEAR 110 u, peak HELI_G 0.03 ≈ the engine at full gas).
                     drive.ts stepWorld calls them every
                     step; a watchdog fades it out when no leg is driving. Low fuel = one sfx.fuelLow chime (legs.ts)
assets/audio/        4 G-funk loops from ACE-Step, ~215 KB each (DECISIONS 74): theme = title/cutscene/PRESS START/result,
                     drive = commute + launch, chase = home, scheme = boss/clerk/pc (play.ts STAGE_MUSIC); lose = silence.
                     Made with /make-music: music/chosen.json says which candidate, prompt and seed each one is
                     (theme = styles-v2/D-lowrider-2, drive/chase/scheme = styles-v2/A-gfunk-1/2/3)
assets/portraits/    13 portraits, 720x960 WebP q70 (~1.4 MB total), shipped next to index.html (DECISIONS 67)
assets/scenes/       title.webp (720x1280) + cut-bedroom / cut-phone / cut-driveway.webp (720x960), ~350 KB total. Made from assets-src/scenes/ (not shipped; cut-bedroom.webp is the current bedroom with "13 YEARS" and 8:30 painted in, cut-bedroom-v1.png the earlier one): 10 px worn border trimmed; title cropped 9:16 around the car (x 236..1050) with the sky seam at y 470 repaired (strip above mirrored, band repainted); driveway cropped 3:4 (x 66..1035). If the phone painting changes, retune `LCD` in opening.ts
assets/scenes/logo.webp  the TSG NICE CITY neon logo (2026-11-17), 720x456 on black, ~42 KB. Made from assets-src/scenes/logo-nice-city.webp
                     (1448x1086): cropped to (4, 83, 1444, 995), resized. `opening.ts` `drawLogo` draws it with the screen
                     blend (the black disappears): on the title (replaces the pixel logo; "CALLING IN WASTED" is the pixel
                     subtitle under it) and on the result screen's TV (`main.ts` drawResultArt)
assets/scenes/item-six.webp  the game case, cut out (alpha), 480x721, ~60 KB. Made from assets-src/scenes/item-six.webp (painted on flat green): the green connected to the corners is keyed out, edge despilled, cropped to the case. If the painting changes, retune `BAND` in item.ts
assets-src/portraits/ the 1086x1448 originals (not shipped; regenerate the 720 px set from these)
```

## Tuning values (where to change them)

| value | where | now |
|---|---|---|
| player handling (the scene's) | `src/drive.ts` `MAX_V`, `stepPlayer` | top 43 u/s (was 46) · +38/s · brake −60/s · let go = coast (×(1−0.8·dt)) · reverse −14 |
| steering / drift | `stepPlayer`, `STEER_IN` | 2.7 rad/s (was 2.3; 3.4 with Space), scaled by speed up to 10 u/s; grip 7 (1.4 with Space); the wheel turns at 9/s (full lock in ~0.11 s) instead of jumping |
| driving feel (2026-11-17, visual + audio only) | `drive.ts` `D.body` + `spring` + `impact`, `SLIP_ON`, `SKID_STEP`, `SPEED_LINES_V`, `speedLines`, `edgeArrow`; `lazy/world3d.ts` `skids`, `glow` | body on springs (ω 13, ζ 0.34): tail-out yaw up to 0.19 rad in a turn, squat / dive 0.1 rad, stretch 0.1 on gas, squash 0.09 on brake, a hit kicks squash + dive and a crash punches the camera in 9 u · tire marks (900 segments, fade after 5–9 s) when sideways speed > 8, braking above 16 u/s, or wheelspin under 8 u/s · exhaust puffs under 15 u/s · wall sparks every 0.05 s · red brake glow behind the car · speed lines from 31 u/s · blinking edge arrow for an off-screen chaser · `ev.bump` (wall touch, traffic nudge) → `sfx.bump`, near miss → `sfx.near` |
| touch stick | `stepPlayer` stick branch, `stickPos`, `STICK_ZONE_W/H` | fixed bottom-left (76 from the left, 108 above the screen bottom); a touch anywhere in the bottom-left 190 × 290 corner (or within 100 of it) grabs it, a touch elsewhere on the left 60% flashes its ring; steer = 2.5 × heading error (capped); gas when within 1.2 rad; stick more than 2.2 rad behind the car = reverse (tail aims at the stick) until it is back within 1.2 rad. Touch only (2026-11-17): the template's `input.touch` (main pointer coarse, then the last pointer used) decides; with a mouse the stick is not drawn and cannot be grabbed, the hint and the commute card name the keys (`content.ts` `HOW_KEYS`) |
| drift + boost (2026-11-17) | `drive.ts` `DRIFT_IN/OUT`, `DRIFT_V`, `DRIFT_MIN_S/FULL_S`, `BOOST_V`, `BOOST_S` | stick: heading error > 1.0 rad above 24 u/s starts a drift by itself (grip 3, 3.0 rad/s, no coast drag; white knob), ends under 0.4 rad. Keys: Space (grip 1.4). A slide held 0.35 s or more gives a boost when it ends: top speed +4…+9 u/s for 0.9 s (full after 1.2 s). Measured on the stick: a 90° turn at 46 u/s takes 0.6 s, speed dips to 35, boost to 50 |
| rules pass 13ד–13יב (2026-11-17) | see the names | **scenes.ts:** staged option reveal only on a scene's first screen and a tap finishes it; later screens ready in ≤ 0.4 s (`FAST_AT`, `FAST_GAP`); exit 0.3 s; a tap beside the buttons makes them twitch; PC keys sink when pressed, nearest key in the row wins (`keyAt`), typing over the wrong-shake starts the next try; peak moment on the right password (`PEAK_STOP_S` 0.35 hit-stop, flash 0.7, letters light one by one, zoom on `state.t`). **play.ts:** `FAIL_S` 1.2 s fail moment on driving legs (hit-stop, flash, camera to 62, gray) before `R.fail`; HUD = score + letters + timeline, one gauge (fuel until a chaser exists, then HEAT, blinking in danger), wallet and goal name only for `SHOW_S` 2.6 s after they change; score counts up. **drive.ts:** `HR_SPOT_S` 0.7 s (was 0.3) in the circle before `ev.spotted` ("!" grows over the minivan); pickups fly to the HUD in an arc (`FLY_S`); chasers have the body spring and tire smoke; curb bump from `city.offroad`; `ALARM_S` 1.2 s edge flash when a chaser appears; `D.closeUp` camera at 60 while the fan walks in. **legs.ts:** `WALK_S` 2.4 (1.6 → 2.4 on 2026-11-17 so the timeline moment can be read). Haptics through the template's `haptic()` |
| timeline's big moments (2026-11-17) | `play.ts` `timelineAt`, `cardTimeline`, `loseTimeline`, `TL_CARD_Y`, `TL_ARRIVE_Y`, `TL_FLY_S`, `ARRIVE_HIT_S`, `G.arrive`; `theme.ts` `banner`; `content.ts` `UI.yourDay`, `UI.gotAsFar` | nobody reads the top row while driving, so the timeline is shown when the world stands still, on a dark plate. Names under the dots (`NOW_SCALE`): finished stops normal size and gray, the stop you are working on 1.5× and white, later stops unnamed (suspense). (1) on every mission card, above the yellow band (y 150): leg 1 the pin on WOKE UP, later legs the pin rides to the stop just earned (lands 1.2 s in); when the card closes the row flies up into the HUD in 0.75 s; (2) while the fan walks into a building (y 192, 2.4 s): the pin rides to the next stop, which lights up 1.3 s in; (all ×1.5 on 2026-11-17: too fast to read) (3) on the lose screen (y 389, between the score and Retry): the line draws itself to where the run ended under "YOU GOT AS FAR AS: …". Toasts sit at y 98 while a card is up, 134 otherwise (`hud`) |
| car radio (2026-11-17) | `play.ts` `nextStation`, `G.radio`; `content.ts` `RADIO`; `legs.ts` `radioPos`, `renderRadio`, `radioKey` | button above the minimap (92 × 34) and the R key step to the next track: drive → chase → theme → scheme. The button is a solid key with a blinking glow; it breathes until the radio was used once. The station stays for the rest of the run. Conversations and the PC have no music of their own: the last music carries on (`play.ts` `stageTrack`: your station, else the track of the driving leg before the scene), Nadav 2026-11-17 |
| wall hit (forgiving, 2026-11-17) | `stepPlayer` collide branch, `CAR_R`, `CRASH_V`, `CRASH_DOT` | body radius 1.15 (scene 1.6); a graze slides along the wall and turns the nose away; a crash (−50% speed, −20) only above 30 u/s and near head-on (dot > 0.8) |
| traffic hit | `stepPlayer` npc loop | pushed aside within 4 u, keeps most speed; crash only above 34 u/s |
| roundabouts | `city.ts` `ISLANDS` | none (the scene's four were removed) |
| wide screen (2026-11-17, RULES 8א) | `main.ts` `maxWidth: 1138`; every full-canvas drawing uses `view.x0` / `view.fullW` | 16:9 at most: tablets and ordinary monitors are filled. The 3D world, HUD band, gray scenes, cards and bands span the full width; stick = real bottom-left corner, minimap + radio = real bottom-right; HUD texts, the PC and the template screens stay in the 360 column. **Title:** the painting covers the whole canvas (`opening.ts` `TITLE_WIDE_PY` picks the band with the car). **Conversations** from 760 wide (`scenes.ts` `lay`, `WIDE_MIN`): portrait ×1.6 on the left, line + options on its right (taps follow the offsets). **Montage** in a wide box (`montage.ts` `SLOTS_WIDE`): four slanted columns side by side, logo under the faces (the 2 × 2 grid cut heads off). Lose strip: painting in the column, edges melted (`edgeFade`). Letter keys work on any keyboard layout (template `keyName`, by key position: WASD with a Hebrew layout) |
| where the places are (2026-11-17) | `city.ts` `PLACE_DEF` | picked by a search for the shortest "longest straight stretch" on every GPS route (Nadav: show more of the map, a short first mission, no leg that is one straight line): home (-5,4) south-west, office (-2,-1) west of the central park, store (3,-3) north-east by the ring road, clinic (0,1) south of the park, gas (4,-5) north edge of the docks. Route length / longest straight: commute 390 / 60, sick 531 / 81, quit 588 / 111, chase home 652 / 111. With it: `LEG_TARGET_S` 36 / 64 / 62, start fuel 0.8. Dropped the same day: office north of the ring (commute 702), store on the beach road and on the docks' east edge (straight chases) |
| minimap | `drive.ts` `renderMinimap` | `MINI` 132 px (was 92), bottom-right: you, goal (yellow), chasers + HR (blinking red); the radio button is as wide and sits above it, the hint strip above both (`play.ts` `hint`, 292) |
| character badges (2026-11-17) | `drive.ts` `RESIDENTS` + the loop in `renderWorld`; `portraits.ts` `FACE`, `drawFace` | the face from `<who>-idle.webp` in a round badge that bobs over the building: boss / office, clerk / store, fiancee / home; r 30, white ring; r 38 and a yellow ring when the place is the goal; nothing until the portrait has loaded |
| entry animations | template `core/game.ts` `SCREEN_IN_S` (all non-play screens, banner pop, cutscene cards); `scenes.ts` (portrait drop, panel slide, staggered buttons, PC + keyboard); `play.ts` `hud`, `legs.ts` `controlsIn`, `drive.ts` zoom 190 → 95 | 0.22–0.4 s, `easeOB` |
| what is solid | `src/city.ts` `solids` | only buildings (the scene): lawns and sidewalks are drivable. Routes (GPS, chasers) keep to roads: block cells cost 4x (`offroad`), the GPS shortcut never crosses a lawn (`roadLine2`) |
| camera + pixels | `drive.ts` `D.zoom`, `PIX` | the scene's: height 95 → 130 with speed (×0.9 per u/s), fov 40, slight tilt; 3D frame at 1/4 of the CSS pixels (PIX 4), drawn with no smoothing |
| GPS around HR | `gpsTarget`, `D.avoidHr` | sick branch before the note: with the HR minivan within 90 u the route avoids a radius of HR_R + 10 |
| pack size (2026-11-17) | `drive.ts` `PACK`, `addChaser`, `addHr` | 2 (was 3, 2026-11-17): every addChaser call spawns 2 (each next one 1.2 u/s slower, starts 0.45 s later, on a nearby road); addHr puts out 2 HR minivans (`D.hrs`, offsets `PACK_AT`); GPS avoids the nearest one |
| police helicopter (2026-11-17) | `drive.ts` `stepHeli`, `HELI_*`, `heliView`, minimap icon in `renderMinimap`; `lazy/world3d.ts` `makeHeli` | visual only (never catches you, no random numbers). No chase: first patrol 8 s into a leg, then 30 s after each one leaves; it flies in from 110 u, circles (r 12, 26 u/s) the spot you were heading for 6 s and leaves. Chase (any chaser): comes in from behind, stays over a point just behind you (up to 75 u/s), circles when you slow down. Height 46 (drops with the camera in close-ups to keep its size). Searchlight only in the evening (`D.dusk` > 0.4): on you in a chase, sweeping on a patrol. Minimap: spinning red / blue rotor cross. No sound yet |
| chaser top speeds | `addChaser` | shark 31 · cop 29 · spouse 28 u/s (player 43); turn rate 2.8 rad/s; `CATCH_D` 3 (eased twice on 2026-11-17, Nadav: the escapes are too hard; were 36 / 34 / 32 and 3.8) |
| chaser spawn distance / start hold | `src/legs.ts` home `enter` | 125 u behind · 3 s still (the gas-theft cop: ≥ 100 u, else 160 u behind; one car, `addChaser` `n` = 1, so three chasers at most) |
| chasers near home (2026-11-17) | `drive.ts` `SAFE_R`, `SAFE_V`, `stepChaser` | on the home leg, within 34 u of the house the chasers run at 55% and cannot catch you (Nadav: they always caught him at the door; the arrive radius is 10) |
| PC boot (2026-11-17) | `scenes.ts` `BOOT_*`, `LOGIN_IN_S`, `bootScreen` | monitor off → LED 0.7 s → TSG logo + spinner 1.2 s → login fades in at 2.9 s (×2 on 2026-11-17), keyboard rises after; taps and keys ignored until then |
| gray-scene option reveal (2026-11-17, ×2) | `scenes.ts` `OPT_GAP`, `OPT_IN_S`, `PANEL_IN_S`, `pickDur` | first screen: panel 0.44 s, options from 1.0 s every 0.6 s, each 0.44 s in; later screens ready in ~0.5 s; exit 0.5 s |
| HR sight radius / spawn / hunting | `HR_R`, `legs.ts` launch, `stepNpc` | 9 u (red circle; was 12) · starts 100 u west + 60 u south of the clinic · turns toward you at 20% of junctions (was 35%) |
| traffic | `NPC_N`, `resetWorld` | 28 cars, 17–26 u/s, right-hand lane ±4 |
| pedestrians (2026-11-17) | `drive.ts` `PED_N`, `PED_RING`, `PED_CROSS`, `PED_HIT_*`, `PED_SCARE_*`, `PED_DOWN_S`, `stepPeds`; `lazy/world3d.ts` `makePeds`, `PED_SCALE`, `PED_SHIRT…`; `content.ts` `LINES.ped`; `sfx.ped` | 560 walk the sidewalk ring of every ordinary block (not superblocks) at 3–5.2 u/s and cross at a corner 30% of the time; a car faster than 14 u/s within 16 u makes them run (×2.8). The player's car above 6 u/s flings them (tumble, land flat, 4 s, then a new one appears off screen): −5% speed, float text, `sfx.ped`, haptic, no score and no stars. Chasers fling them too; traffic and HR brake for them. Drawn instanced (5 draw calls, 160 max near the camera), scale 2.3 so they read at PIX 4 |
| chaser label (2026-11-17) | `play.ts` `hud`, `content.ts` `UI.chasedBy` | the heat gauge's label names the nearest chaser: POLICE / LOAN SHARKS / YOUR FIANCEE (HEAT when none). When a chaser appears, a big tilted red band in the middle of the screen names it for `CALL_S` 2.6 s, 0.5 s after the alarm so the mission band is gone (`drive.ts` `chaseCall`, `content.ts` `UI.chaseCall` / `UI.chaseSub`) |
| fuel | `legs.ts` launch | start 0.8 (0.62 until the gas station moved 377 u away), drain 1/50 per s |
| start wallet | `play.ts` `START_MONEY` | $60 (+$20 per cash pickup in leg 1) |
| leg time-bonus targets | `play.ts` `LEG_TARGET_S` | 36 / 64 / 62 s (bonus = 10 × seconds under) |
| score | pickups +50, near miss +10, letter +200, crash −20, escape +1000 − 10×crashes, password first try +500 |
| boss sticker | `src/portraits.ts` `STICKER` (source px of the 1086-wide original) | cx 948, cy 196, 250x72, −0.2 rad |
| car sound levels | `src/carsound.ts` `IDLE_G` / `ENGINE_G` / `SKID_G` / `SCRAPE_G`, `HR_NEAR` | 0.01 / 0.028 / 0.07 / 0.09 · beeper from 75 u beyond the red circle (1 beep/s → 8/s) · siren `SIREN_G` 0.05, heard within `SIREN_FAR` 220 u, yelp under `SIREN_YELP` 35 u (0.42 → 3.4 sweeps/s) |

## Commands (from `GamesTemplate/common-game-code`)

```
npm run check -- WastedForSix
npm run build -- WastedForSix     → GamesTemplate/dist/wasted-for-six/index.html (~122 KB) + lazy/world3d.js (~540 KB) + assets/portraits
npm run dev -- WastedForSix       → http://127.0.0.1:5173/nice-city/
```
The preview tool can't start the dev server from Desktop (macOS EPERM): run `node build.mjs dev WastedForSix` in a
shell and attach the `game-dev` launch config. Debug: `?screen=community` (or result / lose / board / facts; dev builds only, `main.ts`) opens that screen with the full montage once the paintings are in; `__met(...who)` sets who is in the montage; `__ogPic()` = the card's montage as a PNG data URL; `__stage(name, branch?, store?)`, `__world()`, `__warp()` (car
next to the current goal), `__hrHere()`, `__chaserHere()`, `__pedsHere(n)` (stands the nearest pedestrians in front of the car), `__heli()` (starts a helicopter patrol now), `__lose()`, `__stages()`, `__carSound()` (live engine / skid / scrape levels), `__peek()` (car + GPS point, read by
the bot in `playthrough.mjs`: sick → ring → WASTED), plus the template's `__go`, `__advance`, `__state`.

## Ideas to build later (Nadav, 2026-11-17; not started)

1. **Story timeline at the top. DONE 2026-11-17** (`play.ts` `timeline()`, names in `content.ts` `TIMELINE`; in the HUD band on driving legs, on a top strip in the gray scenes and the PC). Original note: A line across the top of the screen from "woke up" to "playing Six", with a
   dot per milestone and a marker that moves along it as you play. Each time you reach a milestone (e.g. a
   mini-game such as the boss scene), its name appears above the dot: "Getting a day off", "Getting a copy of
   the game", etc. Hooks: the six stages in `play.ts` (`ORDER`, `setStage` / `stageDone`); the HUD already uses the
   top band (`hud()`), so the timeline has to share or replace part of it.
2. **Shoot from the car, with a cooldown.** A fire button (touch) plus a key; after a shot it is unusable for a
   while, with a visible cooldown. Open: what it hits (chasers? HR minivan?) and what a hit does.
3. **Day/night cycle with lighting. PARTLY DONE 2026-11-17:** the home leg is in the evening (`legs.ts` sets `D.dusk = 1`
   after `resetWorld`, which resets it to 0; `Frame.dusk` → `lazy/world3d.ts` `setDusk`: low orange sun with long
   shadows, purple sky / fog, lit windows (`windowTex().lit`), bigger lamp glows + pools on the road, headlight beams
   and red tail glows on every car (`addLights`), more bloom and exposure; all levels are the `EVE_*` constants). The
   commute and the launch leg stay in daylight; no gradual change over a run yet. Original note: The light changes over the run (morning commute → evening/night by the drive
   home), with lights that matter at night: street lamps, headlights, neon. Hooks: `lazy/world3d.ts` (sun light,
   hemisphere light, fog, sky shader, the lamp points, car headlight meshes); the time of day can follow the stage.

## Still missing for publishing

`assets/og.jpg` + `assets/cover.png` (`/publish-game` generates them), API registration of the slug,
`status: "draft"`. Not published (Nadav publishes).

**Deploy trap (2026-11-17):** `build.mjs dev` used to write into `GamesTemplate/dist/`, which `/publish-game` deploys whole: a dev server left running during a publish shipped a 1.1 MB dev build whose `apiBase` was 127.0.0.1:8787 (leaderboard "unavailable", no scores saved) as v0.1.1. Dev and `--local` builds now go to `GamesTemplate/.local-dist/`. After a publish check the live page: ~180 KB and `apiBase:"https://api.toosoongames.app"`.
