# אירועים ונתוני משתמש

**סטטוס: החלטה** (אושר 2026-11-14). רשימה סגורה: אירוע חדש מתווסף כאן קודם.

## עקרונות
- מודדים את המשפך: הגיע → התחיל → סיים → שיתף → הביא חבר. כל אירוע עונה על שאלה שנפעל לפיה.
- לא מודדים כל לחיצה. 16 אירועים, לא יותר.
- כל אירוע נושא אוטומטית: `game`, `version`, `userId`, `sessionId`, `ts`, ובשרת: `country`, `city`,
  `device` (phone/tablet/desktop), `os`. אין צורך לשלוח אותם ידנית.

## הרשימה

| אירוע | מתי | props | השאלה שהוא עונה עליה |
|---|---|---|---|
| `session_start` | טעינת הדף | `ref` (referrer host), `utm_source`, `utm_medium`, `lang`, `viewportW/H`, `dpr` | מאיפה מגיעים, על איזה מכשירים |
| `referral_start` | טעינה עם פרמטרי אתגר | `fromUser`, `theirScore` | כמה פתיחות הגיעו משיתוף, מי מביא חברים |
| `game_start` | הקשה בפתיחה | | כמה מהמגיעים משחקים (לא רק רואים) |
| `cutscene_skip` | דילוג על הסצנה | `atS` | הסצנה ארוכה מדי? |
| `stage_start` | תחילת שלב | `stage` | |
| `stage_complete` | סיום שלב | `stage`, `timeS`, `score` | איפה השלב הקשה |
| `game_over` | הפסד | `stage`, `timeS`, `score`, `reason` | איפה נופלים, כמה מהר |
| `retry` | "נסה שוב מהשלב" | `stage` | |
| `game_complete` | ניצחון / סיום | `timeS`, `score`, `rank` | כמה מסיימים |
| `nick_submit` / `nick_skip` | מסך התוצאה | | כמה רוצים להיות בלוח |
| `board_view` | לידרבורד נטען | `rank`, `total` | |
| `share_click` | לחיצה על כפתור שיתוף | `channel` (whatsapp/sms/system/copy) | איזה ערוץ עובד לקהל הזה |
| `share_complete` | שיתוף המערכת הסתיים בהצלחה / העתקה הצליחה | `channel` | כמה לחיצות הופכות לשיתוף (לא זהה ללחיצה!) |
| `follow_click` | כפתור רשת של הסטודיו | `network` | |
| `source_click` | קישור למקור ב־facts | | |
| `replay` | "שחק שוב" | `fromScreen` | כמה חוזרים |
| `error` | שגיאת JS לא תפוסה | `msg`, `where` (עד 200 תווים) | באגים בשטח |
| `session_end` | `visibilitychange` → hidden | `durationS`, `lastScreen` | כמה זמן נשארים, איפה עוזבים |

`share_complete` ל־WhatsApp/SMS לא ניתן לדעת (הדפדפן עוזב). שם מודדים רק `share_click`,
ואת ההשפעה דרך `referral_start`.

## משפך בסיסי שנגזר מזה
`session_start` → `game_start` → `game_complete` → `share_click` → `referral_start`
ו: `retry`/`replay` לשימור. `game_over` לפי `stage` לאיזון קושי.

## מה נשמר על משתמש (D1 `users`)

| שדה | מקור | למה |
|---|---|---|
| `user_id` | UUID v4 שנוצר בלקוח בפעם הראשונה, נשמר ב־localStorage (ו־cookie גיבוי) | המפתח לכל דבר. בעתיד חשבון יוצמד אליו |
| `created_at`, `last_seen` | שרת | שחקנים חוזרים |
| `first_game` | המשחק הראשון שנראה בו | מאיפה הגיע לסטודיו |
| `lang` | `navigator.language` | |
| `country`, `city` | Cloudflare (`request.cf`), לא IP | פילוח גיאוגרפי |
| `device` | phone/tablet/desktop מ־UA | |
| `nick` | השחקן, עד 16 תווים | מוצג בלוח, ממולא בפעם הבאה |
| `games_played` | ספירה | |

לא נשמר: IP, אימייל, טלפון, שם, מיקום מדויק. אין קוקיות של צד שלישי.

## מה נשמר על ניקוד (D1 `scores`)
`game_id, user_id, nick, score, duration_s, stage, version, country, created_at`.
שורה אחת לשחקן למשחק (הטוב ביותר). `version` מאפשר לאפס/לסנן לוח אחרי שינוי איזון.

## עתיד: חשבונות
טבלת `accounts(user_id, provider, provider_id, created_at)` תצמיד התחברות (Google/Apple) ל־`user_id`
קיים. כל ההיסטוריה נשארת. התחברות על מכשיר שני: ממזגים את `user_id` החדש אל הישן (טבלת `merges`).

## קיבולת: כמה אירועים נשלחים, ומתי השירות נעצר (נוסף 2026-11-14)

אירועים לביקור טיפוסי (משחק של 5 שלבים, כולל ניסיונות חוזרים):

| אירוע | לביקור | הערה |
|---|---|---|
| session_start, session_end | 2 | תמיד |
| game_start | 1.3 | כולל "שחק שוב" |
| stage_start + stage_complete | 6 | 5 שלבים, חלק חוזרים |
| game_over, retry | 1.5 | |
| game_complete | 0.4 | 40% מסיימים |
| nick_submit/skip, board_view | 0.8 | |
| share_click, share_complete, follow_click, source_click | 0.3 | |
| replay, cutscene_skip, error | 0.4 | |
| **סה"כ** | **~13** | משחק של שלב אחד (FallingCEO): ~8 |

נשלחים באצווה: כל 5 שניות או 10 אירועים, ועם `sendBeacon` ביציאה. כ־4 בקשות שרת לביקור לאירועים,
ועוד 3 (count, board, score). בסך הכל ~7 בקשות Worker לביקור.

| מגבלה | חינמי | ביקורים ביום עד הגבול | מה קורה כשחורגים |
|---|---|---|---|
| Analytics Engine, 100K נקודות ביום | **~7,500** (5 שלבים) / ~12,000 (שלב אחד) | אירועים נוספים באותו יום (UTC) נזרקים בשקט. המשחק, הלוח והניקודים ממשיכים לעבוד |
| Workers, 100K בקשות ביום | ~14,000 | בקשות נוספות מקבלות שגיאה: הלוח לא נטען, ניקוד לא נשמר. המשחק עצמו (סטטי) ממשיך |
| D1, 100K כתיבות ביום | ~30,000 | כמו Workers, רק לכתיבות |
| Workers Paid, 5$ | ~1,400,000 בחודש כלולים | מעבר לזה 0.30$ למיליון בקשות, 0.25$ למיליון אירועים |

**המסקנה:** הצוואר הוא האנליטיקה, בסביבות 7,500 ביקורים ביום. זה יום טוב מאוד למשחק ישראלי ויום
חלש למשחק אמריקאי ויראלי. **לפני** הפצה רחבה של משחק אמריקאי עוברים ל־Paid לאותו חודש (5$ ועוד
כמה דולרים בודדים ביום ויראלי). דגימה היא רק רשת ביטחון למקרה ששכחנו, ולכן נשארת ב־BACKLOG.
