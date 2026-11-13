import { W } from '../core/canvas';
import { takeTap } from '../core/input';
import { go, S, state, type Scene } from '../core/scenes';
import { R } from '../core/runtime';
import { fmtInt, inBtn, txt } from '../draw/prims';
import { track } from '../analytics/track';
import { api, type Board } from '../api/client';
import { getNick, userId } from '../storage/storage';
import { sfx } from '../audio/synth';

/** board: top 20 of this game, your row highlighted, "You: #412" when outside. Never blocks. */
export const boardScene: Scene = {
  enter() {
    S.board = null; S.failed = false; S.tracked = false;
    // a tiny delay so the score POST (fired on the result screen) usually lands first
    setTimeout(() => {
      void api.board(R.cfg.slug, userId(), 20).then((b) => { if (b) S.board = b; else S.failed = true; });
    }, 350);
    setTimeout(() => { if (!S.board) S.failed = true; }, 4500);
  },
  draw() {
    const th = R.theme, c = R.content.board, s = R.strs, st = state.st;
    th.bg(st, 'board');
    R.hooks.drawBoardArt?.(st);
    th.heading(c.heading || s.boardTitle, W / 2, 52, 28);
    if (c.sub) th.text(c.sub, W / 2, 84, 13, th.colors.muted, 'center', 400);
    th.panel(16, 104, W - 32, 420);
    const b = S.board as Board | null;
    if (b) {
      if (!S.tracked) { S.tracked = true; track('board_view', { rank: b.you?.rank ?? 0, total: b.total }); }
      const rows = b.top.slice(0, 10);
      rows.forEach((r, i) => {
        const y = 130 + i * 34;
        const a = Math.min(1, Math.max(0, (st - 0.1 - i * 0.06) * 5));
        if (a <= 0) return;
        const me = r.isYou;
        if (me) { th.panel(24, y - 15, W - 48, 30); }
        txt('#' + r.rank, 38, y, 15, me ? th.colors.accent : th.colors.muted, 'left', 900);
        txt((r.nick || s.anonymous) + (me ? ` (${s.you})` : ''), 80, y, 15, th.colors.ink, 'left', me ? 900 : 700);
        txt(R.content.result.resultWords({ score: r.score, durationS: 0, won: true }), W - 36, y, 15, me ? th.colors.accent : th.colors.ink, 'right', 900);
      });
      if (!rows.length) th.text('—', W / 2, 200, 20, th.colors.muted);
      const you = b.you;
      if (you && !rows.some((r) => r.isYou)) th.text(s.yourRank(fmtInt(you.rank)), W / 2, 486, 15, th.colors.accent, 'center', 900);
      th.text(s.boardTotal(fmtInt(b.total)), W / 2, 508, 12, th.colors.muted, 'center', 400);
    } else if (S.failed) {
      th.text(s.boardUnavailable, W / 2, 300, 15, th.colors.muted, 'center', 700);
    } else {
      th.text(s.loading, W / 2, 300, 15, th.colors.muted, 'center', 700);
    }
    th.button(s.continue, W / 2, 585, 200, 50, true, 17);
    const p = takeTap();
    if (p && st > 0.6 && (p.key || inBtn(p, W / 2, 585, 200, 50))) { sfx.tick?.(); go(R.cfg.screens.facts ? 'facts' : 'community'); }
  },
};
