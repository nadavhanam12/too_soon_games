// Admin: the dashboard page (/admin) and its JSON API (/v1/admin/*), protected by ADMIN_KEY.
import type { Ctx } from '../env';
import { querySql, sqlStr } from '../analytics';
import { HttpError, gameSlug, int, json, rateLimit, readJson, shortText, userId as parseUserId } from '../util';
import adminHtml from '../admin.html';

export async function admin(ctx: Ctx, parts: string[]): Promise<Response> {
  const { method } = ctx.req;
  // GET /admin → the page itself (it asks for the key and sends it as a header)
  if (parts.length === 0 && method === 'GET') {
    return new Response(adminHtml, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
  }
  await requireAdmin(ctx);

  // GET /v1/admin/games
  if (parts[0] === 'games' && parts.length === 1 && method === 'GET') return listGames(ctx);
  if (parts[0] === 'games' && parts[1]) {
    const game = gameSlug(parts[1]);
    const leaf = parts[2];
    if (!leaf && method === 'PUT') return upsertGame(ctx, game);
    if (leaf === 'stats' && method === 'GET') return stats(ctx, game);
    if (leaf === 'board' && method === 'GET') return adminBoard(ctx, game);
    if (leaf === 'scores' && parts[3] && method === 'DELETE') return deleteScore(ctx, game, parseUserId(parts[3]));
  }
  throw new HttpError(404, 'not found', 'not_found');
}

async function requireAdmin(ctx: Ctx): Promise<void> {
  const key = ctx.env.ADMIN_KEY;
  if (!key) throw new HttpError(503, 'ADMIN_KEY not configured', 'no_admin_key');
  const given = ctx.req.headers.get('x-admin-key') || '';
  if (!timingSafeEqual(given, key)) {
    await rateLimit(ctx.env.RL_ADMIN, `admin:${ctx.ip}`); // only failed attempts count against the limit
    throw new HttpError(401, 'bad admin key', 'unauthorized');
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// ---------- games ----------

async function listGames(ctx: Ctx): Promise<Response> {
  const rows = await ctx.env.DB.prepare(
    `SELECT g.game_id, g.name, g.max_score, g.min_duration_s, g.created_at,
            (SELECT COUNT(*) FROM players p WHERE p.game_id = g.game_id) AS players,
            (SELECT COUNT(*) FROM scores s WHERE s.game_id = g.game_id) AS scores
     FROM games g ORDER BY g.created_at DESC`,
  ).all();
  return json({ games: rows.results || [] });
}

interface GameBody { name?: unknown; maxScore?: unknown; minDurationS?: unknown }

/** PUT /v1/admin/games/:game { name, maxScore, minDurationS } — called by /publish-game. Idempotent. */
async function upsertGame(ctx: Ctx, game: string): Promise<Response> {
  const b = await readJson<GameBody>(ctx.req, 4096);
  const name = shortText(b.name, 'name', 80);
  if (!name) throw new HttpError(400, 'name required', 'bad_name');
  const maxScore = int(b.maxScore, 'maxScore', 1, 2_000_000_000);
  const minDurationS = int(b.minDurationS ?? 0, 'minDurationS', 0, 86_400);
  await ctx.env.DB.prepare(
    `INSERT INTO games (game_id, name, max_score, min_duration_s, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT(game_id) DO UPDATE SET name = excluded.name, max_score = excluded.max_score, min_duration_s = excluded.min_duration_s, updated_at = excluded.updated_at`,
  ).bind(game, name, maxScore, minDurationS, ctx.now).run();
  return json({ ok: true, game: { game_id: game, name, max_score: maxScore, min_duration_s: minDurationS } });
}

async function adminBoard(ctx: Ctx, game: string): Promise<Response> {
  const limit = int(ctx.url.searchParams.get('limit') ?? 50, 'limit', 1, 200);
  const rows = await ctx.env.DB.prepare(
    'SELECT user_id, nick, score, duration_s, stage, version, country, updated_at FROM scores WHERE game_id = ? ORDER BY score DESC, updated_at ASC LIMIT ?',
  ).bind(game, limit).all();
  return json({ rows: rows.results || [] });
}

async function deleteScore(ctx: Ctx, game: string, uid: string): Promise<Response> {
  const r = await ctx.env.DB.prepare('DELETE FROM scores WHERE game_id = ? AND user_id = ?').bind(game, uid).run();
  // bust the cached board for this game (all common limits); awaited so the next GET already sees the change
  await Promise.all([10, 20, 50].map((l) => caches.default.delete(new Request(new URL(`/__cache/board/${game}/${l}`, ctx.url.origin).toString()))));
  return json({ ok: true, deleted: r.meta.changes ?? 0 });
}

// ---------- stats (D1 + Analytics Engine) ----------

async function stats(ctx: Ctx, game: string): Promise<Response> {
  const days = int(ctx.url.searchParams.get('days') ?? 7, 'days', 1, 90);
  const [players, scores, since] = await Promise.all([
    ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE game_id = ?').bind(game).first<{ n: number }>(),
    ctx.env.DB.prepare('SELECT COUNT(*) AS n, MAX(score) AS best, AVG(score) AS avg FROM scores WHERE game_id = ?').bind(game).first<{ n: number; best: number | null; avg: number | null }>(),
    ctx.env.DB.prepare(`SELECT COUNT(*) AS n FROM players WHERE game_id = ? AND first_at >= datetime('now', ?)`).bind(game, `-${days} days`).first<{ n: number }>(),
  ]);
  const d1 = { players: players?.n ?? 0, playersInRange: since?.n ?? 0, scores: scores?.n ?? 0, bestScore: scores?.best ?? null, avgScore: scores?.avg ? Math.round(scores.avg) : null };

  let ae: Record<string, unknown> | { error: string };
  try {
    ae = await aeStats(ctx, game, days);
  } catch (e) {
    ae = { error: (e as Error).message };
  }
  return json({ game, days, d1, ae });
}

async function aeStats(ctx: Ctx, game: string, days: number): Promise<Record<string, unknown>> {
  const ds = ctx.env.EVENTS_DATASET;
  const where = `index1 = ${sqlStr(game)} AND timestamp > NOW() - INTERVAL '${days}' DAY`;
  const q = (sql: string) => querySql(ctx, sql).then((r) => r.data);
  const [byName, daily, countries, cities, devices, share, overByStage, referrals, follows, errors, uniques] = await Promise.all([
    q(`SELECT blob2 AS name, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} GROUP BY name ORDER BY n DESC`),
    q(`SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'session_start' GROUP BY day ORDER BY day`),
    q(`SELECT blob5 AS country, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'session_start' GROUP BY country ORDER BY n DESC LIMIT 12`),
    q(`SELECT blob6 AS city, blob5 AS country, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'session_start' GROUP BY city, country ORDER BY n DESC LIMIT 12`),
    q(`SELECT blob7 AS device, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'session_start' GROUP BY device ORDER BY n DESC`),
    q(`SELECT blob2 AS name, blob9 AS channel, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 IN ('share_click','share_complete') GROUP BY name, channel ORDER BY n DESC`),
    q(`SELECT blob9 AS stage, SUM(_sample_interval) AS n, AVG(double1) AS avgTime FROM ${ds} WHERE ${where} AND blob2 = 'game_over' GROUP BY stage ORDER BY n DESC`),
    q(`SELECT blob9 AS fromUser, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'referral_start' GROUP BY fromUser ORDER BY n DESC LIMIT 10`),
    q(`SELECT blob9 AS network, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'follow_click' GROUP BY network ORDER BY n DESC`),
    q(`SELECT timestamp, blob10 AS props, blob7 AS device FROM ${ds} WHERE ${where} AND blob2 = 'error' ORDER BY timestamp DESC LIMIT 20`),
    q(`SELECT COUNT(DISTINCT blob3) AS users, COUNT(DISTINCT blob4) AS sessions FROM ${ds} WHERE ${where} AND blob2 = 'session_start'`),
  ]);
  const counts: Record<string, number> = {};
  for (const r of byName) counts[String(r['name'])] = Number(r['n']);
  const funnel = ['session_start', 'game_start', 'game_complete', 'share_click', 'referral_start'].map((name) => ({ name, n: counts[name] ?? 0 }));
  return { counts, funnel, daily, countries, cities, devices, share, overByStage, referrals, follows, errors, uniques: uniques[0] ?? null };
}
