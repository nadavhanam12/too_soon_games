// Stage 1 (km 0-3): weave through the start crowd. Three lanes, top-down, the runner seen from behind.
// Slow runners come down the screen: a guy filming a story, a Brit with a pint, a hand-holding couple, a stag party,
// a runner in a gyros costume. Once, a dad with a stroller overtakes you (no collision, just shame).
import { R, W, SAFE_H as H, ctx, input, rr, txt, clamp, lerp, rnd, pick, sfx } from '@tsg/index';
import { G, registerStage, pxPerKm, hint, say, nudge, demo } from '../play';
import { LINES } from '../content';
import { C, baby, bubble, person, pint, runnerBack } from '../art';

const LANES = [W / 2 - 84, W / 2, W / 2 + 84], PY = H - 150, SCROLL = 260;
type Kind = 'story' | 'pint' | 'couple' | 'stag' | 'costume';
interface Obs { kind: Kind; lane: number; y: number; hit?: boolean; line: string; passed?: boolean }
let s = init();
function init() { return { lane: 1, x: W / 2, obs: [] as Obs[], spawn: 1.0, stun: 0, swipeX: null as number | null, stroller: null as { x: number; y: number } | null, strollerDone: false }; }
function lane(d: number): void { const n = clamp(s.lane + d, 0, 2); if (n !== s.lane) { s.lane = n; sfx.whoosh?.(); } }
const lanesOf = (o: Obs): number[] => (o.kind === 'couple' || o.kind === 'stag' ? [o.lane, o.lane + 1] : [o.lane]);

registerStage('start', {
  enter() { s = init(); },
  key(e) { if (e.key === 'ArrowLeft' || e.key === 'a') { lane(-1); return true; } if (e.key === 'ArrowRight' || e.key === 'd') { lane(1); return true; } return false; },
  step(dt) {
    // input: tap a side, or swipe
    const p = input.taps.shift(); input.taps.length = 0;
    if (p && !p.key) lane(p.x < s.x ? -1 : 1);
    if (input.down) { if (s.swipeX === null) s.swipeX = G.ps.x; const dx = input.px - s.swipeX; if (Math.abs(dx) > 40) { lane(dx > 0 ? 1 : -1); s.swipeX = input.px; } } else s.swipeX = null;
    s.x = lerp(s.x, LANES[s.lane]!, Math.min(1, dt * 14));
    s.stun = Math.max(0, s.stun - dt);
    G.f = s.stun > 0 ? 0.35 : 1;
    // spawn: a 2-wide group always leaves one lane free
    s.spawn -= dt;
    if (s.spawn <= 0 && G.km < 2.8) {
      s.spawn = rnd(0.75, 1.1);
      const r = Math.random();
      const kind: Kind = r < 0.25 ? 'story' : r < 0.45 ? 'pint' : r < 0.62 ? 'costume' : r < 0.82 ? 'couple' : 'stag';
      const wide = kind === 'couple' || kind === 'stag';
      const ln = wide ? Math.floor(rnd(0, 2)) : Math.floor(rnd(0, 3));
      const line = kind === 'story' ? pick(LINES.story) : kind === 'pint' ? pick(LINES.pintGuy) : kind === 'stag' ? pick(LINES.stag) : kind === 'costume' ? pick(LINES.costume) : '';
      s.obs.push({ kind, lane: ln, y: -60, line });
    }
    for (const o of s.obs) {
      o.y += (SCROLL * G.f - 70) * dt;
      if (!o.hit && Math.abs(o.y - PY) < 28 && lanesOf(o).some((l) => Math.abs(LANES[l]! - s.x) < 34)) {
        o.hit = true; s.stun = 0.75; R.shake(0.25); sfx.hit?.(); say(pick(LINES.startHit), 1.4, true); nudge();
      }
      if (!o.passed && o.y > PY + 30) { o.passed = true; if (!o.hit && Math.random() < 0.25) say(pick(LINES.startPass), 1.1); }
    }
    // the stroller dad overtakes once, around km 1.4, in a lane next to you
    if (!s.strollerDone && G.km > 1.4) { s.strollerDone = true; s.stroller = { x: LANES[s.lane === 0 ? 1 : s.lane - 1]!, y: H + 60 }; say(pick(LINES.stroller), 1.8, true); }
    if (s.stroller) { s.stroller.y -= 150 * dt; if (s.stroller.y < -120) s.stroller = null; }
    s.obs = s.obs.filter((o) => o.y < H + 80);
  },
  render() {
    ctx.save(); ctx.translate(G.f < 0.5 ? rnd(-2, 2) : 0, 0);
    // road, kerbs, crowd behind the barriers
    ctx.fillStyle = C.road; ctx.fillRect(-10, -220, W + 20, H + 440);
    const ppk = pxPerKm(SCROLL), scroll = G.km * ppk;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = -1; i < 12; i++) { const y = ((i * 80 + scroll) % 960) - 80; ctx.fillRect(W / 2 - 42 - 2, y, 4, 40); ctx.fillRect(W / 2 + 42 - 2, y, 4, 40); }
    for (const side of [0, 1]) {
      const bx = side ? W - 34 : 0;
      ctx.fillStyle = '#7d8a5a'; ctx.fillRect(bx, -220, 34, H + 440);
      for (let i = -2; i < 16; i++) {
        const y = ((i * 48 + scroll * 0.98) % 864) - 96;
        person(bx + 17, y, { sc: 0.7, shirt: ['#c8102e', '#ffffff', '#2f6fdd', '#ffd23f'][(i + side) & 3], hair: (['#3a2a1a', C.blonde, false] as const)[(i * 7 + side) % 3], back: false, sunburn: (i + side) % 3 === 0 });
      }
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(side ? W - 38 : 34, -220, 4, H + 440);
    }
    // painted km lines
    for (let km = 1; km <= 3; km++) {
      const y = PY - (km - G.km) * ppk;
      if (y > -40 && y < H + 40) { rr(40, y - 3, W - 80, 6, 2, '#ffffff'); rr(W / 2 - 34, y - 26, 68, 22, 8, C.ink); txt('KM ' + km, W / 2, y - 15, 13, '#ffd23f', 'center', 900); }
    }
    // obstacles
    for (const o of s.obs) {
      const x = LANES[o.lane]!;
      if (o.kind === 'story') { ctx.save(); ctx.translate(x, o.y); ctx.scale(1.2, 1.2); person(0, 0, { shirt: '#8a2be2', hair: '#111', back: true }); rr(10, -36, 9, 15, 2, '#222'); circ2(14, -30); ctx.restore(); }
      else if (o.kind === 'pint') { ctx.save(); ctx.translate(x, o.y); ctx.scale(1.2, 1.2); person(0, 0, { shirt: '#c8102e', hair: C.blonde, sunburn: true, back: true }); pint(14, 2, 0.9); ctx.restore(); }
      else if (o.kind === 'costume') {
        ctx.save(); ctx.translate(x, o.y);
        ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.moveTo(-22, 18); ctx.lineTo(0, -44); ctx.lineTo(22, 18); ctx.fill();
        ctx.fillStyle = '#8a4b22'; ctx.fillRect(-12, -8, 24, 9); ctx.fillStyle = '#3ddc84'; ctx.fillRect(-10, -16, 20, 5); ctx.fillStyle = '#ff5a3c'; ctx.fillRect(-8, -22, 16, 4);
        rr(-16, 2, 32, 10, 3, '#ffffff'); txt(o.line, 0, 7, 7, '#c8102e', 'center', 900);
        ctx.restore();
      }
      else if (o.kind === 'couple') {
        ctx.save(); ctx.translate(x, o.y); ctx.scale(1.15, 1.15); person(0, 0, { shirt: '#ff5fa2', hair: '#3a2a1a', back: true }); ctx.restore();
        ctx.save(); ctx.translate(x + 84, o.y); ctx.scale(1.15, 1.15); person(0, 0, { shirt: '#ff5fa2', hair: C.blonde, longhair: true, back: true }); ctx.restore();
        ctx.strokeStyle = C.skin; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 14, o.y + 4); ctx.quadraticCurveTo(x + 42, o.y + 16, x + 70, o.y + 4); ctx.stroke();
        txt('♥', x + 42, o.y - 26, 16, '#ff5fa2', 'center', 900);
      } else {
        for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(x - 22 + i * 42, o.y + (i % 2) * 8); person(0, 0, { shirt: '#1aa36b', hair: (['#3a2a1a', C.blonde, '#111', C.blonde] as const)[i], sunburn: true, back: true }); ctx.restore(); }
        rr(x - 4, o.y - 52, 92, 20, 6, '#ffffff'); txt(o.line, x + 42, o.y - 42, 10, '#1aa36b', 'center', 900);
      }
    }
    if (s.stroller) {
      const { x, y } = s.stroller;
      rr(x - 16, y - 42, 32, 30, 8, '#3d5a80'); rr(x - 18, y - 46, 36, 10, 5, '#2b405e'); baby(x, y - 30, 0.8, G.t, true);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 12, y - 10, 4, 0, 7); ctx.arc(x + 12, y - 10, 4, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y + 26); ctx.scale(1.25, 1.25); person(0, 0, { shirt: '#3ddc84', hair: '#3a2a1a', back: true }); ctx.restore();
    }
    runnerBack(s.x, PY, 1.35, G.t, G.f);
    if (s.stun > 0) txt('ouch', s.x, PY - 52, 12, '#ffd23f', 'center', 900);
    ctx.restore();
    for (const o of s.obs) if ((o.kind === 'story' || o.kind === 'pint') && o.y > 90 && o.y < PY - 60) bubble(o.line, LANES[o.lane]!, o.y - 52, 11, '#fff', '#111', LANES[o.lane]!, o.y - 30);
    demo('swipe', W / 2, PY + 70);
    hint('Swipe or tap a side to switch lanes');
  },
});

function circ2(x: number, y: number): void { ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
