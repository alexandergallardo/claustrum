#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <db-url> [sql-dir]"
  exit 1
fi

DB_URL="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="${2:-$SCRIPT_DIR/../data/processed/sql}"

if [[ ! -d "$SQL_DIR" ]]; then
  echo "SQL directory does not exist: $SQL_DIR"
  exit 1
fi

mapfile -t sql_files < <(ls "$SQL_DIR"/*.sql 2>/dev/null | sort)

if [[ ${#sql_files[@]} -eq 0 ]]; then
  echo "No SQL files found in $SQL_DIR"
  exit 1
fi

for sql_path in "${sql_files[@]}"; do
  sql_file="$(basename "$sql_path")"
  sql_sha="$(sha256sum "$sql_path" | awk '{print $1}')"

  already_applied="$({
    psql "$DB_URL" -At -v ON_ERROR_STOP=1 -c \
      "SELECT 1 FROM public.sync_seed_run WHERE seed_sha256 = '$sql_sha' AND status = 'applied' LIMIT 1;"
  } || true)"

  if [[ "$already_applied" == "1" ]]; then
    echo "[skip] $sql_file already applied"
    continue
  fi

  echo "[apply] $sql_file"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$sql_path"

  psql "$DB_URL" -v ON_ERROR_STOP=1 \
    -v seed_file_name="$sql_file" \
    -v seed_sha256="$sql_sha" \
    -v scope="reviews" <<'SQL'
INSERT INTO public.sync_seed_run (
  seed_file_name,
  seed_sha256,
  scope,
  years,
  term_external_keys,
  generated_at_utc,
  applied_at_utc,
  status,
  metadata
)
VALUES (
  :'seed_file_name',
  :'seed_sha256',
  :'scope',
  '{}'::integer[],
  '{}'::text[],
  NOW(),
  NOW(),
  'applied',
  '{}'::jsonb
)
ON CONFLICT (seed_sha256) DO UPDATE
SET
  seed_file_name = EXCLUDED.seed_file_name,
  scope = EXCLUDED.scope,
  applied_at_utc = NOW(),
  status = 'applied',
  error_message = NULL,
  updated_at = NOW();
SQL

  echo "[ok] $sql_file"
done

echo "Done."
