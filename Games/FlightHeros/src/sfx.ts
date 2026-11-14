// Game-specific sounds added to the template's synth kit (sfx.tick/ok/bad/whoosh/win come from the template).
import { sfx, tone, noise, after, type MusicDef } from '@tsg/index';

Object.assign(sfx, {
  // body bump into a passenger / suitcase: soft low thud
  hit: () => { noise(0.16, 0.16, 700); tone(120, 0.14, 'sine', 0.12, { slide: 55 }); },
  // fist landing: thud + bony crack
  punch: () => { noise(0.1, 0.2, 2200); tone(95, 0.12, 'triangle', 0.16, { slide: 40 }); after(10, () => noise(0.03, 0.1, 8000)); },
  // knife swish + stab impact
  stab: () => { noise(0.14, 0.12, 7000); after(60, () => { tone(160, 0.12, 'sine', 0.12, { slide: 60 }); noise(0.08, 0.1, 500); }); },
  // door lock ring: metallic click
  click: () => { tone(2300, 0.05, 'square', 0.045); tone(3450, 0.04, 'sine', 0.02); noise(0.04, 0.1, 9000); },
  // turbulence: long low rumble
  rumble: () => { noise(1.1, 0.16, 220); tone(45, 0.9, 'sine', 0.1); },
  lose: () => { [400, 300, 200, 120].forEach((f, i) => after(i * 160, () => tone(f, 0.28, 'sawtooth', 0.07))); noise(0.9, 0.1, 180); },
});

/** Tense minor progression for the synth sequencer (Am, F, Dm, E). */
export const MUSIC: Partial<MusicDef> = { bpm: 118, prog: [[57, [57, 60, 64]], [53, [53, 57, 60]], [50, [50, 53, 57]], [52, [52, 56, 59]]] };
