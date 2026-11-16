// Put chosen candidates into the game and record where each came from.
// Usage (from the repo root):
//   node GamesTemplate/other-services/skills/make-music/ship.mjs <GameId> <run>/<track>-<n>=<name> [...] [--prune]
//   e.g. WastedForSix styles-v2/D-lowrider-2=theme styles-v2/A-gfunk-1=drive
// Copies runs/<run>/game/<track>-<n>.mp3 → Games/<GameId>/assets/audio/<name>.mp3 and merges the entry into
// Games/<GameId>/music/chosen.json (name → run, candidate, prompt, seed, bpm, key). Fails if the audio budget
// (1.5 MB, rule 13א, the bugcheck limit) would be exceeded.
// --prune deletes every candidate (raw WAV + game MP3) that chosen.json does not reference, in every run, and marks it
// "pruned" in that run's prompts.json (the prompt and seed stay, so it can be regenerated). This cannot be undone.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const args = process.argv.slice(2);
const gameId = args.shift();
const prune = args.includes('--prune');
const picks = args.filter((a) => a !== '--prune');
if (!gameId || (!picks.length && !prune)) throw new Error('usage: node ship.mjs <GameId> <run>/<track>-<n>=<name> [...] [--prune]');
const GAME = join(ROOT, 'Games', gameId);
const MUSIC = join(GAME, 'music');
const AUDIO = join(GAME, 'assets', 'audio');
const chosenPath = join(MUSIC, 'chosen.json');
const chosen = existsSync(chosenPath) ? JSON.parse(readFileSync(chosenPath, 'utf8')) : {};
const readLog = (run) => JSON.parse(readFileSync(join(MUSIC, 'runs', run, 'prompts.json'), 'utf8'));

for (const p of picks) {
  const m = /^([^/]+)\/(.+)-(\d+)=([a-z][a-z0-9-]*)$/.exec(p);
  if (!m) throw new Error(`bad pick "${p}" (expected <run>/<track>-<n>=<name>)`);
  const [, run, track, n, name] = m;
  const t = readLog(run)[track];
  const r = t?.results.find((x) => x.n === +n);
  if (!r || r.pruned) throw new Error(`${run}/${track}-${n}: no such candidate (or pruned)`);
  const src = join(MUSIC, 'runs', run, 'game', `${track}-${n}.mp3`);
  if (!existsSync(src)) throw new Error(`${src} missing: run loopify.py ${gameId} ${run} first`);
  mkdirSync(AUDIO, { recursive: true });
  copyFileSync(src, join(AUDIO, `${name}.mp3`));
  // the server reports one seed per batch item ("s1,s2,s3"); keep the one of this candidate
  chosen[name] = { run, candidate: `${track}-${n}`, label: t.label, prompt: t.prompt, seed: String(r.seed).split(',')[+n - 1], bpm: r.metas?.bpm ?? t.bpm, key: r.metas?.keyscale ?? t.key_scale, loop: !!t.loop_bars };
  console.log(`${run}/${track}-${n} → assets/audio/${name}.mp3`);
}

const total = existsSync(AUDIO) ? readdirSync(AUDIO).reduce((a, f) => a + statSync(join(AUDIO, f)).size, 0) : 0;
console.log(`assets/audio total: ${(total / 1024).toFixed(0)} KB`);
if (total > 1.5 * 1024 * 1024) throw new Error('audio over 1.5 MB (rule 13א): drop a track or shorten loops');
writeFileSync(chosenPath, JSON.stringify(chosen, null, 2) + '\n');

if (prune) {
  const keep = new Set(Object.values(chosen).map((c) => `${c.run}/${c.candidate}`));
  for (const run of readdirSync(join(MUSIC, 'runs'))) {
    const log = readLog(run);
    for (const [track, t] of Object.entries(log)) {
      for (const r of t.results) {
        if (r.pruned || keep.has(`${run}/${track}-${r.n}`)) continue;
        // force: the game MP3 exists only if loopify ran on this run, so a missing one is normal
        for (const f of [join(MUSIC, r.file), join(MUSIC, 'runs', run, 'game', `${track}-${r.n}.mp3`)]) rmSync(f, { force: true });
        r.pruned = true;
        console.log(`pruned ${run}/${track}-${r.n}`);
      }
    }
    writeFileSync(join(MUSIC, 'runs', run, 'prompts.json'), JSON.stringify(log, null, 2));
  }
}
