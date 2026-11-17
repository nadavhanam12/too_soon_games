// The opening, in the painted-poster language of the portraits: full-bleed key art on the title, the cutscene as
// three comic panels (white poster frame, slow zoom, comic caption boxes) and the stage banner as a mission card.
// The four paintings are separate WebP files in assets/scenes/ (same reasoning as the portraits, DECISIONS 67).
import { W, ctx, fullBleed, rr, txt, wrap, textWidth, clamp, takeTap, easeO, easeOB, R, state, fmtInt, startFromTitle, env, type Scene } from '@tsg/index';
import { C, launchSticker, palmSil, sunset } from './art';
import { ptxt } from './pixel';

// ---------- the paintings ----------
export type SceneImg = 'title' | 'logo' | 'cut-bedroom' | 'cut-phone' | 'cut-driveway' | 'item-six';
const imgs: Partial<Record<SceneImg, HTMLImageElement>> = {};
const readyAt: Partial<Record<SceneImg, number>> = {};
function load(id: SceneImg): void {
  if (imgs[id]) return;
  const im = new Image(); im.decoding = 'async';
  im.onload = () => { readyAt[id] = performance.now(); };
  im.onerror = () => console.error(`[opening] assets/scenes/${id}.webp failed to load`);
  im.src = `assets/scenes/${id}.webp`;
  imgs[id] = im;
}
/** The title painting is on the first screen: requested as soon as the module runs. */
export function loadTitleArt(): void { load('title'); load('logo'); }
/** The three cutscene panels and the game case (item.ts): requested after the first frame. */
export function loadCutArt(): void { load('cut-bedroom'); load('cut-phone'); load('cut-driveway'); load('item-six'); }
/** A painting that has arrived, or undefined while it is still loading. */
export const sceneImg = (id: SceneImg): HTMLImageElement | undefined => (readyAt[id] === undefined ? undefined : imgs[id]);
/** 0..1 fade-in since the file arrived (0 = still loading). */
function fade(id: SceneImg): number { const t = readyAt[id]; return t === undefined ? 0 : Math.min(1, (performance.now() - t) / 350); }

/** Draw `im` covering the rect (clipped), zoomed and panned (px, py in -1..1). Returns source px → canvas mapping. */
function cover(im: HTMLImageElement, x: number, y: number, w: number, h: number, zoom = 1, px = 0, py = 0): { x: number; y: number; s: number } {
  const s = Math.max(w / im.naturalWidth, h / im.naturalHeight) * zoom;
  const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  const dx = x + (w - dw) / 2 + (px * (dw - w)) / 2, dy = y + (h - dh) / 2 + (py * (dh - h)) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(im, dx, dy, dw, dh);
  return { x: dx, y: dy, s };
}
const k01 = (t: number, from: number, dur: number): number => clamp((t - from) / dur, 0, 1);

// ---------- title ----------
/** One logo word in the pixel font: thick dark outline, hard drop shadow, lighter top half. Slams in with `k`. */
function logoWord(s: string, y: number, p: number, col: string, light: string, dark: string, k: number): void {
  if (k <= 0) return;
  const e = easeOB(k), sc = 1 + (1 - e) * 0.9, o = Math.max(2, Math.round(p * 0.4));
  ctx.save(); ctx.translate(0, y); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 3);
  ptxt(s, o + 2, o + 3, p, 'rgba(0,0,0,.55)');
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) ptxt(s, dx * o, dy * o, p, dark);
  ptxt(s, 0, 0, p, col);
  ctx.save(); ctx.beginPath(); ctx.rect(-W, -3.5 * p, W * 2, 3 * p); ctx.clip(); ptxt(s, 0, 0, p, light); ctx.restore();
  ctx.restore();
}

/**
 * The TSG NICE CITY neon logo (assets/scenes/logo.webp, painted on black), centered on (cx, cy), `w` wide. Drawn with
 * the screen blend so the black disappears and only the light stays. Returns false while the file is still loading.
 */
export function drawLogo(cx: number, cy: number, w: number, alpha = 1): boolean {
  const im = sceneImg('logo');
  if (!im) return false;
  const h = (w * im.naturalHeight) / im.naturalWidth;
  ctx.save(); ctx.globalAlpha = alpha * fade('logo'); ctx.globalCompositeOperation = 'screen'; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
  return true;
}

// ---------- the studio logo (env.studioLogo: the site's logo as a data URI, built in) ----------
let studio: HTMLImageElement | null = null, studioOk = false;
function studioLogo(): HTMLImageElement | null {
  if (!studio) {
    studio = new Image();
    studio.onload = () => { studioOk = true; };
    studio.onerror = () => console.error('[opening] the studio logo (env.studioLogo) failed to load');
    studio.src = env.studioLogo;
  }
  return studioOk ? studio : null;
}

/** A tagline line with its numbers big and yellow: "13 years. 2 delays. 0 sick days…" (Nadav, 2026-11-17).
 *  Wraps by words to `maxW`. Returns the number of lines drawn. */
function bigNumbers(line: string, cx: number, y: number, size: number, bigSize: number, col: string, numCol: string, maxW: number, lineH: number): number {
  const isNum = (s: string): boolean => /^\d+$/.test(s);
  const wOf = (s: string): number => (isNum(s) ? textWidth(s, bigSize, 900) : textWidth(s, size, 700));
  // words, each split into number / text runs; a line is a list of runs
  const words = line.split(' ').map((w) => w.split(/(\d+)/).filter((s) => s.length));
  const space = textWidth(' ', size, 700), rows: string[][][] = [[]]; let rowW = 0;
  for (const w of words) {
    const ww = w.reduce((a, s) => a + wOf(s), 0);
    if (rowW > 0 && rowW + space + ww > maxW) { rows.push([]); rowW = 0; }
    rows[rows.length - 1]!.push(w); rowW += (rowW > 0 ? space : 0) + ww;
  }
  rows.forEach((row, n) => {
    const total = row.reduce((a, w, i) => a + (i ? space : 0) + w.reduce((b, s) => b + wOf(s), 0), 0);
    let x = cx - total / 2;
    row.forEach((w, i) => {
      if (i) x += space;
      for (const s of w) {
        const num = isNum(s), fs = num ? bigSize : size, sw = wOf(s), yy = y + n * lineH;
        txt(s, x + sw / 2 + 1, yy + 1.5, fs, 'rgba(0,0,0,.7)', 'center', num ? 900 : 700);
        txt(s, x + sw / 2, yy, fs, num ? numCol : col, 'center', num ? 900 : 700);
        x += sw;
      }
    });
  });
  return rows.length;
}

// ---------- the start button's sparks: the button's own colour, rising off its edge ----------
interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; r: number }
const sparks: Spark[] = [];
let sparkAcc = 0, sparkT = -1;
/** Spawn and draw the sparks around the pill centred on (cx, cy), w × h. Spawns ~26 a second along its edge. */
function buttonSparks(cx: number, cy: number, w: number, h: number, col: string): void {
  const now = state.t, dt = sparkT < 0 ? 0 : Math.min(0.1, now - sparkT); sparkT = now;
  sparkAcc += dt * 26;
  while (sparkAcc >= 1) {
    sparkAcc--;
    const u = Math.random(), top = Math.random() < 0.7;   // along the width, mostly from the top edge
    const x = cx - w / 2 + u * w, y = cy + (top ? -h / 2 : h / 2);
    sparks.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: (top ? -1 : 0.4) * (30 + Math.random() * 50), t: 0, life: 0.7 + Math.random() * 0.6, r: 1.5 + Math.random() * 2 });
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]!;
    s.t += dt; if (s.t >= s.life) { sparks.splice(i, 1); continue; }
    s.x += s.vx * dt; s.y += s.vy * dt; s.vy -= 40 * dt;   // they float up and drift
    const k = 1 - s.t / s.life;
    ctx.globalAlpha = k; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.6 + 0.4 * k), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export const titleScene: Scene = {
  draw() {
    const st = state.st, th = R.theme, c = R.content.title, s = R.strs;
    th.bg(st, 'title');
    fullBleed((h) => {
      const a = fade('title'), im = imgs.title;
      // until the painting arrives (a separate file, by design) the pixel sunset holds the screen
      if (a < 1) { sunset(0, h * 0.6, st); palmSil(40, h * 0.6, 1); palmSil(322, h * 0.6, 0.9); rr(0, h * 0.6, W, h * 0.4, 0, '#34323a'); }
      if (a > 0 && im) { ctx.globalAlpha = a; cover(im, 0, 0, W, h, 1.05 + 0.03 * Math.sin(st * 0.3), Math.sin(st * 0.19) * 0.7, 0); ctx.globalAlpha = 1; }
      // scrims: the logo sits on the top one, the text and the button on the bottom one
      let g = ctx.createLinearGradient(0, 0, 0, h * 0.4); g.addColorStop(0, 'rgba(10,10,12,.94)'); g.addColorStop(0.55, 'rgba(10,10,12,.6)'); g.addColorStop(1, 'rgba(10,10,12,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, h * 0.4);
      g = ctx.createLinearGradient(0, h * 0.55, 0, h); g.addColorStop(0, 'rgba(10,10,12,0)'); g.addColorStop(0.45, 'rgba(10,10,12,.82)'); g.addColorStop(1, 'rgba(10,10,12,.97)');
      ctx.fillStyle = g; ctx.fillRect(0, h * 0.55, W, h * 0.45);
    });

    // logo: the neon sign pops in and flickers on like a tube warming up, then breathes; the old name is the
    // subtitle under it (it keeps the password hint), then the sticker is slapped on
    const nk = k01(st, 0.05, 0.6);
    if (nk > 0) {
      const lit = nk < 1 ? (Math.sin(st * 70) > 0.2 ? 1 : 0.25) : 0.94 + 0.06 * Math.sin(st * 2.2);
      const sc = 0.8 + 0.2 * easeOB(Math.min(1, nk * 1.8));
      ctx.save(); ctx.translate(W / 2, 122); ctx.scale(sc, sc);
      // the logo is a separate file: until it arrives the name holds its place in the pixel font
      if (!drawLogo(0, 0, 316, lit)) logoWord('NICE CITY', 0, 6, '#ff3fa4', '#ff9fd0', '#1a0010', nk);
      ctx.restore();
    }
    const uk = k01(st, 0.45, 0.25);
    if (uk > 0) { ctx.globalAlpha = uk; ptxt('CALLING IN WASTED', W / 2, 240 + (1 - easeO(uk)) * 8, 2, C.yellow, 'center', 'rgba(0,0,0,.7)'); ctx.globalAlpha = 1; }
    const sk = k01(st, 0.7, 0.22);
    if (sk > 0) { const e = easeOB(sk); ctx.save(); ctx.translate(304, 38); ctx.scale(2 - e, 2 - e); ctx.globalAlpha = sk; launchSticker(0, 0, 104, 28, 0.1); ctx.restore(); }

    // tagline
    const lk = k01(st, 0.4, 0.3);
    ctx.globalAlpha = lk;
    let y = 414 + (1 - easeO(lk)) * 14;
    // the first line has its numbers big and yellow; '\n' in a line is a line break
    c.lines.forEach((line, n) => {
      if (n === 0) { y += 26 * bigNumbers(line, W / 2, y, 15, 24, '#fff', th.colors.accent, W - 40, 26); return; }
      for (const part of line.split('\n')) for (const l of wrap(part, 15, W - 48, 700)) { txt(l, W / 2 + 1, y + 1.5, 15, 'rgba(0,0,0,.7)', 'center', 700); txt(l, W / 2, y, 15, '#fff', 'center', 700); y += 22; }
    });
    // challenge from a friend, or how many played; your best
    if (R.challenge) {
      const words = R.content.result.resultWords({ score: R.challenge.score, durationS: 0, won: true });
      rr(24, 499, W - 48, 30, 15, 'rgba(14,14,16,.85)', th.colors.accent, 1.5);
      txt(s.challenge(R.challenge.nick || s.aFriend, words), W / 2, 515, 13, th.colors.accent, 'center', 900);
    } else if (R.players !== null && R.players > 0) txt(s.playersPlayed(fmtInt(R.players)), W / 2, 516, 13, th.colors.muted, 'center', 700);
    if (R.best > 0) txt(`${s.yourBest}: ${R.content.result.resultWords({ score: R.best, durationS: 0, won: true })}`, W / 2, 540, 13, th.colors.muted, 'center', 700);
    ctx.globalAlpha = 1;

    // the button: chunky arcade pill with a hard edge, breathing a little. The whole screen starts the game.
    const bk = k01(st, 0.5, 0.3);
    if (bk > 0) {
      const sc = (0.85 + 0.15 * easeOB(bk)) * (1 + 0.025 * Math.sin(st * 4.5));
      buttonSparks(W / 2, 582 - 1, 256 * sc, 50 * sc, th.colors.accent);
      ctx.save(); ctx.translate(W / 2, 582); ctx.scale(sc, sc); ctx.globalAlpha = bk;
      rr(-128, -21, 256, 50, 25, '#8a6a00');
      ctx.save(); ctx.shadowColor = 'rgba(255,204,0,.55)'; ctx.shadowBlur = 18; rr(-128, -26, 256, 50, 25, th.colors.accent); ctx.restore();
      rr(-122, -22, 244, 20, 12, 'rgba(255,255,255,.28)');
      txt(s.tapToStart.toUpperCase(), 0, 0, 18, th.colors.accentInk, 'center', 900);
      ctx.restore();
    }
    // credit line with the studio logo after it
    if (c.credit) {
      const logo = studioLogo(), lw = logo ? 18 : 0, tw = textWidth(c.credit, 11, 400), x0 = W / 2 - (tw + (lw ? lw + 6 : 0)) / 2;
      txt(c.credit, x0 + tw / 2, 626, 11, th.colors.muted, 'center', 400);
      if (logo) { ctx.imageSmoothingEnabled = true; ctx.drawImage(logo, x0 + tw + 6, 626 - lw / 2, lw, lw * (logo.naturalHeight / logo.naturalWidth)); }
    }

    const p = takeTap();
    if (p && st > 0.3) startFromTitle();
  },
};

// ---------- cutscene: comic panels ----------
const PANELS: SceneImg[] = ['cut-bedroom', 'cut-phone', 'cut-driveway'];
const TILT = [-0.022, 0.02, -0.012];
const PW = 316, PH = (PW * 4) / 3, PCX = W / 2, PCY = 46 + PH / 2;
type Overlay = (st: number) => void; // drawn in the painting's own pixel space (720 px wide)

/** Dark backdrop with halftone dots and a warm glow behind the panel (the cutscene's drawCutsceneBg hook). */
export function comicBackdrop(st: number): void {
  fullBleed((h) => {
    const g = ctx.createRadialGradient(W / 2, h * 0.42, 40, W / 2, h * 0.42, h * 0.7);
    g.addColorStop(0, '#5a1a14'); g.addColorStop(0.6, '#1c1214'); g.addColorStop(1, '#0e0e10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = 'rgba(255,204,0,.1)';
    const drift = (st * 6) % 16;
    for (let y = -16; y < h + 16; y += 16) for (let x = (Math.round(y / 16) % 2) * 8 - 8; x < W + 8; x += 16) {
      const r = 1 + 2.4 * clamp(1 - Math.abs(y - h * 0.42) / (h * 0.6), 0, 1);
      ctx.beginPath(); ctx.arc(x + drift, y + drift, r, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function panelFrame(i: number, st: number, live: boolean, overlay?: Overlay): void {
  const id = PANELS[i]!, im = imgs[id], a = fade(id);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  rr(-PW / 2 - 7, -PH / 2 - 7, PW + 14, PH + 14, 3, '#f4efe4');
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(-PW / 2, -PH / 2, PW, PH); ctx.clip();
  rr(-PW / 2, -PH / 2, PW, PH, 0, '#232327');
  if (a > 0 && im) {
    // slow push-in while the panel is on top; panels alternate their drift direction
    const k = live ? easeO(Math.min(1, st / 8)) : 1, dir = i % 2 ? 1 : -1;
    ctx.globalAlpha = a;
    const m = cover(im, -PW / 2, -PH / 2, PW, PH, 1.1 - 0.07 * k, dir * (0.8 - 1.2 * k), 0.3 - 0.5 * k);
    if (overlay) { ctx.save(); ctx.translate(m.x, m.y); const s = (m.s * im.naturalWidth) / 720; ctx.scale(s, s); overlay(st); ctx.restore(); }
    ctx.globalAlpha = 1;
  } else txt('…', 0, 0, 30, '#b4b4bc', 'center', 900); // the painting is still on its way
  // the alarm: the bedroom blinks red for the first moments
  if (live && id === 'cut-bedroom' && st < 1.5 && Math.sin(st * 28) > 0) { ctx.fillStyle = 'rgba(255,40,40,.2)'; ctx.fillRect(-PW / 2, -PH / 2, PW, PH); }
  if (!live) { ctx.fillStyle = 'rgba(10,10,12,.55)'; ctx.fillRect(-PW / 2, -PH / 2, PW, PH); }
  ctx.restore();
  rr(-PW / 2, -PH / 2, PW, PH, 0, undefined, 'rgba(0,0,0,.55)', 1.5);
}

/** Comic box: flat fill, black line, hard offset shadow. (x, y) = top-left. */
export function comicBox(x: number, y: number, w: number, h: number, fill: string): void {
  rr(x + 4, y + 4, w, h, 2, '#000'); rr(x, y, w, h, 2, fill, '#000', 2.5);
}

/**
 * One cutscene step: panel `i` slides onto the pile of the earlier panels, with a time-stamp box on its top-left
 * corner and the caption box across its bottom edge. The template draws "tap to continue" / the button / Skip.
 */
export function comicPanel(i: number, st: number, stamp: string, text: string, overlay?: Overlay): void {
  // the pile: earlier panels stay underneath, pushed aside and dimmed
  for (let j = Math.max(0, i - 2); j < i; j++) {
    ctx.save(); ctx.translate(PCX - (i - j) * 9, PCY + (i - j) * 5); ctx.rotate(TILT[j]! * 3.2 + (j % 2 ? 0.03 : -0.03));
    panelFrame(j, 99, false); ctx.restore();
  }
  const k = Math.min(1, st / 0.38), e = easeOB(k);
  const buzz = PANELS[i] === 'cut-phone' && st > 0.4 && st < 1 ? Math.sin(st * 75) * 2.5 : 0; // the phone vibrates
  ctx.save(); ctx.translate(PCX + (1 - e) * (W + 40) + buzz, PCY); ctx.rotate(TILT[i]! + (1 - e) * 0.3);
  panelFrame(i, st, true, overlay);
  ctx.restore();

  // time stamp, top-left, slightly tilted
  const sk = k01(st, 0.25, 0.2);
  if (sk > 0) {
    const label = stamp.toUpperCase(), w = textWidth(label, 12, 900) + 22;
    ctx.save(); ctx.translate(12 + w / 2, 44); ctx.rotate(-0.035); ctx.scale(easeOB(sk), easeOB(sk));
    comicBox(-w / 2, -13, w, 26, C.yellow); txt(label, 0, 1, 12, '#0e0e10', 'center', 900);
    ctx.restore();
  }
  // caption, across the bottom edge of the panel
  const ck = k01(st, 0.32, 0.25);
  if (ck > 0) {
    const lines = text.split('\n').flatMap((part) => wrap(part, 15, W - 84, 800)), h = lines.length * 21 + 20, y0 = 458 + (1 - easeOB(ck)) * 24;
    ctx.globalAlpha = ck;
    comicBox(26, y0, W - 56, h, '#fffbe9');
    lines.forEach((l, n) => txt(l, W / 2 - 2, y0 + 21 + n * 21, 15, '#0e0e10', 'center', 800));
    ctx.globalAlpha = 1;
  }
}

/** The boss's text message, typed onto the blank phone screen of the phone painting (LCD rect in 720-wide px;
 *  pixel size 4 fits 10 characters a line and 10 lines). */
const LCD = { x: 226, y: 142, w: 260, h: 392 };
export function phoneMessage(lines: readonly string[]): Overlay {
  return (st) => {
    let left = Math.floor((st - 0.9) * 45); // typewriter, after the buzz
    lines.forEach((l, n) => {
      if (left <= 0) return;
      ptxt(l.slice(0, left), LCD.x + LCD.w / 2, LCD.y + 34 + n * 36, 4, '#1f3a1f');
      left -= l.length;
    });
  };
}

// ---------- stage banner: mission card ----------
/** theme.banner: "1 · THE COMMUTE" becomes a tilted yellow band with a big number; under it the first line is the mission (big, yellow), then a divider and the other lines as a checklist. */
export function missionCard(title: string, lines: string[], t: number): void {
  const cut = title.indexOf(' · '), num = cut > 0 ? title.slice(0, cut) : '', name = cut > 0 ? title.slice(cut + 3) : title;
  const e = easeOB(Math.min(1, t / 0.3));
  ctx.save(); ctx.translate(W / 2, 250); ctx.rotate(-0.055); ctx.translate((e - 1) * (W + 80), 0);
  ctx.fillStyle = '#000'; ctx.fillRect(-W, -30, W * 2, 76);
  ctx.fillStyle = C.yellow; ctx.fillRect(-W, -36, W * 2, 72);
  ctx.fillStyle = C.red; ctx.fillRect(-W, 28, W * 2, 8);
  if (num) { ptxt(num, -W / 2 + 30, -3, 7, '#0e0e10', 'left', 'rgba(0,0,0,.25)'); ptxt(name, -W / 2 + 30 + num.length * 42 + 14, -2, 3, '#0e0e10', 'left'); }
  else ptxt(name, 0, -2, 3, '#0e0e10', 'center');
  ctx.restore();

  // lines[0] is the mission (the one thing to do): bigger, yellow, alone above a divider. The rest are the how-to checklist.
  const head = wrap(lines[0] ?? '', 17, W - 96, 900);
  const rows = lines.slice(1).map((l) => wrap(l, 14, W - 110, 700)), n = rows.reduce((a, r) => a + r.length, 0);
  const h = head.length * 23 + (rows.length ? 14 + n * 20 + rows.length * 8 : 0) + 22, y0 = 318, pk = k01(t, 0.15, 0.25);
  if (pk <= 0) return;
  ctx.globalAlpha = pk;
  rr(24, y0 + (1 - easeOB(pk)) * 20, W - 48, h, 10, 'rgba(14,14,16,.9)', 'rgba(255,255,255,.14)', 1.5);
  let y = y0 + 26;
  for (const l of head) { txt(l, 42, y, 17, C.yellow, 'left', 900); y += 23; }
  if (rows.length) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(42, y - 8, W - 84, 1.5); y += 12; }
  rows.forEach((r, i) => {
    const lk = k01(t, 0.35 + i * 0.09, 0.22), dx = (1 - easeOB(lk)) * -22;
    ctx.globalAlpha = lk;
    txt('›', 46 + dx, y - 1, 18, C.yellow, 'center', 900);
    for (const l of r) { txt(l, 60 + dx, y, 14, '#fff', 'left', 700); y += 20; }
    y += 8;
  });
  ctx.globalAlpha = 1;
  if (t > 0.5 && Math.sin(state.t * 5) > -0.2) txt(R.strs.tapToContinue, W / 2, y0 + h + 28, 13, R.theme.colors.muted, 'center', 700);
}
