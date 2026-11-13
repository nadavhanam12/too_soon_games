// game.json shape (docs/CONTRACTS.md) + the build-time environment.

export type Audience = 'il' | 'us';
export type Lang = 'he' | 'en';

export interface GameConfig {
  id: string;            // folder name in Games/, PascalCase
  slug: string;          // URL + API key, kebab-case, never changes after publish
  title: string;
  tagline: string;
  audience: Audience;
  lang: Lang;
  version: string;
  event: { title: string; date: string; sourceUrl: string; sourceLabel?: string };
  score: { label: string; max: number; minDurationS: number; higherIsBetter: boolean };
  share: { text: string };                       // {result} {rank} {url}
  screens: { cutscene: boolean; board: boolean; facts: boolean; lose?: boolean };
  showPlayerCountFrom: number;
  cover?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  publishedAt?: string;
  status?: 'live' | 'archived' | 'draft';
  music?: boolean;       // default true
  fonts?: string[];      // extra Google Fonts families (Rubik is always loaded)
  themeColor?: string;   // browser chrome colour
}

export interface StudioLinks { instagram?: string; tiktok?: string; x?: string; facebook?: string; youtube?: string; email?: string }

/** Injected by build.mjs via esbuild `define`. */
export interface Env {
  apiBase: string;       // '' = no server (leaderboard/analytics silently off)
  publicBase: string;    // 'https://toosoon-games.pages.dev' ('' = location.origin)
  buildTime: string;
  dev: boolean;
  studio: StudioLinks;
}

declare const TSG_ENV: Env;
export const env: Env = typeof TSG_ENV !== 'undefined' ? TSG_ENV : { apiBase: '', publicBase: '', buildTime: '', dev: true, studio: {} };

export function validateConfig(c: GameConfig): string[] {
  const errs: string[] = [];
  const need = (ok: unknown, msg: string) => { if (!ok) errs.push(msg); };
  need(/^[A-Z][A-Za-z0-9]+$/.test(c.id), 'id must be PascalCase');
  need(/^[a-z0-9][a-z0-9-]{1,39}$/.test(c.slug), 'slug must be kebab-case');
  need(c.title && c.tagline, 'title and tagline required');
  need(c.audience === 'il' || c.audience === 'us', 'audience must be il|us');
  need(c.lang === 'he' || c.lang === 'en', 'lang must be he|en');
  need(c.event?.sourceUrl && c.event?.date, 'event.sourceUrl and event.date required (rule 3)');
  need(c.score && c.score.max > 0, 'score.max must be > 0');
  need(c.share?.text?.includes('{url}'), 'share.text must contain {url}');
  need((c.share?.text || '').replace('{url}', '').length <= 200, 'share.text over 200 chars before the link (rule 16)');
  return errs;
}
