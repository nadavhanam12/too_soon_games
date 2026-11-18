// Boss buildups (Nadav, 2026-11-18: "emotional highlights before the bosses"). Two parts:
//   approach — the last stretch of a drive toward a conversation: the music ducks, a heartbeat speeds up, the screen's
//              edges go red and a band names who is waiting (legs.ts calls it every step while driving to that door).
//   vsCard   — a fighting-game style card at the start of the conversation stage, after its mini game: the portrait
//              slams in, the name is stamped, two joke stats and a meter type in, then ROUND n. A tap after VS_TAP_S
//              skips the rest (RULES 13יב: a highlight, but it never holds the player long).
import { R, W, view, ctx, state, music, rr, txt, clamp, sfx, easeO, easeOB, pop, haptic, type Tap } from '@tsg/index';
import { BUILDUP } from './content';
import { C } from './art';
import { ptxt } from './pixel';
import { drawGo, goPressed } from './button';
import { portraitImg, portraitSticker, type PortraitId, type Who } from './portraits';

// ---------- the approach ----------
export const BUILD_FAR = 80, BUILD_NEAR = 14;   // distance (u) to the door where the buildup starts / is at full strength
const DUCK_MIN = 0.4;                           // the music at full buildup (×its own volume)
const BEAT_SLOW = 1.05, BEAT_FAST = 0.42;       // seconds between heartbeats at the far / near end
const A = { k: 0, beatT: 0, beatAt: -9, who: 'boss' as Who, bandAt: -9 };

/** Call every step of a drive. `who` is waiting behind the door at distance `d`; null = no conversation ahead now. */
export function approach(who: Who | null, d: number, dt: number): void {
  const want = who ? clamp((BUILD_FAR - d) / (BUILD_FAR - BUILD_NEAR), 0, 1) : 0;
  // eases in and out, so driving past the edge of the zone does not flicker
  A.k += (want - A.k) * (1 - Math.pow(0.05, dt));
  if (who) A.who = who;
  if (A.k > 0.08 && A.bandAt < 0) A.bandAt = state.t;
  if (A.k < 0.02) A.bandAt = -9;
  music.duck = 1 - (1 - DUCK_MIN) * A.k;
  if (A.k > 0.05) {
    A.beatT -= dt;
    if (A.beatT <= 0) { A.beatT = BEAT_SLOW + (BEAT_FAST - BEAT_SLOW) * A.k; A.beatAt = state.t; sfx.heart?.(A.k); if (A.k > 0.6) haptic(12); }
  } else A.beatT = 0.2;
}
/** Back to normal (a new stage, a fail): no red edges, the music at its own volume. */
export function resetApproach(): void { A.k = 0; A.bandAt = -9; music.duck = 1; }
export const approachK = (): number => A.k;

/** Red edges that pulse with the heartbeat, and the band naming who is waiting. Draw over the world, under the HUD. */
export function renderApproach(band = true): void {
  if (A.k < 0.01) return;
  const beat = Math.exp(-(state.t - A.beatAt) * 7);   // 1 on the beat, fading fast
  const x0 = view.x0, y0 = -view.top, w = view.fullW, h = view.H, cx = x0 + w / 2, cy = y0 + h / 2;
  const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.25, cx, cy, Math.max(w, h) * 0.62);
  g.addColorStop(0, 'rgba(120,0,10,0)');
  g.addColorStop(1, `rgba(160,0,16,${(0.55 + 0.3 * beat) * A.k})`);
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  // the band: slides in from the left once, then breathes with the heartbeat
  if (A.bandAt < 0 || !band) return;   // no band while he walks in: the timeline has that spot (play.ts TL_ARRIVE_Y)
  const age = state.t - A.bandAt, slide = easeOB(clamp(age / 0.4, 0, 1)), y = 196;
  ctx.save(); ctx.globalAlpha = clamp(A.k * 2, 0, 1);
  ctx.translate((slide - 1) * (W + 80), 0);
  ctx.translate(W / 2, y); ctx.rotate(-0.05); const s = 1 + 0.05 * beat; ctx.scale(s, s);
  ctx.fillStyle = '#000'; ctx.fillRect(-W / 2 - 40 + 3, -17 + 3, W + 80, 34);
  ctx.fillStyle = '#0e0e10'; ctx.fillRect(-W / 2 - 40, -17, W + 80, 34);
  ctx.fillStyle = C.red; ctx.fillRect(-W / 2 - 40, -17, W + 80, 3); ctx.fillRect(-W / 2 - 40, 14, W + 80, 3);
  ptxt(BUILDUP.waiting[A.who], 0, 0, 2, '#ffffff', 'center', C.red);
  ctx.restore();
}

// ---------- the VS card ----------
// The card waits for its button (Nadav, 2026-11-18; it used to go on by itself after 3.1 s). A tap before the button is
// up skips the card's animation to the button.
export const VS_GO_AT = 2.3;  // the button appears (ROUND n has landed)
const VS_GO_Y = 614;
const VS_OUT_S = 0.3;        // fade to the conversation
const SLAM_AT = 0.18, NAME_AT = 0.55, STAT_AT = [0.85, 1.1], METER_AT = 1.35, ROUND_AT = 1.95;
const V = { t: -1, who: 'boss' as Who, portrait: 'boss-idle' as PortraitId, name: '', out: -1, fired: 0, then: (): void => {} };

export function startVs(who: Who, portrait: PortraitId, name: string, then: () => void): void {
  Object.assign(V, { t: 0, who, portrait, name, out: -1, fired: 0, then });
  music.duck = 0.25;
}
export const vsOn = (): boolean => V.t >= 0;
/** Read-only for the playthrough bot (__peek): seconds into the card, or null. */
export const vsPeek = (): number | null => (V.t < 0 || V.out >= 0 ? null : +V.t.toFixed(1));
/** Off at once (a stage change mid-card). */
export function stopVs(): void { V.t = -1; }
/** One step. True while the card holds the input (the caller drops the taps). `then` runs when the card starts to
 *  fade, so the conversation is already there under its last 0.3 s; from then on this returns false. */
export function stepVs(dt: number, taps: Tap[]): boolean {
  if (V.t < 0) return false;
  V.t += dt;
  // the beats of the card, each once: sound, shake, haptics
  const cue = (i: number, at: number, fn: () => void): void => { if (V.t >= at && !(V.fired & (1 << i))) { V.fired |= 1 << i; fn(); } };
  cue(0, SLAM_AT, () => { sfx.slam?.(); R.shake(0.35); R.hitStop(0.06); haptic([40, 30, 60]); });
  cue(1, NAME_AT, () => { sfx.stamp?.(); haptic(15); });
  cue(2, STAT_AT[0]!, () => sfx.tick?.());
  cue(3, STAT_AT[1]!, () => sfx.tick?.());
  cue(4, ROUND_AT, () => { sfx.round?.(); R.flash(0.3); haptic(30); });
  if (V.out < 0 && taps.length) {
    if (V.t < VS_GO_AT) { V.t = VS_GO_AT; V.fired |= 0b1111; }   // skip to the button; ROUND n still lands (cue 4) next step
    else if (goPressed(taps, VS_GO_Y)) { V.out = 0; music.duck = 1; V.then(); return false; }
  }
  if (V.out >= 0) { V.out += dt; if (V.out >= VS_OUT_S) V.t = -1; return false; }
  return true;
}

/** Draws the card over everything (full canvas). */
export function renderVs(): void {
  if (V.t < 0) return;
  const t = V.t, x0 = view.x0, y0 = -view.top, fw = view.fullW, fh = view.H;
  const fade = V.out >= 0 ? 1 - easeO(clamp(V.out / VS_OUT_S, 0, 1)) : easeO(clamp(t / 0.15, 0, 1));
  ctx.save(); ctx.globalAlpha = fade;
  // backdrop: near black with slanted red speed bars rushing past
  ctx.fillStyle = '#0b0507'; ctx.fillRect(x0, y0, fw, fh);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, fw, fh); ctx.clip();
  for (let i = 0; i < 14; i++) {
    const sp = 900 + (i % 4) * 260, len = 120 + (i * 37) % 160, yy = y0 + ((i * 97) % fh), xx = x0 + fw - ((t * sp + i * 211) % (fw + len * 2)) + len;
    ctx.fillStyle = i % 3 ? 'rgba(208,32,42,.22)' : 'rgba(255,204,0,.14)';
    ctx.save(); ctx.translate(xx, yy); ctx.rotate(-0.18); ctx.fillRect(-len, -2 - (i % 3), len, 4 + (i % 3) * 2); ctx.restore();
  }
  // a big red slab behind the portrait
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(x0 + fw * 0.42, y0); ctx.lineTo(x0 + fw, y0); ctx.lineTo(x0 + fw, y0 + fh); ctx.lineTo(x0 + fw * 0.28, y0 + fh); ctx.closePath();
  ctx.globalAlpha = fade * 0.85; ctx.fill(); ctx.globalAlpha = fade;
  ctx.restore();
  // the kicker band at the top
  const kb = easeOB(clamp(t / 0.25, 0, 1));
  ctx.save(); ctx.translate(W / 2, 48); ctx.scale(kb, kb); ctx.rotate(-0.04);
  rr(-112, -18, 224, 36, 4, C.yellow); ptxt(BUILDUP.kicker[V.who], 0, 0, 3, '#0e0e10');
  ctx.restore();
  // the portrait: slams in from the right, overshoots, settles; a slanted frame
  const sk = clamp((t - SLAM_AT + 0.16) / 0.16, 0, 1), land = t - SLAM_AT;
  // as big as the column allows (Nadav, 2026-11-18): 340 wide, from under the kicker to the name stamp; the painting's top is kept
  const px = 10 + (1 - easeOB(sk)) * 400, py = 72, pw = 340, ph = 372;
  const squash = land > 0 ? 1 + 0.08 * Math.exp(-land * 9) * Math.cos(land * 30) : 1;
  ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.scale(squash, 1 / squash); ctx.rotate(0.03); ctx.translate(-pw / 2, -ph / 2);
  ctx.fillStyle = '#000'; ctx.fillRect(6, 8, pw, ph);
  ctx.fillStyle = '#f4efe4'; ctx.fillRect(-5, -5, pw + 10, ph + 10);
  const im = portraitImg(V.portrait);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.clip();
  if (im) { ctx.imageSmoothingEnabled = true; ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalWidth * (ph / pw), 0, 0, pw, ph); portraitSticker(V.portrait, 0, 0, pw); }   // the sticker hides the calendar's real-brand header (CLAUDE.md: the brand only in content.facts)
  else { ctx.fillStyle = '#2a2a2e'; ctx.fillRect(0, 0, pw, ph); txt('?', pw / 2, ph / 2, 60, '#9b7fd1', 'center', 900); }   // still downloading (expected on a slow phone)
  if (land > 0 && land < 0.12) { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - land / 0.12)})`; ctx.fillRect(0, 0, pw, ph); }
  ctx.restore();
  ctx.restore();
  // the name, stamped over the bottom of the portrait
  if (t >= NAME_AT) {
    const s = 1.8 - 0.8 * easeOB(clamp((t - NAME_AT) / 0.18, 0, 1));
    ctx.save(); ctx.translate(W / 2, 440); ctx.rotate(-0.06); ctx.scale(s, s);
    const nw = V.name.length * 24 + 24;
    rr(-nw / 2, -22, nw, 44, 4, '#0e0e10', C.yellow, 3); ptxt(V.name, 0, 0, 4, C.yellow, 'center', '#000');
    ctx.restore();
  }
  // two stats, typed in
  const stats = BUILDUP.stats[V.who];
  stats.forEach((st, i) => {
    const at = STAT_AT[i]!; if (t < at) return;
    const n = Math.min(st.length, Math.floor((t - at) * 60));
    ptxt(st.slice(0, n), 34, 484 + i * 20, 2, '#ffffff', 'left', '#000');
  });
  // the meter: fills up to its (sad) level
  if (t >= METER_AT) {
    const [label, lvl] = BUILDUP.meter[V.who], k = easeO(clamp((t - METER_AT) / 0.4, 0, 1)), bl = Math.sin(state.t * 12) > 0;
    ptxt(label, 34, 526, 2, C.yellow, 'left', '#000');
    rr(34, 536, 292, 14, 3, 'rgba(255,255,255,.12)', '#ffffff', 1.5);
    rr(36, 538, Math.max(2, 288 * lvl * k), 10, 2, lvl < 0.2 && bl ? '#ff3b3b' : C.yellow);
    ptxt(`${Math.round(lvl * 100 * k)}%`, 326, 526, 2, '#ffffff', 'right', '#000');
  }
  // ROUND n: lands big, shakes, holds
  if (t >= ROUND_AT) {
    const a = t - ROUND_AT, s = (2.6 - 1.6 * easeOB(clamp(a / 0.25, 0, 1))) * pop(a - 0.25, 0.2, 0.08);
    ctx.save(); ctx.translate(W / 2, 572); ctx.rotate(-0.05); ctx.scale(s, s);
    ptxt(BUILDUP.round[V.who], 0, 0, 4, '#ffffff', 'center', C.red);
    ctx.restore();
  }
  drawGo(BUILDUP.go[V.who], VS_GO_Y, t - VS_GO_AT);
  ctx.restore();
}
