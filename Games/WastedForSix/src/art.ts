// Original chunky pixel art: car sprites (top-down, facing up), the tired fan, the sunset backdrop, TV/PC.
// An homage to 90s top-down crime-driving games; no sprites, HUD, logo or font are copied from any real game.
import { W, ctx, rr, txt } from '@tsg/index';
import { blit, ptxt, sprite, type Pal } from './pixel';
import { UI } from './content';   // import cycle (content → opening → art): fine, UI is only read inside functions

export const C = {
  asphalt: '#1b1b1b', ink: '#f2f2f2', pink: '#ffcc00', teal: '#2fd1c8', yellow: '#ffcc00', sky1: '#0e0e10', sky2: '#7a1a14', sky3: '#ff8a1a',
  shirt: '#4f7fd6', shirt2: '#3a63b0', skin: '#f0b98d', hair: '#5a3a22', money: '#2fbf5b', red: '#d0202a',
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
    case 'shark': return sprite('shark', CAR, { ...base, b: '#1d1d22', r: '#2e2e36', w: '#5a6370', h: '#ffcc00' });
    case 'hr': return sprite('hr', VAN, { ...base, b: '#d8cfb4', r: '#b9ae90', o: '#d8cfb4' });
    case 'spouse': return sprite('spouse', VAN, { ...base, b: '#8a4fd0', r: '#6a37a8', o: '#a8743a' });
    default: return sprite('npc' + color, CAR, { ...base, b: color, r: shade(color) });
  }
}
function shade(hex: string): string { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.round(v * 0.75); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

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

// ---------- end screens ----------
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
  txt(UI.sticker,0, 1, sz, '#c8102e', 'center', 900);
  ctx.restore();
}
