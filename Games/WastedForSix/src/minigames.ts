// Mini games before the conversations (Nadav, 2026-11-18: "simple mini games like in the flight game"). About ten
// seconds, never lost: they only add score and set the mood for the boss card that follows (buildup.ts). Each has its
// own screen, drawn as a small 3D set by the game's renderer (lazy/sets3d.ts, mini3d.ts): the same quality as the
// drives (Nadav, the same day: "you can't drop in quality during the game").
//   cough  — PATIENT ZERO, before the boss: walk the office aisle and cough ON your coworkers while the boss is looking
//   line   — before the clerk: run up the launch line outside the store in three lanes, dodging the campers
//   tiptoe — before the fiancée: tiptoe behind the couch to the PC, freeze when she turns around; she catches you anyway
// A shell runs each one: a title card (how to play), the game, a result card (verdict + score). Every game also ends
// by itself (a time limit), so a player who does nothing, and the bug check's bot, always get through.
import { R, W, view, ctx, state, input, keyName, keyHeld, rr, txt, rich, circ, wrap, clamp, rnd, pick, sfx, easeOB, pop, haptic, type Tap } from '@tsg/index';
import { addScore } from './play';
import { MINI } from './content';
import { C } from './art';
import { drawSet, setsReady, toScreen } from './mini3d';
import type { MiniPerson } from './world3d-api';
import { ptxt } from './pixel';
import { CAPTURE } from './capture';
import { drawGo, goPressed } from './button';

export type MiniName = 'cough' | 'line' | 'tiptoe';
interface Game {
  enter(): void;
  /** One step of play; taps for this frame. True when the game is over (the result card comes next). */
  step(dt: number, taps: Tap[]): boolean;
  render(): void;
  key?(e: KeyboardEvent): boolean;
  score(): number;
  verdict(): string;
  peek(): Record<string, unknown>;
}

// ---------- the shell ----------
const INTRO_TAP_S = 0.4;                  // the how-to card waits for its START button (Nadav, 2026-11-18); taps before this are ignored
let introGoY = 430;   // under the how-to card (it grows with its text); set where the card is drawn
const OUTRO_S = 1.8, OUTRO_TAP_S = 0.8;    // the result card: taps swallowed until OUTRO_TAP_S (RULES 13ג), auto after OUTRO_S
const M = { name: 'cough' as MiniName, phase: 'off' as 'off' | 'intro' | 'play' | 'outro', t: 0, sc: 0, then: (): void => {} };
const games: Record<MiniName, Game> = {} as Record<MiniName, Game>;

export function startMini(name: MiniName, then: () => void): void {
  Object.assign(M, { name, phase: 'intro', t: 0, sc: 0, then });
  games[name].enter();
}
export const miniOn = (): boolean => M.phase !== 'off';
/** Read-only state for the playthrough bot (play.ts __peek / __world). */
export const miniPeek = (): Record<string, unknown> | null => (M.phase === 'off' ? null : { name: M.name, phase: M.phase, t: +M.t.toFixed(1), ...games[M.name].peek() });
export function stepMini(dt: number): boolean {
  if (M.phase === 'off') return false;
  if (!setsReady()) { input.taps.length = 0; return true; }   // the renderer is still arriving (a slow phone, a debug start): wait
  M.t += dt;
  const taps = input.taps.splice(0), g = games[M.name];
  if (M.phase === 'intro') { if (M.t >= INTRO_TAP_S && goPressed(taps, introGoY)) { M.phase = 'play'; M.t = 0; sfx.ministart?.(); } }
  else if (M.phase === 'play') {
    if (g.step(dt, taps)) { M.phase = 'outro'; M.t = 0; M.sc = Math.max(0, Math.round(g.score())); addScore(M.sc); sfx.miniwin?.(); haptic([20, 30, 20]); }
  } else if (M.t >= OUTRO_S || (taps.length && M.t >= OUTRO_TAP_S)) { M.phase = 'off'; M.then(); }
  return true;
}
export function keyMini(e: KeyboardEvent): boolean {
  if (M.phase !== 'play') return false;
  return games[M.name].key?.(e) ?? false;
}
export function renderMini(): void {
  if (M.phase === 'off') return;
  games[M.name].render();
  const x0 = view.x0, y0 = -view.top, fw = view.fullW, fh = view.H;
  if (M.phase === 'intro') {
    // the how-to card: the goal first (yellow), then one instruction per line; the card grows with its text and the
    // START button sits under it (Nadav, 2026-11-18: the goal first, clear line breaks, all inside the box)
    const k = easeOB(clamp(M.t / 0.3, 0, 1)), m = MINI[M.name];
    const goal = wrap(m.goal, 16, 288, 900), how = (input.touch ? m.how : m.howKeys).split('\n').flatMap((l) => keyLines(l, 288));
    const HEAD = 78, h = HEAD + goal.length * 22 + 10 + how.length * 21 + 18, top = 300 - h / 2;
    ctx.fillStyle = `rgba(8,8,10,${0.72 * clamp(M.t / 0.15, 0, 1)})`; ctx.fillRect(x0, y0, fw, fh);
    ctx.save(); ctx.translate(W / 2, 300); ctx.scale(k, k); ctx.translate(-W / 2, -300);
    rr(W / 2 - 160, top, 320, h, 14, 'rgba(14,14,16,.95)', C.yellow, 2);
    rr(W / 2 - 62, top - 14, 124, 26, 4, C.yellow); ptxt('MINI GAME', W / 2, top - 1, 2, '#0e0e10');
    ptxt(m.place, W / 2, top + 30, 1, '#b4b4bc');
    ptxt(m.title, W / 2, top + 56, 2, '#ffffff', 'center', C.red);
    let y = top + HEAD + 8;
    for (const l of goal) { txt(l, W / 2, y, 16, C.yellow, 'center', 900); y += 22; }
    y += 10;
    for (const l of how) { rich(l, W / 2, y, 14, 800); y += 21; }   // the keys in yellow (keyLines)
    ctx.restore();
    introGoY = top + h + 48;
    drawGo(MINI.start, introGoY, M.t - 0.25);
  } else if (M.phase === 'outro') {
    const k = easeOB(clamp(M.t / 0.3, 0, 1)), out = clamp((OUTRO_S - M.t) / 0.25, 0, 1);
    ctx.fillStyle = `rgba(8,8,10,${0.6 * clamp(M.t / 0.2, 0, 1)})`; ctx.fillRect(x0, y0, fw, fh);
    ctx.save(); ctx.globalAlpha = out; ctx.translate(W / 2, 290); ctx.rotate(-0.04); ctx.scale(k, k);
    ptxt(MINI.bonus(M.sc), 0, -10, 6, M.sc > 0 ? C.yellow : '#b4b4bc', 'center', '#000');
    ctx.rotate(0.04);
    wrap(games[M.name].verdict(), 15, 300, 900).forEach((l, i) => txt(l, 0, 44 + i * 20, 15, '#ffffff', 'center', 900));
    ctx.restore();
  }
}


// ---------- how-to lines with the keys in yellow (Nadav, 2026-11-18) ----------
// In content.ts a key or a control is written in [brackets]: "[Space] to cough". A line is wrapped on its plain words,
// then each word keeps its colour (yellow inside brackets, white outside).
type Part = [string, string];
function keyLines(line: string, maxW: number): Part[][] {
  const words: Part[] = []; let on = false;
  for (const raw of line.split(' ')) {
    let w = raw;
    if (w.startsWith('[')) { on = true; w = w.slice(1); }
    const closes = w.includes(']'); w = w.replace(']', '');
    words.push([w, on ? C.yellow : '#ffffff']);
    if (closes) on = false;
  }
  const out: Part[][] = [];
  let i = 0;
  for (const l of wrap(words.map((q) => q[0]).join(' '), 14, maxW, 800)) {
    const n = l.split(' ').length;
    out.push(words.slice(i, i + n).map((q, k) => [q[0] + (k < n - 1 ? ' ' : ''), q[1]] as Part)); i += n;
  }
  return out;
}

/** A comic speech bubble with its tail pointing at (tx, ty). */
function bubble(s: string, x: number, y: number, size: number, bg: string, fg: string, tx: number, ty: number): void {
  if (CAPTURE.noText) return;
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(s).width + 20, h = size + 14;
  x = clamp(x, w / 2 + 6, W - w / 2 - 6);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(x - 8, y + h / 2 - 2); ctx.lineTo(tx, ty); ctx.lineTo(x + 8, y + h / 2 - 2); ctx.fill();
  rr(x - w / 2, y - h / 2, w, h, 9, bg, '#000', 2); txt(s, x, y + 1, size, fg, 'center', 900);
}
/** A bubble over someone on the set: (x, z) on its floor, at head height. */
function sayAt(s: string, x: number, z: number, size: number, bg: string, fg: string, up = 0): void {
  const p = toScreen(x, 2.9, z); bubble(s, p.x, p.y - 34 - up, size, bg, fg, p.x, p.y - 6);
}
/** A round touch key (drawn only on a touch screen, RULES 13־קלט): lit while held. */
function touchKey(x: number, y: number, r: number, label: string, held: boolean, col = 'rgba(255,255,255,.18)'): void {
  circ(x, y + 3, r, 'rgba(0,0,0,.35)'); circ(x, y + (held ? 2 : 0), r, held ? C.yellow : col, held ? '#0e0e10' : '#ffffff', 2);
  txt(label, x, y + (held ? 3 : 1), r > 40 ? 18 : 22, held ? '#0e0e10' : '#ffffff', 'center', 900);
}
/** A finger (any of them) on the circle (x, y, r)? Several thumbs at once (template input.pointers). */
const fingerOn = (x: number, y: number, r: number): boolean => { for (const p of input.pointers.values()) if (Math.hypot(p.x - x, p.y - y) < r) return true; return false; };

// ---------- cough: PATIENT ZERO ----------
// The office aisle (x along it, the desks behind at z −3.6, the boss pacing along the back wall at z −6.6). Walk to a
// coworker and cough on them: they recoil, yell, and put a mask on. It only counts if the boss SEES it: he paces with
// his back half turned, says "hm?" (13ח), then turns around and watches for a moment.
const PZ_X = 7, PZ_V = 5;                       // the aisle's half length, walking speed (u/s)
const PZ_DESKS = [-6, -2, 2, 6];                // coworkers' seats
const PZ_REACH = 2.2;                           // a cough reaches coworkers this close along the aisle (hitbox > drawing, 13י)
const PZ_CD = 0.55;                             // between coughs
const PZ_SEEN = 0.36, PZ_UNSEEN = 0.06;         // the meter per coworker coughed on, boss looking / not looking
const PZ_MAX_S = 16;                            // the boss sends you home anyway after this
const PZ_WALK_S: [number, number] = [1.8, 2.8], PZ_WARN_S = 0.6, PZ_LOOK_S = 1.8;
const PZ_LUNGS = 3, PZ_REFILL_S = 1.5;          // coughs in the lungs, seconds to get one back: spamming runs you dry
const SPLAT_S = 5;                              // a splat on the floor fades over this
interface Drop { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number }
/** One cough: a spray of droplets from his mouth toward the desks (visual only, so Math.random: never the game's stream). */
function spray(x: number): void {
  for (let i = 0; i < 28; i++) PZ.drops.push({ x: x + (Math.random() - 0.5) * 0.4, y: 2.15, z: 0.85, vx: (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 2.6, vz: -(2.5 + Math.random() * 3.5), r: 0.1 + Math.random() * 0.1 });   // big enough to read at this camera distance
}
/** Droplets fly, fall and land as splats on the floor. */
function stepDrops(dt: number): void {
  for (const d of PZ.drops) { d.vy -= 14 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; }
  for (const d of PZ.drops) if (d.y <= 0.03) PZ.splats.push({ x: d.x, z: d.z, r: d.r * 3.2, t: 0 });
  PZ.drops = PZ.drops.filter((d) => d.y > 0.03);
  for (const q of PZ.splats) q.t += dt;
  PZ.splats = PZ.splats.filter((q) => q.t < SPLAT_S).slice(-110);
}
const COUGH_KEY = { x: 296, y: 574, r: 44 }, LEFT_KEY = { x: 52, y: 584, r: 32 }, RIGHT_KEY = { x: 128, y: 584, r: 32 };
interface Worker { x: number; shirt: number; hitT: number; masked: boolean; line: string }
const PZ = { x: 0, step: 0, face: 1, coughT: -9, cd: 0, meter: 0, t: 0, end: -1, bx: 0, bdir: 1, bmode: 'walk' as 'walk' | 'warn' | 'look', bt: 2, workers: [] as Worker[], noteT: -9, note: '', hack: '', lungs: 3, drops: [] as Drop[], splats: [] as Array<{ x: number; z: number; r: number; t: number }> };
const pzHeld = (dir: -1 | 1): boolean => (dir < 0 ? keyHeld('ArrowLeft', 'a') || fingerOn(LEFT_KEY.x, LEFT_KEY.y, LEFT_KEY.r + 10) : keyHeld('ArrowRight', 'd') || fingerOn(RIGHT_KEY.x, RIGHT_KEY.y, RIGHT_KEY.r + 10));
games.cough = {
  enter() {
    const shirts = [0x4f7fd6, 0xff7a20, 0x5ce67a, 0x9b7fd1];
    Object.assign(PZ, { x: -5, step: 0, face: 1, coughT: -9, cd: 0, meter: 0, t: 0, end: -1, bx: 3, bdir: -1, bmode: 'walk', bt: rnd(PZ_WALK_S[0], PZ_WALK_S[1]), noteT: -9, note: '', lungs: PZ_LUNGS, drops: [], splats: [],
      workers: PZ_DESKS.map((x, i) => ({ x, shirt: shirts[i]!, hitT: -9, masked: false, line: '' })) });
  },
  key(e) { const k = keyName(e); return k === 'ArrowLeft' || k === 'a' || k === 'ArrowRight' || k === 'd'; },   // held keys are read in step; Space stays a tap (= cough)
  step(dt, taps) {
    PZ.t += dt; PZ.cd -= dt;
    stepDrops(dt);
    PZ.lungs = Math.min(PZ_LUNGS, PZ.lungs + dt / PZ_REFILL_S);
    if (PZ.end >= 0) { PZ.end += dt; return PZ.end > 1.5; }
    // the boss: paces, warns, turns around and watches
    PZ.bt -= dt;
    if (PZ.bmode === 'walk') { PZ.bx += PZ.bdir * 2.2 * dt; if (Math.abs(PZ.bx) > PZ_X) { PZ.bx = Math.sign(PZ.bx) * PZ_X; PZ.bdir *= -1; } }
    if (PZ.bt <= 0) {
      if (PZ.bmode === 'walk') { PZ.bmode = 'warn'; PZ.bt = PZ_WARN_S; }
      else if (PZ.bmode === 'warn') { PZ.bmode = 'look'; PZ.bt = PZ_LOOK_S; }
      else { PZ.bmode = 'walk'; PZ.bt = rnd(PZ_WALK_S[0], PZ_WALK_S[1]); if (rnd(0, 1) < 0.5) PZ.bdir *= -1; }
    }
    // you: walk along the aisle
    const dir = (pzHeld(1) ? 1 : 0) - (pzHeld(-1) ? 1 : 0);
    if (dir) { PZ.x = clamp(PZ.x + dir * PZ_V * dt, -PZ_X, PZ_X); PZ.step += dt * 9; PZ.face = dir; }
    // cough: Space, or the COUGH key on a touch screen
    const press = taps.some((p) => p.key || Math.hypot(p.x - COUGH_KEY.x, p.y - COUGH_KEY.y) < COUGH_KEY.r + 12);
    if (press && PZ.cd <= 0 && PZ.lungs < 1) { PZ.cd = 0.3; PZ.noteT = state.t; PZ.note = MINI.cough.breath; sfx.ahem?.(); haptic(8); }   // out of breath: no spamming (Nadav)
    else if (press && PZ.cd <= 0) {
      PZ.lungs -= 1; PZ.cd = PZ_CD; PZ.coughT = state.t; PZ.hack = pick(MINI.cough.hit); spray(PZ.x); sfx.cough?.(1); haptic(25);
      const hit = PZ.workers.filter((w) => !w.masked && Math.abs(w.x - PZ.x) < PZ_REACH);
      const seen = PZ.bmode === 'look';
      for (const w of hit) { w.hitT = state.t; w.masked = true; w.line = pick(MINI.cough.react); }
      if (hit.length) { PZ.meter = Math.min(1, PZ.meter + hit.length * (seen ? PZ_SEEN : PZ_UNSEEN)); PZ.noteT = state.t; PZ.note = seen ? pick(MINI.cough.seen) : MINI.cough.unseen; R.shake(seen ? 0.2 : 0.1); if (seen) sfx.letter?.(); }
      else { PZ.noteT = state.t; PZ.note = MINI.cough.nobody; }
    }
    // sent home, out of time, or nobody left to cough on
    if (PZ.meter >= 1 || PZ.t >= PZ_MAX_S || PZ.workers.every((w) => w.masked)) { PZ.end = 0; PZ.bmode = 'look'; PZ.note = PZ.meter >= 1 ? MINI.cough.home : MINI.cough.timeUp; PZ.noteT = state.t; sfx.ok?.(); }
    return false;
  },
  score: () => Math.round(PZ.meter * 600) + (PZ.meter >= 1 ? 200 : 0),
  verdict: () => MINI.cough.verdict(PZ.meter),
  // the bot: where the nearest coworker without a mask is (dx along the aisle), and whether the boss is looking
  peek: () => { const w = PZ.workers.filter((q) => !q.masked).sort((a, b) => Math.abs(a.x - PZ.x) - Math.abs(b.x - PZ.x))[0]; return { x: +PZ.x.toFixed(1), dx: w ? +(w.x - PZ.x).toFixed(1) : null, boss: PZ.bmode, meter: +PZ.meter.toFixed(2), cd: PZ.cd <= 0 && PZ.lungs >= 1 }; },
  render() {
    const camX = clamp(PZ.x, -3, 3), coughing = state.t - PZ.coughT < 0.35;
    const people: MiniPerson[] = PZ.workers.map((w, i) => {
      const age = state.t - w.hitT, recoil = age >= 0 && age < 1.2 ? Math.max(0, 0.5 * Math.sin(Math.min(1, age / 0.25) * Math.PI / 2) * (1 - Math.max(0, age - 0.6) / 0.6)) : 0;
      return { id: i + 1, role: 'worker', x: w.x, z: -2.2, ry: 0, step: 0, shirt: w.shirt, sit: true, lean: recoil, mask: w.masked };
    });
    const bossRy = PZ.bmode === 'look' ? 0 : PZ.bmode === 'warn' ? (PZ.bdir > 0 ? 1 : -1) * Math.PI / 2 * (PZ.bt / PZ_WARN_S) : (PZ.bdir > 0 ? Math.PI / 2 : -Math.PI / 2);
    people.push({ id: 9, role: 'boss', x: PZ.bx, z: -6.6, ry: bossRy, step: PZ.t * 6, walk: PZ.bmode === 'walk' ? 1 : 0, shirt: 0xf4f0e6 });
    const ok = drawSet({ set: 'office', cam: { x: camX, y: 11.5, z: 10, tx: camX, ty: 0.8, tz: -2.6, fov: 58 },   // high enough that you never hide them
      hero: { x: PZ.x, z: 1.2, ry: coughing ? 0 : PZ.face > 0 ? -Math.PI / 2 : Math.PI / 2, step: PZ.step, lean: coughing ? -0.35 : 0 },
      people, drops: PZ.drops.map((d) => ({ x: d.x, y: d.y, z: d.z, r: d.r })), splats: PZ.splats.map((q) => ({ x: q.x, z: q.z, r: q.r, o: clamp(1 - q.t / SPLAT_S, 0, 1) })) });
    if (!ok) return;
    // speech: coworkers just coughed on, the boss's state, the fan's cough
    for (const w of PZ.workers) { const age = state.t - w.hitT; if (age >= 0 && age < 1.4) sayAt(w.line, w.x, -2.2, 14, '#ffffff', C.red, -14); }
    if (coughing) sayAt(PZ.hack, PZ.x, 1.2, 17, '#ffffff', '#2f8f2f', 6);   // picked when coughing: render never draws random numbers
    if (PZ.bmode === 'warn') sayAt(MINI.cough.bossWarn, PZ.bx, -6.6, 15, '#ffffff', '#111', 10);
    if (PZ.end >= 0) sayAt(PZ.note, PZ.bx, -6.6, 15, '#ffffff', C.red, 10);
    // the meter, and a note on the last cough
    if (!CAPTURE.noText) {
    const ny = 66;   // clear of the boss's bubble
    rr(16, ny - 26, W - 32, 76, 10, 'rgba(14,14,16,.82)', PZ.bmode === 'look' ? C.yellow : 'rgba(255,255,255,.25)', 2);
    ptxt(MINI.cough.meter, 28, ny - 12, 1, '#b4b4bc', 'left');
    ptxt(PZ.bmode === 'look' ? MINI.cough.eyesOn : PZ.bmode === 'warn' ? MINI.cough.eyesSoon : MINI.cough.eyesOff, W - 28, ny - 12, 1, PZ.bmode === 'look' ? C.yellow : '#b4b4bc', 'right');
    rr(28, ny, W - 56, 14, 4, 'rgba(255,255,255,.12)'); rr(28, ny, (W - 56) * PZ.meter, 14, 4, '#3ddc84');
    // the lungs: three pips that empty with each cough and refill (the last one fills as a ring)
    ptxt(MINI.cough.lungs, 28, ny + 34, 1, '#b4b4bc', 'left');
    for (let i = 0; i < PZ_LUNGS; i++) { const f = clamp(PZ.lungs - i, 0, 1), cx = 96 + i * 22; circ(cx, ny + 34, 8, 'rgba(255,255,255,.12)', '#ffffff', 1.5); if (f >= 1) circ(cx, ny + 34, 6, '#3ddc84'); else if (f > 0) { ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, ny + 34, 5, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); } }
    }
    const na = state.t - PZ.noteT;
    if (na >= 0 && na < 1.4 && PZ.end < 0 && !CAPTURE.noText) { ctx.save(); ctx.globalAlpha = clamp((1.4 - na) / 0.3, 0, 1); const s = pop(na, 0.2, 0.25); ctx.translate(W / 2, 512); ctx.scale(s, s); txt(PZ.note, 0, 0, 16, PZ.note === MINI.cough.unseen || PZ.note === MINI.cough.nobody ? '#ffffff' : '#3ddc84', 'center', 900); ctx.restore(); }
    if (input.touch) {
      touchKey(LEFT_KEY.x, LEFT_KEY.y, LEFT_KEY.r, '◀', pzHeld(-1)); touchKey(RIGHT_KEY.x, RIGHT_KEY.y, RIGHT_KEY.r, '▶', pzHeld(1));
      touchKey(COUGH_KEY.x, COUGH_KEY.y, COUGH_KEY.r, MINI.cough.button, coughing, PZ.lungs >= 1 ? 'rgba(255,204,0,.35)' : 'rgba(120,120,120,.35)');
    } else if (!CAPTURE.noText) ptxt(MINI.cough.keys, W / 2, 600, 1, '#ffffff', 'center', '#000');
  },
};

// ---------- line: dodge the campers up three lanes, outside the store ----------
const LANE_X = [-2.4, 0, 2.4], LN_RUN = 95, LN_V = 6;   // u; the run takes ~16 s (60 u until Nadav asked for longer, 2026-11-18)
const ROW_GAP: [number, number] = [3.8, 4.8];            // u between rows (a row every ~0.7 s)
const HIT_DZ = 0.6;                                      // how close (u) a camper must be to bump you: smaller than the drawing (13י)
const STUMBLE_S = 0.45;
const SHIRTS = [0xd9534f, 0x5b8def, 0x3ddc84, 0xb06bd6, 0xf0a24a, 0xe6e6e6, 0xff6fa8];
interface Camper { z: number; lane: number; kind: 0 | 1 | 2; shirt: number; hit: boolean; id: number; passed?: boolean }
const LN = { lane: 1, x: 0, dist: 0, hits: 0, stumble: 0, step: 0, campers: [] as Camper[], floats: [] as Array<{ s: string; lane: number; z: number; t: number; small?: boolean }>, end: -1, pressT: -9, pressD: 0 };
const SHOUT_MAX = 2;   // passed campers yelling at once (bubbles stay behind him, low on the screen: the way ahead stays clear)
games.line = {
  enter() {
    Object.assign(LN, { lane: 1, x: 0, dist: 0, hits: 0, stumble: 0, step: 0, campers: [], floats: [], end: -1 });
    // rows of campers, each blocking one or two lanes (never all three); the first row well ahead (13ח)
    let id = 1;
    for (let z = 10; z < LN_RUN - 4; z += rnd(ROW_GAP[0], ROW_GAP[1])) {
      const free = Math.floor(rnd(0, 3)), two = rnd(0, 1) < 0.55;
      for (let l = 0; l < 3; l++) if (l !== free && (two || l === (free + 1 + Math.floor(rnd(0, 2))) % 3)) LN.campers.push({ z, lane: l, kind: (rnd(0, 1) < 0.5 ? 0 : 2) as 0 | 1 | 2,   // people only, sitting (0) or standing (2): no tents (Nadav, 2026-11-18)
         shirt: pick(SHIRTS), hit: false, id: id++ });
    }
  },
  key(e) {
    const k = keyName(e);
    if (k === 'ArrowLeft' || k === 'a') { move(-1); return true; }
    if (k === 'ArrowRight' || k === 'd') { move(1); return true; }
    return false;
  },
  step(dt, taps) {
    for (const p of taps) if (!p.key) move(p.x < W / 2 ? -1 : 1);
    LN.x += (LANE_X[LN.lane]! - LN.x) * (1 - Math.pow(0.0005, dt));
    for (const f of LN.floats) f.t += dt; LN.floats = LN.floats.filter((f) => f.t < (f.small ? 1.6 : 0.9));
    if (LN.end >= 0) { LN.end += dt; return LN.end > 0.9; }
    LN.stumble = Math.max(0, LN.stumble - dt);
    const v = LN_V * (LN.stumble > 0 ? 0.4 : 1);
    LN.dist += v * dt; LN.step += v * dt * 1.6;
    for (const c of LN.campers) {
      if (!c.hit && c.lane === LN.lane && Math.abs(c.z - LN.dist) < HIT_DZ && Math.abs(LN.x - LANE_X[c.lane]!) < 0.9) {
        c.hit = true; LN.hits++; LN.stumble = STUMBLE_S;
        LN.floats.push({ s: pick(MINI.line.bump), lane: c.lane, z: c.z, t: 0 });
        sfx.bump?.(1); R.shake(0.2); haptic(40);
      }
    }
    // the people you cut past yell after you (Nadav, 2026-11-18): only some, at most SHOUT_MAX at a time. Flavour only,
    // so Math.random: it must not change the game's own random stream
    for (const c of LN.campers) {
      if (c.passed || c.hit || c.z > LN.dist - 0.8) continue;
      c.passed = true;
      if (c.kind !== 1 && Math.random() < 0.6 && LN.floats.filter((f) => f.small).length < SHOUT_MAX) LN.floats.push({ s: MINI.line.passed[Math.floor(Math.random() * MINI.line.passed.length)]!, lane: c.lane, z: c.z, t: 0, small: true });
    }
    if (LN.dist >= LN_RUN) { LN.end = 0; sfx.item?.(); }
    return false;
  },
  score: () => Math.max(0, 600 - 150 * LN.hits),
  verdict: () => MINI.line.verdict(LN.hits),
  // the bot: your lane and the lanes blocked in the next row ahead (dy in the old 40-px-per-unit scale it reads)
  peek: () => { const ahead = LN.campers.filter((c) => !c.hit && c.z - LN.dist > -0.25).sort((a, b) => a.z - b.z); const nz = ahead[0]?.z; return { lane: LN.lane, blocked: ahead.filter((c) => c.z === nz).map((c) => c.lane), dy: nz === undefined ? null : Math.round((nz - LN.dist) * 40) }; },
  render() {
    const hz = -LN.dist, sq = LN.stumble > 0;
    const people: MiniPerson[] = LN.campers.filter((c) => c.z - LN.dist > -8 && c.z - LN.dist < 34).map((c) => (
      c.kind === 1 ? { id: c.id, role: 'tent', x: LANE_X[c.lane]!, z: -c.z, ry: 0, step: 0, shirt: c.shirt }
        : { id: c.id, role: 'camper', x: LANE_X[c.lane]!, z: -c.z, ry: c.kind === 0 ? 0.4 : 0, step: 0, shirt: c.shirt, sit: c.kind === 0, lean: c.hit ? 0.35 : 0 }));
    const ok = drawSet({ set: 'line', cam: { x: LN.x * 0.45, y: 9.5, z: hz + 8.5, tx: LN.x * 0.3, ty: 0.4, tz: hz - 7, fov: 62 },   // higher, looking further down (Nadav, 2026-11-18)
      hero: { x: LN.x, z: hz, ry: (LN.x - LANE_X[LN.lane]!) * 0.25, step: LN.step, lean: sq ? 0.3 : -0.08 }, people, drops: [], splats: [] });
    if (!ok) return;
    for (const f of LN.floats) {
      const life = f.small ? 1.6 : 0.9; ctx.globalAlpha = clamp((life - f.t) / 0.4, 0, 1) * clamp(f.t / 0.12, 0, 1);
      if (!f.small) { sayAt(f.s, LANE_X[f.lane]!, -f.z, 13, '#ffffff', C.red, f.t * 30); continue; }
      // a camper you passed yells after you: pinned to the screen edge on their side, low (behind him), never over the way ahead
      const left = f.lane === 0 || (f.lane === 1 && f.s.length % 2 === 0), y = 400 + (f.s.length % 3) * 30 - f.t * 12, s2 = pop(f.t, 0.18, 0.3);
      const bx = left ? 100 : W - 100; bubble(f.s, bx, y - (s2 - 1) * 20, 12, '#ffffff', '#111', bx + (left ? -40 : 40), y + 26);
    }
    ctx.globalAlpha = 1;
    // progress to the door
    const k = clamp(LN.dist / LN_RUN, 0, 1);
    if (!CAPTURE.noText) rr(40, 76, W - 80, 10, 5, 'rgba(14,14,16,.6)'), rr(40, 76, (W - 80) * k, 10, 5, C.yellow), ptxt(MINI.line.counter, W - 40, 64, 1, '#ffffff', 'right', '#000');
    // big lane keys in the driving controls' glass look; each lights up for a moment when it moves you
    if (input.touch && LN.end < 0) for (const d of [-1, 1] as const) {
      const x = d < 0 ? 70 : W - 70, y = 572, lit = state.t - LN.pressT < 0.18 && LN.pressD === d;
      circ(x, y, 46, lit ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.12)', lit ? '#ffffff' : 'rgba(255,255,255,.7)', 1.5);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x + d * -6, y - 14); ctx.lineTo(x + d * 8, y); ctx.lineTo(x + d * -6, y + 14); ctx.stroke();
    }
  },
};
function move(d: number): void {
  if (LN.end >= 0) return;
  const to = clamp(LN.lane + d, 0, 2);
  if (to === LN.lane) { LN.pressT = state.t; LN.pressD = d; haptic(4); return; }   // already at the edge: only a buzz
  LN.lane = to; LN.pressT = state.t; LN.pressD = d; sfx.dodge?.(); haptic(8);
}

// ---------- tiptoe: behind the couch to the PC ----------
// She sits with her back to you watching TV. Hold to tiptoe along behind the couch; she says "hm?" and turns around:
// moving while she looks = caught, back you go. At the PC (or after TIP_MAX_S) she turns and catches you anyway, and
// the conversation starts.
const TIP_X0 = -4.6, TIP_GOAL = 4.6, TIP_V = 1.25;   // u; ~7.4 s of holding
const TIP_MAX_S = 16;
const WARN_S = 0.75, LOOK_S = [1.0, 1.5], CALM_S = [1.4, 2.6];
const LOOK_GRACE_S = 0.12;                       // still moving this long into her look is forgiven (13יא)
const CAUGHT_BACK = 1.8;                         // u you lose when she catches you moving
const TP = { x: TIP_X0, mode: 'calm' as 'calm' | 'warn' | 'look', mt: 1.8, lookS: 0, turn: 0, caught: 0, caughtAt: -9, line: '', stepT: 0, step: 0, t: 0, end: -1, moving: false };
const holding = (): boolean => input.down || keyHeld(' ', 'ArrowRight', 'd', 'ArrowUp', 'w');
games.tiptoe = {
  enter() { Object.assign(TP, { x: TIP_X0, mode: 'calm', mt: rnd(1.6, 2.4), lookS: 0, turn: 0, caught: 0, caughtAt: -9, line: '', stepT: 0, step: 0, t: 0, end: -1, moving: false }); },
  key(e) { const k = keyName(e); return k === 'ArrowRight' || k === 'd'; },   // held keys are read in step; Space stays a tap for the shell
  step(dt) {
    TP.t += dt;
    const want = TP.mode === 'look' ? 1 : TP.mode === 'warn' ? 0.25 : 0;
    TP.turn += (want - TP.turn) * (1 - Math.pow(0.0005, dt));
    if (TP.end >= 0) { TP.end += dt; return TP.end > 1.8; }
    // her cycle: calm → "hm?" (she starts to turn) → looking → calm
    TP.mt -= dt;
    const lookAge = TP.mode === 'look' ? TP.lookS - TP.mt : 0;   // seconds she has been looking
    if (TP.mt <= 0) {
      if (TP.mode === 'calm') { TP.mode = 'warn'; TP.mt = WARN_S; sfx.tick?.(); }
      else if (TP.mode === 'warn') { TP.mode = 'look'; TP.mt = rnd(LOOK_S[0]!, LOOK_S[1]!); TP.lookS = TP.mt; }
      else { TP.mode = 'calm'; TP.mt = rnd(CALM_S[0]!, CALM_S[1]!); }
    }
    TP.moving = holding() && state.t - TP.caughtAt > 0.6;
    if (TP.moving) {
      TP.x += TIP_V * dt; TP.step += dt * 5; TP.stepT -= dt; if (TP.stepT <= 0) { TP.stepT = 0.32; sfx.tip?.(); }
      if (TP.mode === 'look' && lookAge > LOOK_GRACE_S) {
        TP.caught++; TP.caughtAt = state.t; TP.line = pick(MINI.tiptoe.caught); TP.x = Math.max(TIP_X0, TP.x - CAUGHT_BACK);
        sfx.creak?.(); R.shake(0.3); R.flash(0.2); haptic([60, 40, 60]);
        TP.mt = Math.max(TP.mt, 0.6);
      }
    }
    if (TP.x >= TIP_GOAL || TP.t >= TIP_MAX_S) { TP.x = Math.min(TP.x, TIP_GOAL); TP.end = 0; TP.mode = 'look'; TP.line = MINI.tiptoe.end; sfx.creak?.(); R.shake(0.2); }
    return false;
  },
  score: () => Math.max(0, Math.round(400 * ((TP.x - TIP_X0) / (TIP_GOAL - TIP_X0))) + (TP.x >= TIP_GOAL && TP.caught === 0 ? 200 : 0) - 100 * TP.caught),
  verdict: () => MINI.tiptoe.verdict(TP.caught),
  peek: () => ({ x: +TP.x.toFixed(1), mode: TP.mode, mt: +TP.mt.toFixed(2), caught: TP.caught }),
  render() {
    const camX = clamp(TP.x * 0.6, -2.2, 2.2), fresh = state.t - TP.caughtAt < 0.6;   // he and she both stay in the frame
    const ok = drawSet({ set: 'room', cam: { x: camX, y: 10, z: 13, tx: camX, ty: 0.6, tz: -1.6, fov: 60 },   // high: she stays in sight over his head
      hero: { x: TP.x, z: 2.8, ry: fresh || TP.end >= 0 ? -Math.PI : -Math.PI / 2, step: TP.step, crouch: TP.end >= 0 ? 0 : 0.35 },
      people: [{ id: 1, role: 'fiancee', x: 0, z: -1.6, ry: Math.PI - TP.turn * (Math.PI - 0.5), step: 0, shirt: 0x9b4dff, sit: true }], drops: [], splats: [] });
    if (!ok) return;
    if (TP.mode === 'warn' && TP.end < 0) sayAt(MINI.tiptoe.warn, 0, -1.6, 15, '#ffffff', '#111', -10);
    else if (TP.mode === 'look' && TP.end < 0 && !fresh) sayAt(MINI.tiptoe.eyes, 0, -1.6, 18, C.yellow, '#0e0e10', -10);
    if (fresh || TP.end >= 0) sayAt(TP.line, 0, -1.6, TP.end >= 0 ? 15 : 20, TP.end >= 0 ? '#ffffff' : C.red, TP.end >= 0 ? '#111' : '#ffffff', -10);
    // progress along the floor: door → PC
    const k = (TP.x - TIP_X0) / (TIP_GOAL - TIP_X0);
    rr(46, 610, 240, 6, 3, 'rgba(255,255,255,.15)'); rr(46, 610, 240 * k, 6, 3, C.yellow); circ(286, 613, 6, C.yellow);
    const look = TP.mode === 'look';
    if (TP.end < 0 && !CAPTURE.noText) ptxt(look ? 'FREEZE!' : holding() ? 'SHH...' : input.touch ? 'HOLD TO TIPTOE' : 'HOLD SPACE', W / 2, 586, 2, look ? '#ff3b3b' : '#ffffff', 'center', '#000');
  },
};
