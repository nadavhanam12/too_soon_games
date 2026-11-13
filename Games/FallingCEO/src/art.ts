// Characters and props. The CEO is generic (grey hair, glasses, leather jacket); no likeness, no logo.
import { ctx, txt, W } from '@tsg/index';
import { ink, inkCirc, inkRect, jit, marker, markerCirc, NV } from './kit';

export type Pose = 'fall' | 'land' | 'slump';
const K = '#1b1b1b';

/** Origin at the feet. mood 0..3 = grin / neutral / sweat / scream (follows market cap). */
export function ceo(x: number, y: number, pose: Pose = 'fall', tm = 0, sc = 1, mood = 0): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  const fl = pose === 'fall', sl = pose === 'slump', ld = pose === 'land';
  if (!sl) { const sp = fl ? Math.sin(tm * 14) * 6 : 0; ink([[-6, -18], [-10 + sp, 0]], 5, '#3a3a48'); ink([[6, -18], [10 - sp, 0]], 5, '#3a3a48'); markerCirc(-10 + sp, 1, 4, '#444'); markerCirc(10 - sp, 1, 4, '#444'); }
  else { ink([[-8, -12], [-26, -2]], 5, '#3a3a48'); ink([[6, -12], [24, -2]], 5, '#3a3a48'); markerCirc(-27, -1, 4, '#444'); markerCirc(25, -1, 4, '#444'); }
  const jy = sl ? -32 : ld ? -36 : -42, jh = sl ? 22 : ld ? 20 : 26;
  marker(-13, jy, 26, jh, '#1d1d22', 0.96); inkRect(-13, jy, 26, jh, 2.5, '#cfcfcf');
  ink([[0, jy + 2], [0, jy + jh - 2]], 1.5, '#aaa'); ink([[-13, jy], [-5, jy + 9]], 2, '#999'); ink([[13, jy], [5, jy + 9]], 2, '#999');
  let hl: [number, number], hr: [number, number];
  if (fl) { const w = Math.sin(tm * 10) * 8; hl = [-26, jy - 14 + w]; hr = [26, jy - 12 - w]; }
  else if (ld) { hl = [-24, jy + 18]; hr = [24, jy + 18]; }
  else { hl = [-14, jy + jh + 2]; hr = [14, jy + jh + 2]; }
  ink([[-13, jy + 4], hl], 5.5, '#cfcfcf'); ink([[-13, jy + 4], hl], 3.5, '#1d1d22'); ink([[13, jy + 4], hr], 5.5, '#cfcfcf'); ink([[13, jy + 4], hr], 3.5, '#1d1d22');
  markerCirc(hl[0], hl[1], 3.6, '#e8bf98'); markerCirc(hr[0], hr[1], 3.6, '#e8bf98');
  const hy = jy - 12 + (sl ? 6 : 0);
  markerCirc(0, hy, 11, mood >= 3 ? '#f0b0a0' : '#e8bf98'); inkCirc(0, hy, 11, 2.5, K);
  ctx.strokeStyle = '#8f8f8f'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; ctx.moveTo(Math.cos(a) * 9, hy + Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 14 + jit(i, 1.5), hy + Math.sin(a) * 14 - 2); }
  ctx.stroke();
  marker(-11, hy - 13, 22, 7, '#9a9a9a', 0.95);
  inkCirc(-5, hy + 1, 4.2, 1.8, K); inkCirc(5, hy + 1, 4.2, 1.8, K); ink([[-1, hy + 1], [1, hy + 1]], 1.5, K); ink([[-9, hy], [-12, hy - 1]], 1.5, K); ink([[9, hy], [12, hy - 1]], 1.5, K);
  if (sl) { ink([[-4, hy + 7], [4, hy + 7]], 1.5, K); ink([[-10, hy - 3], [-6, hy - 1]], 1.5, K); ink([[10, hy - 3], [6, hy - 1]], 1.5, K); }
  else if (mood >= 3) { inkCirc(0, hy + 7, 3.2, 1.6, K); ink([[-10, hy - 4], [-5, hy - 2]], 1.5, K); ink([[10, hy - 4], [5, hy - 2]], 1.5, K); for (let i = 0; i < 3; i++) { const d = (tm * 3 + i * 0.33) % 1; markerCirc(14 + i * 2, hy - 8 + d * 16, 2, '#6ab0e8'); } }
  else if (mood === 2) { ink([[-4, hy + 7], [4, hy + 7]], 1.6, K); markerCirc(13, hy - 4 + ((tm * 2) % 1) * 10, 2.2, '#6ab0e8'); }
  else if (mood === 1) ink([[-4, hy + 7], [0, hy + 7.5], [4, hy + 7]], 1.5, K);
  else ink([[-5, hy + 5], [0, hy + 9], [5, hy + 5]], 1.6, K);
  ctx.restore();
}

/** Public-figure caricature for the special platform. */
export function trumpFace(x: number, y: number, sc = 1): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  markerCirc(0, 0, 12, '#f0a060'); inkCirc(0, 0, 12, 2.5, K);
  marker(-13, -14, 26, 9, '#f5d76e', 1); ink([[-14, -8], [-6, -14], [4, -10], [14, -13], [10, -5]], 2.5, K);
  ink([[-7, -3], [-3, -3]], 2, K); ink([[3, -3], [7, -3]], 2, K); ink([[-9, -6], [-3, -5]], 1.5, K); ink([[3, -5], [9, -6]], 1.5, K);
  ink([[-4, 5], [0, 3], [4, 5]], 2, K); marker(-2, 12, 4, 12, '#c9403a', 1);
  ctx.restore();
}

/** The two 'affair' characters: generic figures, a role each, no names. Origin at feet. */
export function woman(x: number, y: number, kind: 'agent' | 'vp', tm: number): void {
  ctx.save(); ctx.translate(x, y);
  const sw = Math.sin(tm * 12) * 4; ink([[-4, -16], [-7 + sw, 0]], 4, '#e8bf98'); ink([[4, -16], [7 - sw, 0]], 4, '#e8bf98');
  const hy = -48;
  if (kind === 'agent') {
    ctx.fillStyle = '#ff6fae'; ctx.globalAlpha = 0.96; ctx.beginPath(); ctx.moveTo(-9, -38); ctx.lineTo(9, -38); ctx.lineTo(15, -12); ctx.lineTo(-15, -12); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ink([[-9, -38], [9, -38], [15, -12], [-15, -12]], 2.2, '#cfcfcf', true);
    ink([[-9, -34], [-19, -22]], 4, '#e8bf98'); ink([[9, -34], [19, -26]], 4, '#e8bf98');
    marker(4, -34, 9, 6, '#d8231f', 1); inkRect(4, -34, 9, 6, 1, K); txt('★', 8.5, -31, 6, '#ffd84a');
    markerCirc(0, hy, 9, '#f1cfa6'); inkCirc(0, hy, 9, 2.2, K);
    marker(-10, hy - 11, 20, 8, '#111', 1); markerCirc(0, hy - 13, 5, '#111'); inkCirc(0, hy - 13, 5, 1.5, K);
    ink([[-6, hy - 2], [-2, hy - 2]], 1.6, K); ink([[2, hy - 2], [6, hy - 2]], 1.6, K); ink([[-3, hy + 4], [0, hy + 6], [3, hy + 4]], 1.4, K);
    marker(-4, hy + 3, 8, 2, '#d8231f', 0.9);
  } else {
    marker(-10, -38, 20, 24, '#8a1f3a', 0.96); inkRect(-10, -38, 20, 24, 2.2, '#cfcfcf');
    ink([[-10, -34], [-20, -22]], 4, '#e8bf98'); ink([[10, -34], [20, -26]], 4, '#e8bf98');
    markerCirc(0, hy, 9, '#f3d7b6'); inkCirc(0, hy, 9, 2.2, K);
    marker(-11, hy - 11, 22, 8, '#f5d76e', 1); ink([[-10, hy - 4], [-13, hy + 14]], 5, '#f5d76e'); ink([[10, hy - 4], [13, hy + 14]], 5, '#f5d76e'); ink([[-11, hy - 8], [-6, hy - 12], [2, hy - 10], [11, hy - 8]], 2, '#e3c25a');
    inkCirc(-4, hy - 1, 1.6, 1.4, K); inkCirc(4, hy - 1, 1.6, 1.4, K); ink([[-3, hy + 4], [0, hy + 6], [3, hy + 4]], 1.4, K);
    marker(-6, -32, 12, 8, '#fff8e0', 1); inkRect(-6, -32, 12, 8, 1.5, K); txt('VP', 0, -28, 7, '#0b0b0b');
    marker(16, -40, 8, 14, '#111', 1); inkRect(16, -40, 8, 14, 1.5, '#cfcfcf'); markerCirc(20, -44, 2, '#76b900');
  }
  ctx.restore();
}

/** Falling stock chart in the background (full height). */
export function chart(cam: number, par = 0.5, h = 780): void {
  const pts: [number, number][] = []; const off = cam * par;
  for (let ty = Math.floor((off - 200) / 40) * 40; ty < off + h + 160; ty += 40) { const x = W * 0.5 + Math.sin(ty * 0.006) * 110 + Math.sin(ty * 0.021) * 26; pts.push([x, ty - off]); }
  ctx.globalAlpha = 0.5; ink(pts, 5, '#c9403a', false, 1); ctx.globalAlpha = 0.35;
  for (let i = 1; i < pts.length; i += 2) { const [x, y] = pts[i]!; marker(x - 5, y - 16, 10, 32, '#c9403a', 0.5); ink([[x, y - 26], [x, y + 26]], 1.5, '#c9403a'); }
  ctx.globalAlpha = 1;
}

/** A GPU package: green substrate, gold pins on three sides, a dark die with a grid. */
export function chip(x: number, y: number, w: number, label: string, col = NV, txtCol = '#0b0b0b'): void {
  marker(x + 3, y + 4, w, 18, '#000', 0.6); marker(x, y, w, 18, col, 1); inkRect(x, y, w, 18, 2.5, '#0b0b0b');
  ctx.strokeStyle = '#d9a21b'; ctx.lineWidth = 2;
  for (let i = x + 6; i < x + w - 4; i += 6) { ctx.beginPath(); ctx.moveTo(i, y + 18); ctx.lineTo(i, y + 23); ctx.stroke(); }
  for (let i = y + 3; i < y + 16; i += 4) { ctx.beginPath(); ctx.moveTo(x - 4, i); ctx.lineTo(x, i); ctx.moveTo(x + w, i); ctx.lineTo(x + w + 4, i); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
  for (let i = x + 8; i < x + w - 6; i += 7) { ctx.beginPath(); ctx.moveTo(i, y + 3); ctx.lineTo(i, y + 15); ctx.stroke(); }
  markerCirc(x + 6, y + 6, 1.4, '#d9a21b');
  if (label) txt(label, x + w / 2, y + 9, 11, txtCol, 'center', 900);
}
