# Look 3 / Look 4 — Blender environment handoff

**Latest animation update:** see the Character motion pass in `GRAPHICS-INTEGRATION.md`. Current export has 20 pivoted parts for steering, door, driver head/arms and walking knees/head. Counts are 5,457 car+driver / 1,887 walker triangles. The source `.blend`/`.glb` contains authored parts; animation is evaluated procedurally in `src/models/hero.ts` from the game's steering/pedal/exit state, not baked GLB animation clips.

**Latest hero update (2026-11-18):** runtime and base Blender/GLB now use model v2: 5,293 car+driver triangles / 1,887 walking character; unchanged runtime draw/material counts. Review `hero-v2-front.png` and `hero-look4-v2-preview.png` in `assets-src/models/`. The glossy source is `nice-city-hero-look4-v2.blend`. Earlier counts and preview filenames below describe the first handoff; consult `GRAPHICS-INTEGRATION.md` for the current verification and sizes.

## Status and intended result

The user approved the hero direction and asked for richer facades, better palms and asphalt, while retaining web play on mid-range phones. The images here are **Blender art-direction previews, not screenshots of the running game and not a measured mobile quality tier**. The runtime integration is now implemented in `src/lazy/world3d.ts`: delayed versioned textures, composed facade/window maps, atlas walls, textured pavement/asphalt, spatially merged curved palms and nearby Look 4 ledges/benches. The existing city/collision/navigation is retained. In-game screenshots and verification are recorded in `GRAPHICS-INTEGRATION.md`.

Look 3: cool overcast light, muted colours, readable faceted silhouettes, restrained reflections. Look 4: the same world at pink/orange sunset, purple shadows, warm windows, selective cyan/pink neon, richer nearby architecture and controlled paint highlights. Keep the road and hazards readable. Do not make every surface glow.

## Files (relative to Games/WastedForSix)

- `assets-src/models/street-look3-v2.png`, `street-look4-v2.png`: latest overall visual references.
- `assets-src/models/nice-city-street-look3-v2.blend`, `nice-city-street-look4-v2.blend`: editable reference scenes with packed textures. These contain presentation cameras, lights and duplicate standing/seated characters for comparison; they are not optimized runtime world assets.
- `assets-src/models/textures/facade-atlas.png`: 1024×1024, four 512px tiles (stucco, brick, siding, concrete); original procedural base-colour texture, with painted crevice shading. See `textures/manifest.json` for layout. **Not a physically baked AO/lightmap.** Account for mipmap tile bleed in final UVs/padding.
- `assets-src/models/textures/asphalt.png`: repeating 512×512 grain and fine crack texture.
- `assets-src/models/textures/pavement.png`: repeating 256×256 paving texture.
- The same three files also have `.webp` delivery candidates (quality 82); the Blender references use lossless PNG. Inspect WebP detail before adopting. WebP reduces transfer size, not decoded GPU memory.
- `tools/build_street_textures.py`: reproducible texture generation, Python + Pillow.
- `tools/preview_street_looks.py`: reproducible Blender scenes; contains curved tapered palm mesh generation (7 fronds × 20 triangles = 140 triangles for foliage per palm), facade UV examples and material settings.
- `assets-src/models/nice-city-hero.blend`, `nice-city-hero.glb`, `hero-preview.png`: base hero assets. Base Blender file has both seated and standing characters, authored using Blender Z-up; game mesh export is Y-up, nose -Z.
- `assets-src/models/nice-city-hero-look4.blend`, `hero-look4-preview.png`: separate glossy hero presentation. Runtime now isolates car paint/chrome from cloth/skin and varies roughness/clearcoat by look; Blender studio reflections are not reproduced with costly real-time reflection passes.
- `tools/build_hero.py`: base hero generator and game geometry exporter.
- `tools/preview_hero_look4.py`: glossy hero reference generator.
- `src/models/hero-data.json`, `src/models/hero.ts`: existing runtime hero geometry/helper; `src/lazy/world3d.ts` already calls `heroCar`, `heroWalker`, `animateHero`. Inspect current files before changing them; other work may be in progress.
- `assets-src/models/hero-stats.json`: base mesh counts: car + seated driver 4,152 triangles, standing character 1,428. Body and glass + four rotating wheels + driver = 7 hero geometry draws in the main pass; walker = 5. Shadow passes add work.

## Where integration belongs

- Read `CLAUDE.md`, `GamesTemplate/docs/RULES.md` and current diffs first. Preserve unrelated/uncommitted work.
- `src/city.ts`: deterministic city geometry, places, collision and navigation. Enrich visual primitives without changing collision or destinations unintentionally.
- `src/lazy/world3d.ts`: Three.js renderer, material buckets / `addStatic`, `addPrim`, `windowTexHi`, `asphaltTex`, `setLook`, `setDusk`, palms, shadows and bloom. Reuse this pipeline; preserve lazy loading.
- `src/models/hero.ts`: car body/wheels now use groups to isolate paint and chrome; skin/cloth remain matte. Shared geometry/materials are marked to survive dynamic car disposal. Driver hide-on-exit and walking pivots were verified in-browser.
- `src/legs.ts`, `src/drive.ts`, `src/world3d-api.ts`: existing look selection, camera and render contract. Look 3 follows the boss; the drive home currently uses Look 4. Preserve gameplay/camera unless a change is required and explained.
- `Scene/hero-review.html`, `tools/hero-review.ts`: earlier review harness, not the game's production entry point. Its generated JS may be stale; rebuild it before use.

## Mobile constraints and implementation approach

1. Proposed acceptance target: stable **30 FPS on a representative mid-range phone**, 60 where possible. This target has not been measured yet. Desktop FPS or Blender timings do not prove mobile performance.
2. Keep base geometry shared. Use UV detail / painted shading for most facade richness; merge static meshes by material and spatial chunk, and instance repeated props. Do not ship one mesh/material/draw call per window, balcony rail or leaf from the presentation scene.
3. Near-camera detail only; simpler distant silhouettes. Avoid city-wide additional geometry and unbounded transparent layers. Palm foliage is opaque low-poly geometry; preserve two-sided visibility or add correct backfaces if needed.
4. Reuse the small texture set. Ship only production copies under `assets/` when integrated, after the first frame through the project-approved asset path. `assets-src/` and `.blend` files are source-only. Use mipmaps, correct sRGB for colour maps, bounded anisotropy; assess download size and decoded GPU texture memory. Atlas with mipmaps is about 5.3 MiB for RGBA8, asphalt 1.3 MiB, pavement .33 MiB before compression; smaller files on disk do not imply smaller GPU memory.
5. Do not reproduce Blender area lights, real-time SSR, or all presentation bevel modifiers on phones. Use existing sun/hemi lighting, emissive windows/signs, cheap light pools and modest bloom. Baked/cached reflection probes only if justified. Review existing 4x MSAA, shadow maps and bloom before adding cost; dynamic resolution/quality should respond to sustained performance with hysteresis, not just user-agent/device names.
6. Two render quality tiers can share assets: reduce shadow resolution, bloom cost, render scale and prop distance first. Avoid building two independent art sets prematurely. Explain whether profiling actually supports a second mesh LOD.
7. Initial proposed incremental budgets (not achieved measurements): <= 15 extra visible main-pass draw calls and <= 20k extra visible triangles for the nearby environment. Establish baseline and adjust based on GPU/CPU timing rather than blindly using these numbers.
8. Validate cold load, 3→4 switch, close-ups, driving/chase, building entry, driver disappearing and walker animation. Test portrait and wide screens. Report average/p95 frame time and sustained thermal behaviour, plus triangles, draw calls, texture memory and transfer sizes. Throttled desktop testing is supplementary.
9. Keep `index.html` <= 300KB per project rule; Three.js/geometry stays lazy. Existing local build was 185.9KB main HTML and ~715KB lazy JS when the hero was added; remeasure current state. No mobile benchmark has been performed.

## Reproduction (PowerShell from repository root)

```powershell
python Games/WastedForSix/tools/build_street_textures.py
& 'C:/Program Files/Blender Foundation/Blender 4.0/blender.exe' -b --python Games/WastedForSix/tools/preview_street_looks.py
node GamesTemplate/common-game-code/build.mjs check WastedForSix
node GamesTemplate/common-game-code/build.mjs build WastedForSix --local
```

Before implementation, give your own technical/artistic opinion: what should be kept, simplified or changed, whether the proposed mobile budget is reasonable, and which device/measurements are needed to validate it. Then implement the approved direction and report honestly which checks were actually run. Do not claim the Blender previews already run in the web game.
