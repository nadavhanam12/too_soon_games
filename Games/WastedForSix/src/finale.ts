// The finale (Nadav, 2026-11-18: "after the password, a happier moment: it is the end of the game!"). Right after
// ACCESS GRANTED: a gold sunburst turns behind everything, fireworks burst across the screen, confetti shoots from both
// bottom corners, the VI case from the store (item.ts drawCase) flies up into the middle and lands with a bounce and a shine, GAME ON!
// stamps in over it with a line under it. A CONTINUE button (button.ts) leads on to LEVEL UP VI and the result.
// Everything is drawn from the clock (no particles kept), so it costs nothing when it is not up.
import { R, W, view, ctx, state, clamp, easeO, easeOB, pop, sfx, haptic, music, txt, type Tap } from '@tsg/index';
import { FINALE } from './content';
import { C } from './art';
import { ptxt } from './pixel';
import { drawCase } from './item';
import { drawGo, goPressed } from './button';

const CASE_AT = 0.35, CASE_LAND = 0.95, HEAD_AT = 1.15, LINE_AT = 1.5, GO_AT = 2.0;   // seconds into the finale
const GO_Y = 600;
const F = { t: -1, out: -1, fired: 0, then: (): void => {} };
const OUT_S = 0.3;

export function startFinale(then: () => void): void {
  Object.assign(F, { t: 0, out: -1, fired: 0, then });
  if (R.cfg.music !== false) music.set('theme');   // the opening tune comes back for the ending and carries into the result
}
export const finaleOn = (): boolean => F.t >= 0;
/** Off at once (the PC stage starts again: a retry). */
export function stopFinale(): void { F.t = -1; }
/** Read-only for the playthrough bot (__peek().moment): seconds into it, or null. */
export const finalePeek = (): number | null => (F.t < 0 ? null : +F.t.toFixed(1));
/** One step; true while it is up (it takes the taps). */
export function stepFinale(dt: number, taps: Tap[]): boolean {
  if (F.t < 0) return false;
  F.t += dt;
  const cue = (i: number, at: number, fn: () => void): void => { if (F.t >= at && !(F.fired & (1 << i))) { F.fired |= 1 << i; fn(); } };
  cue(0, 0, () => { sfx.item?.(); R.flash(0.5); haptic([30, 30, 30, 30, 120]); });
  cue(1, CASE_LAND, () => { sfx.smash?.(); R.shake(0.3); haptic(40); });
  cue(2, HEAD_AT, () => { sfx.levelPin?.(); });
  if (F.out < 0 && taps.length) {
    if (F.t < GO_AT) { F.t = GO_AT; F.fired |= 0b111; }   // a tap before the button skips to it
    else if (goPressed(taps, GO_Y)) F.out = 0;
  }
  if (F.out >= 0) { F.out += dt; if (F.out >= OUT_S) { F.t = -1; F.then(); } }
  return true;
}

const hash = (n: number): number => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const COLS = [C.yellow, '#ff6fa8', '#2fd1c8', '#ffffff', '#3ddc84', '#ff8a2f'];

export function renderFinale(): void {
  if (F.t < 0) return;
  const t = F.t, x0 = view.x0, y0 = -view.top, fw = view.fullW, fh = view.H, cx = x0 + fw / 2, cy = 280;
  const a = F.out >= 0 ? 1 - easeO(clamp(F.out / OUT_S, 0, 1)) : easeO(clamp(t / 0.25, 0, 1));
  if (F.out >= 0) { ctx.fillStyle = '#060608'; ctx.fillRect(x0, y0, fw, fh); }   // leaves to black: LEVEL UP comes from black
  ctx.save(); ctx.globalAlpha = a;
  // the backdrop: deep night to gold, a sunburst turning
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(fw, fh)); g.addColorStop(0, '#ffdf6b'); g.addColorStop(0.35, '#ff5a8a'); g.addColorStop(1, '#2a0f4a');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, fw, fh);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(state.t * 0.6);
  const R0 = Math.hypot(fw, fh);
  for (let i = 0; i < 20; i++) { if (i % 2) continue; ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R0, (i / 20) * Math.PI * 2, ((i + 1) / 20) * Math.PI * 2); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // fireworks: a burst every 0.35 s at a different place, each one a ring of sparks that spreads, falls and fades
  for (let k = Math.max(0, Math.floor((t - 1.6) / 0.35)); k <= Math.floor(t / 0.35); k++) {
    const age = t - k * 0.35; if (age < 0 || age > 1.6) continue;
    const bx = x0 + fw * (0.15 + 0.7 * hash(k)), by = y0 + 60 + (fh * 0.45) * hash(k + 9), col = COLS[k % COLS.length]!, r = 30 + 70 * easeO(clamp(age / 0.9, 0, 1));
    ctx.globalAlpha = a * clamp(1 - age / 1.6, 0, 1);
    for (let i = 0; i < 18; i++) { const an = (i / 18) * Math.PI * 2; ctx.fillStyle = i % 3 ? col : '#ffffff'; ctx.fillRect(bx + Math.cos(an) * r - 2, by + Math.sin(an) * r + 30 * age * age - 2, 4, 4); }
  }
  ctx.globalAlpha = a;
  // confetti cannons from both bottom corners
  for (let i = 0; i < 80; i++) {
    const side = i % 2 ? 1 : -1, born = (i % 40) * 0.05, age = t - born; if (age < 0) continue;
    const vx = -side * (120 + hash(i) * 160), vy = -(420 + hash(i + 3) * 260);
    const px = (side < 0 ? x0 : x0 + fw) + vx * age, py = y0 + fh + vy * age + 380 * age * age;
    if (py > y0 + fh + 20) continue;
    ctx.save(); ctx.translate(px, py); ctx.rotate(age * (5 + (i % 4)) + i); ctx.fillStyle = COLS[i % COLS.length]!; ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
  }
  // the case flies up into the middle, lands with a bounce, a shine sweeps across it
  if (t >= CASE_AT) {
    const u = clamp((t - CASE_AT) / (CASE_LAND - CASE_AT), 0, 1), land = t - CASE_LAND;
    const y = cy + (1 - easeOB(u)) * 420, s = land > 0 ? 1 + 0.12 * Math.exp(-land * 6) * Math.cos(land * 20) : 0.7 + 0.3 * u;
    const h = 250;
    ctx.save(); ctx.translate(cx, y); ctx.rotate(Math.sin(state.t * 2) * 0.04); ctx.scale(s, s);
    drawCase(h, land > 0 ? (land * 0.62) % 1 : 0, true);   // item.ts: the same case as ITEM ACQUIRED, its name on the band, its shine sweeping
    ctx.restore();
  }
  // GAME ON! stamps in over the case, the line under it
  if (t >= HEAD_AT) {
    const hs = (2.4 - 1.4 * easeOB(clamp((t - HEAD_AT) / 0.3, 0, 1))) * pop(t - HEAD_AT - 0.3, 0.25, 0.1) * (1 + 0.03 * Math.sin(state.t * 6));
    ctx.save(); ctx.translate(W / 2, 450); ctx.rotate(-0.06); ctx.scale(hs, hs);
    ptxt(FINALE.head, 0, 0, 7, C.yellow, 'center', '#3b1268');
    ctx.restore();
  }
  if (t >= LINE_AT) {
    ctx.globalAlpha = a * clamp((t - LINE_AT) / 0.3, 0, 1);
    txt(FINALE.line, W / 2, 512, 18, '#ffffff', 'center', 900);
    ctx.globalAlpha = a;
  }
  ctx.restore();
  drawGo(FINALE.go, GO_Y, t - GO_AT);
}
