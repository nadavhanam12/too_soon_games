// The play scene: one template scene running seven stages in story order (DECISIONS 40):
//   commute (drive) → boss (gray scene) → launch (drive + forced detour) → clerk (gray scene) → home (chase) → fiancee (gray scene) → pc (password)
// Shared state G carries the branch (sick / quit), the store choice, money, score, found letters and the frozen police
// position across stages. Each stage snapshots G on entry so "retry from this stage" restores it exactly.
// Fails (fired / out of fuel / caught) go through R.fail → the template's lose screen, headed WASTED.
import { R, W, view, ctx, state, input, onKeyDown, rr, txt, clamp, sfx, music, easeO, easeOB, pop, haptic, type Scene } from '@tsg/index';
import type { Branch, StoreChoice, TradeItem } from './content';
import { TIMELINE, TIMELINE_SHORT, RADIO, MISSION_PASSED, PC, UI, ITEM } from './content';
import { grayOut } from './pixel';
import { D, MAX_V, gpsTarget, worldReady, nearHr, heliPatrol } from './drive';
import { PLACES, roadLine, nodeOf, type PlaceId } from './city';
import { C } from './art';
import { ptxt } from './pixel';
import { loadPortraits, type Who } from './portraits';
import { itemIcon, ITEM_HUD } from './item';
import './sfx';

export type StageName = 'commute' | 'boss' | 'launch' | 'clerk' | 'home' | 'fiancee' | 'pc';
export interface Stage {
  enter(): void;
  /** Logic + input. Not called while the template's stage banner pauses the game (dt = 0). */
  step(dt: number): void;
  render(): void;
  key?(e: KeyboardEvent): boolean;
}
const ORDER: StageName[] = ['commute', 'boss', 'launch', 'clerk', 'home', 'fiancee', 'pc'];
/** Which looped track each stage plays (sfx.ts MUSIC.files); the template crossfades on change. */
export const STAGE_MUSIC: Record<StageName, string> = { commute: 'drive', boss: 'scheme', launch: 'drive', clerk: 'scheme', home: 'chase', fiancee: 'scheme', pc: 'scheme' };   // only the driving legs' entries are played (stageTrack); 'scheme' is a radio station
const setMusic = (track: string): void => { if (R.cfg.music !== false) music.set(track); };
/** The track for the current stage. A driving leg plays your radio station, else its own track. A conversation (and the
 *  PC) plays nothing of its own: the music of the drive before it carries on (Nadav, 2026-11-17). */
export function stageTrack(name: StageName = G.stage): string {
  if (G.radio) return G.radio;
  let i = ORDER.indexOf(name);
  while (i > 0 && !DRIVING[ORDER[i]!]) i--;
  return STAGE_MUSIC[ORDER[i]!];
}
export const LEG_TARGET_S: Partial<Record<StageName, number>> = { commute: 40, launch: 60, home: 50 };
export const OUTRO_S = 1.5;      // "PRESS START" end beat (rule 13ג)
export const START_MONEY = 60;   // wallet at 8:30 a.m. (the sick branch always has something for the doctor)
export const FAIL_S = 1.2;       // the caught / fired / out-of-fuel moment before the lose screen (rules 13ג, 13ז)
const DRIVING: Partial<Record<StageName, true>> = { commute: true, launch: true, home: true };
const SHOW_S = 2.6;              // how long the wallet and the goal's name stay up after they change (rule 13ט)

interface Snapshot { score: number; money: number; letters: string[]; note: boolean; fuel: number; stars: number; copPos: { x: number; y: number } | null; traded: TradeItem[]; met: Who[] }

export const G = {
  stage: 'commute' as StageName,
  branch: null as Branch | null,
  store: null as StoreChoice | null,
  traded: [] as TradeItem[],      // trade-in items the clerk already refused
  agreed: false,                  // the boss "agree" option was tried (it stays gone)
  met: [] as Who[],               // the characters whose conversation is behind you: their panels in the montage (montage.ts)
  score: 0,
  money: 0,
  letters: [] as string[],
  note: false,
  fuel: 1,
  stars: 0,
  copPos: null as { x: number; y: number } | null,  // the gas-theft cop, frozen while you're in the store
  hits: 0,
  t: 0,                           // seconds in the current stage
  playT: 0,
  ended: false,
  outro: 0,
  failT: 0,                       // seconds left of the fail moment (the lose screen comes when it runs out)
  radio: null as string | null,   // the station you tuned the car radio to (null = each leg's own track)
  radioT: -9,                     // state.t of the last station change (the button shows the name and pops)
  sayT: -9,
  entry: null as Snapshot | null,
  wrongPw: 0,
  reached: 0,                     // timeline: milestones reached so far (0 = woke up)
  reachT: -9,                     // playT when the last one was reached (its label pops for a moment)
  arrive: -1,                     // seconds into the walk from the car into a building (-1 = not walking): the timeline's arrival moment
  ui: 0,                       // counts the decision screens shown (scenes.ts setUI); in __world so the bugcheck sees them change
};
const snap = (): Snapshot => ({ score: G.score, money: G.money, letters: [...G.letters], note: G.note, fuel: G.fuel, stars: G.stars, copPos: G.copPos && { ...G.copPos }, traded: [...G.traded], met: [...G.met] });

const stages: Partial<Record<StageName, Stage>> = {};
let pendingWin: Parameters<typeof R.win>[0] | null = null;
let pendingFail: Parameters<typeof R.fail>[0] | null = null;
export function registerStage(name: StageName, s: Stage): void { stages[name] = s; }

export function setStage(name: StageName): void {
  G.stage = name; G.t = 0; G.hits = 0; G.arrive = -1; G.entry = snap();
  R.stageStart(name);
  setMusic(stageTrack(name));
  stages[name]!.enter();
}

/** The car radio: tune to the next track (driving legs). Returns the station's name. The choice stays for later legs. */
export function nextStation(): string {
  const cur = G.radio ?? STAGE_MUSIC[G.stage], i = RADIO.findIndex((s) => s.track === cur);
  const next = RADIO[(i + 1) % RADIO.length]!;
  G.radio = next.track; G.radioT = state.t; setMusic(next.track);
  sfx.radio?.(); haptic(10);
  return next.name;
}
export const stationName = (): string => RADIO.find((s) => s.track === (G.radio ?? STAGE_MUSIC[G.stage]))?.name ?? '';

export function stageDone(): void {
  if (G.ended) return;
  R.stageComplete(G.stage, G.score);
  if (G.stage === 'boss') say(MISSION_PASSED.boss, 2, true);
  G.reached = ORDER.indexOf(G.stage) + 1; G.reachT = G.playT; sfx.ok?.();
  const next = ORDER[ORDER.indexOf(G.stage) + 1];
  if (next) { R.flash(0.25); setStage(next); }
}

/** Fail → the lose screen (WASTED). reason picks the lose line (content.LOSE_LINES). */
export function fail(reason: string): void {
  if (G.ended) return;
  G.ended = true;
  R.shake(0.45); sfx.wasted?.(); haptic([70, 40, 140]);
  const run = { score: G.score, durationS: G.playT, stage: G.stage, reason };
  // on the road the fail gets its moment first (a big hit, rule 13ז): everything stops for an instant, a flash, then
  // the camera comes down on the car while the colour drains; playScene.draw calls R.fail when it is over
  if (DRIVING[G.stage] && worldReady()) { pendingFail = run; G.failT = FAIL_S; R.hitStop(0.07); R.flash(0.4); }
  else R.fail(run);
}
/** One frame of the fail moment: the camera closes in on the car, the world turns gray. */
function failMoment(dt: number): void {
  const k = 1 - Math.pow(0.02, dt);
  D.cam.x += (D.p.x - D.cam.x) * k; D.cam.y += (D.p.y - D.cam.y) * k; D.zoom += (62 - D.zoom) * k;
  G.failT -= dt;
  if (G.failT <= 0 && pendingFail) { const r = pendingFail; pendingFail = null; G.failT = 0; R.fail(r); }
}

/** Start the 1.5 s PRESS START beat, then R.win. */
export function finishGame(): void {
  if (G.ended) return;
  G.ended = true; G.outro = OUTRO_S;
  setMusic('theme'); // PRESS START: back to the opening tune, it carries on into the result screen
  pendingWin = { score: clamp(Math.round(G.score), 0, R.cfg.score.max), durationS: G.playT, stage: 'pc', reason: G.branch ?? '' };
}

export function addScore(n: number): void { G.score = Math.max(0, G.score + n); }

/** Toast with a rate limit so jokes don't pile up; `force` for lines that explain a rule. */
export function say(text: string, life = 1.8, force = false): void {
  if (!force && G.playT - G.sayT < 2.6) return;
  G.sayT = G.playT; R.say(text, life);
}

// ---------- HUD (driving legs only) ----------
// Rule 13ט: three fixed items (score, found letters, the story timeline) and one gauge per stage (fuel while the tank
// is the danger, HEAT once someone is after you). The wallet and the goal's name show only for SHOW_S after they
// change; the minimap and the light beam already say where to go.
const H = { score: 0, last: 0, scoreT: -9, money: -1, moneyT: -9, goal: null as PlaceId | null, goalT: -9, letters: 0, lettersT: -9, t: 0 };
/** Draws `draw` scaled by s around (x, y). */
function scaled(x: number, y: number, s: number, draw: () => void): void { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y); draw(); ctx.restore(); }
export function hud(goal: PlaceId | null, opts: { fuel?: boolean } = {}): void {
  if (pendingFail) return;   // the fail moment: nothing but the car (rule 13ג)
  const now = state.t, fdt = clamp(now - H.t, 0, 0.1); H.t = now;
  // toasts: above the timeline's plate while the mission card is up (G.t stays 0, the HUD band is still off screen),
  // then down under the band as it drops in
  R.toastY = 98 + 36 * easeO(clamp(G.t / 0.3, 0, 1));
  // what changed since the last frame: the counter that changed pops, the wallet and the goal come up for a moment
  if (G.t < 0.05) { H.score = G.score; H.last = G.score; H.money = G.money; H.goal = goal; H.goalT = now; H.letters = G.letters.length; if (G.stage === 'commute') H.moneyT = now; }
  if (G.score !== H.last) { H.last = G.score; H.scoreT = now; }
  if (G.money !== H.money) { H.money = G.money; H.moneyT = now; }
  if (goal !== H.goal) { H.goal = goal; H.goalT = now; }
  if (G.letters.length !== H.letters) { H.letters = G.letters.length; H.lettersT = now; }
  // the score counts up to its value instead of jumping
  H.score += (G.score - H.score) * (1 - Math.pow(0.0004, fdt)); if (Math.abs(G.score - H.score) < 1) H.score = G.score;
  // entry: the HUD band drops in from the top when a leg starts
  const ek = easeOB(Math.min(1, G.t / 0.3));
  ctx.save(); ctx.translate(0, (ek - 1) * (view.top + 60));
  // two HUD rows (0..50), then the story timeline on its own row under them
  ctx.fillStyle = 'rgba(14,14,16,.9)'; ctx.fillRect(0, -view.top, W, view.top + TL_BAND);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, 50, W, 1);
  ctx.fillStyle = C.pink; ctx.fillRect(0, TL_BAND, W, 2);
  // wallet: in when the money changes, out again after SHOW_S; it pops when a bill lands in it
  const mAge = now - H.moneyT;
  if (mAge < SHOW_S) {
    const k = easeOB(clamp(mAge / 0.2, 0, 1)) * easeO(clamp((SHOW_S - mAge) / 0.25, 0, 1));
    scaled(34, 15, k * pop(now - Math.max(H.moneyT, D.hudKick.cash), 0.16, 0.25), () => ptxt('$' + Math.round(G.money), 10, 15, 2, C.money, 'left', '#0a2a12'));
  }
  scaled(W / 2, 15, pop(now - Math.max(H.scoreT, D.hudKick.can), 0.16, 0.22), () => ptxt(String(Math.round(H.score)).padStart(6, '0'), W / 2, 15, 2, C.ink, 'center', '#000'));
  // the stage's one gauge: fuel until someone chases you, then HEAT (with the wanted stars). A gauge in danger blinks.
  const h = clamp(D.heat, 0, 1), blink = Math.sin(now * 10) > 0;
  if (opts.fuel && !D.chasers.length) {
    const low = G.fuel < 0.3;
    txt(UI.fuel,266, 9, 8, low && blink ? C.red : '#cfcfcf', 'left', 900);
    rr(266, 14, 84, 8, 2, 'rgba(255,255,255,.15)'); rr(266, 14, 84 * clamp(G.fuel, 0, 1), 8, 2, low ? (blink ? C.red : '#7a1420') : C.money);
  } else if (h > 0.01 || G.stars > 0) {
    const hot = h > 0.66;
    // the label names the nearest chaser (Nadav, 2026-11-17: "who is chasing me?"); no chaser = just HEAT
    let near: (typeof D.chasers)[number] | null = null, nd = Infinity;
    for (const c of D.chasers) { const d = Math.hypot(c.x - D.p.x, c.y - D.p.y); if (d < nd) { nd = d; near = c; } }
    txt(near ? UI.chasedBy[near.kind] ?? UI.heat : UI.heat, 266, 9, 8, hot && blink ? '#ff3b3b' : '#ffcc00', 'left', 900);
    rr(266, 14, 84, 8, 2, hot && blink ? 'rgba(255,59,59,.35)' : 'rgba(255,255,255,.15)');
    if (h > 0.01) rr(266, 14, 84 * h, 8, 2, hot ? '#ff3b3b' : h > 0.33 ? '#ff9a3a' : '#ffcc00');
    for (let i = 0; i < G.stars; i++) star(254 - i * 16, 15, blink ? '#ffcc00' : '#fff6b0');
  }
  // found letters, in password order; the row pops when a new one is found
  const PW = 'WASTED';
  scaled(58, 37, pop(now - H.lettersT, 0.2, 0.3), () => {
    for (let i = 0; i < 6; i++) {
      const has = G.letters.includes(PW[i]!);
      rr(10 + i * 16, 28, 14, 17, 2, has ? 'rgba(255,204,0,.25)' : 'rgba(255,255,255,.08)');
      ptxt(has ? PW[i]! : '_', 17 + i * 16, 37, 1, has ? C.pink : '#777');
    }
  });
  // where to: only for a moment, at the start of the leg and when the goal changes
  const gAge = now - H.goalT;
  if (goal && gAge < SHOW_S + 1) {
    const k = easeOB(clamp(gAge / 0.25, 0, 1)) * easeO(clamp((SHOW_S + 1 - gAge) / 0.25, 0, 1));
    scaled(180, 37, k, () => txt(`▶ ${placeLabel(goal)}`, 116, 37, 12, C.yellow, 'left', 900));
  }
  // the game case you got at the store rides along on the way home
  if (G.stage === 'home' && G.store) itemIcon(ITEM_HUD.x, ITEM_HUD.y, easeOB(clamp(G.t / 0.3, 0, 1)));
  ctx.restore();
  // the timeline is not part of the band's drop: it has its own moments, when nothing else asks for the eye
  if (G.arrive >= 0) {
    // parked, walking in: the row comes down, the pin rides to the next stop, the stop lights up and gets its name
    const a = G.arrive, hit = a >= ARRIVE_HIT_S;
    const from = G.reached + stageFrac();
    timelineAt(easeOB(clamp(a / 0.45, 0, 1)), TL_ARRIVE_Y, { at: from + (G.reached + 1 - from) * easeO(clamp((a - 0.45) / (ARRIVE_HIT_S - 0.45), 0, 1)), reached: G.reached + (hit ? 1 : 0), age: hit ? a - ARRIVE_HIT_S : 9 });
  } else if (state.t - cardT > 0.1) {   // while the mission card is up it draws the row itself (a second copy here would show through, dimmed, as the card's drops in)
    // leg start: it flies from where the mission card showed it up into its row; the card's name tag fades on the way
    timelineAt(1 - easeO(clamp((G.t - 0.1) / TL_FLY_S, 0, 1)), TL_CARD_Y, { age: 2.35 + G.t });
  }
}

// ---------- the story timeline: woke up → ... → playing VI ----------
export const TL_Y = 68, TL_BAND = 92;   // the row's centre and the bottom of the HUD band on driving legs
const LEG_ENDS: Partial<Record<StageName, [PlaceId, PlaceId]>> = { commute: ['home', 'office'], launch: ['office', 'store'], home: ['store', 'home'] };
/** How far through the current stage you are (0..1): by distance on a driving leg, half-way in a scene. */
function stageFrac(): number {
  const le = LEG_ENDS[G.stage]; if (!le) return 0.5;
  const a = PLACES[le[0]], b = PLACES[le[1]], total = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return clamp(1 - Math.hypot(b.x - D.p.x, b.y - D.p.y) / total, 0.04, 0.94);
}
/** One thin row at height y: done part yellow, the rest dashed gray; a dot per milestone (done = filled, next =
 *  hollow, the last one a star); a red marker for you; the name of a milestone pops under its dot when you reach it. */
export interface TimelineOpts {
  reached?: number;   // milestones shown as reached (default G.reached)
  at?: number;        // where the pin and the yellow line end, in milestones (default: reached + progress in the stage)
  age?: number;       // seconds since the last one was reached: drives the dot's pop and the name tag (default: game time)
  pin?: boolean;      // draw the red pin (default: while the run is on)
}
const NOW_SCALE = 1.5;   // the name of the stop you are working on, against 1 for the finished ones (2 would run into its neighbours)
export function timeline(y: number, o: TimelineOpts = {}): void {
  const n = TIMELINE.length, x0 = 18, x1 = W - 18, step = (x1 - x0) / (n - 1), X = (i: number): number => x0 + i * step;
  const reached = Math.min(n - 1, o.reached ?? G.reached), age = o.age ?? G.playT - G.reachT;
  const at = Math.min(n - 1, o.at ?? reached + (G.ended ? 0 : stageFrac())), mx = X(at);
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(mx, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = C.yellow; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(mx, y); ctx.stroke();
  for (let i = 0; i < n; i++) {
    const done = i <= reached, last = i === n - 1;
    const fresh = i === reached ? clamp(age / 0.35, 0, 1) : 1, r = (last ? 5 : 4) * (done ? 0.6 + 0.4 * easeOB(fresh) : 1);
    if (last) star(X(i), y, done ? C.yellow : '#6b6b72');
    else { ctx.beginPath(); ctx.arc(X(i), y, r, 0, Math.PI * 2); ctx.fillStyle = done ? C.yellow : '#0e0e10'; ctx.fill(); ctx.strokeStyle = done ? '#0e0e10' : '#8a8a92'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  // names under the dots (Nadav, 2026-11-17): a stop you finished keeps its name, normal size and faded; the one you
  // are working on now is bigger and white; the stops after it have no name (suspense)
  for (let i = 0; i <= Math.min(reached + 1, n - 1); i++) {
    const now = i === reached + 1, sc = now ? NOW_SCALE : 1, s = TIMELINE_SHORT[i] ?? '', w = s.length * 6 * sc;
    const cx = clamp(X(i), w / 2 + 4, W - w / 2 - 4), cy = y + (now ? 16 : 14);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    ptxt(s, 0, 0, 1, now ? '#ffffff' : '#8a8a92');
    ctx.restore();
  }
  // you: a red pin riding the line
  if (o.pin ?? !G.ended) { ctx.fillStyle = C.red; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx, y + 2); ctx.lineTo(mx - 5, y - 7); ctx.lineTo(mx + 5, y - 7); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  // the milestone you just reached: a yellow tag under its dot, in for 0.3 s, out after 2.6 s
  if (age >= 0 && age < 2.6) {
    const label = TIMELINE[reached] ?? '', w = label.length * 6 + 16, k = easeOB(clamp(age / 0.3, 0, 1)) * clamp((2.6 - age) / 0.25, 0, 1);
    const cx = clamp(X(reached), w / 2 + 6, W - w / 2 - 6), ty = y + 34;   // the full name pops under the row of short names
    ctx.save(); ctx.translate(cx, ty); ctx.scale(k, k); ctx.rotate(-0.04);
    ctx.fillStyle = '#000'; ctx.fillRect(-w / 2 + 2, -8 + 2, w, 16);
    ctx.fillStyle = C.yellow; ctx.fillRect(-w / 2, -8, w, 16);
    ptxt(label, 0, 0, 1, '#0e0e10');
    ctx.restore();
  }
}
// ---------- the timeline's big moments ----------
// On a driving leg nobody has time to read the top row, so the timeline is shown when the world stands still: on the
// mission card before a leg (then it flies up into its HUD row), while the fan walks into a building (the pin rides to
// the next stop), and on the lose screen (how far you got).
const TL_CARD_Y = 150, TL_ARRIVE_Y = 192;   // the row's centre on the mission card (above its yellow band) / while walking in (under the toast)
const TL_FLY_S = 0.75;                      // card spot → HUD row when a leg starts (×1.5, Nadav 2026-11-17: too fast to read)
const ARRIVE_HIT_S = 1.3;                   // seconds into the walk when the pin lands on the next stop (the walk is 2.4 s)
/** The row on a dark plate under "YOUR DAY". k = 1: at height fy; k = 0: in the HUD row, plate gone. */
function timelineAt(k: number, fy: number, o: TimelineOpts = {}): void {
  const y = TL_Y + (fy - TL_Y) * k, a = clamp(k, 0, 1);
  if (a > 0.01) {
    ctx.globalAlpha = a;
    rr(6, y - 30, W - 12, 78, 10, 'rgba(14,14,16,.94)', C.pink, 1.5);
    ptxt(UI.yourDay, W / 2, y - 19, 1, '#b4b4bc');
    ctx.globalAlpha = 1;
  }
  timeline(y, o);
}
/** On the mission card (t = seconds the card is up). Leg 1: the pin sits on WOKE UP. Later legs: the pin rides from the
 *  scene you just finished to the stop it earned you, the stop lights up and its name pops. */
let cardT = -9;   // state.t of the last frame the mission card drew the timeline
export function cardTimeline(t: number): void {
  cardT = state.t;
  const r = G.reached, first = r === 0, hit = first ? 0.6 : 1.2, landed = t >= hit;
  ctx.save(); ctx.translate(0, (easeOB(Math.min(1, t / 0.3)) - 1) * (TL_CARD_Y + 60));   // drops in from the top edge
  timelineAt(1, TL_CARD_Y, {
    at: first ? 0 : r - 0.5 * (1 - easeO(clamp((t - 0.45) / (hit - 0.45), 0, 1))),
    reached: landed || first ? r : r - 1,
    age: landed ? Math.min(t - hit, 2.3) : first ? -1 : 9,   // the name tag stays while the card is up (2.3 = before its fade)
    pin: true,
  });
  ctx.restore();
}
/** On the lose screen (st = seconds on it): the line draws itself from WOKE UP to where the run ended, the pin riding
 *  its tip, and a caption names the last stop you reached. Sits between the score and the retry button. */
export function loseTimeline(st: number): void {
  const end = Math.min(TIMELINE.length - 1, G.reached + stageFrac()), at = end * easeO(clamp((st - 0.3) / 1.05, 0, 1));
  ctx.globalAlpha = clamp((st - 0.2) / 0.25, 0, 1);
  txt(UI.gotAsFar(TIMELINE[Math.min(G.reached, Math.floor(at))] ?? ''), W / 2, 373, 11, '#cfcfcf', 'center', 900);
  ctx.globalAlpha = 1;
  timeline(389, { at, reached: Math.min(G.reached, Math.floor(at)), age: 9, pin: true });
}

let labels: Record<string, string> = {};
export function setPlaceLabels(l: Record<string, string>): void { labels = l; }
const placeLabel = (id: PlaceId): string => labels[id] ?? id.toUpperCase();
function star(x: number, y: number, col: string): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
}

/** Bottom hint strip for the first seconds of a leg. */
export function hint(s: string, until = 3.5): void {
  if (G.t > until || G.ended) return;
  const a = easeO(Math.min(1, (until - G.t) * 2));
  const y = view.H - view.top - 292 + (1 - easeOB(Math.min(1, G.t / 0.3))) * 24;   // just above the stick, the minimap and the radio button; it rises into place
  ctx.globalAlpha = a * Math.min(1, G.t / 0.15); rr(16, y, W - 32, 32, 12, 'rgba(14,14,16,.85)'); txt(s, W / 2, y + 16, 13, '#fff', 'center', 900); ctx.globalAlpha = 1;
}

/** A finger that shows the drag gesture at the start of the first leg. */
export function demoDrag(x: number, y: number): void {
  if (G.t > 3 || G.ended || D.stick.on || D.usedKeys) return;
  const k = (G.t * 0.8) % 1, a = Math.min(1, (3 - G.t) * 2);
  ctx.globalAlpha = a * 0.8;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.stroke();
  txt('☝', x + Math.cos(-1) * 40 * k, y + 12 + Math.sin(-1) * 40 * k, 40, '#fff', 'center', 400);
  ctx.globalAlpha = 1;
}

/** End beat: the TV says PRESS START, every tap is swallowed (rule 13ג). */
function endBeat(): void {
  const k = clamp((OUTRO_S - G.outro) / 0.25, 0, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.75 * k})`; ctx.fillRect(0, -view.top, W, view.H);
  ctx.globalAlpha = k;
  rr(40, 200, 280, 180, 12, '#2b2b33', '#555', 3); rr(54, 212, 252, 140, 6, '#0e0e10');
  if (Math.sin(state.t * 9) > -0.4) ptxt(PC.start, W / 2, 282, 3, C.pink, 'center', '#3a2a00');
  ptxt(PC.installing, W / 2, 322, 1, '#b4b4bc');
  ptxt(ITEM.cover, W / 2, 238, 2, '#ffffff');
  ctx.globalAlpha = 1;
}

onKeyDown((e) => { if (state.scene !== 'play' || G.ended) return false; return stages[G.stage]?.key?.(e) ?? false; });

export const playScene: Scene = {
  enter() {
    R.toastY = 134;   // under the HUD band, the timeline and its label
    loadPortraits();
    const retry = R.retry;
    G.ended = false; G.outro = 0; pendingWin = null; pendingFail = null; G.failT = 0;
    if (retry?.stage && stages[retry.stage as StageName] && G.entry) {
      Object.assign(G, { ...G.entry, letters: [...G.entry.letters], traded: [...G.entry.traded], met: [...G.entry.met], copPos: G.entry.copPos && { ...G.entry.copPos } });
      setStage(retry.stage as StageName);
    } else {
      Object.assign(G, { reached: 0, reachT: 0, branch: null, store: null, traded: [], met: [], agreed: false, score: 0, money: START_MONEY, letters: [], note: false, fuel: 1, stars: 0, copPos: null, playT: 0, wrongPw: 0 });
      setStage('commute');
    }
  },
  draw(dt) {
    // a driving leg waits (clock stopped) until the 3D city has loaded; drive.renderWorld shows the loading card
    const waiting = !worldReady() && (G.stage === 'commute' || G.stage === 'launch' || G.stage === 'home');
    if (dt > 0 && !G.ended && !waiting) {
      G.playT += dt; G.t += dt;
      stages[G.stage]!.step(dt);
    } else if (dt > 0 && G.outro > 0) {
      input.taps.length = 0;
      G.outro -= dt;
      if (G.outro <= 0 && pendingWin) { const w = pendingWin; pendingWin = null; R.win(w); }
    } else if (dt > 0 && pendingFail) {
      input.taps.length = 0;
      failMoment(dt);
    }
    stages[G.stage]!.render();
    if (G.failT > 0) grayOut(0, -view.top, W, view.H, 0.15 + 0.5 * easeO(clamp((FAIL_S - G.failT) / 0.6, 0, 1)));
    if (G.outro > 0) endBeat();
  },
};

// debug hooks specific to this game (docs/CONTRACTS.md lists the template's)
const w = window as unknown as Record<string, unknown>;
w.__stage = (name: StageName, branch?: Branch, store?: StoreChoice) => { if (branch) G.branch = branch; if (store) G.store = store; if (stages[name]) setStage(name); };
w.__world = () => ({ stage: G.stage, ui: G.ui, branch: G.branch, store: G.store, met: G.met.join(','), score: Math.round(G.score), money: G.money, letters: G.letters.join(''), note: G.note, fuel: +G.fuel.toFixed(2), stars: G.stars, heat: +D.heat.toFixed(2), car: { x: Math.round(D.p.x), y: Math.round(D.p.y), v: Math.round(D.p.v) }, goal: D.goal, chasers: D.chasers.map((c) => ({ k: c.kind, d: Math.round(Math.hypot(c.x - D.p.x, c.y - D.p.y)) })), hr: nearHr() ? Math.round(Math.hypot(nearHr()!.x - D.p.x, nearHr()!.y - D.p.y)) : null, npcs: D.npcs.length, peds: D.peds.length, pedsDown: D.peds.filter((q) => q.st !== 'walk').length, maxV: MAX_V });
w.__met = (...who: Who[]) => { G.met = who; };   // debug: who is in the montage (the end screens, the share picture)
w.__stages = (): StageName[] => ORDER; // the story arc's stages in order (bugcheck playthrough)
/** Read-only view for the playthrough bot: the car and the point the GPS arrow aims at. */
w.__peek = () => ({ car: { x: D.p.x, y: D.p.y, a: D.p.a, v: D.p.v }, gps: D.goal ? gpsTarget(D.goal) : null, control: D.control && worldReady() });
/** Lose right now (the playthrough's forceLose: tests "retry from the stage" in every stage, even the ones you can't lose). */
w.__lose = () => fail('cop');
/** Put the HR minivan right next to the car (spotting test). */
w.__hrHere = () => {
  const hr = D.hrs[0]; if (!hr) return;
  const [i, j] = nodeOf(D.p.x, D.p.y), dx = D.p.x - roadLine(i), dy = D.p.y - roadLine(j);
  const hz = Math.abs(dx) > Math.abs(dy), sgn = Math.sign(hz ? dx : dy) || 1;
  hr.from = [i, j]; hr.to = hz ? [i + sgn, j] : [i, j + sgn]; hr.s = Math.max(0, Math.abs(hz ? dx : dy) - 12); hr.x = D.p.x - 12; hr.y = D.p.y;
};
/** Put the first chaser right next to the car (catch test). */
w.__chaserHere = () => { const c = D.chasers[0]; if (c) { c.x = D.p.x + 7.5; c.y = D.p.y; c.grace = 0; } };
/** Start a helicopter patrol right now. */
w.__heli = () => heliPatrol();
/** Teleport the car next to the current goal (flow testing only). */
w.__warp = () => { if (!D.goal) return; const g = PLACES[D.goal]; D.p.x = g.x + 5; D.p.y = g.y; D.cam.x = D.p.x; D.cam.y = D.p.y; for (const c of D.chasers) { c.x = g.x + 100; c.y = g.y; c.grace = 3; } for (const hr of D.hrs) { hr.from = [-6, -6]; hr.to = [-5, -6]; hr.s = 0; hr.x = roadLine(-6); hr.y = roadLine(-6); } };
/** Stand the nearest pedestrians in a row in front of the car (run-over test). */
w.__pedsHere = (n = 3) => { [...D.peds].filter((q) => q.st === 'walk').sort((a, b) => Math.hypot(a.x - D.p.x, a.y - D.p.y) - Math.hypot(b.x - D.p.x, b.y - D.p.y)).slice(0, n).forEach((q, i) => { q.x = D.p.x + Math.cos(D.p.a) * (14 + i * 7); q.y = D.p.y + Math.sin(D.p.a) * (14 + i * 7); }); };
