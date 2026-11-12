# Drop the Chip (FallingCEO)

A single-file English arcade game, "Icy Tower in reverse": `index.html` holds all CSS, markup
and JS. Same skeleton as `GamesExamples/FlightHeros`: one portrait canvas (360x640 logical,
`W`/`H`) letterboxed by `fit()`; every screen is a `scenes.<name>.draw(dt)` function.
No build, no npm, no image files: all art is drawn in code in a hand-drawn style.

Parody of the November 2026 Nvidia CEO scandal. The character is a generic CEO (grey hair,
glasses, leather jacket); the real name appears only in `scenes.facts` with attribution and
"allegedly" for the unverified spy claim. No company logo or name in gameplay; chips carry
product-style labels (`CHIPS`). The Trump platform is a public-figure caricature (`trumpFace`).

## Layout

```
index.html      the whole game. Body: #c canvas, #share and #grp DOM overlays (copied from FlightHeros)
itch.json       itch.io page (user/slug), channel, version, pageUrl - not published yet (pageUrl empty)
```

## Flow

`title` → `intro` (3 story panels) → `howto` ("Watch out for": Trump, apology letters, newspapers, the women; controls are taught by the in-game toast only) → `play` → `over` (resignation letter + stamp + GAME OVER) → `board` (placeholder top-5 `FAKE_BOARD` with the player's row inserted and ranked) → `facts` → `community` (group invite, share row, PLAY AGAIN) → `title`.

## Play (`scenes.play`, `stepPlay`)

- World y grows downward. The CEO (`P.x`,`P.y`) falls under gravity `G`; move by holding the
  left/right half of the screen or arrow/A/D keys (`PX` target speed).
- Platforms (`P.plats`, types in `PT`, spawn weights in `ptype`): landing while falling bounces
  by `bounce`. `chip`/`sign`/`rack` gain a little height (~90 px); specials gain more:
  `trump` (biggest), `buy` (Strong Buy), `keynote` (stage + mic), `sorry` (apology letter,
  camera flash), `rack` (a 3-step DGX staircase placed by `addRow`). `news` platforms break on
  contact. Each landing also arms one extra mid-air jump (`P.canJump`): the on-screen JUMP
  button (`JB`, its own pointer so a second finger can keep holding a side) or Space/Up/W.
- Affair characters (`P.npcs`, drawn by `woman(x,y,kind,tm)`): the Agent (black bun, pink
  dress, China-flag pin, trailing papers) crosses the screen after the 0:20 memo event; the VP
  (blonde, blazer, VP badge, phone, "call me" bubble) drifts across after the 1:15 event. Only one
  of each kind at a time. Touching one is a "date": a huge jump (`vy=-950`), then she attaches
  (`n.on`) and follows the CEO; every 10 s attached (`n.timer`) a headline raises the floor 90 px.
  While attached the screen shakes and the phone vibrates (`navigator.vibrate`) every 3 s (`n.buzz`).
  Landing on an Apology letter detaches every attached woman (she walks off). 1.2 s `P.inv` after a touch.
- Apology counter (`P.sorryN`, HUD bottom-left): the third `sorry` landing spawns a wide golden
  `gold` platform ("BOARD: FULL CONFIDENCE") 150 px above the CEO, the strongest bounce, gone
  after one use.
- Platforms are generated both below (`P.bot`) and above (`P.top`) the camera (`genPlats`); after pruning, `P.top`/`P.bot` are re-derived from the remaining platforms so a fall followed by a climb never leaves a gap.
- Difficulty `LVL()` = `PLAYT/150` clamped to 0..1. It drives: spawn weights in `ptype` (specials
  fade, breaking `news` grows from 10% to 36%), platform width (`mk`, down to 72%), vertical
  spacing (`gap()`, 58–92 → 76–126 px), and the floor's rubber band.
- The floor (`P.floor`, the Nov 12 boardroom) starts `START_GAP` below and rises at `P.fs`
  (16 px/s + 0.5 px/s², capped at 110, plus `fsBonus` from events). It is also pulled up so it never
  lags more than `START_GAP * lerp(.85,.4,LVL())` below the CEO, so climbing high is never safe.
  Touching it → `goNow('over')`. HUD shows "Day N" (one day per 45 s).
- Story events (`EVENTS`, by `PLAYT` seconds): memo leaked (paper plane + flash), investigation
  (headline only), second affair (floor jumps 160 px), senators
  (falling subpoena envelopes `P.env` push the CEO down), downgrade (floor speed +10). After the
  scripted ones, `GENERIC` headlines every 40 s. Headlines render as the "BREAKING" strip (`news()`).
- Humor hooks: the CEO's face follows market cap (`moodOf` → `ceo(...,mood)`), rotating landing
  quips (`QUIPS`), game-over stamp/letter variants by time (`S.stampTxt`, <10 s and ≥180 s), the
  intro's "VP, Health Care" phone panel.
- HUD: time survived, market cap `P.cap` = 5T scaled by distance to the floor, a floor gauge.
- Score = seconds survived; `RANKS`/`rankFor` give the end title; best in localStorage `fallingceo_best`.

## Hand-drawn kit

Palette: charcoal paper (`#161616`), white ink (`INK`), Nvidia green accent (`NV` = `#76b900`)
for chips, buttons, card borders and the floor edge. Light stickers/letters/newspapers keep dark ink.
`ink(pts,w,col,close,amp)` strokes a jittered polyline; `inkRect`/`inkCirc`, `marker`/`markerCirc`
(wobbly fills), `hatch`, `paper()` (pre-rendered dark paper with speckles, green circuit traces and
faint server racks), `sticker` (rotated label), `hbtn` (button), `chip(x,y,w,label)` (GPU package: green substrate, gold pins, dark die with a grid; plain chips pass an empty label, `rack` passes 'DGX').
`inkSeed` advances every ~0.11 s so lines "boil". Font: Patrick Hand (Google Fonts), Rubik fallback.
`ceo(x,y,pose,tm,sc,mood)` draws the character in `fall`/`land`/`slump` poses.

## Audio (synth only, no files)

`sfx.*` one-shots built from `tone`/`noise` (boing, crack, thud, stamp, sad, news, hurt, flash, tick)
plus keynote-style stingers `whoosh`, `ping`, `riser`, `logo` (whoosh+ping). `MUSIC` is a Web Audio
step sequencer (126 BPM, 64 steps, Am-F-C-G): `calm` mode (pad + arpeggio) on title/intro/howto/facts/
community, `play` mode adds bass, kick, clap, hats; `off` on `over` (the `sad` jingle plays instead).
`goNow` switches the mode and fires a stinger per scene (title → `logo`, play → `riser`, else `whoosh`).
`M` key toggles music. Everything waits for the first pointerdown (AudioContext resume).

## Debug hooks

`window.__go(scene)`, `window.__advance(seconds)` (steps frames synchronously), `window.__state()`,
`window.__setT(seconds)` (jump the event clock), `window.__spawn(type)` (drop a platform under the CEO).
`#scene` in the URL hash starts on that scene.

## Publish config (top of the `<script>`)

`PUBLIC_URL` (keep equal to `itch.json` `pageUrl` once published), `WA_GROUP`; `WA_ME` is empty (personal button hidden).
Share overlays: same positions as FlightHeros (`placeShare()`). Local preview: the root
`.claude/launch.json` `games-static` entry attaches to `python3 -m http.server 8765` run from the repo root.
