# frontend - אתר הסטודיו

האתר הסטטי של Too Soon Games: עמוד הבית (משחק נבחר, לידרבורד, רשת המשחקים, עקבו אחרינו), עמודי
החובה, וה־Worker של Pages לקישורי אתגר. המפרט ב־[../docs/FRONTEND.md](../docs/FRONTEND.md), החוזים
ב־[../docs/CONTRACTS.md](../docs/CONTRACTS.md).

```
build.ts               קורא ../games.json + ../studio.json → ../dist/
run.mjs                מריץ את build.ts דרך esbuild (Node 20, בלי tsx)
src/pages/             home, about, privacy, terms, contact, accessibility, 404
src/components/        layout (header/footer/follow), games (hero/card/grid), icons, html helpers
src/styles/site.css    הטוקנים והעיצוב (כהה תמיד). נכתב ל־dist עם hash בשם
src/assets/            logo.png, favicon.svg, og.svg
functions/worker.ts    dist/_worker.js: og:title אישי ל־/<slug>/?c=..&n=.., 404 → 404.html
functions/rewrite.ts   הפונקציה הטהורה של ההחלפה (נבדקת ב־Node)
test/worker.test.mjs   בדיקות ל־rewrite ול־handler (מריצים אחרי build)
test/games.sample.json רישום לדוגמה לתצוגה מקדימה
```

## פקודות

```bash
npm install
npm run build          # ← ../dist (עם games.json האמיתי)
npm run build:sample   # עם שני משחקי דוגמה
npm run serve          # build + שרת מקומי על http://127.0.0.1:5180 (מדמה Pages: 404.html)
npm test               # בדיקות ה־worker (דורש build קודם)
npm run check          # typecheck
```

## מה האתר מצפה
- `../games.json`: `{ games: [...] }` עם `id, slug, title, tagline, audience, lang` חובה; `cover` יחסי לתיקיית
  המשחק (`/<slug>/<cover>`); `publishedAt` לסדר; `status: archived` לארכיון; `featured: true` לנעיצה.
- `../studio.json`: `apiBase` ריק = בלי ספירות ולידרבורד בעמוד הבית (הדף שלם גם בלי). `email` ריק =
  עמודי הקשר מציגים TODO. `cfWebAnalyticsToken` ריק = בלי beacon.
- עמודי המשחקים (`dist/<slug>/`) נבנים על ידי `common-game-code`, לא כאן.

## ידוע
- תמונת ה־OG של הפורטל היא `og.svg`. חלק מהפלטפורמות (ווצאפ) לא מציגות SVG בתצוגה מקדימה; כשיהיה
  כלי רינדור (sharp/resvg) נייצר `og.png` 1200x630 באותו build.
- אייקוני ה־manifest הם SVG. iOS מעדיף PNG ל־apple-touch-icon; אותו טיפול.
- דגלי המדינות הם אימוג'י; במערכות בלי פונט אימוג'י יוצגו כאותיות (US/IL), וזה קריא.
