"""Unified sync command for full catalog + offering synchronization."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import typer

from src.commands.download import download
from src.commands.process import run_process
from src.commands.sql import format_value

LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SYNC_TABLES = [
    "country",
    "university",
    "campus",
    "academic_unit",
    "academic_modality",
    "academic_term",
    "academic_unit_campus",
    "study_plan",
    "study_plan_campus",
    "study_plan_level",
    "course",
    "study_plan_level_course",
    "course_relation",
    "professor",
    "course_offering",
    "course_offering_group",
    "course_offering_group_professor",
    "course_offering_meeting",
]

OFFERING_TABLES = {
    "course_offering",
    "course_offering_group",
    "course_offering_group_professor",
    "course_offering_meeting",
}

TABLE_CONFLICT_COLUMNS: dict[str, list[str]] = {
    "country": ["iso2_code"],
    "university": ["id"],
    "campus": ["code"],
    "academic_unit": ["code"],
    "academic_modality": ["code"],
    "academic_term": ["external_key"],
    "academic_unit_campus": ["academic_unit_id", "campus_id"],
    "study_plan": ["academic_unit_id", "external_plan_id"],
    "study_plan_campus": ["study_plan_id", "campus_id"],
    "study_plan_level": ["study_plan_id", "level_number"],
    "course": ["code"],
    "study_plan_level_course": ["study_plan_level_id", "course_id"],
    "course_relation": ["study_plan_id", "from_course_id", "to_course_id", "relation_type"],
    "professor": ["full_name"],
    "course_offering": ["course_id", "campus_id", "academic_unit_id", "academic_term_id"],
    "course_offering_group": ["course_offering_id", "group_code"],
    "course_offering_group_professor": ["course_offering_group_id", "professor_id"],
    "course_offering_meeting": ["course_offering_group_id", "weekday", "starts_at", "ends_at"],
}


def deterministic_id(namespace: str, *parts: object) -> int:
    """Build a stable positive BIGINT-compatible identifier."""
    raw = f"{namespace}|" + "|".join(str(part).strip().upper() for part in parts)
    digest = hashlib.blake2b(raw.encode("utf-8"), digest_size=8).digest()
    identifier = int.from_bytes(digest, "big") & ((1 << 63) - 1)
    return identifier or 1


def query_rows(db_url: str, sql: str) -> list[str]:
    output = subprocess.check_output(
        ["psql", db_url, "-At", "-F", "\t", "-c", sql],
        text=True,
    )
    return [line for line in output.splitlines() if line.strip()]


def quote_literal(value: str) -> str:
    return value.replace("'", "''")


def sql_int_array(values: list[int]) -> str:
    if not values:
        return "ARRAY[]::INTEGER[]"
    return "ARRAY[" + ", ".join(str(v) for v in values) + "]::INTEGER[]"


def sql_text_array(values: list[str]) -> str:
    if not values:
        return "ARRAY[]::TEXT[]"
    escaped = ", ".join(f"'{quote_literal(v)}'" for v in values)
    return f"ARRAY[{escaped}]::TEXT[]"


def seed_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_sync_fingerprint(data_dir: Path, tables: list[str]) -> str:
    hasher = hashlib.sha256()
    for table in tables:
        data_path = data_dir / table / "data.json"
        if not data_path.exists():
            continue
        payload = load_json(data_path)
        canonical_rows = sorted(canonical_json(row) for row in payload)
        hasher.update(table.encode("utf-8"))
        hasher.update(b"\n")
        for row in canonical_rows:
            hasher.update(row.encode("utf-8"))
            hasher.update(b"\n")
    return hasher.hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))


def load_json(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text())


def collect_term_external_keys(data_dir: Path, years: list[int]) -> list[str]:
    term_path = data_dir / "academic_term" / "data.json"
    if not term_path.exists():
        return []
    terms = load_json(term_path)
    year_set = set(years)
    return sorted(
        {
            str(term["external_key"])
            for term in terms
            if int(term.get("year", 0)) in year_set and term.get("external_key")
        }
    )


def build_db_url_from_env(env_file: Path) -> str:
    env_content = env_file.read_text()
    match_url = re.search(r"^VITE_SUPABASE_URL=(.+)$", env_content, flags=re.M)
    match_password = re.search(r"^SUPABASE_PASSWORD=(.+)$", env_content, flags=re.M)
    if not match_url or not match_password:
        raise ValueError(
            f"Missing VITE_SUPABASE_URL or SUPABASE_PASSWORD in {env_file}"
        )

    supabase_url = match_url.group(1).strip()
    password = match_password.group(1).strip()
    project_ref = re.sub(r"^https://([^.]+)\.supabase\.co$", r"\1", supabase_url)
    return (
        f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:5432/"
        "postgres?sslmode=require"
    )


def resolve_db_url(target: str, db_url: str | None, env_file: Path) -> str:
    if target == "local":
        return LOCAL_DB_URL
    if target == "remote":
        return build_db_url_from_env(env_file)
    if not db_url:
        raise ValueError("--db-url is required when --target=db-url")
    return db_url


def infer_environment_id(db_url: str) -> str:
    parsed = urlparse(db_url)
    host = parsed.hostname or "unknown-host"
    db_name = (parsed.path or "/postgres").lstrip("/") or "postgres"
    project_ref = ""
    match = re.match(r"^db\.([^.]+)\.supabase\.co$", host)
    if match:
        project_ref = match.group(1)
    if project_ref:
        return f"{project_ref}|{host}|{db_name}"
    return f"{host}|{db_name}"


def parse_seed_metadata(seed_path: Path) -> dict[str, str]:
    metadata: dict[str, str] = {}
    with seed_path.open(encoding="utf-8") as handle:
        for _ in range(80):
            line = handle.readline()
            if not line:
                break
            if not line.startswith("-- TEC-DATA-META "):
                continue
            payload = line.removeprefix("-- TEC-DATA-META ").strip()
            if "=" not in payload:
                continue
            key, value = payload.split("=", 1)
            metadata[key.strip()] = value.strip()
    return metadata


def normalize_for_compare(value: Any, value_type: str) -> Any:
    if value is None:
        return None
    if value_type in {"INTEGER", "BIGINT", "SMALLINT"}:
        return int(value)
    if value_type == "BOOLEAN":
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in {"t", "true", "1"}
    return str(value)


def load_existing_rows_by_id(
    db_url: str,
    table: str,
    columns: list[str],
    column_types: dict[str, str],
) -> dict[int, dict[str, Any]]:
    query_columns = ", ".join(columns)
    output = subprocess.check_output(
        [
            "psql",
            db_url,
            "-At",
            "-F",
            "\t",
            "-P",
            "null=\\N",
            "-c",
            f"SELECT {query_columns} FROM public.{table}",
        ],
        text=True,
    )
    rows: dict[int, dict[str, Any]] = {}
    for line in output.splitlines():
        if not line.strip():
            continue
        values = line.split("\t")
        row: dict[str, Any] = {}
        for index, col in enumerate(columns):
            raw = values[index] if index < len(values) else "\\N"
            value = None if raw == "\\N" else raw
            row[col] = normalize_for_compare(value, column_types.get(col, "TEXT"))
        rows[int(row["id"])] = row
    return rows


def pg_type_to_generic(data_type: str, udt_name: str) -> str:
    dt = (data_type or "").lower()
    udt = (udt_name or "").lower()
    if dt in {"bigint", "integer", "smallint"}:
        return dt.upper()
    if dt in {"numeric", "real", "double precision", "decimal"}:
        return "NUMERIC"
    if dt == "boolean":
        return "BOOLEAN"
    if dt == "date":
        return "DATE"
    if dt == "time without time zone":
        return "TIME"
    if dt in {"timestamp with time zone", "timestamp without time zone"}:
        return "TIMESTAMPTZ"
    if dt == "uuid":
        return "UUID"
    if dt == "user-defined" and udt:
        return "TEXT"
    return "TEXT"


def get_table_schema(db_url: str, table: str) -> tuple[list[str], dict[str, str], set[str]]:
    sql = f"""
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '{quote_literal(table)}'
    ORDER BY ordinal_position;
    """
    rows = query_rows(db_url, sql)
    if not rows:
        raise RuntimeError(f"Table public.{table} not found while introspecting schema")
    columns: list[str] = []
    column_types: dict[str, str] = {}
    column_set: set[str] = set()
    for row in rows:
        col_name, data_type, udt_name = row.split("\t")
        columns.append(col_name)
        column_set.add(col_name)
        column_types[col_name] = pg_type_to_generic(data_type, udt_name)
    return columns, column_types, column_set


def build_insert_statement(
    table: str,
    rows: list[dict[str, Any]],
    columns: list[str],
    column_types: dict[str, str],
    available_columns: set[str],
) -> list[str]:
    if not rows:
        return []
    lines = [f"INSERT INTO public.{table}", f"  ({', '.join(columns)})", "VALUES"]
    values_lines: list[str] = []
    for row in rows:
        formatted = [format_value(row.get(col), column_types.get(col, "TEXT")) for col in columns]
        values_lines.append(f"  ({', '.join(formatted)})")
    conflict_columns = TABLE_CONFLICT_COLUMNS.get(table, ["id"])
    updatable = [col for col in columns if col not in set(conflict_columns)]
    lines.append(",\n".join(values_lines))
    if updatable:
        update_sql = ", ".join(f"{col} = EXCLUDED.{col}" for col in updatable)
        lifecycle = []
        if "is_active" in available_columns and "is_active" not in columns:
            lifecycle.append("is_active = TRUE")
        if "deactivated_at" in available_columns and "deactivated_at" not in columns:
            lifecycle.append("deactivated_at = NULL")
        if "updated_at" in available_columns and "updated_at" not in columns:
            lifecycle.append("updated_at = NOW()")
        if lifecycle:
            update_sql = ", ".join([update_sql, *lifecycle])
        lines.append(f"ON CONFLICT ({', '.join(conflict_columns)}) DO UPDATE SET {update_sql};")
    else:
        lines.append(f"ON CONFLICT ({', '.join(conflict_columns)}) DO NOTHING;")
    return lines


def write_noop_seed(
    output_path: Path,
    environment_id: str,
    years: list[int],
    term_external_keys: list[str],
    fingerprint: str,
    scope: str,
) -> tuple[Path, dict[str, dict[str, int]]]:
    lines = [
        "-- ============================================================================",
        "-- TEC-DATA DELTA SEED (NOOP)",
        "-- ============================================================================",
        f"-- TEC-DATA-META environment_id={environment_id}",
        f"-- TEC-DATA-META scope={scope}",
        f"-- TEC-DATA-META years={','.join(str(y) for y in sorted(set(years)))}",
        f"-- TEC-DATA-META term_external_keys={','.join(sorted(set(term_external_keys)))}",
        f"-- TEC-DATA-META data_fingerprint={fingerprint}",
        f"-- TEC-DATA-META generated_at_utc={datetime.now(UTC).isoformat()}",
        "",
        "BEGIN;",
        "-- NOOP: no row-level changes detected for selected scope",
        "COMMIT;",
        "",
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    stats = {table: {"inserted": 0, "updated": 0, "soft_deleted": 0} for table in SYNC_TABLES}
    return output_path, stats


def build_update_statement(
    table: str,
    row: dict[str, Any],
    changed_columns: Iterable[str],
    column_types: dict[str, str],
    available_columns: set[str],
) -> str:
    assignments = ", ".join(
        f"{column} = {format_value(row.get(column), column_types.get(column, 'TEXT'))}"
        for column in changed_columns
    )
    lifecycle: list[str] = []
    if "is_active" in available_columns:
        lifecycle.append("is_active = TRUE")
    if "deactivated_at" in available_columns:
        lifecycle.append("deactivated_at = NULL")
    if "updated_at" in available_columns:
        lifecycle.append("updated_at = NOW()")
    all_assignments = ", ".join([assignments, *lifecycle]) if lifecycle else assignments
    return f"UPDATE public.{table} SET {all_assignments} WHERE id = {int(row['id'])};"


def payload_row_normalized(
    row: dict[str, Any],
    columns: list[str],
    column_types: dict[str, str],
) -> dict[str, Any]:
    return {
        col: normalize_for_compare(row.get(col), column_types.get(col, "TEXT"))
        for col in columns
    }


def generate_minimal_delta_seed(
    db_url: str,
    data_dir: Path,
    output_path: Path,
    years: list[int],
    term_external_keys: list[str],
    environment_id: str,
    fingerprint: str,
    scope: str = "mixed",
) -> tuple[Path, dict[str, dict[str, int]], bool]:
    term_ids = {
        int(row["id"])
        for row in load_json(data_dir / "academic_term" / "data.json")
        if int(row.get("year", 0)) in set(years)
    }
    lines: list[str] = [
        "-- ============================================================================",
        "-- TEC-DATA DELTA SEED",
        "-- ============================================================================",
        f"-- TEC-DATA-META environment_id={environment_id}",
        f"-- TEC-DATA-META scope={scope}",
        f"-- TEC-DATA-META years={','.join(str(y) for y in sorted(set(years)))}",
        f"-- TEC-DATA-META term_external_keys={','.join(sorted(set(term_external_keys)))}",
        f"-- TEC-DATA-META data_fingerprint={fingerprint}",
        f"-- TEC-DATA-META generated_at_utc={datetime.now(UTC).isoformat()}",
        "",
        "BEGIN;",
        "SET LOCAL TIME ZONE 'UTC';",
    ]

    table_stats: dict[str, dict[str, int]] = {}

    for table in SYNC_TABLES:
        db_columns, db_column_types, db_column_set = get_table_schema(db_url, table)
        payload_path = data_dir / table / "data.json"
        payload_rows = load_json(payload_path) if payload_path.exists() else []
        payload_columns = sorted({key for row in payload_rows for key in row.keys()})
        columns = [col for col in db_columns if col in payload_columns]
        if "id" not in columns and "id" in db_column_set:
            columns = ["id", *columns]
        if not columns:
            table_stats[table] = {"inserted": 0, "updated": 0, "soft_deleted": 0}
            continue

        column_types = {col: db_column_types.get(col, "TEXT") for col in columns}
        normalized_payload = {
            int(row["id"]): payload_row_normalized(row, columns, column_types)
            for row in payload_rows
            if row.get("id") is not None
        }
        existing_rows = load_existing_rows_by_id(db_url, table, columns, column_types)

        insert_rows: list[dict[str, Any]] = []
        update_rows: list[str] = []

        for row_id, normalized_row in normalized_payload.items():
            current = existing_rows.get(row_id)
            if current is None:
                insert_rows.append(normalized_row)
                continue
            changed_columns = [
                col
                for col in columns
                if col != "id" and normalize_for_compare(current.get(col), column_types.get(col, "TEXT"))
                != normalize_for_compare(normalized_row.get(col), column_types.get(col, "TEXT"))
            ]
            if changed_columns:
                update_rows.append(
                    build_update_statement(
                        table,
                        normalized_row,
                        changed_columns,
                        column_types,
                        db_column_set,
                    )
                )

        stale_ids = sorted(set(existing_rows.keys()) - set(normalized_payload.keys()))
        soft_delete_statements: list[str] = []
        if stale_ids:
            stale_ids_literal = ", ".join(str(value) for value in stale_ids)
            if table in OFFERING_TABLES:
                if table == "course_offering":
                    soft_delete_statements.append(
                        "UPDATE public.course_offering "
                        "SET is_active = FALSE, deactivated_at = NOW(), updated_at = NOW() "
                        f"WHERE id = ANY(ARRAY[{stale_ids_literal}]::BIGINT[]) "
                        f"AND academic_term_id = ANY(ARRAY[{', '.join(str(t) for t in sorted(term_ids))}]::BIGINT[]);"
                    )
                elif table == "course_offering_group":
                    soft_delete_statements.append(
                        "UPDATE public.course_offering_group g "
                        "SET is_active = FALSE, deactivated_at = NOW(), updated_at = NOW() "
                        f"WHERE g.id = ANY(ARRAY[{stale_ids_literal}]::BIGINT[]) "
                        "AND EXISTS (SELECT 1 FROM public.course_offering co "
                        "WHERE co.id = g.course_offering_id "
                        f"AND co.academic_term_id = ANY(ARRAY[{', '.join(str(t) for t in sorted(term_ids))}]::BIGINT[]));"
                    )
                elif table == "course_offering_group_professor":
                    soft_delete_statements.append(
                        "UPDATE public.course_offering_group_professor gp "
                        "SET is_active = FALSE, deactivated_at = NOW(), updated_at = NOW() "
                        f"WHERE gp.id = ANY(ARRAY[{stale_ids_literal}]::BIGINT[]) "
                        "AND EXISTS (SELECT 1 FROM public.course_offering_group g "
                        "JOIN public.course_offering co ON co.id = g.course_offering_id "
                        "WHERE g.id = gp.course_offering_group_id "
                        f"AND co.academic_term_id = ANY(ARRAY[{', '.join(str(t) for t in sorted(term_ids))}]::BIGINT[]));"
                    )
                elif table == "course_offering_meeting":
                    soft_delete_statements.append(
                        "UPDATE public.course_offering_meeting m "
                        "SET is_active = FALSE, deactivated_at = NOW(), updated_at = NOW() "
                        f"WHERE m.id = ANY(ARRAY[{stale_ids_literal}]::BIGINT[]) "
                        "AND EXISTS (SELECT 1 FROM public.course_offering_group g "
                        "JOIN public.course_offering co ON co.id = g.course_offering_id "
                        "WHERE g.id = m.course_offering_group_id "
                        f"AND co.academic_term_id = ANY(ARRAY[{', '.join(str(t) for t in sorted(term_ids))}]::BIGINT[]));"
                    )
            elif scope != "offering":
                soft_delete_statements.append(
                    f"UPDATE public.{table} "
                    "SET is_active = FALSE, deactivated_at = NOW(), updated_at = NOW() "
                    f"WHERE id = ANY(ARRAY[{stale_ids_literal}]::BIGINT[]);"
                )

        table_stats[table] = {
            "inserted": len(insert_rows),
            "updated": len(update_rows),
            "soft_deleted": len(soft_delete_statements),
        }

        if insert_rows or update_rows or soft_delete_statements:
            lines.append("")
            lines.append(f"-- table: {table}")
            if insert_rows:
                lines.extend(
                    build_insert_statement(
                        table,
                        insert_rows,
                        columns,
                        column_types,
                        db_column_set,
                    )
                )
            lines.extend(update_rows)
            lines.extend(soft_delete_statements)

    has_changes = any(
        stats["inserted"] > 0 or stats["updated"] > 0 or stats["soft_deleted"] > 0
        for stats in table_stats.values()
    )
    if not has_changes:
        lines.append("")
        lines.append("-- NOOP: no row-level changes detected for selected scope")

    lines.extend(["", "COMMIT;", ""])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    return output_path, table_stats, not has_changes


def run_sync_pipeline(data_dir: Path, years: list[int], skip_download: bool = False) -> None:
    year_list = sorted(set(years))

    if not skip_download:
        download(output_dir=data_dir)
    run_process(data_dir=data_dir, entity="campus")
    run_process(data_dir=data_dir, entity="academic_unit")
    run_process(data_dir=data_dir, entity="academic_period", years=year_list)

    if not skip_download:
        download(output_dir=data_dir, entity="study_plan")
    run_process(data_dir=data_dir, entity="study_plan")

    merged_offerings: dict[int, dict[str, Any]] = {}
    merged_groups: dict[int, dict[str, Any]] = {}
    merged_group_professors: dict[int, dict[str, Any]] = {}
    merged_meetings: dict[int, dict[str, Any]] = {}
    merged_professors: dict[int, dict[str, Any]] = {}

    for year in year_list:
        year_str = str(year)
        if not skip_download:
            download(output_dir=data_dir, entity="course_offer", year=year_str)
            download(output_dir=data_dir, entity="schedule_guia", year=year_str)
        run_process(data_dir=data_dir, entity="course_offering", years=[year])

        offerings = load_json(data_dir / "course_offering" / "data.json")
        groups = load_json(data_dir / "course_offering_group" / "data.json")
        group_professors = load_json(
            data_dir / "course_offering_group_professor" / "data.json"
        )
        meetings = load_json(data_dir / "course_offering_meeting" / "data.json")
        professors = load_json(data_dir / "professor" / "data.json")

        merged_offerings.update({int(r["id"]): r for r in offerings})
        merged_groups.update({int(r["id"]): r for r in groups})
        merged_group_professors.update({int(r["id"]): r for r in group_professors})
        merged_meetings.update({int(r["id"]): r for r in meetings})
        merged_professors.update({int(r["id"]): r for r in professors})

    write_json(
        data_dir / "course_offering" / "data.json",
        list(merged_offerings.values()),
    )
    write_json(
        data_dir / "course_offering_group" / "data.json",
        list(merged_groups.values()),
    )
    write_json(
        data_dir / "course_offering_group_professor" / "data.json",
        list(merged_group_professors.values()),
    )
    write_json(
        data_dir / "course_offering_meeting" / "data.json",
        list(merged_meetings.values()),
    )
    write_json(data_dir / "professor" / "data.json", list(merged_professors.values()))


def backup_data_files(data_dir: Path, tables: list[str]) -> Path:
    backup_dir = Path(tempfile.mkdtemp(prefix="tec-data-sync-"))
    for table in tables:
        src = data_dir / table / "data.json"
        if not src.exists():
            continue
        dst = backup_dir / table / "data.json"
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    return backup_dir


def restore_data_files(data_dir: Path, backup_dir: Path) -> None:
    for table_dir in backup_dir.iterdir():
        src = table_dir / "data.json"
        if not src.exists():
            continue
        dst = data_dir / table_dir.name / "data.json"
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def remap_all_ids_to_db(db_url: str, data_dir: Path) -> None:
    tables = {table: load_json(data_dir / table / "data.json") for table in SYNC_TABLES}

    countries = tables["country"]
    universities = tables["university"]
    campuses = tables["campus"]
    units = tables["academic_unit"]
    modalities = tables["academic_modality"]
    terms = tables["academic_term"]
    unit_campus = tables["academic_unit_campus"]
    study_plans = tables["study_plan"]
    study_plan_campus = tables["study_plan_campus"]
    study_plan_levels = tables["study_plan_level"]
    courses = tables["course"]
    level_courses = tables["study_plan_level_course"]
    course_relations = tables["course_relation"]
    professors = tables["professor"]
    offerings = tables["course_offering"]
    groups = tables["course_offering_group"]
    group_professors = tables["course_offering_group_professor"]
    meetings = tables["course_offering_meeting"]

    local_country_by_id = {int(r["id"]): r for r in countries}
    local_university_by_id = {int(r["id"]): r for r in universities}
    local_campus_by_id = {int(r["id"]): r for r in campuses}
    local_unit_by_id = {int(r["id"]): r for r in units}
    local_modality_by_id = {int(r["id"]): r for r in modalities}
    local_term_by_id = {int(r["id"]): r for r in terms}
    local_course_by_id = {int(r["id"]): r for r in courses}
    local_professor_by_id = {int(r["id"]): r for r in professors}

    country_by_iso = {
        key: int(pid)
        for pid, key in (
            line.split("\t", 1)
            for line in query_rows(db_url, "SELECT id, iso2_code FROM public.country")
        )
    }
    university_by_short_name = {
        key: int(pid)
        for pid, key in (
            line.split("\t", 1)
            for line in query_rows(db_url, "SELECT id, short_name FROM public.university")
        )
    }
    campus_by_code = {
        key: int(pid)
        for pid, key in (
            line.split("\t", 1)
            for line in query_rows(db_url, "SELECT id, code FROM public.campus")
        )
    }
    unit_by_code = {
        key: int(pid)
        for pid, key in (
            line.split("\t", 1)
            for line in query_rows(db_url, "SELECT id, code FROM public.academic_unit")
        )
    }
    modality_by_code = {
        key: int(pid)
        for pid, key in (
            line.split("\t", 1)
            for line in query_rows(db_url, "SELECT id, code FROM public.academic_modality")
        )
    }
    term_by_external_key = {
        key: int(pid)
        for pid, key in (
            line.split("\t", 1)
            for line in query_rows(
                db_url, "SELECT id, external_key FROM public.academic_term"
            )
        )
    }
    course_by_code = {
        key: int(pid)
        for pid, key in (
            line.split("\t", 1)
            for line in query_rows(db_url, "SELECT id, code FROM public.course")
        )
    }
    professor_by_name = {
        key: int(pid)
        for pid, key in (
            line.split("\t", 1)
            for line in query_rows(db_url, "SELECT id, full_name FROM public.professor")
        )
    }

    study_plan_by_key: dict[tuple[str, int], int] = {}
    for line in query_rows(
        db_url,
        """
        SELECT sp.id, au.code, sp.external_plan_id
        FROM public.study_plan sp
        JOIN public.academic_unit au ON au.id = sp.academic_unit_id
        """,
    ):
        pid, unit_code, external_plan_id = line.split("\t")
        study_plan_by_key[(unit_code, int(external_plan_id))] = int(pid)

    study_plan_level_by_key: dict[tuple[str, int, int], int] = {}
    for line in query_rows(
        db_url,
        """
        SELECT spl.id, au.code, sp.external_plan_id, spl.level_number
        FROM public.study_plan_level spl
        JOIN public.study_plan sp ON sp.id = spl.study_plan_id
        JOIN public.academic_unit au ON au.id = sp.academic_unit_id
        """,
    ):
        pid, unit_code, external_plan_id, level_number = line.split("\t")
        study_plan_level_by_key[(unit_code, int(external_plan_id), int(level_number))] = int(
            pid
        )

    offering_by_key: dict[tuple[str, str, str, str], int] = {}
    for line in query_rows(
        db_url,
        """
        SELECT co.id, c.code, cp.code, au.code, at.external_key
        FROM public.course_offering co
        JOIN public.course c ON c.id = co.course_id
        JOIN public.campus cp ON cp.id = co.campus_id
        JOIN public.academic_unit au ON au.id = co.academic_unit_id
        JOIN public.academic_term at ON at.id = co.academic_term_id
        """,
    ):
        pid, course_code, campus_code, unit_code, external_key = line.split("\t")
        offering_by_key[(course_code, campus_code, unit_code, external_key)] = int(pid)

    group_by_key: dict[tuple[str, str, str, str, str], int] = {}
    for line in query_rows(
        db_url,
        """
        SELECT g.id, c.code, cp.code, au.code, at.external_key, g.group_code
        FROM public.course_offering_group g
        JOIN public.course_offering co ON co.id = g.course_offering_id
        JOIN public.course c ON c.id = co.course_id
        JOIN public.campus cp ON cp.id = co.campus_id
        JOIN public.academic_unit au ON au.id = co.academic_unit_id
        JOIN public.academic_term at ON at.id = co.academic_term_id
        """,
    ):
        pid, course_code, campus_code, unit_code, external_key, group_code = line.split(
            "\t"
        )
        group_by_key[(course_code, campus_code, unit_code, external_key, group_code)] = int(
            pid
        )

    country_old_to_new: dict[int, int] = {}
    university_old_to_new: dict[int, int] = {}
    campus_old_to_new: dict[int, int] = {}
    unit_old_to_new: dict[int, int] = {}
    modality_old_to_new: dict[int, int] = {}
    term_old_to_new: dict[int, int] = {}
    course_old_to_new: dict[int, int] = {}
    professor_old_to_new: dict[int, int] = {}
    study_plan_old_to_new: dict[int, int] = {}
    study_plan_level_old_to_new: dict[int, int] = {}
    offering_old_to_new: dict[int, int] = {}
    group_old_to_new: dict[int, int] = {}

    study_plan_old_to_key: dict[int, tuple[str, int]] = {}
    for row in study_plans:
        old_unit_id = int(row["academic_unit_id"])
        unit_code = str(local_unit_by_id[old_unit_id]["code"])
        external_plan_id = int(row["external_plan_id"])
        study_plan_old_to_key[int(row["id"])] = (unit_code, external_plan_id)

    offering_old_to_key: dict[int, tuple[str, str, str, str]] = {}
    for row in offerings:
        course_code = str(local_course_by_id[int(row["course_id"])]["code"])
        campus_code = str(local_campus_by_id[int(row["campus_id"])]["code"])
        unit_code = str(local_unit_by_id[int(row["academic_unit_id"])]["code"])
        external_key = str(local_term_by_id[int(row["academic_term_id"])]["external_key"])
        offering_old_to_key[int(row["id"])] = (
            course_code,
            campus_code,
            unit_code,
            external_key,
        )

    group_old_to_key: dict[int, tuple[str, str, str, str, str]] = {}
    for row in groups:
        old_offering_id = int(row["course_offering_id"])
        course_code, campus_code, unit_code, external_key = offering_old_to_key[
            old_offering_id
        ]
        group_old_to_key[int(row["id"])] = (
            course_code,
            campus_code,
            unit_code,
            external_key,
            str(row["group_code"]),
        )

    for row in countries:
        old_id = int(row["id"])
        key = str(row["iso2_code"])
        new_id = country_by_iso.get(key) or deterministic_id("country", key)
        row["id"] = new_id
        country_old_to_new[old_id] = new_id

    for row in universities:
        old_id = int(row["id"])
        key = str(row["short_name"])
        row["country_id"] = country_old_to_new[int(row["country_id"])]
        new_id = university_by_short_name.get(key) or deterministic_id("university", key)
        row["id"] = new_id
        university_old_to_new[old_id] = new_id

    for row in campuses:
        old_id = int(row["id"])
        key = str(row["code"])
        row["university_id"] = university_old_to_new[int(row["university_id"])]
        new_id = campus_by_code.get(key) or deterministic_id("campus", key)
        row["id"] = new_id
        campus_old_to_new[old_id] = new_id

    for row in units:
        old_id = int(row["id"])
        key = str(row["code"])
        row["university_id"] = university_old_to_new[int(row["university_id"])]
        new_id = unit_by_code.get(key) or deterministic_id("academic_unit", key)
        row["id"] = new_id
        unit_old_to_new[old_id] = new_id

    for row in modalities:
        old_id = int(row["id"])
        key = str(row["code"])
        new_id = modality_by_code.get(key) or deterministic_id("academic_modality", key)
        row["id"] = new_id
        modality_old_to_new[old_id] = new_id

    for row in terms:
        old_id = int(row["id"])
        key = str(row["external_key"])
        row["academic_modality_id"] = modality_old_to_new[int(row["academic_modality_id"])]
        new_id = term_by_external_key.get(key) or deterministic_id("academic_term", key)
        row["id"] = new_id
        term_old_to_new[old_id] = new_id

    for row in courses:
        old_id = int(row["id"])
        key = str(row["code"])
        new_id = course_by_code.get(key) or deterministic_id("course", key)
        row["id"] = new_id
        course_old_to_new[old_id] = new_id

    for row in professors:
        old_id = int(row["id"])
        key = str(row["full_name"])
        new_id = professor_by_name.get(key) or deterministic_id("professor", key)
        row["id"] = new_id
        professor_old_to_new[old_id] = new_id

    for row in unit_campus:
        row["academic_unit_id"] = unit_old_to_new[int(row["academic_unit_id"])]
        row["campus_id"] = campus_old_to_new[int(row["campus_id"])]
        row["id"] = deterministic_id(
            "academic_unit_campus", row["academic_unit_id"], row["campus_id"]
        )

    for row in study_plans:
        old_id = int(row["id"])
        unit_code, external_plan_id = study_plan_old_to_key[old_id]
        row["academic_unit_id"] = unit_old_to_new[int(row["academic_unit_id"])]
        row["academic_modality_id"] = modality_old_to_new[int(row["academic_modality_id"])]
        new_id = study_plan_by_key.get((unit_code, external_plan_id)) or deterministic_id(
            "study_plan", unit_code, external_plan_id
        )
        row["id"] = new_id
        study_plan_old_to_new[old_id] = new_id

    for row in study_plan_campus:
        row["study_plan_id"] = study_plan_old_to_new[int(row["study_plan_id"])]
        row["campus_id"] = campus_old_to_new[int(row["campus_id"])]
        row["id"] = deterministic_id(
            "study_plan_campus", row["study_plan_id"], row["campus_id"]
        )

    for row in study_plan_levels:
        old_id = int(row["id"])
        old_plan_id = int(row["study_plan_id"])
        unit_code, external_plan_id = study_plan_old_to_key[old_plan_id]
        level_number = int(row["level_number"])
        row["study_plan_id"] = study_plan_old_to_new[old_plan_id]
        new_id = study_plan_level_by_key.get(
            (unit_code, external_plan_id, level_number)
        ) or deterministic_id("study_plan_level", row["study_plan_id"], level_number)
        row["id"] = new_id
        study_plan_level_old_to_new[old_id] = new_id

    for row in level_courses:
        row["study_plan_level_id"] = study_plan_level_old_to_new[
            int(row["study_plan_level_id"])
        ]
        row["course_id"] = course_old_to_new[int(row["course_id"])]
        row["id"] = deterministic_id(
            "study_plan_level_course", row["study_plan_level_id"], row["course_id"]
        )

    for row in course_relations:
        row["study_plan_id"] = study_plan_old_to_new[int(row["study_plan_id"])]
        row["from_course_id"] = course_old_to_new[int(row["from_course_id"])]
        row["to_course_id"] = course_old_to_new[int(row["to_course_id"])]
        row["id"] = deterministic_id(
            "course_relation",
            row["study_plan_id"],
            row["from_course_id"],
            row["to_course_id"],
            row["relation_type"],
        )

    for row in offerings:
        old_id = int(row["id"])
        course_code, campus_code, unit_code, external_key = offering_old_to_key[old_id]
        row["course_id"] = course_old_to_new[int(row["course_id"])]
        row["campus_id"] = campus_old_to_new[int(row["campus_id"])]
        row["academic_unit_id"] = unit_old_to_new[int(row["academic_unit_id"])]
        row["academic_term_id"] = term_old_to_new[int(row["academic_term_id"])]
        new_id = offering_by_key.get(
            (course_code, campus_code, unit_code, external_key)
        ) or deterministic_id(
            "course_offering",
            row["course_id"],
            row["campus_id"],
            row["academic_unit_id"],
            row["academic_term_id"],
        )
        row["id"] = new_id
        offering_old_to_new[old_id] = new_id

    for row in groups:
        old_id = int(row["id"])
        key = group_old_to_key[old_id]
        row["course_offering_id"] = offering_old_to_new[int(row["course_offering_id"])]
        new_id = group_by_key.get(key) or deterministic_id(
            "course_offering_group", row["course_offering_id"], row["group_code"]
        )
        row["id"] = new_id
        group_old_to_new[old_id] = new_id

    for row in group_professors:
        row["course_offering_group_id"] = group_old_to_new[
            int(row["course_offering_group_id"])
        ]
        row["professor_id"] = professor_old_to_new.get(
            int(row["professor_id"]), int(row["professor_id"])
        )
        row["id"] = deterministic_id(
            "course_offering_group_professor",
            row["course_offering_group_id"],
            row["professor_id"],
        )

    for row in meetings:
        row["course_offering_group_id"] = group_old_to_new[
            int(row["course_offering_group_id"])
        ]
        row["id"] = deterministic_id(
            "course_offering_meeting",
            row["course_offering_group_id"],
            row["weekday"],
            row["starts_at"],
            row["ends_at"],
        )

    for table, payload in tables.items():
        write_json(data_dir / table / "data.json", payload)


def run_command(command: list[str], cwd: Path) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def run_sql_command(db_url: str, sql: str, cwd: Path) -> None:
    subprocess.run(
        ["psql", db_url, "-q", "-v", "ON_ERROR_STOP=1", "-c", sql],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=True,
    )


def ledger_seed_exists(db_url: str, sha256: str) -> bool:
    rows = query_rows(
        db_url,
        "SELECT 1 FROM public.sync_seed_run "
        f"WHERE seed_sha256 = '{quote_literal(sha256)}' LIMIT 1",
    )
    return bool(rows)


def ledger_fingerprint_applied(
    db_url: str,
    scope: str,
    years: list[int],
    term_external_keys: list[str],
    fingerprint: str,
) -> bool:
    years_literal = "{" + ",".join(str(v) for v in years) + "}"
    terms_literal = "{" + ",".join(term_external_keys) + "}"
    sql = f"""
    SELECT 1
    FROM public.sync_seed_run
    WHERE status = 'applied'
      AND scope = '{quote_literal(scope)}'
      AND years = '{quote_literal(years_literal)}'::INTEGER[]
      AND term_external_keys = '{quote_literal(terms_literal)}'::TEXT[]
      AND metadata ->> 'sync_fingerprint' = '{quote_literal(fingerprint)}'
    LIMIT 1;
    """
    return bool(query_rows(db_url, sql))


def record_seed_generated(
    db_url: str,
    cwd: Path,
    file_name: str,
    sha256: str,
    scope: str,
    years: list[int],
    term_external_keys: list[str],
    generated_at_utc: datetime,
    metadata: dict[str, Any],
) -> None:
    metadata_json = json.dumps(metadata, ensure_ascii=False)
    sql = f"""
    INSERT INTO public.sync_seed_run (
      seed_file_name,
      seed_sha256,
      scope,
      years,
      term_external_keys,
      generated_at_utc,
      status,
      metadata
    )
    VALUES (
      '{quote_literal(file_name)}',
      '{quote_literal(sha256)}',
      '{quote_literal(scope)}',
      {sql_int_array(years)},
      {sql_text_array(term_external_keys)},
      '{generated_at_utc.isoformat()}',
      'generated',
      '{quote_literal(metadata_json)}'::jsonb
    )
    ON CONFLICT (seed_sha256) DO UPDATE
    SET
      seed_file_name = EXCLUDED.seed_file_name,
      scope = EXCLUDED.scope,
      years = EXCLUDED.years,
      term_external_keys = EXCLUDED.term_external_keys,
      status = 'generated',
      error_message = NULL,
      metadata = EXCLUDED.metadata,
      updated_at = NOW();
    """
    run_sql_command(db_url, sql, cwd)


def mark_seed_status(
    db_url: str,
    cwd: Path,
    sha256: str,
    status: str,
    error_message: str | None = None,
    applied_at_utc: datetime | None = None,
) -> None:
    applied_sql = "NULL"
    if applied_at_utc is not None:
        applied_sql = f"'{applied_at_utc.isoformat()}'"

    error_sql = "NULL"
    if error_message:
        error_sql = f"'{quote_literal(error_message[:4000])}'"

    sql = f"""
    UPDATE public.sync_seed_run
    SET
      status = '{quote_literal(status)}',
      error_message = {error_sql},
      applied_at_utc = {applied_sql},
      updated_at = NOW()
    WHERE seed_sha256 = '{quote_literal(sha256)}';
    """
    run_sql_command(db_url, sql, cwd)


def run_verification(db_url: str) -> None:
    subprocess.run(
        [
            "psql",
            db_url,
            "-P",
            "pager=off",
            "-c",
            """
            SELECT 'course' AS table_name, count(*) FILTER (WHERE is_active = true) AS active_rows FROM public.course
            UNION ALL SELECT 'study_plan', count(*) FILTER (WHERE is_active = true) FROM public.study_plan
            UNION ALL SELECT 'professor', count(*) FILTER (WHERE is_active = true) FROM public.professor
            UNION ALL SELECT 'course_offering', count(*) FILTER (WHERE is_active = true) FROM public.course_offering
            UNION ALL SELECT 'course_offering_group', count(*) FILTER (WHERE is_active = true) FROM public.course_offering_group;
            """,
        ],
        check=True,
    )


def collect_upsert_estimate(
    db_url: str,
    data_dir: Path,
    tables: list[str],
) -> dict[str, dict[str, int]]:
    estimates: dict[str, dict[str, int]] = {}
    for table in tables:
        data_path = data_dir / table / "data.json"
        if not data_path.exists():
            continue

        rows = load_json(data_path)
        payload_ids = {int(row["id"]) for row in rows if row.get("id") is not None}
        payload_count = len(rows)
        if payload_count == 0:
            estimates[table] = {"payload": 0, "insert_estimate": 0, "update_estimate": 0}
            continue

        existing_rows = query_rows(db_url, f"SELECT id FROM public.{table}")
        existing_ids = {int(value) for value in existing_rows}
        insert_estimate = sum(1 for row_id in payload_ids if row_id not in existing_ids)
        update_estimate = max(payload_count - insert_estimate, 0)
        estimates[table] = {
            "payload": payload_count,
            "insert_estimate": insert_estimate,
            "update_estimate": update_estimate,
        }

    return estimates


def print_upsert_estimate(estimates: dict[str, dict[str, int]]) -> None:
    if not estimates:
        return

    typer.echo("Rough ID-based upsert estimate by table (before apply):")
    total_payload = 0
    total_inserts = 0
    total_updates = 0
    for table in SYNC_TABLES:
        table_stats = estimates.get(table)
        if not table_stats:
            continue
        payload = table_stats["payload"]
        insert_estimate = table_stats["insert_estimate"]
        update_estimate = table_stats["update_estimate"]
        total_payload += payload
        total_inserts += insert_estimate
        total_updates += update_estimate
        typer.echo(
            f"  - {table}: payload={payload}, id-new~{insert_estimate}, id-existing~{update_estimate}"
        )

    typer.echo(
        f"Rough totals: payload={total_payload}, id-new~{total_inserts}, id-existing~{total_updates}"
    )


def run_sync(
    data_dir: Path,
    target: str,
    db_url: str | None,
    env_file: Path,
    years: list[int],
    skip_pipeline: bool,
    skip_download: bool,
    apply_seed: bool,
    verify: bool,
    output: Path | None,
    keep_sql: bool,
) -> None:
    resolved_db_url = resolve_db_url(target, db_url, env_file)
    year_list = sorted(set(years))
    tec_data_root = Path(__file__).resolve().parents[2]
    output_path: Path | None = None
    if output is not None:
        output_path = output if output.is_absolute() else (tec_data_root / output).resolve()

    if not skip_pipeline:
        pipeline_mode = "process-only" if skip_download else "download+process"
        typer.echo(
            f"Running full tec-data pipeline ({pipeline_mode}) for years={year_list}..."
        )
        run_sync_pipeline(data_dir, year_list, skip_download=skip_download)

    backup_dir = backup_data_files(data_dir, SYNC_TABLES)
    root_dir = Path(__file__).resolve().parents[3]

    try:
        typer.echo("Remapping IDs against destination DB...")
        remap_all_ids_to_db(resolved_db_url, data_dir)

        term_external_keys = collect_term_external_keys(data_dir, year_list)
        environment_id = infer_environment_id(resolved_db_url)
        sync_fingerprint = compute_sync_fingerprint(data_dir, SYNC_TABLES)
        fingerprint_already_applied = ledger_fingerprint_applied(
            resolved_db_url,
            scope="mixed",
            years=year_list,
            term_external_keys=term_external_keys,
            fingerprint=sync_fingerprint,
        )
        if fingerprint_already_applied:
            typer.echo(
                "No data changes detected versus latest applied fingerprint. Generating NOOP audit seed."
            )

        typer.echo("Generating minimal delta seed SQL...")
        generated_at_utc = datetime.now(UTC)
        output_path = output_path or (
            Path("../seeds/tec-data")
            / f"seed_{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.sql"
        )
        if fingerprint_already_applied:
            output_path, table_stats = write_noop_seed(
                output_path=output_path,
                environment_id=environment_id,
                years=year_list,
                term_external_keys=term_external_keys,
                fingerprint=sync_fingerprint,
                scope="mixed",
            )
            is_noop = True
        else:
            output_path, table_stats, is_noop = generate_minimal_delta_seed(
                db_url=resolved_db_url,
                data_dir=data_dir,
                output_path=output_path,
                years=year_list,
                term_external_keys=term_external_keys,
                environment_id=environment_id,
                fingerprint=sync_fingerprint,
                scope="mixed",
            )
        if not output_path.is_absolute():
            output_path = (tec_data_root / output_path).resolve()

        manifest_path = output_path.with_suffix(".json")
        manifest_payload = {
            "seed_file": output_path.name,
            "generated_at_utc": generated_at_utc.isoformat(),
            "scope": "mixed",
            "years": year_list,
            "term_external_keys": term_external_keys,
            "environment_id": environment_id,
            "data_fingerprint": sync_fingerprint,
            "table_stats": table_stats,
            "noop": is_noop,
        }
        manifest_path.write_text(json.dumps(manifest_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        typer.echo(f"Generated manifest: {manifest_path}")
        typer.echo(f"Generated {output_path}")

        sha256 = seed_sha256(output_path)
        metadata = {
            "generator": "tec-data sync",
            "target": target,
            "data_dir": str(data_dir),
            "years": year_list,
            "sync_fingerprint": sync_fingerprint,
            "environment_id": environment_id,
            "table_stats": table_stats,
            "noop": is_noop,
        }
        typer.echo("Delta stats by table:")
        for table in SYNC_TABLES:
            stats = table_stats.get(table)
            if not stats:
                continue
            typer.echo(
                f"  - {table}: inserted={stats['inserted']}, updated={stats['updated']}, soft_deleted={stats['soft_deleted']}"
            )

        if ledger_seed_exists(resolved_db_url, sha256):
            typer.echo("Seed already tracked by ledger (same SHA256), marking as skipped.")
            record_seed_generated(
                db_url=resolved_db_url,
                cwd=root_dir,
                file_name=output_path.name,
                sha256=sha256,
                scope="mixed",
                years=year_list,
                term_external_keys=term_external_keys,
                generated_at_utc=generated_at_utc,
                metadata=metadata,
            )
            mark_seed_status(
                db_url=resolved_db_url,
                cwd=root_dir,
                sha256=sha256,
                status="skipped_duplicate",
            )
            apply_seed = False
        else:
            record_seed_generated(
                db_url=resolved_db_url,
                cwd=root_dir,
                file_name=output_path.name,
                sha256=sha256,
                scope="mixed",
                years=year_list,
                term_external_keys=term_external_keys,
                generated_at_utc=generated_at_utc,
                metadata=metadata,
            )

        if is_noop:
            mark_seed_status(
                db_url=resolved_db_url,
                cwd=root_dir,
                sha256=sha256,
                status="skipped_duplicate",
            )

        if is_noop:
            apply_seed = False

        if apply_seed:
            meta = parse_seed_metadata(output_path)
            file_environment_id = meta.get("environment_id")
            if not file_environment_id:
                raise RuntimeError("Generated seed is missing strict environment metadata")
            if file_environment_id != environment_id:
                raise RuntimeError(
                    "Seed environment mismatch: "
                    f"file={file_environment_id} destination={environment_id}"
                )
            typer.echo("Applying seed to destination DB...")
            try:
                subprocess.run(
                    [
                        "psql",
                        resolved_db_url,
                        "-q",
                        "-v",
                        "ON_ERROR_STOP=1",
                        "-f",
                        str(output_path),
                    ],
                    cwd=root_dir,
                    text=True,
                    capture_output=True,
                    check=True,
                )
                mark_seed_status(
                    db_url=resolved_db_url,
                    cwd=root_dir,
                    sha256=sha256,
                    status="applied",
                    applied_at_utc=datetime.now(UTC),
                )
                typer.echo("Seed apply completed successfully.")
            except subprocess.CalledProcessError as exc:
                mark_seed_status(
                    db_url=resolved_db_url,
                    cwd=root_dir,
                    sha256=sha256,
                    status="failed",
                    error_message=(exc.stderr or str(exc)),
                )
                if exc.stderr:
                    typer.echo(exc.stderr.strip())
                raise

        if verify and apply_seed:
            typer.echo("Running post-sync verification queries...")
            run_verification(resolved_db_url)
    finally:
        restore_data_files(data_dir, backup_dir)
        shutil.rmtree(backup_dir, ignore_errors=True)
        if not keep_sql and output_path is not None and output_path.exists():
            output_path.unlink()


app = typer.Typer(pretty_exceptions_show_locals=False)


@app.command("sync")
def sync_cmd(
    data_dir: Path = typer.Option(
        Path("data/raw"), "--data-dir", "-d", help="Data directory for processed files"
    ),
    target: str = typer.Option(
        "local", "--target", help="Destination target: local, remote, db-url"
    ),
    db_url: str | None = typer.Option(
        None, "--db-url", help="Destination Postgres URL (required for target=db-url)"
    ),
    env_file: Path = typer.Option(
        Path("../../.env.production.local"),
        "--env-file",
        help="Env file used when target=remote",
    ),
    years: str = typer.Option(
        "2026", "--years", "-y", help="Comma-separated years for offering sync"
    ),
    skip_pipeline: bool = typer.Option(
        False,
        "--skip-pipeline",
        help="Skip download/process pipeline and reuse current data/raw",
    ),
    skip_download: bool = typer.Option(
        False,
        "--skip-download",
        help="Run process steps only, reusing previously downloaded raw files",
    ),
    apply_seed: bool = typer.Option(
        True,
        "--apply/--no-apply",
        help="Apply generated SQL seed",
    ),
    verify: bool = typer.Option(
        True,
        "--verify/--no-verify",
        help="Run verification queries after apply",
    ),
    output: Path | None = typer.Option(
        None,
        "--output",
        "-o",
        help="Output SQL path (defaults to timestamped seed in ../seeds/tec-data)",
    ),
    keep_sql: bool = typer.Option(
        True,
        "--keep-sql",
        help="Keep generated SQL file after command finishes",
    ),
) -> None:
    """Run a full idempotent synchronization against local or remote DB."""
    year_list = [int(value.strip()) for value in years.split(",") if value.strip()]
    if not year_list:
        raise typer.BadParameter("--years must include at least one year")

    run_sync(
        data_dir=data_dir,
        target=target,
        db_url=db_url,
        env_file=env_file,
        years=year_list,
        skip_pipeline=skip_pipeline,
        skip_download=skip_download,
        apply_seed=apply_seed,
        verify=verify,
        output=output,
        keep_sql=keep_sql,
    )
