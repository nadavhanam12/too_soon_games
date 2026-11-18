// The mini games' 3D sets on the game side: hands a set's snapshot to the renderer (lazy/sets3d.ts through drive.ts'
// World3D) and draws the picture full-canvas, pixel-sharp at that set's resolution; maps set points to the canvas for
// the 2D bits drawn over it (bubbles, keys).
import { view, ctx } from '@tsg/index';
import { world3d, loadWorld } from './drive';
import type { MiniFrame, MiniSet } from './world3d-api';
import { MINI } from './content';
import { ptxt } from './pixel';

/** CSS px per rendered pixel, per set: never coarser than the drive before it (Nadav, 2026-11-18: no step down). */
const PIX: Record<MiniSet, number> = { office: 2, line: 2, room: 1, desk: 1 };
export const setsReady = (): boolean => world3d() !== null;
/** Render a set and draw it; false (and a loading line) while the renderer is still arriving. */
export function drawSet(m: Omit<MiniFrame, 'w' | 'h' | 't'>): boolean {
  const w = world3d();
  ctx.fillStyle = '#0e0e10'; ctx.fillRect(view.x0, -view.top, view.fullW, view.H);
  if (!w) { loadWorld(); ptxt(MINI.loading, view.x0 + view.fullW / 2, 300, 2, '#ffffff'); return false; }   // expected on a slow phone or a debug start
  const k = PIX[m.set];
  w.renderMini({ ...m, w: Math.max(1, Math.round((view.fullW * view.scale) / k)), h: Math.max(1, Math.round((view.H * view.scale) / k)), t: performance.now() / 1000 });
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(w.canvas, view.x0, -view.top, view.fullW, view.H); ctx.restore();
  return true;
}
/** A point on the last drawn set → canvas coordinates. */
export function toScreen(x: number, y: number, z: number): { x: number; y: number } {
  const w = world3d(); if (!w) return { x: 0, y: 0 };
  const q = w.projectMini(x, y, z);
  return { x: view.x0 + q.x * view.fullW, y: -view.top + q.y * view.H };
}
