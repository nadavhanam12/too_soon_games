// Records a short silent gameplay loop of a built game for the home page lead story.
//   node make-clip.mjs <GameId> [--seconds 5]   → Games/<GameId>/assets/clip.webm
// Builds the game into .local-dist/<slug>/ itself (never dist/, which is the publish folder) and records it.
// Needs Playwright from other-services/bugcheck. The publish build copies Games/<GameId>/assets into dist.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, '../bugcheck/package.json'));
const { chromium } = require('playwright');
const gameId = process.argv[2];
const GAME_DIR = resolve(HERE, '../../../Games', gameId || '_');
const slug = gameId && existsSync(join(GAME_DIR, 'game.json')) ? JSON.parse(readFileSync(join(GAME_DIR, 'game.json'), 'utf8')).slug : '';
const sIdx = process.argv.indexOf('--seconds');
const seconds = sIdx > 0 ? Number(process.argv[sIdx + 1]) : 5;
if (!slug) { console.error('usage: make-clip.mjs <GameId> [--seconds N]  (Games/<GameId>/game.json must exist)'); process.exit(2); }
const DIST = resolve(HERE, '../../.local-dist');
const b = spawnSync(process.execPath, [resolve(HERE, '../../common-game-code/build.mjs'), 'build', gameId, '--local'], { encoding: 'utf8' });
if (b.status !== 0 || !existsSync(join(DIST, slug, 'index.html'))) { console.error(b.stdout + b.stderr); console.error(`local build of ${gameId} failed`); process.exit(1); }

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const srv = createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = join(DIST, p);
  if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.once('listening', r));
const port = srv.address().port;

const W = 270, H = 480; // small on purpose: the clip is shown at ~375 CSS px but is a loop, not a trailer
const tmp = join(HERE, '.clip-tmp'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
let browser; try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, recordVideo: { dir: tmp, size: { width: W, height: H } } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/${slug}/`, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.evaluate(() => window.__go && window.__go('play'));
const t0 = Date.now();
let x = 180;
while (Date.now() - t0 < seconds * 1000) { // wiggle around so the run looks alive
  x = Math.max(40, Math.min(320, x + (Math.random() - 0.5) * 160));
  await page.mouse.move(x, 420, { steps: 6 }).catch(() => {});
  await page.keyboard.press(Math.random() < 0.3 ? 'Space' : (Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight')).catch(() => {});
  await page.waitForTimeout(220);
}
await ctx.close(); await browser.close(); srv.close();
const vid = readdirSync(tmp).find((f) => f.endsWith('.webm'));
const out = join(GAME_DIR, 'assets', 'clip.webm');
mkdirSync(dirname(out), { recursive: true });
// Playwright's raw recording is ~600KB; its bundled ffmpeg can re-encode it to ~200KB (VP9, no audio, 20fps).
const msPw = process.env.PLAYWRIGHT_BROWSERS_PATH || join(process.env.LOCALAPPDATA || join(homedir(), '.cache'), 'ms-playwright');
const ff = existsSync(msPw) ? readdirSync(msPw).filter((d) => d.startsWith('ffmpeg-')).sort().map((d) => join(msPw, d, process.platform === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg-linux')).filter(existsSync).pop() : '';
const raw = join(tmp, vid);
const r = ff ? spawnSync(ff, ['-y', '-loglevel', 'error', '-i', raw, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '42', '-deadline', 'good', '-cpu-used', '2', '-an', '-r', '20', out]) : { status: 1 };
if (r.status !== 0) { console.log('(ffmpeg shrink unavailable, keeping the raw recording)'); copyFileSync(raw, out); }
rmSync(tmp, { recursive: true, force: true });
console.log(`clip → ${out} (${(statSync(out).size / 1024).toFixed(0)} KB, ${seconds}s)`);
