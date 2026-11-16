// Sunny-seafront theme: navy ink panels on a sky gradient, sun-orange buttons; dusk red on the lose screen.
import { defaultTheme, fillBg, type Theme } from '@tsg/index';
import { sun } from './art';

const base = defaultTheme({
  bg: '#0b2545', bg2: '#13406e', ink: '#ffffff', muted: '#cfe3f5', accent: '#ff8a00', accentInk: '#ffffff',
  panel: 'rgba(11,37,69,.78)', panelLine: 'rgba(255,255,255,.14)', danger: '#ff3b3b', ok: '#3ddc84',
});

export const theme: Theme = {
  ...base,
  bg(t, scene) {
    if (scene === 'lose') { fillBg('#3a1414', '#7a3a1a'); return; }
    if (scene === 'result') { fillBg('#1f7fbf', '#8fd3f4'); return; }
    fillBg('#0b2545', '#13406e');
    if (scene === 'title') sun(300, 40, 26, t);
  },
};
