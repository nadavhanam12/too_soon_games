// Every player-facing text of "Half a Marathon, Whole Halloumi" (rule 10). Humor is edited here.
// Personal-info checklist (research.md section 7): no names of the family, no city, no race name, no real time.
import { type Content, type RunResult, W, ctx, rr, circ, txt } from '@tsg/index';
import { C, baby, bubble, person, runnerBack, wife } from './art';

/** Course closes at 3:00:00 race time. Score = seconds left at the finish (rule 14). */
export const CUTOFF = 3 * 3600;
export const fmtRace = (s: number): string => {
  const v = Math.max(0, Math.round(s)), h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), sec = v % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
export const finishTimeOf = (score: number): string => fmtRace(CUTOFF - score);

// ---------- ranks (score = seconds before the course closed; ~3600..7200) ----------
const RANKS: Array<[number, string]> = [
  [6900, 'Mediterranean Kenyan'], [6500, 'Exit at Km 21.1'], [6100, 'Pivoted to Running'], [5700, 'Dad Chasing a Toddler at the Mall'],
  [5300, 'Grilled Halloumi'], [4900, 'Hotel Pool Jogger'], [4400, 'Street Cat, Walking Pace'], [3800, 'Chased the Bus on the Wrong Side'],
  [3000, 'Tourist With a Pint'], [-1, 'Got Up at 4:30 for This?'],
];
export const rankFor = (sc: number): string => RANKS.find((r) => sc > r[0])![1];

// ---------- in-stage lines ----------
export const LINES = {
  startPass: ['Sorry, sorry, founder coming through.', 'Excuse me, pre-medal startup here.', 'On your left! No, your other left.', 'Pivoting! Pivoting!'],
  startHit: ['Who films a story at the start line?!', 'Twelve matching shirts. Zero urgency.', 'Cheers mate! (it is 7:58 a.m.)', 'They held hands. You did not get through.', 'You bounced off a stag party.'],
  story: ['Hi guys! Day 1 of my running era', 'Like and subscribe!', 'Wait, I need a better angle'],
  pintGuy: ['Cheers mate!', 'Is this the queue for the bar?', 'Brilliant! Keep going lad!'],
  stag: ["DAVE'S STAG", 'TEAM DAVE', 'NO SLEEP TIL KM 21'],
  water: ['Ahh. Water.', 'Hydrated. Valuation up.', 'Electrolytes acquired.'],
  food: {
    halloumi: ['Energy gel? Here it is halloumi.', 'Squeaky cheese, squeaky speed.', 'Grilled. Salty. Aerodynamic.'],
    gyros: ['A gyros at km 5. Bold.', 'Pita-powered.', 'Extra tzatziki, extra speed.'],
    loukoumades: ['Honey balls! Sugar rush!', 'Loukoumades. Sticky fingers, fast legs.'],
    coffee: ['Cypriot coffee. Heart rate: yes.', 'Sketo, no sugar, all panic.'],
  } as Record<string, string[]>,
  foodTag: { halloumi: 'HALLOUMI POWER', gyros: 'GYROS POWER', loukoumades: 'SUGAR RUSH', coffee: 'CAFFEINE' } as Record<string, string>,
  thief: ['A cat stole your {food}.', 'Cat 1, your {food} 0.', 'The cat is eating your {food}. Respect.'],
  stroller: ['A dad with a stroller just passed you.', 'Overtaken by a stroller. The baby waved.'],
  costume: ['GYROS', 'PITA', 'SOUVLAKI'],
  thought: '"Thrilled to announce I ran 21.1 km…"',
  babyRun: ['Wait. Is that the baby?!', 'The baby finished first.'],
  excuses: ['KNEE', 'LACES', 'TOO HOT', 'NO SLEEP', 'BLISTER', 'STITCH', 'HEADWIND', 'NEW SHOES', 'NO GEL', 'CHAFING', 'CALF', 'THE HILL', 'GPS LOST', 'CRAMP', 'TOENAIL', 'HUNGRY'],
  ouzo: ['Ouzo?! Who gave you ouzo?', 'A local grandpa says: one for the road.', 'The road is now spinning.'],
  thirsty: ['Thirsty. Grab a cup!', 'Your mouth is a desert. Grab water!'],
  sunHot: ["29°C in November. It's Cyprus, don't ask.", 'Sweat level: Mediterranean.', 'You are cooking. Let go!'],
  siga: ['Siga siga! (slow down, my friend)', 'Siga siga! Why you run? Sit!'],
  catTrip: ['You tripped over a cat. The cat is fine.', 'The cat did not move. The cat never moves.', 'Cat 1, Founder 0.'],
  catOk: ['Cat respected.', 'The cat nods at you.', 'Cat. Another cat. Same cat?'],
  bus: ['The bus came from the wrong side. Again.'],
  wall: ["Why didn't I spend Saturday on the couch like a normal person?", 'My legs just filed for divorce.', 'Who signed me up for this? Oh. Me.', "If it's not on Strava, it didn't happen.", 'Think of the medal. Think of the shower.', 'Is it too late to become a swimmer?', 'That km sign is lying. It has to be.'],
  wallWrong: ['Same leg twice. Bold strategy.', 'Left, right. Not right, right.', 'Easy. Those are legs, not thumbs.'],
  crowdSign: ['GO DAVE', 'FREE HUGS', 'WHO ARE WE CHEERING?', 'TOUCH FOR POWER', 'PINTS AT KM 22'],
  wrongBlonde: ["That's Sharon from Manchester.", "That's a different blonde. She is also proud of you.", "That's Kevin. He's had four pints."],
  highFive: ['HIGH FIVE!!!', 'The baby high-fived you. Worth a minute.'],
  missed: ['You missed them. The baby waved anyway.'],
  finish: ['Our only exit this year.'],
};

/** Stage banners: title + three lines, shown by the template (pauses until a tap). */
export const BANNERS = {
  start: ['KM 0 · THE START', ['Swipe to get past the crowd.']],
  water: ['KM 3 · WATER STATION', ['Tap to grab. Food = boost. Ouzo = no.']],
  sun: ['KM 8 · CYPRUS SUN', ['Hold to sprint. Let go to cool down, and for cats.']],
  wall: ['KM 15 · THE WALL', ['The mental wall: the km where your head says stop.', 'Push through: LEFT, RIGHT, LEFT, RIGHT.']],
  finish: ['KM 19 · THE FINISH', ['Tap to sprint. Tap the baby for a high five.']],
} as const satisfies Record<string, readonly [string, readonly string[]]>;

// ---------- cutscene drawings (y 0..450; the caption panel sits below) ----------
function bedroom(st: number, babyAwake: boolean): void {
  ctx.fillStyle = '#141a33'; ctx.fillRect(0, 0, W, 450);
  rr(220, 40, 110, 90, 6, '#1d2750'); circ(300, 70, 12, '#f4f1d0'); for (let i = 0; i < 6; i++) circ(232 + i * 16, 60 + (i % 2) * 30, 1.5, '#ffffff');
  rr(20, 300, 220, 70, 14, '#2a3566'); rr(20, 285, 70, 30, 12, '#e8e8f0');
  rr(36, 278, 40, 22, 10, C.blonde); circ(56, 292, 10, C.skin); rr(44, 280, 24, 8, 4, C.blonde); // her, asleep-ish
  rr(80, 290, 160, 44, 12, '#3b4a8a');
  const ring = Math.sin(st * 30) > 0 && st < 3;
  rr(250, 300, 80, 46, 8, '#0c0f1e', ring ? '#ff3b3b' : '#333a5e', 2);
  txt('4:30', 290, 323, 22, ring ? '#ff3b3b' : '#ff8a8a', 'center', 900);
  if (ring) { txt('BEEP', 290, 280, 14, '#ff3b3b', 'center', 900); }
  rr(250, 160, 90, 70, 10, undefined, '#c9b48a', 3);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = '#c9b48a'; ctx.fillRect(256 + i * 15, 160, 3, 70); }
  if (babyAwake) baby(296, 200, 1.5, st, false);
}
function startLine(st: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, '#1b2350'); g.addColorStop(1, '#ff9a5a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 450);
  ctx.fillStyle = C.road; ctx.fillRect(0, 300, W, 150);
  rr(30, 120, 300, 30, 6, C.orange); txt('START', W / 2, 136, 18, '#fff', 'center', 900);
  rr(30, 150, 10, 150, 0, C.ink); rr(320, 150, 10, 150, 0, C.ink);
  const shirts = ['#3ddc84', '#ffffff', '#c8102e', '#8a2be2', '#ffd23f', '#2f6fdd'];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) person(20 + i * 40 + (r % 2) * 20, 330 + r * 34 + Math.sin(st * 3 + i) * 2, { sc: 0.9, shirt: shirts[(i + r) % 6], hair: (['#3a2a1a', C.blonde, '#111', false] as const)[(i * 3 + r) % 4], back: true });
  runnerBack(W / 2, 395, 1.4, st, 0);
  person(70, 290, { sc: 1, shirt: '#c8102e', hair: C.blonde, sunburn: true }); ctx.save(); ctx.translate(84, 286); rr(-6, -18, 12, 18, 2, '#f2a71b'); ctx.restore();
  bubble("Cheers mate! Haven't slept since yesterday!", 110, 236, 12, '#fff', '#111', 76, 262);
}

export const content: Content = {
  title: {
    heading: ' ', // drawn on two lines by main.ts (drawTitleArt): too long for the template's one-line heading
    lines: ['21.1 km in Cyprus. 29°C in November.', 'The baby is waiting at the finish.'],
    credit: 'Based on a real race. Today. · Too Soon Games',
  },
  cutscene: {
    button: 'To the start line',
    steps: [
      { dur: 0, speaker: '4:30 a.m. Race day.', text: 'The baby has been up since 4:15. Staring. Silently.', draw: (st) => bedroom(st, true), sfx: 'bad' },
      { dur: 0, speaker: 'From the bed', text: '"Go. Come back with a medal, not excuses."', draw: (st) => { bedroom(st, true); bubble('Medal. Not excuses.', 120, 250, 13, '#fff', '#111', 60, 285); } },
      { dur: 0, speaker: 'The start line', text: '4,000 runners. One Brit who never went to bed.', draw: (st) => startLine(st), sfx: 'ok' },
    ],
  },
  lose: { heading: 'Course closed.', line: 'The sweeper bus picked you up. It had air conditioning.', consolation: '(In real life he finished. You can too.)' },
  result: {
    heading: (r) => (r.reason === 'highfive' ? 'Finisher + high five!' : 'Finisher. Baby fell asleep.'),
    sentence: (r) => `21.1 km in ${finishTimeOf(r.score)}. Rank: "${rankFor(r.score)}"`,
    rankFor,
    resultWords: (r: RunResult) => (r.score > 0 ? finishTimeOf(r.score) : 'DNF'),
  },
  board: { heading: 'Fastest Finishers', sub: 'Most seconds left before the course closed' },
  facts: {
    heading: 'What really happened',
    sub: 'A founder, a half marathon, Cyprus',
    lines: [
      { text: 'Nov 15, 2026: one of our founders ran a real half marathon in Cyprus.' },
      { text: 'No halloumi at the water stations. No ouzo grandpa. Allegedly.' },
      { text: 'We built this game while he ran. He finished first.', bold: true },
    ],
    disclaimer: 'Everyone in the game is made up. Including Sharon from Manchester.',
  },
  community: { heading: 'Congrats, finisher!', sub: 'Challenge a friend to beat your time, and be the first to play our next game.' },
};

/** Lose-screen consolation pool (the template shows content.lose.consolation; main.ts rotates it). */
export const CONSOLATION = ['(In real life he finished. You can too.)', '(A 2-year-old would have finished faster. In a diaper.)', '(The wall won this time. Rematch?)'];
