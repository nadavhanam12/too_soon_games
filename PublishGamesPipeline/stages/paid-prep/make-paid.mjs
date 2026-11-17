#!/usr/bin/env node
// Stage "paid-prep" of /launch-game (playbook slides 11 and 12): the Meta test campaign, ready but not running.
// Builds the plan, the creatives and the exact settings; `paid-launch` creates it PAUSED after its own approval, and only
// a person turns spend on, in Ads Manager.
//   node make-paid.mjs <GameId> --clips hook,challenge [--budget 30]
//     --clips   the clips approved for paid ads in the videos stage (they show no real faces or names)
//     --budget  tier-1 test budget in USD, 20-50 (default 30)
// Out: Games/<GameId>/launch/paid.json, paid.md
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameCfg, launch, readJson, trackedLink } from '../../lib/outreach.mjs';
import { REPO } from '../../lib/state.mjs';

const args = process.argv.slice(2);
const gameId = args[0];
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!gameId || !opt('--clips')) { console.error('usage: node make-paid.mjs <GameId> --clips hook,challenge [--budget 30]'); process.exit(2); }
const L = launch(gameId);
const cfg = gameCfg(gameId);
const copy = readJson(join(L, 'copy.final.json'), 'run the copy stage first');
const videos = readJson(join(L, 'videos', 'videos.json'), 'run the videos stage first');
const budget = Number(opt('--budget') ?? 30);
if (!(budget >= 20 && budget <= 50)) { console.error('--budget: the tier-1 test is $20-50 (slide 11)'); process.exit(1); }

// The research verdict decides whether paid is allowed at all (RULES 4: yellow = no paid, red = nothing).
const research = join(REPO, 'Games', gameId, 'research.md');
const warnings = [];
if (existsSync(research)) {
  const r = readFileSync(research, 'utf8');
  if (/🔴/.test(r)) { console.error('research.md has a 🔴 verdict: no marketing at all'); process.exit(1); }
  if (/🟡/.test(r)) { console.error('research.md has a 🟡 verdict: no paid ads for this game (playbook slide 11, RULES 4)'); process.exit(1); }
} else warnings.push('No research.md: confirm the event is not political or social. Meta then requires a "special ad category" and an authorization, and the playbook says no paid at all for such events.');

const clips = opt('--clips').split(',').map((s) => s.trim()).filter(Boolean);
for (const c of clips) if (!videos.clips.some((v) => v.name === c)) { console.error(`--clips: "${c}" is not one of ${videos.clips.map((v) => v.name).join(', ')}`); process.exit(1); }

const country = { us: 'US', il: 'IL' }[String(cfg.audience).toLowerCase()] || String(cfg.audience || '').toUpperCase();
if (!/^[A-Z]{2}$/.test(country)) { console.error(`game.json audience "${cfg.audience}" is not a country`); process.exit(1); }
const fb = copy.posts.facebook || Object.values(copy.posts)[0];
const primaryText = fb.text.replace(fb.link, '').replace(/[:\s]+$/, '').trim();

const plan = {
  game: gameId, status: 'prepared', createdAt: new Date().toISOString(),
  rules: {
    earliest: 'T0+12, and only if the T0+6 gate passed (start rate >= 40%, share >= 3%, event still rising) and the team approved paid',
    stopIf: ['cost per game start above $1.50 after $30 spent', 'event down 50% from its peak', '72 hours since T0', 'an ad rejected twice'],
    tiers: [
      { tier: 1, budget: `$${budget}`, window: '12-24 h', passIf: 'cost per game start <= $0.50' },
      { tier: 2, budget: 'up to $200', passIf: 'cost per game start <= $0.30 and k >= 0.10' },
      { tier: 3, budget: 'up to the $500 paid cap (slide 12)', note: 'TikTok only from here (its minimums: $50/day per campaign, $20/day per ad group)' },
    ],
    noRealPeople: 'no real faces or names in the ad (approved clips only)',
  },
  campaign: { name: `TSG ${cfg.slug} test ${copy.campaign.split('-').pop()}`, objective: 'OUTCOME_TRAFFIC', buyingType: 'AUCTION', specialAdCategories: [], status: 'PAUSED' },
  adSet: {
    name: `${country} reels 18+`, status: 'PAUSED', lifetimeBudgetUsd: budget, durationHours: 24,
    optimizationGoal: 'LANDING_PAGE_VIEWS', billingEvent: 'IMPRESSIONS', bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: { countries: [country], ageMin: 18, ageMax: 65, placements: ['facebook_reels', 'instagram_reels', 'instagram_stories', 'facebook_stories'] },
  },
  ads: clips.map((c) => ({
    name: `${cfg.slug} ${c}`, clip: `launch/videos/${c}.mp4`, thumbnail: 'launch/videos/cover.png',
    primaryText, headline: cfg.title, description: 'Free browser game. No signup.', callToAction: 'PLAY_GAME',
    link: trackedLink(gameId, copy.campaign, { source: 'meta', medium: 'paid', content: c }),
  })),
  measure: 'cost per game start = spend / game_start where ch = paid:meta (admin, channels table); effective = that x (1 - k)',
  warnings,
};
writeFileSync(join(L, 'paid.json'), JSON.stringify(plan, null, 2) + '\n');

const md = [`# Paid test: ${cfg.title}`, '', `**Status: prepared, not running.** Nothing is created in Meta until \`paid-launch\` is approved, and spend starts only when a person turns it on.`, '',
  ...(warnings.length ? ['> ' + warnings.join('\n> '), ''] : []),
  `**When:** ${plan.rules.earliest}.`, '', `**Stop if:** ${plan.rules.stopIf.join('; ')}.`, '',
  '| tier | budget | passes when |', '|---|---|---|', ...plan.rules.tiers.map((t) => `| ${t.tier} | ${t.budget} | ${t.passIf || t.note} |`), '',
  '## Campaign (tier 1)', '',
  `- Campaign: **${plan.campaign.name}**, objective Traffic, no special ad category, PAUSED`,
  `- Ad set: ${country}, 18+, Reels and Stories on Facebook and Instagram, lifetime budget **$${budget}** over 24 h, optimize for landing page views`,
  '- Ads (one per clip, Meta splits the budget):', '',
  ...plan.ads.flatMap((a) => [`### ${a.name}`, '', `- Video: \`${a.clip}\`, thumbnail \`${a.thumbnail}\``, `- Text: ${a.primaryText}`, `- Headline: ${a.headline} · Description: ${a.description} · Button: Play Game`, `- Link: ${a.link}`, '']),
  '## By hand in Ads Manager (until the API is connected)', '',
  '1. Create → Traffic → name as above → no special ad category.',
  `2. Ad set: website traffic, ${country}, 18-65, manual placements: the four above, lifetime budget $${budget}, 24 h, landing page views.`,
  '3. One ad per clip: upload the MP4, the cover as thumbnail, text, headline, button "Play Game", the link above (it carries the UTM).',
  '4. Publish it **turned off**. Turning it on is a separate decision at T0+12.',
];
writeFileSync(join(L, 'paid.md'), md.join('\n') + '\n');
console.log(`[paid-prep] ${plan.ads.length} ads, $${budget} test, ${country} → launch/paid.md (nothing created in Meta)`);
for (const w of warnings) console.log('[paid-prep] note: ' + w);
