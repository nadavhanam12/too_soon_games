# Graphics integration — 2026-11-17

Implemented locally; not deployed.

## Character motion pass — 2026-11-18

Implemented the full requested motion set in the existing lazy renderer, using rigid-part pivots rather than a skeletal-animation library:

- Front wheels steer independently of axle spin; the steering wheel rotates around its tilted column. Signed player speed drives forward/reverse tire rotation at the model's world-space radius.
- Driver torso leans outward in turns, backward on gas and forward on braking; the head looks slightly into turns and the arms respond to steering. The body/head/arms share one hip-root reaction rig.
- The driver's door is a separate hinged part with an actual opening in the shell. Parking now has a 0.65s door-open / seated-to-standing / door-close sequence before the existing 2.4s walk. The actor crosses from the seat to outside the door in a crouch, rises and turns toward the building. Driver and walker visibility hand off at one threshold; after entering, the car remains empty until the next world reset.
- Walking uses parented thigh/calf joints, alternating backward knee flex, counter-swinging arms, hip weight shift, a small forward slump and head motion. Phase follows distance along the eased path, so the first/last steps slow with translation. No new textures or runtime material types.

The generator now exports 20 parts. Car+driver: **5,457 triangles** (v2: 5,293); walker stays **1,887**. Main-pass material groups rise from 13 to **20** on the hero car and from 5 to **8** on the walker. Shadow passes add work. Shared buffers/materials are reused; no new lights, shader passes, texture downloads or animation dependency. Generator caps are <=6,000 car triangles / <=2,000 walker triangles. Physical-phone profiling is still required; this is a small bounded render-cost increase, not a zero-cost change.

Checks: strict typecheck and local build passed (**187.4 KiB main HTML / 777.7 KiB lazy JS**). `tools/check-hero-animation.ts` verifies steering does not overwrite spin, rear wheels do not steer, acceleration/braking lean directions, door endpoints, calf parenting, backward knee flex, grounded standing pose, finite matrices across 15 walk/exit poses and repeatable pose evaluation. All passed. Bundle that check with esbuild using the explicit `three/build/three.module.js` alias when running under Node (the package's legacy CJS entry does not bundle correctly).

Browser verification on the actual local build: accelerated while turning in Look 3; sampled a Look 4 exit at exit=.744 with walker visible / driver hidden; advanced into upright walking with the door closed; switched the walking sequence to Look 3; advanced to `fiancee` with both walker and seated driver hidden. No console errors/warnings were returned. Captures: `Scene/integration-shots/hero-steering.png`, `hero-door-exit.png`, `hero-walk-motion.png`. The source-only QA panel now has a Steering sample and its Walk sample skips the intro alert before staging arrival. It still uses the game's real input/state/render code.

## Hero model v2 — 2026-11-18

Updated `tools/build_hero.py`, regenerated `src/models/hero-data.json`, `assets-src/models/nice-city-hero.blend` and `.glb`. Added actual boolean wheel openings, low-poly arch lips, door seams/fender vents, dash instruments and rear deck lip. Character now has tapered shirt shoulders/waist, asymmetric swept hair, separate eye/brow details, chin stubble, pointed tie, seams and shoe soles. Seated head/body proportions are closer to the standing character; hands remain at the steering wheel. Existing four wheel and four limb pivots are retained.

Counts: car+driver **5,293** triangles (v1: 4,152); walker **1,887** (v1: 1,428). Generator guards enforce <=5,500 car+driver / <=2,000 walker triangles. Runtime still uses **13 main-pass car material groups and 5 walker draws**, exactly as v1; no new runtime materials, textures, lights or animation skeletons. Triangle/attribute validation passed. Local build: **186.7 KiB HTML, 776.7 KiB lazy JS** (189,456 bytes gzip measured locally; actual transfer compression depends on server). The additional geometry remains lazy. A physical mid-range phone benchmark is still outstanding.

Verified the regenerated model in the actual built game in the in-app browser: Look 4 driver visible; arrival walker visible with driver hidden; switched the same walking sample to Look 3 and advanced its animation. No errors/warnings were returned in that browser check. Capture: `Scene/integration-shots/hero-v2-home-walk.png`. Latest neutral Blender front review: `assets-src/models/hero-v2-front.png`; glossy v2 review: `hero-look4-v2-preview.png` / `nice-city-hero-look4-v2.blend`. These Blender renders use presentation lighting, not the game's exact lighting. `hero-v1-data.json` and `hero-v1-preview.png` retain the previous geometry/reference for comparison.

## Evening searchlight follow-up

Second tuning pass: reduced the shaft's peak alpha from .32 to .15, with a further smooth intensity factor of .52–.98. Ground-pool opacity is .18 times that factor (previously .38). The target sweeps slowly ±5.5 units laterally and ±2.5 longitudinally with frame-rate-independent chase tracking at 1.8/s. No random flicker, new lights or extra draw calls. Check/build passed: 186.7 KiB HTML / 721.7 KiB lazy JS. Remember that the QA panel freezes its clock: use Resume to observe the moving sweep; the stored screenshot cannot demonstrate it.

The helicopter now displays a tapered additive searchlight shaft in Look 4 as well as the original top view. Its front-facing cone uses a small edge/end fade shader and no new dynamic light/shadow pass. The hard yellow/white ring around its ground footprint was removed; the soft cool-white light pool remains. Look 3 has no shaft. Typecheck and local build passed (186.6 KiB HTML, 721.5 KiB lazy JS). Verified the shaft and ring removal in the in-app browser; capture: `Scene/integration-shots/evening-searchlight.png`. The helicopter was positioned using the QA-only `__heliPreview()` hook for that capture; normal flight/chase behavior was retained. The QA panel's Evening searchlight button advances past the opening alert and stages the helicopter. No new WebGL shader error was observed; the previously noted locationless browser MutationObserver exception remained in the tool log.

## Runtime changes

- `src/lazy/world3d.ts` composes the new facade material into the existing window atlas, textures large plain walls via a shared atlas, and adds asphalt grain/cracks and pavement detail. Versioned asset URLs come from `drive.ts` through the existing `assetUrl` helper. The three WebP files in `assets/environment/` total **28,676 bytes**. Requests begin on first entry into Look 3/4, after the first frame. Failed textures retain procedural/untextured fallbacks.
- Look 3 retains cool overcast grading and restrained materials. Look 4 retains sunset, existing bloom/neon/lit windows and adds nearby building ledges and benches. Static additions are merged by material and 112-unit spatial chunks, with distance/frustum culling. No added real-time lights or SSR.
- The 7 curved opaque fronds per palm have 140 foliage triangles per palm; high-detail foliage is spatially merged and culled, while Look 2 retains its simpler leaves. Foliage uses a double-sided material without alpha cards.
- The same Blender hero geometry serves all looks. `src/models/hero.ts` separates paint/chrome from matte skin/clothing; Look 4 changes paint roughness/metalness/clearcoat. The base car+driver is 4,152 triangles and the walker 1,428. Material groups add a few draws without adding geometry. This is an in-engine approximation of the Blender presentation, not its expensive studio reflections.
- Touch-first devices default to 1024 shadow maps and zero MSAA; other devices retain 2048 and 4x in Looks 3/4. This is a conservative capability-based default, **not adaptive GPU profiling**. Resolution, bloom and quality must still be verified on physical phones.
- Retired traffic/helicopter resources are disposed. Shared hero buffers/materials and shared beam materials survive removal. Temporary static geometry is disposed after merging.
- `__graphics()` exposes render counters, texture state, walker/driver visibility and CPU render submission time. Counters include shadow/postprocessing work; `renderMs` is not a GPU timer.

## Checks actually performed

- TypeScript check: passed.
- Local production-format build: passed; **186.4 KiB `index.html`**, **721.1 KiB `lazy/world3d.js`**. The lazy module keeps Three.js and hero geometry outside the main HTML. Main HTML remains below the project's 300 KiB budget.
- Hero data validation: 12 parts / 5,580 total triangles; colour/position lengths and triangle indices valid.
- In-app browser served through a local-only Python server (outside the shell network sandbox), port 5200. Exercised the actual built game through an iframe QA panel using existing debug hooks.
- Look 3 launch stage and Look 4 home stage rendered; all environment assets reached `ready`.
- Keyboard acceleration moved the car from its initial location and reached normal top speed (43 units/s).
- Changed 3 → 2 → 4 and verified textures stayed ready / material maps were restored.
- Home arrival: verified `walker: true` and `driver: false`, then advanced through the complete walk and observed stage `fiancee`.
- Inspected portrait and wide layout using browser viewport overrides. These are desktop browser sizes, not a real touch-device or GPU emulation test.
- Observed approximately 16.7ms in the QA page's outer rAF scheduler during steady samples. CPU submit samples were generally about 0.5–2ms after warm-up. **These observations are not a controlled FPS benchmark, GPU timing or proof of mobile performance**. Raw illustrative snapshots are in `Scene/integration-shots/browser-checks.json`; scene/camera/stage differs between snapshots, so do not treat them as an A/B benchmark.
- No missing environment texture or WebGL shader errors were observed. One locationless `MutationObserver.observe` exception appeared in the browser tool's log after repeated automation/reloads. No `MutationObserver` exists in game/template source; its origin was not established, so it is not claimed as a fixed game bug.

## Reproduce

From repository root:

```powershell
node GamesTemplate/common-game-code/build.mjs check WastedForSix
node GamesTemplate/common-game-code/build.mjs build WastedForSix --local
Copy-Item Games/WastedForSix/tools/graphics-check.html GamesTemplate/.local-dist/graphics-check.html
python -u -m http.server 5200 --bind 127.0.0.1 --directory GamesTemplate/.local-dist
```

Open `http://127.0.0.1:5200/graphics-check.html`. Stage buttons freeze the test clock after the mission-card opening; focus the game and press Space, then use Advance/Resume as appropriate. Walk sample warps to the current destination and advances 0.3 seconds; advance another ~0.9 seconds to pass the parking beat. Advance through the walk to verify the next stage. Hide test UI briefly resumes frames to allow canvas resize, then freezes again for capture. This panel is source-only QA and is not copied into game production assets.

Actual browser captures: `Scene/integration-shots/look3.png`, `look4.png`, `home-walk.png`, `look4-final.png`, `look3-phone.png`. The earlier files include QA controls. Blender previews remain separate under `assets-src/models/`.

## Remaining acceptance work

Stable 30 FPS, touch steering, thermal behaviour, sustained chase load and cold-load timing need a representative mid-range physical phone. No claim of meeting that device target is made. Profile before adding a second model tier or more effects. The assets and current quality switches are a starting point, not a substitute for measurement.
