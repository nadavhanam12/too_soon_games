#!/usr/bin/env node
// Facebook adapter for stage "post": one Reel on the studio's Page, the video sent from this machine.
// post.mjs calls ready() and post({video, cover, text, title}) → {url}.
//
// One-time setup (the user does it; keys never go through chat):
//   1. A Facebook Page for the studio (the API posts to Pages only, never to a personal profile).
//   2. developers.facebook.com: an app (type Business), with the permissions pages_show_list, pages_read_engagement
//      and pages_manage_posts. In Graph API Explorer: choose the app, "Get Page Access Token", pick the Page, add the
//      three permissions. Then Access Token Debugger → Extend Access Token, and ask /me/accounts with the extended
//      token: the Page token it returns does not expire.
//   3. Copy facebook.env.example to PublishGamesPipeline/private/facebook.env and fill the Page id and that token.
//      node facebook.mjs whoami     checks the token and prints the Page
//
// Facebook's rules that shape this file (developers.facebook.com/docs/video-api/guides/reels-publishing):
//   - Three steps: start (get a video id), send the file to rupload.facebook.com, finish with video_state=PUBLISHED.
//   - A Reel is 3-90 seconds, 9:16, 24-60 fps. At most 30 posts through the API per 24 hours.
//   - After "finish" Facebook still processes the video: the adapter waits until the publishing phase is complete,
//     so it never reports a link to a post that then fails.
//   - The cover is Facebook's choice of frame: this flow takes no cover image.
//   - Not verified: whether a Reel posted by an app in Development mode is visible to the public. Posts by such apps
//     have been limited to people with a role on the app; if the test post is not visible when logged out, switch
//     the app to Live (it needs a privacy policy URL).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(HERE, '..', '..', '..', 'private', 'facebook.env');
const V = 'v27.0', API = `https://graph.facebook.com/${V}`;
const POLL_S = 10, POLL_MAX = 30; // 5 minutes

function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const env = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export function ready() {
  const e = readEnv();
  return !!(e.FACEBOOK_PAGE_ID && e.FACEBOOK_PAGE_TOKEN);
}

async function call(method, path, params) {
  const q = new URLSearchParams({ ...params, access_token: readEnv().FACEBOOK_PAGE_TOKEN });
  const r = await fetch(method === 'GET' ? `${API}${path}?${q}` : `${API}${path}`, method === 'GET' ? {} : { method, body: q });
  const j = await r.json();
  if (j.error) throw new Error(`Facebook ${method} ${path}: ${j.error.message} (code ${j.error.code}${j.error.error_subcode ? `/${j.error.error_subcode}` : ''})`);
  return j;
}

export async function post({ video, text }) {
  const { FACEBOOK_PAGE_ID: page, FACEBOOK_PAGE_TOKEN: token } = readEnv();
  const start = await call('POST', `/${page}/video_reels`, { upload_phase: 'start' });
  const up = await fetch(`https://rupload.facebook.com/video-upload/${V}/${start.video_id}`, {
    method: 'POST', headers: { authorization: `OAuth ${token}`, offset: '0', file_size: String(statSync(video).size) }, body: readFileSync(video),
  });
  const upJson = await up.json();
  if (!upJson.success) throw new Error(`Facebook upload failed: HTTP ${up.status} ${JSON.stringify(upJson).slice(0, 300)}`);
  await call('POST', `/${page}/video_reels`, { upload_phase: 'finish', video_id: start.video_id, video_state: 'PUBLISHED', description: text });
  for (let i = 0; ; i++) {
    const st = (await call('GET', `/${start.video_id}`, { fields: 'status' })).status || {};
    const bad = [st.uploading_phase, st.processing_phase, st.publishing_phase].find((p) => p?.status === 'error');
    if (bad) throw new Error(`Facebook could not publish the Reel: ${JSON.stringify(bad.errors || bad).slice(0, 300)} (video ${start.video_id})`);
    if (st.publishing_phase?.status === 'complete') break;
    if (i >= POLL_MAX) throw new Error(`Facebook is still processing after ${(POLL_S * POLL_MAX) / 60} minutes (video ${start.video_id}): check the Page before posting again`);
    await new Promise((res) => setTimeout(res, POLL_S * 1000));
  }
  const made = await call('GET', `/${start.video_id}`, { fields: 'permalink_url' });
  return { url: new URL(made.permalink_url, 'https://www.facebook.com').href };
}

// ---------- token check, run by the user ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!ready()) { console.error(`fill FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN in ${ENV_FILE} first (template: ${join(HERE, 'facebook.env.example')})`); process.exit(1); }
  if (process.argv[2] === 'whoami') {
    const p = await call('GET', `/${readEnv().FACEBOOK_PAGE_ID}`, { fields: 'name,link,followers_count' });
    console.log(`${p.name} · ${p.link} · ${p.followers_count} followers`);
  } else { console.error('usage: node facebook.mjs whoami'); process.exit(2); }
}
