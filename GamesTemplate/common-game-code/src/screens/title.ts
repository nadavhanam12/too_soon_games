import { W } from '../core/canvas';
import { takeTap } from '../core/input';
import { go, state, type Scene } from '../core/scenes';
import { R } from '../core/runtime';
import { fmtInt, txt, wrap } from '../draw/prims';
import { track } from '../analytics/track';
import { markPlayed } from '../storage/storage';
import { sfx } from '../audio/synth';

/** title: heading, intro lines, challenge banner, player count, best, "tap to start". */
export const titleScene: Scene = {
  draw() {
    const st = state.st, th = R.theme, c = R.content.title, s = R.strs;
    th.bg(st, 'title');
    R.hooks.drawTitleArt?.(st);
    th.heading(c.heading, W / 2, 150, c.heading.length > 14 ? 34 : 44);
    let y = 215;
    for (const line of c.lines) { for (const l of wrap(line, 15, W - 60, 400)) { th.text(l, W / 2, y, 15, th.colors.ink, 'center', 400); y += 22; } y += 4; }

    if (R.challenge) {
      const name = R.challenge.nick || s.aFriend;
      const words = R.content.result.resultWords({ score: R.challenge.score, durationS: 0, won: true });
      th.panel(24, 420, W - 48, 64);
      th.text(s.challenge(name, words), W / 2, 452, 16, th.colors.accent, 'center', 900);
    } else if (R.players !== null && R.players >= R.cfg.showPlayerCountFrom) {
      th.text(s.playersPlayed(fmtInt(R.players)), W / 2, 452, 14, th.colors.muted, 'center', 700);
    }
    if (R.best > 0) th.text(`${s.yourBest}: ${R.content.result.resultWords({ score: R.best, durationS: 0, won: true })}`, W / 2, 500, 14, th.colors.muted, 'center', 700);
    if (Math.sin(st * 4) > -0.2) th.text(s.tapToStart, W / 2, 585, 16, th.colors.ink, 'center', 900);
    if (c.credit) txt(c.credit, W / 2, 624, 11, th.colors.muted, 'center', 400);

    const p = takeTap();
    if (p && st > 0.3) {
      sfx.tick?.();
      markPlayed(R.cfg.slug);
      R.retry = null;
      track('game_start');
      go(R.cfg.screens.cutscene && R.content.cutscene ? 'cutscene' : 'play');
    }
  },
};
