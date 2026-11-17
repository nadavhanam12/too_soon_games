#!/usr/bin/env node
// Stage "copy" of /launch-game: checks the post copy Claude wrote, adds a tracked link per network, and writes the
// review file and the final file the post stage reads.
//   node build-copy.mjs <GameId>
// In:  Games/<GameId>/launch/copy.json         (written by Claude in the skill; shape below)
// Out: Games/<GameId>/launch/copy.final.json   (what `post` and `press-kit` read)
//      Games/<GameId>/launch/copy.md           (what the user reviews)
//
// copy.json:
// {
//   "hashtags": ["#Tag", ...],                       // the event's hashtag first; used where a network wants them
//   "description": "two lines for bios, press, link previews",
//   "press": { "headline": "...", "about": "3-5 sentences", "facts": ["..."] },
//   "posts": {                                       // only the networks to post on; order = posting order
//     "tiktok":    { "text": "...", "clip": "hook" },
//     "instagram": { "text": "...", "clip": "hook" },
//     "youtube":   { "title": "...", "text": "...", "clip": "arc" },
//     "x":         { "text": "... {link}", "clip": "challenge" },
//     "facebook":  { "text": "... {link}", "clip": "hook" },
//     "threads":   { "text": "... {link}", "clip": "challenge" }
//   }
// }
// "{link}" is replaced with the tracked link. TikTok and Instagram captions cannot hold a clickable link, so their
// "{link}" is refused there; the profile carries a tracked link to the studio site instead (`profileLink`).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const gameId = process.argv[2];
if (!gameId) { console.error('usage: node build-copy.mjs <GameId>'); process.exit(2); }
const GAME = join(REPO, 'Games', gameId);
const LAUNCH = join(GAME, 'launch');
const cfg = JSON.parse(readFileSync(join(GAME, 'game.json'), 'utf8'));
const studio = JSON.parse(readFileSync(join(REPO, 'GamesTemplate', 'studio.json'), 'utf8'));
const inFile = join(LAUNCH, 'copy.json');
if (!existsSync(inFile)) { console.error(`${inFile} missing: Claude writes it first (see the header of this file)`); process.exit(1); }
const copy = JSON.parse(readFileSync(inFile, 'utf8'));
const videos = existsSync(join(LAUNCH, 'videos', 'videos.json')) ? JSON.parse(readFileSync(join(LAUNCH, 'videos', 'videos.json'), 'utf8')) : null;

// Limits as the networks publish them; `url` = how many characters a link counts for (X shortens every link to 23).
const NETS = {
  tiktok: { label: 'TikTok', text: 2200, linkInText: false, hashtagsMax: 8 },
  instagram: { label: 'Instagram Reels', text: 2200, linkInText: false, hashtagsMax: 30 },
  youtube: { label: 'YouTube Shorts', text: 5000, title: 100, linkInText: true },
  x: { label: 'X', text: 280, url: 23, linkInText: true },
  facebook: { label: 'Facebook Reels', text: 5000, linkInText: true },
  threads: { label: 'Threads', text: 500, linkInText: true },
};

// utm_campaign = <slug>-<release day>; before the release it is today, and the post stage rebuilds the file on the day.
const rel = existsSync(join(GAME, '.release.json')) ? JSON.parse(readFileSync(join(GAME, '.release.json'), 'utf8')) : null;
const day = (rel?.publishedAt ? new Date(rel.publishedAt) : new Date()).toISOString().slice(0, 10).replace(/-/g, '');
const base = `${(studio.publicBase || '').replace(/\/$/, '')}/${cfg.slug}/`;
// The studio's profile on a network links to the studio site, not to one game (the account outlives the game); the site
// carries the UTM tags on to whichever game the visitor opens (frontend layout.ts).
const profileLink = (source) => `${(studio.publicBase || '').replace(/\/$/, '')}/?utm_source=${source}&utm_medium=social&utm_campaign=profile`;
const link = (source) => `${base}?utm_source=${source}&utm_medium=social&utm_campaign=${cfg.slug}-${day}`;

const problems = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };
need(Array.isArray(copy.hashtags) && copy.hashtags.length, 'hashtags: at least one');
need(typeof copy.description === 'string' && copy.description.length > 20, 'description: two lines');
need(copy.press?.headline && copy.press?.about, 'press: headline and about');
need(copy.posts && Object.keys(copy.posts).length, 'posts: at least one network');

const clipNames = new Set((videos?.clips || []).map((c) => c.name));
const final = { game: gameId, lang: cfg.lang, campaign: `${cfg.slug}-${day}`, hashtags: copy.hashtags, description: copy.description, press: copy.press, posts: {} };
for (const [net, p] of Object.entries(copy.posts || {})) {
  const n = NETS[net];
  if (!n) { problems.push(`posts.${net}: unknown network (${Object.keys(NETS).join(', ')})`); continue; }
  const url = link(net);
  if (!n.linkInText && p.text.includes('{link}')) problems.push(`${n.label}: a caption link is not clickable there, drop {link} (its tracked link goes in the profile)`);
  if (n.linkInText && !p.text.includes('{link}')) problems.push(`${n.label}: the text has no {link}`);
  const text = p.text.replace('{link}', url);
  const counted = n.url ? p.text.replace('{link}', 'x'.repeat(n.url)).length : text.length;
  if (counted > n.text) problems.push(`${n.label}: ${counted} characters, the limit is ${n.text}`);
  if (n.title && (!p.title || p.title.length > n.title)) problems.push(`${n.label}: title missing or over ${n.title} characters`);
  const tags = (text.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  if (n.hashtagsMax && tags > n.hashtagsMax) problems.push(`${n.label}: ${tags} hashtags, at most ${n.hashtagsMax}`);
  if (videos && !clipNames.has(p.clip)) problems.push(`${n.label}: clip "${p.clip}" is not one of ${[...clipNames].join(', ')}`);
  final.posts[net] = { network: n.label, ...(p.title ? { title: p.title } : {}), text, link: url, ...(n.linkInText ? {} : { profileLink: profileLink(net) }), clip: p.clip, chars: counted };
}

if (problems.length) { console.error('copy.json has problems:\n- ' + problems.join('\n- ')); process.exit(1); }

writeFileSync(join(LAUNCH, 'copy.final.json'), JSON.stringify(final, null, 2) + '\n');
const md = [
  `# Copy: ${cfg.title}`, '',
  `Campaign \`${final.campaign}\``, '',
  `**Description:** ${copy.description}`, '',
  `**Hashtags:** ${copy.hashtags.join(' ')}`, '',
  '## Posts', '',
  ...Object.values(final.posts).flatMap((p) => [`### ${p.network} · clip \`${p.clip}\` · ${p.chars} chars`, '', ...(p.title ? [`**${p.title}**`, ''] : []), p.text, '', ...(p.profileLink ? [`Link for the profile, to the studio site (a caption link is not clickable there): ${p.profileLink}`, ''] : [])]),
  '## Press', '', `**${copy.press.headline}**`, '', copy.press.about, '', ...(copy.press.facts || []).map((f) => `- ${f}`), '',
];
writeFileSync(join(LAUNCH, 'copy.md'), md.join('\n'));
console.log(`[copy] ${Object.keys(final.posts).length} networks → launch/copy.final.json, review: launch/copy.md`);
