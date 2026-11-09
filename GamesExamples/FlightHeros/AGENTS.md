# FlightHeros

- `index.html` contains the canvas game, all scenes, styles, and share/contact DOM overlays. `CLAUDE.md` describes the project and release workflow.
- Ending flow: `scenes.end` → `scenes.facts` → `scenes.community` → title. The facts scene contains the story; community owns sharing, group invitation, personal contact, and restart.
- `goNow()` hides overlays outside community. `placeShare()` positions overlays in logical 360×640 canvas units and rescales them on resize. Group invitation and personal contact retain independent positions when either configured link is empty.
- Reuse the existing share/copy handlers and `PUBLIC_URL`, `WA_GROUP`, `WA_ME` configuration. Keep contact links out of canvas tap handling.
- Do not publish merely because a local change was requested. Preserve the existing release workflow.

## itch page design assets

- `design/itch/banner.png` and `design/itch/background.png` are page-theme assets, separate from the game release.
- `design/itch/description.html` holds the Hebrew description; `design/itch/README.md` documents theme settings and manual application.
- `design/itch/preview.html` previews the theme around the existing `index.html` iframe. Its layout is illustrative; itch controls the public page layout.
- Updating these files does not publish the game or change the public itch page.
