import type { Ctx } from '../env';
import { cached, getGame } from '../util';

/** GET /v1/games/:game/count → { players } (distinct players who pressed start). Edge-cached 60s. */
export async function count(ctx: Ctx, game: string): Promise<Response> {
  return cached(ctx, `/count/${game}`, 60, async () => {
    await getGame(ctx.env, game);
    const row = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE game_id = ?').bind(game).first<{ n: number }>();
    return { players: row?.n ?? 0 };
  });
}
