import { W } from '../core/canvas';
import { takeTap } from '../core/input';
import { go, goNow, state, type Scene } from '../core/scenes';
import { R } from '../core/runtime';
import { inBtn, wrap } from '../draw/prims';
import { track } from '../analytics/track';
import { sfx } from '../audio/synth';

/** lose: heading, line, consolation (a true fact works), score so far, retry-from-stage / restart. */
export const loseScene: Scene = {
  draw() {
    const th = R.theme, c = R.content.lose, s = R.strs, st = state.st, run = R.run!;
    th.bg(st, 'lose');
    R.hooks.drawLoseArt?.(st, run);
    th.heading(c.heading, W / 2, 190, 42);
    let y = 250;
    for (const l of wrap(c.line, 16, W - 60, 700)) { th.text(l, W / 2, y, 16, th.colors.ink, 'center', 700); y += 22; }
    if (c.consolation) { y += 6; for (const l of wrap(c.consolation, 13, W - 60, 400)) { th.text(l, W / 2, y, 13, th.colors.muted, 'center', 400); y += 18; } }
    th.text(`${s.scoreSoFar}: ${R.content.result.resultWords(run)}`, W / 2, 352, 18, th.colors.accent, 'center', 900);
    const canRetry = !!run.stage;
    if (canRetry) th.button(s.retryStage, W / 2, 440, 260, 54, true, 17);
    th.button(canRetry ? s.restart : s.playAgain, W / 2, canRetry ? 510 : 450, canRetry ? 190 : 240, canRetry ? 46 : 54, !canRetry, 16);

    const p = takeTap();
    if (!p || st < 0.5) return;
    if (canRetry && (p.key || inBtn(p, W / 2, 440, 260, 54))) {
      R.retry = { stage: run.stage, score: run.score }; track('retry', { stage: run.stage }); sfx.ok?.(); goNow('play'); return;
    }
    if (inBtn(p, W / 2, canRetry ? 510 : 450, 240, 54) || (!canRetry && p.key)) { R.retry = null; track('replay', { fromScreen: 'lose' }); sfx.tick?.(); go('title'); }
  },
};
