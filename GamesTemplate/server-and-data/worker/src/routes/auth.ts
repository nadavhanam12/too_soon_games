import type { Ctx, Env } from '../env';
import { APPLE, GOOGLE, verifyIdToken } from '../idtoken';
import { HttpError, json, rateLimit, readJson, userId as parseUserId } from '../util';

/**
 * Sign-up (docs/EVENTS.md "חשבונות"). Every way in ends in an account row pinned to a player id.
 *   POST /v1/auth/google  { credential, userId }   the ID token from Google's button
 *   POST /v1/auth/apple   { idToken, userId }      the ID token from Sign in with Apple
 *   POST /v1/auth/email   { email, userId }        an email typed into the card: joins the list, signs nobody in
 *   → { userId, email, provider, nick, notify, created }
 * Google / Apple: the page uses the returned userId as its player id (tsg:uid), so the games post scores under the
 * account on every device; scores the device made before signing in move onto the account (mergeUser).
 * Email: nothing is sent and nothing proves the address, so the account is this browser's player id only.
 *   POST /v1/account            { userId, notify }       turn the new-game mails on or off
 *   GET|POST /v1/unsubscribe?t= the link in every mail
 */

/** A provider-verified identity. `email` is set only when the provider says it is verified. */
interface Identity { provider: 'google' | 'apple'; sub: string; email: string | null }
interface AccountRow { user_id: string; email: string | null; email_verified: number; google_sub: string | null; apple_sub: string | null; provider: string; notify: number }
const COLS = 'user_id, email, email_verified, google_sub, apple_sub, provider, notify';

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/;

function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function authGoogle(ctx: Ctx): Promise<Response> {
  await rateLimit(ctx.env.RL_AUTH, `auth:${ctx.ip}`);
  if (!ctx.env.GOOGLE_CLIENT_ID) throw new HttpError(503, 'Google sign-in is not set up (GOOGLE_CLIENT_ID)', 'provider_off');
  const b = await readJson<{ credential?: unknown; userId?: unknown }>(ctx.req, 16 * 1024);
  const uid = parseUserId(b.userId);
  const c = await verifyIdToken(GOOGLE, b.credential, ctx.env.GOOGLE_CLIENT_ID);
  return json(await signIn(ctx, { provider: 'google', sub: c.sub, email: c.emailVerified ? c.email : null }, [uid]));
}

export async function authApple(ctx: Ctx): Promise<Response> {
  await rateLimit(ctx.env.RL_AUTH, `auth:${ctx.ip}`);
  if (!ctx.env.APPLE_CLIENT_ID) throw new HttpError(503, 'Apple sign-in is not set up (APPLE_CLIENT_ID)', 'provider_off');
  const b = await readJson<{ idToken?: unknown; userId?: unknown }>(ctx.req, 16 * 1024);
  const uid = parseUserId(b.userId);
  const c = await verifyIdToken(APPLE, b.idToken, ctx.env.APPLE_CLIENT_ID);
  // "Hide my email" gives a private relay address; it still reaches the player, so it is kept like any other
  return json(await signIn(ctx, { provider: 'apple', sub: c.sub, email: c.emailVerified ? c.email : null }, [uid]));
}

export async function authEmail(ctx: Ctx): Promise<Response> {
  await rateLimit(ctx.env.RL_AUTH, `auth:${ctx.ip}`);
  const b = await readJson<{ email?: unknown; userId?: unknown }>(ctx.req, 2048);
  const uid = parseUserId(b.userId);
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL.test(email)) throw new HttpError(400, 'that does not look like an email address', 'bad_email');

  const own = await ctx.env.DB.prepare(`SELECT ${COLS} FROM accounts WHERE user_id = ?`).bind(uid).first<AccountRow>();
  let created = false;
  if (!own) {
    await ctx.env.DB.prepare(
      `INSERT INTO accounts (user_id, email, email_verified, provider, notify, unsub_token, country, created_at, updated_at)
       VALUES (?1, ?2, 0, 'email', 1, ?3, ?4, ?5, ?5)`,
    ).bind(uid, email, randomToken(24), ctx.country, ctx.now).run();
    created = true;
  } else if (!own.email_verified) {
    // this browser typed an address before: the new one replaces it, and the mails are on again
    await ctx.env.DB.prepare('UPDATE accounts SET email = ?, notify = 1, updated_at = ? WHERE user_id = ?').bind(email, ctx.now, uid).run();
  }
  // an account with a Google / Apple email keeps that email: a typed address never replaces a verified one
  const u = await ctx.env.DB.prepare('SELECT nick FROM users WHERE user_id = ?').bind(uid).first<{ nick: string | null }>();
  const verified = own?.email_verified === 1;
  return json({
    userId: uid, email: verified ? own!.email : email, provider: own?.provider ?? 'email', nick: u?.nick ?? null,
    notify: verified ? own!.notify === 1 : true, created,
  });
}

export async function setNotify(ctx: Ctx): Promise<Response> {
  await rateLimit(ctx.env.RL_AUTH, `auth:${ctx.ip}`);
  const b = await readJson<{ userId?: unknown; notify?: unknown }>(ctx.req, 1024);
  const uid = parseUserId(b.userId);
  if (typeof b.notify !== 'boolean') throw new HttpError(400, 'bad notify', 'bad_notify');
  const r = await ctx.env.DB.prepare('UPDATE accounts SET notify = ?, updated_at = ? WHERE user_id = ?').bind(b.notify ? 1 : 0, ctx.now, uid).run();
  if (!r.meta.changes) throw new HttpError(404, 'not signed up', 'no_account');
  return json({ notify: b.notify });
}

export async function unsubscribe(ctx: Ctx): Promise<Response> {
  await rateLimit(ctx.env.RL_AUTH, `auth:${ctx.ip}`);
  const t = ctx.url.searchParams.get('t') ?? '';
  const r = /^[A-Za-z0-9_-]{20,100}$/.test(t)
    ? await ctx.env.DB.prepare('UPDATE accounts SET notify = 0, updated_at = ? WHERE unsub_token = ?').bind(ctx.now, t).run()
    : null;
  const ok = !!r?.meta.changes;
  // POST = the mail app's one-click unsubscribe (List-Unsubscribe-Post); GET = the link in the mail
  if (ctx.req.method === 'POST') return new Response(ok ? 'unsubscribed' : 'unknown link', { status: ok ? 200 : 404 });
  const msg = ok ? 'Done. You will not get new-game emails from us anymore.' : 'This unsubscribe link is not valid. Write to us and we will remove you by hand.';
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Too Soon Games</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#100e1a;color:#eeebf7;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="font-size:20px;font-weight:800">${msg}</p><p><a style="color:#ffd23f" href="${ctx.env.PUBLIC_BASE}">Back to the games</a></p></div>`,
  { status: ok ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

// ---------- the shared part ----------

async function findAccount(env: Env, id: Identity): Promise<AccountRow | null> {
  const subCol = id.provider === 'google' ? 'google_sub' : 'apple_sub';
  const r = await env.DB.prepare(`SELECT ${COLS} FROM accounts WHERE ${subCol} = ?`).bind(id.sub).first<AccountRow>();
  if (r) return r;
  // the same verified email from the other provider is the same person (never a typed, unverified one)
  if (id.email) return env.DB.prepare(`SELECT ${COLS} FROM accounts WHERE email = ? AND email_verified = 1`).bind(id.email).first<AccountRow>();
  return null;
}

/**
 * Finds or creates the account and moves the given devices' scores onto it. A device id that already belongs to
 * another account is left alone: its scores are that account's, not this one's. A device whose only sign-up was a
 * typed email becomes this account (the provider now vouches for it).
 */
async function signIn(ctx: Ctx, id: Identity, deviceUids: string[]) {
  const { env } = ctx;
  const devices = [...new Set(deviceUids)];
  const owned = await env.DB.prepare(`SELECT ${COLS} FROM accounts WHERE user_id IN (${devices.map(() => '?').join(',')})`)
    .bind(...devices).all<AccountRow>();
  const ownedBy = new Map(owned.results.map((r) => [r.user_id, r]));
  const subCol = id.provider === 'google' ? 'google_sub' : 'apple_sub';

  let acc = await findAccount(env, id);
  const mine = ownedBy.get(devices[0]!);
  let created = false;
  if (!acc && mine && !mine.google_sub && !mine.apple_sub) acc = mine; // a typed-email sign-up on this browser: upgrade it
  if (acc) {
    // a new way in for an existing account, or a verified email for one that had none or a typed one: remember them
    const email = id.email && (!acc.email || !acc.email_verified) ? id.email : null;
    await env.DB.prepare(`UPDATE accounts SET ${subCol} = COALESCE(${subCol}, ?1), email = COALESCE(?2, email),
                            email_verified = CASE WHEN ?2 IS NULL THEN email_verified ELSE 1 END, updated_at = ?3 WHERE user_id = ?4`)
      .bind(id.sub, email, ctx.now, acc.user_id).run();
    if (email) acc = { ...acc, email, email_verified: 1 };
  } else {
    // a device id that is already a Google / Apple account but lost its sign-in (cleared site data): a fresh player id,
    // so this sign-up does not take over that account's scores
    const userId = !ownedBy.has(devices[0]!) ? devices[0]! : crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO accounts (user_id, email, email_verified, ${subCol}, provider, notify, unsub_token, country, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?8, ?8)`,
    ).bind(userId, id.email, id.email ? 1 : 0, id.sub, id.provider, randomToken(24), ctx.country, ctx.now).run();
    acc = { user_id: userId, email: id.email, email_verified: id.email ? 1 : 0, google_sub: null, apple_sub: null, provider: id.provider, notify: 1 };
    created = true;
  }

  for (const d of devices) if (d !== acc.user_id && !ownedBy.has(d)) await mergeUser(env, d, acc.user_id, ctx.now);
  const u = await env.DB.prepare('SELECT nick FROM users WHERE user_id = ?').bind(acc.user_id).first<{ nick: string | null }>();
  return { userId: acc.user_id, email: acc.email, provider: acc.provider, nick: u?.nick ?? null, notify: acc.notify === 1, created };
}

/**
 * Moves player `from` onto player `into` in one transaction: the better score per game wins, the players rows join,
 * games.scores_n loses one for each game both had played, the users row adds up. `from`'s analytics events stay as
 * they are (Analytics Engine has no update).
 */
export async function mergeUser(env: Env, from: string, into: string, now: string): Promise<void> {
  const db = env.DB;
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO users (user_id, created_at, last_seen, first_game, lang, country, city, device, nick, games_played)
                SELECT ?2, created_at, last_seen, first_game, lang, country, city, device, nick, 0 FROM users WHERE user_id = ?1`).bind(from, into),
    db.prepare(`UPDATE games SET scores_n = scores_n - 1 WHERE game_id IN
                (SELECT a.game_id FROM scores a JOIN scores b ON a.game_id = b.game_id WHERE a.user_id = ?1 AND b.user_id = ?2)`).bind(from, into),
    // "WHERE true" lets SQLite tell the SELECT's end from the upsert's ON CONFLICT
    db.prepare(`INSERT INTO scores (game_id, user_id, nick, score, duration_s, stage, version, country, created_at, updated_at)
                SELECT game_id, ?2, nick, score, duration_s, stage, version, country, created_at, updated_at FROM scores WHERE user_id = ?1 AND true
                ON CONFLICT(game_id, user_id) DO UPDATE SET score = excluded.score, duration_s = excluded.duration_s, stage = excluded.stage,
                  version = excluded.version, nick = COALESCE(scores.nick, excluded.nick), updated_at = excluded.updated_at
                WHERE excluded.score > scores.score`).bind(from, into),
    db.prepare('DELETE FROM scores WHERE user_id = ?').bind(from),
    db.prepare('INSERT OR IGNORE INTO players (game_id, user_id, first_at) SELECT game_id, ?2, first_at FROM players WHERE user_id = ?1').bind(from, into),
    db.prepare('DELETE FROM players WHERE user_id = ?').bind(from),
    db.prepare(`UPDATE users SET last_seen = ?3,
                  games_played = games_played + COALESCE((SELECT games_played FROM users WHERE user_id = ?1), 0),
                  nick = COALESCE(nick, (SELECT nick FROM users WHERE user_id = ?1))
                WHERE user_id = ?2`).bind(from, into, now),
    db.prepare('UPDATE users SET games_played = 0 WHERE user_id = ?').bind(from),
  ]);
}
