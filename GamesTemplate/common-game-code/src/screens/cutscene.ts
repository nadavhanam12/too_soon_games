import { W } from '../core/canvas';
import { takeTap } from '../core/input';
import { go, S, state, type Scene } from '../core/scenes';
import { R } from '../core/runtime';
import { inBtn, wrap } from '../draw/prims';
import { track } from '../analytics/track';
import { sfx } from '../audio/synth';

/**
 * cutscene: timed steps with a caption, like boarding the plane in "טיסה נעימה".
 * Tap advances (after 0.4 s), the last step shows the game's button. "Skip" top corner.
 */
export const cutsceneScene: Scene = {
  enter() { S.i = 0; S.st = 0; S.done = false; },
  draw(dt) {
    const th = R.theme, cs = R.content.cutscene!, s = R.strs;
    const steps = cs.steps, i = S.i as number, step = steps[i];
    S.st += dt;
    th.bg(state.st, 'cutscene');
    R.hooks.drawCutsceneBg?.(state.st);
    if (step) {
      const k = step.dur > 0 ? Math.min(1, S.st / step.dur) : Math.min(1, S.st / 1.5);
      step.draw?.(S.st, k);
      if (step.text) {
        const lines = wrap(step.text, 15, W - 80, 400);
        const h = lines.length * 21 + 40 + (step.speaker ? 18 : 0);
        th.panel(16, 476 - h / 2 + 40, W - 32, h);
        let y = 476 - h / 2 + 40 + 22;
        if (step.speaker) { th.text(step.speaker, W / 2, y, 13, th.colors.accent, 'center', 900); y += 20; }
        for (const l of lines) { th.text(l, W / 2, y, 15, th.colors.ink, 'center', 400); y += 21; }
      }
      if (step.dur > 0 && S.st >= step.dur) advance();
    }
    const last = i >= steps.length - 1;
    if (last) th.button(cs.button, W / 2, 585, 260, 52, true, 18);
    else if (Math.sin(state.st * 5) > -0.2) th.text(s.tapToContinue, W / 2, 600, 13, th.colors.muted, 'center', 700);
    th.text(s.skip + ' ›', W - 28, 24, 12, th.colors.muted, 'right', 700);

    const p = takeTap();
    if (!p) return;
    if (!p.key && p.x > W - 90 && p.y < 48) { track('cutscene_skip', { atS: Math.round(state.st) }); sfx.tick?.(); go('play'); return; }
    if (last) { if (p.key || inBtn(p, W / 2, 585, 260, 52)) { sfx.ok?.(); go('play'); } return; }
    if (S.st > 0.4) advance();

    function advance() {
      if (S.i < steps.length - 1) { S.i++; S.st = 0; const nx = steps[S.i]; if (nx?.sfx) sfx[nx.sfx]?.(); }
    }
  },
};
