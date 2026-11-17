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
    uniforms: { sunDir: { value: new THREE.Vector3(0.4, 0.5, -1).normalize() }, dusk: { value: 0 } },
    vertexShader: 'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 v;uniform vec3 sunDir;uniform float dusk;
      void main(){float h=v.y;
        vec3 top=mix(vec3(.25,.5,.95),vec3(.1,.08,.3),dusk),mid=mix(vec3(.55,.75,1.),vec3(.55,.25,.5),dusk),low=mix(vec3(.98,.92,.8),vec3(1.,.55,.3),dusk);
        vec3 c=mix(low,mid,smoothstep(-.02,.18,h));c=mix(c,top,smoothstep(.15,.6,h));
        float d=dot(v,sunDir);
        c+=vec3(1.,.85,.45)*smoothstep(.9965,.998,d)*3.;
        c+=vec3(1.,.9,.6)*pow(max(d,0.),30.)*.5;
        gl_FragColor=vec4(c,1.);}`,
  }));
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a60, 1.0);
  scene.add(hemi);
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
  // the lit windows glow only in the evening (emissiveIntensity follows the frame's dusk)
  const bldgMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.map, emissive: 0xffffff, emissiveMap: tex.lit, emissiveIntensity: 0, roughness: 0.85, metalness: 0 });
  const MATS: Record<MatKey, { mat: THREE.Material; cast: boolean; recv: boolean }> = {
    bldg: { mat: bldgMat, cast: true, recv: true },
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
  const sunOff = DAY.off.clone();
  let dusk = -1;
  function setDusk(d: number): void {
    if (d === dusk) return;
    dusk = d;
    scene.fog!.color.copy(DAY.fog).lerp(EVE.fog, d); (scene.background as THREE.Color).copy(scene.fog!.color);
    (sky.material as THREE.ShaderMaterial).uniforms.dusk!.value = d;
    hemi.color.copy(DAY.sky).lerp(EVE.sky, d); hemi.groundColor.copy(DAY.gnd).lerp(EVE.gnd, d); hemi.intensity = 1 - (1 - EVE_HEMI) * d;
    sunL.color.copy(DAY.sun).lerp(EVE.sun, d); sunL.intensity = 2.4 - (2.4 - EVE_SUN) * d;
    sunOff.copy(DAY.off).lerp(EVE.off, d);   // a low sun: long shadows
    bldgMat.emissiveIntensity = EVE_WINDOWS * d;
    lampMat.size = 6 + 5 * d; poolMat.opacity = EVE_POOL * d; poolMat.visible = d > 0;
    HEAD_MAT.opacity = EVE_HEAD * d; TAIL_MAT.opacity = EVE_TAIL * d; HEAD_MAT.visible = TAIL_MAT.visible = d > 0;
    bloom.strength = 0.2 + 0.25 * d;
    renderer.toneMappingExposure = 1 + (EVE_EXPOSURE - 1) * d;   // the dark asphalt sinks to black under the dim light without it
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
  const walker = makeWalker(); walker.visible = false; scene.add(walker);
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
    if (f.t < lastT) clearSkids();   // a new leg restarted the clock
    setDusk(f.dusk);
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
      g.beam.visible = g.spot.visible = !!c.light;
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
      const sw = Math.sin(f.walker.step) * 0.35; walker.legs[0]!.position.z = sw; walker.legs[1]!.position.z = -sw;
    }
    // pedestrians: upright and walking, tumbling through the air (rx), or lying flat
    const pn = Math.min(PED_MAX, f.peds.length);
    for (let i = 0; i < pn; i++) {
      const q = f.peds[i]!, up = Math.abs(Math.cos(q.rx)), flat = Math.abs(Math.sin(q.rx)), sc = PED_SCALE * q.s;
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
    camera.position.set(f.cam.x, z, f.cam.y + z * 0.08);
    camera.lookAt(f.cam.x, 0, f.cam.y);
    sunL.position.set(f.cam.x + sunOff.x, sunOff.y, f.cam.y + sunOff.z); sunL.target.position.set(f.cam.x, 0, f.cam.y);
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
    makeConvertible(g);
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

/** The player's car: a low, wide open-top roadster. Cherry red with white racing stripes, tan seats, a chrome
 *  windshield frame, a rear wing and the fan at the wheel (hidden while he is on foot). Nose along -z, like the rest. */
function makeConvertible<T extends THREE.Group & { wheels?: THREE.Mesh[]; driver?: THREE.Object3D }>(g: T): T {
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xe1122f, metalness: 0.65, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.04 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.5 });
  const tan = new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: 0.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 0.9, roughness: 0.2 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = false, to: THREE.Object3D = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; to.add(m); return m; };
  // body: long hood, wide hips, short tail
  add(new THREE.BoxGeometry(2.3, 0.6, 5.0), paint, 0, 0.72, 0, true);
  add(new THREE.BoxGeometry(2.0, 0.28, 1.9), paint, 0, 1.12, -1.45, true);     // hood bulge
  add(new THREE.BoxGeometry(1.7, 0.2, 0.5), paint, 0, 0.98, -2.55);            // nose
  add(new THREE.BoxGeometry(2.1, 0.3, 1.0), paint, 0, 1.12, 1.95, true);       // rear deck
  for (const x of [-1.2, 1.2]) add(new THREE.BoxGeometry(0.22, 0.5, 1.5), paint, x, 0.86, 1.35);   // rear fenders
  // racing stripes: nose, hood and rear deck
  for (const x of [-0.3, 0.3]) {
    add(new THREE.BoxGeometry(0.3, 0.03, 1.9), white, x, 1.275, -1.45);
    add(new THREE.BoxGeometry(0.3, 0.03, 1.0), white, x, 1.285, 1.95);
    add(new THREE.BoxGeometry(0.3, 0.03, 0.5), white, x, 1.095, -2.55);
  }
  // open cockpit: dark tub, tan seats, dash, steering wheel
  add(new THREE.BoxGeometry(1.9, 0.08, 2.0), dark, 0, 1.03, 0.45);
  for (const x of [-0.5, 0.5]) { add(new THREE.BoxGeometry(0.72, 0.22, 0.8), tan, x, 1.16, 0.6); add(new THREE.BoxGeometry(0.72, 0.62, 0.2), tan, x, 1.38, 1.08); }
  add(new THREE.BoxGeometry(1.9, 0.3, 0.25), dark, 0, 1.2, -0.42);
  const wheel = add(new THREE.TorusGeometry(0.2, 0.05, 6, 12), dark, -0.5, 1.4, -0.2); wheel.rotation.x = -1.1;
  // windshield: chrome frame with a strip of glass, raked back; no roof
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2 });
  const ws = add(new THREE.BoxGeometry(1.9, 0.55, 0.06), glass, 0, 1.52, -0.6); ws.rotation.x = 0.5;
  const wf = add(new THREE.BoxGeometry(2.02, 0.08, 0.1), chrome, 0, 1.78, -0.47); wf.rotation.x = 0.5;
  for (const x of [-0.98, 0.98]) {
    const p = add(new THREE.BoxGeometry(0.08, 0.6, 0.08), chrome, x, 1.52, -0.6); p.rotation.x = 0.5;
    add(new THREE.BoxGeometry(0.3, 0.14, 0.2), paint, x * 1.22, 1.32, -0.5);   // mirrors
  }
  // roll hoops behind the seats, rear wing
  for (const x of [-0.5, 0.5]) add(new THREE.BoxGeometry(0.6, 0.34, 0.14), chrome, x, 1.55, 1.3);
  add(new THREE.BoxGeometry(2.3, 0.08, 0.5), dark, 0, 1.62, 2.3, true);
  for (const x of [-0.9, 0.9]) add(new THREE.BoxGeometry(0.1, 0.34, 0.3), dark, x, 1.43, 2.3);
  // wheels (fat, with chrome hubs)
  const wg = new THREE.CylinderGeometry(0.5, 0.5, 0.45, 16); wg.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.22, 0.22, 0.47, 10); hub.rotateZ(Math.PI / 2);
  const wm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  g.wheels = [];
  for (const [x, z] of [[-1.14, -1.65], [1.14, -1.65], [-1.16, 1.6], [1.16, 1.6]] as const) { const w = add(wg, wm, x, 0.5, z); w.add(new THREE.Mesh(hub, chrome)); g.wheels.push(w); }
  // lights, exhausts, ground shadow
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  for (const x of [-0.78, 0.78]) add(new THREE.BoxGeometry(0.5, 0.2, 0.06), hl, x, 0.9, -2.52);
  add(new THREE.BoxGeometry(2.1, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: 0xff1a3a }), 0, 0.92, 2.52);
  const ex = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8); ex.rotateX(Math.PI / 2);
  for (const x of [-0.55, 0.55]) add(ex, chrome, x, 0.5, 2.6);
  const ug = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 5.6), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  ug.rotation.x = -Math.PI / 2; ug.position.y = 0.05; g.add(ug);
  // the fan at the wheel: blue shirt, brown hair, one arm on the door
  const d = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: 0x4f7fd6, roughness: 0.8 });
  add(new THREE.BoxGeometry(0.62, 0.55, 0.42), shirt, -0.5, 1.5, 0.72, false, d);
  add(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xf0b98d, roughness: 0.8 }), -0.5, 1.98, 0.68, false, d);
  add(new THREE.BoxGeometry(0.44, 0.14, 0.44), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }), -0.5, 2.22, 0.7, false, d);
  add(new THREE.BoxGeometry(0.5, 0.16, 0.2), shirt, -0.95, 1.45, 0.5, false, d);
  g.add(d); g.driver = d;
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

/** The fan on foot: a blocky little guy seen from above (blue shirt, brown hair, dark trousers), legs swinging. */
function makeWalker(): THREE.Group & { legs: THREE.Mesh[] } {
  const g = new THREE.Group() as THREE.Group & { legs: THREE.Mesh[] };
  const m = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  g.legs = [add(new THREE.BoxGeometry(0.34, 0.9, 0.4), m(0x2b2f45), -0.22, 0.45, 0), add(new THREE.BoxGeometry(0.34, 0.9, 0.4), m(0x2b2f45), 0.22, 0.45, 0)];
  add(new THREE.BoxGeometry(0.95, 0.9, 0.55), m(0x4f7fd6), 0, 1.35, 0);
  for (const x of [-0.6, 0.6]) add(new THREE.BoxGeometry(0.24, 0.8, 0.3), m(0x4f7fd6), x, 1.35, 0);
  add(new THREE.BoxGeometry(0.55, 0.55, 0.55), m(0xf0b98d), 0, 2.1, 0);
  add(new THREE.BoxGeometry(0.6, 0.2, 0.6), m(0x5a3a22), 0, 2.45, 0.02);
  g.scale.setScalar(1.5);
  return g;
}

// ---------- pedestrians ----------
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

window.__w6world3d = { create };
