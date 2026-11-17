// One canvas. The 360x640 SAFE zone is centred in it: UI lives there, backgrounds use the whole canvas (rule 8).
// Logical height flexes 640..780 with the device. Logical width is 360, unless the game sets GameDef.maxWidth:
// then on a screen wider than a phone (tablet, desktop) the canvas widens up to that, with the safe zone in the middle.
// Game code draws in safe coordinates (0..360, 0..640): the main loop translates by (-view.x0, view.top) before each
// scene. The whole canvas in safe coordinates is the rectangle (view.x0, -view.top, view.fullW, view.H).
// Use fullBleed(fn) to draw in full-height coordinates (0..view.H).

export const W = 360;
export const SAFE_H = 640;
export const MIN_H = 640;
export const MAX_H = 780;

export const view = {
  W,
  fullW: W,      // current logical width of the whole canvas (W, or up to the game's maxWidth on a wide screen)
  x0: 0,         // the canvas' left edge in safe coordinates (0, or negative on a wide canvas); right edge = x0 + fullW
  H: 640,        // current logical height
  top: 0,        // safe-zone offset (full coords)
  bottom: 640,   // safe-zone bottom (full coords)
  scale: 1,      // logical → CSS px
  dpr: 1,        // CSS px → device px
  left: 0,       // canvas CSS offset in the page
  pageTop: 0,
};

export let cv: HTMLCanvasElement;
export let ctx: CanvasRenderingContext2D;

const resizeFns: Array<() => void> = [];
export function onResize(fn: () => void): void { resizeFns.push(fn); }

let maxW = W;

/** `maxWidth` = the widest logical canvas the game can draw (default: 360, a phone column on every screen). */
export function initCanvas(el: HTMLCanvasElement, maxWidth = W): void {
  cv = el; maxW = Math.max(W, maxWidth);
  const c = el.getContext('2d', { alpha: false });
  if (!c) throw new Error('no 2d context');
  ctx = c;
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 50));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
}

export function fit(): void {
  const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
  let H = Math.round((W * vh) / vw);
  H = Math.max(MIN_H, Math.min(MAX_H, H));
  view.H = H;
  view.top = Math.round((H - SAFE_H) / 2);
  view.bottom = view.top + SAFE_H;
  view.scale = Math.min(vw / W, vh / H);
  // room left beside the phone column goes to the canvas, up to the game's limit (an even number: x0 stays whole)
  view.fullW = Math.max(W, Math.min(maxW, Math.floor(vw / view.scale / 2) * 2));
  view.x0 = -(view.fullW - W) / 2;
  view.dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cssW = view.fullW * view.scale, cssH = H * view.scale;
  cv.style.width = cssW + 'px';
  cv.style.height = cssH + 'px';
  // backing store = real device pixels of the displayed size (sharp on desktop too)
  cv.width = Math.round(cssW * view.dpr);
  cv.height = Math.round(cssH * view.dpr);
  const k = view.scale * view.dpr;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const r = cv.getBoundingClientRect();
  view.left = r.left; view.pageTop = r.top;
  for (const f of resizeFns) f();
}

/** Client (CSS px) → logical safe-zone coordinates. */
export function toSafe(clientX: number, clientY: number): { x: number; y: number } {
  const r = cv.getBoundingClientRect();
  const sc = r.width / view.fullW || view.scale || 1;
  return { x: (clientX - r.left) / sc + view.x0, y: (clientY - r.top) / sc - view.top };
}

/** Draw in full-height coordinates (y 0..view.H; x is unchanged: the canvas spans view.x0 .. view.x0 + view.fullW). Call from inside a scene's draw (which runs translated by view.top). */
export function fullBleed(fn: (h: number) => void): void {
  ctx.save();
  ctx.translate(0, -view.top);
  fn(view.H);
  ctx.restore();
}

/** Run `fn` with every drawing call going to another 2D context (an off-screen picture, e.g. a share image). */
export function drawOn<T>(c: CanvasRenderingContext2D, fn: () => T): T {
  const prev = ctx; ctx = c;
  try { return fn(); } finally { ctx = prev; }
}

/** Fill the whole canvas with a colour or a vertical gradient (two colours). */
export function fillBg(a: string, b?: string): void {
  fullBleed((h) => {
    if (b) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; }
    else ctx.fillStyle = a;
    ctx.fillRect(view.x0, 0, view.fullW, h);
  });
}

/** Position a DOM overlay element using safe-zone logical units. */
export function place(el: HTMLElement, x: number, y: number, w: number, h: number, fontPx = 14): void {
  const s = view.scale;
  const r = cv.getBoundingClientRect();
  el.style.left = r.left + (x - view.x0) * s + 'px';
  el.style.top = r.top + (y + view.top) * s + 'px';
  el.style.width = w * s + 'px';
  el.style.height = h * s + 'px';
  el.style.fontSize = fontPx * s + 'px';
}
