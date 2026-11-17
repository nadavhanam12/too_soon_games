// ITEM ACQUIRED: the moment of honour after the store. The game case (a cut-out painting, assets/scenes/item-six.webp)
// rises into a turning sunburst, a shine sweeps over it, the header slams in and a line says what it cost you.
// On the tap it shrinks and flies to its place in the HUD, where it rides along as an icon for the way home.
import { R, W, view, ctx, txt, wrap, clamp, lerp, easeO, easeOB } from '@tsg/index';
import { C } from './art';
import { ptxt } from './pixel';
import { sceneImg } from './opening';
import { ITEM, type StoreChoice } from './content';

export const ITEM_TAP_S = 1;                      // taps are swallowed until the moment has landed
export const ITEM_OUT_S = 0.42;                   // the fly-to-HUD exit, then the next stage starts
export const ITEM_HUD = { x: 338, y: 37, h: 24 }; // where the icon lives in the driving HUD (second row, right)
const CX = W / 2, CY = 292, CASE_H = 252;         // the case's place of honour
/** The cover's blank black band, where the game's name is drawn: centre, pixel size and slant (the case is painted
 *  at a slight angle), in 480-wide source px. */
const BAND = { cx: 250, cy: 613, p: 14, rot: -0.034 };
const k01 = (t: number, from: number, dur: number): number => clamp((t - from) / dur, 0, 1);

// the painting and its shine are composed off-screen, so the shine touches the case only, not the cut-out around it
let buf: HTMLCanvasElement | null = null;
function shinyCase(im: HTMLImageElement, shine: number): HTMLCanvasElement {
  const bw = 360, bh = Math.round((bw * im.naturalHeight) / im.naturalWidth);
  if (!buf) buf = document.createElement('canvas');
  if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
  const g = buf.getContext('2d')!;
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, bw, bh); g.drawImage(im, 0, 0, bw, bh);
  if (shine > 0 && shine < 1) {
    g.globalCompositeOperation = 'source-atop';
    const x = -bw * 0.7 + shine * bw * 2.2, gr = g.createLinearGradient(x, 0, x + bw * 0.5, bh * 0.3);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, bw, bh);
  }
  return buf;
}

/** The case, centred on (0, 0) at height h, with the game's name on its band. */
function drawCase(h: number, shine: number, withName: boolean): void {
  const im = sceneImg('item-six');
  if (!im) return; // the painting is a separate file and may still be on its way: the moment plays without it
  const w = (h * im.naturalWidth) / im.naturalHeight, s = w / 480;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shinyCase(im, shine), -w / 2, -h / 2, w, h);
  if (withName) { ctx.save(); ctx.translate(-w / 2, -h / 2); ctx.scale(s, s); ctx.translate(BAND.cx, BAND.cy); ctx.rotate(BAND.rot); ptxt(ITEM.cover, 0, 0, BAND.p, '#ffffff'); ctx.restore(); }
}

function sparkle(x: number, y: number, r: number): void {
  if (r <= 0) return;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
const SPARKS: Array<[number, number, number]> = [[-118, -110, 0], [124, -84, 1.1], [-132, 40, 2.3], [128, 96, 3.1], [-70, 138, 4.2], [84, -140, 5], [0, -158, 2.9], [-148, -30, 0.6]];

/** One frame of the moment. `t` = seconds since it started, `out` = seconds since the tap (-1 = not yet). */
export function itemMoment(t: number, out: number, paid: StoreChoice): void {
  const o = out < 0 ? 0 : easeO(Math.min(1, out / ITEM_OUT_S)), stay = 1 - o;
  // the scene behind goes dark
  ctx.fillStyle = `rgba(10,10,12,${k01(t, 0, 0.25) * stay})`; ctx.fillRect(view.x0, -view.top, view.fullW, view.H);
  // sunburst: a warm glow and slowly turning rays
  const rk = easeO(k01(t, 0.1, 0.5)) * stay;
  if (rk > 0) {
    const g = ctx.createRadialGradient(CX, CY, 20, CX, CY, 260);
    g.addColorStop(0, `rgba(255,204,0,${0.5 * rk})`); g.addColorStop(0.5, `rgba(208,32,42,${0.22 * rk})`); g.addColorStop(1, 'rgba(208,32,42,0)');
    ctx.fillStyle = g; ctx.fillRect(view.x0, -view.top, view.fullW, view.H);
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(t * 0.35); ctx.fillStyle = `rgba(255,220,90,${0.2 * rk})`;
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-58 * rk, -520); ctx.lineTo(58 * rk, -520); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // the case: rises from below with a bounce, then floats; on the way out it shrinks into its HUD slot
  const ck = k01(t, 0.12, 0.45), rise = easeOB(ck), float = Math.sin(t * 2.2) * 5 * stay;
  if (ck > 0) {
    const x = lerp(CX, ITEM_HUD.x, o), y = lerp(CY + (1 - rise) * 460 + float, ITEM_HUD.y, o), h = lerp(CASE_H, ITEM_HUD.h, o);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.6) * 0.035 * stay);
    if (stay > 0.5) { ctx.shadowColor = 'rgba(255,204,0,.55)'; ctx.shadowBlur = 28; }
    drawCase(h, out < 0 ? ((t - 0.7) % 2.4) / 0.7 : -1, o < 0.6);
    ctx.restore();
  }
  // sparkles twinkle around it
  if (t > 0.5 && stay > 0) {
    ctx.fillStyle = `rgba(255,246,200,${stay})`;
    for (const [dx, dy, ph] of SPARKS) sparkle(CX + dx, CY + dy + float * 0.5, 9 * Math.max(0, Math.sin(t * 3.2 + ph)));
  }
  // header: slams in over the top, in the pixel font, on a tilted yellow tag
  const hk = k01(t, 0.4, 0.25);
  if (hk > 0 && stay > 0) {
    const e = easeOB(hk), sc = 1 + (1 - e) * 0.8, w = ITEM.head.length * 18 + 22;
    ctx.save(); ctx.globalAlpha = Math.min(1, hk * 3) * stay; ctx.translate(CX, 112); ctx.rotate(-0.045); ctx.scale(sc, sc);
    ctx.fillStyle = '#000'; ctx.fillRect(-w / 2 + 4, -18 + 4, w, 36);
    ctx.fillStyle = C.yellow; ctx.fillRect(-w / 2, -18, w, 36);
    ctx.fillStyle = C.red; ctx.fillRect(-w / 2, 14, w, 4);
    ptxt(ITEM.head, 0, -2, 3, '#0e0e10');
    ctx.restore();
  }
  // what it is, and what it cost you
  const nk = k01(t, 0.6, 0.25);
  if (nk > 0 && stay > 0) {
    ctx.globalAlpha = nk * stay;
    const dy = (1 - easeOB(nk)) * 16;
    ptxt(ITEM.name, CX, 456 + dy, 2, '#ffffff', 'center', '#000');
    wrap(ITEM.paid[paid], 14, W - 60, 800).forEach((l, i) => txt(l, CX, 486 + dy + i * 19, 14, C.yellow, 'center', 800));
    wrap(ITEM.patch, 11, W - 70, 600).forEach((l, i) => txt(l, CX, 528 + dy + i * 15, 11, '#b4b4bc', 'center', 600));
    ctx.globalAlpha = 1;
  }
  if (out < 0 && t > ITEM_TAP_S && Math.sin(t * 5) > -0.2) txt(R.strs.tapToContinue, CX, 600, 13, '#cfcfcf', 'center', 700);
}

/** The case as a small HUD icon, centred on (x, y), scaled by `k` (the pop when the leg starts). */
export function itemIcon(x: number, y: number, k: number): void {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(-0.08);
  drawCase(ITEM_HUD.h, -1, false);
  ctx.restore();
}
