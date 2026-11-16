---
name: make-music
description: Make original looped music for a Too Soon Games game with the local ACE-Step model - study the game's moments, generate style candidates, let the user pick by ear, fit tracks to screens and stages, cut seamless loops, wire them into the game, check, prune and record provenance. Use for /make-music <GameId>, "make music for the game", "תעשה מוזיקה למשחק", "מוזיקה למשחק", "פסקול".
---

# /make-music <GameId>

Music is made locally with ACE-Step 1.5 (`../ACE-Step-1.5`, model XL-sft) and shipped as small looped MP3s in
`Games/<GameId>/assets/audio/`. Scripts are next to this file. Everything for one game lives in `Games/<GameId>/music/`:

```
music/specs/<run>.json            what was asked (prompts per track)          ← in git
music/runs/<run>/prompts.json     request + seed + metas per candidate        ← in git
music/runs/<run>/raw/*.wav        WAV masters from the server (~15 MB each)   ← local only (.gitignore)
music/runs/<run>/game/*.mp3       loop-cut, encoded candidates                ← local only
music/chosen.json                 track name in the game → run, candidate, prompt, seed, bpm, key   ← in git
```

**You cannot hear.** The user decides by ear at every pick. Your tools for taste are the prompt, `analyze.py` numbers and
the game's story. Never say a track "sounds good"; say what you asked for and what the numbers show.

## 0. Preflight

```bash
bash GamesTemplate/other-services/skills/make-music/preflight.sh
```
Fix every FAIL before generating. If the server is down, start it with the command preflight prints, as a **background**
command, then wait for `curl -s http://127.0.0.1:8001/health` (models load on the first request: about a minute; the
first ever run downloads ~20 GB). Python for the scripts: `PY=../ACE-Step-1.5/.venv/Scripts/python.exe` (run with `-I`).

Also check `git status` and `list_sessions`: if another session is editing this game, touch only the lines you need and
stage only your own hunks at the end (section 7).

## 1. Study the game → moments

Read `Games/<GameId>/CLAUDE.md`, `research.md`, `src/main.ts` (scenes) and the stage machine. Propose **3–4 moments that
need different music**, as a Hebrew table: moment, where in the game (screens / stages), feeling. Typical split:
opening + ending (title, cutscene, result) · the main loop · the tense part (chase, timer) · decisions / text-heavy
screens (quiet). The lose screen stays silent (the template's `'off'`): the silence is part of the joke.
If the user already has a style in mind (an artist, a song), translate it into **genre and production traits**; the
artist or song name never goes into a prompt or a file.

## 2. Style round

Write `music/specs/<run>.json` (first run: `styles-v1`) with **4 different directions, 3 candidates each**, all in the
role of the main loop, so the user compares styles, not moments:

```json
{
  "note": "why this run exists",
  "defaults": { "model": "acestep-v15-xl-sft", "inference_steps": 50, "guidance_scale": 7.0,
                "lyrics": "[Instrumental]", "duration": 40, "batch": 3, "loop_bars": 12 },
  "tracks": {
    "A-gfunk": { "label": "Hebrew one-liner for the user", "prompt": "...", "bpm": 92, "key_scale": "F minor" }
  }
}
```
Track names are `<letter>-<word>`; candidates come out as `<track>-<n>`. Then:

```bash
node GamesTemplate/other-services/skills/make-music/generate.mjs <GameId> <run>          # ~1 min per track (XL)
$PY -I GamesTemplate/other-services/skills/make-music/loopify.py <GameId> <run>
```

**Prompt rules** (what made the difference):
- Genre + era + instruments + production + mood, as a studio brief: "late 1990s West Coast G-funk instrumental, whining
  Moog portamento lead, live funky bass guitar played by a session player, warm Fender Rhodes, laid-back swung drum break
  slightly behind the beat, analog tape warmth".
- **Against the mechanical sound:** live players, swing / behind the beat, analog warmth, a real room. The turbo model
  and gimmick lists (kazoo, cowbell, slide whistle all at once) sound mechanical.
- **Humor through attitude**, not gimmick instruments: "tongue-in-cheek swagger", "playful wink", "mischievous".
- One clear idea per direction; make the four directions really different (era, lead instrument, tempo, mood).
- Loops: `duration` 40 and `loop_bars` 12 (≥ 14 above 100 BPM) leave room for the 1-bar head and the crossfade.
- Stingers / songs: no `loop_bars`; songs get lyrics with `[Verse]` / `[Chorus]` tags and `vocal_language`.

## 3. Deliver for listening

- **Remote user / any user:** `SendUserFile` with the MP3s from `runs/<run>/game/` (`display: "attach"`), caption =
  what each letter is. That is the only way they can hear them from a phone.
- **At the computer:** `preview_start` `{name: "music-listen"}` and open
  `http://localhost:5190/GamesTemplate/other-services/skills/make-music/listen.html?game=<GameId>&run=<run>`
  (loops play looped; tracks already in the game are tagged).

Ask which candidates they like (e.g. "A-3, D-2") and what bothers them. Iterate with a new run (`styles-v2`, ...): go
deeper into the liked direction, change one thing at a time, keep what they praised.

## 4. Fit tracks to moments

When the user has favorites, measure them and propose a mapping (Hebrew table: track · what it is by the numbers · where):

```bash
$PY -I GamesTemplate/other-services/skills/make-music/analyze.py <GameId> <run>
```
`loud` / `bright` (Hz) / `busy` (onsets/s) / `bass` / `air` / `arc`. Rules of thumb: brightest + lightest → opening and
ending; steady, darkest, most bass → the long main loop (must not tire over minutes); busiest + loudest → chase /
tension; quietest → decisions and text. Say plainly that the mapping comes from the prompts and the numbers, not
from listening.

**A moment has no track yet** → make variations of a track the user loves (`<run>` = `<game>-vN`):
- same melody, new arrangement: `"task_type": "cover"`, `"src_audio_path": "runs/<run>/raw/<track>-<n>.wav"`,
  `"audio_cover_strength"`: 0.85 almost the original · 0.7 re-arranged · 0.5 recognizable but different.
  Cover keeps the source tempo.
- different tempo (a chase): `text2music` with `"reference_audio_path"` = the loved track, new `bpm`.
- after generating, `analyze.py <GameId> <run> --vs <track>-<n>` (specSim ≥ 0.98 = a near copy: lower the strength).

## 5. Ship into the game

```bash
node GamesTemplate/other-services/skills/make-music/ship.mjs <GameId> <run>/<track>-<n>=<name> [...]
```
Copies to `assets/audio/<name>.mp3`, records `music/chosen.json`, fails above 1.5 MB total (rule 13א; four ~30 s loops ≈
850 KB). Names are lowercase words for the moment (`theme`, `drive`, `chase`, `scheme`).

Wire it (template contract, DECISIONS 74):
- `music: { files: { theme: 'assets/audio/theme.mp3', ... }, volume: { theme: 0.34, ... } }` in `createGame` (keep it
  in `src/sfx.ts` as `MUSIC`, with a comment pointing at `music/chosen.json`). Quiet moments ~0.3, chase ~0.38.
- `musicFor(scene)` picks the track for template screens: `'off'` on `lose`, the opening track elsewhere; for `play`,
  return the current stage's track.
- Inside `play`, switch per stage: a `STAGE_MUSIC: Record<StageName, string>` map and
  `if (R.cfg.music !== false) music.set(STAGE_MUSIC[name])` in `setStage`; back to the opening track on the end beat.
  The template crossfades. `music.set` with a name that is not in `files` **throws**: that is on purpose.
- Template has only calm / play / win in the synth; files may use any names.

## 6. Check

1. `npm run check -- <GameId>` in `GamesTemplate/common-game-code`.
2. Browser (dev server `wastedforsix-dev`-style config or `game-dev` attached to a running one): click once (audio
   unlock), then per screen `__go(scene)` and per stage `__stage(name)`; `__music()` must show the expected `mode` with
   that track `PLAY` at its volume and all others paused. Every `assets/audio/*.mp3` request 200.
3. `node GamesTemplate/other-services/bugcheck/run.mjs <GameId> --quick` → GREEN (it checks the 1.5 MB audio budget).
4. Send the final four files (`assets/audio/`) to the user once more if they have not heard the cut loops.

## 7. Prune, record, commit

- `ship.mjs <GameId> --prune` deletes every candidate not in `chosen.json` (WAV + MP3), marks it `pruned` in its
  `prompts.json` (prompt and seed stay). Permanent: only after the user confirmed the picks.
- Game `CLAUDE.md`: an `assets/audio/` line (which name plays where, "see music/chosen.json"). A DECISIONS row only if
  the template changed or a rule was bent.
- Commit only when the user asks. Stage `assets/audio/`, `music/specs`, `music/runs/*/prompts.json`,
  `music/chosen.json` and your source edits. If another session has uncommitted work in the same files, stage only your
  hunks (build the blob from `HEAD` + your edits, `git hash-object -w` + `git update-index --cacheinfo`), then prove the
  staged snapshot builds alone (`git checkout-index -a --prefix=<scratch>/`, junction `node_modules`, `build.mjs check`).

## Failure notes

| symptom | cause | fix |
|---|---|---|
| task "failed" while the log says "Decoding audio..." / decode on CPU, 0.3 GB free | two DiT models on the GPU (`ACESTEP_CONFIG_PATH2`) | one model only (preflight checks it), restart the server |
| `MP3 export failed ... ffmpeg executable not found` | the server was asked for MP3 | `generate.mjs` asks for WAV; keep it that way |
| `absolute audio file paths are not allowed` | source audio sent as a JSON path | `generate.mjs` uploads it as multipart; paths in specs are relative to `music/` |
| sounds mechanical / MIDI-like | turbo model, 8 steps, gimmick-list prompt | XL-sft, 50 steps, live-player prompt (section 2) |
| loop seam jumps | the model drifted from the requested BPM | loopify cuts by the reported BPM; try another candidate, or `loop_bars` ±2 |
| `music.set('x'): no such track` | name typo or a track missing from `files` | fix the name; do not catch it |
| vllm import errors | Windows | `ACESTEP_LM_BACKEND=pt` |

Known gap: the template starts downloading music files at boot, not after the first frame (rule 13א). With ~850 KB of
audio plus a lazy 3D module, the first frame may be slower on 4G; a template fix is pending.
