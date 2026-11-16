// Asphalt-and-sunset theme: dark asphalt panels, 80s sunset pink buttons; sunset sky on title/result, gray on lose.
import { defaultTheme, fillBg, type Theme } from '@tsg/index';

const base = defaultTheme({
  bg: '#1b1b1b', bg2: '#2a1838', ink: '#f2f2f2', muted: '#bfb3cc', accent: '#ff3fa4', accentInk: '#ffffff',
  panel: 'rgba(12,8,20,.82)', panelLine: 'rgba(255,63,164,.35)', danger: '#ff4b4b', ok: '#5ce67a',
});

export const theme: Theme = {
  ...base,
  bg(t, scene) {
    if (scene === 'lose') { fillBg('#101010', '#2a2a2a'); return; }
    if (scene === 'title' || scene === 'result') { fillBg('#1b0f33', '#4a1650'); return; }
    fillBg('#1b1b1b', '#2a1838');
    void t;
  },
};
