// Drawing kit of "חופשה בטוחה": the little people, the plane, flags, the cockpit horizon, the tied attacker.
// Flat shapes, no outlines. Everything is in safe-zone logical units (360 wide).
import { ctx, W, rr, circ, txt, rich, wrap, clamp } from '@tsg/index';

export interface PersonOpts {
  sc?: number; shirt?: string; skin?: string; hair?: string | false; back?: boolean; glasses?: boolean; cap?: boolean; blood?: boolean;
  pants?: string; walk?: boolean; longhair?: boolean; hairCol?: string; bow?: boolean;
}

/** A person from the waist up: shirt, head, hair. `back` = seen from behind. */
export function person(x: number, y: number, o: PersonOpts = {}): void {
  const sc = o.sc || 1, shirt = o.shirt || '#2f6fdd', skin = o.skin || '#f2c9a0';
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  rr(-12, -8, 24, 26, 8, shirt);
  circ(0, -18, 10, skin);
  if (o.back) {
    circ(-10, -17, 3, skin); circ(10, -17, 3, skin);
    if (o.hair !== false) circ(0, -19, 10, o.hair || '#2a1a0a');
    else { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -14, 7, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke(); }
    ctx.restore(); return;
  }
  if (o.hair !== false) rr(-10, -28, 20, 7, 4, o.hair || '#2a1a0a');
  if (o.glasses) { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.strokeRect(-9, -21, 7, 5); ctx.strokeRect(2, -21, 7, 5); }
  if (o.cap) rr(-12, -30, 24, 8, 3, '#0d2a5a');
  if (o.blood) { circ(6, -12, 4, '#c8102e'); circ(-8, 4, 3, '#c8102e'); }
  ctx.restore();
}

/** A person with legs; `walk` animates them with `tm`. */
export function walker(x: number, y: number, o: PersonOpts, tm: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(o.sc || 1, o.sc || 1);
  const lg = o.walk ? Math.sin(tm * 12 + x) * 5 : 0;
  rr(-9, 8, 7, 14 + lg, 3, o.pants || '#1b2a44'); rr(2, 8, 7, 14 - lg, 3, o.pants || '#1b2a44');
  person(0, 0, o);
  if (o.longhair && o.back) rr(-13, -28, 26, 30, 8, o.hairCol || '#3a2a1a');
  else if (o.longhair) { rr(-13, -26, 26, 8, 4, o.hairCol || '#3a2a1a'); rr(-13, -24, 6, 22, 3, o.hairCol || '#3a2a1a'); rr(7, -24, 6, 22, 3, o.hairCol || '#3a2a1a'); }
  if (o.bow) circ(8, -28, 4, '#ff5fa2');
  ctx.restore();
}

export function suitcase(x: number, y: number, w: number, h: number, col: string): void {
  rr(x, y, w, h, 5, col); rr(x + w / 2 - 8, y - 5, 16, 7, 3, '#222');
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.strokeRect(x + 6, y + 4, w - 12, h - 8);
}

/** Speech bubble (wider than the template's, with an optional coloured "Name:" prefix on the first line). */
export function bubble(s: string, x: number, y: number, sz = 13, bg = '#fff', fg = '#111', tx: number | null = null, ty: number | null = null, nc: string | null = null): void {
  const lines = wrap(s, sz, 290, 700);
  let w = 0; lines.forEach((l) => { w = Math.max(w, ctx.measureText(l).width); }); w += 22;
  const lh = sz + 5, h = lines.length * lh + 12;
  x = clamp(x, w / 2 + 6, W - w / 2 - 6);
  rr(x - w / 2, y - h / 2, w, h, 12, bg);
  if (tx !== null) {
    const ax = clamp(tx, x - w / 2 + 14, x + w / 2 - 14); const dir = (ty ?? y + 40) > y ? 1 : -1; const by = y + dir * h / 2;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(ax - 7, by); ctx.lineTo(ax + 7, by); ctx.lineTo(tx, ty ?? y + h / 2 + 16); ctx.fill();
  }
  lines.forEach((l, i) => {
    const ly = y - h / 2 + 6 + lh * i + lh / 2; const ci = nc ? l.indexOf(':') : -1;
    if (i === 0 && ci > 0) rich([[l.slice(0, ci + 1), nc!], [l.slice(ci + 1), fg]], x, ly, sz);
    else txt(l, x, ly, sz, fg);
  });
}

/** Flat pill button drawn in-canvas (stage UI; the shared screens use the theme's). */
export function btn(s: string, x: number, y: number, w: number, h: number, col = '#ffb400', fg = '#111', sz = 18): void {
  rr(x - w / 2, y - h / 2, w, h, h / 2, col); txt(s, x, y + 1, sz, fg, 'center', 900);
}

/** Artificial horizon: sky/ground split by pitch, rotated by bank, masked to a circle. */
export function hzn(cx: number, cy: number, r: number, pitch: number, bank: number, mask = true): void {
  ctx.save(); if (mask) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); }
  ctx.translate(cx, cy); ctx.rotate(-bank); const off = pitch * r * 0.9;
  ctx.fillStyle = '#4aa8ff'; ctx.fillRect(-r * 2, -r * 2 + off, r * 4, r * 2);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-r * 2, off, r * 4, r * 2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) { if (!i) continue; const y = off + i * r * 0.22; ctx.beginPath(); ctx.moveTo(-18, y); ctx.lineTo(18, y); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-r * 2, off); ctx.lineTo(r * 2, off); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffb400'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy); ctx.lineTo(cx - r * 0.2, cy); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx + r * 0.2, cy); ctx.lineTo(cx + r * 0.6, cy); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

/** A side-view airliner, nose to the right, ~320 units wide at scale 1. */
export function plane(x: number, y: number, sc = 1): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.fillStyle = '#ff6a00'; ctx.beginPath(); ctx.moveTo(-120, -6); ctx.lineTo(-150, -52); ctx.lineTo(-118, -52); ctx.lineTo(-86, -6); ctx.fill();
  ctx.fillStyle = '#d7dfe8'; ctx.beginPath(); ctx.moveTo(-124, 0); ctx.lineTo(-150, -14); ctx.lineTo(-100, -10); ctx.fill();
  ctx.fillStyle = '#eef2f7'; ctx.beginPath(); ctx.moveTo(-130, -16); ctx.lineTo(110, -16); ctx.quadraticCurveTo(150, -14, 160, 2); ctx.quadraticCurveTo(150, 18, 110, 18); ctx.lineTo(-120, 18); ctx.quadraticCurveTo(-140, 10, -130, -16); ctx.fill();
  ctx.fillStyle = '#c9d4e2'; ctx.fillRect(-120, 8, 260, 8);
  ctx.fillStyle = '#1b2a44'; ctx.beginPath(); ctx.moveTo(118, -10); ctx.lineTo(146, -6); ctx.lineTo(140, 2); ctx.lineTo(116, 0); ctx.fill();
  for (let i = 0; i < 13; i++) rr(-104 + i * 16, -7, 8, 9, 3, '#4aa8ff');
  rr(-116, -10, 10, 22, 3, '#9aa8ba');
  ctx.fillStyle = '#d7dfe8'; ctx.beginPath(); ctx.moveTo(-20, 4); ctx.lineTo(-70, 42); ctx.lineTo(-48, 42); ctx.lineTo(20, 4); ctx.fill();
  rr(-40, 22, 34, 16, 8, '#2b3648'); rr(-40, 25, 8, 10, 4, '#ffb400');
  rr(-60, -3, 70, 10, 5, '#ff6a00');
  ctx.restore();
}

/** Clouds drifting across a band; `t` in seconds. */
export function clouds(t: number, y0 = 90, alpha = 0.08): void {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i < 7; i++) { const cx = ((i * 83 + t * 18) % (W + 120)) - 60, cy = y0 + (i % 3) * 70; ctx.beginPath(); ctx.ellipse(cx, cy, 46, 14, 0, 0, Math.PI * 2); ctx.fill(); }
}

/** Israeli flag waving on a pole. */
export function flag(x: number, y: number, w: number, h: number, ph: number): void {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#fff'; ctx.beginPath();
  for (let i = 0; i <= w; i += 4) { const yy = Math.sin(ph + i * 0.08) * 3; if (i === 0) ctx.moveTo(i, yy); else ctx.lineTo(i, yy); }
  for (let i = w; i >= 0; i -= 4) ctx.lineTo(i, h + Math.sin(ph + i * 0.08) * 3);
  ctx.fill();
  ctx.fillStyle = '#0038b8'; ctx.fillRect(0, h * 0.15, w, h * 0.12); ctx.fillRect(0, h * 0.73, w, h * 0.12);
  ctx.strokeStyle = '#0038b8'; ctx.lineWidth = 2.2; const cx = w / 2, cy = h / 2, r = h * 0.2;
  for (const rot of [0, Math.PI]) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = rot - Math.PI / 2 + (i * Math.PI * 2) / 3; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.stroke(); }
  ctx.fillStyle = '#8a6d3b'; ctx.fillRect(-3, -4, 3, h + 40); ctx.restore();
}

/** A person jumping with raised arms. */
export function cheer(x: number, y: number, o: PersonOpts, tm: number): void {
  const j = Math.abs(Math.sin(tm * 6 + x)) * 10;
  ctx.save(); ctx.translate(x, y - j); person(0, 0, o);
  ctx.strokeStyle = o.skin || '#f2c9a0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-22, -26); ctx.moveTo(12, -4); ctx.lineTo(22, -26); ctx.stroke();
  ctx.restore();
}

/** A fist (stage 3): sleeve, knuckles, label; `active` draws the amber halo. */
export function hand(x: number, y: number, label: string, col: string, active: boolean, sc = 1): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  rr(-40, -34, 80, 80, 30, col); rr(-36, -30, 72, 36, 16, '#f2c9a0');
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-24 + k * 16, -30); ctx.lineTo(-24 + k * 16, -8); ctx.stroke(); }
  rr(-42, 36, 84, 30, 10, '#2f6fdd');
  if (active) { ctx.strokeStyle = '#ffb400'; ctx.lineWidth = 4; rr(-46, -40, 92, 110, 34, undefined, '#ffb400', 4); }
  txt(label, 0, 52, 13, '#fff', 'center', 900); ctx.restore();
}

export function headphones(x: number, y: number, sc: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 11; ctx.beginPath(); ctx.arc(0, 0, 34, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = '#666'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 34, Math.PI * 1.1, -Math.PI * 0.1); ctx.stroke();
  for (const sx of [-34, 34]) { rr(sx - 14, -6, 28, 36, 11, '#1a1a1a'); rr(sx - 10, -2, 20, 28, 9, '#ff6a00'); rr(sx - 5, 3, 10, 18, 5, '#b84400'); }
  ctx.restore();
}

/** The attacker lying down with `loops` cable coils around him (stage 4 and the "tied" interlude). */
export function tiedGuy(loops: number, struggle: number, rage: boolean, label: string): void {
  ctx.save(); ctx.translate(180, 310);
  ctx.rotate(1.5 + (rage ? Math.sin(struggle * 40) * 0.14 : Math.sin(struggle * 30) * 0.08 * (struggle > 0 ? 1 : 0)));
  person(0, 0, { sc: 2.6, shirt: '#f6f1e6', cap: true, skin: '#d9a374' });
  if (rage) { ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -28); ctx.lineTo(-6, -22); ctx.moveTo(18, -28); ctx.lineTo(6, -22); ctx.stroke(); }
  ctx.restore();
  const X0 = 228, STEP = 4.4;
  for (let i = 0; i < loops; i++) {
    const cx = X0 - i * STEP, ry = 34 + Math.sin(i * 1.3) * 2;
    ctx.strokeStyle = '#7a3300'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(cx, 310, 8, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(cx, 310, 8, ry, 0, 0, Math.PI * 2); ctx.stroke();
  }
  headphones(78, 232, 1);
  const endX = loops > 0 ? X0 - (loops - 1) * STEP : X0;
  for (const [col, lw] of [['#7a3300', 6], ['#ff6a00', 3.5]] as Array<[string, number]>) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(112, 262); ctx.quadraticCurveTo(140, 300, Math.min(endX, 228), 276); ctx.stroke();
  }
  if (loops > 0) { rr(endX - 14, 338, 14, 8, 2, '#999'); rr(endX - 20, 339, 6, 6, 1, '#ccc'); }
  rr(36, 180, 84, 24, 12, 'rgba(0,0,0,.6)'); txt(label, 78, 192, 12, '#ffb400', 'center', 900);
}

/** The family and their colours (title, cutscene, result). */
export const FAM = { dad: 'שמשון בוזגלו-שטרנליכט', mom: 'פנינה-רוז', boy: 'אוריאל-ג׳קי', girl: 'מזל-טוב' };
export const FC = { dad: '#6aa5ff', mom: '#c98bff', boy: '#ffa23a', girl: '#ff7cb8' };
export const DAD: PersonOpts = { shirt: '#2f6fdd', glasses: true, hair: false };
export const MOM: PersonOpts = { shirt: '#a64dff', longhair: true, hairCol: '#3a2a1a', hair: false, pants: '#a64dff' };
export const BOY: PersonOpts = { shirt: '#ff8c00', hair: '#222' };
export const GIRL: PersonOpts = { shirt: '#ff5fa2', hair: '#3a2a1a', bow: true, pants: '#ff5fa2' };
