// Cloudflare Pages "advanced mode" worker (dist/_worker.js). Everything is static except:
//   /<slug>/?c=<score>[&n=<nick>]  → the game page with a personalized og:title
//   404                            → /404.html with status 404
import { rewriteOg } from './rewrite';
export { rewriteOg, parseChallenge } from './rewrite';

export interface Env { ASSETS: { fetch(req: Request): Promise<Response> } }

const GAME_PATH = /^\/([a-z0-9][a-z0-9-]{1,39})\/?$/;

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const m = url.pathname.match(GAME_PATH);
  const c = url.searchParams.get('c');

  if (req.method === 'GET' && m && c && /^\d{1,10}$/.test(c)) {
    const clean = new URL(`/${m[1]}/`, url.origin).toString();
    const res = await env.ASSETS.fetch(new Request(clean, { headers: req.headers }));
    const type = res.headers.get('content-type') || '';
    if (res.ok && type.includes('text/html')) {
      const html = rewriteOg(await res.text(), { c, n: url.searchParams.get('n') });
      const headers = new Headers(res.headers);
      headers.set('content-type', 'text/html; charset=utf-8');
      headers.set('cache-control', 'public, max-age=60');
      headers.delete('content-length');
      return new Response(html, { status: 200, headers });
    }
    return res;
  }

  const res = await env.ASSETS.fetch(req);
  if (res.status === 404 && req.method === 'GET') {
    const nf = await env.ASSETS.fetch(new Request(new URL('/404.html', url.origin).toString()));
    if (nf.ok) {
      const headers = new Headers(nf.headers);
      headers.set('cache-control', 'no-store');
      return new Response(nf.body, { status: 404, headers });
    }
  }
  return res;
}

export default { fetch: handle };
