import type { Ctx } from '../env';
import { cached, getGame, int, json, userId as parseUserId } from '../util';

interface Row { user_id: string; nick: string | null; score: number }

/**
 * GET /v1/games/:game/board?limit=20&userId=<uuid>
 * → { top: [{rank, nick, score, isYou}], you: {rank, score, nick} | null, total }
 * The top list is edge-cached 10s per (game, limit); the player's own row is a cheap extra query.
 */
export async function board(ctx: Ctx, game: string): Promise<Response> {
  const limit = int(ctx.url.searchParams.get('limit') ?? 20, 'limit', 1, 50);
  const uidRaw = ctx.url.searchParams.get('userId');
  const uid = uidRaw ? parseUserId(uidRaw) : null;

  const topRes = await cached(ctx, `/board/${game}/${limit}`, 10, async () => {
    await getGame(ctx.env, game);
    const [top, total] = await Promise.all([
      ctx.env.DB.prepare('SELECT user_id, nick, score FROM scores WHERE game_id = ? ORDER BY score DESC, updated_at ASC LIMIT ?')
        .bind(game, limit).all<Row>(),
      ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE game_id = ?').bind(game).first<{ n: number }>(),
    ]);
    return {
      top: (top.results || []).map((r, i) => ({ rank: i + 1, nick: r.nick, score: r.score, userId: r.user_id })),
      total: total?.n ?? 0,
    };
  });
  const data = (await topRes.json()) as { top: { rank: number; nick: string | null; score: number; userId: string }[]; total: number };

  let you: { rank: number; score: number; nick: string | null } | null = null;
  if (uid) {
    const mine = await ctx.env.DB.prepare('SELECT nick, score FROM scores WHERE game_id = ? AND user_id = ?').bind(game, uid).first<Row>();
    if (mine) {
      const above = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE game_id = ? AND score > ?').bind(game, mine.score).first<{ n: number }>();
      you = { rank: (above?.n ?? 0) + 1, score: mine.score, nick: mine.nick };
    }
  }
  return json({
    top: data.top.map(({ userId, ...r }) => ({ ...r, isYou: uid !== null && userId === uid })),
    you,
    total: data.total,
  }, 200, { 'cache-control': 'no-store' });
}
