// The driving world shared by the three legs, in the Sun City scene (city.ts, rendered in 3D by lazy/world3d.ts):
// player car with the scene's handling (grip + handbrake drift) on keys or a virtual stick, grid traffic, the HR
// minivan, chasers that route through the city on a cost field, pickups, graffiti letters, place markers and the
// road-following GPS arrow. play.ts / legs.ts own the story and listen to the events in `ev`.
// Units are the scene's (a car ~6 long, a road 16 wide); 4 old pixels ≈ 1 unit.
import { W, view, ctx, state, input, keyHeld, keyLeft, keyRight, clamp, rr, txt, rand, loadLazy, easeO, easeOB, pop } from '@tsg/index';
import {
  PLACES, BMIN, BMAX, CELL, roadLine, collide, costField, downhill, roadNear, los, neighbors, edgeOpen, nodeOf, offroad, cellOf,
  prims, grounds, lamps, solids, blocks, paths, BLOCK, BSIZE, N, inSuper, solidAt, type Node2, type PlaceId,
} from './city';
import type { CarKind, Frame, Fx, HeliView, World3D } from './world3d-api';
import { C } from './art';
import { UI } from './content';
import { carSound, copSiren, heliSound, wallGraze } from './carsound';
import { ptxt } from './pixel';
import { drawFace, type Who } from './portraits';

export const MAX_V = 43;           // player top speed (the scene's 46; eased 2026-11-17)
const STICK_R = 46;
const STICK_GRAB = 100;            // a touch within this distance of the stick's centre grabs it
/** The fixed stick's centre: bottom-left of the real screen (below the safe zone on tall phones). */
export const stickPos = (): { x: number; y: number } => ({ x: 76, y: view.H - view.top - 108 });
const CAR_R = 1.15;                // collision radius vs buildings (the scene's is 1.6; smaller = more forgiving)
const CRASH_V = 30, CRASH_DOT = 0.8;   // a crash needs this speed and a near head-on angle; anything else slides
const CATCH_D = 3.8;
// Around the home (the last leg's goal) the chasers hang back: they slow down inside SAFE_R and cannot catch you
// there (Nadav, 2026-11-17: they always caught him at the door). The arrive radius is 10.
const SAFE_R = 34, SAFE_V = 0.55;
export const HR_R = 12;            // HR minivan's "sees you" radius (~a third of the screen width at the scene's camera)
const LANE = 4;                    // right-hand lane offset from a grid road's centre line
const NPC_N = 28;
// feel (2026-11-17, RULES 13ד–13ז). Visual and audio only, except STEER_IN.
const STEER_IN = 9;                // steering slew (1/s): full lock in ~0.11 s, so the keys feel weighted, not digital
const SLIP_ON = 8;                 // sideways speed where the tires let go: smoke, marks, squeal (carsound.ts has the same)
const REAR = 2.25, TRACK = 1.55;   // rear axle behind the car's centre and half its track (the model × 1.4)
const SKID_STEP = 1.1;             // one tire-mark segment per this many units travelled
const SPEED_LINES_V = 31;          // speed lines fade in from here to top speed
// forgiveness (RULES 13יא)
const STICK_ZONE_W = 190, STICK_ZONE_H = 290;   // a touch anywhere in the bottom-left corner this big grabs the stick
export const HR_SPOT_S = 0.3;      // the HR minivan needs this long with you in its circle before it counts ("!" fills up)
// drift + boost. Keys: Space is the handbrake. Stick: a sharp turn at speed lets the tail go by itself.
const DRIFT_IN = 1.0, DRIFT_OUT = 0.4;   // stick: heading error (rad) where a drift starts / ends
const DRIFT_V = 24;                // stick: only above this speed (below it the car just turns)
const DRIFT_MIN_S = 0.35, DRIFT_FULL_S = 1.2;   // a drift this long earns a boost; this long earns the full one
const BOOST_V = 9, BOOST_S = 0.9;  // the full boost: top speed +9 u/s for 0.9 s
const FLY_S = 0.45;                // a pickup's flight to its HUD counter
const ALARM_S = 1.2;               // screen-edge flash when a chaser appears (RULES 13ח)
const CALL_S = 2.6;                // the announcement in the middle of the screen: who is after you (Nadav, 2026-11-17)
const CALL_WAIT_S = 0.5;           // it waits for the mission card's band to leave the same spot
// pedestrians: they walk the sidewalk ring around their block and sometimes cross at a corner; a moving car sends them flying
const PED_N = 560;                 // ~5 per block, 10–25 on screen
const PED_RING = BLOCK / 2 + 0.7;  // the walking line: on the sidewalk's edge, just outside the buildings
const PED_CROSS = 0.3;             // chance to cross the road at a corner
const PED_HIT_L = 3.9, PED_HIT_W = 2.1;   // the car's box for hitting them (half length / half width)
const PED_HIT_V = 6;               // slower than this they just step aside
const PED_SCARE_D = 16, PED_SCARE_V = 14, PED_RUN = 2.8;   // a fast car this close makes them run
const PED_DOWN_S = 4;              // lying on the road before a new one appears somewhere else
const PED_SIGN = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;   // the block's corners, clockwise on screen
const NPC_COLORS = ['#e86aa6', '#f2a65a', '#9b7fd1', '#e9d36b', '#c96b5b', '#7aa7d9', '#6fbf73', '#d9d2c5'];

export interface Car { x: number; y: number; a: number; v: number }
interface Player extends Car { vx: number; vy: number; steer: number }
interface Npc extends Car { id: number; from: Node2; to: Node2; s: number; spd: number; color: string; nm: number; hr: boolean }
export type ChaserKind = 'cop' | 'shark' | 'spouse';
export interface Chaser extends Car { id: number; kind: ChaserKind; max: number; grace: number; wait: number; chk: number; cx: number; cy: number; rev: number; taunt: number; kick: Spring; puff: number }
interface Spring { x: number; v: number }
/** (cx, cy) = the point it circles, lap = seconds spent circling on a patrol, (lx, ly) = where its searchlight is. */
interface Heli { x: number; y: number; a: number; v: number; roll: number; mode: 'patrol' | 'chase' | 'leave'; cx: number; cy: number; lap: number; lx: number; ly: number }
/** bi/bj = the block he walks around, k = the corner he is heading for, cw = which way round (±1). */
interface Ped { x: number; y: number; a: number; bi: number; bj: number; k: number; cw: number; crossed: boolean; spd: number; step: number; look: number; st: 'walk' | 'air' | 'down'; t: number; vx: number; vy: number; vz: number; h: number; rx: number; spin: number }
interface Fly { x: number; y: number; kind: 'cash' | 'can'; t: number; sx?: number; sy?: number }
interface Pickup { id: number; x: number; y: number; kind: 'cash' | 'can'; taken: boolean }
interface Letter { id: number; x: number; y: number; ch: string; taken: boolean }
interface Float { x: number; y: number; s: string; t: number; col: string }

export const D = {
  p: { x: 0, y: 0, a: 0, v: 0, vx: 0, vy: 0, steer: 0 } as Player,
  cam: { x: 0, y: 0 },
  zoom: 118,                        // camera height: 118, out to 153 with speed (the scene's 95 → 130 felt too tight on a phone)
  npcs: [] as Npc[],
  peds: [] as Ped[],
  hrs: [] as Npc[],                 // the HR minivans out looking for you (sick branch): PACK of them
  chasers: [] as Chaser[],
  picks: [] as Pickup[],
  letters: [] as Letter[],
  floats: [] as Float[],
  fx: [] as Fx[],
  walker: null as { x: number; y: number; a: number; step: number } | null,   // the fan on foot after parking
  // grabT / missT: state.t (real clock) of the last grab and of the last touch that missed the stick (feedback, 13ד)
  stick: { on: false, miss: false, ax: 0, ay: 0, dx: 0, dy: 0, rev: false, drift: false, grabT: -9, missT: -9 },
  goal: null as PlaceId | null,     // where the GPS arrow points (detour first)
  avoidHr: false,                   // the GPS routes around the HR minivan (sick branch, before the doctor's note)
  heat: 0,
  heli: null as Heli | null,        // the police helicopter while it is over the city (stepHeli)
  t: 0,
  usedKeys: false,
  control: true,                    // false during a parked beat: the car brakes, no steering
  // the car's body on springs (visual only): kick = tail-out yaw in a turn, pitch = squat / dive, sq = squash (+) / stretch (−)
  body: { kick: { x: 0, v: 0 }, pitch: { x: 0, v: 0 }, sq: { x: 0, v: 0 } },
  drv: { gas: false, brake: false },   // what the pedals did this step (brake glow, exhaust puffs, brake squeal)
  drift: 0,                         // seconds the current drift has lasted
  boost: 0, boostK: 0,              // seconds of boost left and its strength (0..1)
  hrSee: 0,                         // seconds the HR minivan has had you in its circle (counts at HR_SPOT_S)
  dusk: 0,                          // 0 = daylight, 1 = evening; a leg sets it after resetWorld (the drive home)
  closeUp: false,                  // the camera comes down on the fan while he walks into a building
  alarm: -9, alarmCop: false,       // D.t when the last chaser appeared, and whether it was a cop (red / blue flash)
  alarmKind: 'cop' as ChaserKind,   // who that chaser was (the announcement names it)
  flies: [] as Fly[],               // pickups on their way to the HUD
  hudKick: { cash: -9, can: -9 },   // state.t when the last one landed (play.ts pops the counter)
};
let nextId = 1;
/** Damped spring toward `to` (ω ≈ 13 rad/s, ζ ≈ 0.34): it passes the target, comes back and settles (RULES 13ו). */
function spring(s: Spring, to: number, dt: number): void { s.v += ((to - s.x) * 180 - s.v * 9) * dt; s.x += s.v * dt; }
let skidL: { x: number; y: number } | null = null, skidR: { x: number; y: number } | null = null;   // last tire-mark points
let puffT = 0, sparkT = 0, bumpCd = 0, onWall = false, onCurb = false, curbCd = 0, flameT = 0;

/** Events for play.ts. */
export const ev = {
  pickup: (_k: 'cash' | 'can', _x: number, _y: number): void => {},
  letter: (_ch: string): void => {},
  crash: (): void => {},
  bump: (_k: number): void => {},   // a hit that is not a crash (wall touch, traffic nudge, curb), strength 0..1
  boost: (_k: number): void => {},  // a drift ended well: boost of strength 0..1
  near: (_x: number, _y: number): void => {},
  ped: (_x: number, _y: number): void => {},   // the player's car ran someone over
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
  D.cam = { x: D.p.x, y: D.p.y }; D.zoom = 190;   // leg entry: the camera swoops down from high above
  D.npcs = []; D.chasers = []; D.hrs = []; D.picks = []; D.letters = []; D.floats = []; D.fx = []; D.walker = null;
  D.stick.on = false; D.heat = 0; D.t = 0; D.control = true; D.avoidHr = false;
  D.heli = null; heliT = HELI_FIRST_S;
  D.body = { kick: { x: 0, v: 0 }, pitch: { x: 0, v: 0 }, sq: { x: 0, v: 0 } }; D.drv = { gas: false, brake: false };
  skidL = skidR = null; puffT = sparkT = bumpCd = curbCd = flameT = 0; onWall = false; streakT = 0;
  onCurb = offroad[cellOf(D.p.x, D.p.y)] === 1;
  D.stick.drift = false; D.drift = 0; D.boost = 0; D.hrSee = 0; D.closeUp = false; D.dusk = 0; D.alarm = -9; D.flies = [];
  for (let k = 0; k < NPC_N; k++) {
    for (let tries = 0; tries < 30; tries++) {
      const i = Math.floor(rand() * 13) - 6, j = Math.floor(rand() * 13) - 6, nb = neighbors(i, j); if (!nb.length) continue;
      if (Math.hypot(roadLine(i) - D.p.x, roadLine(j) - D.p.y) < 65) continue;
      const n: Npc = { id: nextId++, x: roadLine(i), y: roadLine(j), a: 0, v: 0, from: [i, j], to: nb[Math.floor(rand() * nb.length)]!, s: rand() * 30, spd: 17 + rand() * 9, color: NPC_COLORS[k % NPC_COLORS.length]!, nm: 0, hr: false };
      placeNpc(n, 1); D.npcs.push(n); break;
    }
  }
  D.peds = [];
  for (let k = 0; k < PED_N; k++) { const q = { look: Math.floor(rand() * 4096) } as Ped; spawnPed(q, 0); D.peds.push(q); }
}

// ---------- pedestrians ----------
// blocks with a free sidewalk ring (not a superblock, nothing solid on the walking line)
const pedBlocks: Array<[number, number]> = [];
const pedKey = (i: number, j: number): number => (i + N) * 2 * N + (j + N);
const pedOk = new Set<number>();
for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
  if (inSuper(i, j)) continue;
  let free = true;
  for (const [sx, sy] of [...PED_SIGN, [0, -1], [1, 0], [0, 1], [-1, 0]] as const) if (solidAt(i * CELL + sx * PED_RING, j * CELL + sy * PED_RING, 0.8)) free = false;
  if (free) { pedBlocks.push([i, j]); pedOk.add(pedKey(i, j)); }
}
const pedCorner = (q: Ped): { x: number; y: number } => ({ x: q.bi * CELL + PED_SIGN[q.k]![0] * PED_RING, y: q.bj * CELL + PED_SIGN[q.k]![1] * PED_RING });
/** Put a pedestrian somewhere on a random block's sidewalk, at least `away` units from the car (off screen). */
function spawnPed(q: Ped, away: number): void {
  for (let tries = 0; tries < 40; tries++) {
    const [bi, bj] = pedBlocks[Math.floor(rand() * pedBlocks.length)]!;
    q.bi = bi; q.bj = bj;
    if (Math.hypot(bi * CELL - D.p.x, bj * CELL - D.p.y) >= away + BLOCK) break;
  }
  q.cw = rand() < 0.5 ? 1 : -1; q.k = Math.floor(rand() * 4);
  const to = pedCorner(q), f = rand();
  q.k = (q.k - q.cw + 4) % 4; const from = pedCorner(q); q.k = (q.k + q.cw + 4) % 4;
  q.x = from.x + (to.x - from.x) * f; q.y = from.y + (to.y - from.y) * f; q.a = Math.atan2(to.y - from.y, to.x - from.x);
  q.crossed = false; q.spd = 3 + rand() * 2.2; q.step = rand() * 6; q.st = 'walk'; q.t = 0; q.vx = q.vy = q.vz = 0; q.h = 0; q.rx = 0; q.spin = 0;
}
/** At a corner: cross the road to the next block's facing corner, or carry on around this block. */
function pedTurn(q: Ped): void {
  const [sx, sy] = PED_SIGN[q.k]!;
  if (!q.crossed && rand() < PED_CROSS) {
    const viaX = rand() < 0.5, ni = q.bi + (viaX ? sx : 0), nj = q.bj + (viaX ? 0 : sy);
    if (ni >= -N && ni < N && nj >= -N && nj < N && pedOk.has(pedKey(ni, nj))) {
      q.bi = ni; q.bj = nj; q.crossed = true;
      q.k = PED_SIGN.findIndex((s) => s[0] === (viaX ? -sx : sx) && s[1] === (viaX ? sy : -sy));
      return;
    }
  }
  q.crossed = false;
  if (rand() < 0.15) q.cw = -q.cw;
  q.k = (q.k + q.cw + 4) % 4;
}
function stepPed(q: Ped, dt: number): void {
  if (q.st === 'air') {   // flung: a tumbling arc, stopped by walls, until he lands flat
    q.x += q.vx * dt; q.y += q.vy * dt; q.vz -= 34 * dt; q.h += q.vz * dt; q.rx += q.spin * dt;
    const n = collide(q, 0.5); if (n.nx || n.ny) { q.vx = 0; q.vy = 0; }
    if (q.h <= 0 && q.vz < 0) { q.h = 0; q.rx = Math.PI / 2; q.st = 'down'; q.t = 0; D.fx.push({ k: 'smoke', x: q.x, y: q.y, col: 0x8a7090 }); }
    return;
  }
  if (q.st === 'down') { q.t += dt; if (q.t >= PED_DOWN_S) spawnPed(q, 110); return; }
  const c = pedCorner(q), dx = c.x - q.x, dy = c.y - q.y, d = Math.hypot(dx, dy);
  const scared = Math.abs(q.x - D.p.x) < PED_SCARE_D && Math.abs(q.y - D.p.y) < PED_SCARE_D && Math.hypot(D.p.vx, D.p.vy) > PED_SCARE_V;
  const spd = q.spd * (scared ? PED_RUN : 1);
  if (d <= spd * dt + 0.05) { q.x = c.x; q.y = c.y; pedTurn(q); }
  else { q.x += (dx / d) * spd * dt; q.y += (dy / d) * spd * dt; q.a += wrapA(Math.atan2(dy, dx) - q.a) * Math.min(1, dt * 10); }
  q.step += spd * dt * 1.6;
}
/** A car going (vx, vy) hits him: he flies off the bonnet, spinning. */
function fling(q: Ped, vx: number, vy: number): void {
  const s = Math.hypot(vx, vy);
  q.st = 'air'; q.t = 0; q.h = 0.2;
  q.vx = vx * 0.55 + (rand() - 0.5) * 7; q.vy = vy * 0.55 + (rand() - 0.5) * 7; q.vz = 8 + s * 0.2;
  q.spin = (rand() < 0.5 ? -1 : 1) * (8 + rand() * 6);
  D.fx.push({ k: 'burst', x: q.x, y: q.y, col: 0xfff2c0, n: 8, spd: 9 });
}
function stepPeds(dt: number, chasersOn: boolean): void {
  const p = D.p, fx = Math.cos(p.a), fy = Math.sin(p.a), sp = Math.hypot(p.vx, p.vy);
  for (const q of D.peds) {
    stepPed(q, dt);
    if (q.st !== 'walk') continue;
    const dx = q.x - p.x, dy = q.y - p.y;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      const along = dx * fx + dy * fy, side = dy * fx - dx * fy;
      if (Math.abs(along) < PED_HIT_L && Math.abs(side) < PED_HIT_W) {
        if (sp > PED_HIT_V) { fling(q, p.vx, p.vy); p.v *= 0.95; p.vx *= 0.95; p.vy *= 0.95; impact(0.3); ev.ped(q.x, q.y); continue; }
        // crawling (parking, pulling away): he just steps out of the car's way
        const s = side >= 0 ? 1 : -1, push = PED_HIT_W - Math.abs(side); q.x -= fy * s * push; q.y += fx * s * push;
      }
    }
    if (chasersOn) for (const c of D.chasers) if (c.v > 8 && Math.abs(q.x - c.x) < 2.6 && Math.abs(q.y - c.y) < 2.6) { fling(q, Math.cos(c.a) * c.v, Math.sin(c.a) * c.v); break; }
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

/** Whoever is after you or looking for you comes in threes (Nadav, 2026-11-17): chasers and HR minivans alike. */
export const PACK = 2;
/** Where the members of an HR pack start, relative to the first one (snapped to the nearest junction). */
const PACK_AT: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, -120], [160, 40]];

export function addHr(near: { x: number; y: number }): void {
  for (let k = 0; k < PACK; k++) {
    const [ox, oy] = PACK_AT[k % PACK_AT.length]!;
    const [i, j] = nodeOf(clamp(near.x + ox, BMIN + 10, BMAX - 10), clamp(near.y + oy, BMIN + 10, BMAX - 10)), nb = neighbors(i, j);
    const n: Npc = { id: nextId++, x: roadLine(i), y: roadLine(j), a: 0, v: 0, from: [i, j], to: nb[k % Math.max(1, nb.length)] ?? [i, j], s: 0, spd: 23, color: '#d8cfb4', nm: 0, hr: true };
    placeNpc(n, 1); D.hrs.push(n);
  }
}
/** The HR minivan closest to the car (null when none is out). */
export function nearHr(): Npc | null {
  let best: Npc | null = null, bd = Infinity;
  for (const n of D.hrs) { const d = dist(n, D.p); if (d < bd) { bd = d; best = n; } }
  return best;
}

/** `wait` = seconds the chaser sits still before the chase starts (reaction time after the banner). */
export function addChaser(kind: ChaserKind, x: number, y: number, grace = 1.2, wait = 0): void {
  const max = kind === 'shark' ? 36 : kind === 'cop' ? 34 : 32;   // player 43: they are 74–84% of it (were 82–90%)
  // a pack of PACK: the others start on nearby roads, a little slower, and set off a beat later each, so they come strung out
  for (let k = 0; k < PACK; k++) {
    const off = k === 0 ? 0 : k % 2 ? 26 : -26, w = wait + k * 0.45;
    const p = roadNear(clamp(x + off, BMIN + 10, BMAX - 10), clamp(y + off, BMIN + 10, BMAX - 10));
    D.chasers.push({ id: nextId++, x: p.x, y: p.y, a: Math.atan2(D.p.y - p.y, D.p.x - p.x), v: 0, kind, max: max - k * 1.2, grace: grace + w, wait: w, chk: 0, cx: p.x, cy: p.y, rev: 0, taunt: 2 + k * 1.5, kick: { x: 0, v: 0 }, puff: 0 });
  }
  D.alarm = D.t; D.alarmCop = kind === 'cop'; D.alarmKind = kind;
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
  // engine, squeal (drift, hard braking, wheelspin off the line), scrape, HR beeper
  const squeal = D.drv.brake && D.p.v > 20 ? 0.55 : D.drv.gas && D.p.v < 8 ? 0.4 : 0;
  const hr = nearHr();
  carSound(dt, D.p, hr && D.avoidHr ? dist(hr, D.p) - HR_R : null, squeal);
  copSiren(opts.chasersOn ? D.chasers.reduce((m, c) => (c.kind === 'cop' ? Math.min(m, dist(c, D.p)) : m), Infinity) : null);   // police wail
  stepPeds(dt, opts.chasersOn);
  for (const n of D.npcs) stepNpc(n, dt);
  if (D.hrs.length) {
    for (const n of D.hrs) stepNpc(n, dt);
    // one of them has to keep you in its circle for HR_SPOT_S before it counts: a clipped corner is forgiven, and you see it coming
    D.hrSee = D.hrs.some((n) => dist(n, D.p) < HR_R && los(n, D.p)) ? D.hrSee + dt : Math.max(0, D.hrSee - dt * 2);
    if (D.hrSee >= HR_SPOT_S) ev.spotted();
  }
  if (opts.chasersOn && D.chasers.length) {
    toPlayerT -= dt;
    if (!toPlayer || toPlayerT <= 0) { toPlayer = costField(D.p.x, D.p.y); toPlayerT = 0.4; }
    for (const c of D.chasers) stepChaser(c, dt, toPlayer);
  }
  stepHeli(dt, opts.chasersOn && D.chasers.length > 0);
  heliSound(D.heli ? dist(D.heli, D.p) : null);   // rotor, soft
  for (const k of D.picks) if (!k.taken && dist(k, D.p) < 5) { k.taken = true; D.fx.push({ k: 'burst', x: k.x, y: k.y, col: k.kind === 'cash' ? 0x5dff8a : 0x6ff6ee, n: 10, spd: 9 }); D.flies.push({ x: k.x, y: k.y, kind: k.kind, t: 0 }); ev.pickup(k.kind, k.x, k.y); }
  for (const f of D.flies) { f.t += dt; if (f.t >= FLY_S) D.hudKick[f.kind] = state.t; }
  D.flies = D.flies.filter((f) => f.t < FLY_S);
  for (const l of D.letters) if (!l.taken && dist(l, D.p) < 7.5) { l.taken = true; D.fx.push({ k: 'burst', x: l.x, y: l.y, col: 0xff3fa4, n: 18, spd: 14 }); ev.letter(l.ch); }
  if (D.goal && dist(PLACES[D.goal], D.p) < 10) ev.arrive(D.goal);
  // heat
  let h = 0;
  for (const c of D.chasers) h = Math.max(h, clamp(1 - (dist(c, D.p) - 7.5) / 105, 0, 1));
  if (hr) h = Math.max(h, 0.85 * clamp(1 - (dist(hr, D.p) - HR_R) / 75, 0, 1));
  D.heat += (h - D.heat) * Math.min(1, dt * 4);
  for (const f of D.floats) f.t += dt;
  D.floats = D.floats.filter((f) => f.t < 1.2);
  // the scene's top view: leads in the direction of travel and zooms out with speed
  // (close-up: it comes down on the fan while he walks in, so you can see him)
  const who = D.closeUp ? (D.walker ?? D.p) : null;
  const lx = who ? who.x : D.p.x + D.p.vx * 0.35, ly = who ? who.y : D.p.y + D.p.vy * 0.35, lz = who ? 60 : 118 + Math.min(35, Math.abs(D.p.v) * 0.9);
  const k = 1 - Math.pow(0.01, dt);
  D.cam.x += (lx - D.cam.x) * k; D.cam.y += (ly - D.cam.y) * k; D.zoom += (lz - D.zoom) * k;
}

// ---------- the police helicopter ----------
// Visual only: it never catches you and uses no random numbers (the bot's run stays the same).
// No chase: every so often it flies in, circles the spot you were heading for and leaves. Chase: it comes in from
// behind and stays over you, circling when you slow down. Its searchlight is on only in the evening (D.dusk).
const HELI_H = 46;                 // flying height: above the houses and most towers
const HELI_R = 12;                 // the circle it flies (it looks ~1.6x wider on screen, the helicopter is nearer the camera)
const HELI_V = 26, HELI_MAX_V = 75;   // circling speed on a patrol; the most it does to catch up with you (you: 43)
const HELI_TURN = 2.2;             // rad/s
const HELI_FAR = 110;              // it appears and disappears this far from you (well off screen)
const HELI_FIRST_S = 8, HELI_EVERY_S = 30, HELI_LAP_S = 6;   // first patrol of a leg, pause between patrols, time spent circling
const HELI_DUSK = 0.4;             // the searchlight is on from this much evening
let heliT = HELI_FIRST_S, heliN = 0;
function spawnHeli(mode: Heli['mode'], cx: number, cy: number, from: number): Heli {
  return { x: cx + Math.cos(from) * HELI_FAR, y: cy + Math.sin(from) * HELI_FAR, a: from + Math.PI, v: 40, roll: 0, mode, cx, cy, lap: 0, lx: cx, ly: cy };
}
/** Start a patrol now (also the debug hook `__heli()`): it comes from a different side each time. */
export function heliPatrol(): void {
  D.heli = spawnHeli('patrol', D.p.x + D.p.vx * 2, D.p.y + D.p.vy * 2, heliN++ * 2.4);
}
function stepHeli(dt: number, chase: boolean): void {
  if (!D.heli) {
    if (chase) D.heli = spawnHeli('chase', D.p.x, D.p.y, D.p.a + Math.PI);
    else { heliT -= dt; if (heliT > 0) return; heliPatrol(); }
  }
  const h = D.heli!;
  if (chase) h.mode = 'chase'; else if (h.mode === 'chase') h.mode = 'leave';
  let vT = HELI_V;
  if (h.mode === 'chase') {
    h.cx = D.p.x - D.p.vx * 0.3; h.cy = D.p.y - D.p.vy * 0.3;   // a little behind you, so it does not cover the road ahead
    vT = clamp(Math.abs(D.p.v) + (Math.hypot(h.x - h.cx, h.y - h.cy) - HELI_R) * 2.5, 16, HELI_MAX_V);
  }
  const d = Math.hypot(h.x - h.cx, h.y - h.cy);
  let tx = h.cx, ty = h.cy;   // far away: straight to the circle's centre
  if (h.mode === 'leave') {
    tx = h.x + Math.cos(h.a) * 50; ty = h.y + Math.sin(h.a) * 50; vT = 60;
    if (dist(h, D.p) > HELI_FAR) { D.heli = null; heliT = HELI_EVERY_S; return; }
  } else if (d < HELI_R * 1.6) {
    // on the circle: aim at a point a little further round it
    const ang = Math.atan2(h.y - h.cy, h.x - h.cx) + 0.9;
    tx = h.cx + Math.cos(ang) * HELI_R; ty = h.cy + Math.sin(ang) * HELI_R;
    if (h.mode === 'patrol') { h.lap += dt; if (h.lap > HELI_LAP_S) h.mode = 'leave'; }
  }
  const turn = clamp(wrapA(Math.atan2(ty - h.y, tx - h.x) - h.a) * 3, -HELI_TURN, HELI_TURN);
  h.a = wrapA(h.a + turn * dt); h.v += (vT - h.v) * Math.min(1, dt * 2);
  h.x += Math.cos(h.a) * h.v * dt; h.y += Math.sin(h.a) * h.v * dt;
  h.roll += (turn * 0.12 - h.roll) * Math.min(1, dt * 5);
  // searchlight: on you in a chase (a little late), sweeping the road ahead of it on a patrol
  const sw = Math.sin(D.t * 1.4) * 10;
  const gx = h.mode === 'chase' ? D.p.x : h.x + Math.cos(h.a) * 8 - Math.sin(h.a) * sw, gy = h.mode === 'chase' ? D.p.y : h.y + Math.sin(h.a) * 8 + Math.cos(h.a) * sw;
  const k = Math.min(1, dt * 6);
  h.lx += (gx - h.lx) * k; h.ly += (gy - h.ly) * k;
}
/** What the renderer gets. The height follows the camera down in a close-up, so the helicopter keeps its size on
 *  screen instead of filling it. */
function heliView(h: Heli): HeliView {
  return { id: 1, x: h.x, y: h.y, h: Math.min(HELI_H, D.zoom * 0.39), a: h.a, pitch: (h.v / HELI_MAX_V) * 0.22, roll: h.roll, ...(D.dusk > HELI_DUSK ? { light: { x: h.lx, y: h.ly } } : {}) };
}

/** The scene's handling: throttle / brake / coast, speed-scaled steering, grip that lets go under the handbrake. */
function stepPlayer(dt: number): void {
  const p = D.p, s = D.stick;
  // fixed stick, bottom-left: a touch that starts anywhere in that corner drives; a touch elsewhere does not, and the
  // stick's ring flashes so you see where it is
  const c = stickPos(); s.ax = c.x; s.ay = c.y;
  if (!input.down) { s.on = false; s.miss = false; }
  else if (!s.on && !s.miss) {
    const inZone = input.px < STICK_ZONE_W && input.py > view.H - view.top - STICK_ZONE_H;
    if (inZone || Math.hypot(input.px - c.x, input.py - c.y) < STICK_GRAB) { s.on = true; s.grabT = state.t; } else { s.miss = true; if (D.control && input.px < W * 0.6) s.missT = state.t; }   // the right side has its own buttons
  }
  if (s.on && D.control) {
    s.dx = input.px - c.x; s.dy = input.py - c.y;
    const L = Math.hypot(s.dx, s.dy);
    if (L > STICK_R) { s.dx *= STICK_R / L; s.dy *= STICK_R / L; }
  } else { s.dx = 0; s.dy = 0; }
  let up = keyHeld('ArrowUp', 'w', 'W'), dn = keyHeld('ArrowDown', 's', 'S'), hb = keyHeld(' ');
  let steer = (keyRight() ? 1 : 0) - (keyLeft() ? 1 : 0);
  let soft = false;   // the stick's own drift: a gentler slide than the Space handbrake
  if (up || dn || steer || hb) { D.usedKeys = true; s.drift = false; }
  else if (s.on && Math.hypot(s.dx, s.dy) > 8) {
    // stick: point where you want to go; it steers toward that heading and eases off in a sharp turn
    const diff = wrapA(Math.atan2(s.dy, s.dx) - p.a);
    // pulling the stick behind the car reverses (the scene's S / ↓), until the stick comes back in front of it
    if (Math.abs(diff) > 2.2) s.rev = true; else if (Math.abs(diff) < 1.2) s.rev = false;
    if (s.rev) {
      dn = true; s.drift = false;
      steer = clamp(wrapA(diff - Math.PI) * 2.5, -1, 1) * (p.v < 0 ? -1 : 1);   // aim the tail at the stick
    } else {
      steer = clamp(diff * 2.5, -1, 1);
      // a sharp turn at speed is a drift: off the gas, the tail lets go until the nose is nearly where the stick points
      if (!s.drift && Math.abs(diff) > DRIFT_IN && p.v > DRIFT_V) s.drift = true;
      else if (s.drift && (Math.abs(diff) < DRIFT_OUT || p.v < 12)) s.drift = false;
      if (s.drift) { hb = true; soft = true; }
      else { up = Math.abs(diff) < 1.2 || p.v < 14; dn = !up && p.v > 22; }
    }
  } else { s.rev = false; s.drift = false; }
  const v0 = p.v, b = D.body;
  if (!D.control) { up = false; dn = false; hb = false; steer = 0; s.drift = false; p.v -= Math.sign(p.v) * Math.min(Math.abs(p.v), 60 * dt); }
  else if (up) p.v += 38 * dt;
  else if (dn) p.v -= (p.v > 0 ? 60 : 20) * dt;
  else if (!soft) p.v *= 1 - 0.8 * dt;   // (the stick's drift keeps its speed: only the handbrake drag below slows it)
  // boost: the top speed is lifted while it lasts and eases back down over its last 0.3 s
  D.boost = Math.max(0, D.boost - dt);
  p.v = clamp(p.v, -14, MAX_V + BOOST_V * D.boostK * Math.min(1, D.boost / 0.3));
  D.drv.gas = up; D.drv.brake = (dn && v0 > 1) || (hb && Math.abs(v0) > 3) || (!D.control && Math.abs(v0) > 1);
  // the wheel turns at STEER_IN per second instead of jumping to full lock
  p.steer += clamp(steer - p.steer, -STEER_IN * dt, STEER_IN * dt);
  const sf = Math.min(1, Math.abs(p.v) / 10) * Math.sign(p.v);
  const yaw = p.steer * sf * (hb ? (soft ? 3.0 : 3.4) : 2.7);
  p.a = wrapA(p.a + yaw * dt);
  const fx = Math.cos(p.a), fy = Math.sin(p.a), grip = hb ? (soft ? 3 : 1.4) : 7;
  p.vx += (fx * p.v - p.vx) * Math.min(1, grip * dt);
  p.vy += (fy * p.v - p.vy) * Math.min(1, grip * dt);
  if (hb) p.v *= 1 - 0.6 * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
  const slip = p.vx * fy - p.vy * fx;   // sideways speed; its sign follows the turn
  if (Math.abs(slip) > SLIP_ON && rand() < 0.7) D.fx.push({ k: 'smoke', x: p.x - fx * 2.5, y: p.y - fy * 2.5, col: 0x8a7090 });
  // drift → boost: hold a slide for DRIFT_MIN_S or more, and letting it go kicks the car forward (longer = stronger)
  if (hb && Math.abs(slip) > SLIP_ON) D.drift += dt;
  else if (!hb) {
    if (D.drift >= DRIFT_MIN_S && p.v > 10) {
      const k = clamp((D.drift - DRIFT_MIN_S) / (DRIFT_FULL_S - DRIFT_MIN_S), 0, 1);
      D.boostK = 0.45 + 0.55 * k; D.boost = BOOST_S;
      p.v = Math.min(p.v + BOOST_V * D.boostK, MAX_V + BOOST_V * D.boostK);
      b.sq.v -= 5 * D.boostK; b.pitch.v += 1.2 * D.boostK;   // the car stretches and squats as it shoots off
      D.fx.push({ k: 'burst', x: p.x - fx * 3.6, y: p.y - fy * 3.6, col: 0xff7a20, n: 14, spd: 11 });
      ev.boost(D.boostK);
    }
    D.drift = 0;
  }
  flameT -= dt;
  if (D.boost > 0 && flameT <= 0) { flameT = 0.05; D.fx.push({ k: 'burst', x: p.x - fx * 3.8, y: p.y - fy * 3.8, col: 0xff9a30, n: 2, spd: 5 }); }
  // curb: going onto or off a sidewalk / lawn gives the body a small bump
  curbCd -= dt;
  const curb = offroad[cellOf(p.x, p.y)] === 1;
  if (curb !== onCurb) { onCurb = curb; if (Math.abs(p.v) > 10 && curbCd <= 0) { curbCd = 0.25; impact(0.22); ev.bump(0.3); } }
  // tire marks from the rear wheels: drifting, hard braking, wheelspin off the line
  const spin = up && p.v >= 0 && p.v < 8;
  if (Math.abs(slip) > SLIP_ON || (D.drv.brake && Math.abs(p.v) > 16) || spin) {
    const rx = p.x - fx * REAR, ry = p.y - fy * REAR;
    const l = { x: rx + fy * TRACK, y: ry - fx * TRACK }, r = { x: rx - fy * TRACK, y: ry + fx * TRACK };
    if (!skidL || !skidR) { skidL = l; skidR = r; }
    else if (dist(l, skidL) > SKID_STEP) {
      D.fx.push({ k: 'skid', x: skidL.x, y: skidL.y, x2: l.x, y2: l.y, col: 0 }, { k: 'skid', x: skidR.x, y: skidR.y, x2: r.x, y2: r.y, col: 0 });
      skidL = l; skidR = r;
    }
  } else skidL = skidR = null;
  // exhaust puffs while the car pulls away (13ד: the gas pedal shows)
  puffT -= dt;
  if (up && p.v >= 0 && p.v < 15 && puffT <= 0) { puffT = spin ? 0.035 : 0.09; D.fx.push({ k: 'smoke', x: p.x - fx * 3.6, y: p.y - fy * 3.6, col: 0x8a7090 }); }
  // forgiving walls (2026-11-17): the car's body is slimmer than it looks, a graze slides along the wall and nudges
  // the nose away from it, and only a fast, near head-on hit is a crash (half the speed, sparks, -20)
  const n = collide(p, CAR_R);
  if (n.nx || n.ny) {
    const nl = Math.hypot(n.nx, n.ny), ux = n.nx / nl, uy = n.ny / nl;
    const headOn = clamp(-(fx * ux + fy * uy) * Math.sign(p.v || 1), 0, 1);
    const vn = p.vx * ux + p.vy * uy; if (vn < 0) { p.vx -= vn * ux; p.vy -= vn * uy; }
    if (headOn > CRASH_DOT && Math.abs(p.v) > CRASH_V) { ev.crash(); D.fx.push({ k: 'burst', x: p.x + fx * 2.8, y: p.y + fy * 2.8, col: 0xffaa40, n: 26, spd: 16 }); p.v *= 0.5; impact(1); D.drift = 0; D.boost = 0; }
    else {
      let tx = -uy, ty = ux; if (tx * fx + ty * fy < 0) { tx = -tx; ty = -ty; }
      if (p.v > 0) p.a = wrapA(p.a + wrapA(Math.atan2(ty, tx) - p.a) * Math.min(1, dt * 5));
      p.v *= 1 - headOn * Math.min(1, dt * 3);
      wallGraze(p.v);
      // first touch: a jolt and a thud; while it slides: sparks from the side that rubs
      if (!onWall && vn < -5) { const k = clamp(-vn / 25, 0.25, 0.8); impact(k * 0.5); ev.bump(k); }
      sparkT -= dt;
      if (Math.abs(p.v) > 12 && sparkT <= 0) { sparkT = 0.05; D.fx.push({ k: 'burst', x: p.x - ux * 1.5, y: p.y - uy * 1.5, col: 0xffc860, n: 2, spd: 7 }); }
    }
    onWall = true;
  } else onWall = false;
  // traffic bumps + near misses
  for (const c of D.npcs) {
    const d = dist(c, p);
    if (d < 4) {   // traffic: you get pushed aside and keep most of your speed; only a fast hit counts as a crash
      const ux = (p.x - c.x) / (d || 1), uy = (p.y - c.y) / (d || 1);
      p.x += ux * (4 - d); p.y += uy * (4 - d);
      if (Math.abs(p.v) > 34) { ev.crash(); D.fx.push({ k: 'burst', x: (p.x + c.x) / 2, y: (p.y + c.y) / 2, col: 0xffaa40, n: 26, spd: 16 }); p.v *= 0.6; p.vx *= 0.6; p.vy *= 0.6; impact(1); }
      else {
        p.v *= 1 - Math.min(1, dt * 2);
        if (bumpCd <= 0 && Math.abs(p.v) > 6) { bumpCd = 0.5; impact(0.4); ev.bump(0.6); D.fx.push({ k: 'burst', x: (p.x + c.x) / 2, y: (p.y + c.y) / 2, col: 0xffc860, n: 5, spd: 8 }); }
      }
      c.s = Math.max(0, c.s - 1);
    } else if (d < 7.8 && Math.abs(p.v) > 29 && c.nm <= 0) { c.nm = 3; ev.near(c.x, c.y); }
    c.nm -= dt;
  }
  bumpCd -= dt;
  // the body follows on springs: the tail swings out in a turn and wags back, the nose lifts on the gas and dives on
  // the brake, the car stretches when it pulls away and squashes when it brakes or hits something
  const acc = clamp((p.v - v0) / dt / 60, -1, 1);
  spring(b.kick, clamp((yaw * p.v) / 100 + slip / 30, -1.2, 1.2) * 0.16, dt);
  spring(b.pitch, acc * 0.1, dt);
  spring(b.sq, acc > 0 ? -0.1 * acc : -0.09 * acc, dt);
  b.sq.x = clamp(b.sq.x, -0.16, 0.32);
}

/** A hit lands (k 0..1): the body squashes and the nose dives, then both spring back; a full hit punches the camera in. */
function impact(k: number): void {
  D.body.sq.v += 7 * k; D.body.pitch.v -= 1.5 * k;
  if (k >= 1) D.zoom -= 9;
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
  // traffic (and the HR minivans) brake for someone on the road in front of them
  if (spd > 0) for (const q of D.peds) {
    if (q.st === 'air') continue;
    const ox = q.x - n.x, oy = q.y - n.y; if (Math.abs(ox) > 9 || Math.abs(oy) > 9) continue;
    const along = ox * dx + oy * dy;
    if (along > 0 && along < 9 && Math.abs(oy * dx - ox * dy) < 2.4) { spd = 0; break; }
  }
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
  let turn = 0;   // yaw rate this step (rad/s), for the body spring
  if (c.rev > 0) { c.rev -= dt; c.v = -15; c.a += 1.6 * dt; }
  else {
    const diff = wrapA(Math.atan2(tgt.y - c.y, tgt.x - c.x) - c.a);
    turn = clamp(diff, -2.8 * dt, 2.8 * dt) / dt;
    c.a = wrapA(c.a + clamp(diff, -2.8 * dt, 2.8 * dt));
    const safe = D.goal === 'home' && dist(c, PLACES.home) < SAFE_R;
    const tv = c.max * (0.3 + 0.7 * Math.max(0, Math.cos(diff))) * (safe ? SAFE_V : 1);
    c.v += clamp(tv - c.v, -100 * dt, 30 * dt);
  }
  c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
  // the same body spring as the player's (visual): the tail swings out in a hard turn and the tires smoke
  const lat = (turn * c.v) / 100;
  spring(c.kick, clamp(lat, -1.2, 1.2) * 0.16, dt);
  c.puff -= dt;
  if (Math.abs(lat) > 0.75 && c.puff <= 0) { c.puff = 0.07; D.fx.push({ k: 'smoke', x: c.x - Math.cos(c.a) * 2.5, y: c.y - Math.sin(c.a) * 2.5, col: 0x8a7090 }); }
  const n = collide(c, CAR_R); if (n.nx || n.ny) c.v *= 1 - Math.min(1, dt * 6);
  // stuck on a corner: back up a bit
  c.chk += dt;
  if (c.chk > 1.1) { if (Math.hypot(c.x - c.cx, c.y - c.cy) < 3.5 && c.rev <= 0) c.rev = 0.45; c.chk = 0; c.cx = c.x; c.cy = c.y; }
  c.taunt -= dt; if (d < 35 && c.taunt <= 0) { c.taunt = 4.5; ev.taunt(c.kind, c.x, c.y); }
  if (d < CATCH_D && c.grace <= 0 && !(D.goal === 'home' && dist(p, PLACES.home) < SAFE_R)) ev.caught(c.kind);
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
  const hr = nearHr();   // the route goes around the closest one
  if (D.avoidHr && hr && dist(hr, D.p) < 90) {
    if (!hrField || hrField.id !== id || D.t - hrField.t > 0.5 || D.t < hrField.t) hrField = { id, f: costField(g.x, g.y, { x: hr.x, y: hr.y, r: HR_R + 10 }), t: D.t };
    f = hrField.f;
  }
  return downhill(f, D.p.x, D.p.y, 10);
}

// ---------- render ----------
const SHOW_GPS_ARROW = false;      // trial 2026-11-17: no arrow; the minimap and the beam over the goal guide you
/** The characters and the building each one is in; h = just above that building's roof (city.ts placeBuilding). */
const RESIDENTS: Array<{ who: Who; place: PlaceId; h: number }> = [
  { who: 'boss', place: 'office', h: 52 }, { who: 'clerk', place: 'store', h: 15 }, { who: 'fiancee', place: 'home', h: 12 },
];
const PIX = 4;                  // the scene's PIX: the 3D frame is rendered at 1/4 of the screen's CSS pixels
/** Draw the world (3D) and its 2D overlays: GPS arrow, HR tag, floating text. `pending` = places whose marker pulses. */
export function renderWorld(pending: PlaceId[], showPlayer = true): void {
  const top = -view.top;
  if (!world) { loadingCard(); return; }
  const f: Frame = {
    w: Math.max(1, Math.round((W * view.scale) / PIX)), h: Math.max(1, Math.round((view.H * view.scale) / PIX)), t: D.t, dusk: D.dusk,
    cam: { x: D.cam.x, y: D.cam.y, zoom: D.zoom },
    cars: [
      ...D.npcs.map((n) => ({ id: n.id, kind: 'npc' as CarKind, x: n.x, y: n.y, a: n.a, color: n.color })),
      ...D.hrs.map((n) => ({ id: n.id, kind: 'hr' as CarKind, x: n.x, y: n.y, a: n.a })),
      ...D.chasers.map((c) => ({ id: c.id, kind: c.kind as CarKind, x: c.x, y: c.y, a: c.a, kick: c.kick.x, roll: c.kick.x * 0.5 })),
      ...(showPlayer ? [{ id: 0, kind: 'player' as CarKind, x: D.p.x, y: D.p.y, a: D.p.a, empty: !!D.walker, kick: D.body.kick.x, roll: D.body.kick.x * 0.5, pitch: D.body.pitch.x, sq: D.body.sq.x, brake: D.drv.brake }] : []),
    ],
    helis: D.heli ? [heliView(D.heli)] : [],
    hrs: D.hrs.map((n) => ({ x: n.x, y: n.y, r: HR_R })),
    picks: D.picks.filter((k) => !k.taken),
    letters: D.letters,
    // only the ones the camera can see (the renderer draws them instanced, PED_MAX at most)
    peds: D.peds.filter((q) => Math.abs(q.x - D.cam.x) < 75 && Math.abs(q.y - D.cam.y) < 100).map((q) => ({ x: q.x, y: q.y, a: q.a, step: q.step, look: q.look, h: q.h, rx: q.rx, s: q.st === 'down' ? clamp((PED_DOWN_S - q.t) / 0.4, 0, 1) : 1 })),
    walker: showPlayer ? D.walker : null,
    pending,
    fx: D.fx.splice(0),
  };
  world.render(f);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(world.canvas, 0, top, W, view.H);
  ctx.restore();
  const scr = (x: number, y: number, h = 0) => { const q = world!.project(x, y, h); return { x: q.x * W, y: top + q.y * view.H }; };
  if (showPlayer) { speedLines(scr(D.p.x, D.p.y), top); for (const c of D.chasers) edgeArrow(scr(c.x, c.y, 2), top); }
  if (showPlayer) { chaseAlarm(top); chaseCall(); }
  // who is inside: the character's face floats over their building (yellow ring and bigger when it is the goal)
  for (const w of RESIDENTS) {
    const pl = PLACES[w.place], goal = pending.includes(w.place), s = scr(pl.i * CELL, pl.j * CELL, w.h);
    if (s.x < -50 || s.x > W + 50 || s.y < top - 30 || s.y > top + view.H + 110) continue;
    const r = goal ? 38 : 30, y = s.y - r - 20 + Math.sin(D.t * 2.6 + pl.i) * 4;
    if (!drawFace(w.who, s.x, y, r, goal ? C.yellow : '#ffffff')) continue;   // portrait still downloading: no badge yet
    ctx.fillStyle = '#0b0b0f'; ctx.beginPath(); ctx.moveTo(s.x - 11, y + r + 3); ctx.lineTo(s.x + 11, y + r + 3); ctx.lineTo(s.x, y + r + 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = goal ? C.yellow : '#ffffff'; ctx.beginPath(); ctx.moveTo(s.x - 8, y + r + 2); ctx.lineTo(s.x + 8, y + r + 2); ctx.lineTo(s.x, y + r + 16); ctx.closePath(); ctx.fill();
  }
  for (const n of D.hrs) {
    const s = scr(n.x, n.y, 5); rr(s.x - 12, s.y - 30, 24, 14, 3, '#c8102e'); ptxt(UI.hrTag,s.x, s.y - 23, 1, '#fff');
    // "!" grows over the minivan that has you in its circle; full size = it has seen you
    if (D.hrSee > 0 && dist(n, D.p) < HR_R + 4) { const k = easeOB(clamp(D.hrSee / HR_SPOT_S, 0, 1)); ptxt('!', s.x, s.y - 44 - 6 * k, 1 + Math.round(2 * k), C.yellow, 'center', '#000'); }
  }
  // pickups fly to their HUD counter in an arc (cash → the wallet, can → the score); the counter pops when they land
  for (const f of D.flies) {
    if (f.sx === undefined || f.sy === undefined) { const s = scr(f.x, f.y, 2); f.sx = s.x; f.sy = s.y; }
    const u = clamp(f.t / FLY_S, 0, 1), e = u * u * (3 - 2 * u), tx = f.kind === 'cash' ? 34 : W / 2, ty = 15;
    const mx = (f.sx + tx) / 2 + (f.sx < tx ? -50 : 50), my = Math.min(f.sy, ty) + (f.sy - ty) * 0.35 - 30;
    const x = (1 - e) * (1 - e) * f.sx + 2 * (1 - e) * e * mx + e * e * tx, y = (1 - e) * (1 - e) * f.sy + 2 * (1 - e) * e * my + e * e * ty;
    const sc = 1.3 - 0.6 * e;
    if (f.kind === 'cash') rr(x - 7 * sc, y - 4 * sc, 14 * sc, 8 * sc, 2, C.money, '#0a2a12', 1.5); else rr(x - 4 * sc, y - 6 * sc, 8 * sc, 12 * sc, 3, C.teal, '#06302e', 1.5);
  }
  // GPS arrow toward the goal, just past the car's nose
  if (SHOW_GPS_ARROW && showPlayer && D.goal && dist(PLACES[D.goal], D.p) > 15) {
    const tgt = gpsTarget(D.goal), a = Math.atan2(tgt.y - D.p.y, tgt.x - D.p.x), s = scr(D.p.x + Math.cos(a) * 7, D.p.y + Math.sin(a) * 7, 1.5);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
    ctx.fillStyle = C.yellow; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -9); ctx.lineTo(-2, 0); ctx.lineTo(-7, 9); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
  }
  // floating text: pops in with an overshoot, rises fast then slows, fades at the end
  for (const fl of D.floats) {
    const s = scr(fl.x, fl.y, 3), k = easeOB(clamp(fl.t / 0.16, 0, 1));
    ctx.save(); ctx.globalAlpha = easeO(clamp((1.2 - fl.t) / 0.3, 0, 1));
    ctx.translate(s.x, s.y - 36 * easeO(fl.t / 1.2)); ctx.scale(k, k);
    ptxt(fl.s, 0, 0, 2, fl.col, 'center', '#000');
    ctx.restore();
  }
}

/** A chaser just appeared: the screen edge flashes for ALARM_S (red / blue for the police, red for the others). */
function chaseAlarm(top: number): void {
  const age = D.t - D.alarm;
  if (age < 0 || age >= ALARM_S) return;
  const on = Math.floor(age * 8) % 2 === 0, a = 0.75 * easeO(1 - age / ALARM_S);
  ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = 14;
  ctx.strokeStyle = D.alarmCop ? (on ? '#ff2030' : '#2a5cff') : on ? '#ff2030' : '#ffffff';
  ctx.strokeRect(0, top, W, view.H);
  ctx.restore();
}
/** Who is after you, big, in the middle of the screen for CALL_S: a tilted band slams in from the left with the
 *  chaser's name in the pixel font, a line under it says what they want. It leaves to the right. */
function chaseCall(): void {
  const age = D.t - D.alarm - CALL_WAIT_S;
  if (age < 0 || age >= CALL_S) return;
  const inK = easeOB(clamp(age / 0.3, 0, 1)), outK = easeO(clamp((age - (CALL_S - 0.3)) / 0.3, 0, 1));
  const name = UI.chaseCall[D.alarmKind] ?? '', line = UI.chaseSub[D.alarmKind] ?? '';
  const p = name.length > 10 ? 3 : 4, blink = Math.floor(age * 8) % 2 === 0 && age < 1.2;
  ctx.save(); ctx.translate(W / 2, 236); ctx.rotate(-0.055); ctx.translate((inK - 1) * (W + 80) + outK * (W + 80), 0);
  ctx.fillStyle = '#000'; ctx.fillRect(-W, -30, W * 2, 84);
  ctx.fillStyle = D.alarmCop ? (blink ? '#2a5cff' : C.red) : C.red; ctx.fillRect(-W, -36, W * 2, 80);
  ctx.fillStyle = C.yellow; ctx.fillRect(-W, 36, W * 2, 8);
  ptxt(name, 0, -8, p, '#ffffff', 'center', 'rgba(0,0,0,.45)');
  txt(line, 0, 24, 13, C.yellow, 'center', 900);
  ctx.restore();
}

// Speed lines: short streaks that fly past the car against its direction, from SPEED_LINES_V up to top speed.
// Math.random on purpose: drawing only, it must not move the seeded gameplay stream (RULES: same seed, same run).
interface Streak { x: number; y: number; life: number; max: number; spd: number }
const streaks: Streak[] = [];
let streakT = 0;
function speedLines(car: { x: number; y: number }, top: number): void {
  const dt = clamp(D.t - streakT, 0, 0.05); streakT = D.t;   // game time: they freeze with the banner
  const sp = Math.hypot(D.p.vx, D.p.vy), k = clamp((sp - SPEED_LINES_V) / (MAX_V - SPEED_LINES_V), 0, 1);
  if (k <= 0) { streaks.length = 0; return; }
  const ux = -D.p.vx / sp, uy = -D.p.vy / sp;
  while (streaks.length < 12) {
    const x = Math.random() * W, y = top + Math.random() * view.H;
    if (Math.hypot(x - car.x, y - car.y) < 90) continue;   // keep the car itself clean
    const max = 0.22 + Math.random() * 0.2;
    streaks.push({ x, y, life: max, max, spd: 420 + Math.random() * 380 });
  }
  ctx.save(); ctx.lineWidth = 2; ctx.lineCap = 'butt';
  for (let i = streaks.length - 1; i >= 0; i--) {
    const s = streaks[i]!; s.life -= dt; s.x += ux * s.spd * dt; s.y += uy * s.spd * dt;
    if (s.life <= 0) { streaks.splice(i, 1); continue; }
    const len = 14 + 34 * k;
    ctx.strokeStyle = `rgba(255,255,255,${(0.4 * k * Math.sin((s.life / s.max) * Math.PI)).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + ux * len, s.y + uy * len); ctx.stroke();
  }
  ctx.restore();
}

/** A chaser that is off screen gets a blinking arrow on the screen edge that points at it (RULES 13ח). */
function edgeArrow(s: { x: number; y: number }, top: number): void {
  const x0 = 20, x1 = W - 20, y0 = 112, y1 = top + view.H - 24;   // below the HUD band (play.ts TL_BAND)
  if (s.x >= 0 && s.x <= W && s.y >= 94 && s.y <= top + view.H) return;
  const cx = W / 2, cy = (y0 + y1) / 2, dx = s.x - cx, dy = s.y - cy;
  const k = Math.min(dx > 0 ? (x1 - cx) / dx : dx < 0 ? (x0 - cx) / dx : Infinity, dy > 0 ? (y1 - cy) / dy : dy < 0 ? (y0 - cy) / dy : Infinity);
  const pulse = 1 + 0.18 * Math.sin(D.t * 12);
  ctx.save(); ctx.translate(cx + dx * k, cy + dy * k); ctx.rotate(Math.atan2(dy, dx)); ctx.scale(pulse, pulse);
  ctx.fillStyle = Math.floor(D.t * 6) % 2 ? '#ff3b3b' : '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
}

/** Shown until lazy/world3d.js has arrived (a slow connection), or when it failed (tap retries). */
function loadingCard(): void {
  ctx.fillStyle = '#0e0e10'; ctx.fillRect(0, -view.top, W, view.H);
  if (worldState === 'error') {
    ptxt(UI.noSignal,W / 2, 290, 3, C.pink, 'center', '#3a2a00');
    txt('The city didn’t load. Tap to retry.', W / 2, 336, 14, '#fff', 'center', 700);
    if (input.taps.length) loadWorld();
    return;
  }
  if (worldState === 'idle') loadWorld();
  ptxt(UI.loading,W / 2, 300, 2, C.yellow, 'center', '#3a2a00');
  const k = (performance.now() / 600) % 1;
  rr(W / 2 - 60, 322, 120, 6, 3, 'rgba(255,255,255,.15)'); rr(W / 2 - 60 + 90 * k, 322, 30, 6, 3, C.pink);
}

/** The on-screen stick where the finger went down. */
export function renderStick(): void {
  const s = D.stick, c = stickPos(); s.ax = c.x; s.ay = c.y;
  // a touch that missed the stick: the ring swells and turns pink for 0.3 s ("it's here"); a grab pops the knob
  const miss = state.t - s.missT, missed = miss >= 0 && miss < 0.3;
  ctx.globalAlpha = missed ? 0.95 : s.on ? 0.6 : 0.32;
  ctx.strokeStyle = missed ? C.pink : '#fff'; ctx.lineWidth = missed ? 5 : 3;
  ctx.beginPath(); ctx.arc(s.ax, s.ay, STICK_R * pop(miss, 0.3, 0.2), 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = s.drift ? '#ffffff' : C.pink;   // white knob = drifting
  ctx.beginPath(); ctx.arc(s.ax + s.dx, s.ay + s.dy, 18 * pop(state.t - s.grabT, 0.14, 0.3), 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- minimap (bottom-right, opposite the stick) ----------
export const MINI = 132;   // was 92: too small to read on a phone (Nadav, 2026-11-17)
const MPAD = 4, MK = (MINI - MPAD * 2) / BSIZE;
const mmx = (x: number): number => MPAD + (x - BMIN) * MK;
let miniBase: HTMLCanvasElement | null = null;
/** The whole city once, at 2x for sharpness: sand, asphalt, blocks, parks and water, curved roads, buildings. */
function miniMap(): HTMLCanvasElement {
  if (miniBase) return miniBase;
  const c = document.createElement('canvas'); c.width = c.height = MINI * 2;
  const g = c.getContext('2d')!; g.scale(2, 2);
  const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
  g.fillStyle = '#e8d49a'; g.fillRect(0, 0, MINI, MINI);
  g.fillStyle = '#55565c'; g.fillRect(MPAD, MPAD, MINI - MPAD * 2, MINI - MPAD * 2);
  g.fillStyle = '#c8c0b0';
  for (const b of blocks) g.fillRect(mmx(b.x - BLOCK / 2 - 1.5), mmx(b.z - BLOCK / 2 - 1.5), (BLOCK + 3) * MK, (BLOCK + 3) * MK);
  for (const q of grounds) {
    g.fillStyle = hex(q.c);
    if (q.oval) { g.beginPath(); g.ellipse(mmx(q.x), mmx(q.z), (q.w / 2) * MK, (q.d / 2) * MK, 0, 0, 7); g.fill(); }
    else g.fillRect(mmx(q.x - q.w / 2), mmx(q.z - q.d / 2), q.w * MK, q.d * MK);
  }
  g.strokeStyle = '#55565c'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const p of paths) { g.lineWidth = p.hw * 2 * MK; g.beginPath(); p.pts.forEach((q, k) => (k ? g.lineTo(mmx(q.x), mmx(q.z)) : g.moveTo(mmx(q.x), mmx(q.z)))); g.stroke(); }
  for (const b of solids) { g.fillStyle = hex(b.c); g.fillRect(mmx(b.x - b.hw), mmx(b.z - b.hd), b.hw * 2 * MK, b.hd * 2 * MK); }
  miniBase = c; return c;
}
/** Minimap with you (white arrow), the goal (pulsing yellow), chasers and the HR minivan (blinking red). */
export function renderMinimap(): void {
  const x0 = W - MINI - 12, y0 = view.H - view.top - MINI - 62;
  rr(x0 - 3, y0 - 3, MINI + 6, MINI + 6, 6, '#0b0b0f', 'rgba(255,255,255,.35)', 1.5);
  ctx.drawImage(miniMap(), x0, y0, MINI, MINI);
  const dot = (x: number, y: number, r: number, col: string): void => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x0 + mmx(x), y0 + mmx(y), r, 0, Math.PI * 2); ctx.fill(); };
  if (D.goal) { const g = PLACES[D.goal]; dot(g.x, g.y, 6 + Math.sin(D.t * 6), '#3a2a00'); dot(g.x, g.y, 4.2 + Math.sin(D.t * 6), C.yellow); }
  const blink = Math.floor(D.t * 6) % 2 ? '#ff3b3b' : '#ffffff';
  for (const c of D.chasers) dot(c.x, c.y, 3.6, blink);
  for (const n of D.hrs) dot(n.x, n.y, 3.6, blink);
  // the helicopter: a rotor cross on a dark disc, blinking red / blue like its flashers (drawn only while it is over the map)
  const hl = D.heli;
  if (hl && hl.x > BMIN && hl.x < BMAX && hl.y > BMIN && hl.y < BMAX) {
    dot(hl.x, hl.y, 5.5, '#0b0b0f');
    ctx.save(); ctx.translate(x0 + mmx(hl.x), y0 + mmx(hl.y)); ctx.rotate(D.t * 9);
    ctx.strokeStyle = Math.floor(D.t * 6) % 2 ? '#ff3b3b' : '#4f8dff'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.translate(x0 + mmx(D.p.x), y0 + mmx(D.p.y)); ctx.rotate(D.p.a + Math.PI / 2);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5.5); ctx.lineTo(-5, 5.5); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
}
