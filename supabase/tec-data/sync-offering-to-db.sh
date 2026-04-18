#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_ROOT="$SCRIPT_DIR/data/raw"
REMAPPER="$SCRIPT_DIR/scripts/remap_offering_ids_to_db.py"
SEED_OFFERING_PATH="$SCRIPT_DIR/../seed_offering.sql"

YEAR=""
DB_URL=""
RUN_SYNC=true
RUN_MIGRATE=false
RUN_APPLY=true
KEEP_SQL=false

usage() {
  cat <<EOF
Uso:
  $(basename "$0") --year 2026 --db-url "postgresql://..." [opciones]

Opciones:
  --year <YEAR>        Año a sincronizar (requerido)
  --db-url <URL>       URL de conexión Postgres destino (requerido)
  --skip-sync          No ejecutar sync-all.sh (usa data/raw existente)
  --migrate            Ejecuta 'bunx supabase db push --db-url ...' antes de aplicar seed
  --no-apply           Genera el SQL pero no lo aplica
  --keep-sql           No elimina supabase/seed_offering.sql al final
  -h, --help           Muestra esta ayuda
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --year)
      YEAR="${2:-}"
      shift 2
      ;;
    --db-url)
      DB_URL="${2:-}"
      shift 2
      ;;
    --skip-sync)
      RUN_SYNC=false
      shift
      ;;
    --migrate)
      RUN_MIGRATE=true
      shift
      ;;
    --no-apply)
      RUN_APPLY=false
      shift
      ;;
    --keep-sql)
      KEEP_SQL=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opción desconocida: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$YEAR" || -z "$DB_URL" ]]; then
  echo "Error: --year y --db-url son requeridos."
  usage
  exit 1
fi

FILES_TO_BACKUP=(
  "professor/data.json"
  "course_offering/data.json"
  "course_offering_group/data.json"
  "course_offering_group_professor/data.json"
  "course_offering_meeting/data.json"
)

BACKUP_DIR=""
restore_backups() {
  if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" ]]; then
    return
  fi

  for rel_path in "${FILES_TO_BACKUP[@]}"; do
    local src="$BACKUP_DIR/$rel_path"
    local dst="$DATA_ROOT/$rel_path"
    if [[ -f "$src" ]]; then
      mkdir -p "$(dirname "$dst")"
      cp "$src" "$dst"
    fi
  done

  rm -rf "$BACKUP_DIR"
  BACKUP_DIR=""
}

cleanup() {
  restore_backups
  if [[ "$KEEP_SQL" = false && -f "$SEED_OFFERING_PATH" ]]; then
    rm -f "$SEED_OFFERING_PATH"
  fi
}

trap cleanup EXIT

echo "========================================================"
echo "Sync offering to DB"
echo "Year: $YEAR"
echo "Apply: $RUN_APPLY"
echo "Migrate: $RUN_MIGRATE"
echo "========================================================"

if [[ "$RUN_SYNC" = true ]]; then
  echo ">> Ejecutando sync-all.sh ($YEAR)..."
  bash "$SCRIPT_DIR/sync-all.sh" "$YEAR"
else
  echo ">> Saltando sync-all.sh (--skip-sync)"
fi

echo ">> Respaldando archivos de oferta para remap temporal..."
BACKUP_DIR="$(mktemp -d)"
for rel_path in "${FILES_TO_BACKUP[@]}"; do
  src="$DATA_ROOT/$rel_path"
  dst="$BACKUP_DIR/$rel_path"
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
done

echo ">> Remapeando IDs de oferta contra DB destino..."
python3 "$REMAPPER" --db-url "$DB_URL" --data-root "$DATA_ROOT"

echo ">> Generando seed de oferta..."
(
  cd "$SCRIPT_DIR"
  uv run tec-data sql \
    --tables professor,course_offering,course_offering_group,course_offering_group_professor,course_offering_meeting \
    --output ../seed_offering.sql
)

if [[ "$RUN_MIGRATE" = true ]]; then
  echo ">> Aplicando migraciones en DB destino..."
  (
    cd "$SCRIPT_DIR/../.."
    bunx supabase db push --db-url "$DB_URL"
  )
fi

if [[ "$RUN_APPLY" = true ]]; then
  echo ">> Aplicando seed de oferta en DB destino..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SEED_OFFERING_PATH"

  echo ">> Verificando conteos en DB destino..."
  psql "$DB_URL" -P pager=off -c "
    SELECT 'course_offering' AS table, count(*) FROM public.course_offering
    UNION ALL
    SELECT 'course_offering_group', count(*) FROM public.course_offering_group
    UNION ALL
    SELECT 'course_offering_group_professor', count(*) FROM public.course_offering_group_professor
    UNION ALL
    SELECT 'course_offering_meeting', count(*) FROM public.course_offering_meeting;
  "
fi

echo "========================================================"
echo "Proceso finalizado."
echo "========================================================"
