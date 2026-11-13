import { W } from '../core/canvas';
import { takeTap } from '../core/input';
import { go, state, type Scene } from '../core/scenes';
import { R } from '../core/runtime';
import { inBtn, wrap } from '../draw/prims';
import { track } from '../analytics/track';
import { getNick } from '../storage/storage';
import { followOverlay, shareOverlay } from '../share/overlays';
import { challengeUrl, shareText } from '../share/share';
import { sfx } from '../audio/synth';

/** community: follow block (top), share block (middle), play again (bottom). docs/SHARE.md layout. */
export const communityScene: Scene = {
  enter() {
    const run = R.run || { score: R.best, durationS: 0, won: true };
    const url = challengeUrl(R.cfg, run.score, getNick());
    const text = shareText(R.cfg, { result: R.content.result.resultWords(run), rank: R.content.result.rankFor(run.score), url });
    followOverlay.show(186);
    shareOverlay.show({ text, url }, 348);
  },
  exit() { followOverlay.hide(); shareOverlay.hide(); },
  draw() {
    const th = R.theme, c = R.content.community, s = R.strs, st = state.st;
    th.bg(st, 'community');
    R.hooks.drawCommunityArt?.(st);
    th.heading(c.heading, W / 2, 56, c.heading.length > 16 ? 24 : 30);
    wrap(c.sub, 14, W - 50, 400).forEach((l, i) => th.text(l, W / 2, 90 + i * 19, 14, th.colors.muted, 'center', 400));
    // follow block: text at 140/164, icons overlay at 186..242
    th.panel(16, 120, W - 32, 136);
    th.text(s.followTitle, W / 2, 143, 15, th.colors.ink, 'center', 900);
    th.text(s.followBody, W / 2, 166, 12, th.colors.muted, 'center', 400);
    // share block: text at 300/324, buttons overlay at 348..456
    th.panel(16, 276, W - 32, 194);
    th.text(s.shareTitle, W / 2, 300, 17, th.colors.ink, 'center', 900);
    th.text(s.shareBody, W / 2, 324, 12, th.colors.muted, 'center', 400);
    th.button(s.playAgain, W / 2, 566, 200, 50, false, 16);
    const p = takeTap();
    if (p && st > 0.4 && (p.key || inBtn(p, W / 2, 566, 200, 50))) { track('replay', { fromScreen: 'community' }); sfx.tick?.(); R.retry = null; go('title'); }
  },
};
