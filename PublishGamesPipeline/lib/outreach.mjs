// Shared by the journalists, emails and creators stages: config, the suppression list, slugs and tracked links.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './state.mjs';

export const PIPE = join(REPO, 'PublishGamesPipeline');
export const config = () => JSON.parse(readFileSync(join(PIPE, 'config.json'), 'utf8'));
export const studio = () => JSON.parse(readFileSync(join(REPO, 'GamesTemplate', 'studio.json'), 'utf8'));
export const gameCfg = (gameId) => JSON.parse(readFileSync(join(REPO, 'Games', gameId, 'game.json'), 'utf8'));
export const launch = (gameId) => join(REPO, 'Games', gameId, 'launch');

export function readJson(file, why) {
  if (!existsSync(file)) { console.error(`${file.replace(REPO, '')} missing: ${why}`); process.exit(1); }
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * PublishGamesPipeline/private/suppression.csv: one entry per line, "value,date,note". value is an email, a handle
 * (@name), a URL, or a whole domain (@outlet.com). Shared by every game: whoever asked to be removed is never contacted.
 * The file not existing yet is the normal state before the first removal request.
 */
export function suppression() {
  const f = join(PIPE, 'private', 'suppression.csv');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.split(',')[0].trim().toLowerCase()).filter((v) => v && !v.startsWith('#') && v !== 'value');
}
function hostOf(v) {
  if (v.includes('@') && !v.startsWith('@')) return v.split('@').pop();
  try { return new URL(v).host.replace(/^www\./, ''); } catch { return ''; } // a handle, not a URL: it has no host
}
/** Returns the suppression entry that matches any of the values (exact, or "@domain" against an email or URL). */
export function isSuppressed(list, ...values) {
  const vs = values.filter(Boolean).map((v) => String(v).trim().toLowerCase());
  return list.find((s) => vs.some((v) => {
    if (v === s) return true;
    if (!(s.startsWith('@') && s.includes('.'))) return false;
    const d = s.slice(1), h = hostOf(v);
    return h === d || h.endsWith('.' + d);
  }));
}

export const slug = (s) => String(s).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40);

/** The game link with UTM. utm_source is what the admin funnel groups by (an outlet, a creator), medium the channel type. */
export function trackedLink(gameId, campaign, { source, medium, content }) {
  const cfg = gameCfg(gameId);
  const base = `${(studio().publicBase || '').replace(/\/$/, '')}/${cfg.slug}/`;
  const q = new URLSearchParams({ utm_source: source, utm_medium: medium, utm_campaign: campaign, ...(content ? { utm_content: content } : {}) });
  return `${base}?${q}`;
}

/**
 * The local build (.local-dist) talks to the production API (build.mjs --local uses studio.apiBase), so a page the
 * pipeline drives would write real events, scores and player counts. Every request to the API is refused instead:
 * the game treats an unreachable API as offline (leaderboard hidden, events dropped).
 */
export async function blockApi(context) {
  const api = (studio().apiBase || '').replace(/\/$/, '');
  if (!api) return;
  await context.route(`${api}/**`, (route) => route.abort('blockedbyclient'));
}
