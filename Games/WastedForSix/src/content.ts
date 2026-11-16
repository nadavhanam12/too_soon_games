// Every player-facing text of "Wasted for Six" (rule 10). Humor is edited here.
// Writer's checklist (research.md 7): the real game / publisher names appear ONLY in `facts` below. In-game it is
// "the game", "Six", "launch day". WASTED is a plain word in our own pixel font, never the real game's typography.
import { type Content, type RunResult, fmtInt } from '@tsg/index';
import { cutBedroom, cutPhone, cutDriveway } from './art';

// ---------- ranks (score ≈ 0..6000) ----------
const RANKS: Array<[number, string]> = [
  [5600, 'Wasted for Six'], [4900, 'Day-One Legend'], [4300, "Loan Shark's Favorite"], [3700, 'Ring Pawner'], [3100, "HR's Most Wanted"],
  [2500, 'Professional Cougher'], [1900, 'PTO Hoarder'], [1300, 'Middle Manager'], [700, 'Reply-All Guy'], [-1, 'Unpaid Intern'],
];
export const rankFor = (sc: number): string => RANKS.find((r) => sc > r[0])![1];

export type Branch = 'sick' | 'quit';
export type StoreChoice = 'loan' | 'steal' | 'tradein';
export type TradeItem = 'console' | 'couch' | 'ring';

// ---------- driving legs ----------
export const BANNERS = {
  commute: ['1 · THE COMMUTE', ['Get to the office. Don\'t be late.', 'Drag the stick (bottom left) to steer.', 'Grab cash. Look out for graffiti.']],
  launchSick: ['2 · LAUNCH LINE', ['Get to the game store.', 'First: a doctor\'s note. HR is out looking for you.', 'Don\'t let the HR minivan see you before you have it.']],
  launchQuit: ['2 · LAUNCH LINE', ['Get to the game store.', 'No job, no money, and the tank is draining.', 'Stop at the gas station first.']],
  home: ['3 · THE WAY HOME', ['Get home. Don\'t get caught.', 'Remember the letters.']],
} as const satisfies Record<string, readonly [string, readonly string[]]>;

export const HINT = { touch: 'Drag the stick to steer · let go to coast', keys: 'Arrows / WASD drive · Space drift' };

export const PLACE_NAME = { home: 'HOME', office: 'OFFICE', clinic: 'DOCTOR', gas: 'GAS', store: 'GAME STORE' } as const;

export const LINES = {
  commute: ['Per my last email, it\'s 8:59.', 'Traffic. On launch week. Of course.', 'Everyone on this road called in sick. Except you.', 'Your boss\'s parking spot is empty. Suspicious.'],
  cash: ['+$20. Found it in the cup holder.', '+$20. Birthday money from 2013.', '+$20. Launch fund.'],
  can: ['Energy drink. Hands: shaking.', 'Energy drink #4 today.', 'Caffeine: yes.'],
  crash: ['That was a mailbox. Probably.', 'Insurance is going to love this.', 'Small dent. Big feelings.', 'You hit that like a launch-day server.'],
  nearMiss: ['CLOSE!', 'NEAR MISS', 'WHOOSH'],
  letter: ['Graffiti: "{L}". Someone is spelling something.', 'Another one: "{L}". Fresh paint.', 'A big "{L}" on the road. Weird.'],
  arriveOffice: ['Made it. 8:59 and 59 seconds.'],
  // leg 2, sick
  hr: ['HR is circling the block.', 'That minivan has a lanyard on the mirror.', 'Pager: Boss: "feel better ;)"', 'HR does not sleep. HR does not blink.'],
  hrClose: ['HR minivan nearby! Stay out of the circle.', 'Careful. HR can smell a fake cough.'],
  noteFirst: 'No note, no game. Doctor first.',
  doctor: ['Doctor: "How much do you have?"', '"…What a coincidence. That\'s my price."'],
  noteOk: 'Got the sick note. Money: $0. Health: suspiciously great.',
  noteFlash: ['You flash the sick note. HR backs off. Slowly.', 'Note shown. HR writes something down anyway.'],
  // leg 2, quit
  fuelLow: ['Fuel\'s low. You quit the job, not the car.', 'Tank says: please.', 'Running on fumes and spite.'],
  gasFirst: 'Running on fumes. Gas station first.',
  gas: ['No money. Full tank.', 'You "forgot" to pay. The clerk didn\'t forget your plate.'],
  sirens: 'Sirens. Of course.',
  // leg 3
  chase: {
    shark: ['Loan sharks don\'t do grace periods.', '"Buy now, pay with your kneecaps!"', 'The sedan behind you has gold rims. Bad sign.'],
    cop: ['Wanted: one gamer. Armed with a game.', 'The cops want the game. Possibly to play it.'],
    cop2: ['Two stars. The gas station called its friends.', 'Gas AND a game. The cops are impressed. And angry.'],
    spouse: ['Your spouse found the ring receipt.', '"TOUCH GRASS!"', '"WE\'RE TALKING ABOUT THIS AT HOME!"', 'The minivan has a "World\'s Best Spouse" sticker. Not tonight.'],
  },
  escape: 'Home. Doors locked. Curtains closed.',
};

// ---------- decision scenes (gray freeze-frame + full-color portrait) ----------
export const BOSS = {
  name: 'THE BOSS',
  open: ['A day off. For a VIDEO GAME?', 'We\'re a family here. Families don\'t take Thursdays off.', 'Unlimited PTO means unlimited. Not usable.', 'You\'re wasting company time. Standing there.'],
  again: 'Let\'s try that again. Choose wisely.',
  options: { agree: '"Sure, boss. I\'ll stay late."', sick: '*cough* "I think it\'s the 24-hour flu."', quit: '"I quit."' },
  react: {
    agree: 'Great attitude! The quarterly report won\'t waste itself.',
    sick: 'Mm-hm. Bring a doctor\'s note. HR will be… checking in.',
    quit: 'You WHAT?! Fine. Your last paycheck stays here. For the coffee.',
  },
  wasted: 'You agreed. 13 years, wasted.',
  wastedSub: 'Pick something else.',
};

export const CLERK = {
  name: 'THE CLERK',
  open: ['Don\'t waste my time, there are 400 people behind you.', 'Cash, card, or kidney?', 'Ma\'am, this is a game store. Oh, you\'re not a ma\'am. Still.'],
  broke: 'You have $0.',
  options: { loan: 'Borrow from the guys in the back', steal: 'Grab it and run', tradein: 'Trade something in' },
  react: {
    loan: 'Vinnie & Sons Financial. Buy now, pay with your kneecaps.',
    steal: 'Dude. I\'d stop you, but I\'m on break. The cops aren\'t.',
    tradein: 'Sure. What\'ve you got?',
  },
  trade: { console: 'My old console', couch: 'My couch', ring: 'My wedding ring' } as Record<TradeItem, string>,
  tradeReact: {
    console: 'Trade-in value: $4. It\'s basically a brick. Next.',
    couch: 'Trade-in value of a couch: $3. Do you even know how a store works?',
    ring: 'Sold. Hope your spouse never checks the receipt…',
  } as Record<TradeItem, string>,
};

export const PC = {
  title: 'ENTER PASSWORD',
  note1: "It's not a phase, mom.",
  note2: 'pw = how the last 13 years felt',
  wrong: ['Nope. Not "password123".', 'Nope. Not your boss\'s name either.', 'Hint: how you\'d describe the last 13 years.', 'Hint: it was on every wall you drove past.', 'Hint: it\'s on the screen every time you get caught.'],
  close: (n: number) => `${n}/6 letters in the right spot.`,
  ok: 'ACCESS GRANTED',
  start: 'PRESS START',
};

// ---------- lose screen (heading is always WASTED: a password hint) ----------
export const LOSE_LINES: Record<string, string> = {
  fired: 'HR spotted you looking healthy. You\'re fired. Effective yesterday.',
  fuel: 'You quit your job AND your gas tank.',
  cop: 'Busted. The cops took the game. They\'re playing it tonight.',
  shark: 'The loan sharks repossessed the game. And the car. And a kneecap.',
  spouse: 'Your spouse caught you. The ring goes back. So does the game.',
};
export const CONSOLATION = [
  '(In reality, some managers just said: Enjoy.)',
  '(In reality, a whole shop closed for the day. You\'ll get there.)',
  '(13 years. One more try won\'t hurt. Remember that word.)',
];

export const content: Content = {
  title: {
    heading: ' ', // drawn in the pixel font by main.ts (drawTitleArt)
    lines: ['13 years of waiting. It\'s finally launch day.', 'One boss, one store, one chase home.'],
    credit: 'Parody · Too Soon Games',
  },
  cutscene: {
    button: 'Get in the car',
    steps: [
      { dur: 0, speaker: 'Thursday. 8:30 a.m.', text: '13 years. It\'s finally launch day.', draw: (st) => cutBedroom(st), sfx: 'bad' },
      { dur: 0, speaker: 'One problem', text: 'I have a job. And a boss who "needs me in today".', draw: (st) => cutPhone(st) },
      { dur: 0, speaker: 'The plan', text: 'Today I get free. Whatever it takes.', draw: (st) => cutDriveway(st), sfx: 'ok' },
    ],
  },
  lose: { heading: 'WASTED', line: '', consolation: CONSOLATION[0] },
  result: {
    heading: (r) => rankFor(r.score),
    sentence: (r: RunResult) => `${fmtInt(r.score)} points you scored on the way to launch day.`,
    rankFor,
    resultWords: (r: RunResult) => fmtInt(r.score),
  },
  board: { heading: 'Day-One Legends', sub: 'Most points on the way to launch day' },
  facts: {
    heading: 'What really happened',
    sub: 'The longest wait in gaming',
    lines: [
      { date: '2013-09', text: 'GTA V comes out. The wait for the next one begins.' },
      { date: '2023-12', text: 'The first GTA 6 trailer. Release: "2025."' },
      { date: '2025', text: 'Two delays (May and November). New date: November 19, 2026.' },
      { date: '2026-09', text: 'HR firm BambooHR says time-off requests for November 19 run up to 17% above normal. One shop just closed for the day.', bold: true },
      { date: '2026-08', text: 'The US Army reportedly offered a four-day "GTA pass" for re-enlisting. 20 soldiers reportedly took it.' },
      { date: 'Nov 19', text: 'Launch day. Rockstar Games / Take-Two.' },
    ],
    disclaimer: 'Every character in the game is made up. Especially the boss.', // the template adds the parody line (4ד)
  },
  community: { heading: 'Made it home!', sub: 'Challenge a friend to beat your score, and be the first to play our next game.' },
};
