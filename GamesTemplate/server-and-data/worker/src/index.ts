// Too Soon Games API. One Worker, every game. Routes in ./routes, docs in ../../docs/ARCHITECTURE.md.
import type { Env } from './env';
import { HttpError, json, makeCtx, withCors, gameSlug } from './util';
import { version } from './routes/version';
import { count } from './routes/count';
import { board } from './routes/board';
import { postScore } from './routes/scores';
import { postEvents } from './routes/events';
import { admin } from './routes/admin';

export default {
  async fetch(req: Request, env: Env, ec: ExecutionContext): Promise<Response> {
    const ctx = makeCtx(req, env, ec);
    if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), ctx);
    try {
      return withCors(await route(ctx), ctx);
    } catch (e) {
      if (e instanceof HttpError) return withCors(json({ error: e.code, message: e.message }, e.status), ctx);
      console.error('unhandled', e);
      return withCors(json({ error: 'internal', message: 'internal error' }, 500), ctx);
    }
  },
} satisfies ExportedHandler<Env>;

async function route(ctx: ReturnType<typeof makeCtx>): Promise<Response> {
  const { method } = ctx.req;
  const parts = ctx.url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ["v1","games","x","board"]

  if (parts.length === 0) return json({ ok: true, service: 'toosoon-api', docs: '/v1/version' });
  if (parts[0] === 'admin') return admin(ctx, parts.slice(1));
  if (parts[0] !== 'v1') throw new HttpError(404, 'not found', 'not_found');

  if (parts[1] === 'version' && method === 'GET') return version(ctx);
  if (parts[1] === 'admin') return admin(ctx, parts.slice(2));

  if (parts[1] === 'games' && parts[2]) {
    const game = gameSlug(parts[2]);
    const leaf = parts[3];
    if (leaf === 'count' && method === 'GET') return count(ctx, game);
    if (leaf === 'board' && method === 'GET') return board(ctx, game);
    if (leaf === 'scores' && method === 'POST') return postScore(ctx, game);
    if (leaf === 'events' && method === 'POST') return postEvents(ctx, game);
  }
  throw new HttpError(404, 'not found', 'not_found');
}
