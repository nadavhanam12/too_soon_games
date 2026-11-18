#!/usr/bin/env node
// YouTube adapter for stage "post": one Short on the studio's channel (a vertical video up to 3 minutes is a Short).
// post.mjs calls ready() and post({video, cover, text, title}) → {url}.
//
// One-time setup (the user does it; keys never go through chat):
//   1. console.cloud.google.com: a project, enable "YouTube Data API v3". OAuth consent screen: External, add the
//      studio's Google account as a test user, then set Publishing status to "In production": while it says
//      "Testing", Google expires the refresh token after 7 days. Credentials → Create OAuth client ID → Desktop app.
//   2. Copy youtube.env.example to PublishGamesPipeline/private/youtube.env and fill the client id and secret.
//   3. node youtube.mjs auth       opens nothing by itself: it prints a URL, waits on 127.0.0.1 for Google to send the
//                                  browser back, and saves the refresh token. Approve as the studio channel's account.
//      node youtube.mjs whoami     checks the token and prints the channel
//
// YouTube's rules that shape this file (developers.google.com/youtube/v3: videos/insert, resumable upload protocol):
//   - Resumable upload in two requests: the metadata (which returns a session URL), then the file.
//   - The docs say videos from unverified API projects "are not restricted to private viewing mode" (read
//     2026-11-18; older guides say they are locked private). The adapter asks for public and then reads the video back:
//     if YouTube made it anything else, it stops and says so instead of reporting a public link.
//   - Uploads are limited to 100 a day per project. Google's refresh token does not rotate.
//   - A Short's cover is YouTube's choice of frame: the API's thumbnail upload does not apply to Shorts.
//   - Links in a Short's description are not clickable. The description still carries the tracked link (it is what a
//     viewer can copy, and it is clickable where the video is opened as a normal watch page).
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(HERE, '..', '..', '..', 'private', 'youtube.env');
const SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
const AUTH_PORT = 8765;                 // the Desktop-app client accepts any http://127.0.0.1:<port> redirect
const CATEGORY_GAMING = '20';

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
  return !!(e.YOUTUBE_CLIENT_ID && e.YOUTUBE_CLIENT_SECRET && e.YOUTUBE_REFRESH_TOKEN);
}

async function token(body) {
  const e = readEnv();
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: e.YOUTUBE_CLIENT_ID, client_secret: e.YOUTUBE_CLIENT_SECRET, ...body }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Google token request failed: ${j.error || r.status} ${j.error_description || ''}${j.error === 'invalid_grant' ? ' (the refresh token expired or was revoked: run `node youtube.mjs auth` again; a consent screen left in "Testing" expires it after 7 days)' : ''}`);
  return j;
}
const accessToken = async () => (await token({ grant_type: 'refresh_token', refresh_token: readEnv().YOUTUBE_REFRESH_TOKEN })).access_token;

async function api(path, access) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, { headers: { authorization: `Bearer ${access}` } });
  const j = await r.json();
  if (j.error) throw new Error(`YouTube ${path.split('?')[0]}: ${j.error.message} (${j.error.errors?.[0]?.reason || j.error.code})`);
  return j;
}

export async function post({ video, text, title }) {
  if (!title) throw new Error('YouTube needs a title: copy.json → posts.youtube.title');
  const access = await accessToken();
  const size = statSync(video).size;
  const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-length': String(size), 'x-upload-content-type': 'video/mp4' },
    body: JSON.stringify({
      snippet: { title, description: text, categoryId: CATEGORY_GAMING, defaultLanguage: 'en' },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    }),
  });
  const session = start.headers.get('location');
  if (!start.ok || !session) throw new Error(`YouTube refused the upload: HTTP ${start.status} ${(await start.text()).slice(0, 400)}`);
  const up = await fetch(session, { method: 'PUT', headers: { authorization: `Bearer ${access}`, 'content-type': 'video/mp4', 'content-length': String(size) }, body: readFileSync(video) });
  const made = await up.json();
  if (!up.ok || !made.id) throw new Error(`YouTube upload failed: HTTP ${up.status} ${JSON.stringify(made).slice(0, 400)}`);
  const seen = (await api(`videos?part=status&id=${made.id}`, access)).items?.[0]?.status;
  if (seen?.privacyStatus !== 'public') throw new Error(`YouTube saved the video as ${seen?.privacyStatus || 'unknown'}, not public (video ${made.id}${seen?.rejectionReason ? `, ${seen.rejectionReason}` : ''}). Make it public in YouTube Studio, then record it: post.mjs <GameId> --mark-posted youtube https://www.youtube.com/shorts/${made.id}`);
  return { url: `https://www.youtube.com/shorts/${made.id}` };
}

// ---------- one-time authorization, run by the user ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2];
  const e = readEnv();
  if (!e.YOUTUBE_CLIENT_ID || !e.YOUTUBE_CLIENT_SECRET) { console.error(`fill YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in ${ENV_FILE} first (template: ${join(HERE, 'youtube.env.example')})`); process.exit(1); }
  if (cmd === 'auth') {
    const redirect = `http://127.0.0.1:${AUTH_PORT}/`;
    const srv = createServer(async (req, res) => {
      const q = new URL(req.url, redirect).searchParams;
      if (!q.get('code') && !q.get('error')) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      if (q.get('error')) { res.end(`Google answered: ${q.get('error')}. Nothing was saved.`); console.error(`Google answered: ${q.get('error')}`); srv.close(); process.exitCode = 1; return; }
      try {
        const j = await token({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirect });
        if (!j.refresh_token) throw new Error('Google returned no refresh token: remove the app under myaccount.google.com → Security → Third-party access, then run auth again');
        saveEnv('YOUTUBE_REFRESH_TOKEN', j.refresh_token);
        res.end('Saved. You can close this tab.'); console.log(`saved the refresh token to ${ENV_FILE}`);
      } catch (err) { res.end(`Failed: ${err.message}`); console.error(err.message); process.exitCode = 1; }
      srv.close();
    });
    srv.listen(AUTH_PORT, '127.0.0.1', () => {
      console.log(`Open this URL, choose the studio channel's Google account and approve:\n\nhttps://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: e.YOUTUBE_CLIENT_ID, redirect_uri: redirect, response_type: 'code', scope: SCOPES, access_type: 'offline', prompt: 'consent' })}\n\nwaiting on ${redirect} ...`);
    });
  } else if (cmd === 'whoami') {
    const c = (await api('channels?part=snippet,statistics&mine=true', await accessToken())).items?.[0];
    if (!c) { console.error('this Google account has no YouTube channel'); process.exit(1); }
    console.log(`${c.snippet.title} (${c.snippet.customUrl || c.id}) · ${c.statistics.subscriberCount} subscribers · ${c.statistics.videoCount} videos`);
  } else { console.error('usage: node youtube.mjs auth | whoami'); process.exit(2); }
}
