// Game-specific sounds added to the template's synth kit (tick/ok/bad/whoosh/win come from the template).
import { sfx, tone, noise, after, type MusicDef } from '@tsg/index';

Object.assign(sfx, {
  hit: () => { noise(0.14, 0.14, 800); tone(130, 0.12, 'sine', 0.12, { slide: 60 }); },
  step: (foot = 1) => { tone(foot === 1 ? 180 : 210, 0.05, 'triangle', 0.08); noise(0.03, 0.05, 1500); },
  halloumi: () => { [660, 880, 990].forEach((f, i) => after(i * 50, () => tone(f, 0.08, 'square', 0.04))); after(40, () => tone(1400, 0.05, 'sine', 0.05, { slide: 1900 })); },
  meow: () => { tone(700, 0.25, 'sawtooth', 0.03, { slide: 500 }); },
  honk: () => { tone(330, 0.25, 'square', 0.05); after(280, () => tone(330, 0.3, 'square', 0.05)); },
  five: () => { noise(0.06, 0.25, 6000); [523, 659, 784, 1047].forEach((f, i) => after(i * 70, () => tone(f, 0.16, 'triangle', 0.09))); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => after(i * 170, () => tone(f, 0.26, 'sawtooth', 0.06))); },
});

/** Sunny major progression for the synth sequencer (C, G, Am, F). */
export const MUSIC: Partial<MusicDef> = { bpm: 132, prog: [[48, [48, 52, 55, 60]], [55, [55, 59, 62, 67]], [57, [57, 60, 64, 69]], [53, [53, 57, 60, 65]]] };
