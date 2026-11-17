// Generated in Blender by tools/build_hero.py; bundled only inside the lazy renderer.
// Vertex colours merge the many Blender objects into one draw per animated part.
import * as THREE from 'three';
import data from './hero-data.json';

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.08 });
const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.26, metalness: 0.25 });
const paint = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.12, clearcoat: 0 });
const chrome = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 });
for (const m of [material, glass, paint, chrome]) m.userData.heroShared = true;
export function setHeroLook(look: number): void {
  paint.roughness = look === 4 ? 0.23 : 0.5; paint.metalness = look === 4 ? 0.3 : 0.12;
  paint.clearcoat = look === 4 ? 0.65 : 0;
  paint.needsUpdate = true;
  chrome.roughness = look === 4 ? 0.2 : 0.4; chrome.metalness = look === 4 ? 0.7 : 0.35;
  glass.roughness = look === 4 ? 0.17 : 0.26;
}
type Part = keyof typeof data;
const cache = new Map<Part, THREE.BufferGeometry>();
function part(name: Part): THREE.Mesh {
  let geometry = cache.get(name);
  const d = data[name];
  if (!geometry) {
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(d.c, 3));
    // Split car surfaces only: skin and cloth keep the matte material.
    if (name === 'body' || name === 'door' || name.startsWith('wheel')) {
      const buckets: number[][] = [[], [], []];
      for (let i = 0; i < d.i.length; i += 3) {
        const vi = d.i[i]! * 3, r = d.c[vi]!, g = d.c[vi + 1]!, b = d.c[vi + 2]!;
        const slot = (name === 'body' || name === 'door') && r > 0.3 && g < 0.035 && b < 0.12 ? 1 : r > 0.28 && g > 0.3 && b > 0.3 ? 2 : 0;
        buckets[slot]!.push(d.i[i]!, d.i[i + 1]!, d.i[i + 2]!);
      }
      geometry.setIndex(buckets.flat());
      let offset = 0;
      buckets.forEach((indices, slot) => { if (indices.length) geometry!.addGroup(offset, indices.length, slot); offset += indices.length; });
    } else geometry.setIndex(d.i);
    // Preserve the deliberately faceted early-3D art direction.
    geometry = geometry.toNonIndexed(); geometry.computeVertexNormals();
    geometry.computeBoundingSphere(); geometry.userData.heroShared = true; cache.set(name, geometry);
  }
  const mesh = new THREE.Mesh(geometry, name === 'glass' ? glass : name === 'body' || name === 'door' || name.startsWith('wheel') ? [material, paint, chrome] : material);
  mesh.name = name; mesh.position.set(d.pivot[0]!, d.pivot[1]!, d.pivot[2]!);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

export function heroCar<T extends THREE.Group & { wheels?: THREE.Mesh[]; driver?: THREE.Object3D }>(g: T): T {
  g.add(part('body'), part('glass'));
  g.wheels = [part('wheel0'), part('wheel1'), part('wheel2'), part('wheel3')];
  for (const wheel of g.wheels) wheel.rotation.order = 'YXZ';
  g.add(...g.wheels);
  const door = part('door'), steering = part('steering'); g.add(door, steering);
  const driver = new THREE.Group(); driver.position.set(-0.48, 1.22, 0.48);
  const torso = part('driver'), head = part('driverHead'), arms = [part('driverArmL'), part('driverArmR')];
  for (const mesh of [torso, head, ...arms]) { mesh.position.sub(driver.position); driver.add(mesh); }
  g.driver = driver; g.add(driver);
  g.userData.heroRig = { door, steering, driver, head, arms, front: g.wheels.slice(0, 2) } satisfies CarRig;
  g.scale.setScalar(1.4);
  return g;
}

interface CarRig { door: THREE.Mesh; steering: THREE.Mesh; driver: THREE.Group; head: THREE.Mesh; arms: THREE.Mesh[]; front: THREE.Mesh[] }
const steeringAxis = new THREE.Vector3(0, 0.5, -0.866).normalize();
const smooth = (n: number): number => { n = Math.max(0, Math.min(1, n)); return n * n * (3 - 2 * n); };
export function animateHeroCar(g: THREE.Group, t: number, steer = 0, gas = false, brake = false, exit?: number): void {
  const rig = g.userData.heroRig as CarRig | undefined; if (!rig) return;
  for (const w of rig.front) w.rotation.y = -steer * 0.48;
  rig.steering.quaternion.setFromAxisAngle(steeringAxis, -steer * 0.95);
  rig.driver.rotation.set((brake ? -0.075 : gas ? 0.035 : 0) + Math.sin(t * 2) * 0.004, 0, steer * 0.075);
  rig.head.rotation.y = -steer * 0.17; rig.head.rotation.x = brake ? -0.025 : 0.02;
  rig.arms[0]!.rotation.z = steer * 0.12; rig.arms[1]!.rotation.z = steer * 0.12;
  const open = exit === undefined ? 0 : exit < 0.7 ? smooth(exit / 0.28) : 1 - smooth((exit - 0.7) / 0.3);
  rig.door.rotation.y = -open * 1.08;
  if (exit !== undefined && exit < 0.32) { rig.driver.rotation.z += smooth(exit / 0.32) * 0.20; rig.head.rotation.y = -0.3 * open; }
}

export type HeroWalker = THREE.Group & { legs: THREE.Mesh[]; calves: THREE.Mesh[]; arms: THREE.Mesh[]; head: THREE.Mesh; hips: THREE.Group };
export function heroWalker(): HeroWalker {
  const g = new THREE.Group() as HeroWalker;
  const hips = new THREE.Group(); hips.position.y = 0.96; g.add(hips); g.hips = hips;
  g.head = part('head'); g.legs = [part('legL'), part('legR')]; g.calves = [part('calfL'), part('calfR')]; g.arms = [part('armL'), part('armR')];
  for (const mesh of [part('torso'), g.head, ...g.legs, ...g.arms]) { mesh.position.y -= 0.96; hips.add(mesh); }
  for (let i = 0; i < 2; i++) {
    // Child pivots are relative to the hip, not the world-space positions in the exported file.
    g.calves[i]!.position.sub(new THREE.Vector3(data[i ? 'legR' : 'legL'].pivot[0]!, 0.96, 0));
    g.legs[i]!.add(g.calves[i]!);
  }
  // Same world-space head and shoulder proportions as the seated driver.
  g.scale.setScalar(1.4);
  return g;
}

export function animateHero(g: HeroWalker, phase: number, entry = 0): void {
  const stride = Math.sin(phase) * 0.52 * (1 - entry);
  g.hips.position.y = 0.96 + Math.abs(Math.sin(phase)) * 0.025 * (1 - entry) - entry * 0.28;
  g.hips.rotation.set(-0.07 - entry * 0.18, Math.sin(phase) * 0.045 * (1 - entry), Math.sin(phase) * 0.025 * (1 - entry));
  g.legs[0]!.rotation.x = stride + entry * 0.55; g.legs[1]!.rotation.x = -stride + entry * 0.55;
  g.calves[0]!.rotation.x = -Math.max(0, -Math.sin(phase)) * 0.65 * (1 - entry) - entry * 0.9;
  g.calves[1]!.rotation.x = -Math.max(0, Math.sin(phase)) * 0.65 * (1 - entry) - entry * 0.9;
  g.arms[0]!.rotation.x = -stride * 0.65 + 0.10; g.arms[1]!.rotation.x = stride * 0.65 + 0.10;
  // Slumped shoulders and a small impatient glance give the worker a hurried, tired gait.
  g.arms[0]!.rotation.z = -0.045; g.arms[1]!.rotation.z = 0.045;
  g.head.rotation.set(-0.045 + Math.sin(phase * 2) * 0.018, Math.sin(phase * 0.5) * 0.075, 0);
}
