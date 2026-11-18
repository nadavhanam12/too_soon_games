// Capture switches for the launch clips (PublishGamesPipeline make-videos.mjs, captions.json "pageInit"). Draw-only:
// they never change a run, so a capture with them is the same run as without.
//   noText (`__noText()`, play.ts): no game text over the picture (Nadav, 2026-11-18: game text clashes with the
//   clip's own captions). It also turns on DEBUG.clean (no HUD, toasts, badge, touch controls). Hidden: the drives'
//   read pause and chase band, toasts (play.ts say: only the drawing, the timing stays), beat cards (BRIBING), floating texts, the HR tag, the distance under the arrow, the
//   mini-games' bubbles / meters / key lines, a conversation's name tag, speech and answers (the painting stays), the
//   top timeline strip, ITEM ACQUIRED's texts (the case stays). The PC's screen and the finale keep theirs: they are
//   the payoff the clips show.
export const CAPTURE = { noText: false };
