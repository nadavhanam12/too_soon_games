# Drop the Chip (FallingCEO)

English arcade game, "Icy Tower in reverse", built on the shared template in `GamesTemplate/`.
Read `GamesTemplate/docs/RULES.md` and `docs/CONTRACTS.md` before changing anything here.
The pre-template single-file version (itch.io build) is kept in `legacy-itch/index.html` for reference only.

Parody of the November 2026 Nvidia CEO scandal. The character is a generic CEO (grey hair,
glasses, leather jacket); the real name appears only in the facts screen (`content.ts`) with
attribution and "allegedly" for the unverified spy claim. No company logo or name in gameplay;
chips carry product-style labels. The Trump platform is a public-figure caricature (`trumpFace`).

## Layout

```
game.json        id, slug "chip-drop", audience us/en, event source + date, score max/min, share text, fonts
src/main.ts      createGame({cfg, content, theme, scenes:{play}, hooks}) - title art, result art (letter + stamp)
src/content.ts   every player-facing text: title, cutscene steps (3 panels), lose, result (RANKS), board, facts, community
src/theme.ts     the hand-drawn Theme (paper + falling chart bg, marker cards, green ink buttons, stickers)
src/kit.ts       hand-drawn kit: ink/inkRect/inkCirc, marker/markerCirc, hatch, paper(), hbtn, sticker, card, banner
src/art.ts       ceo(x,y,pose,tm,sc,mood), trumpFace, woman(kind), chart(cam), chip(x,y,w,label)
src/play.ts      the play scene: world, platforms, NPCs, events, HUD, headline strip, JUMP button, debug hooks
tsconfig.json    extends the template's base config
```
Shared screens (title, cutscene, lose, result, board, facts, community), share, leaderboard,
analytics, audio and the build come from `GamesTemplate/common-game-code` - never copy them here (rule 6).

## Commands (from `GamesTemplate/common-game-code`)

```
npm run check -- FallingCEO     typecheck template + game
npm run build -- FallingCEO     → GamesTemplate/dist/chip-drop/index.html (67 KB minified)
npm run dev -- FallingCEO       watch + http://127.0.0.1:5173/chip-drop/  (API at 127.0.0.1:8787 when `npm run dev` runs in server-and-data/worker)
node ../other-services/bugcheck/run.mjs FallingCEO --server
```

## Flow

`title` → `cutscene` (3 story panels, FALL button) → `play` → result (rank title, resignation letter + stamp,
nickname field) → `board` → `facts` → `community` → `title`. The game has no stages, so `R.fail()` goes
straight to `result` (no lose screen). Score = whole seconds survived; `content.result.rankFor` gives the title.

## Play (`src/play.ts`)

- World y grows downward. The CEO falls under gravity `G`; hold a side of the screen (`input.down`, `input.px`)
  or arrow/A/D keys. Platforms (`PT`, weights in `ptype`) bounce by `bounce`; `news` breaks on contact;
  `sorry` flashes and detaches attached women, three of them spawn one golden `gold` platform; `trump` is the
  biggest bounce. Each landing arms one extra mid-air jump: the JUMP circle (`JB`, a pointer intercept via
  `setPointerIntercept` so a second finger can keep holding a side) or Space/Up/W (`onKeyDown` hook).
- NPCs (`woman`): the Agent after 0:20, the VP after 1:15. Touching one = huge jump, then she sticks and every
  10 s a headline raises the floor 90 px (shake + `navigator.vibrate`). An apology letter sends her away.
- Difficulty `LVL()` = `PLAYT/150`: spawn weights, platform width, spacing, the floor's rubber band.
- The floor rises at `P.fs` (16 + 0.5/s, cap 110, + `fsBonus`) and never lags more than `START_GAP*lerp(.85,.4,LVL)`.
  Touching it → `R.fail({score: floor(PLAYT), durationS: PLAYT, reason: 'floor'})`.
- Story events (`EVENTS`) by `PLAYT`: memo (paper plane), investigation, second affair (floor +160), senators
  (falling subpoenas push down), downgrade (floor speed +10); then `GENERIC` headlines every 40 s via `news()`.
- Toasts use `R.say`, screen effects `R.shake` / `R.flash`. HUD: survived time, day, market cap, floor gauge,
  apologies counter, JUMP button.
- Debug: `__go`, `__advance`, `__state`, `__scenes` (template) + `__setT(seconds)`, `__spawn(kind)`, `__world()`.

## Art and audio

Palette: charcoal paper `#161616`, white ink, green accent `NV = #76b900`. Font Patrick Hand (declared in
`game.json.fonts`), Rubik fallback. `inkSeed` advances every ~0.11 s (`tickInk()` in the theme bg).
Audio is the template's synth kit (`sfx.*`, `music` sequencer, `M` toggles).

## Still missing for publishing

`assets/cover.png` (1200x900) and `assets/og.png` (1200x630) referenced by `game.json`; `status` is `draft`.
