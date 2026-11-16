// Chunky 90s pixel kit: an original 5x7 bitmap font and string-grid sprites, pre-rendered to tiny canvases and
// drawn scaled up with smoothing off. Nothing here copies any existing game's font, HUD or sprites.
import { ctx } from '@tsg/index';

// ---------- 5x7 font: 7 rows of 5 bits per glyph ----------
const G: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
  $: [4, 15, 20, 14, 5, 30, 4], ':': [0, 12, 12, 0, 12, 12, 0], '.': [0, 0, 0, 0, 0, 12, 12], '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4], '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '/': [1, 1, 2, 4, 8, 16, 16],
  "'": [4, 4, 8, 0, 0, 0, 0], ',': [0, 0, 0, 0, 12, 4, 8], ' ': [0, 0, 0, 0, 0, 0, 0], '*': [0, 4, 21, 14, 21, 4, 0],
  '#': [10, 10, 31, 10, 31, 10, 10], '%': [24, 25, 2, 4, 8, 19, 3], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
  _: [0, 0, 0, 0, 0, 0, 31], '=': [0, 0, 31, 0, 31, 0, 0], '&': [12, 18, 20, 8, 21, 18, 13], '"': [10, 10, 0, 0, 0, 0, 0],
  '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8], '·': [0, 0, 0, 12, 12, 0, 0],
};

/** Width in logical px of a pixel string at pixel size `p` (5 px glyph + 1 px gap). */
export const pw = (s: string, p: number): number => Math.max(0, s.length * 6 * p - p);

/** Pixel text. `y` is the vertical centre. Optional hard drop shadow in `sh`. */
export function ptxt(s: string, x: number, y: number, p: number, col: string, al: 'left' | 'center' | 'right' = 'center', sh?: string): void {
  const w = pw(s, p);
  let x0 = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x;
  x0 = Math.round(x0); const y0 = Math.round(y - 3.5 * p);
  if (sh) draw(s, x0 + Math.max(1, p / 2), y0 + Math.max(1, p / 2), p, sh);
  draw(s, x0, y0, p, col);
}
function draw(s: string, x0: number, y0: number, p: number, col: string): void {
  ctx.fillStyle = col;
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const g = G[up[i]!] ?? G['?']!;
    const gx = x0 + i * 6 * p;
    for (let r = 0; r < 7; r++) { const row = g[r]!; if (!row) continue; for (let c = 0; c < 5; c++) if (row & (16 >> c)) ctx.fillRect(gx + c * p, y0 + r * p, p, p); }
  }
}

// ---------- sprites: rows of chars, '.' = transparent, other chars index a palette ----------
export type Pal = Record<string, string>;
const cache = new Map<string, HTMLCanvasElement>();

/** Pre-render a sprite to a 1px-per-pixel canvas (cached by key). */
export function sprite(key: string, rows: readonly string[], pal: Pal): HTMLCanvasElement {
  const hit = cache.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = rows[0]!.length; c.height = rows.length;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = pal[row[x]!]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  cache.set(key, c); return c;
}

/** Draw a sprite centred at (x, y), scaled by `sc`, rotated by `rot` (radians, sprite art faces up). */
export function blit(img: HTMLCanvasElement, x: number, y: number, sc: number, rot = 0): void {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (-img.width * sc) / 2, (-img.height * sc) / 2, img.width * sc, img.height * sc);
  ctx.restore();
}

/** Turn everything already drawn in the given rect gray (the decision-scene freeze-frame). Safari-safe blend mode. */
export function grayOut(x: number, y: number, w: number, h: number, dim = 0.25): void {
  ctx.save();
  ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(0,0,0,${dim})`; ctx.fillRect(x, y, w, h);
  ctx.restore();
}
