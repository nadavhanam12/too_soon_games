// Taps, keys and one held pointer, all in safe-zone logical coordinates.
// Space/arrows always preventDefault (rule 13). A game may intercept pointer-downs (e.g. a jump button).
import { cv, toSafe, W } from './canvas';

export interface Tap { x: number; y: number; key?: boolean }

export const input = {
  taps: [] as Tap[],
  down: false,          // a pointer is held
  px: 0, py: 0,         // held pointer position
  keys: {} as Record<string, boolean>,
  movePid: null as number | null,
};

type Intercept = (p: Tap, e: PointerEvent) => boolean;
type KeyHook = (e: KeyboardEvent) => boolean | void;
let intercept: Intercept | null = null;
const keyHooks: KeyHook[] = [];

/** Set a pointer-down interceptor; return true to swallow the event (not a tap, not a hold). */
export function setPointerIntercept(fn: Intercept | null): void { intercept = fn; }
/** Add a keydown hook; return true to swallow the key (it will not become a tap). */
export function onKeyDown(fn: KeyHook): void { keyHooks.push(fn); }

export function initInput(): void {
  cv.addEventListener('pointerdown', (e) => {
    const p = toSafe(e.clientX, e.clientY);
    try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (intercept && intercept(p, e)) return;
    input.movePid = e.pointerId; input.down = true; input.px = p.x; input.py = p.y;
    input.taps.push(p);
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerId !== input.movePid) return;
    const p = toSafe(e.clientX, e.clientY); input.px = p.x; input.py = p.y;
  });
  const end = (e: PointerEvent) => { if (e.pointerId === input.movePid) { input.down = false; input.movePid = null; } };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
    if (e.repeat) return;
    input.keys[e.key] = true;
    for (const h of keyHooks) if (h(e)) return;
    if ([' ', 'Enter', 'ArrowUp', 'w', 'W'].includes(e.key)) input.taps.push({ x: W / 2, y: 320, key: true });
  });
  window.addEventListener('keyup', (e) => { input.keys[e.key] = false; });
  window.addEventListener('blur', () => { input.keys = {}; input.down = false; input.movePid = null; });
}

/** Take the first pending tap and drop the rest (one tap per frame is enough for UI). */
export function takeTap(): Tap | null {
  const p = input.taps.shift() ?? null;
  input.taps.length = 0;
  return p;
}
export function clearTaps(): void { input.taps.length = 0; }
export const keyHeld = (...names: string[]): boolean => names.some((n) => !!input.keys[n]);
export const keyLeft = (): boolean => keyHeld('ArrowLeft', 'a', 'A');
export const keyRight = (): boolean => keyHeld('ArrowRight', 'd', 'D');
