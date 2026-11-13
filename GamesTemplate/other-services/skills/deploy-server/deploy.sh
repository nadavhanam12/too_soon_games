#!/usr/bin/env bash
# Deploy the Too Soon Games API (Cloudflare Worker + D1).
#   bash deploy.sh                # backup → typecheck → bump VERSION → migrations → deploy → verify
#   bash deploy.sh --first-time   # also: d1 create, write database_id, push secrets from .dev.vars
#   bash deploy.sh --dry-run      # print what would happen; changes nothing (no bump, no deploy)
# Runs in Git Bash on Windows (Node 20, wrangler ~4.80). Never prints secret values.
set -euo pipefail

FIRST=0; DRY=0
for a in "$@"; do
  case "$a" in
    --first-time) FIRST=1 ;;
    --dry-run) DRY=1 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"
WORKER="$(cd "$HERE/../../../server-and-data/worker" && pwd)"
BACKUP="$WORKER/../backup/export.sh"
cd "$WORKER"

step() { printf '\n[deploy] %s\n' "$*"; }
warn() { printf '[deploy] WARNING: %s\n' "$*"; }
fail() { printf '\n[deploy] FAILED: %s\n' "$*" >&2; exit 1; }
run()  { if [ "$DRY" = 1 ]; then echo "  (dry-run) $*"; else "$@"; fi; }

# ---------- 0. preflight ----------
step "preflight"
[ -d node_modules ] || { step "npm install"; npm install --no-audit --no-fund --legacy-peer-deps >/dev/null; }
NODE_V="$(node -v)"; echo "node $NODE_V, wrangler $(npx wrangler --version 2>/dev/null | tail -1)"
if ! npx wrangler whoami >/dev/null 2>&1; then
  fail "not logged in to Cloudflare. Run:  npx wrangler login   (opens a browser), then run this again."
fi
[ -f .dev.vars ] || fail ".dev.vars missing - copy .dev.vars.example and fill ADMIN_KEY (and CF_ACCOUNT_ID / CF_API_TOKEN)"
devvar() { grep -E "^$1=" .dev.vars | head -1 | cut -d= -f2- | tr -d '\r' ; }
[ -n "$(devvar ADMIN_KEY)" ] || fail "ADMIN_KEY is empty in .dev.vars"

PLACEHOLDER='00000000-0000-0000-0000-000000000000'
if grep -q "database_id = \"$PLACEHOLDER\"" wrangler.toml && [ "$FIRST" = 0 ]; then
  fail "wrangler.toml still has the placeholder database_id - run with --first-time"
fi

# ---------- 1. first time ----------
if [ "$FIRST" = 1 ]; then
  step "first-time setup"
  if grep -q "database_id = \"$PLACEHOLDER\"" wrangler.toml; then
    if [ "$DRY" = 1 ]; then
      echo "  (dry-run) npx wrangler d1 create toosoon → write database_id into wrangler.toml"
    else
      OUT="$(npx wrangler d1 create toosoon 2>&1 || true)"
      ID="$(printf '%s' "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
      if [ -z "$ID" ]; then
        # database may already exist: look it up
        ID="$(npx wrangler d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const l=JSON.parse(s);const d=l.find(x=>x.name==="toosoon");if(d)console.log(d.uuid||d.database_id||"")}catch{}})')"
      fi
      [ -n "$ID" ] || fail "could not create or find the D1 database 'toosoon'. Output was: $OUT"
      sed -i "s/database_id = \"$PLACEHOLDER\"/database_id = \"$ID\"/" wrangler.toml
      echo "  database_id written to wrangler.toml"
    fi
  else
    echo "  database_id already set, skipping d1 create"
  fi
  step "secrets (values read from .dev.vars, never printed)"
  for S in ADMIN_KEY CF_ACCOUNT_ID CF_API_TOKEN; do
    V="$(devvar "$S")"
    if [ -z "$V" ]; then warn "$S is empty in .dev.vars - skipped (admin analytics will show 'not configured')"; continue; fi
    if [ "$DRY" = 1 ]; then echo "  (dry-run) wrangler secret put $S"; else printf '%s' "$V" | npx wrangler secret put "$S" >/dev/null && echo "  $S set"; fi
  done
fi

# ---------- 2. every time ----------
step "backup (remote D1 → backup/backups/)"
if [ "$FIRST" = 1 ]; then
  warn "first deploy: nothing to back up yet, skipping"
elif [ "$DRY" = 1 ]; then
  echo "  (dry-run) bash $BACKUP"
else
  bash "$BACKUP" || fail "backup failed - not deploying. (If the DB does not exist yet, use --first-time.)"
fi

step "typecheck"
npm run -s typecheck || fail "typecheck failed"

step "version"
CUR="$(grep -E '^VERSION = ' wrangler.toml | sed -E 's/.*"([^"]+)".*/\1/')"
IFS=. read -r MA MI PA <<<"$CUR"; NEW="$MA.$MI.$((PA+1))"
if [ "$DRY" = 1 ]; then echo "  (dry-run) $CUR → $NEW"; else sed -i "s/^VERSION = \"$CUR\"/VERSION = \"$NEW\"/" wrangler.toml; echo "  $CUR → $NEW"; fi

step "migrations (remote)"
run npm run -s migrate:remote

step "deploy"
run npm run -s deploy

# ---------- 3. verify ----------
step "verify"
if [ "$DRY" = 1 ]; then
  echo "  (dry-run) curl <url>/v1/version ; node test/smoke.mjs <url>"
  echo; echo "[deploy] dry run complete - nothing changed."
  exit 0
fi
URL="$(npx wrangler deployments list 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.workers\.dev' | head -1 || true)"
if [ -z "$URL" ]; then
  SUB="$(npx wrangler whoami 2>/dev/null | grep -oE '[a-z0-9-]+\.workers\.dev' | head -1 || true)"
  [ -n "$SUB" ] && URL="https://toosoon-api.$SUB"
fi
[ -n "$URL" ] || { warn "could not detect the deployed URL - run: node test/smoke.mjs https://toosoon-api.<account>.workers.dev"; exit 0; }
echo "  url: $URL"
GOT="$(curl -s "$URL/v1/version" || true)"
echo "  /v1/version → $GOT"
printf '%s' "$GOT" | grep -q "\"$NEW\"" || fail "deployed version is not $NEW. Rollback: npx wrangler rollback"
ADMIN_KEY="$(devvar ADMIN_KEY)" node test/smoke.mjs "$URL" || fail "smoke test failed against $URL. Rollback: npx wrangler rollback"
echo; echo "[deploy] done: $CUR → $NEW at $URL"
