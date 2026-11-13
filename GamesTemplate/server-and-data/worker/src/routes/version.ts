import type { Ctx } from '../env';
import { json } from '../util';

export function version(ctx: Ctx): Response {
  return json({ version: ctx.env.VERSION, time: ctx.now });
}
