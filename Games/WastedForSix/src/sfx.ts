// Game-specific sounds added to the template's synth kit (tick/ok/bad/whoosh/win come from the template).
import { sfx, tone, noise, after, type MusicDef } from '@tsg/index';

Object.assign(sfx, {
  crash: () => { noise(0.18, 0.16, 900); tone(110, 0.14, 'square', 0.06, { slide: 50 }); },
  coin: () => { tone(988, 0.05, 'square', 0.04); after(55, () => tone(1319, 0.09, 'square', 0.04)); },
  letter: () => { noise(0.25, 0.05, 5000); [784, 988, 1175].forEach((f, i) => after(i * 60, () => tone(f, 0.08, 'triangle', 0.06))); },
  siren: () => { tone(880, 0.18, 'sawtooth', 0.018, { slide: 660 }); },
  pump: () => { noise(0.5, 0.06, 600); after(500, () => tone(660, 0.08, 'square', 0.04)); },
  cough: () => { noise(0.09, 0.12, 1400); after(140, () => noise(0.12, 0.12, 1100)); },
  key: () => { tone(1500, 0.02, 'square', 0.03); },
  wasted: () => { [330, 262, 196, 131].forEach((f, i) => after(i * 190, () => tone(f, 0.32, 'sawtooth', 0.06))); },
  lose: () => { [330, 262, 196, 131].forEach((f, i) => after(i * 190, () => tone(f, 0.32, 'sawtooth', 0.06))); },
});

/** Minor 80s synthwave progression for the sequencer (Am, F, C, G). */
export const MUSIC: Partial<MusicDef> = { bpm: 118, prog: [[45, [57, 60, 64, 69]], [41, [53, 57, 60, 65]], [48, [48, 52, 55, 60]], [43, [55, 59, 62, 67]]] };
