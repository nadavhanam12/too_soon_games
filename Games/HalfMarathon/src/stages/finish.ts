// Stage 5 (km 19-21.1): the finish. Tap the bottom half to sprint. A crowd of sunburned blondes scrolls by behind the
// barrier; somewhere in it is the blonde with the RUN!!! sign holding the baby. Tap the baby (or ↑) for a high five:
// the baby's high five takes a minute off the finish time. Miss them and the game ends on "the baby fell asleep".
// After a high five, the baby runs onto the course in the last 300 m, overtakes you and crosses the line first.
import { R, W, SAFE_H as H, ctx, state, input, rr, txt, clamp, lerp, rnd, pick, sfx, rand } from '@tsg/index';
import { G, registerStage, pxPerKm, hint, say, demo, SEG, impact, runnerSq } from '../play';
import { LINES } from '../content';
import { C, arch, baby, bubble, confetti, person, pint, runnerSide, seafront, wife } from '../art';

const RX = 96, RY = 560, SCROLL = 150, BAND = { top: 300, bot: 440 }, FAM_KM = 20.25;
const FIVE_HIT = 62;     // half-width of the high-five target: wider than the drawing, the finger covers the baby (ת11)
const FIVE_ZOOM_S = 0.9; // the camera leans in on the family, on the real clock so it plays through the hit-stop
interface Fan { wx: number; blonde: boolean; shirt: string; sign?: string; pint: boolean; sun: boolean }
let s = init();
function init() {
  const fans: Fan[] = [];
  for (let i = 0, wx = 0; wx < 2700; i++, wx += rnd(34, 44)) {
    fans.push({ wx, blonde: rand() < 0.75, shirt: pick(['#c8102e', '#ffffff', '#2f6fdd', '#1aa36b', '#ffd23f']), sign: rand() < 0.12 ? pick(LINES.crowdSign) : undefined, pint: rand() < 0.3, sun: rand() < 0.6 });
  }
  return { fans, sprint: 0.9, five: 0, missed: false, famWX: 0, wrongT: 0, fx: 0, babyRun: 0, spotted: false, fiveAt: -9, push: 0, dust: [] as Array<{ x: number; t: number }> };
}
const off = (): number => (G.km - SEG.finish.from) * pxPerKm(SCROLL);
const famX = (): number => s.famWX - off();

function tryFive(x: number, y: number, key: boolean): boolean {
  const fx = famX();
  if (G.highFive) return false;
  if (key ? fx > 30 && fx < W - 30 : Math.abs(x - fx) < FIVE_HIT && y > BAND.top - 50 && y < BAND.bot) {
    G.highFive = true; s.five = 1.6; s.sprint = Math.min(1.45, s.sprint + 0.3);
    // the peak of the whole game (ת6): half a second of freeze, the biggest flash, a lean-in on the family
    sfx.five?.(); R.hitStop(0.45); R.flash(0.5); R.shake(0.25); impact(-0.3); s.fiveAt = state.t;
    say(pick(LINES.highFive), 1.6, true); return true;
  }
  return false;
}

registerStage('finish', {
  peek: () => ({ ...s, fans: undefined, famX: famX() }), // read-only state for the bugcheck playthrough bot (playthrough.mjs)
  enter() {
    s = init();
    s.famWX = (FAM_KM - SEG.finish.from) * pxPerKm(SCROLL) + W * 0.62;
    s.fans = s.fans.filter((f) => Math.abs(f.wx - s.famWX) > 50);
  },
  key(e) { if (e.key === 'ArrowUp' || e.key === 'w') { if (!tryFive(0, 0, true) && !G.highFive) say('Not yet. Find your family!', 0.9, true); return true; } return false; },
  step(dt) {
    for (const p of input.taps.splice(0)) {
      if (p.key || p.y >= BAND.bot) { s.sprint = Math.min(1.45, s.sprint + 0.14); s.push = 1; s.dust.push({ x: RX - 14, t: 0 }); impact(0.12); sfx.step?.(1); continue; }
      if (tryFive(p.x, p.y, false)) continue;
      if (G.t - s.wrongT > 0.8) {
        const near = s.fans.find((f) => Math.abs(f.wx - off() - p.x) < 20);
        if (near?.blonde) { s.wrongT = G.t; say(pick(LINES.wrongBlonde), 1.3, true); sfx.tick?.(); }
      }
    }
    s.sprint = Math.max(0.6, s.sprint - dt * 0.55);
    s.five = Math.max(0, s.five - dt); s.fx += dt; s.push = Math.max(0, s.push - dt * 7);
    for (const d of s.dust) { d.t += dt; d.x -= 150 * G.f * dt; }
    s.dust = s.dust.filter((d) => d.t < 0.45);
    G.f = s.sprint;
    if (!s.spotted && famX() < W - 40) { s.spotted = true; if (!G.highFive) { sfx.ok?.(); say(pick(LINES.familySpot), 1.8, true); } }
    if (!G.highFive && !s.missed && famX() < -30) { s.missed = true; sfx.bad?.(); say(pick(LINES.missed), 1.8, true); }
    if (G.highFive && s.babyRun === 0 && G.km > 20.8) { s.babyRun = 1; say(LINES.babyRun[0]!, 1.6, true); }
    if (s.babyRun === 1 && G.km > 21.06) { s.babyRun = 2; say(LINES.babyRun[1]!, 1.8, true); }
  },
  render() {
    const o = off();
    const zt = (state.t - s.fiveAt) / FIVE_ZOOM_S, zoom = zt >= 0 && zt < 1 ? 1 + 0.16 * Math.sin(Math.PI * zt) : 1;
    ctx.save();
    if (zoom > 1) { const zx = clamp(famX(), 60, W - 60), zy = BAND.top + 70; ctx.translate(zx, zy); ctx.scale(zoom, zoom); ctx.translate(-zx, -zy); }
    seafront(o * 0.5, G.t, H, 0.2);
    // grandstand crowd
    rr(-10, BAND.top - 30, W + 20, BAND.bot - BAND.top + 30, 0, '#d8c79a');
    for (const f of s.fans) {
      const x = f.wx - o; if (x < -30 || x > W + 30) continue;
      const y = BAND.top + 44 + ((f.wx * 7) % 3) * 24 + Math.sin(G.t * 6 + f.wx) * 3;
      person(x, y, { sc: 1, shirt: f.shirt, hair: f.blonde ? C.blonde : '#3a2a1a', longhair: f.blonde && f.wx % 2 > 1, sunburn: f.sun });
      if (f.pint) pint(x + 14, y + 2, 0.8);
      if (f.sign) { rr(x - 30, y - 60, 60, 22, 3, '#ffffff', C.ink, 1.5); txt(f.sign, x, y - 49, 7, C.ink, 'center', 900); }
    }
    // the family
    const fx = famX();
    if (fx > -60 && fx < W + 60) {
      wife(fx, BAND.top + 80, 1.15, G.t, LINES.familySign);
      // "YOUR FAMILY" tag over them, so the player knows who to look for among the blondes
      if (!s.missed) {
        const bob = Math.sin(G.t * 5) * 3, ty = BAND.top - 22 + bob;
        rr(fx - 62, ty - 13, 124, 26, 13, G.highFive ? '#3ddc84' : '#ff5f8f', '#ffffff', 2);
        txt(G.highFive ? '♥ LOVE YOU ♥' : '♥ YOUR FAMILY ♥', fx, ty, 12, '#ffffff', 'center', 900);
        ctx.fillStyle = G.highFive ? '#3ddc84' : '#ff5f8f'; ctx.beginPath(); ctx.moveTo(fx - 7, ty + 12); ctx.lineTo(fx + 7, ty + 12); ctx.lineTo(fx, ty + 20); ctx.closePath(); ctx.fill();
      }
      baby(fx - 4, BAND.top + 84 - (s.five > 0 ? 16 : 0), 1.25, G.t, true);
      if (!G.highFive && fx > 40 && fx < W - 40) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(fx - 4, BAND.top + 72, 30 + Math.sin(G.t * 8) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }
    rr(-10, BAND.bot - 8, W + 20, 14, 2, '#ffffff'); for (let i = 0; i < 12; i++) rr(((i * 40 - o) % 480 + 480) % 480 - 40, BAND.bot - 8, 20, 14, 0, C.orange);
    // the arch at km 21.1
    const ax = (SEG.finish.to - SEG.finish.from) * pxPerKm(SCROLL) - o + RX + 10;
    if (ax < W + 100) arch(ax, RY + 20, 1);
    for (const d of s.dust) { const k = d.t / 0.45; ctx.fillStyle = `rgba(233,220,190,${0.8 * (1 - k)})`; ctx.beginPath(); ctx.arc(d.x - k * 10, RY + 26 - k * 8, 6 + k * 14, 0, Math.PI * 2); ctx.fill(); }
    runnerSide(RX + s.push * 5, RY, 1.7, G.t, G.f, 0, runnerSq());
    if (s.babyRun > 0) {
      const p = clamp((G.km - 20.8) / 0.3, 0, 1), bx = lerp(RX - 80, ax + 50, Math.pow(p, 0.8)), hop = Math.abs(Math.sin(G.t * 16)) * 6;
      ctx.strokeStyle = C.skin; ctx.lineWidth = 3; ctx.lineCap = 'round'; const lg = Math.sin(G.t * 16) * 5;
      ctx.beginPath(); ctx.moveTo(bx - 3, RY + 4 - hop); ctx.lineTo(bx - 3 + lg, RY + 16); ctx.moveTo(bx + 3, RY + 4 - hop); ctx.lineTo(bx + 3 - lg, RY + 16); ctx.stroke();
      baby(bx, RY + 6 - hop, 1.3, G.t, true);
    }
    if (s.five > 0) {
      // the runner reaches up, a dotted swoosh to the family, a hand at each end
      const k = clamp(s.five / 1.6, 0, 1), hx = RX + 34, hy = RY - 96, by = BAND.top + 66;
      ctx.save(); ctx.globalAlpha = Math.min(1, k * 2);
      ctx.strokeStyle = C.skin; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(RX + 8, RY - 52); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -G.t * 60;
      ctx.beginPath(); ctx.moveTo(hx, hy - 10); ctx.quadraticCurveTo((hx + fx) / 2, by - 40, fx - 4, by + 10); ctx.stroke(); ctx.setLineDash([]);
      txt('✋', hx, hy - 6, 30, '#ffffff', 'center', 400); txt('✋', fx + 22, by + 4, 26, '#ffffff', 'center', 400);
      ctx.restore();
    }
    if (s.five > 0) { bubble('HIGH FIVE!!!', fx, BAND.top + 10, 15, C.orange, '#ffffff', fx, BAND.top + 50); confetti(s.fx * 3, 30, 60, 300); }
    ctx.restore();
    if (G.highFive) { rr(W - 132, 100, 116, 30, 10, '#3ddc84'); txt('HIGH FIVE −1:00', W - 74, 115, 11, '#0b2545', 'center', 900); }
    // sprint gauge
    rr(16, 100, 120, 30, 10, 'rgba(11,37,69,.78)'); txt('SPRINT', 24, 115, 10, '#cfe3f5', 'left', 900);
    rr(66, 110, 60, 10, 5, 'rgba(255,255,255,.2)'); rr(66, 110, 60 * clamp((s.sprint - 0.6) / 0.85, 0, 1), 10, 5, s.push > 0.5 ? '#ffffff' : '#ffd23f');
    demo('tap', W / 2 + 70, H - 90);
    hint(G.highFive || s.missed ? 'Tap the bottom half to sprint!' : 'Tap below to sprint · tap your family to high five');
  },
});
