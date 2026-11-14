// Stage 5: stabilise the plane. Drag (or arrows) to pitch and bank; hold the horizon inside the frame for 8 seconds.
import { R, W, SAFE_H as H, ctx, input, keyLeft, keyRight, keyHeld, rr, circ, txt, clamp, rnd, pick, fmtInt, sfx } from '@tsg/index';
import { G, registerStage, stageDone } from '../play';
import { LINES } from '../content';
import { bubble, person, hzn, DAD } from '../art';

const NEED = 8, MAX_ALT = 34000;
let s = init();
function init() { return { pitch: -0.75, bank: 0.5, stable: 0, time: 0, wind: 0, jx: 0, jy: 0, up: false }; }

registerStage('fly', {
  enter() { s = init(); },
  step(dt) {
    s.time += dt;
    let ix = 0, iy = 0;
    if (keyLeft()) ix -= 1; if (keyRight()) ix += 1; if (keyHeld('ArrowUp', 'w', 'W')) iy += 1; if (keyHeld('ArrowDown', 's', 'S')) iy -= 1;
    if (input.down) { ix += clamp((input.px - G.ps.x) / 60, -1, 1); iy += clamp(-(input.py - G.ps.y) / 60, -1, 1); }
    input.taps.length = 0;
    ix = clamp(ix, -1, 1); iy = clamp(iy, -1, 1); s.jx = ix; s.jy = iy;
    s.wind = clamp(s.wind + rnd(-1, 1) * dt * 1.4, -0.6, 0.6);
    s.pitch = clamp(s.pitch + (iy * 1.3 - 0.22 + Math.sin(s.time * 1.3) * 0.15) * dt, -1, 1);
    s.bank = clamp(s.bank + (ix * 1.1 + s.wind * 0.15) * dt, -1.2, 1.2);
    const ok = Math.abs(s.pitch) < 0.18 && Math.abs(s.bank) < 0.32;
    s.stable = ok ? s.stable + dt : Math.max(0, s.stable - dt * 0.5);
    const prev = G.alt;
    G.alt -= (Math.max(0, -s.pitch) * 380 + Math.abs(s.bank) * 80 + 20) * dt * (ok ? 0 : 1);
    if (ok || s.pitch > 0.05) G.alt += Math.max(0, s.pitch + 0.02) * 260 * dt;
    G.alt = Math.min(G.alt, MAX_ALT);
    s.up = G.alt - prev >= -0.01; G.altUp = s.up;
    if (!ok && s.time > 1 && Math.random() < dt * 0.3) R.say(pick(LINES.flyShout), 1.6);
    if (s.stable >= NEED) { const sc = Math.max(300, 1600 - Math.floor(s.time * 12)); stageDone('fly', sc); }
  },
  render() {
    const ok = Math.abs(s.pitch) < 0.18 && Math.abs(s.bank) < 0.32, ac = s.up ? '#3ddc84' : '#ff3b3b', shk = ok ? 1 : 4;
    ctx.fillStyle = '#1f2937'; ctx.fillRect(-10, -220, W + 20, H + 440);
    ctx.save(); ctx.translate(rnd(-shk, shk) + G.sh(), rnd(-shk, shk) + G.sh());
    hzn(W / 2, 250, 150, s.pitch, s.bank);
    ctx.strokeStyle = ac; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.strokeRect(W / 2 - 40, 250 - 26, 80, 52); ctx.setLineDash([]);
    ctx.restore();
    rr(20, 60, 70, 380, 10, 'rgba(0,0,0,.45)'); txt('גובה', 55, 80, 12, '#cfd8e6');
    txt(fmtInt(Math.max(0, Math.round(G.alt / 100) * 100)), 55, 110, 18, ac, 'center', 900);
    txt('רגל', 55, 130, 11, '#cfd8e6'); if (G.alt < 8000) txt('נמוך!', 55, 452, 12, '#ff6a6a', 'center', 900);
    const altH = (clamp(G.alt, 0, MAX_ALT) / MAX_ALT) * 300; rr(45, 140 + 300 - altH, 20, altH, 6, ac); txt(s.up ? '▲ עולה' : '▼ יורד', 55, 470, 12, ac, 'center', 900);
    rr(W - 90, 60, 70, 380, 10, 'rgba(0,0,0,.45)'); txt('יציבות', W - 55, 80, 12, '#cfd8e6'); const sh = (s.stable / NEED) * 300; rr(W - 65, 140 + 300 - sh, 20, sh, 6, '#3ddc84');
    txt(Math.round((s.stable / NEED) * 100) + '%', W - 55, 110, 18, '#fff', 'center', 900); txt(Math.ceil(Math.max(0, NEED - s.stable)) + ' שנ׳', W - 55, 455, 11, '#cfd8e6', 'center', 400);
    person(W / 2, 470, { ...DAD, sc: 1.8 });
    const coach = ok ? 'ככה! תחזיק ככה!' : Math.abs(s.pitch) >= 0.18 ? (s.pitch < 0 ? 'האף למטה! גרור למעלה ⬆' : 'האף גבוה מדי! גרור למטה ⬇') : s.bank > 0 ? 'מוטה ימינה! גרור שמאלה ⬅' : 'מוטה שמאלה! גרור ימינה ⮕';
    bubble(coach, W / 2, 412, 14, ok ? '#3ddc84' : '#fff', ok ? '#111' : '#c8102e', W / 2, 440);
    circ(W / 2, 570, 40, 'rgba(255,255,255,.12)'); circ(W / 2 + s.jx * 26, 570 - s.jy * 26, 14, '#ffb400');
    rr(16, 598, W - 32, 36, 12, 'rgba(15,26,43,.85)'); txt('המטרה: להכניס את קו האופק למסגרת ולהחזיק 8 שנ׳', W / 2, 616, 13, '#fff', 'center', 900);
    if (s.time < 6) {
      const k = Math.sin(s.time * 4) * 10; rr(W / 2 - 150, 500, 300, 56, 14, 'rgba(255,180,0,.95)');
      txt('⬆ גרור למעלה כדי להרים את האף', W / 2, 518, 16, '#111', 'center', 900); txt('⬅ ⮕ גרור לצדדים כדי ליישר כנפיים', W / 2, 542, 13, '#111', 'center', 700);
      txt('☝', W / 2 + 60, 575 + k, 26, '#fff');
    }
    void sfx;
  },
});
