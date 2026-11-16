// The contract between the game (index.html) and the three.js renderer (lazy/world3d.ts → lazy/world3d.js, loaded after
// the first frame, DECISIONS 72). Types only: the lazy bundle must not import game modules (they hold state and would be
// duplicated), so the game hands it the city once and a frame snapshot every frame.
import type { Ground, Place, PlaceId, Prim } from './city';

export interface CityData {
  prims: Prim[];
  grounds: Ground[];
  lamps: Array<{ x: number; z: number }>;
  places: Record<PlaceId, Place>;
  bmin: number; bmax: number;
}

export type CarKind = 'player' | 'cop' | 'shark' | 'hr' | 'spouse' | 'npc';
export interface CarView { id: number; kind: CarKind; x: number; y: number; a: number; color?: string; lean?: number }
export interface Fx { k: 'burst' | 'smoke'; x: number; y: number; col: number }

export interface Frame {
  w: number; h: number;                 // backing size in px (logical canvas size × quality)
  t: number;
  cam: { x: number; y: number; zoom: number };
  cars: CarView[];                      // player, traffic, HR minivan, chasers
  hr: { x: number; y: number; r: number } | null;
  picks: Array<{ id: number; x: number; y: number; kind: 'cash' | 'can' }>;
  letters: Array<{ id: number; x: number; y: number; ch: string; taken: boolean }>;
  pending: PlaceId[];                   // places with a pulsing marker
  fx: Fx[];                             // effects to spawn this frame
}

export interface World3D {
  canvas: HTMLCanvasElement;
  render(f: Frame): void;
  /** World point (x, y on the ground, h above it) → canvas fraction (0..1, 0..1) for the last rendered frame. */
  project(x: number, y: number, h?: number): { x: number; y: number };
}

export interface World3DModule { create(city: CityData): World3D }

declare global { interface Window { __w6world3d?: World3DModule } }
