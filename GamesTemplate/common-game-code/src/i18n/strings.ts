// Template UI strings (buttons, labels). Game content lives in the game's content.ts.
import type { Lang } from '../config';

export interface Strings {
  tapToStart: string; continue: string; playAgain: string; retryStage: string; restart: string; skip: string;
  scoreSoFar: string; yourBest: string; newBest: string; score: string; time: string; rank: string;
  nickPlaceholder: string; saveToBoard: string; anonymous: string; you: string; boardTitle: string; boardUnavailable: string;
  boardTotal: (n: string) => string; yourRank: (r: string) => string;
  playersPlayed: (n: string) => string;
  challenge: (name: string, result: string) => string; aFriend: string;
  whatHappened: string; source: string; parodyNote: string; reportLink: string;
  followTitle: string; followBody: string; shareTitle: string; shareBody: string;
  shareCentral: string; shareSystem: string; copy: string; copied: string; notCopied: string; moreGames: string;
  tapToContinue: string; tapToSkip: string; loading: string; muted: string; unmuted: string;
}

const he: Strings = {
  tapToStart: 'הקש כדי להתחיל', continue: 'המשך', playAgain: 'שחק שוב', retryStage: 'נסה שוב מהשלב הזה', restart: 'מההתחלה', skip: 'דלג',
  scoreSoFar: 'ניקוד עד כאן', yourBest: 'השיא שלך', newBest: 'שיא חדש!', score: 'ניקוד', time: 'זמן', rank: 'דרגה',
  nickPlaceholder: 'הכינוי שלך ללוח', saveToBoard: 'שמור ללוח', anonymous: 'אנונימי', you: 'אתה', boardTitle: 'לוח השיאים', boardUnavailable: 'הלוח לא זמין כרגע',
  boardTotal: (n) => `${n} שחקנים בלוח`, yourRank: (r) => `המקום שלך: #${r}`,
  playersPlayed: (n) => `${n} שחקנים כבר שיחקו`,
  challenge: (name, result) => `${name} עשה ${result}. תנצח אותו?`, aFriend: 'חבר שלך',
  whatHappened: 'מה קרה באמת', source: 'למקור', parodyNote: 'פרודיה. לא קשור לאנשים ולגופים האמיתיים.', reportLink: 'בקשה להסרת תוכן',
  followTitle: 'רוצים להיות הראשונים לשחק במשחק הבא?', followBody: 'המשחק הבא תלוי בחדשות. עקבו אחרינו.',
  shareTitle: 'מי מהחברים שלך ינצח אותך?', shareBody: 'שתף את התוצאה ואתגר חבר',
  shareCentral: 'שיתוף בווצאפ', shareSystem: 'שתף…', copy: 'העתק קישור', copied: 'הועתק ✓', notCopied: 'לא הועתק', moreGames: 'עוד משחקים שלנו',
  tapToContinue: 'הקש להמשך', tapToSkip: 'לחיצה ארוכה לדילוג', loading: 'טוען…', muted: 'מוזיקה כבויה', unmuted: 'מוזיקה פועלת',
};

const en: Strings = {
  tapToStart: 'Tap to start', continue: 'Continue', playAgain: 'Play again', retryStage: 'Retry this stage', restart: 'From the start', skip: 'Skip',
  scoreSoFar: 'Score so far', yourBest: 'Your best', newBest: 'New best!', score: 'Score', time: 'Time', rank: 'Rank',
  nickPlaceholder: 'Your name for the board', saveToBoard: 'Save to board', anonymous: 'Anonymous', you: 'You', boardTitle: 'Leaderboard', boardUnavailable: 'Leaderboard unavailable right now',
  boardTotal: (n) => `${n} players on the board`, yourRank: (r) => `Your rank: #${r}`,
  playersPlayed: (n) => `${n} players already played`,
  challenge: (name, result) => `${name} did ${result}. Beat them?`, aFriend: 'A friend',
  whatHappened: 'What actually happened', source: 'Source', parodyNote: 'Parody. Not affiliated with the real people or companies.', reportLink: 'Report content',
  followTitle: 'Want to be first to play the next one?', followBody: 'The next game depends on the news. Follow us.',
  shareTitle: 'Which of your friends can beat you?', shareBody: 'Share your result and challenge a friend',
  shareCentral: 'Text a friend', shareSystem: 'Share…', copy: 'Copy link', copied: 'Copied ✓', notCopied: 'Not copied', moreGames: 'More games',
  tapToContinue: 'Tap to continue', tapToSkip: 'Hold to skip', loading: 'Loading…', muted: 'Music off', unmuted: 'Music on',
};

export function strings(lang: Lang): Strings { return lang === 'he' ? he : en; }
