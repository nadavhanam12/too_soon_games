// The play scene: one template scene running six stages in story order (DECISIONS 40):
//   commute (drive) → boss (gray scene) → launch (drive + forced detour) → clerk (gray scene) → home (chase) → pc (password)
// Shared state G carries the branch (sick / quit), the store choice, money, score, found letters and the frozen police
// position across stages. Each stage snapshots G on entry so "retry from this stage" restores it exactly.
// Fails (fired / out of fuel / caught) go through R.fail → the template's lose screen, headed WASTED.
import { R, W, view, ctx, state, input, onKeyDown, rr, txt, clamp, sfx, music, type Scene } from '@tsg/index';
import type { Branch, StoreChoice, TradeItem } from './content';
import { D, MAX_V, gpsTarget, worldReady } from './drive';
import { PLACES, roadLine, nodeOf, type PlaceId } from './city';
import { C } from './art';
import { ptxt } from './pixel';
import { loadPortraits } from './portraits';
import './sfx';

export type StageName = 'commute' | 'boss' | 'launch' | 'clerk' | 'home' | 'pc';
export interface Stage {
  enter(): void;
  /** Logic + input. Not called while the template's stage banner pauses the game (dt = 0). */
  step(dt: number): void;
  render(): void;
  key?(e: KeyboardEvent): boolean;
}
const ORDER: StageName[] = ['commute', 'boss', 'launch', 'clerk', 'home', 'pc'];
/** Which looped track each stage plays (sfx.ts MUSIC.files); the template crossfades on change. */
export const STAGE_MUSIC: Record<StageName, string> = { commute: 'drive', boss: 'scheme', launch: 'drive', clerk: 'scheme', home: 'chase', pc: 'scheme' };
const setMusic = (track: string): void => { if (R.cfg.music !== false) music.set(track); };
export const LEG_TARGET_S: Partial<Record<StageName, number>> = { commute: 40, launch: 60, home: 50 };
export const OUTRO_S = 1.5;      // "PRESS START" end beat (rule 13ג)
export const START_MONEY = 60;   // wallet at 8:30 a.m. (the sick branch always has something for the doctor)

interface Snapshot { score: number; money: number; letters: string[]; note: boolean; fuel: number; stars: number; copPos: { x: number; y: number } | null; traded: TradeItem[] }

export const G = {
  stage: 'commute' as StageName,
  branch: null as Branch | null,
  store: null as StoreChoice | null,
  traded: [] as TradeItem[],      // trade-in items the clerk already refused
  agreed: false,                  // the boss "agree" option was tried (it stays gone)
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
  sayT: -9,
  entry: null as Snapshot | null,
  wrongPw: 0,
};
const snap = (): Snapshot => ({ score: G.score, money: G.money, letters: [...G.letters], note: G.note, fuel: G.fuel, stars: G.stars, copPos: G.copPos && { ...G.copPos }, traded: [...G.traded] });

const stages: Partial<Record<StageName, Stage>> = {};
let pendingWin: Parameters<typeof R.win>[0] | null = null;
export function registerStage(name: StageName, s: Stage): void { stages[name] = s; }

export function setStage(name: StageName): void {
  G.stage = name; G.t = 0; G.hits = 0; G.entry = snap();
  R.stageStart(name);
  setMusic(STAGE_MUSIC[name]);
  stages[name]!.enter();
}

export function stageDone(): void {
  if (G.ended) return;
  R.stageComplete(G.stage, G.score);
  const next = ORDER[ORDER.indexOf(G.stage) + 1];
  if (next) { R.flash(0.25); setStage(next); }
}

/** Fail → the lose screen (WASTED). reason picks the lose line (content.LOSE_LINES). */
export function fail(reason: string): void {
  if (G.ended) return;
  G.ended = true;
  R.shake(0.45); sfx.wasted?.();
  R.fail({ score: G.score, durationS: G.playT, stage: G.stage, reason });
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

// ---------- HUD (driving legs only): money, score, heat, letters, goal, fuel ----------
export function hud(goal: PlaceId | null, opts: { fuel?: boolean } = {}): void {
  ctx.fillStyle = 'rgba(12,8,20,.86)'; ctx.fillRect(0, -view.top, W, view.top + 50);
  ctx.fillStyle = C.pink; ctx.fillRect(0, 50, W, 2);
  ptxt('$' + Math.round(G.money), 10, 15, 2, C.money, 'left', '#0a2a12');
  ptxt(String(Math.round(G.score)).padStart(6, '0'), W / 2, 15, 2, C.ink, 'center', '#000');
  // heat meter + wanted stars
  txt('HEAT', 266, 9, 8, '#ff9ac8', 'left', 900);
  rr(266, 14, 84, 8, 2, 'rgba(255,255,255,.15)');
  const h = clamp(D.heat, 0, 1);
  if (h > 0.01) rr(266, 14, 84 * h, 8, 2, h > 0.66 ? '#ff3b3b' : h > 0.33 ? '#ff9a3a' : '#ffd23f');
  for (let i = 0; i < G.stars; i++) star(254 - i * 16, 15, Math.sin(state.t * 10) > 0 ? '#ffd23f' : '#fff6b0');
  // found letters, in password order
  const PW = 'WASTED';
  for (let i = 0; i < 6; i++) {
    const has = G.letters.includes(PW[i]!);
    rr(10 + i * 16, 28, 14, 17, 2, has ? 'rgba(255,63,164,.25)' : 'rgba(255,255,255,.08)');
    ptxt(has ? PW[i]! : '_', 17 + i * 16, 37, 1, has ? C.pink : '#777');
  }
  if (goal) {
    const g = PLACES[goal], d = Math.round(Math.hypot(g.x - D.p.x, g.y - D.p.y) / 2);   // 1 unit ≈ 0.5 m
    txt(`▶ ${placeLabel(goal)} ${d}m`, 116, 37, 11, C.yellow, 'left', 900);
  }
  // row 2, right: fuel gauge (quit branch, leg 2) or the sick note badge (sick branch, leg 2)
  if (opts.fuel) {
    const low = G.fuel < 0.3 && Math.sin(state.t * 8) > 0;
    txt('FUEL', 266, 31, 8, low ? C.red : '#cfcfcf', 'left', 900);
    rr(266, 36, 84, 8, 2, 'rgba(255,255,255,.15)'); rr(266, 36, 84 * clamp(G.fuel, 0, 1), 8, 2, G.fuel < 0.3 ? C.red : C.money);
  }
  if (G.note && G.stage === 'launch') { rr(262, 28, 90, 18, 4, '#fff6c9'); txt('SICK NOTE ✓', 307, 37, 10, '#1b4f8a', 'center', 900); }
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
  const a = Math.min(1, (until - G.t) * 2);
  ctx.globalAlpha = a; rr(16, 590, W - 32, 32, 12, 'rgba(12,8,20,.85)'); txt(s, W / 2, 606, 13, '#fff', 'center', 900); ctx.globalAlpha = 1;
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
  rr(40, 200, 280, 180, 12, '#2b2b33', '#555', 3); rr(54, 212, 252, 140, 6, '#120a24');
  if (Math.sin(state.t * 9) > -0.4) ptxt('PRESS START', W / 2, 282, 3, C.pink, 'center', '#3a0a2a');
  ptxt('SIX', W / 2, 238, 2, C.yellow);
  ctx.globalAlpha = 1;
}

onKeyDown((e) => { if (state.scene !== 'play' || G.ended) return false; return stages[G.stage]?.key?.(e) ?? false; });

export const playScene: Scene = {
  enter() {
    loadPortraits();
    const retry = R.retry;
    G.ended = false; G.outro = 0; pendingWin = null;
    if (retry?.stage && stages[retry.stage as StageName] && G.entry) {
      Object.assign(G, { ...G.entry, letters: [...G.entry.letters], traded: [...G.entry.traded], copPos: G.entry.copPos && { ...G.entry.copPos } });
      setStage(retry.stage as StageName);
    } else {
      Object.assign(G, { branch: null, store: null, traded: [], agreed: false, score: 0, money: START_MONEY, letters: [], note: false, fuel: 1, stars: 0, copPos: null, playT: 0, wrongPw: 0 });
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
    }
    stages[G.stage]!.render();
    if (G.outro > 0) endBeat();
  },
};

// debug hooks specific to this game (docs/CONTRACTS.md lists the template's)
const w = window as unknown as Record<string, unknown>;
w.__stage = (name: StageName, branch?: Branch, store?: StoreChoice) => { if (branch) G.branch = branch; if (store) G.store = store; if (stages[name]) setStage(name); };
w.__world = () => ({ stage: G.stage, branch: G.branch, store: G.store, score: Math.round(G.score), money: G.money, letters: G.letters.join(''), note: G.note, fuel: +G.fuel.toFixed(2), stars: G.stars, heat: +D.heat.toFixed(2), car: { x: Math.round(D.p.x), y: Math.round(D.p.y), v: Math.round(D.p.v) }, goal: D.goal, chasers: D.chasers.map((c) => ({ k: c.kind, d: Math.round(Math.hypot(c.x - D.p.x, c.y - D.p.y)) })), hr: D.hr ? Math.round(Math.hypot(D.hr.x - D.p.x, D.hr.y - D.p.y)) : null, npcs: D.npcs.length, maxV: MAX_V });
w.__stages = (): StageName[] => ORDER; // the story arc's stages in order (bugcheck playthrough)
/** Read-only view for the playthrough bot: the car and the point the GPS arrow aims at. */
w.__peek = () => ({ car: { x: D.p.x, y: D.p.y, a: D.p.a, v: D.p.v }, gps: D.goal ? gpsTarget(D.goal) : null, control: D.control && worldReady() });
/** Lose right now (the playthrough's forceLose: tests "retry from the stage" in every stage, even the ones you can't lose). */
w.__lose = () => fail('cop');
/** Put the HR minivan right next to the car (spotting test). */
w.__hrHere = () => {
  const hr = D.hr; if (!hr) return;
  const [i, j] = nodeOf(D.p.x, D.p.y), dx = D.p.x - roadLine(i), dy = D.p.y - roadLine(j);
  const hz = Math.abs(dx) > Math.abs(dy), sgn = Math.sign(hz ? dx : dy) || 1;
  hr.from = [i, j]; hr.to = hz ? [i + sgn, j] : [i, j + sgn]; hr.s = Math.max(0, Math.abs(hz ? dx : dy) - 12); hr.x = D.p.x - 12; hr.y = D.p.y;
};
/** Put the first chaser right next to the car (catch test). */
w.__chaserHere = () => { const c = D.chasers[0]; if (c) { c.x = D.p.x + 7.5; c.y = D.p.y; c.grace = 0; } };
/** Teleport the car next to the current goal (flow testing only). */
w.__warp = () => { if (!D.goal) return; const g = PLACES[D.goal]; D.p.x = g.x + 5; D.p.y = g.y; D.cam.x = D.p.x; D.cam.y = D.p.y; for (const c of D.chasers) { c.x = g.x + 100; c.y = g.y; c.grace = 3; } if (D.hr) { D.hr.from = [-6, -6]; D.hr.to = [-5, -6]; D.hr.s = 0; D.hr.x = roadLine(-6); D.hr.y = roadLine(-6); } };
