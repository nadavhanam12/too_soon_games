#!/usr/bin/env node
// Make the share/cover images of a game from its real title screen (docs/CONTRACTS.md).
//   node make-assets.mjs <GameId> [--force]
// Writes Games/<GameId>/assets/og.png (1200x630, WhatsApp/iMessage/X card) and cover.png (1200x900, site card).
// Uses Playwright + the installed Chrome from ../bugcheck (no extra install). Existing files are kept unless --force.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '..', '..');
const REPO = resolve(TEMPLATE, '..');
const DIST = join(TEMPLATE, 'dist');
const CLIENT = join(TEMPLATE, 'common-game-code');
const { chromium } = createRequire(join(HERE, '..', 'bugcheck', 'package.json'))('playwright');

const args = process.argv.slice(2);
const gameId = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
if (!gameId) { console.error('usage: node make-assets.mjs <GameId> [--force]'); process.exit(2); }
const GAME = join(REPO, 'Games', gameId);
const cfg = JSON.parse(readFileSync(join(GAME, 'game.json'), 'utf8'));
const studio = JSON.parse(readFileSync(join(TEMPLATE, 'studio.json'), 'utf8'));
const slug = cfg.slug;
const OUT_DIR = join(GAME, 'assets');
const targets = [
  { name: cfg.ogImage?.replace(/^assets\//, '') || 'og.png', w: 1200, h: 630 },
  { name: cfg.cover?.replace(/^assets\//, '') || 'cover.png', w: 1200, h: 900 },
];
mkdirSync(OUT_DIR, { recursive: true });
const todo = targets.filter((t) => force || !existsSync(join(OUT_DIR, t.name)));
if (!todo.length) { console.log(`[assets] ${gameId}: og + cover already exist (use --force to redo)`); process.exit(0); }

// 1. build the game so the title screen is current
const b = spawnSync(process.execPath, [join(CLIENT, 'build.mjs'), 'build', gameId], { encoding: 'utf8' });
if (b.status !== 0) { console.error(b.stdout + b.stderr); process.exit(1); }

// 2. serve dist and capture the title screen at 2x
const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`${base}/${slug}/`, { waitUntil: 'load' });
await page.waitForTimeout(1800); // fonts + the title animation settle
await page.evaluate(() => { try { window.__advance?.(0.7); } catch { /* ignore */ } });
const shot = await page.locator('canvas#c').screenshot({ type: 'png' });
await page.close();

// 3. compose the cards
const logoPath = join(TEMPLATE, 'frontend', 'src', 'assets', 'logo.png');
const logo = existsSync(logoPath) ? `data:image/png;base64,${readFileSync(logoPath).toString('base64')}` : '';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rtl = cfg.lang === 'he';
const bg = cfg.themeColor || '#140b24';
const fontFamily = [...(cfg.fonts || []), 'Rubik'].map((f) => `'${f}'`).join(',');
const fontLink = `https://fonts.googleapis.com/css2?family=Rubik:wght@700;900${(cfg.fonts || []).map((f) => `&family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@700`).join('')}&display=swap`;
const langLabel = rtl ? 'משחק רשת קצר בעברית' : 'A short web game'; // no emoji flags: headless Chrome on Windows renders them as letters
const studioName = studio.name || 'Too Soon Games';
function html(w, h) {
  const tall = h > 700;
  const phoneH = Math.round(h * (tall ? 0.86 : 0.9)), phoneW = Math.round(phoneH * 360 / 640);
  const titleSize = cfg.title.length > 14 ? (tall ? 76 : 64) : (tall ? 96 : 80);
  return `<!doctype html><html lang="${cfg.lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<link rel="stylesheet" href="${fontLink}">
<style>
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
body{font-family:${fontFamily},system-ui,sans-serif;color:#fff;background:${bg};position:relative}
.glow{position:absolute;inset:-20%;background:radial-gradient(60% 70% at ${rtl ? '30%' : '70%'} 40%,rgba(255,255,255,.14),transparent 60%),linear-gradient(135deg,rgba(255,255,255,.06),rgba(0,0,0,.25))}
.wrap{position:absolute;inset:0;display:flex;align-items:center;gap:${tall ? 64 : 56}px;padding:0 ${tall ? 72 : 64}px;box-sizing:border-box}
.phone{flex:none;width:${phoneW}px;height:${phoneH}px;border-radius:${tall ? 36 : 30}px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 6px rgba(255,255,255,.12);transform:rotate(${rtl ? 3 : -3}deg)}
.phone img{width:100%;height:100%;display:block}
.text{flex:1;min-width:0}
.eyebrow{font-size:${tall ? 28 : 24}px;font-weight:700;opacity:.8;letter-spacing:.02em;margin:0 0 ${tall ? 22 : 14}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
h1{font-size:${titleSize}px;line-height:1.02;margin:0 0 ${tall ? 26 : 18}px;font-weight:900;text-shadow:0 4px 0 rgba(0,0,0,.35)}
p.tag{font-size:${tall ? 36 : 30}px;line-height:1.3;margin:0 0 ${tall ? 44 : 30}px;opacity:.92;font-weight:700;display:-webkit-box;-webkit-line-clamp:${tall ? 4 : 3};-webkit-box-orient:vertical;overflow:hidden}
.studio{display:flex;align-items:center;gap:18px;font-size:${tall ? 30 : 26}px;font-weight:900;opacity:.95;white-space:nowrap}
.studio img{height:${tall ? 72 : 60}px;width:auto}
.play{display:inline-block;background:#ffc400;color:#1a1200;border-radius:999px;padding:${tall ? '18px 44px' : '14px 36px'};font-size:${tall ? 34 : 28}px;font-weight:900;margin-${rtl ? 'right' : 'left'}:auto}
</style></head><body><div class="glow"></div><div class="wrap">
<div class="phone"><img src="data:image/png;base64,${shot.toString('base64')}" alt=""></div>
<div class="text">
<p class="eyebrow">${esc(langLabel)}</p>
<h1>${esc(cfg.title)}</h1>
<p class="tag">${esc(cfg.tagline)}</p>
<div class="studio">${logo ? `<img src="${logo}" alt="">` : ''}<span>${esc(studioName)}</span><span class="play">${rtl ? 'שחקו ▶' : 'Play ▶'}</span></div>
</div></div></body></html>`;
}
for (const t of todo) {
  const p = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
  await p.setContent(html(t.w, t.h), { waitUntil: 'load' });
  try { await p.evaluate(() => document.fonts.ready); } catch { /* offline: system font */ }
  await p.waitForTimeout(300);
  const png = await p.screenshot({ type: 'png', fullPage: false });
  writeFileSync(join(OUT_DIR, t.name), png);
  console.log(`[assets] ${gameId}: assets/${t.name} ${t.w}x${t.h} (${(png.length / 1024).toFixed(0)} KB)`);
  await p.close();
}
await browser.close();
server.close();
