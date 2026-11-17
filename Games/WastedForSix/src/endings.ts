// The two end screens, in the painted-poster language of the rest of the game (the template still owns their
// texts, buttons and logic; this file draws everything around them through the art hooks and the theme):
//   lose   — a gray freeze-frame of whoever ended your run across the top, a rubber stamp, the tilted WASTED band in
//            our own pixel font, and one card holding the line, the score and the timeline
//   result — "MISSION PASSED", the montage poster (montage.ts) and a store receipt that sums up how your day went
import { W, view, ctx, rr, txt, textWidth, clamp, easeO, easeOB } from '@tsg/index';
import { C, confettiPx } from './art';
import { ptxt, grayOut } from './pixel';
import { portraitImg, portraitSticker, type PortraitId } from './portraits';
import { comicBox, sceneImg } from './opening';
import { montagePoster } from './montage';
import { G, loseTimeline } from './play';
import { LOSE_STAMP, RECEIPT } from './content';

const k01 = (t: number, from: number, dur: number): number => clamp((t - from) / dur, 0, 1);

// ---------- lose ----------
const STRIP_B = 168;   // bottom of the picture strip (safe coords); the WASTED band (centre y 190) covers its edge
interface Shot { im: HTMLImageElement | undefined; id?: PortraitId; cy: number; left?: boolean }   // cy: the row (of the 720-wide file) kept in the strip's middle; left: the stamp goes on the left corner (the right one is busy)

/** The painting behind a lose reason: whoever caught you; for an empty tank or the gas-station cops, you and the car. */
function culprit(reason: string): Shot {
  const p = (id: PortraitId, cy: number, left = false): Shot => ({ im: portraitImg(id), id, cy, left });
  if (reason === 'fired') return p('boss-sick', 230, true);
  if (reason === 'shark') return p('clerk-loan', 290);
  if (reason === 'spouse') return p('fiancee-caught', 270);
  if (reason === 'cop' && G.store === 'steal') return p('clerk-steal', 330);
  return { im: sceneImg('cut-driveway'), cy: 250 };
}

function loseStrip(st: number, reason: string): void {
  const top = -view.top, h = STRIP_B - top, { im, id, cy, left } = culprit(reason);
  ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, h); ctx.clip();
  ctx.fillStyle = '#17171c'; ctx.fillRect(0, top, W, h);
  // the paintings are separate files requested after the first frame: until one lands the strip stays dark
  if (im) {
    const z = 1.14 - 0.1 * easeO(clamp(st / 1.4, 0, 1));   // settles from a slight push-in
    const iw = W * z, ih = (im.naturalHeight / im.naturalWidth) * iw, ix = (W - iw) / 2;
    const iy = clamp(top + h / 2 - cy * (iw / 720), top + h - ih, top);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(im, ix, iy, iw, ih);
    if (id) portraitSticker(id, ix, iy, iw);
    grayOut(0, top, W, h, 0.28);
    ctx.fillStyle = 'rgba(208,32,42,.14)'; ctx.fillRect(0, top, W, h);
  }
  const g = ctx.createLinearGradient(0, STRIP_B - 70, 0, STRIP_B); g.addColorStop(0, 'rgba(12,12,14,0)'); g.addColorStop(1, 'rgba(12,12,14,.95)');
  ctx.fillStyle = g; ctx.fillRect(0, STRIP_B - 70, W, 70);
  ctx.restore();

  // the verdict, stamped on the picture's corner
  const label = LOSE_STAMP[reason], sk = k01(st, 0.5, 0.2);
  if (label && sk > 0) {
    const w = textWidth(label, 14, 900) + 22, sc = 2 - easeOB(sk);
    ctx.save(); ctx.translate(left ? 18 + w / 2 : W - 18 - w / 2, 44); ctx.rotate(left ? -0.1 : 0.1); ctx.scale(sc, sc); ctx.globalAlpha = sk;
    rr(-w / 2, -15, w, 30, 3, 'rgba(14,14,16,.72)', C.red, 2.5); txt(label, 0, 1, 14, '#ff4a54', 'center', 900);
    ctx.restore();
  }
}

/** drawLoseArt hook: the strip, the card behind the template's line and consolation, and the timeline under the score. */
export function loseArt(st: number, reason: string): void {
  loseStrip(st, reason);
  rr(14, 230, W - 28, 106, 12, 'rgba(14,14,16,.8)', 'rgba(255,255,255,.1)', 1.5);   // the line + the consolation; the score and the timeline sit under it
  loseTimeline(st);
}

/** The lose heading (theme.heading on the lose screen): a tilted black band with red rules, the word slammed onto it
 *  in the pixel font (WASTED is the password: it has to read as the same letters as the graffiti and the PC). */
export function wastedBand(s: string, y: number, st: number): void {
  const k = k01(st, 0.1, 0.22), p = Math.min(7, Math.floor((W - 40) / (s.length * 6)));
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-0.045);
  ctx.fillStyle = '#000'; ctx.fillRect(-W, -34, W * 2, 68);
  ctx.fillStyle = C.red; ctx.fillRect(-W, -34, W * 2, 4); ctx.fillRect(-W, 30, W * 2, 4);
  if (k > 0) {
    const sc = 1 + (1 - easeO(k)) * 1.6;
    ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 2);
    ptxt(s, 0, 0, p, C.red, 'center', '#4a0a0e');
  }
  ctx.restore();
}

// ---------- result ----------
/** The receipt: one row per thing the run decided. Slides in from the right, the rows print one after the other. */
function receipt(st: number): void {
  const k = k01(st, 0.2, 0.35);
  if (k <= 0) return;
  const x = 198, y = 166, w = 138, h = 186, e = easeOB(k), TEETH = 12;
  // branch / store are null only when a debug hook (__go('result')) jumps here without a run: those rows are left out
  const rows: Array<[string, string]> = [];
  if (G.branch) rows.push([RECEIPT.rows.job, RECEIPT.job[G.branch]]);
  if (G.store) rows.push([RECEIPT.rows.game, RECEIPT.game[G.store]]);
  rows.push([RECEIPT.rows.letters, RECEIPT.letters(G.letters.length)], [RECEIPT.rows.pw, RECEIPT.pw(G.wrongPw)]);

  ctx.save(); ctx.translate(x + w / 2 + (1 - e) * (W - x + 20), y + h / 2); ctx.rotate(0.03 + (1 - e) * 0.15); ctx.translate(-w / 2, -h / 2);
  const paper = (o: number, col: string): void => {   // torn (zigzag) bottom edge
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(o, o); ctx.lineTo(o + w, o); ctx.lineTo(o + w, o + h);
    for (let i = 1; i <= TEETH * 2; i++) ctx.lineTo(o + w - (i * w) / (TEETH * 2), o + h + (i % 2 ? 5 : 0));
    ctx.closePath(); ctx.fill();
  };
  const dash = (dy: number): void => { ctx.strokeStyle = '#b9b3a2'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(10, dy); ctx.lineTo(w - 10, dy); ctx.stroke(); ctx.setLineDash([]); };
  paper(4, 'rgba(0,0,0,.55)'); paper(0, '#fffbe9');
  ptxt(RECEIPT.head, w / 2, 16, 1, '#0e0e10');
  dash(28);
  rows.forEach(([label, value], i) => {
    const rk = k01(st, 0.5 + i * 0.09, 0.2);
    if (rk <= 0) return;
    const ry = 44 + i * 32;
    ctx.globalAlpha = rk;
    txt(label, 12, ry, 9, '#8a8578', 'left', 900); txt(value, 12, ry + 14, 13, '#0e0e10', 'left', 900);
    ctx.globalAlpha = 1;
  });
  dash(164);
  ptxt(RECEIPT.foot, w / 2, 175, 1, '#8a8578');
  ctx.restore();
}

/** drawResultArt hook. The template draws the rank (y 72), the sentence (y 118..139) and the score panel (y 386) on top. */
export function resultArt(st: number): void {
  confettiPx(st, 28, -view.top, view.H);
  // kicker over the rank, stamped like the cutscene's time stamps
  const kk = k01(st, 0.1, 0.2);
  if (kk > 0) {
    const w = textWidth(RECEIPT.kicker, 12, 900) + 22, sc = easeOB(kk);
    ctx.save(); ctx.translate(W / 2, 30); ctx.rotate(-0.035); ctx.scale(sc, sc);
    comicBox(-w / 2, -13, w, 26, C.yellow); txt(RECEIPT.kicker, 0, 1, 12, '#0e0e10', 'center', 900);
    ctx.restore();
  }
  // the montage poster drops onto the table, a little crooked
  const pk = k01(st, 0.05, 0.35);
  if (pk > 0) {
    const e = easeOB(pk);
    ctx.save(); ctx.translate(104, 264 - (1 - e) * 40); ctx.rotate(-0.03 - (1 - e) * 0.2); ctx.globalAlpha = Math.min(1, pk * 3);
    montagePoster(-74, -92, 148, 185, G.met, st);
    ctx.restore();
  }
  receipt(st);
}
