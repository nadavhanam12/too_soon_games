#!/usr/bin/env node
// Launch state for one game: Games/<GameId>/launch/state.json. The /launch-game skill reads it to know where to resume.
//   node state.mjs <GameId> show
//   node state.mjs <GameId> set <stage> <status> [note]     status: pending | running | ready | approved | failed | skipped
//   node state.mjs <GameId> log <stage> <json>              append one distribution action to launch/log.jsonl
//   node state.mjs <GameId> t0 [iso]                       show T0, or set it (once)
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');

// Order matters: /launch-game runs them top to bottom. `kind` decides whether a stage may run before distribution.
export const STAGES = [
  { id: 'videos', kind: 'prepare' },
  { id: 'copy', kind: 'prepare' },
  { id: 'communities', kind: 'prepare' },
  { id: 'press-kit', kind: 'prepare' },
  { id: 'journalists', kind: 'prepare' },
  { id: 'emails', kind: 'prepare' },
  { id: 'creators', kind: 'prepare' },
  { id: 'paid-prep', kind: 'prepare' },
  { id: 't0-check', kind: 'gate' },
  { id: 'post', kind: 'distribute' },
  { id: 'post-communities', kind: 'distribute' },
  { id: 'send-emails', kind: 'distribute' },
  { id: 'send-creators', kind: 'distribute' },
  { id: 'paid-launch', kind: 'distribute' },
  { id: 'gates', kind: 'after' },
  { id: 'summary', kind: 'after' },
];
const STATUSES = ['pending', 'running', 'ready', 'approved', 'failed', 'skipped'];

export function launchDir(gameId) {
  const game = join(REPO, 'Games', gameId);
  if (!existsSync(join(game, 'game.json'))) throw new Error(`Games/${gameId}/game.json not found`);
  return join(game, 'launch');
}

export function readState(gameId) {
  const f = join(launchDir(gameId), 'state.json');
  const st = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { game: gameId, createdAt: new Date().toISOString(), stages: {} };
  for (const s of STAGES) st.stages[s.id] ??= { status: 'pending' };
  return st;
}

export function setStage(gameId, stage, status, note) {
  if (!STAGES.some((s) => s.id === stage)) throw new Error(`unknown stage "${stage}" (${STAGES.map((s) => s.id).join(', ')})`);
  if (!STATUSES.includes(status)) throw new Error(`unknown status "${status}" (${STATUSES.join(', ')})`);
  const st = readState(gameId);
  st.stages[stage] = { status, at: new Date().toISOString(), ...(note ? { note } : {}) };
  const dir = launchDir(gameId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'state.json'), JSON.stringify(st, null, 2) + '\n');
  return st;
}

/** T0 = when distribution started (set by the first post or send), else the release time of /publish-game. */
export function getT0(gameId) {
  const st = readState(gameId);
  if (st.t0) return new Date(st.t0);
  const rel = join(REPO, 'Games', gameId, '.release.json');
  return existsSync(rel) ? new Date(JSON.parse(readFileSync(rel, 'utf8')).publishedAt) : null;
}
export function setT0(gameId, iso = new Date().toISOString()) {
  const st = readState(gameId);
  if (st.t0) return st.t0;
  st.t0 = iso;
  writeFileSync(join(launchDir(gameId), 'state.json'), JSON.stringify(st, null, 2) + '\n');
  return iso;
}

/** True when launch/t0-check.md says 6 / 6. Distribution stages refuse to run otherwise. */
export function t0Passed(gameId) {
  const f = join(launchDir(gameId), 't0-check.md');
  return existsSync(f) && /\*\*6 \/ 6\*\*/.test(readFileSync(f, 'utf8'));
}

export function logAction(gameId, stage, entry) {
  const dir = launchDir(gameId);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ at: new Date().toISOString(), stage, ...entry }) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [gameId, cmd, ...rest] = process.argv.slice(2);
  if (!gameId || !cmd) { console.error('usage: state.mjs <GameId> show | set <stage> <status> [note] | log <stage> <json>'); process.exit(2); }
  if (cmd === 'show') {
    const st = readState(gameId);
    for (const s of STAGES) {
      const v = st.stages[s.id];
      console.log(`${s.id.padEnd(16)} ${s.kind.padEnd(10)} ${v.status.padEnd(9)} ${v.at ?? ''} ${v.note ?? ''}`.trimEnd());
    }
  } else if (cmd === 'set') {
    setStage(gameId, rest[0], rest[1], rest.slice(2).join(' '));
    console.log(`${rest[0]} → ${rest[1]}`);
  } else if (cmd === 't0') {
    console.log(rest[0] ? setT0(gameId, new Date(rest[0]).toISOString()) : (getT0(gameId)?.toISOString() ?? 'not set'));
  } else if (cmd === 'log') {
    logAction(gameId, rest[0], JSON.parse(rest[1]));
  } else { console.error(`unknown command "${cmd}"`); process.exit(2); }
}
