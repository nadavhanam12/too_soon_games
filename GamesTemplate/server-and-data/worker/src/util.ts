import type { Ctx, Env, GameRow } from './env';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message);
  }
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** Parse a JSON body with a size cap; bodies above `maxBytes` are rejected before parsing. */
export async function readJson<T = unknown>(req: Request, maxBytes = 64 * 1024): Promise<T> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'body too large', 'too_large');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'body too large', 'too_large');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'invalid JSON', 'bad_json');
  }
}

// ---------- validation helpers (no library: the shapes are tiny) ----------

const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function gameSlug(v: string | undefined): string {
  if (!v || !SLUG.test(v)) throw new HttpError(400, 'bad game id', 'bad_game');
  return v;
}

export function userId(v: unknown): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new HttpError(400, 'bad userId', 'bad_user');
  return v.toLowerCase();
}

export function int(v: unknown, name: string, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || Math.floor(n) !== n || n < min || n > max) {
    throw new HttpError(400, `bad ${name}`, `bad_${name}`);
  }
  return n;
}

export function optInt(v: unknown, name: string, min: number, max: number): number | null {
  return v === undefined || v === null ? null : int(v, name, min, max);
}

export function shortText(v: unknown, name: string, max: number): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw new HttpError(400, `bad ${name}`, `bad_${name}`);
  // strip control chars, collapse whitespace, cap length (by code points so emoji survive)
  const clean = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(clean).slice(0, max).join('');
}

// Nicknames show on a public leaderboard. Slurs and the crudest words are refused; the check runs on a folded copy
// (lower case, look-alike digits mapped to letters, everything but letters removed) so "N 1 g-g" is caught too.
// A refused nickname does not lose the score: it is saved without a name (shown as anonymous), the same as no name.
const BLOCKED = ['nigger', 'nigga', 'faggot', 'retard', 'kike', 'chink', 'tranny', 'cunt', 'whore', 'hitler', 'nazi', 'heil', 'kkk', 'pedo'];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

export function blockedNick(n: string): boolean {
  const folded = n.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c] ?? c).replace(/[^a-z]/g, '');
  return BLOCKED.some((w) => folded.includes(w));
}

/** Nickname: 1-16 visible characters, no URLs. Returns null when empty or blocked → shown as anonymous. */
export function nick(v: unknown): string | null {
  const n = shortText(v, 'nick', 16);
  if (!n) return null;
  if (/https?:|www\./i.test(n)) throw new HttpError(400, 'nick may not contain links', 'bad_nick');
  if (blockedNick(n)) return null;
  return n;
}

// ---------- request context ----------

type CfProps = { country?: string; city?: string } | undefined;

export function deviceOf(ua: string): Ctx['device'] {
  const u = ua.toLowerCase();
  if (/bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|twitterbot/.test(u)) return 'bot';
  if (/ipad|tablet|(android(?!.*mobile))/.test(u)) return 'tablet';
  if (/mobi|iphone|android/.test(u)) return 'phone';
  return 'desktop';
}

export function makeCtx(req: Request, env: Env, ec: ExecutionContext): Ctx {
  const cf = (req as Request & { cf?: CfProps }).cf;
  return {
    env,
    req,
    url: new URL(req.url),
    origin: req.headers.get('origin'),
    country: (cf?.country || '').toUpperCase(),
    city: cf?.city || '',
    device: deviceOf(req.headers.get('user-agent') || ''),
    ip: req.headers.get('cf-connecting-ip') || '0.0.0.0',
    now: new Date().toISOString(),
    waitUntil: (p) => ec.waitUntil(p),
  };
}

// ---------- test traffic ----------

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * A page served from localhost (dev server, bug check, asset tools) must not write events or scores into the live
 * data. The deployed worker refuses those writes; `wrangler dev` accepts them. The local worker is told apart by
 * LOCAL_DEV=1 in .dev.vars (read only by `wrangler dev`), not by its own URL: `wrangler dev` hands the worker the
 * route's host (api.toosoongames.app), so by its URL the local API looked live and refused every local write
 * (the smoke test and the bug check's server part went red, 2026-11-17).
 */
export function refuseLocalWrite(ctx: Ctx): void {
  if (ctx.origin && LOCAL_ORIGIN.test(ctx.origin) && ctx.env.LOCAL_DEV !== '1') {
    throw new HttpError(403, 'a localhost page cannot write to the live API (a local API needs LOCAL_DEV=1 in .dev.vars)', 'local_origin');
  }
}

// ---------- CORS ----------

export function allowedOrigin(ctx: Ctx): string | null {
  const o = ctx.origin;
  if (!o) return null;
  if (LOCAL_ORIGIN.test(o)) return o;
  const list = (ctx.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const a of list) {
    if (a === o) return o;
    // "*.pages.dev" style entries allow preview deployments
    if (a.startsWith('*.') && o.endsWith(a.slice(1)) && o.startsWith('https://')) return o;
  }
  return null;
}

export function withCors(res: Response, ctx: Ctx): Response {
  const o = allowedOrigin(ctx);
  if (!o) return res;
  const h = new Headers(res.headers);
  h.set('access-control-allow-origin', o);
  h.set('vary', 'origin');
  h.set('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  h.set('access-control-allow-headers', 'content-type,x-admin-key');
  h.set('access-control-max-age', '86400');
  return new Response(res.body, { status: res.status, headers: h });
}

// ---------- games registry ----------

export async function getGame(env: Env, gameId: string): Promise<GameRow> {
  const row = await env.DB.prepare('SELECT game_id, name, max_score, min_duration_s, scores_n, max_score_per_s FROM games WHERE game_id = ?')
    .bind(gameId)
    .first<GameRow>();
  if (!row) throw new HttpError(404, 'unknown game', 'unknown_game');
  return row;
}

/**
 * Is this a registered game? The events route asks on every batch, so the answer comes from a list of game ids kept in
 * this isolate's memory, refreshed every 5 minutes, instead of a D1 read per batch. An id missing from the list (a game
 * published a moment ago, or junk) is checked with one D1 point read. Events must keep flowing when D1 is slow or out
 * of its daily quota: that is the day the numbers matter most.
 */
let knownGames: { ids: Set<string>; at: number } | null = null;
const KNOWN_TTL_MS = 5 * 60_000;

export async function isKnownGame(env: Env, gameId: string): Promise<boolean> {
  try {
    if (!knownGames || Date.now() - knownGames.at > KNOWN_TTL_MS) {
      const rows = await env.DB.prepare('SELECT game_id FROM games').all<{ game_id: string }>();
      knownGames = { ids: new Set(rows.results.map((r) => r.game_id)), at: Date.now() };
    }
    if (knownGames.ids.has(gameId)) return true;
    const row = await env.DB.prepare('SELECT 1 AS ok FROM games WHERE game_id = ?').bind(gameId).first();
    if (row) knownGames.ids.add(gameId);
    return row !== null;
  } catch (e) {
    // D1 down or over quota (expected on a traffic spike on the free plan): accept the event (the list was checked first),
    // since a dropped event cannot be recovered and a stray slug only adds rows to AE
    console.error('known games check failed', e);
    return true;
  }
}

// ---------- edge cache for cheap GETs ----------

export async function cached(ctx: Ctx, key: string, ttlS: number, build: () => Promise<unknown>): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(`/__cache${key}`, ctx.url.origin).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return new Response(hit.body, hit);
  const data = await build();
  const res = json(data, 200, { 'cache-control': `public, max-age=${ttlS}` });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

/**
 * A player's rank for a score: 1 + the scores above it. The COUNT reads every row above, so on a big board it is the
 * most expensive query we run (D1 reads are billed and not covered by the Workers spending limit). The answer depends
 * only on (game, score), so it is edge-cached 10 s per score, like the top list: repeated board views, and many players
 * on the same score, cost one read. A board view can lag a new score above it by up to 10 s.
 * fresh: always count, and store the answer (POST scores: the rank shown right after a run is exact, and the board
 * that follows shows the same number).
 */
export async function rankOf(ctx: Ctx, game: string, score: number, fresh = false): Promise<number> {
  const cacheKey = new Request(new URL(`/__cache/rank/${game}/${score}`, ctx.url.origin).toString());
  if (!fresh) {
    const hit = await caches.default.match(cacheKey);
    if (hit) return ((await hit.json()) as { rank: number }).rank;
  }
  const above = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE game_id = ? AND score > ?').bind(game, score).first<{ n: number }>();
  const rank = (above?.n ?? 0) + 1;
  ctx.waitUntil(caches.default.put(cacheKey, json({ rank }, 200, { 'cache-control': 'public, max-age=10' })));
  return rank;
}

export async function rateLimit(rl: { limit(o: { key: string }): Promise<{ success: boolean }> } | undefined, key: string): Promise<void> {
  if (!rl) return; // binding missing locally → no limit
  const { success } = await rl.limit({ key });
  if (!success) throw new HttpError(429, 'slow down', 'rate_limited');
}
