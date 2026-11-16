// The play scene: one template scene that runs five stages (start → water → sun → wall → finish) along one course.
// Shared state G carries the distance (km) and the race clock across every stage; the HUD shows both all the time.
// Each stage sets G.f (speed factor, 1 = target pace); play.ts turns it into distance. The race clock always runs at
// the stage's fixed rate, so a slower runner spends more real time, and therefore more race time, on the same stretch.
// Race clock ≥ 3:00:00 → R.fail (the sweeper bus). Km 21.1 → a FINISH moment (OUTRO_S, taps swallowed so the sprint
// mashing can't hit the result screen's buttons), then R.win, score = seconds left before the cutoff.
import { R, W, SAFE_H as H, ctx, state, input, onKeyDown, rr, txt, clamp, sfx, springOut, type Scene } from '@tsg/index';
import { BANNERS, CUTOFF, fmtRace } from './content';
import { confetti } from './art';
import './sfx';

export type StageName = 'start' | 'water' | 'sun' | 'wall' | 'finish';
export interface Stage {
  enter(): void;
  /** Logic + input; sets G.f. Not called while the template's stage banner pauses the game. */
  step(dt: number): void;
  render(): void;
  /** Read-only snapshot of the stage's state for the bugcheck playthrough bot (playthrough.mjs). */
  peek?(): unknown;
  /** Raw keydown while this stage runs; return true to swallow the key. */
  key?(e: KeyboardEvent): boolean;
}

/** Course segments: km from..to and the target real-time length (s) at G.f = 1. */
export const SEG: Record<StageName, { from: number; to: number; len: number }> = {
  start: { from: 0, to: 3, len: 15 },
  water: { from: 3, to: 8, len: 16 },
  sun: { from: 8, to: 15, len: 20 },
  wall: { from: 15, to: 19, len: 18 },
  finish: { from: 19, to: 21.1, len: 15 },
};
const ORDER: StageName[] = ['start', 'water', 'sun', 'wall', 'finish'];
const OUTRO_S = 1.6;      // the finish moment between crossing the line and the result screen
const PACE = 213;         // race seconds per km at G.f = 1 (≈ 1:15 half marathon)
export const TOTAL_KM = 21.1;

export const G = {
  stage: 'start' as StageName,
  km: 0,
  raceT: 0,              // race clock, seconds
  f: 1,                  // speed factor set by the stage
  playT: 0,              // real seconds in play (unpaused), across retries
  highFive: false,
  ended: false,
  outro: 0,              // seconds left in the finish moment (taps are swallowed, then R.win)
  entry: { km: 0, raceT: 0 },
  ps: { x: 0, y: 0 },    // where the held pointer went down
  wasDown: false,
  t: 0,                  // seconds in the current stage
  hintUntil: 0,          // the bottom hint shows for the first 3 s of a stage, and again for 2.5 s after a mistake
  tag: '',               // what powers the current boost, shown in the HUD ("GYROS POWER")
  sayT: -9,              // last toast (rate limit)
  sqA: 0, sqT: 9,        // the runner's squash spring: kick size and seconds since the kick (impact())
};
const stages: Partial<Record<StageName, Stage>> = {};
let retryEntry = { km: 0, raceT: 0 };
let pendingWin: Parameters<typeof R.win>[0] | null = null;

/** Kick the runner's squash spring (UX-ANIMATION-RULES ת3): a > 0 squashes (hit, landing), a < 0 stretches (burst).
 *  The spring overshoots the other way and settles, which is the follow-through. */
export function impact(a: number): void { G.sqA = a; G.sqT = 0; }
/** The runner's squash right now: the spring, plus a constant stretch while boosted. Pass it to runnerSide/runnerBack. */
export const runnerSq = (): number => springOut(G.sqT, G.sqA) - (G.f > 1.15 ? 0.06 : 0);
/** A big moment (ת6): freeze a few frames, shake, flash. Small moments only get impact() and a sound. */
export function bigHit(sq = 0.4): void { R.hitStop(0.07); R.shake(0.3); R.flash(0.18); impact(sq); }

export function registerStage(name: StageName, s: Stage): void { stages[name] = s; }
/** 0..1 progress inside the current stage. */
export const segK = (): number => { const s = SEG[G.stage]; return clamp((G.km - s.from) / (s.to - s.from), 0, 1); };
/** Pixels per km for scrolling scenery at the current stage's pace. */
export const pxPerKm = (pxPerS: number): number => { const s = SEG[G.stage]; return (pxPerS * s.len) / (s.to - s.from); };

export function setStage(name: StageName): void {
  G.stage = name; G.km = SEG[name].from; G.entry = { km: G.km, raceT: G.raceT }; G.f = 1; G.t = 0; G.hintUntil = 0; G.tag = '';
  R.stageStart(name); const b = BANNERS[name]; R.banner(b[0], [...b[1]]);
  stages[name]!.enter();
}

function stageDone(name: StageName): void {
  if (G.ended) return;
  R.stageComplete(name, Math.round(CUTOFF - G.raceT));
  const i = ORDER.indexOf(name), next = ORDER[i + 1];
  if (!next) {
    G.ended = true; G.outro = OUTRO_S; sfx.win?.(); R.flash(0.35);
    const finishT = G.raceT - (G.highFive ? 60 : 0);
    pendingWin = { score: clamp(Math.round(CUTOFF - finishT), 0, R.cfg.score.max), durationS: G.playT, stage: name, reason: G.highFive ? 'highfive' : 'nohighfive' };
    return;
  }
  R.flash(0.25); sfx.ok?.();
  setStage(next);
}

function fail(): void {
  if (G.ended) return;
  G.ended = true;
  // a retry restarts this stretch with at least 25 race-minutes left on the clock
  retryEntry = { km: G.entry.km, raceT: Math.min(G.entry.raceT, CUTOFF - 1500) };
  sfx.lose?.(); R.shake(0.4);
  R.fail({ score: 0, durationS: G.playT, stage: G.stage, reason: 'cutoff' });
}

// ---------- HUD: distance + race clock + course bar, on every stage ----------
export function hud(): void {
  rr(0, 0, W, 50, 0, 'rgba(11,37,69,.82)');
  txt(G.km.toFixed(1), 12, 18, 20, '#ffffff', 'left', 900);
  txt('/ 21.1 km', 12 + G.km.toFixed(1).length * 11 + 6, 19, 12, '#cfe3f5', 'left', 700);
  const late = G.raceT > CUTOFF - 1800;
  txt(fmtRace(G.raceT), W - 12, 18, 18, late ? '#ff6a6a' : '#ffd23f', 'right', 900);
  // course bar with a tick per km and the five stretches
  const x0 = 12, x1 = W - 12, y = 38, k = clamp(G.km / TOTAL_KM, 0, 1);
  rr(x0, y - 4, x1 - x0, 8, 4, 'rgba(255,255,255,.18)');
  rr(x0, y - 4, (x1 - x0) * k, 8, 4, '#ff8a00');
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  for (let km = 1; km < 21; km++) ctx.fillRect(x0 + ((x1 - x0) * km) / TOTAL_KM - 0.5, y - 2, 1, 4);
  for (const n of ORDER) { const xs = x0 + ((x1 - x0) * SEG[n].from) / TOTAL_KM; ctx.fillStyle = '#ffffff'; ctx.fillRect(xs - 1, y - 6, 2, 12); }
  ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y, 6, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  if (G.ended) return;
  if (G.f > 1.05) txt('▲ ' + (G.tag || Math.round(G.f * 100) + '%'), W / 2 + 6, 18, 12, '#3ddc84', 'center', 900);
  else if (G.f < 0.7) txt('▼ ' + Math.round(G.f * 100) + '%', W / 2, 18, 12, '#ff8a8a', 'center', 900);
}

/** "FINISH!" over the course while the finish moment runs, so the player sees the race is over and stops tapping. */
function finishMoment(): void {
  const k = clamp((OUTRO_S - G.outro) / 0.25, 0, 1), sc = 0.6 + 0.4 * k + Math.sin(G.t * 10) * 0.03;
  confetti(G.t * 3, 50, 60, H - 120);
  ctx.save(); ctx.translate(W / 2, H * 0.36); ctx.scale(sc, sc); ctx.globalAlpha = k;
  rr(-140, -44, 280, 88, 18, '#ff8a00', '#0b2545', 4);
  txt('FINISH!', 0, -6, 44, '#ffffff', 'center', 900);
  txt('21.1 km · ' + fmtRace(G.raceT), 0, 28, 14, '#0b2545', 'center', 900);
  ctx.restore();
}

/** Toast with a rate limit, so jokes don't pile up. `force` for the lines that explain a penalty. */
export function say(text: string, life = 1.4, force = false): void {
  if (!force && G.playT - G.sayT < 2.5) return;
  G.sayT = G.playT; R.say(text, life);
}
/** Show the bottom hint again for a moment (after a mistake). */
export function nudge(): void { G.hintUntil = G.t + 2.5; }

/** Bottom hint strip: only in the first 3 s of a stage, or right after a mistake. */
export function hint(s: string, y = H - 34): void {
  if (G.ended) return;
  if (G.t > 3 && G.t > G.hintUntil) return;
  rr(16, y - 16, W - 32, 32, 12, 'rgba(11,37,69,.78)');
  txt(s, W / 2, y, 13, '#ffffff', 'center', 900);
}

/** A pointing hand that shows the gesture for the first seconds of a stage (instead of more text). */
export function demo(kind: 'swipe' | 'tap' | 'hold' | 'alt', x: number, y: number): void {
  if (G.t > 2.6 || G.ended) return;
  const t = G.t, a = Math.min(1, (2.6 - t) * 2);
  ctx.save(); ctx.globalAlpha = a;
  let dx = 0, dy = 0, press = false;
  if (kind === 'swipe') dx = Math.sin(t * 4) * 50;
  else if (kind === 'tap') { press = (t * 2.5) % 1 < 0.35; dy = press ? 6 : 0; }
  else if (kind === 'hold') { press = true; dy = 6; }
  else { dx = (Math.floor(t * 3) % 2 ? 1 : -1) * 70; press = (t * 3) % 1 < 0.4; dy = press ? 6 : 0; }
  if (press) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + dx, y - 22, 16 + ((t * 6) % 1) * 10, 0, Math.PI * 2); ctx.stroke(); }
  txt('☝', x + dx, y + dy, 40, '#ffffff', 'center', 400);
  ctx.restore();
}

onKeyDown((e) => { if (state.scene !== 'play') return false; return stages[G.stage]?.key?.(e) ?? false; });

export const playScene: Scene = {
  enter() {
    const retry = R.retry;
    G.ended = false; G.wasDown = false; G.outro = 0; pendingWin = null; G.sqA = 0;
    if (retry?.stage && stages[retry.stage as StageName]) { setStage(retry.stage as StageName); G.km = retryEntry.km; G.raceT = retryEntry.raceT; G.entry = { ...retryEntry }; }
    else { G.km = 0; G.raceT = 0; G.playT = 0; G.highFive = false; setStage('start'); }
  },
  draw(dt) {
    if (dt > 0 && !G.ended) {
      if (input.down && !G.wasDown) { G.ps.x = input.px; G.ps.y = input.py; }
      G.wasDown = input.down;
      G.playT += dt; G.t += dt; G.sqT += dt;
      stages[G.stage]!.step(dt);
      const s = SEG[G.stage];
      G.km = Math.min(s.to, G.km + (Math.max(0.05, G.f) * (s.to - s.from) * dt) / s.len);
      G.raceT += (dt * (s.to - s.from) * PACE) / s.len;
      if (G.raceT >= CUTOFF) fail();
      else if (G.km >= s.to - 1e-6) stageDone(G.stage);
    } else if (dt > 0 && G.outro > 0) {
      // the finish moment: the runner slows down under the arch, every tap is swallowed
      input.taps.length = 0;
      G.t += dt; G.sqT += dt; G.f = Math.max(0.25, G.f - dt * 1.2);
      G.outro -= dt;
      if (G.outro <= 0 && pendingWin) { const w = pendingWin; pendingWin = null; R.win(w); }
    }
    stages[G.stage]!.render();
    hud();
    if (G.outro > 0) finishMoment();
  },
};

// debug hooks specific to this game (docs/CONTRACTS.md lists the template's)
const w = window as unknown as Record<string, unknown>;
w.__stage = (name: StageName) => { if (stages[name]) setStage(name); };
w.__stages = (): StageName[] => ORDER; // the story arc's stages in order (bugcheck playthrough)
w.__peek = () => stages[G.stage]?.peek?.();
w.__world = () => ({ stage: G.stage, km: +G.km.toFixed(3), raceT: Math.round(G.raceT), f: +G.f.toFixed(2), playT: +G.playT.toFixed(1), highFive: G.highFive });
w.__setRace = (sec: number) => { G.raceT = sec; };
