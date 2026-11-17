// The one shared city, ported from the "Sun City Heist" scene (Scene/sun-city-heist.html, chosen 2026-11-17): a 12x12
// grid of blocks with districts (suburbs west, docks east, downtown centre, beach south), superblocks where the grid
// roads give way to a plaza / park / mall / hills / ring road / bends, curved roads and roundabouts.
// This file has no three.js: it describes the city as data (primitives for the renderer in lazy/world3d.ts, solids for
// collision) with its own fixed seed, so the city is the same in every run. On top of the scene we reserve five blocks
// for the story's places (home, office, store, clinic, gas) and build a navigation grid for the GPS and the chasers.
// Units: the scene's world units. x = east, y = the scene's z (south). A car is ~6 long, a road 16 wide.

import { SIGNS } from './content';

export const BLOCK = 40, ROAD = 16, CELL = BLOCK + ROAD, N = 6;
export const BMIN = -N * CELL - CELL / 2 - 6, BMAX = (N - 1) * CELL + CELL / 2 + 6, BMID = (BMIN + BMAX) / 2, BSIZE = BMAX - BMIN;
/** x (or y) of grid road k (k = -N..N). */
export const roadLine = (k: number): number => k * CELL - CELL / 2;

export type MatKey = 'bldg' | 'plain' | 'tree' | 'neon';
export type Prim =
  | { k: 'box'; m: MatKey; w: number; h: number; d: number; x: number; y: number; z: number; ry?: number; col: number; win?: [number, number] }
  | { k: 'cyl'; m: MatKey; rt: number; rb: number; h: number; seg: number; x: number; y: number; z: number; col: number; open?: boolean; sx?: number; sz?: number; win?: [number, number] }
  | { k: 'cone'; m: MatKey; r: number; h: number; seg: number; x: number; y: number; z: number; col: number }
  | { k: 'roof'; w: number; d: number; x: number; y: number; z: number; col: number }
  | { k: 'palm'; x: number; z: number; h: number; ry: number }
  | { k: 'ribbon'; pts: Array<{ x: number; z: number }>; w: number; y: number; col: number }
  | { k: 'sidewalk'; x: number; z: number; col: number }
  | { k: 'sign'; x: number; y: number; z: number; w: number; h: number; ry: number; rx?: number; text: string; bg: string; fg: string };

export interface Solid { x: number; z: number; hw: number; hd: number; c: number }
export interface Ground { x: number; z: number; w: number; d: number; c: number; oval?: boolean }
export type PlaceId = 'home' | 'office' | 'store' | 'clinic' | 'gas';
export interface Place { id: PlaceId; i: number; j: number; side: 'N' | 'S' | 'E' | 'W'; x: number; y: number }

// ---------- the story's places: blocks reserved in the scene's grid, door on the road beside the block ----------
const PLACE_DEF: Array<[PlaceId, number, number, Place['side']]> = [
  ['home', -5, 3, 'E'],     // suburbs, west
  ['office', 2, -3, 'S'],   // downtown, by the ring road
  ['store', -3, -1, 'S'],   // midtown
  ['clinic', 1, 1, 'W'],    // off the way to the store (sick branch detour)
  ['gas', 3, -1, 'W'],      // edge of the docks (quit branch detour)
];
const door = (i: number, j: number, side: Place['side']): { x: number; y: number } => {
  const cx = i * CELL, cz = j * CELL, o = CELL / 2;
  return side === 'N' ? { x: cx, y: cz - o } : side === 'S' ? { x: cx, y: cz + o } : side === 'E' ? { x: cx + o, y: cz } : { x: cx - o, y: cz };
};
export const PLACES = Object.fromEntries(PLACE_DEF.map(([id, i, j, side]) => [id, { id, i, j, side, ...door(i, j, side) }])) as Record<PlaceId, Place>;
const placeAt = (i: number, j: number): Place | undefined => Object.values(PLACES).find((p) => p.i === i && p.j === j);

// ---------- generation (the scene's generator, seeded) ----------
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const prims: Prim[] = [];
export const solids: Solid[] = [];
export const grounds: Ground[] = [];
export const paths: Array<{ pts: Array<{ x: number; z: number }>; hw: number }> = [];
export const blocks: Array<{ x: number; z: number }> = [];
export const lamps: Array<{ x: number; z: number }> = [];

const R = mulberry(19112026);
const pick = <T>(a: readonly T[]): T => a[Math.floor(R() * a.length)]!;
const bodyCols = [0xf2d8b0, 0xe8b8a0, 0xc8dcd0, 0xf0e6d0, 0xd8c8e0, 0xe8d090, 0xb8c8d8, 0xe0a888];
// The scene's four roundabouts were removed (2026-11-17: fewer obstacles on the road); the list stays so adding one
// back is one entry: { x, z, r } at a grid intersection.
export const ISLANDS: Array<{ x: number; z: number; r: number }> = [];
export const FOUNTAIN = { x: -CELL / 2, z: -CELL / 2, r: 9 };
const SUPER = [
  { i: -1, j: -1, w: 2, h: 2, kind: 'park' }, { i: 1, j: 2, w: 2, h: 2, kind: 'plaza' }, { i: -3, j: 2, w: 2, h: 2, kind: 'mall' },
  { i: -6, j: -2, w: 2, h: 4, kind: 'hills' }, { i: 0, j: -5, w: 3, h: 2, kind: 'ring' }, { i: 3, j: 1, w: 2, h: 2, kind: 'bends' },
];
export const inSuper = (i: number, j: number) => SUPER.find((q) => i >= q.i && i < q.i + q.w && j >= q.j && j < q.j + q.h);

function blocked(x: number, z: number, r: number): boolean {
  for (const p of paths) for (const q of p.pts) if ((q.x - x) ** 2 + (q.z - z) ** 2 < (r + p.hw + 2) ** 2) return true;
  for (const o of ISLANDS) if (Math.hypot(o.x - x, o.z - z) < o.r + r + 8) return true;
  return false;
}
const neon = (w: number, h: number, d: number, x: number, y: number, z: number, col: number, ry = 0): void => { prims.push({ k: 'box', m: 'neon', w, h, d, x, y, z, ry, col }); };
const plain = (w: number, h: number, d: number, x: number, y: number, z: number, col: number, ry = 0): void => { prims.push({ k: 'box', m: 'plain', w, h, d, x, y, z, ry, col }); };
const cyl = (m: MatKey, rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, col: number, extra: Partial<Extract<Prim, { k: 'cyl' }>> = {}): void => { prims.push({ k: 'cyl', m, rt, rb, h, seg, x, y, z, col, ...extra }); };

function road(ctrl: Array<[number, number]>, w = ROAD): void {
  // Catmull-Rom through the control points, resampled every ~2 units (the scene uses THREE.CatmullRomCurve3)
  const raw: Array<{ x: number; z: number }> = [];
  for (let s = 0; s < ctrl.length - 1; s++) {
    const p0 = ctrl[Math.max(0, s - 1)]!, p1 = ctrl[s]!, p2 = ctrl[s + 1]!, p3 = ctrl[Math.min(ctrl.length - 1, s + 2)]!;
    for (let k = 0; k < 16; k++) {
      const t = k / 16, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      raw.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  const last = ctrl[ctrl.length - 1]!; raw.push({ x: last[0], z: last[1] });
  const pts = [raw[0]!];
  let acc = 0;
  for (let k = 1; k < raw.length; k++) { acc += Math.hypot(raw[k]!.x - raw[k - 1]!.x, raw[k]!.z - raw[k - 1]!.z); if (acc >= 2 || k === raw.length - 1) { pts.push(raw[k]!); acc = 0; } }
  paths.push({ pts, hw: w / 2 });
  prims.push({ k: 'ribbon', pts, w, y: 0.22, col: 0x55565c });
  for (let k = 2; k < pts.length - 2; k += 4) { const a = pts[k]!, b = pts[k + 1]!; neon(0.4, 0.05, 1.8, a.x, 0.25, a.z, 0xf2d15a, Math.atan2(b.x - a.x, b.z - a.z)); }
}
function groundRect(x: number, z: number, w: number, d: number, col: number, y = 0.08): void { plain(w, 0.16, d, x, y, z, col); grounds.push({ x, z, w, d, c: col }); }
function solid(x: number, z: number, hw: number, hd: number, col: number): void { solids.push({ x, z, hw, hd, c: col }); }
const win = (): [number, number] => [R(), R()];
function box(x: number, z: number, w: number, d: number, h: number, col: number, y0 = 0.4, collide = true): void {
  if (collide && blocked(x, z, Math.min(w, d) / 2)) return;
  prims.push({ k: 'box', m: 'bldg', w, h, d, x, y: y0 + h / 2, z, col, win: win() });
  if (collide) solid(x, z, w / 2, d / 2, col);
}
function roofJunk(x: number, z: number, w: number, d: number, y: number, n: number): void {
  for (let r = 0; r < n; r++) plain(1.5 + R() * 3, 1, 1.5 + R() * 3, x + (R() - 0.5) * (w - 5), y + 0.5, z + (R() - 0.5) * (d - 5), pick([0x8a8a96, 0x5a5a66, 0xb0a890]));
}
function tower(x: number, z: number, w: number, d: number, h: number, col: number): void {
  if (blocked(x, z, Math.max(w, d) / 2)) return;
  box(x, z, w, d, h, col); roofJunk(x, z, w, d, h + 0.4, 2 + R() * 3);
  if (R() < 0.5) neon(w + 0.3, 0.35, d + 0.3, x, h + 0.4, z, 0xf8f4ec);
  if (R() < 0.18 && w > 12 && d > 12) neon(w * 0.4, 0.15, d * 0.3, x, h + 0.5, z, 0x3ab8e0);
  else if (R() < 0.15) cyl('neon', Math.min(w, d) * 0.3, Math.min(w, d) * 0.3, 0.2, 16, x, h + 0.5, z, 0xffd23d);
}
function stepped(x: number, z: number, w: number, d: number, h: number, col: number): void {
  if (blocked(x, z, Math.max(w, d) / 2)) return;
  let y = 0.4;
  for (let k = 0; k < 3; k++) { const hh = h * (k === 0 ? 0.5 : 0.25), ww = w * (1 - k * 0.25), dd = d * (1 - k * 0.25); box(x, z, ww, dd, hh, col, y, k === 0); neon(ww + 0.3, 0.35, dd + 0.3, x, y + hh, z, 0xf8f4ec); y += hh; }
  cyl('neon', 0.15, 0.15, 8, 4, x, y + 4, z, 0xd02a2a);
}
function round(x: number, z: number, r: number, h: number, col: number): void {
  if (blocked(x, z, r)) return;
  cyl('bldg', r, r, h, 20, x, 0.4 + h / 2, z, col, { win: win() }); solid(x, z, r * 0.9, r * 0.9, col);
  cyl('neon', r * 0.6, r * 0.6, 0.2, 20, x, h + 0.5, z, 0xffd23d);
  cyl('neon', r + 0.2, r + 0.2, 0.35, 20, x, h + 0.4, z, 0xf8f4ec, { open: true });
}
function lshape(x: number, z: number, s: number, h: number, col: number): void {
  if (blocked(x, z, s / 2)) return;
  const t = s * 0.45, sx = R() < 0.5 ? 1 : -1, sz = R() < 0.5 ? 1 : -1;
  box(x, z + (sz * (s - t)) / 2, s, t, h, col);
  box(x + (sx * (s - t)) / 2, z - (sz * t) / 2, t, s - t, h, col);
  roofJunk(x, z + (sz * (s - t)) / 2, s, t, h + 0.4, 2);
  if (R() < 0.6) plain(s * 0.5, 0.3, s * 0.5, x - sx * s * 0.22, 0.3, z - sz * s * 0.22, 0x6a9a42);
}
function house(x: number, z: number, w: number, d: number): void {
  if (blocked(x, z, Math.max(w, d) / 2)) return;
  const wall = pick([0xf4ece0, 0xe8d8b8, 0xd8e4ec, 0xf0d8c8, 0xe0e8d0]), roof = pick([0xb8502e, 0x9a4030, 0x5a6a7a, 0x7a5040, 0xc86a3a]);
  const h = 3.2 + R() * 1.6;
  box(x, z, w, d, h, wall);
  prims.push({ k: 'roof', w: w + 1, d: d + 1, x, y: 0.4 + h + 1.3, z, col: roof });
}
function container(x: number, z: number): void {
  if (blocked(x, z, 3.5)) return;
  const col = pick([0xc83a2a, 0x2a6ac8, 0x2a9a5a, 0xe8a02a, 0x7a4ac8, 0xd8d8d8]);
  plain(2.6, 2.6, 7, x, 1.4, z, col); solid(x, z, 1.3, 3.5, col);
}
function umbrella(x: number, z: number): void {
  if (blocked(x, z, 2)) return;
  prims.push({ k: 'cone', m: 'plain', r: 2.2, h: 1, seg: 8, x, y: 3, z, col: pick([0xe83a3a, 0x2a8ae8, 0xf0d02a, 0xffffff]) });
  cyl('neon', 0.08, 0.08, 3, 4, x, 1.5, z, 0xffffff);
}
function palm(x: number, z: number): void {
  if (blocked(x, z, 1)) return;
  prims.push({ k: 'palm', x, z, h: 9 + R() * 5, ry: R() * 6 });
}
function arc(cx: number, cz: number, r: number, a0: number, a1: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let k = 0; k <= 16; k++) { const a = a0 + ((a1 - a0) * k) / 16; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return pts;
}

// ---------- the story's buildings ----------
function sign(x: number, y: number, z: number, w: number, h: number, text: string, bg: string, fg: string, ry = 0, rx = -Math.PI / 2): void {
  prims.push({ k: 'sign', x, y, z, w, h, ry, rx, text, bg, fg });
}
function placeBuilding(p: Place): void {
  const cx = p.i * CELL, cz = p.j * CELL, H = BLOCK / 2;
  prims.push({ k: 'sidewalk', x: cx, z: cz, col: 0xc8c0b0 });
  // the building's front faces the door; (fx, fz) points from the block centre to the door
  const fx = Math.sign(p.x - cx), fz = Math.sign(p.y - cz);
  const front = (dist: number) => ({ x: cx + fx * dist, z: cz + fz * dist });
  switch (p.id) {
    case 'home': {
      groundRect(cx, cz, BLOCK - 2, BLOCK - 2, 0x7aaa4e);
      box(cx - fx * 4, cz - fz * 4, 22, 20, 5, 0xf4ece0);
      prims.push({ k: 'roof', w: 23, d: 21, x: cx - fx * 4, y: 0.4 + 5 + 1.3, z: cz - fz * 4, col: 0xc86a3a });
      const dw = front(H - 6); plain(fx ? 12 : 7, 0.2, fx ? 7 : 12, dw.x, 0.2, dw.z, 0xb8b0a0);   // driveway
      cyl('neon', 0.15, 0.15, 1.6, 4, dw.x + (fx ? 0 : 6), 0.8, dw.z + (fx ? 6 : 0), 0x5a5a60);       // mailbox post
      palm(cx + 14, cz - 14); palm(cx - 14, cz + 14);
      sign(cx - fx * 4, 9.5, cz - fz * 4, 12, 4, SIGNS.home,'#ff3fa4', '#ffffff');
      break;
    }
    case 'office': {
      groundRect(cx, cz, BLOCK - 1, BLOCK - 1, 0x48484e);
      box(cx, cz, 32, 32, 46, 0xb8c8d8); roofJunk(cx, cz, 32, 32, 46.4, 4);
      neon(32.3, 0.35, 32.3, cx, 46.4, cz, 0xf8f4ec);
      sign(cx, 47, cz, 26, 6, SIGNS.office,'#1b2a44', '#7fd0ff');
      break;
    }
    case 'store': {
      groundRect(cx, cz, BLOCK - 1, BLOCK - 1, 0x48484e);
      box(cx - fx * 5, cz - fz * 5, 34, 26, 9, 0x3a2a5a);
      neon(34.3, 0.5, 26.3, cx - fx * 5, 9.6, cz - fz * 5, 0xff3fa4);
      sign(cx - fx * 5, 10.2, cz - fz * 5, 24, 7, SIGNS.store,'#ff3fa4', '#fff6b0');
      // launch-day line along the front of the store
      const along = fx ? { x: 0, z: 1 } : { x: 1, z: 0 }, row = front(H - 3);
      for (let k = 0; k < 18; k++) {
        const s = (k - 8.5) * 2.1 + (R() - 0.5) * 0.6;
        cyl('plain', 0.55, 0.6, 1.8, 6, row.x + along.x * s + (R() - 0.5) * 0.8, 1.3, row.z + along.z * s + (R() - 0.5) * 0.8, pick([0xff3fa4, 0x2fd1c8, 0xffd23f, 0x9b7fd1, 0xf2a65a, 0xe8e8e8, 0x5ce67a]));
      }
      break;
    }
    case 'clinic': {
      groundRect(cx, cz, BLOCK - 1, BLOCK - 1, 0xd8cfc0);
      box(cx - fx * 4, cz - fz * 4, 28, 26, 11, 0xf4f4f0);
      neon(10, 0.3, 3, cx - fx * 12, 11.6, cz - fz * 12, 0xd02a2a); neon(3, 0.3, 10, cx - fx * 12, 11.6, cz - fz * 12, 0xd02a2a);   // red cross at the back
      sign(cx + fx * 3, 11.7, cz + fz * 3, 24, 6, 'DR. FEELGOOD', '#1b4f8a', '#ffffff');
      break;
    }
    case 'gas': {
      groundRect(cx, cz, BLOCK - 1, BLOCK - 1, 0x6a6a70);
      box(cx - fx * 12, cz - fz * 12, fx ? 10 : 24, fx ? 24 : 10, 5, 0xf0e6d0);           // shop at the back
      const cn = front(2);
      plain(fx ? 18 : 26, 0.6, fx ? 26 : 18, cn.x, 6.2, cn.z, 0xd02a2a);                 // canopy
      neon(fx ? 18.2 : 26.2, 0.2, fx ? 26.2 : 18.2, cn.x, 5.85, cn.z, 0xfff6d8);
      for (const s of [-8, 8]) {
        const px = cn.x + (fx ? 0 : s), pz = cn.z + (fx ? s : 0);
        cyl('plain', 0.4, 0.4, 6, 8, px, 3, pz, 0xe8e8e8);
        plain(1.4, 1.6, 1.4, px + (fx ? -3 : 0), 1.2, pz + (fx ? 0 : -3), 0x2a6ac8);    // pump
        solid(px + (fx ? -3 : 0), pz + (fx ? 0 : -3), 0.8, 0.8, 0x2a6ac8);
      }
      sign(cn.x, 6.9, cn.z, 18, 8, 'GAS', '#d02a2a', '#ffffff');
      break;
    }
  }
}

// winding road through the west hills (suburbs)
road([[-308, -150], [-310, -120], [-334, -92], [-326, -58], [-290, -40], [-284, -10], [-326, 14], [-336, 44], [-308, 70], [-308, 94]]);
road([[-290, -40], [-270, -30], [-245, -28]]);
// ring road (north): oval loop joined to the grid on both sides
{
  const cx = 56, cz = -252, rx = 52, rz = 28, pts: Array<[number, number]> = [];
  for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); }
  road(pts, ROAD - 2);
  road([[-36, -252], [-28, -252], [-10, -252], [cx - rx + 2, -252]], ROAD - 2);
  road([[cx + rx - 2, -252], [122, -252], [140, -252], [148, -252]], ROAD - 2);
  road([[cx, -316], [cx, -308], [cx, -296], [cx, cz - rz + 2]], ROAD - 2);
}
// sweeping bends in the docks, a lazy S-curve along the beach
road(arc(252, 140, 56, Math.PI, Math.PI * 1.5));
road(arc(140, 28, 56, 0, Math.PI * 0.5));
road([[-196, 252], [-150, 236], [-100, 262], [-50, 240], [0, 262], [56, 252]]);
// roundabouts
for (const o of ISLANDS) {
  cyl('plain', o.r, o.r + 0.4, 0.6, 28, o.x, 0.3, o.z, 0xe8e0d0);
  cyl('plain', o.r - 0.8, o.r - 0.8, 0.7, 28, o.x, 0.35, o.z, 0x6a9a42);
  palm(o.x, o.z);
  grounds.push({ x: o.x, z: o.z, w: o.r * 2, d: o.r * 2, c: 0x6a9a42, oval: true });
  solid(o.x, o.z, o.r * 0.8, o.r * 0.8, 0x6a9a42);
  for (let k = 0; k < 24; k++) { const an = (k / 24) * Math.PI * 2, rr = o.r + 5; if (k % 2) neon(0.4, 0.05, 1.4, o.x + Math.cos(an) * rr, 0.05, o.z + Math.sin(an) * rr, 0xf4f4f0, -an); }
}
// superblocks
for (const q of SUPER) {
  const x = (q.i + (q.w - 1) / 2) * CELL, z = (q.j + (q.h - 1) / 2) * CELL, S = 2 * CELL - ROAD + 3, SW = q.w * CELL - ROAD + 3, SH = q.h * CELL - ROAD + 3;
  if (q.kind === 'mall') {
    groundRect(x, z, SW, SH, 0x48484e, 0.1);
    for (let a = -5; a <= 5; a++) for (const sz of [-1, 1]) neon(0.3, 0.05, 5, x + a * 7, 0.2, z + sz * (SH / 2 - 8), 0xf4f4f0);
    const mw = SW - 34, md = SH - 34;
    box(x, z, mw, md, 9, 0xe8d8c8);
    neon(mw + 0.4, 0.5, md + 0.4, x, 9.6, z, 0xd02a2a);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) neon(8, 0.2, 8, x + (dx * mw) / 4, 9.6, z + (dz * md) / 4, 0x8ad8ff);
    plain(14, 2, 5, x, 10.5, z, 0xffd23d);
    for (let k = 0; k < 8; k++) palm(x + (R() - 0.5) * (SW - 8), z + (R() < 0.5 ? -1 : 1) * (SH / 2 - 3));
    continue;
  }
  if (q.kind === 'ring' || q.kind === 'bends') {
    const ring = q.kind === 'ring';
    groundRect(x, z, SW, SH, ring ? 0x7aaa4e : 0x8a8478, 0.1);
    for (let a = 0; a < Math.round(SW / 13); a++) for (let b = 0; b < Math.round(SH / 13); b++) {
      const bx = x - SW / 2 + 7 + a * 13, bz = z - SH / 2 + 7 + b * 13, r = R();
      if (ring) { if (r < 0.55) tower(bx, bz, 8 + R() * 3, 8 + R() * 3, 5 + R() * 10, pick(bodyCols)); else if (r < 0.8) palm(bx, bz); }
      else if (r < 0.5) container(bx, bz); else if (r < 0.65) round(bx, bz, 4.5, 6 + R() * 3, 0xe8e8e0);
    }
    if (ring) { cyl('neon', 9, 9, 0.1, 24, 56, 0.25, -252, 0x3a9ad8); grounds.push({ x: 56, z: -252, w: 18, d: 18, c: 0x3a9ad8, oval: true }); }
    continue;
  }
  if (q.kind === 'hills') {
    groundRect(x, z, SW, SH, 0x7aaa4e, 0.1);
    for (let a = 0; a < 7; a++) for (let b = 0; b < 14; b++) {
      const hx = x - SW / 2 + 8 + (a * (SW - 16)) / 6 + (R() - 0.5) * 4, hz = z - SH / 2 + 8 + (b * (SH - 16)) / 13 + (R() - 0.5) * 4;
      if (R() < 0.75) house(hx, hz, 7 + R() * 3, 6 + R() * 3); else palm(hx, hz);
    }
    continue;
  }
  if (q.kind === 'plaza') {
    groundRect(x, z, S, S, 0xd8cfc0, 0.1);
    for (let a = -4; a < 4; a++) for (let b = -4; b < 4; b++) if ((a + b) & 1) plain(S / 8, 0.04, S / 8, x + ((a + 0.5) * S) / 8, 0.2, z + ((b + 0.5) * S) / 8, 0xc8bca8);
    cyl('plain', FOUNTAIN.r, FOUNTAIN.r + 0.5, 1.2, 28, x, 0.6, z, 0xe8e0d0);
    cyl('neon', FOUNTAIN.r - 1, FOUNTAIN.r - 1, 0.1, 28, x, 1.25, z, 0x4ac0f0);
    cyl('plain', 1.2, 1.6, 4, 12, x, 2, z, 0xe8e0d0);
    cyl('neon', 2.6, 0.6, 0.8, 12, x, 4.3, z, 0x8ad8ff);
    solid(x, z, FOUNTAIN.r * 0.85, FOUNTAIN.r * 0.85, 0xe8e0d0);
    for (let k = 0; k < 10; k++) { const an = (k / 10) * Math.PI * 2; palm(x + Math.cos(an) * 30, z + Math.sin(an) * 30); }
  } else {
    groundRect(x, z, S, S, 0x6a9a42, 0.1);
    cyl('neon', 1, 1, 0.1, 32, x + 6, 0.2, z - 4, 0x3a9ad8, { sx: 22, sz: 14 });
    grounds.push({ x: x + 6, z: z - 4, w: 44, d: 28, c: 0x3a9ad8, oval: true });
    for (let k = 0; k < 48; k++) { const an = (k / 48) * Math.PI * 2; plain(3.5, 0.06, 3.5, x + Math.cos(an) * 40, 0.2, z + Math.sin(an) * 40, 0xd8c89a, an); }
    for (let k = 0; k < 16; k++) palm(x + (R() - 0.5) * 90, z + (R() - 0.5) * 90);
  }
}
// the ordinary blocks, by district
for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
  const cx = i * CELL, cz = j * CELL;
  blocks.push({ x: cx, z: cz });
  if (inSuper(i, j)) continue;
  const pl = placeAt(i, j);
  if (pl) { placeBuilding(pl); continue; }
  prims.push({ k: 'sidewalk', x: cx, z: cz, col: 0xc8c0b0 });
  const H = BLOCK / 2;
  const central = Math.max(Math.abs(i + 0.5), Math.abs(j + 0.5)) <= 2.5;   // the green heart around the central park
  if (central && R() < 0.3) {                      // pocket parks with a pond
    groundRect(cx, cz, BLOCK, BLOCK, 0x6a9a42);
    if (R() < 0.6) { cyl('neon', 7, 7, 0.1, 24, cx, 0.2, cz, 0x3a9ad8); grounds.push({ x: cx, z: cz, w: 14, d: 14, c: 0x3a9ad8, oval: true }); }
    for (let p = 0; p < 6; p++) palm(cx + (R() - 0.5) * 30, cz + (R() - 0.5) * 30);
    continue;
  }
  if (i <= -4 || central) {                        // suburbs (west) and the centre: lawns + houses with pitched roofs
    groundRect(cx, cz, BLOCK - 2, BLOCK - 2, 0x7aaa4e);
    const n = R() < 0.5 ? 2 : 3, s = (BLOCK - 2) / n;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      if (n === 3 && a === 1 && b === 1) { if (R() < 0.6) neon(6, 0.1, 4, cx, 0.2, cz, 0x4ac0f0); continue; }
      const hx = cx - H + 1 + s * (a + 0.5), hz = cz - H + 1 + s * (b + 0.5);
      house(hx, hz, s * 0.55 + R() * 2, s * 0.5 + R() * 2);
      if (R() < 0.3) palm(hx + s * 0.35, hz + s * 0.35);
    }
    continue;
  }
  if (i >= 3) {                                    // industrial / docks (east)
    groundRect(cx, cz, BLOCK - 1, BLOCK - 1, 0x8a8478);
    const r = R();
    if (r < 0.4) {
      const w = BLOCK - 6, d = BLOCK * 0.55, col = pick([0x8a9aa8, 0x9a8a7a, 0xa8a8a0]), wh = 7 + R() * 3;
      box(cx, cz - H + d / 2 + 3, w, d, wh, col);
      for (let k = 0; k < 5; k++) plain(w, 0.3, 0.6, cx, wh + 0.6, cz - H + 3 + ((k + 0.5) * d) / 5, 0x6a7a88);
      for (let k = 0; k < 3; k++) container(cx - 12 + k * 12, cz + 12);
    } else if (r < 0.75) {
      for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) if (R() < 0.85) {
        const x = cx - H + 6 + a * 9, z = cz - H + 7 + b * 12; container(x, z);
        if (R() < 0.4) plain(2.6, 2.6, 7, x, 4, z, pick([0xc83a2a, 0x2a6ac8, 0xe8a02a]));
      }
    } else for (const [dx, dz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]] as const) round(cx + dx, cz + dz, 6, 6 + R() * 4, 0xe8e8e0);
    continue;
  }
  if (j === N - 1) {                               // beach strip (south edge)
    groundRect(cx, cz, BLOCK + 3, BLOCK + 3, 0xecd8a0, 0.1);
    for (let k = 0; k < 6; k++) umbrella(cx + (R() - 0.5) * 32, cz + (R() - 0.5) * 32);
    for (let k = 0; k < 3; k++) palm(cx + (R() - 0.5) * 34, cz + (R() - 0.5) * 34);
    if (R() < 0.5) box(cx, cz - 12, 10, 6, 3, 0xf0a8c8);
    continue;
  }
  const down = Math.max(Math.abs(i + 0.5), Math.abs(j + 0.5)) <= 3;   // downtown vs midtown
  if (R() < (down ? 0.06 : 0.14)) {
    groundRect(cx, cz, BLOCK, BLOCK, 0x6a9a42);
    if (R() < 0.6) { cyl('neon', 7, 7, 0.1, 24, cx, 0.2, cz, 0x3a9ad8); grounds.push({ x: cx, z: cz, w: 14, d: 14, c: 0x3a9ad8, oval: true }); }
    for (let p = 0; p < 5; p++) palm(cx + (R() - 0.5) * 30, cz + (R() - 0.5) * 30);
    continue;
  }
  const col = () => pick(bodyCols);
  if (down) {
    const r = R();
    if (r < 0.25) stepped(cx, cz, BLOCK - 6, BLOCK - 6, 26 + R() * 14, col());
    else if (r < 0.45) round(cx, cz, BLOCK / 2 - 4, 18 + R() * 16, col());
    else if (r < 0.65) lshape(cx, cz, BLOCK - 4, 14 + R() * 14, col());
    else for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) tower(cx - H / 2 + a * H, cz - H / 2 + b * H, H - 3 - R() * 3, H - 3 - R() * 3, 12 + R() * 20, col());
  } else {
    const r = R();
    if (r < 0.2) lshape(cx, cz, BLOCK - 4, 6 + R() * 10, col());
    else if (r < 0.32) {
      groundRect(cx, cz, BLOCK - 2, BLOCK - 2, 0x48484e);
      for (let k = 0; k < 6; k++) neon(0.3, 0.05, 5, cx - 15 + k * 6, 0.2, cz - 8, 0xf4f4f0);
      box(cx, cz + 12, BLOCK - 8, 10, 5, col());
    } else {
      const sub = R() < 0.5 ? 1 : 2, s = BLOCK / sub;
      for (let a = 0; a < sub; a++) for (let b = 0; b < sub; b++) tower(cx - H + s * (a + 0.5), cz - H + s * (b + 0.5), s - 2 - R() * 4, s - 2 - R() * 4, 5 + R() * 12, col());
    }
  }
  if (R() < 0.6) palm(cx + H, cz + H);
  if (R() < 0.4) palm(cx - H, cz + H);
}
// map border: sand strip and a red/white crash barrier (the sea itself is drawn by the renderer)
plain(BSIZE + 30, 0.5, BSIZE + 30, BMID, -0.45, BMID, 0xe8d49a);
for (let t = BMIN; t < BMAX; t += 4) {
  const col = Math.round((t - BMIN) / 4) % 2 ? 0xd02a2a : 0xf4f4f0;
  for (const [x, z, ry] of [[t + 2, BMIN - 1.5, 0], [t + 2, BMAX + 1.5, 0], [BMIN - 1.5, t + 2, Math.PI / 2], [BMAX + 1.5, t + 2, Math.PI / 2]] as const) neon(4, 1.4, 1, x, 0.7, z, col, ry);
}
// crosswalks at every grid intersection
for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
  const ix = roadLine(i), iz = roadLine(j);
  for (let k = -2; k <= 2; k++) for (const sg of [-1, 1]) {
    neon(1.2, 0.05, 3, ix + k * 2.6, 0.03, iz + sg * (ROAD / 2 + 2.5), 0xf4f4f0);
    neon(3, 0.05, 1.2, ix + sg * (ROAD / 2 + 2.5), 0.03, iz + k * 2.6, 0xf4f4f0);
  }
}
// street lamps on two corners of every block
for (const b of blocks) for (const [dx, dz] of [[1, 1], [-1, -1]] as const) {
  const x = b.x + dx * (BLOCK / 2 + 1), z = b.z + dz * (BLOCK / 2 + 1);
  cyl('neon', 0.12, 0.15, 7, 6, x, 3.5, z, 0x5a5a60);
  lamps.push({ x, z });
}

// ---------- collision: push a circle out of the solids (spatial hash, 16-unit buckets) ----------
const BK = 16, BN = Math.ceil(BSIZE / BK) + 1;
const bucket: number[][] = Array.from({ length: BN * BN }, () => []);
solids.forEach((s, idx) => {
  const x0 = Math.floor((s.x - s.hw - 4 - BMIN) / BK), x1 = Math.floor((s.x + s.hw + 4 - BMIN) / BK);
  const z0 = Math.floor((s.z - s.hd - 4 - BMIN) / BK), z1 = Math.floor((s.z + s.hd + 4 - BMIN) / BK);
  for (let a = Math.max(0, x0); a <= Math.min(BN - 1, x1); a++) for (let b = Math.max(0, z0); b <= Math.min(BN - 1, z1); b++) bucket[a * BN + b]!.push(idx);
});
const near = (x: number, z: number): number[] => {
  const a = Math.floor((x - BMIN) / BK), b = Math.floor((z - BMIN) / BK);
  return a < 0 || b < 0 || a >= BN || b >= BN ? [] : bucket[a * BN + b]!;
};
/** The scene's collision: AABB push-out plus the map border. Returns the push normal ({0,0} = no hit). */
export function collide(o: { x: number; y: number }, r: number): { nx: number; ny: number } {
  let nx = 0, ny = 0;
  for (const k of near(o.x, o.y)) {
    const b = solids[k]!, hx = b.hw + r, hz = b.hd + r, dx = o.x - b.x, dz = o.y - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      if (hx - Math.abs(dx) < hz - Math.abs(dz)) { o.x = b.x + Math.sign(dx) * hx; nx = Math.sign(dx); }
      else { o.y = b.z + Math.sign(dz) * hz; ny = Math.sign(dz); }
    }
  }
  const lo = BMIN + r, hi = BMAX - r;
  if (o.x < lo) { o.x = lo; nx = 1; } if (o.x > hi) { o.x = hi; nx = -1; }
  if (o.y < lo) { o.y = lo; ny = 1; } if (o.y > hi) { o.y = hi; ny = -1; }
  return { nx, ny };
}
export function solidAt(x: number, y: number, pad = 0): boolean {
  if (x < BMIN || y < BMIN || x > BMAX || y > BMAX) return true;
  for (const k of near(x, y)) { const b = solids[k]!; if (Math.abs(x - b.x) < b.hw + pad && Math.abs(y - b.z) < b.hd + pad) return true; }
  return false;
}

// ---------- navigation grid: drivable cells, clearance, cost fields ----------
export const NAV = 3;                                    // units per nav cell
export const NW = Math.ceil(BSIZE / NAV);
const CAR_PAD = 2.4;
export const navOpen = new Uint8Array(NW * NW);          // 1 = a car fits here
const clear = new Uint8Array(NW * NW);                   // cells to the nearest wall (capped)
export const cellOf = (x: number, y: number): number => {
  const a = Math.min(NW - 1, Math.max(0, Math.floor((x - BMIN) / NAV))), b = Math.min(NW - 1, Math.max(0, Math.floor((y - BMIN) / NAV)));
  return b * NW + a;
};
export const cellX = (c: number): number => BMIN + ((c % NW) + 0.5) * NAV;
export const cellY = (c: number): number => BMIN + (Math.floor(c / NW) + 0.5) * NAV;
{
  const q: number[] = [];
  for (let c = 0; c < NW * NW; c++) { const ok = !solidAt(cellX(c), cellY(c), CAR_PAD); navOpen[c] = ok ? 1 : 0; clear[c] = ok ? 255 : 0; if (!ok) q.push(c); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!, x = c % NW, d = clear[c]!;
    if (d >= 6) continue;
    for (const n of [x > 0 ? c - 1 : -1, x < NW - 1 ? c + 1 : -1, c - NW, c + NW]) if (n >= 0 && n < NW * NW && clear[n]! > d + 1) { clear[n] = d + 1; q.push(n); }
  }
}
const STEP = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [-1, 1, 14], [1, -1, 14], [-1, -1, 14]] as const;
// Dial's algorithm on a circular bucket queue in typed arrays (no allocation per node: the chasers refresh their
// field to the player a few times a second). Edge cost ≤ 14 + 36, so 64 buckets cover every pending distance.
const QB = 64, POOL = NW * NW * 6;
const qNode = new Int32Array(POOL), qNext = new Int32Array(POOL), qHead = new Int32Array(QB);
// As in the scene, only buildings are solid: lawns and sidewalks are drivable. Routes (GPS, chasers) still keep to the
// roads: a cell inside a regular block (its sidewalk square) costs 4x, so cutting across one only pays off at a corner.
export const offroad = new Uint8Array(NW * NW);
for (let c = 0; c < NW * NW; c++) {
  const x = cellX(c), y = cellY(c), i = Math.round(x / CELL), j = Math.round(y / CELL);
  offroad[c] = i >= -N && i < N && j >= -N && j < N && !inSuper(i, j) && Math.abs(x - i * CELL) < (BLOCK + 3) / 2 && Math.abs(y - j * CELL) < (BLOCK + 3) / 2 ? 1 : 0;
}
const enterCost = new Int32Array(NW * NW);
for (let c = 0; c < NW * NW; c++) enterCost[c] = Math.max(0, 3 - clear[c]!) * 12 + offroad[c]! * 30;
/** Cost to reach `goal` from every cell (cells near walls cost more, so routes keep to mid-road). `avoid` makes the
 *  cells within r of a point very expensive (the GPS steering you around the HR minivan). */
export function costField(gx: number, gy: number, avoid?: { x: number; y: number; r: number }): Int32Array {
  const extra = avoid ? (c: number) => (Math.hypot(cellX(c) - avoid.x, cellY(c) - avoid.y) < avoid.r ? 400 : 0) : null;
  const dist = new Int32Array(NW * NW).fill(0x7fffffff);
  const start = nearestOpen(cellOf(gx, gy));
  qHead.fill(-1);
  let used = 0, pending = 1;
  qNode[0] = start; qNext[0] = -1; qHead[0] = 0; used = 1; dist[start] = 0;
  for (let d = 0; pending > 0; d++) {
    const b = d % QB;
    let e = qHead[b]!; qHead[b] = -1;
    while (e >= 0) {
      const c = qNode[e]!, nextE = qNext[e]!; pending--;
      if (dist[c] === d) {
        const x = c % NW, y = (c - x) / NW;
        for (let s = 0; s < 8; s++) {
          const st = STEP[s]!, dx = st[0], dy = st[1];
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= NW || ny >= NW) continue;
          const n = ny * NW + nx; if (!navOpen[n]) continue;
          if (dx && dy && (!navOpen[y * NW + nx] || !navOpen[ny * NW + x])) continue;   // no corner cutting
          const nd = d + st[2] + enterCost[n]! + (extra ? extra(n) : 0);
          if (nd < dist[n]! && used < POOL) {
            dist[n] = nd; const nb = nd % QB;
            qNode[used] = n; qNext[used] = qHead[nb]!; qHead[nb] = used; used++; pending++;
          }
        }
      }
      e = nextE;
    }
  }
  return dist;
}
/** The nearest drivable cell (spiral search). */
export function nearestOpen(c: number): number {
  if (navOpen[c] && !offroad[c]) return c;
  const x0 = c % NW, y0 = Math.floor(c / NW);
  for (let r = 1; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= NW || y >= NW) continue;
    const n = y * NW + x; if (navOpen[n] && clear[n]! >= 2 && !offroad[n]) return n;
  }
  return c;
}
/** Follow a cost field downhill up to `steps` cells from (x, y) and return the farthest point on that route that is
 *  still in a straight line of sight (with a car's width) from (x, y), so steering at it never cuts a corner. */
export function downhill(field: Int32Array, x: number, y: number, steps: number): { x: number; y: number } {
  let c = nearestOpen(cellOf(x, y));
  let out = { x: cellX(c), y: cellY(c) };
  const from = { x, y };
  for (let s = 0; s < steps; s++) {
    const cx = c % NW, cy = (c - cx) / NW; let best = c, bd = field[c]!;
    for (const [dx, dy] of STEP) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= NW || ny >= NW) continue;
      const n = ny * NW + nx; if (field[n]! < bd) { bd = field[n]!; best = n; }
    }
    if (best === c) break;
    c = best;
    const p = { x: cellX(c), y: cellY(c) };
    if (s > 0 && !roadLine2(from, p)) break;
    out = p;
  }
  return out;
}
/** Nearest roomy road point to (x, y). */
export function roadNear(x: number, y: number): { x: number; y: number } { const c = nearestOpen(cellOf(x, y)); return { x: cellX(c), y: cellY(c) }; }
/** A straight drive from a to b that stays clear of buildings (with a car's width) and off the blocks' lawns. */
function roadLine2(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 2), startOff = offroad[cellOf(a.x, a.y)];
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, y = a.y + ((b.y - a.y) * i) / n;
    if (solidAt(x, y, CAR_PAD) || (!startOff && offroad[cellOf(x, y)])) return false;
  }
  return true;
}
/** Line of sight: no solid between a and b (`pad` widens the line, e.g. to a car's half-width). */
export function los(a: { x: number; y: number }, b: { x: number; y: number }, pad = 0): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 2);
  for (let i = 1; i < n; i++) if (solidAt(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, pad)) return false;
  return true;
}

// ---------- the grid road graph for traffic (nodes = grid intersections, k = -N..N) ----------
export type Node2 = [number, number];
const islandAt = (i: number, j: number): boolean => ISLANDS.some((o) => Math.abs(o.x - roadLine(i)) < 1 && Math.abs(o.z - roadLine(j)) < 1);
const edgeCache = new Map<string, boolean>();
/** A straight grid road between two neighbouring intersections that a car can drive end to end. */
export function edgeOpen(a: Node2, b: Node2): boolean {
  const key = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a}|${b}` : `${b}|${a}`;
  const hit = edgeCache.get(key); if (hit !== undefined) return hit;
  let ok = Math.abs(b[0]) <= N && Math.abs(b[1]) <= N && Math.abs(a[0]) <= N && Math.abs(a[1]) <= N && !islandAt(a[0], a[1]) && !islandAt(b[0], b[1]);
  if (ok) {
    const ax = roadLine(a[0]), ay = roadLine(a[1]), bx = roadLine(b[0]), by = roadLine(b[1]);
    for (let t = 0; t <= 1.0001 && ok; t += 0.05) for (const off of [-4, 4]) {
      const x = ax + (bx - ax) * t + (ay === by ? 0 : off), y = ay + (by - ay) * t + (ax === bx ? 0 : off);
      if (!navOpen[cellOf(x, y)]) { ok = false; break; }
    }
  }
  edgeCache.set(key, ok); return ok;
}
export function neighbors(i: number, j: number): Node2[] {
  const out: Node2[] = [];
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const b: Node2 = [i + di, j + dj]; if (edgeOpen([i, j], b)) out.push(b); }
  return out;
}
export const nodeOf = (x: number, y: number): Node2 => [Math.round((x + CELL / 2) / CELL), Math.round((y + CELL / 2) / CELL)];
