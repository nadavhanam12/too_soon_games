// Public surface for games: `import { createGame, R, ... } from '@tsg/index'`.
export { createGame, type GameDef } from './core/game';
export { R, type Content, type CutStep, type Hooks, type RunResult, type Runtime } from './core/runtime';
export { W, SAFE_H, view, ctx, cv, fullBleed, fillBg, place } from './core/canvas';
export { input, takeTap, clearTaps, keyHeld, keyLeft, keyRight, setPointerIntercept, onKeyDown, type Tap } from './core/input';
export { scenes, S, state, go, goNow, easeO, easeOB, type Scene } from './core/scenes';
export * from './draw/prims';
export { defaultTheme, type Theme, type ThemeColors } from './draw/theme';
export { sfx, music, tone, noise, after, type MusicDef } from './audio/synth';
export { track, type EventName } from './analytics/track';
export { strings, type Strings } from './i18n/strings';
export { userId, getNick, getBest } from './storage/storage';
export { env, type GameConfig, type Audience, type Lang } from './config';
