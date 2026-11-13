import type { Scene } from '../core/scenes';
import { titleScene } from './title';
import { cutsceneScene } from './cutscene';
import { loseScene } from './lose';
import { resultScene } from './result';
import { boardScene } from './board';
import { factsScene } from './facts';
import { communityScene } from './community';

/** The shared screens, in flow order. A game may override any by registering a scene with the same name. */
export const sharedScenes: Record<string, Scene> = {
  title: titleScene,
  cutscene: cutsceneScene,
  lose: loseScene,
  result: resultScene,
  board: boardScene,
  facts: factsScene,
  community: communityScene,
};
