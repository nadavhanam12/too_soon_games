---
name: event-research
description: Research a trending event before building a Too Soon Games parody game and write Games/<GameId>/research.md (story, figures, humor angles, local humor, what the internet already did, 3 mechanic ideas, red/yellow/green sensitivities, audience & channels, sources). Use for /event-research, "research this event", "תחקור את האירוע", "מחקר אירוע", "בוא נבדוק את הנושא למשחק".
---

# /event-research "<topic or URL>"

Produces the research brief that RULES.md (rule 4) requires before any script is written, **and** the
hour-0 kit for the 10-hour build: pasteable drafts (config, facts screen, content seeds), a stage skeleton
per mechanic idea with an hours estimate, and an environment preflight. Output:
`Games/<GameId>/research.md` (ask for `GameId` if the game folder does not exist yet; the user may give
another path) plus `Games/<GameId>/game.draft.json` (section 11). Hebrew is the working language with the user; the brief itself is written in the
language of the target audience (`il` → Hebrew, `us` → English), sources stay in their original language.

## 0. Inputs (ask only for what is missing)

1. **Topic** — the argument. A URL counts: fetch it first and treat it as source #1.
2. **Audience** — `il` or `us`. If not given, ask in Hebrew: "מי קהל היעד, ישראל או ארה״ב?" (one
   question, two options). It decides the language of the brief, the local-humor section and the
   channels section.
3. **GameId** — PascalCase folder name under `Games/`. If the user has none yet, propose one from the
   topic and confirm.
4. **Hour 0.** Record the wall-clock time you start (the `Date of research` line gets `· Hour 0: HH:MM`). The
   plan table in section 12 and the retro (RULES 22א) are measured from it.
5. **Preflight (in parallel with the research, it needs no input from it):** run
   `bash GamesTemplate/other-services/skills/event-research/preflight.sh <GameId>` in the background. It
   checks Node ≥ 22, the pinned wrangler + login, the live API, bugcheck/Chrome and the client deps, creates
   `Games/<GameId>/` if missing, and prints the exact command to register the slug on the local API. Paste its
   summary into section 13. A red line there is fixed in hour 0, not discovered in hour 2.

## 1. Research (WebSearch / WebFetch, dated sources)

- Run at least 4 searches: the event itself (news, last 7 days), background/timeline, reactions and
  memes ("<topic> meme", "<topic> game", "<topic> tiktok"), and the audience's local angle (Hebrew
  search for `il`, US outlets/Reddit/X for `us`).
- Prefer primary and mainstream sources (wire services, major outlets, official statements). Note the
  publication date of every source you keep. Discard anything you cannot date.
- **Verification rule:** a claim stated by one source only, or by social media only, is written as
  "allegedly" / "לכאורה" and marked `[unverified]` inline. Never upgrade an allegation to a fact
  because it appears in several copies of the same report. Legal status (charges, arrests,
  convictions) is quoted exactly as reported, with the source.
- Distinguish **public figures in their public role** from **private individuals** (people who became
  known only because of this event). Private individuals are flagged `[private person]` and must not
  be named or drawn in the game (RULES 4ב).

## 2. Write `research.md` with exactly these sections, in this order

```markdown
# <Event title> — research brief
Audience: il|us · Date of research: YYYY-MM-DD · Event date(s): ... · Researcher: Claude for <user>

## 1. Story in brief
5–8 lines, each with a date. What happened, who, where, what is still open. [unverified] where needed.

## 2. Key figures
Table: name · role · public figure / [private person] · what they did · can appear in game? (yes / generic character only / no)

## 3. Humorous angles
At least 5 bullets. Each: the angle in one sentence + why it is funny to THIS audience + the risk
level (🟢/🟡/🔴, see section 7).

## 4. Local humor of the target audience
il: Israeli references, phrases, archetypes, recent memes that map onto the story.
us: American references, formats (SNL-style, TikTok trends, sports/pop-culture analogies), phrases.
List 6–10 concrete items with how each could be used (title, character line, rank name, share text).

## 5. What the internet already did
Memes, videos, parody accounts and EXISTING GAMES about this event, each with a link and date.
End with one line: "The played-out joke to avoid: ..." and one line: "The gap nobody filled: ...".

## 6. Three mechanic ideas
**RULES 2א first:** the play experience must be a story arc the player moves through (a start, a change, an end
that differs from the start), not points until you lose. It need not retell the event one-to-one; the shape depends
on the context (stages as chapters, ordered events inside a run, an escalation that changes the state, an ending that
follows from the run). Before the ideas, list the event's **real moments** (3–6, in order, each with its source) as
raw material. For every idea below write its story arc in one sentence; an idea whose arc is "score until you lose" is
not a candidate (Drop the Chip: endless fall with headlines glued on).
For each (A/B/C):
- Story arc in one sentence (start → change → end), and which real moments it uses
- What the player does (one sentence)
- The central action (tap / swipe / hold / drag / timing)
- The shareable moment (what makes someone say "you have to see this")
- 1–3 minute fit (stages or endless, how a run ends, what the score is)
- **Stage skeleton** (RULES 2א as a work plan): 3–5 rows, one per stage:
  `# · stage name · real moment it expresses (source #) · player action · fail condition · target length (s) · score contribution`
  (the chosen idea's rows become `arc.stages` in `Games/<GameId>/playthrough.mjs`, RULES 21ב)
  If the last stage ends mid-mashing (sprint, rapid taps, hold), add an end-moment row (RULES 13ג): 1.2–2 s in-game
  "FINISH!" beat, taps swallowed, then `R.win()`/`R.fail()`.
- **Reuse map:** for each stage, the closest existing code and how far it is from it:
  `run` / `door` / `cockpit` / `tie` / `fly` from `Games/FlightHeros/src/stages/`, the fall loop from
  `Games/FallingCEO/src/play.ts`, or **new**. One line per stage: "adapt X (change: …)" or "new (why nothing fits)".
- **Hours estimate:** total hours for this idea against the 10-hour plan (section 12), split play / content / art / tuning.
  Write the number, not only low / medium / high, and say which stage is the risk.
- **Cut list:** what is dropped if the build is behind at hour 5, in order (e.g. "stage 4 becomes a cutscene line",
  "no second ending"). The game must still have a start, a change and an end after every cut.

## 7. Sensitivities & risks (RULES 4א–4ד)
Verdict: 🔴 RED / 🟡 YELLOW / 🟢 GREEN, with the specific rule lines that apply.
- 🔴 reasons (if any): deaths/serious injuries still being treated, an identifiable real minor (name, photo,
  likeness or any detail that leads to them; a generic unnamed child or baby is fine, DECISIONS 64), sexual/violent crime
  victims, disaster/attack in its first two weeks, illness/death of a private person.
- 🟡 reasons (if any): open legal proceeding (only "allegedly", no guilt), private person exposed
  (generic character, no name/photo), religion/ethnicity as the joke, real brand.
- Mitigations: what the game must do (generic character, "allegedly" line on the facts screen, no
  logo, etc.)
- If YELLOW: write literally: **"🟡 Needs Nadav's written OK before any script is written. OK: ____ (date)"**
- Always include: the parody line and takedown-contact link requirement for the facts screen (4ד).
- **Writer's checklist** (used while writing `content.ts`, 5–8 lines): which names may appear and only on the facts
  screen (RULES 17), the exact "allegedly" phrases in the audience's language for each unverified claim, what the
  generic character must not resemble (no real face, no logo, no slogan), topics that stay out of one-liners.

## 8. Audience & distribution channels
Who will love this (2–3 segments), where they are reachable organically (named communities, pages,
subreddits, groups, hashtags — with links where possible), the best posting angle per channel, and
the time window (how many days the event will still be hot).

## 9. Sources
Numbered list: URL · publication date · outlet · what claim(s) it supports (section numbers).

## 10. Decision (filled by the user)
- Go / no-go: ____
- Chosen mechanic (A/B/C or mix): ____
- Story arc in one sentence (start → change → end): ____
- What the player will say to a friend (RULES 2, one sentence): ____
- Score sentence (RULES 14, "<unit> you <verb>"): ____
- Yellow items approved: ____
- Title (one) and tagline: ____
- Notes: ____

## 11. Hour-0 kit (pasteable drafts; the user edits, nothing here is final)

### 11.1 `game.draft.json`
Written as a separate file `Games/<GameId>/game.draft.json` (NOT `game.json`: the starter creates that, the user copies
over what survived). Same shape as `game.json` (`common-game-code/game.schema.json`): `id`, `slug` (kebab-case, ≤ 20
chars, English even for `il`), `_titleCandidates` (array of 3), `tagline`, `audience`, `lang`, `event` {title, date,
sourceUrl = source #1, sourceLabel, sources = every URL from section 9}, `score` {label, max, minDurationS,
higherIsBetter} from 11.4, `share.text` = the marked variant of 11.5, `themeColor` from 11.6, `status: "draft"`,
`version: "0.1.0"`.

### 11.2 Facts screen (ready for `content.ts`)
5–8 lines in the audience's language, each starting with a date, in the order and length the screen shows
(SCREENS.md "facts"); one line marked **(highlight)** = the "in reality…" line that answers the game's joke; the parody
line of RULES 4ד in the audience's language; "allegedly" wherever section 1 says `[unverified]`. Real names appear here
and nowhere else. Then 2–3 **lose-screen consolation lines** (a real fact works best: "in reality they made it").

### 11.3 Content seeds
- **Ranks:** 10 names, ascending, built from the local-humor items of section 4; the last one is the top rank.
- **One-liners:** 15–20 short lines for in-game bubbles/toasts, grouped by the stages of the leading idea.
- **Cutscene draft:** 3 dialogue lines + the turning moment + the one button label (SCREENS.md "cutscene").
- **Stage banners:** for the leading idea, `title + 3 lines` per stage (the `BANNERS` shape in
  `Games/FlightHeros/src/content.ts`).

### 11.4 Score design
The single integer (RULES 14): what it counts, the sentence on the result screen, `max` (a perfect run),
`minDurationS` (the shortest honest run), `higherIsBetter`, and the conversion if the game's natural measure is
lower-is-better.

### 11.5 Share text
3 variants, ≤ 200 chars before the link, with `{result}` `{rank}` `{url}` (RULES 16), in the audience's share preset
(SHARE.md). Every variant follows the fixed structure of RULES 16: `I just played <game name> and scored {result}.
My rank: "{rank}". Think you can beat me? 🎮 {url}` (correct English, or the same order translated); the variants
differ only in the wording of the result and the question. Mark the one that goes into 11.1.

### 11.6 Visual brief
3 colors (background, ink, accent → `themeColor`), the generic character in one sentence (silhouette, clothing, one
prop; what it must NOT resemble per section 7), 2–3 recognizable props from the event, the mood in three words, and
the one image for the title screen (it becomes `og.png` / `cover.png` through `make-assets.mjs`).

## 12. Plan against the clock
Hour 0 = the time stamped under the title. The retro (RULES 22א) fills the last two columns.

| phase | planned h | from–to | actual | notes |
|---|---|---|---|---|
| brief + decision (sections 10–11) | 1 | 0–1 | | |
| play core (stages 1–2 of the chosen idea) | 3 | 1–4 | | |
| remaining stages + content.ts | 2 | 4–6 | | |
| art, audio, tuning on a phone | 1.5 | 6–7.5 | | |
| assets, bugcheck, publish (`/publish-game`) | 1 | 7.5–8.5 | | |
| phone checklist, fixes, distribution | 1 | 8.5–9.5 | | |
| buffer | 0.5 | 9.5–10 | | |

Adjust the planned hours to the chosen idea's estimate (section 6) before the user signs section 10. Hour 5 is the
cut-list checkpoint.

## 13. Preflight (pasted from `preflight.sh`)
The script's summary, verbatim. Every 🔴 line gets a one-line "fixed at HH:MM by …" or is left open on purpose.
```

## 3. Quality bar before you hand it over

- Every factual line in sections 1–2 maps to a numbered source in section 9.
- Section 5 has at least one search for existing games; "none found" is an acceptable result if you
  searched for it (say what you searched).
- Section 7 verdict is explicit. A 🔴 verdict means you still finish the brief (the user decides), but
  the first line under the title says **"🔴 RED — RULES recommend not building this game."**
- Sections 1–10 stay under ~2 pages; sections 11–13 are the kit and may be longer, but every item there is
  pasteable as-is (no "for example", no placeholders except `{result}` `{rank}` `{url}`).
- `game.draft.json` parses as JSON and uses only keys from `game.schema.json` (plus `_titleCandidates`).
- Section 6: every idea has a stage skeleton, a reuse map, an hours number and a cut list; section 12 is adjusted
  to the leading idea.
- Section 13 exists and the preflight has no unexplained 🔴.

## 4. Hand-over

Tell the user (Hebrew, 4–6 lines): the verdict, the strongest mechanic in your opinion and why (with its hours
number), the played-out joke to avoid, the preflight result (green, or what is red), and the paths of the two
files. Then stop; the decision block is theirs.

## Notes

- `research.md` is referenced by RULES 4 and by `/publish-game` (it warns when the file is missing).
- Do not create `game.json`, `content.ts` or any code here; that is the template's starter (common-game-code).
  The kit (section 11, `game.draft.json`) is text the user pastes, not something the build reads.
- No deliverables outside the game folder. If the game folder does not exist, create only
  `Games/<GameId>/research.md` and `Games/<GameId>/game.draft.json` (the preflight creates the folder).
- Distribution (section 8) stays at the level of channels and angles; ready-to-post texts were deliberately left
  out (2026-11-15).
