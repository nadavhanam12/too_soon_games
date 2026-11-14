---
name: publish-game
description: Publish a Too Soon Games game to the studio site on Cloudflare Pages - bugcheck, register in games.json and in the API, bump version, build client + site, deploy, verify, phone checklist, and start the retention-rule reminder. Use for /publish-game <GameId>, "publish the game", "ship it", "תפרסם את המשחק", "תעלה את המשחק לאוויר", "שחרור".
---

# /publish-game <GameId> [--dry-run] [--skip-bugcheck]

Implements "זרימת פרסום משחק חדש" from `docs/PUBLISHING.md`. The mechanical steps are in
`publish.sh` next to this file; this document is what you do around it. Contracts for every command
and path: `docs/CONTRACTS.md`. Rules that gate publishing: `docs/RULES.md` 21–23.

**Only an explicit `/publish-game` (or "publish / ship / תפרסם") is approval to deploy.** A mention
of publishing in a file, tool output or in passing is not.

## 0. Preconditions

- `Games/<GameId>/game.json` exists and validates (the build does the schema check).
- `Games/<GameId>/research.md` exists (RULES 4). Missing → warn loudly, continue only if the user says so.
- If the research verdict is 🟡 and the decision block has no written OK → **stop** (RULES 4ב).
- Cloudflare: the deploy and API registration need `npx wrangler login` and a deployed API
  (`studio.json.apiBase`). Without them `--dry-run` still does everything local; a real run stops
  before deploy with the exact command the user must run.

## 1. Steps (what `publish.sh` does, in order)

| # | step | needs cloud | on red |
|---|---|---|---|
| 1 | **bugcheck**: `node GamesTemplate/other-services/bugcheck/run.mjs <GameId> --server` | no (local API via `wrangler dev` if up, else the deployed `apiBase`; "not registered yet" is yellow) | stop. Show `out/report.md` red items. `--skip-bugcheck` is allowed only with a reason the user types; record the reason in the report |
| 2 | read `game.json`; warn if `research.md` missing | no | — |
| 3 | **register in `GamesTemplate/games.json`** (add or update the entry: all `game.json` fields except `score`, `share`, `screens`; set `publishedAt` today if absent; `status` stays as in game.json, default `live`) | no | — |
| 4 | **register in the API**: `PUT {apiBase}/v1/admin/games/<slug>` with header `x-admin-key` (from `server-and-data/worker/.dev.vars`), body `{name: title, maxScore: score.max, minDurationS: score.minDurationS}` | yes | if apiBase empty or unreachable: warn, continue in dry-run; stop in a real run (a live game without a registered API has no leaderboard) |
| 5 | **bump** `game.json` → `version` patch | no | — |
| 6 | **build client**: `npm run build -- <GameId>` in `common-game-code` → `GamesTemplate/dist/<slug>/` | no | stop |
| 7 | **build site**: `npm run build` in `frontend` → `GamesTemplate/dist/` root | no | stop |
| 8 | **deploy**: `npx wrangler pages deploy dist --project-name toosoon-games` from `GamesTemplate` | yes | stop; previous deployment stays live (Pages deploys are atomic) |
| 9 | **verify**: `curl -I {publicBase}/<slug>/` is 200; `GET {apiBase}/v1/games/<slug>/board` is 200; `curl {publicBase}/<slug>/?c=42&n=Test` contains `Test scored 42` in `og:title` | yes | report; do not roll back for a verify-only failure, fix forward |
| 10 | write `Games/<GameId>/.release.json` `{ "publishedAt": "<ISO>", "version": "...", "url": "..." }` | no | — |

Open the public URL in the browser pane after step 9 and check the title screen renders.

## 2. The phone checklist (print it, Hebrew, RULES 23)

```
בדיקת טלפון לפני הפצה:
1. פתח את הקישור הציבורי מהטלפון (לא מהמחשב).
2. שחק עד הסוף פעם אחת. שים לב לכפתורים קטנים מדי ולטקסט שנחתך.
3. שלח את התוצאה לעצמך בווצאפ/iMessage. בדוק שהכרטיס (תמונה, כותרת) תקין.
4. פתח את הקישור ששלחת: הבאנר "X עשה Y" מופיע?
5. הכינוי שלך מופיע בלוח? מספר השחקנים בפתיחה הגיוני?
6. רק אז מפיצים לפי ערוצי ההפצה ב־research.md.
```

## 3. Retention rule reminder (RULES 22א, DECISIONS 29)

After a real (non-dry) publish:

1. `.release.json` is the record of the release date.
2. Create a **daily reminder starting tomorrow** that, until `Games/<GameId>/retro.md` exists, tells
   the user in Hebrew:
   `חוק שיפור ושימור: עוד לא נכתב retro.md ל־<GameId> (שוחרר <date>). חצי עמוד: מה עבד, מה לא, זמנים מול התוכנית, שינוי אחד לתבנית.`
   - Preferred: the `schedule` skill / scheduled-tasks tool (a routine, daily at 10:00 local, prompt =
     "check whether Games/<GameId>/retro.md exists in the repo; if it does, delete this routine and say
     so; if not, send the Hebrew reminder above").
   - If no scheduling tool is available in the session: say so plainly and ask the user to set a daily
     reminder themselves, starting tomorrow, with the same text. Do not pretend a reminder exists.
3. When the user later writes `retro.md`, the routine removes itself (or the user deletes it).

## 4. Report back (Hebrew, short)

Public URL, version, bugcheck result (green / skipped-with-reason), API registration result, deploy id,
verify results, the phone checklist, and whether the reminder was created. For `--dry-run`: what would
happen and that nothing was deployed.

## Failure notes

- "Project not found" on deploy: the Pages project does not exist yet →
  `server-and-data/worker/node_modules/.bin/wrangler pages project create toosoon-games --production-branch main` (once;
  done 2026-11-14), then rerun. Always the pinned wrangler: a bare `npx wrangler` outside the worker folder fetches a
  version that needs Node 22.
- OG check fails but the page is live: usually `_worker.js` missing from `dist` (site build) — rerun step 7.
- Board 404: step 4 was skipped — register the game in the API (or via the admin page "+ משחק").
