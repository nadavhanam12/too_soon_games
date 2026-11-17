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
/** `kick` / `roll` / `pitch` (rad) and `sq` (squash > 0, stretch < 0) are the player's body spring (drive.ts D.body);
 *  `brake` lights the red glow behind the car. All visual only. */
export interface CarView { id: number; kind: CarKind; x: number; y: number; a: number; color?: string; empty?: boolean; kick?: number; roll?: number; pitch?: number; sq?: number; brake?: boolean }
/** burst: `n` sparks (default 16) at speed `spd` (default 12) · smoke: one puff · skid: a tire-mark segment to (x2, y2). */
export interface Fx { k: 'burst' | 'smoke' | 'skid'; x: number; y: number; col: number; n?: number; spd?: number; x2?: number; y2?: number }

/** A pedestrian: `step` = walk cycle phase, `look` = which clothes / skin / hair, `h` = feet above the ground and
 *  `rx` = tumble (rad) while flung (rx = π/2 lying flat), `s` = scale (shrinks away before he is replaced). */
export interface PedView { x: number; y: number; a: number; step: number; look: number; h: number; rx: number; s: number }

/** The police helicopter: (x, y) over the ground at height `h`, heading `a`; `pitch` > 0 = nose down, `roll` > 0 =
 *  banked into a turn toward growing `a`; `light` = the ground point its searchlight is on (none = lamp off). */
export interface HeliView { id: number; x: number; y: number; h: number; a: number; pitch?: number; roll?: number; light?: { x: number; y: number } }

export interface Frame {
  w: number; h: number;                 // backing size in px (logical canvas size × quality)
  t: number;
  dusk: number;                         // 0 = daylight, 1 = evening (low orange sun, lit windows, lamps and headlights)
  cam: { x: number; y: number; zoom: number };
  cars: CarView[];                      // player, traffic, HR minivan, chasers
  helis: HeliView[];
  hrs: Array<{ x: number; y: number; r: number }>;   // HR sight circles
  picks: Array<{ id: number; x: number; y: number; kind: 'cash' | 'can' }>;
  letters: Array<{ id: number; x: number; y: number; ch: string; taken: boolean }>;
  peds: PedView[];                      // pedestrians near the camera
  walker: { x: number; y: number; a: number; step: number } | null;   // the fan on foot (car → building)
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
