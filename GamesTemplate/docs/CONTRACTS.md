# חוזים בין החלקים (פקודות, נתיבים, קבצים)

**סטטוס: החלטה** (2026-11-14). כל חלק של התבנית מסתמך רק על מה שכתוב כאן, לא על פרטי המימוש של חלק אחר.

## תיקיות ופלט

| חלק | תיקייה | פקודה | פלט |
|---|---|---|---|
| קוד לקוח משותף | `GamesTemplate/common-game-code` | `npm run build -- <GameId>` | `GamesTemplate/dist/<slug>/index.html` (+ `assets/` אם יש) |
| | | `npm run check -- <GameId>` | typecheck של התבנית + המשחק, exit 1 בשגיאה |
| | | `npm run dev -- <GameId>` | שרת סטטי על `http://127.0.0.1:5173/<slug>/` עם build מחדש בשמירה |
| אתר הסטודיו | `GamesTemplate/frontend` | `npm run build` | `GamesTemplate/dist/index.html`, עמודי החובה, `_headers`, `robots.txt`, `sitemap.xml`, `_worker.js` |
| שרת | `GamesTemplate/server-and-data/worker` | `npm run dev` / `npm run deploy` / `npm run smoke` | `http://127.0.0.1:8787` מקומית |
| כלי הבאגים | `GamesTemplate/other-services/bugcheck` | `node run.mjs <GameId> [--server]` | `out/report.md` + צילומי מסך; exit 1 באדום |
| פריסת אתר | מ־`GamesTemplate` | `npx wrangler pages deploy dist --project-name toosoon-games` | |

`<GameId>` = שם התיקייה ב־`Games/` (PascalCase). `<slug>` = `game.json.slug` (kebab-case). `dist/` לא ב־git.

## `game.json` (בתיקיית המשחק)

```json
{
  "id": "FallingCEO",
  "slug": "chip-drop",
  "title": "Drop the Chip",
  "tagline": "Icy Tower in reverse. How long can a CEO fall?",
  "audience": "us",
  "lang": "en",
  "version": "1.0.0",
  "event": { "title": "Nvidia CEO scandal", "date": "2026-11-12", "sourceUrl": "https://..." },
  "score": { "label": "seconds survived", "max": 3600, "minDurationS": 5, "higherIsBetter": true },
  "share": { "text": "I lasted {result} in Drop the Chip. Rank: {rank}. Beat me: {url}" },
  "screens": { "cutscene": true, "board": true, "facts": true },
  "showPlayerCountFrom": 500,
  "cover": "assets/cover.png",
  "ogImage": "assets/og.png",
  "publishedAt": "2026-11-15",
  "status": "live"
}
```
`audience` ∈ `il | us`. `lang` ∈ `he | en`. הסכמה המלאה: `common-game-code/game.schema.json`.

## `games.json` (רישום, `GamesTemplate/games.json`)
`{ "games": [ <game.json ללא השדות score/share/screens, ועם "id"> ] }`. נכתב על ידי `/publish-game`.
האתר קורא רק אותו. תאריך האירוע נשאר מקונן: `event.date` (לא `eventDate`); האתר קורא את שניהם.

## `studio.json`
`{ name, tagline, email, instagram, tiktok, x, facebook, youtube, cfWebAnalyticsToken, publicBase, apiBase }`.
`publicBase` = `https://toosoon-games.pages.dev` (יוחלף בדומיין). `apiBase` = כתובת ה־Worker. ריק = יחסי/לא פעיל.

## API (סיכום; המלא ב־ARCHITECTURE.md)
`GET /v1/version`, `GET /v1/games/:slug/count`, `GET /v1/games/:slug/board?limit&userId`,
`POST /v1/games/:slug/scores`, `POST /v1/games/:slug/events`, `PUT /v1/admin/games/:slug` (header `x-admin-key`).

## hooks לבדיקות (בכל build של משחק, על `window`)
`__go(scene)`, `__advance(seconds)`, `__state()`, `__scenes()` (רשימת כל המסכים). הפרמטר `#scene=<name>` ב־URL פותח
במסך. `?c=<score>&n=<nick>&u=<id>` = קישור אתגר.

## קישור אתגר ב־`_worker.js` של האתר
בקשה ל־`/<slug>/` עם `c` מספרי: מביא את ה־HTML מ־`env.ASSETS`, מחליף `og:title` ל־
`"<n> scored <c> in <title>. Beat them?"` (או `"A friend..."` בלי `n`) ו־`og:description` ל־`tagline`. `n` מנוקה (escape, 16 תווים).
כל בקשה אחרת: `env.ASSETS.fetch(request)`. 404 → `dist/404.html` עם status 404.
