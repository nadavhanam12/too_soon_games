# Half a Marathon, Whole Halloumi (HalfMarathon)

English (`us`) five-stage arcade game, a gift for one of the founders who ran a half marathon in Cyprus on
2026-11-15. Built on `GamesTemplate/`; read `GamesTemplate/docs/RULES.md` first. Brief: `research.md` (lite mode).

**Personal info:** none. No names of the family anywhere, no city, race name or real time. The wife and the baby are
generic (RULES 4א as changed by DECISIONS 64). No external source (RULES 3 exception, DECISIONS 65).

## Layout

```
game.json        slug "half-marathon", audience us/en, score max 7600 / min 40 s, studio-event source
src/main.ts      createGame + title (two-line heading drawn here), lose (sweeper bus), result (arch, wife + baby)
src/content.ts   all text: ranks, LINES per stage, BANNERS, cutscene (4:30 alarm → start line), facts, CUTOFF/fmtRace
src/play.ts      stage machine + the always-on HUD: km / 21.1, race clock, course bar
src/stages/      start (lanes, km 0-3), water (grab ring, 3-8), sun (hold/heat/cats, 8-15), wall (L/R, 15-19), finish (sprint + high five, 19-21.1)
src/art.ts       runner (back/side), person, wife, baby, cat, cups/halloumi/ouzo, seafront, arch, bus
```

## Course model

Each stage sets `G.f` (speed factor). Distance advances `f * km / len` per second; the race clock advances at a
fixed per-stage rate (3:33/km at f = 1). Slow = more real time = more race time. Clock ≥ 3:00:00 → lose (sweeper
bus, retry from the stage). Score = seconds left before 3:00:00 at the finish; the baby's high five takes 60 s off.
Crossing km 21.1 starts a 1.6 s finish moment (`OUTRO_S`, `finishMoment()` in `src/play.ts`: FINISH! banner, confetti, runner slows, hints/HUD speed hidden, taps swallowed), then `R.win` (RULES 13ג).
`resultWords` = finish time (`DNF` for 0). A decent player: ~1:30 race time, ~105 s real.

- Juice (`docs/UX-ANIMATION-RULES.md`): the runner has a squash spring, `impact(a)` / `runnerSq()` in `src/play.ts`
  (+ a per-stride bob in `art.ts`). Big moments use `bigHit()` (hit-stop + shake + flash); small mistakes stay local
  (the wall's wrong button shakes red, the screen doesn't). The high five is the peak: 0.45 s hit-stop + lean-in zoom.
  Forgiveness: cats allow letting go 120 ms late (`CAT_GRACE`), the wall ignores a 2nd touch < 60 ms
  (`DOUBLE_TOUCH_S`) instead of stumbling, the baby target is ±62 (`FIVE_HIT`).
- `playthrough.mjs` (not built): the story arc, one beat per stage, and the bot the bugcheck plays it with (RULES 21ב). Change it with the stages. Stage hooks: `__stages()`, `__peek()` (each stage's `peek`).

## Commands (from `GamesTemplate/common-game-code`)

```
npm run check -- HalfMarathon
npm run build -- HalfMarathon     → GamesTemplate/dist/half-marathon/index.html (~75 KB)
npm run dev -- HalfMarathon       → http://127.0.0.1:5173/half-marathon/
node ../other-services/bugcheck/run.mjs HalfMarathon
```
Debug: `__stage(name)`, `__world()`, `__setRace(sec)` plus the template hooks.

## Still missing for publishing

`assets/og.png` + `assets/cover.png` (`/publish-game` generates them), local/remote API registration of the slug,
`status: "draft"`.
