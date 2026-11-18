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
export interface CarView { id: number; kind: CarKind; x: number; y: number; a: number; color?: string; empty?: boolean; kick?: number; roll?: number; pitch?: number; sq?: number; brake?: boolean; steer?: number; gas?: boolean; exit?: number; speed?: number }
/** burst: `n` sparks (default 16) at speed `spd` (default 12) · smoke: one puff · skid: a tire-mark segment to (x2, y2). */
export interface Fx { k: 'burst' | 'smoke' | 'skid'; x: number; y: number; col: number; n?: number; spd?: number; x2?: number; y2?: number }

/** A pedestrian: `step` = walk cycle phase, `look` = which clothes / skin / hair, `h` = feet above the ground and
 *  `rx` = tumble (rad) while flung (rx = π/2 lying flat), `s` = scale (shrinks away before he is replaced). */
export interface PedView { x: number; y: number; a: number; step: number; look: number; h: number; rx: number; s: number }

/** The police helicopter: (x, y) over the ground at height `h`, heading `a`; `pitch` > 0 = nose down, `roll` > 0 =
 *  banked into a turn toward growing `a`; `light` = the ground point its searchlight is on (none = lamp off). */
export interface HeliView { id: number; x: number; y: number; h: number; a: number; pitch?: number; roll?: number; light?: { x: number; y: number } }

export type Look = 2 | 3 | 4;

export interface Frame {
  w: number; h: number;                 // backing size in px (logical canvas size × quality)
  t: number;
  dusk: number;                         // 0 = daylight, 1 = evening (low orange sun, lit windows, lamps and headlights)
  /** The picture's look (legs.ts sets D.look per driving leg): 2 = from above, chunky pixels (the commute) · 3 = the
   *  camera behind the car, finer picture, cool haze (after the boss) · 4 = behind the car at sunset: neon, lit
   *  windows, full resolution (after the store). */
  look: Look;
  /** (x, y, zoom) = the top view's centre and height. Looks 3 and 4 put the camera behind (px, py) looking along the
   *  heading `a`. `k` scales its distance and height (1 at rest, more while it swoops in at a leg's start, about 0.5
   *  in a close-up), `sp` = speed 0..1 (the camera backs off with it), `pull` 0..1 lifts it and backs it off more (a
   *  chaser on your bumper). */
  cam: { x: number; y: number; zoom: number; px: number; py: number; a: number; pull: number; k: number; sp: number };
  /** Looks 3 and 4: the arrow toward the next stop, a solid shape that stays at one place on screen; `rel` = where it
   *  points against the camera's heading (0 = straight on, positive = to the right); none = no arrow. */
  arrow?: { rel: number };
  cars: CarView[];                      // player, traffic, HR minivan, chasers
  helis: HeliView[];
  hrs: Array<{ x: number; y: number; r: number }>;   // HR sight circles
  picks: Array<{ id: number; x: number; y: number; kind: 'cash' | 'can' }>;
  letters: Array<{ id: number; x: number; y: number; ch: string; taken: boolean }>;
  peds: PedView[];                      // pedestrians near the camera
  walker: { x: number; y: number; a: number; step: number; entry?: number } | null;   // entry: crouched exit → upright
  pending: PlaceId[];                   // places with a pulsing marker
  fx: Fx[];                             // effects to spawn this frame
}

// ---------- the mini games' sets (Nadav, 2026-11-18: their own screens, at the game's quality) ----------
// Small separate 3D scenes rendered by the same renderer (lazy/sets3d.ts): an office, the line outside the store, the
// living room at night. Ground plane x / z, y up; the game hands a snapshot every frame like the city's Frame.
export type MiniSet = 'office' | 'line' | 'room' | 'desk';   // desk: behind the PC's login screen (scenes.ts pc)
/** A person on a set: `ry` = facing (0 = toward +z, the camera), `step` = walk phase, `sit` = seated, `lean` = leaning
 *  back (rad, a reaction), `mask` = wears a face mask, `tent` = a camping tent instead of a person. */
export interface MiniPerson { id: number; role: 'worker' | 'boss' | 'camper' | 'fiancee' | 'tent'; x: number; z: number; ry: number; step: number; shirt: number; sit?: boolean; lean?: number; mask?: boolean; walk?: number }
export interface MiniFrame {
  w: number; h: number; t: number;
  set: MiniSet;
  cam: { x: number; y: number; z: number; tx: number; ty: number; tz: number; fov: number };
  /** The fan (the Blender walker): `crouch` 0..1 (tiptoe), `lean` = forward bend (a cough). */
  hero?: { x: number; z: number; ry: number; step: number; crouch?: number; lean?: number };   // none = not on this set
  people: MiniPerson[];
  /** Cough droplets in the air at (x, y, z), radius r; and the splats they leave on the floor (x, z, radius, opacity). */
  drops: Array<{ x: number; y: number; z: number; r: number }>;
  splats: Array<{ x: number; z: number; r: number; o: number }>;
}

export interface World3D {
  canvas: HTMLCanvasElement;
  render(f: Frame): void;
  /** Renders a mini game's set into the same canvas (the city is not drawn that frame). */
  renderMini(m: MiniFrame): void;
  /** Like project, for the last rendered mini set (x, y, z in its own space). */
  projectMini(x: number, y: number, z: number): { x: number; y: number };
  /** World point (x, y on the ground, h above it) → canvas fraction (0..1, 0..1) for the last rendered frame. */
  /** `behind` = the point is behind the camera (looks 3 and 4): x and y are then mirrored and not for drawing. */
  project(x: number, y: number, h?: number): { x: number; y: number; behind: boolean };
  stats(): { look: Look; calls: number; triangles: number; textures: number; geometries: number; renderMs: number; walker: boolean; driver: boolean; assets: Record<string, string> };
}

export interface EnvironmentAssets { facade: string; asphalt: string; pavement: string; cover: string }   // cover: the game case (the TV ad in the living-room set)
export interface World3DModule { create(city: CityData, assets?: EnvironmentAssets): World3D }

declare global { interface Window { __w6world3d?: World3DModule } }
