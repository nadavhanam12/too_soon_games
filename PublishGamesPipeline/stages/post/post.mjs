#!/usr/bin/env node
// Stage "post" of /launch-game: the studio's posts, one per network in copy.final.json. Runs only after the T0 gate
// passed and the user approved this stage in chat.
//   node post.mjs <GameId> [--network x] [--dry-run]       prepare the upload packets (and post where an adapter exists)
//   node post.mjs <GameId> --mark-posted <network> <url>    record a post the user published by hand
//   node post.mjs <GameId> --status
//
// A network posts by itself only when it has an adapter in ./adapters/<network>.mjs AND its credentials are set (the
// adapter says which). The accounts are connected one by one (the user's decision); until then the packet is the
// video, the caption and the upload page, and a person presses publish.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, readJson } from '../../lib/outreach.mjs';
import { logAction, setT0, t0Passed } from '../../lib/state.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const gameId = args[0];
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!gameId) { console.error('usage: node post.mjs <GameId> [--network x] [--dry-run] | --mark-posted <network> <url> | --status'); process.exit(2); }
const L = launch(gameId);
const copy = readJson(join(L, 'copy.final.json'), 'run the copy stage first');
const postsFile = join(L, 'posts.json');
const posts = existsSync(postsFile) ? JSON.parse(readFileSync(postsFile, 'utf8')) : {};
const save = () => writeFileSync(postsFile, JSON.stringify(posts, null, 2) + '\n');

const UPLOAD = {
  tiktok: 'https://www.tiktok.com/tiktokstudio/upload',
  instagram: 'https://www.instagram.com/ (Create → Reel)',
  youtube: 'https://studio.youtube.com/ (Create → Upload videos; vertical and under 60 s becomes a Short)',
  x: 'https://x.com/compose/post',
  facebook: 'https://business.facebook.com/latest/reels_composer',
  threads: 'https://www.threads.net/ (New thread → attach video)',
};

if (args.includes('--status')) {
  for (const net of Object.keys(copy.posts)) console.log(`${net.padEnd(10)} ${posts[net]?.url ? `posted ${posts[net].at} ${posts[net].url}` : posts[net]?.prepared ? 'prepared, not posted' : 'not prepared'}`);
  process.exit(0);
}

if (args.includes('--mark-posted')) {
  const i = args.indexOf('--mark-posted'); const net = args[i + 1], url = args[i + 2];
  if (!copy.posts[net] || !/^https?:\/\//.test(url || '')) { console.error('--mark-posted <network> <post url>'); process.exit(2); }
  const t0 = setT0(gameId); // the first post starts the clock of the gates
  posts[net] = { ...(posts[net] || {}), url, at: new Date().toISOString() };
  save();
  logAction(gameId, 'post', { network: net, url, how: 'by hand' });
  console.log(`[post] ${net} recorded. T0 = ${t0}`);
  process.exit(0);
}

const dry = args.includes('--dry-run');
if (!dry && !t0Passed(gameId)) { console.error('[post] the T0 check is not 6/6 (launch/t0-check.md): nothing is posted'); process.exit(1); }
const nets = opt('--network') ? [opt('--network')] : Object.keys(copy.posts);
for (const net of nets) {
  const p = copy.posts[net];
  if (!p) { console.error(`[post] no copy for ${net}`); process.exit(1); }
  if (posts[net]?.url) { console.log(`[post] ${net}: already posted (${posts[net].url})`); continue; }
  const dir = join(L, 'videos', 'post', net); // under launch/videos/: heavy, never in git
  mkdirSync(dir, { recursive: true });
  const video = join(dir, `${gameId}-${net}.mp4`);
  copyFileSync(join(L, 'videos', `${p.clip}.mp4`), video);
  copyFileSync(join(L, 'videos', 'cover.png'), join(dir, 'cover.png'));
  writeFileSync(join(dir, 'caption.txt'), (p.title ? `${p.title}\n\n` : '') + p.text + '\n');
  const adapterFile = join(HERE, 'adapters', `${net}.mjs`);
  const adapter = existsSync(adapterFile) ? await import(pathToFileURL(adapterFile).href) : null;
  const ready = adapter?.ready?.() ?? false;
  if (dry) { console.log(`[post] dry-run ${net}: ${ready ? 'would post via API' : 'packet ready, by hand'} · clip ${p.clip} · ${dir}`); continue; }
  if (ready) {
    const r = await adapter.post({ video, cover: join(dir, 'cover.png'), text: p.text, title: p.title });
    const t0 = setT0(gameId);
    posts[net] = { prepared: true, url: r.url, at: new Date().toISOString(), how: 'api' };
    save();
    logAction(gameId, 'post', { network: net, url: r.url, how: 'api' });
    console.log(`[post] ${net}: posted ${r.url} (T0 ${t0})`);
  } else {
    posts[net] = { ...(posts[net] || {}), prepared: true };
    save();
    console.log(`[post] ${net}: by hand → ${UPLOAD[net]}\n        video ${video}\n        caption ${join(dir, 'caption.txt')}${net === 'tiktok' || net === 'instagram' ? `\n        bio link ${copy.bioLink}` : ''}\n        then: node PublishGamesPipeline/stages/post/post.mjs ${gameId} --mark-posted ${net} <post url>`);
  }
}
