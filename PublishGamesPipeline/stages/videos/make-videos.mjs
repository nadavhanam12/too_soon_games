#!/usr/bin/env node
// Stage "videos" of /launch-game (playbook slide 16): three vertical 10-15 s clips of real gameplay, an email GIF and a
// cover image.
//   node make-videos.mjs <GameId> [--seed N] [--tries N] [--skip-build] [--reuse]
//     --seed    use exactly this seed (no tries)
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
const WORK = join(GAME, 'launch', '.work', 'videos');
const FRAMES = join(WORK, 'frames');
mkdirSync(OUT, { recursive: true });

const FPS = 30, TICK = 1 / FPS;
const VW = 360, VH = 640, DPR = 3;             // CSS viewport and scale: the canvas comes out 1080x1920
const W = VW * DPR, H = VH * DPR;
const MAX_RUN_S = Number(opt('--max-seconds', 600));
const END_HOLD_S = 1.2;                        // keep filming this long after the run ends (the lose/result screen)
const CARD_S = 2.5;                            // end card length
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

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); } // no installed Chrome: Playwright's bundled Chromium, as in the bug check

// ---------- the game's bot (Games/<GameId>/playthrough.mjs), or a seeded steering autopilot ----------
const ptFile = join(GAME, 'playthrough.mjs');
const pt = existsSync(ptFile) ? await import(pathToFileURL(ptFile).href) : {};
function makeRng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

async function openRun(page) {
  await page.goto(`${base}?seed=${SEED}`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__manual === 'function' && typeof window.__advance === 'function', null, { timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
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
        const bot = pt.bot?.[id];
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
const clips = plan();
// two frames of slack on each side: the encoder rounds segment edges to whole frames
const want = (t) => Object.values(clips).some((segs) => segs.some(([a, b]) => t >= a - 2 / FPS && t < b + 2 / FPS));
const frameName = (t) => `${String(Math.round(t * FPS)).padStart(6, '0')}.jpg`;

// ---------- pass 2: replay and grab the frames ----------
if (!flag('--reuse')) {
  rmSync(WORK, { recursive: true, force: true }); mkdirSync(FRAMES, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, hasTouch: false, locale: rtl ? 'he-IL' : 'en-US' });
  await blockApi(ctx); // never write the capture runs into production analytics
  // Sound: the game's synth (sfx + sequencer music) schedules on AudioContext.currentTime. Here the context is an
  // offline one whose clock is the game clock (__audioT, moved by playRun's step), so every sound lands on the frame
  // that caused it, and the whole run renders to one WAV after the replay. Only synth sound is captured: music that a
  // game plays from files (new Audio) is counted and reported below, not mixed in.
  await ctx.addInitScript((seconds) => {
    const RATE = 44100;
    window.__audioT = 0; window.__fileAudio = [];
    class GameClockContext extends OfflineAudioContext {
      constructor() { super(1, Math.ceil(seconds * RATE), RATE); window.__audioCtx = this; }
      get currentTime() { return window.__audioT; }
      get state() { return 'running'; }
      resume() { return Promise.resolve(); }
    }
    window.AudioContext = GameClockContext; window.webkitAudioContext = GameClockContext;
    const RealAudio = window.Audio;
    window.Audio = function (...a) { window.__fileAudio.push(String(a[0] || '')); return new RealAudio(...a); };
    window.__renderAudio = async () => {
      const c = window.__audioCtx; if (!c) return null;
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
  const modes = [], heard = {}; // file music: when each track was on (game time) and how loud the game played it
  const replay = await playRun(page, async (t, snap) => {
    if (snap.music) {
      if (!modes.length || modes[modes.length - 1].mode !== snap.music.mode) modes.push({ t, mode: snap.music.mode });
      for (const [k, f] of Object.entries(snap.music.files)) heard[k] = Math.max(heard[k] || 0, f.volume);
    }
    if (!want(t)) return;
    const url = await page.evaluate(() => document.querySelector('canvas#c').toDataURL('image/jpeg', 0.92));
    writeFileSync(join(FRAMES, frameName(t)), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    n++;
  });
  await page.waitForTimeout(250); // the music sequencer schedules on a 90 ms timer: let it reach the end of the run
  const audio = await page.evaluate(() => window.__renderAudio());
  const fileAudio = await page.evaluate(() => window.__fileAudio);
  await ctx.close();
  if (!audio) throw new Error('the game made no sound during the run (no AudioContext was created): the clips would be silent');
  const pcm = Buffer.from(audio.pcm, 'base64'), head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(audio.rate, 24); head.writeUInt32LE(audio.rate * 2, 28);
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  writeFileSync(join(WORK, 'synth.wav'), Buffer.concat([head, pcm]));
  // audio.wav = the run's whole sound. The synth part is mostly kick and bass under 200 Hz, which a phone speaker
  // cannot play (a clip of synth alone sounded silent there): its bass is cut and everything above 1.2 kHz lifted.
  // Music a game plays from files (music.files) is not in the offline context, so it is laid in here from the files
  // themselves: each track over the game seconds its mode was on, at the volume the game reached, with the game's
  // own fade speed (1.2 per second), every track starting from its beginning as the game does after a pause.
  const SYNTH_EQ = 'highpass=f=180,bass=g=-8:f=250,treble=g=9:f=1200';
  const keys = Object.keys(heard);
  if (keys.length !== fileAudio.length) throw new Error(`the game made ${fileAudio.length} audio elements but reports ${keys.length} music tracks: cannot tell which file is which track`);
  const ins = ['-i', join(WORK, 'synth.wav')], parts = [`[0:a]${SYNTH_EQ}[syn]`], mix = ['[syn]'];
  modes.forEach((m, i) => {
    const k = keys.indexOf(m.mode); if (k < 0) return; // 'off', or a synth-sequencer mode
    const vol = heard[m.mode];
    if (!vol) throw new Error(`music track "${m.mode}" never played during the capture (the browser refused it, or the file is missing): the clip would lack the game's music`);
    const file = join(DIST, decodeURIComponent(new URL(fileAudio[k], base).pathname));
    if (!existsSync(file)) throw new Error(`music file not found: ${file}`);
    const len = (modes[i + 1]?.t ?? timeline.duration) - m.t + vol / 1.2, fade = (vol / 1.2).toFixed(3);
    ins.push('-stream_loop', '-1', '-i', file);
    const n = mix.length;
    parts.push(`[${n}:a]atrim=0:${len.toFixed(3)},asetpts=PTS-STARTPTS,aresample=${audio.rate},pan=mono|c0=0.5*c0+0.5*c1,volume=${vol},afade=t=in:d=${fade},afade=t=out:st=${(len - vol / 1.2).toFixed(3)}:d=${fade},adelay=${Math.round(m.t * 1000)}[m${n}]`);
    mix.push(`[m${n}]`);
  });
  ff([...ins, '-filter_complex', `${parts.join(';')};${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first[out]`, '-map', '[out]', '-ac', '1', '-ar', String(audio.rate), join(WORK, 'audio.wav')], 'run audio');
  if (mix.length > 1) log(`music from files: ${modes.filter((m) => keys.includes(m.mode)).map((m) => `${m.mode} from ${m.t.toFixed(1)} s`).join(', ')}`);
  if (Math.abs(replay.end.t - timeline.end.t) > 1e-3) throw new Error(`the replay ended at ${replay.end.t} s, pass 1 at ${timeline.end.t} s: the run is not deterministic (a bot that reads the wall clock or Math.random?)`);
  writeFileSync(tlFile, JSON.stringify(timeline, null, 2));
  log(`pass 2: ${n} frames at ${size[0]}x${size[1]}, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
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
.cap{position:absolute;left:18px;right:18px;top:100px;text-align:center}
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
const capPng = {};
for (const k of ['hook', 'arc', 'challenge']) {
  capPng[k] = join(WORK, `cap-${k}.png`);
  await renderPng(shell(`<div class="cap"><span>${esc(captions[k])}</span></div>`, false), capPng[k], false);
}
const cardPng = join(WORK, 'endcard.png');
await renderPng(shell(`<div class="glow"></div><div class="card">${logo ? `<img src="${logo}" alt="">` : ''}<h1>${esc(captions.endTitle)}</h1>
<p>${esc(captions.endLine)}</p><div class="cta">${esc(captions.endCta)}</div><div class="url">${esc(playUrl)}</div></div>`, true), cardPng, true);

// ---------- encode ----------
const made = [];
const wav = join(WORK, 'audio.wav');
if (!existsSync(wav)) { console.error('--reuse: the last capture has no sound (launch/.work/videos/audio.wav): rerun without --reuse, with --seed ' + SEED); process.exit(1); }
for (const [name, segs] of Object.entries(clips)) {
  const dir = join(WORK, `seq-${name}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  let i = 0;
  for (const [a, b] of segs) {
    for (let f = Math.round(a * FPS); f < Math.round(b * FPS); f++) {
      const src = join(FRAMES, `${String(f).padStart(6, '0')}.jpg`);
      if (!existsSync(src)) throw new Error(`frame ${f} (${(f / FPS).toFixed(2)} s) was not captured`);
      copyFileSync(src, join(dir, `${String(i++).padStart(5, '0')}.jpg`));
    }
  }
  const out = join(OUT, `${name}.mp4`);
  // sound: the same seconds of the run as the frames, short fades at each cut (a hard cut clicks), a longer fade into
  // the end card, which is silent. A compressor brings the music up toward the loud one-shot effects, and loudnorm
  // sets the level the feeds expect (-14 LUFS). The run's sound itself (audio.wav) is built after the capture.
  const cuts = segs.map(([a, b], k) => {
    const s = Math.round(a * FPS) / FPS, len = Math.round(b * FPS) / FPS - s, out = k === segs.length - 1 ? 0.4 : 0.04;
    return `[3:a]atrim=${s}:${s + len},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=${(len - out).toFixed(3)}:d=${out}[s${k}]`;
  });
  ff(['-framerate', String(FPS), '-i', join(dir, '%05d.jpg'), '-i', capPng[name], '-loop', '1', '-framerate', String(FPS), '-t', String(CARD_S), '-i', cardPng,
    '-i', wav, '-f', 'lavfi', '-t', String(CARD_S), '-i', 'anullsrc=r=44100:cl=mono',
    '-filter_complex',
    `[0:v]scale=${W}:${H}:flags=lanczos,setsar=1[g];[g][1:v]overlay=0:0,format=yuv420p[a];` +
    `[2:v]scale=${W}:${H},setsar=1,format=yuv420p,fade=t=in:st=0:d=0.25[c];[a][c]concat=n=2:v=1:a=0[v];` +
    `${cuts.join(';')};${segs.map((_, k) => `[s${k}]`).join('')}[4:a]concat=n=${segs.length + 1}:v=0:a=1,acompressor=threshold=-28dB:ratio=6:attack=5:release=150:makeup=10,loudnorm=I=-14:TP=-1:LRA=7,aresample=44100[au]`,
    '-map', '[v]', '-map', '[au]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-movflags', '+faststart', out], name);
  made.push({ name, file: `${name}.mp4`, seconds: +(i / FPS + CARD_S).toFixed(1), caption: captions[name], segments: segs.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]) });
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
<div class="card" style="justify-content:flex-end;padding-bottom:70px">${logo ? `<img src="${logo}" alt="" style="width:110px">` : ''}<h1>${esc(captions.endTitle)}</h1><p>${esc(captions.endLine)}</p></div>`, false), coverOv, false);
ff(['-i', coverFrame, '-i', coverOv, '-filter_complex', `[0:v]scale=${W}:${H}:flags=lanczos[b];[b][1:v]overlay=0:0`, '-frames:v', '1', join(OUT, 'cover.png')], 'cover');
log('cover.png');

await browser.close(); server.close();
writeFileSync(join(OUT, 'videos.json'), JSON.stringify({
  game: gameId, seed: SEED, madeAt: new Date().toISOString(), size: `${W}x${H}`, fps: FPS,
  run: { endsAt: timeline.end.t, endScene: timeline.end.scene, score }, clips: made, gif: 'email.gif', cover: 'cover.png', playUrl,
}, null, 2) + '\n');
log(`done → ${OUT}`);
