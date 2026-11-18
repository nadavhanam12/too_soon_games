// The closed list from docs/EVENTS.md. Add there first, then here (and in the client's analytics module).
export const EVENT_NAMES = [
  'session_start',
  'referral_start',
  'game_start',
  'cutscene_skip',
  'stage_start',
  'stage_complete',
  'game_over',
  'retry',
  'game_complete',
  'nick_submit',
  'nick_skip',
  'board_view',
  'share_click',
  'share_complete',
  'follow_click',
  'source_click',
  'replay',
  'error',
  'session_end',
  // the studio site only (game id "site", docs/EVENTS.md)
  'page_view',
  'game_click',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
