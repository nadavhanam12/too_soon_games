import type { Ctx } from '../env';
import { cached, getGame, int, json, userId as parseUserId } from '../util';

interface Row { user_id: string; nick: string | null; score: number }

/**
 * GET /v1/games/:game/board?limit=10&userId=<uuid>
 * → { top: [{rank, nick, score, isYou}], you: {rank, score, nick} | null, total }
 * Only the top list, edge-cached 10 s per (game, limit): no D1 read per request. `you` is the player's row when it is
 * in that list, else null. A rank outside the list is never counted here: the game shows the rank its score post
 * returned (POST scores), so a run costs one rank COUNT, not two. The rank COUNT is what overloads D1 under load
 * (load test 2026-11-18, SETUP-CLOUDFLARE.md). Rate-limited per IP (RL_READS, index.ts).
 */
export async function board(ctx: Ctx, game: string): Promise<Response> {
  const limit = int(ctx.url.searchParams.get('limit') ?? 10, 'limit', 1, 50);
  const uidRaw = ctx.url.searchParams.get('userId');
  const uid = uidRaw ? parseUserId(uidRaw) : null;

  const topRes = await cached(ctx, `/board/${game}/${limit}`, 10, async () => {
    const g = await getGame(ctx.env, game);
    const top = await ctx.env.DB.prepare('SELECT user_id, nick, score FROM scores WHERE game_id = ? ORDER BY score DESC, updated_at ASC LIMIT ?')
      .bind(game, limit).all<Row>();
    return {
      top: (top.results || []).map((r, i) => ({ rank: i + 1, nick: r.nick, score: r.score, userId: r.user_id })),
      total: g.scores_n,
    };
  });
  const data = (await topRes.json()) as { top: { rank: number; nick: string | null; score: number; userId: string }[]; total: number };
  const mine = uid ? data.top.find((r) => r.userId === uid) : undefined;
  return json({
    top: data.top.map(({ userId, ...r }) => ({ ...r, isYou: uid !== null && userId === uid })),
    you: mine ? { rank: mine.rank, score: mine.score, nick: mine.nick } : null,
    total: data.total,
  }, 200, { 'cache-control': 'no-store' });
}
