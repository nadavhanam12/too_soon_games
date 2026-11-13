// The hand-drawn theme: paper + falling chart background, marker cards, green ink buttons.
import { type Theme, type ThemeColors, txt, state, fullBleed } from '@tsg/index';
import { banner, card, hbtn, INK, NV, paper, sticker, tickInk } from './kit';
import { chart } from './art';

const colors: ThemeColors = { bg: '#161616', ink: INK, muted: '#9a9a9a', accent: NV, accentInk: '#0b0b0b', panel: '#222', panelLine: NV, danger: '#c9403a', ok: '#3d9d55' };

export const theme: Theme = {
  colors,
  bg(t) { tickInk(); paper(); fullBleed((h) => chart(t * 40, 0.5, h)); },
  panel(x, y, w, h) { card(x, y, w, h); },
  button(label, x, y, w, h, primary = true, size = 18) { hbtn(label, x, y, w, h, primary ? NV : '#dcd4c0', size); },
  heading(s, x, y, size = 26) { banner(s, x, y, Math.min(size, 30)); },
  text(s, x, y, size = 14, color = INK, align = 'center', weight = 400) { txt(s, x, y, size, color, align, weight); },
  chip(s, x, y, bg = '#fff8e0', fg = '#0b0b0b', size = 12) { sticker(s, x, y, size, bg, -0.04, fg); },
};
void state;
