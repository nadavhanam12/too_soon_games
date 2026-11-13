// Shapes of games.json and studio.json (see docs/CONTRACTS.md).
export interface GameEntry {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  audience: 'il' | 'us';
  lang: 'he' | 'en';
  version?: string;
  event?: { title?: string; date?: string; sourceUrl?: string };
  cover?: string;
  ogImage?: string;
  publishedAt?: string;
  status?: 'live' | 'archived';
  featured?: boolean;
  showPlayerCountFrom?: number;
}

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
}

export interface SiteCtx {
  studio: Studio;
  games: GameEntry[];
  cssHref: string;
  base: string; // publicBase without trailing slash, for canonical/og urls
  todoEmail: boolean;
}
