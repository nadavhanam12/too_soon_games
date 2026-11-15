# Half a Marathon, Whole Halloumi (HalfMarathon) — research brief (lite mode)
Audience: us · Date of research: 2026-11-15 · Hour 0: 18:43 · Event date(s): 2026-11-15 · Researcher: Claude for Nadav

> **Lite mode:** a studio-internal event, not news. No web research (your call). No external sources (RULES 3
> exception, DECISIONS 65). Sections 5, 8, 9 are marked "n/a" and go into the retro as a gap in the skill
> (the research skill assumes a news event). Listed on the studio site.

## 1. Story in brief
- 2026-11-15: one of the studio's founders ran a half marathon (21.1 km) in Cyprus today.
- At home: a wife and a 2-year-old baby, waiting at the finish line.
- That is the whole story. **Nothing else goes in:** no name, no city, no race name, no real finish time, no photo.

## 2. Key figures
| figure | role | status | in game |
|---|---|---|---|
| The runner | the player | [private person] | generic only: "the runner", no name, no face |
| The wife | in the finish crowd | [private person] | generic: "the blonde with the sign", no name |
| The baby | at the finish line | minor, generic (DECISIONS 64) | generic: "the baby", no name, no gender, no identifying detail |

## 3. Humorous angles
- 🟢 **A startup founder runs a half marathon:** every startup term lands twice. "The runway ran out at km 18." "Burn rate: 1,400 calories." "Our only exit this year."
- 🟢 **Dad of a 2-year-old:** 21 km is the rest day. "Up at 4:30? The baby's been up since 4:15." "Ever chased a toddler through a mall? That's an ultra."
- 🟢 **Cyprus:** halloumi, street cats, 29°C in November, British tourists with a pint at 8 a.m., everyone driving on the other side.
- 🟢 **Find one blonde in a crowd of 4,000 sunburned Brits:** the joke of the last stage.
- 🟢 **The baby wins:** in the last 100 meters the baby runs at you faster than you run.

## 4. Local humor of the target audience
1. "Sorry, sorry, founder coming through" — the apology line when you weave at the start.
2. Startup speak as race commentary: runway, burn rate, pivot, exit, "we're pre-medal".
3. Halloumi instead of energy gel — the bonus item at the water station.
4. "Siga siga!" (Cypriot "slow down, take it easy") — what the old man on the plastic chair shouts while you fly by.
5. Ouzo from a local grandpa — the trap item: the screen wobbles for 3 seconds.
6. "If it's not on Strava, it didn't happen."
7. "The investors are watching" — the inner voice at km 18.
8. Brits abroad: "Cheers mate!" at 7:58 a.m., a stag party in matching shirts blocking the course.

## 5. What the internet already did
n/a (private event). The played-out joke to avoid: generic tired-runner jokes (knees, shoes, chafing). The gap nobody filled: a game built for you on race day.

## 6. Mechanic (chosen: A, five stages)
**Arc:** alarm at 4:30 → the start in the dark → 21.1 km of sun and cats → the wall at km 18 → a sprint to the finish where the wife and the baby are waiting. **The ending follows from the run:** the finish time, and whether you got to the baby in time for the high-five.

**Running distance meter (across all stages):** top of the screen, inside `SAFE`: `12.4 / 21.1 km` + a race clock
`1:02:17` + a thin progress bar with km ticks. The distance carries across stages (shared state in `play.ts` passed into
each stage) and does not reset at a banner. Each stage covers a stretch:

| # | stage | km | action | fail | length (s) | score | reuse |
|---|---|---|---|---|---|---|---|
| 1 | The start | 0–3 | swipe left/right between runners: a guy filming a story, a couple in matching outfits, a Brit with a pint, a stag party | collision = 20 s penalty | 15 | time | adapt FlightHeros `run` (obstacles swapped) |
| 2 | Water station | 3–8 | timed tap on the right cup: water / sports drink / halloumi (bonus) / ouzo (trap) | miss = thirst meter rises | 15 | time + halloumi bonus | new (small) |
| 3 | Cyprus sun | 8–15 | hold = faster, heat meter rises; release = cool down. Cats cross: release in time | heat meter full = walk for 10 s | 20 | time | adapt `fly` (hold mechanic) |
| 4 | The wall | 15–19 | left-right taps on the beat, the beat slows, the inner voice talks | missed beat = slows down | 20 | time | adapt `tie` (repeated taps) |
| 5 | The finish | 19–21.1 | sprint by tapping + find the blonde with the sign and the baby in the crowd, tap the baby for a high-five | no high-five = "the baby fell asleep" ending | 15 | time + high-five bonus | new (small) |

**Estimate:** 6.5 h (play 3.5, content 1, art 1, tuning 1). Risk: stage 4 (beat feel on a phone).
**Cut list (at 22:00):** (1) stage 2 becomes a banner line + automatic halloumi; (2) stage 4 becomes a single hold; (3) no alternate ending, the high-five always lands. After every cut there is still a start, a change and an end.

## 7. Sensitivities & risks
**Verdict: 🟢 GREEN** (after DECISIONS 64).
- 4א: the baby is generic, no name, no gender, no likeness of a real child. Allowed under the updated 4א.
- 4ב: the runner and the wife are private people, so generic characters only. Approved in chat (the goal: a gift game for a founder).
- 3: studio-internal event, no external source (DECISIONS 65).
- 4ד: parody line and takedown-contact link on the facts screen.
- **Writer's checklist (personal info):**
  - No name of anyone in the family, anywhere, including the facts screen.
  - No city, race name, real course, bib number, real finish time, company name or shoe brand.
  - "Cyprus" is allowed (approved). No identifiable landmark (a specific promenade, a specific hotel).
  - The baby: "the baby" only; no gender, no age beyond "2-year-old" on the facts screen, no distinctive clothing or toy.
  - The wife: "the blonde with the sign". No detailed face, no name on the sign.
  - Brits and Cypriots: the joke is on the situation (a pint at breakfast, siga siga), not on origin.

## 8. Audience & distribution channels
n/a for organic channels: a direct link to the runner and friends tonight, plus the listing on the studio site.

## 9. Sources
None (studio-internal event, RULES 3 exception, DECISIONS 65).

## 10. Decision (filled by the user)
- Go / no-go: Go (chat, 2026-11-15)
- Chosen mechanic: A
- Story arc: wakes up at 4:30, runs 21.1 km through halloumi, cats and the wall, and reaches a high-five with the baby at the finish line.
- What the player will say to a friend: "I finished a half marathon in Cyprus in 1:52 and still made it to the baby's high-five."
- Score sentence: "seconds before the course closed"
- Yellow items approved: private people as generic characters (chat)
- Title (one) and tagline: ____ (3 candidates in game.draft.json)
- Notes: English, listed on the site, no external sources (chat, 2026-11-15).

## 11. Hour-0 kit

### 11.1 `game.draft.json`
See `Games/HalfMarathon/game.draft.json`.

### 11.2 Facts screen
1. Nov 15, 2026: one of our founders ran a real half marathon in Cyprus today. 21.1 km.
2. He got up early. The 2-year-old got up earlier.
3. The water stations did not hand out halloumi. Allegedly.
4. The ouzo grandpa was made up. Probably.
5. **(highlight)** We built this game the same day, while he was running. He finished first.
6. Parody. Not affiliated with the real people or organizations. · [Contact us to remove content]

**Lose-screen consolation lines:**
- In real life he finished. You can at least try again.
- A 2-year-old would have finished faster. In a diaper.
- The runway ran out. But this was only the seed round.

### 11.3 Content seeds
**Ranks (ascending):**
1. Got Up at 4:30 for This?
2. Tourist With a Pint
3. Chased the Bus on the Wrong Side
4. Street Cat, Walking Pace
5. Hotel Pool Jogger
6. Grilled Halloumi
7. Dad Chasing a Toddler at the Mall
8. Pivoted to Running
9. Exit at Km 21.1
10. Mediterranean Kenyan

**In-game lines:**
- Start: "Sorry, sorry, founder coming through." · "Who films a story at the start line?!" · "Cheers mate!" (Brit with a pint, 7:58 a.m.) · "Stag party, 12 matching shirts, zero urgency."
- Water: "Energy gel? Here it's halloumi." · "+HALLOUMI! −4 s" · "Ouzo?! Who gave you ouzo?" · "Burn rate: 1,400 calories. Runway shrinking."
- Sun: "29°C in November. It's Cyprus, don't ask." · "Cat. Another cat. Same cat?" · "Siga siga!" (old man on a plastic chair) · "The bus came from the wrong side. Again."
- Wall: "The runway ran out at km 18." · "Why didn't I spend Saturday on the couch like a normal person?" · "The investors are watching." · "If it's not on Strava, it didn't happen." · "Think of the medal. Think of the shower."
- Finish: "4,000 blonde Brits. Only one has a sign." · "The baby is running at you. The baby is faster than you." · "HIGH FIVE!!!" · "Our only exit this year."

**Cutscene:**
1. ⏰ 4:30 a.m. The alarm goes off.
2. The baby has been awake since 4:15, staring at you silently from the crib.
3. From the bed: "Go. Come back with a medal, not excuses."
- Turning moment: you're outside in the dark with 4,000 people in running gear and one Brit who hasn't slept since yesterday.
- Button: **To the start line**

**Stage banners:**
- `KM 0 · THE START`: "4,000 runners, one road." / "Swipe left and right." / "Don't step on the stag party."
- `KM 3 · WATER STATION`: "Grab a cup on time." / "Halloumi = bonus." / "Ouzo = mistake."
- `KM 8 · CYPRUS SUN`: "Hold to run faster." / "Let go before you cook." / "And let the cats cross."
- `KM 15 · THE WALL`: "The runway ran out." / "Tap left-right on the beat." / "The investors are watching."
- `KM 19 · THE FINISH`: "Sprint to the line." / "Find the sign in the crowd." / "High-five the baby."

### 11.4 Score design
- Counts: seconds left until the course closes (3:00:00) at the moment you finish. Higher is better. Finish in 1:52:00 → 4,080.
- Result-screen sentence: "You finished in {time}: {result} seconds before the course closed"
- `max`: 6300 (a perfect run = 1:15:00, bonuses included). `minDurationS`: 60. `higherIsBetter`: true.

### 11.5 Share text
- **(chosen)** `Half a Marathon, Whole Halloumi 🏃 I ran 21.1 km in Cyprus and finished {result} seconds before the course closed. Rank: "{rank}". Try to pass me: {url}`
- `The runway ran out at km 18, but I finished 🏅 {result} seconds before closing, "{rank}". Your turn: {url}`
- `Ran a half marathon from the couch 🏃 {result} seconds before closing, rank "{rank}". A 2-year-old passed me at the end. {url}`

### 11.6 Visual brief
- Colors: sky blue background `#8fd3f4`, dark navy ink `#0b2545`, sun-orange accent `#ff8a00` (`themeColor` = `#0b2545`).
- The runner: a simple silhouette, orange tank top with a generic bib "21", a cap. Does not resemble a real person.
- The wife: a silhouette with blonde hair and a "RUN!!!" sign (no name). The baby: a small round figure in her arms, hands in the air.
- Props: water cups, a halloumi cube, a street cat, a pint, the finish arch with "21.1".
- Mood: sun, sweat, silly.
- Title image: the runner reaching the "21.1" arch while the baby throws its hands up in the crowd, a giant sun behind.

## 12. Plan against the clock
| phase | planned h | from–to | actual | notes |
|---|---|---|---|---|
| brief + decision | 0.5 | 18:43–19:15 | | research dropped, jokes only; switched to English |
| play core (stages 1–3 + distance meter) | 2.5 | 19:15–21:45 | | |
| stages 4–5 + content.ts | 1.5 | 21:45–23:15 | | |
| art, audio, tuning on a phone | 1 | 23:15–00:15 | | |
| assets, bugcheck, publish | 0.5 | 00:15–00:45 | | |
| phone checklist, fixes | 0.5 | 00:45–01:15 | | |
| buffer | 0 | | | |

Cut-list checkpoint: 22:00.

## 13. Preflight (2026-11-15 18:44, HalfMarathon)
- 🟢 node v26.13.1
- 🟡 git: main, 20 uncommitted paths (commit or stash before hour 1) — open: other work (site redesign), not this game
- 🟢 common-game-code deps installed
- 🟢 build check passes on FlightHeros (tsc + esbuild)
- 🟢 wrangler pinned in worker/node_modules (4.162.0)
- 🟢 wrangler logged in
- 🟢 .dev.vars has ADMIN_KEY
- 🟢 API live: https://api.toosoongames.app/v1/version → {"version":"0.1.7"}
- 🟢 site live: https://toosoongames.app (200)
- 🟢 bugcheck deps installed
- 🟢 Chrome found for bugcheck
- 🟢 GameId HalfMarathon free in games.json
- 🟢 created Games/HalfMarathon
- 🟢 reference games FlightHeros, FallingCEO present

result: 0 red, 1 yellow
