// The 3D renderer for the driving world, ported from the "Sun City Heist" scene (Scene/sun-city-heist.html): sky dome
// with a sun, warm fog, soft shadows, a little bloom, merged static city meshes, glossy cars, pixelated output.
// Built on its own to lazy/world3d.js (DECISIONS 72) and loaded after the first frame, so three.js stays out of
// index.html. It never reads game state: drive.ts hands it the city once (create) and a snapshot every frame (render).
// Math.random here is visual only (window textures, sparks); it never touches gameplay.
import * as THREE from 'three';
import { heroCar, heroWalker, animateHero } from '../models/hero';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MatKey, Prim } from '../city';
import type { CarKind, CityData, Frame, Look, World3D } from '../world3d-api';

const SIGN_FONT = '900 64px Rubik, system-ui, sans-serif';
// ---------- the behind-the-car looks (3 and 4) ----------
// The camera behind the car, [standing still, top speed]: it backs off, rises and widens as the speed goes up
// (Nadav, 2026-11-17, picked from three: 14→18 / 6.5→8.5 / fov 58 was too close, 13→34 / 6.5→15 / 58→72 too far).
const CHASE_CAM: { back: [number, number]; h: [number, number]; fov: [number, number] } = { back: [13, 25], h: [6, 10], fov: [58, 66] };
const CHASE_PULL_BACK = 8, CHASE_PULL_H = 9;     // extra distance / height with a chaser on the bumper (Frame.cam.pull = 1)
const CHASE_FOV = 58;
const CHASE_TURN_LAG = 0.004;                    // the camera's heading closes this fraction of its gap to the car's per second (smaller = stiffer)
const ARROW_TILT = 0.95;                         // the goal arrow leans back toward the camera (rad)
const ARROW_SIZE = 0.6;                          // (Nadav: smaller)
const ARROW_DIST = 30, ARROW_UP = 6.2;           // where it hangs in front of the camera (in the camera's own frame, so it holds its place on screen)
const NEON = [0xff2fd0, 0x2ff3ff, 0xff8a2f, 0x9b4dff, 0x3dff8a];   // look 4: the bands around tall buildings
/** 0..1 from a position: which buildings get a neon band and in which colour, the same on every run. */
const hash = (a: number, b: number): number => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };

function create(city: CityData): World3D {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xf0e2c8, 0.0018);
  scene.background = new THREE.Color(0xf0e2c8);
  const camera = new THREE.PerspectiveCamera(40, 360 / 640, 0.5, 1500);

  // ---------- sky ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: new THREE.Vector3(0.4, 0.5, -1).normalize() }, top: { value: new THREE.Vector3() }, mid: { value: new THREE.Vector3() }, low: { value: new THREE.Vector3() }, sunK: { value: 1 } },
    vertexShader: 'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 v;uniform vec3 sunDir,top,mid,low;uniform float sunK;
      void main(){float h=v.y;
        vec3 c=mix(low,mid,smoothstep(-.02,.18,h));c=mix(c,top,smoothstep(.15,.6,h));
        float d=dot(v,sunDir);
        c+=vec3(1.,.85,.45)*smoothstep(.9965,.998,d)*3.*sunK;
        c+=vec3(1.,.9,.6)*pow(max(d,0.),30.)*.5*sunK;
        gl_FragColor=vec4(c,1.);}`,
  }));
  scene.add(sky);
  const skyU = (sky.material as THREE.ShaderMaterial).uniforms;
  const skyTop = skyU.top!.value as THREE.Vector3, skyMid = skyU.mid!.value as THREE.Vector3, skyLow = skyU.low!.value as THREE.Vector3;
  const fog = scene.fog as THREE.FogExp2;
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a60, 1.0);
  scene.add(hemi);
  const sunL = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sunL.castShadow = true;
  sunL.shadow.mapSize.set(2048, 2048);
  const sc = sunL.shadow.camera; sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.far = 400;
  scene.add(sunL, sunL.target);

  // ---------- ground, sea, lane markings ----------
  const { bmin, bmax } = city, bsize = bmax - bmin, bmid = (bmin + bmax) / 2;
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x55565c, roughness: 0.9, metalness: 0 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2d15a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(bsize + 8, bsize + 8), groundMat);
  ground.position.set(bmid, 0, bmid); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x2a8ac8, roughness: 0.3, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(bmid, -0.6, bmid); scene.add(sea);
  {
    const CELL = 56, N = 6;
    const lines = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.4, 4), lineMat, 4000);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    let li = 0;
    for (let k = -N; k <= N + 1; k++) {
      const r = k * CELL - CELL / 2;
      for (let t = -N * CELL; t < N * CELL; t += 8) {
        e.set(-Math.PI / 2, 0, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(r, 0.02, t), q, one); lines.setMatrixAt(li++, m4);
        e.set(-Math.PI / 2, 0, Math.PI / 2); q.setFromEuler(e); m4.compose(new THREE.Vector3(t, 0.02, r), q, one); lines.setMatrixAt(li++, m4);
      }
    }
    lines.count = li; scene.add(lines);
  }

  // ---------- the static city, merged into one mesh per material ----------
  const tex = windowTex();
  // looks 3 and 4: the same window grid with four times the pixels and smooth filtering, and grain on the asphalt
  const texHi = windowTexHi(renderer.capabilities.getMaxAnisotropy());
  const asphalt = asphaltTex(renderer.capabilities.getMaxAnisotropy());
  type Key = MatKey | 'sign';
  // the lit windows glow only in the evening (emissiveIntensity follows the frame's dusk)
  const bldgMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.map, emissive: 0xffffff, emissiveMap: tex.lit, emissiveIntensity: 0, roughness: 0.85, metalness: 0 });
  const MATS: Record<Key, { mat: THREE.Material; cast: boolean; recv: boolean }> = {
    bldg: { mat: bldgMat, cast: true, recv: true },
    plain: { mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), cast: false, recv: true },
    tree: { mat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), cast: true, recv: false },
    neon: { mat: new THREE.MeshBasicMaterial({ vertexColors: true }), cast: false, recv: false },
    sign: { mat: new THREE.MeshBasicMaterial({ vertexColors: true }), cast: false, recv: false },   // neon bands, look 4 only
  };
  let signs: THREE.Mesh | null = null;
  const buckets = new Map<Key, THREE.BufferGeometry[]>();
  const tmpCol = new THREE.Color();
  const M = (x: number, y: number, z: number, ry = 0, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  function addStatic(key: Key, g0: THREE.BufferGeometry, matrix: THREE.Matrix4, color: number): void {
    const g = g0.index ? g0.toNonIndexed() : g0; g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
    const n = g.attributes.position!.count, c = new Float32Array(n * 3); tmpCol.set(color);
    for (let i = 0; i < n; i++) { c[i * 3] = tmpCol.r; c[i * 3 + 1] = tmpCol.g; c[i * 3 + 2] = tmpCol.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(g);
  }
  const sidewalk = (() => {
    const h = (40 + 3) / 2, r = 9, sh = new THREE.Shape();
    sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h);
    sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g;
  })();
  for (const p of city.prims) addPrim(p);
  for (const [key, geos] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(geos), MATS[key].mat);
    m.castShadow = MATS[key].cast; m.receiveShadow = MATS[key].recv; scene.add(m);
    if (key === 'sign') { signs = m; m.visible = false; }
  }

  function addPrim(p: Prim): void {
    switch (p.k) {
      case 'box': {
        const g = new THREE.BoxGeometry(p.w, p.h, p.d);
        if (p.win) winUV(g, p.w, p.d, p.h, false, p.win);
        addStatic(p.m, g, M(p.x, p.y, p.z, p.ry ?? 0), p.col);
        if (p.m === 'bldg' && p.h > 9) {   // most tall buildings carry a neon band (lit in look 4)
          const r1 = hash(p.x, p.z), r2 = hash(p.z, p.x + 7);
          if (r1 < 0.75) addStatic('sign', new THREE.BoxGeometry(p.w + 0.5, 0.6, p.d + 0.5), M(p.x, p.y - p.h / 2 + p.h * (0.3 + 0.55 * r2), p.z, p.ry ?? 0), NEON[Math.floor(r2 * 97) % NEON.length]!);
        }
        break;
      }
      case 'cyl': {
        const g = new THREE.CylinderGeometry(p.rt, p.rb, p.h, p.seg, 1, !!p.open);
        if (p.win) winUV(g, Math.PI * 2 * p.rt, 0, p.h, true, p.win);
        if (p.sx || p.sz) g.scale(p.sx ?? 1, 1, p.sz ?? 1);
        addStatic(p.m, g, M(p.x, p.y, p.z), p.col); break;
      }
      case 'cone': addStatic(p.m, new THREE.ConeGeometry(p.r, p.h, p.seg), M(p.x, p.y, p.z), p.col); break;
      case 'roof': {
        const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(p.w, 2.6, p.d);
        addStatic('plain', g, M(p.x, p.y, p.z), p.col); break;
      }
      case 'palm': {
        const base = M(p.x, 0.4, p.z, p.ry);
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, p.h * 0.5, 0), new THREE.Vector3(1.4, p.h, 0)]);
        addStatic('tree', new THREE.TubeGeometry(curve, 6, 0.28, 5), base, 0x8a6a44);
        for (let k = 0; k < 7; k++) { const g = new THREE.PlaneGeometry(1.3, 5.5); g.translate(0, 2.75, 0); addStatic('tree', g, base.clone().multiply(M(1.4, p.h, 0, (k / 7) * Math.PI * 2, 1.15)), 0x4a8a2e); }
        break;
      }
      case 'ribbon': addStatic('plain', ribbon(p.pts, p.w, p.y), new THREE.Matrix4(), p.col); break;
      case 'sidewalk': addStatic('plain', sidewalk.clone(), M(p.x, 0, p.z), p.col); break;
      case 'sign': {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshBasicMaterial({ map: signTex(p.text, p.bg, p.fg, p.w / p.h), toneMapped: false }));
        m.position.set(p.x, p.y, p.z); m.rotation.set(p.rx ?? -Math.PI / 2, 0, 0); m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), p.ry);
        scene.add(m); break;
      }
    }
  }

  // street lamps: glowing points
  const glowTex = glowTexture();
  const lampMat = new THREE.PointsMaterial({ map: glowTex, size: 6, color: 0xffc890, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  // in the evening every lamp also throws a warm pool of light on the road under it
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  {
    const pos: number[] = [];
    for (const l of city.lamps) pos.push(l.x, 7.1, l.z);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), lampMat));
    const pg = new THREE.PlaneGeometry(POOL_D, POOL_D); pg.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(pg, poolMat, Math.max(1, city.lamps.length));
    const m4 = new THREE.Matrix4();
    city.lamps.forEach((l, i) => pools.setMatrixAt(i, m4.makeTranslation(l.x, 0.2, l.z)));
    pools.count = city.lamps.length; pools.frustumCulled = false; scene.add(pools);
  }

  // ---------- time of day: everything that differs between daylight (0) and evening (1) ----------
  const DAY = { fog: new THREE.Color(0xf0e2c8), sky: new THREE.Color(0xcfe8ff), gnd: new THREE.Color(0x8a7a60), sun: new THREE.Color(0xfff2d8), off: new THREE.Vector3(50, 110, 35) };
  const EVE = { fog: new THREE.Color(0x4a3358), sky: new THREE.Color(0xb0b4f0), gnd: new THREE.Color(0x907080), sun: new THREE.Color(0xffb070), off: new THREE.Vector3(95, 75, 30) };
  const SKY_EVE = [new THREE.Vector3(0.1, 0.08, 0.3), new THREE.Vector3(0.55, 0.25, 0.5), new THREE.Vector3(1, 0.55, 0.3)];   // top, middle, horizon
  const sunOff = DAY.off.clone();
  let dusk = -1;
  function setDusk(d: number): void {
    if (d === dusk) return;
    dusk = d;
    scene.fog!.color.copy(DAY.fog).lerp(EVE.fog, d); (scene.background as THREE.Color).copy(scene.fog!.color);
skyTop.set(0.25, 0.5, 0.95).lerp(SKY_EVE[0]!, d); skyMid.set(0.55, 0.75, 1).lerp(SKY_EVE[1]!, d); skyLow.set(0.98, 0.92, 0.8).lerp(SKY_EVE[2]!, d);
    hemi.color.copy(DAY.sky).lerp(EVE.sky, d); hemi.groundColor.copy(DAY.gnd).lerp(EVE.gnd, d); hemi.intensity = 1 - (1 - EVE_HEMI) * d;
    sunL.color.copy(DAY.sun).lerp(EVE.sun, d); sunL.intensity = 2.4 - (2.4 - EVE_SUN) * d;
    sunOff.copy(DAY.off).lerp(EVE.off, d);   // a low sun: long shadows
    bldgMat.emissiveIntensity = EVE_WINDOWS * d;
    lampMat.size = 6 + 5 * d; poolMat.opacity = EVE_POOL * d; poolMat.visible = d > 0;
    HEAD_MAT.opacity = EVE_HEAD * d; TAIL_MAT.opacity = EVE_TAIL * d; HEAD_MAT.visible = TAIL_MAT.visible = d > 0;
    bloom.strength = 0.2 + 0.25 * d;
    renderer.toneMappingExposure = 1 + (EVE_EXPOSURE - 1) * d;   // the dark asphalt sinks to black under the dim light without it
  }

  // ---------- the look: the top view (2), or one of the two behind-the-car looks laid over the time of day ----------
  let look: Look = 2, snapCam = true, camA = 0, camSp = 0;   // camA: the heading the behind-the-car camera looks along (it trails the car's)
  function setLook(l: Look): void {
    look = l; snapCam = true;
    const d = dusk; dusk = -1; setDusk(d);
    const hi = l > 2;
    for (const r of [composer.renderTarget1, composer.renderTarget2]) { r.samples = hi ? 4 : 0; r.dispose(); }   // smooth edges
    bldgMat.map = hi ? texHi.map : tex.map; bldgMat.emissiveMap = hi ? texHi.lit : tex.lit; bldgMat.needsUpdate = true;
    groundMat.map = hi ? asphalt : null; groundMat.roughness = l === 4 ? 0.45 : 0.9; groundMat.needsUpdate = true;
    const r = hi ? 70 : 130; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.updateProjectionMatrix();   // sharper shadows near the car
    camera.fov = hi ? CHASE_FOV : 40; camera.updateProjectionMatrix();
    if (signs) signs.visible = l === 4;
    grade.enabled = hi;
    fog.density = 0.0018; skyU.sunK!.value = 1; (skyU.sunDir!.value as THREE.Vector3).set(0.4, 0.5, -1).normalize();
    let paint = 1;   // the road paint is unlit: it has to be dimmed by hand where the light is low
    if (l === 3) {   // early 3D: an overcast day, soft cool haze
      fog.color.setHex(0xa9b4b0); fog.density = 0.0055;
      skyTop.set(0.5, 0.6, 0.7); skyMid.set(0.68, 0.74, 0.78); skyLow.set(0.8, 0.83, 0.82); skyU.sunK!.value = 0;
      hemi.color.setHex(0xc8d2c8); hemi.groundColor.setHex(0x6a7068); hemi.intensity = 1.25;
      sunL.color.setHex(0xf4f0e0); sunL.intensity = 1.9; sunOff.set(60, 90, 40);
      grade.uniforms.sat!.value = 0.82; (grade.uniforms.tint!.value as THREE.Vector3).set(0.97, 1, 0.98);
      paint = 0.85;
    } else if (l === 4) {   // sunset: pink sky, a low orange sun, neon, lit windows; glow and exposure held back so nothing burns out
      fog.color.setHex(0xf08aa8); fog.density = 0.0042;
      skyTop.set(0.2, 0.12, 0.48); skyMid.set(0.96, 0.36, 0.56); skyLow.set(1, 0.72, 0.38);
      sunOff.set(-95, 30, -55); (skyU.sunDir!.value as THREE.Vector3).copy(sunOff).normalize();
      hemi.color.setHex(0xff9ad0); hemi.groundColor.setHex(0x40306a); hemi.intensity = 0.95;
      sunL.color.setHex(0xff9050); sunL.intensity = 2.6;
      bloom.strength = 0.16; renderer.toneMappingExposure = 0.93; bldgMat.emissiveIntensity = 1.7;
      HEAD_MAT.opacity = Math.min(HEAD_MAT.opacity, 0.3); TAIL_MAT.opacity = Math.min(TAIL_MAT.opacity, 0.3);
      grade.uniforms.sat!.value = 1.15; (grade.uniforms.tint!.value as THREE.Vector3).set(1.03, 0.98, 1.04);
      paint = 0.5;
    }
    (scene.background as THREE.Color).copy(fog.color);
    (MATS.neon.mat as THREE.MeshBasicMaterial).color.setScalar(paint); lineMat.color.setHex(0xf2d15a).multiplyScalar(paint);
  }


  // ---------- dynamic things ----------
  const cars = new Map<number, CarGroup>();
  const helis = new Map<number, HeliGroup>();
  const heliLamp = new THREE.Vector3(), heliDir = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
  // tire marks: a ring of flat quads that darken the road (multiply blend) and fade back to nothing
  const SKIDS = 900, SKID_LIFE = 9, SKID_FADE = 4;
  const skidGeo = new THREE.PlaneGeometry(1, 1); skidGeo.rotateX(-Math.PI / 2);
  const skids = new THREE.InstancedMesh(skidGeo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
  }), SKIDS);
  skids.frustumCulled = false; skids.renderOrder = 1;
  const skidBorn = new Float32Array(SKIDS).fill(-1e9);
  const skidM = new THREE.Matrix4(), skidQ = new THREE.Quaternion(), skidE = new THREE.Euler(), skidP = new THREE.Vector3(), skidS = new THREE.Vector3(), skidC = new THREE.Color();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  let skidI = 0, skidLive = false;
  function clearSkids(): void {
    skidBorn.fill(-1e9); skidLive = false;
    for (let i = 0; i < SKIDS; i++) { skids.setMatrixAt(i, hidden); skids.setColorAt(i, skidC.setRGB(1, 1, 1)); }
    skids.instanceMatrix.needsUpdate = true; skids.instanceColor!.needsUpdate = true;
  }
  clearSkids(); scene.add(skids);
  function skid(x: number, z: number, x2: number, z2: number, t: number): void {
    const dx = x2 - x, dz = z2 - z;
    skidE.set(0, Math.atan2(dx, dz), 0); skidQ.setFromEuler(skidE);
    skidM.compose(skidP.set((x + x2) / 2, 0.04, (z + z2) / 2), skidQ, skidS.set(0.6, 1, Math.hypot(dx, dz) + 0.25));
    skids.setMatrixAt(skidI, skidM); skidBorn[skidI] = t; skidI = (skidI + 1) % SKIDS;
    skids.instanceMatrix.needsUpdate = true; skidLive = true;
  }
  function fadeSkids(t: number): void {
    if (!skidLive) return;
    skidLive = false;
    for (let i = 0; i < SKIDS; i++) {
      const age = t - skidBorn[i]!;
      if (age > SKID_LIFE) { if (skidBorn[i]! > -1e8) { skidBorn[i] = -1e9; skids.setMatrixAt(i, hidden); skids.instanceMatrix.needsUpdate = true; } continue; }
      skidLive = true;
      const k = 0.5 + 0.5 * Math.max(0, (age - (SKID_LIFE - SKID_FADE)) / SKID_FADE);   // 0.5 = the road at half brightness
      skids.setColorAt(i, skidC.setRGB(k, k, k));
    }
    skids.instanceColor!.needsUpdate = true;
  }
  const walker = heroWalker(); walker.visible = false; scene.add(walker);
  const goalArrow = makeGoalArrow(); goalArrow.visible = false; scene.add(goalArrow);
  // pedestrians: the walker's blocky build in the city's colours, drawn instanced (one draw call per body part)
  const peds = makePeds(); for (const m of peds.all) scene.add(m);
  const pedM = new THREE.Matrix4(), pedL = new THREE.Matrix4(), pedT = new THREE.Matrix4(), pedQ = new THREE.Quaternion(), pedE = new THREE.Euler(0, 0, 0, 'YXZ'), pedP = new THREE.Vector3(), pedS = new THREE.Vector3(), pedC = new THREE.Color();
  const picks = new Map<number, THREE.Group>();
  const letters = new Map<number, THREE.Mesh>();
  const markers = new Map<string, THREE.Group>();
  const cashGeo = new THREE.BoxGeometry(1.6, 1, 1);
  const cashMat = new THREE.MeshStandardMaterial({ color: 0x2bd35a, emissive: 0x1bff5a, emissiveIntensity: 1.2 });
  const canGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.5, 10);
  const canMat = new THREE.MeshStandardMaterial({ color: 0x2fd1c8, emissive: 0x0d8f88, emissiveIntensity: 0.8 });
  const ringGeo = new THREE.RingGeometry(1.6, 2.1, 32);
  const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 40, 8, 1, true);
  const beamMat = (col: number) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamCash = beamMat(0x3dff7a), beamCan = beamMat(0x3df0ff);
  const ringMat = (col: number) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  // HR sight circles: a disc and an edge per minivan, made when first needed
  const hrDiscGeo = new THREE.CircleGeometry(1, 40), hrDiscMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.22, depthWrite: false });
  const hrEdgeGeo = new THREE.RingGeometry(0.96, 1, 48), hrEdgeMat = new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const hrRings: Array<{ disc: THREE.Mesh; edge: THREE.Mesh }> = [];
  const hrRingAt = (i: number): { disc: THREE.Mesh; edge: THREE.Mesh } => {
    while (hrRings.length <= i) {
      const disc = new THREE.Mesh(hrDiscGeo, hrDiscMat), edge = new THREE.Mesh(hrEdgeGeo, hrEdgeMat);
      disc.rotation.x = edge.rotation.x = -Math.PI / 2; scene.add(disc); scene.add(edge); hrRings.push({ disc, edge });
    }
    return hrRings[i]!;
  };

  interface Part extends THREE.Sprite { v: THREE.Vector3; life: number; smoke: boolean }
  const parts: Part[] = [];
  const sparkMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false });
  const smokeMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x8a7090, transparent: true, opacity: 0.35, depthWrite: false });
  function burst(x: number, z: number, color: number, n = 16, spd = 12): void {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(sparkMat.clone()) as unknown as Part; s.material.color.set(color); s.position.set(x, 1, z); s.scale.setScalar(1.2);
      s.v = new THREE.Vector3((Math.random() - 0.5) * spd, Math.random() * spd * 0.8, (Math.random() - 0.5) * spd); s.life = 0.7 + Math.random() * 0.4; s.smoke = false;
      scene.add(s); parts.push(s);
    }
  }
  function smoke(x: number, z: number): void {
    const s = new THREE.Sprite(smokeMat.clone()) as unknown as Part; s.position.set(x, 0.5, z); s.scale.setScalar(1.5);
    s.v = new THREE.Vector3((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2); s.life = 0.8; s.smoke = true;
    scene.add(s); parts.push(s);
  }

  // ---------- post ----------
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(360, 640), 0.2, 0.3, 0.92);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  // colour grade of the behind-the-car looks (off in the top view): saturation and a tint
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, sat: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D tDiffuse;uniform float sat;uniform vec3 tint;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(.299,.587,.114));gl_FragColor=vec4(mix(vec3(l),c.rgb,sat)*tint,1.);}',
  });
  grade.enabled = false; composer.addPass(grade);

  let size = { w: 0, h: 0 }, lastT = 0;
  const v3 = new THREE.Vector3(), camGoal = new THREE.Vector3();

  function render(f: Frame): void {
    if (f.w !== size.w || f.h !== size.h) {
      size = { w: f.w, h: f.h };
      renderer.setSize(f.w, f.h, false); composer.setSize(f.w, f.h); bloom.resolution.set(f.w, f.h);
      camera.aspect = f.w / f.h; camera.updateProjectionMatrix();
    }
    if (f.t < lastT) { clearSkids(); snapCam = true; }   // a new leg restarted the clock
    const duskNew = f.dusk !== dusk;
    setDusk(f.dusk);
    if (f.look !== look || (duskNew && look > 2)) setLook(f.look);
    const dt = Math.max(0, Math.min(0.05, f.t - lastT)); lastT = f.t;
    // cars
    const seen = new Set<number>();
    for (const c of f.cars) {
      seen.add(c.id);
      let g = cars.get(c.id);
      if (!g || g.kind !== c.kind) { if (g) scene.remove(g); g = makeCar(c.kind, c.color, glowTex); cars.set(c.id, g); scene.add(g); }
      const prevX = g.position.x, prevZ = g.position.z;
      // the body spring (player only): tail-out yaw, roll, squat / dive, squash / stretch along the car
      const pitch = c.pitch ?? 0, roll = c.roll ?? 0, sq = c.sq ?? 0;
      g.position.set(c.x, Math.abs(pitch) * 4 + Math.abs(roll) * 2, c.y);   // lifted so the tilted floor shadow stays above the road
      g.rotation.y = -(c.a + (c.kick ?? 0)) - Math.PI / 2;   // the scene's yaw: nose along -z at 0
      g.rotation.x = pitch; g.rotation.z = -roll;
      g.scale.set(1.4 * (1 + sq * 0.6), 1.4, 1.4 * (1 - sq));
      if (g.glow) { const m = g.glow.material as THREE.MeshBasicMaterial; m.opacity += ((c.brake ? 0.9 : 0) - m.opacity) * Math.min(1, dt * 18); g.glow.visible = m.opacity > 0.02; }
      const moved = Math.hypot(c.x - prevX, c.y - prevZ);
      if (g.wheels && moved < 20) for (const w of g.wheels) w.rotation.x -= moved / 0.42;
      if (g.driver) g.driver.visible = !c.empty;
      if (g.red && g.blue) { const fl = Math.floor(f.t * 8) % 2; g.red.color.setHex(fl ? 0xff0020 : 0x220004); g.blue.color.setHex(fl ? 0x000820 : 0x0030ff); }
    }
    for (const [id, g] of cars) if (!seen.has(id)) { scene.remove(g); cars.delete(id); }
    // police helicopters: the body, and in world space the searchlight's beam and its spot on the road
    const seenH = new Set<number>();
    for (const c of f.helis) {
      seenH.add(c.id);
      let g = helis.get(c.id);
      if (!g) { g = makeHeli(glowTex); helis.set(c.id, g); scene.add(g, g.beam, g.spot); }
      g.position.set(c.x, c.h, c.y);
      g.rotation.set(-(c.pitch ?? 0), -c.a - Math.PI / 2, -(c.roll ?? 0));
      g.rotor.rotation.y += dt * 30; g.tailRotor.rotation.x += dt * 40;
      const fl = Math.floor(f.t * 8) % 2;
      g.red.color.setHex(fl ? 0xff0020 : 0x220004); g.blue.color.setHex(fl ? 0x000820 : 0x0030ff);
      g.strobe.color.setHex(f.t % 1.2 < 0.1 ? 0xffffff : 0x303038);
      g.spot.visible = !!c.light; g.beam.visible = !!c.light && look === 2;   // behind the car the camera would sit inside the beam and the whole picture would wash out
      if (c.light) {
        heliLamp.set(0, -1.1, -1.6).applyMatrix4(g.matrixWorld.compose(g.position, g.quaternion, g.scale));   // the lamp under the nose
        heliDir.set(c.light.x, 0.2, c.light.y).sub(heliLamp);
        const len = heliDir.length();
        g.beam.position.copy(heliLamp); g.beam.scale.set(1, len, 1);
        g.beam.quaternion.setFromUnitVectors(DOWN, heliDir.divideScalar(len));
        g.spot.position.set(c.light.x, 0.25, c.light.y);
      }
    }
    for (const [id, g] of helis) if (!seenH.has(id)) { scene.remove(g, g.beam, g.spot); helis.delete(id); }
    // the fan on foot
    walker.visible = !!f.walker;
    if (f.walker) {
      walker.position.set(f.walker.x, Math.abs(Math.sin(f.walker.step)) * 0.12, f.walker.y); walker.rotation.y = -f.walker.a - Math.PI / 2;
      animateHero(walker, f.walker.step);
    }
    // pedestrians: upright and walking, tumbling through the air (rx), or lying flat
    const pn = Math.min(PED_MAX, f.peds.length);
    for (let i = 0; i < pn; i++) {
      const q = f.peds[i]!, up = Math.abs(Math.cos(q.rx)), flat = Math.abs(Math.sin(q.rx)), sc = (look > 2 ? PED_SCALE_3D : PED_SCALE) * q.s;
      const bob = q.rx || q.h ? 0 : Math.abs(Math.sin(q.step)) * 0.12;
      pedE.set(q.rx, -q.a - Math.PI / 2, 0); pedQ.setFromEuler(pedE);
      pedM.compose(pedP.set(q.x, q.h + bob + (PED_MID * up + 0.3 * flat) * sc, q.y), pedQ, pedS.setScalar(sc));
      const sw = q.rx || q.h ? 0 : Math.sin(q.step) * 0.35;
      peds.legL.setMatrixAt(i, pedL.multiplyMatrices(pedM, pedT.makeTranslation(0, 0, sw)));
      peds.legR.setMatrixAt(i, pedL.multiplyMatrices(pedM, pedT.makeTranslation(0, 0, -sw)));
      peds.body.setMatrixAt(i, pedM); peds.head.setMatrixAt(i, pedM); peds.hair.setMatrixAt(i, pedM);
      const k = q.look;
      peds.body.setColorAt(i, pedC.setHex(PED_SHIRT[k % PED_SHIRT.length]!));
      peds.head.setColorAt(i, pedC.setHex(PED_SKIN[(k >> 4) % PED_SKIN.length]!));
      peds.hair.setColorAt(i, pedC.setHex(PED_HAIR[(k >> 6) % PED_HAIR.length]!));
      pedC.setHex(PED_LEGS[(k >> 9) % PED_LEGS.length]!); peds.legL.setColorAt(i, pedC); peds.legR.setColorAt(i, pedC);
    }
    for (const m of peds.all) { m.count = pn; m.instanceMatrix.needsUpdate = true; m.instanceColor!.needsUpdate = true; }
    // HR sight circle
    f.hrs.forEach((h, i) => { const r = hrRingAt(i); r.disc.position.set(h.x, 0.3, h.y); r.disc.scale.setScalar(h.r); r.edge.position.set(h.x, 0.32, h.y); r.edge.scale.setScalar(h.r); });
    hrRings.forEach((r, i) => { r.disc.visible = r.edge.visible = i < f.hrs.length; });
    // pickups
    const live = new Set<number>();
    for (const k of f.picks) {
      live.add(k.id);
      let g = picks.get(k.id);
      if (!g) {
        g = new THREE.Group();
        const m = new THREE.Mesh(k.kind === 'cash' ? cashGeo : canGeo, k.kind === 'cash' ? cashMat : canMat); m.position.y = 1.6; g.add(m);
        const ring = new THREE.Mesh(ringGeo, ringMat(k.kind === 'cash' ? 0x5dff8a : 0x6ff6ee)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; g.add(ring);
        const beam = new THREE.Mesh(beamGeo, k.kind === 'cash' ? beamCash : beamCan); beam.position.y = 20; g.add(beam);
        g.position.set(k.x, 0, k.y); scene.add(g); picks.set(k.id, g);
      }
      const m = g.children[0]!, ring = g.children[1]!;
      m.rotation.y += dt * 2.5; m.position.y = 1.6 + Math.sin(f.t * 3 + k.x) * 0.3; ring.scale.setScalar(1 + 0.15 * Math.sin(f.t * 4));
    }
    for (const [id, g] of picks) if (!live.has(id)) { scene.remove(g); picks.delete(id); }
    // graffiti letters
    const liveL = new Set<number>();
    for (const l of f.letters) {
      liveL.add(l.id);
      let m = letters.get(l.id);
      if (!m) {
        m = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: letterTex(l.ch), transparent: true, depthWrite: false, toneMapped: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(l.x, 0.3, l.y); scene.add(m); letters.set(l.id, m);
      }
      (m.material as THREE.MeshBasicMaterial).opacity = l.taken ? 0.25 : 0.75 + 0.25 * Math.sin(f.t * 5);
    }
    for (const [id, m] of letters) if (!liveL.has(id)) { scene.remove(m); letters.delete(id); }
    // place markers: a pulsing ring and a light beam at the door
    for (const id of Object.keys(city.places)) {
      const on = f.pending.includes(id as keyof typeof city.places);
      let g = markers.get(id);
      if (on && !g) {
        g = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.RingGeometry(6, 7.2, 40), ringMat(0xffd23f)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.35; g.add(ring);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
        beam.position.y = 30; g.add(beam);
        const pl = city.places[id as keyof typeof city.places]; g.position.set(pl.x, 0, pl.y); scene.add(g); markers.set(id, g);
      }
      if (!on && g) { scene.remove(g); markers.delete(id); }
      if (on && g) g.children[0]!.scale.setScalar(1 + 0.12 * Math.sin(f.t * 6));
    }
    // effects
    for (const e of f.fx) {
      if (e.k === 'burst') burst(e.x, e.y, e.col, e.n, e.spd);
      else if (e.k === 'skid') skid(e.x, e.y, e.x2 ?? e.x, e.y2 ?? e.y, f.t);
      else smoke(e.x, e.y);
    }
    fadeSkids(f.t);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!; p.life -= dt; p.position.addScaledVector(p.v, dt);
      if (p.smoke) { p.scale.multiplyScalar(1 + dt * 2); p.material.opacity = Math.max(0, p.life * 0.4); } else { p.v.y -= 20 * dt; p.material.opacity = Math.max(0, p.life); }
      if (p.life <= 0) { scene.remove(p); p.material.dispose(); parts.splice(i, 1); }
    }
    // the scene's camera: fixed top-down at the given height (95 → 130 with speed), fov 40, a slight tilt
    const z = f.cam.zoom;
    let cx = f.cam.x, cy = f.cam.y;
    if (look > 2) {
      // behind the car: distance and height follow the top view's zoom (118 at rest, more with speed, 60 in a close-up)
      // the camera turns after the car, not with it: the car swings on screen first, so steering reads calmer
      let da = f.cam.a - camA; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      camA = snapCam ? f.cam.a : camA + da * (1 - Math.pow(CHASE_TURN_LAG, dt));
      const o = CHASE_CAM, mix = (r: [number, number]): number => r[0] + (r[1] - r[0]) * camSp;
      camSp = snapCam ? f.cam.sp : camSp + (f.cam.sp - camSp) * (1 - Math.pow(0.05, dt));   // eased: it backs off and comes in softly
      const k = f.cam.k, back = mix(o.back) * k + CHASE_PULL_BACK * f.cam.pull, fx = Math.cos(camA), fz = Math.sin(camA);
      const fov = mix(o.fov); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
      cx = f.cam.px; cy = f.cam.py;
      camGoal.set(cx - fx * back, mix(o.h) * k + CHASE_PULL_H * f.cam.pull, cy - fz * back);
      if (snapCam || camera.position.distanceTo(camGoal) > 60) camera.position.copy(camGoal); else camera.position.lerp(camGoal, 1 - Math.pow(1e-5, dt));
      camera.lookAt(cx + fx * 6, 1.5, cy + fz * 6);
    } else {
      camera.position.set(cx, z, cy + z * 0.08);
      camera.lookAt(cx, 0, cy);
    }
    snapCam = false;
    goalArrow.visible = look > 2 && !!f.arrow;
    if (goalArrow.visible && f.arrow) {
      // held in front of the camera, sized against its field of view: the same place and size on screen at any speed
      const sz = Math.tan((camera.fov * Math.PI) / 360) / Math.tan((CHASE_FOV * Math.PI) / 360);
      camera.updateMatrixWorld();
      camera.localToWorld(goalArrow.position.set(0, ARROW_UP * sz, -ARROW_DIST));
      goalArrow.scale.setScalar(sz * ARROW_SIZE);
      goalArrow.rotation.set(ARROW_TILT, -camA - Math.PI / 2, 0);   // its far edge lifted, so the camera sees its top face
      goalArrow.tip.rotation.y = -f.arrow.rel;
    }
    sunL.position.set(cx + sunOff.x, sunOff.y, cy + sunOff.z); sunL.target.position.set(cx, 0, cy);
    sky.position.copy(camera.position);
    composer.render();
  }

  function project(x: number, y: number, h = 0): { x: number; y: number; behind: boolean } {
    v3.set(x, h, y).project(camera);
    return { x: (v3.x + 1) / 2, y: (1 - v3.y) / 2, behind: v3.z > 1 };
  }

  return { canvas, render, project };
}

// ---------- cars ----------
const CAR_COLORS: Record<Exclude<CarKind, 'npc'>, number> = { player: 0xff2f6e, cop: 0x111118, shark: 0x1c1c22, spouse: 0x9b7fd1, hr: 0xd8cfb4 };
type CarGroup = THREE.Group & { wheels?: THREE.Mesh[]; red?: THREE.MeshBasicMaterial; blue?: THREE.MeshBasicMaterial; kind?: CarKind; driver?: THREE.Object3D; glow?: THREE.Mesh };
// ---------- evening look (setDusk) ----------
const EVE_HEMI = 0.95, EVE_SUN = 2.0;     // light levels in the evening (day: 1.0 and 2.4)
const EVE_EXPOSURE = 1.05;                // tone-mapping exposure in the evening (day: 1.0)
const EVE_WINDOWS = 1.3;                  // how bright the lit windows are
const EVE_POOL = 0.3, POOL_D = 20;         // the pool of light under a street lamp: opacity, diameter
const EVE_HEAD = 0.45, EVE_TAIL = 0.5;     // headlight beam / tail glow opacity
// one shared material each: every car's beams switch on together when the evening comes
const HEAD_MAT = new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, visible: false });
const TAIL_MAT = new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0xff2030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, visible: false });
/** Headlights and tail lights as light on the road (the camera looks straight down): a long warm beam ahead of the
 *  nose and a short red glow behind the tail. `nose` / `tail` = the car's ends along z, before its scale. */
function addLights(g: THREE.Group, nose: number, tail: number): void {
  const head = new THREE.Mesh(new THREE.PlaneGeometry(6, 11), HEAD_MAT);
  head.rotation.x = -Math.PI / 2; head.position.set(0, 0.16, nose - 5.5); g.add(head);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3), TAIL_MAT);
  back.rotation.x = -Math.PI / 2; back.rotation.z = Math.PI; back.position.set(0, 0.16, tail + 1.5); g.add(back);
}
/** A beam seen from above: bright at the lamps (bottom edge), widening and fading away from them. */
function beamTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d')!;
  g.beginPath(); g.moveTo(14, 128); g.lineTo(50, 128); g.lineTo(64, 0); g.lineTo(0, 0); g.closePath(); g.clip();
  const gr = g.createRadialGradient(32, 128, 0, 32, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 128); return new THREE.CanvasTexture(c);
}

function makeCar(kind: CarKind, color: string | undefined, glowTex: THREE.Texture): CarGroup {
  const g = new THREE.Group() as CarGroup;
  g.kind = kind;
  g.rotation.order = 'YXZ';   // yaw first, then pitch and roll in the car's own frame
  addLights(g, kind === 'player' ? -2.55 : -2.3, kind === 'player' ? 2.55 : 2.3);
  if (kind === 'player') {
    heroCar(g);
    // brake light: a red glow on the road behind the tail (the lamps themselves face backward, the camera looks down)
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff1030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.12, 3.3); glow.visible = false; g.add(glow); g.glow = glow;
    return g;
  }
  const body = kind === 'npc' ? new THREE.Color(color ?? '#c0c0c0').getHex() : CAR_COLORS[kind];
  const van = kind === 'spouse' || kind === 'hr';
  const paint = new THREE.MeshPhysicalMaterial({ color: body, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0f, roughness: 0.2, metalness: 0.8 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = false) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; g.add(m); return m; };
  add(new THREE.BoxGeometry(2.1, 0.7, 4.6), paint, 0, 0.75, 0, true);
  if (van) {
    add(new THREE.BoxGeometry(2.0, 1.1, 3.4), paint, 0, 1.6, 0.4, true);
    add(new THREE.BoxGeometry(1.9, 0.45, 0.1), dark, 0, 1.7, -1.32);
  } else {
    add(new THREE.BoxGeometry(2.0, 0.35, 1.2), paint, 0, 1.2, -1.6);
    add(new THREE.BoxGeometry(1.8, 0.6, 2.0), dark, 0, 1.38, 0.2, true);
    if (kind === 'shark') add(new THREE.BoxGeometry(2.1, 0.1, 0.5), paint, 0, 1.45, 2.15);
  }
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16); wg.rotateZ(Math.PI / 2);
  const wm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  g.wheels = [];
  for (const [x, z] of [[-1.05, -1.5], [1.05, -1.5], [-1.05, 1.5], [1.05, 1.5]] as const) g.wheels.push(add(wg, wm, x, 0.42, z));
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  for (const x of [-0.7, 0.7]) add(new THREE.BoxGeometry(0.5, 0.18, 0.05), hl, x, 0.85, -2.31);
  add(new THREE.BoxGeometry(1.9, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: 0xff1a3a }), 0, 0.9, 2.31);
  const ug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  ug.rotation.x = -Math.PI / 2; ug.position.y = 0.05; g.add(ug);
  if (kind === 'cop') {
    g.red = new THREE.MeshBasicMaterial({ color: 0xff0020 }); g.blue = new THREE.MeshBasicMaterial({ color: 0x0030ff });
    add(new THREE.BoxGeometry(0.7, 0.2, 0.35), g.red, -0.45, 1.78, 0.2); add(new THREE.BoxGeometry(0.7, 0.2, 0.35), g.blue, 0.45, 1.78, 0.2);
    add(new THREE.BoxGeometry(2.12, 0.25, 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, 0.75, 0.3);
  }
  if (kind === 'shark') add(new THREE.BoxGeometry(0.25, 0.06, 4.0), new THREE.MeshBasicMaterial({ color: 0xffd23f }), 0, 1.13, -0.2);   // gold pinstripe
  if (kind === 'hr') add(new THREE.BoxGeometry(1.2, 0.12, 1.2), new THREE.MeshBasicMaterial({ color: 0xc8102e }), 0, 2.2, 0.4);         // red roof badge
  g.scale.setScalar(1.4);
  return g;
}

/** The police helicopter, built to be read from straight above: black body with a white roof and tail stripe (the cop
 *  car's colours), dark glass nose, red / blue flashers on stub wings, skids wider than the cabin, a four-blade rotor
 *  under a faint blur disc, a tail rotor and a white tail strobe. Nose along -z, origin at the cabin's middle.
 *  `beam` and `spot` (the searchlight) live in world space; the renderer aims them. */
type HeliGroup = THREE.Group & { rotor: THREE.Group; tailRotor: THREE.Mesh; red: THREE.MeshBasicMaterial; blue: THREE.MeshBasicMaterial; strobe: THREE.MeshBasicMaterial; beam: THREE.Mesh; spot: THREE.Mesh };
function makeHeli(glowTex: THREE.Texture): HeliGroup {
  const g = new THREE.Group() as HeliGroup;
  g.rotation.order = 'YXZ';
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x111118, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23232b, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1f4a6e, roughness: 0.1, metalness: 0.7 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = false, to: THREE.Object3D = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; to.add(m); return m; };
  // cabin, glass nose, white roof, engine hump
  add(new THREE.BoxGeometry(2.0, 1.6, 3.0), paint, 0, 0, -0.3, true);
  add(new THREE.BoxGeometry(1.7, 1.1, 1.1), glass, 0, 0.05, -2.2, true);
  add(new THREE.BoxGeometry(1.3, 0.7, 0.5), glass, 0, -0.1, -2.9);
  add(new THREE.BoxGeometry(2.04, 0.5, 3.04), white, 0, 0.6, -0.3);
  add(new THREE.BoxGeometry(1.1, 0.5, 1.9), dark, 0, 1.05, 0.3);
  // tail: boom with a white stripe, fin, stabilizer, rotor, strobe
  add(new THREE.BoxGeometry(0.55, 0.55, 4.6), paint, 0, 0.35, 3.4, true);
  add(new THREE.BoxGeometry(0.57, 0.2, 2.6), white, 0, 0.56, 3.0);
  add(new THREE.BoxGeometry(0.16, 1.3, 0.9), paint, 0, 0.95, 5.4, true);
  add(new THREE.BoxGeometry(2.2, 0.1, 0.6), white, 0, 0.45, 4.7, true);
  g.tailRotor = add(new THREE.BoxGeometry(0.06, 1.7, 0.22), dark, 0.32, 0.95, 5.5);
  g.strobe = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(new THREE.BoxGeometry(0.28, 0.2, 0.28), g.strobe, 0, 1.7, 5.4);
  // stub wings with the flashers at the tips (outside the cabin, so the camera above sees them)
  add(new THREE.BoxGeometry(3.2, 0.14, 0.6), dark, 0, -0.1, 0.5, true);
  g.red = new THREE.MeshBasicMaterial({ color: 0xff0020 }); g.blue = new THREE.MeshBasicMaterial({ color: 0x0030ff });
  add(new THREE.BoxGeometry(0.5, 0.24, 0.7), g.red, -1.45, 0.08, 0.5); add(new THREE.BoxGeometry(0.5, 0.24, 0.7), g.blue, 1.45, 0.08, 0.5);
  // skids and their cross tubes
  for (const x of [-1.3, 1.3]) add(new THREE.BoxGeometry(0.16, 0.14, 3.8), dark, x, -1.25, -0.3, true);
  for (const z of [-1.3, 0.7]) add(new THREE.BoxGeometry(2.6, 0.08, 0.12), dark, 0, -1.1, z);
  // main rotor: mast, hub, four blades, and a faint disc for the blur
  add(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), dark, 0, 1.55, 0);
  g.rotor = new THREE.Group(); g.rotor.position.set(0, 1.9, 0); g.add(g.rotor);
  add(new THREE.CylinderGeometry(0.35, 0.35, 0.16, 10), dark, 0, 0, 0, false, g.rotor);
  const blade = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.7 });
  add(new THREE.BoxGeometry(0.42, 0.06, 8.6), blade, 0, 0, 0, true, g.rotor);
  add(new THREE.BoxGeometry(8.6, 0.06, 0.42), blade, 0, 0, 0, true, g.rotor);
  const disc = add(new THREE.CircleGeometry(4.3, 28), new THREE.MeshBasicMaterial({ color: 0x1a1a22, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }), 0, 0.02, 0, false, g.rotor);
  disc.rotation.x = -Math.PI / 2;
  g.scale.setScalar(1.2);
  // searchlight: a cone that opens toward the ground (unit height, apex at its origin) and a soft spot with a rim
  const cone = new THREE.CylinderGeometry(0.4, 5, 1, 20, 1, true); cone.translate(0, -0.5, 0);
  g.beam = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  g.beam.frustumCulled = false;   // its box is the unscaled unit cone
  g.spot = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff4c8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.spot.rotation.x = -Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.RingGeometry(4.7, 5.1, 40), new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.spot.add(rim);
  return g;
}

// ---------- pedestrians ----------
const PED_SCALE_3D = 1.1;   // behind the car they stand next to it, so they are closer to its size (from above they need 2.3 to be read)
const PED_MAX = 160, PED_SCALE = 2.3, PED_MID = 1.2;   // PED_MID: the body's middle (it tumbles around it), before scaling
// the city's own colours: the neon pink / teal / yellow of the signs and the launch-day line, plus a few plain ones
const PED_SHIRT = [0xff3fa4, 0x2fd1c8, 0xffd23f, 0x9b7fd1, 0xf2a65a, 0xe8e8e8, 0x5ce67a, 0x4f7fd6, 0xd02a2a, 0xff7a20];
const PED_SKIN = [0xf0b98d, 0xe0a070, 0xc68642, 0x8d5524, 0xffd9b8];
const PED_HAIR = [0x5a3a22, 0x1c1c22, 0xe9d36b, 0xb8502e, 0xd9d2c5, 0xff3fa4];
const PED_LEGS = [0x2b2f45, 0x3a3a44, 0x6a5a4a, 0x2a4a7a];
type PedMeshes = Record<'legL' | 'legR' | 'body' | 'head' | 'hair', THREE.InstancedMesh> & { all: THREE.InstancedMesh[] };
function makePeds(): PedMeshes {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d).translate(x, y - PED_MID, z);
  const part = (g: THREE.BufferGeometry, shadow: boolean): THREE.InstancedMesh => {
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.8 }), PED_MAX);
    m.setColorAt(0, new THREE.Color(0xffffff));   // allocates the per-instance colours
    m.count = 0; m.frustumCulled = false; m.castShadow = shadow; return m;
  };
  const legL = part(box(0.34, 0.9, 0.4, -0.22, 0.45, 0), false), legR = part(box(0.34, 0.9, 0.4, 0.22, 0.45, 0), false);
  const body = part(mergeGeometries([box(0.95, 0.9, 0.7, 0, 1.35, 0), box(0.26, 0.8, 0.45, -0.6, 1.35, 0), box(0.26, 0.8, 0.45, 0.6, 1.35, 0)]), true);
  const head = part(box(0.55, 0.55, 0.55, 0, 2.1, 0), false), hair = part(box(0.6, 0.2, 0.6, 0, 2.45, 0.02), false);
  return { legL, legR, body, head, hair, all: [legL, legR, body, head, hair] };
}

// ---------- textures ----------
/** `map` = the wall with its windows; `lit` = the same windows on black, about half of them with the light on
 *  (the building material's emissive map, shown only in the evening). */
function windowTex(): { map: THREE.CanvasTexture; lit: THREE.CanvasTexture } {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d')!;
  const c2 = document.createElement('canvas'); c2.width = 128; c2.height = 256; const g2 = c2.getContext('2d')!;
  g.fillStyle = '#e4ddd2'; g.fillRect(0, 0, 128, 256);
  g2.fillStyle = '#000'; g2.fillRect(0, 0, 128, 256);
  const cols = ['#3d5f80', '#4a7090', '#2f4c68', '#6a90b0'], warm = ['#ffd890', '#ffb860', '#fff0c8'];
  for (let y = 6; y < 256; y += 12) for (let x = 6; x < 128; x += 14) if (Math.random() < 0.8) {
    g.fillStyle = cols[Math.floor(Math.random() * cols.length)]!; g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(x, y, 8, 6);
    if (Math.random() < 0.5) { g2.fillStyle = warm[Math.floor(Math.random() * warm.length)]!; g2.fillRect(x, y, 8, 6); }
  }
  const mk = (cv: HTMLCanvasElement): THREE.CanvasTexture => {
    const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  return { map: mk(c), lit: mk(c2) };
}
function winUV(g: THREE.BufferGeometry, w: number, d: number, h: number, cyl: boolean, [ox, oy]: [number, number]): void {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  if (cyl) {
    const pr = (g as THREE.CylinderGeometry).parameters, side = (pr.radialSegments + 1) * (pr.heightSegments + 1);
    for (let v = 0; v < uv.count; v++) { if (v >= side) { uv.setXY(v, 0.01, 0.01); continue; } uv.setXY(v, (uv.getX(v) * w) / 10 + ox, (uv.getY(v) * h) / 20 + oy); }
    return;
  }
  for (let v = 0; v < uv.count; v++) {
    const f = Math.floor(v / 4);
    if (f === 2 || f === 3) { uv.setXY(v, 0.01, 0.01); continue; }
    uv.setXY(v, (uv.getX(v) * (f < 2 ? d : w)) / 10 + ox, (uv.getY(v) * h) / 20 + oy);
  }
}
function ribbon(pts: Array<{ x: number; z: number }>, w: number, y: number): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)]!, b = pts[Math.min(pts.length - 1, k + 1)]!;
    let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    pos.push(pts[k]!.x - (dz * w) / 2, y, pts[k]!.z + (dx * w) / 2, pts[k]!.x + (dz * w) / 2, y, pts[k]!.z - (dx * w) / 2);
    if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (g.attributes.normal!.getY(0) < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k]!; idx[k] = idx[k + 1]!; idx[k + 1] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  return g;
}
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.3, 'rgba(255,150,90,.5)'); gr.addColorStop(1, 'rgba(255,100,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
function signTex(text: string, bg: string, fg: string, aspect: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 / aspect); const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 8; g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = SIGN_FONT;
  const s = Math.min(1, (c.width - 40) / g.measureText(text).width, (c.height * 0.8) / 64);
  g.save(); g.translate(c.width / 2, c.height / 2 + 4); g.scale(s, s); g.fillText(text, 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function letterTex(ch: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,63,164,.25)'; g.fillRect(8, 8, 112, 112);
  g.font = '900 104px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = '#3a0a2a'; g.strokeText(ch, 64, 70); g.fillStyle = '#ff3fa4'; g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** The arrow toward the next stop (looks 3 and 4): a thick yellow chevron on a dark plate, lit like the rest of the
 *  city. It lies flat pointing along -z (a car's nose); `tip` turns inside the tilted group. Drawn over everything, so
 *  a building never hides it. */
function makeGoalArrow(): THREE.Group & { tip: THREE.Group } {
  const g = new THREE.Group() as THREE.Group & { tip: THREE.Group };
  g.rotation.order = 'YXZ';
  const prism = (pts: Array<[number, number]>, depth: number): THREE.ExtrudeGeometry => {
    const sh = new THREE.Shape(); pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
    const e = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 }); e.rotateX(-Math.PI / 2); return e;
  };
  const tip = new THREE.Group();
  const plate = new THREE.Mesh(prism([[0, 2.5], [1.95, -1.25], [0, -0.45], [-1.95, -1.25]], 0.2), new THREE.MeshBasicMaterial({ color: 0x14100a, fog: false, depthTest: false, toneMapped: false }));
  plate.position.y = -0.3; plate.renderOrder = 10;
  const body = new THREE.Mesh(prism([[0, 2], [1.5, -0.9], [0, -0.25], [-1.5, -0.9]], 0.55), new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffa800, emissiveIntensity: 0.45, roughness: 0.45, fog: false, depthTest: false }));
  body.renderOrder = 11;
  tip.add(plate, body); g.add(tip); g.tip = tip;
  return g;
}

/** The facades of looks 3 and 4: windowTex's grid (9 x 21 windows per tile) at four times the pixels, with frames,
 *  a reflection in the glass and floor lines; `lit` = the windows with the light on, on black. Smooth filtering. */
function windowTexHi(aniso: number): { map: THREE.CanvasTexture; lit: THREE.CanvasTexture } {
  const mk = (lit: boolean): THREE.CanvasTexture => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 1024; const g = c.getContext('2d')!;
    g.fillStyle = lit ? '#000' : '#e6dfd4'; g.fillRect(0, 0, 512, 1024);
    for (let r = 0; r < 21; r++) {
      const y = 24 + r * 48;
      if (!lit) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, y + 30, 512, 4); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, y - 8, 512, 2); }
      for (let k = 0; k < 9; k++) {
        const x = 24 + k * 56, on = hash(r + 1, k + 1);
        const gr = g.createLinearGradient(0, y, 0, y + 24);
        if (lit) {
          if (on <= 0.55) continue;
          const col = on > 0.93 ? '255,140,210' : on > 0.84 ? '140,235,255' : '255,214,150';
          gr.addColorStop(0, 'rgb(' + col + ')'); gr.addColorStop(1, 'rgba(' + col + ',.5)');
          g.fillStyle = gr; g.fillRect(x, y, 32, 24); g.fillStyle = '#000'; g.fillRect(x + 15, y, 2, 24);
        } else {
          g.fillStyle = '#cfc7ba'; g.fillRect(x - 3, y - 3, 38, 30);
          gr.addColorStop(0, '#7fa6c8'); gr.addColorStop(0.5, '#3f6485'); gr.addColorStop(1, '#2a445e');
          g.fillStyle = gr; g.fillRect(x, y, 32, 24);
          g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x, y + 24); g.lineTo(x + 14, y); g.lineTo(x + 22, y); g.lineTo(x + 8, y + 24); g.fill();
          g.fillStyle = '#b9b1a4'; g.fillRect(x + 15, y, 2, 24); g.fillStyle = '#a79f92'; g.fillRect(x - 3, y + 25, 38, 3);
        }
      }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
  };
  return { map: mk(false), lit: mk(true) };
}
/** Fine grain for the asphalt of looks 3 and 4 (multiplies the ground colour). */
function asphaltTex(aniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!, d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = 195 + Math.floor(Math.random() * 60); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 70); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
}

window.__w6world3d = { create };
