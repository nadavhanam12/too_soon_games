// Every player-facing text of the game (rule 10). Humor is edited here, not in the code.
import { type Content, type RunResult, fmtTime, W, ctx, txt } from '@tsg/index';
import { ceo, woman } from './art';
import { ink, inkRect, marker, markerCirc, NV, sticker, card } from './kit';

const RANKS: Array<[number, string]> = [
  [240, 'Outlasted the real thing. Nobody believes it.'], [180, 'Still CEO after the downgrade'], [120, 'The investigation found nothing. You fell anyway.'],
  [75, 'The second headline got you'], [45, 'Still CEO after the apology letter'], [20, 'Resigned in pre-market'], [-1, 'Did not even write the letter'],
];
export const rankFor = (s: number): string => RANKS.find((r) => s >= r[0])![1];
const secs = (r: RunResult): number => Math.floor(r.score);

export const content: Content = {
  title: {
    heading: 'DROP THE CHIP',
    lines: ['A parody inspired by news reports.', 'Two affairs, one jacket, zero job by Thursday.'],
    credit: 'Too Soon Games',
  },
  cutscene: {
    button: 'FALL',
    steps: [
      { dur: 0, text: 'Friday morning. The CEO of a chip giant admits an affair. She is, allegedly, a spy. The stock starts to fall.', speaker: 'Day 1',
        draw: (st) => { panel(st); ink([[W - 180, 230], [W - 140, 242], [W - 100, 238], [W - 40, 286]], 4, '#c9403a'); ceo(90, 290, 'fall', st, 1.1, 1); woman(160, 296, 'agent', st); sticker('📉', W - 60, 300, 18, '#f0a0a0'); } },
      { dur: 0, text: 'Wednesday: a second affair. This time with a VP inside the company. The board opens an investigation. The press waits below.', speaker: 'Day 4',
        draw: (st) => { panel(st); ceo(100, 290, 'fall', st, 1.1, 2); woman(250, 296, 'vp', st); const bz = Math.sin(st * 30) * 2; ctx.save(); ctx.translate(292 + bz, 232); marker(-24, -10, 48, 20, '#fff8e0', 1); inkRect(-24, -10, 48, 20, 2, '#0b0b0b'); txt('call me', 0, 1, 10, '#0b0b0b'); ctx.restore(); } },
      { dur: 0, text: 'Thursday: the board meets. The floor is rising toward you. Hold a side to move, tap JUMP for an extra hop. How long can you stay a CEO?', speaker: 'Day 5',
        draw: (st) => { panel(st); ink([[30, 300], [W - 30, 300]], 4, NV); for (let k = 0; k < 4; k++) { ink([[80 + k * 60, 300], [80 + k * 60, 276]], 2.5); markerCirc(80 + k * 60, 271, 6, '#555'); } ceo(200, 240 + Math.sin(st * 3) * 6, 'fall', st, 1, 2); sticker('NOV 12', W - 70, 250, 11, '#f0a0a0', 0.05); } },
    ],
  },
  lose: { heading: 'GAME OVER', line: 'The career ends here.', consolation: 'In real life: 5 days.' },
  result: {
    heading: (r) => rankFor(secs(r)),
    sentence: (r) => `You lasted ${fmtTime(secs(r))} before resigning. In real life: 5 days.`,
    rankFor,
    resultWords: (r) => fmtTime(secs(r)),
  },
  board: { heading: 'Longest-serving CEOs', sub: 'Time in office before the board noticed' },
  facts: {
    heading: 'What actually happened',
    sub: 'Nvidia, November 8–12, 2026',
    lines: [
      { date: 'Nov 8', text: 'CEO Jensen Huang sent a letter to employees admitting an affair. Reports say the woman is suspected, allegedly, of being a Chinese intelligence agent. Beijing denied it.' },
      { date: 'Nov 9', text: 'The stock fell about 5%, roughly $190 billion in one day.' },
      { date: 'Nov 10', text: 'The independent directors opened an investigation led by an outside lawyer.' },
      { date: 'Nov 11', text: 'The NYT reported a second affair with a company executive. The WSJ: the board was preparing to oust him.' },
      { date: 'Nov 12', text: 'Huang resigned as President, CEO and board member, effective immediately. CFO Colette Kress became interim CEO.', bold: true },
    ],
    disclaimer: 'The spy allegation is unverified. Sources: Nvidia newsroom, Washington Post, Yahoo Finance.',
  },
  community: { heading: 'The fall does not end here', sub: 'Challenge a friend, and be first in line for the next game.' },
};

function panel(st: number): void { card(20, 150, W - 40, 170); void st; }
