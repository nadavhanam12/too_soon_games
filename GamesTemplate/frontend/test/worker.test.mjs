// Tests for dist/_worker.js (run `npm run build` first). Node 20, no test framework.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const workerPath = join(here, '..', '..', 'dist', '_worker.js');
if (!existsSync(workerPath)) { console.error('dist/_worker.js missing: run `npm run build` first'); process.exit(1); }
// dist/_worker.js has no package.json "type": "module" next to it → copy it as .mjs for Node
import { mkdirSync, copyFileSync } from 'node:fs';
const tmp = join(here, '..', '.cache', '_worker.test.mjs');
mkdirSync(dirname(tmp), { recursive: true });
copyFileSync(workerPath, tmp);
const mod = await import(pathToFileURL(tmp).href + '?t=' + Date.now());
const { rewriteOg, parseChallenge } = mod;
const handle = mod.default.fetch;

let failed = 0;
const check = (name, cond, extra = '') => { if (cond) console.log(`  ok   ${name}`); else { failed++; console.log(`  FAIL ${name} ${extra}`); } };

const GAME_HTML = `<!doctype html><html><head><title>Drop the Chip</title>
<meta property="og:title" content="Drop the Chip - game">
<meta property="og:description" content="Icy Tower in reverse.">
<meta name="twitter:title" content="Drop the Chip"></head><body>hi</body></html>`;

// pure function
let out = rewriteOg(GAME_HTML, { c: '42', n: 'Dani' });
check('og:title personalized', out.includes('content="Dani scored 42 in Drop the Chip. Beat them?"'), out);
check('twitter:title personalized', out.includes('name="twitter:title" content="Dani scored 42 in Drop the Chip. Beat them?"'));
check('og:description untouched', out.includes('content="Icy Tower in reverse."'));
out = rewriteOg(GAME_HTML, { c: '1234567' });
check('no nick → "A friend", thousands separators', out.includes('A friend scored 1,234,567 in'));
out = rewriteOg(GAME_HTML, { c: '42', n: '<img src=x onerror=alert(1)>' });
check('nick escaped (angle brackets stripped, no raw tag)', !out.includes('<img') && out.includes('img src=x onerro scored'), out);
out = rewriteOg(GAME_HTML, { c: '42', n: 'x"y' });
check('quote in nick escaped', out.includes('x&quot;y scored'));
const HE_HTML = `<!doctype html><html lang="he" dir="rtl"><head><title>חופשה בטוחה</title>
<meta property="og:title" content="חופשה בטוחה · Too Soon Games"></head><body></body></html>`;
out = rewriteOg(HE_HTML, { c: '4200', n: 'דני' });
check('hebrew page → hebrew sentence, studio suffix stripped', out.includes('content="דני עשה 4,200 בחופשה בטוחה. תנצח אותו?"'), out);
out = rewriteOg(HE_HTML, { c: '7' });
check('hebrew page, no nick → חבר שלך', out.includes('חבר שלך עשה 7 ב'));
out = rewriteOg(GAME_HTML.replace('Drop the Chip - game', 'Drop the Chip · Too Soon Games'), { c: '1', n: 'A' });
check('english studio suffix stripped', out.includes('A scored 1 in Drop the Chip. Beat them?'), out);
out = rewriteOg(GAME_HTML, { c: '42', n: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
check('nick capped at 16 chars', out.includes('ABCDEFGHIJKLMNOP scored') && !out.includes('ABCDEFGHIJKLMNOPQ'));
check('non-numeric c → unchanged', rewriteOg(GAME_HTML, { c: 'abc' }) === GAME_HTML);
check('missing c → unchanged', rewriteOg(GAME_HTML, { c: null }) === GAME_HTML);
check('parseChallenge rejects huge', parseChallenge({ c: '12345678901' }) === null);

// handler with a fake ASSETS
const assets = {
  async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === '/chip-drop/') return new Response(GAME_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': String(GAME_HTML.length) } });
    if (p === '/404.html') return new Response('<h1>Not found</h1>', { headers: { 'content-type': 'text/html' } });
    if (p === '/styles.css') return new Response('body{}', { headers: { 'content-type': 'text/css' } });
    return new Response('nf', { status: 404 });
  },
};
let r = await handle(new Request('https://toosoon.example/chip-drop/?c=42&n=Dani'), { ASSETS: assets });
let text = await r.text();
check('handler: 200 + personalized title', r.status === 200 && text.includes('Dani scored 42'));
check('handler: content-length dropped', !r.headers.has('content-length'));
r = await handle(new Request('https://toosoon.example/chip-drop/?c=42'), { ASSETS: assets });
check('handler: works without nick', (await r.text()).includes('A friend scored 42'));
r = await handle(new Request('https://toosoon.example/chip-drop/'), { ASSETS: assets });
check('handler: plain game page passthrough', (await r.text()) === GAME_HTML);
r = await handle(new Request('https://toosoon.example/styles.css?c=42'), { ASSETS: assets });
check('handler: non-game path with c untouched', (await r.text()) === 'body{}');
r = await handle(new Request('https://toosoon.example/nope/'), { ASSETS: assets });
check('handler: 404 page with status 404', r.status === 404 && (await r.text()).includes('Not found'));
r = await handle(new Request('https://toosoon.example/nope/?c=1'), { ASSETS: assets });
check('handler: unknown game with c → 404 passthrough', r.status === 404);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
