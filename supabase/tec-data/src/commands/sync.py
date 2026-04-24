"""Unified sync command for full catalog + offering synchronization."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import typer

from src.commands.download import download
from src.commands.process import run_process
from src.commands.sql import generate_seed

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


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))


def load_json(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text())


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


def run_sync_pipeline(data_dir: Path, years: list[int]) -> None:
    year_list = sorted(set(years))

    download(output_dir=data_dir)
    run_process(data_dir=data_dir, entity="campus")
    run_process(data_dir=data_dir, entity="academic_unit")
    run_process(data_dir=data_dir, entity="academic_period", years=year_list)

    download(output_dir=data_dir, entity="study_plan")
    run_process(data_dir=data_dir, entity="study_plan")

    merged_offerings: dict[int, dict[str, Any]] = {}
    merged_groups: dict[int, dict[str, Any]] = {}
    merged_group_professors: dict[int, dict[str, Any]] = {}
    merged_meetings: dict[int, dict[str, Any]] = {}
    merged_professors: dict[int, dict[str, Any]] = {}

    for year in year_list:
        year_str = str(year)
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


def run_sync(
    data_dir: Path,
    target: str,
    db_url: str | None,
    env_file: Path,
    years: list[int],
    skip_pipeline: bool,
    apply_seed: bool,
    verify: bool,
    output: Path,
    keep_sql: bool,
) -> None:
    resolved_db_url = resolve_db_url(target, db_url, env_file)
    year_list = sorted(set(years))
    tec_data_root = Path(__file__).resolve().parents[2]
    output_path = output if output.is_absolute() else (tec_data_root / output).resolve()

    if not skip_pipeline:
        typer.echo(f"Running full tec-data pipeline for years={year_list}...")
        run_sync_pipeline(data_dir, year_list)

    backup_dir = backup_data_files(data_dir, SYNC_TABLES)
    root_dir = Path(__file__).resolve().parents[3]

    try:
        typer.echo("Remapping IDs against destination DB...")
        remap_all_ids_to_db(resolved_db_url, data_dir)

        typer.echo(f"Generating full seed SQL at {output_path}...")
        generate_seed(data_dir=data_dir, output_path=output_path, tables=SYNC_TABLES)

        if apply_seed:
            typer.echo("Applying seed to destination DB...")
            run_command(
                [
                    "psql",
                    resolved_db_url,
                    "-v",
                    "ON_ERROR_STOP=1",
                    "-f",
                    str(output_path),
                ],
                cwd=root_dir,
            )

        if verify and apply_seed:
            typer.echo("Running post-sync verification queries...")
            run_verification(resolved_db_url)
    finally:
        restore_data_files(data_dir, backup_dir)
        shutil.rmtree(backup_dir, ignore_errors=True)
        if not keep_sql and output_path.exists():
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
    output: Path = typer.Option(
        Path("../seed_sync.sql"),
        "--output",
        "-o",
        help="Output SQL path",
    ),
    keep_sql: bool = typer.Option(
        False,
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
        apply_seed=apply_seed,
        verify=verify,
        output=output,
        keep_sql=keep_sql,
    )
