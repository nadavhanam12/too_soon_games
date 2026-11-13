// The only place that calls fetch (rule 12). Every call times out and returns null on failure:
// the game never waits on the server and never breaks because of it.
import { env } from '../config';

const TIMEOUT_MS = 4000;

async function call<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  if (!env.apiBase) return null;
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
  count: (slug: string) => call<{ players: number }>('GET', `/v1/games/${slug}/count`),
  board: (slug: string, userId: string, limit = 20) => call<Board>('GET', `/v1/games/${slug}/board?limit=${limit}&userId=${encodeURIComponent(userId)}`),
  score: (slug: string, body: { userId: string; nick?: string | null; score: number; durationS: number; stage?: string; version: string }) =>
    call<ScoreResult>('POST', `/v1/games/${slug}/scores`, body),
  events: (slug: string, body: unknown) => call<Record<string, never>>('POST', `/v1/games/${slug}/events`, body),
  /** Fire-and-forget on page hide; falls back to keepalive fetch. */
  beacon(slug: string, body: unknown): void {
    if (!env.apiBase) return;
    const url = env.apiBase.replace(/\/$/, '') + `/v1/games/${slug}/events`;
    const data = JSON.stringify(body);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }))) return;
    } catch { /* fall through */ }
    try { void fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: data, keepalive: true }); } catch { /* ignore */ }
  },
};
