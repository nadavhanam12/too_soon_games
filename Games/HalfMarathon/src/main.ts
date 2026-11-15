// Half a Marathon, Whole Halloumi: entry point. Wires game.json, content, theme, the five-stage play scene and art hooks.
import { createGame, W, ctx, rr, txt, type GameConfig, type RunResult } from '@tsg/index';
import cfgJson from '../game.json';
import { content, CONSOLATION } from './content';
import { theme } from './theme';
import { playScene } from './play';
import { MUSIC } from './sfx';
import { C, arch, baby, bus, cat, confetti, halloumiMedal, person, runnerSide, wife } from './art';
import './stages/start'; import './stages/water'; import './stages/sun'; import './stages/wall'; import './stages/finish';

const cfg = cfgJson as GameConfig;
let ci = 0;

createGame({
  cfg,
  content,
  theme,
  scenes: { play: playScene },
  music: MUSIC,
  musicFor: (s) => (s === 'play' ? 'play' : s === 'result' ? 'win' : s === 'lose' ? 'off' : 'calm'),
  hooks: {
    drawTitleArt(st) {
      theme.heading('Half a Marathon,', W / 2, 112, 34);
      theme.heading('Whole Halloumi', W / 2, 156, 38);
      // band under the intro lines: road, the runner, a cat, the arch on the right
      rr(0, 318, W, 84, 0, C.road);
      for (let i = 0; i < 6; i++) rr(((i * 80 - st * 120) % 480 + 480) % 480 - 60, 360, 40, 4, 1, C.road2);
      arch(300, 400, 0.6);
      runnerSide(130 + Math.sin(st * 0.8) * 20, 380, 1.3, st, 1);
      cat(50, 394, 1, st);
    },
    drawLoseArt(st) {
      rr(0, 90, W, 70, 0, C.road);
      bus(W / 2 + Math.sin(st) * 6, 150, 1.1, st);
    },
    drawResultArt(st, r: RunResult) {
      confetti(st, 40, 150, 230);
      rr(0, 330, W, 50, 0, C.road);
      arch(W / 2, 372, 0.9);
      runnerSide(W / 2 - 10, 356, 1.3, st, 0.4);
      halloumiMedal(W / 2 - 6, 330 + Math.sin(st * 3) * 1.5, 1.2);
      // the kudos card
      rr(W - 116, 168, 100, 40, 10, '#ffffff'); txt('KUDOS: 1', W - 66, 182, 12, '#fc4c02', 'center', 900); txt('(from Mom)', W - 66, 198, 10, '#0b2545', 'center', 700);
      const five = r.reason === 'highfive';
      wife(64, 356, 1.2, st, five ? 'PROUD!!!' : 'zzz…');
      baby(60, 360 - (five ? 14 : 0), 1.3, st, five);
      for (let i = 0; i < 4; i++) person(250 + i * 28, 360, { sc: 0.9, shirt: ['#c8102e', '#ffffff', '#2f6fdd', '#1aa36b'][i], hair: C.blonde, sunburn: true });
      void ctx;
    },
    onSceneChange(to) { if (to === 'lose') { content.lose.consolation = CONSOLATION[ci++ % CONSOLATION.length]; } },
  },
});
