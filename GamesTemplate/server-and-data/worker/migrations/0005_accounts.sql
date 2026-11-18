-- accounts: a sign-up pinned to one player id (routes/auth.ts).
--  * Google / Apple: a verified email and the provider's account id. Signing in on another device moves that device's
--    scores onto this user_id (mergeUser), so one person is one player on every device and game.
--  * Email typed into the card: the list for "a new game is out" mails only. Nothing proves the address is the
--    player's, so it never signs anyone in and never matches another account (email_verified = 0).
CREATE TABLE IF NOT EXISTS accounts (
  user_id        TEXT PRIMARY KEY,               -- the player id in users / scores / players
  email          TEXT,                           -- lower case; NULL when the provider gave none
  email_verified INTEGER NOT NULL DEFAULT 0,     -- 1 = came from Google / Apple; 0 = typed into the card
  google_sub     TEXT UNIQUE,                    -- Google account id ("sub" of the ID token)
  apple_sub      TEXT UNIQUE,                    -- Apple account id
  provider       TEXT NOT NULL,                  -- how it was first created: google | apple | email
  notify         INTEGER NOT NULL DEFAULT 1,     -- 1 = send "a new game is out" mails
  unsub_token    TEXT NOT NULL,                  -- random, for the unsubscribe link in every mail
  country        TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
-- one account per verified email; typed (unverified) emails may repeat (the same person on two browsers)
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts (email) WHERE email_verified = 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_unsub ON accounts (unsub_token);
