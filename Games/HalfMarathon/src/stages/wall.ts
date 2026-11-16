// Stage 4 (km 15-19): the wall. Alternate LEFT / RIGHT taps to keep the legs going; speed drains faster as you go.
// Same leg twice (or tapping like a maniac) = stumble. The inner voice talks; a literal brick wall of running excuses
// (KNEE, STITCH, NO SLEEP…) loses one brick at a time as you push through.
import { R, W, SAFE_H as H, ctx, input, rr, txt, clamp, pick, sfx } from '@tsg/index';
import { G, registerStage, segK, pxPerKm, hint, say, nudge, demo } from '../play';
import { LINES } from '../content';
import { C, bubble, btn, runnerSide, seafront } from '../art';

const RX = 100, RY = 440, SCROLL = 180;
const BL = { x: W / 4 + 4, y: H - 108, w: 150, h: 80 }, BR = { x: (W * 3) / 4 - 4, y: H - 108, w: 150, h: 80 };
const BRICKS = 32;
const LABEL: Array<string | undefined> = Array.from({ length: BRICKS }, (_, i) => (i % 2 === (Math.floor(i / 4) % 2) ? LINES.excuses[(i / 2) % LINES.excuses.length | 0] : undefined));
const POP: number[] = Array.from({ length: BRICKS }, (_, i) => ((i * 13) % BRICKS) / BRICKS * 0.95);
const popAt: number[] = Array(BRICKS).fill(-1);
let s = init();
function init() { return { want: 0 as 0 | 1 | 2, last: -9, f: 0.9, voice: pick(LINES.wall), voiceT: 0, pop: [0, 0], stumble: 0 }; }

function step(foot: 1 | 2): void {
  const fast = G.t - s.last < 0.1;
  s.pop[foot - 1] = 1;
  if (fast || (s.want !== 0 && s.want !== foot)) {
    s.f = Math.max(0.3, s.f * 0.6); s.stumble = 0.5; sfx.bad?.(); R.shake(0.15); say(pick(LINES.wallWrong), 1.1, true); nudge();
  } else { s.f = Math.min(1.2, s.f + 0.17); sfx.step?.(foot); }
  s.want = foot === 1 ? 2 : 1; s.last = G.t;
}

registerStage('wall', {
  peek: () => s, // read-only state for the bugcheck playthrough bot (playthrough.mjs)
  enter() { s = init(); popAt.fill(-1); },
  key(e) { if (e.key === 'ArrowLeft' || e.key === 'a') { step(1); return true; } if (e.key === 'ArrowRight' || e.key === 'd') { step(2); return true; } return false; },
  step(dt) {
    for (const p of input.taps.splice(0)) if (!p.key && p.y > 300) step(p.x < W / 2 ? 1 : 2);
    s.f = Math.max(0.3, s.f - dt * (0.5 + segK() * 0.35));
    s.stumble = Math.max(0, s.stumble - dt); s.pop = s.pop.map((v) => Math.max(0, v - dt * 6));
    G.f = s.f;
    s.voiceT += dt; if (s.voiceT > 3.2) { s.voiceT = 0; s.voice = pick(LINES.wall); }
  },
  render() {
    const k = segK(), off = G.km * pxPerKm(SCROLL);
    seafront(off, G.t, H, 0.8);
    ctx.fillStyle = `rgba(20,10,30,${0.25 + k * 0.25})`; ctx.fillRect(-10, -220, W + 20, H + 440);
    // the wall of excuses: 4 x 8 bricks, each pops out at its own point of the stretch and falls
    for (let i = 0; i < BRICKS; i++) {
      const row = Math.floor(i / 4), col = i % 4, thr = POP[i]!;
      let dx = 0, dy = 0, rot = 0;
      if (k > thr) { if (popAt[i]! < 0) { popAt[i] = G.t; sfx.tick?.(); } const f = (G.t - popAt[i]!) / 0.5; dx = f * 30 * (col % 2 ? 1 : -1); dy = f * f * 120 - f * 40; rot = f * 0.8 * (col % 2 ? 1 : -1); if (dy > 700) continue; }
      const bx = 196 + col * 41 + (row % 2) * 20 + dx, by = 196 + row * 31 + dy;
      ctx.save(); ctx.translate(bx + 20, by + 15); ctx.rotate(rot);
      rr(-20, -15, 40, 29, 3, (row + col) % 3 ? C.brick : C.brick2);
      const label = LABEL[i]; if (label) txt(label, 0, 1, label.length > 7 ? 6.5 : 8, '#ffe8d6', 'center', 900);
      ctx.restore();
    }
    if (k < 0.15) { rr(206, 160, 120, 28, 8, 'rgba(0,0,0,.6)'); txt('THE WALL', 266, 175, 13, '#ffffff', 'center', 900); }
    runnerSide(RX, RY, 1.8, G.t, G.f, s.stumble > 0 ? 1 : 0.4 + k * 0.4);
    bubble(s.voice, 130, 178, 12, 'rgba(255,255,255,.92)', '#111', RX, RY - 100);
    // speed gauge
    rr(16, 100, 150, 34, 10, 'rgba(11,37,69,.78)'); txt('LEGS', 26, 117, 11, '#cfe3f5', 'left', 900);
    rr(64, 112, 92, 10, 5, 'rgba(255,255,255,.2)'); rr(64, 112, 92 * clamp(s.f / 1.2, 0, 1), 10, 5, s.f < 0.5 ? '#ff6a6a' : '#3ddc84');
    // the two foot buttons; the one you want next glows
    for (const [b, foot, label] of [[BL, 1, 'LEFT'], [BR, 2, 'RIGHT']] as const) {
      const next = s.want === 0 || s.want === foot, sc = 1 + s.pop[foot - 1]! * 0.08;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(sc, sc);
      btn(label, 0, 0, b.w, b.h, next ? C.orange : 'rgba(255,255,255,.18)', next ? '#ffffff' : '#cfe3f5', 24);
      ctx.restore();
    }
    demo('alt', W / 2, H - 150);
    hint('Alternate LEFT and RIGHT');
  },
});
