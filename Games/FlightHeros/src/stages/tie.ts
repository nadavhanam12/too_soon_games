// Stage 4: wrap the headphone cable around him (24 taps in rhythm; hold during rages), then the "tied" interlude.
import { R, W, SAFE_H as H, ctx, input, state, rr, txt, clamp, rnd, pick, fmtInt, sfx } from '@tsg/index';
import { G, registerStage, stageDone, strip } from '../play';
import { LINES } from '../content';
import { bubble, person, btn, tiedGuy } from '../art';

const B = { x: W / 2, y: 500, w: 260, h: 70 }, NEED = 24;
let s = init();
function init() { return { loops: 0, time: 0, rage: 0, rageT: rnd(3, 4.2), hold: 0, str: 0, calm: 0, lost: 0, lastCalm: 0, pop: 0, lastTap: -9, jam: 0 }; }
const holding = (): boolean => (input.down && Math.abs(input.px - B.x) < B.w / 2 && Math.abs(input.py - B.y) < B.h / 2 + 12) || !!input.keys['ArrowDown'] || !!input.keys[' '];

registerStage('tie', {
  enter() { s = init(); },
  step(dt) {
    s.time += dt; s.str = Math.max(0, s.str - dt); s.pop = Math.max(0, s.pop - dt * 6); s.jam = Math.max(0, s.jam - dt);
    const hold = holding();
    if (s.rage > 0) {
      s.rage -= dt; s.str = 0.3;
      if (hold) { s.hold += dt; if (s.hold >= 0.9) { s.rage = 0; s.calm++; s.hold = 0; s.rageT = rnd(3.2, 4.5); sfx.ok?.(); R.say(pick(LINES.calmed), 1.1); } }
      if (s.rage <= 0 && s.calm === s.lastCalm) { s.loops = Math.max(0, s.loops - 4); s.lost++; R.shake(0.3); sfx.bad?.(); R.say('הוא השתחרר מ-4 לולאות!', 1.2); s.rageT = rnd(3, 4.2); }
      s.lastCalm = s.calm;
    } else { s.rageT -= dt; if (s.rageT <= 0 && s.loops < NEED - 2) { s.rage = 2.8; s.hold = 0; s.lastCalm = s.calm; sfx.hit?.(); R.shake(0.3); } }
    const rg = s.rage > 0;
    const p = input.taps.shift(); input.taps.length = 0;
    if (p) {
      if (!rg && (p.key || (Math.abs(p.x - B.x) < B.w / 2 + 15 && Math.abs(p.y - B.y) < B.h / 2 + 15))) {
        if (s.time - s.lastTap < 0.22) { s.jam = 0.5; if (s.loops > 0 && Math.random() < 0.5) s.loops--; sfx.bad?.(); R.say('לאט! הכבל מסתבך', 0.8); }
        else { s.loops++; s.pop = 1; sfx.tick?.(); R.shake(0.06); if (s.loops % 6 === 0) R.say(pick(LINES.loop), 1); }
        s.lastTap = s.time;
      } else if (rg) R.say('הוא משתולל! לחץ והחזק', 0.9);
    }
    if (s.loops >= NEED) { const sc = Math.max(200, 1500 + s.calm * 80 - s.lost * 120 - Math.floor(s.time * 10)); sfx.ok?.(); stageDone('tie', sc); }
  },
  render() {
    const rg = s.rage > 0, hold = holding();
    ctx.fillStyle = '#1f2937'; ctx.fillRect(-10, -220, W + 20, H + 440);
    ctx.save(); ctx.translate(rnd(-1.5, 1.5) * (rg ? 4 : 1) + G.sh(), rnd(-1.5, 1.5) * (rg ? 4 : 1) + G.sh());
    rr(30, 110, 300, 330, 20, rg ? '#4a2b35' : '#2b3648');
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(180, 310, 125, 75, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rg ? '#ff3b3b' : s.jam > 0 ? '#ffb400' : '#3ddc84'; ctx.beginPath(); ctx.ellipse(180, 310, 125, 75, 0, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * s.loops) / NEED); ctx.stroke();
    tiedGuy(Math.min(16, Math.floor((s.loops * 16) / NEED)), s.str, rg, '🎧 אוזניות');
    person(290, 340, { sc: 1.6, shirt: '#3ddc84' });
    ctx.restore();
    if (rg) bubble('הוא משתולל!! תחזיק אותו!', 180, 150, 14, '#ff3b3b', '#fff', 180, 230);
    const pulse = rg ? 1 + Math.sin(s.time * 22) * 0.05 : 1 + s.pop * 0.08;
    ctx.save(); ctx.translate(B.x, B.y); ctx.scale(pulse, pulse);
    if (rg) btn(hold ? 'מחזיק...' : 'תחזיק! (לחץ והחזק)', 0, 0, B.w, B.h, hold ? '#3ddc84' : '#ff3b3b', hold ? '#111' : '#fff', 22);
    else btn(s.jam > 0 ? 'לאט...' : 'לפף! 🎧', 0, 0, B.w, B.h, s.jam > 0 ? '#8a6d3b' : '#ffb400', '#111', 26);
    ctx.restore();
    if (rg) { rr(B.x - 130, B.y + 46, 260, 8, 4, 'rgba(255,255,255,.2)'); rr(B.x - 130, B.y + 46, 260 * clamp(s.hold / 0.9, 0, 1), 8, 4, '#3ddc84'); }
    txt(s.loops + ' / ' + NEED + ' לולאות', W / 2, 566, 14, '#cfd8e6', 'center', 900);
    txt(rg ? 'החזק את הכפתור (או רווח) עד שיירגע' : 'הקש בקצב קבוע. מהר מדי = הכבל מסתבך', W / 2, 606, 14, '#fff', 'center', 900);
  },
});

// the interlude: he is neutralised; the dentist helps the captain; tap (or 6 s) → the yoke
let tiedT = 0;
registerStage('tied', {
  enter() { tiedT = 0; },
  step(dt) {
    tiedT += dt;
    const tapped = input.taps.length > 0; input.taps.length = 0;
    if (tapped || tiedT > 6) stageDone('tied', 0);
  },
  render() {
    ctx.fillStyle = '#1f2937'; ctx.fillRect(0, -220, W, H + 440);
    rr(30, 110, 300, 330, 20, '#2b3648');
    tiedGuy(16, 0, false, '🎧 אוזניות');
    person(290, 340, { sc: 1.6, shirt: '#3ddc84' });
    bubble('קשרנו אותו עם אוזניות המולטימדיה', 180, 140, 13, '#fff', '#111', 180, 215);
    rr(16, 460, W - 32, 120, 14, 'rgba(15,26,43,.85)');
    txt('הוא נוטרל.', W / 2, 486, 26, '#ffb400', 'center', 900);
    txt('רופא השיניים משורה 9 חוסם את הדימום של הקברניט.', W / 2, 520, 12, '#cfd8e6', 'center', 400);
    txt('אבל המטוס עדיין צולל. ' + fmtInt(Math.round(G.alt / 100) * 100) + ' רגל.', W / 2, 545, 13, '#fff', 'center', 700);
    if (Math.sin(state.t * 5) > -0.2) txt('הקש כדי לתפוס את ההגה', W / 2, 605, 15, '#ffe08a', 'center', 900);
    void strip;
  },
});
