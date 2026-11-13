// Hand-drawn kit: jittered strokes and wobbly fills. inkSeed advances a few times a second so lines "boil".
import { ctx, fullBleed, state, txt, W, font } from '@tsg/index';
import { rnd } from '@tsg/index';

export const INK = '#f3f3f3', NV = '#76b900', PAPER = '#161616';
export let inkSeed = 0;
export function tickInk(): void { inkSeed = Math.floor(state.t / 0.11); }
export function jit(i: number, a: number): number { const s = Math.sin(i * 12.9898 + inkSeed * 78.233) * 43758.5453; return (s - Math.floor(s) - 0.5) * 2 * a; }

export type Pt = [number, number];
export function ink(pts: Pt[], w = 3, col = INK, close = false, a = 1.4): void {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  pts.forEach((p, i) => { const x = p[0] + jit(i + p[0] * 0.13, a), y = p[1] + jit(i * 7 + p[1] * 0.11, a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  if (close) ctx.closePath(); ctx.stroke();
}
export function inkRect(x: number, y: number, w: number, h: number, lw = 3, col = INK): void { ink([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], lw, col, true); }
export function inkCirc(cx: number, cy: number, r: number, lw = 3, col = INK): void {
  const pts: Pt[] = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } ink(pts, lw, col, true, r * 0.08 + 0.4);
}
export function marker(x: number, y: number, w: number, h: number, col: string, al = 0.85): void {
  ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x + jit(1 + x, 2.5), y + jit(2 + y, 2.5)); ctx.lineTo(x + w + jit(3 + x, 2.5), y + jit(4 + y, 2.5));
  ctx.lineTo(x + w + jit(5 + x, 2.5), y + h + jit(6 + y, 2.5)); ctx.lineTo(x + jit(7 + x, 2.5), y + h + jit(8 + y, 2.5));
  ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}
export function markerCirc(cx: number, cy: number, r: number, col: string, al = 0.9): void {
  ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx + jit(9 + cx, 1.5), cy + jit(10 + cy, 1.5), r * 1.04, r * 0.97, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}
export function hatch(x: number, y: number, w: number, h: number, col = 'rgba(0,0,0,.18)', gap = 7): void {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  for (let i = -h; i < w; i += gap) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); }
  ctx.restore();
}

// Pre-rendered dark paper, tall enough for the tallest phone (780).
const PH = 780;
let paperC: HTMLCanvasElement | null = null;
function makePaper(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W; c.height = PH;
  const p = c.getContext('2d')!;
  p.fillStyle = PAPER; p.fillRect(0, 0, W, PH);
  for (let i = 0; i < 3200; i++) { p.fillStyle = `rgba(255,255,255,${Math.random() * 0.09})`; p.fillRect(Math.random() * W, Math.random() * PH, 1.5, 1.5); }
  p.strokeStyle = 'rgba(118,185,0,.22)'; p.lineWidth = 1.5;
  for (let i = 0; i < 36; i++) { let x = Math.random() * W, y = Math.random() * PH; p.beginPath(); p.moveTo(x, y); for (let k = 0; k < 4; k++) { if (k % 2) y += rnd(-70, 70); else x += rnd(-70, 70); p.lineTo(x, y); } p.stroke(); p.fillStyle = 'rgba(118,185,0,.35)'; p.fillRect(x - 2, y - 2, 4, 4); }
  p.strokeStyle = 'rgba(255,255,255,.07)'; p.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const x = 20 + i * 72, y = 40 + (i % 2) * 300; p.strokeRect(x, y, 40, 120); for (let k = 0; k < 6; k++) { p.beginPath(); p.moveTo(x + 4, y + 10 + k * 18); p.lineTo(x + 36, y + 10 + k * 18); p.stroke(); } }
  return c;
}
/** Full-bleed paper background (call first in a scene). */
export function paper(): void { if (!paperC) paperC = makePaper(); const c = paperC; fullBleed((h) => { ctx.drawImage(c, 0, (PH - h) / -2 * 0 - (PH - h) / 2); }); }

export function hbtn(s: string, x: number, y: number, w: number, h: number, col = NV, sz = 20, fg = '#0b0b0b'): void {
  marker(x - w / 2 + 3, y - h / 2 + 4, w, h, '#000', 0.9); marker(x - w / 2, y - h / 2, w, h, col, 1); inkRect(x - w / 2, y - h / 2, w, h, 3, '#0b0b0b'); txt(s, x, y + 1, sz, fg, 'center', 700);
}
export function sticker(s: string, x: number, y: number, sz = 14, bg = '#fff8e0', rot = -0.06, fg = '#0b0b0b'): void {
  font(sz); const w = ctx.measureText(s).width + 22, h = sz + 14;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); marker(-w / 2 + 2, -h / 2 + 3, w, h, '#000', 0.8); marker(-w / 2, -h / 2, w, h, bg, 1); inkRect(-w / 2, -h / 2, w, h, 2.5, '#0b0b0b'); txt(s, 0, 1, sz, fg); ctx.restore();
}
/** Marker card with a green ink frame (panels). */
export function card(x: number, y: number, w: number, h: number, frame = NV): void { marker(x + 3, y + 4, w, h, '#000', 0.6); marker(x, y, w, h, '#222', 1); inkRect(x, y, w, h, 3, frame); }
/** Rotated green banner with dark text (headings). */
export function banner(s: string, x: number, y: number, sz = 26, w?: number): void {
  font(sz); const bw = w ?? Math.min(W - 24, ctx.measureText(s).width + 40), bh = sz + 18;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.03); marker(-bw / 2, -bh / 2, bw, bh, NV, 1); inkRect(-bw / 2, -bh / 2, bw, bh, 3, '#0b0b0b'); txt(s, 0, 2, sz, '#0b0b0b', 'center', 900); ctx.restore();
}
