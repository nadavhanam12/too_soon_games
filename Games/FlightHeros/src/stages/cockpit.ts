// Stage 3: first-person cockpit fight. Tap the fists to punch; every 4 hits he winds up (screen reddens): tap the shield.
import { R, W, SAFE_H as H, ctx, input, rr, circ, txt, lerp, rnd, pick, sfx } from '@tsg/index';
import { G, registerStage, stageDone } from '../play';
import { LINES } from '../content';
import { bubble, person, hand, hzn } from '../art';

type Mode = 'opening' | 'turn' | 'open' | 'windup' | 'stun';
interface Line { s: string; x: number; y: number; life: number; big?: boolean }
let s = init();
function init() {
  return { hp: 16, time: 0, punch: [0, 0], hitFx: 0, lines: [] as Line[], hitsSince: 0, mode: 'opening' as Mode, mT: 0, block: 0, hurt: 0, blocks: 0, taken: 0, stabs: 0, stabT: 0.7, enemyX: -40, cap: pick(LINES.captain), capT: 0 };
}
const fighting = (): boolean => s.mode !== 'opening' && s.mode !== 'turn';

function doBlock(): void { s.block = s.mode === 'windup' ? s.mT + 0.1 : 0.5; s.punch = [0, 0]; sfx.tick?.(); }
function doPunch(side: number): void {
  const warn = s.mode === 'windup';
  if (warn) { s.lines.push({ s: 'לא! המגן!', x: 180, y: 230, life: 0.6 }); sfx.tick?.(); return; }
  if (s.hurt > 0) return;
  s.punch[side < 0 ? 0 : 1] = 1; s.hp--; s.hitsSince++; s.hitFx = 0.25; R.shake(0.25); sfx.punch?.();
  s.lines.push({ s: pick(LINES.punchFx), x: 235 + s.enemyX + rnd(-30, 30), y: 160, life: 0.6, big: true });
  if (s.hp % 4 === 0) R.say(pick(LINES.punch), 1.2);
}

registerStage('cockpit', {
  enter() { s = init(); },
  key(e) {
    if (!fighting()) return false;
    if (e.key === 'ArrowLeft' || e.key === 'a') { doPunch(-1); return true; }
    if (e.key === 'ArrowRight' || e.key === 'd') { doPunch(1); return true; }
    if (e.key === 'ArrowDown' || e.key === 's') { doBlock(); return true; }
    return false;
  },
  step(dt) {
    s.time += dt; s.hitFx = Math.max(0, s.hitFx - dt); s.block = Math.max(0, s.block - dt); s.hurt = Math.max(0, s.hurt - dt);
    s.capT += dt; if (s.capT > 4) { s.capT = 0; s.cap = pick(LINES.captain); }
    if (s.mode === 'opening') {
      s.stabT -= dt;
      if (s.stabT <= 0) { s.stabs++; s.stabT = 0.7; R.shake(0.3); sfx.stab?.(); R.flash(0.15); s.lines.push({ s: 'דקירה ' + s.stabs + '/3', x: 100, y: 330, life: 0.7, big: true }); if (s.stabs >= 3) { s.mode = 'turn'; s.mT = 1.2; R.say('עכשיו הוא בא אליך!', 1.4); } }
    } else if (s.mode === 'turn') { s.mT -= dt; if (s.mT <= 0) s.mode = 'open'; }
    else {
      s.mT -= dt;
      if (s.mode === 'open' && s.hitsSince >= 4) { s.mode = 'windup'; s.mT = 1.1; s.hitsSince = 0; sfx.tick?.(); }
      else if (s.mode === 'windup' && s.mT <= 0) {
        if (s.block > 0) { s.blocks++; s.lines.push({ s: 'חסמת!', x: 235, y: 150, life: 0.8, big: true }); sfx.ok?.(); R.shake(0.15); s.mode = 'stun'; s.mT = 0.9; R.say(pick(LINES.blocked), 1.1); }
        else { s.taken++; s.hurt = 0.7; R.flash(0.35); R.shake(0.4); sfx.bad?.(); R.say('נדקרת! בפעם הבאה הקש על המגן', 1.5); s.mode = 'open'; }
      } else if (s.mode === 'stun' && s.mT <= 0) s.mode = 'open';
    }
    s.enemyX = lerp(s.enemyX, s.mode === 'opening' ? -40 : 0, Math.min(1, dt * 5));
    const p = input.taps.shift(); input.taps.length = 0;
    if (p && fighting()) {
      const isBlock = p.key || (Math.abs(p.x - W / 2) < 62 && p.y > H - 170);
      if (isBlock) doBlock(); else doPunch(p.x < W / 2 ? -1 : 1);
    }
    for (const l of s.lines) l.life -= dt; s.lines = s.lines.filter((l) => l.life > 0);
    for (const i of [0, 1]) s.punch[i] = Math.max(0, s.punch[i]! - dt * 5);
    if (s.hp <= 0) { const sc = Math.max(300, 1800 + s.blocks * 120 - s.taken * 150 - Math.floor(s.time * 10)); sfx.ok?.(); stageDone('cockpit', sc); }
  },
  render() {
    const warn = s.mode === 'windup', fight = fighting(), bl = s.block > 0;
    ctx.save(); ctx.translate(rnd(-3, 3) + Math.sin(s.time * 9) * 3 + G.sh(), rnd(-3, 3) + Math.sin(s.time * 5) * 4 + G.sh());
    ctx.fillStyle = '#4aa8ff'; ctx.fillRect(-10, -220, W + 20, H + 440);
    ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.moveTo(-10, 170 + Math.sin(s.time * 2) * 30); ctx.lineTo(W + 10, 110 + Math.sin(s.time * 2) * 30); ctx.lineTo(W + 10, H + 220); ctx.lineTo(-10, H + 220); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(((i * 97 + s.time * 60) % (W + 80)) - 40, 80 + i * 14, 40, 10, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.moveTo(-10, -220); ctx.lineTo(W + 10, -220); ctx.lineTo(W + 10, 60); ctx.lineTo(W / 2, 95); ctx.lineTo(-10, 60); ctx.fill();
    ctx.fillRect(-10, 250, W + 20, H); ctx.fillRect(-10, 0, 36, H); ctx.fillRect(W - 26, 0, 36, H);
    rr(26, 250, W - 52, 60, 0, '#2b3648');
    for (let i = 0; i < 5; i++) { circ(70 + i * 55, 280, 15, '#111'); circ(70 + i * 55, 280, 12, '#3ddc84'); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(70 + i * 55, 280); ctx.lineTo(70 + i * 55 + Math.cos(s.time * 3 + i) * 9, 280 + Math.sin(s.time * 3 + i) * 9); ctx.stroke(); }
    hzn(180, 280, 22, Math.sin(s.time) * 0.4, Math.sin(s.time * 1.3) * 0.3);
    ctx.fillStyle = '#303a4c'; ctx.fillRect(-10, 310, W + 20, H);
    ctx.fillStyle = 'rgba(200,16,46,.75)'; ctx.beginPath(); ctx.ellipse(95, 392, 66 + Math.min(30, s.time * 3), 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(95, 372); ctx.rotate(Math.PI / 2); person(0, 0, { sc: 2.2, shirt: '#f6f1e6', cap: true, blood: true, skin: '#e6b48c' }); ctx.restore();
    circ(60, 364, 7, '#fff'); circ(63, 365, 3.5, '#111');
    if (warn) { ctx.fillStyle = `rgba(255,0,0,${0.18 + Math.sin(s.time * 20) * 0.08})`; ctx.fillRect(-10, -220, W + 20, H + 440); }
    const ex = 235 + s.enemyX, lunge = warn ? -(1 - s.mT / 1.1) * 16 : 0, stabAnim = s.mode === 'opening' ? Math.max(0, 1 - s.stabT / 0.7) : 0;
    ctx.save(); ctx.translate(ex, 250 + lunge + (s.mode === 'opening' ? stabAnim * 18 : 0));
    if (s.hitFx > 0) ctx.rotate(Math.sin(s.time * 60) * 0.15); if (s.mode === 'stun') ctx.rotate(Math.sin(s.time * 20) * 0.1);
    ctx.scale(3.3, 3.3);
    person(0, 0, { sc: 1, shirt: '#f6f1e6', cap: true, skin: '#d9a374', hair: '#111' });
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-7, -22); ctx.lineTo(-2, -19.5); ctx.moveTo(7, -22); ctx.lineTo(2, -19.5); ctx.stroke();
    if (s.mode === 'opening') { ctx.save(); ctx.rotate(0.9 + stabAnim * 0.9); rr(9, -19, 2.6, 19, 1, '#eee'); rr(8.4, -1, 4.2, 4.2, 1, '#333'); ctx.restore(); }
    else if (warn) { ctx.save(); ctx.rotate(-1.3); rr(9, -25, 3, 25, 1, '#eee'); rr(8.4, -1, 4.6, 4.6, 1, '#333'); ctx.restore(); }
    else if (s.mode === 'stun') txt('★ ★', 0, -30, 7, '#ffb400');
    else { ctx.save(); ctx.rotate(-0.6 + Math.sin(s.time * 10) * 0.3); rr(9, -15, 2.3, 15, 1, '#ddd'); rr(8.4, -1, 3.8, 3.8, 1, '#333'); ctx.restore(); }
    ctx.restore();
    ctx.restore();
    // ---- UI layer (never shakes) ----
    bubble(s.cap, 95, 318, 11, '#fff', '#111', 75, 352);
    for (const l of s.lines) { ctx.globalAlpha = Math.max(0, l.life * 3); txt(l.s, l.x, l.y - (1 - l.life) * 30, l.big ? 26 : 14, l.big ? '#ffb400' : '#fff', 'center', 900); } ctx.globalAlpha = 1;
    if (s.hitFx > 0) { ctx.fillStyle = `rgba(255,255,255,${s.hitFx * 0.6})`; ctx.fillRect(0, 0, W, H); }
    if (s.hurt > 0) { ctx.fillStyle = `rgba(255,0,0,${s.hurt * 0.4})`; ctx.fillRect(0, 0, W, H); }
    const lab: [string, string] = s.mode === 'opening' ? ['דוקר את הקברניט!', '#ff3b3b'] : s.mode === 'turn' ? ['מסתובב אליך...', '#ffb400'] : warn ? ['⚠ מרים סכין! הקש על המגן!', '#ff3b3b'] : s.mode === 'stun' ? ['מסוחרר! תן לו!', '#3ddc84'] : ['תן מכות!', '#3ddc84'];
    rr(16, 92, W - 32, 54, 12, 'rgba(0,0,0,.7)'); txt(lab[0], W / 2, 108, 16, lab[1], 'center', 900);
    rr(60, 126, 240, 12, 6, 'rgba(255,255,255,.15)'); rr(60, 126, (240 * s.hp) / 16, 12, 6, '#ff3b3b'); txt('טייס המשנה', W - 24, 132, 10, '#cfd8e6', 'right', 400);
    rr(0, H - 200, W, 200, 0, 'rgba(15,26,43,.9)');
    for (const i of [0, 1]) { const p = s.punch[i]!, sx = i ? 1 : -1, hx = i ? W - 80 : 80, hy = H - 105 - p * 40; hand(bl ? W / 2 + sx * 44 : hx, bl ? H - 150 : hy, 'מכה', s.hurt > 0 && i === 1 ? '#c8102e' : '#e6b48c', fight && !bl && !warn, bl ? 0.8 : 1); }
    const bs = warn ? 1 + Math.sin(s.time * 25) * 0.1 : 1;
    ctx.save(); ctx.translate(W / 2, H - 110); ctx.scale(bs, bs); circ(0, 0, 48, warn ? '#ff3b3b' : bl ? '#3ddc84' : '#2b3648', warn ? '#fff' : '#ffb400', 4); txt('🛡', 0, -6, 32, '#fff'); txt('מגן', 0, 26, 13, '#fff', 'center', 900); ctx.restore();
    if (warn) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, H - 110, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - s.mT / 1.1)); ctx.stroke(); }
    txt(!fight ? 'תסתכל: הוא דוקר את הקברניט. עוד רגע הוא שלך.' : warn ? 'עכשיו! הקש על המגן!' : 'הקש על הידיים. 4 מכות ואז הוא תוקף.', W / 2, H - 22, 14, warn ? '#ff8a8a' : fight ? '#cfd8e6' : '#ffe08a', 'center', 900);
  },
});
