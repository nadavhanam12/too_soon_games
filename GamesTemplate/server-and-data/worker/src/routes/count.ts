import type { Ctx } from '../env';
import { cached, getGame } from '../util';

/**
 * GET /v1/games/:game/count → { players, plays, playsPublic }: distinct players who pressed start, total game starts,
 * and the number the site and the title screen show (decision 51): below 200 real plays it is a fixed number between
 * 100 and 200 derived from the slug (the same for everyone), from 200 on it is the real count.
 */
function publicPlays(slug: string, plays: number): number {
  if (plays >= 200) return plays;
  let h = 0; for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 100 + (h % 101);
}
export async function count(ctx: Ctx, game: string): Promise<Response> {
  return cached(ctx, `/count/${game}`, 60, async () => {
    const g = await getGame(ctx.env, game);
    const row = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE game_id = ?').bind(game).first<{ n: number }>();
    const plays = Number((g as unknown as { plays?: number }).plays ?? 0);
    return { players: row?.n ?? 0, plays, playsPublic: publicPlays(game, plays) };
  });
}
