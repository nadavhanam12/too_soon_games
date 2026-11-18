// WastedForSix: the story arc (RULES 2א) and the bot the bug check plays it with (RULES 21ב, DECISIONS 69).
// Not part of the build. The bot only presses keys and reads __world / __peek; forceLose (__lose) is used only to test
// the lose screen's "retry from the stage".
// Route the bot takes: quit at the boss (gas station detour, police), trade in the ring at the store (spouse + police
// chase). The sick branch (clinic, HR minivan) was also played to the end by this bot on 2026-11-17 (seed 7).

export const arc = {
  start: 'Launch day, 8:30 a.m.: a fan who waited 13 years still has a job and a boss who needs him in today',
  stages: [
    { id: 'commute', beat: 'Drive from home to the office, grabbing cash and the first graffiti letters' },
    { id: 'boss', beat: 'Rehearse a fake cough in the elevator, then face the boss: agreeing is WASTED, so fake the 24-hour flu (or quit)' },
    { id: 'launch', beat: 'Drive to the game store with a forced detour: the doctor for a sick note (HR minivan roams) or the gas station (cops)' },
    { id: 'clerk', beat: 'Cut the midnight line, then, broke at the counter: borrow from loan sharks, grab it and run, or trade in the engagement ring' },
    { id: 'home', beat: 'Chase home with the game: loan sharks, cops or the fiancée on your tail' },
    { id: 'fiancee', beat: 'Tiptoe past the couch; the fiancée wants attention: sneaking and fake listening fail, asking honestly for one hour works' },
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

/** Press `keys` one by one, 2.6 s apart from 3 s in: the options appear one by one from 1 s, 0.6 s apart (ready by ~2.5 s). */
const decide = (keys) => async ({ t }, io) => {
  if (t < 3) return;
  // once the last key (Continue) is due, tap faster: the montage moment and ITEM ACQUIRED each want a tap of their own,
  // and the checker calls 5 s without a state change "frozen"
  const i = Math.min(Math.round((t - 3) / 2.6), keys.length - 1), gap = i === keys.length - 1 ? 1.5 : 2.6;
  await every(t, gap, () => io.press(keys[i]));
};

/** The mini game before a conversation (minigames.ts, read through __peek().mini): cough on the green, dodge the
 *  campers, tiptoe only while she is calm. Title and result cards end by themselves. */
async function playMini(m, t, io) {
  if (m.phase === 'intro') { await io.releaseAll(); if (m.t > 0.6) await every(t, 0.5, () => io.press(' ')); return; }   // the START button (Space presses it)
  if (m.phase !== 'play') { await io.releaseAll(); return; }
  if (m.name === 'cough') {   // PATIENT ZERO: walk to the nearest coworker without a mask, cough while the boss looks
    const go = m.dx === null ? 0 : m.dx > 1.2 ? 1 : m.dx < -1.2 ? -1 : 0;
    await io.hold('ArrowRight', go > 0); await io.hold('ArrowLeft', go < 0);
    if (go === 0 && m.dx !== null && m.boss === 'look' && m.cd) await io.press(' ');
    return;
  }
  if (m.name === 'line') {
    if (m.dy === null || m.dy > 260 || !m.blocked.includes(m.lane)) return;
    const free = [0, 1, 2].filter((l) => !m.blocked.includes(l)).sort((a, b) => Math.abs(a - m.lane) - Math.abs(b - m.lane))[0];
    if (free !== undefined) await io.press(free < m.lane ? 'ArrowLeft' : 'ArrowRight');
    return;
  }
  if (m.name === 'tiptoe') await io.hold(' ', m.mode === 'calm' && m.mt > 0.35);
}
/** A conversation stage: its mini game, then the VS card (it waits for its button: Space), then the decisions; after
 *  the last Continue, LEVEL UP (its button: Space) and the montage. The decisions' clock starts after the card. */
const VS_WAIT = 0.4;
let preT = null, preLast = Infinity;
const scene = (keys) => { const d = decide(keys); return async (s, io) => {
  if (s.t < preLast) preT = null; preLast = s.t;
  const m = s.peek?.mini;
  if (m) { preT = s.t; return playMini(m, s.t, io); }
  if (s.peek?.vs != null) { preT = s.t; if (s.peek.vs > 2.5) await every(s.t, 0.5, () => io.press(' ')); return; }
  if (s.peek?.levelUp != null) { if (s.peek.levelUp > 1.8) await every(s.t, 0.5, () => io.press(' ')); return; }
  if (s.peek?.moment) { const m = s.peek.moment; if ((m.montage ?? 0) > 2.5 || (m.item ?? 0) > 1.2) await every(s.t, 0.5, () => io.press(' ')); return; }   // the montage, ITEM ACQUIRED: Continue when they take a tap
  if (preT === null) preT = s.t;
  const t = s.t - preT - VS_WAIT;
  if (t >= 0) return d({ ...s, t }, io);
}; };

export const bot = {
  commute: drive,
  boss: scene(['3', ' ']),            // quit, Continue
  launch: drive,
  clerk: scene(['3', '3', ' ']),      // trade something in → the ring → Continue
  home: drive,
  fiancee: scene(['3', ' ']),         // ask honestly, Continue
  async pc({ t, peek }, io) { if (peek?.moment?.finale != null) { if (peek.moment.finale > 2.2) await every(t, 0.5, () => io.press(' ')); return; } if (peek?.levelUp != null) { if (peek.levelUp > 1.8) await every(t, 0.5, () => io.press(' ')); return; } if (t < 3.5) return; /* the PC boots for 2.9 s and ignores input (scenes.ts BOOT_S) */ await every(t, 8, async () => { for (const k of 'wasted') await io.press(k); }); }, // once: the game ends 2.2 s later
};

/** Lose on the spot (every stage, including the decision scenes that can't be lost by play). */
export function forceLose() { window.__lose(); }
