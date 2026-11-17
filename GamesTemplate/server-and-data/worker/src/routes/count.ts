import type { Ctx } from '../env';
import { cached, getGame } from '../util';

/**
 * GET /v1/games/:game/count → { players, plays, playsPublic }: distinct players who pressed start, total game starts,
 * and the number the site and the title screen show (decision 77, replaces 51): the real count from PUBLIC_MIN_PLAYS
 * on, 0 below it. 0 means "show nothing": a low number is not shown and never replaced by a made-up one.
 */
const PUBLIC_MIN_PLAYS = 100;
const publicPlays = (plays: number): number => (plays >= PUBLIC_MIN_PLAYS ? plays : 0);
export async function count(ctx: Ctx, game: string): Promise<Response> {
  return cached(ctx, `/count/${game}`, 60, async () => {
    await getGame(ctx.env, game);   // 404 for an unknown game
    // plays is read here: getGame does not select it (until 2026-11-17 this route read it from getGame's row and always got 0)
    const [row, g] = await Promise.all([
      ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE game_id = ?').bind(game).first<{ n: number }>(),
      ctx.env.DB.prepare('SELECT plays FROM games WHERE game_id = ?').bind(game).first<{ plays: number }>(),
    ]);
    const plays = g?.plays ?? 0;
    return { players: row?.n ?? 0, plays, playsPublic: publicPlays(plays) };
  });
}
