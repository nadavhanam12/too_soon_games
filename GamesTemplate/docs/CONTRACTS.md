# חוזים בין החלקים (פקודות, נתיבים, קבצים)

**סטטוס: החלטה** (2026-11-14). כל חלק של התבנית מסתמך רק על מה שכתוב כאן, לא על פרטי המימוש של חלק אחר.

## תיקיות ופלט

| חלק | תיקייה | פקודה | פלט |
|---|---|---|---|
| קוד לקוח משותף | `GamesTemplate/common-game-code` | `npm run build -- <GameId>` (רק `/publish-game`) | `GamesTemplate/dist/<slug>/index.html` (+ `assets/` אם יש) |
| | | `npm run build -- <GameId> --local` | `GamesTemplate/.local-dist/<slug>/` (כלי הבאגים, כלי התמונות) |
| | | `npm run check -- <GameId>` | typecheck של התבנית + המשחק, exit 1 בשגיאה |
| | | `npm run dev -- <GameId>` | build ל־`GamesTemplate/.local-dist/<slug>/` ושרת סטטי על `http://127.0.0.1:5173/<slug>/` עם build מחדש בשמירה |
| אתר הסטודיו | `GamesTemplate/frontend` | `npm run build` | `GamesTemplate/dist/index.html`, עמודי החובה, `_headers`, `robots.txt`, `sitemap.xml`, `_worker.js` |
| שרת | `GamesTemplate/server-and-data/worker` | `npm run dev` / `npm run deploy` / `npm run smoke` | `http://127.0.0.1:8787` מקומית |
| תמונות שיתוף | `GamesTemplate/other-services/assets` | `node make-assets.mjs <GameId> [--force]` | `Games/<GameId>/assets/og.png` (1200x630), `cover.png` (1200x900); קיימים לא נדרסים |
| כלי הבאגים | `GamesTemplate/other-services/bugcheck` | `node run.mjs <GameId> [--server]` | `out/report.md` + צילומי מסך; exit 1 באדום |
| פריסת אתר | מ־`GamesTemplate` | `server-and-data/worker/node_modules/.bin/wrangler pages deploy dist --project-name toosoon-games` (ה־wrangler הנעוץ; `npx wrangler` מחוץ לתיקיית השרת מוריד גרסה שדורשת Node 22) | `https://toosoon-games.pages.dev` |

`<GameId>` = שם התיקייה ב־`Games/` (PascalCase). `<slug>` = `game.json.slug` (kebab-case). `dist/` ו־`.local-dist/` לא ב־git.

**`dist/` = תיקיית הפרסום בלבד.** `/publish-game` מעלה את כל `dist/` ובונה מחדש רק את המשחק שמתפרסם, אז כל מה שנכתב
ל־`dist/` עולה לאוויר בפרסום הבא של משחק כלשהו. לכן dev, כלי הבאגים ו־`make-assets.mjs` / `make-clip.mjs` בונים
ל־`.local-dist/` ולא נוגעים ב־`dist/`. רק build בלי `--local` (שלב 6 של `/publish-game`) ובניית האתר (שלב 7) כותבים ל־`dist/`.

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
`publicBase` = `https://toosoongames.app`. `apiBase` = `https://api.toosoongames.app`. ריק = יחסי/לא פעיל.

## API (סיכום; המלא ב־ARCHITECTURE.md)
`GET /v1/version`, `GET /v1/games/:slug/count` → `{players, plays, playsPublic}` (playsPublic = מה שמציגים, החלטה 51), `GET /v1/games/:slug/board?limit&userId`,
`POST /v1/games/:slug/scores`, `POST /v1/games/:slug/events`, `PUT /v1/admin/games/:slug` (header `x-admin-key`).

## hooks לבדיקות (בכל build של משחק, על `window`)
`__go(scene)`, `__advance(seconds)`, `__state()` (כולל `banner`), `__scenes()` (רשימת כל המסכים), `__music()` (מצב המוזיקה והקבצים),
`__manual(on)` (השעון האמיתי מפסיק להזיז את המשחק, רק `__advance`), `__seed(n?)` (קורא או מאתחל את ה־seed). הפרמטר `#scene=<name>` ב־URL פותח
במסך. `?c=<score>&n=<nick>&u=<id>` = קישור אתגר. `?seed=<n>` = ריצה חוזרת (החלטה 69).

**משחק עם שלבים** מוסיף (ב־`play.ts`): `__stages()` (השלבים לפי הסדר), `__stage(name)`, `__world()` (כולל `stage`),
`__peek()` (מצב השלב הנוכחי לקריאה בלבד, מ־`peek()` של השלב, בשביל הבוט). הבוט וקשת העלילה: `Games/<GameId>/playthrough.mjs`
(ARCHITECTURE.md, "כלי בדיקת הבאגים").

## קישור אתגר ב־`_worker.js` של האתר
בקשה ל־`/<slug>/` עם `c` מספרי: מביא את ה־HTML מ־`env.ASSETS`, מחליף `og:title` ל־
`"<n> scored <c> in <title>. Beat them?"` (או `"A friend..."` בלי `n`) ו־`og:description` ל־`tagline`. `n` מנוקה (escape, 16 תווים).
כל בקשה אחרת: `env.ASSETS.fetch(request)`. 404 → `dist/404.html` עם status 404.
