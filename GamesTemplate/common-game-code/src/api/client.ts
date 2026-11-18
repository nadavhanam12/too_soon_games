// The only place that calls fetch (rule 12). Every call times out and returns null on failure:
// the game never waits on the server and never breaks because of it.
import { env } from '../config';
import { get, set } from '../storage/storage';

const TIMEOUT_MS = 4000;

/**
 * The studio's own devices: opening any game once with `?internal=1` marks this browser (per site origin), and from
 * then on it sends no events and no scores, so the owner's plays on the live site stay out of the data.
 * `?internal=0` clears the mark. Reads (counter, leaderboard) still work.
 */
function readInternal(): boolean {
  const q = new URLSearchParams(location.search).get('internal');
  if (q === '1') set('internal', '1');
  if (q === '0') set('internal', '');
  return get('internal') === '1';
}
export const internalDevice = readInternal();

async function call<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  if (!env.apiBase) return null;
  if (internalDevice && method !== 'GET') return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(env.apiBase.replace(/\/$/, '') + path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
      keepalive: method === 'POST',
    });
    if (res.status === 204) return {} as T;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface BoardRow { rank: number; nick: string | null; score: number; isYou: boolean }
export interface Board { top: BoardRow[]; you: { rank: number; score: number; nick: string | null } | null; total: number }
export interface ScoreResult { rank: number; total: number; best: number; improved: boolean }

export const api = {
  count: (slug: string) => call<{ players: number; plays?: number; playsPublic?: number }>('GET', `/v1/games/${slug}/count`),
  board: (slug: string, userId: string, limit = 10) => call<Board>('GET', `/v1/games/${slug}/board?limit=${limit}&userId=${encodeURIComponent(userId)}`),
  score: (slug: string, body: { userId: string; nick?: string | null; score: number; durationS: number; stage?: string; version: string }) =>
    call<ScoreResult>('POST', `/v1/games/${slug}/scores`, body),
  events: (slug: string, body: unknown) => call<Record<string, never>>('POST', `/v1/games/${slug}/events`, body),
  /**
   * Fire-and-forget on page hide: a keepalive fetch, which the browser finishes after the page is gone.
   * Not navigator.sendBeacon: a beacon always carries credentials, the API is another origin and answers without
   * Access-Control-Allow-Credentials, so the browser dropped every beacon at the preflight while sendBeacon returned
   * true. Until 2026-11-18 that lost session_end and whatever was still queued when the player left.
   */
  beacon(slug: string, body: unknown): void {
    if (!env.apiBase || internalDevice) return;
    const url = env.apiBase.replace(/\/$/, '') + `/v1/games/${slug}/events`;
    // the request may be refused while the page is closing (offline, quota of pending keepalive bytes): analytics
    // never breaks the game, and there is nobody left to retry for
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => { /* see above */ });
  },
};
