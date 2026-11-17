// Asphalt and warning yellow (2026-11-17): near-black asphalt, yellow accent with dark ink, white text,
// red for danger and WASTED, dollar green for money. C.pink in art.ts is the accent's old name (now yellow).
import { defaultTheme, fillBg, state, txt, type Theme } from '@tsg/index';
import { comicBackdrop, missionCard } from './opening';
import { cardTimeline } from './play';
import { wastedBand } from './endings';

const base = defaultTheme({
  bg: '#0e0e10', bg2: '#1c1c20', ink: '#ffffff', muted: '#b4b4bc', accent: '#ffcc00', accentInk: '#0e0e10',
  panel: 'rgba(14,14,16,.82)', panelLine: 'rgba(255,204,0,.35)', danger: '#d0202a', ok: '#2fbf5b',
});

export const theme: Theme = {
  ...base,
  // the mission card, and above it the story timeline: the card is the one moment before a leg with time to read it
  banner(title, lines, t) { missionCard(title, lines, t); cardTimeline(t); },
  // headings are yellow; on the lose screen WASTED is the red pixel word on its black band (endings.ts)
  heading(s, x, y, size = 30, align = 'center') {
    if (state.scene === 'lose') { wastedBand(s, y, state.st); return; }
    txt(s, x + 2, y + 2, size, 'rgba(0,0,0,.5)', align, 900);
    txt(s, x, y, size, base.colors.accent, align, 900);
  },
  bg(t, scene) {
    if (scene === 'lose') { fillBg('#0c0c0e', '#1c1c20'); return; }
    if (scene === 'title') { fillBg('#0e0e10', '#232327'); return; }
    // everything after a win (result, board, facts, community) sits on the cutscene's halftone backdrop
    if (scene === 'result' || scene === 'board' || scene === 'facts' || scene === 'community') { comicBackdrop(t); return; }
    fillBg('#0e0e10', '#1c1c20');
  },
};
