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
  VERSION: string;
  ALLOWED_ORIGINS: string;
  EVENTS_DATASET: string;
  // secrets
  ADMIN_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
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
}
