import type { Ctx } from '../env';
import { HttpError, getGame, int, json, nick as parseNick, optInt, rateLimit, readJson, shortText, userId as parseUserId } from '../util';

interface Body { userId?: unknown; nick?: unknown; score?: unknown; durationS?: unknown; stage?: unknown; version?: unknown }

/**
 * POST /v1/games/:game/scores  { userId, nick?, score, durationS, stage?, version }
 * → { rank, total, best, improved }
 * Keeps the best score per player. Minimal anti-cheat (decision 9): score ≤ max_score, durationS ≥ min_duration_s.
 */
export async function postScore(ctx: Ctx, game: string): Promise<Response> {
  await rateLimit(ctx.env.RL_SCORES, `scores:${ctx.ip}`);
  const b = await readJson<Body>(ctx.req, 4096);
  const uid = parseUserId(b.userId);
  const g = await getGame(ctx.env, game);
  const score = int(b.score, 'score', 0, 2_000_000_000);
  const durationS = optInt(b.durationS, 'durationS', 0, 86_400);
  const nick = parseNick(b.nick);
  const stage = shortText(b.stage, 'stage', 32);
  const version = shortText(b.version, 'version', 32) ?? '';

  if (score > g.max_score) throw new HttpError(422, 'score above the game maximum', 'score_too_high');
  if (g.min_duration_s > 0 && (durationS === null || durationS < g.min_duration_s)) {
    throw new HttpError(422, 'play time too short', 'too_fast');
  }

  const prev = await ctx.env.DB.prepare('SELECT score FROM scores WHERE game_id = ? AND user_id = ?').bind(game, uid).first<{ score: number }>();
  const improved = !prev || score > prev.score;
  const best = improved ? score : prev!.score;

  const stmts: D1PreparedStatement[] = [];
  if (improved) {
    stmts.push(ctx.env.DB.prepare(
      `INSERT INTO scores (game_id, user_id, nick, score, duration_s, stage, version, country, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
       ON CONFLICT(game_id, user_id) DO UPDATE SET
         score = excluded.score, duration_s = excluded.duration_s, stage = excluded.stage, version = excluded.version,
         nick = COALESCE(excluded.nick, scores.nick), country = excluded.country, updated_at = excluded.updated_at`,
    ).bind(game, uid, nick, score, durationS, stage, version, ctx.country, ctx.now));
  } else if (nick) {
    // not a better score, but the player (re)named themselves
    stmts.push(ctx.env.DB.prepare('UPDATE scores SET nick = ?, updated_at = ? WHERE game_id = ? AND user_id = ?').bind(nick, ctx.now, game, uid));
  }
  // remember the nickname on the user for the next game; make sure the user exists
  stmts.push(ctx.env.DB.prepare(
    `INSERT INTO users (user_id, created_at, last_seen, first_game, country, city, device, nick)
     VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen, nick = COALESCE(excluded.nick, users.nick)`,
  ).bind(uid, ctx.now, game, ctx.country, ctx.city, ctx.device, nick));
  stmts.push(ctx.env.DB.prepare('INSERT OR IGNORE INTO players (game_id, user_id, first_at) VALUES (?, ?, ?)').bind(game, uid, ctx.now));
  await ctx.env.DB.batch(stmts);

  const [above, total] = await Promise.all([
    ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE game_id = ? AND score > ?').bind(game, best).first<{ n: number }>(),
    ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE game_id = ?').bind(game).first<{ n: number }>(),
  ]);
  return json({ rank: (above?.n ?? 0) + 1, total: total?.n ?? 0, best, improved });
}
