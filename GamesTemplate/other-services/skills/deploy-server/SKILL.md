---
name: deploy-server
description: Deploy the Too Soon Games API (Cloudflare Worker + D1) with backup, typecheck, version bump, migrations and a post-deploy smoke test; also does the one-time first setup (D1 create, secrets). Use for /deploy-server, "deploy the server", "push the API", "תפרוס את השרת", "תעלה גרסה לשרת", "הקמה ראשונה של השרת".
---

# /deploy-server [--first-time] [--dry-run]

Runs from `GamesTemplate/server-and-data/worker`. The mechanical part is `deploy.sh` next to this
file; this document is the procedure around it. Architecture: `docs/ARCHITECTURE.md`; account steps the
user does themselves: `docs/SETUP-CLOUDFLARE.md`; command contracts: `docs/CONTRACTS.md`.

## 0. Preflight (always)

1. `cd GamesTemplate/server-and-data/worker`; `npm install` if `node_modules` is missing.
2. **Login state:** `npx wrangler whoami`. If it reports not logged in, **stop** and tell the user
   (Hebrew): run this from the project folder, approve in the browser, then call `/deploy-server` again:
   ```bash
   npx wrangler login
   ```
   Never try to log in for the user and never ask for API keys in chat.
3. **Node / wrangler note:** the repo pins `wrangler ~4.80` because the machine runs Node 20.13.
   `npx wrangler` printing "requires at least Node.js v22" means the pin was lost or Node changed:
   reinstall (`npm install`) or, once Node 22 LTS is installed, remove the pin (BACKLOG item).
4. `.dev.vars` must exist with `ADMIN_KEY` set (and ideally `CF_ACCOUNT_ID`, `CF_API_TOKEN`). Missing
   file → copy `.dev.vars.example` and ask the user to fill it; do not invent values.

## 1. First time only (`--first-time`)

Run when `wrangler.toml` still has the placeholder `database_id = "00000000-..."`.

1. `npx wrangler d1 create toosoon` → copy the printed `database_id` into `wrangler.toml` (the script
   does this with sed; verify the file afterwards).
2. `npm run migrate:remote`.
3. Secrets, each read from `.dev.vars` and piped on stdin so the value never appears in output:
   `ADMIN_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN` (the last two are skipped with a warning when empty;
   the admin dashboard then shows "analytics not configured" until they are set).
4. Continue with the every-time steps (the backup step is skipped: nothing to back up yet).
5. After the first deploy: tell the user the `workers.dev` URL, that it belongs in
   `GamesTemplate/studio.json` → `apiBase`, and that `ALLOWED_ORIGINS` in `wrangler.toml` must list the
   site origin(s) (`https://toosoon-games.pages.dev`, later the real domain). Changing it needs another
   deploy.

## 2. Every time

| step | command | on failure |
|---|---|---|
| backup | `bash ../backup/export.sh` → `../backup/backups/toosoon-<stamp>-remote.sql` | warn and continue only if the DB does not exist yet; otherwise stop |
| typecheck | `npm run typecheck` | stop |
| version | bump patch of `VERSION` in `wrangler.toml` (the deployed `/v1/version`) | — |
| migrations | `npm run migrate:remote` (applies only new files in `migrations/`) | stop; nothing was deployed yet |
| deploy | `npm run deploy` | stop; see rollback |
| verify | `curl <url>/v1/version` must return the new version; `node test/smoke.mjs <url>` must print "all passed" | rollback |

The smoke test creates a throwaway game `smoke-<id>` in the production DB (one `games` row, one
`players` row, scores deleted at the end). That is intended; the admin page can delete the game row
later if it bothers anyone. Set `ADMIN_KEY` in the environment or keep `.dev.vars` filled.

## 3. Rollback

- Code: `npx wrangler rollback` (previous deployment, instant). Or Workers → toosoon-api → Deployments.
- Data (only if a migration went wrong): `npx wrangler d1 time-travel restore toosoon --timestamp=<ISO before deploy>`
  or `npx wrangler d1 execute toosoon --remote --file ../backup/backups/<the file from step 1>`.
- Migrations are additive by rule (ARCHITECTURE.md); a rollback of code never needs a data rollback
  unless a migration itself was destructive, which the rules forbid.

## 4. Report back (Hebrew, short)

Old → new version, the deployed URL, smoke result, backup file path, and anything skipped (e.g. analytics
secrets empty). If `--dry-run`: everything that would have happened, and that nothing was changed.

## Decisions this skill relies on

DECISIONS 4 (free tier, no card), 5 (backup = Time Travel + local export), 9 (minimal anti-cheat),
30 (admin key only via secrets), 32 (smoke test as the server check). Registering a new game is NOT a
server deploy: `/publish-game` does `PUT /v1/admin/games/<slug>`.
