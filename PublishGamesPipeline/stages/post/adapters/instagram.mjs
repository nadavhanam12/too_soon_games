#!/usr/bin/env node
// Instagram adapter for stage "post": one Reel, through the Instagram API with Instagram Login (no Facebook Page).
// post.mjs calls ready() and post({video, cover, text, title}) → {url}.
//
// One-time setup (the user does it; keys never go through chat):
//   1. The Instagram account must be a professional account (Creator or Business): the API refuses personal ones.
//   2. developers.facebook.com: an app with the product "Instagram" → "API setup with Instagram login". Add the
//      studio account under Roles as an Instagram tester, accept the invitation in the Instagram app, then press
//      "Generate token" next to the account. In development mode this works for the studio's own account without
//      App Review.
//   3. Copy instagram.env.example to PublishGamesPipeline/private/instagram.env and paste the token.
//      node instagram.mjs whoami     checks the token and prints the account
//
// Instagram's rules that shape this file (developers.facebook.com/docs/instagram-platform/content-publishing):
//   - With Instagram Login the video cannot be sent from this machine: Instagram fetches it from a public URL. The
//     only public copy of a clip is the press kit's (toosoongames.app/press/<slug>/media/clip.mp4, the hook clip),
//     so before anything is created the adapter downloads that file and checks it is byte for byte the video it was
//     asked to post. If it is not (the press kit is older than the clip, or the post uses another clip), it stops
//     and says so: rebuild the press kit and publish the site.
//   - A Reel is made in three steps: a container, waiting until Instagram finished processing it, then publish.
//   - The long-lived token lasts 60 days and can be refreshed once it is a day old: the adapter refreshes it when it
//     is more than 30 days old and writes the new one back to instagram.env.
//   - The cover is a frame of the video (thumb_offset), as in the TikTok adapter.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..', '..');
const ENV_FILE = resolve(HERE, '..', '..', '..', 'private', 'instagram.env');
const API = 'https://graph.instagram.com/v27.0';
const COVER_MS = 1000;
const POLL_S = 15, POLL_MAX = 20;      // 5 minutes: the docs say a container is ready within that, or it failed
const REFRESH_AFTER_DAYS = 30;

function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const env = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
function saveEnv(key, value) {
  const lines = readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  const i = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
  if (i >= 0) lines[i] = `${key}=${value}`; else lines.push(`${key}=${value}`);
  writeFileSync(ENV_FILE, lines.join('\n'));
}

export function ready() { return !!readEnv().INSTAGRAM_TOKEN; }

async function call(method, path, params) {
  const q = new URLSearchParams(params);
  const r = await fetch(method === 'GET' ? `${API}${path}?${q}` : `${API}${path}`, method === 'GET' ? {} : { method, body: q });
  const j = await r.json();
  if (j.error) throw new Error(`Instagram ${method} ${path}: ${j.error.message} (code ${j.error.code}${j.error.error_subcode ? `/${j.error.error_subcode}` : ''})`);
  return j;
}

async function accessToken() {
  const e = readEnv();
  const ageDays = e.INSTAGRAM_TOKEN_DATE ? (Date.now() - Date.parse(e.INSTAGRAM_TOKEN_DATE)) / 86400000 : 0;
  if (ageDays < REFRESH_AFTER_DAYS) return e.INSTAGRAM_TOKEN;
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: e.INSTAGRAM_TOKEN })}`);
  const j = await r.json();
  if (!j.access_token) throw new Error(`Instagram token refresh failed: ${j.error?.message || r.status}. Generate a new token in the app dashboard and paste it into instagram.env`);
  saveEnv('INSTAGRAM_TOKEN', j.access_token); saveEnv('INSTAGRAM_TOKEN_DATE', new Date().toISOString().slice(0, 10));
  return j.access_token;
}

/** The public URL of the clip, after proving it is the same file as `video`. */
async function publicCopy(video) {
  const gameId = basename(video).replace(/-instagram\.mp4$/, '');
  const gameFile = join(REPO, 'Games', gameId, 'game.json');
  if (!existsSync(gameFile)) throw new Error(`cannot tell which game ${video} belongs to (expected <GameId>-instagram.mp4)`);
  const studio = JSON.parse(readFileSync(join(REPO, 'GamesTemplate', 'studio.json'), 'utf8'));
  const url = `${studio.publicBase.replace(/\/$/, '')}/press/${JSON.parse(readFileSync(gameFile, 'utf8')).slug}/media/clip.mp4`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Instagram needs the video at a public URL, and ${url} answers HTTP ${r.status}: run the press-kit stage for ${gameId} and publish the site`);
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  if (sha(Buffer.from(await r.arrayBuffer())) !== sha(readFileSync(video))) throw new Error(`${url} is not the clip this post uses (an older recording, or the post's clip is not the hook): rebuild the press kit for ${gameId} and publish the site, then post again`);
  return url;
}

export async function post({ video, text }) {
  const url = await publicCopy(video);
  const token = await accessToken();
  const me = await call('GET', '/me', { fields: 'user_id,username', access_token: token });
  const box = await call('POST', `/${me.user_id}/media`, { media_type: 'REELS', video_url: url, caption: text, share_to_feed: 'true', thumb_offset: String(COVER_MS), access_token: token });
  for (let i = 0; ; i++) {
    const st = await call('GET', `/${box.id}`, { fields: 'status_code,status', access_token: token });
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error(`Instagram could not process the video: ${st.status_code} ${st.status || ''} (container ${box.id})`);
    if (i >= POLL_MAX) throw new Error(`Instagram is still processing after ${(POLL_S * POLL_MAX) / 60} minutes (container ${box.id}): nothing was published`);
    await new Promise((res) => setTimeout(res, POLL_S * 1000));
  }
  const made = await call('POST', `/${me.user_id}/media_publish`, { creation_id: box.id, access_token: token });
  const media = await call('GET', `/${made.id}`, { fields: 'permalink', access_token: token });
  return { url: media.permalink };
}

// ---------- token check, run by the user ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!ready()) { console.error(`paste the token into ${ENV_FILE} first (template: ${join(HERE, 'instagram.env.example')})`); process.exit(1); }
  if (process.argv[2] === 'whoami') {
    const token = await accessToken();
    const me = await call('GET', '/me', { fields: 'user_id,username,account_type', access_token: token });
    const lim = await call('GET', `/${me.user_id}/content_publishing_limit`, { fields: 'quota_usage,config', access_token: token });
    console.log(`@${me.username} (${me.account_type}) · posts through the API in the last 24 h: ${lim.data?.[0]?.quota_usage ?? '?'} of ${lim.data?.[0]?.config?.quota_total ?? '?'}`);
  } else { console.error('usage: node instagram.mjs whoami'); process.exit(2); }
}
