#!/usr/bin/env node
// Stage "press-kit" of /launch-game (playbook slides 7 and 17): one page a journalist can open from one link, with
// screenshots, the clip, the GIF, a short text, the facts and a contact, plus a zip of all of it.
//   node make-press-kit.mjs <GameId>
// Needs: the videos stage (launch/videos/) and the copy stage (launch/copy.final.json).
// Out:   Games/<GameId>/launch/press/  → the site build copies it to dist/press/<slug>/ (GamesTemplate/frontend/build.ts)
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockApi } from '../../lib/outreach.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const TEMPLATE = join(REPO, 'GamesTemplate');
const DIST = join(TEMPLATE, '.local-dist');
const { chromium } = createRequire(join(TEMPLATE, 'other-services', 'bugcheck', 'package.json'))('playwright');

const gameId = process.argv[2];
if (!gameId) { console.error('usage: node make-press-kit.mjs <GameId>'); process.exit(2); }
const GAME = join(REPO, 'Games', gameId);
const LAUNCH = join(GAME, 'launch');
const cfg = JSON.parse(readFileSync(join(GAME, 'game.json'), 'utf8'));
const studio = JSON.parse(readFileSync(join(TEMPLATE, 'studio.json'), 'utf8'));
const need = (f, why) => { if (!existsSync(f)) { console.error(`${f.replace(REPO, '')} missing: ${why}`); process.exit(1); } return f; };
const videos = JSON.parse(readFileSync(need(join(LAUNCH, 'videos', 'videos.json'), 'run the videos stage first'), 'utf8'));
const copy = JSON.parse(readFileSync(need(join(LAUNCH, 'copy.final.json'), 'run the copy stage first'), 'utf8'));
need(join(DIST, cfg.slug, 'index.html'), 'the videos stage builds the game into .local-dist');
if (!studio.email) { console.error('studio.json "email" is empty: a press kit needs a contact'); process.exit(1); }

const OUT = join(LAUNCH, 'press');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'media'), { recursive: true });
const log = (...a) => console.log('[press-kit]', ...a);

// ---------- screenshots: the title from the real game; gameplay and result from the videos capture (a real run) ----------
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webm': 'video/webm' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); } // no installed Chrome: Playwright's bundled Chromium, as in the bug check
const pressCtx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: cfg.lang === 'he' ? 'he-IL' : 'en-US' });
await blockApi(pressCtx); // never write the screenshot visit into production analytics
const page = await pressCtx.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/${cfg.slug}/?seed=${videos.seed}`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__manual === 'function', null, { timeout: 10000 });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => { window.__manual(true); window.__advance(1.5); });
const shot = async (name) => {
  const url = await page.evaluate(() => document.querySelector('canvas#c').toDataURL('image/jpeg', 0.92));
  writeFileSync(join(OUT, 'media', name), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
};
await shot('screenshot-1-title.jpg');
await browser.close(); server.close();
// gameplay: the middle shot of the arc clip that is a frame of a run (not a still), from the run that clip is cut from
// (captions.json clipRun / a shot's own run); result: the main run's result screen, its real score (opening the result
// screen without a run shows the template's made-up one: "42")
const capFile = join(LAUNCH, 'videos', 'captions.json'), cap = existsSync(capFile) ? JSON.parse(readFileSync(capFile, 'utf8')) : {};
const runFrames = (run) => join(LAUNCH, '.work', run ? `videos-${run}` : 'videos', 'frames');
const nearest = (dir, t) => { const want = Math.round(t * videos.fps); const f = readdirSync(dir).map((x) => Number(x.slice(0, 6))).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0]; return join(dir, `${String(f).padStart(6, '0')}.jpg`); };
// captions.json "pressGameplay": a picture in launch/videos chosen for it (Nice City: a staged chase made with make-videos
// --still, the police right behind you under the helicopter's light); else the arc's middle shot, which is often a car
// alone on a road (Nadav: "not exciting")
if (cap.pressGameplay) {
  const f = join(LAUNCH, 'videos', cap.pressGameplay);
  if (!existsSync(f)) { console.error(`captions.json pressGameplay: ${cap.pressGameplay} not found in launch/videos`); process.exit(1); }
  const out = join(OUT, 'media', 'screenshot-2-gameplay.jpg');
  if (/\.jpe?g$/i.test(f)) copyFileSync(f, out);
  else { // e.g. a PNG still from make-videos --still: the file must be the JPEG its name says (the full ffmpeg from .video-tools)
    const ffDir = join(REPO, '.video-tools', 'imageio_ffmpeg', 'binaries');
    const FF = existsSync(ffDir) ? readdirSync(ffDir).filter((x) => x.startsWith('ffmpeg')).map((x) => join(ffDir, x)).pop() : '';
    if (!FF) { console.error(`ffmpeg not found in ${ffDir}: cannot turn ${cap.pressGameplay} into a JPEG`); process.exit(1); }
    const r = spawnSync(FF, ['-y', '-loglevel', 'error', '-i', f, '-q:v', '2', out], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(`ffmpeg failed on ${cap.pressGameplay}: ${r.stderr}`); process.exit(1); }
  }
} else {
  const arc = videos.clips.find((c) => c.name === 'arc');
  const live = arc.segments.filter((g) => !g[2]?.image);
  if (!live.length) { console.error('the arc clip has no shot from a run to take the gameplay screenshot from'); process.exit(1); }
  const seg = live[Math.floor(live.length / 2)];
  copyFileSync(nearest(runFrames(seg[2]?.run ?? cap.clipRun?.arc ?? null), (seg[0] + seg[1]) / 2), join(OUT, 'media', 'screenshot-2-gameplay.jpg'));
}
if (videos.run.endScene !== 'result') { console.error(`the videos capture ended on "${videos.run.endScene}", not the result screen: no result screenshot`); process.exit(1); }
copyFileSync(nearest(runFrames(null), videos.run.endsAt + 1), join(OUT, 'media', 'screenshot-3-result.jpg'));

// ---------- media ----------
const V = join(LAUNCH, 'videos');
copyFileSync(join(V, 'hook.mp4'), join(OUT, 'media', 'clip.mp4'));
copyFileSync(join(V, 'email.gif'), join(OUT, 'media', 'clip.gif'));
copyFileSync(join(V, 'cover.png'), join(OUT, 'media', 'cover-vertical.png'));
const og = join(GAME, (cfg.ogImage || 'assets/og.png'));
if (existsSync(og)) copyFileSync(og, join(OUT, 'media', 'card-1200x630.png'));
copyFileSync(join(TEMPLATE, 'frontend', 'src', 'assets', 'logo.png'), join(OUT, 'media', 'studio-logo.png'));

// ---------- page ----------
const he = cfg.lang === 'he';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const base = (studio.publicBase || '').replace(/\/$/, '');
const play = `${base}/${cfg.slug}/?utm_source=presskit&utm_medium=press&utm_campaign=${copy.campaign}`;
const T = he ? {
  kit: 'ערכת עיתונות', play: 'לשחק עכשיו', facts: 'עובדות', shots: 'צילומי מסך', dl: 'הורדה', all: 'כל הערכה (zip)',
  contact: 'יצירת קשר', event: 'האירוע', source: 'מקור', parody: 'פרודיה. אין קשר לאנשים או לחברות שבאירוע. מותר להשתמש בכל החומרים כאן לסיקור המשחק.',
} : {
  kit: 'Press kit', play: 'Play now', facts: 'Facts', shots: 'Screenshots', dl: 'Download', all: 'Whole kit (zip)',
  contact: 'Contact', event: 'The event', source: 'Source', parody: 'Parody. Not affiliated with the people or companies in the event. Everything here may be used to cover the game.',
};
const shots = ['screenshot-1-title.jpg', 'screenshot-2-gameplay.jpg', 'screenshot-3-result.jpg'];
// each screenshot's alt says what it is, and that the game is a parody; captions.json "pressGameplayAlt" names the middle one
T.parodyGame = he ? ' (משחק פרודיה)' : ' (parody game)';
T.shotAlt = he ? ['מסך הפתיחה', cap.pressGameplayAlt || 'מתוך המשחק', 'מסך התוצאה'] : ['the title screen', cap.pressGameplayAlt || 'gameplay', 'the result screen'];
const html = `<!doctype html><html lang="${cfg.lang}" dir="${he ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(cfg.title)} · ${T.kit} · ${esc(studio.name)}</title>
<meta name="description" content="${esc(copy.description)}">
<meta property="og:title" content="${esc(cfg.title)} · ${T.kit}"><meta property="og:description" content="${esc(copy.description)}">
<meta property="og:image" content="${base}/press/${cfg.slug}/media/card-1200x630.png">
<style>
:root{--bg:#fff;--ink:#141414;--muted:#5c5c5c;--line:#e4e4e4;--card:#f6f6f6;--accent:${cfg.themeColor || '#141414'}}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--ink:#f2f2f2;--muted:#a8a8a8;--line:#2c2c2c;--card:#1c1c1c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Rubik,sans-serif}
main{max-width:920px;margin:0 auto;padding:28px 16px 64px}
header{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:14px}header img{height:34px}
h1{font-size:clamp(28px,6vw,44px);line-height:1.1;margin:18px 0 8px}h2{font-size:20px;margin:36px 0 12px}
.lede{font-size:19px;color:var(--muted);margin:0 0 20px}
.hero{display:grid;grid-template-columns:minmax(0,300px) 1fr;gap:28px;align-items:start}
@media (max-width:640px){.hero{grid-template-columns:1fr}.hero video{max-width:300px}}
video{width:100%;border-radius:14px;background:#000;display:block}
.btn{display:inline-block;background:var(--ink);color:var(--bg);padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700}
ul{padding-inline-start:20px}li{margin:4px 0}
.shots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:640px){.shots{grid-template-columns:repeat(2,minmax(0,1fr))}}
.shots a{display:block;border-radius:10px;overflow:hidden;border:1px solid var(--line)}.shots img{width:100%;display:block}
.dl{display:flex;flex-wrap:wrap;gap:10px}.dl a{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 14px;color:var(--ink);text-decoration:none;font-size:14px}
.note{color:var(--muted);font-size:14px;border-top:1px solid var(--line);margin-top:40px;padding-top:16px}
a{color:inherit}
</style></head><body><main>
<header><img src="media/studio-logo.png" alt="${esc(studio.name)}"><span>${esc(studio.name)} · ${T.kit}</span></header>
<h1>${esc(copy.press.headline)}</h1>
<p class="lede">${esc(copy.description)}</p>
<div class="hero">
  <video src="media/clip.mp4" poster="media/cover-vertical.png" autoplay muted loop playsinline controls></video>
  <div>
    <p>${esc(copy.press.about)}</p>
    <p><a class="btn" href="${esc(play)}">${T.play}: ${esc(cfg.title)}</a></p>
    <h2>${T.facts}</h2>
    <ul>${(copy.press.facts || []).map((f) => `<li>${esc(f)}</li>`).join('')}
      <li>${T.event}: ${esc(cfg.event?.title || '')}${cfg.event?.date ? ` (${esc(cfg.event.date)})` : ''}</li>
      ${cfg.event?.sourceUrl ? `<li>${T.source}: <a href="${esc(cfg.event.sourceUrl)}">${esc(cfg.event.sourceLabel || cfg.event.sourceUrl)}</a></li>` : ''}
    </ul>
  </div>
</div>
<h2>${T.shots}</h2>
<div class="shots">${shots.map((s, i) => `<a href="media/${s}"><img src="media/${s}" alt="${esc(`${cfg.title}${T.parodyGame}: ${T.shotAlt[i]}`)}" loading="lazy"></a>`).join('')}</div>
<h2>${T.dl}</h2>
<div class="dl">
  <a href="${cfg.slug}-press-kit.zip" download>${T.all}</a>
  <a href="media/clip.mp4" download>clip.mp4</a><a href="media/clip.gif" download>clip.gif</a>
  <a href="media/cover-vertical.png" download>cover-vertical.png</a>${existsSync(og) ? '<a href="media/card-1200x630.png" download>card-1200x630.png</a>' : ''}
  <a href="media/studio-logo.png" download>studio-logo.png</a>
</div>
<h2>${T.contact}</h2>
<p><a href="mailto:${esc(studio.email)}">${esc(studio.email)}</a></p>
<p class="note">${T.parody}</p>
</main></body></html>`;
writeFileSync(join(OUT, 'index.html'), html);

// press.txt: the same text for the zip, plain
writeFileSync(join(OUT, 'media', 'press.txt'), [cfg.title, '', copy.press.headline, '', copy.description, '', copy.press.about, '',
  ...(copy.press.facts || []).map((f) => `- ${f}`), '', `${T.play}: ${play}`, `${T.contact}: ${studio.email}`, '', T.parody, ''].join('\n'));

// ---------- zip (python's zipfile: there is no zip in node, and Windows tar differs between shells) ----------
const zip = join(OUT, `${cfg.slug}-press-kit.zip`);
const z = spawnSync('python', ['-I', '-c', 'import sys,zipfile,os\nz=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED)\nfor f in sorted(os.listdir(sys.argv[2])): z.write(os.path.join(sys.argv[2],f),f)\nz.close()', zip, join(OUT, 'media')], { encoding: 'utf8' });
if (z.status !== 0) { console.error('zip failed: ' + (z.stderr || z.error)); process.exit(1); }

const size = (f) => (statSync(f).size / 1e6).toFixed(1) + ' MB';
log(`page → launch/press/index.html · zip ${size(zip)} · ${readdirSync(join(OUT, 'media')).length} files`);
log(`will be live at ${base}/press/${cfg.slug}/ after the next site build + deploy`);
