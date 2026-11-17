# Paid test: Drop the Chip

**Status: prepared, not running.** Nothing is created in Meta until `paid-launch` is approved, and spend starts only when a person turns it on.

> No research.md: confirm the event is not political or social. Meta then requires a "special ad category" and an authorization, and the playbook says no paid at all for such events.

**When:** T0+12, and only if the T0+6 gate passed (start rate >= 40%, share >= 3%, event still rising) and the team approved paid.

**Stop if:** cost per game start above $1.50 after $30 spent; event down 50% from its peak; 72 hours since T0; an ad rejected twice.

| tier | budget | passes when |
|---|---|---|
| 1 | $30 | cost per game start <= $0.50 |
| 2 | up to $200 | cost per game start <= $0.30 and k >= 0.10 |
| 3 | up to the $500 paid cap (slide 12) | TikTok only from here (its minimums: $50/day per campaign, $20/day per ad group) |

## Campaign (tier 1)

- Campaign: **TSG chip-drop test 20261115**, objective Traffic, no special ad category, PAUSED
- Ad set: US, 18+, Reels and Stories on Facebook and Instagram, lifetime budget **$30** over 24 h, optimize for landing page views
- Ads (one per clip, Meta splits the budget):

### chip-drop hook

- Video: `launch/videos/hook.mp4`, thumbnail `launch/videos/cover.png`
- Text: The chip CEO resigned, so we built a game about the fall 📉 Dodge the headlines, keep falling, beat your friends. Free, no signup
- Headline: Drop the Chip · Description: Free browser game. No signup. · Button: Play Game
- Link: https://toosoongames.app/chip-drop/?utm_source=meta&utm_medium=paid&utm_campaign=chip-drop-20261115&utm_content=hook

### chip-drop arc

- Video: `launch/videos/arc.mp4`, thumbnail `launch/videos/cover.png`
- Text: The chip CEO resigned, so we built a game about the fall 📉 Dodge the headlines, keep falling, beat your friends. Free, no signup
- Headline: Drop the Chip · Description: Free browser game. No signup. · Button: Play Game
- Link: https://toosoongames.app/chip-drop/?utm_source=meta&utm_medium=paid&utm_campaign=chip-drop-20261115&utm_content=arc

### chip-drop challenge

- Video: `launch/videos/challenge.mp4`, thumbnail `launch/videos/cover.png`
- Text: The chip CEO resigned, so we built a game about the fall 📉 Dodge the headlines, keep falling, beat your friends. Free, no signup
- Headline: Drop the Chip · Description: Free browser game. No signup. · Button: Play Game
- Link: https://toosoongames.app/chip-drop/?utm_source=meta&utm_medium=paid&utm_campaign=chip-drop-20261115&utm_content=challenge

## By hand in Ads Manager (until the API is connected)

1. Create → Traffic → name as above → no special ad category.
2. Ad set: website traffic, US, 18-65, manual placements: the four above, lifetime budget $30, 24 h, landing page views.
3. One ad per clip: upload the MP4, the cover as thumbnail, text, headline, button "Play Game", the link above (it carries the UTM).
4. Publish it **turned off**. Turning it on is a separate decision at T0+12.
