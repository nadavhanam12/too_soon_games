import type { SiteCtx } from '../types';
import { layout, netButtons } from '../components/layout';
import { signupCard } from '../components/signup';
import { timeline, feedItems, defaultFeatured } from '../components/games';

const TABS = `<div class="tabs" role="tablist" aria-label="Show">
  <button type="button" role="tab" aria-selected="true" data-f="all">Latest</button>
  <button type="button" role="tab" aria-selected="false" data-f="games">Games</button>
  <button type="button" role="tab" aria-selected="false" data-f="events">Too soon</button>
</div>`;

/** Home: a timeline. The sign-up card on top (where a compose box would be), the newest game pinned, then the feed.
 *  The tabs, times, share, clip and scoreboard are driven by the shared page script in layout.ts. */
export function homePage(ctx: SiteCtx): string {
  const lead = defaultFeatured(ctx.games);
  const body = `
${signupCard(netButtons(ctx, true))}
${timeline(lead, feedItems(ctx.games, ctx.events, lead), ctx.studio.name)}`;
  return layout(ctx, { title: 'Home', description: ctx.studio.tagline, path: '/', home: true, bodyClass: 'page-home', subhead: TABS }, body);
}
