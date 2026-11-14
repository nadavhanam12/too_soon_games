// Stage 1: run down the aisle. Three lanes, falling suitcases, panicking passengers, the stewardess doing the safety speech.
import { R, W, SAFE_H as H, ctx, state, input, rr, txt, clamp, lerp, rnd, pick, sfx } from '@tsg/index';
import { G, registerStage, stageDone } from '../play';
import { LINES } from '../content';
import { bubble, person, suitcase, DAD } from '../art';

const ROWS = 32, RH = 110, PY = H - 150;
const LANES = [W / 2 - 64, W / 2, W / 2 + 64];
interface Obs { side: number; wide: boolean; y: number; t: number; col: string; hit?: boolean }
interface Runner { lane: number; y: number; x: number; shirt: string; hair: string | false; s: string; bt: number; v: number; hit?: boolean }
interface Stew { x: number; y: number; seq: readonly string[]; k: number; bt: number }
let s = init();
function init() {
  return { lane: 1, x: W / 2, dist: 0, total: ROWS * RH, obs: [] as Obs[], spawn: 1.2, stun: 0, hits: 0, time: 0, lastRow: 0, runners: [] as Runner[], rspawn: 2.2, lastSpawn: -9, stews: [] as Stew[], stewAt: [6, 14, 22], swipeX: null as number | null };
}
function lane(d: number): void { s.lane = clamp(s.lane + d, 0, 2); sfx.whoosh?.(); }

registerStage('run', {
  enter() { s = init(); },
  key(e) { if (e.key === 'ArrowLeft' || e.key === 'a') { lane(-1); return true; } if (e.key === 'ArrowRight' || e.key === 'd') { lane(1); return true; } return false; },
  step(dt) {
    s.time += dt;
    const p = input.taps.shift(); input.taps.length = 0;
    if (p && !p.key) lane(p.x < W / 2 ? -1 : 1);
    if (input.down) { if (s.swipeX === null) s.swipeX = G.ps.x; const dx = input.px - s.swipeX; if (Math.abs(dx) > 40) { lane(dx > 0 ? 1 : -1); s.swipeX = input.px; } } else s.swipeX = null;
    s.x = lerp(s.x, LANES[s.lane]!, Math.min(1, dt * 14));
    const speed = s.stun > 0 ? 50 : 178; s.dist += speed * dt;
    s.stun = Math.max(0, s.stun - dt);
    s.spawn -= dt;
    if (s.spawn <= 0 && s.dist < s.total - 420) {
      const wide = Math.random() < 0.35 && s.time - s.lastSpawn > 1.6; s.spawn = rnd(0.72, 1.05); s.lastSpawn = s.time;
      s.obs.push({ side: Math.random() < 0.5 ? -1 : 1, wide, y: -60, t: 0, col: pick(['#c8102e', '#222', '#0d6efd', '#8a2be2', '#ff8c00', '#00a86b']) });
    }
    s.rspawn -= dt;
    if (s.rspawn <= 0 && s.dist < s.total - 500) { s.rspawn = rnd(1.7, 2.6); const l = Math.floor(rnd(0, 3)); s.runners.push({ lane: l, y: -70, x: LANES[l]!, shirt: pick(['#ff8c00', '#c8102e', '#ffffff', '#8a2be2', '#3ddc84', '#ffb400']), hair: pick<string | false>(['#222', '#3a2a1a', '#c9a15a', false]), s: pick(LINES.pass), bt: rnd(0, 0.5), v: rnd(90, 140) }); }
    for (const r of s.runners) {
      r.y += (speed + r.v) * dt; r.bt -= dt; if (r.bt <= 0) { r.bt = rnd(1.4, 2.4); r.s = pick(LINES.pass); }
      if (!r.hit && Math.abs(r.y - PY) < 26 && Math.abs(r.x - s.x) < 30) { r.hit = true; s.stun = 0.4; R.shake(0.2); sfx.hit?.(); R.say(pick(LINES.bump), 1.2); }
    }
    s.runners = s.runners.filter((r) => r.y < H + 80);
    if (s.stewAt.length && s.dist > s.stewAt[0]! * RH) { const i = 3 - s.stewAt.length; s.stewAt.shift(); s.stews.push({ x: i % 2 ? W / 2 + 88 : W / 2 - 88, y: -70, seq: LINES.stew[i]!, k: 0, bt: 1.5 }); }
    for (const w of s.stews) { w.y += speed * dt; if (w.y > -20) { w.bt -= dt; if (w.bt <= 0 && w.k < w.seq.length - 1) { w.k++; w.bt = 1.5; } } }
    s.stews = s.stews.filter((w) => w.y < H + 80);
    for (const o of s.obs) {
      o.t += dt; o.y += speed * dt;
      if (o.t >= 0.45) { const w = o.wide ? 128 : 64, x = o.side < 0 ? W / 2 - 100 : W / 2 + 100 - w; if (!o.hit && o.y < PY + 18 && o.y + 40 > PY - 30 && s.x > x - 14 && s.x < x + w + 14) { o.hit = true; s.stun = 0.75; s.hits++; R.shake(0.3); sfx.hit?.(); R.say(pick(LINES.hit), 1.4); } }
    }
    s.obs = s.obs.filter((o) => o.y < H + 60);
    const curRow = Math.max(1, ROWS - Math.floor(s.dist / RH));
    if (curRow !== s.lastRow) { s.lastRow = curRow; if (curRow % 5 === 0) sfx.tick?.(); }
    if (s.dist >= s.total - 70) { const sc = Math.max(300, 1800 - s.hits * 90 - Math.floor(s.time * 8)); sfx.ok?.(); R.say('הגעת לדלת! ' + (s.hits ? s.hits + ' מזוודות בראש' : 'בלי שריטה!') + ' +' + sc, 2); stageDone('run', sc); }
  },
  render() {
    ctx.save(); ctx.translate(rnd(-2, 2) + Math.sin(s.time * 7) * 2 + G.sh(), rnd(-1, 1) + G.sh());
    ctx.fillStyle = '#d9dee5'; ctx.fillRect(-10, -220, W + 20, H + 440);
    ctx.fillStyle = '#b9c2cc'; ctx.fillRect(W / 2 - 100, -220, 200, H + 440);
    for (let k = 0; k < ROWS; k++) {
      const y = PY + s.dist - k * RH; if (y < -80 || y > H + 40) continue; const rowNo = ROWS - k;
      for (const sx of [14, 58, W - 54, W - 98]) { rr(sx, y - 26, 40, 52, 8, '#2c3e68'); rr(sx + 4, y + 14, 32, 10, 4, '#1a2540'); }
      const r = Math.abs(Math.sin(k * 13.7));
      if (r > 0.35) person(34, y + 4, { sc: 0.7, shirt: ['#ff8c00', '#3ddc84', '#c8102e', '#ffffff', '#ffb400'][k % 5], hair: '#222' });
      if (r > 0.15) person(W - 34, y + 4, { sc: 0.7, shirt: ['#ffffff', '#c8102e', '#2f6fdd', '#3ddc84', '#8a2be2'][(k * 3) % 5] });
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(W / 2 - 100, y + 38, 200, 3);
      if (rowNo % 5 === 0 || rowNo === 1) { rr(W / 2 - 34, y - 12, 68, 24, 12, 'rgba(15,26,43,.85)'); txt('שורה ' + rowNo, W / 2, y + 1, 13, '#ffb400', 'center', 900); }
    }
    const dy = PY + s.dist - ROWS * RH;
    if (dy > -260) {
      rr(-10, dy - 260, W + 20, 260, 0, '#c4ccd6'); rr(0, dy - 40, W, 40, 0, '#aab5c2');
      rr(W / 2 - 80, dy - 200, 160, 150, 12, '#5b6b7d'); rr(W / 2 - 66, dy - 186, 132, 122, 10, '#6f7f92'); rr(W / 2 - 40, dy - 170, 80, 36, 8, '#aeb9c6'); txt('COCKPIT', W / 2, dy - 152, 13, '#1b2a44', 'center', 900);
      person(W / 2 - 120, dy - 120, { sc: 1.1, shirt: '#ff6a00', hair: '#3a2a1a' }); bubble('מהר! פה!', W / 2 - 120, dy - 170, 12, '#fff', '#111', W / 2 - 120, dy - 150);
    }
    for (const o of s.obs) {
      const w = o.wide ? 128 : 64, x = o.side < 0 ? W / 2 - 100 : W / 2 + 100 - w;
      if (o.t < 0.45) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + w / 2, o.y + 22, w / 2, 12, 0, 0, Math.PI * 2); ctx.fill(); suitcase(x, o.y - 160 + (o.t / 0.45) * 160, w, 40, o.col); }
      else suitcase(x, o.y, w, 40, o.col);
    }
    for (const w of s.stews) { ctx.save(); ctx.translate(w.x, w.y); ctx.scale(1.2, 1.2); person(0, 0, { shirt: '#1b2a44', hair: '#3a2a1a', longhair: true }); rr(-5, -9, 10, 14, 3, '#c8102e'); rr(-14, -32, 28, 5, 2, '#1b2a44'); ctx.restore(); }
    for (const r of s.runners) { ctx.save(); ctx.translate(r.x, r.y); ctx.scale(1.2, 1.2); const lg = Math.sin(s.time * 20 + r.x) * 6; rr(-9, 8, 7, 14 + lg, 3, '#333'); rr(2, 8, 7, 14 - lg, 3, '#333'); person(0, 0, { shirt: r.shirt, hair: r.hair }); ctx.restore(); }
    ctx.save(); if (s.stun > 0) ctx.globalAlpha = 0.6 + Math.sin(s.time * 40) * 0.3;
    ctx.translate(s.x, PY); ctx.scale(1.3, 1.3);
    const lg = Math.sin(s.time * 22) * 6; rr(-9, 8, 7, 14 + lg, 3, '#1b2a44'); rr(2, 8, 7, 14 - lg, 3, '#1b2a44');
    person(0, 0, { ...DAD, back: true });
    ctx.restore();
    ctx.restore();
    for (const r of s.runners) if (r.y > 110 && r.y < H - 60) bubble(r.s, r.x, r.y - 56, 12, '#fff', '#111', r.x, r.y - 30);
    for (const w of s.stews) if (w.y > 110 && w.y < H - 60) bubble('הדיילת: ' + w.seq[w.k], w.x, w.y - 60, 12, '#fff', '#111', w.x, w.y - 32, '#c8102e');
    const curRow = Math.max(1, ROWS - Math.floor(s.dist / RH));
    rr(20, H - 40, W - 40, 12, 6, 'rgba(0,0,0,.35)'); rr(20, H - 40, (W - 40) * clamp(s.dist / s.total, 0, 1), 12, 6, '#ffb400');
    txt('שורה ' + curRow, 20, H - 52, 12, '#243357', 'left', 900); txt('קוקפיט', W - 20, H - 52, 11, '#243357', 'right', 400);
    void state;
  },
});
