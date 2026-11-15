// The play scene: one template scene that runs five stages (start → water → sun → wall → finish) along one course.
// Shared state G carries the distance (km) and the race clock across every stage; the HUD shows both all the time.
// Each stage sets G.f (speed factor, 1 = target pace); play.ts turns it into distance. The race clock always runs at
// the stage's fixed rate, so a slower runner spends more real time, and therefore more race time, on the same stretch.
// Race clock ≥ 3:00:00 → R.fail (the sweeper bus). Km 21.1 → R.win, score = seconds left before the cutoff.
import { R, W, SAFE_H as H, ctx, state, input, onKeyDown, rr, txt, clamp, sfx, type Scene } from '@tsg/index';
import { BANNERS, CUTOFF, fmtRace } from './content';
import './sfx';

export type StageName = 'start' | 'water' | 'sun' | 'wall' | 'finish';
export interface Stage {
  enter(): void;
  /** Logic + input; sets G.f. Not called while the template's stage banner pauses the game. */
  step(dt: number): void;
  render(): void;
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
  entry: { km: 0, raceT: 0 },
  ps: { x: 0, y: 0 },    // where the held pointer went down
  wasDown: false,
  t: 0,                  // seconds in the current stage
};
const stages: Partial<Record<StageName, Stage>> = {};
let retryEntry = { km: 0, raceT: 0 };

export function registerStage(name: StageName, s: Stage): void { stages[name] = s; }
/** 0..1 progress inside the current stage. */
export const segK = (): number => { const s = SEG[G.stage]; return clamp((G.km - s.from) / (s.to - s.from), 0, 1); };
/** Pixels per km for scrolling scenery at the current stage's pace. */
export const pxPerKm = (pxPerS: number): number => { const s = SEG[G.stage]; return (pxPerS * s.len) / (s.to - s.from); };

export function setStage(name: StageName): void {
  G.stage = name; G.km = SEG[name].from; G.entry = { km: G.km, raceT: G.raceT }; G.f = 1; G.t = 0;
  R.stageStart(name); const b = BANNERS[name]; R.banner(b[0], [...b[1]]);
  stages[name]!.enter();
}

function stageDone(name: StageName): void {
  if (G.ended) return;
  R.stageComplete(name, Math.round(CUTOFF - G.raceT));
  const i = ORDER.indexOf(name), next = ORDER[i + 1];
  if (!next) {
    G.ended = true; sfx.win?.();
    const finishT = G.raceT - (G.highFive ? 60 : 0);
    R.win({ score: clamp(Math.round(CUTOFF - finishT), 0, R.cfg.score.max), durationS: G.playT, stage: name, reason: G.highFive ? 'highfive' : 'nohighfive' });
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
  if (G.f > 1.05) txt('▲ ' + Math.round(G.f * 100) + '%', W / 2, 18, 12, '#3ddc84', 'center', 900);
  else if (G.f < 0.7) txt('▼ ' + Math.round(G.f * 100) + '%', W / 2, 18, 12, '#ff8a8a', 'center', 900);
}

/** Bottom hint strip used by the stages. */
export function hint(s: string, y = H - 34): void {
  rr(16, y - 16, W - 32, 32, 12, 'rgba(11,37,69,.78)');
  txt(s, W / 2, y, 13, '#ffffff', 'center', 900);
}

onKeyDown((e) => { if (state.scene !== 'play') return false; return stages[G.stage]?.key?.(e) ?? false; });

export const playScene: Scene = {
  enter() {
    const retry = R.retry;
    G.ended = false; G.wasDown = false;
    if (retry?.stage && stages[retry.stage as StageName]) { setStage(retry.stage as StageName); G.km = retryEntry.km; G.raceT = retryEntry.raceT; G.entry = { ...retryEntry }; }
    else { G.km = 0; G.raceT = 0; G.playT = 0; G.highFive = false; setStage('start'); }
  },
  draw(dt) {
    if (dt > 0 && !G.ended) {
      if (input.down && !G.wasDown) { G.ps.x = input.px; G.ps.y = input.py; }
      G.wasDown = input.down;
      G.playT += dt; G.t += dt;
      stages[G.stage]!.step(dt);
      const s = SEG[G.stage];
      G.km = Math.min(s.to, G.km + (Math.max(0.05, G.f) * (s.to - s.from) * dt) / s.len);
      G.raceT += (dt * (s.to - s.from) * PACE) / s.len;
      if (G.raceT >= CUTOFF) fail();
      else if (G.km >= s.to - 1e-6) stageDone(G.stage);
    }
    stages[G.stage]!.render();
    hud();
  },
};

// debug hooks specific to this game (docs/CONTRACTS.md lists the template's)
const w = window as unknown as Record<string, unknown>;
w.__stage = (name: StageName) => { if (stages[name]) setStage(name); };
w.__world = () => ({ stage: G.stage, km: +G.km.toFixed(3), raceT: Math.round(G.raceT), f: +G.f.toFixed(2), playT: +G.playT.toFixed(1), highFive: G.highFive });
w.__setRace = (sec: number) => { G.raceT = sec; };
