import type { GameEntry } from '../types';
import { esc, attr, fmtDate, flag, langName } from './html';
import { icons } from './icons';

export const gameUrl = (g: GameEntry) => `/${g.slug}/`;
export const coverUrl = (g: GameEntry) => (g.cover ? `/${g.slug}/${g.cover.replace(/^\/+/, '')}` : '');

/** Newest first, live before archived. */
export function sortGames(games: GameEntry[]): GameEntry[] {
  return [...games].sort((a, b) => {
    if ((a.status === 'archived') !== (b.status === 'archived')) return a.status === 'archived' ? 1 : -1;
    return (b.publishedAt || '').localeCompare(a.publishedAt || '');
  });
}

/** Server-side default featured game (the client may swap it by browser language). */
export function defaultFeatured(games: GameEntry[]): GameEntry | undefined {
  const sorted = sortGames(games.filter((g) => g.status !== 'archived'));
  return sorted.find((g) => g.featured) ?? sorted[0] ?? sortGames(games)[0];
}

function coverImg(g: GameEntry, cls: string, lazy: boolean): string {
  const src = coverUrl(g);
  if (!src) return `<div class="${cls} cover-fallback" aria-hidden="true"><span>${esc(g.title.slice(0, 1))}</span></div>`;
  return `<img class="${cls}" src="${attr(src)}" alt="" width="800" height="600"${lazy ? ' loading="lazy"' : ' fetchpriority="high"'}>`;
}

export function hero(g: GameEntry | undefined): string {
  if (!g) {
    return `<section class="hero card" id="hero">
  <div class="hero-text">
    <p class="eyebrow">Coming soon</p>
    <h1>First game coming soon.</h1>
    <p class="lead">Something happened. Everyone is talking about it. We are building the game.</p>
  </div>
</section>`;
  }
  return `<section class="hero card" id="hero" data-slug="${attr(g.slug)}">
  <a class="hero-cover" href="${attr(gameUrl(g))}" tabindex="-1" aria-hidden="true">${coverImg(g, 'cover', false)}</a>
  <div class="hero-text">
    <p class="eyebrow">${g.status === 'archived' ? 'From the archive' : 'Latest game'} · ${flag(g.audience)} ${langName(g.lang)}${g.event?.date ? ` · ${esc(fmtDate(g.event.date))}` : ''}</p>
    <h1 dir="auto">${esc(g.title)}</h1>
    <p class="lead" dir="auto">${esc(g.tagline)}</p>
    <p class="players" data-count="${attr(g.slug)}" data-min="${g.showPlayerCountFrom ?? 500}" hidden><b></b> played</p>
    <a class="btn btn-play" href="${attr(gameUrl(g))}">${icons.play} Play</a>
  </div>
</section>`;
}

export function boardBlock(g: GameEntry | undefined): string {
  if (!g) return '';
  return `<section class="board card" id="board" data-slug="${attr(g.slug)}" hidden aria-labelledby="board-h">
  <h2 id="board-h">Top players · <span class="board-title">${esc(g.title)}</span></h2>
  <ol class="board-list"></ol>
  <p class="board-more"><a href="${attr(gameUrl(g))}#board" class="muted">See all</a></p>
</section>`;
}

export function gameCard(g: GameEntry): string {
  return `<li class="game-card card${g.status === 'archived' ? ' is-archived' : ''}" data-slug="${attr(g.slug)}" data-lang="${attr(g.lang)}" data-published="${attr(g.publishedAt || '')}">
  <a href="${attr(gameUrl(g))}" class="game-card-link">
    ${coverImg(g, 'cover', true)}
    <div class="game-card-body">
      <h3 dir="auto">${esc(g.title)}</h3>
      <p class="muted" dir="auto">${esc(g.tagline)}</p>
      <p class="meta">
        <span title="${langName(g.lang)}">${flag(g.audience)}</span>
        ${g.event?.date ? `<time datetime="${attr(g.event.date)}">${esc(fmtDate(g.event.date))}</time>` : ''}
        <span class="players" data-count="${attr(g.slug)}" data-min="0" hidden><b></b> played</span>
        ${g.status === 'archived' ? '<span class="tag">Archive</span>' : ''}
      </p>
    </div>
  </a>
</li>`;
}

export function gamesGrid(games: GameEntry[]): string {
  const sorted = sortGames(games);
  if (!sorted.length) return '';
  return `<section class="all-games" aria-labelledby="all-h">
  <h2 id="all-h">All games</h2>
  <ul class="grid">${sorted.map(gameCard).join('')}</ul>
</section>`;
}
