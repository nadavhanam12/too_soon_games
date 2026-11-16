// The 3D renderer for the driving world, ported from the "Sun City Heist" scene (Scene/sun-city-heist.html): sky dome
// with a sun, warm fog, soft shadows, a little bloom, merged static city meshes, glossy cars, pixelated output.
// Built on its own to lazy/world3d.js (DECISIONS 72) and loaded after the first frame, so three.js stays out of
// index.html. It never reads game state: drive.ts hands it the city once (create) and a snapshot every frame (render).
// Math.random here is visual only (window textures, sparks); it never touches gameplay.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MatKey, Prim } from '../city';
import type { CarKind, CityData, Frame, World3D } from '../world3d-api';

const SIGN_FONT = '900 64px Rubik, system-ui, sans-serif';

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
    uniforms: { sunDir: { value: new THREE.Vector3(0.4, 0.5, -1).normalize() } },
    vertexShader: 'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 v;uniform vec3 sunDir;
      void main(){float h=v.y;
        vec3 top=vec3(.25,.5,.95),mid=vec3(.55,.75,1.),low=vec3(.98,.92,.8);
        vec3 c=mix(low,mid,smoothstep(-.02,.18,h));c=mix(c,top,smoothstep(.15,.6,h));
        float d=dot(v,sunDir);
        c+=vec3(1.,.85,.45)*smoothstep(.9965,.998,d)*3.;
        c+=vec3(1.,.9,.6)*pow(max(d,0.),30.)*.5;
        gl_FragColor=vec4(c,1.);}`,
  }));
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x8a7a60, 1.0));
  const sunL = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sunL.castShadow = true;
  sunL.shadow.mapSize.set(2048, 2048);
  const sc = sunL.shadow.camera; sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.far = 400;
  scene.add(sunL, sunL.target);

  // ---------- ground, sea, lane markings ----------
  const { bmin, bmax } = city, bsize = bmax - bmin, bmid = (bmin + bmax) / 2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(bsize + 8, bsize + 8), new THREE.MeshStandardMaterial({ color: 0x55565c, roughness: 0.9, metalness: 0 }));
  ground.position.set(bmid, 0, bmid); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x2a8ac8, roughness: 0.3, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(bmid, -0.6, bmid); scene.add(sea);
  {
    const CELL = 56, N = 6;
    const lines = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.4, 4), new THREE.MeshBasicMaterial({ color: 0xf2d15a }), 4000);
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
  const MATS: Record<MatKey, { mat: THREE.Material; cast: boolean; recv: boolean }> = {
    bldg: { mat: new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.85, metalness: 0 }), cast: true, recv: true },
    plain: { mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), cast: false, recv: true },
    tree: { mat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), cast: true, recv: false },
    neon: { mat: new THREE.MeshBasicMaterial({ vertexColors: true }), cast: false, recv: false },
  };
  const buckets = new Map<MatKey, THREE.BufferGeometry[]>();
  const tmpCol = new THREE.Color();
  const M = (x: number, y: number, z: number, ry = 0, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  function addStatic(key: MatKey, g0: THREE.BufferGeometry, matrix: THREE.Matrix4, color: number): void {
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
  }

  function addPrim(p: Prim): void {
    switch (p.k) {
      case 'box': {
        const g = new THREE.BoxGeometry(p.w, p.h, p.d);
        if (p.win) winUV(g, p.w, p.d, p.h, false, p.win);
        addStatic(p.m, g, M(p.x, p.y, p.z, p.ry ?? 0), p.col); break;
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
  {
    const pos: number[] = [];
    for (const l of city.lamps) pos.push(l.x, 7.1, l.z);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ map: glowTex, size: 6, color: 0xffc890, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  }

  // ---------- dynamic things ----------
  const cars = new Map<number, THREE.Group & { wheels?: THREE.Mesh[]; red?: THREE.MeshBasicMaterial; blue?: THREE.MeshBasicMaterial; kind?: CarKind }>();
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
  const hrRing = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.22, depthWrite: false }));
  hrRing.rotation.x = -Math.PI / 2; hrRing.position.y = 0.3; hrRing.visible = false; scene.add(hrRing);
  const hrEdge = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  hrEdge.rotation.x = -Math.PI / 2; hrEdge.position.y = 0.32; hrEdge.visible = false; scene.add(hrEdge);

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
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(360, 640), 0.2, 0.3, 0.92);
  composer.addPass(bloom); composer.addPass(new OutputPass());

  let size = { w: 0, h: 0 }, lastT = 0;
  const v3 = new THREE.Vector3();

  function render(f: Frame): void {
    if (f.w !== size.w || f.h !== size.h) {
      size = { w: f.w, h: f.h };
      renderer.setSize(f.w, f.h, false); composer.setSize(f.w, f.h); bloom.resolution.set(f.w, f.h);
      camera.aspect = f.w / f.h; camera.updateProjectionMatrix();
    }
    const dt = Math.max(0, Math.min(0.05, f.t - lastT)); lastT = f.t;
    // cars
    const seen = new Set<number>();
    for (const c of f.cars) {
      seen.add(c.id);
      let g = cars.get(c.id);
      if (!g || g.kind !== c.kind) { if (g) scene.remove(g); g = makeCar(c.kind, c.color); cars.set(c.id, g); scene.add(g); }
      const prevX = g.position.x, prevZ = g.position.z;
      g.position.set(c.x, 0, c.y);
      g.rotation.y = -c.a - Math.PI / 2;           // the scene's yaw: nose along -z at 0
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, (c.lean ?? 0) * -0.06, 0.1);
      const moved = Math.hypot(c.x - prevX, c.y - prevZ);
      if (g.wheels && moved < 20) for (const w of g.wheels) w.rotation.x -= moved / 0.42;
      if (g.red && g.blue) { const fl = Math.floor(f.t * 8) % 2; g.red.color.setHex(fl ? 0xff0020 : 0x220004); g.blue.color.setHex(fl ? 0x000820 : 0x0030ff); }
    }
    for (const [id, g] of cars) if (!seen.has(id)) { scene.remove(g); cars.delete(id); }
    // HR sight circle
    hrRing.visible = hrEdge.visible = !!f.hr;
    if (f.hr) { hrRing.position.set(f.hr.x, 0.3, f.hr.y); hrRing.scale.setScalar(f.hr.r); hrEdge.position.set(f.hr.x, 0.32, f.hr.y); hrEdge.scale.setScalar(f.hr.r); }
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
    for (const e of f.fx) { if (e.k === 'burst') burst(e.x, e.y, e.col); else smoke(e.x, e.y); }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!; p.life -= dt; p.position.addScaledVector(p.v, dt);
      if (p.smoke) { p.scale.multiplyScalar(1 + dt * 2); p.material.opacity = Math.max(0, p.life * 0.4); } else { p.v.y -= 20 * dt; p.material.opacity = Math.max(0, p.life); }
      if (p.life <= 0) { scene.remove(p); p.material.dispose(); parts.splice(i, 1); }
    }
    // the scene's camera: fixed top-down at the given height (95 → 130 with speed), fov 40, a slight tilt
    const z = f.cam.zoom;
    camera.position.set(f.cam.x, z, f.cam.y + z * 0.08);
    camera.lookAt(f.cam.x, 0, f.cam.y);
    sunL.position.set(f.cam.x + 50, 110, f.cam.y + 35); sunL.target.position.set(f.cam.x, 0, f.cam.y);
    sky.position.copy(camera.position);
    composer.render();
  }

  function project(x: number, y: number, h = 0): { x: number; y: number } {
    v3.set(x, h, y).project(camera);
    return { x: (v3.x + 1) / 2, y: (1 - v3.y) / 2 };
  }

  return { canvas, render, project };
}

// ---------- cars ----------
const CAR_COLORS: Record<Exclude<CarKind, 'npc'>, number> = { player: 0xff2f6e, cop: 0x111118, shark: 0x1c1c22, spouse: 0x9b7fd1, hr: 0xd8cfb4 };
function makeCar(kind: CarKind, color?: string): THREE.Group & { wheels?: THREE.Mesh[]; red?: THREE.MeshBasicMaterial; blue?: THREE.MeshBasicMaterial; kind?: CarKind } {
  const g = new THREE.Group() as THREE.Group & { wheels?: THREE.Mesh[]; red?: THREE.MeshBasicMaterial; blue?: THREE.MeshBasicMaterial; kind?: CarKind };
  g.kind = kind;
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
    if (kind === 'player' || kind === 'shark') add(new THREE.BoxGeometry(2.1, 0.1, 0.5), paint, 0, 1.45, 2.15);
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

// ---------- textures ----------
function windowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d')!;
  g.fillStyle = '#e4ddd2'; g.fillRect(0, 0, 128, 256);
  const cols = ['#3d5f80', '#4a7090', '#2f4c68', '#6a90b0'];
  for (let y = 6; y < 256; y += 12) for (let x = 6; x < 128; x += 14) if (Math.random() < 0.8) {
    g.fillStyle = cols[Math.floor(Math.random() * cols.length)]!; g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(x, y, 8, 6);
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
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

window.__w6world3d = { create };
