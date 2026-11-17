#!/usr/bin/env node
// X adapter for stage "post": chunked video upload (v2), then one post with the text and the video.
// post.mjs calls ready() and post({video, cover, text, title}) → {url}.
//
// One-time setup (the user does it; keys never go through chat):
//   1. console.x.com: a project and an app, User authentication set up as a Web App (confidential client), Read and
//      write, the redirect URI below registered. Buy credits: there is no free tier (docs.x.com pricing, 2026-11:
//      $0.015 per post, $0.20 per post that carries a link).
//   2. Copy x.env.example to PublishGamesPipeline/private/x.env and fill the client id and secret.
//   3. node x.mjs auth-url            open the printed URL, approve as the studio account
//      node x.mjs exchange <code>     the `code` from the address bar after the redirect; saves the refresh token
//
// X's rules that shape this file (docs.x.com: media-upload-chunked, create-post, oauth-2-0/user-access-token):
//   - OAuth 2.0 user context with PKCE. The access token is short-lived, so every run refreshes; when the refresh
//     returns a new refresh token it is written back to x.env at once.
//   - Video goes up in chunks of at most 5 MB (initialize, append, finalize), then X processes it: the post is made
//     only after the status says succeeded.
//   - The API has no cover upload for a post's video; X picks the frame.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(HERE, '..', '..', '..', 'private', 'x.env');
const API = 'https://api.x.com';
const SCOPES = 'tweet.read tweet.write users.read media.write offline.access';
const CHUNK = 4 * 1024 * 1024;  // the docs ask for 5 MB or less per append
const POLL_MAX_S = 300;

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
  return !!(e.X_CLIENT_ID && e.X_CLIENT_SECRET && e.X_REFRESH_TOKEN);
}

async function token(body) {
  const e = readEnv();
  const r = await fetch(`${API}/2/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${Buffer.from(`${e.X_CLIENT_ID}:${e.X_CLIENT_SECRET}`).toString('base64')}` },
    body: new URLSearchParams(body),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`X token request failed: HTTP ${r.status} ${j.error || ''} ${j.error_description || ''}`);
  if (j.refresh_token) saveEnv('X_REFRESH_TOKEN', j.refresh_token); // X replaces it on use
  return j;
}

async function call(method, path, access, { json, form } = {}) {
  const r = await fetch(`${API}${path}`, {
    method, headers: { authorization: `Bearer ${access}`, ...(json ? { 'content-type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : form,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`X ${method} ${path}: HTTP ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

export async function post({ video, text }) {
  const access = (await token({ grant_type: 'refresh_token', refresh_token: readEnv().X_REFRESH_TOKEN })).access_token;
  const file = readFileSync(video), size = statSync(video).size;
  const init = await call('POST', '/2/media/upload/initialize', access, { json: { media_type: 'video/mp4', total_bytes: size, media_category: 'tweet_video' } });
  const id = init.data.id;
  for (let i = 0, from = 0; from < size; i++, from += CHUNK) {
    const form = new FormData();
    form.append('segment_index', String(i));
    form.append('media', new Blob([file.subarray(from, Math.min(size, from + CHUNK))], { type: 'video/mp4' }), 'chunk.mp4');
    await call('POST', `/2/media/upload/${id}/append`, access, { form });
  }
  let info = (await call('POST', `/2/media/upload/${id}/finalize`, access)).data?.processing_info;
  for (let waited = 0; info && info.state !== 'succeeded'; ) {
    if (info.state === 'failed') throw new Error(`X could not process the video: ${JSON.stringify(info.error || info)}`);
    if (waited > POLL_MAX_S) throw new Error(`X is still processing the video after ${POLL_MAX_S} s (media id ${id}): nothing was posted`);
    const s = info.check_after_secs || 3; waited += s;
    await new Promise((res) => setTimeout(res, s * 1000));
    info = (await call('GET', `/2/media/upload?command=STATUS&media_id=${id}`, access)).data?.processing_info;
  }
  const made = await call('POST', '/2/tweets', access, { json: { text, media: { media_ids: [id] } } });
  return { url: `https://x.com/i/status/${made.data.id}` }; // /i/status/<id> opens the post under whichever handle owns it
}

// ---------- one-time authorization, run by the user ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, arg] = process.argv.slice(2);
  const e = readEnv();
  if (!e.X_CLIENT_ID || !e.X_CLIENT_SECRET || !e.X_REDIRECT_URI) { console.error(`fill X_CLIENT_ID, X_CLIENT_SECRET and X_REDIRECT_URI in ${ENV_FILE} first (template: ${join(HERE, 'x.env.example')})`); process.exit(1); }
  if (cmd === 'auth-url') {
    const verifier = randomBytes(32).toString('base64url');
    saveEnv('X_PKCE_VERIFIER', verifier); // needed once more, by `exchange`
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    console.log(`https://x.com/i/oauth2/authorize?${new URLSearchParams({ response_type: 'code', client_id: e.X_CLIENT_ID, redirect_uri: e.X_REDIRECT_URI, scope: SCOPES, state: 'tsg', code_challenge: challenge, code_challenge_method: 'S256' })}`);
    console.log('\nOpen it, approve as the studio account, then copy the value of `code` from the address bar and run:\n  node x.mjs exchange <code>');
  } else if (cmd === 'exchange' && arg) {
    if (!e.X_PKCE_VERIFIER) { console.error('run `node x.mjs auth-url` first: it creates the verifier this step needs'); process.exit(1); }
    const j = await token({ grant_type: 'authorization_code', code: arg, redirect_uri: e.X_REDIRECT_URI, code_verifier: e.X_PKCE_VERIFIER });
    if (!j.refresh_token) { console.error('X returned no refresh token: the app must request offline.access'); process.exit(1); }
    console.log(`saved the refresh token to ${ENV_FILE} (scope ${j.scope})`);
  } else { console.error('usage: node x.mjs auth-url | exchange <code>'); process.exit(2); }
}
