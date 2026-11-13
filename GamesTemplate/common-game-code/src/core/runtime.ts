// The runtime object R: what a game and the shared screens see. Filled by createGame().
import type { GameConfig } from '../config';
import type { Theme } from '../draw/theme';
import type { Strings } from '../i18n/strings';
import type { Challenge } from '../share/share';

export interface RunResult {
  score: number;        // the one integer the leaderboard sorts by (rule 14)
  durationS: number;    // seconds played this run
  stage?: string;
  won: boolean;
  reason?: string;
}

export interface CutStep {
  dur: number;                                   // seconds before auto-advance (0 = wait for tap)
  text?: string;                                 // caption / speech line
  speaker?: string;
  draw?: (st: number, k: number) => void;        // st = seconds in step, k = 0..1 progress
  sfx?: string;
}

export interface Content {
  title: { heading: string; lines: string[]; credit?: string };
  cutscene?: { steps: CutStep[]; button: string };
  lose: { heading: string; line: string; consolation?: string };
  result: {
    heading: (r: RunResult) => string;     // e.g. the rank title
    sentence: (r: RunResult) => string;    // the result in the game's words
    rankFor: (score: number) => string;
    resultWords: (r: RunResult) => string; // {result} in the share text
  };
  board: { heading: string; sub?: string };
  facts: { heading?: string; sub: string; lines: Array<{ date?: string; text: string; bold?: boolean }>; disclaimer?: string };
  community: { heading: string; sub: string };
}

export interface Hooks {
  drawTitleArt?(st: number): void;
  drawCutsceneBg?(st: number): void;
  drawLoseArt?(st: number, r: RunResult): void;
  drawResultArt?(st: number, r: RunResult): void;
  drawBoardArt?(st: number): void;
  drawFactsArt?(st: number): void;
  drawCommunityArt?(st: number): void;
  onSceneChange?(to: string, from: string): void;
}

export interface Runtime {
  cfg: GameConfig;
  content: Content;
  theme: Theme;
  strs: Strings;
  hooks: Hooks;
  run: RunResult | null;                          // last finished run
  retry: { stage?: string; score: number } | null; // set when the player retries a stage
  challenge: Challenge | null;
  players: number | null;
  best: number;
  playTime: number;                               // seconds in the play scene this run
  lastSubmit: { rank: number; total: number } | null;
  fail(r: Partial<RunResult>): void;              // → lose (or result when the game has no stages)
  win(r: Partial<RunResult>): void;               // → result
  say(text: string, life?: number): void;         // small toast
  banner(title: string, lines: string[]): void;   // stage banner; pauses the game until tapped
  shake(s?: number): void;
  flash(a?: number): void;
  stageStart(stage: string): void;
  stageComplete(stage: string, score: number): void;
}

// Filled in createGame(); typed as Runtime so screens can import it directly.
export const R: Runtime = {} as Runtime;
