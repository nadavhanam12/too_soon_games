// track(name, props): the closed event list from docs/EVENTS.md, batched to the API.
// Auto props: session id, userId, version. Flushed every 5 s / 10 events / on page hide (beacon).
import { api } from '../api/client';
import { userId } from '../storage/storage';

export const EVENT_NAMES = [
  'session_start', 'referral_start', 'game_start', 'cutscene_skip', 'stage_start', 'stage_complete', 'game_over', 'retry',
  'game_complete', 'nick_submit', 'nick_skip', 'board_view', 'share_click', 'share_complete', 'follow_click', 'source_click',
  'replay', 'error', 'session_end',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

interface Ev { name: EventName; ts: number; sessionId: string; props?: Record<string, unknown> }

const queue: Ev[] = [];
let slug = '', version = '', lang = '';
let sessionId = '';
let timer = 0;
let sessionStartedAt = 0;
let lastScreen = 'title';
let started = false;
let ch = 'direct', origin = 'direct';

/** Lower-case a-z0-9._- only, so a label is safe in a URL and accepted by the API (channelLabel). */
const clean = (s: string, max = 32): string => s.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, max);

/**
 * The visit's channel (docs/EVENTS.md): "medium:source" from UTM, "referral" for a challenge link, "ref:<host>" for
 * another site, else "direct". The origin is where the share chain started: the `o` param a challenge link carries,
 * so a friend who opens a shared link still counts toward the creator or outlet that brought the first player.
 */
function channelOf(u: URL, refHost: string): { ch: string; origin: string } {
  const p = u.searchParams;
  const src = clean(p.get('utm_source') || ''), med = clean(p.get('utm_medium') || '');
  let c: string;
  if (src || med) c = `${med || 'none'}:${src || 'none'}`;
  else if (p.has('c')) c = 'referral';
  else if (refHost && refHost !== location.host) c = `ref:${clean(refHost, 48)}`;
  else c = 'direct';
  const o = (p.get('o') || '').toLowerCase();
  return { ch: c, origin: /^[a-z0-9._:-]{1,64}$/.test(o) ? o : c };
}

/** The origin to carry in this player's share links (`o=`). */
export function shareOrigin(): string { return origin; }

function sid(): string { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

export function initAnalytics(opts: { slug: string; version: string; lang: string }): void {
  slug = opts.slug; version = opts.version; lang = opts.lang;
  sessionId = sid(); sessionStartedAt = Date.now(); started = true;
  const u = new URL(location.href);
  let ref = '';
  try { ref = document.referrer ? new URL(document.referrer).host : ''; } catch { /* ignore */ }
  ({ ch, origin } = channelOf(u, ref));
  track('session_start', {
    ref, utm_source: u.searchParams.get('utm_source') || '', utm_medium: u.searchParams.get('utm_medium') || '',
    utm_campaign: u.searchParams.get('utm_campaign') || '', utm_content: u.searchParams.get('utm_content') || '',
    lang: navigator.language, viewportW: innerWidth, viewportH: innerHeight, dpr: Math.round((devicePixelRatio || 1) * 10) / 10,
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      queue.push({ name: 'session_end', ts: Date.now(), sessionId, props: { durationS: Math.round((Date.now() - sessionStartedAt) / 1000), lastScreen } });
      flush(true);
    }
  });
  // the site's columns beside the game on desktop (frontend game-chrome.ts) have their own Follow buttons
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('.tsgc [data-network]');
    if (a) track('follow_click', { network: a.getAttribute('data-network') || '', where: 'columns' });
  });
  window.addEventListener('error', (e) => track('error', { msg: String(e.message || '').slice(0, 200), where: `${(e.filename || '').split('/').pop()}:${e.lineno}` }));
  window.addEventListener('unhandledrejection', (e) => track('error', { msg: String((e as PromiseRejectionEvent).reason || '').slice(0, 200), where: 'promise' }));
}

export function setScreen(name: string): void { lastScreen = name; }

export function track(name: EventName, props?: Record<string, unknown>): void {
  if (!started) return;
  queue.push({ name, ts: Date.now(), sessionId, props });
  if (queue.length >= 10) flush();
  else if (!timer) timer = window.setTimeout(() => flush(), 5000);
}

export function flush(beacon = false): void {
  if (timer) { clearTimeout(timer); timer = 0; }
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  const body = { userId: userId(), version, lang, ch, origin, events };
  if (beacon) api.beacon(slug, body);
  else void api.events(slug, body);
  if (queue.length) flush(beacon);
}
