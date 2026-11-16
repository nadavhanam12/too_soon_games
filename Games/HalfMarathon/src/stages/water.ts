// Stage 2 (km 3-8): the water station. The volunteers' table slides by; tap to grab what is inside the orange ring.
// Water / sports drink refill the thirst meter; local food (halloumi, gyros, loukoumades, Cypriot coffee) is a speed
// boost; ouzo makes the road spin. A street cat walks the table and steals food before you get there.
import { R, W, SAFE_H as H, ctx, input, rr, txt, clamp, rnd, pick, sfx, rand } from '@tsg/index';
import { G, registerStage, pxPerKm, hint, say, nudge, demo } from '../play';
import { LINES } from '../content';
import { C, FOOD, cat, item, person, runnerSide, seafront, type Item } from '../art';

const RX = 110, RY = 520, TY = 420, RING = { x: RX + 24, r: 30 }, SCROLL = 170;
interface Thing { kind: Item; x: number; taken?: boolean }
interface Thief { x: number; t: number; target: Thing | null; dir: number; stole?: boolean }
let s = init();
function init() { return { things: [] as Thing[], nextX: W + 40, thirst: 0.65, boost: 0, wobble: 0, jitter: 0, grab: 0, thirstSaid: 0, thief: null as Thief | null, thiefIn: 3.5 }; }
function roll(): Item {
  const r = rand();
  return r < 0.36 ? 'water' : r < 0.56 ? 'sports' : r < 0.66 ? 'halloumi' : r < 0.75 ? 'gyros' : r < 0.82 ? 'loukoumades' : r < 0.88 ? 'coffee' : 'ouzo';
}
const NAME: Record<string, string> = { halloumi: 'halloumi', gyros: 'gyros', loukoumades: 'loukoumades', coffee: 'coffee' };

registerStage('water', {
  peek: () => s, // read-only state for the bugcheck playthrough bot (playthrough.mjs)
  enter() { s = init(); for (let x = 200; x < W + 60; x += rnd(70, 100)) s.things.push({ kind: roll(), x }); s.nextX = W + 60; },
  step(dt) {
    const v = SCROLL * G.f;
    for (const t of s.things) t.x -= v * dt;
    s.nextX -= v * dt;
    if (s.nextX < W + 40 && G.km < 7.7) { s.things.push({ kind: roll(), x: s.nextX + 40 }); s.nextX += rnd(70, 105); }
    s.things = s.things.filter((t) => t.x > -40);
    s.thirst = clamp(s.thirst - dt * 0.075, 0, 1);
    s.boost = Math.max(0, s.boost - dt); s.wobble = Math.max(0, s.wobble - dt); s.jitter = Math.max(0, s.jitter - dt); s.grab = Math.max(0, s.grab - dt * 4);
    // the cat thief: lands on a food item ahead of you, takes it, runs off along the table
    s.thiefIn -= dt;
    if (!s.thief && s.thiefIn <= 0) {
      const target = s.things.find((t) => !t.taken && FOOD.has(t.kind) && t.x > RING.x + 90 && t.x < W - 20);
      if (target) s.thief = { x: target.x + 30, t: 0, target, dir: 0 };
      s.thiefIn = rnd(4.5, 6.5);
    }
    if (s.thief) {
      const th = s.thief; th.t += dt;
      if (th.target && !th.target.taken) th.x = th.target.x + Math.max(0, 30 - th.t * 60);
      if (th.t > 0.6 && th.target && !th.target.taken) { th.target.taken = true; th.dir = 1; th.stole = true; sfx.meow?.(); say(pick(LINES.thief).replace('{food}', NAME[th.target.kind] ?? 'snack'), 1.5, true); }
      if (!th.dir && th.target?.taken) th.dir = 1; // you grabbed it first: the cat leaves, offended
      if (th.dir) th.x += 220 * dt; else th.x -= v * dt;
      if (th.x > W + 60) s.thief = null;
    }
    const p = input.taps.shift(); input.taps.length = 0;
    if (p) {
      const t = s.things.filter((q) => !q.taken && Math.abs(q.x - RING.x) < RING.r).sort((a, b) => Math.abs(a.x - RING.x) - Math.abs(b.x - RING.x))[0];
      s.grab = 1;
      if (t) {
        t.taken = true;
        if (t.kind === 'water' || t.kind === 'sports') { s.thirst = clamp(s.thirst + (t.kind === 'water' ? 0.35 : 0.45), 0, 1); sfx.ok?.(); say(pick(LINES.water), 0.9); }
        else if (t.kind === 'ouzo') { s.wobble = 3; s.boost = 0; sfx.bad?.(); R.shake(0.2); say(pick(LINES.ouzo), 1.4, true); nudge(); }
        else {
          s.boost = t.kind === 'coffee' ? 3.2 : 2.6; if (t.kind === 'coffee') s.jitter = 3.2;
          G.tag = LINES.foodTag[t.kind] ?? ''; sfx.halloumi?.(); say(pick(LINES.food[t.kind] ?? ['Boost!']), 1.2, true);
        }
      } else { sfx.tick?.(); nudge(); }
    }
    if (s.thirst < 0.15 && G.t - s.thirstSaid > 3) { s.thirstSaid = G.t; say(pick(LINES.thirsty), 1.2, true); nudge(); }
    G.f = s.boost > 0 ? 1.35 : s.wobble > 0 ? 0.7 : s.thirst < 0.15 ? 0.55 : 1;
  },
  render() {
    const off = G.km * pxPerKm(SCROLL), wob = s.wobble > 0 ? Math.sin(G.t * 5) * 0.06 * Math.min(1, s.wobble) : 0;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(wob); ctx.translate(-W / 2, -H / 2);
    seafront(off, G.t, H);
    for (let i = 0; i < 7; i++) { const x = ((i * 64 - off * 0.999) % 448 + 448) % 448 - 40; person(x, TY - 22, { sc: 0.9, shirt: '#3ddc84', hair: (['#3a2a1a', '#111', C.blonde] as const)[i % 3] }); }
    rr(-10, TY, W + 20, 12, 2, '#e9e1cf'); rr(-10, TY + 12, W + 20, 26, 0, '#ffffff');
    txt('WATER · ΝΕΡΟ', W / 2 + 60, TY + 25, 11, '#1f7fbf', 'center', 900);
    for (const t of s.things) if (!t.taken) item(t.kind, t.x, TY, 1.1);
    if (s.thief) { ctx.save(); if (!s.thief.dir) cat(s.thief.x, TY, 1, G.t, '#444'); else { ctx.translate(s.thief.x, TY); ctx.scale(-1, 1); cat(0, 0, 1, G.t * 2, '#444'); ctx.scale(-1, 1); if (s.thief.stole) item(s.thief.target?.kind ?? 'halloumi', 18, -12, 0.6); } ctx.restore(); }
    const hot = s.things.some((q) => !q.taken && Math.abs(q.x - RING.x) < RING.r);
    ctx.strokeStyle = hot ? '#ff8a00' : 'rgba(255,138,0,.55)'; ctx.lineWidth = hot ? 4 : 3;
    ctx.beginPath(); ctx.arc(RING.x, TY - 12, RING.r, 0, Math.PI * 2); ctx.stroke();
    const jx = s.jitter > 0 ? Math.sin(G.t * 60) * 2 : 0;
    runnerSide(RX + jx, RY, 1.7, G.t, G.f);
    if (s.grab > 0) { ctx.strokeStyle = C.skin; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(RX + 6, RY - 50); ctx.lineTo(RING.x, TY - 8 + (1 - s.grab) * 20); ctx.stroke(); }
    ctx.restore();
    rr(16, 100, 150, 34, 10, 'rgba(11,37,69,.78)'); txt('THIRST', 26, 117, 11, '#cfe3f5', 'left', 900);
    rr(80, 112, 76, 10, 5, 'rgba(255,255,255,.2)'); rr(80, 112, 76 * s.thirst, 10, 5, s.thirst < 0.15 ? '#ff6a6a' : '#7fd3ff');
    if (s.wobble > 0) { rr(W - 150, 100, 134, 34, 10, '#1f4fa0'); txt('OUZO. OOPS.', W - 83, 117, 12, '#ffffff', 'center', 900); }
    demo('tap', RING.x + 4, TY + 70);
    hint('Tap when something is in the ring');
  },
});
