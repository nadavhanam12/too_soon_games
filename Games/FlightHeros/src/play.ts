// The play scene: one template scene that runs five stages (run → door → cockpit → tie → tied → fly).
// Shared state G: score, per-stage score, altitude (bleeds 70 ft/s while the cockpit is lost), the held pointer's start.
// Altitude 0 → R.fail (lose screen, retry from this stage). Stage 5 stabilised → R.win.
import { R, S, W, SAFE_H as H, ctx, state, input, onKeyDown, rr, txt, fmtInt, sfx, type Scene } from '@tsg/index';
import { BANNERS, STAGE_NAMES } from './content';
import './sfx';

export type StageName = 'run' | 'door' | 'cockpit' | 'tie' | 'tied' | 'fly';
export interface Stage {
  enter(): void;
  /** Logic + input. Not called while the template's stage banner pauses the game. */
  step(dt: number): void;
  render(): void;
  /** Raw keydown while this stage runs; return true to swallow the key. */
  key?(e: KeyboardEvent): boolean;
}

export const G = {
  stage: 'run' as StageName,
  score: 0,
  stageScore: {} as Partial<Record<StageName, number>>,
  alt: 34000,
  altUp: null as boolean | null,   // null = no arrow, true = climbing, false = sinking (stage 5)
  altEntry: 34000,                 // altitude when the current stage began (retry restores max(4000, this))
  playT: 0,                        // seconds since the first scream, across retries
  ended: false,
  ps: { x: 0, y: 0 },              // where the held pointer went down
  wasDown: false,
  sh: () => (state.shake > 0 ? (Math.random() - 0.5) * 10 : 0),
};
const DROP: ReadonlySet<StageName> = new Set(['run', 'door', 'cockpit', 'tie', 'tied']);
const NEXT: Record<StageName, StageName | null> = { run: 'door', door: 'cockpit', cockpit: 'tie', tie: 'tied', tied: 'fly', fly: null };
const stages: Partial<Record<StageName, Stage>> = {};
let retryAlt = 34000;

export function registerStage(name: StageName, s: Stage): void { stages[name] = s; }

export function setStage(name: StageName): void {
  G.stage = name; G.altEntry = G.alt; G.altUp = null;
  if (name !== 'tied') { R.stageStart(name); const b = BANNERS[name]; R.banner(b[0], [...b[1]]); }
  stages[name]!.enter();
}

/** A stage is done: bank its score, move on (or win after the last one). */
export function stageDone(name: StageName, sc: number): void {
  if (G.ended) return;
  G.stageScore[name] = sc; G.score += sc;
  if (name !== 'tied') R.stageComplete(name, sc);
  const next = NEXT[name];
  if (!next) { G.ended = true; G.altUp = null; sfx.win?.(); R.win({ score: G.score, durationS: G.playT, stage: name }); return; }
  R.flash(0.3);
  setStage(next);
}

function fail(): void {
  if (G.ended) return;
  G.ended = true; G.alt = 0; retryAlt = Math.max(4000, G.altEntry);
  sfx.lose?.(); state.shake = Math.max(state.shake, 0.4);
  R.fail({ score: G.score, durationS: G.playT, stage: G.stage, reason: 'altitude' });
}

// ---------- HUD ----------
export function altChip(x: number, y: number, sc = 1): void {
  const a = Math.max(0, Math.round(G.alt / 100) * 100), low = G.alt < 10000;
  const bg = G.altUp === null ? (low ? 'rgba(255,59,59,.45)' : 'rgba(255,255,255,.1)') : G.altUp ? 'rgba(61,220,132,.3)' : 'rgba(255,59,59,.45)';
  const fg = G.altUp === null ? (low ? '#ff8a8a' : '#ffe08a') : G.altUp ? '#3ddc84' : '#ff6a6a';
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); rr(-58, -12, 116, 24, 12, bg);
  txt((G.altUp === null ? '' : G.altUp ? '▲ ' : '▼ ') + fmtInt(a) + ' רגל', 0, 0, 13, fg, 'center', 900); ctx.restore();
}
export function hud(): void {
  rr(0, 0, W, 34, 0, 'rgba(0,0,0,.35)');
  txt('ניקוד ' + fmtInt(G.score), 10, 17, 14, '#ffb400', 'left', 900);
  altChip(W - 63, 17);
}
/** Dark caption strip used by several stages. */
export function strip(y: number, h: number, big: string, small?: string, bigCol = '#fff'): void {
  rr(16, y, W - 32, h, 14, 'rgba(15,26,43,.82)');
  txt(big, W / 2, y + (small ? 21 : h / 2), small ? 17 : 15, bigCol, 'center', 900);
  if (small) txt(small, W / 2, y + 45, 12, '#cfd8e6', 'center', 400);
}

onKeyDown((e) => { if (state.scene !== 'play') return false; return stages[G.stage]?.key?.(e) ?? false; });

export const playScene: Scene = {
  enter() {
    const retry = R.retry;
    G.ended = false; G.stageScore = {}; G.wasDown = false; G.altUp = null;
    if (retry?.stage && stages[retry.stage as StageName]) { G.score = retry.score; G.alt = retryAlt; setStage(retry.stage as StageName); }
    else { G.score = 0; G.alt = 34000; G.playT = 0; setStage('run'); }
  },
  draw(dt) {
    const paused = dt === 0;
    if (!paused) {
      if (input.down && !G.wasDown) { G.ps.x = input.px; G.ps.y = input.py; }
      G.wasDown = input.down;
      G.playT += dt;
      if (DROP.has(G.stage)) G.alt -= 70 * dt;
      if (G.alt <= 0) fail();
      if (!G.ended) stages[G.stage]!.step(dt);
    }
    stages[G.stage]!.render();
    hud();
  },
};

// debug hooks specific to this game (docs/CONTRACTS.md lists the template's)
const w = window as unknown as Record<string, unknown>;
w.__setAlt = (v: number) => { G.alt = v; };
w.__stage = (name: StageName) => { if (stages[name]) setStage(name); };
w.__world = () => ({ stage: G.stage, score: G.score, alt: G.alt, playT: G.playT, stageScore: { ...G.stageScore } });
void S; void H; void STAGE_NAMES;
