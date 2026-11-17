import type { SiteCtx } from '../types';
import { layout, netButtons } from '../components/layout';
import { esc } from '../components/html';
import { timeline, feedItems, defaultFeatured } from '../components/games';

const TABS = `<div class="tabs" role="tablist" aria-label="Show">
  <button type="button" role="tab" aria-selected="true" data-f="all">Latest</button>
  <button type="button" role="tab" aria-selected="false" data-f="games">Games</button>
  <button type="button" role="tab" aria-selected="false" data-f="events">Too soon</button>
</div>`;

/** Home: a timeline. Follow prompt on top (where a compose box would be), the newest game pinned, then the feed.
 *  The tabs, times, share, clip and scoreboard are driven by the shared page script in layout.ts. */
export function homePage(ctx: SiteCtx): string {
  const lead = defaultFeatured(ctx.games);
  const body = `
<section class="prompt" aria-label="Follow us">
  <span class="av" aria-hidden="true"><img src="/assets/logo.png" alt="" width="360" height="352"></span>
  <div>
    <p class="prompt-h">Follow us. Be the first to play the next viral game.</p>
    <p class="prompt-sub">${esc(ctx.studio.tagline)}</p>
    <div class="nets">${netButtons(ctx)}</div>
  </div>
</section>
${timeline(lead, feedItems(ctx.games, ctx.events, lead), ctx.studio.name)}`;
  return layout(ctx, { title: 'Home', description: ctx.studio.tagline, path: '/', home: true, bodyClass: 'page-home', subhead: TABS }, body);
}
