# אתר הסטודיו (`frontend/`)

**סטטוס: החלטה** (2026-11-14), למעט שפת העיצוב שמסומנת "הצעה".

## מה זה
האתר של Too Soon Games: עמוד הבית עם המשחק הנבחר במרכז, רשת כל המשחקים, עמודי החובה, ו־Pages
Functions (תצוגה מקדימה אישית). **כולו באנגלית.** המשחקים עצמם בשפתם. סטטי, נוצר ב־build מ־`games.json`,
מוגש מאותו פרויקט Pages שמגיש את המשחקים.

```
frontend/
  src/
    pages/        index (home), about, privacy, terms, contact, accessibility, 404
    components/   header, game-card, featured-game, leaderboard, follow-block, footer
    styles/       tokens.css (צבעים, פונטים, מרווחים), base.css, components.css
    assets/       logo (PNG שקיבלנו + SVG שנגזור ממנו), favicon, אייקוני manifest, og.png
  functions/
    [game]/index.ts   תצוגה מקדימה אישית לקישור אתגר (ראה SHARE.md)
  build.ts        games.json + תבניות → dist/ (יחד עם המשחקים)
```
בלי framework. HTML מתבניות קטנות (TypeScript template strings), CSS אחד, JavaScript מינימלי
(מספר שחקנים ולידרבורד מה־API). האתר כולו מתחת ל־100KB בלי תמונות.

## עמוד הבית (`/`)

סדר מלמעלה למטה, מובייל קודם:

1. **Header:** לוגו (קישור ל־`/`), ובצד ימין קישור "About". דק, לא דביק.
2. **המשחק הנבחר (hero):** תמונת הכיסוי של המשחק בגדול, שם המשחק, שורת התיאור, תאריך האירוע,
   "12,999 played", וכפתור **Play** גדול בצבע ההדגשה. בדסקטופ: תמונה משמאל, טקסט וכפתור מימין.
   **הבחירה:** המשחק החדש ביותר בשפת הדפדפן (`navigator.language` → `he` → משחקי `il`, אחרת `us`);
   אם אין משחק בשפה הזו, החדש ביותר בכלל. `games.json` מאפשר דריסה ידנית בשדה `featured: true`.
3. **הלידרבורד של המשחק הנבחר:** 10 הראשונים, כינוי וניקוד, מה־API, "See all" פותח 20.
   נטען אחרי העמוד, לא חוסם. אם ה־API לא זמין, הבלוק לא מוצג.
4. **שורת הסטודיו:** משפט אחד. הצעה: *"Short web games about whatever everyone is talking about
   right now. Built in a day, gone too soon."*
5. **All games:** רשת כרטיסים (2 בעמודה במובייל, 3-4 בדסקטופ), חדש למעלה. כרטיס: כיסוי, שם, שפה
   (דגל קטן 🇮🇱/🇺🇸), תאריך האירוע, מספר שחקנים. משחקים `archived` באותה רשת, עם תווית "Archive".
6. **Follow + next game:** "The next game depends on the news. Follow us and be first to play."
   + ארבעת אייקוני הרשתות (עיצוב מ־SHARE.md; חצי־שקופים עד שיהיו קישורים).
7. **Footer:** About · Privacy · Terms · Contact · Accessibility · © Too Soon Games.

## עמוד משחק (`/<slug>/`)
**מסך מלא נקי.** במובייל המשחק תופס את כל המסך. בדסקטופ: הקנבס ממורכז על רקע הסטודיו
(צבע הרקע מ־tokens), ומתחתיו שורה אחת: לוגו קטן · "More games" → `/`. אין header. העמוד הוא
`index.html` של המשחק עצמו; השורה התחתונה מוזרקת ב־build מחוץ לקנבס, ומוסתרת מתחת לרוחב 700px.

## עמודי החובה
לפי הטבלה ב־ARCHITECTURE.md ("חובה לכל אתר"). תבנית עמוד טקסט אחת (header, כותרת, תוכן, footer).
הטקסטים נכתבים כשבונים את ה־frontend; `/contact` מצריך כתובת מייל של הסטודיו (**ממתין ממך**).

## שפת עיצוב (הצעה, נגזרת מהלוגו)

הלוגו: אותיות לבנות מעוגלות עם קו מתאר כהה, שתי ה־O בגרדיאנט מג'נטה→סגול עם כפתורי שלט, פסי
הדגשה צהובים, רקע שקוף. ממנו:

| טוקן | ערך | שימוש |
|---|---|---|
| `--bg` | `#140b24` (סגול-שחור) | רקע האתר ורקע הדסקטופ של המשחקים |
| `--surface` | `#221440` | כרטיסים, בלוקים |
| `--ink` | `#ffffff` | טקסט ראשי |
| `--muted` | `#b9a9d9` | טקסט משני, תאריכים |
| `--magenta` | `#ff4fd8` | תחילת גרדיאנט, קישורים |
| `--violet` | `#8a3cff` | סוף גרדיאנט |
| `--accent` | `#ffc400` (צהוב הלוגו) | כפתור Play, תוויות "New", הדגשות |
| `--grad` | `linear-gradient(135deg, var(--magenta), var(--violet))` | כותרת ה־hero, מסגרת הכרטיס הנבחר |
| פונט כותרות | **Fredoka** (Google Fonts, 700) | מעוגל ושמנמן כמו הלוגו |
| פונט טקסט | **Rubik** (400/700) | כבר בשימוש במשחקים, תומך עברית |
| רדיוס | 20px כרטיסים, 999px כפתורים | כמו עיגולי הלוגו |
| מצב בהיר | אין. האתר כהה תמיד (`color-scheme: dark`) | הלוגו נבנה לרקע כהה |

הלוגו נשמר ב־`frontend/src/assets/logo.png` (המקור) ונגזר ממנו `logo-mark.svg` (רק שתי ה־O עם
השלט) ל־favicon ולאייקוני ה־manifest. **ממתין:** אישור הפלטה והפונט, ומקור וקטורי של הלוגו אם יש.

## נגישות וביצועים
- כל התמונות עם `alt`, ניגודיות AA על `--bg`, ניווט מקלדת, `prefers-reduced-motion` מכבה אנימציות.
- תמונות כיסוי: `webp` 800px + `loading="lazy"` מהכרטיס השני והלאה. ה־hero נטען מיד.
- Lighthouse במובייל: ביצועים ונגישות מעל 90 הם תנאי לפרסום האתר (כלי הבאגים מריץ).

## מה האתר מצפה מכל משחק (ב־`games.json`)
`slug, title, tagline, cover (1200x900), ogImage (1200x630), audience, lang, eventDate, publishedAt,
status (live|archived), featured?`. ה־build נכשל אם חסר שדה.

## מצב מימוש (2026-11-14)
נבנה ב־`frontend/` (README שם): build ל־`dist/` עם עמוד הבית, שישה עמודי החובה, `_headers`, `robots.txt`,
`sitemap.xml`, `manifest.webmanifest`, `security.txt`, אייקונים ו־`og.svg`, ו־`_worker.js` לקישורי אתגר (עם
בדיקות). נבדק בדפדפן במובייל (375px, בלי גלילה אופקית) ובדסקטופ, כולל 404 ועמוד הפרטיות. פתוח: `og.png`
ואייקוני PNG (אין כלי רינדור ב־Node טהור), מייל הסטודיו, קישורי הרשתות, `apiBase`.
