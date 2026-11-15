import type { SiteCtx } from '../types';
import { esc, attr, join, fmtLongDate } from './html';
import { icons } from './icons';

export interface PageMeta {
  title: string; // "Privacy" → "<title>Privacy · Too Soon Games</title>"
  description: string;
  path: string; // "/privacy/"
  home?: boolean;
  extraHead?: string;
  bodyClass?: string;
}

export function layout(ctx: SiteCtx, meta: PageMeta, body: string): string {
  const { studio } = ctx;
  const fullTitle = meta.home ? `${studio.name} · ${studio.tagline.split('.')[0]}` : `${meta.title} · ${studio.name}`;
  const url = ctx.base + meta.path;
  const beacon = studio.cfWebAnalyticsToken
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${attr(studio.cfWebAnalyticsToken)}"}'></script>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${attr(meta.description)}">
<link rel="canonical" href="${attr(url)}">
<meta name="theme-color" content="#121212">
<meta name="color-scheme" content="light">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(studio.name)}">
<meta property="og:title" content="${attr(fullTitle)}">
<meta property="og:description" content="${attr(meta.description)}">
<meta property="og:url" content="${attr(url)}">
<meta property="og:image" content="${attr(ctx.base)}/assets/og.svg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/icon-192.svg">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&display=swap">
<link rel="stylesheet" href="${attr(ctx.cssHref)}">
${meta.extraHead ?? ''}
${beacon}
</head>
<body class="${attr(meta.bodyClass ?? '')}">
<a class="skip" href="#main">Skip to content</a>
${header(ctx, meta.home === true)}
<main id="main" class="wrap">
${body}
</main>
${footer(ctx)}
</body>
</html>
`;
}

export function header(ctx: SiteCtx, home: boolean): string {
  const logo = `<img src="/assets/logo.png" alt="${attr(ctx.studio.name)}" width="360" height="352" class="logo">`;
  return `<div class="topbar"><div class="wrap"><span data-today>${esc(fmtLongDate(new Date()))}</span><span class="live"><i aria-hidden="true"></i>Live</span></div></div>
<header class="masthead wrap">
  ${home ? `<span class="brand">${logo}</span>` : `<a class="brand" href="/" aria-label="${attr(ctx.studio.name)} home">${logo}</a>`}
  <p class="studio-line">${esc(ctx.studio.tagline)}</p>
  <nav class="sections" aria-label="Site">
    <a href="/"${home ? ' aria-current="page"' : ''}>Latest</a>
    <a href="/about/">About</a>
  </nav>
</header>`;
}

const NETWORKS = [
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['x', 'X'],
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
] as const;

/** Footer social links. Only networks that have a link are shown (decision 62: nothing inert on the page). */
function socials(ctx: SiteCtx): string {
  const s = ctx.studio as unknown as Record<string, string>;
  const links = NETWORKS.filter(([key]) => (s[key] || '').trim())
    .map(([key, label]) => `<a class="net" href="${attr(s[key]!.trim())}" target="_blank" rel="noopener" aria-label="${label}" data-network="${key}">${icons[key]}</a>`)
    .join('');
  return links ? `<div class="nets"><p>The next game depends on the news. Follow us and be first to play.</p>${links}</div>` : '';
}

export function footer(ctx: SiteCtx): string {
  return `<footer class="site-footer">
  <div class="wrap">
  <p class="foot-brand serif">${esc(ctx.studio.name)}</p>
  ${socials(ctx)}
  <nav aria-label="Legal">
    <a href="/about/">About</a>
    <a href="/privacy/">Privacy</a>
    <a href="/terms/">Terms</a>
    <a href="/contact/">Contact</a>
    <a href="/accessibility/">Accessibility</a>
  </nav>
  <p class="small">© ${new Date().getUTCFullYear()} ${esc(ctx.studio.name)}. Parody. Not affiliated with the real people or organizations.</p>
  </div>
</footer>`;
}

export { join };
