// Inline SVG icons (currentColor). Kept tiny on purpose.
const wrap = (path: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="${path}"/></svg>`;

export const icons = {
  instagram: wrap('M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM17.5 5.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z'),
  tiktok: wrap('M13.5 2h3.1c.2 1.9 1.4 3.4 3.4 3.7v3.1c-1.3 0-2.5-.4-3.4-1.1v7.1A6.2 6.2 0 1 1 10.4 8.6v3.2a3.1 3.1 0 1 0 3.1 3.1V2z'),
  x: wrap('M3 3h4.6l4.3 6 5.2-6h2.6l-6.6 7.6L21 21h-4.6l-4.7-6.5L6 21H3.4l7.1-8.2L3 3zm3.6 1.6 10.6 14.8h1.3L8 4.6H6.6z'),
  facebook: wrap('M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z'),
  youtube: wrap('M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z'),
  play: wrap('M8 5v14l11-7z'),
  arrow: wrap('M5 12h12l-4.5-4.5L14 6l7 6-7 6-1.5-1.5L17 14H5z'),
} as const;

export type IconName = keyof typeof icons;
