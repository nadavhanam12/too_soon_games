// Run via esbuild --bundle --platform=node. Checks pose continuity/hierarchy, not browser FPS.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { heroCar, heroWalker, animateHeroCar, animateHero } from '../src/models/hero';

const car = heroCar(new THREE.Group());
const rig = car.userData.heroRig;
car.wheels![0]!.rotation.x = 0.8;
animateHeroCar(car, 0, 1, true, false);
assert(car.wheels![0]!.rotation.y < 0 && car.wheels![1]!.rotation.y < 0, 'front wheels must steer');
assert.equal(car.wheels![2]!.rotation.y, 0, 'rear axle must not steer');
assert.equal(car.wheels![0]!.rotation.x, 0.8, 'steering must preserve tire spin');
assert(Math.abs(rig.steering.quaternion.w) < 1, 'steering wheel must turn');
assert(rig.driver.rotation.x > 0, 'acceleration should lean the driver back');
animateHeroCar(car, 0, 0, false, true);
assert(rig.driver.rotation.x < 0, 'braking should lean the driver forward');
animateHeroCar(car, 0, 0, false, false, 0.35);
assert(rig.door.rotation.y < -1, 'door must open outward before exit');
animateHeroCar(car, 0, 0, false, false, 1);
assert(Math.abs(rig.door.rotation.y) < 1e-8, 'door must close after exit');

const walker = heroWalker();
assert.equal(walker.calves[0]!.parent, walker.legs[0], 'knees must follow the thigh');
assert.equal(walker.calves[1]!.parent, walker.legs[1]);
for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, 2 * Math.PI]) {
  for (const entry of [0, 0.5, 1]) {
    animateHero(walker, phase, entry); walker.updateMatrixWorld(true);
    walker.traverse((o) => assert(o.matrixWorld.elements.every(Number.isFinite), 'all exit/walk poses must stay finite'));
    assert(walker.calves.every((m) => m.rotation.x <= 0), 'knees must bend backward, not hyperextend');
  }
}
animateHero(walker, 1.3, 0);
const pose = walker.head.quaternion.clone();
animateHero(walker, 1.3, 0);
assert(walker.head.quaternion.equals(pose), 'pose evaluation must not accumulate drift');
animateHero(walker, 0, 0); walker.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(walker);
assert(bounds.min.y > -0.15 && bounds.min.y < 0.15, 'standing feet should meet the ground');
console.log('Hero steering, braking, door, knee hierarchy and 15 exit/walk poses passed.');
