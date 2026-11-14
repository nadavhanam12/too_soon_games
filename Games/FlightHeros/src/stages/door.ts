// Stage 2: the locked cockpit door. First push the trolley guy (3 taps), then a 5-ring lock-timing puzzle with turbulence.
import { R, W, SAFE_H as H, ctx, input, rr, circ, txt, rnd, pick, sfx } from '@tsg/index';
import { G, registerStage, stageDone, strip } from '../play';
import { LINES } from '../content';
import { bubble, person, suitcase } from '../art';

const CX = W / 2, CY = 390, RAD = 100, SP = 18, N = 5;
let s = init();
function init() {
  return { ring: 0, ang: 0, dir: 1, speed: 2.6, zones: [0, 1, 2, 3, 4].map(() => rnd(0, Math.PI * 2)), fails: 0, time: 0, fx: 0, msg: LINES.door[0]!, turb: 0, turbT: rnd(2, 3.5), jit: 0, block: 3, bx: 0, bline: 0, bfx: 0 };
}

registerStage('door', {
  enter() { s = init(); },
  step(dt) {
    s.time += dt; s.fx = Math.max(0, s.fx - dt); s.bfx = Math.max(0, s.bfx - dt);
    s.turbT -= dt;
    if (s.turbT <= 0 && s.turb <= 0) { s.turb = rnd(0.9, 1.5); s.turbT = rnd(2.2, 3.8); sfx.rumble?.(); R.say(pick(LINES.turb), 1); }
    if (s.turb > 0) { s.turb -= dt; s.jit = rnd(-0.9, 0.9); if (Math.random() < dt * 6) s.ang += rnd(-0.5, 0.5); } else s.jit = 0;
    s.ang += s.speed * s.dir * dt * (s.turb > 0 ? 1.6 : 1);
    if (s.block <= 0 && s.bx < W) s.bx += 260 * dt;
    const tapped = input.taps.length > 0; input.taps.length = 0;
    if (!tapped) return;
    if (s.block > 0) {
      s.block--; s.bfx = 0.25; R.shake(0.15); sfx.hit?.(); s.bline = Math.min(s.bline + 1, LINES.trolley.length - 1);
      if (s.block <= 0) R.say(LINES.trolley[3]!, 1.2);
      return;
    }
    const z = s.zones[s.ring]!, d = Math.atan2(Math.sin(s.ang - z), Math.cos(s.ang - z));
    if (Math.abs(d) < 0.32) {
      s.ring++; s.dir *= -1; s.speed += 0.55; sfx.click?.(); R.say(LINES.doorClick[s.ring - 1]!, 1); if (s.ring < 3) s.msg = LINES.door[s.ring]!;
      if (s.ring >= N) { const sc = Math.max(200, 1400 - s.fails * 60 - Math.floor(s.time * 10)); R.say('הדלת נפתחה! +' + sc, 1.8); stageDone('door', sc); }
    } else {
      s.fails++; s.fx = 0.4; R.shake(0.2); sfx.bad?.();
      if (s.fails % 3 === 0 && s.ring > 0) { s.ring--; R.say('נתקע! טבעת אחורה', 1.1); } else R.say(pick(LINES.doorMiss), 1.1);
    }
  },
  render() {
    const tsh = s.turb > 0 ? 7 : 1.5;
    ctx.save(); ctx.translate(rnd(-tsh, tsh) + G.sh(), rnd(-tsh, tsh) + G.sh());
    ctx.fillStyle = '#5b6b7d'; ctx.fillRect(-10, -220, W + 20, H + 440);
    rr(40, 60, 280, 540, 18, '#8593a5'); rr(52, 72, 256, 516, 14, '#6f7f92');
    rr(140, 100, 80, 60, 8, '#aeb9c6'); txt('COCKPIT', 180, 130, 13, '#1b2a44', 'center', 900);
    circ(CX, CY, RAD + 14, '#2c3e68'); circ(CX, CY, RAD + 8, '#0f1a2b');
    for (let i = 0; i < N; i++) {
      const r = RAD - i * SP, done = i < s.ring, zone = s.zones[i]!;
      ctx.lineWidth = 14; ctx.strokeStyle = done ? '#3ddc84' : '#3a4a66'; ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
      if (!done) { ctx.strokeStyle = i === s.ring ? '#3ddc84' : '#27593f'; ctx.beginPath(); ctx.arc(CX, CY, r, zone - 0.3, zone + 0.3); ctx.stroke(); }
    }
    const r = RAD - Math.min(s.ring, N - 1) * SP;
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(s.ang + s.jit * 0.15); rr(r - 11, -5, 22, 10, 4, '#ffb400'); ctx.restore();
    circ(CX, CY, 16, '#ffb400');
    if (s.fx > 0) { ctx.fillStyle = `rgba(255,59,59,${s.fx})`; ctx.fillRect(0, -220, W, H + 440); }
    const blocking = s.block > 0;
    if (blocking || s.bx < W) {
      const bx = W / 2 + s.bx, by = CY - 20;
      ctx.save(); ctx.translate(bx, by); if (s.bfx > 0) ctx.translate(rnd(-3, 3), 0);
      suitcase(-62, -10, 44, 54, '#8a2be2'); rr(-46, -40, 12, 32, 4, '#444');
      ctx.scale(1.7, 1.7); person(0, 0, { shirt: '#ff8c00', hair: '#222', glasses: true }); ctx.restore();
      if (blocking) bubble(LINES.trolley[s.bline]!, bx, by - 92, 12, '#fff', '#111', bx, by - 62);
    }
    ctx.restore();
    txt('הדלת נעולה', W / 2, 190, 26, '#fff', 'center', 900);
    txt(blocking ? '...וגם חסומה.' : s.msg, W / 2, 222, 13, '#e6ecf3', 'center', 400);
    if (!blocking) { txt(s.ring + '/' + N, CX, CY + 1, 12, '#111', 'center', 900); if (s.turb > 0) txt('טורבולנציה!', CX, CY + RAD + 34, 16, '#ff8a8a', 'center', 900); }
    strip(520, 60, blocking ? 'הקש עליו כדי לדחוף (' + s.block + ')' : 'הקש כשהמחוג בירוק', 'הדיילת צועקת מאחוריך. הילדים בוכים.');
  },
});
