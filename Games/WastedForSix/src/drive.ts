// The driving world shared by the three legs, in the Sun City scene (city.ts, rendered in 3D by lazy/world3d.ts):
// player car with the scene's handling (grip + handbrake drift) on keys or a virtual stick, grid traffic, the HR
// minivan, chasers that route through the city on a cost field, pickups, graffiti letters, place markers and the
// road-following GPS arrow. play.ts / legs.ts own the story and listen to the events in `ev`.
// Units are the scene's (a car ~6 long, a road 16 wide); 4 old pixels ≈ 1 unit.
import { W, view, ctx, input, keyHeld, keyLeft, keyRight, clamp, rr, txt, rand, loadLazy } from '@tsg/index';
import {
  PLACES, BMIN, BMAX, CELL, roadLine, collide, costField, downhill, roadNear, los, neighbors, edgeOpen, nodeOf,
  prims, grounds, lamps, type Node2, type PlaceId,
} from './city';
import type { CarKind, Frame, Fx, World3D } from './world3d-api';
import { C } from './art';
import { carSound } from './carsound';
import { ptxt } from './pixel';

export const MAX_V = 46;           // player top speed (the scene's MAX)
const STICK_R = 46;
const STICK_GRAB = 100;            // a touch within this distance of the stick's centre grabs it
/** The fixed stick's centre: bottom-left of the real screen (below the safe zone on tall phones). */
export const stickPos = (): { x: number; y: number } => ({ x: 76, y: view.H - view.top - 108 });
const CAR_R = 1.6;                 // the scene's collision radius
const CRASH_V = 18;                // the scene: sparks + shake above this
const CATCH_D = 4.5;
export const HR_R = 12;            // HR minivan's "sees you" radius (~a third of the screen width at the scene's camera)
const LANE = 4;                    // right-hand lane offset from a grid road's centre line
const NPC_N = 44;
const NPC_COLORS = ['#e86aa6', '#f2a65a', '#9b7fd1', '#e9d36b', '#c96b5b', '#7aa7d9', '#6fbf73', '#d9d2c5'];

export interface Car { x: number; y: number; a: number; v: number }
interface Player extends Car { vx: number; vy: number; steer: number }
interface Npc extends Car { id: number; from: Node2; to: Node2; s: number; spd: number; color: string; nm: number; hr: boolean }
export type ChaserKind = 'cop' | 'shark' | 'spouse';
export interface Chaser extends Car { id: number; kind: ChaserKind; max: number; grace: number; wait: number; chk: number; cx: number; cy: number; rev: number; taunt: number }
interface Pickup { id: number; x: number; y: number; kind: 'cash' | 'can'; taken: boolean }
interface Letter { id: number; x: number; y: number; ch: string; taken: boolean }
interface Float { x: number; y: number; s: string; t: number; col: string }

export const D = {
  p: { x: 0, y: 0, a: 0, v: 0, vx: 0, vy: 0, steer: 0 } as Player,
  cam: { x: 0, y: 0 },
  zoom: 95,                         // camera height (the scene: 95, out to 130 with speed)
  npcs: [] as Npc[],
  hr: null as Npc | null,
  chasers: [] as Chaser[],
  picks: [] as Pickup[],
  letters: [] as Letter[],
  floats: [] as Float[],
  fx: [] as Fx[],
  stick: { on: false, miss: false, ax: 0, ay: 0, dx: 0, dy: 0, rev: false },
  goal: null as PlaceId | null,     // where the GPS arrow points (detour first)
  avoidHr: false,                   // the GPS routes around the HR minivan (sick branch, before the doctor's note)
  heat: 0,
  t: 0,
  usedKeys: false,
  control: true,                    // false during a parked beat: the car brakes, no steering
};
let nextId = 1;

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

const wrapA = (a: number): number => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- the 3D renderer (lazy) ----------
let world: World3D | null = null;
let worldState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
/** Start loading the renderer (after the first frame; the city is 3D only from the first driving leg on). */
export function loadWorld(): void {
  if (worldState === 'loading' || worldState === 'ready') return;
  worldState = 'loading';
  loadLazy('world3d').then(() => {
    const mod = window.__w6world3d;
    if (!mod) throw new Error('world3d.js ran but did not register');
    world = mod.create({ prims, grounds, lamps, places: PLACES, bmin: BMIN, bmax: BMAX });
    worldState = 'ready';
  }).catch((e: unknown) => {
    // expected on a flaky connection: the leg waits on a "tap to retry" card instead of failing silently
    console.error(e); worldState = 'error';
  });
}
export const worldReady = (): boolean => worldState === 'ready';

// ---------- setup ----------
export function resetWorld(startId: PlaceId, toward: PlaceId): void {
  const st = PLACES[startId], to = PLACES[toward];
  const horiz = st.side === 'N' || st.side === 'S';
  const a = horiz ? (to.x >= st.x ? 0 : Math.PI) : (to.y >= st.y ? Math.PI / 2 : -Math.PI / 2);
  // start in the right-hand lane of the road outside the building
  D.p = { x: st.x - Math.sin(a) * LANE, y: st.y + Math.cos(a) * LANE, a, v: 0, vx: 0, vy: 0, steer: 0 };
  D.cam = { x: D.p.x, y: D.p.y }; D.zoom = 95;
  D.npcs = []; D.chasers = []; D.hr = null; D.picks = []; D.letters = []; D.floats = []; D.fx = [];
  D.stick.on = false; D.heat = 0; D.t = 0; D.control = true; D.avoidHr = false;
  for (let k = 0; k < NPC_N; k++) {
    for (let tries = 0; tries < 30; tries++) {
      const i = Math.floor(rand() * 13) - 6, j = Math.floor(rand() * 13) - 6, nb = neighbors(i, j); if (!nb.length) continue;
      if (Math.hypot(roadLine(i) - D.p.x, roadLine(j) - D.p.y) < 65) continue;
      const n: Npc = { id: nextId++, x: roadLine(i), y: roadLine(j), a: 0, v: 0, from: [i, j], to: nb[Math.floor(rand() * nb.length)]!, s: rand() * 30, spd: 17 + rand() * 9, color: NPC_COLORS[k % NPC_COLORS.length]!, nm: 0, hr: false };
      placeNpc(n, 1); D.npcs.push(n); break;
    }
  }
}

/** n pickups on open grid roads, mostly inside the box (x0, y0)–(x1, y1). */
export function addPickups(n: number, kind: 'cash' | 'can', x0: number, y0: number, x1: number, y1: number): void {
  for (let k = 0, tries = 0; k < n && tries < 4000; k++, tries++) {
    const i = Math.floor(rand() * 13) - 6, j = Math.floor(rand() * 13) - 6, hz = rand() < 0.5;
    const b: Node2 = hz ? [i + 1, j] : [i, j + 1];
    if (!edgeOpen([i, j], b)) { k--; continue; }
    const f = 0.3 + rand() * 0.4, lane = rand() < 0.5 ? -LANE : LANE;
    const x = hz ? roadLine(i) + f * CELL : roadLine(i) + lane, y = hz ? roadLine(j) + lane : roadLine(j) + f * CELL;
    if ((x < x0 || x > x1 || y < y0 || y > y1) && rand() < 0.97) { k--; continue; }
    D.picks.push({ id: nextId++, x, y, kind, taken: false });
  }
}

/** Graffiti letters sprayed on the road at even steps between two points. */
export function addLetters(chs: string, a: { x: number; y: number }, b: { x: number; y: number }): void {
  [...chs].forEach((ch, i) => {
    const f = (i + 1) / (chs.length + 1);
    const p = roadNear(a.x + (b.x - a.x) * f + (i ? 22 : -22), a.y + (b.y - a.y) * f);
    D.letters.push({ id: nextId++, x: p.x, y: p.y, ch, taken: false });
  });
}

export function addHr(near: { x: number; y: number }): void {
  const [i, j] = nodeOf(near.x, near.y), nb = neighbors(i, j);
  const n: Npc = { id: nextId++, x: roadLine(i), y: roadLine(j), a: 0, v: 0, from: [i, j], to: nb[0] ?? [i, j], s: 0, spd: 23, color: '#d8cfb4', nm: 0, hr: true };
  placeNpc(n, 1); D.hr = n;
}

/** `wait` = seconds the chaser sits still before the chase starts (reaction time after the banner). */
export function addChaser(kind: ChaserKind, x: number, y: number, grace = 1.2, wait = 0): void {
  const max = kind === 'shark' ? 41.5 : kind === 'cop' ? 39.5 : 37.5;
  const p = roadNear(x, y);
  D.chasers.push({ id: nextId++, x: p.x, y: p.y, a: Math.atan2(D.p.y - p.y, D.p.x - p.x), v: 0, kind, max, grace: grace + wait, wait, chk: 0, cx: p.x, cy: p.y, rev: 0, taunt: 2 });
}

/** A road point ~d units behind the player. */
export function behind(d: number): { x: number; y: number } {
  return roadNear(clamp(D.p.x - Math.cos(D.p.a) * d, BMIN + 10, BMAX - 10), clamp(D.p.y - Math.sin(D.p.a) * d, BMIN + 10, BMAX - 10));
}

// ---------- update ----------
let toPlayer: Int32Array | null = null, toPlayerT = 0;
export function stepWorld(dt: number, opts: { chasersOn: boolean }): void {
  D.t += dt;
  stepPlayer(dt);
  carSound(dt, D.p, D.hr && D.avoidHr ? dist(D.hr, D.p) - HR_R : null);   // engine, squeal, scrape, HR beeper
  for (const n of D.npcs) stepNpc(n, dt);
  if (D.hr) {
    stepNpc(D.hr, dt);
    if (dist(D.hr, D.p) < HR_R && los(D.hr, D.p)) ev.spotted();
  }
  if (opts.chasersOn && D.chasers.length) {
    toPlayerT -= dt;
    if (!toPlayer || toPlayerT <= 0) { toPlayer = costField(D.p.x, D.p.y); toPlayerT = 0.4; }
    for (const c of D.chasers) stepChaser(c, dt, toPlayer);
  }
  for (const k of D.picks) if (!k.taken && dist(k, D.p) < 5) { k.taken = true; ev.pickup(k.kind, k.x, k.y); }
  for (const l of D.letters) if (!l.taken && dist(l, D.p) < 7.5) { l.taken = true; ev.letter(l.ch); }
  if (D.goal && dist(PLACES[D.goal], D.p) < 10) ev.arrive(D.goal);
  // heat
  let h = 0;
  for (const c of D.chasers) h = Math.max(h, clamp(1 - (dist(c, D.p) - 7.5) / 105, 0, 1));
  if (D.hr) h = Math.max(h, 0.85 * clamp(1 - (dist(D.hr, D.p) - HR_R) / 75, 0, 1));
  D.heat += (h - D.heat) * Math.min(1, dt * 4);
  for (const f of D.floats) f.t += dt;
  D.floats = D.floats.filter((f) => f.t < 1.2);
  // the scene's top view: leads in the direction of travel and zooms out with speed
  const lx = D.p.x + D.p.vx * 0.35, ly = D.p.y + D.p.vy * 0.35, lz = 95 + Math.min(35, Math.abs(D.p.v) * 0.9);
  const k = 1 - Math.pow(0.01, dt);
  D.cam.x += (lx - D.cam.x) * k; D.cam.y += (ly - D.cam.y) * k; D.zoom += (lz - D.zoom) * k;
}

/** The scene's handling: throttle / brake / coast, speed-scaled steering, grip that lets go under the handbrake. */
function stepPlayer(dt: number): void {
  const p = D.p, s = D.stick;
  // fixed stick, bottom-left: a touch that starts on it (or near it) drives; touches elsewhere do nothing
  const c = stickPos(); s.ax = c.x; s.ay = c.y;
  if (!input.down) { s.on = false; s.miss = false; }
  else if (!s.on && !s.miss) { if (Math.hypot(input.px - c.x, input.py - c.y) < STICK_GRAB) s.on = true; else s.miss = true; }
  if (s.on && D.control) {
    s.dx = input.px - c.x; s.dy = input.py - c.y;
    const L = Math.hypot(s.dx, s.dy);
    if (L > STICK_R) { s.dx *= STICK_R / L; s.dy *= STICK_R / L; }
  } else { s.dx = 0; s.dy = 0; }
  let up = keyHeld('ArrowUp', 'w', 'W'), dn = keyHeld('ArrowDown', 's', 'S'), hb = keyHeld(' ');
  let steer = (keyRight() ? 1 : 0) - (keyLeft() ? 1 : 0);
  if (up || dn || steer || hb) D.usedKeys = true;
  else if (s.on && Math.hypot(s.dx, s.dy) > 8) {
    // stick: point where you want to go; it steers toward that heading and eases off in a sharp turn
    const diff = wrapA(Math.atan2(s.dy, s.dx) - p.a);
    // pulling the stick behind the car reverses (the scene's S / ↓), until the stick comes back in front of it
    if (Math.abs(diff) > 2.2) s.rev = true; else if (Math.abs(diff) < 1.2) s.rev = false;
    if (s.rev) {
      dn = true;
      steer = clamp(wrapA(diff - Math.PI) * 2.5, -1, 1) * (p.v < 0 ? -1 : 1);   // aim the tail at the stick
    } else {
      steer = clamp(diff * 2.5, -1, 1);
      up = Math.abs(diff) < 1.2 || p.v < 14;
      dn = !up && p.v > 22;
    }
  } else s.rev = false;
  if (!D.control) { up = false; dn = false; hb = false; steer = 0; p.v -= Math.sign(p.v) * Math.min(Math.abs(p.v), 60 * dt); }
  else if (up) p.v += 38 * dt;
  else if (dn) p.v -= (p.v > 0 ? 60 : 20) * dt;
  else p.v *= 1 - 0.8 * dt;
  p.v = clamp(p.v, -14, MAX_V);
  const sf = Math.min(1, Math.abs(p.v) / 10) * Math.sign(p.v);
  p.a = wrapA(p.a + steer * sf * (hb ? 3.4 : 2.3) * dt);
  p.steer = steer;
  const fx = Math.cos(p.a), fy = Math.sin(p.a), grip = hb ? 1.4 : 7;
  p.vx += (fx * p.v - p.vx) * Math.min(1, grip * dt);
  p.vy += (fy * p.v - p.vy) * Math.min(1, grip * dt);
  if (hb) p.v *= 1 - 0.6 * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (Math.abs(p.vx * fy - p.vy * fx) > 8 && rand() < 0.7) D.fx.push({ k: 'smoke', x: p.x - fx * 2.5, y: p.y - fy * 2.5, col: 0x8a7090 });
  // the scene: any hit costs 60% of the speed; above 18 u/s it throws sparks (and here counts as a crash)
  const n = collide(p, CAR_R);
  if (n.nx || n.ny) {
    if (Math.abs(p.v) > CRASH_V) { ev.crash(); D.fx.push({ k: 'burst', x: p.x + fx * 2.8, y: p.y + fy * 2.8, col: 0xffaa40 }); }
    p.v *= 0.4; p.vx *= 0.4; p.vy *= 0.4;
  }
  // traffic bumps + near misses
  for (const c of D.npcs) {
    const d = dist(c, p);
    if (d < 5) {
      const ux = (p.x - c.x) / (d || 1), uy = (p.y - c.y) / (d || 1);
      p.x += ux * (5 - d); p.y += uy * (5 - d);
      if (Math.abs(p.v) > 20) { ev.crash(); D.fx.push({ k: 'burst', x: (p.x + c.x) / 2, y: (p.y + c.y) / 2, col: 0xffaa40 }); }
      p.v *= 0.35; p.vx *= 0.35; p.vy *= 0.35; c.s = Math.max(0, c.s - 1);
    } else if (d < 7.8 && Math.abs(p.v) > 29 && c.nm <= 0) { c.nm = 3; ev.near(c.x, c.y); }
    c.nm -= dt;
  }
}

function edgeDir(n: Npc): { dx: number; dy: number } { return { dx: Math.sign(n.to[0] - n.from[0]), dy: Math.sign(n.to[1] - n.from[1]) }; }
function placeNpc(n: Npc, k: number): void {
  const { dx, dy } = edgeDir(n);
  const qx = roadLine(n.from[0]) + dx * n.s - dy * LANE, qy = roadLine(n.from[1]) + dy * n.s + dx * LANE; // right-hand lane
  n.x += (qx - n.x) * k; n.y += (qy - n.y) * k;
  n.a += wrapA(Math.atan2(dy, dx) - n.a) * Math.min(1, k + 0.0001);
}
function stepNpc(n: Npc, dt: number): void {
  const { dx, dy } = edgeDir(n);
  let spd = n.spd;
  // don't plough into the player or the car ahead
  const ahead = (o: { x: number; y: number }, r: number) => { const ox = o.x - n.x, oy = o.y - n.y; const along = ox * dx + oy * dy, side = Math.abs(-ox * dy + oy * dx); return along > 0 && along < r && side < 4; };
  if (!n.hr && ahead(D.p, 10)) spd = 0;
  else for (const o of D.npcs) if (o !== n && ahead(o, 9)) { spd = Math.min(spd, o.spd * 0.8); break; }
  n.v = spd;
  n.s += spd * dt;
  if (n.s >= CELL) {
    n.s -= CELL; const prev = n.from; n.from = n.to;
    let opts = neighbors(n.from[0], n.from[1]).filter((b) => !(b[0] === prev[0] && b[1] === prev[1]));
    if (!opts.length) opts = [prev];
    if (n.hr && rand() < 0.35) {   // the HR minivan drifts toward you
      const [pi, pj] = nodeOf(D.p.x, D.p.y), best = opts.reduce((m, o) => (Math.hypot(o[0] - pi, o[1] - pj) < Math.hypot(m[0] - pi, m[1] - pj) ? o : m));
      opts = [best];
    }
    n.to = opts[Math.floor(rand() * opts.length)]!;
  }
  placeNpc(n, Math.min(1, dt * 10));
}

function stepChaser(c: Chaser, dt: number, field: Int32Array): void {
  if (c.wait > 0) { c.wait -= dt; c.grace -= dt; c.a = Math.atan2(D.p.y - c.y, D.p.x - c.x); return; }
  const p = D.p, d = dist(c, p);
  c.grace -= dt;
  const tgt = d < 42 && los(c, p) ? { x: p.x + p.vx * 0.3, y: p.y + p.vy * 0.3 } : downhill(field, c.x, c.y, 6);
  if (c.rev > 0) { c.rev -= dt; c.v = -15; c.a += 1.6 * dt; }
  else {
    const diff = wrapA(Math.atan2(tgt.y - c.y, tgt.x - c.x) - c.a);
    c.a = wrapA(c.a + clamp(diff, -3.2 * dt, 3.2 * dt));
    const tv = c.max * (0.3 + 0.7 * Math.max(0, Math.cos(diff)));
    c.v += clamp(tv - c.v, -100 * dt, 30 * dt);
  }
  c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
  const n = collide(c, CAR_R); if (n.nx || n.ny) c.v *= 1 - Math.min(1, dt * 6);
  // stuck on a corner: back up a bit
  c.chk += dt;
  if (c.chk > 1.1) { if (Math.hypot(c.x - c.cx, c.y - c.cy) < 3.5 && c.rev <= 0) c.rev = 0.45; c.chk = 0; c.cx = c.x; c.cy = c.y; }
  c.taunt -= dt; if (d < 35 && c.taunt <= 0) { c.taunt = 4.5; ev.taunt(c.kind, c.x, c.y); }
  if (d < CATCH_D && c.grace <= 0) ev.caught(c.kind);
}

export function floatText(s: string, x: number, y: number, col: string = C.yellow): void { D.floats.push({ s, x, y, t: 0, col }); }

// ---------- GPS: the arrow follows the roads, not a straight line ----------
const fields = new Map<PlaceId, Int32Array>();
let hrField: { id: PlaceId; f: Int32Array; t: number } | null = null;
/** The point the arrow aims at: the place when it is close and in sight, else a point ~30 units along the route.
 *  With the HR minivan near (and avoidHr on) the route goes around it, refreshed twice a second. */
export function gpsTarget(id: PlaceId): { x: number; y: number } {
  const g = PLACES[id];
  if (dist(g, D.p) < 40 && los(g, D.p)) return g;
  let f = fields.get(id); if (!f) { f = costField(g.x, g.y); fields.set(id, f); }
  if (D.avoidHr && D.hr && dist(D.hr, D.p) < 90) {
    if (!hrField || hrField.id !== id || D.t - hrField.t > 0.5 || D.t < hrField.t) hrField = { id, f: costField(g.x, g.y, { x: D.hr.x, y: D.hr.y, r: HR_R + 10 }), t: D.t };
    f = hrField.f;
  }
  return downhill(f, D.p.x, D.p.y, 10);
}

// ---------- render ----------
const PIX = 4;                     // the scene's PIX: the 3D frame is rendered at 1/4 of the screen's CSS pixels
/** Draw the world (3D) and its 2D overlays: GPS arrow, HR tag, floating text. `pending` = places whose marker pulses. */
export function renderWorld(pending: PlaceId[], showPlayer = true): void {
  const top = -view.top;
  if (!world) { loadingCard(); return; }
  const f: Frame = {
    w: Math.max(1, Math.round((W * view.scale) / PIX)), h: Math.max(1, Math.round((view.H * view.scale) / PIX)), t: D.t,
    cam: { x: D.cam.x, y: D.cam.y, zoom: D.zoom },
    cars: [
      ...D.npcs.map((n) => ({ id: n.id, kind: 'npc' as CarKind, x: n.x, y: n.y, a: n.a, color: n.color })),
      ...(D.hr ? [{ id: D.hr.id, kind: 'hr' as CarKind, x: D.hr.x, y: D.hr.y, a: D.hr.a }] : []),
      ...D.chasers.map((c) => ({ id: c.id, kind: c.kind as CarKind, x: c.x, y: c.y, a: c.a })),
      ...(showPlayer ? [{ id: 0, kind: 'player' as CarKind, x: D.p.x, y: D.p.y, a: D.p.a, lean: D.p.steer * Math.min(1, Math.abs(D.p.v) / 30) }] : []),
    ],
    hr: D.hr ? { x: D.hr.x, y: D.hr.y, r: HR_R } : null,
    picks: D.picks.filter((k) => !k.taken),
    letters: D.letters,
    pending,
    fx: D.fx.splice(0),
  };
  world.render(f);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(world.canvas, 0, top, W, view.H);
  ctx.restore();
  const scr = (x: number, y: number, h = 0) => { const q = world!.project(x, y, h); return { x: q.x * W, y: top + q.y * view.H }; };
  if (D.hr) { const s = scr(D.hr.x, D.hr.y, 5); rr(s.x - 12, s.y - 30, 24, 14, 3, '#c8102e'); ptxt('HR', s.x, s.y - 23, 1, '#fff'); }
  // GPS arrow toward the goal, just past the car's nose
  if (showPlayer && D.goal && dist(PLACES[D.goal], D.p) > 15) {
    const tgt = gpsTarget(D.goal), a = Math.atan2(tgt.y - D.p.y, tgt.x - D.p.x), s = scr(D.p.x + Math.cos(a) * 7, D.p.y + Math.sin(a) * 7, 1.5);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
    ctx.fillStyle = C.yellow; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -9); ctx.lineTo(-2, 0); ctx.lineTo(-7, 9); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
  }
  for (const fl of D.floats) { const s = scr(fl.x, fl.y, 3); ctx.globalAlpha = Math.min(1, (1.2 - fl.t) * 3); ptxt(fl.s, s.x, s.y - fl.t * 30, 2, fl.col, 'center', '#000'); ctx.globalAlpha = 1; }
}

/** Shown until lazy/world3d.js has arrived (a slow connection), or when it failed (tap retries). */
function loadingCard(): void {
  ctx.fillStyle = '#0b0614'; ctx.fillRect(0, -view.top, W, view.H);
  if (worldState === 'error') {
    ptxt('NO SIGNAL', W / 2, 290, 3, C.pink, 'center', '#3a0a2a');
    txt('The city didn’t load. Tap to retry.', W / 2, 336, 14, '#fff', 'center', 700);
    if (input.taps.length) loadWorld();
    return;
  }
  if (worldState === 'idle') loadWorld();
  ptxt('LOADING CITY', W / 2, 300, 2, C.yellow, 'center', '#3a2a00');
  const k = (performance.now() / 600) % 1;
  rr(W / 2 - 60, 322, 120, 6, 3, 'rgba(255,255,255,.15)'); rr(W / 2 - 60 + 90 * k, 322, 30, 6, 3, C.pink);
}

/** The on-screen stick where the finger went down. */
export function renderStick(): void {
  const s = D.stick, c = stickPos(); s.ax = c.x; s.ay = c.y;
  ctx.globalAlpha = s.on ? 0.6 : 0.32;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.ax, s.ay, STICK_R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(s.ax + s.dx, s.ay + s.dy, 18, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
