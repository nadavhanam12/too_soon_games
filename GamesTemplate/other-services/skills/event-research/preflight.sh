#!/usr/bin/env bash
# Hour-0 environment preflight for a new Too Soon Games game (event-research step 0.5).
# Everything a 10-hour build will need later, checked now so nothing is discovered at hour 2.
# Read-only except: creates Games/<GameId>/ when missing. Never deploys, never registers anything.
#
# Usage: preflight.sh <GameId> [--fix]
#   --fix   also run `npm ci` where node_modules is missing (client, bugcheck)
set -uo pipefail

GAME="${1:-}"; FIX=0; [ "${2:-}" = "--fix" ] && FIX=1
[[ "$GAME" =~ ^[A-Z][A-Za-z0-9]+$ ]] || { echo "usage: preflight.sh <GameId> [--fix]   (PascalCase folder under Games/)"; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
TPL="$(cd "$HERE/../../.." && pwd)"            # GamesTemplate
ROOT="$(cd "$TPL/.." && pwd)"                   # repo root
WORKER="$TPL/server-and-data/worker"
CLIENT="$TPL/common-game-code"
BUG="$TPL/other-services/bugcheck"
WRANGLER="$WORKER/node_modules/.bin/wrangler"
PY="$(command -v python3 || command -v python)"

RED=0; YEL=0; LINES=()
ok()   { LINES+=("🟢 $*"); }
warn() { LINES+=("🟡 $*"); YEL=$((YEL+1)); }
bad()  { LINES+=("🔴 $*"); RED=$((RED+1)); }
have() { command -v "$1" >/dev/null 2>&1; }

# 1. Node (wrangler ^4.162 needs 22+; repo moved to 26 LTS on 2026-11-15)
if have node; then
  NV="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$NV" -ge 22 ] && ok "node $(node --version)" || bad "node $(node --version): wrangler needs 22+, run the Node 26 LTS upgrade"
else bad "node not found"; fi

# 2. git state (so the build starts from a clean, current main)
if git -C "$ROOT" rev-parse >/dev/null 2>&1; then
  BR="$(git -C "$ROOT" branch --show-current)"; DIRTY="$(git -C "$ROOT" status --porcelain | wc -l | tr -d ' ')"
  [ "$DIRTY" = 0 ] && ok "git: $BR, clean" || warn "git: $BR, $DIRTY uncommitted paths (commit or stash before hour 1)"
else warn "not a git repo at $ROOT"; fi

# 3. client deps + typecheck of an existing game (proves the toolchain, ~10 s)
if [ -d "$CLIENT/node_modules" ]; then ok "common-game-code deps installed"
elif [ "$FIX" = 1 ]; then (cd "$CLIENT" && npm ci --silent) && ok "common-game-code deps installed (npm ci)" || bad "npm ci failed in common-game-code"
else bad "common-game-code/node_modules missing: cd $CLIENT && npm ci   (or rerun with --fix)"; fi
if [ -d "$CLIENT/node_modules" ]; then
  REF="FlightHeros"; [ -d "$ROOT/Games/$REF/src" ] || REF="FallingCEO"
  if (cd "$CLIENT" && node build.mjs check "$REF" >/dev/null 2>&1); then ok "build check passes on $REF (tsc + esbuild)"
  else bad "build check fails on $REF: cd $CLIENT && node build.mjs check $REF"; fi
fi

# 4. wrangler pinned + logged in (publish-game step 8 needs it; the API itself is not touched)
if [ -x "$WRANGLER" ] || [ -f "$WRANGLER.cmd" ]; then
  ok "wrangler pinned in worker/node_modules ($(cd "$WORKER" && node -p "require('wrangler/package.json').version" 2>/dev/null || echo '?'))"
  if (cd "$WORKER" && timeout 25 node node_modules/wrangler/bin/wrangler.js whoami 2>/dev/null | grep -qiE 'logged in|account'); then ok "wrangler logged in"
  else bad "wrangler not logged in (or offline): cd $WORKER && node node_modules/wrangler/bin/wrangler.js login"; fi
else bad "worker/node_modules/wrangler missing: cd $WORKER && npm ci"; fi
[ -f "$WORKER/.dev.vars" ] && grep -q '^ADMIN_KEY=' "$WORKER/.dev.vars" && ok ".dev.vars has ADMIN_KEY" || bad "worker/.dev.vars missing ADMIN_KEY (publish-game step 4 registers the slug with it)"

# 5. live API + site
# (cd + relative paths: Python on Windows cannot open Git Bash /c/... paths)
API="$(cd "$TPL" && "$PY" -c "import json;print(json.load(open('studio.json',encoding='utf-8')).get('apiBase',''))" 2>/dev/null)"
SITE="$(cd "$TPL" && "$PY" -c "import json;print(json.load(open('studio.json',encoding='utf-8')).get('publicBase',''))" 2>/dev/null)"
if [ -n "$API" ] && have curl; then
  V="$(curl -fsS --max-time 10 "$API/v1/version" 2>/dev/null)"
  [ -n "$V" ] && ok "API live: $API/v1/version → $(echo "$V" | tr -d '\n' | cut -c1-60)" || bad "API not answering at $API/v1/version"
else warn "apiBase empty in studio.json or curl missing"; fi
if [ -n "$SITE" ] && have curl; then
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SITE/")"
  [ "$code" = 200 ] && ok "site live: $SITE ($code)" || bad "site $SITE answered $code"
fi

# 6. bugcheck + Chrome (publish-game step 1)
if [ -d "$BUG/node_modules" ]; then ok "bugcheck deps installed"
elif [ "$FIX" = 1 ]; then (cd "$BUG" && npm ci --silent) && ok "bugcheck deps installed (npm ci)" || bad "npm ci failed in bugcheck"
else bad "bugcheck/node_modules missing: cd $BUG && npm ci   (or rerun with --fix)"; fi
CHROME=""
for c in "/c/Program Files/Google/Chrome/Application/chrome.exe" "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
         "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "$(command -v google-chrome || true)" "$(command -v chrome || true)"; do
  [ -n "$c" ] && [ -x "$c" ] && { CHROME="$c"; break; }
done
[ -n "$CHROME" ] && ok "Chrome found for bugcheck" || warn "Chrome not found; bugcheck falls back to Playwright's chromium (slower first run)"

# 7. slug collision + game folder
SLUG_TAKEN="$(cd "$TPL" && "$PY" -c "import json,sys;print('yes' if sys.argv[1] in [g.get('id') for g in json.load(open('games.json',encoding='utf-8'))['games']] else 'no')" "$GAME" 2>/dev/null)"
case "$SLUG_TAKEN" in
  yes) bad "GameId $GAME already registered in games.json (GameId is permanent, RULES 5)" ;;
  no)  ok "GameId $GAME free in games.json" ;;
  *)   warn "could not read games.json to check GameId $GAME" ;;
esac
if [ -d "$ROOT/Games/$GAME" ]; then ok "Games/$GAME exists"
else mkdir -p "$ROOT/Games/$GAME" && ok "created Games/$GAME (empty; research.md + game.draft.json go here)"; fi

# 8. the two example games are still buildable references (reuse map, section 6)
for g in FlightHeros FallingCEO; do [ -f "$ROOT/Games/$g/src/play.ts" ] && ok "reference game $g present" || warn "reference game $g missing src/play.ts"; done

# ---- summary (paste into research.md section 13) ----
echo
echo "## 13. Preflight ($(date '+%Y-%m-%d %H:%M'), $GAME)"
for l in "${LINES[@]}"; do echo "- $l"; done
echo
echo "Next, when the slug is chosen (register on the LOCAL api before expecting board/events):"
echo "  cd $WORKER && npm run dev     # then, in another shell:"
echo "  curl -X PUT http://127.0.0.1:8787/v1/admin/games/<slug> -H \"x-admin-key: \$(grep ^ADMIN_KEY= .dev.vars | cut -d= -f2-)\" -H 'content-type: application/json' -d '{\"name\":\"<title>\",\"maxScore\":<max>,\"minDurationS\":<min>}'"
echo
echo "result: $RED red, $YEL yellow"
[ "$RED" = 0 ]
