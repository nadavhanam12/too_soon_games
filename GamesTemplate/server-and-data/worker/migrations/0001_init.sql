-- Too Soon Games - initial schema. Additive migrations only (see docs/ARCHITECTURE.md "גיבוי ושחזור").

-- One row per game. Registered by /publish-game via PUT /v1/admin/games/:game (no server redeploy).
CREATE TABLE IF NOT EXISTS games (
  game_id        TEXT PRIMARY KEY,                 -- slug, e.g. "chip-drop"; never changes after publish
  name           TEXT NOT NULL,
  max_score      INTEGER NOT NULL,                 -- scores above this are rejected
  min_duration_s INTEGER NOT NULL DEFAULT 0,       -- scores with a shorter play time are rejected
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per anonymous player (client-generated UUID). No PII.
CREATE TABLE IF NOT EXISTS users (
  user_id      TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen    TEXT NOT NULL DEFAULT (datetime('now')),
  first_game   TEXT,
  lang         TEXT,
  country      TEXT,
  city         TEXT,
  device       TEXT,
  nick         TEXT,
  games_played INTEGER NOT NULL DEFAULT 0
);

-- One row per (game, player): first game_start. COUNT(*) per game = "N players".
CREATE TABLE IF NOT EXISTS players (
  game_id  TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  first_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (game_id, user_id)
);

-- Best score per (game, player). Leaderboard = ORDER BY score DESC.
CREATE TABLE IF NOT EXISTS scores (
  game_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  nick       TEXT,
  score      INTEGER NOT NULL,
  duration_s INTEGER,
  stage      TEXT,
  version    TEXT,
  country    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (game_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scores_board ON scores (game_id, score DESC, updated_at ASC);
