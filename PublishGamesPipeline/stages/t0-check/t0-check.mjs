#!/usr/bin/env node
// Stage "t0-check" of /launch-game (playbook slide 17): six checks on the LIVE game before anyone is contacted.
// One red = nobody is contacted, nothing is posted. Runs after /publish-game.
//   node t0-check.mjs <GameId> [--phone-ok]
//     --phone-ok   the user ran the phone checklist of /publish-game on a real iPhone and a real Android
// Out: Games/<GameId>/launch/t0-check.md, exit 1 unless 6/6.
//
// 3 (measurement) opens the live game with ?utm_source=t0check&utm_medium=test and reads the events it sends: these
// are real events in production analytics, filterable as channel "test:t0check".
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameCfg, launch, studio } from '../../lib/outreach.mjs';
import { REPO } from '../../lib/state.mjs';

const args = process.argv.slice(2);
const gameId = args[0];
if (!gameId) { console.error('usage: node t0-check.mjs <GameId> [--phone-ok]'); process.exit(2); }
const L = launch(gameId);
const cfg = gameCfg(gameId);
const st = studio();
const base = (st.publicBase || '').replace(/\/$/, '');
const gameUrl = `${base}/${cfg.slug}/`;
const results = [];
const add = (n, name, ok, detail) => { results.push({ n, name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}. ${name}${detail ? ` — ${detail}` : ''}`); };
const get = async (url, init) => { try { return await fetch(url, { redirect: 'follow', ...init }); } catch (e) { return { ok: false, status: 0, error: e.message, headers: new Headers(), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }; } };
const readJsonIf = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);

// ---------- 1. clean landing: live 200, small, and the bug check is green for this game ----------
{
  const r = await get(gameUrl);
  const html = r.ok ? await r.text() : '';
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  const rep = join(REPO, 'GamesTemplate', 'other-services', 'bugcheck', 'out', 'report.md');
  const report = existsSync(rep) ? readFileSync(rep, 'utf8') : '';
  const ours = report.startsWith(`# bugcheck ${gameId} `);
  // same rule as /publish-game: red stops, yellow is a warning shown in the detail
  const head = report.split('\n').slice(0, 4).join('\n');
  const green = /\*\*(GREEN|YELLOW)\*\*/.test(head);
  const yellows = Number(head.match(/(\d+) yellow/)?.[1] ?? 0);
  const fresh = existsSync(rep) && Date.now() - statSync(rep).mtimeMs < 3 * 864e5;
  add(1, 'Clean landing page', r.ok && kb <= 300 && ours && green && fresh,
    !r.ok ? `${gameUrl} → ${r.status}` : kb > 300 ? `${kb} KB page (budget 300)` : !ours ? 'the last bug check report is for another game: run it for this one' : !green ? 'the bug check has red items' : !fresh ? 'the bug check report is older than 3 days' : `${kb} KB, bug check ${yellows ? `with ${yellows} yellow warnings (see its report)` : 'green'}`);
}

// ---------- 2. a tracked link per recipient, and every one of them opens ----------
{
  const links = new Map();
  const put = (who, link) => { if (link) links.set(link, who); };
  const copy = readJsonIf(join(L, 'copy.final.json'));
  for (const [net, p] of Object.entries(copy?.posts || {})) put(`post ${net}`, p.link);
  if (copy?.bioLink) put('bio', copy.bioLink);
  for (const j of readJsonIf(join(L, 'private', 'journalists.checked.json')) || []) if (j.status === 'ok') put(`journalist ${j.outlet}`, j.link);
  for (const c of readJsonIf(join(L, 'private', 'creators.checked.json')) || []) if (c.status === 'ok') put(`creator ${c.handle}`, c.link);
  for (const a of readJsonIf(join(L, 'paid.json'))?.ads || []) put(`ad ${a.name}`, a.link);
  const bad = [];
  for (const [link, who] of links) {
    const u = new URL(link);
    if (!u.searchParams.get('utm_source') || !u.searchParams.get('utm_medium') || !u.searchParams.get('utm_campaign')) { bad.push(`${who}: missing utm`); continue; }
    if (!link.startsWith(gameUrl)) { bad.push(`${who}: not the game URL`); continue; }
    const r = await get(link, { method: 'GET' });
    if (!r.ok) bad.push(`${who}: ${r.status}`);
  }
  const sources = new Set([...links.keys()].map((l) => new URL(l).searchParams.get('utm_source') + '|' + new URL(l).searchParams.get('utm_content')));
  if (sources.size !== links.size) bad.push('two recipients share the same utm_source + utm_content');
  add(2, 'UTM link per recipient', links.size > 0 && !bad.length, links.size ? (bad.length ? bad.slice(0, 4).join('; ') : `${links.size} links, all open`) : 'no links yet: run copy, journalists and creators');
}

// ---------- 3. measurement: the live game sends session_start with the channel, and game_start ----------
{
  const { chromium } = createRequire(join(REPO, 'GamesTemplate', 'other-services', 'bugcheck', 'package.json'))('playwright');
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); } // no installed Chrome: Playwright's bundled Chromium, as in the bug check
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
  const sent = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/v1\/games\/[^/]+\/events$/.test(req.url())) { try { sent.push(JSON.parse(req.postData() || '{}')); } catch { sent.push({ unreadable: true }); } }
  });
  let detail = '';
  try {
    await page.goto(`${gameUrl}?utm_source=t0check&utm_medium=test&utm_campaign=t0check`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.mouse.click(195, 600); // the title screen starts on a tap anywhere
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // no effect while visible; the flush below does it
    await page.waitForTimeout(6000); // the client flushes every 5 s
  } catch (e) { detail = e.message.split('\n')[0]; }
  await browser.close();
  const events = sent.flatMap((b) => (b.events || []).map((e) => ({ ...e, ch: b.ch })));
  const ss = events.find((e) => e.name === 'session_start');
  const gs = events.find((e) => e.name === 'game_start');
  const ok = !!ss && ss.ch === 'test:t0check' && !!gs;
  add(3, 'Measurement', ok, detail || (!ss ? 'no session_start reached the API' : ss.ch !== 'test:t0check' ? `the channel is not sent (got "${ss.ch ?? 'nothing'}"): deploy the analytics update (game build + API)` : !gs ? 'no game_start after a tap on the title screen' : 'session_start with channel test:t0check, game_start'));
}

// ---------- 4. mobile: emulated phones in the bug check + a real iPhone and Android by a person ----------
{
  const rep = join(REPO, 'GamesTemplate', 'other-services', 'bugcheck', 'out', 'report.md');
  const report = existsSync(rep) ? readFileSync(rep, 'utf8') : '';
  const mobile = report.split('## mobile')[1]?.split('\n## ')[0] || '';
  const emu = mobile.includes('🟢') && !mobile.includes('🔴');
  const phone = args.includes('--phone-ok');
  add(4, 'Mobile', emu && phone, !emu ? 'the bug check has no green mobile section for this game' : !phone ? 'waiting for the phone checklist on a real iPhone and Android (then rerun with --phone-ok)' : '3 emulated phones + real iPhone and Android');
}

// ---------- 5. press page in one link ----------
{
  const url = `${base}/press/${cfg.slug}/`;
  const r = await get(url);
  const html = r.ok ? await r.text() : '';
  const media = ['media/clip.mp4', 'media/screenshot-1-title.jpg', 'media/screenshot-2-gameplay.jpg', 'media/screenshot-3-result.jpg'];
  const missing = [];
  if (r.ok) for (const m of media) { const x = await get(url + m, { method: 'HEAD' }); if (!x.ok) missing.push(m); }
  // Cloudflare's email obfuscation rewrites mailto: links to /cdn-cgi/l/email-protection on the live site
  const contact = html.includes('mailto:') || html.includes('/cdn-cgi/l/email-protection');
  add(5, 'Press page', r.ok && contact && !missing.length, !r.ok ? `${url} → ${r.status} (deploy the site after the press-kit stage)` : missing.length ? `missing: ${missing.join(', ')}` : !contact ? 'no contact email on the page' : url);
}

// ---------- 6. share preview: og tags, a 1200x630 image, and the personalized card for challenge links ----------
{
  const og = (html, p) => html.match(new RegExp(`<meta property="og:${p}" content="([^"]*)"`))?.[1];
  const plain = await get(`${gameUrl}?utm_source=t0check&utm_medium=test`);
  const html = plain.ok ? await plain.text() : '';
  const img = og(html, 'image');
  let dims = '';
  if (img) {
    const r = await get(img);
    const b = Buffer.from(await r.arrayBuffer());
    if (r.ok && b.length > 24 && b.toString('ascii', 1, 4) === 'PNG') dims = `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
    else if (r.ok) dims = 'not a PNG';
  }
  const ch = await get(`${gameUrl}?c=42&n=TZero`);
  const chTitle = ch.ok ? og(await ch.text(), 'title') || '' : '';
  const ok = !!og(html, 'title') && !!og(html, 'description') && dims === '1200x630' && chTitle.includes('TZero');
  add(6, 'Share preview', ok, !img ? 'no og:image' : dims !== '1200x630' ? `og:image is ${dims || 'unreachable'}` : !chTitle.includes('TZero') ? 'a challenge link does not get the personalized og:title' : `og image ${dims}, challenge card personalized`);
}

const pass = results.filter((r) => r.ok).length;
const md = [`# T0 check: ${cfg.title}`, '', `**${pass} / 6** · ${new Date().toISOString()}`, '', pass === 6 ? 'The gate is open.' : '**The gate is closed: nobody is contacted and nothing is posted until all six pass.**', '',
  '| # | check | | detail |', '|---|---|---|---|', ...results.map((r) => `| ${r.n} | ${r.name} | ${r.ok ? '✓' : '✗'} | ${r.detail || ''} |`), ''];
writeFileSync(join(L, 't0-check.md'), md.join('\n'));
console.log(`\nT0 gate: ${pass}/6 → launch/t0-check.md`);
process.exit(pass === 6 ? 0 : 1);
