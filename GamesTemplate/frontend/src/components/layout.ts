import type { SiteCtx } from '../types';
import { esc, attr, join } from './html';
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
<meta name="theme-color" content="#140b24">
<meta name="color-scheme" content="dark">
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Rubik:wght@400;700&display=swap">
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
  const logo = `<img src="/assets/logo.png" alt="${attr(ctx.studio.name)}" width="120" height="120" class="logo">`;
  return `<header class="site-header wrap">
  ${home ? `<span class="brand">${logo}</span>` : `<a class="brand" href="/" aria-label="${attr(ctx.studio.name)} home">${logo}</a>`}
  <nav class="site-nav" aria-label="Site">
    ${home ? '' : '<a href="/">Games</a>'}
    <a href="/about/">About</a>
  </nav>
</header>`;
}

export function footer(ctx: SiteCtx): string {
  return `<footer class="site-footer wrap">
  <nav aria-label="Legal">
    <a href="/about/">About</a>
    <a href="/privacy/">Privacy</a>
    <a href="/terms/">Terms</a>
    <a href="/contact/">Contact</a>
    <a href="/accessibility/">Accessibility</a>
  </nav>
  <p>© ${new Date().getUTCFullYear()} ${esc(ctx.studio.name)}. Parody. Not affiliated with the real people or organizations.</p>
</footer>`;
}

const NETWORKS = [
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['x', 'X'],
  ['facebook', 'Facebook'],
] as const;

/** The follow block: 4 network buttons; a network without a link is shown half-transparent and inert. */
export function followBlock(ctx: SiteCtx): string {
  const s = ctx.studio as unknown as Record<string, string>;
  const buttons = NETWORKS.map(([key, label]) => {
    const href = (s[key] || '').trim();
    const icon = icons[key];
    return href
      ? `<a class="net" href="${attr(href)}" target="_blank" rel="noopener" aria-label="${label}" data-network="${key}">${icon}</a>`
      : `<span class="net is-empty" aria-label="${label} (coming soon)" title="${label}: coming soon">${icon}</span>`;
  }).join('');
  return `<section class="follow card" aria-labelledby="follow-h">
  <h2 id="follow-h">The next game depends on the news.</h2>
  <p>Follow us and be first to play.</p>
  <div class="nets">${buttons}</div>
</section>`;
}

export { join };
