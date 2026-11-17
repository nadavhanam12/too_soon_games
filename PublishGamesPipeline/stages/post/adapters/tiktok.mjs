#!/usr/bin/env node
// TikTok adapter for stage "post": Content Posting API, Direct Post, the video sent from this machine (FILE_UPLOAD).
// post.mjs calls ready() and post({video, cover, text, title}) → {url}.
//
// One-time setup (the user does it; keys never go through chat):
//   1. developers.tiktok.com: an app with Login Kit + Content Posting API (Direct Post on), scope video.publish, the
//      redirect URI below registered, the site's domain verified. Submit for review.
//   2. Copy tiktok.env.example to PublishGamesPipeline/private/tiktok.env and fill the client key and secret.
//   3. node tiktok.mjs auth-url            open the printed URL, approve as the studio account
//      node tiktok.mjs exchange <code>     the `code` from the address bar after the redirect; saves the refresh token
//      node tiktok.mjs whoami              checks the token and prints the account and the privacy levels it may use
//
// TikTok's rules that shape this file (docs: content-posting-api-reference-direct-post, -get-video-status,
// -media-transfer-guide, oauth-user-access-token-management):
//   - Until the app passes TikTok's audit it may post only as SELF_ONLY, and only to an account set to private.
//     TIKTOK_PRIVACY says which level to ask for; a private post has no public id, so post() then stops with the
//     publish id and the next step instead of returning a url that does not exist.
//   - The access token lives 2 hours and the refresh token rotates on every refresh: the new one is written back to
//     tiktok.env at once (the old one is dead from that moment).
//   - There is no cover upload in the API, only a frame of the video (video_cover_timestamp_ms).
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(HERE, '..', '..', '..', 'private', 'tiktok.env');
const API = 'https://open.tiktokapis.com';
const COVER_MS = 1000;          // one second in: gameplay with the burned caption, not the first (transition) frame
const MAX_SINGLE = 64 * 1024 * 1024, CHUNK = 10 * 1024 * 1024; // TikTok: a chunk is 5-64 MB, the last one absorbs the remainder
const POLL_MS = 5000, POLL_MAX = 36; // 3 minutes; the status endpoint allows 30 requests a minute

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

export function ready() {
  const e = readEnv();
  return !!(e.TIKTOK_CLIENT_KEY && e.TIKTOK_CLIENT_SECRET && e.TIKTOK_REFRESH_TOKEN);
}

async function token(body) {
  const e = readEnv();
  const r = await fetch(`${API}/v2/oauth/token/`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: e.TIKTOK_CLIENT_KEY, client_secret: e.TIKTOK_CLIENT_SECRET, ...body }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`TikTok token request failed: ${j.error || r.status} ${j.error_description || ''}`);
  saveEnv('TIKTOK_REFRESH_TOKEN', j.refresh_token); // rotated: the one just used no longer works
  return j;
}
const accessToken = async () => (await token({ grant_type: 'refresh_token', refresh_token: readEnv().TIKTOK_REFRESH_TOKEN })).access_token;

async function call(path, access, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json; charset=UTF-8' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (j.error?.code !== 'ok') throw new Error(`TikTok ${path}: ${j.error?.code || r.status} ${j.error?.message || ''} (log ${j.error?.log_id || j.error?.logid || '-'})`);
  return j.data;
}

export async function post({ video, text }) {
  const privacy = readEnv().TIKTOK_PRIVACY;
  if (!privacy) throw new Error('tiktok.env: TIKTOK_PRIVACY is empty (SELF_ONLY until the app is audited, then PUBLIC_TO_EVERYONE)');
  const access = await accessToken();
  const creator = await call('/v2/post/publish/creator_info/query/', access);
  if (!creator.privacy_level_options.includes(privacy)) throw new Error(`TikTok: this account cannot post as ${privacy} (allowed: ${creator.privacy_level_options.join(', ')})`);

  const size = statSync(video).size;
  const chunk = size <= MAX_SINGLE ? size : CHUNK, count = Math.max(1, Math.floor(size / chunk));
  const init = await call('/v2/post/publish/video/init/', access, {
    post_info: { title: text, privacy_level: privacy, disable_duet: false, disable_stitch: false, disable_comment: false, video_cover_timestamp_ms: COVER_MS, brand_content_toggle: false, brand_organic_toggle: false },
    source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunk, total_chunk_count: count },
  });
  const file = readFileSync(video);
  for (let i = 0; i < count; i++) {
    const from = i * chunk, to = i === count - 1 ? size : from + chunk; // the last chunk takes the remainder
    const r = await fetch(init.upload_url, {
      method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-range': `bytes ${from}-${to - 1}/${size}` }, body: file.subarray(from, to),
    });
    if (r.status !== 201 && r.status !== 206) throw new Error(`TikTok upload, chunk ${i + 1}/${count}: HTTP ${r.status} ${await r.text()}`);
  }
  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise((res) => setTimeout(res, POLL_MS));
    const st = await call('/v2/post/publish/status/fetch/', access, { publish_id: init.publish_id });
    if (st.status === 'FAILED') throw new Error(`TikTok refused the video: ${st.fail_reason} (publish id ${init.publish_id})`);
    if (st.status !== 'PUBLISH_COMPLETE') continue;
    const id = st.publicaly_available_post_id?.[0]; // TikTok's spelling
    if (id) return { url: `https://www.tiktok.com/@${creator.creator_username}/video/${id}` };
    throw new Error(`TikTok published the video as ${privacy}, so it has no public link (publish id ${init.publish_id}). Open it in the TikTok app, make it public, then record it: post.mjs <GameId> --mark-posted tiktok <post url>`);
  }
  throw new Error(`TikTok is still processing after ${(POLL_MS * POLL_MAX) / 60000} minutes (publish id ${init.publish_id}): check the account before posting again`);
}

// ---------- one-time authorization, run by the user ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, arg] = process.argv.slice(2);
  const e = readEnv();
  if (!e.TIKTOK_CLIENT_KEY || !e.TIKTOK_CLIENT_SECRET || !e.TIKTOK_REDIRECT_URI) { console.error(`fill TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI in ${ENV_FILE} first (template: ${join(HERE, 'tiktok.env.example')})`); process.exit(1); }
  if (cmd === 'auth-url') {
    console.log(`https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({ client_key: e.TIKTOK_CLIENT_KEY, scope: 'video.publish', response_type: 'code', redirect_uri: e.TIKTOK_REDIRECT_URI, state: 'tsg' })}`);
    console.log('\nOpen it, approve as the studio account, then copy the value of `code` from the address bar and run:\n  node tiktok.mjs exchange <code>');
  } else if (cmd === 'exchange' && arg) {
    const j = await token({ grant_type: 'authorization_code', code: decodeURIComponent(arg), redirect_uri: e.TIKTOK_REDIRECT_URI });
    console.log(`saved the refresh token to ${ENV_FILE} (scope ${j.scope}, valid ${Math.round(j.refresh_expires_in / 86400)} days)`);
  } else if (cmd === 'whoami') {
    const c = await call('/v2/post/publish/creator_info/query/', await accessToken());
    console.log(`@${c.creator_username} (${c.creator_nickname}) · may post as: ${c.privacy_level_options.join(', ')} · max ${c.max_video_post_duration_sec} s`);
  } else { console.error('usage: node tiktok.mjs auth-url | exchange <code> | whoami'); process.exit(2); }
}
