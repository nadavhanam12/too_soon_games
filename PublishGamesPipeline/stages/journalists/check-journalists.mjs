#!/usr/bin/env node
// Stage "journalists" of /launch-game (playbook slides 8, 9, 14): checks the list Claude researched, applies the legal
// order of channels and the suppression list, and gives each journalist their own tracked link.
//   node check-journalists.mjs <GameId>
// In:  Games/<GameId>/launch/private/journalists.json   (written by Claude; never in git)
// Out: Games/<GameId>/launch/private/journalists.checked.json, journalists.md
//
// journalists.json: [{
//   "name": "Dana Levi",                 // a person, or the desk ("News desk") when the channel is the outlet's form
//   "outlet": "Example News", "country": "US",
//   "article": { "url": "...", "date": "YYYY-MM-DD", "title": "...", "detail": "one concrete detail from it" },
//   "channel": "tip-form" | "dm" | "email",
//   "contact": "https://outlet.com/tips" | "@handle on X" | "name@outlet.com",
//   "openToPitches": "https://... (bio or page that says they take pitches; required for dm)",
//   "lang": "en" | "he"                  // optional, defaults by country
// }]
// Channel order, lowest risk first (slide 14): 1 tip-form/news desk, 2 dm to someone who invites pitches,
// 3 email, only when config.legal.coldEmailApproved and the country is in coldEmailCountries, never in noEmailCountries.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, gameCfg, isSuppressed, launch, readJson, slug, suppression, trackedLink } from '../../lib/outreach.mjs';

const gameId = process.argv[2];
if (!gameId) { console.error('usage: node check-journalists.mjs <GameId>'); process.exit(2); }
const L = launch(gameId);
const cfg = gameCfg(gameId);
const conf = config();
const list = readJson(join(L, 'private', 'journalists.json'), 'Claude researches it first (see the header of this file)');
const copy = readJson(join(L, 'copy.final.json'), 'run the copy stage first (it fixes the campaign name)');
const supp = suppression();

const RANK = { 'tip-form': 1, dm: 2, email: 3 };
const eventDay = cfg.event?.date ? new Date(cfg.event.date) : null;
const errors = [];
const seen = new Set();
const out = [];
for (const [i, j] of list.entries()) {
  const at = `#${i + 1} ${j.name || '?'} (${j.outlet || '?'})`;
  for (const k of ['name', 'outlet', 'country', 'channel', 'contact']) if (!j[k]) errors.push(`${at}: missing "${k}"`);
  if (!j.article?.url || !j.article?.date || !j.article?.detail) errors.push(`${at}: article needs url, date and a concrete detail (the personal line of the pitch)`);
  if (!RANK[j.channel]) { errors.push(`${at}: channel must be tip-form, dm or email`); continue; }
  const country = String(j.country).toUpperCase();
  const key = String(j.contact).toLowerCase();
  let status = 'ok', why = '';
  if (seen.has(key)) { status = 'skip'; why = 'duplicate contact'; }
  seen.add(key);
  const hit = isSuppressed(supp, j.contact, j.article?.url);
  if (status === 'ok' && hit) { status = 'skip'; why = `on the suppression list (${hit})`; }
  if (status === 'ok' && j.channel === 'dm' && !j.openToPitches) { status = 'blocked'; why = 'dm needs proof they invite pitches (openToPitches)'; }
  if (status === 'ok' && j.channel === 'email') {
    if (conf.legal.noEmailCountries.includes(country)) { status = 'blocked'; why = `no cold email to ${country} (prior consent required): use their tip form`; }
    else if (!conf.legal.coldEmailApproved) { status = 'blocked'; why = 'cold email is off until the lawyer check (config.legal.coldEmailApproved): use the tip form or a dm'; }
    else if (!conf.legal.coldEmailCountries.includes(country)) { status = 'blocked'; why = `cold email is cleared only for ${conf.legal.coldEmailCountries.join(', ')}`; }
  }
  if (j.article?.date && eventDay && new Date(j.article.date) < new Date(eventDay.getTime() - 864e5)) {
    status = status === 'ok' ? 'skip' : status; why ||= `the article (${j.article.date}) is from before the event (${cfg.event.date})`;
  }
  const source = slug(j.outlet);
  out.push({
    ...j, country, lang: j.lang || (country === 'IL' ? 'he' : 'en'), rank: RANK[j.channel], status, ...(why ? { why } : {}),
    link: trackedLink(gameId, copy.campaign, { source, medium: 'press', content: slug(j.name) }),
  });
}
if (errors.length) { console.error('journalists.json has problems:\n- ' + errors.join('\n- ')); process.exit(1); }

out.sort((a, b) => (a.status === 'ok' ? 0 : 1) - (b.status === 'ok' ? 0 : 1) || a.rank - b.rank);
const ok = out.filter((j) => j.status === 'ok');
if (ok.length > conf.outreach.maxPerGame) for (const j of ok.slice(conf.outreach.maxPerGame)) { j.status = 'skip'; j.why = `over ${conf.outreach.maxPerGame} per game`; }

writeFileSync(join(L, 'private', 'journalists.checked.json'), JSON.stringify(out, null, 2) + '\n');
const ch = { 'tip-form': 'tip form', dm: 'DM', email: 'email' };
const md = [`# Journalists: ${cfg.title}`, '', `${out.filter((j) => j.status === 'ok').length} to contact · ${out.filter((j) => j.status === 'blocked').length} blocked · ${out.filter((j) => j.status === 'skip').length} skipped`, '',
  '| # | who | outlet | country | channel | article | status |', '|---|---|---|---|---|---|---|',
  ...out.map((j, i) => `| ${i + 1} | ${j.name} | ${j.outlet} | ${j.country} | ${ch[j.channel]} | [${j.article.date}](${j.article.url}) | ${j.status}${j.why ? `: ${j.why}` : ''} |`), ''];
writeFileSync(join(L, 'private', 'journalists.md'), md.join('\n'));
console.log(`[journalists] ${md[2]} → launch/private/journalists.md`);
if (!existsSync(join(L, 'press', 'index.html'))) console.log('[journalists] note: no press kit yet; the pitches link to it');
