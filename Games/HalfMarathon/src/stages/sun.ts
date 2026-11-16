// Stage 3 (km 8-15): the Cyprus sun. Hold = run faster but heat up; let go = cool down. Overheat = forced walk.
// Street cats cross the road: let go before you reach one, or trip over it. A grandpa on a plastic chair says "siga siga".
// A Brit on the beach slowly turns lobster red; the sun puts on sunglasses when you heat up; at km 12 you draft a post.
import { R, W, SAFE_H as H, ctx, input, keyHeld, rr, txt, clamp, rnd, pick, sfx } from '@tsg/index';
import { G, registerStage, pxPerKm, segK, hint, say, nudge, demo } from '../play';
import { LINES } from '../content';
import { C, bubble, cat, person, runnerSide, seafront, sunbather } from '../art';

const RX = 110, RY = 520, SCROLL = 210;
interface Cat { x: number; col: string; done?: boolean; tripped?: boolean }
let s = init();
function init() { return { heat: 0.25, over: 0, trip: 0, cats: [] as Cat[], catIn: 2.6, grandpa: -99, gline: '', said: 0, bus: 0, busOn: false }; }
const holding = (): boolean => input.down || keyHeld(' ', 'ArrowUp', 'ArrowRight');

registerStage('sun', {
  peek: () => s, // read-only state for the bugcheck playthrough bot (playthrough.mjs)
  enter() { s = init(); },
  step(dt) {
    input.taps.length = 0;
    s.over = Math.max(0, s.over - dt); s.trip = Math.max(0, s.trip - dt);
    const hold = holding() && s.over <= 0;
    if (s.over > 0) { s.heat = clamp(s.heat - dt * 0.25, 0, 1); }
    else if (hold) { s.heat = clamp(s.heat + dt * 0.2, 0, 1); if (s.heat >= 1) { s.over = 2.4; sfx.bad?.(); R.shake(0.2); say('Overheated. Walking. Sweating.', 1.6, true); nudge(); } }
    else s.heat = clamp(s.heat - dt * 0.24, 0, 1);
    G.f = s.trip > 0 ? 0.3 : s.over > 0 ? 0.35 : hold ? 1.3 : 0.85;
    const v = SCROLL * G.f;
    // cats
    s.catIn -= dt;
    if (s.catIn <= 0 && G.km < 14.5) { s.catIn = rnd(2.8, 4.2); s.cats.push({ x: W + 30, col: pick(['#e08a3c', '#444', '#d9d0c0', '#8a6d3b']) }); }
    for (const c of s.cats) {
      c.x -= v * dt;
      if (!c.done && c.x < RX + 26) {
        c.done = true;
        if (hold) { c.tripped = true; s.trip = 1; sfx.hit?.(); R.shake(0.3); say(pick(LINES.catTrip), 1.5, true); nudge(); }
        else { sfx.meow?.(); say(pick(LINES.catOk), 1); }
      }
    }
    s.cats = s.cats.filter((c) => c.x > -40);
    // grandpa (~km 11) and the bus (~km 13): props with one line each
    if (s.gline === '' && G.km > 10.6) { s.grandpa = W + 40; s.gline = pick(LINES.siga); }
    if (s.grandpa > -60) s.grandpa -= v * dt;
    if (!s.busOn && G.km > 12.8) { s.busOn = true; s.bus = -80; say(pick(LINES.bus), 1.6, true); sfx.honk?.(); }
    if (s.busOn) s.bus += (260 + v) * dt;
    if (hold && G.t - s.said > 4.5) { s.said = G.t; say(pick(LINES.sunHot), 1.4); }
  },
  render() {
    const off = G.km * pxPerKm(SCROLL), hold = holding() && s.over <= 0;
    seafront(off, G.t, H, s.heat);
    for (let i = 0; i < 2; i++) sunbather(((i * 260 + 200 - off * 0.6) % 520 + 520) % 520 - 60, 352, clamp(segK() * 1.2, 0, 1));
    if (s.grandpa > -60) {
      const x = s.grandpa; rr(x - 14, 400, 28, 4, 2, '#ffffff'); rr(x - 12, 404, 4, 18, 1, '#ffffff'); rr(x + 8, 404, 4, 18, 1, '#ffffff'); rr(x + 8, 372, 4, 30, 1, '#ffffff');
      person(x, 392, { sc: 1, shirt: '#ffffff', hair: '#d0d0d0' });
      if (x < W - 30 && x > 30) bubble(s.gline, x, 336, 11, '#fff', '#111', x, 362);
    }
    if (s.busOn && s.bus < W + 200) {
      // a tour bus on the far lane, coming from the "wrong" side
      const x = W - s.bus; rr(x - 70, 380, 140, 44, 8, '#ffffff', C.ink, 2); for (let i = 0; i < 4; i++) rr(x - 62 + i * 32, 388, 24, 14, 3, '#8fd3f4');
      txt('TOURS', x, 414, 10, C.orange, 'center', 900); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 44, 426, 8, 0, 7); ctx.arc(x + 44, 426, 8, 0, 7); ctx.fill();
    }
    for (const c of s.cats) cat(c.x, RY + 10, 1.4, G.t, c.col);
    const warn = s.cats.some((c) => !c.done && c.x - RX < 170);
    if (warn) { rr(RX + 70, RY - 120, 84, 30, 10, '#ff3b3b'); txt('CAT! LET GO', RX + 112, RY - 104, 11, '#ffffff', 'center', 900); }
    runnerSide(RX, RY, 1.7, G.t, G.f, s.over > 0 ? 1 : s.heat * 0.6);
    if (s.trip > 0) txt('✶', RX + 20, RY - 90, 22, '#ffd23f', 'center', 900);
    if (G.km > 11.6 && G.km < 12.5) { for (const [dx, dy, r] of [[14, -96, 3], [22, -110, 5]] as const) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(RX + dx, RY + dy, r, 0, 7); ctx.fill(); } bubble(LINES.thought, RX + 90, RY - 140, 11, '#ffffff', '#0b2545'); }
    // heat meter
    rr(16, 100, 180, 34, 10, 'rgba(11,37,69,.78)'); txt('HEAT', 26, 117, 11, '#cfe3f5', 'left', 900);
    rr(66, 112, 120, 10, 5, 'rgba(255,255,255,.2)'); rr(66, 112, 120 * s.heat, 10, 5, s.heat > 0.8 ? '#ff3b3b' : '#ffb347');
    rr(W - 100, 100, 84, 34, 10, 'rgba(11,37,69,.78)'); txt(Math.round(29 + s.heat * 5) + '°C', W - 58, 117, 15, '#ffd23f', 'center', 900);
    demo('hold', W / 2 + 60, RY + 40);
    hint(s.over > 0 ? 'Overheated! Wait for it…' : hold ? 'Sprinting! Let go before the heat bar fills' : 'Hold anywhere to sprint');
  },
});
