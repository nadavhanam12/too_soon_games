// Challenge-link preview: rewrite og:title (and twitter:title) of a game page when the URL carries
// ?c=<score>&n=<nick>. Pure string function so it runs in Workers and in Node tests alike.
// See docs/SHARE.md and docs/CONTRACTS.md.

export interface ChallengeParams { c: string | null; n?: string | null }

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

/** Validates params. Returns null when the request should be served unchanged. */
export function parseChallenge(p: ChallengeParams): { score: string; nick: string | null } | null {
  if (!p.c || !/^\d{1,10}$/.test(p.c)) return null;
  let nick: string | null = null;
  if (p.n) {
    const clean = p.n.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
    nick = clean ? Array.from(clean).slice(0, 16).join('') : null;
  }
  return { score: Number(p.c).toLocaleString('en-US'), nick };
}

function metaContent(html: string, prop: string): string | null {
  const re = new RegExp(`<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["']([^"']*)["']`, 'i');
  const m = html.match(re);
  return m?.[1] ?? null;
}

function setMeta(html: string, prop: string, value: string): string {
  const re = new RegExp(`(<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["'])([^"']*)(["'])`, 'i');
  return re.test(html) ? html.replace(re, `$1${value}$3`) : html;
}

export function rewriteOg(html: string, params: ChallengeParams): string {
  const ch = parseChallenge(params);
  if (!ch) return html;
  const rawTitle = metaContent(html, 'og:title') ?? (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? 'this game');
  const gameTitle = rawTitle.replace(/&amp;/g, '&').replace(/\s*[·|-]\s*(game|משחק)\s*$/i, '');
  const who = ch.nick ? esc(ch.nick) : 'A friend';
  const title = `${who} scored ${ch.score} in ${esc(gameTitle)}. Beat them?`;
  let out = setMeta(html, 'og:title', title);
  out = setMeta(out, 'twitter:title', title);
  return out;
}
