// Original chunky pixel art: car sprites (top-down, facing up), the tired fan, title band, cutscene rooms, TV/PC.
// An homage to 90s top-down crime-driving games; no sprites, HUD, logo or font are copied from any real game.
import { W, ctx, rr, txt } from '@tsg/index';
import { blit, ptxt, sprite, type Pal } from './pixel';

export const C = {
  asphalt: '#1b1b1b', ink: '#f2f2f2', pink: '#ff3fa4', teal: '#2fd1c8', yellow: '#ffd23f', sky1: '#2b1250', sky2: '#ff3fa4', sky3: '#ff9a5a',
  shirt: '#4f7fd6', shirt2: '#3a63b0', skin: '#f0b98d', hair: '#5a3a22', money: '#5ce67a', red: '#ff4b4b',
};

// ---------- cars ----------
export type CarKind = 'player' | 'cop' | 'shark' | 'hr' | 'spouse' | 'npc';
const CAR = [
  '..hbbh..', '.bbbbbb.', 'kbwwwwbk', 'kbwwwwbk', '.bbbbbb.', '.brrrrb.', '.brrrrb.', '.brrrrb.', '.bbbbbb.', 'kbwwwwbk', 'kbbbbbbk', '.bbbbbb.', '.tbbbbt.',
];
const COP = [
  '..hbbh..', '.bbbbbb.', 'kbwwwwbk', 'kbwwwwbk', '.bbbbbb.', '.brrrrb.', '.bLLBBb.', '.brrrrb.', '.bbbbbb.', 'kbwwwwbk', 'kbbbbbbk', '.bbbbbb.', '.tbbbbt.',
];
const VAN = [
  '..hbbh..', '.bbbbbb.', 'kbwwwwbk', 'kbwwwwbk', '.brrrrb.', '.brrrrb.', 'obrrrrbo', 'obrrrrbo', 'obrrrrbo', '.brrrrb.', '.brrrrb.', 'kbwwwwbk', 'kbbbbbbk', '.bbbbbb.', '.tbbbbt.',
];
const base: Pal = { k: '#111', w: '#9fd8ff', h: '#fff6b0', t: '#ff3030' };
export function carSprite(kind: CarKind, color = '#c0c0c0', flash = 0): HTMLCanvasElement {
  switch (kind) {
    case 'player': return sprite('player', CAR, { ...base, b: '#2fd1c8', r: '#1f9e97' });
    case 'cop': return sprite('cop' + flash, COP, { ...base, b: '#f2f2f2', r: '#1c1c22', L: flash ? '#ff2a2a' : '#5a1010', B: flash ? '#103a7a' : '#3a8bff' });
    case 'shark': return sprite('shark', CAR, { ...base, b: '#1d1d22', r: '#2e2e36', w: '#5a6370', h: '#ffd23f' });
    case 'hr': return sprite('hr', VAN, { ...base, b: '#d8cfb4', r: '#b9ae90', o: '#d8cfb4' });
    case 'spouse': return sprite('spouse', VAN, { ...base, b: '#8a4fd0', r: '#6a37a8', o: '#a8743a' });
    default: return sprite('npc' + color, CAR, { ...base, b: color, r: shade(color) });
  }
}
function shade(hex: string): string { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.round(v * 0.75); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
export const NPC_COLORS = ['#e86aa6', '#f2a65a', '#9b7fd1', '#e9d36b', '#c96b5b', '#7aa7d9', '#6fbf73', '#d9d2c5'];

/** Draw a car at world/screen position, angle a (0 = east). Sprite pixel = 2 logical px. */
export function drawCar(kind: CarKind, x: number, y: number, a: number, color?: string, flash = 0): void {
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.save(); ctx.translate(x + 3, y + 4); ctx.rotate(a + Math.PI / 2); ctx.fillRect(-8, -13, 16, 26); ctx.restore();
  blit(carSprite(kind, color, flash), x, y, 2, a + Math.PI / 2);
}

// ---------- the fan: tired guy, wrinkled blue shirt, lanyard, coffee ----------
export function guy(x: number, y: number, p: number, opts: { cup?: boolean; arms?: 'up' | 'down'; t?: number } = {}): void {
  const R = (cx: number, cy: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + cx * p), Math.round(y + cy * p), Math.ceil(w * p), Math.ceil(h * p)); };
  // y = feet baseline; figure is 10 wide x 22 tall pixels, centred on x
  x -= 5 * p; y -= 22 * p;
  R(3, 20, 2, 2, '#222'); R(6, 20, 2, 2, '#222');            // shoes
  R(3, 14, 2, 6, '#2b2f45'); R(6, 14, 2, 6, '#2b2f45');      // legs
  R(2, 7, 7, 8, C.shirt); R(3, 9, 1, 1, C.shirt2); R(6, 11, 2, 1, C.shirt2); // shirt + wrinkles
  R(5, 7, 1, 4, '#d33'); R(4, 11, 2, 2, '#fff');            // lanyard + badge
  if (opts.arms === 'up') { R(0, 2, 2, 6, C.shirt); R(9, 2, 2, 6, C.shirt); R(0, 1, 2, 1, C.skin); R(9, 1, 2, 1, C.skin); }
  else { R(1, 8, 1, 6, C.shirt); R(9, 8, 1, 5, C.shirt); R(1, 14, 1, 1, C.skin); R(9, 13, 1, 1, C.skin); }
  if (opts.cup) { R(9, 11, 3, 3, '#f2f2f2'); R(9, 11, 3, 1, '#7a4a22'); }
  R(3, 2, 5, 5, C.skin);                                     // head
  R(3, 1, 5, 2, C.hair); R(2, 2, 1, 2, C.hair);              // hair
  R(4, 4, 1, 1, '#222'); R(6, 4, 1, 1, '#222');              // eyes
  R(4, 5, 1, 1, '#c98a6a'); R(6, 5, 1, 1, '#c98a6a');        // eye bags (13 years)
  R(5, 6, 1, 1, '#a0523a');
}

// ---------- backgrounds ----------
export function sunset(y0: number, y1: number, t: number): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, C.sky1); g.addColorStop(0.6, C.sky2); g.addColorStop(1, C.sky3);
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
  // striped pixel sun
  const cx = W / 2, cy = y1 - 30, r = 54;
  for (let yy = -r; yy < 0; yy += 4) {
    const w = Math.sqrt(r * r - yy * yy); const stripe = yy > -20 && (Math.floor((yy + t * 6) / 6) % 2 === 0);
    if (stripe) continue;
    ctx.fillStyle = yy < -30 ? '#ffe14a' : '#ffb03a'; ctx.fillRect(Math.round(cx - w), cy + yy, Math.round(w * 2), 4);
  }
}
export function palmSil(x: number, y: number, s: number): void {
  ctx.fillStyle = '#1a0b2e';
  for (let i = 0; i < 12; i++) ctx.fillRect(x + Math.sin(i * 0.3) * 3 * s, y - i * 6 * s, 4 * s, 6 * s);
  const tx = x + Math.sin(3.3) * 3 * s, ty = y - 72 * s;
  for (const [dx, dy] of [[-1, 0.2], [1, 0.2], [-0.8, -0.5], [0.8, -0.5], [0, -0.8]] as const) for (let k = 0; k < 6; k++) ctx.fillRect(tx + dx * k * 5 * s, ty + dy * k * 5 * s + (k * k * 0.4 * s), 6 * s, 4 * s);
}

/** Title band: the store with a line around the block, the fan's car speeding past. y0..y0+130 */
export function titleBand(y0: number, t: number): void {
  sunset(y0 - 40, y0 + 70, t);
  palmSil(30, y0 + 70, 0.9); palmSil(320, y0 + 70, 0.8);
  // store
  rr(150, y0 + 6, 150, 64, 0, '#3a2a5a');
  rr(160, y0 + 14, 130, 18, 2, '#ff3fa4'); ptxt('GAMES', 225, y0 + 23, 2, '#fff');
  rr(170, y0 + 40, 40, 30, 0, '#9fd8ff'); rr(240, y0 + 40, 40, 30, 0, '#ffe14a');
  // road
  rr(0, y0 + 70, W, 60, 0, '#34323a');
  for (let i = 0; i < 8; i++) rr(((i * 60 - t * 200) % 480 + 480) % 480 - 60, y0 + 98, 28, 3, 0, '#e9c84a');
  // the line of fans in costumes
  const cols = ['#ff3fa4', '#2fd1c8', '#ffd23f', '#9b7fd1', '#5ce67a', '#ff7a3a'];
  for (let i = 0; i < 16; i++) { const px = 300 - i * 18, py = y0 + 70 + Math.sin(t * 6 + i) * 1.5; rr(px, py - 14, 8, 10, 1, cols[i % cols.length]!); rr(px + 1, py - 20, 6, 6, 1, C.skin); if (i % 3 === 0) rr(px, py - 23, 8, 3, 0, cols[(i + 2) % cols.length]!); }
  // the car, speeding left to right
  const cx = ((t * 160) % 520) - 80;
  blit(carSprite('player'), cx, y0 + 112, 2, Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let k = 1; k < 4; k++) ctx.fillRect(cx - 18 - k * 14, y0 + 106 + k * 3, 10, 2);
}

// ---------- cutscene drawings (y 0..450, caption below) ----------
export function cutBedroom(st: number): void {
  ctx.fillStyle = '#15102a'; ctx.fillRect(0, 0, W, 450);
  // wall of tally marks: 13 years
  for (let i = 0; i < 13; i++) {
    const x = 26 + (i % 5) * 62, y = 40 + Math.floor(i / 5) * 46;
    ctx.fillStyle = '#ff3fa4'; for (let k = 0; k < 4; k++) ctx.fillRect(x + k * 9, y, 3, 26);
    ctx.fillRect(x - 4, y + 12, 40, 3);
  }
  txt('2013 → TODAY', W - 20, 172, 12, '#ff8fca', 'right', 900);
  // bed + guy
  rr(20, 300, 230, 60, 6, '#2a3566'); rr(24, 286, 60, 24, 6, '#e8e8f0'); rr(80, 290, 170, 40, 6, '#3b4a8a');
  rr(36, 278, 30, 22, 4, C.skin); rr(36, 274, 30, 8, 2, C.hair); rr(44, 288, 3, 3, 0, '#222'); rr(56, 288, 3, 3, 0, '#222');
  // alarm
  const ring = st < 3 && Math.sin(st * 30) > 0;
  rr(262, 296, 76, 44, 6, '#0c0f1e', ring ? '#ff3b3b' : '#333a5e', 2);
  ptxt('8:30', 300, 318, 3, ring ? '#ff3b3b' : '#ff8a8a');
  if (ring) ptxt('BEEP', 300, 278, 2, '#ff3b3b');
  // the box, on the nightstand
  rr(262, 360, 76, 20, 0, '#5a3a22');
  rr(280, 214, 40, 54, 3, '#111', '#ff3fa4', 2); ptxt('SIX', 300, 241, 2, '#ff3fa4');
}
export function cutPhone(st: number): void {
  ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, 0, W, 450);
  ctx.save(); ctx.translate(W / 2, 230); ctx.rotate(Math.sin(st * 20) * (st < 0.6 ? 0.04 : 0));
  rr(-110, -170, 220, 340, 18, '#2b2b33', '#555', 3);
  rr(-96, -140, 192, 250, 6, '#9fc49a');
  ptxt('NEW MESSAGE', 0, -118, 2, '#1f3a1f');
  ptxt('FROM: BOSS', 0, -92, 2, '#1f3a1f');
  const lines = ['PER MY LAST', 'EMAIL, I NEED', 'YOU IN TODAY.', '9:00 SHARP.', '', 'NO WASTING', 'TIME ;)'];
  lines.forEach((l, i) => ptxt(l, 0, -56 + i * 22, 2, '#1f3a1f'));
  rr(-40, 126, 80, 24, 12, '#44444f');
  ctx.restore();
}
export function cutDriveway(st: number): void {
  sunset(0, 300, st);
  palmSil(40, 300, 1); palmSil(330, 300, 0.9);
  ctx.fillStyle = '#4e9a52'; ctx.fillRect(0, 300, W, 150);
  rr(30, 190, 150, 110, 0, '#c96b5b'); rr(20, 176, 170, 20, 0, '#7a3a2a'); rr(90, 240, 32, 60, 0, '#5a3a22'); rr(46, 214, 30, 24, 0, '#9fd8ff');
  rr(190, 300, 170, 150, 0, '#56545c');
  blit(carSprite('player'), 280, 360, 3.4, 0);
  guy(214, 400, 3, { cup: true });
}

// ---------- end screens ----------
export function crashArt(y: number, t: number): void {
  rr(0, y, W, 90, 0, '#34323a');
  blit(carSprite('player'), W / 2, y + 46, 3, 2.6);
  for (let i = 0; i < 6; i++) { const k = (t * 0.6 + i / 6) % 1; ctx.fillStyle = `rgba(160,160,160,${0.6 * (1 - k)})`; const s = 8 + k * 18; ctx.fillRect(W / 2 + 10 + Math.sin(i * 2 + t) * 8 - s / 2, y + 30 - k * 70 - s / 2, s, s); }
}
export function tvArt(cx: number, y: number, t: number, label: string): void {
  rr(cx - 110, y, 220, 150, 10, '#2b2b33', '#555', 3);
  rr(cx - 96, y + 12, 192, 112, 6, '#120a24');
  if (Math.sin(t * 5) > -0.3) ptxt(label, cx, y + 68, 3, C.pink, 'center', '#3a0a2a');
  rr(cx - 20, y + 150, 40, 14, 0, '#1b1b22'); rr(cx - 60, y + 164, 120, 8, 4, '#1b1b22');
}
export function confettiPx(t: number, n: number, y0: number, h: number): void {
  const cols = [C.pink, C.teal, C.yellow, C.money];
  for (let i = 0; i < n; i++) { const x = (i * 47 + Math.sin(i) * 30) % W, y = y0 + ((i * 61 + t * (40 + (i % 5) * 12)) % h); ctx.fillStyle = cols[i % 4]!; ctx.fillRect(Math.round(x), Math.round(y), 4, 4); }
}

/** Paper sticker reading LAUNCH DAY, drawn over the calendar header of the boss portraits (approved 2026-11-17). */
export function launchSticker(x: number, y: number, w: number, h: number, rot: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  ctx.fillStyle = '#fff6c9'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-w * 0.12, -h / 2 - 3, w * 0.24, 6); // tape
  const sz = Math.max(8, Math.round(h * 0.52));
  txt('LAUNCH DAY', 0, 1, sz, '#c8102e', 'center', 900);
  ctx.restore();
}
