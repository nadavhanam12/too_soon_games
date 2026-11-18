// The mini games' sets (Nadav, 2026-11-18: the mini games keep their own screens but must be at the game's quality, not
// a step down; "keep it simple, they are just mini games"). Three small 3D scenes drawn by the city's renderer: the
// same tone mapping, soft shadows and bloom, the Blender hero walking in them, people built in the pedestrians' blocky
// style. Each set is built once, the first time it is shown. Visual only: it never reads game state (world3d-api).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { heroWalker, animateHero } from '../models/hero';
import type { MiniFrame, MiniPerson, MiniSet } from '../world3d-api';

const SKIN = 0xe0a77e, PANTS = 0x2a2a36;
const HAIR = [0x2a1a10, 0x111111, 0x6b3a1e, 0xc9a24a, 0x3a2416];
type Person = THREE.Group & { legs: THREE.Group[]; arms: THREE.Group[]; head: THREE.Group; upper: THREE.Group; shirt: THREE.MeshStandardMaterial; mask: THREE.Mesh };
const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }

/** A person about as tall as the hero walker (~2.4): legs and arms on pivots, head on a neck pivot. */
function makePerson(role: MiniPerson['role'], id: number): Person {
  const g = new THREE.Group() as Person;
  const shirt = std(0xffffff), skin = std(SKIN), pants = std(role === 'boss' ? 0x3a3a46 : PANTS), hair = std(HAIR[id % HAIR.length]!);
  g.shirt = shirt;
  g.legs = [-0.2, 0.2].map((x) => { const p = new THREE.Group(); p.position.set(x, 1.05, 0); p.add(mesh(new THREE.BoxGeometry(0.3, 1.0, 0.32), pants, 0, -0.5, 0)); g.add(p); return p; });
  const upper = new THREE.Group(); upper.position.y = 1.05; g.add(upper); g.upper = upper;
  upper.add(mesh(new THREE.CapsuleGeometry(0.4, 0.42, 4, 10), shirt, 0, 0.5, 0));
  if (role === 'boss') upper.add(mesh(new THREE.BoxGeometry(0.12, 0.6, 0.04), std(0xd0202a), 0, 0.55, 0.39));   // the tie
  g.arms = [-0.55, 0.55].map((x) => { const p = new THREE.Group(); p.position.set(x, 0.92, 0); p.add(mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 8), shirt, 0, -0.38, 0)); upper.add(p); return p; });
  const head = new THREE.Group(); head.position.y = 1.08; upper.add(head); g.head = head;
  head.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), skin, 0, 0.2, 0));
  const cap = mesh(new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.24, -0.02); head.add(cap);
  if (role === 'fiancee') { head.add(mesh(new THREE.BoxGeometry(0.62, 0.7, 0.22), hair, 0, -0.02, -0.2)); }   // long hair
  if (role === 'boss') g.scale.setScalar(1.12);
  g.mask = mesh(new THREE.BoxGeometry(0.42, 0.2, 0.08), std(0xf4f4f4), 0, 0.12, 0.28); g.mask.visible = false; head.add(g.mask);
  return g;
}
function makeTent(color: number): THREE.Group {
  const g = new THREE.Group();
  const m = mesh(new THREE.ConeGeometry(1.2, 1.6, 4), std(color), 0, 0.8, 0); m.rotation.y = Math.PI / 4; g.add(m);
  return g;
}
/** A sign / screen face drawn on a canvas. */
function textTex(text: string, fg: string, bg: string, w = 512, h = 128, font = '900 92px Rubik, system-ui, sans-serif'): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); if (!g) throw new Error('no 2d context for a sign');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = fg; g.shadowBlur = 24; g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function box(sc: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh { const o = mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z); sc.add(o); return o; }
function sunlight(sc: THREE.Scene, color: number, k: number, pos: [number, number, number], span: number, touch: boolean): THREE.DirectionalLight {
  const l = new THREE.DirectionalLight(color, k); l.position.set(...pos); l.castShadow = true;
  l.shadow.mapSize.setScalar(touch ? 1024 : 2048); const c = l.shadow.camera; c.left = -span; c.right = span; c.top = span; c.bottom = -span; c.far = 120;
  sc.add(l, l.target); return l;
}

interface SetData { scene: THREE.Scene; update?(m: MiniFrame): void }
function buildOffice(touch: boolean): SetData {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xdfe4ea); sc.fog = new THREE.Fog(0xdfe4ea, 30, 60);
  sc.add(new THREE.HemisphereLight(0xf2f7ff, 0x8a8070, 1.1));
  sunlight(sc, 0xfff4e0, 1.8, [-8, 18, 10], 16, touch);
  const floor = mesh(new THREE.PlaneGeometry(60, 30), std(0x5d6a7c, { roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  box(sc, 60, 9, 0.4, std(0xe8e4dc), 0, 4.5, -9);   // back wall
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x7fc4ff, emissiveIntensity: 0.6, roughness: 0.2 });
  for (let x = -16; x <= 16; x += 6.4) { box(sc, 5, 4.2, 0.1, glass, x, 4.6, -8.75); box(sc, 0.25, 4.6, 0.2, std(0x9aa2ad), x + 2.6, 4.6, -8.7); }
  const wood = std(0xc79b6c, { roughness: 0.6 }), panel = std(0x8c96a3), screen = new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x6fb7ff, emissiveIntensity: 0.9 });
  // each coworker sits on a chair facing the aisle (minigames.ts, z −2.2) with the desk behind them
  for (const x of [-6, -2, 2, 6]) {
    box(sc, 3.2, 0.14, 1.4, wood, x, 1.15, -3.6);
    box(sc, 0.12, 1.1, 1.3, panel, x - 1.5, 0.55, -3.6); box(sc, 0.12, 1.1, 1.3, panel, x + 1.5, 0.55, -3.6);
    box(sc, 1.0, 0.65, 0.06, screen, x, 1.62, -4.0);
    box(sc, 0.1, 0.35, 0.1, panel, x, 1.3, -4.06);
    box(sc, 0.5, 0.5, 0.05, std(0xffe66b), x + 1.2, 1.5, -4.05);   // a sticky note
    box(sc, 0.9, 0.12, 0.9, std(0x2a2a30), x, 0.72, -2.25); box(sc, 0.12, 0.7, 0.12, std(0x2a2a30), x, 0.36, -2.25);   // the chair
  }
  for (const x of [-10, 10]) { const pot = mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.9, 12), std(0x7a4a2a), x, 0.45, -7); sc.add(pot); sc.add(mesh(new THREE.SphereGeometry(1.1, 12, 10), std(0x3d9a4a), x, 1.7, -7)); }
  return { scene: sc };
}
function buildLine(touch: boolean): SetData {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xb9c4cf); sc.fog = new THREE.FogExp2(0xb9c4cf, 0.012);
  sc.add(new THREE.HemisphereLight(0xdde8f5, 0x6a6458, 1.0));
  const sun = sunlight(sc, 0xfff0d8, 1.6, [-10, 22, 6], 22, touch);
  const pave = mesh(new THREE.PlaneGeometry(12, 120), std(0xb3aa9e, { roughness: 0.95 }), 0, 0, -45); pave.rotation.x = -Math.PI / 2; sc.add(pave);
  const road = mesh(new THREE.PlaneGeometry(20, 120), std(0x45464c, { roughness: 0.9 }), -16, -0.02, -45); road.rotation.x = -Math.PI / 2; sc.add(road);
  for (let z = 10; z > -100; z -= 6) box(sc, 0.25, 0.02, 3, new THREE.MeshBasicMaterial({ color: 0xf2d15a }), -14, 0.01, z);
  box(sc, 0.4, 0.25, 120, std(0x9a9488), -6, 0.12, -45);   // the curb
  // the three lanes, one clear painted line each (minigames.ts LANE_X): you are always on one, a tap moves you one over
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0x8a7a30, emissiveIntensity: 0.35, roughness: 0.6 });
  for (const x of [-2.4, 0, 2.4]) { const l = mesh(new THREE.PlaneGeometry(0.32, 120), laneMat, x, 0.015, -45); l.rotation.x = -Math.PI / 2; l.castShadow = false; sc.add(l); }
  // the store's long side wall on the right, with lit windows, and the shop front facing you at the end
  const wall = std(0x5a3f6e), win = new THREE.MeshStandardMaterial({ color: 0x332, emissive: 0xffd27a, emissiveIntensity: 0.8 });
  box(sc, 2, 9, 110, wall, 7, 4.5, -45);
  for (let z = 5; z > -95; z -= 7) box(sc, 0.1, 3, 4.5, win, 5.95, 2.6, z);
  box(sc, 30, 12, 2, wall, 0, 6, -101);   // the shop front, just past the end of the run (minigames.ts LN_RUN)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: textTex('GAMES', '#ff4fd8', '#140a1a'), toneMapped: false }));
  sign.position.set(0, 8.5, -99.9); sc.add(sign);
  box(sc, 4, 4.5, 0.2, new THREE.MeshStandardMaterial({ color: 0x221, emissive: 0xfff0c0, emissiveIntensity: 1.2 }), 0, 2.25, -99.9);   // the open door
  return { scene: sc, update: (m) => { const h = m.hero ?? { x: 0, z: 0 }; sun.position.set(h.x - 10, 22, h.z + 6); sun.target.position.set(h.x, 0, h.z - 6); } };   // the shadow box follows him
}
/** The TV ad: the game case (assets/scenes/item-six.webp, its name drawn on its blank band as in item.ts) and two lines.
 *  The case arrives after the set is built: the texture is redrawn when it has (expected: a separate file). */
function tvAd(cover?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 282;
  const g = c.getContext('2d'); if (!g) throw new Error('no 2d context for the TV ad');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (im?: HTMLImageElement): void => {
    const gr = g.createLinearGradient(0, 0, 512, 282); gr.addColorStop(0, '#2a0f4a'); gr.addColorStop(1, '#c2186b'); g.fillStyle = gr; g.fillRect(0, 0, 512, 282);
    if (im) {
      const h = 250, w = (im.naturalWidth / im.naturalHeight) * h, x = 24, y = 16; g.drawImage(im, x, y, w, h);
      const k = h / im.naturalHeight; g.save(); g.translate(x + 250 * k, y + 613 * k); g.rotate(-0.034); g.fillStyle = '#fff'; g.font = '900 30px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VI', 0, 0); g.restore();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#000'; g.shadowBlur = 8;
    g.fillStyle = '#ffcc00'; g.font = '900 46px Rubik, system-ui, sans-serif'; g.fillText('VI is', 352, 92); g.fillText('coming!', 352, 140);
    g.fillStyle = '#ffffff'; g.font = '800 24px Rubik, system-ui, sans-serif'; g.fillText('Have you got', 352, 196); g.fillText('your copy?', 352, 226);
    tex.needsUpdate = true;
  };
  draw();
  if (cover) { const im = new Image(); im.onload = () => draw(im); im.src = cover; }
  return tex;
}

function buildRoom(cover?: string): SetData {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x120e1c);
  sc.add(new THREE.HemisphereLight(0x8a8ac8, 0x4a3024, 1.05));
  const moon = new THREE.DirectionalLight(0xaab8ff, 0.9); moon.position.set(-6, 12, 10); sc.add(moon, moon.target);
  const lamp = new THREE.PointLight(0xffb070, 60, 26, 1.4); lamp.position.set(-4, 3.6, -3); sc.add(lamp);
  const tvLight = new THREE.PointLight(0x5aa8ff, 22, 16, 1.6); tvLight.position.set(0, 3.6, -4.6); sc.add(tvLight);
  const pcLight = new THREE.PointLight(0xffd23f, 8, 8, 1.6); pcLight.position.set(6, 2.4, -0.4); sc.add(pcLight);
  const floor = mesh(new THREE.PlaneGeometry(40, 20), std(0x6b4428, { roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  box(sc, 40, 8, 0.3, std(0x3d3352), 0, 4, -6);
  box(sc, 3.2, 3, 0.1, std(0x0d1530), -6, 4.4, -5.8);   // the window, night outside
  sc.add(mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshBasicMaterial({ color: 0xf0ecd0 }), -5.2, 5.2, -5.7));
  const tv = box(sc, 4.3, 2.5, 0.12, new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0x4a90ff, emissiveIntensity: 1 }), 0, 4.1, -5.8);   // high on the wall: her bubbles stay under it
  // on the TV, an ad: the game case from the store and "VI is coming!" (Nadav, 2026-11-18)
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.2), new THREE.MeshBasicMaterial({ map: tvAd(cover), toneMapped: false }));
  ad.position.set(0, 4.1, -5.72); sc.add(ad);
  box(sc, 0.18, 4, 0.18, std(0x222), -4, 2, -3); sc.add(mesh(new THREE.ConeGeometry(0.7, 0.8, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd7a0, emissive: 0xffb070, emissiveIntensity: 0.8, side: THREE.DoubleSide }), -4, 4.1, -3));
  // the couch, its back toward you; she sits on it watching TV
  const red = std(0x8f2533);
  box(sc, 3.6, 0.7, 1.6, red, 0, 0.55, -1.7); box(sc, 3.6, 0.7, 0.4, red, 0, 0.85, -0.8); box(sc, 0.4, 1.0, 1.8, red, -2, 0.8, -1.5); box(sc, 0.4, 1.0, 1.8, red, 2, 0.8, -1.5);
  // the PC on its desk at the far right, its screen says VI
  box(sc, 2.4, 0.12, 1.2, std(0x3a2a1e), 6.2, 1.15, -0.6); box(sc, 0.12, 1.1, 1.1, std(0x3a2a1e), 5.1, 0.55, -0.6); box(sc, 0.12, 1.1, 1.1, std(0x3a2a1e), 7.3, 0.55, -0.6);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ map: textTex('VI', '#ffcc00', '#060608', 256, 160, '900 110px Rubik, system-ui, sans-serif'), toneMapped: false }));
  scr.position.set(6.2, 1.85, -0.9); scr.rotation.y = -0.35; sc.add(scr);
  // the front door, on the left
  box(sc, 0.3, 4.2, 2.2, std(0x4a3020), -6.4, 2.1, 0.5);
  const tvMat = tv.material as THREE.MeshStandardMaterial;
  return { scene: sc, update: (m) => { const f = 0.75 + 0.25 * Math.sin(m.t * 13) * Math.sin(m.t * 3.1); tvMat.emissiveIntensity = f; tvLight.intensity = 22 * f; } };
}

/** The fan's desk at night, behind the PC's login screen (the monitor and the keyboard are drawn over it in 2D):
 *  the wall with posters and a window on the city, the desk top, a lamp, a mug, energy drinks and game cases. */
function buildDesk(): SetData {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x14101e);
  sc.add(new THREE.HemisphereLight(0x8a86c0, 0x3a2418, 0.9));
  const lamp = new THREE.PointLight(0xffb070, 50, 18, 1.4); lamp.position.set(-5.4, 4.6, -0.8); sc.add(lamp);
  const glow = new THREE.PointLight(0x7ab0ff, 26, 12, 1.4); glow.position.set(0, 3.6, 0.8); sc.add(glow);   // the monitor's light on the desk
  box(sc, 30, 14, 0.3, std(0x2c2440), 0, 6, -3.2);   // the wall
  // a window on the city at night, lit windows far away
  const night = document.createElement('canvas'); night.width = 256; night.height = 160;
  const n = night.getContext('2d'); if (!n) throw new Error('no 2d context for the window');
  n.fillStyle = '#0b1230'; n.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 120; i++) { n.fillStyle = ['#ffd27a', '#ff6fd8', '#7ae0ff'][i % 3]!; n.fillRect((i * 37) % 250, 60 + ((i * 53) % 96), 3, 4); }
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(night), toneMapped: false }));
  win.position.set(5.2, 5.6, -3.0); sc.add(win); box(sc, 4.7, 0.2, 0.2, std(0x3a2a1e), 5.2, 4.2, -2.95); box(sc, 4.7, 0.2, 0.2, std(0x3a2a1e), 5.2, 7.0, -2.95);
  // posters
  const poster = (x: number, y: number, rot: number, a: string, b: string): void => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 176; const g = c.getContext('2d'); if (!g) throw new Error('no 2d context for a poster');
    const gr = g.createLinearGradient(0, 0, 0, 176); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 128, 176);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(64, 70, 30, 0, Math.PI * 2); g.fill();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.5), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c) })); m.position.set(x, y, -3.0); m.rotation.z = rot; sc.add(m);
  };
  poster(-5.6, 6.2, 0.05, '#ff3fa4', '#5a1a8a'); poster(-3.2, 6.6, -0.04, '#2fd1c8', '#14305a');
  // the desk: deep enough to fill the bottom of the screen under the 2D monitor and keyboard; the things on it sit at
  // the sides, where the monitor and the keyboard leave it visible
  box(sc, 18, 0.3, 10, std(0x6a442a, { roughness: 0.5 }), 0, 1.0, 1.8);
  const fill = new THREE.DirectionalLight(0xffe2c0, 1.1); fill.position.set(2, 8, 12); sc.add(fill, fill.target);
  box(sc, 0.9, 0.12, 0.9, std(0x222228), -5.4, 1.21, -1.6); box(sc, 0.12, 3.2, 0.12, std(0x222228), -5.4, 2.8, -1.6);
  sc.add(mesh(new THREE.ConeGeometry(0.8, 0.9, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd7a0, emissive: 0xffb070, emissiveIntensity: 0.9, side: THREE.DoubleSide }), -5.4, 4.5, -1.4));
  sc.add(mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.95, 18), std(0xf2ece0), 2.4, 1.63, 3.6));   // the mug, front right (a phone sees only ~±3 u down here)
  sc.add(mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 16), std(0xf2ece0), 2.9, 1.65, 3.6));
  for (const [i, x] of [-2.9, -2.2, -2.55].entries()) sc.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.95, 14), std([0x2fd1c8, 0x3ddc84, 0xff3fa4][i]!, { metalness: 0.6, roughness: 0.3 }), x, 1.63, 3.2 + (i % 2) * 0.6));   // energy drinks, front left
  for (let i = 0; i < 4; i++) box(sc, 1.4, 0.18, 1.8, std([0x1a1a22, 0xc8102e, 0x2a6ad0, 0xffcc00][i]!), 5.6, 1.25 + i * 0.19, -1.4 + (i % 2) * 0.12);   // a stack of game cases, back right
  return { scene: sc };
}

export interface Sets {
  render(m: MiniFrame): void;
  project(x: number, y: number, z: number): { x: number; y: number };
}
export function makeSets(renderer: THREE.WebGLRenderer, touch: boolean, cover?: string): Sets {
  const built: Partial<Record<MiniSet, SetData>> = {};
  const camera = new THREE.PerspectiveCamera(60, 0.5, 0.3, 300);
  const hero = heroWalker();
  hero.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  const people = new Map<number, Person | THREE.Group>();
  // cough droplets (instanced little spheres) and the splats they leave on the floor (instanced flat discs)
  const DROP_MAX = 160, SPLAT_MAX = 120;
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xa6e86a, emissive: 0x3a7a18, emissiveIntensity: 0.5, roughness: 0.3 }), DROP_MAX);
  const splats = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8fd24a, emissive: 0x2a5a10, emissiveIntensity: 0.3, roughness: 0.2, transparent: true, opacity: 0.8, depthWrite: false }), SPLAT_MAX);
  drops.frustumCulled = false; splats.frustumCulled = false;
  const im = new THREE.Matrix4(), iq = new THREE.Quaternion(), ip = new THREE.Vector3(), is = new THREE.Vector3();
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  const pass = new RenderPass(new THREE.Scene(), camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(360, 640), 0.22, 0.4, 0.9);
  composer.addPass(pass); composer.addPass(bloom); composer.addPass(new OutputPass());
  let current: MiniSet | null = null, size = { w: 0, h: 0 };
  const v = new THREE.Vector3();
  function setScene(s: MiniSet): SetData {
    const d = built[s] ?? (built[s] = s === 'office' ? buildOffice(touch) : s === 'line' ? buildLine(touch) : s === 'room' ? buildRoom(cover) : buildDesk());
    if (current !== s) {
      current = s;
      for (const p of people.values()) p.removeFromParent(); people.clear();
      d.scene.add(hero, drops, splats);
      pass.scene = d.scene;
    }
    return d;
  }
  function render(m: MiniFrame): void {
    if (m.w !== size.w || m.h !== size.h) { size = { w: m.w, h: m.h }; composer.setSize(m.w, m.h); bloom.resolution.set(m.w, m.h); }
    renderer.setSize(m.w, m.h, false);
    renderer.toneMappingExposure = m.set === 'room' || m.set === 'desk' ? 1.15 : 1.0;
    const d = setScene(m.set);
    camera.aspect = m.w / m.h; camera.fov = m.cam.fov; camera.position.set(m.cam.x, m.cam.y, m.cam.z); camera.lookAt(m.cam.tx, m.cam.ty, m.cam.tz); camera.updateProjectionMatrix();
    hero.visible = !!m.hero;
    if (m.hero) { hero.position.set(m.hero.x, 0, m.hero.z); hero.rotation.y = m.hero.ry; hero.rotation.x = m.hero.lean ?? 0; animateHero(hero, m.hero.step, m.hero.crouch ?? 0); }
    const seen = new Set<number>();
    for (const p of m.people) {
      seen.add(p.id);
      let o = people.get(p.id);
      // an id can come back as something else (a retried line game deals its campers again): rebuild it then
      if (o && o.userData.role !== p.role) { o.removeFromParent(); people.delete(p.id); o = undefined; }
      if (!o) { o = p.role === 'tent' ? makeTent(p.shirt) : makePerson(p.role, p.id); o.userData.role = p.role; people.set(p.id, o); d.scene.add(o); }
      o.position.set(p.x, 0, p.z); o.rotation.y = p.ry;
      if (p.role === 'tent') continue;
      const q = o as Person; q.shirt.color.setHex(p.shirt); q.mask.visible = !!p.mask;
      const sw = Math.sin(p.step) * 0.5 * (p.walk ?? 0);
      if (p.sit) { q.legs[0]!.rotation.x = q.legs[1]!.rotation.x = -1.45; q.position.y = -0.55; q.upper.rotation.x = -(p.lean ?? 0); }
      else { q.legs[0]!.rotation.x = sw; q.legs[1]!.rotation.x = -sw; q.position.y = 0; q.upper.rotation.x = -(p.lean ?? 0); }
      q.arms[0]!.rotation.x = -sw * 0.8; q.arms[1]!.rotation.x = sw * 0.8;
      if (p.lean && p.lean > 0.2) { q.arms[0]!.rotation.x = q.arms[1]!.rotation.x = -1.6; }   // hands up: "EW!"
    }
    for (const [id, o] of people) if (!seen.has(id)) { o.removeFromParent(); people.delete(id); }
    drops.count = Math.min(DROP_MAX, m.drops.length);
    for (let i = 0; i < drops.count; i++) { const q = m.drops[i]!; im.compose(ip.set(q.x, q.y, q.z), iq.identity(), is.setScalar(q.r)); drops.setMatrixAt(i, im); }
    drops.instanceMatrix.needsUpdate = true;
    splats.count = Math.min(SPLAT_MAX, m.splats.length);
    for (let i = 0; i < splats.count; i++) { const q = m.splats[i]!; im.compose(ip.set(q.x, 0.02 + i * 0.0004, q.z), iq.identity(), is.set(q.r, 1, q.r * 0.8)); splats.setMatrixAt(i, im); }
    splats.instanceMatrix.needsUpdate = true;
    (splats.material as THREE.MeshStandardMaterial).opacity = m.splats.length ? Math.max(...m.splats.map((q) => q.o)) * 0.8 : 0;
    d.update?.(m);
    composer.render();
  }
  function project(x: number, y: number, z: number): { x: number; y: number } { v.set(x, y, z).project(camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; }
  return { render, project };
}
