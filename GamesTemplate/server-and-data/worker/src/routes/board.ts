import type { Ctx } from '../env';
import { cached, getGame, int, json, rankOf, userId as parseUserId } from '../util';

interface Row { user_id: string; nick: string | null; score: number }

/**
 * GET /v1/games/:game/board?limit=20&userId=<uuid>
 * → { top: [{rank, nick, score, isYou}], you: {rank, score, nick} | null, total }
 * The top list is edge-cached 10s per (game, limit); the player's own row is a point read, and the rank is cached per
 * score (util.rankOf). Rate-limited per IP (RL_READS, index.ts).
 */
export async function board(ctx: Ctx, game: string): Promise<Response> {
  const limit = int(ctx.url.searchParams.get('limit') ?? 20, 'limit', 1, 50);
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

  let you: { rank: number; score: number; nick: string | null } | null = null;
  if (uid) {
    const mine = await ctx.env.DB.prepare('SELECT nick, score FROM scores WHERE game_id = ? AND user_id = ?').bind(game, uid).first<Row>();
    if (mine) {
      // in the top list: its rank (same cache age as the list, so the two never disagree); else the per-score cache
      const inTop = data.top.find((r) => r.userId === uid);
      you = { rank: inTop ? inTop.rank : await rankOf(ctx, game, mine.score), score: mine.score, nick: mine.nick };
    }
  }
  return json({
    top: data.top.map(({ userId, ...r }) => ({ ...r, isYou: uid !== null && userId === uid })),
    you,
    total: data.total,
  }, 200, { 'cache-control': 'no-store' });
}
