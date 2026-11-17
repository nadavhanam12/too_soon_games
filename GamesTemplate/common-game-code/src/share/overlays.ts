// DOM overlays over the canvas: share buttons, follow block, nickname input, source link, desktop footer.
// Real links and inputs beat canvas fakes (clipboard, keyboard, long-press). Positioned in safe-zone units via place().
import { cv, onResize, place, view, W } from '../core/canvas';
import { END_GRACE_S } from '../core/input';
import { env } from '../config';
import type { Strings } from '../i18n/strings';
import { centralHref, isPhone, type SharePreset } from './presets';
import { track } from '../analytics/track';

export type Channel = 'whatsapp' | 'sms' | 'system' | 'copy' | 'menu' | 'x' | 'facebook' | 'telegram' | 'email';

let root: HTMLElement;
let strs: Strings;
let preset: SharePreset;
let lang: 'he' | 'en' = 'en';
let title = '';

const ICONS: Record<string, string> = {
  instagram: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM21.5 7.9c-.1-1.6-.4-3-1.6-4.2S17.3 2.2 15.7 2.1C14.1 2 9.9 2 8.3 2.1 6.7 2.2 5.3 2.5 4.1 3.7S2.6 6.3 2.5 7.9c-.1 1.6-.1 5.8 0 7.4.1 1.6.4 3 1.6 4.2s2.6 1.5 4.2 1.6c1.6.1 5.8.1 7.4 0 1.6-.1 3-.4 4.2-1.6s1.5-2.6 1.6-4.2c.1-1.6.1-5.8 0-7.4zm-2.2 9.1a3.3 3.3 0 0 1-1.9 1.9c-1.3.5-4.4.4-5.4.4s-4.1.1-5.4-.4a3.3 3.3 0 0 1-1.9-1.9c-.5-1.3-.4-4.4-.4-5.4s-.1-4.1.4-5.4a3.3 3.3 0 0 1 1.9-1.9c1.3-.5 4.4-.4 5.4-.4s4.1-.1 5.4.4a3.3 3.3 0 0 1 1.9 1.9c.5 1.3.4 4.4.4 5.4s.1 4.1-.4 5.4z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.3l-4.9-6.4L5 21H1.9l7.3-8.3L1.5 3H8l4.4 5.9L17.5 3zm-1.1 16.2h1.7L7.1 4.7H5.3l11.1 14.5z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.5V21h3.1z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z"/></svg>',
};
const NETWORKS = ['instagram', 'tiktok', 'x', 'facebook', 'youtube'] as const;
const MENU_ICONS: Record<string, string> = {
  whatsapp: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.700 6.700 0 0 1-3.300-2.900c-.2-.4.2-.4.600-1.200.100-.200 0-.300 0-.500l-.800-1.900c-.200-.500-.400-.400-.600-.400h-.500c-.2 0-.5.100-.700.300-.900.900-1.100 2.100-.500 3.400a11.600 11.600 0 0 0 4.700 4.400c1.700.7 2.400.8 3.200.600.500-.100 1.500-.600 1.700-1.200.2-.600.2-1.100.100-1.200l-.300-.200z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21.4 3.6 2.9 10.700c-1.200.500-1.200 1.200-.200 1.500l4.700 1.500 1.800 5.600c.2.600.4.800.9.800.4 0 .600-.200.900-.400l2.300-2.200 4.700 3.500c.9.500 1.500.2 1.700-.800L22.900 5c.3-1.300-.5-1.900-1.500-1.400zM8.100 13.300l9.300-5.900c.4-.3.800-.1.500.2l-7.700 7-.3 3.200-1.800-4.500z"/></svg>',
  email: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 7.700L4.500 7v10h15V7L12 12.700zM6 7l6 4.500L18 7H6z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10.600 13.400a1 1 0 0 1 0-1.400l3.500-3.500a3 3 0 1 1 4.200 4.200l-1.700 1.700a1 1 0 0 1-1.400-1.400l1.700-1.700a1 1 0 0 0-1.400-1.400L12 13.400a1 1 0 0 1-1.400 0zm2.800-2.800a1 1 0 0 1 0 1.400l-3.500 3.500a3 3 0 1 1-4.200-4.200l1.700-1.700a1 1 0 0 1 1.400 1.400l-1.700 1.700a1 1 0 0 0 1.400 1.400l3.500-3.500a1 1 0 0 1 1.400 0z"/></svg>',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); e.className = cls; e.innerHTML = html; return e;
}

// ---------- share block ----------
// One share button (DECISIONS 68, 78). On a phone: the system share sheet where the browser has one (it already lists
// WhatsApp, Messages, Instagram...), otherwise the audience's messaging app (wa.me / sms:). On a desktop: our own
// menu of platforms, each with a link prepared the way that platform wants it (shareMenu below). Under it, "Copy link".
const shareBox = el('div', 'tsg-share');
const central = el('a', 'tsg-btn tsg-central'); central.target = '_blank'; central.rel = 'noopener';
const copyBtn = el('button', 'tsg-btn tsg-copy'); copyBtn.type = 'button';
let shareData: { text: string; url: string } = { text: '', url: '' };
let onShare: ((c: Channel) => void) | null = null;

function copyText(s: string): void {
  const ok = () => { copyBtn.textContent = strs.copied; track('share_complete', { channel: 'copy' }); setTimeout(() => (copyBtn.textContent = strs.copy), 2200); };
  const fail = () => { copyBtn.textContent = strs.notCopied; setTimeout(() => (copyBtn.textContent = strs.copy), 2200); };
  const legacy = () => {
    try {
      const ta = document.createElement('textarea'); ta.value = s; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, s.length);
      const r = document.execCommand('copy'); document.body.removeChild(ta); r ? ok() : fail();
    } catch { fail(); }
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(s).then(ok).catch(legacy); else legacy();
}

export const shareOverlay = {
  /** y = top of the block in safe units; it takes 108 units: share button 50, gap 10, copy row 44 (+4). */
  show(data: { text: string; url: string }, y: number, cb?: (c: Channel) => void): void {
    shareData = data; onShare = cb || null;
    // a desktop gets the menu even where the browser has a share sheet: the Windows / macOS sheet hands apps bare text,
    // and WhatsApp desktop then shows the link without its preview card (found 2026-11-17)
    const menu = !isPhone(), system = !menu && typeof navigator.share === 'function';
    central.textContent = menu || system ? strs.shareSystem : preset.centralLabel[lang];
    central.style.background = preset.centralColor; central.style.color = preset.centralInk;
    central.href = menu || system ? '#' : centralHref(preset.central, data.text);
    central.dataset.channel = menu ? 'menu' : system ? 'system' : preset.central;
    copyBtn.textContent = strs.copy; copyBtn.hidden = false;
    shareMenu.hidden = true;
    shareBox.hidden = false; shareBox.dataset.y = String(y);
    this.layout();
  },
  hide(): void { shareBox.hidden = true; shareMenu.hidden = true; },
  layout(): void {
    if (shareBox.hidden) return;
    const y = Number(shareBox.dataset.y || 400);
    place(shareBox, 20, y, W - 40, 108, 15);
  },
};
central.addEventListener('click', (e) => {
  const ch = central.dataset.channel as Channel;
  track('share_click', { channel: ch }); onShare?.(ch);
  if (ch === 'menu') { e.preventDefault(); openShareMenu(); return; }
  if (ch !== 'system') return; // a real wa.me / sms: link
  e.preventDefault();
  // The link only, never a file (2026-11-17): with a picture attached Facebook and Messenger open their photo picker
  // and drop the link, WhatsApp sends the picture and the text as two messages, iOS drops the text. A bare link gets
  // one message with the page's preview card (og:image + the personal og:title) everywhere.
  // the share text already ends with the link (RULES 16); passing `url` as well made apps print it twice. `url` goes
  // along only for a text that has no link in it.
  const url = shareData.url && !shareData.text.includes(shareData.url) ? shareData.url : undefined;
  navigator.share({ title, text: shareData.text, url }).then(() => track('share_complete', { channel: 'system' })).catch((err: { name?: string }) => {
    if (err && err.name === 'AbortError') return;
    window.open(centralHref(preset.central === 'sms' && !isPhone() ? 'whatsapp' : preset.central, shareData.text), '_blank', 'noopener');
  });
});
copyBtn.addEventListener('click', () => { track('share_click', { channel: 'copy' }); onShare?.('copy'); copyText(shareData.text); });
shareBox.append(central, copyBtn);

// ---------- the share menu (desktop): pick a platform, the link is prepared for it ----------
// Like the share menus of the big sites: every platform gets its own share URL, so each one builds its own preview
// card from the page (og tags). Opened in a new tab; the menu closes on a pick, on the backdrop and on Escape.
const shareMenu = el('div', 'tsg-menu');
const MENU: ReadonlyArray<{ id: Exclude<Channel, 'sms' | 'system' | 'menu'>; name: string; bg: string; ink: string }> = [
  { id: 'whatsapp', name: 'WhatsApp', bg: '#25d366', ink: '#0b2a1a' },
  { id: 'x', name: 'X', bg: '#000000', ink: '#ffffff' },
  { id: 'facebook', name: 'Facebook', bg: '#1877f2', ink: '#ffffff' },
  { id: 'telegram', name: 'Telegram', bg: '#29a9eb', ink: '#ffffff' },
  { id: 'email', name: '', bg: '#6b6b76', ink: '#ffffff' },   // name from strs.email
  { id: 'copy', name: '', bg: '#3c3c44', ink: '#ffffff' },    // name from strs.copy
];
/** The share URL of a platform. `text` ends with the link (RULES 16); platforms that take the link on its own get the
 *  words and the link apart, so the link is never printed twice. */
function platformHref(id: string, text: string, url: string): string {
  const words = encodeURIComponent(text.replace(url, '').trim()), u = encodeURIComponent(url), all = encodeURIComponent(text);
  switch (id) {
    case 'whatsapp': return `https://wa.me/?text=${all}`;
    case 'x': return `https://x.com/intent/post?text=${words}&url=${u}`;
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'telegram': return `https://t.me/share/url?url=${u}&text=${words}`;
    case 'email': return `mailto:?subject=${encodeURIComponent(title)}&body=${all}`;
    default: throw new Error(`no share URL for ${id}`);
  }
}
function openShareMenu(): void {
  const items = MENU.map((m) => {
    const label = m.id === 'email' ? strs.email : m.id === 'copy' ? strs.copy : m.name;
    const icon = `<i style="background:${m.bg};color:${m.ink}">${MENU_ICONS[m.id] ?? ICONS[m.id] ?? ''}</i><span>${label}</span>`;
    return m.id === 'copy'
      ? `<button type="button" class="tsg-menu-item" data-ch="copy">${icon}</button>`
      : `<a class="tsg-menu-item" data-ch="${m.id}" target="_blank" rel="noopener" href="${platformHref(m.id, shareData.text, shareData.url)}">${icon}</a>`;
  }).join('');
  shareMenu.innerHTML = `<div class="tsg-menu-panel" role="dialog" aria-label="${strs.shareTo}"><p>${strs.shareTo}</p><div class="tsg-menu-grid">${items}</div><button type="button" class="tsg-menu-close">${strs.close}</button></div>`;
  shareMenu.hidden = false;
}
shareMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement, item = t.closest<HTMLElement>('.tsg-menu-item');
  if (item) {
    const ch = item.dataset.ch as Channel;
    track('share_click', { channel: ch }); onShare?.(ch);
    if (ch === 'copy') copyText(shareData.text);   // the "Copy link" button under the menu shows "Copied"
    shareMenu.hidden = true;
    return;
  }
  if (t === shareMenu || t.closest('.tsg-menu-close')) shareMenu.hidden = true;   // the backdrop or Close
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !shareMenu.hidden) { shareMenu.hidden = true; e.stopPropagation(); } }, true);

// ---------- follow block ----------
const followBox = el('div', 'tsg-follow');
export const followOverlay = {
  /** y = top; takes 56 units (four 56px circles, 16 gap, centred). */
  show(y: number): void {
    if (!followBox.childElementCount) {
      for (const n of NETWORKS) {
        const href = (env.studio as Record<string, string> | undefined)?.[n] || '';
        const a = el('a', 'tsg-net' + (href ? '' : ' tsg-net-off'), ICONS[n]);
        a.setAttribute('aria-label', n);
        if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.addEventListener('click', () => track('follow_click', { network: n })); }
        else { a.setAttribute('aria-disabled', 'true'); a.tabIndex = -1; }
        followBox.appendChild(a);
      }
    }
    followBox.hidden = false; followBox.dataset.y = String(y); this.layout();
  },
  hide(): void { followBox.hidden = true; },
  layout(): void { if (!followBox.hidden) place(followBox, 20, Number(followBox.dataset.y || 180), W - 40, 56, 14); },
};

// ---------- nickname input (result screen) ----------
const nickBox = el('div', 'tsg-nick');
const nickInput = el('input', 'tsg-input'); nickInput.maxLength = 16; nickInput.autocomplete = 'off'; nickInput.autocapitalize = 'words'; nickInput.enterKeyHint = 'done';
const saveBtn = el('button', 'tsg-btn tsg-save'); saveBtn.type = 'button';
const skipBtn = el('button', 'tsg-link'); skipBtn.type = 'button';
let onNick: ((nick: string | null) => void) | null = null;
let nickArmTimer = 0;
export const nickOverlay = {
  /** y = top; takes 124 units: input 46, gap 6, save 48, gap 6, skip 18.
   *  Dimmed and unclickable for END_GRACE_S after it appears (taps left over from the game). */
  show(y: number, prefill: string, cb: (nick: string | null) => void): void {
    onNick = cb; nickInput.value = prefill; nickInput.placeholder = strs.nickPlaceholder;
    saveBtn.textContent = strs.saveToBoard; skipBtn.textContent = strs.skip;
    clearTimeout(nickArmTimer); nickBox.classList.add('tsg-arming');
    nickArmTimer = window.setTimeout(() => nickBox.classList.remove('tsg-arming'), END_GRACE_S * 1000);
    nickBox.hidden = false; nickBox.dataset.y = String(y); this.layout();
  },
  hide(): void { clearTimeout(nickArmTimer); nickBox.hidden = true; try { nickInput.blur(); } catch { /* ignore */ } },
  layout(): void { if (!nickBox.hidden) place(nickBox, 30, Number(nickBox.dataset.y || 500), W - 60, 124, 15); },
  value: (): string => nickInput.value.replace(/\s+/g, ' ').trim().slice(0, 16),
};
const submitNick = () => { const v = nickOverlay.value(); onNick?.(v || null); };
saveBtn.addEventListener('click', submitNick);
nickInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitNick(); } e.stopPropagation(); });
nickInput.addEventListener('keyup', (e) => e.stopPropagation());
skipBtn.addEventListener('click', () => onNick?.(null));
nickBox.append(nickInput, saveBtn, skipBtn);

// ---------- links (facts screen: source + report) ----------
function makeLink(cls: string, h: number, fontPx: number, onClick?: () => void) {
  const a = el('a', cls); a.target = '_blank'; a.rel = 'noopener';
  if (onClick) a.addEventListener('click', onClick);
  return {
    el: a,
    show(y: number, href: string, label: string, x = 60, w = W - 120): void { a.href = href; a.textContent = label; a.hidden = false; a.dataset.y = String(y); a.dataset.x = String(x); a.dataset.w = String(w); this.layout(); },
    hide(): void { a.hidden = true; },
    layout(): void { if (!a.hidden) place(a, Number(a.dataset.x || 60), Number(a.dataset.y || 560), Number(a.dataset.w || W - 120), h, fontPx); },
  };
}
export const sourceOverlay = makeLink('tsg-btn tsg-src', 44, 14, () => track('source_click'));
export const reportOverlay = makeLink('tsg-link tsg-report', 20, 11);
const srcLink = sourceOverlay.el, reportLink = reportOverlay.el;

// ---------- "More games" button with the studio logo (community screen, every device; DECISIONS 70, 71) ----------
// Same tab on purpose: the player is done with this game and goes to the studio home page.
const moreLink = el('a', 'tsg-btn tsg-more');
export const moreGamesOverlay = {
  /** y = top; takes 44 units (bugcheck minimum tap target). */
  show(y: number): void { moreLink.hidden = false; moreLink.dataset.y = String(y); this.layout(); },
  hide(): void { moreLink.hidden = true; },
  layout(): void { if (!moreLink.hidden) place(moreLink, 70, Number(moreLink.dataset.y || 484), W - 140, 44, 14); },
};

// ---------- desktop footer: logo + "More games" (outside the canvas) ----------
const footer = el('div', 'tsg-footer');
function layoutFooter(): void {
  const r = cv.getBoundingClientRect();
  const below = window.innerHeight - (r.top + r.height);
  footer.hidden = window.innerWidth < 700 || below < 34;
  if (!footer.hidden) { footer.style.top = r.top + r.height + 6 + 'px'; footer.style.left = r.left + 'px'; footer.style.width = r.width + 'px'; }
}

export function hideAllOverlays(): void { shareOverlay.hide(); followOverlay.hide(); nickOverlay.hide(); sourceOverlay.hide(); reportOverlay.hide(); moreGamesOverlay.hide(); }

export function initOverlays(opts: { strings: Strings; preset: SharePreset; lang: 'he' | 'en'; title: string }): void {
  strs = opts.strings; preset = opts.preset; lang = opts.lang; title = opts.title;
  root = el('div', 'tsg-ov'); root.dir = lang === 'he' ? 'rtl' : 'ltr';
  root.append(shareBox, followBox, nickBox, srcLink, reportLink, moreLink, shareMenu);
  document.body.append(root, footer);
  const home = (env.publicBase || '').replace(/\/$/, '') + '/';
  const arrow = lang === 'he' ? '←' : '→'; // points forward in the reading direction
  footer.innerHTML = `<a href="${home}">${strs.moreGames} ${arrow}</a><span>Too Soon Games</span>`;
  moreLink.href = home; moreLink.innerHTML = `<img src="${env.studioLogo}" alt="Too Soon Games"><span>${strs.moreGames} ${arrow}</span>`;
  hideAllOverlays();
  const layoutAll = () => { shareOverlay.layout(); followOverlay.layout(); nickOverlay.layout(); sourceOverlay.layout(); reportOverlay.layout(); moreGamesOverlay.layout(); layoutFooter(); };
  onResize(layoutAll);
  layoutAll();
  // keep overlays glued to the canvas while the keyboard opens/closes on phones
  window.visualViewport?.addEventListener('scroll', layoutAll);
  void view;
}
