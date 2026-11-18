// Profile header for the social networks (1500x500, the size X asks for): the tagline and the covers of four games.
//   node PublishGamesPipeline/profile/make-header.mjs <repo root> <out.png> [youtube|reddit|producthunt]
// With "youtube": the same design on YouTube's 2560x1440 banner canvas, scaled into its 1546x423 centre, the only part
// every device shows (TVs show the whole canvas, phones only that strip).
// With "reddit": the profile banner, 1920x384 (5:1); the design sits in the centre because narrow screens crop the sides.
// With "producthunt": a 1270x760 gallery image (the size Product Hunt recommends), the design across the middle.
// The text stays clear of the bottom-left corner, where X lays the round profile picture over the header.
// To change the games shown, edit the list below (each needs Games/<GameId>/assets/cover.png, 1200x900).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const [repo, out, mode] = process.argv.slice(2);
const CANVAS = {
  x: { w: 1500, h: 500, k: 1, glow: 1, at: 78 },
  youtube: { w: 2560, h: 1440, k: 423 / 500, glow: 1.5, at: 62 },
  reddit: { w: 1920, h: 384, k: 384 / 500, glow: 1, at: 62 },
  producthunt: { w: 1270, h: 760, k: 1270 / 1500, glow: 1.2, at: 62 },
};
const C = CANVAS[mode || 'x'];
if (!repo || !out || !C) { console.error(`usage: make-header.mjs <repo root> <out.png> [${Object.keys(CANVAS).filter((m) => m !== 'x').join('|')}]`); process.exit(2); }
const CW = C.w, CH = C.h, K = C.k;
const { chromium } = createRequire(join(repo, 'GamesTemplate/other-services/bugcheck/package.json'))('playwright');
const b64 = (p) => `data:image/png;base64,${readFileSync(join(repo, p)).toString('base64')}`;
const games = ['WastedForSix', 'FallingCEO', 'FlightHeros', 'HalfMarathon'].map((g) => b64(`Games/${g}/assets/cover.png`));
const rot = [-4, 3, -3, 4], top = [18, -10, 16, -8];
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@700;800&display=swap">
<style>
html,body{margin:0;width:${CW}px;height:${CH}px;overflow:hidden}
.stage{position:absolute;left:50%;top:50%;width:1500px;height:500px;margin:-250px 0 0 -750px;transform:scale(${K})}
body{background:radial-gradient(${Math.round(900 * C.glow)}px ${Math.round(500 * C.glow)}px at ${C.at}% 50%,#2a1f55 0,#17142a 55%,#100e1a 100%);font-family:Nunito,sans-serif;color:#eeebf7;position:relative}
.dots{position:absolute;inset:0;background-image:radial-gradient(#ffffff14 1.5px,transparent 1.5px);background-size:26px 26px}
.txt{position:absolute;left:70px;top:96px;width:640px}
.logo{height:86px;display:block;margin:0 0 14px -8px}
h1{margin:0;font-family:'Lilita One',sans-serif;font-weight:400;font-size:68px;line-height:1.02;letter-spacing:.5px}
h1 b{color:#ffd23f;font-weight:400}
p{margin:16px 0 0;font-size:23px;white-space:nowrap;font-weight:800;color:#c9c4dd}
.cards{position:absolute;left:724px;top:78px;display:flex;gap:16px}
.card{width:170px;height:330px;border-radius:22px;overflow:hidden;border:5px solid #0b0914;box-shadow:0 16px 36px #000a;position:relative;background:#000}
.card img{position:absolute;height:396px;width:528px;left:-179px;top:-24px}
</style></head><body><div class="dots"></div><div class="stage">
<div class="txt"><h1>The news,<br>but you can <b>play it.</b></h1><p>Free one-minute browser games · toosoongames.app</p></div>
<div class="cards">${games.map((g, i) => `<div class="card" style="transform:rotate(${rot[i]}deg);top:${top[i]}px;z-index:${i + 1}"><img src="${g}"></div>`).join('')}</div></div>
</body></html>`;
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: CW, height: CH } });
await pg.setContent(html, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
await pg.screenshot({ path: out }); await b.close();
