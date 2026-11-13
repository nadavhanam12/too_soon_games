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

/** Nickname: 1-16 visible characters, no URLs. Returns null when empty → shown as anonymous. */
export function nick(v: unknown): string | null {
  const n = shortText(v, 'nick', 16);
  if (!n) return null;
  if (/https?:|www\./i.test(n)) throw new HttpError(400, 'nick may not contain links', 'bad_nick');
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

// ---------- CORS ----------

export function allowedOrigin(ctx: Ctx): string | null {
  const o = ctx.origin;
  if (!o) return null;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o;
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
  const row = await env.DB.prepare('SELECT game_id, name, max_score, min_duration_s FROM games WHERE game_id = ?')
    .bind(gameId)
    .first<GameRow>();
  if (!row) throw new HttpError(404, 'unknown game', 'unknown_game');
  return row;
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

export async function rateLimit(rl: { limit(o: { key: string }): Promise<{ success: boolean }> } | undefined, key: string): Promise<void> {
  if (!rl) return; // binding missing locally → no limit
  const { success } = await rl.limit({ key });
  if (!success) throw new HttpError(429, 'slow down', 'rate_limited');
}
