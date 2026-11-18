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
  // GET /v1/admin/emails: the sign-up list (the card on the home page), for "a new game is out" mails
  if (parts[0] === 'emails' && parts.length === 1 && method === 'GET') return listEmails(ctx);
  if (parts[0] === 'games' && parts[1]) {
    const game = gameSlug(parts[1]);
    const leaf = parts[2];
    if (!leaf && method === 'PUT') return upsertGame(ctx, game);
    if (!leaf && method === 'DELETE') return deleteGame(ctx, game);
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

// ---------- sign-ups ----------

/**
 * Every account that has an email, newest first. `verified` = the address came from Google / Apple; a typed one may
 * be mistyped or someone else's. Mail only rows with notify = 1, and put each row's unsubscribe link in the mail:
 * https://api.toosoongames.app/v1/unsubscribe?t=<unsub_token>.
 */
async function listEmails(ctx: Ctx): Promise<Response> {
  const rows = await ctx.env.DB.prepare(
    `SELECT email, provider, email_verified AS verified, notify, country, created_at, unsub_token FROM accounts
     WHERE email IS NOT NULL ORDER BY created_at DESC`,
  ).all();
  return json({ rows: rows.results || [] });
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

interface GameBody { name?: unknown; maxScore?: unknown; minDurationS?: unknown; maxScorePerS?: unknown }

/** PUT /v1/admin/games/:game { name, maxScore, minDurationS, maxScorePerS? } — called by /publish-game. Idempotent. */
async function upsertGame(ctx: Ctx, game: string): Promise<Response> {
  const b = await readJson<GameBody>(ctx.req, 4096);
  const name = shortText(b.name, 'name', 80);
  if (!name) throw new HttpError(400, 'name required', 'bad_name');
  const maxScore = int(b.maxScore, 'maxScore', 1, 2_000_000_000);
  const minDurationS = int(b.minDurationS ?? 0, 'minDurationS', 0, 86_400);
  const r = b.maxScorePerS;
  if (r !== undefined && r !== null && !(typeof r === 'number' && Number.isFinite(r) && r > 0)) throw new HttpError(400, 'bad maxScorePerS', 'bad_maxScorePerS');
  const maxScorePerS = typeof r === 'number' ? r : null;
  await ctx.env.DB.prepare(
    `INSERT INTO games (game_id, name, max_score, min_duration_s, max_score_per_s, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
     ON CONFLICT(game_id) DO UPDATE SET name = excluded.name, max_score = excluded.max_score, min_duration_s = excluded.min_duration_s,
       max_score_per_s = excluded.max_score_per_s, updated_at = excluded.updated_at`,
  ).bind(game, name, maxScore, minDurationS, maxScorePerS, ctx.now).run();
  return json({ ok: true, game: { game_id: game, name, max_score: maxScore, min_duration_s: minDurationS, max_score_per_s: maxScorePerS } });
}

/** DELETE /v1/admin/games/:game — removes the game with its players and scores (the smoke test's throwaway game, a
 *  slug that was renamed). Analytics Engine events cannot be deleted; they age out on their own. */
async function deleteGame(ctx: Ctx, game: string): Promise<Response> {
  const [scores, players, games] = await ctx.env.DB.batch([
    ctx.env.DB.prepare('DELETE FROM scores WHERE game_id = ?').bind(game),
    ctx.env.DB.prepare('DELETE FROM players WHERE game_id = ?').bind(game),
    ctx.env.DB.prepare('DELETE FROM games WHERE game_id = ?').bind(game),
  ]);
  if (!games?.meta.changes) throw new HttpError(404, 'unknown game', 'unknown_game');
  await bustBoard(ctx, game);
  return json({ ok: true, deleted: { scores: scores?.meta.changes ?? 0, players: players?.meta.changes ?? 0 } });
}

/** Drop the cached board (all common limits) and player count of a game; awaited so the next GET already sees the change. */
async function bustBoard(ctx: Ctx, game: string): Promise<void> {
  const keys = [`/count/${game}`, ...[10, 20, 50].map((l) => `/board/${game}/${l}`)];
  await Promise.all(keys.map((k) => caches.default.delete(new Request(new URL(`/__cache${k}`, ctx.url.origin).toString()))));
}

async function adminBoard(ctx: Ctx, game: string): Promise<Response> {
  const limit = int(ctx.url.searchParams.get('limit') ?? 50, 'limit', 1, 200);
  const rows = await ctx.env.DB.prepare(
    'SELECT user_id, nick, score, duration_s, stage, version, country, updated_at FROM scores WHERE game_id = ? ORDER BY score DESC, updated_at ASC LIMIT ?',
  ).bind(game, limit).all();
  return json({ rows: rows.results || [] });
}

async function deleteScore(ctx: Ctx, game: string, uid: string): Promise<Response> {
  const [r] = await ctx.env.DB.batch([
    ctx.env.DB.prepare('DELETE FROM scores WHERE game_id = ? AND user_id = ?').bind(game, uid),
    // keep games.scores_n (migrations/0004) equal to the row count: subtract what the delete removed
    ctx.env.DB.prepare('UPDATE games SET scores_n = (SELECT COUNT(*) FROM scores WHERE game_id = ?1) WHERE game_id = ?1').bind(game),
  ]);
  await bustBoard(ctx, game);
  return json({ ok: true, deleted: r?.meta.changes ?? 0 });
}

// ---------- stats (D1 + Analytics Engine) ----------

async function stats(ctx: Ctx, game: string): Promise<Response> {
  const days = int(ctx.url.searchParams.get('days') ?? 7, 'days', 1, 90);
  // ?hours=N narrows the analytics to the last N hours (the launch gates: T0+6, T0+24); D1 numbers stay per `days`
  const hoursRaw = ctx.url.searchParams.get('hours');
  const hours = hoursRaw === null ? null : int(hoursRaw, 'hours', 1, 2160);
  const [players, scores, since] = await Promise.all([
    ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE game_id = ?').bind(game).first<{ n: number }>(),
    ctx.env.DB.prepare('SELECT COUNT(*) AS n, MAX(score) AS best, AVG(score) AS avg FROM scores WHERE game_id = ?').bind(game).first<{ n: number; best: number | null; avg: number | null }>(),
    ctx.env.DB.prepare(`SELECT COUNT(*) AS n FROM players WHERE game_id = ? AND first_at >= datetime('now', ?)`).bind(game, `-${days} days`).first<{ n: number }>(),
  ]);
  const d1 = { players: players?.n ?? 0, playersInRange: since?.n ?? 0, scores: scores?.n ?? 0, bestScore: scores?.best ?? null, avgScore: scores?.avg ? Math.round(scores.avg) : null };

  let ae: Record<string, unknown> | { error: string };
  try {
    ae = game === 'site' ? await siteStats(ctx, days, hours) : await aeStats(ctx, game, days, hours);
  } catch (e) {
    ae = { error: (e as Error).message };
  }
  return json({ game, days, hours, d1, ae });
}

/** The analytics filter: the time window, without the test users that were cleaned out of D1 (migrations/0003). */
async function windowSql(ctx: Ctx, days: number, hours: number | null): Promise<string> {
  // their events stay in Analytics Engine, so leave them out here
  const ex = await ctx.env.DB.prepare('SELECT user_id FROM excluded_users').all<{ user_id: string }>();
  const notExcluded = ex.results.length ? ` AND blob3 NOT IN (${ex.results.map((r) => sqlStr(r.user_id)).join(',')})` : '';
  return `timestamp > NOW() - INTERVAL '${hours ?? days}' ${hours ? 'HOUR' : 'DAY'}${notExcluded}`;
}

/**
 * The studio site (game id "site", docs/EVENTS.md): its own pages, not the games. Visits and where they came from,
 * the pages, which games the site sends players to (game_click) and which games send them back (page_view `from`),
 * bounce, cross-play (one player, two games or more) and returning visitors (across the site and every game).
 */
async function siteStats(ctx: Ctx, days: number, hours: number | null): Promise<Record<string, unknown>> {
  const ds = ctx.env.EVENTS_DATASET;
  const win = await windowSql(ctx, days, hours);
  const where = `index1 = 'site' AND ${win}`;
  const q = (sql: string) => querySql(ctx, sql).then((r) => r.data);
  const [byName, daily, countries, devices, channelRows, landing, pages, toGames, toWhere, fromGames, follows, shares, sessionsPv, sessionsGc, uniques, crossRows, dayRows] = await Promise.all([
    q(`SELECT blob2 AS name, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} GROUP BY name ORDER BY n DESC`),
    q(`SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'session_start' GROUP BY day ORDER BY day`),
    q(`SELECT blob5 AS country, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'session_start' GROUP BY country ORDER BY n DESC LIMIT 12`),
    q(`SELECT blob7 AS device, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'session_start' GROUP BY device ORDER BY n DESC`),
    q(`SELECT blob11 AS ch, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'session_start' GROUP BY ch ORDER BY n DESC`),
    q(`SELECT blob9 AS page, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'session_start' GROUP BY page ORDER BY n DESC LIMIT 12`),
    q(`SELECT blob9 AS page, SUM(_sample_interval) AS n, COUNT(DISTINCT blob4) AS visits FROM ${ds} WHERE ${where} AND blob2 = 'page_view' GROUP BY page ORDER BY n DESC LIMIT 20`),
    q(`SELECT blob9 AS game, SUM(_sample_interval) AS n, COUNT(DISTINCT blob4) AS visits FROM ${ds} WHERE ${where} AND blob2 = 'game_click' GROUP BY game ORDER BY n DESC`),
    q(`SELECT blob13 AS place, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'game_click' GROUP BY place ORDER BY n DESC`),
    q(`SELECT blob13 AS src, SUM(_sample_interval) AS n, COUNT(DISTINCT blob4) AS visits FROM ${ds} WHERE ${where} AND blob2 = 'page_view' AND blob13 != '' GROUP BY src ORDER BY n DESC`),
    q(`SELECT blob9 AS network, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'follow_click' GROUP BY network ORDER BY n DESC`),
    q(`SELECT blob13 AS place, blob9 AS channel, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'share_click' GROUP BY place, channel ORDER BY n DESC`),
    // per visit: pages seen, and whether it opened a game (bounce = one page, no game)
    q(`SELECT blob4 AS s, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'page_view' GROUP BY s LIMIT 10000`),
    q(`SELECT blob4 AS s FROM ${ds} WHERE ${where} AND blob2 = 'game_click' GROUP BY s LIMIT 10000`),
    q(`SELECT COUNT(DISTINCT blob3) AS users, COUNT(DISTINCT blob4) AS sessions FROM ${ds} WHERE ${where} AND blob2 = 'session_start'`),
    // cross-play: games started per player, over every game (not the site)
    q(`SELECT blob3 AS u, COUNT(DISTINCT blob1) AS g FROM ${ds} WHERE ${win} AND index1 != 'site' AND blob2 = 'game_start' GROUP BY u LIMIT 10000`),
    // returning: the days a person showed up, on the site or in any game
    q(`SELECT blob3 AS u, toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day FROM ${ds} WHERE ${win} AND blob2 = 'session_start' GROUP BY u, day LIMIT 20000`),
  ]);
  const counts: Record<string, number> = {};
  for (const r of byName) counts[String(r['name'])] = Number(r['n']);
  const clicked = new Set(sessionsGc.map((r) => String(r['s'])));
  const tracked = sessionsPv.length; // visits since page_view exists (older visits have only session_start)
  const bounced = sessionsPv.filter((r) => Number(r['n']) <= 1 && !clicked.has(String(r['s']))).length;
  const games = crossRows.map((r) => Number(r['g']));
  const daysPer: Record<string, number> = {};
  for (const r of dayRows) { const u = String(r['u']); daysPer[u] = (daysPer[u] ?? 0) + 1; }
  const people = Object.values(daysPer);
  return {
    site: true,
    counts, daily, countries, devices, landing, pages, toGames, toWhere, follows, shares,
    channels: channelRows,
    // "<game>:<button>" from the page_view `from` prop
    fromGames: fromGames.map((r) => { const [g, via] = String(r['src']).split(':'); return { game: g, via: via || '', n: Number(r['n']), visits: Number(r['visits']) }; }),
    uniques: uniques[0] ?? null,
    visits: { tracked, openedGame: [...clicked].length, bounced },
    crossPlay: { players: games.length, two: games.filter((g) => g === 2).length, threePlus: games.filter((g) => g >= 3).length },
    returning: { people: people.length, returned: people.filter((d) => d >= 2).length },
  };
}

async function aeStats(ctx: Ctx, game: string, days: number, hours: number | null): Promise<Record<string, unknown>> {
  const ds = ctx.env.EVENTS_DATASET;
  const where = `index1 = ${sqlStr(game)} AND ${await windowSql(ctx, days, hours)}`;
  const q = (sql: string) => querySql(ctx, sql).then((r) => r.data);
  const [byName, daily, countries, cities, devices, share, overByStage, referrals, follows, errors, uniques, channelRows, originRows, startedRows, endedRows] = await Promise.all([
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
    q(`SELECT blob11 AS ch, blob2 AS name, COUNT(DISTINCT blob4) AS visits, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 IN ('session_start','game_start','game_complete','game_over','share_click') GROUP BY ch, name`),
    q(`SELECT blob12 AS origin, SUM(_sample_interval) AS n FROM ${ds} WHERE ${where} AND blob2 = 'referral_start' GROUP BY origin`),
    // per visit, not per event: "replay" starts a new run without a new game_start, so event counts overstate run ends
    q(`SELECT COUNT(DISTINCT blob4) AS n FROM ${ds} WHERE ${where} AND blob2 = 'game_start'`),
    q(`SELECT COUNT(DISTINCT blob4) AS n FROM ${ds} WHERE ${where} AND blob2 IN ('game_complete','game_over')`),
  ]);
  const counts: Record<string, number> = {};
  for (const r of byName) counts[String(r['name'])] = Number(r['n']);
  // The funnel counts visits (sessions): started = visits with a game_start, finished = visits that ended at least one run,
  // a win OR a loss (endless games only send game_over). docs/EVENTS.md
  counts['visits_started'] = Number(startedRows[0]?.['n'] ?? 0);
  counts['run_end'] = Number(endedRows[0]?.['n'] ?? 0);
  const funnel = ['session_start', 'visits_started', 'run_end', 'share_click', 'referral_start'].map((name) => ({ name, n: counts[name] ?? 0 }));
  // per channel: visits, starts, run ends, share clicks, and the referral starts whose share chain began there
  type ChRow = { visits: number; starts: number; runEnds: number; shareClicks: number; referrals: number };
  const channels: Record<string, ChRow> = {};
  const row = (k: string): ChRow => (channels[k || '(none)'] ??= { visits: 0, starts: 0, runEnds: 0, shareClicks: 0, referrals: 0 });
  // starts and run ends per visit (like the funnel), visits and share clicks as event counts. A visit that both won and
  // lost counts twice in runEnds: rare (a win ends the game) and only in games with a win
  const key: Record<string, [keyof ChRow, 'visits' | 'n']> = { session_start: ['visits', 'n'], game_start: ['starts', 'visits'], game_complete: ['runEnds', 'visits'], game_over: ['runEnds', 'visits'], share_click: ['shareClicks', 'n'] };
  for (const r of channelRows) { const k = key[String(r['name'])]; if (k) row(String(r['ch'] ?? ''))[k[0]] += Number(r[k[1]]); }
  for (const r of originRows) row(String(r['origin'] ?? '')).referrals += Number(r['n']);
  return { counts, funnel, channels, daily, countries, cities, devices, share, overByStage, referrals, follows, errors, uniques: uniques[0] ?? null };
}
