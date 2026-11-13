// Share text, the public URL and the challenge link (docs/SHARE.md).
import { env, type GameConfig } from '../config';
import { shortUserId } from '../storage/storage';

export interface Challenge { score: number; nick: string; from: string }

/** The game's public page (never an iframe host). */
export function publicUrl(cfg: GameConfig): string {
  const base = env.publicBase || location.origin;
  return `${base.replace(/\/$/, '')}/${cfg.slug}/`;
}

/** The link players share: carries their result so the opener sees "X did Y. Beat them?" */
export function challengeUrl(cfg: GameConfig, score: number, nick: string): string {
  const u = new URL(publicUrl(cfg));
  u.searchParams.set('c', String(Math.round(score)));
  if (nick) u.searchParams.set('n', nick.slice(0, 16));
  u.searchParams.set('u', shortUserId());
  return u.toString();
}

/** Reads ?c=&n=&u= from the current URL; null when absent or malformed. */
export function parseChallenge(): Challenge | null {
  try {
    const p = new URL(location.href).searchParams;
    const c = p.get('c');
    if (c === null || !/^\d{1,10}$/.test(c)) return null;
    const nick = (p.get('n') || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 16);
    const from = (p.get('u') || '').replace(/[^0-9a-f]/gi, '').slice(0, 8);
    return { score: Number(c), nick, from };
  } catch { return null; }
}

/** Fill the game's share template. {result} = the result in the game's words, {rank} = rank title, {url}. */
export function shareText(cfg: GameConfig, vars: { result: string; rank: string; url: string }): string {
  return cfg.share.text.replace('{result}', vars.result).replace('{rank}', vars.rank).replace('{url}', vars.url);
}
