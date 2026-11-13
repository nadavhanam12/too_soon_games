# הקמת Cloudflare (פעם אחת)

**סטטוס: החלטה.** מסלול חינמי, בלי כרטיס אשראי.

## מה אתה עושה (דברים שדורשים חשבון, זהות או תשלום)

1. **פתיחת חשבון:** https://dash.cloudflare.com/sign-up עם אימייל וסיסמה. אין צורך בכרטיס.
   מומלץ להפעיל אימות דו־שלבי (Profile → Authentication).
2. **Node.js:** אם לא מותקן, להתקין את גרסת ה־LTS מ־https://nodejs.org (כולל npm).
3. **התחברות של הכלי לחשבון:** בטרמינל, מתיקיית הפרויקט:
   ```bash
   npx wrangler login
   ```
   נפתח דפדפן, מאשרים, סוגרים. מרגע זה הפקודות רצות בשמך מהמחשב הזה.
4. **Account ID:** בלוח הבקרה, Workers & Pages, בצד העמוד מופיע "Account ID". להעתיק לשורת
   `CF_ACCOUNT_ID` בקובץ `GamesTemplate/server-and-data/worker/.dev.vars` (מותר גם בצ'אט, הוא לא סוד).
5. **API Token לקריאת האנליטיקה:** My Profile → API Tokens → Create Token → Create Custom Token.
   שם: `toosoon-analytics`. הרשאה אחת: **Account · Account Analytics · Read**. Account Resources:
   החשבון שלך. Continue → Create Token. להעתיק לשורת `CF_API_TOKEN` ב־`.dev.vars`. **לא לשלוח בצ'אט.**
   בלי זה הכל עובד חוץ ממסך האדמין, שיציג "אנליטיקה לא זמינה".
6. **Node.js 22 LTS:** הגרסה המותקנת (20) יצאה מתמיכה ו־wrangler החדש דורש 22. להתקין מ־
   https://nodejs.org, ואז אני מסיר את הנעיצה של wrangler 4.80.
7. **(מאוחר יותר, כשתרצה)** דומיין: Domain Registration → Register, או העברת דומיין קיים.
   דורש תשלום. עד אז הכתובת היא `https://<project>.pages.dev`.
8. **(מאוחר יותר, כשתרצה)** אמצעי תשלום: Billing → Payment info. מפעיל R2 לגיבויים ומאפשר
   מעבר ל־Workers Paid כשהעומס יגדל.

## מה האוטומציה עושה מכאן (סקיל `/deploy-server`, הפעלה ראשונה)

- `wrangler d1 create toosoon` → יוצר את מסד הנתונים, כותב את ה־id ל־`wrangler.toml`.
- `wrangler d1 migrations apply` → יוצר את הטבלאות.
- `wrangler secret put ADMIN_KEY` → מפתח אדמין אקראי (נשמר אצלך ב־`.env.local`, לא ב־git).
- `wrangler deploy` → ה־Worker עולה לכתובת `https://api.<account>.workers.dev`.
- `wrangler pages project create toosoon-games` → פרויקט ה־Pages, כתובת `https://toosoon-games.pages.dev`.
- Analytics Engine: נוצר אוטומטית מה־binding ב־`wrangler.toml`, אין מה להגדיר.
- Rate limiting: binding ב־`wrangler.toml`, אין מה להגדיר.

## מה כולל המסלול החינמי (נכון ל־2026)

| שירות | חינמי | מה זה אומר לנו |
|---|---|---|
| Workers | 100K בקשות ביום, 10ms CPU לבקשה | ≈10,000 שחקנים ביום |
| D1 | 5M קריאות שורה ביום, 100K כתיבות ביום, 5GB | מספיק; לידרבורד נקרא מ־cache |
| Analytics Engine | 100K נקודות ביום | ≈6,000 שחקנים ביום ב־16 אירועים; מעל זה דגימה |
| Pages | ללא הגבלת תעבורה, 500 builds בחודש | |
| D1 Time Travel | 30 יום | הגיבוי הבסיסי |

כשחורגים: Workers ו־D1 מחזירים שגיאות עד חצות (UTC). המשחק עצמו ממשיך לעבוד (הוא סטטי
ב־Pages), רק לידרבורד ואנליטיקה נופלים בשקט. סימן למעבר ל־Paid: יום עם מעל 5,000 שחקנים.

## מעבר ל־Paid (כשיגיע הזמן)
Workers & Pages → Plans → Workers Paid (5$ לחודש). כולל 10M בקשות, 50M כתיבות D1, 10M נקודות
Analytics Engine בחודש. אפס שינוי בקוד.

## חירום
- **שחזור נתונים:** `wrangler d1 time-travel restore toosoon --timestamp=<ISO>` (עד 30 יום אחורה).
- **ייצוא ידני:** `bash server-and-data/backup/export.sh` → `backups/<date>.sql`.
- **חזרה לגרסת שרת קודמת:** Workers → api → Deployments → Rollback (או `wrangler rollback`).
