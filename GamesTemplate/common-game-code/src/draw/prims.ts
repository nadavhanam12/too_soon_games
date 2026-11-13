// Drawing primitives and small math helpers shared by every game.
import { ctx } from '../core/canvas';

export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;
export const fmtTime = (s: number): string => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');

export type Align = 'left' | 'center' | 'right';

let FONT = "'Rubik',system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
let DIR: 'ltr' | 'rtl' = 'ltr';
export function setFont(family: string): void { FONT = family; }
export function setDirection(dir: 'ltr' | 'rtl'): void { DIR = dir; }
export const fontFamily = (): string => FONT;

export function font(sz: number, w: number | string = 700): void { ctx.font = `${w} ${sz}px ${FONT}`; }

export function txt(s: string, x: number, y: number, sz = 16, col = '#fff', al: Align = 'center', w: number | string = 700): void {
  font(sz, w);
  ctx.fillStyle = col; ctx.textAlign = al; ctx.textBaseline = 'middle'; ctx.direction = DIR;
  ctx.fillText(s, x, y);
}

/** Text made of coloured runs, centred as a whole: [['Hello ', '#fff'], ['Dani', '#f0f']] */
export function rich(parts: Array<[string, string]>, x: number, y: number, sz = 16, w: number | string = 700): void {
  font(sz, w);
  const total = parts.reduce((a, p) => a + ctx.measureText(p[0]).width, 0);
  const seq = DIR === 'rtl' ? [...parts].reverse() : parts;
  let cx = x - total / 2;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.direction = DIR;
  for (const [s, c] of seq) { ctx.fillStyle = c; ctx.fillText(s, cx, y); cx += ctx.measureText(s).width; }
}

export function wrap(s: string, sz: number, maxW: number, w: number | string = 700): string[] {
  font(sz, w);
  const words = s.split(' '); const lines: string[] = []; let cur = '';
  for (const word of words) {
    const t = cur ? cur + ' ' + word : word;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = word; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
export function textWidth(s: string, sz: number, w: number | string = 700): number { font(sz, w); return ctx.measureText(s).width; }

export function rr(x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 2): void {
  ctx.beginPath();
  const rad = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
export function circ(x: number, y: number, r: number, fill?: string, stroke?: string, lw = 2): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/** Hit test against a centred box; the box is padded so fingers hit easily (rule 13). */
export function inBtn(p: { x: number; y: number }, x: number, y: number, w: number, h: number, pad = 12): boolean {
  return Math.abs(p.x - x) < w / 2 + pad && Math.abs(p.y - y) < Math.max(h, 44) / 2 + pad;
}

/** Speech bubble with a tail toward (tx, ty). */
export function bubble(s: string, x: number, y: number, sz: number, bg: string, fg: string, tx: number, ty: number, border?: string): void {
  const lines = wrap(s, sz, 200);
  const w = Math.min(220, Math.max(...lines.map((l) => textWidth(l, sz))) + 24), h = lines.length * (sz + 4) + 16;
  const bx = clamp(x - w / 2, 6, 360 - w - 6), by = y - h / 2;
  rr(bx, by, w, h, 12, bg, border);
  ctx.beginPath(); ctx.moveTo(clamp(tx, bx + 14, bx + w - 14) - 6, by + h); ctx.lineTo(tx, ty); ctx.lineTo(clamp(tx, bx + 14, bx + w - 14) + 6, by + h); ctx.closePath();
  ctx.fillStyle = bg; ctx.fill();
  lines.forEach((l, i) => txt(l, bx + w / 2, by + 12 + (sz + 4) * i + sz / 2 - 2, sz, fg, 'center', 700));
}

export function shadowText(s: string, x: number, y: number, sz: number, col: string, shadow = 'rgba(0,0,0,.45)', al: Align = 'center', w: number | string = 900): void {
  txt(s, x + 2, y + 2, sz, shadow, al, w); txt(s, x, y, sz, col, al, w);
}
