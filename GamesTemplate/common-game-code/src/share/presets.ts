// Share presets per audience (docs/SHARE.md). Adding a market = one entry here.
import type { Audience } from '../config';

export type Central = 'whatsapp' | 'sms';

export interface SharePreset {
  central: Central;          // the big button: the audience's personal messaging app
  centralLabel: { he: string; en: string };
  centralColor: string;      // button background
  centralInk: string;
  numberLocale: string;
}

export const PRESETS: Record<Audience, SharePreset> = {
  il: { central: 'whatsapp', centralLabel: { he: 'שיתוף בווצאפ', en: 'Share on WhatsApp' }, centralColor: '#25d366', centralInk: '#0b2a1a', numberLocale: 'he-IL' },
  us: { central: 'sms', centralLabel: { he: 'שלח לחבר', en: 'Text a friend' }, centralColor: '#34c759', centralInk: '#07260f', numberLocale: 'en-US' },
};

/** Deep link for the central button. On desktop `sms:` does nothing useful, so the caller swaps it for copy. */
export function centralHref(central: Central, text: string): string {
  const t = encodeURIComponent(text);
  return central === 'whatsapp' ? `https://wa.me/?text=${t}` : `sms:?&body=${t}`;
}

export const isPhone = (): boolean => /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent);
