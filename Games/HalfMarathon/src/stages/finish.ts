// Stage 5 (km 19-21.1): the finish. Tap the bottom half to sprint. A crowd of sunburned blondes scrolls by behind the
// barrier; somewhere in it is the blonde with the RUN!!! sign holding the baby. Tap the baby (or ↑) for a high five:
// the baby's high five takes a minute off the finish time. Miss them and the game ends on "the baby fell asleep".
import { R, W, SAFE_H as H, ctx, input, rr, txt, clamp, rnd, pick, sfx } from '@tsg/index';
import { G, registerStage, pxPerKm, hint, SEG } from '../play';
import { LINES } from '../content';
import { C, arch, baby, bubble, confetti, person, pint, runnerSide, seafront, wife } from '../art';

const RX = 96, RY = 560, SCROLL = 150, BAND = { top: 300, bot: 440 }, FAM_KM = 20.25;
interface Fan { wx: number; blonde: boolean; shirt: string; sign?: string; pint: boolean; sun: boolean }
let s = init();
function init() {
  const fans: Fan[] = [];
  for (let i = 0, wx = 0; wx < 2700; i++, wx += rnd(34, 44)) {
    fans.push({ wx, blonde: Math.random() < 0.75, shirt: pick(['#c8102e', '#ffffff', '#2f6fdd', '#1aa36b', '#ffd23f']), sign: Math.random() < 0.12 ? pick(LINES.crowdSign) : undefined, pint: Math.random() < 0.3, sun: Math.random() < 0.6 });
  }
  return { fans, sprint: 0.9, five: 0, missed: false, famWX: 0, wrongT: 0, fx: 0 };
}
const off = (): number => (G.km - SEG.finish.from) * pxPerKm(SCROLL);
const famX = (): number => s.famWX - off();

function tryFive(x: number, y: number, key: boolean): boolean {
  const fx = famX();
  if (G.highFive) return false;
  if (key ? fx > 30 && fx < W - 30 : Math.abs(x - fx) < 44 && y > BAND.top - 50 && y < BAND.bot) {
    G.highFive = true; s.five = 1.6; s.sprint = Math.min(1.45, s.sprint + 0.3);
    sfx.five?.(); R.flash(0.3); R.say(pick(LINES.highFive), 1.6); return true;
  }
  return false;
}

registerStage('finish', {
  enter() {
    s = init();
    s.famWX = (FAM_KM - SEG.finish.from) * pxPerKm(SCROLL) + W * 0.62;
    s.fans = s.fans.filter((f) => Math.abs(f.wx - s.famWX) > 50);
  },
  key(e) { if (e.key === 'ArrowUp' || e.key === 'w') { if (!tryFive(0, 0, true) && !G.highFive) R.say('Not yet. Find the sign!', 0.9); return true; } return false; },
  step(dt) {
    for (const p of input.taps.splice(0)) {
      if (p.key || p.y >= BAND.bot) { s.sprint = Math.min(1.45, s.sprint + 0.14); sfx.step?.(1); continue; }
      if (tryFive(p.x, p.y, false)) continue;
      if (G.t - s.wrongT > 0.8) {
        const near = s.fans.find((f) => Math.abs(f.wx - off() - p.x) < 20);
        if (near?.blonde) { s.wrongT = G.t; R.say(pick(LINES.wrongBlonde), 1.3); sfx.tick?.(); }
      }
    }
    s.sprint = Math.max(0.6, s.sprint - dt * 0.55);
    s.five = Math.max(0, s.five - dt); s.fx += dt;
    G.f = s.sprint;
    if (!G.highFive && !s.missed && famX() < -30) { s.missed = true; sfx.bad?.(); R.say(pick(LINES.missed), 1.8); }
  },
  render() {
    const o = off();
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
      wife(fx, BAND.top + 80, 1.15, G.t);
      baby(fx - 4, BAND.top + 84 - (s.five > 0 ? 16 : 0), 1.25, G.t, true);
      if (!G.highFive && fx > 40 && fx < W - 40) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(fx - 4, BAND.top + 72, 30 + Math.sin(G.t * 8) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }
    rr(-10, BAND.bot - 8, W + 20, 14, 2, '#ffffff'); for (let i = 0; i < 12; i++) rr(((i * 40 - o) % 480 + 480) % 480 - 40, BAND.bot - 8, 20, 14, 0, C.orange);
    // the arch at km 21.1
    const ax = (SEG.finish.to - SEG.finish.from) * pxPerKm(SCROLL) - o + RX + 10;
    if (ax < W + 100) arch(ax, RY + 20, 1);
    runnerSide(RX, RY, 1.7, G.t, G.f);
    if (s.five > 0) { bubble('HIGH FIVE!!!', fx, BAND.top + 10, 15, C.orange, '#ffffff', fx, BAND.top + 50); confetti(s.fx * 3, 30, 60, 300); }
    if (G.highFive) { rr(W - 132, 100, 116, 30, 10, '#3ddc84'); txt('HIGH FIVE −1:00', W - 74, 115, 11, '#0b2545', 'center', 900); }
    // sprint gauge
    rr(16, 100, 120, 30, 10, 'rgba(11,37,69,.78)'); txt('SPRINT', 24, 115, 10, '#cfe3f5', 'left', 900);
    rr(66, 110, 60, 10, 5, 'rgba(255,255,255,.2)'); rr(66, 110, 60 * clamp((s.sprint - 0.6) / 0.85, 0, 1), 10, 5, '#ffd23f');
    hint(G.highFive || s.missed ? 'Tap the bottom half to sprint!' : 'Tap below to sprint · tap the baby to high five');
  },
});
