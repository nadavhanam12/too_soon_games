# חופשה בטוחה (FlightHeros)

Hebrew five-stage arcade game about flight FZ1073 (Dubai → Tel Aviv, 30.9.2026), built on the shared template in
`GamesTemplate/`. Read `GamesTemplate/docs/RULES.md` and `docs/CONTRACTS.md` before changing anything here.
The pre-template single-file version (itch.io build, with the WhatsApp group links) stays in
`GamesExamples/FlightHeros/` for reference only; this folder is the maintained game.

The family (בוזגלו-שטרנליכט) is fictional; real details (the dentist, the headphones, 7500, Tabuk) appear in the
facts screen (`content.ts`). The attacker and captain are generic; no airline logo in gameplay. Bibi appears as a
one-line public-figure cameo on the result screen.

## Layout

```
game.json          id, slug "safe-flight", audience il/he, event source + date, score max 12000 / min 20 s, share text
src/main.ts        createGame({cfg, content, theme, scenes:{play}, music, hooks}) - title art, lose art, result celebration
src/content.ts     every player-facing text: title, cutscene (5 steps), lose, result (RANKS), board, facts, community,
                   LINES (passengers, stewardess, trolley guy, captain, Bibi), BANNERS (stage intros)
src/theme.ts       defaultTheme with the navy/amber palette; clouds on non-play screens, red on lose, sky on result
src/art.ts         person/walker/suitcase/bubble/btn/plane/clouds/flag/cheer/hand/headphones/tiedGuy, FAM + colours
src/sfx.ts         game sounds added to the template kit (hit, punch, stab, click, rumble, lose) + MUSIC progression
src/play.ts        the play scene = stage machine: G (score, altitude, held pointer), setStage/stageDone, HUD, keys
src/stages/        run.ts (aisle), door.ts (trolley + lock rings), cockpit.ts (fight), tie.ts (cable + "tied"), fly.ts
tsconfig.json      extends the template's base config
```
Shared screens, share, leaderboard, analytics, audio and the build come from `GamesTemplate/common-game-code`
(rule 6). The mp3 loops of the itch version were dropped for the template's synth sequencer (DECISIONS 41).

## Commands (from `GamesTemplate/common-game-code`)

```
npm run check -- FlightHeros     typecheck template + game
npm run build -- FlightHeros     → GamesTemplate/dist/safe-flight/index.html (85 KB minified)
npm run dev -- FlightHeros       watch + http://127.0.0.1:5173/safe-flight/  (API at 127.0.0.1:8787 when `npm run dev` runs in server-and-data/worker)
node ../other-services/bugcheck/run.mjs FlightHeros --server
```
Local API: register the slug once with `PUT /v1/admin/games/safe-flight` (`x-admin-key` from `.dev.vars`).

## Flow

`title` → `cutscene` (apron, boarding, seated, screams, kids; button "לא במשמרת שלי!") → `play` → `result` →
`board` → `facts` → `community` → `title`. Altitude 0 at any point → `lose` (retry from the stage, altitude
restored to `max(4000, altitude at stage start)`, score kept) or restart.

## Play (`src/play.ts` + `src/stages/*`)

- One template scene. Each stage registers `{enter, step(dt), render, key?}` via `registerStage`; `step` is skipped
  while the template's stage banner pauses the game (dt = 0), so banners can be dismissed.
- `G.alt` starts at 34,000 ft and bleeds 70 ft/s during run/door/cockpit/tie/tied; stage 5 (`fly`) controls it
  directly. `G.score` sums the stage scores (run ≤1800, door ≤1400, cockpit ≤1800+blocks, tie ≤1500+calm, fly ≤1600).
- Input: taps via `input.taps` (one per frame), holds via `input.down` + `G.ps` (where the pointer went down),
  keys via `onKeyDown` hooks per stage (arrows / a d / s for lanes, punches, block) and `input.keys` for fly.
- `stageDone(name, score)` → `R.stageComplete` and the next stage (with its banner); after `fly` → `R.win`.
  `tied` is an interlude, not a tracked stage.
- Debug: template hooks (`__go`, `__advance`, `__state`, `__scenes`) + `__stage(name)`, `__setAlt(ft)`, `__world()`.

## Still missing for publishing

`assets/cover.png` (1200x900) and `assets/og.png` (1200x630) referenced by `game.json`; the real article URL for
`event.sourceUrl` (today a ynet placeholder); `status` is `draft`.
