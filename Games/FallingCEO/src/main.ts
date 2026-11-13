// Drop the Chip: entry point. Wires game.json, content, the hand-drawn theme and the play scene into the template.
import { createGame, W, ctx, txt, type GameConfig, type RunResult } from '@tsg/index';
import cfgJson from '../game.json';
import { content } from './content';
import { theme } from './theme';
import { playScene } from './play';
import { ceo, chip } from './art';
import { hatch, ink, inkRect, marker, markerCirc, sticker, NV, inkCirc, jit, INK } from './kit';
import { fmtTime, easeOB, clamp, lerp } from '@tsg/index';

const cfg = cfgJson as GameConfig;

createGame({
  cfg,
  content,
  theme,
  scenes: { play: playScene },
  font: "'Patrick Hand','Rubik',system-ui,Arial",
  hooks: {
    drawTitleArt(st) {
      const fy = 392 + Math.sin(st * 2) * 14; ceo(W / 2, fy, 'fall', st, 1.5, 0);
      chip(14, 330, 96, ''); chip(250, 352, 96, '');
    },
    drawResultArt(st, r: RunResult) {
      // the boardroom floor, the slumped CEO and the resignation letter (above the stats panel at 386)
      const fy = 372;
      marker(0, fy, W, 14, '#0a0a0a', 1); ink([[0, fy], [W, fy]], 5, NV);
      for (let i = 0; i < 7; i++) { const mx = 22 + i * 52; ink([[mx, fy], [mx + jit(i, 3), fy - 26]], 2.5); markerCirc(mx + jit(i, 3), fy - 30, 6, '#555'); inkCirc(mx + jit(i, 3), fy - 30, 6, 2); }
      ceo(70, fy - 2, 'slump', st, 1.2);
      const lp = easeOB(clamp((st - 0.3) / 0.8, 0, 1)); const ly = lerp(-200, 150, lp);
      ctx.save(); ctx.translate(W / 2 + 40, ly); ctx.rotate(-0.03);
      marker(-96, 6, 200, 170, '#000', 0.6); marker(-100, 0, 200, 170, '#fffdf5', 1); inkRect(-100, 0, 200, 170, 3, '#0b0b0b');
      txt('Letter of Resignation', 0, 22, 17, '#0b0b0b', 'center', 900);
      const secs = Math.floor(r.score);
      const lines = secs < 10 ? ['I did not get to write this.', 'Someone else did.', 'The jacket stays with me.'] : ['I resign as President, CEO and', 'member of the Board, effective', 'immediately. The jacket stays with me.'];
      lines.forEach((l, i) => txt(l, -86, 48 + i * 17, 11, '#0b0b0b', 'left', 400));
      for (let i = 0; i < 2; i++) ink([[-84, 104 + i * 12], [40 - i * 30, 104 + i * 12]], 1.2, '#aaa');
      txt('Sincerely, the CEO (former)', -86, 150, 11, '#0b0b0b', 'left', 700);
      if (st > 1.2) {
        const sp = easeOB(clamp((st - 1.2) / 0.35, 0, 1));
        const stamp = secs < 10 ? 'NO LETTER. JUST OUT.' : secs >= 180 ? 'RESIGNED. $200B EXIT.' : 'RESIGNED';
        ctx.save(); ctx.translate(10, 118); ctx.rotate(-0.18); ctx.scale(lerp(2, 1, sp), lerp(2, 1, sp)); ctx.globalAlpha = Math.min(1, sp + 0.2) * 0.92;
        ctx.font = `900 16px 'Patrick Hand'`; const sw = ctx.measureText(stamp).width + 24;
        inkRect(-sw / 2 - 6, -20, sw + 12, 40, 4, '#c9403a'); inkRect(-sw / 2, -14, sw, 28, 2, '#c9403a'); txt(stamp, 0, 1, 16, '#c9403a', 'center', 900); ctx.restore();
      }
      ctx.restore();
      void hatch; void sticker; void INK; void fmtTime;
    },
    drawCommunityArt() { /* the kit's paper + chart from the theme is enough here */ },
  },
});
