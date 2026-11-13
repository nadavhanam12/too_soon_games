// Builds the studio site into GamesTemplate/dist/ (see docs/CONTRACTS.md).
//   node run.mjs [--games <file>] [--out <dir>] [--serve] [--port <n>]
// Game pages (dist/<slug>/) are produced by common-game-code, never touched here.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { build as esbuild } from 'esbuild';
import type { GameEntry, Studio, SiteCtx } from './src/types';
import { homePage } from './src/pages/home';
import { aboutPage, privacyPage, termsPage, contactPage, accessibilityPage, notFoundPage } from './src/pages/text';
import { sortGames } from './src/components/games';

// run.mjs bundles this file into .cache/, so the frontend dir comes from the env it sets.
const here = process.env.FRONTEND_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = resolve(here, '..');

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export async function main(args: string[]): Promise<void> {
  const gamesFile = resolve(here, arg(args, '--games') ?? join(templateRoot, 'games.json'));
  const out = resolve(here, arg(args, '--out') ?? join(templateRoot, 'dist'));
  const studio = JSON.parse(readFileSync(join(templateRoot, 'studio.json'), 'utf8')) as Studio;
  const games = (JSON.parse(readFileSync(gamesFile, 'utf8')) as { games: GameEntry[] }).games ?? [];
  validate(games);

  mkdirSync(join(out, 'assets'), { recursive: true });

  // css with a content hash → immutable caching
  const css = readFileSync(join(here, 'src/styles/site.css'), 'utf8');
  const hash = createHash('sha256').update(css).digest('hex').slice(0, 8);
  const cssHref = `/assets/site.${hash}.css`;
  writeFileSync(join(out, cssHref), css);

  const ctx: SiteCtx = {
    studio,
    games,
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
    background_color: '#140b24',
    theme_color: '#140b24',
    icons: [
      { src: '/assets/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/assets/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
    ],
  }, null, 2));

  // robots, sitemap, headers, security.txt
  const base = ctx.base || 'https://toosoon-games.pages.dev';
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${base}/sitemap.xml\n`);
  const urls = ['/', '/about/', '/privacy/', '/terms/', '/contact/', '/accessibility/', ...sortGames(games).map((g) => `/${g.slug}/`)];
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
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/*/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n'));
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
  console.log(`frontend built → ${out}  (${n} pages, ${games.length} games from ${gamesFile.replace(templateRoot, '…')}, css ${cssHref})`);
  if (!studio.email) console.log('note: studio.json "email" is empty → contact pages show a TODO placeholder');

  if (args.includes('--serve')) serve(out, Number(arg(args, '--port') ?? 5180));
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
function serve(root: string, port: number): void {
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
  }).listen(port, '127.0.0.1', () => console.log(`serving ${root} at http://127.0.0.1:${port}/  (${readdirSync(root).length} entries)`));
}
