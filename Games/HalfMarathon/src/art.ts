// Drawing kit of "Half a Marathon, Whole Halloumi": the runner (back and side view), the crowd, the wife and the baby,
// cats, cups, halloumi, the Cyprus seafront, the finish arch and the sweeper bus. Flat vector shapes, safe-zone units.
// Everyone is generic (research.md section 7): no faces, no names, no real landmarks.
import { ctx, W, rr, circ, txt, wrap, clamp } from '@tsg/index';

export const C = {
  sky: '#8fd3f4', sky2: '#d7f1ff', sea: '#1f7fbf', sea2: '#3aa0d8', sand: '#f1d8a0', road: '#6b7280', road2: '#596170',
  ink: '#0b2545', orange: '#ff8a00', tank: '#ff8a00', shorts: '#0b2545', skin: '#f2c9a0', blonde: '#f3d36b', cap: '#ffffff',
  sun: '#ffd23f', palm: '#2f8f4e', trunk: '#8a5a2b', brick: '#b5523b', brick2: '#8f3f2d',
};

export interface PersonOpts { sc?: number; shirt?: string; skin?: string; hair?: string | false; back?: boolean; longhair?: boolean; sunburn?: boolean }

/** A person from the waist up (crowd, volunteers). */
export function person(x: number, y: number, o: PersonOpts = {}): void {
  const sc = o.sc || 1, skin = o.sunburn ? '#ff9f8a' : o.skin || C.skin;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  if (o.longhair && o.hair) rr(-12, -28, 24, 30, 9, o.hair);
  rr(-12, -8, 24, 26, 8, o.shirt || '#2f6fdd');
  circ(0, -18, 10, skin);
  if (o.hair !== false) { if (o.back) circ(0, -19, 10, o.hair || '#3a2a1a'); else rr(-10, -28, 20, 7, 4, o.hair || '#3a2a1a'); }
  ctx.restore();
}

/** The runner seen from behind (stage 1). `t` animates the legs. */
export function runnerBack(x: number, y: number, sc: number, t: number, speed = 1): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  const lg = Math.sin(t * 20 * Math.max(0.4, speed)) * 6;
  rr(-9, 10, 7, 14 + lg, 3, C.skin); rr(2, 10, 7, 14 - lg, 3, C.skin);
  rr(-11, 6, 22, 10, 4, C.shorts);
  rr(-12, -8, 24, 18, 8, C.tank);
  circ(0, -18, 10, C.skin); circ(0, -19, 10, '#5a3d24');
  rr(-11, -26, 22, 7, 3, C.cap);
  ctx.restore();
}

/** The runner from the side, running to the right (stages 2-5). */
export function runnerSide(x: number, y: number, sc: number, t: number, speed = 1, tired = 0): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  const ph = t * (8 + 10 * clamp(speed, 0.2, 1.5)), sw = Math.sin(ph), lean = 0.12 + clamp(speed, 0, 1.5) * 0.1 - tired * 0.15;
  ctx.rotate(lean);
  ctx.lineCap = 'round';
  const limb = (x0: number, y0: number, a: number, l1: number, l2: number, bend: number, col: string, w: number) => {
    const kx = x0 + Math.sin(a) * l1, ky = y0 + Math.cos(a) * l1;
    const fx = kx + Math.sin(a + bend) * l2, fy = ky + Math.cos(a + bend) * l2;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  };
  limb(0, 4, -sw * 0.8, 16, 16, sw > 0 ? -0.9 : -0.2, '#d9ad84', 7);   // back leg
  limb(0, -16, sw * 0.9, 11, 11, 1.5, '#d9ad84', 5);                   // back arm
  rr(-9, -2, 18, 10, 4, C.shorts);
  rr(-9, -24, 18, 24, 7, C.tank);
  txt('21', 1, -12, 8, C.ink, 'center', 900);
  limb(0, 4, sw * 0.8, 16, 16, sw < 0 ? -0.9 : -0.2, C.skin, 7);       // front leg
  limb(0, -16, -sw * 0.9, 11, 11, 1.5, C.skin, 5);                     // front arm
  circ(2, -34, 9, C.skin);
  ctx.fillStyle = '#5a3d24'; ctx.beginPath(); ctx.arc(1, -36, 9, Math.PI * 0.95, Math.PI * 1.9); ctx.fill();
  rr(-6, -45, 15, 6, 3, C.cap); rr(6, -41, 9, 3, 2, C.cap);
  if (tired > 0.3) { ctx.fillStyle = '#7fd3ff'; circ(12, -32 + ((t * 30) % 10), 2); }
  ctx.restore();
}

/** The wife: a generic blonde silhouette with a sign. `wave` animates the free arm. */
export function wife(x: number, y: number, sc: number, t: number, sign = 'RUN!!!'): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  rr(-13, -30, 26, 34, 10, C.blonde);
  rr(-12, -8, 24, 28, 8, '#ff5f8f');
  circ(0, -18, 10, C.skin);
  rr(-11, -29, 22, 8, 4, C.blonde);
  const up = Math.sin(t * 6) * 4;
  ctx.strokeStyle = C.skin; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(20, -30 + up); ctx.stroke();
  rr(4, -60 + up, 44, 26, 4, '#ffffff', C.ink, 2);
  txt(sign, 26, -47 + up, 10, '#c8102e', 'center', 900);
  ctx.restore();
}

/** The baby: a small round generic figure, arms up when `cheer`. No name, no gender, no detail (DECISIONS 64). */
export function baby(x: number, y: number, sc: number, t: number, cheer = true): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  const up = cheer ? Math.abs(Math.sin(t * 7)) * 5 : 0;
  ctx.strokeStyle = C.skin; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-12, cheer ? -16 - up : 2); ctx.moveTo(6, -2); ctx.lineTo(12, cheer ? -16 - up : 2); ctx.stroke();
  rr(-8, -6, 16, 16, 7, '#ffe08a');
  circ(0, -13, 8, C.skin);
  circ(-3, -14, 1.2, '#222'); circ(3, -14, 1.2, '#222');
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -11, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.restore();
}

/** A street cat walking (side view). */
export function cat(x: number, y: number, sc: number, t: number, col = '#e08a3c'): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  const lg = Math.sin(t * 14) * 3;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, -8, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
  circ(-14, -14, 6, col);
  ctx.beginPath(); ctx.moveTo(-19, -18); ctx.lineTo(-17, -25); ctx.lineTo(-14, -19); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-12, -19); ctx.lineTo(-9, -25); ctx.lineTo(-8, -17); ctx.fill();
  rr(-10 + lg, -4, 4, 9, 2, col); rr(6 - lg, -4, 4, 9, 2, col);
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(13, -9); ctx.quadraticCurveTo(24, -14, 20, -26 + Math.sin(t * 5) * 3); ctx.stroke();
  circ(-16, -15, 1.1, '#111');
  ctx.restore();
}

export type Item = 'water' | 'sports' | 'halloumi' | 'gyros' | 'loukoumades' | 'coffee' | 'ouzo';
export const FOOD: ReadonlySet<Item> = new Set<Item>(['halloumi', 'gyros', 'loukoumades', 'coffee']);
/** Water-station items on the table. */
export function item(kind: Item, x: number, y: number, sc = 1): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  if (kind === 'halloumi') {
    rr(-13, -16, 26, 16, 3, '#fffbe8', '#e3d9b0', 1.5);
    ctx.strokeStyle = '#c98b3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(-3, -4); ctx.moveTo(-1, -12); ctx.lineTo(5, -4); ctx.moveTo(7, -12); ctx.lineTo(11, -6); ctx.stroke();
  } else if (kind === 'gyros') {
    ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(0, -30); ctx.lineTo(12, -2); ctx.fill();
    ctx.fillStyle = '#8a4b22'; ctx.fillRect(-6, -18, 12, 5); ctx.fillStyle = '#3ddc84'; ctx.fillRect(-5, -23, 10, 3); ctx.fillStyle = '#ff5a3c'; circ(0, -12, 2.5);
    rr(-12, -6, 24, 6, 2, '#ffffff');
  } else if (kind === 'loukoumades') {
    rr(-14, -6, 28, 6, 3, '#ffffff');
    for (const [dx, dy] of [[-7, -10], [0, -11], [7, -10], [-3, -17], [4, -17]] as const) circ(dx, dy, 4.5, '#d9902f');
    ctx.fillStyle = 'rgba(255,200,60,.8)'; ctx.fillRect(-9, -15, 18, 2);
  } else if (kind === 'coffee') {
    rr(-8, -16, 16, 16, 3, '#ffffff', '#c9c9c9', 1.5); rr(-6, -14, 12, 4, 2, '#5a3517');
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(10, -9, 4, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(-2, -20); ctx.quadraticCurveTo(2, -24, -1, -28); ctx.stroke();
  } else if (kind === 'ouzo') {
    rr(-7, -30, 14, 30, 3, 'rgba(240,250,255,.9)', '#9fb4c4', 1.5); rr(-3, -38, 6, 9, 2, '#9fb4c4');
    rr(-7, -20, 14, 9, 1, '#1f4fa0'); txt('OUZO', 0, -15.5, 5, '#fff', 'center', 900);
  } else {
    const col = kind === 'water' ? '#7fd3ff' : '#ffb347';
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.moveTo(-10, -24); ctx.lineTo(10, -24); ctx.lineTo(7, 0); ctx.lineTo(-7, 0); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-9, -17); ctx.lineTo(9, -17); ctx.lineTo(7, -1); ctx.lineTo(-7, -1); ctx.fill();
  }
  ctx.restore();
}

/** A pint of beer (the Brits). */
export function pint(x: number, y: number, sc = 1): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  rr(-6, -18, 12, 18, 2, '#f2a71b'); rr(-6, -21, 12, 5, 2, '#fffbe8');
  ctx.restore();
}

/** Sun with soft rays. */
export function sun(x: number, y: number, r: number, t: number, shades = false): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.2);
  ctx.fillStyle = 'rgba(255,210,63,.35)';
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillRect(r * 1.1, -3, r * 0.5, 6); }
  ctx.restore();
  circ(x, y, r, C.sun);
  if (shades) {
    rr(x - r * 0.75, y - r * 0.28, r * 0.65, r * 0.38, 5, '#111'); rr(x + r * 0.1, y - r * 0.28, r * 0.65, r * 0.38, 5, '#111'); rr(x - r * 0.12, y - r * 0.2, r * 0.25, 3, 1, '#111');
    ctx.strokeStyle = '#b5523b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y + r * 0.2, r * 0.35, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
}

export function palm(x: number, y: number, sc: number, t: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.strokeStyle = C.trunk; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -40, 2, -80); ctx.stroke();
  ctx.fillStyle = C.palm;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(t * 1.5 + i) * 0.05;
    ctx.save(); ctx.translate(2, -80); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(18, 0, 22, 6, 0.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

/** Sky + sea + promenade background for the side-view stages. `off` scrolls the parallax. */
export function seafront(off: number, t: number, H: number, hot = 0): void {
  const g = ctx.createLinearGradient(0, -220, 0, 300);
  g.addColorStop(0, hot > 0.5 ? '#ffb36b' : C.sky); g.addColorStop(1, C.sky2);
  ctx.fillStyle = g; ctx.fillRect(-10, -220, W + 20, 520);
  sun(290, 90, 30 + hot * 10, t, hot > 0.5);
  ctx.fillStyle = C.sea; ctx.fillRect(-10, 250, W + 20, 70);
  ctx.fillStyle = C.sea2; for (let i = 0; i < 9; i++) { const x = ((i * 60 - off * 0.2) % (W + 60) + W + 60) % (W + 60) - 30; ctx.fillRect(x, 262 + (i % 3) * 16, 26, 3); }
  ctx.fillStyle = C.sand; ctx.fillRect(-10, 320, W + 20, 40);
  for (let i = 0; i < 4; i++) { const x = ((i * 130 - off * 0.6) % 520 + 520) % 520 - 60; palm(x, 360, 1, t); }
  ctx.fillStyle = C.road; ctx.fillRect(-10, 360, W + 20, H + 300);
  ctx.fillStyle = C.road2; for (let i = 0; i < 8; i++) { const x = ((i * 70 - off) % 560 + 560) % 560 - 70; ctx.fillRect(x, 468, 36, 5); }
}

/** A finish arch with "21.1". */
export function arch(x: number, y: number, sc = 1): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  rr(-74, -150, 16, 150, 4, '#0b2545'); rr(58, -150, 16, 150, 4, '#0b2545');
  rr(-84, -176, 168, 40, 10, C.orange);
  txt('FINISH · 21.1', 0, -156, 18, '#fff', 'center', 900);
  ctx.restore();
}

/** The sweeper bus (lose screen). */
export function bus(x: number, y: number, sc: number, t: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  rr(-90, -70, 180, 64, 12, '#f2f2f2', '#0b2545', 3);
  for (let i = 0; i < 5; i++) {
    rr(-80 + i * 32, -60, 26, 22, 4, '#8fd3f4');
    circ(-67 + i * 32, -46, 6, i % 2 ? C.skin : '#ff9f8a'); rr(-73 + i * 32, -55, 12, 4, 2, i % 3 ? '#3a2a1a' : C.blonde);
    if (i % 2 === 0) { ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.moveTo(-62 + i * 32, -42); ctx.lineTo(-58 + i * 32, -54); ctx.lineTo(-54 + i * 32, -42); ctx.fill(); }
  }
  rr(40, -86, 50, 16, 5, '#7fd3ff'); txt('❄ AC', 65, -78, 9, '#0b2545', 'center', 900);
  rr(-90, -32, 180, 10, 0, C.orange);
  txt('SWEEPER BUS', 0, -14, 12, '#0b2545', 'center', 900);
  for (const wx of [-56, 56]) { circ(wx, -4, 13, '#222'); circ(wx, -4, 5, '#999'); }
  ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 3; i++) circ(-100 - i * 14 - ((t * 30) % 14), -12 - i * 4, 4 + i * 2);
  ctx.restore();
}

/** Speech bubble with a tail. */
export function bubble(s: string, x: number, y: number, sz = 12, bg = '#fff', fg = '#111', tx: number | null = null, ty: number | null = null): void {
  const lines = wrap(s, sz, 260, 700);
  let w = 0; lines.forEach((l) => { w = Math.max(w, ctx.measureText(l).width); }); w += 20;
  const lh = sz + 5, h = lines.length * lh + 10;
  x = clamp(x, w / 2 + 6, W - w / 2 - 6);
  if (tx !== null) {
    const ax = clamp(tx, x - w / 2 + 14, x + w / 2 - 14), dir = (ty ?? y + 40) > y ? 1 : -1, by = y + (dir * h) / 2;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(ax - 7, by); ctx.lineTo(ax + 7, by); ctx.lineTo(tx, ty ?? y + h / 2 + 14); ctx.fill();
  }
  rr(x - w / 2, y - h / 2, w, h, 11, bg);
  lines.forEach((l, i) => txt(l, x, y - h / 2 + 5 + lh * i + lh / 2, sz, fg, 'center', 700));
}

/** Flat pill button (stage UI). */
export function btn(s: string, x: number, y: number, w: number, h: number, col = C.orange, fg = '#fff', sz = 18): void {
  rr(x - w / 2, y - h / 2, w, h, h / 2, col); txt(s, x, y + 1, sz, fg, 'center', 900);
}

/** Confetti in the studio colours. */
export function confetti(t: number, n = 40, top = 0, span = 420): void {
  for (let i = 0; i < n; i++) {
    const cx = ((i * 53 + t * 30 * (1 + (i % 3))) % (W + 20)) - 10, cy = ((i * 97 + t * (60 + (i % 5) * 20)) % span) + top;
    ctx.fillStyle = [C.orange, '#ffffff', C.sun, '#1f7fbf'][i % 4]!; ctx.fillRect(cx, cy, 6, 10);
  }
}

/** A sunbather on the sand; `burn` 0..1 turns them lobster red. */
export function sunbather(x: number, y: number, burn: number): void {
  const r = Math.round(242 + (255 - 242) * burn), g = Math.round(201 - 110 * burn), b = Math.round(160 - 100 * burn);
  const skin = `rgb(${r},${g},${b})`;
  rr(x - 30, y - 4, 64, 8, 3, '#ff5f8f');
  rr(x - 24, y - 11, 40, 9, 4, skin); circ(x + 22, y - 8, 6, skin); rr(x - 6, y - 12, 12, 5, 2, '#1f7fbf');
  rr(x + 18, y - 16, 10, 4, 2, '#111');
  if (burn > 0.6) txt('!', x + 34, y - 20, 12, '#ff3b3b', 'center', 900);
}
