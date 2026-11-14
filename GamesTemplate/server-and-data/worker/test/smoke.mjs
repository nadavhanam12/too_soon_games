// Smoke test against a running API (default: `wrangler dev` on http://127.0.0.1:8787).
//   node test/smoke.mjs [baseUrl]
// ADMIN_KEY is read from the environment, else from .dev.vars. Exit code 1 on any failure.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const base = (process.argv[2] || process.env.API_BASE || 'http://127.0.0.1:8787').replace(/\/$/, '');
let adminKey = process.env.ADMIN_KEY;
if (!adminKey) {
  try {
    const m = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_KEY=(.*)$/m);
    adminKey = m?.[1]?.trim();
  } catch { /* ignore */ }
}
if (!adminKey) { console.error('no ADMIN_KEY (env or .dev.vars)'); process.exit(1); }

const game = `smoke-${Date.now().toString(36)}`;
const user = randomUUID();
const user2 = randomUUID();
const origin = 'http://localhost:5173';
let failed = 0;

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', origin, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
function check(name, cond, extra = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { failed++; console.log(`  FAIL ${name} ${extra}`); }
}
const adm = { 'x-admin-key': adminKey };

console.log(`smoke → ${base}  game=${game}`);

let r = await call('GET', '/v1/version');
check('version', r.status === 200 && typeof r.data.version === 'string', JSON.stringify(r.data));
check('cors header for localhost origin', r.headers.get('access-control-allow-origin') === origin);

r = await call('OPTIONS', `/v1/games/${game}/scores`);
check('preflight 204', r.status === 204);

r = await call('GET', `/v1/games/${game}/count`);
check('unknown game → 404', r.status === 404, JSON.stringify(r.data));

r = await call('PUT', `/v1/admin/games/${game}`, { name: 'Smoke', maxScore: 1000, minDurationS: 5 }, adm);
check('admin: register game', r.status === 200, JSON.stringify(r.data));
r = await call('PUT', `/v1/admin/games/${game}`, { name: 'Smoke', maxScore: 1000 }, { 'x-admin-key': 'wrong' });
check('admin: wrong key → 401', r.status === 401);
r = await call('PUT', `/v1/admin/games/${game}`, { name: 'Smoke', maxScore: 1000, minDurationS: 5 }, adm);
check('admin: register game (idempotent)', r.status === 200);

const sid = 's1';
r = await call('POST', `/v1/games/${game}/events`, {
  userId: user, version: '0.0.1', lang: 'he',
  events: [
    { name: 'session_start', ts: Date.now(), sessionId: sid, props: { ref: 'whatsapp' } },
    { name: 'game_start', ts: Date.now(), sessionId: sid },
    { name: 'not_a_real_event', ts: Date.now(), sessionId: sid },
    { name: 'stage_complete', ts: Date.now(), sessionId: sid, props: { stage: '1', timeS: 12 } },
  ],
});
check('events batch → 204 (unknown names ignored)', r.status === 204, JSON.stringify(r.data));
r = await call('POST', `/v1/games/${game}/events`, { userId: user, version: '0.0.1', events: [] });
check('empty batch → 400', r.status === 400);
r = await call('POST', `/v1/games/${game}/events`, { userId: 'nope', version: '0.0.1', events: [{ name: 'game_start', ts: 1, sessionId: 'x' }] });
check('bad userId → 400', r.status === 400);

await new Promise((res) => setTimeout(res, 300)); // waitUntil side effects
r = await call('GET', `/v1/games/${game}/count`);
check('count = 1 after game_start', r.status === 200 && r.data.players === 1, JSON.stringify(r.data));

r = await call('POST', `/v1/games/${game}/scores`, { userId: user, nick: 'דני', score: 420, durationS: 42, stage: '3', version: '0.0.1' });
check('score accepted, rank 1', r.status === 200 && r.data.rank === 1 && r.data.best === 420 && r.data.improved === true, JSON.stringify(r.data));
r = await call('POST', `/v1/games/${game}/scores`, { userId: user, score: 300, durationS: 40, version: '0.0.1' });
check('lower score keeps best', r.status === 200 && r.data.best === 420 && r.data.improved === false, JSON.stringify(r.data));
r = await call('POST', `/v1/games/${game}/scores`, { userId: user2, nick: 'Sam', score: 900, durationS: 60, version: '0.0.1' });
check('second player, rank 1', r.status === 200 && r.data.rank === 1 && r.data.total === 2, JSON.stringify(r.data));
r = await call('POST', `/v1/games/${game}/scores`, { userId: user2, score: 5000, durationS: 60, version: '0.0.1' });
check('score above max → 422', r.status === 422 && r.data.error === 'score_too_high', JSON.stringify(r.data));
r = await call('POST', `/v1/games/${game}/scores`, { userId: user2, score: 10, durationS: 1, version: '0.0.1' });
check('too fast → 422', r.status === 422 && r.data.error === 'too_fast', JSON.stringify(r.data));
r = await call('POST', `/v1/games/${game}/scores`, { userId: user2, nick: 'see http://x.y', score: 10, durationS: 10, version: '0.0.1' });
check('nick with link → 400', r.status === 400, JSON.stringify(r.data));

r = await call('GET', `/v1/games/${game}/board?limit=10&userId=${user}`);
check('board: 2 rows, you = rank 2', r.status === 200 && r.data.total === 2 && r.data.top.length === 2 && r.data.you?.rank === 2 && r.data.top[1].isYou === true, JSON.stringify(r.data));
check('board: nick kept (דני)', r.data.top?.[1]?.nick === 'דני');
check('board: no userId leaked', r.data.top.every((x) => !('userId' in x)));

r = await call('GET', `/v1/admin/games`, undefined, adm);
check('admin: games list includes smoke game', r.status === 200 && r.data.games.some((g) => g.game_id === game && g.players === 2 && g.scores === 2), JSON.stringify(r.data).slice(0, 200));
r = await call('GET', `/v1/admin/games/${game}/stats?days=7`, undefined, adm);
check('admin: stats (D1 part)', r.status === 200 && r.data.d1.players === 2 && r.data.d1.scores === 2 && r.data.d1.bestScore === 900, JSON.stringify(r.data).slice(0, 300));
console.log(`       analytics: ${r.data.ae?.error ? 'not configured (' + r.data.ae.error.slice(0, 60) + ')' : 'ok'}`);
r = await call('GET', `/v1/admin/games/${game}/board`, undefined, adm);
check('admin: board with userIds', r.status === 200 && r.data.rows.length === 2 && r.data.rows[0].user_id === user2);
r = await call('DELETE', `/v1/admin/games/${game}/scores/${user2}`, undefined, adm);
check('admin: delete troll', r.status === 200 && r.data.deleted === 1, JSON.stringify(r.data));
// the board is edge-cached 10 s per data centre; the purge is per colo, so allow up to 12 s for the change to show
for (let i = 0; i < 13; i++) { r = await call('GET', `/v1/games/${game}/board?limit=10`); if (r.data?.total === 1) break; await new Promise((res) => setTimeout(res, 1000)); }
check('board after delete: 1 row (within the 10 s cache TTL)', r.status === 200 && r.data.total === 1 && r.data.top.length === 1, JSON.stringify(r.data));
r = await call('GET', '/admin');
check('admin page served', r.status === 200 && typeof r.data === 'string' && r.data.includes('<title>'));
r = await call('GET', '/nope');
check('404 json', r.status === 404 && r.data.error === 'not_found');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
