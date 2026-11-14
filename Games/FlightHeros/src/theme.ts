// Night-sky theme of "חופשה בטוחה": navy gradient with drifting clouds, amber buttons, red tint on the lose screen.
import { defaultTheme, fillBg, type Theme } from '@tsg/index';
import { clouds } from './art';

const base = defaultTheme({
  bg: '#0f1a2b', bg2: '#1c2c48', ink: '#f6f1e6', muted: '#cfd8e6', accent: '#ffb400', accentInk: '#111',
  panel: 'rgba(15,26,43,.82)', panelLine: 'rgba(255,255,255,.10)', danger: '#ff3b3b', ok: '#3ddc84',
});

export const theme: Theme = {
  ...base,
  bg(t, scene) {
    if (scene === 'lose') { fillBg('#2a0b0b', '#3a1010'); return; }
    if (scene === 'result') { fillBg('#4aa8ff', '#cfe8ff'); return; }
    fillBg('#0f1a2b', '#1c2c48');
    if (scene !== 'play') clouds(t);
  },
};
