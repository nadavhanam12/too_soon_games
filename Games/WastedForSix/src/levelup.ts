// LEVEL UP (Nadav, 2026-11-18): a happy full-screen moment that says the graphics just got better. Shown after each
// conversation's Continue, before the montage fills in (boss → III, clerk → IV, fiancée → V), and after the right
// password, before the end screen (→ VI). An axis of five stops, II III IV V VI: the pin rides from the stop you were
// on to the new one, which pops and lights up. The drives really do look better after the boss (look 3) and the clerk
// (look 4, drive.ts D.look); V and VI are the joke that carries it to the end.
import { W, view, ctx, state, rr, txt, wrap, clamp, sfx, easeO, easeOB, pop, haptic, R, type Tap } from '@tsg/index';
import { LEVELUP } from './content';
import { C } from './art';
import { ptxt } from './pixel';
import { drawGo, goPressed } from './button';
import { G } from './play';

// It waits for its CONTINUE button (Nadav, 2026-11-18; it went on by itself after 3.6 s). A tap before the button is up
// skips to the pin's landing.
/** When upgrade line i pops in, and when the button comes (after the last line). */
const upAt = (i: number): number => PIN_AT + 0.2 + i * 0.3;
const goAt = (): number => upAt(Math.max(0, (LEVELUP.ups[L.lvl]?.length ?? 1) - 1)) + 0.35;
const LU_GO_Y = 604;
const SPIN = 1.1;                 // rad/s of the background's spin (0.25 before 2026-11-18: Nadav wanted it to move)
const LU_OUT_S = 0.3;
const HEAD_AT = 0.12, PIN_FROM = 0.65, PIN_AT = 1.35;   // LEVEL UP! slams in · the pin leaves · the pin lands
const L = { t: -1, out: -1, lvl: 1, fired: 0, then: (): void => {} };

/** Start it. `lvl` = the stop reached (1 = III … 4 = VI); `then` runs when it has faded out. */
export function startLevelUp(lvl: number, then: () => void): void { Object.assign(L, { t: 0, out: -1, lvl, fired: 0, then }); }
export const levelUpOn = (): boolean => L.t >= 0;
/** Off at once without running `then` (a new stage starts: a retry, a lose mid-moment). */
export function stopLevelUp(): void { L.t = -1; }
/** Read-only for the playthrough bot (__peek): seconds into it, or null. */
export const levelUpPeek = (): number | null => (L.t < 0 ? null : +L.t.toFixed(1));
/** One step; true while it is up (the caller does nothing else and the taps are taken here). */
export function stepLevelUp(dt: number, taps: Tap[]): boolean {
  if (L.t < 0) return false;
  L.t += dt;
  const cue = (i: number, at: number, fn: () => void): void => { if (L.t >= at && !(L.fired & (1 << i))) { L.fired |= 1 << i; fn(); } };
  cue(0, HEAD_AT, () => { sfx.levelUp?.(); R.flash(0.35); haptic([20, 30, 20, 30, 50]); });
  (LEVELUP.ups[L.lvl] ?? []).forEach((_, i) => cue(2 + i, upAt(i), () => { sfx.levelPin?.(); haptic(10); }));
  cue(1, PIN_AT, () => { sfx.levelPin?.(); R.shake(0.15); haptic(25); G.gfx = L.lvl; });   // the corner badge (play.ts) changes as the pin lands
  if (L.out < 0 && taps.length) {
    if (L.t < goAt()) { L.t = goAt(); L.fired |= ~0b10; }   // skip to the end: every line is in; the pin still lands (cue 1 sets the level)
    else if (goPressed(taps, LU_GO_Y)) L.out = 0;
  }
  if (L.out >= 0) { L.out += dt; if (L.out >= LU_OUT_S) { L.t = -1; L.then(); } }
  return true;
}

export function renderLevelUp(): void {
  if (L.t < 0) return;
  const t = L.t, x0 = view.x0, y0 = -view.top, fw = view.fullW, fh = view.H, cx = x0 + fw / 2, cy = 250;
  const a = L.out >= 0 ? 1 - easeO(clamp(L.out / LU_OUT_S, 0, 1)) : easeO(clamp(t / 0.2, 0, 1));
  // it leaves to black, not to the conversation under it: the montage comes in from black (Nadav, 2026-11-18: a second of
  // the old boss showed between the two)
  if (L.out >= 0) { ctx.fillStyle = '#060608'; ctx.fillRect(x0, y0, fw, fh); }
  ctx.save(); ctx.globalAlpha = a;
  // a warm, happy backdrop: purple to pink, a yellow sunburst turning slowly behind the words
  const g = ctx.createLinearGradient(0, y0, 0, y0 + fh); g.addColorStop(0, '#3b1268'); g.addColorStop(0.6, '#b0246e'); g.addColorStop(1, '#ff7a2f');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, fw, fh);
  // the background spins (Nadav, 2026-11-18: happy and exciting): two sunbursts turning against each other, fast at
  // first and settling to a lively spin, and rings pulsing out from the middle on the beat
  const spin = state.t * SPIN + 3.2 * (1 - Math.exp(-t * 1.6)), R0 = Math.hypot(fw, fh);
  for (const [dir, n, col, col2] of [[1, 16, 'rgba(255,204,0,.2)', 'rgba(255,255,255,.05)'], [-0.6, 10, 'rgba(255,111,168,.12)', 'rgba(0,0,0,0)']] as const) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin * dir);
    for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? col : col2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R0, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  for (let i = 0; i < 3; i++) {
    const ph = ((state.t * 1.4 + i / 3) % 1), r = 40 + ph * 320;
    ctx.strokeStyle = `rgba(255,236,150,${0.35 * (1 - ph)})`; ctx.lineWidth = 6 * (1 - ph) + 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  // confetti: falls from the top once LEVEL UP! lands (fixed paths per piece, no random numbers in the game stream)
  if (t > HEAD_AT) {
    const ct = t - HEAD_AT, cols = [C.yellow, '#2fd1c8', '#ffffff', '#ff6fa8', '#3ddc84'];
    for (let i = 0; i < 46; i++) {
      const px = x0 + ((i * 73.7) % fw), vy = 160 + (i * 37) % 140, py = y0 - 20 + ct * vy - 60 * ((i * 13) % 5), sway = Math.sin(ct * 4 + i) * 14;
      if (py > y0 + fh || py < y0 - 30) continue;
      ctx.save(); ctx.translate(px + sway, py); ctx.rotate(ct * (3 + (i % 4)) + i); ctx.fillStyle = cols[i % cols.length]!; ctx.fillRect(-4, -2, 8, 4); ctx.restore();
    }
  }
  // LEVEL UP!: slams down from big, then bounces gently
  if (t >= HEAD_AT) {
    const h = t - HEAD_AT, s = (2.4 - 1.4 * easeOB(clamp(h / 0.3, 0, 1))) * (1 + 0.04 * Math.sin(state.t * 6));
    ctx.save(); ctx.translate(W / 2, 170); ctx.rotate(-0.05 + 0.02 * Math.sin(state.t * 3)); ctx.scale(s, s);
    ptxt(LEVELUP.head, 0, 0, 6, C.yellow, 'center', '#3b1268');   // 6 px blocks: 318 wide, inside the 360 column (7 was cut at the edges)
    ctx.restore();
  }
  // the axis: GRAPHICS  II · III · IV · V · VI
  const pk = easeOB(clamp((t - 0.35) / 0.3, 0, 1));
  if (pk > 0) {
    const n = LEVELUP.stops.length, ax0 = 50, ax1 = W - 50, step = (ax1 - ax0) / (n - 1), X = (i: number): number => ax0 + i * step, ay = 330;
    ctx.save(); ctx.translate(W / 2, ay); ctx.scale(pk, pk); ctx.translate(-W / 2, -ay);
    rr(18, ay - 58, W - 36, 116, 14, 'rgba(14,14,16,.88)', C.yellow, 2);
    ptxt(LEVELUP.label, W / 2, ay - 40, 2, '#ffffff');
    // the pin rides from the old stop to the new one
    const ride = easeO(clamp((t - PIN_FROM) / (PIN_AT - PIN_FROM), 0, 1)), at = L.lvl - 1 + ride, mx = X(at), landed = t >= PIN_AT;
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(mx, ay); ctx.lineTo(ax1, ay); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ax0, ay); ctx.lineTo(mx, ay); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const done = i < L.lvl || (i === L.lvl && landed), fresh = i === L.lvl && landed, age = t - PIN_AT;
      const r = (fresh ? 13 : 9) * (fresh ? pop(age, 0.3, 0.5) : 1);
      if (fresh) { const glow = 0.5 + 0.5 * Math.sin(state.t * 8); ctx.fillStyle = `rgba(255,204,0,${0.25 + 0.25 * glow})`; ctx.beginPath(); ctx.arc(X(i), ay, r + 10, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.arc(X(i), ay, r, 0, Math.PI * 2); ctx.fillStyle = done ? C.yellow : '#1c1c22'; ctx.fill(); ctx.strokeStyle = done ? '#0e0e10' : '#8a8a92'; ctx.lineWidth = 2; ctx.stroke();
      const lab = LEVELUP.stops[i]!, ls = fresh ? 3 * pop(age, 0.3, 0.4) : 2;
      ptxt(lab, X(i), ay + 34, ls, fresh ? C.yellow : done ? '#ffffff' : '#8a8a92', 'center', '#000');
    }
    // you: a red pin over the line
    ctx.fillStyle = C.red; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, ay - 12); ctx.lineTo(mx - 8, ay - 26); ctx.lineTo(mx + 8, ay - 26); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // what changed, once the pin has landed: one upgrade per line, each with its own green UP mark, popping in one after
  // another (Nadav, 2026-11-18)
  LEVELUP.ups[L.lvl]?.forEach((line, i) => {
    const at = upAt(i); if (t < at) return;
    const k = easeOB(clamp((t - at) / 0.25, 0, 1)), y = 420 + i * 36;
    ctx.save(); ctx.globalAlpha = a * clamp((t - at) / 0.15, 0, 1); ctx.translate(48, y); ctx.scale(k, k);
    rr(0, -13, 52, 26, 6, '#3ddc84', '#0e0e10', 2);
    ctx.fillStyle = '#0e0e10'; ctx.beginPath(); ctx.moveTo(9, 6); ctx.lineTo(15, -6); ctx.lineTo(21, 6); ctx.closePath(); ctx.fill();
    ptxt(LEVELUP.upTag, 36, 0, 2, '#0e0e10');
    txt(line, 64, 1, 18, '#ffffff', 'left', 900);
    ctx.restore();
  });
  drawGo(LEVELUP.go, LU_GO_Y, t - goAt());
  ctx.restore();
}
