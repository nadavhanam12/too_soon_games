// חופשה בטוחה: entry point. Wires game.json, content, theme, the five-stage play scene and the art hooks into the template.
import { createGame, W, ctx, rr, pick, type GameConfig, type RunResult } from '@tsg/index';
import cfgJson from '../game.json';
import { content, LINES } from './content';
import { theme } from './theme';
import { playScene, G } from './play';
import { MUSIC } from './sfx';
import { plane, walker, flag, cheer, person, bubble, suitcase, DAD, MOM, BOY, GIRL } from './art';
import './stages/run'; import './stages/door'; import './stages/cockpit'; import './stages/tie'; import './stages/fly';

const cfg = cfgJson as GameConfig;
let bibi = '';

createGame({
  cfg,
  content,
  theme,
  scenes: { play: playScene },
  music: MUSIC,
  hooks: {
    drawTitleArt(st) {
      plane(W / 2, 82 + Math.sin(st * 2) * 5, 0.78);
      // the family walking home across the bottom, dad last with the suitcase
      const base = 212 + Math.sin(st * 0.7) * 6, y = 392;
      walker(base - 88, y + 8, { ...GIRL, sc: 0.75, walk: true }, st); walker(base - 66, y + 8, { ...BOY, sc: 0.8, walk: true }, st);
      walker(base - 38, y, { ...MOM, sc: 1.2, walk: true }, st); suitcase(base - 22, y - 8, 20, 26, '#222'); walker(base, y, { ...DAD, sc: 1.25, walk: true }, st);
    },
    drawLoseArt(st) {
      ctx.fillStyle = `rgba(255,60,60,${0.15 + Math.sin(st * 6) * 0.08})`; ctx.fillRect(0, -200, W, 1100);
      ctx.save(); ctx.translate(W / 2, 110); ctx.rotate(0.35 + Math.sin(st * 2) * 0.03); plane(0, 0, 0.6); ctx.restore();
    },
    drawResultArt(st, r: RunResult) {
      if (!bibi) bibi = pick(LINES.bibi);
      for (let i = 0; i < 40; i++) { const cx = ((i * 53 + st * 30 * (1 + (i % 3))) % (W + 20)) - 10, cy = ((i * 97 + st * (60 + (i % 5) * 20)) % 400) - 10 + 150; ctx.fillStyle = ['#0038b8', '#fff', '#ffb400'][i % 3]!; ctx.fillRect(cx, cy, 6, 10); }
      for (let i = 0; i < 5; i++) flag(20 + i * 70, 164 + (i % 2) * 10, 44, 30, st * 5 + i);
      const cols = ['#ffffff', '#0038b8', '#ffb400', '#c8102e', '#3ddc84', '#8a2be2'];
      for (let row = 0; row < 2; row++) for (let c = 0; c < 7; c++) { const x = 28 + c * 52 + (row % 2) * 26, y = 372 - row * 40; if (Math.abs(x - W / 2) < 40) continue; cheer(x, y, { sc: 0.9, shirt: cols[(row * 7 + c) % 6], hair: (['#222', '#3a2a1a', '#c9a15a', false] as const)[(c + row) % 4] }, st + row); }
      const lift = Math.abs(Math.sin(st * 6)) * 10;
      ctx.save(); ctx.translate(W / 2, 318 - lift); person(0, 0, { ...DAD, sc: 2 }); ctx.strokeStyle = '#f2c9a0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-24, -6); ctx.lineTo(-46, -46); ctx.moveTo(24, -6); ctx.lineTo(46, -46); ctx.stroke(); ctx.restore();
      cheer(44, 372, { ...MOM, sc: 1.05 }, st); cheer(78, 378, { ...BOY, sc: 0.75 }, st + 1); cheer(102, 380, { ...GIRL, sc: 0.7 }, st + 2);
      ctx.save(); ctx.translate(318, 372); person(0, 0, { sc: 1.15, shirt: '#1b2a44', hair: '#bfbfbf', skin: '#f0c9a8' }); rr(-3, -8, 6, 16, 2, '#c8102e'); ctx.restore();
      bubble('ביבי: ' + bibi, 262, 262, 10, '#fff', '#111', 318, 340, '#1b2a44');
      void r;
    },
    onSceneChange(to) { if (to === 'title') { bibi = ''; G.altUp = null; } },
  },
});
