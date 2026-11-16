// Generate game-music candidates through the local ACE-Step API (http://127.0.0.1:8001).
// Usage: node generate.mjs specs/<name>.json [trackName ...]
// Output: runs/<name>/raw/<track>-<n>.wav plus runs/<name>/prompts.json (full request, seeds, metas).
// Spec format: { defaults: {...}, tracks: { <name>: { label, prompt, bpm, key_scale, ... } } }.
// Prompts describe genre and production traits only: no artist or song names.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'http://127.0.0.1:8001';
const HERE = dirname(fileURLToPath(import.meta.url));
const [specPath, ...only] = process.argv.slice(2);
if (!specPath) throw new Error('usage: node generate.mjs specs/<name>.json [track ...]');
const spec = JSON.parse(readFileSync(join(HERE, specPath), 'utf8'));
const RUN = join(HERE, 'runs', basename(specPath, '.json'));
const RAW = join(RUN, 'raw');
mkdirSync(RAW, { recursive: true });

async function call(path, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (j.code !== 200) throw new Error(`${path} failed: ${j.error ?? JSON.stringify(j)}`);
  return j.data;
}

async function generate(name, t) {
  const t0 = Date.now();
  const req = {
    model: t.model, prompt: t.prompt, lyrics: t.lyrics, bpm: t.bpm, key_scale: t.key_scale, time_signature: '4',
    audio_duration: t.duration, batch_size: t.batch, thinking: true, use_cot_caption: false,
    inference_steps: t.inference_steps, guidance_scale: t.guidance_scale,
    // Variations of an approved track: "cover" keeps the source's melody/structure (strength 0..1);
    // reference_audio_path only guides timbre/feel. Paths are absolute (same machine as the server).
    task_type: t.task_type ?? 'text2music', audio_cover_strength: t.audio_cover_strength,
    // WAV master: lossless for loop cutting; loopify.py encodes the final MP3 once.
    vocal_language: t.vocal_language ?? 'en', audio_format: 'wav',
  };
  // The server rejects absolute paths in JSON, so source/reference audio goes up as multipart files.
  const uploads = { src_audio: t.src_audio_path, reference_audio: t.reference_audio_path };
  let task_id;
  if (Object.values(uploads).some(Boolean)) {
    const form = new FormData();
    for (const [k, v] of Object.entries(req)) if (v !== undefined && v !== null) form.append(k, String(v));
    for (const [k, p] of Object.entries(uploads)) if (p) form.append(k, new Blob([readFileSync(p)], { type: 'audio/wav' }), basename(p));
    const r = await fetch(API + '/release_task', { method: 'POST', body: form });
    const j = await r.json();
    if (j.code !== 200) throw new Error(`/release_task failed: ${j.error ?? JSON.stringify(j)}`);
    ({ task_id } = j.data);
  } else {
    ({ task_id } = await call('/release_task', req));
  }
  Object.assign(req, uploads);
  for (;;) {
    await new Promise((res) => setTimeout(res, 2000));
    const [row] = await call('/query_result', { task_id_list: [task_id] });
    if (row.status === 0) continue;
    if (row.status === 2) throw new Error(`${name}: generation failed: ${row.result}`);
    const items = JSON.parse(row.result);
    const results = [];
    for (let i = 0; i < items.length; i++) {
      if (!items[i].file) throw new Error(`${name}: server returned no file for item ${i + 1} (see server log)`);
      const audio = await fetch(API + items[i].file);
      if (!audio.ok) throw new Error(`${name}: download failed ${audio.status}`);
      const file = join(RAW, `${name}-${i + 1}.wav`);
      writeFileSync(file, Buffer.from(await audio.arrayBuffer()));
      results.push({ n: i + 1, file, seed: items[i].seed_value, metas: items[i].metas, dit_model: items[i].dit_model });
    }
    console.log(`${name}: ${results.length} files in ${((Date.now() - t0) / 1000).toFixed(1)}s (${items[0]?.dit_model})`);
    return { ...t, request: req, results };
  }
}

const logPath = join(RUN, 'prompts.json');
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : {};
const names = only.length ? only : Object.keys(spec.tracks);
for (const n of names) {
  if (!spec.tracks[n]) throw new Error(`no track "${n}" in ${specPath}`);
  log[n] = await generate(n, { ...spec.defaults, ...spec.tracks[n] });
  writeFileSync(logPath, JSON.stringify(log, null, 2));
}
