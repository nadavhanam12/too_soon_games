# ארכיטקטורה

**סטטוס: החלטה** (למעט סעיפים שמסומנים "הצעה").

## תמונה כללית

```
שחקן (טלפון/דסקטופ)
   │  HTTPS
   ▼
Cloudflare Pages ── משרת את המשחקים: /<GameId>/  (קבצים סטטיים, CDN עולמי)
   │
   │  fetch /v1/...
   ▼
Cloudflare Worker (api) ── נקודת API אחת לכל המשחקים
   ├── D1 (SQLite)            משתמשים, ניקודים, ספירות
   ├── Analytics Engine       אירועי אנליטיקה (כתיבה מאסיבית, שאילתות SQL)
   └── Cache API              לידרבורד ומספר שחקנים, 10-60 שניות
```

כל משחק הוא תיקייה סטטית. השרת לא יודע כלום על תוכן המשחק, רק על `gameId`.

## הלקוח (`common-game-code`)

```
common-game-code/
  src/
    core/        לולאת משחק, fit() עם DPR נכון, SAFE/H, קלט (מגע+מקלדת), סצנות, מעברים
    draw/        פרימיטיבים לציור: txt, rich, btn, rr, bubble, פונטים, פלטות
    screens/     המסכים המשותפים (title, cutscene, lose, result, board, facts, community)
    share/       ערכות שיתוף לפי קהל, קישור אתגר, העתקה, שיתוף מערכת
    api/         קריאות לשרת: scores, board, events, count. תור אירועים עם אצווה וניסיון חוזר
    analytics/   track(name, props) עם הרשימה הסגורה מ־EVENTS.md
    storage/     userId, כינוי, best score. עטיפה בטוחה ל־localStorage
    audio/       סינתזה (tone/noise/sequencer) כמו ב־FallingCEO; קבצי אודיו אופציונליים
    i18n/        מחרוזות התבנית (כפתורים, הודעות) ב־he וב־en, לפי audience
  game.schema.json   סכמת game.json
  build.ts           esbuild: src המשחק + התבנית → dist/index.html אחד (+ assets/)
```

משחק חדש (`Games/<GameId>/`) מחזיק: `game.json`, `content.ts` (כל הטקסט), `play/` (הסצנות
הייחודיות), `assets/` (אם יש), `research.md`. את השאר הוא מייבא.

### קנבס, גודל וחדות

- `W = 360`. `H` נקבע ב־`fit()` לפי יחס המסך, מוגבל ל־`640..780`.
- `SAFE = { top: (H-640)/2, bottom: top+640 }`. ממשק בתוך SAFE, רקע עד `0..H`.
- פיקסלים אמיתיים: `canvas.width = cssWidth * dpr` (dpr עד 3). `setTransform(scale*dpr)`.
  זה התיקון לטשטוש בדסקטופ שקיים במשחקים הנוכחיים.
- overlays של DOM (כפתורי שיתוף, שדה כינוי) ממוקמים ביחידות לוגיות דרך `place()` כמו היום.

## השרת (`server-and-data`)

```
server-and-data/
  worker/
    src/index.ts        ראוטר
    src/routes/*.ts     scores, board, events, count, stats, admin
    src/validate.ts     בדיקות קלט (zod או ידני), מקסימום/מינימום לפי משחק
    migrations/         0001_init.sql, ...   (wrangler d1 migrations)
    wrangler.toml       bindings: DB (D1), EVENTS (Analytics Engine), ADMIN_KEY (secret)
    test/               בדיקות יחידה לראוטים עם miniflare/vitest
  games.json            רישום המשחקים: id, maxScore, minDurationS, שם תצוגה
  backup/export.sh      wrangler d1 export → backups/<date>.sql (מקומי)
```

### API

| שיטה | נתיב | גוף / פרמטרים | מחזיר |
|---|---|---|---|
| POST | `/v1/games/:game/scores` | `{userId, nick?, score, durationS, stage?, version}` | `{rank, total}` |
| GET | `/v1/games/:game/board?limit=20&userId=` | | `{top:[{nick,score,isYou}], you:{rank,score}?, total}` |
| POST | `/v1/games/:game/events` | `[{name, ts, props}]` עד 50 | `204` |
| GET | `/v1/games/:game/count` | | `{players}` (cache 60s) |
| GET | `/v1/games/:game/stats?days=7` | header `x-admin-key` | סיכומים יומיים |
| DELETE | `/v1/games/:game/scores/:userId` | header `x-admin-key` | מחיקת טרול |
| GET | `/v1/version` | | `{version, deployedAt}` |

- CORS: רק הדומיין שלנו (ו־localhost בפיתוח).
- Rate limit: 60 בקשות לדקה ל־IP ל־`scores`, 600 ל־`events`. (Workers Rate Limiting binding, חינמי.)
- אירועים נשלחים מהלקוח באצווה כל 5 שניות או 10 אירועים, ועם `sendBeacon` ביציאה.
- הלקוח לעולם לא נתקע על השרת: כל כישלון נבלע, המשחק ממשיך, לידרבורד מציג "לא זמין כרגע".

### נתונים (D1)

```sql
users   (user_id TEXT PK, created_at, last_seen, first_game, lang, country, city, device, nick)
scores  (id PK, game_id, user_id, nick, score, duration_s, stage, version, country, created_at)
        INDEX (game_id, score DESC), INDEX (game_id, user_id)
games   (game_id PK, name, max_score, min_duration_s, created_at)
```
- לידרבורד: `SELECT ... WHERE game_id=? ORDER BY score DESC LIMIT 20`. שורה אחת לשחקן למשחק
  (הניקוד הטוב ביותר), `UPSERT` כשמשתפרים.
- מספר השחקנים: `COUNT(DISTINCT user_id)` מתוך scores + ספירת `game_start` מ־Analytics Engine.
  נשמר ב־cache.
- עתיד: טבלת `accounts (user_id, provider, provider_id)` מצמידה חשבון ל־userId קיים בלי לשנות דבר.

### אנליטיקה (Analytics Engine)

כל אירוע נכתב כנקודה: `blobs=[game, name, userId, country, city, device, version, ...props]`,
`doubles=[value]`, `index=game`. שאילתות ב־SQL דרך ה־API של Cloudflare (או דשבורד קטן בהמשך).
מגבלה חינמית: 100K נקודות ביום. **הצעה:** מעל זה, דגימה אוטומטית של אירועי משחק תכופים
(`stage_start`) ולא של אירועי שיתוף.

### עומס

- Workers מתרחב אופקית, אין מה להגדיר.
- D1 הוא מסד יחיד; כתיבה של אלפי ניקודים בשנייה תאט אך לא תיפול. קריאות הלידרבורד לא
  מגיעות אליו בכלל (cache 10 שניות).
- אירועים לא נוגעים ב־D1.
- מסלול חינמי: 100K בקשות Worker ביום ≈ 10,000 שחקנים ביום. מעבר לזה Paid.

### גיבוי ושחזור

- **Time Travel:** D1 שומר 30 יום. שחזור: `wrangler d1 time-travel restore DB --timestamp=...`.
- **ייצוא מקומי:** `backup/export.sh` מריץ `wrangler d1 export` ושומר `backups/YYYY-MM-DD.sql`
  (לא ב־git). רץ אוטומטית בתחילת `/deploy-server`.
- **עדכון גרסה לא נוגע בנתונים.** migrations הן תוספות בלבד (`ALTER TABLE ADD`, טבלה חדשה);
  אסור `DROP` בלי ייצוא ואישור.

### פריסה

- `/deploy-server`: ייצוא גיבוי → `tsc` → בדיקות → `wrangler d1 migrations apply` → `wrangler deploy`
  → `GET /v1/version` → ‏`GET /v1/games/_smoke/board`.
- `/publish-game <GameId>`: כלי הבאגים → build → `wrangler pages deploy dist` → פתיחת הקישור
  הציבורי → תזכורת לבדיקת טלפון.
- Pages: פרויקט אחד, כל משחק בתת־נתיב `/<gameid>/`. דף הבית (`/`) הוא פורטל המשחקים הקודמים
  (רשימה מ־`games.json`).

### תצוגה מקדימה אישית לקישור אתגר (Pages Function)

`frontend/functions/[game]/index.ts` רץ רק כשיש `?c=` בכתובת: מביא את ה־`index.html` הסטטי של
המשחק, מחליף `og:title`/`og:description` עם HTMLRewriter, ומחזיר. בלי פרמטרים Pages מגיש את הקובץ
ישירות, בלי להריץ קוד. פירוט ובדיקות ב־SHARE.md.

### מסך אדמין (איך קוראים את הדאטה)

`GET /admin` ב־Worker מגיש דף HTML יחיד (מוגן: מפתח האדמין מוקלד פעם אחת ונשמר ב־sessionStorage,
נשלח ב־header). הדף שואל את `/v1/admin/*` ומציג לכל משחק:
- משפך 7/30 יום: הגיעו → התחילו → סיימו → לחצו שיתוף → הגיעו משיתוף, עם אחוזים בין השלבים
- שחקנים ליום (גרף עמודות), מדינות וערים מובילות, מכשירים
- ערוצי שיתוף (`share_click` לפי channel) ו־`referral_start` לפי משתף
- `game_over` לפי שלב (איזון קושי), `error` אחרונים
- הלידרבורד עם כפתור מחיקה לשורה (טרולים)
מקור הנתונים: Analytics Engine דרך ה־SQL API של Cloudflare (ה־Worker שואל בשם החשבון עם API token
כסוד) ו־D1. בלי ספריות גרפים, SVG ידני. זה הדבר הראשון שנבנה אחרי נקודות הקצה, כי בלעדיו
האנליטיקה לא נקראת.

### חובה לכל אתר (עמודים סטטיים ב־`frontend`)

| נתיב | מה | למה |
|---|---|---|
| `/privacy` | מה נשמר (userId אנונימי, כינוי, ניקוד, מדינה/עיר), מה לא (IP, אימייל), למה, כמה זמן, איך מבקשים מחיקה | הדבר הראשון שעיתונאי או פלטפורמה בודקים |
| `/terms` | שימוש אישי, בלי אחריות, גיל 13+, הלוח ציבורי, כינויים פוגעניים נמחקים | מגן על הלוח והמחיקות |
| `/contact` | כתובת מייל ליצירת קשר, ובפרט להסרת תוכן (takedown) ולפניות תקשורת, זמן מענה | חוק 4ד; עמוד אחד שמונע מכתב מעורך דין |
| `/about` | מי אנחנו, מה אנחנו עושים, "פרודיה, לא קשור לגופים האמיתיים" | אמינות, ועוזר לכתבות |
| `/accessibility` | הצהרת נגישות קצרה: מה נתמך (reduced motion, ניגודיות, מקלדת), מה לא (משחק קנבס), דרך פנייה | נדרש בישראל לאתרים מסחריים מעל סף; זול לעשות נכון מההתחלה |
| `/404` | עמוד 404 בעיצוב הסטודיו עם קישור לפורטל | קישורים ישנים משיתופים |
| `robots.txt`, `sitemap.xml` | נוצרים ב־build מ־`games.json` | חיפוש |
| `favicon.svg`, `manifest.webmanifest`, אייקוני 192/512 | הסטודיו, לא המשחק | כרטיסיית דפדפן, "הוסף למסך הבית" |
| `og.png` לפורטל | 1200x630 של הסטודיו | שיתוף של העמוד הראשי |
| `.well-known/security.txt` | מייל לדיווח אבטחה | מקובל, שתי שורות |
| שורת קרדיטים ב־`/about` | פונטים, סאונד, ספריות, לפי רישיון | רישיונות פונטים דורשים זאת |
| באנר קוקיז | **לא.** אין קוקיות של צד שלישי ואין פרסום; ה־userId הוא זיהוי פונקציונלי בצד ראשון. מתועד ב־/privacy. אם ייכנסו פרסומות, זה משתנה | |

## כלים (`other-services`)

```
other-services/
  skills/event-research/   /event-research "<נושא>": תקציר, דמויות, זוויות הומור, הומור מקומי,
                           רגישויות, הרגע שמשתפים, מקורות עם תאריכים → research.md
  skills/deploy-server/
  skills/publish-game/
  bugcheck/                כלי בדיקת הבאגים (ראה למטה)
```

### כלי בדיקת הבאגים (`bugcheck`)

1. **סטטי:** `tsc --noEmit`, `game.json` מול הסכמה, שדות חובה לא ריקים, קבצים שהדף טוען קיימים,
   אין `localStorage`/`fetch` ישירים (חוק 12), charset ו־viewport.
2. **ריצה על כל מסך:** Playwright headless טוען את ה־build, קופץ לכל סצנה דרך `__go(scene)`,
   מריץ שניות אחדות עם `__advance`, אוסף שגיאות JS, מצלם צילום מסך לכל מסך ל־`bugcheck/out/`.
3. **מובייל ומגע:** אותו מעבר בשלושה גדלים (iPhone SE, iPhone 15, Pixel 8), מגע אמולציה,
   בדיקה שכל כפתור באזור הבטוח ובגובה ≥44, ואין גלילה של הדף.
4. **שרת:** מול Worker מקומי (`wrangler dev`): שליחת ניקוד, קריאת לידרבורד עם השורה, שליחת
   אירועים, ניקוד מעל המקסימום נדחה.

הפלט: דוח אחד `bugcheck/out/report.md` עם ירוק/אדום לכל סעיף. אדום חוסם פרסום.
