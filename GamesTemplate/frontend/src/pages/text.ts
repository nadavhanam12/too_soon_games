// The static "every site needs these" pages. English. Texts honor the decisions in docs/DECISIONS.md:
// no PII, anonymous userId, nickname + score + country/city, parody disclaimer, takedown contact.
import type { SiteCtx } from '../types';
import { layout } from '../components/layout';
import { esc, attr } from '../components/html';

const UPDATED = '2026-11-14';

function textPage(ctx: SiteCtx, title: string, description: string, path: string, html: string): string {
  return layout(ctx, { title, description, path, bodyClass: 'page-text' }, `<article class="prose card">
<h1>${esc(title)}</h1>
${html}
<p class="muted small">Last updated ${UPDATED}.</p>
</article>`);
}

function contactLine(ctx: SiteCtx): string {
  const email = ctx.studio.email.trim();
  if (email) return `<a href="mailto:${attr(email)}">${esc(email)}</a>`;
  return `<a href="mailto:contact@example.com">contact@example.com</a> <mark class="todo">TODO: set the studio email in studio.json</mark>`;
}

export function aboutPage(ctx: SiteCtx): string {
  const n = esc(ctx.studio.name);
  return textPage(ctx, 'About', `${ctx.studio.name}: short web games about what everyone is talking about right now.`, '/about/', `
<p class="lead">${esc(ctx.studio.tagline)}</p>
<p>${n} makes tiny browser games about events and trends while they are still in the headlines. Each game is built in about a day, plays in one to three minutes on a phone, needs no download and no sign-up, and comes with a leaderboard so you can challenge your friends.</p>
<h2>Parody</h2>
<p>Our games are parody and satire. They are works of fiction inspired by public events. We are not affiliated with, endorsed by, or speaking for any person, company, team, party or organization that appears in the news we riff on. Characters in the games are caricatures; where a real name appears it is only on the game's "What really happened" screen, with a link to a public source and its date.</p>
<h2>Who we are</h2>
<p>A small independent studio. We build, test and publish the games ourselves, with AI tools helping on code and content and a human making every editorial call.</p>
<h2>Credits</h2>
<ul>
  <li>Type: <a href="https://fonts.google.com/specimen/Fredoka" rel="noopener" target="_blank">Fredoka</a> and <a href="https://fonts.google.com/specimen/Rubik" rel="noopener" target="_blank">Rubik</a> (Open Font License), served by Google Fonts.</li>
  <li>Infrastructure: Cloudflare Pages and Workers.</li>
  <li>Game audio is synthesized in the browser unless a game's own page credits otherwise.</li>
</ul>
<p>Questions, press, or a problem with a game? See <a href="/contact/">Contact</a>.</p>`);
}

export function privacyPage(ctx: SiteCtx): string {
  return textPage(ctx, 'Privacy', `What ${ctx.studio.name} stores when you play, and what it never collects.`, '/privacy/', `
<p class="lead">Short version: no accounts, no email, no phone number, no IP addresses, no advertising trackers. An anonymous random ID, your nickname if you choose one, your scores, and a rough location (country and city) so we can see where a game is played.</p>
<h2>What we store</h2>
<ul>
  <li><strong>Anonymous player ID.</strong> When you first open a game, your browser creates a random identifier (a UUID) and keeps it in its local storage and a first-party cookie. It is not linked to your name, email or device identifiers. It lets a leaderboard remember that a score is yours and lets us count players. Clearing your browser data creates a new one.</li>
  <li><strong>Nickname and scores.</strong> If you enter a nickname it is shown publicly on that game's leaderboard next to your score. Nicknames are free text you choose; do not use your real name if you do not want it shown. We may remove offensive nicknames.</li>
  <li><strong>Gameplay events.</strong> Things like "game started", "level 3 completed", "share button tapped", with the time, the game version, your device type (phone, tablet, desktop) and browser language. We use them to see where players get stuck and which share buttons work.</li>
  <li><strong>Approximate location.</strong> Our hosting provider (Cloudflare) tells our server the country and city an internet connection belongs to. We store country and city, never the IP address itself.</li>
</ul>
<h2>What we do not collect</h2>
<p>Email addresses, phone numbers, names, precise location, contacts, photos, payment details, or anything typed outside the nickname field. We do not sell or share data with advertisers, and there are currently no ads.</p>
<h2>Cookies</h2>
<p>One first-party cookie holds the anonymous player ID described above; it is functional, not for advertising. Our hosting provider may set a short-lived security cookie. If we ever add advertising this page will change first.</p>
<h2>Third parties</h2>
<ul>
  <li><strong>Cloudflare</strong> hosts the site and the leaderboard server, and provides privacy-first visit statistics (Cloudflare Web Analytics, no cookies). Data is processed on Cloudflare's network, which has locations worldwide.</li>
  <li><strong>Google Fonts</strong> serves the typefaces; your browser requests them from Google.</li>
  <li>When you tap a share button, the text and link are handed to the app you pick (WhatsApp, Messages, etc.). What happens there is governed by that app.</li>
</ul>
<h2>How long</h2>
<p>Scores and the anonymous ID are kept for as long as the game is online. Gameplay events are summarized and the raw records are kept for up to 90 days.</p>
<h2>Your choices</h2>
<p>Play without a nickname (scores show as "Anonymous"). Clear your browser's site data to reset your anonymous ID. To have a nickname or score removed, write to us with the game name and nickname: ${contactLine(ctx)}. Because the ID is anonymous we cannot look up data by your name.</p>
<h2>Children</h2>
<p>The games are made for a general audience and we do not knowingly collect personal data from anyone. There is nothing to sign up for.</p>
<h2>Changes</h2>
<p>If this policy changes, the date at the bottom of this page moves and material changes are noted on the home page for a while.</p>`);
}

export function termsPage(ctx: SiteCtx): string {
  return textPage(ctx, 'Terms', `The short rules for playing ${ctx.studio.name}.`, '/terms/', `
<p class="lead">Free to play, for fun, as is. Be decent on the leaderboard.</p>
<h2>Use</h2>
<p>The games are free for personal, non-commercial play. You may link to them anywhere. Please do not copy, re-host, scrape, or sell them, and do not try to break the leaderboard server (automated requests, fake scores, probing). We may block abusive traffic.</p>
<h2>Leaderboards and nicknames</h2>
<p>Leaderboards are public. Nicknames you enter are shown to everyone. We may remove or change nicknames and scores that are offensive, impersonate someone, contain links or personal data, or were clearly not earned by playing. There is no appeal process beyond writing to us.</p>
<h2>Parody and content</h2>
<p>The games are satire about public events. They are fiction and opinion, not reporting. The "What really happened" screen in each game links to a public source for the underlying event. If you believe a game is unfair to you or to someone you represent, use the takedown contact on the <a href="/contact/">Contact</a> page; we read every message and act quickly.</p>
<h2>No warranty</h2>
<p>The games and site are provided as is, without warranties of any kind. We may change, pause or remove a game at any time, including its leaderboard. To the extent permitted by law we are not liable for any damages arising from using the site.</p>
<h2>Age</h2>
<p>The site is intended for players aged 13 and over.</p>
<h2>Law</h2>
<p>These terms are governed by the laws of the State of Israel, without regard to conflict-of-law rules. If a clause is found unenforceable the rest still applies.</p>`);
}

export function contactPage(ctx: SiteCtx): string {
  return textPage(ctx, 'Contact', `Reach ${ctx.studio.name}: press, feedback, bug reports and content takedown requests.`, '/contact/', `
<p class="lead">One address for everything: ${contactLine(ctx)}</p>
<h2>Content removal (takedown)</h2>
<p>If you are, or represent, a person or organization referenced by one of our games and want something changed or removed, email us with the subject <strong>Takedown</strong>, the game's name, and what the problem is. We acknowledge within 2 business days and usually act the same day. You do not need a lawyer to write to us.</p>
<h2>Press</h2>
<p>Subject <strong>Press</strong>. We can share player numbers, screenshots and a short background on how a game was made.</p>
<h2>Bugs and feedback</h2>
<p>Subject <strong>Bug</strong>, with your phone model and browser if it is a problem on a device. Screenshots help a lot.</p>
<h2>Security</h2>
<p>Found a vulnerability? Subject <strong>Security</strong>. Details are also in <a href="/.well-known/security.txt">security.txt</a>. Please do not test against other players' data.</p>`);
}

export function accessibilityPage(ctx: SiteCtx): string {
  return textPage(ctx, 'Accessibility', `Accessibility statement for ${ctx.studio.name}: what works, what does not yet, how to reach us.`, '/accessibility/', `
<p class="lead">We want everyone who finds a link to one of our games to be able to play or at least to know what the game is about.</p>
<h2>This website</h2>
<ul>
  <li>Works with keyboard navigation, screen readers and system text zoom. Headings, links and buttons are labeled.</li>
  <li>Text keeps at least AA contrast on the dark background. Layout adapts from small phones to large screens.</li>
  <li>Animations are turned off when your system asks for reduced motion.</li>
</ul>
<h2>The games</h2>
<p>The games are drawn on an HTML canvas, which screen readers cannot read. Game text is therefore not available to assistive technology. We mitigate this with: large touch targets (at least 44 px), a simple one-finger or arrow-key control scheme, no time-critical reading, reduced-motion support (no screen shake or flashes when your system asks for it), and a plain-HTML "What really happened" screen that links to the original story. A fully accessible version of each game is not something we can promise within our one-day production window; we are honest about that here rather than claim otherwise.</p>
<h2>Standard</h2>
<p>We aim for WCAG 2.1 level AA on the website pages. This statement follows the spirit of the Israeli Equal Rights for Persons with Disabilities (Service Accessibility) Regulations, 2013.</p>
<h2>Tell us</h2>
<p>If something on the site blocks you, write to ${contactLine(ctx)} with the subject <strong>Accessibility</strong>. Accessibility coordinator: the studio founders.</p>`);
}

export function notFoundPage(ctx: SiteCtx): string {
  return layout(ctx, { title: 'Not found', description: 'This page does not exist.', path: '/404.html', bodyClass: 'page-text' }, `
<article class="prose card center">
<p class="eyebrow">404</p>
<h1>Too soon, or too late.</h1>
<p class="lead">This page is not here. The game you are looking for may have moved to the archive.</p>
<p><a class="btn btn-play" href="/">All games</a></p>
</article>`);
}
