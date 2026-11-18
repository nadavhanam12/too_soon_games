// Shapes of games.json and studio.json (see docs/CONTRACTS.md).
export interface GameEntry {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  audience: 'il' | 'us';
  lang: 'he' | 'en';
  version?: string;
  event?: { title?: string; headline?: string; date?: string; sourceUrl?: string; sourceLabel?: string };
  region?: string; // shown in the feed meta line; default derived from audience
  cover?: string;
  ogImage?: string;
  clip?: string; // relative to the game folder, like cover
  publishedAt?: string;
  status?: 'live' | 'archived';
  featured?: boolean;
  showPlayerCountFrom?: number;
}

export interface FeedEvent { date: string; text: string }

export interface Studio {
  name: string;
  tagline: string;
  email: string;
  instagram: string;
  tiktok: string;
  x: string;
  facebook: string;
  youtube: string;
  cfWebAnalyticsToken: string;
  publicBase: string;
  apiBase: string;
  /** OAuth client ids for the sign-up card (public; the API's wrangler.toml holds the same). Empty = button hidden. */
  googleClientId?: string;
  appleClientId?: string;
}

export interface SiteCtx {
  studio: Studio;
  games: GameEntry[];
  events: FeedEvent[];
  cssHref: string;
  base: string; // publicBase without trailing slash, for canonical/og urls
  todoEmail: boolean;
}
