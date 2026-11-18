-- scores_n: the number of score rows per game, kept by the API (POST scores adds 1 for a player's first score; the
-- admin deletes subtract). Replaces SELECT COUNT(*) FROM scores on every score post, which read every score row of the
-- game each time and made D1 reads grow with the square of the player count.
-- Rows deleted by hand in SQL must update it too: UPDATE games SET scores_n = (SELECT COUNT(*) FROM scores s WHERE s.game_id = games.game_id);
ALTER TABLE games ADD COLUMN scores_n INTEGER NOT NULL DEFAULT 0;
UPDATE games SET scores_n = (SELECT COUNT(*) FROM scores s WHERE s.game_id = games.game_id);
-- max_score_per_s: optional per-game ceiling on score per second of play (game.json score.maxPerS); NULL = no check.
ALTER TABLE games ADD COLUMN max_score_per_s REAL;
