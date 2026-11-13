#!/usr/bin/env node
// Build / dev / check for one game (docs/CONTRACTS.md).
//   node build.mjs build <GameId>   → ../dist/<slug>/index.html (+ assets/)
//   node build.mjs dev   <GameId>   → watch + serve http://127.0.0.1:5173/<slug>/
//   node build.mjs check <GameId>   → tsc over the template + the game
import { build as esbuild, context } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '..');            // GamesTemplate/
const REPO = resolve(TEMPLATE, '..');
const DIST = join(TEMPLATE, 'dist');
const MAX_HTML_BYTES = 300 * 1024;                // rule 13א

const [, , cmd = 'build', gameId] = process.argv;
if (!gameId || !/^[A-Z][A-Za-z0-9]+$/.test(gameId)) die(`usage: node build.mjs <build|dev|check> <GameId>   (GameId = folder in Games/, PascalCase)`);
const GAME_DIR = join(REPO, 'Games', gameId);
if (!existsSync(GAME_DIR)) die(`no such game folder: ${GAME_DIR}`);
const cfgPath = join(GAME_DIR, 'game.json');
if (!existsSync(cfgPath)) die(`missing ${cfgPath}`);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const studio = readJson(join(TEMPLATE, 'studio.json'), {});
const entry = join(GAME_DIR, 'src', 'main.ts');
if (!existsSync(entry)) die(`missing ${entry}`);
const slug = cfg.slug;
const OUT = join(DIST, slug);

function die(msg) { console.error('[build] ' + msg); process.exit(1); }
function readJson(p, fallback) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } }
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const env = (dev) => ({
  apiBase: dev ? (process.env.API_BASE ?? 'http://127.0.0.1:8787') : (studio.apiBase || ''),
  publicBase: dev ? '' : (studio.publicBase || ''),
  buildTime: new Date().toISOString(),
  dev,
  studio: { instagram: studio.instagram || '', tiktok: studio.tiktok || '', x: studio.x || '', facebook: studio.facebook || '', youtube: studio.youtube || '', email: studio.email || '' },
});

function esbuildOptions(dev) {
  return {
    entryPoints: [entry],
    bundle: true,
    write: false,
    outfile: join(HERE, '.out', 'bundle.js'),
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    target: ['es2020', 'safari14'],
    format: 'iife',
    charset: 'utf8',
    legalComments: 'none',
    define: { TSG_ENV: JSON.stringify(env(dev)) },
    alias: { '@tsg': join(HERE, 'src') },
    logLevel: 'silent',
  };
}

function renderHtml(js) {
  const tpl = readFileSync(join(HERE, 'template.html'), 'utf8');
  const base = (studio.publicBase || '').replace(/\/$/, '');
  const url = `${base}/${slug}/`;
  const og = cfg.ogImage ? `${base}/${slug}/${cfg.ogImage.replace(/^\.?\//, '')}` : `${base}/assets/og.svg`;
  const fonts = Array.isArray(cfg.fonts) && cfg.fonts.length ? cfg.fonts.map((f) => `&family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;700`).join('') : '';
  const vars = {
    lang: cfg.lang, dir: cfg.lang === 'he' ? 'rtl' : 'ltr', title: esc(cfg.title), description: esc(cfg.tagline),
    ogTitle: esc(cfg.ogTitle || `${cfg.title} · Too Soon Games`), ogDescription: esc(cfg.ogDescription || cfg.tagline), ogImage: esc(og), url: esc(url),
    home: base ? base + '/' : '/', themeColor: esc(cfg.themeColor || '#140b24'), bg: esc(cfg.themeColor || '#140b24'), extraFonts: fonts,
    script: js.replace(/<\/script/gi, '<\\/script'),
  };
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ''));
}

function writeOut(js, dev) {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const html = renderHtml(js);
  writeFileSync(join(OUT, 'index.html'), html);
  const assets = join(GAME_DIR, 'assets');
  if (existsSync(assets)) cpSync(assets, join(OUT, 'assets'), { recursive: true });
  const bytes = Buffer.byteLength(html);
  const kb = (bytes / 1024).toFixed(1);
  const over = bytes > MAX_HTML_BYTES;
  console.log(`[build] ${slug}/index.html ${kb} KB${over ? ' — OVER the 300 KB budget (rule 13א)' : ''}${dev ? ' (dev, unminified)' : ''}`);
  if (over && !dev) process.exitCode = 2;
}

async function doBuild(dev = false) {
  const r = await esbuild(esbuildOptions(dev));
  const js = r.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
  writeOut(js, dev);
}

function doCheck() {
  // tsconfig that extends the template's and includes both trees
  const tmp = join(HERE, `.tsconfig.${gameId}.json`);
  writeFileSync(tmp, JSON.stringify({
    extends: './tsconfig.base.json',
    compilerOptions: { paths: { '@tsg/*': ['./src/*'] } },
    include: ['src/**/*.ts', `../../Games/${gameId}/src/**/*.ts`, `../../Games/${gameId}/*.d.ts`],
  }, null, 2));
  const tsc = join(HERE, 'node_modules', 'typescript', 'bin', 'tsc');
  const res = spawnSync(process.execPath, [tsc, '--noEmit', '-p', tmp], { stdio: 'inherit' });
  rmSync(tmp, { force: true });
  if (res.status !== 0) die('typecheck failed');
  console.log('[check] types ok');
}

async function doDev() {
  const port = Number(process.env.PORT || 5173);
  const ctx = await context({
    ...esbuildOptions(true),
    plugins: [{ name: 'tsg-html', setup(b) { b.onEnd((r) => { if (r.errors.length) { console.error(r.errors.map((e) => e.text).join('\n')); return; } const js = r.outputFiles?.find((f) => f.path.endsWith('.js'))?.text ?? ''; writeOut(js, true); }); } }],
  });
  await ctx.watch();
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(DIST, p);
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found: ' + p); return; }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  }).listen(port, '127.0.0.1', () => console.log(`[dev] http://127.0.0.1:${port}/${slug}/   (API: ${env(true).apiBase})`));
}

if (cmd === 'build') await doBuild(false);
else if (cmd === 'dev') await doDev();
else if (cmd === 'check') doCheck();
else die('unknown command ' + cmd);
