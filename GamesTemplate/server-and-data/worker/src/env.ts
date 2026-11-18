// Bindings declared in wrangler.toml + secrets. Keep in sync with that file.

export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  EVENTS: AnalyticsEngineDataset;
  RL_SCORES: RateLimiter;
  RL_EVENTS: RateLimiter;
  RL_ADMIN: RateLimiter;
  RL_READS: RateLimiter;
  RL_AUTH: RateLimiter;
  VERSION: string;
  ALLOWED_ORIGINS: string;
  EVENTS_DATASET: string;
  /** the studio site (the unsubscribe page links back to it) */
  PUBLIC_BASE: string;
  /** OAuth client ids (public). Empty = that way in answers 503 provider_off. Same values as studio.json. */
  GOOGLE_CLIENT_ID?: string;
  APPLE_CLIENT_ID?: string;
  // secrets
  ADMIN_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  /** "1" only under `wrangler dev` (.dev.vars): this worker is the local API and takes writes from localhost pages. */
  LOCAL_DEV?: string;
}

/** Per-request context derived once in the router. */
export interface Ctx {
  env: Env;
  req: Request;
  url: URL;
  origin: string | null; // echoed in CORS headers when allowed
  country: string; // from request.cf, "" when unknown
  city: string;
  device: 'phone' | 'tablet' | 'desktop' | 'bot';
  ip: string;
  now: string; // ISO
  waitUntil: (p: Promise<unknown>) => void;
}

export interface GameRow {
  game_id: string;
  name: string;
  max_score: number;
  min_duration_s: number;
  /** score rows of this game (migrations/0004), so the total is never a COUNT over the table */
  scores_n: number;
  /** optional cap on score per second of play; null = no check */
  max_score_per_s: number | null;
}
