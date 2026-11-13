// Safe localStorage (rule 12: never touch localStorage directly) + the anonymous user id (rule 20).
const PREFIX = 'tsg:';
let mem: Record<string, string> = {};

export function get(key: string): string | null {
  try { const v = localStorage.getItem(PREFIX + key); if (v !== null) return v; } catch { /* blocked */ }
  return mem[key] ?? null;
}
export function set(key: string, value: string): void {
  mem[key] = value;
  try { localStorage.setItem(PREFIX + key, value); } catch { /* blocked: memory only */ }
}
export function getNum(key: string): number { const v = Number(get(key)); return Number.isFinite(v) ? v : 0; }

function uuid(): string {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ }
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40; b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readCookie(name: string): string | null {
  try { const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)')); return m ? decodeURIComponent(m[1] ?? '') : null; } catch { return null; }
}
function writeCookie(name: string, value: string): void {
  try { document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${60 * 60 * 24 * 400}; path=/; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`; } catch { /* ignore */ }
}

const UUID_RE = /^[0-9a-f-]{36}$/i;
let cachedId: string | null = null;
/** Stable anonymous id: localStorage, cookie fallback, generated once. */
export function userId(): string {
  if (cachedId) return cachedId;
  let id = get('uid') || readCookie('tsg_uid');
  if (!id || !UUID_RE.test(id)) id = uuid();
  set('uid', id); writeCookie('tsg_uid', id);
  cachedId = id;
  return id;
}
export const shortUserId = (): string => userId().slice(0, 8);

export const getNick = (): string => get('nick') || '';
export const setNick = (n: string): void => set('nick', n.slice(0, 16));
export const getBest = (slug: string): number => getNum('best:' + slug);
export const setBest = (slug: string, v: number): void => set('best:' + slug, String(v));
export const isNewPlayer = (slug: string): boolean => !get('played:' + slug);
export const markPlayed = (slug: string): void => set('played:' + slug, '1');
