#!/usr/bin/env node
// Stage "creators" of /launch-game (playbook slide 10): checks the nano/micro creators Claude found who already talk
// about the event, and the free message to each, and gives each creator their own tracked link. Nothing is sent and no
// money is offered here: a paid post is decided only after the T0+6 gate (stage `gates`).
//   node check-creators.mjs <GameId>
// In:  Games/<GameId>/launch/private/creators.json
// Out: Games/<GameId>/launch/private/creators.checked.json, creators.md
//
// creators.json: [{
//   "name": "...", "handle": "@name", "network": "tiktok|instagram|x|youtube|threads|facebook",
//   "followers": 8200,
//   "post": { "url": "...", "date": "YYYY-MM-DD", "detail": "what they said about the event" },
//   "contact": "@name" | "business@email" ,      // a DM, or the business email they publish for collaborations
//   "contactProof": "https://... (for an email: the page or bio where they publish it)",
//   "message": "... {link} ..."                     // the free offer: beat the leaderboard, challenge followers
// }]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameCfg, isSuppressed, launch, readJson, slug, suppression, trackedLink } from '../../lib/outreach.mjs';

const gameId = process.argv[2];
if (!gameId) { console.error('usage: node check-creators.mjs <GameId>'); process.exit(2); }
const L = launch(gameId);
const cfg = gameCfg(gameId);
const list = readJson(join(L, 'private', 'creators.json'), 'Claude finds the creators first (see the header of this file)');
const copy = readJson(join(L, 'copy.final.json'), 'run the copy stage first (it fixes the campaign name)');
const supp = suppression();

const NETS = ['tiktok', 'instagram', 'x', 'youtube', 'threads', 'facebook'];
const MAX_FOLLOWERS = 100_000;  // nano and micro only (slide 10): bigger accounts are slow and expensive in a 72 h window
const MAX_WORDS = 80;
const MONEY = /(\$|₪|€|\bpay\b|\bpaid\b|\bfee\b|\bsponsor|\brate\b|תשלום|לשלם|בתשלום|ממומן)/i;
const eventDay = cfg.event?.date ? new Date(cfg.event.date) : null;

const errors = [];
const seen = new Set();
const out = [];
for (const [i, c] of list.entries()) {
  const at = `#${i + 1} ${c.handle || c.name || '?'}`;
  for (const k of ['name', 'handle', 'network', 'contact', 'message']) if (!c[k]) errors.push(`${at}: missing "${k}"`);
  if (!NETS.includes(c.network)) errors.push(`${at}: network must be one of ${NETS.join(', ')}`);
  if (!c.post?.url || !c.post?.date || !c.post?.detail) errors.push(`${at}: post needs url, date and what they said (the personal line)`);
  if (typeof c.followers !== 'number') errors.push(`${at}: followers must be a number`);
  if (!c.message) continue;
  if ((c.message.match(/\{link\}/g) || []).length !== 1) errors.push(`${at}: the message needs "{link}" exactly once`);
  const words = c.message.replace('{link}', '').trim().split(/\s+/).length;
  if (words > MAX_WORDS) errors.push(`${at}: ${words} words, at most ${MAX_WORDS}`);
  if (MONEY.test(c.message)) errors.push(`${at}: the first message offers no money (a paid post comes only after the T0+6 gate)`);
  const isEmail = /@.+\./.test(c.contact) && !String(c.contact).startsWith('@');
  if (isEmail && !c.contactProof) errors.push(`${at}: an email contact needs contactProof (where they publish it for collaborations)`);

  let status = 'ok', why = '';
  const key = `${c.network}:${String(c.handle).toLowerCase()}`;
  if (seen.has(key)) { status = 'skip'; why = 'duplicate'; }
  seen.add(key);
  const hit = isSuppressed(supp, c.contact, c.handle, c.post?.url);
  if (status === 'ok' && hit) { status = 'skip'; why = `on the suppression list (${hit})`; }
  if (status === 'ok' && c.followers > MAX_FOLLOWERS) { status = 'skip'; why = `${c.followers} followers: nano and micro only (up to ${MAX_FOLLOWERS})`; }
  if (status === 'ok' && eventDay && c.post?.date && new Date(c.post.date) < new Date(eventDay.getTime() - 864e5)) { status = 'skip'; why = `the post (${c.post.date}) is from before the event`; }
  const link = trackedLink(gameId, copy.campaign, { source: slug(c.handle.replace(/^@/, '')), medium: 'creator', content: c.network });
  out.push({ ...c, status, ...(why ? { why } : {}), link, text: c.message.replace('{link}', link), tier: c.followers <= 10_000 ? 'nano' : c.followers <= MAX_FOLLOWERS ? 'micro' : 'too big' });
}
if (errors.length) { console.error('creators.json has problems:\n- ' + errors.join('\n- ')); process.exit(1); }

writeFileSync(join(L, 'private', 'creators.checked.json'), JSON.stringify(out, null, 2) + '\n');
const ok = out.filter((c) => c.status === 'ok');
const md = [`# Creators: ${cfg.title}`, '', `${ok.length} to contact (free offer) · ${out.length - ok.length} skipped. Nothing sent, no money offered.`, '',
  ...out.flatMap((c, i) => [`## ${i + 1}. ${c.handle} · ${c.network} · ${c.followers.toLocaleString('en')} (${c.tier}) · ${c.status}${c.why ? `: ${c.why}` : ''}`, '',
    `Their post: [${c.post.date}](${c.post.url}): ${c.post.detail}`, `Send to: ${c.contact}`, '', '```', c.text, '```', ''])];
writeFileSync(join(L, 'private', 'creators.md'), md.join('\n'));
console.log(`[creators] ${ok.length} to contact, ${out.length - ok.length} skipped → launch/private/creators.md (nothing sent)`);
