#!/usr/bin/env node
// Stage "emails" of /launch-game (playbook slides 8 and 13): checks the personal pitches Claude drafted for each
// journalist who passed the journalists stage, adds the tracked link, signature and removal line, and writes the drafts
// the send stage uses. Nothing is sent here.
//   node build-pitches.mjs <GameId>
// In:  Games/<GameId>/launch/private/pitches.json  [{ "contact": "<same as in journalists.json>", "subject": "...", "body": "... {link} ..." }]
// Out: Games/<GameId>/launch/private/pitches.final.json, pitches.md
//
// Body rules: up to config.outreach.maxWords words before the signature; one line about their article (the
// "detail"), one about the game, "{link}" once. The script adds the signature, the press kit link and, for email,
// the removal line and (US) the studio's postal address (CAN-SPAM).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, gameCfg, isSuppressed, launch, readJson, studio, suppression } from '../../lib/outreach.mjs';

const gameId = process.argv[2];
if (!gameId) { console.error('usage: node build-pitches.mjs <GameId>'); process.exit(2); }
const L = launch(gameId);
const cfg = gameCfg(gameId);
const conf = config();
const st = studio();
const journalists = readJson(join(L, 'private', 'journalists.checked.json'), 'run the journalists stage first');
const pitches = readJson(join(L, 'private', 'pitches.json'), 'Claude drafts one pitch per journalist first (see the header of this file)');
const supp = suppression();
const press = `${(st.publicBase || '').replace(/\/$/, '')}/press/${cfg.slug}/`;

const SIGN = {
  en: (s) => `${s.senderName}\n${st.email}\nPress kit: ${press}`,
  he: (s) => `${s.senderName}\n${st.email}\nערכת עיתונות: ${press}`,
};
const REMOVE = {
  en: 'Not relevant to you? Reply "remove" and we will not write again.',
  he: 'לא רלוונטי? אפשר להשיב "הסר" ולא נפנה שוב.',
};

const ok = journalists.filter((j) => j.status === 'ok');
const byContact = new Map(ok.map((j) => [String(j.contact).toLowerCase(), j]));
const errors = [];
const out = [];
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
for (const p of pitches) {
  const j = byContact.get(String(p.contact || '').toLowerCase());
  const at = `pitch to ${p.contact}`;
  if (!j) { errors.push(`${at}: not an "ok" journalist in journalists.checked.json (blocked, skipped or unknown)`); continue; }
  if (isSuppressed(supp, j.contact)) { errors.push(`${at}: on the suppression list`); continue; }
  if (!p.body || (p.body.match(/\{link\}/g) || []).length !== 1) errors.push(`${at}: the body needs "{link}" exactly once`);
  const n = words((p.body || '').replace('{link}', ''));
  if (n > conf.outreach.maxWords) errors.push(`${at}: ${n} words, at most ${conf.outreach.maxWords}`);
  if (j.channel !== 'dm') {
    if (!p.subject || p.subject.length > 80) errors.push(`${at}: subject missing or over 80 characters`);
    else if (/^\s*(re|fwd?|fw)\s*:/i.test(p.subject)) errors.push(`${at}: the subject must not pretend to be a reply or forward`);
  }
  const detail = String(j.article.detail || '').toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  if (detail.length && !detail.some((w) => (p.body || '').toLowerCase().includes(w))) errors.push(`${at}: the body does not mention their article ("${j.article.detail}")`);
  const lang = j.lang === 'he' ? 'he' : 'en';
  const tail = [SIGN[lang](conf)];
  if (j.channel === 'email') {
    if (j.country === 'US' && !conf.postalAddress) errors.push(`${at}: US email needs the studio's postal address (config.postalAddress, CAN-SPAM)`);
    tail.push(REMOVE[lang]);
    if (conf.postalAddress) tail.push(conf.postalAddress);
  }
  const text = `${(p.body || '').replace('{link}', j.link).trim()}\n\n${tail.join('\n\n')}`;
  out.push({ contact: j.contact, name: j.name, outlet: j.outlet, country: j.country, channel: j.channel, lang, ...(p.subject && j.channel !== 'dm' ? { subject: p.subject } : {}), text, link: j.link, words: n, status: 'draft' });
}
const missing = ok.filter((j) => !out.some((o) => o.contact === j.contact)).map((j) => `${j.name} (${j.outlet})`);
if (missing.length) errors.push(`no pitch for: ${missing.join(', ')}`);
if (errors.length) { console.error('pitches.json has problems:\n- ' + errors.join('\n- ')); process.exit(1); }

writeFileSync(join(L, 'private', 'pitches.final.json'), JSON.stringify(out, null, 2) + '\n');
const how = { 'tip-form': 'paste into the form', dm: 'send as a DM', email: 'email' };
const md = [`# Pitches: ${cfg.title}`, '', `${out.length} drafts. Nothing has been sent.`, '',
  ...out.flatMap((o, i) => [`## ${i + 1}. ${o.name}, ${o.outlet} (${o.country}) · ${how[o.channel]} · ${o.words} words`, '', `To: ${o.contact}`, ...(o.subject ? [`Subject: ${o.subject}`] : []), '', '```', o.text, '```', ''])];
writeFileSync(join(L, 'private', 'pitches.md'), md.join('\n'));
console.log(`[emails] ${out.length} drafts → launch/private/pitches.md (nothing sent)`);
