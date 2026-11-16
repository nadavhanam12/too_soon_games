// The three driving legs. Each sets up the shared city (drive.ts), listens to its events and decides what they mean
// in this leg of the story. Leg 2 has a forced detour stop (clinic or gas station, ~+40% route, research 6A):
//   sick: HR minivan roams; seen before the doctor's note = fired. The doctor takes ALL your money for the note.
//   quit: the tank drains; empty = WASTED. The gas station "beat" (no gray scene) fills it and starts a police chase.
// Leg 3: the store choice picks the chaser (loan sharks / cops / spouse); the quit branch's gas-theft cop resumes from
// where it froze when you walked into the store. Caught = WASTED.
import { R, W, ctx, input, pick, rr, txt, clamp, sfx } from '@tsg/index';
import { G, registerStage, stageDone, fail, addScore, say, hud, hint, demoDrag, LEG_TARGET_S, setPlaceLabels } from './play';
import { D, ev, resetWorld, stepWorld, renderWorld, renderStick, addPickups, addLetters, addHr, addChaser, behind, floatText, type ChaserKind } from './drive';
import { PLACES, type PlaceId } from './map';
import { BANNERS, HINT, LINES, PLACE_NAME } from './content';
import { C } from './art';
import { ptxt } from './pixel';

setPlaceLabels(PLACE_NAME);

/** A short parked moment at a stop: the car brakes, a progress ring fills, then `done` runs. */
interface Beat { t: number; dur: number; label: string; done: () => void }
let beat: Beat | null = null;
let crashCd = 0, noteCd = 0, fuelWarned = false, nagCd = 0;
/** Game-time delays (pause with the banner, die with the stage; never wall-clock setTimeout). */
let timers: Array<{ t: number; fn: () => void }> = [];
const later = (sec: number, fn: () => void): void => { timers.push({ t: sec, fn }); };
function runTimers(dt: number): void { const due = timers.filter((x) => (x.t -= dt) <= 0); timers = timers.filter((x) => x.t > 0); for (const x of due) x.fn(); }

function startBeat(label: string, dur: number, done: () => void): void { if (!beat) { beat = { t: 0, dur, label, done }; D.control = false; } }
function stepBeat(dt: number): boolean {
  if (!beat) return false;
  beat.t += dt;
  if (beat.t >= beat.dur) { const b = beat; beat = null; D.control = true; b.done(); }
  return true;
}
function renderBeat(): void {
  if (!beat) return;
  const k = clamp(beat.t / beat.dur, 0, 1), x = W / 2, y = 250;
  rr(x - 80, y - 46, 160, 30, 8, 'rgba(12,8,20,.85)'); ptxt(beat.label, x, y - 31, 2, C.yellow);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y + 10, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = C.pink; ctx.beginPath(); ctx.arc(x, y + 10, 18, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
}

/** Arriving at the leg's destination: brake, time bonus, next stage. */
function arriveEnd(label: string, extra = 0, after?: () => void): void {
  startBeat(label, 0.9, () => {
    const tb = Math.max(0, Math.round(((LEG_TARGET_S[G.stage] ?? 40) - G.t) * 10));
    if (tb > 0) { addScore(tb); say(`+${tb} time bonus`, 1.6, true); }
    if (extra) addScore(extra);
    after?.();
    sfx.ok?.(); stageDone();
  });
}

function commonEvents(): void {
  ev.pickup = (k, x, y) => {
    if (k === 'cash') { G.money += 20; addScore(50); floatText('+$20', x, y, C.money); sfx.coin?.(); say(pick(LINES.cash)); }
    else { addScore(50); floatText('+50', x, y); sfx.coin?.(); say(pick(LINES.can)); }
  };
  ev.letter = (ch) => { if (!G.letters.includes(ch)) G.letters.push(ch); addScore(200); floatText('+200', D.p.x, D.p.y - 30, C.pink); sfx.letter?.(); say(pick(LINES.letter).replace('{L}', ch), 2.4, true); };
  ev.crash = () => { if (crashCd > 0) return; crashCd = 0.8; G.hits++; addScore(-20); sfx.crash?.(); R.shake(0.25); say(pick(LINES.crash)); };
  ev.near = (x, y) => { addScore(10); floatText(pick(LINES.nearMiss), x, y - 20, C.teal); sfx.whoosh?.(); };
  ev.spotted = () => {};
  ev.caught = () => {};
  ev.taunt = () => {};
}
function tick(dt: number): void { runTimers(dt); crashCd -= dt; noteCd -= dt; nagCd -= dt; input.taps.length = 0; }
const hintFor = (): string => (D.usedKeys ? HINT.keys : HINT.touch);
const seedFor = (n: number): number => (Date.now() & 0xffff) * 31 + n;

// ---------- leg 1: the commute ----------
registerStage('commute', {
  enter() {
    beat = null; crashCd = 0; timers = [];
    resetWorld('home', 'office', seedFor(1));
    D.goal = 'office';
    const a = PLACES.home, b = PLACES.office;
    addPickups(14, 'cash', Math.min(a.x, b.x) - 120, Math.min(a.y, b.y) - 120, Math.max(a.x, b.x) + 120, Math.max(a.y, b.y) + 120);
    addLetters('WA', a, b);
    commonEvents();
    ev.arrive = (id) => { if (id === 'office') arriveEnd('PARKING', 0, () => say(LINES.arriveOffice[0]!, 1.6, true)); };
    R.banner(BANNERS.commute[0], [...BANNERS.commute[1]]);
  },
  step(dt) {
    tick(dt);
    if (stepBeat(dt)) { stepWorld(dt, { chasersOn: false }); return; }
    stepWorld(dt, { chasersOn: false });
    if (G.t > 6 && G.t % 11 < dt) say(pick(LINES.commute));
  },
  render() { renderWorld(['office']); renderBeat(); hud('office'); renderStick(); demoDrag(W / 2, 470); hint(hintFor()); },
});

// ---------- leg 2: launch line (forced detour) ----------
let detourDone = false;
const detourId = (): PlaceId => (G.branch === 'quit' ? 'gas' : 'clinic');
registerStage('launch', {
  enter() {
    beat = null; timers = []; detourDone = false; fuelWarned = false; noteCd = 0; nagCd = 0;
    if (!G.branch) G.branch = 'sick';
    resetWorld('office', 'store', seedFor(2));
    const a = PLACES.office, b = PLACES.store, dt = PLACES[detourId()];
    D.goal = detourId();
    addPickups(10, 'can', Math.min(a.x, b.x, dt.x) - 120, Math.min(a.y, b.y, dt.y) - 120, Math.max(a.x, b.x, dt.x) + 120, Math.max(a.y, b.y, dt.y) + 120);
    addLetters('ST', a, dt);
    commonEvents();
    if (G.branch === 'sick') {
      G.note = false;
      addHr({ x: (a.x + dt.x) / 2, y: dt.y - 200 });
      ev.spotted = () => {
        if (beat) return;
        if (!G.note) { sfx.bad?.(); fail('fired'); return; }
        if (noteCd <= 0) { noteCd = 5; say(pick(LINES.noteFlash), 2, true); }
      };
    } else {
      G.fuel = 0.62;   // you quit before filling up
      ev.caught = () => fail('cop');
    }
    ev.arrive = (id) => {
      if (id === detourId() && !detourDone) {
        if (G.branch === 'sick') {
          say(LINES.doctor[0]!, 1.4, true);
          startBeat('BRIBING', 1.8, () => {
            say(LINES.doctor[1]!, 2.4, true); floatText(`-$${G.money}`, D.p.x, D.p.y - 24, C.red);
            G.money = 0; G.note = true; detourDone = true; D.goal = 'store'; sfx.cough?.();
            later(2.6, () => say(LINES.noteOk, 2.2, true));
          });
        } else {
          startBeat('PUMPING', 1.6, () => {
            G.fuel = 1; detourDone = true; D.goal = 'store'; say(pick(LINES.gas), 2.2, true); sfx.pump?.();
            later(0.9, () => { const sp = behind(340); addChaser('cop', sp.x, sp.y, 0.6, 0.8); G.stars = 1; sfx.siren?.(); say(LINES.sirens, 1.8, true); });
          });
        }
      } else if (id === 'store' && detourDone) {
        arriveEnd('PARKING', 0, () => { const cop = D.chasers.find((c) => c.kind === 'cop'); G.copPos = cop ? { x: cop.x, y: cop.y } : null; });
      }
    };
    const b2 = G.branch === 'sick' ? BANNERS.launchSick : BANNERS.launchQuit;
    R.banner(b2[0], [...b2[1]]);
  },
  step(dt) {
    tick(dt);
    if (stepBeat(dt)) { stepWorld(dt, { chasersOn: false }); return; }
    stepWorld(dt, { chasersOn: true });
    // driving past the store before the detour stop
    if (!detourDone && nagCd <= 0 && Math.hypot(PLACES.store.x - D.p.x, PLACES.store.y - D.p.y) < 60) { nagCd = 4; say(G.branch === 'sick' ? LINES.noteFirst : LINES.gasFirst, 2, true); }
    if (G.branch === 'sick') {
      if (!G.note && D.hr && Math.hypot(D.hr.x - D.p.x, D.hr.y - D.p.y) < 180 && nagCd <= 0) { nagCd = 5; say(pick(LINES.hrClose), 1.8, true); }
      else if (G.t > 5 && G.t % 12 < dt) say(pick(LINES.hr));
    } else {
      G.fuel -= dt / 50;
      if (G.fuel < 0.3 && !fuelWarned) { fuelWarned = true; say(pick(LINES.fuelLow), 2, true); }
      if (G.fuel > 0.3) fuelWarned = false;
      if (G.fuel <= 0) { G.fuel = 0; fail('fuel'); }
    }
  },
  render() {
    renderWorld(detourDone ? ['store'] : [detourId()]); renderBeat();
    hud(D.goal, { fuel: G.branch === 'quit' }); renderStick(); hint(hintFor());
  },
});

// ---------- leg 3: the way home (chase) ----------
registerStage('home', {
  enter() {
    beat = null; timers = [];
    if (!G.branch) G.branch = 'sick';
    if (!G.store) G.store = 'steal';
    resetWorld('store', 'home', seedFor(3));
    D.goal = 'home';
    const a = PLACES.store, b = PLACES.home;
    addPickups(8, 'can', Math.min(a.x, b.x) - 120, Math.min(a.y, b.y) - 120, Math.max(a.x, b.x) + 120, Math.max(a.y, b.y) + 120);
    addLetters('ED', a, b);
    commonEvents();
    const kind: ChaserKind = G.store === 'loan' ? 'shark' : G.store === 'steal' ? 'cop' : 'spouse';
    G.stars = (G.store === 'steal' ? 1 : 0) + (G.branch === 'quit' ? 1 : 0);
    const sp = behind(380); addChaser(kind, sp.x, sp.y, 0.6, 1.2);
    if (G.branch === 'quit') { // the gas-theft cop resumes where it froze, but never right on your bumper
      const cp = G.copPos, c = cp && Math.hypot(cp.x - D.p.x, cp.y - D.p.y) > 300 ? cp : behind(520); addChaser('cop', c.x, c.y, 0.6, 1.2);
    }
    ev.caught = (k) => fail(k);
    ev.taunt = (k, x, y) => { if (k === 'spouse') floatText(pick(['TOUCH GRASS!', 'THE RING?!', 'COME BACK!']), x, y - 26, '#d9b3ff'); else if (k === 'shark') floatText(pick(['PAY UP!', 'KNEECAPS!']), x, y - 26, C.yellow); else sfx.siren?.(); };
    ev.arrive = (id) => { if (id === 'home') arriveEnd('HOME!', Math.max(0, 1000 - 10 * G.hits), () => { say(LINES.escape, 2, true); D.chasers = []; }); };
    const intro = G.branch === 'quit' && G.store === 'steal' ? pick(LINES.chase.cop2) : pick(LINES.chase[kind]);
    R.banner(BANNERS.home[0], [intro, ...BANNERS.home[1]]);
  },
  step(dt) {
    tick(dt);
    if (stepBeat(dt)) { stepWorld(dt, { chasersOn: false }); return; }
    stepWorld(dt, { chasersOn: true });
  },
  render() { renderWorld(['home']); renderBeat(); hud('home'); renderStick(); hint(hintFor()); void txt; },
});
