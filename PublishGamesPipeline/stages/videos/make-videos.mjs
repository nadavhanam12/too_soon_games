#!/usr/bin/env node
// Stage "videos" of /launch-game (playbook slide 16): three vertical 10-15 s clips of real gameplay, an email GIF and a
// cover image.
//   node make-videos.mjs <GameId> [--seed N] [--tries N] [--skip-build] [--reuse]
//     --seed    use exactly this seed (no tries)
//     --clip    encode only this clip (hook | arc | challenge), e.g. to review one before the others
//     --full    capture every frame of the run (to pick "clips" windows in captions.json, then --reuse)
//     --reuse   keep the captured frames from the last run (same seed) and only redo captions, end card and encoding,
//               e.g. after editing launch/videos/captions.json
// Out: Games/<GameId>/launch/videos/{hook,arc,challenge}.mp4, email.gif, cover.png, captions.json, videos.json
//
// How: the game runs on its manual clock (window.__manual / __advance, the same hooks the bug check uses), so a run is
// a pure function of the seed and the bot. Pass 1 plays the whole run fast and writes a timeline (when it ends, stage
// changes, the score). Pass 2 replays the identical run and grabs the canvas only inside the windows the three clips
// need, at 1080x1920 (360x640 CSS px at device scale 3), 30 fps, straight from the canvas: no screen recording, so no
// dropped frames and no blur. Captions and the end card are HTML rendered by the browser (Hebrew and RTL come out
// right; ffmpeg's drawtext gets them wrong) and laid over the frames with the full ffmpeg from .video-tools.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { blockApi } from '../../lib/outreach.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const TEMPLATE = join(REPO, 'GamesTemplate');
const CLIENT = join(TEMPLATE, 'common-game-code');
const DIST = join(TEMPLATE, '.local-dist');
const { chromium } = createRequire(join(TEMPLATE, 'other-services', 'bugcheck', 'package.json'))('playwright');

const args = process.argv.slice(2);
const gameId = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
if (!gameId) { console.error('usage: node make-videos.mjs <GameId> [--seed N] [--skip-build] [--reuse]'); process.exit(2); }
const GAME = join(REPO, 'Games', gameId);
if (!existsSync(join(GAME, 'game.json'))) { console.error(`Games/${gameId}/game.json not found`); process.exit(2); }
const cfg = JSON.parse(readFileSync(join(GAME, 'game.json'), 'utf8'));
const studio = JSON.parse(readFileSync(join(TEMPLATE, 'studio.json'), 'utf8'));
let SEED = Number(opt('--seed', 7));
const TRIES = Number(opt('--tries', 30)); // pass 1 tries this many seeds and keeps the longest run (cheap: ~1 s each)
const TARGET_S = 40;                          // a run this long is good enough: stop trying
const OUT = join(GAME, 'launch', 'videos');
// --run <name> --route <name>: capture another run of the game (the bot with playthrough.mjs `routes[<route>]` laid over
// `bot`, e.g. the loan-shark chase home) into launch/.work/videos-<name>, capture only; a clip takes shots from it with
// [from, to, { "run": "<name>" }] in captions.json clips.
const RUN = opt('--run'), ROUTE = opt('--route');
const runDir = (r) => join(GAME, 'launch', '.work', r ? `videos-${r}` : 'videos');
const WORK = runDir(RUN);
const FRAMES = join(WORK, 'frames');
mkdirSync(OUT, { recursive: true });

const FPS = 30, TICK = 1 / FPS;
// Caption (Nadav, 2026-11-18): it starts low, where it reads at once, and after CAP_MOVE_AT slides up to CAP_END over
// CAP_MOVE_S, off the faces and the action. captions.json "captionTop" / "captionEndTop": { <clip>: css px } override.
const CAP_START = 262, CAP_END = 96, CAP_MOVE_AT = 1.0, CAP_MOVE_S = 0.4; // CAP_END: just under a game's top bar (14 was on it; Nadav: lower)
const CAP_SLIDE = 22, CAP_IN_S = 0.25, CAP_OUT_S = 0.2;   // a caption in a sequence: css px it travels, in / out seconds
const VW = 360, VH = 640, DPR = 3;             // CSS viewport and scale: the canvas comes out 1080x1920
const W = VW * DPR, H = VH * DPR;
const MAX_RUN_S = Number(opt('--max-seconds', 600));
const END_HOLD_S = 1.2;                        // keep filming this long after the run ends (the lose/result screen)
const CARD_S = 3;                              // end card length (its animations need ~1.6 s, then it holds)
const rtl = cfg.lang === 'he';
const log = (...a) => console.log('[videos]', ...a);

// ---------- ffmpeg: the full build from .video-tools (Playwright's own ffmpeg has no x264 and no palettegen) ----------
const ffDir = join(REPO, '.video-tools', 'imageio_ffmpeg', 'binaries');
const FF = existsSync(ffDir) ? readdirSync(ffDir).filter((f) => f.startsWith('ffmpeg')).map((f) => join(ffDir, f)).pop() : '';
if (!FF) { console.error(`ffmpeg not found in ${ffDir} (the .video-tools folder holds the full ffmpeg build)`); process.exit(1); }
function ff(argv, what) {
  const r = spawnSync(FF, ['-y', '-loglevel', 'error', ...argv], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${what}): ${r.stderr || r.error}`);
}

// ---------- build and serve ----------
if (!flag('--skip-build') && !flag('--reuse')) {
  log('building into .local-dist');
  const b = spawnSync(process.execPath, [join(CLIENT, 'build.mjs'), 'build', gameId, '--local'], { encoding: 'utf8' });
  if (b.status !== 0) { console.error(b.stdout + b.stderr); process.exit(1); }
}
if (!existsSync(join(DIST, cfg.slug, 'index.html'))) { console.error(`.local-dist/${cfg.slug}/index.html missing: run without --skip-build`); process.exit(1); }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/${cfg.slug}/`;
// --still <file> "<expression>": save a picture the game draws (an expression in the page that returns a PNG data URL,
// or null until its images have loaded) to launch/videos/<file>, for a still shot: [0, seconds, { "image": "<file>" }].
// Nice City: --still stills/montage.png "__ogPic(640)" (the montage, clean: in the run it rains confetti).
// --query "<url query>" opens the game with it (e.g. "stage=home&store=steal"); the game then runs in real time and the
// expression may stage a moment over several calls (it is called every 100 ms for up to 30 s, until it returns a URL).
if (flag('--still')) {
  const [file, expr] = [opt('--still'), args[args.indexOf('--still') + 2]];
  if (!file || !expr) { console.error('usage: --still <file> "<page expression returning a data URL>"'); process.exit(2); }
  const br = await chromium.launch(), pg = await (await br.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR })).newPage();
  await pg.goto(opt('--query') ? `${base}?${opt('--query')}` : base, { waitUntil: 'load' });
  const url = await pg.evaluate(async (e) => {
    for (let i = 0; i < 300; i++) { const u = (0, eval)(e); if (u) return u; await new Promise((r) => setTimeout(r, 100)); }
    return null;
  }, expr);
  await br.close(); server.close();
  if (!url || !String(url).startsWith('data:image/')) { console.error(`--still: "${expr}" gave no picture within 30 s`); process.exit(1); }
  const out = join(GAME, 'launch', 'videos', file); mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  log(`still → ${out}`); process.exit(0);
}

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); } // no installed Chrome: Playwright's bundled Chromium, as in the bug check

// ---------- the game's bot (Games/<GameId>/playthrough.mjs), or a seeded steering autopilot ----------
const ptFile = join(GAME, 'playthrough.mjs');
const pt = existsSync(ptFile) ? await import(pathToFileURL(ptFile).href) : {};
if (RUN && !(ROUTE && pt.routes?.[ROUTE])) { console.error(`--run needs --route <one of playthrough.mjs routes: ${Object.keys(pt.routes || {}).join(', ') || 'none'}>`); process.exit(2); }
if (RUN && (!flag('--full') || flag('--reuse'))) { console.error('--run captures a whole other run: pass --full, without --reuse'); process.exit(2); }
function makeRng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

async function openRun(page) {
  await page.goto(`${base}?seed=${SEED}`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__manual === 'function' && typeof window.__advance === 'function', null, { timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  // captions.json "pageInit": an expression run in the page before the run, for what the game draws only (Nice City:
  // "__noHint()", no keys line in a drive's read pause). It must not change the run: pass 1 and 2 both get it.
  const capF = join(OUT, 'captions.json'), init = existsSync(capF) ? JSON.parse(readFileSync(capF, 'utf8')).pageInit : undefined;
  if (init) await page.evaluate((e) => { (0, eval)(e); }, init);
  await page.evaluate((seed) => { window.__manual(true); window.__seed(seed); window.__go('play'); }, SEED);
}

/**
 * Plays one run tick by tick. onTick(t, snap) runs after each step and may capture. Both passes must make the same
 * calls in the same order, or the replay drifts from the timeline.
 */
async function playRun(page, onTick) {
  const held = new Set();
  const key = (k) => ({ ' ': 'Space' }[k] || k);
  const io = {
    press: (k) => page.keyboard.press(key(k)),
    down: async (k) => { if (!held.has(k)) { held.add(k); await page.keyboard.down(key(k)); } },
    up: async (k) => { if (held.has(k)) { held.delete(k); await page.keyboard.up(key(k)); } },
    hold: (k, on) => (on ? io.down(k) : io.up(k)),
    releaseAll: async () => { for (const k of [...held]) await io.up(k); },
  };
  const step = (d) => page.evaluate((d) => {
    const w = window; if (d) { w.__advance(d); w.__audioT = (w.__audioT || 0) + d; } // the sound clock follows the game clock
    const st = w.__state();
    return { scene: st.scene, banner: st.banner, run: st.run, world: w.__world ? w.__world() : null, peek: w.__peek ? w.__peek() : null, music: w.__music ? w.__music() : null };
  }, d);
  // Autopilot for stages without a bot: hold a direction for a while, sometimes jump. Seeded, so both passes match.
  const rng = makeRng(SEED * 31 + 5);
  let autoUntil = 0, autoDir = 'ArrowLeft';
  const autopilot = async (t) => {
    if (t >= autoUntil) {
      await io.up(autoDir);
      autoDir = rng() < 0.5 ? 'ArrowLeft' : 'ArrowRight';
      autoUntil = t + 0.25 + rng() * 0.9;
      await io.down(autoDir);
      if (rng() < 0.35) await io.press(' ');
    }
  };

  let t = 0, tStage = 0, stage = null, endAt = null, snap = await step(0);
  const timeline = { stages: [], end: null };
  while (t < MAX_RUN_S) {
    if (endAt === null && (snap.scene === 'result' || snap.scene === 'lose')) {
      endAt = t; timeline.end = { t: +t.toFixed(3), scene: snap.scene, run: snap.run }; await io.releaseAll();
    }
    if (endAt !== null && t >= endAt + END_HOLD_S) break;
    if (endAt === null && snap.scene === 'play') {
      const id = snap.world?.stage ?? 'play';
      if (id !== stage) { await io.releaseAll(); stage = id; tStage = 0; timeline.stages.push({ id, t: +t.toFixed(3) }); }
      if (snap.banner) { await io.releaseAll(); await io.press('Enter'); }
      else {
        const bot = (ROUTE ? pt.routes[ROUTE] : null)?.[id] ?? pt.bot?.[id];
        if (bot) await bot({ world: snap.world, peek: snap.peek, t: tStage }, io);
        else await autopilot(t);
        tStage += TICK;
      }
    }
    await onTick(t, snap);
    snap = await step(TICK); t += TICK;
  }
  await io.releaseAll();
  if (!timeline.end) throw new Error(`the run did not end within ${MAX_RUN_S} s (raise --max-seconds, or the bot never finishes)`);
  timeline.duration = +t.toFixed(3);
  return timeline;
}

// ---------- pass 1: timeline ----------
const tlFile = join(WORK, 'timeline.json');
let timeline;
if (flag('--reuse')) {
  if (!existsSync(tlFile)) { console.error('--reuse: no previous capture in launch/.work/videos'); process.exit(1); }
  timeline = JSON.parse(readFileSync(tlFile, 'utf8'));
  if (!args.includes('--seed')) SEED = timeline.seed; // --reuse alone means "the seed of the last capture"
  if (timeline.seed !== SEED) { console.error(`--reuse: the frames were captured with seed ${timeline.seed}, not ${SEED}`); process.exit(1); }
} else {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, hasTouch: false, locale: rtl ? 'he-IL' : 'en-US' });
  await blockApi(ctx); // never write the capture runs into production analytics
  const page = await ctx.newPage();
  const t0 = Date.now();
  const seeds = args.includes('--seed') ? [SEED] : Array.from({ length: TRIES }, (_, i) => SEED + i);
  let best = null;
  for (const s of seeds) {
    SEED = s;
    await openRun(page);
    const tl = await playRun(page, async () => {});
    if (!best || tl.end.t > best.tl.end.t) best = { seed: s, tl };
    if (best.tl.end.t >= TARGET_S) break;
  }
  await ctx.close();
  SEED = best.seed; timeline = best.tl;
  timeline.seed = SEED;
  log(`pass 1: seed ${SEED}, run ends at ${timeline.end.t.toFixed(1)} s (${timeline.end.scene}, score ${timeline.end.run?.score ?? '?'}), ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
}

// ---------- the three clips: which seconds of the run each one shows ----------
const E = timeline.end.t, END = E + END_HOLD_S;
const clamp = (a, b) => [Math.max(0, a), Math.min(END, b)];
function plan() {
  if (E < 9) { // a short run: every clip is the whole run, only the caption differs
    const all = [[0, END]];
    return { hook: all, arc: all, challenge: all };
  }
  const mid = E / 2;
  return {
    // A: the ending first (the fall, the loss: the hook in the first second), then how it started
    hook: [clamp(E - 2.5, END), clamp(0.3, 7.3)],
    // B: start, the middle, the end
    arc: [clamp(0.3, 4.3), clamp(mid - 2, mid + 2), clamp(E - 3, END)],
    // C: the last stretch, when it is hardest, with the score on screen
    challenge: [clamp(E - 9, END)],
  };
}
// A long story run (Nice City: 170 s) is not served by the fixed windows above (they land on its tutorial and on
// transition screens): captions.json may set "clips": { hook | arc | challenge: [[from, to], ...] } in game seconds,
// picked from a --full capture. Frames outside the windows of a capture are missing, so a --reuse with new windows
// needs a capture that covers them (--full covers all).
const capJson = (() => {
  const f = join(OUT, 'captions.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
})();
const capClips = capJson.clips;
const clips = plan();
if (capClips) for (const [name, segs] of Object.entries(capClips)) {
  if (!(name in clips)) throw new Error(`captions.json clips: unknown clip "${name}" (hook, arc, challenge)`);
  // a shot: [from, to] in game seconds, or [from, to, { "run": "<name>" (a --run capture), "hold": s (freeze its last
  // frame this long, for a moment the game shows too briefly), "image": "<file in launch/videos>" (a still shown
  // to - from seconds, see --still) }]
  if (!Array.isArray(segs) || !segs.length || segs.some((g) => !Array.isArray(g) || g.length < 2 || g.length > 3 || !(g[0] < g[1]) || (g[2] !== undefined && (typeof g[2] !== 'object' || (g[2].hold !== undefined && !(g[2].hold > 0)))))) throw new Error(`captions.json clips.${name}: expected [[from, to, { run?, hold? }?], ...] with from < to`);
  // only shots of the main run are clamped to its length (another run has its own)
  clips[name] = segs.map(([a, b, o = {}]) => (o.run || o.image || capJson.clipRun?.[name] ? [a, b, o] : [...clamp(a, b), o]));
}
// two frames of slack on each side: the encoder rounds segment edges to whole frames
const want = (t) => flag('--full') || Object.values(clips).some((segs) => segs.some(([a, b, o]) => !o?.run && !o?.image && t >= a - 2 / FPS && t < b + 2 / FPS));
const frameName = (t) => `${String(Math.round(t * FPS)).padStart(6, '0')}.jpg`;

// ---------- pass 2: replay and grab the frames ----------
if (!flag('--reuse')) {
  rmSync(WORK, { recursive: true, force: true }); mkdirSync(FRAMES, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, hasTouch: false, locale: rtl ? 'he-IL' : 'en-US' });
  await blockApi(ctx); // never write the capture runs into production analytics
  // Sound: the game's synth (sfx + sequencer music) schedules on AudioContext.currentTime. Here the context is an
  // offline one whose clock is the game clock (__audioT, moved by playRun's step), so every sound lands on the frame
  // that caused it, and the whole run renders to one WAV after the replay. Only synth sound is captured: music that a
  // game plays from files (music.files, each with its src) is laid in below, not mixed in here, EXCEPT files the game routes
  // through Web Audio (createMediaElementSource, e.g. Nice City's sound effects): an offline context cannot take a
  // media element, so each play() of such an element decodes its file into the offline context and starts it at the
  // game time of the play() call, through the gain chain the game built.
  await ctx.addInitScript((seconds) => {
    const RATE = 44100;
    window.__audioT = 0;
    const routed = new Map(), decoded = new Map(), pending = [];
    class GameClockContext extends OfflineAudioContext {
      constructor() { super(1, Math.ceil(seconds * RATE), RATE); window.__audioCtx = this; }
      get currentTime() { return window.__audioT; }
      get state() { return 'running'; }
      resume() { return Promise.resolve(); }
      createMediaElementSource(el) { const g = this.createGain(); routed.set(el, g); return g; }
    }
    window.AudioContext = GameClockContext; window.webkitAudioContext = GameClockContext;
    const realPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const g = routed.get(this);
      // Looped elements are music.files: the template routes them through Web Audio too (RULES 13ד), but each clip lays
      // its one music track in from the file, so they stay out of sfx.wav. They really play, so the element is not
      // paused: when they were taken here instead, the template called play() on every tick and each call stacked one
      // more copy of the track until it clipped (the loud noise in the first Nice City clips, 2026-11-18).
      if (!g || this.loop) return realPlay.call(this);
      const c = g.context, at = c.currentTime, url = this.currentSrc || this.src;
      if (!decoded.has(url)) decoded.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)));
      pending.push(decoded.get(url).then((buf) => { const s = c.createBufferSource(); s.buffer = buf; s.connect(g); s.start(at); }));
      return Promise.resolve();
    };
    window.__renderAudio = async () => {
      const c = window.__audioCtx; if (!c) return null;
      await Promise.all(pending); // every routed file is decoded and scheduled before the render starts
      const d = (await c.startRendering()).getChannelData(0);
      const pcm = new Int16Array(d.length);
      for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
      const bytes = new Uint8Array(pcm.buffer); let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { rate: RATE, pcm: btoa(s) };
    };
  }, timeline.duration + 3);
  const page = await ctx.newPage();
  await openRun(page);
  const size = await page.evaluate(() => { const c = document.querySelector('canvas#c'); return c ? [c.width, c.height] : null; });
  if (!size) throw new Error('canvas#c not found');
  if (size[0] !== W || size[1] !== H) log(`note: the canvas is ${size[0]}x${size[1]}, scaled to ${W}x${H}`);
  let n = 0; const t0 = Date.now();
  const modes = [], heard = {}, srcs = {}; // file music: when each track was on (game time) and how loud the game played it
  const replay = await playRun(page, async (t, snap) => {
    if (snap.music) {
      if (!modes.length || modes[modes.length - 1].mode !== snap.music.mode) modes.push({ t, mode: snap.music.mode });
      for (const [k, f] of Object.entries(snap.music.files)) { heard[k] = Math.max(heard[k] || 0, f.volume); srcs[k] = f.src; }
    }
    if (!want(t)) return;
    const url = await page.evaluate(() => document.querySelector('canvas#c').toDataURL('image/jpeg', 0.92));
    writeFileSync(join(FRAMES, frameName(t)), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    n++;
  });
  await page.waitForTimeout(250); // the music sequencer schedules on a 90 ms timer: let it reach the end of the run
  const audio = await page.evaluate(() => window.__renderAudio());
  await ctx.close();
  if (!audio) throw new Error('the game made no sound during the run (no AudioContext was created): the clips would be silent');
  const pcm = Buffer.from(audio.pcm, 'base64'), head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(audio.rate, 24); head.writeUInt32LE(audio.rate * 2, 28);
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  writeFileSync(join(WORK, 'synth.wav'), Buffer.concat([head, pcm]));
  // Sound comes in two parts, so a clip plays one music track throughout and lets the game's sound effects in only where
  // they help (Nadav, 2026-11-18: the music jumped at every cut, and engine, bumps, typing and pickups got in the way).
  // sfx.wav = the offline context (synth sounds, car sounds, file effects routed through Web Audio); its bass is cut
  // and everything above 1.2 kHz lifted, since it is mostly under 200 Hz and a phone speaker cannot play that (a clip of
  // synth alone sounded silent there). Music a game plays from files (music.files) is not in it: stems.json lists the
  // files, the loudness the game gave each, and how many seconds each was on. A game whose music is the synth
  // sequencer has no such files: its music is inside sfx.wav, so there the effects cannot be left out.
  const SYNTH_EQ = 'highpass=f=180,bass=g=-8:f=250,treble=g=9:f=1200';
  // float, not 16-bit: the treble lift pushes short hits past full scale, which 16 bits would clip (the encode's loudnorm
  // brings the level back down)
  ff(['-i', join(WORK, 'synth.wav'), '-af', SYNTH_EQ, '-ac', '1', '-ar', String(audio.rate), '-c:a', 'pcm_f32le', join(WORK, 'sfx.wav')], 'sfx stem');
  const tracks = {};
  modes.forEach((m, i) => {
    if (!(m.mode in heard)) return; // 'off', or a synth-sequencer mode
    if (!heard[m.mode]) throw new Error(`music track "${m.mode}" never played during the capture (the browser refused it, or the file is missing)`);
    const file = join(DIST, decodeURIComponent(new URL(srcs[m.mode], base).pathname));
    if (!existsSync(file)) throw new Error(`music file not found: ${file}`);
    const tr = tracks[m.mode] ||= { file, volume: heard[m.mode], seconds: 0 };
    tr.seconds += (modes[i + 1]?.t ?? timeline.duration) - m.t;
  });
  writeFileSync(join(WORK, 'stems.json'), JSON.stringify({ musicFromFiles: Object.keys(tracks).length > 0, tracks }, null, 2) + '\n');
  if (Object.keys(tracks).length) log(`music files heard: ${Object.entries(tracks).map(([k, v]) => `${k} ${v.seconds.toFixed(0)} s`).join(', ')}`);
  if (Math.abs(replay.end.t - timeline.end.t) > 1e-3) throw new Error(`the replay ended at ${replay.end.t} s, pass 1 at ${timeline.end.t} s: the run is not deterministic (a bot that reads the wall clock or Math.random?)`);
  writeFileSync(tlFile, JSON.stringify(timeline, null, 2));
  log(`pass 2: ${n} frames at ${size[0]}x${size[1]}, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
}
if (RUN) { // capture only: its shots are cut into a clip by a run of the main capture
  await browser.close(); server.close();
  log(`run "${RUN}" (route ${ROUTE}) captured → ${WORK}; use its shots as [from, to, { "run": "${RUN}" }]`);
  process.exit(0);
}

// ---------- captions: launch/videos/captions.json (the skill may rewrite it; defaults come from game.json) ----------
const capFile = join(OUT, 'captions.json');
const score = timeline.end.run?.score ?? 0;
const unit = cfg.score?.label || '';
const defaults = rtl ? {
  hook: 'ככה זה נגמר. כמה אתה תחזיק?',
  arc: cfg.title,
  challenge: `השיא: ${score} ${unit}. תשבור?`,
  endTitle: cfg.title, endLine: 'משחק קצר בדפדפן. בלי הרשמה.', endCta: 'לשחק עכשיו',
} : {
  hook: 'This is how it ends. How long can you last?',
  arc: cfg.title,
  challenge: `Record: ${score} ${unit}. Beat it?`,
  endTitle: cfg.title, endLine: 'Free browser game. No signup.', endCta: 'Play now',
};
let captions = defaults;
if (existsSync(capFile)) captions = { ...defaults, ...JSON.parse(readFileSync(capFile, 'utf8')) };
else { writeFileSync(capFile, JSON.stringify(defaults, null, 2) + '\n'); log('wrote default captions.json (edit it and rerun with --reuse)'); }
const host = (studio.publicBase || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const playUrl = `${host}/${cfg.slug}`;

// ---------- overlays: HTML → transparent PNG at 1080x1920 ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const logoFile = join(TEMPLATE, 'frontend', 'src', 'assets', 'logo.png');
const logo = existsSync(logoFile) ? `data:image/png;base64,${readFileSync(logoFile).toString('base64')}` : '';
const fonts = [...(cfg.fonts || []), 'Rubik'];
const fontFamily = fonts.map((f) => `'${f}'`).join(',');
const fontLink = `https://fonts.googleapis.com/css2?family=Rubik:wght@700;900${(cfg.fonts || []).map((f) => `&family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@700`).join('')}&display=swap`;
const bg = cfg.themeColor || '#140b24';
const shell = (body, opaque) => `<!doctype html><html lang="${cfg.lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<link rel="stylesheet" href="${fontLink}"><style>
html,body{margin:0;width:${VW}px;height:${VH}px;overflow:hidden;background:${opaque ? bg : 'transparent'}}
body{font-family:${fontFamily},system-ui,sans-serif;color:#fff;position:relative}
.cap{position:absolute;left:18px;right:18px;top:${CAP_START}px;text-align:center}
.cap span{display:inline;font-weight:900;font-size:27px;line-height:1.38;padding:3px 10px;background:#fff;color:#111;
  -webkit-box-decoration-break:clone;box-decoration-break:clone;border-radius:6px}
.card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:0 28px}
.card img{width:150px;height:auto}
.card h1{margin:0;font-size:${cfg.title.length > 14 ? 40 : 50}px;line-height:1.05;font-weight:900}
.card p{margin:0;font-size:19px;opacity:.85}
.cta{margin-top:8px;background:#fff;color:#111;font-weight:900;font-size:24px;padding:12px 26px;border-radius:999px}
.url{font-size:18px;opacity:.9;direction:ltr}
.glow{position:absolute;inset:-20%;background:radial-gradient(60% 50% at 50% 40%,rgba(255,255,255,.16),transparent 60%)}
</style></head><body>${body}</body></html>`;
const ovPage = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR })).newPage();
async function renderPng(html, file, opaque) {
  await ovPage.setContent(html, { waitUntil: 'load' });
  await ovPage.evaluate(() => document.fonts.ready);
  await ovPage.screenshot({ path: file, omitBackground: !opaque });
}
// A clip's caption is a string, or a sequence that follows the story (Nadav, 2026-11-18): [{ "text", "shot" }], each
// starting on that shot of the clip's "clips" list (0 = the first) and leaving when the next one comes in; "" = none.
const capSeq = {}, capRise = {};
for (const k of ['hook', 'arc', 'challenge']) {
  const spec = captions[k];
  const seq = Array.isArray(spec) ? spec : [{ text: spec, shot: 0 }];
  if (!seq.length || seq[0].shot !== 0) throw new Error(`captions.json ${k}: the first caption must start on shot 0`);
  seq.forEach((c, j) => {
    if (typeof c.text !== 'string') throw new Error(`captions.json ${k}[${j}]: no text ("" = no caption from this shot on)`);
    if (!Number.isInteger(c.shot) || c.shot >= clips[k].length || (j && c.shot <= seq[j - 1].shot)) throw new Error(`captions.json ${k}[${j}]: shot ${c.shot} must be a shot of clips.${k} (0..${clips[k].length - 1}) after the caption before it`);
  });
  const top = captions.captionTop?.[k] ?? CAP_START, end = captions.captionEndTop?.[k] ?? CAP_END;
  for (const [key, v] of [['captionTop', top], ['captionEndTop', end]]) if (!(v >= 0 && v <= VH - 60)) throw new Error(`captions.json ${key}.${k}: ${v} is outside 0..${VH - 60}`);
  capRise[k] = (top - end) * DPR; // px of the 1080x1920 frame the first caption travels up
  capSeq[k] = [];
  for (const [j, c] of seq.entries()) {
    const file = c.text ? join(WORK, `cap-${k}-${j}.png`) : null;
    // "top": this caption's own height (css px), and it stays there (Nadav: no move on the opening poster)
    if (c.top !== undefined && !(c.top >= 0 && c.top <= VH - 60)) throw new Error(`captions.json ${k}[${j}].top: ${c.top} is outside 0..${VH - 60}`);
    if (file) await renderPng(shell(`<div class="cap" style="top:${c.top ?? end}px"><span>${esc(c.text)}</span></div>`, false), file, false);
    capSeq[k].push({ ...c, file });
  }
}

// End card (Nadav, 2026-11-18): animated, and "Follow us" with every network the studio is on (studio.json) at the
// bottom, the studio's name over the game's title (Nadav). The icons are the site's own (frontend/src/components/icons.ts). Rendered frame by frame: the CSS
// animations are paused and set to each frame's time, so the card is the same on every run.
const iconSrc = readFileSync(join(TEMPLATE, 'frontend', 'src', 'components', 'icons.ts'), 'utf8');
const NETS = ['tiktok', 'instagram', 'youtube', 'x', 'facebook'].filter((n) => studio[n]);
const iconPath = (n) => { const m = iconSrc.match(new RegExp(`\\n\\s*${n}: wrap\\('([^']+)'`)); if (!m) throw new Error(`icons.ts has no icon "${n}"`); return m[1]; };
const followUs = rtl ? 'עקבו אחרינו' : 'Follow us';
const cardDir = join(WORK, 'card'); rmSync(cardDir, { recursive: true, force: true }); mkdirSync(cardDir, { recursive: true });
const pop = (name, at, dur = 0.45) => `animation:${name} ${dur}s cubic-bezier(.2,1.4,.4,1) ${at}s both`;
const KEYFRAMES = `@keyframes popIn{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes rise{from{transform:translateY(26px);opacity:0}to{transform:none;opacity:1}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glowB{0%,100%{opacity:.7}50%{opacity:1}}
@keyframes slowZoom{from{transform:scale(1.08)}to{transform:scale(1)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}`;
const netIcons = NETS.map((n, j) => `<i style="${pop('popIn', 1.1 + j * 0.09)}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="${iconPath(n)}"/></svg></i>`).join('');
const NET_CSS = `.follow{text-align:center}
.follow b{display:block;font-size:20px;font-weight:900;letter-spacing:.04em;margin-bottom:12px;${pop('rise', 0.95)}}
.nets{display:flex;justify-content:center;gap:14px}
.nets i{display:flex;width:46px;height:46px;border-radius:50%;background:#fff;color:#111;align-items:center;justify-content:center}
.nets svg{width:25px;height:25px}`;
// captions.json "endCard": { "painting": "<file in the game folder>", "logo": "<file>" } = the neon card (Nadav picked
// design B of three, 2026-11-18): the game's own title painting full-bleed (slowly settling) under the title screen's
// top scrim, its neon logo flickering on, the studio icon top left; a PLAY NOW button like the game's TAP TO START
// (yellow pill, dark edge, glow, shine, breathing, sparks rising off it); the link in a pink neon pill; FOLLOW US and
// the networks in teal neon on a dark band at the bottom. Built from the art files, not a frame of the run: the run's
// first frame has the title screen's effects on it (a glow over the car).
const card = captions.endCard;
if (card) {
  const file = (k) => { const f = join(GAME, card[k] || ''); if (!card[k] || !existsSync(f)) throw new Error(`captions.json endCard.${k}: ${card[k]} not found in Games/${gameId}`); return `data:image/${extname(f).slice(1)};base64,${readFileSync(f).toString('base64')}`; };
  const paint = file('painting'), neon = file('logo');
  await ovPage.setContent(shell(`<style>${KEYFRAMES}
@keyframes flicker{0%{opacity:0}8%{opacity:.9}12%{opacity:.2}20%{opacity:1}26%{opacity:.35}34%{opacity:1}100%{opacity:1}}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
@keyframes neonOn{0%{opacity:0;filter:brightness(.4)}40%{opacity:1;filter:brightness(1.6)}100%{opacity:1;filter:none}}
.bg{position:absolute;inset:0;background:url(${paint}) center/cover;animation:slowZoom 3s ease-out both}
.top{position:absolute;left:0;right:0;top:0;height:40%;background:linear-gradient(rgba(10,10,12,.94),rgba(10,10,12,.6) 55%,transparent)}
.bot{position:absolute;left:0;right:0;bottom:0;height:40%;background:linear-gradient(transparent,rgba(10,6,20,.9) 40%,rgba(10,6,20,.98));${pop('fadeIn', 0.2, 0.5)}}
.logo{position:absolute;left:50%;top:122px;width:316px;margin-left:-158px;margin-top:-100px;mix-blend-mode:screen;animation:flicker .7s linear .05s both}
.icon{position:absolute;left:10px;top:10px;width:56px;${pop('popIn', 0.3, 0.5)}}
.col{position:absolute;left:0;right:0;bottom:30px;display:flex;flex-direction:column;align-items:center;gap:15px}
.btn{position:relative;width:256px;height:50px;${pop('popIn', 0.45, 0.5)}}
.btn .in{position:absolute;inset:0;animation:breathe 1.396s ease-in-out .95s infinite}
.btn .edge{position:absolute;left:0;right:0;top:5px;bottom:-5px;border-radius:25px;background:#8a6a00}
.btn .face{position:absolute;inset:0;border-radius:25px;background:#ffcc00;box-shadow:0 0 18px rgba(255,204,0,.55);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:19px;letter-spacing:.02em;color:#0e0e10}
.btn .shine{position:absolute;left:6px;right:6px;top:4px;height:20px;border-radius:12px;background:rgba(255,255,255,.28)}
.btn span{position:relative}
.url{font-weight:700;font-size:16px;color:#fff;padding:7px 16px;border-radius:999px;border:2px solid #ff3fa4;box-shadow:0 0 12px #ff3fa4,inset 0 0 8px rgba(255,63,164,.6);text-shadow:0 0 6px #ff9fd0;direction:ltr;animation:neonOn .6s ease-out .7s both}
.fol{font-size:16px;font-weight:900;letter-spacing:.12em;color:#2fd1c8;text-shadow:0 0 8px #2fd1c8,0 0 16px rgba(47,209,200,.6);text-transform:uppercase;margin-bottom:-4px;animation:neonOn .6s ease-out .95s both}
.nets{display:flex;justify-content:center;gap:12px}
.nets i{display:flex;width:44px;height:44px;border-radius:50%;align-items:center;justify-content:center;border:2px solid #2fd1c8;box-shadow:0 0 10px rgba(47,209,200,.8),inset 0 0 6px rgba(47,209,200,.5);color:#e9fffd;background:rgba(10,6,20,.6)}
.nets svg{width:24px;height:24px}
.spark{position:absolute;border-radius:50%;background:#ffcc00}
</style><div class="bg"></div><div class="top"></div><div class="bot"></div><img class="logo" src="${neon}" alt="">${logo ? `<img class="icon" src="${logo}" alt="">` : ''}
<div class="col"><div class="btn"><div class="in"><div class="edge"></div><div class="face"><div class="shine"></div><span>${esc(captions.endCta.toUpperCase())}</span></div></div></div>
<div class="url">${esc(playUrl)}</div><div class="fol">${followUs}</div><div class="nets">${NETS.map((n, j) => `<i style="${pop('popIn', 1.1 + j * 0.09)}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="${iconPath(n)}"/></svg></i>`).join('')}</div></div><div id="sparks"></div>`, true), { waitUntil: 'load' });
} else {
await ovPage.setContent(shell(`<style>${KEYFRAMES}
.rays{position:absolute;left:50%;top:34%;width:1100px;height:1100px;margin:-550px 0 0 -550px;opacity:.13;
  background:repeating-conic-gradient(#fff 0 7deg,transparent 7deg 22deg);animation:spin 14s linear infinite;
  -webkit-mask:radial-gradient(circle,#000 0,transparent 60%);mask:radial-gradient(circle,#000 0,transparent 60%)}
.glow{animation:glowB 1.6s ease-in-out infinite}
.card{justify-content:flex-start;padding-top:96px}
.card img{${pop('popIn', 0, 0.55)}}
.card h1{${pop('rise', 0.25)}}
.card p{${pop('rise', 0.4)}}
.cta{${pop('popIn', 0.55)}}
.cta span{display:inline-block;animation:pulse .9s ease-in-out 1.1s infinite}
.url{${pop('rise', 0.7)}}
.studio{font-size:17px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin-bottom:-12px;${pop('rise', 0.15)}}
${NET_CSS}
.follow{margin-top:26px}
</style><div class="rays"></div><div class="glow"></div><div class="card">${logo ? `<img src="${logo}" alt="">` : ''}<div class="studio">${esc(studio.name)}</div><h1>${esc(captions.endTitle)}</h1>
${captions.endLine ? `<p>${esc(captions.endLine)}</p>` : ''}<div class="cta"><span>${esc(captions.endCta)}</span></div><div class="url">${esc(playUrl)}</div>
<div class="follow"><b>${followUs}</b><div class="nets">${netIcons}</div></div></div>`, true), { waitUntil: 'load' });
}
await ovPage.evaluate(() => document.fonts.ready);
for (let f = 0; f < Math.round(CARD_S * FPS); f++) {
  await ovPage.evaluate((ms) => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; }
    // the PLAY NOW button's sparks, as the game's title button (opening.ts buttonSparks): ~26 a second off the pill's
    // edge, 70% off the top, floating up and fading; each spark is seeded by its number, so every render is the same
    const host = document.getElementById('sparks'), btn = document.querySelector('.btn');
    if (!host || !btn) return;
    const t = ms / 1000, START = 0.7, b = btn.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    let html = '';
    for (let i = 0; START + i / 26 <= t; i++) {
      let q = (i * 2654435761) >>> 0; const r = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296);
      const born = START + i / 26, life = 0.7 + r() * 0.6, age = t - born;
      if (age > life) continue;
      const u = r(), top = r() < 0.7, vx = (r() - 0.5) * 30, vy = (top ? -1 : 0.4) * (30 + r() * 50), rad = 1.5 + r() * 2, k = 1 - age / life;
      const x = cx - 128 + u * 256 + vx * age, y = cy + (top ? -25 : 25) + vy * age - 20 * age * age, rr = rad * (0.6 + 0.4 * k);
      html += `<i class="spark" style="left:${(x - rr).toFixed(1)}px;top:${(y - rr).toFixed(1)}px;width:${(rr * 2).toFixed(1)}px;height:${(rr * 2).toFixed(1)}px;opacity:${k.toFixed(2)}"></i>`;
    }
    host.innerHTML = html;
  }, (f * 1000) / FPS);
  await ovPage.screenshot({ path: join(cardDir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
}

// ---------- encode ----------
const made = [];
const sfxWav = join(WORK, 'sfx.wav'), stemsFile = join(WORK, 'stems.json');
if (!existsSync(stemsFile)) { console.error('--reuse: the last capture has no sound stems (launch/.work/videos/stems.json): rerun without --reuse, with --seed ' + SEED); process.exit(1); }
const stems = JSON.parse(readFileSync(stemsFile, 'utf8'));
// captions.json "sfx": { <clip>: [[from, to, gain?], ...] } in game seconds = where the game's sound effects are heard
// (gain 0..1, default 1: e.g. a siren that should sit under the music); outside
// them the clip has music only. Leaving a clip out = no effects in it. Without file music the effects carry the
// music too, so they stay on everywhere.
const sfxWin = captions.sfx || {};
for (const [name, w] of Object.entries(sfxWin)) {
  if (!(name in clips)) throw new Error(`captions.json sfx: unknown clip "${name}"`);
  if (!Array.isArray(w) || w.some((g) => !Array.isArray(g) || g.length < 2 || g.length > 3 || !(g[0] < g[1]) || (g.length === 3 && !(g[2] > 0 && g[2] <= 1)))) throw new Error(`captions.json sfx.${name}: expected [[from, to, gain?], ...] with from < to and 0 < gain <= 1`);
}
if (!stems.musicFromFiles && Object.keys(sfxWin).length) log('note: this game plays its music through the synth, so the sound effects cannot be separated: captions.json "sfx" is ignored');
const RAMP = 0.06; // seconds an effects window takes to open and close (no click)
const SFX_GAIN = 4;       // the effects stem is quiet (the game mixes them low under its music): +12 dB before the windows
const DUCK_RAMP = 0.35;   // seconds a "musicDuck" takes to go down and back up
// captions.json "music": a track name, or { <clip>: name }: the one track a clip plays from its first frame through the
// end card. Default: the track the run played longest.
const musicFor = (name) => {
  if (!stems.musicFromFiles) return null;
  const pick = typeof captions.music === 'string' ? captions.music : captions.music?.[name];
  const k = pick ?? Object.entries(stems.tracks).sort((x, y) => y[1].seconds - x[1].seconds)[0][0];
  if (!stems.tracks[k]) throw new Error(`captions.json music: "${k}" was not heard in this run (heard: ${Object.keys(stems.tracks).join(', ')})`);
  return { name: k, ...stems.tracks[k] };
};
const onlyClip = opt('--clip');
if (onlyClip && !(onlyClip in clips)) { console.error(`--clip: unknown clip "${onlyClip}" (hook, arc, challenge)`); process.exit(2); }
for (const [name, segs] of Object.entries(clips)) {
  if (onlyClip && name !== onlyClip) continue; // one clip at a time, for review (the others keep their last version)
  const dir = join(WORK, `seq-${name}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  // captions.json "clipRun": { <clip>: "<run>" } = the --run capture a clip is cut from by default (Nice City's arc: the
  // sick-day route); its shots' game seconds, "sfx", "musicDuck" and "stings" then refer to that run, and its effects
  // come from that run's sfx.wav. A shot from yet another run: [from, to, { "run" }] (its effects stay silent).
  const base = captions.clipRun?.[name] ?? null, clipSfx = join(runDir(base), 'sfx.wav');
  if (base && !existsSync(clipSfx)) throw new Error(`captions.json clipRun.${name}: run "${base}" was not captured (--run ${base} --route <route> --full)`);
  const own = (o) => (o.run ?? base) === base && !o.image;
  let i = 0;
  for (const [a, b, o] of segs) {
    if (o.image) { // a still: one frame at the clip's size, repeated
      const img = join(OUT, o.image); if (!existsSync(img)) throw new Error(`clips.${name}: image ${o.image} not found in launch/videos (make it with --still)`);
      const still = join(dir, 'still.jpg'); ff(['-i', img, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, '-pix_fmt', 'yuvj420p', '-q:v', '2', still], 'still'); // the frames' own format: a change mid-sequence makes ffmpeg rebuild the filter graph (an encode hung on it)
      for (let f = Math.round(a * FPS); f < Math.round(b * FPS); f++) copyFileSync(still, join(dir, `${String(i++).padStart(5, '0')}.jpg`));
      rmSync(still); continue;
    }
    const frames = join(runDir(o.run ?? base), 'frames');
    let src;
    for (let f = Math.round(a * FPS); f < Math.round(b * FPS); f++) {
      src = join(frames, `${String(f).padStart(6, '0')}.jpg`);
      if (!existsSync(src)) throw new Error(`frame ${f} (${(f / FPS).toFixed(2)} s) of run "${o.run || 'main'}" was not captured`);
      copyFileSync(src, join(dir, `${String(i++).padStart(5, '0')}.jpg`));
    }
    for (let h = 0; h < Math.round((o.hold || 0) * FPS); h++) copyFileSync(src, join(dir, `${String(i++).padStart(5, '0')}.jpg`));
  }
  const out = join(OUT, `${name}.mp4`);
  // where each shot starts in the clip (its frames plus any held frame)
  const shotLen = ([a, b, o]) => (Math.round(b * FPS) - Math.round(a * FPS) + Math.round((o.hold || 0) * FPS)) / FPS;
  const shotAt = []; { let acc = 0; for (const g of segs) { shotAt.push(acc); acc += shotLen(g); } }
  // Sound. Effects: the same seconds of the run as the frames, short fades at each cut (a hard cut clicks); with file
  // music only inside the clip's "sfx" windows, silent in a held frame and in shots of another run. Music: one track
  // from its start, unbroken across the cuts and under the end card, levelled on its own (loudnorm on the steady track)
  // and fading out at the very end; "musicDuck" windows lower it on purpose. A compressor across the whole mix pulled
  // the music down under every effect, so it seemed to stop (Nadav, 2026-11-18): now nothing in the mix reacts to the
  // effects, and a limiter only catches peaks. "stings" are extra sound files laid on a moment (e.g. a joke sound).
  const total = i / FPS + CARD_S, music = musicFor(name);
  // a game-seconds window → its pieces in clip seconds (a window reaching a shot's end runs on through its hold)
  const toClip = (x, y) => {
    const out = [];
    segs.forEach(([a, b, o], k) => {
      if (!own(o)) return;
      const s0 = Math.round(a * FPS) / FPS, e0 = Math.round(b * FPS) / FPS;
      const lo = Math.max(x, s0), hi = Math.min(y, e0);
      if (hi <= lo && !(y >= e0 && x <= e0 && o.hold)) return;
      const from = shotAt[k] + Math.max(0, lo - s0), to = shotAt[k] + (Math.min(y, e0) - s0) + (y >= e0 ? (o.hold || 0) : 0);
      const last = out[out.length - 1];
      if (last && from - last[1] < 0.02) last[1] = to; else out.push([from, to]);
    });
    return out;
  };
  const cuts = segs.map(([a, b, o], k) => {
    const s = Math.round(a * FPS) / FPS, len = Math.round(b * FPS) / FPS - s, out = !music && k === segs.length - 1 ? 0.4 : 0.04;
    const hold = (o.hold || 0) ? `,apad=pad_dur=${o.hold}` : '';
    if (!own(o)) return `aevalsrc=0:c=mono:s=44100:d=${(len + (o.hold || 0)).toFixed(3)}[s${k}]`;
    const fades = `afade=t=in:d=0.03,afade=t=out:st=${(len - out).toFixed(3)}:d=${out}`;
    const trim = `[SFX:a]atrim=${s}:${s + len},asetpts=PTS-STARTPTS,aresample=44100`;
    if (!music) return `${trim},${fades}${hold}[s${k}]`;
    // the effects' gain inside this segment: g in each window, ramping over RAMP at its edges, 0 elsewhere
    const open = (sfxWin[name] || []).map(([x, y, g = 1]) => [x - s, y - s, g]).filter(([x, y]) => y > 0 && x < len);
    const gain = open.length ? open.map(([x, y, g]) => `${g}*max(0,min(1,min((t-(${x.toFixed(3)}))/${RAMP},(${y.toFixed(3)}-t)/${RAMP})))`).join('+') : '0';
    return `${trim},volume='${SFX_GAIN}*min(1,${gain})':eval=frame,${fades}${hold}[s${k}]`;
  });
  const fx = `${cuts.join(';')};${segs.map((_, k) => `[s${k}]`).join('')}[NULL:a]concat=n=${segs.length + 1}:v=0:a=1`;
  const ducks = (captions.musicDuck?.[name] || []).flatMap(([x, y, lv]) => {
    if (!(x < y && lv >= 0 && lv < 1)) throw new Error(`captions.json musicDuck.${name}: expected [[from, to, level 0..1)], ...]`);
    return toClip(x, y).map(([f, t]) => [f, t, lv]);
  });
  const duckExpr = ducks.length ? `volume='1-${ducks.map(([f, t, lv]) => `${(1 - lv).toFixed(3)}*max(0,min(1,min((t-${f.toFixed(3)})/${DUCK_RAMP},(${t.toFixed(3)}-t)/${DUCK_RAMP})))`).join('-')}':eval=frame,` : '';
  const stings = (captions.stings?.[name] || []).map(([at, file, g = 1]) => {
    const path = join(OUT, file);
    if (!existsSync(path)) throw new Error(`captions.json stings.${name}: ${file} not found in launch/videos`);
    const where = toClip(at, at + 0.001)[0];
    if (!where) throw new Error(`captions.json stings.${name}: ${at} s is not inside a shot of the main run`);
    return { path, at: where[0], g };
  });
  const iMusic0 = 'MUSIC', stingIn = stings.map((_, j) => `STING${j}`);
  let mixed;
  if (music) {
    const parts = [`${fx},alimiter=limit=0.7[fx]`,
      `[${iMusic0}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100,pan=mono|c0=0.5*c0+0.5*c1,loudnorm=I=-16:TP=-2:LRA=11,aresample=44100,${duckExpr}afade=t=in:d=0.15,afade=t=out:st=${(total - 1.2).toFixed(3)}:d=1.2[mu]`];
    stings.forEach((st, j) => parts.push(`[${stingIn[j]}:a]aresample=44100,pan=mono|c0=c0,volume=${st.g},adelay=${Math.round(st.at * 1000)},apad[st${j}]`));
    mixed = `${parts.join(';')};[mu][fx]${stings.map((_, j) => `[st${j}]`).join('')}amix=inputs=${2 + stings.length}:normalize=0:duration=first,alimiter=limit=0.89:level=false`;
  } else {
    if (ducks.length || stings.length) log('note: this game plays its music through the synth: "musicDuck" and "stings" need file music and are ignored');
    mixed = `${fx},acompressor=threshold=-28dB:ratio=6:attack=5:release=150:makeup=10,loudnorm=I=-14:TP=-1:LRA=7`;
  }
  // Captions. Each one comes in on its shot (rises CAP_SLIDE px while fading in over CAP_IN_S) and leaves the same way
  // up over CAP_OUT_S, ending as the next one starts; the last leaves as the end card comes. The first starts low and
  // slides up to the top after CAP_MOVE_AT (smoothstep over CAP_MOVE_S), as a single caption always did.
  const play = i / FPS;
  const seq = capSeq[name].map((c, j, all) => ({ ...c, a: shotAt[c.shot], b: j + 1 < all.length ? shotAt[all[j + 1].shot] : play })).filter((c) => c.file);
  const smooth = (x) => `(${x})*(${x})*(3-2*(${x}))`;
  const SL = CAP_SLIDE * DPR;
  let vchain = `[0:v]scale=${W}:${H}:flags=lanczos,setsar=1[v0]`;
  seq.forEach((c, j) => {
    const pin = `clip((t-${c.a.toFixed(3)})/${CAP_IN_S},0,1)`, pout = `clip((t-${(c.b - CAP_OUT_S).toFixed(3)})/${CAP_OUT_S},0,1)`;
    const rise = j === 0 && c.top === undefined ? `+${capRise[name]}*(1-${smooth(`clip((t-${(c.a + CAP_MOVE_AT).toFixed(3)})/${CAP_MOVE_S},0,1)`)})` : '';
    const y = `${SL}*(1-${smooth(pin)})-${SL}*(${pout})*(${pout})${rise}`;
    const inp = 1 + j;
    vchain += `;[${inp}:v]format=rgba,fade=t=in:st=${c.a.toFixed(3)}:d=${CAP_IN_S}:alpha=1,fade=t=out:st=${(c.b - CAP_OUT_S).toFixed(3)}:d=${CAP_OUT_S}:alpha=1[c${j}]` +
      `;[v${j}][c${j}]overlay=x=0:y='${y}':eval=frame:shortest=1:enable='between(t,${c.a.toFixed(3)},${c.b.toFixed(3)})'[v${j + 1}]`;
  });
  const n = seq.length, iCard = 1 + n, iSfx = 2 + n, iNull = 3 + n, iMusic = 4 + n;
  ff(['-framerate', String(FPS), '-i', join(dir, '%05d.jpg'),
    ...seq.flatMap((c) => ['-loop', '1', '-framerate', String(FPS), '-t', play.toFixed(3), '-i', c.file]),
    '-framerate', String(FPS), '-i', join(cardDir, '%05d.jpg'),
    '-i', clipSfx, '-f', 'lavfi', '-t', String(CARD_S), '-i', 'anullsrc=r=44100:cl=mono',
    ...(music ? ['-stream_loop', '-1', '-i', music.file] : []),
    ...(music ? stings.flatMap((st) => ['-i', st.path]) : []),
    '-filter_complex',
    `${vchain};[v${n}]format=yuv420p[a];` +
    `[${iCard}:v]scale=${W}:${H},setsar=1,format=yuv420p[c];[a][c]concat=n=2:v=1:a=0[v];` +
    `${stings.reduce((m, _, j) => m.replaceAll(`[STING${j}:a]`, `[${iMusic + 1 + j}:a]`), mixed.replaceAll('[SFX:a]', `[${iSfx}:a]`).replaceAll('[NULL:a]', `[${iNull}:a]`).replaceAll('[MUSIC:a]', `[${iMusic}:a]`))},aresample=44100[au]`,
    '-map', '[v]', '-map', '[au]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-movflags', '+faststart', out], name);
  made.push({ name, file: `${name}.mp4`, seconds: +(i / FPS + CARD_S).toFixed(1), caption: capSeq[name].map(({ text, shot }) => ({ text, shot })), music: musicFor(name)?.name ?? 'synth', sfx: stems.musicFromFiles ? (sfxWin[name] || []) : 'always', segments: segs.map(([a, b, o]) => [+a.toFixed(2), +b.toFixed(2), ...(Object.keys(o).length ? [o] : [])]) });
  log(`${name}.mp4  ${(i / FPS + CARD_S).toFixed(1)} s  ${(statSync(out).size / 1e6).toFixed(1)} MB`);
}

// email GIF: the first 6 s of the hook clip, small enough for an email body (target under 2 MB)
const gif = join(OUT, 'email.gif');
for (const [w, fps] of [[300, 12], [240, 10], [200, 8]]) {
  ff(['-t', '6', '-i', join(OUT, 'hook.mp4'), '-vf', `fps=${fps},scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=3`, gif], 'gif');
  if (statSync(gif).size < 2e6) break;
}
log(`email.gif  ${(statSync(gif).size / 1e6).toFixed(2)} MB`);

// cover: a frame from the middle of the arc clip under the end-card title, for the post thumbnail
const midSeg = clips.arc[Math.floor(clips.arc.length / 2)];
const coverFrame = join(FRAMES, frameName(Math.round(((midSeg[0] + midSeg[1]) / 2) * FPS) / FPS));
const coverOv = join(WORK, 'cover-ov.png');
await renderPng(shell(`<div style="position:absolute;inset:auto 0 0 0;height:58%;background:linear-gradient(transparent,rgba(0,0,0,.93) 30%)"></div>
<div class="card" style="justify-content:flex-end;padding-bottom:70px">${logo ? `<img src="${logo}" alt="" style="width:110px">` : ''}<h1>${esc(captions.endTitle)}</h1>${captions.endLine ? `<p>${esc(captions.endLine)}</p>` : ''}</div>`, false), coverOv, false);
ff(['-i', coverFrame, '-i', coverOv, '-filter_complex', `[0:v]scale=${W}:${H}:flags=lanczos[b];[b][1:v]overlay=0:0`, '-frames:v', '1', join(OUT, 'cover.png')], 'cover');
log('cover.png');

await browser.close(); server.close();
// --clip builds one clip: the others keep their entries from the last videos.json (it lists every clip there is)
const vFile = join(OUT, 'videos.json');
const kept = onlyClip && existsSync(vFile) ? JSON.parse(readFileSync(vFile, 'utf8')).clips.filter((c) => c.name !== onlyClip && existsSync(join(OUT, c.file))) : [];
const allClips = [...kept, ...made].sort((x, y) => ['hook', 'arc', 'challenge'].indexOf(x.name) - ['hook', 'arc', 'challenge'].indexOf(y.name));
writeFileSync(vFile, JSON.stringify({
  game: gameId, seed: SEED, madeAt: new Date().toISOString(), size: `${W}x${H}`, fps: FPS,
  run: { endsAt: timeline.end.t, endScene: timeline.end.scene, score }, clips: allClips, gif: 'email.gif', cover: 'cover.png', playUrl,
}, null, 2) + '\n');
log(`done → ${OUT}`);
