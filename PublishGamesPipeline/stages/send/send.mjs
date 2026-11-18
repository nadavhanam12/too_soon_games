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
// a tip form that is an address (an outlet's tips inbox) is sent as an email too: it gets a draft like a cold email
const isAddress = (c) => /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(String(c));
for (const [n, it] of todo.entries()) {
  console.log(`${n + 1}. ${it.who} · ${it.channel}${it.channel === 'dm' && it.network ? ` on ${it.network}` : ''}`);
  if (it.channel === 'email' || isAddress(it.contact)) {
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
// outbox/batch.html: the batch as one local page to send from (copy buttons; a mailto: link opens the default mail app
// with the draft, for a Gmail mailbox, which does not open .eml files). Local only: it stays in launch/private.
{
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // the GIF goes into the page once (a data URL a script hands to every card): it shows wherever the page is opened,
  // also as a copy outside the folder, where a relative path to launch/videos would break
  const gifFile = join(L, 'videos', 'email.gif');
  const gifData = existsSync(gifFile) ? `data:image/gif;base64,${readFileSync(gifFile).toString('base64')}` : '';
  const gif = gifData ? '' : null;   // the cards' img src is set by the script below
  const copy = (label, val) => `<button onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent);this.textContent='Copied'">${label}</button><pre>${esc(val)}</pre>`;
  const card = (it, i) => {
    const mail = it.channel === 'email' || isAddress(it.contact);
    const go = mail ? `<a class="go" href="mailto:${encodeURIComponent(it.contact)}?subject=${encodeURIComponent(it.subject || '')}&amp;body=${encodeURIComponent(it.text)}">Open as an email</a>`
      : /^https?:/.test(it.contact) ? `<a class="go" href="${esc(it.contact)}" target="_blank" rel="noopener">Open the form</a>` : `<span class="go">DM ${esc(it.contact)}</span>`;
    // the email GIF (videos stage): dragged into the email body it shows the game's colours at once (inline, not an
    // attachment: a cold pitch with attachments is opened less and filtered more); a form that takes an image gets it too
    const media = gif !== null ? `<figure><img class="gif" alt="" width="150" draggable="true"><figcaption>${mail ? 'Drag this GIF into the email, under the text' : /^https?:/.test(it.contact) ? 'If the form takes an image, upload this GIF' : 'Send this GIF with the message'}</figcaption></figure>` : '';
    return `<section><h2>${i + 1}. ${esc(it.who)} <small>${esc(it.channel)}</small></h2>${go}${media}${copy('Copy address', it.contact)}${it.subject ? copy('Copy subject', it.subject) : ''}${copy('Copy text', it.text)}<code>node PublishGamesPipeline/stages/send/send.mjs ${gameId} ${kind} --mark-sent "${esc(it.contact)}"</code></section>`;
  };
  writeFileSync(join(outbox, 'batch.html'), `<!doctype html><meta charset="utf-8"><title>${kind} batch · ${gameId}</title><style>body{font:15px system-ui;max-width:760px;margin:24px auto;padding:0 16px;background:#111;color:#eee}section{border:1px solid #333;border-radius:10px;padding:12px 16px;margin:14px 0}h2{font-size:17px;margin:0 0 8px}small{color:#999;font-weight:400}pre{white-space:pre-wrap;background:#1c1c1c;padding:8px;border-radius:6px;margin:4px 0 10px}button{background:#333;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer}a.go,span.go{display:inline-block;background:#ffcc00;color:#111;font-weight:700;border-radius:999px;padding:6px 14px;margin:0 0 10px;text-decoration:none}code{color:#999;font-size:12px}figure{float:right;margin:0 0 8px 12px;text-align:center}figcaption{font-size:12px;color:#bbb;max-width:150px}img{border-radius:8px;cursor:grab}</style><h1>${esc(kind)}: ${todo.length} to send</h1><p>Send each one, then tell Claude (or run its mark-sent line). A few minutes apart.</p>${todo.map(card).join('')}${gifData ? `<script>const g=${JSON.stringify(gifData)};for(const i of document.querySelectorAll('img.gif'))i.src=g;</script>` : ''}`);
  console.log(`[send] one page to send from: ${join(outbox, 'batch.html')}`);
}
