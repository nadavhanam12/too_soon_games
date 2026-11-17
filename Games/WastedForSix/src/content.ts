// Every player-facing text of "TSG: Nice City" (rule 10). Humor is edited here.
// Writer's checklist (research.md 7): the real game / publisher names appear ONLY in `facts` below. In-game it is
// "the game", "VI", "launch day". WASTED is a plain word in our own pixel font, never the real game's typography.
import { type Content, type RunResult, fmtInt } from '@tsg/index';
import { comicPanel, phoneMessage } from './opening';

/** The boss's text, typed onto the phone screen in the second cutscene panel (pixel font, max 10 characters a line, 10 lines). */
const PHONE_MSG = ['NEW MSG', 'FROM: BOSS', '', 'I NEED YOU', 'TODAY.', '9:00 SHARP', 'NO WASTING', 'TIME.'];

// ---------- ranks (score ≈ 0..6000) ----------
const RANKS: Array<[number, string]> = [
  [5600, '100% Completion'], [4900, 'Day-One Legend'], [4300, "Loan Shark's Favorite"], [3700, 'Ring Pawner'], [3100, "HR's Most Wanted"],
  [2500, 'Professional Cougher'], [1900, 'PTO Hoarder'], [1300, 'Side Quest Enjoyer'], [700, 'Still Downloading'], [-1, 'Tutorial NPC'],
];
export const rankFor = (sc: number): string => RANKS.find((r) => sc > r[0])![1];

export type Branch = 'sick' | 'quit';
export type StoreChoice = 'loan' | 'steal' | 'tradein';
export type TradeItem = 'console' | 'couch' | 'ring';

// ---------- driving legs ----------
// In every banner the FIRST line is the mission (the main thing to do): missionCard draws it big and yellow, alone
// above a divider. The lines after it are the how-to. Keep that order when adding a banner.
export const BANNERS = {
  commute: ['1 · THE COMMUTE', ['Mission: show up to work. Yes, this is the tutorial.', 'Drag the stick (bottom left) to steer.', 'Grab cash. Collect the graffiti letters.']],
  launchSick: ['2 · LAUNCH LINE', ['Mission: the line is 400 people long. You are not in it.', 'First: a doctor\'s note. HR is out looking for you.', 'Don\'t let the HR minivan see you before you have it.']],
  launchQuit: ['2 · LAUNCH LINE', ['Mission: the line is 400 people long. You are not in it.', 'No job, no money, and the tank is draining.', 'Stop at the gas station first.']],
  home: ['3 · THE WAY HOME', ['Final mission: lose the tail. Protect the disc.', 'Remember the letters.']],
} as const satisfies Record<string, readonly [string, readonly string[]]>;

/** The story timeline along the top: one milestone per dot, from waking up to playing. Index 0 is the start; index
 *  n is reached when stage n of play.ts ORDER is done. Shown above the dot for a moment when you reach it. */
export const TIMELINE = ['WOKE UP', 'GOT TO WORK', 'GOT THE DAY OFF', 'REACHED THE STORE', 'GOT THE GAME', 'MADE IT HOME', 'GOT ONE HOUR', 'PLAYING VI'];

/** Short names (max 8 letters) that stay under each reached dot, so the row reads as the story of your day. */
export const TIMELINE_SHORT = ['WOKE', 'WORK', 'DAY OFF', 'STORE', 'GAME', 'HOME', 'FIANCEE', 'PLAY'];

/** Replaces the commute banner's stick line when the player has a mouse and keys (no stick on screen). */
export const HOW_KEYS = 'Arrows / WASD to drive. Space to drift.';

export const HINT = { touch: 'Drag the stick to steer · sharp turn = drift', keys: 'Arrows / WASD drive · Space drift · R radio' };

/** The car radio's stations, in the order the button steps through them; `track` is a name in sfx.ts MUSIC.files. */
export const RADIO = [
  { track: 'drive', name: 'SUN CITY FM' },
  { track: 'chase', name: 'HEAT 101' },
  { track: 'theme', name: 'LOWRIDER AM' },
  { track: 'scheme', name: 'DELAY FM' },
  { track: 'bounce', name: 'BOUNCE 100' },
  { track: 'midnight', name: 'NIGHT SHIFT FM' },
  { track: 'electro', name: 'NEON 108' },
  { track: 'jazzy', name: 'SMOOTH-ISH JAZZ' },
] as const;
export const BOOST_TEXT = 'DRIFT BOOST!';

/** Toast when a stage is done (play.ts stageDone); `boss` has its own. */
export const MISSION_PASSED = { boss: 'MISSION PASSED · EMPLOYMENT −' } as const;   // the other stages get no toast (Nadav, 2026-11-17)

/** Small labels drawn by the game's own screens: beats over the car, HUD gauges, loading card, TV, sticker, buttons. */
export const UI = {
  beat: { parking: 'PARKING', bribing: 'BRIBING', pumping: 'PUMPING', home: 'HOME!' },
  timeBonus: (n: number) => `+${n} time bonus`,
  yourDay: 'YOUR DAY',                                        // heading over the timeline in its big moments
  gotAsFar: (stop: string) => `YOU GOT AS FAR AS: ${stop}`,   // lose screen, over the timeline
  radio: 'RADIO',
  hrTag: 'HR',
  noSignal: 'NO SIGNAL',
  loading: 'LOADING CITY',
  fuel: 'FUEL',
  heat: 'HEAT',
  chasedBy: { cop: 'POLICE', shark: 'LOAN SHARKS', spouse: 'YOUR FIANCEE' } as Record<string, string>,   // the gauge's label: who is after you (nearest chaser)
  // the big announcement in the middle of the screen when a chase starts: who it is, then what to do
  chaseCall: { cop: 'THE POLICE', shark: 'LOAN SHARKS', spouse: 'YOUR FIANCEE' } as Record<string, string>,
  chaseSub: { cop: 'ARE AFTER YOU! DRIVE!', shark: 'WANT THEIR MONEY! DRIVE!', spouse: 'WANTS THE RING BACK! DRIVE!' } as Record<string, string>,
  you: 'YOU',                                                 // your panel in the montage
  sticker: 'LAUNCH DAY',
  continue: 'Continue ›',
};

/** What a chaser shouts above its car in the home leg. */
export const TAUNTS = { spouse: ['TOUCH GRASS!', 'THE RING?!', 'COME BACK!'], shark: ['PAY UP!', 'KNEECAPS!'] };

/** The signs on the three story buildings in the 3D city. */
export const SIGNS = { home: 'HOME', office: 'MEGACORP', store: 'GAMES' };

export const PLACE_NAME ={ home: 'HOME', office: 'OFFICE', clinic: 'DOCTOR', gas: 'GAS', store: 'GAME STORE' } as const;

export const LINES = {
  commute: ['Per my last email, it\'s 8:59.', 'Traffic. On launch week. Of course.', 'Everyone on this road called in sick. Except you.', 'Your boss\'s parking spot is empty. Suspicious.', 'Side quest available: actually working. Declined.', 'This is the unskippable part.', 'No fast travel. Checked twice.'],
  cash: ['+$20. Found it in the cup holder.', '+$20. Birthday money from 2013.', '+$20. Launch fund.', '+$20. No microtransaction required.', '+$20. That\'s 0.3 of a deluxe edition.'],
  can: ['Energy drink. Hands: shaking.', 'Energy drink #4 today.', 'Caffeine: yes.', 'Health restored. Sleep: still 0.'],
  crash: ['That was a mailbox. Probably.', 'Insurance is going to love this.', 'Small dent. Big feelings.', 'You hit that like a launch-day server.', 'No respawn at the hospital. Drive better.', 'That NPC had a family. Allegedly.', 'Physics engine: working as intended.'],
  ped: ['SORRY!', 'MY BAD!', 'HE’S FINE', 'LAUNCH DAY!', 'WALK IT OFF', 'OOPS', 'NPC DOWN', 'NOT A CROSSWALK'],
  nearMiss: ['CLOSE!', 'NEAR MISS', 'WHOOSH', 'STUNT BONUS', 'NPC DODGED'],
  letter: ['Graffiti: "{L}". Someone is spelling something.', 'Another one: "{L}". Fresh paint.', 'A big "{L}" on the road. Weird.'],
  arriveOffice: ['Made it. 8:59 and 59 seconds.'],
  // leg 2, sick
  hr: ['HR is circling the block.', 'That minivan has a lanyard on the mirror.', 'Text from Boss: "feel better ;)"', 'HR does not sleep. HR does not blink.', 'HR has entered the chat.', 'That minivan has aimbot.'],
  hrClose: ['HR minivan nearby! Stay out of the circle.', 'Careful. HR can smell a fake cough.'],
  noteFirst: 'No note, no game. Doctor first.',
  doctor: ['Doctor: "How much do you have?"', '"…What a coincidence. That\'s my price."'],
  noteOk: 'Got the sick note. Money: $0. Health: suspiciously great.',
  noteFlash: ['You flash the sick note. HR backs off. Slowly.', 'Note shown. HR writes something down anyway.'],
  // leg 2, quit
  fuelLow: ['Fuel\'s low. You quit the job, not the car.', 'Tank says: please.', 'Running on fumes and spite.', 'Fuel is a survival mechanic now. Nobody asked for this.'],
  gasFirst: 'Running on fumes. Gas station first.',
  gas: ['No money. Full tank.', 'You "forgot" to pay. The clerk didn\'t forget your plate.'],
  sirens: 'One star. Where\'s a paint shop when you need one.',
  // leg 3
  chase: {
    shark: ['Loan sharks don\'t do grace periods.', '"Interest is due. So are you."', 'The sedan behind you has gold rims. Bad sign.'],
    cop: ['Wanted: one gamer. Armed with a game.', 'The cops want the game. Possibly to play it.', 'Wanted level: gamer.'],
    cop2: ['Two stars. The gas station called its friends.', 'Gas AND a game. The cops are impressed. And angry.'],
    spouse: ['Your fiancée found the ring receipt.', '"TOUCH GRASS!"', '"WE\'RE TALKING ABOUT THIS AT HOME!"', 'The minivan has a "World\'s Best Fiancée" sticker. Not tonight.'],
  },
  escape: 'Home. Doors locked. Curtains closed.',
};

// ---------- decision scenes (gray freeze-frame + full-color portrait) ----------
export const BOSS = {
  name: 'THE BOSS',
  open: ['A day off. For a VIDEO GAME?', 'We\'re a family here. Families don\'t take Thursdays off.', 'Unlimited PTO means unlimited. Not usable.', 'You\'re wasting company time. Standing there.', 'We have a game at home. It\'s called quarterly targets.', 'Launch day? We launch spreadsheets here.'],
  again: 'Let\'s try that again. Choose wisely.',
  options: { agree: '"Sure, boss. I\'ll stay late."', sick: '*cough* "I think it\'s the 24-hour flu."', quit: '"I quit."' },
  react: {
    agree: 'Great attitude! The quarterly report won\'t waste itself.',
    sick: 'The 24-hour flu. Funny, it\'s been announced since 2023. Bring a doctor\'s note. HR will be… checking in.',
    quit: 'You\'ll be back. They always delay it. Your last paycheck stays here. For the coffee.',
  },
  wasted: 'You agreed. 13 years, wasted.',
  wastedSub: 'Pick something else.',
};

/** The ITEM ACQUIRED moment after the store (item.ts). `cover` is painted on the case, `paid` depends on how you got it. */
export const ITEM = {
  head: 'ITEM ACQUIRED',
  cover: 'VI',
  name: 'VI · DAY-ONE COPY',
  patch: 'Day-one patch: 150 GB more. ETA: also 13 years.',   // one line at 11 px (item.ts)
  paid: {
    loan: 'Paid with: money you don\'t have.',
    steal: 'Paid with: nothing. Run.',
    tradein: 'Paid with: one engagement ring.',
  } as Record<StoreChoice, string>,
};

export const CLERK = {
  name: 'THE CLERK',
  open: ['Don\'t waste my time, there are 400 people behind you.', 'Cash, card, or kidney?', 'Sir, this is a game store. Not a support group.', 'Pre-order? In this economy?', 'It\'s 150 gigs. Hope you cleared your weekend. And your drive.'],
  broke: 'You have $0.',
  options: { loan: 'Borrow from the guys in the back', steal: 'Grab it and run', tradein: 'Trade something in' },
  react: {
    loan: 'Vinnie & Sons Financial. Buy now, pay with your kneecaps.',
    steal: 'Dude. There\'s a day-one patch. No rush. Tell that to the cops.',
    tradein: 'Sure. What\'ve you got?',
  },
  trade: { console: 'My old console', couch: 'My couch', ring: 'The engagement ring' } as Record<TradeItem, string>,
  tradeReact: {
    console: 'Last gen. Trade-in value: one sad look. Next.',
    couch: 'Trade-in value of a couch: $3. Do you even know how a store works?',
    ring: 'Sold. Hope your fiancée never checks the receipt…',
  } as Record<TradeItem, string>,
};

// The fiancée on the couch, between you and the PC. Scheming fails (the option is removed); the honest ask works.
export type FianceeQuiz = 'a' | 'b' | 'c';
export const FIANCEE = {
  name: 'YOUR FIANCEE',   // pixel font: no accents
  open: ['You\'re home! Sit. I haven\'t seen you all day.', 'There you are. Come here. Tell me about your day.'],
  openRing: 'You\'re home. Good. Where. Is. The ring.',
  options: { sneak: 'Tiptoe past the couch', fake: '"Mm-hm. Totally. Wow."', honest: '"13 years. One hour. Then I\'m all yours."' },
  react: {
    sneak: 'That floorboard has creaked since 2013. Sit.',
    fake: 'Mm-hm. So what did I just say?',
    honest: 'Fine. One hour. I\'m timing it. And I\'m player two.',
    honestRing: 'One hour. Then we buy it back. A bigger one. And I\'m player two.',
  },
  quiz: { a: 'Something about… frame rates?', b: 'Your mother is visiting?', c: 'That you love me?' } as Record<FianceeQuiz, string>,
  quizReact: {
    a: 'I said my day was hard. You heard "hardware".',
    b: 'She is now. Saturday. You\'re cooking.',
    c: 'Cute. Wrong. Sit down.',
  } as Record<FianceeQuiz, string>,
  bonus: (n: number) => `+${n} honesty bonus`,
};

export const PC = {
  title: 'ENTER PASSWORD',
  note1: "It's not a phase, mom.",
  note2: 'pw = how the last 13 years felt',
  // launcher hell: every wrong try gets a different excuse, the last one repeats (the real hint is caughtHint, always on screen)
  wrong: ['Wrong password.\nReset link sent to an email you made in 2013.', 'Launcher update required.\nUpdating the updater…', 'Please link your account to your other account.', 'Servers busy.\nPosition in queue: 4,000,001.'],
  // loading-screen tips along the bottom of the monitor, one every few seconds; half of them are real hints
  tips: ['TIP: The password is not "password".', 'TIP: It\'s how the last 13 years felt.', 'TIP: Pressing harder does not help.', 'TIP: You drove past the answer. Letter by letter.', 'TIP: Trailer 3 is not coming.', 'TIP: It was on every wall you drove past.'],
  hint0: '6 letters. You know it.',
  // stays along the bottom of the monitor from the first wrong try on, in place of the rotating tips (Nadav, 2026-11-17)
  caughtHint: 'pw = what the screen says when you get caught',
  close: (n: number) => `${n}/6 letters in the right spot.`,
  ok: 'ACCESS GRANTED',
  okSub: 'QUEUE SKIPPED',
  start: 'PRESS START',
  installing: 'INSTALLING 1%',
};

// ---------- lose screen (heading is always WASTED: a password hint) ----------
export const LOSE_LINES: Record<string, string> = {
  fired: 'HR spotted you looking healthy. Mission failed. You\'re fired.',
  fuel: 'Out of gas. This isn\'t a survival game. Apparently it is.',
  cop: 'Busted. The cops took the game. They\'re on mission 4 already.',
  shark: 'The loan sharks repossessed the game. And the car. And a kneecap.',
  spouse: 'Your fiancée caught you. The game goes back. The ring comes home.',
};
export const CONSOLATION = [
  '(In reality, some managers just said: Enjoy.)',
  '(In reality, a whole shop closed for the day. You\'ll get there.)',
  '(13 years. One more try won\'t hurt. Remember that word.)',
  '(Checkpoint reached. Sadly it\'s your office.)',
];

/** The rubber stamp on the lose screen's picture, by reason (endings.ts). */
export const LOSE_STAMP: Record<string, string> = { fired: 'FIRED', fuel: 'OUT OF GAS', cop: 'BUSTED', shark: 'REPOSSESSED', spouse: 'GROUNDED' };

/** The result screen (endings.ts): the kicker over the rank, and the receipt that sums up how your day went. */
export const RECEIPT = {
  kicker: 'MISSION PASSED',
  head: 'LAUNCH DAY RECEIPT',
  rows: { job: 'DAY OFF', game: 'THE GAME', letters: 'GRAFFITI', pw: 'PASSWORD' },
  job: { sick: 'Fake flu', quit: 'Quit the job' } as Record<Branch, string>,
  game: { loan: 'Vinnie\'s money', steal: 'Stolen', tradein: 'One ring' } as Record<StoreChoice, string>,
  letters: (n: number) => `${n} of 6 letters`,
  pw: (wrong: number) => (wrong === 0 ? 'First try' : `Try ${wrong + 1}`),
  foot: 'NO REFUNDS',
};

export const content: Content = {
  title: {
    heading: ' ', // the logo is drawn in the pixel font by opening.ts (titleScene)
    // the title draws the numbers of the first line big and yellow (opening.ts); '\n' = a line break
    lines: ['13 years. 2 delays. 0 sick days used. Until today.', 'Get the game and play it!\nAs fast as you can.'],
    credit: 'Parody by Too Soon Games',   // the studio logo is drawn after it (opening.ts)
  },
  cutscene: {
    button: 'Get in the car',
    steps: [
      // the captions are drawn by comicPanel as comic boxes (not the template's caption panel), so no `text` here
      { dur: 0, draw: (st) => comicPanel(0, st, 'Thursday morning', '13 years. It\'s finally launch day.'), sfx: 'bad' },
      { dur: 0, draw: (st) => comicPanel(1, st, 'One problem', 'I have a job. And a boss who "needs me today."', phoneMessage(PHONE_MSG)) },
      { dur: 0, draw: (st) => comicPanel(2, st, 'The plan', 'Get out of work, get the game and play it!\nAs fast as I can.'), sfx: 'ok' },
    ],
  },
  lose: { heading: 'WASTED', line: '', consolation: CONSOLATION[0] },
  result: {
    heading: (r) => rankFor(r.score),
    // a nod to the real game's first trailer (Nadav, 2026-11-17); the score itself is in the panel below
    sentence: () => 'Happy Release Day Everyone! :)',
    rankFor,
    resultWords: (r: RunResult) => fmtInt(r.score),
  },
  board: { heading: 'Day-One Legends', sub: 'Most points on launch day' },
  facts: {
    heading: 'What really happened',
    sub: 'The longest wait in gaming',
    lines: [
      { date: '2013-09', text: 'GTA V comes out. The wait for the next one begins.' },
      { date: '2023-12', text: 'The first GTA 6 trailer. Release: "2025."' },
      { date: '2025', text: 'Delayed twice: first to May 2026, then to November 19, 2026.' },
      { date: '2026-08', text: 'The US Army reportedly offered a four-day "GTA pass" for re-enlisting. 20 soldiers reportedly took it.' },
      { date: '2026-09', text: 'HR firm BambooHR says time-off requests for November 19 run up to 17% above normal. One shop just closed for the day.', bold: true },
      { date: 'Nov 19', text: 'Launch day. Rockstar Games / Take-Two.' },
      { text: 'This game is a parody. It is not affiliated with or endorsed by Rockstar Games or Take-Two.' },
    ],
    disclaimer: 'Every character in the game is made up. Especially the boss.', // the template adds the parody line (4ד)
  },
  community: { heading: 'Made it home!', sub: 'Challenge a friend to beat your score, and be the first to play our next game.' },
};
