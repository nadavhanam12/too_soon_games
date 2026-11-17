// WastedForSix: the home-page clip (assets/clip.webm), recorded by hand for this game instead of the template's
// generic make-clip.mjs (which records the first 5 s of play: the commute's mission card). Six seconds of one drive
// in which the picture steps up the way it does over a run: look 2 (from above) → look 3 (behind the car) → look 4
// (sunset). Not part of the build. The publish script keeps an existing clip.webm, so run this before /publish-game
// when the looks change:
//   1. start the dev server (launch config wastedforsix-dev-5177, or `node build.mjs dev WastedForSix` with PORT=5177)
//   2. node Games/WastedForSix/make-clip.mjs [http://127.0.0.1:5177/nice-city/]
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(HERE, '../../GamesTemplate/other-services/bugcheck/package.json'));
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://127.0.0.1:5177/nice-city/';
const LOOK_S = [1.6, 2.2, 2.4];          // seconds in look 2, 3 and 4
// 16:10, the shape of the home page's media frame (site.css `.media .frame`) on desktop and on phones alike, so the
// clip fills it. The game is recorded the way a desktop player sees it (wide screen, RULES 8א). The template's
// portrait 270x480 clip sat in that frame as a narrow strip (Nadav, 2026-11-17).
const VW = 1024, VH = 640;                // the page while recording
const W = 560, H = 350;                   // the clip
const tmp = join(HERE, '.clip-tmp'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, recordVideo: { dir: tmp, size: { width: W, height: H } } });
const page = await ctx.newPage();
const t0 = Date.now();                    // the recording starts with the page
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__state === 'function' && window.__state().st > 0, null, { timeout: 20000 });
await page.evaluate(() => { window.__go('play'); window.__stage('launch', 'quit'); });   // the quit branch: no HR minivan to end the take
await page.waitForFunction(() => !!window.__w6world3d, null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.keyboard.press('Space'); await page.waitForTimeout(500);
if (await page.evaluate(() => window.__state().banner)) { await page.mouse.click(VW / 2, VH * 0.75); await page.waitForTimeout(500); }
await page.evaluate(() => window.__look(2));
await page.waitForTimeout(1500);          // the leg's opening swoop ends
// drive along the route with the keys, the way the bug-check bot does, and step the look up on the clock
const from = (Date.now() - t0) / 1000;
await page.evaluate(async (looks) => {
  const key = (k, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { key: k, code: k, bubbles: true }));
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const start = performance.now(), total = looks.reduce((a, b) => a + b, 0);
  let l = false, r = false, look = 2;
  key('ArrowUp', true);
  for (;;) {
    const t = (performance.now() - start) / 1000;
    if (t > total) break;
    const want = t < looks[0] ? 2 : t < looks[0] + looks[1] ? 3 : 4;
    if (want !== look) { look = want; window.__look(look); }
    const q = window.__peek();
    if (q.gps) {
      const d = wrap(Math.atan2(q.gps.y - q.car.y, q.gps.x - q.car.x) - q.car.a), wl = d < -0.12, wr = d > 0.12;
      if (wl !== l) { key('ArrowLeft', wl); l = wl; }
      if (wr !== r) { key('ArrowRight', wr); r = wr; }
    }
    await new Promise((z) => setTimeout(z, 30));
  }
  for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowRight']) key(k, false);
}, LOOK_S);
const secs = LOOK_S.reduce((a, b) => a + b, 0);
await ctx.close(); await browser.close();

// cut the take out of the recording and shrink it with Playwright's bundled ffmpeg (VP9, no audio, 20 fps)
const raw = join(tmp, readdirSync(tmp).find((f) => f.endsWith('.webm')));
const out = join(HERE, 'assets', 'clip.webm');
const msPw = process.env.PLAYWRIGHT_BROWSERS_PATH || join(process.env.LOCALAPPDATA || join(homedir(), '.cache'), 'ms-playwright');
const ff = existsSync(msPw) ? readdirSync(msPw).filter((d) => d.startsWith('ffmpeg-')).sort().map((d) => join(msPw, d, process.platform === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg-linux')).filter(existsSync).pop() : '';
if (!ff) { console.error('Playwright\'s ffmpeg was not found: the take cannot be cut out of the recording'); process.exit(1); }
const r = spawnSync(ff, ['-y', '-loglevel', 'error', '-ss', from.toFixed(2), '-i', raw, '-t', secs.toFixed(2), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-deadline', 'good', '-cpu-used', '2', '-an', '-r', '20', join(tmp, 'cut.webm')], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr || 'ffmpeg failed'); process.exit(1); }
copyFileSync(join(tmp, 'cut.webm'), out);
rmSync(tmp, { recursive: true, force: true });
console.log(`clip → ${out} (${(statSync(out).size / 1024).toFixed(0)} KB, ${secs.toFixed(1)} s, cut from ${from.toFixed(1)} s)`);
