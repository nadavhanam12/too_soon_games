#!/usr/bin/env bash
# Stage "Drop the Chip" (FallingCEO) and push it to itch.io with butler.
# Port of GamesExamples/FlightHeros/.claude/skills/itch-upload/upload.sh: this game is one
# index.html with no build step, no npm and no git, so: stage -> static checks -> diff against
# the last upload -> bump version -> butler push -> remember what was pushed.
#
# Usage: upload.sh [--dry-run] [--no-bump]
#   --dry-run   everything except the version bump and the push
#   --no-bump   push again with the same version
set -euo pipefail

DRY=0; BUMP=1
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1; BUMP=0 ;;
    --no-bump) BUMP=0 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
OUT_DIR="dist-itch"
LAST_DIR=".itch/last-upload"
CFG="itch.json"

step() { printf '\n[itch] %s\n' "$*"; }
warn() { printf '[itch] WARNING: %s\n' "$*"; }
fail() { printf '\n[itch] FAILED: %s\n' "$*" >&2; exit 1; }
PY="$(command -v python3 || command -v python)"
cfg()  { "$PY" -c "import json,sys;print(json.load(open('$CFG')).get('$1','') or '')"; }

[ -f "$CFG" ] || fail "no $CFG - create it with {project, channel, version, pageUrl}"
ITCH_PROJECT="${ITCH_PROJECT:-$(cfg project)}"
ITCH_CHANNEL="${ITCH_CHANNEL:-$(cfg channel)}"; ITCH_CHANNEL="${ITCH_CHANNEL:-html5}"
VERSION="$(cfg version)"; VERSION="${VERSION:-0.1.0}"

# 1. butler (macOS paths first, then Windows: itch app, ~/.butler, ~/Downloads)
step "checking butler"
BUTLER=""
for p in "$HOME/Library/Application Support/itch/apps/butler/butler" "$HOME/.butler/butler" \
         /usr/local/bin/butler /opt/homebrew/bin/butler \
         "$HOME/AppData/Roaming/itch/apps/butler/butler.exe" "$HOME/.butler/butler.exe" \
         "$HOME/Downloads/butler-windows-amd64 (1)/butler.exe" "$HOME/Downloads/butler-windows-amd64/butler.exe" \
         "$HOME/Downloads/butler/butler.exe"; do
  [ -x "$p" ] && { BUTLER="$p"; break; }
done
[ -z "$BUTLER" ] && BUTLER="$(command -v butler || true)"
[ -z "$BUTLER" ] && fail "butler not found - install it from https://itch.io/docs/butler/ then run 'butler login'"
echo "butler: $BUTLER ($("$BUTLER" -V 2>&1 | cut -d, -f1))"
if [ -z "$ITCH_PROJECT" ]; then
  [ "$DRY" = 0 ] && fail "no itch page set - fill $CFG \"project\" (\"user/game-slug\") or set ITCH_PROJECT"
  echo "note: $CFG \"project\" is empty - fine for a dry run, required to push"
  ITCH_PROJECT="<project unset>"
fi
if [ "$DRY" = 0 ]; then
  "$BUTLER" status "$ITCH_PROJECT" >/dev/null 2>&1 \
    || fail "butler can't see $ITCH_PROJECT - not logged in ('butler login'), or the itch page doesn't exist yet"
fi

# 2. stage: the page + whatever assets it loads (audio/ is optional - the game tolerates missing tracks)
step "staging $OUT_DIR"
rm -rf "$OUT_DIR"; mkdir -p "$OUT_DIR"
cp index.html "$OUT_DIR/"
[ -d audio ] && cp -R audio "$OUT_DIR/audio" && echo "audio/: $(ls audio | wc -l | tr -d ' ') files"

# 3. static checks against itch's HTML rules and the iframe it runs in
step "checking the page"
grep -q '<meta charset="utf-8">' "$OUT_DIR/index.html" || fail 'no <meta charset="utf-8"> - Hebrew text is garbled on itch'
grep -q 'name="viewport"' "$OUT_DIR/index.html" || fail 'no viewport meta - phones render the page zoomed out'
grep -qE '(src|href)="/[^/]' "$OUT_DIR/index.html" && fail "root-absolute asset path (would 404 on itch, which serves from a sub-folder)"
grep -qE 'window\.(top|parent)\b|parent\.document|top\.location' "$OUT_DIR/index.html" && fail "touches the parent frame - itch's host page is cross-origin, this throws"
grep -qE 'localhost|127\.0\.0\.1' "$OUT_DIR/index.html" && warn "localhost reference in the page - dead on itch"
grep -qE "<script[^>]*src=\"https?://" "$OUT_DIR/index.html" && warn "external script - check it allows loading from itch.zone"
grep -q "const PUBLIC_URL='';" "$OUT_DIR/index.html" && warn "PUBLIC_URL is empty - the share text will contain the itch.zone iframe address, not the game page. Set it to $CFG pageUrl ($(cfg pageUrl))"
grep -q "const WA_GROUP='';" "$OUT_DIR/index.html" && warn "WA_GROUP is empty - the 'join the WhatsApp group' line stays hidden"
# every relative file the page references must exist in the staged folder
MISSING=0
for f in $(grep -oE "(src|href)=\"[^\"#:]+\"" "$OUT_DIR/index.html" | sed -E 's/^[a-z]+="//; s/"$//' | sort -u); do
  [ -e "$OUT_DIR/$f" ] || { echo "  missing: $f"; MISSING=1; }
done
[ "$MISSING" = 1 ] && fail "the page references files that aren't staged"
FILES="$(find "$OUT_DIR" -type f | wc -l | tr -d ' ')"
SIZE="$(du -sh "$OUT_DIR" | cut -f1)"
[ "$FILES" -le 1000 ] || fail "$FILES files - itch allows at most 1000 in an HTML upload"
echo "ok: $FILES files, $SIZE"

# 4. what changed since the last push (no git here: the last pushed tree is kept in $LAST_DIR)
step "changes since the last upload"
if [ -d "$LAST_DIR" ]; then
  diff -ru "$LAST_DIR" "$OUT_DIR" > dist-itch.changes.diff && echo "no changes since the last upload (v$(cat "$LAST_DIR/.version" 2>/dev/null || echo '?'))" \
    || { echo "changed vs v$(cat "$LAST_DIR/.version" 2>/dev/null || echo '?'): +$(grep -c '^+[^+]' dist-itch.changes.diff) / -$(grep -c '^-[^-]' dist-itch.changes.diff) lines"; \
         grep -E '^(Only in|diff -ru)' dist-itch.changes.diff | sed 's/^/  /' | head -20; echo "full diff: dist-itch.changes.diff"; }
else
  echo "no previous upload recorded ($LAST_DIR) - first upload"
fi

# 5. version bump (itch.json patch) - mirrors the Unity tool's IncrementPatchVersion()
if [ "$BUMP" = 1 ]; then
  OLD="$VERSION"
  VERSION="$("$PY" - "$CFG" <<'PY'
import json,sys
p=sys.argv[1]; c=json.load(open(p))
a=(c.get('version') or '0.1.0').split('.'); a=[int(x) for x in a]+[0]*(3-len(a)); a[2]+=1
c['version']='.'.join(map(str,a[:3])); json.dump(c,open(p,'w'),indent=2,ensure_ascii=False); open(p,'a').write('\n'); print(c['version'])
PY
)"
  echo "version bumped: $OLD -> $VERSION"
fi

# 6. push
if [ "$DRY" = 1 ]; then
  step "dry run - not pushing. Would run:"
  echo "  $BUTLER push $OUT_DIR $ITCH_PROJECT:$ITCH_CHANNEL --userversion $VERSION"
  exit 0
fi
step "butler push $OUT_DIR $ITCH_PROJECT:$ITCH_CHANNEL (v$VERSION)"
"$BUTLER" push "$OUT_DIR" "$ITCH_PROJECT:$ITCH_CHANNEL" --userversion "$VERSION" || fail "butler push failed"
"$BUTLER" status "$ITCH_PROJECT:$ITCH_CHANNEL" || true
rm -rf "$LAST_DIR"; mkdir -p "$(dirname "$LAST_DIR")"; cp -R "$OUT_DIR" "$LAST_DIR"; echo "$VERSION" > "$LAST_DIR/.version"
step "done - $ITCH_PROJECT:$ITCH_CHANNEL v$VERSION (snapshot kept in $LAST_DIR)"
