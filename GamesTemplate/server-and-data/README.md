# server-and-data

השרת של כל המשחקים: Cloudflare Worker אחד + D1 + Analytics Engine. הארכיטקטורה המלאה ב־
[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md), ה־API בטבלה שם.

```
worker/
  wrangler.toml        ההגדרות: bindings, גרסה, origins מותרים
  src/index.ts         ראוטר + CORS + טיפול בשגיאות
  src/routes/          version, count, board, scores, events, admin
  src/analytics.ts     כתיבת אירועים ל־Analytics Engine + שאילתות SQL למסך האדמין
  src/events.ts        רשימת האירועים הסגורה (זהה ל־docs/EVENTS.md)
  src/util.ts          ולידציה, CORS, cache בקצה, rate limit, הקשר הבקשה (מדינה/עיר/מכשיר)
  src/admin.html       מסך הדאטה (/admin)
  migrations/          סכמת D1, תוספות בלבד
  test/smoke.mjs       בדיקת עשן מול שרת רץ
  .dev.vars            סודות מקומיים (לא ב־git). דוגמה: .dev.vars.example
backup/export.sh       ייצוא D1 ל־backups/ (לא ב־git)
```

## הרצה מקומית

```bash
cd GamesTemplate/server-and-data/worker
npm install
npm run migrate:local
npm run dev            # http://127.0.0.1:8787  (מסך האדמין: /admin)
npm run smoke          # בטרמינל שני
```

מקומית אין Analytics Engine לקריאה (הכתיבה נבלעת), לכן מסך האדמין מציג "אנליטיקה לא זמינה" וזה
תקין. D1 מקומי נשמר ב־`.wrangler/state`.

## פריסה ראשונה (אחרי `npx wrangler login`)

הסקיל `/deploy-server` עושה את זה. ידנית:

```bash
npx wrangler d1 create toosoon              # להעתיק את database_id ל־wrangler.toml
npm run migrate:remote
npx wrangler secret put ADMIN_KEY           # מודבק מ־.dev.vars
npx wrangler secret put CF_ACCOUNT_ID       # מלוח הבקרה (Workers & Pages → Account ID)
npx wrangler secret put CF_API_TOKEN        # token עם Account Analytics: Read
npm run deploy
curl https://toosoon-api.<account>.workers.dev/v1/version
```

## רישום משחק (בלי פריסה מחדש)

```bash
curl -X PUT https://<api>/v1/admin/games/chip-drop -H "x-admin-key: $ADMIN_KEY" \
  -H "content-type: application/json" -d '{"name":"Drop the Chip","maxScore":3600,"minDurationS":5}'
```
או מכפתור "+ משחק" במסך האדמין. `/publish-game` עושה את זה אוטומטית מ־`game.json`.

## עדכון גרסה

`VERSION` ב־`wrangler.toml` עולה, `npm run deploy`. הנתונים לא נוגעים. migration חדשה = קובץ חדש ב־
`migrations/` (לעולם לא עורכים קובץ קיים) ואז `npm run migrate:remote` לפני ה־deploy.

## שחזור

- 30 יום אחורה: `npx wrangler d1 time-travel restore toosoon --timestamp=2026-11-20T10:00:00Z`
- מקובץ ייצוא: `npx wrangler d1 execute toosoon --remote --file backup/backups/<file>.sql`
- קוד: `npx wrangler rollback`
