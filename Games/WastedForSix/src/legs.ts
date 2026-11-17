// The three driving legs. Each sets up the shared city (drive.ts), listens to its events and decides what they mean
// in this leg of the story. Leg 2 has a forced detour stop (clinic or gas station, ~+40% route, research 6A):
//   sick: HR minivan roams; seen before the doctor's note = fired. The doctor takes ALL your money for the note.
//   quit: the tank drains; empty = WASTED. The gas station "beat" (no gray scene) fills it and starts a police chase.
// Leg 3: the store choice picks the chaser (loan sharks / cops / spouse); the quit branch's gas-theft cop resumes from
// where it froze when you walked into the store. Caught = WASTED.
import { R, W, view, ctx, state, input, keyName, pick, rr, txt, clamp, sfx, easeO, easeOB, inBtn, pop, haptic } from '@tsg/index';
import { G, registerStage, stageDone, fail, addScore, say, hud, hint, demoDrag, LEG_TARGET_S, setPlaceLabels, nextStation, stationName } from './play';
import { D, ev, resetWorld, stepWorld, renderWorld, renderStick, addPickups, addLetters, addHr, addChaser, nearHr, behind, floatText, stickPos, renderMinimap, MINI, type ChaserKind } from './drive';
import { PLACES, CELL, type PlaceId } from './city';
import { BANNERS, HOW_KEYS, HINT, LINES, PLACE_NAME, BOOST_TEXT, UI, TAUNTS } from './content';
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
  if (beat.t >= beat.dur) { const b = beat; beat = null; walk = null; D.control = true; b.done(); }
  return true;
}
function renderBeat(): void {
  if (!beat) return;
  const k = clamp(beat.t / beat.dur, 0, 1), x = W / 2, y = 250, inK = easeOB(Math.min(1, beat.t / 0.2));
  ctx.save(); ctx.translate(x, y - 10); ctx.scale(inK, inK); ctx.translate(-x, -(y - 10));   // the card pops in
  rr(x - 80, y - 46, 160, 30, 8, 'rgba(14,14,16,.85)'); ptxt(beat.label, x, y - 31, 2, C.yellow);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y + 10, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = C.pink; ctx.beginPath(); ctx.arc(x, y + 10, 18, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** After parking, the fan gets out of the car and walks into the building; then `done` runs. */
interface Walk { t: number; dur: number; x0: number; y0: number; x1: number; y1: number; done: () => void }
let walk: Walk | null = null;
const WALK_S = 2.4;   // 1.6 → 2.4 on 2026-11-17 (Nadav): the timeline moment during the walk needs the time to be read
function startWalk(id: PlaceId, done: () => void): void {
  const pl = PLACES[id], cx = pl.i * CELL, cy = pl.j * CELL;
  // out of the driver's door, then toward the middle of the building's block (the door side faces the road)
  const side = { x: D.p.x - Math.sin(D.p.a) * -2.2, y: D.p.y + Math.cos(D.p.a) * -2.2 };
  const dx = cx - pl.x, dy = cy - pl.y, L = Math.hypot(dx, dy) || 1;
  walk = { t: 0, dur: WALK_S, x0: side.x, y0: side.y, x1: pl.x + (dx / L) * 17, y1: pl.y + (dy / L) * 17, done };
  D.control = false; D.closeUp = true;   // the camera comes down on him: one thing to look at (staging)
}
function stepWalk(dt: number): boolean {
  if (!walk) return false;
  walk.t += dt; G.arrive = walk.t;   // play.ts hud: the timeline comes down and the pin rides to the next stop
  const k =clamp(walk.t / walk.dur, 0, 1), x = walk.x0 + (walk.x1 - walk.x0) * k, y = walk.y0 + (walk.y1 - walk.y0) * k;
  D.walker = k < 1 ? { x, y, a: Math.atan2(walk.y1 - walk.y0, walk.x1 - walk.x0), step: walk.t * 9 } : null;
  if (k >= 1) { const w = walk; walk = null; D.walker = null; D.closeUp = false; w.done(); }
  return true;
}

/** Arriving at the leg's destination: brake, time bonus, walk inside, next stage. */
function arriveEnd(id: PlaceId, label: string, extra = 0, after?: () => void): void {
  if (walk) return;   // already parked and walking in (the arrive event keeps firing while the car sits at the door)
  startBeat(label, 0.7, () => {
    const tb = Math.max(0, Math.round(((LEG_TARGET_S[G.stage] ?? 40) - G.t) * 10));
    if (tb > 0) { addScore(tb); say(UI.timeBonus(tb), 1.6, true); }
    if (extra) addScore(extra);
    after?.();
    startWalk(id, () => stageDone());
  });
}

function commonEvents(): void {
  ev.pickup = (k, x, y) => {
    haptic(8);
    if (k === 'cash') { G.money += 20; addScore(50); floatText('+$20', x, y, C.money); sfx.cash?.(); say(pick(LINES.cash)); }
    else { addScore(50); floatText('+50', x, y); sfx.can?.(); say(pick(LINES.can)); }
  };
  ev.letter = (ch) => { if (!G.letters.includes(ch)) G.letters.push(ch); addScore(200); floatText('+200', D.p.x, D.p.y - 30, C.pink); sfx.letter?.(); say(pick(LINES.letter).replace('{L}', ch), 2.4, true); };
  ev.crash = () => { if (crashCd > 0) return; crashCd = 0.8; G.hits++; addScore(-20); sfx.crash?.(); R.shake(0.25); haptic(45); say(pick(LINES.crash)); };
  ev.bump = (k) => { sfx.bump?.(k); haptic(Math.round(6 + 14 * k)); };
  ev.boost = (k) => { sfx.boost?.(k); haptic(25); floatText(BOOST_TEXT, D.p.x, D.p.y - 8, C.yellow); };
  ev.near = (x, y) => { addScore(10); floatText(pick(LINES.nearMiss), x, y - 20, C.teal); sfx.near?.(); };
  ev.ped = (x, y) => { sfx.ped?.(); haptic(18); floatText(pick(LINES.ped), x, y - 6, '#ffffff'); };
  ev.spotted = () => {};
  ev.caught = () => {};
  ev.taunt = () => {};
}
/** Entry: the stick and the minimap rise from the bottom edge when a leg starts. */
function controlsIn(draw: () => void): void { if (G.failT > 0) return; const k = easeOB(Math.min(1, Math.max(0, G.t - 0.1) / 0.3)); ctx.save(); ctx.translate(0, (1 - k) * 170); draw(); ctx.restore(); }
// ---------- the car radio: a button above the minimap (and the R key) tunes to the next track ----------
const RADIO_W = MINI, RADIO_H = 34;
const radioPos = (): { x: number; y: number } => ({ x: view.x0 + view.fullW - 12 - RADIO_W / 2, y: view.H - view.top - MINI - 62 - 10 - RADIO_H / 2 });
function radioTaps(): void {
  const b = radioPos();
  for (const p of input.taps) if (!p.key && inBtn(p, b.x, b.y, RADIO_W, RADIO_H, 8)) { nextStation(); return; }
}
function radioKey(e: KeyboardEvent): boolean { if (keyName(e) !== 'r') return false; nextStation(); return true; }
/** The button: a note and "RADIO"; for 2 s after a change it shows the station's name instead, and pops. */
function renderRadio(): void {
  const b = radioPos(), age = state.t - G.radioT, fresh = age < 2;
  ctx.save(); ctx.translate(b.x, b.y); const s = pop(age, 0.16, 0.14); ctx.scale(s, s); ctx.translate(-b.x, -b.y);
  if (fresh) {
    rr(b.x - RADIO_W / 2, b.y - RADIO_H / 2, RADIO_W, RADIO_H, 8, 'rgba(14,14,16,.85)', C.yellow, 1.5);
    ctx.globalAlpha = easeO(clamp((2 - age) / 0.3, 0, 1)) * 0.999 + 0.001; ptxt(stationName(), b.x, b.y, 1, C.yellow); ctx.globalAlpha = 1;
  } else {
    // a real button (Nadav, 2026-11-17): a solid pink key with a hard lower edge and a glow that blinks; it breathes
    // until the radio has been used once, then it only glows
    const blink = 0.5 + 0.5 * Math.sin(state.t * 6), br = G.radio ? 1 : 1 + 0.05 * Math.sin(state.t * 6);
    ctx.translate(b.x, b.y); ctx.scale(br, br); ctx.translate(-b.x, -b.y);
    rr(b.x - RADIO_W / 2, b.y - RADIO_H / 2 + 3, RADIO_W, RADIO_H, 9, '#7a1450');
    ctx.save(); ctx.shadowColor = `rgba(255,63,164,${0.35 + 0.55 * blink})`; ctx.shadowBlur = 8 + 12 * blink;
    rr(b.x - RADIO_W / 2, b.y - RADIO_H / 2, RADIO_W, RADIO_H, 9, C.pink, `rgba(255,255,255,${0.45 + 0.55 * blink})`, 2); ctx.restore();
    rr(b.x - RADIO_W / 2 + 4, b.y - RADIO_H / 2 + 3, RADIO_W - 8, 10, 5, 'rgba(255,255,255,.25)');
    txt('♪', b.x - 30, b.y + 1, 16, '#0e0e10', 'center', 900); ptxt(UI.radio, b.x + 8, b.y, 1, '#0e0e10');
  }
  ctx.restore();
}
function tick(dt: number): void { runTimers(dt); crashCd -= dt; noteCd -= dt; nagCd -= dt; radioTaps(); input.taps.length = 0; }
const hintFor = (): string => (D.usedKeys || !input.touch ? HINT.keys : D.look > 2 ? HINT.touchBehind : HINT.touch);

// ---------- leg 1: the commute ----------
registerStage('commute', {
  enter() {
    beat = null; walk = null; crashCd = 0; timers = [];
    resetWorld('home', 'office');
    D.goal = 'office';
    const a = PLACES.home, b = PLACES.office;
    addPickups(14, 'cash', Math.min(a.x, b.x) - 30, Math.min(a.y, b.y) - 30, Math.max(a.x, b.x) + 30, Math.max(a.y, b.y) + 30);
    addLetters('WA', a, b);
    commonEvents();
    ev.arrive = (id) => { if (id === 'office') arriveEnd('office', UI.beat.parking, 0, () => say(LINES.arriveOffice[0]!, 1.6, true)); };
    R.banner(BANNERS.commute[0], input.touch ? [...BANNERS.commute[1]] : [BANNERS.commute[1][0], HOW_KEYS, ...BANNERS.commute[1].slice(2)]);   // no stick with a mouse: the how-to line names the keys
  },
  step(dt) {
    tick(dt);
    if (stepBeat(dt) || stepWalk(dt)) { stepWorld(dt, { chasersOn: false }); return; }
    stepWorld(dt, { chasersOn: false });
    if (G.t > 6 && G.t % 11 < dt) say(pick(LINES.commute));
  },
  render() { renderWorld(['office']); renderBeat(); hud('office'); controlsIn(() => { renderStick(); renderMinimap(); renderRadio(); }); demoDrag(stickPos().x, stickPos().y); hint(hintFor()); },
  key: radioKey,
});

// ---------- leg 2: launch line (forced detour) ----------
let detourDone = false;
const detourId = (): PlaceId => (G.branch === 'quit' ? 'gas' : 'clinic');
registerStage('launch', {
  enter() {
    beat = null; walk = null; timers = []; detourDone = false; fuelWarned = false; noteCd = 0; nagCd = 0;
    if (!G.branch) G.branch = 'sick';
    resetWorld('office', 'store');
    D.look = 3;   // the day off is his: the picture steps up, the camera drops behind the car (Nadav, 2026-11-17)
    const a = PLACES.office, b = PLACES.store, dt = PLACES[detourId()];
    D.goal = detourId();
    addPickups(10, 'can', Math.min(a.x, b.x, dt.x) - 30, Math.min(a.y, b.y, dt.y) - 30, Math.max(a.x, b.x, dt.x) + 30, Math.max(a.y, b.y, dt.y) + 30);
    addLetters('ST', a, dt);
    commonEvents();
    if (G.branch === 'sick') {
      G.note = false;
      addHr({ x: dt.x - 100, y: dt.y + 60 });   // starts beyond the clinic, away from the way in, and roams toward you
      D.avoidHr = true;
      ev.spotted = () => {
        if (beat) return;
        if (!G.note) { fail('fired'); return; }
        if (noteCd <= 0) { noteCd = 5; say(pick(LINES.noteFlash), 2, true); }
      };
    } else {
      G.fuel = 0.8;   // you quit before filling up (0.62 until the gas station moved deep into the docks: 377 u away, was 105)
      ev.caught = () => fail('cop');
    }
    ev.arrive = (id) => {
      if (id === detourId() && !detourDone) {
        if (G.branch === 'sick') {
          say(LINES.doctor[0]!, 1.4, true);
          startBeat(UI.beat.bribing, 1.8, () => {
            say(LINES.doctor[1]!, 2.4, true); floatText(`-$${G.money}`, D.p.x, D.p.y - 24, C.red);
            G.money = 0; G.note = true; detourDone = true; D.goal = 'store'; D.avoidHr = false;
            later(2.6, () => say(LINES.noteOk, 2.2, true));
          });
        } else {
          startBeat(UI.beat.pumping, 1.6, () => {
            G.fuel = 1; detourDone = true; D.goal = 'store'; say(pick(LINES.gas), 2.2, true);
            later(0.9, () => { const sp = behind(85); addChaser('cop', sp.x, sp.y, 0.6, 0.8); G.stars = 1; say(LINES.sirens, 1.8, true); });
          });
        }
      } else if (id === 'store' && detourDone) {
        arriveEnd('store', UI.beat.parking, 0, () => { const cop = D.chasers.find((c) => c.kind === 'cop'); G.copPos = cop ? { x: cop.x, y: cop.y } : null; });
      }
    };
    const b2 = G.branch === 'sick' ? BANNERS.launchSick : BANNERS.launchQuit;
    R.banner(b2[0], [...b2[1]]);
  },
  step(dt) {
    tick(dt);
    if (stepBeat(dt) || stepWalk(dt)) { stepWorld(dt, { chasersOn: false }); return; }
    stepWorld(dt, { chasersOn: true });
    // driving past the store before the detour stop
    if (!detourDone && nagCd <= 0 && Math.hypot(PLACES.store.x - D.p.x, PLACES.store.y - D.p.y) < 15) { nagCd = 4; say(G.branch === 'sick' ? LINES.noteFirst : LINES.gasFirst, 2, true); }
    if (G.branch === 'sick') {
      const hr = nearHr();
      if (!G.note && hr && Math.hypot(hr.x - D.p.x, hr.y - D.p.y) < 45 && nagCd <= 0) { nagCd = 5; say(pick(LINES.hrClose), 1.8, true); }
      else if (G.t > 5 && G.t % 12 < dt) say(pick(LINES.hr));
    } else {
      G.fuel -= dt / 50;
      if (G.fuel < 0.3 && !fuelWarned) { fuelWarned = true; say(pick(LINES.fuelLow), 2, true); sfx.fuelLow?.(); }
      if (G.fuel > 0.3) fuelWarned = false;
      if (G.fuel <= 0) { G.fuel = 0; fail('fuel'); }
    }
  },
  render() {
    renderWorld(detourDone ? ['store'] : [detourId()]); renderBeat();
    hud(D.goal, { fuel: G.branch === 'quit' }); controlsIn(() => { renderStick(); renderMinimap(); renderRadio(); }); hint(hintFor());
  },
  key: radioKey,
});

// ---------- leg 3: the way home (chase) ----------
registerStage('home', {
  enter() {
    beat = null; walk = null; timers = [];
    if (!G.branch) G.branch = 'sick';
    if (!G.store) G.store = 'steal';
    resetWorld('store', 'home');
    D.dusk = 1;   // the day is gone by the time he has the game: the drive home is in the evening
    D.look = 4;   // he has the game: the last step up, sunset and neon
    D.goal = 'home';
    const a = PLACES.store, b = PLACES.home;
    addPickups(8, 'can', Math.min(a.x, b.x) - 30, Math.min(a.y, b.y) - 30, Math.max(a.x, b.x) + 30, Math.max(a.y, b.y) + 30);
    addLetters('ED', a, b);
    commonEvents();
    const kind: ChaserKind = G.store === 'loan' ? 'shark' : G.store === 'steal' ? 'cop' : 'spouse';
    G.stars = (G.store === 'steal' ? 1 : 0) + (G.branch === 'quit' ? 1 : 0);
    const sp = behind(125); addChaser(kind, sp.x, sp.y, 0.6, 3);
    if (G.branch === 'quit') { // the gas-theft cop resumes where it froze, but never right on your bumper
      const cp = G.copPos, c = cp && Math.hypot(cp.x - D.p.x, cp.y - D.p.y) > 100 ? cp : behind(160); addChaser('cop', c.x, c.y, 0.6, 3, 1);   // one car, not a second pack: three chasers at most
    }
    ev.caught = (k) => fail(k);
    ev.taunt = (k, x, y) => { if (k === 'spouse') floatText(pick(TAUNTS.spouse), x, y - 26, '#d9b3ff'); else if (k === 'shark') floatText(pick(TAUNTS.shark), x, y - 26, C.yellow); };
    ev.arrive = (id) => { if (id === 'home') arriveEnd('home', UI.beat.home, Math.max(0, 1000 - 10 * G.hits), () => { say(LINES.escape, 2, true); D.chasers = []; }); };
    const intro = G.branch === 'quit' && G.store === 'steal' ? pick(LINES.chase.cop2) : pick(LINES.chase[kind]);
    R.banner(BANNERS.home[0], [BANNERS.home[1][0], intro, ...BANNERS.home[1].slice(1)]);   // the mission line stays first (missionCard draws it as the headline)
  },
  step(dt) {
    tick(dt);
    if (stepBeat(dt) || stepWalk(dt)) { stepWorld(dt, { chasersOn: false }); return; }
    stepWorld(dt, { chasersOn: true });
  },
  render() { renderWorld(['home']); renderBeat(); hud('home'); controlsIn(() => { renderStick(); renderMinimap(); renderRadio(); }); hint(hintFor()); void txt; },
  key: radioKey,
});
