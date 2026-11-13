import type { Ctx } from '../env';
import { isEventName, writeEvent, type IncomingEvent } from '../analytics';
import { HttpError, getGame, noContent, rateLimit, readJson, shortText, userId as parseUserId } from '../util';

interface Body { userId?: unknown; version?: unknown; lang?: unknown; events?: unknown }
interface RawEvent { name?: unknown; ts?: unknown; sessionId?: unknown; props?: unknown }

const MAX_BATCH = 50;

/**
 * POST /v1/games/:game/events  { userId, version, lang?, events: [{name, ts, sessionId, props?}] }  → 204
 * Every event goes to Analytics Engine. Two cheap D1 side effects:
 *   session_start → upsert users (country/city/device/lang/last_seen)
 *   game_start    → INSERT OR IGNORE players (the "N players" counter)
 * Unknown event names are dropped (not an error) so an old client never breaks.
 */
export async function postEvents(ctx: Ctx, game: string): Promise<Response> {
  await rateLimit(ctx.env.RL_EVENTS, `events:${ctx.ip}`);
  const b = await readJson<Body>(ctx.req, 64 * 1024);
  const uid = parseUserId(b.userId);
  const version = shortText(b.version, 'version', 32) ?? '';
  const lang = shortText(b.lang, 'lang', 16);
  if (!Array.isArray(b.events) || b.events.length === 0) throw new HttpError(400, 'events must be a non-empty array', 'bad_events');
  if (b.events.length > MAX_BATCH) throw new HttpError(400, `at most ${MAX_BATCH} events per batch`, 'batch_too_big');
  await getGame(ctx.env, game);

  let sawSessionStart = false;
  let sawGameStart = false;
  const nowMs = Date.now();
  for (const raw of b.events as RawEvent[]) {
    if (!raw || !isEventName(raw.name)) continue;
    const sessionId = shortText(raw.sessionId, 'sessionId', 40) ?? '';
    let ts = typeof raw.ts === 'number' && Number.isFinite(raw.ts) ? raw.ts : nowMs;
    if (Math.abs(ts - nowMs) > 7 * 86_400_000) ts = nowMs; // wild client clocks → server time
    const props = raw.props && typeof raw.props === 'object' && !Array.isArray(raw.props) ? (raw.props as Record<string, unknown>) : {};
    const e: IncomingEvent = { name: raw.name, ts, sessionId, props };
    writeEvent(ctx, game, uid, version, e);
    if (e.name === 'session_start') sawSessionStart = true;
    if (e.name === 'game_start') sawGameStart = true;
  }

  const stmts: D1PreparedStatement[] = [];
  if (sawSessionStart) {
    stmts.push(ctx.env.DB.prepare(
      `INSERT INTO users (user_id, created_at, last_seen, first_game, lang, country, city, device)
       VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen, lang = COALESCE(excluded.lang, users.lang),
         country = excluded.country, city = excluded.city, device = excluded.device`,
    ).bind(uid, ctx.now, game, lang, ctx.country, ctx.city, ctx.device));
  }
  if (sawGameStart) {
    stmts.push(ctx.env.DB.prepare('INSERT OR IGNORE INTO players (game_id, user_id, first_at) VALUES (?, ?, ?)').bind(game, uid, ctx.now));
    stmts.push(ctx.env.DB.prepare('UPDATE users SET games_played = games_played + 1 WHERE user_id = ?').bind(uid));
  }
  if (stmts.length) ctx.waitUntil(ctx.env.DB.batch(stmts).catch((e) => console.error('events d1', e)));
  return noContent();
}
