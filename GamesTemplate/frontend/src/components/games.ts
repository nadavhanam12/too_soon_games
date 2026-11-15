import type { GameEntry, FeedEvent } from '../types';
import { esc, attr, fmtDate, relTime, regionOf } from './html';
import { icons } from './icons';

export const gameUrl = (g: GameEntry) => `/${g.slug}/`;
export const coverUrl = (g: GameEntry) => (g.cover ? `/${g.slug}/${g.cover.replace(/^\/+/, '')}` : '');

/** The date a game sits at in the feed: the event's date, else the release day. */
export const gameDate = (g: GameEntry): string => g.event?.date || g.publishedAt || '';

/** English news headline of a game ("Nvidia's CEO resigns."). Falls back to the event title, then the game title. */
export const headlineOf = (g: GameEntry): string => g.event?.headline || g.event?.title || g.title;

/** Newest first, live before archived. */
export function sortGames(games: GameEntry[]): GameEntry[] {
  return [...games].sort((a, b) => {
    if ((a.status === 'archived') !== (b.status === 'archived')) return a.status === 'archived' ? 1 : -1;
    const byRelease = (b.publishedAt || '').localeCompare(a.publishedAt || '');
    return byRelease || (b.event?.date || '').localeCompare(a.event?.date || ''); // same release day: the newer event first
  });
}

/** The lead story: always the newest live game (decision 53). */
export function defaultFeatured(games: GameEntry[]): GameEntry | undefined {
  const sorted = sortGames(games.filter((g) => g.status !== 'archived'));
  return sorted[0] ?? sortGames(games)[0];
}

export type FeedItem = { kind: 'game'; date: string; game: GameEntry } | { kind: 'event'; date: string; event: FeedEvent };

/** Everything below the lead story, newest first: the other games and the "too soon even for us" events. */
export function feedItems(games: GameEntry[], events: FeedEvent[], lead: GameEntry | undefined): FeedItem[] {
  const items: FeedItem[] = [
    ...games.filter((g) => g !== lead).map((g): FeedItem => ({ kind: 'game', date: gameDate(g), game: g })),
    ...events.map((e): FeedItem => ({ kind: 'event', date: e.date, event: e })),
  ];
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

/** Decision 59: at most 3 events between two consecutive games (and after the newest one). Returns error messages. */
export function checkEventLimits(games: GameEntry[], events: FeedEvent[]): string[] {
  const dates = games.map(gameDate).filter(Boolean).sort();
  const errors: string[] = [];
  const bounds = [...dates, '9999-12-31'];
  let prev = '0000-00-00';
  for (const d of bounds) {
    const n = events.filter((e) => e.date > prev && e.date <= d).length;
    if (n > 3) errors.push(`events-feed.json: ${n} events between ${prev} and ${d} (max 3, decision 59)`);
    prev = d;
  }
  return errors;
}

const timeMeta = (iso: string): string =>
  iso ? `<time datetime="${attr(iso)}" data-rel>${esc(relTime(iso))}</time> · <span>${esc(fmtDate(iso).replace(/, \d{4}$/, ''))}</span>` : '';

/** The lead story. Leaderboard (3 rows) and the played counter are filled in by the page script. */
export function leadStory(g: GameEntry | undefined): string {
  if (!g) {
    return `<article class="lead-story">
  <p class="kicker">Coming soon</p>
  <h1 class="serif">First game coming soon.</h1>
  <p class="dek">Something happened. Everyone is talking about it. We are building the game.</p>
</article>`;
  }
  const date = gameDate(g);
  const cover = coverUrl(g);
  return `<article class="lead-story" data-slug="${attr(g.slug)}">
  <p class="kicker">${g.status === 'archived' ? 'From the archive' : 'New game'}</p>
  <h1 class="serif">${esc(headlineOf(g))} <span class="made">We made it a game.</span></h1>
  <p class="dek" dir="auto">${esc(g.tagline)}</p>
  <p class="byline"><b>By Too Soon Games</b> · ${timeMeta(date)} · ${esc(g.region || regionOf(g.audience))}</p>
  ${cover ? `<figure class="lead-fig${g.clip ? ' has-clip' : ''}"${g.clip ? ` data-clip="${attr(`/${g.slug}/${g.clip.replace(/^\/+/, '')}`)}"` : ''}><a href="${attr(gameUrl(g))}" tabindex="-1" aria-hidden="true"><img src="${attr(cover)}" alt="" width="1200" height="900" fetchpriority="high">${g.clip ? '<span class="live-badge">Live demo</span>' : ''}</a>
    <figcaption>The game: <span dir="auto">${esc(g.title)}</span><span class="players" data-count="${attr(g.slug)}" data-min="1" hidden> · <b></b> games played so far</span></figcaption></figure>` : `<p class="caption">The game: <span dir="auto">${esc(g.title)}</span><span class="players" data-count="${attr(g.slug)}" data-min="1" hidden> · <b></b> games played so far</span></p>`}
  <a class="btn btn-play" href="${attr(gameUrl(g))}">${icons.play} Play the game</a>
  <section class="board" id="board" data-slug="${attr(g.slug)}" hidden aria-labelledby="board-h">
    <h2 id="board-h" class="kicker-dark"><span>Live scoreboard</span><a href="${attr(gameUrl(g))}#board">Full board</a></h2>
    <ol class="board-list"></ol>
  </section>
</article>`;
}

function gameItem(g: GameEntry): string {
  const cover = coverUrl(g);
  return `<li class="item item-game${cover ? ' has-thumb' : ''}" data-slug="${attr(g.slug)}" data-date="${attr(gameDate(g))}">
  <div class="item-body">
    <p class="kicker">Game</p>
    <h3 class="serif"><a href="${attr(gameUrl(g))}">${esc(headlineOf(g))} We made it a game.</a></h3>
    <p class="item-tag" dir="auto">${esc(g.tagline)}</p>
    <p class="meta">${timeMeta(gameDate(g))} · ${esc(g.region || regionOf(g.audience))} · <span dir="auto">${esc(g.title)}</span>${g.status === 'archived' ? ' · Archive' : ''}</p>
    <a class="play-sm" href="${attr(gameUrl(g))}">${icons.play} Play</a>
  </div>
  ${cover ? `<a class="thumb" href="${attr(gameUrl(g))}" tabindex="-1" aria-hidden="true"><img src="${attr(cover)}" alt="" width="208" height="156" loading="lazy"></a>` : ''}
</li>`;
}

function eventItem(e: FeedEvent): string {
  return `<li class="item item-event" data-date="${attr(e.date)}">
  <div class="item-body">
    <p class="kicker muted-kicker">Too soon even for us</p>
    <h3 class="serif">${esc(e.text)}</h3>
    <p class="meta">${timeMeta(e.date)}</p>
  </div>
</li>`;
}

export function feedList(items: FeedItem[]): string {
  if (!items.length) return '';
  return `<section class="feed" id="latest" aria-labelledby="latest-h">
  <h2 id="latest-h" class="serif section-title">Latest</h2>
  <ul class="items">${items.map((i) => (i.kind === 'game' ? gameItem(i.game) : eventItem(i.event))).join('\n')}</ul>
</section>`;
}
