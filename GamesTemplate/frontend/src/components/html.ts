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

export const flag = (audience: string): string => (audience === 'il' ? '🇮🇱' : audience === 'us' ? '🇺🇸' : '🌐');
export const langName = (lang: string): string => (lang === 'he' ? 'Hebrew' : 'English');

/** Join template parts, dropping falsy ones. */
export const join = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join('\n');
