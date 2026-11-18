import { W } from '../core/canvas';
import { takeTap } from '../core/input';
import { go, S, state, type Scene } from '../core/scenes';
import { R } from '../core/runtime';
import { fmtInt, inBtn, textWidth, txt } from '../draw/prims';
import { track } from '../analytics/track';
import { api, type Board, type BoardRow } from '../api/client';
import { getNick, userId } from '../storage/storage';
import { sfx } from '../audio/synth';

/**
 * The rows the board shows: always 10. You in the top 10 → the top 10. You below → the top 9, then your row with your
 * rank. Your rank comes from your score post (R.lastSubmit), not from the board request, which only returns the cached
 * top list (one rank count per run on the server, see routes/board.ts). The cached list can be up to 10 s old, so your
 * row is placed by your own rank and score, and an older copy of it in the list is dropped.
 */
export function boardRows(top: BoardRow[], me: { rank: number; best: number } | null, nick: string | null): BoardRow[] {
  if (!me) return top.slice(0, 10);   // the score post failed: the list as it is (isYou marks you when you are in it)
  const others = top.filter((r) => !r.isYou);
  const mine: BoardRow = { rank: me.rank, nick, score: me.best, isYou: true };
  if (me.rank <= 10) {
    const rows = [...others.slice(0, me.rank - 1), mine, ...others.slice(me.rank - 1)].slice(0, 10);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }
  return [...others.slice(0, 9), mine];
}

/** board: 10 rows (top 10, or top 9 + you with your rank). Never blocks. */
export const boardScene: Scene = {
  enter() {
    S.board = null; S.failed = false; S.tracked = false;
    // the rank comes from the score post fired on the result screen: wait for it, then for the list
    void Promise.all([R.submitting ?? Promise.resolve(), api.board(R.cfg.slug, userId(), 10)]).then(([, b]) => {
      if (b) S.board = { ...b, top: boardRows(b.top, R.lastSubmit, getNick() || null), total: R.lastSubmit?.total ?? b.total };
      else S.failed = true;
    });
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
      if (!S.tracked) { S.tracked = true; track('board_view', { rank: b.top.find((r) => r.isYou)?.rank ?? 0, total: b.total }); }
      const rows = b.top.slice(0, 10);
      // a rank below the top 10 can be long (#12,345): the names start after the widest rank
      const nameX = 38 + Math.max(42, ...rows.map((r) => textWidth('#' + fmtInt(r.rank), 15, 900) + 10));
      rows.forEach((r, i) => {
        const y = 130 + i * 34;
        const a = Math.min(1, Math.max(0, (st - 0.1 - i * 0.06) * 5));
        if (a <= 0) return;
        const me = r.isYou;
        if (me) { th.panel(24, y - 15, W - 48, 30); }
        txt('#' + fmtInt(r.rank), 38, y, 15, me ? th.colors.accent : th.colors.muted, 'left', 900);
        txt((r.nick || s.anonymous) + (me ? ` (${s.you})` : ''), nameX, y, 15, th.colors.ink, 'left', me ? 900 : 700);
        txt(R.content.result.resultWords({ score: r.score, durationS: 0, won: true }), W - 36, y, 15, me ? th.colors.accent : th.colors.ink, 'right', 900);
      });
      if (!rows.length) th.text('—', W / 2, 200, 20, th.colors.muted);
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
