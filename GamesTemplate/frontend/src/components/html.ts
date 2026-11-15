// Tiny helpers shared by the templates.
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const attr = esc;

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** "Saturday, November 15, 2026" (UTC). */
export function fmtLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** "today", "yesterday", "3 days ago", "3 weeks ago", "2 months ago". The client script repeats this logic (home.ts). */
export function relTime(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const days = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export const regionOf = (audience: string): string => (audience === 'il' ? 'IL' : audience === 'us' ? 'US' : 'Global');
export const langName = (lang: string): string => (lang === 'he' ? 'Hebrew' : 'English');

/** Join template parts, dropping falsy ones. */
export const join = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join('\n');
