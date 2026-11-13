// Scene registry, transitions and the per-scene scratch object S.
import { ctx, W, SAFE_H } from './canvas';
import { clearTaps } from './input';

export interface Scene {
  enter?(): void;
  draw(dt: number): void;
  exit?(): void;
}

export const scenes: Record<string, Scene> = {};
/** Scratch state for the current scene. Cleared on every scene change. */
export const S: Record<string, any> = {};

export const state = {
  scene: 'title',
  st: 0,     // seconds in the current scene
  t: 0,      // seconds since start
  shake: 0,
  flash: 0,
};

type Listener = (to: string, from: string) => void;
const listeners: Listener[] = [];
export function onSceneChange(fn: Listener): void { listeners.push(fn); }

let trans: { t: number } | null = null;
let pending: string | null = null;

export function has(name: string): boolean { return !!scenes[name]; }

/** Switch immediately (no wipe). */
export function goNow(name: string): void {
  if (!scenes[name]) { console.warn('no scene', name); return; }
  const from = state.scene;
  scenes[from]?.exit?.();
  for (const k of Object.keys(S)) delete S[k];
  state.scene = name; state.st = 0;
  clearTaps();
  for (const l of listeners) l(name, from); // listeners first (they hide overlays); enter() may then show its own
  scenes[name]?.enter?.();
}

/** Switch with a short wipe transition. */
export function go(name: string): void {
  if (pending === name || (trans && trans.t < 0.5)) return;
  pending = name; trans = { t: 0 };
}

export const easeO = (x: number): number => 1 - Math.pow(1 - x, 3);
export const easeOB = (x: number): number => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

/** Advance the transition clock; called by the main loop once per frame. */
export function stepTransition(rawDt: number): void {
  if (!trans) return;
  trans.t += rawDt / 0.5;
  if (trans.t >= 0.5 && pending) { goNow(pending); pending = null; }
  if (trans.t >= 1) trans = null;
}

/** Draw the wipe (in safe coords; covers the full height generously). */
export function drawTransition(color = '#111'): void {
  if (!trans) return;
  const p = trans.t < 0.5 ? trans.t * 2 : 1 - (trans.t - 0.5) * 2;
  ctx.fillStyle = color;
  ctx.fillRect(0, -200, W, (SAFE_H + 400) * easeO(p));
}
export const inTransition = (): boolean => !!trans;
