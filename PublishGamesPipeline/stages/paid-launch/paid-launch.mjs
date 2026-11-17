#!/usr/bin/env node
// Stage "paid-launch" of /launch-game: the Meta test campaign from paid-prep is created PAUSED. Spend starts only when
// a person turns it on in Ads Manager. Runs only after the T0 gate, a passed T0+6 gate (gates.json) and the user's
// approval of this stage.
//   node paid-launch.mjs <GameId> --checklist                 print the steps for Ads Manager (until the API is connected)
//   node paid-launch.mjs <GameId> --mark-created <campaignId>  record the paused campaign
//   node paid-launch.mjs <GameId> --spend <usd>                record the spend so far (the gates read it)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, readJson } from '../../lib/outreach.mjs';
import { logAction, t0Passed } from '../../lib/state.mjs';

const args = process.argv.slice(2);
const gameId = args[0];
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!gameId) { console.error('usage: node paid-launch.mjs <GameId> --checklist | --mark-created <id> | --spend <usd>'); process.exit(2); }
const L = launch(gameId);
const plan = readJson(join(L, 'paid.json'), 'run paid-prep first');
const gatesFile = join(L, 'gates.json');
const gates = existsSync(gatesFile) ? JSON.parse(readFileSync(gatesFile, 'utf8')) : [];
const savePlan = () => writeFileSync(join(L, 'paid.json'), JSON.stringify(plan, null, 2) + '\n');

if (opt('--spend') !== undefined) {
  const usd = Number(opt('--spend'));
  if (!(usd >= 0)) { console.error('--spend <usd>'); process.exit(2); }
  plan.spendUsd = usd; plan.spendAt = new Date().toISOString(); savePlan();
  logAction(gameId, 'paid-launch', { spendUsd: usd });
  console.log(`[paid] spend so far $${usd}. The next gate turns it into cost per game start.`);
  process.exit(0);
}

if (!t0Passed(gameId)) { console.error('[paid] the T0 check is not 6/6: no paid'); process.exit(1); }
const t6 = gates.filter((g) => g.gate === 't6').pop();
if (!t6?.pass) { console.error(`[paid] the T0+6 gate ${t6 ? 'did not pass' : 'has not run'} (gates.json): no paid (slide 11)`); process.exit(1); }

if (opt('--mark-created')) {
  plan.status = 'created-paused'; plan.campaignId = opt('--mark-created'); plan.createdAt = new Date().toISOString(); savePlan();
  logAction(gameId, 'paid-launch', { campaignId: plan.campaignId, status: 'PAUSED' });
  console.log(`[paid] campaign ${plan.campaignId} recorded as created and paused. Turning it on is a person's click in Ads Manager.`);
  process.exit(0);
}
if (args.includes('--checklist')) {
  console.log(readFileSync(join(L, 'paid.md'), 'utf8'));
  console.log(`then: node PublishGamesPipeline/stages/paid-launch/paid-launch.mjs ${gameId} --mark-created <campaign id>`);
  process.exit(0);
}
console.error('nothing to do: --checklist, --mark-created or --spend'); process.exit(2);
