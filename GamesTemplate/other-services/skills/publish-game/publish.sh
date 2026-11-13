#!/usr/bin/env bash
# Publish a game: bugcheck → register (games.json + API) → bump → build client → build site → deploy → verify.
#   bash publish.sh <GameId> [--dry-run] [--skip-bugcheck "<reason>"]
# --dry-run: everything local (no API registration, no deploy, no version bump, games.json written to a .preview file).
# Runs in Git Bash on Windows (Node 20). Paths per docs/CONTRACTS.md.
set -euo pipefail

GAME_ID="${1:-}"; shift || true
[ -n "$GAME_ID" ] || { echo "usage: publish.sh <GameId> [--dry-run] [--skip-bugcheck \"reason\"]" >&2; exit 2; }
DRY=0; SKIP_BUG=0; SKIP_REASON=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --skip-bugcheck) SKIP_BUG=1; SKIP_REASON="${2:-}"; shift || true
      [ -n "$SKIP_REASON" ] || { echo "--skip-bugcheck needs a reason typed by the user" >&2; exit 2; } ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac; shift
done

HERE="$(cd "$(dirname "$0")" && pwd)"
TPL="$(cd "$HERE/../../.." && pwd)"             # GamesTemplate
ROOT="$(cd "$TPL/.." && pwd)"                   # repo root
GAME_DIR="$ROOT/Games/$GAME_ID"
GAME_JSON="$GAME_DIR/game.json"
REGISTRY="$TPL/games.json"
STUDIO="$TPL/studio.json"
DEVVARS="$TPL/server-and-data/worker/.dev.vars"
BUGCHECK="$TPL/other-services/bugcheck/run.mjs"

step() { printf '\n[publish] %s\n' "$*"; }
warn() { printf '[publish] WARNING: %s\n' "$*"; }
fail() { printf '\n[publish] FAILED: %s\n' "$*" >&2; exit 1; }
jq_() { node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const v=process.argv[2].split('.').reduce((o,k)=>o==null?undefined:o[k],j);console.log(v==null?'':(typeof v==='object'?JSON.stringify(v):v))" "$1" "$2"; }

[ -f "$GAME_JSON" ] || fail "no $GAME_JSON"
SLUG="$(jq_ "$GAME_JSON" slug)"; TITLE="$(jq_ "$GAME_JSON" title)"
MAX="$(jq_ "$GAME_JSON" score.max)"; MIN_D="$(jq_ "$GAME_JSON" score.minDurationS)"; MIN_D="${MIN_D:-0}"
[ -n "$SLUG" ] && [ -n "$TITLE" ] && [ -n "$MAX" ] || fail "game.json needs slug, title, score.max"
PUBLIC_BASE="$(jq_ "$STUDIO" publicBase 2>/dev/null || true)"; API_BASE="$(jq_ "$STUDIO" apiBase 2>/dev/null || true)"
echo "[publish] $GAME_ID → /$SLUG/  (\"$TITLE\")  dry-run=$DRY"
[ -f "$GAME_DIR/research.md" ] || warn "research.md missing (RULES 4) - the agent must confirm with the user before continuing"

# 1. bugcheck
step "bugcheck"
if [ "$SKIP_BUG" = 1 ]; then
  warn "bugcheck SKIPPED - reason: $SKIP_REASON"
elif [ -f "$BUGCHECK" ]; then
  node "$BUGCHECK" "$GAME_ID" --server || fail "bugcheck red - see $TPL/other-services/bugcheck/out/report.md"
else
  [ "$DRY" = 1 ] && warn "bugcheck tool not found at $BUGCHECK (dry-run continues)" || fail "bugcheck tool not found at $BUGCHECK"
fi

# 3. register in games.json
step "register in games.json"
REG_OUT="$REGISTRY"; [ "$DRY" = 1 ] && REG_OUT="$REGISTRY.preview"
node - "$GAME_JSON" "$REGISTRY" "$REG_OUT" "$GAME_ID" <<'EOF'
const fs=require('fs');const [gj,reg,out,id]=process.argv.slice(2);
const g=JSON.parse(fs.readFileSync(gj,'utf8'));
let r={games:[]};try{r=JSON.parse(fs.readFileSync(reg,'utf8'));}catch{}
const {score,share,screens,...pub}=g;pub.id=pub.id||id;
pub.publishedAt=pub.publishedAt||new Date().toISOString().slice(0,10);pub.status=pub.status||'live';
const i=r.games.findIndex(x=>x.slug===pub.slug||x.id===pub.id);
if(i>=0)r.games[i]={...r.games[i],...pub};else r.games.unshift(pub);
fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log('  '+(i>=0?'updated':'added')+' '+pub.slug+' → '+out);
EOF

# 4. register in the API
step "register in the API"
if [ "$DRY" = 1 ]; then
  echo "  (dry-run) PUT $API_BASE/v1/games/... skipped"
elif [ -z "$API_BASE" ]; then
  fail "studio.json apiBase is empty - deploy the server first (/deploy-server) and set apiBase"
else
  [ -f "$DEVVARS" ] || fail "$DEVVARS missing (needed for x-admin-key)"
  KEY="$(grep -E '^ADMIN_KEY=' "$DEVVARS" | head -1 | cut -d= -f2- | tr -d '\r')"
  BODY="$(node -e "console.log(JSON.stringify({name:process.argv[1],maxScore:Number(process.argv[2]),minDurationS:Number(process.argv[3])}))" "$TITLE" "$MAX" "$MIN_D")"
  CODE="$(curl -s -o /tmp/publish-api.json -w '%{http_code}' -X PUT "$API_BASE/v1/admin/games/$SLUG" -H "x-admin-key: $KEY" -H 'content-type: application/json' -d "$BODY" || true)"
  [ "$CODE" = "200" ] || fail "API registration returned $CODE: $(cat /tmp/publish-api.json 2>/dev/null)"
  echo "  registered $SLUG (max $MAX, min ${MIN_D}s)"
fi

# 5. bump version
step "version"
CUR="$(jq_ "$GAME_JSON" version)"; CUR="${CUR:-0.0.0}"
IFS=. read -r MA MI PA <<<"$CUR"; NEW="$MA.$MI.$((PA+1))"
if [ "$DRY" = 1 ]; then echo "  (dry-run) $CUR → $NEW"; else
  node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));j.version=process.argv[2];fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n')" "$GAME_JSON" "$NEW"
  echo "  $CUR → $NEW"; fi

# 6. build client
step "build client"
( cd "$TPL/common-game-code" && [ -d node_modules ] || npm install --no-audit --no-fund >/dev/null; npm run -s build -- "$GAME_ID" ) || fail "client build failed"
[ -f "$TPL/dist/$SLUG/index.html" ] || fail "expected $TPL/dist/$SLUG/index.html after the client build"

# 7. build site
step "build site"
( cd "$TPL/frontend" && [ -d node_modules ] || npm install --no-audit --no-fund >/dev/null; npm run -s build ) || fail "site build failed"
[ -f "$TPL/dist/index.html" ] || fail "expected $TPL/dist/index.html after the site build"

# 8. deploy
step "deploy"
if [ "$DRY" = 1 ]; then
  echo "  (dry-run) npx wrangler pages deploy dist --project-name toosoon-games"
  echo; echo "[publish] dry run complete - built to $TPL/dist, nothing deployed, registry preview at $REG_OUT"
  exit 0
fi
( cd "$TPL" && npx wrangler whoami >/dev/null 2>&1 ) || fail "not logged in to Cloudflare. Run:  npx wrangler login   then rerun."
( cd "$TPL" && npx wrangler pages deploy dist --project-name toosoon-games --commit-dirty=true ) || fail "deploy failed (previous deployment stays live). First time? npx wrangler pages project create toosoon-games --production-branch main"

# 9. verify
step "verify"
if [ -z "$PUBLIC_BASE" ]; then warn "studio.json publicBase empty - verify manually"; else
  URL="$PUBLIC_BASE/$SLUG/"
  C1="$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)"; echo "  $URL → $C1"
  [ "$C1" = "200" ] || warn "game page is not 200"
  OG="$(curl -s "$URL?c=42&n=Test" | grep -o 'og:title" content="[^"]*' | head -1 || true)"; echo "  og:title with challenge → ${OG:-<none>}"
  printf '%s' "$OG" | grep -q 'Test scored 42' || warn "challenge OG rewrite not detected (is _worker.js in dist?)"
fi
if [ -n "$API_BASE" ]; then
  C2="$(curl -s -o /dev/null -w '%{http_code}' "$API_BASE/v1/games/$SLUG/board" || true)"; echo "  board → $C2"
  [ "$C2" = "200" ] || warn "board is not 200 - is the game registered in the API?"
fi

# 10. release record
step "release record"
node -e "const fs=require('fs');fs.writeFileSync(process.argv[1],JSON.stringify({publishedAt:new Date().toISOString(),version:process.argv[2],url:process.argv[3]},null,2)+'\n')" "$GAME_DIR/.release.json" "$NEW" "${PUBLIC_BASE:-}/$SLUG/"
echo "  $GAME_DIR/.release.json"
echo; echo "[publish] done: $TITLE v$NEW → ${PUBLIC_BASE:-<publicBase>}/$SLUG/"
echo "[publish] next: the phone checklist (SKILL.md §2) and the retention reminder (§3)."
