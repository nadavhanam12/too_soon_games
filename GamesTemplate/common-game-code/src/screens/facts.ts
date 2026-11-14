import { W } from '../core/canvas';
import { takeTap } from '../core/input';
import { go, state, type Scene } from '../core/scenes';
import { R } from '../core/runtime';
import { inBtn, txt, wrap } from '../draw/prims';
import { env } from '../config';
import { reportOverlay } from '../share/overlays';
import { sfx } from '../audio/synth';

/** facts: what actually happened, dated lines, the parody note, source + report links (rules 3, 4ד, 17). */
export const factsScene: Scene = {
  enter() {
    // no outbound links (decision 44): the source is named as text, the only link is our own contact page
    const base = (env.publicBase || '').replace(/\/$/, '');
    reportOverlay.show(608, `${base}/contact/`, R.strs.reportLink, 90, W - 180);
  },
  exit() { reportOverlay.hide(); },
  draw() {
    const th = R.theme, c = R.content.facts, s = R.strs, st = state.st;
    th.bg(st, 'facts');
    R.hooks.drawFactsArt?.(st);
    th.heading(c.heading || s.whatHappened, W / 2, 48, 26);
    th.text(c.sub, W / 2, 78, 12, th.colors.muted, 'center', 400);
    th.panel(16, 96, W - 32, 380);
    const rtl = R.cfg.lang === 'he';
    let y = 118;
    for (const line of c.lines) {
      if (y > 450) break;
      const hasDate = !!line.date;
      const textX = rtl ? W - 30 - (hasDate ? 60 : 0) : 30 + (hasDate ? 60 : 0);
      const maxW = W - 60 - (hasDate ? 60 : 0);
      const ls = wrap(line.text, 12, maxW, line.bold ? 900 : 400);
      if (hasDate) th.chip(line.date!, rtl ? W - 54 : 54, y + 2, th.colors.panel === 'transparent' ? th.colors.accent : th.colors.accent, th.colors.accentInk, 10);
      ls.forEach((l, k) => txt(l, textX, y + k * 15, 12, line.bold ? th.colors.accent : th.colors.ink, rtl ? 'right' : 'left', line.bold ? 900 : 400));
      y += Math.max(1, ls.length) * 15 + 10;
    }
    let fy = 458;
    if (c.disclaimer) for (const l of wrap(c.disclaimer, 11, W - 40, 400)) { th.text(l, W / 2, fy, 11, th.colors.muted, 'center', 400); fy += 14; }
    th.text(s.parodyNote, W / 2, fy + 4, 11, th.colors.muted, 'center', 400);
    const e = R.cfg.event;
    th.text(`${s.source}: ${e.sourceLabel || e.date}`, W / 2, 524, 12, th.colors.ink, 'center', 700);
    // continue at 548..596, the report link (our contact page) at 598..618
    th.button(s.continue, W / 2, 572, 200, 48, true, 16);
    const p = takeTap();
    if (p && st > 0.4 && (p.key || inBtn(p, W / 2, 572, 200, 48, 6))) { sfx.tick?.(); go('community'); }
  },
};
