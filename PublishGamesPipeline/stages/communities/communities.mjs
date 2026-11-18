#!/usr/bin/env node
// Stages "communities" (prepare) and "post-communities" (distribute) of /launch-game: one Reddit post per subreddit,
// each in that subreddit's format and rules, posted by a person, spread out. Guide: PublishGamesPipeline/profile/reddit.md.
//   node communities.mjs <GameId>                          prepare: check launch/communities.json → communities.final.json + .md
//   node communities.mjs <GameId> --next [--dry-run]        distribute: the next post that is due (spacing + each sub's frequency)
//   node communities.mjs <GameId> --mark-posted <sub> <url>
//   node communities.mjs <GameId> --status
//
// launch/communities.json (written by Claude in the skill, in English, from copy.final.json and research.md):
// {
//   "reddit": [
//     { "sub": "WebGames",    "kind": "link",  "title": "Nice City: ... (free, 1 min, browser)", "comment": "I made this. ..." },
//     { "sub": "IndieGaming", "kind": "video", "clip": "hook", "title": "...", "comment": "I made this ... made with AI help ... {link}" },
//     { "sub": "GTA6",        "kind": "link",  "title": "...", "comment": "...", "modOk": "modmail reply 2026-11-19: ok in the fan thread" }
//   ]
// }
// "link" posts the tracked link as the post itself; "video" uploads the clip, and "{link}" goes in "body" or "comment".
// A subreddit that is not in SUBS (an event's own sub) needs "modOk": what its moderators answered. Reddit has no posting
// API for us (profile/reddit.md, API), so every post is made by hand from the packet this prints.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameCfg, launch, readJson, trackedLink } from '../../lib/outreach.mjs';
import { REPO, logAction, setT0, t0Passed } from '../../lib/state.mjs';

// The subreddits in profile/reddit.md, as their rules stood on 2026-11-18 (read through mirrors: check /about/rules
// before the first post in each). everyDays = at most one post of ours per that many days, across all games.
const SUBS = {
  WebGames: { kinds: ['link'], noSiteName: true, startsWithGame: true },
  playmygame: { kinds: ['video', 'link'], everyDays: 30, linkInBody: true },
  IndieGaming: { kinds: ['video'], everyDays: 14, aiDisclosure: true },
  indiegames: { kinds: ['video'], flair: ['Video', 'Gif', 'Promotion'], noQuestionTitle: true },
  IndieDev: { kinds: ['video'] },
  DestroyMyGame: { kinds: ['video'] },
};
const GAP_HOURS = 3; // between two of our Reddit posts, any game: the same clip in several subs on one day gets removed
const TITLE_MAX = 300; // Reddit's title limit

const args = process.argv.slice(2);
const gameId = args[0];
if (!gameId) { console.error('usage: node communities.mjs <GameId> [--next [--dry-run] | --mark-posted <sub> <url> | --status]'); process.exit(2); }
const L = launch(gameId);
const cfg = gameCfg(gameId);
const finalFile = join(L, 'communities.final.json');
const postedFile = join(L, 'communities.posted.json');
const readPosted = (dir) => { const f = join(dir, 'communities.posted.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; };
const keyOf = (sub) => `reddit:${sub.toLowerCase()}`;

if (args.length === 1) prepare();
else if (args.includes('--status')) status();
else if (args.includes('--mark-posted')) markPosted();
else if (args.includes('--next')) next();
else { console.error('unknown flags'); process.exit(2); }

function prepare() {
  const input = readJson(join(L, 'communities.json'), 'Claude writes it first (see the header of this file)');
  const copy = existsSync(join(L, 'copy.final.json')) ? JSON.parse(readFileSync(join(L, 'copy.final.json'), 'utf8')) : null;
  const videos = existsSync(join(L, 'videos', 'videos.json')) ? JSON.parse(readFileSync(join(L, 'videos', 'videos.json'), 'utf8')) : null;
  const clips = new Set((videos?.clips || []).map((c) => c.name));
  const campaign = copy?.campaign || `${cfg.slug}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const gameName = cfg.title.replace(/^TSG:\s*/, '');
  const problems = [], warnings = [], out = [];
  const seen = new Set();
  for (const p of input.reddit || []) {
    const sub = String(p.sub || '').replace(/^\/?r\//, '');
    const rule = SUBS[sub];
    const at = `r/${sub}`;
    if (!sub) { problems.push('a post without "sub"'); continue; }
    if (seen.has(sub.toLowerCase())) problems.push(`${at}: twice in this game`);
    seen.add(sub.toLowerCase());
    if (!rule && !p.modOk) problems.push(`${at}: not one of ${Object.keys(SUBS).join(', ')}; an event's own sub needs "modOk" (what its moderators answered)`);
    if (!['link', 'video'].includes(p.kind)) problems.push(`${at}: kind is "link" or "video"`);
    if (rule && !rule.kinds.includes(p.kind)) problems.push(`${at}: takes ${rule.kinds.join(' or ')} posts`);
    if (!p.title || p.title.length > TITLE_MAX) problems.push(`${at}: title missing or over ${TITLE_MAX} characters`);
    if (!p.comment) problems.push(`${at}: the first comment is missing ("I made this." + what it is + a question)`);
    if (/too ?soon|toosoongames/i.test(p.title || '') && rule?.noSiteName) problems.push(`${at}: no site name in the title`);
    if (rule?.startsWithGame && !(p.title || '').toLowerCase().startsWith(gameName.toLowerCase())) warnings.push(`${at}: the title should start with the game's name ("${gameName}")`);
    if (rule?.noQuestionTitle && /\?/.test(p.title || '')) problems.push(`${at}: no question in the title`);
    if (rule?.flair && !rule.flair.includes(p.flair)) problems.push(`${at}: flair is required, one of ${rule.flair.join(', ')}`);
    if (rule?.aiDisclosure && !/\bAI\b/.test(`${p.body || ''} ${p.comment || ''}`)) problems.push(`${at}: say that AI was used (the sub requires it)`);
    if (p.kind === 'video') {
      if (videos && !clips.has(p.clip)) problems.push(`${at}: clip "${p.clip}" is not one of ${[...clips].join(', ')}`);
      const where = rule?.linkInBody ? 'body' : null;
      if (where && !(p.body || '').includes('{link}')) problems.push(`${at}: the link goes in the post body ("body" with {link})`);
      if (!where && !`${p.body || ''}${p.comment || ''}`.includes('{link}')) problems.push(`${at}: {link} is in neither body nor comment`);
    } else if (`${p.body || ''}${p.comment || ''}`.includes('{link}')) {
      problems.push(`${at}: a link post is the link itself; no {link} in the text`);
    }
    const link = trackedLink(gameId, campaign, { source: 'reddit', medium: 'community', content: sub.toLowerCase() });
    const fill = (s) => (s ? s.replace('{link}', link) : undefined);
    out.push({ sub, kind: p.kind, title: p.title, ...(p.flair ? { flair: p.flair } : {}), ...(p.clip ? { clip: p.clip } : {}), ...(p.body ? { body: fill(p.body) } : {}), comment: fill(p.comment), link, ...(rule?.everyDays ? { everyDays: rule.everyDays } : {}), ...(p.modOk ? { modOk: p.modOk } : {}) });
  }
  if (!out.length && !problems.length) problems.push('reddit: at least one post');
  if (problems.length) { console.error('communities.json has problems:\n- ' + problems.join('\n- ')); process.exit(1); }
  writeFileSync(finalFile, JSON.stringify({ game: gameId, campaign, reddit: out }, null, 2) + '\n');
  const md = [`# Communities: ${cfg.title}`, '', `Campaign \`${campaign}\` · posted by hand, ${GAP_HOURS}+ hours apart (\`--next\` picks the order)`, '',
    ...(warnings.length ? ['**Check:**', ...warnings.map((w) => `- ${w}`), ''] : []),
    ...out.flatMap((p) => [`## r/${p.sub} · ${p.kind}${p.clip ? ` \`${p.clip}\`` : ''}${p.flair ? ` · flair ${p.flair}` : ''}${p.everyDays ? ` · once per ${p.everyDays} days` : ''}`, '',
      `**${p.title}**`, '', ...(p.kind === 'link' ? [`Link: ${p.link}`, ''] : []), ...(p.body ? [p.body, ''] : []), `First comment: ${p.comment}`, '', ...(p.modOk ? [`Moderators: ${p.modOk}`, ''] : [])])];
  writeFileSync(join(L, 'communities.md'), md.join('\n'));
  console.log(`[communities] ${out.length} posts → launch/communities.final.json, review: launch/communities.md${warnings.length ? ` (${warnings.length} to check)` : ''}`);
}

/** Our Reddit posts in every game, newest first: { game, sub, at }. The frequency rules count across games. */
function allPosts() {
  const games = join(REPO, 'Games');
  return readdirSync(games, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) =>
    Object.entries(readPosted(join(games, d.name, 'launch'))).filter(([k]) => k.startsWith('reddit:')).map(([k, v]) => ({ game: d.name, sub: k.slice(7), at: new Date(v.at) })))
    .sort((a, b) => b.at - a.at);
}

function next() {
  const dry = args.includes('--dry-run');
  if (!dry && !t0Passed(gameId)) { console.error('[communities] the T0 check is not 6/6 (launch/t0-check.md): nothing is posted'); process.exit(1); }
  const plan = readJson(finalFile, 'run the communities stage first');
  const mine = readPosted(L);
  const history = allPosts();
  const now = Date.now();
  const lastAny = history[0];
  if (lastAny && now - lastAny.at < GAP_HOURS * 3600e3) {
    const wait = Math.ceil((GAP_HOURS * 3600e3 - (now - lastAny.at)) / 60e3);
    console.log(`[communities] last Reddit post was r/${lastAny.sub} (${lastAny.game}) at ${lastAny.at.toISOString()}: next one in ${wait} min`);
    process.exit(0);
  }
  for (const p of plan.reddit) {
    if (mine[keyOf(p.sub)]) continue;
    const prev = history.find((h) => h.sub === p.sub.toLowerCase());
    if (p.everyDays && prev && now - prev.at < p.everyDays * 86400e3) {
      console.log(`[communities] r/${p.sub}: skipped, we posted there ${prev.at.toISOString().slice(0, 10)} (${prev.game}); once per ${p.everyDays} days`);
      continue;
    }
    const packet = [`r/${p.sub} · ${p.kind}${p.flair ? ` · flair ${p.flair}` : ''}`, `  open:    https://www.reddit.com/r/${p.sub}/submit`, `  title:   ${p.title}`];
    if (p.kind === 'link') packet.push(`  link:    ${p.link}`);
    else {
      const dir = join(L, 'videos', 'post', 'reddit'); // under launch/videos/: heavy, never in git
      mkdirSync(dir, { recursive: true });
      const video = join(dir, `${gameId}-${p.sub}.mp4`);
      if (!dry) copyFileSync(join(L, 'videos', `${p.clip}.mp4`), video);
      packet.push(`  video:   ${video}`);
    }
    if (p.body) packet.push(`  body:    ${p.body}`);
    packet.push(`  comment: ${p.comment}   ← post it right after, as the first comment`, `  then:    node PublishGamesPipeline/stages/communities/communities.mjs ${gameId} --mark-posted ${p.sub} <post url>`);
    console.log((dry ? '[communities] dry-run, would post:\n' : '') + packet.join('\n'));
    return;
  }
  console.log('[communities] nothing due: every post is posted or waiting for its sub\'s frequency rule');
}

function markPosted() {
  const i = args.indexOf('--mark-posted');
  const sub = String(args[i + 1] || '').replace(/^\/?r\//, ''), url = args[i + 2];
  const plan = readJson(finalFile, 'run the communities stage first');
  if (!plan.reddit.some((p) => p.sub.toLowerCase() === sub.toLowerCase()) || !/^https?:\/\//.test(url || '')) { console.error('--mark-posted <sub from communities.final.json> <post url>'); process.exit(2); }
  const posted = readPosted(L);
  posted[keyOf(sub)] = { url, at: new Date().toISOString() };
  writeFileSync(postedFile, JSON.stringify(posted, null, 2) + '\n');
  logAction(gameId, 'post-communities', { network: 'reddit', sub, url, how: 'by hand' });
  console.log(`[communities] r/${sub} recorded. T0 = ${setT0(gameId)}`);
}

function status() {
  const plan = readJson(finalFile, 'run the communities stage first');
  const posted = readPosted(L);
  for (const p of plan.reddit) {
    const v = posted[keyOf(p.sub)];
    console.log(`r/${p.sub.padEnd(16)} ${v ? `posted ${v.at} ${v.url}` : 'not posted'}`);
  }
}
