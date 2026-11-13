// One portrait canvas. Logical width is always 360; logical height flexes 640..780 with the device.
// The 360x640 SAFE zone is centred: UI lives there, backgrounds use the whole height (rule 8).
// Game code draws in safe coordinates (0..640): the main loop translates by view.top before each scene.
// Use fullBleed(fn) to draw in full-canvas coordinates (0..view.H).

export const W = 360;
export const SAFE_H = 640;
export const MIN_H = 640;
export const MAX_H = 780;

export const view = {
  W,
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

export function initCanvas(el: HTMLCanvasElement): void {
  cv = el;
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
  view.dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cssW = W * view.scale, cssH = H * view.scale;
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
  const sc = r.width / W || view.scale || 1;
  return { x: (clientX - r.left) / sc, y: (clientY - r.top) / sc - view.top };
}

/** Draw in full-canvas coordinates (0..view.H). Call from inside a scene's draw (which runs translated by view.top). */
export function fullBleed(fn: (h: number) => void): void {
  ctx.save();
  ctx.translate(0, -view.top);
  fn(view.H);
  ctx.restore();
}

/** Fill the whole canvas with a colour or a vertical gradient (two colours). */
export function fillBg(a: string, b?: string): void {
  fullBleed((h) => {
    if (b) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; }
    else ctx.fillStyle = a;
    ctx.fillRect(0, 0, W, h);
  });
}

/** Position a DOM overlay element using safe-zone logical units. */
export function place(el: HTMLElement, x: number, y: number, w: number, h: number, fontPx = 14): void {
  const s = view.scale;
  const r = cv.getBoundingClientRect();
  el.style.left = r.left + x * s + 'px';
  el.style.top = r.top + (y + view.top) * s + 'px';
  el.style.width = w * s + 'px';
  el.style.height = h * s + 'px';
  el.style.fontSize = fontPx * s + 'px';
}
