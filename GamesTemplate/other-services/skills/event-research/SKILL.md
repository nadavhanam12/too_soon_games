---
name: event-research
description: Research a trending event before building a Too Soon Games parody game and write Games/<GameId>/research.md (story, figures, humor angles, local humor, what the internet already did, 3 mechanic ideas, red/yellow/green sensitivities, audience & channels, sources). Use for /event-research, "research this event", "תחקור את האירוע", "מחקר אירוע", "בוא נבדוק את הנושא למשחק".
---

# /event-research "<topic or URL>"

Produces the research brief that RULES.md (rule 4) requires before any script is written. Output:
`Games/<GameId>/research.md` (ask for `GameId` if the game folder does not exist yet; the user may give
another path). Hebrew is the working language with the user; the brief itself is written in the
language of the target audience (`il` → Hebrew, `us` → English), sources stay in their original language.

## 0. Inputs (ask only for what is missing)

1. **Topic** — the argument. A URL counts: fetch it first and treat it as source #1.
2. **Audience** — `il` or `us`. If not given, ask in Hebrew: "מי קהל היעד, ישראל או ארה״ב?" (one
   question, two options). It decides the language of the brief, the local-humor section and the
   channels section.
3. **GameId** — PascalCase folder name under `Games/`. If the user has none yet, propose one from the
   topic and confirm.

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
For each (A/B/C):
- What the player does (one sentence)
- The central action (tap / swipe / hold / drag / timing)
- The shareable moment (what makes someone say "you have to see this")
- 1–3 minute fit (stages or endless, how a run ends, what the score is)
- Build risk for a 10-hour window (low / medium / high and why)

## 7. Sensitivities & risks (RULES 4א–4ד)
Verdict: 🔴 RED / 🟡 YELLOW / 🟢 GREEN, with the specific rule lines that apply.
- 🔴 reasons (if any): deaths/serious injuries still being treated, minors, sexual/violent crime
  victims, disaster/attack in its first two weeks, illness/death of a private person.
- 🟡 reasons (if any): open legal proceeding (only "allegedly", no guilt), private person exposed
  (generic character, no name/photo), religion/ethnicity as the joke, real brand.
- Mitigations: what the game must do (generic character, "allegedly" line on the facts screen, no
  logo, etc.)
- If YELLOW: write literally: **"🟡 Needs Nadav's written OK before any script is written. OK: ____ (date)"**
- Always include: the parody line and takedown-contact link requirement for the facts screen (4ד).

## 8. Audience & distribution channels
Who will love this (2–3 segments), where they are reachable organically (named communities, pages,
subreddits, groups, hashtags — with links where possible), the best posting angle per channel, and
the time window (how many days the event will still be hot).

## 9. Sources
Numbered list: URL · publication date · outlet · what claim(s) it supports (section numbers).

## 10. Decision (filled by the user)
- Go / no-go: ____
- Chosen mechanic (A/B/C or mix): ____
- Yellow items approved: ____
- Title candidates: ____
- Notes: ____
```

## 3. Quality bar before you hand it over

- Every factual line in sections 1–2 maps to a numbered source in section 9.
- Section 5 has at least one search for existing games; "none found" is an acceptable result if you
  searched for it (say what you searched).
- Section 7 verdict is explicit. A 🔴 verdict means you still finish the brief (the user decides), but
  the first line under the title says **"🔴 RED — RULES recommend not building this game."**
- Keep it under ~2 pages. Depth goes into section 6 and 7, not into section 1.

## 4. Hand-over

Tell the user (Hebrew, 3–5 lines): the verdict, the strongest mechanic in your opinion and why, the
played-out joke to avoid, and the path of the file. Then stop; the decision block is theirs.

## Notes

- `research.md` is referenced by RULES 4 and by `/publish-game` (it warns when the file is missing).
- Do not create `game.json` or any code here; that is the template's starter (common-game-code).
- No deliverables outside the game folder. If the game folder does not exist, create only
  `Games/<GameId>/research.md`.
