// Tiny helpers shared by the templates.
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const attr = esc;

/** Timeline time: "today", "3d" for the last week, then "Nov 15" ("Nov 15, 2025" in an earlier year). The client script repeats this logic (layout.ts). */
export function shortTime(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const days = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - t) / 86400000);
  if (days <= 0) return 'today';
  if (days < 7) return `${days}d`;
  const d = new Date(t);
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}

export const regionOf = (audience: string): string => (audience === 'il' ? 'IL' : audience === 'us' ? 'US' : 'Global');
export const langName = (lang: string): string => (lang === 'he' ? 'Hebrew' : 'English');

/** Join template parts, dropping falsy ones. */
export const join = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join('\n');
