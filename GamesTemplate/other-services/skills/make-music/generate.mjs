// Generate music candidates for one game through the local ACE-Step API (http://127.0.0.1:8001).
// Usage (from the repo root): node GamesTemplate/other-services/skills/make-music/generate.mjs <GameId> <spec> [track ...]
//   spec   = Games/<GameId>/music/specs/<spec>.json   { note, defaults: {...}, tracks: { <name>: { label, prompt, ... } } }
//   output = Games/<GameId>/music/runs/<spec>/raw/<track>-<n>.wav + prompts.json (request, seeds, metas; paths relative)
// Re-running a track replaces its candidates. Prompts describe genre and production traits only: no artist or song names.
// Variations: task_type "cover" + src_audio_path (keeps melody/structure, audio_cover_strength 0..1), or
// reference_audio_path (timbre/feel only). Those paths are relative to Games/<GameId>/music/.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, basename, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'http://127.0.0.1:8001';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const [gameId, specName, ...only] = process.argv.slice(2);
if (!gameId || !specName) throw new Error('usage: node generate.mjs <GameId> <spec> [track ...]');
const MUSIC = join(ROOT, 'Games', gameId, 'music');
const spec = JSON.parse(readFileSync(join(MUSIC, 'specs', `${specName}.json`), 'utf8'));
const RUN = join(MUSIC, 'runs', specName);
const RAW = join(RUN, 'raw');
mkdirSync(RAW, { recursive: true });

async function call(path, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (j.code !== 200) throw new Error(`${path} failed: ${j.error ?? JSON.stringify(j)}`);
  return j.data;
}

async function release(req, uploads) {
  if (!Object.values(uploads).some(Boolean)) return (await call('/release_task', req)).task_id;
  // The server rejects absolute paths in JSON, so source/reference audio goes up as multipart files.
  const form = new FormData();
  for (const [k, v] of Object.entries(req)) if (v !== undefined && v !== null) form.append(k, String(v));
  for (const [k, p] of Object.entries(uploads)) {
    if (!p) continue;
    const abs = join(MUSIC, p);
    if (!existsSync(abs)) throw new Error(`${k}: ${p} not found (paths are relative to Games/${gameId}/music/)`);
    form.append(k, new Blob([readFileSync(abs)], { type: 'audio/wav' }), basename(abs));
  }
  const r = await fetch(API + '/release_task', { method: 'POST', body: form });
  const j = await r.json();
  if (j.code !== 200) throw new Error(`/release_task failed: ${j.error ?? JSON.stringify(j)}`);
  return j.data.task_id;
}

async function generate(name, t) {
  const t0 = Date.now();
  const req = {
    model: t.model, prompt: t.prompt, lyrics: t.lyrics ?? '[Instrumental]', bpm: t.bpm, key_scale: t.key_scale, time_signature: '4',
    audio_duration: t.duration, batch_size: t.batch, thinking: true, use_cot_caption: false,
    inference_steps: t.inference_steps, guidance_scale: t.guidance_scale,
    task_type: t.task_type ?? 'text2music', audio_cover_strength: t.audio_cover_strength,
    // WAV master: lossless for loop cutting (and the machine has no ffmpeg); loopify.py encodes the MP3 once.
    vocal_language: t.vocal_language ?? 'en', audio_format: 'wav',
  };
  const uploads = { src_audio: t.src_audio_path, reference_audio: t.reference_audio_path };
  const task_id = await release(req, uploads);
  for (;;) {
    await new Promise((res) => setTimeout(res, 2000));
    const [row] = await call('/query_result', { task_id_list: [task_id] });
    if (row.status === 0) continue;
    if (row.status === 2) throw new Error(`${name}: generation failed: ${row.result} (see ACE-Step server.log)`);
    const items = JSON.parse(row.result);
    const results = [];
    for (let i = 0; i < items.length; i++) {
      if (!items[i].file) throw new Error(`${name}: server returned no file for item ${i + 1} (see ACE-Step server.log)`);
      const audio = await fetch(API + items[i].file);
      if (!audio.ok) throw new Error(`${name}: download failed ${audio.status}`);
      const file = join(RAW, `${name}-${i + 1}.wav`);
      writeFileSync(file, Buffer.from(await audio.arrayBuffer()));
      results.push({ n: i + 1, file: relative(MUSIC, file).replaceAll('\\', '/'), seed: items[i].seed_value, metas: items[i].metas, dit_model: items[i].dit_model });
    }
    console.log(`${name}: ${results.length} files in ${((Date.now() - t0) / 1000).toFixed(1)}s (${items[0]?.dit_model})`);
    return { ...t, request: { ...req, ...uploads }, results };
  }
}

const logPath = join(RUN, 'prompts.json');
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : {};
const names = only.length ? only : Object.keys(spec.tracks);
for (const n of names) {
  if (!spec.tracks[n]) throw new Error(`no track "${n}" in specs/${specName}.json`);
  log[n] = await generate(n, { ...spec.defaults, ...spec.tracks[n] });
  writeFileSync(logPath, JSON.stringify(log, null, 2));
}
