// RULES 22ב: a file whose name stays the same between releases (lazy/*.js, paintings, portraits, music) is always
// requested with the game's version in its URL. Browsers and Cloudflare hold these files for hours; without the
// version a returning player ran the new index.html with the previous release's files (Nice City v0.1.11,
// 2026-11-17). The bug check goes red on a file the page requests without it.
import { env } from '../config';

/** The URL to load a file of the game from (relative to the page, e.g. 'assets/scenes/title.webp'). Use it for
 *  every `new Image()`, `new Audio()`, `fetch` or script tag that loads a file shipped with the game. */
export function assetUrl(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(env.version)}`;
}
