-- plays: one increment per game_start event (the "N games played" number on the site and the title screen)
ALTER TABLE games ADD COLUMN plays INTEGER NOT NULL DEFAULT 0;
