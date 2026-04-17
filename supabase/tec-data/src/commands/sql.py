"""Generate SQL seed data from processed JSON files."""

import json
from pathlib import Path
from typing import Any

import typer


def escape_sql_string(value: str) -> str:
    """Escape a string for SQL INSERT, handling quotes and special chars."""
    if value is None:
        return "NULL"
    escaped = value.replace("'", "''").replace("\\", "\\\\")
    return f"E'{escaped}'"


def format_value(value: Any, target_type: str = "TEXT") -> str:
    """Format a value according to its target PostgreSQL column type."""
    if value is None:
        return "NULL"

    if target_type in ("INTEGER", "BIGINT", "SMALLINT"):
        return str(int(value))
    elif target_type == "NUMERIC":
        return str(float(value))
    elif target_type == "BOOLEAN":
        return "TRUE" if value else "FALSE"
    elif target_type == "DATE":
        if isinstance(value, str) and "-" in value:
            return f"'{value}'"
        return "NULL"
    elif target_type == "TIMESTAMPTZ":
        if isinstance(value, str):
            return f"'{value}'"
        return "NOW()"
    elif target_type == "TIME":
        if isinstance(value, str) and ":" in value:
            return f"'{value}'"
        return "NULL"
    elif target_type == "UUID":
        if isinstance(value, str):
            return f"'{value}'"
        return "NULL"
    else:
        return escape_sql_string(str(value))


def generate_seed(
    data_dir: Path = Path("data/raw"),
    output_path: Path = Path("../seed.sql"),
    tables: list[str] | None = None,
) -> None:
    """Generate seed.sql from processed JSON data files.

    Args:
        data_dir: Directory containing processed data.json files
        output_path: Output path for seed.sql
        tables: Optional list of tables to include (None = all)
    """
    # Table definitions with column info
    table_configs: dict[str, dict[str, Any]] = {
        "country": {
            "columns": ["id", "name", "iso2_code"],
            "types": {"id": "BIGINT"},
            "order": 1,
        },
        "university": {
            "columns": ["id", "country_id", "name", "short_name"],
            "types": {"id": "BIGINT", "country_id": "BIGINT"},
            "order": 2,
        },
        "campus": {
            "columns": ["id", "university_id", "code", "name"],
            "types": {"id": "BIGINT", "university_id": "BIGINT"},
            "order": 3,
        },
        "academic_unit": {
            "columns": ["id", "university_id", "code", "name"],
            "types": {"id": "BIGINT", "university_id": "BIGINT"},
            "order": 4,
        },
        "academic_modality": {
            "columns": ["id", "code", "name", "periods_per_year"],
            "types": {"id": "BIGINT", "periods_per_year": "INTEGER"},
            "order": 5,
        },
        "academic_term": {
            "columns": [
                "id",
                "academic_modality_id",
                "year",
                "period_number",
                "external_key",
                "display_name",
                "starts_on",
                "ends_on",
            ],
            "types": {
                "id": "BIGINT",
                "academic_modality_id": "BIGINT",
                "year": "INTEGER",
                "period_number": "INTEGER",
                "starts_on": "DATE",
                "ends_on": "DATE",
            },
            "order": 6,
        },
        "academic_unit_campus": {
            "columns": ["id", "academic_unit_id", "campus_id"],
            "types": {
                "id": "BIGINT",
                "academic_unit_id": "BIGINT",
                "campus_id": "BIGINT",
            },
            "order": 7,
        },
        "study_plan": {
            "columns": [
                "id",
                "academic_unit_id",
                "academic_modality_id",
                "external_plan_id",
                "name",
                "academic_degree",
                "first_level_number",
            ],
            "types": {
                "id": "BIGINT",
                "academic_unit_id": "BIGINT",
                "academic_modality_id": "BIGINT",
                "external_plan_id": "INTEGER",
                "first_level_number": "INTEGER",
                "academic_degree": "TEXT",
            },
            "order": 8,
        },
        "study_plan_campus": {
            "columns": ["id", "study_plan_id", "campus_id", "valid_from", "valid_to"],
            "types": {
                "id": "BIGINT",
                "study_plan_id": "BIGINT",
                "campus_id": "BIGINT",
                "valid_from": "DATE",
                "valid_to": "DATE",
            },
            "order": 9,
        },
        "study_plan_level": {
            "columns": ["id", "study_plan_id", "level_number", "level_label"],
            "types": {
                "id": "BIGINT",
                "study_plan_id": "BIGINT",
                "level_number": "INTEGER",
            },
            "order": 10,
        },
        "course": {
            "columns": [
                "id",
                "code",
                "name",
                "default_credits",
                "default_weekly_hours",
            ],
            "types": {
                "id": "BIGINT",
                "default_credits": "INTEGER",
                "default_weekly_hours": "INTEGER",
            },
            "order": 11,
        },
        "study_plan_level_course": {
            "columns": [
                "id",
                "study_plan_level_id",
                "course_id",
                "credits",
                "weekly_hours",
                "sort_order",
            ],
            "types": {
                "id": "BIGINT",
                "study_plan_level_id": "BIGINT",
                "course_id": "BIGINT",
                "credits": "INTEGER",
                "weekly_hours": "INTEGER",
                "sort_order": "INTEGER",
            },
            "order": 12,
        },
        "course_relation": {
            "columns": [
                "id",
                "study_plan_id",
                "from_course_id",
                "to_course_id",
                "relation_type",
            ],
            "types": {
                "id": "BIGINT",
                "study_plan_id": "BIGINT",
                "from_course_id": "BIGINT",
                "to_course_id": "BIGINT",
            },
            "order": 13,
        },
        "professor": {
            "columns": ["id", "full_name"],
            "types": {"id": "BIGINT"},
            "order": 14,
        },
        "course_offering": {
            "columns": [
                "id",
                "course_id",
                "campus_id",
                "academic_unit_id",
                "academic_term_id",
                "credits_snapshot",
                "weekly_hours_snapshot",
                "course_type",
            ],
            "types": {
                "id": "BIGINT",
                "course_id": "BIGINT",
                "campus_id": "BIGINT",
                "academic_unit_id": "BIGINT",
                "academic_term_id": "BIGINT",
                "credits_snapshot": "INTEGER",
                "weekly_hours_snapshot": "INTEGER",
            },
            "order": 15,
        },
        "course_offering_group": {
            "columns": [
                "id",
                "course_offering_id",
                "group_code",
                "group_type",
                "capacity",
            ],
            "types": {
                "id": "BIGINT",
                "course_offering_id": "BIGINT",
                "capacity": "INTEGER",
            },
            "order": 16,
        },
        "course_offering_group_professor": {
            "columns": ["id", "course_offering_group_id", "professor_id"],
            "types": {
                "id": "BIGINT",
                "course_offering_group_id": "BIGINT",
                "professor_id": "BIGINT",
            },
            "order": 17,
        },
        "course_offering_meeting": {
            "columns": [
                "id",
                "course_offering_group_id",
                "weekday",
                "starts_at",
                "ends_at",
                "classroom",
            ],
            "types": {
                "id": "BIGINT",
                "course_offering_group_id": "BIGINT",
                "weekday": "INTEGER",
                "starts_at": "TIME",
                "ends_at": "TIME",
            },
            "order": 18,
        },
    }

    # Filter tables if specified
    if tables:
        table_configs = {k: v for k, v in table_configs.items() if k in tables}
        if not table_configs:
            typer.echo(
                f"Error: No valid tables found. Available: {list(table_configs.keys())}"
            )
            raise typer.Exit(1)

    # Sort by order
    sorted_tables = sorted(table_configs.items(), key=lambda x: x[1]["order"])

    # Generate SQL
    output_lines: list[str] = []
    output_lines.append(
        "-- ============================================================================"
    )
    output_lines.append("-- SEED DATA")
    output_lines.append("-- Generated by: tec-data sql")
    output_lines.append(f"-- Generated at: {Path(__file__).parent}")
    output_lines.append(
        "-- ============================================================================"
    )
    output_lines.append("")
    output_lines.append("BEGIN;")

    total_rows = 0

    for table_name, config in sorted_tables:
        data_path = data_dir / table_name / "data.json"
        if not data_path.exists():
            typer.echo(f"Warning: {data_path} not found, skipping {table_name}")
            continue

        try:
            with open(data_path, encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            typer.echo(f"Error: Invalid JSON in {data_path}: {e}")
            continue

        if not data:
            typer.echo(f"Warning: Empty data in {data_path}, skipping {table_name}")
            continue

        output_lines.append("")
        output_lines.append(f"-- {table_name} ({len(data)} rows)")

        columns = config["columns"]
        types = config.get("types", {})
        output_lines.append(f"INSERT INTO public.{table_name}")
        output_lines.append(f"  ({', '.join(columns)})")
        output_lines.append("VALUES")

        values_lines: list[str] = []
        for row in data:
            formatted_values: list[str] = []
            for col in columns:
                value = row.get(col)
                col_type = types.get(col, "TEXT")
                formatted_values.append(format_value(value, col_type))
            values_lines.append(f"  ({', '.join(formatted_values)})")

        output_lines.append(",\n".join(values_lines) + ";")
        total_rows += len(data)

    output_lines.append("")
    output_lines.append("COMMIT;")
    output_lines.append("")

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(output_lines), encoding="utf-8")

    typer.echo(f"Generated {output_path} with {total_rows:,} total rows")


def run_sql(
    data_dir: Path = typer.Option(
        Path("data/raw"), "--data-dir", "-d", help="Data directory for processed files"
    ),
    output: Path = typer.Option(
        Path("../seed.sql"), "--output", "-o", help="Output SQL file path"
    ),
    tables: str | None = typer.Option(
        None, "--tables", "-t", help="Comma-separated list of tables to include"
    ),
) -> None:
    """Generate SQL seed data from processed JSON files."""
    table_list = None
    if tables:
        table_list = [t.strip() for t in tables.split(",")]

    generate_seed(data_dir=data_dir, output_path=output, tables=table_list)
    typer.echo(f"Seed SQL generated: {output}")
