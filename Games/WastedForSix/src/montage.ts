// The character montage: four slanted panels (you, the boss, the clerk, your fiancee) with the neon logo on top of
// them. It fills up during the run: after each conversation the montage is shown and that character fades into its
// panel. The full montage is the result screen's art and the picture that goes out with a share.
// Every panel uses the character's first (idle) portrait; yours is the driveway painting.
import { W, view, ctx, rr, txt, clamp, easeO, easeOB, R, drawOn } from '@tsg/index';
import { C } from './art';
import { ptxt } from './pixel';
import { portraitImg, portraitSticker, type PortraitId, type Who } from './portraits';
import { drawLogo, sceneImg } from './opening';
import { BOSS, CLERK, FIANCEE, UI } from './content';

type Face = 'you' | Who;
type Pt = readonly [number, number];
/** The slanted line where the top and the bottom panels meet (under the logo), in 0..1 of the montage's box. */
const mid = (u: number): number => 0.525 - 0.05 * u;
const TOP_X = 0.544, MID_X = 0.489, BOT_X = 0.533;   // where the vertical gutter crosses the top edge / the middle line / the bottom edge
// fx, fy: the point of the picture kept in the middle of the panel (the faces stay clear of the logo); zoom: over "cover"
const SLOTS_TALL: ReadonlyArray<{ who: Face; top: boolean; left: boolean; poly: readonly Pt[]; fx: number; fy: number; zoom: number }> = [
  { who: 'you', top: true, left: true, poly: [[0, 0], [TOP_X, 0], [MID_X, mid(MID_X)], [0, mid(0)]], fx: 0.36, fy: 0.5, zoom: 1.12 },
  { who: 'boss', top: true, left: false, poly: [[TOP_X, 0], [1, 0], [1, mid(1)], [MID_X, mid(MID_X)]], fx: 0.45, fy: 0.5, zoom: 1 },
  { who: 'clerk', top: false, left: true, poly: [[0, mid(0)], [MID_X, mid(MID_X)], [BOT_X, 1], [0, 1]], fx: 0.43, fy: 0, zoom: 1.3 },
  { who: 'fiancee', top: false, left: false, poly: [[MID_X, mid(MID_X)], [1, mid(1)], [1, 1], [BOT_X, 1]], fx: 0.34, fy: 0, zoom: 1.45 },
];
// A wide box (tablet on its side, desktop): the same four, side by side as slanted columns. The portraits are upright
// (3:4), so in the 2 x 2 grid stretched wide their heads and chins were cut off.
const WX = [0, 0.27, 0.52, 0.77, 1], WB = [0, 0.23, 0.48, 0.73, 1];   // the gutters' x on the top / bottom edge
const wideSlot = (i: number, who: Face, fx: number): (typeof SLOTS_TALL)[number] =>
  ({ who, top: i % 2 === 0, left: i < 2, poly: [[WX[i]!, 0], [WX[i + 1]!, 0], [WB[i + 1]!, 1], [WB[i]!, 1]], fx, fy: 0.5, zoom: 1.04 });
const SLOTS_WIDE = [wideSlot(0, 'you', 0.36), wideSlot(1, 'boss', 0.45), wideSlot(2, 'clerk', 0.43), wideSlot(3, 'fiancee', 0.34)];
const NAME: Record<Face, string> = { you: UI.you, boss: BOSS.name, clerk: CLERK.name, fiancee: FIANCEE.name };
const INK = '#060608';

function trace(p: readonly Pt[]): void { ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
function box(p: readonly Pt[]): { x: number; y: number; w: number; h: number } {
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
const picOf = (who: Face): HTMLImageElement | undefined => (who === 'you' ? sceneImg('cut-driveway') : portraitImg(`${who}-idle` as PortraitId));

export interface MontageOpts {
  met: readonly Who[];   // the characters you already talked to (you are always there)
  fresh?: Who;           // the one who is entering now
  k?: number;            // 0..1: how far the fresh picture has faded in
  glow?: number;         // 0..1: the yellow frame around the fresh panel
  tagK?: number;         // 0..1: the fresh panel's name tag stamping in
  tags?: boolean;        // name tags on the panels (off for the small copy on the result screen)
  pulse?: number;        // seconds, for the logo's breathing (omit for a still picture)
}

/** The montage in the box (x, y, w, h) of the current canvas. */
export function drawMontage(x: number, y: number, w: number, h: number, o: MontageOpts): void {
  const wide = w > h, SLOTS = wide ? SLOTS_WIDE : SLOTS_TALL;
  const u = wide ? h / 520 : w / 360;   // sizes were tuned on a 360-wide montage
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
  const polys = SLOTS.map((s) => s.poly.map(([px, py]) => [x + px * w, y + py * h] as const));
  SLOTS.forEach((s, i) => {
    const P = polys[i]!, b = box(P), fresh = s.who === o.fresh, im = picOf(s.who);
    const shown = s.who === 'you' || o.met.includes(s.who as Who), k = fresh ? clamp(o.k ?? 1, 0, 1) : 1;
    ctx.save(); trace(P); ctx.clip();
    // not met yet (or its picture is still downloading: the portraits are separate files, requested after the first
    // frame): a dark panel with a silhouette and a question mark
    if (!shown || !im || k < 1) {
      ctx.fillStyle = '#17171c'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 8 * u;
      for (let d = -b.h; d < b.w; d += 22 * u) { ctx.beginPath(); ctx.moveTo(b.x + d, b.y); ctx.lineTo(b.x + d + b.h, b.y + b.h); ctx.stroke(); }
      const cx = b.x + b.w / 2, cy = b.y + b.h * (s.top ? 0.38 : 0.62);
      ctx.fillStyle = '#26262e';
      ctx.beginPath(); ctx.arc(cx, cy - 22 * u, 30 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy + 62 * u, 56 * u, 46 * u, 0, Math.PI, 0); ctx.fill();
      ctx.save(); ctx.translate(cx, cy - 22 * u); ctx.scale(u, u); ptxt('?', 0, 0, 4, '#4a4a58'); ctx.restore();
    }
    if (shown && im && k > 0) {
      const sc = Math.max(b.w / im.naturalWidth, b.h / im.naturalHeight) * s.zoom, iw = im.naturalWidth * sc, ih = im.naturalHeight * sc;
      const ix = Math.min(b.x, Math.max(b.x + b.w - iw, b.x + b.w / 2 - iw * s.fx)), iy = Math.min(b.y, Math.max(b.y + b.h - ih, b.y + b.h / 2 - ih * s.fy));
      ctx.globalAlpha = k; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(im, ix, iy, iw, ih);
      if (s.who !== 'you') portraitSticker(`${s.who}-idle` as PortraitId, ix, iy, iw);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  });
  // gutters between the panels
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, 7 * u); ctx.lineJoin = 'miter';
  for (const P of polys) { trace(P); ctx.stroke(); }
  // the logo sits ON the pictures: a soft dark halo keeps the neon readable, the screen blend drops the painting's black
  const cx = x + w / 2, cy = y + h * (wide ? 0.66 : 0.5), lw = wide ? 300 * u : w * 0.83;   // wide: under the faces
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1.15, 0.6);
  const halo = ctx.createRadialGradient(0, 0, 20 * u, 0, 0, 170 * u);
  halo.addColorStop(0, 'rgba(6,6,8,.82)'); halo.addColorStop(0.6, 'rgba(6,6,8,.6)'); halo.addColorStop(1, 'rgba(6,6,8,0)');
  ctx.fillStyle = halo; ctx.fillRect(-200 * u, -200 * u, 400 * u, 400 * u);
  ctx.restore();
  const lit = o.pulse === undefined ? 1 : 0.9 + 0.1 * Math.sin(o.pulse * 2.2);
  if (drawLogo(cx, cy, lw, lit)) drawLogo(cx, cy, lw, lit * 0.5);   // twice: the neon holds against the bright paintings
  // the fresh panel: a yellow frame while it arrives
  SLOTS.forEach((s, i) => {
    if (s.who !== o.fresh || !o.glow || o.glow <= 0) return;
    trace(polys[i]!); ctx.strokeStyle = `rgba(255,204,0,${clamp(o.glow, 0, 1)})`; ctx.lineWidth = (3 + 4 * o.glow) * u; ctx.stroke();
  });
  // name tags: top panels near the top edge, bottom panels near the bottom edge, on the outer side
  if (o.tags) SLOTS.forEach((s, i) => {
    const shown = s.who === 'you' || o.met.includes(s.who as Who), k = s.who === o.fresh ? easeOB(clamp(o.tagK ?? 1, 0, 1)) : 1;
    if (!shown || k <= 0) return;
    const b = box(polys[i]!), name = NAME[s.who], tw = name.length * 6 + 12;
    const tx = s.left ? b.x + (8 + tw / 2) * u : b.x + b.w - (8 + tw / 2) * u, ty = s.top ? b.y + 18 * u : b.y + b.h - 18 * u;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(-0.05); ctx.scale(u * k, u * k);
    rr(-tw / 2, -10, tw, 20, 3, '#0e0e10', C.pink, 2); ptxt(name, 0, 0, 1, C.pink);
    ctx.restore();
  });
  ctx.restore();
}

// ---------- the moment after a conversation ----------
export const MONTAGE_TAP_S = 1.3;    // taps are swallowed until the new face is in
export const MONTAGE_OUT_S = 0.25;   // fade to black after the tap, then the story goes on
const IN_S = 0.2, HOLD_S = 0.35, FADE_S = 0.8;
/** Full screen. t = seconds since it started, out = seconds since the tap (-1 = not yet), who = the one just met. */
export function montageMoment(t: number, out: number, who: Who, met: readonly Who[]): void {
  const land = t - HOLD_S - FADE_S;   // seconds since the picture is fully in
  ctx.save(); ctx.translate(0, -view.top);
  drawMontage(view.x0, 0, view.fullW, view.H, {
    met, fresh: who, tags: true, pulse: t,
    k: easeO(clamp((t - HOLD_S) / FADE_S, 0, 1)),
    glow: land < 0 ? clamp((t - HOLD_S + 0.1) / 0.3, 0, 1) : clamp(1 - land / 0.9, 0, 1),
    tagK: (land - 0.1) / 0.25,
  });
  if (out < 0 && t > MONTAGE_TAP_S && Math.sin(t * 5) > -0.2) {
    rr(W / 2 - 74, view.H - 44, 148, 24, 12, 'rgba(6,6,8,.85)');
    txt(R.strs.tapToContinue, W / 2, view.H - 32, 13, '#ffffff', 'center', 700);
  }
  // in from black, out to black
  const dark = out >= 0 ? clamp(out / MONTAGE_OUT_S, 0, 1) : 1 - clamp(t / IN_S, 0, 1);
  if (dark > 0) { ctx.fillStyle = `rgba(6,6,8,${dark})`; ctx.fillRect(view.x0, 0, view.fullW, view.H); }
  ctx.restore();
}

/** The montage in a white poster frame (the result screen). */
export function montagePoster(x: number, y: number, w: number, h: number, met: readonly Who[], st: number): void {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  rr(x - 5, y - 5, w + 10, h + 10, 4, '#f4efe4'); ctx.restore();
  drawMontage(x, y, w, h, { met, pulse: st });
}

/**
 * The montage as a picture (1080 x 1350): the preview card's art (main.ts __ogPic → og.png). Null while its paintings
 * have not arrived (they are separate files).
 */
export function montagePicture(met: readonly Who[]): HTMLCanvasElement | null {
  if (!sceneImg('logo') || !picOf('you') || met.some((m) => !picOf(m))) return null;
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
  const g = c.getContext('2d');
  if (!g) throw new Error('no 2d context for the share picture');
  g.scale(3, 3);
  drawOn(g, () => drawMontage(0, 0, 360, 450, { met, tags: true }));
  return c;
}
