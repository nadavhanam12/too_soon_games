// Public surface for games: `import { createGame, R, ... } from '@tsg/index'`.
export { createGame, type GameDef } from './core/game';
export { R, type Content, type CutStep, type Hooks, type RunResult, type Runtime } from './core/runtime';
export { W, SAFE_H, view, ctx, cv, fullBleed, fillBg, place, drawOn } from './core/canvas';
export { input, takeTap, clearTaps, keyName, keyHeld, keyLeft, keyRight, setPointerIntercept, onKeyDown, type Tap } from './core/input';
export { scenes, S, state, go, goNow, easeO, easeOB, type Scene } from './core/scenes';
export { startFromTitle } from './screens/title';
export * from './draw/prims';
export { haptic, haptics } from './core/haptics';
export { getSeed } from './core/rng';
export { loadLazy } from './core/lazy';
export { assetUrl } from './core/assets';
export { defaultTheme, type Theme, type ThemeColors } from './draw/theme';
export { sfx, music, tone, noise, after, sfxOut, noiseBuffer, type MusicDef, type MusicMode } from './audio/synth';
export { track, type EventName } from './analytics/track';
export { strings, type Strings } from './i18n/strings';
export { userId, getNick, getBest, get as storageGet, set as storageSet } from './storage/storage';   // storageGet / storageSet: a game's own small settings (RULES 12)
export { env, type GameConfig, type Audience, type Lang } from './config';
