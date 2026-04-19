#!/bin/bash
set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Uso: $(basename "$0") <YEAR>"
  exit 1
fi

YEAR="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

bash "$SCRIPT_DIR/sync-offering-to-db.sh" \
  --year "$YEAR" \
  --db-url "$LOCAL_DB_URL" \
  --migrate
