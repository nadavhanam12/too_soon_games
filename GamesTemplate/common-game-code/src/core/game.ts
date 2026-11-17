// createGame(): wires config, theme, content, scenes, overlays, analytics and the main loop.
import { ctx, fit, initCanvas, view, W, SAFE_H } from './canvas';
import { initInput, input, takeTap } from './input';
import { drawTransition, easeOB, go, goNow, inTransition, onSceneChange, S, scenes, state, stepTransition, type Scene } from './scenes';
import { getSeed, setSeed } from './rng';
import { R, type Content, type Hooks, type RunResult } from './runtime';
import { env, validateConfig, type GameConfig } from '../config';
import { defaultTheme, type Theme } from '../draw/theme';
import { clamp, rnd, setDirection, setFont, txt, wrap } from '../draw/prims';
import { strings } from '../i18n/strings';
import { initAnalytics, setScreen, track } from '../analytics/track';
import { api } from '../api/client';
import { getBest, userId } from '../storage/storage';
import { parseChallenge } from '../share/share';
import { PRESETS } from '../share/presets';
import { hideAllOverlays, initOverlays } from '../share/overlays';
import { music, sfx, unlockAudio, type MusicDef, type MusicMode } from '../audio/synth';
import { sharedScenes } from '../screens/index';
import { onKeyDown } from './input';

export interface GameDef {
  cfg: GameConfig;
  content: Content;
  theme?: Theme;
  scenes: Record<string, Scene>;        // must include `play`; may override shared screens
  hooks?: Hooks;
  music?: Partial<MusicDef> | false;
  musicFor?: (scene: string) => MusicMode;
  stingerFor?: (scene: string) => string | null;
  font?: string;                        // canvas font family stack
  /** Called after everything is initialised, before the first frame. */
  onReady?: () => void;
}

interface Toast { s: string; life: number; t: number }
interface Banner { title: string; lines: string[]; t: number }
let toast: Toast | null = null;
let banner: Banner | null = null;

export function createGame(def: GameDef): void {
  const cfg = def.cfg;
  const errs = validateConfig(cfg);
  if (errs.length) { console.error('game.json invalid:', errs); if (env.dev) alert('game.json invalid:\n' + errs.join('\n')); }

  const theme = def.theme || defaultTheme();
  Object.assign(R, {
    cfg, content: def.content, theme, strs: strings(cfg.lang), hooks: def.hooks || {},
    run: null, retry: null, challenge: null, players: null, best: getBest(cfg.slug), playTime: 0, lastSubmit: null,
    fail: (r: Partial<RunResult>) => finish({ won: false, ...r }),
    win: (r: Partial<RunResult>) => finish({ won: true, ...r }),
    toastY: 70,
    say: (s: string, life = 1.6) => { toast = { s, life, t: 0 }; },
    banner: (title: string, lines: string[]) => { banner = { title, lines, t: 0 }; },
    shake: (s = 0.3) => { state.shake = Math.max(state.shake, s); },
    flash: (a = 0.4) => { state.flash = Math.max(state.flash, a); },
    hitStop: (s = 0.06) => { freeze = Math.max(freeze, s); },
    stageStart: (stage: string) => track('stage_start', { stage }),
    stageComplete: (stage: string, score: number) => track('stage_complete', { stage, timeS: Math.round(R.playTime), score }),
  } satisfies Partial<typeof R>);

  // DOM + canvas
  document.documentElement.lang = cfg.lang;
  document.documentElement.dir = cfg.lang === 'he' ? 'rtl' : 'ltr';
  setDirection(cfg.lang === 'he' ? 'rtl' : 'ltr');
  if (def.font) setFont(def.font);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  initCanvas(canvas);
  initInput();
  initOverlays({ strings: R.strs, preset: PRESETS[cfg.audience], lang: cfg.lang, title: cfg.title });
  unlockAudio();
  if (def.music !== false) { if (def.music) music.configure(def.music); }

  // scenes
  Object.assign(scenes, sharedScenes, def.scenes);
  if (!scenes.play) throw new Error('GameDef.scenes.play is required');

  // analytics + challenge + player count
  initAnalytics({ slug: cfg.slug, version: cfg.version, lang: cfg.lang });
  R.challenge = parseChallenge();
  if (R.challenge) track('referral_start', { fromUser: R.challenge.from, theirScore: R.challenge.score });
  void api.count(cfg.slug).then((r) => { if (r) R.players = r.playsPublic ?? r.plays ?? r.players; }); // games played, public number (decision 51)

  const musicFor = def.musicFor || ((s: string): MusicMode => (s === 'play' ? 'play' : s === 'lose' || s === 'result' ? 'off' : 'calm'));
  const stingerFor = def.stingerFor || ((s: string) => (s === 'title' ? 'logo' : s === 'play' ? 'riser' : s === 'lose' ? 'sad' : 'whoosh'));
  onSceneChange((to, from) => {
    hideAllOverlays(); toast = null; banner = null;
    if (to === 'play') R.playTime = 0;
    setScreen(to);
    if (def.music !== false && (cfg.music ?? true)) music.set(musicFor(to));
    const st = stingerFor(to); if (st) sfx[st]?.();
    R.hooks.onSceneChange?.(to, from);
  });
  onKeyDown((e) => { if (e.key === 'm' || e.key === 'M') { const on = music.toggle(); R.say(on ? R.strs.unmuted : R.strs.muted, 1); return true; } return false; });

  // debug hooks (docs/CONTRACTS.md)
  const w = window as unknown as Record<string, unknown>;
  const fakeRun = (): RunResult => ({ score: Math.min(42, cfg.score.max), durationS: 42, won: true, stage: '1' });
  w.__go = (s: string) => { if (!R.run && s !== 'play' && s !== 'cutscene' && s !== 'title') R.run = fakeRun(); goNow(s); };
  w.__advance = (sec: number) => { stepping = true; const n = Math.round(sec * 60); for (let i = 0; i < n; i++) frame(last + 1000 / 60); stepping = false; };
  // manual clock: the real requestAnimationFrame loop stops moving the game, only __advance does (the playthrough
  // needs this, or real frames between two __advance calls would make a seeded run differ from the next one)
  w.__manual = (on: boolean) => { manual = on; };
  // __seed(n) restarts the stream: the frames drawn before the clock went manual have already used some of it
  w.__seed = (n?: number) => { if (n) setSeed(n); return getSeed(); };
  w.__state = () => ({ scene: state.scene, st: state.st, playTime: R.playTime, run: R.run, best: R.best, players: R.players, H: view.H, top: view.top, scale: view.scale, banner: !!banner, inTransition: inTransition(), S: { ...S } });
  w.__scenes = () => Object.keys(scenes);
  w.__fit = fit;
  w.__music = () => ({ mode: music.mode, on: music.on, files: Object.fromEntries(Object.entries(music.tracks).map(([k, a]) => [k, { paused: a!.paused, volume: +a!.volume.toFixed(2), missing: !!a!.dataset.missing }])) });

  def.onReady?.();
  const hash = location.hash.slice(1);
  if (hash && scenes[hash] && hash !== 'title') {
    if (hash !== 'play' && hash !== 'cutscene' && !R.run) R.run = fakeRun();
    goNow(hash);
  } else goNow('title');
  requestAnimationFrame(frame);

  const SCREEN_IN_S = 0.32;
  // ---------- main loop ----------
  let last = performance.now();
  let stepping = false;
  let manual = false;
  let freeze = 0; // hit-stop seconds left: the scene draws with dt = 0, toasts/shake/flash keep running on rawDt
  function frame(now: number): void {
    if (manual && !stepping) { last = now; requestAnimationFrame(frame); return; }
    // under __advance the step is exactly 1/60: (now - last) would carry float rounding that depends on the wall clock
    const rawDt = stepping ? 1 / 60 : clamp((now - last) / 1000, 0, 0.05); last = now;
    state.t += rawDt; state.st += rawDt;
    stepTransition(rawDt);
    const paused = !!banner;
    const frozen = freeze > 0; freeze = Math.max(0, freeze - rawDt);
    const dt = paused || frozen ? 0 : rawDt;
    if (state.scene === 'play' && !paused) R.playTime += dt;
    ctx.save();
    ctx.translate(0, view.top);
    if (state.shake > 0) { state.shake -= rawDt; ctx.translate(rnd(-5, 5), rnd(-5, 5)); }
    const sc = scenes[state.scene];
    // screen entry (rule 13יב, 250–400 ms): every template screen rises into place with a little overshoot. The play
    // scene is left alone: games animate their own stage entries.
    const enterK = state.scene === 'play' ? 1 : Math.min(1, state.st / SCREEN_IN_S);
    if (enterK < 1) { theme.bg(state.st, state.scene); ctx.translate(0, (1 - easeOB(enterK)) * 36); }
    if (sc) sc.draw(dt); else theme.bg(state.st, state.scene);
    if (enterK < 1) ctx.translate(0, -(1 - easeOB(enterK)) * 36);
    drawToast(rawDt);
    drawBanner(rawDt);
    ctx.restore();
    ctx.save(); ctx.translate(0, view.top); drawTransition(theme.colors.bg); ctx.restore();
    if (state.flash > 0) { state.flash -= rawDt * 2; ctx.fillStyle = `rgba(255,255,255,${Math.max(0, state.flash)})`; ctx.fillRect(0, 0, W, view.H); }
    if (!stepping) requestAnimationFrame(frame);
  }

  function drawToast(rawDt: number): void {
    if (!toast) return;
    toast.t += rawDt;
    const a = Math.min(1, (toast.life - toast.t) * 2, toast.t * 6);
    if (a <= 0) { toast = null; return; }
    ctx.globalAlpha = a;
    const lines = wrap(toast.s, 13, W - 60, 900);
    const hgt = lines.length * 17 + 14;
    theme.panel(30, R.toastY - hgt / 2, W - 60, hgt);
    lines.forEach((l, i) => txt(l, W / 2, R.toastY - hgt / 2 + 14 + i * 17, 13, theme.colors.ink, 'center', 900));
    ctx.globalAlpha = 1;
  }

  function drawBanner(rawDt: number): void {
    if (!banner) return;
    banner.t += rawDt;
    const k = Math.min(1, banner.t * 4);
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, -200, W, SAFE_H + 400);
    if (theme.banner) { ctx.globalAlpha = 1; theme.banner(banner.title, banner.lines, banner.t); } // the game's own card
    else {
      // the card pops in (scale with overshoot around its centre)
      const pop = 0.8 + 0.2 * easeOB(k);
      ctx.save(); ctx.translate(W / 2, 320); ctx.scale(pop, pop); ctx.translate(-W / 2, -320);
      const lines = banner.lines.flatMap((l) => wrap(l, 14, W - 90, 400));
      const h = 70 + lines.length * 20 + 50;
      const y0 = 320 - h / 2;
      theme.panel(22, y0, W - 44, h);
      theme.heading(banner.title, W / 2, y0 + 36, 24);
      lines.forEach((l, i) => txt(l, W / 2, y0 + 72 + i * 20, 14, theme.colors.ink, 'center', 400));
      if (Math.sin(state.t * 5) > -0.2) txt(R.strs.tapToContinue, W / 2, y0 + h - 22, 13, theme.colors.muted, 'center', 700);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const p = takeTap();
    if (p && banner.t > 0.5) { banner = null; input.taps.length = 0; }
  }

  function finish(r: Partial<RunResult> & { won: boolean }): void {
    const run: RunResult = { score: Math.max(0, Math.round(r.score ?? 0)), durationS: r.durationS ?? R.playTime, stage: r.stage, won: r.won, reason: r.reason };
    R.run = run;
    if (run.won) {
      track('game_complete', { timeS: Math.round(run.durationS), score: run.score, rank: R.content.result.rankFor(run.score) });
      go('result');
    } else {
      track('game_over', { stage: run.stage, timeS: Math.round(run.durationS), score: run.score, reason: run.reason });
      go(run.stage && cfg.screens.lose !== false ? 'lose' : 'result');
    }
  }
}
