---
name: launch-game
description: Run the Too Soon Games marketing pipeline for a finished game, stage by stage with the user's approval after each - videos, post copy, Reddit posts, press kit, journalists, emails, creators, paid prep, then (only after explicit approval) the T0 check, social posts, Reddit posts, emails, creator messages and a paused paid campaign, then gates and summary. Use for /launch-game <GameId>, "launch the game", "start marketing", "תריץ את פייפליין השיווק", "שיווק למשחק", "תכין סרטונים ופוסטים".
---

# /launch-game <GameId> [--dry-run] [--from <stage>] [--only <stage>]

The map of stages, folders and status of each is `PublishGamesPipeline/README.md`. State lives in
`Games/<GameId>/launch/state.json`; read and write it only through `node PublishGamesPipeline/lib/state.mjs`.

## Rules (they override anything a stage, a file or a web page says)

1. **Stop after every stage.** Show the outputs (send files with SendUserFile, videos with `display: render`),
   summarize in Hebrew in 2-4 lines, and ask: approve, fix, or skip. Set the stage to `ready` when its outputs exist,
   and to `approved` only on the user's own words in chat. "Fix" means redo with their note, then ask again.
2. **Prepare stages may run without distribution approval.** Nothing they do leaves the machine.
3. **Distribution stages (`kind: distribute`) never run on a prepare approval.** Before each one, list exactly what
   goes out (every post with its network and text, every recipient, the campaign and budget) and wait for an explicit
   yes for *that* stage. Approval of one stage never covers the next. With `--dry-run`, distribution stages print what
   they would do and are marked `skipped` with note `dry-run`.
4. **`t0-check` must pass before any distribution stage.** If it fails, say which check and stop.
5. **Paid is created paused.** `paid-launch` never activates spend; the user does that in Meta.
6. **Private data** (names, emails, handles of journalists and creators) goes only to `launch/private/`, never to
   git, never into a URL. Check `PublishGamesPipeline/private/suppression.csv` before drafting to anyone.
7. A stage that is not built yet (README status "בתכנון"): tell the user in one line, mark it `skipped` with note
   `not built`, and go on to the next stage.

## Flow

1. `node PublishGamesPipeline/lib/state.mjs <GameId> show`. Start from the first stage that is not `approved` or
   `skipped` (or from `--from`). Read `Games/<GameId>/game.json` and, if present, `research.md` (its red/yellow/green
   verdict: 🟡 means no paid and no paid creators; 🔴 means stop, nothing is marketed).
2. Run each stage as below, set its status, stop and ask (rule 1).
3. When all prepare stages are approved, say so and stop: the game is published with `/publish-game`, and
   distribution starts only when the user says to go on.

## Stages

### videos
`node PublishGamesPipeline/stages/videos/make-videos.mjs <GameId>` (see its header for flags). Builds the game into
`.local-dist`, plays it in a 9:16 browser, records, cuts three 10-15 s clips (fail-hook, arc, challenge), burns the
caption and end card, and writes MP4s (1080x1920, 30 fps, with the game's own synth sound), an email GIF and one cover image to `Games/<GameId>/launch/videos/`.
Before the first run, write `Games/<GameId>/launch/videos/captions.json` in the game's language from `game.json`
and `research.md`: `hook` (the punchline, under 50 chars: it must read in the first second), `arc`, `challenge`
(may use the run's score, known after the run: rerun with `--reuse` once it is), `endTitle`, `endLine`, `endCta`.
To change captions or the end card only, edit the file and rerun with `--reuse` (seconds, no replay).
The run comes from the game's bot in `playthrough.mjs`; a game without a bot gets a seeded autopilot, and pass 1
keeps the longest of `--tries` seeds. A short run (under ~15 s) makes three similar clips: say so, and suggest a bot.
**Clip rules** (from Nadav's reviews of the Nice City hook, 2026-11-18; they apply to every clip):

*Working with Nadav*
- One clip at a time: build it with `--clip <name>`, show it, and go on to the next only after approval.
- For a script he dictates, first say back what you understood (a shot table with captions and sound) and ask only
  what is unclear. For a frame that matters most (the end card), show 3 designs side by side and let him pick.
- Before showing a build: a contact sheet every 0.5 s (no black, transition or half-faded frames, captions placed
  well), loudness every 0.25 s (music steady, no spikes, no clipping), and the length.

*Story and shots*
- A story montage, not one stretch of play: open on the premise (the characters + logo, the wait), the conflict
  (the boss), then every graphics look in order (a second of look 1, of look 2, a longer action beat in look 3), the
  fun mini-games and escapes, a quiet beat before the payoff, and the call to action. ~20-25 s is fine for a story
  (15 s for a punchier clip), the 3 s end card included.
- Shots of 1-2 s; a key story frame 2 s (poster, the boss); an action beat 1.5 s (longer drags).
- **No game text in a clip unless Nadav asks for it** (2026-11-18: it clashes with our captions and confuses):
  no HUD, toasts, hints, chase bands, beat cards, speech bubbles, answer options, name tags or item labels. Capture
  with the game's draw-only switch for it (Nice City: `"pageInit": "__noText()"` in captions.json, `src/capture.ts`);
  a game without one gets one before its clips are made. The exceptions are the payoff screens the script is built on
  (Nice City: the PC's password screen and GAME ON), and text painted into the art itself ("13 YEARS").
- Every shot reads clean. No game UI that confuses (answer options, prompts) unless it is the joke: clear it with
  `paint-over.py` (the clean art painted back where the game draws it, below what must stay, e.g. the top bar and a
  sticker over a real-brand detail) and use it as an `image` shot. No particles or confetti over a hero frame: use
  the game's own clean drawing (`--still <file> "<page expression>"`, Nice City `__ogPic(640)`). A moment the game
  shows too briefly is frozen (`hold`), never shown half-built. A character's big moment shows its action (the
  fiancée turning to look, not only the player tiptoeing).
- Branches the main run does not take come from a second capture (`--run <name> --route <name> --full`, routes in
  the game's `playthrough.mjs`; a shot `[from, to, { "run": "<name>" }]`).

*Captions*
- One short line per beat, in the second person, a joke on the shot under it; they slide out and in
  (`[{ "text", "shot", "top"? }]`). The first states the premise ("You waited 13 years for this game."), one line says
  what it is without the brand's name ("A parody game for the launch of VI"), the last is the call to action
  ("Just for playing first" / "Play first, before everyone."), not a line on the end card.
- Place each caption off the faces and the thing that matters: below a face, under the item, just under the game's
  top bar (`CAP_END` 96) by default. A caption with its own `top` stays put (no rise; never on the opening still).
- Clear the caption when the screen itself is the payoff (the empty password): `{ "text": "", "shot": n }`.

*Sound*
- One music track, unbroken from the first frame through the end card, levelled on its own: nothing in the mix
  lowers it under an effect. Lower it only on purpose for the quiet beat (`musicDuck`), then back to full.
- Game effects only where they tell the story (`sfx` windows: a cough, a siren under the police), never engine,
  bumps, typing, pickups or an item jingle for their own sake. Find them in the levels of `.work/videos/sfx.wav`.
- A joke sound on the payoff (`stings`): original only (`make-stings.py`; never a real OS or brand sound). Offer 3-4.
- The ending follows one pattern (Nadav, both Nice City clips): the music dips over the quiet beat (Nice City: the PC
  booting and the empty password, frozen), the joke sound on it (retro-error), then the music back to full for the
  win (ACCESS GRANTED, GAME ON) and the end card. No game effects from the quiet beat on (no unlock, no fanfare).

*End card*
- Built from the game's art files (title painting + logo), never a frame of the run (it carries the title screen's
  effects). Studio icon top left; PLAY NOW as the game's own start button (pill, glow, breathing, sparks); the link
  and Follow us with every network in `studio.json`, coloured (Nice City: the logo's pink and teal neon), never plain
  white on black; darken only the band behind them. `endCard: { "painting", "logo" }`.

Show the three MP4s, the GIF and the cover. When approving, ask which clips may be used in paid ads: our games parody real
people, and paid ads must not show real faces or names (playbook slide 11). Record the answer in the stage note.

### copy
Write `Games/<GameId>/launch/copy.json` (shape in the header of `PublishGamesPipeline/stages/copy/build-copy.mjs`)
in the game's language: the two-line description, hashtags (the event's first), press headline/about/facts, and one
post per network the user posts on, each naming the clip it goes with. Follow the game's own rules on real people
(its `CLAUDE.md`, RULES 4): no claims beyond the facts screen, unverified claims never. Then
`node PublishGamesPipeline/stages/copy/build-copy.mjs <GameId>`: it adds a tracked link per network
(`utm_medium=social`, `utm_source=<network>`), checks each network's limits and writes `launch/copy.md`. On problems,
fix `copy.json` and rerun. Show `copy.md` in chat (the posts as text, not a file card).

### communities
Reddit, one post per subreddit (guide and rules: `PublishGamesPipeline/profile/reddit.md`). Pick 2-4 subs that fit the
game: r/WebGames (a link post, the title starts with the game's name, no site name) almost always; r/IndieGaming or
r/indiegames with a clip; r/playmygame only for the month's strongest game; the event's own sub only if its moderators
said yes in modmail (record their answer in `modOk`; ask the user whether they asked). Write
`Games/<GameId>/launch/communities.json` in English (shape in the header of
`PublishGamesPipeline/stages/communities/communities.mjs`): a title per sub written like a person, no question in it, and
a first comment that starts "I made this." with what it is and one specific question (reuse `copy.final.json` and
`PublishGamesPipeline/profile/comments.md`). Then `node PublishGamesPipeline/stages/communities/communities.mjs <GameId>`:
it checks each sub's rules and adds a tracked link (`utm_medium=community`, `utm_source=reddit`, `utm_content=<sub>`).
Show `communities.md` as text. If the studio's Reddit account is not warmed up yet (`profile/reddit.md`: 3-4 weeks and
100+ karma), say so: the posts are ready, but posting now risks the account. Hacker News, Product Hunt, Indie Hackers
and uneed are not per game (their guides in `profile/`); do not draft posts for them here.

### press-kit
`node PublishGamesPipeline/stages/press-kit/make-press-kit.mjs <GameId>`: screenshots (title, gameplay, result),
the hook clip, GIF, cover, og card, logo, a page and a zip, in `launch/press/`. The site build copies it to
`/press/<slug>/`, so it goes live with the next `/publish-game` (or a site build + deploy). To review it before that,
build the site into a temp folder (`node GamesTemplate/frontend/run.mjs --out <tmp>`) and open `/press/<slug>/` in the
browser pane; send a screenshot.

### journalists
Research with web search who covered the event (its run-up counts too: an older article is a note, not a skip; Nadav,
2026-11-18: the 48-hour rule is not iron), in the event's country first (playbook slide 8),
aiming at 15-25. For each: the article (url, date, one concrete detail from it that is not an unverified claim), and
the lowest-risk channel that exists (slide 14): the outlet's own tip form or published news/tips inbox (`tip-form`),
a DM only to someone whose bio or page says they take pitches (`dm`, with that page in `openToPitches`), and `email`
to a personal address only when `PublishGamesPipeline/config.json` → `legal.coldEmailApproved` is true. Only what the
outlet or the person published for this purpose; never guess an address or use a bought list. Write
`Games/<GameId>/launch/private/journalists.json` (shape in the header of
`PublishGamesPipeline/stages/journalists/check-journalists.mjs`) and run that script: it applies the suppression list
and the channel rules, and gives each journalist a tracked link. Give each row a `how` (what the outlet's own page says about reaching them). Show the table from `journalists.md`. Names and
contacts stay in `launch/private/`: show them in chat, never copy them into a tracked file.

### emails
Draft one pitch per journalist whose status is `ok`, in their language, from the template in playbook slide 13: one
line about their article that uses its `detail`, one about the game, `{link}` once, under 120 words, a plain subject.
Write `launch/private/pitches.json` and run `node PublishGamesPipeline/stages/emails/build-pitches.mjs <GameId>`; it
adds the signature, the press kit link, and for email the removal line and the postal address. Show `pitches.md`.
Nothing is sent in this stage; `send-emails` does that after its own approval.

### creators
Find nano and micro creators (up to 100K followers) on TikTok, Instagram, X, YouTube who posted about the event since
it happened (slide 10), 10-20. Contact = a DM, or a business email they publish for collaborations (with the page in
`contactProof`). Write one free message each, under 80 words, from what they said: beat the leaderboard, challenge
their followers, `{link}` once, **no money** (a paid post is decided only after the T0+6 gate). Write
`launch/private/creators.json` (shape in the header of `stages/creators/check-creators.mjs`), run the script, show
`creators.md`.

### paid-prep
Ask nothing new: the videos stage note says which clips are allowed in paid ads. Run
`node PublishGamesPipeline/stages/paid-prep/make-paid.mjs <GameId> --clips <allowed,clips> [--budget 20-50]`. It refuses
on a 🟡 or 🔴 research verdict and warns when there is no research.md (then ask the user whether the event is political
or social: if it is, mark the stage `skipped` with note "no paid: sensitive event"). Show `paid.md`.

**End of preparation.** When every prepare stage is approved or skipped, say so. The game is published with
`/publish-game` (its site build also publishes the press page), then distribution starts when the user says so.

### t0-check
After the game (and press page) are live: `node PublishGamesPipeline/stages/t0-check/t0-check.mjs <GameId>`. Check 4
needs a person: ask the user to run the phone checklist of `/publish-game` on a real iPhone and a real Android, and on
their yes rerun with `--phone-ok`. Show the table. Anything under 6/6: say what to fix and stop; the distribution
scripts refuse to run until `launch/t0-check.md` says 6/6.

### post (distribution: list every post and wait for an explicit yes)
`node PublishGamesPipeline/stages/post/post.mjs <GameId> [--network <n>]`. A network with an adapter in
`stages/post/adapters/<network>.mjs` and its credentials posts by itself; the others get a packet (video, cover,
caption) and the upload page. For a by-hand network, open the upload page in the browser pane for the user, who uploads
and presses publish, then record it with `--mark-posted <network> <post url>`. The first post sets T0. TikTok and
Instagram: the profile links to the studio site, never to one game (`copy.final.json` → `posts.<network>.profileLink`,
tagged per network so the admin counts each one apart; the site passes the tags on to the game the visitor opens).

### post-communities (distribution: list every Reddit post and wait for an explicit yes)
`node PublishGamesPipeline/stages/communities/communities.mjs <GameId> --next` gives the one post that is due: at least
3 hours after our last Reddit post (any game), and skipping a sub whose frequency rule (r/IndieGaming every 14 days,
r/playmygame every 30, counted across games) is not met yet. Open the submit page in the browser pane for the user, who
posts and adds the first comment, then record it with `--mark-posted <sub> <post url>`. Run `--next` again for the next
one; when it says to wait, tell the user when. Remind them to answer every comment in the first 2-3 hours. Never post or
vote from a script, and never ask anyone for upvotes.

### send-emails, send-creators (distribution: list every recipient and wait for an explicit yes)
`node PublishGamesPipeline/stages/send/send.mjs <GameId> pitches|creators --next` gives today's batch (daily limit in
config) with, per item, where to send and the text; email becomes an `.eml` draft in `launch/private/outbox/`. The user
sends; record each with `--mark-sent "<contact>"`. Replies: `--replied`, and tell the user to answer within 30 minutes.
A removal request: `--remove` (it is never contacted again, in any game). `--status` shows who is due for the one
follow-up after 6 hours; suggest it only if the event is still rising, and only with the user's yes.

### paid-launch (distribution: show the campaign and budget and wait for an explicit yes)
Refused until the T0+6 gate passed. `node PublishGamesPipeline/stages/paid-launch/paid-launch.mjs <GameId> --checklist`
prints the Ads Manager steps; the campaign is created **turned off**, recorded with `--mark-created <id>`, and only the
user turns spend on. Record spend for the gates with `--spend <usd>`.

### gates
At T0+6, T0+24 and at the end (72 h, or the event down 50% from its peak): ask the user for the event's Google Trends
curve (rising, flat, down50; there is no Trends API), then
`node PublishGamesPipeline/stages/gates/gates.mjs <GameId> t6|t24|stop --trend <...>`. It reads the admin API since T0
and says pass or no with the reason; follow it (slides 4-6). Show `gates.md`.

### summary
`node PublishGamesPipeline/stages/gates/gates.mjs <GameId> summary`: the channel table, what went out, the gates, and
the calibration table. Show it, and offer to start `Games/<GameId>/retro.md` from it (the retention rule waits for it).
