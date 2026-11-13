import { W } from '../core/canvas';
import { takeTap } from '../core/input';
import { go, S, state, type Scene } from '../core/scenes';
import { R } from '../core/runtime';
import { fmtTime, inBtn, wrap } from '../draw/prims';
import { track } from '../analytics/track';
import { api } from '../api/client';
import { getNick, setBest, setNick, userId } from '../storage/storage';
import { nickOverlay } from '../share/overlays';
import { sfx } from '../audio/synth';

function nextAfterResult(): string {
  if (R.cfg.screens.board) return 'board';
  if (R.cfg.screens.facts) return 'facts';
  return 'community';
}

/** result: rank title, the result sentence, score/time, nickname field + save/skip (decision 8). */
export const resultScene: Scene = {
  enter() {
    const run = R.run!;
    S.newBest = run.score > R.best;
    if (S.newBest) { R.best = run.score; setBest(R.cfg.slug, run.score); }
    S.submitted = false;
    R.lastSubmit = null;
    nickOverlay.show(492, getNick(), (nick) => submit(nick));
  },
  exit() { nickOverlay.hide(); },
  draw() {
    const th = R.theme, c = R.content.result, s = R.strs, st = state.st, run = R.run!;
    th.bg(st, 'result');
    R.hooks.drawResultArt?.(st, run);
    th.heading(c.heading(run), W / 2, 72, c.heading(run).length > 18 ? 24 : 34);
    let y = 118;
    for (const l of wrap(c.sentence(run), 15, W - 60, 700)) { th.text(l, W / 2, y, 15, th.colors.ink, 'center', 700); y += 21; }
    th.panel(24, 386, W - 48, 86);
    th.text(`${s.score}`, W / 2 + 80, 410, 12, th.colors.muted, 'center', 700);
    th.text(c.resultWords(run), W / 2 + 80, 440, 22, th.colors.accent, 'center', 900);
    th.text(`${s.time}`, W / 2 - 80, 410, 12, th.colors.muted, 'center', 700);
    th.text(fmtTime(run.durationS), W / 2 - 80, 440, 22, th.colors.ink, 'center', 900);
    if (S.newBest) th.chip(s.newBest, W / 2, 380, th.colors.accent, th.colors.accentInk, 12);
    if (S.submitted) { th.text(s.loading, W / 2, 560, 13, th.colors.muted, 'center', 700); }
    // the nick overlay (input, save, skip) sits at 492..608; a keyboard Enter is handled by the input itself
    const p = takeTap();
    if (p && p.key && st > 0.8 && !S.submitted) submit(nickOverlay.value() || null);
    void inBtn;
  },
};

function submit(nick: string | null): void {
  if (S.submitted) return;
  S.submitted = true;
  const run = R.run!;
  if (nick) { setNick(nick); track('nick_submit'); } else track('nick_skip');
  nickOverlay.hide();
  sfx.ok?.();
  void api.score(R.cfg.slug, { userId: userId(), nick, score: run.score, durationS: Math.round(run.durationS), stage: run.stage, version: R.cfg.version })
    .then((r) => { if (r) R.lastSubmit = { rank: r.rank, total: r.total }; });
  go(nextAfterResult());
}
