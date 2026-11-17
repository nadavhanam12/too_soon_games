// The 8 painted portraits (boss / clerk states). First bitmap portraits on the template (DECISIONS 67): 720x960 WebP
// files in assets/portraits/, NOT inlined into index.html, and requested only after the first frame so the 300 KB /
// first-frame budget (rule 13א) is untouched. Until a file arrives the scene draws a neutral silhouette.
import { ctx, rr, txt } from '@tsg/index';
import { launchSticker } from './art';

export type PortraitId = 'boss-idle' | 'boss-agree' | 'boss-sick' | 'boss-quit' | 'clerk-idle' | 'clerk-loan' | 'clerk-steal' | 'clerk-tradein'
  | 'fiancee-idle' | 'fiancee-ring' | 'fiancee-caught' | 'fiancee-quiz' | 'fiancee-ok';
const ORDER: PortraitId[] = ['boss-idle', 'boss-agree', 'boss-sick', 'boss-quit', 'clerk-idle', 'clerk-loan', 'clerk-steal', 'clerk-tradein', 'fiancee-idle', 'fiancee-ring', 'fiancee-caught', 'fiancee-quiz', 'fiancee-ok'];
const imgs: Partial<Record<PortraitId, HTMLImageElement>> = {};
const ready = new Set<PortraitId>();
let started = false;

/** Start loading (call after the first frame). Boss images first: they are needed first. */
export function loadPortraits(): void {
  if (started) return; started = true;
  for (const id of ORDER) {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => ready.add(id);
    im.src = `assets/portraits/${id}.webp`;
    imgs[id] = im;
  }
}
export const portraitReady = (id: PortraitId): boolean => ready.has(id);
/** A portrait that has arrived, or undefined while it is still downloading. */
export const portraitImg = (id: PortraitId): HTMLImageElement | undefined => (ready.has(id) ? imgs[id] : undefined);

// The face in each character's idle portrait (centre + radius, in px of the 720-wide file). If a painting changes, retune.
export type Who = 'boss' | 'clerk' | 'fiancee';
const FACE: Record<Who, { cx: number; cy: number; r: number }> = {
  boss: { cx: 322, cy: 212, r: 138 }, clerk: { cx: 312, cy: 318, r: 138 }, fiancee: { cx: 248, cy: 228, r: 142 },
};
/** The character's face as a round badge of radius r at (x, y), with a ring. Returns false while the portrait is
 *  still downloading (expected: the files are requested after the first frame); the caller then draws nothing. */
export function drawFace(who: Who, x: number, y: number, r: number, ring: string): boolean {
  const id = `${who}-idle` as PortraitId, im = imgs[id];
  if (!im || !ready.has(id)) return false;
  const f = FACE[who], k = im.naturalWidth / 720;
  ctx.save();
  ctx.fillStyle = '#0b0b0f'; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(im, (f.cx - f.r) * k, (f.cy - f.r) * k, f.r * 2 * k, f.r * 2 * k, x - r, y - r, r * 2, r * 2);
  ctx.restore();
  return true;
}

// Source-image geometry (1086 px wide originals, same framing at 720 px): the calendar header strip in the boss art.
const SRC_W = 1086, STICKER = { cx: 948, cy: 196, w: 250, h: 72, rot: -0.2 };

/** The LAUNCH DAY sticker over the calendar header of a boss portrait drawn at (x, y), w wide. Other portraits: nothing. */
export function portraitSticker(id: PortraitId, x: number, y: number, w: number): void {
  if (!id.startsWith('boss')) return;
  const k = w / SRC_W; launchSticker(x + STICKER.cx * k, y + STICKER.cy * k, STICKER.w * k, STICKER.h * k, STICKER.rot);
}

/** Draw a portrait in a white poster frame at (x, y) with width w (3:4). Boss images get the LAUNCH DAY sticker. */
export function drawPortrait(id: PortraitId, x: number, y: number, w: number): void {
  const h = (w * 4) / 3;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  rr(x - 6, y - 6, w + 12, h + 12, 4, '#f4efe4'); ctx.restore();
  const im = imgs[id];
  if (im && ready.has(id)) {
    ctx.imageSmoothingEnabled = true; ctx.drawImage(im, x, y, w, h);
    portraitSticker(id, x, y, w);
  } else {
    rr(x, y, w, h, 0, '#2a2a2e');
    ctx.fillStyle = '#24183a'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.38, w * 0.18, 0, Math.PI * 2); ctx.fill();
    rr(x + w * 0.2, y + h * 0.58, w * 0.6, h * 0.42, w * 0.2, '#24183a');
    txt('…', x + w / 2, y + h * 0.38, 28, '#9b7fd1', 'center', 900);
  }
}
