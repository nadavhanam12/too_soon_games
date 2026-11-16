// The top-down driving world shared by the three legs: player car + virtual stick, traffic, the HR minivan, chasers,
// pickups, graffiti letters, place markers, camera and rendering. play.ts owns the story (which leg, what counts as
// a fail) and listens to the events in `ev`.
import { W, SAFE_H, view, ctx, input, keyHeld, keyLeft, keyRight, clamp, rr, txt, sfx } from '@tsg/index';
import { SIZE, T, PER, collide, nodeC, nodeOf, nextNode, neighbors, edgeOpen, NN, PLACES, mapCanvas, solidAt, type PlaceId } from './map';
import { C, NPC_COLORS, drawCar } from './art';
import { ptxt } from './pixel';

export const MAX_V = 175;          // player top speed, px/s
const STICK_R = 46;
// steering (option B, 2026-11-17): faster turns, auto-slow in turns, wall sliding, axis + lane assist
const TURN_STICK = 6.0;          // rad/s at speed (was 3.8)
const TURN_KEYS = 4.2;           // rad/s with ← → (was 3.1)
const TURN_SLOW_KEYS = 0.6;      // top speed while holding ← / → with ↑
const STICK_SNAP = 0.55;         // stick directions within ~31° of a road axis snap to it
const CRASH_V = 110, CRASH_DOT = 0.85;   // only a near head-on hit at speed is a crash (was 95 / 0.55)
const ASSIST_SNAP = 0.6;         // heading within ~34° of a road axis straightens itself
const LANE = 14;                 // right-hand lane offset from the road centre line
const CAR_R = 9;
const CATCH_D = 22;
export const HR_R = 84;            // HR minivan's "sees you" radius

export interface Car { x: number; y: number; a: number; v: number }
type Node2 = [number, number];
interface Npc extends Car { from: Node2; to: Node2; s: number; spd: number; color: string; nm: number; hr: boolean }
export type ChaserKind = 'cop' | 'shark' | 'spouse';
export interface Chaser extends Car { kind: ChaserKind; max: number; goal: Node2 | null; grace: number; wait: number; chk: number; cx: number; cy: number; rev: number; taunt: number }
interface Pickup { x: number; y: number; kind: 'cash' | 'can'; taken: boolean }
interface Letter { x: number; y: number; ch: string; taken: boolean }
interface Float { x: number; y: number; s: string; t: number; col: string }

export const D = {
  p: { x: 0, y: 0, a: 0, v: 0 } as Car,
  cam: { x: 0, y: 0 },
  npcs: [] as Npc[],
  hr: null as Npc | null,
  chasers: [] as Chaser[],
  picks: [] as Pickup[],
  letters: [] as Letter[],
  floats: [] as Float[],
  stick: { on: false, ax: 0, ay: 0, dx: 0, dy: 0 },
  goal: null as PlaceId | null,     // where the GPS arrow points (detour first)
  heat: 0,
  t: 0,
  sirenT: 0,
  usedKeys: false,
  control: true,                    // false during a parked beat: the car brakes, no steering
};

/** Events for play.ts. */
export const ev = {
  pickup: (_k: 'cash' | 'can', _x: number, _y: number): void => {},
  letter: (_ch: string): void => {},
  crash: (): void => {},
  near: (_x: number, _y: number): void => {},
  caught: (_k: ChaserKind): void => {},
  spotted: (): void => {},
  arrive: (_id: PlaceId): void => {},
  taunt: (_k: ChaserKind, _x: number, _y: number): void => {},
};

let seed = 1;
const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const wrapA = (a: number): number => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Line of sight between two points (no building in between). */
export function los(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const d = dist(a, b), n = Math.ceil(d / 14);
  for (let i = 1; i < n; i++) if (solidAt(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n)) return false;
  return true;
}

/** Nearest point on an open road centre line. */
export function roadNear(x: number, y: number): { x: number; y: number } {
  const [i, j] = nodeOf(x, y), nx = nodeC(i), ny = nodeC(j);
  const hz = Math.abs(x - nx) > Math.abs(y - ny);
  if (hz) { const b: Node2 = [x > nx ? i + 1 : i - 1, j]; if (edgeOpen([i, j], b)) return { x: clamp(x, Math.min(nx, nodeC(b[0])), Math.max(nx, nodeC(b[0]))), y: ny }; }
  else { const b: Node2 = [i, y > ny ? j + 1 : j - 1]; if (edgeOpen([i, j], b)) return { x: nx, y: clamp(y, Math.min(ny, nodeC(b[1])), Math.max(ny, nodeC(b[1]))) }; }
  return { x: nx, y: ny };
}

// ---------- setup ----------
export function resetWorld(startId: PlaceId, toward: PlaceId, s: number): void {
  seed = s;
  const st = PLACES[startId], to = PLACES[toward];
  const horiz = st.side === 'N' || st.side === 'S';
  const a = horiz ? (to.x >= st.x ? 0 : Math.PI) : (to.y >= st.y ? Math.PI / 2 : -Math.PI / 2);
  // start in the right-hand lane of the road outside the building
  D.p = { x: st.x - Math.sin(a) * 14, y: st.y + Math.cos(a) * 14, a, v: 0 }; // right-hand lane: (−sin a, cos a) · 14
  D.cam = { x: D.p.x, y: D.p.y };
  D.npcs = []; D.chasers = []; D.hr = null; D.picks = []; D.letters = []; D.floats = [];
  D.stick.on = false; D.heat = 0; D.t = 0; D.control = true;
  for (let k = 0; k < 26; k++) {
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(rnd() * NN), j = Math.floor(rnd() * NN), nb = neighbors(i, j); if (!nb.length) continue;
      const to2 = nb[Math.floor(rnd() * nb.length)]!;
      if (Math.hypot(nodeC(i) - D.p.x, nodeC(j) - D.p.y) < 260) continue;
      const n: Npc = { x: nodeC(i), y: nodeC(j), a: 0, v: 0, from: [i, j], to: to2, s: rnd() * 150, spd: 70 + rnd() * 35, color: NPC_COLORS[k % NPC_COLORS.length]!, nm: 0, hr: false };
      placeNpc(n, 1); D.npcs.push(n); break;
    }
  }
}

export function addPickups(n: number, kind: 'cash' | 'can', x0: number, y0: number, x1: number, y1: number): void {
  for (let k = 0, tries = 0; k < n && tries < 4000; k++, tries++) {
    const i = Math.floor(rnd() * NN), j = Math.floor(rnd() * NN), hz = rnd() < 0.5;
    const b: Node2 = hz ? [i + 1, j] : [i, j + 1];
    if (!edgeOpen([i, j], b)) { k--; continue; }
    const f = 0.3 + rnd() * 0.4, lane = rnd() < 0.5 ? -14 : 14;
    const x = hz ? nodeC(i) + f * 224 : nodeC(i) + lane, y = hz ? nodeC(j) + lane : nodeC(j) + f * 224;
    if (x < x0 || x > x1 || y < y0 || y > y1) { if (rnd() < 0.97) { k--; continue; } }
    D.picks.push({ x, y, kind, taken: false });
  }
}

/** Two graffiti letters painted on the road at ~1/3 and ~2/3 of the way between two points. */
export function addLetters(chs: string, a: { x: number; y: number }, b: { x: number; y: number }): void {
  [...chs].forEach((ch, i) => {
    const f = (i + 1) / (chs.length + 1);
    const p = roadNear(a.x + (b.x - a.x) * f + (i ? 90 : -90), a.y + (b.y - a.y) * f);
    D.letters.push({ x: p.x, y: p.y, ch, taken: false });
  });
}

export function addHr(near: { x: number; y: number }): void {
  const [i, j] = nodeOf(near.x, near.y), nb = neighbors(i, j);
  const n: Npc = { x: nodeC(i), y: nodeC(j), a: 0, v: 0, from: [i, j], to: nb[0] ?? [i, j], s: 0, spd: 92, color: '#d8cfb4', nm: 0, hr: true };
  placeNpc(n, 1); D.hr = n;
}

/** `wait` = seconds the chaser sits still before the chase starts (reaction time after the banner). */
export function addChaser(kind: ChaserKind, x: number, y: number, grace = 1.2, wait = 0): void {
  const max = kind === 'shark' ? 166 : kind === 'cop' ? 158 : 150;
  const p = roadNear(x, y);
  D.chasers.push({ x: p.x, y: p.y, a: Math.atan2(D.p.y - p.y, D.p.x - p.x), v: 0, kind, max, goal: null, grace: grace + wait, wait, chk: 0, cx: p.x, cy: p.y, rev: 0, taunt: 2 });
}

/** A spawn point behind the player, ~d px away along roads, out of sight if possible. */
export function behind(d: number): { x: number; y: number } {
  const bx = D.p.x - Math.cos(D.p.a) * d, by = D.p.y - Math.sin(D.p.a) * d;
  return roadNear(clamp(bx, 40, SIZE - 40), clamp(by, 40, SIZE - 40));
}

// ---------- update ----------
export function stepWorld(dt: number, opts: { chasersOn: boolean }): void {
  D.t += dt;
  stepPlayer(dt);
  for (const n of D.npcs) stepNpc(n, dt);
  if (D.hr) {
    stepNpc(D.hr, dt);
    if (dist(D.hr, D.p) < HR_R && los(D.hr, D.p)) ev.spotted();
  }
  if (opts.chasersOn) for (const c of D.chasers) stepChaser(c, dt);
  // pickups + letters
  for (const k of D.picks) if (!k.taken && dist(k, D.p) < 22) { k.taken = true; ev.pickup(k.kind, k.x, k.y); }
  for (const l of D.letters) if (!l.taken && dist(l, D.p) < 30) { l.taken = true; ev.letter(l.ch); }
  if (D.goal && dist(PLACES[D.goal], D.p) < 36) ev.arrive(D.goal);
  // heat
  let h = 0;
  for (const c of D.chasers) h = Math.max(h, clamp(1 - (dist(c, D.p) - 30) / 420, 0, 1));
  if (D.hr) h = Math.max(h, 0.85 * clamp(1 - (dist(D.hr, D.p) - HR_R) / 300, 0, 1));
  D.heat += (h - D.heat) * Math.min(1, dt * 4);
  if (opts.chasersOn && D.chasers.some((c) => c.kind === 'cop') && D.heat > 0.25) { D.sirenT -= dt; if (D.sirenT <= 0) { D.sirenT = 0.42; sfx.siren?.(); } }
  for (const f of D.floats) f.t += dt;
  D.floats = D.floats.filter((f) => f.t < 1.2);
  // camera with a little look-ahead
  const lx = D.p.x + Math.cos(D.p.a) * D.p.v * 0.35, ly = D.p.y + Math.sin(D.p.a) * D.p.v * 0.35;
  D.cam.x += (lx - D.cam.x) * Math.min(1, dt * 4); D.cam.y += (ly - D.cam.y) * Math.min(1, dt * 4);
}

/** Snap an angle to the nearest road axis (0, ±90°, 180°) when it is within `tol` radians of it. */
function snapAxis(a: number, tol: number): number {
  const ax = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  return Math.abs(wrapA(a - ax)) < tol ? ax : a;
}

/** Steering assist when the player isn't turning: straighten to the road axis and drift into the right-hand lane. */
function assist(p: Car, dt: number): void {
  if (Math.abs(p.v) < 20) return;
  const ax = Math.round(p.a / (Math.PI / 2)) * (Math.PI / 2), off = wrapA(p.a - ax);
  if (Math.abs(off) > ASSIST_SNAP) return;
  p.a -= off * Math.min(1, dt * 6);
  const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
  const inX = tx % PER < 2, inY = ty % PER < 2;
  const horiz = Math.abs(Math.cos(ax)) > 0.5;
  // lane keeping only on a straight segment (not inside an intersection)
  if (horiz && inY && !inX) { const c = nodeC(nodeOf(p.x, p.y)[1]) + Math.cos(ax) * LANE * Math.sign(p.v); p.y += (c - p.y) * Math.min(1, dt * 2.5); }
  if (!horiz && inX && !inY) { const c = nodeC(nodeOf(p.x, p.y)[0]) - Math.sin(ax) * LANE * Math.sign(p.v); p.x += (c - p.x) * Math.min(1, dt * 2.5); }
}

function stepPlayer(dt: number): void {
  const p = D.p, s = D.stick;
  if (input.down && D.control) {
    if (!s.on) { s.on = true; s.ax = input.px; s.ay = input.py; }
    s.dx = input.px - s.ax; s.dy = input.py - s.ay;
    const L = Math.hypot(s.dx, s.dy);
    if (L > STICK_R) { s.ax = input.px - (s.dx / L) * STICK_R; s.ay = input.py - (s.dy / L) * STICK_R; s.dx = input.px - s.ax; s.dy = input.py - s.ay; }
  } else s.on = false;
  const up = keyHeld('ArrowUp', 'w', 'W'), dn = keyHeld('ArrowDown', 's', 'S'), lf = keyLeft(), rt = keyRight();
  const turnK = 0.55 + 0.45 * Math.min(1, Math.abs(p.v) / 60);
  let steering = false;                       // the player is asking for a real turn (assist stays off)
  if (!D.control) {
    p.v -= Math.sign(p.v) * Math.min(Math.abs(p.v), 420 * dt);
  } else if (up || dn || lf || rt) {
    D.usedKeys = true;
    steering = lf || rt;
    if (lf) p.a -= TURN_KEYS * turnK * dt * (p.v < 0 ? -1 : 1);
    if (rt) p.a += TURN_KEYS * turnK * dt * (p.v < 0 ? -1 : 1);
    if (up) p.v = Math.min(MAX_V * (steering ? TURN_SLOW_KEYS : 1), p.v + 260 * dt);
    else if (dn) p.v = p.v > 0 ? Math.max(0, p.v - 420 * dt) : Math.max(-70, p.v - 160 * dt);
    else p.v -= Math.sign(p.v) * Math.min(Math.abs(p.v), 120 * dt);
    if (up && steering && p.v > MAX_V * TURN_SLOW_KEYS) p.v -= 300 * dt;
  } else if (s.on && Math.hypot(s.dx, s.dy) > 8) {
    const mag = clamp((Math.hypot(s.dx, s.dy) - 6) / (STICK_R - 10), 0, 1);
    const want = snapAxis(Math.atan2(s.dy, s.dx), STICK_SNAP);   // "up-ish" = exactly up: roads only run on 4 axes
    const diff = wrapA(want - p.a);
    steering = Math.abs(diff) > 0.12;
    p.a += clamp(diff, -TURN_STICK * turnK * dt, TURN_STICK * turnK * dt);
    // auto-slow in a turn: full speed straight, ~45% at 90°, crawl when turning around
    const tv = MAX_V * mag * (Math.abs(diff) < 1.75 ? 0.45 + 0.55 * Math.max(0, Math.cos(diff)) : 0.3);
    p.v += clamp(tv - p.v, -560 * dt, 260 * dt);
  } else {
    p.v -= Math.sign(p.v) * Math.min(Math.abs(p.v), 340 * dt);   // let go = brake
  }
  if (D.control && !steering) assist(p, dt);
  p.a = wrapA(p.a);
  p.x += Math.cos(p.a) * p.v * dt; p.y += Math.sin(p.a) * p.v * dt;
  const n = collide(p, CAR_R);
  if (n.nx || n.ny) {
    const dot = -(Math.cos(p.a) * n.nx + Math.sin(p.a) * n.ny) * Math.sign(p.v || 1);
    if (Math.abs(p.v) > CRASH_V && dot > CRASH_DOT) { ev.crash(); p.v *= 0.3; }
    else {
      // slide along the wall: turn the nose toward the wall's tangent, lose a little speed
      let tx = -n.ny, ty = n.nx; if (tx * Math.cos(p.a) + ty * Math.sin(p.a) < 0) { tx = -tx; ty = -ty; }
      if (p.v > 0) p.a += wrapA(Math.atan2(ty, tx) - p.a) * Math.min(1, dt * 10);
      p.v *= 1 - clamp(dot, 0, 1) * Math.min(1, dt * 5);
    }
  }
  // traffic bumps + near misses
  for (const c of D.npcs) {
    const d = dist(c, p);
    if (d < 19) {
      const ux = (p.x - c.x) / (d || 1), uy = (p.y - c.y) / (d || 1);
      p.x += ux * (19 - d); p.y += uy * (19 - d);
      if (Math.abs(p.v) > 80) ev.crash();
      p.v *= 0.35; c.s = Math.max(0, c.s - 4);
    } else if (d < 31 && Math.abs(p.v) > 115 && c.nm <= 0) { c.nm = 3; ev.near(c.x, c.y); }
    c.nm -= dt;
  }
}

function edgeDir(n: Npc): { dx: number; dy: number } { return { dx: Math.sign(n.to[0] - n.from[0]), dy: Math.sign(n.to[1] - n.from[1]) }; }
function placeNpc(n: Npc, k: number): void {
  const { dx, dy } = edgeDir(n);
  const qx = nodeC(n.from[0]) + dx * n.s - dy * 14, qy = nodeC(n.from[1]) + dy * n.s + dx * 14; // right-hand lane
  n.x += (qx - n.x) * k; n.y += (qy - n.y) * k;
  const want = Math.atan2(dy, dx); n.a += wrapA(want - n.a) * Math.min(1, k * 1.0 + 0.0001);
}
function stepNpc(n: Npc, dt: number): void {
  const { dx, dy } = edgeDir(n);
  let spd = n.spd;
  // don't plough into the player or the car ahead
  const ahead = (o: { x: number; y: number }, r: number) => { const ox = o.x - n.x, oy = o.y - n.y; const along = ox * dx + oy * dy, side = Math.abs(-ox * dy + oy * dx); return along > 0 && along < r && side < 16; };
  if (!n.hr && ahead(D.p, 40)) spd = 0;
  else for (const o of D.npcs) if (o !== n && ahead(o, 36)) { spd = Math.min(spd, o.spd * 0.8); break; }
  n.v = spd;
  n.s += spd * dt;
  if (n.s >= 224) {
    n.s -= 224; const prev = n.from; n.from = n.to;
    let opts = neighbors(n.from[0], n.from[1]).filter((b) => !(b[0] === prev[0] && b[1] === prev[1]));
    if (!opts.length) opts = [prev];
    if (n.hr && Math.random() < 0.55) { const goal = nextNode(n.from, nodeOf(D.p.x, D.p.y)); if (opts.some((o) => o[0] === goal[0] && o[1] === goal[1])) opts = [goal]; }
    n.to = opts[Math.floor(Math.random() * opts.length)]!;
  }
  placeNpc(n, Math.min(1, dt * 10));
}

function stepChaser(c: Chaser, dt: number): void {
  if (c.wait > 0) { c.wait -= dt; c.grace -= dt; c.a = Math.atan2(D.p.y - c.y, D.p.x - c.x); return; }
  const p = D.p, d = dist(c, p);
  c.grace -= dt;
  let tx: number, ty: number;
  if (d < 170 && los(c, p)) { tx = p.x + Math.cos(p.a) * p.v * 0.2; ty = p.y + Math.sin(p.a) * p.v * 0.2; c.goal = null; }
  else {
    if (!c.goal || Math.hypot(nodeC(c.goal[0]) - c.x, nodeC(c.goal[1]) - c.y) < 26) c.goal = nextNode(nodeOf(c.x, c.y), nodeOf(p.x, p.y));
    tx = nodeC(c.goal[0]); ty = nodeC(c.goal[1]);
  }
  if (c.rev > 0) { c.rev -= dt; c.v = -60; c.a += 1.6 * dt; }
  else {
    const diff = wrapA(Math.atan2(ty - c.y, tx - c.x) - c.a);
    c.a += clamp(diff, -4.4 * dt, 4.4 * dt);
    const tv = c.max * (0.3 + 0.7 * Math.max(0, Math.cos(diff)));
    c.v += clamp(tv - c.v, -400 * dt, 230 * dt);
  }
  c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
  const n = collide(c, CAR_R); if (n.nx || n.ny) c.v *= 1 - Math.min(1, dt * 6);
  // stuck on a corner: back up a bit
  c.chk += dt;
  if (c.chk > 1.1) { if (Math.hypot(c.x - c.cx, c.y - c.cy) < 14 && c.rev <= 0) { c.rev = 0.45; c.goal = null; } c.chk = 0; c.cx = c.x; c.cy = c.y; }
  c.taunt -= dt; if (d < 140 && c.taunt <= 0) { c.taunt = 4.5; ev.taunt(c.kind, c.x, c.y); }
  if (d < CATCH_D && c.grace <= 0) ev.caught(c.kind);
}

export function floatText(s: string, x: number, y: number, col: string = C.yellow): void { D.floats.push({ s, x, y, t: 0, col }); }

// ---------- GPS: the arrow follows the roads, not a straight line ----------
const hopCache = new Map<PlaceId, Int16Array>();
/** The two intersections at the ends of a place's road segment. */
function placeEnds(id: PlaceId): Node2[] {
  const pl = PLACES[id], [i, j] = nodeOf(pl.x, pl.y);
  if (pl.side === 'N' || pl.side === 'S') { const i0 = Math.floor((pl.x - T) / (PER * T)); return [[i0, j], [i0 + 1, j]]; }
  const j0 = Math.floor((pl.y - T) / (PER * T)); return [[i, j0], [i, j0 + 1]];
}
/** Hops from every intersection to the goal's road segment (multi-source BFS, cached per place). */
function hopsTo(id: PlaceId): Int16Array {
  const hit = hopCache.get(id); if (hit) return hit;
  const h = new Int16Array(NN * NN).fill(-1); const q: Node2[] = [];
  for (const e of placeEnds(id)) { h[e[0] * NN + e[1]] = 0; q.push(e); }
  while (q.length) { const c = q.shift()!; for (const nb of neighbors(c[0], c[1])) { const k = nb[0] * NN + nb[1]; if ((h[k] ?? 0) < 0) { h[k] = h[c[0] * NN + c[1]]! + 1; q.push(nb); } } }
  hopCache.set(id, h); return h;
}
/** The point the arrow should point at: the goal when it's close and visible, else the next intersection on the route. */
export function gpsTarget(id: PlaceId): { x: number; y: number } {
  const g = PLACES[id], p = D.p;
  if (dist(g, p) < 260 && los(g, p)) return g;
  const h = hopsTo(id), tx = Math.floor(p.x / T), ty = Math.floor(p.y / T), [ni, nj] = nodeOf(p.x, p.y);
  let ends: Node2[];
  if (tx % PER < 2 && ty % PER < 2) ends = [[ni, nj]];
  else if (ty % PER < 2) { const i0 = Math.floor((p.x - T) / (PER * T)); ends = [[i0, nj], [i0 + 1, nj]]; }
  else { const j0 = Math.floor((p.y - T) / (PER * T)); ends = [[ni, j0], [ni, j0 + 1]]; }
  const at = (n: Node2) => ({ x: nodeC(n[0]), y: nodeC(n[1]) });
  let best: Node2 | null = null, bc = Infinity;
  for (const e of ends) { const hv = h[e[0] * NN + e[1]] ?? -1; if (hv < 0) continue; const c = dist(p, at(e)) + hv * PER * T; if (c < bc) { bc = c; best = e; } }
  if (!best) return g;
  if (dist(p, at(best)) > 34) return at(best);
  const hb = h[best[0] * NN + best[1]]!;
  if (hb === 0) return g;
  const nx = neighbors(best[0], best[1]).find((n) => h[n[0] * NN + n[1]] === hb - 1);
  return nx ? at(nx) : g;
}

// ---------- render ----------
/** Draw the world centred on the camera. `pending` = places whose marker should pulse. */
export function renderWorld(pending: PlaceId[], showPlayer = true): void {
  const ox = Math.round(W / 2 - D.cam.x), oy = Math.round(SAFE_H / 2 - D.cam.y);
  const top = -view.top, h = view.H;
  ctx.fillStyle = '#202024'; ctx.fillRect(0, top, W, h);
  const sx = clamp(-ox, 0, SIZE), sy = clamp(top - oy, 0, SIZE), ex = clamp(-ox + W, 0, SIZE), ey = clamp(top - oy + h, 0, SIZE);
  ctx.imageSmoothingEnabled = false;
  if (ex > sx && ey > sy) ctx.drawImage(mapCanvas(), sx, sy, ex - sx, ey - sy, sx + ox, sy + oy, ex - sx, ey - sy);
  ctx.save(); ctx.translate(ox, oy);
  const t = D.t;
  // graffiti letters (sprayed on the asphalt)
  for (const l of D.letters) {
    if (l.taken) { ptxt(l.ch, l.x, l.y, 5, 'rgba(255,63,164,.25)'); continue; }
    const glow = 0.6 + 0.4 * Math.sin(t * 5);
    ctx.globalAlpha = glow; ctx.fillStyle = 'rgba(255,63,164,.25)'; ctx.fillRect(l.x - 22, l.y - 24, 44, 48); ctx.globalAlpha = 1;
    ptxt(l.ch, l.x, l.y, 5, C.pink, 'center', '#3a0a2a');
  }
  // markers
  for (const id of pending) {
    const pl = PLACES[id], k = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.strokeStyle = `rgba(255,210,63,${0.5 + 0.5 * k})`; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.strokeRect(pl.x - 28, pl.y - 28, 56, 56); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,210,63,${0.15 + 0.15 * k})`; ctx.fillRect(pl.x - 28, pl.y - 28, 56, 56);
  }
  // pickups
  for (const k of D.picks) {
    if (k.taken) continue;
    const bob = Math.round(Math.sin(t * 5 + k.x) * 2);
    if (k.kind === 'cash') { rr(k.x - 9, k.y - 6 + bob, 18, 12, 1, '#3aa858', '#1e6a33', 2); ptxt('$', k.x, k.y + bob, 1, '#eaffea'); }
    else { rr(k.x - 5, k.y - 8 + bob, 10, 16, 2, '#2fd1c8', '#0d5f5a', 2); rr(k.x - 3, k.y - 3 + bob, 6, 4, 0, '#ffd23f'); }
  }
  for (const n of D.npcs) drawCar('npc', n.x, n.y, n.a, n.color);
  if (D.hr) {
    const hr = D.hr;
    ctx.fillStyle = 'rgba(255,90,90,.13)'; ctx.beginPath(); ctx.arc(hr.x, hr.y, HR_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,90,.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 20; ctx.stroke(); ctx.setLineDash([]);
    drawCar('hr', hr.x, hr.y, hr.a);
    rr(hr.x - 12, hr.y - 30, 24, 14, 3, '#c8102e'); ptxt('HR', hr.x, hr.y - 23, 1, '#fff');
  }
  for (const c of D.chasers) drawCar(c.kind, c.x, c.y, c.a, undefined, Math.floor(t * 6) % 2);
  if (showPlayer) drawCar('player', D.p.x, D.p.y, D.p.a);
  // GPS arrow toward the goal
  if (showPlayer && D.goal) {
    const g = PLACES[D.goal], tgt = gpsTarget(D.goal), a = Math.atan2(tgt.y - D.p.y, tgt.x - D.p.x), r = 34;
    if (dist(g, D.p) > 60) {
      ctx.save(); ctx.translate(D.p.x + Math.cos(a) * r, D.p.y + Math.sin(a) * r); ctx.rotate(a);
      ctx.fillStyle = C.yellow; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
    }
  }
  for (const f of D.floats) { ctx.globalAlpha = Math.min(1, (1.2 - f.t) * 3); ptxt(f.s, f.x, f.y - f.t * 30, 2, f.col, 'center', '#000'); ctx.globalAlpha = 1; }
  ctx.restore();
}

/** The on-screen stick where the finger went down. */
export function renderStick(): void {
  const s = D.stick; if (!s.on) return;
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.ax, s.ay, STICK_R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(s.ax + s.dx, s.ay + s.dy, 18, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  void txt;
}
