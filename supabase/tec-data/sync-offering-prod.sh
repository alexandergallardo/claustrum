#!/bin/bash
set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Uso: $(basename "$0") <YEAR>"
  exit 1
fi

YEAR="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE"
  exit 1
fi

set -a
source <(sed 's/\r$//' "$ENV_FILE")
set +a

if [[ -z "${VITE_SUPABASE_URL:-}" || -z "${SUPABASE_PASSWORD:-}" ]]; then
  echo "Faltan VITE_SUPABASE_URL o SUPABASE_PASSWORD en $ENV_FILE"
  exit 1
fi

PROJECT_REF="$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\.supabase\.co#\1#')"
DB_URL="postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"

bash "$SCRIPT_DIR/sync-offering-to-db.sh" \
  --year "$YEAR" \
  --db-url "$DB_URL" \
  --migrate
