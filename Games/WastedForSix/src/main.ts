// TSG: Nice City (GameId WastedForSix): entry point. Wires game.json, content, theme, the seven-stage play scene and the art hooks.
import { createGame, R, type GameConfig } from '@tsg/index';
import cfgJson from '../game.json';
import { content, CONSOLATION, LOSE_LINES } from './content';
import { theme } from './theme';
import { playScene, G, stageTrack } from './play';
import { MUSIC } from './sfx';
import { comicBackdrop, loadCutArt, loadTitleArt, titleScene } from './opening';
import { montagePicture } from './montage';
import { loseArt, resultArt } from './endings';
import { loadWorld } from './drive';
import { loadPortraits } from './portraits';
import './legs'; import './scenes';

const cfg = cfgJson as GameConfig;
let ci = 0;

createGame({
  cfg,
  content,
  theme,
  scenes: { play: playScene, title: titleScene },
  maxWidth: 1138,   // 16:9 at the safe height: tablets and ordinary monitors are filled, an ultra-wide one stops at 16:9
  music: MUSIC,
  // theme opens and closes the story; inside play each stage starts a song not heard yet (play.ts nextSong)
  musicFor: (s) => (s === 'play' ? stageTrack() : s === 'lose' ? 'off' : 'theme'),
  // no screen-change stingers: this game plays only its own sounds (sfx.ts)
  stingerFor: () => null,
  hooks: {
    drawCutsceneBg(st) { comicBackdrop(st); },
    // both end screens are drawn in endings.ts (the template adds its texts, score and buttons on top)
    drawLoseArt(st, r) { loseArt(st, r.reason ?? ''); },
    drawResultArt(st) { resultArt(st); },
    onSceneChange(to) {
      if (to === 'lose') {
        content.lose.line = LOSE_LINES[R.run?.reason ?? ''] ?? 'Caught.';
        content.lose.consolation = CONSOLATION[ci++ % CONSOLATION.length];
      }
    },
  },
});
// The preview card's picture: the full montage as a PNG data URL (null until its paintings are in). Read by
// GamesTemplate/other-services/assets/make-assets.mjs, which puts it on og.png in place of the title screen.
(window as unknown as Record<string, unknown>).__ogPic = () => { loadPortraits(); loadCutArt(); return montagePicture(['boss', 'clerk', 'fiancee'])?.toDataURL('image/png') ?? null; };
// ?screen=community (or result / lose / board / facts) opens that screen with the full montage, to check the end
// screens and the share without a run (also on the live site: it does nothing the debug hooks do not). Waits for the
// paintings.
// ?stage=launch (any stage name; optional &branch=sick|quit, &store=loan|steal|ring) starts a run at that stage, to test
// one part without playing up to it. Default branch: quit. Like ?screen, it does nothing the debug hooks do not.
const query = new URLSearchParams(location.search), startStage = query.get('stage');
if (startStage) {
  const w = window as unknown as { __go: (s: string) => void; __stage: (name: string, branch?: string, store?: string) => void };
  G.met = ['boss'];
  w.__go('play'); w.__stage(startStage, query.get('branch') ?? 'quit', query.get('store') ?? undefined);
}
const screen = query.get('screen');
if (screen) {
  G.met = ['boss', 'clerk', 'fiancee']; loadPortraits(); loadCutArt();
  const go = window.setInterval(() => { if (montagePicture(G.met)) { window.clearInterval(go); (window as unknown as { __go: (s: string) => void }).__go(screen); } }, 100);
}
loadTitleArt(); // the title painting is the first screen: requested now, drawn when it arrives
// the cutscene panels and the 3D city (lazy/world3d.js, ~0.5 MB) start loading right after the first frame
requestAnimationFrame(() => requestAnimationFrame(() => { loadCutArt(); loadWorld(); }));
