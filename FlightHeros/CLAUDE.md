# חופשה בטוחה (FlightHeros)

A single-file Hebrew arcade game: `index.html` holds all CSS, markup and JS. One portrait
canvas (360x640 logical, `W`/`H`) letterboxed into the viewport by `fit()`; every screen is a
`scenes.<name>.draw(dt)` function drawing onto that canvas. No build, no npm, no git.

## Layout

```
index.html                      the whole game. Head: charset/viewport/og meta. Body: #c canvas,
                                #share (end-screen share row) and #grp (WhatsApp group line) -
                                the only DOM overlays, positioned over the canvas by placeShare()
audio/                          optional calm/tense/win .mp3 loops (the game tolerates missing files)
itch.json                       itch.io page (user/slug), channel, version, pageUrl
tools/itch-preview.html         dev-only: the game in a 360x640 iframe on a tall page, like itch
.claude/skills/itch-upload/     SKILL.md + upload.sh - stage, check, diff, bump, butler push
.itch/last-upload/              the tree of the last push (for the change diff); dist-itch/ = staging
```

## Publish config (top of the `<script>` in index.html)

- `PUBLIC_URL` — the public page URL used in the share text. Inside itch's iframe
  `location.href` is an itch.zone address, so this must be the itch page URL. Keep equal to
  `itch.json` `pageUrl`.
- `WA_GROUP` — WhatsApp group invite link; empty hides the `#grp` line.

## Sharing (invitation screen, `scenes.community`)

`#share` shows three controls in canvas units 20..340 x 444..490: `#sh` system share
(`navigator.share`, shown only where the API exists; rejects inside itch's iframe → falls
back to the WhatsApp link; AbortError = user closed the sheet), `#wa` wa.me link, `#cp` copy.
`#grp` (two buttons: #grp1 group invite, #grp2 personal wa.me message to WA_ME) uses a full-width group invite at y 310..360 and a personal message at y 504..554, the restart button at y 606. `placeShare()` re-positions and
scales both overlays (font-size follows the canvas scale); `goNow()` hides them on any
scene change.

## Releasing

`/itch-upload` (see the skill). Dry run: `bash .claude/skills/itch-upload/upload.sh --dry-run`.
