// The "go on" button of the full-screen moments (Nadav, 2026-11-18: the VS card, the mini-game how-to cards and LEVEL UP
// wait for a press instead of moving on by themselves). One solid yellow key in the middle of the column; it breathes
// while it waits, sinks when pressed. A tap on it, or Space / Enter, presses it; a tap beside it makes it twitch
// (RULES 13ד: a miss is answered too).
import { W, ctx, state, inBtn, rr, txt, sfx, easeOB, springOut, haptic, type Tap } from '@tsg/index';
import { C } from './art';

export const GO_W = 240, GO_H = 52;
const GO_PAD = 12;   // the hitbox is larger than the key (13י)
const B = { nopeT: -9, pressT: -9 };

/** Draws the button at height y; `age` = seconds since it appeared (it pops in). */
export function drawGo(label: string, y: number, age: number): void {
  if (age < 0) return;
  const k = easeOB(Math.min(1, age / 0.3)), breathe = 1 + 0.035 * Math.sin(state.t * 5);
  const nope = state.t - B.nopeT, sx = nope >= 0 && nope < 0.4 ? springOut(nope, 5, 40, 10) : 0;
  const down = state.t - B.pressT < 0.12;
  ctx.save(); ctx.translate(W / 2 + sx, y + (down ? 3 : 0)); ctx.scale(k * (down ? 0.96 : breathe), k * (down ? 0.96 : breathe));
  rr(-GO_W / 2, -GO_H / 2 + 4, GO_W, GO_H, 12, '#8a6a00');   // the key's hard lower edge
  rr(-GO_W / 2, -GO_H / 2, GO_W, GO_H, 12, C.yellow, '#0e0e10', 2.5);
  rr(-GO_W / 2 + 6, -GO_H / 2 + 4, GO_W - 12, 12, 6, 'rgba(255,255,255,.35)');
  txt(label + '  ▶', 0, 1, 19, '#0e0e10', 'center', 900);
  ctx.restore();
}
/** True when one of `taps` presses the button at height y (a key tap counts: Space / Enter). */
export function goPressed(taps: Tap[], y: number): boolean {
  for (const p of taps) {
    if (p.key || inBtn(p, W / 2, y, GO_W, GO_H, GO_PAD)) { B.pressT = state.t; sfx.ok?.(); haptic(15); return true; }
  }
  if (taps.length) B.nopeT = state.t;
  return false;
}
