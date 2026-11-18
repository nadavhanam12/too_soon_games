// Builds the studio site into GamesTemplate/dist/ (see docs/CONTRACTS.md).
//   node run.mjs [--games <file>] [--out <dir>] [--serve] [--port <n>]
// Game pages (dist/<slug>/) are produced by common-game-code, never touched here.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { build as esbuild } from 'esbuild';
import type { GameEntry, FeedEvent, Studio, SiteCtx } from './src/types';
import { homePage } from './src/pages/home';
import { aboutPage, privacyPage, termsPage, contactPage, accessibilityPage, notFoundPage } from './src/pages/text';
import { sortGames, checkEventLimits } from './src/components/games';
import { gameChromeJs } from './src/components/game-chrome';

// run.mjs bundles this file into .cache/, so the frontend dir comes from the env it sets.
const here = process.env.FRONTEND_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = resolve(here, '..');

/** Top-level folders the site build itself writes into dist/ (everything else there is a game). */
const SITE_DIRS = ['assets', 'about', 'privacy', 'terms', 'contact', 'accessibility', 'press', '.well-known'];

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export async function main(args: string[]): Promise<void> {
  const gamesFile = resolve(here, arg(args, '--games') ?? join(templateRoot, 'games.json'));
  const out = resolve(here, arg(args, '--out') ?? join(templateRoot, 'dist'));
  const studio = JSON.parse(readFileSync(join(templateRoot, 'studio.json'), 'utf8')) as Studio;
  // --api <url>: a site build that talks to a local API (`wrangler dev`), for testing the sign-up and the boards
  const apiOverride = arg(args, '--api');
  if (apiOverride) studio.apiBase = apiOverride;
  const games = (JSON.parse(readFileSync(gamesFile, 'utf8')) as { games: GameEntry[] }).games ?? [];
  validate(games);
  const eventsFile = resolve(here, arg(args, '--events') ?? join(templateRoot, 'events-feed.json'));
  const events = existsSync(eventsFile) ? ((JSON.parse(readFileSync(eventsFile, 'utf8')) as { events: FeedEvent[] }).events ?? []) : [];
  validateEvents(games, events);

  mkdirSync(join(out, 'assets'), { recursive: true });
  // dist/ is never wiped (the game pages in it come from common-game-code), so a game that left games.json or changed
  // its slug stayed online, unregistered and uncounted (calling-in-wasted, wasted-for-six until 2026-11-18). Remove
  // every top-level folder that is neither a site folder nor a registered game. Only with the real registry: a test
  // registry (--games) lists other games and would delete the real ones.
  if (!arg(args, '--games')) {
    const keep = new Set([...SITE_DIRS, ...games.map((g) => g.slug)]);
    for (const name of readdirSync(out)) {
      if (keep.has(name) || !statSync(join(out, name)).isDirectory()) continue;
      rmSync(join(out, name), { recursive: true, force: true });
      console.log(`[site] removed dist/${name}/ (not in games.json)`);
    }
  }

  // css with a content hash → immutable caching
  const css = readFileSync(join(here, 'src/styles/site.css'), 'utf8');
  const hash = createHash('sha256').update(css).digest('hex').slice(0, 8);
  const cssHref = `/assets/site.${hash}.css`;
  writeFileSync(join(out, cssHref), css);

  const ctx: SiteCtx = {
    studio,
    games,
    events,
    cssHref,
    base: (studio.publicBase || '').replace(/\/$/, ''),
    todoEmail: !studio.email,
  };

  // pages
  const pages: Record<string, string> = {
    'index.html': homePage(ctx),
    'about/index.html': aboutPage(ctx),
    'privacy/index.html': privacyPage(ctx),
    'terms/index.html': termsPage(ctx),
    'contact/index.html': contactPage(ctx),
    'accessibility/index.html': accessibilityPage(ctx),
    '404.html': notFoundPage(ctx),
  };
  for (const [rel, html] of Object.entries(pages)) {
    mkdirSync(dirname(join(out, rel)), { recursive: true });
    writeFileSync(join(out, rel), html);
  }

  // the site's columns on the game pages (desktop): a fixed name the game pages load, so it is cached for 60 s only (/*)
  writeFileSync(join(out, 'game-chrome.js'), gameChromeJs(ctx, css));

  // press kits (PublishGamesPipeline, stage press-kit): Games/<id>/launch/press/ → /press/<slug>/
  const pressSlugs: string[] = [];
  for (const g of games) {
    const src = join(templateRoot, '..', 'Games', g.id, 'launch', 'press');
    if (!existsSync(join(src, 'index.html'))) continue;
    cpSync(src, join(out, 'press', g.slug), { recursive: true });
    pressSlugs.push(g.slug);
  }

  // assets
  const assets = join(here, 'src/assets');
  copyFileSync(join(assets, 'logo.png'), join(out, 'assets/logo.png'));
  copyFileSync(join(assets, 'favicon.svg'), join(out, 'assets/favicon.svg'));
  copyFileSync(join(assets, 'favicon.svg'), join(out, 'assets/icon-192.svg'));
  copyFileSync(join(assets, 'favicon.svg'), join(out, 'assets/icon-512.svg'));
  copyFileSync(join(assets, 'og.svg'), join(out, 'assets/og.svg'));

  writeFileSync(join(out, 'manifest.webmanifest'), JSON.stringify({
    name: studio.name,
    short_name: 'Too Soon',
    start_url: '/',
    display: 'standalone',
    background_color: '#100e1a',
    theme_color: '#100e1a',
    icons: [
      { src: '/assets/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/assets/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
    ],
  }, null, 2));

  // robots, sitemap, headers, security.txt
  const base = ctx.base || 'https://toosoon-games.pages.dev';
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${base}/sitemap.xml\n`);
  const urls = ['/', '/about/', '/privacy/', '/terms/', '/contact/', '/accessibility/', ...sortGames(games).map((g) => `/${g.slug}/`), ...pressSlugs.map((s) => `/press/${s}/`)];
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${base}${u}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`);
  writeFileSync(join(out, '_headers'), [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    '  Cache-Control: public, max-age=60',
    '',
    // "! Cache-Control" drops the max-age=60 of the /* rule; without it Pages joins both values into one header
    '/assets/*',
    '  ! Cache-Control',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    // one rule per game: the old "/*/assets/*" rule (two splats) never matched, so game files were cached for 4 hours
    // only (the Pages default) until 2026-11-18. Game file URLs carry the game's version (?v=, assetUrl), so a year is safe.
    ...games.flatMap((g) => [`/${g.slug}/assets/*`, `/${g.slug}/lazy/*`].flatMap((p) => [p, '  ! Cache-Control', '  Cache-Control: public, max-age=31536000, immutable', ''])),
  ].join('\n'));
  // _routes.json: the Pages worker (functions/worker.ts) runs only where it does something: game pages (challenge links)
  // and 404s. Without it every image, sound and script ran the worker, and each one counted against the Workers request
  // quota (100K a day on the free plan, roughly 40 per player). Static paths below are served directly.
  const exclude = [
    '/assets/*', '/press/*', '/.well-known/*', '/about/*', '/privacy/*', '/terms/*', '/contact/*', '/accessibility/*',
    '/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/404.html', '/game-chrome.js',
    ...games.flatMap((g) => [`/${g.slug}/assets/*`, `/${g.slug}/lazy/*`]),
  ];
  if (exclude.length > 99) throw new Error(`_routes.json allows 100 rules; ${exclude.length + 1} needed. Group game assets under one prefix.`);
  writeFileSync(join(out, '_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude }, null, 2) + '\n');

  mkdirSync(join(out, '.well-known'), { recursive: true });
  const secEmail = studio.email || 'contact@example.com';
  const exp = new Date(Date.now() + 365 * 86400000).toISOString();
  writeFileSync(join(out, '.well-known/security.txt'), `Contact: mailto:${secEmail}\nExpires: ${exp}\nPreferred-Languages: en, he\nCanonical: ${base}/.well-known/security.txt\n`);

  // Pages worker (advanced mode)
  await esbuild({
    entryPoints: [join(here, 'functions/worker.ts')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    outfile: join(out, '_worker.js'),
    minify: false,
    logLevel: 'warning',
  });

  const n = Object.keys(pages).length;
  console.log(`frontend built → ${out}  (${n} pages, ${pressSlugs.length} press kits, ${games.length} games from ${gamesFile.replace(templateRoot, '…')}, css ${cssHref})`);
  if (!studio.email) console.log('note: studio.json "email" is empty → contact pages show a TODO placeholder');

  if (args.includes('--serve')) serve(out, Number(arg(args, '--port') ?? 5180), arg(args, '--host') ?? '127.0.0.1');
}

function validateEvents(games: GameEntry[], events: FeedEvent[]): void {
  for (const e of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '') || !(e.text ?? '').trim()) throw new Error(`events-feed.json: each event needs date (YYYY-MM-DD) and text, got ${JSON.stringify(e)}`);
  }
  const errors = checkEventLimits(games, events);
  if (errors.length) throw new Error(errors.join('\n'));
}

function validate(games: GameEntry[]): void {
  const required: (keyof GameEntry)[] = ['id', 'slug', 'title', 'tagline', 'audience', 'lang'];
  const seen = new Set<string>();
  for (const g of games) {
    for (const k of required) if (!g[k]) throw new Error(`games.json: "${g.id ?? g.slug ?? '?'}" is missing "${k}"`);
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(g.slug)) throw new Error(`games.json: bad slug "${g.slug}"`);
    if (seen.has(g.slug)) throw new Error(`games.json: duplicate slug "${g.slug}"`);
    seen.add(g.slug);
  }
}

// Minimal static server for local checks (mirrors Pages: /x/ → /x/index.html, 404 → 404.html).
function serve(root: string, port: number, host: string): void {
  const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };
  createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0] ?? '/');
    if (p.endsWith('/')) p += 'index.html';
    let file = join(root, p);
    if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
    if (!existsSync(file) || statSync(file).isDirectory()) {
      const nf = join(root, '404.html');
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(existsSync(nf) ? readFileSync(nf) : 'not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  }).listen(port, host, () => console.log(`serving ${root} at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/  (${readdirSync(root).length} entries)`));
}
