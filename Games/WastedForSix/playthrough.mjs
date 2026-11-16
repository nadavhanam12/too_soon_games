// WastedForSix: the story arc (RULES 2א) and the bot the bug check plays it with (RULES 21ב, DECISIONS 69).
// Not part of the build. The bot only presses keys and reads __world / __peek; forceLose (__lose) is used only to test
// the lose screen's "retry from the stage".
// Route the bot takes: quit at the boss (gas station detour, police), trade in the ring at the store (spouse + police
// chase). The sick branch (clinic, HR minivan) was also played to the end by this bot on 2026-11-17 (seed 7).

export const arc = {
  start: 'Launch day, 8:30 a.m.: a fan who waited 13 years still has a job and a boss who needs him in today',
  stages: [
    { id: 'commute', beat: 'Drive from home to the office, grabbing cash and the first graffiti letters' },
    { id: 'boss', beat: 'Face the boss: agreeing is WASTED, so fake the 24-hour flu (or quit)' },
    { id: 'launch', beat: 'Drive to the game store with a forced detour: the doctor for a sick note (HR minivan roams) or the gas station (cops)' },
    { id: 'clerk', beat: 'Broke at the counter: borrow from loan sharks, grab it and run, or trade in the wedding ring' },
    { id: 'home', beat: 'Chase home with the game: loan sharks, cops or the spouse on your tail' },
    { id: 'pc', beat: 'Type the password on the old PC: WASTED' },
  ],
  end: 'PRESS START: the fan is home, on "sick leave" or unemployed, playing Six',
  endsBy: 'win',
};

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
let last = -9, prevT = Infinity; // Infinity: the first call of a run starts clean, so two runs of one seed match
/** Runs `fn` at most every `gap` seconds of the stage; the stage clock restarting resets it. */
function every(t, gap, fn) { if (t < prevT) last = -9; prevT = t; if (t - last >= gap) { last = t; return fn(); } }

/** Steer toward the GPS point with the arrow keys; ease off the gas in sharp turns. No progress for a second (nose
 *  against a car or a building): back up for 0.7 s steering the other way, like a person would. */
// The runner's stage clock keeps ticking while the 3D city loads (control false), so the bot measures its own time
// only while it has control: a slow or fast load then gives the same run.
let anchor = null, reverseUntil = -1, lastT = null, driveT = 0;
async function drive({ peek, t }, io) {
  if (lastT === null || t < lastT) { anchor = null; reverseUntil = -1; driveT = 0; lastT = t; }
  const dt = t - lastT; lastT = t;
  if (!peek?.gps || !peek.control) { await io.releaseAll(); anchor = null; return; }
  driveT += dt; t = driveT;
  const { car, gps } = peek;
  const d = wrap(Math.atan2(gps.y - car.y, gps.x - car.x) - car.a);
  if (t < reverseUntil) {
    await io.hold('ArrowUp', false); await io.hold('ArrowDown', true);
    await io.hold('ArrowLeft', d > 0); await io.hold('ArrowRight', d <= 0);
    return;
  }
  await io.hold('ArrowDown', false);
  // not making progress (pinned or scraping along a wall): under 4 units in the last second
  if (!anchor || t - anchor.t >= 1) {
    const moved = anchor ? Math.hypot(car.x - anchor.x, car.y - anchor.y) : 99;
    anchor = { x: car.x, y: car.y, t };
    if (moved < 4) { reverseUntil = t + 0.7; return; }
  }
  // the scene's car turns at a fixed 2.3 rad/s, so at top speed a corner is wider than the road: brake into turns
  const turn = Math.abs(d), want = turn < 0.25 ? 46 : turn < 0.6 ? 30 : 16;
  await io.hold('ArrowLeft', d < -0.12);
  await io.hold('ArrowRight', d > 0.12);
  await io.hold('ArrowUp', car.v < want);
  await io.hold('ArrowDown', car.v > want + 6);
}

/** Press `keys` one by one, 0.6 s apart, starting once the buttons are live (0.35 s); the last one repeats. */
const decide = (keys) => async ({ t }, io) => {
  if (t < 0.5) return;
  await every(t, 0.6, () => io.press(keys[Math.min(Math.round((t - 0.5) / 0.6), keys.length - 1)]));
};

export const bot = {
  commute: drive,
  boss: decide(['3', ' ']),           // quit, Continue
  launch: drive,
  clerk: decide(['3', '3', ' ']),     // trade something in → the ring → Continue
  home: drive,
  async pc({ t }, io) { await every(t, 8, async () => { for (const k of 'wasted') await io.press(k); }); }, // once: the game ends 2.2 s later
};

/** Lose on the spot (every stage, including the decision scenes that can't be lost by play). */
export function forceLose() { window.__lose(); }
