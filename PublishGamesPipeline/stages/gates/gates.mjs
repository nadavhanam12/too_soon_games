#!/usr/bin/env node
// Stages "gates" and "summary" of /launch-game (playbook slides 4-6, 12): reads the live numbers from the admin API
// since T0 and says pass or fail by the playbook's thresholds, per channel.
//   node gates.mjs <GameId> t6|t24|stop --trend rising|flat|down50 [--hours N]
//   node gates.mjs <GameId> summary
//     --trend   the event's Google Trends curve relative to its peak (read by a person: there is no Trends API)
// Out: launch/gates.json (every gate run), launch/gates.md (the latest), launch/summary.md (summary)
//
// Thresholds are the playbook's opening values, to calibrate after 2-3 games (slide 5). A rate on fewer than 100
// visits in a channel is "not measured", not a fail.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameCfg, launch, studio } from '../../lib/outreach.mjs';
import { REPO, getT0 } from '../../lib/state.mjs';

const args = process.argv.slice(2);
const [gameId, gate] = args;
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!gameId || !['t6', 't24', 'stop', 'summary'].includes(gate)) { console.error('usage: node gates.mjs <GameId> t6|t24|stop|summary --trend rising|flat|down50'); process.exit(2); }
const trend = opt('--trend');
if (gate !== 'summary' && !['rising', 'flat', 'down50'].includes(trend)) { console.error('--trend rising|flat|down50: the event on Google Trends, relative to its peak'); process.exit(2); }
const L = launch(gameId);
const cfg = gameCfg(gameId);
const st = studio();

const T = { start: 0.40, startFix: 0.30, runEnd: 0.25, share: 0.03, k: 0.10, costPass: 0.50, costScale: 0.30, costStop: 1.50, minVisits: 100 };

// admin key: the same one /publish-game uses (server-and-data/worker/.dev.vars)
const vars = join(REPO, 'GamesTemplate', 'server-and-data', 'worker', '.dev.vars');
const key = process.env.ADMIN_KEY || (existsSync(vars) ? readFileSync(vars, 'utf8').match(/^ADMIN_KEY=(.*)$/m)?.[1]?.trim() : '');
if (!key) { console.error('no ADMIN_KEY (env or server-and-data/worker/.dev.vars)'); process.exit(1); }
const t0 = getT0(gameId);
if (!t0) { console.error('no T0: the game has no .release.json and nothing was posted or sent'); process.exit(1); }
const hours = Number(opt('--hours')) || Math.min(2160, Math.max(1, Math.ceil((Date.now() - t0) / 3600e3)));
const url = `${st.apiBase.replace(/\/$/, '')}/v1/admin/games/${cfg.slug}/stats?days=7&hours=${hours}`;
const res = await fetch(url, { headers: { 'x-admin-key': key } });
if (!res.ok) { console.error(`admin stats → ${res.status} ${(await res.text()).slice(0, 200)}`); process.exit(1); }
const stats = await res.json();
if (stats.ae?.error) { console.error(`analytics unavailable: ${stats.ae.error}`); process.exit(1); }
if (stats.hours !== hours) console.log(`[gates] note: the deployed API ignores ?hours (old version): these numbers cover ${stats.days} days, not ${hours} hours. Deploy the API.`);
const c = stats.ae.counts;
// per visit (the API's funnel). An API before the 2026-11-17 update has no per-visit counts: run ends are then unknown,
// because event counts include every replay
const runEnd = c.run_end ?? null;
const ratio = (a, b) => (b ? a / b : null);
const all = { visits: c.session_start ?? 0, starts: c.visits_started ?? c.game_start ?? 0, runEnds: runEnd, shareClicks: c.share_click ?? 0, referrals: c.referral_start ?? 0 };
const rates = (r) => ({ start: ratio(r.starts, r.visits), runEnd: r.runEnds === null ? null : ratio(r.runEnds, r.starts), share: ratio(r.shareClicks, r.starts), k: ratio(r.referrals, r.starts) });
const overall = rates(all);
const channels = stats.ae.channels ? Object.entries(stats.ae.channels).map(([ch, r]) => ({ ch, ...r, ...rates(r) })) : null;

// cost per game start for paid channels: spend from paid.json (paid-launch --spend), starts from channel paid:meta
const paid = existsSync(join(L, 'paid.json')) ? JSON.parse(readFileSync(join(L, 'paid.json'), 'utf8')) : null;
const meta = channels?.find((x) => x.ch === 'paid:meta');
const cost = paid?.spendUsd && meta?.starts ? paid.spendUsd / meta.starts : null;
const effCost = cost !== null && meta?.k !== null ? cost * (1 - Math.min(0.9, meta.k)) : null;

const pct = (v) => (v === null ? '–' : `${Math.round(v * 1000) / 10}%`);
const usd = (v) => (v === null ? '–' : `$${v.toFixed(2)}`);
const small = all.visits < T.minVisits;
let pass, verdict;
if (gate === 't6') {
  if (small) { pass = false; verdict = `Not measured: ${all.visits} visits (under ${T.minVisits}). Keep the free channels going; no money.`; }
  else if (overall.start < T.startFix) { pass = false; verdict = `Start rate ${pct(overall.start)} is under ${pct(T.startFix)}: stop outreach and fix the landing (or a bug).`; }
  else if (overall.start >= T.start && trend === 'rising') { pass = true; verdict = `Pass: start rate ${pct(overall.start)} and the event is still rising. Go on to expansion (stage 2); a paid creator if share ≥ ${pct(T.share)} (now ${pct(overall.share)}); paid test from T0+12 if the team approved it.`; }
  else { pass = false; verdict = `Not passed (start ${pct(overall.start)}, trend ${trend}): free channels only.`; }
} else if (gate === 't24') {
  const costOk = cost === null ? null : cost <= T.costScale;
  if (trend === 'down50') { pass = false; verdict = 'The event is down 50% from its peak: no more money, free channels until 72 h.'; }
  else if (cost !== null && cost > T.costStop && paid.spendUsd >= 30) { pass = false; verdict = `Cost per start ${usd(cost)} above ${usd(T.costStop)} after $${paid.spendUsd}: stop paid.`; }
  else if (costOk && (overall.k ?? 0) >= T.k) { pass = true; verdict = `Pass: cost per start ${usd(cost)} (effective ${usd(effCost)}), k ${pct(overall.k)}: tier 3 up to the cap.`; }
  else { pass = false; verdict = cost === null ? `No paid numbers (spend not recorded or no paid starts). k ${pct(overall.k)}. Without them, no budget increase.` : `Cost per start ${usd(cost)} or k ${pct(overall.k)} short of ${usd(T.costScale)} / ${pct(T.k)}: no increase.`; }
} else if (gate === 'stop') { pass = true; verdict = 'Stop: all paid off, outreach ends. Run the summary and write retro.md.'; }

const table = (rows) => ['| channel | visits | starts | start rate | run ends | share | k |', '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.ch} | ${r.visits} | ${r.starts} | ${r.visits < T.minVisits ? `(${pct(r.start)})` : pct(r.start)} | ${r.runEnds} | ${pct(r.share)} | ${pct(r.k)} |`)].join('\n');
const funnel = `| | n | rate | target |\n|---|---|---|---|\n| visits | ${all.visits} | | |\n| started | ${all.starts} | ${pct(overall.start)} | ≥ ${pct(T.start)} |\n| finished a run | ${all.runEnds ?? '–'} | ${pct(overall.runEnd)} | ≥ ${pct(T.runEnd)} |\n| share clicks | ${all.shareClicks} | ${pct(overall.share)} | ≥ ${pct(T.share)} |\n| came from a share (k) | ${all.referrals} | ${pct(overall.k)} | ≥ ${pct(T.k)} |`;
const chNote = channels ? (channels.length ? table(channels.sort((a, b) => b.visits - a.visits)) : 'No channel data yet.') : '_The deployed API has no channel breakdown yet: deploy the analytics update._';

if (gate === 'summary') {
  const gates = existsSync(join(L, 'gates.json')) ? JSON.parse(readFileSync(join(L, 'gates.json'), 'utf8')) : [];
  const posts = existsSync(join(L, 'posts.json')) ? JSON.parse(readFileSync(join(L, 'posts.json'), 'utf8')) : {};
  const sent = existsSync(join(L, 'private', 'sent.jsonl')) ? readFileSync(join(L, 'private', 'sent.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const count = (kind, action) => sent.filter((e) => e.kind === kind && e.action === action).length;
  const cal = Object.entries({ 'start rate': [overall.start, T.start], 'finished a run': [overall.runEnd, T.runEnd], share: [overall.share, T.share], k: [overall.k, T.k] })
    .map(([n, [v, t]]) => `| ${n} | ${pct(t)} | ${pct(v)} | ${v === null || small ? 'not enough data' : v >= t ? 'met' : 'missed'} |`);
  const md = [`# Launch summary: ${cfg.title}`, '', `T0 ${t0.toISOString()} · window ${hours} h · written ${new Date().toISOString()}`, '',
    '## Funnel', '', funnel, '', '## Channels', '', chNote, '',
    '## What went out', '', `- Posts: ${Object.entries(posts).filter(([, p]) => p.url).map(([n, p]) => `[${n}](${p.url})`).join(', ') || 'none'}`,
    `- Press: ${count('pitches', 'sent')} sent, ${count('pitches', 'replied')} replied, ${count('pitches', 'removed')} removal requests`,
    `- Creators: ${count('creators', 'sent')} sent, ${count('creators', 'replied')} replied`,
    `- Paid: ${paid?.campaignId ? `campaign ${paid.campaignId}, spend $${paid.spendUsd ?? 0}, cost per start ${usd(cost)}, effective ${usd(effCost)}` : 'none'}`, '',
    '## Gates', '', ...(gates.length ? gates.map((g) => `- ${g.gate} at T0+${g.hours}h: ${g.pass ? 'pass' : 'no'}: ${g.verdict}`) : ['- none ran']), '',
    '## Calibration (slide 5: replace the opening thresholds after 2-3 games)', '', '| metric | threshold | this game | |', '|---|---|---|---|', ...cal, '',
    '## For retro.md', '', '- Articles that came out (links):', '- What worked, what did not, what to change in the pipeline:', ''];
  writeFileSync(join(L, 'summary.md'), md.join('\n'));
  console.log(md.join('\n'));
  process.exit(0);
}

const rec = { gate, at: new Date().toISOString(), hours, trend, pass, verdict, overall: { ...all, ...overall }, cost, effCost };
const gatesFile = join(L, 'gates.json');
const list = existsSync(gatesFile) ? JSON.parse(readFileSync(gatesFile, 'utf8')) : [];
list.push(rec);
writeFileSync(gatesFile, JSON.stringify(list, null, 2) + '\n');
const md = [`# Gate ${gate.toUpperCase()}: ${cfg.title}`, '', `T0 ${t0.toISOString()} · window ${hours} h · trend ${trend}`, '', `**${pass ? 'PASS' : 'NO'}** · ${verdict}`, '', '## Funnel', '', funnel, '', '## Channels', '', chNote, '',
  cost !== null ? `Paid: $${paid.spendUsd} spent, ${meta.starts} starts, ${usd(cost)} per start, effective ${usd(effCost)} (k ${pct(meta.k)}).` : '', ''];
writeFileSync(join(L, 'gates.md'), md.join('\n'));
console.log(md.join('\n'));
