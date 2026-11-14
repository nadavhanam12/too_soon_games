#!/usr/bin/env node
// Bug check for one game (docs/ARCHITECTURE.md "כלי בדיקת הבאגים", docs/CONTRACTS.md).
//   node run.mjs <GameId> [--server] [--quick]
// Sections: static → build → scenes (desktop) → mobile (3 phones, touch) → perf → server.
// Writes out/report.md + out/<viewport>/<scene>.png. Exit 1 on any RED.
import { chromium, devices } from 'playwright';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '..', '..');
const REPO = resolve(TEMPLATE, '..');
const CLIENT = join(TEMPLATE, 'common-game-code');
const DIST = join(TEMPLATE, 'dist');
const OUT = join(HERE, 'out');
const API = process.env.API_BASE || 'http://127.0.0.1:8787';

const args = process.argv.slice(2);
const gameId = args.find((a) => !a.startsWith('--'));
const withServer = args.includes('--server');
const quick = args.includes('--quick');
if (!gameId) { console.error('usage: node run.mjs <GameId> [--server] [--quick]'); process.exit(2); }
const GAME = join(REPO, 'Games', gameId);
if (!existsSync(join(GAME, 'game.json'))) { console.error(`no Games/${gameId}/game.json`); process.exit(2); }
const cfg = JSON.parse(readFileSync(join(GAME, 'game.json'), 'utf8'));
const slug = cfg.slug;

const results = []; // {section, name, status: 'green'|'yellow'|'red', note}
const add = (section, name, status, note = '') => { results.push({ section, name, status, note }); console.log(`  ${status === 'green' ? 'ok  ' : status === 'yellow' ? 'WARN' : 'RED '} [${section}] ${name}${note ? ' — ' + note : ''}`); };
const ok = (s, n, cond, note = '', warnOnly = false) => add(s, n, cond ? 'green' : warnOnly ? 'yellow' : 'red', cond ? '' : note);

rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
console.log(`bugcheck ${gameId} (${slug})`);

// ---------- 1. static ----------
{
  const S = 'static';
  const need = ['id', 'slug', 'title', 'tagline', 'audience', 'lang', 'version', 'event', 'score', 'share', 'screens', 'showPlayerCountFrom'];
  const missing = need.filter((k) => cfg[k] === undefined || cfg[k] === '');
  ok(S, 'game.json required fields', missing.length === 0, 'missing: ' + missing.join(', '));
  ok(S, 'game.json id matches folder', cfg.id === gameId, `id=${cfg.id}`);
  ok(S, 'slug is kebab-case', /^[a-z0-9][a-z0-9-]{1,39}$/.test(slug || ''));
  ok(S, 'event.sourceUrl + event.date (rule 3)', !!(cfg.event?.sourceUrl && /^\d{4}-\d{2}-\d{2}$/.test(cfg.event?.date || '')));
  ok(S, 'share.text has {url} and ≤200 chars (rule 16)', typeof cfg.share?.text === 'string' && cfg.share.text.includes('{url}') && cfg.share.text.replace('{url}', '').length <= 200);
  ok(S, 'score.max > 0', (cfg.score?.max ?? 0) > 0);
  // forbidden direct APIs in the game's own code (rule 12)
  const srcFiles = walk(join(GAME, 'src')).filter((f) => f.endsWith('.ts'));
  const bad = [];
  for (const f of srcFiles) { const t = readFileSync(f, 'utf8'); for (const re of [/\blocalStorage\b/, /\bfetch\(/, /navigator\.share\b/, /\bsessionStorage\b/]) if (re.test(t)) bad.push(`${f.replace(REPO, '')}: ${re.source}`); }
  ok(S, 'no direct localStorage/fetch/navigator.share in game code (rule 12)', bad.length === 0, bad.join('; '));
  const tc = spawnSync(process.execPath, [join(CLIENT, 'build.mjs'), 'check', gameId], { encoding: 'utf8' });
  ok(S, 'typecheck (tsc)', tc.status === 0, (tc.stdout + tc.stderr).trim().split('\n').slice(-8).join(' | '));
}

// ---------- 2. build ----------
let html = '';
{
  const S = 'build';
  const b = spawnSync(process.execPath, [join(CLIENT, 'build.mjs'), 'build', gameId], { encoding: 'utf8' });
  const htmlPath = join(DIST, slug, 'index.html');
  ok(S, 'build succeeds', b.status === 0 && existsSync(htmlPath), (b.stdout + b.stderr).trim().split('\n').slice(-5).join(' | '));
  if (existsSync(htmlPath)) {
    html = readFileSync(htmlPath, 'utf8');
    const kb = Buffer.byteLength(html) / 1024;
    ok(S, `index.html ≤ 300 KB (rule 13א)`, kb <= 300, `${kb.toFixed(1)} KB`);
    ok(S, 'charset utf-8 + viewport meta', /<meta charset="utf-8">/i.test(html) && /name="viewport"/.test(html));
    ok(S, 'og:title / og:description / og:image present', /og:title/.test(html) && /og:description/.test(html) && /og:image/.test(html));
    ok(S, 'no root-absolute asset paths', !/(src|href)="\/(?!\/)/.test(html.replace(/<link rel="canonical"[^>]*>/, '').replace(/og:url[^>]*/, '').replace(/href="\/"/g, '')), 'found src/href="/..."', true);
    const assets = join(GAME, 'assets');
    const audioBytes = existsSync(assets) ? walk(assets).filter((f) => /\.(mp3|ogg|wav|m4a)$/i.test(f)).reduce((a, f) => a + statSync(f).size, 0) : 0;
    ok(S, 'audio files ≤ 1.5 MB (rule 13א)', audioBytes <= 1.5 * 1024 * 1024, `${(audioBytes / 1024 / 1024).toFixed(2)} MB`);
  }
}

// ---------- static server for dist ----------
const port = 5199;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const base = `http://127.0.0.1:${port}/${slug}/`;

// ---------- 3+4. scenes on desktop and phones ----------
let browser = null;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { try { browser = await chromium.launch(); } catch (e) { add('scenes', 'launch browser', 'red', String(e.message).split('\n')[0]); } }

const viewports = quick
  ? [{ name: 'phone-393x852', ...devices['Pixel 7'], hasTouch: true }]
  : [
      { name: 'desktop-1280x800', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
      { name: 'phone-375x667', ...devices['iPhone SE'], hasTouch: true },
      { name: 'phone-393x852', ...devices['Pixel 7'], hasTouch: true },
      { name: 'phone-412x915', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent },
    ];

if (browser) {
  for (const vp of viewports) {
    const S = vp.name.startsWith('desktop') ? 'scenes' : 'mobile';
    const { name, ...ctxOpts } = vp;
    const context = await browser.newContext({ ...ctxOpts, locale: cfg.lang === 'he' ? 'he-IL' : 'en-US' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('requestfailed', (r) => { if (!r.url().includes(API)) errors.push('request failed: ' + r.url()); });
    const dir = join(OUT, name); mkdirSync(dir, { recursive: true });
    try {
      await page.goto(base + '?c=42&n=Test&u=abcd1234', { waitUntil: 'load', timeout: 15000 });
      await page.waitForFunction(() => typeof window.__scenes === 'function', null, { timeout: 8000 });
      const sceneList = await page.evaluate(() => window.__scenes());
      ok(S, `${name}: game boots, ${sceneList.length} scenes`, sceneList.length >= 5, sceneList.join(','));
      const noScroll = await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1 && document.scrollingElement.scrollHeight <= innerHeight + 1);
      ok(S, `${name}: no page scroll`, noScroll);
      const fitInfo = await page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), H: window.__state().H, vw: innerWidth, vh: innerHeight }; });
      ok(S, `${name}: canvas fills height (H=${fitInfo.H}, ${fitInfo.w}x${fitInfo.h} in ${fitInfo.vw}x${fitInfo.vh})`, fitInfo.h >= fitInfo.vh - 2 || fitInfo.w >= fitInfo.vw - 2);
      // challenge banner on title
      await page.waitForTimeout(400);
      const challenge = await page.evaluate(() => { const s = window.__state(); return s.scene === 'title'; });
      ok(S, `${name}: starts on title with challenge params`, challenge);
      for (const sc of sceneList) {
        await page.evaluate((s) => window.__go(s), sc);
        await page.evaluate((s) => window.__advance(s === 'play' ? 1.2 : 2), sc); // play: 1.2 s is before an unsteered fall ends
        await page.waitForTimeout(150);
        if (sc === 'play') { await page.keyboard.press('Space'); await page.evaluate(() => window.__advance(0.3)); }
        await page.screenshot({ path: join(dir, `${sc}.png`) });
        // overlays must sit inside the viewport and be tappable (≥ 40 css px tall)
        const ov = await page.evaluate(() => [...document.querySelectorAll('.tsg-ov > *:not([hidden])')].flatMap((box) => {
          const els = box.matches('a,button,input') ? [box] : [...box.querySelectorAll('a,button,input')];
          return els.filter((e) => !e.hidden && getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return { tag: e.className, x: r.left, y: r.top, w: r.width, h: r.height, inside: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }; });
        }));
        const outside = ov.filter((o) => !o.inside), scale = await page.evaluate(() => window.__state().scale || 1), small = ov.filter((o) => o.h / scale < 43 && !/tsg-link/.test(o.tag));
        if (ov.length) {
          ok(S, `${name}/${sc}: ${ov.length} overlay controls inside the viewport`, outside.length === 0, outside.map((o) => `${o.tag}@${Math.round(o.x)},${Math.round(o.y)}`).join(' '));
          ok(S, `${name}/${sc}: overlay controls ≥ 44 logical units tall (rule 13)`, small.length === 0, small.map((o) => `${o.tag}:${Math.round(o.h / scale)}u`).join(' '));
        }
      }
      // keyboard: Space must not scroll (desktop)
      if (S === 'scenes') {
        await page.evaluate(() => window.__go('title'));
        await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown');
        const scrolled = await page.evaluate(() => scrollY);
        ok(S, `${name}: Space/arrows do not scroll the page`, scrolled === 0);
      }
      // perf: cold reload with a slow-4G throttle, time to the first scene frame
      if (!quick && name === 'phone-393x852') {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
        await cdp.send('Network.clearBrowserCache');
        const t0 = Date.now();
        await page.goto(base, { waitUntil: 'commit', timeout: 20000 });
        await page.waitForFunction(() => typeof window.__state === 'function' && window.__state().st > 0, null, { timeout: 20000 });
        const ms = Date.now() - t0;
        add('perf', `first frame on slow 4G: ${ms} ms (budget 1500, red over 2500)`, ms <= 1500 ? 'green' : ms <= 2500 ? 'yellow' : 'red');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      }
    } catch (e) {
      add(S, `${name}: run`, 'red', String(e.message).split('\n')[0]);
    }
    const resourceErrors = errors.filter((e) => /Failed to load resource/.test(e));
    const realErrors = errors.filter((e) => !/favicon|ERR_ABORTED|net::ERR_CONNECTION_REFUSED|Failed to load resource/.test(e));
    ok(S, `${name}: no JS errors`, realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
    if (resourceErrors.length) add(S, `${name}: ${resourceErrors.length} resources failed to load (fonts/CDN offline?)`, 'yellow', resourceErrors[0]);
    await context.close();
  }
  await browser.close();
}

// ---------- 5. server ----------
if (withServer) {
  const S = 'server';
  let up = false;
  try { const r = await fetch(API + '/v1/version', { signal: AbortSignal.timeout(3000) }); up = r.ok; } catch { /* down */ }
  ok(S, `API reachable at ${API}`, up, 'start it with: cd GamesTemplate/server-and-data/worker && npm run dev');
  if (up) {
    const sm = spawnSync(process.execPath, [join(TEMPLATE, 'server-and-data', 'worker', 'test', 'smoke.mjs'), API], { encoding: 'utf8', env: { ...process.env } });
    ok(S, 'smoke test passes', sm.status === 0, (sm.stdout.match(/FAIL.*/g) || []).slice(0, 5).join(' | '));
    try {
      const r = await fetch(`${API}/v1/games/${slug}/count`);
      // not registered yet is yellow: publish-game registers the game right after this check
      if (r.ok) ok(S, `game "${slug}" registered in the API`, true); else add(S, `game "${slug}" registered in the API`, 'yellow', `GET /count → ${r.status}. publish-game registers it (PUT /v1/admin/games/${slug})`);
    } catch (e) { add(S, 'count endpoint', 'red', String(e.message)); }
  }
}

server.close();

// ---------- report ----------
const reds = results.filter((r) => r.status === 'red'), yellows = results.filter((r) => r.status === 'yellow');
const lines = [`# bugcheck ${gameId} (${slug}) — ${new Date().toISOString()}`, '', `**${reds.length ? 'RED' : yellows.length ? 'YELLOW' : 'GREEN'}**: ${reds.length} red, ${yellows.length} yellow, ${results.length - reds.length - yellows.length} green`, ''];
for (const sec of [...new Set(results.map((r) => r.section))]) {
  lines.push(`## ${sec}`);
  for (const r of results.filter((x) => x.section === sec)) lines.push(`- ${r.status === 'green' ? '🟢' : r.status === 'yellow' ? '🟡' : '🔴'} ${r.name}${r.note ? ` — ${r.note}` : ''}`);
  lines.push('');
}
lines.push('Screenshots: `out/<viewport>/<scene>.png`');
writeFileSync(join(OUT, 'report.md'), lines.join('\n'));
console.log(`\n${reds.length ? 'RED' : 'GREEN'} — ${reds.length} red, ${yellows.length} yellow. Report: ${join(OUT, 'report.md')}`);
process.exit(reds.length ? 1 : 0);

function walk(dir) { if (!existsSync(dir)) return []; return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
