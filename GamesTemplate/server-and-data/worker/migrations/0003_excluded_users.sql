-- excluded_users: users whose events stay in Analytics Engine (it has no delete) but are left out of every admin
-- query. Filled by hand when test traffic is cleaned out of the live data (2026-11-17: the owner's devices and the
-- bug-check bots, all from Thailand). Their D1 rows (users, scores, players) are deleted at the same time.
-- Analytics Engine keeps events for 3 months, so rows older than that can be removed.
CREATE TABLE IF NOT EXISTS excluded_users (
  user_id     TEXT PRIMARY KEY,
  reason      TEXT,
  excluded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
