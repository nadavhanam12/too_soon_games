import type { GameEntry, FeedEvent } from '../types';
import { esc, attr, shortTime, regionOf } from './html';
import { icons } from './icons';

export const gameUrl = (g: GameEntry) => `/${g.slug}/`;
/** A game's media file (cover, clip) as a site URL. The game's version rides along as `?v=`: these files keep their
 *  name between releases and are cached for hours, so without it a returning visitor saw the old clip after a
 *  publish (Nadav, 2026-11-17). games.json changes the version on every publish. */
const mediaUrl = (g: GameEntry, file: string): string => `/${g.slug}/${file.replace(/^\/+/, '')}${g.version ? `?v=${encodeURIComponent(g.version)}` : ''}`;
export const coverUrl = (g: GameEntry) => (g.cover ? mediaUrl(g, g.cover) : '');

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

/** The studio as the author of every post. The handle is derived from the name (no networks are linked yet). */
export const studioHandle = (name: string) => '@' + name.toLowerCase().replace(/[^a-z0-9]/g, '');

function author(name: string, iso: string): string {
  return `<div class="phead"><b>${esc(name)}</b><span class="badge" title="Studio">${icons.pad}</span><span class="handle">${esc(studioHandle(name))}${iso ? ` · <time datetime="${attr(iso)}" data-rel>${esc(shortTime(iso))}</time>` : ''}</span></div>`;
}
const avatar = `<span class="av" aria-hidden="true"><img src="/assets/logo.png" alt="" width="360" height="352" loading="lazy"></span>`;

/** One game as a timeline post. The pinned one (the lead game) also carries the live demo clip and the 3-row scoreboard. */
function gamePost(g: GameEntry, studio: string, pinned: boolean): string {
  const url = gameUrl(g);
  const cover = coverUrl(g);
  const date = gameDate(g);
  const clip = pinned && g.clip ? mediaUrl(g, g.clip) : '';
  const ctxLine = pinned ? `<p class="ctx">${icons.pin}Pinned · ${g.status === 'archived' ? 'From the archive' : 'New game'}</p>` : '';
  const H = pinned ? 'h1' : 'h2';
  const media = cover
    ? `<a class="media" href="${attr(url)}" tabindex="-1" aria-hidden="true"${clip ? ` data-clip="${attr(clip)}"` : ''}>
    <span class="frame"><img src="${attr(cover)}" alt="" width="1200" height="900"${pinned ? ' fetchpriority="high"' : ' loading="lazy"'}>${clip ? '<span class="live-badge">Live demo</span>' : ''}</span>
    <span class="card-foot"><span><small>${g.lang === 'he' ? 'In Hebrew' : 'Web game'} · ${esc(g.region || regionOf(g.audience))}</small><b dir="auto">${esc(g.title)}</b></span><span class="play-pill">${icons.play}Play</span></span>
  </a>`
    : '';
  const board = pinned
    ? `<section class="board is-loading" id="board" data-slug="${attr(g.slug)}" aria-labelledby="board-h" aria-busy="true">
    <h3 id="board-h"><span>Live scoreboard</span><a href="${attr(url)}#board">Full board</a></h3>
    <ol class="board-list"><li class="sk"><span></span><span></span><span></span></li><li class="sk"><span></span><span></span><span></span></li><li class="sk"><span></span><span></span><span></span></li></ol>
  </section>`
    : '';
  return `<article class="post is-link${pinned ? ' pinned' : ''}" data-kind="game" data-slug="${attr(g.slug)}" data-date="${attr(date)}">
  ${avatar}
  <div class="pbody">
  ${ctxLine}
  ${author(studio, date)}
  <${H} class="ptext"><a class="stretch" href="${attr(url)}">${esc(headlineOf(g))} <span class="made">We made it a game.</span></a></${H}>
  <p class="psub" dir="auto">${esc(g.tagline)}</p>
  ${media}
  ${board}
  <div class="actions">
    <a class="act play" href="${attr(url)}">${icons.play}<span class="lbl">Play</span></a>
    <a class="act scores" href="${attr(url)}#board">${icons.trophy}<span>Scores</span></a>
    <span class="act plays" data-count="${attr(g.slug)}" data-min="${attr(g.showPlayerCountFrom ?? 1)}" title="Games played" hidden>${icons.eye}<b></b><span class="sr"> games played</span></span>
    <button class="act share" type="button" data-url="${attr(url)}" data-title="${attr(g.title)}">${icons.share}<span>Share</span></button>
  </div>
  </div>
</article>`;
}

function eventPost(e: FeedEvent, studio: string): string {
  return `<article class="post event" data-kind="event" data-date="${attr(e.date)}">
  ${avatar}
  <div class="pbody">
  ${author(studio, e.date)}
  <h2 class="ptext">${esc(e.text)}</h2>
  <span class="label">Too soon even for us</span>
  </div>
</article>`;
}

/** The home timeline: the lead game pinned on top, then everything else newest first. */
export function timeline(lead: GameEntry | undefined, items: FeedItem[], studio: string): string {
  const pinned = lead
    ? gamePost(lead, studio, true)
    : `<article class="post pinned" data-kind="game">${avatar}<div class="pbody">${author(studio, '')}<h1 class="ptext">First game coming soon.</h1><p class="psub">Something happened. Everyone is talking about it. We are building the game.</p></div></article>`;
  return `<div id="feed">
${pinned}
${items.map((i) => (i.kind === 'game' ? gamePost(i.game, studio, false) : eventPost(i.event, studio))).join('\n')}
</div>
<p class="empty" id="feed-empty" hidden>Nothing here yet.</p>`;
}
