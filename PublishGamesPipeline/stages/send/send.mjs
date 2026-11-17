#!/usr/bin/env node
// Stages "send-emails" and "send-creators" of /launch-game: the approved pitches and creator messages go out, at most
// config.outreach.dailyLimitPerSender a day, by a person. Runs only after the T0 gate and the user's approval of the
// stage. Every action lands in launch/private/sent.jsonl (names and contacts stay private).
//   node send.mjs <GameId> <pitches|creators> --next [--dry-run]     the next batch: what to send, where, the text
//   node send.mjs <GameId> <pitches|creators> --mark-sent <contact>
//   node send.mjs <GameId> <pitches|creators> --replied <contact> [note]
//   node send.mjs <GameId> <pitches|creators> --remove <contact>        a removal request: never contact again (any game)
//   node send.mjs <GameId> <pitches|creators> --status                  sent, replied, due for the one follow-up
//
// Email goes as an .eml file in launch/private/outbox/ that opens in the mail app as a ready draft from the studio
// mailbox, until the Gmail API is connected. Tip forms and DMs: paste the text. Nothing here sends by itself.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PIPE, config, launch, readJson, studio, slug } from '../../lib/outreach.mjs';
import { setT0, t0Passed } from '../../lib/state.mjs';

const args = process.argv.slice(2);
const [gameId, kind] = args;
if (!gameId || !['pitches', 'creators'].includes(kind)) { console.error('usage: node send.mjs <GameId> <pitches|creators> --next | --mark-sent <c> | --replied <c> | --remove <c> | --status'); process.exit(2); }
const L = launch(gameId);
const conf = config();
const st = studio();
const items = kind === 'pitches'
  ? readJson(join(L, 'private', 'pitches.final.json'), 'run the emails stage first').map((p) => ({ contact: p.contact, who: `${p.name}, ${p.outlet}`, channel: p.channel, subject: p.subject, text: p.text }))
  : readJson(join(L, 'private', 'creators.checked.json'), 'run the creators stage first').filter((c) => c.status === 'ok').map((c) => ({ contact: c.contact, who: `${c.handle} (${c.network})`, channel: /@.+\./.test(c.contact) && !c.contact.startsWith('@') ? 'email' : 'dm', network: c.network, text: c.text }));
const logFile = join(L, 'private', 'sent.jsonl');
const log = existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const write = (e) => appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), kind, ...e }) + '\n');
const find = (c) => { const it = items.find((i) => i.contact.toLowerCase() === String(c || '').toLowerCase()); if (!it) { console.error(`not in the ${kind} list: ${c}`); process.exit(1); } return it; };
const last = (c, action) => log.filter((e) => e.kind === kind && e.contact.toLowerCase() === c.toLowerCase() && e.action === action).pop();
const flagArg = (n) => { const i = args.indexOf(n); return i >= 0 ? args.slice(i + 1) : null; };

if (flagArg('--mark-sent')) {
  const it = find(flagArg('--mark-sent')[0]);
  if (last(it.contact, 'sent')) { console.log('already marked sent'); process.exit(0); }
  write({ contact: it.contact, action: 'sent', channel: it.channel });
  console.log(`[send] ${it.who}: sent. T0 = ${setT0(gameId)}`);
  process.exit(0);
}
if (flagArg('--replied')) {
  const [c, ...note] = flagArg('--replied'); const it = find(c);
  write({ contact: it.contact, action: 'replied', note: note.join(' ') });
  console.log(`[send] ${it.who}: reply recorded. Answer within 30 minutes (slide 8).`);
  process.exit(0);
}
if (flagArg('--remove')) {
  const it = find(flagArg('--remove')[0]);
  mkdirSync(join(PIPE, 'private'), { recursive: true });
  const f = join(PIPE, 'private', 'suppression.csv');
  if (!existsSync(f)) writeFileSync(f, 'value,date,note\n');
  appendFileSync(f, `${it.contact.toLowerCase()},${new Date().toISOString().slice(0, 10)},asked to be removed (${gameId})\n`);
  write({ contact: it.contact, action: 'removed' });
  console.log(`[send] ${it.who}: on the suppression list for every game.`);
  process.exit(0);
}

const sentNow = (c) => !!last(c, 'sent');
if (args.includes('--status')) {
  const hrs = conf.outreach.followUpAfterHours;
  for (const it of items) {
    const s = last(it.contact, 'sent'), r = last(it.contact, 'replied'), rm = last(it.contact, 'removed'), fu = last(it.contact, 'follow-up');
    const due = s && !r && !rm && !fu && kind === 'pitches' && Date.now() - new Date(s.at) > hrs * 3600e3;
    console.log(`${it.who.padEnd(40)} ${rm ? 'removed' : r ? `replied ${r.at.slice(0, 16)}` : s ? `sent ${s.at.slice(0, 16)}${due ? ` · one follow-up due (only if the event is still rising)` : ''}` : 'not sent'}`);
  }
  process.exit(0);
}

if (!args.includes('--next')) { console.error('nothing to do: --next, --mark-sent, --replied, --remove or --status'); process.exit(2); }
const dry = args.includes('--dry-run');
if (!dry && !t0Passed(gameId)) { console.error('[send] the T0 check is not 6/6 (launch/t0-check.md): nobody is contacted'); process.exit(1); }
const today = new Date().toISOString().slice(0, 10);
const sentToday = log.filter((e) => e.action === 'sent' && e.at.startsWith(today)).length; // pitches + creators: one studio sender
const room = Math.max(0, conf.outreach.dailyLimitPerSender - sentToday);
const todo = items.filter((i) => !sentNow(i.contact) && !last(i.contact, 'removed')).slice(0, room);
if (!todo.length) { console.log(room ? '[send] everything is sent' : `[send] today's limit (${conf.outreach.dailyLimitPerSender}) is reached: the rest goes tomorrow`); process.exit(0); }
const outbox = join(L, 'private', 'outbox');
mkdirSync(outbox, { recursive: true });
console.log(`[send] ${todo.length} to send now (${sentToday} sent today, limit ${conf.outreach.dailyLimitPerSender}). Space them a few minutes apart.${dry ? ' (dry run)' : ''}\n`);
for (const [n, it] of todo.entries()) {
  console.log(`${n + 1}. ${it.who} · ${it.channel}${it.channel === 'dm' && it.network ? ` on ${it.network}` : ''}`);
  if (it.channel === 'email') {
    const eml = join(outbox, `${String(n + 1).padStart(2, '0')}-${slug(it.who)}.eml`);
    const subj = it.subject || '';
    writeFileSync(eml, [`From: ${conf.senderName} <${st.email}>`, `To: ${it.contact}`, `Subject: =?UTF-8?B?${Buffer.from(subj).toString('base64')}?=`, 'X-Unsent: 1', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', it.text, ''].join('\r\n'));
    console.log(`   draft: ${eml}`);
  } else {
    console.log(`   where: ${it.contact}`);
    if (it.subject) console.log(`   subject/title field: ${it.subject}`);
    console.log('   text:\n' + it.text.split('\n').map((l) => '   | ' + l).join('\n'));
  }
  console.log(`   then: node PublishGamesPipeline/stages/send/send.mjs ${gameId} ${kind} --mark-sent "${it.contact}"\n`);
}
