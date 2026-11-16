// One shared city for all three driving legs (research.md 6A cut item 3): a 10x10 grid of blocks with two-lane roads,
// a few road segments closed off into parks. Tiles are 32 px; a block is 5 tiles of buildings + 2 tiles of road.
// The map is painted once to an offscreen canvas (chunky pixel look) and blitted with smoothing off.
// Intersections are graph nodes (11x11) used by traffic, HR and the chasers.

export const T = 32, PER = 7, NB = 10, NN = NB + 1;
export const TILES = NN * PER - (PER - 2);         // 72
export const SIZE = TILES * T;                       // 2304 px
export const ROAD = 2 * T;                            // road width (64)

/** World coordinate of node i (on either axis): the centre of the two-tile road. */
export const nodeC = (i: number): number => i * PER * T + T;

// closed road segments (become parks). H(i,j) = between node (i,j) and (i+1,j); V(i,j) = between (i,j) and (i,j+1).
const CLOSED_H = new Set(['3,2', '2,6', '7,3', '6,8', '5,0']);
const CLOSED_V = new Set(['5,2', '4,7', '1,3', '8,6', '9,1']);
export const edgeOpen = (a: [number, number], b: [number, number]): boolean => {
  if (b[0] < 0 || b[1] < 0 || b[0] >= NN || b[1] >= NN) return false;
  if (a[1] === b[1]) return !CLOSED_H.has(`${Math.min(a[0], b[0])},${a[1]}`);
  return !CLOSED_V.has(`${a[0]},${Math.min(a[1], b[1])}`);
};
export const neighbors = (i: number, j: number): Array<[number, number]> =>
  ([[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as Array<[number, number]>).filter((b) => edgeOpen([i, j], b));

/** Is this tile road? */
export function roadTile(tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= TILES || ty >= TILES) return false;
  const rx = tx % PER < 2, ry = ty % PER < 2;
  if (rx && ry) return true;                                  // intersection
  if (ry) { const i = Math.floor(tx / PER), j = Math.floor(ty / PER); return !CLOSED_H.has(`${i},${j}`); }
  if (rx) { const i = Math.floor(tx / PER), j = Math.floor(ty / PER); return !CLOSED_V.has(`${i},${j}`); }
  return false;
}
export const solidAt = (x: number, y: number): boolean => !roadTile(Math.floor(x / T), Math.floor(y / T));

/** Push a circle out of solid tiles. Returns the push normal (0,0 if no hit). */
export function collide(p: { x: number; y: number }, r: number): { nx: number; ny: number } {
  let nx = 0, ny = 0;
  const x0 = Math.floor((p.x - r) / T), x1 = Math.floor((p.x + r) / T), y0 = Math.floor((p.y - r) / T), y1 = Math.floor((p.y + r) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (roadTile(tx, ty)) continue;
    const cx = Math.max(tx * T, Math.min(p.x, tx * T + T)), cy = Math.max(ty * T, Math.min(p.y, ty * T + T));
    let dx = p.x - cx, dy = p.y - cy; const d = Math.hypot(dx, dy);
    if (d >= r) continue;
    if (d < 0.001) { dx = 0; dy = -1; } else { dx /= d; dy /= d; }
    const push = r - Math.max(d, 0.001);
    p.x += dx * push; p.y += dy * push; nx += dx; ny += dy;
  }
  p.x = Math.max(r, Math.min(SIZE - r, p.x)); p.y = Math.max(r, Math.min(SIZE - r, p.y));
  const n = Math.hypot(nx, ny); return n ? { nx: nx / n, ny: ny / n } : { nx: 0, ny: 0 };
}

/** Nearest node to a world point. */
export const nodeOf = (x: number, y: number): [number, number] => [
  Math.max(0, Math.min(NN - 1, Math.round((x - T) / (PER * T)))), Math.max(0, Math.min(NN - 1, Math.round((y - T) / (PER * T)))),
];

/** BFS over intersections; returns the next node after `from` on a shortest path to `to` (or `to` itself). */
export function nextNode(from: [number, number], to: [number, number]): [number, number] {
  if (from[0] === to[0] && from[1] === to[1]) return to;
  const key = (n: [number, number]) => n[0] * NN + n[1];
  const prev = new Map<number, number>([[key(from), -1]]);
  const q: Array<[number, number]> = [from];
  while (q.length) {
    const c = q.shift()!;
    if (c[0] === to[0] && c[1] === to[1]) break;
    for (const nb of neighbors(c[0], c[1])) if (!prev.has(key(nb))) { prev.set(key(nb), key(c)); q.push(nb); }
  }
  let k = key(to);
  if (!prev.has(k)) return from;
  while (prev.get(k) !== key(from) && prev.get(k) !== -1) k = prev.get(k)!;
  return [Math.floor(k / NN), k % NN];
}

// ---------- named places ----------
export type PlaceId = 'home' | 'office' | 'clinic' | 'gas' | 'store';
export interface Place { id: PlaceId; bx: number; by: number; side: 'N' | 'S' | 'E' | 'W'; x: number; y: number }
function place(id: PlaceId, bx: number, by: number, side: Place['side']): Place {
  const mid = (b: number) => b * PER * T + 2 * T + 2.5 * T; // block centre
  const x = side === 'E' ? nodeC(bx + 1) : side === 'W' ? nodeC(bx) : mid(bx);
  const y = side === 'S' ? nodeC(by + 1) : side === 'N' ? nodeC(by) : mid(by);
  return { id, bx, by, side, x, y };
}
export const PLACES: Record<PlaceId, Place> = {
  home: place('home', 1, 8, 'N'),
  office: place('office', 8, 1, 'S'),
  store: place('store', 3, 4, 'N'),
  clinic: place('clinic', 6, 5, 'W'),
  gas: place('gas', 7, 5, 'W'),
};

/** Random point on an open road segment inside a world rect (used for pickups, letters, traffic spawns). */
export function roadPointIn(x0: number, y0: number, x1: number, y1: number, rnd: () => number): { x: number; y: number; ax: 'h' | 'v' } {
  for (let k = 0; k < 200; k++) {
    const i = Math.floor(rnd() * NN), j = Math.floor(rnd() * NN), hz = rnd() < 0.5;
    const b: [number, number] = hz ? [i + 1, j] : [i, j + 1];
    if (!edgeOpen([i, j], b)) continue;
    const f = 0.25 + rnd() * 0.5;
    const x = hz ? nodeC(i) + f * PER * T : nodeC(i), y = hz ? nodeC(j) : nodeC(j) + f * PER * T;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return { x, y, ax: hz ? 'h' : 'v' };
  }
  return { x: nodeC(1), y: nodeC(1), ax: 'h' };
}

// ---------- painting ----------
let canvas: HTMLCanvasElement | null = null;
function srand(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const ROOFS = ['#e86aa6', '#4fc1c6', '#f2a65a', '#9b7fd1', '#d9d2c5', '#6fbf73', '#e9d36b', '#c96b5b', '#7aa7d9'];
const shade = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export function mapCanvas(): HTMLCanvasElement {
  if (canvas) return canvas;
  const c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE;
  const g = c.getContext('2d')!; const r = srand(19112026);
  // ground = sidewalk concrete
  g.fillStyle = '#8b8790'; g.fillRect(0, 0, SIZE, SIZE);
  // roads
  for (let ty = 0; ty < TILES; ty++) for (let tx = 0; tx < TILES; tx++) if (roadTile(tx, ty)) { g.fillStyle = '#34323a'; g.fillRect(tx * T, ty * T, T, T); }
  // asphalt speckle
  for (let k = 0; k < 9000; k++) { const x = Math.floor(r() * SIZE / 2) * 2, y = Math.floor(r() * SIZE / 2) * 2; if (roadTile(Math.floor(x / T), Math.floor(y / T))) { g.fillStyle = r() < 0.5 ? '#3c3a43' : '#2c2a31'; g.fillRect(x, y, 2, 2); } }
  // lane dashes (yellow centre line between intersections)
  g.fillStyle = '#e9c84a';
  for (let j = 0; j < NN; j++) for (let i = 0; i < NB; i++) {
    if (edgeOpen([i, j], [i + 1, j])) for (let x = nodeC(i) + 40; x < nodeC(i + 1) - 40; x += 16) g.fillRect(x, nodeC(j) - 1, 8, 2);
    if (edgeOpen([j, i], [j, i + 1])) for (let y = nodeC(i) + 40; y < nodeC(i + 1) - 40; y += 16) g.fillRect(nodeC(j) - 1, y, 2, 8);
  }
  // crosswalk stripes at intersections
  g.fillStyle = 'rgba(240,240,240,.55)';
  for (let j = 0; j < NN; j++) for (let i = 0; i < NN; i++) {
    const cx = nodeC(i), cy = nodeC(j);
    for (let k = -24; k <= 20; k += 8) {
      if (edgeOpen([i, j], [i + 1, j])) g.fillRect(cx + 34, cy + k, 6, 4);
      if (edgeOpen([i, j], [i, j + 1])) g.fillRect(cx + k, cy + 34, 4, 6);
    }
  }
  // closed segments → small parks
  const park = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = '#4e9a52'; g.fillRect(x + 4, y + 4, w - 8, h - 8);
    for (let k = 0; k < (w * h) / 1400; k++) palm(g, x + 12 + r() * (w - 24), y + 12 + r() * (h - 24), r);
  };
  for (const s of CLOSED_H) { const [i, j] = s.split(',').map(Number) as [number, number]; park(nodeC(i) + T, nodeC(j) - T, PER * T - 2 * T, 2 * T); }
  for (const s of CLOSED_V) { const [i, j] = s.split(',').map(Number) as [number, number]; park(nodeC(i) - T, nodeC(j) + T, 2 * T, PER * T - 2 * T); }
  // blocks
  const special = new Map<string, PlaceId>(Object.values(PLACES).map((p) => [`${p.bx},${p.by}`, p.id]));
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
    const x = bx * PER * T + 2 * T, y = by * PER * T + 2 * T, s = 5 * T;
    const sp = special.get(`${bx},${by}`);
    if (sp) { landmark(g, sp, x, y, s, r); continue; }
    const kind = r();
    if (kind < 0.12) { // park block
      g.fillStyle = '#4e9a52'; g.fillRect(x + 6, y + 6, s - 12, s - 12);
      g.fillStyle = '#3f8ac9'; g.fillRect(x + 50, y + 54, 60, 40); g.fillStyle = '#6fb3e6'; g.fillRect(x + 54, y + 58, 20, 4);
      for (let k = 0; k < 7; k++) palm(g, x + 16 + r() * (s - 32), y + 16 + r() * (s - 32), r);
      continue;
    }
    if (kind < 0.2) { // parking lot
      g.fillStyle = '#56545c'; g.fillRect(x + 6, y + 6, s - 12, s - 12); g.fillStyle = '#d8d8d8';
      for (let k = 0; k < 7; k++) { g.fillRect(x + 14 + k * 20, y + 14, 2, 30); g.fillRect(x + 14 + k * 20, y + s - 44, 2, 30); }
      for (let k = 0; k < 5; k++) if (r() < 0.6) { g.fillStyle = ROOFS[Math.floor(r() * ROOFS.length)]!; g.fillRect(x + 18 + k * 20, y + 18 + (r() < 0.5 ? 0 : s - 62), 12, 22); }
      continue;
    }
    // 2..4 buildings
    const split = r() < 0.5;
    const cut = 50 + Math.floor(r() * 60);
    const parts = split ? [[x, y, cut, s], [x + cut, y, s - cut, s]] : [[x, y, s, cut], [x, y + cut, s, s - cut]];
    for (const [px, py, pw2, ph] of parts as Array<[number, number, number, number]>) building(g, px + 6, py + 6, pw2 - 12, ph - 12, ROOFS[Math.floor(r() * ROOFS.length)]!, r);
  }
  canvas = c; return c;
}

function building(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, r: () => number): void {
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 6, y + 6, w, h);   // drop shadow
  g.fillStyle = shade(col, 0.72); g.fillRect(x, y, w, h);
  g.fillStyle = col; g.fillRect(x + 4, y + 4, w - 8, h - 8);
  g.fillStyle = shade(col, 1.15); g.fillRect(x + 4, y + 4, w - 8, 3);
  // roof clutter: AC boxes, vents, a water tank
  for (let k = 0; k < 2 + Math.floor((w * h) / 4000); k++) {
    const bw = 8 + Math.floor(r() * 3) * 4, bx = x + 8 + Math.floor(r() * Math.max(1, w - 16 - bw)), by2 = y + 10 + Math.floor(r() * Math.max(1, h - 20 - bw));
    g.fillStyle = shade(col, 0.6); g.fillRect(bx + 2, by2 + 2, bw, bw - 2);
    g.fillStyle = '#c9c6cf'; g.fillRect(bx, by2, bw, bw - 2); g.fillStyle = '#9d99a6'; g.fillRect(bx + 2, by2 + 2, bw - 4, 2);
  }
}

function palm(g: CanvasRenderingContext2D, x: number, y: number, r: () => number): void {
  x = Math.round(x / 2) * 2; y = Math.round(y / 2) * 2;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 6, y + 4, 16, 6);
  g.fillStyle = '#2f7a3a'; g.fillRect(x - 10, y - 2, 20, 4); g.fillRect(x - 2, y - 10, 4, 20); g.fillRect(x - 7, y - 7, 4, 4); g.fillRect(x + 3, y + 3, 4, 4); g.fillRect(x + 3, y - 7, 4, 4); g.fillRect(x - 7, y + 3, 4, 4);
  g.fillStyle = '#56b45f'; g.fillRect(x - 8, y - 2, 6, 2); g.fillRect(x - 2, y - 8, 2, 6);
  g.fillStyle = '#7a5a33'; g.fillRect(x - 2, y - 2, 4, 4);
  void r;
}

/** The five story buildings, each with a readable rooftop sign. */
function landmark(g: CanvasRenderingContext2D, id: PlaceId, x: number, y: number, s: number, r: () => number): void {
  const sign = (t: string, cx: number, cy: number, bg: string, fg: string) => {
    g.font = '900 15px monospace'; const w = g.measureText(t).width + 14;
    g.fillStyle = bg; g.fillRect(Math.round(cx - w / 2), cy - 11, Math.round(w), 22);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, cx, cy + 1);
  };
  if (id === 'office') {
    building(g, x + 6, y + 6, s - 12, s - 12, '#7d8796', r);
    g.fillStyle = '#5b6573'; for (let k = 0; k < 5; k++) g.fillRect(x + 20 + k * 26, y + 30, 14, 100);
    sign('SYNERGY CORP', x + s / 2, y + s - 20, '#20242c', '#9fe0ff');
    g.fillStyle = '#3e4652'; g.fillRect(x + s / 2 - 14, y + s - 6, 28, 8); // entrance
  } else if (id === 'home') {
    g.fillStyle = '#4e9a52'; g.fillRect(x + 6, y + 6, s - 12, s - 12);
    building(g, x + 30, y + 30, 100, 80, '#c96b5b', r);
    g.fillStyle = '#7a5a33'; for (let k = 0; k < 6; k++) g.fillRect(x + 34, y + 36 + k * 12, 92, 3); // roof tiles
    g.fillStyle = '#56545c'; g.fillRect(x + 64, y + 6, 32, 26);   // driveway to the north road
    sign('HOME', x + s / 2, y + 130, '#fff3d6', '#c8102e');
    palm(g, x + 20, y + 140, r); palm(g, x + 140, y + 24, r);
  } else if (id === 'store') {
    building(g, x + 6, y + 6, s - 12, s - 12, '#3a2a5a', r);
    sign('GAMES', x + s / 2, y + 26, '#ff3fa4', '#ffffff');
    g.fillStyle = '#ffe14a'; g.fillRect(x + 20, y + 50, s - 40, 4);
  } else if (id === 'clinic') {
    building(g, x + 6, y + 6, s - 12, s - 12, '#e8eef2', r);
    g.fillStyle = '#e03a3a'; g.fillRect(x + s / 2 - 8, y + s / 2 - 26, 16, 52); g.fillRect(x + s / 2 - 26, y + s / 2 - 8, 52, 16);
    sign('DR. FEELGOOD', x + s / 2, y + s - 22, '#1b4f8a', '#ffffff');
  } else if (id === 'gas') {
    g.fillStyle = '#56545c'; g.fillRect(x + 6, y + 6, s - 12, s - 12);
    building(g, x + 90, y + 20, 56, 120, '#f2a65a', r);
    g.fillStyle = '#d8d8d8'; g.fillRect(x + 14, y + 40, 60, 80); // canopy
    g.fillStyle = '#e03a3a'; g.fillRect(x + 14, y + 40, 60, 6);
    for (let k = 0; k < 3; k++) { g.fillStyle = '#2a6fd0'; g.fillRect(x + 28 + k * 16, y + 70, 8, 14); }
    sign('GAS', x + 44, y + 24, '#e03a3a', '#ffffff');
  }
}
