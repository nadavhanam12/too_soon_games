#!/usr/bin/env bash
# Export the production D1 database to backups/<UTC date-time>.sql (git-ignored).
# Runs at the start of /deploy-server; can also be run by hand. Requires `wrangler login`.
#   bash export.sh            # remote (production) database
#   bash export.sh --local    # the wrangler dev database
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORKER="$HERE/../worker"
OUT="$HERE/backups"
mkdir -p "$OUT"
MODE="--remote"; [ "${1:-}" = "--local" ] && MODE="--local"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILE="$OUT/toosoon-$STAMP${MODE/--/-}.sql"
cd "$WORKER"
npx wrangler d1 export toosoon $MODE --output "$FILE"
echo "backup written: $FILE ($(wc -c <"$FILE") bytes)"
# keep the last 30 files
ls -1t "$OUT"/toosoon-*.sql 2>/dev/null | tail -n +31 | xargs -r rm -f
