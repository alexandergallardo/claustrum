"""Download command."""

import json
import warnings
from pathlib import Path
from typing import Any

import typer

from src.api.academic_period import AcademicPeriodClient
from src.api.academic_unit import AcademicUnitClient
from src.api.campus import CampusClient
from src.api.study_plan import StudyPlanClient

# Suppress SSL warnings
warnings.filterwarnings("ignore", message="Unverified HTTPS request")


def _progress_prefix(label: str) -> str:
    return f"[{label}]"


def run_study_plan_download_cli(
    output_dir: Path,
    academic_unit_campus_data: list[dict[str, Any]],
    verify_ssl: bool,
    concurrency: int,
) -> None:
    """Run study plan download with plain CLI progress output."""
    total_combos = len(academic_unit_campus_data)
    typer.echo(
        f"{_progress_prefix('study_plan')} Starting download for {total_combos} campus-unit combinations"
    )

    state = {
        "combo_processed": 0,
        "combo_total": total_combos,
        "plans_found": 0,
        "unique_plans": 0,
        "plans_total": 0,
        "fetched": 0,
        "failed": 0,
    }

    def progress_callback(payload: dict[str, Any]) -> None:
        event = payload.get("event")
        if event == "combination":
            state["combo_processed"] = int(payload.get("processed", state["combo_processed"]))
            state["combo_total"] = int(payload.get("total", state["combo_total"]))
            state["plans_found"] = int(payload.get("plans_found", state["plans_found"]))
            state["unique_plans"] = int(payload.get("unique_plans", state["unique_plans"]))
            processed = state["combo_processed"]
            total = max(state["combo_total"], 1)
            pct = (processed / total) * 100
            typer.echo(
                f"{_progress_prefix('study_plan')} combinations {processed}/{state['combo_total']} ({pct:.1f}%) | plans found={state['plans_found']} unique={state['unique_plans']}"
            )
            return

        if event == "plans_total":
            state["plans_total"] = int(payload.get("total", 0))
            typer.echo(
                f"{_progress_prefix('study_plan')} fetching detailed plans: total={state['plans_total']}"
            )
            return

        if event == "plan_detail":
            state["fetched"] = int(payload.get("fetched", state["fetched"]))
            state["failed"] = int(payload.get("failed", state["failed"]))
            total = int(payload.get("total", state["plans_total"]))
            total = max(total, 1)
            done = state["fetched"] + state["failed"]
            pct = (done / total) * 100
            typer.echo(
                f"{_progress_prefix('study_plan')} plan details {done}/{total} ({pct:.1f}%) | fetched={state['fetched']} failed={state['failed']}"
            )
            return

        if event == "no_plans":
            typer.echo(
                f"{_progress_prefix('study_plan')} careers without plans: {payload.get('count', 0)}"
            )
            return

        if event == "errors":
            typer.echo(
                f"{_progress_prefix('study_plan')} fetch errors: {payload.get('count', 0)}"
            )
            return

        if event == "complete":
            files = payload.get("files", {})
            typer.echo(
                f"{_progress_prefix('study_plan')} completed | found={payload.get('plans_found', state['plans_found'])} fetched={payload.get('plans_fetched', state['fetched'])} failed={payload.get('plans_failed', state['failed'])}"
            )
            for name, path in files.items():
                typer.echo(f"{_progress_prefix('study_plan')} saved {name}: {path}")

    client = StudyPlanClient(verify_ssl=verify_ssl)
    try:
        client.download_raw(
            output_dir,
            academic_unit_campus_data,
            max_concurrency=concurrency,
            progress_callback=progress_callback,
        )
    finally:
        client.close()


def download(
    output_dir: Path = Path("data/raw"),
    entity: str | None = None,
    verify_ssl: bool = False,
    concurrency: int = 3,
    year: str | None = None,
    years: list[str] | None = None,
) -> bool:
    """Download raw data from TEC APIs.

    When entity is None, downloads all available data in order:
    - campus
    - academic_unit
    - academic_period

    Note: study_plan requires academic_unit_campus which is generated
    during 'process', so it must be downloaded separately after processing:
    1. uv run tec-data download
    2. uv run tec-data process
    3. uv run tec-data download --entity study_plan
    4. uv run tec-data process --entity study_plan
    """
    # Download campus (always needed)
    if entity is None or entity == "campus":
        typer.echo(f"{_progress_prefix('download')} fetching campus data...")
        client = CampusClient()
        try:
            files = client.download_raw(output_dir)
            for source, path in files.items():
                print(f"Saved campus {source} data to: {path}")
        finally:
            client.close()

    # Download academic_unit (always needed for study_plan later)
    if entity is None or entity == "academic_unit":
        typer.echo(f"{_progress_prefix('download')} fetching academic_unit data...")
        # Load campus data to get campus codes
        campus_path = output_dir / "campus" / "data.json"
        if campus_path.exists():
            campuses = json.loads(campus_path.read_text())
            campus_codes = [c["code"] for c in campuses]
        else:
            campus_codes = ["CA", "SJ", "SC", "AL", "LM"]  # Default

        client = AcademicUnitClient(verify_ssl=verify_ssl)
        try:
            files = client.download_raw(output_dir, campus_codes)
            for source, path in files.items():
                print(f"Saved academic_unit {source} data to: {path}")
        finally:
            client.close()

    # Download academic_period (modalities and terms)
    if entity is None or entity == "academic_period":
        typer.echo(f"{_progress_prefix('download')} fetching academic_period data...")
        client = AcademicPeriodClient(verify_ssl=verify_ssl)
        try:
            files = client.download_raw(output_dir)
            for source, path in files.items():
                print(f"Saved academic_period {source} data to: {path}")
        finally:
            client.close()

    # Download study_plan only if requested explicitly (requires process first)
    if entity == "study_plan":
        typer.echo(f"{_progress_prefix('download')} preparing study_plan dependencies...")
        # Load campus data to get campus codes
        campus_path = output_dir / "campus" / "data.json"
        if campus_path.exists():
            campuses = json.loads(campus_path.read_text())
            campus_codes = [c["code"] for c in campuses]
        else:
            campus_codes = ["CA", "SJ", "SC", "AL", "LM"]  # Default

        client = AcademicUnitClient(verify_ssl=verify_ssl)
        try:
            files = client.download_raw(output_dir, campus_codes)
            for source, path in files.items():
                print(f"Saved academic_unit {source} data to: {path}")
        finally:
            client.close()

    # Download study_plan only if requested explicitly
    if entity == "study_plan":
        typer.echo(f"{_progress_prefix('download')} fetching study_plan data...")
        # Load academic_unit_campus data to get valid combinations
        relation_path = output_dir / "academic_unit_campus" / "data.json"
        if not relation_path.exists():
            print(f"Error: academic_unit_campus data not found at {relation_path}")
            print(
                "Please run 'process' command first to generate academic_unit_campus data."
            )
            return False

        relations = json.loads(relation_path.read_text())

        # Build combinations using campus codes and academic unit codes
        # First load campus data to map campus_id -> code
        campus_path = output_dir / "campus" / "data.json"
        if campus_path.exists():
            campuses = json.loads(campus_path.read_text())
            campus_id_to_code = {c["id"]: c["code"] for c in campuses}
        else:
            print(f"Error: campus data not found at {campus_path}")
            return False

        # Load academic_unit data to map unit id -> code
        unit_path = output_dir / "academic_unit" / "data.json"
        if unit_path.exists():
            units = json.loads(unit_path.read_text())
            unit_id_to_code = {u["id"]: u["code"] for u in units}
        else:
            print(f"Error: academic_unit data not found at {unit_path}")
            return False

        # Build list of (campus_code, academic_unit_code) combinations
        academic_unit_campus_data = []
        for relation in relations:
            campus_id = relation.get("campus_id")
            academic_unit_id = relation.get("academic_unit_id")

            campus_code = campus_id_to_code.get(campus_id)
            academic_unit_code = unit_id_to_code.get(academic_unit_id)

            if campus_code and academic_unit_code:
                academic_unit_campus_data.append(
                    {
                        "campus_code": campus_code,
                        "academic_unit_code": academic_unit_code,
                    }
                )

        run_study_plan_download_cli(
            output_dir=output_dir,
            academic_unit_campus_data=academic_unit_campus_data,
            verify_ssl=verify_ssl,
            concurrency=concurrency,
        )

    # Download academic_period (modalities and terms)
    if entity == "academic_period":
        client = AcademicPeriodClient(verify_ssl=verify_ssl)
        try:
            files = client.download_raw(output_dir)
            for source, path in files.items():
                print(f"Saved academic_period {source} data to {path}")
        finally:
            client.close()

    years_list = [item.strip() for item in (years or []) if item and item.strip()]
    if year:
        years_list.append(year.strip())
    years_list = sorted(set(years_list))

    if entity in {"course_offer", "schedule_guia", "offering"} and not years_list:
        print("Error: --year or --years is required for offering downloads")
        return False

    if entity == "course_offer":
        unit_path = output_dir / "academic_unit" / "data.json"
        if not unit_path.exists():
            print(f"Error: academic_unit data not found at {unit_path}")
            print("Please run 'process' command first to generate academic_unit data.")
            return False

        units = json.loads(unit_path.read_text())
        school_codes = [u["code"] for u in units]

        client = AcademicUnitClient(verify_ssl=verify_ssl)
        try:
            for current_year in years_list:
                typer.echo(
                    f"{_progress_prefix('download')} fetching course_offer for year={current_year}..."
                )
                files = client.download_oferta_cursos(output_dir, school_codes, current_year)
                for code, path in files.items():
                    print(f"Saved course_offer for {code} to: {path}")
        finally:
            client.close()

    if entity == "schedule_guia":
        client = AcademicUnitClient(verify_ssl=verify_ssl)
        try:
            for current_year in years_list:
                typer.echo(
                    f"{_progress_prefix('download')} fetching schedule_guia for year={current_year}..."
                )

                course_offer_path = output_dir / "course_offer" / current_year
                if not course_offer_path.exists():
                    print(f"Error: course_offer data not found at {course_offer_path}")
                    print(
                        f"Please run 'download --entity course_offer --year {current_year}' first."
                    )
                    return False

                files = client.download_horarios_from_course_offer(output_dir, current_year)
                for file_name, path in files.items():
                    print(f"Saved schedule_guia {file_name} to: {path}")
        finally:
            client.close()

    if entity == "offering":
        unit_path = output_dir / "academic_unit" / "data.json"
        if not unit_path.exists():
            print(f"Error: academic_unit data not found at {unit_path}")
            print("Please run 'process' command first to generate academic_unit data.")
            return False

        units = json.loads(unit_path.read_text())
        school_codes = [u["code"] for u in units]

        client = AcademicUnitClient(verify_ssl=verify_ssl)
        try:
            for current_year in years_list:
                typer.echo(
                    f"{_progress_prefix('download')} fetching course_offer for year={current_year}..."
                )
                files = client.download_oferta_cursos(output_dir, school_codes, current_year)
                for code, path in files.items():
                    print(f"Saved course_offer for {code} to: {path}")

                typer.echo(
                    f"{_progress_prefix('download')} fetching schedule_guia for year={current_year}..."
                )
                files = client.download_horarios_from_course_offer(output_dir, current_year)
                for file_name, path in files.items():
                    print(f"Saved schedule_guia {file_name} to: {path}")
        finally:
            client.close()

    return True
