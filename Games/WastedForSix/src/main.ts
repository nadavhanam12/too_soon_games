// Wasted for Six: entry point. Wires game.json, content, theme, the six-stage play scene and the art hooks.
import { createGame, R, W, view, ctx, txt, type GameConfig, type RunResult } from '@tsg/index';
import cfgJson from '../game.json';
import { content, CONSOLATION, LOSE_LINES } from './content';
import { theme } from './theme';
import { playScene, G, STAGE_MUSIC } from './play';
import { MUSIC } from './sfx';
import { C, confettiPx, crashArt, guy, titleBand, tvArt } from './art';
import { ptxt } from './pixel';
import { loadWorld } from './drive';
import './legs'; import './scenes';

const cfg = cfgJson as GameConfig;
let ci = 0;

createGame({
  cfg,
  content,
  theme,
  scenes: { play: playScene },
  music: MUSIC,
  // theme opens and closes the story; inside play each stage picks its own track (play.ts STAGE_MUSIC)
  musicFor: (s) => (s === 'play' ? STAGE_MUSIC[G.stage] : s === 'lose' ? 'off' : 'theme'),
  // no screen-change stingers: this game plays only its own sounds (sfx.ts)
  stingerFor: () => null,
  hooks: {
    drawTitleArt(st) {
      ptxt('WASTED', W / 2, 96, 6, C.pink, 'center', '#3a0a2a');
      ptxt('FOR SIX', W / 2, 150, 5, C.yellow, 'center', '#3a2a00');
      titleBand(300, st);
    },
    drawLoseArt(st) { crashArt(70, st); },
    drawResultArt(st, r: RunResult) {
      confettiPx(st, 40, -view.top, view.H);
      // free band between the result sentence (~y 150) and the template's score panel (y 386)
      tvArt(W / 2 - 40, 190, st, 'PLAYING');
      guy(W - 46, 372, 3.5, { arms: 'up' });
      txt(r.reason === 'quit' ? '(unemployed, happy)' : '(on "sick leave")', W / 2 - 40, 174, 11, '#cfc3dd', 'center', 700);
      void ctx;
    },
    onSceneChange(to) {
      if (to === 'lose') {
        content.lose.line = LOSE_LINES[R.run?.reason ?? ''] ?? 'Caught.';
        content.lose.consolation = CONSOLATION[ci++ % CONSOLATION.length];
      }
    },
  },
});
// the 3D city (lazy/world3d.js, ~0.5 MB) starts loading right after the first frame, while the title and cutscene show
requestAnimationFrame(() => requestAnimationFrame(loadWorld));
