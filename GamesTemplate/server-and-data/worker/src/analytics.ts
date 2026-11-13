// Analytics Engine: one data point per event. Fixed blob slots so SQL queries stay simple.
//   index1 = game
//   blob1 game, blob2 name, blob3 userId, blob4 sessionId, blob5 country, blob6 city,
//   blob7 device, blob8 version, blob9 dim (stage|channel|network|reason|fromUser|lastScreen),
//   blob10 props JSON (≤ 1KB)
//   double1 value (score|timeS|rank|durationS), double2 client ts (ms)
// Counting with sampling in mind: SUM(_sample_interval) instead of count().

import type { Ctx } from './env';
import { EVENT_NAMES, type EventName } from './events';

export interface IncomingEvent {
  name: EventName;
  ts: number;
  sessionId: string;
  props?: Record<string, unknown>;
}

const DIM_KEYS = ['stage', 'channel', 'network', 'reason', 'fromUser', 'lastScreen'] as const;
const VALUE_KEYS = ['score', 'timeS', 'rank', 'durationS', 'theirScore', 'atS'] as const;

export function writeEvent(ctx: Ctx, game: string, userId: string, version: string, e: IncomingEvent): void {
  const p = e.props || {};
  let dim = '';
  for (const k of DIM_KEYS) {
    const v = p[k];
    if (v !== undefined && v !== null) { dim = String(v).slice(0, 64); break; }
  }
  let value = 0;
  for (const k of VALUE_KEYS) {
    const v = p[k];
    if (typeof v === 'number' && Number.isFinite(v)) { value = v; break; }
  }
  let propsJson = '';
  try { propsJson = JSON.stringify(p).slice(0, 1024); } catch { /* ignore */ }
  ctx.env.EVENTS.writeDataPoint({
    indexes: [game],
    blobs: [game, e.name, userId, e.sessionId, ctx.country, ctx.city, ctx.device, version, dim, propsJson],
    doubles: [value, e.ts],
  });
}

export function isEventName(v: unknown): v is EventName {
  return typeof v === 'string' && (EVENT_NAMES as readonly string[]).includes(v);
}

// ---------- SQL API (admin dashboard) ----------

export interface SqlResult<T = Record<string, unknown>> { data: T[]; rows: number }

/** Runs a query against the Analytics Engine SQL API. Throws with a readable message when not configured. */
export async function querySql<T = Record<string, unknown>>(ctx: Ctx, sql: string): Promise<SqlResult<T>> {
  const { CF_ACCOUNT_ID, CF_API_TOKEN } = ctx.env;
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('analytics not configured: set CF_ACCOUNT_ID and CF_API_TOKEN secrets');
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${CF_API_TOKEN}`, 'content-type': 'text/plain' },
    body: sql,
  });
  if (!res.ok) throw new Error(`analytics query failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as SqlResult<T>;
}

/** Escapes a value for use inside single quotes in an AE SQL string. */
export function sqlStr(v: string): string {
  return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
