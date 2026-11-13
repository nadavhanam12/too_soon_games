// A Theme is how the shared screens draw: background, panels, buttons, headings.
// The template ships a flat default; a game overrides any part (e.g. FallingCEO's hand-drawn kit).
import { ctx, fillBg } from '../core/canvas';
import { rr, txt, type Align } from './prims';

export interface ThemeColors {
  bg: string;        // page background (also used behind the canvas on desktop)
  bg2?: string;      // optional gradient end
  ink: string;       // main text
  muted: string;     // secondary text
  accent: string;    // primary button / highlights
  accentInk: string; // text on accent
  panel: string;     // card fill
  panelLine?: string;
  danger: string;
  ok: string;
}

export interface Theme {
  colors: ThemeColors;
  /** Full-height background. `t` = seconds in scene. */
  bg(t: number, scene: string): void;
  panel(x: number, y: number, w: number, h: number): void;
  button(label: string, x: number, y: number, w: number, h: number, primary?: boolean, size?: number): void;
  heading(s: string, x: number, y: number, size?: number, align?: Align): void;
  text(s: string, x: number, y: number, size?: number, color?: string, align?: Align, weight?: number | string): void;
  /** Small label chip (used for "New best", dates in facts). */
  chip(s: string, x: number, y: number, bg?: string, fg?: string, size?: number): void;
}

export function defaultTheme(c: Partial<ThemeColors> = {}): Theme {
  const colors: ThemeColors = {
    bg: '#140b24', bg2: '#221440', ink: '#ffffff', muted: '#b9a9d9', accent: '#ffc400', accentInk: '#1a1200',
    panel: 'rgba(255,255,255,.07)', panelLine: 'rgba(255,255,255,.12)', danger: '#ff5c7a', ok: '#3ddc84', ...c,
  };
  return {
    colors,
    bg() { fillBg(colors.bg, colors.bg2); },
    panel(x, y, w, h) { rr(x, y, w, h, 16, colors.panel, colors.panelLine, 1.5); },
    button(label, x, y, w, h, primary = true, size = 17) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      rr(x - w / 2, y - h / 2, w, h, h / 2, primary ? colors.accent : 'rgba(255,255,255,.12)');
      ctx.restore();
      if (!primary) rr(x - w / 2, y - h / 2, w, h, h / 2, undefined, 'rgba(255,255,255,.3)', 1.5);
      txt(label, x, y + 1, size, primary ? colors.accentInk : colors.ink, 'center', 900);
    },
    heading(s, x, y, size = 30, align = 'center') { txt(s, x + 2, y + 2, size, 'rgba(0,0,0,.4)', align, 900); txt(s, x, y, size, colors.accent, align, 900); },
    text(s, x, y, size = 14, color = colors.ink, align = 'center', weight = 400) { txt(s, x, y, size, color, align, weight); },
    chip(s, x, y, bg = colors.accent, fg = colors.accentInk, size = 12) {
      ctx.font = `900 ${size}px ${ctx.font.split('px ')[1] || 'sans-serif'}`;
      const w = ctx.measureText(s).width + 18, h = size + 10;
      rr(x - w / 2, y - h / 2, w, h, h / 2, bg); txt(s, x, y + 1, size, fg, 'center', 900);
    },
  };
}
